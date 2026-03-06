---
phase: 22-page-text-extraction-for-reading-tasks
plan: 02
subsystem: ai-integration
tags: [readpage, markdown-snapshot, cli-parser, prompt-building, action-handler]

requires:
  - phase: 22-page-text-extraction-for-reading-tasks
    plan: 01
    provides: "buildMarkdownSnapshot, extractPageText, getMarkdownSnapshot handler, readPage handler"
provides:
  - "readpage CLI command in COMMAND_REGISTRY"
  - "readPage action handler in actions.js"
  - "Markdown snapshot in AI prompts (replaces compact format)"
  - "readpage in CLI_COMMAND_TABLE documentation"
affects: [ai-prompt-format, action-execution-flow, dom-snapshot-pipeline]

tech-stack:
  added: []
  patterns: [markdown-first-snapshot-with-compact-fallback, inline-action-result-text]

key-files:
  created: []
  modified:
    - ai/cli-parser.js
    - content/actions.js
    - ai/ai-integration.js
    - background.js

key-decisions:
  - "readpage flags merge into params directly (params.full) not params.flags.full -- matches existing tokenizer behavior"
  - "Markdown snapshot fetched as separate message after getDOM, consolidated at single point before consumption"
  - "readPage text preserved in slimActionResult up to 30K chars for inline AI prompt inclusion"
  - "Compact snapshot preserved as fallback when markdown generation fails"

patterns-established:
  - "Markdown-first snapshot: check _markdownSnapshot before _compactSnapshot in prompt builders"
  - "readPage result text delivered inline in action history for same-turn AI consumption"

requirements-completed: [P22-06, P22-07]

duration: 4min
completed: 2026-03-06
---

# Phase 22 Plan 02: CLI Command Wiring and Markdown Snapshot Integration Summary

**End-to-end readpage CLI command with markdown snapshot replacing compact element format in all AI prompts**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-06T16:56:39Z
- **Completed:** 2026-03-06T17:01:21Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- readpage CLI command recognized by parser, producing {tool: 'readPage'} with optional selector and --full flag
- readPage action handler in actions.js calls FSB.extractPageText with viewport/full mode control
- AI prompts now use markdown snapshot format with interleaved text and backtick element refs in [PAGE_CONTENT] block
- CLI_COMMAND_TABLE documents readpage with syntax, description, and example
- readPage result text included inline in action history so AI can use extracted text in same turn
- System prompt updated to describe markdown format with backtick refs and readpage command

## Task Commits

Each task was committed atomically:

1. **Task 1: Add readpage to CLI parser and action handler** - `67a9bbf` (feat)
2. **Task 2: Replace compact snapshot with markdown snapshot in AI integration** - `d4b3fd1` (feat)

## Files Created/Modified
- `ai/cli-parser.js` - Added readpage entry in COMMAND_REGISTRY (Information section) with optional selector arg
- `content/actions.js` - Added readPage action handler using FSB.extractPageText with viewport/full mode, selector support, error handling
- `ai/ai-integration.js` - Updated buildIterationUpdate and buildInitialUserPrompt to prefer markdown snapshot; added readpage to CLI_COMMAND_TABLE; updated system prompt format descriptions; added readPage result text inline delivery and param summarization
- `background.js` - Added readPage action description; added markdown snapshot fetch (getMarkdownSnapshot message) consolidated before DOM consumption; added markdown snapshot in prefetchDOM; preserved readPage text/charCount in slimActionResult

## Decisions Made
- readpage --full sets params.full = true (not params.flags.full) because the tokenizer merges flags directly into params via general flag handler at line 544
- Markdown snapshot is fetched as a separate getMarkdownSnapshot message rather than embedded in getDOM response -- keeps DOM fetch fast and markdown generation decoupled
- Single consolidated markdown snapshot fetch point placed right before DOM data consumption ensures SPA recovery paths also get markdown snapshots
- readPage result text truncated at 30K chars in both slimActionResult and prompt inclusion to prevent conversation history explosion

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed flag access pattern for readPage**
- **Found during:** Task 1
- **Issue:** Plan assumed params.flags.full but tokenizer merges flags directly into params (params.full)
- **Fix:** Changed action handler to check params.full instead of params.flags?.full
- **Files modified:** content/actions.js

**2. [Rule 2 - Missing functionality] Added readPage text preservation in slimActionResult**
- **Found during:** Task 1
- **Issue:** slimActionResult only preserved result.value (for getText) but readPage returns result.text + result.charCount
- **Fix:** Added text/charCount preservation to slimActionResult with 30K truncation
- **Files modified:** background.js

**3. [Rule 2 - Missing functionality] Added readPage result inline in action history**
- **Found during:** Task 1
- **Issue:** Action history summary only showed tool(params) - STATUS, not the extracted text content
- **Fix:** Added readPage-specific result text inclusion in action history prompt
- **Files modified:** ai/ai-integration.js

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Self-Check: PASSED

- All source files exist and syntax-check clean
- Both commits (67a9bbf, d4b3fd1) verified in git log
- readpage entry confirmed in COMMAND_REGISTRY
- readPage action handler confirmed in actions.js
- CLI_COMMAND_TABLE includes readpage row
- Markdown snapshot fetch confirmed in background.js
- buildIterationUpdate and buildInitialUserPrompt both check _markdownSnapshot first

---
*Phase: 22-page-text-extraction-for-reading-tasks*
*Completed: 2026-03-06*
