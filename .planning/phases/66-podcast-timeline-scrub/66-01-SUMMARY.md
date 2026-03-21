---
phase: 66-podcast-timeline-scrub
plan: 01
subsystem: site-guides
tags: [podcast, audio, timeline, scrub, seek, progress-bar, click_at, drag, media]

# Dependency graph
requires:
  - phase: 57-volume-slider
    provides: "HTML5 video player volume slider site guide pattern and Media category in background.js"
provides:
  - "Podcast audio player site guide with scrubTimeline workflows (click and drag methods)"
  - "Timeline position calculation formula for seeking to specific timestamps"
  - "Platform-specific selectors for 12 podcast services"
  - "background.js wiring for podcast-player site guide in Media section"
affects: [66-02, media-automation, podcast-scrub-mcp-test]

# Tech tracking
tech-stack:
  added: []
  patterns: ["registerSiteGuide for audio timeline seeking with click_at coordinate calculation"]

key-files:
  created: ["site-guides/media/podcast-player.js"]
  modified: ["background.js"]

key-decisions:
  - "12 podcast platform patterns covering major hosts and aggregators"
  - "5-second tolerance (14:17-14:27) for timeline scrub verification due to pixel granularity"
  - "Click-on-progress-bar as preferred method, drag-thumb as fallback"

patterns-established:
  - "Audio timeline position calculation: targetX = trackLeft + (targetSeconds / totalSeconds) * trackWidth"
  - "Time display verification using text matching against MM:SS format with tolerance range"

requirements-completed: [MICRO-10]

# Metrics
duration: 2min
completed: 2026-03-21
---

# Phase 66 Plan 01: Podcast Timeline Scrub Site Guide Summary

**Podcast audio timeline scrub site guide with click_at/drag workflows for seeking to 14:22 (862s), covering 12 podcast platforms with 5-second tolerance verification**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-21T12:51:23Z
- **Completed:** 2026-03-21T12:53:32Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Created podcast-player.js site guide with registerSiteGuide following exact video-player.js pattern
- Three complete workflows: scrubTimelineByClick (6 steps), scrubTimelineByDrag (7 steps), fullTimelineScrubTest (10 steps)
- Timeline position calculation formula documented: targetX = trackLeft + (862 / totalDurationSeconds) * trackWidth
- 12 podcast platform patterns: Podbean, Buzzsprout, Spreaker, Anchor.fm, Transistor.fm, Simplecast, Apple Podcasts, Spotify, SoundCloud, Overcast, Pocketcasts, Castbox
- Wired into background.js importScripts in Media section (alphabetical order before video-player.js)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create podcast-player site guide with timeline scrub selectors and workflows** - `6d5badc` (feat)
2. **Task 2: Wire podcast-player site guide into background.js importScripts** - `a866f7e` (chore)

## Files Created/Modified
- `site-guides/media/podcast-player.js` - Podcast audio player site guide with scrubTimeline workflows, platform selectors, time display verification, 8 warnings
- `background.js` - Added importScripts entry for podcast-player.js in Media section

## Decisions Made
- Included 12 podcast platform regex patterns (3 more than the minimum 3 required) for broad coverage
- Used 5-second tolerance window (14:17-14:27) matching CONTEXT.md specification for pixel granularity on narrow progress bars
- Placed podcast-player.js alphabetically before video-player.js in Media section import order
- Added Overcast, Pocketcasts, and Castbox as additional patterns beyond the plan specification for wider podcast app coverage

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Known Stubs

None - all workflows, selectors, and guidance are fully specified.

## Next Phase Readiness
- Podcast-player site guide ready for Plan 02 live MCP test
- scrubTimeline workflows document the complete click_at and drag interaction sequences
- Ready to test against a real podcast page with audio timeline

---
*Phase: 66-podcast-timeline-scrub*
*Completed: 2026-03-21*
