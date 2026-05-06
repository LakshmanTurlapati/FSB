import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { WebSocketBridge } from '../bridge.js';
import type { TaskQueue } from '../queue.js';
import { AgentScope } from '../agent-scope.js';
import { mapFSBError } from '../errors.js';
import {
  TOOL_REGISTRY,
  jsonSchemaToZod,
  PARAM_TRANSFORMS,
  type ToolDefinition,
} from './schema-bridge.js';

type ToolCallResult = { content: Array<{ type: 'text'; text: string }>; isError?: boolean };

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
      const agentId = await agentScope.ensure(bridge);
      const result = await bridge.sendAndWait(
        { type: 'mcp:execute-action', payload: { tool: fsbVerb, params, agentId } },
        { timeout },
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

    server.tool(
      tool.name,
      tool.description,
      zodShape,
      async (params: Record<string, unknown>) => {
        const finalParams = transform ? transform(params) : params;
        return execAction(bridge, queue, agentScope, tool.name, fsbVerb, finalParams);
      },
    );
  }
}
