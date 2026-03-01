# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-27)

**Core value:** Reliable single-attempt execution - the AI decides correctly, the mechanics execute precisely
**Current focus:** v10.0 CLI Architecture - Phase 18 Plan 02 (next)

## Current Position

Phase: 18 of 19 (in progress)
Plan: 1 of 2 in phase 18
Status: Plan 18-01 Complete
Last activity: 2026-03-01 -- Completed 18-01 (AI Integration Wiring - CLI Parser Pipeline Swap)

Progress: [######----] 60%

## Performance Metrics

**Velocity:**
- Total plans completed: 6 (v10.0)
- Average duration: 4min
- Total execution time: 0.4 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 15 | 2 | 6min | 3min |
| 16 | 2 | 6min | 3min |
| 17 | 1 | 11min | 11min |
| 18 | 1 | 4min | 4min |

**Recent Trend:**
- Last 5 plans: 3min, 4min, 2min, 11min, 4min
- Trend: stable

*Updated after each plan completion*
| Phase 18 P01 | 4min | 2 tasks | 3 files |

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
- [17-01]: CLI_COMMAND_TABLE uses compact markdown table format grouped by category with per-command examples
- [17-01]: Progressive stuck recovery: Level 1 alternatives + help, Level 2 anti-patterns, Level 3 force action
- [17-01]: help command is a signal (like done/fail) -- parser returns {signal:'help', helpVerb} for automation loop
- [17-01]: Response parsing/retry code intentionally NOT modified -- Phase 18 scope
- [18-01]: parseCliResponse is the single entry point for all AI response parsing -- no JSON fallback
- [18-01]: sanitizeActions extracted as module-level function (not class method) for reusability
- [18-01]: CLI reformat retry sends AI's original response back asking for reformatting before failing
- [18-01]: Model-specific JSON formatting instructions deleted -- CLI format is model-agnostic

### Pending Todos

1. Smart multi-tab management with context-aware navigation (area: general) - `.planning/todos/pending/2026-02-14-smart-multi-tab-management.md`

### Blockers/Concerns

- Site Guides Viewer design mismatch (deferred from v9.3)
- LLM output format compliance varies across providers -- Grok/GPT-4o handle CLI well, less capable models may struggle
- 43+ site guide files need CLI COMMON PATTERNS enrichment (Phase 17 Plan 02)

## Session Continuity

Last session: 2026-03-01
Stopped at: Completed 18-01-PLAN.md
Resume file: None
