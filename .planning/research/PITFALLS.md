# Domain Pitfalls: JSON-to-CLI Protocol Migration for LLM Browser Automation

**Domain:** Migrating FSB's AI-to-extension communication from JSON tool calls to CLI-style commands with YAML DOM snapshots
**Researched:** 2026-02-27
**Confidence:** HIGH (based on codebase analysis of 11K+ line background.js, 5K+ line ai-integration.js, 30+ tools, 43+ site guides, 4 AI providers; corroborated by Playwright CLI, agent-browser, and webctl project documentation; academic research on LLM output format accuracy)

---

## Critical Pitfalls

Mistakes that cause automation failures, data loss, or require reverting the migration.

---

### Pitfall 1: Multi-Provider CLI Generation Quality Divergence

**What goes wrong:**
The AI is instructed to output CLI commands (e.g., `click e5`, `type e12 "search query"`) but different providers generate CLI text with vastly different quality. Gemini wraps output in markdown code blocks. Grok adds conversational preamble ("Sure, I'll click that button for you..."). Claude sometimes generates well-formed CLI but reverts to JSON when confused. GPT-4o invents non-existent flags. The current system already has provider-specific cleaning for JSON (`getModelSpecificInstructions()` at line 4466 of ai-integration.js), but CLI text has a different surface area of failure modes than JSON. A model that generates perfect JSON may generate broken CLI.

**Why it happens:**
LLMs are trained on massive corpora of JSON API calls, structured tool definitions, and function-calling examples. CLI commands are also well-represented in training data but as *shell commands* (bash, powershell), not as custom domain-specific CLI protocols. When FSB defines a custom CLI grammar (e.g., `type e12 "hello" --enter`), the model has no prior exposure to this exact syntax. It must follow the prompt's grammar specification, which is a weaker signal than native function-calling APIs. Research shows models generate 70-80% accurate structured output without constrained decoding, and the 20-30% failure rate compounds across multi-step sessions.

Furthermore, FSB currently supports 4 providers (xAI, OpenAI, Anthropic, Gemini) with different strengths:
- **xAI Grok 4.1 Fast** (primary): Strong instruction following, but prone to conversational preamble
- **OpenAI GPT-4o**: Good structured output, but may invent flags/options not in the spec
- **Anthropic Claude**: Excellent at following format specifications, but may fall back to JSON when the conversation history contains JSON examples
- **Gemini 2.5 Flash**: Aggressive markdown wrapping (`\`\`\`bash\n...\n\`\`\``), sometimes adds explanatory comments inline

**Consequences:**
- CLI parser receives unparseable input and the automation stalls
- Provider that worked fine with JSON now fails with CLI, breaking existing user setups
- Different failure modes per provider make debugging unpredictable
- Users switching providers during migration period encounter different bugs

**Prevention:**
1. Build a CLI parser that is at least as tolerant as the current 5-strategy JSON parser (lines 3960-4081 of ai-integration.js). Specifically: strip markdown code blocks, strip conversational text before/after commands, handle extra whitespace and newlines
2. Run a provider compatibility matrix test BEFORE shipping: send the same DOM snapshot and task to all 4 providers and compare CLI output quality. Document which providers need extra cleaning
3. Keep provider-specific instructions (`getModelSpecificInstructions()`) and add CLI-specific variants: tell Gemini "Output raw commands, no markdown blocks"; tell Grok "No conversational text, just commands"
4. Add a "CLI format validation" step that checks each parsed command against the known command vocabulary before dispatch. Log and report commands that parse but reference non-existent tools
5. Consider keeping JSON as a fallback mode configurable per-provider if a provider proves unreliable with CLI

**Detection:**
- Automation logger shows parse failures clustering on specific providers
- `getModelSpecificInstructions()` needs frequent updates for CLI format
- Users report "works with Grok but not Gemini" type bugs

**Phase to address:**
CLI Parser Implementation phase -- must include multi-provider test suite as acceptance criteria

---

### Pitfall 2: Conversation History Format Mismatch During Migration

**What goes wrong:**
FSB maintains conversation history across iterations (line 588 of ai-integration.js: `this.conversationHistory = []`). During migration, the conversation history contains old JSON-format assistant responses mixed with new CLI-format prompts. The AI sees its previous responses in JSON format and reverts to JSON output for consistency. This is not a hypothetical risk -- it is a known behavior of instruction-following models that pattern-match on their own conversation history. The model sees `{"tool": "click", "params": {"ref": "e5"}}` in its history and generates the same format, ignoring the system prompt that now says "output CLI commands."

**Why it happens:**
LLMs use in-context learning. The conversation history IS the strongest signal for output format. If 5 of the last 6 assistant messages contain JSON, the model will generate JSON for the 7th message regardless of what the system prompt says. The current system manages conversation history with trimming (lines 1000-1095 of ai-integration.js) but does not transform the FORMAT of retained messages.

This is particularly dangerous during:
- **Incremental rollout:** Some iterations use CLI, others use JSON (dual mode)
- **Stuck recovery:** When isStuck triggers a FULL system prompt (line 2203), but the history still contains JSON assistant messages from before the CLI switch
- **Domain changes:** When `isDomainChanged` triggers a full prompt, mixing format contexts

**Consequences:**
- AI reverts to JSON mid-session, breaking the CLI parser
- Automation stalls because the CLI parser cannot handle JSON responses
- The JSON fallback parser (if kept) handles it, but the response is dispatched through the wrong pipeline
- Session logs become a mix of CLI and JSON actions, making debugging difficult

**Prevention:**
1. When switching to CLI format, CLEAR the conversation history entirely or transform all retained assistant messages to CLI format. This is the single most important migration step
2. If maintaining history across the switch, rewrite previous assistant messages: convert `{"tool": "click", "params": {"ref": "e5"}}` to `click e5` in the history before the next API call
3. Add a format consistency check: if the system prompt says "output CLI commands" but the last 3 assistant messages in history are JSON, log a WARNING and either clear history or transform it
4. During the migration period, consider starting each automation session with a fresh conversation history (no carried-over JSON context). This sacrifices multi-turn memory for format consistency
5. The `MINIMAL_CONTINUATION_PROMPT` (used for continuation iterations, line 2422) must also be rewritten for CLI format -- if the full prompt is CLI but the continuation prompt still expects JSON, the format will oscillate

**Detection:**
- Parse failures that alternate between "valid CLI" and "valid JSON" within the same session
- Automation logger shows `parseCleanJSON` succeeding on responses that should be CLI
- Session action history contains a mix of `{tool, params}` objects and CLI command strings

**Phase to address:**
Prompt Architecture Redesign phase -- conversation history migration must be designed alongside the new prompt format, not as an afterthought

---

### Pitfall 3: CLI Parsing of Quoted Strings, Special Characters, and Multi-Line Values

**What goes wrong:**
The `type` command requires text values that may contain quotes, newlines, special characters, URLs, and code snippets. In JSON format, these are escaped naturally (`\"`, `\\n`). In CLI format, quoting rules are ambiguous and model-dependent. Examples of problematic inputs:

- `type e12 "He said "hello" to me"` -- nested quotes break parsing
- `type e12 "line1\nline2\nline3"` -- newlines in type text for code editors
- `type e12 "https://example.com/path?q=test&page=2"` -- URLs with special chars
- `type e12 "=HYPERLINK("https://...", "Apply")"` -- Google Sheets formulas with nested quotes and parens
- `type e12 "O'Brien & Associates"` -- apostrophes and ampersands
- `type e12 "Price: $29.99 (20% off)"` -- currency, percentage, parentheses
- `storeJobData --company "Johnson & Johnson" --jobs [...]` -- complex data in CLI

The current JSON format handles all of these naturally because JSON has a well-defined escaping spec. CLI has no universal escaping standard.

**Why it happens:**
CLI parsing is fundamentally more ambiguous than JSON parsing:
- No universal spec for quoting (single vs double quotes, backslash escaping vs doubling)
- Different shells handle quotes differently (POSIX vs Windows)
- LLMs generate CLI based on whatever shell syntax they've seen most in training (usually bash)
- The FSB CLI parser is a CUSTOM protocol, not a real shell -- it must define its own quoting rules
- The LLM may not consistently follow the custom quoting rules, especially for edge cases

Agent-browser's SKILL.md shows they use `fill @e2 "text"` with double quotes but their documentation does not address nested quotes or special characters, suggesting they treat it as a simple case.

**Consequences:**
- `type` command receives truncated or malformed text
- Data entered into forms or spreadsheets is corrupted (missing quotes, broken URLs)
- Google Sheets HYPERLINK formulas fail because of quote stripping
- Code editor inputs lose newlines and indentation
- The parser extracts wrong command arguments, executing with incorrect parameters

**Prevention:**
1. Define an UNAMBIGUOUS quoting spec for the CLI protocol. Recommended: double-quoted strings with backslash escaping (`\"` for literal quotes, `\\n` for newlines). Document this spec in the system prompt with examples
2. Support heredoc-style multi-line values for complex text:
   ```
   type e12 <<TEXT
   Line 1
   Line 2 with "quotes"
   TEXT
   ```
3. For the `storeJobData` and `fillSheetData` commands that carry complex structured data, DO NOT try to encode them as CLI arguments. Instead, keep these as JSON payloads after a command prefix: `storeJobData {"company": "J&J", "jobs": [...]}`
4. Build a robust tokenizer that handles: escaped quotes within strings, unmatched quotes (auto-close), URLs as bare strings without quotes, single-quote to double-quote normalization
5. Add fuzzy parsing: if strict parsing fails, try treating everything after the element ref as the text value (works for simple `type` commands)
6. Test with the SPECIFIC edge cases from FSB's existing workflows: Google Sheets HYPERLINK formulas, career site URLs, company names with special characters (Johnson & Johnson, AT&T, L'Oreal)

**Detection:**
- Type actions produce truncated text (missing everything after first internal quote)
- Google Sheets HYPERLINK formulas entered incorrectly
- URLs entered into search boxes are truncated at `&` or `?`
- Automation logger shows parse errors on `type` commands specifically

**Phase to address:**
CLI Parser Implementation phase -- the tokenizer/parser is the foundation; if it cannot handle quoted strings, the entire CLI approach fails. Build comprehensive test cases BEFORE implementing commands

---

### Pitfall 4: Batch Actions Lose Sequential Semantics in CLI Format

**What goes wrong:**
The current batch action system uses a JSON array (`batchActions: [{tool, params}, ...]`) that naturally preserves order and groups actions as a single response unit. In CLI format, batch actions become multiple lines of commands. The boundary between "these commands are a batch" and "these are separate sequential commands" becomes ambiguous. The AI may output:

```
click e3
type e5 "John Doe"
type e7 "john@example.com"
click e9
```

Is this a batch (execute all before returning for DOM analysis) or sequential commands (return DOM between each)? The current JSON format distinguishes this via `batchActions` vs `actions` arrays. CLI has no equivalent structural signal.

Additionally, the batch suppression logic for Google Sheets (lines 5931-5963 of background.js) detects `actions.filter(a => a.tool === 'type').length >= 2` on Sheets URLs. In CLI format, the parser must reconstruct the action list before this check can run, and the check must use the same field names.

**Why it happens:**
JSON inherently provides structure (arrays, objects, nesting). CLI is line-oriented and flat. The distinction between "batch" and "sequential" must be encoded explicitly in the CLI protocol, but there is no natural CLI convention for this. Real CLI tools use piping (`|`) or `&&` for chaining, but those have different semantics than FSB's batch concept (sequential with stability checks between each, stop on failure).

**Consequences:**
- All commands treated as batch when they should be sequential (no DOM refresh between actions, stale refs used)
- All commands treated as sequential when they should be batched (unnecessary AI API calls between related actions, slower execution)
- Google Sheets batch suppression fails because the action format changed, leading to concatenated cell values
- The MAX_BATCH_SIZE (8) safety cap is not enforceable without clear batch boundaries
- `executeBatchActions()` function (line 5923 of background.js) receives wrong input format

**Prevention:**
1. Define explicit batch delimiters in the CLI protocol. Recommended approach -- use a `batch:` prefix or block syntax:
   ```
   batch
     type e5 "John Doe"
     type e7 "john@example.com"
     click e9
   end
   ```
2. Alternative: treat all multi-line output as a batch by default (matches agent-browser's command chaining pattern). Single actions are single-line output. This is simpler but less flexible
3. Migrate `executeBatchActions()` to accept parsed CLI commands instead of `{tool, params}` objects. The parser must output a normalized internal format that both single and batch execution paths consume
4. Port the Google Sheets batch suppression check to work with the normalized internal format, not the raw CLI text
5. Test the Sheets batch suppression specifically: ensure `type` actions on Sheets URLs are still detected and suppressed

**Detection:**
- Google Sheets data entry produces concatenated values in single cells
- Automation runs slower than expected (single actions where batches should be used)
- Automation fails with stale refs (batches where sequential was needed)
- Batch result logs show wrong action counts

**Phase to address:**
CLI Protocol Design phase -- batch semantics must be designed into the protocol from day one, not retrofitted

---

### Pitfall 5: Stuck Detection and Action History Break with Format Change

**What goes wrong:**
The stuck detection system (lines 2611-2670 of background.js: `analyzeStuckPatterns()`) relies on action history entries with `action.tool` and `action.params` fields. It creates signatures via `${action.tool}_${JSON.stringify(action.params)}` (line 2627). The smart sequence signature (`createSmartSequenceSignature`, line 9112) also uses `action.tool` and `action.params`. If the action history format changes (CLI string instead of `{tool, params}` object), these systems silently break:

- `analyzeStuckPatterns()` sees `undefined_undefined` for all actions and never detects repetition
- `areClicksNearby()` (line 2678) checks `action.params?.selector` which does not exist in CLI format
- Sequence repetition detection (`sequenceRepeatCount`, line 9116) cannot create meaningful signatures
- The typing-sequence detection (line 8483) checks `action.tool` against an array of tool names

All of these failures are SILENT -- stuck detection stops working without errors, the automation just runs forever without recovery.

**Why it happens:**
Stuck detection was built tightly coupled to the JSON response format. The action history entries are stored as-is from the AI response parsing. If the CLI parser outputs a different structure (e.g., `{command: "click", args: ["e5"]}` instead of `{tool: "click", params: {ref: "e5"}}`), every downstream consumer breaks.

This is a classic "ripple effect" problem: changing the data format at the source propagates breakage through every consumer, and there are many consumers scattered across 11K lines of background.js.

**Consequences:**
- Stuck detection stops working, automation runs to maxIterations on every stuck scenario
- Recovery strategies never trigger, AI continues making the same failing action
- Session analytics report wrong action distributions
- Action recording/replay (ActionRecorder in content/actions.js) breaks if it depends on action format

**Prevention:**
1. Define a CANONICAL internal action format that ALL systems use, regardless of whether the AI outputs JSON or CLI. The CLI parser and JSON parser both produce the same internal format:
   ```javascript
   { tool: "click", params: { ref: "e5" } }  // canonical format
   ```
2. The CLI parser's output MUST match this canonical format exactly. Do NOT create a new format like `{command, args}` -- normalize to `{tool, params}` so all downstream consumers work unchanged
3. Write a mapping layer that converts CLI commands to canonical format:
   - `click e5` -> `{tool: "click", params: {ref: "e5"}}`
   - `type e12 "hello" --enter` -> `{tool: "type", params: {ref: "e12", text: "hello", pressEnter: true}}`
   - `navigate "https://..."` -> `{tool: "navigate", params: {url: "https://..."}}`
4. Add unit tests that verify the canonical format for every CLI command variant. These tests are the migration safety net
5. Audit ALL consumers of `action.tool` and `action.params` in background.js. There are 30+ references -- each one must work with the canonical format

**Detection:**
- Session logs show stuckCounter staying at 0 even when the automation is obviously stuck
- maxIterations reached on tasks that previously resolved via stuck recovery
- `analyzeStuckPatterns()` returns `severity: 'low'` for clearly repetitive action sequences

**Phase to address:**
Action Dispatch Rewrite phase -- define canonical format first, build parser to produce it, then verify all consumers. This is the highest-risk migration step

---

### Pitfall 6: Site Guides and Workflow Arrays Reference JSON Tool Names

**What goes wrong:**
FSB has 43+ site guide files that reference tool names in `toolPreferences` arrays and workflow text. For example, Workday's site guide (line 58) has `toolPreferences: ['navigate', 'type', 'click', 'scroll', 'getText', 'getAttribute', 'waitForElement', 'waitForDOMStable']`. The Google Sheets guide embeds JSON-format examples in its guidance text: `'type the cell reference (e.g., "B1")'`. The BATCH_ACTION_INSTRUCTIONS constant (lines 400-435) contains JSON example blocks. Career search directives embed JSON tool call examples (line 2439): `Format: {"tool": "storeJobData", "params": {"company": "...", ...}}`.

If the prompt sends CLI format instructions but site guides and injected directives still contain JSON examples, the AI receives mixed format signals. It may follow the JSON examples in the site guide rather than the CLI format in the system prompt, especially since site guide examples are CLOSER to the actual task context than the system prompt.

**Why it happens:**
FSB's prompt architecture is layered:
1. System prompt (format instructions, tool documentation)
2. Task type guidance (`_buildTaskGuidance()`)
3. Site guide injection (per-domain guidance with examples)
4. Context directives (multiSite, sheetsData, formatting)
5. Conversation history

Each layer was written for JSON format. Changing only layer 1 (system prompt) while leaving layers 2-5 in JSON creates format conflicts. The AI must reconcile "Output CLI commands" (system prompt) with `Format: {"tool": "storeJobData", ...}` (context directive). Models resolve this conflict unpredictably.

**Consequences:**
- AI oscillates between CLI and JSON output within the same session
- Career search workflows fail because storeJobData is called in JSON format instead of CLI
- Google Sheets workflows produce JSON type actions that the CLI parser rejects
- Site-specific guidance quality degrades because format instructions compete

**Prevention:**
1. Audit and rewrite ALL prompt layers to use CLI format examples:
   - `BATCH_ACTION_INSTRUCTIONS`: Change JSON batch example to CLI batch example
   - `multiSiteDirective` (line 2439): Change `Format: {"tool": "storeJobData", ...}` to `Format: storeJobData --company "..." --jobs ...`
   - `sheetsDataDirective`: Change any JSON examples to CLI
   - All 43+ site guide files: Update `guidance` text if it contains JSON format examples
2. The `toolPreferences` arrays in site guides use tool NAMES (strings), not full JSON calls. These are format-agnostic and should work unchanged -- but verify they feed into CLI-format documentation generation
3. The `TOOL_DOCUMENTATION` constant (lines 15-116 of ai-integration.js) contains `example` fields with JSON format. These MUST be rewritten to CLI format:
   - `'{"tool": "clickSearchResult", "params": {"index": 0}}'` -> `'clickSearchResult --index 0'`
4. Create a migration checklist of every location in the codebase that contains hardcoded JSON format examples. Use `grep` for `"tool":` within string literals
5. Rewrite `getToolsDocumentation()` to output CLI command syntax instead of JSON parameter tables

**Detection:**
- AI response contains `{"tool":` despite CLI format instructions
- Automation works for generic tasks but fails for career search or Sheets tasks (which have the most embedded JSON examples)
- Regression tests pass for simple click/type but fail for complex workflows

**Phase to address:**
Full Prompt Architecture Redesign phase -- this is a full sweep of every prompt layer, not just the system prompt. Budget 40% of the prompt redesign time for this sweep

---

## Moderate Pitfalls

Mistakes that cause degraded quality, extra debugging, or partial failures.

---

### Pitfall 7: Backward Compatibility Breaks During Incremental Migration

**What goes wrong:**
The migration is planned as "backward-compatible" (PROJECT.md line 72: "existing action toolset preserved, only the AI-to-extension protocol changes"). But the codebase has tight coupling between the protocol format and the action execution layer. Examples:

- `normalizeResponse()` (line 4087 of ai-integration.js) expects `response.actions` to be an array of `{tool, params}` objects with sanitization checks on `action.params?.url` and `action.params?.text`
- `getActionStatus()` (called at line 9107) takes `action.tool` and `action.params` to generate UI status text
- The popup and sidepanel UIs display action status based on `{tool, params}` format
- Session persistence and replay (`loadSessionForReplay`, line 2105) stores and replays `{tool, params}` action objects

If the migration changes the internal format or introduces a transitional period where both formats coexist, any of these coupling points can break.

**Why it happens:**
"Backward compatible" usually means the external interface stays the same while internals change. But FSB's "external interface" is the AI-to-extension protocol, and the "internals" (action execution, UI, analytics) were built to match that protocol format. Changing the protocol without changing every consumer creates format mismatches at consumer boundaries.

**Prevention:**
1. Maintain the canonical `{tool, params}` internal format (see Pitfall 5). The CLI parser normalizes to this format, so ALL downstream code works unchanged
2. Do NOT introduce a "CLI action format" internally. The only place CLI exists is: (a) the AI's output text, (b) the parser that converts it. Everything after the parser is canonical `{tool, params}`
3. Build a feature flag (`protocolMode: 'json' | 'cli'`) that controls ONLY the prompt and parser, not the execution pipeline. This allows A/B testing and instant rollback
4. During migration, the flag can be changed per-session or per-provider without affecting action execution
5. Test backward compatibility explicitly: existing session recordings must replay correctly after the migration

**Detection:**
- UI shows "undefined" for action status or tool name
- Session replay fails with format errors
- Analytics dashboard shows wrong action type distributions

**Phase to address:**
Action Dispatch Rewrite phase -- design the boundary between protocol format and internal format before writing any parser code

---

### Pitfall 8: YAML DOM Snapshots Break Element Ref Resolution

**What goes wrong:**
The current DOM snapshot format is JSON with refs like `"elementId": "elem_123"` that the AI references as `e123` in actions (with the `elem_` prefix stripped for prompts, per ai-integration.js). The migration changes DOM snapshots to YAML format. If the YAML serialization introduces subtle changes to how refs are represented, the ref resolution chain breaks:

1. YAML may format refs differently (unquoted `e5` vs quoted `"e5"`)
2. YAML indentation errors make elements appear nested under the wrong parent
3. YAML anchors/aliases may be used for deduplication, confusing the AI
4. YAML multi-line strings may split element descriptions across lines
5. Large YAML snapshots may exceed the AI's effective context window differently than JSON

The current `resolveRef` logic in content.js maps `e5` -> element in cache. If the YAML snapshot presents refs in a way the AI does not understand, it may fabricate refs, use wrong refs, or refer to elements by description instead of ref.

**Why it happens:**
YAML is structurally more flexible than JSON, which is both its strength (more compact) and weakness (more ways to be ambiguous). YAML parsers are notoriously inconsistent across implementations. While FSB does not parse YAML (it generates YAML for the AI to read), the AI's interpretation of YAML structure affects its ref usage. Research shows YAML achieves 62% accuracy for nested data (vs JSON 50%) but this is for READING comprehension, not for GENERATING references from YAML input.

**Prevention:**
1. Use simple, flat YAML without advanced features (no anchors, no aliases, no multi-document, no flow sequences). The YAML should look like a readable list:
   ```yaml
   elements:
     e1: button "Submit" .btn-primary
     e2: input[text] "Search..." #search-box
     e3: link "Home" /index.html [off-screen]
   ```
2. Test ref accuracy by sending the same page to the AI in both JSON and YAML formats and comparing which refs it selects. If YAML causes more ref errors, the YAML format needs adjustment
3. Keep element refs in the SAME format across JSON and YAML: `e1`, `e2`, etc. Do not change to `@e1` or `elem_1` or any other format during the migration -- the AI already knows `e1` format
4. Limit YAML snapshot size to a token budget (current: 15K prompt budget with 40/50/10 split). YAML is ~15-40% more token-efficient than JSON for the same data, so the same token budget buys more elements
5. Add a "ref validation" step: after parsing the AI's CLI response, verify that all referenced element IDs exist in the most recent snapshot. Log warnings for fabricated refs

**Detection:**
- AI references element IDs not present in the current snapshot
- Action failures increase after switching to YAML snapshots (elements not found)
- AI describes elements in text instead of using refs ("click the submit button" instead of `click e5`)

**Phase to address:**
YAML DOM Snapshot phase -- run comparative tests of JSON vs YAML ref accuracy before committing to YAML

---

### Pitfall 9: Model Instruction Drift (Reverting to JSON Over Long Sessions)

**What goes wrong:**
Even with a perfect CLI system prompt and clean conversation history, models exhibit "instruction drift" over long automation sessions (15+ iterations). The AI starts generating CLI correctly, but as the session progresses and the conversation history grows, it begins adding JSON-like structures, wrapping CLI in code blocks, or reverting entirely to JSON. This is distinct from Pitfall 2 (history contamination) -- this happens even with clean history because of the model's underlying token generation probabilities.

Long FSB sessions are common: career search workflows run 20-50 iterations across 5+ sites. Google Sheets data entry can run 30+ iterations. These are well within the drift zone.

**Why it happens:**
- The system prompt becomes a smaller fraction of the total context as history grows
- Models have stronger JSON priors from training data than custom CLI priors from a single system prompt
- Repetitive command patterns (click, type, click, type) may trigger the model to "optimize" by switching to a format it considers more natural
- Gemini and GPT-4o are particularly prone to drift because they use longer-context attention patterns that dilute prompt authority
- The continuation prompt (`MINIMAL_CONTINUATION_PROMPT`) may have weaker format enforcement than the full system prompt

**Prevention:**
1. Reinforce CLI format in EVERY continuation prompt, not just the initial system prompt. Add a brief format reminder: `"Output CLI commands only. No JSON."`
2. Periodically inject format correction: every N iterations, include a "format: cli" reminder in the user message
3. If the parser detects a JSON-formatted response that was supposed to be CLI, add the failed response to history with a correction: `"You responded in JSON. You MUST use CLI format. Example: click e5"`. Then retry
4. Implement aggressive conversation history trimming for CLI sessions. Keep fewer messages (current maxConversationTurns may be too high for CLI format stability)
5. Monitor format drift per-provider and add provider-specific drift countermeasures

**Detection:**
- Parse success rate declines as session iteration count increases
- Format errors cluster in later iterations (15+) of long sessions
- Specific providers drift more than others (track drift rate per provider)

**Phase to address:**
Prompt Architecture Redesign phase -- continuation prompt and history management are core components

---

### Pitfall 10: Security Sanitization Bypass in CLI Format

**What goes wrong:**
The current `normalizeResponse()` function (lines 4102-4131 of ai-integration.js) sanitizes actions: it blocks `navigate` to `data:` or `javascript:` URIs, blocks `type` with `<script>` content, and strips prompt injection attempts. This sanitization works on `{tool, params}` objects with known field paths. In CLI format, the sanitization must parse CLI commands to extract the URL or text value before checking -- and if the CLI parser handles quoting differently than expected, the sanitization can be bypassed.

Example bypass: `navigate "javascript:alert(1)"` might be parsed as `{tool: "navigate", params: {url: "javascript:alert(1)"}}` correctly, but `navigate javascript:alert(1)` (without quotes) might be parsed as `{tool: "navigate", params: {url: "javascript:alert(1)"}}` or might fail to parse at all (no quotes = parser confusion), causing the action to be rejected for wrong reasons rather than security reasons.

**Why it happens:**
Security sanitization is format-dependent. It was built to inspect JSON object properties. CLI parsing introduces a new attack surface:
- Unquoted URLs may not be extracted correctly for inspection
- Quoted strings with escape sequences may bypass string matching (`java\x73cript:`)
- Multi-word arguments may be split incorrectly, causing the security check to see partial values
- CLI command injection (if the parser is not careful, `click e5; navigate javascript:...` could inject a second command)

**Prevention:**
1. Apply security sanitization AFTER the CLI parser normalizes to canonical `{tool, params}` format. The same sanitization code should work on both JSON-parsed and CLI-parsed actions
2. Add CLI-specific sanitization: check for command injection patterns (`;`, `&&`, `|` between commands)
3. The canonical format means the security layer does not need to understand CLI syntax at all -- it only inspects `{tool, params}` objects
4. Add a security test suite that tries CLI-format injection attacks: unquoted dangerous URLs, escaped characters, command injection
5. URL normalization: always decode/normalize URLs extracted from CLI commands before security checks

**Detection:**
- Security sanitization logs stop catching blocked actions (sanitization is not running on CLI-parsed actions)
- Actions execute that would have been blocked in JSON format
- CLI parser allows `;` or `&&` to inject additional commands

**Phase to address:**
Action Dispatch Rewrite phase -- security sanitization must be tested against CLI-specific bypass vectors

---

### Pitfall 11: Testing Coverage Gap During Migration

**What goes wrong:**
FSB has no automated test suite (vanilla JavaScript Chrome extension, no build system). Testing is manual across diverse websites. The migration changes the most critical path in the system (AI response -> parse -> dispatch -> execute) without automated regression tests. Manual testing cannot cover:
- All 30+ tool commands in CLI format
- All 4 AI providers
- All 43+ site guides with their workflows
- Edge cases in quoting, special characters, batch actions
- Long session format drift
- Stuck detection with new action format

A manual-only testing strategy for this migration will miss regression bugs that only appear in specific provider + tool + input combinations.

**Why it happens:**
FSB is a vanilla JavaScript Chrome extension with no build system (constraint from PROJECT.md: "No build system: Direct JavaScript execution"). This makes traditional unit testing harder (no Jest, no Vitest without setup). The team has relied on manual testing across websites, which works for feature testing but fails for format migration testing.

**Consequences:**
- Regressions discovered in production by users, not in development
- "Works on my machine" false confidence (tested with one provider, one task type)
- Rollback needed after shipping because of untested edge case

**Prevention:**
1. Build a CLI parser test harness that runs outside the extension context (pure JavaScript, runnable in Node.js or browser console). Feed it known inputs and verify outputs:
   ```javascript
   // test-cli-parser.js
   assert(parseCLI('click e5'), {tool: 'click', params: {ref: 'e5'}});
   assert(parseCLI('type e12 "hello world" --enter'), {tool: 'type', params: {ref: 'e12', text: 'hello world', pressEnter: true}});
   assert(parseCLI('navigate "https://example.com/path?q=test"'), {tool: 'navigate', params: {url: 'https://example.com/path?q=test'}});
   ```
2. Build a "format round-trip" test: take real AI responses from session logs, parse them as JSON (current), convert to CLI format, parse as CLI, verify the canonical output matches
3. Create provider-specific test fixtures: capture one response from each provider and verify the CLI parser handles each provider's output quirks
4. Test the FULL pipeline end-to-end on at least 3 different task types: simple navigation, career search, Google Sheets data entry
5. Keep the JSON parser as a fallback with its own tests so it can be re-enabled instantly

**Detection:**
- Post-migration bug reports that could have been caught with unit tests
- "It used to work" regression reports for specific tool commands or providers
- Debugging time spent on format parsing issues rather than feature issues

**Phase to address:**
CLI Parser Implementation phase -- build tests BEFORE building the parser (TDD approach)

---

## Minor Pitfalls

Mistakes that cause suboptimal results or require small fixes.

---

### Pitfall 12: Token Budget Assumptions Change with CLI Format

**What goes wrong:**
FSB's prompt budget is 15K tokens with a 40/50/10 split (system prompt / page context / memory, line 118 of PROJECT.md). CLI commands are shorter than JSON responses (~76% token reduction per Playwright CLI research), which means the AI's OUTPUT uses fewer tokens. But the PROMPT also changes: YAML DOM snapshots are ~15-40% smaller, and CLI tool documentation is more compact than JSON parameter tables. This changes the effective allocation across prompt sections. If the budget is not recalculated, either too much or too little context is allocated to each section.

**Prevention:**
1. Measure actual token counts for CLI-format prompts vs JSON-format prompts with the same page
2. Recalculate the prompt budget split. If YAML saves 30% on page context, that budget can be reallocated to more elements (the 50-element cap might increase to 70+) or more memory context
3. Update `estimatedTokens` calculation (line 3024 of ai-integration.js) to account for CLI format differences

**Detection:**
- Prompt token counts are significantly under budget (wasting context capacity)
- Or prompt token counts exceed budget because tool documentation grew

**Phase to address:**
Prompt Architecture Redesign phase -- budget recalculation should happen after the new prompt format is finalized

---

### Pitfall 13: ActionRecorder and Session Replay Incompatibility

**What goes wrong:**
The `ActionRecorder` in content/actions.js records actions for debugging and replay. If session recordings are stored in `{tool, params}` format but the replay system expects CLI commands (or vice versa), recorded sessions from before the migration cannot be replayed after migration, and vice versa.

**Prevention:**
1. Store recorded actions in the canonical `{tool, params}` format regardless of protocol mode
2. The replay system should dispatch canonical format actions, not raw protocol text
3. Add a `protocolVersion` field to session recordings so the replay system can detect and handle old-format recordings

**Detection:**
- Session replay fails with "unknown action format" errors
- Recorded sessions from v9.x cannot be analyzed after v10.0 migration

**Phase to address:**
Action Dispatch Rewrite phase -- minor concern but should be addressed alongside canonical format design

---

### Pitfall 14: Analytics and Logging Break with Format Change

**What goes wrong:**
The analytics system (`analytics.js`) tracks action types, tool usage frequencies, and cost calculations. The automation logger logs `action.tool` for each executed action. If CLI-parsed actions have different field names or if the logging happens BEFORE normalization to canonical format, analytics data becomes inconsistent across the migration boundary.

**Prevention:**
1. Ensure logging and analytics consume the CANONICAL format, never the raw CLI text
2. Add a `protocol` field to analytics events (`json` or `cli`) for migration tracking
3. Verify that the cost calculation per-action still works (token estimation may change with CLI format)

**Detection:**
- Analytics dashboard shows "unknown" tool types or zero counts for actions that are executing
- Cost estimates are wrong because token counting does not account for CLI format efficiency

**Phase to address:**
Action Dispatch Rewrite phase -- verify analytics pipeline after parser is built

---

## Multi-Provider CLI Compatibility Matrix

Based on research and FSB's current provider-specific handling:

| Provider | JSON Quality | Expected CLI Quality | Key Risk | Mitigation |
|----------|-------------|---------------------|----------|------------|
| xAI Grok 4.1 Fast | HIGH (primary provider, well-tuned) | MEDIUM -- may add conversational preamble before commands | Chatty output wrapping CLI commands | Strip everything before first recognized command |
| OpenAI GPT-4o | HIGH (strong function calling) | MEDIUM-HIGH -- follows format specs well but may invent flags | Hallucinated command flags (`--verbose`, `--wait`) | Validate commands against known vocabulary, ignore unknown flags |
| Anthropic Claude | HIGH (excellent instruction following) | HIGH -- likely best CLI compliance | May revert to JSON if conversation history contains JSON | Clear history when switching format, add format reinforcement |
| Gemini 2.5 Flash | MEDIUM (markdown wrapping issues) | LOW-MEDIUM -- wraps everything in code blocks | `` ```bash\nclick e5\n``` `` wrapping | Aggressive markdown stripping, same as current JSON handling |
| Grok 3 Mini | MEDIUM (budget model, less reliable) | LOW -- may mix CLI and prose | "I will click on element e5 for you: click e5" | Extract commands from prose using regex, same pattern as current JSON extraction |

**Recommendation:** Test all providers before migration. Consider designating specific providers as "CLI-ready" and keeping JSON as fallback for others. Grok 4.1 Fast and Claude should be the primary CLI targets; Gemini may need extended cleaning.

---

## Regression Testing Checklist

Actions that must be verified after migration. Each row represents a test that must PASS with CLI format.

| Test Case | What to Verify | Current JSON Format | Expected CLI Format | Risk Level |
|-----------|---------------|--------------------|--------------------|------------|
| Simple click | `click e5` dispatches correctly | `{"tool":"click","params":{"ref":"e5"}}` | `click e5` | LOW |
| Type with text | Text value preserved exactly | `{"tool":"type","params":{"ref":"e3","text":"hello"}}` | `type e3 "hello"` | MEDIUM |
| Type with pressEnter | Boolean flag parsed | `{"tool":"type","params":{"ref":"e3","text":"query","pressEnter":true}}` | `type e3 "query" --enter` | MEDIUM |
| Type with quotes in text | Nested quotes escaped | `{"tool":"type","params":{"ref":"e3","text":"He said \"hi\""}}` | `type e3 "He said \"hi\""` | HIGH |
| Type with URL | URL special chars preserved | `{"tool":"type","params":{"ref":"e3","text":"https://x.com?q=a&b=2"}}` | `type e3 "https://x.com?q=a&b=2"` | HIGH |
| Navigate | URL extracted correctly | `{"tool":"navigate","params":{"url":"https://..."}}` | `navigate "https://..."` | LOW |
| Scroll direction | Direction parameter parsed | `{"tool":"scroll","params":{"direction":"down"}}` | `scroll down` | LOW |
| Scroll amount | Numeric amount parsed | `{"tool":"scroll","params":{"amount":800}}` | `scroll down 800` | MEDIUM |
| searchGoogle | Query text preserved | `{"tool":"searchGoogle","params":{"query":"test query"}}` | `search "test query"` | MEDIUM |
| clickSearchResult | Index parameter parsed | `{"tool":"clickSearchResult","params":{"index":0}}` | `clickResult 0` or `clickResult --index 0` | MEDIUM |
| waitForElement | CSS selector preserved | `{"tool":"waitForElement","params":{"selector":".btn"}}` | `wait ".btn"` | MEDIUM |
| storeJobData | Complex structured data preserved | `{"tool":"storeJobData","params":{"company":"...","jobs":[...]}}` | `storeJobData {...}` (JSON payload) | HIGH |
| fillSheetData | No-param command works | `{"tool":"fillSheetData","params":{}}` | `fillSheetData` | LOW |
| Batch 3 types | Batch boundaries detected | `{"batchActions":[{...},{...},{...}]}` | `batch\n...\nend` | HIGH |
| Batch on Sheets URL | Batch suppressed for 2+ types | batchActions suppression check | Same check on parsed batch | HIGH |
| Stuck detection | Pattern analysis works | `actionHistory` with `{tool,params}` | Same canonical format | HIGH |
| taskComplete | Boolean parsed from CLI | `{"taskComplete":true,"result":"..."}` | `done "result text"` | HIGH |
| Empty action | No action, just analysis | `{"actions":[],"reasoning":"..."}` | `# Just analyzing, no action yet` | MEDIUM |
| Multi-tab: openNewTab | URL and active flag parsed | `{"tool":"openNewTab","params":{"url":"...","active":true}}` | `openTab "https://..." --active` | MEDIUM |
| Security: blocked navigate | data: URI blocked | Sanitization catches `data:` URLs | Same sanitization on canonical format | HIGH |

---

## Rollback Strategy

### Pre-Migration Safeguards

1. **Feature flag:** Implement `protocolMode: 'json' | 'cli'` in config. Default: `'json'`. CLI is opt-in initially
2. **Dual parser:** Keep the JSON parser fully functional alongside the CLI parser. The protocol mode determines which parser runs first, but the other is available as fallback
3. **Version tagging:** Tag `v9.4-pre-cli` in git before any CLI changes. This is the rollback target
4. **Session compatibility:** Store `protocolVersion` in session state so sessions started with one protocol can be identified

### Rollback Triggers

| Trigger | Action |
|---------|--------|
| CLI parse failure rate > 20% in production | Switch `protocolMode` to `'json'` immediately |
| Any provider has > 50% CLI failure rate | Disable CLI for that provider, keep JSON |
| Stuck detection confirmed broken | Rollback to JSON while fixing canonical format |
| Security bypass confirmed | Immediate rollback, patch, then re-deploy |
| Career search workflow regression | Rollback CLI for career tasks, keep for simple tasks |

### Rollback Process

1. Set `protocolMode: 'json'` in config (instant, no code change needed if flag is implemented)
2. Clear conversation history for all active sessions (prevents format contamination)
3. Verify JSON mode works (run one full automation cycle)
4. Diagnose the CLI failure from logs
5. Fix in CLI branch, re-test with provider compatibility matrix
6. Re-enable CLI mode after fix is verified

### What CANNOT Be Rolled Back

- YAML DOM snapshots can be rolled back independently of CLI commands (separate feature)
- Prompt architecture changes may need to be rolled back along with CLI (they are coupled)
- Site guide text changes that removed JSON examples need JSON examples restored

---

## Phase-Specific Warnings

| Phase | Likely Pitfall | Mitigation |
|-------|---------------|------------|
| CLI Protocol Design | Pitfall 3 (quoted strings), Pitfall 4 (batch semantics) | Finalize quoting spec and batch delimiters before writing any code. Write test cases first |
| CLI Parser Implementation | Pitfall 1 (multi-provider quality), Pitfall 11 (testing gap) | Build parser with multi-provider test fixtures. TDD approach |
| Action Dispatch Rewrite | Pitfall 5 (stuck detection), Pitfall 7 (backward compat), Pitfall 10 (security) | Canonical format is the key. All downstream consumers unchanged if canonical format matches current `{tool, params}` |
| Prompt Architecture Redesign | Pitfall 2 (history mismatch), Pitfall 6 (site guide examples), Pitfall 9 (drift) | Full sweep of all prompt layers. Continuation prompt must enforce format. Site guides must use CLI examples |
| YAML DOM Snapshots | Pitfall 8 (ref resolution), Pitfall 12 (token budget) | Comparative JSON vs YAML ref accuracy testing. Budget recalculation |
| Integration Testing | ALL pitfalls | Run full regression checklist. Test each provider. Test career search + Sheets end-to-end |

---

## Sources

- Direct codebase analysis: `ai/ai-integration.js` (5K+ lines: prompt construction, JSON parsing pipeline, model-specific instructions, tool documentation, conversation history management), `background.js` (11K+ lines: stuck detection, batch execution, action dispatch, session management, security sanitization), `content/actions.js` (action execution, coordinate fallback), 43+ site guide files (tool preferences, workflow text)
- [Playwright CLI: Token-Efficient Browser Automation](https://testcollab.com/blog/playwright-cli) -- 4x token reduction (114K vs 27K tokens), file-based snapshots, element ref format
- [agent-browser SKILL.md](https://github.com/vercel-labs/agent-browser/blob/main/skills/agent-browser/SKILL.md) -- @eN ref format, snapshot-based element discovery, ref invalidation after navigation, 50+ CLI commands
- [webctl](https://github.com/cosinusalpha/webctl) -- ARIA-based semantic targeting, context window control, `--interactive-only --limit 30` filtering
- [agent-browser: 93% Context Reduction](https://medium.com/@richardhightower/agent-browser-ai-first-browser-automation-that-saves-93-of-your-context-window-7a2c52562f8c) -- Streamlined element refs vs full accessibility trees
- [Best Nested Data Format for LLMs](https://www.improvingagents.com/blog/best-nested-data-format/) -- YAML 62% accuracy vs JSON 50% for nested data, Markdown 34-38% fewer tokens than JSON
- [5 Steps to Handle LLM Output Failures](https://latitude.so/blog/5-steps-to-handle-llm-output-failures/) -- LLMs produce content that fails to parse correctly, error correction via retry with feedback
- [Hidden Incompatibilities Between LLM Providers](https://dev.to/rgambee/the-hidden-incompatibilities-between-llm-providers-51d) -- Parameter differences, temperature handling, format compliance divergence across providers
- [LLM Ignores Tools: Troubleshooting Guide](https://www.arsturn.com/blog/llm-ignores-tools-troubleshooting-guide) -- Models clicking wrong elements, format errors, instruction drift over long sessions
- [TOON vs JSON: Token Efficiency](https://www.tensorlake.ai/blog/toon-vs-json) -- JSON degrades reasoning by 10-15%, TOON achieves 73.9% vs 69.7% accuracy
- [browser-use Issue #2656](https://github.com/browser-use/browser-use/issues/2656) -- Real-world browser automation failures: models clicking unrelated buttons, format regression mid-session

---
*Pitfalls research for: v10.0 CLI Architecture Migration (FSB)*
*Researched: 2026-02-27*
