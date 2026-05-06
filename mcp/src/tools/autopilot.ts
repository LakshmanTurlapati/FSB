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
        // Phase 239 plan 02 -- onProgress now re-shapes Phase 239 heartbeat
        // ticks (D-01 9-field payload arriving from mcp-bridge-client.js's
        // 30s setInterval) into the MCP `notifications/progress` envelope
        // with rich fields under `params._meta` (D-02 wire shape; the MCP
        // spec 2025-03-26 _meta vendor-extension slot). Non-heartbeat
        // progress (existing dashboard progress from automationProgress
        // events) keeps the legacy shape -- params._meta is only present
        // when the extension sent at least one D-01 field. See
        // .planning/phases/239-mcp-run-task-return-on-completion-phase-236-reborn/239-CONTEXT.md
        // (D-01, D-02) for the locked payload + wire shapes.
        const onProgress = (p: MCPResponse) => {
          // Existing fields (preserve every existing field -- D-07 additive-only)
          const { progress, phase, eta, action, taskId } = p.payload as {
            taskId?: string; progress?: number; phase?: string; eta?: string; action?: string;
          };

          // Phase 239 plan 02 -- D-01 rich heartbeat fields (when extension sends a heartbeat tick)
          const { alive, step, elapsed_ms, current_url, ai_cycles, last_action } = p.payload as {
            alive?: boolean; step?: number; elapsed_ms?: number;
            current_url?: string | null; ai_cycles?: number; last_action?: string | null;
          };

          const message = [phase && `[${phase}]`, action, eta && `(ETA: ${eta})`]
            .filter(Boolean).join(' ');

          // Send MCP progress notification if client provided a progressToken
          if (extra._meta?.progressToken !== undefined) {
            // Build params._meta only when at least one heartbeat field is
            // present; non-heartbeat progress messages (existing dashboard
            // progress) keep the current shape unchanged so D-07 holds.
            const hasHeartbeatFields = alive !== undefined || step !== undefined ||
                                        elapsed_ms !== undefined || current_url !== undefined ||
                                        ai_cycles !== undefined || last_action !== undefined;

            // Build params with required progressToken/progress/total/message
            // and conditionally attach the D-02 _meta block when the extension
            // sent at least one heartbeat field. ProgressToken type is
            // string | number (MCP spec); narrow via the extra._meta shape.
            const baseParams = {
              progressToken: extra._meta.progressToken as string | number,
              progress: progress ?? 0,
              total: 100,
              message,
            };

            if (hasHeartbeatFields) {
              // D-02 wire shape: rich fields under params._meta vendor-extension slot
              extra.sendNotification({
                method: 'notifications/progress',
                params: {
                  ...baseParams,
                  _meta: {
                    alive: alive ?? false,
                    step,
                    elapsed_ms,
                    current_url,
                    ai_cycles,
                    last_action,
                  },
                },
              }).catch(() => {});
            } else {
              extra.sendNotification({
                method: 'notifications/progress',
                params: baseParams,
              }).catch(() => {});
            }
          }

          // Always send logging message as universal fallback. Logging now
          // includes the D-01 fields too so server logs carry the same
          // observability surface as the MCP host.
          server.sendLoggingMessage({
            level: 'info',
            logger: 'fsb-autopilot',
            data: { taskId, progress, phase, eta, action, alive, step, elapsed_ms, current_url, ai_cycles, last_action },
          });
        };

        const agentId = await agentScope.ensure(bridge);
        const result = await bridge.sendAndWait(
          { type: 'mcp:start-automation', payload: { task, agentId } },
          { timeout: 600_000, onProgress },   // Phase 239 plan 03 -- 600s safety net (was 300_000); CONTEXT.md D-04 + ROADMAP SC#1
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
      const agentId = await agentScope.ensure(bridge);
      const result = await bridge.sendAndWait(
        { type: 'mcp:stop-automation', payload: { agentId } },
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
        const agentId = await agentScope.ensure(bridge);
        const result = await bridge.sendAndWait(
          { type: 'mcp:get-status', payload: { agentId } },
          { timeout: 5_000 },
        );
        return mapFSBError(result);
      });
    },
  );
}
