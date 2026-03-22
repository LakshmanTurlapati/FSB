---
phase: 94-buried-login-link
plan: 01
subsystem: site-guides
tags: [dark-patterns, DARK-08, login, signup, dom-analysis, text-classification, saas]

# Dependency graph
requires:
  - phase: 88-cookie-opt-out-hidden-reject
    provides: DARK-02 hidden reject pattern and cookie-opt-out.js utility guide structure
  - phase: 89-shuffled-cancel
    provides: DARK-03 text-based button identification pattern
  - phase: 90-camouflaged-close
    provides: DARK-04 3-tier DOM attribute detection ranking pattern
provides:
  - buried-login-link.js site guide with findBuriedLoginLink workflow and DARK-08 guidance
  - Login vs signup text classification strategy for DOM-only element identification
  - 8 documented hiding techniques with DOM counter-strategies
affects: [94-02-live-mcp-test, dark-pattern-guides]

# Tech tracking
tech-stack:
  added: []
  patterns: [text-based-element-classification, login-vs-signup-intent-analysis, multi-location-dom-scanning]

key-files:
  created:
    - site-guides/utilities/buried-login-link.js
  modified:
    - background.js

key-decisions:
  - "Text content and href attribute analysis as primary login link identification strategy -- no visual/style-based detection needed"
  - "8 hiding techniques documented with per-technique DOM counter-strategies"
  - "6-step classification strategy: scan all clickable elements, extract text and href, classify intent, check header/footer, expand menus, fallback to signup page"

patterns-established:
  - "Login vs signup intent classification: keyword lists for text content plus href pattern matching to distinguish login from signup elements"
  - "Multi-location scanning: header, footer, hamburger menu, and signup page fallback for buried elements"

requirements-completed: [DARK-08]

# Metrics
duration: 2min
completed: 2026-03-22
---

# Phase 94 Plan 01: Buried Login Link Site Guide Summary

**DARK-08 site guide with findBuriedLoginLink workflow using text-based login vs signup classification across header, footer, hamburger menu, and signup page fallback locations**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-22T11:00:12Z
- **Completed:** 2026-03-22T11:02:47Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments
- Created buried-login-link.js site guide with DARK-08 dark pattern avoidance guidance
- Documented 8 login link hiding techniques (small font/muted color, footer burial, hamburger menu hiding, "already have an account" de-emphasis, CTA vs text link asymmetry, conditional/scroll-gated rendering, tab/toggle hiding, redirect-first pattern)
- Implemented login vs signup classification strategy with 6-step workflow (scan, extract, classify, check locations, expand menus, fallback)
- Added findBuriedLoginLink workflow with 8 steps covering full navigate-scan-classify-click-verify cycle
- Documented 7 target SaaS sites (Dropbox, Slack, Notion, Canva, Figma, HubSpot, Mailchimp)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create buried-login-link.js site guide with findBuriedLoginLink workflow and DARK-08 guidance** - `43ba01d` (feat)

**Plan metadata:** pending (docs: complete plan)

## Files Created/Modified
- `site-guides/utilities/buried-login-link.js` - DARK-08 site guide with registerSiteGuide call, findBuriedLoginLink workflow, login/signup classification strategy, selectors, warnings, and toolPreferences
- `background.js` - Added importScripts entry for buried-login-link.js after newsletter-uncheck.js in Utilities section

## Decisions Made
- Text content and href attribute analysis as primary login link identification -- the AI has no vision, so semantic text classification is the only reliable method to distinguish login from signup elements regardless of visual prominence
- 8 hiding techniques documented with per-technique DOM counter-strategies to ensure coverage of all known buried login link patterns
- 6-step classification strategy (scan-extract-classify-check-expand-fallback) provides systematic approach immune to visual misdirection

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - all data sources are wired and functional.

## Next Phase Readiness
- Site guide ready for Plan 02 live MCP test
- findBuriedLoginLink workflow ready to execute against real SaaS homepage
- Selectors document login links by text, href, aria, class, header placement, and footer placement for comprehensive DOM scanning

## Self-Check: PASSED

- FOUND: site-guides/utilities/buried-login-link.js
- FOUND: .planning/phases/94-buried-login-link/94-01-SUMMARY.md
- FOUND: commit 43ba01d
- FOUND: background.js importScripts entry

---
*Phase: 94-buried-login-link*
*Completed: 2026-03-22*
