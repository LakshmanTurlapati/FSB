import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { WebSocketBridge } from '../bridge.js';
import type { TaskQueue } from '../queue.js';
import type { MCPMessageType } from '../types.js';
import { AgentScope } from '../agent-scope.js';
import { mapFSBError } from '../errors.js';
import { TOOL_REGISTRY, jsonSchemaToZod } from './schema-bridge.js';

// ---------------------------------------------------------------------------
// Bridge message type mapping
// ---------------------------------------------------------------------------

type BridgeMessage = { type: MCPMessageType; payload: Record<string, unknown> };

/**
 * Read-only tools use DIFFERENT bridge message types, not the standard
 * 'mcp:execute-action'. This map converts tool name + params into the
 * correct {type, payload} for bridge.sendAndWait().
 */
const MESSAGE_TYPE_MAP: Record<
  string,
  (params: Record<string, unknown>) => BridgeMessage
> = {
  read_page: (p) => ({
    type: 'mcp:read-page',
    payload: { full: p.full },
  }),
  get_text: (p) => ({
    type: 'mcp:execute-action',
    payload: { tool: 'getText', params: { selector: p.selector } },
  }),
  get_attribute: (p) => ({
    type: 'mcp:execute-action',
    payload: { tool: 'getAttribute', params: { selector: p.selector, attribute: p.attribute } },
  }),
  get_dom_snapshot: (p) => ({
    type: 'mcp:get-dom',
    payload: { maxElements: p.maxElements },
  }),
  list_tabs: () => ({
    type: 'mcp:get-tabs',
    payload: {},
  }),
  read_sheet: (p) => ({
    type: 'mcp:execute-action',
    payload: { tool: 'readsheet', params: { range: p.range } },
  }),
  get_page_snapshot: () => ({
    type: 'mcp:get-page-snapshot',
    payload: {},
  }),
  get_site_guide: (p) => ({
    type: 'mcp:get-site-guides',
    payload: {
      ...(p.domain ? { domain: p.domain, url: p.domain } : {}),
    },
  }),
};

// ---------------------------------------------------------------------------
// Per-tool timeout overrides (all others default to 30s)
// ---------------------------------------------------------------------------

const TIMEOUT_OVERRIDES: Record<string, number> = {
  read_page: 45_000,
  list_tabs: 5_000,
  get_page_snapshot: 45_000,
  get_site_guide: 15_000,
};

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

/**
 * Register read-only information tools from the shared TOOL_REGISTRY.
 * These bypass the TaskQueue mutation serialization (their names are in
 * the readOnlyTools set) so they can execute even while a mutation tool
 * is running.
 *
 * Each tool's JSON Schema inputSchema is converted to Zod on the fly.
 * Bridge message types are resolved via MESSAGE_TYPE_MAP.
 */
export function registerReadOnlyTools(
  server: McpServer,
  bridge: WebSocketBridge,
  queue: TaskQueue,
  agentScope: AgentScope,
): void {
  // Phase 238 D-06: scope discipline — read-only is signature-parity only;
  // no agent identity injection here per CONTEXT.md.
  void agentScope;
  const readOnlyTools = TOOL_REGISTRY.filter(t => t._readOnly);

  for (const tool of readOnlyTools) {
    const zodShape = jsonSchemaToZod(tool.inputSchema);
    const messageBuilder = MESSAGE_TYPE_MAP[tool.name];

    if (!messageBuilder) {
      continue;
    }

    const timeout = TIMEOUT_OVERRIDES[tool.name] ?? 30_000;

    server.tool(
      tool.name,
      tool.description,
      zodShape,
      async (params: Record<string, unknown>) => {
        if (!bridge.isConnected) {
          return mapFSBError({ success: false, error: 'extension_not_connected' });
        }
        return queue.enqueue(tool.name, async () => {
          const msg = messageBuilder(params);
          const result = await bridge.sendAndWait(msg, { timeout });
          return mapFSBError(result);
        });
      },
    );
  }
}
