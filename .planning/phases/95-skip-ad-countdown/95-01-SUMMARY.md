---
phase: 95-skip-ad-countdown
plan: 01
subsystem: site-guides
tags: [dark-pattern, video-ads, skip-ad, wait-for-element, temporal-gating, youtube, dailymotion, twitch, jwplayer, vast, vpaid]

# Dependency graph
requires:
  - phase: 90-camouflaged-close
    provides: DARK-04 DOM attribute analysis pattern for close button detection
  - phase: 91-adblocker-bypass
    provides: DARK-05 DOM removal/CSS override pattern for ad modals
provides:
  - skip-ad-countdown.js site guide with DARK-09 temporal gating workflow
  - skipAdCountdown 6-step workflow (navigate, detect ad, identify platform, wait, click, verify)
  - Platform-specific skip button selectors for 6 video ad platforms
  - background.js importScripts registration for skip-ad-countdown.js
affects: [95-02, video-player, dark-patterns]

# Tech tracking
tech-stack:
  added: []
  patterns: [wait_for_element polling for temporal gating, platform-specific selector objects, 4-step detection strategy (detect-wait-click-verify)]

key-files:
  created: [site-guides/utilities/skip-ad-countdown.js]
  modified: [background.js]

key-decisions:
  - "wait_for_element with 15000ms timeout as primary temporal gating counter-strategy"
  - "DOM-based click (CSS selector) over click_at (coordinates) for viewport-independent skip button interaction"
  - "6 platform patterns documented: YouTube, Dailymotion, Twitch, JW Player, generic VAST/VPAID, Vimeo OTT"

patterns-established:
  - "Temporal gating detection: wait_for_element polls for element state transitions (absent->present, hidden->visible, disabled->enabled)"
  - "4-step skip button detection: detect ad playing, wait for skip button, click skip, verify dismissed"

requirements-completed: [DARK-09]

# Metrics
duration: 3min
completed: 2026-03-22
---

# Phase 95 Plan 01: Skip Ad Countdown Summary

**DARK-09 skip-ad-countdown site guide with temporal gating workflow using wait_for_element to detect skip button appearance after pre-roll ad countdown, covering YouTube/Dailymotion/Twitch/JW Player/VAST/Vimeo**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-22T11:21:20Z
- **Completed:** 2026-03-22T11:24:15Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments
- Created skip-ad-countdown.js site guide with comprehensive DARK-09 dark pattern documentation explaining temporal gating via forced countdown
- Implemented skipAdCountdown workflow with 6 steps: navigate to video, detect ad overlay, identify platform, wait for skip button, click skip button, verify ad dismissed
- Documented platform-specific selectors for 6 video ad platforms (YouTube, Dailymotion, Twitch, JW Player, generic VAST/VPAID, Vimeo OTT)
- Documented skip button state transitions (absent/hidden/disabled during countdown -> present/visible/enabled after countdown)
- Added wait_for_element strategy with 15000ms timeout and 500ms poll interval as primary counter-strategy
- Registered importScripts entry in background.js Utilities section

## Task Commits

Each task was committed atomically:

1. **Task 1: Create skip-ad-countdown.js site guide with skipAdCountdown workflow and DARK-09 guidance** - `ce3a5ea` (feat)

## Files Created/Modified
- `site-guides/utilities/skip-ad-countdown.js` - DARK-09 site guide with skipAdCountdown workflow, platform-specific selectors, and temporal gating detection strategy
- `background.js` - Added importScripts entry for skip-ad-countdown.js in Utilities section (line 195, after buried-login-link.js)

## Decisions Made
- wait_for_element with 15000ms timeout chosen as primary temporal gating counter-strategy -- covers 5-second, 6-second, and longer countdowns with margin
- DOM-based click (CSS selector) over click_at (coordinates) for skip button interaction -- skip button position varies by player size, ad format, and viewport
- 6 video ad platforms documented with platform-specific selectors: YouTube (.ytp-ad-skip-button), Dailymotion (button[aria-label="Skip Ad"]), Twitch (data-a-target), JW Player (.jw-skip-button), generic VAST/VPAID (class*="skip"), Vimeo OTT (button.skip-button)
- Non-skippable ad fallback: if wait_for_element times out after 15 seconds, poll for natural ad completion every 5 seconds up to 60 seconds

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Site guide ready for Plan 02 live MCP test
- skipAdCountdown workflow provides structured 6-step approach for test execution
- Platform-specific selectors ready for validation against live video ad DOM

## Self-Check: PASSED

- FOUND: site-guides/utilities/skip-ad-countdown.js
- FOUND: commit ce3a5ea
- FOUND: 95-01-SUMMARY.md

---
*Phase: 95-skip-ad-countdown*
*Completed: 2026-03-22*
