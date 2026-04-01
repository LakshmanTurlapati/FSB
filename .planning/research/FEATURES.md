# Feature Landscape: v0.9.20 Native tool_use Agent Loop

**Domain:** Replacing custom CLI-parsing autopilot iteration loop with native tool_use agent loop
**Researched:** 2026-03-31
**Confidence:** HIGH (Anthropic, OpenAI, xAI, Gemini all document the same pattern)

## How tool_use Agent Loops Work in Production

The pattern is identical across all four providers FSB supports. Understanding this is critical because the new architecture replaces ~2000 lines of custom iteration/parsing/stuck-detection code with ~200 lines of generic loop logic.

### The Universal Pattern

```
1. Send messages[] + tools[] to AI provider
2. AI returns response with stop_reason
3. If stop_reason == "tool_use" (or "tool_calls"):
   a. Extract tool_use blocks (name, id, input)
   b. Execute each tool locally
   c. Append assistant response + tool_result blocks to messages[]
   d. Go to step 1
4. If stop_reason == "end_turn" (or "stop"):
   a. Extract text response -- task is done
   b. Return result to user
```

**Key insight:** The AI decides when to stop. There is no iteration counter, no stuck detection, no completion validator. The AI calls tools until it decides the task is done, then it emits a text response and sets stop_reason to "end_turn".

### Provider-Specific Formats (All OpenAI-Compatible)

| Provider | Tool Definition | Response Signal | Result Format |
|----------|----------------|-----------------|---------------|
| Anthropic | `tools[].input_schema` (JSON Schema) | `stop_reason: "tool_use"` | `tool_result` in user message |
| OpenAI | `tools[].function.parameters` (JSON Schema) | `finish_reason: "tool_calls"` | `tool` role message |
| xAI (Grok) | Same as OpenAI (OpenAI-compatible) | Same as OpenAI | Same as OpenAI |
| Gemini | `functionDeclarations[].parameters` (OpenAPI-like) | `functionCall` parts in response | `functionResponse` parts |

**FSB already has a universal provider class that adapts to any OpenAI-compatible API.** The Anthropic format differs but is well-documented. The key difference is message structure, not loop logic.

## Table Stakes

Features the tool_use agent loop MUST have. Missing any = the autopilot is broken or worse than the current system.

| # | Feature | Why Required | Complexity | Dependency on Existing Code | Notes |
|---|---------|-------------|------------|---------------------------|-------|
| T1 | Basic agent loop (send -> tool_use -> execute -> tool_result -> repeat) | This IS the architecture. Without it, nothing works. | Low | `ai-integration.js` UniversalProvider already handles API calls; needs `tools` parameter added | Standard pattern: check stop_reason, branch on tool_use vs end_turn. ~100 lines of loop code |
| T2 | Unified tool definitions (JSON Schema) shared between autopilot and MCP | Single source of truth for all 25+ tools. Prevents MCP tools from diverging from autopilot tools. | Medium | MCP server already has Zod schemas in `manual.ts` + `read-only.ts`; CLI parser has `COMMAND_REGISTRY` with arg schemas | Convert Zod schemas to JSON Schema (trivial -- `zod-to-json-schema` already in MCP deps), or define in JSON Schema and derive both |
| T3 | Tool execution path: same code for autopilot and MCP | When autopilot calls `click({selector: "e5"})`, it runs the exact same handler as MCP `click`. No duplicate dispatch logic. | Medium | MCP uses `bridge.sendAndWait({type: 'mcp:execute-action', payload: {tool, params}})` -> content script; autopilot uses `sendMessageToTab({action: tool, ...params})` -> content script. Two paths, same destination | Unify into a single `executeTool(tabId, toolName, params)` function called by both |
| T4 | stop_reason-based completion (AI decides when done) | Replaces the 400+ lines of multi-signal completion validator, task-type classifiers, and weighted scoring. The AI returns `end_turn` when it believes the task is complete. | Low | Current `validateCompletion()` with gatherCompletionSignals, computeCompletionScore, 9 task-type validators | DELETE the completion validator entirely. Trust the AI's stop_reason. If stop_reason != tool_use, the task is done |
| T5 | Structured tool_result responses | Each tool execution must return a well-formatted result that the AI can reason about. Success/failure, what changed, what the element contained. | Medium | Content script tools already return `{success, error, ...metadata}`. Need to serialize to the tool_result format expected by each provider | Return concise, high-signal results. Not raw DOM dumps. e.g., `click(e5) -> {success: true, clicked: "Submit", newUrl: "..."}` |
| T6 | DOM snapshot as an on-demand tool (not auto-injected) | Currently DOM is fetched EVERY iteration (~200-500ms + ~2-8K tokens). In tool_use, AI calls `get_dom_snapshot` only when needed. Massive token savings. | Low | `getDOM` message handler in content script already works; markdown snapshot generator exists | Register as tool with description "Call this to see what's on the page. Returns structured elements with refs." AI will call it when uncertain about page state |
| T7 | Conversation context (messages array) management | The messages array grows every turn. Without management, it exceeds context window after ~15-20 tool calls on rich pages. | High | No existing equivalent -- current system rebuilds prompt from scratch each iteration (stateless). New system is stateful (conversation persists). | Implement sliding window: keep system prompt + first user message + last N turns. Summarize/drop old tool_results. Budget ~80% of context for conversation, ~20% for tools |
| T8 | Safety timeout (total session duration) | Even though AI controls iteration count, sessions must not run forever. A hard time limit prevents runaway API costs. | Low | Current `MAX_SESSION_DURATION` (5 min default) and `maxSessionDuration` logic | Keep the existing time-based safety net. If session exceeds time limit, inject a final user message "Time limit reached, please summarize what you accomplished" and let AI respond with end_turn |
| T9 | Session abort / stop button | User must be able to stop automation at any point. In tool_use loop, this means canceling the in-flight API call and not sending the next request. | Low | Current `_stopAbortController` + AbortController pattern + `isSessionTerminating()` | Same mechanism: abort the fetch, set session status to stopped, do not re-enter loop |
| T10 | Error handling in tool execution | When a tool fails (element not found, timeout, restricted page), return `is_error: true` in tool_result so the AI can decide what to do next. | Low | Content script tools already return `{success: false, error: "..."}`. Need to map to `is_error` tool_result format | Critical: give descriptive errors. "Element e5 not found. Page may have changed -- try get_dom_snapshot to refresh." Not just "failed" |
| T11 | Multi-provider tool_use format adaptation | xAI, OpenAI, Anthropic, Gemini each have slightly different tool call/result formats. The loop must normalize across all four. | Medium | `UniversalProvider` in `ai-integration.js` already adapts request format; needs to adapt tool_use response parsing too | Anthropic: `stop_reason: "tool_use"`, content blocks. OpenAI/xAI: `finish_reason: "tool_calls"`, tool_calls array. Gemini: `functionCall` parts. Normalize in provider adapter |
| T12 | Minimal system prompt (~1-2KB) | Current system prompt is 30-50KB with embedded tool docs, site guides, strategy hints, and prompt engineering. tool_use architecture moves tool docs into the `tools[]` definitions and uses on-demand tools for site intelligence. | Medium | Current `buildPrompt()` in `ai-integration.js` is enormous. Need to strip to: task description, current URL, behavioral rules only | System prompt should be: "You are a browser automation agent. Execute the user's task using the provided tools. Call get_dom_snapshot to see the page. Call get_site_guide for site-specific tips." ~500-1000 tokens |

## Differentiators

Features that make FSB's tool_use loop better than a naive implementation. Not required for functionality, but significantly improve quality.

| # | Feature | Value Proposition | Complexity | Dependency on Existing Code | Notes |
|---|---------|-------------------|------------|---------------------------|-------|
| D1 | Site guide as queryable tool | Instead of injecting 50+ site guides into every prompt (tokens), register `get_site_guide(domain)` as a tool. AI calls it when it needs site-specific intelligence. | Low | 50+ site guide files already exist in `guides/`; just need a tool that reads the right file and returns its content | Massive token savings. AI calls it on first visit to a site, caches the knowledge in conversation context. Never injected for sites it already knows |
| D2 | Procedural memory as queryable tool | AI can query "how did I handle this type of task before?" to get learned strategies without them always being in the system prompt | Low | Procedural memory extraction and storage already built (v0.9.8). Currently injected into prompt with per-domain cap of 5 | Register `get_task_memory(taskType, domain)` tool. Returns relevant procedural memories. AI uses them if helpful |
| D3 | Progress overlay integration | Report tool execution status to the visual overlay so users see what the AI is doing. In tool_use loop, extract from tool_result and assistant text blocks. | Medium | Existing progress overlay with phase detection, ETA, task summary. Existing `sendSessionStatus()` and `broadcastDashboardProgress()` | After each tool execution, update overlay: "Clicked Submit button", "Reading page content", "Navigating to amazon.com". Extract from tool name + params |
| D4 | Prompt caching for system prompt + tools | System prompt and tool definitions are identical across turns. Caching them saves ~85% latency on subsequent calls (Anthropic measured 11.5s -> 2.4s for 100K context). | Low | No existing prompt caching. New with tool_use architecture since system prompt is now stable across turns | Anthropic: `cache_control` on system prompt. OpenAI: automatic caching. xAI: follows OpenAI pattern. Gemini: `cached_content`. Only needs to be set once |
| D5 | Parallel tool execution | When AI requests multiple tools in one turn (e.g., "click e5" + "type e7 'hello'"), execute them in parallel or batch sequence instead of one-at-a-time. | Medium | Current `executeBatchActions()` handles sequential batch execution. Need to handle provider-specific parallel tool_use blocks | Anthropic and OpenAI both support multiple tool_use blocks in a single response. Execute them, return all tool_results in one user message |
| D6 | Context window budget tracking | Track cumulative token usage across the conversation. When approaching the limit, trigger compaction (summarize old turns, drop stale tool_results). | High | `analytics.js` tracks per-request tokens. No cumulative tracking across conversation turns | Implement token counting per message. When total > 70% of model's context window, compact: summarize turns 2..N-5 into a single assistant message, keep last 5 turns verbatim |
| D7 | Action verification as tool_result enrichment | After executing a tool, automatically check if it had the expected effect (URL changed, element state changed) and include verification in the tool_result. AI gets richer signal without needing to call another tool. | Medium | Current action verification system with state capture and effect validation (v0.9). `verifyActionOutcome()` exists | After click: check URL change, DOM change, new elements. Append to tool_result: "Clicked 'Submit'. URL changed to /success. New elements: confirmation message visible." |
| D8 | Cost tracking per session | Track API cost across all turns in the tool_use loop. Display in overlay and store in session history. | Low | `analytics.js` already tracks cost per API call. Session has `totalCost`, `totalInputTokens`, `totalOutputTokens` | Same mechanism, just increment across conversation turns instead of single-shot calls. Show in overlay: "$0.03 spent, 15 tool calls" |
| D9 | Streaming tool_use responses | Stream the AI's response to show real-time thinking/reasoning in the overlay before tool execution begins. Reduces perceived latency. | Medium | No existing streaming. Current system waits for complete response. | All four providers support streaming tool_use. Show text blocks in overlay as they arrive, then execute tool_use blocks when complete |

## Anti-Features

Features to explicitly NOT build for the tool_use agent loop. Building these would add complexity, reduce reliability, or fight the architecture.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Built-in stuck detection | The entire point of tool_use is that the AI manages its own iteration. Adding stuck detection re-creates the problem we are solving: the extension second-guessing the AI. If the AI is stuck, it will either call tools to investigate or give up with end_turn. | Trust the AI. If it calls the same tool 5 times, it knows and will adapt. Safety timeout catches true runaways |
| Fixed iteration cap (maxIterations) | Artificial caps force premature termination of complex tasks. A 20-step Sheets data entry task needs 40+ iterations. A simple navigation needs 3. The AI knows better than a fixed number. | Safety timeout (time-based, not iteration-based). Let the AI iterate as many times as needed within the time budget |
| CLI text parsing for AI responses | The current CLI parser (tokenizer + command registry + mapper) exists because the old architecture needed to extract structured commands from free-text AI output. tool_use returns structured JSON natively. CLI parsing is obsolete. | Use the structured tool_use blocks directly. `block.name` is the tool, `block.input` is the params. Zero parsing needed |
| Per-iteration DOM fetching | Current loop fetches DOM every iteration, prefetches next iteration's DOM during AI call, and includes it in every prompt. This is wasteful -- most of the time the DOM has not changed. | DOM is a tool. AI calls `get_dom_snapshot` when it needs to see the page. After navigation, after expecting changes, before complex interactions. Not every turn |
| Multi-signal completion validation | The weighted scoring system (URL signals 0.20, DOM signals 0.20, AI self-report 0.30, action chain 0.15, page stability 0.10) with 9 task-type validators exists because the old architecture could not trust the AI's completion signal. In tool_use, completion IS the stop_reason. | Let `end_turn` / `stop` be the only completion signal. The AI's response text becomes the task result |
| Task-type classification for prompt selection | Current `classifyTask()` routes to different prompt templates (search, form, extraction, navigation, etc.). In tool_use, the AI has the full tool catalog and decides which tools to use based on the task and page state. | Single system prompt for all tasks. Tool descriptions tell the AI when to use each tool. No task-type branching |
| Conversation history duplication in system prompt | Current system injects previous actions, reasoning, and context into every prompt from scratch. In tool_use, the conversation IS the history -- messages array accumulates naturally. | Let the messages array be the history. System prompt is static. No "here's what you did so far" injection |
| Aggressive prompt trimming (3-stage progressive) | Current system has progressive prompt trimming when approaching token limits: drop reasoning, drop history, drop tool docs. In tool_use, context management is a clean sliding window, not emergency trimming. | Proactive context window management: count tokens, compact old turns before hitting limits. Not reactive trimming |
| DOM hash-based change detection | Current system hashes DOM each iteration to detect changes and drive stuck detection. With no per-iteration DOM fetching and no stuck detection, DOM hashing serves no purpose. | Remove entirely. If AI needs to know if page changed, it calls `get_dom_snapshot` again and sees for itself |
| Custom response format enforcement (CLI grammar) | Current system requires AI to respond in a specific CLI grammar with exact command syntax. tool_use responses are structured by the provider -- the AI fills in the tool's JSON Schema input. No format to enforce. | Tool input_schema defines the format. Provider validates it (Anthropic has `strict: true`, OpenAI has `strict: true`). Zero format issues |

## Feature Dependencies

```
T1 (Agent loop) <-- everything depends on this
  |
  +-- T2 (Unified tool defs) <-- T3 (Single execution path)
  |     |
  |     +-- T6 (DOM as tool)
  |     +-- D1 (Site guide tool)
  |     +-- D2 (Memory tool)
  |
  +-- T4 (stop_reason completion) <-- enables removing completion validator
  |
  +-- T5 (Structured tool_result) <-- D7 (Verification enrichment)
  |
  +-- T11 (Multi-provider format) <-- must work before any provider testing
  |
  +-- T7 (Context management) <-- D6 (Budget tracking)
  |
  +-- T12 (Minimal system prompt) <-- D4 (Prompt caching)
  |
  +-- T8 (Safety timeout) -- independent, keep existing
  +-- T9 (Stop button) -- independent, keep existing
  +-- T10 (Error handling) -- independent, straightforward
```

Critical path: T11 -> T2 -> T3 -> T1 -> T12 -> T5 -> T4 -> T7

## MVP Recommendation

### Phase 1: Foundation (must ship together)

Build these as a unit -- they form the minimum viable agent loop:

1. **T11 - Multi-provider tool_use format adaptation** -- without this, the loop cannot send/receive tool calls
2. **T2 - Unified tool definitions** -- single source of truth for all tools, shared by autopilot and MCP
3. **T3 - Single execution path** -- one `executeTool()` function, no duplication
4. **T1 - Basic agent loop** -- the core while loop: send, check stop_reason, execute tools, feed results back
5. **T12 - Minimal system prompt** -- strip the 30KB prompt down to ~1KB
6. **T5 - Structured tool_result** -- format results so the AI can reason about them
7. **T4 - stop_reason completion** -- AI decides when done
8. **T10 - Error handling** -- `is_error` in tool_results
9. **T8 - Safety timeout** -- keep existing time-based safety net
10. **T9 - Stop button** -- keep existing abort mechanism

### Phase 2: Context Management (critical for real-world tasks)

11. **T7 - Conversation context management** -- sliding window, old turn compaction
12. **T6 - DOM snapshot as tool** -- AI calls when needed, not every turn
13. **D1 - Site guide as tool** -- on-demand site intelligence

### Phase 3: Quality (differentiators)

14. **D3 - Progress overlay integration** -- user sees what the AI is doing
15. **D7 - Action verification enrichment** -- richer tool_results
16. **D4 - Prompt caching** -- massive latency reduction
17. **D8 - Cost tracking** -- session-level cost visibility

### Defer

- **D2 - Procedural memory tool** -- nice to have, not critical for loop architecture
- **D5 - Parallel tool execution** -- add after basic loop is proven stable
- **D6 - Context budget tracking** -- add after basic sliding window is working
- **D9 - Streaming** -- add after loop is stable, purely UX improvement

## What Gets Deleted

The tool_use architecture makes these existing systems obsolete. Removing them is a significant simplification:

| Existing System | Lines (est.) | Why Removed | Replacement |
|----------------|--------------|-------------|-------------|
| CLI parser (`ai/cli-parser.js`) | ~950 | tool_use returns structured JSON, no text parsing needed | Direct `block.input` access |
| CLI command registry + tokenizer | ~400 | Tool definitions in JSON Schema replace command table | `tools[]` parameter in API call |
| Multi-signal completion validator | ~400 | stop_reason replaces weighted scoring | `stop_reason == "end_turn"` |
| Task-type classifier | ~100 | AI decides tool selection, no routing needed | Tool descriptions guide selection |
| Per-iteration DOM fetching + prefetch | ~200 | DOM is a tool called on demand | `get_dom_snapshot` tool |
| Progressive prompt trimming | ~150 | Sliding window context management replaces emergency trimming | Token counting + compaction |
| DOM hash + stuck detection | ~300 | AI manages its own iteration, no external monitoring | Safety timeout only |
| buildPrompt() template system | ~500 | Minimal static system prompt replaces per-iteration prompt construction | Static string, ~1KB |
| Task complexity estimator | ~100 | No iteration cap means no need to estimate iterations | Safety timeout only |
| **Total estimated removal** | **~3100** | | |

## What Gets Kept

Existing systems that remain valuable in the new architecture:

| Existing System | Why Kept | How It Fits |
|----------------|----------|-------------|
| Content script tool handlers (25+) | The actual browser actions -- click, type, navigate, scroll, etc. These are the tools the AI calls | Wrapped in unified tool definitions, same execution path |
| CDP tools (7 tools) | Canvas interactions, coordinate-based actions. Still needed for Excalidraw, etc. | Registered as additional tools in the tool catalog |
| Site guide files (50+) | Domain-specific automation intelligence. Now queryable via tool instead of always-injected | Served by `get_site_guide(domain)` tool |
| Progress overlay | Visual feedback for users. Updated from tool execution events instead of iteration counting | `sendSessionStatus()` called after each tool execution |
| Analytics / cost tracking | Token and cost accounting. Works the same, just across conversation turns | Increment per API call as before |
| Session management | Session ID, tab tracking, state persistence. Still needed | Same session structure, fewer fields (no stuckCounter, no iterationCount limits) |
| Service worker keep-alive | Chrome MV3 service worker lifecycle management | Still needed -- long-running agent loops need keep-alive |
| Action verification | Checks if actions had expected effect. Feeds into tool_result enrichment | Called after tool execution, result appended to tool_result |
| Memory extraction | Post-session learning. Still useful for building procedural memory | Called at session end, same as before |
| BF cache recovery + content script re-injection | Pages still transition, content scripts still die | Still needed in tool execution path |

## Sources

- [Anthropic: How to implement tool use](https://platform.claude.com/docs/en/agents-and-tools/tool-use/implement-tool-use) -- HIGH confidence
- [Anthropic: Handle tool calls](https://platform.claude.com/docs/en/agents-and-tools/tool-use/handle-tool-calls) -- HIGH confidence
- [Anthropic: Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) -- HIGH confidence
- [Anthropic: Advanced tool use](https://www.anthropic.com/engineering/advanced-tool-use) -- HIGH confidence
- [OpenAI: Function calling guide](https://developers.openai.com/api/docs/guides/function-calling) -- HIGH confidence
- [xAI: Function calling docs](https://docs.x.ai/docs/guides/function-calling) -- HIGH confidence
- [Google: Gemini function calling](https://ai.google.dev/gemini-api/docs/function-calling) -- HIGH confidence
- [Temporal: Basic agentic loop with tool calling](https://docs.temporal.io/ai-cookbook/agentic-loop-tool-call-openai-python) -- MEDIUM confidence
- [Strands Agents: Context Management](https://strandsagents.com/0.1.x/documentation/docs/user-guide/concepts/agents/context-management/) -- MEDIUM confidence
- [Agent Browser: Context window optimization](https://medium.com/@richardhightower/agent-browser-ai-first-browser-automation-that-saves-93-of-your-context-window-7a2c52562f8c) -- MEDIUM confidence
- [Promptfoo: Prompting best practices for tool use](https://community.openai.com/t/prompting-best-practices-for-tool-use-function-calling/1123036) -- MEDIUM confidence
