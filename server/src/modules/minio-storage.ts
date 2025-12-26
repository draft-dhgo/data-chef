import * as Minio from 'minio';
import { Readable } from 'stream';
import { getConfig, LOG_TAGS } from '../config';

export interface StorageItem {
    name: string;
    path: string;
    type: 'file' | 'folder';
    size?: number;
    lastModified?: string;
}

class MinioStorageService {
    private minioClient: Minio.Client | null = null;

    private getClient(): Minio.Client {
        if (!this.minioClient) {
            const config = getConfig();
            this.minioClient = new Minio.Client({
                endPoint: config.minio.endpoint,
                port: config.minio.port,
                useSSL: config.minio.useSSL,
                accessKey: config.minio.accessKey,
                secretKey: config.minio.secretKey
            });
        }
        return this.minioClient;
    }

    private getBucket(): string {
        return getConfig().minio.defaultBucket;
    }

    private normalizePath(path: string): string {
        if (!path || path === '/') return '';
        return path.replace(/^\/+/, '').replace(/\/+$/, '');
    }

    async ensureBucket(): Promise<void> {
        const client = this.getClient();
        const bucket = this.getBucket();

        const exists = await client.bucketExists(bucket);
        if (!exists) {
            await client.makeBucket(bucket);
            console.log(`${LOG_TAGS.MINIO} Created bucket: ${bucket}`);
        }
    }

    async listPath(path: string): Promise<StorageItem[]> {
        const client = this.getClient();
        const bucket = this.getBucket();

        if (path !== '/' && path !== '') {
            const normalizedPath = this.normalizePath(path);
            const prefixWithSlash = `${normalizedPath}/`;

            return new Promise((resolve, reject) => {
                const items: StorageItem[] = [];

                const stream = client.listObjects(bucket, prefixWithSlash, false);

                stream.on('data', (obj) => {
                    if (obj.name) {
                        const name = obj.name.replace(prefixWithSlash, '');
                        if (name && !name.endsWith('/')) {
                            items.push({
                                name,
                                path: obj.name,
                                type: 'file',
                                size: obj.size,
                                lastModified: obj.lastModified?.toISOString()
                            });
                        }
                    }
                });

                stream.on('error', reject);
                stream.on('end', () => resolve(items));
            });
        }

        return new Promise((resolve, reject) => {
            const items: StorageItem[] = [];
            const seenFolders = new Set<string>();

            const stream = client.listObjects(bucket, '', false);

            stream.on('data', (obj) => {
                if (obj.prefix) {
                    const folderPath = obj.prefix.replace(/\/$/, '');
                    if (folderPath && !seenFolders.has(folderPath)) {
                        seenFolders.add(folderPath);
                        items.push({
                            name: folderPath,
                            path: folderPath,
                            type: 'folder'
                        });
                    }
                }
            });

            stream.on('error', reject);
            stream.on('end', () => resolve(items));
        });
    }

    async createFolder(path: string): Promise<void> {
        const client = this.getClient();
        const bucket = this.getBucket();
        const normalizedPath = this.normalizePath(path);
        const folderKey = `${normalizedPath}/.keep`;

        await client.putObject(bucket, folderKey, Buffer.from(''));
    }

    async uploadFile(
        path: string,
        fileName: string,
        buffer: Buffer,
        contentType: string
    ): Promise<string> {
        const client = this.getClient();
        const bucket = this.getBucket();
        const normalizedPath = this.normalizePath(path);
        const objectKey = normalizedPath ? `${normalizedPath}/${fileName}` : fileName;

        await client.putObject(bucket, objectKey, buffer, buffer.length, {
            'Content-Type': contentType
        });

        return objectKey;
    }

    async uploadFileStream(
        path: string,
        fileName: string,
        stream: Readable,
        size: number,
        contentType: string
    ): Promise<string> {
        const client = this.getClient();
        const bucket = this.getBucket();
        const normalizedPath = this.normalizePath(path);
        const objectKey = normalizedPath ? `${normalizedPath}/${fileName}` : fileName;

        await client.putObject(bucket, objectKey, stream, size, {
            'Content-Type': contentType
        });

        return objectKey;
    }

    async deleteFile(path: string): Promise<void> {
        const client = this.getClient();
        const bucket = this.getBucket();
        const normalizedPath = this.normalizePath(path);

        await client.removeObject(bucket, normalizedPath);
    }

    async deleteFolder(path: string): Promise<void> {
        const client = this.getClient();
        const bucket = this.getBucket();
        const prefix = this.normalizePath(path);
        const prefixWithSlash = `${prefix}/`;

        const objects: string[] = [];
        const stream = client.listObjects(bucket, prefixWithSlash, true);

        await new Promise<void>((resolve, reject) => {
            stream.on('data', (obj) => {
                if (obj.name) {
                    objects.push(obj.name);
                }
            });
            stream.on('error', reject);
            stream.on('end', () => resolve());
        });

        if (objects.length > 0) {
            await client.removeObjects(bucket, objects);
        }
    }

    async getFileStream(path: string): Promise<Readable> {
        const client = this.getClient();
        const bucket = this.getBucket();
        const normalizedPath = this.normalizePath(path);

        return await client.getObject(bucket, normalizedPath);
    }

    async getFileStat(path: string): Promise<Minio.BucketItemStat | null> {
        const client = this.getClient();
        const bucket = this.getBucket();
        const normalizedPath = this.normalizePath(path);

        try {
            return await client.statObject(bucket, normalizedPath);
        } catch {
            return null;
        }
    }

    getS3Path(path: string): string {
        const bucket = this.getBucket();
        const normalizedPath = this.normalizePath(path);
        return `s3a://${bucket}/${normalizedPath}`;
    }
}

export const minioStorage = new MinioStorageService();
