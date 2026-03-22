---
phase: 99-diagnostic-to-guide-pipeline
plan: 03
subsystem: site-guides
tags: [dark-patterns, autopilot-hints, diagnostic-pipeline, site-guides, countermeasures]

# Dependency graph
requires:
  - phase: 87-96 (DARK-01 through DARK-10 diagnostic reports)
    provides: Autopilot recommendations from MCP edge case validation of 10 dark pattern categories
  - phase: 99-01 and 99-02
    provides: Site guide files already created with guidance, selectors, workflows
provides:
  - 10 dark pattern site guides enriched with AUTOPILOT STRATEGY HINTS prepended at top of guidance strings
  - Dark pattern countermeasure intelligence visible in continuation hybrid prompts (first 500 chars)
affects: [ai-integration, autopilot-prompts, continuation-hybrid-prompt]

# Tech tracking
tech-stack:
  added: []
  patterns: [AUTOPILOT STRATEGY HINTS prepended at top of guidance template literals with [dark] tag prefix]

key-files:
  modified:
    - site-guides/utilities/freeware-download.js
    - site-guides/utilities/cookie-opt-out.js
    - site-guides/utilities/shuffled-cancel.js
    - site-guides/utilities/camouflaged-close.js
    - site-guides/utilities/adblocker-bypass.js
    - site-guides/utilities/premium-highlighting.js
    - site-guides/utilities/newsletter-uncheck.js
    - site-guides/utilities/buried-login-link.js
    - site-guides/utilities/skip-ad-countdown.js
    - site-guides/utilities/anti-scrape-text-extraction.js

key-decisions:
  - "AUTOPILOT STRATEGY HINTS placed on same line as guidance backtick for guaranteed first-500-chars visibility"
  - "5 hints per guide with [dark] prefix tag for dark pattern countermeasure categorization"
  - "Hints distilled from full diagnostic Autopilot Recommendations (10 recs each) to max 5 actionable items"

patterns-established:
  - "AUTOPILOT STRATEGY HINTS block format: header line with DARK-NN ref, 5 [dark]-tagged countermeasure hints, blank line separator before existing content"

requirements-completed: [PROMPT-03]

# Metrics
duration: 4min
completed: 2026-03-22
---

# Phase 99 Plan 03: DARK Pattern Guide Enrichment Summary

**10 dark pattern site guides enriched with AUTOPILOT STRATEGY HINTS from diagnostic DARK-01 through DARK-10 reports -- countermeasure intelligence prepended at top of guidance strings for continuation prompt visibility**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-22T13:50:42Z
- **Completed:** 2026-03-22T13:55:02Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- Enriched 5 dark pattern site guides (DARK-01 through DARK-05) with distilled countermeasure hints from phases 87-91 diagnostic reports
- Enriched 5 dark pattern site guides (DARK-06 through DARK-10) with distilled countermeasure hints from phases 92-96 diagnostic reports
- All 10 hint blocks appear within the first 500 chars of guidance strings, ensuring visibility in ai-integration.js continuation hybrid prompt truncation window
- All 10 files pass node -c syntax validation
- Each guide has exactly 5 concise [dark]-tagged hints distilled from 10-recommendation diagnostic sections

## Task Commits

Each task was committed atomically:

1. **Task 1: Enrich DARK-01 through DARK-05 guides** - `1f507e7` (feat)
2. **Task 2: Enrich DARK-06 through DARK-10 guides** - `da92026` (feat)

## Files Modified
- `site-guides/utilities/freeware-download.js` - DARK-01 hints: verify href domain, eliminate iframe buttons, check parent ad containers
- `site-guides/utilities/cookie-opt-out.js` - DARK-02 hints: never click Accept, 3-tier reject path, iframe CMP handling
- `site-guides/utilities/shuffled-cancel.js` - DARK-03 hints: ignore position, classify by text, handle confirmshaming
- `site-guides/utilities/camouflaged-close.js` - DARK-04 hints: aria-label detection, 3-tier strategy, decoy filtering
- `site-guides/utilities/adblocker-bypass.js` - DARK-05 hints: no close button exists, CSS override bypass, restore scroll
- `site-guides/utilities/premium-highlighting.js` - DARK-06 hints: numeric price extraction, ignore badges, compare all tiers
- `site-guides/utilities/newsletter-uncheck.js` - DARK-07 hints: scan all inputs, classify by label, skip consent boxes
- `site-guides/utilities/buried-login-link.js` - DARK-08 hints: find minority login element, check href patterns
- `site-guides/utilities/skip-ad-countdown.js` - DARK-09 hints: wait_for_element with timeout, handle sequential ads
- `site-guides/utilities/anti-scrape-text-extraction.js` - DARK-10 hints: direct DOM extraction bypasses all JS/CSS protections

## Decisions Made
- Placed AUTOPILOT STRATEGY HINTS on same line as guidance backtick (diff=0) to guarantee appearance in first 500 chars of continuation prompt
- Limited to 5 hints per guide (under 400 chars each) to stay within the 500-char truncation window while leaving room for the existing intelligence header
- Tagged all hints with [dark] prefix per plan specification for dark pattern countermeasure categorization
- Distilled 10-recommendation diagnostic sections down to the 5 most actionable autopilot-specific countermeasures per category

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - all 10 files contain complete, actionable hints with no placeholder content.

## Next Phase Readiness
- All 10 dark pattern site guides now carry diagnostic-validated countermeasure intelligence
- Combined with Plans 01 (canvas/micro-interaction/scroll/context categories) and 02 (same), this completes the full diagnostic-to-guide pipeline for all 50 MCP edge case categories
- Autopilot now has access to dark pattern countermeasure hints in continuation prompts when operating on sites matching these guide patterns

## Self-Check: PASSED

All 10 modified files exist. SUMMARY.md created. Both task commits (1f507e7, da92026) verified in git log.

---
*Phase: 99-diagnostic-to-guide-pipeline*
*Completed: 2026-03-22*
