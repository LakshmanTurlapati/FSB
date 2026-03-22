---
phase: 88-cookie-opt-out-hidden-reject
plan: 01
subsystem: site-guides
tags: [cookie-consent, dark-patterns, GDPR, CMP, OneTrust, Quantcast, Cookiebot, TrustArc, Sourcepoint, Didomi]

requires:
  - phase: 87-freeware-download-ad-avoidance
    provides: DARK-01 freeware download site guide structure and Utilities category pattern
provides:
  - cookie-opt-out.js site guide with rejectAllCookies workflow and DARK-02 guidance
  - CMP platform detection for 5 consent management platforms
  - 3-tier hidden reject strategy (direct reject, preferences reject, toggle-and-save)
  - Multi-language button text matching for EU news sites
affects: [88-02-PLAN, dark-pattern-testing, cookie-consent-automation]

tech-stack:
  added: []
  patterns: [3-tier reject strategy, CMP platform detection by DOM container, iframe-based consent banner handling]

key-files:
  created: [site-guides/utilities/cookie-opt-out.js]
  modified: [background.js]

key-decisions:
  - "5 CMP platforms documented with DOM selectors: OneTrust, Quantcast, Cookiebot, TrustArc, custom generic"
  - "3-tier hidden reject strategy: Tier 1 direct reject, Tier 2 reject in preferences, Tier 3 toggle-and-save"
  - "5 EU news site targets: Guardian (primary/Sourcepoint), Le Monde (Didomi), Spiegel (Sourcepoint), BBC (custom), Repubblica (iubenda)"
  - "Multi-language button matching for EN/FR/DE/IT/ES to handle localized consent UI text"

patterns-established:
  - "DARK-02 pattern: asymmetric effort detection -- Accept=1 click on prominent button vs Reject=2-5 clicks through hidden secondary panel"
  - "CMP detection priority order: OneTrust -> Quantcast -> Cookiebot -> TrustArc -> site-specific -> generic"
  - "Iframe consent banner handling: detect iframe[id*=sp_message], target iframe content for DOM interaction"

requirements-completed: [DARK-02]

duration: 3min
completed: 2026-03-22
---

# Phase 88 Plan 01: Cookie Opt-Out Hidden Reject Summary

**Cookie consent dark pattern avoidance site guide with 5-CMP detection, 3-tier hidden reject strategy, and 10-step rejectAllCookies workflow for EU news sites**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-22T08:52:36Z
- **Completed:** 2026-03-22T08:55:53Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments
- Created cookie-opt-out.js site guide with comprehensive DARK-02 dark pattern avoidance guidance
- Documented 5 CMP platforms (OneTrust, Quantcast, Cookiebot, TrustArc, custom) with full DOM selectors for detection, accept, manage, reject, toggle, and save elements
- Documented 5 EU news site targets (Guardian primary, Le Monde secondary, Spiegel/BBC/Repubblica fallbacks) with site-specific selectors and hidden reject paths
- Implemented 3-tier hidden reject strategy: direct reject on banner, reject in preference center, toggle-all-off-and-save
- Added multi-language button text table covering English, French, German, Italian, Spanish
- Documented iframe-based consent banner handling for Sourcepoint CMPs (Guardian, Spiegel)
- Added 5 dark pattern avoidance warnings including "never click Accept All" and iframe detection
- Registered importScripts entry in background.js Utilities section

## Task Commits

Each task was committed atomically:

1. **Task 1: Create cookie-opt-out.js site guide with rejectAllCookies workflow and DARK-02 guidance** - `7b6e590` (feat)

## Files Created/Modified
- `site-guides/utilities/cookie-opt-out.js` - Cookie opt-out site guide with registerSiteGuide call, DARK-02 guidance, CMP detection, selectors, 10-step workflow, warnings, toolPreferences
- `background.js` - Added importScripts entry for cookie-opt-out.js after freeware-download.js in Utilities section

## Decisions Made
- Documented 5 CMP platforms with platform-specific DOM selectors rather than relying solely on generic text matching
- Chose 3-tier reject strategy (direct/preferences/toggle) to handle all CMP configurations from most accessible to fully hidden
- Placed Guardian as primary target (Sourcepoint CMP, iframe-based) as it demonstrates the full DARK-02 pattern
- Added Le Monde as secondary target to validate Didomi CMP detection and French-language button matching
- Included multi-language table for 5 EU languages to handle localized consent banners

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- cookie-opt-out.js ready for Plan 02 live MCP test on theguardian.com
- All CMP selectors are research-based and need live browser validation
- Iframe-based Sourcepoint banner handling documented but untested in live environment

---
*Phase: 88-cookie-opt-out-hidden-reject*
*Completed: 2026-03-22*
