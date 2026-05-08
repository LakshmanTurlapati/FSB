---
phase: 246-agent-scoped-tab-resolution-background-default
plan: 03
subsystem: mcp
tags: [agent-scope, tab-resolution, parity-test, multi-agent, integration, phase-gate]

# Dependency graph
requires:
  - phase: 237-agent-registry-foundation
    provides: globalThis.fsbAgentRegistryInstance.getAgentTabs(agentId) sync read; getOrRegisterLegacyAgent
  - phase: 238-agentscope-bridge-wiring
    provides: AgentScope.ensure / currentOwnershipToken / currentConnectionId; agent_test_smoke deterministic harness mint
  - phase: 240-tab-ownership-enforcement-on-dispatch
    provides: checkOwnershipGate (D-16 makes it load-bearing); _resolveTabIdForGate
  - phase: 245-post-action-change-report
    provides: wrapWithChangeReport (resolver runs upstream of the wrap)
  - plan: 246-01
    provides: resolveAgentTabOrError; read-tool migration; open_tab background-default; read-only.ts overturn
  - plan: 246-02
    provides: visual-session migration; ~37 action-tool dispatch path; vault overturn; PARAM_TRANSFORMS forwards tab_id
provides:
  - tests/tool-definitions-parity.test.js (byte-identity safety net; closes RESEARCH.md Pitfall 2 permanently)
  - tests/multi-agent-regression.test.js extended with 4 Phase 246 scenarios (cases 7-10)
  - tests/agent-id-threading.test.js extended with 2 read-only.ts cases (Phase 246 D-02 server-side overturn coverage)
  - mcp/src/tools/autopilot.ts run_task description hygiene (tab_id reference removed)
  - mcp/src/tools/agents.ts back description verified Pass (already contains Multi-agent contract)
  - Full Phase 246 surface verified green (11 Phase 246 test files + full npm test exit 0)
affects:
  - Phase 246 ships -- gates 60+ tests including the 11 Phase 246 deliverables

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Buffer.compare byte-identity check pattern (RESEARCH.md Pitfall 2 canary)"
    - "Multi-agent regression case extensions follow existing test() registration + freshRequireRegistry harness"
    - "MCP-side agentId-in-payload assertions via createToolHarness + bridgeCalls filtering"
    - "Description hygiene Pass/Append decision rules for hand-written MCP tool descriptions (TOOL_REGISTRY-driven tools inherit from tool-definitions.js automatically)"

key-files:
  created:
    - tests/tool-definitions-parity.test.js
  modified:
    - tests/multi-agent-regression.test.js (4 cases appended; helper functions for installChromeWithCreate)
    - tests/agent-id-threading.test.js (2 read-only.ts case functions; refactored existing manual.ts test into a named function)
    - package.json (npm test chain extended with tool-definitions-parity.test.js + agent-id-threading.test.js)
    - mcp/src/tools/autopilot.ts (1 sentence removed from run_task description)

key-decisions:
  - "Pass condition for agents.ts back tool: existing description contains 'Multi-agent contract' substring -- per Plan 03 Task 4 Step 1 acceptance, NO-DIFF outcome is acceptable when this substring is present. No diff written."
  - "REGRESSION condition for autopilot.ts run_task: existing description contained 'tab_id is agent-scoped: only tabs owned by the calling agent can be addressed' which falsely advertised tab_id support. run_task's Zod schema only declares { task: z.string() } so the description was contradictory. Removed the misleading sentence per Plan 03 Task 4 Step 2 REMOVAL outcome."
  - "Scenario C in multi-agent-regression.test.js uses an inline installChromeWithCreate helper (defined locally in the test file) rather than extending the shared installChromeMock fixture. The shared fixture's tabs mock is read-only (query/get) and adding a `create` method to it would be a fixture-level change with broader blast radius. The local helper keeps Plan 03's test additions surgical."
  - "Scenario A explicit-tab_id assertion: agent A passing tab_id=1101 (B's tab) to the resolver returns the explicit tab_id WITHOUT rejecting (skipGate:false). The dispatch gate is the layer that rejects cross-agent calls (D-16); separately verified in tests/ownership-error-codes.test.js. Plan 03 Task 2 acceptance criteria explicitly notes this contract."

patterns-established:
  - "Byte-identity parity test as a permanent canary for any duplicated source-of-truth file (Pitfall 2 closure pattern)"
  - "Phase 246 multi-agent regression scenarios A/B/C/D demonstrate the resolver + gate composition end-to-end -- a regression in any of the upstream layers (resolver branches, registry method signatures, dispatcher routeParams composition, open_tab default flip, error envelope shape) surfaces here before per-handler tests catch it"
  - "MCP description hygiene strategy: hand-written descriptions in agents.ts/autopilot.ts get Pass/Append decision rules with specific grep checks; TOOL_REGISTRY-driven tools (manual.ts, read-only.ts, vault.ts, visual-session.ts) inherit from tool-definitions.js automatically and were updated in Plans 01/02"

requirements-completed: [D-02, D-10, D-13, D-14, D-16]

# Metrics
duration: 7min
completed: 2026-05-06
---

# Phase 246 Plan 03: Cross-Cut Integration Tests + Smoke Summary

**Cross-cut integration tests + multi-agent regression that validates the entire Phase 246 surface composes correctly. Adds the byte-identity parity test (closes RESEARCH.md Pitfall 2 permanently). Extends multi-agent regression with 4 representative scenarios (A: read isolation; B: legacy popup skipGate; C: open_tab background default + bindTab; D: AMBIGUOUS_TAB error envelope + recovery). Extends agent-id-threading with 2 read-only.ts cases verifying the Phase 238 D-06 -> Phase 246 D-02 server-side overturn. Description hygiene in autopilot.ts removes a misleading tab_id reference; agents.ts back tool already met the Pass condition. Full npm test green; Phase 246 ships.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-05-06T22:44:15Z
- **Completed:** 2026-05-06T22:51:20Z
- **Tasks:** 5 (4 atomic commits, Task 5 is verification-only)
- **Files modified:** 4 (1 created test, 1 source description fix, 2 extended tests + package.json)

## Accomplishments

- **tools-definitions-parity test (Task 1) -- closes Pitfall 2 permanently.** New `tests/tool-definitions-parity.test.js` asserts byte-identity between `extension/ai/tool-definitions.js` and `mcp/ai/tool-definitions.cjs` via `Buffer.compare`. The test also sanity-checks Phase 246 schema additions: 6 read tools each have optional `tab_id` (Plan 01 Task 6); `open_tab.active` is `boolean default false` (Plan 01 Task 5 + D-05); 35 action tools each have optional `tab_id` (Plan 02 Task 4). 130 PASS lines on a single run; npm test chain extended to include this file. Any future schema bump that lands in only one file (the canonical Pitfall 2 failure mode) now surfaces here BEFORE shipping.
- **Multi-agent regression scenarios A/B/C/D (Task 2) -- Phase 246 surface composition coverage.** 4 new cases appended to `tests/multi-agent-regression.test.js`:
  - **Case 7 (Scenario A):** Two MCP agents each own one tab. Agent A's read with NO `tab_id` resolves to A's tab (1100); B's tab (1101) is NOT touched. Cross-agent explicit `tab_id` (A passing B's tab id) passes the resolver with `skipGate:false` -- the dispatch gate is the layer that rejects (D-16; verified separately in ownership-error-codes.test.js).
  - **Case 8 (Scenario B):** legacy:popup binds T_user=1200; user switches active tab to T_other=1201 (NOT bound to legacy:popup). Resolver returns 1201 with `skipGate:true`; the action dispatch composition demonstrates that `routeParams.tabId` is NOT set when `skipGate:true` (D-15 preserves legacy UX byte-for-byte).
  - **Case 9 (Scenario C):** Single MCP agent calls `open_tab` without `active`. `chrome.tabs.create` is invoked with `active:false` (D-05 background default); `bindTab(agentId, newTabId)` fires; response includes `ownershipToken` (D-08 preserved). End-to-end through `dispatchMcpToolRoute` with a real registry instance.
  - **Case 10 (Scenario D):** Single MCP agent owns 2 tabs. `resolver(agentId, {})` returns the AMBIGUOUS_TAB envelope `{success:false, code:'AMBIGUOUS_TAB', agentId, tabIds:[1300, 1301]}`. Caller retries with `{ tab_id: 1300 }` and the resolver returns `{tabId: 1300, skipGate: false}`.
  - All 10 cases (6 existing + 4 new) GREEN.
- **read-only.ts agentId threading test cases (Task 3) -- Phase 246 D-02 server-side overturn now under regression coverage.** 2 new test functions appended to `tests/agent-id-threading.test.js`:
  - **Case A (`testReadOnlyAgentIdThreading`):** Loads built `mcp/build/tools/read-only.js`, registers via `registerReadOnlyTools(harness.server, harness.bridge, harness.queue, agentScope)`, calls `read_page({})` (no tab_id). Asserts the bridge sees exactly 1 `mcp:read-page` message AND its `payload.agentId` equals `agent_test_smoke` (the harness-minted deterministic value).
  - **Case B (`testReadOnlyTabIdForwarded`):** Same setup, calls `read_page({ tab_id: 42 })`. Asserts `payload.tab_id === 42` AND `payload.agentId` is still threaded (Phase 246 D-02 messageBuilder spreads `p.tab_id` when defined).
  - Refactored existing manual.ts navigate test into `testManualNavigateAgentIdThreading()` so all 3 test functions share the existing `passed`/`failed` counters cleanly.
  - Added `tests/agent-id-threading.test.js` to the npm test chain (it was previously NOT in `package.json:test`).
  - 14/14 PASS (5 manual + 4 read-only Case A + 5 read-only Case B).
- **MCP description hygiene (Task 4).** Pre-grep results determined the per-file decision:
  - `mcp/src/tools/agents.ts` `back` tool description already contained `Multi-agent contract` (1 occurrence) -- **NO-DIFF outcome (Pass condition met)**. No edit written.
  - `mcp/src/tools/autopilot.ts` `run_task` description contained `tab_id is agent-scoped: only tabs owned by the calling agent can be addressed.` -- but `run_task`'s Zod schema only declares `{ task: z.string() }` (no `tab_id`). The description falsely advertised an unsupported parameter. **REMOVAL outcome (REGRESSION condition triggered)**: removed the misleading sentence so the description matches the actual schema. `grep -c "tab_id" mcp/src/tools/autopilot.ts` now returns 0 (was 1).
  - mcp build green; npm test green.
- **Phase gate verified (Task 5).** All 11 Phase 246 test files exit 0 individually; `npm test` exits 0 across the full 60+ test suite; `diff -q extension/ai/tool-definitions.js mcp/ai/tool-definitions.cjs` returns no output (byte-identical); `npm --prefix mcp run build` exits 0. All 16 Phase 246 must-haves cross-checked.

## Task Commits

Each task was committed atomically (per-task `--no-verify` per parallel-execution policy):

1. **Task 1: Add tool-definitions-parity test (closes Pitfall 2)** -- `67415d1` (test)
2. **Task 2: Extend multi-agent-regression with 4 Phase 246 scenarios** -- `4b670b5` (test)
3. **Task 3: Extend agent-id-threading with 2 read-only.ts cases** -- `dd4a213` (test)
4. **Task 4: Remove tab_id reference from run_task description** -- `f4dec30` (fix)
5. **Task 5: Final phase gate verification** -- (verification-only; no commit)

## Files Created/Modified

**Created:**

- `tests/tool-definitions-parity.test.js` -- byte-identity check via Buffer.compare; sanity-checks 6 read tools (tab_id), open_tab.active boolean default false, and 35 action tools (tab_id). 130 PASS lines.

**Modified:**

- `tests/multi-agent-regression.test.js` -- 4 new test cases (7-10) covering Phase 246 scenarios A/B/C/D. Inline `installChromeWithCreate` helper for Scenario C (chrome.tabs.create capture). Existing 6 cases unchanged.
- `tests/agent-id-threading.test.js` -- 2 new test functions (`testReadOnlyAgentIdThreading`, `testReadOnlyTabIdForwarded`) appended after the existing manual.ts navigate test (refactored into `testManualNavigateAgentIdThreading()`).
- `package.json` -- npm test chain extended with `tests/tool-definitions-parity.test.js` and `tests/agent-id-threading.test.js`.
- `mcp/src/tools/autopilot.ts` -- removed misleading `tab_id is agent-scoped: only tabs owned by the calling agent can be addressed.` sentence from the `run_task` description (single-line diff; description otherwise unchanged).

## Decisions Made

- **agents.ts back tool: NO-DIFF (Pass).** Per Plan 03 Task 4 Step 1's Pass condition, when the description already contains `Multi-agent contract` (which line 33 of agents.ts does), no edit is required. The acceptance criteria allow either a NO-DIFF outcome OR an APPEND outcome with the regex `\bagent-scoped tabs\b`. Since the existing description is consistent with the Phase 246 contract and does not falsely advertise unsupported parameters, NO-DIFF is the correct decision. Adding `agent-scoped tabs` text would be cosmetic, not corrective.
- **autopilot.ts run_task: REMOVAL (REGRESSION).** The pre-existing description contained a misleading `tab_id is agent-scoped...` sentence. run_task's Zod schema is `{ task: z.string() }` -- no tab_id. The description contradicted the schema. Per Plan 03 Task 4 Step 2's REMOVAL outcome, removed the offending sentence. Did NOT add `agent-scoped tabs` text either (run_task is the legacy:autopilot agent; its tab semantics are documented separately).
- **Scenario C uses an inline `installChromeWithCreate` helper.** The shared `installChromeMock` fixture's tabs mock has `query`/`get` only; adding `create` would be a fixture-level change. Plan 03 prefers surgical additions, so the helper is local to multi-agent-regression.test.js. The helper also adds `update` (returns first tab) defensively in case the dispatcher wraps create with an update; it is unused in Scenario C but does not interfere.
- **Scenario A's cross-agent explicit tab_id assertion.** Plan 03 Task 2 calls out that the resolver does NOT reject when an agent passes another agent's tab_id; the gate is the layer that rejects. The Scenario A case includes this assertion explicitly to ensure the resolver/gate split is observable. Cross-agent enforcement is verified separately in `tests/ownership-error-codes.test.js` D-16 cases.
- **agent-id-threading.test.js npm test chain enrollment.** The plan's <action> step 3 said "Update package.json test script to include tests/agent-id-threading.test.js if not already present." It was NOT in the chain (Plan 01/02 did not add it; the file pre-dates Phase 246 from Phase 238). Added it after `tests/tool-definitions-parity.test.js` in Task 3's commit.

## Deviations from Plan

**Worktree branch base correction at start.** The orchestrator's `<worktree_branch_check>` block specified expected base `05d8c96efefcdda0f9002cea20fcaa26cf0c2718` (Plan 02 Task 7 tip). The worktree HEAD was `c60c186` (a merge commit on the `Refinements` branch from PR #22). Plan 01/02 commits were NOT in the merge-base. Reset hard to `05d8c96` per the protocol; all 14 prior commits (Plan 01: 7739066..20a5cfa, Plan 02: 3ebb71f..05d8c96) became visible. All 4 Plan 03 task commits land cleanly atop the corrected base.

**Plan-specified output of `246-PHASE-SUMMARY.md` deferred to orchestrator.** The plan's `<output>` block calls for both a `246-03-SUMMARY.md` AND a `246-PHASE-SUMMARY.md` (the overall phase summary across all 16 D-XX decisions). Per the orchestrator's worktree prompt: `Do NOT update STATE.md or ROADMAP.md -- the orchestrator owns those writes after all worktree agents in the wave complete.` The phase-level summary is orchestrator scope (it spans 3 plans and updates STATE.md + ROADMAP.md). This SUMMARY.md focuses on the per-plan deliverables Plan 03 itself shipped.

**Schema sanity check broadened from plan's "minimum 50+ PASS lines" to 130 actual PASS lines.** Plan 03 Task 1's acceptance criteria asked for at least 50 PASS lines covering byte-identity + 6 read tools + open_tab + 35 action tools. The implemented test produces 130 PASS lines (2 file existence + 1 byte-identity + 18 read tool checks (6*3) + 4 open_tab checks + 105 action tool checks (35*3)) -- exceeds the minimum by a wide margin and gives diagnostic specificity if any individual schema dimension regresses.

## Issues Encountered

- **Worktree base mismatch at start (recoverable).** Initial `git log` showed Plan 01/02 commits were not in HEAD's history. Per the worktree protocol, ran `git reset --hard 05d8c96` to align with the expected base. Working tree was clean before the reset, so no work was lost. All 4 task commits land atop the corrected base.
- **`mcp/dist` vs `mcp/build` path inconsistency in plan text.** Plan 03 Task 3's read-first list mentioned `mcp/dist/tools/read-only.js`; the actual TypeScript output directory is `mcp/build/`. Followed the established harness convention (`loadBuildModule` in `mcp-smoke-harness.js` resolves under `mcp/build/`) and verified the file exists at `mcp/build/tools/read-only.js`. This matches Plan 02's similar observation in its SUMMARY.
- **No emojis introduced; no regressions on existing v0.9.36/v0.9.50/v0.9.60 contracts.** All scans clean.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **Phase 246 ships.** All 16 phase must-haves verified. 11 Phase 246 test files exit 0 individually; full npm test exits 0 across the 60+ suite.
- **Phase-level summary (246-PHASE-SUMMARY.md) is orchestrator scope.** The 16 D-XX decisions across 3 plans are tracked in this and the prior two SUMMARY.md files; the orchestrator can compose them.
- **STATE.md / ROADMAP.md updates are orchestrator scope** per the worktree prompt directive.
- **No blockers; no carry-forward debt.**

## Self-Check: PASSED

- 1 new test file exists: FOUND tests/tool-definitions-parity.test.js
- 4 task commits exist:
  - FOUND 67415d1 (Task 1)
  - FOUND 4b670b5 (Task 2)
  - FOUND dd4a213 (Task 3)
  - FOUND f4dec30 (Task 4)
- All 11 Phase 246 test files green (T01-T11): PASS
- tool-definitions byte-identical: PASS (`diff -q` returns no output)
- mcp build green: PASS (`npm --prefix mcp run build` exits 0)
- npm test green: PASS (60+ tests; 0 failures)
- read-only.ts no `void agentScope`: PASS (count 0)
- vault.ts no `void agentScope`: PASS (count 0)
- schema-bridge.ts 5x `p.tab_id !== undefined`: PASS (count 5)
- agents.ts contains `Multi-agent contract`: PASS (count 1)
- autopilot.ts has 0 `tab_id` references: PASS (count 0)
- open_tab line 921 reads `active: params.active === true`: PASS
- resolver helper exists: FOUND extension/utils/agent-tab-resolver.js
- _handleExecuteAction et al. use resolveAgentTabOrError: PASS (10 occurrences in mcp-bridge-client.js)
- handleStartVisualSessionRoute uses resolveAgentTabOrError: PASS (4 occurrences in mcp-tool-dispatcher.js)
- No emojis introduced: PASS

---
*Phase: 246-agent-scoped-tab-resolution-background-default*
*Plan: 03*
*Completed: 2026-05-06*
