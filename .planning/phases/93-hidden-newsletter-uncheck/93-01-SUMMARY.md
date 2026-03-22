---
phase: 93-hidden-newsletter-uncheck
plan: 01
subsystem: site-guides
tags: [dark-patterns, checkbox, newsletter, form-automation, dom-analysis, DARK-07]

# Dependency graph
requires:
  - phase: 88-hidden-cookie-reject
    provides: Cookie opt-out dark pattern site guide structure (DARK-02)
  - phase: 87-freeware-download-fake-button
    provides: Elimination-based DOM attribute detection pattern (DARK-01)
provides:
  - newsletter-uncheck.js site guide with uncheckNewsletterBeforeSubmit workflow
  - DARK-07 hidden pre-checked newsletter checkbox dark pattern guidance
  - 8 hiding technique counter-strategies documented
  - Checkbox classification criteria (newsletter vs consent vs ambiguous)
affects: [93-02-live-mcp-test, dark-pattern-utilities]

# Tech tracking
tech-stack:
  added: []
  patterns: [checkbox-scanning-classification, pre-checked-consent-detection, label-text-keyword-matching]

key-files:
  created: [site-guides/utilities/newsletter-uncheck.js]
  modified: [background.js]

key-decisions:
  - "Exhaustive DOM checkbox scanning as primary strategy -- scan ALL checkboxes then classify, rather than targeting specific selectors"
  - "Label text keyword matching for newsletter vs consent distinction -- newsletter/subscribe/marketing vs terms/privacy/agree"
  - "8 hiding techniques documented with per-technique counter-strategies using DOM-only analysis"

patterns-established:
  - "Checkbox classification pattern: scan all -> extract label -> classify by keywords -> check state -> act"
  - "Pre-checked consent detection: DOM attribute check for 'checked' property on newsletter-classified checkboxes"

requirements-completed: [DARK-07]

# Metrics
duration: 3min
completed: 2026-03-22
---

# Phase 93 Plan 01: Hidden Newsletter Uncheck Summary

**Newsletter-uncheck.js site guide with DARK-07 uncheckNewsletterBeforeSubmit workflow documenting 8 hiding techniques, checkbox classification strategy, and pre-checked newsletter detection using DOM-only analysis**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-22T10:39:22Z
- **Completed:** 2026-03-22T10:42:01Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments
- Created newsletter-uncheck.js site guide with registerSiteGuide call, DARK-07 guidance, selectors, 8-step workflow, 5 warnings, and 7 tool preferences
- Documented 8 hiding techniques for pre-checked newsletter checkboxes with per-technique DOM-based counter-strategies
- Defined checkbox identification strategy: scan all -> extract label text -> classify (newsletter/consent/ambiguous) -> check state -> scroll to reveal hidden
- Added importScripts entry in background.js Utilities section after premium-highlighting.js

## Task Commits

Each task was committed atomically:

1. **Task 1: Create newsletter-uncheck.js site guide with uncheckNewsletterBeforeSubmit workflow and DARK-07 guidance** - `27c634c` (feat)

**Plan metadata:** [pending final commit]

## Files Created/Modified
- `site-guides/utilities/newsletter-uncheck.js` - DARK-07 newsletter uncheck site guide with uncheckNewsletterBeforeSubmit workflow, 8 hiding techniques, checkbox classification, selectors, warnings
- `background.js` - Added importScripts entry for newsletter-uncheck.js in Utilities section (line 193)

## Decisions Made
- Exhaustive DOM checkbox scanning as primary strategy: scan ALL checkboxes then classify by label text, rather than targeting specific named selectors (mirrors DARK-01 elimination approach)
- Label text keyword matching for newsletter vs consent distinction: newsletter/subscribe/marketing keywords vs terms/privacy/agree keywords
- 8 hiding techniques documented (below-fold, legal burial, tiny font, grouped consent, ambiguous labeling, default pre-check, accordion hiding, double-negative phrasing) with DOM-only counter-strategies for each

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - all data sources and workflows are fully documented with concrete selectors and tool references.

## Next Phase Readiness
- Site guide created and registered, ready for Plan 02 live MCP test
- uncheckNewsletterBeforeSubmit workflow provides step-by-step instructions for MCP manual execution
- Target sites documented: automationexercise.com, practicesoftwaretesting.com, demo.opencart.com

## Self-Check: PASSED
- FOUND: site-guides/utilities/newsletter-uncheck.js
- FOUND: .planning/phases/93-hidden-newsletter-uncheck/93-01-SUMMARY.md
- FOUND: commit 27c634c

---
*Phase: 93-hidden-newsletter-uncheck*
*Completed: 2026-03-22*
