#!/usr/bin/env node

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from './server.js';
import { NativeMessagingBridge } from './bridge.js';

async function main(): Promise<void> {
  const server = createServer();
  const bridge = new NativeMessagingBridge();

  // TODO: Register tools (Plan 02)
  // TODO: Register resources (Plan 03)
  // TODO: Register prompts (Plan 03)

  // Connect MCP stdio transport (AI host <-> MCP server)
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Connect Native Messaging bridge (MCP server <-> Chrome extension)
  await bridge.connect();

  console.error('[FSB MCP] Server started on stdio');

  // Graceful shutdown
  const shutdown = (): void => {
    console.error('[FSB MCP] Shutting down...');
    bridge.disconnect();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err: unknown) => {
  console.error('[FSB MCP] Fatal:', err);
  process.exit(1);
});
