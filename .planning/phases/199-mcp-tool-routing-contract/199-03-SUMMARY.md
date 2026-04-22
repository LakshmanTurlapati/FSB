---
phase: 199-mcp-tool-routing-contract
plan: "03"
subsystem: mcp-routing
tags: [mcp, chrome-extension, dispatcher, autopilot, observability, restricted-tabs]

requires:
  - phase: 199-mcp-tool-routing-contract
    provides: Shared MCP dispatcher and browser/read-only route contracts from Plans 199-01 and 199-02
  - phase: 198-mcp-bridge-lifecycle-reconnect-state
    provides: MCP bridge lifecycle, progress notification, and service-worker wake behavior to preserve
provides:
  - Direct autopilot message routes for run_task, stop_task, and get_task_status
  - Direct read-only observability routes for sessions, logs, and memory search/statistics
  - Public MCP tool aliases mapped to Phase 199 message route contracts
  - Structured route-unavailable and restricted-active-tab recovery responses
affects: [phase-199, phase-200, mcp-routing, observability, restricted-recovery]

tech-stack:
  added: []
  patterns:
    - Direct dispatcher handlers for autopilot and observability routes
    - Public alias-to-message route mappings for backwards-compatible MCP tool names
    - Bounded and sanitized read-only observability responses
    - validRecoveryTools-driven restricted recovery without automation fallback

key-files:
  created: []
  modified:
    - ws/mcp-tool-dispatcher.js
    - ws/mcp-bridge-client.js
    - mcp-server/src/errors.ts

key-decisions:
  - "Autopilot and observability MCP routes now execute through the shared dispatcher instead of bridge-client background self-dispatch."
  - "Public MCP tool names are preserved through explicit alias entries that point to message routes."
  - "Restricted read recovery is navigation/tab-only and returned before read_page/get_dom_snapshot content-script dispatch."
  - "Root npm test has unrelated runtime-contract failures deferred outside Phase 199 route work."

patterns-established:
  - "MCP_PHASE199_TOOL_ROUTES preserves public tool names while message routes own execution behavior."
  - "Observability routes must remain read-only, capped, and sanitized before returning session, log, or memory data."
  - "Restricted active-tab responses expose validRecoveryTools and never advertise run_task recovery."

requirements-completed: [ROUTE-02, ROUTE-03, ROUTE-04]

duration: 10min
completed: 2026-04-22
---

# Phase 199 Plan 03: Autopilot, Observability, and Restricted Recovery Routes Summary

**Direct MCP autopilot and observability routing with bounded read-only data exposure and navigation-only restricted recovery.**

## Performance

- **Duration:** 10 min
- **Started:** 2026-04-22T23:35:44Z
- **Completed:** 2026-04-22T23:45:33Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Routed `run_task`, `stop_task`, and `get_task_status` through direct dispatcher message handlers while preserving the MCP progress notification payload shape.
- Added public MCP alias mappings for autopilot, browser read, site guide, sessions, logs, and memory routes.
- Added read-only, bounded, and filtered observability handlers for session lists/details, logs, memory search, and memory stats.
- Returned restricted active-tab recovery before read-page and DOM content-script dispatch, with recovery limited to navigation/tab tools.
- Added structured `mcp_route_unavailable` server error mapping with `tool`, `routeFamily`, and `recoveryHint` metadata.

## Task Commits

Each task was committed atomically:

1. **Task 1: Route autopilot and observability through direct handlers** - `f0867a6` (feat)
2. **Task 2: Map structured route and restricted recovery errors** - `132b7dd` (fix)

## Files Created/Modified

- `ws/mcp-tool-dispatcher.js` - Adds public tool aliases, direct autopilot handlers, bounded observability handlers, early restricted-read recovery, and structured route errors.
- `ws/mcp-bridge-client.js` - Routes Phase 199 autopilot and observability bridge handlers through `dispatchMcpMessageRoute()` while preserving progress payloads.
- `mcp-server/src/errors.ts` - Maps `mcp_route_unavailable` and restricted active-tab errors to structured, navigation-only recovery guidance.
- `.planning/phases/199-mcp-tool-routing-contract/deferred-items.md` - Records an out-of-scope root `npm test` runtime-contract failure discovered during full verification.

## Decisions Made

- Direct autopilot routes use the existing background callbacks (`handleStartAutomation`, `handleStopAutomation`, and status data) rather than adding a second automation path.
- Observability route outputs are capped and sanitized at the dispatcher boundary, keeping logs, sessions, and memory read-only and filtered.
- Restricted read recovery is detected before helper/content-script dispatch, so blank/restricted pages never fall through to a generic route or automation suggestion.
- Unrelated tracked build drift from `npm --prefix mcp-server run build` was restored before committing because source changes did not require regenerated `tool-definitions` or `version` artifacts.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added bounded observability sanitization**
- **Found during:** Task 1 (Route autopilot and observability through direct handlers)
- **Issue:** The plan required logs, sessions, and memory routes to remain read-only, bounded, and filtered. The direct handlers needed explicit caps and field filtering to satisfy that boundary.
- **Fix:** Added response caps for logs, sessions, action history, and memory search results; removed prompt/raw response fields from log payloads; capped memory text; and returned summarized memory stats.
- **Files modified:** `ws/mcp-tool-dispatcher.js`
- **Verification:** `node tests/mcp-tool-routing-contract.test.js --group=observability` passed.
- **Committed in:** `f0867a6`

**2. [Rule 3 - Blocking] Restored unrelated build artifacts after MCP build**
- **Found during:** Task 2 and overall verification
- **Issue:** `npm --prefix mcp-server run build` regenerated tracked `mcp-server/ai/tool-definitions.cjs`, `mcp-server/build/version.d.ts`, and `mcp-server/build/version.js` even though the plan's source changes did not require those generated outputs.
- **Fix:** Restored those unrelated tracked build artifacts before committing, per the plan boundary.
- **Files modified:** None committed
- **Verification:** `git status --short --untracked-files=all` was clean after restore.
- **Committed in:** Not committed; restored before task and metadata commits.

---

**Total deviations:** 2 auto-fixed (1 missing critical functionality, 1 blocking build-artifact drift)
**Impact on plan:** Both actions preserved the plan boundaries: observability data stayed bounded/filtered, and unrelated build drift was kept out of commits.

## Issues Encountered

- `npm test` failed in `tests/runtime-contracts.test.js` with seven unrelated runtime-contract assertions around `SessionStateEmitter` and popup `sessionStateEvent` usage. This was logged to `.planning/phases/199-mcp-tool-routing-contract/deferred-items.md`; the focused Phase 199 contract tests passed.
- `npm --prefix mcp-server run build` produced unrelated tracked generated-file drift, which was restored before commits.

## Verification

- `npm --prefix mcp-server run build` - passed
- `node --check ws/mcp-tool-dispatcher.js` - passed
- `node --check ws/mcp-bridge-client.js` - passed
- `node --check background.js` - passed
- `node tests/mcp-tool-routing-contract.test.js` - 120 passed, 0 failed
- `node tests/mcp-restricted-tab.test.js` - 74 passed, 0 failed
- `npm test` - failed later in unrelated `tests/runtime-contracts.test.js`; deferred outside this plan

## TDD Gate Compliance

Plan 199-01 supplied the executable RED route contracts. Task 1 re-ran the autopilot and observability groups before implementation and confirmed failing route coverage, then completed GREEN in `f0867a6`. Task 2 completed the restricted recovery and structured error mapping GREEN work in `132b7dd`.

## Known Stubs

None. Stub-pattern scanning found default/null initializers and existing placeholder comments only; no introduced UI-facing stubs or unwired mock data.

## Threat Flags

None. The autopilot, observability, and restricted-recovery surfaces are the planned Phase 199 threat surfaces; no unplanned network endpoint, auth path, file access pattern, or schema boundary was introduced.

## Auth Gates

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Phase 199 route coverage is ready for follow-on diagnostics and verification work. The deferred root `npm test` runtime-contract failures should be handled separately before treating the full suite as green.

## Self-Check: PASSED

- Modified file exists: `ws/mcp-tool-dispatcher.js`
- Modified file exists: `ws/mcp-bridge-client.js`
- Modified file exists: `mcp-server/src/errors.ts`
- Deferred-items file exists: `.planning/phases/199-mcp-tool-routing-contract/deferred-items.md`
- Summary file exists: `.planning/phases/199-mcp-tool-routing-contract/199-03-SUMMARY.md`
- Task commit exists: `f0867a6`
- Task commit exists: `132b7dd`

---
*Phase: 199-mcp-tool-routing-contract*
*Completed: 2026-04-22*
