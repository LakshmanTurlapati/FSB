# Phase 238: AgentScope + Bridge Wiring - Context

**Gathered:** 2026-05-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Server-side groundwork for v0.9.60 multi-agent tab concurrency. Mint a per-MCP-process `agent_id` via a new lazy `AgentScope`, thread it into every `bridge.sendAndWait` payload from the four tool families (`autopilot.ts`, `manual.ts`, `visual-session.ts`, `agents.ts`), and add three new bridge message routes (`agent:register`, `agent:release`, `agent:status`) that resolve through the Phase 237 `AgentRegistry`. The extension destructures but does not act on `agentId` -- enforcement lands in Phase 240.

In scope:
- New `mcp/src/agent-scope.ts` (per-process singleton; lazy mint; cached-promise race; throw-on-failure)
- `AgentScope` plumbed through `createRuntime()` in `mcp/src/runtime.ts` and into every `register*Tools(server, bridge, queue, agentScope)` call
- Inline `await agentScope.ensure(bridge)` in every `sendAndWait` call site across the four tool files
- `agentId` placed at the top level of the existing `payload` object (not nested, not bridge-envelope metadata)
- New `MCP_PHASE199_MESSAGE_ROUTES` entries for `agent:register` / `agent:release` / `agent:status`, with handlers that call into `globalThis.agentRegistry`
- Extension handlers add `const { agentId } = payload || {}` reads (used nowhere in P238) so the P240 diff is small
- Unit tests for `AgentScope` (lazy mint, race, throw-on-failure), unit tests for the three new routes, contract-test pass for existing autopilot/manual/visual-session

Out of scope (later phases own these):
- Tool dispatch ownership enforcement / cross-agent reject (Phase 240)
- `bridge.onclose` -> `agent:release` with `RECONNECT_GRACE_MS` grace window (Phase 241)
- Concurrency cap enforcement at `agent:register` (Phase 241)
- `chrome.tabs.onCreated` + `openerTabId` pooling (Phase 241)
- Visual-session storing `agentId` alongside `clientLabel` (Phase 240 for OWN-04 read; not P238)
- `back` MCP tool registration in `agents.ts` (Phase 242)
- Badge / sidepanel / popup `agent_id` surfacing (Phase 243)

</domain>

<decisions>
## Implementation Decisions

### AgentScope mechanics

- **D-01: Per-process singleton lifetime.** One `AgentScope` instance per MCP server process. `agent_id` is minted on first tool call and reused for the lifetime of the process. Multiple parallel agents from one MCP client = multiple MCP processes (matches ARCHITECTURE.md §3.3 and the milestone's "one MCP process = one agent" framing). Confirms AgentScope is a process-singleton, not request-scoped.

- **D-02: clientLabel deferred -- `agent:register` carries no label in P238.** Phase 237 D-04 already declared the registry connection-agnostic. AgentScope passes no `clientLabel` on register; the registry record stores `clientLabel = null`. The v0.9.36 visual-session allowlist remains the only place callers must declare a trusted label. Wiring `clientLabel` into `AgentRecord` is deferred (likely Phase 241 alongside `connection_id`, or Phase 243 when the badge needs it).

- **D-03: Cached-promise race control.** First caller of `ensure()` assigns `this._pending = bridge.sendAndWait('agent:register', ...)`. Concurrent callers `await` the same promise. On success: set `this.agentId`, clear `this._pending`. Idiomatic JS; no module-level mutex. The `withRegistryLock` shape from `agent-registry.js` is intentionally NOT mirrored here -- it would be over-engineering for a one-shot lazy init.

- **D-04: Throw-on-failure, no caching.** `agent:register` failures (bridge disconnect now; cap-reached in P241) reject the `ensure()` promise and DO NOT cache the failure. Next tool call retries cleanly. Lets each tool's existing `extension_not_connected` error path handle the surface error consistently, and avoids the "cap-reached cache poisons future retries" trap.

### Payload threading shape

- **D-05: `agentId` at the top level of `payload`.** Wire format: `{ type: 'mcp:execute-action', payload: { tool, params, agentId } }`. Mirrors how `taskId` / `sessionId` are threaded today. Phase 240 reads `payload.agentId`. Rejected alternatives: nested `payload.agent: { id, label }` (heavier change, every handler relearns the shape) and bridge-level `MCPMessage.agentId` (forces edits to `types.ts` and `WebSocketBridge.sendAndWait` signature -- wrong layering for P238).

- **D-06: Inline injection at each call site.** In `autopilot.ts` (3 handlers), `manual.ts` (one `execAction` funnel), and `visual-session.ts` (2 handlers), each `sendAndWait` site explicitly calls `const agentId = await agentScope.ensure(bridge)` before building the payload. Greppable, easy to audit during P244 hardening, and avoids hiding the threading inside a helper. The `manual.ts` funnel already exists -- one insertion point covers all 25+ manual tools.

- **D-07: `ensure()` called inside each tool handler, before `sendAndWait`.** Matches the lazy semantic ROADMAP SC #1 requires. After the first call, `ensure()` returns the cached promise's resolved value -- subsequent calls are effectively free. Eager startup minting is rejected because it couples server boot to bridge availability, which is fragile when the extension boots after the MCP server.

- **D-08: `agents.ts` is structurally a no-op for P238 -- add an import + comment marker only.** All `server.tool()` calls in `agents.ts` are commented out per the v0.9.45rc1 deprecation policy. P238 imports `AgentScope`, leaves a `// TODO Phase 242: thread agentScope into back tool` comment, and adds nothing else. Phase 242's `back` tool inherits the threading pattern from D-06 when it lands. CONTEXT.md documents this so the verification step in /gsd-verify-phase doesn't flag a gap against ROADMAP SC #3.

### `agent:*` route scope in Phase 238

- **D-09: `agent:release` route ships with handler only -- no server-side caller in P238.** The extension-side handler calls `agentRegistry.releaseAgent(agentId)`. The MCP server does NOT wire `bridge.onclose -> agent:release` here -- that work belongs in Phase 241 alongside the `RECONNECT_GRACE_MS` window. Calling release on every transient close in P238 would release too aggressively and complicate the P241 lifecycle work.

- **D-10: `agent:status` returns the caller's agent only.** Shape: `{ success: true, agentId, agentIdShort, tabIds: [] }`. Echoes back what `AgentScope` already knows plus the registry's view of bound tabs (always empty in P238 since binding lands in P240). Useful for self-introspection / smoke tests. Full registry snapshot is rejected because it would leak cross-agent state to any caller before ownership enforcement is in place.

- **D-11: `agentScope` plumbed through `FSBRuntime` and injected into every `register*Tools` call.** `createRuntime()` in `mcp/src/runtime.ts` instantiates `AgentScope` and passes it as the 4th argument to `registerAutopilotTools / registerManualTools / registerVisualSessionTools / registerAgentTools / registerObservabilityTools / registerReadOnlyTools / registerVaultTools`. Explicit dependency injection mirrors the existing `bridge` and `queue` threading. Module-level singleton imports are rejected because they create implicit global state that complicates testing.

- **D-12: `agent:register` route handler calls `agentRegistry.registerAgent()`.** AGENT-01 ("FSB-side mint, callers cannot supply IDs") is honored on the extension side -- the route handler ignores any `agentId` in the request payload and calls into the P237 registry which mints fresh via `crypto.randomUUID()`. Returns `{ success: true, agentId, agentIdShort }`.

### Test strategy

- **D-13: Unit + contract test surface.**
  1. Unit-test `AgentScope`: lazy mint (one `agent:register` for N tool calls), concurrent-first-call race (N concurrent calls share one in-flight register), throw-on-failure (rejected `ensure` does not poison the cache).
  2. Unit-test the three new bridge routes against a mocked `agentRegistry`.
  3. Existing autopilot / manual / visual-session contract tests pass unchanged with the new payload shape (ROADMAP SC #4 requirement).
  4. One integration test asserting `agent:register` fires exactly once across N tool calls in the same MCP process.

  Multi-process e2e smoke is rejected for P238 -- there's no enforcement to verify yet, and the harness work is heavier than the plumbing being tested. That belongs in Phase 244.

### Extension-side ignore posture

- **D-14: Read-but-don't-act in P238 handlers.** Each affected extension handler (`handleStartAutomationRoute`, `handleStopAutomationRoute`, `handleGetStatusRoute`, `handleStartVisualSessionRoute`, `handleEndVisualSessionRoute`, `handleNavigateRoute`, `handleNavigationHistoryRoute`, `handleOpenTabRoute`, `handleSwitchTabRoute`, `handleListTabsRoute`, `handleExecuteJsRoute`, `handleReadPageRoute`, `handleGetDomSnapshotRoute`, plus the 4 task-status routes) gets a `const { agentId } = payload || {};` line that's used nowhere. Phase 240 fills in the validation. The destructure already existing means the P240 diff per handler is one new check, not a destructure + check.

- **D-15: No proactive handler audit beyond the destructure.** JS destructuring tolerates unknown fields by default; the dispatcher already passes payload opaquely. The "audit all 25+ tool routes for unknown-field rejection" option is rejected as redundant work -- contract tests confirm absence of regressions.

- **D-16: Visual-session manager (`extension/utils/mcp-visual-session.js`) is NOT modified in P238.** Stashing `agentId` alongside `clientLabel` on the visual-session record is deferred to Phase 240 (the OWN-04 cross-agent-reject phase). This preserves all v0.9.36 contract tests byte-for-byte through P238.

### Claude's Discretion

The following implementation details were not explicitly discussed; planner may decide:

- **Exact `AgentScope` API shape**: recommended public surface is `class AgentScope { ensure(bridge): Promise<string>; current(): string | null; reset(): void }`, where `reset()` is a test-only escape hatch. Planner may rename or split.
- **Where the "TODO Phase 242" marker comment lives in `agents.ts`**: top-of-file is fine; content of the marker is up to the planner so long as it cross-references both `agentScope` import usage and Phase 242.
- **Test file locations**: existing FSB convention is `mcp/test/` for server-side unit tests; planner may follow or call out a deviation. The integration test that asserts "register fires once across N calls" can sit alongside contract tests in `mcp/test/contract/`.
- **Logging in `AgentScope.ensure()`**: a single `[FSB AgentScope]` console.error on first mint and on failure is reasonable; planner may add or trim.
- **TypeScript strictness for the new `agent_id` field on payload types**: existing `MCPMessage.payload` is `Record<string, unknown>` which already accepts the field. Planner may tighten the type if convenient; not required.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### v0.9.60 milestone planning
- `.planning/REQUIREMENTS.md` -- AGENT-01..04 (P237 already covers structural identity; P238 closes coverage by exposing it server-side); read OWN-01..05 to understand what P240 will read from the threaded `agentId`
- `.planning/ROADMAP.md` -- Phase 238 success criteria (lines 57-67); Phase 237 dependency note; Phase 240 reference for "extension ignores until..."
- `.planning/research/SUMMARY.md` -- "no new npm dependencies" rationale
- `.planning/research/STACK.md` -- `@modelcontextprotocol/sdk` boundary; Zod schema patterns
- `.planning/research/ARCHITECTURE.md` -- §3.3 (`mcp/src/agent-scope.ts` proposal); §4.1 (per-file thread-through table); §10 Phase B (build order)
- `.planning/research/PITFALLS.md` -- relevant pitfalls around storage timing and registry timing

### Prior-phase context (do not re-discuss; carry forward)
- `.planning/phases/237-agent-registry-foundation/237-CONTEXT.md` -- D-01 (registry path), D-02 (`formatAgentIdForDisplay`), D-04 (connection-agnostic; `connection_id` deferred to P241)

### MCP server surface (must read before writing AgentScope or modifying tool files)
- `mcp/src/runtime.ts` -- `createRuntime()` composition root; AgentScope is added here as a 4th DI argument
- `mcp/src/bridge.ts:153-201` -- `WebSocketBridge.sendAndWait()` signature and `MCPMessage` shape (do NOT modify; payload threading is purely additive)
- `mcp/src/types.ts` -- `MCPMessage` and `MCPResponse` types
- `mcp/src/tools/autopilot.ts:23-99` -- `run_task` / `stop_task` / `get_task_status` registration; three `sendAndWait` call sites that need `agentId`
- `mcp/src/tools/manual.ts:19-83` -- `execAction` funnel; one insertion point for all 25+ manual tools
- `mcp/src/tools/visual-session.ts:32-92` -- two `sendAndWait` call sites; visual-session ignores `agentId` per D-16
- `mcp/src/tools/agents.ts` -- structurally no-op for P238 per D-08; verify deprecation comments stay intact
- `mcp/src/tools/read-only.ts`, `mcp/src/tools/observability.ts`, `mcp/src/tools/vault.ts` -- not in ROADMAP SC #3 scope but `register*Tools` signatures pick up the new `agentScope` arg per D-11

### Extension surface (touch only minimally per D-14, D-15, D-16)
- `extension/ws/mcp-tool-dispatcher.js:48-65` -- `MCP_PHASE199_MESSAGE_ROUTES` table; add `agent:register` / `agent:release` / `agent:status` entries here
- `extension/ws/mcp-tool-dispatcher.js:113-154` -- `dispatchMcpToolRoute` and `dispatchMcpMessageRoute`; do NOT modify dispatch logic in P238
- `extension/utils/agent-registry.js` -- already exposes `registerAgent`, `releaseAgent`, `listAgents`, `getAgentTabs`, `formatAgentIdForDisplay`; new route handlers call these via `globalThis.agentRegistry`
- `extension/background.js` -- listing of route handlers (`handleStartAutomationRoute`, etc.) that need the read-but-don't-act destructure per D-14
- `extension/utils/mcp-visual-session.js` -- NOT modified in P238 per D-16; preserve byte-for-byte for v0.9.36 contract tests

### Project context
- `.planning/PROJECT.md` -- v0.9.60 Current Milestone block; v0.9.36 visual-session decisions
- `CLAUDE.md` -- project-level conventions (no emojis in logs/markdown; never auto-run apps)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`mcp/src/runtime.ts`** -- composition root with `bridge`, `queue`, `server`. Natural home for the `AgentScope` singleton; the existing 3-arg threading pattern through `register*Tools` extends cleanly to 4 args.
- **`mcp/src/tools/manual.ts:19-52`** -- `execAction()` funnel handles all 25+ manual tools. One insertion point covers the entire family.
- **`extension/utils/agent-registry.js`** -- Phase 237 ships `registerAgent`, `releaseAgent`, `listAgents`, `getAgentTabs`, `formatAgentIdForDisplay`, `withRegistryLock`. New route handlers consume this module without modification.
- **`extension/ws/mcp-tool-dispatcher.js:48-65`** -- `MCP_PHASE199_MESSAGE_ROUTES` is the canonical chokepoint for new bridge message types. Add three entries.
- **Phase 237 plan-03 background.js wiring** -- `bootstrapAgentRegistry` already runs and `globalThis.agentRegistry` is set before any dispatcher work. New route handlers can rely on it being live.

### Established Patterns
- **DI threading via `register*Tools(server, bridge, queue, ...)`** -- extending to a 4th `agentScope` argument matches existing convention.
- **Lazy promise caching for one-shot async init** -- standard JS pattern; no library or mutex needed.
- **`MCP_PHASE199_MESSAGE_ROUTES` entries with `handler:` callbacks** -- existing pattern for new bridge message types; `agent:*` follows the same shape.
- **Read-but-don't-act destructuring** -- pre-stages future validation while keeping P238 behaviorally inert.
- **No emojis in logs / markdown** (CLAUDE.md rule); `[FSB AgentScope]` prefix follows the FSB family (`[FSB AGT]`, `[FSB DLG]`, `[FSB BG]`, ...).

### Integration Points
- `mcp/src/runtime.ts:createRuntime()` -- instantiate `AgentScope`, pass through 7 `register*Tools` calls.
- `mcp/src/tools/autopilot.ts` lines 23, 67, 84 -- three `sendAndWait` sites get `await agentScope.ensure(bridge)` and `agentId` in payload.
- `mcp/src/tools/manual.ts:36` -- one `execAction` funnel; one insertion point.
- `mcp/src/tools/visual-session.ts:55, 80` -- two sites.
- `mcp/src/tools/agents.ts` -- import + TODO marker comment only (D-08).
- `extension/ws/mcp-tool-dispatcher.js:48-65` -- three new route entries calling `globalThis.agentRegistry.registerAgent / releaseAgent / listAgents`.
- `extension/background.js` -- read-but-don't-act destructure in each handleXxxRoute (D-14); no behavior change.

</code_context>

<specifics>
## Specific Ideas

- **Inline `await agentScope.ensure(bridge)` is the audit anchor.** Make it grep-friendly so the P244 hardening pass can confirm every `bridge.sendAndWait` payload that ships from a tool handler carries `agentId`. The "wrap bridge" alternative was rejected specifically to preserve this auditability.
- **`payload.agentId` (top-level) is the wire-format contract.** Phase 240 reads this exact path; do not nest it, do not promote it to envelope metadata. Future evolution (e.g., adding `clientLabel` later) extends the same level.
- **Test that `agent:register` fires exactly once.** The lazy + cached pattern is exactly the kind of code that subtly breaks under burst concurrency. The integration test asserting one register per process across N tool calls is a load-bearing check.
- **`agents.ts` is intentionally untouched-except-for-marker.** Any verification step that sees "agent_id threaded into agents.ts" should accept the comment marker + import as the deliberate, documented stance.
- **No emojis anywhere.** `[FSB AgentScope]` console error prefix; no glyphs in logs, in TODO comments, in CONTEXT.md.

</specifics>

<deferred>
## Deferred Ideas

- **`bridge.onclose -> agent:release` with `RECONNECT_GRACE_MS` window** -- Phase 241 (LOCK-02). Holds for the same reason `connection_id` was deferred from P237: the lifecycle work is one connected slice and shouldn't be split.
- **`clientLabel` on `AgentRecord`** -- Phase 241 alongside `connection_id`, OR Phase 243 when the badge consumes it.
- **Visual-session storing `agentId`** -- Phase 240 OWN-04. Keeps v0.9.36 contract tests untouched in P238.
- **Concurrency cap enforcement at `agent:register`** -- Phase 241 POOL-01..02 with the typed `AGENT_CAP_REACHED` error.
- **`back` MCP tool registration in `agents.ts`** -- Phase 242. Uses the AgentScope threading pattern this phase establishes.
- **End-to-end multi-MCP-process smoke (verifying distinct `agent_id` per process)** -- Phase 244 regression suite.
- **Per-agent queue scoping** -- ARCHITECTURE.md §4.4 trade-off; recommendation is one-process-one-agent. Defer per-agent queues to a later milestone.
- **MCP `initialize.clientInfo.name` -> `clientLabel`** -- considered for D-02 then dropped because the names don't 1:1 the FSB allowlist. Reconsider when label sourcing returns.

</deferred>

---

*Phase: 238-agentscope-bridge-wiring*
*Context gathered: 2026-05-05*
