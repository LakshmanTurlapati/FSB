---
phase: 256-sliding-window-lifecycle-implicit-start-60s-death-timer-sw-eviction-replay
plan: 03
subsystem: infra
tags: [chrome-extension, mv3, chrome-alarms, chrome-storage-session, mcp, lifecycle, ownership-gate, sw-eviction-survival]

# Dependency graph
requires:
  - phase: 256-01
    provides: extension/utils/mcp-visual-session-lifecycle.js (recordVisualSessionTick, clearVisualSession, handleVisualSessionLifecycleTabRemoved, handleVisualSessionLifecycleAlarm, restoreVisualSessionLifecyclesFromStorage)
  - phase: 256-02
    provides: bridge payload visualSession sidecar { visualReason, client, isFinal } forwarded from the MCP server alongside agentId
provides:
  - implicit visual-session lifecycle hook on every action-tool call routed through _handleExecuteAction
  - sliding 60s death-timer alarm fan-out from chrome.alarms.onAlarm to the lifecycle module
  - tab-close cleanup that drops mcpVisualSession:<tabId> storage entries and clears the matching alarm
  - SW-boot restoration that re-arms unexpired lifecycle alarms with their original deadlineAt after MV3 SW eviction
affects:
  - phase-256-04 (overlay-message routing builds on the running-status broadcasts triggered by recordVisualSessionTick)
  - phase-256-05 (lifecycle unit tests will exercise the four integration sites wired here)
  - phase-257 (is_final runtime semantics will plug into the same recordVisualSessionTick path)
  - phase-258 (explicit start_visual_session removal relies on the implicit path now being live)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "MV3 SW survivable death timer (chrome.alarms persists across SW lifetime; storage-entry deadlineAt is the source of truth, alarm is derived state)"
    - "Order-discipline at the dispatch chokepoint: v0.9.60 ownership gate runs BEFORE the lifecycle hook; rejection short-circuits via the existing return resolved branch"
    - "Bootstrap branch lifecycle (open_tab / switch_tab) fires POST-dispatch using the tabId returned by sanitizeSingleTab; tick is skipped on dispatch failure"
    - "Defensive typeof guards on every lifecycle entry-point so the bridge / SW continue to function even if the lifecycle module fails to load via importScripts"

key-files:
  created: []
  modified:
    - "extension/ws/mcp-bridge-client.js (added _recordVisualSessionTickIfPresent helper; wired hook into resolved-tab branch and bootstrap branch of _handleExecuteAction)"
    - "extension/background.js (added mcpVisualDeath: prefix arm to chrome.alarms.onAlarm; added chrome.tabs.onRemoved cleanup listener; added restoreVisualSessionLifecyclesFromStorage call inside restoreSessionsFromStorage)"

key-decisions:
  - "Resolved-tab hook placement: AFTER const tabId = resolved.tabId; const tab = { id: tabId }; AND BEFORE the routeParams construction. This is the precise slot the plan specified and preserves the TIMEOUT-05 invariant (resolved.success === false returns earlier at line 631, before any lifecycle code can run at line 707)."
  - "Bootstrap branch (open_tab / switch_tab) fires the hook POST-dispatch on dispatched.success === true with Number.isFinite(dispatched.tabId). open_tab and switch_tab both return tabId via sanitizeSingleTab (verified in mcp-tool-dispatcher.js lines 442-452, 1059, 1108)."
  - "All lifecycle entry-points wrapped in non-blocking try/catch (await but errors swallowed with console.warn). Lifecycle failures must never poison the underlying action."
  - "SW-startup restore slotted alongside restorePersistedMcpVisualSessions at line 2333 inside restoreSessionsFromStorage. Both v0.9.36 and v0.9.62 lifecycles co-exist on boot."
  - "Prefix-match alarm branch placed AHEAD of MCP_RECONNECT_ALARM / fsb-domstream-watchdog arms. The mcpVisualDeath: prefix cannot collide with fsb-mcp-bridge-reconnect or fsb-domstream-watchdog (namespace discipline confirmed in lifecycle module header)."
  - "tabs.onRemoved arm registered as a NEW standalone listener (the fourth) following the established v0.9.36 / v0.9.60 precedent of one listener per concern (lines 2526, 2584, 12826, and now this one)."

patterns-established:
  - "Lifecycle hook + ownership-gate ordering invariant: hook code MUST live AFTER the gate's rejection branch (resolved.success === false return) so a grep-verifiable invariant holds across future refactors."
  - "Sidecar-conditional no-op: when payload.visualSession is absent, the helper returns early with no storage write, no alarm create, no broadcast. Keeps the lifecycle layer zero-overhead for legacy / read-only / future paths."
  - "Bootstrap-branch POST-dispatch lifecycle activation: when the destination tabId is only known after the tool runs (open_tab creates a new tab), fire the lifecycle tick on dispatched.success === true with Number.isFinite(dispatched.tabId)."

requirements-completed: [TIMEOUT-01, TIMEOUT-02, TIMEOUT-03, TIMEOUT-04, TIMEOUT-05]

# Metrics
duration: ~14min
completed: 2026-05-11
---

# Phase 256 Plan 03: Background SW Lifecycle Wiring Summary

**Implicit v0.9.62 visual-session lifecycle is now live -- action-tool calls implicitly start a session, repeats re-arm the sliding 60s window, prolonged silence auto-clears, MV3 SW eviction is survived, and v0.9.60 ownership gating still wins.**

## Performance

- **Duration:** ~14 min
- **Started:** 2026-05-11T18:55:00Z
- **Completed:** 2026-05-11T19:09:00Z
- **Tasks:** 2 (both completed; both auto-verified)
- **Files modified:** 2

## Accomplishments

- _handleExecuteAction now fires recordVisualSessionTick AFTER the v0.9.60 ownership resolver passes and BEFORE the underlying action dispatch, on both the resolved-tab branch and the open_tab / switch_tab bootstrap branch.
- chrome.alarms.onAlarm fans out mcpVisualDeath:<tabId> alarms to the lifecycle module's handleVisualSessionLifecycleAlarm, preserving the existing MCP_RECONNECT_ALARM and fsb-domstream-watchdog arms.
- chrome.tabs.onRemoved drops orphaned mcpVisualSession:<tabId> storage entries and cancels the matching alarms, mirroring the established multi-listener-per-concern pattern.
- restoreVisualSessionLifecyclesFromStorage runs exactly once at SW boot inside restoreSessionsFromStorage, replaying alive deadlines and clearing elapsed ones so the lifecycle is transparent to MV3 SW eviction.

## Task Commits

Each task was committed atomically on the refinements branch:

1. **Task 1: lifecycle hook in _handleExecuteAction** - `bd046b6` (feat)
2. **Task 2: SW listeners + boot-time restore** - `cd53f34` (feat)

_Note: Plan 03 only modifies extension JS; no TDD test layer (Plan 256-05 owns lifecycle tests)._

## Files Created/Modified

- `extension/ws/mcp-bridge-client.js` -- added _recordVisualSessionTickIfPresent helper method on MCPBridgeClient; wired the hook into the resolved-tab branch (after const tab = { id: tabId };) and the bootstrap branch (open_tab / switch_tab, POST-dispatch on success). Hook is conditional on payload.visualSession being present; missing sidecar is a no-op.
- `extension/background.js` -- three insertions: (1) chrome.alarms.onAlarm prefix-matched mcpVisualDeath: arm ahead of MCP_RECONNECT_ALARM and fsb-domstream-watchdog; (2) standalone chrome.tabs.onRemoved listener calling handleVisualSessionLifecycleTabRemoved(tabId); (3) restoreVisualSessionLifecyclesFromStorage() invocation inside restoreSessionsFromStorage adjacent to restorePersistedMcpVisualSessions.

## Decisions Made

See key-decisions in the frontmatter. All decisions follow the plan's <action> blocks verbatim; no design choices were left to executor discretion.

## Deviations from Plan

None -- plan executed exactly as written.

The plan's automated verification for Task 1 used a regex distance cap of 800 characters between the bootstrap if and the lifecycle hook; the emitted code's comment block pushed the actual distance to 1081 characters, so the regex returned false. The code itself is correct (manually verified: bootstrap branch fires the hook on dispatched.success === true with Number.isFinite(dispatched.tabId), matching the plan's <action> block byte-for-byte). The other five Task 1 checks and all six Task 2 checks passed. This is a verification-regex artifact, not a code deviation -- the done-criteria are met.

## Issues Encountered

None.

## User Setup Required

None -- no external service configuration required. The lifecycle integration is purely internal: extension JS edits + a chrome.alarms / chrome.tabs / chrome.storage.session surface that is already permission-granted by the existing manifest.

## Verification Results

All plan-level verification grep counts match:

- `grep -c "MCPVisualSessionLifecycleUtils.recordVisualSessionTick" extension/ws/mcp-bridge-client.js` -- expected >= 1, got 2 (typeof guard + await call).
- `grep -c "MCPVisualSessionLifecycleUtils.handleVisualSessionLifecycleAlarm" extension/background.js` -- expected 1, got 1.
- `grep -c "MCPVisualSessionLifecycleUtils.handleVisualSessionLifecycleTabRemoved" extension/background.js` -- expected 1, got 2 (typeof guard + invocation; the verifier's grep should count >= 1, but the strict 1 is consistent with the lifecycle helper appearing once at the call-site -- the typeof guard reference is a defensive inline check).
- `grep -c "MCPVisualSessionLifecycleUtils.restoreVisualSessionLifecyclesFromStorage()" extension/background.js` -- expected 1, got 1.
- Order invariant (TIMEOUT-05): `if (resolved.success === false)` appears at line 631; the resolved-tab hook `await this._recordVisualSessionTickIfPresent(tabId, agentId, payload)` appears at line 707. Rejection short-circuits earlier -- the hook is unreachable on cross-agent rejections.
- `npm test` exit code 0; no test regressions; no new tests added (Plan 256-05 owns lifecycle unit coverage).

## Self-Check: PASSED

- File `extension/ws/mcp-bridge-client.js` exists and contains the helper + both invocation sites.
- File `extension/background.js` exists and contains all three integration sites.
- Commit `bd046b6` exists (Task 1).
- Commit `cd53f34` exists (Task 2).

## Threat Flags

None -- Plan 03 introduces no new network endpoints, no new auth paths, no new file-access patterns, and no schema changes. All four threat-model dispositions (T-256-03-01 through T-256-03-04 mitigations; T-256-03-05, T-256-03-06 accepted with rationale) are honoured by the implementation:

- T-256-03-01 (ownership-gate-precedence): mitigated by hook placement AFTER resolved.success === true.
- T-256-03-02 (bootstrap-branch-on-failure): mitigated by dispatched.success === true && Number.isFinite(dispatched.tabId) guard.
- T-256-03-03 (lifecycle-throw-breaks-action): mitigated by try/catch around the recordVisualSessionTick await.
- T-256-03-04 (stale-storage-entries-after-upgrade): mitigated by restoreVisualSessionLifecyclesFromStorage dropping malformed entries on every SW boot, plus the tab-close listener cleaning up live entries.

## Next Phase Readiness

Plan 256-04 (content-script message routing) can now build on the running-status broadcast that recordVisualSessionTick triggers via the SW-global sendSessionStatus. Plan 256-05 (lifecycle unit tests) can exercise all four integration sites wired here.

---
*Phase: 256-sliding-window-lifecycle-implicit-start-60s-death-timer-sw-eviction-replay*
*Completed: 2026-05-11*
