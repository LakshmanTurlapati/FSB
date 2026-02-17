---
phase: 02-dom-serialization-pipeline
plan: 03
subsystem: ai-prompt-construction
tags: [dom-serialization, task-adaptive, dynamic-elements, content-modes, buildMinimalUpdate]
completed: 2026-02-14
duration: 3.1 min
dependency_graph:
  requires: ["02-01", "02-02"]
  provides: ["task-adaptive buildMinimalUpdate", "dynamic element count scaling", "content mode mapping"]
  affects: ["03-xx (context quality)", "04-xx (memory)"]
tech_stack:
  added: []
  patterns: ["content mode mapping", "dynamic element budget", "instance stashing for multi-turn"]
key_files:
  created: []
  modified:
    - ai/ai-integration.js
decisions:
  - id: DOM-04-COMPLETE
    what: "Dynamic element count replaces fixed MAX_MINIMAL_ELEMENTS=25"
    why: "Simple pages (<=30 elements) get full coverage, complex pages (60+) scale to 50-150 with compression"
  - id: DIF-03-COMPLETE
    what: "Task-adaptive content modes in buildMinimalUpdate via getContentMode + detectTaskType"
    why: "Form tasks prioritize inputs, extraction prioritizes text, navigation prioritizes links"
  - id: MULTI-TURN-BUDGET
    what: "8000-char element budget for multi-turn formatElements"
    why: "Generous for 50-80 elements at moderate compression, keeps multi-turn responses reasonable"
  - id: TASK-STASH
    what: "Task string stashed as this._currentTask in getAutomationActions"
    why: "buildMinimalUpdate needs task string for detectTaskType but receives only context object (task is a separate parameter)"
metrics:
  tasks_completed: 1
  tasks_total: 1
  deviations: 1
---

# Phase 02 Plan 03: Task-Adaptive buildMinimalUpdate Summary

Task-adaptive content modes and dynamic element scaling in buildMinimalUpdate for multi-turn iterations, completing DIF-03 and DOM-04 across both prompt paths.

## What Was Done

### Task 1: Add getContentMode helper and update buildMinimalUpdate with dynamic element count and task-adaptive formatting
**Commit:** `1c69574`

Changes to `ai/ai-integration.js`:

1. **Stashed task string on instance** (`this._currentTask = task || ''` in `getAutomationActions`) so `buildMinimalUpdate` can access the task for type detection. This was needed because `buildMinimalUpdate` only receives the `context` object, not the `task` string directly.

2. **Added `getContentMode(taskType)` method** near `prioritizeForTask`:
   - Maps task types to content modes: `form/email` -> `input_fields`, `extraction` -> `text_only`, all others -> `full`
   - Content mode is displayed in the element header for debugging visibility

3. **Replaced fixed `MAX_MINIMAL_ELEMENTS = 25`** with dynamic calculation:
   - Simple pages (<=30 elements): show all available elements
   - Medium pages (31-60 elements): show up to 50
   - Complex pages (61+): scale to 50-150 (50% of total, capped at 150)
   - Dynamic count used in both modal and standard element selection branches

4. **Added task type detection** in `buildMinimalUpdate` using `detectTaskType` with fallback chain: `context.task || this._currentTask || ''`

5. **Updated `formatElements` call** with 8000-char budget and taskType parameter, enabling task-adaptive priority sorting (form tasks boost inputs, navigation boosts links, etc.)

6. **Updated element header** from `VISIBLE INTERACTIVE ELEMENTS` to `PAGE ELEMENTS (..., mode: ${contentMode})` reflecting the broader scope and content mode.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Task string not available in buildMinimalUpdate context**
- **Found during:** Task 1, step 3
- **Issue:** `context.task` is not set in the context object built by `background.js`. The `task` parameter is passed separately to `getAutomationActions(task, domState, context)`.
- **Fix:** Added `this._currentTask = task || ''` stash in `getAutomationActions` alongside existing stashes (`this._lastActionResult`, `this._currentUrl`). Used fallback chain `context?.task || this._currentTask || ''` in `buildMinimalUpdate`.
- **Files modified:** `ai/ai-integration.js` (line 980)
- **Commit:** `1c69574`

## Task Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Task-adaptive buildMinimalUpdate with dynamic element count | `1c69574` | ai/ai-integration.js |

## Requirement Coverage

| Requirement | Status | How |
|-------------|--------|-----|
| DIF-03 | COMPLETE | Task-adaptive content modes in both buildPrompt (prioritizeForTask) and buildMinimalUpdate (getContentMode + taskType) |
| DOM-04 | COMPLETE | Dynamic element budget in both paths: buildPrompt (compression + budget partitioning), buildMinimalUpdate (dynamic count + 8000-char budget) |

## Phase 2 Success Criteria Status

1. LinkedIn messaging page: AI prompt contains full compose area -- DONE (15K budget from 02-01)
2. Element text distinguishes similar items -- DONE (150 chars for list items from 02-01)
3. No mid-element truncation -- DONE (whole-or-nothing from 02-02)
4. Simple pages get full coverage, complex pages scale up -- DONE (dynamic element count this plan)
5. Form tasks emphasize inputs, extraction emphasizes text, navigation emphasizes links -- DONE (task-adaptive prioritization this plan + 02-02)

## Next Phase Readiness

Phase 2 (DOM Serialization Pipeline) is COMPLETE. All 3 plans executed:
- 02-01: HARD_PROMPT_CAP raised to 15K, adaptive text limits, budget-partitioned prompt construction
- 02-02: Budget-aware formatElements with dynamic compression and task-adaptive priority
- 02-03: Task-adaptive buildMinimalUpdate with dynamic element count (this plan)

Ready for Phase 3 (Context Quality / Memory improvements).

## Self-Check: PASSED
