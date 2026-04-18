# AI Communication Subsystem Findings

## Summary

11 findings across 18+ functions audited. The most critical regression was the Phase 139.1 cleanup (v0.9.24) that deleted the entire prompt construction and response processing pipeline as "dead code" while background.js still called it. This was partially restored in commit 23c0ad1 but introduced a chain of 3 additional response-parsing regressions (8a7a8cf, 1ff5b52, 7ba62d9) related to the UniversalProvider cleanResponse/parseJSONSafely pipeline mangling CLI-format responses. The tool-use-adapter.js had a single targeted fix (fa4eb79) that improved correctness.

File growth: ai-integration.js went from 2,600 lines (v0.9.24 with deletions) to 5,281 lines (current), a 2,681-line increase reflecting the restoration of deleted code plus accumulated new features.

## Findings

### AC-01: Phase 139.1 deleted entire CLI autopilot pipeline as "dead code"

- **File:** ai/ai-integration.js (throughout)
- **Function:** getAutomationActions, processQueue, buildPrompt, decomposeTask, buildMinimalUpdate, _buildTaskGuidance, getToolsDocumentation, TASK_PROMPTS, CLI_COMMAND_TABLE, HYBRID_CONTINUATION_PROMPT, BATCH_ACTION_INSTRUCTIONS, buildSheetsFormattingDirective, PROMPT_CHAR_LIMIT
- **Expected (v0.9.24):** These functions would be present and callable by background.js. They constituted the entire prompt construction, task processing, and response parsing pipeline for the CLI-format autopilot.
- **Actual (current):** v0.9.24 shipped with ALL of them replaced by "Dead code removed: ..." comments (7 separate deletion blocks). Commit 23c0ad1 restored them. The current code has the full pipeline back.
- **Impact:** Total autopilot failure at v0.9.24. background.js called getAutomationActions which no longer existed, causing TypeError and "AI service error" for all providers. The agent loop was completely non-functional.
- **Proposed Fix:** Already fixed by commit 23c0ad1. No further action needed on the deletion itself. However, the restoration was a bulk paste from a pre-v0.9.24 state, which means the restored code may contain stale references or miss v0.9.24-era improvements that were made to callers but not to the deleted code. Verify that all restored functions align with current caller expectations.

### AC-02: UniversalProvider.parseJSONSafely destroyed CLI-format responses

- **File:** ai/universal-provider.js:627-688
- **Function:** parseJSONSafely (called by cleanResponse)
- **Expected (v0.9.24):** Raw AI response text (CLI format: `# reasoning\nclick e5\ntype e12 "hello"`) would pass through to parseCliResponse for correct interpretation.
- **Actual (current):** parseJSONSafely was stripping everything before the first `{` (line 653), then running fixTruncatedJSON, fixCommonMalformations, fixJSONStructure on the CLI text, mangling it beyond recognition. When JSON.parse failed on the mangled CLI text, it returned `'{"success":false,"error":"JSON parsing failed"}'` -- a fake JSON error object that parseCliResponse could not interpret.
- **Impact:** All AI responses destroyed before reaching the CLI parser. The agent produced no actions and reported "AI service error" to the user. Affected all providers.
- **Proposed Fix:** Fixed across 3 commits (8a7a8cf, 1ff5b52, 7ba62d9). parseResponse now returns raw text directly (line 604-613) with a comment: "Do NOT call cleanResponse/parseJSONSafely." The dead cleanResponse/parseJSONSafely methods remain in the file as unreachable code. Consider deleting them to prevent future accidental re-enablement.

### AC-03: UniversalProvider.parseResponse returned objects instead of strings

- **File:** ai/universal-provider.js (parseResponse method)
- **Function:** parseResponse
- **Expected (v0.9.24):** parseResponse returns raw text string that callAPI (ai-integration.js:4324) passes to parseCliResponse.
- **Actual (current):** Before fix 1ff5b52, parseResponse returned parsed objects. callAPI at ai-integration.js:4324 expected strings -- `String(obj)` produced `"[object Object]"` which killed all action parsing.
- **Impact:** Complete action parsing failure. The agent could not execute any actions.
- **Proposed Fix:** Fixed in commit 1ff5b52. parseResponse now returns `{ content: rawTextString, usage, model }`. callAPI extracts `parsed.content` as a string. No further action needed.

### AC-04: Duplicate CLI_COMMAND_TABLE between ai-integration.js and agent-loop.js prompt construction

- **File:** ai/ai-integration.js:15-151
- **Function:** CLI_COMMAND_TABLE constant
- **Expected (v0.9.24):** This was deleted as dead code. The agent-loop.js tool_use pipeline did not need CLI command tables.
- **Actual (current):** Restored as part of 23c0ad1. The CLI_COMMAND_TABLE is a 134-line constant injected into the system prompt via getToolsDocumentation(). It documents every CLI command with examples. This is the CLI autopilot's tool documentation -- essential for the AI to produce valid commands.
- **Impact:** No regression in current state (functional). However, this represents a dual pipeline: agent-loop.js uses native tool_use JSON format with TOOL_REGISTRY from tool-definitions.js, while the CLI autopilot pipeline uses CLI_COMMAND_TABLE text format. The two tool documentation sources may diverge over time.
- **Proposed Fix:** Assess whether the CLI autopilot path is still needed or if all automation should use the native tool_use pipeline through agent-loop.js. If CLI path is retained, ensure CLI_COMMAND_TABLE stays in sync with tool-definitions.js TOOL_REGISTRY.

### AC-05: TASK_PROMPTS restoration contains navigator.userAgent references that fail in service worker

- **File:** ai/ai-integration.js:259-266 (email task prompt)
- **Function:** TASK_PROMPTS.email
- **Expected (v0.9.24):** This constant was deleted. When active, it contained `navigator.userAgent?.includes('Macintosh')` for platform-specific keyboard shortcut detection.
- **Actual (current):** Restored. The template literal evaluates `navigator.userAgent?.includes('Macintosh')` at module load time. In a Chrome Extension Manifest V3 service worker, `navigator` is available but `navigator.userAgent` may not reflect the active tab's platform if the extension is used across devices.
- **Impact:** Low severity. The email task prompt injects the correct Cmd vs Ctrl modifier for Gmail Send shortcut. In practice this works because the extension runs on the user's own machine, so the service worker's navigator.userAgent matches. The concern is architectural -- runtime platform detection at module load time.
- **Proposed Fix:** Replace with a static check or pass platform info from the context object instead of evaluating at module load time.

### AC-06: processQueue CLI parse recovery chain relies on callAPI which may mask errors

- **File:** ai/ai-integration.js:2250-2449 (processQueue method)
- **Function:** processQueue
- **Expected (v0.9.24):** This method was deleted. The agent-loop.js pipeline handled its own response parsing.
- **Actual (current):** Restored processQueue contains a two-stage CLI parse failure recovery (ROBUST-04). Stage 1 sends a "simplified hint" retry. Stage 2 sends a "full reformat" retry. Both call callAPI again. The recovery chain can consume up to 3 additional API calls per failed parse.
- **Impact:** No regression -- this is the intended behavior for CLI parse robustness. However, the recovery stages use `request.prompt.messages` which may be undefined when the prompt uses `systemPrompt`/`userPrompt` format instead of `messages` format. The fallback (lines 2299-2302) constructs a messages array from systemPrompt/userPrompt but loses conversation history context.
- **Proposed Fix:** Ensure the recovery prompt always has full conversation context. Test that Stage 1 and Stage 2 retries work with both prompt formats (messages array vs systemPrompt/userPrompt object).

### AC-07: Conversation history stores _rawCliText which may grow unbounded

- **File:** ai/ai-integration.js:1137-1205 (updateConversationHistory)
- **Function:** updateConversationHistory
- **Expected (v0.9.24):** This method was deleted. The agent-loop.js pipeline managed its own history.
- **Actual (current):** Restored. Stores `response._rawCliText` as the assistant's content in conversation history. The trimConversationHistory method (line 1088) uses compaction and sliding window to manage growth. However, `_rawCliText` can be large (AI responses with extensive reasoning), and the rawTurnsToKeep=3 setting means 6 large messages are always preserved.
- **Impact:** Low severity. The trimming mechanism works. However, combined with the 200K PROMPT_CHAR_LIMIT and the system prompt size (~5-10K), the effective context budget for conversation history is healthy. No regression.
- **Proposed Fix:** No immediate fix needed. Monitor for token budget overruns on complex multi-site tasks where AI responses are verbose.

### AC-08: buildPrompt progressive prompt trimming restored with PROMPT_CHAR_LIMIT=200000

- **File:** ai/ai-integration.js:3471-3543 (progressive trim logic)
- **Function:** buildPrompt (prompt trimming section)
- **Expected (v0.9.24):** PROMPT_CHAR_LIMIT was deleted. No progressive trimming existed.
- **Actual (current):** Restored with PROMPT_CHAR_LIMIT=200000 chars. Three-stage progressive trimming: (1) strip example blocks, (2) reduce element count, (3) strip memory blocks. This is a correctness improvement -- prevents prompt truncation by the API.
- **Impact:** Positive change. No regression -- this is new functionality that prevents API errors from oversized prompts.
- **Proposed Fix:** None needed. This is correctly implemented.

### AC-09: isToolCallResponse fallback for mixed text+tools responses

- **File:** ai/tool-use-adapter.js:226-237
- **Function:** isToolCallResponse (default case for OpenAI/xAI/OpenRouter)
- **Expected (v0.9.24):** Only checked `finish_reason === 'tool_calls'`. If the provider returned `finish_reason: "stop"` with tool_calls in the message body, tool calls were silently dropped.
- **Actual (current):** Added fallback: also checks `response.choices[0].message.tool_calls` array existence when finish_reason is not 'tool_calls'. This catches mixed text+tools responses and truncated responses.
- **Impact:** Positive bugfix. Without this fallback, the agent loop exited at the isToolCallResponse gate (agent-loop.js:1250) whenever a provider returned tool calls with a non-standard finish_reason.
- **Proposed Fix:** None needed. This is a correct improvement. The change is backwards-compatible.

### AC-10: callAPI passes attempt count for progressive timeout but processQueue does not coordinate

- **File:** ai/ai-integration.js:4288-4334 (callAPI), 2250-2449 (processQueue)
- **Function:** callAPI, processQueue
- **Expected (v0.9.24):** callAPI was the direct API call path. processQueue was deleted.
- **Actual (current):** Two paths exist. callAPI is called directly by processQueue with `{ attempt: request.attempt || 0 }`. The `attempt` field is used by UniversalProvider.sendRequest for progressive timeout increase. However, processQueue's own recovery retries (Stage 1, Stage 2) increment attempt by 1 each time, independent of getAutomationActions' retry loop (which has its own attempt counter 0-2).
- **Impact:** Low severity. The attempt counters are independent but serve the same purpose (progressive timeout). In the worst case, a single failed response could trigger: getAutomationActions retry loop (3 attempts) * processQueue recovery (2 stages) = 6 API calls, each with incrementing attempt/timeout. This is acceptable but worth documenting.
- **Proposed Fix:** Document the retry budget clearly. Consider passing a shared attempt counter from getAutomationActions through to processQueue recovery stages to avoid double-counting.

### AC-11: Dead cleanResponse/parseJSONSafely code remains in universal-provider.js

- **File:** ai/universal-provider.js:619-688
- **Function:** cleanResponse, parseJSONSafely, fixTruncatedJSON, fixCommonMalformations, fixJSONStructure, extractJSONFallback
- **Expected (v0.9.24):** These methods were part of the response parsing pipeline. cleanResponse was called by parseResponse.
- **Actual (current):** parseResponse bypasses cleanResponse entirely (line 604-608 comment). The methods remain in the file as unreachable dead code (~70 lines).
- **Impact:** No runtime impact -- the code is never called. However, it is a maintenance hazard. A future developer might re-enable cleanResponse thinking it is needed, which would reintroduce the CLI-mangling regression.
- **Proposed Fix:** Delete cleanResponse, parseJSONSafely, fixTruncatedJSON, fixCommonMalformations, fixJSONStructure, and extractJSONFallback from universal-provider.js. Add a comment at the deletion site explaining why they were removed (CLI format incompatibility).

## Provider Adapter Status

| Provider | Status | Notes |
|----------|--------|-------|
| xAI (Grok) | Working | Default provider. isToolCallResponse fallback fix (AC-09) improves reliability. |
| OpenAI | Working | Shares OpenAI-format adapter with xAI. Same fallback fix applies. |
| Anthropic | Working | Separate adapter path. No changes since v0.9.24. stop_reason check unchanged. |
| Gemini | Working | Separate adapter path. No changes since v0.9.24. functionCall inspection unchanged. |
| OpenRouter | Working | Shares OpenAI-format adapter. Same fallback fix applies. |
| Custom | Working | Shares OpenAI-format adapter. Same fallback fix applies. |

All six provider adapters in tool-use-adapter.js are functional. The only change since v0.9.24 was the isToolCallResponse fallback (AC-09), which improved reliability for all OpenAI-format providers.

## Functions Audited

### ai-integration.js

| Function | Verdict | Notes |
|----------|---------|-------|
| PROMPT_CHAR_LIMIT | RESTORED | Was deleted in v0.9.24, restored in 23c0ad1. Functional. |
| CLI_COMMAND_TABLE | RESTORED | Was deleted in v0.9.24, restored in 23c0ad1. Functional but dual-pipeline concern (AC-04). |
| formatSiteKnowledge() | OK | Unchanged since v0.9.24. |
| sanitizeActions() | OK | Unchanged since v0.9.24. Security filter still blocks dangerous navigate/type actions. |
| TASK_PROMPTS | RESTORED | Was deleted, restored. Contains navigator.userAgent concern (AC-05). |
| HYBRID_CONTINUATION_PROMPT | RESTORED | Was deleted, restored. Functional. |
| BATCH_ACTION_INSTRUCTIONS | RESTORED | Was deleted, restored. Functional. |
| buildSheetsFormattingDirective() | RESTORED | Was deleted, restored. Functional. |
| AIIntegration constructor | OK | Unchanged architecture. Provider creation, queue init, cache init all intact. |
| migrateSettings() | CHANGED-OK | Updated legacy model list to include grok-4-fast. Correct migration. |
| createProvider() | OK | Unchanged since v0.9.24. |
| clearConversationHistory() | OK | Unchanged since v0.9.24. |
| injectFollowUpContext() | OK | Unchanged since v0.9.24. |
| formatChangeInfo() | OK | Unchanged since v0.9.24. |
| buildMinimalUpdate() | RESTORED | Was deleted, restored. Large method (~180 lines). Handles DOM snapshot formatting, element visibility, page state context, completion signals, critical action warnings. Functional. |
| trimConversationHistory() | OK | Compaction logic unchanged. |
| updateConversationHistory() | OK | Stores _rawCliText, manages multi-turn state. Functional. |
| updateSessionMemory() | OK | Structured fact extraction from turns. Unchanged. |
| describeAction() | OK | Action description helper. Unchanged. |
| triggerCompaction() | OK | AI-powered conversation compression. Unchanged. |
| buildMemoryContext() | OK | Memory injection for prompt. Unchanged. |
| _fetchLongTermMemories() | OK | Async memory fetch. Unchanged. |
| _fetchSiteMap() | OK | Async site map fetch. Unchanged. |
| getAutomationActions() | RESTORED | Was deleted, restored. Main entry point. Functional with retry loop, multi-turn detection, domain change handling. |
| processQueue() | RESTORED | Was deleted, restored. CLI parse recovery chain functional (AC-06). |
| decomposeTask() | RESTORED | Was deleted, restored. Task decomposition with explicit separators. Functional. |
| buildPrompt() | RESTORED | Was deleted, restored. Large method (~500 lines). Full/hybrid prompt construction, progressive trimming, multi-site/sheets context injection. Functional. |
| callAPI() | OK | Provider delegation unchanged. Timing tracking added. |
| legacyCallAPI() | OK | Legacy xAI fallback unchanged. |
| extractContent() | OK | Legacy response extraction unchanged. |
| isValidTool() | OK | Tool validation list. Unchanged architecture. |
| _buildTaskGuidance() | RESTORED | Was deleted, restored. Career/site guide guidance. Functional. |
| detectTaskType() | OK | Task type classifier. Unchanged architecture. |
| getToolsDocumentation() | RESTORED | Was deleted, restored. CLI command table injection. Functional. |
| getContentMode() | OK | Content mode selector. Unchanged. |
| formatSemanticContext() | OK | Semantic page context. Unchanged. |
| formatPageContent() | OK | Page content formatter. Unchanged. |
| formatActionHistory() | OK | Action history formatter. Unchanged. |

### tool-use-adapter.js

| Function | Verdict | Notes |
|----------|---------|-------|
| formatToolsForProvider() | OK | No changes since v0.9.24. All 3 adapter paths (Anthropic, Gemini, default) intact. |
| parseToolCalls() | OK | No changes since v0.9.24. JSON.parse pitfall handling intact. |
| formatToolResult() | OK | No changes since v0.9.24. Role mapping (user vs tool) intact. |
| isToolCallResponse() | CHANGED-OK | Added fallback for mixed text+tools (AC-09). Improvement, not regression. |
| formatAssistantMessage() | OK | No changes since v0.9.24. |
| extractUsage() | OK | No changes since v0.9.24. |

### universal-provider.js (response path only)

| Function | Verdict | Notes |
|----------|---------|-------|
| parseResponse() | CHANGED-OK | Now returns raw text (fixed in 1ff5b52, 7ba62d9). Critical fix. |
| cleanResponse() | DEAD CODE | Bypassed. Should be deleted (AC-11). |
| parseJSONSafely() | DEAD CODE | Bypassed. Should be deleted (AC-11). |
| fixTruncatedJSON() | DEAD CODE | Bypassed. Should be deleted. |
| fixCommonMalformations() | DEAD CODE | Bypassed. Should be deleted. |
| fixJSONStructure() | DEAD CODE | Bypassed. Should be deleted. |
| extractJSONFallback() | DEAD CODE | Bypassed. Should be deleted. |
