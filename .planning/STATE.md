# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-23)

**Core value:** Reliable single-attempt execution - the AI decides correctly, the mechanics execute precisely
**Current focus:** v9.4 Career Search Automation - Phase 12: Google Sheets Data Entry

## Current Position

Phase: 12 of 13 (Google Sheets Data Entry)
Plan: 0 of TBD in current phase
Status: Ready to plan
Last activity: 2026-02-23 -- Phase 11 verified and complete

Progress: [######....] 60% (10/~15 plans across 5 phases)

## Performance Metrics

**v9.3 Velocity:**
- Total plans completed: 17
- Average duration: 2.5 min
- Total execution time: ~26.0 min

**v9.4 Velocity:**
- Total plans completed: 10
- Average duration: 2.5 min
- Total execution time: ~27.9 min

## Accumulated Context

### Decisions

Full decision log in PROJECT.md Key Decisions table.

Recent decisions:
- 11-02: Multi-site orchestration wraps existing automation loop -- does not replace it
- 11-02: Completion interception handles all exit paths: taskComplete, repeatedSuccess, no_progress, stuck
- 11-02: Auth-walled companies deferred to end; login detection uses tab-URL heuristic
- 11-02: storeJobData fallback parsing catches AI forgetting to call the tool
- 11-02: Per-company iteration cap set to 15 (min of user setting and 15)
- 11-02: Career task toolPreferences augmented to always include data tools
- 11-01: backgroundDataTools separate from multiTabActions -- data tools get overlay status updates, multi-tab tools do not
- 11-01: extractCompaniesFromTask validates candidates against COMPANY_ALIASES and getGuideByCompanyName
- 11-01: checkAccumulatorRelevance uses 50% keyword overlap threshold for keep vs clear
- 10-03: Career prompt reduced from 6 phases to 4 (Phase 0-3) -- removed Google Sheets phases 4-6 entirely
- 10-03: Company name extraction runs for ALL career tasks regardless of siteGuide state (keyword-fallback may return wrong company)
- 10-03: careerUrl directive injected in both code paths (null siteGuide and present siteGuide)
- 10-03: Apply link fallback: try parent a element href before reporting not available
- 10-01: 38 alias entries in COMPANY_ALIASES verified against actual .site values (corrected 4 from research)
- 10-01: extractCompanyFromTask uses last-occurrence "at" matching and first-word filtering for "for" pattern
- 10-01: Cookie banner dismissal added as first-priority instruction in category guidance
- 10-02: getText threshold lowered from 3 to 2 (search+extract needs fewer extractions than full Sheets workflow)
- 10-02: Error reports (NO RESULTS, AUTH REQUIRED) treated as valid completions with +0.15 bonus (SEARCH-05)
- 10-02: Career URL patterns use 12 common patterns covering ATS platforms and major job boards
- 10-02: Job title detection uses common role keyword regex rather than exact title matching
- 09-03: Import order: ATS bases -> third-party boards -> company guides (alpha) -> generic.js (last)
- 09-03: generic.js confidence set to MEDIUM (fallback, not targeted)
- 09-03: Workday-specific content removed from generic.js -- now references dedicated workday.js
- 09-03: All 4 existing guides converted to machine-optimized minimal format (no JSDoc headers)
- v9.4: Phase ordering follows strict dependency chain (pipeline -> single-site -> multi-site -> Sheets entry -> Sheets formatting)
- v9.4: "Collect all, then write" tab pattern -- accumulate job data across all sites before opening Sheets once
- 09-02: Workday/Greenhouse confidence HIGH (log-verified), Lever/iCIMS/Taleo confidence MEDIUM (general knowledge)
- 09-02: Lever guide omits searchBox and pagination (platform lacks these features)
- 09-01: Keyword heuristic categorization for 9 career element categories (searchBox through cookieDismiss)
- 09-01: Selector stability 3-tier classification (STABLE/MODERATE/UNSTABLE) with XPath sub-classification
- 09-01: Confidence scoring: coverage (4+ categories) x stability ratio (50%+) = HIGH

### Pending Todos

1. Smart multi-tab management with context-aware navigation (area: general) - `.planning/todos/pending/2026-02-14-smart-multi-tab-management.md`

### Blockers/Concerns

- Site Guides Viewer design mismatch (deferred from v9.3, does not block v9.4)
- Google Sheets toolbar aria-labels must be inspected live during Phase 13 (color formatting selectors change with product updates)
- Workday/Greenhouse/Lever ATS selector precision needs live validation (15+ companies use these platforms)
- Phase 10 verifier flagged "internship/internships" keyword gap -- fixed by orchestrator (commit 027b4ef)

## Session Continuity

Last session: 2026-02-23
Stopped at: Phase 11 complete, ready for Phase 12 planning
Resume file: None
