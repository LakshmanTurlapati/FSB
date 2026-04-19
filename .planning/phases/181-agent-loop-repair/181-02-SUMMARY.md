---
phase: 181-agent-loop-repair
plan: "02"
subsystem: agent-loop
tags: [wiring, hook-pipeline, agent-loop, safety-breakers]
dependency_graph:
  requires: [181-01]
  provides: [createSessionHooks, runAgentLoop-wiring]
  affects: [background.js, handleStartAutomation, executeAutomationTask]
tech_stack:
  added: []
  patterns: [hook-pipeline-factory, options-object-injection, typeof-guards]
key_files:
  created: []
  modified: [background.js]
decisions:
  - "executeCDPToolDirect set to null -- CDP tools route through message listener (Plan 01 restored handlers)"
  - "executeAutomationTask also rewired to runAgentLoop (3 total call sites, not just the 2 in handleStartAutomation)"
  - "startAutomationLoop body preserved per D-03, marked @deprecated with zero external call sites"
metrics:
  duration: "3 min"
  completed: "2026-04-19"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 1
requirements:
  - LOOP-01
  - LOOP-02
  - LOOP-03
  - LOOP-04
  - LOOP-05
  - LOOP-06
---

# Phase 181 Plan 02: Wire runAgentLoop as Canonical Automation Path Summary

createSessionHooks factory and runAgentLoop wiring replace the legacy startAutomationLoop at all 3 entry points with the modular agent loop using HookPipeline, CostTracker, and structured safety breakers.

## What Was Done

### Task 1: Create createSessionHooks function in background.js
**Commit:** 852b725

Added `createSessionHooks(sessionId)` function after cleanupSession/isSessionTerminating, before reactivateSession (line 976). The function:

- Creates a new `HookPipeline` instance
- Registers `createSafetyBreakerHook(checkSafetyBreakers)` on `LIFECYCLE_EVENTS.BEFORE_ITERATION` -- enforces $2 cost limit, 10-min time limit, 500-iteration cap
- Registers `createToolProgressHook` on `LIFECYCLE_EVENTS.AFTER_TOOL_EXECUTION` -- sends overlay progress via sendSessionStatus
- Registers `createPermissionHook` on `LIFECYCLE_EVENTS.BEFORE_TOOL_EXECUTION` -- pre-checks tool permissions
- Uses `typeof` guards on all hook factories so the function degrades gracefully if any module fails to load

### Task 2: Rewire handleStartAutomation and executeAutomationTask to call runAgentLoop
**Commit:** 01adfc8

Replaced `startAutomationLoop(sessionId)` with `runAgentLoop(sessionId, options)` at 3 call sites:

1. **Session reactivation path** (follow-up commands on existing sessions) -- line 4778
2. **New session path** (fresh automation start) -- line 5093
3. **executeAutomationTask** (background agent execution) -- line 5247

Each call site:
- Creates a fresh HookPipeline via `createSessionHooks(sessionId)`
- Passes the full options object: `activeSessions`, `persistSession`, `sendSessionStatus`, `broadcastDashboardProgress`, `endSessionOverlays`, `cleanupSession`, `startKeepAlive`, `executeCDPToolDirect` (null), `handleDataTool` (null), `resolveAuthWall` (typeof-guarded), `hooks`, `emitter` (null)
- Uses typeof guards for `broadcastDashboardProgress` and `resolveAuthWall` which may or may not exist

Additionally marked `startAutomationLoop` (line 7521) with `@deprecated` JSDoc and LEGACY comment block per D-03. Function body preserved but has zero external call sites -- only self-recursive setTimeout calls remain within its own body.

## Requirements Addressed

| Requirement | How |
|------------|-----|
| LOOP-01 | popup/sidepanel -> handleStartAutomation -> runAgentLoop executes within 2 seconds |
| LOOP-02 | Agent loop cycles tool_use -> tool execution -> tool_result -> AI continuation (agent-loop.js protocol) |
| LOOP-03 | Session state persists to chrome.storage.session via persistSession in options |
| LOOP-04 | Stuck detection fires after 3 repeated actions via detectStuck in agent-loop.js |
| LOOP-05 | Safety breakers ($2 cost, 10 min time, 500 iteration cap) enforced via checkSafetyBreakers through HookPipeline |
| LOOP-06 | Task completion detected via complete_task/partial_task/fail_task tools stops the session cleanly |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] executeAutomationTask also rewired**
- **Found during:** Task 2
- **Issue:** The plan mentioned 2 call sites in handleStartAutomation, plus a note to "search for any other calls." executeAutomationTask (background agent executor) at line 5246 also called startAutomationLoop.
- **Fix:** Rewired executeAutomationTask to runAgentLoop with the same options pattern, ensuring background agents also use the modular loop.
- **Files modified:** background.js
- **Commit:** 01adfc8

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 852b725 | Add createSessionHooks function with HookPipeline wiring |
| 2 | 01adfc8 | Rewire 3 call sites from startAutomationLoop to runAgentLoop |

## Self-Check: PASSED

- background.js: FOUND
- Commit 852b725: FOUND
- Commit 01adfc8: FOUND
- 181-02-SUMMARY.md: FOUND
- createSessionHooks function count: 1 (correct)
- runAgentLoop(sessionId call sites: 3 (correct)
