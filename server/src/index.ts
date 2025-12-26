import express from 'express';
import cors from 'cors';
import { randomUUID } from 'node:crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

import { pipesRouter } from './routes/pipes';
import { executionRouter } from './routes/execution';
import { storageRouter, initStorage } from './routes/storage';
import { tablesRouter } from './routes/tables';
import { pipeManager } from './modules/pipe-manager';
import { icebergQuery } from './modules/iceberg-query';
import { loadConfig, getConfig, LOG_TAGS } from './config';
import type { Pipe } from './types';

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

app.use(cors());
app.use(express.json());

app.use('/api/pipes', pipesRouter);
app.use('/api/execution', executionRouter);
app.use('/api/storage', storageRouter);
app.use('/api/tables', tablesRouter);

function createMcpServer(): McpServer {
    const server = new McpServer(
        { name: 'data-chef-mcp-server', version: '1.0.0' },
        { capabilities: { logging: {}, tools: {} } }
    );

    server.tool('list_pipes', 'List all pipes', {}, async () => ({
        content: [{ type: 'text', text: JSON.stringify(pipeManager.listPipes(), null, 2) }]
    }));

    server.tool('get_pipe', 'Get pipe by ID', { pipeId: z.string() }, async ({ pipeId }) => {
        const pipe = pipeManager.getPipe(pipeId);
        return {
            content: [{ type: 'text', text: pipe ? JSON.stringify(pipe, null, 2) : `Pipe "${pipeId}" not found` }]
        };
    });

    server.tool('create_pipe', 'Create a new pipe with full configuration', {
        name: z.string().describe('Pipe name'),
        description: z.string().optional().describe('Pipe description'),
        storagePath: z.string().describe('MinIO storage folder path (e.g. /data/logs)'),
        fileExtensions: z.array(z.string()).describe('File extensions (e.g. ["json", "log"])'),
        filePrefix: z.string().optional().describe('File name prefix filter'),
        fileSuffix: z.string().optional().describe('File name suffix filter (before extension)'),
        recordType: z.enum(['delimited', 'json', 'jsonl', 'text', 'parquet']).describe('File format type'),
        delimiter: z.string().optional().describe('Field delimiter for CSV files'),
        hasHeader: z.boolean().optional().describe('CSV has header row'),
        regexPattern: z.string().optional().describe('Regex pattern for text file parsing'),
        regexFieldNames: z.array(z.string()).optional().describe('Field names for regex capture groups'),
        tableName: z.string().describe('Output Iceberg table name'),
        namespace: z.string().default('default').describe('Iceberg namespace'),
        writeMode: z.enum(['append', 'overwrite']).default('overwrite').describe('Write mode: overwrite recreates table on each run')
    }, async (args) => {
        try {
            const recordBoundary: any = {
                type: args.recordType,
                encoding: 'utf-8'
            };

            if (args.recordType === 'delimited') {
                recordBoundary.delimiter = args.delimiter || ',';
                recordBoundary.hasHeader = args.hasHeader ?? true;
            } else if (args.recordType === 'text' && args.regexPattern && args.regexFieldNames) {
                recordBoundary.fieldExtraction = {
                    method: 'regex',
                    pattern: args.regexPattern,
                    fieldNames: args.regexFieldNames
                };
            }

            const newPipe = await pipeManager.createPipe({
                name: args.name,
                description: args.description,
                storagePath: args.storagePath,
                filePattern: {
                    extensions: args.fileExtensions,
                    prefix: args.filePrefix,
                    suffix: args.fileSuffix
                },
                recordBoundary,
                schema: { inferFromData: true, columns: [] },
                partitioning: { enabled: false, keys: [] },
                output: {
                    tableName: args.tableName,
                    catalog: 'iceberg_catalog',
                    namespace: args.namespace,
                    writeMode: args.writeMode
                }
            });
            return { content: [{ type: 'text', text: `✓ Pipe created successfully:\n${JSON.stringify(newPipe, null, 2)}` }] };
        } catch (error) {
            return {
                isError: true,
                content: [{ type: 'text', text: `✗ Failed to create pipe: ${error}` }]
            };
        }
    });

    server.tool('delete_pipe', 'Delete a pipe and its storage folder', {
        pipeId: z.string().describe('Pipe ID to delete')
    }, async ({ pipeId }) => {
        try {
            const deleted = await pipeManager.deletePipe(pipeId);
            if (deleted) {
                return { content: [{ type: 'text', text: `✓ Pipe "${pipeId}" deleted successfully (folder and files removed)` }] };
            } else {
                return {
                    isError: true,
                    content: [{ type: 'text', text: `✗ Pipe "${pipeId}" not found` }]
                };
            }
        } catch (error) {
            return {
                isError: true,
                content: [{ type: 'text', text: `✗ Failed to delete pipe: ${error}` }]
            };
        }
    });

    server.tool('list_tables', 'List all Iceberg tables', {}, async () => {
        try {
            const tables = await icebergQuery.listIcebergTables();
            return {
                content: [{ type: 'text', text: JSON.stringify(tables, null, 2) }]
            };
        } catch (error) {
            return {
                isError: true,
                content: [{ type: 'text', text: `✗ Failed to list tables: ${error}` }]
            };
        }
    });

    server.tool('preview_table', 'Preview data from an Iceberg table', {
        tableName: z.string().describe('Table name to preview'),
        limit: z.number().optional().default(10).describe('Number of rows to preview (default: 10)')
    }, async ({ tableName, limit }) => {
        try {
            const preview = await icebergQuery.previewTable(tableName, limit);
            return {
                content: [{
                    type: 'text',
                    text: `Table: ${tableName}\n\nSchema:\n${preview.schema.map(col => `  ${col.name}: ${col.type}`).join('\n')}\n\nData (${preview.rowCount} rows):\n${JSON.stringify(preview.rows, null, 2)}`
                }]
            };
        } catch (error) {
            return {
                isError: true,
                content: [{ type: 'text', text: `✗ Failed to preview table: ${error}` }]
            };
        }
    });

    return server;
}

const mcpTransports: Map<string, StreamableHTTPServerTransport> = new Map();

app.post('/mcp', async (req, res) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;

    try {
        if (sessionId && mcpTransports.has(sessionId)) {
            const transport = mcpTransports.get(sessionId)!;
            await transport.handleRequest(req, res, req.body);
        } else if (!sessionId && isInitializeRequest(req.body)) {
            const transport = new StreamableHTTPServerTransport({
                sessionIdGenerator: () => randomUUID(),
                onsessioninitialized: (newSessionId: string) => {
                    console.log(`[MCP] Session: ${newSessionId}`);
                    mcpTransports.set(newSessionId, transport);
                }
            });
            transport.onclose = () => {
                const sid = transport.sessionId;
                if (sid) mcpTransports.delete(sid);
            };
            const server = createMcpServer();
            await server.connect(transport);
            await transport.handleRequest(req, res, req.body);
        } else {
            res.status(400).json({ jsonrpc: '2.0', error: { code: -32000, message: 'Invalid session' }, id: null });
        }
    } catch (error) {
        console.error('[MCP] Error:', error);
        if (!res.headersSent) {
            res.status(500).json({ jsonrpc: '2.0', error: { code: -32603, message: 'Internal error' }, id: null });
        }
    }
});

app.get('/mcp', async (req, res) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    if (!sessionId || !mcpTransports.has(sessionId)) {
        res.status(400).send('Invalid session');
        return;
    }
    await mcpTransports.get(sessionId)!.handleRequest(req, res);
});

app.delete('/mcp', async (req, res) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    if (!sessionId || !mcpTransports.has(sessionId)) {
        res.status(400).send('Invalid session');
        return;
    }
    await mcpTransports.get(sessionId)!.handleRequest(req, res);
});

app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'data-chef-server' });
});

async function startServer() {
    await loadConfig();
    const config = getConfig();
    console.log(`${LOG_TAGS.CONFIG} Python path: ${config.spark.pythonPath}`);
    console.log(`${LOG_TAGS.CONFIG} Java home: ${(config.spark as any).javaHome || 'Not set'}`);
    
    pipeManager.initDatabase();
    await initStorage();
    
    app.listen(PORT, () => {
        console.log(`${LOG_TAGS.SERVER} Data Chef Server running on http://localhost:${PORT}`);
        console.log(`${LOG_TAGS.SERVER} REST API: http://localhost:${PORT}/api`);
        console.log(`${LOG_TAGS.SERVER} MCP endpoint: http://localhost:${PORT}/mcp`);
    });
}

startServer().catch(console.error);

process.on('SIGINT', async () => {
    console.log(`${LOG_TAGS.SERVER} Shutting down...`);
    for (const [sid, transport] of mcpTransports) {
        await transport.close();
    }
    process.exit(0);
});
