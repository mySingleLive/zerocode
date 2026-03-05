// src/mcp/server.ts
import { createMCPServer } from './tools.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

async function main() {
  const server = createMCPServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
