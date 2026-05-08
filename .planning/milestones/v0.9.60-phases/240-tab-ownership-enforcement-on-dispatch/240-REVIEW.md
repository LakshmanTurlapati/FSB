---
phase: 240-tab-ownership-enforcement-on-dispatch
reviewed: 2026-05-05T00:00:00Z
depth: standard
files_reviewed: 19
files_reviewed_list:
  - extension/ai/agent-loop.js
  - extension/background.js
  - extension/ui/popup.js
  - extension/ui/sidepanel.js
  - extension/utils/agent-registry.js
  - extension/utils/mcp-visual-session.js
  - extension/ws/mcp-tool-dispatcher.js
  - mcp/src/agent-scope.ts
  - mcp/src/tools/autopilot.ts
  - mcp/src/tools/manual.ts
  - mcp/src/tools/visual-session.ts
  - tests/agent-registry.test.js
  - tests/legacy-agent-synthesis.test.js
  - tests/mcp-smoke-harness.js
  - tests/mcp-tool-smoke.test.js
  - tests/mcp-visual-session-contract.test.js
  - tests/ownership-error-codes.test.js
  - tests/ownership-gate.test.js
  - tests/visual-session-reentry.test.js
findings:
  critical: 0
  warning: 3
  info: 4
  total: 7
status: issues_found
---

# Phase 240: Code Review Report

**Reviewed:** 2026-05-05
**Depth:** standard
**Files Reviewed:** 19
**Status:** issues_found

## Summary

Phase 240 lands a synchronous ownership gate at `dispatchMcpToolRoute`, per-bindTab `ownershipToken` minting, three typed error codes, and a same-agent visual-session resume branch. Core invariants hold:

- Same-microtask discipline is preserved. `checkOwnershipGate` is fully synchronous (Map.get reads against cached `_tabMetadata`); the chokepoint at `dispatchMcpToolRoute` calls the gate then `route.handler(...)` with NO `await` in between (`extension/ws/mcp-tool-dispatcher.js:194-197`). Test C2 in `ownership-gate.test.js` verifies this through a microtask-ordering probe.
- `isOwnedBy(tabId, agentId, ownershipToken)` is sync and called from the gate via `reg.isOwnedBy(...)`. Backward-compat with `undefined` token is preserved.
- No `ownershipToken` leakage was found in error responses or bridge logs. `handleAgentRegisterRoute` and the gate's typed errors carry only `agentId` / `agentIdShort` / `tabId` / `reason` / `code`. Console logs from `agent-scope.ts` log `agentIdShort` only.
- The legacy carve-out (`getOrRegisterLegacyAgent`) is concurrency-safe because it executes inside `withRegistryLock`; the `_agents.has(agentId)` check sits inside the lock so back-to-back boots return the same record.
- The 6 mcp-tool-smoke `deepEqual` sites at `tests/mcp-tool-smoke.test.js:132,167,185,199,207,214` actually assert `ownershipToken: 'token_test_smoke'` inside the deep-equal payload (not just spread).

The findings below center on a real bypass in the visual-session start path, two subtler quality concerns, and a few documentation/info items.

## Warnings

### WR-01: `start_visual_session` cross-agent reject branch never fires in production dispatch

**File:** `extension/ws/mcp-tool-dispatcher.js:710-765` and `extension/background.js:1105-1181`
**Issue:** The same-agent resume / cross-agent reject logic added to `McpVisualSessionManager.startSession` (`extension/utils/mcp-visual-session.js:107-139`) checks `if (existingSession && input && typeof input.agentId === 'string' && registryOwner)`. In production, the call chain is:

1. `dispatchMcpToolRoute({tool: 'start_visual_session', payload: {...agentId, ownershipToken}})` enters the gate. `start_visual_session` has no `tabId` in params (active-tab is resolved later inside the handler), so `_resolveTabIdForGate` returns null and the gate skips the tab-arm check (`extension/ws/mcp-tool-dispatcher.js:155-156`). Only the agent-existence check runs.
2. `handleStartVisualSessionRoute` reads `agentId` then explicitly drops it: `void agentId;` (`extension/ws/mcp-tool-dispatcher.js:711-713`). The request constructed at line 757-764 contains `{action, tabId, clientLabel, task, detail}` -- no `agentId`.
3. `handleStartMcpVisualSession` (`extension/background.js:1176-1181`) calls `manager.startSession({clientLabel, tabId, task, detail})`. `input.agentId` is `undefined`.
4. The D-09 / D-03 branch at `mcp-visual-session.js:120` evaluates `typeof input.agentId === 'string'` -> false, so cross-agent re-entry falls through to the legacy displacement path (line 141), which silently replaces the existing session.

Result: Agent A holds tab T1 with an active visual session; Agent B (also registered) calls `start_visual_session`. The dispatcher gate passes (no tabId at gate time). `handleStartVisualSessionRoute` discards `agentId`. `manager.startSession` runs without `input.agentId`, hits the legacy displacement branch, and **wipes Agent A's visual session**. The `tests/visual-session-reentry.test.js` suite passes because it calls `manager.startSession({...agentId})` directly, threading the field that production drops.

**Fix:** Thread `agentId` through both layers:

```js
// extension/ws/mcp-tool-dispatcher.js handleStartVisualSessionRoute
async function handleStartVisualSessionRoute({ payload, client }) {
  const { agentId } = payload || {};
  // ... existing validation ...
  return callCallbackHandler(
    'handleStartMcpVisualSession',
    {
      action: 'startMcpVisualSession',
      tabId: tab.id,
      clientLabel,
      task,
      detail: boundedString(payload?.detail, 1000),
      agentId: agentId || null  // <-- add
    },
    { tab: { id: tab.id } }
  );
}
```

```js
// extension/background.js handleStartMcpVisualSession
const started = manager.startSession({
  clientLabel,
  tabId,
  task,
  detail: request?.detail,
  agentId: request?.agentId || null  // <-- add
});
```

Also consider hoisting the cross-agent check ahead of the legacy displacement branch even when `agentId` is null but the tab has a `registryOwner`, so a non-Phase-240 caller cannot wipe a Phase-240 owner's session. Today, an agent-less `startSession` call still reaches the displacement path even if `registryOwner !== null`.

### WR-02: Resume branch retains stale `lifecycle: 'final'` and `finalClearAt` from prior session

**File:** `extension/utils/mcp-visual-session.js:120-139`
**Issue:** When the same-agent resume branch fires, the code mutates `existingSession.task`, `detail`, `lastUpdateAt`, `version`, but does NOT reset terminal-state fields. If a session previously transitioned to `lifecycle: 'final'` with `finalClearAt` and `result: 'success'` (via `applyVisualSessionPatch` in a prior `updateSession`), and then the same agent calls `start_visual_session` again on the same tab, the resumed session keeps `lifecycle: 'final'`, `finalClearAt`, `result`, and `reason`. The overlay state machine (`overlayStateUtils.buildOverlayState`) will continue rendering the "completed" final state with a fresh task title -- a confusing UX where the tab shows "task completed" while a new task is starting.

The intended semantics for "start" is a fresh running session. The resume contract should reset terminal markers.

**Fix:** Reset terminal-state fields when resuming:

```js
existingSession.task = normalizeText(input && input.task, existingSession.task);
existingSession.detail = normalizeText(input && input.detail, existingSession.detail);
existingSession.lastUpdateAt = now;
existingSession.version = (existingSession.version || 1) + 1;
// Phase 240 D-03: resume returns the session to a running state.
existingSession.lifecycle = 'running';
existingSession.phase = 'planning';
delete existingSession.finalClearAt;
delete existingSession.finalClearReason;
delete existingSession.result;
delete existingSession.reason;
existingSession.statusText = existingSession.detail || 'Ready to begin';
```

Add a test asserting that calling `startSession` on a session whose prior state was `lifecycle: 'final'` returns `lifecycle: 'running'` after resume.

### WR-03: Autopilot inline tool calls bypass the ownership gate entirely

**File:** `extension/ai/agent-loop.js:1037-1046` (commented note)
**Issue:** The comment at agent-loop.js explicitly acknowledges: "agent-loop.js does NOT dispatch through extension/ws/mcp-tool-dispatcher.js." This means tool actions executed by the autopilot's own AI loop (click, type, navigate) never traverse `dispatchMcpToolRoute` and therefore never hit `checkOwnershipGate`. The single-chokepoint claim in CONTEXT.md D-06 only holds for MCP-bridge-originated tools.

In practice this is mitigated because `handleStartAutomation` binds the tab to `legacy:autopilot` (or the caller-supplied agentId) at session start, but the runtime invariant is weaker than advertised: a long-running autopilot session whose tab is later force-rebound to a different agent (e.g., via an MCP `open_tab` from another client) would continue acting on a tab it no longer owns. There is no enforcement point inside the autopilot loop.

**Fix:** Either (a) explicitly document the carve-out in the dispatcher and CONTEXT.md (autopilot is excluded by design because content-script execution doesn't traverse the bridge), or (b) add a sync `isOwnedBy` check inside the agent-loop's per-iteration setup using the session's stored `agentId` + `ownershipToken`, and abort the iteration with a typed error when the gate would have blocked. Option (a) is the lowest-risk path for v0.9.60; option (b) belongs to a future phase that wires per-tool gating into the agent loop.

## Info

### IN-01: TAB_NOT_OWNED leaks full owner agentId by design (D-01)

**File:** `extension/ws/mcp-tool-dispatcher.js:160-162`
**Issue:** `TAB_NOT_OWNED` errors include `ownerAgentId: <full-uuid>` rather than a hashed/short prefix. CONTEXT.md D-01 explicitly mandates this, so the behavior is intentional, but it does allow a probing client to enumerate registered agentIds across all tabs by attempting cross-agent dispatch. Since the MCP bridge already trusts the connecting client (no per-tool authn), this is acceptable in the current threat model.
**Fix:** No code change; consider adding a TODO note that the full-id leak is in-scope for Phase 244 (MCP tool descriptions) or later when per-client scoping is added.

### IN-02: `bindTab` swallows `chrome.tabs.get` failures with safe defaults

**File:** `extension/utils/agent-registry.js:375-390`
**Issue:** When `chrome.tabs.get(tabId)` throws inside `bindTab`, the catch silently defaults `incognitoFlag = false` and `winId = null`. This is documented as Pitfall 1 mitigation, but it means a tab whose true `incognito` flag is true could be bound with `incognito: false` cached metadata if the chrome API hiccups during bind. The dispatch gate would then NOT trip the `TAB_INCOGNITO_NOT_SUPPORTED` arm. Probability is low (chrome.tabs.get in the same microtask as the caller's intent rarely fails), but the failure mode silently weakens the incognito guarantee.
**Fix:** Consider returning `false` from `bindTab` when the metadata read fails for an extant tab, forcing the caller to retry. Alternatively, log a `rateLimitedWarn` event so the gap is observable. No production code change required.

### IN-03: AgentScope `lastOwnershipToken` single-slot model conflates tabs

**File:** `mcp/src/agent-scope.ts:33,112-114,121-127`
**Issue:** The single-slot `lastOwnershipToken` is shared across all tabs an agent owns. If an agent binds tab T1 (token A), then T2 (token B), `currentOwnershipToken()` returns B. A subsequent tool call targeting T1 will thread token B, and the gate's `isOwnedBy(T1, agent, B)` returns false -- a `TAB_NOT_OWNED` rejection on a tab the agent legitimately owns. The class doc comment acknowledges Plan 03 will replace this with per-tab routing; until then, multi-tab agents will see spurious gate failures whenever the most-recently-bound tab is not the targeted tab.
**Fix:** Already tracked. Plan 03 should consume `ownershipTokenFor(tabId)` (already implemented at line 134) wherever the calling tool knows its target tabId, and only fall back to `currentOwnershipToken()` when tabId is unknown.

### IN-04: Three independent `chrome.tabs.onRemoved` listeners now fire `releaseTab` (commit 7712509)

**File:** `extension/background.js:2542-2550` (and two additional sites per recent commits)
**Issue:** Recent commit `7712509` adds a third `chrome.tabs.onRemoved` listener to call `releaseTab`. `releaseTab` is documented as idempotent so triple-fire is safe, but each call re-acquires `withRegistryLock` and writes through to `chrome.storage.session` once on the first call (the no-op path at line 442-445 returns early without persisting). The behavior is correct, but the proliferation of listeners makes the lifecycle harder to reason about.
**Fix:** Consider centralizing tab-removal cleanup in a single named `releaseTabFromRegistry` helper invoked from one listener, or document why three listeners exist (e.g., different cleanup concerns).

---

_Reviewed: 2026-05-05_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
