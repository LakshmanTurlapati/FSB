# Domain Pitfalls: v0.9.20 Native tool_use Agent Loop in Chrome Extension

**Domain:** Replacing CLI text-parsing autopilot with multi-provider native tool_use agent loop inside a Chrome Extension MV3 service worker
**Researched:** 2026-03-31
**Confidence:** HIGH for Chrome service worker constraints (official docs), HIGH for provider format divergence (verified against 4 provider APIs), MEDIUM for integration/regression pitfalls (derived from codebase analysis + ecosystem patterns)

---

## Critical Pitfalls

Mistakes that cause silent failures, infinite cost loops, or require architectural rewrites.

---

### Pitfall 1: Provider Format Divergence Causes Silent Tool Call Failures

**What goes wrong:** The four target providers (xAI, OpenAI, Anthropic, Gemini) use fundamentally different JSON structures for tool definitions, tool call responses, and tool result submission. Building a "universal" adapter that treats them as minor variations of the same format will cause silent failures where the model receives tool results it cannot parse, or the extension fails to detect tool calls in responses.

**Why it happens:** The differences are not cosmetic -- they are structural:

| Aspect | OpenAI / xAI | Anthropic | Gemini |
|--------|-------------|-----------|--------|
| **Tool definition key** | `parameters` | `input_schema` | `parameters` (inside `functionDeclarations`) |
| **Tool def wrapper** | `{ type: "function", function: { name, ... } }` | `{ name, description, input_schema }` | `{ functionDeclarations: [{ name, ... }] }` |
| **Tool call location** | `message.tool_calls[]` array | `response.content[]` blocks with `type: "tool_use"` | `candidates[0].content.parts[]` with `functionCall` |
| **Arguments format** | JSON string (must `JSON.parse`) | Pre-parsed object (`block.input`) | Pre-parsed object (`part.functionCall.args`) |
| **Call ID field** | `tool_call.id` | `block.id` | `part.functionCall.id` |
| **Result role** | `role: "tool"` | `role: "user"` | `role: "user"` (in `parts`) |
| **Result wrapper** | `{ role: "tool", tool_call_id, content }` | `{ role: "user", content: [{ type: "tool_result", tool_use_id, content }] }` | `{ role: "user", parts: [{ functionResponse: { name, id, response } }] }` |
| **Stop reason** | Check `message.tool_calls` exists | `stop_reason === "tool_use"` | Check for `functionCall` in parts |
| **Parallel calls** | Multiple entries in `tool_calls[]` | Multiple `tool_use` content blocks | Multiple `functionCall` parts |

**Consequences:**
- Sending `parameters` to Anthropic instead of `input_schema`: model receives malformed tool definition, may refuse to call tools or hallucinate tool formats
- Sending tool results as `role: "tool"` to Anthropic/Gemini: API rejects with 400 error or ignores results
- Failing to `JSON.parse` xAI/OpenAI arguments: entire argument object passed as string, tool execution fails
- Missing `tool_use_id` / `call_id` correlation: model cannot match results to calls, context breaks

**Prevention:**
1. Build provider-specific adapters, NOT a universal format. Each adapter implements:
   - `formatToolDefinitions(tools)` -- converts canonical schema to provider format
   - `extractToolCalls(response)` -- returns normalized `[{ id, name, input }]` regardless of provider
   - `formatToolResults(results)` -- converts `[{ id, result }]` to provider-specific result messages
   - `isToolCallResponse(response)` -- boolean check for whether model wants to call tools
2. Use a canonical internal tool schema (closest to OpenAI since xAI mirrors it). Convert at the provider boundary.
3. Write a validation test that round-trips one tool call through each provider adapter: define tool, fake a model response with tool_call, format result, verify the complete message array is valid for that provider.
4. **Do NOT rely on the existing UniversalProvider's text-only `buildRequest`/`parseResponse`.** The current provider has zero tool_use support. This is greenfield code inside the existing provider abstraction.

**Detection:** Model responds with text instead of tool calls (silently fell back to text mode because tool definitions were malformed). Or API returns 400/422 errors on tool result submission.

**Phase recommendation:** Must be the FIRST phase. Every subsequent phase depends on correct provider adapters.

---

### Pitfall 2: Agent Loop Runaway -- No Iteration Limit Means Infinite API Spend

**What goes wrong:** The v0.9.20 spec says "AI-controlled iteration (no fixed 20-iteration cap, no built-in stuck detection)." Removing the safety net without replacing it with a cost-based or token-based circuit breaker creates an agent that can loop indefinitely, spending unlimited money while accomplishing nothing.

**Why it happens:** The design goal is correct -- fixed iteration caps are artificial and prevent long tasks from completing. But "AI-controlled" termination is unreliable: models sometimes refuse to emit `end_turn` and keep requesting more tool calls, especially when:
- The task is ambiguous ("make this page look good")
- The page keeps changing (infinite scroll, live data, chat interfaces)
- The model enters a stuck loop (click -> page unchanged -> get DOM -> click same element)
- Tool results are large/confusing and the model decides it needs "one more" verification

The existing system has FOUR safety mechanisms that would be lost:
1. `maxIterations` cap (line 6248 in background.js, default 20, complexity-adjusted)
2. `MAX_SESSION_DURATION` time limit (line 9453, default 5 minutes)
3. `stuckCounter` (60+ references) with escalating recovery at 3 and force-stop at 5
4. `consecutiveNoProgressCount` (tracked separately from stuckCounter)

**Consequences:**
- A single stuck session burns through the user's API budget (grok-4-1-fast at $0.70/1M tokens, a 200-iteration loop with DOM snapshots could cost $5-20)
- Service worker memory grows unbounded as conversation history accumulates
- User has no visibility into runaway -- progress overlay would show "analyzing" forever
- If the model loops on expensive tools (DOM snapshot every iteration), token costs compound quadratically as history grows

**Prevention:**
1. Replace fixed iteration cap with a COST-BASED circuit breaker:
   - Track `session.totalInputTokens` and `session.totalOutputTokens` per-session
   - Set a configurable cost ceiling (default $2, exposed in settings)
   - When estimated cost exceeds ceiling, inject a forced system message: "BUDGET LIMIT: Summarize what you accomplished and finish"
   - Hard-stop at 2x the ceiling regardless of model response
2. Keep a soft iteration limit as a backstop (default 50, much higher than current 20 but not infinite)
3. Implement a "no-progress" detector at the agent loop level:
   - If 3 consecutive tool calls produce identical results (same DOM hash, same URL), inject a recovery prompt
   - If 5 consecutive no-progress iterations, force completion
4. Keep the session time limit (escalate from 5 min to 10 min for tool_use mode, since individual iterations are faster but more numerous)

**Detection:** `session.totalCost` exceeding expected range. `session.iterationCount` exceeding 3x the complexity estimate. Same `domHash` appearing in 3+ consecutive tool results.

**Phase recommendation:** Same phase as the core agent loop implementation. The circuit breakers ARE the loop -- not an afterthought.

---

### Pitfall 3: Token Explosion from Conversation History Accumulation

**What goes wrong:** In a tool_use agent loop, every iteration adds to the conversation history: the assistant's tool_call message, the tool result, and the model's next response. With DOM snapshots potentially 50-100KB each (current `readpage --full` can return 30KB of text), 20 iterations accumulates 600KB-2MB of conversation history. This exceeds context windows, causes API rejections, and multiplies costs because every API call re-sends the entire history.

**Why it happens:** The fundamental architecture of tool_use loops requires sending the full conversation history on each API call so the model has context. Unlike the current CLI system which sends only the latest DOM snapshot per iteration, tool_use preserves ALL previous tool results in the message array.

The existing `trimConversationHistory()` in ai-integration.js (line 1083) uses a turn-pair-based sliding window with compaction. But it was designed for the CLI pattern where each turn is ~2-5KB (system prompt + DOM snapshot + CLI response). In tool_use mode:
- Each tool call adds its result to history (DOM snapshots: 10-100KB, readpage: up to 30KB)
- Multiple parallel tool calls per turn multiply this
- The model's reasoning text adds 0.5-2KB per turn
- After 15 iterations: 15 * (tool_call + tool_result + reasoning) = potentially 500KB+ of history

**Consequences:**
- API call latency increases linearly with history size (sending 200KB vs 20KB)
- Token costs compound: iteration N processes all tokens from iterations 1..N-1
- Eventually hits context window limits (grok-4-1-fast: 2M tokens, but cost at that scale is enormous; Gemini 2.5 Flash: 1M; GPT-4o: 128K -- GPT-4o hits limits FAST)
- API rate limits triggered more quickly due to higher token consumption per call
- `chrome.storage.local` quota (10MB default) can be exhausted by persisted session data

**Prevention:**
1. Implement tool-result-aware history compression:
   - After each iteration, replace large tool results in history with summaries: `"[DOM snapshot: 847 elements, 23 interactive, url=amazon.com/dp/...]"`
   - Keep full detail only for the LAST 2 tool results
   - This mirrors the existing compaction pattern but applied to tool_result blocks specifically
2. Make DOM snapshot an ON-DEMAND tool (the v0.9.20 spec already calls for this):
   - Model calls `get_dom_snapshot` only when it needs to see the page
   - Between DOM snapshots, model works from its understanding + action results
   - This naturally reduces history size since not every iteration includes a full snapshot
3. Implement a token budget per session:
   - Track cumulative input tokens across all API calls
   - When approaching 80% of model's context window, trigger aggressive compaction
   - Replace all but last 2 turns with a summary
4. Cap individual tool result sizes in the history:
   - `readpage` results: truncate to 10KB in history (full result available only on the turn it was requested)
   - DOM snapshots: truncate to 5KB summary after 2 turns
   - Action results: cap at 500 bytes
5. Consider a "memory pointer" pattern: store large results in a session-scoped Map, include only a reference in the conversation (`[see stored result #7: DOM snapshot from amazon.com]`), and let the model request the full data if needed via a `recall_result` tool.

**Detection:** API latency increasing per iteration. Token usage reports showing exponential growth. API 400 errors citing context length exceeded.

**Phase recommendation:** Must be designed alongside the core agent loop (same phase). Retrofitting compression after the loop is built leads to message format inconsistencies.

---

### Pitfall 4: Service Worker 5-Minute Hard Kill During Long Agent Sessions

**What goes wrong:** Chrome MV3 service workers have a hard 5-minute limit on any single event handler execution. The agent loop is effectively one long-running async function. Even with the existing keepAlive interval (line 1692, 20-second `chrome.runtime.getPlatformInfo` pings), Chrome enforces a 5-minute maximum on the event that STARTED the loop. The keepAlive resets the 30-second IDLE timer but does NOT extend the 5-minute EXECUTION timer.

**Why it happens:** The current autopilot works because `startAutomationLoop` (line 9384) runs ONE iteration and then schedules the next iteration via `setTimeout(() => startAutomationLoop(sessionId), delay)` (line 11759). Each `setTimeout` callback is a NEW event, resetting the 5-minute clock. The key design pattern: the current loop is NOT a single long-running function -- it is a chain of independent timer callbacks.

A naive tool_use agent loop implementation would be:
```javascript
async function agentLoop(sessionId) {
  while (true) {
    const response = await callAI(messages);  // 2-10 seconds
    if (response.stop_reason === 'end_turn') break;
    const results = await executeTools(response);  // 1-30 seconds per tool
    messages.push(...formatResults(results));
  }
}
```
This single `while(true)` runs as ONE event. After 5 minutes of total execution (not wall-clock -- actual JavaScript execution time), Chrome kills the service worker. All in-memory state (activeSessions Map, conversation history, pending promises) is destroyed.

**Consequences:**
- Session state lost mid-automation (no graceful recovery)
- User sees "Extension context invalidated" errors
- Any pending `fetch()` to AI providers is aborted
- The content script's port to the service worker dies, requiring re-establishment
- Memory system loses in-progress extraction

**Prevention:**
1. **Preserve the current setTimeout-chaining pattern.** Each iteration of the agent loop must be a separate event:
   ```javascript
   async function runAgentIteration(sessionId) {
     const session = activeSessions.get(sessionId);
     const response = await callAI(session.messages);

     if (isToolCallResponse(response)) {
       const results = await executeTools(response);
       session.messages.push(...formatResults(results));
       // Schedule NEXT iteration as a new event -- resets 5-min clock
       setTimeout(() => runAgentIteration(sessionId), 100);
     } else {
       // Task complete
       completeSession(sessionId, response);
     }
   }
   ```
2. **Each tool execution should also be breakable.** If a tool call involves waiting (e.g., `waitForElement` with 10s timeout), break it into check -> schedule -> check cycles.
3. **Persist session state aggressively.** Call `persistSession()` after EVERY iteration, not just at boundaries. If the service worker dies, the session can resume from the last persisted state.
4. **Implement session resurrection.** On service worker startup (`chrome.runtime.onInstalled`/`onStartup`), check `chrome.storage.local` for sessions with status='running'. Offer to resume.
5. **Maintain the existing keepAlive pattern** (line 1686-1697) for idle timer resets, but understand it does NOT protect against the 5-minute execution limit.

**Detection:** Service worker restarts (check `chrome.runtime.onStartup` firing during what should be a continuous session). `activeSessions.size === 0` after restart when UI still shows a running session.

**Phase recommendation:** Core architectural constraint. Must inform the loop design in the FIRST implementation phase. Retrofitting setTimeout-chaining into a while-loop is a rewrite.

---

### Pitfall 5: Anthropic Messages API Requires Completely Different Request Structure

**What goes wrong:** The existing `UniversalProvider` assumes all providers use the OpenAI-compatible `/chat/completions` endpoint format. Anthropic's Messages API (`/v1/messages`) is NOT OpenAI-compatible for tool_use. It uses `system` as a top-level parameter (not a message), `input_schema` instead of `parameters`, `tool_use`/`tool_result` content blocks instead of `tool_calls`/`role: "tool"`, and returns structured `content` arrays instead of `message.content` strings.

**Why it happens:** The current `UniversalProvider` already has `customFormat: true` flagged for Anthropic (line 23 of universal-provider.js), meaning it knows Anthropic is different. But the current implementation only handles text completion differences. Tool_use adds an entirely new dimension of incompatibility:

1. **System prompt location:** OpenAI/xAI put it as `messages[0]` with `role: "system"`. Anthropic requires it as a separate `system` field at the top level of the request body.
2. **Tool definitions location:** OpenAI/xAI use `tools` array at request level. Anthropic uses `tools` but with different schema (`input_schema`). Gemini uses `tools: [{ functionDeclarations: [...] }]`.
3. **Response parsing:** OpenAI returns `choices[0].message.tool_calls`. Anthropic returns `content` array with mixed `text` and `tool_use` blocks. Gemini returns `candidates[0].content.parts` with `functionCall` objects.
4. **Result submission:** Three completely different formats (see Pitfall 1 table).

**Consequences:**
- Anthropic API returns 400 errors if tool definitions use `parameters` instead of `input_schema`
- Tool results sent as `role: "tool"` are rejected by Anthropic (expects `role: "user"` with `tool_result` content blocks)
- Gemini API rejects requests without `functionDeclarations` wrapper
- Silent degradation: model receives malformed tools, responds with text instead of tool calls, extension falls back to CLI-like text parsing and defeats the purpose of the migration

**Prevention:**
1. Create a `ProviderToolAdapter` interface with concrete implementations per provider:
   - `OpenAIToolAdapter` (works for xAI too since xAI mirrors OpenAI format)
   - `AnthropicToolAdapter` (handles Messages API specifics)
   - `GeminiToolAdapter` (handles generateContent specifics)
2. Each adapter owns the COMPLETE request construction for tool_use calls, not just parameter mapping. The request body shape is fundamentally different per provider.
3. Add integration tests that verify each adapter produces valid API payloads by checking against known-good request structures (not by calling the API -- by structural assertion).
4. Consider the Anthropic OpenAI-compatible endpoint (`platform.claude.com/docs/en/api/openai-sdk`) as a shortcut -- Anthropic now offers partial OpenAI SDK compatibility, which may simplify the adapter. However, verify tool_use is fully supported through this compatibility layer before relying on it.

**Detection:** API 400/422 errors specifically from Anthropic or Gemini when tools are enabled. Model responding with text when tools are defined (indicates malformed tool definitions).

**Phase recommendation:** Same phase as Pitfall 1. Provider adapters for tool definitions and tool results are the same unit of work.

---

## Moderate Pitfalls

Mistakes that cause regression in existing features, degraded UX, or require significant debugging.

---

### Pitfall 6: Regression in Progress Overlay and Session Status Tracking

**What goes wrong:** The current progress overlay system (51+ references to `sendSessionStatus`/`broadcastDashboardProgress`/`extractAndStoreMemories` in background.js) is deeply coupled to the CLI-based iteration model. It tracks: iteration count vs maxIterations for progress percentage, task phase detection from action patterns, stuck counter display, action summaries, and multi-site progress. Switching to tool_use without updating this system causes the overlay to show stale data, incorrect percentages, or break entirely.

**Why it happens:** The progress system assumes:
- `session.iterationCount` increments once per AI call (true in CLI mode, true in tool_use mode, but semantics change)
- `session.maxIterations` is a fixed cap (in tool_use mode, there is no fixed cap)
- Actions are parsed from CLI text and appear in `session.actionHistory` (in tool_use mode, actions come from tool_call blocks)
- `calculateProgress(session)` uses iteration/maxIteration ratio

In tool_use mode:
- Iterations are faster but more numerous (no CLI parsing overhead, but each tool call is a separate round-trip)
- There is no maxIterations denominator for progress calculation
- Actions come from `tool_use` blocks, not CLI text
- The phase detection logic (`detectTaskPhase`) parses `actionHistory` entries that have `tool` and `params` fields -- these must still be populated correctly

**Prevention:**
1. Maintain the `session.actionHistory` format even in tool_use mode. When extracting tool calls from the AI response, normalize them to the same `{ tool, params, result, timestamp }` shape that the CLI path produces.
2. Replace iteration-ratio progress with a cost-based or action-count-based progress model:
   - Track `estimatedTotalActions` from the complexity estimator
   - Progress = `actualActions / estimatedTotalActions`
   - Cap at 95% until task actually completes
3. Ensure `sendSessionStatus` is called at the same lifecycle points:
   - Before AI call: `phase: 'analyzing'`
   - After tool execution: `phase: 'executing'`, with `statusText` describing the action
   - On completion: `phase: 'complete'`
4. Keep `broadcastDashboardProgress` calls for the remote dashboard/DOM streaming system (v0.9.6/v0.9.9.1 feature)
5. The `calculateProgress` function (line 1068 of background.js) needs a tool_use mode path that does not rely on `maxIterations`.

**Detection:** Progress overlay showing 0% or 100% throughout task. Dashboard not updating. `calculateProgress` returning NaN because `maxIterations` is undefined or infinity.

**Phase recommendation:** Should be addressed in the phase that implements the agent loop iteration, NOT deferred to a polish phase. The overlay is the user's only visibility into what the agent is doing.

---

### Pitfall 7: Breaking MCP Server While Unifying Execution Paths

**What goes wrong:** The v0.9.20 goal is "single execution path -- autopilot tool handlers are the same code as MCP tool handlers." The MCP server (mcp-server/src/tools/manual.ts) currently uses `execAction()` which sends `mcp:execute-action` messages through the WebSocket bridge. The autopilot (background.js) executes tools directly via content script messaging. Unifying these by making autopilot use the MCP code path would route internal tool execution through WebSocket (unnecessary overhead). Unifying by making MCP use the autopilot code path would break the WebSocket bridge protocol.

**Why it happens:** The two execution paths serve different consumers:
- **MCP path:** External AI client (Claude Code, Cursor) -> MCP server -> WebSocket -> background.js -> content script. The MCP server handles tool definition (Zod schemas), input validation, error mapping, and timeout.
- **Autopilot path:** background.js -> content script directly. No WebSocket. No Zod validation. No MCP error mapping.

"Unification" does not mean "same code path end-to-end." It means "same tool definitions, same execution logic, same result format" at the TOOL HANDLER level. The routing above that (WebSocket vs direct) stays different.

**Prevention:**
1. Define a canonical tool registry as a shared data structure:
   ```javascript
   const TOOL_REGISTRY = {
     click: {
       schema: { selector: { type: 'string', required: true } },
       description: 'Click an element...',
       handler: async (params, context) => { /* shared execution logic */ }
     }
   };
   ```
2. The MCP server imports this registry and wraps each handler with WebSocket transport + Zod validation.
3. The autopilot agent loop imports this registry and calls handlers directly with the session's tab context.
4. Tool definitions for AI providers are generated FROM the registry (converting `schema` to OpenAI/Anthropic/Gemini format).
5. Do NOT touch the MCP WebSocket bridge, TaskQueue, or error mapping. Those stay as the MCP transport layer.
6. Test: Run the same task via MCP manual mode AND autopilot, verify identical action results. Regression test the existing MCP edge case suite (50 prompts from v0.9.7).

**Detection:** MCP manual tools returning errors after the unification. WebSocket bridge disconnecting. Existing MCP tests failing.

**Phase recommendation:** The tool registry should be built BEFORE the agent loop consumes it. Phase order: (1) tool registry extraction, (2) MCP server migration to use registry, (3) agent loop implementation consuming the same registry.

---

### Pitfall 8: Stuck Detection and Recovery Logic Lost in Translation

**What goes wrong:** The current autopilot has 60+ references to `stuckCounter` and `consecutiveNoProgressCount` in background.js. These drive a sophisticated escalation system: DOM hash comparison, action pattern analysis, recovery prompts with navigation suggestions, bidirectional stuck recovery, and force-stop. The v0.9.20 spec says "no built-in stuck detection" because the AI should handle this via tools. But models are unreliable at detecting their own stuck states -- they confidently retry failing actions.

**Why it happens:** The assumption is that with native tool_use, the model will observe that its actions are not changing the page and adapt. In practice:
- Models do not track DOM hashes or action patterns -- they work from conversational context
- If the model clicks an element and the page does not change, it sees the same DOM on the next `get_dom_snapshot` call and tries a slightly different approach -- which often fails the same way
- The model's "memory" of what it tried is limited by context window and compaction
- Without external stuck detection, the model can repeat 10-20 variations of the same failing approach before coincidentally trying something different

The existing stuck recovery system (built over v0.9 through v0.9.8, refined across 8+ milestones) represents hundreds of hours of debugging real-world automation failures. Discarding it is high-risk.

**Prevention:**
1. Keep stuck detection as an EXTERNAL system, not model-controlled:
   - Continue tracking `domHash` after each tool execution
   - Continue tracking action signatures for repetition detection
   - When stuck is detected (3 consecutive same-hash iterations), inject a tool_result with stuck context: `"WARNING: Page has not changed in 3 iterations. Previous actions: [click e5, click e5, click e7]. Consider: scrolling to reveal new elements, navigating to a different section, or using a different interaction method."`
2. This integrates naturally with tool_use: the stuck detector runs BETWEEN tool execution and the next AI call, injecting its findings as an additional tool_result or system message.
3. Port the `consecutiveNoProgressCount` logic to work with tool results instead of CLI outputs. The same signals apply (DOM hash unchanged, URL unchanged, same action repeated).
4. Keep the `stuckCounter` escalation thresholds (3 = recovery prompt, 5 = force consideration) but adapt them for tool_use cadence (iterations are faster, so thresholds may need adjustment -- possibly 5 = recovery, 8 = force).

**Detection:** Session running 20+ iterations with no URL change and no DOM change. Same tool being called with identical parameters in consecutive iterations.

**Phase recommendation:** Must be implemented in the SAME phase as the agent loop. Stuck detection is not a feature -- it is a safety mechanism.

---

### Pitfall 9: fetch() 30-Second Timeout Kills AI API Calls

**What goes wrong:** Chrome service workers have a 30-second timeout on `fetch()` responses specifically. The existing universal-provider.js uses `fetch()` for all AI API calls with adaptive timeouts up to 60-90 seconds (line 81-87). If a `fetch()` call to a slow AI provider takes more than 30 seconds to start receiving response data, Chrome can kill the service worker, terminating the fetch and losing the response.

**Why it happens:** This is separate from the 5-minute execution limit and the 30-second idle timeout. Chrome specifically monitors `fetch()` calls in service workers and will terminate the worker if a fetch response has not started arriving within 30 seconds. The existing `DEFAULT_REQUEST_TIMEOUT` of 30s and `MAX_REQUEST_TIMEOUT` of 60s in universal-provider.js are APPLICATION-level timeouts (via `AbortController`), but the CHROME-level timeout is independent and cannot be configured.

In practice, most AI API calls respond within 5-15 seconds. But edge cases exist:
- First request to a cold model (Anthropic Opus: 10-30s cold start)
- Large context windows (200K tokens in history: 20-40s processing)
- Provider rate limiting with queuing (response delayed 30-60s)
- Reasoning models (grok-4-1 non-fast: 15-45s thinking time)

**Consequences:**
- Service worker killed mid-fetch
- No response received, but tokens were consumed (provider charged for generation)
- Session state lost if not persisted
- Application-level retry logic never fires because the worker is dead

**Prevention:**
1. Use **streaming responses** for all AI API calls. Streaming sends data chunks incrementally, and each chunk resets the Chrome fetch timeout. All four providers support streaming (`stream: true` for OpenAI/xAI, `stream: true` for Anthropic, `streamGenerateContent` endpoint for Gemini).
2. With streaming, the first chunk typically arrives within 1-5 seconds even for slow models, resetting the 30-second timer continuously.
3. Implement streaming-to-complete response collection:
   ```javascript
   async function callAIStreaming(body) {
     const response = await fetch(url, { method: 'POST', body, headers });
     const reader = response.body.getReader();
     let chunks = [];
     while (true) {
       const { done, value } = await reader.read();
       if (done) break;
       chunks.push(value);
     }
     return assembleResponse(chunks);
   }
   ```
4. For tool_use specifically, streaming complicates parsing because tool_call blocks arrive in pieces. Accumulate the full response before parsing tool calls.
5. **Fallback:** If streaming is not viable for all providers, set the application-level timeout to 25 seconds (under Chrome's 30s limit) and implement retry with the `attempt` parameter for progressive timeout increase (already present in `calculateAdaptiveTimeout`).

**Detection:** `fetch()` calls silently failing (no error callback fires -- the worker just dies). Service worker restart logs in `chrome://serviceworker-internals`.

**Phase recommendation:** Should be addressed in the provider adapter phase, since switching to streaming affects the request construction and response parsing for each provider.

---

### Pitfall 10: DOM Snapshot Tool Returns Stale or Oversized Data

**What goes wrong:** Making DOM snapshot an on-demand tool (called by the AI when needed, not every iteration) creates two problems: (a) the model does not know the page state has changed between its last snapshot and a subsequent action, leading to stale element references, and (b) when the model DOES request a snapshot, the full snapshot can be 50-100KB, consuming massive context window space.

**Why it happens:** In the current CLI system, a fresh DOM snapshot is included in EVERY iteration's prompt. The AI always has a current view of the page. In tool_use mode, the model calls `get_dom_snapshot` and then performs several actions without re-snapshotting. But those actions (clicking, navigating, scrolling) change the DOM, invalidating the element references from the previous snapshot.

Example failure: Model gets snapshot with `e5 = Submit button`. Model calls `click e5`. The click triggers a page navigation. Model then calls `type e12 "hello"` -- but e12 no longer exists because the page changed.

**Prevention:**
1. After any action that might change the page state (click, navigate, submit, scroll), return a LIGHTWEIGHT page summary in the tool result: `{ success: true, urlChanged: true, newUrl: "...", pageTitle: "...", hint: "Page changed -- call get_dom_snapshot to see new elements" }`
2. Do NOT automatically include a full DOM snapshot in every action result (defeats the purpose of on-demand snapshots). Instead include: URL, page title, and whether DOM changed (from the existing DOM hash comparison).
3. Implement a `get_dom_snapshot` tool with size options:
   - `get_dom_snapshot --viewport` (default): only viewport-visible elements, ~5-10KB
   - `get_dom_snapshot --full`: all interactive elements, ~20-50KB
   - `get_dom_snapshot --minimal`: element count, form summary, heading hierarchy, ~1-2KB
4. Add a `get_element_info ref` tool that returns details about a SINGLE element (selector, text, position, state) -- useful for verification without full re-snapshot.
5. If the model calls an action on a stale element reference, the action handler should return a clear error: `"Element e12 no longer exists (page changed since last snapshot). Call get_dom_snapshot to get updated element references."`

**Detection:** Action failures with "element not found" after successful actions that changed the page. Model calling actions on stale refs repeatedly.

**Phase recommendation:** The snapshot tool design must be decided BEFORE implementing the agent loop, as it affects the tool registry, the context budget, and the loop's feedback mechanism.

---

## Minor Pitfalls

Issues that cause annoyance, suboptimal performance, or minor debugging effort.

---

### Pitfall 11: Tool Definition Token Overhead Across Providers

**What goes wrong:** Each tool definition consumes tokens in the system prompt. With 25+ browser action tools (current MCP manual.ts has 25), each with descriptions and parameter schemas, tool definitions alone can consume 3-5K tokens. This is sent on EVERY API call.

**Prevention:**
1. Consolidate tools aggressively. Instead of `click`, `rightClick`, `doubleClick`, `hover`, `focus` as separate tools, use a single `interact` tool with a `method` parameter. This reduces 5 tool definitions to 1.
2. Keep descriptions concise but accurate (Anthropic recommends 3-4 sentences, but that is for diverse tool sets -- for browser automation where the model is well-trained, shorter works).
3. Consider dynamic tool injection: only include tools relevant to the current page context (e.g., do not include `fillSheetData` when not on Google Sheets).
4. Measure actual token consumption per provider (Anthropic notes ~20-50 tokens per simple tool, ~100-200 for complex ones).

**Detection:** Token usage analysis showing >10% of input tokens are tool definitions.

---

### Pitfall 12: Parallel Tool Call Handling Complexity

**What goes wrong:** All four providers support parallel tool calls (model returns multiple tool_call/tool_use blocks in one response). If the extension executes them truly in parallel, DOM-mutating actions can conflict (two clicks on the same element, or a click and a type racing each other).

**Prevention:**
1. Extract all tool calls from the response, but execute them SEQUENTIALLY. The model may request parallel calls, but browser automation must be serial because DOM state changes between actions.
2. Return results for ALL tool calls in a single message (required by all providers -- you cannot submit partial results).
3. If a tool call fails (e.g., element not found after a previous action changed the page), return the error for that specific call and success for the others. The model will interpret the mixed results and adapt.

**Detection:** Race conditions in DOM interactions. "Element not interactable" errors when two actions target the same area.

---

### Pitfall 13: Conversation History Format Incompatibility with Existing Session Continuity

**What goes wrong:** The current session continuity system (follow-up commands, conversation reuse via `conversationId`) stores conversation history as `[{ role: 'system', content: string }, { role: 'user', content: string }, ...]`. Tool_use history includes structured content blocks (tool_use, tool_result) that are not simple strings. Mixing formats in a continued session causes API errors.

**Prevention:**
1. When resuming a session from the old CLI format, convert the history to tool_use format: old `assistant` messages with CLI text become `assistant` messages with `text` content blocks.
2. When persisting tool_use sessions, store the full structured history (not just text).
3. Version the session format: add `session.historyFormat = 'tool_use'` vs `'cli'` so resume logic knows which parser to use.
4. On follow-up commands in a tool_use session, do not re-send the full history. Compact everything before the follow-up into a summary and start fresh with the new task.

---

### Pitfall 14: Memory Extraction Breaks with Tool_Use Response Format

**What goes wrong:** The existing `extractAndStoreMemories(sessionId, session)` function (called at session end, 4+ call sites) parses session data including `actionHistory`, task completion evidence, and conversation patterns. It expects CLI-formatted action entries. Tool_use formatted actions have different field names and structures.

**Prevention:**
1. Normalize `actionHistory` entries at the point they are recorded, not at extraction time. Whether the action came from CLI parsing or tool_call extraction, the stored entry should have the same shape: `{ tool: 'click', params: { selector: 'e5' }, result: { success: true, ... }, timestamp: Date.now(), iteration: N }`.
2. Verify that the memory extraction AI prompt still works with tool_use session summaries (it sends session data to an AI for recon report generation).
3. Test: Run a session, verify Task Memory entry is created with the correct format.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Provider adapters | P1 (format divergence), P5 (Anthropic structure), P9 (fetch timeout) | Build and test each adapter in isolation with mock responses before integration |
| Tool registry | P7 (MCP breakage), P11 (token overhead) | Extract from MCP server's existing Zod schemas; test MCP path does not regress |
| Agent loop core | P2 (runaway), P4 (service worker kill), P8 (stuck detection) | Use setTimeout-chaining pattern from day one; implement cost circuit breaker alongside loop |
| History management | P3 (token explosion), P13 (format incompatibility) | Design compression strategy before coding the loop; version the history format |
| DOM snapshot tool | P10 (stale/oversized data) | Define snapshot size tiers and staleness hints before implementing |
| Progress/overlay | P6 (regression) | Update progress calculation to not depend on maxIterations denominator |
| Session persistence | P4 (state loss), P13 (format compat) | Persist after every iteration; add resurrection on service worker restart |
| Memory extraction | P14 (format breakage) | Normalize actionHistory entries at recording time |

---

## Sources

- [Chrome Extension Service Worker Lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle) -- official Chrome docs on timeout rules (30s idle, 5m execution, 30s fetch)
- [Longer Extension Service Worker Lifetimes](https://developer.chrome.com/blog/longer-esw-lifetimes) -- Chrome 114-120 improvements (WebSocket, debugger, alarms)
- [Chromium Issue #40733525](https://issues.chromium.org/issues/40733525) -- service worker 5-minute shutdown discussion
- [xAI Function Calling Docs](https://docs.x.ai/docs/guides/function-calling) -- xAI/Grok tool_use format (OpenAI-compatible)
- [Anthropic Tool Use Implementation](https://platform.claude.com/docs/en/agents-and-tools/tool-use/implement-tool-use) -- tool_use/tool_result content block format
- [Gemini Function Calling Docs](https://ai.google.dev/gemini-api/docs/function-calling) -- functionDeclarations/functionCall/functionResponse format
- [Function Calling Complete Guide 2026](https://ofox.ai/blog/function-calling-tool-use-complete-guide-2026/) -- cross-provider format comparison
- [Agent Suicide by Context](https://www.stackone.com/blog/agent-suicide-by-context/) -- token explosion patterns and mitigations
- [Anthropic OpenAI SDK Compatibility](https://platform.claude.com/docs/en/api/openai-sdk) -- partial compatibility layer for Anthropic
- FSB codebase analysis: background.js (11K+ lines), ai-integration.js (5K+ lines), universal-provider.js, mcp-server/src/tools/manual.ts
