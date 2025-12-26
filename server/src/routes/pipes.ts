import { Router } from 'express';
import { pipeManager } from '../modules/pipe-manager';

export const pipesRouter = Router();

pipesRouter.get('/', (_req, res) => {
    const pipes = pipeManager.listPipes();
    res.json(pipes);
});

pipesRouter.get('/:id', (req, res) => {
    const pipe = pipeManager.getPipe(req.params.id);
    if (!pipe) {
        res.status(404).json({ error: 'Pipe not found' });
        return;
    }
    res.json(pipe);
});

pipesRouter.post('/', async (req, res) => {
    try {
        const pipe = await pipeManager.createPipe(req.body);
        res.status(201).json(pipe);
    } catch (error) {
        res.status(400).json({ error: (error as Error).message });
    }
});

pipesRouter.put('/:id', (req, res) => {
    const updated = pipeManager.updatePipe(req.params.id, req.body);
    if (!updated) {
        res.status(404).json({ error: 'Pipe not found' });
        return;
    }
    res.json(updated);
});

pipesRouter.delete('/:id', async (req, res) => {
    const deleted = await pipeManager.deletePipe(req.params.id);
    if (!deleted) {
        res.status(404).json({ error: 'Pipe not found' });
        return;
    }
    res.status(204).send();
});
