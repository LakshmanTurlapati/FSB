# Technology Stack: v0.9.20 Native tool_use Agent Loop

**Project:** FSB (Full Self-Browsing) -- Native tool_use/function calling across all 4 providers
**Researched:** 2026-03-31
**Mode:** Ecosystem (API format mapping for xAI, OpenAI, Anthropic, Gemini function calling)

## Executive Summary

All four providers FSB supports now have mature tool_use/function calling APIs. The critical finding is that three providers (xAI, OpenAI, OpenRouter) share the OpenAI chat/completions format, while Anthropic and Gemini each have their own. The existing `UniversalProvider` class already handles per-provider request formatting (`formatForProvider`) and response parsing (`parseResponse`) -- the tool_use extension follows the same pattern: define tools once in a canonical format, translate per-provider on send, normalize per-provider on receive.

**Key decision: Use xAI chat/completions (not xAI Responses API) because it is OpenAI-compatible, meaning xAI and OpenAI share identical tool handling code. The Responses API is newer but uses different formats that would require a third translation layer for minimal benefit.**

## Provider API Format Comparison

### Tool Definition Formats

All providers use JSON Schema for parameter definitions. The wrapper differs.

#### Canonical (Internal) Format -- What FSB stores

```javascript
// One tool definition used everywhere (autopilot + MCP)
{
  name: 'click',
  description: 'Click an element by CSS selector or element reference.',
  parameters: {
    type: 'object',
    properties: {
      selector: { type: 'string', description: 'CSS selector or element ref (e.g., "e5")' }
    },
    required: ['selector']
  }
}
```

#### OpenAI / xAI (chat/completions) -- Identical format

```json
{
  "type": "function",
  "function": {
    "name": "click",
    "description": "Click an element by CSS selector or element reference.",
    "parameters": {
      "type": "object",
      "properties": {
        "selector": { "type": "string", "description": "CSS selector or element ref" }
      },
      "required": ["selector"]
    }
  }
}
```

**Confidence:** HIGH -- verified via [xAI REST API reference](https://docs.x.ai/developers/rest-api-reference/inference/chat) and [OpenAI function calling docs](https://developers.openai.com/api/docs/guides/function-calling).

**Key details:**
- Wrap each tool in `{ type: "function", function: { ...canonical } }`
- Max 128 tools (xAI), no documented limit for OpenAI
- `tool_choice`: `"auto"` (default) | `"required"` | `"none"` | `{ type: "function", function: { name: "..." } }`
- `parallel_tool_calls`: boolean, defaults to `true` -- set to `false` for sequential execution
- Arguments in response are JSON-stringified strings, must `JSON.parse()`

#### Anthropic (Messages API)

```json
{
  "name": "click",
  "description": "Click an element by CSS selector or element reference.",
  "input_schema": {
    "type": "object",
    "properties": {
      "selector": { "type": "string", "description": "CSS selector or element ref" }
    },
    "required": ["selector"]
  }
}
```

**Confidence:** HIGH -- verified via [Anthropic tool use docs](https://platform.claude.com/docs/en/agents-and-tools/tool-use/implement-tool-use).

**Key differences from OpenAI format:**
- No `type: "function"` wrapper -- tools are bare objects in the `tools` array
- Schema field is `input_schema` (not `parameters`)
- Optional: `strict: true` for guaranteed schema conformance
- Optional: `input_examples` array for complex tools
- `tool_choice`: `{ type: "auto" }` | `{ type: "any" }` | `{ type: "tool", name: "..." }` | `{ type: "none" }` -- NOTE: object format, not string
- No `parallel_tool_calls` parameter -- Anthropic decides autonomously

#### Gemini (generateContent API)

```json
{
  "tools": [{
    "functionDeclarations": [{
      "name": "click",
      "description": "Click an element by CSS selector or element reference.",
      "parameters": {
        "type": "object",
        "properties": {
          "selector": { "type": "string", "description": "CSS selector or element ref" }
        },
        "required": ["selector"]
      }
    }]
  }],
  "toolConfig": {
    "functionCallingConfig": {
      "mode": "AUTO"
    }
  }
}
```

**Confidence:** HIGH -- verified via [Gemini function calling docs](https://ai.google.dev/gemini-api/docs/function-calling).

**Key differences from OpenAI format:**
- Tools wrapped in `tools[].functionDeclarations[]` (double nesting)
- Schema field is `parameters` (same name as OpenAI but different wrapper)
- Control via `toolConfig.functionCallingConfig.mode`: `"AUTO"` | `"ANY"` | `"NONE"` | `"VALIDATED"`
- No `parallel_tool_calls` parameter -- Gemini decides autonomously
- Gemini supports parallel calls natively

### Tool Call Response Formats

This is the critical part -- how each provider signals "I want to call a tool" and how FSB must parse it.

#### OpenAI / xAI Response

```json
{
  "choices": [{
    "message": {
      "role": "assistant",
      "content": null,
      "tool_calls": [{
        "id": "call_abc123",
        "type": "function",
        "function": {
          "name": "click",
          "arguments": "{\"selector\": \"e5\"}"
        }
      }]
    },
    "finish_reason": "tool_calls"
  }],
  "usage": { "prompt_tokens": 100, "completion_tokens": 20, "total_tokens": 120 }
}
```

**Parsing logic:**
- Check `finish_reason === "tool_calls"` (not `"stop"`)
- Tool calls in `choices[0].message.tool_calls[]`
- Each has `id` (for matching results), `function.name`, `function.arguments` (JSON string -- must parse)
- `content` may be null or may contain text alongside tool calls
- Multiple tool_calls possible if `parallel_tool_calls` is true

**Confidence:** HIGH -- verified via xAI REST API schema and OpenAI docs.

**QUIRK (xAI):** The xAI docs list finish_reason values as "stop", "length", "end_turn" -- but for tool calls the OpenAI-compatible endpoint uses `"tool_calls"` as finish_reason. This matches the OpenAI convention. Verified from the REST API schema.

#### Anthropic Response

```json
{
  "role": "assistant",
  "content": [
    {
      "type": "text",
      "text": "I'll click that element for you."
    },
    {
      "type": "tool_use",
      "id": "toolu_01A09q90qw90lq917835lq9",
      "name": "click",
      "input": { "selector": "e5" }
    }
  ],
  "stop_reason": "tool_use",
  "usage": { "input_tokens": 100, "output_tokens": 50 }
}
```

**Parsing logic:**
- Check `stop_reason === "tool_use"` (not `"end_turn"`)
- Tool calls are content blocks with `type: "tool_use"` in the `content` array
- Each has `id`, `name`, `input` (already parsed object -- NOT a JSON string)
- Text content blocks may appear alongside tool_use blocks
- Multiple tool_use blocks possible in one response

**Confidence:** HIGH -- verified via Anthropic docs.

**CRITICAL DIFFERENCE:** Anthropic's `input` is a parsed object, not a JSON string. OpenAI/xAI `arguments` is a JSON string that needs `JSON.parse()`. This is the biggest parsing difference.

#### Gemini Response

```json
{
  "candidates": [{
    "content": {
      "parts": [{
        "functionCall": {
          "name": "click",
          "id": "8f2b1a3c",
          "args": { "param": "value" }
        }
      }]
    },
    "finishReason": "STOP"
  }],
  "usageMetadata": { "promptTokenCount": 100, "candidatesTokenCount": 20, "totalTokenCount": 120 }
}
```

**Parsing logic:**
- Check `parts[]` for objects with `functionCall` property
- Each `functionCall` has `name`, `id`, and `args` (parsed object, not JSON string)
- `finishReason` is `"STOP"` even for function calls (Gemini does not have a separate finish reason)
- Multiple `functionCall` parts possible in one response (parallel calls)
- `args` is an already-parsed object (like Anthropic, unlike OpenAI/xAI)

**Confidence:** HIGH -- verified via Gemini docs. The `id` field is guaranteed for Gemini 3+ models.

**QUIRK (Gemini):** Gemini uses `finishReason: "STOP"` even when calling functions. You must inspect the parts for `functionCall` presence, not rely on finish reason.

### Tool Result Formats (Sending Results Back)

After executing a tool, FSB must send the result back. Each provider has a different format.

#### OpenAI / xAI Result

Append two messages to the conversation history:

```json
[
  {
    "role": "assistant",
    "content": null,
    "tool_calls": [{ "id": "call_abc123", "type": "function", "function": { "name": "click", "arguments": "{...}" } }]
  },
  {
    "role": "tool",
    "tool_call_id": "call_abc123",
    "content": "{\"success\": true, \"message\": \"Clicked element e5\"}"
  }
]
```

**Key details:**
- Role `"tool"` (not `"user"`)
- `tool_call_id` must match the `id` from the tool call
- `content` is a string (JSON-stringified result)
- One tool message per tool call (multiple if parallel calls)

#### Anthropic Result

Append assistant message then user message with tool_result:

```json
[
  {
    "role": "assistant",
    "content": [
      { "type": "text", "text": "I'll click that." },
      { "type": "tool_use", "id": "toolu_01A09q", "name": "click", "input": { "selector": "e5" } }
    ]
  },
  {
    "role": "user",
    "content": [
      {
        "type": "tool_result",
        "tool_use_id": "toolu_01A09q",
        "content": "Clicked element e5 successfully"
      }
    ]
  }
]
```

**Key differences:**
- Tool results go in a `"user"` role message (not a dedicated `"tool"` role)
- Content block type is `"tool_result"` with `tool_use_id` (not `tool_call_id`)
- `content` can be a string or an array of content blocks
- For errors: add `"is_error": true` to the tool_result block
- Must include the full assistant message (including any text blocks) before the user tool_result

#### Gemini Result

Append model turn then user turn with functionResponse:

```json
[
  {
    "role": "model",
    "parts": [{ "functionCall": { "name": "click", "id": "8f2b1a3c", "args": { "selector": "e5" } } }]
  },
  {
    "role": "user",
    "parts": [{
      "functionResponse": {
        "name": "click",
        "id": "8f2b1a3c",
        "response": { "success": true, "message": "Clicked element e5" }
      }
    }]
  }
]
```

**Key differences:**
- Uses `"model"` role (not `"assistant"`)
- Tool results in a `"user"` role message (like Anthropic, unlike OpenAI)
- Uses `functionResponse` with `name`, `id`, and `response` (an object, not stringified)
- `id` must match the function call's `id`
- Response order doesn't matter for parallel calls (matched by ID)

## Recommended Translation Architecture

### Why NOT a full abstraction layer

The existing `UniversalProvider` already has `formatForProvider()` and `parseResponse()` methods that handle per-provider differences. Adding tool_use follows the same pattern. There is no need for a new abstraction -- extend what exists.

### The Translation Pattern

```
Canonical tool defs -----> formatToolsForProvider() -----> Provider-specific tools
                                                              (in request body)

Provider response   -----> parseToolCalls()         -----> Normalized tool calls
                                                              [{id, name, args}]

Execution result    -----> formatToolResult()        -----> Provider-specific result
                                                              (appended to messages)
```

Three new methods on UniversalProvider. That is the entire API surface.

### Method 1: formatToolsForProvider(canonicalTools)

```javascript
formatToolsForProvider(tools) {
  switch (this.provider) {
    case 'anthropic':
      return tools.map(t => ({
        name: t.name,
        description: t.description,
        input_schema: t.parameters
      }));

    case 'gemini':
      return [{
        functionDeclarations: tools.map(t => ({
          name: t.name,
          description: t.description,
          parameters: t.parameters
        }))
      }];

    default: // openai, xai, openrouter
      return tools.map(t => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters
        }
      }));
  }
}
```

### Method 2: parseToolCalls(response) -> normalized array

```javascript
parseToolCalls(response) {
  switch (this.provider) {
    case 'anthropic': {
      const blocks = response.content.filter(b => b.type === 'tool_use');
      return blocks.map(b => ({ id: b.id, name: b.name, args: b.input }));
      // args is already parsed object
    }

    case 'gemini': {
      const parts = response.candidates[0].content.parts
        .filter(p => p.functionCall);
      return parts.map(p => ({
        id: p.functionCall.id,
        name: p.functionCall.name,
        args: p.functionCall.args  // already parsed object
      }));
    }

    default: { // openai, xai, openrouter
      const calls = response.choices[0].message.tool_calls || [];
      return calls.map(c => ({
        id: c.id,
        name: c.function.name,
        args: JSON.parse(c.function.arguments)  // MUST parse JSON string
      }));
    }
  }
}
```

### Method 3: formatToolResult(toolCallId, toolName, result, isError) -> message to append

```javascript
formatToolResult(callId, name, result, isError = false) {
  const resultStr = typeof result === 'string' ? result : JSON.stringify(result);

  switch (this.provider) {
    case 'anthropic':
      return {
        role: 'user',
        content: [{
          type: 'tool_result',
          tool_use_id: callId,
          content: resultStr,
          ...(isError ? { is_error: true } : {})
        }]
      };

    case 'gemini':
      return {
        role: 'user',
        parts: [{
          functionResponse: {
            name,
            id: callId,
            response: typeof result === 'string' ? { result } : result
          }
        }]
      };

    default: // openai, xai, openrouter
      return {
        role: 'tool',
        tool_call_id: callId,
        content: resultStr
      };
  }
}
```

### Loop Termination Detection

```javascript
isToolCallResponse(response) {
  switch (this.provider) {
    case 'anthropic':
      return response.stop_reason === 'tool_use';

    case 'gemini':
      // Gemini does NOT use a separate finish reason
      return response.candidates?.[0]?.content?.parts?.some(p => p.functionCall);

    default: // openai, xai, openrouter
      return response.choices?.[0]?.finish_reason === 'tool_calls';
  }
}
```

### Assistant Message Preservation

For the agent loop, the assistant's response must be appended to conversation history before the tool result. Each provider formats this differently:

```javascript
formatAssistantMessage(response) {
  switch (this.provider) {
    case 'anthropic':
      return { role: 'assistant', content: response.content };

    case 'gemini':
      return {
        role: 'model',
        parts: response.candidates[0].content.parts
      };

    default: // openai, xai, openrouter
      return response.choices[0].message;
      // Includes tool_calls, content, role -- pass through as-is
  }
}
```

## Provider-Specific Quirks and Pitfalls

### xAI Quirks
| Quirk | Impact | Mitigation |
|-------|--------|------------|
| Max 128 tools per request | FSB has ~35 tools, well under limit | No action needed |
| `parallel_tool_calls` defaults to true | May return multiple tool calls | Set `false` for sequential browser actions |
| Chat/completions marked "legacy" | Responses API is newer | Use chat/completions anyway -- it is OpenAI-compatible and simpler; Responses API format diverges |
| Arguments are JSON strings | Must parse | `JSON.parse(c.function.arguments)` |
| finish_reason `"tool_calls"` not documented in their finish_reason list | Could cause confusion | Test empirically; fall back to checking `tool_calls` array presence |

**Confidence:** MEDIUM on finish_reason value. The xAI REST schema shows "stop", "length", "end_turn" but the OpenAI-compatible behavior should use "tool_calls". Needs empirical verification.

### OpenAI Quirks
| Quirk | Impact | Mitigation |
|-------|--------|------------|
| `strict: true` available for structured outputs | Guarantees schema match | Use if reliability issues arise; adds latency |
| `parallel_tool_calls` defaults to true | Multiple calls per turn | Set `false` for browser actions |
| Arguments are JSON strings | Must parse | Same as xAI |
| GPT-4o sometimes returns malformed JSON in arguments | Parse failures | Wrap `JSON.parse()` in try/catch, re-request on failure |

**Confidence:** HIGH -- well-documented, widely used.

### Anthropic Quirks
| Quirk | Impact | Mitigation |
|-------|--------|------------|
| `input` is parsed object (not JSON string) | Different from OpenAI | No `JSON.parse` needed for Anthropic |
| Tool results use `"user"` role | Must match expected format | Format correctly in `formatToolResult` |
| `stop_reason` is `"tool_use"` (not `"tool_calls"`) | Different signal name | Handle in `isToolCallResponse` |
| May include text blocks alongside tool_use | Text explains what model is doing | Preserve in conversation history |
| `tool_choice` is object `{type: "auto"}` not string `"auto"` | Different from OpenAI | Format in request builder |
| `strict: true` available for guaranteed schema conformance | Schema validation | Use if needed |
| System prompt is separate field (not in messages) | Already handled by existing `formatAnthropicRequest` | No new work |

**Confidence:** HIGH -- verified directly from official docs.

### Gemini Quirks
| Quirk | Impact | Mitigation |
|-------|--------|------------|
| `functionCall` not `tool_calls` | Completely different key names | Handle in parser |
| `args` is parsed object (not JSON string) | Like Anthropic, unlike OpenAI | No `JSON.parse` needed |
| `finishReason: "STOP"` even for function calls | Cannot rely on finish reason | Must inspect parts for `functionCall` |
| Uses `"model"` role (not `"assistant"`) | Already handled by existing Gemini formatter | No new work |
| System prompt via `systemInstruction` (not in messages) | Must handle separately | Already handled by existing `formatGeminiRequest` |
| `functionDeclarations` double-nested in `tools[]` | Different wrapping | Handle in `formatToolsForProvider` |
| `id` field only in Gemini 3+ models | Older models may not return IDs | Generate synthetic IDs for older models as fallback |
| `toolConfig.functionCallingConfig.mode` for control | Different from `tool_choice` | Map in request builder |

**Confidence:** HIGH -- verified from Gemini function calling docs.

## Streaming Considerations

### Current State
FSB does NOT use streaming for the autopilot loop. Each AI call is a single request-response cycle (non-streamed). The current `sendRequest` method uses `fetch` and `response.json()`.

### Recommendation: Do NOT add streaming for v0.9.20

**Why:**
1. Browser actions are sequential -- you cannot start executing a tool while it is still being streamed
2. The agent loop needs the complete tool call (name + all arguments) before execution
3. Streaming adds complexity (SSE parsing, partial JSON accumulation) with zero benefit for tool_use
4. Each provider has a different streaming format (SSE event types differ)
5. The existing non-streamed approach works and is simpler

**When streaming would matter (future):**
- If adding a "thinking" indicator showing the model's reasoning text before tool calls
- If implementing partial tool argument preview in the UI
- Neither of these is in scope for v0.9.20

**Confidence:** HIGH -- this is an architectural judgment based on the sequential nature of browser automation.

## Tool Choice Configuration

For the FSB agent loop, the recommended `tool_choice` settings:

| Provider | Setting | Format | Rationale |
|----------|---------|--------|-----------|
| OpenAI/xAI | `"auto"` | `tool_choice: "auto"` | Let model decide when to call tools vs respond with text |
| Anthropic | `auto` | `tool_choice: { type: "auto" }` | Same intent, object format |
| Gemini | `AUTO` | `toolConfig: { functionCallingConfig: { mode: "AUTO" } }` | Same intent, different structure |

**For parallel tool calls:**

| Provider | Setting | Rationale |
|----------|---------|-----------|
| OpenAI/xAI | `parallel_tool_calls: false` | Browser actions must execute sequentially |
| Anthropic | N/A (no parameter) | Model decides; FSB processes calls sequentially regardless |
| Gemini | N/A (no parameter) | Model decides; FSB processes calls sequentially regardless |

Even when parallel calls are returned (Anthropic/Gemini), FSB should process them sequentially because browser actions depend on DOM state from previous actions.

## Integration with Existing UniversalProvider

### What changes in UniversalProvider

| Method | Change |
|--------|--------|
| `buildRequest()` | Accept optional `tools` array and `toolChoice` param; add formatted tools to request |
| `formatForProvider()` | Already exists; extend to handle tools in the request body |
| `formatGeminiRequest()` | Add `tools` and `toolConfig` fields |
| `formatAnthropicRequest()` | Add `tools` and `tool_choice` fields |
| `parseResponse()` | Extend to detect tool calls vs text response; return structured result |
| NEW: `formatToolsForProvider()` | Translate canonical tool defs to provider format |
| NEW: `parseToolCalls()` | Extract normalized `[{id, name, args}]` from response |
| NEW: `formatToolResult()` | Build provider-specific tool result message |
| NEW: `isToolCallResponse()` | Check if response contains tool calls |
| NEW: `formatAssistantMessage()` | Extract assistant message for conversation history |

### What does NOT change

- `getEndpoint()` -- same endpoints
- `getHeaders()` -- same auth
- `sendRequest()` -- same HTTP logic, timeout, retry
- `testConnection()` -- no tools needed for connection test
- Rate limit handling -- unchanged
- Parameter caching -- unchanged

## Versions and Compatibility

| Provider | API Endpoint | Min Model for tool_use | Recommended Model |
|----------|-------------|----------------------|-------------------|
| xAI | `v1/chat/completions` | grok-3 | grok-4-1-fast (2M context, optimized for tool calling) |
| OpenAI | `v1/chat/completions` | gpt-4o-mini | gpt-4o |
| Anthropic | `v1/messages` | claude-haiku-4.5 | claude-sonnet-4 or claude-sonnet-4.5 |
| Gemini | `v1beta/models/{model}:generateContent` | gemini-2.0-flash | gemini-2.5-flash |

**Confidence:** MEDIUM on model minimum versions. Most current-generation models support tool_use but exact minimum versions may vary.

## Sources

### Primary (Official Documentation)
- [xAI Function Calling](https://docs.x.ai/docs/guides/function-calling) -- tool definition format and calling guide
- [xAI REST API Reference](https://docs.x.ai/developers/rest-api-reference/inference/chat) -- exact request/response schema
- [xAI Chat Completions (Legacy)](https://docs.x.ai/developers/model-capabilities/legacy/chat-completions) -- OpenAI-compatible endpoint
- [OpenAI Function Calling](https://developers.openai.com/api/docs/guides/function-calling) -- tool definition, response, and tool_choice
- [Anthropic Tool Use Overview](https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview) -- architecture and pricing
- [Anthropic Define Tools](https://platform.claude.com/docs/en/agents-and-tools/tool-use/implement-tool-use) -- tool schema, input_schema, tool_choice
- [Gemini Function Calling](https://ai.google.dev/gemini-api/docs/function-calling) -- functionDeclarations, toolConfig, id mapping

### Secondary (Cross-references)
- [xAI Responses API vs Chat Completions](https://docs.x.ai/developers/model-capabilities/text/comparison) -- why we chose chat/completions
- [OpenAI Parallel Tool Calls Discussion](https://community.openai.com/t/parallel-tool-use-documentation-for-api-models/1304519)
- [OpenRouter Tool Calling](https://openrouter.ai/docs/guides/features/tool-calling) -- confirms OpenAI-compatible format
