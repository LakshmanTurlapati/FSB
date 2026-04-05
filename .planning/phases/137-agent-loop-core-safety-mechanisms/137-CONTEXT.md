# Phase 137: Agent Loop Core & Safety Mechanisms - Context

**Gathered:** 2026-04-01
**Status:** Ready for planning
**Mode:** Smart discuss (defaults accepted)

<domain>
## Phase Boundary

End-to-end native tool_use agent loop. User types a task, the loop sends messages with tool definitions to the AI API, receives tool_use blocks, executes them via tool-executor.js, feeds tool_result back, and repeats until the AI emits end_turn. Safety mechanisms prevent runaway sessions.

</domain>

<decisions>
## Implementation Decisions

### Safety thresholds
- **D-01:** Cost-based circuit breaker: default $2 estimated cost per session, configurable in options
- **D-02:** Time limit: default 10 minutes per session, configurable in options
- **D-03:** Stuck detection: external monitor injects recovery hint into tool_result when 3+ consecutive tool calls produce no DOM change
- **D-04:** No fixed iteration cap -- cost + time breakers replace the old 20-iteration cap

### System prompt design
- **D-05:** Minimal system prompt (~1-2KB): task description, current page URL, brief role ("You are a browser automation agent"), available tool summary
- **D-06:** No site guides in system prompt (those become on-demand tools in Phase 138)
- **D-07:** No conversation history instructions -- the API handles multi-turn natively

### Loop architecture
- **D-08:** setTimeout-chaining pattern (same as current autopilot) -- each iteration is a separate event to survive Chrome 5-minute SW kill
- **D-09:** Session state persisted to chrome.storage.session after every iteration for service worker resurrection
- **D-10:** Stop button sets a flag checked at the start of each iteration -- halts within one iteration
- **D-11:** Tool definitions sent with every API call (they're cached by providers that support it)

### Integration
- **D-12:** Uses tool-executor.js from Phase 136 for all tool dispatch
- **D-13:** Uses tool-use-adapter.js from Phase 135 for provider format translation
- **D-14:** Uses tool-definitions.js from Phase 135 for tool schemas
- **D-15:** Replaces startAutomationLoop() in background.js with runAgentLoop()

### Claude's Discretion
- Exact format of recovery hints injected on stuck detection
- How to estimate token costs per provider (use model pricing from config)
- Error message wording for cost/time breakers
- Whether to show AI reasoning in progress overlay (defer visual integration to Phase 138)

</decisions>

<canonical_refs>
## Canonical References

### Phase 135/136 outputs (dependencies)
- `ai/tool-definitions.js` -- Canonical tool registry (42 tools)
- `ai/tool-use-adapter.js` -- Provider format adapter (6 exports)
- `ai/tool-executor.js` -- Unified tool executor (executeTool, isReadOnly)

### Current autopilot (being replaced)
- `background.js` lines 9384-11800 -- startAutomationLoop (the code being replaced)
- `ai/ai-integration.js` -- AIIntegration class (callAIAPI, buildPrompt, conversation history)
- `ai/universal-provider.js` -- UniversalProvider (API calls, provider configs)

### Research
- `.planning/research/SUMMARY.md` -- Phase 3 recommendations: setTimeout-chaining, cost breaker, stuck detection
- `.planning/research/PITFALLS.md` -- P2 (runaway), P4 (SW kill), P8 (stuck detection lost)
- `Research/computer-use-api.md` -- Agent loop reference pattern

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- UniversalProvider.callAPI() -- already handles provider-specific request formatting, auth, timeout, retry
- Session management in background.js (sessions map, cleanup) -- keep this infrastructure
- Progress overlay messaging (sendProgressUpdate) -- reuse for tool execution feedback

### Established Patterns
- setTimeout-chaining in current startAutomationLoop -- same pattern, new loop body
- chrome.storage.session for ephemeral state -- use for iteration persistence
- Message passing to sidepanel/popup for UI updates

### Integration Points
- handleStartAutomation in background.js -- entry point that will call runAgentLoop
- Sidepanel stop button handler -- already sends stop message, loop checks the flag
- Progress overlay -- already receives status updates via message passing

</code_context>

<specifics>
## Specific Ideas

- "I want the agent to perform as good as you (Claude using MCP)" -- the loop should feel like Claude Code calling MCP tools
- The Computer Use API agent loop from Research/computer-use-api.md is the reference: while(true) { response = api.create(tools, messages); if end_turn break; for tool_use: execute, feed result back }

</specifics>

<deferred>
## Deferred Ideas

- DOM snapshot as on-demand tool -- Phase 138
- Site guides as queryable tool -- Phase 138
- Sliding window history compression -- Phase 138
- Progress overlay with cost display -- Phase 138
- Prompt caching -- Phase 138

</deferred>

---

*Phase: 137-agent-loop-core-safety-mechanisms*
*Context gathered: 2026-04-01*
