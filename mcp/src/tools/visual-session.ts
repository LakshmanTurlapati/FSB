import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { WebSocketBridge } from '../bridge.js';
import type { TaskQueue } from '../queue.js';
import { AgentScope } from '../agent-scope.js';
import { mapFSBError } from '../errors.js';

// Approved visual-session client labels (must match the extension's allowlist)
const MCP_VISUAL_CLIENT_LABELS: string[] = [
  'Claude', 'Codex', 'ChatGPT', 'Perplexity', 'Windsurf',
  'Cursor', 'Antigravity', 'OpenCode', 'OpenClaw', 'OpenClaw 🦀', 'Grok', 'Gemini',
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
  agentScope: AgentScope,
): void {
  server.tool(
    'start_visual_session',
    'Start the FSB visual session BEFORE any browser work. Puts the user-visible glow/overlay on the active tab so the human can see what is being driven, and returns a session token to thread through later visual-session calls. ALWAYS call this first whenever you plan to use FSB browser tools (click, type_text, navigate, execute_js, ...) -- starting and ending a session is trivial and the visible signal is what makes FSB feel transparent to the user. Real-time progress updates via report_progress (using this token) are a bonus, not a requirement. Pair with end_visual_session.',
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
        const agentId = await agentScope.ensure(bridge);
        // Phase 240: thread ownershipToken alongside agentId so the dispatch
        // gate (extension-side) can verify the 3-tuple (D-04, D-06, D-07).
        const ownershipToken = (typeof agentScope.currentOwnershipToken === 'function')
          ? agentScope.currentOwnershipToken()
          : null;
        const payload: Record<string, unknown> = { clientLabel, task, detail, agentId };
        if (ownershipToken) payload.ownershipToken = ownershipToken;
        const result = await bridge.sendAndWait(
          { type: 'mcp:start-visual-session', payload },
          { timeout: 10_000 },
        );
        if (result
            && typeof (result as { ownershipToken?: unknown }).ownershipToken === 'string'
            && typeof agentScope.captureOwnershipToken === 'function') {
          agentScope.captureOwnershipToken(
            typeof (result as { tabId?: unknown }).tabId === 'number' ? (result as { tabId: number }).tabId : null,
            (result as { ownershipToken: string }).ownershipToken,
          );
        }
        return mapFSBError(result);
      });
    },
  );

  server.tool(
    'end_visual_session',
    'End the FSB visual session and clear the glow/overlay. ALWAYS call this when your browser work is done -- starting and ending sessions is trivial; leaving them open is what looks bad. Provide the session_token returned by start_visual_session, plus an optional reason (\'cancelled\' or \'ended\') for analytics. Pair with start_visual_session.',
    {
      session_token: z.string().describe('Session token returned by start_visual_session.'),
      reason: z.enum(['cancelled', 'ended']).optional().describe('Optional end reason for analytics/debugging.'),
    },
    async ({ session_token, reason }) => {
      if (!bridge.isConnected) {
        return mapFSBError({ success: false, error: 'extension_not_connected' });
      }

      return queue.enqueue('end_visual_session', async () => {
        const agentId = await agentScope.ensure(bridge);
        const ownershipToken = (typeof agentScope.currentOwnershipToken === 'function')
          ? agentScope.currentOwnershipToken()
          : null;
        const payload: Record<string, unknown> = { sessionToken: session_token, reason, agentId };
        if (ownershipToken) payload.ownershipToken = ownershipToken;
        const result = await bridge.sendAndWait(
          { type: 'mcp:end-visual-session', payload },
          { timeout: 10_000 },
        );
        return mapFSBError(result);
      });
    },
  );
}
