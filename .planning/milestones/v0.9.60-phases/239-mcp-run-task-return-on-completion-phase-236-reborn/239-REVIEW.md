---
phase: 239-mcp-run-task-return-on-completion-phase-236-reborn
reviewed: 2026-05-05T00:00:00Z
depth: standard
files_reviewed: 12
files_reviewed_list:
  - extension/ai/agent-loop.js
  - extension/background.js
  - extension/utils/mcp-task-store.js
  - extension/ws/mcp-bridge-client.js
  - mcp/src/bridge.ts
  - mcp/src/tools/autopilot.ts
  - mcp/src/types.ts
  - tests/fixtures/run-task-harness.js
  - tests/mcp-task-store.test.js
  - tests/run-task-cleanup-paths.test.js
  - tests/run-task-heartbeat.test.js
  - tests/run-task-resolve-discipline.test.js
findings:
  critical: 0
  warning: 2
  info: 4
  total: 6
status: issues_found
---

# Phase 239: Code Review Report

**Reviewed:** 2026-05-05
**Depth:** standard
**Files Reviewed:** 12
**Status:** issues_found

## Summary

Phase 239 implements the run_task lifecycle fix correctly along the four invariants requested in the review prompt:

1. **Heartbeat ticker pairing.** `clearInterval(heartbeatTimer)` is invoked unconditionally inside `settle()` (mcp-bridge-client.js:735), which is the single resolve funnel for both the lifecycle-bus path and the 600s safety-net path. Both paths are confirmed cleared by the test in `tests/run-task-resolve-discipline.test.js:325, 602` (asserts `activeIntervalCount === 0` after each).

2. **Settled-flag guard placement.** `let settled = false` (mcp-bridge-client.js:681) is checked at the top of both `settle()` (line 732) and `fireHeartbeat` (line 689). The 600s timeout callback explicitly funnels through `settle()` (line 822), so the lifecycle-bus winner closes out the timer-fired path silently and vice versa. The double-resolve test (`no_double_resolve_under_race`) covers this.

3. **sw_evicted server-side catch.** `mcp/src/tools/autopilot.ts:125-178` correctly polls `bridge.isConnected` with a 30s grace deadline and falls back to `partial_state: null` if the bridge never reconnects. The catch only triggers on the verbatim `'Bridge disconnected'` error string emitted by `mcp/src/bridge.ts:139`, which is documented in a load-bearing comment at bridge.ts:131-135 ("do NOT change the rejection of pendingRequests").

4. **chrome.storage.session task-store.** `extension/utils/mcp-task-store.js` mirrors the agent-registry.js envelope shape `{v:1, records:{}}`, follows the empty-records-removes-key discipline, and exposes the 5-function API with best-effort try/catch wrappers. The 10-case test suite (`tests/mcp-task-store.test.js`) covers round-trips, version mismatch, empty-state cleanup, and chrome-unavailable graceful degradation.

The implementation also preserves the **D-07 additive-only invariant**: the success-path resolve shape on the lifecycle-bus path returns `{sessionId, status, result}` unchanged from pre-Phase-239; new fields (`partial_outcome`, `partial_state`, `hint`, `sw_evicted`) appear only on the safety-net and sw_evicted edge cases.

The **canonical hint string** `'lifecycle event missing -- audit cleanup paths'` is verbatim in both the implementation (mcp-bridge-client.js:827) and the test assertion (tests/run-task-resolve-discipline.test.js:365) — no drift.

Two non-trivial issues are documented below as warnings; neither blocks the phase but both are visible from the same review questions you asked. Four lower-severity items are listed under Info.

## Warnings

### WR-01: Two terminal-event call sites in agent-loop.js still use raw `chrome.runtime.sendMessage` instead of `fsbBroadcastAutomationLifecycle`

**File:** `extension/ai/agent-loop.js:1401, 1431`
**Issue:**
The Phase 239 fix correctly routed `notifySidepanel()` (line 1285) through `fsbBroadcastAutomationLifecycle`, and the source-grep gate at `tests/run-task-cleanup-paths.test.js:184-186` validates that `notifySidepanel`'s body contains zero `chrome.runtime.sendMessage`. However, two **other** terminal-event broadcasts in the same file remain unwrapped:

- `runAgentIteration` "session not found" guard (line 1399-1424): emits `automationComplete` with `reason: 'session_not_found'` via raw `chrome.runtime.sendMessage(...)`.
- `runAgentIteration` "session not running" guard (line 1428-1454): emits `automationComplete` with `reason: 'session_not_running'` via raw `chrome.runtime.sendMessage(...)`.

In a real Chrome MV3 service worker, `chrome.runtime.sendMessage` does NOT loop back to listeners in the same SW context. The MCP bridge client's `chrome.runtime.onMessage` listener (mcp-bridge-client.js:884-891) lives in the same SW, so it never receives these terminal events. If a `run_task` MCP call enters one of these guard branches (which can happen after an SW restart where the in-memory session map was lost but the persistent record was not yet rehydrated, or where a stale call lands on a stopped session), the bridge client's promise will only resolve via the 600s safety net rather than immediately on terminal exit. This is exactly the bug Phase 239 was designed to eliminate.

The existing grep gate test does NOT catch this because it scopes its `chrome.runtime.sendMessage` count to the body of `notifySidepanel` only (test/run-task-cleanup-paths.test.js:182-186 uses brace-counted body extraction).

**Fix:**
Replace both raw `chrome.runtime.sendMessage(...)` calls with `fsbBroadcastAutomationLifecycle(...)` so the in-SW lifecycle bus also receives the terminal event. The helper is already exported on `globalThis` (background.js:2061) before agent-loop.js loads via importScripts, so the resolution pattern matches `notifySidepanel`:

```javascript
// agent-loop.js:1399-1425 -- session not found guard
console.warn('[agent-loop] runAgentIteration: session not found ...');
try {
  var helperHost = (typeof globalThis !== 'undefined') ? globalThis : null;
  var msg = {
    action: 'automationComplete',
    sessionId: sessionId,
    conversationId: null,
    historySessionId: sessionId,
    result: 'Session not found. Automation cannot continue.',
    partial: false,
    stopped: true,
    error: null,
    reason: 'session_not_found',
    outcome: 'stopped',
    blocker: null,
    nextStep: null,
    outcomeDetails: { /* unchanged */ },
    task: null
  };
  if (helperHost && typeof helperHost.fsbBroadcastAutomationLifecycle === 'function') {
    var p = fsbBroadcastAutomationLifecycle(msg);
    if (p && typeof p.catch === 'function') {
      p.catch(function(err) { console.warn('[agent-loop] guard broadcast delivery failed (session_not_found)', { sessionId: sessionId, error: err && err.message }); });
    }
  }
} catch (_e) { /* non-fatal */ }
return;
```

Apply the same shape to the `session_not_running` branch (line 1428-1456). Then tighten the regression test by either widening the grep gate to scope the entire `runAgentIteration` function body (not just `notifySidepanel`), or by adding two explicit-name guard tests (`session_not_found_uses_helper`, `session_not_running_uses_helper`) that exercise the lifecycle-bus dispatch at those exit points.

### WR-02: Heartbeat-vs-settle storage write race can leave snapshot stuck at `in_progress` after terminal settle

**File:** `extension/ws/mcp-bridge-client.js:688-728, 731-779`
**Issue:**
`fireHeartbeat` checks the `settled` flag at the top (line 689) but performs an `await store.writeSnapshot(...)` (line 716) AFTER multiple synchronous and asynchronous yield points. If the lifecycle bus dispatches between the guard check and the writeSnapshot call (specifically: during `_sendProgress` on line 710, which is synchronous but can throw, or during the implicit microtask boundary between the `try {}` block and the `await`), then:

1. `settle()` runs synchronously (lines 731-779), writes the terminal snapshot via `store.writeSnapshot(... status: 'complete' ...)` (line 753 — fire-and-forget with `.catch(() => {})`), and returns.
2. The pre-empted `fireHeartbeat` resumes after its await and ALSO writes a snapshot, this time with `status: 'in_progress'` (because the local closure has already captured that status).

Because the two writes are issued without coordination, whichever `chrome.storage.session.set` resolves last wins. In practice, since `fireHeartbeat`'s write was already in-flight when `settle()` called writeSnapshot, the heartbeat's `in_progress` write may overwrite the terminal `complete` write. The persisted snapshot then permanently lies about task state — visible to any future SW-wake reconciliation walk in `_reconcileInFlightTasksOnConnect` and to any `mcp:get-task-snapshot` consumer.

This is bounded in impact (the in-memory `settled` flag still guards the resolve path correctly, so no double-resolve occurs), but the persisted record can mislead diagnostics and may cause `_reconcileInFlightTasksOnConnect` (line 962-979) on a later bridge reconnect to mark a task as `partial: sw_evicted` even though it actually completed successfully.

**Fix:**
Re-check the `settled` flag immediately before the heartbeat's writeSnapshot call, or have settle's terminal write `await` to ensure ordering:

```javascript
// agent-loop.js fireHeartbeat -- after the _sendProgress block, before writeSnapshot:
if (settled) return; // re-check after synchronous _sendProgress + microtask boundaries
try {
  const store = (typeof globalThis !== 'undefined') ? globalThis.FsbMcpTaskStore : null;
  if (store && typeof store.writeSnapshot === 'function') {
    await store.writeSnapshot(sessionId, { /* ... in_progress ... */ });
  }
} catch (_e) { /* best-effort persistence */ }
```

The simpler alternative is to defer the heartbeat's storage write until AFTER it confirms `!settled` once more; that closes the small window without restructuring settle's terminal write to be awaitable.

## Info

### IN-01: `payload` parameter is shadowed by local `const payload` inside heartbeat closure

**File:** `extension/ws/mcp-bridge-client.js:645, 695`
**Issue:**
`_handleStartAutomation(payload, mcpMsgId)` declares `payload` as a parameter (line 645), then on line 695 inside `fireHeartbeat` declares `const payload = { ... }` for the heartbeat tick body. The outer `payload` is no longer referenced after line 657 (where it's already passed into `dispatchMcpMessageRoute`), so this is not a correctness bug — but the shadowing makes the code harder to read and would trip ESLint's `no-shadow` rule if it were enabled.

**Fix:** Rename the local to `tickPayload` to make intent obvious:

```javascript
const tickPayload = {
  timestamp: lastHeartbeatAt,
  sessionId,
  taskId: sessionId,
  alive: true,
  // ...
};
try { this._sendProgress(mcpMsgId, tickPayload); } catch (_e) {}
```

### IN-02: SW-wake reconciler unconditionally marks all in-flight snapshots as `sw_evicted` on every bridge reconnect, including non-eviction reconnects

**File:** `extension/ws/mcp-bridge-client.js:962-979`
**Issue:**
`_reconcileInFlightTasksOnConnect()` runs once per bridge `onopen` event. `this._inFlightTasksReconciled` is reset to `false` on every `onclose` (line 121), so any WS bounce that does NOT correspond to an SW eviction (e.g. transient network drop, server restart, hub-relay promotion) will still cause every in-flight snapshot to be flagged `sw_evicted: true`. In production this is mostly self-correcting (the next 30s heartbeat tick on the still-running `_handleStartAutomation` promise overwrites the snapshot back to `in_progress`), but during the gap the persisted record lies, and any `mcp:get-task-snapshot` lookup landing in that window will return a misleading status.

The autopilot.ts server-side catch (line 125-178) is the authoritative settle path, so per CONTEXT D-05 this is acceptable best-effort behavior. Worth a comment clarifying that the reconciler's mark is advisory and may be overwritten by a still-live heartbeat ticker.

**Fix:** Add a `sw_evicted_inferred: true` flag on the reconciliation write (instead of `sw_evicted: true`) so downstream readers can distinguish server-confirmed eviction from reconciler-inferred eviction. Or simply add a comment at line 970:

```javascript
// Mark advisory only -- a still-running _handleStartAutomation closure on
// this same SW will overwrite this with its next 30s heartbeat tick. The
// authoritative sw_evicted decision lives server-side in autopilot.ts.
```

### IN-03: `_handleGetTaskSnapshot` does not validate that `agentId` is a string before passing to `readSnapshot`

**File:** `extension/ws/mcp-bridge-client.js:940-950`
**Issue:**
`payload.agentId` is consumed as-is. The store's `readSnapshot` already silently no-ops for non-string input (mcp-task-store.js:139 — returns null), so this is defensive layering, but adding a single guard makes intent visible:

```javascript
const agentId = payload && typeof payload.agentId === 'string' ? payload.agentId : null;
if (!agentId) return { success: true, snapshot: null };
```

**Fix:** As shown above. Low priority.

### IN-04: Source-grep gate test only validates `notifySidepanel` body, not the broader agent-loop terminal event surface

**File:** `tests/run-task-cleanup-paths.test.js:163-187`
**Issue:**
The `agent_loop_uses_helper` test extracts the `notifySidepanel` function body via brace counting and asserts zero `chrome.runtime.sendMessage` calls in that scope. This is the exact regression the test was designed to catch, and it does so correctly. However, it does not cover the related terminal-event call sites in `runAgentIteration` (see WR-01 above), so the "use the helper everywhere agent-loop emits a terminal event" invariant is not fully enforced by a test gate.

**Fix:** Either widen the gate to scope the entire `runAgentIteration` function (covering both the notifySidepanel body and the two guard branches), or add separate gate tests for each runAgentIteration guard branch. Suggested addition:

```javascript
runTest('agent_loop_run_iteration_guards_use_helper', () => {
  const src = fs.readFileSync(AGENT_LOOP_PATH, 'utf8');
  const declRegex = /function\s+runAgentIteration\s*\([^)]*\)\s*\{/;
  const declMatch = declRegex.exec(src);
  assert.ok(declMatch, 'runAgentIteration function must exist');
  // Brace-count the body (same approach as agent_loop_uses_helper)
  // ... extract body ...
  const sendMessageInBody = (body.match(/chrome\.runtime\.sendMessage\s*\(/g) || []).length;
  assert.strictEqual(sendMessageInBody, 0, 'runAgentIteration must NOT use chrome.runtime.sendMessage for terminal events');
});
```

---

_Reviewed: 2026-05-05_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
