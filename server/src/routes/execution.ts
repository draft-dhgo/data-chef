import { Router } from 'express';
import { sparkRunner } from '../modules/spark-runner';
import { pipeManager } from '../modules/pipe-manager';
import type { ExecutionLog } from '../types';

export const executionRouter = Router();

executionRouter.post('/', async (req, res) => {
    const { pipeId, sourcePath } = req.body;

    if (!pipeId) {
        res.status(400).json({ error: 'pipeId is required' });
        return;
    }

    const pipe = pipeManager.getPipe(pipeId);
    if (!pipe) {
        res.status(404).json({ error: 'Pipe not found' });
        return;
    }

    const pathToUse = sourcePath || pipe.storagePath;

    const logs: ExecutionLog[] = [];
    const onLog = (log: ExecutionLog): void => {
        logs.push(log);
    };

    try {
        const result = await sparkRunner.executePipe(pipeId, pathToUse, onLog);
        res.json({ ...result, logs });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: (error as Error).message,
            logs
        });
    }
});

executionRouter.get('/status', (_req, res) => {
    res.json(sparkRunner.getSparkStatus());
});

executionRouter.delete('/', (_req, res) => {
    const cancelled = sparkRunner.cancelSparkJob();
    res.json({ cancelled });
});
