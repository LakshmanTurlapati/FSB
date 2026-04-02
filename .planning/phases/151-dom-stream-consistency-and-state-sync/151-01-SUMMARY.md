---
phase: 151-dom-stream-consistency-and-state-sync
plan: 01
subsystem: dashboard-preview
tags: [dom-stream, dashboard, reconnect, resync]
requires: [150-dashboard-transport-baseline-recovery]
provides:
  - stream/snapshot identity on DOM preview messages
  - stale preview message rejection across reconnects and tab switches
  - dashboard-side resync path when mutation application diverges
affects: [152-remote-control-reliability, 154-end-to-end-verification-hardening]
tech-stack:
  added: []
  patterns: [stream generation identity, stale-update rejection, fail-closed resync]
key-files:
  created: []
  modified: [content/dom-stream.js, background.js, showcase/js/dashboard.js]
key-decisions:
  - "DOM stream messages now carry explicit stream identity instead of relying on arrival order."
  - "The dashboard requests a fresh snapshot when incremental mutation application drifts instead of silently freezing."
patterns-established:
  - "Preview generation contract: snapshot, mutation, scroll, overlay, and dialog events are scoped to one stream session plus snapshot id."
  - "Dashboard fail-closed preview recovery: repeated stale mutation misses trigger a single resync request."
requirements-completed: [STRM-03]
duration: 16min
completed: 2026-04-02
---

# Phase 151 Plan 01: DOM Stream Consistency Summary

**Stable preview stream identity, stale-update rejection, and controlled resync when incremental DOM updates drift from the live page**

## Performance

- **Duration:** 16 min
- **Completed:** 2026-04-02T10:07:12Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Added `streamSessionId` and `snapshotId` to full snapshots plus all incremental DOM stream messages so the dashboard can distinguish the active preview generation from stale reconnect or tab-switch traffic.
- Fixed node-id assignment so the live DOM and serialized clone share the same `data-fsb-nid` values, which keeps later mutation targeting consistent for already-existing elements.
- Added dashboard-side rejection for stale snapshot/mutation/scroll/overlay/dialog messages and a deduped `requestPreviewResync()` path when stale node references or mutation-apply failures exceed a safe threshold.
- Reset preview overlays, dialog state, scroll state, and generation bookkeeping when a new snapshot replaces the current preview stream.

## Task Commits

The two plan tasks shared the same write set and were delivered together:

1. **Task 1: Add stream identity metadata to DOM stream payloads and reject stale dashboard updates** - `8924b00` (feat)
2. **Task 2: Fail closed to resync when mutation application diverges from the live DOM stream** - `8924b00` (feat)

## Files Created/Modified

- `content/dom-stream.js` - Added per-stream metadata, synchronized live/cloned node ids, and attached stream identity to snapshot, mutation, scroll, overlay, and dialog messages.
- `background.js` - Preserved DOM stream metadata when forwarding `ext:dom-*` messages to the website dashboard.
- `showcase/js/dashboard.js` - Added active preview generation tracking, stale-message rejection, mutation divergence counters, and the deduped preview resync path.

## Decisions Made

- Used a per-stream session id plus current snapshot id rather than a mutation sequence counter, because the dashboard only needs to reject stale generations and request a fresh baseline when it loses alignment.
- Failed closed to a fresh snapshot after repeated stale parent/target misses instead of trying to heal the preview incrementally from ambiguous state.
- Kept legacy compatibility by allowing metadata-free preview messages until an identified snapshot establishes the active preview generation.

## Issues Encountered

- Existing DOM snapshot generation only wrote `data-fsb-nid` onto the serialized clone, which meant later mutation diffs for pre-existing live nodes could not target the dashboard preview reliably.
- The preview could previously ignore stale mutation misses forever and remain visually frozen on the wrong DOM tree with no recovery path.

## Next Phase Readiness

- Phase 152 now has a cleaner preview baseline: remote-control overlays and scroll state can assume one active preview generation instead of racing stale stream traffic.
- Phase 154 can verify real reconnect and stale-mutation recovery behavior with a concrete resync path instead of best-effort logging only.

## Self-Check: PASSED

- Verified `.planning/phases/151-dom-stream-consistency-and-state-sync/151-01-SUMMARY.md` exists on disk.
- Verified `8924b00` is present in git history and contains the DOM stream identity/resync changes.
