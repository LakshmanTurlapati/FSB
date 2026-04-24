---
phase: 204-overlay-badge-session-persistence
plan: "02"
subsystem: mcp-visual-lifecycle
tags: [mcp, overlay, persistence, chrome-storage, replay, watchdog]
requires:
  - phase: 204-overlay-badge-session-persistence
    provides: Live and mirrored trusted-client badge rendering on overlay and preview surfaces
  - phase: 203-mcp-visual-session-contract
    provides: Token-owned visual-session lifecycle, client-label allowlist, and overlay metadata plumbing
provides:
  - Persisted client-owned visual-session records in `chrome.storage.session`
  - Replay of running and final visual-session state on content-surface readiness
  - Absolute final-freeze deadlines that survive service-worker churn without extending the glow
  - Shared stale-session replay policy with 60s degrade and 120s orphan cleanup
affects: [phase-204, mcp-visual-session, overlay-replay, watchdog, service-worker]
tech-stack:
  added: []
  patterns:
    - Serializable visual-session records keyed by token in `chrome.storage.session`
    - Pure replay-planning helper shared by restore and readiness-triggered replay paths
    - Absolute `finalClearAt` deadlines instead of resetting final-state timers on replay
key-files:
  created: []
  modified:
    - utils/mcp-visual-session.js
    - background.js
    - tests/mcp-visual-session-contract.test.js
    - tests/mcp-bridge-client-lifecycle.test.js
key-decisions:
  - "Client-owned visual sessions persist as explicit serializable records with `lastUpdateAt` and optional `finalClearAt` metadata."
  - "Replay is driven by the same token/version/clientLabel state that owned the overlay originally, not by a second synthetic start flow."
  - "The existing 60s degrade and 120s orphan posture stays authoritative, and final overlays resume from stored remaining time rather than getting a fresh freeze."
patterns-established:
  - "Background restores persisted visual-session records on wake and replays them when the main-frame content surface becomes ready."
  - "Final visual-session replay reuses stored `finalClearAt` deadlines so reinjection never stretches a completed glow indefinitely."
  - "Same-tab restored records replace older tokens deterministically through the shared session manager."
requirements-completed: [LIFE-04, BADGE-04]
duration: 10 min
completed: 2026-04-23
---

# Phase 204 Plan 02: Visual Session Persistence & Cleanup Summary

**Client-owned visual sessions now survive reinjection and service-worker churn, replay with the same trusted owner, and degrade or clear safely instead of leaving the glow stuck.**

## Performance

- **Duration:** 10 min
- **Started:** 2026-04-23T23:39:54-05:00
- **Completed:** 2026-04-23T23:49:36-05:00
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Added serializable MCP visual-session records with `lastUpdateAt`, final-state metadata, and replay planning helpers in `utils/mcp-visual-session.js`.
- Persisted client-owned session state in `chrome.storage.session` from background start/progress/final/clear flows and restored it on service-worker wake.
- Replayed active visual-session state when the owned tab’s main-frame surface became ready again through both `contentScriptReady` and main-frame port readiness.
- Preserved the current stale-session posture: sessions older than 60 seconds replay in a waiting state with the same badge, while orphaned sessions older than 120 seconds clear instead of resurrecting stale glow.

## Task Commits

This plan's implementation landed in one verified feature commit:

1. **Tasks 1-2: Persisted visual-session records, readiness replay, and stale cleanup coverage** - `b2c5eac` (feat)

## Files Created/Modified

- `utils/mcp-visual-session.js` - Adds serializable visual-session records, restore helpers, and a shared replay-planning function for running, degraded, final, and clear outcomes.
- `background.js` - Persists client-owned session state, restores it on wake, replays it on readiness, and reuses stored deadlines for final clears and stale-session cleanup.
- `tests/mcp-visual-session-contract.test.js` - Covers serialized record restoration, running/final replay planning, degrade/orphan behavior, and same-tab restored-token replacement.
- `tests/mcp-bridge-client-lifecycle.test.js` - Locks the background source contract for `chrome.storage.session` persistence and readiness-triggered visual-session replay hooks.

## Decisions Made

- Kept persistence token-scoped and explicit instead of inferring current ownership from freeform overlay text or recent messages.
- Stored absolute final-clear deadlines (`finalClearAt`) so replay can resume the existing freeze window rather than refreshing it.
- Reused the shared session manager and `sendSessionStatus()` path for replay so reinjection behavior matches live updates instead of introducing a second renderer contract.

## Deviations from Plan

None - plan executed exactly as written.

**Total deviations:** 0 auto-fixed.
**Impact on plan:** No scope expansion; the delivered behavior matches the Phase 204-02 persistence and stale-cleanup contract.

## Issues Encountered

None.

## Verification

- `node --check utils/mcp-visual-session.js`
- `node --check background.js`
- `node tests/mcp-visual-session-contract.test.js`
- `node tests/mcp-bridge-client-lifecycle.test.js`
- `node tests/mcp-tool-routing-contract.test.js`
- `node tests/test-overlay-state.js`

## TDD Gate Compliance

Plan 204-02 expanded the focused visual-session contract tests around serialization and replay planning, then locked the background persistence/replay wiring with readiness and storage source-contract coverage.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Phase 204 is complete. The next step is planning Phase 205 for validation/docs coverage across the start/progress/end contract, badge surfaces, and persistence/cleanup behavior.

## Self-Check: PASSED

---
*Phase: 204-overlay-badge-session-persistence*
*Completed: 2026-04-23*
