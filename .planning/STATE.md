# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-23)

**Core value:** Reliable single-attempt execution - the AI decides correctly, the mechanics execute precisely
**Current focus:** v9.4 Phase 14.1 - Fix batch action behavior on Google Sheets (URGENT hotfix)

## Current Position

Phase: 14.1 of 14.1
Plan: 1 of 1 complete
Status: Phase 14.1 complete -- Google Sheets batch type action fix shipped
Last activity: 2026-02-24 -- Completed 14.1-01 fix batch action behavior on Google Sheets

Progress: [##########] 100% (18/18 plans for Phases 9-14.1)

## Performance Metrics

**v9.3 Velocity:**
- Total plans completed: 17
- Average duration: 2.5 min
- Total execution time: ~26.0 min

**v9.4 Velocity:**
- Total plans completed: 17
- Average duration: 2.5 min
- Total execution time: ~51.4 min

## Accumulated Context

### Decisions

Full decision log in PROJECT.md Key Decisions table.

Recent decisions:
- 14.1-01: Suppression threshold set to 2+ type actions (single type on Sheets is valid)
- 14.1-01: URL regex requires /d/ path segment to match only open Sheets documents
- 14.1-01: batchHandled flag pattern replaces else-if chain for suppressed batch fall-through
- 14.1-01: First action from suppressed batch preserved as single action (no wasted iteration)
- 14-02: MAX_BATCH_SIZE = 8 enforced via slice regardless of AI compliance (safety cap)
- 14-02: DOM stability between batch actions: waitForPageStability (300ms stable, 200ms network quiet) for non-navigation, pageLoadWatcher for navigation
- 14-02: batchActions takes precedence over actions when both present, warning logged
- 14-02: BATCH_ACTION_INSTRUCTIONS as module-level constant, referenced in full system prompt
- 14-01: 85-entry static TIMEZONE_TO_COUNTRY map (no npm dependency), getUserLocale() called once at session start
- 14-01: USER LOCALE section injected into ALL task types with optional chaining for backward compatibility
- 14-01: Career prompt Phase 2 includes explicit location filtering instruction defaulting to user's detected country
- 11-03: clearConversationHistory called (not delete) to preserve AI instance for multi-turn within each phase
- 11-03: session.startTime reset rather than increasing MAX_SESSION_DURATION -- keeps 5-minute per-phase budget
- 13-02: Formatting directive replaces (not appends to) data entry directive when formattingPhase is true
- 13-02: buildSheetsFormattingDirective placed as module-level standalone function before AIIntegration class
- 13-02: 9 steps ordered: escape, header styling, freeze, alternating colors, header text color, auto-size, link blue text, left-align, verify
- 13-02: Adaptive formatting section only injected for non-new sheets
- 13-02: Apply Link column letter dynamically computed from sd.columns.indexOf
- 13-01: Completion handler checks formattingComplete before formattingPhase to distinguish data entry done vs formatting done
- 13-01: maxIterations set to 25 for formatting pass (fewer operations than data entry)
- 13-01: Edge case: totalRows === 0 sets formattingComplete and formattingPhase to true, skipping formatting
- 13-01: rightClick added to toolPreferences for column resize context menu
- 12-02: Append detection uses formula bar reads to discover existing headers (canvas grid unreadable)
- 12-02: buildSheetTitle generates context-aware names from searchQuery (e.g., "Job Search - SWE Internships - Feb 2026")
- 12-02: Early 'multitab' return for "job listings to Google Sheets" -- "write" not in gatherActions
- 12-02: sd.sheetTitle used in directive instead of inline Date template for consistent naming
- 12-01: Sheets entry auto-triggers after finalizeMultiSiteSearch when task implies spreadsheet output
- 12-01: Job data injected directly into AI prompt (no getStoredJobs round-trip)
- 12-01: Column selection parsed from user task text using keyword aliases and restriction patterns (SHEETS-02)
- 12-01: detectTaskType returns multitab for write/enter/fill + Google Sheets/spreadsheet combinations
- 12-01: Progress overlay approximates rows written as floor(iterationCount/2) capped at totalRows
- 12-01: Session persisted every 5 iterations during Sheets entry to survive SW restarts
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

### Roadmap Evolution

- Phase 14.1 inserted after Phase 14: Fix batch action behavior on Google Sheets (URGENT)

### Blockers/Concerns

- Site Guides Viewer design mismatch (deferred from v9.3, does not block v9.4)
- Google Sheets toolbar aria-labels must be inspected live during Phase 13 (color formatting selectors change with product updates)
- Workday/Greenhouse/Lever ATS selector precision needs live validation (15+ companies use these platforms)
- Phase 10 verifier flagged "internship/internships" keyword gap -- fixed by orchestrator (commit 027b4ef)

## Session Continuity

Last session: 2026-02-24
Stopped at: Completed 14.1-01-PLAN.md (fix batch action behavior on Google Sheets) -- Phase 14.1 complete
Resume file: None
