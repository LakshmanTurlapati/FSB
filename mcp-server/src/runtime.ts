import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createServer } from './server.js';
import { WebSocketBridge } from './bridge.js';
import { TaskQueue } from './queue.js';
import { registerAutopilotTools } from './tools/autopilot.js';
import { registerManualTools } from './tools/manual.js';
import { registerReadOnlyTools } from './tools/read-only.js';
import { registerObservabilityTools } from './tools/observability.js';
import { registerAgentTools } from './tools/agents.js';
import { registerVaultTools } from './tools/vault.js';
import { registerResources } from './resources/index.js';
import { registerPrompts } from './prompts/index.js';

export type FSBRuntime = {
  server: McpServer;
  bridge: WebSocketBridge;
  queue: TaskQueue;
};

type RuntimeOptions = {
  bridge?: WebSocketBridge;
  queue?: TaskQueue;
};

export function createRuntime(options: RuntimeOptions = {}): FSBRuntime {
  const bridge = options.bridge ?? new WebSocketBridge();
  const queue = options.queue ?? new TaskQueue();
  const server = createServer();

  registerAutopilotTools(server, bridge, queue);
  registerManualTools(server, bridge, queue);
  registerReadOnlyTools(server, bridge, queue);
  registerObservabilityTools(server, bridge, queue);
  registerAgentTools(server, bridge, queue);
  registerVaultTools(server, bridge, queue);
  registerResources(server, bridge);
  registerPrompts(server);

  return { server, bridge, queue };
}
