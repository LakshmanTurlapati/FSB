---
phase: 15-cli-parser-module
plan: 01
subsystem: parser
tags: [cli, tokenizer, state-machine, command-registry, vanilla-js]

# Dependency graph
requires:
  - phase: none
    provides: First phase of v10.0 -- no prior dependencies
provides:
  - tokenizeLine() state-machine tokenizer for CLI command lines
  - COMMAND_REGISTRY with 75 entries mapping all tools and aliases
  - classifyTarget() for ref vs CSS selector discrimination
  - coerceValue() for type coercion (string, number, ref, json)
  - mapCommand() bridging tokenizer output to {tool, params} objects
affects: [15-02 (adds orchestration and exports), 18 (AI integration wiring)]

# Tech tracking
tech-stack:
  added: []
  patterns: [two-layer parser architecture, data-driven command registry, state-machine tokenizer]

key-files:
  created: [ai/cli-parser.js]
  modified: []

key-decisions:
  - "Used MODIFIER_FLAG_MAP constant for keyPress --ctrl/--shift/--alt/--meta to ctrlKey/shiftKey/altKey/metaKey mapping"
  - "selectOption defaults to 'value' param name with --by-value no-op and --by-index for numeric index coercion"
  - "Fixed research typo: getstoredobs corrected to getstoredjobs in COMMAND_REGISTRY"

patterns-established:
  - "COMMAND_REGISTRY: all command knowledge in one lookup table, no duplicated verb lists"
  - "Ref classification: /^e\\d+$/i -> params.ref, everything else -> params.selector"
  - "Signal commands return {signal, message} not {tool, params}"

requirements-completed: [CLI-01, CLI-02, CLI-04, CLI-05]

# Metrics
duration: 3min
completed: 2026-02-28
---

# Phase 15 Plan 01: CLI Parser Core Engine Summary

**Tokenizer state machine, 75-entry COMMAND_REGISTRY, and command mapper producing {tool, params} objects identical to content script dispatch expectations**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-28T19:22:40Z
- **Completed:** 2026-02-28T19:26:13Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Built character-by-character tokenizer with 3 states (NORMAL, DOUBLE_QUOTED, SINGLE_QUOTED) handling backslash escaping, quoted strings, and --flag extraction
- Created complete COMMAND_REGISTRY with 75 entries covering all 28+ tools from content/actions.js plus CLI aliases (rclick, dblclick, goto, search, enter, select, check, key, back, forward, etc.)
- Implemented mapCommand() with ref/selector discrimination, type coercion, modifier key flag mapping, selectOption --by-value/--by-index handling, toggleCheckbox --checked/--unchecked, pressKeySequence comma-splitting, and scroll shorthand defaults
- All 15 test cases pass including full tokenizer-to-mapper integration flow

## Task Commits

Each task was committed atomically:

1. **Task 1: Build tokenizer state machine and COMMAND_REGISTRY** - `22ffc0c` (feat)
2. **Task 2: Build command mapper with param assignment and flag merging** - `b055136` (feat)

## Files Created/Modified
- `ai/cli-parser.js` - Core CLI parser module (453 lines): tokenizeLine, COMMAND_REGISTRY, classifyTarget, coerceValue, mapCommand

## Decisions Made
- Used MODIFIER_FLAG_MAP constant for keyPress modifier flag mapping (--ctrl -> ctrlKey etc.) rather than inline conditionals -- cleaner and extensible
- selectOption uses 'value' as the default param name for the second positional arg, with --by-value as a no-op confirmation and --by-index to rename and coerce to number
- Fixed research document typo: getstoredobs corrected to getstoredjobs (both occurrences in research were duplicated keys with the typo)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Plan 02 (15-02) can proceed to add preprocessResponse, parseCliResponse orchestrator, and module exports
- All foundational data structures and algorithms are in place
- No blockers or concerns

## Self-Check: PASSED

- ai/cli-parser.js: FOUND (453 lines)
- 15-01-SUMMARY.md: FOUND
- Commit 22ffc0c (Task 1): FOUND
- Commit b055136 (Task 2): FOUND
- node -c syntax check: PASSED

---
*Phase: 15-cli-parser-module*
*Completed: 2026-02-28*
