---
phase: 82-support-chatbot-15-turn-summary
plan: 01
subsystem: site-guides
tags: [chatbot, iframe, context-retention, 15-turn, support-widget, CONTEXT-06]

# Dependency graph
requires:
  - phase: 62-carousel-horizontal-scroll
    provides: Utilities site guide category and registerSiteGuide pattern
provides:
  - support-chatbot.js site guide with chatbot15TurnSummary workflow and CONTEXT-06 guidance
  - iframe-aware chatbot widget interaction strategies (DOM preferred, CDP fallback)
  - 15-turn conversation strategy with per-turn message script and context bloat mitigation
affects: [82-02 live MCP test, future chatbot automation phases]

# Tech tracking
tech-stack:
  added: []
  patterns: [multi-turn context retention with compact turn tracking, iframe detection with CDP fallback strategy]

key-files:
  created: [site-guides/utilities/support-chatbot.js]
  modified: [background.js]

key-decisions:
  - "10 chatbot provider URL patterns covering major platforms (Intercom, Zendesk, Drift, Crisp, Tawk.to, Freshdesk, HubSpot, Tidio, LiveChat, HelpScout)"
  - "Compact turn tracking under 3000 characters for 15-turn conversation to prevent context bloat"
  - "Three-strategy iframe handling: DOM tools first, CDP click_at/press_key fallback, standalone URL last resort"
  - "Tidio.com as primary target (uses own chatbot widget, bot-driven, no auth required)"

patterns-established:
  - "Multi-turn conversation tracking: compact {turn, sent, botResponded} records instead of full DOM reads per turn"
  - "First instruction identification: scroll to top after completion, read first 3-4 bot messages, extract first actionable guidance"

requirements-completed: [CONTEXT-06]

# Metrics
duration: 2min
completed: 2026-03-22
---

# Phase 82 Plan 01: Support Chatbot Site Guide Summary

**Support chatbot site guide with 13-step chatbot15TurnSummary workflow, CONTEXT-06 15-turn conversation strategy, iframe-aware widget detection, and context bloat mitigation for multi-turn exchanges**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-22T06:47:27Z
- **Completed:** 2026-03-22T06:49:55Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Created support-chatbot.js with registerSiteGuide containing 10 chatbot provider URL patterns
- chatbot15TurnSummary workflow with 13 steps covering full lifecycle: navigate, detect widget, open chat, iframe check, 15 turns in batches, verify count, scroll to top, read first messages, extract first instruction, report
- CONTEXT-06 guidance section documenting: target selection with 5 specific sites, widget detection, 15-turn message strategy, first instruction identification, verification criteria, context bloat mitigation
- Wired import into background.js Utilities section in alphabetical order after slider-captcha.js

## Task Commits

Each task was committed atomically:

1. **Task 1: Create support-chatbot.js site guide** - `6797161` (feat)
2. **Task 2: Wire support-chatbot.js import into background.js** - `69095d3` (chore)

## Files Created/Modified
- `site-guides/utilities/support-chatbot.js` - New site guide with chatbot15TurnSummary workflow, CONTEXT-06 guidance, 9 selector groups, 8 warnings, 8 tool preferences
- `background.js` - Added importScripts for support-chatbot.js in Utilities section

## Decisions Made
- 10 chatbot provider URL patterns covering Intercom, Zendesk, Drift, Crisp, Tawk.to, Freshdesk, HubSpot, Tidio, LiveChat, HelpScout
- Compact turn tracking (under 3000 chars for 15 turns) to prevent context bloat -- only read full DOM after all 15 turns complete
- Three-strategy iframe handling: DOM tools first (preferred), CDP click_at/press_key fallback (iframe-isolated), standalone URL (last resort)
- Tidio.com as primary target site (uses own chatbot widget, bot-driven responses, no auth required)
- Per-turn message script covering product help, pricing, features, integration, support, setup, billing, security, customization, enterprise, migration topics

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Site guide ready for Plan 02 live MCP test execution
- chatbot15TurnSummary workflow provides step-by-step guidance for MCP manual tool test
- Tidio.com primary target with 4 fallback chatbot provider sites
- iframe detection and CDP fallback documented for embedded widget handling

## Self-Check: PASSED

- FOUND: site-guides/utilities/support-chatbot.js
- FOUND: .planning/phases/82-support-chatbot-15-turn-summary/82-01-SUMMARY.md
- FOUND: 6797161 (Task 1 commit)
- FOUND: 69095d3 (Task 2 commit)

---
*Phase: 82-support-chatbot-15-turn-summary*
*Completed: 2026-03-22*
