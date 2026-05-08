---
phase: 242-back-mcp-tool
plan: 02
subsystem: extension
tags: [extension, dispatcher, back-navigation, bf-cache, ownership-gate]

# Dependency graph
requires:
  - phase: 240-tab-ownership-enforcement-on-dispatch
    provides: checkOwnershipGate (lines 143-180) + bindTab parity (D-08) at handleNavigationHistoryRoute lines 431-443
  - phase: 242-back-mcp-tool plan 01
    provides: server.tool('back', ...) MCP registration; 'mcp:go-back' bridge envelope payload { agentId, ownershipToken, connectionId?, tabId? }
provides:
  - MCP_PHASE199_MESSAGE_ROUTES['mcp:go-back'] entry routing to handleBackRoute (browser family)
  - handleBackRoute (extension/ws/mcp-tool-dispatcher.js lines 667-816)
  - waitForBackSettle helper (extension/ws/mcp-tool-dispatcher.js lines 493-601)
  - classifyBackOutcome helper (extension/ws/mcp-tool-dispatcher.js lines 603-665)
  - Cross-agent reject test surface for the new route (tests/back-tool-ownership.test.js)
affects: [243+ continued back-tool hardening, future Phase 244 MCP SDK bumps]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pattern 1: defensive ownership gate in message-route handler -- since dispatchMcpMessageRoute does NOT inline-gate today (only dispatchMcpToolRoute does at line 194), handleBackRoute calls checkOwnershipGate at the top with same-microtask discipline preserved."
    - "Pattern 2: history.length precheck via chrome.scripting.executeScript({func: () => window.history.length}) BEFORE chrome.tabs.goBack -- fail-closed on injection failure (chrome:// pages, restricted contexts) -> status 'no_history'."
    - "Pattern 3: 3-leg Promise.race settle (chrome.tabs.onUpdated 'complete' / pageshow via injected one-shot listener / 2s hard timeout) with self-cleaning listeners + cleared timeouts via single-finish guard."
    - "Pattern 4: deterministic 5-status classification with Pitfall-1 SPA carve-out (timeout + URL changed + same-origin parses -> 'ok' rather than 'bf_cache')."
    - "Pattern 5: D-08 background-tab posture -- ZERO chrome.tabs.update references inside the new handler body (verified by sed-extracted body grep)."

key-files:
  created:
    - tests/back-tool-ownership.test.js
  modified:
    - extension/ws/mcp-tool-dispatcher.js
    - tests/mcp-tool-routing-contract.test.js
    - tests/mcp-tool-smoke.test.js

key-decisions:
  - "Defensive ownership gate at the top of handleBackRoute. Verification at execute time confirmed dispatchMcpMessageRoute (lines 200-228) does NOT call checkOwnershipGate -- only dispatchMcpToolRoute (line 194) does. Adding the inline gate preserves D-07 same-microtask discipline without expanding Phase 240's scope."
  - "Strategy A for test loading: re-use the existing tail-of-file module.exports surface in extension/ws/mcp-tool-dispatcher.js (already exposes dispatchMcpMessageRoute, MCP_PHASE199_MESSAGE_ROUTES, etc.). No new exports added by this plan."
  - "Pitfall-1 SPA carve-out in classifyBackOutcome: settle.method === 'timeout' AND postUrl !== preUrl falls through to default 'ok' rather than 'bf_cache'. Only timeout + URL unchanged is bf_cache. Reason: SPA history.back() can mutate URL synchronously and never fire a pageshow / onUpdated 'complete'."
  - "history.length precheck collapses BOTH depth <= 1 AND injection failure to status 'no_history'. Reason: chrome:// / about:blank / devtools URLs reject chrome.scripting.executeScript; treating injection-failure as 'no_history' is fail-closed (never call goBack on an unverifiable history)."
  - "Smoke test extension (Rule 3 deviation): added agentsModule load + registerAgentTools call so harness.handlers.has('back') succeeds. Without this change, success criterion #8 (smoke 'back' green) cannot close. The change is minimal -- agents.ts already registers the back tool (Plan 01 D-01), the smoke test just needed to import it."
  - "Post-back bindTab parity site (D-08) mirrors handleNavigationHistoryRoute lines 431-443 EXACTLY (same try/catch shape, same Number.isFinite guard, same response-shape ownershipToken capture). This keeps the (agentId, tabId, ownershipToken) triple coherent across cross-origin back transitions."

patterns-established:
  - "Pattern: defensive checkOwnershipGate inside message-route handler when dispatchMcpMessageRoute lacks inline gating. Documented as a JSDoc note inside handleBackRoute -- future message routes can mirror this until Phase 240 expands the inline gate to message routes."
  - "Pattern: three-leg Promise.race settle for browser-history transitions, with one leg using chrome.scripting.executeScript to inject a one-shot pageshow listener that captures event.persisted. Reusable for forward / reload / SPA-back primitives in future phases."

requirements-completed: [BACK-02, BACK-03, BACK-04, BACK-05]

# Metrics
metrics:
  duration: ~30min
  tasks: 3
  files_created: 1
  files_modified: 3
  completed: 2026-05-06
---

# Phase 242 Plan 02: Extension Dispatcher mcp:go-back Route Summary

Single-line objective: Wired the extension dispatcher's mcp:go-back route + handleBackRoute / waitForBackSettle / classifyBackOutcome so the Plan 01 server-side back tool flows end-to-end (BACK-02..BACK-05) with Phase 240 cross-agent reject coverage and D-08 background-tab invariant preserved.

## Tasks Completed

### Task 1: Extend tests/mcp-tool-routing-contract.test.js with mcp:go-back (Wave-0 RED gate)

- Appended 'mcp:go-back' to `requiredMessageRoutes` (line 72).
- Appended 'mcp:go-back' to `groupDefinitions.browser.messages` (line 101) so the route is correctly classified as the 'browser' family.
- Goes RED until Task 2 lands the route in the dispatcher (intentional Wave-2 RED-GREEN entry).
- Commit: `208d0cf` test(242-02): add mcp:go-back to routing-contract requiredMessageRoutes (RED gate)

### Task 2: Add handleBackRoute + waitForBackSettle + classifyBackOutcome (BACK-02..BACK-05)

- New route entry inserted in `MCP_PHASE199_MESSAGE_ROUTES` at line 69, BEFORE the agent:* block so all mcp:* entries stay contiguous.
- `waitForBackSettle(tabId, timeoutMs)` at lines 493-601: 3-leg Promise.race (onUpdated complete / pageshow injected listener / 2s hard timeout) with self-cleaning listener removal and timeout clearance via the single `finished` guard.
- `classifyBackOutcome({preUrl, postUrl, preOrigin, postOrigin, settled})` at lines 603-665: deterministic 5-status mapping. Resolution order: preUrl===postUrl -> 'ok'; same-origin path-equal hash-different -> 'fragment_only'; cross-origin -> 'cross_origin'; pageshow + persisted -> 'bf_cache'; timeout + URL unchanged -> 'bf_cache'; default -> 'ok'.
- `handleBackRoute({payload, client})` at lines 667-816: defensive ownership gate (Phase 240 chokepoint mirror) -> tabId resolution -> chrome.tabs.get pre-back -> history.length precheck via chrome.scripting.executeScript -> chrome.tabs.goBack -> waitForBackSettle -> chrome.tabs.get post-back -> classifyBackOutcome -> bindTab parity (D-08).
- D-08 background-tab invariant verified: `sed -n '667,818p' extension/ws/mcp-tool-dispatcher.js | grep -c "chrome\\.tabs\\.update"` returns 0.
- Commit: `737cc3d` feat(242-02): add mcp:go-back route + handleBackRoute / waitForBackSettle / classifyBackOutcome (BACK-02..BACK-05)

### Task 3: tests/back-tool-ownership.test.js -- cross-agent reject + D-08 invariant

- New file at tests/back-tool-ownership.test.js (249 lines).
- Test 1 (BACK-05): cross-agent caller (agent_attacker) rejected with TAB_NOT_OWNED + ownerAgentId/requestedTabId/requestingAgentId; ZERO chrome.tabs.* / chrome.scripting.* / bindTab side effects.
- Test 2 (BACK-02): legit caller with history.length=1 returns status:'no_history' WITHOUT calling chrome.tabs.goBack.
- Test 3 (D-08): legit caller with depth=5 fires goBack exactly once, NEVER chrome.tabs.update, bindTab(agent_legit, 42), ownershipToken refreshed.
- Test 4: payload without tabId resolves via active-tab path; D-08 invariant holds.
- 31 assertions; exits 0.
- Commit: `f3ebed9` test(242-02): add back-tool-ownership.test.js -- cross-agent reject + D-08 background-tab invariant

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Wired 'back' through tests/mcp-tool-smoke.test.js**

- **Found during:** Task 2 verification (post-Task-2 smoke run)
- **Issue:** Plan 02 success criterion #8 requires `tests/mcp-tool-smoke.test.js`'s 'back' entry to turn green end-to-end. The smoke test loaded read-only / manual / visual-session / autopilot / observability modules but NOT agents.js, where Plan 01 (BACK-01) registered the 'back' MCP tool. Without loading agents.js, `harness.handlers.has('back')` stayed false and two assertions failed:
  - `registered handlers include back`
  - `back passes through the shared queue surface`
- **Fix:** Added `agentsModule = await loadBuildModule(pathJoin('tools', 'agents.js'))` to the module load block + `agentsModule.registerAgentTools(harness.server, harness.bridge, harness.queue, agentScope)` to the registration block + an explicit `invokeTool(harness, 'back')` invocation with bridge-envelope assertion `{type: 'mcp:go-back', payload: {agentId, ownershipToken}}`.
- **Files modified:** tests/mcp-tool-smoke.test.js
- **Commit:** `f296e8f` test(242-02): wire 'back' through smoke test (load agents.js + invoke back)
- **Why this isn't a Rule 4 (architectural):** Plan 01 already registered the tool in agents.ts; the smoke test just needed to import it. No new module, no new export, no API change.

## Authentication Gates

None encountered.

## Verification Results

| Gate | Result |
|------|--------|
| `node tests/mcp-tool-routing-contract.test.js` | 146/146 PASS |
| `node tests/back-tool-ownership.test.js` | 31/31 PASS |
| `node tests/back-tool.test.js` (Plan 01) | 30/30 PASS (still GREEN) |
| `node tests/mcp-tool-smoke.test.js` | 73/73 PASS (back entry now GREEN) |
| `node tests/ownership-gate.test.js` (Phase 240 regression) | PASS |
| `node tests/ownership-error-codes.test.js` (Phase 240 regression) | 17/17 PASS |
| `node tests/agent-registry.test.js` (Phase 237 regression) | PASS |
| `node tests/agent-bridge-routes.test.js` (Phase 238 regression) | 27/27 PASS |
| `node tests/agent-id-threading.test.js` (Phase 238 regression) | 6/6 PASS |
| `node tests/agent-cap.test.js` (Phase 241 regression) | PASS |
| `node tests/agent-grace.test.js` (Phase 241 regression) | PASS |
| `node tests/agent-pooling.test.js` (Phase 241 regression) | PASS |
| `cd mcp && npm run build` | PASS |
| grep gates (mcp:go-back >= 1, handleBackRoute >= 1, status codes >= 4, no chrome.tabs.update in handler) | All PASS |

## Pre-existing Failures (Out of Scope)

Per the plan's stated constraint -- "Pre-existing failures noted in 242-01 SUMMARY (agent-cap-ui, agent-sunset-back-end) are out of scope. Do not regress new tests." -- the only `npm test` failures observed are:

- `agent-sunset-back-end` -- detects Plan 01's intentional `server.tool('back', ...)` LIVE call in agents.ts. This is a Plan-01-induced regression of an annotation-shape check, not a new regression introduced by Plan 02.

No NEW pre-existing tests regressed by Plan 02. All Phase 237/238/239/240/241 + 242-01 regression suites stay GREEN.

## Files Touched

- Created: `tests/back-tool-ownership.test.js` (249 lines)
- Modified: `extension/ws/mcp-tool-dispatcher.js` (+360 insertions)
- Modified: `tests/mcp-tool-routing-contract.test.js` (+4 insertions, -2 deletions)
- Modified: `tests/mcp-tool-smoke.test.js` (+19 insertions)

## Commits

- `208d0cf` test(242-02): add mcp:go-back to routing-contract requiredMessageRoutes (RED gate)
- `737cc3d` feat(242-02): add mcp:go-back route + handleBackRoute / waitForBackSettle / classifyBackOutcome (BACK-02..BACK-05)
- `f3ebed9` test(242-02): add back-tool-ownership.test.js -- cross-agent reject + D-08 background-tab invariant
- `f296e8f` test(242-02): wire 'back' through smoke test (load agents.js + invoke back)

## Strategy A Confirmation

Verified at execute time that `extension/ws/mcp-tool-dispatcher.js` already exposes `dispatchMcpMessageRoute`, `dispatchMcpToolRoute`, `MCP_PHASE199_MESSAGE_ROUTES`, `MCP_PHASE199_TOOL_ROUTES`, `getMcpRouteContracts`, `hasMcpToolRoute`, and `hasMcpMessageRoute` via the existing tail-of-file `module.exports`. Strategy A applies -- the new test file `tests/back-tool-ownership.test.js` does straightforward `require()` of the dispatcher with chrome / globalThis mocks installed BEFORE the require. No tail export additions needed.

## Post-back bindTab Parity Site

The bindTab call in `handleBackRoute` (lines 791-802 of `extension/ws/mcp-tool-dispatcher.js`) mirrors `handleNavigationHistoryRoute` lines 431-443 EXACTLY:

- Same `agentId && typeof globalThis !== 'undefined' && globalThis.fsbAgentRegistryInstance && typeof globalThis.fsbAgentRegistryInstance.bindTab === 'function' && Number.isFinite(targetTabId)` guard.
- Same `try { bindResult = await globalThis.fsbAgentRegistryInstance.bindTab(agentId, targetTabId); } catch (_e) { bindResult = null; }` shape.
- Same `if (bindResult && bindResult.ownershipToken) { response.ownershipToken = bindResult.ownershipToken; }` response decoration.

This ensures the (agentId, tabId, ownershipToken) triple stays coherent across cross-origin back transitions.

## Self-Check: PASSED

- File `tests/back-tool-ownership.test.js`: FOUND
- File `extension/ws/mcp-tool-dispatcher.js`: contains `mcp:go-back` (3 occurrences) and `function handleBackRoute` (1 occurrence): FOUND
- File `tests/mcp-tool-routing-contract.test.js`: contains `mcp:go-back` (2 occurrences): FOUND
- File `tests/mcp-tool-smoke.test.js`: contains `agentsModule` + `registerAgentTools`: FOUND
- Commit `208d0cf`: FOUND in `git log --oneline`
- Commit `737cc3d`: FOUND in `git log --oneline`
- Commit `f3ebed9`: FOUND in `git log --oneline`
- Commit `f296e8f`: FOUND in `git log --oneline`
- handleBackRoute body chrome.tabs.update count: 0 (D-08 invariant verified)
