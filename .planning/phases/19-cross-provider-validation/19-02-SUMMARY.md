---
phase: 19-cross-provider-validation
plan: 02
subsystem: testing
tags: [gpt-tokenizer, bpe, token-counting, json-baseline, cli-validation]

# Dependency graph
requires:
  - phase: 17-prompt-architecture-rewrite
    provides: CLI system prompt and CLI_COMMAND_TABLE
  - phase: 18-ai-integration-wiring
    provides: CLI-only response parsing pipeline
provides:
  - gpt-tokenizer UMD bundle for BPE token counting (o200k_base)
  - TokenComparator class for CLI vs JSON format comparison
  - OLD_SYSTEM_PROMPT_TEMPLATE reconstructing pre-CLI JSON tool docs
  - CLI_SYSTEM_PROMPT_SNAPSHOT of current CLI prompt
  - reconstructJSONSnapshot() for YAML-to-JSON conversion
  - 6 JSON baseline files representing old verbose format per page type
affects: [19-03-PLAN, cross-provider-validation]

# Tech tracking
tech-stack:
  added: [gpt-tokenizer (UMD bundle, o200k_base encoding)]
  patterns: [token comparison with per-component breakdown, JSON baseline reconstruction from YAML snapshots]

key-files:
  created:
    - lib/gpt-tokenizer.min.js
    - utils/token-comparator.js
    - test-data/json-baselines/search-results.json
    - test-data/json-baselines/form-page.json
    - test-data/json-baselines/data-table.json
    - test-data/json-baselines/google-sheets.json
    - test-data/json-baselines/career-page.json
    - test-data/json-baselines/search-page.json
  modified: []

key-decisions:
  - "Used real gpt-tokenizer UMD bundle (2MB) over character estimation fallback -- provides accurate BPE counts"
  - "JSON baselines use __USE_OLD_SYSTEM_PROMPT_TEMPLATE__ reference string instead of duplicating 700-line prompt in each file"
  - "Each JSON baseline is self-contained with realistic element counts matching page type expectations"

patterns-established:
  - "Token comparison pattern: system prompt + DOM snapshot + user message components measured separately"
  - "JSON baseline format: _meta + systemPrompt + domSnapshot + userMessage structure"

requirements-completed: [TEST-02]

# Metrics
duration: 5min
completed: 2026-03-02
---

# Phase 19 Plan 02: Token Measurement Infrastructure Summary

**BPE token counting via gpt-tokenizer o200k_base bundle, TokenComparator module with CLI vs JSON comparison, and 6 JSON baseline files for search-results, form-page, data-table, google-sheets, career-page, search-page**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-02T02:36:47Z
- **Completed:** 2026-03-02T02:42:00Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Bundled real gpt-tokenizer UMD library (2MB, o200k_base encoding) for accurate BPE token counting
- Created TokenComparator class with per-component token comparison (system prompt, DOM snapshot, user message), JSON baseline reconstruction from YAML, and aggregate reduction calculation
- Generated 6 JSON baseline files with realistic old-format verbose element objects (position, visibility, interactionState, selectors, htmlContext) covering all page types

## Task Commits

Each task was committed atomically:

1. **Task 1: Bundle gpt-tokenizer and create TokenComparator module** - `c62493b` (feat)
2. **Task 2: Create JSON baseline files for all 6 DOM snapshot types** - `bd993d2` (feat)

**Plan metadata:** [pending] (docs: complete plan)

## Files Created/Modified
- `lib/gpt-tokenizer.min.js` - BPE tokenizer UMD bundle for o200k_base encoding (2MB)
- `utils/token-comparator.js` - TokenComparator class, OLD_SYSTEM_PROMPT_TEMPLATE, CLI_SYSTEM_PROMPT_SNAPSHOT, reconstructJSONSnapshot()
- `test-data/json-baselines/search-results.json` - Google SERP with 20 elements (search box, result links, snippets, pagination)
- `test-data/json-baselines/form-page.json` - Contact form with 12 elements (name/email/phone inputs, select, textarea, submit)
- `test-data/json-baselines/data-table.json` - Product catalog with 28 elements (table headers, product rows with name/price/description/stock)
- `test-data/json-baselines/google-sheets.json` - Sheets interface with 18 elements (Name Box, formula bar, toolbar, waffle cells, sheet tabs)
- `test-data/json-baselines/career-page.json` - Career site with 23 elements (search, filters, 3 job listings with company/location/date/apply)
- `test-data/json-baselines/search-page.json` - Navigation site with 18 elements (nav links, search form, hero section, product cards, footer)

## Decisions Made
- Used real gpt-tokenizer UMD bundle (2MB o200k_base) instead of character estimation fallback, since accurate BPE counts are needed for meaningful token reduction measurement
- JSON baselines reference OLD_SYSTEM_PROMPT_TEMPLATE via sentinel string "__USE_OLD_SYSTEM_PROMPT_TEMPLATE__" to avoid duplicating the ~700 line JSON tool documentation in each of the 6 files
- Each baseline contains self-contained domSnapshot data with realistic element counts and full verbose fields (no dependency on YAML snapshots that are created in plan 19-01)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Token measurement infrastructure complete for plan 19-03 UI panel integration
- JSON baselines ready for TokenComparator.loadJSONBaseline() calls
- gpt-tokenizer.min.js ready for script tag inclusion in options.html
- 19-01 (CLIValidator + golden responses) and 19-03 (UI panel) can proceed

## Self-Check: PASSED

- All 8 created files verified present on disk
- Commit c62493b (Task 1) verified in git log
- Commit bd993d2 (Task 2) verified in git log
- All 6 JSON baselines parse as valid JSON with required fields

---
*Phase: 19-cross-provider-validation*
*Completed: 2026-03-02*
