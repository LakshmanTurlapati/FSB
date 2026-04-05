---
phase: 07
plan: 06
subsystem: ui-analytics
tags: [cost-tracking, analytics, memory, dashboard, options-ui]
depends_on:
  requires: ["07-01", "07-03"]
  provides: ["Memory cost tracking panels", "Dashboard cost breakdown by source"]
  affects: ["07-07"]
tech-stack:
  added: []
  patterns: ["analytics source filtering for cost segmentation"]
key-files:
  created: []
  modified:
    - ui/options.html
    - ui/options.js
    - ui/options.css
decisions:
  - id: "07-06-01"
    decision: "Cost breakdown uses 30-day window for both Dashboard and Memory panels"
    rationale: "30-day window gives meaningful cost data while staying current"
metrics:
  duration: "2 min"
  completed: "2026-02-21"
---

# Phase 7 Plan 6: Memory Cost Tracking Panels Summary

Dashboard hero shows automation/memory/sitemap cost breakdown using analytics source filtering; Memory tab shows dedicated cost card combining memory + sitemap AI spend with formatted totals.

## What Was Done

### Task 1: Add cost panels to Dashboard hero and Memory section HTML
- Added `cost-breakdown` div inside analytics hero with three cost items: Automation, Memory AI, Sitemap
- Added `memory-cost-card` in Memory section between controls bar and memory list
- Memory cost card shows total cost, AI request count, and token usage
- All element IDs unique and follow existing naming conventions

### Task 2: Wire cost panel data loading and add styles
- Added `loadDashboardCostBreakdown()` function that calls `analytics.getStatsBySource('30d', source)` for each source type
- Added `loadMemoryCostPanel()` function that combines memory + sitemap stats for the Memory tab card
- Token formatting uses K/M suffixes for readability (e.g., "12.3K", "1.2M")
- Hooked `loadDashboardCostBreakdown()` into all dashboard update flows: init, chart time range change, storage change listener, test tracking, clear data
- Called `loadMemoryCostPanel()` inside `loadMemoryDashboard()` so it refreshes with memory data
- Added CSS for `.cost-breakdown` (dashboard hero) and `.memory-cost-card` (memory tab) with proper theming

## Task Commits

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Add cost panels HTML | fdacf99 | ui/options.html |
| 2 | Wire data loading and styles | 9a2f4ad | ui/options.js, ui/options.css |

## Decisions Made

1. **30-day cost window**: Both panels use 30-day window via `getStatsBySource('30d', ...)` for meaningful cost aggregation
2. **Memory tab combines memory + sitemap**: The Memory cost card sums both `memory` and `sitemap` sources since both relate to memory intelligence operations
3. **Dollar formatting**: Dashboard cost breakdown uses `$X.XX` (2 decimal places), Memory card uses `$X.XXXX` (4 decimal places) for precision on smaller values

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

All verification checks passed:
- `loadDashboardCostBreakdown` exists in options.js (6 references: 1 definition + 5 call sites)
- `loadMemoryCostPanel` exists in options.js (2 references: 1 definition + 1 call site)
- `getStatsBySource` called in options.js (5 calls across both functions)
- `memory-cost-card` present in both options.html and options.css
- `cost-breakdown` present in both options.html and options.css

## Self-Check: PASSED
