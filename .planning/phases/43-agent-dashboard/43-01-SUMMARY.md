---
phase: 43-agent-dashboard
plan: 01
subsystem: api
tags: [express, sqlite, websocket, rest-api, agent-management]

# Dependency graph
requires:
  - phase: 40-websocket-infrastructure
    provides: WebSocket relay, broadcastToRoom, fsbWebSocket client
provides:
  - PATCH /api/agents/:agentId endpoint for toggling agent enabled/disabled
  - GET /api/agents/:agentId/stats endpoint for per-agent cost savings
  - totalCostSaved in aggregate stats response
  - execution_mode and cost_saved in run recording
  - dash:agent-run-now WS handler dispatching to agent executor
  - ext:agent-run-progress and ext:agent-run-complete WS broadcasts
affects: [43-agent-dashboard]

# Tech tracking
tech-stack:
  added: []
  patterns: [WS message dispatch pattern for agent runs, per-agent stats query pattern]

key-files:
  created: []
  modified: [server/src/db/queries.js, server/src/routes/agents.js, ws/ws-client.js, background.js]

key-decisions:
  - "Used agentManager.getAgent (not bgAgentManager) matching existing codebase variable names"
  - "Used agentExecutor.execute (not executeAgent) matching existing codebase method name"
  - "Used serverSync.syncRun (not syncRunResult) matching existing codebase pattern from alarm handler"

patterns-established:
  - "Agent WS dispatch: ws-client.js validates then calls background.js function directly"
  - "Agent run broadcast: send ext:agent-run-progress on start, ext:agent-run-complete on finish"

requirements-completed: [AGNT-05]

# Metrics
duration: 3min
completed: 2026-03-18
---

# Phase 43 Plan 01: Agent Dashboard API & WS Wiring Summary

**Server PATCH/stats endpoints, cost tracking in queries, and dash:agent-run-now WS handler with progress broadcasting**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-18T04:06:19Z
- **Completed:** 2026-03-18T04:09:17Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Server queries now record execution_mode and cost_saved for every agent run, enabling cost savings tracking
- PATCH endpoint allows dashboard to toggle agent enabled/disabled with real-time broadcast
- Per-agent stats endpoint returns replay/AI breakdown and cost savings
- Dashboard can trigger immediate agent runs via WS with progress and completion feedback

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix server queries and add agent API endpoints** - `9abb73c` (feat)
2. **Task 2: Add dash:agent-run-now WS handler and agent run broadcasting** - `8c06384` (feat)

## Files Created/Modified
- `server/src/db/queries.js` - Added execution_mode/cost_saved to insertRun, SUM(cost_saved) to stats, updateAgentEnabled and getAgentPerStats prepared statements, toggleAgentEnabled and getPerAgentStats methods
- `server/src/routes/agents.js` - Added PATCH /:agentId for toggle, GET /:agentId/stats for per-agent costs, updated POST runs to pass executionMode/costSaved
- `ws/ws-client.js` - Added dash:agent-run-now case and _handleAgentRunNow method with validation
- `background.js` - Added startAgentRunNow function with progress broadcasting and run recording

## Decisions Made
- Used `agentManager` (not `bgAgentManager` as plan specified) to match actual codebase variable name
- Used `agentExecutor.execute()` (not `executeAgent()`) to match actual codebase API
- Used `serverSync.syncRun()` (not `syncRunResult()`) to match existing alarm handler pattern

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected variable and method names to match codebase**
- **Found during:** Task 2 (WS handler and background.js)
- **Issue:** Plan specified bgAgentManager.getAgent, agentExecutor.executeAgent, and serverSync.syncRunResult which don't exist in the codebase
- **Fix:** Used actual names: agentManager.getAgent, agentExecutor.execute, serverSync.syncRun
- **Files modified:** background.js
- **Verification:** grep confirmed all references match existing codebase patterns
- **Committed in:** 8c06384 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Essential correction -- using non-existent variable/method names would cause runtime errors. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All API endpoints and WS handlers ready for Plan 02 dashboard UI to consume
- PATCH toggle, per-agent stats, run-now, and cost tracking all wired and verified

## Self-Check: PASSED

All 4 modified files verified present. Both task commits (9abb73c, 8c06384) verified in git log.

---
*Phase: 43-agent-dashboard*
*Completed: 2026-03-18*
