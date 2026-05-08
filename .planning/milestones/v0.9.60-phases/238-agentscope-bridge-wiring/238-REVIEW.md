---
phase: 238-agentscope-bridge-wiring
reviewed: 2026-05-05T00:00:00Z
depth: standard
files_reviewed: 17
files_reviewed_list:
  - extension/ws/mcp-bridge-client.js
  - extension/ws/mcp-tool-dispatcher.js
  - mcp/src/agent-scope.ts
  - mcp/src/runtime.ts
  - mcp/src/tools/agents.ts
  - mcp/src/tools/autopilot.ts
  - mcp/src/tools/manual.ts
  - mcp/src/tools/observability.ts
  - mcp/src/tools/read-only.ts
  - mcp/src/tools/vault.ts
  - mcp/src/tools/visual-session.ts
  - mcp/src/types.ts
  - tests/agent-bridge-routes.test.js
  - tests/agent-id-threading.test.js
  - tests/agent-scope.test.js
  - tests/mcp-smoke-harness.js
  - tests/mcp-tool-smoke.test.js
findings:
  critical: 0
  warning: 2
  info: 4
  total: 6
status: issues_found
---

# Phase 238: Code Review Report

**Reviewed:** 2026-05-05
**Depth:** standard
**Files Reviewed:** 17
**Status:** issues_found

## Summary

Phase 238 introduces a per-process `AgentScope` on the MCP server side that lazy-mints
an `agent_id` via a new `agent:register` bridge round-trip, threads `agent_id` at the
top level of every `bridge.sendAndWait` payload from the three mutation surfaces
(autopilot, manual, visual-session), and adds three extension-side dispatcher
handlers (`agent:register`, `agent:release`, `agent:status`).

The implementation is tight: D-01 singleton lifetime, D-03 cached-promise race control,
D-04 no-poison failure handling, D-05 top-level field placement, D-06 scope discipline,
and D-12 mint-from-server are all visibly enforced and covered by tests. The extension
client correctly accepts `agentId` as a no-op via `void agentId;` per the Phase 238
deliberately-non-enforcing contract.

The findings below are quality observations and one data-flow concern that would
matter once Phase 240 trips the enforcement gate. None are blockers for Phase 238.

## Warnings

### WR-01: agent-scope `pending` cleared in finally before agentId is observable

**File:** `mcp/src/agent-scope.ts:33-63`
**Issue:** The IIFE's `finally` block sets `this.pending = null` after `try` completes,
but it does so AFTER `this.agentId = minted` has executed in the success path. That
ordering is correct. However, the awaited continuation that set `agentId` runs in the
same microtask as the finally, so concurrent awaiters that resumed via the original
`return this.pending` slot have already received the value -- they are unaffected.

The subtle risk is for callers who race between `if (this.agentId) return this.agentId;`
and `if (this.pending) return this.pending;`: if a new caller arrives during the
microtask gap between `agentId = minted` and `pending = null`, both checks would now
match and the fast path takes precedence. That is the intended behavior, but worth
flagging because the comment in `finally` describes the failure-path reasoning only.

This is not a bug; it is a documentation gap. Consider adding a one-line comment to
the success arm noting that `this.agentId` is set inside the IIFE (not after `await`)
so the cached-promise return path remains semantically equivalent to the fast-path
return.

**Fix:**
```typescript
this.agentId = minted;  // set before finally; subsequent ensure() calls hit fast path
console.error(SCOPE_LOG_PREFIX + ' minted ' + shortLabel);
return minted;
```
(Add a brief comment; no functional change.)

### WR-02: `agentId` typed as `unknown` on receive side; runtime read is forgiving

**File:** `extension/ws/mcp-bridge-client.js:438-440, 451-453` and `extension/ws/mcp-tool-dispatcher.js:296-298, 322-324, 358-360, 371-373, 397-399, 422-426, 590-592, 647-649, 720-722, 744-746, 790-792, 1052-1054, 1083-1085, 1110-1112, 1152-1154`
**Issue:** Every handler that touches `agentId` extracts it via destructuring then no-ops with `void agentId;`. Phase 240 will enforce. The current code reads `agentId` from `payload || {}` or `params || {}`, but since Phase 240 will validate at every dispatch boundary, the v0 sentinel pattern would benefit from a single shared helper rather than 16 duplicated 3-line stanzas.

When Phase 240 lands, every one of these 16 sites must change in lockstep. A
single-source helper (e.g. `extractAgentId(payload)` returning the value plus a
deferred validator stub) would reduce churn and the chance of one site being missed.
This is forward-looking maintainability; not a current correctness issue.

**Fix:**
```javascript
// Add at top of mcp-tool-dispatcher.js
function consumeAgentIdSentinel(input) {
  // Phase 240 will validate; Phase 238 is structural setup only.
  const _ignored = input && input.agentId;
  void _ignored;
}

// Then every handler becomes:
async function handleNavigateRoute({ params, client }) {
  consumeAgentIdSentinel(params);
  // ...rest unchanged
}
```

## Info

### IN-01: agents.ts retains `void agentScope;` plus large commented-out block

**File:** `mcp/src/tools/agents.ts:14-235`
**Issue:** `registerAgentTools` now accepts `agentScope` purely for runtime DI parity
(D-11) and immediately discards it via `void agentScope;`. Below that, ~210 lines of
commented-out tool definitions remain from the v0.9.45rc1 deprecation. The TODO at
line 20 references Phase 242 ("the back tool when it lands"). The phrase "back tool"
appears to be a typo for "background agent tool".

**Fix:** Either (a) leave as-is and accept the dead-code weight as the deprecation
audit trail (already flagged in PROJECT.md memory), or (b) remove the commented bodies
and keep only the empty registration shell + a single-line pointer to the deprecation
record. Pick (a) for now if the deprecation is recent; revisit when Phase 242 reactivates the surface.

### IN-02: TODO at agents.ts mentions "the back tool"

**File:** `mcp/src/tools/agents.ts:20`
**Issue:** Comment reads `// TODO Phase 242: thread agentScope into the back tool when it lands.` "the back tool" is almost certainly a typo for "the background-agent tool" or "these tools".

**Fix:**
```typescript
// TODO Phase 242: thread agentScope into the background-agent tools when they relaunch.
```

### IN-03: types.ts retains agent-management message types despite tools being commented out

**File:** `mcp/src/tools/agents.ts` (commented body) and `mcp/src/types.ts:26-33`
**Issue:** `MCPMessageType` still includes `'mcp:create-agent'` ... `'mcp:get-agent-history'`. These types have no current sender (the agents.ts tool bodies are commented out) but the extension dispatcher in `extension/ws/mcp-bridge-client.js:356-378` still routes them via `_handleAgentAction`. Keeping the type union and the bridge-client routing in sync with the tools file -- even when commented out -- makes the eventual Phase 242 reactivation cheaper. No action required, but a single-line note in `types.ts` near the agent block ("// Phase 242 reactivation surface") would help future reviewers.

**Fix:** None required; consider a marker comment when convenient.

### IN-04: `payload: {}` literal in agent-scope.ts could omit the field

**File:** `mcp/src/agent-scope.ts:35-38`
**Issue:** `bridge.sendAndWait({ type: 'agent:register', payload: {} }, ...)` sends an empty payload object. The extension's `handleAgentRegisterRoute` ignores `payload` entirely (D-12). This works, but is slightly wasteful on the wire. The bridge envelope schema in `mcp/src/types.ts:1-6` declares `payload: Record<string, unknown>` as required, so omitting it would change the schema.

**Fix:** None required. The `payload: {}` matches `MCPMessage`'s contract; this is just a note for future schema reviewers wondering why the empty object exists.

---

## Validated invariants (positive findings)

The review confirmed the following invariants from `<phase_context>`:

- **D-04 no-poison:** `agent-scope.ts` `finally` clears `this.pending = null` regardless of outcome; on failure path `this.agentId` is never set, and `tests/agent-scope.test.js` Test 3 exercises this.
- **D-05 top-level placement:** All `agentId` injections in `autopilot.ts:60,79,98`, `manual.ts:42`, and `visual-session.ts:62,88` write at the top level of the payload object next to `task`/`tool`/`sessionToken`/etc. -- never nested.
- **D-06 scope discipline:** `observability.ts:23`, `read-only.ts:92`, `vault.ts:27`, and `agents.ts:23` each contain `void agentScope;` with a CONTEXT.md-referencing comment; only the three mutation surfaces call `agentScope.ensure(bridge)`.
- **D-12 mint-from-server:** `mcp-tool-dispatcher.js:676` calls `reg.registerAgent()` with zero arguments, ignoring caller-supplied agentId; `tests/agent-bridge-routes.test.js` Test 1 explicitly asserts `registerAgent.length === 0`.
- **Pitfall 1 -- registry global name:** `mcp-tool-dispatcher.js:671,687,704` uniformly read `globalThis.fsbAgentRegistryInstance`; no occurrence of `globalThis.agentRegistry` anywhere in the reviewed surface.
- **D-03 race control:** `tests/agent-scope.test.js` Test 2 and `tests/agent-id-threading.test.js` both fire 5 concurrent `ensure()` calls and assert exactly one `agent:register` on the wire.
- **agent:register response shape:** Dispatcher returns `{ success, agentId, agentIdShort }` (line 683); AgentScope validates `result.success === true && typeof result.agentId === 'string'` (lines 39-42); test 5a/5b/5c covers all three failure shapes.

---

_Reviewed: 2026-05-05_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
