# Phase 237: Agent Registry Foundation - Context

**Gathered:** 2026-05-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the keystone module that owns "who owns which tab" for v0.9.60 multi-agent tab concurrency: in-memory Maps + `chrome.storage.session` write-through mirror + SW-wake reconciliation against `chrome.tabs.query({})` + promise-chain mutex. **No enforcement yet** -- the dispatch gate lands in Phase 240. This phase only delivers structural plumbing that every later phase imports from.

In scope:
- `agent_id` minting (FSB-side, `crypto.randomUUID()`)
- Three Maps: `agents`, `tabOwners`, `tabsByAgent`
- `chrome.storage.session` mirror under a stable key
- `hydrate()` reconciliation on SW wake
- `withRegistryLock` promise-chain mutex
- `chrome.tabs.onRemoved` -> `releaseTab(tabId)` (idempotent; structural only, no enforcement)
- Diagnostic event emission on ghost-record drop

Out of scope (later phases own these):
- Tool dispatch ownership enforcement (Phase 240)
- Forced-new-tab pooling, cap, reconnect grace (Phase 241)
- `connection_id` linkage between MCP transport and agent_id (Phase 241)
- Server-side `AgentScope` and bridge-message routes (Phase 238)
- UI surfaces / badges (Phase 243)

</domain>

<decisions>
## Implementation Decisions

### D-01: Module Location -- `extension/utils/agent-registry.js`

The new keystone module lives at `extension/utils/agent-registry.js`, co-located with `extension/utils/mcp-visual-session.js`. This maximizes pattern parity with the v0.9.36 visual-session manager (storage-keyed, SW-resilient, hydrate-on-wake) and avoids semantic confusion with the deprecated `extension/agents/` directory (which still holds the v0.9.45rc1 sunset background-agent code -- `agent-executor.js`, `agent-manager.js`, `agent-scheduler.js`, `server-sync.js` -- per the "comment-out, not delete" policy).

**Loading:** Imported via `importScripts('utils/agent-registry.js', ...)` in `background.js` BEFORE `ws/mcp-tool-dispatcher.js` so the registry exists by the time any dispatch-related code initializes.

**Why not `extension/agents/`:** The directory's namespace is reserved for sunset code with the canonical `// DEPRECATED v0.9.45rc1: superseded by OpenClaw / Claude Routines` annotation. Reusing it for live multi-agent concerns would muddle that boundary.

### D-02: `agent_id` Format -- Hybrid (Full UUID Internal, 6-char Short Prefix Surfaced)

Each agent gets a full UUID internally (`agent_<full-uuid>`), e.g. `agent_550e8400-e29b-41d4-a716-446655440000`. This is the canonical key in every Map and the storage payload.

For surfaced contexts (logs, the v0.9.36 trusted-client badge in Phase 243, sidepanel/popup "owned by Agent X" badge, MCP error payloads), the registry exposes a helper that returns a short 6-char prefix (`agent_550e84`).

**Implementation hint for planner:** Single source of truth -- the registry exposes `formatAgentIdForDisplay(agentId)` returning `agent_<first-6-hex-after-prefix>`. All UI / log call sites use this helper rather than slicing IDs locally.

### D-03: Reconciliation Policy -- Drop + Emit Diagnostic

On SW wake, `hydrate()` iterates persisted records and calls `chrome.tabs.get(tabId)` for each. If the tab no longer resolves (`chrome.runtime.lastError` set, or `tab` undefined), the record is dropped from in-memory Maps AND from the `chrome.storage.session` payload.

Each drop emits a structured event:
```js
{
  type: 'agent:reaped',
  agentId: '<full uuid>',
  tabId: <numeric>,
  reason: 'tab_not_found' | 'tab_in_other_window' | 'reconcile_error',
  timestamp: <ms>,
  agentIdShort: 'agent_xxxxxx'
}
```

**Distribution:** Emit through the existing diagnostic ring buffer pattern (FSB has `chrome.storage.local.fsb_diagnostics_ring` from Phase 211 LOG-04). Reuse that path with a `[FSB AGT]` prefix and rate-limit (1 warn per category per 10s).

**Why:** Cheap insurance against silent state loss. Future telemetry / dashboards can read reaping-rate, and ghost-record bugs surface immediately rather than as inscrutable "agent missing" errors three phases later.

### D-04: AGENT-04 Scope Split

Phase 237's contribution to AGENT-04 ("one MCP client may run multiple parallel agents simultaneously, each with its own `agent_id`") is **the registry's connection-agnostic posture**: any number of independent `agent_id`s may be registered concurrently with no client-grouping or coupling. The registry does NOT track `connection_id` or any MCP-process notion in this phase.

The connection lifecycle pieces -- `connection_id` on records, bridge `onclose` -> reconnect-grace window, lock release on transport drop -- all land in **Phase 241**. AGENT-04 is therefore co-mapped: 237 satisfies the data-structural requirement; 241 satisfies the lifecycle requirement.

**Implication for planner / researcher:** Don't add a `connection_id` field to `AgentRecord` in 237. Phase 241 will introduce it cleanly when wiring lifecycle.

### Claude's Discretion

The following implementation details were not explicitly discussed; planner may decide:

- **Storage key name:** Default to `fsbAgentRegistry` (matches `MCP_VISUAL_SESSION_STORAGE_KEY` casing convention). Versioned payload shape `{ v: 1, records: { ... } }` recommended for forward-migration safety, mirroring lessons from prior FSB shape-bumps.
- **Mutex implementation:** Promise-chain mutex (`let chain = Promise.resolve(); withRegistryLock = (fn) => (chain = chain.then(fn, fn)).finally(...)`). Single SW thread + no async-mutex lib per research guidance.
- **Test pattern:** Whatever the existing FSB test convention is -- `tests/` at repo root, jsdom-backed, `chrome.*` mocked. New file: `tests/agent-registry.test.js` covering CRUD, storage round-trip, simulated SW wake reconciliation, and 20-concurrent-claim TOCTOU stress.
- **Public API shape:** Recommended exports `{ registerAgent, releaseAgent, bindTab, releaseTab, isOwnedBy, getOwner, getAgentTabs, listAgents, formatAgentIdForDisplay, withRegistryLock, hydrate, _internal }`. Planner may rename for grep-friendliness.
- **Generation counter on tab tombstones:** Mentioned in research as the tab-ID-reuse defense. Phase 237 may include a stub generation field on records but **the actual tombstone semantics + ownership-token consumption land in Phase 240** when dispatch enforcement begins.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### v0.9.60 milestone planning
- `.planning/REQUIREMENTS.md` -- AGENT-01..04, all OWN/POOL/LOCK requirements (context for what 237 enables)
- `.planning/ROADMAP.md` -- Phase 237 success criteria + dependency graph
- `.planning/research/SUMMARY.md` -- Synthesized research recommendations (storage choice, mutex pattern, no new deps)
- `.planning/research/STACK.md` -- "No new npm dependencies" rationale; `crypto.randomUUID` and `chrome.storage.session` justification
- `.planning/research/ARCHITECTURE.md` -- Keystone-module + chokepoint design; agent lifecycle sequence
- `.planning/research/PITFALLS.md` -- P1 (registry dies with SW), P3 (pool over/under-release groundwork), P6 (cap TOCTOU mitigation)

### Pattern reference (must read before writing the new module)
- `extension/utils/mcp-visual-session.js` -- v0.9.36 storage-keyed pattern; lines 4-17 (constants), 50 (storage key), 85-200 (CRUD + storage), 563-589 (hydrate). The new registry mirrors this shape.

### Existing extension surface
- `extension/background.js` -- service worker entry; line 2455 `chrome.tabs.onRemoved` listener (extend with `releaseTab`); line 12616 second `onRemoved` site (must be coordinated to remain idempotent)
- `extension/manifest.json` -- confirm no new permissions needed (research-confirmed)
- `extension/ws/mcp-tool-dispatcher.js` -- the future Phase 240 enforcement chokepoint; do NOT modify in 237 but understand it exists at line 113 (`dispatchMcpToolRoute`)

### Diagnostic infrastructure (D-03 reuse target)
- `chrome.storage.local.fsb_diagnostics_ring` (Phase 211 LOG-04) -- existing 100-FIFO ring buffer + `redactForLog` helper + rate-limiting. Registry's `agent:reaped` events flow through this; do not invent a parallel logging stack.

### Project context
- `.planning/PROJECT.md` -- v0.9.60 Current Milestone block; v0.9.36 visual session decisions; v0.9.45rc1 deprecation policy for `extension/agents/`
- `CLAUDE.md` -- project-level conventions (no emojis in logs/markdown; never auto-run apps)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`extension/utils/mcp-visual-session.js`** -- direct pattern to mirror: storage key constant, in-memory Map mirror, `hydrate()` on wake, displacement vs reject semantics. Read before designing the registry's public API.
- **`extension/manifest.json`** -- `chrome.storage` (with `session`), `tabs`, `windows` permissions all already granted. No manifest changes required.
- **Diagnostic ring buffer (Phase 211)** -- `redactForLog` + `chrome.storage.local.fsb_diagnostics_ring` + rate-limiting. Ready to consume `agent:reaped` events without new infrastructure.
- **`crypto.randomUUID()`** -- available in MV3 service workers natively. No polyfill, no `uuid` package.

### Established Patterns
- **`importScripts` ordering matters** -- `background.js` boots SW modules in a specific order; the registry must load BEFORE `mcp-tool-dispatcher.js` and BEFORE any module that might call `agentRegistry.bindTab`. Exact order is a planner concern but the constraint is fixed.
- **Storage-keyed singletons** -- v0.9.36 visual-session is the canonical FSB shape: one named `chrome.storage.session` key, write-through mirror, hydrate-on-wake, in-memory Map authoritative for reads. Match this shape exactly.
- **`chrome.tabs.onRemoved` already wired in two places** (`background.js:2455` and `:12616`). The registry's `releaseTab` is invoked from a third site (or via shared helper); behavior must remain idempotent so duplicate calls are no-ops.
- **No emojis in logs** (CLAUDE.md global rule). The `[FSB AGT]` log prefix follows the existing `[FSB DLG] / [FSB BG] / [FSB WS] / [FSB DOM]` family from Phase 211.

### Integration Points
- `background.js` `importScripts(...)` call -- add `utils/agent-registry.js` before `ws/mcp-tool-dispatcher.js`.
- `chrome.tabs.onRemoved` listeners -- registry's `releaseTab` slots in alongside (or via shared) existing handlers; do NOT replace v0.9.36 visual-session cleanup.
- `chrome.storage.session` key namespace -- new key `fsbAgentRegistry` peer to `MCP_VISUAL_SESSION_STORAGE_KEY`; document in code comment.
- Diagnostic ring buffer -- registry calls into the existing `recordFSBTransportFailure` / equivalent helper from Phase 211 with the `[FSB AGT]` prefix.
- **Future** Phase 240 chokepoint at `mcp-tool-dispatcher.js:113` -- do not touch in 237; surface area must remain importable when 240 lands.

</code_context>

<specifics>
## Specific Ideas

- **Pattern parity over novelty:** The registry should look and feel like a sibling of `mcp-visual-session.js`. A reviewer should be able to scan both files side-by-side and see the same shape (constants block, in-memory Map declarations, public API, write-through helpers, `hydrate`).
- **`formatAgentIdForDisplay`:** Single helper for short-prefix display; never let UI / log call sites slice IDs locally. Phase 243's badge work and Phase 244's MCP tool descriptions both consume this helper.
- **Diagnostic-first reaping:** "Drop silently" is rejected. The user's posture is observability over silence -- if state gets lost, surface it.

</specifics>

<deferred>
## Deferred Ideas

- **`connection_id` field on AgentRecord** -- belongs in Phase 241 when reconnect-grace lifecycle lands. Do not add in 237.
- **Ownership token (UUID per claim) consumption** -- Phase 240 dispatch gate territory. Phase 237 may include a stub `generation` counter on records but actual tombstone semantics defer.
- **Telemetry rollup of reaping rate** -- could be a future dashboard surface; out of v0.9.60 scope. Phase 237 just emits the events; reading them is somebody else's milestone.
- **Per-agent rate-limiting / queueing** -- research recommended one-process-one-queue for v0.9.60; per-agent queues defer.
- **Stuck-slot reaping (idle timeout)** -- explicit non-feature for v0.9.60 per requirements OUT OF SCOPE; reconsider only if user reports stuck slots.
- **Schema migration tooling** -- the versioned payload shape (`{ v: 1, ... }`) is recommended forward insurance, but no migration code is needed in 237 (there's no v0 to migrate from).

</deferred>

---

*Phase: 237-agent-registry-foundation*
*Context gathered: 2026-05-05*
