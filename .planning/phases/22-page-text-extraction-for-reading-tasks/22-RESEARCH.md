# Phase 22: Page Text Extraction for Reading Tasks - Research

**Researched:** 2026-03-06
**Domain:** DOM-to-Markdown conversion, page text extraction, browser automation snapshot format
**Confidence:** HIGH

## Summary

Phase 22 replaces the current YAML DOM snapshot format with a unified markdown representation where page text and interactive element refs are interwoven. The AI sees the page as a human reads it -- headings, paragraphs, lists, and tables flow naturally with clickable/typeable elements labeled inline using backtick notation. Additionally, a new `readpage` CLI command provides full untruncated page text for reading/summarization tasks.

The existing codebase provides strong foundations: `buildYAMLSnapshot()` in `content/dom-analysis.js` already implements region detection, element ref assignment, viewport filtering, fingerprint deduplication, and guide annotation matching. The new `buildMarkdownSnapshot()` function extends this by DOM-walking text nodes alongside interactive elements, producing markdown output instead of YAML element listings. The `readpage` command is a simpler variant -- full body text extraction with no element refs.

**Primary recommendation:** Build a DOM TreeWalker that walks the visible DOM tree, emitting markdown for text nodes (headings, paragraphs, lists, tables, links) and inline backtick element refs for interactive elements, organized under region-based heading hierarchy.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Snapshot Format: Unified Markdown** -- Single markdown document replacing YAML. Regions map to heading hierarchy. Interactive elements appear inline in backtick notation. Surrounding text flows naturally.
- **Element Ref Notation** -- Backtick-wrapped inline: `` `e5: button "Submit"` ``. Attributes as bracket flags. Site guide hints appended. Form values with equals. Checked/selected state.
- **Page Metadata** -- H1 page title, blockquote with URL/scroll/viewport. Not YAML frontmatter.
- **Content Formatting (Markdown-Lite)** -- Preserve headings, lists, links, tables, blockquotes, code blocks. Images as `[Image: alt text]`. Bold/italic preserved. Visible content only. Aggressive whitespace normalization. No deduplication.
- **Token Budget & Truncation** -- ~12K chars (~3K tokens). Hard truncation with scroll hint. Full snapshot every iteration. Increased element limit (from 50).
- **`readpage` CLI Command** -- Full untruncated page text, no element refs. Default viewport-only. `--full` for entire body. Returns inline same turn. Markdown-lite formatting. AI decides when to use.

### Claude's Discretion
- Exact element budget increase (from current 50)
- Whether `readpage` supports optional CSS selector argument
- HTML-to-markdown conversion approach (DOM walker vs regex vs library)
- How to handle edge cases: iframes, shadow DOM content, canvas-only pages (Google Sheets)
- Region detection heuristics (landmark roles, semantic HTML, fallback for non-semantic pages)

### Deferred Ideas (OUT OF SCOPE)
- Smart content extraction mode (Reader Mode heuristics for article detection)
- Progressive snapshot depth (full/focused/delta) for token reduction on continuation iterations (FUT-01)
- TOON-style tabular formatting for list data in snapshots (FUT-02)
</user_constraints>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vanilla JS DOM APIs | Browser native | TreeWalker, element traversal, text extraction | Project mandate: no external dependencies |
| `document.createTreeWalker()` | DOM Level 2+ | Efficient ordered DOM traversal for text + element interleaving | Standard API for walking DOM in document order |
| Existing FSB modules | Current | `dom-analysis.js`, `messaging.js`, `cli-parser.js`, `ai-integration.js` | Established patterns, ref system, region detection |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `computeAccessibleName()` | FSB built-in | Element name resolution | For inline element ref labels |
| `getRegion()` | FSB built-in | Landmark region classification | For markdown heading hierarchy |
| `getFilteredElements()` | FSB built-in | Interactive element filtering | For selecting which elements get refs |
| `refMap` | FSB built-in | Element ref registration | For e1, e2, e3 numbering |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| DOM TreeWalker | Turndown.js (HTML-to-MD library) | External dependency violates project mandate; TreeWalker gives precise control over element ref interleaving |
| DOM TreeWalker | innerHTML + regex | Fragile, can't interleave element refs at correct positions, misses computed visibility |
| Custom walker | Readability.js | Designed for article extraction, not general page snapshot; deferred to future `readpage --smart` |

## Architecture Patterns

### Recommended Approach: DOM TreeWalker with Markdown Emission

The core algorithm walks the visible DOM tree in document order. For each node:
1. **Text nodes** -- emit as markdown (with parent context for formatting: `<h1>` -> `# `, `<li>` -> `- `, etc.)
2. **Interactive elements** -- emit inline backtick ref notation: `` `e5: button "Submit"` ``
3. **Structural elements** -- emit markdown formatting (headings, list markers, table pipes, blockquote `>`)
4. **Hidden elements** -- skip (`display:none`, `visibility:hidden`, `aria-hidden="true"`, collapsed accordions)

### Project Structure (Changes Within Existing Files)
```
content/
  dom-analysis.js    # ADD: buildMarkdownSnapshot(), walkDOMToMarkdown(), text extraction helpers
  messaging.js       # MODIFY: add 'getMarkdownSnapshot' message handler, add 'readPage' handler
  actions.js         # ADD: readPage action handler
ai/
  cli-parser.js      # ADD: 'readpage' to COMMAND_REGISTRY
  ai-integration.js  # MODIFY: replace YAML/compact snapshot insertion with markdown snapshot
                     # MODIFY: add CLI_COMMAND_TABLE entry for readpage
                     # MODIFY: update system prompt references from YAML to markdown
```

### Pattern 1: TreeWalker with Visitor Pattern
**What:** Walk DOM tree, calling visitor functions per node type
**When to use:** Building the markdown snapshot
**Example:**
```javascript
function walkDOMToMarkdown(root, refMap, guideAnnotations, options) {
  const output = [];
  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        // Skip hidden elements
        if (node.nodeType === Node.ELEMENT_NODE) {
          if (!isVisible(node)) return NodeFilter.FILTER_REJECT; // skip subtree
          if (isFsbElement(node)) return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );

  let node;
  while ((node = walker.nextNode())) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent.trim();
      if (text) output.push(formatTextNode(node, text));
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      // If interactive, emit backtick ref
      if (isInteractive(node) && refMap.has(node)) {
        output.push(formatElementRef(node, refMap, guideAnnotations));
      } else {
        // Structural: emit markdown markers (heading prefix, list prefix, etc.)
        output.push(getMarkdownPrefix(node));
      }
    }
  }
  return output.join('');
}
```

### Pattern 2: Region-to-Heading Mapping
**What:** Map landmark regions to markdown heading levels
**When to use:** Generating section structure
**Example:**
```javascript
const REGION_HEADING_MAP = {
  '@dialog': '## Dialog',
  '@nav':    '## Navigation',
  '@header': '## Header',
  '@main':   '## Main Content',
  '@aside':  '## Sidebar',
  '@footer': '## Footer'
};
```

### Pattern 3: readpage as CLI Command + Content Action
**What:** New CLI command that triggers content script text extraction
**When to use:** AI needs full page text for reading/summarization
**Example:**
```javascript
// cli-parser.js COMMAND_REGISTRY addition
readpage: { tool: 'readPage', args: [{ name: 'selector', type: 'string', optional: true }] },

// actions.js handler
readPage: (params) => {
  const root = params.selector
    ? document.querySelector(params.selector)
    : document.body;
  const fullMode = params.flags?.full || false;
  const text = extractPageText(root, { viewportOnly: !fullMode });
  return { success: true, text, charCount: text.length };
}
```

### Anti-Patterns to Avoid
- **innerHTML parsing:** Never parse innerHTML to extract text. Use DOM traversal -- innerHTML loses computed visibility state and can't interleave element refs.
- **Separate text + element passes:** Don't extract text separately from elements. Walk once, emit both together, so refs appear in correct document-order position.
- **Over-filtering text:** Don't try to be "smart" about what text to include. The user decision says "no deduplication" and "visible content only" -- include everything visible, even if repetitive.
- **Building markdown from element list:** The current YAML snapshot lists elements only. The new format must walk ALL visible nodes, not just interactive ones.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Region detection | New region classifier | Existing `getRegion()` function | Already handles landmark roles, semantic HTML, with fallback to @main |
| Element ref numbering | New ref system | Existing `refMap.register()` | Established e1/e2/e3 system with WeakRef tracking |
| Interactive element filtering | New filter | Existing `getFilteredElements()` pipeline | 3-stage filter with scoring, viewport priority, contenteditable handling |
| Element fingerprinting | New dedup | Existing `getElementFingerprint()` | Handles href, name, id to avoid false collapses |
| Accessible name computation | Text heuristics | Existing `computeAccessibleName()` | ARIA spec compliant, handles label-for, aria-label, aria-labelledby |
| Site guide annotation matching | New matcher | Existing `buildGuideAnnotations()` | URL + CSS selector matching against 43+ site guide files |
| Visibility detection | New check | Existing Stage 2 filter from `getFilteredElements()` | Handles display:none, visibility:hidden, opacity:0, aria-hidden, zero-size |

**Key insight:** ~70% of the infrastructure already exists. The new work is the DOM walker that emits markdown format with interleaved text and element refs.

## Common Pitfalls

### Pitfall 1: Text Node Duplication from Nested Elements
**What goes wrong:** A `<button><span>Submit</span></button>` emits "Submit" twice -- once from the span text node, once from the button's accessible name in the ref.
**Why it happens:** TreeWalker visits both the button (interactive -> ref) and its child text node.
**How to avoid:** When emitting an element ref with its accessible name, skip the subtree's text nodes. Use `FILTER_REJECT` on the TreeWalker for interactive elements whose ref already captures the text.
**Warning signs:** Repeated words adjacent to backtick refs in output.

### Pitfall 2: Markdown Table Formatting Complexity
**What goes wrong:** HTML tables with colspan, rowspan, nested tables, or missing cells produce broken markdown tables.
**Why it happens:** Markdown tables are strictly grid-aligned; HTML tables are flexible.
**How to avoid:** Normalize to simple pipe-delimited format. For complex tables (colspan/rowspan), fall back to plain text with indentation. Set a max column count (e.g., 8) and truncate wide tables.
**Warning signs:** Misaligned pipes, missing cells, extremely wide lines.

### Pitfall 3: Character Budget Overflow from Verbose Pages
**What goes wrong:** News articles, documentation pages, or email threads exceed 12K chars quickly, truncating important content.
**Why it happens:** Text-rich pages have far more content than element-only snapshots.
**How to avoid:** Implement streaming output with character counting. Stop emitting when approaching budget. Add truncation marker: `[...content continues below -- scroll down and observe]`.
**Warning signs:** Truncation happening before the main content area is reached.

### Pitfall 4: Whitespace Explosion
**What goes wrong:** Output has excessive blank lines, leading spaces, or trailing whitespace that wastes token budget.
**Why it happens:** HTML whitespace normalization differs from markdown. Multiple `<br>`, empty `<div>`, and whitespace-only text nodes all contribute.
**How to avoid:** Aggressive post-processing: collapse 3+ consecutive newlines to 2, trim each line, strip trailing whitespace. The user decision explicitly requires "aggressive whitespace normalization."
**Warning signs:** Large gaps in output, char count disproportionate to visible text.

### Pitfall 5: Loss of Element Ref Positions After Truncation
**What goes wrong:** Hard truncation at 12K chars cuts mid-element-ref, producing broken backtick notation.
**Why it happens:** Character-counting truncation doesn't respect markdown structure.
**How to avoid:** Truncate at line boundaries only. Track the last complete line that fits within budget.
**Warning signs:** Truncated backtick refs, unpaired formatting markers.

### Pitfall 6: Interaction Between readpage and Normal Iteration Flow
**What goes wrong:** `readpage` returns text but the normal iteration also sends a full snapshot, doubling the content in the conversation.
**Why it happens:** The automation loop sends a snapshot on every iteration. If `readpage` result is large, the next prompt balloons.
**How to avoid:** `readpage` returns inline as an action result (same turn). The snapshot on the next iteration is independent. The AI must understand these are separate: snapshot = navigation context, readpage = content extraction.
**Warning signs:** Token budget exceeded on iterations following readpage.

## Code Examples

### Markdown Snapshot Output Format (Target)
```markdown
# Amazon - Wireless Mouse Product Page
> URL: https://www.amazon.com/dp/B09HQ... | Scroll: 0% | Viewport: 1920x1080

## Header
`e1: a "Amazon" href="/"` | `e2: input "Search Amazon" [hint:searchBox]` | `e3: a "Cart (3)" href="/cart"`

## Main Content
### Logitech MX Master 3S - Wireless Performance Mouse
**$99.99** ~~$109.99~~ (9% off)

Rating: 4.7 out of 5 stars (12,847 ratings)

**Color:** Graphite
`e5: button "Graphite" [checked]` `e6: button "Pale Gray"` `e7: button "Rose"`

**Size:** Standard
`e8: select "Size" = "Standard"` Options: Standard, Mini

`e10: button "Add to Cart"` `e11: button "Buy Now"`

### About this item
- 8K DPI optical sensor for precise tracking
- USB-C quick charging -- 3 min charge = 3 hours use
- Compatible with macOS, Windows, Linux, iPadOS

[Image: Logitech MX Master 3S mouse from multiple angles]

## Sidebar
### Customers also viewed
- `e15: a "Logitech M720 Triathlon" href="/dp/B01M..."` -- $49.99
- `e16: a "Razer DeathAdder V3" href="/dp/B0C..."` -- $69.99

## Footer
`e20: a "Conditions of Use"` | `e21: a "Privacy Notice"` | `e22: a "Help"`

[...content continues below -- scroll down and observe]
```

### buildMarkdownSnapshot Function Signature
```javascript
// content/dom-analysis.js
function buildMarkdownSnapshot(options = {}) {
  const {
    guideSelectors = null,
    charBudget = 12000,
    maxElements = 80  // increased from 50
  } = options;

  // 1. Reset refMap
  // 2. Get interactive elements via getFilteredElements()
  // 3. Build guide annotations
  // 4. Walk DOM tree, emitting markdown + inline element refs
  // 5. Build metadata header (H1 + blockquote)
  // 6. Apply character budget truncation (line-boundary)
  // 7. Return { snapshot, refGeneration, elementCount }
}
```

### readPage Action Handler
```javascript
// content/actions.js
readPage: (params) => {
  const fullMode = params.flags?.full || false;
  const selectorArg = params.selector || null;
  const root = selectorArg ? document.querySelector(selectorArg) : null;

  const text = extractPageText(root || document.body, {
    viewportOnly: !fullMode,
    includeRefs: false,  // readpage = text only, no element refs
    format: 'markdown-lite'
  });

  if (!text || text.trim().length === 0) {
    return { success: true, text: '[No readable text content on page]', charCount: 0 };
  }
  return { success: true, text, charCount: text.length };
}
```

### DOM Walker Core Logic
```javascript
function walkDOMToMarkdown(root, interactiveSet, refMap, guideAnnotations) {
  const lines = [];
  let currentLine = '';
  let listDepth = 0;

  function visit(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent.replace(/\s+/g, ' ').trim();
      if (text) currentLine += text;
      return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return;

    // Skip hidden
    if (!isVisibleElement(node)) return;

    const tag = node.tagName.toLowerCase();

    // Interactive element -- emit ref inline
    if (interactiveSet.has(node)) {
      const ref = refMap.getRef(node);
      if (ref) {
        currentLine += ' ' + formatInlineRef(node, ref, guideAnnotations);
        return; // don't recurse into interactive element children
      }
    }

    // Block elements: flush current line, emit prefix
    if (isBlockElement(tag)) {
      flushLine();
      if (tag.match(/^h[1-6]$/)) {
        const level = parseInt(tag[1]) + 1; // offset by 1 since H1 = page title
        currentLine = '#'.repeat(Math.min(level, 6)) + ' ';
      } else if (tag === 'li') {
        const parent = node.parentElement?.tagName.toLowerCase();
        const prefix = parent === 'ol' ? `${getListIndex(node)}. ` : '- ';
        currentLine = '  '.repeat(listDepth) + prefix;
      } else if (tag === 'blockquote') {
        currentLine = '> ';
      }
    }

    // Inline formatting
    if (tag === 'strong' || tag === 'b') currentLine += '**';
    if (tag === 'em' || tag === 'i') currentLine += '*';
    if (tag === 'code') currentLine += '`';
    if (tag === 'img') {
      const alt = node.getAttribute('alt') || '';
      currentLine += `[Image: ${alt || 'no description'}]`;
      return;
    }

    // Recurse children
    if (tag === 'ul' || tag === 'ol') listDepth++;
    for (const child of node.childNodes) visit(child);
    if (tag === 'ul' || tag === 'ol') listDepth--;

    // Close inline formatting
    if (tag === 'code') currentLine += '`';
    if (tag === 'em' || tag === 'i') currentLine += '*';
    if (tag === 'strong' || tag === 'b') currentLine += '**';

    // Block close
    if (isBlockElement(tag)) flushLine();
  }

  function flushLine() {
    if (currentLine.trim()) {
      lines.push(currentLine.trimEnd());
    }
    currentLine = '';
  }

  visit(root);
  flushLine();
  return lines;
}
```

## Discretion Recommendations

### Element Budget: Increase to 80
**Recommendation:** Increase from 50 to 80 elements.
**Rationale:** The richer markdown format provides context that makes refs more discoverable. The existing `getFilteredElements()` already supports `maxElements: 80` (used in both `generateCompactSnapshot` and `buildYAMLSnapshot`). The 12K char budget can accommodate ~80 elements when interspersed with page text (each ref is ~30-50 chars, so 80 refs = ~3.2K chars, leaving ~8.8K for text and structure).
**Confidence:** HIGH -- the current code already uses 80 as the limit.

### readpage CSS Selector Argument: Yes, Implement It
**Recommendation:** Support optional CSS selector argument: `readpage ".article-content"`
**Rationale:** Minimal implementation cost (one querySelector call). High value for focused extraction tasks (article body, product description, specific section). Falls back to body when selector not found or not provided.
**Confidence:** HIGH -- trivial to implement.

### HTML-to-Markdown Conversion: Custom DOM Walker
**Recommendation:** Build a recursive DOM visitor (not TreeWalker API).
**Rationale:** TreeWalker is flat (no depth tracking), making nested list handling and block vs inline distinction harder. A recursive visitor naturally tracks nesting depth and parent context. The visitor pattern also makes it easy to skip entire subtrees of interactive elements (don't recurse into buttons/links when the ref already captures the accessible name).
**Confidence:** HIGH -- recursive visitor is simpler and more controllable for this use case.

### Edge Cases
- **iframes:** Skip entirely. Cross-origin iframes are inaccessible. Same-origin iframes are rare in automation targets. If needed, the content script in the iframe frame handles its own DOM independently.
- **Shadow DOM:** Use `FSB.querySelectorWithShadow()` pattern where possible. For snapshot walking, skip closed shadow roots (can't access). Open shadow roots can be walked by recursing into `element.shadowRoot`.
- **Canvas-only pages (Google Sheets):** Detect via existing `FSB.isCanvasBasedEditor()`. For canvas pages, fall back to minimal text extraction (toolbar labels, sheet tabs, named ranges) with a note: `[Canvas-based application -- limited text extraction. Use site-specific commands.]`

### Region Detection
**Recommendation:** Reuse existing `getRegion()` exactly as-is, mapping to heading levels.
**Rationale:** Already handles `<nav>`, `<header>`, `<main>`, `<aside>`, `<footer>`, `<dialog>` + ARIA role equivalents. Falls back to `@main`. For non-semantic pages (all `<div>`), everything lands in Main Content section, which is correct behavior.
**Confidence:** HIGH -- existing function is proven across all Phase 16-21 usage.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| JSON element list (~800 tokens) | YAML snapshot with regions (~400 tokens) | Phase 16 (2026-02) | 40%+ token reduction |
| YAML element-only snapshot | Unified markdown (text + elements) | Phase 22 (this) | AI sees page as human reads it |
| getText per-element extraction | readpage full-page text | Phase 22 (this) | One command for full content |
| 50 element limit | 80 element limit | Phase 22 (this) | More interactive elements visible |

**Deprecated/outdated:**
- `generateCompactSnapshot()`: Replaced by `buildMarkdownSnapshot()` (but keep for backward compat during transition)
- `buildYAMLSnapshot()`: Retired entirely after Phase 22
- `getYAMLSnapshot` message handler: Replaced by `getMarkdownSnapshot`
- YAML metadata header format (key: value lines): Replaced by H1 + blockquote

## Integration Points (Detailed)

### 1. content/dom-analysis.js (~200 new lines)
- ADD: `buildMarkdownSnapshot(options)` -- main entry point
- ADD: `walkDOMToMarkdown(root, interactiveSet, refMap, guideAnnotations)` -- DOM walker
- ADD: `extractPageText(root, options)` -- text-only extraction for readpage
- ADD: `formatInlineRef(el, ref, guideAnnotations)` -- backtick ref formatter
- ADD: `isVisibleElement(node)` -- visibility check for walker (reuse Stage 2 filter logic)
- ADD: `isBlockElement(tag)` -- block vs inline classification
- EXPORT: `FSB.buildMarkdownSnapshot`, `FSB.extractPageText`

### 2. content/messaging.js (~20 lines)
- ADD: `'getMarkdownSnapshot'` case in async message handler
- ADD: `'readPage'` case in async message handler (or route through executeAction)

### 3. content/actions.js (~20 lines)
- ADD: `readPage` action handler

### 4. ai/cli-parser.js (~3 lines)
- ADD: `readpage` entry in COMMAND_REGISTRY with optional selector arg and --full flag

### 5. ai/ai-integration.js (~50 lines)
- MODIFY: `buildIterationUpdate()` (~L860-935) -- replace `_compactSnapshot` insertion with markdown snapshot
- MODIFY: `buildInitialUserPrompt()` (~L3040-3070) -- use markdown snapshot instead of compact
- MODIFY: `CLI_COMMAND_TABLE` -- add `readpage` row in INFORMATION section
- MODIFY: System prompt text referencing "YAML snapshot" or "element list" to say "page snapshot"
- ADD: Handler for readpage action result (inline text return)

### 6. background.js (~10 lines)
- MODIFY: DOM fetch to request markdown snapshot instead of compact snapshot
- OR: Route `readpage` action through existing executeAction message path

## Open Questions

1. **How to handle readpage result delivery**
   - What we know: Result returns inline as action result (same turn), not in next snapshot
   - What's unclear: Whether the result goes through the standard action result path or needs a special channel (readpage could return 50K+ chars for --full mode)
   - Recommendation: Use standard action result path with a char limit (e.g., 30K chars for readpage, truncated with `[...text truncated at 30K chars]`). The action result goes into conversation history like any other action result.

2. **Transition strategy: keep both formats temporarily?**
   - What we know: The YAML snapshot is used in the token comparator test harness (19-01/19-02)
   - What's unclear: Whether to keep buildYAMLSnapshot for backward compat or clean-remove
   - Recommendation: Keep `buildYAMLSnapshot` but don't export it. Remove the `getYAMLSnapshot` message handler. This avoids breaking test infrastructure while the markdown format is primary.

3. **How readpage --full interacts with very long pages**
   - What we know: `--full` dumps entire body text. Some pages (e.g., Terms of Service, long articles) could be 100K+ chars.
   - What's unclear: Max safe payload size through Chrome message passing
   - Recommendation: Cap at 50K chars with truncation notice. Chrome message passing handles up to ~64MB but conversation history bloat is the real concern.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Manual browser testing + existing CLI Validation golden test harness |
| Config file | Options page > Advanced > CLI Validation |
| Quick run command | Browser console: `FSB.buildMarkdownSnapshot()` |
| Full suite command | Options page CLI Validation (golden + live modes) |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| P22-01 | Markdown snapshot replaces YAML in AI prompts | integration | CLI Validation live test (any task type) | Existing harness |
| P22-02 | Element refs use backtick inline notation | unit | `FSB.buildMarkdownSnapshot()` in console, inspect output | Manual |
| P22-03 | Region heading hierarchy in output | unit | `FSB.buildMarkdownSnapshot()` on multi-region page | Manual |
| P22-04 | readpage command returns full page text | integration | Type `readpage` in automation, verify result | Manual |
| P22-05 | readpage --full returns entire body | integration | Type `readpage --full` in automation | Manual |
| P22-06 | 12K char budget with truncation | unit | `FSB.buildMarkdownSnapshot()` on long page, check length | Manual |
| P22-07 | Text content interwoven with element refs | visual | Compare snapshot output to page visual | Manual |

### Sampling Rate
- **Per task commit:** Console `FSB.buildMarkdownSnapshot()` on test pages
- **Per wave merge:** CLI Validation golden tests + live smoke test
- **Phase gate:** Manual verification on 5+ page types (article, form, dashboard, email, search results)

### Wave 0 Gaps
- [ ] Self-test function `_runMarkdownSnapshotSelfTest()` -- similar to existing `_runYAMLSnapshotSelfTest()`
- [ ] Test pages: verify on Amazon, Gmail, Google Search, Wikipedia, a form-heavy page

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection: `content/dom-analysis.js` (3150 lines) -- buildYAMLSnapshot, getRegion, getFilteredElements, buildElementLine
- Direct codebase inspection: `content/messaging.js` (1298 lines) -- getYAMLSnapshot handler, message routing
- Direct codebase inspection: `ai/ai-integration.js` (4713 lines) -- snapshot insertion, CLI_COMMAND_TABLE, prompt building
- Direct codebase inspection: `ai/cli-parser.js` (917 lines) -- COMMAND_REGISTRY structure
- Direct codebase inspection: `content/actions.js` (3753 lines) -- getText handler pattern

### Secondary (MEDIUM confidence)
- MDN Web Docs: document.createTreeWalker() API, NodeFilter constants
- MDN Web Docs: Node.SHOW_ELEMENT, Node.SHOW_TEXT filter constants

### Tertiary (LOW confidence)
- None -- all findings verified against codebase

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all vanilla JS, no new dependencies, verified against project mandate
- Architecture: HIGH - pattern extends existing buildYAMLSnapshot with well-understood DOM walking
- Pitfalls: HIGH - identified from direct code analysis and output format constraints
- Discretion recommendations: HIGH - based on existing code capabilities and minimal implementation cost

**Research date:** 2026-03-06
**Valid until:** 2026-04-06 (stable -- no external dependency versioning concerns)
