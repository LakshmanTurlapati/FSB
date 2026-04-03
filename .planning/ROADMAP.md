# Roadmap: FSB (Full Self-Browsing)

## Milestones

- v0.9 Reliability Improvements (shipped 2026-02-14)
- v9.0.2 AI Situational Awareness (shipped 2026-02-18)
- v9.3 Tech Debt Cleanup (shipped 2026-02-23)
- v9.4 Career Search Automation (shipped 2026-02-28)
- v10.0 CLI Architecture (shipped 2026-03-15)
- v0.9.2-v0.9.4 Productivity, Memory & AI Quality (shipped 2026-03-17)
- v0.9.5 Progress Overlay Intelligence (shipped 2026-03-17)
- v0.9.6 Agents & Remote Control (shipped 2026-03-19)
- v0.9.7 MCP Edge Case Validation (shipped 2026-03-22) -- [archive](milestones/v0.9.7-ROADMAP.md)
- v0.9.8 Autopilot Refinement (shipped 2026-03-23) -- [archive](milestones/v0.9.8-ROADMAP.md)
- v0.9.9 Excalidraw Mastery (shipped 2026-03-25) -- [archive](milestones/v0.9.9-ROADMAP.md)
- v0.9.8.1 npm Publishing (shipped 2026-04-02) -- [archive](milestones/v0.9.8.1-ROADMAP.md)
- v0.9.9.1 Phantom Stream (shipped 2026-03-31)
- v0.9.11 MCP Tool Quality (shipped 2026-03-31) -- [archive](milestones/v0.9.11-ROADMAP.md)
- v0.9.20 Autopilot Agent Architecture Rewrite (shipped 2026-04-02) -- [archive](milestones/v0.9.20-ROADMAP.md)
- v0.9.21 UI Retouch & Cohesion (shipped 2026-04-02) -- [archive](milestones/v0.9.21-ROADMAP.md)
- v0.9.22 Showcase High-Fidelity Replicas (superseded after Phase 145)
- v0.9.23 Dashboard Stream & Remote Control Reliability (deferred after Phase 150)
- v0.9.24 Claude Code Architecture Adaptation (in progress)

---

## v0.9.23 Dashboard Stream & Remote Control Reliability (deferred)

Phase 150 completed. Phases 151-155 deferred. See previous ROADMAP.md for full phase details.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 150. Dashboard Transport Baseline & Recovery | 2/2 | Complete | 2026-04-02 |
| 151. DOM Stream Consistency & State Sync | 0/2 | Deferred | - |
| 152. Remote Control Reliability | 0/2 | Deferred | - |
| 153. Dashboard Task Relay Correctness | 0/2 | Deferred | - |
| 154. End-to-End Verification & Hardening | 0/1 | Deferred | - |
| 155. Agent Conversation Continuity & Context Reuse | 2/2 | Complete | 2026-04-02 |

---

## v0.9.24 Claude Code Architecture Adaptation

**Milestone Goal:** Deep-analyze the Claude Code source (Research/claude-code/src/) to understand how the AI-tool interaction loop works end-to-end, then adapt specific architectural patterns -- typed state, tool pool, permission gating, hook pipeline, and structured bootstrap -- into FSB's existing Chrome Extension browser automation engine.

**Reference source:** `Research/claude-code/src/` (Python clean-room rewrite of Claude Code). Consult during planning for every phase.

### Phases (v0.9.24)

- [x] **Phase 156: State Foundation** - Typed session schema, transcript store, structured turn results, action history events, and state change emitter (completed 2026-04-02)
- [x] **Phase 157: Engine Configuration** - Cost tracker extraction, permission context stub, session limits config, and execution mode formalization (completed 2026-04-02)
- [x] **Phase 158: Hook Pipeline** - Lifecycle event system with safety breakers, tool permission pre-checks, and progress notification consolidation (completed 2026-04-02)
- [x] **Phase 159: Agent Loop Refactor** - Wire extracted modules into agent-loop.js, enable session resumption, replace inline conditionals with hook calls (completed 2026-04-02)
- [x] **Phase 160: Bootstrap Pipeline** - Structured service worker startup with ordered phases and deferred initialization for non-essential subsystems
- [x] **Phase 161: Module Adoption** - Migrate consumers to use extracted class instances (createSession, CostTracker, TurnResult, ActionHistory, session.mode) (completed 2026-04-03)
- [x] **Phase 162: Event Bus Wiring** - Connect SessionStateEmitter to UI consumers so progress events reach popup/sidepanel (completed 2026-04-03)
- [x] **Phase 162.1: Partial Completion Lifecycle** - Add a first-class partial/blocked terminal outcome so useful work is preserved when the final step cannot be executed (completed 2026-04-03 with explicit runtime outcomes plus logger/UI history rendering)
- [ ] **Phase 162.2: Auth Wall Handoff with Result Preservation** - End auth-blocked tasks with a preserved manual handoff instead of a generic error (inserted 2026-04-03 after verification session `session_1775188402694`)
- [x] **Phase 162.3: Overlay Lifecycle Reliability** - Keep the glow/progress/debugger overlay alive across navigation, content reconnects, and long provider waits (completed 2026-04-03)

## Phase Details

### Phase 156: State Foundation
**Goal**: Every module that reads or writes session state operates on typed, structured objects with clear persistence guarantees -- hot state is transient, warm state survives service worker kills
**Depends on**: Nothing (first phase of milestone; builds on v0.9.20 agent loop)
**Requirements**: STATE-01, STATE-02, STATE-03, STATE-04, STATE-05
**Success Criteria** (what must be TRUE):
  1. A session object has a typed schema with explicitly declared hot-tier fields (Promises, timers -- accepted as lost on SW kill) and warm-tier fields (messages, iteration count, cost -- persisted to chrome.storage.session on every state change)
  2. Conversation history is managed by a standalone transcript store class with append/compact/replay/flush methods, using FSB's existing token-budget-aware compaction (80% trigger, keep recent 5 intact, old results replaced with one-liners)
  3. Each agent iteration returns a structured turn result carrying prompt tokens, output tokens, matched tools, permission denials, usage metrics, and stop reason -- not ad-hoc property reads from the session object
  4. Action history consists of structured event objects (not scattered session property mutations) that can be replayed and diffed between turns
  5. Session state transitions (idle, running, paused, completed, failed) broadcast to all subscribers (sidepanel, dashboard, analytics) through a single event emitter instead of scattered sendStatus calls
**Plans:** 2/2 plans complete
Plans:
- [x] 156-01-PLAN.md -- Typed session schema with hot/warm tiering + state event emitter
- [x] 156-02-PLAN.md -- Transcript store, structured turn results, and action history modules
**Note**: Research reference: `Research/claude-code/src/transcript.py`, `Research/claude-code/src/session_store.py`, `Research/claude-code/src/runtime.py`. Pitfall 1 (SW state loss) and Pitfall 3 (storage quota) must be addressed here.

### Phase 157: Engine Configuration
**Goal**: The agent loop starts each session with a right-sized tool set filtered by task type and permissions, configurable session limits replace hardcoded constants, and execution modes are formalized
**Depends on**: Phase 156
**Requirements**: ENGINE-01, ENGINE-02, ENGINE-03, ENGINE-04, MODE-01
**Success Criteria** (what must be TRUE):
  1. A tool pool assembles per-session filtered tool sets based on task type and permissions, reducing the 47 tools sent on every API call to a relevant subset of 12-20 tools
  2. A permission context implements deny-list gating per tool name with origin-aware rules using Chrome match patterns -- blocking denied tools before they reach the API, not after
  3. Cost tracking lives in a standalone module with token budget enforcement alongside the existing $2 dollar budget breaker, not inline in agent-loop.js
  4. Session limits (max_turns, token budget, compact threshold) are read from a config object at session start, not hardcoded as magic numbers in agent-loop.js and background.js
  5. FSB's four execution modes (autopilot, mcp-manual, mcp-agent, dashboard-remote) are formalized as named mode objects with per-mode tool pool configuration, safety limits, and UI feedback channel routing
**Plans:** 2/2 plans complete
Plans:
- [x] 157-01-PLAN.md -- Cost tracker extraction + engine config with session limits and execution modes
- [x] 157-02-PLAN.md -- Permission context stub + ENGINE-01 documentation (tool pool deferred per D-01)
**Note**: Research reference: `Research/claude-code/src/tool_pool.py`, `Research/claude-code/src/permissions.py`, `Research/claude-code/src/cost_tracker.py`, `Research/claude-code/src/direct_modes.py`. Pitfall 5 (path-based permissions) must be addressed -- use origin-aware rules. Tool pool filtering deferred per user decision D-01 -- getPublicTools() stays inline.

### Phase 158: Hook Pipeline
**Goal**: Cross-cutting concerns (safety checks, permission gates, progress updates) execute through a composable hook pipeline instead of inline conditionals scattered through the agent loop
**Depends on**: Phase 156, Phase 157
**Requirements**: HOOK-01, HOOK-02, HOOK-03, HOOK-04
**Success Criteria** (what must be TRUE):
  1. A hook pipeline supports 7 named lifecycle events (beforeIteration, afterApiResponse, beforeToolExecution, afterToolExecution, afterIteration, onCompletion, onError) with register/emit/unregister API
  2. Cost limit, time limit, and stuck detection checks run as hook handlers registered on afterIteration -- not as inline if-statements in the iteration function
  3. Before every tool execution, a permission hook checks the permission context and blocks denied tools with a structured denial result that the AI receives as a tool_result error
  4. All progress notifications (action summaries, phase updates, cost updates) flow through a single progress hook on afterToolExecution and afterIteration, replacing scattered sendStatus and sendUpdate calls
**Plans:** 2/2 plans complete
Plans:
- [x] 158-01-PLAN.md -- HookPipeline class with 7 lifecycle events and register/emit/unregister API
- [x] 158-02-PLAN.md -- Safety breaker hooks, permission pre-execution hook, and progress notification hooks
**Note**: Research reference: `Research/claude-code/src/costHook.py`, `Research/claude-code/src/reference_data/subsystems/hooks.json`. Pitfall 4 (cross-process hooks) -- all initial hooks are background-only; content-requiring hooks deferred.

### Phase 159: Agent Loop Refactor
**Goal**: The agent loop delegates to extracted modules for state, tools, permissions, and lifecycle hooks -- reducing its size and enabling session resumption from the last completed tool result
**Depends on**: Phase 158
**Requirements**: LOOP-01, LOOP-02, LOOP-03
**Success Criteria** (what must be TRUE):
  1. agent-loop.js integrates transcript store, tool pool, permission context, and hook pipeline -- inline code replaced with module calls, file reduced from ~1200 to ~700 lines
  2. A restored session after service worker kill can continue automation from the last completed tool result (resume iteration loop) instead of only displaying status and allowing stop
  3. All safety checks, progress updates, and permission gates execute through the hook pipeline -- no inline conditionals for these concerns remain in the iteration function
**Plans:** 3/3 plans complete
Plans:
- [x] 159-01-PLAN.md -- Refactor agent-loop.js: remove inline code, wire module imports, add 7 hook emissions
- [x] 159-02-PLAN.md -- Wire background.js: importScripts, hook pipeline factory, auto-resumption from warm state
- [x] 159-03-PLAN.md -- Gap closure: route pre-iteration safety check through BEFORE_ITERATION hook pipeline
**Note**: Research reference: `Research/claude-code/src/runtime.py`, `Research/claude-code/src/context.py`. Explicitly preserve setTimeout-chaining for MV3 compatibility. Do NOT convert to synchronous loop or async/await iteration.

### Phase 160: Bootstrap Pipeline
**Goal**: Service worker startup is structured with explicit ordered phases and non-essential loading is deferred until after first user interaction
**Depends on**: Phase 159
**Requirements**: BOOT-01, BOOT-02
**Success Criteria** (what must be TRUE):
  1. Service worker startup proceeds through explicit ordered phases -- settings prefetch, environment detection, tool registration, session restoration -- with each phase individually debuggable when startup fails
  2. Non-essential loading (site guides, memory extraction, analytics prefetch) is deferred until after first user interaction, while all tool definitions and core modules remain eagerly loaded
**Plans:** 1/1 plans complete
Plans:
- [x] 160-01-PLAN.md -- Consolidated bootstrap pipeline with 4-phase swBootstrap and deferred init guards
**Note**: Research reference: `Research/claude-code/src/bootstrap_graph.py`, `Research/claude-code/src/deferred_init.py`. Pitfall 6 warns that deferred init can stall first command -- keep eager loading for all tool definitions and core modules.

### Phase 161: Module Adoption
**Goal**: Migrate all consumers to use extracted class instances instead of ad-hoc patterns -- createSession() for typed session construction, CostTracker for budget enforcement, createTurnResult() for structured iteration metadata, ActionHistory class for queryable action store, and session.mode for per-mode safety limits
**Depends on**: Phase 160
**Requirements**: ADOPT-01, ADOPT-02, ADOPT-03, ADOPT-04, ADOPT-05
**Success Criteria** (what must be TRUE):
  1. All new sessions are created via `createSession(overrides)` -- no inline object literals for session construction in background.js
  2. `CostTracker` is instantiated per session and `checkBudget()` replaces direct `totalCost` reads in safety breakers
  3. Each agent iteration produces a `createTurnResult()` object carrying tokens, cost, matched tools, and stop reason
  4. `ActionHistory` class is instantiated per session, wrapping the raw `actionHistory` array with query methods
  5. `session.mode` is set on every new session based on the entry point (autopilot, mcp-manual, mcp-agent, dashboard-remote) so `loadSessionConfig` applies per-mode limits
**Plans:** 3/3 plans complete
Plans:
- [x] 161-01-PLAN.md -- createSession adoption at 3 background.js construction sites + mode routing + mode field in SESSION_FIELDS
- [x] 161-02-PLAN.md -- CostTracker, ActionHistory, and TurnResult wiring in agent-loop.js
- [x] 161-03-PLAN.md -- Gap closure: add mode field to persistableSession in persistSession() (ADOPT-05)
**Gap Closure**: Closes integration gaps STATE-01, STATE-03, STATE-04, ENGINE-03, MODE-01 from v0.9.24 audit

### Phase 162: Event Bus Wiring
**Goal**: SessionStateEmitter progress events reach UI consumers (popup, sidepanel) so the event bus created in Phase 156 delivers on its purpose
**Depends on**: Phase 161
**Requirements**: WIRE-01, WIRE-02
**Success Criteria** (what must be TRUE):
  1. Popup and sidepanel message handlers include a `case 'sessionStateEvent'` that processes emitter events (tool_executed, iteration_complete, session_ended, error_occurred)
  2. At least one UI surface visually reflects a SessionStateEmitter event (e.g., iteration count update, cost update, or tool execution indicator)
**Plans:** 1/1 plans complete
Plans:
- [x] 162-01-PLAN.md -- Add sessionStateEvent handlers to popup.js and sidepanel.js for all 4 emitter event types
**Gap Closure**: Closes integration gaps STATE-05, HOOK-04 and degraded flow "Progress events -> UI surfaces" from v0.9.24 audit

### Phase 162.1: Partial Completion Lifecycle
**Goal**: Tasks that complete useful work but hit an unrecoverable external blocker end with a first-class partial/blocked outcome instead of a hard error
**Depends on**: Phase 162
**Requirements**: OUTCOME-01, OUTCOME-02
**Success Criteria** (what must be TRUE):
  1. The agent loop supports a terminal partial/blocked outcome distinct from `completed` and `error`
  2. The terminal outcome preserves a structured summary of what was accomplished plus the blocker that prevented full completion
  3. MCP session history, popup, and sidepanel surfaces render partial outcomes as non-crash results instead of generic failures
**Plans:** 2/2 plans complete
Plans:
- [x] 162.1-01-PLAN.md -- Introduce the partial/blocked runtime contract and preserve it through automationComplete/executeAutomationTask
- [x] 162.1-02-PLAN.md -- Persist partial outcomes in session history and render them as non-crash results in popup/sidepanel/history surfaces
**Inserted**: 2026-04-03 after verification session `session_1775188402694` exposed a useful-but-auth-blocked run being recorded as `error`
**Planned**: 2026-04-03 from verification evidence plus runtime/UI/history code inspection
**Completed**: 2026-04-03 with `partial_task`, structured session outcome persistence, MCP-visible outcome metadata, and outcome-aware popup/sidepanel/options rendering

### Phase 162.2: Auth Wall Handoff with Result Preservation
**Goal**: Auth-required final steps (LinkedIn message, checkout, submit actions) produce a preserved manual handoff with collected results instead of losing the useful work in a failure path
**Depends on**: Phase 162.1
**Requirements**: AUTH-01, AUTH-02
**Success Criteria** (what must be TRUE):
  1. When the final step is blocked by login or missing credentials, the agent returns the collected findings plus an explicit manual handoff instead of `fail_task`
  2. Prompt/tool guidance tells the agent to use the partial/blocked terminal outcome for auth walls and credential-gated endpoints
  3. The final session result names what was completed, what remains manual, and the exact blocker so the user can resume intentionally
**Plans:** 0/0 plans complete
Plans:
- None yet -- plan after insertion
**Inserted**: 2026-04-03 after verification session `session_1775188402694` showed LinkedIn messaging failure discarding the already-collected job/profile work

### Phase 162.3: Overlay Lifecycle Reliability
**Goal**: Visual debugger feedback stays trustworthy throughout an active run by rehydrating overlay state after navigation/reconnect and keeping it alive during long model waits
**Depends on**: Phase 162
**Requirements**: OVERLAY-01, OVERLAY-02, OVERLAY-03
**Success Criteria** (what must be TRUE):
  1. When navigation or content-script reconnection tears down the content overlay, the active session re-applies the current overlay state without waiting for a rare special-case transition
  2. Normal agent-loop progress and `report_progress` updates drive the content overlay lifecycle, not just popup/sidepanel emitter events and dashboard broadcasts
  3. Long provider waits or retries keep the overlay visible via heartbeat or degraded waiting-state refresh instead of silently disappearing after watchdog expiry
  4. Dashboard/debugger overlay state remains synchronized with the canonical content overlay state across reconnects and page transitions
**Plans:** 2/2 plans complete
Plans:
- [x] 162.3-01-PLAN.md -- Cache/replay canonical overlay state on reconnect and refresh it from normal agent-loop progress
- [x] 162.3-02-PLAN.md -- Keep overlays alive during long waits and synchronize dashboard preview from the same canonical state
**Inserted**: 2026-04-03 after complex verification follow-up found that `sessionStatus` is only pushed at session start and a few special transitions while `content/lifecycle.js` destroys overlays on disconnect/navigation
**Completed**: 2026-04-03 with canonical overlay replay, active-session heartbeat, degraded waiting watchdog, and forced DOM-stream overlay rebroadcasts

---

### v0.9.24 Claude Code Architecture Adaptation Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 156. State Foundation | 2/2 | Complete    | 2026-04-02 |
| 157. Engine Configuration | 2/2 | Complete    | 2026-04-02 |
| 158. Hook Pipeline | 2/2 | Complete    | 2026-04-02 |
| 159. Agent Loop Refactor | 3/3 | Complete    | 2026-04-02 |
| 160. Bootstrap Pipeline | 1/1 | Complete    | 2026-04-02 |
| 161. Module Adoption | 3/3 | Complete    | 2026-04-03 |
| 162. Event Bus Wiring | 1/1 | Complete    | 2026-04-03 |
| 162.1. Partial Completion Lifecycle | 2/2 | Complete    | 2026-04-03 |
| 162.2. Auth Wall Handoff with Result Preservation | 0/0 | Inserted    | - |
| 162.3. Overlay Lifecycle Reliability | 2/2 | Complete    | 2026-04-03 |
