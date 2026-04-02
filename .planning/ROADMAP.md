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
| 155. Agent Conversation Continuity & Context Reuse | 0/2 | Deferred | - |

---

## v0.9.24 Claude Code Architecture Adaptation

**Milestone Goal:** Deep-analyze the Claude Code source (Research/claude-code/src/) to understand how the AI-tool interaction loop works end-to-end, then adapt specific architectural patterns -- typed state, tool pool, permission gating, hook pipeline, and structured bootstrap -- into FSB's existing Chrome Extension browser automation engine.

**Reference source:** `Research/claude-code/src/` (Python clean-room rewrite of Claude Code). Consult during planning for every phase.

### Phases (v0.9.24)

- [ ] **Phase 156: State Foundation** - Typed session schema, transcript store, structured turn results, action history events, and state change emitter
- [ ] **Phase 157: Engine Configuration** - Tool pool assembly, permission gating, cost tracker extraction, session limits config, and execution mode formalization
- [ ] **Phase 158: Hook Pipeline** - Lifecycle event system with safety breakers, tool permission pre-checks, and progress notification consolidation
- [ ] **Phase 159: Agent Loop Refactor** - Wire extracted modules into agent-loop.js, enable session resumption, replace inline conditionals with hook calls
- [ ] **Phase 160: Bootstrap Pipeline** - Structured service worker startup with ordered phases and deferred initialization for non-essential subsystems

## Phase Details (v0.9.24)

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
**Plans**: TBD
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
**Plans**: TBD
**Note**: Research reference: `Research/claude-code/src/tool_pool.py`, `Research/claude-code/src/permissions.py`, `Research/claude-code/src/cost_tracker.py`, `Research/claude-code/src/direct_modes.py`. Pitfall 5 (path-based permissions) must be addressed -- use origin-aware rules.

### Phase 158: Hook Pipeline
**Goal**: Cross-cutting concerns (safety checks, permission gates, progress updates) execute through a composable hook pipeline instead of inline conditionals scattered through the agent loop
**Depends on**: Phase 156, Phase 157
**Requirements**: HOOK-01, HOOK-02, HOOK-03, HOOK-04
**Success Criteria** (what must be TRUE):
  1. A hook pipeline supports 7 named lifecycle events (beforeIteration, afterApiResponse, beforeToolExecution, afterToolExecution, afterIteration, onCompletion, onError) with register/emit/unregister API
  2. Cost limit, time limit, and stuck detection checks run as hook handlers registered on afterIteration -- not as inline if-statements in the iteration function
  3. Before every tool execution, a permission hook checks the permission context and blocks denied tools with a structured denial result that the AI receives as a tool_result error
  4. All progress notifications (action summaries, phase updates, cost updates) flow through a single progress hook on afterToolExecution and afterIteration, replacing scattered sendStatus and sendUpdate calls
**Plans**: TBD
**Note**: Research reference: `Research/claude-code/src/costHook.py`, `Research/claude-code/src/reference_data/subsystems/hooks.json`. Pitfall 4 (cross-process hooks) -- all initial hooks are background-only; content-requiring hooks deferred.

### Phase 159: Agent Loop Refactor
**Goal**: The agent loop delegates to extracted modules for state, tools, permissions, and lifecycle hooks -- reducing its size and enabling session resumption from the last completed tool result
**Depends on**: Phase 158
**Requirements**: LOOP-01, LOOP-02, LOOP-03
**Success Criteria** (what must be TRUE):
  1. agent-loop.js integrates transcript store, tool pool, permission context, and hook pipeline -- inline code replaced with module calls, file reduced from ~1200 to ~700 lines
  2. A restored session after service worker kill can continue automation from the last completed tool result (resume iteration loop) instead of only displaying status and allowing stop
  3. All safety checks, progress updates, and permission gates execute through the hook pipeline -- no inline conditionals for these concerns remain in the iteration function
**Plans**: TBD
**Note**: Research reference: `Research/claude-code/src/runtime.py`, `Research/claude-code/src/context.py`. Explicitly preserve setTimeout-chaining for MV3 compatibility. Do NOT convert to synchronous loop or async/await iteration.

### Phase 160: Bootstrap Pipeline
**Goal**: Service worker startup is structured with explicit ordered phases and non-essential loading is deferred until after first user interaction
**Depends on**: Phase 159
**Requirements**: BOOT-01, BOOT-02
**Success Criteria** (what must be TRUE):
  1. Service worker startup proceeds through explicit ordered phases -- settings prefetch, environment detection, tool registration, session restoration -- with each phase individually debuggable when startup fails
  2. Non-essential loading (site guides, memory extraction, analytics prefetch) is deferred until after first user interaction, while all tool definitions and core modules remain eagerly loaded
**Plans**: TBD
**Note**: Research reference: `Research/claude-code/src/bootstrap_graph.py`, `Research/claude-code/src/deferred_init.py`. Pitfall 6 warns that deferred init can stall first command -- keep eager loading for all tool definitions and core modules.

---

### v0.9.24 Claude Code Architecture Adaptation Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 156. State Foundation | 0/? | Not started | - |
| 157. Engine Configuration | 0/? | Not started | - |
| 158. Hook Pipeline | 0/? | Not started | - |
| 159. Agent Loop Refactor | 0/? | Not started | - |
| 160. Bootstrap Pipeline | 0/? | Not started | - |
