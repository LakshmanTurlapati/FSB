# Phase 135: Provider Format Adapters & Tool Registry - Context

**Gathered:** 2026-03-31
**Status:** Ready for planning

<domain>
## Phase Boundary

Define all 35+ browser automation tools once in JSON Schema with routing metadata (content script, CDP, background, data), and build provider-specific format adapters so xAI/OpenAI/Anthropic/Gemini/OpenRouter/Custom endpoints can all send and receive native tool_use messages. This is the foundation -- every subsequent phase depends on it.

</domain>

<decisions>
## Implementation Decisions

### Tool naming convention
- **D-01:** snake_case for all tool names in the canonical registry, matching existing MCP convention (click_at, read_page, get_dom_snapshot)
- **D-02:** CLI camelCase names (cdpClickAt, readpage) are NOT preserved -- the registry uses MCP names exclusively
- **D-03:** No alias system -- one name per tool, period

### Tool set scope
- **D-04:** All 35+ tools defined in the registry from day one -- no phased subset approach
- **D-05:** Start from the 33 existing MCP tool definitions in manual.ts as the baseline, add any CLI-only tools that MCP is missing
- **D-06:** Each tool definition includes: name, description, JSON Schema parameters, routing metadata (_route: "content" | "cdp" | "background" | "data", _readOnly: boolean)

### Adapter architecture
- **D-07:** New file tool-use-adapter.js for all tool_use format translation -- separate from UniversalProvider
- **D-08:** UniversalProvider stays focused on basic API call mechanics (endpoint, auth, timeout, retry)
- **D-09:** tool-use-adapter.js exports: formatToolsForProvider(tools, provider), parseToolCalls(response, provider), formatToolResult(id, result, provider), isToolCallResponse(response, provider), formatAssistantMessage(response, provider)
- **D-10:** Three concrete adapter implementations inside tool-use-adapter.js: OpenAI/xAI/OpenRouter/Custom (shared), Anthropic, Gemini

### Tool registry file
- **D-11:** New file tool-definitions.js as the canonical source of truth -- imported by both autopilot and MCP
- **D-12:** Each tool is a plain object with JSON Schema inputSchema (the same schema both providers and MCP use)
- **D-13:** MCP server will import from this registry in Phase 136 (not this phase) -- Phase 135 creates the registry, Phase 136 migrates MCP to use it

### Provider format specifics (from research)
- **D-14:** xAI and OpenAI share the OpenAI format: tools[].function.parameters, finish_reason: "tool_calls", arguments as JSON string
- **D-15:** Anthropic uses: tools[].input_schema, stop_reason: "tool_use", input as already-parsed object
- **D-16:** Gemini uses: functionDeclarations, functionCall parts, args already parsed, does NOT signal tool calls via finishReason (must inspect response parts)
- **D-17:** OpenRouter and Custom endpoints use the OpenAI adapter -- no separate implementation needed

### Claude's Discretion
- Internal file organization within tool-definitions.js (grouping, ordering)
- Exact JSON Schema descriptions for each tool (can refine later)
- Whether to include tool categories as metadata
- Error handling strategy within adapter methods

</decisions>

<specifics>
## Specific Ideas

- "I want the agent to perform as good as you (Claude using MCP)" -- parity with MCP manual mode is the north star
- The Computer Use API agent loop pattern from Research/computer-use-api.md is the reference architecture: while(true) { response = api.create(tools, messages); if end_turn break; for tool_use: execute, feed result back }
- Research found Gemini is the highest-risk adapter -- it doesn't signal tool calls via finishReason, must inspect response parts for functionCall presence

</specifics>

<canonical_refs>
## Canonical References

### Provider API formats
- `Research/computer-use-api.md` -- Agent loop pattern, tool definition format, action execution flow
- `Research/mcp-protocol.md` -- MCP tool schema format, JSON-RPC message structure
- `Research/mcp-architecture.md` -- MCP server/client implementation patterns
- `.planning/research/STACK.md` -- Complete API format comparison across 4 providers with code examples and quirks table
- `.planning/research/ARCHITECTURE.md` -- Integration architecture, what gets replaced/stays/shared

### Existing tool definitions (source material)
- `mcp-server/src/tools/manual.ts` -- 33 existing MCP tool definitions with Zod schemas (target for registry extraction)
- `mcp-server/src/tools/read-only.ts` -- Read-only tools with queue bypass pattern
- `ai/cli-parser.js` lines 153-440 -- COMMAND_REGISTRY with ~75 CLI verb definitions
- `ai/universal-provider.js` -- Current provider abstraction (UniversalProvider class, PROVIDER_CONFIGS)
- `ai/ai-integration.js` lines 16-150 -- CLI_COMMAND_TABLE prompt reference

### Provider-specific documentation
- `.planning/research/PITFALLS.md` -- 14 pitfalls with P1 (format divergence) and P5 (Anthropic incompatibility) critical for this phase

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **mcp-server/src/tools/manual.ts**: 33 tool definitions already in structured format (Zod schemas). These are the closest to the target JSON Schema format and should be the starting point for tool-definitions.js
- **mcp-server/src/queue.ts**: TaskQueue with readOnlyTools Set -- the _readOnly routing metadata maps directly to this
- **ai/cli-parser.js COMMAND_REGISTRY**: Contains tool routing information (which tools go to content script, CDP, background) that needs to be preserved in the new registry

### Established Patterns
- **PROVIDER_CONFIGS**: UniversalProvider already has per-provider config objects with endpoint, auth, and custom format flags -- tool-use-adapter.js follows the same pattern
- **customFormat flag**: Anthropic and Gemini already have `customFormat: true` in PROVIDER_CONFIGS, indicating they need special handling -- this extends naturally to tool_use format

### Integration Points
- tool-definitions.js will be imported by: tool-use-adapter.js (format for providers), future tool-executor.js (Phase 136), future MCP server migration (Phase 136)
- tool-use-adapter.js will be called by: the new agent loop in background.js (Phase 137) when making API calls with tools

</code_context>

<deferred>
## Deferred Ideas

- MCP server importing from shared registry -- Phase 136
- Unified tool executor -- Phase 136
- Agent loop implementation -- Phase 137
- Streaming tool_use responses -- deferred beyond v0.9.20

</deferred>

---

*Phase: 135-provider-format-adapters-tool-registry*
*Context gathered: 2026-03-31*
