---
phase: "08"
plan: "05"
subsystem: "site-guides-viewer"
tags: ["viewer-ui", "options-page", "search-integration", "accordion", "css"]
dependency-graph:
  requires:
    - "08-01 (registry enhancement with getSiteGuidesByCategory, getCategoryGuidance)"
    - "08-03 (all 43 per-site files and 9 shared files created)"
  provides:
    - "Site guides viewer UI in Memory tab"
    - "site-guides-viewer.js with category grouping, accordion detail panels, search filtering"
    - "CSS styles for site guides viewer"
    - "53 script tags in options.html for guide data loading"
  affects: []
tech-stack:
  added: []
  patterns:
    - "IIFE module pattern for viewer JS (avoids global namespace pollution)"
    - "CSS class toggle for search filtering (preserves collapse state)"
    - "Accordion behavior (one expanded site at a time)"
    - "Collapsible sub-sections within detail panels"
key-files:
  created:
    - "ui/site-guides-viewer.js"
  modified:
    - "ui/options.html"
    - "ui/options.css"
decisions:
  - "IIFE pattern for viewer to avoid polluting global scope"
  - "Separate input listener for filterSiteGuides (does not modify existing searchMemories debounce)"
  - "Category display order hardcoded in CATEGORY_ORDER array"
metrics:
  duration: "3m 02s"
  completed: "2026-02-21"
---

# Phase 8 Plan 05: Site Guides Viewer UI Summary

Built the Site Guides Viewer UI with 53 script tags in options.html, a new site-guides-viewer.js file, and CSS styles. Users can browse all 43 sites across 9 categories in the Memory tab.

## What Was Done

### Task 1: Add Script Tags and HTML Section to options.html
- Added 53 script tags for site guide files (1 index + 9 shared + 43 per-site) between visualization scripts and options.js
- Added site-guides-viewer.js script tag after all guide scripts and before options.js
- Added Site Guides HTML section in the Memory tab between memoryListContainer and Site Explorer
- Section includes header with count span and container div for dynamic rendering

### Task 2: Create site-guides-viewer.js and Add CSS Styles
- Created ui/site-guides-viewer.js as an IIFE module with these functions:
  - `initSiteGuidesViewer()` -- reads registry data, updates count, renders list, hooks search
  - `renderSiteGuidesList()` -- builds HTML for all categories/sites with event listeners
  - `toggleGuideDetail()` -- accordion behavior (one site expanded at a time)
  - `renderGuideDetailPanel()` -- renders 5 sub-sections (Category Guidance, Selectors, Workflows, Warnings, Site Guidance)
  - `renderGuideSubSection()` -- collapsible sub-section with optional count badge
  - `filterSiteGuides()` -- CSS class toggle filtering by site/category name
  - `_escapeGuideHtml()` -- local HTML escaper (viewer loads before options.js)
- Categories render in fixed order via CATEGORY_ORDER array
- All categories start expanded; all sub-sections start collapsed
- Search integration: added input listener on memorySearchInput that calls filterSiteGuides()
- Added ~310 lines of CSS to options.css covering all viewer classes
- Dark theme support via existing CSS variables
- Reused existing detail-table and detail-code patterns for selector display

## Task Commits

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Add script tags and HTML section to options.html | a3aaf9b | ui/options.html |
| 2 | Create site-guides-viewer.js and CSS styles | 77ffaac | ui/site-guides-viewer.js, ui/options.css |

## Decisions Made

- Used IIFE pattern for viewer JS to avoid polluting the global namespace (registry functions are already global from index.js)
- Added a separate input event listener for filterSiteGuides rather than modifying the existing searchMemories debounce handler -- both fire on the same input, keeping concerns separated
- Hardcoded category display order in CATEGORY_ORDER array to ensure consistent rendering regardless of registration order

## Deviations from Plan

None -- plan executed exactly as written.

## Verification Results

- options.html has 53 script tags for site guide files: PASSED
- site-guides-viewer.js script tag appears after all guide scripts and before options.js: PASSED
- siteGuidesSection div exists inside the memory section: PASSED
- ui/site-guides-viewer.js has all required functions: PASSED
- ui/options.css has all site guides viewer CSS classes: PASSED
- Search input filters both memories (via existing handler) and site guides (via new handler): PASSED

## Self-Check: PASSED
