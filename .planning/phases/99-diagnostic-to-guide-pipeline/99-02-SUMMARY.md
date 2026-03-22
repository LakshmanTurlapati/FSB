---
phase: 99-diagnostic-to-guide-pipeline
plan: 02
subsystem: ai-prompting
tags: [site-guides, autopilot-hints, scroll-diagnostics, context-diagnostics, prompt-engineering]

# Dependency graph
requires:
  - phase: 99-01
    provides: "CANVAS/MICRO category site guide enrichments and the enrichment pattern"
provides:
  - "20 site guide files enriched with SCROLL and CONTEXT autopilot strategy hints"
  - "Hint blocks prepended at top of guidance strings, visible in 500-char continuation window"
  - "pdf-editor.js has both CANVAS-09 and CONTEXT-03 hint blocks coexisting"
affects: [autopilot-prompt-refinement, autopilot-validation]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "AUTOPILOT STRATEGY HINTS block prepended to guidance template literal"
    - "[scroll] prefix for scroll-specific hints, [context] prefix for context-management hints"
    - "3-5 hints per guide, each under ~120 chars, total block under ~400 chars"

key-files:
  modified:
    - site-guides/social/twitter.js
    - site-guides/ecommerce/amazon.js
    - site-guides/coding/github.js
    - site-guides/social/reddit.js
    - site-guides/productivity/pdf-viewer.js
    - site-guides/news/hackernews.js
    - site-guides/travel/airbnb.js
    - site-guides/social/tiktok.js
    - site-guides/productivity/pricing-table.js
    - site-guides/news/news-feed.js
    - site-guides/sports/live-scores.js
    - site-guides/coding/observable.js
    - site-guides/productivity/pdf-editor.js
    - site-guides/travel/google-travel.js
    - site-guides/ecommerce/demo-store.js
    - site-guides/utilities/support-chatbot.js
    - site-guides/utilities/two-factor-auth.js
    - site-guides/productivity/google-docs.js
    - site-guides/productivity/crm-hr-cross-ref.js
    - site-guides/utilities/session-expiry.js

key-decisions:
  - "Distilled only actionable autopilot recommendations from diagnostics, not tool gap proposals"
  - "Each hint tagged with [scroll] or [context] prefix for category identification"
  - "CONTEXT-03 hints prepended before existing CANVAS-09 hints in pdf-editor.js"

patterns-established:
  - "Hint block format: AUTOPILOT STRATEGY HINTS (from v0.9.7 diagnostic CATEGORY-NN)"
  - "Category prefix tagging: [scroll] for infinite scroll, [context] for context management"

requirements-completed: [PROMPT-03]

# Metrics
duration: 5min
completed: 2026-03-22
---

# Phase 99 Plan 02: SCROLL and CONTEXT Diagnostic-to-Guide Enrichment Summary

**20 site guides enriched with distilled autopilot strategy hints from SCROLL (phases 67-76) and CONTEXT (phases 77-86) diagnostic reports, prepended within the 500-char continuation prompt window**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-22T13:50:39Z
- **Completed:** 2026-03-22T13:55:52Z
- **Tasks:** 2
- **Files modified:** 20

## Accomplishments
- 10 SCROLL-category site guides enriched with scroll-specific strategy hints (virtualized DOM handling, pagination detection, deduplication strategies, scroll timing, auth wall detection)
- 10 CONTEXT-category site guides enriched with context-management hints (2-snapshot retention, compact tracking, cross-site data transfer, multi-tab coordination, session recovery)
- pdf-editor.js verified with both CANVAS-09 (Plan 01) and CONTEXT-03 (this plan) hint blocks coexisting within the 500-char guidance window
- All 20 files pass node -c syntax validation
- All hint blocks confirmed at character position 0 of guidance strings (within 500-char continuation window)

## Task Commits

Each task was committed atomically:

1. **Task 1: Enrich SCROLL category site guides (phases 67-76)** - `25e2453` (feat)
2. **Task 2: Enrich CONTEXT category site guides (phases 77-86)** - `2ab72dc` (feat)

## Files Created/Modified
- `site-guides/social/twitter.js` - SCROLL-01 hints: permalink dedup, scroll timing, ad filtering
- `site-guides/ecommerce/amazon.js` - SCROLL-02 hints: pagination vs scroll, ASIN dedup, CAPTCHA detection
- `site-guides/coding/github.js` - SCROLL-03 hints: contributions tab, include-fragment wait, datetime parsing
- `site-guides/social/reddit.js` - SCROLL-04 hints: old.reddit.com, expansion-first strategy, auth gating
- `site-guides/productivity/pdf-viewer.js` - SCROLL-05 hints: page input navigation, textLayer extraction
- `site-guides/news/hackernews.js` - SCROLL-06 hints: single-page loading, comment counting
- `site-guides/travel/airbnb.js` - SCROLL-07 hints: client-rendered pins, CDP drag panning
- `site-guides/social/tiktok.js` - SCROLL-08 hints: fully client-rendered SPA, search/tag fallback
- `site-guides/productivity/pricing-table.js` - SCROLL-09 hints: server-rendered Notion, CSS Module matching
- `site-guides/news/news-feed.js` - SCROLL-10 hints: relative timestamps, __NEXT_DATA__ JSON
- `site-guides/sports/live-scores.js` - CONTEXT-01 hints: 2-snapshot retention, embedded JSON
- `site-guides/coding/observable.js` - CONTEXT-02 hints: targeted cell reads, tinker mode
- `site-guides/productivity/pdf-editor.js` - CONTEXT-03 hints: immediate extraction, 300-char excerpts (coexists with CANVAS-09)
- `site-guides/travel/google-travel.js` - CONTEXT-04 hints: sequential tab opening, price-only extraction
- `site-guides/ecommerce/demo-store.js` - CONTEXT-05 hints: clear_input before correction, dual checkpoint
- `site-guides/utilities/support-chatbot.js` - CONTEXT-06 hints: compact turn tracking, deferred history read
- `site-guides/utilities/two-factor-auth.js` - CONTEXT-07 hints: tab ID capture, open_tab preservation
- `site-guides/productivity/google-docs.js` - CONTEXT-08 hints: Ctrl+F delegation, SKIP-AUTH
- `site-guides/productivity/crm-hr-cross-ref.js` - CONTEXT-09 hints: batch extraction, HR caching
- `site-guides/utilities/session-expiry.js` - CONTEXT-10 hints: compact pre-expiry state, task resumption

## Decisions Made
- Distilled only actionable autopilot recommendations from each diagnostic (not tool gap proposals or proposed new tools)
- Tagged hints with [scroll] or [context] prefix per category for easy identification
- CONTEXT-03 hints prepended before existing CANVAS-09 block in pdf-editor.js so both coexist
- Each hint capped at ~120 chars, 5 hints per guide, keeping total added content under ~400 chars per file

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Known Stubs

None - all 20 site guide files contain complete, functional hint blocks.

## Next Phase Readiness
- All 20 SCROLL + CONTEXT diagnostic recommendations now embedded in their corresponding site guides
- Combined with Plan 01 (CANVAS + MICRO categories), the full set of 50 v0.9.7 diagnostic reports have been distilled into site guide strategy hints
- Ready for Plan 03 (if any) or next phase of autopilot refinement

---
*Phase: 99-diagnostic-to-guide-pipeline*
*Completed: 2026-03-22*

## Self-Check: PASSED
- All 20 site guide files: FOUND
- SUMMARY.md: FOUND
- Task 1 commit (25e2453): FOUND
- Task 2 commit (2ab72dc): FOUND
