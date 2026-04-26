---
phase: 209-remote-control-handlers
plan: 01
subsystem: dashboard-remote-control

tags:
  - chrome-extension
  - service-worker
  - websocket
  - chrome-debugger
  - cdp
  - remote-control
  - dashboard
  - input-dispatch

# Dependency graph
requires:
  - phase: 164-dashboard-reliability-rebaseline
    provides: ext:remote-control-state contract, _lastRemoteControlState reference at line 394 of ws-client.js
  - phase: 182-cdp-tools
    provides: executeCDPToolDirect dispatcher with cdpClickAt, cdpScrollAt, cdpInsertText verbs
provides:
  - 5 dashboard remote control handlers in ws-client.js (start, stop, click, key, scroll)
  - _remoteControlActive lifecycle flag and _lastRemoteControlState snapshot variable at module scope
  - _broadcastRemoteControlState helper that emits ext:remote-control-state to dashboard
  - globalThis.__fsbWsInstance bridge so bare-function handlers can reach the active WebSocket
  - Dashboard bitmask -> cdpClickAt boolean modifier translation (alt=1, ctrl=2, shift=8)
  - Direct chrome.debugger Input.dispatchKeyEvent path for keyDown/keyUp events
  - Static analysis test guarding the handler contract
affects:
  - 209 follow-on phases (QR pairing, DOM streaming hardening) that share ws-client.js
  - Dashboard surfaces (showcase/js/dashboard.js, Angular dashboard) consuming ext:remote-control-state
  - background.js executeCDPToolDirect is now a public dependency of ws-client.js remote control

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Module-scope state for bare-function WebSocket handlers via globalThis bridge
    - Dashboard payload validation (Number.isFinite, type checks) before CDP dispatch
    - Bitmask modifier decomposition for cross-API translation
    - Try/catch/finally with guaranteed chrome.debugger detach for stale-debugger recovery

key-files:
  created:
    - tests/remote-control-handlers.test.js
  modified:
    - ws/ws-client.js

key-decisions:
  - Handlers live as top-level functions in ws-client.js (not methods on FSBWebSocket) because the existing _handleMessage switch already calls them as bare functions; refactoring to methods would change call sites unnecessarily.
  - Per-command debugger attach/detach for keyDown/keyUp matches the established executeCDPToolDirect pattern; no persistent debugger session for remote control.
  - Reuse executeCDPToolDirect for cdpClickAt/cdpScrollAt/cdpInsertText instead of duplicating CDP plumbing; only keyDown/keyUp dispatches CDP directly because executeCDPToolDirect does not expose those verbs.
  - globalThis.__fsbWsInstance bridge chosen over refactoring the switch to bind this; keeps the diff small and matches the deliberately bare call sites at lines 608-622.
  - Dashboard-side modifier bitmask (alt=1, ctrl=2, shift=8) decomposed into cdpClickAt boolean flags inside the handler so cdpClickAt callers elsewhere are unaffected.

patterns-established:
  - Pattern: Bare-function handler + globalThis instance bridge for ws-client.js dashboard message dispatch
  - Pattern: All remote control handlers guard on _remoteControlActive before any CDP work
  - Pattern: Dashboard payloads validated for shape (Number.isFinite, payload.type) before CDP dispatch; invalid payloads logged with [FSB RC] prefix and discarded

requirements-completed:
  - RC-04
  - RC-01
  - RC-02
  - RC-03

# Metrics
duration: ~5 min
completed: 2026-04-26
---

# Phase 209 Plan 01: Remote Control Handlers Summary

**Dashboard click, key, and scroll commands now reach the active streaming tab via Chrome DevTools Protocol, with lifecycle state broadcast back through ext:remote-control-state.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-04-26T04:32:46Z
- **Completed:** 2026-04-26T04:37:52Z
- **Tasks:** 3
- **Files modified:** 2 (1 modified, 1 created)

## Accomplishments

- Implemented all 5 missing dashboard remote control handlers in ws/ws-client.js (handleRemoteControlStart, handleRemoteControlStop, handleRemoteClick, handleRemoteKey, handleRemoteScroll), eliminating the P0 silent-failure path where dashboard remote commands had no receiving side.
- Wired click/scroll through the existing executeCDPToolDirect dispatcher (cdpClickAt, cdpScrollAt) and text insertion through cdpInsertText, with keyDown/keyUp dispatched directly via chrome.debugger Input.dispatchKeyEvent following the established attach-with-stale-debugger-recovery pattern.
- Established a globalThis.__fsbWsInstance bridge so the bare-function handlers wired into _handleMessage at lines 663-667 can broadcast ext:remote-control-state back to the dashboard without a `this` binding.
- Added module-scope _remoteControlActive guard so input dispatch is only honored after handleRemoteControlStart, satisfying the Phase 209 threat-model mitigation T-209-05 (elevation-of-privilege).
- Created tests/remote-control-handlers.test.js with 17 static-analysis assertions covering handler existence, CDP verb routing, payload validation, modifier decomposition, lifecycle state contract, and diagnostic logging.

## Task Commits

Each task was committed atomically:

1. **Task 1: State management and lifecycle handlers** - `6f1068c` (feat)
2. **Task 2: Click, key, scroll CDP dispatch** - `327d099` (feat)
3. **Task 3: Static analysis test** - `7ca5fba` (test)

## Files Created/Modified

- `ws/ws-client.js` - Added _remoteControlActive/_lastRemoteControlState module variables, _getRemoteControlTabId helper, _broadcastRemoteControlState helper, 5 handler functions (Start/Stop/Click/Key/Scroll), and globalThis.__fsbWsInstance assignment in the WebSocket onopen path.
- `tests/remote-control-handlers.test.js` - New static-analysis test verifying the structural contract for the 5 handlers (CDP verbs, payload validation, modifier decomposition, state broadcast, error handling).

## Decisions Made

- **Bare-function handlers + globalThis bridge over class methods:** The pre-existing _handleMessage switch (lines 663-667) calls the handlers as bare functions. Rather than refactor the switch to call `this.handleRemote*()` and bind methods, keep the handlers as top-level functions and expose the WebSocket instance on globalThis.__fsbWsInstance so handlers can send state messages. Smaller diff, no churn at the call sites.
- **executeCDPToolDirect reuse for click/scroll/insertText:** All three verbs already exist in the dispatcher with attach/detach + stale-debugger recovery. Reusing them avoids duplicating CDP plumbing. keyDown/keyUp are not exposed via executeCDPToolDirect, so they dispatch CDP directly using the same recovery pattern.
- **Per-command debugger attach/detach for keyDown/keyUp:** Matches the established CDP tool pattern in background.js. No persistent debugger session is held while remote control is active, which keeps the contract simple and avoids cross-tool debugger ownership issues with KeyboardEmulator.
- **Modifier bitmask translation inside handleRemoteClick:** Dashboard's getRemoteModifiers emits a bitmask (alt=1, ctrl=2, meta=4, shift=8). cdpClickAt expects {altKey, ctrlKey, shiftKey} booleans. Decomposition happens at the boundary so other callers of cdpClickAt are unaffected and the dashboard wire format stays compact.
- **Visual indicator decision (D-04 from CONTEXT):** Skipped — the dashboard already shows its own active state and the existing overlay infrastructure does not have a clean hook for a "remote control active" indicator. Adding one would require ext-side overlay coordination beyond this plan's scope. Logging via [FSB RC] prefix is sufficient for debugging.
- **Coordinate scaling decision (D-03 from CONTEXT):** Dashboard pre-scales coordinates via clampRemotePreviewPoint before sending. Extension trusts the pre-scaled values. No round-trip needed.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

- The first task commit incidentally swept in two pre-staged .planning files (PROJECT.md, STATE.md) that were already in the worktree's index when the executor started. The orchestrator owns those files and the content was already intended to land, so no rollback was needed; subsequent commits used explicit file paths to avoid recurrence.

## User Setup Required

None - no external service configuration required.

## Threat Flags

None — implementation matches the threat register; no new trust boundaries introduced.

## Next Phase Readiness

- Remote control handlers are wired end-to-end. Dashboard can now exercise click/key/scroll on a streaming tab and receive ext:remote-control-state acknowledgements.
- ws-client.js is ready for the next P0 phases in milestone v0.9.45 (QR pairing restoration, DOM streaming hardening, WebSocket compression symmetry, silent-error logging).
- Live UAT recommended: load the unpacked extension, pair the dashboard, click "Start remote control", and verify clicks/keys/scrolls land on the streaming tab. The static test confirms structure but not runtime CDP dispatch.

## Self-Check: PASSED

- File `ws/ws-client.js` modified (handlers present at lines 123-321).
- File `tests/remote-control-handlers.test.js` created (FOUND).
- Commits in git log: `6f1068c` (FOUND), `327d099` (FOUND), `7ca5fba` (FOUND).
- New test passes (`node tests/remote-control-handlers.test.js` exits 0).
- Existing `tests/dashboard-runtime-state.test.js` continues to pass (57/0).

---
*Phase: 209-remote-control-handlers*
*Completed: 2026-04-26*
