import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { WebSocketBridge } from '../bridge.js';
import type { TaskQueue } from '../queue.js';
import { mapFSBError } from '../errors.js';

/**
 * Register autopilot tools: run_task, stop_task, get_task_status.
 * These let an AI agent delegate to FSB's built-in AI loop for
 * natural-language browser automation.
 */
export function registerAutopilotTools(
  server: McpServer,
  bridge: WebSocketBridge,
  queue: TaskQueue,
): void {
  // run_task -- execute a natural language automation task
  server.tool(
    'run_task',
    'Execute a browser automation task using FSB\'s AI. Describe what you want done in natural language and FSB\'s AI decides the steps. Returns a completion summary with success status and action log.',
    { task: z.string().describe('Natural language description of the task to perform') },
    async ({ task }) => {
      if (!bridge.isConnected) {
        return mapFSBError({ success: false, error: 'extension_not_connected' });
      }
      return queue.enqueue('run_task', async () => {
        const result = await bridge.sendAndWait(
          { type: 'mcp:start-automation', payload: { task } },
          { timeout: 300_000 },
        );
        return mapFSBError(result);
      });
    },
  );

  // stop_task -- cancel the currently running automation
  server.tool(
    'stop_task',
    'Cancel the currently running automation task. Use when a task is taking too long or heading in the wrong direction. Returns confirmation of cancellation.',
    {},
    async () => {
      if (!bridge.isConnected) {
        return mapFSBError({ success: false, error: 'extension_not_connected' });
      }
      const result = await bridge.sendAndWait(
        { type: 'mcp:stop-automation', payload: {} },
        { timeout: 10_000 },
      );
      return mapFSBError(result);
    },
  );

  // get_task_status -- check running task progress (read-only, bypasses queue)
  server.tool(
    'get_task_status',
    'Check whether a task is currently running and its progress. Use to poll status when not receiving progress notifications. Returns percent complete, current phase, and ETA.',
    {},
    async () => {
      if (!bridge.isConnected) {
        return mapFSBError({ success: false, error: 'extension_not_connected' });
      }
      return queue.enqueue('get_task_status', async () => {
        const result = await bridge.sendAndWait(
          { type: 'mcp:get-status', payload: {} },
          { timeout: 5_000 },
        );
        return mapFSBError(result);
      });
    },
  );
}
