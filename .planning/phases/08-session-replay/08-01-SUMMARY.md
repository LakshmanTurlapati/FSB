---
phase: 08-session-replay
plan: 01
subsystem: session-replay
tags: [replay, actionHistory, persistence, background-engine]
dependency-graph:
  requires: [06-unified-session-continuity, 07-session-history-ui]
  provides: [actionHistory-persistence, replay-engine, replay-message-handler]
  affects: [08-02-replay-ui]
tech-stack:
  added: []
  patterns: [step-by-step-replay, critical-vs-noncritical-failure, clearInput-prepend]
key-files:
  created: []
  modified:
    - utils/automation-logger.js
    - background.js
decisions:
  - id: RPL-01
    summary: "Replay sessions use isReplay flag and skip AI instance creation entirely"
  - id: RPL-02
    summary: "Critical tools (navigate, searchGoogle) abort replay on failure; all others skip and continue"
  - id: RPL-03
    summary: "clearInput prepended before every type action during replay to prevent text accumulation"
  - id: RPL-04
    summary: "actionHistory capped at 100 successful entries per session for storage efficiency"
  - id: RPL-05
    summary: "Replay termination detected by checking session.status !== 'replaying' in loop body"
metrics:
  duration: "2m 2s"
  completed: "2026-02-16"
---

# Phase 8 Plan 01: Persist actionHistory and Build Replay Engine Summary

**One-liner:** actionHistory persistence in saveSession (both modes) plus full replay engine with step-by-step execution, clearInput prepend, critical/non-critical failure handling, and progress reporting via statusUpdate messages.

## Task Commits

| Task | Name | Commit | Key Changes |
|------|------|--------|-------------|
| 1 | Persist actionHistory and build replay engine | 7dd0e1f | automation-logger.js saveSession (both modes), background.js replay functions |

## What Was Built

### automation-logger.js Changes

**saveSession -- NEW MODE (line ~462):**
Added `actionHistory` field to the session object, filtering to successful actions only, capping at 100 entries, and mapping to minimal fields (tool, params, result, timestamp).

**saveSession -- APPEND MODE (line ~441):**
Added conditional `actionHistory` update block that applies the same filter/cap/map logic when `sessionData.actionHistory` is present.

### background.js Changes

**getReplayDelay(tool):**
Returns appropriate inter-action delay based on tool type. Navigation: 1500ms, clicks: 500ms, typing: 300ms, other: 200ms.

**loadReplayableSession(sessionId):**
Reads from `chrome.storage.local` `fsbSessionLogs`, extracts `actionHistory`, filters to 19 replayable tool types and successful results only. Returns `{ session, replayableActions, originalTask, originalUrl }` or null.

**executeReplaySequence(replaySessionId):**
Core replay loop that:
- Iterates through `session.replaySteps` from `session.currentStep`
- Checks for termination (isTerminating or status change) at each step
- Prepends `clearInput` before `type` actions via `sendMessageWithRetry`
- Sends `statusUpdate` with progress percentage via `chrome.runtime.sendMessage`
- Executes each action via `sendMessageWithRetry` with `visualContext` including `isReplay: true`
- Records results in `session.actionHistory` with `replayStep` index
- Aborts on critical tool failures (navigate, searchGoogle); skips non-critical failures
- Sends `automationComplete` or `automationError` on completion
- Calls `sendSessionStatus` to clean up content script overlays
- Calls `automationLogger.logSessionEnd`, `saveSession`, and `cleanupSession`

**handleReplaySession(request, sender, sendResponse):**
Entry point for `replaySession` messages:
- Validates no other automation is running (checks activeSessions for non-idle entries)
- Gets active tab from `chrome.tabs.query`
- Calls `loadReplayableSession` to fetch and filter stored actions
- Creates replay session in `activeSessions` Map with `isReplay: true`, no AI instance
- Starts keep-alive, logs session start
- Responds immediately with `{ success, sessionId, totalSteps }`
- Fires `executeReplaySequence` asynchronously (not awaited)

**Message handler (switch case):**
Added `case 'replaySession'` routing to `handleReplaySession` with `return true` for async response.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] isSessionTerminating incompatible with replay status**

- **Found during:** Task 1 implementation
- **Issue:** `isSessionTerminating()` checks `session.status !== 'running'` which would always return true for replay sessions (status is 'replaying')
- **Fix:** Used direct session property checks in `executeReplaySequence` instead of calling `isSessionTerminating()`: checks `!currentSession || currentSession.isTerminating || currentSession.status !== 'replaying'`
- **Files modified:** background.js
- **Commit:** 7dd0e1f

## Verification Results

1. actionHistory in automation-logger.js saveSession: present in both NEW MODE and APPEND MODE blocks
2. handleReplaySession in background.js: exists as function (line 1847) and switch case (line 3916)
3. executeReplaySequence in background.js: exists as async function (line 1703)
4. loadReplayableSession in background.js: exists as async function (line 1649)
5. getReplayDelay in background.js: exists as function (line 1637)
6. clearInput prepend in executeReplaySequence: present at lines 1719-1730
7. Node syntax check: both files pass `node -c` without errors

## Self-Check: PASSED
