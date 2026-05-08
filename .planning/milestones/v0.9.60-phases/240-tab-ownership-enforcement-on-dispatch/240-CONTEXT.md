# Phase 240: Tab-Ownership Enforcement on Dispatch - Context

**Gathered:** 2026-05-06
**Status:** Ready for planning
**Source:** Smart discuss (autonomous mode, all recommendations accepted)

<domain>
## Phase Boundary

Trip the cross-agent ownership gate at every MCP tool call. The chokepoint is `dispatchMcpToolRoute` in `extension/ws/mcp-tool-dispatcher.js`: it verifies the tab is owned by the calling agentId (with per-claim ownership_token) in the same microtask as the handler invocation, with no `await` between check and dispatch. Mismatch returns typed errors (TAB_NOT_OWNED with full ownerAgentId, TAB_INCOGNITO_NOT_SUPPORTED, TAB_OUT_OF_SCOPE). Tabs opened via tool calls are bound to the originating agent. Visual-session same-agent re-entry resumes the prior session (preserves v0.9.36 idempotent-startSession contract). Legacy popup/sidepanel/autopilot surfaces work via three distinct `legacy:popup`, `legacy:sidepanel`, `legacy:autopilot` agentIds.

**This is the highest-risk phase in v0.9.60.** It depends on Phase 237 (registry) and Phase 238 (AgentScope). Phase 240 is where the agent_id field that Phase 238 threaded but the extension deliberately ignored finally tripts the gate.

</domain>

<decisions>
## Implementation Decisions

### Error contracts

- **D-01 Cross-agent rejection includes full ownerAgentId.** Reject shape: `{code: 'TAB_NOT_OWNED', ownerAgentId: '<full-agent-id>', requestedTabId, requestingAgentId}`. Best diagnostic on co-tenant MCP hosts; matches the agentId-leak risk we already accept on Phase 238's agent:status response. Hosts can correlate logs across agents that conflict.
- **D-05 Distinct typed codes for non-cross-agent rejections.** Three error codes in this phase:
  - `TAB_NOT_OWNED { ownerAgentId, requestedTabId, requestingAgentId }` — cross-agent mismatch (D-01)
  - `TAB_INCOGNITO_NOT_SUPPORTED { tabId }` — `chrome.tabs.get(...).incognito === true`
  - `TAB_OUT_OF_SCOPE { tabId, reason: 'cross_window' | 'non_current_window' }` — cross-window or non-current-window rejection
  Hosts can present clear messages; tooling can distinguish 'fix the call' (cross-agent) from 'this is a structural limit' (incognito/cross-window).

### Legacy surfaces

- **D-02 Each legacy surface is its own agent.** Three synthesized agentIds: `legacy:popup`, `legacy:sidepanel`, `legacy:autopilot`. Cleanest ownership semantics. Tabs opened by popup can be driven only by popup; sidepanel can't steal popup's tabs. Matches the multi-agent contract Phase 240 ships. Each legacy surface synthesizes its agentId at boot and registers it through the existing `agent:register` route from Phase 238 (with the standard caller-id-ignored, fresh-mint posture from D-12 of Phase 238 — but the extension surface knows to use the SAME `legacy:<surface>` constant on every dispatch, so cleanup-on-reload writes the same row back).

### Visual-session re-entry

- **D-03 Same-agent re-entry RESUMES the prior session.** When the same agent calls `startSession` on a tab it already owns, re-attach to the existing visual session (run the resume code path, not endSession-then-start). Smoothest UX; preserves the v0.9.36 idempotent-startSession contract that several FSB UI flows depend on. Cross-agent re-entry on the same tab still rejects with `tab_owned_by_other_agent` per SC#3.

### Ownership token

- **D-04 Per-bindTab opaque randomUUID token.** Each `bindTab(agentId, tabId)` mints a fresh `ownership_token = crypto.randomUUID()` stored alongside the binding in the registry record (the existing v: 1 envelope). The dispatch check is `isOwnedBy(tabId, agentId, ownership_token)` — all three must match. Defense-in-depth: even if an attacker steals or guesses agentId, they need the token (which never leaves the registry record on the extension side). The bridge payload threads `ownership_token` as a separate field alongside `agentId` from autopilot/manual/visual-session call sites — the AgentScope plumbing from Phase 238 captures it after the first agent:register call (the `agent:register` response now also returns the token for the initial bindTab — for run_task, the autopilot path performs an implicit bindTab as part of agent:register's first claim, mirroring how Phase 237 already binds the first tab).

### Locked from ROADMAP

- **D-06 Single chokepoint at dispatchMcpToolRoute** (SC#1) — the gate trips here, not distributed across handlers.
- **D-07 No `await` between check and dispatch** — same microtask. The check uses synchronous registry reads (Phase 237's registry already supports this).
- **D-08 bindTab calls before success return** in `handleNavigateRoute`, `handleNavigationHistoryRoute`, `handleOpenTabRoute`, and `handleStartAutomation` (SC#2). Tabs opened by these handlers are bound under the originating agentId before the success response goes back over the bridge.
- **D-09 mcp-visual-session.js:startSession rejects cross-agent re-entry with `tab_owned_by_other_agent`** (SC#3). This closes the v0.9.36 deferred badge/glow-collision gap.
- **D-10 Manifest posture: no incognito access** (SC#4). The manifest already lacks `incognito: 'split' | 'spanning'`; this phase only ADDS the runtime check that rejects incognito tabs by ID at dispatch.

### Claude's Discretion

The planner decides:
- Exact randomUUID source on the extension side: `crypto.randomUUID()` (available in MV3 SW context) vs a registry-internal helper. Recommend `crypto.randomUUID()` directly.
- Where the bindTab call lands inside each handler (before success return per D-08, but exactly where in each handler body).
- Error class hierarchy: introduce a `FsbOwnershipError` base class with three subclasses (TAB_NOT_OWNED, TAB_INCOGNITO_NOT_SUPPORTED, TAB_OUT_OF_SCOPE), or use plain payload objects with a `code` field. Recommend the latter for parity with Phase 238's plain-object error pattern.
- Test fixture naming: `tests/ownership-gate.test.js` for the dispatch-gate behavior; `tests/ownership-error-codes.test.js` (or merged) for the three typed codes; `tests/legacy-agent-synthesis.test.js` for the three legacy:<surface> agentId paths.
- Whether to introduce a new `extension/utils/ownership-gate.js` helper or inline the check in `dispatchMcpToolRoute`. Recommend inline — the check is 4 lines and lives in the same file as the dispatcher; a helper just adds indirection.
- The `ownership_token` field name on the wire — `ownership_token` (snake) vs `ownershipToken` (camel). FSB's existing pattern is camel for in-memory shapes and matches the agentId field. Recommend `ownershipToken`.
- Whether `agent:register`'s response shape already returns the per-bindTab token for the initial first-tab claim — Phase 238 D-10 status response shape is `{success, agentId, agentIdShort, tabIds}`; D-04 may extend this minimally to add `ownershipTokens: {[tabId]: token}` if the registry already binds tabs at register time. Otherwise, the first call to `bindTab` on the extension side returns the token via a new bridge-side response field. Planner picks.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 240 contract sources

- `.planning/ROADMAP.md` (Phase 240 section — 5 success criteria; depends on Phases 237 + 238)
- `.planning/REQUIREMENTS.md` — OWN-01, OWN-02, OWN-03, OWN-04, OWN-05

### Existing call sites this phase modifies

- `extension/ws/mcp-tool-dispatcher.js:dispatchMcpToolRoute` — the chokepoint where the gate trips (D-06, D-07)
- `extension/ws/mcp-tool-dispatcher.js:handleNavigateRoute, handleNavigationHistoryRoute, handleOpenTabRoute` — bindTab call sites (D-08)
- `extension/background.js:handleStartAutomation` — bindTab call site (D-08)
- `extension/utils/mcp-visual-session.js:startSession` — same-agent resume + cross-agent reject (D-03 + D-09)
- `extension/utils/agent-registry.js` (Phase 237) — registry read API; D-04 may extend with token-aware isOwnedBy/bindTab signatures

### Pattern parity references

- `extension/utils/agent-registry.js` — Phase 237 registry; this phase extends `bindTab` and `isOwnedBy` to take/check the per-claim token
- Phase 238 SUMMARYs — particularly the destructure pattern for the 15 dispatcher handlers (`agentId` is already destructured; this phase adds `ownershipToken` alongside)
- Phase 238 D-10 (status response shape `{success, agentId, agentIdShort, tabIds}`) — D-04 may extend this with `ownershipTokens: {[tabId]: token}`

### Codebase architecture

- `.planning/codebase/ARCHITECTURE.md` — bridge architecture between MCP server and extension SW
- `.planning/codebase/CONVENTIONS.md` — node:test plain-assert harness; FSB's plain-object error pattern

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `globalThis.fsbAgentRegistryInstance` (Phase 237) — registry singleton with bindTab/isOwnedBy/releaseTab CRUD; Phase 240 extends bindTab to mint the token and isOwnedBy to verify it
- 15-handler destructure pattern from Phase 238 (`{ payload } = {}; const { agentId } = payload || {};`) — Phase 240 adds `ownershipToken` to the destructure
- Plain-Node test harness (Phase 238 + Phase 239 convention; tests/agent-bridge-routes.test.js, tests/run-task-cleanup-paths.test.js for shape reference)

### Established Patterns

- All registry reads return plain objects, not throwing accessors — the dispatch gate's "no await between check and dispatch" requirement is naturally satisfied by sync isOwnedBy
- `chrome.tabs.get(tabId, callback)` is async and currently used by some handlers — the gate must NOT await chrome.tabs.get on every dispatch; the registry stores the tab's incognito flag at bindTab time so the dispatch check stays sync
- crypto.randomUUID() is available in MV3 service workers (Chrome 92+), so the per-claim token can mint sync
- The bridge payload destructure pattern from Phase 238 (`const { agentId } = payload || {};`) extends naturally to `const { agentId, ownershipToken } = payload || {};`

### Integration Points

- `dispatchMcpToolRoute` (the chokepoint) — every handler invocation flows through here; this is where the gate trips
- The 15 dispatcher handlers from Phase 238's D-14 destructure list — each already destructures `agentId` and ignores it; Phase 240 makes the destructure load-bearing (the gate uses agentId + ownershipToken from the destructured payload)
- `mcp-visual-session.js:startSession` — same-agent re-entry resume code path (D-03)
- The 4 handlers in D-08 that need bindTab calls before success return — handleNavigate/NavigationHistory/OpenTab in dispatcher.js plus handleStartAutomation in background.js

</code_context>

<specifics>
## Specific Ideas

- **Highest-risk phase in v0.9.60** per ROADMAP. Lands ONLY after 237 + 238 are green (both complete). The gate trips on every tool call so a bug here breaks every existing single-agent surface.
- **Backward-compat is the success metric.** Legacy single-agent flows (popup, sidepanel, autopilot) MUST continue to work via the synthesized `legacy:<surface>` agentIds (D-02). This is SC#5: "Legacy single-agent surfaces continue to work via a synthesized `agent_id = 'legacy:<surface>'` wrapper so no v0.9.36 / v0.9.50 regression appears."
- **No await between check and dispatch (D-07)** — the gate must be synchronous. Phase 237's registry reads are already sync; the registry must store `incognito` and `windowId` at bindTab time so the gate doesn't need a `chrome.tabs.get` round-trip.
- **The ownership_token is a defense-in-depth measure (D-04)** — it doesn't guard against a fully-malicious MCP host (which would have the token via legitimate registration), but it does guard against agentId-only attacks where one agent guesses or steals another's agentId without also getting the token.

</specifics>

<deferred>
## Deferred Ideas

- **Hash/short-form ownerAgentId in error responses** (rejected option from D-01). Reconsider only if a real privacy concern surfaces from a multi-tenant MCP host scenario; today's hosts are single-tenant.
- **Single TAB_INACCESSIBLE error code with reason field** (rejected option from D-05). Hosts may eventually consolidate handling, but distinct codes are easier to evolve later than to split apart.
- **legacy:* bypass pattern** (rejected option from D-02). Privilege-escalation risk; if backward-compat proves harder than expected, revisit but only with explicit allow-list.
- **Per-agent long-lived ownership token** (rejected option from D-04). Reconsider only if per-bindTab token storage proves too heavy in practice.
- **Token-less dispatch (rejected option from D-04)** — defer SC#1's token mention to Phase 244 hardening only if integration testing shows the token adds zero defense over agentId alone in our threat model.
- **Visual-session same-agent kill-and-start-fresh** (rejected option from D-03). Could be added as an explicit `force: true` flag on startSession in a future phase if users surface a need to reset state without endSession.
- **Visual-session error-on-active-session** (rejected option from D-03). Breaks v0.9.36 idempotence; defer indefinitely.

</deferred>

---

*Phase: 240-tab-ownership-enforcement-on-dispatch*
*Context gathered: 2026-05-06 via smart discuss (autonomous)*
