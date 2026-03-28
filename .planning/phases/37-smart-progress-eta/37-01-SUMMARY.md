---
phase: 37-smart-progress-eta
plan: 01
subsystem: ui
tags: [progress-bar, eta, phase-detection, complexity-estimation]

# Dependency graph
requires:
  - phase: 36-debug-feedback-pipeline
    provides: actionHistory structure and session fields
provides:
  - detectTaskPhase function classifying actions into navigation/extraction/writing
  - Phase-weighted calculateProgress with floors 0/30/70 and ceilings 30/70/99
  - Complexity-aware ETA blending iteration average with task estimate
  - Monotonic progress guarantee via _lastProgressPercent
affects: [37-02 multi-site progress, 39 overlay UX polish]

# Tech tracking
tech-stack:
  added: []
  patterns: [phase-weighted progress model, ETA blending with decay weights]

key-files:
  created: []
  modified: [background.js]

key-decisions:
  - "Phase detection uses sliding window of last 5 actions for responsiveness"
  - "ETA weight decays from 70% estimate to 10% as iterations progress"
  - "Progress monotonicity enforced via session._lastProgressPercent"

patterns-established:
  - "Phase-weighted progress: navigation=0-30%, extraction=30-70%, writing=70-99%"
  - "ETA blending: early iterations trust complexity estimate, later trust actual timing"

requirements-completed: [PROG-01, PROG-02, PROG-03]

# Metrics
duration: 1min
completed: 2026-03-17
---

# Phase 37 Plan 01: Smart Progress & ETA Summary

**Phase-aware weighted progress model with complexity-informed ETA blending in calculateProgress**

## Performance

- **Duration:** 1 min
- **Started:** 2026-03-17T09:01:27Z
- **Completed:** 2026-03-17T09:02:50Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Added detectTaskPhase() that classifies session actions into navigation/extraction/writing phases using a sliding window of the last 5 actions
- Refactored calculateProgress() from naive linear iteration-based to phase-weighted model with floors (0/30/70) and ceilings (30/70/99)
- Added complexity-aware ETA that blends task estimate (70% weight early, decaying to 10%) with actual iteration timing
- Progress monotonicity guarantee prevents jarring backward jumps

## Task Commits

Each task was committed atomically:

1. **Task 1: Add detectTaskPhase and refactor calculateProgress with weighted model** - `0e92db8` (feat)
2. **Task 2: Add complexity-aware ETA blending** - `c5c0f20` (feat)

## Files Created/Modified
- `background.js` - Added detectTaskPhase(), refactored calculateProgress() with phase-weighted model and complexity-aware ETA

## Decisions Made
- Phase detection uses sliding window of last 5 actions rather than full history for responsiveness to phase transitions
- ETA weight formula: estimateWeight = max(0.1, 0.7 - 0.6 * iterationRatio) -- gives 70/30 split early, 10/90 split late
- Progress monotonicity enforced at calculateProgress level via session._lastProgressPercent

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase-weighted progress model ready for Plan 02 multi-site/sheets extensions
- All 4 sendSessionStatus call sites automatically use new model via spread operator
- detectTaskPhase and calculateProgress are standalone functions, easy to extend

---
*Phase: 37-smart-progress-eta*
*Completed: 2026-03-17*
