---
phase: 139-dead-code-removal-polish
plan: 02
subsystem: automation-engine
tags: [dead-code-removal, background-js, refactor, agent-loop]

requires:
  - phase: 137-agent-loop-core-safety-mechanisms
    provides: runAgentLoop engine and background.js wiring
  - phase: 139-dead-code-removal-polish/plan-01
    provides: executeAutomationTask rewired to runAgentLoop
provides:
  - startAutomationLoop fully removed from background.js (~2,400 lines)
  - Multi-signal completion validators fully removed (~920 lines)
  - prefetchDOM and pendingDOMPrefetch removed
  - callAIAPI old wrapper and handleAICall handler removed
  - Dead helper functions removed (calculateActionDelay, outcomeBasedDelay, etc.)
  - runAgentLoop is the sole autopilot code path (7 call sites)
affects: [139-dead-code-removal-polish, ai-integration-cleanup]

tech-stack:
  added: []
  patterns:
    - "runAgentLoop is the sole autopilot entry point -- no parallel code paths"
    - "All callers pass full options object: activeSessions, persistSession, sendSessionStatus, etc."

key-files:
  created: []
  modified:
    - background.js

key-decisions:
  - "Kept login helpers (extractLoginFields, fillCredentialsOnPage, etc.) even though only called from deleted startAutomationLoop -- they are self-contained utilities that may be wired into agent-loop later"
  - "Kept DOM signal functions (quickHash, createDOMSignals, etc.) for same reason -- plan scope was the explicitly listed functions"
  - "Did not delete cli-parser.js or ai-integration.js dead code -- those are still referenced by ai-integration.js and out of plan scope"

patterns-established:
  - "Agent loop options pattern: { activeSessions, persistSession, sendSessionStatus, broadcastDashboardProgress, endSessionOverlays, startKeepAlive, executeCDPToolDirect, handleDataTool }"

requirements-completed: [CLN-03, CLN-04]

duration: 12min
completed: 2026-04-01
---

# Phase 139 Plan 02: Dead Code Deletion Summary

**Deleted startAutomationLoop (~2,400 lines), 23 completion validators (~920 lines), prefetchDOM, callAIAPI, and 12 dead helper functions from background.js -- 4,528 net lines removed**

## Performance

- **Duration:** 12 min
- **Started:** 2026-04-01T10:50:43Z
- **Completed:** 2026-04-01T11:03:00Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Rewired 3 remaining callers (launchNextCompanySearch, startSheetsDataEntry, startSheetsFormatting) to use runAgentLoop with full options object
- Deleted startAutomationLoop function (~2,400 lines) -- the old CLI-protocol autopilot loop
- Deleted all 23 multi-signal completion validator functions (~920 lines)
- Deleted callAIAPI old API wrapper, handleAICall dead message handler
- Deleted prefetchDOM, smartWaitAfterAction, and 10 dead helper functions
- Removed 'callAI' case from message handler switch statement
- background.js reduced from 14,229 to 9,701 lines (4,528 lines removed, 32% reduction)
- Syntax check passes, zero orphaned references to deleted functions

## Task Commits

Each task was committed atomically:

1. **Task 1: Rewire 3 remaining callers to runAgentLoop** - `72e5e25` (feat)
2. **Task 2: Delete startAutomationLoop, validators, prefetchDOM, and dead helpers** - `7730c47` (feat)

## Files Created/Modified
- `background.js` - Removed startAutomationLoop, completion validators, prefetchDOM, callAIAPI, handleAICall, and 12 dead helper functions. Rewired 3 callers to runAgentLoop.

## Decisions Made
- Kept login helpers (extractLoginFields, fillCredentialsOnPage, fillCredentialsOnPageDirect, waitForLoginResponse) despite being only called from deleted startAutomationLoop. These are self-contained utility functions that may be useful when agent-loop adds login detection support.
- Kept DOM signal functions (quickHash, createDOMSignals, compareSignals, parseTopTypes, createDOMHash, handleMultiTabAction) for the same reason -- they are general utilities whose deletion is out of plan scope.
- Did not remove cli-parser.js import from background.js because ai-integration.js still calls parseCliResponse at runtime. Removing cli-parser.js requires coordinated cleanup of ai-integration.js first.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Merged main branch to get Phase 137 agent-loop.js**
- **Found during:** Task 1 (pre-execution check)
- **Issue:** Worktree was behind main, missing ai/agent-loop.js and 139-01 rewire commits
- **Fix:** Ran `git merge main` to fast-forward to include Phase 137 and 139-01 work
- **Files modified:** Multiple (fast-forward merge)
- **Verification:** runAgentLoop function available, 139-01 rewires present
- **Committed in:** (merge commit, not a task commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Merge was necessary prerequisite. No scope creep.

## Issues Encountered
- The Edit tool replaced only partial text for the prefetchDOM deletion (matched the beginning but not the full function body). Fixed by doing a second Edit to remove the remaining orphaned function body.

## Known Stubs
None. This plan only deletes code.

## Next Phase Readiness
- background.js is now clean of the old autopilot loop
- Remaining dead code: cli-parser.js still imported (ai-integration.js depends on parseCliResponse), CLI_COMMAND_TABLE/TASK_PROMPTS/buildMinimalUpdate still in ai-integration.js
- Login helper functions and DOM signal functions are dead code candidates for future cleanup
- Agent loop (runAgentLoop) is the sole autopilot path with 7 call sites

## Self-Check: PASSED

- background.js: FOUND
- 139-02-SUMMARY.md: FOUND
- Commit 72e5e25 (Task 1): FOUND
- Commit 7730c47 (Task 2): FOUND
- startAutomationLoop count: 0
- validateCompletion count: 0
- prefetchDOM count: 0
- callAIAPI count: 0
- runAgentLoop count: 7
- Line count: 9,701
- Syntax check: PASS

---
*Phase: 139-dead-code-removal-polish*
*Completed: 2026-04-01*
