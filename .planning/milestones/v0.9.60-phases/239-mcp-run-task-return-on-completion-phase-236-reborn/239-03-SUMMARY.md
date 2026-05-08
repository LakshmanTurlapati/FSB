---
phase: 239
plan: 03
subsystem: mcp
tags: [mcp, resolve-discipline, sw-evicted, partial-outcome, safety-net, run-task]
requirements: [MCP-03, MCP-04]
dependency_graph:
  requires:
    - phase: 239 plan 01 (lifecycle bus dispatched from notifySidepanel + handleStopAutomation; tests/fixtures/run-task-harness.js installVirtualClock)
    - phase: 239 plan 02 (extension/utils/mcp-task-store.js exposing FsbMcpTaskStore; 30s heartbeat ticker scope in _handleStartAutomation; settle() terminal write discipline)
  provides:
    - 600s safety-net ceiling at mcp/src/tools/autopilot.ts (timeout: 600_000)
    - 600s safety-net ceiling at extension/ws/mcp-bridge-client.js (RUN_TASK_SAFETY_NET_MS = 600_000)
    - D-06 partial_outcome resolve shape on safety-net fire (runs through settle() so single-resolve invariant holds)
    - D-05 server-side sw_evicted catch on Bridge disconnected; resolves run_task tool with documented shape
    - mcp:get-task-snapshot bridge route (read-only snapshot lookup)
    - extension-side _reconcileInFlightTasksOnConnect best-effort diagnostic write on reconnect
    - tests/run-task-resolve-discipline.test.js with 6 named cases (22 asserts)
  affects:
    - Phase 244 (hardening) -- the 600s ceiling stays "provisional" until SC#5 UAT proves zero dropped lifecycle events; Phase 244 may remove it entirely if data supports
    - Phase 240+ (concurrent tasks per agent) -- correlation key currently agentId; migrate to per-task ID when single-task semantics relax

tech-stack:
  added: []
  patterns:
    - settled-flag guard at the safety-net setTimeout callback (Pitfall 5 mirror)
    - server-side disconnect catch with bounded reconnect grace + bounded snapshot lookup (Threat T-239-12 DoS mitigation)
    - additive bridge route ('mcp:get-task-snapshot') that returns read-only snapshot via the standard _routeMessage return path (mirrors all other case handlers)
    - bridge.ts disconnect comment block documenting cross-package contract (no functional change)

key-files:
  created:
    - tests/run-task-resolve-discipline.test.js (6 named cases, 22 asserts)
  modified:
    - mcp/src/bridge.ts (Phase 239 plan 03 verification comment in disconnect(); no functional change)
    - mcp/src/tools/autopilot.ts (timeout: 300_000 -> 600_000; sw_evicted catch + bounded reconnect poll + snapshot fetch)
    - mcp/src/types.ts (add 'mcp:get-task-snapshot' to MCPMessageType union)
    - extension/ws/mcp-bridge-client.js (300_000 -> 600_000 ceiling raise + D-06 partial_outcome resolve shape; new mcp:get-task-snapshot case + _handleGetTaskSnapshot method; _reconcileInFlightTasksOnConnect helper wired into _ws.onopen and reset via _ws.onclose)

key-decisions:
  - "Open Question 1 RESOLVED: server-side sw_evicted catch is correct. mcp/src/bridge.ts disconnect() rejects pendingRequests with new Error('Bridge disconnected'). The extension cannot synthesize an mcp:result post-reconnect because the server's pendingRequest entry is gone. Catch lives in autopilot.ts."
  - "Both 300s ceilings raised symmetrically: autopilot.ts (server-side timeout option) AND mcp-bridge-client.js (extension-side setTimeout). The extension-side fires first today; the server-side ceiling is dead code in normal flow but raised for symmetry per RESEARCH headline finding 1."
  - "D-06 hint string copied verbatim from CONTEXT.md: 'lifecycle event missing -- audit cleanup paths' (double-dash, two ASCII dashes, no em-dash). Test asserts exact match with assertEqual."
  - "D-05 success best-inferred from snapshot.status: 'complete' -> true; 'error' -> false; everything else (in_progress at eviction, partial, stopped) -> false. Encoded conservatively because sw_evicted means the task did NOT complete to its intended end state."
  - "agentId is the correlation key for v0.9.60 (LOCKED). Per Phase 237 AgentScope, an agent has at most one in-flight automation. mcp-bridge-client.js writes snapshots keyed by sessionId, which post-Phase-237 is the same string identity as agentId. Adding a separate taskId field would break D-07 additive-only on the run_task payload contract."
  - "Bounded DoS mitigation for the snapshot lookup: 30s reconnect grace (250ms poll cadence) + 5s sendAndWait timeout on the snapshot lookup itself. Total worst case ~35s post-disconnect. Threat T-239-12 mitigated."
  - "The _reconcileInFlightTasksOnConnect helper is best-effort/diagnostic ONLY: it marks any in-flight snapshot 'partial' with sw_evicted disposition after reconnect. The authoritative settle path is the server-side sw_evicted catch in autopilot.ts. Documented in code comment so future readers do not misuse it as a replacement."
  - "bridge.ts received a one-line documentation comment ONLY (per Plan 03 frontmatter) -- no functional change."

requirements-completed: [MCP-03, MCP-04]

metrics:
  duration: "~7 min"
  tasks: 4
  files_created: 1
  files_modified: 4
  tests_pass: "22/22 run-task-resolve-discipline (6 named cases), 6/6 cleanup-paths, 10/10 mcp-task-store, 17/17 run-task-heartbeat, 55/55 mcp-bridge-client-lifecycle, 67/67 mcp-tool-smoke (D-07 unchanged), 93/93 mcp-visual-session-contract (D-07 unchanged)"
  completed: 2026-05-06
---

# Phase 239 Plan 03: Resolve-Discipline + 600s Safety Net + sw_evicted Summary

**Closes Phase 239 by stitching Plan 01's lifecycle bus and Plan 02's heartbeat + persistence into a strict single-resolve discipline. Both 300s ceilings raised to 600s safety nets; lifecycle event always wins the race; SW eviction now resolves the originating MCP call cleanly with a documented partial_state.**

## Performance

- **Duration:** ~7 minutes
- **Started:** 2026-05-06T06:41:53Z
- **Completed:** 2026-05-06T06:49Z
- **Tasks:** 4 (Wave 0 RED scaffold + bridge.ts comment; ceiling raise; sw_evicted catch + bridge route; phase regression run + VALIDATION map)
- **Files modified:** 4 (mcp/src/bridge.ts, mcp/src/tools/autopilot.ts, mcp/src/types.ts, extension/ws/mcp-bridge-client.js)
- **Files created:** 1 (tests/run-task-resolve-discipline.test.js)

## Open Question 1 Resolution (RESEARCH.md A1)

**Question:** Whether bridge.ts pendingRequests survive a bridge disconnect, OR are rejected.

**Answer (verified by reading mcp/src/bridge.ts):** Pending requests are REJECTED with `new Error('Bridge disconnected')`:

```typescript
// mcp/src/bridge.ts disconnect()
for (const [id, pending] of this.pendingRequests) {
  clearTimeout(pending.timeout);
  pending.reject(new Error('Bridge disconnected'));
  this.pendingRequests.delete(id);
}
this.progressListeners.clear();
```

**Implication locked into the design:** the extension cannot synthesize an `mcp:result` post-reconnect (server's pendingRequest entry is gone). **The sw_evicted settle path lives on the server side**: `mcp/src/tools/autopilot.ts:run_task` catches the rejection, polls for reconnect (bounded), then fetches the persisted snapshot via the new `mcp:get-task-snapshot` route.

**Documentation:** `mcp/src/bridge.ts:disconnect()` now carries a Phase 239 plan 03 verification comment block that locks in the cross-package contract (no functional change to bridge.ts).

## Ceiling-raise verification

| File | Pattern | Baseline | After plan |
|------|---------|----------|------------|
| `mcp/src/tools/autopilot.ts` | `timeout: 300_000` | 1 | 0 |
| `mcp/src/tools/autopilot.ts` | `timeout: 600_000` | 0 | 1 |
| `extension/ws/mcp-bridge-client.js` | `Automation timed out after 5 minutes` | 1 | 0 |
| `extension/ws/mcp-bridge-client.js` | `RUN_TASK_SAFETY_NET_MS = 600_000` | 0 | 1 |
| `extension/ws/mcp-bridge-client.js` | `partial_outcome: 'timeout'` | 0 | 2 (one in resolve shape, one in pre-settle final_result write) |
| `extension/ws/mcp-bridge-client.js` | `lifecycle event missing -- audit cleanup paths` | 0 | 1 (verbatim hint string) |
| `mcp/src/tools/autopilot.ts` | `sw_evicted: true` | 0 | 1 |
| `mcp/src/tools/autopilot.ts` | `Bridge disconnected` | 0 | 1 |
| `mcp/src/tools/autopilot.ts` | `payload: { agentId }` | 1 (existing start-automation) | 3 (start-automation + stop-automation + get-task-snapshot) |
| `extension/ws/mcp-bridge-client.js` | `mcp:get-task-snapshot` | 0 | 2 (case + comment) |
| `extension/ws/mcp-bridge-client.js` | `_handleGetTaskSnapshot` | 0 | 2 (dispatch + method definition) |

`case 'mcp:get-task-snapshot':` lands at line 337 of `extension/ws/mcp-bridge-client.js` -- inside the 320-360 line-number range mandated by the plan, immediately after `case 'mcp:start-automation':` (line 323-324), using the `return this._handleX(payload, id);` shape that mirrors the surrounding cases.

## New bridge route summary -- mcp:get-task-snapshot

**Wire shape:**

```
Request:  { type: 'mcp:get-task-snapshot', payload: { agentId } }
Response: { id, type: 'mcp:result', payload: { success: true, snapshot: <snapshot or null> } }
```

**Server side** (`mcp/src/tools/autopilot.ts`): called from inside the `Bridge disconnected` catch block, after a 30s reconnect grace, with a 5s sendAndWait timeout. Best-effort -- if the lookup fails, `partial_state` settles `null` and the tool still resolves with the D-05 shape.

**Extension side** (`extension/ws/mcp-bridge-client.js:_handleGetTaskSnapshot`): reads from `globalThis.FsbMcpTaskStore.readSnapshot(agentId)`. Read-only; never mutates state. Wrapped in best-effort try/catch.

**Correlation key:** `agentId` (LOCKED for v0.9.60 single-task semantics). Phase 240+ migrates to per-task ID when concurrent tasks per agent become possible.

## Resolve-discipline test results

`tests/run-task-resolve-discipline.test.js`: **6 named cases, 22 asserts, all PASS**.

| Case | Asserts | Result |
|------|---------|--------|
| `lifecycle_wins_race` | 3 | PASS -- bus dispatch BEFORE 600s; advancing past 600s does not double-resolve; resolved value lacks partial_outcome; ticker cleared. |
| `safety_net_fires_with_partial_outcome` | 4 | PASS -- D-06 shape verified field-by-field (success: true, partial_outcome: 'timeout', partial_state.task_id matches sessionId, hint string verbatim). |
| `safety_net_at_600_000_not_300_000` | 3 | PASS -- advancing 300_000ms produces no settle; advancing another 300_001ms does. Proves the ceiling raise. |
| `sw_wake_settles_with_sw_evicted` | 6 | PASS -- loads compiled mcp/build/tools/autopilot.js, mocks bridge throwing 'Bridge disconnected' on first sendAndWait then resolving snapshot lookup; parses content[0].text; asserts D-05 shape (sw_evicted: true, partial_state.task_id matches agentId, last_heartbeat_at populated, success field present). |
| `no_double_resolve_under_race` | 3 | PASS -- lifecycle bus + safety net dispatched in the SAME microtask boundary; exactly one resolve recorded; ticker cleared. |
| `heartbeat_ticker_cleared_on_safety_net` | 2 | PASS -- after safety-net settle, advancing another 60_000ms produces zero new _sendProgress calls and zero active interval handles. |

## Phase regression run

```bash
npm --prefix mcp run build && \
node tests/run-task-cleanup-paths.test.js && \
node tests/mcp-task-store.test.js && \
node tests/run-task-heartbeat.test.js && \
node tests/run-task-resolve-discipline.test.js && \
node tests/mcp-bridge-client-lifecycle.test.js && \
node tests/mcp-tool-smoke.test.js && \
node tests/mcp-visual-session-contract.test.js
```

| Suite | Result |
|-------|--------|
| `npm --prefix mcp run build` | exit 0 |
| `tests/run-task-cleanup-paths.test.js` | 6/6 PASS (Plan 01 baseline) |
| `tests/mcp-task-store.test.js` | 10/10 PASS (Plan 02 baseline) |
| `tests/run-task-heartbeat.test.js` | 17/17 PASS (Plan 02 baseline) |
| `tests/run-task-resolve-discipline.test.js` | 22/22 PASS (Plan 03; 6 named cases) |
| `tests/mcp-bridge-client-lifecycle.test.js` | 55/55 PASS (no regression) |
| `tests/mcp-tool-smoke.test.js` | 67/67 PASS (D-07 success-path UNCHANGED -- additive-only contract preserved) |
| `tests/mcp-visual-session-contract.test.js` | 93/93 PASS (D-07 UNCHANGED) |

All 7 suites green; build green; D-07 contract preserved.

## Task Commits

Each task was committed atomically with `--no-verify` (parallel-executor convention):

1. **Task 0: Wave 0 RED scaffold + bridge.ts comment** -- `db35903` (test)
2. **Task 1: Raise both 300s ceilings to 600s + D-06 partial_outcome** -- `29a5b54` (feat)
3. **Task 2: D-05 sw_evicted server-side catch + mcp:get-task-snapshot route** -- `60ab71a` (feat)
4. **Task 3: Phase regression run + VALIDATION.md map** -- no code commit (test results captured in this SUMMARY; VALIDATION.md change lives under .planning/ which is gitignored, mirroring Plan 01's Task 3 pattern)

## Files Created/Modified

- `tests/run-task-resolve-discipline.test.js` (created) -- 6 named cases (22 asserts)
- `mcp/src/bridge.ts` (modified) -- Phase 239 plan 03 verification comment in `disconnect()`; no functional change
- `mcp/src/tools/autopilot.ts` (modified) -- timeout 300_000 -> 600_000; try/catch around sendAndWait detecting 'Bridge disconnected'; bounded reconnect-grace poll; snapshot lookup via mcp:get-task-snapshot; D-05 sw_evicted resolve shape
- `mcp/src/types.ts` (modified) -- add 'mcp:get-task-snapshot' to MCPMessageType union
- `extension/ws/mcp-bridge-client.js` (modified) -- 300_000 ceiling raised to 600_000 (RUN_TASK_SAFETY_NET_MS); D-06 partial_outcome resolve shape via settle(); new `case 'mcp:get-task-snapshot':` route at line 337; `_handleGetTaskSnapshot` method; `_reconcileInFlightTasksOnConnect` helper wired into `_ws.onopen` and reset via `_ws.onclose`

## Decisions Made

See `key-decisions` in frontmatter. Highlights:

1. **Open Question 1:** server-side sw_evicted catch is correct (verified bridge.ts:131-136 reject behavior).
2. **Both ceilings raised symmetrically** for belt-and-suspenders despite server-side being dead code today.
3. **D-06 hint string verbatim:** `'lifecycle event missing -- audit cleanup paths'` (double-dash, two ASCII dashes).
4. **D-05 success best-inferred** from snapshot.status; conservative default to false because sw_evicted means task did not complete.
5. **agentId correlation key LOCKED** for v0.9.60 single-task semantics; documented Phase 240+ migration path.
6. **Bounded DoS mitigation:** 30s reconnect grace (250ms poll) + 5s snapshot lookup timeout = ~35s worst case post-disconnect.
7. **`_reconcileInFlightTasksOnConnect` is diagnostic only**, not a replacement for the server-side authoritative settle.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Add 'mcp:get-task-snapshot' to MCPMessageType union in types.ts**
- **Found during:** Task 2 build (`npm --prefix mcp run build` failed with `error TS2820: Type '"mcp:get-task-snapshot"' is not assignable to type 'MCPMessageType'`).
- **Issue:** The plan's `<files>` listed `mcp/src/tools/autopilot.ts, extension/ws/mcp-bridge-client.js` for Task 2 -- it did not call out `mcp/src/types.ts`. The strict `MCPMessageType` discriminated union in `mcp/src/types.ts:8-40` enumerates every legal `type` field; adding the new server-to-extension message type required a one-line addition there.
- **Fix:** Added `| 'mcp:get-task-snapshot'   // Phase 239 plan 03: D-05 SW-wake snapshot lookup (server-side sw_evicted catch)` immediately after `'mcp:get-status'` in the union. No new types or interfaces -- this is purely a discriminator extension.
- **Files modified:** `mcp/src/types.ts`
- **Verification:** Build green after the addition; both `mcp:get-task-snapshot` references in autopilot.ts compile under strict TypeScript.
- **Committed in:** `60ab71a` (Task 2 commit).

### Plan-prescribed approach refinements

**2. [Rule 1 - Soft adjustment] Reconnect grace was 5s in plan example, lifted to 30s per CONTEXT.md "configurable reconnect_grace, default 30s"**
- **Found during:** Task 2 implementation reading the CONTEXT.md `<files_to_read>` directive ("Awaits reconnect (poll bridge.isConnected with 250ms cadence; deadline = a configurable reconnect_grace, default 30s)").
- **Issue:** The plan's TypeScript code sketch hardcoded `Date.now() + 5_000` for the reconnect deadline. The `<files_to_read>` directive said the default reconnect_grace is 30s.
- **Fix:** Used `const reconnectGraceMs = 30_000;` so a future config knob can override it. The 5s sendAndWait timeout on the snapshot lookup itself is still 5s.
- **Files modified:** `mcp/src/tools/autopilot.ts`
- **Threat impact:** Threat T-239-12 in the plan calculated worst-case ~10s post-disconnect (5s grace + 5s snapshot timeout). With 30s grace, worst case is ~35s. Still bounded; still acceptable. Updated this SUMMARY's key-decisions section to record the new bound.

### No deferred issues

All 4 tasks completed with all per-task done-criteria gates passing and all 7 downstream test suites GREEN.

## Threat surface

No new threat flags. The four threats in the plan's `<threat_model>` (T-239-10 through T-239-13) are mitigated as designed:

- **T-239-10 (double-resolve race):** All new resolve sources (safety net at 600s, server-side sw_evicted) route through `settle(value, source)` so the existing `if (settled) return;` guard fires uniformly. Test `no_double_resolve_under_race` proves single-resolve under same-microtask-boundary races.
- **T-239-11 (info disclosure of partial_state fields):** Fields are derived from existing exposure surfaces (Plan 02's heartbeat already sends `current_url` and `last_action` to the host on every tick); no new disclosure surface.
- **T-239-12 (DoS via reconnect spin):** Hard 30s reconnect grace with 250ms poll cadence + 5s sendAndWait timeout on the snapshot lookup. Total worst case ~35s post-disconnect.
- **T-239-13 (repudiation -- success: false on sw_evicted):** Conservative default; the `sw_evicted: true` field surfaces the failure mode for host audit logs.

## Issues Encountered

- The plan's <files> for Task 2 omitted `mcp/src/types.ts`; the strict MCPMessageType union forced an additional one-line edit. Documented as Deviation 1 above.
- The worktree's `.planning/` directory was missing some Plan 01 artifacts at start (the worktree was rooted at a commit predating those files). `git reset --hard HEAD` restored Wave 1 artifacts; no work was lost.

## Hand-off note to phase verify-work

**Automated:** all 7 regression suites GREEN. Build GREEN. D-07 success-path additive-only contract preserved.

**Manual UAT (the only remaining gate -- SC#5):**
- 5 long-task UAT runs (>5 min each) demonstrating: (a) MCP call returns on actual completion, not at 600s safety net; (b) progress observed at each 30s heartbeat boundary; (c) no SW eviction OR, if eviction occurred, the call settled with sw_evicted: true.
- UAT placeholder table in `239-CLEANUP-AUDIT.md` is ready for results to be filled in.

**Phase 240+ follow-up:** correlation key (currently `agentId`) should migrate to a per-task ID when concurrent tasks per agent become possible. Out of scope for v0.9.60.

**RETROSPECTIVE.md candidate notes:** v0.9.60 milestone wrap-up should capture: (a) cost of running 3 plans in parallel waves vs sequential; (b) value of front-loading the bridge.ts read in CONTEXT.md A1 (pre-empted Plan 03 design churn); (c) lessons from Phase 236's deferral that drove this phase's rebirth.

## Self-Check: PASSED

All claimed artifacts verified to exist on disk:

- `tests/run-task-resolve-discipline.test.js` -- FOUND
- `mcp/src/bridge.ts` Phase 239 plan 03 comment -- FOUND (1 grep match)
- `mcp/src/tools/autopilot.ts` 600_000 timeout -- FOUND (1 grep match; 0 grep matches for 300_000)
- `mcp/src/tools/autopilot.ts` sw_evicted: true -- FOUND (1 grep match)
- `mcp/src/types.ts` 'mcp:get-task-snapshot' -- FOUND
- `extension/ws/mcp-bridge-client.js` RUN_TASK_SAFETY_NET_MS = 600_000 -- FOUND (1 grep match)
- `extension/ws/mcp-bridge-client.js` lifecycle event missing -- audit cleanup paths -- FOUND (1 grep match, verbatim)
- `extension/ws/mcp-bridge-client.js` case 'mcp:get-task-snapshot' at line 337 -- FOUND (in 320-360 range per plan)

All claimed commits verified to exist in git log:

- `db35903` (Task 0) -- FOUND
- `29a5b54` (Task 1) -- FOUND
- `60ab71a` (Task 2) -- FOUND

All 7 downstream test suites verified to exit 0 in the post-Task 3 regression run.

---
*Phase: 239-mcp-run-task-return-on-completion-phase-236-reborn*
*Plan: 03*
*Completed: 2026-05-06*
