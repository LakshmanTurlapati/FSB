---
phase: 11
plan: 03
subsystem: multi-site-orchestration
tags: [conversation-history, session-timeout, phase-transition, gap-closure]

dependency_graph:
  requires: ["11-01", "11-02"]
  provides:
    - "Clean AI conversation state on company transitions"
    - "Clean AI conversation state on career-to-Sheets transitions"
    - "Dynamic session timeout that resets per phase"
  affects: ["12-01", "12-02", "13-01", "13-02"]

tech_stack:
  added: []
  patterns:
    - "Conversation reset at phase boundaries (clearConversationHistory)"
    - "Per-phase session timer reset (session.startTime = Date.now())"

key_files:
  created: []
  modified:
    - background.js

key_decisions:
  - "clearConversationHistory called (not sessionAIInstances.delete) to preserve AI instance for multi-turn within each phase"
  - "session.startTime reset rather than increasing MAX_SESSION_DURATION -- keeps 5-minute per-phase budget"
  - "Tasks 1 and 2 committed together since they modify the same three functions at the same insertion points"

metrics:
  duration: "1m 28s"
  completed: "2026-02-24"
---

# Phase 11 Plan 03: Phase Transition Conversation Reset and Session Timer Fix Summary

**One-liner:** Clears AI conversation history and resets 5-minute session timer at all three phase transitions (company switch, Sheets entry, Sheets formatting) to eliminate context bleed and premature timeouts in multi-site pipelines.

## Performance

- Duration: ~1.5 minutes
- Files modified: 1 (background.js)
- Lines added: 37 (conversation clear blocks + startTime resets)
- Lines removed: 4 (renumbered comments)
- Zero deviations from plan

## Accomplishments

### Gap 1 (P0): Company-to-company context bleed -- FIXED
Added `clearConversationHistory()` call in `launchNextCompanySearch` so the AI starts fresh when switching from e.g. Microsoft to Amazon. Without this, the AI carried Microsoft DOM context and instructions into the Amazon search, causing confusion and wasted iterations.

### Gap 2 (P1): Career-to-Sheets context bleed -- FIXED
Added `clearConversationHistory()` call in `startSheetsDataEntry` so the AI enters Sheets mode without career search memory. Without this, the AI wasted the first ~3 iterations still thinking about job search pages.

### Gap 3 (P2): Premature 5-minute session timeout -- FIXED
Added `session.startTime = Date.now()` in all three phase transition functions so the 5-minute timeout clock restarts for each phase. A 2-company search + Sheets entry + formatting workflow easily exceeds 5 minutes total, but each individual phase completes within the 5-minute budget.

## Task Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1+2 | Clear conversation history and reset session timer on phase transitions | bd0b1ef | background.js |

## Files Modified

- **background.js**: Added conversation clear + startTime reset blocks in `launchNextCompanySearch` (lines 6670-6681), `startSheetsDataEntry` (lines 7128-7136), `startSheetsFormatting` (lines 7219-7227)

## Decisions Made

1. **Clear, not delete**: Called `clearConversationHistory()` instead of `sessionAIInstances.delete(sessionId)` to preserve the AI instance for multi-turn conversation within each phase.
2. **Reset timer, not extend duration**: Reset `session.startTime` instead of increasing `MAX_SESSION_DURATION` to maintain the 5-minute per-phase budget (a sensible guardrail).
3. **Combined commit**: Tasks 1 and 2 were committed together since they modify the exact same three functions at adjacent insertion points and are logically coupled (both are phase-transition fixes).

## Deviations from Plan

None -- plan executed exactly as written.

## Issues Encountered

None.

## Verification Results

1. `clearConversationHistory` appears 4 times in background.js: cleanupSession (existing, line 909-910) + 3 new phase transitions (lines 6672, 7130, 7222)
2. All calls guarded by `if (ai && typeof ai.clearConversationHistory === 'function')`
3. No `sessionAIInstances.delete` added in transition functions (only in existing cleanup/error paths)
4. `session.startTime = Date.now()` appears 4 times: session creation (line 951) + 3 new phase transitions (lines 6681, 7136, 7227)
5. `MAX_SESSION_DURATION` unchanged at `5 * 60 * 1000` (line 7386)
6. Correct ordering in all three functions: session state reset -> conversation clear -> startTime reset -> persist -> setTimeout

## Next Phase Readiness

This plan closes the three root-cause gaps in the E2E multi-site pipeline. The full flow (multi-company search -> Sheets data entry -> Sheets formatting) should now complete without context bleed or premature timeouts.

No blockers for future work. The conversation reset pattern established here can be reused for any future phase transitions.

## Self-Check: PASSED
