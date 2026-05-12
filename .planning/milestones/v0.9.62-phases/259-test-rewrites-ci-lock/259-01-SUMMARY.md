---
phase: 259
plan: 01
subsystem: tests/mcp-visual-session
tags:
  - test-rewrite
  - mcp
  - visual-session
  - implicit-contract
  - tool-removed
  - ci-lock
  - v0.9.62
requirements_completed:
  - TEST-01
  - TEST-02
  - TEST-05
dependency_graph:
  requires:
    - 255-04 (visual-session-schema-lock test -- recording-mock pattern reuse)
    - 256-04 (mcp-visual-tick-lifecycle test -- createChromeMock pattern reuse)
    - 256-03 (extension/utils/mcp-visual-session-lifecycle.js -- the v0.9.62 namespace under test in Case 2 / Case 4)
    - 258-01 (mcp/src/tools/visual-session.ts TOOL_REMOVED stubs + mcp/src/errors.ts typed error -- the runtime surface under test in Case 5)
  provides:
    - End-to-end v0.9.62 implicit contract test locked into the CI chain
    - TOOL_REMOVED contract test for both removed tool names (start_visual_session, end_visual_session)
    - Defense-in-depth assertion for cross-agent recordVisualSessionTick rejection
    - Persistence replay assertion against the mcpVisualSession:<tabId> namespace (Phase 256 module)
  affects:
    - 259-02 (coverage confirmation -- may add per-tool enumeration if 255-04 sampling proves insufficient)
    - 260 (skill USAGE.md / references rewrites)
tech_stack:
  added: []
  patterns:
    - Recording-mock counters that explicitly assert "no bridge.sendAndWait call" and "no queue.enqueue call" on rejection paths
    - createChromeMock + chrome.storage.session + chrome.alarms in-memory fakes
    - Re-require pattern with require.cache invalidation so the lifecycle module rebinds against fresh globals per case
    - Dynamic import of mcp/build/tools/*.js ESM build artifacts from CJS test scaffolding
key_files:
  created:
    - .planning/phases/259-test-rewrites-ci-lock/259-01-SUMMARY.md
  modified:
    - tests/mcp-visual-session-contract.test.js
decisions:
  - "Rewrite in place rather than rename/split. The file name stays as the contract surface for the v0.9.62 milestone (v0.9.62 is a refinement of the v0.9.0/v0.9.36 contract, not a different concept), and historical CI cross-references continue to resolve."
  - "Case 4 (ownership precedence) DOWNSCOPED to the lifecycle module's recordVisualSessionTick rather than the full _handleExecuteAction dispatcher. The dispatcher path depends on resolveAgentTabOrError, dispatchMcpToolRoute, wrapWithChangeReport, and a live AgentRegistry instance -- harnessing those for a unit test would multiply the surface area without adding coverage beyond what Case 4's defense-in-depth assertion already locks. The plan's <constraints> block explicitly allowed this downscope when the seam requires excessive boilerplate."
  - "Recording-mock bridge.sendAndWait signature mirrors the production envelope shape from mcp/build/agent-bridge.js sendAgentScopedBridgeMessage (bridge.sendAndWait({ type, payload }, sendOptions)). Initial mock used a 2-arg shape (type, payload); fixed inline to the envelope shape before commit (mid-execution debugging, not a deviation)."
  - "Each case's chrome mock is set up fresh and torn down in a try/finally block that restores the prior globals (chrome, MCPVisualSessionUtils, sendSessionStatus). This isolates Case 2 and Case 4 from leaking state into each other or into the parent test runner."
  - "Case 1 keeps the EXISTING surface-level assertions (allowlist + manager) but drops the heavy v0.9.36 explicit-lifecycle assertions (lifecycle state machine, finalSuccessState, animatedHighlights, taskSummary). The v0.9.62 contract is implicit -- those state transitions are now driven by the lifecycle module (covered exhaustively by tests/mcp-visual-tick-lifecycle.test.js), not the manager class. Case 1's role is to lock the SHARED allowlist surface that both layers still consume."
metrics:
  duration_seconds: 720
  duration_human: "12m"
  tasks_completed: 1
  tasks_total: 1
  files_modified: 1
  files_created: 1
  commit_count: 1
  completed_at: "2026-05-11T20:24:00Z"
---

# Phase 259 Plan 01: Rewrite mcp-visual-session-contract for v0.9.62 Implicit Contract Summary

Rewrite `tests/mcp-visual-session-contract.test.js` end-to-end for the v0.9.62 implicit visual-session contract. The pre-v0.9.62 file (690 lines, 4 cases) targeted the explicit `start_visual_session` / `end_visual_session` flow that Phase 258 converted to `TOOL_REMOVED` stubs; the rewritten file (684 lines, 5 cases) locks the new implicit contract end-to-end plus the removal layer. Lands TEST-01 (end-to-end rewrite), TEST-02 (TOOL_REMOVED case), and TEST-05 (CI lock).

## What Shipped

### Single file rewrite -- tests/mcp-visual-session-contract.test.js

Five named cases driven from a single async runner. Each case is self-contained (own chrome mock when needed, own try/finally global-restore block, own recording-mock counters).

**Case 1: runAllowlistAndManagerCase (KEPT, trimmed)**

Locks the surface of the shared v0.9.36 badge allowlist module that the v0.9.62 contract still reuses verbatim. Assertions cover:

- `MCP_VISUAL_CLIENT_LABELS` is an array with the canonical 12 labels (loose count: at least 12, includes Claude / Codex / Gemini / ChatGPT).
- `normalizeMcpVisualClientLabel` handles case folding (`claude` -> `Claude`, `CLAUDE` -> `Claude`), whitespace folding (` codex ` -> `Codex`), embedded-space tolerance (`chat gpt` -> `ChatGPT`), and rejects unknowns / empties / null / undefined.
- `isAllowedMcpVisualClientLabel` is the boolean wrapper around the normalizer.
- `getAllowedMcpVisualClientLabels` returns a defensive copy (different reference each call; mutating the returned array does not poison module state).
- `McpVisualSessionManager.startSession` / `getTokenForTab` / `endSession` still works for the v0.9.36 manager surface (the kept side of the API; the v0.9.62 contract drives separate lifecycle code).
- Overlay state derivation: running status -> lifecycle running; clear status -> lifecycle cleared.

Dropped from the pre-v0.9.62 case: the heavy v0.9.36 explicit-lifecycle state-machine sweeps (progress state, finalSuccessState, animatedHighlights, taskSummary, replaced-session displacement). Those transitions are now owned by `extension/utils/mcp-visual-session-lifecycle.js` and covered exhaustively by `tests/mcp-visual-tick-lifecycle.test.js` (12 cases, 79+ assertions). Keeping them in this file would duplicate that coverage.

**Case 2: runPersistenceReplayCase (REWRITTEN to v0.9.62 namespace)**

Locks the SW-eviction replay against the new `mcpVisualSession:<tabId>` per-tab namespace (Phase 256 lifecycle module), replacing the v0.9.36 `fsbMcpVisualSessions` single-key bag.

- Asserts the module's exported prefixes / TTL constants pin the v0.9.62 contract: `MCP_VISUAL_LIFECYCLE_STORAGE_KEY_PREFIX === 'mcpVisualSession:'`, `MCP_VISUAL_LIFECYCLE_ALARM_PREFIX === 'mcpVisualDeath:'`, `MCP_VISUAL_LIFECYCLE_DEATH_MS === 60000`.
- Seeds two per-tab entries: one live (`deadlineAt = now + 55000`) and one stale (`deadlineAt = now - 60000`).
- Calls `restoreVisualSessionLifecyclesFromStorage()` and asserts: `{ ok: true, restored: 1, cleared: 1 }`.
- Live entry: storage row preserved with `deadlineAt` UNCHANGED (TIMEOUT-04: the sliding window survives SW eviction; deadlineAt is not silently reset on wake); `mcpVisualDeath:201` alarm re-armed with `when === original deadlineAt`.
- Stale entry: storage row removed; no `mcpVisualDeath:202` alarm created (immediate-clear path, not rearm).

Run as part of the CONTRACT suite for traceability even though `tests/mcp-visual-tick-lifecycle.test.js` Case F covers similar ground -- the contract suite's role is end-to-end coverage of the v0.9.62 surface, lifecycle test's role is unit-level state-machine sweeping.

**Case 3: runImplicitDispatcherValidationCase (NEW; replaces v0.9.0 explicit dispatcher case)**

Loads `mcp/build/tools/manual.js` `registerManualTools` and exercises the dispatch chokepoint with a recording-mock `bridge` + `queue` + `agentScope`. Six sub-cases:

- 3.A: `click({ selector })` (no visual fields) -> isError: true, no bridge / queue call, body mentions "visual" (VISUAL_FIELDS_REQUIRED routing).
- 3.B: `click({ selector, visual_reason })` (no client) -> isError: true, no bridge / queue call, body mentions "visual".
- 3.C: `click({ selector, visual_reason: '', client: 'Claude' })` -> isError: true, no bridge / queue call (empty-string visual_reason is rejected per the validator's `.trim().length > 0` check).
- 3.D: `click({ selector, visual_reason, client: 'NotARealClient' })` -> isError: true, no bridge / queue call, body echoes the offending label "NotARealClient" (BADGE_NOT_ALLOWED routing).
- 3.E: `click({ selector, visual_reason: 'Submitting form', client: 'Claude' })` -> NOT isError, exactly one bridge.sendAndWait call with envelope shape `{ type: 'mcp:execute-action', payload: { tool, params, visualSession, agentId, ... } }`. Sidecar contract:
  - `payload.visualSession.visualReason === 'Submitting form'`
  - `payload.visualSession.client === 'Claude'` (canonical form)
  - `payload.visualSession.isFinal === false` (default)
  - `payload.params.visual_reason / client / is_final` all `undefined` (stripped from forwarded action params)
- 3.F: `click({ ..., is_final: true })` -> NOT isError, sidecar `isFinal === true` forwarded.

The recording-mock signature mirrors the production envelope from `mcp/build/agent-bridge.js sendAgentScopedBridgeMessage`: `bridge.sendAndWait({ type, payload }, sendOptions)`.

**Case 4: runOwnershipPrecedenceCase (NEW; replaces Phase 240 ownership-aware case)**

DOWNSCOPED per plan clause to the lifecycle module's `recordVisualSessionTick` (defense-in-depth dual of the v0.9.60 dispatcher-level `TAB_NOT_OWNED` gate). Eight sub-assertions:

- Agent A claims tab 300 with a valid bundle -> `ok: true, action: 'created'`.
- Pre-intrusion snapshot: storage `agentId=agent_A`, `client=Claude`, `visualReason='Logging in'`.
- Agent B (different agentId) attempts an action on tab 300 with a valid bundle -> `ok: false, reason: 'agent_mismatch'`.
- Post-intrusion snapshot: storage `agentId`, `client`, `visualReason`, `lastTickAt`, `deadlineAt` ALL preserved (no version bump, no rotation, no state mutation).
- No overlay broadcast for the rejected intruder tick.
- Agent A can still record a follow-up tick on tab 300 after the rejection -> `ok: true, action: 'updated'`, `lastTickAt` advanced, `visualReason` refreshed (sliding re-arm works on the owning agent's subsequent ticks even after a cross-agent attempt).

**Case 5: runToolRemovedCase (NEW)**

Loads `mcp/build/tools/visual-session.js` `registerVisualSessionTools` and invokes both removed handlers via the recording server. Both branches assert:

- Handler is registered (so `tools/list` still advertises the name with the `[REMOVED in v0.9.0]` banner).
- Response is the typed `TOOL_REMOVED` envelope with `isError: true`.
- No bridge.sendAndWait call, no queue.enqueue call (synchronous short-circuit before queue / bridge per Phase 258 stub design).
- Response body names the removed tool literal (`start_visual_session` or `end_visual_session`).
- Response body cites `0.9.0` (the `removed_in_version` value).
- Response body references the v0.9.62 implicit-contract fields: `visual_reason`, `client`, `is_final`.
- Response body references both migration-recipe anchors: `CHANGELOG` and `README`.
- Response body carries the "Visual session contract" layer label (rather than a generic "tool not found" surface).

## Cases Before vs After

| Case | Pre-v0.9.62 | Post-v0.9.62 (this rewrite) |
|------|-------------|-----------------------------|
| 1 | `runAllowlistAndManagerCase` -- allowlist + manager + overlay lifecycle (heavy) | **KEPT (trimmed)** -- allowlist surface + manager lifecycle smoke (drops the explicit-lifecycle state machine coverage now owned by `tests/mcp-visual-tick-lifecycle.test.js`) |
| 2 | `runPersistenceReplayCase` -- replay against v0.9.36 `fsbMcpVisualSessions` single-key bag, serialize / restore / planMcpVisualSessionReplay | **REWRITTEN** -- replay against the v0.9.62 `mcpVisualSession:<tabId>` per-tab namespace via `restoreVisualSessionLifecyclesFromStorage` |
| 3 | `runDispatcherValidationCases` -- explicit start_visual_session / end_visual_session dispatcher (~290 lines) | **REPLACED** -- `runImplicitDispatcherValidationCase` exercises `registerManualTools` action-tool validator against `click` (VISUAL_FIELDS_REQUIRED + BADGE_NOT_ALLOWED + sidecar forwarding) |
| 4 | `runPhase240OwnershipAwareStartSessionCases` -- Phase 240 explicit start_session ownership with full AgentRegistry harness | **REPLACED** -- `runOwnershipPrecedenceCase` cross-agent `recordVisualSessionTick` rejection (defense-in-depth dual at the lifecycle layer; downscoped from full dispatcher path per plan clause) |
| 5 | (none) | **NEW** -- `runToolRemovedCase` both removed tool names return TOOL_REMOVED envelope with migration recipe anchors |

## Assertion Counts

- Pre-v0.9.62 file: ~109 assertions across 4 cases (approximate, counted from the original `assert*` calls in lines 40-690 of the deleted file).
- Post-v0.9.62 file: **116 assertions** across 5 cases (exact, counted from PASS lines on the green run).

Net delta: +7 assertions, +1 case (TOOL_REMOVED), -2 cases (explicit-flow validation + Phase 240 ownership-aware start_session), +1 case (implicit dispatcher validation), +1 case (ownership precedence at the lifecycle layer), +0 cases (allowlist kept, persistence replay rewritten in place).

## Test Exit Codes

| Invocation | Exit code | PASS / FAIL |
|------------|-----------|-------------|
| `node tests/mcp-visual-session-contract.test.js` | **0** | 116 PASS, 0 FAIL |
| `npm test` (full chain from repo root) | **0** | Entire chain green, zero failures across all suites |

## Grep-Verifiable Acceptance Criteria

All criteria from the plan's `<verify>` block passed:

| Criterion | Result |
|-----------|--------|
| File contains literal `VISUAL_FIELDS_REQUIRED` | 7 matches |
| File contains literal `BADGE_NOT_ALLOWED` | 5 matches |
| File contains literal `TOOL_REMOVED` | 7 matches |
| File contains literal `visual_reason` | 19 matches |
| File contains literal `client` (as a token, not regex'd here) | many matches across all 5 cases |
| File contains literal `is_final` | 7 matches |
| File does NOT contain `start_visual_session.*returns session` | 0 matches (negative grep) |
| `node tests/mcp-visual-session-contract.test.js` exits 0 | Confirmed |
| `npm test` exits 0 | Confirmed |
| File has at least 5 distinct case functions | Confirmed: `runAllowlistAndManagerCase`, `runPersistenceReplayCase`, `runImplicitDispatcherValidationCase`, `runOwnershipPrecedenceCase`, `runToolRemovedCase` |
| File is at least 400 lines | Confirmed: 684 lines |

## Commit Details

- **Hash:** `9e3dd82`
- **Branch:** `refinements`
- **Subject:** `test(259-01): rewrite mcp-visual-session-contract for v0.9.62 implicit contract + TOOL_REMOVED (TEST-01, TEST-02, TEST-05)`
- **Files changed:** 1 file changed, 591 insertions(+), 597 deletions(-)

## Deviations from Plan

One downscope applied per the plan's explicit `<constraints>` block clause:

### [Plan-sanctioned downscope] runOwnershipPrecedenceCase scoped to the lifecycle module

- **Found during:** Task 1 planning -- evaluating the dispatcher seam for Case 4.
- **Issue:** Wiring the full `_handleExecuteAction` dispatcher (`extension/ws/mcp-bridge-client.js` lines 664-804) into a unit test would require harnessing `resolveAgentTabOrError` (line 731), `dispatchMcpToolRoute` (line 838), `wrapWithChangeReport` (lines 696, 784), the `AgentRegistry` singleton (`globalThis.fsbAgentRegistryInstance`), and the change-report dispatcher's full code-path. The boilerplate would dwarf the assertion surface.
- **Fix:** Downscoped Case 4 to a direct unit test against `recordVisualSessionTick` (the defense-in-depth dual at the lifecycle layer). The dispatcher-level `TAB_NOT_OWNED` gate is the primary defense; the lifecycle layer is the second layer that protects state if a future caller-bypass surface emerges. The downscope locks the SECOND layer; the first layer is locked by separate `agent-tab-resolver.test.js` / `action-tool-agent-scoped.test.js` test suites already in the CI chain.
- **Files modified:** `tests/mcp-visual-session-contract.test.js` (Case 4 implementation).
- **Plan clause cited:** `<constraints>` block: "If during execution you discover that the existing dispatcher / bridge surfaces don't have a clean unit-test seam (mocking would require excessive boilerplate), DOWNSCOPE the runOwnershipPrecedenceCase to a recording-mock at the lifecycle-module level (testing that recordVisualSessionTick rejects cross-agent calls -- the Phase 256 lifecycle module already implements this defense-in-depth)."

No other deviations. No new architectural changes, no new typed errors, no version bump. Phase 259 Plan 01 is test-only, runtime is locked from Phase 258.

### Mid-execution bug (not a deviation -- fixed inline)

The initial recording-mock `bridge.sendAndWait` used a 2-arg `(type, payload)` signature; the production `sendAgentScopedBridgeMessage` calls `bridge.sendAndWait({ type, payload }, sendOptions)` with an envelope object. The initial green-path assertion fired a TypeError. Fixed inline (envelope shape) before commit; subsequent assertions on `bridgeCall.type` and `bridgeCall.payload` then matched the production envelope. Not a deviation -- a debugging step caught by the test scaffolding itself.

## Known Stubs

None new. The TOOL_REMOVED handlers exercised in Case 5 are intentional stubs from Phase 258 (the typed-rejection surface for the removed tool names); their behaviour is the deliverable.

## Threat Flags

None. Phase 259 Plan 01 is test-only. No new runtime surface introduced.

## Files

- **Modified:** `tests/mcp-visual-session-contract.test.js` (net -6 lines: deleted 5 obsolete cases + heavy v0.9.36 explicit-lifecycle assertions; added 5 v0.9.62 cases + recording-mock counters + sidecar contract assertions + TOOL_REMOVED migration-recipe assertions; the trimmed Case 1 + reworked Case 2 land at 116 PASS lines total)
- **Created:** `.planning/phases/259-test-rewrites-ci-lock/259-01-SUMMARY.md` (this file)

## Self-Check: PASSED

- `tests/mcp-visual-session-contract.test.js` exists with 5 case functions: FOUND.
- File contains literal `VISUAL_FIELDS_REQUIRED`: FOUND (7 matches).
- File contains literal `BADGE_NOT_ALLOWED`: FOUND (5 matches).
- File contains literal `TOOL_REMOVED`: FOUND (7 matches).
- File contains literal `visual_reason`: FOUND (19 matches).
- File contains literal `is_final`: FOUND (7 matches).
- File does NOT contain `start_visual_session.*returns session`: FOUND 0 matches (negative grep passes).
- `node tests/mcp-visual-session-contract.test.js` exit code: 0.
- `npm test` exit code: 0.
- Commit `9e3dd82` on branch `refinements`: FOUND via `git log --oneline -1` (subject prefix `test(259-01): rewrite mcp-visual-session-contract`).
- All plan-level success criteria from the `<success_criteria>` block of `259-01-PLAN.md`: met.
