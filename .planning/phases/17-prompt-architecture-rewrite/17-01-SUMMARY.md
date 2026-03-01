---
phase: 17-prompt-architecture-rewrite
plan: 01
subsystem: ai-prompt
tags: [cli, prompt-engineering, command-table, done-command, help-command]

# Dependency graph
requires:
  - phase: 15-cli-parser-module
    provides: "COMMAND_REGISTRY with 60+ verb-to-tool mappings, parseCliResponse()"
  - phase: 16-yaml-snapshot-format
    provides: "YAML snapshot with element refs (e1, e2, etc.)"
provides:
  - "All AI-facing prompt strings in ai-integration.js rewritten for CLI command grammar"
  - "CLI_COMMAND_TABLE constant with compact markdown command reference"
  - "help command registered in COMMAND_REGISTRY as signal command"
  - "done command documented as sole task completion mechanism in all prompts"
affects: [18-response-pipeline-swap, 17-02-site-guide-enrichment]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "CLI command table in system prompt (compact markdown, grouped by category)"
    - "# reasoning comments instead of JSON reasoning field"
    - "done 'summary' as sole task completion mechanism"
    - "Progressive stuck recovery escalation (Level 1-3)"
    - "help signal command for self-documenting CLI"

key-files:
  created: []
  modified:
    - "ai/ai-integration.js"
    - "ai/cli-parser.js"

key-decisions:
  - "CLI_COMMAND_TABLE uses compact markdown table format with per-command examples, grouped by category"
  - "Progressive stuck recovery: Level 1 suggest alternatives + help, Level 2 add anti-patterns, Level 3 force action"
  - "help command is a signal (like done/fail) -- parser returns {signal: 'help', helpVerb} for automation loop handling"
  - "Response parsing code (normalizeResponse, parseActionResponse) intentionally NOT modified -- Phase 18 scope"
  - "Retry enhancement prompts (lines 4483-4488) left as JSON -- they are parsing pipeline code, not first-response prompts"

patterns-established:
  - "CLI format in prompts: verb ref args, one per line, # for reasoning"
  - "done command replaces taskComplete JSON field in all prompt strings"
  - "Anti-patterns section in stuck recovery: explicit DO NOT list"

requirements-completed: [PROMPT-01, PROMPT-02, PROMPT-03, PROMPT-05, PROMPT-06, PROMPT-07]

# Metrics
duration: 11min
completed: 2026-03-01
---

# Phase 17 Plan 01: Prompt Architecture Rewrite Summary

**All ~35 JSON format locations in ai-integration.js rewritten to CLI command grammar with compact command table, done/help signal commands, and progressive stuck recovery**

## Performance

- **Duration:** 11 min
- **Started:** 2026-03-01T06:53:22Z
- **Completed:** 2026-03-01T07:04:22Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Replaced TOOL_DOCUMENTATION JSON object with CLI_COMMAND_TABLE (compact markdown table, ~70 lines vs ~100 lines of JSON)
- Rewrote system prompt: CLI response format, # reasoning comments, done command, element ref syntax
- Converted all conditional prompt injections (multiSite, sheetsData, stuck recovery, completion candidate) to CLI format
- Added progressive stuck recovery with contextual suggestions and anti-patterns
- Registered help command as signal in COMMAND_REGISTRY with helpRequested/helpVerb in parse result

## Task Commits

Each task was committed atomically:

1. **Task 1: Rewrite prompt constants and system prompt builder for CLI format** - `0ac63f7` (feat)
2. **Task 2: Rewrite stuck recovery prompts, conditional directive injections, and remaining JSON locations** - `7c5895d` (feat)

## Files Created/Modified
- `ai/ai-integration.js` - All prompt strings rewritten from JSON to CLI format (TOOL_DOCUMENTATION -> CLI_COMMAND_TABLE, MINIMAL_CONTINUATION_PROMPT, BATCH_ACTION_INSTRUCTIONS, system prompt builder, getToolsDocumentation, stuck recovery, conditional directives)
- `ai/cli-parser.js` - help command added to COMMAND_REGISTRY as signal, help signal handler in parseCliResponse

## Decisions Made
- CLI_COMMAND_TABLE uses compact markdown table format grouped by category with per-command example column (user decision from CONTEXT.md)
- Progressive stuck recovery escalation: Level 1 (suggest alternatives including help), Level 2 (add explicit anti-patterns DO NOT list), Level 3 (force specific alternative command). This matches the existing escalation pattern at stuckCounter thresholds.
- help command registered as signal (like done/fail) -- returns {signal: 'help', message: verbArg} instead of dispatching to content script. The automation loop in background.js will handle this signal in Phase 18.
- Response parsing/retry code (normalizeResponse, parseActionResponse, progressive enhancement at lines 4483-4488) intentionally left as-is. These handle runtime AI responses and are Phase 18 scope.
- getRelevantTools() default case updated to return static tool list since TOOL_DOCUMENTATION object no longer exists.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed getRelevantTools TOOL_DOCUMENTATION reference**
- **Found during:** Task 1
- **Issue:** getRelevantTools() default case referenced TOOL_DOCUMENTATION object which no longer exists after replacing with CLI_COMMAND_TABLE string
- **Fix:** Replaced with static array of common tool names
- **Files modified:** ai/ai-integration.js
- **Verification:** node -c passes, no runtime reference errors
- **Committed in:** 0ac63f7 (Task 1 commit)

**2. [Rule 1 - Bug] Fixed clickSearchResult capitalization in prompt strings**
- **Found during:** Task 2
- **Issue:** Several prompt strings used camelCase clickSearchResult instead of CLI lowercase clicksearchresult
- **Fix:** Converted all prompt-facing references to lowercase CLI verb
- **Files modified:** ai/ai-integration.js (lines 2373, 3602)
- **Verification:** grep confirms all prompt strings use lowercase CLI verb
- **Committed in:** 7c5895d (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both auto-fixes necessary for correctness. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All prompt strings speak CLI command grammar exclusively -- ready for Phase 17 Plan 02 (site guide enrichment)
- Phase 18 (response pipeline swap) can proceed: prompts tell AI to output CLI, parseCliResponse ready to parse it
- Response parsing code still handles JSON format (backward compatible during transition)

---
*Phase: 17-prompt-architecture-rewrite*
*Completed: 2026-03-01*

## Self-Check: PASSED
