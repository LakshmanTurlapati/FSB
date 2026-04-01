/**
 * Schema Bridge: CJS tool-definitions.js -> ESM MCP server
 *
 * Bridges the CommonJS tool-definitions.js (shared registry) into the ESM
 * MCP server using createRequire(). Provides:
 *
 * 1. Typed re-exports of TOOL_REGISTRY and helpers
 * 2. jsonSchemaToZod() converter for server.tool() registration
 * 3. PARAM_TRANSFORMS map for MCP-to-FSB parameter name mappings
 *
 * @module schema-bridge
 */

import { createRequire } from 'module';
import path from 'path';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Load CJS module via createRequire
// ---------------------------------------------------------------------------

const require = createRequire(import.meta.url);
// Navigate from mcp-server/src/tools/ up to project root, then into ai/
const toolDefs = require(path.resolve(import.meta.dirname, '../../../ai/tool-definitions.js'));

// ---------------------------------------------------------------------------
// TypeScript interfaces
// ---------------------------------------------------------------------------

export interface ToolPropertySchema {
  type: string;
  description?: string;
  enum?: string[];
  default?: unknown;
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, ToolPropertySchema>;
    required: string[];
  };
  _route: 'content' | 'cdp' | 'background';
  _readOnly: boolean;
  _contentVerb: string | null;
  _cdpVerb: string | null;
}

// ---------------------------------------------------------------------------
// Typed re-exports from tool-definitions.js
// ---------------------------------------------------------------------------

export const TOOL_REGISTRY: ToolDefinition[] = toolDefs.TOOL_REGISTRY;
export const getToolByName: (name: string) => ToolDefinition | null = toolDefs.getToolByName;
export const getReadOnlyTools: () => ToolDefinition[] = toolDefs.getReadOnlyTools;
export const getToolsByRoute: (route: string) => ToolDefinition[] = toolDefs.getToolsByRoute;

// ---------------------------------------------------------------------------
// JSON Schema -> Zod converter
// ---------------------------------------------------------------------------

/**
 * Convert a JSON Schema inputSchema object into the Zod shape record
 * that McpServer.tool() expects as its third argument.
 *
 * Handles: string, number, integer, boolean, string enums, defaults, optionals.
 */
export function jsonSchemaToZod(
  inputSchema: ToolDefinition['inputSchema'],
): Record<string, z.ZodTypeAny> {
  const shape: Record<string, z.ZodTypeAny> = {};
  const required = new Set(inputSchema.required || []);

  for (const [key, prop] of Object.entries(inputSchema.properties)) {
    let zodType: z.ZodTypeAny;

    switch (prop.type) {
      case 'string':
        zodType = prop.enum
          ? z.enum(prop.enum as [string, ...string[]])
          : z.string();
        break;
      case 'number':
      case 'integer':
        zodType = z.number();
        break;
      case 'boolean':
        zodType = z.boolean();
        break;
      default:
        zodType = z.any();
    }

    if (prop.description) {
      zodType = zodType.describe(prop.description);
    }

    if (prop.default !== undefined) {
      zodType = zodType.default(prop.default);
    }

    if (!required.has(key)) {
      zodType = zodType.optional();
    }

    shape[key] = zodType;
  }

  return shape;
}

// ---------------------------------------------------------------------------
// Parameter transforms (MCP param names -> FSB internal param names)
// ---------------------------------------------------------------------------

/**
 * Transforms for tools where MCP parameter names differ from FSB internal names.
 *
 * press_key: MCP {key, ctrl, shift, alt} -> FSB {key, ctrlKey, shiftKey, altKey, useDebuggerAPI}
 * drag_drop: MCP {sourceSelector, targetSelector} -> FSB {sourceRef, targetRef}
 * click_at: MCP {shift, ctrl, alt} -> FSB {shiftKey, ctrlKey, altKey}
 * drag: MCP {shift, ctrl, alt} -> FSB {shiftKey, ctrlKey, altKey}
 */
export const PARAM_TRANSFORMS: Record<
  string,
  (params: Record<string, unknown>) => Record<string, unknown>
> = {
  press_key: (p) => ({
    key: p.key,
    ctrlKey: p.ctrl ?? false,
    shiftKey: p.shift ?? false,
    altKey: p.alt ?? false,
    useDebuggerAPI: true,
  }),
  drag_drop: (p) => ({
    sourceRef: p.sourceSelector,
    targetRef: p.targetSelector,
    steps: p.steps,
    holdMs: p.holdMs,
    stepDelayMs: p.stepDelayMs,
  }),
  click_at: (p) => ({
    x: p.x,
    y: p.y,
    shiftKey: p.shift ?? false,
    ctrlKey: p.ctrl ?? false,
    altKey: p.alt ?? false,
  }),
  drag: (p) => ({
    startX: p.startX,
    startY: p.startY,
    endX: p.endX,
    endY: p.endY,
    steps: p.steps,
    stepDelayMs: p.stepDelayMs,
    shiftKey: p.shift ?? false,
    ctrlKey: p.ctrl ?? false,
    altKey: p.alt ?? false,
  }),
};
