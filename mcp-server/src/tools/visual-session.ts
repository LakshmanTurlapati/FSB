import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { WebSocketBridge } from '../bridge.js';
import type { TaskQueue } from '../queue.js';
import { mapFSBError } from '../errors.js';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

type VisualSessionUtils = {
  normalizeMcpVisualClientLabel: (raw: unknown) => string | null;
  getAllowedMcpVisualClientLabels: () => string[];
};

const visualSessionUtils = require(
  path.resolve(__dirname, '../../../utils/mcp-visual-session.js'),
) as VisualSessionUtils;

const {
  normalizeMcpVisualClientLabel,
  getAllowedMcpVisualClientLabels,
} = visualSessionUtils;

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
