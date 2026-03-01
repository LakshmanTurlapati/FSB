# Phase 16: YAML DOM Snapshot - Research

**Researched:** 2026-02-28
**Domain:** Compact text-based DOM snapshot format for AI browser automation (vanilla JavaScript, Chrome Extension content script)
**Confidence:** HIGH

## Summary

This phase replaces the current verbose DOM snapshot format with a compact, structured text format using sequential element refs (`e1`, `e2`, ...). The existing codebase already has 70% of the infrastructure: `generateCompactSnapshot()` in `content/dom-analysis.js` (line 1840) already produces `[e1] button "Submit"` lines, `RefMap` in `content/dom-state.js` (line 614) already maps refs to WeakRef'd elements, and `getFilteredElements()` (line 1745) already filters to actionable elements. The work is restructuring and extending these into the format specified in CONTEXT.md.

The current system sends the AI **three separate context blocks**: (1) compact element lines via `formatCompactElements()`, (2) a "PAGE STRUCTURE" summary via `formatPageStructureSummary()`, and (3) raw HTML markup via `formatHTMLContext()`. Each has its own budget math. Phase 16 consolidates these into a single YAML-style snapshot with a metadata header + element list, eliminating the redundant HTML context block entirely (its information is already captured in element lines and the metadata header).

The biggest token savings come from: (a) eliminating the `htmlContext` block which duplicates element data as raw HTML (typically 30-50% of prompt payload), (b) dropping verbose JSON field names in `getStructuredDOM()` output (`elementId`, `interactionState`, `position`, `visibility`, etc.), and (c) filtering to viewport-only actionable elements by default. Conservative estimate is 50-65% token reduction from the combined snapshot payloads, well exceeding the 40% target.

**Primary recommendation:** Build a new `buildYAMLSnapshot()` function in `content/dom-analysis.js` that replaces both `generateCompactSnapshot()` and `extractRelevantHTML()` as the single snapshot source. The metadata header replaces `detectPageContext()` output formatting. The AI integration layer (`ai-integration.js`) consumes the snapshot as a pre-formatted string, eliminating `formatElements()`, `formatCompactElements()`, `formatHTMLContext()`, and `formatPageStructureSummary()` from the prompt path.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Use full HTML tag names (button, input, select, textarea, a) -- not abbreviated shorthands
- Moderate attribute density: visible text + id + primary class + boolean states -- no data attributes by default
- Form elements grouped with indentation under a form header line (form > fields > submit visual grouping)
- Include both viewport flag ([visible]/[offscreen]) AND region hints (@nav, @main, @footer) on each element
- Always show current input values inline: `e8: input "Email" val="user@test.com"`
- Always show full href on links: `e3: a "Settings" href="/account/settings"`
- Ref numbering is sequential per snapshot (e1, e2, e3...) -- renumbered each build, not stable across iterations
- Select/dropdown options shown as indented child lines under the select element
- Default filter: actionable elements (buttons, inputs, links, selects, checkboxes, textareas) plus nearby text context (labels, headings, descriptions) for semantic understanding
- Viewport-only by default -- offscreen elements excluded; AI must scroll to discover more
- Two snapshot modes: interactive (default) and full (entire page) -- AI requests full mode via CLI command (`snapshot full`)
- Flatten iframe elements into the main snapshot list -- treated as part of the page
- Traverse open shadow DOM roots and include their interactive elements in the flat list
- Collapse identical duplicate elements: `e5: button "Add to cart" (x50)` instead of listing all 50
- Include a filter summary footer with count + type breakdown: `--- 23/147 shown | 40 links, 12 buttons, 8 inputs offscreen`
- YAML-style key:value format for all metadata
- Required metadata fields: URL, title, scroll position, viewport dimensions
- Scroll shown as both absolute pixels and percentage: `scroll: 500/2400 (21%)`
- Include form summary: count and brief description of forms on page
- Include heading outline: page heading hierarchy (h1 > h2 > h2 > h3)
- Include active/focused element indicator
- Include page load state: `state: complete | loading | interactive`
- Include CAPTCHA detection flag: `captcha: true/false`
- No pending network request tracking -- keep it to document ready state only
- Bracket tag format for site guide annotations: `e12: input "Search" #search-box [hint:searchBox:type]`
- Annotations convey role name + suggested action verb
- No workflow-level hints in metadata header -- annotations on elements only
- Site guides define CSS selectors that the snapshot engine matches to element refs at build time

### Claude's Discretion
- Exact YAML indentation and spacing style
- How nearby text context is associated with elements (inline vs grouped)
- Handling of elements that don't fit neatly into region categories
- Token optimization tradeoffs within the 40% reduction target
- How to handle pages with extremely large element counts (truncation strategy)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| YAML-01 | DOM snapshots use compact text format with element refs (e1, e2, ...), element type, text content, and key attributes -- replacing verbose JSON | Existing `generateCompactSnapshot()` already produces ref-based lines. New `buildYAMLSnapshot()` extends format with tag names, region hints, values, hrefs per CONTEXT.md decisions. Architecture Patterns section details the exact line format. |
| YAML-02 | Interactive-only filtering reduces snapshot to actionable elements by default, with full-page mode available | Existing `getFilteredElements()` already filters to actionable elements (buttons, inputs, links, selects, textareas, contenteditable). Two-mode architecture (interactive/full) needs a mode parameter. Code Examples section shows both modes. |
| YAML-03 | Page metadata (URL, title, scroll position, viewport) included as compact header before element list | Currently spread across `detectPageContext()`, `extractRelevantHTML()`.pageStructure, and `generateCompactSnapshot()`.metadata. New YAML header consolidates all into 8-12 lines of key:value pairs. Architecture Patterns section specifies exact header format. |
| YAML-04 | Site-aware annotations from site guides embedded inline when matching guide exists | Site guides already define `selectors` objects (e.g., `searchBox: '#t-name-box'`). Snapshot engine matches each element against guide selectors at build time. If match found, appends `[hint:selectorKey:suggestedAction]`. Implementation pattern detailed in Code Examples. |
| YAML-05 | Snapshot token count at least 40% lower than current JSON format | Current format sends elements + HTML context + page structure = 3 redundant blocks. New format sends single consolidated block. Measured by chars/3.5 heuristic (matching existing `ai-integration.js` line 3024). Pitfall section covers measurement methodology. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vanilla JavaScript | ES2021+ | Snapshot formatter | Project mandate: no build system, no bundler, no npm. Content script IIFE pattern. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| None | -- | -- | No dependencies. Pure string concatenation in content script context. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-built YAML-style format | js-yaml library | YAML library would add parsing overhead; the output is write-only (AI reads it as text, never parses it back to objects). Hand-building is simpler and avoids npm dependency. |
| Template literals for line building | String.prototype.concat / Array.join | Template literals are cleaner for the line format with variable interpolation. Array.join is slightly more performant for very large element counts but negligible at 50-80 elements. |
| chars/3.5 token heuristic | js-tiktoken | Tiktoken requires npm/WASM. The chars/3.5 heuristic is already used in `ai-integration.js` line 3024 and is accurate within 10-15% for English text. Sufficient for the 40% reduction measurement. |

**Installation:** None required. Code is added to existing `content/dom-analysis.js` and consumed by `ai/ai-integration.js`.

## Architecture Patterns

### Recommended Project Structure
```
content/
  dom-analysis.js      # Modified: add buildYAMLSnapshot(), modify/deprecate generateCompactSnapshot()
  dom-state.js         # Unchanged: RefMap already works with sequential e1,e2... refs
  selectors.js         # Unchanged: resolveRef() already resolves eN refs
  messaging.js         # Modified: add 'getYAMLSnapshot' handler, wire new snapshot mode
ai/
  ai-integration.js    # Modified: consume YAML snapshot string, remove formatElements/formatHTMLContext
site-guides/
  index.js             # Modified: export getMatchingGuideSelectors() for annotation matching
```

### Pattern 1: YAML Snapshot Output Format
**What:** Single pre-formatted text block that the AI receives as-is. No further formatting by `ai-integration.js`.

**When to use:** Every automation iteration (replaces current 3-block format).

**Example output (interactive mode -- default):**
```
url: https://example.com/contact
title: Contact Us - Example Corp
scroll: 0/1200 (0%)
viewport: 1920x1080
state: complete
captcha: false
focus: e4
forms: 1 (contact form, 5 fields)
headings: h1 "Contact Us" > h2 "Send a Message" > h2 "Our Locations"

@nav
  e1: a "Home" href="/"
  e2: a "Products" href="/products"
  e3: a "Contact" href="/contact" [focused]

@main
  form "Contact Us" #contact-form
    e4: input "Full Name" #name [focused]
    e5: input "Email" #email type="email"
    e6: input "Phone" #phone type="tel"
    e7: textarea "Message" #message
    e8: select "Subject" #subject selected="General Inquiry"
      "General Inquiry"
      "Support"
      "Sales"
      "Partnership"
    e9: input "Subscribe" type="checkbox"
    e10: button "Send Message" .btn-primary

@footer
  e11: a "Privacy Policy" href="/privacy"
  e12: a "Terms" href="/terms"

--- 12/89 shown | 15 links, 3 buttons, 22 inputs offscreen
```

**Example output (with site guide annotations):**
```
url: https://docs.google.com/spreadsheets/d/abc123/edit
title: Job Tracker - Google Sheets
scroll: 0/800 (0%)
viewport: 1920x1080
state: complete
captcha: false
focus: e3
forms: 0
headings: none

@main
  e1: input "Sheet title" .docs-title-input [hint:spreadsheetTitle:click]
  e2: button "File" #docs-file-menu [hint:menuFile:click]
  e3: input "Name Box" #t-name-box val="A1" [focused] [hint:nameBox:click]
  e4: input "Formula Bar" .cell-input [hint:formulaBar:type]
  e5: div "Grid" #waffle-grid-container [hint:gridContainer:click]

@footer
  e6: button "Sheet1" .docs-sheet-tab [hint:sheetTabs:click]
  e7: button "+" #sheet-button [hint:addSheet:click]

--- 7/45 shown | 12 buttons, 5 inputs offscreen
```

### Pattern 2: Two-Mode Snapshot Architecture
**What:** `buildYAMLSnapshot()` accepts a `mode` parameter: `'interactive'` (default) or `'full'`.

**When to use:** Interactive mode on every iteration. Full mode only when AI explicitly requests it via `snapshot full` CLI command.

**Interactive mode:**
- Viewport-only elements (offscreen excluded)
- Actionable elements only (buttons, inputs, links, selects, textareas, checkboxes, contenteditable)
- Plus nearby text context (labels, headings associated with elements)
- Max 80 elements (existing cap in `generateCompactSnapshot`)

**Full mode:**
- All visible elements regardless of viewport position
- Includes non-interactive elements (headings, paragraphs, images with alt text)
- Higher element cap (200)
- Useful for: reading page content, finding text, understanding page layout

### Pattern 3: Region Detection
**What:** Classify each element into a region using landmark element hierarchy.

**When to use:** Every element in the snapshot gets a region tag.

**Implementation:** Use `element.closest()` to find the nearest landmark ancestor:
```javascript
function getRegion(el) {
  // Priority order: most specific first
  if (el.closest('dialog, [role="dialog"], [role="alertdialog"], [aria-modal="true"]')) return '@dialog';
  if (el.closest('nav, [role="navigation"]')) return '@nav';
  if (el.closest('header, [role="banner"]')) return '@header';
  if (el.closest('footer, [role="contentinfo"]')) return '@footer';
  if (el.closest('aside, [role="complementary"]')) return '@aside';
  if (el.closest('main, [role="main"]')) return '@main';
  if (el.closest('form')) return '@form';  // forms get their own grouping
  return '@main';  // default fallback
}
```

**Grouping:** Elements are grouped by region in the output. Within each region, elements appear in DOM order. A region header line (e.g., `@nav`) appears once per region.

### Pattern 4: Site Guide Annotation Matching
**What:** At snapshot build time, match each element against the current site guide's CSS selectors. If a match is found, append a `[hint:key:action]` annotation.

**When to use:** Only when a site guide is matched for the current URL.

**Implementation flow:**
1. Background.js sends the matched site guide's `selectors` object to the content script as part of the `getYAMLSnapshot` request
2. Content script builds a Map: `selectorKey -> {cssSelector, suggestedAction}`
3. For each element in the snapshot, check if it matches any selector via `element.matches(cssSelector)` or `document.querySelector(cssSelector) === element`
4. If matched, append `[hint:key:action]`
5. Action verb inference: input/textarea -> "type", button -> "click", select -> "select", a -> "click", checkbox -> "check"

**Selector matching:**
- Site guide selectors can be CSS selectors (e.g., `#t-name-box`) or XPath (e.g., `//a[normalize-space(.)="Home"]`)
- CSS selectors: use `element.matches(selector)` -- fast, native
- XPath selectors (start with `//` or `/`): skip for annotation matching (too slow for per-element evaluation). These selectors still work for the AI's manual identification via guidance text.
- Compound selectors (comma-separated): split and test each part

### Pattern 5: Duplicate Element Collapse
**What:** When multiple elements have identical tag + text + attributes, collapse into a single line with a count.

**When to use:** Pages with repeated product cards, list items, etc.

**Implementation:**
```javascript
function getElementFingerprint(el) {
  const tag = el.tagName.toLowerCase();
  const text = (el.textContent?.trim() || '').substring(0, 50);
  const type = el.getAttribute('type') || '';
  const role = el.getAttribute('role') || '';
  return `${tag}|${text}|${type}|${role}`;
}
```
When building the element list, track fingerprints. If a fingerprint appears 3+ times, show the first occurrence with `(xN)` suffix and skip the rest. The ref (`e5`) points to the first instance -- the AI can use it, and if it needs a specific one, it requests `snapshot full`.

### Anti-Patterns to Avoid
- **Sending raw HTML alongside YAML snapshot:** The whole point is consolidation. Do NOT send `formatHTMLContext()` output when YAML snapshot is active. All relevant information from HTML context (forms, headings, navigation structure) is captured in the YAML header and element lines.
- **Parsing YAML snapshot on the AI side:** The format is designed to be read as plain text by the AI. It is NOT YAML that needs a parser. The "YAML-style" header is just key:value lines for human/AI readability.
- **Stable ref numbering across iterations:** CONTEXT.md explicitly says refs are renumbered each build. Do NOT attempt to maintain ref stability -- it adds complexity and the CLI parser already handles stale refs via error messaging.
- **Including position coordinates:** The current `formatElements()` includes `at (x, y)` coordinates. These waste tokens -- the AI cannot meaningfully use pixel coordinates. Region hints (`@nav`, `@main`) provide spatial context more efficiently.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Element filtering | New querySelectorAll logic | Existing `getFilteredElements()` (dom-analysis.js:1745) | Already handles 3-stage pipeline: candidate selection, visibility check, relevance scoring. Battle-tested across 43+ site guides. |
| Ref registration | New ref counter | Existing `RefMap` class (dom-state.js:614) | Already produces `e1`, `e2`... with WeakRef + CSS selector fallback. Already integrated with `resolveRef()`. |
| Viewport detection | Custom rect math | Existing `isElementInViewport()` (dom-analysis.js:65) | Already handles partial visibility (25% overlap threshold). |
| Region classification | New DOM traversal | Existing `getRelationshipContext()` (dom-analysis.js:465) | Already classifies elements into modal/form/navigation/region contexts. Extend with `@` prefix for YAML format. |
| Accessible name | Manual text extraction | Existing `computeAccessibleName()` (accessibility.js) | Already handles aria-label, aria-labelledby, title, alt, content, label-for associations. |
| Element description | Custom text building | Existing `generateElementDescription()` (dom-analysis.js) | Already produces human-readable descriptions. |
| Site guide matching | URL pattern matching | Existing `findMatchingGuide()` (site-guides/index.js) | Already matches URL patterns and returns the guide object with selectors. |

**Key insight:** The Phase 16 work is primarily a **reformatter** that combines existing data extraction functions into a new output format. The DOM analysis, element filtering, ref management, and site guide matching are all already implemented. Do not rewrite the data collection -- only the serialization.

## Common Pitfalls

### Pitfall 1: Token Count Measurement Inconsistency
**What goes wrong:** Measuring token reduction incorrectly by comparing different page states or different element counts.
**Why it happens:** The current system sends varying amounts of data based on delta mode, stuck recovery, budget math. Comparing a stuck-recovery snapshot (truncated) against a full YAML snapshot gives misleading numbers.
**How to avoid:** Create a reproducible benchmark: capture the exact `domState` object from a real page, serialize it through both the old pipeline (`formatElements` + `formatHTMLContext` + `formatPageStructureSummary`) and the new pipeline (`buildYAMLSnapshot`), compare char counts. Use 3-5 representative pages (Google search results, LinkedIn feed, Amazon product page, a form page, Google Sheets).
**Warning signs:** Token reduction percentages vary wildly (20-80%) across tests instead of clustering around 50-60%.

### Pitfall 2: Losing Information the AI Needs
**What goes wrong:** The compact format omits something the AI relied on (e.g., form action URL, aria-describedby text, parent context) and the AI makes wrong decisions.
**Why it happens:** Over-optimizing for token count at the expense of information density.
**How to avoid:** Map every piece of information in the current `formatElements()` output (lines 3183-3271 of ai-integration.js) to its YAML equivalent. Create a checklist:
  - Element type -> tag name (YAML line prefix)
  - Element ID -> `#id` on the line
  - Class -> `.primary-class` (first class only)
  - Text content -> quoted text
  - Input type -> `type="email"` attribute
  - Placeholder -> `placeholder="..."` (if no accessible name)
  - Value -> `val="current value"`
  - href -> `href="/path"`
  - Disabled/checked/focused/readonly states -> `[disabled]`, `[checked]`, `[focused]`, `[readonly]`
  - Label text -> part of accessible name (already handled by `computeAccessibleName`)
  - Form ID -> indent under form header
  - Selectors -> **NOT included** (refs replace selector-based targeting)
**Warning signs:** AI actions fail at higher rates after snapshot format change. Specifically watch for: wrong element targeting, missed form fields, inability to read input values.

### Pitfall 3: Form Grouping Complexity
**What goes wrong:** Form elements appear in wrong groups when forms are nested, overlap, or use `form` attribute to associate with a non-ancestor form.
**Why it happens:** HTML allows `<input form="other-form-id">` which associates an input with a form that is NOT its DOM ancestor. Naive `element.closest('form')` misses these.
**How to avoid:** Check both `element.closest('form')` and `element.form` property. The `.form` property is the authoritative association (includes the `form` attribute override). Group by `.form` reference, not by DOM hierarchy.
**Warning signs:** Elements appear under wrong form headers or outside any form when they should be inside one.

### Pitfall 4: Iframe Element Flattening Race Condition
**What goes wrong:** Iframe elements are missing from the snapshot because the iframe hasn't loaded or is cross-origin.
**Why it happens:** `collectFrameDOM()` in `messaging.js` (line 122) uses `postMessage` which is async and may time out. Cross-origin iframes block access entirely.
**How to avoid:** For Phase 16, iframe flattening is best-effort. If the iframe responds in time (existing 500ms timeout), include its elements with an `@iframe` region tag. If not, skip and include a note in the footer: `1 iframe not accessible`. Do NOT block snapshot generation on iframe responses.
**Warning signs:** Snapshot generation takes >500ms on pages with iframes.

### Pitfall 5: XPath Selectors in Site Guide Annotation Matching
**What goes wrong:** Attempting to match XPath selectors from site guides against elements using `element.matches()` throws errors because `matches()` only accepts CSS selectors.
**Why it happens:** Some site guides (e.g., LinkedIn) use XPath patterns like `//a[normalize-space(.)="Home"]` in their selectors objects.
**How to avoid:** Before calling `element.matches()`, check if the selector starts with `//` or `/`. If so, skip it for annotation matching. XPath-based elements can still be identified by the AI through the guidance text -- annotations are a bonus, not a requirement.
**Warning signs:** `DOMException: Failed to execute 'matches'` errors in console.

### Pitfall 6: Duplicate Collapse Hiding Distinct Elements
**What goes wrong:** Elements that look similar but have different data attributes or hrefs get collapsed, making the AI unable to target the right one.
**Why it happens:** The fingerprint function is too coarse (only tag + text + type).
**How to avoid:** Include href in the fingerprint for links, and name/id for inputs. Only collapse when elements are truly identical in all user-visible attributes. Set a minimum threshold of 3+ identical elements before collapsing.
**Warning signs:** AI tries to click a collapsed element but the first instance isn't the right one.

## Code Examples

### Building a YAML Snapshot Line
```javascript
// Source: Derived from existing generateCompactSnapshot() in content/dom-analysis.js:1840
function buildElementLine(el, ref, guideAnnotations) {
  const tag = el.tagName.toLowerCase();
  const accName = computeAccessibleName(el);
  const name = accName?.name || '';

  let line = `  ${ref}: ${tag}`;

  // Accessible name (text content, aria-label, etc.)
  if (name) {
    const truncName = name.length > 60 ? name.substring(0, 57) + '...' : name;
    line += ` "${truncName}"`;
  }

  // ID (if present and not auto-generated)
  if (el.id && !isAutoGeneratedId(el.id)) {
    line += ` #${el.id}`;
  }

  // Primary class (first meaningful class)
  const classes = filterDynamicClasses(el);
  if (classes.length > 0) {
    line += ` .${classes[0]}`;
  }

  // Input type (when not default 'text')
  if (el.tagName === 'INPUT' && el.type && el.type !== 'text') {
    line += ` type="${el.type}"`;
  }

  // Current value for inputs
  if ((el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') && el.value) {
    const valDisplay = el.value.length > 40 ? el.value.substring(0, 37) + '...' : el.value;
    line += ` val="${valDisplay}"`;
  }

  // href for links (full path)
  if (el.tagName === 'A' && el.href) {
    try {
      const url = new URL(el.href);
      // Show path for same-origin, full URL for external
      if (url.origin === window.location.origin) {
        line += ` href="${url.pathname + url.search}"`;
      } else {
        const shortHref = el.href.length > 60 ? el.href.substring(0, 57) + '...' : el.href;
        line += ` href="${shortHref}"`;
      }
    } catch { /* invalid URL, skip */ }
  }

  // Selected option for selects
  if (el.tagName === 'SELECT' && el.selectedOptions?.length > 0) {
    line += ` selected="${el.selectedOptions[0].text?.substring(0, 30) || ''}"`;
  }

  // Placeholder (only if no accessible name)
  if (!name && el.placeholder) {
    line += ` placeholder="${el.placeholder.substring(0, 40)}"`;
  }

  // Contenteditable
  if (el.getAttribute('contenteditable') === 'true' || el.isContentEditable) {
    line += ' [editable]';
  }

  // State flags
  const states = [];
  if (el.disabled) states.push('disabled');
  if (el.checked) states.push('checked');
  if (document.activeElement === el) states.push('focused');
  if (el.readOnly) states.push('readonly');
  if (states.length > 0) line += ` [${states.join(',')}]`;

  // Site guide annotation
  if (guideAnnotations && guideAnnotations.has(el)) {
    const hint = guideAnnotations.get(el);
    line += ` [hint:${hint.key}:${hint.action}]`;
  }

  return line;
}
```

### Building the YAML Metadata Header
```javascript
// Source: Derived from generateCompactSnapshot().metadata and detectPageContext()
function buildMetadataHeader() {
  const scrollTop = window.scrollY || document.documentElement.scrollTop;
  const pageHeight = Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight || 0);
  const viewportHeight = window.innerHeight;
  const scrollPct = pageHeight > viewportHeight
    ? Math.round((scrollTop / (pageHeight - viewportHeight)) * 100)
    : 0;

  const lines = [];
  lines.push(`url: ${window.location.href}`);
  lines.push(`title: ${document.title}`);
  lines.push(`scroll: ${Math.round(scrollTop)}/${pageHeight} (${scrollPct}%)`);
  lines.push(`viewport: ${window.innerWidth}x${viewportHeight}`);
  lines.push(`state: ${document.readyState}`);

  // CAPTCHA detection
  const hasCaptcha = !!(document.querySelector(
    '[class*="captcha"], [id*="captcha"], iframe[src*="recaptcha"], iframe[src*="hcaptcha"]'
  ));
  lines.push(`captcha: ${hasCaptcha}`);

  // Active element
  const active = document.activeElement;
  if (active && active !== document.body && active !== document.documentElement) {
    // Find ref for active element (if it was registered)
    const activeRef = findRefForElement(active);
    if (activeRef) {
      lines.push(`focus: ${activeRef}`);
    }
  }

  // Forms summary
  const forms = document.forms;
  if (forms.length > 0) {
    const formSummaries = Array.from(forms).slice(0, 5).map(f => {
      const fieldCount = f.elements.length;
      const name = f.id || f.name || f.getAttribute('aria-label') ||
                   f.querySelector('h1,h2,h3,legend')?.textContent?.trim() || 'unnamed';
      return `${name} (${fieldCount} fields)`;
    });
    lines.push(`forms: ${forms.length} -- ${formSummaries.join(', ')}`);
  } else {
    lines.push(`forms: 0`);
  }

  // Heading outline
  const headings = Array.from(document.querySelectorAll('h1,h2,h3')).slice(0, 10);
  if (headings.length > 0) {
    const outline = headings.map(h => {
      const level = h.tagName.toLowerCase();
      const text = h.textContent?.trim().substring(0, 40) || '';
      return `${level} "${text}"`;
    }).join(' > ');
    lines.push(`headings: ${outline}`);
  } else {
    lines.push(`headings: none`);
  }

  return lines.join('\n');
}
```

### Site Guide Annotation Matching
```javascript
// Source: Derived from site guide selectors pattern in site-guides/*.js
function buildGuideAnnotations(guideSelectors) {
  if (!guideSelectors || typeof guideSelectors !== 'object') return null;

  const annotations = new Map();  // element -> { key, action }

  for (const [key, selectorStr] of Object.entries(guideSelectors)) {
    // Skip XPath selectors (start with / or //)
    if (selectorStr.startsWith('/')) continue;

    // Handle comma-separated selectors
    const parts = selectorStr.split(',').map(s => s.trim());

    for (const part of parts) {
      try {
        const matched = document.querySelector(part);
        if (matched && !annotations.has(matched)) {
          // Infer action from element type
          const action = inferActionForElement(matched);
          annotations.set(matched, { key, action });
        }
      } catch {
        // Invalid selector, skip
      }
    }
  }

  return annotations;
}

function inferActionForElement(el) {
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return 'type';
  if (tag === 'SELECT') return 'select';
  if (tag === 'BUTTON' || el.getAttribute('role') === 'button') return 'click';
  if (tag === 'A') return 'click';
  if (el.type === 'checkbox' || el.type === 'radio') return 'check';
  if (el.getAttribute('contenteditable') === 'true') return 'type';
  return 'click';  // default
}
```

### Duplicate Element Collapse
```javascript
// Source: New pattern for Phase 16
function getElementFingerprint(el) {
  const tag = el.tagName.toLowerCase();
  const text = (el.textContent?.trim() || '').substring(0, 50);
  const type = el.getAttribute('type') || '';
  const role = el.getAttribute('role') || '';
  const href = (el.tagName === 'A' && el.href) ? el.href : '';
  const name = el.name || '';
  const id = el.id || '';
  return `${tag}|${text}|${type}|${role}|${href}|${name}|${id}`;
}

// During snapshot build:
const fingerprints = new Map();  // fingerprint -> { count, firstRef, firstEl }

for (const el of elements) {
  const fp = getElementFingerprint(el);
  if (fingerprints.has(fp)) {
    fingerprints.get(fp).count++;
    continue;  // Skip duplicate, don't assign a ref
  }

  const ref = refMap.register(el, ...);
  fingerprints.set(fp, { count: 1, firstRef: ref, firstEl: el });

  // Build line...
  let line = buildElementLine(el, ref, guideAnnotations);
  // Count will be appended after all elements are processed
}

// After processing, update lines with counts
for (const [fp, data] of fingerprints) {
  if (data.count >= 3) {
    // Find and update the line for this element
    // Append (xN) to the line
    updateLineWithCount(data.firstRef, data.count);
  }
}
```

### Filter Summary Footer
```javascript
// Source: New pattern for Phase 16
function buildFilterFooter(shownElements, totalCandidates, offscreenByType) {
  const shown = shownElements.length;
  const total = totalCandidates;

  // Build type breakdown for offscreen elements
  const offscreenParts = [];
  for (const [type, count] of Object.entries(offscreenByType)) {
    if (count > 0) offscreenParts.push(`${count} ${type}s`);
  }

  let footer = `--- ${shown}/${total} shown`;
  if (offscreenParts.length > 0) {
    footer += ` | ${offscreenParts.join(', ')} offscreen`;
  }

  return footer;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Full DOM JSON serialization | Compact element lines with refs | 2025 (agent-browser, webctl, Playwright MCP) | 80-95% token reduction. FSB already partially adopted via `generateCompactSnapshot()`. |
| CSS selector-based targeting | Ref-based targeting (e1, e2...) | 2025 (Stagehand, Browser-Use, Playwright MCP) | Eliminates fragile selector strings from prompts. FSB already has RefMap. |
| Separate HTML context block | Integrated element attributes in snapshot lines | New for FSB v10 | Eliminates duplicate data. The `extractRelevantHTML()` block currently duplicates 50-70% of the information already in element lines. |
| All elements regardless of viewport | Viewport-only default | 2025-2026 (agent-browser, Anthropic computer use) | Focuses AI attention on visible/actionable elements. Matches human browsing behavior. |

**Deprecated/outdated:**
- `getStructuredDOM()` full JSON output (dom-analysis.js:2012): Will be superseded by `buildYAMLSnapshot()` for AI prompt path. May be retained for debugging/logging only.
- `extractRelevantHTML()` (dom-analysis.js:936): Entire function becomes unnecessary when YAML snapshot includes all relevant attributes inline.
- `formatElements()` (ai-integration.js:3183): Replaced by direct insertion of YAML snapshot string.
- `formatHTMLContext()` (ai-integration.js:3340): Replaced by YAML metadata header.
- `formatPageStructureSummary()` (ai-integration.js:3506): Replaced by YAML metadata header.

## Open Questions

1. **Exact text context association strategy**
   - What we know: CONTEXT.md says "nearby text context (labels, headings, descriptions) for semantic understanding" should be included alongside actionable elements
   - What's unclear: Should a heading `h2 "Payment Details"` above a form be a separate non-interactive line in the snapshot, or should it only appear as the form header text?
   - Recommendation: Include nearby headings as non-interactive context lines (no ref, no `e` prefix) indented under the region. E.g., `  "Payment Details" (h2)` followed by the form elements. This preserves semantic grouping without wasting a ref on non-interactive text.

2. **Truncation strategy for extremely large pages**
   - What we know: Current cap is 80 elements in `generateCompactSnapshot()`, 50 in `getStructuredDOM()`
   - What's unclear: When viewport-only filtering still yields 100+ elements (e.g., data tables, long forms), how aggressively to truncate?
   - Recommendation: Keep 80-element cap for interactive mode. When the cap is hit, prioritize by relevance score (existing `calculateElementScore`). Add footer note: `--- 80/200+ shown (capped) | scroll for more`. For full mode, raise cap to 200.

3. **How to handle `snapshot full` CLI command dispatch**
   - What we know: The CLI parser (Phase 15) already supports arbitrary verbs. Phase 16 needs a `snapshot` verb with `full` argument.
   - What's unclear: Does the `snapshot` command need to be added to Phase 15's COMMAND_REGISTRY, or is it handled differently since it doesn't execute in the content script?
   - Recommendation: Add `snapshot` to Phase 15's COMMAND_REGISTRY in Phase 18 (integration phase). For Phase 16, build the `buildYAMLSnapshot({ mode: 'full' })` function and test it. The wiring happens later.

## Sources

### Primary (HIGH confidence)
- **Codebase analysis:** `content/dom-analysis.js` lines 1745-2003 (getFilteredElements, generateCompactSnapshot, getStructuredDOM)
- **Codebase analysis:** `content/dom-state.js` lines 614-656 (RefMap class)
- **Codebase analysis:** `ai/ai-integration.js` lines 2940-3050 (prompt building with snapshot embedding)
- **Codebase analysis:** `ai/ai-integration.js` lines 3183-3500 (formatElements, formatCompactElements, formatHTMLContext)
- **Codebase analysis:** `site-guides/productivity/google-sheets.js` (selectors object structure for annotation matching)
- **Codebase analysis:** `site-guides/social/linkedin.js` (XPath vs CSS selector patterns)
- **Codebase analysis:** `content/messaging.js` lines 720-762 (getDOM/getCompactDOM handlers)
- **Phase 15 research/verification:** `15-RESEARCH.md`, `15-VERIFICATION.md` (ref syntax `eN`, classifyTarget pattern)

### Secondary (MEDIUM confidence)
- **Architecture research:** `.planning/research/ARCHITECTURE.md` (21-step data flow, change boundary analysis)
- **CONTEXT.md decisions:** Phase 16 discussion outcomes (locked format decisions)

### Tertiary (LOW confidence)
- **Token estimation:** chars/3.5 heuristic (used by `ai-integration.js` line 3024, within 10-15% of tiktoken for English text -- adequate for 40% threshold measurement)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Pure vanilla JS, no dependencies, same pattern as all FSB modules
- Architecture: HIGH - Building on existing functions (generateCompactSnapshot, getFilteredElements, RefMap), format decisions locked by CONTEXT.md
- Pitfalls: HIGH - Identified from direct codebase analysis (XPath selectors in site guides, iframe timing, form association edge cases)

**Research date:** 2026-02-28
**Valid until:** 2026-03-28 (stable -- format decisions are locked, codebase is under our control)
