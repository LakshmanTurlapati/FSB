# Phase 239: MCP `run_task` Return-on-Completion (Phase 236 reborn) - Research

**Researched:** 2026-05-06
**Domain:** MCP server <-> extension bridge lifecycle; chrome.storage.session persistence; MV3 service worker eviction recovery
**Confidence:** HIGH (all critical claims verified against live codebase + MCP spec + Chrome docs)

---

## Summary

Phase 239 is a **two-surface fix** with a **third, harder, hidden surface**:

1. The MCP server tool `run_task` in `mcp/src/tools/autopilot.ts:61` waits on `bridge.sendAndWait` with `timeout: 300_000`. This is the OUTER ceiling.
2. The extension-side `_handleStartAutomation` in `extension/ws/mcp-bridge-client.js:684-686` independently waits on a Promise with a 300s `setTimeout`. This is a SECOND, separate ceiling — the bridge-client resolves the call locally with `status: 'timeout'`, which the MCP server then returns as a successful payload (so the server's 300_000 ceiling never actually fires today; the extension always fires first).
3. The hidden surface: `extension/ai/agent-loop.js` is the v0.9.50 successor to background.js's old in-line automation loop. **All 13 of its terminal exits use raw `chrome.runtime.sendMessage({action: 'automationComplete', ...})` — NOT `fsbBroadcastAutomationLifecycle`.** The lifecycle bus is only fed from background.js terminal sites (5 of them). This means today's `run_task` resolves via the in-SW lifecycle bus ONLY for legacy / replay paths — modern AI loop completions hit the 300s ceiling unless the test grep gate (`runBackgroundLifecycleBroadcasterSourceCase` in `mcp-bridge-client-lifecycle.test.js:443-445`) was wrong about catching all sites. **It was wrong.** The regex only scans `extension/background.js`, not `extension/ai/agent-loop.js`. This is the root cause of the "300s ceiling always fires" bug Phase 236 was meant to fix.

Heartbeat: today no `automationProgress` events are emitted ANYWHERE in the codebase. The bridge-client listener at `mcp-bridge-client.js:691,721` is dead code. Dashboard progress goes through a separate `ext:task-progress` socket message (`background.js:1389`). The 30s heartbeat must be NEW, fired from inside the extension lifecycle subscription scope (where `mcpMsgId` is in scope) on a `setInterval` paired with subscribe/unsubscribe.

Persistence: chrome.storage.session quota is 10 MB (Chrome 112+). The visual-session and Phase 237 agent-registry both use a `{v: 1, ...}` envelope. Mirror that shape for the new task-store.

**Primary recommendation:** Land Phase 239 as **two coordinated edits** plus **one bug-fix**:
- (a) New `extension/utils/mcp-task-store.js` helper (mirrors visual-session shape; ~80 LoC).
- (b) Heartbeat ticker + sw_evicted/partial_outcome resolve discipline inside `_handleStartAutomation`.
- (c) **Bug-fix in `extension/ai/agent-loop.js`**: replace 13 raw `chrome.runtime.sendMessage({action: 'automationComplete', ...})` call sites with `fsbBroadcastAutomationLifecycle(...)` so the lifecycle bus actually fires on modern AI-loop terminal exits. **Without this fix, SC#1 cannot pass.** This is the actual Phase 236 fix the original phase was deferred for.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MCP-03 | `run_task` returns on completion via `fsbAutomationLifecycleBus` | Sections "Cleanup-Path Audit" + "Critical Bug: agent-loop.js bypasses lifecycle bus" — the bus exists, the subscription wiring exists, but agent-loop.js never feeds it. Fix is mechanical (replace 13 call sites). |
| MCP-04 | 300s -> 600s safety net | Section "Two 300s Ceilings" — both sites identified; treatment differs (bridge-client is the active firing site; server is dead code today but must still be raised for symmetry). |
| MCP-05 | 30s heartbeat ticks via `_sendProgress` / `notifications/progress` | Section "Heartbeat Architecture" — must introduce a setInterval inside `_handleStartAutomation` scoped to the in-flight task; teardown in the existing `settle` function. Pattern: subscribe-and-pair, mirroring lifecycle bus listeners. |
| MCP-06 | Task lifecycle persisted in chrome.storage.session keyed by `task_id` | Section "Persistence Architecture" — new `mcp-task-store.js` mirroring visual-session envelope; SW-wake reconciliation in the `_handleMessage` boot path. |
</phase_requirements>

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01 Heartbeat payload is progress-rich.** Every 30s tick carries `{timestamp, sessionId, taskId, alive: true, step, elapsed_ms, current_url, ai_cycles, last_action}`.
- **D-02 Wire shape uses MCP `_meta`.** Notification is `notifications/progress` with `{progress, total, progressToken, _meta: {step, elapsed_ms, current_url, ai_cycles, last_action, alive: true}}`. `_meta` is the spec's standard vendor-extension slot.
- **D-03 Rich snapshot stored per `task_id`.** Shape mirrors v0.9.36 visual-session pattern:
  ```
  {
    task_id, status, started_at, last_heartbeat_at,
    originating_mcp_call_id, target_tab_id, current_step,
    ai_cycle_count, last_dom_hash, final_result?
  }
  ```
- **D-04 Write cadence: every heartbeat tick AND every state transition.** Steady-state ~2/min plus terminal events.
- **D-05 SW-wake resume semantics: explicit `sw_evicted` outcome.** When SW wakes mid-task with persisted in-flight task and no terminal event, the originating `run_task` settles with `{success: t/f, sw_evicted: true, partial_state: {...}, last_heartbeat_at}`. No ghost continuations.
- **D-06 600s safety-net firing: `partial_outcome: 'timeout'`.** When ceiling actually fires, settle with `{success: true, partial_outcome: 'timeout', partial_state: {...}, hint: 'lifecycle event missing -- audit cleanup paths'}`.
- **D-07 Additive only.** Existing `run_task` callers see no diff in success-path responses. New fields appear ONLY when edge case fires. No `response_version` bump.
- **D-08 Written audit table + per-path regression tests.** Ship `239-CLEANUP-AUDIT.md` with one row per cleanup exit path, plus `tests/run-task-cleanup-paths.test.js` with one named test per row.

### Claude's Discretion

- TypeScript shape declarations for the persisted snapshot — planner picks canonical type.
- Exact module placement of the sw_evicted/partial_outcome decision logic — extending autopilot.ts vs new run-task-resolver.ts vs extending bridge client; planner decides based on dependency direction.
- Test framework: existing plain-Node `assert` harness (Phase 238 convention).
- Whether persistence layer reads/writes through new `mcp-task-store.js` helper or inlines (recommended: thin helper module mirroring visual-session shape).
- Whether to enumerate other `run_task` callers — Phase 238 already mapped bridge.sendAndWait sites; planner can reuse.

### Deferred Ideas (OUT OF SCOPE)

- Attempt-to-keep-running on SW wake (Option B from D-05). Continuing the automation loop from `current_step` after SW eviction is deferred.
- Probe-then-decide on 600s fire (Option C from D-06). Final read of chrome.storage.session with 5s race-window before settling.
- Append-only event log for the persisted snapshot.
- `response_version: 2` schema bump.
- Pre-commit grep gate for new cleanupSession-equivalent paths (deferred to Phase 244).
- Removing 600s safety net entirely (deferred to Phase 244 conditional on D-08 + 5 UAT runs).

</user_constraints>

## Project Constraints (from CLAUDE.md)

- **No emojis** in markdown, code, terminal logs, README, or any other artifact (user CLAUDE.md global rule, project CLAUDE.md echoes).
- **Branch-locked to `Refinements`.** No git push, no PRs in any phase.
- **`.planning/` is gitignored** — phase commits via `gsd-tools commit` return `skipped_gitignored` (expected, not error).
- **Must preserve** existing single-agent autopilot loop and v0.9.36 manual MCP visual-session contracts (no regressions).
- **No new manifest permissions allowed.**
- **No new npm dependencies in `mcp/`** other than the `@modelcontextprotocol/sdk` minor bump (and that bump is Phase 244, not this phase).
- **Plain-Node `assert` harness** is the test convention (Phase 238 precedent: agent-scope.test.js, agent-bridge-routes.test.js, agent-id-threading.test.js).

---

## Standard Stack

This phase introduces **zero new dependencies**. All work is on FSB-internal surfaces.

### Existing surfaces this phase touches

| Surface | File | Purpose |
|---------|------|---------|
| MCP server `run_task` tool | `mcp/src/tools/autopilot.ts:21-66` | Outer 300s ceiling (D-06: raise to 600s); progress notification site already exists at lines 38-48 |
| Bridge `sendAndWait` | `mcp/src/bridge.ts:153-201` | Server-side message wait; already accepts `onProgress` callback (line 188-190); routes `mcp:progress` messages to listener (line 514, 709) |
| Extension bridge `_handleStartAutomation` | `extension/ws/mcp-bridge-client.js:631-746` | Inner 300s ceiling at line 684-686; lifecycle bus subscription at lines 726-744; `settle` discipline at lines 662-682 |
| `_sendProgress` helper | `extension/ws/mcp-bridge-client.js:270-272` | Sends `{id, type: 'mcp:progress', payload: progressData}` over the websocket |
| Lifecycle bus | `extension/background.js:2007-2058` | `globalThis.fsbAutomationLifecycleBus` EventTarget; `fsbBroadcastAutomationLifecycle()` helper dispatches to BOTH `chrome.runtime.sendMessage` AND `bus.dispatchEvent(new CustomEvent(action, {detail: message}))` |
| `cleanupSession()` | `extension/background.js:1757-1850` | Session teardown — does NOT itself emit lifecycle events; lifecycle event must fire BEFORE cleanupSession is called by the terminal-exit caller |
| Visual-session storage pattern | `extension/utils/mcp-visual-session.js` | Reference shape for D-03 envelope (`McpVisualSessionManager` class, `serializeMcpVisualSessionRecord`, `restoreMcpVisualSessionRecord`) |
| Agent-registry write-through | `extension/utils/agent-registry.js:39-95` | Phase 237 reference for `{v: 1, records}` envelope; lazy `_getChrome()`; conservative-on-error posture |

### MCP spec references

| Spec section | Source | Use |
|--------------|--------|-----|
| `notifications/progress` shape | [MCP 2025-03-26 spec - progress](https://modelcontextprotocol.io/specification/2025-03-26/basic/utilities/progress) | Confirms `{progressToken, progress, total, message}` and that `_meta` is the standard vendor-extension slot |
| `_meta` field | MCP spec; existing FSB usage at `autopilot.ts:38,42` already reads `extra._meta?.progressToken` | Confirms `_meta` lives on `extra` (the request `_meta`) on the tool-receive side; on the `sendNotification` side, `_meta` rides under `params._meta` |

[VERIFIED: codebase grep `mcp/src/tools/autopilot.ts:38`] — FSB already reads `extra._meta?.progressToken`. Adding `_meta` to outgoing `notifications/progress` `params` is a one-line addition.

[CITED: modelcontextprotocol.io/specification/2025-03-26/basic/utilities/progress] — `_meta` is the documented vendor-extension slot. Hosts (Claude Code, Cursor, OpenClaw) MUST pass it through unchanged per spec; verifying via UAT (SC#5) confirms in-the-wild behavior.

---

## Architecture Patterns

### Recommended Module Layout

```
extension/
  utils/
    mcp-visual-session.js       # existing — D-03 shape reference
    agent-registry.js           # existing — D-04 cadence reference
    mcp-task-store.js           # NEW — D-03/D-04 task persistence (~80 LoC)
  ws/
    mcp-bridge-client.js        # EDIT — heartbeat ticker, sw_evicted, partial_outcome, store integration
  ai/
    agent-loop.js               # EDIT — 13 sites: chrome.runtime.sendMessage -> fsbBroadcastAutomationLifecycle
  background.js                 # EDIT (small) — verify all 5 cleanup paths emit; mostly an audit, not code
mcp/
  src/
    tools/
      autopilot.ts              # EDIT — raise 300_000 -> 600_000; add 30s heartbeat _meta block to existing onProgress
tests/
  run-task-cleanup-paths.test.js # NEW — 5 named cases (D-08)
  mcp-task-store.test.js         # NEW — write/read/hydrate/reconcile-on-wake
  run-task-heartbeat.test.js     # NEW — setInterval lifecycle (start, fire, cancel, no leak)
  run-task-resolve-discipline.test.js # NEW — single-resolve invariant under race
.planning/phases/239-mcp-run-task-return-on-completion-phase-236-reborn/
  239-CLEANUP-AUDIT.md          # NEW — D-08 audit table
```

### Pattern 1: Lifecycle-bus subscribe + paired-cleanup

[VERIFIED: codebase `extension/ws/mcp-bridge-client.js:659-744`]

The current pattern at `_handleStartAutomation` already shows the discipline this phase must extend:

```javascript
return new Promise((resolve) => {
  let settled = false;

  const settle = (value, source) => {
    if (settled) return;
    settled = true;
    clearTimeout(timeout);
    chrome.runtime.onMessage.removeListener(runtimeListener);
    if (lifecycleBus && typeof lifecycleBus.removeEventListener === 'function') {
      lifecycleBus.removeEventListener('automationComplete', busCompleteHandler);
      lifecycleBus.removeEventListener('automationError', busErrorHandler);
    }
    resolve(value);
  };

  const timeout = setTimeout(() => {
    settle({ sessionId, status: 'timeout', message: 'Automation timed out after 5 minutes' }, 'timeout');
  }, 300000);   // <-- THIS IS THE 300s CEILING (D-06: raise to 600_000; settle with partial_outcome)

  // ... runtimeListener + busCompleteHandler + busErrorHandler attach + listener registrations
});
```

**Phase 239 extends this scope** with two new paired-cleanup subscriptions:
1. **30s heartbeat ticker** (`setInterval` for D-01/D-02) — `clearInterval` in `settle`.
2. **Task-store snapshot writes** — every 30s tick + every state transition (D-04). No teardown needed (writes are idempotent), but the snapshot's terminal write happens inside `settle`.

### Pattern 2: Lifecycle-bus broadcast helper

[VERIFIED: codebase `extension/background.js:2034-2058`]

```javascript
function fsbBroadcastAutomationLifecycle(message) {
  // 1. Cross-context broadcast
  const sendPromise = chrome.runtime.sendMessage(message);
  const promise = (sendPromise && typeof sendPromise.catch === 'function')
    ? sendPromise.catch((err) => { /* swallow no-receiver errors */ })
    : Promise.resolve();

  // 2. In-process dispatch for SW-context listeners (MCP bridge client)
  try {
    const bus = globalThis.fsbAutomationLifecycleBus;
    if (bus && typeof bus.dispatchEvent === 'function' && message && message.action) {
      bus.dispatchEvent(new CustomEvent(message.action, { detail: message }));
    }
  } catch (busErr) { /* dispatch failure must never break broadcast */ }

  return promise;
}
```

**Phase 239's bug-fix piece** is to make `agent-loop.js` use this helper instead of raw `chrome.runtime.sendMessage`. Currently agent-loop calls the raw API at lines 1282, 1379, 1409 — and ALL of these flow through `notifySidepanel()` (line 1277-1307), which is itself called from `finalizeSession()` (line 1345-1354), which is the actual fan-in for 13 terminal exits (lines 1520, 1537, 1729, 1955, 2056, 2092, 2213, 2276, 2309, 2397, 2411, 2440 — plus the two guard exits at 1378 and 1408).

**Fix is one-line in `notifySidepanel`:** swap `chrome.runtime.sendMessage(...)` for `fsbBroadcastAutomationLifecycle(...)` — though there's a wrinkle: `agent-loop.js` is loaded as a content-script-style module, not via importScripts. Verify the helper is reachable from agent-loop's scope (it should be on `globalThis` per `background.js:2061`).

### Pattern 3: chrome.storage.session envelope

[VERIFIED: codebase `extension/utils/agent-registry.js:73-95`]

```javascript
async function writePersistedTaskRegistry(records) {
  var c = _getChrome();
  if (!c || !c.storage || !c.storage.session) return;
  try {
    var nextRecords = (records && typeof records === 'object') ? records : {};
    if (Object.keys(nextRecords).length === 0) {
      if (typeof c.storage.session.remove === 'function') {
        await c.storage.session.remove(FSB_TASK_REGISTRY_STORAGE_KEY);
      }
      return;
    }
    var payload = {};
    payload[FSB_TASK_REGISTRY_STORAGE_KEY] = {
      v: FSB_TASK_REGISTRY_PAYLOAD_VERSION,
      records: nextRecords,
    };
    if (typeof c.storage.session.set === 'function') {
      await c.storage.session.set(payload);
    }
  } catch (_e) { /* best-effort; do not throw */ }
}
```

Reuse this pattern verbatim for `mcp-task-store.js`. Key suggestion: `fsbRunTaskRegistry`. Single-task-only for v0.9.60 (concurrent run_task is multi-agent and lands in Phase 240+).

### Pattern 4: Single-resolve invariant under race

The `settled` boolean at `mcp-bridge-client.js:660-664` is the existing race protection for `lifecycle event vs 300s timeout`. Phase 239 introduces THREE additional resolve sources:

- 600s safety net (replaces 300s)
- SW-wake reconciliation (resolves with `sw_evicted: true` if persisted task found with no terminal event)
- Heartbeat-ticker is NOT a resolve source — it only writes to the store and emits notifications

The `settled` boolean handles all of them as long as every new source goes through `settle(value, source)`. **Critical invariant:** `clearInterval(heartbeatTimer)` must be called inside `settle` BEFORE `resolve(value)` to prevent ticker leak across many tool invocations.

### Anti-Patterns to Avoid

- **Hand-rolling progress envelope outside `_sendProgress`.** Use the existing helper. Even the heartbeat tick should construct the same envelope and call `this._sendProgress(mcpMsgId, payload)`.
- **Inlining storage calls instead of helper module.** D-04 cadence + reconcile-on-wake is enough logic that ~80 LoC of helper is justified vs ~30 LoC of inlined; planner has discretion but recommended is helper module.
- **Mounting heartbeat ticker before lifecycle subscription.** Order: (1) subscribe to bus, (2) start heartbeat, (3) await settle. Reversed order can race a fast-completion that fires before the listener is attached.
- **Using `chrome.alarms` for the 30s heartbeat.** chrome.alarms minimum period is 30s in MV3 (was 1 minute pre-Chrome 117). The MV3 service worker stays alive while a tool call is in flight (via the existing `keepAliveInterval` in background.js:1740). `setInterval` is correct here. Document that if SW evicts, the heartbeat stops — and SW-wake reconciliation (D-05) is the recovery path.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Progress notification envelope | Custom JSON-RPC builder | Existing `_sendProgress(id, payload)` at `mcp-bridge-client.js:270` and the existing `extra.sendNotification` block at `autopilot.ts:38-48` | Already wired through `bridge.ts:514,709` to `progressListeners` map; new ticker just needs to call them |
| Lifecycle event broadcast | Direct `chrome.runtime.sendMessage` | `fsbBroadcastAutomationLifecycle()` at `background.js:2034` | Dispatches to BOTH cross-context (UI) AND in-SW bus (MCP bridge); the bus is the only path that resolves `run_task` |
| chrome.storage.session helper | Inline `chrome.storage.session.set` calls | New `mcp-task-store.js` mirroring `agent-registry.js:73-95` | Versioned envelope, conservative-on-error posture, lazy chrome reference for Node test harness |
| SW eviction detection | Heartbeat-based liveness probe | `chrome.runtime.onStartup` + on-demand persisted-task check during `_handleMessage` (the bridge client's message handler runs on every incoming MCP request, including the first one after SW boot) | The boot path naturally finds stale tasks; no separate detection needed |
| Race-protected resolve | Add new `if (resolved) return` checks at each call site | Reuse the existing `settled` boolean + `settle(value, source)` discipline | Already proven in production (`mcp-bridge-client.js:660-682`) |

**Key insight:** This phase is mostly **plumbing additions** to existing surfaces, plus ONE bug fix in agent-loop.js. The hardest part is the cleanup-path audit — not because it's complex, but because it requires reading every terminal exit in the modern AI loop.

---

## Runtime State Inventory

This is **not** a rename / refactor / migration phase — it's a feature phase. Skipping the canonical 5-category inventory in favor of a phase-specific check:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| **Stored data** that needs schema awareness | `chrome.storage.session` entries: `fsbAgentRegistry` (Phase 237), `fsbMcpVisualSessions` (v0.9.36), `fsbConversationSessions`, per-session `session_<sessionId>` keys (background.js:2240). NEW key: `fsbRunTaskRegistry`. | None — additive new key. Document in Phase 244 SDK-bump SUMMARY. |
| **Live service config** | None | — |
| **OS-registered state** | None | — |
| **Secrets/env vars** | None | — |
| **Build artifacts** | `mcp/build/*` is regenerated on every `npm --prefix mcp run build`; affected by autopilot.ts edit | Run build before testing; tests already do this (`package.json:test:mcp-smoke`). |

---

## Common Pitfalls

### Pitfall 1: agent-loop.js's notifySidepanel bypasses the lifecycle bus

**What goes wrong:** `agent-loop.js` is the modern AI loop (Phase 181 D-01/D-02 per code comments). It calls `chrome.runtime.sendMessage({action: 'automationComplete', ...})` directly at lines 1282, 1379, 1409 — three sites that fan in via `notifySidepanel()` and `finalizeSession()` from 13 terminal-exit call sites. The lifecycle bus is never dispatched, so `_handleStartAutomation`'s `busCompleteHandler` (mcp-bridge-client.js:728-732) never fires for modern AI loop completions. **`run_task` always hits the 300s ceiling on real automation runs today.**
**Why it happens:** When agent-loop.js was forked out of background.js as part of Phase 181, the lifecycle bus (Phase 225-01) didn't exist yet. When the bus was added later, the test gate (`mcp-bridge-client-lifecycle.test.js:443-445`) only scanned `extension/background.js` for raw sendMessage calls — agent-loop.js was outside the regex's scope.
**How to avoid:** Three steps:
1. Replace the 3 raw `chrome.runtime.sendMessage` sites in agent-loop.js with `fsbBroadcastAutomationLifecycle(...)`. The helper is exported on `globalThis` (background.js:2061), so it's reachable from agent-loop's scope.
2. Extend the test grep gate to scan `extension/ai/agent-loop.js` (and ideally any future `extension/**/*.js` files matching the agent-loop pattern).
3. **Verify the bus actually dispatches in a real Chrome run** before claiming SC#1 is met — UAT runs (SC#5) are the verification.

**Warning signs:** Tests pass but real run_task calls still timeout at 300s in the MCP host's logs. Action: grep `extension/ai/agent-loop.js` for `action: 'automationComplete'` — if matches found, the bus path is broken.

### Pitfall 2: heartbeat setInterval leak across many invocations

**What goes wrong:** A `setInterval(() => fireHeartbeat(), 30000)` started in `_handleStartAutomation` keeps ticking after the Promise resolves if `clearInterval` is missed in the `settle` function. Across many tool calls, the SW accumulates tickers — eventually thousands per session, each pushing a snapshot write to chrome.storage.session.
**Why it happens:** The existing settle function clears the 300s timeout but doesn't know about the new ticker; the ticker is added in a different code block from settle.
**How to avoid:** Add `clearInterval(heartbeatTimer)` to the `settle` function in `_handleStartAutomation` AT THE SAME TIME as the ticker is introduced. Define `heartbeatTimer` in the closure scope alongside `timeout`, so settle has it in scope.
**Warning signs:** chrome.storage.session quota warnings or slow MCP responses. Detection: log heartbeat tick count per task; assert tick count <= ceil(elapsed_ms / 30000) + 1.

### Pitfall 3: chrome.alarms vs setInterval ambiguity

**What goes wrong:** Reflexively reaching for `chrome.alarms` because "MV3 SW evicts." But chrome.alarms minimum period is 30 seconds (was 1 minute pre-Chrome 117), and chrome.alarms cannot resolve a Promise on the same task — they fire on a separate `chrome.alarms.onAlarm` listener that has no access to the in-flight `_handleStartAutomation` closure scope.
**Why it happens:** Mistaken parity with the dom-stream watchdog at `background.js:12734`, which IS chrome.alarms-based (correctly, because it survives SW eviction).
**How to avoid:** Use `setInterval`. The 30s heartbeat is for in-flight task observability while the SW IS alive (the `keepAliveInterval` at `background.js:1740` keeps it alive during automation). When SW evicts, the heartbeat stops — that's exactly the condition D-05's SW-wake reconciliation handles. setInterval and SW-wake are complementary, not competing.
**Warning signs:** If heartbeat code references `chrome.alarms.create` — review immediately.

### Pitfall 4: chrome.storage.session quota (10 MB) is large but per-extension shared

**What goes wrong:** A single in-flight task's snapshot is small (< 2 KB), but the registry is per-extension. If ever multiple `run_task` calls run concurrently (Phase 240+), they all write to the same key namespace.
**Why it happens:** `agent-registry.js` and `visual-session-manager` already share the storage area; chrome.storage.session is per-extension, not per-feature.
**How to avoid:** Use a per-task_id sub-key under the registry envelope: `{v: 1, records: { 'task_<uuid>': {...} }}`. v0.9.60 ships single-concurrent-task, so the records map will have at most 1 entry. Phase 240+ multi-agent expansion gets the right shape for free.
**Warning signs:** None expected at this phase's scope; document for Phase 240+ planner.

[CITED: developer.chrome.com/docs/extensions/reference/api/storage] — chrome.storage.session quota is 10 MB (Chrome 112+), enforced as estimated dynamically allocated memory of all keys + values combined.

### Pitfall 5: Race between lifecycle bus and 600s ceiling

**What goes wrong:** The bus event fires at the same microtask boundary as the 600s setTimeout (extremely rare, but not zero). If both call `settle(...)`, the second call must be a no-op.
**Why it happens:** JavaScript event loop ordering — promise microtasks vs timer macrotasks ordering can interleave at nanosecond boundaries.
**How to avoid:** The existing `if (settled) return` guard at `mcp-bridge-client.js:663` already handles this. Phase 239 must NOT introduce new resolve paths that bypass `settle` — every new resolve source (heartbeat? no, heartbeat doesn't resolve. SW-wake? yes. 600s ceiling? yes) must go through `settle(value, source)`.
**Warning signs:** Double-resolve warnings in MCP host logs (a Promise resolved more than once doesn't error in JS but the second value is silently dropped — this is what "no double-resolve" really means: the second SETTLE attempt was guarded out).

### Pitfall 6: D-07 "additive only" is a documentation contract, not a behavioral one

**What goes wrong:** The new fields (`sw_evicted`, `partial_outcome`, `partial_state`, `hint`) ARE breaking changes for any host that uses strict-shape validation (e.g., zod `.strict()` schemas).
**Why it happens:** "Additive only" is a polite way of saying "we promise existing keys won't change" — it does NOT promise no new keys.
**How to avoid:** Document this in v0.8.0 CHANGELOG as "new fields on edge cases only; hosts using strict schemas should add `.passthrough()` or upgrade their validators." This is a documentation responsibility, not a code responsibility.
**Warning signs:** Host-side schema validation errors after upgrading to fsb-mcp-server@0.8.0 — track via SC#5 UAT.

### Pitfall 7: cleanupSession itself does NOT emit lifecycle events

**What goes wrong:** Naive expectation: "every cleanupSession call fires a lifecycle event." Wrong. cleanupSession is downstream of the lifecycle event — every CALLER of cleanupSession is responsible for emitting the lifecycle event BEFORE calling cleanupSession.
**Why it happens:** cleanupSession is a teardown helper (delete from activeSessions, stop keep-alive, clear AI instance, flush logs). It has no idea WHY the session is ending, so it can't construct the lifecycle event.
**How to avoid:** Audit the CALLERS of cleanupSession for lifecycle event emission — that's what D-08 is. The 5 paths are caller-paths, not cleanupSession's internals.
**Warning signs:** Test asserts "cleanupSession was called" without asserting "lifecycle event fired." Tests for D-08 must assert BOTH.

---

## Cleanup-Path Audit (D-08 input)

This is the input the planner needs to draft `239-CLEANUP-AUDIT.md`. Researcher's findings on each of the 5 paths the user named, plus 3 additional paths discovered during the audit.

### Path 1: Normal completion (success) — agent-loop.js (NOT background.js)

| Property | Value |
|----------|-------|
| File:Line | `extension/ai/agent-loop.js:1955` (`finalizeSession(sessionId, session, successOutcome)`) |
| Calls cleanupSession? | YES — via `finalizeSession()` at agent-loop.js:1352 |
| Lifecycle event today | `automationComplete` via `notifySidepanel()` -> raw `chrome.runtime.sendMessage` (line 1282) — **DOES NOT HIT THE BUS** |
| Phase 239 fix needed? | YES — replace raw sendMessage with `fsbBroadcastAutomationLifecycle` |
| Regression test | `tests/run-task-cleanup-paths.test.js::normal_completion` — assert bus dispatches `automationComplete`, AND cleanupSession called |

CONTEXT.md D-08 listed this as `extension/background.js:~1945`. **That line is NOT a normal completion — it's `idleSession()`'s deferred-cleanup timer firing 10 minutes after the session went idle.** Real normal completion is in agent-loop.js. Planner should correct the audit table.

### Path 2: Stuck-detection terminal exit

| Property | Value |
|----------|-------|
| File:Line | `extension/ai/agent-loop.js:2309` (`finalizeSession(sessionId, session, stuckTerminal)`); ALSO `background.js:10918` (legacy stuck path, partial completion at `stuckCounter >= 8`) |
| Calls cleanupSession? | YES (agent-loop) / `idleSession` (background — defers cleanup, not immediate) |
| Lifecycle event today | agent-loop: raw sendMessage (broken); background.js:10918: `fsbBroadcastAutomationLifecycle({action: 'automationComplete', ..., partial: true})` (works) |
| Phase 239 fix needed? | YES — agent-loop fix; background.js path already correct |
| Regression test | `...stuck_detection_terminal` — assert bus fires from BOTH paths |

CONTEXT.md D-08 listed `~3378` — that's the **replay** path's stuck handling, not the live AI loop's stuck handling. Different path.

### Path 3: Safety breaker

| Property | Value |
|----------|-------|
| File:Line | `extension/ai/agent-loop.js:1520, 1537, 2276` (three safety-breaker exit points) |
| Calls cleanupSession? | YES — via `finalizeSession()` |
| Lifecycle event today | Raw sendMessage via notifySidepanel — **broken** |
| Phase 239 fix needed? | YES — same one-line fix in notifySidepanel |
| Regression test | `...safety_breaker` — fire safety breaker, assert bus dispatches `automationComplete` with `outcome: 'stopped'`, `reason: 'iteration_limit_exceeded' / 'cost_limit_exceeded' / 'time_limit_exceeded' / 'safety'` |

The structured `reason` constants come from `mapSafetyReasonToConstant()` at agent-loop.js:1357 — useful for asserting in tests.

### Path 4: Tab close

| Property | Value |
|----------|-------|
| File:Line | `extension/background.js:2495` (`fsbBroadcastAutomationLifecycle({action: 'automationComplete', reason: 'tab_closed', stopped: true, ...})`) |
| Calls cleanupSession? | NO directly — sets `session.status = 'stopped'`, `activeSessions.delete(sessionId)`, `removePersistedSession(sessionId)`, `sessionAIInstances.delete(sessionId)` (background.js:2528-2533). Effectively cleanupSession's body inlined; cleanupSession() itself is NOT called here. |
| Lifecycle event today | YES — `fsbBroadcastAutomationLifecycle` correctly dispatches to bus |
| Phase 239 fix needed? | NO — this path is healthy |
| Regression test | `...tab_close` — close tab during run_task, assert bus dispatches with `reason: 'tab_closed'` and run_task resolves with `stopped: true` |

### Path 5: handleStopAutomation

| Property | Value |
|----------|-------|
| File:Line | `extension/background.js:6790-6848` |
| Calls cleanupSession? | YES at `background.js:6834` (await cleanupSession before responding) |
| Lifecycle event today | **NO!** handleStopAutomation does NOT call `fsbBroadcastAutomationLifecycle`. It calls `endSessionOverlays(session, 'stopped')`, `finalizeSessionMetrics(sessionId, false)`, `cleanupSession(sessionId)`, then `sendResponse({success: true, message: 'Automation stopped'})` — **no `fsbBroadcastAutomationLifecycle` call.** |
| Phase 239 fix needed? | YES — add `fsbBroadcastAutomationLifecycle({action: 'automationComplete', sessionId, outcome: 'stopped', reason: 'user_stopped', ...})` so the run_task `_handleStartAutomation` Promise actually resolves on user-stop |
| Regression test | `...handle_stop` — call stop_task during run_task, assert bus dispatches `automationComplete`, assert run_task resolves with `outcome: 'stopped'` BEFORE the 600s ceiling |

This is a **second bug** the audit caught. CONTEXT.md D-08 listed `~6542`, which is actually the handleStartAutomation's failure path (content-script-not-ready) — not handleStopAutomation. Different function entirely.

### Additional Path 6 (newly discovered): SW restart with running session

| Property | Value |
|----------|-------|
| File:Line | `extension/background.js:2258` (in `restoreSessionsFromStorage`) |
| Calls cleanupSession? | NO — sets `session.status = 'stopped'` on the restored session |
| Lifecycle event today | YES — `fsbBroadcastAutomationLifecycle({action: 'automationComplete', reason: 'service_worker_restart', stopped: true})` |
| Phase 239 fix needed? | NO — this path is healthy AND it's the natural collision point with D-05's `sw_evicted` semantics |
| Note | This is the first place D-05 logic could plug in: when SW restores and finds a session in 'running' state with a persisted run_task store entry, the bridge client (on its own boot via `_handleMessage`) checks the store and either (a) finds a terminal event already broadcast (no-op) or (b) settles the originating MCP call with `sw_evicted: true`. |

### Additional Path 7 (newly discovered): Health-check failure

| Property | Value |
|----------|-------|
| File:Line | `extension/background.js:9263` (in agent loop fallback path) and `background.js:6546` (in handleStartAutomation pre-flight) |
| Calls cleanupSession? | YES (background.js:9279, background.js:6542) |
| Lifecycle event today | YES — `fsbBroadcastAutomationLifecycle({action: 'automationError', error: ...})` |
| Phase 239 fix needed? | NO |
| Regression test | Optional — if planner has bandwidth, add `...health_check_failure`. Otherwise covered by general `automationError` listener path. |

### Additional Path 8 (newly discovered): API/auth/bad-request errors

| Property | Value |
|----------|-------|
| File:Line | `extension/ai/agent-loop.js:2397, 2411, 2440` (three error-terminal exits) — also `background.js:10116` (failedDueToError path) |
| Calls cleanupSession? | YES — via `finalizeSession()` (agent-loop) or directly (background.js:10113) |
| Lifecycle event today | agent-loop: raw sendMessage via notifySidepanel (broken); background.js: `fsbBroadcastAutomationLifecycle({action: 'automationError', ...})` (works) |
| Phase 239 fix needed? | YES — agent-loop fix |
| Regression test | `...api_error` — simulate API failure, assert bus dispatches `automationError` |

### Audit summary

| Path | File:Line | Bus dispatch today | Phase 239 fix? |
|------|-----------|---------------------|----------------|
| Normal completion | agent-loop.js:1955 | NO (raw sendMessage) | YES — fix notifySidepanel |
| Stuck terminal | agent-loop.js:2309 (+ bg.js:10918) | partial (bg works, agent-loop broken) | YES — fix notifySidepanel |
| Safety breaker | agent-loop.js:1520, 1537, 2276 | NO | YES — fix notifySidepanel |
| Tab close | bg.js:2495 | YES | NO |
| handleStopAutomation | bg.js:6790 | **NO** | **YES — add bus call** |
| SW restart (bonus) | bg.js:2258 | YES | NO (but interacts with D-05) |
| Health-check failure | bg.js:9263, bg.js:6546 | YES | NO |
| API/auth errors | agent-loop.js:2397/2411/2440 (+ bg.js:10116) | partial | YES — fix notifySidepanel |

**Net code changes for SC#2 (audit):** 1 line in `agent-loop.js:notifySidepanel` (covers paths 1, 2, 3, 8 in agent-loop) + 1 new lifecycle dispatch in `handleStopAutomation` (path 5). The other 5 paths are already healthy.

---

## Code Examples

### Heartbeat ticker (extension side, mcp-bridge-client.js)

[VERIFIED PATTERN: `mcp-bridge-client.js:684-686` for setTimeout discipline; `mcp-bridge-client.js:270-272` for `_sendProgress` shape]

```javascript
// Inside _handleStartAutomation, alongside the existing `timeout` declaration

const heartbeatStartedAt = Date.now();
let lastHeartbeatAt = heartbeatStartedAt;

const fireHeartbeat = async () => {
  if (settled) return;  // do not emit after settle
  const session = activeSessions.get(sessionId);
  if (!session) return;  // session gone — ticker will be cleared on settle

  lastHeartbeatAt = Date.now();
  const payload = {
    timestamp: lastHeartbeatAt,
    sessionId,
    taskId: sessionId,           // taskId === sessionId in v0.9.60
    alive: true,
    step: session.iterationCount || 0,
    elapsed_ms: lastHeartbeatAt - heartbeatStartedAt,
    current_url: session.lastKnownUrl || null,
    ai_cycles: session.iterationCount || 0,
    last_action: session._lastActionSummary || null,
  };
  this._sendProgress(mcpMsgId, payload);

  // D-04 cadence: write to task-store on every heartbeat tick
  try {
    await mcpTaskStore.writeSnapshot(sessionId, {
      task_id: sessionId,
      status: 'in_progress',
      started_at: heartbeatStartedAt,
      last_heartbeat_at: lastHeartbeatAt,
      originating_mcp_call_id: mcpMsgId,
      target_tab_id: session.tabId,
      current_step: session.iterationCount || 0,
      ai_cycle_count: session.iterationCount || 0,
      last_dom_hash: session.lastDOMHash || null,
    });
  } catch (_e) { /* best-effort */ }
};

const heartbeatTimer = setInterval(fireHeartbeat, 30_000);

// settle() must clearInterval(heartbeatTimer) — add this line to existing settle:
//   clearInterval(heartbeatTimer);
```

### Heartbeat _meta envelope (server side, autopilot.ts)

[VERIFIED PATTERN: `autopilot.ts:38-48` for existing sendNotification block]

```typescript
// In autopilot.ts run_task tool, extend the existing onProgress callback

const onProgress = (p: MCPResponse) => {
  // existing fields
  const { progress, phase, eta, action, taskId } = p.payload as {
    taskId?: string; progress?: number; phase?: string; eta?: string; action?: string;
  };

  // NEW: D-01 rich heartbeat fields (when extension sends a heartbeat tick)
  const { alive, step, elapsed_ms, current_url, ai_cycles, last_action } = p.payload as {
    alive?: boolean; step?: number; elapsed_ms?: number;
    current_url?: string | null; ai_cycles?: number; last_action?: string | null;
  };

  const message = [phase && `[${phase}]`, action, eta && `(ETA: ${eta})`]
    .filter(Boolean).join(' ');

  if (extra._meta?.progressToken !== undefined) {
    extra.sendNotification({
      method: 'notifications/progress',
      params: {
        progressToken: extra._meta.progressToken,
        progress: progress ?? 0,
        total: 100,
        message,
        // D-02: rich fields under _meta vendor-extension slot
        _meta: {
          alive: alive ?? false,
          step,
          elapsed_ms,
          current_url,
          ai_cycles,
          last_action,
        },
      },
    }).catch(() => {});
  }

  // logging fallback (existing)
  server.sendLoggingMessage({
    level: 'info',
    logger: 'fsb-autopilot',
    data: { taskId, progress, phase, eta, action, alive, step, elapsed_ms, current_url, ai_cycles, last_action },
  });
};
```

### 600s safety net + partial_outcome (mcp-bridge-client.js)

```javascript
// Replace the existing 300s timeout block:
const RUN_TASK_SAFETY_NET_MS = 600_000;  // D-06 (was 300_000)

const timeout = setTimeout(async () => {
  // D-06: settle with partial_outcome instead of generic 'timeout'
  let partial_state = null;
  try {
    partial_state = await mcpTaskStore.readSnapshot(sessionId);
  } catch (_e) { /* best-effort */ }

  settle({
    sessionId,
    success: true,                  // D-06: success is true; partial_outcome surfaces the failure mode
    partial_outcome: 'timeout',
    partial_state,
    hint: 'lifecycle event missing -- audit cleanup paths',
  }, 'safety_net_600s');
}, RUN_TASK_SAFETY_NET_MS);
```

### SW-wake reconciliation (mcp-bridge-client.js, in or near _handleMessage)

```javascript
// Run on bridge client boot — first message after SW wake triggers this once
async _reconcileInFlightTasks() {
  if (this._inFlightTasksReconciled) return;
  this._inFlightTasksReconciled = true;

  try {
    const persisted = await mcpTaskStore.listInFlightSnapshots();
    for (const snapshot of persisted) {
      // If the task is in-progress with no terminal event, it was evicted
      if (snapshot.status === 'in_progress') {
        // Fire-and-forget: dispatch a synthetic settle to any in-flight Promise
        // (in practice there will be none post-eviction; this is for the
        // record-keeping side: mark snapshot as evicted)
        await mcpTaskStore.writeSnapshot(snapshot.task_id, {
          ...snapshot,
          status: 'partial',
          final_result: { sw_evicted: true, last_heartbeat_at: snapshot.last_heartbeat_at },
        });

        // The originating MCP call's Promise is gone with the SW. The MCP
        // server's bridge.sendAndWait is the surface that needs the settle —
        // and that one DID survive (server is a separate process). When the
        // bridge reconnects, the server will get a `sw_evicted` resolve via
        // a new mcp:result message we synthesize here:
        if (this._send && snapshot.originating_mcp_call_id) {
          this._sendResult(snapshot.originating_mcp_call_id, {
            success: true,
            sw_evicted: true,
            partial_state: snapshot,
            last_heartbeat_at: snapshot.last_heartbeat_at,
          });
        }
      }
    }
  } catch (_e) { /* swallow; reconciliation is best-effort */ }
}
```

[ASSUMED] — The `_sendResult(originating_mcp_call_id, ...)` path requires that the MCP server's `pendingRequests.get(originating_mcp_call_id)` still exists post-bridge-reconnect. **This requires verification by the planner** — if the bridge.ts pendingRequests map is cleared on disconnect (line 137 `progressListeners.clear()` is suggestive), then SW-wake settle requires a different path (e.g., the server itself catching the bridge disconnect and resolving outstanding sendAndWait calls with `sw_evicted: true`). This is the single highest-risk unknown in this research and should be the first thing the planner verifies.

### Task-store helper module (extension/utils/mcp-task-store.js, sketch)

[PATTERN: mirrors `extension/utils/agent-registry.js` storage helpers]

```javascript
(function(global) {
  'use strict';

  var FSB_RUN_TASK_REGISTRY_STORAGE_KEY = 'fsbRunTaskRegistry';
  var FSB_RUN_TASK_REGISTRY_PAYLOAD_VERSION = 1;

  function _getChrome() {
    return (typeof globalThis !== 'undefined' && globalThis.chrome) ? globalThis.chrome : null;
  }

  async function _readEnvelope() {
    var c = _getChrome();
    if (!c?.storage?.session?.get) return { v: FSB_RUN_TASK_REGISTRY_PAYLOAD_VERSION, records: {} };
    try {
      var stored = await c.storage.session.get([FSB_RUN_TASK_REGISTRY_STORAGE_KEY]);
      var payload = stored?.[FSB_RUN_TASK_REGISTRY_STORAGE_KEY];
      if (!payload || payload.v !== FSB_RUN_TASK_REGISTRY_PAYLOAD_VERSION) {
        return { v: FSB_RUN_TASK_REGISTRY_PAYLOAD_VERSION, records: {} };
      }
      return payload;
    } catch (_e) {
      return { v: FSB_RUN_TASK_REGISTRY_PAYLOAD_VERSION, records: {} };
    }
  }

  async function _writeEnvelope(envelope) {
    var c = _getChrome();
    if (!c?.storage?.session?.set) return;
    try {
      var payload = {};
      payload[FSB_RUN_TASK_REGISTRY_STORAGE_KEY] = envelope;
      await c.storage.session.set(payload);
    } catch (_e) { /* best-effort */ }
  }

  async function writeSnapshot(taskId, snapshot) {
    var envelope = await _readEnvelope();
    envelope.records[taskId] = snapshot;
    await _writeEnvelope(envelope);
  }

  async function readSnapshot(taskId) {
    var envelope = await _readEnvelope();
    return envelope.records[taskId] || null;
  }

  async function deleteSnapshot(taskId) {
    var envelope = await _readEnvelope();
    delete envelope.records[taskId];
    if (Object.keys(envelope.records).length === 0) {
      var c = _getChrome();
      if (c?.storage?.session?.remove) {
        await c.storage.session.remove(FSB_RUN_TASK_REGISTRY_STORAGE_KEY);
      }
      return;
    }
    await _writeEnvelope(envelope);
  }

  async function listInFlightSnapshots() {
    var envelope = await _readEnvelope();
    return Object.values(envelope.records).filter(s => s && s.status === 'in_progress');
  }

  var exportsObj = {
    writeSnapshot, readSnapshot, deleteSnapshot, listInFlightSnapshots,
    FSB_RUN_TASK_REGISTRY_STORAGE_KEY, FSB_RUN_TASK_REGISTRY_PAYLOAD_VERSION,
  };

  global.FsbMcpTaskStore = exportsObj;
  if (typeof module !== 'undefined' && module.exports) module.exports = exportsObj;
})(typeof globalThis !== 'undefined' ? globalThis : this);
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single-context `chrome.runtime.sendMessage` for terminal events | `fsbBroadcastAutomationLifecycle` dual-dispatch (cross-context + in-SW EventTarget bus) | Phase 225-01 (v0.9.50?) | The bus is the only path that resolves run_task in-SW; agent-loop.js still uses the old approach (this phase's bug fix) |
| Inline `chrome.storage.session.set` calls | Versioned envelope `{v: 1, records: {...}}` via helper module | Phase 237 agent-registry + v0.9.36 visual-session | Schema migration safety; lazy chrome reference for Node test harness |
| Separate parallel notification stream for vendor fields | MCP `_meta` vendor-extension slot under `notifications/progress.params` | MCP spec 2024-11-05 onward | One spec-clean path; no parallel transport surface |

**Deprecated/outdated:**
- `automationProgress` event listener at `mcp-bridge-client.js:691, 721` is dead code — no emitter exists. Phase 239's heartbeat is the de facto replacement. Planner can decide whether to delete the dead listener (low priority; doesn't affect functionality).
- The 300s ceiling itself (CONTEXT.md notes the 600s safety net is "provisional" — Phase 244 may remove entirely if SC#5 UAT proves zero dropped events).

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The MCP server's `bridge.pendingRequests` map survives a bridge disconnect long enough that an SW-wake reconciliation can settle the originating call via a synthesized `mcp:result` message | "SW-wake reconciliation" code example | HIGH — if pendingRequests is cleared on disconnect, the server's sendAndWait Promise is rejected, and the SW-wake reconcile-resolve path needs to be on the server side instead. **Planner MUST verify this in bridge.ts before locking the design.** |
| A2 | `globalThis.fsbBroadcastAutomationLifecycle` is reachable from `extension/ai/agent-loop.js`'s scope (agent-loop is loaded as part of background.js scope chain) | "Pattern 2: Lifecycle-bus broadcast helper" | LOW — agent-loop.js runs in the same SW global; verified by grep showing background.js:6608 passes `cleanupSession` (a top-level function) to runAgentLoop, so top-level globals are accessible. Worst case: a one-line module-load-order check. |
| A3 | The hosts (Claude Code, Cursor, OpenClaw) preserve the `_meta` field from `notifications/progress.params` end-to-end without dropping or rewriting it | "MCP spec references" | MEDIUM — spec says `_meta` is reserved for vendor extensions, but enforcement is host-by-host. SC#5 UAT runs against multiple hosts is the verification. |
| A4 | A heartbeat tick at 30s is acceptable to all four named hosts (Claude Code, Cursor, Codex, OpenClaw); none has a per-tool timeout shorter than 30s | "Heartbeat Architecture" | LOW — 30s is the documented minimum heartbeat to keep MCP idle pings alive across most clients. If any host is shorter, the cadence becomes 20s; trivial change. |
| A5 | `chrome.storage.session` quota of 10 MB applies in MV3 production builds (not just Chrome 112+ dev tier) | "Pitfall 4: chrome.storage.session quota" | LOW — Chrome stable is at 112+ as of 2024; FSB users on older Chrome would hit the smaller pre-112 ~1 MB quota. v0.9.31 manifest minimum_chrome_version handling should be checked by the planner. |
| A6 | The 13 `finalizeSession` call sites in agent-loop.js fan in to the same `notifySidepanel`, so the one-line fix in notifySidepanel covers all of them with no per-site changes | "Cleanup-Path Audit" — paths 1, 2, 3, 8 | LOW — verified by grep: `notifySidepanel` is the only call inside `finalizeSession` (agent-loop.js:1347), and `finalizeSession` is the only caller of `notifySidepanel`. |
| A7 | The `automationProgress` runtime listener at mcp-bridge-client.js:691, 721 is dead code (no emitter) | "State of the Art - Deprecated" | LOW — verified by grep across `extension/`: only listener references, no `'automationProgress'` emit sites. Even safer: leave the listener in place; it doesn't cost anything. |
| A8 | handleStopAutomation does not currently fire a lifecycle event (Path 5 of audit) | "Cleanup-Path Audit" — Path 5 | LOW — read background.js:6790-6848 in full; confirmed no `fsbBroadcastAutomationLifecycle` call in this function body. |

---

## Open Questions

1. **Where exactly does the SW-wake settle path live: extension or server?**
   - What we know: bridge.ts has `pendingRequests` map; clears `progressListeners` on disconnect (bridge.ts:137); behavior on `pendingRequests` during disconnect is not visually obvious from the snippet I read.
   - What's unclear: Whether sendAndWait Promises get rejected on disconnect (with what error), or whether they remain pending until reconnect.
   - Recommendation: First task of Plan 01 should be a tight read of `bridge.ts:_handleDisconnect` / `_handleClose` etc. to confirm. If pendingRequests are cleared/rejected on disconnect, SW-wake settle MUST live on the server side (catch the disconnect; mark the corresponding call as `sw_evicted: true`). If pendingRequests survive, the extension can synthesize an `mcp:result` post-reconnect.

2. **Does any current MCP host enforce strict-shape on `run_task` return?**
   - What we know: D-07 is "additive only" but new fields ARE breaking for strict validators.
   - What's unclear: Which of Claude Code, Cursor, Codex, OpenClaw use strict validation today.
   - Recommendation: SC#5 UAT runs on multiple hosts will surface this. If a host fails, document in v0.8.0 CHANGELOG with workaround.

3. **Should the heartbeat tick fire IMMEDIATELY on subscribe, or only after the first 30s elapses?**
   - What we know: D-04 says "every heartbeat tick AND every state transition" — start of automation is a state transition, so an immediate snapshot write is required.
   - What's unclear: Whether the 30s ticker should also fire its first MCP notification immediately, or wait 30s.
   - Recommendation: Fire immediately on subscribe (so MCP host gets confirmation of in-progress within 1 second), then on 30s cadence after that. This is a UX choice — planner can refine.

4. **How does the heartbeat ticker interact with stop_task during a running task?**
   - What we know: stop_task currently completes ~10s and returns `success: true, message: 'Automation stopped'`. The run_task Promise should resolve immediately after via the new lifecycle dispatch in handleStopAutomation (audit Path 5 fix).
   - What's unclear: Order — does the run_task Promise settle FIRST (as a `stopped` outcome), or does the server lose the lifecycle race because stop_task's response arrives before the bus dispatches?
   - Recommendation: handleStopAutomation should call `fsbBroadcastAutomationLifecycle(...)` BEFORE `sendResponse(...)` so the bus dispatch reaches the bridge client subscription before the stop_task return travels back to the server.

---

## Environment Availability

This phase has no external system dependencies beyond what's already in the FSB project.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js (test runner) | Plain-Node assert harness | YES | per package.json (existing CI uses 18+) | — |
| TypeScript | mcp/src compilation | YES | per `mcp/package.json` | — |
| Chrome 112+ | chrome.storage.session 10 MB quota | YES (per project's MV3 baseline) | — | If sub-112: smaller ~1 MB quota — still fine for single in-flight task envelope |
| `@modelcontextprotocol/sdk` 1.27.x | run_task `notifications/progress` _meta support | YES (current pinned version) | ^1.27.1 | — (Phase 244 bumps to ^1.29.x; outside this phase) |

No missing dependencies.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | node:test plain-Node assert harness (Phase 238 convention; no external runner) |
| Config file | none — tests are standalone Node scripts run via `package.json:test` script |
| Quick run command | `node tests/run-task-cleanup-paths.test.js` (per-test) |
| Full suite command | `npm test` (sequential chain in `package.json:scripts.test`) |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| MCP-03 | Lifecycle bus dispatch resolves run_task on normal completion (agent-loop path) | unit | `node tests/run-task-cleanup-paths.test.js` (case `normal_completion`) | ❌ Wave 0 |
| MCP-03 | Lifecycle bus dispatch resolves run_task on stuck-detection terminal exit | unit | `node tests/run-task-cleanup-paths.test.js` (case `stuck_detection_terminal`) | ❌ Wave 0 |
| MCP-03 | Lifecycle bus dispatch resolves run_task on safety breaker | unit | `node tests/run-task-cleanup-paths.test.js` (case `safety_breaker`) | ❌ Wave 0 |
| MCP-03 | Lifecycle bus dispatch resolves run_task on tab close | unit | `node tests/run-task-cleanup-paths.test.js` (case `tab_close`) | ❌ Wave 0 |
| MCP-03 | Lifecycle bus dispatch resolves run_task on handleStopAutomation | unit | `node tests/run-task-cleanup-paths.test.js` (case `handle_stop`) | ❌ Wave 0 |
| MCP-03 | agent-loop.js notifySidepanel path uses lifecycle helper, not raw sendMessage | source-grep | `node tests/run-task-cleanup-paths.test.js` (case `agent_loop_uses_helper`) | ❌ Wave 0 |
| MCP-04 | 600s ceiling fires only when no lifecycle event arrives, with `partial_outcome: 'timeout'` and partial_state | integration | `node tests/run-task-resolve-discipline.test.js` (case `safety_net_fires_with_partial_outcome`) | ❌ Wave 0 |
| MCP-04 | Lifecycle event before 600s ceiling wins; ticker cleared; no double-resolve | integration | `node tests/run-task-resolve-discipline.test.js` (case `lifecycle_wins_race`) | ❌ Wave 0 |
| MCP-05 | 30s heartbeat ticker fires within 30s of run_task start | unit | `node tests/run-task-heartbeat.test.js` (case `first_tick_within_30s`) | ❌ Wave 0 |
| MCP-05 | Heartbeat payload contains all D-01 fields under _meta | unit | `node tests/run-task-heartbeat.test.js` (case `payload_shape_d01`) | ❌ Wave 0 |
| MCP-05 | Heartbeat ticker cleared on settle (no leak) | unit | `node tests/run-task-heartbeat.test.js` (case `ticker_cleared_on_settle`) | ❌ Wave 0 |
| MCP-05 | Heartbeat does not fire after settle | unit | `node tests/run-task-heartbeat.test.js` (case `no_tick_after_settle`) | ❌ Wave 0 |
| MCP-06 | task-store writeSnapshot persists to chrome.storage.session under versioned envelope | unit | `node tests/mcp-task-store.test.js` (case `write_envelope_v1`) | ❌ Wave 0 |
| MCP-06 | task-store readSnapshot returns null for unknown task_id | unit | `node tests/mcp-task-store.test.js` (case `read_unknown_returns_null`) | ❌ Wave 0 |
| MCP-06 | task-store writeSnapshot called on every heartbeat tick + every state transition | integration | `node tests/run-task-heartbeat.test.js` (case `store_write_cadence`) | ❌ Wave 0 |
| MCP-06 | listInFlightSnapshots returns only `status: 'in_progress'` records on SW-wake | unit | `node tests/mcp-task-store.test.js` (case `list_in_flight`) | ❌ Wave 0 |
| MCP-06 | SW-wake reconciliation marks in-progress snapshot as `sw_evicted` and settles originating call | integration | `node tests/run-task-resolve-discipline.test.js` (case `sw_wake_settles_with_sw_evicted`) | ❌ Wave 0 |
| D-07 | Existing run_task contract test (mcp-tool-smoke) passes UNCHANGED on success path | regression | `node tests/mcp-tool-smoke.test.js` | ✅ exists |
| D-07 | Existing v0.9.36 visual-session contract test passes UNCHANGED | regression | `node tests/mcp-visual-session-contract.test.js` | ✅ exists |
| D-07 | Existing mcp-bridge-client-lifecycle test passes UNCHANGED | regression | `node tests/mcp-bridge-client-lifecycle.test.js` | ✅ exists |
| D-08 | Cleanup-path audit doc shipped with row-per-path | doc-presence | `test -f .planning/phases/239-*/239-CLEANUP-AUDIT.md` | N/A — doc gate |
| SC#5 | 5 long-task UAT runs (>5 min) return on actual completion, not at 600s safety net | manual UAT | human verification with logs at each 30s heartbeat boundary | manual-only — out of scope for npm test |

### Sampling Rate
- **Per task commit:** `node tests/<the-test-file>.js` for the touched test
- **Per wave merge:** `npm test` (full sequential chain in package.json)
- **Phase gate:** Full suite green + `239-CLEANUP-AUDIT.md` reviewed + 5 UAT runs documented before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/run-task-cleanup-paths.test.js` — covers MCP-03, paths 1-5 + agent-loop helper grep gate (D-08)
- [ ] `tests/run-task-resolve-discipline.test.js` — covers MCP-04 race discipline + sw_evicted (D-05/D-06)
- [ ] `tests/run-task-heartbeat.test.js` — covers MCP-05 ticker lifecycle (start/fire/cancel/no-leak)
- [ ] `tests/mcp-task-store.test.js` — covers MCP-06 envelope + reconcile
- [ ] `tests/fixtures/run-task-harness.js` (likely needed) — shared harness for chrome API mocks (extends existing `tests/mcp-smoke-harness.js` pattern)
- [ ] No framework install needed — node:test harness is the established convention.

---

## Security Domain

> Security enforcement is enabled by default per `.planning/config.json` (no explicit `security_enforcement: false`). This is a low-security-surface phase but ASVS still applies.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Phase doesn't touch auth |
| V3 Session Management | yes | Run-task session ID is the existing `session_<timestamp>_<random>` shape; not security-sensitive on its own; `originating_mcp_call_id` is bridge-internal and not user-facing |
| V4 Access Control | no | Phase 240 owns access control; this phase predates the dispatch gate |
| V5 Input Validation | yes | task-store `writeSnapshot(taskId, snapshot)` MUST validate `taskId` shape (matches existing session_id regex) before writing; reject malformed values silently (return) to avoid unbounded storage growth from malicious inputs (theoretical — taskId is FSB-minted, not caller-supplied) |
| V6 Cryptography | no | No new crypto introduced |
| V7 Error Handling and Logging | yes | All persisted snapshots may contain `current_url` — ensure URLs go through existing `redactForLog` helper before logging (background.js exposes `redactForLog`); the snapshot itself is in chrome.storage.session (in-memory, browser-lifetime) so no persistent disk leak |

### Known Threat Patterns for {Chrome MV3 + MCP server}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Storage quota exhaustion via crafted long-running tasks | DoS | Single-task-only registry shape (one record max in v0.9.60); per-snapshot size hard ceiling (e.g., 4 KB max) before write |
| Stale snapshot leak across MCP host sessions | Information Disclosure | chrome.storage.session is browser-lifetime (cleared on browser quit); same boundary as existing `fsbAgentRegistry`. Acceptable. |
| Heartbeat payload exposes internal session state to MCP host | Information Disclosure | `current_url`, `last_action` are already exposed via existing `_sendProgress` calls. D-01's additional fields are derivative — no new exposure. |
| Race condition on settle (lifecycle event + 600s + sw_wake all racing) | Tampering (logically) | `settled` boolean guard at `mcp-bridge-client.js:660-664` plus mandatory routing of every new resolve through `settle(value, source)` |

---

## Sources

### Primary (HIGH confidence)
- Codebase grep + read: `extension/ws/mcp-bridge-client.js` (lines 250-799), `mcp/src/tools/autopilot.ts` (full), `mcp/src/bridge.ts` (lines 140-230, 510-720), `extension/background.js` (lines 1740-2065, 2240-2554, 6790-6848, 9070-9290, 10080-10930, 12715-12775), `extension/ai/agent-loop.js` (lines 1260-1545), `extension/utils/agent-registry.js` (full), `extension/utils/mcp-visual-session.js` (full)
- `.planning/phases/239-mcp-run-task-return-on-completion-phase-236-reborn/239-CONTEXT.md` (D-01 through D-08, all locked decisions)
- `.planning/REQUIREMENTS.md` (MCP-03 through MCP-06)
- `.planning/STATE.md` (milestone v0.9.60 decisions)
- `.planning/ROADMAP.md` (Phase 239 success criteria + parallel-shippable note)
- `.planning/phases/238-*/238-03-SUMMARY.md` (Phase 238 sendAndWait threading map)
- `tests/mcp-bridge-client-lifecycle.test.js` (lines 380-446 — Phase 225-01 lifecycle bus contract)
- `tests/mcp-tool-smoke.test.js` (lines 180-235 — current run_task deepEqual assertions)

### Secondary (MEDIUM confidence)
- [Chrome storage API docs](https://developer.chrome.com/docs/extensions/reference/api/storage) — chrome.storage.session 10 MB quota, Chrome 112+
- [MCP 2025-03-26 progress spec](https://modelcontextprotocol.io/specification/2025-03-26/basic/utilities/progress) — `_meta` vendor-extension slot under `notifications/progress.params`

### Tertiary (LOW confidence — flagged in Open Questions)
- Whether bridge.ts `pendingRequests` survive disconnect (Open Question 1; A1 in Assumptions Log) — **planner must verify before locking design**
- Per-host MCP `_meta` pass-through behavior (Open Question 2; A3 in Assumptions Log) — UAT-dependent

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — Phase introduces zero new dependencies; all surfaces are existing FSB code
- Architecture: HIGH — patterns are established (lifecycle bus, paired-cleanup, versioned envelope) and verified by codebase grep
- Pitfalls: HIGH — Pitfall 1 (agent-loop bypass) is a code-confirmed bug, not speculation; the other pitfalls are standard MV3 / setInterval / race discipline
- Cleanup-path audit: HIGH — all 5 named paths plus 3 additional paths read in full; lifecycle event status confirmed at each. Two bugs surfaced (agent-loop notifySidepanel and handleStopAutomation missing dispatch). Open Question 1 (server-vs-extension SW-wake settle) is the single MEDIUM-confidence item

**Research date:** 2026-05-06
**Valid until:** 2026-06-06 (30 days — patterns are stable; chrome.storage.session quota and MCP spec rarely change)

---

## RESEARCH COMPLETE

**Phase:** 239 - MCP run_task Return-on-Completion (Phase 236 reborn)
**Confidence:** HIGH

### Key Findings

- **Two 300s ceilings exist, not one.** Server-side at `autopilot.ts:61` (timeout option to sendAndWait) and extension-side at `mcp-bridge-client.js:684-686` (independent setTimeout). The extension fires first today; the server's ceiling is dead code in practice. Both must be raised to 600s for SC#1.

- **CRITICAL BUG DISCOVERED.** `extension/ai/agent-loop.js`'s `notifySidepanel` (called from 13 terminal-exit sites via `finalizeSession`) uses raw `chrome.runtime.sendMessage` instead of `fsbBroadcastAutomationLifecycle`. The lifecycle bus is NEVER fed from modern AI loop completions today. This is the actual root cause of "300s ceiling always fires" — the test gate at `mcp-bridge-client-lifecycle.test.js:443-445` only scans `extension/background.js` and missed agent-loop.js. **One-line fix in `notifySidepanel` covers all 13 sites.**

- **Second bug: handleStopAutomation does NOT emit a lifecycle event.** Path 5 of the cleanup audit. User-stop on a running run_task currently makes the MCP call hit the 600s ceiling. Must add `fsbBroadcastAutomationLifecycle({action: 'automationComplete', outcome: 'stopped', reason: 'user_stopped'})` BEFORE the existing `sendResponse(...)`.

- **`automationProgress` listener is dead code.** No emitter exists. Phase 239's heartbeat is the de facto introduction of progress events. The 30s ticker must be NEW (not piggybacking on existing emissions).

- **chrome.storage.session pattern is well-established.** New `extension/utils/mcp-task-store.js` mirrors `agent-registry.js` and `mcp-visual-session.js` shape with versioned envelope `{v: 1, records: {[task_id]: snapshot}}`.

- **Open Question 1 is the single highest-risk unknown.** Whether `bridge.ts:pendingRequests` survives a bridge disconnect determines whether SW-wake settle logic lives extension-side (synthesizes `mcp:result` post-reconnect) or server-side (catches disconnect, settles outstanding sendAndWait calls). Planner must verify in bridge.ts before locking the design.

### File Created

`/Users/lakshmanturlapati/Desktop/FSB/.planning/phases/239-mcp-run-task-return-on-completion-phase-236-reborn/239-RESEARCH.md`

### Confidence Assessment

| Area | Level | Reason |
|------|-------|--------|
| Standard Stack | HIGH | Zero new deps; all surfaces verified |
| Architecture | HIGH | Patterns are established and grep-confirmed |
| Pitfalls | HIGH | Pitfall 1 is a code-confirmed bug |
| Cleanup-path audit | HIGH | All 5 paths + 3 bonus paths read in full |
| SW-wake settle path | MEDIUM | Open Question 1 — bridge.ts pendingRequests behavior on disconnect needs verification |

### Open Questions

1. **bridge.ts pendingRequests on disconnect** — extension-synthesizes-result vs server-catches-disconnect. First task of Plan 01.
2. **MCP host strict-shape validation** — D-07 "additive only" is breaking for strict validators; verify in SC#5 UAT.
3. **First heartbeat tick timing** — immediate or after 30s? Recommended: immediate.
4. **Stop-task / run-task ordering** — handleStopAutomation must emit bus dispatch BEFORE sendResponse.

### Ready for Planning

Research complete. Planner has:
- 5+3 cleanup paths catalogued with exact line numbers and current bus-dispatch status
- Two bugs surfaced (agent-loop notifySidepanel; handleStopAutomation missing dispatch)
- Module placement recommendation (`extension/utils/mcp-task-store.js`)
- Heartbeat ticker pattern (setInterval, paired with `settle`'s `clearInterval`)
- Validation Architecture covering all 4 phase requirements + D-07 regression
- One MEDIUM-confidence Open Question (server-vs-extension SW-wake settle) flagged as first task of Plan 01
