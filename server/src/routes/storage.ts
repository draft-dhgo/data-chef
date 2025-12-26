import { Router } from 'express';
import multer from 'multer';
import { minioStorage } from '../modules/minio-storage';
import { pipeManager } from '../modules/pipe-manager';
import { sparkRunner } from '../modules/spark-runner';
import { LOG_TAGS } from '../config';
import type { ExecutionLog } from '../types';

export const storageRouter = Router();

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 100 * 1024 * 1024
    }
});

export async function initStorage(): Promise<void> {
    await minioStorage.ensureBucket();
    console.log(`${LOG_TAGS.STORAGE} MinIO bucket initialized`);
}

storageRouter.get('/', async (req, res) => {
    const path = (req.query.path as string) || '/';

    try {
        const items = await minioStorage.listPath(path);
        res.json({
            path,
            items
        });
    } catch (error) {
        console.error(`${LOG_TAGS.STORAGE} List error:`, error);
        res.status(500).json({ error: 'Failed to list path' });
    }
});

storageRouter.post('/upload', upload.array('files', 100), async (req, res) => {
    const path = (req.body.path as string) || '/';
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
        res.status(400).json({ error: 'No files uploaded' });
        return;
    }

    try {
        const uploaded: string[] = [];

        for (const file of files) {
            const objectKey = await minioStorage.uploadFile(
                path,
                file.originalname,
                file.buffer,
                file.mimetype
            );
            uploaded.push(objectKey);
        }

        const pipes = pipeManager.listPipes();
        const matchingPipe = pipes.find(p => p.storagePath === path);
        
        if (matchingPipe) {
            console.log(`${LOG_TAGS.STORAGE} Auto-executing pipe: ${matchingPipe.name} for path: ${path}`);
            
            const logs: ExecutionLog[] = [];
            sparkRunner.executePipe(matchingPipe.id, path, (log) => {
                logs.push(log);
                console.log(`${LOG_TAGS.PIPE} ${matchingPipe.name}] [${log.level}] ${log.message}`);
            }).then(result => {
                if (result.success) {
                    console.log(`${LOG_TAGS.STORAGE} Pipe execution completed successfully`);
                } else {
                    console.error(`${LOG_TAGS.STORAGE} Pipe execution failed: ${result.error}`);
                }
            }).catch(error => {
                console.error(`${LOG_TAGS.STORAGE} Pipe execution error:`, error);
            });
        }

        res.json({ success: true, files: uploaded, pipeExecuted: !!matchingPipe });
    } catch (error) {
        console.error(`${LOG_TAGS.STORAGE} Upload error:`, error);
        res.status(500).json({ error: 'Failed to upload files' });
    }
});

storageRouter.delete('/', async (req, res) => {
    const { path, type } = req.body;

    if (!path) {
        res.status(400).json({ error: 'path is required' });
        return;
    }

    try {
        if (type === 'folder') {
            await minioStorage.deleteFolder(path);
        } else {
            await minioStorage.deleteFile(path);
        }
        res.json({ success: true });
    } catch (error) {
        console.error(`${LOG_TAGS.STORAGE} Delete error:`, error);
        res.status(500).json({ error: 'Failed to delete' });
    }
});

storageRouter.get('/download', async (req, res) => {
    const path = req.query.path as string;

    if (!path) {
        res.status(400).json({ error: 'path is required' });
        return;
    }

    try {
        const stat = await minioStorage.getFileStat(path);
        if (!stat) {
            res.status(404).json({ error: 'File not found' });
            return;
        }

        const stream = await minioStorage.getFileStream(path);
        const fileName = path.split('/').pop() || 'download';

        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
        res.setHeader('Content-Type', stat.metaData?.['content-type'] || 'application/octet-stream');
        res.setHeader('Content-Length', stat.size);

        stream.pipe(res);
    } catch (error) {
        console.error(`${LOG_TAGS.STORAGE} Download error:`, error);
        res.status(500).json({ error: 'Failed to download' });
    }
});
