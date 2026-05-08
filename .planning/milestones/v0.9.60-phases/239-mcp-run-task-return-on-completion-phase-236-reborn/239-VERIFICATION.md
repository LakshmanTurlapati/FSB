---
phase: 239-mcp-run-task-return-on-completion-phase-236-reborn
verified: 2026-05-05T00:00:00Z
status: human_needed
score: 4/5 must-haves verified (SC#5 awaits human UAT)
overrides_applied: 0
human_verification:
  - test: "Five long-task UAT runs (>5 min each) via MCP host (Claude Code, Cursor, Codex, or OpenClaw) issuing run_task with realistic multi-page automation"
    expected: "Each run returns on actual completion (lifecycle event), not at the 600s safety net. notifications/progress observed at >=30s cadence with params._meta carrying alive/step/elapsed_ms/current_url/ai_cycles/last_action. If SW eviction occurs, the call settles with sw_evicted: true plus partial_state."
    why_human: "End-to-end run_task in a real Chrome MV3 service worker with a real MCP host -- timer-driven, network-driven, requires manual task description per run. Cannot be exercised by automated tests in <10s budget."
---

# Phase 239: MCP run_task Return-on-Completion (Phase 236 Reborn) Verification Report

**Phase Goal:** Long-running `run_task` invocations return on actual completion via the existing `fsbAutomationLifecycleBus` rather than hitting an arbitrary 300s ceiling, with belt-and-suspenders coverage for SW eviction.

**Verified:** 2026-05-05
**Status:** human_needed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths (mapped to ROADMAP Success Criteria)

| # | Truth (Success Criterion)                                                                                                  | Status        | Evidence                                                                                                                                                                                                                                                |
|---|----------------------------------------------------------------------------------------------------------------------------|---------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| 1 | 300s ceiling at autopilot.ts and mcp-bridge-client.js raised to 600s safety net; promise resolution driven by lifecycle bus | VERIFIED      | `grep -c "timeout: 600_000" mcp/src/tools/autopilot.ts` = 1; `grep -c "timeout: 300_000"` = 0; `RUN_TASK_SAFETY_NET_MS = 600_000` present in mcp-bridge-client.js (1 match). Lifecycle-vs-safety-net race verified by `lifecycle_wins_race` test (PASS). |
| 2 | Every cleanupSession exit path (5 paths) audited; automated regression covers each path                                    | VERIFIED      | 239-CLEANUP-AUDIT.md per-path table covers all 5 paths plus 3 bonus paths. `tests/run-task-cleanup-paths.test.js` 6/6 PASS (5 paths + agent_loop_uses_helper grep gate).                                                                                |
| 3 | Heartbeat ticks at least every 30s through notifications/progress                                                          | VERIFIED      | `setInterval(fireHeartbeat, 30_000)` in mcp-bridge-client.js; D-01 9-field payload via `_sendProgress`; D-02 `params._meta` shape in autopilot.ts onProgress. `tests/run-task-heartbeat.test.js` 17/17 asserts PASS.                                     |
| 4 | Task lifecycle persisted in chrome.storage.session keyed by task_id                                                        | VERIFIED      | `extension/utils/mcp-task-store.js` (194 lines) with versioned envelope `{v: FSB_RUN_TASK_REGISTRY_PAYLOAD_VERSION (=1), records: {[taskId]: snapshot}}`; 5 named exports + 2 constants. `tests/mcp-task-store.test.js` 10/10 PASS.                       |
| 5 | Five long-task UAT runs (>5 min each) return on actual completion                                                          | NEEDS HUMAN   | Cannot be exercised by automated tests. UAT placeholder table in 239-CLEANUP-AUDIT.md is ready for the user's results. All four automated SCs above provide the foundation; the UAT is the final integration gate.                                       |

**Score:** 4/5 truths verified; 1 requires human UAT.

### Required Artifacts

| Artifact                                                                  | Expected                                                                                       | Status       | Details                                                                                                                                                                                                                                                          |
|---------------------------------------------------------------------------|------------------------------------------------------------------------------------------------|--------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `mcp/src/tools/autopilot.ts`                                              | 600s ceiling + sw_evicted catch + paired clearInterval; `mcp:get-task-snapshot` issued        | VERIFIED     | `grep -c "timeout: 600_000"` = 1; `grep -c "sw_evicted"` = 3; `Bridge disconnected` catch present; `mcp:get-task-snapshot` lookup wired with bounded reconnect grace.                                                                                            |
| `mcp/src/types.ts`                                                        | `'mcp:get-task-snapshot'` added to MCPMessageType discriminated union                          | VERIFIED     | Line 12: `\| 'mcp:get-task-snapshot'   // Phase 239 plan 03: D-05 SW-wake snapshot lookup ...`                                                                                                                                                                   |
| `mcp/src/bridge.ts`                                                       | Documentation comment about disconnect rejection contract                                     | VERIFIED     | Line 131: `// Phase 239 plan 03 -- IMPORTANT: do NOT change the rejection of pendingRequests` -- documents the cross-package contract that motivates server-side sw_evicted catch. No functional change.                                                          |
| `extension/ws/mcp-bridge-client.js`                                       | 600s ceiling, mcp:get-task-snapshot route, _handleGetTaskSnapshot, partial_outcome shape, settled-flag guard | VERIFIED     | `RUN_TASK_SAFETY_NET_MS = 600_000` (1); `case 'mcp:get-task-snapshot':` at line 337 (within 320-360 range); `_handleGetTaskSnapshot` method present; verbatim hint string `'lifecycle event missing -- audit cleanup paths'` (1).                                |
| `extension/utils/mcp-task-store.js`                                       | `{v:1, records:{...}}` envelope; 5 named exports                                              | VERIFIED     | 194 lines (slightly over plan's 80-120 target due to JSDoc; intentional per Plan 02 SUMMARY). 5 functions present (writeSnapshot, readSnapshot, deleteSnapshot, listInFlightSnapshots, hydrate) + 2 constants. Envelope shape `{v: 1, records: {...}}` enforced. |
| `extension/ai/agent-loop.js`                                              | notifySidepanel + 2 runAgentIteration guards use fsbBroadcastAutomationLifecycle              | VERIFIED     | 3 helper calls at lines 1317 (notifySidepanel), 1433 (runAgentIteration session_not_found guard), 1475 (runAgentIteration session_not_running guard). REVIEW-FIX WR-01 closed.                                                                                  |
| `extension/background.js`                                                 | handleStopAutomation dispatches the bus before sendResponse                                    | VERIFIED     | 20 total `fsbBroadcastAutomationLifecycle` references (baseline 19 + 1 from Plan 01 Task 2). handleStopAutomation dispatch at line 6845.                                                                                                                         |
| `tests/run-task-cleanup-paths.test.js`                                    | 5 cleanup paths + grep gate, all green                                                         | VERIFIED     | 6/6 PASS (normal_completion, stuck_detection_terminal, safety_breaker, tab_close, handle_stop, agent_loop_uses_helper).                                                                                                                                          |
| `tests/run-task-resolve-discipline.test.js`                               | 6 named cases covering resolve discipline matrix                                              | VERIFIED     | 22/22 asserts PASS (lifecycle_wins_race, safety_net_fires_with_partial_outcome, safety_net_at_600_000_not_300_000, sw_wake_settles_with_sw_evicted, no_double_resolve_under_race, heartbeat_ticker_cleared_on_safety_net).                                       |
| `tests/run-task-heartbeat.test.js`                                        | 30s tick cadence + payload shape + paired clearInterval                                       | VERIFIED     | 17/17 asserts PASS (first_tick_within_30s, payload_shape_d01, ticker_cleared_on_settle, no_tick_after_settle, store_write_cadence, clear_interval_no_leak_across_invocations).                                                                                   |
| `tests/mcp-task-store.test.js`                                            | Envelope + version mismatch + listInFlight + best-effort posture                              | VERIFIED     | 10/10 PASS (all named cases including module_exports, write_envelope_v1, read_unknown_returns_null, list_in_flight, delete_snapshot_*, version_mismatch_returns_empty, chrome_unavailable_no_throw).                                                             |

### Key Link Verification

| From                                                                  | To                                                                       | Via                                                              | Status   | Details                                                                                                                                                                                            |
|-----------------------------------------------------------------------|--------------------------------------------------------------------------|------------------------------------------------------------------|----------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `extension/ai/agent-loop.js:notifySidepanel`                          | `globalThis.fsbBroadcastAutomationLifecycle`                             | typeof guard + bare-name helper call (line 1317)                | WIRED    | Helper call confirmed; no raw chrome.runtime.sendMessage in notifySidepanel body (`agent_loop_uses_helper` grep gate enforces).                                                                    |
| `extension/ai/agent-loop.js:runAgentIteration` (2 guards)             | `globalThis.fsbBroadcastAutomationLifecycle`                             | helper calls at lines 1433, 1475                                 | WIRED    | REVIEW-FIX WR-01 added these two additional sites; guard exits now feed the bus. Grep returns 3 in agent-loop.js.                                                                                  |
| `extension/background.js:handleStopAutomation`                        | `globalThis.fsbBroadcastAutomationLifecycle`                             | direct call before sendResponse (line 6845)                      | WIRED    | Inserted between cleanupSession and sendResponse per RESEARCH Open Question 4 ordering. handle_stop test asserts timestamp ordering.                                                                |
| `extension/ws/mcp-bridge-client.js:_handleStartAutomation`            | `extension/utils/mcp-task-store.js:writeSnapshot`                        | module-level globalThis.FsbMcpTaskStore + setInterval body       | WIRED    | Subscribe-time write + per-tick write + terminal write in settle. store_write_cadence test asserts >=5 writes per session.                                                                          |
| `extension/ws/mcp-bridge-client.js:settle`                            | `clearInterval(heartbeatTimer)`                                          | paired teardown alongside clearTimeout(timeout)                  | WIRED    | Pitfall 2 mitigation; clear_interval_no_leak_across_invocations test confirms 0 active intervals after 5 sequential settles.                                                                       |
| `mcp/src/tools/autopilot.ts:onProgress`                               | `extra.sendNotification` with `params._meta`                             | conditional branch on hasHeartbeatFields                          | WIRED    | D-02 wire shape; preserves D-07 additive-only contract on non-heartbeat progress (smoke + visual-session-contract tests pass unchanged).                                                            |
| `mcp/src/tools/autopilot.ts:run_task`                                 | `bridge.sendAndWait('mcp:get-task-snapshot')`                             | server-side sw_evicted catch after Bridge disconnected            | WIRED    | sw_wake_settles_with_sw_evicted test (6 asserts) PASS; loads compiled JS, simulates disconnect + reconnect + snapshot lookup.                                                                       |

### Data-Flow Trace (Level 4)

| Artifact                                          | Data Variable        | Source                                                                                            | Produces Real Data | Status |
|---------------------------------------------------|----------------------|---------------------------------------------------------------------------------------------------|--------------------|--------|
| `mcp-bridge-client.js:fireHeartbeat` payload      | snapshot fields      | `activeSessions.get(sessionId)` (real session state) + Date.now()                                  | YES                | FLOWING |
| `mcp-task-store.js:writeSnapshot`                 | `records[taskId]`    | Heartbeat tick + settle terminal writes                                                            | YES                | FLOWING |
| `autopilot.ts:onProgress` -> notifications/progress | `_meta` block       | Bridged from extension `_sendProgress` payload via mcp:progress messages                          | YES                | FLOWING |
| `autopilot.ts` sw_evicted catch                   | `partial_state`      | `bridge.sendAndWait('mcp:get-task-snapshot')` -> `FsbMcpTaskStore.readSnapshot(agentId)`           | YES                | FLOWING |

### Behavioral Spot-Checks

| Behavior                                                 | Command                                                                       | Result                                                            | Status |
|----------------------------------------------------------|-------------------------------------------------------------------------------|-------------------------------------------------------------------|--------|
| run_task cleanup-path lifecycle dispatch                 | `node tests/run-task-cleanup-paths.test.js`                                    | "6 passed, 0 failed"                                              | PASS   |
| Heartbeat ticker + persistence wiring                    | `node tests/run-task-heartbeat.test.js`                                        | "passed: 17 / failed: 0"                                          | PASS   |
| Task store envelope discipline                           | `node tests/mcp-task-store.test.js`                                            | "passed: 10 / failed: 0"                                          | PASS   |
| Resolve-discipline race + sw_evicted + partial_outcome   | `node tests/run-task-resolve-discipline.test.js`                                | "passed: 22 / failed: 0"                                          | PASS   |
| MCP smoke regression (D-07)                              | `node tests/mcp-tool-smoke.test.js`                                            | "67 passed, 0 failed"                                             | PASS   |
| Visual-session contract regression (D-07)                | `node tests/mcp-visual-session-contract.test.js`                                | "93 passed, 0 failed"                                             | PASS   |

### Requirements Coverage

| Requirement | Source Plan      | Description                                                                                                                                       | Status      | Evidence                                                                                                       |
|-------------|------------------|---------------------------------------------------------------------------------------------------------------------------------------------------|-------------|----------------------------------------------------------------------------------------------------------------|
| MCP-03      | 239-01, 239-03   | `run_task` returns on completion via `fsbAutomationLifecycleBus` (Phase 236)                                                                       | SATISFIED   | Plan 01 wired notifySidepanel + handleStopAutomation; REVIEW-FIX added 2 runAgentIteration guards. Plan 03 verified lifecycle_wins_race + no_double_resolve_under_race. |
| MCP-04      | 239-03           | 300s ceiling raised to 600s safety net (kept until cleanup-path audit confirms zero dropped lifecycle events)                                      | SATISFIED   | Both ceilings (autopilot.ts + mcp-bridge-client.js) now 600_000. safety_net_at_600_000_not_300_000 test PASS. 239-CLEANUP-AUDIT.md authored per SC#2. |
| MCP-05      | 239-02           | 30s heartbeat ticks emitted via `_sendProgress` so MCP host clients don't time out long-running tasks                                              | SATISFIED   | setInterval(fireHeartbeat, 30_000) wired; D-01 payload + D-02 `_meta` shape verified. tests/run-task-heartbeat.test.js 17/17 PASS.                  |
| MCP-06      | 239-02           | Task lifecycle persisted in chrome.storage.session keyed by task_id (resumable across SW wake)                                                     | SATISFIED   | extension/utils/mcp-task-store.js with `{v:1, records:{[taskId]: snapshot}}` envelope. tests/mcp-task-store.test.js 10/10 PASS. SW-wake snapshot lookup wired via mcp:get-task-snapshot. |

**Orphaned requirements check:** REQUIREMENTS.md maps MCP-03, MCP-04, MCP-05, MCP-06 to Phase 239. All 4 are claimed by plans in this phase. No orphans.

### Anti-Patterns Found

None blocking. The 194-line task-store file (vs plan's 80-120 target) was an intentional deviation per Plan 02 SUMMARY (JSDoc + helper docs); functional logic is ~80 lines and all done-criteria gates pass.

### Human Verification Required

#### 1. Five Long-Task UAT Runs (SC#5)

**Test:** Issue 5 separate `run_task` calls (>5 min each) via an MCP host (Claude Code, Cursor, Codex, or OpenClaw) targeting realistic multi-page automation tasks. For each run, observe:
- Was the call returned on actual completion (lifecycle event), or did it hit the 600s safety net?
- Were `notifications/progress` events received at >=30s cadence with `params._meta` carrying alive/step/elapsed_ms/current_url/ai_cycles/last_action?
- If the SW was evicted mid-task, did the call settle with `{success, sw_evicted: true, partial_state, last_heartbeat_at}`?

**Expected:** 5/5 runs return on lifecycle completion (none hit the 600s ceiling). Heartbeat ticks observed every 30s. SW-eviction handling, if exercised, returns documented sw_evicted shape with non-null partial_state.

**Why human:** Real Chrome MV3 service worker + real MCP host + realistic web pages cannot be exercised in <10s automated test budget. The 5-run UAT placeholder table in `.planning/phases/239-mcp-run-task-return-on-completion-phase-236-reborn/239-CLEANUP-AUDIT.md` is ready to record results.

### Gaps Summary

No automated gaps. All four programmatic Success Criteria (SC#1-4) verified. The remaining Success Criterion (SC#5) is the manual UAT gate that the phase has explicitly scoped as out-of-automation per `239-VALIDATION.md` Manual-Only Verifications row.

The verification invariant `grep -c "600000" extension/ws/mcp-bridge-client.js >= 1` was a literal-string check for `600000` (no underscore separator). The actual implementation uses the more readable `600_000` form (numerically identical in JavaScript). `grep -c "600_000" extension/ws/mcp-bridge-client.js` returns 1; `grep -c "RUN_TASK_SAFETY_NET_MS = 600_000"` returns 1; the safety-net ceiling raise is verified intact and the intent of the invariant is satisfied. This is a notation-only mismatch with the verification prompt's invariant, not a code defect.

---

_Verified: 2026-05-05_
_Verifier: Claude (gsd-verifier)_
