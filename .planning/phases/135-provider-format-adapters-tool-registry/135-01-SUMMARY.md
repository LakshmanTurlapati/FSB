---
phase: 135-provider-format-adapters-tool-registry
plan: 01
subsystem: ai
tags: [tool-registry, json-schema, browser-automation, tool-definitions]

# Dependency graph
requires: []
provides:
  - "Canonical tool registry (ai/tool-definitions.js) with 42 browser automation tool definitions"
  - "JSON Schema inputSchema for all tools, importable by both autopilot and MCP"
  - "Routing metadata (_route, _readOnly, _contentVerb, _cdpVerb) for tool execution dispatch"
  - "Helper functions: getToolByName, getReadOnlyTools, getToolsByRoute"
affects: [135-02, 136-tool-executor-mcp-migration, 137-agent-loop]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Canonical tool registry with JSON Schema and routing metadata", "CommonJS dual-context module (Chrome extension + Node.js)"]

key-files:
  created: ["ai/tool-definitions.js"]
  modified: []

key-decisions:
  - "Ported enriched descriptions from MCP manual.ts/read-only.ts including When to use and Related hints"
  - "4 new CLI-only tools added: insert_text, double_click_at, scroll_to_element, set_attribute"
  - "get_dom_snapshot has _contentVerb=null since it uses mcp:get-dom message type, not FSB.tools dispatch"
  - "set_attribute placed with interaction tools as _readOnly=false since it mutates DOM state"

patterns-established:
  - "Tool definition shape: { name, description, inputSchema, _route, _readOnly, _contentVerb, _cdpVerb }"
  - "Route categories: content (28 tools), cdp (7 tools), background (7 tools)"
  - "Read-only tools: read_page, get_text, get_attribute, get_dom_snapshot, read_sheet, list_tabs"

requirements-completed: [TOOL-01, TOOL-02]

# Metrics
duration: 8min
completed: 2026-04-01
---

# Phase 135 Plan 01: Tool Registry Summary

**Canonical tool registry with 42 browser automation tools in JSON Schema format, routing metadata, and helper functions for lookup/filtering**

## Performance

- **Duration:** 8 min
- **Started:** 2026-04-01T05:05:51Z
- **Completed:** 2026-04-01T05:13:40Z
- **Tasks:** 2
- **Files created:** 1 (811 lines)

## Accomplishments
- Created ai/tool-definitions.js as the single source of truth for all 42 browser automation tool definitions
- Every tool has JSON Schema inputSchema with correct properties and required arrays, matching MCP Zod schemas
- Routing metadata enables the tool executor (Phase 136) to dispatch tools to the correct handler (content script, CDP, or background)
- Validated registry against MCP source files (manual.ts, read-only.ts) -- all 38 MCP tools present, 4 new CLI-only tools added

## Task Commits

Each task was committed atomically:

1. **Task 1: Create ai/tool-definitions.js with all 42 tool definitions** - `c8ad5e6` (feat)
2. **Task 2: Validate tool registry against MCP and CLI sources** - no commit (validation-only, no changes needed)

## Files Created/Modified
- `ai/tool-definitions.js` - Canonical tool registry: 42 tool definitions with JSON Schema, routing metadata, and helper functions (811 lines)

## Decisions Made
- Ported enriched descriptions from MCP source files (manual.ts, read-only.ts) to preserve "When to use" and "Related" hints that help AI select the right tool
- get_dom_snapshot has _contentVerb=null because it uses the mcp:get-dom message type rather than the standard FSB.tools dispatch pattern
- set_attribute is _readOnly=false since it mutates DOM state (unlike its sibling get_attribute which is _readOnly=true)
- 4 CLI-only tools added per Research recommendation: insert_text (Excalidraw/Google Docs), double_click_at (canvas edit mode), scroll_to_element (long pages), set_attribute (form manipulation)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- ai/tool-definitions.js is ready for import by:
  - 135-02: tool-use-adapter.js (provider format translation)
  - Phase 136: tool executor and MCP migration
  - Phase 137: agent loop implementation
- All 42 tools verified: 28 content, 7 CDP, 7 background, 6 read-only
- Module exports work via require() in Node.js and will work in Chrome extension context

## Self-Check: PASSED

- ai/tool-definitions.js: FOUND
- 135-01-SUMMARY.md: FOUND
- Commit c8ad5e6: FOUND

---
*Phase: 135-provider-format-adapters-tool-registry*
*Completed: 2026-04-01*
