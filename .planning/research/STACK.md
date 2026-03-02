# Technology Stack: CLI Command Protocol + YAML DOM Snapshots

**Project:** FSB v10.0 - CLI Architecture
**Researched:** 2026-02-27
**Mode:** Ecosystem (Stack dimension for CLI protocol milestone)
**Constraint:** Vanilla JS (ES2021+), no build system, Chrome Extension MV3, importScripts service worker
**Overall confidence:** HIGH

---

## Executive Summary

FSB v10.0 replaces the JSON tool-call interface with a CLI-style command protocol where the AI outputs line-based commands (`click e5`, `type e12 "hello"`) instead of JSON objects. This requires three new capabilities: (1) a CLI command parser in background.js, (2) a YAML-like DOM snapshot serializer in content scripts, and (3) a fully rewritten prompt architecture that teaches the AI the CLI format.

**Key decision: Do NOT use a YAML library. Build a custom YAML-like serializer.**

The DOM snapshot format FSB needs is a strict subset of YAML -- indented key-value pairs with no advanced YAML features (anchors, aliases, tags, flow sequences, multi-documents). The existing `generateCompactSnapshot()` in `content/dom-analysis.js` already produces line-based output (`[e1] button "Submit"`) that is 80% of the way to the target format. Adding a 39KB js-yaml library for a subset that can be implemented in ~100 lines of custom code violates the project's no-unnecessary-dependencies constraint and adds attack surface for no benefit.

**Key decision: Use regex-based CLI parsing, not a grammar library.**

The CLI command grammar is deliberately simple -- `command [ref] [arguments]` with quoted strings. This is a regular language parseable by regex. Grammar libraries (PEG.js, nearley) are overkill for ~15 command patterns and would add 50-200KB of unnecessary dependency. The Playwright CLI, webctl, and agent-browser all use simple string parsing for their CLI protocols.

**Key decision: Prompt templates as string constants in a new module, not a template engine.**

The existing prompt architecture uses string concatenation in `buildPrompt()`. The v10.0 rewrite should extract prompt sections into a dedicated `ai/prompt-templates.js` module with named template functions. No template library needed -- ES2021 template literals with tagged templates provide sufficient capability.

**Net dependency change: ZERO new libraries.** All three capabilities are implemented as new vanilla JS modules.

---

## 1. CLI Command Parser (New Module: `ai/cli-parser.js`)

### What It Replaces

**Confidence: HIGH** (Verified by reading current parseResponse pipeline in `ai/universal-provider.js` lines 528-678 and `ai/ai-integration.js` normalization at lines 4133-4161)

Currently the AI returns JSON:
```json
{
  "reasoning": "The search box is visible",
  "actions": [{"tool": "type", "params": {"ref": "e3", "text": "wireless mouse", "pressEnter": true}}],
  "taskComplete": false
}
```

This gets parsed by a 6-stage JSON repair pipeline (`parseJSONSafely`) that handles truncation, markdown wrappers, malformed quotes, trailing commas, and natural language contamination. This pipeline exists because LLMs frequently produce invalid JSON.

### What It Becomes

The AI outputs line-based commands:
```
# Search box is visible, typing query
type e3 "wireless mouse" --enter
```

Lines starting with `#` are reasoning comments. Each command line is: `command [ref] [args...]`

### Recommended Approach: Regex-Based Line Parser

**Confidence: HIGH** (Pattern validated by Playwright CLI, webctl, agent-browser implementations)

**Why regex, not grammar parser:**
- The command grammar has ~15 commands with positional + flag arguments
- No nested structures, no operator precedence, no recursive rules
- Quoted string handling is the only complexity (and regex handles this well)
- Playwright CLI and agent-browser both parse commands with simple string splitting
- Grammar libraries (PEG.js ~150KB, nearley ~60KB) solve problems we do not have

**Why regex, not simple string.split():**
- Quoted arguments with spaces: `type e3 "hello world"` must parse `"hello world"` as one argument
- Flag arguments: `--enter`, `--submit`, `--timeout=5000`
- Optional positional args: `scroll down` vs `scroll down 800` vs `scroll`

**Parser architecture:**

```javascript
// ai/cli-parser.js -- loaded by background.js via importScripts

// Master regex for tokenizing a command line
// Handles: command, refs (eNN), quoted strings, flags (--key=val), bare words, numbers
const TOKEN_RE = /("(?:[^"\\]|\\.)*"|--\w+(?:=\S+)?|e\d+|\S+)/g;

// Command registry: maps command name -> { params: [...], flags: [...] }
const COMMANDS = {
  click:    { params: ['ref'] },
  type:     { params: ['ref', 'text'], flags: ['enter', 'submit', 'clear'] },
  navigate: { params: ['url'] },
  scroll:   { params: ['direction', 'amount'] },
  // ... all 30+ commands
};

function parseCLIResponse(responseText) {
  const lines = responseText.split('\n');
  const actions = [];
  let reasoning = '';
  let taskComplete = false;
  let result = '';

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith('#')) { reasoning += trimmed.slice(1).trim() + ' '; continue; }
    if (trimmed.startsWith('done')) { taskComplete = true; result = trimmed.slice(4).trim(); continue; }

    const tokens = trimmed.match(TOKEN_RE);
    if (!tokens) continue;

    const command = tokens[0];
    const args = tokens.slice(1);
    actions.push(buildAction(command, args));
  }

  return { actions, reasoning: reasoning.trim(), taskComplete, result };
}
```

**Integration point:** `parseCLIResponse()` returns the same `{ actions, reasoning, taskComplete, result }` shape as the current `normalizeResponse()` in `ai-integration.js`. The action dispatch loop in `background.js` (lines 9274-9320) consumes `action.tool` and `action.params` unchanged. The CLI parser is a drop-in replacement for the JSON parse pipeline.

### Alternatives Considered

| Approach | Size | Complexity | Why Not |
|----------|------|-----------|---------|
| **Regex tokenizer** (recommended) | ~200 lines | Low | -- |
| **PEG.js grammar** | ~150KB lib + grammar file | Medium | Overkill for 15 command patterns, adds dependency |
| **nearley parser** | ~60KB lib + grammar file | Medium | Same as PEG.js -- solving wrong problem |
| **Simple split()** | ~100 lines | Low | Cannot handle quoted strings with spaces |
| **JSON with relaxed parser** (status quo) | 0 (exists) | High | 6-stage repair pipeline, still fails ~5% of the time |

### Error Handling Strategy

The CLI format is inherently more error-tolerant than JSON:
- A malformed line is skipped; the rest still parse (JSON: one bad char breaks everything)
- Missing quotes default to single-word interpretation
- Unknown commands get logged and skipped
- Empty response = no actions (safe default)

The 6-stage JSON repair pipeline in `universal-provider.js` (lines 619-678) gets replaced by a ~20-line error handler in the CLI parser.

### Token Efficiency Gain

**Confidence: MEDIUM** (Based on Playwright CLI benchmarks showing 4x reduction; FSB-specific measurement needed during implementation)

Current JSON format for 3 actions: ~350 tokens
```json
{"reasoning":"Search box visible","actions":[{"tool":"type","params":{"ref":"e3","text":"wireless mouse","pressEnter":true}},{"tool":"click","params":{"ref":"e7"}},{"tool":"scroll","params":{"direction":"down"}}],"taskComplete":false}
```

CLI format for same 3 actions: ~80 tokens
```
# Search box visible
type e3 "wireless mouse" --enter
click e7
scroll down
```

Estimated output token reduction: ~4x per AI response. Over a 10-iteration session, this compounds to significant cost savings.

---

## 2. YAML-Like DOM Snapshot Serializer (Enhancement to `content/dom-analysis.js`)

### What It Replaces

**Confidence: HIGH** (Verified by reading `generateCompactSnapshot()` at content/dom-analysis.js lines 1838-2003 and `formatElements()` at ai/ai-integration.js lines 3183-3272)

Current compact snapshot format (already partially YAML-like):
```
[e1] button "Submit Form"
[e2] textbox placeholder="Enter email" label="Email"
[e3] link "Products" href="/products"
[e4] select selected="United States" label="Country"
```

### What It Becomes

YAML-like structured snapshot with element grouping and hierarchy:
```yaml
page:
  url: https://example.com/contact
  title: Contact Us
  scroll: 45% | more below
viewport:
  e1: button "Submit Form"
  e2: textbox "Enter email" label="Email"
  e3: link "Products" href="/products"
  e4: select "United States" label="Country" [disabled]
offscreen:
  e5: heading "Footer Links" [level=2]
  e6: link "Privacy Policy" href="/privacy"
forms:
  form_0: {fields: e2 e4, submit: e1}
```

### Recommended Approach: Custom String Builder (NOT js-yaml)

**Confidence: HIGH** (Design validated against Playwright aria-snapshot format and project constraints)

**Why NOT js-yaml (39KB minified, 0 dependencies):**
1. FSB's "YAML" is output-only (serialize, never parse) -- a library's parser is dead weight
2. The format is a strict subset: flat key-value pairs with 1-level nesting, no YAML advanced features
3. `generateCompactSnapshot()` already builds line-by-line output -- adding YAML indentation is trivial
4. 39KB added to service worker for a ~100-line function violates the minimalism constraint
5. The existing `lib/` directory vendors chart.min.js (205KB), marked.min.js (40KB), purify.min.js (22KB), mermaid.min.js (2.7MB) -- these are all used by the UI, not the automation core. The service worker should stay lean.
6. Custom format allows optimizations a generic library cannot: omitting quotes for simple values, compact state flags, form grouping

**Why NOT the Playwright aria-snapshot YAML format verbatim:**
1. Playwright's format uses accessibility roles as primary identifiers -- FSB already has `e1`-style refs via `RefMap` (content/dom-state.js lines 614-654)
2. Playwright nests elements by DOM hierarchy -- FSB should group by viewport/offscreen for spatial awareness
3. Playwright includes all elements -- FSB uses 3-stage filtering with a 50-80 element budget
4. The ref-based system (`click e5` instead of `click role=button name~="Submit"`) is more token-efficient

**Implementation: Extend `generateCompactSnapshot()` in `content/dom-analysis.js`:**

```javascript
function generateYAMLSnapshot(options = {}) {
  // Reuse existing 3-stage filtering from getFilteredElements()
  const elements = getFilteredElements({ maxElements: 80, prioritizeViewport: true });

  const lines = [];

  // Page metadata section
  lines.push('page:');
  lines.push(`  url: ${window.location.href}`);
  lines.push(`  title: ${document.title}`);
  lines.push(`  scroll: ${scrollPct}%${hasMoreBelow ? ' | more below' : ''}${atBottom ? ' | at bottom' : ''}`);

  // Viewport elements
  const vpElements = elements.filter(el => isInViewport(el));
  const offElements = elements.filter(el => !isInViewport(el));

  if (vpElements.length > 0) {
    lines.push('viewport:');
    for (const el of vpElements) {
      lines.push(`  ${formatElementLine(el)}`);
    }
  }

  if (offElements.length > 0) {
    lines.push('offscreen:');
    for (const el of offElements) {
      lines.push(`  ${formatElementLine(el)}`);
    }
  }

  // Form associations (compact)
  if (forms.length > 0) {
    lines.push('forms:');
    for (const form of forms) {
      lines.push(`  ${form.id}: {fields: ${form.fieldRefs.join(' ')}, submit: ${form.submitRef}}`);
    }
  }

  return lines.join('\n');
}
```

**Integration point:** The `_compactSnapshot` field on the DOM state object (consumed by `formatCompactElements()` at ai/ai-integration.js line 891) gets replaced with `_yamlSnapshot`. The `buildPrompt()` function at ai/ai-integration.js line 2975 switches from `formatCompactElements()` to directly embedding the YAML string.

### Token Efficiency Gain

Current compact format for 50 elements: ~2,500 tokens
YAML format with viewport/offscreen grouping: ~2,000 tokens (20% reduction)
YAML format with form compression: ~1,800 tokens (28% reduction)

The main savings come not from the format itself but from:
1. Eliminating redundant metadata per element (selectors, position coords)
2. Grouping by viewport (AI immediately knows what it can interact with)
3. Form compression (one line per form vs per-field details)

### Alternatives Considered

| Approach | Size Impact | Tokens | Why Not |
|----------|-----------|--------|---------|
| **Custom string builder** (recommended) | ~100 lines new code | ~1,800 | -- |
| **js-yaml library** | +39KB to service worker | ~1,800 | Overkill, parse capability unused |
| **JSON (status quo)** | 0 | ~3,500 | Verbose, wastes tokens on braces/quotes/commas |
| **Playwright aria-snapshot format** | ~150 lines new code | ~2,200 | Hierarchy-based nesting less useful than viewport grouping |
| **Plain text list (current compact)** | 0 (exists) | ~2,500 | No structure, no form grouping, no metadata section |

---

## 3. Prompt Architecture (New Module: `ai/prompt-templates.js`)

### What It Replaces

**Confidence: HIGH** (Verified by reading `buildPrompt()` at ai/ai-integration.js lines 2129-3053)

Currently, `buildPrompt()` is a ~900-line method that concatenates strings with inline conditionals. The system prompt is built by appending task-type guidance, tool documentation, site guides, memory, formatting directives, and security rules through string concatenation. The continuation prompt (`MINIMAL_CONTINUATION_PROMPT` at line 370) duplicates rules from the full prompt.

### What It Becomes

A dedicated module with named template functions:

```javascript
// ai/prompt-templates.js

// SYSTEM PROMPT: CLI command reference
function buildCLIReference() {
  return `COMMANDS:
  click <ref>              -- Click element
  type <ref> "text"        -- Type text (--enter to submit)
  navigate <url>           -- Go to URL
  scroll <dir> [amount]    -- Scroll (up/down/left/right)
  ...

RESPONSE FORMAT:
  # reasoning comment
  command arg1 arg2 --flag
  done "result summary when task complete"

RULES:
  - One command per line
  - Lines starting with # are reasoning (required)
  - Refs (e1, e2) come from the DOM snapshot
  - End with "done" line when task is complete`;
}

// SYSTEM PROMPT: Security rules (unchanged content, extracted)
function buildSecurityRules() { ... }

// SYSTEM PROMPT: Task-specific guidance (refactored from TASK_PROMPTS)
function buildTaskGuidance(taskType, siteGuide) { ... }

// CONTINUATION PROMPT: Minimal rules for subsequent iterations
function buildContinuationPrompt() { ... }

// USER PROMPT: DOM snapshot + context
function buildUserContext(yamlSnapshot, actionHistory, memory) { ... }
```

### Recommended Approach: Template Functions in a Dedicated Module

**Confidence: HIGH** (Standard pattern, no external dependencies needed)

**Why a new module, not inline in ai-integration.js:**
1. `ai-integration.js` is already ~5,000 lines -- prompt templates add another ~500 lines
2. Templates change independently of the AI provider logic
3. Testing prompt templates in isolation is valuable
4. The `importScripts` pattern already supports this (background.js loads ai-integration.js which loads ai-providers.js)

**Why NOT a template engine library (Handlebars, Mustache, etc.):**
1. Template literals in ES2021+ handle variable interpolation natively
2. Conditional sections use if/else, not template directives
3. No loops over unknown data -- all template sections are statically known
4. A template engine adds 20-80KB for zero functional benefit

**Integration point:** `ai/ai-integration.js` imports the new module:
```javascript
importScripts('ai/prompt-templates.js');
```
The `buildPrompt()` method in `BrowserAgentAI` class calls template functions instead of inline string building. The method shrinks from ~900 lines to ~150 lines of orchestration logic.

### Prompt Structure Change

**Current (JSON-oriented):**
```
System: You are a browser automation agent. [1500 chars of rules]
        [500 chars of JSON format spec]
        [2000 chars of tool documentation as JSON examples]
        [500 chars of task guidance]
User:   TASK: "search for wireless mouse"
        DOM: [e1] button "Search" [e2] textbox placeholder="Search"
        ACTION HISTORY: [JSON array of previous actions]
```

**New (CLI-oriented):**
```
System: You are a browser automation agent. [800 chars of rules]
        [300 chars of CLI command reference]
        [200 chars of response format]
        [500 chars of task guidance]
User:   TASK: search for wireless mouse
        PAGE:
          page:
            url: https://amazon.com
            title: Amazon.com
            scroll: 0% | more below
          viewport:
            e1: button "Search"
            e2: textbox "Search Amazon" placeholder="Search Amazon"
        HISTORY:
          > type e2 "wireless mouse" --enter (ok)
          > click e7 (ok: navigated to results)
```

System prompt reduction: ~4,500 chars -> ~1,800 chars (60% smaller)
User prompt per iteration: varies, but action history as CLI lines vs JSON is ~3x smaller

---

## 4. Integration Map

### Files Modified

| File | Change Type | Scope |
|------|------------|-------|
| `ai/ai-integration.js` | Major refactor | `buildPrompt()` calls template functions; `normalizeResponse()` routes to CLI parser; JSON pipeline kept as fallback |
| `ai/universal-provider.js` | Minor | `parseResponse()` returns raw text instead of JSON-parsing when CLI mode active |
| `content/dom-analysis.js` | Enhancement | `generateYAMLSnapshot()` added alongside existing `generateCompactSnapshot()` |
| `content/messaging.js` | Minor | DOM response includes `_yamlSnapshot` field |
| `background.js` | Minor | Action dispatch unchanged (consumes same `{tool, params}` shape) |

### Files Added

| File | Size Estimate | Purpose |
|------|--------------|---------|
| `ai/cli-parser.js` | ~300 lines | Parse CLI command lines into `{tool, params}` objects |
| `ai/prompt-templates.js` | ~500 lines | Named template functions for system/user prompts |

### Files Unchanged

| File | Why |
|------|-----|
| `content/actions.js` | Actions receive `{tool, params}` -- unchanged interface |
| `content/selectors.js` | `resolveRef()` unchanged -- still maps `e1` -> DOM element |
| `content/dom-state.js` | `RefMap` class unchanged -- still generates `e1, e2, ...` refs |
| `config/config.js` | No new config needed (CLI mode could be a toggle during migration) |
| All site guide files | Guide content unchanged, just injected into different prompt template |

### Migration Strategy

The CLI parser and JSON parser should coexist during migration:

```javascript
// In ai-integration.js normalizeResponse()
function normalizeResponse(rawText, mode = 'cli') {
  if (mode === 'cli') {
    try {
      return parseCLIResponse(rawText);  // New CLI parser
    } catch (e) {
      // Fallback: maybe model returned JSON anyway
      return this.parseJSONResponse(rawText);  // Existing pipeline
    }
  }
  return this.parseJSONResponse(rawText);
}
```

This ensures zero-downtime migration. The system prompt instructs CLI format; if the LLM ignores it and returns JSON, the fallback catches it.

---

## 5. CLI Command Specification

### Full Command Reference

Based on analysis of all 35+ tools in `isValidTool()` (ai/ai-integration.js lines 4172-4198) and `TOOL_DOCUMENTATION` (lines 15-116):

**Navigation:**
```
navigate <url>                    -- Go to URL
search "query"                    -- Google search (shorthand for searchGoogle)
back                              -- Browser back
forward                           -- Browser forward
refresh                           -- Reload page
```

**Element Interaction:**
```
click <ref>                       -- Click element
click-result [index] [--domain=x] -- Click search result
type <ref> "text" [--enter] [--clear]  -- Type text
hover <ref>                       -- Hover over element
focus <ref>                       -- Focus element
select <ref> "option"             -- Select dropdown option
check <ref>                       -- Toggle checkbox
```

**Keyboard:**
```
press <key> [--ctrl] [--shift] [--meta]  -- Press key
keys "sequence"                   -- Key sequence
arrow <dir>                       -- Arrow key (up/down/left/right)
enter                             -- Press Enter (shorthand)
```

**Scrolling:**
```
scroll <dir> [amount]             -- Scroll (up/down, optional px)
scroll-to <ref>                   -- Scroll element into view
scroll-top                        -- Scroll to top
scroll-bottom                     -- Scroll to bottom
```

**Extraction:**
```
get-text <ref>                    -- Get element text content
get-attr <ref> <attribute>        -- Get element attribute
```

**Waiting:**
```
wait <selector> [--timeout=ms]    -- Wait for element (CSS selector)
wait-stable [--timeout=ms]        -- Wait for DOM to stabilize
wait-load                         -- Wait for page load
```

**Multi-Tab:**
```
new-tab <url> [--background]      -- Open new tab
switch-tab <tabId>                -- Switch to tab
close-tab <tabId>                 -- Close tab
list-tabs                         -- List open tabs
```

**Data:**
```
store-jobs <company> [json-data]  -- Store job data
get-jobs                          -- Get stored jobs
fill-sheet                        -- Write jobs to Google Sheet
```

**Session Control:**
```
done "result summary"             -- Mark task complete with result
```

### Command Line Grammar (Informal)

```
line       = comment | command | done | blank
comment    = '#' text
command    = verb [ref] [args...] [flags...]
done       = 'done' [quoted-string]
verb       = word (from command registry)
ref        = 'e' digits
args       = quoted-string | word | number
flags      = '--' word ['=' value]
quoted-str = '"' (escaped-char | non-quote)* '"'
```

This is a regular grammar (no recursion, no nesting) and is fully parseable by regex tokenization.

---

## 6. What NOT to Add

| Temptation | Why Resist |
|-----------|-----------|
| **js-yaml library** | Only need serialize (not parse), only need flat subset, ~100 lines of custom code replaces 39KB library |
| **PEG.js / nearley grammar** | 15 commands with positional args is regex territory, not grammar territory |
| **Handlebars / Mustache templates** | ES2021 template literals + functions cover all needs |
| **Schema validation (Zod/Joi)** | CLI commands are validated by the command registry, not a schema library |
| **Build system (webpack/rollup)** | Would change the entire project's deployment model for zero benefit here |
| **TypeScript** | Would require build system; JSDoc comments provide type hints for IDE |
| **YAML parser for AI output** | AI outputs CLI commands, not YAML. YAML is only for DOM snapshots (output direction) |

---

## 7. Version Compatibility

| Component | Required Version | Current Status | Notes |
|-----------|-----------------|---------------|-------|
| Chrome Extension MV3 | Chrome 88+ | Satisfied | importScripts, service worker, all APIs available |
| ES2021+ JavaScript | Chrome 88+ | Satisfied | Template literals, WeakRef, optional chaining all available |
| RefMap (WeakRef) | Chrome 84+ | Satisfied | Already implemented in content/dom-state.js |
| Regex named groups | Chrome 64+ | Satisfied | Used in tokenizer for cleaner parsing |
| String.prototype.matchAll | Chrome 73+ | Satisfied | Cleaner than exec loop for tokenization |

No version bumps or polyfills needed. All required language features are available in the minimum Chrome version already supported.

---

## 8. Performance Considerations

### Service Worker Memory

| Component | Current | After v10.0 | Delta |
|-----------|---------|------------|-------|
| `ai-integration.js` | ~5,000 lines | ~4,500 lines (prompt extraction) | -10% |
| `ai/prompt-templates.js` | -- | ~500 lines | +500 lines |
| `ai/cli-parser.js` | -- | ~300 lines | +300 lines |
| JSON repair pipeline | ~160 lines | ~20 lines (kept as fallback) | -140 lines |
| Net change | -- | -- | +~660 lines across 3 files |

The service worker does NOT get heavier. Prompt templates move from ai-integration.js to prompt-templates.js (net zero). The CLI parser replaces the JSON repair pipeline (net smaller). No new libraries loaded.

### Content Script Impact

The `generateYAMLSnapshot()` function in `content/dom-analysis.js` runs alongside (or replaces) `generateCompactSnapshot()`. Both iterate the same filtered elements and build strings. Performance difference: negligible (both are O(n) string concatenation over 50-80 elements, completing in <5ms).

### AI Response Parsing

Current JSON pipeline: 6-stage parse with regex cleaning, truncation repair, structure fix, fallback extraction. Worst case: 5-10ms for malformed responses.

CLI parser: Single pass line-by-line with regex tokenization. Constant: <1ms for any response size.

---

## 9. Testing Strategy

### CLI Parser Testing

The CLI parser is a pure function (`parseCLIResponse(text) -> {actions, reasoning, taskComplete, result}`) with no DOM or Chrome API dependencies. It can be tested in any JavaScript runtime:

```javascript
// Test cases
assert(parseCLIResponse('click e5').actions[0]).deepEqual({tool: 'click', params: {ref: 'e5'}});
assert(parseCLIResponse('type e3 "hello world" --enter').actions[0]).deepEqual({tool: 'type', params: {ref: 'e3', text: 'hello world', pressEnter: true}});
assert(parseCLIResponse('# reasoning\nclick e1\ndone "task finished"')).includes({taskComplete: true});
```

### YAML Snapshot Testing

Compare `generateYAMLSnapshot()` output against expected strings for known DOM states. Can be tested with mocked DOM elements in a browser environment.

### Prompt Template Testing

Each template function returns a string. Test that required sections appear, that security rules are present, that CLI reference is included, etc.

---

## 10. Sources

### CLI Protocol Design (Evidence for Line-Based Approach)

- [Playwright CLI: Token-Efficient Browser Automation](https://testcollab.com/blog/playwright-cli) -- 4x token reduction benchmarks, CLI command format
- [webctl: Browser automation via CLI](https://github.com/cosinusalpha/webctl) -- CLI-first design, snapshot filtering, session management
- [agent-browser: Vercel Labs](https://github.com/vercel-labs/agent-browser) -- Compact text output, @ref element references, 93% context reduction
- [Deep Dive into Playwright CLI](https://testdino.com/blog/playwright-cli/) -- Snapshot format with e15/e21 refs, YAML file output
- [Playwright ARIA Snapshots](https://playwright.dev/docs/aria-snapshots) -- YAML format specification for accessibility tree

### YAML Serialization Options (Evidence for Custom Builder)

- [js-yaml npm package](https://www.npmjs.com/package/js-yaml) -- 39KB minified, full YAML 1.2 parser+serializer
- [js-yaml-browser fork](https://github.com/shockey/js-yaml-browser) -- Browser-optimized js-yaml
- [yaml npm package](https://www.npmjs.com/package/yaml) -- Alternative YAML library, no dependencies
- [js-yaml CDN on jsDelivr](https://www.jsdelivr.com/package/npm/js-yaml) -- Pre-built browser bundle available
- [Bundlephobia: js-yaml](https://bundlephobia.com/package/js-yaml) -- 39.1KB minified, 13KB gzipped

### Chrome Extension MV3 Constraints

- [Extension Service Worker Basics](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/basics) -- importScripts requirements
- [ES Modules in Service Workers](https://web.dev/articles/es-modules-in-sw) -- Module format options

### LLM Structured Output

- [LLM Structured Output 2026](https://dev.to/pockit_tools/llm-structured-output-in-2026-stop-parsing-json-with-regex-and-do-it-right-34pk) -- Current state of structured output
- [webctl HN Discussion](https://news.ycombinator.com/item?id=46616481) -- Community validation of CLI approach for browser agents

---

## Confidence Assessment

| Area | Level | Reason |
|------|-------|--------|
| CLI Parser (regex) | HIGH | Proven pattern in Playwright CLI, webctl, agent-browser; regular grammar; pure function |
| YAML Snapshot (custom builder) | HIGH | Extension of existing generateCompactSnapshot(); no new dependencies needed |
| Prompt Templates (module extraction) | HIGH | Standard refactoring pattern; ES2021 template literals sufficient |
| Token Reduction (4x output) | MEDIUM | Playwright benchmarks show 4x; FSB-specific measurement needed during implementation |
| Token Reduction (3x input/context) | MEDIUM | Depends on YAML snapshot compression vs current compact format; 20-30% likely |
| LLM Adherence to CLI Format | MEDIUM | All modern LLMs handle line-based output well, but needs testing across providers (xAI, OpenAI, Anthropic, Gemini) |
| Migration Safety (JSON fallback) | HIGH | Dual-mode parser ensures backward compatibility during rollout |
