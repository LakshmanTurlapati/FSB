---
phase: 246-agent-scoped-tab-resolution-background-default
plan: 02
subsystem: mcp
tags: [agent-scope, tab-resolution, visual-session, action-tools, vault, ownership-gate, multi-agent]

# Dependency graph
requires:
  - phase: 237-agent-registry-foundation
    provides: globalThis.fsbAgentRegistryInstance.getAgentTabs(agentId) sync read
  - phase: 238-agentscope-bridge-wiring
    provides: AgentScope.ensure / currentOwnershipToken / currentConnectionId
  - phase: 240-tab-ownership-enforcement-on-dispatch
    provides: checkOwnershipGate at dispatchMcpToolRoute; tab-arm fires when routeParams.tabId is set
  - phase: 245-post-action-change-report
    provides: wrapWithChangeReport (resolver runs upstream of the wrap)
  - plan: 246-01
    provides: resolveAgentTabOrError(agentId, params, client); read-tool migration; open_tab background-default; read-only.ts overturn
provides:
  - handleStartVisualSessionRoute migrated to resolver (D-09)
  - start_visual_session Zod schema declares optional tab_id (D-10)
  - Same-agent visual-session resume preserved with explicit tab_id (D-11)
  - _handleExecuteAction migrated to resolver with skipGate-aware D-16 routeParams.tabId injection
  - _handleExecuteBackground threads routeParams from caller (D-16)
  - _handleFillCredential and _handleUsePaymentMethod migrated to resolver (D-13 vault overturn)
  - All 35 action-tool inputSchemas declare optional tab_id (D-14)
  - 5 PARAM_TRANSFORMS entries forward tab_id (Pitfall 1 closed)
  - vault.ts threads agentId/ownershipToken/connectionId/tab_id in fill_credential and use_payment_method (D-13 vault overturn)
  - tool-definitions.js and tool-definitions.cjs remain byte-identical
  - Phase 240 dispatch gate's tab-arm now fires on every non-creating MCP call (D-16)
affects:
  - 246-03 (cross-cut integration tests + tool-definitions parity safety net)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "skipGate-aware routeParams composition: ...(resolved.skipGate ? {} : { tabId })"
    - "PARAM_TRANSFORMS spread for optional fields: ...(p.tab_id !== undefined ? { tab_id: p.tab_id } : {})"
    - "Source-detection test gates short-circuit cleanly between paired tasks (Plan 01 pattern reused)"
    - "Legacy-or-missing-agentId fallthrough preserves pre-resolver active-tab semantics for non-MCP callers"

key-files:
  created:
    - tests/visual-session-agent-scoped.test.js
    - tests/action-tool-agent-scoped.test.js
  modified:
    - extension/ws/mcp-tool-dispatcher.js (handleStartVisualSessionRoute resolver migration with legacy fallback)
    - extension/ws/mcp-bridge-client.js (_handleExecuteAction, _handleExecuteBackground, _handleFillCredential, _handleUsePaymentMethod)
    - extension/ai/tool-definitions.js (35 action tools gain optional tab_id; description appended)
    - mcp/ai/tool-definitions.cjs (kept byte-identical with .js)
    - mcp/src/tools/visual-session.ts (start_visual_session Zod adds tab_id; payload forwards it)
    - mcp/src/tools/schema-bridge.ts (5 PARAM_TRANSFORMS forward tab_id)
    - mcp/src/tools/vault.ts (fill_credential + use_payment_method overturn)
    - tests/legacy-agent-synthesis.test.js (2 D-15 cases; stub guards retired in Task 7)
    - tests/visual-session-reentry.test.js (1 D-11 case)
    - tests/ownership-error-codes.test.js (2 D-16 cases; getAgentTabs added to registry mock)
    - package.json (5 new/extended tests + multi-agent-regression added to chain)

key-decisions:
  - "Legacy-or-missing-agentId fallthrough in handleStartVisualSessionRoute (pragmatic): when agentId is null/undefined or starts with legacy:, preserve the prior getActiveTabFromClient(client) path. Avoids breaking existing mcp-visual-session-contract.test.js which calls dispatchMcpMessageRoute with no agentId. Production callers always thread agentId via agentScope.ensure(bridge), so the registry path fires for real MCP agents."
  - "_handleExecuteBackground signature change: added 4th routeParams arg with back-compat fallback. Single in-tree caller (_handleExecuteAction in the same file); zero test references. The signature change is safe because the only legitimate caller is updated atomically."
  - "Programmatic schema bump for 35 action tools via /tmp/add-tab-id-to-tools.js. Each tool gets the same tab_id property (type number, optional, identical description) and a uniform description-sentence append. Mechanical operation; no per-tool variance."
  - "Source-detection test gates use file-content scans rather than module-export probes. The action-tool-agent-scoped.test.js scans extension/ws/mcp-bridge-client.js for the resolveAgentTabOrError call inside the _handleExecuteAction body and the schema-bridge built JS for the p.tab_id !== undefined spread; once both land, the gates auto-retire and 11/11 cases run."

patterns-established:
  - "Three-call-family resolver chokepoint complete: read tools (Plan 01) + visual session (Plan 02 Task 2) + action tools (Plan 02 Task 3) all consume the same resolveAgentTabOrError helper"
  - "D-16 defense-in-depth: resolver picks the tab; routeParams.tabId injection makes the Phase 240 gate enforce ownership on every non-creating call"
  - "PARAM_TRANSFORMS contract: every transform that rebuilds params from scratch must explicitly spread tab_id when the caller provides it (Pitfall 1)"

requirements-completed: [D-07, D-09, D-10, D-11, D-13, D-14, D-15, D-16]

# Metrics
duration: 20min
completed: 2026-05-06
---

# Phase 246 Plan 02: Visual Session + Action Tools + Gate Tightening Summary

**Migrated visual-session and the ~37 action-tool dispatch path to the resolver helper from Plan 01; closed D-16 (resolver feeds resolved tabId back into routeParams.tabId) so Phase 240's dispatch gate enforces (agentId, tabId, ownership_token) on every non-creating MCP call; overturned vault.ts's Phase 238 D-06 exemption so fill_credential and use_payment_method join the agent-scoped surface; added optional tab_id to all 35 action-tool inputSchemas plus start_visual_session; closed RESEARCH.md Pitfall 1 by patching all 5 PARAM_TRANSFORMS entries to forward tab_id.**

## Performance

- **Duration:** 20 min
- **Started:** 2026-05-06T22:16:01Z
- **Completed:** 2026-05-06T22:37:00Z (approx)
- **Tasks:** 7 (all atomic commits, all green)
- **Files modified:** 13 (2 created tests, 11 modified source/schema/test/package files)
- **Lines changed:** +1525 / -177 across 7 commits

## Accomplishments

- **handleStartVisualSessionRoute migrated to resolver (D-09 + D-10 + D-11).** Single mental model across read/visual/action surfaces. Pragmatic adjustment: legacy:* and missing-agentId callers preserve the prior `getActiveTabFromClient(client)` path so the existing `mcp-visual-session-contract.test.js` continues passing byte-for-byte. Production callers (real MCP agents) always thread agentId via `agentScope.ensure(bridge)` so the registry path fires for them. start_visual_session Zod schema now declares optional `tab_id` and the payload assembly forwards it when caller provides.
- **_handleExecuteAction migrated with D-16 (D-13 + D-15 + D-16).** Resolver replaces `_getActiveTab`. routeParams composition is skipGate-aware: non-legacy agents get `routeParams.tabId = resolved.tabId` (camelCase) so `_resolveTabIdForGate` finds it and the gate's tab-arm fires; legacy:* surfaces (skipGate:true) keep routeParams clean preserving the gate's tab-arm-skip path. `_handleExecuteBackground` accepts a 4th `routeParams` arg from the caller (back-compat fallback for Phase 245 callers preserved). Inner `dispatchMcpToolRoute` invocation now forwards routeParams instead of payload.params, ensuring the resolver-fed tabId reaches the gate.
- **Vault overturn end-to-end (D-13).** Extension-side: `_handleFillCredential` and `_handleUsePaymentMethod` migrated to the resolver; vault domain-derivation logic preserved (resolver returns only tabId; chrome.tabs.get(resolved.tabId) supplies the URL for hostname extraction). MCP-side: vault.ts `void agentScope` removed; both fill_credential and use_payment_method now call `agentScope.ensure(bridge)`, thread `agentId/ownershipToken/connectionId/tab_id` into the bridge payload, and capture-token-on-response (mirrors manual.ts pattern). list_credentials and list_payment_methods stay tab-agnostic per D-13.
- **35 action-tool schemas updated (D-14).** Programmatic bump via /tmp/add-tab-id-to-tools.js: each tool's `inputSchema.properties` gets `tab_id: { type: 'number', description: 'Optional. Tab id ...' }` (NOT in `required`) and the description is appended with `'Pass tab_id only when this agent owns multiple tabs; auto-resolves otherwise.'` Both `extension/ai/tool-definitions.js` and `mcp/ai/tool-definitions.cjs` updated atomically; `diff -q` returns clean (Pitfall 2 stays closed). open_tab and switch_tab correctly excluded.
- **PARAM_TRANSFORMS forwards tab_id (Pitfall 1 closed).** All 5 transforms (`press_key`, `drag_drop`, `click_at`, `drag`, `fill_sheet`) now spread `...(p.tab_id !== undefined ? { tab_id: p.tab_id } : {})` so the rebuild path no longer silently drops tab_id. JSDoc block updated with the Phase 246 D-14 contract.
- **Test coverage (16 new + 5 extended cases, all green).** 5 visual-session-agent-scoped cases (D-09/D-10/D-11). 11 action-tool-agent-scoped cases (D-13/D-15 + 5 PARAM_TRANSFORMS + vault overturn). 2 D-15 cases in legacy-agent-synthesis. 1 D-11 case in visual-session-reentry. 2 D-16 cases in ownership-error-codes. All test files added to `npm test` chain plus `multi-agent-regression.test.js`.

## Task Commits

Each task was committed atomically (per-task `--no-verify` per parallel-execution policy):

1. **Task 1: Wave 0 scaffolds for visual-session + action-tool + extensions** -- `3ebb71f` (test)
2. **Task 2: Migrate handleStartVisualSessionRoute to resolver + add tab_id schema** -- `0eb1a7f` (feat)
3. **Task 3: Migrate _handleExecuteAction with D-16 routeParams + vault overturn (extension-side)** -- `ad72852` (feat)
4. **Task 4: Add optional tab_id to 35 action-tool inputSchemas** -- `f3bee41` (feat)
5. **Task 5: Forward tab_id through 5 PARAM_TRANSFORMS entries** -- `0ca26d6` (feat)
6. **Task 6: Overturn vault.ts agentScope exemption (D-13 vault overturn)** -- `3b2ca4c` (feat)
7. **Task 7: Retire D-15 stub guards in legacy-agent-synthesis** -- `05d8c96` (test)

## Files Created/Modified

**Created:**

- `tests/visual-session-agent-scoped.test.js` -- 5 cases for D-09/D-10/D-11 (single-tab, zero-owned, ambiguous, explicit tab_id, resume forwarding). 16/16 PASS.
- `tests/action-tool-agent-scoped.test.js` -- 11 cases: D-13 single-tab/ambiguous/explicit, D-15 legacy skipGate, 5 PARAM_TRANSFORMS forwards, 2 vault overturn (fill_credential + use_payment_method). 21/21 PASS.

**Modified:**

- `extension/ws/mcp-tool-dispatcher.js` -- `handleStartVisualSessionRoute` body adds resolver path with legacy-or-missing-agentId fallthrough. `chrome.tabs.get(resolved.tabId)` supplies tab metadata for restricted-page detection on the registry path. Phase 240 D-09 callback contract preserved byte-for-byte.
- `extension/ws/mcp-bridge-client.js` -- `_handleExecuteAction` rewritten to call resolver, build skipGate-aware routeParams (D-16), and pass routeParams down to `_handleExecuteBackground`. `_handleExecuteBackground` accepts a 4th `routeParams` arg with legacy reconstruction fallback. `_handleFillCredential` and `_handleUsePaymentMethod` migrated to the resolver path; URL still derived from `chrome.tabs.get(resolved.tabId)` for the vault's hostname extraction.
- `extension/ai/tool-definitions.js` -- 35 action tools gain `tab_id` in `inputSchema.properties`; description appended uniformly.
- `mcp/ai/tool-definitions.cjs` -- byte-identical mirror of the .js file.
- `mcp/src/tools/visual-session.ts` -- `start_visual_session` Zod adds optional `tab_id`; payload forwards it.
- `mcp/src/tools/schema-bridge.ts` -- 5 PARAM_TRANSFORMS entries spread `tab_id` when caller provides.
- `mcp/src/tools/vault.ts` -- `void agentScope` removed; `fill_credential` and `use_payment_method` now call `agentScope.ensure(bridge)` and thread `agentId/ownershipToken/connectionId/tab_id` into the bridge payload. Capture-token-on-response flow added.
- `tests/legacy-agent-synthesis.test.js` -- 2 D-15 cases appended (Task 1) and stub guards retired (Task 7).
- `tests/visual-session-reentry.test.js` -- 1 D-11 case appended.
- `tests/ownership-error-codes.test.js` -- 2 D-16 cases appended; `buildRegistryMock` extended with `getAgentTabs` (the resolver consumes this method).
- `package.json` -- npm test chain extended with 5 new/extended test files plus `multi-agent-regression.test.js`.

## Decisions Made

- **Legacy-or-missing-agentId fallthrough in handleStartVisualSessionRoute.** The plan as written would have removed `getActiveTabFromClient(client)` entirely. Doing so broke `tests/mcp-visual-session-contract.test.js` (4 failures), which calls `dispatchMcpMessageRoute` with no agentId — synthetic Phase 238 D-06 callers. Pragmatic adjustment: when `agentId` is null/undefined or `legacy:*`, fall through to `getActiveTabFromClient(client)` (which already wraps `client._getActiveTab()`); only the registry path uses `chrome.tabs.get(resolved.tabId)`. Production MCP agents always thread agentId via `agentScope.ensure(bridge)` so they hit the registry path. The contract test continues to pass without modification, and the design intent of D-09 (registry-driven for real MCP agents) is preserved.
- **Schema rollout via programmatic edit.** Hand-editing 35 tools in two files would have been error-prone and noisy. /tmp/add-tab-id-to-tools.js produces a uniform diff (always 2 inserted lines per tool: tab_id property + description sentence) and writes both `extension/ai/tool-definitions.js` and `mcp/ai/tool-definitions.cjs` from the same buffer, guaranteeing byte-identity.
- **Test gating with file-content scans.** Wave 0 tests use `fs.readFileSync` to detect whether the matching task has landed (e.g., `_handleExecuteAction` block contains `resolveAgentTabOrError`, schema-bridge.js has 5 `p.tab_id !== undefined` matches). The gates short-circuit cleanly so npm test stays green between every pair of consecutive task commits. Once a task lands the production code, its matching test cases auto-retire from skipped to running.
- **D-16 routeParams composition mirrored verbatim from the plan's IF/ELSE diff.** `routeParams = { ...params, ...(resolved.skipGate ? {} : { tabId }), ...(agentId ? { agentId } : {}), ...(payload.ownershipToken ? { ownershipToken } : {}), ...(payload.connectionId ? { connectionId } : {}) }`. The skipGate spread is the load-bearing line.

## Deviations from Plan

**Pragmatic adjustment in Task 2 (handleStartVisualSessionRoute):** The plan specified replacing the `getActiveTabFromClient` call entirely with the resolver. I added a legacy-or-missing-agentId fallthrough so the pre-existing `mcp-visual-session-contract.test.js` continues to pass without modification. This is a Rule 3 fix (auto-fix blocking issue): the plan's literal application broke 4 contract test cases that call `dispatchMcpMessageRoute` with no agentId. Production callers always thread agentId via `agentScope.ensure(bridge)` so the registry path fires for real MCP agents; only synthetic test callers hit the legacy-or-missing-agentId fallback. The design intent of D-09 (registry-driven resolution for MCP agents) is preserved.

**Tests/ownership-error-codes.test.js D-16 cases switched from `'click'` to `'navigate'`:** The plan's task 1 used `'click'` as the example tool. `'click'` is NOT registered in `MCP_PHASE199_TOOL_ROUTES`; `dispatchMcpToolRoute` returns `createMcpRouteError` for unknown tools BEFORE the gate fires. Switched to `'navigate'` (which IS registered; matches the existing Test 1 pattern). Same Rule 3 fix: the plan's literal example tool didn't trigger the gate.

**buildRegistryMock in ownership-error-codes.test.js extended with `getAgentTabs`:** The Phase 240 helpers (hasAgent / isOwnedBy / getOwner / getTabMetadata / getAgentWindowId / bindTab) were enough for the original gate tests. The Phase 246 resolver consumes `getAgentTabs(agentId)`; without that method, the resolver returns `AGENT_REGISTRY_UNAVAILABLE` defensively. Adding the method is the minimal change to make the existing mock cover the resolver's new contract. Rule 2 fix: missing critical functionality (the mock was incomplete for the new contract).

**Task 7 stub guards retired with explicit require, not lazy load.** The plan specified the guards on the form `if (typeof globalThis.resolveAgentTabOrError !== 'function') { /* skipped */ }`. After Plan 01 landed the resolver, those guards always took the green branch but added cognitive overhead. Task 7 retires the guards by `require('../extension/utils/agent-tab-resolver.js')` at the top of the Phase 246 block, making the test hermetic and removing the conditional logic. Both D-15 cases now run unconditionally.

## Issues Encountered

- **mcp/dist vs mcp/build path discrepancy.** The plan's verification commands referenced `mcp/dist/tools/schema-bridge.js`. The actual TypeScript output directory per `mcp/tsconfig.json` is `mcp/build/`. Source-detection scans in `tests/action-tool-agent-scoped.test.js` use `mcp/build/tools/schema-bridge.js`. Verification commands in the SUMMARY use the actual `mcp/build/` path.
- **Worktree branch base mismatch at start.** `git merge-base HEAD <expected_base>` returned a merge commit, not the expected base. Reset hard to `20a5cfa67f8d4818a929214d0aa8f5e315c163b4` (Plan 01 tip) per the worktree_branch_check protocol. All 7 task commits land cleanly atop it.
- **mcp/node_modules not present at start.** Ran `npm --prefix mcp install` once before the first `npm --prefix mcp run build`. Fresh worktree state did not preserve prior installs.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 03 can now extend `tests/multi-agent-regression.test.js` with cross-cut scenarios that exercise the full resolver + gate + visual-session composition.
- Plan 03's `tests/tool-definitions-parity.test.js` (byte-identity safety net) is unblocked: tool-definitions.js and tool-definitions.cjs are byte-identical with the new schemas.
- Plan 03's extension of `tests/agent-id-threading.test.js` for vault.ts overturn coverage is ready: vault.ts now threads agentId/ownershipToken/connectionId/tab_id verbatim.
- No blockers; npm test green; mcp build green.

## Self-Check: PASSED

- 2 new test files exist:
  - FOUND tests/visual-session-agent-scoped.test.js
  - FOUND tests/action-tool-agent-scoped.test.js
- 7 task commits exist:
  - FOUND 3ebb71f (Task 1)
  - FOUND 0eb1a7f (Task 2)
  - FOUND ad72852 (Task 3)
  - FOUND f3bee41 (Task 4)
  - FOUND 0ca26d6 (Task 5)
  - FOUND 3b2ca4c (Task 6)
  - FOUND 05d8c96 (Task 7)
- tool-definitions byte-identical: PASS (`diff -q` returns no output)
- mcp build green: PASS (`npm --prefix mcp run build` exits 0)
- npm test green: PASS (60+ tests; 0 failures)
- D-16 contract: PASS (`grep -c '_handleExecuteBackground' extension/ws/mcp-bridge-client.js` returns 2; `grep -rn '_handleExecuteBackground' tests/` returns no matches)
- 5 PARAM_TRANSFORMS forward tab_id: PASS (`grep -c 'p.tab_id !== undefined' mcp/src/tools/schema-bridge.ts` returns 5)
- vault.ts no longer contains 'void agentScope': PASS
- vault.ts contains 'Phase 246 D-13 vault overturn': PASS
- No emojis introduced: PASS

---
*Phase: 246-agent-scoped-tab-resolution-background-default*
*Plan: 02*
*Completed: 2026-05-06*
