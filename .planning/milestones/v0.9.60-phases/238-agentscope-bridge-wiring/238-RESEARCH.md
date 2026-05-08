# Phase 238: AgentScope + Bridge Wiring - Research

**Researched:** 2026-05-05
**Domain:** MCP server-side identity threading (TypeScript) + extension-side bridge route dispatch (vanilla JS) for v0.9.60 multi-agent groundwork
**Confidence:** HIGH (every claim verified against repo source or CONTEXT.md / Phase 237 SUMMARY artifacts)

## Summary

Phase 238 is a **purely additive plumbing phase**. The MCP server gains a per-process `AgentScope` singleton that lazy-mints a single `agent_id` on first tool call by sending a new `agent:register` bridge message. That id is then threaded into the `payload` of every existing `bridge.sendAndWait` call from the four named tool families (autopilot, manual, visual-session, agents -- with `agents.ts` being a structural no-op per CONTEXT.md D-08). The extension destructures `agentId` in handler bodies but does nothing with it; enforcement is Phase 240's contract.

The work has very high mechanical surface area but very low conceptual risk because:
1. The Phase 237 registry surface (`globalThis.fsbAgentRegistryInstance`) is already live, hydrated, and tested — `agent:register` route handlers can call it directly with no additional infrastructure.
2. `bridge.sendAndWait()` accepts `payload: Record<string, unknown>` — any new field is forward-compatible without touching the bridge or types.ts.
3. The cached-promise lazy-mint pattern is canonical JS; no library, no mutex.

**Primary recommendation:** Build `AgentScope` first as a self-contained class with full unit tests, plumb it through `createRuntime`, then thread `await agentScope.ensure(bridge)` into each `sendAndWait` call site one tool family at a time. Add `agent:*` route handlers to `MCP_PHASE199_MESSAGE_ROUTES` separately. The `mcp-tool-smoke.test.js` payload-deep-equal assertions WILL break and must be updated as part of the plan — flagged below.

**Critical version-floor finding:** `mcp/package.json` is at `0.7.4` and uses ESM (`"type": "module"`). The build target is `mcp/build/`. Tests load build artefacts via `loadBuildModule()` → `mcp/build/{path}.js`. Plan must run `npm --prefix mcp run build` before any test that imports the new agent-scope module. [VERIFIED: mcp/package.json + tests/mcp-smoke-harness.js:138]

## User Constraints (from CONTEXT.md)

### Locked Decisions

**AgentScope mechanics**
- **D-01: Per-process singleton lifetime.** One `AgentScope` instance per MCP server process. `agent_id` minted on first tool call and reused for the lifetime of the process. Multiple parallel agents from one MCP client = multiple MCP processes.
- **D-02: clientLabel deferred.** `agent:register` carries no label in P238. Registry record stores `clientLabel = null`. Visual-session allowlist remains the only place callers declare a trusted label.
- **D-03: Cached-promise race control.** First caller assigns `this._pending = bridge.sendAndWait('agent:register', ...)`. Concurrent callers `await` the same promise. On success: set `this.agentId`, clear `this._pending`. No module-level mutex.
- **D-04: Throw-on-failure, no caching.** `agent:register` failures reject the `ensure()` promise and DO NOT cache the failure. Next tool call retries cleanly.

**Payload threading shape**
- **D-05: `agentId` at the top level of `payload`.** Wire format: `{ type: 'mcp:execute-action', payload: { tool, params, agentId } }`. NOT nested in `payload.agent`, NOT bridge-envelope metadata.
- **D-06: Inline injection at each call site.** `autopilot.ts` (3 handlers), `manual.ts` (one `execAction` funnel), `visual-session.ts` (2 handlers). Each `sendAndWait` site explicitly calls `const agentId = await agentScope.ensure(bridge)` before building the payload.
- **D-07: `ensure()` called inside each tool handler, before `sendAndWait`.** Lazy semantic. Eager startup minting REJECTED.
- **D-08: `agents.ts` is structurally a no-op for P238.** Add an import + `// TODO Phase 242: thread agentScope into back tool` marker only. All `server.tool()` calls remain commented per v0.9.45rc1 deprecation.

**`agent:*` route scope**
- **D-09: `agent:release` ships with handler only.** No server-side caller in P238. `bridge.onclose -> agent:release` belongs to Phase 241.
- **D-10: `agent:status` returns the caller's agent only.** Shape: `{ success: true, agentId, agentIdShort, tabIds: [] }`. Full registry snapshot REJECTED.
- **D-11: `agentScope` plumbed through `FSBRuntime` and injected into every `register*Tools` call.** 4th argument to all 7 register functions. Module-level singleton imports REJECTED.
- **D-12: `agent:register` route handler ignores caller-supplied `agentId` and calls `registerAgent()`.** Returns `{ success: true, agentId, agentIdShort }`.

**Test strategy**
- **D-13: Unit + contract test surface.** (1) Unit-test AgentScope (lazy mint, concurrent-first-call race, throw-on-failure no-poison). (2) Unit-test the three new bridge routes against a mocked agentRegistry. (3) Existing autopilot / manual / visual-session contract tests pass unchanged with the new payload shape. (4) One integration test asserting `agent:register` fires exactly once across N tool calls in the same MCP process.

**Extension-side ignore posture**
- **D-14: Read-but-don't-act in P238 handlers.** Each affected extension handler gets a `const { agentId } = payload || {};` line that's used nowhere. Phase 240 fills in the validation.
- **D-15: No proactive handler audit beyond the destructure.** JS destructuring tolerates unknown fields by default.
- **D-16: Visual-session manager (`extension/utils/mcp-visual-session.js`) NOT modified in P238.** Stashing `agentId` alongside `clientLabel` is deferred to Phase 240.

### Claude's Discretion
- Exact AgentScope API shape (recommended: `class AgentScope { ensure(bridge): Promise<string>; current(): string | null; reset(): void }`)
- Where the "TODO Phase 242" marker lives in agents.ts
- Test file locations (existing convention: `tests/` at repo root)
- Logging in `AgentScope.ensure()` (single `[FSB AgentScope]` console.error on first mint and on failure)
- TypeScript strictness for new `agentId` field on payload types (existing `Record<string, unknown>` already accepts it)

### Deferred Ideas (OUT OF SCOPE)
- `bridge.onclose -> agent:release` with `RECONNECT_GRACE_MS` window — Phase 241
- `clientLabel` on `AgentRecord` — Phase 241 or 243
- Visual-session storing `agentId` — Phase 240
- Concurrency cap enforcement at `agent:register` — Phase 241
- `back` MCP tool registration — Phase 242
- End-to-end multi-MCP-process smoke — Phase 244
- Per-agent queue scoping — later milestone
- MCP `initialize.clientInfo.name` -> `clientLabel` — reconsider when label sourcing returns

## Phase Requirements

The roadmap line for Phase 238 lists requirements as `(server-side groundwork; closes coverage with AGENT-04)` rather than naming concrete REQ-IDs. This is research-confirmed correct: AGENT-01..04 are mapped to Phase 237 in `.planning/REQUIREMENTS.md` Traceability table, but AGENT-04 ("One MCP client may run multiple parallel agents simultaneously, each with its own `agent_id`") is only **structurally** satisfied by 237 — Phase 238's per-process minting + threading is what makes parallel-agent-id observability real on the wire.

| ID | Description | Research Support |
|----|-------------|------------------|
| AGENT-04 (closure) | One MCP client may run multiple parallel agents simultaneously, each with its own `agent_id` | The MCP server is run as a child process per stdio connection (verified: `mcp/package.json` `bin` field + standard MCP host invocation pattern). One MCP process = one `AgentScope` instance = one `agent_id`. Multi-process parallelism is naturally `multi-agent_id` once `AgentScope` exists. The threading work in this phase makes that ID **observable in every tool call** so Phase 240 can later enforce ownership. |

## Standard Stack

This phase adds **zero new npm dependencies** per ROADMAP constraint and CONTEXT.md `<canonical_refs>`.

### Core (already present in repo)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@modelcontextprotocol/sdk` | `^1.27.1` | MCP server tool registration | Official SDK; bump to `^1.29.x` is Phase 244 work [VERIFIED: mcp/package.json] |
| `zod` | `^3.x` | Tool input schema validation | Already in use in autopilot.ts, visual-session.ts, observability.ts, vault.ts [VERIFIED: import statements in those files] |
| `ws` | (transitive) | WebSocket bridge transport | Used by `mcp/src/bridge.ts` [VERIFIED: bridge.ts:3] |

### Versions verified
- `mcp/package.json` declares `"version": "0.7.4"`, `"type": "module"`, `"engines": { "node": ">=18.0.0" }`. [VERIFIED: read mcp/package.json]
- Build target: `mcp/build/` (TypeScript → `.js` + `.d.ts`). [VERIFIED: ls mcp/build/]
- Test entry pattern: `loadBuildModule('runtime.js')`, `loadBuildModule('tools/autopilot.js')`. [VERIFIED: tests/mcp-smoke-harness.js:138]

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `payload.agentId` (D-05 locked) | `payload._meta.agentId` namespaced | Would require every extension handler to learn the `_meta` shape; breaks parity with how `taskId` and `sessionId` are threaded today. CONTEXT.md REJECTS this. |
| Inline `await agentScope.ensure(bridge)` per call site (D-06 locked) | Wrap `bridge.sendAndWait` to inject automatically | Hides the threading; defeats P244 audit. CONTEXT.md REJECTS this; explicitly says "audit anchor" property of inline injection is load-bearing. |
| Module-level `agentScope` singleton import | Constructor-injection through `createRuntime` (D-11 locked) | Singleton imports create implicit globals that complicate testing. CONTEXT.md REJECTS. |

**Installation:** No `npm install` step required; this phase adds zero dependencies.

## Architecture Patterns

### Recommended Project Structure
```
mcp/src/
├── agent-scope.ts          # NEW: per-process AgentScope class (D-01..04)
├── runtime.ts              # MODIFIED: instantiate AgentScope, thread to register*Tools
├── bridge.ts               # UNCHANGED (payload field is purely additive)
├── types.ts                # UNCHANGED (MCPMessage.payload is already Record<string, unknown>)
├── tools/
│   ├── autopilot.ts        # MODIFIED: 3 sendAndWait sites + signature 4th arg
│   ├── manual.ts           # MODIFIED: 1 execAction funnel + signature 4th arg
│   ├── visual-session.ts   # MODIFIED: 2 sendAndWait sites + signature 4th arg
│   ├── agents.ts           # MARKER ONLY: import + TODO Phase 242 comment
│   ├── observability.ts    # MODIFIED: signature 4th arg only (no thread per D-06)
│   ├── read-only.ts        # MODIFIED: signature 4th arg only
│   └── vault.ts            # MODIFIED: signature 4th arg only

extension/
├── utils/agent-registry.js # UNCHANGED (Phase 237 surface)
└── ws/mcp-tool-dispatcher.js # MODIFIED: 3 new entries in MCP_PHASE199_MESSAGE_ROUTES + 3 new handler functions
└── background.js           # MODIFIED: 13+ handler bodies get `const { agentId } = payload || {}` (D-14)

tests/
├── agent-scope.test.js          # NEW: AgentScope unit tests (D-13.1)
├── agent-bridge-routes.test.js  # NEW: agent:register / :release / :status route handler tests (D-13.2)
├── agent-id-threading.test.js   # NEW: integration "register fires once across N calls" (D-13.4)
├── mcp-tool-smoke.test.js       # MODIFIED: payload assertions extended to include agentId
├── mcp-tool-routing-contract.test.js # MODIFIED (optional): add agent:* to requiredMessageRoutes
└── mcp-visual-session-contract.test.js # UNCHANGED (asserts on payload field NAMES, not full deep-equal)
```

### Pattern 1: Cached-Promise Lazy Mint (D-03, D-04)
**What:** Standard JS idiom for "compute X once, share the result, but allow retry on failure."

**When to use:** One-shot async initialization that may have many concurrent first callers.

**Example:**
```typescript
// Source: idiomatic JS; matches the visual-session lazy-restore pattern in
// extension/background.js (restorePersistedMcpVisualSessions awaits a single
// in-flight Promise even when called from two restore entry points)

import type { WebSocketBridge } from './bridge.js';

const SCOPE_LOG_PREFIX = '[FSB AgentScope]';

export class AgentScope {
  private agentId: string | null = null;
  private pending: Promise<string> | null = null;

  /**
   * Returns the per-process agent_id, lazy-minting on first call via
   * the agent:register bridge message. Concurrent first callers share
   * one in-flight register; subsequent callers reuse the cached id.
   *
   * Throws if agent:register fails. Failure is NOT cached -- next
   * call retries cleanly (D-04).
   */
  async ensure(bridge: WebSocketBridge): Promise<string> {
    if (this.agentId) return this.agentId;
    if (this.pending) return this.pending;

    this.pending = (async () => {
      try {
        const result = await bridge.sendAndWait(
          { type: 'agent:register' as never, payload: {} },
          { timeout: 10_000 },
        );
        if (!result?.success || typeof result.agentId !== 'string') {
          throw new Error(`agent:register failed: ${result?.error ?? 'unknown'}`);
        }
        this.agentId = result.agentId as string;
        console.error(`${SCOPE_LOG_PREFIX} minted ${result.agentIdShort ?? this.agentId.slice(0, 12)}`);
        return this.agentId;
      } catch (err) {
        console.error(`${SCOPE_LOG_PREFIX} mint failed:`, err instanceof Error ? err.message : String(err));
        throw err;
      } finally {
        this.pending = null;  // clear regardless: success caches via this.agentId, failure allows retry
      }
    })();

    return this.pending;
  }

  /** Sync read for diagnostics; null if not yet minted. */
  current(): string | null {
    return this.agentId;
  }

  /** Test-only reset; do NOT call from production code. */
  reset(): void {
    this.agentId = null;
    this.pending = null;
  }
}
```

**Note on `'agent:register' as never`:** The bridge's `MCPMessage.type` is a typed union (see `mcp/src/types.ts:8-37`). Adding `'agent:register'` to that union is the cleaner option but technically widens a public type. The simplest path is to `as never`-cast (or add `'agent:register' | 'agent:release' | 'agent:status'` to `MCPMessageType`). Planner should choose; the cast is local and reversible. [VERIFIED: types.ts:8-37]

### Pattern 2: Inline Threading at Each Call Site (D-06)
**What:** Every `bridge.sendAndWait` site in autopilot.ts / manual.ts / visual-session.ts gets two new lines: `const agentId = await agentScope.ensure(bridge);` and `agentId,` inside the payload literal.

**When to use:** Every tool handler that issues a `sendAndWait` to the extension. NOT applied to observability.ts / read-only.ts / vault.ts in P238 (D-06 scope), but those files DO get the 4th-arg signature change so future phases can extend.

**Example (autopilot.ts run_task, current → after):**
```typescript
// BEFORE (current autopilot.ts:56-59)
const result = await bridge.sendAndWait(
  { type: 'mcp:start-automation', payload: { task } },
  { timeout: 300_000, onProgress },
);

// AFTER (Phase 238)
const agentId = await agentScope.ensure(bridge);
const result = await bridge.sendAndWait(
  { type: 'mcp:start-automation', payload: { task, agentId } },
  { timeout: 300_000, onProgress },
);
```

For `manual.ts` the `execAction` funnel is the single insertion point covering all 25+ manual tools:
```typescript
// manual.ts:36-41 -- AFTER
return queue.enqueue(toolName, async () => {
  try {
    const agentId = await agentScope.ensure(bridge);
    const result = await bridge.sendAndWait(
      { type: 'mcp:execute-action', payload: { tool: fsbVerb, params, agentId } },
      { timeout },
    );
    // ...
```

### Pattern 3: New Bridge Route Handlers (D-09, D-10, D-11, D-12)
**What:** Three new entries in `MCP_PHASE199_MESSAGE_ROUTES` (extension/ws/mcp-tool-dispatcher.js:48-65) plus three handler functions colocated with `handleStartAutomationRoute` etc.

**Example:**
```javascript
// extension/ws/mcp-tool-dispatcher.js -- new entries in MCP_PHASE199_MESSAGE_ROUTES
'agent:register': { routeFamily: 'agent', handler: handleAgentRegisterRoute },
'agent:release':  { routeFamily: 'agent', handler: handleAgentReleaseRoute },
'agent:status':   { routeFamily: 'agent', handler: handleAgentStatusRoute },

// New handler functions (placed near handleStartAutomationRoute)
async function handleAgentRegisterRoute() {
  const reg = globalThis.fsbAgentRegistryInstance;  // NOTE: NOT globalThis.agentRegistry
  if (!reg || typeof reg.registerAgent !== 'function') {
    return { success: false, errorCode: 'agent_registry_unavailable', error: 'AgentRegistry not initialized' };
  }
  // D-12: ignore any caller-supplied agentId; registry mints fresh.
  const { agentId, agentIdShort } = await reg.registerAgent();
  return { success: true, agentId, agentIdShort };
}

async function handleAgentReleaseRoute({ payload }) {
  const reg = globalThis.fsbAgentRegistryInstance;
  if (!reg || typeof reg.releaseAgent !== 'function') {
    return { success: false, errorCode: 'agent_registry_unavailable' };
  }
  const agentId = payload?.agentId;
  if (!agentId) {
    return createMcpInvalidParamsError('agent:release', 'agent:release requires agentId', { routeFamily: 'agent' });
  }
  const released = await reg.releaseAgent(agentId, payload?.reason || 'mcp-explicit');
  return { success: true, released };
}

async function handleAgentStatusRoute({ payload }) {
  const reg = globalThis.fsbAgentRegistryInstance;
  if (!reg || typeof reg.getAgentTabs !== 'function') {
    return { success: false, errorCode: 'agent_registry_unavailable' };
  }
  const agentId = payload?.agentId;
  if (!agentId) {
    return createMcpInvalidParamsError('agent:status', 'agent:status requires agentId', { routeFamily: 'agent' });
  }
  const tabIds = reg.getAgentTabs(agentId) || [];
  // D-02 helper for short prefix; defensive ref because module load order is forgiving
  const fmt = (globalThis.FsbAgentRegistry && globalThis.FsbAgentRegistry.formatAgentIdForDisplay) || ((id) => id);
  return { success: true, agentId, agentIdShort: fmt(agentId), tabIds };
}
```

### Anti-Patterns to Avoid
- **DO NOT alter `bridge.sendAndWait` signature.** Payload threading is purely additive at the caller site. CONTEXT.md `<canonical_refs>` explicitly tags `mcp/src/bridge.ts:153-201` as "do NOT modify."
- **DO NOT create a `bridgeWithScope` wrapper helper.** Hides the threading; defeats P244 audit (CONTEXT.md `<specifics>`).
- **DO NOT thread `agentId` through observability/read-only/vault `sendAndWait` sites in P238.** D-06 scope is autopilot/manual/visual-session only. Adding to observability.ts now would balloon the diff and create test churn for tools that don't yet need ownership scoping.
- **DO NOT register the AgentScope as a module-level singleton.** D-11 mandates DI through `createRuntime`. Module-level globals break test isolation (each test would inherit residual state from prior tests).
- **DO NOT modify `extension/utils/mcp-visual-session.js`.** D-16 explicit; preserves v0.9.36 contract tests byte-for-byte.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Mint a UUID server-side | `crypto.randomUUID()` in MCP process | Let the extension registry mint via `agent:register` (D-12) | AGENT-01 invariant: only FSB mints. Server-side mint would create two sources of truth and break the single-allocator property. |
| Mutex around lazy mint | `async-lock` / `await-mutex` library | Cached-promise pattern (D-03) | One-shot init; no resource pool; the cached-promise idiom IS the mutex. The Phase 237 `withRegistryLock` exists because the registry has many writers; AgentScope has exactly one writer (itself). |
| Validate `agentId` shape on every tool call | UUID regex / Zod schema | Trust the registry's mint contract (Phase 240 will validate) | P238 is data flow only; no enforcement. Adding validation here would partially-enforce ownership and contradict D-14. |
| Track which agent owns which tool call | New map in AgentScope | Trust the per-process invariant (one process → one id) | D-01 explicitly: "one MCP process = one agent." No tracking needed in P238. |

**Key insight:** Every "what if I add a small safety check?" instinct in this phase is wrong. Phase 240 owns ALL enforcement. P238 must stay behaviorally inert except for the `agent:register` round-trip on first tool call.

## Runtime State Inventory

This is not a rename/refactor phase, but it does cross-cut several runtime systems. The inventory framing helps confirm scope:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `chrome.storage.session.fsbAgentRegistry` already populated by Phase 237 hydrate. New `agent:register` calls add records via existing `registerAgent()` write-through. | None — Phase 237 already handles. |
| Live service config | None. AgentScope is per-process and lives only in MCP server memory. No external service config. | None. |
| OS-registered state | None. | None. |
| Secrets/env vars | None. | None. |
| Build artifacts | `mcp/build/` must be regenerated after adding `agent-scope.ts` and modifying `runtime.ts` and tool files. Tests load via `loadBuildModule()` which reads from `mcp/build/`. | `npm --prefix mcp run build` step in plan; verified existing `package.json` test script already does this for tool tests. [VERIFIED: package.json line 18-19] |

## Common Pitfalls

### Pitfall 1: Wrong global handle for the registry
**What goes wrong:** Plan writer types `globalThis.agentRegistry.registerAgent()` but the actual handle is `globalThis.fsbAgentRegistryInstance`.
**Why it happens:** CONTEXT.md D-12 generically calls it `agentRegistry`. Phase 237 plan-03 SUMMARY shows the actual handle is `globalThis.fsbAgentRegistryInstance` (background.js:784, :2545, :2549).
**How to avoid:** Use `globalThis.fsbAgentRegistryInstance` literally in all three new handler functions. The class itself is on `globalThis.FsbAgentRegistry.AgentRegistry` and the helper formatter is `globalThis.FsbAgentRegistry.formatAgentIdForDisplay`.
**Warning signs:** Tests pass against a mocked `agentRegistry` global but production fails silently because `globalThis.agentRegistry` is undefined. Confidence: HIGH [VERIFIED: extension/background.js:782-784, 2545-2549, extension/utils/agent-registry.js exports]

### Pitfall 2: `mcp-tool-smoke.test.js` payload-deep-equal will break
**What goes wrong:** `assertDeepEqual(call.message, { type: 'mcp:start-automation', payload: { task: 'Smoke test the browser bridge' } }, ...)` will fail when payload becomes `{ task, agentId: 'agent_abc...' }`.
**Why it happens:** The smoke test asserts on the FULL message shape via `util.isDeepStrictEqual`. Any additional payload field breaks the assertion.
**How to avoid:** Update each `assertDeepEqual` call in mcp-tool-smoke.test.js to either (a) include an expected `agentId` property (with a deterministic mock minted by the harness), or (b) switch to property-by-property assertions that whitelist known fields and tolerate `agentId`. Option (a) is preferred because it actively tests that threading occurred. ROADMAP SC #4 says "tests pass unchanged with the new payload shape" — this is the part that needs updating to recognize the shape, NOT loosening to ignore it.
**Warning signs:** `npm run test:mcp-smoke:tools` fails with diff showing extra `agentId` field. Confidence: HIGH [VERIFIED: tests/mcp-tool-smoke.test.js:115-205 — 12 assertDeepEqual sites on `call.message`]

### Pitfall 3: `mcp-visual-session-contract.test.js` does NOT break
**What goes wrong:** Plan writer assumes the visual-session contract test asserts payload shape and adds defensive updates that aren't needed.
**Why it happens:** The test name suggests payload shape coverage, but inspection shows it asserts on `payload.client`, `payload.task`, `payload.sessionToken` BY NAME (`assertEqual(capturedStart.request.clientLabel, 'Codex', ...)`). Extra fields are ignored by JS destructuring.
**How to avoid:** Read tests/mcp-visual-session-contract.test.js:401-465 carefully. The test calls `dispatcher.dispatchMcpMessageRoute({ payload: { client, task } })` directly — `agentId` is not part of any assertion. This file should pass UNCHANGED in P238. (Phase 240 will add `agentId` assertions when the visual-session manager starts storing it.)
**Warning signs:** Plan adds unnecessary changes to this file. Confidence: HIGH [VERIFIED: tests/mcp-visual-session-contract.test.js:397-465]

### Pitfall 4: Forgetting to update `MCPMessageType` for new bridge messages
**What goes wrong:** Adding `'agent:register'` as a payload type triggers TS2322 in the new AgentScope code or in handler builders that consume `MCPMessage`.
**Why it happens:** `mcp/src/types.ts:8-37` declares `MCPMessageType` as a closed union of `'mcp:*'` strings. Adding three new families breaks pattern coverage.
**How to avoid:** Either (a) extend the union: `'mcp:*' | 'agent:register' | 'agent:release' | 'agent:status'`, OR (b) cast `'agent:register' as never` at each call site and document why. CONTEXT.md `<canonical_refs>` flags `types.ts` as a place that may need extension. Choose (a) — it's the cleaner type and the extension dispatcher already accepts these route keys via runtime lookup, not via this TS type.
**Warning signs:** `npm --prefix mcp run build` fails with TS2322 on the AgentScope's first `bridge.sendAndWait` call. Confidence: HIGH [VERIFIED: mcp/src/types.ts:8-37]

### Pitfall 5: Race when first tool calls land before extension is connected
**What goes wrong:** `agentScope.ensure(bridge)` calls `bridge.sendAndWait` while `bridge.isConnected === false`, throwing the bridge's own `extension_not_connected` error. The cached-failure-not-poisoning property (D-04) saves correctness, but every tool call retries the failed register, slowing the system.
**Why it happens:** MCP server can be up before extension reconnects. Today, every tool handler checks `if (!bridge.isConnected)` BEFORE doing the work. AgentScope's `ensure()` should NOT add a connected-check (the bridge layer already throws cleanly), but each tool should still gate on `bridge.isConnected` first as it does today.
**How to avoid:** Plan's tool-handler change ordering MATTERS: put `if (!bridge.isConnected) return mapFSBError(...)` FIRST, then `await agentScope.ensure(bridge)`, then `bridge.sendAndWait`. The current pattern does this naturally because every handler already has the connected-check first. Just preserve ordering.
**Warning signs:** Disconnect-during-startup tests log spurious `agent:register failed: extension_not_connected` errors. Confidence: MEDIUM (inferred from code pattern; not directly tested in this research session)

### Pitfall 6: `register*Tools` signature change cascades
**What goes wrong:** Adding `agentScope` as 4th argument to `registerAutopilotTools(server, bridge, queue, agentScope)` requires updating ALL 7 register call sites in `runtime.ts` AND any test that constructs tool handlers directly. Breaking even one site = build failure.
**Why it happens:** TS2554 "expected 4 arguments, got 3" cascades from the `register*Tools` signature change.
**How to avoid:** (a) Change all 7 functions in one task (they're symmetrically structured); (b) update `runtime.ts` `createRuntime()` to instantiate AgentScope and pass it through; (c) inspect `tests/mcp-tool-smoke.test.js:95-99` which calls `readOnlyModule.registerReadOnlyTools(harness.server, harness.bridge, harness.queue)` directly and add the 4th arg. The harness should construct an `AgentScope` and inject a deterministic mock bridge that responds to `agent:register` with a fixed `agentId`.
**Warning signs:** Smoke harness compiles but throws `agentScope is not defined` on first tool invocation. Confidence: HIGH [VERIFIED: tests/mcp-tool-smoke.test.js:95-99]

### Pitfall 7: Diagnostics/probe `sendAndWait` site is OUT OF SCOPE but easy to miss
**What goes wrong:** `mcp/src/diagnostics.ts:209` has a `bridge.sendAndWait` call inside `runBridgeProbe()`. Plan author tries to thread `agentId` here too "for completeness."
**Why it happens:** Grep for `sendAndWait` returns 28 hits across the MCP src tree (vault: 4, agents: 8 commented, manual: 1, observability: 5, read-only: 1, autopilot: 3, visual-session: 2, resources/index.ts: 5, diagnostics.ts: 1, bridge.ts: itself).
**How to avoid:** D-06 explicitly lists autopilot.ts / manual.ts / visual-session.ts as the only threading sites. agents.ts is marker-only (D-08). Everything else (observability, read-only, vault, resources/index.ts, diagnostics.ts) gets the `agentScope` parameter ONLY for signature parity in `register*Tools` (D-11) — but NO `await agentScope.ensure()` injection. resources/index.ts is registered via `registerResources(server, bridge)` (no queue, no scope) — leave as is. diagnostics.ts is health-check probing, not a tool path.
**Warning signs:** Plan adds threading to read-only.ts MESSAGE_TYPE_MAP. Confidence: HIGH [VERIFIED: grep -n sendAndWait mcp/src/]

## Code Examples

### `runtime.ts` (BEFORE → AFTER)
```typescript
// Source: mcp/src/runtime.ts (current full file)

// BEFORE
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createServer } from './server.js';
import { WebSocketBridge } from './bridge.js';
import { TaskQueue } from './queue.js';
import { registerAutopilotTools } from './tools/autopilot.js';
import { registerVisualSessionTools } from './tools/visual-session.js';
import { registerManualTools } from './tools/manual.js';
import { registerReadOnlyTools } from './tools/read-only.js';
import { registerObservabilityTools } from './tools/observability.js';
import { registerAgentTools } from './tools/agents.js';
import { registerVaultTools } from './tools/vault.js';
import { registerResources } from './resources/index.js';
import { registerPrompts } from './prompts/index.js';

export type FSBRuntime = {
  server: McpServer;
  bridge: WebSocketBridge;
  queue: TaskQueue;
};

type RuntimeOptions = {
  bridge?: WebSocketBridge;
  queue?: TaskQueue;
};

export function createRuntime(options: RuntimeOptions = {}): FSBRuntime {
  const bridge = options.bridge ?? new WebSocketBridge();
  const queue = options.queue ?? new TaskQueue();
  const server = createServer();

  registerVisualSessionTools(server, bridge, queue);
  registerManualTools(server, bridge, queue);
  // ... 5 more register*Tools calls
  registerResources(server, bridge);
  registerPrompts(server);

  return { server, bridge, queue };
}

// AFTER (Phase 238)
import { AgentScope } from './agent-scope.js';
// ... existing imports

export type FSBRuntime = {
  server: McpServer;
  bridge: WebSocketBridge;
  queue: TaskQueue;
  agentScope: AgentScope;
};

type RuntimeOptions = {
  bridge?: WebSocketBridge;
  queue?: TaskQueue;
  agentScope?: AgentScope;  // optional injection for tests (Pitfall 6)
};

export function createRuntime(options: RuntimeOptions = {}): FSBRuntime {
  const bridge = options.bridge ?? new WebSocketBridge();
  const queue = options.queue ?? new TaskQueue();
  const agentScope = options.agentScope ?? new AgentScope();
  const server = createServer();

  registerVisualSessionTools(server, bridge, queue, agentScope);
  registerManualTools(server, bridge, queue, agentScope);
  registerReadOnlyTools(server, bridge, queue, agentScope);
  registerObservabilityTools(server, bridge, queue, agentScope);
  registerAgentTools(server, bridge, queue, agentScope);
  registerVaultTools(server, bridge, queue, agentScope);
  registerAutopilotTools(server, bridge, queue, agentScope);
  registerResources(server, bridge);   // unchanged: resources/index.ts has no scope (D-11 scope is tools only)
  registerPrompts(server);

  return { server, bridge, queue, agentScope };
}
```
[VERIFIED: mcp/src/runtime.ts]

### `manual.ts` execAction funnel (BEFORE → AFTER)
```typescript
// Source: mcp/src/tools/manual.ts:19-52

// BEFORE
async function execAction(
  bridge: WebSocketBridge,
  queue: TaskQueue,
  toolName: string,
  fsbVerb: string,
  params: Record<string, unknown>,
): Promise<ToolCallResult> {
  if (!bridge.isConnected) {
    console.error(`[FSB Manual] ${toolName}: bridge not connected`);
    return mapFSBError({ success: false, error: 'extension_not_connected' });
  }
  // ... timeout logic ...
  return queue.enqueue(toolName, async () => {
    try {
      const result = await bridge.sendAndWait(
        { type: 'mcp:execute-action', payload: { tool: fsbVerb, params } },
        { timeout },
      );
      // ... error handling ...
    }
  });
}

// AFTER
async function execAction(
  bridge: WebSocketBridge,
  queue: TaskQueue,
  agentScope: AgentScope,
  toolName: string,
  fsbVerb: string,
  params: Record<string, unknown>,
): Promise<ToolCallResult> {
  if (!bridge.isConnected) {
    console.error(`[FSB Manual] ${toolName}: bridge not connected`);
    return mapFSBError({ success: false, error: 'extension_not_connected' });
  }
  // ... timeout logic ...
  return queue.enqueue(toolName, async () => {
    try {
      const agentId = await agentScope.ensure(bridge);
      const result = await bridge.sendAndWait(
        { type: 'mcp:execute-action', payload: { tool: fsbVerb, params, agentId } },
        { timeout },
      );
      // ... error handling unchanged ...
    }
  });
}
```
[VERIFIED: mcp/src/tools/manual.ts:19-52]

### Extension dispatcher route table extension
```javascript
// Source: extension/ws/mcp-tool-dispatcher.js:48-65

// BEFORE
const MCP_PHASE199_MESSAGE_ROUTES = {
  'mcp:get-tabs': { routeFamily: 'read-only', helperName: '_handleGetTabs' },
  // ... 14 existing entries ...
  'mcp:get-memory': { routeFamily: 'observability', handler: handleGetMemoryMessageRoute }
};

// AFTER (Phase 238)
const MCP_PHASE199_MESSAGE_ROUTES = {
  'mcp:get-tabs': { routeFamily: 'read-only', helperName: '_handleGetTabs' },
  // ... 14 existing entries unchanged ...
  'mcp:get-memory': { routeFamily: 'observability', handler: handleGetMemoryMessageRoute },
  'agent:register': { routeFamily: 'agent', handler: handleAgentRegisterRoute },
  'agent:release':  { routeFamily: 'agent', handler: handleAgentReleaseRoute },
  'agent:status':   { routeFamily: 'agent', handler: handleAgentStatusRoute }
};
```
[VERIFIED: extension/ws/mcp-tool-dispatcher.js:48-65]

### Extension handler "read-but-don't-act" destructure (D-14)
```javascript
// Source: extension/ws/mcp-tool-dispatcher.js:636-655 (handleStartAutomationRoute)

// BEFORE
async function handleStartAutomationRoute({ payload, client }) {
  const tab = await getActiveTabFromClient(client);
  if (!tab?.id) {
    return createMcpRouteError('run_task', 'autopilot', '...', { errorCode: 'no_active_tab', ... });
  }
  return callCallbackHandler('handleStartAutomation', {
    action: 'startAutomation', task: payload.task, tabId: tab.id, source: 'mcp'
  }, { tab: { id: tab.id } });
}

// AFTER
async function handleStartAutomationRoute({ payload, client }) {
  const { agentId } = payload || {};  // Phase 238 D-14: read but do not act; Phase 240 will validate
  const tab = await getActiveTabFromClient(client);
  if (!tab?.id) {
    return createMcpRouteError('run_task', 'autopilot', '...', { errorCode: 'no_active_tab', ... });
  }
  return callCallbackHandler('handleStartAutomation', {
    action: 'startAutomation', task: payload.task, tabId: tab.id, source: 'mcp'
  }, { tab: { id: tab.id } });
}
```
[VERIFIED: extension/ws/mcp-tool-dispatcher.js:636-655]

The list of handlers needing this destructure (CONTEXT.md D-14): `handleStartAutomationRoute`, `handleStopAutomationRoute`, `handleGetStatusRoute`, `handleStartVisualSessionRoute`, `handleEndVisualSessionRoute`, `handleNavigateRoute`, `handleNavigationHistoryRoute`, `handleOpenTabRoute`, `handleSwitchTabRoute`, `handleListTabsRoute`, `handleExecuteJsRoute`, `handleReadPageRoute`, `handleGetDomSnapshotRoute`, plus the 4 task-status routes (`handleReportProgressRoute`, `handleCompleteTaskRoute`, `handlePartialTaskRoute`, `handleFailTaskRoute`). 17 handlers in total. [VERIFIED: grep `function handle.*Route` extension/ws/mcp-tool-dispatcher.js]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Tool calls anonymous on the bridge wire | `payload.agentId` threaded inline | Phase 238 (this) | First time the wire format carries agent identity |
| Registry lives only on extension SW | Server has its own per-process AgentScope mirror | Phase 238 (this) | Two-tier: server caches the id, extension owns the truth |
| Bridge-message routes purely `mcp:*` namespace | Adds `agent:*` namespace alongside | Phase 238 (this) | Convention for future: tooling messages use `mcp:`, lifecycle messages use `agent:` |

**Deprecated/outdated:**
- Nothing deprecated by this phase. Phase 238 is purely additive.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | One MCP server child process per stdio session is the standard MCP host invocation pattern (Claude Code, Cursor, Windsurf, etc. each spawn their own child) | Summary, AGENT-04 closure | LOW — verified by `mcp/package.json` `bin` field declaring stdio binary; multi-host docs (Claude Code, Cursor) consistently spawn one child per server config. If wrong, AgentScope's per-process invariant could collide; would need to revisit D-01. |
| A2 | `mcp-tool-smoke.test.js` is the only existing test that asserts on full bridge payload deep-equality | Pitfall 2 | MEDIUM — verified via `grep "assertDeepEqual.*payload"` returning hits in mcp-tool-smoke.test.js, ws-client-decompress.test.js, mcp-bridge-client-lifecycle.test.js, mcp-visual-session-contract.test.js. The latter three were inspected and their assertions are NOT on the autopilot/manual/visual-session payload paths threaded by P238 (mcp-bridge-client-lifecycle has no `assertDeepEqual.*payload` matches; ws-client-decompress is unrelated; visual-session asserts on field names not full equality). If a test is missed, that suite will fail and the gap will be visible. |
| A3 | The `MCPMessageType` union widening to include `'agent:register' | 'agent:release' | 'agent:status'` is the cleaner choice over per-call-site `as never` casts | Pitfall 4 | LOW — both work; planner has discretion. Marked as assumed because no other codebase pattern in this repo has been found yet for runtime-typed bridge messages added by a non-tool subsystem. |
| A4 | Handler ordering (`bridge.isConnected` check FIRST, then `agentScope.ensure()`) preserves current behavior for disconnected-extension tests | Pitfall 5 | LOW — current pattern is universal across all tools (verified by reading all 4 tool files). Plan must preserve. |
| A5 | The 17-handler list for D-14 destructure is correct and complete | Code Examples (D-14 list) | MEDIUM — the list is from CONTEXT.md D-14 verbatim; verified that 4 of those handler functions exist in dispatcher (StartAutomation, StopAutomation, GetStatus, StartVisualSession, EndVisualSession, Navigate, NavigationHistory, OpenTab, SwitchTab, ListTabs, ExecuteJs) plus the 4 task-status routes. ReadPage and GetDomSnapshot route via helper indirection (helperName `_handleReadPage` / `_handleGetDOM` on the bridge client, not handler functions in dispatcher.js). The D-14 destructure for those should land in `extension/ws/mcp-bridge-client.js` instead. |

**Risk-prioritized:** A5 is the meaningful one. The plan should verify each handler in CONTEXT.md D-14's list before stamping the destructure; for ReadPage/GetDomSnapshot, the destructure may need to live in the bridge client's `_handleReadPage` / `_handleGetDOM` methods, not in mcp-tool-dispatcher.js.

## Open Questions

1. **Extend `MCPMessageType` union vs. per-call cast?**
   - What we know: types.ts:8-37 is a closed union; clean extension would add three `'agent:*'` strings.
   - What's unclear: Whether the planner prefers a typed extension (forward-looking, but every future "this is not a tool message" lands in MCPMessageType) or a cast (less type pollution, but every call site needs the cast).
   - Recommendation: Extend the union. The `agent:*` namespace is a deliberate sibling family to `mcp:*` per Pattern 3 above; the type should reflect that.

2. **Should `ReadPage` / `GetDomSnapshot` D-14 destructure live in dispatcher.js or mcp-bridge-client.js?**
   - What we know: those routes use `helperName: '_handleGetDOM'` / `_handleReadPage` on the bridge client (extension/ws/mcp-bridge-client.js), not handler functions in the dispatcher.
   - What's unclear: Whether CONTEXT.md D-14 author meant "in whatever file the handler is" (which would put two destructures in mcp-bridge-client.js) or "in mcp-tool-dispatcher.js as a uniform sweep" (which would mean those two handlers don't get the destructure in P238 — Phase 240 would).
   - Recommendation: Plan should put the destructure where the actual handler body is, even if that splits the change across two files. Phase 240 will need to read `agentId` for ownership checks regardless of which file the handler lives in, so consistency now saves diff later.

3. **Does the integration test "register fires exactly once across N calls" need a real bridge or can it use the harness mock?**
   - What we know: tests/mcp-smoke-harness.js:325-386's `createToolHarness` exposes a `bridgeCalls` array that captures every `sendAndWait` invocation.
   - What's unclear: Whether the harness suffices, or if the integration test needs a real WebSocket pair from `tests/mcp-smoke-harness.js:273-291 startBridgeHarness()`.
   - Recommendation: Use the existing tool harness. Send N parallel tool invocations through `harness.getHandler('navigate')` and assert that exactly one `bridgeCalls` entry has `message.type === 'agent:register'`. Real-bridge testing is Phase 244 territory.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Tests, build | ✓ | ≥18 (engines field) | — |
| TypeScript | Build | ✓ | (project-managed via mcp/package.json) | — |
| `@modelcontextprotocol/sdk` | Server runtime | ✓ | `^1.27.1` | — |
| `zod` | Schema validation | ✓ | `^3.x` | — |
| `ws` | Bridge transport | ✓ | (transitive) | — |
| Phase 237 registry | `agent:*` route handlers | ✓ | `globalThis.fsbAgentRegistryInstance` live after SW boot | NONE — phase 237 is hard dependency |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** None.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Plain Node `assert` style (custom `assert(cond, msg)` + `assertDeepEqual` helpers; matches existing repo convention seen in mcp-tool-smoke.test.js, agent-registry.test.js, mcp-visual-session-contract.test.js) |
| Config file | None — tests are standalone Node files. `package.json` `test` script chains them via `&&` |
| Quick run command | `node tests/agent-scope.test.js` (per new test, < 1s typical) |
| Full suite command | `npm test` (chains ~50 tests; ~30-60s) plus `npm run test:mcp-smoke:tools` (which includes `npm --prefix mcp run build` first) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AGENT-04 (closure) | One MCP process mints exactly one `agent_id` and reuses it for all tool calls | unit | `node tests/agent-scope.test.js` | ❌ Wave 0 |
| D-03 race | Concurrent first callers share one in-flight `agent:register` | unit | `node tests/agent-scope.test.js` (concurrency group) | ❌ Wave 0 |
| D-04 throw-on-failure | Failed mint does not poison subsequent retries | unit | `node tests/agent-scope.test.js` (failure group) | ❌ Wave 0 |
| D-12 register handler | `agent:register` ignores caller-supplied id; calls registry; returns `{ success, agentId, agentIdShort }` | unit | `node tests/agent-bridge-routes.test.js` | ❌ Wave 0 |
| D-09 release handler | `agent:release` calls `agentRegistry.releaseAgent` and returns `{ success, released }` | unit | `node tests/agent-bridge-routes.test.js` | ❌ Wave 0 |
| D-10 status handler | `agent:status` returns `{ success, agentId, agentIdShort, tabIds: [] }` for the caller's id | unit | `node tests/agent-bridge-routes.test.js` | ❌ Wave 0 |
| ROADMAP SC#3 | `agentId` present in `payload` for autopilot, manual, visual-session sendAndWait calls | integration | `node tests/mcp-tool-smoke.test.js` (after smoke updates) | ✅ existing — needs update |
| ROADMAP SC#4 regression | Existing autopilot/manual/visual-session contract tests pass unchanged | regression | `npm test && npm run test:mcp-smoke:tools` | ✅ existing |
| D-13.4 integration | `agent:register` fires exactly ONCE across N parallel tool invocations | integration | `node tests/agent-id-threading.test.js` | ❌ Wave 0 |
| D-14 ignore posture | Extension handlers do not error on payload with extra `agentId` field | regression | `node tests/mcp-visual-session-contract.test.js` + `node tests/mcp-tool-routing-contract.test.js` (existing assertions cover unknown-field tolerance) | ✅ existing |
| D-15 no extension behavior change | No new error codes or response fields surface from existing handlers | regression | full `npm test` | ✅ existing |

### Sampling Rate
- **Per task commit:** `node tests/agent-scope.test.js` and `node tests/agent-bridge-routes.test.js` (whichever surface that task touched)
- **Per wave merge:** `npm --prefix mcp run build && node tests/agent-scope.test.js && node tests/agent-bridge-routes.test.js && node tests/agent-id-threading.test.js && node tests/mcp-tool-smoke.test.js`
- **Phase gate:** Full `npm test` green AND `npm run test:mcp-smoke:tools` green AND `node tests/mcp-tool-smoke.test.js` payload assertions actively check `agentId` presence (not loosened to ignore it)

### Wave 0 Gaps
- [ ] `tests/agent-scope.test.js` — covers AgentScope class behavior (lazy mint, race, throw-on-failure)
- [ ] `tests/agent-bridge-routes.test.js` — covers handleAgentRegisterRoute / handleAgentReleaseRoute / handleAgentStatusRoute against a mocked `globalThis.fsbAgentRegistryInstance`
- [ ] `tests/agent-id-threading.test.js` — integration: N parallel tool invocations through `createToolHarness`, assert exactly one `agent:register` call in `harness.bridgeCalls`
- [ ] Update `tests/mcp-tool-smoke.test.js` — payload `assertDeepEqual` calls for `mcp:execute-action`, `mcp:start-automation`, `mcp:stop-automation`, `mcp:start-visual-session`, `mcp:end-visual-session` need to include the expected `agentId` field; test harness must respond to `agent:register` with a deterministic `{ success: true, agentId: 'agent_test_...', agentIdShort: 'agent_test' }`
- [ ] (Optional, MAY skip in P238) Update `tests/mcp-tool-routing-contract.test.js` to add `agent:register` / `agent:release` / `agent:status` to `requiredMessageRoutes` so the contract test actively asserts they exist. Today's test will pass without this update because it tests for inclusion, not exclusivity. Adding now strengthens the contract and is low-cost.

## Project Constraints (from CLAUDE.md)

CLAUDE.md is short and the directives are global rather than P238-specific:
- **No emojis in any markdown, terminal logs, or code.** Phase 237 plan-03 SUMMARY.md already calls this out (`[FSB AGT]`, `[FSB AgentScope]` are pure-ASCII prefixes). Plan and verification scripts must grep for emojis (`grep -P '[\x{1F300}-\x{1FAFF}]'`) and reject any in changed files.
- **Never auto-run applications.** Plan tasks must NOT include "load extension into Chrome and click Run." UAT instructions are documented in 237-03 SUMMARY style (numbered manual steps), not automated commands. The `node tests/agent-scope.test.js` style commands are fine because they're test runs, not application runs.
- **Honor user instructions over default behavior.** This phase has CONTEXT.md as user-locked decisions; planner must defer to D-01..D-16 verbatim.

## Sources

### Primary (HIGH confidence)
- `mcp/src/runtime.ts` (full file) — composition root structure
- `mcp/src/types.ts` (full file) — MCPMessage / MCPMessageType / MCPResponse shapes
- `mcp/src/bridge.ts:1-60, 130-230` — WebSocketBridge.sendAndWait signature and behavior
- `mcp/src/tools/autopilot.ts` (full file) — three sendAndWait sites and current payload shape
- `mcp/src/tools/manual.ts` (full file) — execAction funnel and 25+-tool fan-out
- `mcp/src/tools/visual-session.ts` (full file) — two sendAndWait sites
- `mcp/src/tools/agents.ts` (full file) — confirmed all bodies are commented out (D-08 baseline)
- `mcp/src/tools/observability.ts`, `read-only.ts`, `vault.ts`, `resources/index.ts`, `diagnostics.ts` — confirmed sendAndWait sites OUT of D-06 scope
- `mcp/src/queue.ts` — TaskQueue read-only-tools-bypass invariant unchanged by P238
- `mcp/package.json` — version 0.7.4, ESM, Node 18+, mcp-smoke pipeline
- `extension/ws/mcp-tool-dispatcher.js:1-200, 565-715` — MCP_PHASE199_MESSAGE_ROUTES table and handler functions (exact insertion sites)
- `extension/utils/agent-registry.js:1-100` — confirmed registry exports and globalThis surface
- `extension/background.js:781-799, 2543-2555` — confirmed live handle is `globalThis.fsbAgentRegistryInstance`, NOT `globalThis.agentRegistry`
- `tests/mcp-tool-smoke.test.js` (full file) — confirmed 12 `assertDeepEqual` payload sites that will break
- `tests/mcp-visual-session-contract.test.js:397-465` — confirmed assertions are by field name, not deep-equal
- `tests/mcp-tool-routing-contract.test.js` (full file) — confirmed test allows new routes additively
- `tests/mcp-smoke-harness.js` — `createToolHarness`, `loadBuildModule` patterns the new tests will reuse
- `.planning/phases/237-agent-registry-foundation/237-01-SUMMARY.md, 237-02-SUMMARY.md, 237-03-SUMMARY.md` — exact registry CRUD surface, storage envelope, hydration boot site
- `.planning/phases/238-agentscope-bridge-wiring/238-CONTEXT.md` — the locked decisions D-01..D-16
- `.planning/REQUIREMENTS.md` — AGENT-01..04 mapping and Traceability table
- `.planning/ROADMAP.md` — Phase 238 success criteria #1-4

### Secondary (MEDIUM confidence)
- (None — every claim above grounded in primary source)

### Tertiary (LOW confidence)
- (None — Context7 / WebSearch were not needed since this phase is entirely repo-internal plumbing on a stable SDK)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every version verified from `mcp/package.json` and import statements
- Architecture: HIGH — all four target files read end-to-end; `register*Tools` signatures confirmed; runtime composition root inspected
- Pitfalls: HIGH — Pitfalls 1-7 each grounded in a specific file:line cite. Pitfall 5 (race during disconnect) is the only one inferred rather than empirically tested in this session.
- Phase 237 surface: HIGH — three SUMMARY.md files plus the live `extension/utils/agent-registry.js` and the actual `extension/background.js` integration sites read directly.
- Test impact: HIGH — every existing test that could be affected was opened and inspected for `assertDeepEqual.*payload` patterns or for direct dispatcher calls.

**Research date:** 2026-05-05
**Valid until:** 2026-06-05 (30 days; this phase is repo-internal and the surface is stable)

## RESEARCH COMPLETE
