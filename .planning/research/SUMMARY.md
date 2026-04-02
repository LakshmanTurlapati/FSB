# Project Research Summary

**Project:** FSB v0.9.24 -- Claude Code Architecture Adaptation
**Domain:** AI agent loop architecture adaptation (CLI agent patterns -> Chrome Extension MV3 browser automation)
**Researched:** 2026-04-02
**Confidence:** HIGH

## Executive Summary

FSB v0.9.24 adapts specific architectural patterns from Claude Code's agent loop into FSB's existing Chrome Extension browser automation engine. The research analyzed Claude Code's clean-room Python rewrite (1,902 TypeScript files mirrored, 184 tools, 207 commands) and mapped each subsystem to FSB's constraints. The consensus across all four research tracks is clear: approximately 40% of Claude Code's patterns translate directly (Tool Pool, Permission Context, Transcript Store, Session Store, Hook Pipeline, Cost Tracker), 30% need heavy adaptation to survive Chrome MV3's ephemeral service worker model, and 30% should be explicitly rejected (Command Graph, Skill System, Query Engine abstraction, Coordinator/sub-agent mode, Bootstrap Graph as a formal stage system). FSB already has a working agent loop from v0.9.20 -- this adaptation adds structural separation of concerns, not new capabilities.

The recommended approach is incremental extraction: pull cross-cutting concerns out of the 1,217-line agent-loop.js and the 10,187-line background.js into focused modules organized under four new directories (state/, engine/, hooks/, bootstrap/). The build order is state first (typed sessions, transcript store), then engine (tool pool, permissions), then hooks (safety, progress, tool permission), and finally agent loop integration. Each step is independently shippable and backward-compatible. The architecture research proposes 17 new files across these four directories, with only 3 existing files changing (background.js, agent-loop.js, tool-definitions.js) and all content scripts, UI files, and the MCP server remaining untouched.

The primary risk is Chrome MV3's service worker lifecycle. Every pattern adopted must survive the service worker being killed mid-session and restarted from cold storage. The pitfalls research identifies 7 critical failure modes, with the top three being: (1) session state loss on service worker kill because RuntimeSession assumes process persistence, (2) transcript compaction that discards critical context by using turn-count instead of token-budget thresholds, and (3) storage quota exhaustion from naively persisting full conversation histories. All three must be addressed in the first phase of implementation.

## Key Findings

### Recommended Stack

Six architectural patterns from Claude Code are worth adopting, all implemented as vanilla JavaScript modules loaded via `importScripts()` with no build system required.

**Core patterns to adopt:**
- **Tool Pool** (`ai/tool-pool.js`): Filtered views over TOOL_REGISTRY -- assembles per-session tool subsets based on task type and permissions, reducing the 47 tools sent on every API call to a relevant subset of 12-20. Directly reduces prompt token waste.
- **Permission Context** (`ai/permission-context.js`): Deny-list gating per tool name/prefix. Enables safe mode (block destructive tools), MCP-controlled tool exposure, and domain-specific restrictions (block `navigate` during data extraction).
- **Transcript Store** (`ai/transcript-store.js`): Extracts conversation history management from agent-loop.js into a standalone class with append/compact/replay/flush. Must preserve FSB's existing token-budget-aware compaction -- do NOT adopt Claude Code's simpler turn-count compaction.
- **Hook Pipeline** (`ai/hook-pipeline.js`): Seven named events (beforeIteration, afterApiResponse, beforeToolExecution, afterToolExecution, afterIteration, onCompletion, onError) replacing inline cross-cutting concerns scattered through runAgentIteration. Reduces agent-loop.js by ~100 lines immediately.
- **Session Store** (extend `background.js`): Structured session serialization with hot/warm state tiering. Hot state (Promises, setTimeout handles) is transient. Warm state (messages, iteration count, cost) is persisted to chrome.storage.session after every state change.
- **Cost Tracker** (`ai/cost-tracker.js`): Extracted cost tracking with token budget enforcement alongside existing dollar budget. Registered as an afterApiResponse hook.

**Patterns explicitly rejected (all four researchers agree):**
- Command Graph (FSB has no slash-commands)
- Skill System (site guides already cover this)
- Query Engine abstraction (agent loop IS the query engine)
- Coordinator/sub-agent mode (browser automation is serial)
- Bootstrap Graph as formal stage system (service worker startup is simple)
- Route Matching (AI picks tools via tool_use, not keyword scoring)

### Expected Features

**Must have (table stakes for v0.9.24):**
- T7 - Transcript Store: Extract history management into standalone class
- T8 - Structured Turn Result: Each iteration returns a typed result object
- T9 - Permission Context: Deny-list class for tool filtering
- T2 - Tool Pool: Per-session filtered tool sets
- D4 - Cost Hook: Token budget enforcement alongside dollar cost limit
- Session state schema: Typed session objects replacing ad-hoc property addition
- Session resumption: Restored sessions can continue automation, not just display status

**Should have (after core is stable):**
- T1 - Execution Registry: Unified tool dispatch with metrics tracking
- D5 - Streaming Events: Structured turn events to sidepanel
- D6 - Mode Routing: Formalize autopilot/mcp/agent/dashboard modes
- State events: Emit events on session state changes (replace scattered sendStatus calls)
- Deferred init: Delay non-essential loading after first interaction

**Defer (v0.9.25+):**
- D1 - Configurable Stop Conditions: Current complete_task/fail_task/safety stops are sufficient
- D2 - Prompt Routing: High complexity, requires stable tool tier definitions
- D3 - Skill Bundles: Requires registry, graph, and real-world usage data
- D8 - Structured Output: Provider-specific support varies
- T6 - Session Store (IndexedDB): chrome.storage.local works for current volumes
- D7 - Parity Audit: Premature until tool count exceeds 60
- T3 - Command Graph: Task classification handled by prompt-router without formal graph

### Architecture Approach

The architecture follows a "extract, don't rewrite" principle. The 17 new files are organized into four directories that decompose the two monolithic files (background.js and agent-loop.js) along responsibility boundaries: `state/` manages session schemas, transcript compaction, action history, and persistence; `engine/` manages tool pool assembly, permission gating, and session configuration; `hooks/` manages cross-cutting concerns (safety, permissions, progress); and `bootstrap/` structures service worker startup. The core agent loop structure (setTimeout chaining for MV3 compatibility) is explicitly preserved -- this is NOT a pattern to change.

**Major components:**
1. **state/** (5 files) -- Typed session schema, structured save/load, transcript compaction, action history, state change events. Foundation that everything else depends on.
2. **engine/** (4 files) -- Engine configuration, permission gating, tool pool assembly, prompt routing. Determines what tools are available and how the session is configured.
3. **hooks/** (3 files) -- Safety breakers, tool permission checks, progress notification pipeline. Extracted from agent-loop.js's main execution path into composable, testable handlers.
4. **bootstrap/** (5 files) -- Prefetch settings, environment detection, context building, deferred initialization, startup stage ordering. Structures the service worker resurrection flow.

### Critical Pitfalls

1. **Service worker kills RuntimeSession state** -- Chrome MV3 kills the service worker after 30 seconds of inactivity. Any in-memory session state is lost. Split state into hot tier (transient, accept loss) and warm tier (serializable, persist after every change). Design recovery paths for hot state loss. Never convert setTimeout-chaining back to a synchronous loop.

2. **Transcript compaction discards critical context** -- Claude Code's `compact(keep_last=10)` is too simplistic for FSB's constrained token budget. FSB's existing `compactHistory()` uses token-budget-aware compaction (triggers at 80%, keeps recent 5 intact, replaces old results with one-liners). Preserve this approach. Do NOT adopt the simpler turn-count method.

3. **chrome.storage quota exhaustion** -- Full StoredSession persistence (all messages including DOM snapshots) can hit 2-5MB per session. Use tiered storage: chrome.storage.session for metadata, chrome.storage.local for conversation history (append incrementally, not rewrite all), IndexedDB for large payloads (DOM snapshots, debug logs).

4. **Hook pipeline crossing process boundaries** -- Claude Code's hooks are in-process function calls. FSB hooks that need content script data cross process boundaries via chrome.tabs.sendMessage (5-15ms roundtrip, unreliable on orphaned scripts). Classify hooks by execution boundary: background-only hooks (cheap, reliable) vs content-requiring hooks (batch with tool execution, not separate roundtrips).

5. **Permission model assumes hierarchical paths** -- Claude Code's deny_prefixes work for filesystem paths but misfire on web origins. A prefix deny on "bank" blocks bankofamerica.com AND bankruptcy-info.org. Design permissions around origins (scheme+host+port) using Chrome's match patterns, not URL path prefixes.

## Implications for Roadmap

Based on combined research, the adaptation naturally divides into 5 phases with clear dependency ordering.

### Phase 1: State Foundation
**Rationale:** Every other module needs typed sessions and structured storage. The pitfalls research identifies service worker state loss (Pitfall 1) and storage quota exhaustion (Pitfall 3) as the two most critical risks -- both are state management problems. Build this first.
**Delivers:** Typed session schema, structured session persistence/resumption, conversation transcript store with budget-aware compaction, action history with structured events, state change event emitter.
**Addresses:** T7 (Transcript Store), T8 (Structured Turn Result), Session Store enhancement, Session State Schema
**Avoids:** Pitfall 1 (service worker state loss) by implementing hot/warm state tiering. Pitfall 2 (aggressive compaction) by preserving FSB's token-budget approach. Pitfall 3 (storage exhaustion) by implementing tiered storage with per-session byte budgets.

### Phase 2: Engine Configuration
**Rationale:** Tool pool and permissions depend on state being stable. Bootstrap and hooks depend on engine config existing. This phase provides the filtering and configuration infrastructure.
**Delivers:** Configurable session limits (max_turns, token budget, compact threshold), tool permission gating, filtered tool pool assembly, task type classification.
**Addresses:** T9 (Permission Context), T2 (Tool Pool), D4 (Cost Hook), Engine Config
**Avoids:** Pitfall 5 (path-based permissions) by designing origin-aware permission rules from the start.
**Uses:** state/session-schema.js, ai/tool-definitions.js (TOOL_REGISTRY)

### Phase 3: Hook Pipeline
**Rationale:** Hooks depend on both state (for session context) and engine (for permission context). Extracting hooks before the agent loop refactor means the refactor has target modules to delegate to.
**Delivers:** Safety breaker hooks (cost/time/stuck), tool permission pre-execution checks, unified progress notification pipeline.
**Addresses:** Hook Pipeline (7 events), safety extraction from agent-loop.js, progress notification consolidation
**Avoids:** Pitfall 4 (cross-process hooks) by classifying all initial hooks as background-only. Content-requiring hooks deferred to future phases.
**Uses:** engine/permissions.js, state/state-events.js

### Phase 4: Agent Loop Refactor
**Rationale:** This is the integration phase. All extracted modules (state, engine, hooks) are wired into agent-loop.js, replacing inline code with module calls. This phase has the largest change surface but the lowest conceptual risk because it is extracting existing logic, not adding new behavior.
**Delivers:** Slimmed agent-loop.js (~700 lines from ~1200), session resumption capability, structured iteration results, hook-driven cross-cutting concerns.
**Addresses:** Agent loop integration of all Phase 1-3 modules, session resumption (currently "restored sessions can only be stopped")
**Avoids:** Anti-Pattern 2 (blocking turn loop) by explicitly preserving setTimeout-chaining. Anti-Pattern 1 (over-abstracting execution registry) by keeping tool-executor.js as-is.

### Phase 5: Bootstrap Pipeline
**Rationale:** Least urgent because FSB's eager importScripts() loading works correctly. This phase optimizes startup without changing behavior. The pitfalls research warns (Pitfall 6) that deferred init can create cold-start penalties -- approach with caution.
**Delivers:** Structured service worker startup, settings prefetch, environment detection, deferred loading of non-critical subsystems (only after cache-aware design).
**Addresses:** T4 (Deferred Init), T5 (Bootstrap Graph -- lightweight, not formal stage system), service worker resurrection flow
**Avoids:** Pitfall 6 (deferred init stalling first command) by keeping eager importScripts for all tool definitions and core modules. Only defer resources that are expensive AND rarely needed AND cache-aware.

### Phase Ordering Rationale

- **State before Engine:** Tool pool assembly and permissions need typed session objects to store their configuration in. The session schema must exist before anything writes to it.
- **Engine before Hooks:** Safety hooks need permission context to know what is blocked. Progress hooks need engine config to know threshold values.
- **Hooks before Agent Loop Refactor:** The agent loop refactor replaces inline code with hook calls. The hooks must exist first.
- **Bootstrap last:** The current eager loading works. Optimizing startup is a performance improvement, not a correctness requirement. The pitfalls research specifically warns against premature deferred init in service workers.
- **17 new files, 3 modified files, 0 deleted files:** This is additive refactoring. Nothing breaks during incremental adoption because new modules are opt-in until the agent loop refactor phase integrates them.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 1 (State Foundation):** chrome.storage.session vs chrome.storage.local performance characteristics under realistic payloads. Need benchmarks for serialization/deserialization of 500KB session objects. The pitfalls research calls this out explicitly.
- **Phase 2 (Engine Configuration):** Origin-aware permission rules design. Need to research Chrome's declarativeNetRequest patterns and match pattern syntax for expressing URL-based permission rules. FEATURES.md and PITFALLS.md both flag this as needing design work.
- **Phase 4 (Agent Loop Refactor):** Session resumption capability. Need to understand exactly what state must be persisted for the agent loop to resume from an arbitrary iteration. The background.js comment at line 2248 ("Restored sessions can only be stopped, not resumed") indicates this is partially solved but not complete.

Phases with standard patterns (skip deep research):
- **Phase 3 (Hook Pipeline):** Well-documented event emitter pattern. The 7 hook events are already defined with clear lifecycle points. Implementation is straightforward.
- **Phase 5 (Bootstrap Pipeline):** Standard Chrome Extension startup patterns. The only non-obvious part is deferred init, which the pitfalls research recommends approaching conservatively.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All sources are local codebases (Claude Code Python rewrite + FSB). Every pattern recommendation is grounded in specific file references with line numbers. No external API or library risk. |
| Features | HIGH | Feature prioritization based on direct comparison of Claude Code subsystems against FSB equivalents. Each feature has clear source references and implementation sketches. |
| Architecture | HIGH | Architecture mapping is comprehensive (11 subsystems analyzed). The build order respects dependency chains verified in both codebases. Chrome MV3 constraints are well-understood from 9+ months of FSB development. |
| Pitfalls | HIGH | All 7 pitfalls are grounded in specific code patterns with line references. Recovery strategies are practical. The chrome.storage constraints are documented by Chrome's official developer documentation. |

**Overall confidence:** HIGH

### Gaps to Address

- **Storage performance under load:** The tiered storage strategy (chrome.storage.session for metadata, chrome.storage.local for history, IndexedDB for snapshots) is architecturally sound but not benchmarked. Need to profile read/write latency with realistic session payloads during Phase 1 implementation.
- **Permission model for iframes:** The pitfalls research flags that content scripts run in the top frame's origin but the AI might interact with elements inside cross-origin iframes. The permission model needs to account for this, but the exact mechanism is not specified. Address during Phase 2 design.
- **Session resumption completeness:** What is the minimum conversation context needed to resume an agent loop mid-task? The current approach (last 5 messages) may not be sufficient for complex multi-step tasks. Need to determine the right number experimentally during Phase 4.
- **STACK.md and FEATURES.md conflict on Command Graph:** STACK.md explicitly rejects Command Graph. FEATURES.md lists it as T3 (table stakes, Phase 3). ARCHITECTURE.md proposes a lightweight `commands/command-graph.js` as future-facing. Resolution: defer Command Graph to v0.9.25+. The prompt-router in engine/ handles task classification without requiring a formal command system. Tool tiering can be done via simple configuration in tool-pool.js.
- **STACK.md and FEATURES.md conflict on Bootstrap Graph:** STACK.md rejects Bootstrap Graph as overkill. FEATURES.md lists it as T5 (Phase 4). ARCHITECTURE.md proposes a bootstrap/ directory with 5 files. Resolution: implement lightweight startup ordering in Phase 5 but do NOT build a formal graph with stage dependencies. A simple sequential startup script is sufficient.

## Sources

### Primary (HIGH confidence)
- `Research/claude-code/src/` -- Full Python clean-room rewrite of Claude Code architecture. 20+ source files analyzed directly: tool_pool.py, tools.py, execution_registry.py, command_graph.py, commands.py, permissions.py, query_engine.py, transcript.py, session_store.py, runtime.py, bootstrap_graph.py, deferred_init.py, cost_tracker.py, costHook.py, system_init.py, context.py, history.py, direct_modes.py
- `Research/claude-code/src/reference_data/` -- Archive snapshots: tools_snapshot.json (184 tools), commands_snapshot.json (207 commands), subsystems/*.json (hooks: 104, skills: 20, coordinator: 1, state: 6, services: 130)
- FSB codebase: `ai/agent-loop.js` (1,217 lines), `ai/tool-definitions.js` (47 tools), `ai/tool-executor.js`, `ai/tool-use-adapter.js`, `ai/universal-provider.js`, `background.js` (10,187 lines)

### Secondary (MEDIUM confidence)
- Chrome MV3 documentation: Service worker lifecycle, chrome.storage API quotas, message passing reliability. Cross-referenced with FSB's existing MV3 patterns (setTimeout chaining, importScripts, keep-alive).

### Tertiary (LOW confidence)
- Storage performance estimates (50-200ms for multi-MB JSON serialization) -- based on general Chrome Extension development experience, not benchmarked against FSB's specific payloads. Needs validation in Phase 1.

---
*Research completed: 2026-04-02*
*Ready for roadmap: yes*
