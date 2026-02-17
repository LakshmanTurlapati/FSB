# Phase 2: DOM Serialization Pipeline - Research

**Researched:** 2026-02-14
**Domain:** AI prompt budget allocation, element serialization, task-adaptive content filtering
**Confidence:** HIGH

## Summary

This phase increases the AI's page visibility from ~26% to near-100% by raising the user prompt character cap from 5,000 to ~15,000 and restructuring how that budget is allocated across prompt sections. The current architecture has a single `HARD_PROMPT_CAP = 5000` (line 1898 of `ai/ai-integration.js`) that applies a flat truncation to the entire `userPrompt` string. With 50 elements averaging ~100 chars each, the elements alone consume the entire budget, leaving zero room for HTML context, automation context, or memory -- and often truncating elements mid-field.

The codebase has two distinct prompt paths: (1) `buildPrompt()` for first iterations and stuck recovery (full system prompt + user prompt with HARD_PROMPT_CAP), and (2) `buildMinimalUpdate()` for multi-turn iterations (no cap, MAX_MINIMAL_ELEMENTS=25). Both paths need budget-aware element formatting, but `buildPrompt` is the critical path because it sets the initial context window that all subsequent iterations build on. The system prompt (~11,260 chars) is sent separately to the API and is NOT subject to the HARD_PROMPT_CAP -- only the user prompt is capped.

Five requirements drive this phase: raise the cap with proportional allocation (DOM-01), priority-aware whole-element truncation (DOM-02), adaptive text limits by element type (DOM-03), dynamic element budget by page complexity (DOM-04), and task-adaptive content modes (DIF-03). All changes modify existing functions in `ai/ai-integration.js` only -- no new files, no new dependencies.

**Primary recommendation:** Implement changes in three sequential steps: (1) raise HARD_PROMPT_CAP to 15000 for immediate gain, (2) add budget-partitioned formatting to `formatElements()` and `formatHTMLContext()`, (3) add task-adaptive content modes to `buildMinimalUpdate()`. Never change the element format and prompt instructions simultaneously.

## Standard Stack

This phase uses no external libraries. All changes are pure vanilla JavaScript within the Chrome Extension service worker (`ai/ai-integration.js`).

### Core
| Technology | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| String length counting | JavaScript built-in | Budget tracking (char-based) | Simple, deterministic, already used via `.length` throughout codebase |
| `Array.prototype.sort/filter/slice` | ES2015+ | Priority-based element selection | Already used in element filtering (lines 10560, 10883) |
| Template literals | ES2015+ | Prompt construction | Already used throughout `buildPrompt()` |

### Supporting
| Technology | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `detectTaskType()` | Internal (line 3006) | Task classification for content modes | Already exists, returns search/form/extraction/navigation/email/shopping/general/gaming |
| `inferPageIntent()` | Internal (content.js line 10283) | Page intent for prioritization signals | Already exists, returns intent strings passed via `domState.pageContext` |
| `getFilteredElements()` | Internal (content.js line 10519) | 3-stage element filtering pipeline | Already exists, handles element scoring and filtering to maxElements |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Character-based budget | Token-based budget (chars/3.5 estimate) | Token counting is approximate; char-based is deterministic and already used for the cap. The 3.5 chars/token ratio is used for logging only (line 1993). Stick with chars for budget allocation. |
| Single user-prompt cap | Separate caps per section | Separate caps are more precise but add complexity. A partitioned budget within a single cap achieves the same result with less code. |
| AI-side filtering | Content-script-side filtering | Content script already filters to 50 elements. Further AI-side budget allocation handles the prompt formatting, which is the right layer. |

**Installation:** None needed. No new dependencies.

## Architecture Patterns

### Current Data Flow (What Exists)
```
content.js: getStructuredDOM()
  -> filters to 50 elements (maxElements)
  -> sends domState via message passing

background.js: receives domState
  -> passes to ai.getAutomationActions(task, domState, context)

ai-integration.js: getAutomationActions()
  -> First iteration: buildPrompt(task, domState, context)
    -> formatElements(elements) -- no budget param, formats ALL elements
    -> formatHTMLContext(htmlContext) -- no budget param, formats ALL
    -> HARD_PROMPT_CAP = 5000 truncates userPrompt (DESTRUCTIVE)
  -> Multi-turn: buildMinimalUpdate(domState, context)
    -> MAX_MINIMAL_ELEMENTS = 25, no cap
    -> formatElements(elementsToShow) -- all 25 elements
```

### Target Data Flow (What We Build)
```
ai-integration.js: getAutomationActions()
  -> First iteration: buildPrompt(task, domState, context)
    -> Calculate total budget = 15000
    -> Partition: pageContext=7500, automationContext=6000, memory=1500
    -> formatElements(elements, charBudget, taskType) -- budget-aware
    -> formatHTMLContext(htmlContext, charBudget) -- budget-aware
    -> No destructive truncation needed (budget respected during construction)
  -> Multi-turn: buildMinimalUpdate(domState, context)
    -> Dynamic element count based on page complexity
    -> Task-adaptive content modes (text_only, input_fields, full)
    -> formatElements with budget param
```

### Pattern 1: Budget-Partitioned Prompt Construction
**What:** Instead of building the full prompt and truncating, allocate a character budget to each section and fill sections in priority order, stopping when budget is exhausted.
**When to use:** In `buildPrompt()` when constructing the user prompt, and in `buildMinimalUpdate()` for multi-turn prompts.

```javascript
// Budget allocation within buildPrompt()
const TOTAL_USER_BUDGET = 15000;
const budgets = {
  taskAndContext: Math.floor(TOTAL_USER_BUDGET * 0.10),  // ~1500: task, URL, scroll, page state
  automationContext: Math.floor(TOTAL_USER_BUDGET * 0.30), // ~4500: action history, stuck recovery
  pageElements: Math.floor(TOTAL_USER_BUDGET * 0.45),     // ~6750: formatted elements
  htmlContext: Math.floor(TOTAL_USER_BUDGET * 0.05),       // ~750: HTML context (supplementary)
  memory: Math.floor(TOTAL_USER_BUDGET * 0.10)             // ~1500: session memory, compacted summary
};
// Note: 40% "system" in requirements refers to task+automation context in the user prompt.
// The actual system prompt is sent separately and is NOT subject to this cap.
```

### Pattern 2: Priority-Aware Whole-Element Truncation
**What:** Elements are serialized one at a time. After each element, check remaining budget. If the next element would exceed the budget, stop including elements. Never truncate an element mid-field.
**When to use:** In `formatElements()` when building the element list string.

```javascript
// Priority-aware element formatting with budget
formatElements(elements, charBudget = Infinity, taskType = 'general') {
  if (!Array.isArray(elements)) return 'No elements available';

  // Sort elements by task relevance (task-type-aware priority)
  const prioritized = this.prioritizeElementsForTask(elements, taskType);

  const lines = [];
  let usedChars = 0;

  for (const el of prioritized) {
    const line = this.formatSingleElement(el, taskType);
    if (usedChars + line.length + 1 > charBudget) break; // +1 for newline
    lines.push(line);
    usedChars += line.length + 1;
  }

  // If elements were excluded, add count
  if (lines.length < prioritized.length) {
    lines.push(`... ${prioritized.length - lines.length} more elements (budget exhausted)`);
  }

  return lines.join('\n');
}
```

### Pattern 3: Task-Adaptive Content Modes (DIF-03)
**What:** Different DOM representations based on current sub-task. The task type determines which element fields are included and which elements are prioritized.
**When to use:** In `buildMinimalUpdate()` and `formatElements()` to control verbosity.

```javascript
// Content mode selection based on task type
function getContentMode(taskType) {
  switch (taskType) {
    case 'form':
    case 'email':
      return 'input_fields'; // Prioritize inputs, labels, form structure
    case 'extraction':
      return 'text_only';    // Prioritize text content, minimize interaction details
    case 'search':
    case 'navigation':
    case 'shopping':
    case 'general':
    default:
      return 'full';         // All element details for general interaction
  }
}

// Per-mode element formatting
function formatSingleElement(el, taskType) {
  const mode = getContentMode(taskType);
  let desc = `[${el.elementId}] ${el.type}`;

  // Always include: elementId, type, text, selector
  if (el.text) {
    const limit = getTextLimit(el, mode);
    const text = sanitizePageContent(el.text).substring(0, limit);
    desc += ` "${text}${el.text.length > limit ? '...' : ''}"`;
  }

  // Mode-specific fields
  if (mode === 'input_fields') {
    // Include: placeholder, labelText, inputType, formId, value state
    if (el.inputType) desc += ` type="${el.inputType}"`;
    if (el.placeholder) desc += ` placeholder="${el.placeholder}"`;
    if (el.labelText) desc += ` label="${el.labelText}"`;
    if (el.formId) desc += ` in ${el.formId}`;
    // Skip: position, class, href (not needed for form filling)
  } else if (mode === 'text_only') {
    // Include: full text (higher limit), id
    // Skip: position, class, interaction state, form details
    if (el.id) desc += ` #${el.id}`;
  } else { // 'full'
    // Include everything (current formatElements behavior)
    if (el.id) desc += ` #${el.id}`;
    if (el.class) desc += ` .${el.class.split(' ').slice(0, 2).join('.')}`;
    if (el.inputType) desc += ` type="${el.inputType}"`;
    // ... (all current fields)
  }

  // Always include primary selector (required for actions)
  if (el.selectors?.length > 0) {
    const cssSelector = el.selectors.find(s => !s.startsWith('//'));
    desc += ` selector: "${cssSelector || el.selectors[0]}"`;
  }

  return desc;
}
```

### Pattern 4: Dynamic Element Budget by Page Complexity (DOM-04)
**What:** Scale the number of elements and per-element verbosity based on page complexity.
**When to use:** In both `buildPrompt()` and `buildMinimalUpdate()` to determine how many elements to include.

```javascript
// Dynamic element budget calculation
function calculateElementBudget(elements, charBudget) {
  const totalElements = elements.length;

  if (totalElements <= 30) {
    // Simple page: include ALL elements, full verbosity
    return { maxElements: totalElements, compressionLevel: 'none' };
  } else if (totalElements <= 60) {
    // Medium page: include all, moderate compression
    return { maxElements: totalElements, compressionLevel: 'moderate' };
  } else {
    // Complex page: budget-limited, heavy compression
    // Scale up budget: 100-150 elements with compressed format
    const targetElements = Math.min(totalElements, 150);
    return { maxElements: targetElements, compressionLevel: 'heavy' };
  }
  // Note: actual inclusion stops when charBudget is exhausted
}

// Compression levels affect per-element format
// 'none': ~150 chars/element (full detail)
// 'moderate': ~100 chars/element (skip class, some states)
// 'heavy': ~60 chars/element (id, text, type, selector only)
```

### Anti-Patterns to Avoid
- **Building full prompt then truncating:** The current approach (build everything, then `substring(0, HARD_PROMPT_CAP)`) destroys data mid-field. Always build within budget.
- **Fixed per-element text limits:** Using a single text limit (e.g., 50 chars) for all element types loses critical context. List items need 150 chars, buttons need 80 chars.
- **Changing format and prompt instructions simultaneously:** Per Pitfall 2 mitigation in the roadmap, the AI must adapt to format changes separately from instruction changes. Step 1 raises the cap (same format, more data); Step 2 changes the format.
- **Filtering elements by type only:** Excluding all non-interactive elements loses critical context (headings, labels, text). Priority should be based on task relevance, not just interactivity.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Task type detection | New classifier | Existing `detectTaskType()` (line 3006) | Already handles 9 task types with site guide integration; tested and working |
| Page intent classification | New intent system | Existing `inferPageIntent()` (content.js line 10283) | Already classifies 15+ intents; passed via `domState.pageContext.pageIntent` |
| Element prioritization | New scoring system | Existing `getFilteredElements()` + `prioritizeElements()` | Content script already scores and filters elements; AI-side just needs budget-aware output |
| Token estimation | Custom tokenizer | `chars / 3.5` estimate already in codebase (line 1993) | Approximate but sufficient for budget allocation; used for logging only |

**Key insight:** The content script pipeline (3-stage filtering, viewport prioritization, 50-element limit) already handles element selection well. This phase's job is entirely about prompt construction in `ai-integration.js` -- deciding how much of the already-filtered data to include and in what format.

## Common Pitfalls

### Pitfall 1: Format Changes Breaking AI Parsing
**What goes wrong:** Changing how elements are formatted causes the AI to misparse selectors, element IDs, or text, leading to failed actions.
**Why it happens:** The AI has learned to parse the current format from the system prompt's examples and instructions. Abrupt format changes without updating parsing expectations cause confusion.
**How to avoid:** Step 1: Raise cap only (same format, more data). Step 2: Modify format. Never both in the same plan. Verify AI can still extract selectors and element IDs after format changes.
**Warning signs:** After format changes, AI starts using wrong selectors, ignoring elements, or producing malformed tool calls.

### Pitfall 2: Over-Aggressive Filtering Removes Task-Critical Elements
**What goes wrong:** Priority-based filtering excludes elements the AI needs for the current task (e.g., filtering out text elements during a form-fill task but the form labels are needed).
**Why it happens:** Priority scoring based on element type doesn't account for context dependencies (labels describe inputs, headings provide navigation context).
**How to avoid:** Use DOM-04's dynamic budget: simple pages (under 30 elements) get 100% coverage. Complex pages scale up element count (100-150) rather than aggressively filtering. Never exclude form labels when inputs are included.
**Warning signs:** AI reports "element not found" or asks to scroll to elements that were filtered out, not scrolled past.

### Pitfall 3: Budget Calculation Doesn't Account for Variable-Length Content
**What goes wrong:** Budget calculations assume fixed per-element sizes but actual elements vary from 30 chars (simple button) to 500+ chars (complex form field with long label, placeholder, and description).
**Why it happens:** Allocating budget as "number of elements" instead of "character count" doesn't account for variance.
**How to avoid:** Track actual character usage as elements are serialized. The budget is in characters, not element count. Include elements until the character budget is exhausted.
**Warning signs:** Some prompts use only 30% of the budget while others exceed it, depending on element text lengths.

### Pitfall 4: buildMinimalUpdate Path Forgotten
**What goes wrong:** Budget-aware formatting is added to `buildPrompt()` but `buildMinimalUpdate()` still uses the old approach with hardcoded MAX_MINIMAL_ELEMENTS=25.
**Why it happens:** `buildMinimalUpdate` is a separate code path for multi-turn conversations (iterations 2+), and changes to `buildPrompt` don't automatically apply.
**How to avoid:** Both `buildPrompt` and `buildMinimalUpdate` must call the same budget-aware `formatElements()`. The `buildMinimalUpdate` path needs its own budget allocation for elements (it already has no hard cap, but should benefit from task-adaptive modes and dynamic element counts).
**Warning signs:** First iteration has rich context but subsequent iterations regress to sparse 25-element views.

### Pitfall 5: Truncated Memory/History Overflows into Element Budget
**What goes wrong:** When automation context (action history, stuck recovery, URL history) is large, it consumes the page context budget, leaving too few chars for elements.
**Why it happens:** Without section-level budgets, verbose automation context (especially stuck recovery with 5 failed actions, 10 URL history entries) grows unbounded.
**How to avoid:** Enforce budget partitioning. Each section gets its allocation. If a section exceeds its budget, truncate that section, never steal from others. The action history is already capped (MAX_ACTION_HISTORY=5, or 3 when stuck) but URL history and stuck recovery instructions are unbounded.
**Warning signs:** Prompts with long action histories show fewer elements than prompts with short histories, even for the same page.

## Code Examples

### Example 1: Budget-Aware formatElements (DOM-02 + DOM-03)
```javascript
// Source: Derived from existing formatElements (line 2069) with budget parameter
formatElements(elements, charBudget = Infinity, taskType = 'general') {
  if (!Array.isArray(elements)) {
    return 'No elements available';
  }

  // DOM-04: Dynamic compression based on page complexity
  const complexity = elements.length;
  const compressionLevel = complexity <= 30 ? 'none' : complexity <= 60 ? 'moderate' : 'heavy';

  // Task-adaptive priority ordering (DIF-03)
  const prioritized = this.prioritizeForTask(elements, taskType);

  const lines = [];
  let usedChars = 0;

  for (const el of prioritized) {
    // DOM-03: Adaptive text limits by element type
    const textLimit = this.getTextLimit(el, compressionLevel);
    const line = this.formatSingleElement(el, textLimit, compressionLevel, taskType);

    // DOM-02: Never cut mid-element -- include whole or exclude
    if (usedChars + line.length + 1 > charBudget) {
      break;
    }

    lines.push(line);
    usedChars += line.length + 1; // +1 for newline
  }

  if (lines.length < prioritized.length) {
    const remaining = prioritized.length - lines.length;
    lines.push(`... ${remaining} more elements (${remaining} excluded by budget)`);
  }

  return lines.join('\n');
}
```

### Example 2: Adaptive Text Limits (DOM-03)
```javascript
// Source: New function based on DOM-03 requirement
getTextLimit(element, compressionLevel) {
  // Base limits by element type
  const baseLimits = {
    // List items need full context: "First Last - Title at Company"
    listItem: 150,
    // Buttons and links need moderate context
    button: 80,
    a: 80,
    // Inputs need placeholder/label context
    input: 80,
    textarea: 100,
    select: 80,
    // Generic elements
    default: 100
  };

  // Detect if element is a list item
  const isListItem = element.type === 'li' ||
    element.type === 'a' && element.context?.parentContext?.tag === 'LI' ||
    element.relationshipContext?.includes('list');

  const baseLimit = isListItem ? baseLimits.listItem :
    (baseLimits[element.type] || baseLimits.default);

  // Compression multipliers
  const multipliers = { none: 1.0, moderate: 0.8, heavy: 0.5 };

  return Math.round(baseLimit * (multipliers[compressionLevel] || 1.0));
}
```

### Example 3: Task-Adaptive Element Prioritization (DIF-03)
```javascript
// Source: New function for DIF-03 requirement
prioritizeForTask(elements, taskType) {
  const scoredElements = elements.map(el => {
    let score = 0;
    const isInteractive = ['button', 'a', 'input', 'select', 'textarea'].includes(el.type);
    const isInViewport = el.position?.inViewport;

    // Base score: viewport + interactivity
    if (isInViewport) score += 10;
    if (isInteractive) score += 5;
    if (el.isNew) score += 8; // New elements are high priority

    // Task-specific boosts
    switch (taskType) {
      case 'form':
      case 'email':
        // Boost inputs, textareas, selects, labels, submit buttons
        if (['input', 'textarea', 'select'].includes(el.type)) score += 20;
        if (el.labelText || el.placeholder) score += 5;
        if (el.purpose?.intent === 'submit') score += 15;
        if (el.formId) score += 3;
        break;

      case 'extraction':
        // Boost text-heavy elements, headings, articles
        if (el.text && el.text.length > 50) score += 15;
        if (el.purpose?.role === 'heading') score += 10;
        if (el.relationshipContext?.includes('article')) score += 10;
        break;

      case 'search':
      case 'navigation':
        // Boost links and navigation elements
        if (el.type === 'a') score += 15;
        if (el.href) score += 10;
        if (el.relationshipContext?.includes('navigation')) score += 5;
        break;

      case 'shopping':
        // Boost product-related elements
        if (el.text?.match(/\$[\d.,]+/)) score += 10; // Price
        if (el.purpose?.intent === 'purchase') score += 20;
        if (el.type === 'button') score += 5;
        break;
    }

    return { element: el, score };
  });

  return scoredElements
    .sort((a, b) => b.score - a.score)
    .map(item => item.element);
}
```

### Example 4: Budget Allocation in buildPrompt (DOM-01)
```javascript
// Source: Modification of buildPrompt (line 1318)
// Replace current HARD_PROMPT_CAP approach with budget allocation

const HARD_PROMPT_CAP = 15000; // DOM-01: Raised from 5000

// Budget partitioning for user prompt
const taskAndStateChars = userPrompt.length; // Already built: task, URL, scroll, CAPTCHA
const remainingBudget = HARD_PROMPT_CAP - taskAndStateChars;

// Proportional allocation of remaining budget
const automationBudget = Math.floor(remainingBudget * 0.35); // Action history, stuck recovery
const elementBudget = Math.floor(remainingBudget * 0.45);    // Formatted elements
const htmlBudget = Math.floor(remainingBudget * 0.10);       // HTML context
const memoryBudget = Math.floor(remainingBudget * 0.10);     // Session memory

// Build automation context within budget
const automationContext = this.buildAutomationContext(context, automationBudget);
userPrompt += automationContext;

// Build elements within budget (DOM-02: whole-element, priority-aware)
const taskType = this.detectTaskType(task, context?.currentUrl);
const formattedElements = this.formatElements(elements, elementBudget, taskType);
userPrompt += `\n\n[PAGE_CONTENT]\nSTRUCTURED ELEMENTS:\n${formattedElements}\n[/PAGE_CONTENT]`;

// Build HTML context within budget
const htmlContextStr = this.formatHTMLContext(domState.htmlContext, htmlBudget);
userPrompt += `\n\nHTML CONTEXT:\n${htmlContextStr}`;
```

### Example 5: Dynamic Element Count in buildMinimalUpdate (DOM-04)
```javascript
// Source: Modification of buildMinimalUpdate (line 340)
// Replace fixed MAX_MINIMAL_ELEMENTS = 25 with dynamic calculation

const totalAvailable = availableElements.length;
let maxElements;

if (totalAvailable <= 30) {
  // Simple page: show everything
  maxElements = totalAvailable;
} else if (totalAvailable <= 60) {
  // Medium page: show 40-50
  maxElements = Math.min(totalAvailable, 50);
} else {
  // Complex page: scale up to 100-150 with compression
  maxElements = Math.min(totalAvailable, Math.max(50, Math.floor(totalAvailable * 0.5)));
  maxElements = Math.min(maxElements, 150); // Hard cap at 150
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Fixed 5000 char cap | Budget-partitioned 15000 cap | This phase | 3x more page context for AI |
| Fixed 50 char text truncation | Adaptive limits (80-150 by type) | This phase | AI can distinguish between similar list items |
| Fixed 25 elements in multi-turn | Dynamic 30-150 based on complexity | This phase | Simple pages show 100%, complex pages scale up |
| One-size-fits-all element format | Task-adaptive content modes | This phase | Form tasks see inputs/labels, extraction sees text |

**Deprecated/outdated:**
- `HARD_PROMPT_CAP = 5000`: Being raised to 15000 in this phase (DOM-01)
- `MAX_MINIMAL_ELEMENTS = 25`: Being replaced with dynamic calculation (DOM-04)
- Fixed `substring(0, 150)` text limit: Being replaced with `getTextLimit()` adaptive function (DOM-03)

## Key Implementation Details

### User Prompt Section Ordering (Current)
The user prompt is built in this order within `buildPrompt()`:
1. Task description + decomposition (~200-500 chars)
2. Verification requirement (~300 chars)
3. Current page state: URL, title, scroll, CAPTCHA (~200 chars)
4. Semantic context via `formatSemanticContext()` (~500-2000 chars)
5. Automation context: stuck, DOM changed, action history, URL history (~500-3000 chars)
6. Page elements via `formatElements()` (~3000-8000 chars uncapped)
7. HTML context via `formatHTMLContext()` (~1000-5000 chars uncapped)
8. Closing "What actions should I take?" line

With the 5000 cap, items 1-5 consume ~1500-5500 chars, leaving 0-3500 for elements and HTML context. The truncation at 5000 chars typically cuts mid-way through the element list.

### Critical Constraint: Element Format Stability
The AI parses element lines to extract:
- Element IDs: `[button_submit_order]`
- Selectors: `selector: "css-selector-here"`
- Text content: `"Click me"`
- State flags: `[disabled]`, `[off-screen]`

The format of `selector: "..."` is critical -- the AI uses this exact pattern to construct tool parameters. Any format change must preserve this pattern.

### Both Prompt Paths Must Be Modified
1. **buildPrompt()** (line 1318): First iteration and stuck recovery. Gets the full system prompt + user prompt with HARD_PROMPT_CAP.
2. **buildMinimalUpdate()** (line 340): Multi-turn iterations 2+. Currently uses MAX_MINIMAL_ELEMENTS=25 with no cap. Needs budget-aware element formatting and task-adaptive content modes.

### Memory Budget Consideration
The `buildMemoryContext()` function (line 787) produces session memory (structured facts + compacted summary + long-term memories). Currently this is only injected into trimmed conversation history (line 537), not directly into the user prompt on first iteration. The 10% memory budget in DOM-01 should reserve space for this content when it's available in conversation context.

## Open Questions

1. **Should content.js maxElements also increase?**
   - What we know: content.js filters to 50 elements before sending to background.js. The AI-side budget might be able to display more elements if content.js sent more.
   - What's unclear: Whether increasing content.js maxElements would cause performance issues or message size issues.
   - Recommendation: Keep content.js maxElements at 50 for now. The AI-side budget handles how much of those 50 elements to show. If the budget allows showing all 50 and the success criteria (criterion 4: "complex page 100+ elements") requires more, increase content.js maxElements in a follow-up. However, note that criterion 4 says the budget "scales up with heavier per-element compression" -- this may mean we should show more of the existing 50 elements with compression, not necessarily send more from content.js. Investigate during planning.

2. **Budget ratios optimal for typical pages**
   - What we know: The roadmap specifies "40% system, 50% page context, 10% memory" but the system prompt is sent separately. The 40% likely means "system/automation context within the user prompt."
   - What's unclear: Exact optimal ratios for the user-prompt-only budget.
   - Recommendation: Start with 35% automation context (action history, stuck recovery), 45% page elements, 10% HTML context, 10% memory. Verify with log analysis of real prompts. The ratio should be tunable.

3. **Interaction between HARD_PROMPT_CAP and multi-turn**
   - What we know: `buildMinimalUpdate` has no cap. `buildPrompt` has the cap. After raising to 15000, the first iteration sends ~15K chars of user prompt + ~11K system prompt = ~26K total (~7.4K tokens).
   - What's unclear: Whether this will increase API costs or latency noticeably.
   - Recommendation: 7.4K input tokens is well within Grok 4.1 Fast's 2M context. Cost impact: 15K additional chars = ~4.3K more tokens at $0.20/M = $0.0009/call. Negligible. Latency impact should also be minimal.

## Sources

### Primary (HIGH confidence)
- `ai/ai-integration.js` lines 1318-2032: `buildPrompt()` function (read and analyzed)
- `ai/ai-integration.js` lines 340-514: `buildMinimalUpdate()` function (read and analyzed)
- `ai/ai-integration.js` lines 2069-2126: `formatElements()` function (read and analyzed)
- `ai/ai-integration.js` lines 2172-2260: `formatHTMLContext()` function (read and analyzed)
- `ai/ai-integration.js` line 1898: `HARD_PROMPT_CAP = 5000` (confirmed)
- `ai/ai-integration.js` line 413: `MAX_MINIMAL_ELEMENTS = 25` (confirmed)
- `ai/ai-integration.js` lines 3006-3083: `detectTaskType()` function (read and analyzed)
- `content.js` lines 10580-10951: `getStructuredDOM()` function (read and analyzed)
- `content.js` lines 10283-10312: `inferPageIntent()` function (read and analyzed)
- `.planning/ROADMAP.md`: Phase 2 requirements and pitfall mitigations (read)
- `.planning/REQUIREMENTS.md`: DOM-01 through DOM-04, DIF-03 specifications (read)

### Secondary (MEDIUM confidence)
- System prompt character count (~11,260 chars): Measured via line count extraction
- Per-element character cost (~100 chars average): Estimated from `formatElements()` output structure

### Tertiary (LOW confidence)
- None. All findings are based on direct code analysis.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All changes modify existing vanilla JS functions, no new dependencies
- Architecture: HIGH - Full data flow traced through codebase, both prompt paths analyzed
- Pitfalls: HIGH - Based on direct observation of current truncation behavior and code structure
- Budget ratios: MEDIUM - Roadmap specifies 40/50/10 but interpretation of "system" vs "automation context" requires validation during implementation

**Research date:** 2026-02-14
**Valid until:** Indefinite (all findings from direct code analysis, no external dependencies)
