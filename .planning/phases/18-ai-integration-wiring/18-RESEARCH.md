# Phase 18: AI Integration Wiring - Research

**Researched:** 2026-03-01
**Domain:** Response parsing pipeline swap, conversation history format migration, provider cleaning unification
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Delete the existing 4-strategy JSON parsing pipeline entirely -- no dead code, no feature flag
- Clean up all JSON parsing artifacts (imports, helpers, constants) as part of this phase, not deferred
- When CLI parser fails to parse an AI response, retry by sending the response back to the AI with a "reformat as CLI" instruction
- Cutover is method-by-method (incremental): swap response parsing first, then conversation history format, then provider cleaning -- not all at once
- Store the AI's raw CLI command text as-is in conversation history -- no normalization or reformatting
- Both sides change: user/system messages also adopt CLI-consistent format, not just assistant responses
- Multi-command responses stored as one multi-line entry (single assistant turn), not split into separate entries
- When conversation history is compacted (summarized for token budget), the compaction prompt instructs the summarizer to preserve 1-2 CLI command examples so the AI sees the expected format
- YAML-style encoding for structured data payloads (not inline JSON, not key=value pairs)
- Per-tool YAML schemas: storeJobData and fillSheetData each define their own YAML structure optimized for their use case
- fillSheetData uses cell references as YAML keys (e.g., A1: Engineer, B1: Acme) for spreadsheet-style addressing
- The entire cleaning system MUST be model-agnostic -- no model-specific cleaners or branches
- One universal cleaner with a pipeline of cleaning steps that handles all provider patterns
- The system should be plug-and-play for any model -- adding a new provider should require zero cleaner changes

### Claude's Discretion
- Whether to use indented blocks or delimiter markers for YAML data boundaries
- Cleaning order (before vs after CLI parser), specific stripping patterns for markdown fencing and conversational preambles

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| INTEG-01 | ai-integration.js uses the CLI parser as the sole response parser -- no JSON fallback (CLI-only mode) | Swap processQueue's parsed path and getAutomationActions to call parseCliResponse instead of normalizeResponse/parseResponse. Delete the 4-strategy JSON pipeline (parseResponse, parseCleanJSON, parseWithMarkdownBlocks, parseWithJSONExtraction, parseWithAdvancedCleaning) and normalizeResponse. The CLI parser already produces the compatible output shape (actions, taskComplete, result, situationAnalysis). |
| INTEG-02 | Conversation history stores CLI command exchanges (not JSON) so models don't pattern-match back to JSON | Change updateConversationHistory to store raw CLI text string instead of JSON.stringify(response). The assistant content in conversationHistory becomes the raw AI text (multi-line CLI commands). User messages adopt a CLI-consistent textual format. |
| INTEG-03 | Conversation compaction preserves CLI format when summarizing older turns | Update triggerCompaction's compaction prompt to instruct the summarizer to preserve 1-2 CLI command examples verbatim. The _localExtractiveFallback must also extract CLI commands (not JSON actions). |
| INTEG-04 | Provider-specific response cleaning adapted for CLI output extraction | Replace UniversalProvider.cleanResponse/parseJSONSafely with a model-agnostic text cleaner that strips markdown fences and conversational preamble, then returns raw text for parseCliResponse. The preprocessResponse function in cli-parser.js already handles fences/preamble -- the provider just needs to extract the text string and stop trying to parse it as JSON. |
| INTEG-05 | storeJobData and fillSheetData accept structured data via CLI-compatible encoding | Extend the CLI parser to handle YAML-style multi-line data blocks for storejobdata. Define per-tool YAML schemas. fillSheetData currently takes no AI-provided data args (it reads from session.sheetsData), but the prompt reference should use YAML cell-reference format for future compatibility. |
</phase_requirements>

## Summary

Phase 18 wires the CLI parser (built in Phase 15) into ai-integration.js as the sole response parser, replacing the existing 4-strategy JSON parsing pipeline. This is the critical integration phase that completes the v10.0 protocol swap from JSON to CLI.

The codebase has three response parsing paths that must all be addressed:
1. **Universal provider path** (primary): `callAPI -> provider.parseResponse -> cleanResponse/parseJSONSafely -> JSON.parse -> normalizeResponse`. This is the main path for all modern providers (xAI, OpenAI, Anthropic, Gemini).
2. **Legacy xAI path** (fallback): `legacyCallAPI -> extractContent -> (string) -> processQueue -> parseResponse (4-strategy JSON pipeline)`. This is the backward-compat path for direct xAI calls.
3. **Queue processing path**: `processQueue` dispatches to either path based on whether `this.provider` exists and whether the response is an object or string.

The swap is incremental per the user's decision: (1) swap parsing first, (2) then conversation history format, (3) then provider cleaning. However, since the provider's `parseResponse` currently JSON.parses the response text and returns a parsed object, the provider cleaning and response parsing are tightly coupled -- the provider must stop JSON-parsing and instead return raw text for the CLI parser.

**Primary recommendation:** Modify `UniversalProvider.parseResponse` to return `content` as a raw string (not JSON-parsed), change `callAPI` to pass that raw string through `parseCliResponse` instead of `normalizeResponse`, delete the entire JSON parsing pipeline, and update conversation history to store raw CLI text.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| cli-parser.js (self) | Phase 15 | CLI response parsing | Already built, produces {actions, taskComplete, result, situationAnalysis} shape compatible with downstream consumers |
| ai-integration.js (self) | v9.0.2 | AI communication orchestration | Main file being modified -- contains the response pipeline, conversation history, and prompt building |
| universal-provider.js (self) | v9.0.2 | Multi-provider API abstraction | Contains parseResponse and cleanResponse that must stop JSON-parsing |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| ai-providers.js (self) | v9.0.2 | Provider subclasses (XAIProvider, GeminiProvider) | No changes needed -- they inherit from UniversalProvider |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| YAML-style encoding for data | Inline JSON in CLI args | User decided YAML -- JSON is already used by storejobdata via `type: 'json'` in COMMAND_REGISTRY, but YAML is the locked decision |
| Universal text cleaner in provider | Separate cleaner module | Simpler to modify the existing cleanResponse method in-place; no new file needed |

## Architecture Patterns

### Response Flow: Before (JSON) vs After (CLI)

**Before (current):**
```
AI text -> UniversalProvider.parseResponse
  -> extract text from provider format (Gemini/Anthropic/OpenAI)
  -> cleanResponse -> parseJSONSafely (fix JSON malformations)
  -> JSON.parse -> return {content: parsedJSON, usage}
-> callAPI returns parsedJSON object
-> processQueue: normalizeResponse(parsedJSON) -> {actions, taskComplete, ...}
-> getAutomationActions: isValidResponse -> return to background.js
```

**After (CLI):**
```
AI text -> UniversalProvider.parseResponse
  -> extract text from provider format (Gemini/Anthropic/OpenAI)
  -> return {content: rawTextString, usage}
-> callAPI returns rawTextString
-> processQueue: parseCliResponse(rawTextString) -> {actions, taskComplete, ...}
-> getAutomationActions: isValidResponse -> return to background.js
```

### Pattern 1: Provider Returns Raw Text
**What:** UniversalProvider.parseResponse extracts the text content from the HTTP response but does NOT parse it as JSON. Returns raw string.
**When to use:** Always -- this is the new default behavior.
**Why:** The CLI parser (parseCliResponse) handles all response cleaning internally via preprocessResponse. The provider doesn't need to understand the response format.

```javascript
// In UniversalProvider.parseResponse:
// Before: content = this.cleanResponse(content); parsedContent = JSON.parse(content);
// After:
return {
  content: content, // raw text string, NOT JSON-parsed
  usage,
  model: response.model || this.model
};
```

### Pattern 2: CLI Parser as Single Entry Point
**What:** All response parsing goes through parseCliResponse(). No fallback to JSON parsing.
**When to use:** Every AI response in processQueue and getAutomationActions.

```javascript
// In processQueue:
// Before:
//   if (this.provider && typeof response === 'object') {
//     parsed = this.normalizeResponse(response);
//   } else {
//     parsed = this.parseResponse(response);
//   }
// After:
const rawText = typeof response === 'string' ? response : response;
parsed = parseCliResponse(rawText);
```

### Pattern 3: Conversation History Stores Raw CLI Text
**What:** Assistant messages in conversationHistory store the raw AI text (CLI commands), not JSON.stringify'd objects.
**When to use:** In updateConversationHistory.

```javascript
// Before:
const responseContent = typeof response === 'string'
  ? response
  : JSON.stringify(response);

// After:
// response is already a raw CLI text string from the provider
const responseContent = response;
```

### Pattern 4: CLI-Aware Retry on Parse Failure
**What:** When parseCliResponse returns zero actions and zero errors (completely unparseable), retry by sending the raw response back to the AI with a "reformat as CLI" instruction.
**When to use:** Only when parsing produces no valid output (not when individual lines fail -- CLI-06 error isolation handles that).

```javascript
// Pseudo-code for retry:
const parsed = parseCliResponse(rawText);
if (parsed.actions.length === 0 && !parsed.taskComplete && !parsed.taskFailed) {
  // No valid commands found -- ask AI to reformat
  const reformatPrompt = {
    messages: [
      ...this.conversationHistory,
      { role: 'user', content: `Your response was not in CLI command format. Reformat your intended actions as CLI commands:\n\nYour response was:\n${rawText.substring(0, 500)}\n\nOutput CLI commands only (one per line, # for reasoning).` }
    ]
  };
  // Retry with reformatPrompt...
}
```

### Pattern 5: YAML Data Block Encoding for storeJobData
**What:** storeJobData accepts a multi-line YAML-style block instead of inline JSON.
**When to use:** When the AI needs to pass structured job data.

```
storejobdata
  company: Google
  jobs:
    - title: Software Engineer
      location: Mountain View, CA
      datePosted: 2026-02-28
      applyLink: https://careers.google.com/jobs/123
    - title: Product Manager
      location: New York, NY
      datePosted: 2026-02-27
      applyLink: https://careers.google.com/jobs/456
```

### Pattern 6: Compaction Preserves CLI Format
**What:** The compaction prompt includes an instruction to preserve 1-2 verbatim CLI command examples.
**When to use:** In triggerCompaction's compaction prompt.

```javascript
const compactionPrompt = {
  messages: [
    {
      role: 'system',
      content: 'You are a context compactor. Summarize the following browser automation conversation turns into a concise context block. Preserve: actions taken, results observed, pages visited, errors encountered, and current progress. IMPORTANT: Include 1-2 verbatim CLI command examples from the conversation (e.g., "click e5", "type e12 \\"hello\\"") so the AI maintains format compliance. Output ONLY the summary, no preamble.'
    },
    // ...
  ]
};
```

### Anti-Patterns to Avoid
- **Dual parser:** Do NOT keep JSON parsing as a fallback "just in case." The user decision is explicit: CLI-only, no JSON fallback.
- **JSON.stringify in history:** Do NOT serialize the parsed CLI result back to JSON for conversation history. Store raw CLI text.
- **Model-specific cleaners:** Do NOT add provider-specific branches in the cleaner. The preprocessResponse in cli-parser.js already handles all known patterns (code fences, preamble, trailing text) generically.
- **Splitting multi-command responses:** Do NOT split a multi-line CLI response into separate conversation history entries. One AI turn = one multi-line string.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CLI response parsing | New parser | parseCliResponse from cli-parser.js (Phase 15) | Already built, tested with 25 assertions, handles all edge cases |
| Code fence stripping | New regex in provider | preprocessResponse in cli-parser.js | Already strips ```bash, ```shell, ```text, ```cli, bare ``` |
| Preamble/trailing text removal | Provider-specific cleaners | preprocessResponse in cli-parser.js | Uses COMMAND_REGISTRY lookups to find command boundaries |
| YAML parsing | External YAML library | Simple hand-written indentation parser | Project rule: no new dependencies. YAML-style blocks are simple indented text -- the schema is known at compile time |

**Key insight:** The CLI parser already has a preprocessResponse function that handles ALL the provider-specific cleaning that the current system distributes across UniversalProvider.cleanResponse, parseJSONSafely, fixTruncatedJSON, fixCommonMalformations, and fixJSONStructure. The entire complex JSON cleaning pipeline in universal-provider.js (200+ lines) becomes unnecessary.

## Common Pitfalls

### Pitfall 1: Provider parseResponse Still JSON-Parses
**What goes wrong:** If UniversalProvider.parseResponse continues to JSON.parse the content, it will throw on CLI text (which is not JSON), and the error path will try to return a fallback JSON.
**Why it happens:** The current parseResponse has a try/catch around JSON.parse that returns an error fallback -- this "swallows" CLI text and returns garbage.
**How to avoid:** Modify parseResponse to return raw text string. Remove the JSON.parse call entirely. The CLI parser handles parsing.
**Warning signs:** Tests show "Invalid JSON from [provider]" errors. Actions array is always empty.

### Pitfall 2: processQueue Dispatches Differently for Object vs String
**What goes wrong:** processQueue currently branches on `typeof response === 'object'` to choose between normalizeResponse (for provider path) and parseResponse (for legacy path). After the change, the provider returns a string, which would hit the wrong branch.
**Why it happens:** The `typeof response` check was designed for the JSON-parsed object path.
**How to avoid:** Remove the branching entirely. Always call parseCliResponse regardless of response type. If the response is somehow an object (shouldn't happen), convert to string first.
**Warning signs:** Actions array is empty despite AI responding correctly.

### Pitfall 3: Conversation History Breaks Multi-Turn Context
**What goes wrong:** If assistant messages in history change format but user messages don't, the AI sees inconsistent format and may revert to JSON.
**Why it happens:** User decision says "both sides change" but the user-side messages (DOM state updates, buildMinimalUpdate) might still look like structured data that pattern-matches to JSON.
**How to avoid:** Ensure user messages (buildMinimalUpdate, buildPrompt userPrompt) use plain text format consistent with CLI. They already do (Phase 17 rewrote prompts to CLI), but verify no JSON examples remain in user-side messages.
**Warning signs:** AI starts responding with JSON after a few turns.

### Pitfall 4: isValidResponse Validation Rejects CLI Parser Output
**What goes wrong:** The isValidResponse function validates action.tool against isValidTool, which uses camelCase tool names (e.g., 'clickSearchResult'). The CLI parser maps from lowercase verbs to camelCase tools correctly, but if any mapping is wrong, valid CLI commands get rejected.
**Why it happens:** isValidTool has a hardcoded list that might not include all tools the CLI parser maps to.
**How to avoid:** Verify that every tool name in COMMAND_REGISTRY's tool values exists in isValidTool's list. Cross-reference the two lists.
**Warning signs:** isValidResponse returns false even though parseCliResponse produced valid actions.

### Pitfall 5: Compaction Prompt Returns JSON Instead of CLI
**What goes wrong:** The compaction summarizer AI call uses the same provider. If the compaction prompt doesn't explicitly request CLI-format preservation, the summarizer might return JSON or prose that confuses the main AI.
**Why it happens:** The compaction prompt is a separate AI call with its own system message. It doesn't inherit the main session's CLI instructions.
**How to avoid:** Add explicit instruction to include verbatim CLI examples in the compaction output.
**Warning signs:** After compaction, the AI switches back to JSON format.

### Pitfall 6: storeJobData YAML Block Parsing Edge Cases
**What goes wrong:** The YAML-style block for storeJobData must handle multi-line values, colons in URLs, special characters in job titles, and indentation inconsistencies.
**Why it happens:** AI models generate inconsistent indentation. Job data contains URLs with colons, titles with special characters.
**How to avoid:** Parse YAML blocks with a simple state machine that: (1) detects block boundaries by indentation level, (2) handles multi-line values by continuation indent, (3) treats URLs as opaque strings (don't split on colons inside quoted values).
**Warning signs:** storeJobData receives partial or malformed data. URLs get truncated at the colon.

### Pitfall 7: importScripts Order for cli-parser.js
**What goes wrong:** If cli-parser.js is not imported before ai-integration.js, the parseCliResponse function won't be available.
**Why it happens:** cli-parser.js is a new module not yet in the background.js import chain.
**How to avoid:** Add `importScripts('ai/cli-parser.js')` in background.js BEFORE the `importScripts('ai/ai-integration.js')` line.
**Warning signs:** ReferenceError: parseCliResponse is not defined.

### Pitfall 8: enhancePromptForRetry Still References JSON
**What goes wrong:** The current enhancePromptForRetry function (lines 4477-4494) uses JSON-specific retry instructions. If not updated, it will tell the AI to output JSON on retry, contradicting the CLI format.
**Why it happens:** Phase 17 intentionally left this code alone (noted in 17-01 summary: "Response parsing/retry code intentionally NOT modified -- Phase 18 scope").
**How to avoid:** Rewrite enhancePromptForRetry to use CLI format reinforcement. Replace JSON instructions with CLI syntax reminders.
**Warning signs:** After a retry, AI responds in JSON instead of CLI.

### Pitfall 9: getModelSpecificInstructions Returns JSON Instructions
**What goes wrong:** getModelSpecificInstructions (line 4354) returns provider-specific instructions telling the AI to respond with "raw JSON only." This directly contradicts CLI format.
**Why it happens:** This function was not updated in Phase 17 (parsing pipeline code, not first-response prompts).
**How to avoid:** Either remove getModelSpecificInstructions entirely (since the system is now model-agnostic) or rewrite it to reinforce CLI format for all providers.
**Warning signs:** AI responds in JSON for Gemini/OpenAI/Anthropic providers.

### Pitfall 10: createFallbackResponse Returns JSON Object Shape
**What goes wrong:** createFallbackResponse (line 4499) returns a plain JavaScript object with actions:[], taskComplete:false. After the swap, this needs to match what parseCliResponse would return (same shape but with reasoning:[], errors:[], etc.).
**Why it happens:** The fallback bypasses the parser entirely.
**How to avoid:** Update createFallbackResponse to include all fields that parseCliResponse returns (reasoning, errors, taskFailed, confidence, etc.).
**Warning signs:** Missing fields cause downstream crashes in background.js when accessing taskFailed or errors.

## Code Examples

### Example 1: Modified UniversalProvider.parseResponse (returns raw text)

```javascript
parseResponse(response) {
  let content, usage;

  switch (this.provider) {
    case 'gemini':
      if (!response.candidates || response.candidates.length === 0) {
        throw new Error('No response from Gemini API');
      }
      content = response.candidates[0].content.parts[0].text;
      usage = { /* ... same as current ... */ };
      break;

    case 'anthropic':
      content = response.content[0].text;
      usage = { /* ... same as current ... */ };
      break;

    default:
      // OpenAI-compatible format (including xAI)
      if (!response.choices || response.choices.length === 0) {
        throw new Error(`No response from ${this.provider} API`);
      }
      content = response.choices[0].message.content;
      usage = { /* ... same as current ... */ };
  }

  // Return raw text -- CLI parser handles cleaning and parsing
  return {
    content: content, // raw string, NOT JSON-parsed
    usage,
    model: response.model || this.model
  };
}
```

### Example 2: Modified processQueue Parsing Path

```javascript
// In processQueue:
try {
  const response = await this.callAPI(request.prompt, { attempt: request.attempt || 0 });

  // CLI-only parsing -- no JSON fallback
  const rawText = typeof response === 'string' ? response : String(response);
  let parsed = parseCliResponse(rawText);

  // If no valid commands found, retry with reformat instruction
  if (parsed.actions.length === 0 && !parsed.taskComplete && !parsed.taskFailed && !parsed.helpRequested) {
    // CLI-format retry (INTEG-01 requirement)
    parsed = await this._retryWithCLIReformat(rawText, request);
  }

  // Store raw text for conversation history (INTEG-02)
  parsed._rawCliText = rawText;

  this.setCachedResponse(request.cacheKey, parsed);
  request.resolve(parsed);
}
```

### Example 3: Modified updateConversationHistory

```javascript
updateConversationHistory(prompt, response, isFirstIteration) {
  // response now has _rawCliText from processQueue
  const responseContent = response._rawCliText || '';

  if (isFirstIteration) {
    if (prompt.systemPrompt && prompt.userPrompt) {
      this.conversationHistory = [
        { role: 'system', content: prompt.systemPrompt },
        { role: 'user', content: prompt.userPrompt },
        { role: 'assistant', content: responseContent }
      ];
    } else if (prompt.messages) {
      this.conversationHistory = [
        ...prompt.messages,
        { role: 'assistant', content: responseContent }
      ];
    }
  } else {
    // Append user + assistant (raw CLI text)
    if (prompt.messages && prompt.messages.length > 0) {
      const lastUserMsg = prompt.messages[prompt.messages.length - 1];
      if (lastUserMsg.role === 'user') {
        this.conversationHistory.push(lastUserMsg);
      }
    }
    this.conversationHistory.push({ role: 'assistant', content: responseContent });
  }
  // ...rest of method
}
```

### Example 4: YAML Block Parsing for storeJobData

```javascript
// Input format the AI produces:
// storejobdata
//   company: Google
//   jobs:
//     - title: Software Engineer
//       location: Mountain View, CA
//       applyLink: https://careers.google.com/jobs/123

// The CLI parser sees 'storejobdata' as the verb.
// Remaining lines (indented) form the YAML data block.
// A simple parser converts this to:
// { company: 'Google', jobs: [{ title: '...', location: '...', applyLink: '...' }] }
```

### Example 5: Compaction Prompt with CLI Preservation

```javascript
const compactionSystemPrompt = `You are a context compactor. Summarize the following browser automation conversation turns into a concise context block.

Preserve:
- Actions taken with element details and outcomes
- Pages visited with URLs
- Errors encountered and recovery steps
- Current progress toward the task

CRITICAL: Include 1-2 VERBATIM CLI command examples from the conversation to maintain format consistency. For example:
# Navigated to search page
click e5
type e12 "software engineer"

Output ONLY the summary, no preamble.`;
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| JSON tool calls with parsing strategies | CLI line-based commands | Phase 15-18 (v10.0) | Eliminates 200+ lines of JSON fixup code, reduces format compliance failures |
| Provider-specific response cleaning (parseJSONSafely, fixTruncatedJSON, fixCommonMalformations, fixJSONStructure) | preprocessResponse in cli-parser.js (model-agnostic) | This phase | Removes ~250 lines from universal-provider.js, single cleaning path for all providers |
| JSON.stringify for conversation history | Raw CLI text storage | This phase | Models see CLI format in history, reducing format drift to JSON |

**Deprecated/outdated after this phase:**
- `parseResponse()` (4-strategy JSON parsing pipeline) -- deleted
- `parseCleanJSON()` -- deleted
- `parseWithMarkdownBlocks()` -- deleted
- `parseWithJSONExtraction()` -- deleted
- `parseWithAdvancedCleaning()` -- deleted
- `normalizeResponse()` -- deleted (security sanitization moved to new location)
- `cleanResponse()` in UniversalProvider -- gutted (returns raw text)
- `parseJSONSafely()` in UniversalProvider -- deleted
- `fixTruncatedJSON()` in UniversalProvider -- deleted
- `fixCommonMalformations()` in UniversalProvider -- deleted
- `fixJSONStructure()` in UniversalProvider -- deleted
- `extractJSONFallback()` in UniversalProvider -- deleted
- `getModelSpecificInstructions()` -- deleted or replaced with CLI format reinforcement

## Critical: Security Sanitization Must Be Preserved

The current `normalizeResponse()` contains action sanitization logic (lines 3990-4018) that blocks:
- `navigate` actions with `data:` or `javascript:` URIs
- `type` actions containing `<script`, `javascript:`, or `onerror=`

This security logic is NOT in the CLI parser. It MUST be moved to a new location -- either a standalone `sanitizeActions()` function called after parseCliResponse, or integrated into the processQueue/getAutomationActions flow. **Do NOT delete this without relocating it.**

## Files That Will Change

| File | Changes | Estimated LOC |
|------|---------|---------------|
| `ai/ai-integration.js` | Delete JSON pipeline (~120 lines), rewrite processQueue parsing, rewrite updateConversationHistory, update triggerCompaction prompt, update enhancePromptForRetry, update createFallbackResponse, delete getModelSpecificInstructions, add sanitizeActions, add CLI reformat retry | ~200 lines net reduction |
| `ai/universal-provider.js` | Gut parseResponse to return raw text, delete cleanResponse/parseJSONSafely/fixTruncatedJSON/fixCommonMalformations/fixJSONStructure/extractJSONFallback (~250 lines) | ~250 lines net reduction |
| `ai/cli-parser.js` | Add YAML block parsing for storejobdata, extend mapCommand for YAML data type | ~60 lines added |
| `background.js` | Add `importScripts('ai/cli-parser.js')` before ai-integration.js import | 1 line |

## Incremental Cutover Order

Per user decision, the cutover is method-by-method:

**Step 1: Swap response parsing**
- Modify UniversalProvider.parseResponse to return raw text
- Modify callAPI to not assume parsed.content is an object
- Modify processQueue to call parseCliResponse instead of normalizeResponse/parseResponse
- Move security sanitization out of normalizeResponse into standalone function
- Add CLI reformat retry logic
- Delete: parseResponse, parseCleanJSON, parseWithMarkdownBlocks, parseWithJSONExtraction, parseWithAdvancedCleaning, normalizeResponse
- Delete: cleanResponse, parseJSONSafely, fixTruncatedJSON, fixCommonMalformations, fixJSONStructure, extractJSONFallback from UniversalProvider
- Update: isValidResponse to work with parseCliResponse output shape
- Update: enhancePromptForRetry for CLI format
- Update: createFallbackResponse for CLI parser output shape
- Delete: getModelSpecificInstructions (model-agnostic now)

**Step 2: Swap conversation history format**
- Modify updateConversationHistory to store raw CLI text
- Update buildMemoryContext if it references JSON-format history
- Update _localExtractiveFallback to extract CLI commands instead of JSON actions

**Step 3: Update compaction and data encoding**
- Update triggerCompaction's compaction prompt for CLI preservation
- Add YAML block parsing for storeJobData to cli-parser.js
- Update CLI_COMMAND_TABLE entry for storejobdata to show YAML format
- Add importScripts for cli-parser.js in background.js

## Downstream Consumer Compatibility

The background.js automation loop consumes the response object as:
- `aiResponse.taskComplete` -- boolean
- `aiResponse.actions` -- array of {tool, params}
- `aiResponse.batchActions` -- array of {tool, params} (optional)
- `aiResponse.result` -- string
- `aiResponse.reasoning` -- string (logged only)
- `aiResponse.taskFailed` -- boolean (for fail signal)

The parseCliResponse output provides all of these:
- `taskComplete` -- boolean (from done/fail signal)
- `actions` -- array of {tool, params} (from command lines)
- `result` -- string (from done/fail message)
- `reasoning` -- array of strings (from # comments, joined for situationAnalysis)
- `taskFailed` -- boolean (from fail signal)

The only gap is `batchActions` -- the CLI parser treats all commands in one response as a sequential batch in `actions[]`. The old `batchActions` field was used when the AI explicitly declared a batch of same-page actions. In CLI format, every multi-line response IS a batch. The background.js code that checks `aiResponse.batchActions` should either check `aiResponse.actions` when there are multiple, or the batchActions concept maps directly to having multiple actions in the parsed result.

## Open Questions

1. **batchActions mapping**
   - What we know: background.js has logic for batchActions vs actions (lines 9027-9064). CLI parser puts all commands in actions[].
   - What's unclear: Should we set batchActions = actions when actions.length > 1 for compatibility, or update background.js to handle multi-action arrays directly?
   - Recommendation: Set `parsed.batchActions = parsed.actions.length > 1 ? parsed.actions : undefined` as a compatibility shim in processQueue. This preserves background.js behavior without modifying it.

2. **YAML block boundary detection**
   - What we know: User decided YAML-style, Claude's discretion on delimiters.
   - What's unclear: How does the tokenizer know where the YAML block starts and ends in a multi-line CLI response?
   - Recommendation: Use indentation-based detection. The storejobdata line has no arguments; all subsequent lines indented by 2+ spaces are part of the YAML block, until a non-indented line (or end of response) is reached. This is natural and doesn't require explicit delimiters.

3. **fillSheetData cell-reference YAML format**
   - What we know: fillSheetData currently takes no AI-provided data -- it reads from session.sheetsData which was populated by storeJobData + the Sheets orchestrator.
   - What's unclear: Is INTEG-05's fillSheetData requirement about changing the data flow, or just about how the prompt documents the command?
   - Recommendation: For this phase, update the CLI_COMMAND_TABLE to show the cell-reference YAML format as documentation. The actual data flow (session.sheetsData) can remain unchanged since fillSheetData doesn't accept inline data from the AI. If future phases need cell-by-cell AI control, the YAML parser is ready.

## Sources

### Primary (HIGH confidence)
- `/Users/lakshmanturlapati/Documents/Codes/Extensions/FSB/ai/ai-integration.js` -- direct codebase inspection of all parsing paths, conversation history, compaction logic
- `/Users/lakshmanturlapati/Documents/Codes/Extensions/FSB/ai/cli-parser.js` -- parseCliResponse output shape, preprocessResponse cleaning, COMMAND_REGISTRY
- `/Users/lakshmanturlapati/Documents/Codes/Extensions/FSB/ai/universal-provider.js` -- parseResponse, cleanResponse, parseJSONSafely, JSON fixup pipeline
- `/Users/lakshmanturlapati/Documents/Codes/Extensions/FSB/background.js` -- action dispatch, batchActions handling, importScripts chain, handleBackgroundAction for storeJobData/fillSheetData
- Phase 15 summaries (15-01, 15-02) -- CLI parser architecture and compatibility stubs
- Phase 16 summaries (16-01, 16-02) -- YAML snapshot wiring
- Phase 17 summaries (17-01, 17-02) -- prompt rewrite decisions, intentionally deferred parsing code

### Secondary (MEDIUM confidence)
- Phase 18 CONTEXT.md -- user decisions on YAML encoding, model-agnostic cleaning, incremental cutover

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - direct codebase inspection, no external dependencies
- Architecture: HIGH - response flow traced end-to-end through actual code
- Pitfalls: HIGH - identified through code analysis of specific method interactions
- YAML encoding: MEDIUM - user decision is clear but implementation details (block boundaries, edge cases) need validation during planning

**Research date:** 2026-03-01
**Valid until:** 2026-03-31 (stable -- no external dependencies, all internal code)
