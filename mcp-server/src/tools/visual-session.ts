import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { WebSocketBridge } from '../bridge.js';
import type { TaskQueue } from '../queue.js';
import { mapFSBError } from '../errors.js';

// Approved visual-session client labels (must match the extension's allowlist)
const MCP_VISUAL_CLIENT_LABELS: string[] = [
  'Claude', 'Codex', 'ChatGPT', 'Perplexity', 'Windsurf',
  'Cursor', 'Antigravity', 'OpenCode', 'OpenClaw', 'Grok', 'Gemini',
];

const CLIENT_LABEL_MAP: Record<string, string> = Object.create(null);
for (const label of MCP_VISUAL_CLIENT_LABELS) {
  CLIENT_LABEL_MAP[label.toLowerCase().replace(/[\s_-]+/g, '')] = label;
}

function normalizeMcpVisualClientLabel(raw: unknown): string | null {
  const key = String(raw ?? '').trim().toLowerCase().replace(/[\s_-]+/g, '');
  return key ? (CLIENT_LABEL_MAP[key] ?? null) : null;
}

function getAllowedMcpVisualClientLabels(): string[] {
  return MCP_VISUAL_CLIENT_LABELS.slice();
}

export function registerVisualSessionTools(
  server: McpServer,
  bridge: WebSocketBridge,
  queue: TaskQueue,
): void {
  server.tool(
    'start_visual_session',
    'Start the visible FSB automation surface on the active normal webpage without invoking run_task. Use this when an external MCP client wants the FSB glow/overlay to appear while it drives the browser step by step. Returns a session token that follow-up visual-session calls must use.',
    {
      client: z.string().describe('Trusted MCP client label, for example Codex, ChatGPT, Claude, or Gemini. Must be on the approved allowlist.'),
      task: z.string().describe('Short task title shown in the visible automation surface.'),
      detail: z.string().optional().describe('Optional initial detail line for the overlay, such as "Preparing checkout flow".'),
    },
    async ({ client, task, detail }) => {
      const clientLabel = normalizeMcpVisualClientLabel(client);
      if (!clientLabel) {
        return mapFSBError({
          success: false,
          errorCode: 'invalid_client_label',
          clientLabel: client,
          allowedClients: getAllowedMcpVisualClientLabels(),
        });
      }

      if (!bridge.isConnected) {
        return mapFSBError({ success: false, error: 'extension_not_connected' });
      }

      return queue.enqueue('start_visual_session', async () => {
        const result = await bridge.sendAndWait(
          {
            type: 'mcp:start-visual-session',
            payload: { clientLabel, task, detail },
          },
          { timeout: 10_000 },
        );
        return mapFSBError(result);
      });
    },
  );

  server.tool(
    'end_visual_session',
    'End a client-owned visual session previously created by start_visual_session. Use the returned session token to clear the glow/overlay without invoking run_task completion.',
    {
      session_token: z.string().describe('Session token returned by start_visual_session.'),
      reason: z.enum(['cancelled', 'ended']).optional().describe('Optional end reason for analytics/debugging.'),
    },
    async ({ session_token, reason }) => {
      if (!bridge.isConnected) {
        return mapFSBError({ success: false, error: 'extension_not_connected' });
      }

      return queue.enqueue('end_visual_session', async () => {
        const result = await bridge.sendAndWait(
          {
            type: 'mcp:end-visual-session',
            payload: { sessionToken: session_token, reason },
          },
          { timeout: 10_000 },
        );
        return mapFSBError(result);
      });
    },
  );
}
