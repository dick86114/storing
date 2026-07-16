#!/usr/bin/env node
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createStoringMcpServer } from './storing-server.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../../../.env'), quiet: true });

const apiBase = process.env.STORING_API_BASE || 'http://localhost:1052/api/v1';
const apiKey = process.env.STORING_MCP_API_KEY || '';

if (!apiKey) {
  console.error('Missing STORING_MCP_API_KEY');
  process.exit(1);
}

async function main() {
  const server = createStoringMcpServer({ apiBase, staticApiKey: apiKey, transport: 'stdio', clientAgent: 'Storing MCP stdio client' });
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`Storing MCP stdio server running with API base ${apiBase}`);
}

main().catch((error) => {
  console.error('Storing MCP stdio server error:', error);
  process.exit(1);
});
