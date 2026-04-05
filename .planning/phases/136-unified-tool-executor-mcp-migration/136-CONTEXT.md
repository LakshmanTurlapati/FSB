# Phase 136: Unified Tool Executor & MCP Migration - Context

**Gathered:** 2026-04-01
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure phase -- smart discuss skipped)

<domain>
## Phase Boundary

Autopilot and MCP execute tools through the same code path, so a tool call produces identical results regardless of whether it came from the agent loop or an MCP client. Creates tool-executor.js as the single dispatch function and migrates MCP server to import from shared tool-definitions.js registry.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion -- pure infrastructure phase. Use ROADMAP phase goal, success criteria, and codebase conventions to guide decisions.

Key constraints from prior phases:
- D-07 (Phase 135): tool-use-adapter.js is separate from UniversalProvider
- D-11 (Phase 135): tool-definitions.js is the canonical source of truth
- D-13 (Phase 135): MCP server migrates to import from shared registry in this phase
- Tool routing metadata (_route, _readOnly, _contentVerb, _cdpVerb) already defined in tool-definitions.js

</decisions>

<canonical_refs>
## Canonical References

### Source of truth
- `ai/tool-definitions.js` -- Canonical tool registry (42 tools, created in Phase 135)
- `ai/tool-use-adapter.js` -- Provider format adapter (6 exports, created in Phase 135)

### Existing execution paths to unify
- `mcp-server/src/tools/manual.ts` -- MCP tool definitions with inline Zod schemas (to be replaced)
- `mcp-server/src/tools/read-only.ts` -- Read-only MCP tools with queue bypass
- `mcp-server/src/queue.ts` -- TaskQueue with readOnlyTools Set
- `background.js` lines 10892-10955 -- Autopilot action routing (content/CDP/background/data)

### Research
- `.planning/research/ARCHITECTURE.md` -- Integration architecture, shared execution path analysis
- `.planning/phases/135-provider-format-adapters-tool-registry/135-CONTEXT.md` -- Phase 135 decisions

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- mcp-server/src/queue.ts TaskQueue with readOnlyTools bypass -- pattern to replicate
- background.js action routing switch cases -- logic to extract into tool-executor.js
- content/messaging.js executeAction handler -- convergence point for both paths

### Established Patterns
- chrome.tabs.sendMessage for content script tools
- chrome.debugger for CDP tools
- Direct background.js handling for multi-tab and data tools

### Integration Points
- tool-executor.js will be imported by: background.js (autopilot), MCP server (bridge)
- MCP server manual.ts will import tool schemas from tool-definitions.js instead of inline Zod

</code_context>

<specifics>
## Specific Ideas

No specific requirements -- infrastructure phase. Refer to ROADMAP phase description and success criteria.

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope.

</deferred>

---

*Phase: 136-unified-tool-executor-mcp-migration*
*Context gathered: 2026-04-01*
