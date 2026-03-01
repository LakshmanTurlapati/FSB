# Phase 17: Prompt Architecture Rewrite - Research

**Researched:** 2026-03-01
**Domain:** AI prompt engineering for CLI-based browser automation protocol
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **System prompt design**: Compact table format for CLI command reference -- scannable, dense, minimal tokens. Commands grouped by category (Navigation, Element Interaction, Text Input, Information, etc.). Per-command example column in the table (e.g., `click e5`, `type e12 "hello"`). `done` command gets both a row in the command table AND a dedicated "Task Completion" section with rules (verify before done, include result summary, etc.)
- **Site guide examples**: One-liner per action style -- each example is a single CLI command, not multi-step sequences. Include a "common patterns" section in each guide showing typical multi-step workflows for that site. Manual per-file migration of all 43+ site guide files from JSON to CLI format to ensure quality
- **Continuation & context tiers**: Brief reminder line for CLI syntax reinforcement in iteration 2+ prompts (e.g., "Respond with CLI commands only (verb ref args)"). Full context triggered by URL change; minimal context (changes only) when staying on same page. Include action history showing last N actions taken. Show iteration number (e.g., "Iteration 3")
- **Stuck recovery prompts**: Contextual suggestions based on what the AI is stuck on, not a generic ordered fallback list. AI can use a `help` command (like a real CLI) to look up available commands. Include anti-patterns: explicitly list common stuck behaviors to avoid. Escalation intensity across multiple stuck detections: Claude's discretion
- **`done` command**: Must replace the `taskComplete` JSON field entirely -- the only way to signal task completion
- **`help` command**: AI can call `help` like a real CLI to check available commands or get details on specific commands when stuck -- treating the command set as a self-documenting system

### Claude's Discretion
- Exact escalation strategy for stuck recovery (progressive vs consistent intensity)
- Ref format in site guide examples (semantic placeholders vs numeric refs)
- `help` command implementation details (full list vs contextual subset)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PROMPT-01 | System prompt redesigned around CLI command grammar with concise command reference replacing JSON tool documentation (~400 lines) | Codebase analysis shows current system prompt at lines 2206-2418 of ai-integration.js contains ~200 lines of JSON format instructions including response format block, batch action examples, and tool documentation. COMMAND_REGISTRY in cli-parser.js (Phase 15) defines all 60+ verb-to-tool mappings. The CLI command reference table can replace `getToolsDocumentation()` (lines 4523-4661) and the REQUIRED RESPONSE FORMAT block (lines 2359-2402). |
| PROMPT-02 | Context tiers preserved but adapted for CLI format -- continuation prompts reinforce CLI syntax | Current tiering: `MINIMAL_CONTINUATION_PROMPT` (lines 370-396) used for iteration 2+ on same domain; full prompt on first iteration, stuck, or domain change (line 2203). The minimal prompt currently says "RESPOND WITH ONLY VALID JSON" -- this is the primary string to replace. Action history formatting (lines 2636-2742) is format-agnostic (already uses tool names, not JSON). |
| PROMPT-03 | Stuck recovery prompts use CLI format and guide AI to try alternative CLI commands | Current stuck prompts at lines 2551-2803 contain JSON examples at line 2565 (`clickSearchResult` JSON example). Recovery strategies are already contextual (search page vs other). The `help` command provides a new recovery mechanism. |
| PROMPT-04 | All 43+ site guide files swept for JSON format examples and updated to CLI command examples | Critical finding: site guide files contain ZERO JSON format examples. Grep across all 94 site-guides/*.js files returned no matches for `"tool"` or `"params"`. The "migration" is actually about ADDING CLI command examples and common patterns sections, not removing JSON. The JSON artifacts live in `ai-integration.js`'s `_buildTaskGuidance()` line 4251 (`{"ref": "e5"}` reference) and `getToolsDocumentation()` with JSON examples. |
| PROMPT-05 | Task-type prompts rewritten for CLI output format | Current TASK_PROMPTS object (lines 186-366) contains 11 task types with JSON format examples in: `email` (line 206: keyPress JSON), `gaming` (line 250: JSON examples), `career` (line 288-364: JSON storeJobData format at line 439). Other task types (search, form, extraction, navigation, shopping, multitab, general) reference tool names but not JSON format. |
| PROMPT-06 | Batch action instructions reference multi-line CLI commands instead of batchActions JSON array | BATCH_ACTION_INSTRUCTIONS constant (lines 400-435) uses JSON batchActions format. In CLI, multi-line commands ARE the batch -- no special syntax needed. This constant can be replaced with a brief note about multi-line commands. |
| PROMPT-07 | The `done` command replaces the `taskComplete` JSON field -- AI outputs `done "result summary"` to signal completion | CLI parser already handles `done` signal (cli-parser.js line 247, signal handling at lines 591-594). `parseCliResponse()` sets `taskComplete: true` and `result` from the done message. Prompts need to document `done` instead of `taskComplete: true`. The JSON response format block (lines 2359-2402) must be replaced entirely. |
</phase_requirements>

## Summary

Phase 17 rewrites every AI-facing prompt string in `ai-integration.js` to use CLI command grammar (verb + ref + args) exclusively. The Phase 15 CLI parser and Phase 16 YAML snapshot are already built; this phase changes what the AI is told to output.

The most important finding from codebase analysis: the scope is more concentrated than expected. All JSON format references live in a single file (`ai/ai-integration.js`), not spread across site guides. The 94 site guide files contain zero JSON tool-call examples -- they use natural language descriptions of workflows and CSS selectors. The "site guide migration" is therefore about enriching guides with CLI command examples and common patterns, not about removing JSON artifacts.

The core work is rewriting five prompt string areas in `ai-integration.js`: (1) the full system prompt (lines 2206-2418), (2) the `MINIMAL_CONTINUATION_PROMPT` constant (lines 370-396), (3) the `BATCH_ACTION_INSTRUCTIONS` constant (lines 400-435), (4) the `TASK_PROMPTS` object (lines 186-366), and (5) the stuck recovery prompt injections (lines 2551-2803). Additionally, the `getToolsDocumentation()` method must switch from JSON param format to CLI command table format, and the `_buildTaskGuidance()` method must update its JSON ref instruction.

**Primary recommendation:** Structure the work as two plans -- Plan 01 rewrites all prompts in `ai-integration.js` (system prompt, continuation, stuck recovery, task-type prompts, tool documentation, batch instructions). Plan 02 enriches site guides with CLI command examples and common patterns sections. The `help` command needs a registry entry in `cli-parser.js` and a handler in the prompt/response pipeline.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| vanilla JS | ES2021+ | All prompt strings are JS template literals | Project constraint: no build system, no npm |
| cli-parser.js | 1.0.0 (Phase 15) | COMMAND_REGISTRY defines canonical verb list | Source of truth for CLI grammar in prompts |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| COMMAND_REGISTRY | Phase 15 | Lookup table of 60+ CLI verbs and aliases | Reference when building CLI command table for system prompt |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Inline string constants | Separate cli-prompt.js file | Architecture research proposed this, but all prompt strings currently live in ai-integration.js. Moving to separate file adds import complexity. Keep in ai-integration.js for this phase; refactor later if needed. |

## Architecture Patterns

### Recommended Change Structure
```
ai/
  ai-integration.js     # MODIFIED: All prompt strings rewritten
  cli-parser.js         # MINOR ADDITION: help command in COMMAND_REGISTRY
content/
  (no changes)
site-guides/
  **/*.js              # 84+ per-site files ENRICHED with CLI examples
  **/_shared.js        # 9 shared files reviewed (no JSON to remove)
  index.js             # No changes needed
```

### Pattern 1: CLI Command Reference Table
**What:** Replace verbose JSON tool documentation with a compact markdown table embedded in the system prompt.
**When to use:** System prompt tool documentation section.
**Example (from CONTEXT.md decisions):**
```
COMMANDS:
| Verb | Args | Description | Example |
|------|------|-------------|---------|
| click | ref | Click element | click e5 |
| type | ref "text" | Type into field | type e12 "hello" |
| navigate | "url" | Go to URL | navigate "https://example.com" |
| search | "query" | Google search | search "wireless mouse" |
| scroll | direction | Scroll page | scroll down |
| enter | [ref] | Press Enter | enter e5 |
| key | "key" [--ctrl] | Press key | key "Escape" |
| gettext | ref | Read element text | gettext e7 |
| done | ["summary"] | Task complete | done "Found 5 results" |
| help | [verb] | Show command help | help type |
```

This table replaces the `getToolsDocumentation()` method output (currently ~130 lines of JSON-formatted tool descriptions).

### Pattern 2: CLI Syntax Reinforcement in Continuation Prompts
**What:** One-line CLI format reminder injected into continuation iterations.
**When to use:** Every iteration 2+ prompt.
**Example:**
```
Respond with CLI commands only (verb ref args). Use # for reasoning. Use done "summary" to complete.
```
This replaces the current `RESPOND WITH ONLY VALID JSON. No markdown, no explanations.` instruction.

### Pattern 3: Contextual Stuck Recovery with Anti-Patterns
**What:** Stuck recovery prompts suggest specific CLI commands based on the current stuck context, plus explicitly list behaviors to avoid.
**When to use:** When `context.isStuck` is true.
**Example:**
```
STUCK RECOVERY (attempt 2):
Try these alternatives:
- scroll down  # reveal more elements
- back         # return to previous page
- help         # check available commands

DO NOT:
- Repeat the same click that failed
- Search again when results are visible
- Type into the same field twice
```

### Pattern 4: help Command as Self-Documenting CLI
**What:** Register `help` in COMMAND_REGISTRY as a signal command. When the AI outputs `help` or `help type`, the automation loop responds with the relevant command documentation instead of dispatching to content script.
**When to use:** AI outputs `help` during stuck recovery or when uncertain about command syntax.
**Implementation:** `help` is a signal command (like `done`) -- the parser returns `{signal: 'help', message: 'type'}`, and the automation loop in background.js constructs a help response as the next AI input.

### Pattern 5: done Command with Task Completion Rules
**What:** Dedicated section in system prompt documenting `done "summary"` as the sole completion mechanism.
**When to use:** Always present in system prompt.
**Example in prompt:**
```
TASK COMPLETION:
- Output: done "detailed summary of what was accomplished"
- ONLY use done after verifying the task is actually complete
- Include specific data found (exact values, not "found it")
- If critical actions failed, retry before using done
```

### Anti-Patterns to Avoid
- **Leaving JSON format remnants in prompts:** Every `{"tool": "...", "params": {...}}` string must be replaced with CLI equivalent. Systematic grep after rewrite.
- **Over-documenting CLI in continuation prompts:** The user decision is a "brief reminder line", not a full re-explanation. Keep continuation CLI reinforcement to one line.
- **Mixing JSON and CLI examples in same prompt:** Do not keep any JSON as "also valid". Full CLI commitment per REQUIREMENTS.md (no JSON fallback in prompts, even though the parser keeps JSON fallback).
- **Breaking action history format:** Action history logging (lines 2636-2742) uses `action.tool` and `summarizeParams()` -- these are format-agnostic and do NOT need CLI conversion. They describe what was done, not what to output.
- **Changing site guide data structures:** Site guide `.selectors`, `.workflows`, `.warnings` properties are consumed by `_buildTaskGuidance()` and formatted into prompt text. The data structures stay the same; only the guidance text strings and the selector note get CLI format updates.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CLI verb list for prompt table | Manually listing verbs | Derive from COMMAND_REGISTRY keys | Single source of truth, auto-updated if new verbs added |
| help command response text | Ad-hoc string construction | Build from COMMAND_REGISTRY arg schemas | Same data used by parser and help system |
| Task completion detection | New taskComplete handling | Existing parseCliResponse() done signal | Already implemented in Phase 15 |

**Key insight:** The CLI parser module already defines the complete command grammar. Prompts should reference the same source of truth, not duplicate it. The `help` command response should be generated from COMMAND_REGISTRY rather than hardcoded.

## Common Pitfalls

### Pitfall 1: Incomplete JSON Sweep
**What goes wrong:** After rewriting major prompt sections, stray JSON examples remain in edge-case code paths (e.g., `multiSiteDirective` at line 2439, `sheetsDataDirective` at line 2469).
**Why it happens:** JSON format strings are scattered across 40+ locations in ai-integration.js beyond the main system prompt.
**How to avoid:** After all rewrites, run a systematic grep for `"tool":`, `"params":`, `"actions":`, `"batchActions":`, `"taskComplete":`, `"ref":` across the entire file. Every match must be either removed or converted.
**Warning signs:** AI occasionally outputs JSON instead of CLI during testing -- indicates a prompt still has JSON examples.

### Pitfall 2: Losing Task-Type Context in CLI Prompts
**What goes wrong:** Task-type prompts (career, shopping, email, etc.) contain domain-specific workflows that are critical for success. Converting them to CLI format risks losing the nuanced workflow instructions.
**Why it happens:** Focus on format conversion overshadows content preservation.
**How to avoid:** For each TASK_PROMPTS entry, convert JSON examples to CLI equivalents but preserve all workflow text, verification rules, and error reporting formats.
**Warning signs:** Career/sheets task success rate drops after prompt rewrite.

### Pitfall 3: Continuation Prompt Too Minimal
**What goes wrong:** The one-line CLI reinforcement is insufficient; AI reverts to JSON on iteration 3+ because it pattern-matches from conversation history.
**Why it happens:** AI conversation history still contains JSON-format exchanges from before this phase goes live (Phase 18 handles history format change).
**How to avoid:** The continuation prompt should include the CLI format reminder AND a brief "Respond with verb ref args, NOT JSON" explicit negation. Also add: `# your reasoning` and `done "summary"` as format examples.
**Warning signs:** AI outputs JSON in later iterations despite CLI prompt.

### Pitfall 4: help Command Without Proper Handler
**What goes wrong:** AI outputs `help` or `help type`, parser returns a signal, but the automation loop has no handler for it -- resulting in no action and a stuck iteration.
**Why it happens:** The `help` command requires coordination between the parser (signal detection), the automation loop (response construction), and the prompt (re-injection of help text).
**How to avoid:** Plan the help command across all three layers. The simplest approach: parser detects `help` signal -> automation loop constructs a help response string from COMMAND_REGISTRY -> injects as the "page state" in the next AI call.
**Warning signs:** AI outputs `help` but gets no response, then gets stuck.

### Pitfall 5: Site Guide "Migration" Scope Misunderstanding
**What goes wrong:** Significant time spent trying to remove JSON from site guides that don't contain any, or adding overly verbose CLI examples that bloat prompts.
**Why it happens:** Phase description says "All 43+ site guide files contain CLI command examples" and "zero remaining JSON format examples", creating the impression of a removal task. In reality, guides have no JSON to remove -- the work is adding CLI examples.
**How to avoid:** Scope the site guide work as ENRICHMENT (add CLI examples, add common patterns), not MIGRATION (remove JSON). Keep examples minimal (one-liner per action per the user decision).
**Warning signs:** PR diff shows only additions in site-guides/, no removals.

### Pitfall 6: Breaking the Sheets/Career Directive Injections
**What goes wrong:** The `sheetsDataDirective` and `multiSiteDirective` injected into the system prompt contain JSON tool examples that get overlooked.
**Why it happens:** These directives are conditionally injected (only when `context.sheetsData` or `context.multiSite` exist), so they're not visible in the main prompt flow.
**How to avoid:** Systematically audit all conditional prompt injections: `multiSiteDirective` (line 2430), `sheetsDataDirective` (line 2469), `formattingDirective` (via `buildSheetsFormattingDirective`), `completionCandidate` (line 2861), `criticalActionWarnings` (line 2878).
**Warning signs:** Sheets data entry or multi-company career search breaks after prompt rewrite.

## Code Examples

### Example 1: CLI Command Reference Table (for system prompt)
```javascript
// Source: Derived from COMMAND_REGISTRY in cli-parser.js + user decisions
const CLI_COMMAND_TABLE = `
COMMANDS (verb ref "args" --flags):
| Verb | Args | Description | Example |
|------|------|-------------|---------|
| click | ref | Click element | click e5 |
| type | ref "text" | Type into field | type e12 "hello world" |
| clear | ref | Clear input | clear e12 |
| select | ref "value" | Select dropdown option | select e8 "Option B" |
| check | ref | Toggle checkbox | check e3 |
| hover | ref | Hover element | hover e7 |
| focus | ref | Focus element | focus e12 |
| enter | [ref] | Press Enter | enter e5 |
| key | "key" [--ctrl --shift --alt --meta] | Press key | key "Escape" |
| navigate | "url" | Go to URL | navigate "https://example.com" |
| search | "query" | Google search | search "wireless mouse" |
| back | | Browser back | back |
| forward | | Browser forward | forward |
| refresh | | Reload page | refresh |
| scroll | direction [amount] | Scroll page | scroll down |
| scrolltotop | | Scroll to top | scrolltotop |
| scrolltobottom | | Scroll to bottom | scrolltobottom |
| gettext | ref | Read element text | gettext e7 |
| getattr | ref "attr" | Read attribute | getattr e5 "href" |
| wait | "selector" | Wait for element | wait ".modal" |
| waitstable | | Wait for DOM stable | waitstable |
| opentab | "url" | Open new tab | opentab "https://sheets.google.com" |
| switchtab | tabId | Switch to tab | switchtab 123456 |
| tabs | | List open tabs | tabs |
| done | ["summary"] | Complete task | done "Found 5 results" |
| help | [verb] | Show command help | help type |
`;
```

### Example 2: CLI System Prompt Core (replacing JSON format block)
```javascript
// Source: Rewrite of lines 2206-2402 in ai-integration.js
const cliSystemPromptCore = `You are a browser automation agent. Analyze the page snapshot and complete the given task.

RESPONSE FORMAT:
Output CLI commands, one per line. Use # for reasoning comments.
  # your analysis of the current page state
  # your plan and why you chose this approach
  click e5
  type e12 "search query"
  done "task completed successfully with these results: ..."

RULES:
- One command per line
- Use element refs from the snapshot: e1, e2, etc.
- Quote strings with double quotes: type e12 "hello world"
- Use # comments for reasoning (REQUIRED before actions)
- End with done "summary" when task is complete
- Refs are only valid for current snapshot -- if action fails with "stale", use latest refs
- For waitForElement (element not in DOM yet), use CSS selector: wait ".modal"
`;
```

### Example 3: CLI Continuation Prompt (replacing MINIMAL_CONTINUATION_PROMPT)
```javascript
// Source: Rewrite of lines 370-396 in ai-integration.js
const CLI_CONTINUATION_PROMPT = `You are a browser automation agent. Continue the task based on the current page state.

Respond with CLI commands only (verb ref args). Use # for reasoning. Use done "summary" to complete.

RULES:
1. If search results are shown, click a result -- do not search again
2. Only use done when task is ACTUALLY complete
3. If a previous type action SUCCEEDED, do not re-type -- just submit (enter or click submit)
4. Check hasMoreBelow and scroll down if looking for content
5. For extraction tasks, extract visible items, scroll down, repeat until atBottom
6. Do NOT retry actions that already showed SUCCESS in action history
7. Use refs from the latest snapshot -- stale refs mean the page changed`;
```

### Example 4: CLI Stuck Recovery Prompt (replacing JSON stuck examples)
```javascript
// Source: Rewrite of lines 2551-2803 in ai-integration.js
// Contextual stuck recovery -- search page example
if (isOnSearchPage) {
  userPrompt += `\n\nSTUCK ON SEARCH RESULTS -- RECOVERY:`;
  userPrompt += `\n# Do NOT search again -- results are already visible`;
  userPrompt += `\n# Click a search result to navigate to the target page:`;
  userPrompt += `\nclicksearchresult e3`;
  userPrompt += `\n# If that fails, try the next result`;
  userPrompt += `\nclicksearchresult e5`;

  if (context.stuckCounter >= 2) {
    userPrompt += `\n\nFORCED: You have been stuck ${context.stuckCounter} iterations. Execute clicksearchresult NOW.`;
  }
}

// Generic stuck recovery
userPrompt += `\n\nSTUCK RECOVERY -- change approach:`;
userPrompt += `\n# Try these alternatives:`;
userPrompt += `\nscroll down    # reveal more elements`;
userPrompt += `\nback           # return to previous page`;
userPrompt += `\nhelp           # check available commands`;
userPrompt += `\n\nDO NOT:`;
userPrompt += `\n- Repeat the same click that already failed`;
userPrompt += `\n- Search again when results are visible`;
userPrompt += `\n- Type into the same field without clearing first`;
```

### Example 5: Site Guide CLI Examples (enrichment pattern)
```javascript
// Source: Pattern for enriching site guide files
// Before (current -- no examples, just selectors/guidance text):
guidance: `WORKDAY ATS PLATFORM INTELLIGENCE:
SEARCH:
- searchBox: [data-automation-id="keywordSearchInput"]
...`

// After (enriched with CLI examples per user decision):
guidance: `WORKDAY ATS PLATFORM INTELLIGENCE:

COMMON PATTERNS:
  # search for jobs
  click e5    # search box
  type e5 "software engineer"
  enter
  # extract job data
  gettext e12   # job title
  getattr e15 "href"   # apply link

SEARCH:
- searchBox: [data-automation-id="keywordSearchInput"]
...`
```

### Example 6: help Command Registry Entry
```javascript
// Addition to COMMAND_REGISTRY in cli-parser.js
help: { tool: '__help', args: [{ name: 'verb', type: 'string', optional: true }], signal: 'help' },
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| JSON tool calls in AI prompts | CLI commands (verb ref args) | Phase 15-17 (v10.0) | 60-70% token reduction in AI responses, near-zero parse failures |
| ~400-line JSON tool documentation | Compact CLI command table (~50 lines) | Phase 17 | 85% reduction in tool docs tokens |
| taskComplete JSON field | done "summary" CLI command | Phase 17 | Unified completion mechanism, no format mismatch |
| batchActions JSON array | Multi-line CLI commands | Phase 17 | Natural batching, no special syntax |

**Deprecated/outdated:**
- `TOOL_DOCUMENTATION` constant (lines 15-116): Will be replaced by CLI command table but kept in code as reference for `getToolsDocumentation()` until Phase 18 completes the swap
- `BATCH_ACTION_INSTRUCTIONS` constant (lines 400-435): Replaced by a brief note about multi-line commands being natural batches
- JSON response format block (lines 2359-2402): Replaced entirely by CLI format instructions

## Detailed Audit: JSON Format Locations in ai-integration.js

All locations requiring conversion (grep for `"tool":`, `"ref":`, `"params":`, `taskComplete`, `batchActions`, `JSON`):

| Line(s) | Content | Action Required |
|---------|---------|-----------------|
| 15-116 | `TOOL_DOCUMENTATION` constant | Replace with CLI command table |
| 186-366 | `TASK_PROMPTS` object (11 types) | Convert JSON examples to CLI |
| 206 | email: keyPress JSON fallback | Convert to `key "Enter" --meta` |
| 250 | gaming: JSON tool examples | Convert to CLI |
| 370-396 | `MINIMAL_CONTINUATION_PROMPT` | Rewrite for CLI |
| 387 | "Use refs in actions: JSON example" | Convert to `click e1` |
| 393-395 | JSON response format example | Replace with CLI format |
| 400-435 | `BATCH_ACTION_INSTRUCTIONS` | Replace with multi-line CLI note |
| 429-434 | JSON batch example | Convert to multi-line CLI |
| 2206-2418 | Full system prompt | Rewrite for CLI |
| 2220 | "refs in actions: JSON" | Convert to `click e1` |
| 2224 | "ONLY valid JSON" | Change to "CLI commands only" |
| 2261 | clickSearchResult JSON example | Convert to `clicksearchresult e3` |
| 2359-2402 | REQUIRED RESPONSE FORMAT (JSON) | Replace with CLI format |
| 2439 | multiSiteDirective storeJobData JSON | Convert to CLI |
| 2565 | stuck recovery clickSearchResult JSON | Convert to CLI |
| 4251 | `{"ref": "e5"}` in site guidance note | Convert to `click e5` |
| 4523-4661 | `getToolsDocumentation()` method | Rewrite to output CLI table |
| 4540 | type tool JSON example | Convert to CLI |
| 4552 | scroll tool JSON example | Convert to CLI |
| 4566-4567 | keyPress JSON examples | Convert to CLI |
| 4572 | pressKeySequence JSON example | Convert to CLI |
| 4577 | typeWithKeys JSON example | Convert to CLI |
| 4582 | sendSpecialKey JSON example | Convert to CLI |
| 4587-4607 | arrow/game JSON examples | Convert to CLI |
| 4612 | getEditorContent JSON example | Convert to CLI |

**Total: ~35 discrete JSON format locations, all in ai-integration.js**

## Open Questions

1. **help command handler location**
   - What we know: Parser can detect `help` as a signal (trivial COMMAND_REGISTRY addition). The AI receives a response and needs to see help text.
   - What's unclear: Should the help response be injected as a system message, user message, or as part of the page state in the next iteration? Should it be handled in `background.js` automation loop or `ai-integration.js` prompt builder?
   - Recommendation: Handle in `background.js` automation loop. When `help` signal detected, don't dispatch to content script -- instead, construct help text from COMMAND_REGISTRY and inject it as a "virtual action result" that becomes part of the next iteration's context. This keeps the prompt builder clean.

2. **Ref format in site guide examples**
   - What we know: User decision allows Claude's discretion on semantic placeholders vs numeric refs.
   - What's unclear: Which format helps AI models output correct CLI commands more reliably?
   - Recommendation: Use numeric refs (`e5`, `e12`) in site guide examples. This matches what the AI sees in the snapshot and reinforces the pattern. Semantic placeholders like `{searchBox}` could confuse models into thinking they should output those tokens. Since guides also list CSS selectors with human-readable names, the mapping is already clear.

3. **Escalation strategy for stuck recovery**
   - What we know: User decision allows Claude's discretion on progressive vs consistent intensity.
   - What's unclear: Does progressive escalation (gentle -> moderate -> forceful) or consistent strong messages work better for AI models?
   - Recommendation: Progressive escalation. Level 1 (stuckCounter=1): suggest alternatives with `help`. Level 2 (stuckCounter=2): add explicit anti-patterns ("DO NOT repeat..."). Level 3 (stuckCounter>=3): force a specific alternative command. This matches the current escalation pattern in the codebase (line 2568: forced action at stuckCounter>=2).

## Sources

### Primary (HIGH confidence)
- `ai/ai-integration.js` -- full codebase analysis of all prompt strings, tool documentation, continuation prompts, stuck recovery, task-type prompts (lines 15-4720)
- `ai/cli-parser.js` -- Phase 15 CLI parser with COMMAND_REGISTRY (60+ verb definitions), parseCliResponse, done/fail signal handling
- `content/dom-analysis.js` -- Phase 16 YAML snapshot format (buildYAMLSnapshot, buildElementLine, buildMetadataHeader)
- `site-guides/**/*.js` -- 94 files analyzed, confirmed zero JSON tool-call examples
- `.planning/phases/17-prompt-architecture-rewrite/17-CONTEXT.md` -- user decisions
- `.planning/REQUIREMENTS.md` -- PROMPT-01 through PROMPT-07 definitions
- `.planning/research/ARCHITECTURE.md` -- v10.0 data flow and change boundary documentation

### Secondary (MEDIUM confidence)
- Industry patterns from Playwright CLI, agent-browser (ref-based CLI for browser automation)
- Current AI model behavior with CLI prompts (from Phase 15 research)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- pure vanilla JS, no libraries needed, all code in single file
- Architecture: HIGH -- full line-by-line audit of every JSON format location in codebase
- Pitfalls: HIGH -- based on actual codebase analysis showing exact locations of JSON remnants

**Research date:** 2026-03-01
**Valid until:** 2026-04-01 (30 days -- prompt content is stable, no external dependencies)
