---
phase: 238
plan: 02
subsystem: agentscope-bridge-wiring
tags: [bridge-routes, agent-identity, d-14-destructure, d-09, d-10, d-12, d-16-preserved, tdd, parallel-wave-1]
requires:
  - extension/utils/agent-registry.js (Phase 237 plan 01+02; AgentRegistry class with registerAgent/releaseAgent/getAgentTabs)
  - extension/background.js (Phase 237 plan 03; globalThis.fsbAgentRegistryInstance singleton + bootstrapAgentRegistry boot site)
  - extension/utils/mcp-visual-session.js (D-16 byte-for-byte invariant reference; NOT modified)
provides:
  - extension/ws/mcp-tool-dispatcher.js (3 new agent:* route entries + 3 new handler functions + module.exports surface)
  - extension/ws/mcp-bridge-client.js (D-14 destructure in 2 helper-routed handlers per Open Question 2)
  - tests/agent-bridge-routes.test.js (Wave 0 scaffold; 6 named cases / 27 assertions exercising D-09 / D-10 / D-12)
affects:
  - MCP_PHASE199_MESSAGE_ROUTES table (additive: agent:register, agent:release, agent:status; "agent" routeFamily)
  - 15 dispatcher handlers (read-but-don't-act destructure of payload.agentId or params.agentId)
  - 2 bridge-client helpers (_handleReadPage, _handleGetDOM; same destructure)
  - npm test chain (no new entry; agent-bridge-routes.test.js wired separately if needed by orchestrator)
tech-stack:
  added: []
  patterns:
    - Bridge route handler shape mirroring existing handleStartAutomationRoute / handleEndVisualSessionRoute
    - Defensive lazy-reference pattern for globalThis.FsbAgentRegistry.formatAgentIdForDisplay
    - "Read-but-don't-act" destructure with literal comment string + void agentId; (greppable audit anchor)
    - Zero-arg handler signature widening to ({ payload } = {}) (B2 resolution; backwards-compatible default)
key-files:
  created:
    - tests/agent-bridge-routes.test.js
    - .planning/phases/238-agentscope-bridge-wiring/238-02-SUMMARY.md
    - .planning/phases/238-agentscope-bridge-wiring/deferred-items.md
  modified:
    - extension/ws/mcp-tool-dispatcher.js (+67/-4 lines; route table + 3 handlers + 15 destructures + module.exports)
    - extension/ws/mcp-bridge-client.js (+6 lines; 2 helper destructures)
decisions:
  - "Honor D-12: handleAgentRegisterRoute calls registry.registerAgent() with ZERO arguments. Test 1 grep-asserts mockRegistry.calls.registerAgent[0].length === 0 (W8) — caller-supplied agentId is provably ignored."
  - "Honor D-09: handleAgentReleaseRoute requires payload.agentId; reason defaults to 'mcp-explicit'. Defensive against the boolean-vs-object return shape from registry.releaseAgent (Phase 237 returns boolean; future may return { released, releasedTabIds })."
  - "Honor D-10: handleAgentStatusRoute returns EXACTLY 4 keys (success, agentId, agentIdShort, tabIds). Test 5 asserts Object.keys(response).sort().join(',') === 'agentId,agentIdShort,success,tabIds' — no full registry snapshot, no cross-agent leakage."
  - "Honor Pitfall 1: all three new handlers resolve through globalThis.fsbAgentRegistryInstance (5 references in dispatcher); the wrong handle globalThis.agentRegistry is NEVER used (grep confirms zero matches against the wrong-handle pattern)."
  - "Honor B2 (Open Question 2): D-14 destructure for ReadPage and GetDomSnapshot lands in extension/ws/mcp-bridge-client.js where their bodies actually live, NOT in mcp-tool-dispatcher.js."
  - "Honor B2 widening: handleExecuteJsRoute and handleGetStatusRoute previously had zero-arg signatures; widened additively to ({ payload } = {}) so the destructure pattern is uniform across all 15 dispatcher handlers and the grep gate is honest."
  - "Honor D-15: no proactive audit beyond destructure. The 4 task-status handlers (Report/Complete/Partial/Fail) had ({ params })-shaped signatures; extended additively to ({ params, payload }) so they can read agentId from the payload that dispatchMcpToolRoute already passes them — no behavior change to params consumers."
  - "Honor D-16: extension/utils/mcp-visual-session.js byte-for-byte unchanged (verified `git diff` returns 0 lines)."
metrics:
  duration: ~25 minutes
  completed: 2026-05-05
  tasks: 3
  files-touched: 4 (incl. new test file + deferred-items)
  commits: 3
---

# Phase 238 Plan 02: Bridge Routes + D-14 Destructure Summary

Added the three `agent:register` / `agent:release` / `agent:status` bridge routes that resolve through the Phase 237 registry, plus the D-14 read-but-don't-act `agentId` destructure across 15 dispatcher handlers and 2 bridge-client helpers, with the visual-session manager byte-for-byte preserved (D-16). Pre-stages the Phase 240 enforcement diff to a single check per handler.

## What Was Built

Three contributions, all flowing through three files:

1. **Three new bridge routes** in `MCP_PHASE199_MESSAGE_ROUTES` (extension/ws/mcp-tool-dispatcher.js:67-71). Route family `'agent'` — additive to the existing 16 entries; no reorder, no rename.

2. **Three new handler functions** placed immediately before `handleStartAutomationRoute`:
   - `handleAgentRegisterRoute` (line 670) — calls `reg.registerAgent()` with zero args; emits `[FSB MCP Dispatcher] agent:register minted <short>` log; returns `{ success, agentId, agentIdShort }`.
   - `handleAgentReleaseRoute` (line 686) — requires `payload.agentId`; reason defaults to `'mcp-explicit'`; returns `{ success: true, released }`. Missing-id path returns `createMcpInvalidParamsError`.
   - `handleAgentStatusRoute` (line 703) — caller-self-only; returns the 4-key shape `{ success, agentId, agentIdShort, tabIds }`. Missing-id path returns invalid-params. NO full-registry snapshot, NO cross-agent leakage.

3. **D-14 destructure across 17 affected handlers** — every body gains `const { agentId } = payload || {};` (or `params || {}` where the signature is params-shaped), the literal comment `// Phase 240 will validate agent_id; Phase 238 deliberately ignores it.`, and `void agentId;`.

## Exact Line Ranges (Task → File:Line)

### Task 2 (extension/ws/mcp-tool-dispatcher.js)

| What | Line(s) | Notes |
|------|---------|-------|
| `agent:register` route entry | 68 | new |
| `agent:release` route entry | 69 | new |
| `agent:status` route entry | 70 | new |
| `handleAgentRegisterRoute` | 670–684 | new function |
| `handleAgentReleaseRoute` | 686–701 | new function |
| `handleAgentStatusRoute` | 703–717 | new function |
| module.exports `handleAgentRegisterRoute` | 1136 | new export line |
| module.exports `handleAgentReleaseRoute` | 1137 | new export line |
| module.exports `handleAgentStatusRoute` | 1138 | new export line |

### Task 3 (extension/ws/mcp-tool-dispatcher.js — D-14 destructures)

| Handler | Signature | Source obj | Comment line | Total lines added |
|---------|-----------|------------|--------------|-------------------|
| handleNavigateRoute | `({ params, client })` (unchanged) | `params` | 297 | 3 |
| handleNavigationHistoryRoute | `({ tool, params, client })` (unchanged) | `params` | 323 | 3 |
| handleOpenTabRoute | `({ params })` (unchanged) | `params` | 359 | 3 |
| handleSwitchTabRoute | `({ params })` (unchanged) | `params` | 372 | 3 |
| handleListTabsRoute | `({ params })` (unchanged) | `params` | 398 | 3 |
| handleExecuteJsRoute | `({ payload } = {})` **WIDENED (B2)** | `payload` | 424 | 4 (incl. signature change) |
| handleStartVisualSessionRoute | `({ payload, client })` (unchanged) | `payload` | 591 | 3 |
| handleEndVisualSessionRoute | `({ payload })` (unchanged) | `payload` | 648 | 3 |
| handleStartAutomationRoute | `({ payload, client })` (unchanged) | `payload` | 721 | 3 |
| handleStopAutomationRoute | `({ payload, client })` (unchanged) | `payload` | 745 | 3 |
| handleGetStatusRoute | `({ payload } = {})` **WIDENED (B2)** | `payload` | 791 | 4 (incl. signature change) |
| handleReportProgressRoute | `({ params, payload })` **EXTENDED** | `payload` | 1053 | 4 (incl. signature change) |
| handleCompleteTaskRoute | `({ params, payload })` **EXTENDED** | `payload` | 1084 | 4 (incl. signature change) |
| handlePartialTaskRoute | `({ params, payload })` **EXTENDED** | `payload` | 1111 | 4 (incl. signature change) |
| handleFailTaskRoute | `({ params, payload })` **EXTENDED** | `payload` | 1153 | 4 (incl. signature change) |

### Task 3 (extension/ws/mcp-bridge-client.js — Open Question 2 resolution)

| Helper | Method body line | Comment line |
|--------|------------------|--------------|
| `_handleGetDOM` | 437–448 | 439 |
| `_handleReadPage` | 450–461 | 452 |

## Why Some Handlers Use `params` and Others Use `payload`

Per the plan's behavior section ("use the source object that matches its signature"):

- **Pure `params`-shaped handlers** (5 navigation/tab routes registered via `MCP_PHASE199_TOOL_ROUTES`): destructure from `params`. The dispatcher passes `params` as the agentId carrier when the tool is invoked from `dispatchMcpToolRoute`.
- **Pure `payload`-shaped handlers** (4 native message-route handlers + 2 widened zero-arg handlers): destructure from `payload`. The dispatcher passes `payload` from `dispatchMcpMessageRoute`.
- **Task-status handlers (4 of them)** were originally `({ params })`-shaped but `dispatchMcpToolRoute` already passes both `params` AND `payload` (line 123: `route.handler({ tool, params: params || {}, client, tab, payload, route })`). Task 3 extended their signatures additively to `({ params, payload })` and reads `agentId` from `payload`. This is consistent with the W8 grep target ("at least 10 payload-shaped" — 4 native + 2 widened + 4 task-status = 10) and keeps the Phase 240 diff uniform.

Final destructure tally:
- `const { agentId } = payload || {};` — 10 occurrences (4 native + 2 widened + 4 task-status)
- `const { agentId } = params || {};` — 5 occurrences (the 5 navigation/tab handlers)
- Sum = 15, exactly the D-14 dispatcher list.
- Plus 2 in `extension/ws/mcp-bridge-client.js` (Open Question 2 resolution: ReadPage + GetDomSnapshot).
- Total **17 audit-greppable destructure sites** across the two files.

## D-16 Byte-for-Byte Preservation Verification

```
$ git diff extension/utils/mcp-visual-session.js | wc -l
0
```

The visual-session manager file is unchanged. v0.9.36 contract tests pass byte-for-byte against the existing implementation.

## Open Question 2 Resolution (RESEARCH §Assumptions A5)

The plan's RESEARCH document called out Open Question 2: should the D-14 destructure for `mcp:read-page` and `mcp:get-dom` land in `mcp-tool-dispatcher.js` or `mcp-bridge-client.js`? Resolution: in `mcp-bridge-client.js`, where the bodies actually live. The dispatcher's route table for these two routes uses `helperName: '_handleReadPage'` / `'_handleGetDOM'` (lines 53–54), and the dispatcher delegates to `client[route.helperName]` at line 150. There is no handler function in the dispatcher to attach the destructure to. Plan 02 Task 3 inserts the destructure into both helper bodies in `mcp-bridge-client.js` (lines 438–440 for `_handleGetDOM`, 451–453 for `_handleReadPage`). Phase 240 will read `agentId` from these same locations for ownership checks.

## Test Coverage Matrix (tests/agent-bridge-routes.test.js)

| Test # | Validates | Requirement | Assertions |
|--------|-----------|-------------|------------|
| 1 | D-12: register handler ignores caller-supplied agentId; calls registerAgent() with **ZERO** arguments | AGENT-04 closure / T-238-06 | 6 (W8 zero-arg gate included) |
| 2 | Registry-unavailable path returns errorCode `agent_registry_unavailable` | defensive | 3 |
| 3 | D-09: release handler happy path with explicit reason | T-238-07 | 5 |
| 4 | release handler missing agentId → invalid-params error | -- | 3 |
| 5 | D-10: status handler caller-self-only; EXACT 4-key shape; no leakage | T-238-09 | 7 |
| 6 | status handler missing agentId → invalid-params error | -- | 3 |

**27 assertions / 6 named cases — all PASS.**

## Auto-Fixed Issues (Rule 1)

**1. [Rule 1 — Test bug] Test 1 hardcoded agentIdShort prefix did not match formatAgentIdForDisplay output.**
- **Found during:** Task 2 first run (`node tests/agent-bridge-routes.test.js` failed 1/27 in Test 1).
- **Issue:** Test 1 originally asserted `response.agentIdShort === 'agent_fresh'` (11 chars), but the formatter slices to 12 chars yielding `'agent_fresh-'` for the mock id `'agent_fresh-server-mint'`.
- **Fix:** Replaced the hardcoded literal with `'agent_fresh-server-mint'.slice(0, 12)` so the assertion matches the formatter's actual output.
- **Files modified:** `tests/agent-bridge-routes.test.js`
- **Commit:** rolled into `0bf4ed5` (Task 2 commit; covers test-side fix + handler implementation in one TDD-GREEN landing).

## Verification Evidence

```
$ node tests/agent-bridge-routes.test.js
... 27 PASS ...
=== Results: 27 passed, 0 failed ===
agent-bridge-routes.test.js: PASS

$ node tests/mcp-tool-routing-contract.test.js
=== Results: 144 passed, 0 failed ===

$ node tests/mcp-visual-session-contract.test.js
=== Results: 93 passed, 0 failed ===

$ node tests/agent-registry.test.js
All assertions passed.

$ git diff extension/utils/mcp-visual-session.js
(empty — D-16 byte-for-byte preserved)

$ grep -c "Phase 240 will validate agent_id; Phase 238 deliberately ignores it." extension/ws/mcp-tool-dispatcher.js
15

$ grep -c "Phase 240 will validate agent_id; Phase 238 deliberately ignores it." extension/ws/mcp-bridge-client.js
2

$ grep -c "void agentId;" extension/ws/mcp-tool-dispatcher.js
15

$ grep -c "void agentId;" extension/ws/mcp-bridge-client.js
2

$ grep -c "globalThis.fsbAgentRegistryInstance" extension/ws/mcp-tool-dispatcher.js
5

$ grep "globalThis\.agentRegistry[^I]" extension/ws/mcp-tool-dispatcher.js
(no output — Pitfall 1 handle is the right one)

$ grep -c "^async function handleExecuteJsRoute({ payload } = {})" extension/ws/mcp-tool-dispatcher.js
1

$ grep -c "^async function handleGetStatusRoute({ payload } = {})" extension/ws/mcp-tool-dispatcher.js
1

$ grep -c "const { agentId } = payload || {};" extension/ws/mcp-tool-dispatcher.js
10

$ grep -c "const { agentId } = params || {};" extension/ws/mcp-tool-dispatcher.js
5

# Sum: 10 + 5 = 15 — exactly the D-14 dispatcher count.

$ perl -CSDA -ne 'print if /[\x{1F300}-\x{1FAFF}]/' extension/ws/mcp-tool-dispatcher.js extension/ws/mcp-bridge-client.js tests/agent-bridge-routes.test.js
(no output — no emojis)

$ node --check extension/ws/mcp-tool-dispatcher.js
(exit 0)

$ node --check extension/ws/mcp-bridge-client.js
(exit 0)
```

## Commits

| Task | Commit | Message |
|------|--------|---------|
| Task 1 | `e048b63` | `test(238-02): add Wave 0 test scaffold for agent:* bridge routes` |
| Task 2 | `0bf4ed5` | `feat(238-02): add agent:register, agent:release, agent:status bridge routes` |
| Task 3 | `9dfb20d` | `feat(238-02): D-14 read-but-don't-act agentId destructure across 15+2 handlers` |

## Deviations from Plan

Three minor deviations, all documented and justified:

1. **`releaseAgent` return-shape defensive coding (Rule 1).** The plan's `<interfaces>` block claimed `releaseAgent` returns `{ released, releasedTabIds }`, but Phase 237's actual implementation returns a plain `boolean` (verified at `extension/utils/agent-registry.js:237-256`). The handler accepts both shapes via `(result === true) || !!(result && result.released)` so the test mock and the live registry both produce `{ success: true, released: true }`. The plan's example code would have produced `released: false` against the live registry; the defensive form is correct.

2. **Task-status handlers extended to `({ params, payload })` instead of staying `({ params })` (W8 alignment).** The plan's B2 list classifies these 4 handlers as payload-shaped (and the W8 grep gate expects ≥10 payload destructures). Their current signatures destructure `params`, but `dispatchMcpToolRoute` (line 123) already passes both `params` AND `payload` to them. Extending the signature to `({ params, payload })` is purely additive — `params` consumers see no change — and lets the destructure read `agentId` from the payload field where Phase 240 will validate it. Net result: 10 payload-shaped + 5 params-shaped = 15 total, exactly matching the D-14 list.

3. **Test 1 hardcoded prefix corrected (Rule 1).** Documented in the "Auto-Fixed Issues" section above. Test bug, not a behavior bug; landed inside the same Task 2 commit as the handler implementation.

The intentional plan adherence (D-09 / D-10 / D-12 / D-15 / D-16 / Pitfall 1 / Open Question 2) was followed verbatim.

## Pre-conditions Plan 03 Needs

Plan 03 (server-side AgentScope + register*Tools threading + agentId on the wire) needs:

1. **Three live extension-side handlers.** Plan 02 ships them. AgentScope's `ensure()` will call `bridge.sendAndWait({ type: 'agent:register', payload: {} })` and the dispatcher resolves it through `globalThis.fsbAgentRegistryInstance.registerAgent()`.

2. **D-14 destructure already in place.** Plan 02 ships this. When Plan 03 starts threading `agentId` into every `mcp:execute-action` / `mcp:start-automation` / etc. payload, the existing destructures already read it (silently); Phase 240 will be a one-line check per handler instead of a destructure + check.

3. **D-16 invariant honored.** Plan 02 leaves `extension/utils/mcp-visual-session.js` byte-for-byte. Plan 03 must continue this until Phase 240 OWN-04.

## Pre-existing failure (out of scope)

`tests/mcp-recovery-messaging.test.js` fails on the worktree base because `mcp/build/errors.js` is absent (the mcp module is not built). Verified pre-existing via `git stash && node tests/mcp-recovery-messaging.test.js` (failed identically before any of my changes). Documented in `.planning/phases/238-agentscope-bridge-wiring/deferred-items.md`. Not in scope for Plan 02 (server-side build belongs to Plan 03 territory).

## Known Stubs

None. Plan 02 is the extension-side wiring step; no new stubs introduced. The new dispatcher handlers are fully functional against the Phase 237 registry. The D-14 destructures are deliberate inert reads (`void agentId;`) — these are NOT stubs but the explicit Phase 238 contract per D-14 / D-15.

## Self-Check: PASSED

- `tests/agent-bridge-routes.test.js`: FOUND (269 lines, 27 PASS / 0 FAIL)
- `extension/ws/mcp-tool-dispatcher.js`: 1102 → 1146 lines (verified via wc -l); +44 net lines for routes + handlers + 15 destructures + module.exports
- `extension/ws/mcp-bridge-client.js`: 1000 → 1006 lines; +6 lines for the 2 helper destructures
- `extension/utils/mcp-visual-session.js`: byte-for-byte unchanged (`git diff` empty)
- 3 commits in `git log --oneline`: `e048b63`, `0bf4ed5`, `9dfb20d`
- `node tests/agent-bridge-routes.test.js` exits 0 with `agent-bridge-routes.test.js: PASS`
- `node tests/mcp-tool-routing-contract.test.js` exits 0 (144/0)
- `node tests/mcp-visual-session-contract.test.js` exits 0 (93/0)
- `node tests/agent-registry.test.js` exits 0 (Phase 237 surface untouched)
- `node --check extension/ws/mcp-tool-dispatcher.js` exits 0 (parses cleanly)
- `node --check extension/ws/mcp-bridge-client.js` exits 0 (parses cleanly)
- All grep gates verified above: `grep -c "globalThis.fsbAgentRegistryInstance" → 5`, `grep "globalThis\.agentRegistry[^I]" → 0 lines`, `grep -c "Phase 240 will validate agent_id; Phase 238 deliberately ignores it." → 15+2`, `grep -c "void agentId;" → 15+2`, payload+params destructure sum = 15.
- B2 verified: both zero-arg handlers (`handleExecuteJsRoute`, `handleGetStatusRoute`) widened to `({ payload } = {})`.
- No emojis in any modified file (verified by perl character-class grep).
- D-12 invariant unit-tested with explicit zero-arg gate: `mockRegistry.calls.registerAgent[0].length === 0`.
- D-10 caller-self-only scope unit-tested with exact-4-key shape gate: `Object.keys(response).sort().join(',') === 'agentId,agentIdShort,success,tabIds'`.
- Open Question 2 resolved: ReadPage + GetDomSnapshot destructures landed in `extension/ws/mcp-bridge-client.js` (the file where their bodies live), not in dispatcher.
