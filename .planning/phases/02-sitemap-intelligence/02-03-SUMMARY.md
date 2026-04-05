---
phase: 02
plan: 03
subsystem: side-panel-recon
tags: [reconnaissance, side-panel, site-explorer, memory, site-map]
requires:
  - 02-01 (sitemap converter + createSiteMapMemory)
  - 02-02 (sitemap refiner + autoRefineSiteMaps toggle)
provides:
  - autoSaveToMemory flag for Site Explorer crawl-to-memory pipeline
  - checkSiteMap message handler for domain map existence checks
  - Side panel reconnaissance suggestion on stuck failures
  - Inline crawl progress and automatic retry-with-site-map flow
affects:
  - Future phases using Site Explorer (auto-save path now available)
  - Side panel UX for error recovery
tech-stack:
  added: []
  patterns:
    - Message-based domain map existence check (checkSiteMap)
    - Crawl-to-memory pipeline with optional AI refinement
    - Inline progress display with message element reuse
key-files:
  created: []
  modified:
    - utils/site-explorer.js
    - background.js
    - ui/sidepanel.js
    - ui/sidepanel.css
key-decisions:
  - Lighter crawl from side panel (depth 2, max 15 pages) for speed over depth
  - Recon suggestion only shown for stuck errors on sites without existing maps
  - autoConvertToMemory runs both Tier 1 and Tier 2 (if toggle ON) in sequence
  - siteMapSaved broadcast enables decoupled side panel reactivity
duration: 3.8 min
completed: 2026-02-18
---

# Phase 02 Plan 03: Side Panel Reconnaissance Integration Summary

Side panel now offers reconnaissance as a recovery option when automation gets stuck on an unmapped site. The full flow: stuck error -> check for existing map -> suggest recon -> crawl with inline progress -> auto-save site map memory (with optional AI refinement) -> offer retry with the original task.

## Task Commits

| Task | Name | Commit | Key Changes |
|------|------|--------|-------------|
| 1 | Add autoSaveToMemory flag to Site Explorer | 0961f3e | start() option, autoConvertToMemory(), import converter+refiner in background |
| 2 | Check for existing site map before suggesting recon | 3dd800a | hasSiteMapForDomain() helper, checkSiteMap message handler |
| 3 | Add recon suggestion to side panel error handler | 4c395b9 | Stuck error -> checkSiteMap -> "Run Reconnaissance" button |
| 4 | Implement side panel recon trigger with progress | b24a2aa | startReconFromSidepanel(), progress display, retry-with-site-map flow |
| 5 | Side panel recon styles | 5e8153e | .recon-suggestion, .recon-btn, .recon-progress CSS with dark theme |

## Decisions Made

1. **Lighter crawl from side panel**: depth 2 / max 15 pages (vs default depth 3 / max 25) to prioritize speed in the recovery flow
2. **Recon only for stuck + unmapped**: the suggestion only appears when the error includes "stuck" AND checkSiteMap returns exists: false
3. **Full Tier 1 + Tier 2 pipeline in autoConvertToMemory**: converts to site pattern, checks autoRefineSiteMaps toggle, runs AI refinement if ON, saves memory, broadcasts siteMapSaved
4. **Import sitemap-converter.js and sitemap-refiner.js in background.js**: required for autoConvertToMemory to work in the service worker context (Rule 3 - blocking fix)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Import sitemap-converter.js and sitemap-refiner.js in background.js**
- **Found during:** Task 1
- **Issue:** autoConvertToMemory needs convertToSiteMap and refineSiteMapWithAI but those modules were only loaded in options.html, not in the background service worker
- **Fix:** Added importScripts for both modules after the memory layer imports
- **Files modified:** background.js
- **Commit:** 0961f3e

**2. [Rule 1 - Bug] Dark theme variant for recon button**
- **Found during:** Task 5
- **Issue:** Plan CSS did not include dark theme styles for .recon-btn; button would be invisible in dark mode
- **Fix:** Added [data-theme="dark"] .recon-btn and hover variant
- **Files modified:** ui/sidepanel.css
- **Commit:** 5e8153e

## Verification

- autoSaveToMemory flag accepted by start() and passed through startExplorer handler
- autoConvertToMemory chains Tier 1 converter -> optional Tier 2 refiner -> memory save -> broadcast
- hasSiteMapForDomain checks bundled maps then memory system
- checkSiteMap handler returns { exists, source } for side panel consumption
- Stuck error handler: checks map existence, shows recon button only when no map exists
- startReconFromSidepanel sends lighter crawl with autoSaveToMemory: true
- Progress and completion handlers update chat inline
- Retry-with-site-map button re-sends the original task
- CSS styles consistent with side panel theme (light + dark)

## Next Phase Readiness

Phase 02 is now complete. All 4 plans (02-01 through 02-04) have been executed.

## Self-Check: PASSED
