---
phase: 207-background-session-lifecycle-hardening
plan: "02"
title: "Silent Catch Diagnostic Logging"
subsystem: background
tags: [diagnostic-logging, message-delivery, silent-catch, TRACK-02]
dependency_graph:
  requires:
    - phase: 207-01
      provides: "Guard clause blind broadcasts with silent catches (Phase 206 message shape)"
  provides:
    - "Diagnostic console.warn on all sendMessage delivery failures in agent-loop.js (3 catches)"
    - "Diagnostic console.warn on all sendMessage delivery failures in background.js (12 catches)"
  affects:
    - "DevTools console (now shows message delivery failures with sessionId and error)"
tech_stack:
  added: []
  patterns:
    - "console.warn('[agent-loop] ... delivery failed', { sessionId, error }) on sendMessage .catch"
    - "console.warn('[FSB] ... sendMessage delivery failed', { sessionId, error }) on sendMessage .catch"
key_files:
  created: []
  modified:
    - "ai/agent-loop.js"
    - "background.js"
decisions:
  - "Agent-loop catches use [agent-loop] prefix; background.js catches use [FSB] prefix for source disambiguation"
  - "Each handler logs sessionId (or agentId for agent runs) and err.message -- no task content, URLs, or user data (T-207-04 mitigation)"
  - "extractAndStoreMemories, taskSummary, and tabs.get silent catches intentionally preserved (internal operations, not message delivery)"
  - "12th background.js sendMessage catch replaced beyond the plan's 11-item list (second agentRunComplete at line 12562, Rule 2 deviation)"
requirements-completed: [TRACK-02]
metrics:
  duration: 4min
  completed: 2026-04-25
  tasks_completed: 2
  tasks_total: 2
  files_modified: 2
---

# Phase 207 Plan 02: Silent Catch Diagnostic Logging Summary

**All silent .catch handlers on sendMessage calls replaced with diagnostic console.warn logging that records sessionId and error message**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-25T04:16:38Z
- **Completed:** 2026-04-25T04:21:16Z
- **Tasks:** 2/2
- **Files modified:** 2

## Accomplishments

- Replaced 3 silent `.catch(function(){})` handlers in `ai/agent-loop.js` (notifySidepanel + 2 guard clause broadcasts) with diagnostic logging that records sessionId and error message
- Replaced 12 silent `.catch(() => {})` handlers on `chrome.runtime.sendMessage` calls in `background.js` with diagnostic logging that records action type, sessionId/agentId, and error message
- Preserved all non-sendMessage silent catches (13 `extractAndStoreMemories`, 1 taskSummary promise chain, 1 `tabs.get` returning null) unchanged
- Zero TRACK-02 blind spots remain: every sendMessage delivery failure in both files now produces a console.warn with enough context to diagnose sidepanel notification gaps

## Task Commits

Each task was committed atomically:

1. **Task 1: Replace silent catches in agent-loop.js (D-06)** - `98d07c9` (feat)
2. **Task 2: Replace silent catches in background.js (D-07)** - `ebd3cc8` (feat)

## Files Created/Modified

- `ai/agent-loop.js` - 3 silent catches replaced with diagnostic handlers (notifySidepanel, session_not_found guard, session_not_running guard)
- `background.js` - 12 silent catches replaced with diagnostic handlers (agentRunComplete x2, statusUpdate x3, automationError x4, automationComplete x2, loginDetected x1)

## Decisions Made

- Agent-loop catches use `[agent-loop]` prefix; background.js catches use `[FSB]` prefix for source disambiguation in DevTools console
- Each handler logs only sessionId/agentId and err.message -- never task content, URLs, or user data (T-207-04 threat mitigation)
- Non-sendMessage silent catches intentionally preserved per plan scope

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing coverage] Additional agentRunComplete sendMessage catch at line 12562**
- **Found during:** Task 2
- **Issue:** A second `agentRunComplete` sendMessage at line 12562 had a silent `.catch(() => {})` that was not in the plan's 11-item list (the plan only listed the one at line ~5578)
- **Fix:** Replaced with the same diagnostic handler pattern
- **Files modified:** background.js
- **Commit:** ebd3cc8

## Verification Results

| Check | Result |
|-------|--------|
| grep "catch(function() {})" agent-loop.js count | 0 (PASS) |
| grep "delivery failed" agent-loop.js count | 3 (PASS) |
| grep "sendMessage delivery failed" background.js count | 12 (PASS -- 11 planned + 1 Rule 2) |
| extractAndStoreMemories catches preserved | 13 (PASS) |
| npm test agent-loop suite | 16/16 passed (PASS) |
| npm test regressions | 7 pre-existing runtime-contract failures unchanged (PASS) |

## Known Stubs

None -- all diagnostic handlers are fully wired with console.warn logging.

## Self-Check: PASSED

- FOUND: ai/agent-loop.js
- FOUND: background.js
- FOUND: 98d07c9 (Task 1 commit)
- FOUND: ebd3cc8 (Task 2 commit)

---
*Phase: 207-background-session-lifecycle-hardening*
*Completed: 2026-04-25*
