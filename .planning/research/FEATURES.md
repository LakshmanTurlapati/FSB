# Feature Research: Claude Code Architecture Patterns for FSB

**Domain:** AI agent architecture adaptation -- extracting Claude Code's structural patterns for browser automation
**Researched:** 2026-04-02
**Confidence:** HIGH (based on direct source analysis of Research/claude-code/src/ Python clean-room rewrite, cross-referenced with FSB ai/ module code)

## Context

FSB v0.9.20 already shipped a native tool_use agent loop. This research identifies what Claude Code does **differently or better** that FSB should adopt. The reference source is `Research/claude-code/src/` -- a Python clean-room rewrite that faithfully mirrors Claude Code's architecture. Each feature below is grounded in specific source files.

**What FSB already has (not researched here):**
- Native tool_use agent loop (agent-loop.js)
- 47-tool JSON Schema registry shared between autopilot and MCP (tool-definitions.js)
- Provider format adapter for 6 AI providers (tool-use-adapter.js)
- Safety: $2 cost breaker, 10min time limit, 3-strike stuck detection (agent-loop.js)
- On-demand DOM snapshots and site guides
- Sliding window history compression at 80% token budget (agent-loop.js compactHistory)
- Session persistence for service worker resurrection

---

## Feature Landscape

### Table Stakes (Must Adopt -- Claude Code Does These; FSB Should Too)

Features that represent proven architecture patterns Claude Code relies on. Without these, FSB's agent loop will remain brittle compared to the reference architecture.

| # | Feature | Why Expected | Complexity | FSB Dependency | Notes |
|---|---------|--------------|------------|----------------|-------|
| T1 | Execution Registry (unified dispatch) | Claude Code's `execution_registry.py` wraps both commands and tools into a single dispatch layer with `.execute()` methods. FSB currently has split routing in background.js (autopilot path) and tool-executor.js (MCP path) that diverge. | MEDIUM | tool-executor.js, background.js | Replaces dual dispatch with one registry. Every invocation goes through the same `registry.tool(name).execute(params)` path regardless of caller. |
| T2 | Tool Pool with permission filtering | Claude Code's `tool_pool.py` assembles available tools per-session, applying `simple_mode` (restrict to 3 core tools), `include_mcp` filtering, and `ToolPermissionContext` deny-lists. FSB sends all 47 tools every time. | MEDIUM | tool-definitions.js, agent-loop.js | Context-aware tool set per task. Navigation task gets 12 tools, not 47. Reduces prompt bloat and hallucinated tool calls. |
| T3 | Command Graph (tiered routing) | Claude Code's `command_graph.py` separates commands into `builtins`, `plugin_like`, and `skill_like` tiers. FSB has a flat tool list with no hierarchy. | MEDIUM | tool-definitions.js | Tier the 47 tools: core (navigate, click, type, read_page), extended (CDP, sheets, tabs), and meta (complete_task, report_progress). AI gets core tier first; extended tools injected only when needed. |
| T4 | Deferred Init with trust gate | Claude Code's `deferred_init.py` delays plugin, skill, MCP prefetch, and session hook initialization until after a trust gate passes. FSB loads everything at service worker start. | LOW | background.js service worker | Defer non-essential initialization (site guide loading, memory extraction, analytics prefetch) until after the first user interaction. Reduces cold-start time. |
| T5 | Bootstrap Graph (ordered startup) | Claude Code's `bootstrap_graph.py` defines 7 ordered stages: prefetch, environment guards, CLI parser + trust gate, setup + commands/agents parallel load, deferred init, mode routing, query engine submit loop. FSB's startup is ad-hoc. | MEDIUM | background.js | Define explicit startup phases for the service worker. Enables debugging ("startup stuck at stage 3") and parallelism (load tools and settings concurrently). |
| T6 | Session Store (file-backed persistence) | Claude Code's `session_store.py` persists sessions as JSON files with session_id, messages, and token counts. FSB uses chrome.storage.local but loses sessions when storage limits hit. | LOW | agent-loop.js session persistence | Use IndexedDB for session persistence instead of chrome.storage.local. Larger quota, structured queries, survives service worker death. |
| T7 | Transcript Store with compaction | Claude Code's `transcript.py` is a dedicated store with `append()`, `compact(keep_last)`, `replay()`, and `flush()` methods. FSB inlines compaction logic in the agent loop. | LOW | agent-loop.js compactHistory | Extract history management into a standalone TranscriptStore class. Cleaner separation: the agent loop orchestrates, the transcript store manages memory. |
| T8 | Structured Turn Result | Claude Code's `TurnResult` dataclass carries: prompt, output, matched_commands, matched_tools, permission_denials, usage, and stop_reason. FSB's iteration result is implicit in session state mutations. | MEDIUM | agent-loop.js runAgentIteration | Each iteration returns a typed result object. Enables: logging every turn, replaying turns, computing diffs between turns. |
| T9 | Permission Context (deny-lists) | Claude Code's `permissions.py` implements `ToolPermissionContext` with deny_names and deny_prefixes. `blocks(tool_name)` gates every tool call. FSB has no per-session permission control. | LOW | tool-executor.js | Block dangerous tools per-context. Example: when running on banking sites, deny `type_text` on password fields. When in read-only mode, deny all mutation tools. |

### Differentiators (Competitive Advantage -- Patterns That Would Elevate FSB)

Features that go beyond matching Claude Code's baseline. These exploit Claude Code patterns in ways that are uniquely valuable for browser automation.

| # | Feature | Value Proposition | Complexity | FSB Dependency | Notes |
|---|---------|-------------------|------------|----------------|-------|
| D1 | Multi-turn loop with configurable stop conditions | Claude Code's `run_turn_loop` in `runtime.py` accepts `max_turns` and `structured_output` params, running up to N turns and stopping on specific stop_reasons. FSB's loop terminates only on complete_task/fail_task or safety breakers. | MEDIUM | agent-loop.js | Add configurable stop conditions: max_iterations (beyond safety), stop_on_navigation (for single-page tasks), stop_on_pattern (regex match on page content), stop_on_data_collected. Enables "scrape 10 pages then stop" without needing the AI to decide. |
| D2 | Prompt routing (intent-to-tool matching) | Claude Code's `PortRuntime.route_prompt()` scores each tool/command against the user's prompt tokens before the AI call. Highest-scoring matches are pre-selected. FSB relies entirely on the AI to pick tools. | HIGH | agent-loop.js, tool-definitions.js | Pre-analyze the user's task to select likely tool tiers. "Search for..." activates navigation+search tools. "Fill out the form..." activates interaction+typing tools. "Read all the data..." activates extraction+scroll tools. Reduces wasted iterations where AI tries irrelevant tools. |
| D3 | Skill bundles (reusable action sequences) | Claude Code's `skills/` system (20 modules) packages multi-step behaviors as named skills: batch, debug, loop, remember, stuck, verify. FSB has site guides but no executable skill abstraction. | HIGH | New module | Package proven sequences as skills: `login_flow(url, username, password)`, `scrape_paginated_list(next_selector, extract_fn)`, `fill_form_from_schema(form_data)`. AI invokes the skill name instead of planning 10+ individual steps. Dramatically reduces iteration count for common tasks. |
| D4 | Cost Hook (per-turn cost tracking with budget enforcement) | Claude Code's `costHook.py` applies a cost recording hook after every turn. The `QueryEngineConfig.max_budget_tokens` enforces a token budget alongside dollar cost. FSB tracks cost but only enforces a dollar limit. | LOW | agent-loop.js estimateCost | Add token budget enforcement alongside dollar cost. "Stop this session after 50K tokens total" catches runaway loops where cost is low (cheap model) but context is bloating. |
| D5 | Streaming turn events | Claude Code's `stream_submit_message()` yields events: message_start, command_match, tool_match, permission_denial, message_delta, message_stop. FSB sends status updates but not structured turn events. | MEDIUM | agent-loop.js, sidepanel.js | Emit structured events for each turn phase. Sidepanel can show: "Matched 3 tools" -> "Executing click..." -> "Tool returned success" -> "Analyzing result..." in real-time. Much richer than current "Reviewing page state" generic status. |
| D6 | Mode routing (local / remote / direct-connect) | Claude Code's `direct_modes.py` and `remote_runtime.py` support multiple execution modes. FSB always runs locally in the user's browser. | LOW | background.js | Formalize FSB's existing implicit modes: `autopilot` (AI drives), `mcp-manual` (Claude Code drives), `mcp-agent` (scheduled background), `dashboard-remote` (WebSocket relay). Each mode configures different tool pools, safety limits, and UI feedback channels. |
| D7 | Parity audit (self-validation) | Claude Code's `parity_audit.py` compares the Python workspace against the TypeScript archive to detect gaps. FSB has no automated architecture validation. | LOW | New utility | Build a parity checker that validates: all 47 tools have matching MCP schemas, all tools have test coverage entries, all site guides reference valid tool names. Catches drift when tools are added/renamed. |
| D8 | Structured output mode | Claude Code's `QueryEngineConfig.structured_output` with `structured_retry_limit` supports JSON-formatted responses with automatic retry. FSB relies on text parsing. | MEDIUM | agent-loop.js | For data extraction tasks, request structured JSON output from the AI. Retry with simplified prompt on parse failure. Eliminates the "AI returned prose instead of data" failure mode in scraping tasks. |

### Anti-Features (Do NOT Build -- Patterns That Don't Fit Browser Automation)

Features from Claude Code that seem appealing but would be harmful or wasteful for FSB.

| Anti-Feature | Why Requested | Why Problematic for FSB | Alternative |
|--------------|---------------|------------------------|-------------|
| Agent sub-spawning (AgentTool with forkSubagent) | Claude Code spawns sub-agents for parallel tasks. Tempting for multi-tab automation. | Chrome MV3 service worker has a single execution thread. Sub-agents would compete for the same chrome.tabs APIs, cause race conditions on DOM state, and multiply cost. Chrome's 5-minute service worker kill makes sub-agent lifecycle management fragile. | Use sequential multi-tab orchestration (switch_tab + execute on each tab in order). For true parallelism, use the MCP agent system which runs each agent as a separate scheduled session. |
| Plan mode toggle (EnterPlanModeTool / ExitPlanModeTool) | Claude Code can switch between plan-only and execute mode. Tempting to let users preview actions before execution. | FSB's value is reliable single-attempt execution. A plan-preview mode would double API calls (plan call + execute call) and introduce a UX where users second-guess the AI, defeating the purpose of automation. | Instead, use `report_progress` to narrate what the AI is about to do, giving users a chance to cancel via the stop button. This is already implemented. |
| LSP-style tool integration (LSPTool) | Claude Code integrates with Language Server Protocol for code intelligence. Tempting to add similar "page intelligence" tools. | Browser DOM is not a codebase. FSB already has DOM snapshots, site guides, and element caching that serve the same purpose. Adding an LSP-like layer would add complexity without improving element targeting. | Continue improving site guides and element scoring heuristics. These are the browser-specific equivalent of LSP intelligence. |
| Plugin architecture (loadAgentsDir, loadSkillsDir) | Claude Code dynamically loads plugins and skills from filesystem directories. Tempting for community-contributed browser automation recipes. | Chrome extensions cannot load arbitrary JavaScript at runtime (MV3 CSP restrictions). A plugin system would require a review/packaging pipeline, versioning, and security auditing that is premature for FSB's current stage. | Use site guide files as the "plugin" mechanism. They are already loaded dynamically, provide site-specific intelligence, and don't execute arbitrary code. |
| MCP resource browsing (ListMcpResourcesTool, ReadMcpResourceTool) | Claude Code can browse MCP server resources. Tempting to expose FSB's internal state as MCP resources. | FSB's MCP server already exposes tools for read_page, get_dom_snapshot, list_sessions, search_memory. Adding a separate resource browsing layer would duplicate existing functionality under a different abstraction. | Keep tools as the primary MCP interface. If structured data access is needed, add specific tools (e.g., get_site_guide, get_session_history) rather than a generic resource browser. |
| Worktree management (EnterWorktreeTool, ExitWorktreeTool) | Claude Code manages git worktrees for parallel development. No browser equivalent exists. | N/A -- this is a code-specific feature with no browser automation analog. | No alternative needed. |
| Voice integration (voice/) | Claude Code has voice input/output capabilities. Tempting for hands-free browser control. | Voice adds significant complexity (speech recognition, audio handling, permission management) for a niche use case. FSB's text input is sufficient for the automation use case. | Defer to v1.0+ if user demand materializes. The popup/sidepanel text input is the correct interface for now. |

---

## Feature Dependencies

```
T4 (Deferred Init)
    requires -> T5 (Bootstrap Graph) -- bootstrap graph defines WHEN deferred init runs

T2 (Tool Pool)
    requires -> T9 (Permission Context) -- pool uses permissions to filter tools
    requires -> T3 (Command Graph) -- tiers inform pool assembly

T1 (Execution Registry)
    requires -> T2 (Tool Pool) -- registry wraps pooled tools
    enhances -> D5 (Streaming Events) -- registry emit points enable event streaming

T7 (Transcript Store)
    enhances -> T8 (Structured Turn Result) -- turns are what gets stored

T8 (Structured Turn Result)
    requires -> T1 (Execution Registry) -- turn captures registry execution output
    enhances -> D5 (Streaming Events) -- turn events drive the stream

D1 (Configurable Stop Conditions)
    requires -> T8 (Structured Turn Result) -- stop conditions evaluate turn results

D2 (Prompt Routing)
    requires -> T3 (Command Graph) -- routing maps prompts to tool tiers
    enhances -> T2 (Tool Pool) -- routing output configures the pool

D3 (Skill Bundles)
    requires -> T1 (Execution Registry) -- skills dispatch through registry
    requires -> T3 (Command Graph) -- skills ARE the skill_like tier

D4 (Cost Hook)
    enhances -> T8 (Structured Turn Result) -- cost recorded per turn

D5 (Streaming Events)
    requires -> T8 (Structured Turn Result) -- events derived from turn lifecycle

D6 (Mode Routing)
    requires -> T2 (Tool Pool) -- each mode configures a different pool
    requires -> T9 (Permission Context) -- modes set different permissions

D8 (Structured Output)
    requires -> T8 (Structured Turn Result) -- structured output is a turn config option
```

### Dependency Notes

- **T2 (Tool Pool) requires T9 (Permission Context):** The pool assembly function filters tools through the permission context. Build permissions first, then pool assembly.
- **T3 (Command Graph) requires T2 (Tool Pool):** Not strictly -- the graph categorizes tools, and the pool uses categories. Build them together.
- **D2 (Prompt Routing) requires T3 (Command Graph):** Routing maps user intent to tool tiers defined by the command graph. Without tiers, routing has nothing to route to.
- **D3 (Skill Bundles) requires T1 (Execution Registry):** Skills are multi-step sequences dispatched through the registry. Without unified dispatch, skills would need to duplicate routing logic.
- **D5 (Streaming Events) conflicts with D8 (Structured Output):** Not a hard conflict, but streaming events and structured output serve different consumers (UI vs data pipeline). Implement separately.

---

## MVP Definition

### Launch With (Phase 1-2 of v0.9.24)

Minimum architecture adaptation -- patterns that improve FSB's agent loop quality immediately.

- [x] **T7 - Transcript Store** -- Extract history management from agent-loop.js into a standalone class with append/compact/replay/flush. Lowest friction refactor, immediate code clarity win. Already partially exists as compactHistory.
- [x] **T8 - Structured Turn Result** -- Each iteration returns a typed result object instead of mutating session state. Foundation for everything else.
- [x] **T9 - Permission Context** -- Simple deny-list class. 20 lines of code. Enables tool filtering immediately.
- [x] **T2 - Tool Pool** -- Assemble per-session tool sets using permission context. Reduces prompt token waste on every API call.
- [x] **D4 - Cost Hook** -- Add token budget enforcement alongside dollar cost limit. Trivial extension of existing cost tracking.

### Add After Validation (Phase 3-4 of v0.9.24)

Features to add once the core architecture refactors prove stable.

- [ ] **T1 - Execution Registry** -- Unify tool dispatch. Trigger: when tool-executor.js and background.js routing logic are confirmed to never diverge.
- [ ] **T3 - Command Graph** -- Tier tools into core/extended/meta. Trigger: when prompt routing (D2) is being built and needs tiers to route to.
- [ ] **T5 - Bootstrap Graph** -- Formalize startup stages. Trigger: when service worker cold-start time becomes a measured bottleneck.
- [ ] **T4 - Deferred Init** -- Delay non-essential loading. Trigger: after bootstrap graph identifies which stages can be deferred.
- [ ] **D5 - Streaming Events** -- Structured turn events to sidepanel. Trigger: after T8 (turn results) is shipping and sidepanel is ready to consume events.
- [ ] **D6 - Mode Routing** -- Formalize autopilot/mcp/agent/dashboard modes. Trigger: when different modes need different tool pools or safety configs.

### Future Consideration (v0.9.25+)

Features to defer until the core architecture is proven.

- [ ] **D1 - Configurable Stop Conditions** -- Defer because current complete_task/fail_task/safety stops are sufficient for most tasks. Add when users report "I wanted it to stop after 10 pages."
- [ ] **D2 - Prompt Routing** -- Defer because it requires NLP-quality intent detection and tool tier definitions (T3) to be stable. High complexity with moderate payoff initially.
- [ ] **D3 - Skill Bundles** -- Defer because it requires the registry (T1), graph (T3), and real-world usage data to know which skills to bundle. Premature optimization risk.
- [ ] **T6 - Session Store (IndexedDB)** -- Defer because chrome.storage.local works for current session volumes. Add when session history exceeds storage limits.
- [ ] **D7 - Parity Audit** -- Defer because the tool registry is stable. Add when tool count exceeds 60 or MCP schema drift becomes a real problem.
- [ ] **D8 - Structured Output** -- Defer because it requires provider-specific structured output support (Anthropic tool_use already structured, others vary). Add when data extraction tasks become a primary use case.

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority | Phase |
|---------|------------|---------------------|----------|-------|
| T7 - Transcript Store | MEDIUM | LOW | P1 | 1 |
| T8 - Structured Turn Result | HIGH | MEDIUM | P1 | 1 |
| T9 - Permission Context | MEDIUM | LOW | P1 | 1 |
| T2 - Tool Pool | HIGH | MEDIUM | P1 | 2 |
| D4 - Cost Hook | MEDIUM | LOW | P1 | 2 |
| T1 - Execution Registry | HIGH | MEDIUM | P2 | 3 |
| T3 - Command Graph | MEDIUM | MEDIUM | P2 | 3 |
| D5 - Streaming Events | HIGH | MEDIUM | P2 | 4 |
| D6 - Mode Routing | MEDIUM | LOW | P2 | 4 |
| T5 - Bootstrap Graph | LOW | MEDIUM | P2 | 4 |
| T4 - Deferred Init | LOW | LOW | P2 | 4 |
| D1 - Configurable Stop Conditions | MEDIUM | MEDIUM | P3 | Future |
| D2 - Prompt Routing | HIGH | HIGH | P3 | Future |
| D3 - Skill Bundles | HIGH | HIGH | P3 | Future |
| T6 - Session Store (IndexedDB) | LOW | MEDIUM | P3 | Future |
| D7 - Parity Audit | LOW | LOW | P3 | Future |
| D8 - Structured Output | MEDIUM | MEDIUM | P3 | Future |

**Priority key:**
- P1: Must have for this milestone (v0.9.24)
- P2: Should have, add when core is stable
- P3: Nice to have, future milestone

---

## Competitor Feature Analysis (Claude Code vs FSB Current)

| Architecture Pattern | Claude Code (Reference) | FSB Current | Adaptation Plan |
|---------------------|------------------------|-------------|-----------------|
| Tool dispatch | ExecutionRegistry wrapping MirroredCommand + MirroredTool with uniform `.execute()` | Split routing: tool-executor.js for MCP, background.js for autopilot, converging on same executeTool but with divergent error paths | T1: Single ExecutionRegistry class, one dispatch path for all callers |
| Tool availability | ToolPool assembled per-session with simple_mode, include_mcp, permission_context filters | All 47 tools sent every API call | T2: Per-session tool pool. Navigation task gets 15 tools, not 47 |
| Tool taxonomy | CommandGraph: builtins / plugin_like / skill_like tiers | Flat array with _route metadata (content/cdp/background) | T3: Three tiers (core 12 / extended 28 / meta 7) based on task type |
| Session history | TranscriptStore with append/compact/replay/flush, separate from agent loop | compactHistory function embedded in agent-loop.js | T7: Standalone TranscriptStore class |
| Turn results | TurnResult frozen dataclass with prompt, output, matched_tools, usage, stop_reason | Implicit: session.agentState mutated in place, no return value from iteration | T8: Return typed IterationResult from every runAgentIteration call |
| Permission gating | ToolPermissionContext with deny_names + deny_prefixes, checked on every tool call | None -- all tools always available | T9: Permission context per session, deny tools based on site/mode |
| Cost tracking | CostTracker + costHook recording per-turn, QueryEngineConfig.max_budget_tokens | estimateCost + $2 dollar limit check | D4: Add token budget alongside dollar budget |
| Startup lifecycle | BootstrapGraph with 7 ordered stages, DeferredInit for trust-gated loading | Ad-hoc: listeners registered, settings loaded, globals initialized in unclear order | T5 + T4: Explicit bootstrap stages with deferred loading |
| Execution modes | 6 modes: local, remote, SSH, teleport, direct-connect, deep-link | Implicit: autopilot vs MCP vs dashboard, mode affects behavior but not formalized | D6: Explicit mode enum with per-mode tool pool and safety config |
| Streaming | stream_submit_message yields 5 event types (start, match, denial, delta, stop) | sendSessionStatus with generic phase/statusText | D5: Structured event stream per turn |

---

## Detailed Implementation Notes

### T7 - Transcript Store

**Source:** `Research/claude-code/src/transcript.py` (24 lines)
**FSB equivalent:** `agent-loop.js compactHistory` function (lines 262-342)

**What to build:**
```javascript
class TranscriptStore {
  constructor() { this.entries = []; this.flushed = false; }
  append(message) { ... }      // Add message to history
  compact(keepLast = 5) { ... } // Trim old tool_results
  replay() { ... }             // Return all entries
  flush() { ... }              // Mark as persisted
  estimateTokens() { ... }    // Token count for budget checks
}
```

**Migration:** Extract compactHistory logic into TranscriptStore.compact(). Agent loop calls `session.transcript.append(msg)` instead of `session.messages.push(msg)`.

### T8 - Structured Turn Result

**Source:** `Research/claude-code/src/query_engine.py` TurnResult dataclass (lines 25-32)
**FSB equivalent:** None -- runAgentIteration mutates session.agentState in place

**What to build:**
```javascript
// Returned from every runAgentIteration call
{
  iteration: 5,
  toolCalls: [{ name: 'click', args: { selector: '#btn' }, result: { success: true, hadEffect: true } }],
  textResponse: null,
  usage: { input: 1200, output: 340, cost: 0.0003 },
  stopReason: 'tool_use',  // 'tool_use' | 'end_turn' | 'complete' | 'fail' | 'safety' | 'stuck'
  stuckHint: null
}
```

**Migration:** runAgentIteration becomes `async function runAgentIteration(sessionId, options) -> IterationResult`. The scheduling logic (setTimeout for next iteration) uses stopReason to decide continuation.

### T2 - Tool Pool

**Source:** `Research/claude-code/src/tool_pool.py` + `tools.py` get_tools() with simple_mode and include_mcp filters
**FSB equivalent:** `agent-loop.js getPublicTools()` (always returns all tools)

**What to build:**
```javascript
function assembleToolPool(taskType, permissions) {
  let tools = TOOL_REGISTRY;
  // Filter by task type (navigation gets fewer tools)
  if (taskType === 'navigation') tools = tools.filter(t => CORE_TOOLS.includes(t.name));
  // Filter by permissions
  if (permissions) tools = tools.filter(t => !permissions.blocks(t.name));
  // Filter MCP-only tools for autopilot
  return tools.map(stripRoutingMetadata);
}
```

### T9 - Permission Context

**Source:** `Research/claude-code/src/permissions.py` (21 lines)
**FSB equivalent:** None

**What to build:**
```javascript
class ToolPermissionContext {
  constructor(denyNames = [], denyPrefixes = []) { ... }
  blocks(toolName) { return this.denyNames.has(name) || this.denyPrefixes.some(p => name.startsWith(p)); }
  static readOnly() { return new ToolPermissionContext(['type_text','click','press_enter','press_key','select_option','check_box','clear_input','fill_sheet','navigate'], []); }
}
```

---

## Sources

- Direct analysis: `Research/claude-code/src/tool_pool.py` -- Tool pool assembly with mode/permission filtering
- Direct analysis: `Research/claude-code/src/tools.py` -- Tool snapshot loading, search, filtering, execution
- Direct analysis: `Research/claude-code/src/execution_registry.py` -- Unified command+tool dispatch registry
- Direct analysis: `Research/claude-code/src/command_graph.py` -- Three-tier command categorization
- Direct analysis: `Research/claude-code/src/commands.py` -- Command snapshot loading and routing
- Direct analysis: `Research/claude-code/src/permissions.py` -- Tool permission deny-list context
- Direct analysis: `Research/claude-code/src/query_engine.py` -- Turn loop, budget enforcement, compaction, structured output, streaming
- Direct analysis: `Research/claude-code/src/transcript.py` -- Dedicated transcript store with compaction
- Direct analysis: `Research/claude-code/src/session_store.py` -- File-backed session persistence
- Direct analysis: `Research/claude-code/src/runtime.py` -- PortRuntime with prompt routing and multi-turn loop
- Direct analysis: `Research/claude-code/src/bootstrap_graph.py` -- 7-stage ordered startup
- Direct analysis: `Research/claude-code/src/deferred_init.py` -- Trust-gated deferred initialization
- Direct analysis: `Research/claude-code/src/cost_tracker.py` + `costHook.py` -- Per-turn cost recording
- Direct analysis: `Research/claude-code/src/direct_modes.py` -- Execution mode routing
- Direct analysis: `Research/claude-code/src/system_init.py` -- System initialization message
- Direct analysis: `Research/claude-code/src/reference_data/tools_snapshot.json` -- 40+ tool types (AgentTool, BashTool, FileEditTool, GrepTool, MCPTool, etc.)
- Direct analysis: `Research/claude-code/src/reference_data/commands_snapshot.json` -- 90+ commands (compact, config, context, cost, diff, hooks, memory, permissions, plan, resume, skills, etc.)
- Direct analysis: `Research/claude-code/src/reference_data/subsystems/hooks.json` -- 104 hook modules including toolPermission handlers
- Direct analysis: `Research/claude-code/src/reference_data/subsystems/skills.json` -- 20 skill modules (batch, debug, loop, remember, stuck, verify, etc.)
- Direct analysis: `Research/claude-code/src/reference_data/subsystems/coordinator.json` -- coordinatorMode
- Direct analysis: `Research/claude-code/src/reference_data/subsystems/state.json` -- AppState, AppStateStore, selectors
- Direct analysis: `FSB/ai/agent-loop.js` -- Current agent loop implementation
- Direct analysis: `FSB/ai/tool-definitions.js` -- Current 47-tool registry
- Direct analysis: `FSB/ai/tool-executor.js` -- Current tool dispatch
- Direct analysis: `FSB/ai/tool-use-adapter.js` -- Current provider format adapter

---
*Feature research for: Claude Code Architecture Adaptation for FSB Browser Automation*
*Researched: 2026-04-02*
