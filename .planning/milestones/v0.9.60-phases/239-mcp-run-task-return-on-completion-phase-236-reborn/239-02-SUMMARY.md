---
phase: 239
plan: 02
subsystem: mcp
tags: [mcp, persistence, heartbeat, chrome-storage-session, observability]
requirements: [MCP-05, MCP-06]
dependency_graph:
  requires:
    - extension/utils/agent-registry.js (Phase 237 -- envelope shape parity reference)
    - extension/utils/mcp-visual-session.js (v0.9.36 -- snapshot shape parity reference)
    - extension/ws/mcp-bridge-client.js:_handleStartAutomation (existing Promise scope)
    - mcp/src/tools/autopilot.ts:run_task onProgress (existing callback)
  provides:
    - extension/utils/mcp-task-store.js (FsbMcpTaskStore global; 5 functions + 2 constants)
    - 30s setInterval heartbeat ticker scoped to each _handleStartAutomation Promise
    - D-01 9-field heartbeat payload on every tick
    - D-02 params._meta wire shape on autopilot.ts onProgress
    - D-04 write-cadence on chrome.storage.session (subscribe + every tick + settle)
  affects:
    - Plan 03: globalThis.FsbMcpTaskStore is now available; settle() already
      writes terminal snapshots; Plan 03 will add new resolve sources
      (sw_evicted, partial_outcome) that route through the existing settle
      discipline established here.
tech-stack:
  added:
    - chrome.storage.session under key fsbRunTaskRegistry (versioned envelope v: 1)
    - setInterval(30_000) heartbeat ticker (paired with clearInterval in settle)
  patterns:
    - lazy globalThis.chrome reference (mirrors agent-registry.js for Node test loadability)
    - empty-records-removes-key discipline (no stale envelope sitting in storage)
    - best-effort try/catch posture (storage failure never blocks resolve)
    - settled-flag guard at top of heartbeat callback (single-resolve invariant)
    - paired-cleanup discipline (clearInterval inside settle alongside clearTimeout)
key-files:
  created:
    - extension/utils/mcp-task-store.js
    - tests/mcp-task-store.test.js
    - tests/run-task-heartbeat.test.js
  modified:
    - extension/background.js (importScripts wire-up)
    - extension/ws/mcp-bridge-client.js (heartbeat ticker + paired teardown)
    - mcp/src/tools/autopilot.ts (D-01 fields under params._meta)
decisions:
  - "Subscribe-time fire is split: writeSnapshot fires on subscribe (state transition), but _sendProgress holds until t=30s. Rationale: the legacy automationProgress payload shape must remain sent[0] for tests/mcp-bridge-client-lifecycle.test.js. The D-04 'every state transition' contract is satisfied by the storage write."
  - "params._meta is conditionally attached via a hasHeartbeatFields check. Non-heartbeat progress (existing dashboard automationProgress) keeps the legacy shape, preserving D-07 additive-only."
  - "Single-task v0.9.60 invariant: taskId === sessionId throughout. Plan 240+ may relax this; the persisted snapshot shape already accommodates per-task_id keying."
metrics:
  duration: "single session"
  tasks: 4
  files_created: 3
  files_modified: 3
  tests_pass: "10/10 mcp-task-store, 6/6 run-task-heartbeat (17 asserts), 55/55 lifecycle regression, 67/67 mcp-tool-smoke"
  completed: 2026-05-05
---

# Phase 239 Plan 02: Heartbeat ticker + chrome.storage.session task-store Summary

Built the observability and persistence half of Phase 239: a 30s `setInterval` heartbeat ticker scoped to each `_handleStartAutomation` Promise that emits the D-01 9-field payload via `_sendProgress` on every tick AND writes a chrome.storage.session snapshot under `fsbRunTaskRegistry` on subscribe + every tick + settle. The companion server-side change re-shapes those rich fields into MCP `notifications/progress` with `params._meta` (the spec 2025-03-26 vendor-extension slot), so MCP host clients (Claude Code, Cursor, Codex, OpenClaw) receive at-least-30s liveness signals on long `run_task` calls and can salvage in-flight state when the SW is evicted.

Closes MCP-05 (heartbeat) + MCP-06 (persistence). Plan 03 will add the 600s ceiling raise + `sw_evicted` / `partial_outcome` resolve discipline on top of the heartbeat scope established here.

## What changed

### New helper module: `extension/utils/mcp-task-store.js`

194 lines (target was 80-120; the JSDoc header + helper docs landed it slightly over). Mirrors `extension/utils/agent-registry.js`'s storage-helper portion verbatim: lazy `globalThis.chrome` reference for Node test loadability, versioned envelope `{ v: 1, records: { [task_id]: snapshot } }`, empty-records-removes-key discipline.

Exports:

| Symbol | Kind | Purpose |
|--------|------|---------|
| `writeSnapshot(taskId, snapshot)` | function | Persist a snapshot under task_id |
| `readSnapshot(taskId)` | function | Read a single snapshot; null on unknown |
| `deleteSnapshot(taskId)` | function | Remove a snapshot; idempotent |
| `listInFlightSnapshots()` | function | Filter to status === 'in_progress' |
| `hydrate()` | function | Return canonical envelope for SW-wake reconciliation |
| `FSB_RUN_TASK_REGISTRY_STORAGE_KEY` | constant | `'fsbRunTaskRegistry'` |
| `FSB_RUN_TASK_REGISTRY_PAYLOAD_VERSION` | constant | `1` |

`_readEnvelope` returns the canonical empty envelope `{ v: 1, records: {} }` on missing-key / wrong-version / any error -- this differs from agent-registry's null-return pattern so callers can skip null-checks. The behavior is locked by the `version_mismatch_returns_empty` test case.

Wired into `extension/background.js` via `importScripts('utils/mcp-task-store.js')` immediately after `agent-registry.js` (sibling load order).

### Heartbeat ticker in `extension/ws/mcp-bridge-client.js`

The `_handleStartAutomation` Promise body now hosts a closure-scope 30s setInterval ticker:

- `heartbeatStartedAt`, `lastHeartbeatAt`, `heartbeatTickCount` — state shared between `fireHeartbeat` and `settle`.
- `fireHeartbeat` — `async` callback that:
  - Returns early if `settled` (single-resolve invariant -- Pitfall 5 guard).
  - Reads the optional `activeSessions.get(sessionId)` for rich payload fields.
  - Emits `_sendProgress(mcpMsgId, { timestamp, sessionId, taskId, alive: true, step, elapsed_ms, current_url, ai_cycles, last_action })` (D-01).
  - Calls `globalThis.FsbMcpTaskStore.writeSnapshot(sessionId, { task_id, status: 'in_progress', ... })` (D-04).
- `setInterval(fireHeartbeat, 30_000)` — created right after `setTimeout(timeout, 300_000)`.
- Subscribe-time `writeSnapshot` -- ONE storage write fires immediately when the Promise scope is set up so D-04 "every state transition" (idle -> in_progress) is honored. We deliberately do NOT fire `_sendProgress` immediately because the legacy `automationProgress` payload shape must remain `sent[0]` for the existing `mcp-bridge-client-lifecycle.test.js` regression case.
- `settle()` extended:
  - `clearInterval(heartbeatTimer)` -- paired teardown alongside the existing `clearTimeout(timeout)`.
  - Terminal `writeSnapshot` -- maps `value.status` to one of `'complete' | 'error' | 'stopped' | 'partial'` and writes `final_result: value` for SW-wake reconciliation in Plan 03.

### Server-side D-02 wire shape in `mcp/src/tools/autopilot.ts`

`onProgress` now reads the 6 D-01 fields (`alive`, `step`, `elapsed_ms`, `current_url`, `ai_cycles`, `last_action`) from `MCPResponse.payload` alongside the existing 5 fields (`progress`, `phase`, `eta`, `action`, `taskId`). When at least one D-01 field is present (heartbeat tick), `notifications/progress` is sent with `_meta: { alive: alive ?? false, step, elapsed_ms, current_url, ai_cycles, last_action }`. When zero D-01 fields are present (existing dashboard `automationProgress`), the legacy shape is preserved verbatim -- D-07 additive-only contract holds. `server.sendLoggingMessage` data field also carries the D-01 fields so server logs match the MCP host visibility surface.

## Test results

| File | Cases | Result |
|------|-------|--------|
| `tests/mcp-task-store.test.js` | 10 | 10/10 PASS |
| `tests/run-task-heartbeat.test.js` | 6 (17 asserts) | 17/17 PASS |
| `tests/mcp-bridge-client-lifecycle.test.js` | 55 | 55/55 PASS (no regression) |
| `tests/mcp-tool-smoke.test.js` | 67 | 67/67 PASS (D-07 contract preserved) |

Build: `npm --prefix mcp run build` exits 0 after a one-iteration TypeScript fix (the `params: Record<string, unknown>` initial draft did not satisfy the strict `ServerNotification` shape; the fix splits the `extra.sendNotification` call across the `hasHeartbeatFields` branch so each branch's `params` literal is statically inferable).

## Commits

| Hash | Message |
|------|---------|
| `3004ff6` | test(239-02): Wave 0 RED scaffolds for mcp-task-store and run-task-heartbeat |
| `8c0be7a` | feat(239-02): add mcp-task-store helper and importScripts wire-up |
| `39e88f7` | feat(239-02): wire 30s heartbeat ticker in _handleStartAutomation with paired teardown |
| `7c51e27` | feat(239-02): autopilot run_task onProgress emits D-01 fields under params._meta |

## Deviations from Plan

### Plan-prescribed approach adjusted in flight

**1. [Rule 3 - Blocking] Subscribe-time `_sendProgress` removed; replaced with subscribe-time `writeSnapshot` only**
- **Found during:** Task 2 verification (lifecycle regression test).
- **Issue:** Plan 02 Task 2 step 3 said: "Fire immediately on subscribe per RESEARCH Open Question 3 recommendation". Adding the immediate `_sendProgress` made `sent[0]` the heartbeat payload instead of the legacy `automationProgress` payload, breaking the existing `runAutomationRuntimeEventShapeCase` assertion (`assertDeepEqual(toPlainObject(sent[0]), {...legacy shape...})` in `tests/mcp-bridge-client-lifecycle.test.js:348-362`).
- **Fix:** The plan's own Task 0 spec for `first_tick_within_30s` allowed either an immediate first tick OR one at exactly 30s ("implementation choice deferred to Task 2"). I chose the t=30s option for `_sendProgress` AND added a separate subscribe-time `writeSnapshot` call so D-04 "every state transition" is still honored on the storage side without disturbing the legacy progress sequencing.
- **Files modified:** `extension/ws/mcp-bridge-client.js`
- **Commit:** `39e88f7`

**2. [Rule 3 - Blocking] TypeScript params type fix in autopilot.ts**
- **Found during:** Task 3 build.
- **Issue:** First draft used `const params: Record<string, unknown> = {...}` then mutated via `params._meta = {...}`. The strict `ServerNotification` typing on `extra.sendNotification` rejects `Record<string, unknown>` because `progressToken` and `progress` are required.
- **Fix:** Split the `sendNotification` call across the `hasHeartbeatFields` branch so each branch passes a statically-inferable params literal.
- **Files modified:** `mcp/src/tools/autopilot.ts`
- **Commit:** `7c51e27`

**3. [Rule 3 - Blocking] Harness fixture verified pre-existing**
- **Found during:** Task 0 setup.
- **Issue:** Plan 02 said `tests/fixtures/run-task-harness.js` was produced by Plan 01 Wave 0; both plans are running in parallel worktrees so the harness might not exist when Plan 02 runs.
- **Resolution:** The harness file existed in the working tree (likely from a prior iteration or sibling worktree). It exports the exact symbols Plan 02 needed (`createStorageArea`, `installChromeMock`, `createLifecycleBusSpy`, `installVirtualClock`). No fixture work was needed in Plan 02.
- **Files modified:** none (no-op)

**4. Line count target soft-overshoot on mcp-task-store.js**
- **Found during:** Task 1 done-criteria verification.
- **Issue:** Plan target was "80-120 lines"; actual is 194 lines.
- **Reason:** The JSDoc header (CONTEXT.md / RESEARCH.md cross-references + best-effort posture documentation) plus per-function JSDoc account for the difference. Implementation logic alone is ~80 lines. The done-criteria gates that matter (per-export grep, constant value checks, test contract) all pass.
- **Files modified:** none (intentional)

### No deferred issues

All four tasks completed with all per-task done-criteria gates passing and all four downstream test suites GREEN.

## Threat surface

No new threat flags. The four threats in the plan's `<threat_model>` (T-239-06 through T-239-09) are mitigated as designed:

- **T-239-06 (storage quota DoS):** single-task semantics keep `records` map at <=1 entry; best-effort try/catch wraps every storage call.
- **T-239-07 (info disclosure of `current_url`/`last_action`):** these fields were already exposed via `_sendProgress`; `params._meta` is a re-shaping of existing exposure.
- **T-239-08 (heartbeat-after-settle race):** `if (settled) return;` guard at top of `fireHeartbeat` + `clearInterval(heartbeatTimer)` inside `settle` (called BEFORE `resolve(value)`).
- **T-239-09 (originating_mcp_call_id repudiation):** chrome.storage.session is browser-lifetime; the call ID is bridge-internal and not user-facing.

## Hand-off note to Plan 03

`globalThis.FsbMcpTaskStore` is now available (registered in `background.js` via `importScripts`). The `settle()` function inside `_handleStartAutomation` already handles terminal-state writes (`'complete' | 'error' | 'stopped' | 'partial'`) BEFORE calling `resolve(value)`. Plan 03's new resolve sources (`sw_evicted`, `partial_outcome`) should:

1. Write the appropriate `'partial'` or `'in_progress'` snapshot to `FsbMcpTaskStore` BEFORE invoking `settle()` so the SW-wake reconciliation path can read the freshest state.
2. Pass a `value` object to `settle` whose `status` (and any `partial: true` flag) maps cleanly to the terminal-status switch in the existing `settle()` body. The current switch handles `'error'`, `'stopped'`, `'partial'` -- Plan 03's `'sw_evicted'` and `'timeout'` resolve outcomes should set `value.status = 'partial'` (or extend the switch with new branches if a distinct terminal status is desired).
3. Use the **same** `setInterval` ticker -- do not start a second one. The single ticker is closure-scoped and lives for the duration of the Promise.

The 600s ceiling raise belongs in two sites: `mcp/src/tools/autopilot.ts` line 61 (`timeout: 300_000` -> `600_000`) and `extension/ws/mcp-bridge-client.js` line ~768 (the `setTimeout(timeout, 300000)` call). Both must be raised in the same task to maintain the belt-and-suspenders symmetry.

## Self-Check: PASSED

All claimed artifacts verified to exist on disk:

- `extension/utils/mcp-task-store.js` -- FOUND
- `tests/mcp-task-store.test.js` -- FOUND
- `tests/run-task-heartbeat.test.js` -- FOUND

All claimed commits verified to exist in git log:

- `3004ff6` -- FOUND
- `8c0be7a` -- FOUND
- `39e88f7` -- FOUND
- `7c51e27` -- FOUND

All four downstream test suites verified to exit 0 in the final post-Task 3 verification run.
