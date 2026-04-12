---
phase: 168-data-audit-display-firewall
plan: 01
subsystem: overlay-display
tags: [display-filter, sanitize, progress-label, eta-removal]
dependency_graph:
  requires: []
  provides: [sanitizeActionText, display-firewall, phase-labels]
  affects: [utils/overlay-state.js, content/visual-feedback.js, ui/popup.js, ui/sidepanel.js]
tech_stack:
  added: []
  patterns: [display-layer-filtering, tool-command-to-human-text-mapping]
key_files:
  created:
    - tests/test-overlay-state.js (43 new test assertions)
  modified:
    - utils/overlay-state.js (sanitizeActionText, ETA nulling, _lastActionSummary preference)
    - content/visual-feedback.js (legacy Step X/Y fallback replaced)
    - ui/popup.js (progress label now phase name)
    - ui/sidepanel.js (progress label now phase name)
key_decisions:
  - "Display-only filtering: sanitizeActionText runs at display time, not at source -- all consumers still receive raw data"
  - "ETA fully nulled: all buildOverlayProgress paths return eta: null, removing unused eta variable"
  - "_lastActionSummary preferred: AI-generated human text is preferred over raw statusText when available"
metrics:
  duration: 5min
  completed: 2026-04-12
  tasks_completed: 3
  tasks_total: 3
  files_modified: 5
  tests_added: 43
---

# Phase 168 Plan 01: Display Firewall -- sanitizeActionText and label alignment

Display-layer filtering that strips CLI tool syntax from overlay text, replaces Step X/Y labels with phase names across all surfaces, and removes ETA from progress objects.

## Changes Made

### Task 1: sanitizeActionText and display filtering (TDD)

Added `sanitizeActionText()` to `utils/overlay-state.js` that:

1. Strips "Step N/M: " prefix from any input text (per D-01, DATA-01)
2. Detects 25 CLI tool command patterns via regex and maps them to human-readable replacements (e.g., `click #submit-btn` becomes `Clicking element`)
3. Passes through already-human-readable text unchanged (e.g., `Clicking Add to Cart` stays as-is)
4. Handles null/undefined/empty input safely

Wired `sanitizeActionText` into `buildOverlayDisplay()` so all detail text passes through the filter before rendering.

Added `_lastActionSummary` preference in `buildOverlayDisplay()` (D-08) -- AI-generated human text is preferred over raw statusText when the session provides it.

Nulled out ETA in all `buildOverlayProgress()` return paths (D-02) -- removed the `eta` variable entirely and set `eta: null` in every return statement including `computeMultiSiteProgress` and `computeSheetsProgress`.

Exported `sanitizeActionText` for external consumer access.

43 new test assertions cover: all 25 tool patterns, human-readable passthrough, Step prefix stripping, edge cases (null/empty), buildOverlayDisplay integration, ETA removal, progress label correctness, and multisite/sheets counter preservation.

**Commit:** 1a048a3

### Task 2: Popup and sidepanel progress labels

Replaced `Step X/Y` label in popup.js `updateStatusMessage()` with phase-name lookup (`phaseLabels[progressData.phase]`). Replaced `N%` label in sidepanel.js `updateStatusMessage()` with the same phase-name lookup.

Both surfaces:
- Broadened the condition from `progressData.iteration != null` to `progressData.phase || progressData.iteration != null` so the progress bar shows when only phase is provided
- Preserved `fill.style.width = (progressData.progressPercent || 0) + '%'` for bar width
- Added inline `[FSB Field Audit]` comments documenting field dependencies

**Commit:** 9acec31

### Task 3: Legacy Step X/Y fallback removal

Replaced the legacy fallback in `ProgressOverlay.update()` that produced `Step N/M` text with an IIFE that calls `humanizeOverlayPhase()` from the overlay state utils. Falls back to `'Working'` when the utils are not available on `window.FSBOverlayStateUtils`.

Both the normalized state path (with `.display`) and the legacy raw state path (without `.display`) continue to work correctly.

**Commit:** e8395da

## Deviations from Plan

None -- plan executed exactly as written.

## Verification Results

1. `node tests/test-overlay-state.js` -- 64 passed, 0 failed
2. `grep -c "Step.*iteration.*maxIterations" ui/popup.js` -- 0 (old Step X/Y removed)
3. `grep -c "Step.*stepNumber.*totalSteps" content/visual-feedback.js` -- 0 (legacy removed)
4. `grep -c "sanitizeActionText" utils/overlay-state.js` -- 3 (function def + call + export)
5. `grep "eta:" utils/overlay-state.js | grep -v "eta: null"` -- 0 (no non-null eta remains)

## Self-Check: PASSED

All 5 modified files confirmed present. All 3 task commits confirmed in git log.
