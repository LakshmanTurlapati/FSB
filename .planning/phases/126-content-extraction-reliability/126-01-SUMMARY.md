---
phase: 126-content-extraction-reliability
plan: 01
subsystem: content-extraction
tags: [dom-analysis, mcp, read-page, content-truncation, main-content-detection]

requires:
  - phase: none
    provides: existing extractPageText and MCP read_page infrastructure
provides:
  - findMainContentRoot() semantic content detector with 11 selector priority list
  - maxChars-aware extractPageText with configurable character cap
  - Fixed MCP full flag passthrough (params wrapping bug)
  - 8K default MCP output cap (50K for full:true and autopilot)
  - 45s MCP read_page timeout (up from 30s)
affects: [126-02, content-extraction-reliability, mcp-tools]

tech-stack:
  added: []
  patterns:
    - "Main content prioritization via semantic selector cascade (main, [role=main], article, etc.)"
    - "Supplementary content fill after main extraction with noise element filtering"

key-files:
  created: []
  modified:
    - content/dom-analysis.js
    - background.js
    - content/messaging.js
    - mcp-server/src/tools/read-only.ts

key-decisions:
  - "8K default cap for MCP callers, 50K for autopilot -- per D-05/D-07"
  - "Main content extracted first via 11 semantic selectors, supplementary fills remaining budget"
  - "Noise elements (nav/footer/aside/header) excluded from supplementary extraction"

patterns-established:
  - "findMainContentRoot: lightweight selector cascade for main content detection"
  - "maxChars option pattern for configurable extraction limits"

requirements-completed: [CONT-03, CONT-04]

duration: 2min
completed: 2026-03-31
---

# Phase 126 Plan 01: Content Extraction Reliability Summary

**Main-content-first extraction with 8K MCP cap via findMainContentRoot selector cascade and fixed full flag passthrough**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-31T11:42:10Z
- **Completed:** 2026-03-31T11:44:25Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Added findMainContentRoot() with 11 semantic selectors (main, [role=main], article, #content, etc.) that detects the primary content area of any page
- Made extractPageText accept configurable maxChars option (default 50000 preserving autopilot behavior, 8000 for MCP callers)
- Fixed the MCP full flag passthrough bug -- full was sent at top-level but messaging.js reads from params
- Increased MCP read_page timeout from 30s to 45s to accommodate stability wait headroom (Plan 02)
- MCP callers now get focused main content with title/URL header instead of 50K walls of nav/sidebar/footer noise

## Task Commits

Each task was committed atomically:

1. **Task 1: Add findMainContentRoot and maxChars-aware extraction to dom-analysis.js** - `c2c35db` (feat)
2. **Task 2: Fix MCP full flag passthrough, add maxChars forwarding, increase timeout** - `84de1b5` (fix)

## Files Created/Modified
- `content/dom-analysis.js` - Added findMainContentRoot() function, maxChars option to extractPageText, main content prioritization with supplementary fill, dynamic truncation notice, page title/URL header for MCP, FSB namespace export
- `background.js` - Fixed mcp:read-page handler to wrap full inside params, added maxChars computation (8000 default, 50000 when full:true)
- `content/messaging.js` - Added rpMaxChars variable, passes maxChars to extractPageText, logs maxChars in timing diagnostics
- `mcp-server/src/tools/read-only.ts` - Increased read_page timeout from 30_000 to 45_000

## Decisions Made
- 8K default for MCP callers per D-05 -- balances usability vs noise. Autopilot keeps 50K per D-07
- 11 semantic selectors for main content detection per D-06 -- covers standard HTML5 patterns and common CMS class names
- Supplementary content fills remaining budget but skips nav/footer/aside/header noise elements
- Page title and URL prepended as header only for MCP callers (maxChars < 50000) to provide context

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Known Stubs

None - all functionality is fully wired with no placeholder data.

## Next Phase Readiness
- extractPageText now accepts maxChars, ready for Plan 02 to wire the auto-stability wait
- 45s timeout provides headroom for the stability wait that Plan 02 will add
- findMainContentRoot available on FSB namespace for any future callers

## Self-Check: PASSED

- All 4 modified files verified present on disk
- Both task commits (c2c35db, 84de1b5) verified in git log

---
*Phase: 126-content-extraction-reliability*
*Completed: 2026-03-31*
