import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { WebSocketBridge } from '../bridge.js';
import type { TaskQueue } from '../queue.js';
import { AgentScope } from '../agent-scope.js';
import { sendAgentScopedBridgeMessage } from '../agent-bridge.js';
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
    'Start the FSB visual session BEFORE any browser work. Puts the user-visible glow/overlay on the active tab so the human can see what is being driven, and returns a session token to thread through later visual-session calls. ALWAYS call this first whenever you plan to use FSB browser tools (click, type_text, navigate, execute_js, ...) -- starting and ending a session is trivial and the visible signal is what makes FSB feel transparent to the user. Real-time progress updates via report_progress (using this token) are a bonus, not a requirement. Pair with end_visual_session. Multi-agent contract: agent_id is FSB-issued and required (the server captures it via agent:register on first tool call -- callers do not provide it). tab_id is agent-scoped: only tabs owned by the calling agent can be addressed. The concurrency cap is configurable (default 8, range 1-64); the (N+1)th agent claim is rejected with AGENT_CAP_REACHED { cap, active }. Ownership enforcement: cross-agent calls reject with TAB_NOT_OWNED; incognito tabs reject with TAB_INCOGNITO_NOT_SUPPORTED; cross-window tabs reject with TAB_OUT_OF_SCOPE. Pass tab_id only when this agent owns multiple tabs; auto-resolves otherwise.',
    {
      client: z.string().describe('Trusted MCP client label, for example Codex, ChatGPT, Claude, or Gemini. Must be on the approved allowlist.'),
      task: z.string().describe('Short task title shown in the visible automation surface.'),
      detail: z.string().optional().describe('Optional initial detail line for the overlay, such as "Preparing checkout flow".'),
      tab_id: z.number().optional().describe('Optional. Tab id the visual session attaches to. Omit when this agent owns exactly one tab; required to disambiguate when this agent owns multiple. Legacy popup/sidepanel/autopilot do not need to pass this.'),
    },
    async ({ client, task, detail, tab_id }) => {
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
        const targetTabId = typeof tab_id === 'number' ? tab_id : null;
        const payload: Record<string, unknown> = { clientLabel, task, detail };
        // Phase 246 D-10: forward optional tab_id so the extension-side
        // resolver can disambiguate when the calling agent owns multiple tabs.
        if (tab_id !== undefined) payload.tab_id = tab_id;
        const result = await sendAgentScopedBridgeMessage(
          bridge,
          agentScope,
          'mcp:start-visual-session',
          payload,
          { timeout: 10_000, targetTabId },
        );
        return mapFSBError(result);
      });
    },
  );

  server.tool(
    'end_visual_session',
    'End the FSB visual session and clear the glow/overlay. ALWAYS call this when your browser work is done -- starting and ending sessions is trivial; leaving them open is what looks bad. Provide the session_token returned by start_visual_session, plus an optional reason (\'cancelled\' or \'ended\') for analytics. The session_token identifies the tab and owning agent; no tab_id parameter is accepted. Pair with start_visual_session. Multi-agent contract: agent_id is FSB-issued and required (the server captures it via agent:register on first tool call -- callers do not provide it). The concurrency cap is configurable (default 8, range 1-64); the (N+1)th agent claim is rejected with AGENT_CAP_REACHED { cap, active }. Ownership enforcement: cross-agent calls reject with TAB_NOT_OWNED; incognito tabs reject with TAB_INCOGNITO_NOT_SUPPORTED; cross-window tabs reject with TAB_OUT_OF_SCOPE.',
    {
      session_token: z.string().describe('Session token returned by start_visual_session.'),
      reason: z.enum(['cancelled', 'ended']).optional().describe('Optional end reason for analytics/debugging.'),
    },
    async ({ session_token, reason }) => {
      if (!bridge.isConnected) {
        return mapFSBError({ success: false, error: 'extension_not_connected' });
      }

      return queue.enqueue('end_visual_session', async () => {
        const result = await sendAgentScopedBridgeMessage(
          bridge,
          agentScope,
          'mcp:end-visual-session',
          { sessionToken: session_token, reason },
          { timeout: 10_000 },
        );
        return mapFSBError(result);
      });
    },
  );
}
