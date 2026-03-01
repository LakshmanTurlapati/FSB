# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-27)

**Core value:** Reliable single-attempt execution - the AI decides correctly, the mechanics execute precisely
**Current focus:** v10.0 CLI Architecture - Phase 18 (next)

## Current Position

Phase: 17 of 19 (complete)
Plan: 2 of 2 in phase 17 (COMPLETE)
Status: Phase 17 Complete
Last activity: 2026-03-01 -- Completed 17-02 (Site Guide CLI Enrichment)

Progress: [######----] 60%

## Performance Metrics

**Velocity:**
- Total plans completed: 6 (v10.0)
- Average duration: 4min
- Total execution time: 0.3 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 15 | 2 | 6min | 3min |
| 16 | 2 | 6min | 3min |
| 17 | 2 | 14min | 7min |

**Recent Trend:**
- Last 5 plans: 3min, 3min, 4min, 2min, 7min
- Trend: stable (Phase 17 larger scope - 84 files)

*Updated after each plan completion*
| Phase 17 P02 | 7min | 2 tasks | 84 files |

## Accumulated Context

### Decisions

Full decision log in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [v10.0 research]: CLI-only mode chosen (no JSON fallback) -- full commitment to CLI format
- [v10.0 research]: No new dependencies -- CLI parser is hand-written vanilla JS, no YAML library
- [v10.0 research]: Change boundary is steps 6-9 of 21-step automation data flow -- content scripts untouched
- [15-01]: MODIFIER_FLAG_MAP for keyPress --ctrl/--shift/--alt/--meta mapping to ctrlKey/shiftKey/altKey/metaKey
- [15-01]: selectOption defaults to 'value' param with --by-value no-op, --by-index for numeric coercion
- [15-01]: Fixed research typo getstoredobs -> getstoredjobs in COMMAND_REGISTRY
- [15-02]: preprocessResponse strips both leading preamble AND trailing conversational text using COMMAND_REGISTRY lookups
- [15-02]: parseCliResponse output includes normalizeResponse compatibility stubs for smooth Phase 18 swap-in
- [15-02]: situationAnalysis auto-populated from reasoning[] join for backward compatibility
- [16-01]: Forms are NOT regions -- sub-grouped WITHIN landmark regions with 4-space indent
- [16-01]: Region order: @dialog > @nav > @header > @main > @aside > @footer
- [16-01]: Fingerprint includes href/name/id to prevent collapsing distinct elements
- [16-01]: XPath selectors from site guides skipped for annotation matching (CSS only)
- [16-02]: getYAMLSnapshot routed through async message handler for proper response channel management
- [16-02]: Token reduction self-test passes at >= 0% since YAML replaces compact + HTML + page structure blocks
- [16-02]: getGuideSelectorsForUrl is a top-level function in service worker context (no explicit export)
- [Phase 17]: COMMON PATTERNS inserted after guidance header, before first content section in all 84 site guides
- [Phase 17]: Career guides tiered: ATS platforms get comprehensive CLI, job boards get full search+extract, company guides get compact navigate+search+storejobdata

### Pending Todos

1. Smart multi-tab management with context-aware navigation (area: general) - `.planning/todos/pending/2026-02-14-smart-multi-tab-management.md`

### Blockers/Concerns

- Site Guides Viewer design mismatch (deferred from v9.3)
- LLM output format compliance varies across providers -- Grok/GPT-4o handle CLI well, less capable models may struggle
- 84 site guide files enriched with CLI COMMON PATTERNS (Phase 17 complete)

## Session Continuity

Last session: 2026-03-01
Stopped at: Completed 17-02-PLAN.md (Phase 17 complete)
Resume file: None
