import Database from 'better-sqlite3';
import { join } from 'path';
import { homedir } from 'os';
import { mkdirSync, existsSync } from 'fs';
import { v4 as uuidv4 } from 'uuid';
import type { Pipe } from '../types';
import { minioStorage } from './minio-storage';
import { LOG_TAGS } from '../config';

class PipeManagerService {
    private db: Database.Database | null = null;

    private getDbPath(): string {
        if (process.env.DATA_CHEF_DB_PATH) {
            return process.env.DATA_CHEF_DB_PATH;
        }
        return join(homedir(), '.data-chef', 'pipes.db');
    }

    private getDb(): Database.Database {
        if (!this.db) {
            const dbPath = this.getDbPath();
            const dbDir = join(dbPath, '..');
            if (!existsSync(dbDir)) {
                mkdirSync(dbDir, { recursive: true });
            }
            console.log(`${LOG_TAGS.DB} Database path: ${dbPath}`);
            this.db = new Database(dbPath);
        }
        return this.db;
    }

    initDatabase(): void {
        const db = this.getDb();

        db.exec(`
            CREATE TABLE IF NOT EXISTS pipes (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                storage_path TEXT NOT NULL,
                file_pattern TEXT NOT NULL,
                record_boundary TEXT NOT NULL,
                schema TEXT NOT NULL,
                partitioning TEXT NOT NULL,
                output TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        `);

        db.exec(`
            CREATE TABLE IF NOT EXISTS executions (
                id TEXT PRIMARY KEY,
                pipe_id TEXT NOT NULL,
                pipe_name TEXT NOT NULL,
                source_path TEXT NOT NULL,
                status TEXT NOT NULL,
                started_at TEXT NOT NULL,
                completed_at TEXT,
                files_processed INTEGER DEFAULT 0,
                records_processed INTEGER DEFAULT 0,
                bytes_processed INTEGER DEFAULT 0,
                error TEXT,
                logs TEXT,
                FOREIGN KEY (pipe_id) REFERENCES pipes(id)
            )
        `);

        this.createDefaultPipes();
    }

    private createDefaultPipes(): void {
        const existingPipes = this.listPipes();

        const hasJsonPipe = existingPipes.some(p => p.name === 'JSON 파일 처리기');
        if (!hasJsonPipe) {
            this.createPipe({
                name: 'JSON 파일 처리기',
                description: 'JSON 파일을 읽어서 Iceberg 테이블로 저장하는 기본 파이프입니다.',
                storagePath: '/json_data',
                filePattern: {
                    extensions: ['json'],
                    prefix: '',
                    suffix: ''
                },
                recordBoundary: {
                    type: 'json',
                    encoding: 'utf-8'
                },
                schema: {
                    inferFromData: true,
                    columns: []
                },
                partitioning: {
                    enabled: false,
                    keys: []
                },
                output: {
                    tableName: 'json_data',
                    catalog: 'iceberg_catalog',
                    namespace: 'default',
                    writeMode: 'append'
                }
            });
        }

        const hasLogPipe = existingPipes.some(p => p.name === '로그 파일 처리기');
        if (!hasLogPipe) {
            this.createPipe({
                name: '로그 파일 처리기',
                description: '텍스트 로그 파일에서 타임스탬프, 레벨, 메시지를 추출하는 파이프입니다.',
                storagePath: '/logs',
                filePattern: {
                    extensions: ['log', 'txt'],
                    prefix: '',
                    suffix: ''
                },
                recordBoundary: {
                    type: 'text',
                    encoding: 'utf-8',
                    fieldExtraction: {
                        method: 'regex',
                        pattern: '(\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2}) \\[(\\w+)\\] (.*)',
                        fieldNames: ['timestamp', 'level', 'message']
                    }
                },
                schema: {
                    inferFromData: false,
                    columns: [
                        { name: 'timestamp', type: 'string', nullable: false },
                        { name: 'level', type: 'string', nullable: false },
                        { name: 'message', type: 'string', nullable: true }
                    ]
                },
                partitioning: {
                    enabled: false,
                    keys: []
                },
                output: {
                    tableName: 'logs',
                    catalog: 'iceberg_catalog',
                    namespace: 'default',
                    writeMode: 'append'
                }
            });
        }
    }

    listPipes(): Pipe[] {
        const db = this.getDb();
        const stmt = db.prepare('SELECT * FROM pipes ORDER BY updated_at DESC');
        const rows = stmt.all() as any[];
        return rows.map(this.rowToPipe);
    }

    getPipe(id: string): Pipe | null {
        const db = this.getDb();
        const stmt = db.prepare('SELECT * FROM pipes WHERE id = ?');
        const row = stmt.get(id) as any;
        if (!row) return null;
        return this.rowToPipe(row);
    }

    async createPipe(pipe: Omit<Pipe, 'id' | 'createdAt' | 'updatedAt'>): Promise<Pipe> {
        const id = uuidv4();
        const now = new Date().toISOString();

        await minioStorage.createFolder(pipe.storagePath);

        const db = this.getDb();
        const stmt = db.prepare(`
            INSERT INTO pipes (id, name, description, storage_path, file_pattern, record_boundary, schema, partitioning, output, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        stmt.run(
            id,
            pipe.name,
            pipe.description || null,
            pipe.storagePath,
            JSON.stringify(pipe.filePattern),
            JSON.stringify(pipe.recordBoundary),
            JSON.stringify(pipe.schema),
            JSON.stringify(pipe.partitioning),
            JSON.stringify(pipe.output),
            now,
            now
        );

        return {
            ...pipe,
            id,
            createdAt: now,
            updatedAt: now
        };
    }

    updatePipe(id: string, updates: Partial<Pipe>): Pipe | null {
        const existing = this.getPipe(id);
        if (!existing) return null;

        const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };

        const db = this.getDb();
        const stmt = db.prepare(`
            UPDATE pipes
            SET name = ?, description = ?, storage_path = ?, file_pattern = ?, record_boundary = ?, schema = ?, partitioning = ?, output = ?, updated_at = ?
            WHERE id = ?
        `);

        stmt.run(
            updated.name,
            updated.description || null,
            updated.storagePath,
            JSON.stringify(updated.filePattern),
            JSON.stringify(updated.recordBoundary),
            JSON.stringify(updated.schema),
            JSON.stringify(updated.partitioning),
            JSON.stringify(updated.output),
            updated.updatedAt,
            id
        );

        return updated;
    }

    async deletePipe(id: string): Promise<boolean> {
        const pipe = this.getPipe(id);
        if (!pipe) return false;

        try {
            await minioStorage.deleteFolder(pipe.storagePath);
        } catch (error) {
            console.error(`${LOG_TAGS.PIPE} Failed to delete folder: ${error}`);
        }

        const db = this.getDb();
        const stmt = db.prepare('DELETE FROM pipes WHERE id = ?');
        const result = stmt.run(id);
        return result.changes > 0;
    }

    private rowToPipe(row: any): Pipe {
        return {
            id: row.id,
            name: row.name,
            description: row.description,
            storagePath: row.storage_path,
            filePattern: JSON.parse(row.file_pattern),
            recordBoundary: JSON.parse(row.record_boundary),
            schema: JSON.parse(row.schema),
            partitioning: JSON.parse(row.partitioning),
            output: JSON.parse(row.output),
            createdAt: row.created_at,
            updatedAt: row.updated_at
        };
    }
}

export const pipeManager = new PipeManagerService();
