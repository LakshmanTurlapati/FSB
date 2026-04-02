# Stack Research: Claude Code Architecture Adaptation for FSB

**Domain:** Browser automation Chrome Extension -- architectural pattern adaptation
**Researched:** 2026-04-02
**Mode:** Feasibility + Comparison (Claude Code patterns mapped to Chrome Extension MV3)
**Confidence:** HIGH (primary sources are local codebases on both sides)

## Executive Summary

This research analyzes the Claude Code clean-room rewrite at `Research/claude-code/src/` and maps each architectural subsystem to FSB's existing browser automation extension. The goal is NOT to port Claude Code wholesale -- it is to identify which patterns solve real problems FSB currently has and adapt those patterns to Chrome Extension MV3 constraints.

Claude Code's architecture (1,902 TypeScript files, 207 commands, 184 tools) is designed for a long-running CLI REPL with a persistent filesystem. FSB is a Chrome Extension service worker that Chrome can kill at any time, communicates via message passing, and has no filesystem. This fundamental difference means approximately 40% of Claude Code's patterns directly translate, 30% need significant adaptation, and 30% should be explicitly rejected.

The six patterns worth adopting: **Tool Pool with deferred init**, **Execution Registry**, **Transcript Store with compaction**, **Session Store**, **Permission Context**, and **Hook Pipeline**. The patterns to reject: **Command Graph** (FSB has no slash-commands), **Skill System** (adds complexity without browser automation value), **Query Engine** (FSB already has a simpler/better approach), and **Coordinator Mode** (single-agent is correct for browser automation).

FSB's existing `ai/` module suite (agent-loop.js, tool-definitions.js, tool-executor.js, tool-use-adapter.js, universal-provider.js) already implements the core agent loop well. The adaptation adds structure and separation of concerns, not new capabilities.

## Recommended Stack

### Core Architecture Patterns to Adopt

| Pattern | Source | Maps To | Why Recommended |
|---------|--------|---------|-----------------|
| Tool Pool | `tool_pool.py` + `tools.py` | New `ai/tool-pool.js` | FSB's `TOOL_REGISTRY` is a flat const array. Tool Pool adds filtered views (read-only subset, provider-specific subset, permission-gated subset) without modifying the source array. Directly solves the problem of sending all 42+ tools when only a subset applies. |
| Deferred Init | `deferred_init.py` | New `ai/deferred-init.js` | Chrome MV3 service workers cold-start frequently. Deferred init lets the agent loop start fast (tools + provider) and defer expensive work (site guide loading, memory system, MCP prefetch) to after the first iteration. Currently FSB loads everything synchronously in `runAgentLoop`. |
| Execution Registry | `execution_registry.py` | Extend `ai/tool-executor.js` | FSB already has a tool executor, but the registry pattern adds named lookup, execution tracking (call count, error rate, last-used timestamp), and the ability to dynamically enable/disable tools. This directly feeds stuck detection and cost optimization. |
| Transcript Store | `transcript.py` | New `ai/transcript-store.js` | FSB currently manages `session.messages` as a raw array with inline `compactHistory()`. Extracting to a dedicated store with `append()`, `compact()`, `replay()`, and `flush()` separates concerns and enables replay/export features that MCP agent history needs. |
| Session Store | `session_store.py` | Extend `background.js` session management | FSB already persists sessions via `chrome.storage.local`. The pattern adds structured serialization/deserialization (instead of raw JSON dumps) and session resumption from stored state. This directly fixes the service worker restart problem. |
| Permission Context | `permissions.py` | New `ai/permission-context.js` | FSB has safety breakers (cost + time limits) but no per-tool permission gating. Permission Context enables: blocking destructive tools in "safe mode", requiring confirmation for navigation away from current domain, and the MCP server controlling which tools are exposed. |
| Hook Pipeline | `hooks/` (104 modules) | New `ai/hook-pipeline.js` | FSB currently has inline if-checks scattered through `runAgentIteration` (safety checks, progress reporting, stuck detection, dashboard broadcast). A hook pipeline (`beforeToolExecution`, `afterToolExecution`, `onIteration`, `onCompletion`, `onError`) consolidates these into composable observers. |
| Cost Tracker | `cost_tracker.py` + `costHook.py` | Extend existing `estimateCost` | FSB already tracks cost inline. The pattern extracts it into a standalone tracker with event logging and budget enforcement as a hook, not inline code. Minor refactor with clean separation. |

### Patterns to Adapt Heavily

| Pattern | Source | Adaptation Needed | Why Different |
|---------|--------|-------------------|---------------|
| Runtime Session | `runtime.py` (`RuntimeSession`) | Merge with FSB's existing session model | Claude Code's RuntimeSession is a snapshot (prompt, context, matches, results). FSB's session is a long-lived mutable state bag that persists across service worker restarts. Keep FSB's mutable model but add RuntimeSession's structured fields (routed matches, turn results). |
| History Log | `history.py` | Merge into Transcript Store | Claude Code separates HistoryLog (semantic events: "routing completed", "tool executed") from TranscriptStore (conversation messages). FSB should combine these -- the action history (`session.actionHistory`) and message history (`session.messages`) should be in one store with typed entries. |
| Context | `context.py` | Not needed as-is | Claude Code's PortContext tracks filesystem metadata (Python file count, archive availability). FSB's context is the browser state (current URL, tab ID, DOM hash). FSB already has this in `session.tabId`, `session.agentState`. No new module needed -- but the PRINCIPLE of a structured context object (instead of scattered session properties) applies. |

### Patterns to Reject

| Pattern | Source | Why Reject |
|---------|--------|------------|
| Command Graph | `command_graph.py`, `commands.py` (207 entries) | Claude Code has slash-commands (`/add-dir`, `/branch`, `/bridge`, etc.) for interactive REPL use. FSB is a single-purpose automation agent. Users give a task string, not slash-commands. The FSB popup/sidepanel already handles task input. Adding a command graph adds complexity with zero user-facing value. |
| Skill System | `skills/` (20 modules: batch, debug, loop, remember, stuck, verify, etc.) | Skills in Claude Code are user-extensible prompt templates with execution logic (like "macros"). FSB's equivalent is site guides + procedural memory, which are already implemented and tightly coupled to browser automation. A generic skill system would duplicate existing functionality without improving it. |
| Query Engine | `query_engine.py`, `QueryEngine.py` | Claude Code's QueryEngine manages structured output, retries, and session lifecycle for the REPL conversation. FSB's `agent-loop.js` already does this more directly -- it calls the provider, processes tool calls, manages history, and persists state. The QueryEngine adds an abstraction layer that FSB does not need because the agent loop IS the query engine. |
| Coordinator Mode | `coordinator/` (1 module: `coordinatorMode.ts`) | Coordinator mode in Claude Code manages sub-agents, parallel task delegation, and swarm workers. FSB browser automation is inherently sequential (one browser, one tab at a time, actions must complete before next). Multi-agent coordination would require multiple browser contexts (puppeteer/playwright territory), which is out of scope. |
| Prefetch | `prefetch.py` | Prefetch simulates MDM reads, keychain access, and project scanning at startup. None of these apply to a Chrome Extension. Chrome's `chrome.storage.local` is synchronous-enough, and there is no project filesystem to scan. |
| Bootstrap Graph | `bootstrap_graph.py` | Claude Code has a complex multi-stage startup sequence. FSB's startup is: service worker activates -> listen for messages. The deferred init pattern covers the useful part; the full bootstrap graph is overkill. |

## Architecture Mapping: Claude Code to FSB

### Side-by-Side Comparison

| Claude Code Component | CC File(s) | FSB Equivalent Today | FSB After Adaptation |
|----------------------|------------|---------------------|---------------------|
| Tool definitions | `reference_data/tools_snapshot.json` (184 entries) | `ai/tool-definitions.js` (42 tools, `TOOL_REGISTRY` array) | Same file, same format. No change needed. |
| Tool pool assembly | `tool_pool.py` (`assemble_tool_pool`) | None -- `getPublicTools()` returns all tools always | New `ai/tool-pool.js`: `assembleToolPool(mode, permissions)` returns filtered subset |
| Tool execution | `tools.py` (`execute_tool`) | `ai/tool-executor.js` (`executeTool`) | Extend with execution tracking (call count, timing, error rate per tool) |
| Execution registry | `execution_registry.py` | None -- tool lookup is inline in agent-loop.js | New registry wrapping tool-executor.js with named lookup + metrics |
| Permission gating | `permissions.py` (`ToolPermissionContext`) | Safety breakers (cost/time) in agent-loop.js | New `ai/permission-context.js` with tool-level deny lists |
| Conversation history | `history.py` + `transcript.py` | `session.messages` array + `compactHistory()` function | New `ai/transcript-store.js` with typed entries, compaction, replay |
| Session persistence | `session_store.py` | `persistSession()` in background.js | Structured session serializer with resumption capability |
| Cost tracking | `cost_tracker.py` + `costHook.py` | `estimateCost()` + inline accumulation in agent-loop.js | Extract to `ai/cost-tracker.js` with event log and hook integration |
| Agent loop | `runtime.py` (`run_turn_loop`) | `ai/agent-loop.js` (`runAgentIteration`) | Add hook pipeline integration, structured context passing |
| System init | `system_init.py` | `buildSystemPrompt()` in agent-loop.js | Add deferred-init for non-critical subsystems |
| State management | `state/` (6 modules) | Scattered session properties | Consolidate into structured session state object |
| Deferred init | `deferred_init.py` | None -- everything loads synchronously | New `ai/deferred-init.js` for post-first-iteration loading |
| Route matching | `runtime.py` (`route_prompt`) | None | Not needed -- FSB dispatches by tool name, not prompt matching |

### Integration Points with Existing FSB Code

**agent-loop.js (1,217 lines)** -- The core file that changes most:
- `runAgentLoop()` (line 595): Add deferred init call after first API response
- `runAgentIteration()` (line 724): Replace inline safety checks with hook pipeline calls
- `getPublicTools()` (line 355): Replace with tool pool assembly
- `compactHistory()` (line 262): Move to transcript store
- `detectStuck()` (line 184): Register as an `afterToolExecution` hook
- `checkSafetyBreakers()` (line 145): Register as a `beforeIteration` hook
- Tool result accumulation (lines 1078-1085): Register as an `afterToolExecution` hook for action history

**tool-executor.js (executeTool)** -- Wrap with execution registry:
- Add `beforeExecution` and `afterExecution` hooks
- Track per-tool metrics (call count, success rate, avg duration)
- Log to transcript store

**tool-definitions.js (TOOL_REGISTRY)** -- No changes needed:
- Tool Pool reads from this unchanged source
- Permission Context filters at pool assembly time

**background.js (10,187 lines)** -- Session management changes:
- `activeSessions.set()` (line 5388): Use structured session factory
- `persistSession()`: Use session store serializer
- Session resumption after service worker restart: Use session store deserializer

**tool-use-adapter.js** -- No changes needed:
- Provider format adaptation is orthogonal to architectural patterns

### What NOT to Change

1. **Do not add a command graph.** FSB users interact through popup/sidepanel chat, not CLI commands. The agent receives a task string and autonomous executes. There is no interactive command loop.

2. **Do not add a skill system.** FSB already has site guides (50+ JSON files), procedural memory (extracted from successful sessions), and cross-domain strategy transfer. These are more specific and more useful for browser automation than generic "skill" templates.

3. **Do not introduce a query engine abstraction.** The agent loop IS the query engine. Adding an intermediary layer between the agent loop and the AI provider would slow down iteration speed and obscure the straightforward request-response-execute cycle.

4. **Do not add coordinator/sub-agent patterns.** Browser automation is inherently serial. One tab, one action at a time. Multi-agent patterns require multiple browser contexts (headless instances), which is a fundamentally different architecture.

5. **Do not add route matching.** Claude Code matches prompts to commands/tools by keyword scoring. FSB dispatches by tool name from the AI's tool_use response. The AI decides which tool to call -- we do not second-guess it.

6. **Do not add Bootstrap Graph.** Service worker startup is fast. The useful startup optimization (deferred init) is a single module, not a graph.

## Detailed Pattern Specifications

### 1. Tool Pool (`ai/tool-pool.js`)

**What Claude Code does:** `assemble_tool_pool()` takes `simple_mode`, `include_mcp`, and `permission_context` and returns a frozen tuple of tools filtered by these criteria.

**FSB adaptation:**
```javascript
// Tool Pool: Filtered views over TOOL_REGISTRY
function assembleToolPool(options = {}) {
  let tools = [...TOOL_REGISTRY];

  // Mode filtering (like Claude Code's simple_mode)
  if (options.readOnly) {
    tools = tools.filter(t => t._readOnly);
  }
  if (options.excludeRoutes) {
    tools = tools.filter(t => !options.excludeRoutes.includes(t._route));
  }

  // Permission filtering (like Claude Code's permission_context)
  if (options.permissions) {
    tools = tools.filter(t => !options.permissions.blocks(t.name));
  }

  // Strip internal metadata for AI consumption
  return Object.freeze(tools.map(t => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema
  })));
}
```

**Why this helps FSB:** Currently `getPublicTools()` returns all 42+ tools every time. The tool pool enables:
- MCP server exposing a different tool subset than autopilot
- Safe mode excluding destructive tools (navigate away, clear_input, etc.)
- Context-specific tool filtering (e.g., hide fill_sheet when not on Google Sheets)

### 2. Deferred Init (`ai/deferred-init.js`)

**What Claude Code does:** `run_deferred_init(trusted)` conditionally initializes plugins, skills, MCP prefetch, and session hooks after core startup.

**FSB adaptation:**
```javascript
// Deferred init: load non-critical subsystems after first API response
async function runDeferredInit(session) {
  // These can wait until after the first iteration starts:
  const results = {
    siteGuides: false,
    proceduralMemory: false,
    hookPipeline: false,
    mcpBridge: false
  };

  try {
    // Site guide loading (currently blocks session start)
    if (typeof loadSiteGuides === 'function') {
      await loadSiteGuides(session.tabId);
      results.siteGuides = true;
    }
  } catch (_e) { /* non-fatal */ }

  // ... similar for other subsystems
  return results;
}
```

**Why this helps FSB:** Chrome MV3 service workers cold-start frequently. Every millisecond before the first API call matters. Site guide loading, memory system initialization, and MCP bridge setup can all happen in parallel with the first AI call.

### 3. Execution Registry (extend `ai/tool-executor.js`)

**What Claude Code does:** `ExecutionRegistry` wraps commands and tools with named lookup and execution methods. Each entry has a `name`, `source_hint`, and `execute()` method.

**FSB adaptation:** Wrap the existing `executeTool` with metrics tracking:
```javascript
const executionMetrics = new Map(); // tool_name -> { calls, successes, failures, totalMs }

async function executeToolTracked(name, params, tabId, options) {
  const start = Date.now();
  const metrics = executionMetrics.get(name) || { calls: 0, successes: 0, failures: 0, totalMs: 0 };

  metrics.calls++;
  const result = await executeTool(name, params, tabId, options);

  if (result.success) metrics.successes++;
  else metrics.failures++;
  metrics.totalMs += (Date.now() - start);

  executionMetrics.set(name, metrics);
  return result;
}
```

**Why this helps FSB:** Execution metrics directly feed:
- Stuck detection (3 consecutive failures on same tool = try different approach)
- Cost reporting (which tools are most called, average execution time)
- Dynamic tool selection hints in system prompt ("click has 95% success rate on this site")

### 4. Transcript Store (`ai/transcript-store.js`)

**What Claude Code does:** `TranscriptStore` maintains a list of entries with `append()`, `compact(keep_last)`, `replay()`, and `flush()` methods.

**FSB adaptation:** Extend with typed entries and provider-aware compaction:
```javascript
class TranscriptStore {
  constructor(options = {}) {
    this.entries = [];        // Raw message objects
    this.compactAfter = options.compactAfter || 12;
    this.keepRecent = options.keepRecent || 5;
  }

  append(message) { this.entries.push(message); }

  compact(tokenBudget = 128000) {
    // Absorb existing compactHistory() logic
    // Keep system prompt, keep last N tool results, compress older ones
  }

  replay() { return [...this.entries]; }

  toStorable() {
    // Serialize for chrome.storage.local (strip large tool results)
  }

  static fromStored(data) {
    // Deserialize for session resumption
  }
}
```

**Why this helps FSB:** The existing `compactHistory()` function is 80 lines of inline code in agent-loop.js that mutates `session.messages` in place. Extracting to a store:
- Makes compaction testable in isolation
- Enables session replay (for debugging, MCP session export)
- Separates message format concerns from compaction logic
- Enables transcript-based analytics (token usage over time per session)

### 5. Session Store (extend `background.js`)

**What Claude Code does:** `StoredSession` is a frozen dataclass with `session_id`, `messages`, `input_tokens`, `output_tokens`. `save_session()` writes JSON, `load_session()` reads it.

**FSB adaptation:** Structured session serialization with chrome.storage.local:
```javascript
function serializeSession(session) {
  return {
    sessionId: session.sessionId,
    task: session.task,
    tabId: session.tabId,
    status: session.status,
    agentState: session.agentState,
    messages: session.messages, // Or transcript store serialization
    actionHistory: (session.actionHistory || []).slice(-20), // Cap for storage
    providerConfig: {
      providerKey: session.providerConfig?.providerKey,
      model: session.providerConfig?.model
      // Do NOT store API key -- read from chrome.storage.local on resume
    },
    safetyConfig: session.safetyConfig,
    createdAt: session.createdAt || Date.now()
  };
}

async function resumeSession(sessionId) {
  const stored = await chrome.storage.local.get(`session:${sessionId}`);
  if (!stored) return null;
  // Reconstruct provider instance, rebuild transcript store, resume iteration
}
```

**Why this helps FSB:** Chrome can kill the service worker at any time. Currently `persistSession()` saves raw session data but resumption recreates everything from scratch. Structured session store enables true warm-resumption where the agent loop picks up from the last completed iteration.

### 6. Permission Context (`ai/permission-context.js`)

**What Claude Code does:** `ToolPermissionContext` holds `deny_names` (exact match) and `deny_prefixes` (prefix match). `blocks(tool_name)` checks both.

**FSB adaptation:**
```javascript
class PermissionContext {
  constructor({ denyNames = [], denyPrefixes = [], requireConfirmation = [] } = {}) {
    this.denyNames = new Set(denyNames.map(n => n.toLowerCase()));
    this.denyPrefixes = denyPrefixes.map(p => p.toLowerCase());
    this.requireConfirmation = new Set(requireConfirmation.map(n => n.toLowerCase()));
  }

  blocks(toolName) {
    const lower = toolName.toLowerCase();
    return this.denyNames.has(lower) ||
           this.denyPrefixes.some(p => lower.startsWith(p));
  }

  needsConfirmation(toolName) {
    return this.requireConfirmation.has(toolName.toLowerCase());
  }

  static safeMode() {
    return new PermissionContext({
      denyNames: ['navigate', 'open_tab', 'fill_sheet'],
      requireConfirmation: ['click', 'type_text', 'select_option']
    });
  }

  static mcpMode(allowedTools = []) {
    // Only expose tools explicitly allowed by MCP client
    const allTools = TOOL_REGISTRY.map(t => t.name);
    const denied = allTools.filter(t => !allowedTools.includes(t));
    return new PermissionContext({ denyNames: denied });
  }
}
```

**Why this helps FSB:**
- MCP server can expose a controlled subset of tools
- Future "safe mode" for untrusted automation tasks
- Domain-specific restrictions (e.g., block `navigate` when running a data extraction task to prevent the AI from navigating away from the target site)

### 7. Hook Pipeline (`ai/hook-pipeline.js`)

**What Claude Code does:** The `hooks/` directory has 104 modules covering notifications, permissions, suggestions, and lifecycle events. The core pattern is event-based observers.

**FSB adaptation:** Lightweight hook system (NOT 104 modules):
```javascript
class HookPipeline {
  constructor() {
    this.hooks = new Map(); // event_name -> [handler, handler, ...]
  }

  register(event, handler) {
    if (!this.hooks.has(event)) this.hooks.set(event, []);
    this.hooks.get(event).push(handler);
  }

  async run(event, context) {
    const handlers = this.hooks.get(event) || [];
    for (const handler of handlers) {
      const result = await handler(context);
      if (result?.abort) return result; // Allow hooks to abort the pipeline
    }
    return { abort: false };
  }
}

// Usage in agent loop:
// hooks.register('beforeIteration', checkSafetyBreakers);
// hooks.register('afterToolExecution', detectStuck);
// hooks.register('afterToolExecution', trackExecutionMetrics);
// hooks.register('afterIteration', broadcastDashboardProgress);
// hooks.register('onCompletion', notifySidepanel);
// hooks.register('onError', logToAutomationLogger);
```

**FSB hook events (7 total, not 104):**

| Hook Event | When Fired | Current Inline Code It Replaces |
|-----------|-----------|--------------------------------|
| `beforeIteration` | Before API call | `checkSafetyBreakers()` (line 817), progress status (line 840) |
| `afterApiResponse` | After API response, before tool parsing | Usage accumulation (lines 868-878) |
| `beforeToolExecution` | Before each tool call | Tool-specific status updates (line 1038) |
| `afterToolExecution` | After each tool call | Action history (line 1078), stuck detection (line 1104) |
| `afterIteration` | After all tool results pushed to history | Dashboard broadcast (line 1114), session persist (line 1119) |
| `onCompletion` | When task completes or fails | `finalizeSession()` call (line 919/1002/1020) |
| `onError` | When API call fails | Error handling block (lines 1126-1206) |

**Why this helps FSB:** The `runAgentIteration` function is currently 480 lines because it mixes core loop logic with cross-cutting concerns (progress reporting, cost tracking, stuck detection, dashboard broadcast, session persistence, error classification). Hooks extract these concerns into composable, testable, independently-maintainable handlers.

## Installation

No npm packages needed. All patterns are implemented as vanilla JavaScript modules loaded via `importScripts()` in the Chrome Extension service worker context. This preserves the project's "no build system" constraint.

```
ai/
  agent-loop.js          -- Modified (hook pipeline integration, deferred init, tool pool)
  tool-definitions.js    -- Unchanged (source of truth for tool schemas)
  tool-executor.js       -- Extended (execution registry metrics wrapper)
  tool-use-adapter.js    -- Unchanged (provider format adaptation)
  universal-provider.js  -- Unchanged (API communication)
  tool-pool.js           -- NEW: Filtered views over TOOL_REGISTRY
  deferred-init.js       -- NEW: Post-startup subsystem loading
  permission-context.js  -- NEW: Tool-level permission gating
  transcript-store.js    -- NEW: Conversation history management
  hook-pipeline.js       -- NEW: Event-based cross-cutting concerns
  cost-tracker.js        -- NEW: Extracted cost tracking with event log
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Lightweight hook pipeline (7 events) | Full event emitter (Node EventEmitter pattern) | Only if hooks need wildcard listeners or priority ordering. 7 named events with sequential handlers is sufficient for FSB's needs. |
| Transcript Store as class | Keep inline `compactHistory()` | Only if the agent loop remains a single file that never needs testing in isolation. The current approach works but does not scale to session replay or MCP export. |
| Permission Context with deny lists | Role-based access control (RBAC) | Only if FSB supports multiple user roles (admin, viewer, limited). Currently there is one user with one permission level. Deny-list is simpler and covers MCP + safe mode. |
| Deferred init via setTimeout(0) | Web Worker for parallel init | Only if init work is CPU-intensive. Site guide loading is I/O (chrome.storage reads), so setTimeout(0) is fine. Web Workers add messaging complexity for no benefit. |
| Tool pool as function | Tool pool as class with caching | Only if tool pool is assembled frequently. In practice it is assembled once per session. A function returning a frozen array is simpler. |
| Extract cost-tracker to separate file | Keep inline in agent-loop.js | Only if you are certain agent-loop.js will not grow further. Given hook pipeline integration, extracting cost tracking keeps agent-loop.js focused. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Claude Code's Command Graph | FSB has no interactive commands. Users submit tasks, not slash-commands. Adding 207 command definitions is pure bloat. | Task string passed directly to agent loop. |
| Claude Code's Skill System | FSB already has site guides + procedural memory that are more specific to browser automation than generic "skills". | Existing site guide system (`guides/` directory, 50+ JSON files). |
| Claude Code's Query Engine | Adds an abstraction layer between agent loop and provider that FSB does not need. The agent loop IS the query engine. | Direct `callProviderWithTools()` in agent-loop.js. |
| Claude Code's Coordinator Mode | Browser automation is serial. Multi-agent requires multiple browser contexts (puppeteer territory). | Single-agent loop with sequential tool execution. |
| Claude Code's Bootstrap Graph | Chrome Extension startup is: service worker activates, listen for messages. Two steps. A graph is overkill. | `runDeferredInit()` after first iteration. |
| Claude Code's Route Matching | Matching prompts to tools by keyword scoring conflicts with tool_use protocol. The AI picks tools; we execute them. | AI provider's native tool_use selection. |
| Full EventEmitter pattern | Over-engineering for 7 hook events. Wildcard listeners, priority ordering, and once() semantics are not needed. | Simple Map of event -> handler arrays. |
| State management library (Redux/Zustand/etc.) | Chrome Extension state lives in chrome.storage.local and in-memory Maps. A state library adds a dependency and abstraction for simple key-value state. | Structured session objects with explicit serialize/deserialize. |

## Stack Patterns by Variant

**If implementing Tool Pool first (recommended):**
- Create `ai/tool-pool.js` with `assembleToolPool(options)`
- Update `getPublicTools()` in agent-loop.js to call `assembleToolPool()`
- No other changes needed -- this is purely additive
- Validates the pattern before wider adoption

**If implementing Hook Pipeline first:**
- Create `ai/hook-pipeline.js` with `HookPipeline` class
- Extract `checkSafetyBreakers` into a `beforeIteration` hook
- Extract `detectStuck` into an `afterToolExecution` hook
- Reduces agent-loop.js by ~100 lines immediately
- Other hooks migrated incrementally

**If implementing everything at once:**
- Create all 6 new files
- Refactor `runAgentIteration` to use hook pipeline
- Replace `getPublicTools()` with tool pool
- Wrap `executeTool` with execution registry
- Extract `compactHistory` to transcript store
- Risk: Large change surface. Recommend incremental approach.

## Version Compatibility

| Component | Compatible With | Notes |
|-----------|-----------------|-------|
| `ai/tool-pool.js` | `ai/tool-definitions.js` (unchanged) | Reads `TOOL_REGISTRY` global. Must be loaded after `tool-definitions.js` in `importScripts` order. |
| `ai/hook-pipeline.js` | `ai/agent-loop.js` (modified) | Agent loop calls `hooks.run()` at defined points. Hooks receive session context, not raw arguments. |
| `ai/permission-context.js` | `ai/tool-pool.js` (new) | Permission context is passed TO tool pool assembly. Must be loaded before tool-pool.js or passed as parameter. |
| `ai/transcript-store.js` | `ai/agent-loop.js` (modified) | Replaces `session.messages` array. Agent loop reads/writes via transcript store API instead of direct array access. |
| `ai/deferred-init.js` | `background.js` (modified) | Called from `runAgentLoop()` after first iteration starts. Depends on chrome.storage.local and existing FSB globals. |
| `ai/cost-tracker.js` | `ai/agent-loop.js` (modified), `ai/hook-pipeline.js` (new) | Registered as `afterApiResponse` hook. Reads model pricing from `MODEL_PRICING` constant in agent-loop.js. |

## Chrome Extension MV3 Constraints

Every pattern must survive these constraints:

| Constraint | Impact on Adaptation | Mitigation |
|-----------|---------------------|------------|
| Service worker can be killed after 5 minutes of inactivity | Session state must be persistable at any point | Session store with structured serialization; keep-alive timer already exists |
| No ES modules in service worker (`importScripts` only) | All new files must use `var`/IIFE pattern, not `export`/`import` | Follow existing tool-definitions.js pattern: define globals, check for `typeof module !== 'undefined'` for testing |
| `chrome.storage.local` has 10MB quota | Transcript store must compact aggressively | Keep last N tool results intact, compress older ones to one-liners (existing pattern) |
| Message passing between background and content scripts is async | Tool execution results arrive asynchronously | Already handled -- `executeTool` returns a Promise. No change needed. |
| No filesystem access | Session store uses chrome.storage.local, not JSON files | Claude Code's `Path`-based session store maps to `chrome.storage.local.get/set` |
| Single-threaded execution | Hook pipeline must be sequential, not parallel | Hooks run in registration order with `await`. No concurrent hook execution. |

## Implementation Order (Recommended)

1. **Tool Pool** (smallest, additive, no breaking changes)
2. **Permission Context** (pairs with tool pool, enables safe mode)
3. **Transcript Store** (extract compactHistory, enable session replay)
4. **Cost Tracker** (extract inline cost tracking, simple refactor)
5. **Hook Pipeline** (restructure runAgentIteration, largest refactor)
6. **Deferred Init** (optimize startup, depends on hook pipeline for "post-init" event)
7. **Execution Registry** (wrap tool executor, depends on hook pipeline for metrics)

Each step is independently shippable. No step requires all prior steps. Steps 1-4 are safe refactors. Steps 5-7 are structural changes.

## Sources

- `Research/claude-code/src/tool_pool.py` -- Tool pool pattern. 38 lines, frozen dataclass + assembly function. HIGH confidence.
- `Research/claude-code/src/tools.py` -- Tool management. 97 lines, snapshot-based tool loading with permission filtering. HIGH confidence.
- `Research/claude-code/src/execution_registry.py` -- Execution registry. 52 lines, wraps commands and tools with named lookup. HIGH confidence.
- `Research/claude-code/src/command_graph.py` -- Command graph. 35 lines, categorizes commands into builtins/plugins/skills. HIGH confidence (pattern understood, deliberately rejected).
- `Research/claude-code/src/commands.py` -- Command management. 91 lines, 207 command entries. HIGH confidence (pattern understood, deliberately rejected).
- `Research/claude-code/src/context.py` -- Port context. 48 lines, filesystem metadata. HIGH confidence (principle adopted, implementation rejected).
- `Research/claude-code/src/history.py` -- History log. 23 lines, title+detail events. HIGH confidence.
- `Research/claude-code/src/permissions.py` -- Permission context. 21 lines, deny-list gating. HIGH confidence.
- `Research/claude-code/src/session_store.py` -- Session store. 36 lines, JSON serialization. HIGH confidence.
- `Research/claude-code/src/transcript.py` -- Transcript store. 24 lines, append/compact/replay/flush. HIGH confidence.
- `Research/claude-code/src/runtime.py` -- Runtime orchestration. 193 lines, session bootstrap + routing + turn loop. HIGH confidence.
- `Research/claude-code/src/deferred_init.py` -- Deferred init. 32 lines, conditional subsystem loading. HIGH confidence.
- `Research/claude-code/src/query_engine.py` -- Query engine. 194 lines, conversation management + compaction + persistence. HIGH confidence (pattern understood, deliberately rejected).
- `Research/claude-code/src/cost_tracker.py` -- Cost tracker. 14 lines, unit accumulation. HIGH confidence.
- `Research/claude-code/src/costHook.py` -- Cost hook. 9 lines, applies tracker. HIGH confidence.
- `Research/claude-code/src/reference_data/subsystems/coordinator.json` -- 1 module (coordinatorMode.ts). HIGH confidence (deliberately rejected).
- `Research/claude-code/src/reference_data/subsystems/hooks.json` -- 104 modules across notifications, permissions, suggestions. HIGH confidence (simplified to 7 events).
- `Research/claude-code/src/reference_data/subsystems/skills.json` -- 20 modules (batch, debug, loop, stuck, verify, etc.). HIGH confidence (deliberately rejected).
- `Research/claude-code/src/reference_data/subsystems/state.json` -- 6 modules (AppState, store, selectors). HIGH confidence (simplified to structured session objects).
- `Research/claude-code/src/reference_data/archive_surface_snapshot.json` -- 1,902 TypeScript files, 207 commands, 184 tools. HIGH confidence (scope reference).
- FSB `ai/agent-loop.js` -- 1,217 lines, current agent loop implementation. HIGH confidence (primary target for refactoring).
- FSB `ai/tool-definitions.js` -- 42 tool definitions with routing metadata. HIGH confidence (unchanged by adaptation).
- FSB `ai/tool-executor.js` -- Unified tool dispatch with 3 routes (content/cdp/background). HIGH confidence (extended, not replaced).
- FSB `ai/tool-use-adapter.js` -- Provider format adaptation (OpenAI/Anthropic/Gemini). HIGH confidence (unchanged).
- FSB `background.js` -- 10,187 lines, session management and automation orchestration. HIGH confidence (session store changes).

---
*Stack research for: Claude Code Architecture Adaptation (v0.9.24)*
*Researched: 2026-04-02*
