# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-21)

**Core value:** Reliable single-attempt execution - the AI decides correctly, the mechanics execute precisely
**Current focus:** v9.3 Tech Debt Cleanup - Phase 8 (Site Guides Viewer)

## Current Position

Phase: 8 of 8 (Site Guides Viewer)
Plan: 5 of 5
Status: Phase complete
Last activity: 2026-02-21 - Completed 08-05-PLAN.md

Progress: [==========] 100% (phase 8)

## Performance Metrics

**v0.9 Velocity:**
- Total plans completed: 24
- Average duration: 2.9 min
- Total execution time: 1.2 hours

**v9.0.2 Velocity:**
- Total plans completed: 21
- Average duration: 3.0 min
- Total execution time: ~63 min

**v9.1 Velocity:**
- Total plans completed: 6
- Average duration: 3.4 min
- Total execution time: ~23.6 min

**v9.3 Velocity:**
- Total plans completed: 7
- Average duration: 2.5 min
- Total execution time: ~17.2 min

## Accumulated Context

### Decisions

Full decision log in PROJECT.md Key Decisions table.

Recent decisions:
- v9.3: Use window.FSB namespace pattern for module communication (not ES modules, not bare globals)
- v9.3: Programmatic injection via chrome.scripting.executeScript (not manifest content_scripts)
- v9.3: Dead code removal after modularization (module boundaries make dead code obvious)
- v9.3: Shadow DOM + Popover API for visual overlays (top-layer rendering, z-index fallback)
- v9.3: Playwright-style actionability model for element readiness checks
- v9.3: Fast-path readiness bypass (performQuickReadinessCheck) for obvious cases
- 07-01: Store-first-enrich-second pattern for memory AI analysis (enrichment is additive, never blocks storage)
- 07-01: Update both BackgroundAnalytics and FSBAnalytics for source field (shared fsbUsageData storage)
- 07-02: Pure heuristic cross-site pattern analysis (no AI calls, keyword-based classification)
- 07-02: typeof guard for optional module loading in consolidate() (graceful degradation)
- 07-03: Unified toggleMemoryDetail entry point delegates to toggleMemoryGraph for site_map memories
- 07-03: detail-toggle-icon on all items replaces graph-only chevron
- 07-04: Use existing modern-toggle pattern for auto-analyze toggle (not new toggle-switch/toggle-slider)
- 07-04: stopPropagation on overflow dropdown content prevents premature close
- 07-05: Debounced onChanged listener for fsb_memories with in-progress guard and active-section check
- 07-06: 30-day cost window for both Dashboard and Memory cost panels with source-based filtering
- 07-07: cross-site-patterns.js must be in both background.js importScripts and options.html script tags
- 08-01: Dual-format registry accepts both old category format and new per-site format simultaneously
- 08-01: Per-site files use flat selectors (not nested under domain key)
- 08-01: FontAwesome 6.6.0 class names (fa-list-check for productivity, fa-cart-shopping for ecommerce)
- 08-05: IIFE pattern for viewer JS to avoid global namespace pollution
- 08-05: Separate input listener for filterSiteGuides (does not modify existing searchMemories debounce)

### Pending Todos

1. Smart multi-tab management with context-aware navigation (area: general) - `.planning/todos/pending/2026-02-14-smart-multi-tab-management.md`

### Roadmap Evolution

- Phase 7 added: Memory Intelligence Overhaul (7 plans)
- Phase 8 added: Site Guides Viewer (expose 9 built-in site guides as read-only browsable content in Memory tab)

### Blockers/Concerns

None currently.

## Session Continuity

Last session: 2026-02-21
Stopped at: Completed 08-05-PLAN.md (Phase 8 complete)
Resume file: None
