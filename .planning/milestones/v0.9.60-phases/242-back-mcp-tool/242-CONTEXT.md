# Phase 242: `back` MCP Tool - Context

**Gathered:** 2026-05-06
**Status:** Ready for planning
**Source:** Auto-generated context (autonomous mode with recommended decisions)

<domain>
## Phase Boundary

A single-step, ownership-gated `back` MCP tool that wraps `chrome.tabs.goBack(tabId)` with a `history.length` precheck and structured result codes. Completes v0.9.60's manual-tool surface (Phase 240 gates it; Phase 238's TODO Phase 242 marker in agents.ts becomes load-bearing here). Background-tab compatible (no focus required).

</domain>

<decisions>
## Implementation Decisions

### Tool registration (BACK-01)

- **D-01 Tool name and arity locked.** New `back` tool in `mcp/src/tools/agents.ts` (NOT a separate file). Single-step only — no `back(n)`, no companion `forward` in v0.9.60. Description documents: agent-scoped tab targeting, ownership enforcement (Phase 240), structured result contract.
- **D-02 Activates the agents.ts TODO Phase 242 marker** that Phase 238 D-08 left in place. Uncomment the prior `server.tool()` skeleton if present; otherwise add fresh.

### Implementation (BACK-02, BACK-03)

- **D-03 Wraps existing extension `go_back` route.** Phase 240 already routes go_back through dispatchMcpToolRoute; the back tool's MCP handler calls bridge.sendAndWait({type: 'mcp:go-back', payload: {agentId, ownershipToken, ...}}, ...).
- **D-04 history.length precheck via chrome.scripting.executeScript.** Before chrome.tabs.goBack, run a precheck that reads window.history.length. If <= 1, return `NO_BACK_HISTORY` instead of silently no-op'ing.
- **D-05 Structured result shape:** `{ status: 'ok' | 'no_history' | 'cross_origin' | 'bf_cache' | 'fragment_only', resultingUrl, historyDepth }`. Five status codes covering each observed failure mode. The error path (cross-agent reject) still goes through Phase 240's TAB_NOT_OWNED — that's the gate's contract.

### Settlement verification (BACK-04)

- **D-06 pageshow-based listener with 2s timeout.** After chrome.tabs.goBack fires, attach a one-shot pageshow listener via chrome.scripting.executeScript or content-script messaging. Resolve with the post-back URL when pageshow fires. Timeout 2s — if no pageshow event by then, return `bf_cache` status with the URL chrome.tabs.get reports (likely the back-target URL even if pageshow didn't fire because of BF cache hit).
- **D-07 BF-cache resilience reuses v0.9.11 path.** Cross-origin transitions reuse the existing v0.9.11 BF-cache content-script re-injection logic (don't re-implement). Search for the existing pattern; the new go-back handler hooks into it.

### Background-tab compatibility (BACK-05)

- **D-08 No tabs.update({active: true}).** chrome.tabs.goBack works on background tabs without requiring focus. The tool MUST NOT switch to the target tab. Verified by integration test that asserts `chrome.tabs.update` is not called from the new code path.

### Ownership gate (BACK-05 + Phase 240 contract)

- **D-09 Cross-agent rejection via Phase 240's chokepoint.** The new `back` tool routes through dispatchMcpToolRoute exactly like Phase 240's other handlers. No special-casing — the gate's existing TAB_NOT_OWNED rejection path covers cross-agent back calls. Test via tests/back-tool-ownership.test.js asserting cross-agent reject.

### Claude's Discretion

- Exact placement in agents.ts (which line, between which tools)
- chrome.scripting.executeScript vs content-script messaging for the history.length precheck — both work; recommend executeScript for simplicity (one-shot read)
- bf_cache vs fragment_only disambiguation — fragment_only fires when only the URL fragment changes (window.location.hash); detect via comparing URL components
- Test file naming: `tests/back-tool.test.js` (unit + structured result codes) + `tests/back-tool-ownership.test.js` (cross-agent reject)

</decisions>

<canonical_refs>
## Canonical References

### Phase 242 contract sources
- `.planning/ROADMAP.md` (Phase 242 — 5 SC; depends on Phase 240)
- `.planning/REQUIREMENTS.md` — BACK-01..BACK-05

### Existing call sites
- `mcp/src/tools/agents.ts` — Phase 238 D-08 marker; new `back` tool registers here
- `extension/ws/mcp-tool-dispatcher.js` — handleNavigationHistoryRoute or equivalent for go_back routing (Phase 240 already gated)
- `extension/background.js` — chrome.tabs.goBack handler; v0.9.11 BF-cache re-injection path

### Pattern parity references
- Phase 240 ownership gate flow — back tool uses the same dispatch path
- Existing manual MCP tools (autopilot.ts, manual.ts, visual-session.ts) for tool-registration pattern
- v0.9.11 BF-cache content-script re-injection logic (find via grep on background.js)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- chrome.tabs.goBack(tabId, callback) — Chrome API; works on background tabs
- chrome.scripting.executeScript({target: {tabId}, func: () => window.history.length}) — for precheck
- Phase 240 ownership gate — TAB_NOT_OWNED rejection without any special-casing in this phase
- v0.9.11 BF-cache re-injection logic — search existing background.js for the pattern

### Established Patterns
- MCP tool registration in agents.ts — server.tool('name', description, schema, handler)
- Structured result codes — Phase 239 uses `{success, ...}`; this phase uses `{status, ...}` per SC#3 (different shape because the operation has multiple "ok-but" outcomes)
- pageshow listener for navigation completion — Phase 218+ visual-session uses similar pattern

### Integration Points
- agents.ts: new tool registration alongside existing agent:* tools
- dispatcher.js: handleGoBackRoute or equivalent (may already exist; verify in research)
- AgentScope thread: agentId + ownershipToken + connectionId + agent_id from existing Phase 238/240/241 plumbing — no new threading needed

</code_context>

<specifics>
## Specific Ideas
- Phase 242 deliberately scopes to ONE tool. No `forward`, no `back(n)`, no `reload-back-N-times`. v0.9.60's manual-tool surface = autopilot/manual/visual-session/agents/back.
- BF-cache re-injection is a known FSB resilience pattern (v0.9.11) — reuse, don't reinvent.

</specifics>

<deferred>
## Deferred Ideas
- `forward` MCP tool — symmetric counterpart, but no v0.9.60 use case. Future phase if user demand surfaces.
- `back(n)` for multi-step — explicitly rejected per SC#1.
- `back-with-content-check` (return after content settled, not just URL) — defer to Phase 244 hardening if 2s pageshow timeout proves too short.

</deferred>

---

*Phase: 242-back-mcp-tool*
*Context gathered: 2026-05-06 via autonomous (recommended decisions)*
