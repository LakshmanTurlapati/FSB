# Architecture Research: Claude Code Architecture Adaptation for FSB

**Domain:** AI agent loop architecture adaptation (Claude Code -> Chrome Extension)
**Researched:** 2026-04-02
**Confidence:** HIGH (based on direct source analysis of both codebases)

## Executive Summary

Claude Code's architecture, as captured in Research/claude-code/src/, reveals a layered system with clear separation of concerns: a bootstrap pipeline, a prompt-routing layer, a tool pool with permission gating, a multi-turn query engine with transcript compaction, session persistence, and a command/skill dispatch system. FSB already has strong equivalents for many of these subsystems (agent-loop.js, tool-definitions.js, tool-executor.js, tool-use-adapter.js) built during v0.9.20. The adaptation is NOT a ground-up rewrite -- it is a targeted enhancement of existing FSB modules to adopt specific patterns that Claude Code does better: deferred initialization, transcript compaction with budget awareness, structured session persistence/resumption, permission gating, and command graph segmentation.

The key architectural insight: Claude Code separates "what to do" (commands/skills) from "how to do it" (tools) from "should we do it" (permissions) from "remembering it" (transcript/history/session store). FSB currently mixes these concerns inside background.js and agent-loop.js. The adaptation restructures FSB to respect these boundaries without introducing a build system or breaking Chrome MV3 constraints.

---

## Claude Code Subsystem Inventory (from Research/claude-code/src/)

### Subsystem Map with Module Counts

| Subsystem | Module Count | Key Files | Role |
|-----------|-------------|-----------|------|
| **coordinator** | 1 | coordinatorMode.ts | Orchestrates the conversation loop mode |
| **hooks** | 104 | toolPermission/, notifs/, fileSuggestions | UI hooks, permission handlers, notification system |
| **skills** | 20 | bundled/*.ts, loadSkillsDir, mcpSkillBuilders | High-level task recipes (batch, loop, verify, stuck, remember) |
| **state** | 6 | AppState, AppStateStore, store, selectors | Centralized reactive state management |
| **services** | 130 | SessionMemory/, analytics/, api/, PromptSuggestion/ | Backend services (memory, analytics, API client) |
| **bootstrap** | 1 | state.ts | Startup state initialization |
| **plugins** | 2 | builtinPlugins, bundled/index | Plugin loading and registration |
| **server** | 3 | directConnectSession, directConnectManager | Direct connection mode |
| **tools** (archived) | 184 entries | AgentTool/, BashTool/, FileReadTool/, etc. | Tool implementations |
| **commands** (archived) | 207 entries | add-dir, agents, branch, chrome, config, etc. | User-facing slash commands |

### Core Architecture Layers (from source analysis)

```
+-------------------------------------------------------------------+
|                     ENTRYPOINT (main.py)                          |
|   CLI parser, mode routing, trust gate                            |
+-------------------------------------------------------------------+
         |
         v
+-------------------------------------------------------------------+
|                    BOOTSTRAP PIPELINE                              |
|   prefetch -> setup -> context -> deferred_init -> system_init    |
|   (prefetch.py, setup.py, context.py, deferred_init.py)          |
+-------------------------------------------------------------------+
         |
         v
+-------------------------------------------------------------------+
|                     RUNTIME (runtime.py)                           |
|   PortRuntime.bootstrap_session():                                |
|     1. build context                                              |
|     2. run setup                                                  |
|     3. route prompt -> commands + tools                           |
|     4. build execution registry                                   |
|     5. execute matched commands + tools                           |
|     6. submit to query engine (stream or sync)                    |
|     7. persist session                                            |
+-------------------------------------------------------------------+
         |
         v
+-------------------------------------------------------------------+
|                   QUERY ENGINE (query_engine.py)                   |
|   QueryEnginePort:                                                |
|     - submit_message (sync turn)                                  |
|     - stream_submit_message (streaming events)                    |
|     - compact_messages_if_needed (auto-compaction)                |
|     - persist_session / load session resumption                   |
|     - token budget enforcement (max_budget_tokens)                |
|     - max turn limit                                              |
|     - structured output mode with retry                           |
|                                                                   |
|   Uses: TranscriptStore (compaction), SessionStore (persistence)  |
+-------------------------------------------------------------------+
         |
    +----+----+
    |         |
    v         v
+--------+ +----------+
| TOOLS  | | COMMANDS |
| Pool   | | Graph    |
+--------+ +----------+
    |         |
    v         v
+-------------------------------------------------------------------+
|              EXECUTION REGISTRY (execution_registry.py)            |
|   MirroredCommand.execute(prompt) -> message                      |
|   MirroredTool.execute(payload) -> message                        |
+-------------------------------------------------------------------+
         |
         v
+-------------------------------------------------------------------+
|                   PERMISSION GATING                                |
|   ToolPermissionContext: deny_names, deny_prefixes                |
|   Applied at tool_pool assembly time                              |
+-------------------------------------------------------------------+
```

---

## FSB Current Architecture (v0.9.20+)

```
+-------------------------------------------------------------------+
|                  CHROME MV3 SERVICE WORKER                         |
|   background.js (~10.2K lines)                                    |
|     - Message routing (onMessage, onConnect)                      |
|     - Session management (activeSessions Map)                     |
|     - Keep-alive mechanism                                        |
|     - Agent loop launch/stop                                      |
|     - Dashboard WebSocket bridge                                  |
|     - CDP tool handling                                           |
|     - MCP tool routing                                            |
+-------------------------------------------------------------------+
         |
         v
+-------------------------------------------------------------------+
|                     AGENT LOOP (ai/agent-loop.js)                  |
|   runAgentLoop(sessionId, options):                                |
|     1. Read provider config from chrome.storage                   |
|     2. Build system prompt                                        |
|     3. Initialize session messages + agentState                   |
|     4. Create UniversalProvider                                   |
|     5. Kick off runAgentIteration                                 |
|                                                                   |
|   runAgentIteration(sessionId, options):                           |
|     a. Safety breaker check (cost + time)                         |
|     b. Compact history if over 80% budget                         |
|     c. API call via callProviderWithTools                         |
|     d. Parse tool calls or end_turn                               |
|     e. Execute tools sequentially                                 |
|     f. Format tool results, push to history                       |
|     g. Stuck detection + recovery hint injection                  |
|     h. Persist session                                            |
|     i. setTimeout -> next iteration (MV3 safe)                    |
+-------------------------------------------------------------------+
         |
    +----+----+----+
    |    |    |    |
    v    v    v    v
+------+------+------+------+
| TOOL | TOOL | TOOL | UNI  |
| DEFS | EXEC | ADAPT| PROV |
+------+------+------+------+
  42 tools   3 routes   6 providers
  (content,  (content,  (xai, openai,
   cdp,       cdp,       anthropic,
   bg)        bg)        gemini,
                         openrouter,
                         custom)
```

---

## Subsystem-by-Subsystem Mapping

### 1. Bootstrap Pipeline

**Claude Code:** `prefetch.py` -> `setup.py` -> `context.py` -> `deferred_init.py` -> `system_init.py` -> `bootstrap_graph.py`

Stages: top-level prefetch side effects, warning/environment guards, CLI parser + trust gate, setup + commands/agents parallel load, deferred init after trust, mode routing, query engine submit loop.

**FSB Current:** `background.js` onInstalled handler + importScripts loading. No structured bootstrap. All scripts loaded eagerly via `importScripts()` in the service worker.

**FSB Adaptation:**

| Claude Code Component | FSB Equivalent | Status | Action |
|----------------------|----------------|--------|--------|
| `prefetch.py` (mdm_raw_read, keychain, project_scan) | None | Missing | NEW: `bootstrap/prefetch.js` -- preload chrome.storage settings, validate API key, scan active tab |
| `setup.py` (WorkspaceSetup, SetupReport) | Inline in background.js onInstalled | Partial | MODIFY: Extract into `bootstrap/setup.js` with structured report |
| `context.py` (PortContext) | None -- page context built ad-hoc in agent loop | Missing | NEW: `bootstrap/context.js` -- build session context (tab state, provider config, extension version) |
| `deferred_init.py` (trust-gated) | None -- all init is eager | Missing | NEW: `bootstrap/deferred-init.js` -- delay MCP, site guides, memory until API key validated |
| `system_init.py` | `buildSystemPrompt()` in agent-loop.js | Exists | KEEP: Already well-structured, no change needed |
| `bootstrap_graph.py` | None | Missing | NEW: `bootstrap/graph.js` -- define ordered startup stages for service worker resurrection |

**Build dependency:** prefetch -> setup -> context -> deferred-init. Can be done as one phase.

### 2. Runtime / Session Bootstrap

**Claude Code:** `runtime.py` -- `PortRuntime` class with `bootstrap_session()` that builds context, runs setup, routes prompt, builds execution registry, executes matches, submits to query engine, persists session.

**FSB Current:** `runAgentLoop()` in agent-loop.js does all of this inline. Session init, provider config, tool assembly, and first iteration kickoff are all in one 100-line function.

**FSB Adaptation:**

| Claude Code Pattern | FSB Equivalent | Action |
|--------------------|----------------|--------|
| `PortRuntime.bootstrap_session()` | `runAgentLoop()` | REFACTOR: Extract session bootstrap into `runtime/session-bootstrap.js` |
| `PortRuntime.route_prompt()` | None -- no prompt routing | NEW: `runtime/prompt-router.js` -- classify task type (navigation, data extraction, form fill, canvas) to select tool subset and guide injection |
| `PortRuntime.run_turn_loop()` | `runAgentIteration()` + setTimeout chaining | KEEP: The setTimeout-chaining pattern is mandatory for MV3. Do not adopt blocking loop. |
| `RuntimeSession` dataclass | `session` object in activeSessions Map | REFACTOR: Define `SessionSchema` in `runtime/session-schema.js` with typed fields instead of ad-hoc property addition |

### 3. Query Engine / Conversation Management

**Claude Code:** `query_engine.py` -- `QueryEnginePort` with submit_message, stream_submit_message, compact_messages_if_needed, persist_session, max_turns, max_budget_tokens, structured output with retry.

**FSB Current:** Conversation history managed as `session.messages` array in agent-loop.js. Compaction exists (`compactHistory()`) but is simple. No structured output mode. No budget-based stopping. Session persistence via chrome.storage.local.

**FSB Adaptation:**

| Claude Code Pattern | FSB Equivalent | Action |
|--------------------|----------------|--------|
| `QueryEngineConfig` (max_turns, max_budget_tokens, compact_after_turns) | Hardcoded constants in agent-loop.js | REFACTOR: NEW `engine/engine-config.js` -- configurable limits per session |
| `submit_message()` with turn counting | `runAgentIteration()` counting | KEEP: Already tracked in `session.agentState.iterationCount` |
| `stream_submit_message()` with event yielding | Streaming not used (full response per call) | DEFER: Not needed for browser automation where actions are serial |
| `compact_messages_if_needed()` | `compactHistory()` in agent-loop.js | ENHANCE: Add `compact_after_turns` config, preserve last N configurable instead of hardcoded 5 |
| `max_budget_tokens` stop condition | `checkSafetyBreakers()` has cost limit only | ENHANCE: Add token budget stop condition alongside cost |
| `structured_output` with retry | None | DEFER: Not needed for tool_use responses |
| `replay_user_messages()` | None | NEW: Add to session schema for debugging/replay |

### 4. Tool Pool and Permission Gating

**Claude Code:** `tool_pool.py` -- `ToolPool` assembled with simple_mode, include_mcp flags. `tools.py` -- `get_tools()` with filtering by permission context. `permissions.py` -- `ToolPermissionContext` with deny_names and deny_prefixes.

**FSB Current:** `tool-definitions.js` has all 42 tools in TOOL_REGISTRY. `getPublicTools()` strips internal metadata before sending to AI. No permission gating. No mode-based tool selection.

**FSB Adaptation:**

| Claude Code Pattern | FSB Equivalent | Action |
|--------------------|----------------|--------|
| `assemble_tool_pool(simple_mode, include_mcp, permission_context)` | `getPublicTools()` -- returns all tools | ENHANCE: NEW `engine/tool-pool.js` -- assemble filtered tool set per session based on task type |
| `ToolPermissionContext` (deny_names, deny_prefixes) | None | NEW: `engine/permissions.js` -- safety filter (e.g., deny navigate on banking sites, deny fill_sheet unless Sheets URL) |
| `filter_tools_by_permission_context()` | None | INTEGRATE: Apply permission context in tool-pool assembly |
| `get_tools(simple_mode=True)` reducing to core 3 tools | None | NEW: Simple mode returns only navigate, click, type_text, read_page for constrained tasks |

### 5. Execution Registry

**Claude Code:** `execution_registry.py` -- `ExecutionRegistry` wraps commands and tools with `.execute()` method. Separates "what can be executed" from "how to execute it."

**FSB Current:** `tool-executor.js` -- `executeTool()` dispatches directly. No registry abstraction. Tool definitions and execution are separate files but tightly coupled.

**FSB Adaptation:**

| Claude Code Pattern | FSB Equivalent | Action |
|--------------------|----------------|--------|
| `ExecutionRegistry` with command + tool lookup | `executeTool()` + tool-definitions lookup | KEEP: FSB's current approach is more direct and appropriate for 42 tools. No need for registry abstraction. |
| `MirroredCommand.execute()` / `MirroredTool.execute()` | Direct function dispatch in tool-executor | KEEP: The indirection adds no value for browser tools |

**Rationale:** Claude Code's registry pattern exists because it mirrors 184 tools and 207 commands from a TypeScript archive. FSB has 42 concrete tools with real execution handlers. The registry abstraction would add overhead without benefit.

### 6. Command Graph

**Claude Code:** `command_graph.py` -- `CommandGraph` segments commands into builtins, plugin-like, and skill-like. Enables discovery and routing.

**FSB Current:** No command system. User provides a natural language task, AI decides tools. No slash commands.

**FSB Adaptation:**

| Claude Code Pattern | FSB Equivalent | Action |
|--------------------|----------------|--------|
| `CommandGraph` (builtins, plugin-like, skill-like) | None | NEW: `commands/command-graph.js` -- segment available task types into built-in (navigate, search, fill form) and skill-based (career search, data extraction, Sheets entry) |
| `get_commands()` with plugin/skill filtering | None | NEW: Register task templates as "commands" that pre-configure tool pools and system prompts |
| Slash command parsing | None (user types natural language) | DEFER: Not needed now -- task classification handled by prompt-router |

### 7. Skills System

**Claude Code:** `skills/` -- 20 modules including batch, loop, verify, stuck, remember, debug, simplify, skillify. Bundled skills loaded from directory. MCP skill builders.

**FSB Current:** Site guides serve a similar role (pre-configured knowledge per domain). Stuck detection exists in agent-loop.js. No formal skill system.

**FSB Adaptation:**

| Claude Code Skill | FSB Equivalent | Action |
|-------------------|----------------|--------|
| `batch.ts` | Batch action execution in background.js | KEEP: Already exists |
| `loop.ts` | setTimeout-chained agent loop | KEEP: MV3-compatible version exists |
| `verify.ts` / `verifyContent.ts` | complete_task / fail_task tool interception | ENHANCE: Add verification step before complete_task that checks DOM state |
| `stuck.ts` | `detectStuck()` in agent-loop.js | KEEP: Already robust with 3-consecutive-no-change threshold |
| `remember.ts` | Memory system in lib/memory/ | KEEP: Existing memory extraction, consolidation, retrieval |
| `debug.ts` | Debug intelligence pipeline (v0.9.5) | KEEP: Already has 8-point diagnostics |
| `simplify.ts` | None | DEFER: Not applicable to browser automation |
| `scheduleRemoteAgents.ts` | Agent scheduling in background.js | KEEP: Already exists for MCP agents |

### 8. State Management

**Claude Code:** `state/` -- AppState, AppStateStore, store, selectors, onChangeAppState, teammateViewHelpers. Reactive state with selectors.

**FSB Current:** Session state is a plain JS object in `activeSessions` Map. No reactive state. chrome.storage.local for persistence.

**FSB Adaptation:**

| Claude Code Pattern | FSB Equivalent | Action |
|--------------------|----------------|--------|
| `AppState` / `AppStateStore` | `activeSessions` Map + inline state | REFACTOR: NEW `state/session-state.js` -- typed session state with getter/setter methods instead of bare object mutation |
| `selectors.ts` | None -- state read directly | DEFER: Selectors add no value for 1-3 concurrent sessions |
| `onChangeAppState` | None | NEW: `state/state-events.js` -- emit events on session state changes (replaces scattered sendStatus calls) |
| `store.ts` | chrome.storage.local | KEEP: chrome.storage.local is the right persistence layer for MV3 |

### 9. Hooks and Permissions

**Claude Code:** `hooks/` -- 104 modules. Permission handlers (coordinatorHandler, interactiveHandler, swarmWorkerHandler), notification hooks, file suggestions, tool permission context.

**FSB Current:** No hook system. Permission is implicit (user starts task, all tools available).

**FSB Adaptation:**

| Claude Code Pattern | FSB Equivalent | Action |
|--------------------|----------------|--------|
| `hooks/toolPermission/` | None | NEW: `hooks/tool-permission.js` -- pre-execution permission check per tool |
| Permission handlers | None | NEW: Three modes: `auto` (all tools allowed), `confirm` (destructive tools prompt user), `restricted` (read-only tools only) |
| Notification hooks | sendStatus calls scattered in agent-loop.js | REFACTOR: Consolidate into `hooks/progress-hooks.js` -- single notification pipeline |
| `fileSuggestions`, `unifiedSuggestions` | Site guides + procedural memory | KEEP: Already covers this via site guide injection |

### 10. Transcript and History

**Claude Code:** `transcript.py` -- TranscriptStore with append, compact(keep_last), replay, flush. `history.py` -- HistoryLog with add(title, detail), as_markdown. Both are lightweight data structures.

**FSB Current:** `session.messages` (conversation history array), `session.actionHistory` (tool execution log). Compaction in `compactHistory()`.

**FSB Adaptation:**

| Claude Code Pattern | FSB Equivalent | Action |
|--------------------|----------------|--------|
| `TranscriptStore` with compact(keep_last=N) | `compactHistory()` | ENHANCE: Extract into `state/transcript.js` with configurable keep_last parameter |
| `HistoryLog` (title/detail events) | `session.actionHistory` (tool/params/result) | ENHANCE: Extract into `state/history.js` with structured events and markdown export |
| `replay()` | None | NEW: Add replay capability for debugging (export session as replayable action sequence) |
| `flush()` | Session cleanup in background.js | KEEP: Already handles cleanup |

### 11. Session Store

**Claude Code:** `session_store.py` -- `StoredSession` with session_id, messages, input_tokens, output_tokens. save_session/load_session to JSON files in `.port_sessions/`.

**FSB Current:** Session persisted to chrome.storage.local via `persistSession()` callback. No structured schema.

**FSB Adaptation:**

| Claude Code Pattern | FSB Equivalent | Action |
|--------------------|----------------|--------|
| `StoredSession` dataclass | Ad-hoc session object | REFACTOR: Define `StoredSession` schema in `state/session-store.js` |
| `save_session(session, directory)` | `chrome.storage.local.set()` | ENHANCE: Wrap in structured save function with schema validation |
| `load_session(session_id)` | `chrome.storage.local.get()` | ENHANCE: Add session resumption -- load prior session and continue from last tool result |
| JSON file persistence | chrome.storage.local | KEEP: chrome.storage.local is correct for extensions |

---

## Recommended Project Structure (Post-Adaptation)

```
ai/
  agent-loop.js            # MODIFY: Slim down, delegate to new modules
  ai-integration.js        # KEEP: Legacy provider code (phasing out)
  ai-providers.js          # KEEP: Provider configs
  tool-definitions.js      # KEEP: Canonical 42-tool registry
  tool-executor.js         # KEEP: Unified tool dispatch
  tool-use-adapter.js      # KEEP: Provider format translation
  universal-provider.js    # KEEP: API client

engine/                    # NEW: Extracted from agent-loop.js
  engine-config.js         # Session configuration (max_turns, budget, compact threshold)
  tool-pool.js             # Filtered tool assembly per session/task type
  permissions.js           # Tool permission gating (deny lists, mode-based filtering)
  prompt-router.js         # Task classification -> tool subset + guide injection

state/                     # NEW: Extracted from background.js + agent-loop.js
  session-schema.js        # Typed session object definition
  session-store.js         # Structured save/load with chrome.storage.local
  transcript.js            # Conversation history with compaction
  history.js               # Action history with structured events
  state-events.js          # Event emitter for session state changes

bootstrap/                 # NEW: Structured service worker startup
  prefetch.js              # Preload settings, validate API key
  setup.js                 # Environment detection, capability check
  context.js               # Build session context from tab + storage
  deferred-init.js         # Lazy-load site guides, memory, MCP
  graph.js                 # Bootstrap stage ordering

hooks/                     # NEW: Cross-cutting concerns
  tool-permission.js       # Pre-execution permission check
  progress-hooks.js        # Unified notification pipeline
  safety-hooks.js          # Cost/time/stuck breakers (extracted from agent-loop.js)

commands/                  # NEW: Task type templates
  command-graph.js         # Task type registry and classification
```

### Structure Rationale

- **ai/**: Untouched. These modules are stable from v0.9.20 and work correctly. No refactoring needed.
- **engine/**: Extracts configuration and filtering logic that is currently inline in agent-loop.js. Makes agent-loop.js thinner and each concern independently testable.
- **state/**: Extracts state management that is currently scattered between agent-loop.js (messages, actionHistory) and background.js (activeSessions, persist). Provides typed schemas instead of bare objects.
- **bootstrap/**: Structures the service worker startup sequence that currently happens ad-hoc in background.js. Critical for service worker resurrection (MV3 kills workers after 5 minutes of inactivity).
- **hooks/**: Extracts cross-cutting logic (permissions, progress, safety) from agent-loop.js's main execution path. Each hook is independently callable and testable.
- **commands/**: Future-facing. Enables registering task templates (career search, Sheets data entry) as first-class entities instead of relying entirely on the AI to discover the workflow.

---

## Data Flow: Post-Adaptation

### Session Lifecycle (End-to-End)

```
User types task in sidepanel/popup
    |
    v
[background.js] handleStartAutomation(task, tabId)
    |
    v
[bootstrap/prefetch.js] preloadSettings()     -- read chrome.storage
[bootstrap/setup.js] buildSetup()             -- detect capabilities
[bootstrap/context.js] buildContext(tabId)     -- tab URL, provider config
    |
    v
[engine/prompt-router.js] classifyTask(task)  -- returns task type
    |                                            (navigation/extraction/form/canvas)
    v
[engine/tool-pool.js] assembleTools(taskType, permissionContext)
    |                   -- returns filtered tool subset (e.g., 20/42 tools)
    v
[engine/permissions.js] applyPermissions(tools, siteUrl)
    |                     -- deny destructive tools on sensitive sites
    v
[state/session-schema.js] createSession({...})
    |                       -- typed session with all fields initialized
    v
[ai/agent-loop.js] runAgentLoop(sessionId, options)
    |
    +-- buildSystemPrompt(task, pageUrl)         -- system prompt
    +-- session.tools = filteredTools            -- from tool-pool
    +-- session.messages = [{role: 'system'}]
    +-- session.agentState = {iteration: 0, ...}
    |
    v
[ai/agent-loop.js] runAgentIteration(sessionId, options)
    |
    +-- [hooks/safety-hooks.js] checkBreakers(session)
    |       cost limit / time limit / stuck detection
    |
    +-- [state/transcript.js] compactIfNeeded(session.messages, config)
    |
    +-- [ai/tool-use-adapter.js] formatToolsForProvider(tools, provider)
    +-- [ai/universal-provider.js] sendRequest(requestBody)
    |
    +-- Response: tool_use or end_turn?
    |       |
    |       +-- end_turn: finalize session
    |       |
    |       +-- tool_use: parse tool calls
    |               |
    |               v
    |       [hooks/tool-permission.js] checkPermission(toolName, args)
    |               |
    |               +-- denied: inject denial message, skip tool
    |               +-- allowed: execute
    |                       |
    |                       v
    |               [ai/tool-executor.js] executeTool(name, args, tabId, options)
    |                       |
    |                       +-- content route: chrome.tabs.sendMessage
    |                       +-- cdp route: executeCDPToolDirect
    |                       +-- background route: chrome.tabs API
    |                       |
    |                       v
    |               [hooks/progress-hooks.js] emitProgress(session, toolResult)
    |                       |
    |                       v
    |               [state/history.js] recordAction(tool, params, result)
    |
    +-- [state/session-store.js] persistSession(sessionId, session)
    |
    +-- setTimeout(runAgentIteration, 100)  -- MV3 safe chaining
```

### Service Worker Resurrection Flow

```
Chrome kills service worker (5 min idle)
    |
    v
Event triggers resurrection (alarm, message, tab update)
    |
    v
[background.js] importScripts()  -- reload all modules
    |
    v
[bootstrap/graph.js] bootstrapStages:
    1. [bootstrap/prefetch.js] preloadSettings()
    2. [bootstrap/setup.js] validateEnvironment()
    3. [bootstrap/deferred-init.js] lazyInit(trusted=?)
    |
    v
[state/session-store.js] loadActiveSession()
    |
    +-- No active session: idle
    +-- Active session found:
            |
            v
        [state/transcript.js] restoreTranscript(stored.messages)
            |
            v
        [ai/agent-loop.js] resumeAgentIteration(sessionId)
            -- continues from last persisted state
```

---

## Architectural Patterns to Adopt

### Pattern 1: Deferred Initialization

**What:** Delay expensive module loading until after trust/config is validated.

**When to use:** Service worker startup. Do not load site guides (50+ JSON files), memory system, or MCP server connection until API key is confirmed valid.

**Trade-offs:** Faster cold start, but first task may have a slight delay for lazy-loaded modules. Worth it because most service worker resurrections are for keep-alive, not task execution.

**Example:**
```javascript
// bootstrap/deferred-init.js
const DeferredInit = {
  _initialized: false,
  _siteGuides: null,
  _memoryManager: null,

  async init(trusted) {
    if (this._initialized) return;
    if (!trusted) return; // Do not load expensive modules without valid config

    // Lazy load site guides only when first task starts
    this._siteGuides = await loadSiteGuides();
    this._memoryManager = await initMemoryManager();
    this._initialized = true;
  },

  getSiteGuides() {
    return this._siteGuides; // null until init() called
  }
};
```

### Pattern 2: Transcript Compaction with Budget Awareness

**What:** Automatically compact old tool results when conversation history approaches token budget, keeping most recent N results intact.

**When to use:** Every iteration, before API call.

**Trade-offs:** Loses detail from early interactions, but prevents context window overflow. FSB already has this pattern but with hardcoded thresholds.

**Example:**
```javascript
// state/transcript.js
function compactTranscript(messages, config) {
  const { tokenBudget = 128000, compactThreshold = 0.8, keepRecent = 5 } = config;
  const estimated = estimateTokens(messages);
  if (estimated <= tokenBudget * compactThreshold) {
    return { compacted: false, removedCount: 0 };
  }
  // Compact old tool results, keep last `keepRecent`
  // ... (existing compactHistory logic with configurable keepRecent)
}
```

### Pattern 3: Tool Pool Assembly with Permission Context

**What:** Build a filtered tool set per session based on task type and security context, rather than sending all 42 tools every time.

**When to use:** Session bootstrap, before first API call.

**Trade-offs:** Fewer tools = fewer tokens in system message = more room for page context. But AI cannot discover tools it was not given. Mitigate by always including read_page, get_page_snapshot, complete_task, fail_task.

**Example:**
```javascript
// engine/tool-pool.js
function assembleToolPool(taskType, permissionContext) {
  let tools = [...TOOL_REGISTRY];

  // Task-type filtering
  if (taskType === 'read_only') {
    tools = tools.filter(t => t._readOnly);
  }

  // Permission filtering
  if (permissionContext) {
    tools = tools.filter(t => !permissionContext.blocks(t.name));
  }

  // Always include lifecycle tools
  const required = ['complete_task', 'fail_task', 'report_progress', 'read_page', 'get_page_snapshot'];
  for (const name of required) {
    if (!tools.find(t => t.name === name)) {
      tools.push(TOOL_REGISTRY.find(t => t.name === name));
    }
  }

  return tools;
}
```

### Pattern 4: Session State Schema

**What:** Define a typed schema for session objects instead of ad-hoc property addition.

**When to use:** Session creation, session persistence, session resumption.

**Trade-offs:** More upfront definition, but eliminates `session.someProperty` undefined bugs and makes persistence/resumption reliable.

**Example:**
```javascript
// state/session-schema.js
function createSession({ sessionId, task, tabId, provider, model }) {
  return {
    // Identity
    sessionId,
    task,
    tabId,
    status: 'running',    // running | completed | error | stopped

    // Provider
    providerConfig: { providerKey: provider, model, providerInstance: null },

    // Conversation
    messages: [],
    tools: [],

    // Agent state
    agentState: {
      iterationCount: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCost: 0,
      startTime: Date.now(),
      consecutiveNoChangeCount: 0
    },

    // Safety
    safetyConfig: { costLimit: 2.00, timeLimit: 600000 },

    // History
    actionHistory: [],

    // Results
    completionMessage: null,
    error: null
  };
}
```

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Over-Abstracting the Execution Registry

**What people do:** Create a registry pattern that wraps every tool in an abstract class with execute/validate/cleanup methods, mimicking Claude Code's MirroredCommand/MirroredTool pattern.

**Why it is wrong:** Claude Code's registry pattern exists because it mirrors 184+ archived TypeScript tools that do not actually execute -- they are metadata stubs. FSB has 42 real tools with real execution handlers. Adding a registry layer creates unnecessary indirection.

**Do this instead:** Keep tool-executor.js as the single dispatch point. If you need to add pre/post hooks, use the hooks/ system to wrap executeTool, not a registry class per tool.

### Anti-Pattern 2: Blocking Turn Loop

**What people do:** Port Claude Code's `for turn in range(max_turns)` synchronous loop pattern to FSB.

**Why it is wrong:** Chrome MV3 service workers have a 5-minute execution timer. A blocking loop that runs multiple API calls will be killed mid-execution. FSB's setTimeout-chaining pattern is not a workaround -- it is the correct architecture.

**Do this instead:** Keep the current `setTimeout(() => runAgentIteration(...), 100)` pattern. Each iteration resets Chrome's execution timer. This is the only correct approach for MV3.

### Anti-Pattern 3: Reactive State Store for Session Management

**What people do:** Build a Redux/Zustand-like reactive state store (Claude Code's `state/AppStateStore.ts`) for managing session state.

**Why it is wrong:** FSB manages 1-3 concurrent sessions in a service worker with no persistent UI framework. A reactive state store adds bundle size and complexity for a problem that does not exist.

**Do this instead:** Use simple event emitters (`state/state-events.js`) for notifying UI surfaces of state changes. Use plain objects with schema validation (`state/session-schema.js`) for state management.

### Anti-Pattern 4: Porting the Hooks Directory (104 Modules)

**What people do:** Try to replicate Claude Code's massive hooks system (104 files covering notification hooks, file suggestions, unified suggestions, IDE status indicators).

**Why it is wrong:** 95% of those hooks are React/Ink UI hooks for Claude Code's terminal interface. They have zero relevance to a Chrome extension.

**Do this instead:** Extract only the three relevant patterns: tool permission hooks, progress notification hooks, and safety breaker hooks. That is 3 files, not 104.

---

## Chrome MV3 Constraints That Shape Architecture

| Constraint | Impact on Architecture | Mitigation |
|------------|----------------------|------------|
| Service worker 5-min idle kill | Cannot use long-running processes | setTimeout-chaining for agent loop, chrome.alarms for keep-alive |
| No DOM access in service worker | Cannot run content scripts from background | Message passing via chrome.tabs.sendMessage, chrome.scripting.executeScript for injection |
| No eval() / dynamic code | Cannot dynamically construct tool handlers | Static TOOL_REGISTRY, switch-case dispatch in tool-executor |
| chrome.storage.local 10MB limit | Cannot store unlimited session history | Transcript compaction mandatory, old sessions pruned |
| importScripts() shared global scope | All service worker scripts share one namespace | Prefix internal variables to avoid collisions (existing pattern: _al_, _te_) |
| No ES modules in service workers | Cannot use import/export | Use importScripts() + global namespace (existing window.FSB pattern in content scripts) |

---

## Suggested Build Order

The build order respects dependency chains: later modules depend on earlier ones.

### Phase 1: State Foundation (No Dependencies)

Build `state/` first because every other module needs typed sessions and structured storage.

1. `state/session-schema.js` -- typed session creation
2. `state/session-store.js` -- structured save/load with chrome.storage.local
3. `state/transcript.js` -- conversation compaction (extract from agent-loop.js compactHistory)
4. `state/history.js` -- action history with structured events
5. `state/state-events.js` -- event emitter for session changes

**Depends on:** Nothing. Pure data structures.
**Blocks:** engine/, bootstrap/, hooks/

### Phase 2: Engine Configuration (Depends on State)

Build `engine/` next because bootstrap and hooks need tool pools and permissions.

1. `engine/engine-config.js` -- session configuration (max_turns, budget, compact threshold)
2. `engine/permissions.js` -- tool permission gating
3. `engine/tool-pool.js` -- filtered tool assembly (uses permissions.js + tool-definitions.js)
4. `engine/prompt-router.js` -- task classification (uses tool-pool.js)

**Depends on:** state/session-schema.js (for config integration), ai/tool-definitions.js (for TOOL_REGISTRY)
**Blocks:** bootstrap/, hooks/

### Phase 3: Bootstrap Pipeline (Depends on Engine)

Build `bootstrap/` to structure service worker startup.

1. `bootstrap/prefetch.js` -- preload settings from chrome.storage
2. `bootstrap/setup.js` -- environment detection
3. `bootstrap/context.js` -- session context builder
4. `bootstrap/deferred-init.js` -- lazy module loading
5. `bootstrap/graph.js` -- startup stage ordering

**Depends on:** engine/engine-config.js (for defaults), state/session-store.js (for session resumption)
**Blocks:** Refactored background.js startup

### Phase 4: Hooks (Depends on Engine + State)

Build `hooks/` to extract cross-cutting concerns from agent-loop.js.

1. `hooks/safety-hooks.js` -- extract checkSafetyBreakers + detectStuck
2. `hooks/tool-permission.js` -- pre-execution permission check
3. `hooks/progress-hooks.js` -- unified notification pipeline (extract sendStatus calls)

**Depends on:** engine/permissions.js, state/state-events.js
**Blocks:** Refactored agent-loop.js

### Phase 5: Agent Loop Refactor (Depends on Everything Above)

Slim down agent-loop.js to use the new modules.

1. Replace inline session creation with `state/session-schema.js`
2. Replace hardcoded config with `engine/engine-config.js`
3. Replace `getPublicTools()` with `engine/tool-pool.js`
4. Replace inline compaction with `state/transcript.js`
5. Replace inline safety checks with `hooks/safety-hooks.js`
6. Replace scattered sendStatus with `hooks/progress-hooks.js`
7. Add session resumption via `state/session-store.js`

**Depends on:** All Phase 1-4 modules
**Blocks:** Nothing -- this is the integration phase

### Phase 6: Commands (Optional, Future-Facing)

1. `commands/command-graph.js` -- task type registry

**Depends on:** engine/prompt-router.js
**Blocks:** Nothing -- purely additive

---

## Integration Points with Existing FSB Code

### Files That CHANGE

| File | What Changes | Risk |
|------|-------------|------|
| `background.js` | Startup sequence uses bootstrap/ pipeline. Session creation delegates to state/session-schema.js. Agent loop launch delegates to refactored agent-loop.js. | MEDIUM -- 10K line file, many integration points |
| `ai/agent-loop.js` | Delegates to engine/, state/, hooks/ instead of inline logic. Core loop structure (setTimeout chaining) unchanged. | LOW -- extracting code out, not changing behavior |
| `ai/tool-definitions.js` | Add `_permissionLevel` metadata per tool (e.g., 'safe', 'write', 'destructive') | LOW -- additive, backward compatible |

### Files That DO NOT CHANGE

| File | Why Stable |
|------|-----------|
| `ai/tool-executor.js` | Dispatch routing is already clean. No Claude Code pattern improves it. |
| `ai/tool-use-adapter.js` | Provider format translation is complete for all 6 providers. |
| `ai/universal-provider.js` | API client is stable and well-tested. |
| `content/*.js` (all 12 modules) | Content scripts are not affected by background architecture changes. |
| `ui/*.js` (all UI files) | UI surfaces communicate via message passing, independent of loop architecture. |
| `mcp-server/` | MCP server is already decoupled from the agent loop. |

### New Files (17 total)

| Directory | Count | Files |
|-----------|-------|-------|
| `state/` | 5 | session-schema.js, session-store.js, transcript.js, history.js, state-events.js |
| `engine/` | 4 | engine-config.js, tool-pool.js, permissions.js, prompt-router.js |
| `bootstrap/` | 5 | prefetch.js, setup.js, context.js, deferred-init.js, graph.js |
| `hooks/` | 3 | safety-hooks.js, tool-permission.js, progress-hooks.js |

---

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| Current (1 session) | Single agent loop, 42 tools, no permission gating needed |
| 3-5 concurrent sessions | Tool pool per session (already prepared), independent transcript stores, shared bootstrap |
| Remote dashboard (10+ users) | Session store must handle concurrent writes via chrome.storage.local locking, state-events.js must debounce broadcasts |
| MCP multi-agent | Each agent gets its own session-schema instance, command-graph enables agent specialization |

### First Bottleneck

**chrome.storage.local write contention.** When multiple sessions persist simultaneously, writes may conflict. Mitigate by batching writes per session (persist after N iterations, not every iteration) and using session-specific storage keys.

### Second Bottleneck

**Tool pool assembly cost for N sessions.** Currently trivial (filter 42 tools), but if tool count grows via plugins, the pool assembly should be cached per task-type rather than recomputed per session.

---

## Sources

- Direct source analysis: `Research/claude-code/src/` (all files enumerated in subsystem inventory)
- FSB codebase analysis: `ai/agent-loop.js`, `ai/tool-definitions.js`, `ai/tool-executor.js`, `ai/tool-use-adapter.js`, `background.js`
- Chrome MV3 service worker constraints: Informed by existing FSB patterns (setTimeout chaining, importScripts, chrome.storage)
- Reference data: `Research/claude-code/src/reference_data/subsystems/*.json` for module counts and file inventories

---
*Architecture research for: Claude Code Architecture Adaptation for FSB v0.9.24*
*Researched: 2026-04-02*
