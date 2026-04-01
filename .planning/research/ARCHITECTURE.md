# Architecture Research: v0.9.20 Native tool_use Agent Loop

**Domain:** Chrome Extension browser automation -- replacing CLI text parsing with native tool_use agent loop
**Researched:** 2026-03-31
**Confidence:** HIGH (codebase analysis + verified API documentation for all 4 providers)

## Executive Summary

This document maps the integration of a native tool_use agent loop into FSB's existing Chrome Extension architecture. The core transformation: replace the current "AI returns CLI text -> parser extracts actions -> loop executes and re-calls AI" cycle with "AI returns structured tool_use blocks -> extension executes tools -> tool_result fed back to AI in conversation history." This eliminates the CLI parser, the 30-50KB embedded prompt, the custom iteration loop with fixed caps, and the elaborate stuck detection -- replacing them with the same agentic pattern used by Claude Code, Computer Use API, and MCP clients.

## Current Architecture (What Exists)

### Data Flow: Current Autopilot

```
User task ("search Amazon for wireless mouse")
    |
    v
background.js: startAutomationLoop(sessionId)     <-- REPLACED
    |
    +--[1]--> content.js: getDOM / getMarkdownSnapshot  <-- BECOMES ON-DEMAND TOOL
    |
    +--[2]--> ai-integration.js: buildPrompt()          <-- REPLACED (30-50KB prompt)
    |         - CLI_COMMAND_TABLE (150 lines of CLI docs)
    |         - TASK_PROMPTS (task-specific templates)
    |         - formatSiteKnowledge()
    |         - Session context (history, stuck state, progress)
    |
    +--[3]--> universal-provider.js: callAPI()           <-- MODIFIED (add tools param)
    |         - Builds request per provider format
    |         - Returns raw text string
    |
    +--[4]--> cli-parser.js: parseCliResponse()          <-- REMOVED
    |         - tokenizeLine() state machine
    |         - COMMAND_REGISTRY lookup (60+ verbs)
    |         - Two-stage recovery on parse failure
    |
    +--[5]--> background.js: executeBatchActions()       <-- REPLACED
    |         - Route to content script (DOM actions)
    |         - Route to background (CDP, multi-tab, data)
    |         - Outcome detection, diagnostics, recovery
    |
    +--[6]--> background.js: completion/stuck check      <-- REMOVED (AI decides)
    |         - stuckCounter, changeSignals, DOMHash
    |         - ABSOLUTE_MAX_ITERATIONS cap
    |         - Session timeout
    |
    +--[7]--> GOTO [1] (next iteration)
```

### Data Flow: Current MCP (Manual Mode)

```
Claude Desktop/Code sends tool call via MCP protocol
    |
    v
mcp-server/tools/manual.ts: execAction()
    |
    +---> bridge.sendAndWait({ type: 'mcp:execute-action', payload: { tool, params } })
    |
    v
background.js: case 'mcp:execute-action'
    |
    +---> chrome.tabs.sendMessage(tabId, { action: 'executeAction', tool, params, source: 'mcp-manual' })
    |
    v
content/messaging.js: case 'executeAction'
    |
    +---> FSB.tools[tool](params)    <-- SAME execution code for both paths
    |
    v
Result flows back through the chain
```

### Key Observation: Shared Tool Execution

Both autopilot and MCP already converge at the same point: `chrome.tabs.sendMessage(tabId, { action: 'executeAction', tool, params })`. The content script's `messaging.js` handler and `FSB.tools[tool]` are the execution backbone. Everything above that point diverges: autopilot uses CLI text + parser, MCP uses structured tool schemas + Zod. The new architecture must unify everything above that convergence point.

## Target Architecture (What Gets Built)

### Data Flow: New Agent Loop

```
User task ("search Amazon for wireless mouse")
    |
    v
background.js: runAgentLoop(sessionId)                  <-- NEW (replaces startAutomationLoop)
    |
    +--[1]--> Build initial messages: [system, user]     <-- NEW (minimal ~1-2KB prompt)
    |         system: "You are a browser automation agent..."
    |         user: "Task: search Amazon for wireless mouse\nCurrent URL: about:blank"
    |
    +--[2]--> universal-provider.js: callAPI(messages, tools)  <-- MODIFIED (tools param)
    |         - tools: TOOL_DEFINITIONS (shared with MCP)
    |         - Returns structured response with tool_use blocks
    |
    +--[3]--> tool-use-adapter.js: parseToolCalls(response)   <-- NEW
    |         - Normalizes xAI/OpenAI/Anthropic/Gemini formats
    |         - Returns [{id, name, input}] regardless of provider
    |
    +--[4]--> For each tool_call:
    |         tool-executor.js: executeTool(name, input)       <-- NEW (shared handler)
    |         - Routes to: content script / background / CDP
    |         - Returns tool_result (success text or error)
    |
    +--[5]--> Append to messages:
    |         - assistant message (with tool_use blocks)
    |         - tool_result messages (execution results)
    |
    +--[6]--> IF last response had tool_use: GOTO [2]
    |         IF last response was text-only (done/fail): END
    |         IF safety limit hit: END with warning
    |
    v
Session ends when AI stops calling tools
```

### Component Diagram: New vs Modified vs Unchanged

```
+------------------------------------------------------------------+
|                         BACKGROUND.JS                             |
|                                                                   |
|  +-------------------+    +----------------------+                |
|  | runAgentLoop()    |    | tool-executor.js     |  <-- NEW      |
|  | (NEW - replaces   |--->| executeTool(name,    |                |
|  |  startAutomation  |    |   input, tabId)      |                |
|  |  Loop)            |    | - shared w/ MCP      |                |
|  +-------------------+    +----------+-----------+                |
|           |                          |                            |
|           v                          |  Routes to:                |
|  +-------------------+               |                            |
|  | universal-provider|               +---> content script (DOM)   |
|  | .js (MODIFIED -   |               +---> background (CDP)       |
|  |  add tools param, |               +---> background (multi-tab) |
|  |  return structured|               +---> background (data)      |
|  |  not raw text)    |                                            |
|  +-------------------+                                            |
|           |                                                       |
|           v                                                       |
|  +-------------------+    +----------------------+                |
|  | tool-use-adapter  |    | tool-definitions.js  |  <-- NEW      |
|  | .js (NEW -        |    | (NEW - canonical     |                |
|  |  normalize 4      |    |  source for both     |                |
|  |  provider formats)|    |  autopilot + MCP)    |                |
|  +-------------------+    +----------------------+                |
+------------------------------------------------------------------+

+------------------------------------------------------------------+
|                      CONTENT SCRIPTS (UNCHANGED)                  |
|                                                                   |
|  content/messaging.js  -- case 'executeAction' handler           |
|  content/actions.js    -- FSB.tools[tool](params)                |
|  content/dom-analysis  -- getMarkdownSnapshot, getDOM            |
|  content/selectors.js  -- ref resolution, selector generation    |
|  content/visual-feedback -- glow overlays, progress              |
+------------------------------------------------------------------+

+------------------------------------------------------------------+
|                      MCP SERVER (MODIFIED)                        |
|                                                                   |
|  tools/manual.ts  -- IMPORTS tool-definitions.js schemas         |
|  tools/read-only.ts -- IMPORTS tool-definitions.js schemas       |
|  queue.ts          -- UNCHANGED (mutation serialization)          |
|  bridge.ts         -- UNCHANGED (WebSocket transport)             |
+------------------------------------------------------------------+
```

## Component-by-Component Analysis

### 1. REMOVED: cli-parser.js

**Current role:** Three-layer system (tokenizer -> COMMAND_REGISTRY -> mapper) converting CLI text like `click e5` into `{tool: 'click', params: {selector: '#submit-btn'}}`.

**Why removed:** Native tool_use means the AI returns structured `{name: "click", input: {selector: "e5"}}` directly. No text parsing needed. The COMMAND_REGISTRY's 60+ verb-to-tool mappings become unnecessary because tool definitions enforce the correct parameter names.

**Risk:** Zero. The CLI parser exists solely to bridge text AI output to structured tool calls. Native tool_use eliminates that bridge entirely.

**What migrates:** The COMMAND_REGISTRY's canonical tool names and parameter schemas inform the new `tool-definitions.js`. The verb aliases (click/rclick/rightclick) collapse to single canonical tool names.

### 2. REMOVED: CLI_COMMAND_TABLE + TASK_PROMPTS (in ai-integration.js)

**Current role:** 150-line CLI command reference table embedded in every prompt (~5KB), plus task-specific prompt templates (search, email, form, extraction, shopping, gaming, multitab -- ~8KB each). The system prompt alone can be 30-50KB.

**Why removed:** Tool_use providers inject their own tool documentation from the tool definitions. The AI learns what tools do from the `description` field, not from a CLI reference table. Task-specific instructions become unnecessary because the AI can introspect available tools and their descriptions.

**Risk:** LOW. The task prompts contain valuable domain intelligence (e.g., Gmail compose workflow, Google Sheets Name Box pattern). Some of this intelligence should migrate to tool descriptions or become queryable via a `get_site_guide` tool.

**What migrates:** Critical patterns from TASK_PROMPTS should be embedded in:
- Tool descriptions (e.g., `search` tool description: "Uses site's own search bar when available, falls back to Google")
- Site guide tool responses (on-demand, not always injected)

### 3. REMOVED: startAutomationLoop() (background.js lines 9384-11761+)

**Current role:** ~2400-line function that orchestrates one iteration of the automation loop: health check -> DOM fetch -> stuck detection -> login detection -> AI call -> action execution -> completion check -> next iteration.

**Why removed:** The agent loop pattern replaces this with a simple while loop: call AI -> execute tool_calls -> append results -> repeat until AI returns text-only response (signaling completion).

**What stays from this function:**
- Health check logic (content script liveness) -- moves to tool executor pre-check
- CDP action routing (cdpBackgroundTools dispatch) -- moves to tool-executor.js
- Multi-tab action routing -- moves to tool-executor.js
- Background data tools routing -- moves to tool-executor.js
- Visual feedback (sendSessionStatus) -- integrated into tool executor callbacks
- Login detection hook -- becomes a tool or pre-execution middleware
- Session metrics tracking -- remains in the new loop

**What gets eliminated:**
- ABSOLUTE_MAX_ITERATIONS cap (AI decides when to stop)
- stuckCounter / stuck detection / recovery strategies (AI handles its own recovery)
- DOM hash comparison / change signals (AI requests DOM when needed)
- Complexity estimator / dynamic thresholds (unnecessary with unbounded loop)
- DOM prefetch (AI pulls DOM on demand)
- Two-stage CLI parse failure recovery (no parsing)
- Sequence repetition detection (AI handles its own patterns)

### 4. MODIFIED: universal-provider.js

**Current role:** Builds raw text completion requests for xAI/OpenAI/Anthropic/Gemini. Returns raw text string.

**Required changes:**
- Accept optional `tools` parameter in `buildRequest()`
- Format tools per provider:
  - **xAI (OpenAI-compatible):** `tools: [{type: "function", function: {name, description, parameters}}]`
  - **OpenAI:** Same format as xAI
  - **Anthropic:** `tools: [{name, description, input_schema}]`
  - **Gemini:** `tools: [{functionDeclarations: [{name, description, parameters}]}]`
- Return full structured response (not just text extraction)
- Handle `stop_reason: "tool_use"` / `finish_reason: "tool_calls"` detection

**Scope of change:** The `buildRequest()` and `formatForProvider()` methods need tool formatting. The `send()` method needs to return the full response object instead of extracting text. The response parsing in `processQueue()` (ai-integration.js) gets replaced entirely.

### 5. NEW: tool-definitions.js (Canonical Tool Registry)

**Purpose:** Single source of truth for all tool definitions shared between autopilot and MCP server.

**Structure:**
```javascript
// tool-definitions.js -- loaded by both background.js and imported by mcp-server
const TOOL_DEFINITIONS = [
  {
    name: "click",
    description: "Click an element on the page by element reference or CSS selector...",
    parameters: {
      type: "object",
      properties: {
        selector: { type: "string", description: "Element ref (e.g., 'e5') or CSS selector" }
      },
      required: ["selector"]
    },
    // Internal routing metadata (not sent to AI)
    _route: "content",      // content | background-cdp | background-tab | background-data
    _fsbVerb: "click",      // maps to FSB.tools key
    _readOnly: false         // true = bypass mutation queue
  },
  // ... 35+ tool definitions
];
```

**Key design decisions:**
- Parameters use JSON Schema (provider-agnostic)
- Internal `_route` and `_fsbVerb` fields tell the executor how to dispatch
- `_readOnly` flag replicates MCP queue.ts read-only bypass logic
- Tool descriptions carry the intelligence currently in CLI_COMMAND_TABLE
- DOM snapshot and site guides become tools (not always-injected context)

**New on-demand tools (not in current MCP):**
- `get_page_snapshot`: Returns markdown DOM snapshot (currently auto-fetched every iteration)
- `get_site_guide`: Returns site-specific intelligence (currently always injected)
- `report_progress`: Lets AI update the progress overlay text
- `complete_task`: Signals task completion with summary (replaces `done` CLI verb)
- `fail_task`: Signals task failure with reason (replaces `fail` CLI verb)

### 6. NEW: tool-use-adapter.js (Provider Format Normalizer)

**Purpose:** Normalize the 4 different tool_use response formats into a single internal representation.

**Provider response formats:**

| Provider | Response location | Tool call shape | Result format |
|----------|-------------------|-----------------|---------------|
| xAI (OpenAI-compat) | `choices[0].message.tool_calls` | `{id, type:"function", function:{name, arguments}}` | `{role:"tool", tool_call_id, content}` |
| OpenAI | `choices[0].message.tool_calls` | Same as xAI | Same as xAI |
| Anthropic | `content[]` items with `type:"tool_use"` | `{id, name, input}` | `{type:"tool_result", tool_use_id, content}` |
| Gemini | `candidates[0].content.parts[]` | `{functionCall:{id, name, args}}` | `{functionResponse:{id, name, response}}` |

**Normalized internal format:**
```javascript
// Adapter output (provider-agnostic)
{
  textContent: "I'll click the search button...",  // optional text before tools
  toolCalls: [
    { id: "call_123", name: "click", input: { selector: "e5" } },
    { id: "call_124", name: "type_text", input: { selector: "e12", text: "wireless mouse" } }
  ],
  stopReason: "tool_use" | "end_turn" | "max_tokens"
}

// Result format (fed back to provider via adapter)
// Adapter converts internal result to provider-specific format
{
  toolId: "call_123",
  result: { success: true, text: "Clicked element e5 (Submit button)" }
}
```

### 7. NEW: tool-executor.js (Unified Execution Engine)

**Purpose:** Single execution path for both autopilot and MCP tool calls. Replaces the action routing logic currently split across startAutomationLoop and mcp:execute-action handler.

**Routing logic (extracted from current background.js):**
```
tool-executor.js: executeTool(toolName, params, tabId)
    |
    +-- _route === "content"
    |   +---> chrome.tabs.sendMessage(tabId, { action: 'executeAction', tool, params })
    |         (same path as current autopilot AND mcp:execute-action)
    |
    +-- _route === "background-cdp"
    |   +---> executeCDPToolDirect(action, tabId)
    |         (same CDP routing as current background.js line 10922)
    |
    +-- _route === "background-tab"
    |   +---> handleMultiTabAction(action, tabId)
    |         (same multi-tab routing as current background.js line 10894)
    |
    +-- _route === "background-data"
    |   +---> handleBackgroundAction(action, session)
    |         (same data routing as current background.js line 10908)
    |
    +-- Pre-execution: health check, ref validation
    +-- Post-execution: visual feedback, action recording
    +-- Result formatting: {success, text, error} for tool_result
```

**MCP integration:** The MCP server's `execAction()` (manual.ts) should be refactored to call `tool-executor.js` instead of directly calling `bridge.sendAndWait()`. This unifies the execution path:

```
Current MCP:   manual.ts -> bridge.sendAndWait -> background.js mcp handler -> content
Current Auto:  background.js loop -> chrome.tabs.sendMessage -> content

New (both):    tool-executor.js -> dispatch by route -> content / background
```

### 8. MODIFIED: ai-integration.js

**Current role:** AIIntegration class with buildPrompt, callAPI, processQueue, parseCliResponse integration, prompt caching, request queuing.

**What stays:**
- Request queuing and circuit breaker logic
- Response caching (keyed differently -- by messages hash, not prompt hash)
- Rate limit handling and retry with backoff
- `callAPI()` core (but modified to accept tools and return structured response)

**What is removed:**
- `buildPrompt()` -- replaced by the agent loop's message construction
- `parseCliResponse()` integration -- no CLI parsing
- Two-stage CLI recovery -- no CLI to recover
- `CLI_COMMAND_TABLE` constant -- tool definitions replace it
- `TASK_PROMPTS` constants -- on-demand via tools
- `formatSiteKnowledge()` -- becomes tool response
- `sanitizeActions()` -- moves to tool-executor.js as pre-execution check
- `processQueue()` response processing (CLI-specific) -- replaced with tool_use processing

**Net effect:** AIIntegration becomes a thin wrapper around UniversalProvider that manages queuing, caching, and conversation history. The business logic moves to the agent loop.

### 9. MODIFIED: background.js (Session Management)

**What stays in background.js:**
- Session creation/cleanup (`activeSessions` Map)
- Message routing (chrome.runtime.onMessage)
- MCP WebSocket handler (mcp:execute-action, etc.)
- Visual feedback coordination (sendSessionStatus)
- Login detection hook (can be called from tool-executor)
- Analytics and metrics tracking
- Action recording and logging

**What is removed from background.js:**
- `startAutomationLoop()` (~2400 lines) -- replaced by `runAgentLoop()`
- DOM prefetch logic
- Stuck detection / recovery strategies
- Completion signal detection
- Sequence repetition analysis
- Complexity estimator
- Intermediate page detection

**Net reduction:** Approximately 3000-4000 lines removed from background.js. The new `runAgentLoop()` should be ~200-300 lines.

### 10. UNCHANGED: Content Scripts

All 10 content modules remain unchanged:
- `content/init.js` -- Module initialization
- `content/messaging.js` -- Message handler (executeAction case)
- `content/actions.js` -- FSB.tools registry (25+ tools)
- `content/dom-analysis.js` -- DOM analysis and markdown snapshots
- `content/dom-state.js` -- DOM state management
- `content/selectors.js` -- Selector generation and ref resolution
- `content/visual-feedback.js` -- Glow overlays and progress
- `content/lifecycle.js` -- BF cache handling, login
- `content/utils.js` -- Utility functions
- `content/dom-stream.js` -- Dashboard DOM streaming
- `content/accessibility.js` -- ARIA and accessibility
- `content/stt-recognition.js` -- Speech recognition

The content script's `executeAction` handler is the convergence point. Both old and new architectures send `{action: 'executeAction', tool, params}` to it.

## Provider-Specific Tool_Use Format Mapping

### Tool Definition Translation

**Canonical (tool-definitions.js):**
```javascript
{
  name: "click",
  description: "Click an element...",
  parameters: {
    type: "object",
    properties: {
      selector: { type: "string", description: "Element ref or CSS selector" }
    },
    required: ["selector"]
  }
}
```

**xAI / OpenAI format:**
```javascript
{
  type: "function",
  function: {
    name: "click",
    description: "Click an element...",
    parameters: {
      type: "object",
      properties: {
        selector: { type: "string", description: "Element ref or CSS selector" }
      },
      required: ["selector"]
    }
  }
}
```

**Anthropic format:**
```javascript
{
  name: "click",
  description: "Click an element...",
  input_schema: {
    type: "object",
    properties: {
      selector: { type: "string", description: "Element ref or CSS selector" }
    },
    required: ["selector"]
  }
}
```

**Gemini format:**
```javascript
{
  functionDeclarations: [{
    name: "click",
    description: "Click an element...",
    parameters: {
      type: "object",
      properties: {
        selector: { type: "string", description: "Element ref or CSS selector" }
      },
      required: ["selector"]
    }
  }]
}
```

### Conversation History Translation

The adapter must translate tool results back into provider-specific message format:

**xAI / OpenAI:**
```javascript
messages: [
  { role: "assistant", tool_calls: [{id: "call_1", type: "function", function: {name: "click", arguments: '{"selector":"e5"}'}}] },
  { role: "tool", tool_call_id: "call_1", content: '{"success": true, "text": "Clicked Submit button"}' }
]
```

**Anthropic:**
```javascript
messages: [
  { role: "assistant", content: [{type: "tool_use", id: "toolu_1", name: "click", input: {selector: "e5"}}] },
  { role: "user", content: [{type: "tool_result", tool_use_id: "toolu_1", content: "Clicked Submit button"}] }
]
```

**Gemini:**
```javascript
contents: [
  { role: "model", parts: [{functionCall: {id: "fc_1", name: "click", args: {selector: "e5"}}}] },
  { role: "user", parts: [{functionResponse: {id: "fc_1", name: "click", response: {success: true}}}] }
]
```

## Shared Code Path: Autopilot + MCP Unification

### Current State: Two Parallel Paths

```
AUTOPILOT:                          MCP:
ai-integration.js                   manual.ts (Zod schemas)
  -> buildPrompt()                    -> server.tool() registration
  -> callAPI() (text)                 -> execAction()
  -> cli-parser.js                    -> bridge.sendAndWait()
  -> background.js routing            -> background.js mcp handler
  -> chrome.tabs.sendMessage          -> chrome.tabs.sendMessage
  -> content/messaging.js             -> content/messaging.js
  -> FSB.tools[tool]                  -> FSB.tools[tool]
```

### Target State: Unified Path

```
                tool-definitions.js
                (canonical schemas)
                /                  \
AUTOPILOT:                          MCP:
runAgentLoop()                      manual.ts imports schemas
  -> callAPI(messages, tools)         -> server.tool() uses same schemas
  -> tool-use-adapter.js              -> bridge.sendAndWait()
  -> tool-executor.js                 -> tool-executor.js (via bridge)
  -> dispatch by _route               -> dispatch by _route
  -> FSB.tools[tool]                  -> FSB.tools[tool]
```

The key unification points:
1. **Tool definitions:** Both autopilot and MCP derive from `tool-definitions.js`
2. **Execution engine:** Both route through `tool-executor.js`
3. **Content script:** Both send `{action: 'executeAction', tool, params}` to the same handler

### MCP Schema Migration

Current MCP tool definitions use Zod schemas inline in `manual.ts`. These should be generated from `tool-definitions.js`:

```javascript
// tool-definitions.js (canonical, vanilla JS)
const TOOL_DEFINITIONS = [
  { name: "click", description: "...", parameters: { ... }, _route: "content", _fsbVerb: "click" }
];

// mcp-server/tools/manual.ts (imports and converts)
import { TOOL_DEFINITIONS } from '../../shared/tool-definitions.js';
import { toZodSchema } from './schema-converter.js';

for (const tool of TOOL_DEFINITIONS.filter(t => !t._readOnly)) {
  server.tool(tool.name, tool.description, toZodSchema(tool.parameters), async (params) => {
    return execAction(bridge, queue, tool.name, tool._fsbVerb, params);
  });
}
```

## Build Order (Dependency-Driven)

### Phase 1: Foundation (No Behavioral Change)

1. **tool-definitions.js** -- Write canonical tool registry
   - Depends on: nothing (new file, derived from COMMAND_REGISTRY + MCP Zod schemas)
   - Blocks: everything else
   - Test: unit test that all current tools are covered

2. **tool-use-adapter.js** -- Provider format normalizer
   - Depends on: nothing (pure data transformation)
   - Test: unit test with mock responses from each provider

### Phase 2: Execution Unification (Refactor, No New Loop Yet)

3. **tool-executor.js** -- Unified execution engine
   - Depends on: tool-definitions.js (for routing metadata)
   - Extract routing logic from startAutomationLoop lines 10830-10950
   - Test: can execute tools via the executor, results match current behavior

4. **MCP schema migration** -- Make MCP server import from tool-definitions.js
   - Depends on: tool-definitions.js
   - Write toZodSchema() converter
   - Test: MCP tools still work identically

### Phase 3: Provider Integration

5. **universal-provider.js modifications** -- Add tools parameter support
   - Depends on: tool-definitions.js (for tool format)
   - Add formatToolsForProvider() to format tool defs per provider
   - Return full structured response instead of text extraction
   - Test: API calls with tools parameter succeed for each provider

### Phase 4: Agent Loop

6. **runAgentLoop()** -- New agent loop in background.js
   - Depends on: tool-use-adapter.js, tool-executor.js, modified universal-provider.js
   - Implement while loop: call AI -> parse tool_calls -> execute -> append results -> repeat
   - Wire up session management, visual feedback, safety limits
   - Test: end-to-end task execution with real AI provider

7. **On-demand tools** -- get_page_snapshot, get_site_guide, complete_task, fail_task
   - Depends on: tool-definitions.js, tool-executor.js
   - Move DOM snapshot from auto-fetch to tool call
   - Move site guide injection from prompt to tool response
   - Test: AI successfully calls these tools during agent loop

### Phase 5: Cleanup

8. **Remove dead code** -- cli-parser.js, CLI_COMMAND_TABLE, TASK_PROMPTS, startAutomationLoop
   - Depends on: runAgentLoop fully working
   - Test: regression test suite passes without old code

## Safety Architecture

### Guardrails (replacing current iteration caps)

The current system uses `ABSOLUTE_MAX_ITERATIONS` (default 20) and `MAX_SESSION_DURATION` (5 min). The new system needs equivalent safety without limiting the AI's ability to complete complex tasks:

| Guardrail | Current | New |
|-----------|---------|-----|
| Iteration cap | 20 (hard limit) | Token budget (~100K tokens/session) |
| Time limit | 5 min default | 10 min default, configurable |
| Stuck detection | DOM hash + action patterns | AI decides; optional server-side watchdog |
| Cost limit | None (implicit via iteration cap) | Explicit cost ceiling per session |
| Action safety | sanitizeActions() filter | Same filter in tool-executor.js |
| Irrevocable guard | CMP-03 cooldown registry | Same cooldown in tool-executor.js |

### Session Abort

The current `AbortController` pattern (background.js line 10560) should be preserved. The agent loop checks for abort between tool executions, same as the current check between actions.

## Conversation History Management

### Context Window Pressure

A key concern: as the agent loop runs, conversation history grows with every tool_call/tool_result pair. With 35+ available tools and potentially dozens of iterations, the context can fill rapidly.

**Strategy:**
- Conversation history is the message array
- Each tool_result should be concise (success status + brief description, not full DOM dumps)
- DOM snapshot tool returns the markdown snapshot (~12KB) only when called
- Older tool_result entries can be summarized/trimmed after N iterations
- Use provider's context window awareness: xAI Grok 4.1 Fast has 2M context, so this is less critical than with smaller models

### Message Array Structure

```javascript
const messages = [
  { role: "system", content: SYSTEM_PROMPT },           // ~1-2KB
  { role: "user", content: "Task: ...\nURL: ..." },     // ~100 bytes
  // --- Agent loop iterations ---
  { role: "assistant", content: [...tool_use blocks] },  // AI's tool calls
  { role: "user/tool", content: [...tool_results] },     // Execution results
  { role: "assistant", content: [...tool_use blocks] },  // Next round
  { role: "user/tool", content: [...tool_results] },
  // ... continues until AI returns text-only
  { role: "assistant", content: "Task complete. ..." }   // Final response
];
```

## Sources

- xAI Function Calling: https://docs.x.ai/docs/guides/function-calling
- xAI Tools Overview: https://docs.x.ai/docs/guides/tools/overview
- OpenAI Function Calling: https://platform.openai.com/docs/guides/function-calling
- Anthropic Tool Use: https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview
- Anthropic Implement Tool Use: https://platform.claude.com/docs/en/agents-and-tools/tool-use/implement-tool-use
- Gemini Function Calling: https://ai.google.dev/gemini-api/docs/function-calling
- FSB codebase: background.js, ai-integration.js, cli-parser.js, universal-provider.js, mcp-server/src/tools/manual.ts, content/messaging.js, content/actions.js
