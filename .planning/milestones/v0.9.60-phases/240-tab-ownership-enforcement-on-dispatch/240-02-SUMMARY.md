---
phase: 240-tab-ownership-enforcement-on-dispatch
plan: 02
subsystem: api
tags: [mcp, dispatcher, agent-registry, ownership-token, multi-agent, tab-isolation]

# Dependency graph
requires:
  - phase: 237-agent-registry
    provides: registerAgent, releaseAgent, withRegistryLock, agentId minting
  - phase: 238-agentscope-bridge-wiring
    provides: AgentScope.ensure, agentId destructure on the 15 dispatcher handlers, agent:register/release/status routes
  - phase: 240-01
    provides: bindTab returns {agentId, tabId, ownershipToken}, isOwnedBy 3-arg, getTabMetadata, getOrRegisterLegacyAgent, getAgentWindowId, hasAgent, _tabMetadata Map, storage envelope round-trip with tabMetadata block
provides:
  - "Inline checkOwnershipGate at dispatchMcpToolRoute (sync; same-microtask discipline; D-06, D-07)"
  - "Three typed reject codes: TAB_NOT_OWNED, TAB_INCOGNITO_NOT_SUPPORTED, TAB_OUT_OF_SCOPE { reason: 'cross_window' }"
  - "AGENT_NOT_REGISTERED reject for unknown agentIds (defense-in-depth)"
  - "bindTab calls in handleNavigateRoute, handleNavigationHistoryRoute, handleOpenTabRoute (3 of 4 D-08 sites)"
  - "agent:register response now carries ownershipTokens: {} (Open Q1 resolution)"
  - "AgentScope captures and exposes ownershipToken via currentOwnershipToken / captureOwnershipToken / ownershipTokenFor"
  - "6 D-06 sendAndWait sites (manual.ts x1, visual-session.ts x2, autopilot.ts run_task + stop_task) thread ownershipToken alongside agentId"
affects: [240-03, 241, 244]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Inline-gate pattern: 5-8 line plain-object-error check at the dispatch chokepoint; sync only; no async keyword on the gate function"
    - "Defensive AgentScope method calls: typeof agentScope.method === 'function' before invoking, so legacy stubs that only implement ensure() continue to pass"
    - "Single-slot ownership token model on AgentScope: lastOwnershipToken slot is sufficient for v0.9.60 single-task agents; Plan 03 will switch to per-tabId routing for concurrent tasks"

key-files:
  created:
    - tests/ownership-error-codes.test.js
  modified:
    - extension/ws/mcp-tool-dispatcher.js
    - mcp/src/agent-scope.ts
    - mcp/src/tools/manual.ts
    - mcp/src/tools/visual-session.ts
    - mcp/src/tools/autopilot.ts
    - tests/mcp-smoke-harness.js
    - tests/mcp-tool-smoke.test.js
    - tests/ownership-gate.test.js

key-decisions:
  - "Open Q1: agent:register response carries ownershipTokens: {} (empty at register time); per-handler bindTab responses include ownershipToken: <new>; AgentScope captures via captureOwnershipToken() into a single-slot lastOwnershipToken field for Plan 02"
  - "Open Q2: per-agent windowId pin (set-once on first bindTab); cross-window dispatch returns TAB_OUT_OF_SCOPE { reason: 'cross_window' }; non_current_window NOT enforced at dispatch in v0.9.60 (UX nuance, not enforcement boundary)"
  - "Open Q3: handleStartAutomation bindTab in non-MCP source paths is Plan 03 scope (background.js:6489)"
  - "Open Q4: dual-layer rejection (dispatcher gate + visual-session-level reject in mcp-visual-session.js startSession) is correct per D-09 defense-in-depth; Plan 02 owns the dispatcher gate; Plan 03 owns the visual-session-level reject"
  - "Defensive AgentScope method calls (typeof === 'function') instead of forcing all test stubs to implement currentOwnershipToken/captureOwnershipToken; preserves run-task-resolve-discipline.test.js stubs that only implement ensure()"

patterns-established:
  - "Pattern 1 -- chokepoint inline gate: function checkOwnershipGate({tool, params, payload}) returns null on pass or {success:false, code, ...} on reject; called synchronously between handler-type check and route.handler invocation"
  - "Pattern 2 -- bindTab on success path: each D-08 handler awaits globalThis.fsbAgentRegistryInstance.bindTab(agentId, targetTabId) BEFORE the success return; the freshly minted ownershipToken threads back to the MCP server via the response"
  - "Pattern 3 -- defensive AgentScope expansion: new methods (currentOwnershipToken, captureOwnershipToken, ownershipTokenFor) are optional from the consumer's perspective; tools probe via typeof === 'function' so stubs continue to work"

requirements-completed: [OWN-01, OWN-02, OWN-03, OWN-05]

# Metrics
duration: ~75min
completed: 2026-05-05
---

# Phase 240 Plan 02: Dispatch Ownership Gate + 3 D-08 bindTab Sites + Smoke Strengthening Summary

**Inline checkOwnershipGate at dispatchMcpToolRoute (sync, same microtask) with three typed reject codes; bindTab in 3 of 4 D-08 handlers; AgentScope ownershipToken capture; 6 mcp-tool-smoke deepEqual sites strengthened with token_test_smoke.**

## Performance

- **Duration:** ~75 min
- **Started:** 2026-05-05 (early session)
- **Completed:** 2026-05-05
- **Tasks:** 2
- **Files modified:** 7 (1 created, 6 modified) + tests/mcp-tool-smoke.test.js + tests/ownership-gate.test.js extended

## Accomplishments

- **Chokepoint gate landed.** dispatchMcpToolRoute now invokes checkOwnershipGate inline between handler-type check and route.handler invocation. Sync; no `await` between gate and dispatch. Same-microtask invariant verified by tests/ownership-gate.test.js (Test C2 schedules a microtask BEFORE the dispatch, asserts the gate ran sync first).
- **Three typed reject codes enforced.** TAB_NOT_OWNED carries the FULL ownerAgentId per D-01; TAB_INCOGNITO_NOT_SUPPORTED rejects on cached `meta.incognito === true`; TAB_OUT_OF_SCOPE { reason: 'cross_window' } fires when the agent's pinned windowId differs from the tab's cached windowId.
- **Three D-08 bindTab sites wired.** handleNavigateRoute, handleNavigationHistoryRoute, handleOpenTabRoute each call `await globalThis.fsbAgentRegistryInstance.bindTab(agentId, targetTabId)` BEFORE the success return; the freshly minted ownershipToken threads back via the response. Plan 03 owns the 4th site (handleStartAutomation in background.js).
- **AgentScope ownershipToken capture.** Single-slot `lastOwnershipToken` field plus per-tabId Map (`ownershipTokens`) seeded from agent:register response and updated by bindTab-firing handler responses. Defensive method probes (`typeof === 'function'`) preserve test-stub compatibility.
- **6 smoke deepEqual sites strengthened.** navigate, click, start_visual_session, end_visual_session, run_task, stop_task all assert `ownershipToken: 'token_test_smoke'` alongside `agentId: 'agent_test_smoke'` on the bridge payload.
- **Wave 0 tests delivered.** tests/ownership-error-codes.test.js (5 typed-code assertions including AGENT_NOT_REGISTERED and tabId-less skip) + tests/ownership-gate.test.js extended with 4 chokepoint assertions (gate skip, microtask invariant, bindTab side-effect, error path no-side-effect).

## Task Commits

1. **Task 1: Wave 0 RED scaffolds for typed error codes + chokepoint coverage** -- `d40d1cf` (test)
2. **Task 2: Inline gate + 3 D-08 bindTab sites + AgentScope ownershipToken plumbing + smoke strengthening** -- `a366632` (feat)

## Files Created/Modified

### Created

- `tests/ownership-error-codes.test.js` -- 5 dispatcher-end-to-end assertions for TAB_NOT_OWNED, TAB_INCOGNITO_NOT_SUPPORTED, TAB_OUT_OF_SCOPE cross_window, AGENT_NOT_REGISTERED, and the no-tabId-tool skip arm.

### Modified

- `extension/ws/mcp-tool-dispatcher.js` -- Added `_resolveTabIdForGate` helper, `checkOwnershipGate` (sync) function, gate-call site at line 191 between handler-type check and `route.handler(...)` return. bindTab calls at line 388 (handleNavigateRoute), line 434 (handleNavigationHistoryRoute), line 472 (handleOpenTabRoute). agent:register response now carries `ownershipTokens: {}`.
- `mcp/src/agent-scope.ts` -- Added private `ownershipTokens: Map<number, string>`, `lastOwnershipToken: string | null`, public `currentOwnershipToken()`, `captureOwnershipToken(tabId, token)`, `ownershipTokenFor(tabId)`. Seeds from agent:register response (both `ownershipTokens` map and single `ownershipToken` slot for harness convenience). `reset()` clears tokens too.
- `mcp/src/tools/manual.ts` -- execAction threads ownershipToken in payload (defensive); captures any returned ownershipToken from handler response.
- `mcp/src/tools/visual-session.ts` -- start_visual_session and end_visual_session thread ownershipToken in payload (defensive). start_visual_session captures returned ownershipToken.
- `mcp/src/tools/autopilot.ts` -- run_task (mcp:start-automation) and stop_task (mcp:stop-automation) thread ownershipToken in payload (defensive).
- `tests/mcp-smoke-harness.js` -- agent:register mock response now includes `ownershipTokens: {}` and `ownershipToken: 'token_test_smoke'`.
- `tests/mcp-tool-smoke.test.js` -- 6 deepEqual sites strengthened with `ownershipToken: 'token_test_smoke'`.
- `tests/ownership-gate.test.js` -- Extended with chokepoint block (Tests C1-C4) covering gate skip for tabId-less tools, same-microtask invariant, bindTab side-effect on handleNavigate happy path, bindTab no-side-effect on error path.

## checkOwnershipGate (final shape)

```javascript
function checkOwnershipGate({ tool, params, payload }) {
  const reg = (typeof globalThis !== 'undefined') ? globalThis.fsbAgentRegistryInstance : null;
  if (!reg) return null; // pre-Phase-237 boot or test harness without registry; graceful pass

  const src = (payload && Object.keys(payload).length) ? payload : (params || {});
  const agentId = src.agentId || null;
  const ownershipToken = src.ownershipToken || null;

  if (!agentId || (typeof reg.hasAgent === 'function' && !reg.hasAgent(agentId))) {
    return { success: false, code: 'AGENT_NOT_REGISTERED', requestingAgentId: agentId };
  }

  const tabId = _resolveTabIdForGate(tool, params, payload);
  if (tabId === null) return null; // tab-creating tool or active-tab-resolved-later; agent-only check passed

  // 1. Token-aware ownership (D-04).
  if (typeof reg.isOwnedBy === 'function' && !reg.isOwnedBy(tabId, agentId, ownershipToken)) {
    const ownerAgentId = (typeof reg.getOwner === 'function') ? (reg.getOwner(tabId) || null) : null;
    return { success: false, code: 'TAB_NOT_OWNED', ownerAgentId, requestedTabId: tabId, requestingAgentId: agentId };
  }

  // 2. Incognito reject (D-10 / OWN-05).
  const meta = (typeof reg.getTabMetadata === 'function') ? reg.getTabMetadata(tabId) : null;
  if (meta && meta.incognito === true) {
    return { success: false, code: 'TAB_INCOGNITO_NOT_SUPPORTED', tabId };
  }

  // 3. Cross-window reject (Open Q2: per-agent windowId pinning).
  if (meta && Number.isFinite(meta.windowId) && typeof reg.getAgentWindowId === 'function') {
    const pinnedWindowId = reg.getAgentWindowId(agentId);
    if (Number.isFinite(pinnedWindowId) && pinnedWindowId !== meta.windowId) {
      return { success: false, code: 'TAB_OUT_OF_SCOPE', tabId, reason: 'cross_window' };
    }
  }

  return null; // pass
}
```

## Dispatcher modification line ranges

- **Gate insert:** `extension/ws/mcp-tool-dispatcher.js:177-198` -- `dispatchMcpToolRoute` now contains `const gateResult = checkOwnershipGate({ tool, params, payload }); if (gateResult) return gateResult;` between the handler-type check and `return route.handler(...)`. Lines 119-175 host `_resolveTabIdForGate` and `checkOwnershipGate`.
- **handleNavigateRoute bindTab:** lines 380-396 (between `chrome.tabs.update` and the `return sanitizeSingleTab(...)` -- 3rd-arg `extra` carries ownershipToken).
- **handleNavigationHistoryRoute bindTab:** lines 425-447 (between the `chrome.tabs.{goBack|goForward|reload}` and the success-return object construction; ownershipToken merged onto the returned `{ success: true, tool, tabId }` shape if present).
- **handleOpenTabRoute bindTab:** lines 463-478 (between `chrome.tabs.create` and the `return sanitizeSingleTab('open_tab', tab, extra)` call).

## agent:register response shape (final)

```javascript
return { success: true, agentId, agentIdShort, ownershipTokens: {} };
```

`ownershipTokens` is empty at register time. Each subsequent bindTab-firing handler returns `ownershipToken: <new>` in its response; the MCP server's AgentScope captures it via `captureOwnershipToken(tabId, token)`. The smoke harness additionally seeds `ownershipToken: 'token_test_smoke'` on the agent:register response so AgentScope's `lastOwnershipToken` is non-null on the very first tool call (no chicken-and-egg).

## Diff of the 6 mcp-tool-smoke.test.js deepEqual sites

| Site | Tool                    | Before                                                                                                              | After                                                                                                                                              |
| ---- | ----------------------- | ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | navigate                | `payload: { tool, params, agentId: 'agent_test_smoke' }`                                                            | `payload: { tool, params, agentId: 'agent_test_smoke', ownershipToken: 'token_test_smoke' }`                                                       |
| 2    | click                   | `payload: { tool: 'click', params: { selector: 'e5' }, agentId: 'agent_test_smoke' }`                               | `payload: { tool: 'click', params: { selector: 'e5' }, agentId: 'agent_test_smoke', ownershipToken: 'token_test_smoke' }`                          |
| 3    | start_visual_session    | `payload: { clientLabel: 'Codex', task, detail, agentId: 'agent_test_smoke' }`                                      | `payload: { clientLabel: 'Codex', task, detail, agentId: 'agent_test_smoke', ownershipToken: 'token_test_smoke' }`                                 |
| 4    | end_visual_session      | `payload: { sessionToken: 'visual_token_123', reason: 'ended', agentId: 'agent_test_smoke' }`                       | `payload: { sessionToken: 'visual_token_123', reason: 'ended', agentId: 'agent_test_smoke', ownershipToken: 'token_test_smoke' }`                  |
| 5    | run_task                | `payload: { task: 'Smoke test the browser bridge', agentId: 'agent_test_smoke' }`                                   | `payload: { task: 'Smoke test the browser bridge', agentId: 'agent_test_smoke', ownershipToken: 'token_test_smoke' }`                              |
| 6    | stop_task               | `payload: { agentId: 'agent_test_smoke' }`                                                                           | `payload: { agentId: 'agent_test_smoke', ownershipToken: 'token_test_smoke' }`                                                                     |

## Resolution of the 4 Open Questions (verbatim)

1. **Q1 (where ownershipToken first reaches MCP server)**: Extension-side `agent:register` response now carries `ownershipTokens: {}` (empty at register time, shape preserved for forward compatibility). AgentScope.ensure() additionally captures a single-slot `ownershipToken` field if present on the response (smoke harness convention -- the deterministic `token_test_smoke`). Each bindTab-firing handler (handleNavigateRoute, handleNavigationHistoryRoute, handleOpenTabRoute) returns `ownershipToken: <new>` in its response, which AgentScope's `captureOwnershipToken(tabId, token)` accumulates. **Plan 02 owns the response-shape extension on the extension side and the single-slot capture on the MCP-server-side AgentScope. Plan 03 will replace the single-slot model with full per-tabId routing.**

2. **Q2 (cross-window semantics)**: Per-agent windowId pinning. Plan 01 already added `record.windowId` set-once on first bindTab and the `getAgentWindowId(agentId)` accessor. Plan 02's gate reads `getTabMetadata(tabId).windowId` and compares against `getAgentWindowId(agentId)`; mismatch returns `TAB_OUT_OF_SCOPE { reason: 'cross_window' }`. The `non_current_window` reason is NOT checked at dispatch in v0.9.60 (UX nuance, not enforcement boundary).

3. **Q3 (handleStartAutomation bindTab even for non-MCP source)**: YES. Plan 03 owns this site (background.js:6489). Plan 02 covers the 3 sites in dispatcher.js.

4. **Q4 (dual-layer rejection -- dispatcher gate AND visual-session-level reject)**: YES, both fire (defense in depth per D-09). Plan 02 owns the dispatcher gate; Plan 03 owns the visual-session-level reject in mcp-visual-session.js startSession.

## Test counts and grep gate values

| Gate                                                                            | Required | Actual                          |
| ------------------------------------------------------------------------------- | -------- | ------------------------------- |
| `grep -c "TAB_NOT_OWNED" extension/ws/mcp-tool-dispatcher.js`                   | >= 1     | 1                               |
| `grep -c "TAB_INCOGNITO_NOT_SUPPORTED" extension/ws/mcp-tool-dispatcher.js`     | >= 1     | 1                               |
| `grep -c "TAB_OUT_OF_SCOPE" extension/ws/mcp-tool-dispatcher.js`                | >= 1     | 1                               |
| 3-typed-codes combined                                                          | >= 3     | 3                               |
| `grep -c "isOwnedBy" extension/ws/mcp-tool-dispatcher.js`                       | >= 1     | 2                               |
| `grep -c "fsbAgentRegistryInstance.getTabMetadata" extension/ws/mcp-tool-dispatcher.js` | >= 1     | 1                               |
| `grep -c "fsbAgentRegistryInstance.bindTab" extension/ws/mcp-tool-dispatcher.js`        | >= 3     | 6 (each handler probes + calls) |
| `grep -c "checkOwnershipGate" extension/ws/mcp-tool-dispatcher.js`              | >= 2     | 2 (definition + invocation)     |
| `grep -c "ownershipTokens" extension/ws/mcp-tool-dispatcher.js`                 | >= 1     | 2                               |
| `grep -F "ownershipToken: 'token_test_smoke'" tests/mcp-tool-smoke.test.js \| wc -l` | >= 6     | 6                               |
| `grep -E "async\\s+function\\s+checkOwnershipGate"`                              | == 0     | 0 (sync only)                   |
| Emoji audit on dispatcher.js + new test files                                   | == 0     | 0                               |

### Test runs (all green)

| Test File                                  | Result | Count        |
| ------------------------------------------ | ------ | ------------ |
| tests/ownership-error-codes.test.js (NEW)  | PASS   | 17/17        |
| tests/ownership-gate.test.js (EXTEND)      | PASS   | 13 + 4 chokepoint |
| tests/mcp-tool-smoke.test.js (regression)  | PASS   | 67/67        |
| tests/agent-bridge-routes.test.js (regression) | PASS | 27/27        |
| tests/agent-id-threading.test.js (regression) | PASS | 6/6          |
| tests/agent-registry.test.js (regression)  | PASS   | All          |
| tests/agent-scope.test.js (regression)     | PASS   | 5/5          |
| tests/run-task-cleanup-paths.test.js (regression) | PASS | 6/6   |
| tests/run-task-heartbeat.test.js (regression) | PASS | 17/17       |
| tests/run-task-resolve-discipline.test.js (regression) | PASS | 22/22 |
| tests/mcp-task-store.test.js (regression)  | PASS   | 10/10        |
| tests/mcp-tool-routing-contract.test.js    | PASS   | 144/144      |
| tests/mcp-visual-session-contract.test.js  | PASS   | 93/93        |
| tests/mcp-restricted-tab.test.js           | PASS   | 74/74        |
| tests/mcp-recovery-messaging.test.js       | PASS   | 38/38        |
| tests/mcp-lifecycle-smoke.test.js          | PASS   | 13/13        |

## Decisions Made

- **Defensive AgentScope method probing (typeof === 'function') in tools.** Adding new methods (currentOwnershipToken, captureOwnershipToken, ownershipTokenFor) to AgentScope risks breaking test stubs that only implement `ensure()`. Probing each call site preserves the Phase 239 stub contract (run-task-resolve-discipline.test.js's `agentScopeStub = { ensure }`). Auto-fixed under Rule 3 (blocking issue) when run-task-resolve-discipline initially failed with `currentOwnershipToken is not a function`.
- **Smoke harness convention: ownershipToken on agent:register response (single-slot).** Plan 02 keeps the MCP-server-side AgentScope on a single-slot `lastOwnershipToken`. The harness response shape (`ownershipToken: 'token_test_smoke'` alongside `ownershipTokens: {}`) lets AgentScope seed the slot deterministically without a real bindTab round-trip in the smoke. Plan 03 owns the per-tabId routing rewrite.
- **6 D-06 sendAndWait sites updated for backward-compat.** Although Plan 03 owns "server-side AgentScope wiring", the smoke regression's deepEqual assertions force the server-side payloads to actually carry `ownershipToken`. Plan 02 makes the minimal additive change needed to keep smoke green, marking the boundary that Plan 03 will expand into per-tab routing.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] AgentScope method probing in tool sites**
- **Found during:** Task 2 (during regression run of tests/run-task-resolve-discipline.test.js after the initial AgentScope expansion)
- **Issue:** The new ownership-token plumbing in autopilot.ts called `agentScope.currentOwnershipToken()` and `agentScope.captureOwnershipToken(...)` directly. tests/run-task-resolve-discipline.test.js's `agentScopeStub = { ensure }` does not implement those methods, so the run_task body threw `TypeError: agentScope.currentOwnershipToken is not a function` and the test failed.
- **Fix:** Wrapped each new AgentScope method call in `typeof agentScope.X === 'function' ? agentScope.X(...) : null` so legacy stubs continue to pass. Applied identically across manual.ts, visual-session.ts, autopilot.ts.
- **Files modified:** mcp/src/tools/{manual,visual-session,autopilot}.ts
- **Verification:** tests/run-task-resolve-discipline.test.js now PASSes 22/22; smoke and other regressions unchanged.
- **Committed in:** `a366632` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary for regression compatibility; no scope creep. The defensive probe pattern is documented as Pattern 3 in this summary.

## Issues Encountered

- **Pre-build of mcp/build was missing.** The smoke and AgentScope contract tests load from `mcp/build/runtime.js` etc. The freshly-checked-out worktree lacked these artifacts. Resolved by running `npm install && npm run build` once in `mcp/`. Subsequent edits to `mcp/src/*.ts` required `npm run build` again before running smoke. Build artifacts are gitignored so they do not pollute commits.
- **Worktree merge-base mismatch.** The worktree was created at `c60c186` (main HEAD) but the expected base per the executor flag was `a7c7b8c` (Plan 01's tip). Resolved with `git reset --hard a7c7b8c83c3bc09fdc14e6c926d40d07616d81f4` per the worktree_branch_check protocol; this brought the registry surface (Plan 01 module) into the working tree.

## Next Phase Readiness

- **Plan 03 unblocked.** The dispatcher gate is in place; Plan 03 wires the 4th D-08 bindTab site in background.js:handleStartAutomation, the visual-session-level reject in mcp-visual-session.js, the legacy:popup / legacy:sidepanel / legacy:autopilot synthesis at popup.js / sidepanel.js / background.js, and per-tabId AgentScope routing.
- **Backward-compat held.** Every Phase 238 / Phase 239 regression test passes unchanged. The smoke harness's strengthened deepEqual sites are the load-bearing check on the (agentId, ownershipToken) wire shape; both fields now present in 6 of the 7 tool families that thread agent identity (read_page, get_dom_snapshot, get_page_snapshot, get_site_guide, list_tabs, get_logs do NOT thread agent identity since they are read-only / observability flows).

## Self-Check: PASSED

- Files exist:
  - `extension/ws/mcp-tool-dispatcher.js` -- FOUND, contains `checkOwnershipGate`, `TAB_NOT_OWNED`, `TAB_INCOGNITO_NOT_SUPPORTED`, `TAB_OUT_OF_SCOPE`, `ownershipTokens`
  - `mcp/src/agent-scope.ts` -- FOUND, contains `currentOwnershipToken`, `captureOwnershipToken`
  - `mcp/src/tools/manual.ts`, `mcp/src/tools/visual-session.ts`, `mcp/src/tools/autopilot.ts` -- FOUND, each contains `ownershipToken` in payload
  - `tests/mcp-smoke-harness.js` -- FOUND, agent:register mock seeds `token_test_smoke`
  - `tests/mcp-tool-smoke.test.js` -- FOUND, 6 deepEqual sites contain `ownershipToken: 'token_test_smoke'`
  - `tests/ownership-error-codes.test.js` -- FOUND (newly created)
  - `tests/ownership-gate.test.js` -- FOUND, extended with chokepoint block
- Commits exist:
  - `d40d1cf` -- FOUND on branch
  - `a366632` -- FOUND on branch (HEAD)
- All success criteria from the prompt PASS:
  - dispatchMcpToolRoute has the inline gate (line 191): YES
  - 3-typed-codes combined grep >= 3: YES (3)
  - isOwnedBy grep >= 1: YES (2)
  - fsbAgentRegistryInstance.getTabMetadata grep >= 1: YES (1)
  - 3 D-08 handlers each call bindTab before success return: YES (handleNavigate, handleNavigationHistory, handleOpenTab)
  - agent:register response includes `ownershipTokens` field: YES
  - 6 smoke sites strengthened with `ownershipToken: 'token_test_smoke'`: YES
  - tests/ownership-error-codes.test.js exists: YES
  - tests/ownership-error-codes.test.js + tests/mcp-tool-smoke.test.js pass: YES
  - tests/agent-bridge-routes.test.js, tests/agent-id-threading.test.js, tests/run-task-cleanup-paths.test.js, tests/mcp-task-store.test.js still pass UNCHANGED: YES
  - SUMMARY.md created at `.planning/phases/240-tab-ownership-enforcement-on-dispatch/240-02-SUMMARY.md`: YES (this file)

---
*Phase: 240-tab-ownership-enforcement-on-dispatch*
*Completed: 2026-05-05*
