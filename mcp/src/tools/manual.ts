import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { WebSocketBridge } from '../bridge.js';
import type { TaskQueue } from '../queue.js';
import { AgentScope } from '../agent-scope.js';
import { sendAgentScopedBridgeMessage, targetTabIdFromParams } from '../agent-bridge.js';
import { mapFSBError } from '../errors.js';
import {
  TOOL_REGISTRY,
  jsonSchemaToZod,
  PARAM_TRANSFORMS,
  type ToolDefinition,
} from './schema-bridge.js';
import { isAllowedMcpVisualClientLabel, getAllowedMcpVisualClientLabels } from './visual-session.js';

type ToolCallResult = { content: Array<{ type: 'text'; text: string }>; isError?: boolean };

// Phase 245 D-04 / D-05: action tools return a `change_report` field describing
// what the action mutated -- URL changes, dialogs opened, nodes added/removed,
// attribute changes, focus shift -- so the agent can learn the consequence
// without a follow-up read_page. Read-only tools (get_text, get_attribute,
// read_page, get_dom_snapshot, list_tabs, etc.) do not include this field.
// Tools where the diff is reliably noise (scroll, scroll_at, hover, focus)
// also opt out per D-06. The contract is gated by the Action Change Reports
// toggle in the extension control panel (default on); when off, action tools
// revert to pre-Phase-245 response shape with zero observer overhead.
const CHANGE_REPORT_DESCRIPTION_SUFFIX =
  ' RETURNS change_report: when this tool runs, the response includes a `change_report` field with a compact diff of what the action mutated (URL, dialogs_opened, nodes_added, nodes_removed, attrs_changed, inputs_changed, focus_shift). Use this to learn the consequence without calling read_page next. If the report exceeds the size cap, `change_report.truncated:true` and `change_report_hint` are set; call read_page for the full state.';

/**
 * Phase 255 Plan 03: visual-session field-bundle validator.
 *
 * Runs at the dispatch chokepoint for every action tool (registered by
 * registerManualTools below). Read-only tools bypass this validator
 * entirely because they are registered through registerReadOnlyTools
 * (mcp/src/tools/read-only.ts), which does not import this function.
 *
 * Validation steps (matches .planning/phases/255-schema-enforcement-on-
 * action-tools/255-CONTEXT.md Validator location section, steps 3-4):
 *   1. visual_reason MUST be a non-empty string. Empty / missing -> reject
 *      with VISUAL_FIELDS_REQUIRED.
 *   2. client MUST be a non-empty string. Empty / missing -> reject with
 *      VISUAL_FIELDS_REQUIRED.
 *   3. client MUST pass isAllowedMcpVisualClientLabel(). Failed -> reject
 *      with BADGE_NOT_ALLOWED.
 *
 * On success returns null (caller proceeds to execAction). On rejection
 * returns the ToolCallResult the MCP SDK should serialize back to the
 * caller; the underlying FSB action does NOT run.
 *
 * Source-of-truth for field names and error codes: .planning/v0.9.62-
 * CONTRACT.md (Field Bundle + Typed Errors sections).
 */
function validateVisualSessionFields(
  toolName: string,
  params: Record<string, unknown>,
): ToolCallResult | null {
  const visualReason = params.visual_reason;
  const client = params.client;

  const visualReasonOk = typeof visualReason === 'string' && visualReason.trim().length > 0;
  const clientOk = typeof client === 'string' && client.trim().length > 0;

  if (!visualReasonOk || !clientOk) {
    return mapFSBError({
      success: false,
      errorCode: 'VISUAL_FIELDS_REQUIRED',
      tool: toolName,
    });
  }

  if (!isAllowedMcpVisualClientLabel(client)) {
    return mapFSBError({
      success: false,
      errorCode: 'BADGE_NOT_ALLOWED',
      tool: toolName,
      clientLabel: client,
      allowedClients: getAllowedMcpVisualClientLabels(),
    });
  }

  return null;
}

/**
 * Phase 255 Plan 03: strip the visual-session field bundle from caller
 * params before forwarding to the FSB extension. The extension protocol
 * does not yet consume these fields (lifecycle code lands in Phase 256);
 * leaving them in the payload would noise up the bridge wire.
 */
function stripVisualSessionFields(params: Record<string, unknown>): Record<string, unknown> {
  const { visual_reason: _vr, client: _cl, is_final: _if, ...rest } = params;
  return rest;
}

/**
 * Execute a single browser action through the FSB extension.
 * All manual tools funnel through this helper which checks connectivity,
 * enqueues via TaskQueue (mutation serialization), and maps the result.
 */
async function execAction(
  bridge: WebSocketBridge,
  queue: TaskQueue,
  agentScope: AgentScope,
  toolName: string,
  fsbVerb: string,
  params: Record<string, unknown>,
): Promise<ToolCallResult> {
  if (!bridge.isConnected) {
    console.error(`[FSB Manual] ${toolName}: bridge not connected`);
    return mapFSBError({ success: false, error: 'extension_not_connected' });
  }
  console.error(`[FSB Manual] ${toolName}: sending verb=${fsbVerb} params=${JSON.stringify(params).slice(0, 150)}`);
  // fill_sheet types cell-by-cell into Google Sheets and can take minutes for large datasets.
  // Default 30s is insufficient; give it 120s like the content script's own timeout.
  const LONG_TIMEOUT_TOOLS = new Set(['fill_sheet', 'read_sheet']);
  const timeout = LONG_TIMEOUT_TOOLS.has(toolName) ? 120_000 : 30_000;

  return queue.enqueue(toolName, async () => {
    try {
      const result = await sendAgentScopedBridgeMessage(
        bridge,
        agentScope,
        'mcp:execute-action',
        { tool: fsbVerb, params },
        { timeout, targetTabId: targetTabIdFromParams(params) },
      );
      if (!result?.success) {
        console.error(`[FSB Manual] ${toolName}: FAILED - ${result?.error || 'unknown error'}`);
      }
      return mapFSBError(result);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`[FSB Manual] ${toolName}: EXCEPTION - ${errMsg}`);
      return mapFSBError({ success: false, error: errMsg });
    }
  });
}

/**
 * Register all manual (non-read-only) browser action tools from the shared
 * TOOL_REGISTRY. Each tool's JSON Schema inputSchema is converted to Zod
 * on the fly via jsonSchemaToZod(), and parameter transforms are applied
 * for tools where MCP param names differ from FSB internal names.
 */
export function registerManualTools(
  server: McpServer,
  bridge: WebSocketBridge,
  queue: TaskQueue,
  agentScope: AgentScope,
): void {
  // Filter to non-read-only tools from canonical registry
  const manualTools = TOOL_REGISTRY.filter((t: ToolDefinition) => !t._readOnly);

  for (const tool of manualTools) {
    const zodShape = jsonSchemaToZod(tool.inputSchema);
    const fsbVerb = tool._contentVerb || tool._cdpVerb || tool.name;
    const transform = PARAM_TRANSFORMS[tool.name];

    // Phase 245 D-04 / D-05: append change_report contract to descriptions of
    // action tools whose _emitChangeReport flag is true (per D-05 INCLUDE list,
    // minus D-06 opt-outs scroll/scroll_at/hover/focus).
    const description = (tool._emitChangeReport === true)
      ? `${tool.description}${CHANGE_REPORT_DESCRIPTION_SUFFIX}`
      : tool.description;

    server.tool(
      tool.name,
      description,
      zodShape,
      async (params: Record<string, unknown>) => {
        // Phase 255 Plan 03: visual-session field-bundle gate runs
        // BEFORE the param transform + execAction. Rejections do not
        // proceed to queue.enqueue or sendAgentScopedBridgeMessage, so
        // no DOM mutation, no change_report, no overlay change.
        const rejection = validateVisualSessionFields(tool.name, params);
        if (rejection) return rejection;

        const cleanedParams = stripVisualSessionFields(params);
        const finalParams = transform ? transform(cleanedParams) : cleanedParams;
        return execAction(bridge, queue, agentScope, tool.name, fsbVerb, finalParams);
      },
    );
  }
}
