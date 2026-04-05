# Phase 15: CLI Parser Module - Research

**Researched:** 2026-02-27
**Domain:** Line-based CLI text parser for browser automation commands (vanilla JavaScript, Chrome Extension context)
**Confidence:** HIGH

## Summary

This phase builds a standalone parser module (`ai/cli-parser.js`) that converts line-based CLI text into the `{tool, params}` action objects that FSB's content script already dispatches on. The parser has zero dependencies on existing code and zero external libraries -- it is pure vanilla JavaScript string parsing.

The core problem is well-understood: take multi-line text like `click e5\ntype e12 "hello world"\ndone "task complete"` and produce an array of objects like `[{tool:"click", params:{ref:"e5"}}, {tool:"type", params:{ref:"e12", text:"hello world"}}]` plus a signal `{taskComplete: true, result: "task complete"}`. This is a tokenizer + argument parser, not a full language parser. The grammar is regular (no nesting, no recursion), so a state-machine tokenizer with per-verb argument schemas is the correct architecture.

The critical constraint is output compatibility: the parser must produce `{tool, params}` objects **identical** to what `FSB.tools[tool](params)` expects in `content/actions.js`. The existing codebase has 40+ tools with specific param shapes (some take `{selector}`, some take `{ref}`, some take `{url}`, some take `{key, ctrlKey, shiftKey}`, some take no params at all). The parser must know the argument schema for each verb to correctly assign positional args to named params.

**Primary recommendation:** Build a two-layer parser: (1) a generic tokenizer that splits each line into `[verb, ...tokens]` handling quoted strings and flags, and (2) a verb-specific argument mapper that uses a `COMMAND_REGISTRY` lookup table to assign tokens to the correct param names. The registry also maps CLI aliases to canonical tool names.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Accept both original camelCase tool names (selectOption, keyPress, goBack) AND shorter CLI-friendly aliases
- Aliases always map to canonical tool names internally; original names always work
- Claude has discretion on choosing the most natural short alias for each command (e.g., `select` vs `select-option`)
- All 28+ existing tools get CLI verb equivalents from day one -- full parity, no staged rollout
- Two signal commands beyond existing tools: `done` (task complete) and `fail` (task cannot be completed)
- Positional arguments: parser knows arg order per verb (e.g., `type e12 "hello"` = ref first, text second)
- Optional arguments use double-dash flags: `scroll down --amount 500`, `click e5 --force`
- Boolean flags supported without values: `--force` means true, absence means false
- Quoted strings support both backslash escaping (`"He said \"hello\""`) and alternate quote types (`'He said "hello"'`)
- URLs must always be quoted: `navigate "https://example.com/path?q=test"`
- Element targeting accepts both refs (e5) and quoted CSS selectors ("#submit-btn") -- parser distinguishes by format
- Scroll uses shorthand verb-direction commands (scrollDown, scrollUp, etc.) rather than `scroll down`
- Tab management uses individual flat verbs (openTab, switchTab, closeTab, listTabs) not grouped sub-commands
- Signal commands (done, fail) take an optional quoted message: `done "task complete"` or bare `done`
- Case-insensitive for command verbs: CLICK, Click, click all normalize to `click`
- Empty lines and whitespace-only lines silently skipped -- no errors, no logging
- Unknown verbs: skip with warning logged, continue parsing remaining lines
- Strict parsing only: no auto-correction of malformed input (missing quotes, extra punctuation). If it doesn't match the grammar, it's a parse error for that line
- Per CLI-06: parse errors on individual lines are isolated -- valid commands before and after still execute

### Claude's Discretion
- Exact short alias names for each tool (single-word shortened vs hyphenated vs other)
- How ref-less commands handle their direct arguments (no placeholder vs placeholder convention)
- Internal parser architecture and data structures
- Error message formatting and warning log format

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CLI-01 | AI outputs line-based CLI commands (one command per line) instead of JSON tool calls, and the parser extracts verb, ref, and arguments from each line | Tokenizer layer splits lines, extracts verb + tokens; verb registry maps tokens to params. Architecture section details the two-layer approach. |
| CLI-02 | Quoted string arguments are parsed correctly including escaped quotes, URLs with special characters, and multi-word values | Tokenizer state machine handles 4 states (NORMAL, DOUBLE_QUOTED, SINGLE_QUOTED, FLAG). Escape handling and URL patterns documented in Code Examples. |
| CLI-03 | Multiple command lines in a single AI response are treated as a batch and executed sequentially with DOM stability checks between each | Parser returns `{actions: [...], reasoning: [...], taskComplete, result}` array. Background.js batch execution (existing) handles sequential dispatch. Note: DOM stability checks are outside parser scope (background.js responsibility). |
| CLI-04 | Comment lines (prefixed with #) are captured as AI reasoning/analysis without being executed as actions | First-pass line classification: lines starting with `#` (after trim) go to `reasoning[]` array, not `actions[]`. |
| CLI-05 | The parser produces {tool, params} objects identical to the current action dispatch format so content script execution is unchanged | COMMAND_REGISTRY defines exact param mapping per tool, validated against every tool in `content/actions.js`. Compatibility table in Architecture Patterns section. |
| CLI-06 | Parse failures on individual lines are isolated -- valid commands before and after a malformed line still execute | Per-line try/catch in parse loop. Failed lines produce `{error, line, lineNumber}` entries in a separate `errors[]` array. Valid actions accumulate regardless. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vanilla JavaScript | ES2021+ | Parser implementation | Project mandate: no build system, no bundler, no npm. `importScripts` pattern in Chrome Extension service worker. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| None | -- | -- | No dependencies. This is a pure string-parsing module. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-rolled tokenizer | nearley.js / chevrotain / PEG.js | Grammar is regular (no nesting/recursion), making a full parser generator overkill. Also violates project "no npm/bundler" mandate. |
| State-machine tokenizer | Regex-based split | Regex cannot handle nested quoting (e.g., escaped quotes inside quoted strings) without fragile lookahead patterns. State machine is more reliable and readable. |
| Per-verb switch statement | Lookup table (COMMAND_REGISTRY) | Lookup table is extensible without code changes; switch statement grows linearly. |

**Installation:** None required. Single JS file loaded via `importScripts('ai/cli-parser.js')` in the background service worker.

## Architecture Patterns

### Recommended Project Structure
```
ai/
  cli-parser.js          # The parser module (this phase)
  ai-integration.js      # Existing -- will import parser in Phase 18
```

### Pattern 1: Two-Layer Parser Architecture
**What:** Separate the generic tokenizer (string splitting) from the verb-specific argument mapper (semantic interpretation).

**When to use:** Always. This is the core architecture.

**Layer 1 -- Tokenizer:** Takes a single line string, returns `{verb: string, tokens: string[], flags: {string: string|boolean}}`. Handles quoting, escaping, flag extraction.

**Layer 2 -- Command Mapper:** Takes tokenizer output, looks up verb in COMMAND_REGISTRY, assigns positional tokens to named params according to the verb's schema, merges flags.

```javascript
// Layer 1: Tokenizer
function tokenizeLine(line) {
  // Returns { verb: 'type', tokens: ['e12', 'hello world'], flags: { enter: true } }
  // from input: type e12 "hello world" --enter
}

// Layer 2: Command Mapper
function mapCommand(tokenized) {
  const def = COMMAND_REGISTRY[tokenized.verb.toLowerCase()];
  if (!def) return { error: `Unknown command: ${tokenized.verb}` };

  const params = {};
  // Assign positional tokens based on def.args schema
  for (let i = 0; i < def.args.length && i < tokenized.tokens.length; i++) {
    params[def.args[i].name] = tokenized.tokens[i];
  }
  // Merge flags
  Object.assign(params, tokenized.flags);

  return { tool: def.canonicalTool, params };
}
```

### Pattern 2: COMMAND_REGISTRY Lookup Table
**What:** A single object mapping every CLI verb (including aliases) to its canonical tool name and argument schema.

**When to use:** Every command lookup. This is the single source of truth for CLI-to-tool mapping.

**Example:**
```javascript
const COMMAND_REGISTRY = {
  // Direct tool name (always works)
  click:         { tool: 'click',         args: [{name: 'ref', type: 'ref'}] },
  type:          { tool: 'type',          args: [{name: 'ref', type: 'ref'}, {name: 'text', type: 'string'}] },
  navigate:      { tool: 'navigate',      args: [{name: 'url', type: 'string'}] },

  // Alias -> canonical mapping
  goto:          { tool: 'navigate',      args: [{name: 'url', type: 'string'}] },
  search:        { tool: 'searchGoogle',  args: [{name: 'query', type: 'string'}] },
  enter:         { tool: 'pressEnter',    args: [{name: 'ref', type: 'ref', optional: true}] },

  // Signal commands (not dispatched as actions)
  done:          { tool: '__signal_done', args: [{name: 'message', type: 'string', optional: true}], signal: true },
  fail:          { tool: '__signal_fail', args: [{name: 'message', type: 'string', optional: true}], signal: true },
};
```

### Pattern 3: Ref vs CSS Selector Discrimination
**What:** The parser must distinguish between element refs (`e5`, `e123`) and quoted CSS selectors (`"#submit-btn"`, `".nav-link"`).

**When to use:** Every command that accepts an element target.

**Rule:** If a token matches `/^e\d+$/i`, treat as a ref (`params.ref = token`). If a token is a quoted string that doesn't match the ref pattern, treat as a CSS selector (`params.selector = token`).

```javascript
function classifyTarget(token) {
  if (/^e\d+$/i.test(token)) {
    return { ref: token.toLowerCase() };
  }
  // Already unquoted by tokenizer -- this is a CSS selector
  return { selector: token };
}
```

### Pattern 4: Per-Line Error Isolation
**What:** Each line is parsed independently inside a try/catch. Parse failures produce error entries but do not abort the batch.

**When to use:** Always -- this is a hard requirement (CLI-06).

```javascript
function parseResponse(text) {
  const lines = text.split('\n');
  const result = { actions: [], reasoning: [], errors: [], taskComplete: false, result: null };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip empty lines
    if (!trimmed) continue;

    // Capture reasoning
    if (trimmed.startsWith('#')) {
      result.reasoning.push(trimmed.substring(1).trim());
      continue;
    }

    try {
      const tokenized = tokenizeLine(trimmed);
      const mapped = mapCommand(tokenized);

      if (mapped.error) {
        result.errors.push({ line: trimmed, lineNumber: i + 1, error: mapped.error });
        continue;
      }

      if (mapped.signal === 'done') {
        result.taskComplete = true;
        result.result = mapped.message || 'Task completed';
        continue;
      }
      if (mapped.signal === 'fail') {
        result.taskComplete = true;
        result.result = mapped.message || 'Task failed';
        result.taskFailed = true;
        continue;
      }

      result.actions.push({ tool: mapped.tool, params: mapped.params });
    } catch (err) {
      result.errors.push({ line: trimmed, lineNumber: i + 1, error: err.message });
    }
  }

  return result;
}
```

### Anti-Patterns to Avoid
- **Regex-only parsing:** Do not try to parse the entire grammar with a single regex or chained regexes. Quoted strings with escapes, nested quotes, and flags make regex fragile. Use a state machine.
- **Global mutable state:** The parser must be stateless -- no class instances, no stored state between calls. Each `parseResponse(text)` call is independent.
- **Hardcoded command lists in multiple places:** All command knowledge lives in COMMAND_REGISTRY. Don't duplicate verb lists or param schemas elsewhere.
- **Attempting to auto-correct malformed input:** Per user decision, strict parsing only. If input is malformed, produce a parse error for that line. Don't guess intent.

## Complete Tool-to-CLI Mapping

This is the exhaustive list of all tools found in `content/actions.js` (lines 979-3731) and `background.js` (lines 5967), with their parameter shapes and recommended CLI syntax.

### Element-Targeting Commands (take ref or selector)
| Tool Name (canonical) | Params | CLI Syntax | CLI Alias |
|----------------------|--------|------------|-----------|
| `click` | `{ref/selector}` | `click e5` | -- |
| `rightClick` | `{ref/selector}` | `rightClick e5` | `rclick` |
| `doubleClick` | `{ref/selector}` | `doubleClick e5` | `dblclick` |
| `type` | `{ref/selector, text}` | `type e5 "hello world"` | -- |
| `clearInput` | `{ref/selector}` | `clearInput e5` | `clear` |
| `focus` | `{ref/selector}` | `focus e5` | -- |
| `blur` | `{ref/selector}` | `blur e5` | -- |
| `hover` | `{ref/selector}` | `hover e5` | -- |
| `selectText` | `{ref/selector}` | `selectText e5` | -- |
| `selectOption` | `{ref/selector, value/text/index}` | `selectOption e5 "Option A"` | `select` |
| `toggleCheckbox` | `{ref/selector, checked?}` | `toggleCheckbox e5` | `check` |
| `pressEnter` | `{ref/selector (optional)}` | `pressEnter e5` or `pressEnter` | `enter` |
| `getText` | `{ref/selector}` | `getText e5` | -- |
| `getAttribute` | `{ref/selector, attribute}` | `getAttribute e5 "href"` | `getattr` |
| `setAttribute` | `{ref/selector, attribute, value}` | `setAttribute e5 "disabled" "true"` | `setattr` |
| `scrollToElement` | `{ref/selector}` | `scrollToElement e5` | -- |
| `clickSearchResult` | `{ref/selector, index?}` | `clickSearchResult e5` | -- |
| `waitForElement` | `{selector, timeout?}` | `waitForElement "#results" --timeout 5000` | `wait` |

### Ref-less Commands (no element target)
| Tool Name (canonical) | Params | CLI Syntax | CLI Alias |
|----------------------|--------|------------|-----------|
| `navigate` | `{url}` | `navigate "https://example.com"` | `goto` |
| `searchGoogle` | `{query}` | `searchGoogle "wireless mouse"` | `search` |
| `scroll` | `{direction/amount}` | `scroll down` or `scroll --amount 500` | -- |
| `scrollDown` | (none -- decision says shorthand verbs) | `scrollDown` | -- |
| `scrollUp` | (none) | `scrollUp` | -- |
| `scrollToTop` | (none) | `scrollToTop` | -- |
| `scrollToBottom` | (none) | `scrollToBottom` | -- |
| `refresh` | (none) | `refresh` | -- |
| `goBack` | (none) | `goBack` | `back` |
| `goForward` | (none) | `goForward` | `forward` |
| `keyPress` | `{key, ctrlKey?, shiftKey?, altKey?, metaKey?}` | `keyPress "Tab"` or `keyPress "a" --ctrl` | `key` |
| `pressKeySequence` | `{keys}` | `pressKeySequence "Tab,Enter,Escape"` | -- |
| `typeWithKeys` | `{text}` | `typeWithKeys "hello"` | -- |
| `sendSpecialKey` | `{specialKey}` | `sendSpecialKey "Ctrl+a"` | `special` |
| `arrowUp` | (none) | `arrowUp` | -- |
| `arrowDown` | (none) | `arrowDown` | -- |
| `arrowLeft` | (none) | `arrowLeft` | -- |
| `arrowRight` | (none) | `arrowRight` | -- |
| `moveMouse` | `{x, y}` | `moveMouse 150 250` | -- |
| `solveCaptcha` | (none) | `solveCaptcha` | `captcha` |
| `waitForDOMStable` | `{timeout?, stableTime?}` | `waitForDOMStable --timeout 5000` | `waitStable` |
| `detectLoadingState` | (none) | `detectLoadingState` | -- |
| `verifyMessageSent` | `{selector?}` | `verifyMessageSent` | -- |
| `getEditorContent` | `{selector?}` | `getEditorContent` | -- |
| `gameControl` | `{action}` | `gameControl "fire"` | `game` |

### Multi-Tab Commands
| Tool Name (canonical) | Params | CLI Syntax | CLI Alias |
|----------------------|--------|------------|-----------|
| `openNewTab` | `{url?, active?}` | `openTab "https://example.com"` | `openTab` |
| `switchToTab` | `{tabId}` | `switchTab 123` | `switchTab` |
| `closeTab` | `{tabId}` | `closeTab 123` | `closeTab` |
| `listTabs` | (none) | `listTabs` | `tabs` |
| `getCurrentTab` | (none) | `getCurrentTab` | -- |
| `waitForTabLoad` | `{tabId, timeout?}` | `waitForTabLoad 123 --timeout 30000` | -- |

### Background-Handled Data Tools
| Tool Name (canonical) | Params | CLI Syntax | CLI Alias |
|----------------------|--------|------------|-----------|
| `storeJobData` | `{company, jobs: [...]}` (complex JSON) | `storeJobData {...json...}` | -- |
| `getStoredJobs` | (none) | `getStoredJobs` | -- |
| `fillSheetData` | (none/minimal) | `fillSheetData` | -- |

### Signal Commands (not dispatched as actions)
| Command | Params | CLI Syntax |
|---------|--------|------------|
| `done` | `{message?}` | `done "task complete"` or `done` |
| `fail` | `{message?}` | `fail "cannot find login button"` or `fail` |

**Note on storeJobData:** This tool accepts complex nested JSON (arrays of job objects). Per INTEG-05 (Phase 18 scope), a CLI-compatible encoding for structured data must be designed. For Phase 15, the parser should support inline JSON payloads: `storeJobData {"company":"Microsoft","jobs":[...]}` where everything after the verb is treated as raw JSON to parse. This is the simplest approach that preserves compatibility.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Quoted string tokenizing | Custom regex chain | State-machine tokenizer with explicit states (NORMAL, DOUBLE_QUOTE, SINGLE_QUOTE, ESCAPE) | Regex cannot handle arbitrarily nested escape sequences without becoming unmaintainable. The state machine is 30-40 lines and handles every edge case. |
| Command dispatch routing | if/else chain matching verb strings | Lookup table (COMMAND_REGISTRY object) | Adding a new command is one line in the registry. if/else chains grow linearly and are error-prone. |
| CLI alias resolution | Separate alias map + resolution function | Aliases are entries in the same COMMAND_REGISTRY pointing to canonical tools | One lookup, no extra indirection. |

**Key insight:** The entire parser is hand-rolled by design (no external dependencies allowed). But within the parser, use data-driven patterns (lookup tables, schema-driven arg mapping) rather than procedural patterns (switch statements, manual string slicing).

## Common Pitfalls

### Pitfall 1: Quoted String Edge Cases
**What goes wrong:** URLs containing `?`, `&`, `=`, `#`, and text containing escaped quotes break naive string splitting.
**Why it happens:** `"https://example.com/path?q=test&page=2#section"` looks like it contains special characters that could be interpreted as command separators or flag markers.
**How to avoid:** The tokenizer must operate character-by-character in quoted mode. Inside quotes, ALL characters are literal until the matching close quote (or escaped close quote). The `--` flag prefix is ONLY recognized outside quotes.
**Warning signs:** URLs getting truncated at `?` or `&`. Escaped quotes producing parse errors.

### Pitfall 2: Ref Pattern Collision with Other Tokens
**What goes wrong:** A token like `e5` could be mistaken for a ref when it's actually part of a text argument (e.g., `type e12 "model e5 performance"`).
**Why it happens:** Refs use the pattern `/^e\d+$/` which is also a valid English word fragment.
**How to avoid:** Only the FIRST positional argument (when the command schema expects a `ref` type) is tested for ref pattern. Subsequent positional args are never auto-classified as refs. Quoted strings are NEVER tested for ref pattern.
**Warning signs:** Text arguments being misinterpreted as element refs.

### Pitfall 3: Flag Arguments Consuming Next Token
**What goes wrong:** `scroll down --amount 500` -- the parser might treat `500` as a separate positional argument instead of the value for `--amount`.
**Why it happens:** The tokenizer doesn't understand flag semantics. It sees tokens: `[down, --amount, 500]`.
**How to avoid:** Flag parsing logic: when a `--name` token is encountered, the NEXT token is its value, UNLESS the flag is declared as boolean in the command schema. Boolean flags consume no value token.
**Warning signs:** Numeric values appearing as orphaned positional args.

### Pitfall 4: Case-Sensitivity in Refs
**What goes wrong:** AI outputs `Click E5` but ref map stores `e5` (lowercase).
**Why it happens:** Ref generation in `dom-state.js` uses lowercase (`e` prefix). AI may capitalize.
**How to avoid:** Normalize refs to lowercase in the parser (`params.ref = token.toLowerCase()`). Already decided: verbs are case-insensitive, and refs should follow the same principle.
**Warning signs:** "Unknown ref E5" errors when `e5` exists.

### Pitfall 5: Provider Wrapping of CLI Output
**What goes wrong:** Gemini wraps output in markdown code blocks: `` ```\nclick e5\n``` ``. Grok adds conversational text: "Sure, I'll click that. click e5".
**Why it happens:** LLMs are trained to be helpful and format output nicely. CLI output looks like code, so models wrap it in code blocks.
**How to avoid:** Add a pre-processing step BEFORE line parsing that strips: (1) markdown code fences, (2) leading/trailing conversational text. This is the same pattern FSB already uses for JSON responses (`parseWithMarkdownBlocks` in ai-integration.js line 4023). Phase 15 should include this pre-processing in the parser.
**Warning signs:** First/last lines being `` ``` `` or `` ```bash ``.

### Pitfall 6: Output Shape Mismatch with Existing Dispatch
**What goes wrong:** Parser produces `{tool: "click", params: {selector: "e5"}}` but the dispatch expects `{tool: "click", params: {ref: "e5"}}`.
**Why it happens:** The existing ref resolution in `content/messaging.js` (line 784) checks `params.ref` specifically. If the parser puts the ref into `params.selector`, the resolution path is skipped and a CSS selector lookup happens (which fails because "e5" is not a valid CSS selector).
**How to avoid:** For ref-type arguments, ALWAYS set `params.ref`. For CSS selector arguments, ALWAYS set `params.selector`. The COMMAND_REGISTRY arg schema must distinguish between `type: 'ref'` and `type: 'selector'` argument types.
**Warning signs:** "Element not found" errors when the element clearly exists on the page.

## Code Examples

Verified patterns based on codebase analysis:

### Tokenizer State Machine
```javascript
/**
 * Tokenizes a single CLI command line into verb and arguments.
 * Handles double quotes, single quotes, backslash escapes, and --flags.
 *
 * @param {string} line - A single command line (already trimmed)
 * @returns {{verb: string, tokens: string[], flags: Object}}
 */
function tokenizeLine(line) {
  const tokens = [];
  const flags = {};
  let current = '';
  let state = 'NORMAL'; // NORMAL | DOUBLE_QUOTED | SINGLE_QUOTED
  let escaped = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (escaped) {
      current += ch;
      escaped = false;
      continue;
    }

    if (ch === '\\' && state !== 'SINGLE_QUOTED') {
      escaped = true;
      continue;
    }

    switch (state) {
      case 'NORMAL':
        if (ch === '"') {
          state = 'DOUBLE_QUOTED';
        } else if (ch === "'") {
          state = 'SINGLE_QUOTED';
        } else if (ch === ' ' || ch === '\t') {
          if (current.length > 0) {
            tokens.push(current);
            current = '';
          }
        } else {
          current += ch;
        }
        break;

      case 'DOUBLE_QUOTED':
        if (ch === '"') {
          state = 'NORMAL';
        } else {
          current += ch;
        }
        break;

      case 'SINGLE_QUOTED':
        if (ch === "'") {
          state = 'NORMAL';
        } else {
          current += ch;
        }
        break;
    }
  }

  // Push final token
  if (current.length > 0) {
    tokens.push(current);
  }

  // Unclosed quote is a parse error
  if (state !== 'NORMAL') {
    throw new Error('Unclosed quote in command');
  }

  // Extract verb (first token)
  const verb = tokens.shift() || '';

  // Separate flags from positional tokens
  const positional = [];
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].startsWith('--')) {
      const flagName = tokens[i].substring(2);
      // Check if next token is a value (not another flag and not end)
      if (i + 1 < tokens.length && !tokens[i + 1].startsWith('--')) {
        flags[flagName] = tokens[i + 1];
        i++; // Skip value token
      } else {
        flags[flagName] = true; // Boolean flag
      }
    } else {
      positional.push(tokens[i]);
    }
  }

  return { verb, tokens: positional, flags };
}
```

### COMMAND_REGISTRY Structure
```javascript
/**
 * Registry mapping CLI verbs to canonical tool names and argument schemas.
 * Each entry: { tool: string, args: Array<{name, type, optional?}>, signal?: boolean }
 *
 * Arg types:
 *   'ref'     - Element ref (e5) or CSS selector ("#btn") -- auto-classified
 *   'string'  - Any string value (text, URL, query, etc.)
 *   'number'  - Numeric value (parsed with parseInt/parseFloat)
 *   'json'    - Raw JSON payload (rest of line parsed as JSON)
 */
const COMMAND_REGISTRY = {
  // -- Element interaction --
  click:            { tool: 'click',            args: [{ name: 'ref', type: 'ref' }] },
  rclick:           { tool: 'rightClick',       args: [{ name: 'ref', type: 'ref' }] },
  rightclick:       { tool: 'rightClick',       args: [{ name: 'ref', type: 'ref' }] },
  dblclick:         { tool: 'doubleClick',      args: [{ name: 'ref', type: 'ref' }] },
  doubleclick:      { tool: 'doubleClick',      args: [{ name: 'ref', type: 'ref' }] },
  type:             { tool: 'type',             args: [{ name: 'ref', type: 'ref' }, { name: 'text', type: 'string' }] },
  clear:            { tool: 'clearInput',       args: [{ name: 'ref', type: 'ref' }] },
  clearinput:       { tool: 'clearInput',       args: [{ name: 'ref', type: 'ref' }] },
  focus:            { tool: 'focus',            args: [{ name: 'ref', type: 'ref' }] },
  blur:             { tool: 'blur',             args: [{ name: 'ref', type: 'ref' }] },
  hover:            { tool: 'hover',            args: [{ name: 'ref', type: 'ref' }] },
  selecttext:       { tool: 'selectText',       args: [{ name: 'ref', type: 'ref' }] },
  select:           { tool: 'selectOption',     args: [{ name: 'ref', type: 'ref' }, { name: 'value', type: 'string' }] },
  selectoption:     { tool: 'selectOption',     args: [{ name: 'ref', type: 'ref' }, { name: 'value', type: 'string' }] },
  check:            { tool: 'toggleCheckbox',   args: [{ name: 'ref', type: 'ref' }] },
  togglecheckbox:   { tool: 'toggleCheckbox',   args: [{ name: 'ref', type: 'ref' }] },
  enter:            { tool: 'pressEnter',       args: [{ name: 'ref', type: 'ref', optional: true }] },
  pressenter:       { tool: 'pressEnter',       args: [{ name: 'ref', type: 'ref', optional: true }] },
  gettext:          { tool: 'getText',          args: [{ name: 'ref', type: 'ref' }] },
  getattr:          { tool: 'getAttribute',     args: [{ name: 'ref', type: 'ref' }, { name: 'attribute', type: 'string' }] },
  getattribute:     { tool: 'getAttribute',     args: [{ name: 'ref', type: 'ref' }, { name: 'attribute', type: 'string' }] },
  setattr:          { tool: 'setAttribute',     args: [{ name: 'ref', type: 'ref' }, { name: 'attribute', type: 'string' }, { name: 'value', type: 'string' }] },
  setattribute:     { tool: 'setAttribute',     args: [{ name: 'ref', type: 'ref' }, { name: 'attribute', type: 'string' }, { name: 'value', type: 'string' }] },
  clicksearchresult:{ tool: 'clickSearchResult',args: [{ name: 'ref', type: 'ref' }] },

  // -- Navigation --
  navigate:         { tool: 'navigate',         args: [{ name: 'url', type: 'string' }] },
  goto:             { tool: 'navigate',         args: [{ name: 'url', type: 'string' }] },
  search:           { tool: 'searchGoogle',     args: [{ name: 'query', type: 'string' }] },
  searchgoogle:     { tool: 'searchGoogle',     args: [{ name: 'query', type: 'string' }] },
  refresh:          { tool: 'refresh',          args: [] },
  back:             { tool: 'goBack',           args: [] },
  goback:           { tool: 'goBack',           args: [] },
  forward:          { tool: 'goForward',        args: [] },
  goforward:        { tool: 'goForward',        args: [] },

  // -- Scrolling (shorthand verbs per user decision) --
  scroll:           { tool: 'scroll',           args: [{ name: 'direction', type: 'string', optional: true }] },
  scrolldown:       { tool: 'scroll',           args: [], defaults: { direction: 'down' } },
  scrollup:         { tool: 'scroll',           args: [], defaults: { direction: 'up' } },
  scrolltotop:      { tool: 'scrollToTop',      args: [] },
  scrolltobottom:   { tool: 'scrollToBottom',   args: [] },
  scrolltoelement:  { tool: 'scrollToElement',  args: [{ name: 'ref', type: 'ref' }] },

  // -- Keyboard --
  key:              { tool: 'keyPress',         args: [{ name: 'key', type: 'string' }] },
  keypress:         { tool: 'keyPress',         args: [{ name: 'key', type: 'string' }] },
  presskeysequence: { tool: 'pressKeySequence', args: [{ name: 'keys', type: 'string' }] },
  typewithkeys:     { tool: 'typeWithKeys',     args: [{ name: 'text', type: 'string' }] },
  special:          { tool: 'sendSpecialKey',   args: [{ name: 'specialKey', type: 'string' }] },
  sendspecialkey:   { tool: 'sendSpecialKey',   args: [{ name: 'specialKey', type: 'string' }] },
  arrowup:          { tool: 'arrowUp',          args: [] },
  arrowdown:        { tool: 'arrowDown',        args: [] },
  arrowleft:        { tool: 'arrowLeft',        args: [] },
  arrowright:       { tool: 'arrowRight',       args: [] },

  // -- Mouse --
  movemouse:        { tool: 'moveMouse',        args: [{ name: 'x', type: 'number' }, { name: 'y', type: 'number' }] },

  // -- Waiting/Detection --
  wait:             { tool: 'waitForElement',   args: [{ name: 'selector', type: 'string' }] },
  waitforelement:   { tool: 'waitForElement',   args: [{ name: 'selector', type: 'string' }] },
  waitstable:       { tool: 'waitForDOMStable', args: [] },
  waitfordomstable: { tool: 'waitForDOMStable', args: [] },
  detectloadingstate:{ tool: 'detectLoadingState', args: [] },
  verifymessagesent: { tool: 'verifyMessageSent', args: [] },

  // -- Information --
  geteditorcontent: { tool: 'getEditorContent', args: [] },

  // -- CAPTCHA --
  captcha:          { tool: 'solveCaptcha',     args: [] },
  solvecaptcha:     { tool: 'solveCaptcha',     args: [] },

  // -- Multi-tab --
  opentab:          { tool: 'openNewTab',       args: [{ name: 'url', type: 'string', optional: true }] },
  opennewtab:       { tool: 'openNewTab',       args: [{ name: 'url', type: 'string', optional: true }] },
  switchtab:        { tool: 'switchToTab',      args: [{ name: 'tabId', type: 'number' }] },
  switchtotab:      { tool: 'switchToTab',      args: [{ name: 'tabId', type: 'number' }] },
  closetab:         { tool: 'closeTab',         args: [{ name: 'tabId', type: 'number' }] },
  tabs:             { tool: 'listTabs',         args: [] },
  listtabs:         { tool: 'listTabs',         args: [] },
  getcurrenttab:    { tool: 'getCurrentTab',    args: [] },
  waitfortabload:   { tool: 'waitForTabLoad',   args: [{ name: 'tabId', type: 'number' }] },

  // -- Game --
  game:             { tool: 'gameControl',      args: [{ name: 'action', type: 'string' }] },
  gamecontrol:      { tool: 'gameControl',      args: [{ name: 'action', type: 'string' }] },

  // -- Data tools (background-handled) --
  storejobdata:     { tool: 'storeJobData',     args: [{ name: 'data', type: 'json' }] },
  getstoredobs:     { tool: 'getStoredJobs',    args: [] },
  getstoredobs:     { tool: 'getStoredJobs',    args: [] },
  fillsheetdata:    { tool: 'fillSheetData',    args: [] },

  // -- Signal commands --
  done:             { tool: '__done',           args: [{ name: 'message', type: 'string', optional: true }], signal: 'done' },
  fail:             { tool: '__fail',           args: [{ name: 'message', type: 'string', optional: true }], signal: 'fail' },
};
```

### Pre-Processing for Provider Wrapping
```javascript
/**
 * Strip markdown code fences and conversational wrapper text from AI output.
 * Must run BEFORE line-by-line parsing.
 */
function preprocessResponse(text) {
  if (!text || typeof text !== 'string') return '';

  let cleaned = text.trim();

  // Strip markdown code fences (Gemini pattern)
  cleaned = cleaned.replace(/^```(?:bash|shell|text|cli)?\s*\n?/gm, '');
  cleaned = cleaned.replace(/^```\s*$/gm, '');

  // Strip leading/trailing conversational text (Grok pattern)
  // Only strip lines before the first recognized command
  const lines = cleaned.split('\n');
  let firstCmdIndex = lines.findIndex(l => {
    const trimmed = l.trim();
    if (!trimmed || trimmed.startsWith('#')) return true; // Keep reasoning/blank
    const verb = trimmed.split(/\s+/)[0].toLowerCase();
    return verb in COMMAND_REGISTRY;
  });

  if (firstCmdIndex > 0) {
    // Lines before first command are conversational preamble -- discard
    lines.splice(0, firstCmdIndex);
  }

  return lines.join('\n').trim();
}
```

### Type Coercion for Params
```javascript
/**
 * Coerce a token value based on the expected arg type.
 */
function coerceValue(value, type) {
  switch (type) {
    case 'number':
      const num = Number(value);
      if (isNaN(num)) throw new Error(`Expected number, got: "${value}"`);
      return num;
    case 'ref':
      // Ref/selector discrimination
      if (/^e\d+$/i.test(value)) {
        return { ref: value.toLowerCase() };
      }
      return { selector: value };
    case 'json':
      return JSON.parse(value);
    case 'string':
    default:
      return value;
  }
}
```

### Full parseResponse Output Shape
```javascript
/**
 * The parser output must be compatible with the existing normalizeResponse()
 * output shape in ai-integration.js (line 4133-4161).
 *
 * @returns {{
 *   actions: Array<{tool: string, params: Object}>,
 *   taskComplete: boolean,
 *   result: string|null,
 *   reasoning: string,          // Joined # comment lines
 *   errors: Array<{line: string, lineNumber: number, error: string}>,
 *   confidence: string,         // Default 'medium' (not inferrable from CLI)
 *   situationAnalysis: string,  // From # comments (first block)
 *   goalAssessment: string,     // Empty (not in CLI format)
 *   assumptions: Array,         // Empty
 *   fallbackPlan: string        // Empty
 * }}
 */
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| JSON tool calls | CLI line commands | 2025-2026 | Playwright CLI, agent-browser, webctl all independently adopted CLI over JSON for LLM-browser interaction. 4x token reduction. |
| Structured function calling (OpenAI/Anthropic native) | Text-based CLI output | 2025-2026 | Native function calling locks you to one provider. CLI text works with any LLM regardless of provider features. |
| Full DOM snapshots | Interactive-element-only refs (e1, e2) | 2025-2026 | 93% context reduction (agent-browser). FSB already has `generateCompactSnapshot()`. |

**Deprecated/outdated:**
- JSON-only LLM output parsing: All three major LLM-browser-automation projects (Playwright CLI, agent-browser, webctl) have moved away from JSON-only approaches in favor of CLI-style commands for agent control.

## Open Questions

1. **keyPress flag convention for modifier keys**
   - What we know: `keyPress` accepts `{key, ctrlKey, shiftKey, altKey, metaKey}`. CLI syntax `keyPress "a" --ctrl` needs to map `--ctrl` to `{ctrlKey: true}`.
   - What's unclear: Should the flag names be `--ctrl` / `--shift` / `--alt` / `--meta` (matching the CLI aesthetic) or `--ctrlKey` / `--shiftKey` (matching the param names)?
   - Recommendation: Use short names (`--ctrl`, `--shift`, `--alt`, `--meta`) and map them to the full param names in the command mapper. This is a Claude's Discretion item.

2. **pressKeySequence encoding**
   - What we know: The tool expects `{keys: ['Tab', 'Enter', 'Escape']}` as an array.
   - What's unclear: CLI syntax for arrays. Options: comma-separated string `"Tab,Enter,Escape"` (parsed by mapper), or space-separated after verb.
   - Recommendation: Comma-separated single string, parsed by the mapper into an array: `pressKeySequence "Tab,Enter,Escape"`.

3. **storeJobData complex JSON payload**
   - What we know: This tool takes deeply nested JSON (`{company: "X", jobs: [{title, location, applyLink, ...}]}`).
   - What's unclear: How to encode this in CLI format without it being error-prone.
   - Recommendation: For Phase 15, support raw JSON after the verb: `storeJobData {"company":"X","jobs":[...]}`. Everything after the verb is treated as a single JSON string. Full CLI-native encoding is deferred to Phase 18 (INTEG-05).

4. **selectOption value vs text vs index**
   - What we know: The tool accepts three different param types: `{value}`, `{text}`, or `{index}`.
   - What's unclear: How to distinguish in CLI. `select e5 "Option A"` -- is "Option A" a value or text?
   - Recommendation: Default to `text` param (most common use case). Support `--by-value` and `--by-index` flags: `select e5 "opt1" --by-value` or `select e5 2 --by-index`.

## Sources

### Primary (HIGH confidence)
- `content/actions.js` (lines 979-3731) -- Complete tool implementation with all parameter shapes
- `content/messaging.js` (lines 764-889) -- executeAction dispatch and ref resolution logic
- `ai/ai-integration.js` (lines 3956-4198) -- Current JSON response parser, normalizeResponse, isValidTool list
- `background.js` (lines 5804-5850) -- Action dispatch to content script showing {tool, params} shape
- `.planning/research/ARCHITECTURE.md` -- 21-step data flow analysis, change boundary documentation
- `.planning/research/FEATURES.md` -- Playwright CLI, agent-browser, webctl prior art
- `.planning/research/PITFALLS.md` -- Provider wrapping issues, conversation history format mismatch

### Secondary (MEDIUM confidence)
- `.planning/phases/15-cli-parser-module/15-CONTEXT.md` -- User decisions from discussion phase
- `.planning/REQUIREMENTS.md` -- CLI-01 through CLI-06 requirement definitions

### Tertiary (LOW confidence)
- None. All findings verified against codebase.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- No external dependencies, vanilla JS mandate is clear from project config and existing codebase patterns
- Architecture: HIGH -- Two-layer parser architecture is straightforward and verified against codebase's existing tool dispatch shapes. Every tool's param shape confirmed by reading actual implementations.
- Pitfalls: HIGH -- Based on direct codebase analysis of provider-specific cleaning patterns, ref resolution logic, and the existing 4-strategy JSON parser that demonstrates what kinds of wrapping/corruption to expect.

**Research date:** 2026-02-27
**Valid until:** 2026-03-27 (stable -- no external dependencies that could change)
