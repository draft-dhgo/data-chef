import { getConfig, LOG_TAGS } from '../config';
import { JavaSparkExecutor } from './java-executor';

export interface TableInfo {
    name: string;
    namespace: string;
}

export interface TablePreview {
    schema: Array<{ name: string; type: string }>;
    rows: any[];
    rowCount: number;
}

export interface QueryResult {
    schema: Array<{ name: string; type: string }>;
    rows: any[];
    rowCount: number;
    query: string;
}

class IcebergQueryService extends JavaSparkExecutor {
    async executeQuery(sql: string, limit: number = 100): Promise<QueryResult> {
        const config = getConfig();

        const configJson = JSON.stringify({
            minio: config.minio,
            spark: config.spark,
            iceberg: config.iceberg
        });

        const result = await this.executeJava(
            'query',
            ['--sql', sql, '--limit', limit.toString()],
            configJson,
            undefined,
            (data) => {
                this.parseJsonLogs(data, (level, message) => {
                    console.log(`${LOG_TAGS.TABLES}:${level}] ${message}`);
                });
            }
        );

        if (result.success && result.data) {
            return { ...result.data, query: sql };
        }

        throw new Error(result.error || 'Failed to execute query');
    }

    async listIcebergTables(): Promise<TableInfo[]> {
        const config = getConfig();

        const configJson = JSON.stringify({
            minio: config.minio,
            spark: config.spark,
            iceberg: config.iceberg
        });

        const result = await this.executeJava(
            'list',
            [],
            configJson,
            undefined,
            (data) => {
                this.parseJsonLogs(data, (level, message) => {
                    console.log(`${LOG_TAGS.TABLES}:${level}] ${message}`);
                });
            }
        );

        if (result.success && result.data) {
            return result.data.tables || [];
        }

        throw new Error(result.error || 'Failed to list tables');
    }

    async previewTable(tableName: string, limit: number = 10): Promise<TablePreview> {
        const config = getConfig();

        const configJson = JSON.stringify({
            minio: config.minio,
            spark: config.spark,
            iceberg: config.iceberg
        });

        const result = await this.executeJava(
            'preview',
            ['--table', tableName, '--limit', limit.toString()],
            configJson,
            undefined,
            (data) => {
                this.parseJsonLogs(data, (level, message) => {
                    console.log(`${LOG_TAGS.PREVIEW}:${level}] ${message}`);
                });
            }
        );

        if (result.success && result.data) {
            return result.data;
        }

        throw new Error(result.error || 'Failed to preview table');
    }
}

export const icebergQuery = new IcebergQueryService();
