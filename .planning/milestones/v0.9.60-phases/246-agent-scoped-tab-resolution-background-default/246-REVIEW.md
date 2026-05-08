---
phase: 246-agent-scoped-tab-resolution-background-default
reviewed: 2026-05-06T00:00:00Z
depth: standard
files_reviewed: 22
files_reviewed_list:
  - extension/ai/tool-definitions.js
  - extension/background.js
  - extension/utils/agent-tab-resolver.js
  - extension/ws/mcp-bridge-client.js
  - extension/ws/mcp-tool-dispatcher.js
  - mcp/ai/tool-definitions.cjs
  - mcp/src/tools/autopilot.ts
  - mcp/src/tools/read-only.ts
  - mcp/src/tools/schema-bridge.ts
  - mcp/src/tools/vault.ts
  - mcp/src/tools/visual-session.ts
  - package.json
  - tests/action-tool-agent-scoped.test.js
  - tests/agent-id-threading.test.js
  - tests/agent-tab-resolver.test.js
  - tests/legacy-agent-synthesis.test.js
  - tests/multi-agent-regression.test.js
  - tests/open-tab-background-default.test.js
  - tests/ownership-error-codes.test.js
  - tests/read-tool-tab-resolution.test.js
  - tests/tool-definitions-parity.test.js
  - tests/visual-session-agent-scoped.test.js
  - tests/visual-session-reentry.test.js
findings:
  critical: 0
  warning: 1
  info: 4
  total: 5
status: issues_found
---

# Phase 246: Code Review Report

**Reviewed:** 2026-05-06
**Depth:** standard
**Files Reviewed:** 22 (15 source + 7 test files; 2 config-adjacent: package.json, tool-definitions parity pair)
**Status:** issues_found

## Summary

Phase 246 introduces a clean, single-chokepoint resolver (`extension/utils/agent-tab-resolver.js`) and migrates three call families (read tools, visual session, action tools including vault) to consume it. The implementation is correct in the intended hot paths and ten test files (`agent-tab-resolver.test.js`, `read-tool-tab-resolution.test.js`, `open-tab-background-default.test.js`, `visual-session-agent-scoped.test.js`, `action-tool-agent-scoped.test.js`, `legacy-agent-synthesis.test.js`, `visual-session-reentry.test.js`, `ownership-error-codes.test.js`, `multi-agent-regression.test.js`, `tool-definitions-parity.test.js`, `agent-id-threading.test.js`) all pass locally. The byte-identity invariant between `extension/ai/tool-definitions.js` and `mcp/ai/tool-definitions.cjs` holds (1163 lines each, `diff` returns clean). The importScripts order (`agent-tab-resolver.js` at line 16, dispatcher at 28, bridge-client at 39) is correct.

The findings below are bounded and non-blocking; the most actionable item is a documentation/UX inconsistency in `mcp/src/tools/visual-session.ts` and `mcp/src/tools/agents.ts` where the `back` and `end_visual_session` tool descriptions advertise `tab_id` semantics not exposed by the schema, mirroring exactly the description-hygiene class flagged in the phase context (Risk #7). No security regressions, race conditions, or contract breaks were identified.

## Warnings

### WR-01: Misleading "tab_id is agent-scoped" copy on tools whose schema does not expose tab_id

**File:** `mcp/src/tools/visual-session.ts:94` (end_visual_session) and `mcp/src/tools/agents.ts:33` (back)

**Issue:** Two tool descriptions claim "tab_id is agent-scoped: only tabs owned by the calling agent can be addressed" but their Zod schemas do not expose a `tab_id` field:

- `end_visual_session` schema (visual-session.ts:96-97) is `{ session_token, reason }` — no tab_id at all (the session token already keys to a specific tab, so an explicit tab_id is unnecessary).
- `back` schema (agents.ts:34) exposes `tabId` (camelCase), not `tab_id`. The description sentence references the snake_case form, which is the MCP boundary convention but is not what this particular tool accepts.

This is the same description-hygiene class the phase context (Risk #7) flagged on `run_task` and remediated by removing the "tab_id is agent-scoped" sentence from autopilot.ts. The two remaining instances were not caught.

For `back`, the camelCase Zod field is also worth re-examining: every other Phase 246 tool (read tools, vault tools, visual session, manual action tools) exposes `tab_id` (snake_case) at the MCP boundary; `back` is the lone outlier exposing `tabId`. This forces MCP clients to call `back({ tabId: 42 })` while every other tool takes `back({ tab_id: 42 })`. Cross-tool inconsistency at the MCP boundary is a UX cost.

**Fix (description-only, low risk):**
- In `visual-session.ts:94`, drop the "tab_id is agent-scoped: only tabs owned by the calling agent can be addressed." sentence from `end_visual_session`'s description (it has no tab_id field).
- In `agents.ts:33`, replace "tab_id is agent-scoped" with "tabId is agent-scoped" so the docs match the schema.

**Optional follow-up (out of scope for v0.9.60):** unify `back`'s schema to use `tab_id` for parity with the rest of the v0.9.60 surface. This is a breaking change for any caller already passing `tabId`, so it must be deferred.

## Info

### IN-01: Defensive fallback in `_handleExecuteBackground` does not include tabId

**File:** `extension/ws/mcp-bridge-client.js:650-657`

**Issue:** When `_handleExecuteBackground` is called without `routeParams` (back-compat path), it rebuilds the params from `payload`, threading `agentId` / `ownershipToken` / `connectionId` but NOT `tabId`. Without tabId in params, `_resolveTabIdForGate` (mcp-tool-dispatcher.js:161) returns null and the gate's tab-arm skips. This means a caller bypassing `_handleExecuteAction` would land in an agent-only-validated dispatch with no tab ownership check.

Today, the only caller of `_handleExecuteBackground` is `_handleExecuteAction` (line 611), which always passes a fully-populated `routeParams`, so the fallback never fires. It is defensive dead code.

**Fix:** None required — this is a back-compat hook. If a future caller invokes `_handleExecuteBackground` directly, they should pass routeParams (matching the documented contract on line 638-641). Consider adding a `console.warn` inside the `if (!routeParams)` branch to surface accidental usage during development; or delete the fallback entirely and require routeParams as a non-optional argument. Either change is non-blocking.

### IN-02: `resolvedFromRegistry` flag is set then explicitly discarded

**File:** `extension/ws/mcp-tool-dispatcher.js:1204, 1226, 1246`

**Issue:** `handleStartVisualSessionRoute` defines `let resolvedFromRegistry = false` (line 1204), sets it to true in the registry branch (line 1226), then immediately throws it away with `void resolvedFromRegistry` (line 1246). The comment at line 1244-1245 says "may be consumed by future diagnostics," but the variable is dead code today.

**Fix:** Remove the variable entirely (3 lines), or wire it into a diagnostic log call. Leaving a dead `let` + `void` pair tends to confuse code readers and grows over time; if there's a real plan to surface this in diagnostics, file a follow-up issue and link it. Otherwise delete:

```js
// before
let tab;
let resolvedFromRegistry = false;
const isLegacyOrMissingAgent = (typeof agentId !== 'string' || !agentId || agentId.startsWith('legacy:'));
if (isLegacyOrMissingAgent) {
  tab = await getActiveTabFromClient(client);
  // ...
} else {
  const resolved = await ...;
  if (resolved.success === false) return ...;
  resolvedFromRegistry = true;
  // ...
}
void resolvedFromRegistry;

// after
let tab;
const isLegacyOrMissingAgent = (typeof agentId !== 'string' || !agentId || agentId.startsWith('legacy:'));
if (isLegacyOrMissingAgent) {
  tab = await getActiveTabFromClient(client);
  // ...
} else {
  const resolved = await ...;
  if (resolved.success === false) return ...;
  // ...
}
```

### IN-03: `uninstallCallbackHandler` defined but never called

**File:** `tests/visual-session-agent-scoped.test.js:158-160`

**Issue:** `installCallbackHandler` is invoked in tests 1-5 but `uninstallCallbackHandler` is never called. After the file's test runner exits, the stub stays installed on `globalThis.handleStartMcpVisualSession`. Because `npm test` chains test files via `&&` (each in its own Node process), this is not a cross-test pollution problem in practice — but it is a code smell, and the contract of "install + uninstall" is broken.

**Fix:** Either delete the unused `uninstallCallbackHandler` function (line 158-160) or wrap each test's `installCallbackHandler` call in `try/finally` and call `uninstallCallbackHandler` in the `finally` block. The latter is the intended hygienic pattern.

### IN-04: Source-detection gates in test files are now dead code

**File:** `tests/action-tool-agent-scoped.test.js:67-76`, `tests/visual-session-agent-scoped.test.js:60-74`, `tests/ownership-error-codes.test.js:273-285`

**Issue:** Several tests carry "Wave 0 RED-skeleton" gates that scan source files for the literal string `resolveAgentTabOrError` and skip cases when the migration has not landed (e.g., `TASK3_LANDED_EXECUTE_ACTION`, `TASK5_LANDED_PARAM_TRANSFORMS`, `TASK3_LANDED`). All migrations have shipped, so these gates evaluate true on every run and the skip branches are unreachable. The gates correctly preserved test ordering during phased rollout but no longer carry signal.

**Fix:** Optional cleanup pass — remove the source-detection probes and the corresponding `if (!TASK_X_LANDED) { skip }` branches. This trims ~30 lines across the affected test files and removes a brittle dependency on source-string matching. Defer to a future cleanup phase; the current state is correct, just verbose.

---

## Cross-Cutting Verification (Phase 246-Specific Risks)

The following invariants from the phase context were specifically checked and are correctly preserved.

| # | Risk | Status | Evidence |
| - | - | - | - |
| 1 | Race conditions in resolver (sync-friendly chokepoint, no await in dispatch path between gate and handler) | OK | Resolver awaits `_getActiveTab` only on the legacy:* branch (line 47-55). Non-legacy branches are sync-after-await. The resolver is invoked BEFORE `dispatchMcpToolRoute`, so the gate→handler "no await" property in `mcp-tool-dispatcher.js:217-233` is preserved. |
| 2 | PARAM_TRANSFORMS regression (5 tools forward tab_id) | OK | `mcp/src/tools/schema-bridge.ts:144-186` -- press_key, drag_drop, click_at, drag, fill_sheet all spread `...(p.tab_id !== undefined ? { tab_id: p.tab_id } : {})` at the end of their transform output. Test 5-9 of `action-tool-agent-scoped.test.js` confirms each. |
| 3 | tool-definitions byte-identity | OK | `diff extension/ai/tool-definitions.js mcp/ai/tool-definitions.cjs` returns clean. `tool-definitions-parity.test.js` Test 2 (130 PASS) also asserts buffer-byte equality. |
| 4 | Vault tool overturn (vault.ts threads agentId/ownershipToken/connectionId) | OK | `mcp/src/tools/vault.ts:54-92` (fill_credential) and `:117-155` (use_payment_method) both thread `agentId`, optional `tab_id`, optional `ownershipToken`, optional `connectionId`. The previous `void agentScope` pattern is gone. Tests 10-11 of `action-tool-agent-scoped.test.js` confirm registry-fed tab dispatch. |
| 5 | Error envelope shape (plain objects, not classes) | OK | Resolver returns `{ success: false, code, agentId, tabIds? }` plain objects (line 52, 70, 74, 77). Matches Phase 240's `createMcpRouteError` pattern. No class-based errors detected. |
| 6 | Test harness assumptions (no cross-test global pollution) | OK | All Phase 246 test files run in isolated Node processes (`npm test` chains via `&&`). Tests that mutate globals use `try/finally` cleanup. The one exception (uninstallCallbackHandler unused, IN-03 above) is process-scoped only. |
| 7 | Description hygiene (run_task no longer claims tab_id support) | PARTIAL | `autopilot.ts` confirmed clean. Two other tools still carry the misleading "tab_id is agent-scoped" copy (`end_visual_session` and `back` — see WR-01). |
| 8 | importScripts order (resolver loaded before dispatcher and bridge-client) | OK | `extension/background.js:9` (tool-definitions), `:11` (agent-registry), `:16` (agent-tab-resolver), `:28` (mcp-tool-dispatcher), `:39` (mcp-bridge-client). Resolver loads before its consumers. |
| 9 | Defensive fallthrough in handleStartVisualSessionRoute does not create a security hole | OK | `mcp-tool-dispatcher.js:1205` activates fallthrough only when agentId is null/undefined OR starts with `legacy:`. The MCP server's `agentScope.ensure(bridge)` is always invoked at the wire entry (visual-session.ts:59), so non-legacy MCP calls always have a registered agentId. The bridge is local-only (`ws://localhost:7225`), so this defensive layer is acceptable. |
| 10 | open_tab default flip (legitimate foreground callers) | OK | `handleOpenTabRoute` (mcp-tool-dispatcher.js:921) calls `chrome.tabs.create({ url, active: params.active === true })`. Tool description (extension/ai/tool-definitions.js:573-578) documents the new default and the `active:true` opt-in. Popup/sidepanel/legacy-autopilot create tabs via their own non-MCP code paths and are unaffected. Tests 1-3 of `open-tab-background-default.test.js` confirm both the default and the explicit-true path. |

---

## Test Execution Verification

All Phase 246 test files were run in isolation; results:

```
agent-tab-resolver         25 passed
read-tool-tab-resolution   20 passed
open-tab-background-default 10 passed
visual-session-agent-scoped 16 passed
action-tool-agent-scoped   21 passed
legacy-agent-synthesis     all assertions passed
visual-session-reentry     all assertions passed
ownership-error-codes      23 passed
multi-agent-regression     10/10 passed
tool-definitions-parity    130 passed
agent-id-threading         14 passed
```

No test failures observed.

---

_Reviewed: 2026-05-06_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
