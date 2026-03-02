# Architecture: CLI Command Protocol Integration with FSB

**Domain:** CLI-based browser automation protocol for existing Chrome Extension (FSB v10.0)
**Researched:** 2026-02-27
**Overall Confidence:** HIGH (based on line-by-line codebase analysis + industry patterns from Playwright CLI, agent-browser, webctl)

---

## Executive Summary

The CLI protocol replaces only the **AI-to-extension communication format** -- the shape of what the AI outputs and how `background.js` + `ai-integration.js` parse it. Everything downstream (content script actions, Chrome messaging, DOM analysis, RefMap, session management, visual feedback) stays intact. The integration is a **protocol swap in a narrow band** between the AI response and the action dispatch loop.

The key finding from codebase analysis: **FSB already has 80% of the infrastructure the CLI protocol needs.** The `generateCompactSnapshot()` function in `content/dom-analysis.js` (line 1840) already produces `[e1] button "Submit"` format lines. The `RefMap` class in `content/dom-state.js` (line 614) already maps `e1->element` with WeakRef + CSS selector fallback. The `resolveRef()` function in `content/selectors.js` (line 555) already resolves refs to DOM elements. The `handleAsyncMessage` in `content/messaging.js` (line 784) already resolves `params.ref` to `params.selector` before executing any action.

What actually needs to change: the system prompt (tell AI to output CLI commands instead of JSON), the response parser (line-based instead of 4-strategy JSON fallback), and the prompt format for tool documentation. The action dispatch loop in `background.js` (lines 9270-9320) operates on `[{tool, params}]` arrays and does not care whether those came from JSON parsing or CLI parsing.

---

## Current Data Flow (JSON Tool Calls)

This is the exact path a single automation iteration takes today, with file locations:

```
1. background.js:7941  startAutomationLoop(sessionId)
   |
   v
2. background.js:8256  getDOMPayload = { action: 'getDOM', options: {..., includeCompactSnapshot: true} }
   |
   v
3. background.js:8269  domResponse = await sendMessageWithRetry(session.tabId, getDOMPayload)
   |
   |  [chrome.tabs.sendMessage -> content script]
   v
4. content/messaging.js:932   handleAsyncMessage(request, sendResponse)
   |
   v
5. content/messaging.js:735   case 'getDOM': result = FSB.getStructuredDOM(options)
   |                                          compact = FSB.generateCompactSnapshot(options)
   |                                          result._compactSnapshot = compact.snapshot
   v
6. content/dom-analysis.js:1840  generateCompactSnapshot()
   |  - Calls FSB.refMap.reset()           // dom-state.js:622
   |  - For each element: refMap.register(el, selector, role, name)  // returns "e1", "e2"...
   |  - Builds lines: "[e1] button \"Submit Form\" [focused]"
   |  - Returns { snapshot: string, refGeneration, elementCount, metadata }
   |
   v
7. background.js:8300  domResponse.structuredDOM has ._compactSnapshot
   |
   v
8. background.js:10100  callAIAPI(task, structuredDOM, settings, context)
   |
   v
9. ai/ai-integration.js:1735  getAutomationActions(task, domState, context)
   |
   v
10. ai/ai-integration.js:1828  buildPrompt(task, domState, context)
    |  - Builds system prompt with JSON format instructions
    |  - Builds user prompt with compact snapshot embedded
    |
    v
11. ai/ai-integration.js:888  buildMinimalUpdate() includes:
    |  if (domState._compactSnapshot) {
    |    update += formatCompactElements(domState._compactSnapshot, elementBudget)
    |  }
    |
    v
12. AI PROVIDER returns JSON:
    {
      "situationAnalysis": "...",
      "reasoning": "...",
      "actions": [{"tool":"click","params":{"ref":"e5"}}],
      "taskComplete": false
    }
    |
    v
13. ai/ai-integration.js:3956  parseResponse(responseText)
    |  - Strategy 1: parseCleanJSON
    |  - Strategy 2: parseWithMarkdownBlocks
    |  - Strategy 3: parseWithJSONExtraction
    |  - Strategy 4: parseWithAdvancedCleaning
    |
    v
14. ai/ai-integration.js:4087  normalizeResponse(response)
    |  - Sanitizes actions (blocks data:/javascript: URLs, script injection)
    |  - Extracts batchActions if present
    |  - Returns { actions, taskComplete, reasoning, ... }
    |
    v
15. background.js:9027  if (aiResponse.batchActions) -> executeBatchActions()
    |                   else -> iterate aiResponse.actions
    |
    v
16. background.js:9277  actionPayload = {
    |    action: 'executeAction',
    |    tool: action.tool,
    |    params: action.params,
    |    visualContext: {...}
    |  }
    v
17. background.js:9293  actionResult = await sendMessageWithRetry(session.tabId, actionPayload)
    |
    |  [chrome.tabs.sendMessage -> content script]
    v
18. content/messaging.js:764  case 'executeAction':
    |  - COMPACT REF RESOLUTION (line 784-808):
    |    if (params.ref && !params.selector) {
    |      resolvedElement = FSB.resolveRef(params.ref)  // selectors.js:555
    |      params.selector = refInfo.selector
    |      FSB.elementCache.set(params.selector, resolvedElement)
    |    }
    |
    v
19. content/messaging.js:846  FSB.tools[tool](params)
    |
    v
20. content/actions.js  executes click/type/scroll/etc with selector or cached element
    |
    v
21. Result propagates back: content -> background -> session history -> loop to step 1
```

---

## CLI Protocol Data Flow (Proposed)

Steps 1-7 and 15-21 are **identical**. Changes are confined to steps 8-14.

```
Steps 1-7: IDENTICAL (DOM fetching, compact snapshot generation, RefMap)

8. background.js:10100  callAIAPI(task, structuredDOM, settings, context)
   |
   v
9. ai/ai-integration.js:1735  getAutomationActions(task, domState, context)
   |
   v
10. ai/ai-integration.js  buildPrompt(task, domState, context)
    |  - NEW system prompt: tells AI to output CLI commands, not JSON
    |  - SAME compact snapshot embedding in user prompt
    |  - NEW tool documentation format: CLI examples instead of JSON examples
    |
    v
11. SAME compact snapshot injection via formatCompactElements()
    |
    v
12. AI PROVIDER returns CLI text:
    # On Google search results page for "wireless mouse"
    # First result matches query, clicking it
    click e3
    # If that fails, navigate directly
    |
    v
13. ai/ai-integration.js  parseCLIResponse(responseText)  <-- NEW PARSER
    |  - Line-by-line parsing
    |  - '#' lines -> reasoning
    |  - 'done' keyword -> taskComplete
    |  - Command lines -> {tool, params} via parseCLICommand()
    |  - No JSON parsing at all
    |
    v
14. ai/ai-integration.js  normalizeResponse(response)
    |  - SAME sanitization (input is {tool, params} regardless of parse method)
    |  - SAME output shape: { actions, taskComplete, reasoning, ... }
    |
    v
Steps 15-21: IDENTICAL (action dispatch, ref resolution, tool execution)
```

### The Change Boundary

```
+-----------------------------------------------------------+
|  UNCHANGED                                                |
|  content/dom-analysis.js  generateCompactSnapshot()       |
|  content/dom-state.js     RefMap class                    |
|  content/selectors.js     resolveRef()                    |
|  content/messaging.js     handleAsyncMessage              |
|  content/actions.js       30+ tool implementations        |
|  background.js            startAutomationLoop()            |
|  background.js            sendMessageWithRetry()           |
|  background.js            action dispatch (9270-9320)      |
|  background.js            executeBatchActions()            |
|  background.js            session management               |
|  background.js            stuck detection, recovery        |
+-----------------------------------------------------------+
|  CHANGES (narrow protocol band)                           |
|  ai/ai-integration.js     buildPrompt() system prompt     |
|  ai/ai-integration.js     parseResponse() -> dual parser  |
|  ai/ai-integration.js     buildMinimalUpdate() format      |
|  ai/cli-parser.js         NEW: CLI command parser          |
|  ai/cli-prompt.js         NEW: CLI system prompts          |
+-----------------------------------------------------------+
|  UNCHANGED                                                |
|  content/visual-feedback.js, lifecycle.js, accessibility.js|
|  popup.js, sidepanel.js, options.js, config.js, analytics  |
+-----------------------------------------------------------+
```

---

## Component Boundaries

| Component | Responsibility | Communicates With | Changes |
|-----------|---------------|-------------------|---------|
| `content/dom-analysis.js` | DOM traversal, element filtering, compact snapshot generation | `content/messaging.js` (called by getDOM handler) | NONE |
| `content/dom-state.js` | RefMap (e1->element mapping), DOMStateManager, MutationObserver | `content/dom-analysis.js` (refMap.register), `content/selectors.js` (refMap.resolve) | NONE |
| `content/selectors.js` | resolveRef(), CSS selector generation, Shadow DOM traversal | `content/messaging.js` (ref resolution), `content/actions.js` (element finding) | NONE |
| `content/messaging.js` | Message handler, ref->selector resolution, action dispatch | `background.js` (chrome.tabs.sendMessage), `content/actions.js` (tool execution) | NONE |
| `content/actions.js` | 30+ tool implementations (click, type, scroll, navigate, etc.) | `content/messaging.js` (called via FSB.tools[tool]) | NONE |
| `ai/ai-integration.js` | Prompt building, API calls, response parsing, conversation history | `background.js` (called by callAIAPI), AI providers (HTTP) | MAJOR |
| `ai/cli-parser.js` | CLI command tokenization and parsing | `ai/ai-integration.js` (called by parseResponse) | NEW |
| `ai/cli-prompt.js` | CLI-formatted system prompts and tool documentation | `ai/ai-integration.js` (imported for buildPrompt) | NEW |
| `background.js` | Automation loop, session management, action dispatch, stuck detection | `content/messaging.js` (sendMessageWithRetry), `ai/ai-integration.js` (callAIAPI) | MINOR (import new files) |

---

## RefMap Lifecycle Across CLI Protocol

The RefMap is the critical bridge between the compact snapshot and action execution. Understanding its lifecycle is essential for CLI protocol design.

### Current RefMap Flow (unchanged by CLI)

```
1. GENERATION (content script, every iteration):
   dom-analysis.js:1851  refMap.reset()        // Clears all refs, increments generationId
   dom-analysis.js:1875  ref = refMap.register(element, primarySelector, role, name)
                         // Returns "e1", "e2", ... sequentially
                         // Stores: WeakRef(element), selector, role, name

2. SNAPSHOT (content script -> background):
   Lines like: [e1] button "Submit Form" [focused]
   Sent as domResponse._compactSnapshot string

3. AI PROMPT (background, ai-integration.js):
   Compact snapshot embedded in user message
   AI reads [e1], [e2], etc. and uses refs in commands

4. AI RESPONSE (CLI format):
   click e5
   type e12 "hello world"

5. PARSING (background, cli-parser.js):
   parseCLICommand("click e5") -> { tool: "click", params: { ref: "e5" } }

6. DISPATCH (background -> content script):
   sendMessageWithRetry(tabId, { action: 'executeAction', tool: 'click', params: { ref: 'e5' } })

7. RESOLUTION (content script, messaging.js:784-808):
   FSB.resolveRef('e5')
     -> FSB.refMap.resolve('e5')
       -> entry = map.get('e5')
       -> el = entry.element.deref()  // WeakRef
       -> if el && el.isConnected: return element
       -> if stale: fallback to CSS selector
     -> params.selector = resolved selector
     -> FSB.elementCache.set(selector, element)

8. EXECUTION (content script, actions.js):
   FSB.tools.click({ selector: '#submit-btn', ref: 'e5' })
   // Uses selector (from ref resolution) to find and click element
```

### Key RefMap Properties

- **Refs are per-snapshot:** Every `generateCompactSnapshot()` call resets the RefMap. Refs from a previous iteration are stale.
- **WeakRef prevents leaks:** If the DOM element is garbage-collected, `deref()` returns undefined, triggering CSS selector fallback.
- **CSS selector fallback:** Each registered element has a CSS selector stored alongside the WeakRef. If the WeakRef is dead but the selector still matches, the element is found.
- **Content-script-only:** The RefMap lives entirely in the content script. Background.js never touches it. The ref string (e.g., "e5") is just a token that travels through Chrome messaging.

### What CLI Protocol Changes About RefMap: Nothing

The CLI parser produces `{ ref: "e5" }` in the params -- the exact same shape the JSON parser produces. The content script's ref resolution code (messaging.js:784-808) does not know or care whether the ref came from CLI parsing or JSON parsing.

---

## CLI Command Grammar

Based on FSB's 30+ tools and validated against industry patterns (Playwright CLI, agent-browser, webctl):

```
RESPONSE       := LINE*
LINE           := COMMAND | COMMENT | DONE | EMPTY
COMMAND        := TOOL_NAME (TARGET)? (ARGS)*
COMMENT        := '#' TEXT                        # Reasoning, analysis
DONE           := 'done' (QUOTED_STRING)?         # Task completion + result
EMPTY          := ''                              # Ignored

TARGET         := REF | QUOTED_STRING
REF            := 'e' DIGITS                      # e1, e42, e137
QUOTED_STRING  := '"' (CHAR | '\"')* '"'          # "hello world", "https://..."
DIGITS         := [0-9]+
UNQUOTED_WORD  := [^\s"]+                         # down, up, 500, Escape
```

### Command Mapping to Existing Tools

**Element Interaction (ref-targeted):**
```
click e5                          -> {tool:'click', params:{ref:'e5'}}
doubleClick e5                    -> {tool:'doubleClick', params:{ref:'e5'}}
rightClick e5                     -> {tool:'rightClick', params:{ref:'e5'}}
hover e7                          -> {tool:'hover', params:{ref:'e7'}}
focus e12                         -> {tool:'focus', params:{ref:'e12'}}
blur e12                          -> {tool:'blur', params:{ref:'e12'}}
type e12 "hello world"            -> {tool:'type', params:{ref:'e12', text:'hello world'}}
clearInput e12                    -> {tool:'clearInput', params:{ref:'e12'}}
selectOption e8 "Option B"        -> {tool:'selectOption', params:{ref:'e8', value:'Option B'}}
toggleCheckbox e3                 -> {tool:'toggleCheckbox', params:{ref:'e3'}}
getText e5                        -> {tool:'getText', params:{ref:'e5'}}
getAttribute e5 "href"            -> {tool:'getAttribute', params:{ref:'e5', attribute:'href'}}
```

**Keyboard Commands:**
```
pressEnter                        -> {tool:'pressEnter', params:{}}
pressEnter e12                    -> {tool:'pressEnter', params:{ref:'e12'}}
keyPress "Escape"                 -> {tool:'keyPress', params:{key:'Escape'}}
keyPress "Tab" e12                -> {tool:'keyPress', params:{key:'Tab', ref:'e12'}}
```

**Navigation:**
```
navigate "https://example.com"    -> {tool:'navigate', params:{url:'https://example.com'}}
searchGoogle "wireless mouse"     -> {tool:'searchGoogle', params:{query:'wireless mouse'}}
clickSearchResult 0               -> {tool:'clickSearchResult', params:{index:0}}
goBack                            -> {tool:'goBack', params:{}}
goForward                         -> {tool:'goForward', params:{}}
refresh                           -> {tool:'refresh', params:{}}
```

**Scrolling:**
```
scroll down                       -> {tool:'scroll', params:{direction:'down'}}
scroll down 500                   -> {tool:'scroll', params:{direction:'down', amount:500}}
scroll up                         -> {tool:'scroll', params:{direction:'up'}}
scrollToElement ".footer"         -> {tool:'scrollToElement', params:{selector:'.footer'}}
scrollToTop                       -> {tool:'scrollToTop', params:{}}
scrollToBottom                    -> {tool:'scrollToBottom', params:{}}
```

**Wait Commands:**
```
waitForElement ".modal"           -> {tool:'waitForElement', params:{selector:'.modal'}}
waitForDOMStable                  -> {tool:'waitForDOMStable', params:{}}
waitForPageStability              -> {tool:'waitForPageStability', params:{}}
```

**Multi-Tab (background-handled):**
```
openNewTab "https://sheets.google.com"  -> {tool:'openNewTab', params:{url:'...'}}
switchToTab 123456                      -> {tool:'switchToTab', params:{tabId:123456}}
closeTab 123456                         -> {tool:'closeTab', params:{tabId:123456}}
```

**Data Tools (background-handled):**
```
storeJobData '{"company":"Acme"}'       -> {tool:'storeJobData', params:{data:{company:'Acme'}}}
```

**Completion:**
```
done                              -> taskComplete: true, result: ''
done "Found 5 results"            -> taskComplete: true, result: 'Found 5 results'
```

### AI Reasoning via Comments

```
# Page: Google search results for "wireless mouse"
# State: 10 results visible, first result is "Logitech M720"
# Goal: Click first result to visit product page
# Confidence: high -- result title matches query
click e3
# Fallback: if click fails, navigate directly using href
```

Comments replace the JSON fields: `situationAnalysis`, `goalAssessment`, `reasoning`, `confidence`, `assumptions`, `fallbackPlan`. The CLI parser extracts all `#` lines into a combined `reasoning` string.

---

## Detailed File-by-File Impact Assessment

### Files with NO CHANGES

| File | Size | Why Unchanged |
|------|------|---------------|
| `content/actions.js` | 158KB | Tool implementations receive `{selector, ref, text, ...}` params -- format-agnostic |
| `content/dom-analysis.js` | 94KB | `generateCompactSnapshot()` already produces target format. `getStructuredDOM()` unchanged |
| `content/dom-state.js` | 26KB | `RefMap` class, `DOMStateManager`, `ElementCache` -- all format-independent |
| `content/selectors.js` | 34KB | `resolveRef()`, `generateSelectors()`, `querySelectorWithShadow()` -- unchanged |
| `content/messaging.js` | 46KB | `handleAsyncMessage` case 'executeAction' with ref resolution -- unchanged |
| `content/visual-feedback.js` | 56KB | Highlights, overlays, viewport glow -- triggered by actions, not format |
| `content/accessibility.js` | 38KB | ARIA computation for elements -- DOM-level, not protocol-level |
| `content/lifecycle.js` | 21KB | Health checks, injection management -- infrastructure |
| `content/init.js` | 4KB | Module initialization |
| `content/utils.js` | 6KB | Utility functions |
| `config.js` | - | Settings management |
| `analytics.js` | - | Usage tracking -- may want CLI-specific metrics later but no structural change |
| `automation-logger.js` | - | Logging -- may log CLI commands but no structural change needed |
| `popup.js/html/css` | - | UI sends `startAutomation`, receives status/results -- format-agnostic |
| `sidepanel.js/html/css` | - | Same as popup |
| `options.js/html/css` | - | Settings dashboard -- no automation format awareness |
| `secure-config.js` | - | Encryption utilities |
| `manifest.json` | - | Permissions/content_scripts -- no changes needed |

### Files MODIFIED

#### `ai/ai-integration.js` -- MAJOR changes (~500 lines modified/added)

**Functions modified:**

1. **`buildPrompt()` (line 2129)** -- System prompt content changes
   - Current: JSON format instructions, JSON response format specification
   - CLI: CLI format instructions, command syntax documentation
   - The function structure stays the same (system message + user message)
   - `formatCompactElements()` call unchanged -- already outputs line-based format
   - Tool documentation section changes format (CLI examples instead of JSON)

2. **`buildMinimalUpdate()` (line 754)** -- Minor format changes
   - Current: Works fine as-is. Compact snapshot embedding unchanged
   - CLI: May add "Respond with CLI commands" reminder in continuation prompt
   - Structural change: minimal

3. **`parseResponse()` (line 3956)** -- REPLACED with dual parser
   - Current: 4-strategy JSON parsing pipeline
   - CLI: Auto-detect format (JSON vs CLI), delegate to appropriate parser
   - JSON strategies kept as fallback
   - New `parseCLIResponse()` added as primary path

4. **`normalizeResponse()` (line 4087)** -- MINIMAL changes
   - Input shape changes (CLI parser output vs JSON parser output) but output shape identical
   - Security sanitization applies equally to CLI-parsed `{tool, params}` objects
   - `batchActions` extraction may be simplified (all CLI actions are inherently a batch)

5. **`isValidParsedResponse()` (line 4164)** -- ADAPTED
   - Validate CLI parse result has at least one action or taskComplete flag
   - Simpler validation than JSON structure checking

6. **`updateConversationHistory()` (line 1872 call site)** -- MINOR
   - Stores assistant's raw CLI text in conversation history
   - Structure unchanged (`{role: 'assistant', content: rawCLIText}`)

7. **`getToolsDocumentation()` / tool docs** -- REWRITTEN
   - Current: JSON examples for each tool
   - CLI: CLI command examples for each tool

**Functions UNCHANGED in ai-integration.js:**
- `constructor()`, `migrateSettings()`, `createProvider()`
- `clearConversationHistory()`
- `triggerCompaction()`, `_localExtractiveFallback()`
- `getAutomationActions()` (orchestration logic stays, just calls different parser)
- `generateCacheKey()`, `getCachedResponse()`, `setCachedResponse()`
- `formatCompactElements()` (already line-based)
- `detectTaskType()` (task type detection is prompt-side, not response-side)
- `decomposeTask()`, `getModelSpecificInstructions()`
- Provider-related methods (sendRequest, buildRequest, etc.)

#### `background.js` -- MINOR changes (~20-30 lines)

1. **Import new modules** -- Add `importScripts()` for `ai/cli-parser.js` and `ai/cli-prompt.js`
2. **Action dispatch (lines 9270-9320)** -- NO changes. Already operates on `[{tool, params}]`
3. **`startAutomationLoop()` (line 7941)** -- NO changes. DOM fetching and action dispatch are format-agnostic
4. **`executeBatchActions()` (line 5923)** -- NO changes. Receives `[{tool, params}]` array
5. **`callAIAPI()` (line 10100)** -- NO changes. Calls `ai.getAutomationActions()` and gets back same shape
6. **`sendMessageWithRetry()` (line 2369)** -- NO changes. Chrome messaging layer

### Files CREATED

#### `ai/cli-parser.js` -- NEW (~300-400 lines)

**Purpose:** Parse CLI-format AI responses into `{actions, taskComplete, reasoning}` objects.

**Key functions:**
- `parseCLIResponse(responseText)` -- Main entry point. Splits into lines, categorizes each.
- `parseCLICommand(line)` -- Parses a single command line into `{tool, params}`.
- `tokenize(line)` -- Splits line on whitespace, respecting quoted strings.
- `resolveTarget(token)` -- Determines if token is a ref (`e5`) or selector (`".btn"`).

**No dependencies** on FSB internals. Pure string parsing. Can be unit tested in isolation.

#### `ai/cli-prompt.js` -- NEW (~200-300 lines)

**Purpose:** CLI-formatted system prompts, tool documentation, and format-specific instructions.

**Contains:**
- `CLI_SYSTEM_PROMPT` -- Core system prompt adapted for CLI output format
- `CLI_TOOL_DOCS` -- Tool documentation with CLI command examples
- `CLI_CONTINUATION_PROMPT` -- Minimal prompt for multi-turn iterations
- `CLI_RESPONSE_FORMAT` -- Format specification for AI (replaces JSON format block)

**No dependencies** on FSB internals. Pure string constants. Can be reviewed without running code.

---

## Patterns to Follow

### Pattern 1: Protocol Layer Isolation

**What:** The CLI parser's output MUST match the exact `{tool, params}` shape that the existing dispatch pipeline expects. The CLI protocol is a serialization format, not a new action system.

**Why:** The content script layer (10 modules, 480KB+ of code) operates on `{tool, params}` objects. Every tool in `content/actions.js` receives params like `{selector, ref, text, value, direction, amount, url, query, key}`. The CLI parser must produce these exact param names.

**Example:**
```javascript
// CLI: type e12 "hello world"
// Must produce: {tool: 'type', params: {ref: 'e12', text: 'hello world'}}
// NOT:          {tool: 'type', params: {target: 'e12', value: 'hello world'}}
//               (wrong param names would break content/actions.js)
```

### Pattern 2: Backward-Compatible Dual Parser

**What:** Support both JSON and CLI response formats with auto-detection.

**When:** Permanently. Models may occasionally revert to JSON despite CLI instructions. Having both parsers means zero downtime.

```javascript
parseResponse(responseText) {
  const trimmed = responseText.trim();

  // Heuristic: if starts with { or [, try JSON first
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try { return this.parseJSONResponse(trimmed); } catch (e) { /* fall through */ }
  }

  // CLI parsing (new default)
  try { return this.parseCLIResponse(trimmed); } catch (e) { /* fall through */ }

  // Last resort: try JSON with cleaning
  return this.parseWithAdvancedCleaning(trimmed);
}
```

### Pattern 3: Compact Snapshot Is Already Done

**What:** The compact snapshot format (`[e1] button "Submit"`) is the "YAML snapshot" the project description mentions. Do NOT change this format or add an actual YAML dependency.

**Evidence from codebase:** `generateCompactSnapshot()` at line 1840 already produces:
```
[e1] button "Submit Form" [focused]
[e2] textbox "Email" placeholder="Enter email" value="user@..."
[e3] link "Sign up" href="/signup"
[e4] heading "Contact Us"
[e5] checkbox "Remember me" [checked]
```

This is more token-efficient than YAML (no `key: value` overhead, no indentation) and purpose-built for AI comprehension. Adding actual YAML parsing would require a library (no build system = no npm) or a hand-written parser for zero benefit.

### Pattern 4: Reasoning as Comments (Not Separate Fields)

**What:** AI reasoning lives in `#` comment lines, not separate JSON fields.

**Why:** JSON reasoning fields (`situationAnalysis`, `goalAssessment`, `reasoning`, `confidence`, `assumptions`, `fallbackPlan`) add ~200-300 tokens of structural overhead per response. Comment-based reasoning has zero format overhead.

**How the system still gets reasoning data:**
```javascript
// cli-parser.js
for (const line of lines) {
  if (line.startsWith('#')) {
    reasoning.push(line.substring(1).trim());
  }
}
// reasoning array joined into string for normalizeResponse().reasoning field
// All downstream code that reads aiResponse.reasoning works unchanged
```

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Changing the Content Script Message Interface

**What:** Modifying how `content/messaging.js` receives or processes `executeAction` messages.

**Why bad:** The content script message handler at line 764-888 handles `{action:'executeAction', tool, params}` with ref resolution, visual feedback, timeout wrapping, and result propagation. This is 125 lines of battle-tested code. Changing the interface means retesting every one of the 30+ tools across diverse websites.

**Instead:** The CLI parser produces the exact same `{tool, params}` objects. The content script never knows the AI's response format changed.

### Anti-Pattern 2: Building a Real YAML Parser

**What:** Importing js-yaml or writing a YAML parser for DOM snapshots.

**Why bad:** No build system (constraint from PROJECT.md). Cannot use npm packages. The existing line-based format is already more compact than YAML for this use case.

**Instead:** Use the existing compact snapshot format. If metadata headers are needed, prepend simple `key: value` lines before element lines (parseable with a regex, no YAML library needed).

### Anti-Pattern 3: Removing JSON Parsing Entirely

**What:** Deleting `parseCleanJSON`, `parseWithMarkdownBlocks`, `parseWithJSONExtraction`, `parseWithAdvancedCleaning` when adding CLI parsing.

**Why bad:** Some AI models (especially less capable ones) may not follow CLI format instructions. The JSON fallback ensures FSB keeps working even when the AI outputs JSON.

**Instead:** Keep both parsers. Auto-detect format. CLI is preferred; JSON is fallback.

### Anti-Pattern 4: Changing How Actions Are Stored in Session History

**What:** Storing raw CLI command strings in `session.actionHistory` instead of structured `{tool, params, result}` objects.

**Why bad:** Session management code throughout `background.js` depends on structured action records for:
- Stuck detection via action pattern analysis (lines 8396+)
- Action signature creation for failure tracking (line 9392)
- Progress tracking and reporting (line 9203)
- Memory extraction from session history
- Completion detection via action sequence analysis

All of these operate on `{tool, params}` objects, not raw strings.

**Instead:** CLI commands are parsed into `{tool, params}` before entering session state. The CLI text only exists briefly in the parser -- everything downstream sees structured objects.

### Anti-Pattern 5: Separate Batch Syntax

**What:** Creating a special CLI syntax for batch actions (e.g., `batch { click e1; type e2 "hi" }`).

**Why bad:** Unnecessary complexity. In CLI format, multiple commands on consecutive lines are naturally a batch. The existing `executeBatchActions()` function already handles arrays of `{tool, params}`.

**Instead:** If the AI outputs multiple command lines in one response, the CLI parser puts them all in the `actions` array. Background.js routes through `executeBatchActions()` when `actions.length > 1`, same as now.

---

## Suggested Build Order (Dependency-Aware)

### Phase 1: CLI Parser Module (zero dependencies)

**Create:** `ai/cli-parser.js`
- `parseCLIResponse()`, `parseCLICommand()`, `tokenize()`, `resolveTarget()`
- Pure string processing. No imports from FSB modules.
- Can be tested with sample CLI text strings in isolation.

**Why first:** Everything else depends on this module. It has zero dependencies, so it can be built and validated independently.

**Validation:** Feed sample CLI responses, verify output matches expected `{actions, taskComplete, reasoning}` shape.

### Phase 2: CLI Prompt Constants (zero dependencies)

**Create:** `ai/cli-prompt.js`
- `CLI_SYSTEM_PROMPT`, `CLI_TOOL_DOCS`, `CLI_CONTINUATION_PROMPT`, `CLI_RESPONSE_FORMAT`
- Pure string constants. No code logic.
- Can be reviewed by reading the text.

**Why second:** Depends on Phase 1 (must know exact CLI syntax to document in prompts). Has zero code dependencies.

**Validation:** Review prompt text for accuracy against Phase 1 command grammar.

### Phase 3: ai-integration.js Adaptation

**Modify:** `ai/ai-integration.js`
- Wire `parseCLIResponse()` into `parseResponse()` with dual-format auto-detection
- Replace system prompt content in `buildPrompt()` with CLI prompt constants
- Update tool documentation format in `getToolsDocumentation()`
- Adapt `isValidParsedResponse()` for CLI parse output

**Why third:** Depends on Phase 1 (parser) and Phase 2 (prompts). This is the integration layer.

**Validation:** End-to-end test with a real AI model. Verify AI outputs CLI commands and parser handles them correctly.

### Phase 4: background.js Import + Multi-Turn

**Modify:** `background.js`
- Add `importScripts('ai/cli-parser.js')` and `importScripts('ai/cli-prompt.js')`
- Verify conversation history works with CLI-format exchanges
- Verify compaction (`triggerCompaction()`) handles CLI text content

**Why fourth:** Depends on Phase 3. The imports must exist before they can be loaded.

**Validation:** Multi-iteration automation task. Verify conversation history accumulates CLI exchanges correctly.

### Phase 5: End-to-End Testing + Provider Validation

**Test across providers:**
- xAI Grok 4.1 Fast (primary model)
- GPT-4o (OpenAI)
- Claude Sonnet 4.5 (Anthropic)
- Gemini 2.5 Flash (Google)

**Measure:**
- Token reduction (compare JSON vs CLI token counts)
- Parse success rate (how often CLI parsing succeeds on first try)
- Action accuracy (does the AI output correct tool names and params in CLI format)
- Regression testing (do existing workflows still work via JSON fallback)

---

## Critical Constraints Addressed

### Chrome Extension Message Passing

The CLI format is ONLY for AI communication (AI response text -> parser -> structured objects). Chrome extension internal messaging (`chrome.tabs.sendMessage`, `chrome.runtime.sendMessage`) always uses JSON serialization internally. This is a Chrome API requirement and cannot be changed. The CLI protocol operates above this layer.

### No Build System

All new files must be vanilla JavaScript loaded via `importScripts()` in the service worker. No npm packages, no transpilation, no bundling. The CLI parser is hand-written tokenizer + switch-case command mapping.

### Service Worker Lifecycle

`background.js` is a Manifest V3 service worker that can be terminated and restarted by Chrome. The CLI parser must be stateless (pure functions, no module-level mutable state). This is naturally achieved because parsing is a pure function: text in, structured object out.

### Multi-Provider Compatibility

Different AI providers may respond to CLI format instructions differently. The dual parser (CLI + JSON fallback) ensures compatibility. The system prompt must be tested across providers to verify CLI compliance.

---

## Scalability Considerations

| Concern | Current (JSON) | CLI Protocol | Improvement |
|---------|----------------|--------------|-------------|
| AI response tokens | ~800-2000 per iteration (JSON overhead) | ~200-600 per iteration (CLI commands) | 60-70% reduction |
| Parse failure rate | 5-15% (triggers 4-strategy fallback) | <1% (line-based, deterministic) | Near-zero failures |
| Prompt tokens (system) | ~3000-4000 (JSON format docs + examples) | ~2000-3000 (CLI format docs) | ~25% reduction |
| DOM snapshot tokens | ~2000-4000 (compact snapshot) | SAME (format unchanged) | No change |
| Multi-turn context growth | JSON objects accumulate rapidly | CLI lines are 3-5x shorter per turn | 3x more turns in context window |
| Total per-session cost | 100% baseline | ~50-60% of baseline | 40-50% cost reduction |
| Parse latency | 1-5ms (JSON.parse + strategies) | <1ms (line split + regex) | Negligible improvement |

---

## Sources

**Codebase analysis (PRIMARY -- HIGH confidence):**
- `background.js` lines 7941-9400: startAutomationLoop, action dispatch, executeBatchActions
- `background.js` lines 2367-2466: sendMessageWithRetry with ref handling
- `background.js` lines 10100-10172: callAIAPI
- `ai/ai-integration.js` lines 554-700: AIIntegration class, constructor, conversation history
- `ai/ai-integration.js` lines 754-960: buildMinimalUpdate with compact snapshot embedding
- `ai/ai-integration.js` lines 1735-1934: getAutomationActions with prompt building
- `ai/ai-integration.js` lines 2129-2418: buildPrompt with system prompt construction
- `ai/ai-integration.js` lines 3956-4161: parseResponse 4-strategy pipeline, normalizeResponse
- `content/dom-analysis.js` lines 1840-2003: generateCompactSnapshot
- `content/dom-state.js` lines 610-776: RefMap class with WeakRef + selector fallback
- `content/selectors.js` lines 555-574: resolveRef
- `content/messaging.js` lines 764-888: executeAction handler with ref resolution

**Industry research (MEDIUM confidence):**
- [Playwright CLI](https://testcollab.com/blog/playwright-cli) -- 76% token reduction (114K vs 27K), YAML snapshots on disk
- [agent-browser](https://github.com/vercel-labs/agent-browser) -- @e1 ref format, 93% context reduction, 50+ CLI commands, snapshot+refs pattern
- [webctl](https://github.com/cosinusalpha/webctl) -- ARIA-based queries, CLI-first browser automation, skill-based agent integration
- [Playwright MCP](https://github.com/microsoft/playwright-mcp) -- Accessibility tree + refs (FSB already implements equivalent via compact snapshot)
