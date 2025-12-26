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

    // @ts-ignore - MCP SDK type inference issue
    server.tool('list_pipes', 'List all pipes', {}, async () => ({
        content: [{ type: 'text', text: JSON.stringify(pipeManager.listPipes(), null, 2) }]
    }));

    // @ts-ignore - MCP SDK type inference issue
    server.tool('get_pipe', 'Get pipe by ID', { pipeId: z.string() }, async ({ pipeId }) => {
        const pipe = pipeManager.getPipe(pipeId);
        return {
            content: [{ type: 'text', text: pipe ? JSON.stringify(pipe, null, 2) : `Pipe "${pipeId}" not found` }]
        };
    });

    // @ts-ignore - MCP SDK type inference issue
    server.tool('create_pipe', 'Create a new pipe with JSON configuration', {
        config: z.string().describe(`JSON configuration for the pipe.

Required fields:
- name: string (pipe name)
- storagePath: string (MinIO folder path, e.g. "/data/logs")
- fileExtension: string (e.g. "csv", "json", "log", "parquet")
- recordType: "delimited" | "json" | "jsonl" | "text" | "parquet"
- tableName: string (output Iceberg table name)

Optional fields:
- description: string
- delimiter: string (for delimited type, default ",")
- hasHeader: boolean (for delimited type, default true)
- namespace: string (Iceberg namespace, default "default")
- writeMode: "append" | "overwrite" (default "overwrite")
- regexFields: array of {name, pattern, group} (for text type with regex extraction)

Examples:

CSV file:
{"name":"csv-pipe","storagePath":"/data/sales","fileExtension":"csv","recordType":"delimited","tableName":"sales_data","delimiter":",","hasHeader":true}

JSON file:
{"name":"json-pipe","storagePath":"/data/events","fileExtension":"json","recordType":"json","tableName":"events"}

Log file with regex:
{"name":"log-pipe","storagePath":"/data/logs","fileExtension":"log","recordType":"text","tableName":"app_logs","regexFields":[{"name":"timestamp","pattern":"^(\\\\d{4}-\\\\d{2}-\\\\d{2} \\\\d{2}:\\\\d{2}:\\\\d{2})","group":1},{"name":"level","pattern":"\\\\[(\\\\w+)\\\\]","group":1}]}`)
    },
        // @ts-ignore - MCP SDK type inference issue
        async (args: { config: string }) => {
            try {
                const parsed = JSON.parse(args.config);

                const recordBoundary: any = {
                    type: parsed.recordType,
                    encoding: 'utf-8'
                };

                if (parsed.recordType === 'delimited') {
                    recordBoundary.delimiter = parsed.delimiter || ',';
                    recordBoundary.hasHeader = parsed.hasHeader ?? true;
                } else if (parsed.recordType === 'text' && parsed.regexFields && parsed.regexFields.length > 0) {
                    recordBoundary.fieldExtraction = {
                        method: 'regex',
                        fields: parsed.regexFields
                    };
                }

                const newPipe = await pipeManager.createPipe({
                    name: parsed.name,
                    description: parsed.description,
                    storagePath: parsed.storagePath,
                    filePattern: {
                        extension: parsed.fileExtension
                    },
                    recordBoundary,
                    schema: { inferFromData: true, columns: [] },
                    partitioning: { enabled: false, keys: [] },
                    output: {
                        tableName: parsed.tableName,
                        catalog: 'iceberg_catalog',
                        namespace: parsed.namespace || 'default',
                        writeMode: parsed.writeMode || 'overwrite'
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

    // @ts-ignore - MCP SDK type inference issue
    server.tool('delete_pipe', 'Delete a pipe and its MinIO storage folder', {
        pipeId: z.string().describe('Pipe ID to delete. Use list_pipes to get available pipe IDs.')
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

    // @ts-ignore - MCP SDK type inference issue
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

    // @ts-ignore - MCP SDK type inference issue
    server.tool('show_table_data', 'Show sample data from an Iceberg table. Use this to preview table contents, not for complex queries.', {
        tableName: z.string().describe('Iceberg table name (without namespace). Use list_tables to get available tables.'),
        limit: z.number().optional().default(10).describe('Number of rows to show (1-1000, default: 10)')
    }, async (args: { tableName: string; limit: number }) => {
        const { tableName, limit } = args;
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

    // @ts-ignore - MCP SDK type inference issue
    server.tool('query_table', 'Execute arbitrary SQL query on Iceberg tables. Supports SELECT, aggregations, JOINs, etc.', {
        sql: z.string().describe(`SQL query to execute. Table format: iceberg_catalog.default.<table_name>

Examples:
- SELECT * FROM iceberg_catalog.default.logs WHERE level = 'ERROR'
- SELECT COUNT(*) FROM iceberg_catalog.default.sales GROUP BY category
- SELECT a.*, b.name FROM iceberg_catalog.default.orders a JOIN iceberg_catalog.default.customers b ON a.customer_id = b.id`),
        limit: z.number().optional().default(100).describe('Maximum rows to return (1-10000, default: 100)')
    }, async (args: { sql: string; limit: number }) => {
        const { sql, limit } = args;
        try {
            const result = await icebergQuery.executeQuery(sql, limit);
            return {
                content: [{
                    type: 'text',
                    text: `Query: ${result.query}\n\nSchema:\n${result.schema.map(col => `  ${col.name}: ${col.type}`).join('\n')}\n\nResults (${result.rowCount} rows):\n${JSON.stringify(result.rows, null, 2)}`
                }]
            };
        } catch (error) {
            return {
                isError: true,
                content: [{ type: 'text', text: `✗ Failed to execute query: ${error}` }]
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
