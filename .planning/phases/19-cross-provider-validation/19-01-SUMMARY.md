---
phase: 19-cross-provider-validation
plan: 01
subsystem: testing
tags: [cli-validator, mock-dom, golden-responses, cross-provider, yaml-snapshots, edge-cases]

# Dependency graph
requires:
  - phase: 15-cli-parser-module
    provides: parseCliResponse function and COMMAND_REGISTRY for response parsing
  - phase: 16-yaml-dom-snapshot
    provides: YAML snapshot format with element refs (eN) and region grouping
  - phase: 18-ai-integration-wiring
    provides: CLI-only response pipeline and YAML block parsing for storeJobData
provides:
  - CLIValidator class with test runner, MockDOM execution engine, assertion framework
  - FAILURE_TYPES taxonomy with 10 categorized failure patterns
  - DEFAULT_SUITES with 6 test suites covering all task types
  - 24 golden response files (4 providers x 6 task types) with provider-specific quirks
  - 6 DOM snapshot YAML fixtures with 25-42 elements each
  - 4 edge case test files (special chars, URLs, YAML blocks, multiline reasoning)
affects: [19-02-token-measurement, 19-03-ui-panel-integration]

# Tech tracking
tech-stack:
  added: []
  patterns: [golden-response-testing, mock-dom-execution, failure-categorization]

key-files:
  created:
    - utils/cli-validator.js
    - test-data/golden-responses/xai/*.txt (6 files)
    - test-data/golden-responses/openai/*.txt (6 files)
    - test-data/golden-responses/anthropic/*.txt (6 files)
    - test-data/golden-responses/gemini/*.txt (6 files)
    - test-data/dom-snapshots/*.yaml (6 files)
    - test-data/edge-cases/*.txt (4 files)
  modified: []

key-decisions:
  - "Golden responses include provider-specific quirks: xAI preamble in 2 files, Gemini markdown wrapping in 3 files"
  - "DOM snapshots use Phase 16 YAML format with metadata header, region grouping, and element refs"
  - "Edge case files are provider-agnostic (no metadata header) for generic parsing validation"
  - "Career search golden files all use YAML block storeJobData with 3 jobs and URL query params"

patterns-established:
  - "Golden response file format: metadata comment header then provider-realistic CLI output"
  - "MockDOM execution pattern: build from element array, applyAction per parsed action, check element states"
  - "Failure categorization: 10 types from JSON_REVERT to URL_TRUNCATED for targeted debugging"

requirements-completed: [TEST-01, TEST-03]

# Metrics
duration: 5min
completed: 2026-03-02
---

# Phase 19 Plan 01: Core Test Infrastructure Summary

**CLIValidator module with MockDOM execution, 10-type failure taxonomy, 6 test suites, and 34 golden/snapshot/edge-case test data files covering 4 providers x 6 task types**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-02T02:36:37Z
- **Completed:** 2026-03-02T02:41:09Z
- **Tasks:** 2
- **Files modified:** 35

## Accomplishments
- CLIValidator module (1233 lines) with complete test runner: suite registration, golden response loading, MockDOM execution, failure categorization, structured report generation
- 24 golden response files with realistic provider-specific quirks: xAI conversational preamble, Gemini markdown code fence wrapping, OpenAI verbose reasoning, Anthropic clean output
- 6 DOM snapshot YAML files matching Phase 16 format with 25-42 elements each, including Google Sheets with hint:nameBox annotation
- 4 edge case files exercising special characters, complex URLs with query params, multi-line YAML blocks with colons in values, and 10+ reasoning lines interspersed with commands

## Task Commits

Each task was committed atomically:

1. **Task 1: CLIValidator module with test runner, MockDOM, and assertion engine** - `00ce46a` (feat)
2. **Task 2: Create all golden response files, DOM snapshots, and edge case test data** - `d65664b` (feat)

## Files Created/Modified
- `utils/cli-validator.js` - CLIValidator class, MockDOM, MockElement, FAILURE_TYPES, DEFAULT_SUITES (1233 lines)
- `test-data/golden-responses/xai/*.txt` - 6 golden responses with conversational preamble quirk
- `test-data/golden-responses/openai/*.txt` - 6 golden responses with verbose reasoning comments
- `test-data/golden-responses/anthropic/*.txt` - 6 golden responses with clean minimal output
- `test-data/golden-responses/gemini/*.txt` - 6 golden responses with markdown code fence wrapping
- `test-data/dom-snapshots/search-page.yaml` - 25 elements, homepage with navigation and categories
- `test-data/dom-snapshots/form-page.yaml` - 30 elements, contact form with all input types
- `test-data/dom-snapshots/data-table.yaml` - 42 elements, product catalog with 5-row table
- `test-data/dom-snapshots/search-results.yaml` - 30 elements, Google-like search results
- `test-data/dom-snapshots/google-sheets.yaml` - 35 elements, Sheets with Name Box, formula bar, waffle cells
- `test-data/dom-snapshots/career-page.yaml` - 42 elements, career site with 3 job listings
- `test-data/edge-cases/special-chars.txt` - Type commands with quotes, angle brackets, ampersands, dollar signs, backslashes
- `test-data/edge-cases/url-arguments.txt` - Navigate commands with complex URLs (?, &, =, #, %20)
- `test-data/edge-cases/yaml-block.txt` - storeJobData with multi-line YAML including colons in descriptions and URLs with query params
- `test-data/edge-cases/multiline-reasoning.txt` - 10+ reasoning lines interspersed with 4 CLI commands

## Decisions Made
- Golden responses include provider-specific quirks as documented in Phase 15 research: xAI gets conversational preamble ("Sure, I'll help..."), Gemini gets markdown code fence wrapping (triple backticks), matching real-world observed behavior
- DOM snapshots follow Phase 16 YAML format with url/title/scroll/viewport metadata, @region grouping, and eN element refs
- Edge case files omit provider metadata headers since they test parsing mechanics independent of provider
- All career-search files use identical storeJobData YAML structure (company: Google, 3 jobs) to enable cross-provider comparison of YAML block handling

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Test infrastructure is complete and ready for Phase 19 Plan 02 (token measurement)
- CLIValidator can be instantiated and DEFAULT_SUITES registered in the options page
- Golden responses are ready for both golden mode (file loading) and as reference for live mode testing
- DOM snapshots can be loaded as reference but primary testing uses inline mockDOMElements from DEFAULT_SUITES

## Self-Check: PASSED

- FOUND: utils/cli-validator.js
- FOUND: test-data/golden-responses/xai/navigation.txt (spot-checked)
- FOUND: test-data/golden-responses/xai/career-search.txt (spot-checked)
- FOUND: test-data/golden-responses/gemini/search-click.txt (spot-checked)
- FOUND: test-data/dom-snapshots/google-sheets.yaml (spot-checked)
- FOUND: test-data/edge-cases/yaml-block.txt (spot-checked)
- FOUND: commit 00ce46a (Task 1)
- FOUND: commit d65664b (Task 2)
- File counts: 24 golden responses + 6 DOM snapshots + 4 edge cases = 34 files

---
*Phase: 19-cross-provider-validation*
*Completed: 2026-03-02*
