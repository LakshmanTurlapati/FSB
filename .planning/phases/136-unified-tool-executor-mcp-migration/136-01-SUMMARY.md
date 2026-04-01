---
phase: 136-unified-tool-executor-mcp-migration
plan: 01
subsystem: ai
tags: [tool-executor, dispatch, routing, mcp, chrome-extension]

# Dependency graph
requires:
  - phase: 135-provider-format-adapters-tool-registry
    provides: TOOL_REGISTRY with _route/_readOnly/_contentVerb/_cdpVerb metadata
provides:
  - executeTool(name, params, tabId, options) unified dispatch function
  - isReadOnly(name) mutation queue bypass detection
  - Structured result format {success, hadEffect, error, navigationTriggered, result}
affects: [137-agent-loop, mcp-server, background-refactor]

# Tech tracking
tech-stack:
  added: []
  patterns: [route-based-dispatch, callback-injection-for-cdp, structured-result-normalization]

key-files:
  created: [ai/tool-executor.js]
  modified: []

key-decisions:
  - "Routing layer only -- CDP and data handlers injected via callbacks, no logic duplication"
  - "BF cache detection on content tool failures returns navigationTriggered=true"
  - "get_dom_snapshot special-cased with mcp:get-dom message type since it has no _contentVerb"

patterns-established:
  - "makeResult factory: all tool results normalized to 5-field structured object"
  - "options.cdpHandler/options.dataHandler: callback injection for complex handlers that live in background.js"

requirements-completed: [EXEC-01, EXEC-02, EXEC-03]

# Metrics
duration: 3min
completed: 2026-04-01
---

# Phase 136 Plan 01: Unified Tool Executor Summary

**Route-based dispatch for all 42 browser tools via executeTool() with structured result normalization and callback-injected CDP/data handlers**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-01T08:55:23Z
- **Completed:** 2026-04-01T08:58:02Z
- **Tasks:** 2
- **Files created:** 1

## Accomplishments
- Created ai/tool-executor.js as the single dispatch point for all 42 FSB browser tools
- Routes 28 content tools via chrome.tabs.sendMessage, 7 CDP tools via callback, 7 background tools via chrome.tabs APIs
- All code paths return structured {success, hadEffect, error, navigationTriggered, result} -- no raw strings or undefined fields
- Validation confirmed 100% routing coverage: 42/42 tools routable, 6 read-only matched, 36 mutating matched

## Task Commits

Each task was committed atomically:

1. **Task 1: Create ai/tool-executor.js with executeTool dispatch** - `2697d4b` (feat)
2. **Task 2: Validate executor routing against tool registry** - no file changes (validation-only, all 42 tools passed)

## Files Created/Modified
- `ai/tool-executor.js` - Unified tool executor: executeTool() route dispatch + isReadOnly() + makeResult() factory (375 lines)

## Decisions Made
- Used callback injection (options.cdpHandler, options.dataHandler) rather than duplicating executeCDPToolDirect or handleBackgroundAction logic -- keeps the executor as a pure routing layer
- BF cache errors on content tools optimistically return success=true with navigationTriggered=true since the most common cause is a click that triggered page navigation
- Background navigation tools (navigate, go_back, go_forward, refresh, open_tab, switch_tab, list_tabs) implemented directly in executor since they are simple chrome.tabs one-liners
- get_dom_snapshot handled as special case with 'mcp:get-dom' message type since it has no _contentVerb in the registry

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Copied tool-definitions.js from main repo to worktree**
- **Found during:** Task 1 (file creation)
- **Issue:** tool-definitions.js did not exist in the worktree (created by parallel Phase 135 agent)
- **Fix:** Copied from main repo to enable require() import
- **Files modified:** ai/tool-definitions.js (copy only, not committed -- belongs to Phase 135)
- **Verification:** require('./tool-definitions.js') succeeds, all 42 tools accessible

---

**Total deviations:** 1 auto-fixed (1 blocking dependency)
**Impact on plan:** Minimal -- copied dependency file for build; no scope creep.

## Issues Encountered
None -- all validation passed on first run.

## Next Phase Readiness
- ai/tool-executor.js ready for import by Phase 137 agent loop and MCP server refactor (Phase 136-02)
- executeTool provides the shared execution backbone both autopilot and MCP will call
- background.js callers will pass their existing executeCDPToolDirect as options.cdpHandler

## Self-Check: PASSED

- ai/tool-executor.js: FOUND
- Commit 2697d4b: FOUND
- 136-01-SUMMARY.md: FOUND

---
*Phase: 136-unified-tool-executor-mcp-migration*
*Completed: 2026-04-01*
