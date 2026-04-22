---
phase: 199-mcp-tool-routing-contract
plan: "01"
subsystem: testing
tags: [mcp, routing, dispatcher, restricted-tabs, tdd-red]

requires:
  - phase: 198-mcp-bridge-lifecycle-reconnect-state
    provides: Bridge lifecycle/topology tests and MCP build/import patterns
provides:
  - Executable RED route-contract coverage for Phase 199 public MCP routes
  - Restricted-tab recovery test coverage that calls dispatcher route contracts
  - Root npm test wiring for route-contract regression coverage
affects: [phase-199, mcp-routing, restricted-recovery, npm-test]

tech-stack:
  added: []
  patterns:
    - Plain Node assertion scripts for executable MCP route contracts
    - RED-only GSD test plans that later implementation plans must make green

key-files:
  created:
    - tests/mcp-tool-routing-contract.test.js
  modified:
    - package.json
    - tests/mcp-restricted-tab.test.js

key-decisions:
  - "Plan 199-01 is RED-only by design: dispatcher implementation is deferred to Plans 199-02 and 199-03."
  - "Restricted recovery advertises only navigate, open_tab, switch_tab, and list_tabs; run_task is not an accepted restricted recovery tool."
  - "Root npm test runs Phase 198 bridge lifecycle/topology tests before the new Phase 199 route-contract tests."

patterns-established:
  - "Route contracts are exercised through dispatcher exports rather than background.js source-string checks."
  - "Restricted active-tab tests install failing content-dispatch stubs so content-script fallback is caught."

requirements-completed: [ROUTE-01, ROUTE-02, ROUTE-03, ROUTE-04]

duration: 5min
completed: 2026-04-22
---

# Phase 199 Plan 01: Executable Route Contract Tests Summary

**RED route-contract tests now fail on missing direct MCP dispatcher coverage instead of passing on source-string mentions.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-04-22T23:18:10Z
- **Completed:** 2026-04-22T23:22:58Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Added `tests/mcp-tool-routing-contract.test.js`, which loads `TOOL_REGISTRY`, expects `ws/mcp-tool-dispatcher.js`, and asserts public tool/message route contracts.
- Rewrote `tests/mcp-restricted-tab.test.js` so restricted read/content coverage calls `dispatchMcpMessageRoute()` for `mcp:read-page` and `mcp:get-dom`.
- Wired the new route-contract test into `npm test` after the MCP bridge lifecycle/topology tests and before restricted-tab coverage.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add executable MCP route contract test** - `9229efc` (test)
2. **Task 2: Replace restricted-tab source checks with executable recovery contract** - `690e156` (test)

## Files Created/Modified

- `tests/mcp-tool-routing-contract.test.js` - New executable route-contract RED test for Phase 199 public MCP tool and message routes.
- `tests/mcp-restricted-tab.test.js` - Replaced `background.js` string scans with dispatcher route calls, restricted active-tab mocks, and navigation-only recovery assertions.
- `package.json` - Adds Phase 198 lifecycle/topology tests and the new route-contract test to the root `npm test` sequence.

## Decisions Made

- Plan 199-01 intentionally stops at RED tests; production dispatcher work belongs to Plans 199-02 and 199-03.
- Blank/new-tab and browser-internal restricted recovery are navigation-first and must not advertise `run_task`.
- `npm test` now includes the Phase 198 MCP bridge tests before the Phase 199 route-contract tests so the requested route-contract ordering has a concrete anchor.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added missing Phase 198 test anchors to `npm test`**
- **Found during:** Task 1 (Add executable MCP route contract test)
- **Issue:** The plan required the new route-contract test to run immediately after `tests/mcp-bridge-topology.test.js`, but the root test script did not include the Phase 198 lifecycle/topology tests yet.
- **Fix:** Added `tests/mcp-bridge-client-lifecycle.test.js` and `tests/mcp-bridge-topology.test.js` before `tests/mcp-tool-routing-contract.test.js`.
- **Files modified:** `package.json`
- **Verification:** `rg "mcp-tool-routing-contract.test.js" package.json`; Task 1 RED command passed.
- **Committed in:** `9229efc`

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** The adjustment is limited to test sequencing and preserves the plan's requested ordering.

## Issues Encountered

- `npm --prefix mcp-server run build` regenerated tracked MCP build artifacts (`mcp-server/ai/tool-definitions.cjs`, `mcp-server/build/version.d.ts`, `mcp-server/build/version.js`). They were build-output drift unrelated to this RED test plan and were restored before summary creation.

## Verification

- `node tests/mcp-tool-routing-contract.test.js` fails as intended with `ws/mcp-tool-dispatcher.js` / missing direct route contract output.
- `npm --prefix mcp-server run build && node tests/mcp-restricted-tab.test.js` fails as intended with `ws/mcp-tool-dispatcher.js` while retaining navigation-only `validRecoveryTools` and `run_task` negative assertions.
- Acceptance grep checks passed for `requiredPublicRoutes`, dispatcher export names, package test wiring, restricted URLs, content-dispatch failure stubs, and removal of `backgroundSource.includes`.

## TDD Gate Compliance

RED commits are present for both TDD tasks. GREEN is intentionally deferred because this plan creates the executable contract tests that Plans 199-02 and 199-03 must satisfy.

## Known Stubs

None. Test-only mocks/stubs are intentional harness controls and do not flow to UI rendering.

## Threat Flags

None. This plan adds test harnesses and package test wiring only; it introduces no new endpoint, auth path, file access boundary, or runtime data exposure.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Ready for Plan 199-02. The browser/tab dispatcher implementation should make `node tests/mcp-tool-routing-contract.test.js --group=browser` pass without requiring autopilot or observability route completion.

## Self-Check: PASSED

- Created file exists: `tests/mcp-tool-routing-contract.test.js`
- Modified file exists: `tests/mcp-restricted-tab.test.js`
- Modified file exists: `package.json`
- Task commit exists: `9229efc`
- Task commit exists: `690e156`

---
*Phase: 199-mcp-tool-routing-contract*
*Completed: 2026-04-22*
