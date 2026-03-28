---
phase: 35-notion-todo-workflow-refinement
plan: 04
subsystem: actions, selectors
tags: [stability-detection, waitForPageStability, selector-resolution, DOM-observation]

requires:
  - phase: 35-01
    provides: viewport-complete snapshot and stability hooks
  - phase: 35-02
    provides: action diagnostics and binary state detection

provides:
  - STABILITY_PROFILES constant and waitForStability() wrapper for observation-based waits
  - uiReadySelector option for early proceed on infinite-fetching sites
  - reResolveElement() context-aware selector re-resolution
  - makeUnique() positional constraint enforcement for single-match selectors
  - _fsbResolveContext tracking on elements found via findElementByStrategies

affects: [actions, selectors, dom-analysis, site-guides]

tech-stack:
  added: []
  patterns: [profile-based stability detection, context-aware DOM re-resolution, unique selector enforcement]

key-files:
  created: []
  modified:
    - content/actions.js
    - content/selectors.js
    - content/dom-analysis.js

key-decisions:
  - "STABILITY_PROFILES and waitForStability definitions added as bugfix -- prior plans referenced them without defining"
  - "5 setTimeout calls deliberately kept: polling loop (verifyMessageSent), parametric delays (pressKeySequence/typeWithKeys), 30ms mechanical gaps"
  - "generateSelector thresholds tightened from permissive (<=3,5,10) to strict (===1) with makeUnique nth-of-type fallback"
  - "reResolveElement uses 3-strategy cascade: role+name (0.9 confidence), nearby_text (0.6), parent+position (0.5)"

patterns-established:
  - "Profile-based stability: use waitForStability(profile) instead of hardcoded setTimeout -- profiles: scroll, click, type_keystroke, type_complete, select, light"
  - "Selector uniqueness: all generateSelector strategies must produce exactly 1 match or use makeUnique() positional fallback"
  - "Context tracking: findElementByStrategies stores _fsbResolveContext on found elements for re-resolution"

requirements-completed: [WAIT-01, WAIT-02, SEL-01, SEL-02]

duration: 20min
completed: 2026-03-17
---

# Phase 35 Plan 04: Stability Detection and Selector Re-Resolution Summary

**Observation-based stability profiles replacing all hardcoded setTimeout delays, with UI-ready detection for infinite-fetching sites and context-aware selector re-resolution with unique match enforcement**

## Performance

- **Duration:** 20 min
- **Started:** 2026-03-17T01:54:24Z
- **Completed:** 2026-03-17T02:14:50Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Replaced all hardcoded setTimeout delays in action handlers with profile-based waitForStability() calls (scroll, click, type_keystroke, type_complete, select, light)
- Added uiReadySelector option to waitForPageStability for early proceed when target element is interactable but network is still active
- Added reResolveElement() in selectors.js for context-aware fallback using role+name, nearby text, and parent+position strategies
- Added makeUnique() helper and tightened all generateSelector thresholds to enforce single-match selectors with nth-of-type positional fallback
- Stored _fsbResolveContext on elements found via findElementByStrategies for future re-resolution

## Task Commits

Each task was committed atomically:

1. **Task 1: Replace hardcoded delays with observation-based stability detection** - `96e49bf` (feat)
2. **Task 2: Add UI-ready detection and context-aware selector re-resolution** - `6a1917f` (feat)
3. **Bugfix: Add missing STABILITY_PROFILES and waitForStability definitions** - `ec83670` (fix)

## Files Created/Modified
- `content/actions.js` - STABILITY_PROFILES constant, waitForStability() wrapper, uiReadySelector in waitForPageStability, all action handler delays replaced with profile-based stability checks
- `content/selectors.js` - reResolveElement(), makeUnique(), unique selector enforcement in generateSelector (7 strategies tightened)
- `content/dom-analysis.js` - _fsbResolveContext tracking in findElementByStrategies, re-resolution fallback when all selectors fail

## Decisions Made
- 5 setTimeout calls deliberately preserved: 1 polling loop in verifyMessageSent (200ms poll interval, not a stability wait), 2 parametric delays in pressKeySequence/typeWithKeys (user-configurable delay variable), 2 mechanical 30ms gaps in typeWithKeys clearFirst (Ctrl+A/Backspace timing)
- STABILITY_PROFILES and waitForStability function definitions were missing from the codebase (prior plans added calls without definitions) -- added as Rule 1 bugfix
- generateSelector thresholds changed from permissive multi-match (<=3, <=5, <=10) to strict single-match (===1) with makeUnique() positional fallback before falling through to next strategy
- reResolveElement confidence levels: role+name 0.9, nearby_text 0.6, parent+position 0.5

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Missing STABILITY_PROFILES and waitForStability definitions**
- **Found during:** Task 1 (verification)
- **Issue:** Prior plan work (35-01 through 35-05) added calls to waitForStability() and references to STABILITY_PROFILES without defining them anywhere in the codebase. The definitions existed only as uncommitted working tree changes.
- **Fix:** Added STABILITY_PROFILES constant with 6 profiles and waitForStability() wrapper function between checkBinaryState and tools definition.
- **Files modified:** content/actions.js
- **Verification:** grep confirms definitions at lines 1427 and 1442
- **Committed in:** ec83670

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Essential for correctness -- the entire plan depends on waitForStability being callable.

## Issues Encountered
- Initial file read showed working tree with uncommitted changes from prior plan sessions, causing confusion about what was already converted vs what needed conversion. Resolved by checking git history and adding missing definitions.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All observation-based stability infrastructure in place
- Selector re-resolution ready for use by site guides and action handlers
- Next plans can use waitForStability(profile) for any new action handlers

---
*Phase: 35-notion-todo-workflow-refinement*
*Completed: 2026-03-17*
