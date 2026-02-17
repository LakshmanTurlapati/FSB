# Phase 5 Plan 01: Task Classification and Critical Action Registry Summary

**One-liner:** classifyTask() utility with 8 task types, critical action registry with 3-iteration cooldown, and channel-aware progress tracking using Phase 3 changeSignals

## Plan Details

- **Phase:** 05-task-completion-verification
- **Plan:** 01
- **Type:** execute
- **Started:** 2026-02-15T18:03:07Z
- **Duration:** ~3.4 min

## What Was Built

### Task 1: classifyTask() utility and critical action registry (CMP-03)

Added four new utility functions to background.js near createActionSignature():

1. **classifyTask(taskString)** -- Maps task strings to 8 types: email, messaging, form, shopping, search, extraction, navigation, general. Uses regex keyword patterns matching ai-integration.js detectTaskType() coverage. Email is checked before messaging to avoid "send" matching both.

2. **recordCriticalAction(session, action, result)** -- Records irrevocable actions (send, submit, purchase, order, delete, publish, post) in `session.criticalActionRegistry`. Stores tool, selector, elementText, iteration, timestamp. Caps at 20 entries (oldest dropped). Sets 3-iteration cooldown via createActionSignature().

3. **isCooledDown(session, action)** -- Pre-execution guard that returns true if the action signature is currently blocked (iteration < blockedUntilIteration).

4. **getCriticalActionSummary(session)** -- Returns compact array of { description, verified, cooldownRemaining } for prompt injection, capped at 300 chars total.

**Wiring points:**
- After action recorded in history (line ~6095): checks if click action with irrevocable verb in elementText or selector, calls recordCriticalAction
- Before action execution in loop (line ~5977): isCooledDown check skips cooled-down actions with warning log

### Task 2: Enhanced progress tracking with changeSignals channels (CMP-04)

Modified the madeProgress expression (previously lines 6235-6240) to use Phase 3 changeSignals:

- **Before:** `domChanged && actionsSucceeded > 0` (any DOM change counted)
- **After:** `changeSignals.changed && channels.some(ch => ['structural', 'content', 'pageState'].includes(ch)) && actionsSucceeded > 0` (only substantive channels count)

Added extraction-task-specific progress: when `classifyTask(session.task) === 'extraction'` and getText returned non-empty content, counts as progress even without DOM changes. This prevents false 6-iteration hard stops on read-only extraction tasks.

Added `progressSignal` field to debug logging for traceability.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed slimActionResult missing value field for getText/getAttribute**

- **Found during:** Task 1 (while reading slimActionResult to understand action recording)
- **Issue:** `slimActionResult()` did not preserve `result.value`, but multiple downstream consumers (line 6225 newDataExtracted check, lines 6277/6352 hard-stop text display) reference `a.result?.value` on slimmed results. This meant `newDataExtracted` was always false and hard-stop text display showed nothing.
- **Fix:** Added `if (result.value !== undefined) slim.value = ...` to slimActionResult with 200-char truncation
- **Files modified:** background.js (slimActionResult function)
- **Commit:** 23dee29 (included in Task 1 commit)

## Task Commits

| Task | Name | Commit | Key Changes |
|------|------|--------|-------------|
| 1 | classifyTask utility and critical action registry (CMP-03) | 23dee29 | classifyTask(), recordCriticalAction(), isCooledDown(), getCriticalActionSummary(), IRREVOCABLE_VERB_PATTERN, cooldown pre-check wiring, slimActionResult value fix |
| 2 | Enhanced progress tracking with changeSignals channels (CMP-04) | 4c72e45 | madeProgress expression rewritten with changeSignals.channels, extraction task progress, progressSignal logging |

## Decisions Made

- CMP-03-01: classifyTask() uses simplified regex patterns (no site guide dependency) -- sufficient for background.js classification needs
- CMP-03-02: Critical action registry caps at 20 entries with FIFO eviction to bound memory
- CMP-03-03: Cooldown skip logs a warning but does NOT block the entire iteration -- only the specific action is skipped
- CMP-04-01: Interaction-only channel changes no longer count as progress (aligns with CHG-06 from Phase 3)
- CMP-04-02: Extraction tasks count getText with non-empty value as progress (prevents false hard stops)

## Files Modified

- **background.js**: Added classifyTask(), recordCriticalAction(), isCooledDown(), getCriticalActionSummary(), IRREVOCABLE_VERB_PATTERN constant, cooldown wiring in action loop, enhanced madeProgress logic, fixed slimActionResult value preservation

## Verification Results

1. classifyTask('send a message on LinkedIn') -> 'messaging' (correct)
2. classifyTask('fill out the contact form') -> 'form' (correct)
3. classifyTask('go to amazon.com') -> 'navigation' (correct)
4. classifyTask('get the price of the first item') -> 'extraction' (correct)
5. Critical action registry records entries and enforces 3-iteration cooldown (verified in code)
6. Progress tracking uses changeSignals.channels, not bare domChanged boolean (verified at line 6390)
7. No changes to content.js or ai/ai-integration.js (verified via git diff)

## Self-Check: PASSED
