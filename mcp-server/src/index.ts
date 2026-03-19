#!/usr/bin/env node

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from './server.js';
import { WebSocketBridge } from './bridge.js';
import { TaskQueue } from './queue.js';
import { registerAutopilotTools } from './tools/autopilot.js';
import { registerManualTools } from './tools/manual.js';
import { registerReadOnlyTools } from './tools/read-only.js';
import { registerResources } from './resources/index.js';
import { registerPrompts } from './prompts/index.js';

async function main(): Promise<void> {
  const server = createServer();
  const bridge = new WebSocketBridge();

  // Register all MCP tools
  const queue = new TaskQueue();
  registerAutopilotTools(server, bridge, queue);
  registerManualTools(server, bridge, queue);
  registerReadOnlyTools(server, bridge, queue);

  // Register resources and prompt templates
  registerResources(server, bridge);
  registerPrompts(server);

  // Connect MCP stdio transport (AI host <-> MCP server)
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Connect WebSocket bridge (MCP server <-> Chrome extension)
  // Wrapped in try/catch: bridge failure should not prevent MCP server from
  // starting. In disconnected mode, all tool calls return "Extension not
  // connected" errors, but the server still responds to MCP protocol messages.
  try {
    await bridge.connect();
  } catch (err: unknown) {
    console.error('[FSB MCP] WebSocket bridge failed to start (running in disconnected mode):', err);
  }

  console.error('[FSB MCP] Server started (stdio + WebSocket on port 7225)');

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
