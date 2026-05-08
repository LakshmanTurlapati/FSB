# Phase 241: Pooling, Configurable Cap, Reconnect Grace - Context

**Gathered:** 2026-05-06
**Status:** Ready for planning
**Source:** Auto-generated context (autonomous mode with recommended decisions)

<domain>
## Phase Boundary

Lifecycle correctness for the multi-agent registry: (a) forced-new-tab pooling under originating agent, (b) fail-loud cap enforcement at the (N+1)th claim, (c) configurable cap from options.html Advanced Settings (1-64, default 8), (d) RECONNECT_GRACE_MS bridge-disconnect window with connection_id keying, (e) idempotent + commutative tab/window close releasing the agent only when pool.size === 0.

Builds on Phase 240's chokepoint (cap enforcement uses the same withRegistryLock + sync registry reads). Phase 244 hardens regression / SW eviction / order-independence under load.

</domain>

<decisions>
## Implementation Decisions

### Pooling (POOL-01 .. POOL-06)

- **D-01 chrome.tabs.onCreated openerTabId pooling.** When `openerTabId` is set on the new tab, look up the opener's owning agent via `globalThis.fsbAgentRegistryInstance.findAgentByTabId(openerTabId)` (sync registry read; new method needed). If found: `bindTab(agentId, newTabId, { forced: true })` — pools the new tab under the same agent without minting a new agentId. The forced flag is stored on the tab metadata so observability/audit can distinguish forced binds from explicit ones.
- **D-02 Cap counts agents, not tabs.** The cap is on distinct agents. A pool with multiple tabs counts as ONE agent. The (N+1)th DISTINCT agent claim is rejected with AGENT_CAP_REACHED.

### Cap enforcement (POOL-02, POOL-03)

- **D-03 AGENT_CAP_REACHED { code, cap, active }.** Typed error per SC#2. Cap-check + insert is synchronous under withRegistryLock (Phase 237 mutex pattern). Verified by 20-concurrent-claim test producing exactly N successes.
- **D-04 LOG-04 emission on cap rejection.** Each rejection emits a single rate-limited diagnostic event family `agent-cap-reached` with shape `{cap, active, requestingClient}`. Operators can spot saturation in the LOG-04 ring buffer (Phase 237 diagnostics surface).
- **D-05 Configurable cap in options.html Advanced Settings.** Numeric input, range 1-64, integer-validated, default 8, reset-to-default button. Stored in chrome.storage.local under `fsbAgentCap` (NOT chrome.storage.session — this preference survives SW restart). Registry reads this on each cap-check (no caching needed; the SW context already serializes claims under withRegistryLock so reads are cheap).
- **D-06 Lower-cap grandfathering.** When operator lowers the cap while M > newCap agents are active: changes apply at NEXT claim only; existing agents stay (no forced eviction). New claims rejected with AGENT_CAP_REACHED until M drops below newCap. This matches SC#3.

### Reconnect grace (LOCK-01, LOCK-02)

- **D-07 RECONNECT_GRACE_MS = 10000 (10 seconds).** Default per SC#4. Long enough to absorb flaky-network reconnects; short enough that closing tabs feels prompt. Stored as a constant (not user-configurable in this phase — Phase 244 hardening can add tuning if needed).
- **D-08 connection_id is a per-bridge-connect randomUUID.** Stamped at bridge `onopen` time. Threaded through every bridge.sendAndWait payload as a separate field (alongside agentId, ownershipToken). When the bridge `onclose` fires, the registry stages the agent's pool for release at now() + RECONNECT_GRACE_MS, keyed by connection_id. A subsequent `onopen` with the SAME connection_id within the grace window cancels the staged release. Expiry fully releases the pool.
- **D-09 Grace-window release behavior.** On expiry: full pool release (every tab in the agent's pool gets `releaseTab`, then the agent record deletes). Emits a single LOG-04 event `agent-grace-expired { agentId, connectionId, poolSize }`. No user-visible UI change — releases happen silently in the background.

### Tab/window close semantics (LOCK-03, LOCK-04)

- **D-10 Per-tab onRemoved drives pool shrink.** chrome.tabs.onRemoved listener calls `releaseTab(tabId)` synchronously. Registry decrements the agent's pool; when pool.size === 0, the agent record is released (synchronous; no grace window — explicit close is intentional).
- **D-11 Window close iterates per-tab via existing onRemoved.** chrome.windows.onRemoved handler (if exists) just lets each tab's onRemoved fire naturally — no separate window-aware logic in the registry. This makes close events commutative and idempotent under tab-ID reuse.
- **D-12 finalizeSession releases cleanly.** When a task/session ends via finalizeSession, releaseTab fires for every owned tab in the pool; pool drains to 0; agent record releases. Same code path as last-tab-onRemoved.
- **D-13 No idle timeout.** Per ROADMAP. Agents persist until tab close, MCP disconnect (with grace), or finalizeSession.

### Claude's Discretion

- Implementation file placement for the new cap/grace logic — recommend extending `extension/utils/agent-registry.js` with the new functions (findAgentByTabId, getCap, setCap, stageRelease, cancelStagedRelease) rather than splitting into a sibling module. Keep the registry the single source of truth.
- options.html UI exact element structure — planner picks; numeric input + reset button is the spec.
- The metric ring-buffer event family names ('agent-cap-reached', 'agent-grace-expired') match Phase 237's `agent-reaped-tab_not_found` style.
- Whether `connection_id` extends Phase 238 D-10's status response shape — yes, the agent:status response now also returns the active connectionId so hosts can verify they're talking to the same agent across reconnects.
- Test framework: plain-Node assert per existing convention.

</decisions>

<canonical_refs>
## Canonical References

### Phase 241 contract sources
- `.planning/ROADMAP.md` (Phase 241 section — 5 SC; depends on Phase 240)
- `.planning/REQUIREMENTS.md` — POOL-01..POOL-06, LOCK-01..LOCK-04

### Existing call sites this phase modifies
- `extension/utils/agent-registry.js` (Phase 237/240) — extend with cap/grace/findAgentByTabId/staging APIs
- `extension/background.js` — chrome.tabs.onCreated listener (the forced-pool wiring); existing chrome.tabs.onRemoved already exists from Phase 237
- `extension/ws/mcp-bridge-client.js` (Phase 240) — bridge onopen mints connection_id; bridge onclose stages release
- `extension/options.html` + `extension/options.js` — Advanced Settings cap input + reset button
- `mcp/src/agent-scope.ts` (Phase 238/240) — connection_id capture from agent:register response (extend D-10 status response shape additively)

### Pattern parity references
- Phase 237 `withRegistryLock` mutex pattern — D-03 cap-check uses the same lock
- Phase 237 chrome.storage.session write-through — D-05 cap setting uses chrome.storage.LOCAL (not session) because cap is a preference, not session state
- Phase 240 ownershipToken bridge threading — D-08 connection_id threads the same way

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Phase 237 AgentRegistry singleton + withRegistryLock + LOG-04 diagnostics ring buffer
- Phase 240 bindTab signature with metadata cache; Phase 240 ownershipToken plumbing
- Existing chrome.storage.local read/write helper pattern (used by FSB config)
- Phase 237's `agent-reaped-tab_not_found` event family is the LOG-04 emission convention

### Established Patterns
- Sync registry reads from extension SW are cheap — no need to cache the cap value separately
- chrome.tabs.onRemoved already drives Phase 237's releaseTab; D-10 just makes the pool-shrink-to-zero release idempotent
- chrome.tabs.onCreated is event-driven; D-01's openerTabId pooling adds a new listener case (no listener-fan-out concerns since the registry handles dedup)

### Integration Points
- Bridge onopen/onclose hooks in mcp-bridge-client.js — D-08 connection_id mint + grace staging lives here
- options.html Advanced Settings tab — D-05 numeric input + reset button
- agent:status response — D-08 carve-out adds connectionId field

</code_context>

<specifics>
## Specific Ideas
- 10s grace is the smallest value that absorbs typical bridge flap (most reconnects within 2-3s); shorter values risk false-positive releases on flaky networks.
- Cap default 8 matches SC#3; range 1-64 is generous but prevents pathological extremes.
- chrome.storage.local for cap preference (not chrome.storage.session) — survives SW restart per typical FSB preference pattern.

</specifics>

<deferred>
## Deferred Ideas
- User-configurable RECONNECT_GRACE_MS — Phase 244 hardening if 10s proves too short or long in real-world testing.
- Per-agent grace window (different agents could have different grace) — too granular for v0.9.60.
- Forced eviction when cap is lowered — explicitly rejected per SC#3 (grandfathering); revisit only if operators demand it.
- Rate-limit / metering on agent claim attempts (DoS protection) — Phase 244 hardening.

</deferred>

---

*Phase: 241-pooling-configurable-cap-reconnect-grace*
*Context gathered: 2026-05-06 via autonomous (recommended decisions)*
