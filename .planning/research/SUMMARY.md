# Project Research Summary

**Project:** FSB v0.9.20 -- Autopilot Agent Architecture Rewrite
**Domain:** Chrome Extension browser automation -- replacing CLI text-parsing autopilot with native tool_use agent loop
**Researched:** 2026-03-31
**Confidence:** HIGH

## Executive Summary

FSB's autopilot currently works by asking the AI to respond in a custom CLI grammar, parsing that text with a 950-line tokenizer/command registry, then executing the extracted actions -- repeating this cycle with a fixed iteration cap (20), stuck detection heuristics, and a 400-line multi-signal completion validator. All four AI providers FSB supports (xAI, OpenAI, Anthropic, Gemini) now offer native tool_use/function calling APIs that make this entire parsing and orchestration layer obsolete. The native pattern is simple: send messages plus tool definitions, the AI returns structured tool_call blocks with JSON parameters, the extension executes them and feeds results back, and the loop repeats until the AI emits an end_turn signal. This eliminates approximately 3,100 lines of custom parsing, stuck detection, completion validation, and prompt template code, replacing them with roughly 200-300 lines of generic agent loop logic plus a provider-specific format adapter.

The recommended approach is to build a canonical tool registry (JSON Schema definitions shared between autopilot and MCP), a provider format adapter (three concrete implementations: OpenAI/xAI shared, Anthropic, Gemini), a unified tool executor (single dispatch function replacing two parallel execution paths), and the agent loop itself (setTimeout-chained iterations, not a single while-loop, due to Chrome MV3 service worker constraints). The existing UniversalProvider class already handles per-provider request formatting and response parsing -- the tool_use extension follows the same pattern with 5 new methods added to the existing abstraction rather than a new layer.

The top risks are: (1) provider format divergence causing silent failures when tool definitions or results are malformed for a specific provider, (2) conversation history token explosion as tool results accumulate across iterations, (3) Chrome MV3 service worker 5-minute execution kill terminating long-running agent sessions, and (4) loss of battle-tested stuck detection logic that took 8+ milestones to build. Each has a concrete mitigation: provider-specific adapters with structural validation tests, tool-result-aware history compression with sliding windows, setTimeout-chaining to break the loop into separate events, and an external stuck monitor that injects recovery hints into tool results rather than controlling iteration.

## Key Findings

### Recommended Stack

The stack decision is straightforward: no new technologies are introduced. The rewrite operates entirely within FSB's existing runtime (Chrome Extension MV3, vanilla JavaScript ES2021+, xAI/OpenAI/Anthropic/Gemini APIs). The key technical decision is which API surface to use for each provider.

**Core technologies (all existing, extended):**
- **xAI chat/completions endpoint** (NOT the newer Responses API): OpenAI-compatible format, meaning xAI and OpenAI share identical tool handling code. The Responses API would require a third translation layer for minimal benefit.
- **Provider format adapter (3 concrete implementations):** OpenAI/xAI share one adapter (arguments are JSON strings, `finish_reason: "tool_calls"`, `role: "tool"` results). Anthropic gets its own (`input_schema`, `stop_reason: "tool_use"`, content blocks, `role: "user"` with `tool_result` blocks, input is already-parsed object). Gemini gets its own (`functionDeclarations`, `functionCall` parts, `functionResponse` results, `args` already parsed, no dedicated finish reason).
- **JSON Schema for tool definitions:** All four providers use JSON Schema for parameter definitions. The wrapper differs per provider but the schema content is identical. This is the canonical format for the shared tool registry.
- **No streaming for v0.9.20 tool_use parsing:** Browser actions are sequential -- the complete tool call (name + all arguments) is needed before execution. However, streaming should be considered as a FETCH KEEPALIVE mechanism to prevent Chrome's 30-second fetch timeout from killing slow API calls.

**Critical version requirements:**
- xAI: grok-3 minimum for tool_use, grok-4-1-fast recommended (2M context)
- OpenAI: gpt-4o-mini minimum, gpt-4o recommended
- Anthropic: claude-haiku-4.5 minimum, claude-sonnet-4 or claude-sonnet-4.5 recommended
- Gemini: gemini-2.0-flash minimum, gemini-2.5-flash recommended

See `.planning/research/STACK.md` for exact request/response format specifications per provider, including code-level translation methods.

### Expected Features

**Must have (table stakes -- T1-T12):**
- T1: Basic agent loop (send -> tool_use -> execute -> tool_result -> repeat)
- T2: Unified tool definitions in JSON Schema shared between autopilot and MCP
- T3: Single execution path -- same `executeTool()` for both autopilot and MCP
- T4: stop_reason-based completion (AI decides when done, replaces 400-line completion validator)
- T5: Structured tool_result responses with high-signal feedback
- T6: DOM snapshot as on-demand tool (not auto-injected every iteration)
- T7: Conversation context management with sliding window and compaction
- T8: Safety timeout (session duration limit, kept from existing code)
- T9: Session abort / stop button (kept from existing code)
- T10: Error handling with `is_error` in tool_results for AI recovery
- T11: Multi-provider tool_use format adaptation (the adapter layer)
- T12: Minimal system prompt (~1-2KB, down from 30-50KB)

**Should have (differentiators):**
- D1: Site guide as queryable tool (on-demand, not always injected) -- massive token savings
- D3: Progress overlay integration (user sees tool execution in real time)
- D4: Prompt caching for system prompt + tools (Anthropic measured 11.5s -> 2.4s for 100K context)
- D7: Action verification enrichment in tool_results (richer AI signal without extra tool calls)
- D8: Cost tracking per session across all conversation turns

**Defer to v2+:**
- D2: Procedural memory as queryable tool
- D5: Parallel tool execution
- D6: Context window budget tracking with proactive compaction
- D9: Streaming tool_use responses for real-time thinking display

**Anti-features (explicitly do NOT build):**
- Built-in AI-controlled stuck detection (keep external, inject as tool_result hints)
- Fixed iteration cap (use time-based + cost-based circuit breakers instead)
- CLI text parsing (the entire point of the migration)
- Per-iteration DOM fetching (DOM becomes an on-demand tool)
- Multi-signal completion validation (stop_reason IS the completion signal)
- Task-type classification for prompt selection (AI has full tool catalog, decides itself)

**Net code impact:** ~3,100 lines removed. ~500-800 lines added.

See `.planning/research/FEATURES.md` for complete dependency graph, MVP phase breakdown, and detailed delete/keep lists.

### Architecture Approach

The architecture follows a "normalize at the boundary, unify at the core" pattern. A canonical tool registry defines all 35+ tools once in JSON Schema with internal routing metadata. Provider-specific adapters translate at the API boundary. A unified tool executor dispatches to the correct handler regardless of caller (autopilot or MCP). The agent loop itself is a simple setTimeout-chained iteration.

**Major components (new or modified):**
1. **tool-definitions.js (NEW)** -- Canonical tool registry. Single source of truth for both autopilot and MCP. JSON Schema parameters with internal routing metadata (`_route`, `_fsbVerb`, `_readOnly`). Replaces CLI COMMAND_REGISTRY and MCP inline Zod schemas.
2. **tool-use-adapter.js (NEW)** -- Provider format normalizer. Three concrete implementations (OpenAI/xAI, Anthropic, Gemini). Handles tool definition formatting, tool call extraction, tool result formatting, and stop_reason detection.
3. **tool-executor.js (NEW)** -- Unified execution engine. Routes to content script (DOM actions), background (CDP), or background (multi-tab/data). Called by both autopilot and MCP. Includes pre-execution health checks and post-execution feedback.
4. **universal-provider.js (MODIFIED)** -- 5 new methods: `formatToolsForProvider()`, `parseToolCalls()`, `formatToolResult()`, `isToolCallResponse()`, `formatAssistantMessage()`. Returns full structured response instead of extracted text.
5. **background.js (MODIFIED)** -- `startAutomationLoop()` (~2,400 lines) replaced by `runAgentLoop()` (~200-300 lines). Session management simplified.
6. **Content scripts (UNCHANGED)** -- All 12 modules remain as-is. The `executeAction` message handler is the convergence point.

**New on-demand tools (registered in tool-definitions.js):**
- `get_page_snapshot`: Returns markdown DOM snapshot (currently auto-fetched every iteration)
- `get_site_guide`: Returns site-specific intelligence (currently always injected into prompt)
- `report_progress`: Lets AI update the progress overlay text
- `complete_task` / `fail_task`: Signals task completion or failure with summary

See `.planning/research/ARCHITECTURE.md` for detailed data flow diagrams, component interaction maps, and build order analysis.

### Critical Pitfalls

1. **Provider format divergence causes silent tool call failures (P1, P5)** -- Four providers use structurally different JSON for tool definitions, responses, and results. The differences are not cosmetic (different key names, different nesting, parsed objects vs JSON strings). Prevention: build provider-specific adapters, validate with structural round-trip tests, use canonical format closest to OpenAI.

2. **Agent loop runaway burns unlimited API budget (P2)** -- Removing the 20-iteration cap without replacement creates infinite-cost risk. Models sometimes refuse to emit end_turn on ambiguous tasks. Prevention: cost-based circuit breaker (default $2), soft iteration backstop (50), no-progress detector (3 consecutive identical DOM hashes), session time limit (10 min).

3. **Token explosion from conversation history (P3)** -- Every iteration adds tool_call + tool_result. DOM snapshots at 50-100KB each. 20 iterations = 1-2MB of history. Costs compound quadratically. Prevention: tool-result-aware compression, on-demand DOM snapshots, token budget with compaction at 80%, cap individual result sizes.

4. **Chrome MV3 service worker 5-minute execution kill (P4)** -- A `while(true)` agent loop runs as one event. Chrome kills it at 5 minutes. Prevention: setTimeout-chaining (same pattern current autopilot uses), persist state after every iteration, implement session resurrection.

5. **Stuck detection logic lost in translation (P8)** -- 60+ stuckCounter references, 8+ milestones of refinement. Models are bad at detecting their own stuck states. Prevention: keep as external system, inject recovery hints into tool_results, port consecutive-no-progress logic.

See `.planning/research/PITFALLS.md` for 14 total pitfalls with phase-specific warning matrix.

## Implications for Roadmap

Based on combined research, the critical path is: provider adapters -> tool registry -> tool executor -> agent loop -> context management -> cleanup. The dependency graph from FEATURES.md confirms: T11 -> T2 -> T3 -> T1 -> T12 -> T5 -> T4 -> T7.

### Phase 1: Provider Format Adapters and Tool Registry

**Rationale:** Every subsequent phase depends on correctly sending and receiving tool_use messages across all 4 providers. PITFALLS.md identifies this as the highest-risk area (P1, P5) that must be validated first.
**Delivers:** `tool-definitions.js` (canonical registry of all 35+ tools), `tool-use-adapter.js` (3 provider implementations), modifications to `universal-provider.js` (5 new methods).
**Addresses:** T2 (unified tool defs), T11 (multi-provider format), T12 (minimal system prompt defined here).
**Avoids:** P1 (format divergence), P5 (Anthropic structural incompatibility), P11 (tool definition token overhead).
**Key validation:** Round-trip test per provider: define tool -> fake model response with tool_call -> parse -> format result -> verify valid message array.

### Phase 2: Unified Tool Executor and MCP Migration

**Rationale:** Before building the agent loop, the execution path must be unified so the loop calls the same code as MCP. De-risks MCP regression (P7) before the loop adds complexity.
**Delivers:** `tool-executor.js` (single dispatch function for content/CDP/multi-tab/data routes), MCP server imports from `tool-definitions.js`.
**Addresses:** T3 (single execution path), T10 (error handling), partial T5 (structured tool_results).
**Avoids:** P7 (MCP breakage -- test MCP path independently).
**Key validation:** Same tool call produces identical results via autopilot path and MCP bridge path.

### Phase 3: Agent Loop Core with Safety Mechanisms

**Rationale:** The centerpiece phase. Depends on Phases 1 and 2. Safety mechanisms built IN this phase -- they are structural, not polish.
**Delivers:** `runAgentLoop()` (setTimeout-chained), cost circuit breaker, external stuck detection, session time limit, progress overlay updates.
**Addresses:** T1 (agent loop), T4 (stop_reason completion), T5 (tool_results finalized), T8 (timeout), T9 (stop button), D8 (cost tracking).
**Avoids:** P2 (runaway), P4 (service worker kill), P8 (stuck detection lost), P6 (progress overlay regression).
**Key validation:** End-to-end task execution with real AI provider. Start, monitor, and stop an autopilot session.

### Phase 4: Context Management and On-Demand Tools

**Rationale:** Prevents token explosion on real-world multi-step tasks. The architectural wins (on-demand DOM, on-demand site guides) that justify the migration.
**Delivers:** Sliding window history with compression, `get_page_snapshot` tool, `get_site_guide` tool, prompt caching.
**Addresses:** T7 (context management), T6 (DOM as tool), D1 (site guide tool), D4 (prompt caching).
**Avoids:** P3 (token explosion), P10 (stale/oversized DOM), P9 (fetch timeout with streaming keepalive).
**Key validation:** 30-step task on content-rich page completes without context window overflow. Token costs reduced 40-60% vs Phase 3.

### Phase 5: Dead Code Removal and Polish

**Rationale:** Remove old code only after the new system is proven stable. Avoids premature deletion requiring reimplementation.
**Delivers:** Removal of ~3,100 lines (cli-parser.js, CLI_COMMAND_TABLE, TASK_PROMPTS, completion validator, DOM hash stuck detection, buildPrompt templates, DOM prefetch, task classifier).
**Addresses:** All anti-features. D3 (progress overlay polish), D7 (verification enrichment).
**Avoids:** P13 (session history format incompatibility), P14 (memory extraction breakage).
**Key validation:** Full regression test. All MCP and autopilot functionality works through new architecture.

### Phase Ordering Rationale

- **Phases 1-2 before Phase 3:** The agent loop cannot be tested without provider adapters (how to communicate) and the executor (how to dispatch). Building these first enables isolated testing with mock responses.
- **Phase 3 includes safety from day one:** PITFALLS.md makes a strong case that cost circuit breakers, stuck detection, and service worker lifecycle management are structural. Bolting them on later risks the exact runaway and crash scenarios identified in research.
- **Phase 4 after Phase 3:** Context management is critical for production but the loop must work end-to-end first. Phase 3 can lean on grok-4-1-fast's 2M context window while Phase 4 implements proper compression.
- **Phase 5 last:** Deletion is lowest-risk and provides the biggest cleanup win, but only after the replacement is proven.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 1 (Provider Adapters):** xAI `finish_reason` value for tool calls needs empirical verification. Gemini `id` field availability on non-Gemini-3+ models needs testing. Anthropic OpenAI-compatible endpoint for tool_use needs verification (could simplify adapter).
- **Phase 3 (Agent Loop):** Stuck detection port requires design decisions: DOM hash granularity, thresholds for tool_use cadence, recovery hint injection format. Cost circuit breaker thresholds need calibration.
- **Phase 4 (Context Management):** History compression aggressiveness needs prototype testing. The "memory pointer" pattern needs API testing to verify models work with indirect references.

Phases with standard patterns (skip research-phase):
- **Phase 2 (Tool Executor):** Straightforward extraction/unification of existing code. Both paths already converge at content script level.
- **Phase 5 (Cleanup):** Pure deletion with regression testing. No design decisions.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All 4 provider APIs verified against official docs. xAI finish_reason for tool_calls is MEDIUM (needs empirical test). |
| Features | HIGH | tool_use agent loop pattern is identical across all major AI agent frameworks. Feature dependency graph is clear. |
| Architecture | HIGH | Derived from FSB codebase analysis (11K+ lines background.js, 5K+ ai-integration.js) plus verified API formats. Shared execution path confirmed by code inspection. |
| Pitfalls | HIGH | Chrome service worker constraints from official docs. Provider divergence from API specs. Integration regressions from codebase inference (MEDIUM for some). |

**Overall confidence:** HIGH

### Gaps to Address

- **xAI finish_reason for tool_calls:** REST schema lists "stop", "length", "end_turn" but not "tool_calls". OpenAI compatibility SHOULD use "tool_calls" but needs a live API call. Fallback: check `tool_calls` array presence, not just finish_reason.
- **Chrome 30-second fetch timeout:** Exact conditions (first byte vs complete response) need verification. If streaming is required as keepalive, it affects Phase 1 adapter design.
- **Gemini function call ID on older models:** `id` field guaranteed for Gemini 3+ only. Need to verify with gemini-2.0-flash and gemini-2.5-flash. Fallback: synthetic IDs.
- **Context compression impact:** How aggressively can old tool_results be summarized before the AI loses context? Needs empirical testing in Phase 4.
- **Anthropic OpenAI-compatible endpoint:** If tool_use works through this endpoint, eliminates need for separate Anthropic adapter. Verify before Phase 1.

## Sources

### Primary (HIGH confidence)
- [xAI Function Calling](https://docs.x.ai/docs/guides/function-calling) -- tool definition format, calling guide
- [xAI REST API Reference](https://docs.x.ai/developers/rest-api-reference/inference/chat) -- exact request/response schema
- [OpenAI Function Calling](https://developers.openai.com/api/docs/guides/function-calling) -- tool definition, response, tool_choice
- [Anthropic Tool Use Overview](https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview) -- architecture and pricing
- [Anthropic Implement Tool Use](https://platform.claude.com/docs/en/agents-and-tools/tool-use/implement-tool-use) -- tool schema, input_schema, tool_choice
- [Anthropic Handle Tool Calls](https://platform.claude.com/docs/en/agents-and-tools/tool-use/handle-tool-calls) -- result formatting
- [Gemini Function Calling](https://ai.google.dev/gemini-api/docs/function-calling) -- functionDeclarations, toolConfig, id mapping
- [Chrome Extension Service Worker Lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle) -- timeout rules
- [Longer Extension Service Worker Lifetimes](https://developer.chrome.com/blog/longer-esw-lifetimes) -- Chrome 114-120 improvements

### Secondary (MEDIUM confidence)
- [Anthropic Context Engineering for AI Agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) -- conversation management
- [Anthropic Advanced Tool Use](https://www.anthropic.com/engineering/advanced-tool-use) -- tool design best practices
- [Temporal Agentic Loop with Tool Calling](https://docs.temporal.io/ai-cookbook/agentic-loop-tool-call-openai-python) -- reference architecture
- [Agent Browser Context Window Optimization](https://medium.com/@richardhightower/agent-browser-ai-first-browser-automation-that-saves-93-of-your-context-window-7a2c52562f8c) -- DOM snapshot strategies
- [Agent Suicide by Context](https://www.stackone.com/blog/agent-suicide-by-context/) -- token explosion patterns
- [Chromium Issue #40733525](https://issues.chromium.org/issues/40733525) -- service worker 5-minute shutdown discussion

### Tertiary (LOW confidence)
- [Function Calling Complete Guide 2026](https://ofox.ai/blog/function-calling-tool-use-complete-guide-2026/) -- cross-provider comparison (community)
- [Anthropic OpenAI SDK Compatibility](https://platform.claude.com/docs/en/api/openai-sdk) -- partial compatibility layer (tool_use unverified)

---
*Research completed: 2026-03-31*
*Ready for roadmap: yes*
