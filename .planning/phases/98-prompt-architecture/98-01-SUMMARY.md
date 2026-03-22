---
phase: 98-prompt-architecture
plan: 01
subsystem: ai
tags: [prompt-engineering, task-detection, CDP-tools, canvas, cli-command-table]

requires:
  - phase: 97-tool-parity
    provides: CDP tool registration in CLI_COMMAND_TABLE, COMMAND_REGISTRY, and isValidTool
provides:
  - TOOL SELECTION GUIDE decision table in CLI_COMMAND_TABLE for all 5 interaction paradigms
  - Canvas task type detection in detectTaskType (keyword regex + Design guide category)
  - PRIORITY TOOLS injection in getToolsDocumentation for canvas, form, gaming task types
  - Canvas case in getRelevantTools returning CDP coordinate tools first
  - Canvas TASK_PROMPTS entry with coordinate interaction strategy
  - Text selection and file upload sub-pattern hints in _buildTaskGuidance
affects: [prompt-architecture, validation, robustness]

tech-stack:
  added: []
  patterns:
    - "PRIORITY TOOLS block prepended to CLI_COMMAND_TABLE per task type"
    - "Sub-pattern keyword hints appended to _buildTaskGuidance output"
    - "Task type detection via regex keyword matching with word boundaries"

key-files:
  created: []
  modified:
    - ai/ai-integration.js

key-decisions:
  - "TOOL SELECTION GUIDE placed above CLI COMMAND REFERENCE, not replacing it"
  - "Canvas keyword regex uses word boundaries to prevent false positives on partial matches"
  - "PRIORITY TOOLS block prepended to full table rather than replacing sections"
  - "Text selection and file upload are sub-patterns (keyword hints) not dedicated task types"

patterns-established:
  - "Task-type-conditional prompt injection via priorityBlock in getToolsDocumentation"
  - "Sub-pattern detection via regex in _buildTaskGuidance for cross-cutting tool hints"

requirements-completed: [PROMPT-01, PROMPT-02]

duration: 2min
completed: 2026-03-22
---

# Phase 98 Plan 01: Prompt Architecture Summary

**TOOL SELECTION GUIDE decision table and canvas task-type-aware PRIORITY TOOLS injection for autopilot system prompt**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-22T13:19:17Z
- **Completed:** 2026-03-22T13:21:58Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Added TOOL SELECTION GUIDE to CLI_COMMAND_TABLE covering all 5 interaction paradigms (DOM, CDP, Text Range, File Upload, Sheets) with a decision rule
- Canvas task type detection via keyword regex and Design site guide category mapping
- Task-type-aware PRIORITY TOOLS injection in getToolsDocumentation for canvas, form, and gaming task types
- Canvas-specific CDP tool returns in getRelevantTools, TASK_PROMPTS canvas entry, and sub-pattern hints for text selection and file upload keywords

## Task Commits

Each task was committed atomically:

1. **Task 1: Add TOOL SELECTION GUIDE to CLI_COMMAND_TABLE and canvas task type to detectTaskType** - `c066bfa` (feat)
2. **Task 2: Add canvas case to getRelevantTools and PRIORITY TOOLS injection to getToolsDocumentation** - `97817b5` (feat)

## Files Created/Modified
- `ai/ai-integration.js` - TOOL SELECTION GUIDE in CLI_COMMAND_TABLE, canvas task type detection, PRIORITY TOOLS injection, canvas TASK_PROMPTS, text selection/file upload sub-pattern hints

## Decisions Made
- TOOL SELECTION GUIDE placed at top of CLI_COMMAND_TABLE (above CLI COMMAND REFERENCE) to ensure AI reads interaction paradigm guidance before individual tool details
- Canvas keyword regex uses word boundaries (`\b`) to prevent false positives -- e.g., "map" alone does not match but "map click" or "map pin" does
- PRIORITY TOOLS block is prepended to CLI_COMMAND_TABLE, not replacing any sections -- full tool reference always available
- Text selection and file upload treated as sub-patterns (not dedicated task types) because they co-occur with other task types -- hints are appended via _buildTaskGuidance

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - all functionality is fully wired.

## Next Phase Readiness
- Prompt architecture complete, autopilot now receives correct tool priority guidance based on task type
- Ready for robustness fixes (Phase 99) and validation testing (Phase 100) against v0.9.7 edge case diagnostics
- Canvas tasks will use CDP coordinate tools by default; form tasks will use DOM tools; gaming tasks will use keyboard controls

---
*Phase: 98-prompt-architecture*
*Completed: 2026-03-22*
