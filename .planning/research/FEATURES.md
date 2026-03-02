# Feature Landscape: CLI-Based Browser Automation Protocol for LLM Agents

**Domain:** CLI command interface for AI-driven browser automation (replacing JSON tool calls)
**Researched:** 2026-02-27
**Confidence:** HIGH
**Scope:** What features the v10.0 CLI protocol needs, based on industry evidence from Playwright CLI, webctl, agent-browser, and the broader LLM-browser-automation ecosystem.

---

## Prior Art: What Exists in the Ecosystem

Before defining features, here is what the industry has converged on. Three major projects define the CLI-for-LLM-browser-automation pattern, each launched between March 2025 and January 2026. All three independently arrived at the same core architecture: **line-based commands + ARIA accessibility tree snapshots + element refs**.

### Playwright MCP / Playwright CLI (Microsoft)

**Launched:** March 2025 (MCP), early 2026 (CLI)

**Snapshot format:** YAML-style accessibility tree with `[ref=eN]` identifiers:
```yaml
- generic [ref=e1]:
  - link "Skip to content" [ref=e4] [cursor=pointer]:
    - /url: "#start-of-content"
  - banner [ref=e6]:
    - button "Platform" [ref=e17] [cursor=pointer]
    - button "Solutions" [ref=e21] [cursor=pointer]
  - main:
    - heading "Welcome to Example" [level=1]
    - textbox "What needs to be done?" [ref=e8]
```

**Command grammar:** `playwright-cli <verb> [ref] [value]`
```
playwright-cli open https://example.com
playwright-cli snapshot
playwright-cli click e21
playwright-cli fill e8 "admin@test.com"
playwright-cli press Enter
playwright-cli screenshot
playwright-cli close
```

**Token efficiency:** 27K tokens/task (CLI) vs 114K tokens/task (MCP) -- 4x reduction. On a complex enterprise UI, a single MCP snapshot is ~138K tokens; a CLI snapshot saved to disk costs the LLM 0 tokens until explicitly read.

**Key insight:** CLI saves snapshots to disk as YAML files; the LLM only reads them when needed. MCP dumps the full accessibility tree inline into every tool response.

### agent-browser (Vercel Labs)

**Launched:** January 2026

**Snapshot format:** Compact accessibility tree with `@eN` ref identifiers:
```
- heading "Example Domain" [ref=e1]
- link "More information..." [ref=e2]
- textbox "Email" [ref=e3]
- button "Submit" [ref=e4]
```

**Command grammar:** `agent-browser <verb> <@ref|selector> [value]`
```
agent-browser open https://example.com
agent-browser snapshot -i              # interactive elements only
agent-browser snapshot -i -C           # include cursor-interactive divs
agent-browser snapshot -s "#main"      # scope to CSS selector
agent-browser click @e2
agent-browser fill @e3 "hello@test.com"
agent-browser type @e3 "hello"         # type without clearing
agent-browser press Enter
agent-browser select @e5 "Option A"
agent-browser check @e6
agent-browser get text @e1
agent-browser get url
agent-browser tab new https://sheets.google.com
agent-browser tab 2                    # switch to tab 2
agent-browser wait --load networkidle
agent-browser close
```

**Token efficiency:** 200-400 tokens per snapshot (interactive-only) vs 3,000-5,000 tokens for full DOM. Claims 93% context reduction vs Playwright MCP.

**Key insight:** The `-i` (interactive-only) flag is the biggest token saver. On a GitHub page, Playwright MCP generates 789 refs; agent-browser with `-i` generates 245 refs -- a 69% reduction.

### webctl (cosinusalpha)

**Launched:** June 2025

**Snapshot format:** ARIA-based tree (format not fully documented but filterable).

**Command grammar:** `webctl <verb> '<ARIA query>' [value]`
```
webctl start
webctl navigate "https://google.com"
webctl snapshot --interactive-only --limit 30
webctl snapshot --within "role=main"   # scope to container
webctl click 'role=button name="Submit"'
webctl type 'role=textbox name~="Email"' "hello@test.com"  # ~= is substring match
webctl select 'role=combobox name~="Country"' --label "USA"
webctl press Enter
webctl scroll down
webctl wait network-idle
webctl wait 'exists:role=button name~="Continue"'
webctl stop
```

**Key insight:** Uses semantic ARIA queries (`role=button name~="Submit"`) instead of refs. This is more human-readable but requires the LLM to compose ARIA queries, which is more error-prone than using a ref.

### Token Efficiency Summary (Verified from Multiple Sources)

| Approach | Tokens per Snapshot | Tokens per Task (10 steps) | Cost per Run |
|----------|--------------------:|---------------------------:|-------------:|
| FSB current (JSON DOM) | ~3,000-8,000 | ~50,000-100,000 | $0.50-2.00 |
| Playwright MCP (inline YAML) | ~12,800-138,200 | ~7.62M (cumulative) | ~$45 |
| Playwright CLI (disk YAML) | ~2,000-5,000 (when read) | ~27,000 | <$0.50 |
| agent-browser (compact text) | ~200-400 (interactive) | ~5,000-10,000 | <$0.10 |
| webctl (filtered ARIA) | ~300-800 | ~8,000-15,000 | <$0.15 |

**Confidence: MEDIUM** -- Token counts vary by page complexity. FSB current estimate based on existing 50-element JSON payload at ~60-160 tokens/element. Playwright MCP and CLI numbers from TestShift benchmarks (2026). agent-browser numbers from Vercel documentation.

---

## Existing FSB Capabilities (What Changes, What Stays)

Before mapping new features, clarify what the CLI protocol replaces vs preserves.

| Capability | Current Implementation | CLI Migration Impact |
|-----------|----------------------|---------------------|
| AI action output format | JSON: `{"actions": [{"tool": "click", "params": {"ref": "e5"}}]}` | REPLACED by line-based commands: `click e5` |
| JSON parsing pipeline | 5-tier: clean JSON -> markdown -> regex -> cleaning -> NL fallback | ELIMINATED -- CLI lines need no complex parsing |
| DOM snapshot format | JSON with elements array, htmlContext, scrollPosition, viewport | REPLACED by YAML/text accessibility tree with refs |
| System prompt + tool docs | ~400 line system prompt with tool schemas | REPLACED by compact command reference |
| Context tiers | Full prompt on iteration 1, minimal continuation on subsequent | PRESERVED -- context tiering is orthogonal to format |
| Conversation history | Compacted history (3 recent, summarize older) | PRESERVED -- history compaction is orthogonal |
| Batch actions | batchActions array for multiple same-page actions | REPLACED by multi-line commands (one per line) |
| Stuck detection | DOM hashing + action pattern analysis + recovery prompts | PRESERVED -- stuck detection logic is orthogonal |
| Action execution | 25+ tools in content/actions.js (click, type, scroll, etc.) | PRESERVED -- tools stay, only the AI-facing interface changes |
| Element targeting | CSS selectors with uniqueness scoring | AUGMENTED -- refs become primary, selectors become fallback |

**Key principle:** The CLI protocol changes the AI-to-extension communication layer. The content script action execution (actions.js), session management (background.js), memory system, site guides, and UI remain unchanged.

---

## Table Stakes (Users/AI Expect These)

Features that every CLI-based browser automation protocol must have. Missing any of these makes the CLI interface worse than the current JSON approach.

---

### TS-1: Line-Based Command Grammar

**Why Expected:** This is the fundamental value proposition. LLMs generate simple text lines far more reliably than structured JSON. Every competing project (Playwright CLI, agent-browser, webctl) uses `<verb> <target> [value]` format because it matches how LLMs naturally produce output.

**Complexity:** MEDIUM -- The command parser is simple (split by whitespace/quoted strings), but the command set must map 1:1 to FSB's existing 25+ action tools, plus the ref-based targeting system must integrate with FSB's existing CSS selector infrastructure.

**What the grammar must look like:**
```
click e5
type e12 "software engineering intern"
press Enter
scroll down 500
navigate "https://careers.microsoft.com"
select e8 "United States"
check e15
getText e7
getAttribute e7 href
wait networkIdle
waitForElement "role=button name=Submit"
screenshot
```

**Why this format (not webctl's ARIA query format):** LLMs generate `click e5` with near-100% reliability because it is 2 tokens. `click 'role=button name~="Submit"'` requires the LLM to correctly compose a quoted ARIA query string with the right operator (`=` vs `~=`), proper quoting, and correct role/name values. Ref-based targeting is strictly simpler for the LLM.

**Dependencies on Existing FSB:**
- All 25+ action tools in content/actions.js -- PRESERVED, only the dispatch interface changes
- Element identification in dom-analysis.js -- AUGMENTED with ref assignment
- background.js action dispatch -- REWRITTEN to parse CLI lines instead of JSON

**What "done" looks like:**
- AI outputs one command per line, no JSON wrapping
- background.js parses each line into {tool, ref, value} tuple
- Content script executes the same actions.js tools as before
- Zero JSON parsing failures (the 5-tier pipeline becomes unnecessary)

---

### TS-2: Element Ref System

**Why Expected:** Refs are what make the CLI grammar work. Without refs, the AI must output CSS selectors (verbose, fragile) or coordinate positions (imprecise). Every competing project assigns refs (`e5`, `@e1`, `ref=e23`) to interactive elements in the snapshot.

**Complexity:** MEDIUM -- FSB already assigns `elementId` values during DOM analysis (e.g., `elem_123`). The change is: (a) shorten to `eN` format for token efficiency, (b) make refs the primary targeting mechanism in snapshots, (c) maintain a ref-to-selector mapping in the content script so actions.js can resolve refs to actual DOM elements.

**Design decisions:**
- **Ref format:** `eN` (e.g., `e1`, `e5`, `e47`) -- matches Playwright CLI convention, 2-4 characters vs FSB's current `elem_button_submit_btn_...` (20-50 characters)
- **Ref scope:** Per-snapshot (refs reset on each DOM capture, same as Playwright MCP)
- **Ref assignment:** Only interactive elements get refs (buttons, links, inputs, selects, textareas, checkboxes, clickable divs with role). Non-interactive text/headings appear in the snapshot without refs for context but cannot be targeted.
- **Ref resolution:** Content script maintains `Map<ref, {selector, element, coordinates}>` that is rebuilt on each DOM capture

**Token savings from refs alone:**
- Current: `"params": {"selector": "#submit-btn", "fallbackSelectors": ["[data-testid=\"submit\"]", ".btn.submit"]}` = ~30 tokens
- CLI ref: `e5` = 1 token
- Per-action savings: ~29 tokens x 3-5 actions/iteration x 10-20 iterations = 870-2,900 tokens saved

**Dependencies on Existing FSB:**
- dom-analysis.js element extraction -- AUGMENTED with ref assignment
- ElementCache (configurable cache) -- AUGMENTED with ref-to-element mapping
- actions.js tool execution -- AUGMENTED with ref resolution before action

**What "done" looks like:**
- Snapshot assigns `e1`..`eN` to interactive elements
- AI outputs `click e5` instead of `{"tool": "click", "params": {"selector": "#submit-btn"}}`
- Content script resolves `e5` to the DOM element and executes the click
- If the element has moved/changed since snapshot, falls back to the stored selector

---

### TS-3: Compact Accessibility Tree Snapshot

**Why Expected:** The snapshot is what the AI sees to make decisions. Current FSB sends a JSON blob with elements array, htmlContext, scrollPosition, viewport, completionSignals -- roughly 3,000-8,000 tokens for 50 elements. Industry evidence shows YAML accessibility tree format with refs achieves the same actionability in 200-800 tokens for interactive elements.

**Complexity:** HIGH -- This is the most impactful change. The current dom-analysis.js produces a rich JSON structure optimized for machine parsing. The new format must be optimized for LLM comprehension: hierarchical, indented, with semantic roles and text content inline.

**Target snapshot format for FSB:**
```yaml
[page] careers.microsoft.com/search | "Job Search - Microsoft Careers"
[scroll] 0,500 / 1920x1080

- navigation "Main Nav":
  - link "Home" [e1]
  - link "Job Search" [e2]
  - link "Students" [e3]
- main:
  - heading "Find Your Dream Job" [level=1]
  - search:
    - textbox "Keywords" [e4] value=""
    - textbox "Location" [e5] value="United States"
    - button "Search" [e6]
  - region "Results":
    - article "Software Engineer":
      - link "Software Engineer - Azure" [e7]
      - text "Redmond, WA | Posted 2 days ago"
    - article "Senior SWE":
      - link "Senior Software Engineer - Teams" [e8]
      - text "Remote | Posted 1 week ago"
    - button "Next Page" [e9]
```

**Token count estimate for this format:** ~150-300 tokens for 9 interactive elements with context. Current FSB JSON for 9 elements: ~900-1,800 tokens. Reduction: 3-6x.

**What to include (based on industry analysis):**
- ARIA role (button, link, textbox, heading, navigation, main, etc.)
- Accessible name (visible text label)
- Ref (for interactive elements only)
- Value (for inputs with current values)
- Level (for headings)
- State (checked, disabled, pressed -- only when non-default)
- Hierarchy (indentation shows parent-child relationships)

**What to exclude (current FSB includes but wastes tokens):**
- Element position coordinates (x, y, width, height) -- not needed for action targeting via refs
- CSS class names -- not useful for LLM decisions
- Multiple fallback selectors -- refs replace selectors
- Visibility properties (display, visibility, opacity) -- only show visible elements
- Data attributes -- rarely useful for LLM decisions
- Element ID (unless it is semantically meaningful)
- Form ID -- hierarchy shows form membership

**Dependencies on Existing FSB:**
- dom-analysis.js `buildDOMContext()` -- REWRITTEN to produce YAML tree
- 3-stage element filtering (50 elements) -- PRESERVED, applied before serialization
- Page context detection -- INTEGRATED into snapshot header
- Completion signals -- MOVED to separate section or prompt context

**What "done" looks like:**
- AI receives a ~200-800 token snapshot instead of ~3,000-8,000 tokens
- Snapshot is human-readable (debuggable by the developer)
- AI can identify which element to interact with from the tree structure
- All current action capabilities are preserved (refs map to the same elements)

---

### TS-4: Multi-Line Command Output (Batch Actions)

**Why Expected:** FSB already supports batch actions (multiple actions per AI turn). In CLI format, this becomes trivially natural: the AI outputs multiple lines, each a separate command.

**Complexity:** LOW -- The parser processes lines sequentially. No special batch syntax needed.

**Format:**
```
click e4
type e4 "software engineering intern"
press Enter
wait networkIdle
```

The AI outputs 4 lines; the background.js parser splits by newline, executes sequentially with appropriate inter-action delays.

**Current FSB batch format (for comparison):**
```json
{
  "actions": [
    {"tool": "click", "params": {"selector": "#search-box"}},
    {"tool": "type", "params": {"selector": "#search-box", "text": "software engineering intern"}},
    {"tool": "pressEnter", "params": {}},
    {"tool": "waitForElement", "params": {"selector": ".results"}}
  ]
}
```

**Token savings:** 4-line CLI = ~20 tokens. Equivalent JSON = ~120 tokens. 6x reduction per batch.

**Dependencies on Existing FSB:**
- Batch action execution in background.js -- PRESERVED, input format changes
- DOM completion detection between batch actions -- PRESERVED
- URL-based batch suppression (Google Sheets) -- PRESERVED

**What "done" looks like:**
- AI outputs multiple commands, one per line
- Parser splits and executes sequentially
- Same inter-action timing and DOM-stability checks as current batch system

---

### TS-5: Status/Observation Response Format

**Why Expected:** After executing commands, the AI needs to know what happened. Currently FSB returns JSON action results. The CLI protocol needs a compact text response format that the AI can parse to decide next steps.

**Complexity:** LOW -- Convert existing action results to text lines.

**Format:**
```
OK click e5 -- clicked "Search" button
OK type e4 "software engineering" -- typed into "Keywords" textbox
OK press Enter
WAIT networkIdle -- page loaded in 1200ms
FAIL click e99 -- element not found (ref expired)
```

**Why this matters:** The AI must distinguish success, failure, and state changes. A line-based status format (`OK`, `FAIL`, `WAIT`) is easier for the LLM to parse than nested JSON result objects.

**Dependencies on Existing FSB:**
- Action result reporting in background.js -- REFORMATTED from JSON to text lines
- Error reporting with alternative selectors -- PRESERVED in FAIL responses
- Action verification system -- PRESERVED, results feed into status lines

---

### TS-6: Interactive-Only Filtering

**Why Expected:** The single biggest token optimization. A typical webpage has 500+ DOM elements but only 30-80 interactive ones (buttons, links, inputs, selects). Sending non-interactive elements wastes tokens on context the AI cannot act on.

**Complexity:** LOW -- FSB's dom-analysis.js already filters elements by interactivity during the 3-stage filtering pipeline. The change is making interactive-only the default snapshot mode and including non-interactive elements (headings, landmarks) only as contextual hierarchy markers without refs.

**Industry evidence:**
- Playwright MCP: 789 refs on GitHub page (all elements) vs agent-browser: 245 refs (interactive only) -- 69% reduction
- Wikipedia: 16,044 tokens (all elements) vs 7,860 tokens (interactive only) -- 51% reduction
- Hacker News: 14,547 tokens (all elements) vs 3,052 tokens (interactive only) -- 79% reduction

**What "interactive" means for FSB:**
- buttons, `[role="button"]`, `input[type="submit"]`
- links (`<a>` with href)
- inputs (text, email, password, search, tel, url, number)
- textareas
- selects and `[role="combobox"]`
- checkboxes, radio buttons
- elements with click handlers and `[role="tab"]`, `[role="menuitem"]`
- elements with `tabindex >= 0` (explicitly focusable)

Non-interactive elements (headings, paragraphs, landmarks, lists) appear in the tree as context but get no ref.

**Dependencies on Existing FSB:**
- 3-stage element filtering in dom-analysis.js -- AUGMENTED (already filters, now also assigns refs only to interactive)
- 50-element limit -- PRESERVED as upper bound for ref-bearing elements

---

### TS-7: Reasoning/Commentary Separation

**Why Expected:** LLMs produce reasoning alongside actions. The parser must distinguish commands from commentary. If the AI outputs `I'll click the search button now` followed by `click e6`, the parser must execute `click e6` and ignore the reasoning text.

**Complexity:** LOW -- Two approaches, both proven:

**Approach A: Prefix-based (Playwright CLI pattern)**
All commands start with a known verb. Lines not starting with a recognized verb are ignored.
```
I need to search for jobs on this page.
click e4
type e4 "software engineering"
The search box is now filled. I'll submit.
press Enter
```

**Approach B: Delimiter-based (agent-browser pattern)**
Commands are wrapped in a delimiter block:
```
I'll search for jobs on this career page.

---COMMANDS---
click e4
type e4 "software engineering"
press Enter
---END---
```

**Recommendation: Approach A (prefix-based).** It requires zero additional tokens from the AI (no delimiters to output) and is how Playwright CLI and webctl work. The parser maintains a set of known verbs (`click`, `type`, `press`, `navigate`, `scroll`, `select`, `check`, `wait`, `getText`, `getAttribute`, `screenshot`) and only processes lines starting with those verbs.

**Dependencies on Existing FSB:**
- AI response parsing in background.js -- REWRITTEN (simpler than current 5-tier JSON pipeline)
- Prompt instructions about output format -- NEW (tell AI to output commands as bare lines)

---

## Differentiators (What Makes FSB's CLI Better Than Generic)

Features that go beyond what Playwright CLI / agent-browser / webctl offer. These leverage FSB's unique position as a Chrome Extension with persistent sessions, site-specific intelligence, and a chat UI.

---

### D-1: Scoped Snapshots with CSS Selector Regions

**Value Proposition:** Both webctl (`--within "role=main"`) and agent-browser (`-s "#selector"`) support scoping snapshots to a DOM subtree. FSB should support this because career pages have massive navbars, footers, and sidebars that waste tokens. Scoping to `main` or `.job-results` cuts snapshot size by 50-80%.

**Complexity:** LOW -- FSB's DOM analysis already traverses from a root element. Adding a scope parameter (`snapshot main` or `snapshot ".results"`) filters the traversal starting point.

**Command syntax:**
```
snapshot                     # full page, interactive only
snapshot main                # scoped to <main> element
snapshot ".job-results"      # scoped to CSS selector
snapshot --full              # include non-interactive context
```

**Dependencies on Existing FSB:**
- dom-analysis.js traversal -- AUGMENTED with optional root element
- Site guides -- CAN provide recommended scope selectors per site

---

### D-2: Site-Aware Snapshot Annotations

**Value Proposition:** FSB has 43+ site guides with domain-specific intelligence. Unlike generic tools (Playwright CLI, agent-browser), FSB knows that on `careers.microsoft.com`, the element `e4` is the "job search box" and `e9` is "pagination next." The snapshot can include these semantic hints.

**Complexity:** MEDIUM -- When a site guide is active, its `selectors` map (searchBox, jobCards, applyButton) can annotate matching elements in the snapshot with role hints.

**Example annotated snapshot:**
```yaml
[page] careers.microsoft.com/search | "Job Search"
[guide] microsoft-careers (career)

- main:
  - search:
    - textbox "Keywords" [e4] [hint:searchBox]
    - textbox "Location" [e5] [hint:locationBox]
    - button "Search" [e6] [hint:searchButton]
  - region "Results":
    - link "Software Engineer - Azure" [e7] [hint:jobTitle]
    - button "Next" [e9] [hint:pagination]
```

The `[hint:searchBox]` annotation tells the AI "this is the search box for this site" -- reducing ambiguity without the AI needing to read the full site guide text.

**Dependencies on Existing FSB:**
- Site guide system (selectors map) -- CONSUMED during snapshot generation
- Site guide URL matching -- EXISTING (getGuideForUrl)
- dom-analysis.js element extraction -- AUGMENTED with hint annotation

---

### D-3: Inline Memory/Context Directives

**Value Proposition:** FSB's CLI is not a standalone tool -- it runs inside a persistent automation session with conversation history, task context, and completion tracking. The AI needs to communicate status, reasoning, and memory alongside commands. CLI format can include directive lines for this.

**Complexity:** LOW -- Add recognized directive prefixes that the parser handles separately from action commands.

**Directive format:**
```
# Searched Microsoft careers, found 4 matching jobs
# STATUS: 2/5 companies complete
# STORE: {"company": "Microsoft", "title": "SWE Intern", "location": "Redmond, WA"}
click e7
getText e7
# Moving to Amazon careers next
navigate "https://www.amazon.jobs"
```

Lines starting with `#` are directives. The parser can:
- Log them for debugging
- Extract structured data (`# STORE:` lines for the career data accumulator)
- Report status to the chat UI (`# STATUS:` lines)

**Dependencies on Existing FSB:**
- Career data accumulator (background.js) -- EXISTING from v9.4
- Chat UI progress display -- EXISTING
- Conversation history -- EXISTING (directives become part of history)

---

### D-4: Completion Signal in Snapshot

**Why Valuable:** FSB already has multi-signal completion scoring (URL changes, DOM changes, success indicators). In CLI format, completion signals can be part of the snapshot header so the AI has immediate awareness of task progress.

**Complexity:** LOW -- Already computed in dom-analysis.js `detectCompletionSignals()`. Just needs inclusion in snapshot header.

**Format:**
```yaml
[page] sheets.google.com/spreadsheets/d/abc123 | "Job Search Results"
[scroll] 0,200 / 1920x1080
[signals] url_matches_target, form_submitted, success_indicator="Saved"

- main:
  ...
```

**Dependencies on Existing FSB:**
- `detectCompletionSignals()` in dom-analysis.js -- EXISTING
- Completion scoring in background.js -- EXISTING

---

### D-5: Progressive Snapshot Depth

**Value Proposition:** Not all iterations need the same level of detail. Iteration 1 (orientation) needs the full page tree. Iteration 5 (typing into a known field) only needs the focused element and immediate context. FSB's existing context tier system (full on first, minimal on subsequent) maps naturally to snapshot depth levels.

**Complexity:** MEDIUM -- Need 2-3 snapshot depth modes:
- **full:** Complete accessibility tree (iteration 1, after navigation)
- **focused:** Only the active region + nearby interactive elements (mid-task iterations)
- **minimal:** Just the changed elements since last snapshot (delta mode -- FSB already has delta DOM detection)

**Format:**
```
snapshot              # default: full tree
snapshot --focused    # active region only
snapshot --delta      # only changes since last capture
```

**Dependencies on Existing FSB:**
- DOM state manager (delta detection) -- EXISTING
- Context tier system in ai-integration.js -- EXISTING conceptual framework
- dom-analysis.js optimization payload -- EXISTING (already computes deltas)

---

## Anti-Features (Things to Deliberately NOT Build)

---

### AF-1: ARIA Query Targeting (webctl Style)

**Why Tempting:** webctl's `role=button name~="Submit"` is semantically clear and human-readable.

**Why Problematic:**
- LLMs must compose syntactically correct ARIA queries with proper quoting, operators (`=` vs `~=`), and role names. This is ~5-10 tokens per target vs 1 token for a ref.
- ARIA queries can match multiple elements. `role=link name~="Home"` might match 3 links. Refs are unambiguous.
- The AI must remember accessible names from the snapshot and reproduce them exactly (or with the right substring). Refs are just numbers.
- webctl's approach works for simple pages but breaks down on complex UIs with many similar elements.

**What to Do Instead:** Use refs (`e5`) as the primary targeting mechanism. The AI sees the accessible name in the snapshot next to the ref and uses the ref to target. This is the Playwright CLI and agent-browser approach, and it is strictly simpler for LLMs.

---

### AF-2: Screenshot-Based Visual Targeting

**Why Tempting:** Some browser agents (SeeAct, WebVoyager) use screenshots + vision models to identify click targets.

**Why Problematic:**
- Vision tokens are 10-100x more expensive than text tokens. A screenshot is ~1,000-5,000 tokens as a vision input.
- FSB uses text-based AI models (Grok, GPT-4o, Claude) for action planning, not dedicated vision models. Adding vision targeting changes the architecture fundamentally.
- Accessibility tree + refs achieves the same targeting accuracy without vision overhead.
- Screenshot-based targeting fails on canvas elements (like Google Sheets cells) where visual position does not map to interactive DOM elements.

**What to Do Instead:** Use accessibility tree snapshots with refs. For elements that need visual verification (complex layouts), add an optional `screenshot` command the AI can use selectively -- but this should be rare, not the primary workflow.

---

### AF-3: Full DOM HTML in Snapshots

**Why Tempting:** FSB currently includes `htmlContext` with page structure, relevant HTML fragments, and navigation. Some of this context is valuable.

**Why Problematic:**
- Raw HTML is extremely token-expensive. Even truncated to 1,000 chars, it adds ~250 tokens per snapshot of noisy markup.
- LLMs do not parse HTML as well as they parse structured accessibility trees. Research shows ARIA tree format achieves higher task completion rates than raw HTML.
- The accessibility tree already captures the semantically meaningful content (roles, names, hierarchy) without the syntactic noise of HTML tags, attributes, and classes.

**What to Do Instead:** The accessibility tree snapshot replaces htmlContext entirely. Page structure (title, URL, headings, navigation landmarks) is already encoded in the tree hierarchy. If specific HTML attributes are needed (e.g., `href` on links, `value` on inputs), include them inline in the tree node.

---

### AF-4: Overly Complex Command Grammar

**Why Tempting:** Supporting advanced syntax like pipes (`snapshot | filter role=button`), conditionals (`if visible e5 then click e5`), or loops (`for e in buttons click e`).

**Why Problematic:**
- LLMs generate simple imperative sequences far more reliably than complex control flow syntax. Every additional grammar feature is a new failure mode.
- Playwright CLI, agent-browser, and webctl all use flat imperative commands. None supports pipes, conditionals, or loops. This is intentional.
- FSB's automation loop already handles conditional logic (the AI reasons, then outputs commands). Adding control flow to the command grammar duplicates the AI's job.

**What to Do Instead:** Keep the grammar to `<verb> <ref> [value]`. Let the AI handle all decision-making in its reasoning. One iteration = one set of commands. If the AI needs to check something before acting, it requests a snapshot, reads it, then outputs commands in the next iteration.

---

### AF-5: JSON Fallback Mode

**Why Tempting:** "What if we keep the JSON parser as a fallback for backward compatibility?"

**Why Problematic:**
- Maintaining two parallel parsing paths (JSON and CLI) doubles the maintenance surface and creates ambiguity about which format the AI should use.
- The JSON parsing pipeline is exactly what this milestone eliminates. Keeping it defeats the purpose.
- If the AI occasionally outputs JSON, it means the prompt is not clear enough about the expected format. Fix the prompt, do not accommodate broken output.

**What to Do Instead:** Full cutover to CLI format. Remove the 5-tier JSON parsing pipeline. If the AI outputs malformed text, the parser reports `FAIL: unrecognized command "[malformed text]"` and the AI retries with correct syntax.

---

## Feature Dependencies

```
TS-2 (Element Refs) ------+
                           |
TS-3 (Compact Snapshot) --+---> TS-1 (CLI Grammar) -- core action dispatch
                           |
TS-6 (Interactive Filter) +

TS-1 (CLI Grammar)
    |
    +-- TS-4 (Multi-Line Batch) -- trivial extension of line parsing
    |
    +-- TS-5 (Status Responses) -- output format for action results
    |
    +-- TS-7 (Reasoning Separation) -- parser ignores non-command lines

TS-3 (Compact Snapshot)
    |
    +-- D-1 (Scoped Snapshots) -- optional scope parameter
    |
    +-- D-2 (Site-Aware Annotations) -- site guide integration
    |
    +-- D-4 (Completion Signals) -- header metadata
    |
    +-- D-5 (Progressive Depth) -- snapshot mode parameter

D-3 (Inline Directives) -- independent, just parser extension
```

### Dependency Notes

- **TS-2 (Refs) is prerequisite for TS-1 (Grammar) and TS-3 (Snapshot):** Without refs, the CLI grammar has no way to target elements. Without refs in the snapshot, the AI has no identifiers to use in commands.
- **TS-3 (Snapshot) is prerequisite for TS-6 (Interactive Filter):** The filtering determines which elements appear in the snapshot and which get refs.
- **TS-1 (Grammar) is prerequisite for TS-4, TS-5, TS-7:** These extend the parser, which must exist first.
- **D-1 through D-5 are all enhancements to the snapshot or parser:** They can be added incrementally after the core CLI pipeline works.

---

## MVP Recommendation

### Phase 1: Core CLI Pipeline (Must Have)

The minimum that replaces the JSON protocol and delivers token savings:

- [ ] **TS-2: Element ref system** -- Assign `eN` refs during DOM analysis, maintain ref-to-element map in content script
- [ ] **TS-3: Compact accessibility tree snapshot** -- YAML-style text format with roles, names, refs, hierarchy
- [ ] **TS-6: Interactive-only filtering** -- Only interactive elements get refs; non-interactive shown as context
- [ ] **TS-1: CLI command grammar** -- Parser in background.js that processes `<verb> <ref> [value]` lines
- [ ] **TS-4: Multi-line batch** -- Parser splits AI output by newline, executes sequentially
- [ ] **TS-5: Status responses** -- `OK`/`FAIL`/`WAIT` text responses after each command
- [ ] **TS-7: Reasoning separation** -- Parser ignores lines not starting with recognized verbs

### Phase 2: Intelligence Layer (Should Have)

- [ ] **D-1: Scoped snapshots** -- `snapshot main` or `snapshot ".results"` to reduce token count further
- [ ] **D-2: Site-aware annotations** -- `[hint:searchBox]` from site guide selectors
- [ ] **D-4: Completion signals in snapshot** -- Header metadata for task progress awareness
- [ ] **D-3: Inline directives** -- `# STATUS:` and `# STORE:` lines for structured metadata

### Phase 3: Optimization (Nice to Have)

- [ ] **D-5: Progressive snapshot depth** -- Full / focused / delta modes based on iteration context

---

## Command Grammar Reference (Recommended for FSB v10.0)

Based on convergent patterns across Playwright CLI, agent-browser, and webctl:

### Navigation
| Command | Example | Maps to FSB Tool |
|---------|---------|-----------------|
| `navigate <url>` | `navigate "https://example.com"` | navigate |
| `back` | `back` | goBack |
| `forward` | `forward` | goForward |
| `refresh` | `refresh` | refresh |

### Element Interaction
| Command | Example | Maps to FSB Tool |
|---------|---------|-----------------|
| `click <ref>` | `click e5` | click |
| `type <ref> <text>` | `type e12 "hello world"` | type |
| `fill <ref> <text>` | `fill e12 "hello world"` | clearInput + type |
| `press <key>` | `press Enter` | pressEnter / keyPress |
| `select <ref> <value>` | `select e8 "United States"` | selectOption |
| `check <ref>` | `check e15` | toggleCheckbox (on) |
| `uncheck <ref>` | `uncheck e15` | toggleCheckbox (off) |
| `hover <ref>` | `hover e3` | hover |
| `focus <ref>` | `focus e7` | focus |

### Information
| Command | Example | Maps to FSB Tool |
|---------|---------|-----------------|
| `snapshot` | `snapshot` | (new) captures accessibility tree |
| `snapshot <scope>` | `snapshot main` | (new) scoped snapshot |
| `getText <ref>` | `getText e7` | getText |
| `getAttr <ref> <attr>` | `getAttr e7 href` | getAttribute |

### Waiting
| Command | Example | Maps to FSB Tool |
|---------|---------|-----------------|
| `wait <condition>` | `wait networkIdle` | waitForDOMStable |
| `wait <ref>` | `wait e5` | waitForElement |
| `wait <ms>` | `wait 2000` | (delay) |

### Tabs
| Command | Example | Maps to FSB Tool |
|---------|---------|-----------------|
| `tab new <url>` | `tab new "https://sheets.google.com"` | openNewTab |
| `tab <n>` | `tab 2` | switchToTab |
| `tab list` | `tab list` | listTabs |
| `tab close` | `tab close` | closeTab |

### Scrolling
| Command | Example | Maps to FSB Tool |
|---------|---------|-----------------|
| `scroll down [px]` | `scroll down 500` | scroll |
| `scroll up [px]` | `scroll up 300` | scroll |
| `scroll to <ref>` | `scroll to e15` | scroll (to element) |

### Debug
| Command | Example | Maps to FSB Tool |
|---------|---------|-----------------|
| `screenshot` | `screenshot` | (capture for debugging) |
| `done` | `done` | (mark task complete) |
| `done <message>` | `done "Found 5 jobs"` | (mark complete with summary) |

**Total: ~30 commands mapping to 25+ existing FSB action tools.**

---

## Snapshot Format Token Analysis

### Current FSB JSON (one element, abbreviated):
```json
{
  "elementId": "elem_btn_submit_123",
  "type": "button",
  "text": "Submit",
  "id": "submit-btn",
  "class": "btn btn-primary",
  "position": {"x": 150, "y": 250, "width": 120, "height": 40, "inViewport": true},
  "attributes": {"data-testid": "submit"},
  "visibility": {"display": "block", "visibility": "visible", "opacity": "1"},
  "interactionState": {"disabled": false, "focused": false},
  "selectors": ["#submit-btn", "[data-testid=\"submit\"]", ".btn.btn-primary"],
  "labelText": "Submit your form"
}
```
**Token count:** ~120-160 tokens per element. At 50 elements: ~6,000-8,000 tokens.

### Proposed CLI YAML (same element):
```yaml
- button "Submit" [e5]
```
**Token count:** ~8 tokens per element. At 50 interactive elements with hierarchy context: ~200-500 tokens.

### With additional context (when needed):
```yaml
- button "Submit" [e5] disabled
- textbox "Email" [e3] value="user@test.com" required
- link "Apply Now" [e7] /url:"/apply/12345"
```
**Token count:** ~12-20 tokens per element with attributes. At 50 elements: ~600-1,000 tokens.

### Estimated total snapshot comparison:

| Component | Current FSB JSON | Proposed CLI YAML | Reduction |
|-----------|----------------:|------------------:|----------:|
| Page header (url, title, scroll) | ~50 tokens | ~30 tokens | 40% |
| 50 elements (interactive) | ~6,000-8,000 | ~400-1,000 | 85-93% |
| htmlContext (page structure) | ~500-1,500 | 0 (encoded in tree hierarchy) | 100% |
| Completion signals | ~100-200 | ~20-40 (in header) | 80% |
| **Total** | **~6,650-9,750** | **~450-1,070** | **85-93%** |

**Confidence: HIGH** -- These estimates align with agent-browser's claimed 93% reduction and the Wikipedia/GitHub/HN benchmarks showing 51-79% reduction from interactive-only filtering alone.

---

## What LLMs Generate Most Reliably

Based on analysis of Playwright CLI, agent-browser, and webctl usage patterns, and the structural properties of LLM text generation:

### Most Reliable Patterns (use these)

1. **Single-word verbs:** `click`, `type`, `press`, `scroll`, `navigate`, `wait` -- LLMs produce these as single tokens with near-zero error rate
2. **Short alphanumeric refs:** `e5`, `e12`, `e47` -- 1-2 tokens, no special characters, no quoting needed
3. **Quoted string values:** `type e12 "hello world"` -- LLMs handle double-quoted strings reliably
4. **Bare keyword arguments:** `press Enter`, `scroll down 500`, `wait networkIdle` -- no flag syntax needed
5. **One command per line:** LLMs naturally produce newline-separated output. No need for `;` or `&&` separators.

### Less Reliable Patterns (avoid these)

1. **Complex quoting:** `click 'role=button name~="Submit"'` -- nested quotes cause frequent errors
2. **Flag syntax:** `--interactive-only`, `--within "role=main"` -- fine for humans, adds failure modes for LLMs
3. **Pipe operators:** `snapshot | filter button` -- LLMs sometimes treat `|` as text, not operator
4. **JSON in commands:** `store {"company": "Microsoft"}` -- defeats the purpose of moving away from JSON
5. **Positional ambiguity:** `type "hello" e12` vs `type e12 "hello"` -- arg order must be consistent and unambiguous

### Grammar Design Rule

**The best CLI grammar for LLMs is: `<verb> <noun> [value]` where verb is a single known word, noun is a short ref, and value (if any) is a double-quoted string.**

This matches natural language ordering ("click the button", "type into the field 'hello'") and produces 3-5 tokens per command.

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority | Phase |
|---------|-----------|--------------------:|----------|-------|
| TS-2: Element refs | HIGH (enables everything) | MEDIUM | P0 | Core |
| TS-3: Compact snapshot | HIGH (biggest token savings) | HIGH | P0 | Core |
| TS-6: Interactive-only filter | HIGH (token reduction) | LOW | P0 | Core |
| TS-1: CLI grammar | HIGH (eliminates JSON failures) | MEDIUM | P0 | Core |
| TS-4: Multi-line batch | HIGH (natural batch) | LOW | P0 | Core |
| TS-5: Status responses | MEDIUM (AI feedback) | LOW | P0 | Core |
| TS-7: Reasoning separation | HIGH (prevents parse errors) | LOW | P0 | Core |
| D-1: Scoped snapshots | MEDIUM (further token savings) | LOW | P1 | Intelligence |
| D-2: Site-aware annotations | MEDIUM (leverages site guides) | MEDIUM | P1 | Intelligence |
| D-4: Completion signals | LOW (already exists differently) | LOW | P1 | Intelligence |
| D-3: Inline directives | LOW (convenience) | LOW | P1 | Intelligence |
| D-5: Progressive depth | MEDIUM (optimization) | MEDIUM | P2 | Optimization |

---

## Sources

**Playwright MCP / CLI (HIGH confidence):**
- [microsoft/playwright-mcp GitHub](https://github.com/microsoft/playwright-mcp) -- Official Playwright MCP server documentation
- [Playwright CLI: Token-Efficient Alternative](https://testcollab.com/blog/playwright-cli) -- CLI architecture and token comparison
- [Playwright CLI vs MCP - Better Stack](https://betterstack.com/community/guides/ai/playwright-cli-vs-mcp-browser/) -- Command syntax and token benchmarks
- [Token War: CLI vs MCP - TestShift](https://www.test-shift.com/posts/the-token-war-playwright-cli-vs-mcp) -- Detailed token count analysis (27K vs 114K)
- [Deep Dive into Playwright CLI - TestDino](https://testdino.com/blog/playwright-cli/) -- Command list and snapshot format
- [ARIA Snapshot Format - Playwright Docs](https://playwright.dev/docs/aria-snapshots) -- Official YAML snapshot specification

**agent-browser (HIGH confidence):**
- [vercel-labs/agent-browser GitHub](https://github.com/vercel-labs/agent-browser) -- Official repo with full command reference
- [agent-browser SKILL.md](https://github.com/vercel-labs/agent-browser/blob/main/skills/agent-browser/SKILL.md) -- Agent-facing command reference and workflow
- [agent-browser.dev](https://agent-browser.dev/) -- Official docs, 200-400 tokens claim
- [Agent-Browser 93% Context Savings](https://medium.com/@richardhightower/agent-browser-ai-first-browser-automation-that-saves-93-of-your-context-window-7a2c52562f8c) -- Context reduction benchmarks

**webctl (MEDIUM confidence):**
- [cosinusalpha/webctl GitHub](https://github.com/cosinusalpha/webctl) -- Official repo with command reference
- [HN Discussion: webctl](https://news.ycombinator.com/item?id=46616481) -- CLI vs MCP debate, real-world usage reports

**Token efficiency benchmarks (MEDIUM confidence):**
- [MCP vs CLI Benchmark](https://gist.github.com/szymdzum/c3acad9ea58f2982548ef3a9b2cdccce) -- 77 vs 60 score, 43x token difference on Amazon page
- [Accessibility Tree Formatting & Token Cost](https://dev.to/kuroko1t/how-accessibility-tree-formatting-affects-token-cost-in-browser-mcps-n2a) -- 51-79% reduction from format choices alone
- [Playwright MCP Deep Dive - ZStack](https://www.zstack-cloud.com/blog/playwright-mcp-deep-dive-the-perfect-combination-of-large-language-models-and-browser-automation/) -- Snapshot serializer architecture and ref system

**TOON format (LOW confidence -- informational only):**
- [TOON Format Spec](https://toonformat.dev/) -- 40% token reduction vs JSON for tabular data
- [TOON vs JSON vs YAML - Medium](https://medium.com/@ffkalapurackal/toon-vs-json-vs-yaml-token-efficiency-breakdown-for-llm-5d3e5dc9fb9c) -- Format comparison

**Codebase analysis (HIGH confidence):**
- FSB content/dom-analysis.js -- Current DOM structure format, element filtering, delta detection
- FSB background.js -- Current JSON action dispatch, batch execution, session management
- FSB ai-integration.js -- Current 5-tier JSON parsing pipeline, context tiers, prompt building
- FSB content/actions.js -- 25+ action tools that remain unchanged

---
*Feature research for: CLI-Based Browser Automation Protocol*
*Researched: 2026-02-27*
*Milestone: v10.0 CLI Architecture*
