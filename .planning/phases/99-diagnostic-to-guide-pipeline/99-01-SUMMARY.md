---
phase: 99-diagnostic-to-guide-pipeline
plan: 01
subsystem: ai-prompting
tags: [site-guides, autopilot, strategy-hints, canvas, micro-interaction, prompt-engineering]

# Dependency graph
requires:
  - phase: 47-56
    provides: "CANVAS diagnostic reports with autopilot recommendations"
  - phase: 57-66
    provides: "MICRO-INTERACTION diagnostic reports with autopilot recommendations"
provides:
  - "20 site guide files enriched with AUTOPILOT STRATEGY HINTS in guidance strings"
  - "Hints prepended within first 500 chars for visibility in continuation hybrid prompts"
  - "Distilled actionable recommendations from 20 v0.9.7 diagnostic reports"
affects: [ai-integration, autopilot-prompting, site-guide-system]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "AUTOPILOT STRATEGY HINTS block prepended to guidance template literals"
    - "[canvas] and [micro] tag prefixes for interaction category identification"
    - "[micro/drag] special tag for drag-and-drop traceability"

key-files:
  created: []
  modified:
    - "site-guides/finance/tradingview.js"
    - "site-guides/design/excalidraw.js"
    - "site-guides/travel/google-maps.js"
    - "site-guides/games/google-solitaire.js"
    - "site-guides/design/photopea.js"
    - "site-guides/ecommerce/nike-3d-viewer.js"
    - "site-guides/games/canvas-game.js"
    - "site-guides/music/virtual-piano.js"
    - "site-guides/productivity/pdf-editor.js"
    - "site-guides/design/miro.js"
    - "site-guides/media/video-player.js"
    - "site-guides/media/voice-recorder.js"
    - "site-guides/productivity/trello.js"
    - "site-guides/reference/wikipedia.js"
    - "site-guides/utilities/color-picker.js"
    - "site-guides/utilities/carousel.js"
    - "site-guides/ecommerce/mega-menu.js"
    - "site-guides/utilities/file-upload.js"
    - "site-guides/utilities/slider-captcha.js"
    - "site-guides/media/podcast-player.js"

key-decisions:
  - "Prepend hints at top of guidance string (not append) to fit within 500-char continuation prompt window"
  - "5 hints per guide, ~400 chars per block, tagged with [canvas] or [micro] prefixes"
  - "Trello uses [micro/drag] tag for SC3 drag category traceability"

patterns-established:
  - "AUTOPILOT STRATEGY HINTS header format: (from v0.9.7 diagnostic CATEGORY-NN)"
  - "Each hint is one line, max ~120 chars, prefixed with [canvas] or [micro]"

requirements-completed: [PROMPT-03]

# Metrics
duration: 4min
completed: 2026-03-22
---

# Phase 99 Plan 01: Diagnostic-to-Guide Pipeline Summary

**20 site guides enriched with distilled AUTOPILOT STRATEGY HINTS from v0.9.7 CANVAS and MICRO-INTERACTION diagnostic reports, prepended within 500-char continuation prompt window**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-22T13:50:35Z
- **Completed:** 2026-03-22T13:55:16Z
- **Tasks:** 2
- **Files modified:** 20

## Accomplishments
- 10 CANVAS site guides (phases 47-56) enriched with cdpClickAt/cdpDrag tool selection, coordinate calculation, modal dismissal, and verification strategy hints
- 10 MICRO-INTERACTION site guides (phases 57-66) enriched with interaction technique, timing, fallback chain, and verification hints
- All hints prepended at the start of guidance strings to appear within the 500-char continuation hybrid prompt truncation window
- Phase 59 trello.js uses [micro/drag] tag prefix for SC3 drag category traceability
- All 20 files pass node -c syntax validation

## Task Commits

Each task was committed atomically:

1. **Task 1: Enrich CANVAS category site guides (phases 47-56)** - `9884280` (feat)
2. **Task 2: Enrich MICRO-INTERACTION category site guides (phases 57-66)** - `25e2453` (feat)

## Files Created/Modified
- `site-guides/finance/tradingview.js` - CANVAS-01 hints: cdpClickAt preference, click-click Fibonacci pattern, modal pre-step
- `site-guides/design/excalidraw.js` - CANVAS-02 hints: keyboard shortcuts, shape draw pattern, multi-select approaches
- `site-guides/travel/google-maps.js` - CANVAS-03 hints: scroll_at zoom, drag-pans-not-draws, consent pre-step
- `site-guides/games/google-solitaire.js` - CANVAS-04 hints: iframe-hosted game, CDP-only interaction, Easy mode
- `site-guides/design/photopea.js` - CANVAS-05 hints: entire UI canvas-rendered, keyboard-only tool selection
- `site-guides/ecommerce/nike-3d-viewer.js` - CANVAS-06 hints: half-width drag rotation formula, smooth step params
- `site-guides/games/canvas-game.js` - CANVAS-07 hints: two-phase pattern, percentage-based coords, iframe offset
- `site-guides/music/virtual-piano.js` - CANVAS-08 hints: press_key preferred, live-verified key mapping, autoplay
- `site-guides/productivity/pdf-editor.js` - CANVAS-09 hints: dual interaction model, Type signature preference
- `site-guides/design/miro.js` - CANVAS-10 hints: auth check, N key shortcut, V-mode prerequisite for drag
- `site-guides/media/video-player.js` - MICRO-01 hints: click_at track preferred, hover-to-reveal, tolerance
- `site-guides/media/voice-recorder.js` - MICRO-02 hints: toggle vs hold detection, holdMs=6000, verification
- `site-guides/productivity/trello.js` - MICRO-03 hints: 3-tier drag strategy, rbd holdMs>=200, [micro/drag]
- `site-guides/reference/wikipedia.js` - MICRO-04 hints: select_text_range, empty paragraph filtering, citation offsets
- `site-guides/utilities/color-picker.js` - MICRO-05 hints: hue direction varies, click_at sufficient, hex fallback
- `site-guides/utilities/carousel.js` - MICRO-06 hints: arrow buttons preferred, coords inside bounds, hover
- `site-guides/ecommerce/mega-menu.js` - MICRO-07 hints: detect trigger type, three strategies, L-shaped path
- `site-guides/utilities/file-upload.js` - MICRO-08 hints: drop_file tool, SPA wait, accept attr check
- `site-guides/utilities/slider-captcha.js` - MICRO-09 hints: variable speed drag, ease-in-out, JS-rendered widget
- `site-guides/media/podcast-player.js` - MICRO-10 hints: click_at progress bar, play first, time tolerance

## Decisions Made
- Prepend hints at the TOP of guidance string (not append) because ai-integration.js continuation hybrid prompt truncates guidance to `.substring(0, 500)` -- only the first 500 chars are visible in iteration 2+ prompts
- Limited to 5 hints per guide (max ~400 chars) to stay well within the 500-char window while leaving room for the site-specific intelligence header
- Used [canvas] prefix for CANVAS category hints and [micro] prefix for MICRO-INTERACTION category hints for clear category identification in the prompt
- Used [micro/drag] special prefix for Phase 59 trello.js to satisfy SC3 drag interaction category traceability requirement

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None - all 20 site guide files contain complete, functional AUTOPILOT STRATEGY HINTS blocks.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 20 site guides are enriched and ready for autopilot prompt consumption
- The AUTOPILOT STRATEGY HINTS will be visible in both first-iteration full guidance and continuation hybrid prompts (within 500-char window)
- Ready for Phase 99 Plan 02 (if exists) or verification

## Self-Check: PASSED

- All 20 modified site guide files exist on disk
- SUMMARY.md exists at .planning/phases/99-diagnostic-to-guide-pipeline/99-01-SUMMARY.md
- Commit 9884280 (Task 1 CANVAS) found in git log
- Commit 25e2453 (Task 2 MICRO) found in git log
- All 20 files pass node -c syntax validation
- grep confirms 20+ files contain AUTOPILOT STRATEGY HINTS

---
*Phase: 99-diagnostic-to-guide-pipeline*
*Completed: 2026-03-22*
