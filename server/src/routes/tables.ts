import { Router } from 'express';
import { icebergQuery } from '../modules/iceberg-query';
import { LOG_TAGS } from '../config';

export const tablesRouter = Router();

tablesRouter.get('/', async (_req, res) => {
    try {
        const tables = await icebergQuery.listIcebergTables();
        res.json({ tables });
    } catch (error) {
        console.error(`${LOG_TAGS.TABLES} List error:`, error);
        res.status(500).json({ error: 'Failed to list tables' });
    }
});

tablesRouter.get('/:name', async (req, res) => {
    const tableName = req.params.name;
    const limit = parseInt(req.query.limit as string) || 10;

    try {
        const preview = await icebergQuery.previewTable(tableName, limit);
        res.json(preview);
    } catch (error) {
        console.error(`${LOG_TAGS.TABLES} Preview error:`, error);
        res.status(500).json({ error: 'Failed to preview table' });
    }
});
