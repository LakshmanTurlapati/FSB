---
phase: 65-slide-to-fit-captcha
plan: 01
subsystem: automation
tags: [cdp, drag, captcha, slider, ease-in-out, mcp, site-guide]

requires:
  - phase: 58-click-and-hold
    provides: CDP mouse event handler pattern (attach/dispatch/detach)
provides:
  - drag_variable_speed MCP tool with ease-in-out timing curve
  - cdpDragVariableSpeed content action wired to background handler
  - handleCDPMouseDragVariableSpeed CDP handler with quadratic speed curve
  - slider-captcha site guide with solveSliderCaptcha workflow
affects: [65-02-PLAN, slider-captcha-testing]

tech-stack:
  added: []
  patterns: [quadratic-ease-in-out-timing, variable-speed-drag, slider-captcha-dom-patterns]

key-files:
  created:
    - site-guides/utilities/slider-captcha.js
  modified:
    - background.js
    - content/actions.js
    - mcp-server/src/tools/manual.ts

key-decisions:
  - "Quadratic speed curve (1-4*(t-0.5)^2) instead of cubic easing -- simpler, produces desired slow-fast-slow pattern"
  - "Default 20 steps with 5ms min / 40ms max delay for smooth variable-speed curve"
  - "No modifier keys on variable-speed drag -- CAPTCHAs do not use shift/ctrl/alt"
  - "Minimum 5 steps enforced to prevent degenerate speed curves"
  - "Strategy A (drag_variable_speed) preferred, Strategy B (regular drag) as fallback"

patterns-established:
  - "Variable-speed CDP drag: speedFactor = 1 - 4*(t-0.5)^2 for delay interpolation between minDelayMs and maxDelayMs"
  - "Dual-strategy site guides: preferred tool + fallback tool with explicit trade-off documentation"

requirements-completed: [MICRO-09]

duration: 4min
completed: 2026-03-21
---

# Phase 65 Plan 01: Slider CAPTCHA Tooling Summary

**drag_variable_speed MCP tool with quadratic ease-in-out timing curve and slider-captcha site guide with solveSliderCaptcha workflow for GEETEST/Tencent/generic slider CAPTCHAs**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-21T12:31:45Z
- **Completed:** 2026-03-21T12:35:51Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Created drag_variable_speed MCP tool with quadratic ease-in-out timing curve (slow-fast-slow movement) for human-like drag behavior that evades anti-bot CAPTCHA detection
- Built complete tool chain: MCP tool (manual.ts) -> content action (actions.js) -> CDP handler (background.js) with speedFactor = 1 - 4*(t-0.5)^2
- Created comprehensive slider-captcha site guide covering GEETEST, Tencent Captcha, and generic slider CAPTCHA DOM patterns with solveSliderCaptcha workflow
- Wired site guide into background.js importScripts for MCP tool chain access

## Task Commits

Each task was committed atomically:

1. **Task 1: Create variable-speed CDP drag handler, content action, and MCP tool** - `45c64c1` (feat)
2. **Task 2: Create slider-captcha site guide and wire into background.js** - `888fdf9` (feat)

## Files Created/Modified
- `site-guides/utilities/slider-captcha.js` - Slider CAPTCHA site guide with solveSliderCaptcha workflow, GEETEST/Tencent/generic patterns and selectors
- `background.js` - handleCDPMouseDragVariableSpeed handler with quadratic ease-in-out timing, cdpMouseDragVariableSpeed message case, slider-captcha.js import
- `content/actions.js` - cdpDragVariableSpeed content action wired via chrome.runtime.sendMessage to background handler
- `mcp-server/src/tools/manual.ts` - drag_variable_speed MCP tool registration with startX/startY/endX/endY/steps/minDelayMs/maxDelayMs parameters

## Decisions Made
- Quadratic speed curve `1 - 4*(t-0.5)^2` chosen over cubic easing for simplicity while achieving the desired slow-fast-slow movement pattern
- Default parameters: 20 steps, 5ms minimum delay (peak speed center), 40ms maximum delay (slow edges) -- calibrated for human-like slider drag
- No modifier key support (shift/ctrl/alt) because CAPTCHAs do not use modifier keys during drag
- Minimum 5 steps enforced to prevent degenerate speed curves with too few data points
- drag_variable_speed as Strategy A (preferred) with regular drag as Strategy B (fallback) for CAPTCHAs that only check position, not speed profile

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- drag_variable_speed MCP tool ready for live testing in Plan 02
- Slider-captcha site guide with solveSliderCaptcha workflow loaded into extension
- Two interaction strategies documented for Plan 02 to test against a live CAPTCHA demo
- All selectors and patterns documented for GEETEST, Tencent, and generic slider CAPTCHAs

---
*Phase: 65-slide-to-fit-captcha*
*Completed: 2026-03-21*
