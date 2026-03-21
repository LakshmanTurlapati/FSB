---
phase: 76-news-site-date-stop-scroll
plan: 01
subsystem: site-guides
tags: [news-feed, infinite-scroll, date-detection, bbc, cnn, reuters, scroll-stop, timestamps]

# Dependency graph
requires:
  - phase: 72-hn-thread-expand
    provides: News site guide category and hackernews.js registerSiteGuide pattern
provides:
  - News feed site guide (news-feed.js) with scrollToYesterdaysArticles workflow
  - Date detection strategy for article timestamps (datetime, relative text, absolute text)
  - 21 selectors for generic + BBC/CNN/Reuters article feeds
  - background.js import wiring for news-feed.js
affects: [76-02-PLAN (live MCP test), future news site automation tasks]

# Tech tracking
tech-stack:
  added: []
  patterns: [date-based scroll stop loop, article timestamp parsing, deduplication by href]

key-files:
  created: [site-guides/news/news-feed.js]
  modified: [background.js]

key-decisions:
  - "BBC News as primary target with CNN and Reuters as fallback targets"
  - "datetime attribute parsing preferred over relative text for date comparison accuracy"
  - "Article link href as unique deduplication key across scroll batches"
  - "600-800px scroll increments for news feeds (taller article cards than pricing rows)"

patterns-established:
  - "Scroll-compare-stop loop: scroll, wait for DOM stable, read articles, parse dates, stop when older-than-target"
  - "Multi-format date detection: ISO 8601 datetime preferred, data attributes fallback, visible text last resort"

requirements-completed: [SCROLL-10]

# Metrics
duration: 2min
completed: 2026-03-21
---

# Phase 76 Plan 01: News Feed Date-Stop Scroll Summary

**News feed site guide with 15-step scrollToYesterdaysArticles workflow, 21 selectors (generic + BBC/CNN/Reuters), and datetime-preferred date detection for SCROLL-10**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-21T22:08:58Z
- **Completed:** 2026-03-21T22:11:29Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Created news-feed.js site guide with scrollToYesterdaysArticles 15-step workflow covering navigation, date detection, scroll-compare-stop loop, and article extraction
- Documented date detection strategy with 3 tiers: datetime attributes (preferred), data attributes (fallback), visible text parsing (last resort)
- Added 21 selectors covering generic article feed patterns plus BBC-specific, CNN-specific, and Reuters-specific selectors
- Wired news-feed.js into background.js News section after hackernews.js

## Task Commits

Each task was committed atomically:

1. **Task 1: Create news-feed.js site guide** - `1c3bc16` (feat)
2. **Task 2: Wire news-feed.js import into background.js** - `3bf6dec` (chore)

## Files Created/Modified
- `site-guides/news/news-feed.js` - News feed site guide with registerSiteGuide call, scrollToYesterdaysArticles workflow, extractArticleDates workflow, 21 selectors, 8 warnings, toolPreferences
- `background.js` - Added importScripts for news-feed.js in News section after hackernews.js (line 171)

## Decisions Made
- BBC News (bbc.com/news) selected as primary target due to well-structured article feed with time[datetime] elements in ISO 8601 format
- CNN and Reuters as fallback targets covering different timestamp patterns (relative text, absolute dates)
- datetime attribute parsing preferred over relative text ("2 hours ago") because relative text requires current time knowledge and timezone handling
- Article link href as deduplication key -- each article has a distinct URL path, reliable across scroll batches
- 600-800px scroll increments recommended for news feeds (article cards are taller than pricing table rows from Phase 75)
- Day-granularity date comparison to avoid timezone edge cases between site local time and user local time

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- News feed site guide complete and wired, ready for Plan 02 live MCP test
- Plan 02 will test scrollToYesterdaysArticles workflow on BBC News via MCP manual tools
- Cookie consent banner dismissal documented in warnings and workflow step 3

## Self-Check: PASSED

- FOUND: site-guides/news/news-feed.js
- FOUND: 76-01-SUMMARY.md
- FOUND: 1c3bc16 (Task 1 commit)
- FOUND: 3bf6dec (Task 2 commit)

---
*Phase: 76-news-site-date-stop-scroll*
*Completed: 2026-03-21*
