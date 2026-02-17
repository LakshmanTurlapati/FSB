---
phase: 01-signal-accuracy-fixes
plan: 01
subsystem: dom-analysis
tags: [viewport, captcha, shadow-dom, element-detection, content-script]

# Dependency graph
requires:
  - phase: none
    provides: initial content.js with existing functions
provides:
  - "isElementInViewport with 25% overlap-ratio calculation for split-pane layouts"
  - "Page-level CAPTCHA detection using data-sitekey + iframe src with visibility gating"
  - "Element-level CAPTCHA detection using data-sitekey with visibility/size verification"
  - "waitForElement using querySelectorWithShadow for Shadow DOM consistency"
affects:
  - 01-signal-accuracy-fixes (remaining plans if any)
  - 02-dom-serialization (consumes viewport and CAPTCHA signals)
  - 03-change-detection (relies on accurate element visibility)
  - 04-memory-context (consumes page state including hasCaptcha)
  - 05-completion-verification (uses element detection for verification)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Overlap-ratio viewport detection (25% threshold) instead of full-containment"
    - "Attribute-based CAPTCHA detection (data-sitekey) with visibility gating instead of class-name matching"
    - "Consistent Shadow DOM resolution across all tool handlers via querySelectorWithShadow"

key-files:
  created: []
  modified:
    - "content.js"

key-decisions:
  - "25% overlap threshold for viewport detection -- balances split-pane visibility with noise reduction"
  - "data-sitekey as primary CAPTCHA indicator -- universal across reCAPTCHA, hCaptcha, Turnstile"
  - "30px minimum dimension for CAPTCHA elements -- filters hidden/tracking widgets"
  - "Removed all CSS-class-only CAPTCHA selectors to eliminate false positives on LinkedIn et al."

patterns-established:
  - "Overlap-ratio viewport: use area overlap instead of full containment for split-pane layouts"
  - "Attribute+visibility gating: require both semantic attribute and visual presence for detection signals"
  - "Consistent Shadow DOM resolution: all querySelector calls in tool handlers use querySelectorWithShadow"

# Metrics
duration: 2min
completed: 2026-02-14
---

# Phase 1 Plan 1: Signal Accuracy Fixes Summary

**Overlap-ratio viewport detection (25% threshold), data-sitekey CAPTCHA gating with visibility checks, and Shadow DOM-aware waitForElement resolution**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-14T20:15:08Z
- **Completed:** 2026-02-14T20:17:00Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Replaced full-containment viewport check with overlap-ratio calculation (25% threshold) so elements in split-pane layouts (Gmail, LinkedIn) are correctly classified as in-viewport when 25%+ visible
- Replaced page-level and element-level CAPTCHA detection with data-sitekey attribute matching plus visibility and dimension gating, eliminating false positives from generic CSS classes (.captcha-container, .captcha-challenge, .g-recaptcha etc.)
- Made waitForElement use querySelectorWithShadow instead of document.querySelector, matching click/type/hover and eliminating timeouts on Shadow DOM elements

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix viewport detection and CAPTCHA detection** - `5ef53b6` (fix)
2. **Task 2: Fix waitForElement Shadow DOM resolution** - `419d767` (fix)

## Files Created/Modified
- `content.js` - Fixed isElementInViewport (overlap-ratio), hasCaptcha page-level detection (data-sitekey + visibility), element-level isCaptcha (data-sitekey + visibility), waitForElement (querySelectorWithShadow)

## Decisions Made
- Used 25% overlap threshold for viewport detection -- anything with at least a quarter of its area visible in the viewport is classified as in-viewport. This handles split-pane UIs (Gmail compose, LinkedIn sidebar) where elements are partially visible.
- Used data-sitekey as the universal CAPTCHA attribute -- all major CAPTCHA providers (reCAPTCHA, hCaptcha, Cloudflare Turnstile) use this attribute on their widget containers.
- Set 30px minimum dimension for CAPTCHA elements -- legitimate CAPTCHA widgets are always visually substantial; tracking pixels and hidden widgets are filtered out.
- Removed all CSS-class-only CAPTCHA selectors -- classes like .captcha-container and .captcha-challenge are generic patterns used by many non-CAPTCHA components (LinkedIn uses similar class names for unrelated UI).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All three signal accuracy fixes (SIG-01, SIG-02, SIG-03) are in place
- content.js is ready for downstream phases that consume these signals
- No blockers for Phase 1 remaining plans or Phase 2

---
*Phase: 01-signal-accuracy-fixes*
*Completed: 2026-02-14*
