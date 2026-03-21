---
phase: 53-canvas-painted-button-click
plan: 01
subsystem: site-guides
tags: [canvas, html5, webgl, pixel-coordinates, click_at, browser-games, itch.io, phaser, game-engine]

# Dependency graph
requires:
  - phase: 50-google-solitaire-card-move
    provides: Browser Games site guide pattern and site-guides/games/ directory
  - phase: 51-photopea-background-removal
    provides: Prior art on fully canvas-rendered app interaction (Photopea diagnostic)
provides:
  - Canvas browser game site guide with pixel-coordinate click_at workflows
  - registerSiteGuide registration in background.js Browser Games section
  - Percentage-based coordinate calculation approach for viewport-independent canvas button targeting
affects: [53-02 live MCP test, future canvas game phases]

# Tech tracking
tech-stack:
  added: []
  patterns: [percentage-based canvas coordinate calculation, DOM launcher then canvas click_at two-phase interaction]

key-files:
  created: [site-guides/games/canvas-game.js]
  modified: [background.js]

key-decisions:
  - "Target itch.io HTML5 games as primary canvas game platform -- largest host of free browser games with iframe launcher pattern"
  - "Percentage-based button coordinates (50% width, 60% height for Play) for viewport independence vs fixed pixel values"
  - "Two-phase interaction: DOM click for host page Run game button, then click_at for canvas-painted buttons"

patterns-established:
  - "Canvas button coordinate estimation: express positions as percentage of canvas dimensions, compute pixels from bounding rect at runtime"
  - "Iframe offset awareness: when canvas is in iframe, add iframe bounding rect offset to canvas coordinates for click_at"

requirements-completed: [CANVAS-07]

# Metrics
duration: 3min
completed: 2026-03-21
---

# Phase 53 Plan 01: Canvas Browser Game Site Guide Summary

**Canvas browser game site guide with pixel-coordinate click_at workflows for fully canvas-rendered HTML5/WebGL game buttons**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-21T00:47:46Z
- **Completed:** 2026-03-21T00:50:42Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Created comprehensive canvas browser game site guide covering itch.io, Newgrounds, Kongregate, CrazyGames, and Poki
- Documented percentage-based coordinate calculation approach for viewport-independent canvas button targeting
- Included 3 workflows (launchGame, clickCanvasButton, verifyButtonClick) with step-by-step MCP tool usage
- Registered site guide in background.js Browser Games importScripts section

## Task Commits

Each task was committed atomically:

1. **Task 1: Research and create canvas browser game site guide** - `86e789e` (feat)
2. **Task 2: Register canvas game site guide in background.js** - `67a9acb` (feat)

## Files Created/Modified
- `site-guides/games/canvas-game.js` - Canvas browser game site guide with registerSiteGuide call, 6 URL patterns, 5 guidance sections, 12 selectors, 3 workflows, 9 warnings, 8 tool preferences
- `background.js` - Added importScripts entry for canvas-game.js in Browser Games section (line 134)

## Decisions Made
- Targeted itch.io HTML5 games as primary platform -- largest host of free, publicly accessible HTML5 browser games with a consistent iframe launcher pattern
- Used percentage-based button coordinates (e.g., 50% width, 60% height for Play button) instead of fixed pixel values for viewport independence
- Documented two-phase interaction pattern: DOM click for host page "Run game" launcher, then CDP click_at for canvas-painted buttons
- Included 6 URL patterns covering major browser game hosting platforms (itch.io, Newgrounds, Kongregate, CrazyGames, Poki, html5games)
- Based guidance on Photopea (Phase 51) and Excalidraw (Phase 48) prior art confirming that canvas-rendered UIs require pixel-coordinate interaction

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Site guide ready for live MCP testing in Plan 02
- Selectors are research-based and will need validation against actual game DOM in live test
- Percentage-based coordinate approach needs validation with a real itch.io game
- Canvas bounding rect calculation and iframe offset logic documented but not yet tested with actual CDP tools

## Self-Check: PASSED

- All created files exist on disk
- All commit hashes found in git log
- No missing artifacts

---
*Phase: 53-canvas-painted-button-click*
*Completed: 2026-03-21*
