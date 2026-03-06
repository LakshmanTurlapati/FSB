---
gsd_state_version: 1.0
milestone: v10.0
milestone_name: CLI Architecture
status: completed
stopped_at: Phase 22 context gathered
last_updated: "2026-03-06T12:46:13.794Z"
last_activity: 2026-03-06 -- Completed 22-01 (Markdown Snapshot Engine + Page Text Extractor)
progress:
  total_phases: 8
  completed_phases: 5
  total_plans: 11
  completed_plans: 15
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-27)

**Core value:** Reliable single-attempt execution - the AI decides correctly, the mechanics execute precisely
**Current focus:** Phase 22 Page Text Extraction for Reading Tasks - Plan 01 Complete

## Current Position

Phase: 22
Plan: 1 of 1 in phase 22 (complete)
Status: Plan 22-01 complete -- Markdown snapshot engine + page text extractor
Last activity: 2026-03-06 -- Completed 22-01 (Markdown Snapshot Engine + Page Text Extractor)

Progress: [##########] 100%

## Performance Metrics

**Velocity:**
- Total plans completed: 10 (v10.0)
- Average duration: 5min
- Total execution time: 0.8 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 15 | 2 | 6min | 3min |
| 16 | 2 | 6min | 3min |
| 17 | 1 | 11min | 11min |
| 18 | 2 | 8min | 4min |
| 19 | 3 | 18min | 6min |
| 20 | 1 | 3min | 3min |
| 21 | 2 | 5min | 2.5min |

**Recent Trend:**
- Last 5 plans: 5min, 8min, 3min, 2min, 3min
- Trend: stable

*Updated after each plan completion*
| Phase 18 P01 | 4min | 2 tasks | 3 files |
| Phase 18 P02 | 4min | 2 tasks | 2 files |
| Phase 19 P01 | 5min | 2 tasks | 35 files |
| Phase 19 P02 | 5min | 2 tasks | 8 files |
| Phase 19 P03 | 8min | 3 tasks | 10 files |
| Phase 20 P01 | 3min | 2 tasks | 1 files |
| Phase 20 P02 | 3min | 2 tasks | 1 files |
| Phase 21 P01 | 2min | 2 tasks | 3 files |
| Phase 21 P02 | 3min | 2 tasks | 1 files |
| Phase 22 P01 | 3min | 2 tasks | 2 files |

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
- [18-02]: Conversation history stores raw CLI text via response._rawCliText -- no JSON.stringify
- [18-02]: Extractive fallback scans for CLI verb patterns instead of JSON action regex
- [18-02]: parseYAMLBlock is a simple state machine -- no external YAML library
- [18-02]: storejobdata data arg made optional to support both inline JSON and YAML block paths
- [18-02]: preprocessResponse preserves indented lines following recognized commands (YAML blocks)
- [19-01]: Golden responses include provider-specific quirks: xAI preamble, Gemini markdown wrapping
- [19-01]: DOM snapshots use Phase 16 YAML format with metadata header, region grouping, element refs
- [19-01]: Career search golden files all use YAML block storeJobData with 3 jobs and URL query params
- [19-02]: Real gpt-tokenizer UMD bundle (2MB, o200k_base) used over character estimation for accurate BPE counts
- [19-02]: JSON baselines use __USE_OLD_SYSTEM_PROMPT_TEMPLATE__ sentinel to avoid duplicating 700-line prompt
- [19-02]: Each JSON baseline is self-contained with full verbose fields, no dependency on YAML snapshots from 19-01
- [19-03]: CLI Validation nav item is debug-only (.debug-only-nav) -- shown only when Debug Mode enabled in Advanced Settings
- [19-03]: Live mode delegates to AIIntegration via service worker CLI_VALIDATION_LIVE_TEST message (no direct API calls from options page)
- [19-03]: Golden mode runs 24 tests (4 providers x 6 task types) offline; live mode is opt-in for real provider smoke testing
- [19-03]: 3-second rate limit guard between live test calls to prevent hitting provider rate limits
- [20-01]: Dedicated 'media' task type added to classifyTask() before gaming check (streaming platform detection)
- [20-01]: TASK_URL_PATTERNS module-scope constant map keyed by task type for per-type URL matching
- [20-01]: Score weights rebalanced: AI 0.30, URL 0.20, DOM 0.20, no-actions boost 0.20 (AI done + no-actions = 0.50)
- [20-01]: Extraction validator dual-path: getText traditional + DOM snapshot AI-reported data (+0.15 bonus)
- [Phase 20]: mediaValidator +0.30 URL bonus (strong but not instant-accept) per user decision
- [Phase 20]: Escape hatch at 3 consecutive rejected dones with escapeHatch flag and warning log
- [Phase 20]: Per-task-type min-length: 5 for media, 10 default (classify before min-length check)
- [21-01]: Disambiguation uses regex ref/selector detection to avoid misclassifying text as refs
- [21-01]: Compact snapshot synthesis reuses isInteractive filter for element selection
- [21-01]: Legacy fallback branches fully removed from buildContinuationPrompt
- [21-02]: Stuck trim keeps system prompt + last 4 messages (2 exchanges) when history > 5
- [21-02]: _injectFormatReminder one-time flag pattern for post-stuck CLI format reinforcement
- [21-02]: Dual-layer Sheets action cap: prompt instructs 8, parser truncates at 10
- [22-01]: Recursive visitor pattern over TreeWalker for natural depth tracking and subtree skipping
- [22-01]: Interactive elements skip children in walker to prevent text duplication (Pitfall 1)
- [22-01]: Region tracking via getRegion() during walk for document-order heading emission
- [22-01]: 80 element limit (up from 50) fitting within 12K char budget

### Roadmap Evolution

- Phase 21 added: Google Sheets CLI Engine Refinement
- Phase 22 added: Page text extraction for reading tasks

### Pending Todos

1. Smart multi-tab management with context-aware navigation (area: general) - `.planning/todos/pending/2026-02-14-smart-multi-tab-management.md`

### Blockers/Concerns

- Site Guides Viewer design mismatch (deferred from v9.3)
- LLM output format compliance varies across providers -- Grok/GPT-4o handle CLI well, less capable models may struggle
- 43+ site guide files need CLI COMMON PATTERNS enrichment (Phase 17 Plan 02)

## Session Continuity

Last session: 2026-03-06T13:17:09Z
Stopped at: Completed 22-01-PLAN.md
Resume file: .planning/phases/22-page-text-extraction-for-reading-tasks/22-01-SUMMARY.md
