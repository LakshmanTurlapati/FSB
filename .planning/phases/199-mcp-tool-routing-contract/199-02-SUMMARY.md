---
phase: 199-mcp-tool-routing-contract
plan: "02"
subsystem: mcp-routing
tags: [mcp, chrome-extension, dispatcher, browser-tools, restricted-tabs]

requires:
  - phase: 199-mcp-tool-routing-contract
    provides: Executable RED route-contract tests from Plan 199-01
  - phase: 198-mcp-bridge-lifecycle-reconnect-state
    provides: MCP bridge lifecycle and service-worker wake behavior to preserve
provides:
  - Shared MCP tool dispatcher loaded before the bridge client
  - Direct browser/tab handlers for Phase 199 MCP routes
  - Read-only message route dispatch for tabs, DOM, page reads, and site guides
  - Navigation-only restricted-page recovery responses
affects: [phase-199, mcp-routing, browser-tools, restricted-recovery]

tech-stack:
  added: []
  patterns:
    - Plain script-compatible dispatcher with CommonJS and globalThis exports
    - Strict allowlisted MCP route contracts with structured route errors
    - Sanitized tab metadata responses for MCP browser/tab tools

key-files:
  created:
    - ws/mcp-tool-dispatcher.js
  modified:
    - background.js
    - ws/mcp-bridge-client.js

key-decisions:
  - "Browser/tab MCP routes now execute through a shared dispatcher loaded before the bridge client."
  - "Restricted read helper gaps return navigation-only restricted recovery responses before generic route errors."
  - "The browser contract includes get_site_guide/mcp:get-site-guides, so those read-only routes are declared without changing the underlying helper behavior."

patterns-established:
  - "Phase 199 tool/message routes are declared in MCP_PHASE199_TOOL_ROUTES and MCP_PHASE199_MESSAGE_ROUTES."
  - "Tab responses expose only small sanitized fields instead of raw Chrome tab objects."
  - "Unsupported background MCP routes fail loudly with mcp_route_unavailable instead of content-script fallback."

requirements-completed: [ROUTE-01, ROUTE-02, ROUTE-04]

duration: 6min
completed: 2026-04-22
---

# Phase 199 Plan 02: Shared Dispatcher and Browser Routes Summary

**Direct MCP browser/tab routing through a shared service-worker dispatcher with sanitized tab responses and navigation-only restricted recovery.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-04-22T23:26:44Z
- **Completed:** 2026-04-22T23:32:25Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Added `ws/mcp-tool-dispatcher.js` with strict Phase 199 tool/message route contracts, CommonJS exports, and `globalThis` exposure for `importScripts`.
- Loaded the dispatcher in `background.js` before `ws/mcp-bridge-client.js` without changing Phase 198 `armMcpBridge(reason)` lifecycle behavior.
- Implemented direct browser/tab handlers for `navigate`, history navigation, `refresh`, `open_tab`, `switch_tab`, and `list_tabs`, returning sanitized metadata only.
- Routed `mcp:get-tabs`, `mcp:get-dom`, `mcp:read-page`, and `mcp:get-site-guides` through dispatcher message contracts.
- Added direct task-status handlers for `report_progress`, `complete_task`, `partial_task`, and `fail_task`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Create shared dispatcher module and load it before the bridge client** - `c22c644` (feat)
2. **Task 2: Implement direct browser, tab, read-only, and task-status route handlers** - `c03eee4` (feat)

## Files Created/Modified

- `ws/mcp-tool-dispatcher.js` - New shared dispatcher with Phase 199 route contracts, browser/tab handlers, task-status handlers, structured route errors, and restricted recovery helper.
- `background.js` - Imports `ws/mcp-tool-dispatcher.js` after tool definitions and before the MCP bridge client.
- `ws/mcp-bridge-client.js` - Routes read-only browser messages and Phase 199 background tools through dispatcher functions while preserving `execute_js` direct scripting and vault/payment self-dispatch boundaries.

## Decisions Made

- `list_tabs` defaults to all tabs for MCP compatibility with the previous `_handleGetTabs()` behavior; callers can request current-window-only via `currentWindowOnly: true`.
- `execute_js` remains implemented by the bridge client's existing direct `chrome.scripting.executeScript` path, while still appearing in the dispatcher route contract for executable coverage.
- `mcp:get-site-guides` is declared in the dispatcher because the Plan 199-01 browser contract includes it; the existing `_handleGetSiteGuides()` behavior remains unchanged.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added browser contract route for site guides**
- **Found during:** Task 2 (Implement direct browser, tab, read-only, and task-status route handlers)
- **Issue:** The plan listed only `mcp:get-tabs`, `mcp:get-dom`, and `mcp:read-page`, but the executable browser contract from Plan 199-01 also requires `get_site_guide` and `mcp:get-site-guides`.
- **Fix:** Added dispatcher declarations for `get_site_guide` and `mcp:get-site-guides`, mapped to the existing bridge helper without expanding site-guide behavior.
- **Files modified:** `ws/mcp-tool-dispatcher.js`, `ws/mcp-bridge-client.js`
- **Verification:** `node tests/mcp-tool-routing-contract.test.js --group=browser` passed.
- **Committed in:** `c03eee4`

**2. [Rule 1 - Bug] Returned restricted recovery before helper-unavailable errors**
- **Found during:** Task 2 (Implement direct browser, tab, read-only, and task-status route handlers)
- **Issue:** Once the dispatcher existed, the restricted-tab test harness reached `dispatchMcpMessageRoute()` and received helper-unavailable route errors instead of restricted-page recovery responses.
- **Fix:** Added restricted-active-tab detection before generic helper-unavailable errors for read message routes.
- **Files modified:** `ws/mcp-tool-dispatcher.js`
- **Verification:** `node tests/mcp-restricted-tab.test.js` passed with navigation-only recovery tools and no `run_task` text.
- **Committed in:** `c03eee4`

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both fixes were required by the executable Plan 199-01 contracts and the user's restricted-recovery boundary. No vault/payment routes were expanded.

## Issues Encountered

- `node tests/mcp-restricted-tab.test.js` intentionally emitted one `[FSB MCP] Tool error` log line while passing; it comes from the error mapper's existing diagnostic logging.

## Verification

- `node --check ws/mcp-tool-dispatcher.js`
- `node --check ws/mcp-bridge-client.js`
- `node --check background.js`
- `node tests/mcp-tool-routing-contract.test.js --group=browser` - 70 passed, 0 failed
- `node tests/mcp-restricted-tab.test.js` - 74 passed, 0 failed

## TDD Gate Compliance

Plan 199-01 supplied the RED executable route contracts. This plan completed the GREEN implementation with `c22c644` and `c03eee4`; no duplicate RED test files were added.

## Known Stubs

None. Stub-pattern scanning found default parameters/null initializers and pre-existing background.js placeholders, but no introduced UI-facing stubs or unwired mock data.

## Threat Flags

None. The new dispatcher-to-Chrome-tabs surface is the planned threat surface for T-199-02-01 through T-199-02-04, and responses are sanitized.

## Auth Gates

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Ready for Plan 199-03 to add the remaining autopilot and observability route coverage without reopening browser/tab routing or Phase 198 bridge lifecycle behavior.

## Self-Check: PASSED

- Created file exists: `ws/mcp-tool-dispatcher.js`
- Summary file exists: `.planning/phases/199-mcp-tool-routing-contract/199-02-SUMMARY.md`
- Modified file exists: `background.js`
- Modified file exists: `ws/mcp-bridge-client.js`
- Task commit exists: `c22c644`
- Task commit exists: `c03eee4`

---
*Phase: 199-mcp-tool-routing-contract*
*Completed: 2026-04-22*
