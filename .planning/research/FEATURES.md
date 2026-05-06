# Feature Research

**Domain:** Multi-agent / multi-tab concurrency surface for an AI-driven Chrome extension exposing an MCP server (FSB autopilot + manual MCP tools)
**Researched:** 2026-05-05
**Milestone:** v0.9.60 Multi-Agent Tab Concurrency (MCP 0.8.0)
**Confidence:** HIGH on the table-stakes contract (Browserbase Contexts, Playwright BrowserContext, Puppeteer-Cluster, Browser Use, Stagehand v3 cited from primary docs); MEDIUM on Project Mariner specifics (no published API; behavior inferred from Google DeepMind product copy + TechCrunch coverage); HIGH on the `back` tool scope (Playwright `page.goBack()` is the canonical reference)

## Existing Surface (Constraints On New Features)

These already exist in FSB and define the boundary the new multi-agent surface must respect. Pulled from `PROJECT.md` and the milestone brief; do not re-design these.

- **Single-agent autopilot loop** -- popup/sidepanel-driven, one task at a time, binds to one active tab. Multi-agent must not regress this; a 1-agent run is a degenerate case of N-agent.
- **MCP `run_task` tool** -- one autopilot run per call. v0.9.60 ships Phase 236 (return on completion, not 300s ceiling) inside the same MCP `0.8.0` release; that is a separate workstream from agent identity but lands together.
- **Manual MCP tools** -- `click`, `type`, `navigate`, etc., already work; v0.9.60 adds `back`. These tools currently target the active tab implicitly. Multi-agent flips this to "target the agent's owned tab."
- **Explicit visual sessions + trusted-client allowlist (v0.9.36)** -- Claude/Codex/Cursor render a trusted badge during MCP visual sessions. Agent identity in v0.9.60 is **finer-grained than client identity**: one trusted client may run multiple agents in parallel, each needing its own tab lock. Reuse the allowlist for badge/labeling; do not reuse it as the agent identity.
- **DOM streaming, remote control, dashboard pairing** -- already shipped. Out of scope here, but multi-agent overlay/badge collisions on the same window are a known constraint (see deferred item from v0.9.36: "MCP visual sessions can be coordinated safely across multiple tabs or windows without badge/glow collisions" -- v0.9.60 effectively closes this gap).
- **Hard cap target: 8 concurrent agents** -- already decided in the milestone brief. Research confirms this is in the same neighborhood as Project Mariner's "up to 10 tasks at once" and well within Chrome's practical tab budget on a developer machine. Treat 8 as a fixed product decision; this research does not relitigate it.
- **Lock release rules: task ends, MCP client disconnects, user closes the tab** -- explicit "no idle timeout." Research notes (below) confirm this is the user-friendly default; idle-timeout reaping is an anti-feature in interactive surfaces.
- **Branch-locked to `Refinements`; no push/PR until explicit user command** -- planning posture, not a feature constraint, but conditions how aggressively the surface can be extended.

## Feature Landscape

### Table Stakes (Users Expect These)

Missing any of these = the multi-agent surface looks broken or unsafe. Direct evidence cited from named tools.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Stable per-agent ID issued by FSB on session start** | Browserbase issues a `sessionId` per browser session; Playwright hands back a `BrowserContext` handle; Puppeteer-Cluster identifies queued tasks. Every parallel-browser tool returns an opaque handle the caller keeps using. Without this, callers cannot disambiguate which agent did what. Per the milestone brief, "one MCP client may run multiple parallel agents, each with its own ID" -- so client identity is not a substitute. | S | Generate FSB-side (`agent_<uuid>` or `agent_<short>`); return in the `run_task` / session-start response payload; include in every subsequent tool call. Do **not** let the client invent IDs (mirrors v0.9.36's allowlist-only-FSB-side decision). |
| **Stable per-tab handle bound to the owning agent** | Tab IDs are stable strings (e.g., `t1`, `t2`) that are never reused within a session, allowing agents to keep referring to the same tab even after other tabs are opened or closed. FSB already has Chrome's `tab.id` -- reuse it; do not reinvent. | S | Use Chrome's native `tab.id` (integer). Maintain a server-side map: `tabId -> agentId`. The owning agent receives `tab_id` on the open/bind event and threads it through subsequent calls. |
| **Tab ownership enforcement (cross-agent reject)** | Every parallel browser-agent system enforces "this context, this agent." Playwright's BrowserContext isolates cookies, storage, cache, permissions per context; Puppeteer-Cluster's `CONCURRENCY_CONTEXT` mode is the default for the same reason. In FSB's single-window model, ownership is the proxy for isolation. A cross-agent click on a tab the other agent is mid-flow on **must** reject loudly, not race. | M | Enforce at the tool-dispatch layer in `background.js`. Every tool call (`click`, `type`, `back`, etc.) must validate `agentId` matches the lock owner of `tab_id`. Reject with a typed error code (e.g., `TAB_NOT_OWNED`) carrying the actual owner ID for debuggability. |
| **Forced-new-tab pooling under the originating agent** | Real-world flows open new tabs constantly (target=_blank, OAuth popups, Google search results spawning a result tab). If a tab opened by agent A becomes orphan-owned, A's flow breaks. Browserbase, Browser Use, and Stagehand all model "child page opens" as still belonging to the originating agent context. | M | Hook `chrome.tabs.onCreated` with `openerTabId`. If the opener belongs to agent A, the new tab is locked to A automatically. Both tabs stay pooled together; releasing one releases neither (the pool releases on agent termination). |
| **Hard concurrency cap with fail-loud rejection at the cap** | The milestone brief specifies 8 with "9th request rejected with a clear cap-reached error." Research confirms this is the right shape: silent queueing is a known MCP anti-pattern -- when an agent spends several minutes on analysis before invoking tools, the HTTP connection can be dropped, causing the agent to fail to call tools while the workflow still reports success, resulting in a silent failure. Loud rejection is safer than queue-and-hope. | S | Reject with a typed error (e.g., `AGENT_CAP_REACHED`) carrying the current cap (8) and the count of active agents. No retry-after, no backoff hint -- the caller's retry policy is the caller's problem. Puppeteer-Cluster does silent queueing because it is a long-running batch tool; FSB is interactive, so the contract should match Browserbase's session-create semantics (immediate 4xx-equivalent). |
| **Lock release on task end, MCP client disconnect, and tab close (no idle timeout)** | Already decided in the milestone brief; research backs the "no idle timeout" choice. Browserbase's Contexts persist across sessions but session locks release on disconnect; agents whose connection is dropped should release immediately. Idle-reaping is hostile to long-running visual sessions where the user is reading the page (v0.9.36 already shipped explicit visual sessions for exactly this read-and-think workflow). | M | Three release paths: (1) `finalizeSession` already exists from v0.9.40 -- extend it to release agent locks; (2) MCP client disconnect handler in the bridge; (3) `chrome.tabs.onRemoved`. All three converge on a single `releaseAgent(agentId)` that clears every tab in the pool. |
| **Background-tab execution (no foreground requirement)** | One of the most consistently-broken things in browser automation: clicking a backgrounded tab silently fails or focus-steals. Per the milestone brief, "no requirement that the owned tab be active/foregrounded." Chrome extensions historically forced focus on every interaction, redirecting whatever users are typing into whichever window Chrome has grabbed -- this is a top user frustration. Multi-agent **must** not focus-steal. | M | FSB already drives interactions via DOM-level (and CDP) calls that do not require foreground in most cases. Audit existing tool implementations for any that call `chrome.tabs.update({active: true})` or window-focus side effects and gate them behind an explicit `force_foreground` flag (default false). The `back` tool in particular must be gated. |
| **Typed errors for every cross-agent / cap / lock failure** | Project Mariner's published Trusted Tester docs and Browserbase's session API both emit explicit, machine-parseable error codes for "tab does not exist," "session not found," "concurrency exceeded." Browser Use and Stagehand wrap these into agent-visible exceptions. Without typed errors, the calling LLM will hallucinate a recovery strategy. | S | At minimum: `AGENT_NOT_FOUND`, `TAB_NOT_OWNED`, `AGENT_CAP_REACHED`, `TAB_NOT_FOUND`, `AGENT_RELEASED`. Each carries enough payload (current owner agent ID, cap, count) for the caller's LLM to write a coherent retry/abandon plan. |
| **`back` MCP tool (single-step browser back-button equivalent)** | Every browser agent framework ships this: Playwright `page.goBack()`, Browser Use `go_back`, Stagehand inherits Playwright. FSB already has `goBack` in its 25+-action library internally; v0.9.60 just exposes it through MCP. | S | See dedicated scope section below. |
| **Documentation of the agent identity / tab ownership / cap contract in MCP tool descriptions** | LLMs read MCP tool descriptions verbatim. Browser Use and Stagehand have explicit "operating loop" docs in their tool descriptions explaining: keep refs on the same tab, use `tabId` for tab targeting, recover stale refs once, report blockers. Without this, calling LLMs will guess the contract and guess wrong. | S | Update `fsb-mcp-server` tool descriptions for `run_task`, all manual tools, and the new `back` tool to call out: agent ID is required, tab IDs are agent-scoped, cap is 8, ownership is enforced. Mirror v0.9.36's docs-and-test discipline. |

### Differentiators (Competitive Advantage)

These set FSB apart from the obvious alternatives. Cheap wins where the agent-aware contract is the product.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Agent identity surfaced in the trusted-client badge** | v0.9.36 already ships trusted-client badges (Claude/Codex/Cursor). Surfacing the per-agent ID alongside (e.g., "Claude / agent_a3f1") on the overlay closes the v0.9.36 deferred gap "MCP visual sessions can be coordinated safely across multiple tabs or windows without badge/glow collisions." Browserbase's dashboard does this; Browser Use's logs do this; FSB's overlay can do this on the page itself, which is unique. | M | Reuse v0.9.36's badge renderer. Append the short agent ID. Color-bucket per agent (4-6 stable colors cycling) so two parallel Claude agents look distinct on the dashboard preview. Depends on existing badge code, not new infra. |
| **Tab-ownership-aware overlay glow** | When agent A is mid-action on tab 1 and agent B is mid-action on tab 5, the user sees two glows on two different tabs simultaneously. This is the visible payoff of multi-agent isolation. No competitor renders this on the actual page (Browserbase shows it in their dashboard, not in-page; Mariner shows it in a separate live-preview panel). | M | Already partially supported by v0.9.36 explicit visual sessions per tab. The new piece is making sure two parallel sessions on different tabs both render correctly without one stomping the other -- an audit/regression-test problem more than a new feature. |
| **Pool semantics: "agent A opened tab B, both stay pooled until A ends"** | This is the table-stakes feature with a differentiator framing: making the pool **observable** (tool to list `pools` for an agent: `[t12, t14, t17]`). Browser Use's `tabs` listing only shows global tabs; pool-aware listing is unique. | S | A new optional tool `list_my_tabs(agentId)` returning the pool. Or piggyback on existing `list_tabs` and add a `pool` field per tab. LOW value-add; ship only if it falls out for free. |
| **Loud, explicit `cap reached` error message with current count** | Most concurrency-capped APIs return a generic 429. A typed `AGENT_CAP_REACHED { cap: 8, active: 8, hint: "release a session via finalizeSession or wait" }` tells the calling LLM exactly what to do. Browserbase returns generic-ish 4xx; Mariner doesn't expose this (managed cloud); FSB owning a precise contract is a small win. | S | Already in table stakes; the differentiator is the wording quality and that it's documented in the tool description. |

### Anti-Features (Commonly Requested, Often Problematic)

These will come up in roadmap discussions; document why they are bad ideas now to prevent scope creep mid-milestone.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Cross-window agent isolation** | "What if I want each agent in its own Chrome window?" | FSB is a Chrome extension running in the user's existing profile; spawning new windows is jarring and clashes with users' tab/window organization. Chrome extensions also do not have clean per-window service-worker scoping. Browserbase solves this by running cloud VMs -- FSB cannot, by design. The user's milestone brief explicitly says no cross-window. | Stay single-window, multi-tab. If users want strict isolation, they can run multiple Chrome profiles -- explicitly out of FSB's scope. |
| **Incognito-mode agent isolation** | "True isolation requires incognito profiles per agent" | Chrome MV3 service workers do not get a guarantee of running in incognito unless the extension is explicitly allowed in incognito by the user. Adds an installation/UAT burden, divergent storage paths, and breaks the v0.9.36 trusted-client allowlist (which lives in normal storage). Defer entirely. | Document that "isolation" in v0.9.60 means tab-ownership lock, not OS-level profile isolation. Cookies/localStorage **are shared** across same-origin tabs by Chrome's design; cross-tab data leakage is a property of Chrome, not FSB. |
| **Headless / server-side worker agents** | "Run agents without the user's browser open" | Already in PROJECT.md "Out of Scope": *"Headless server-side execution -- server is relay only, user's browser must stay active."* Multi-agent does not change this contract; v0.9.60 makes the user's existing Chrome more capable, not into a server farm. | Defer to OpenClaw / Claude Routines (the v0.9.45rc1 sunset path). FSB's deprecation card already directs background-agent users there. |
| **Agent-to-agent messaging / coordination protocol** | "What if agent A wants to hand off to agent B?" | Massive scope: now FSB needs a message bus, addressing, security model, ordering guarantees. Project Mariner does not expose this; Browser Use does not expose this; Stagehand does not expose this. The orchestrating LLM (Claude / GPT / etc.) is the coordinator -- it owns multiple agents and routes information itself via its own context. FSB providing this is duplicative and dangerous. | Agents are leaves; the LLM is the trunk. The LLM serializes state across agents in its own conversation. FSB should not become a multi-agent runtime. |
| **Idle timeout reaping** | "What if an agent gets stuck and holds a tab forever?" | Hostile to long-running visual sessions (a user reading a page slowly inside an MCP visual session is the v0.9.36 use case). Silent reaping = unexplained tab "thefts." Milestone brief explicitly says no idle timeout. | Explicit release paths only: task end, client disconnect, tab close. If a stuck agent is the concern, that's what stuck-detection (already shipped in v0.9.50) handles -- and stuck-detection emits an explicit failure that triggers `finalizeSession`. The system already self-heals. |
| **Auto-promotion of orphaned tabs to "any agent can claim"** | "If an agent dies, the tab becomes free game" | Race conditions, surprise behavior. If agent A dies mid-flow, the right answer is to kill the tab too (or close the pool) -- not let agent B inherit a half-completed checkout flow. | On agent release, the entire pool releases. Tabs may stay open (user can keep them) but no agent can drive them again until rebound via a new task. |
| **Per-agent custom user-agent / fingerprint isolation** | "Different agents should look like different browsers" | Anti-bot evasion is its own deep rabbit hole (Camofox, anti-detect tools); FSB is not a stealth tool, it is an automation tool that runs in the user's real Chrome. Sites that don't want bots can detect MV3 extensions trivially anyway. | Out of scope. Refer users to dedicated stealth-browser tools (Camofox, Browserbase) for evasion use cases. |
| **Confirmation dialog for `back` on dirty forms** | "What if the user has typed into a form and `back` discards their input?" | Two reasons this is wrong: (1) The agent is the operator -- it just typed into the form, so "user input loss" is the agent losing its own work, which is its problem to plan around. (2) Chrome's native `beforeunload` fires anyway and Playwright has documented bugs trying to dismiss it programmatically (bug #14431). Adding an FSB-level confirmation would compound the problem. | Let Chrome's native `beforeunload` fire. If a `beforeunload` dialog appears, the existing FSB dialog-handling path catches it. Document in the `back` tool description: "may trigger a beforeunload prompt if the page has unsaved input; standard dialog-handling applies." |
| **Multi-step `back(n)` / "go back 3 pages"** | "Sometimes I want to back out of a sequence" | Browser history stacks are not always what they look like (redirects, replaceState, hash-only changes don't always count as a back step uniformly across sites). Compounding `n` calls multiplies the unreliability. Playwright `page.goBack()` is single-step for this exact reason. | Single-step only in v0.9.60. Caller wanting 3-back can call `back` three times and read the page between calls. |
| **Cross-agent `back` (agent A goes back on a tab agent B owns)** | "Why not let any agent navigate any tab?" | Defeats the entire ownership model. | Reject with `TAB_NOT_OWNED`, same as any other cross-agent tool call. |

### Out of Scope for v0.9.60

Explicitly excluded from this milestone, per the brief and per research.

- Cross-window agent isolation (anti-feature above)
- Incognito-mode agents (anti-feature above)
- Headless / server-side workers (PROJECT.md OOS, anti-feature above)
- Agent-to-agent messaging (anti-feature above)
- Idle timeout reaping (anti-feature above)
- Per-agent fingerprint / stealth (anti-feature above)
- Multi-step `back(n)` (anti-feature above)
- Auto-promotion of orphaned tabs (anti-feature above)
- Cross-agent `back` (anti-feature above)
- **Persistent agent identity across browser restarts** -- agents are session-scoped; no one expects an agent ID to survive Chrome reload. Browserbase persists *contexts* (cookies/storage), not session IDs.
- **Quotas / rate limits per agent** -- the cap is on simultaneous agents, not per-agent tool-call rate. v0.9.50 already ships per-task safety breakers.
- **Authoritative agent registry shared across MCP clients** -- agents are scoped to the MCP client connection; if Claude has 3 agents and Codex has 2, they share the cap of 8 but each only sees its own.
- **Chrome profile / Chrome user isolation** -- FSB lives in one profile.
- **Visual fairness scheduling** (round-robin focus, etc.) -- background-tab execution removes the need; no agent needs the foreground.

## `back` Tool Scope (v0.9.60)

A dedicated section because the milestone brief explicitly flags this and asks for "minimal" scope. Anchored on Playwright `page.goBack()` semantics.

### What `back` IS

- A single-step browser back navigation, equivalent to clicking the browser's back button once.
- Targets the agent's owned tab (uses the same `tab_id` parameter shape as other tools).
- Returns success when navigation settles (mirrors Playwright's `page.goBack()` returning when navigation finishes -- `await` semantics).
- Returns a typed error if there is no history to go back to (Playwright returns `null` from `page.goBack()` in that case; FSB should be louder -- explicit `NO_BACK_HISTORY` typed error so the calling LLM can replan).
- Honors background-tab execution (no `chrome.tabs.update({active: true})` -- the tab does not need to be foregrounded).
- Honors tab ownership: cross-agent calls reject with `TAB_NOT_OWNED`.

### What `back` IS NOT

- Not multi-step (`back(n)` is an anti-feature; see above).
- Not a "go to URL" tool (use the existing `navigate` tool for that).
- Not a same-page state revert (it is browser-history-stack-only; SPA route changes that pushed `history.pushState` will be reverted, but in-memory app state will not).
- Not gated on dirty-form confirmation (let Chrome's native `beforeunload` handle it; see anti-feature above).
- Not an alias for `goForward` -- `forward` is **NOT** added in v0.9.60 (defer; minimal scope means one new tool).

### Failure Modes (typed errors)

| Code | Meaning | Caller LLM should… |
|------|---------|--------------------|
| `NO_BACK_HISTORY` | Tab has no prior page in its history (fresh tab, only one navigation). | Replan: do not retry, find a different way to get to the prior context. |
| `TAB_NOT_OWNED` | Agent doesn't own this tab. | Refuse the operation, surface to user. |
| `TAB_NOT_FOUND` | Tab was closed mid-flight. | Acknowledge tab gone, replan from page list. |
| `AGENT_RELEASED` | Agent's lock was released (client disconnect, etc.) between the `back` call landing and resolving. | Stop, the session is over. |
| `NAVIGATION_TIMEOUT` | Back fired but the new page didn't settle within FSB's existing navigation timeout. | Standard retry-or-abandon, same as `navigate`. |

### Edge Cases Worth Handling

- **`beforeunload` prompt fires** -- existing dialog-handling path catches it. Document in tool description that `back` may surface a confirm dialog and FSB will use the agent's existing dialog-handling decision.
- **Back to a redirect** -- sometimes "back" lands on a 301 source URL that immediately re-redirects forward, creating an infinite back-redirect loop. FSB's existing stuck-detection (v0.9.50) already covers this pattern; no new logic.
- **Back across origin boundaries** -- works fine in Chrome; no special handling needed.
- **Back after `pushState` SPA navigation** -- works (this is just popstate); no special handling needed.

### Implementation Notes

- FSB already has internal `goBack` in its action library (per CLAUDE.md "Navigation & Control" tool list). v0.9.60 work is: expose it via MCP, add agent-ownership gate, add typed errors, document the contract.
- Probably 50-150 LOC total in `mcp-server/src/tools/`, plus a few lines of dispatch wiring in `background.js`, plus tool description text.

## Feature Dependencies

```
Per-agent ID issuance
    +-- required by --> Tab ownership map (tabId -> agentId)
                            +-- required by --> Cross-agent tool dispatch gate
                                                    +-- required by --> back tool (gated)
                                                    +-- required by --> all existing manual tools (gated)
                                                    +-- required by --> run_task (gated; receives agent ID)
                            +-- required by --> Forced-new-tab pooling (chrome.tabs.onCreated + openerTabId)

Hard concurrency cap (8)
    +-- enforced at --> Agent-creation entry points (run_task start, manual session start)
    +-- requires --> Per-agent ID issuance (to count active agents)

Lock release paths
    +-- triggered by --> finalizeSession (existing v0.9.40 hook)
    +-- triggered by --> MCP client disconnect (bridge handler)
    +-- triggered by --> chrome.tabs.onRemoved (existing handler, extend to release agent locks)
    +-- requires --> Per-agent ID + ownership map (to know what to release)

Background-tab execution
    +-- requires --> Audit of existing tools for foreground side effects
    +-- enables --> Multi-agent UX (no agent steals focus from another)

Trusted-client badge with agent ID
    +-- depends on --> v0.9.36 trusted-client badge renderer
    +-- enhances --> Per-agent ID issuance (visible payoff)

run_task return-on-completion (Phase 236)
    +-- INDEPENDENT of multi-agent work -- bundled in same MCP 0.8.0 release
    +-- but should ride the same lock-release paths (return-on-completion = finalizeSession trigger)
```

### Dependency Notes

- **Per-agent ID is the keystone.** Everything else is gated on having a stable, FSB-issued agent identifier. Build this first; without it, ownership, cap enforcement, and pool semantics cannot exist.
- **Existing `finalizeSession` is the natural lock-release hook.** v0.9.40 hardened session lifecycle; v0.9.60 piggybacks on it. Adding agent-lock release to `finalizeSession` is one targeted change, not a new lifecycle module.
- **Tab-ownership gate is a single chokepoint in `background.js` tool dispatch.** Every tool currently routes through dispatch; gating happens there, not per-tool. This makes the audit/test surface manageable.
- **Background-tab execution is a quality bar more than a feature.** It is "the absence of focus-stealing." The work is auditing the existing 25+ tools for `tabs.update({active: true})` and similar, and gating them. This is a high-value, low-glamour task -- the kind that breaks the milestone if skipped.
- **Phase 236 (`run_task` return on completion) lands in MCP 0.8.0 alongside multi-agent.** It is technically independent but contractually coupled -- once `run_task` returns on completion, it triggers `finalizeSession`, which releases the agent lock cleanly. The two changes reinforce each other.
- **Differentiator features (agent ID in badge, pool listing tool) depend on table stakes.** Do not build differentiators before the base contract is solid; v0.9.36 taught this lesson.

## MVP Definition

### Launch With (v0.9.60 -- this milestone)

The minimum to ship the multi-agent contract. Every line below is a hard requirement.

- [ ] **Per-agent ID issuance** -- FSB-side generation, returned on session/task start, threaded through every subsequent tool call (Table stakes -- S)
- [ ] **Tab ownership map** -- `tabId -> agentId`, persisted in `chrome.storage.session` so MV3 service worker churn doesn't drop locks (Table stakes -- S)
- [ ] **Tool-dispatch ownership gate** -- single chokepoint in `background.js` rejecting cross-agent calls with `TAB_NOT_OWNED` (Table stakes -- M)
- [ ] **Forced-new-tab pooling** -- `chrome.tabs.onCreated` + `openerTabId` lookup; new tab inherits agent ID of opener (Table stakes -- M)
- [ ] **Hard concurrency cap (8) at agent-creation entry points** -- both `run_task` and manual MCP session start gated; reject with `AGENT_CAP_REACHED` carrying `{cap: 8, active: N}` (Table stakes -- S)
- [ ] **Lock release on task end** -- extend existing `finalizeSession` from v0.9.40 to release the agent's tab pool (Table stakes -- M)
- [ ] **Lock release on MCP client disconnect** -- bridge handler releases all agents owned by the disconnecting client (Table stakes -- M)
- [ ] **Lock release on tab close** -- extend `chrome.tabs.onRemoved` handler; if the closed tab was agent-owned, the rest of the pool stays (the tab is gone, the agent is not necessarily) (Table stakes -- S)
- [ ] **Background-tab execution audit** -- review all 25+ existing tools for foreground side effects; gate any that exist behind explicit `force_foreground` flag (Table stakes -- M)
- [ ] **Typed error payloads** -- `AGENT_NOT_FOUND`, `TAB_NOT_OWNED`, `AGENT_CAP_REACHED`, `TAB_NOT_FOUND`, `AGENT_RELEASED`, plus `NO_BACK_HISTORY` and `NAVIGATION_TIMEOUT` for `back` (Table stakes -- S)
- [ ] **`back` MCP tool** -- single-step, ownership-gated, typed errors, no foreground requirement (Table stakes -- S; see scope section above)
- [ ] **MCP tool description updates** -- agent ID required, tab IDs are agent-scoped, cap is 8, ownership enforced; updated for `run_task`, all manual tools, and new `back` tool (Table stakes -- S)
- [ ] **Trusted-client badge surfaces agent ID** -- extend v0.9.36 badge renderer to append short agent ID (Differentiator -- M; closes v0.9.36 deferred gap)
- [ ] **`fsb-mcp-server@0.8.0` release** -- includes Phase 236 (`run_task` returns on completion); the cap and ownership contract is documented in the package README (Release engineering -- S)

### Add After Validation (v0.9.61+)

Ship after v0.9.60 lands and there is at least one cycle of evidence (real Claude/Codex multi-agent runs, dashboard preview confirms two-tab parallel flow) that the contract is solid.

- [ ] **Pool listing tool** (`list_my_tabs(agentId)` or `list_tabs` with `pool` field) -- only if user feedback flags discoverability gap (Differentiator -- S)
- [ ] **Per-agent dashboard preview** -- show all agents in a multi-pane layout instead of one preview-per-tab (Differentiator -- M; depends on dashboard work)
- [ ] **`forward` MCP tool** -- counterpart to `back`; deferred for "minimal scope" reasons in v0.9.60 (Table stakes -- S)
- [ ] **Visual session badge color-bucketing per agent** -- 4-6 stable colors cycling so two parallel Claude agents look distinct on the page itself (Differentiator -- S)

### Future Consideration (v0.9.70+)

Defer indefinitely; revisit only if product direction changes.

- [ ] **Agent persistence across Chrome reload** -- requires reworking session storage; no demand evidence
- [ ] **Per-agent quota / rate limit** -- v0.9.50 safety breakers cover the worst case
- [ ] **Cross-MCP-client agent registry sharing** -- privacy/security implications outweigh benefit
- [ ] **Visual fairness scheduling** -- background-tab execution removes the need

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Per-agent ID issuance | HIGH | LOW | P1 |
| Tab ownership map | HIGH | LOW | P1 |
| Tool-dispatch ownership gate | HIGH | MEDIUM | P1 |
| Forced-new-tab pooling | HIGH | MEDIUM | P1 |
| Hard concurrency cap with typed reject | HIGH | LOW | P1 |
| Lock release (task end) | HIGH | MEDIUM | P1 |
| Lock release (client disconnect) | HIGH | MEDIUM | P1 |
| Lock release (tab close) | HIGH | LOW | P1 |
| Background-tab execution audit | HIGH | MEDIUM | P1 |
| Typed errors | HIGH | LOW | P1 |
| `back` MCP tool | HIGH | LOW | P1 |
| MCP tool description updates | HIGH | LOW | P1 |
| Trusted-client badge with agent ID | MEDIUM | MEDIUM | P1 |
| `fsb-mcp-server@0.8.0` release w/ Phase 236 | HIGH | LOW | P1 |
| Pool listing tool | LOW | LOW | P2 |
| Per-agent dashboard preview | MEDIUM | MEDIUM | P2 |
| `forward` MCP tool | LOW | LOW | P2 |
| Badge color-bucketing per agent | LOW | LOW | P2 |
| Cross-window agents | LOW | HIGH | Anti-feature |
| Incognito agents | LOW | HIGH | Anti-feature |
| Idle timeout reaping | NEGATIVE | LOW | Anti-feature |
| Agent-to-agent messaging | LOW | HIGH | Anti-feature |
| Multi-step `back(n)` | LOW | LOW | Anti-feature |
| Dirty-form `back` confirmation | NEGATIVE | LOW | Anti-feature |

**Priority key:**
- P1: Must ship in v0.9.60
- P2: Defer to v0.9.61+, ship only after v0.9.60 validation
- Anti-feature: Document and explicitly exclude

## Competitor / Reference Tool Comparison

| Feature | Browserbase | Browser Use | Stagehand v3 | Playwright | Puppeteer-Cluster | Project Mariner | FSB v0.9.60 (proposed) |
|---------|-------------|-------------|--------------|------------|-------------------|-----------------|------------------------|
| Agent / session identity | `sessionId` per session | Implicit per agent instance | `Stagehand` instance handle | `BrowserContext` handle | Internal queue task ID | Hidden (managed cloud) | `agentId` issued by FSB on session start |
| Tab handle convention | Page object | `tab_id` (string) | `page` (Playwright) | Page object | Page in worker | Hidden | Chrome `tab.id` (integer) |
| Isolation boundary | Cloud session (per-VM) | Per-agent userDataDir | Per-context | Per-`BrowserContext` | Per-context (default) | Per-VM | Per-tab ownership lock (single profile) |
| Concurrency cap | Plan-based (cloud quota) | Caller-managed | Caller-managed | Worker count | `maxConcurrency` | "up to 10" | Hard 8, fail-loud |
| Cap-exceeded behavior | 4xx with retry-after | N/A (caller decides) | N/A | N/A | Silent queue | Hidden | Typed `AGENT_CAP_REACHED` reject |
| Background tab execution | N/A (headless cloud) | Yes | Yes (CDP) | Yes | Yes | Yes (VMs) | Yes (audit-driven) |
| New-tab pooling | Per-context | Per-context | Per-context | Per-`BrowserContext` | Per-context | Per-VM | Per-agent (`openerTabId` lookup) |
| `back` semantics | Playwright | Playwright | Playwright | `page.goBack()` single-step | Playwright | Hidden | Single-step, typed `NO_BACK_HISTORY` |
| Idle timeout | Yes (server cost) | No | No | No | No | Yes (cloud cost) | **No** (intentional) |
| Cross-agent tab access | Reject (separate sessions) | Reject (separate agents) | Reject | Reject | Reject | Reject | Reject (`TAB_NOT_OWNED`) |

**FSB's distinct posture:** Shared Chrome profile (only single-window option), no idle timeout (interactive use case), tab-ownership lock instead of per-context isolation (impossible without separate profiles). The cost is that cookies/localStorage **are** shared across same-origin tabs -- this is a Chrome property, not an FSB choice; document it.

## Sources

### Primary tool docs (HIGH confidence)
- Browserbase Contexts -- https://docs.browserbase.com/features/contexts (session persistence, encryption-at-rest, context-vs-session distinction)
- Browserbase internal-agents blog -- https://www.browserbase.com/blog/internal-agents
- Stagehand on GitHub -- https://github.com/browserbase/stagehand (v3 CDP-native architecture, `stagehand.context.pages()`)
- Browser Use on GitHub -- https://github.com/browser-use/browser-use (multi-tab + parallel agents)
- Browser Use AgentID feature request issue -- https://github.com/browser-use/browser-use/issues/4470 (ECDSA P-256 verifiable agent identity proposal)
- Playwright BrowserContext -- https://playwright.dev/docs/browser-contexts (isolation boundary: cookies, storage, cache, permissions, auth credentials per context)
- Playwright BrowserContext API -- https://playwright.dev/docs/api/class-browsercontext
- Playwright Navigations -- https://playwright.dev/docs/navigations (`page.goBack()` semantics, `await` requirement)
- Playwright issue #14431 -- https://github.com/microsoft/playwright/issues/14431 (`beforeunload` dialog dismissal bug -- supports the "let Chrome native handle it" anti-feature decision)
- Puppeteer-Cluster on GitHub -- https://github.com/thomasdondorf/puppeteer-cluster (`maxConcurrency`, `CONCURRENCY_PAGE/CONTEXT/BROWSER`, queue vs execute)
- Puppeteer-Cluster npm -- https://www.npmjs.com/package/puppeteer-cluster

### Secondary references (HIGH confidence)
- Playwright vs Browser Use vs Stagehand 2026 comparison -- https://www.nxcode.io/resources/news/stagehand-vs-browser-use-vs-playwright-ai-browser-automation-2026
- Browser Use vs Stagehand comparison -- https://www.skyvern.com/blog/browser-use-vs-stagehand-which-is-better/
- Parallel browser agents architecture -- https://www.mindstudio.ai/blog/parallel-browser-agents-claude-code (the three-layer task/orchestration/execution decomposition)
- Stagehand vs Browser Use Scrapfly -- https://scrapfly.io/blog/posts/stagehand-vs-browser-use
- Vercel agent-browser sessions docs -- https://agent-browser.dev/sessions (tab handle convention `t1, t2, t3`)
- Vercel agent-browser CDP context request -- https://github.com/vercel-labs/agent-browser/issues/1068 (CDP BrowserContexts for cookie-isolated parallel sessions in one Chrome window)

### Project Mariner (MEDIUM confidence -- product copy, not API docs)
- Project Mariner DeepMind page -- https://deepmind.google/models/project-mariner/
- Project Mariner DeepMind technologies page -- https://deepmind.google/technologies/project-mariner/
- TechCrunch Project Mariner unveil -- https://techcrunch.com/2024/12/11/google-unveils-project-mariner-ai-agents-to-use-the-web-for-you/
- Project Mariner DataCamp guide -- https://www.datacamp.com/tutorial/project-mariner (10 parallel tasks, VM-per-task architecture)
- Project Mariner allaboutai -- https://www.allaboutai.com/ai-agents/project-mariner/

### MCP concurrency / error handling
- Configuring MCP for multiple connections -- https://mcpcat.io/guides/configuring-mcp-servers-multiple-simultaneous-connections/ (STDIO is sequential; HTTP+SSE supports true concurrency)
- MCP error handling best practices -- https://mcpcat.io/guides/error-handling-custom-mcp-servers/
- "Why Your MCP Agent Keeps Timing Out" -- https://medium.com/@ai_transfer_lab/why-your-mcp-agent-keeps-timing-out-and-the-fix-that-just-shipped-ad9cb130f8c4 (silent failure on idle drop)
- gh-aw silent-close issue -- https://github.com/github/gh-aw/issues/20885 (concrete silent-failure case)

### Chrome focus-stealing (anti-feature evidence)
- Claude Code issue #39696 -- https://github.com/anthropics/claude-code/issues/39696 (Chrome extension steals system-wide focus on every tool interaction)
- Claude Code issue #39558 -- https://github.com/anthropics/claude-code/issues/39558 (focus + keyboard hijack during concurrent Cowork tasks)
- Chrome focus-stealing community thread -- https://support.google.com/chrome/thread/19827802/

### Browser-side dirty-form / beforeunload
- Playwright `page.goBack()` reference -- https://runebook.dev/en/docs/playwright/api/class-page/page-go-back
- Playwright beforeunload bug #14431 -- https://github.com/microsoft/playwright/issues/14431 (cited above; supports `back` anti-feature decision)

---
*Feature research for: Multi-agent / multi-tab concurrency surface for FSB v0.9.60*
*Researched: 2026-05-05*
*Downstream consumer: REQUIREMENTS.md authoring (REQ-IDs grouped by category)*
