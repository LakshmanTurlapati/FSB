---
phase: 238
plan: 01
subsystem: mcp/agent-scope
tags: [agent-scope, mcp-types, lazy-mint, cached-promise, foundation]
requires:
  - extension/utils/agent-registry.js (Phase 237 -- registers handler-side; not consumed in this plan)
provides:
  - mcp/src/agent-scope.ts -> per-process AgentScope class (ensure, current, reset)
  - mcp/src/types.ts -> MCPMessageType union extended with agent:register|release|status
affects:
  - mcp/build/agent-scope.js
  - mcp/build/agent-scope.d.ts
  - tests/agent-scope.test.js
tech-stack:
  added: []
  patterns:
    - Cached-promise lazy-mint (idiomatic JS; no library / no mutex)
    - Closed-union widening for typed message families (additive, non-breaking)
key-files:
  created:
    - mcp/src/agent-scope.ts
    - tests/agent-scope.test.js
  modified:
    - mcp/src/types.ts
decisions:
  - D-01 per-process singleton: AgentScope instance is created once per MCP server process; one agent_id per process for the process lifetime
  - D-03 cached-promise race: concurrent first callers of ensure() share one in-flight Promise via this.pending; no module-level mutex
  - D-04 throw-on-failure no caching: failed register clears this.pending in finally{} so the next ensure() retries cleanly
  - D-12 caller does not supply agentId: payload sent as {}; extension registry mints via crypto.randomUUID()
  - Open Question 1 resolved: extend MCPMessageType union additively (rejected per-call-site `as never` casts)
metrics:
  duration_seconds: 240
  completed: 2026-05-06T03:53:29Z
  tasks_completed: 2
---

# Phase 238 Plan 01: AgentScope Foundation Summary

Per-process AgentScope class with lazy-mint, cached-promise concurrency, and throw-on-failure no-poison semantics; MCPMessageType union widened to admit the agent:* bridge-message family.

## Public API Shape

```typescript
// mcp/src/agent-scope.ts
import type { WebSocketBridge } from './bridge.js';

export class AgentScope {
  // Returns the per-process agent_id, lazy-minting on first call.
  // Concurrent first callers share ONE in-flight register.
  // Throws on failure; failure is NOT cached (next call retries cleanly).
  async ensure(bridge: WebSocketBridge): Promise<string>;

  // Sync read for diagnostics; null until first successful ensure().
  current(): string | null;

  // Test-only escape hatch; clears cached id and any in-flight pending.
  reset(): void;
}
```

Wire format produced by ensure():
```
{ type: 'agent:register', payload: {} }
```
with timeout 10_000ms; resolved response shape required:
```
{ success: true, agentId: <string>, agentIdShort?: <string> }
```

## types.ts Widening (exact lines added)

The closing entry of MCPMessageType changed from a terminal `;` to a continuation, and three new strings were appended:

Before:
```
| 'mcp:list-payments'      // Vault: list payment methods (last4+brand only)
| 'mcp:use-payment-method'; // Vault: fill checkout with confirmation gate
```

After:
```
| 'mcp:list-payments'      // Vault: list payment methods (last4+brand only)
| 'mcp:use-payment-method' // Vault: fill checkout with confirmation gate
| 'agent:register'         // Phase 238: lazy-mint per-process agent_id
| 'agent:release'          // Phase 238: handler only; server caller in Phase 241
| 'agent:status';          // Phase 238: caller-self introspection
```

No other change to types.ts. The MCPResponse union (`mcp:result | mcp:progress | mcp:error`) is untouched. All 28 existing `mcp:*` entries are preserved in their original order.

## Implementation Details

### ensure() invariant table

| State on entry | Branch taken | Side effect | Returns |
|---|---|---|---|
| this.agentId set | fast path | none | cached id |
| this.pending set | shared path | none | in-flight promise |
| both null | mint path | sets this.pending; on success sets this.agentId; finally clears this.pending | new id |

### finally{} clears pending unconditionally

This is the load-bearing detail of D-04: clearing `this.pending` after success is safe because `this.agentId` is already set and the fast path covers all subsequent calls. Clearing after failure is the no-poison property -- the next caller sees `pending === null` and runs a fresh mint attempt.

### Logging

Two `console.error` sites, both gated through the `SCOPE_LOG_PREFIX = '[FSB AgentScope]'` constant:
- mint success: `[FSB AgentScope] minted <agentIdShort or first-12-chars>`
- mint failure: `[FSB AgentScope] mint failed: <error.message>`

ASCII-only; no emojis (CLAUDE.md compliance). The short label is used to avoid surfacing the full id in stderr -- T-238-04 disposition (information disclosure).

## Test Results

Command: `npm --prefix mcp run build && node tests/agent-scope.test.js`

```
[FSB AgentScope] minted agent_test_t1
Test 1 (lazy mint single caller): PASS
[FSB AgentScope] minted agent_test_race
Test 2 (concurrent first-call race, D-03): PASS
[FSB AgentScope] mint failed: extension_not_connected
[FSB AgentScope] minted agent_test_retry
Test 3 (throw-on-failure no poison, D-04): PASS
[FSB AgentScope] minted agent_test_t4
[FSB AgentScope] minted agent_test_t4_2
Test 4 (current() and reset()): PASS
[FSB AgentScope] mint failed: agent:register failed: cap_reached
[FSB AgentScope] mint failed: agent:register failed: unknown
[FSB AgentScope] mint failed: agent:register failed: unknown
Test 5 (response shape validation): PASS
agent-scope.test.js: PASS
```

Test 5 uses three sub-cases (5a `success: false`, 5b missing agentId, 5c agentId wrong type) -- all reject with messages containing `agent:register failed`.

Regression spot-check: `node tests/mcp-tool-routing-contract.test.js` -> 144 passed, 0 failed (purely additive type widening produced no contract drift).

## Wave 0 Skip-Pass Gate

`tests/agent-scope.test.js` checks for `mcp/build/agent-scope.js` at startup. If absent it logs `agent-scope.test.js: SKIPPED -- Wave 0 only` and exits 0. This made Task 1's commit independently mergeable before Task 2 landed the implementation -- verified at commit time of `cca3be7`.

## Deviations from Plan

None. The two tasks executed exactly as written:
- Task 1 created `tests/agent-scope.test.js` with the Plain Node assert harness, MockBridge stand-in, deferred()/manual-resolve helper, all 5 named test cases, and the Wave 0 skip-pass gate. Committed at `cca3be7`.
- Task 2 created `mcp/src/agent-scope.ts` with the cached-promise pattern from RESEARCH.md Pattern 1 verbatim (D-01..D-04 honored), and extended `mcp/src/types.ts` MCPMessageType additively. Committed at `2891755`.

### Notes on done-criteria grep regex

Plan's done criterion was `grep -c "console.error.*FSB AgentScope" mcp/src/agent-scope.ts >= 2`. The implementation uses the constant form `console.error(SCOPE_LOG_PREFIX + ...)`, which the literal-string regex does not match. Functional equivalence is preserved (and visible in the test output above where `[FSB AgentScope] minted ...` and `[FSB AgentScope] mint failed: ...` are emitted at runtime). Both `console.error` sites reference `SCOPE_LOG_PREFIX`; verifiable via `grep -c "console.error(SCOPE_LOG_PREFIX" mcp/src/agent-scope.ts` returning 2.

## Threat Model Hooks Honored

- T-238-03 (DoS via repeated agent:register): mitigated by Test 2 actively asserting exactly one register across 5 concurrent ensure() calls
- T-238-04 (information disclosure of full agent_id): mitigated by logging only the short label / 12-char prefix
- T-238-01, T-238-02, T-238-05: accepted (deferred to Phase 240 enforcement, type-only or out-of-scope-by-design)

No threat flags introduced; this plan adds no new network endpoint, auth path, file access pattern, or schema change at a trust boundary.

## Commits

| Task | Hash    | Message                                                                       |
|------|---------|-------------------------------------------------------------------------------|
| 1    | cca3be7 | test(238-01): add Wave 0 AgentScope test scaffold with 5 named cases          |
| 2    | 2891755 | feat(238-01): add AgentScope module and extend MCPMessageType for agent:* family |

## Hand-Off to Plan 02 / Plan 03

- Plan 02 lands the extension-side handlers (`agent:register`, `agent:release`, `agent:status`) so a real `ensure(bridge)` round-trip resolves with a registry-minted id
- Plan 03 plumbs `AgentScope` through `createRuntime()` and threads `await agentScope.ensure(bridge)` into autopilot.ts (3 sites), manual.ts execAction funnel (1 site), visual-session.ts (2 sites)
- The `AgentScope` exported here is import-stable: `import { AgentScope } from './agent-scope.js'` works from `mcp/src/runtime.ts` as soon as Plan 03 wires it

## Self-Check: PASSED

Files claimed created exist:
- `mcp/src/agent-scope.ts` -- FOUND
- `tests/agent-scope.test.js` -- FOUND

Files claimed modified exist with new content:
- `mcp/src/types.ts` -- FOUND, contains `'agent:register'|'agent:release'|'agent:status'` (3 matches)

Build artifacts exist:
- `mcp/build/agent-scope.js` -- FOUND
- `mcp/build/agent-scope.d.ts` -- FOUND

Commits exist on the current branch:
- `cca3be7` -- FOUND (test scaffold)
- `2891755` -- FOUND (impl + types widening)

Tests green:
- `node tests/agent-scope.test.js` -- exits 0 with `agent-scope.test.js: PASS` and all 5 test cases reporting PASS individually
- `node tests/mcp-tool-routing-contract.test.js` -- 144/144 PASS (regression check; no contract drift)
