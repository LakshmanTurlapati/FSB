---
phase: "08"
plan: "01"
subsystem: "site-guides"
tags: ["registry", "per-site-guides", "category-metadata", "data-restructuring"]
dependency-graph:
  requires: []
  provides:
    - "Enhanced site guide registry with category guidance support"
    - "9 category _shared.js files with icons and shared guidance"
    - "11 per-site guide files (5 ecommerce + 6 social) with flat selectors"
  affects:
    - "08-02 (remaining category splits)"
    - "08-03 (viewer UI)"
    - "08-04 (background.js importScripts update)"
tech-stack:
  added: []
  patterns:
    - "Per-site registration with category metadata (registerSiteGuide with site + category fields)"
    - "Category guidance registration (registerCategoryGuidance with icon, guidance, warnings)"
    - "Dual-format registry (old category format and new per-site format coexist)"
key-files:
  created:
    - "site-guides/ecommerce/_shared.js"
    - "site-guides/social/_shared.js"
    - "site-guides/coding/_shared.js"
    - "site-guides/finance/_shared.js"
    - "site-guides/travel/_shared.js"
    - "site-guides/email/_shared.js"
    - "site-guides/career/_shared.js"
    - "site-guides/gaming/_shared.js"
    - "site-guides/productivity/_shared.js"
    - "site-guides/ecommerce/amazon.js"
    - "site-guides/ecommerce/ebay.js"
    - "site-guides/ecommerce/walmart.js"
    - "site-guides/ecommerce/target.js"
    - "site-guides/ecommerce/bestbuy.js"
    - "site-guides/social/linkedin.js"
    - "site-guides/social/twitter.js"
    - "site-guides/social/facebook.js"
    - "site-guides/social/reddit.js"
    - "site-guides/social/instagram.js"
    - "site-guides/social/youtube.js"
  modified:
    - "site-guides/index.js"
decisions:
  - id: "08-01-dual-format"
    decision: "Registry accepts both old category format (name+patterns) and new per-site format (site+category+patterns) simultaneously"
    rationale: "Old category files remain loadable until Plan 04 removes them; both formats coexist in SITE_GUIDES_REGISTRY"
  - id: "08-01-flat-selectors"
    decision: "Per-site files use flat selectors (directly on guide object) instead of nested under domain key"
    rationale: "Per-site files only cover one site, so nesting under a domain key is unnecessary"
  - id: "08-01-fa6-icons"
    decision: "Use FontAwesome 6.6.0 class names (fa-cart-shopping, fa-list-check) instead of FA5 names"
    rationale: "Project uses FA 6.6.0; fa-tasks (FA5) maps to fa-list-check (FA6)"
metrics:
  duration: "6m 51s"
  completed: "2026-02-21"
---

# Phase 8 Plan 01: Registry Enhancement and Per-Site Guide Split Summary

Enhanced site guide registry with category metadata support and split ecommerce/social category files into 11 per-site files with flat selectors.

## What Was Done

### Task 1: Enhanced index.js and Created 9 _shared.js Files
- Added `CATEGORY_GUIDANCE` storage object to index.js
- Added `registerCategoryGuidance()` function for category metadata registration
- Added `getSiteGuidesByCategory()` to group per-site guides by category (viewer query)
- Added `getCategoryGuidance()` to retrieve category metadata by name (viewer query)
- Added `getTotalSiteCount()` to count per-site guides (viewer header)
- Relaxed `registerSiteGuide()` validation to accept both old format (name+patterns+guidance) and new format (site+category+patterns)
- Created 9 category subdirectories with _shared.js files, each containing:
  - Category name matching old guide's `.name` field
  - FontAwesome 6.6.0 icon class
  - Shared guidance (category-level, not site-specific)
  - Category-wide warnings

### Task 2: Split Ecommerce and Social into Per-Site Files
- Created 5 ecommerce per-site files: amazon.js, ebay.js, walmart.js, target.js, bestbuy.js
- Created 6 social per-site files: linkedin.js, twitter.js, facebook.js, reddit.js, instagram.js, youtube.js
- Each file uses flat selectors (not nested under domain key)
- Each file registers with `site`, `category`, `patterns`, `selectors`, `workflows`, `warnings`, `toolPreferences`
- Site-specific guidance extracted from parent category files
- Old category files (ecommerce.js, social.js) preserved untouched

## Task Commits

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Enhance registry and create _shared.js files | 661ee86 | index.js + 9 _shared.js files |
| 2 | Split ecommerce and social into per-site files | 97ccfba | 5 ecommerce + 6 social per-site files |

## Decisions Made

1. **Dual-format registry**: Both old category format and new per-site format coexist in SITE_GUIDES_REGISTRY until Plan 04 removes old files
2. **Flat selectors**: Per-site files have selectors directly on the guide object (not nested under a domain key) since each file covers only one site
3. **FA6 icon names**: Used FontAwesome 6.6.0 class names (fa-list-check instead of fa-tasks, fa-cart-shopping instead of fa-shopping-cart)

## Deviations from Plan

None -- plan executed exactly as written.

## Next Phase Readiness

Plan 08-02 can proceed to split the remaining 7 category files (coding, finance, travel, email, career, gaming, productivity) into per-site files using the same pattern established here.

## Self-Check: PASSED
