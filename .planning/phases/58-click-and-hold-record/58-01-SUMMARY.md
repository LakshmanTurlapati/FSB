---
phase: 58-click-and-hold-record
plan: 01
subsystem: tools
tags: [cdp, click-and-hold, voice-recorder, site-guide, mcp]

requires:
  - phase: 57-volume-slider-precision
    provides: Media category section in background.js, CDP tool chain patterns
provides:
  - click_and_hold MCP tool with mousePressed -> holdMs delay -> mouseReleased pattern
  - Voice recorder site guide with holdToRecord and toggleToRecord workflows
  - Tool chain wired through manual.ts -> content/actions.js -> background.js
affects: [58-02, micro-edge-cases, mcp-tools]

tech-stack:
  added: []
  patterns: [CDP click-and-hold with timed delay between press and release]

key-files:
  created: [site-guides/media/voice-recorder.js]
  modified: [mcp-server/src/tools/manual.ts, content/actions.js, background.js]

key-decisions:
  - "Dedicated click_and_hold tool instead of reusing drag with same start/end coordinates -- cleaner semantics and no unnecessary mouseMoved events"
  - "Default holdMs of 5000ms (5 seconds) matching MICRO-02 requirement"
  - "No modifier key support on click_and_hold (unlike click_at) -- long-press interactions rarely combine with shift/ctrl/alt"

patterns-established:
  - "CDP click-and-hold pattern: attach debugger -> mousePressed -> setTimeout(holdMs) -> mouseReleased -> detach"

requirements-completed: [MICRO-02]

duration: 3min
completed: 2026-03-21
---

# Phase 58 Plan 01: Click-and-Hold CDP Tool and Voice Recorder Site Guide Summary

**click_and_hold CDP tool wired through all three MCP layers (manual.ts, actions.js, background.js) with mousePressed -> holdMs delay -> mouseReleased, plus voice recorder site guide with dual record workflows**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-21T08:10:11Z
- **Completed:** 2026-03-21T08:13:04Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Added click_and_hold MCP tool with x/y/holdMs parameters across all three layers of the tool chain
- Created voice recorder site guide with holdToRecord (click_and_hold 5s) and toggleToRecord (click_at start/stop) workflows
- Site guide covers onlinevoicerecorder.com, vocaroo.com, rev.com/voice-recorder with comprehensive selectors and 7 warnings
- MCP server builds cleanly with new tool

## Task Commits

Each task was committed atomically:

1. **Task 1: Add click_and_hold CDP tool across MCP chain** - `ac4075d` (feat)
2. **Task 2: Create voice recorder site guide and register in background.js** - `cfb7c31` (feat)

## Files Created/Modified
- `mcp-server/src/tools/manual.ts` - Added click_and_hold server.tool registration with x, y, holdMs params
- `content/actions.js` - Added cdpClickAndHold tool routing to background via cdpMouseClickAndHold message
- `background.js` - Added case routing for cdpMouseClickAndHold + handleCDPMouseClickAndHold handler + voice-recorder.js importScripts
- `site-guides/media/voice-recorder.js` - New site guide with registerSiteGuide for voice recorder sites

## Decisions Made
- Dedicated click_and_hold tool rather than reusing drag with same start/end coordinates -- avoids unnecessary mouseMoved events and provides cleaner semantics for hold interactions
- Default holdMs of 5000ms matching the MICRO-02 requirement for 5-second recording
- No modifier key support on click_and_hold -- long-press interactions do not typically combine with shift/ctrl/alt modifiers
- Toggle-to-record as default assumption for web voice recorders since most web-based recorders use click-to-start/click-to-stop pattern

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- click_and_hold tool ready for live MCP testing in Plan 02
- Voice recorder site guide registered and loadable
- Both holdToRecord and toggleToRecord workflows documented for the test agent
- Microphone permission will need manual granting during live test

## Self-Check: PASSED

All files verified present. All commit hashes found in git log.

---
*Phase: 58-click-and-hold-record*
*Completed: 2026-03-21*
