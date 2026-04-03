# Requirements: FSB v0.9.24 Claude Code Architecture Adaptation

**Defined:** 2026-04-02
**Core Value:** Reliable single-attempt execution -- the AI decides correctly, the mechanics execute precisely

## v0.9.24 Requirements

Requirements for Claude Code Architecture Adaptation. Each maps to roadmap phases.

### State Foundation

- [ ] **STATE-01**: Session schema defines typed session objects with hot/warm state tiering -- hot state (Promises, setTimeout handles) is transient and accepted as lost on service worker kill, warm state (messages, iteration count, cost) persists to chrome.storage.session after every state change
- [ ] **STATE-02**: Transcript store class extracts conversation history management from agent-loop.js with append/compact/replay/flush methods, preserving FSB's existing token-budget-aware compaction (80% trigger, keep recent 5 intact, replace old results with one-liners)
- [ ] **STATE-03**: Structured turn result -- each agent iteration returns a typed result object carrying prompt, output, matched tools, permission denials, usage metrics, and stop reason
- [ ] **STATE-04**: Action history uses structured event objects instead of ad-hoc session property mutations, enabling replay and diff between turns
- [ ] **STATE-05**: State change event emitter broadcasts session state transitions to subscribers (sidepanel, dashboard, analytics) replacing scattered sendStatus calls

### Engine Configuration

- [ ] **ENGINE-01**: Tool pool assembles per-session filtered tool sets based on task type and permissions, reducing the 47 tools sent on every API call to a relevant subset of 12-20 tools
- [ ] **ENGINE-02**: Permission context implements deny-list gating per tool name with origin-aware rules using Chrome match patterns -- not file-path prefixes
- [ ] **ENGINE-03**: Cost tracker extracts cost tracking into a standalone module with token budget enforcement alongside the existing $2 dollar budget breaker
- [ ] **ENGINE-04**: Engine config provides configurable session limits (max_turns, token budget, compact threshold) replacing hardcoded constants scattered through agent-loop.js and background.js

### Hook Pipeline

- [ ] **HOOK-01**: Hook pipeline defines 7 named lifecycle events (beforeIteration, afterApiResponse, beforeToolExecution, afterToolExecution, afterIteration, onCompletion, onError) with register/emit/unregister API
- [ ] **HOOK-02**: Safety breaker hooks extract cost limit, time limit, and stuck detection from inline agent-loop.js code into composable hook handlers registered on appropriate lifecycle events
- [ ] **HOOK-03**: Tool permission pre-execution hook checks permission context before every tool execution, blocking denied tools with structured denial result
- [ ] **HOOK-04**: Progress notification hook consolidates scattered sendStatus/sendUpdate calls into a unified pipeline that emits structured progress events

### Agent Loop Refactor

- [ ] **LOOP-01**: Agent loop integrates transcript store, tool pool, permission context, and hook pipeline -- replacing inline code with module calls, reducing agent-loop.js from ~1200 to ~700 lines
- [ ] **LOOP-02**: Session resumption -- restored sessions after service worker kill can continue automation from the last completed tool result instead of only displaying status and allowing stop
- [ ] **LOOP-03**: Hook-driven cross-cutting concerns -- all safety checks, progress updates, and permission gates execute through the hook pipeline, not as inline conditionals in the iteration function

### Bootstrap Pipeline

- [x] **BOOT-01**: Structured service worker startup with explicit ordered phases -- settings prefetch, environment detection, tool registration, session restoration -- enabling debugging of startup failures
- [x] **BOOT-02**: Deferred initialization delays non-essential loading (site guides, memory extraction, analytics prefetch) until after first user interaction, preserving eager loading for all tool definitions and core modules

### Mode Routing

- [ ] **MODE-01**: Formalize FSB's existing execution modes (autopilot, mcp-manual, mcp-agent, dashboard-remote) as named mode objects with per-mode tool pool configuration, safety limits, and UI feedback channel routing

### Module Adoption (Gap Closure)

- [ ] **ADOPT-01**: All new sessions created via `createSession(overrides)` -- no inline object literals for session construction in background.js
- [ ] **ADOPT-02**: `CostTracker` instantiated per session with `checkBudget()` replacing direct `totalCost` reads in safety breakers
- [ ] **ADOPT-03**: Each agent iteration produces a `createTurnResult()` object carrying tokens, cost, matched tools, and stop reason
- [ ] **ADOPT-04**: `ActionHistory` class instantiated per session wrapping the raw `actionHistory` array with query methods
- [ ] **ADOPT-05**: `session.mode` set on every new session based on entry point so `loadSessionConfig` applies per-mode limits

### Event Bus Wiring (Gap Closure)

- [x] **WIRE-01**: Popup and sidepanel message handlers include `case 'sessionStateEvent'` processing emitter events
- [x] **WIRE-02**: At least one UI surface visually reflects a SessionStateEmitter event

### Partial Outcome Lifecycle (Gap Closure)

- [x] **OUTCOME-01**: Agent loop supports a first-class partial/blocked terminal outcome distinct from `completed` and `error`
- [x] **OUTCOME-02**: Partial/blocked outcomes preserve structured completion summaries and render as non-crash results in MCP session history, popup, and sidepanel

### Auth Wall Handoff (Gap Closure)

- [ ] **AUTH-01**: Auth-required or credential-missing final steps end with preserved useful output and explicit blocker details instead of generic failure
- [ ] **AUTH-02**: Prompt/tool guidance steers the agent to use the partial/blocked outcome for auth walls and manual handoff scenarios after useful work is complete

### Overlay Lifecycle Reliability (Gap Closure)

- [x] **OVERLAY-01**: Active session overlay state is re-applied after navigation or content-script reconnect instead of disappearing until a rare special transition emits `sessionStatus`
- [x] **OVERLAY-02**: Long provider waits and retry windows keep the glow/progress overlay alive through heartbeat or degraded waiting-state refresh instead of silent watchdog cleanup
- [x] **OVERLAY-03**: Dashboard/debugger overlay state stays synchronized with canonical content overlay state across reconnects, page transitions, and resumed progress updates

## Future Requirements (v0.9.25+)

### Differentiators (deferred)

- **DIFF-01**: Configurable stop conditions -- max_iterations, stop_on_navigation, stop_on_pattern, stop_on_data_collected
- **DIFF-02**: Prompt routing -- pre-analyze user task to select likely tool tiers before AI call
- **DIFF-03**: Skill bundles -- package proven multi-step sequences as named reusable skills
- **DIFF-04**: Streaming turn events -- structured per-phase events to sidepanel for richer progress display
- **DIFF-05**: Structured output mode -- JSON-formatted AI responses with automatic retry for data extraction tasks
- **DIFF-06**: Parity audit utility -- validate tool/MCP schema consistency and site guide references

## Out of Scope

| Feature | Reason |
|---------|--------|
| Agent sub-spawning | Chrome MV3 single-thread service worker; race conditions on chrome.tabs APIs; cost multiplication |
| Plan mode toggle | Defeats single-attempt execution core value; doubles API calls |
| LSP-style tool integration | DOM snapshots and site guides already serve this purpose for browser context |
| Plugin architecture | MV3 CSP blocks runtime JS loading; premature for current stage |
| MCP resource browsing | Existing MCP tools already expose needed data |
| Voice integration | High complexity for niche use case; defer to v1.0+ |
| Command Graph (formal) | Prompt router + tool tiering covers task classification without formal graph |
| IndexedDB session storage | chrome.storage.local sufficient for current session volumes |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| STATE-01 | Phase 156 | Pending |
| STATE-02 | Phase 156 | Pending |
| STATE-03 | Phase 156 | Pending |
| STATE-04 | Phase 156 | Pending |
| STATE-05 | Phase 156 | Pending |
| ENGINE-01 | Phase 157 | Pending |
| ENGINE-02 | Phase 157 | Pending |
| ENGINE-03 | Phase 157 | Pending |
| ENGINE-04 | Phase 157 | Pending |
| MODE-01 | Phase 157 | Pending |
| HOOK-01 | Phase 158 | Pending |
| HOOK-02 | Phase 158 | Pending |
| HOOK-03 | Phase 158 | Pending |
| HOOK-04 | Phase 158 | Pending |
| LOOP-01 | Phase 159 | Pending |
| LOOP-02 | Phase 159 | Pending |
| LOOP-03 | Phase 159 | Pending |
| BOOT-01 | Phase 160 | Complete |
| BOOT-02 | Phase 160 | Complete |
| ADOPT-01 | Phase 161 | Pending |
| ADOPT-02 | Phase 161 | Pending |
| ADOPT-03 | Phase 161 | Pending |
| ADOPT-04 | Phase 161 | Pending |
| ADOPT-05 | Phase 161 | Pending |
| WIRE-01 | Phase 162 | Complete |
| WIRE-02 | Phase 162 | Complete |
| OUTCOME-01 | Phase 162.1 | Complete |
| OUTCOME-02 | Phase 162.1 | Complete |
| AUTH-01 | Phase 162.2 | Pending |
| AUTH-02 | Phase 162.2 | Pending |
| OVERLAY-01 | Phase 162.3 | Complete |
| OVERLAY-02 | Phase 162.3 | Complete |
| OVERLAY-03 | Phase 162.3 | Complete |

**Coverage:**
- v0.9.24 requirements: 33 total (19 original + 14 gap closure)
- Mapped to phases: 33
- Unmapped: 0

---
*Requirements defined: 2026-04-02*
*Last updated: 2026-04-03 after Phase 162.1 execution bookkeeping sync*
