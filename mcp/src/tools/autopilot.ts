import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { WebSocketBridge } from '../bridge.js';
import type { TaskQueue } from '../queue.js';
import type { MCPResponse } from '../types.js';
import { AgentScope } from '../agent-scope.js';
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
  agentScope: AgentScope,
): void {
  // run_task -- execute a natural language automation task
  server.tool(
    'run_task',
    'IMPORTANT: Only use this tool if the user explicitly requests autopilot, asks to "run a task", or says "let FSB handle it". For all other browser tasks, use the manual tools (navigate, read_page, get_dom_snapshot, click, type_text, execute_js, etc.) to accomplish the task step by step -- they are more reliable and give you full control. This tool hands control to FSB\'s built-in AI which decides the steps autonomously. Returns a completion summary with success status and action log.',
    { task: z.string().describe('Natural language description of the task to perform') },
    async ({ task }, extra) => {
      if (!bridge.isConnected) {
        return mapFSBError({ success: false, error: 'extension_not_connected' });
      }
      return queue.enqueue('run_task', async () => {
        const onProgress = (p: MCPResponse) => {
          const { progress, phase, eta, action, taskId } = p.payload as {
            taskId?: string; progress?: number; phase?: string; eta?: string; action?: string;
          };
          const message = [phase && `[${phase}]`, action, eta && `(ETA: ${eta})`]
            .filter(Boolean).join(' ');

          // Send MCP progress notification if client provided a progressToken
          if (extra._meta?.progressToken !== undefined) {
            extra.sendNotification({
              method: 'notifications/progress',
              params: {
                progressToken: extra._meta.progressToken,
                progress: progress ?? 0,
                total: 100,
                message,
              },
            }).catch(() => {});
          }

          // Always send logging message as universal fallback
          server.sendLoggingMessage({
            level: 'info',
            logger: 'fsb-autopilot',
            data: { taskId, progress, phase, eta, action },
          });
        };

        const result = await bridge.sendAndWait(
          { type: 'mcp:start-automation', payload: { task } },
          { timeout: 300_000, onProgress },
        );
        return mapFSBError(result);
      });
    },
  );

  // stop_task -- cancel the currently running automation
  server.tool(
    'stop_task',
    'Cancel the currently running automation task. Returns confirmation of cancellation. When to use: when run_task is taking too long, heading in the wrong direction, or you need to regain manual control. Related: get_task_status (check progress before deciding to stop), run_task (the task being cancelled).',
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
    'Check whether a task is currently running and its progress. Use to poll status when not receiving progress notifications. Returns percent complete, current phase, and ETA. Related: run_task (the task being monitored), stop_task (cancel if needed).',
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
