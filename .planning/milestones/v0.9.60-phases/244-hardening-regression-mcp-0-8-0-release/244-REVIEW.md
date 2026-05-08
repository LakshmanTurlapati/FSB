---
phase: 244-hardening-regression-mcp-0-8-0-release
reviewed: 2026-05-05T00:00:00Z
depth: standard
files_reviewed: 12
files_reviewed_list:
  - tests/multi-agent-regression.test.js
  - tests/fixtures/multi-agent-regression-helpers.js
  - mcp/src/tools/agents.ts
  - mcp/src/tools/autopilot.ts
  - mcp/src/tools/manual.ts
  - mcp/src/tools/visual-session.ts
  - mcp/package.json
  - mcp/server.json
  - mcp/src/version.ts
  - mcp/CHANGELOG.md
  - mcp/README.md
  - extension/ai/tool-definitions.js
findings:
  critical: 0
  warning: 1
  info: 4
  total: 5
status: issues_found
---

# Phase 244: Code Review Report

**Reviewed:** 2026-05-05
**Depth:** standard
**Files Reviewed:** 12
**Status:** issues_found

## Summary

Phase 244 lands the v0.9.60 multi-agent regression suite (6 cases), MCP tool description rewrites, dependency bump to `@modelcontextprotocol/sdk` ^1.29.0, and the version triple-bump to 0.8.0. The regression suite runs green (6/6 PASS verified during review) and the focus-area validation produces the following picture:

- Tab-ID-reuse race (Case 6) DOES exercise the `ownershipToken` mismatch as the load-bearing assertion -- the `(B, tokA) -> false` permutation at line 401-402 is the corruption gate. The four-permutation matrix (A+tokA, A+tokB, B+tokA, B+tokB) is well-constructed.
- The 20-concurrent claim stress (Case 5) IS truly concurrent: `Promise.all(promises)` at line 295 with all 20 `registerAgent()` calls created synchronously into a single array first, then awaited as one batch. Atomicity is asserted via `withRegistryLock`-driven exact 8 successes / 12 typed rejects.
- SW eviction simulation (Case 4) drops both `_agents` AND `_tabMetadata` via `_resetForTests` (extension/utils/agent-registry.js:1342-1358 clears `_agents`, `_tabOwners`, `_tabsByAgent`, `_tabMetadata`, and any staged-release timers). `hydrate()` restores from `chrome.storage.session` and the assertion at line 269-275 confirms the persisted envelope itself is pruned (durable, not just in-memory).
- All three version surfaces agree on `0.8.0`: `mcp/package.json:3`, `mcp/server.json:6` (and the nested `packages[0].version:11`), and `mcp/src/version.ts:2`.
- CHANGELOG covers every Phase 237-243 work item with explicit phase citations (registry foundation 237, AgentScope wiring 238, run_task return-on-completion 239, ownership gate 240, pooling/cap/grace 241, back tool 242, BG audit + UI 243). No phase is missing.
- README's `What's New In v0.8.0` and `Multi-Agent Contract (v0.8.0)` sections cover the four typed error codes, the cap mechanics, ownership tokens, lock release, sw_evicted recovery, the back tool, and heartbeat. A reader coming in cold can wire up the v0.8.0 contract from the README alone.

The findings below are quality concerns, not contract or correctness defects.

## Warnings

### WR-01: README Tools tables omit the new `back` tool

**File:** `mcp/README.md:386-401`
**Issue:** The new `back` MCP tool registered in `mcp/src/tools/agents.ts:22-62` is described at length in the `### back tool` subsection (line 360-368) and in the CHANGELOG, but it is NOT listed in any of the tool tables under `## Tools (59 Total)`. The Autopilot table (line 386-391) lists `run_task`, `stop_task`, `get_task_status`. `back` is functionally a navigation tool; the Manual Browser Control "Navigation" row (line 398) lists `navigate, search, go_back, go_forward, refresh` -- but not `back` (which is the new ownership-gated single-step replacement for `execute_js("history.back()")`). A reader scanning the table for "what tools can I call" will miss it. The "59 Total" count in the heading also predates `back` and is now off by one.
**Fix:** Add `back` to the Autopilot table or to a Navigation/History row, and increment the count to 60. Suggested patch (Autopilot table):
```markdown
### Autopilot (4)

| Tool | Purpose |
|------|---------|
| `run_task` | Let FSB's AI perform a natural language browser task end to end. |
| `stop_task` | Cancel the active automation task. |
| `get_task_status` | Check task progress, phase, and ETA. |
| `back` | Single-step browser-history back, ownership-gated. Returns `{ status, resultingUrl, historyDepth }`. |
```
And update the heading + ToC anchor at line 376 / line 20 from `59 Total` to `60 Total`.

## Info

### IN-01: Case 4 cannot independently verify `simulateSwEviction` drops `_tabMetadata`

**File:** `tests/multi-agent-regression.test.js:236-244`
**Issue:** Case 4 constructs a brand-new `AgentRegistry` whose Maps are already empty, then calls `simulateSwEviction(reg)`. The test comment (line 240-243) acknowledges this: "simulateSwEviction is a no-op in this case (the Maps are already empty), but we exercise the helper to lock its contract." The helper relies entirely on `_resetForTests` -- so if a future refactor of `_resetForTests` stops clearing `_tabMetadata`, this test would not catch it. The 5-record persisted envelope drives the actual reconciliation assertions; `simulateSwEviction` itself is exercised but not behaviourally validated.
**Fix:** Either (a) populate the registry from the envelope first (call `hydrate()`, then `simulateSwEviction`, then `hydrate()` again, asserting the second hydration sees empty Maps before reconciliation rebuilds them), or (b) add a dedicated micro-test that registers an agent, binds a tab, then calls `simulateSwEviction` and asserts both `_agents.size === 0` AND `_tabMetadata.size === 0`. Option (b) is the smaller diff:
```javascript
test('test_case_4b_simulateSwEviction_clears_tabMetadata', async () => {
  const mock = installChromeMock({ tabs: [{ id: 200 }] });
  setupDiagnosticCapture();
  try {
    const fresh = freshRequireRegistry();
    const reg = new fresh.AgentRegistry();
    reg.setCap(8);
    const r = await reg.registerAgent();
    await reg.bindTab(r.agentId, 200);
    assert.strictEqual(reg._tabMetadata.size, 1, 'metadata populated pre-eviction');
    simulateSwEviction(reg);
    assert.strictEqual(reg._agents.size, 0, '_agents cleared');
    assert.strictEqual(reg._tabMetadata.size, 0, '_tabMetadata cleared');
  } finally { teardownDiagnosticCapture(); mock.restore(); }
});
```

### IN-02: Case 3 relies on three sequential `await Promise.resolve()` calls to drain microtasks

**File:** `tests/multi-agent-regression.test.js:186-188`
**Issue:** After advancing the virtual clock by 60_000ms, the test does `await Promise.resolve(); await Promise.resolve(); await Promise.resolve();` to drain microtasks before asserting the 8 agents were swept. This is fragile: if the staged-release implementation later inserts an additional async hop (e.g. an extra `withRegistryLock` reacquisition), the count of microtask turns required will change and this test will silently flake. The comment explains the reasoning, but the magic number `3` is not derived from any documented contract.
**Fix:** Replace with a polling helper that waits for the observable post-condition rather than counting microtask turns:
```javascript
async function waitFor(predicate, maxTurns) {
  const cap = maxTurns || 50;
  for (let i = 0; i < cap; i++) {
    if (predicate()) return;
    await Promise.resolve();
  }
  throw new Error('waitFor: predicate did not settle within ' + cap + ' microtask turns');
}
// then:
clock.advance(60000);
await waitFor(function() { return reg._agents.size === 1; });
```

### IN-03: Tool-description multi-agent contract block is duplicated verbatim across 5+ tools

**File:** `mcp/src/tools/agents.ts:24`, `mcp/src/tools/autopilot.ts:23`, `mcp/src/tools/visual-session.ts:36`, `mcp/src/tools/visual-session.ts:90`, `extension/ai/tool-definitions.js` (50 tool descriptions each carry a shorter version of the boilerplate)
**Issue:** The phrase "Multi-agent contract: agent_id is FSB-issued and required (the server captures it via agent:register on first tool call -- callers do not provide it). tab_id is agent-scoped: only tabs owned by the calling agent can be addressed. The concurrency cap is configurable (default 8, range 1-64); the (N+1)th agent claim is rejected with AGENT_CAP_REACHED { cap, active }. Ownership enforcement: cross-agent calls reject with TAB_NOT_OWNED; incognito tabs reject with TAB_INCOGNITO_NOT_SUPPORTED; cross-window tabs reject with TAB_OUT_OF_SCOPE." appears verbatim in autopilot.ts, visual-session.ts (twice), and agents.ts (back tool). If the contract changes (e.g. a new error code), every site must be updated by hand. There is no shared constant.
**Fix:** Hoist the contract paragraph into a shared constant in `mcp/src/tools/multi-agent-contract.ts` and concatenate it into each description at registration time:
```typescript
// mcp/src/tools/multi-agent-contract.ts
export const MULTI_AGENT_CONTRACT_DESCRIPTION =
  'Multi-agent contract: agent_id is FSB-issued and required ...';
```
Then in each tool: `'Tool-specific description. ' + MULTI_AGENT_CONTRACT_DESCRIPTION`. This is mechanical and avoids drift. The same idea applies to the 50 shorter "Multi-agent: agent-scoped tabs; cross-agent reject with TAB_NOT_OWNED; cap configurable (default 8, 1-64)." blocks in `extension/ai/tool-definitions.js` -- a single constant referenced by template literal.

### IN-04: `recycleTabId` helper captures `priorToken` via `getTabMetadata` but the contract is never asserted in the helper itself

**File:** `tests/fixtures/multi-agent-regression-helpers.js:50-69`
**Issue:** `recycleTabId` returns `{ priorToken, rebind }`. The contract is "priorToken reflects the tab's ownershipToken before release". Case 6 asserts `recycle.priorToken === tokA` (line 364-365), which is the consumer's contract test, but the helper itself does no defensive assertion. If a future change to `getTabMetadata` returns a different shape (e.g. nested under a `meta` key), the helper would silently return `undefined` for `priorToken` and the test would fail with a less-specific message ("expected undefined to equal 'abc'"). A `console.error` or `throw` on the helper boundary makes the failure mode louder.
**Fix:** Add a defensive guard at line 55 that documents the precondition:
```javascript
if (priorMeta && priorMeta.ownershipToken === undefined) {
  // Loud failure: a metadata row exists but lacks ownershipToken --
  // signals a getTabMetadata contract change.
  throw new Error('recycleTabId: getTabMetadata returned a row without ownershipToken; helper contract violated');
}
```
Optional. The tests will catch the regression either way; this just improves the failure message.

---

_Reviewed: 2026-05-05_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
