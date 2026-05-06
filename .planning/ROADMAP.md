---
gsd_state_version: 1.0
milestone: v0.9.60
milestone_name: Multi-Agent Tab Concurrency (MCP 0.8.0)
authored: 2026-05-05
granularity: fine
phase_numbering:
  starts_at: 237
  rationale: "v0.9.50 ended at phase 236; v0.9.60 continues the integer sequence"
---

# Roadmap -- v0.9.60 Multi-Agent Tab Concurrency (MCP 0.8.0)

## Goal

Let multiple agents drive FSB in parallel, each isolated to its own tab(s), with explicit ownership, configurable concurrency cap (default 8, range 1-64), forced-new-tab pooling, lock release on task end / MCP disconnect / user close (no idle timeout), a new `back` MCP tool, and the deferred Phase 236 `run_task` return-on-completion fix -- all shipped together as `fsb-mcp-server@0.8.0`.

## Constraints

- Branch-locked to `Refinements`. No git push, no PRs in any phase.
- `.planning/` is gitignored -- phase commits via `gsd-tools commit` will return `skipped_gitignored` (expected, not an error).
- Must preserve the existing single-agent autopilot loop and the v0.9.36 manual MCP visual session contracts (no regressions).
- No new manifest permissions allowed (research-confirmed: not required).
- No new npm dependencies in `mcp/` other than the `@modelcontextprotocol/sdk` minor bump.

## Phases

- [x] **Phase 237: Agent Registry Foundation** -- New `extension/agents/agent-registry.js` keystone module with `chrome.storage.session` mirror, SW-wake reconciliation, and promise-chain mutex; no enforcement yet (completed 2026-05-05)
- [x] **Phase 238: AgentScope + Bridge Wiring** -- New `mcp/src/agent-scope.ts`; `agent:register` / `agent:release` / `agent:status` bridge messages; thread `agent_id` through every MCP tool registration; extension still ignores it (completed 2026-05-06)
- [x] **Phase 239: MCP `run_task` Return-on-Completion (Phase 236 reborn)** -- Independent of multi-agent work; raise 300s ceiling to 600s safety net, audit cleanup paths, add 30s heartbeat ticks, persist task lifecycle in `chrome.storage.session` (completed 2026-05-06)
- [x] **Phase 240: Tab-Ownership Enforcement on Dispatch** -- Single chokepoint in `mcp-tool-dispatcher.js` verifies `(agent_id, tab_id, ownership_token)` in the same microtask as dispatch; cross-agent rejection with typed errors; incognito/cross-window reject at the dispatch boundary (completed 2026-05-06)
- [x] **Phase 241: Pooling, Configurable Cap, Reconnect Grace** -- `chrome.tabs.onCreated` + `openerTabId` pooling; cap (default 8, 1-64) wired through registry with grandfather behavior; bridge `onclose` reconnect grace; idempotent + commutative `onRemoved` / `windows.onRemoved` (completed 2026-05-06)
- [x] **Phase 242: `back` MCP Tool** -- Thin ownership-gated wrapper over existing `go_back` route with structured result codes (`ok` / `no_history` / `cross_origin` / `bf_cache` / `fragment_only`) (completed 2026-05-06)
- [x] **Phase 243: Background-Tab Audit + UI/Badge Integration** -- Audit 25+ tools for `tabs.update({active:true})`; per-tool `force_foreground` flag; long `setTimeout` -> `chrome.alarms`; v0.9.36 badge extended with agent_id; sidepanel/popup read-only "owned by Agent X" badge; `options.html` Concurrency Cap control (completed 2026-05-06)
- [x] **Phase 244: Hardening, Regression, MCP 0.8.0 Release** -- All v0.9.36 + dashboard + bridge contract tests pass unchanged; new multi-agent regression suite; SW-eviction reconciliation tests; SDK bump `^1.27.1` -> `^1.29.x`; `fsb-mcp-server@0.8.0` published with CHANGELOG + README (completed 2026-05-06)
- [x] **Phase 245: Post-Action Change Report (Inline Diff Return)** -- Every action tool (non-read) returns a compact `change_report` field describing what changed (URL delta, added/removed/attr-changed nodes scoped to action vicinity, dialogs opened, focus shift) so the agent does not need a follow-up `read_page` to learn the consequence; size-capped with `truncated` hint, opt-out per-tool, opt-out global setting

## Phase Details

### Phase 237: Agent Registry Foundation

**Goal**: Single source of truth exists in the extension service worker for who owns which tab, survives MV3 service-worker eviction, and can be reasoned about by every later phase.
**Depends on**: Nothing (first phase of the milestone)
**Requirements**: AGENT-01, AGENT-02, AGENT-03, AGENT-04
**Success Criteria** (what must be TRUE):
  1. New `extension/agents/agent-registry.js` module exists with `agents`, `tabOwners`, `tabsByAgent` Maps and a `withRegistryLock` promise-chain mutex; loaded via `importScripts` in `background.js` before `mcp-tool-dispatcher.js`.
  2. Every registry mutation is mirrored to `chrome.storage.session` under `fsbAgentRegistry` (write-through), and `hydrate()` reconciles persisted records against `chrome.tabs.query({})` on every SW wake, dropping records whose tab no longer resolves before servicing any request.
  3. `crypto.randomUUID()` mints `agent_<uuid>` IDs FSB-side; callers cannot supply IDs (any caller-supplied `agent_id` is ignored at registration).
  4. Unit / harness tests cover registry CRUD, storage round-trip, simulated SW eviction + wake reconciliation (drops ghost records), and a 20-concurrent-claim stress test that confirms the cap invariant under TOCTOU pressure.
  5. `chrome.tabs.onRemoved` is wired to `releaseTab(tabId)` (idempotent), but no MCP tool yet rejects on ownership -- this phase is structural plumbing only.
**Plans**: 3 plans
  - [x] 237-01-PLAN.md -- Module skeleton + in-memory CRUD + mutex + display helper + tests (AGENT-01, AGENT-04 partial; D-01, D-02, D-04)
  - [x] 237-02-PLAN.md -- Storage write-through + hydrate reconciliation + agent:reaped diagnostic emission + tests (AGENT-02, AGENT-03; D-03)
  - [x] 237-03-PLAN.md -- background.js wiring (importScripts ordering, bootstrapAgentRegistry boot site, third chrome.tabs.onRemoved listener)

**Note on path correction**: Success criterion #1 references `extension/agents/agent-registry.js` but CONTEXT.md decision D-01 (made post-roadmap during /gsd-discuss-phase) supersedes this with `extension/utils/agent-registry.js`. The plans use the CONTEXT.md path.

### Phase 238: AgentScope + Bridge Wiring

**Goal**: The MCP server can mint and thread an `agent_id` through every tool call without changing any user-visible behavior, setting up the data flow before any gate trips.
**Depends on**: Phase 237 (registry must exist for `agent:register` to populate)
**Requirements**: AGENT-04 (closure)
**Success Criteria** (what must be TRUE):
  1. New `mcp/src/agent-scope.ts` exposes a per-process `AgentScope` with `ensure(bridge)` that lazy-mints `agent_id` on first tool call via a new `agent:register` bridge message.
  2. `agent:register`, `agent:release`, and `agent:status` routes are added to `MCP_PHASE199_MESSAGE_ROUTES` and resolve through the new `AgentRegistry`.
  3. `agent_id` is threaded into every `bridge.sendAndWait` payload from `autopilot.ts`, `manual.ts`, `visual-session.ts`, and `agents.ts`; all existing tools still work because the extension explicitly ignores `agent_id` until Phase 240.
  4. Existing single-agent autopilot, manual MCP, and v0.9.36 visual-session contract tests pass unchanged with the new payload shape.
**Plans**: 3 plans
  - [x] 238-01-PLAN.md -- AgentScope module + MCPMessageType union extension + unit tests (AGENT-04 partial; D-01..D-04, D-12 type-side)
  - [x] 238-02-PLAN.md -- Three agent:* bridge routes + 17 D-14 read-but-don't-act destructures + route handler unit tests (AGENT-04 partial; D-09..D-15)
  - [x] 238-03-PLAN.md -- AgentScope plumbed through createRuntime; agent_id threaded at 6 D-06 sendAndWait sites; agents.ts marker only (D-08); smoke test STRENGTHENED to assert agentId presence; D-13.4 integration test (AGENT-04 closed; D-05..D-08, D-11, D-13)

### Phase 239: MCP `run_task` Return-on-Completion (Phase 236 reborn)

**Goal**: Long-running `run_task` invocations return on actual completion via the existing `fsbAutomationLifecycleBus` rather than hitting an arbitrary 300s ceiling, with belt-and-suspenders coverage for SW eviction. **This phase is independent of Phases 237/238/240+** and may ship in parallel; it is the deferred Phase 236 work folded into v0.9.60 so `fsb-mcp-server@0.8.0` carries the fix.
**Depends on**: Nothing (parallelizable with Phase 237 or 238)
**Requirements**: MCP-03, MCP-04, MCP-05, MCP-06
**Success Criteria** (what must be TRUE):
  1. The 300s ceiling at `mcp/src/tools/autopilot.ts:58` and `extension/ws/mcp-bridge-client.js:678-680` is raised to a 600s safety net (kept until cleanup-path audit confirms zero dropped lifecycle events); promise resolution is driven by the `fsbAutomationLifecycleBus.dispatch('automationComplete')` event, not the ceiling.
  2. Every `cleanupSession` exit path (normal completion, stuck-detection terminal exit, safety breaker, tab close, `handleStopAutomation`) is audited and confirmed to emit the lifecycle event; an automated regression covers each path.
  3. Heartbeat ticks fire at least every 30s through `_sendProgress` / `notifications/progress` whenever automation is in progress so MCP host clients (Claude Code, Cursor, Codex, OpenClaw) do not hit their per-tool timeouts.
  4. Task lifecycle is persisted in `chrome.storage.session` keyed by `task_id` so a SW eviction during a long task can resume and still settle the originating MCP call.
  5. Five long-task UAT runs (>5 minutes each) return on actual completion rather than at the 600s safety net, with progress observed at each 30s heartbeat boundary.
**Plans**: 3 plans
  - [x] 239-01-PLAN.md -- Lifecycle bus completion: notifySidepanel fix + handleStopAutomation dispatch + 5-path regression tests + 239-CLEANUP-AUDIT.md (MCP-03)
  - [x] 239-02-PLAN.md -- chrome.storage.session task-store helper + 30s heartbeat ticker + autopilot.ts _meta block (MCP-05, MCP-06)
  - [x] 239-03-PLAN.md -- 600s ceiling raise + sw_evicted server-side catch + partial_outcome resolve discipline + nyquist VALIDATION sign-off (MCP-03 closure, MCP-04)

### Phase 240: Tab-Ownership Enforcement on Dispatch

**Goal**: Every MCP tool call now flows through a single chokepoint that authoritatively rejects cross-agent access with typed errors, while preserving the v0.9.36 visual-session same-agent re-entry behavior. This is the highest-risk phase and lands only after 237 + 238 are green.
**Depends on**: Phase 237, Phase 238 (registry + AgentScope must both exist before the gate trips on every call)
**Requirements**: OWN-01, OWN-02, OWN-03, OWN-04, OWN-05
**Success Criteria** (what must be TRUE):
  1. `dispatchMcpToolRoute` in `extension/ws/mcp-tool-dispatcher.js` verifies `agentRegistry.isOwnedBy(tabId, agentId)` and the per-claim `ownership_token` in the same microtask as the handler invocation (no `await` between check and dispatch); mismatch rejects with typed `TAB_NOT_OWNED { ownerAgentId }`.
  2. `handleNavigateRoute`, `handleNavigationHistoryRoute`, `handleOpenTabRoute`, and `handleStartAutomation` call `agentRegistry.bindTab(agentId, newTabId)` before returning success, so opened tabs are authoritatively bound under their originating agent.
  3. `mcp-visual-session.js:startSession` rejects cross-agent re-entry with `tab_owned_by_other_agent` while preserving same-agent displacement (closes v0.9.36 deferred badge/glow-collision gap).
  4. Incognito tabs (`chrome.tabs.get(...).incognito === true`) and cross-window/non-current-window tabs are rejected at the dispatch boundary; manifest posture confirms no `incognito` access.
  5. Legacy single-agent surfaces (popup, sidepanel, autopilot) continue to work via a synthesized `agent_id = 'legacy:<surface>'` wrapper so no v0.9.36 / v0.9.50 regression appears.
**Plans**: 3 plans
  - [ ] 240-01-PLAN.md -- Registry extension: token-aware bindTab/isOwnedBy, getTabMetadata sync accessor, getOrRegisterLegacyAgent carve-out, getAgentWindowId per-agent windowId pin (OWN-04 partial; D-02, D-04, Open Q2)
  - [x] 240-02-PLAN.md -- Inline dispatcher gate at dispatchMcpToolRoute + 3 of 4 D-08 bindTab sites + agent:register ownershipTokens response + 6 mcp-tool-smoke deepEqual sites strengthened (OWN-01 partial, OWN-02, OWN-03, OWN-05 partial; D-01, D-05, D-06, D-07, D-08, D-10, Open Q1, Open Q2)
  - [x] 240-03-PLAN.md -- handleStartAutomation D-08 + visual-session same-agent resume + cross-agent reject + popup/sidepanel/autopilot legacy synthesis (OWN-01 closure, OWN-04 closure, OWN-05 closure; D-02, D-03, D-09, Open Q3, Open Q4)

### Phase 241: Pooling, Configurable Cap, Reconnect Grace

**Goal**: Lifecycle correctness -- forced-new-tab pooling, fail-loud cap enforcement, MCP-disconnect grace window, and pool-shrink-vs-agent-release semantics all behave correctly under tab-ID reuse and order-independent close events.
**Depends on**: Phase 240 (cap enforcement, pooling, and lock release all rely on the dispatch gate)
**Requirements**: POOL-01, POOL-02, POOL-03, POOL-04, POOL-05, POOL-06, LOCK-01, LOCK-02, LOCK-03, LOCK-04
**Success Criteria** (what must be TRUE):
  1. `chrome.tabs.onCreated` listener inspects `openerTabId` and pools the new tab under the originating agent via `bindTab(forced:true)`; opening a forced-new tab never counts as a new agent against the cap.
  2. `(N+1)`th agent claim rejects with typed `AGENT_CAP_REACHED { cap: N, active: M }` (where `N` is the current configured cap, default 8); the cap-check + insert is synchronous against the in-memory registry under `withRegistryLock` so 20 concurrent claims still produce exactly N successes.
  3. The concurrency cap is configurable in `options.html` Advanced Settings (numeric input, range 1-64, default 8, validated to integer with reset-to-default control); changes apply at next claim and active agents are grandfathered when the cap is lowered (no forced eviction).
  4. Bridge `onclose` releases the agent's pool only after a `RECONNECT_GRACE_MS` window (default 10s, calibrated during planning) keyed by `connection_id`; reconnects within the window restore ownership; expiry fully releases.
  5. Tab close (`chrome.tabs.onRemoved`) and window close (`chrome.windows.onRemoved` iterating per-tab) are idempotent and commutative; closing one tab in a pool shrinks the pool, releasing the agent only when `pool.size === 0`. Task / session end via `finalizeSession` releases cleanly. No idle timeout exists.
**Plans**: 3 plans
  - [x] 241-01-PLAN.md -- Registry foundation: cap-aware registerAgent under withRegistryLock, getCap/setCap with chrome.storage.local + onChanged, findAgentByTabId, agent-release-when-pool-empty in releaseTab, stampConnectionId, stage/cancel/expire staged-release primitives, persisted stagedReleases envelope, hydrate-time recovery, LOG-04 emissions agent-cap-reached/agent-cap-lowered-grandfathered/agent-grace-expired (POOL-02, POOL-04, POOL-05, LOCK-03; D-02..D-10, Open Q2, Q3)
  - [x] 241-02-PLAN.md -- Wave 2 wiring: chrome.tabs.onCreated forced-pool listener (background.js), bridge onopen connection_id mint + cancel-on-reopen, bridge onclose stage-release, handleAgentRegisterRoute AGENT_CAP_REACHED branch + connectionId stamp, AgentScope captureConnectionId/currentConnectionId, mcp/src/tools/* outbound payload threading (POOL-01, POOL-03, LOCK-01, LOCK-02; D-01, D-08, D-11, Open Q1)
  - [x] 241-03-PLAN.md -- Wave 2 settings UI parallel with 02: Agent Concurrency card in control_panel.html Advanced Settings (numeric input min=1 max=64 default=8 + reset button), options.js defaultSettings/cacheElements/setupEventListeners/loadSettings/saveSettings extensions with real-time clamping, tests/agent-cap-ui.test.js DOM-stub coverage, tests/agent-no-idle.test.js LOCK-04 negative invariant (POOL-03, POOL-06, LOCK-04; D-05, D-06, D-13)

### Phase 242: `back` MCP Tool

**Goal**: A single-step, ownership-gated browser back-navigation tool that works on background tabs and returns structured result codes, completing the v0.9.60 manual-tool surface.
**Depends on**: Phase 240 (ownership gate must enforce before the new tool registers)
**Requirements**: BACK-01, BACK-02, BACK-03, BACK-04, BACK-05
**Success Criteria** (what must be TRUE):
  1. New `back` MCP tool is registered in `mcp/src/tools/agents.ts` with a description that documents agent-scoped tab targeting, ownership enforcement, and the structured result contract; no multi-step `back(n)`, no companion `forward` in v0.9.60.
  2. Implementation wraps the existing `go_back` route via `chrome.tabs.goBack(tabId)`, with a `history.length` precheck (`chrome.scripting.executeScript`) that returns `NO_BACK_HISTORY` when depth <= 1 instead of silently no-op'ing.
  3. Tool returns a structured result `{ status: 'ok' | 'no_history' | 'cross_origin' | 'bf_cache' | 'fragment_only', resultingUrl, historyDepth }` covering each observed failure mode.
  4. Settle verification uses a `pageshow`-based listener with a 2s timeout; cross-origin transitions reuse the existing v0.9.11 BF-cache resilience path to re-inject the content script.
  5. Cross-agent `back` calls reject with `TAB_NOT_OWNED` via the Phase 240 gate; tool works on a background (non-active) tab without forcing focus.
**Plans**: 2 plans
  - [x] 242-01-PLAN.md -- MCP server-side `back` tool registration in agents.ts + AgentScope plumbing parity + smoke-test extension (BACK-01; D-01, D-02, D-05)
  - [x] 242-02-PLAN.md -- Extension-side `mcp:go-back` route + handleBackRoute + waitForBackSettle + classifyBackOutcome + cross-agent ownership reject test (BACK-02..05; D-03, D-04, D-06, D-07, D-08, D-09)

### Phase 243: Background-Tab Audit + UI/Badge Integration

**Goal**: Multi-agent observability and quality-of-execution -- the user can see which agent owns which tab, no agent steals focus from another, and the cap is configurable from the FSB control panel.
**Depends on**: Phase 240 (badge surfaces depend on registry-driven owner lookup), Phase 241 (cap UI binds to the configurable cap)
**Requirements**: BG-01, BG-02, BG-03, BG-04, UI-01, UI-02, UI-03
**Success Criteria** (what must be TRUE):
  1. All 25+ existing MCP / autopilot tools have been audited for `chrome.tabs.update({active:true})` and other foreground side effects; tools that genuinely require focus opt in via a per-tool `force_foreground` boolean in `tool-definitions.cjs` (default false). All others execute on background tabs without focus-stealing.
  2. Long `setTimeout`-based waits over 1s in tool implementations are migrated to `chrome.alarms` so background-tab throttling does not stretch them; `webNavigation.onCommitted` detects user-initiated navigation on agent-owned tabs and emits a pause signal.
  3. The v0.9.36 trusted-client badge renderer appends a short `agent_id` (e.g., "Claude / agent_a3f1") on the page overlay and on the dashboard mirror; sidepanel and popup show a read-only "owned by Agent X" badge on owned tabs (no enforcement -- option 3 from architecture research).
  4. `options.html` Advanced Settings exposes a "Concurrency Cap" control (numeric input or slider, range 1-64, default 8, helper text explaining trade-offs, current-active counter) that persists to `chrome.storage.local` and is read by Phase 241's cap enforcement at next claim; invalid values rejected inline; reset-to-default control available.
**Plans**: 4 plans
  - [x] 243-01-PLAN.md -- Foreground audit + force_foreground flag (BG-01, BG-02, BG-03 audit closure)
  - [x] 243-02-PLAN.md -- webNavigation user-initiated pause emission + agent-nav suppression (BG-03 listener-side, BG-04)
  - [x] 243-03-PLAN.md -- Badge agentIdShort + popup/sidepanel owner chip (UI-01, UI-02)
  - [x] 243-04-PLAN.md -- Cap helper text + current-active counter + inline validation (UI-03)
**UI hint**: yes

### Phase 244: Hardening, Regression, MCP 0.8.0 Release

**Goal**: Belt-and-suspenders verification across SW eviction, tab-ID reuse, and saturation; everything composes; `fsb-mcp-server@0.8.0` is published with the documented multi-agent contract.
**Depends on**: Phase 237, 238, 239, 240, 241, 242, 243
**Requirements**: MCP-01, MCP-02, MCP-07, MCP-08, TEST-01, TEST-02, TEST-03, TEST-04, TEST-05
**Success Criteria** (what must be TRUE):
  1. The full pre-existing contract test surface -- v0.9.36 visual session, v0.9.40 lifecycle, dashboard, bridge-client, MCP installer parity, autopilot single-agent loop -- passes unchanged.
  2. The new multi-agent regression suite passes: `N` parallel agents (where `N` = configured cap) each drive a distinct tab successfully; the `(N+1)`th rejects with typed `AGENT_CAP_REACHED`; all release cleanly on disconnect; SW eviction + wake reconciliation drops ghost records; a 20-concurrent-claim stress test confirms the cap invariant; a tab-ID-reuse race test confirms agent A's queued action on closed tab T1 cannot corrupt agent B's reused tab T1.
  3. MCP tool descriptions for `run_task`, every manual tool, and `back` document the contract: `agent_id` is FSB-issued and required, `tab_id` is agent-scoped, the cap is configurable (default 8, 1-64), ownership is enforced, typed error codes are enumerated.
  4. `mcp/package.json` and `mcp/server.json` are bumped to `0.8.0`; `@modelcontextprotocol/sdk` is bumped from `^1.27.1` to `^1.29.x` (Zod stays on `^3.x`); CHANGELOG and README in `mcp/` reflect Phase 236 + multi-agent + `back`.
  5. `fsb-mcp-server@0.8.0` is published to npm via the existing tag-driven publish workflow.
**Plans**: 3 plans
  - [x] 244-01-PLAN.md -- Multi-agent regression test suite (6 named cases) + shared helpers (TEST-01, TEST-02, TEST-03, TEST-04, TEST-05; D-01)
  - [x] 244-02-PLAN.md -- MCP tool descriptions updated across agents.ts/autopilot.ts/visual-session.ts + extension/ai/tool-definitions.js (MCP-07; D-02)
  - [x] 244-03-PLAN.md -- Version bump 0.7.4 -> 0.8.0 + SDK ^1.29.x + lockfile + CHANGELOG + README; npm publish flagged for user (MCP-01, MCP-02, MCP-08; D-03, D-04, D-05, D-06)

### Phase 245: Post-Action Change Report (Inline Diff Return)

**Goal**: Every action tool (non-read) returns a compact `change_report` describing what the action mutated, so the calling agent learns the consequence without a follow-up `read_page` / `get_dom_snapshot`. Reduces round-trips, halves average tokens-per-task on action-heavy flows.
**Depends on**: Phase 244 (lands at the tail of v0.9.60; reuses existing `action-verification.js` `capturePageState` / `comparePageStates` and the v0.9.36 `dom-stream` MutationObserver infrastructure)
**Requirements**: CHANGE-01, CHANGE-02, CHANGE-03, CHANGE-04, CHANGE-05
**Success Criteria** (what must be TRUE):
  1. Every MCP action tool (`click`, `type_text`, `clear_input`, `select_option`, `check_box`, `press_key`, `press_enter`, `hover`, `focus`, `scroll*`, `drag*`, `drop_file`, `fill_credential`, `fill_sheet`, `set_attribute`, `navigate`, `go_back`, `go_forward`, `refresh`, `open_tab`, `switch_tab`, `back`, `execute_js`) returns a `change_report` field on success; read-only tools (`get_text`, `get_attribute`, `read_page`, `get_dom_snapshot`, `read_sheet`, `list_*`, `wait_for_*`, `get_logs`) do NOT include the field.
  2. The `change_report` shape is `{ url: { before, after, changed }, title_changed, dialogs_opened: [], nodes_added: [{tag, text, selector}], nodes_removed: [{tag, text, selector}], attrs_changed: [{selector, attr, before, after}], inputs_changed: {key: {before, after}}, focus_shift: {from, to} | null, mutation_count, settle_ms, truncated }` -- a size-capped JSON object never exceeding ~600 tokens (~2400 bytes); when capped, `truncated: true` and a human-readable hint string `"call read_page for full state"` are set.
  3. Diff capture wraps each action with a `MutationObserver` started just before the action invokes, harvested after `waitForDOMStable` settles (or 500ms safety net), filtered to drop style-only / animation-class-only / scroll-position mutations; ancestor-of-target scoping when target element is known, document-wide otherwise.
  4. Per-tool opt-out via `_skipChangeReport: true` flag in `tool-definitions.js` (default false) for hot-path tools where the diff would be noise (e.g., `scroll`); global opt-out via new `options.html` Advanced Settings toggle "Return action change reports" (default on, persists to `chrome.storage.local`).
  5. Existing tests pass unchanged; new test suite covers: (a) action returns change_report with expected shape, (b) read tools do NOT include the field, (c) size-cap triggers `truncated: true` on noisy SPAs, (d) `_skipChangeReport` flag suppresses, (e) global toggle off suppresses everywhere, (f) cross-origin navigation still produces a meaningful report (URL delta only when DOM not accessible).
**Plans**: 2 plans (planned via `/gsd-plan-phase 245`)
  - [x] 245-01-PLAN.md -- Enrich `action-verification.js` with MutationObserver-based diff harvest + `buildChangeReport(before, after, mutations, options)` serializer with size cap + filter rules; unit tests for shape, cap, filtering (CHANGE-02, CHANGE-04)
  - [x] 245-02-PLAN.md -- Wire `change_report` into `mcp-tool-dispatcher.js` response envelope for action tools using `_emitChangeReport` flag + read-tool exclusion list; settings toggle UI + persistence; tool description updates in `agents.ts`/`manual.ts`/`autopilot.ts`; integration tests (CHANGE-01, CHANGE-03, CHANGE-05)

## Dependency Graph

```
                +--------------------+
                | 237 Agent Registry |
                +----------+---------+
                           |
                           v
                +--------------------+
                | 238 AgentScope     |
                | + Bridge Wiring    |
                +----------+---------+
                           |
                           v
+----------------+   +-----+--------+
| 239 run_task   |   | 240 Tab-     |
| Return-on-     |   | Ownership    |
| Completion     |   | Enforcement  |
| (INDEPENDENT,  |   +------+-------+
|  parallel-OK)  |          |
+--------+-------+          v
         |          +-------+--------+
         |          | 241 Pooling +  |
         |          | Cap + Grace    |
         |          +---+--------+---+
         |              |        |
         |              v        |
         |     +-----+-------+   |
         |     | 242 back    |   |
         |     +------+------+   |
         |            |          |
         |            +-----+----+
         |                  |
         |                  v
         |        +---------+----------+
         |        | 243 BG Audit +     |
         |        | UI/Badge           |
         |        +---------+----------+
         |                  |
         +----------+-------+
                    |
                    v
           +--------+--------+
           | 244 Hardening + |
           | MCP 0.8.0 ship  |
           +--------+--------+
                    |
                    v
           +--------+--------+
           | 245 Post-Action |
           | Change Report   |
           +-----------------+
```

**Critical ordering constraints (non-negotiable):**
- 237 -> 240 (gate cannot enforce against a non-existent registry)
- 238 -> 240 (server cannot pass `agent_id` if `AgentScope` does not exist)
- 240 -> 241, 240 -> 242 (cap enforcement and `back` both rely on the dispatch gate)
- 241 -> 243 (UI cap control binds to the configurable cap from 241)
- All phases -> 244 (release engineering verifies composition)

**Phase 239 is explicitly independent** of multi-agent work and ships in parallel with 237 / 238; it can land alone if 240+ slip and still close out the deferred Phase 236 deliverable inside `fsb-mcp-server@0.8.0`.

## Coverage

| REQ-ID range | Phase | Notes |
|--------------|-------|-------|
| AGENT-01..04 | 237 | Identity + registry + reconciliation |
| OWN-01..05 | 240 | Dispatch gate + cross-agent reject + incognito reject |
| POOL-01..06 | 241 | Cap, configurable cap UI persistence, pooling, grandfather |
| LOCK-01..04 | 241 | Task end, MCP disconnect grace, tab close, no idle timeout |
| BG-01..04 | 243 | Tool audit, force_foreground flag, alarms, navigation pause |
| BACK-01..05 | 242 | New `back` tool with structured results |
| MCP-03..06 | 239 | Phase 236 reborn (independent track) |
| MCP-01, 02, 07, 08 | 244 | SDK bump, tool descriptions, npm publish |
| UI-01..03 | 243 | Badge with agent_id, owned-by badge, cap setting |
| TEST-01..05 | 244 | Regression suite + SW eviction + stress + tab-ID reuse |
| CHANGE-01..05 | 245 | Inline change_report on every action tool |

**Total v1 requirements:** 42
**Mapped:** 42 / 42
**Orphaned:** 0

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 237 -- Agent Registry Foundation | 3/3 | Complete   | 2026-05-05 |
| 238 -- AgentScope + Bridge Wiring | 3/3 | Complete    | 2026-05-06 |
| 239 -- MCP run_task Return-on-Completion | 0/3 | Not started | - |
| 240 -- Tab-Ownership Enforcement | 2/3 | Complete    | 2026-05-06 |
| 241 -- Pooling, Cap, Reconnect Grace | 3/3 | Complete    | 2026-05-06 |
| 242 -- back MCP Tool | 2/2 | Complete    | 2026-05-06 |
| 243 -- Background-Tab Audit + UI/Badge | 4/4 | Complete    | 2026-05-06 |
| 244 -- Hardening + MCP 0.8.0 Release | 3/3 | Complete    | 2026-05-06 |
| 245 -- Post-Action Change Report | 2/2 | Complete    | 2026-05-06 |

---

*Authored: 2026-05-05 by `/gsd-roadmapper` from `.planning/REQUIREMENTS.md` + `.planning/research/SUMMARY.md`.*
*Phase numbering continues from v0.9.50's last assigned phase (236).*
