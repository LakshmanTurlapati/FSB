---
phase: "08"
plan: "04"
subsystem: "ai-integration"
tags: ["per-site-guides", "ai-integration", "selectors", "category-guidance", "task-detection"]
dependency-graph:
  requires:
    - "08-01 (registry enhancement, per-site format, getCategoryGuidance)"
    - "08-03 (all 43 per-site files with flat selectors)"
  provides:
    - "AI correctly reads flat selectors from per-site guides"
    - "Combined category + site guidance in AI prompts"
    - "Task type detection works with per-site guide .category field"
    - "Keyword fallback matching by .category in getGuideForTask"
  affects:
    - "08-05 (viewer UI builds on the complete data + AI integration)"
tech-stack:
  added: []
  patterns:
    - "Dual-format selector handling (flat for per-site, nested for legacy)"
    - "Category guidance prepended to site-specific guidance in prompts"
key-files:
  created: []
  modified:
    - "ai/ai-integration.js"
    - "site-guides/index.js"
decisions: []
metrics:
  duration: "48s"
  completed: "2026-02-21"
---

# Phase 8 Plan 04: AI Integration Update for Per-Site Guide Format Summary

Updated _buildTaskGuidance in ai-integration.js to handle flat selectors from per-site guides and prepend category-level guidance from _shared.js alongside site-specific guidance.

## What Was Done

### Task 1: Update _buildTaskGuidance for per-site guide format

**ai-integration.js changes:**

1. **Category guidance integration:** At the top of `_buildTaskGuidance`, added a check for `siteGuide.site && siteGuide.category` that calls `getCategoryGuidance()` to fetch shared category-level guidance. This text is prepended to the guidance string so the AI receives both category context (e.g., general e-commerce patterns) and site-specific context (e.g., Amazon selectors).

2. **Header line update:** Changed the guidance header from `siteGuide.name` to `siteGuide.site || siteGuide.name` so per-site guides display the site name (e.g., "Amazon") while legacy category guides still display the category name.

3. **Flat vs nested selector detection:** Added a check for `siteGuide.site` to determine the selector format. Per-site guides have flat selectors directly on `siteGuide.selectors`, so they are used as-is. Legacy category guides still go through the domain extraction and key matching logic.

4. **Task type detection fix:** Changed `guideToTaskType[siteGuide.name]` to `guideToTaskType[siteGuide.category || siteGuide.name]` in `detectTaskType()`. Per-site guides have a `.category` field (e.g., "E-Commerce & Shopping") that maps to the task type, while legacy guides use `.name`.

**site-guides/index.js changes:**

5. **Keyword fallback matching:** Updated `getGuideForTask()` keyword fallback to also match by `.category` in addition to `.name`: `SITE_GUIDES_REGISTRY.find(g => g.name === categoryName || g.category === categoryName)`. This ensures that when no URL match exists, keyword-based task matching still finds per-site guides via their category field.

## Task Commits

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Update _buildTaskGuidance for per-site guide format | 5b08094 | ai/ai-integration.js, site-guides/index.js |

## Decisions Made

None -- followed the plan exactly.

## Deviations from Plan

None -- plan executed exactly as written.

## Verification Results

- In ai-integration.js: `_buildTaskGuidance` checks for `siteGuide.site` to determine flat vs nested selectors: PASSED (line 3942)
- In ai-integration.js: `_buildTaskGuidance` includes category guidance via getCategoryGuidance(): PASSED (lines 3929-3933)
- In ai-integration.js: `detectTaskType` uses `siteGuide.category || siteGuide.name`: PASSED (line 4002)
- In index.js: `getGuideForTask` keyword fallback matches by `.category` in addition to `.name`: PASSED (line 191)
- grep for "siteGuide.site" in ai-integration.js returns matches: PASSED (3 matches)

## Next Phase Readiness

Plan 08-05 can proceed. The AI integration now correctly handles the per-site guide format:
- Flat selectors are read directly without domain key lookup
- Category guidance is prepended to site-specific guidance
- Task type detection uses .category for per-site guides
- Keyword fallback finds per-site guides by category name

## Self-Check: PASSED
