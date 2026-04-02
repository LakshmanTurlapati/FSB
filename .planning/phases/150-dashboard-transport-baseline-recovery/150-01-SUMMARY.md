---
phase: 150-dashboard-transport-baseline-recovery
plan: 01
subsystem: infra
tags: [websocket, dashboard, chrome-extension, recovery]
requires: []
provides:
  - explicit ext:stream-state recovery contract between extension and dashboard
  - reconnect snapshots that carry stream intent, tab context, and not-ready reasons
  - dashboard preview recovery watchdog that reasserts stream intent after reconnects
affects: [151-dom-stream-consistency-and-state-sync, 152-remote-control-reliability, 153-dashboard-task-relay-correctness]
tech-stack:
  added: []
  patterns: [explicit readiness messages, snapshot-driven recovery, reconnect watchdog]
key-files:
  created: []
  modified: [ws/ws-client.js, background.js, showcase/js/dashboard.js]
key-decisions:
  - "Extension reconnect snapshots now include stream intent plus ready/not-ready/recovering fields."
  - "Dashboard preview recovery is driven by ext:snapshot and ext:stream-state instead of implicit missing messages."
patterns-established:
  - "Transport recovery contract: ext:snapshot restores task plus stream intent, ext:stream-state explains readiness transitions."
  - "Dashboard reconnect pattern: reassert stream intent on ws-open and extension-online, then fail closed to explicit not-ready UI."
requirements-completed: [STRM-01, STRM-02]
duration: 10min
completed: 2026-04-02
---

# Phase 150 Plan 01: Dashboard Transport Baseline Recovery Summary

**Explicit stream recovery signaling, reconnect snapshots with stream intent, and a dashboard watchdog that resolves preview recovery to streaming or a concrete not-ready state**

## Performance

- **Duration:** 10 min
- **Started:** 2026-04-02T08:52:30Z
- **Completed:** 2026-04-02T09:02:33Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Added `ext:stream-state` with explicit `ready`, `recovering`, and `not-ready` states plus concrete reasons for restricted, missing, waiting, and closed-tab cases.
- Extended extension reconnect snapshots to carry stream intent, stream tab context, recovery state, and snapshot source alongside task recovery fields.
- Replaced the dashboard's blind loading behavior with a preview recovery state machine that retries on reconnect and exits to explicit not-ready messaging instead of stalling indefinitely.

## Task Commits

Each task was committed atomically:

1. **Task 1: Define an explicit extension recovery contract for stream readiness and reconnect state** - `651f0c1` (feat)
2. **Task 2: Make the dashboard preview state machine consume recovered stream intent and retry deterministically** - `03ee538` (feat)

## Files Created/Modified

- `ws/ws-client.js` - Added stream candidate resolution, reconnect snapshot recovery fields, and `ext:stream-state` emission for start and reconnect paths.
- `background.js` - Added canonical stream readiness/not-ready helpers, tab-close signaling, and ready/recovering/not-ready broadcasts for tab switches and `domStreamReady`.
- `showcase/js/dashboard.js` - Added snapshot-driven preview recovery, explicit not-ready messaging, reconnect watchdog timers, and stream-intent reassertion on reconnect.

## Decisions Made

- Used `ext:stream-state` as the explicit readiness contract while keeping `ext:page-ready` as the real-page confirmation signal that still drives stream startup.
- Preserved `_streamingActive` as the extension-side stream-intent flag and let the dashboard reassert intent after relay reconnects or service worker restarts.
- Treated preview recovery as a state machine with a watchdog so the UI moves to `streaming` or explicit `disconnected/not-ready`, never indefinite loading.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Cleared stale dashboard reconnect timers and ping intervals on WS teardown**
- **Found during:** Task 2 (dashboard preview recovery state machine)
- **Issue:** Existing reconnect logic left keepalive and recovery timers running across disconnects, which could duplicate retries and leave preview recovery state stale.
- **Fix:** Cleared `wsPingTimer` and the new recovery watchdog on `ws.onclose` and `disconnectWS()`.
- **Files modified:** `showcase/js/dashboard.js`
- **Verification:** `node --check showcase/js/dashboard.js` and full plan verification commands passed.
- **Committed in:** `03ee538`

---

**Total deviations:** 1 auto-fixed (Rule 1)
**Impact on plan:** The auto-fix was required for deterministic reconnect behavior and stayed within the plan's transport-recovery scope.

## Issues Encountered

- Concurrent edits were already in progress in `.planning/STATE.md` and `.planning/ROADMAP.md`, so this run intentionally left contested planning files untouched and only wrote this summary.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 151 can now rely on explicit stream readiness and not-ready messages instead of inferring state from missing events.
- Reconnect snapshots now expose stream intent and tab context needed to keep DOM snapshots, mutations, and recovered task state synchronized.

## Self-Check: PASSED

- Verified `.planning/phases/150-dashboard-transport-baseline-recovery/150-01-SUMMARY.md` exists on disk.
- Verified task commits `651f0c1` and `03ee538` are present in git history.
