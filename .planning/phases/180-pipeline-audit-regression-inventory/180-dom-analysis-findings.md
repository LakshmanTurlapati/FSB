# DOM Analysis Subsystem Findings

## Summary

5 findings across 20+ functions audited. The DOM analysis subsystem has the smallest diff of all 4 subsystems (91 lines in dom-analysis.js, 14 in selectors.js), and all changes are additive improvements rather than regressions. The core DOM traversal, element filtering, selector generation, and snapshot format are structurally unchanged from v0.9.24. Three targeted enhancements were added: (1) granular payment field detection with autocomplete attribute support, (2) data-fsb-id attribute stamping for reliable element re-lookup, and (3) CDK overlay container scanning for Angular Material dropdown options. The caller contract between background.js/agent-loop.js and the content script DOM functions is intact.

Commit history: All changes came from a single commit (77de57b "fix(angular-material): 3 structural fixes for mat-select/CDK overlay interaction").

## Findings

### DA-01: Payment field detection expanded with autocomplete attribute awareness

- **File:** content/dom-analysis.js:271,275 (inferElementPurpose function)
- **Function:** inferElementPurpose()
- **Expected (v0.9.24):** Single broad regex `/card|credit|debit|payment|cvv|cvc|ccv|expir|billing/` matched all payment-related fields and returned `{ role: 'payment-input', intent: 'payment', sensitive: true }`.
- **Actual (current):** Expanded to 14 specific payment intent matchers using HTML5 `autocomplete` attribute values (cc-number, cc-csc, cc-exp-month, cc-exp-year, cc-exp, cc-name) plus refined regex patterns for billing address sub-fields (address-line1/2, city, region, country, postal-code). Falls back to the original broad regex for unrecognized payment fields.
- **Impact:** No regression. This is a correctness improvement. The AI now receives granular `intent` values (e.g., 'cc-number', 'cc-csc', 'billing-address-line1') instead of a generic 'payment' intent, enabling more precise form-filling. The `sensitive` flag is correctly set to `true` only for cc-number and cc-csc fields.
- **Proposed Fix:** None needed. The change is backwards-compatible -- callers that only check `role: 'payment-input'` still work. Callers that read `intent` get richer information.

### DA-02: data-fsb-id attribute stamped on DOM elements during snapshot

- **File:** content/dom-analysis.js:3065-3066 (getStructuredDOM, main element loop)
- **Function:** getStructuredDOM()
- **Expected (v0.9.24):** Elements were assigned semantic IDs (via generateSemanticElementId) but the ID was only stored in the snapshot data structure, not on the DOM element itself.
- **Actual (current):** Each processed element gets `node.setAttribute('data-fsb-id', semanticId)` stamped directly onto the DOM node. This creates a bridge between the snapshot's `elementId` and the live DOM.
- **Impact:** No regression. This is a new capability that enables the data-fsb-id selector fallback in selectors.js (DA-03). However, it modifies the page DOM, which could theoretically conflict with page scripts that react to attribute changes (MutationObserver watchers). The `try/catch` wrapper prevents errors from propagating.
- **Proposed Fix:** Monitor for sites where attribute stamping causes issues. Consider using a less common attribute name (e.g., `data-__fsb-id`) to reduce collision risk. The current implementation is acceptable.

### DA-03: data-fsb-id selector fallback added to selector resolution chain

- **File:** content/selectors.js:576-588 (querySelectorWithShadow function)
- **Function:** querySelectorWithShadow()
- **Expected (v0.9.24):** Selector resolution fallback chain: sanitize -> cache check -> XPath check -> shadow DOM pierce -> regular querySelector -> unicode-normalized aria-label fallback -> cache + return.
- **Actual (current):** New fallback added after aria-label: if the selector looks like an FSB semantic elementId (`/^[a-z][a-z0-9_-]+$/`), try `document.querySelector('[data-fsb-id="' + sanitized + '"]')`. This allows tools to resolve elements by their snapshot ID even if the original CSS selector has gone stale.
- **Impact:** No regression. This adds a new fallback tier to the selector chain. The regex guard ensures only FSB-style IDs trigger this path (no false positives on CSS selectors containing `#`, `.`, `[`, or `:` characters). The fallback is positioned after all standard selectors, so it never interferes with normal resolution.
- **Proposed Fix:** None needed. This is a well-guarded improvement that addresses a real problem: when DOM mutations cause CSS selectors to go stale, the data-fsb-id attribute provides a stable alternate lookup path.

### DA-04: CDK overlay container scanning for Angular Material components

- **File:** content/dom-analysis.js:3224-3264 (getStructuredDOM, after main element loop)
- **Function:** getStructuredDOM() (CDK overlay scan block)
- **Expected (v0.9.24):** Only elements in the main DOM tree were captured. Angular Material `mat-option` elements rendered in the `cdk-overlay-container` (appended to `<body>`, outside the component tree) were invisible to the snapshot.
- **Actual (current):** After the main element traversal, a new block scans `.cdk-overlay-container` for `mat-option`, `[role="option"]`, `[role="listbox"]`, `.mat-select-panel *`, and `.mat-autocomplete-panel *` elements. Found elements are added to `viewportElements` with `_fromOverlay: true` flag, and get the same `data-fsb-id` stamping and selector generation as regular elements.
- **Impact:** No regression. This is a targeted fix for Angular Material apps. Without it, `get_dom_snapshot` returned no options after a `mat-select` opened, making dropdown selection impossible via automation. The `_fromOverlay` flag allows callers to distinguish overlay elements if needed.
- **Proposed Fix:** None needed. The implementation is defensive (try/catch wrapped, skips zero-size elements). Consider extending the pattern for other framework overlay containers (e.g., React portals, Vue teleport) if similar issues arise.

### DA-05: autocomplete attribute added to captured attribute list

- **File:** content/dom-analysis.js:3174 (getStructuredDOM, attribute capture)
- **Function:** getStructuredDOM() (attribute capture block)
- **Expected (v0.9.24):** Default attribute capture list: `['data-testid', 'aria-label', 'name', 'role', 'type', 'value', 'placeholder', 'title', 'alt']` (9 attributes).
- **Actual (current):** `'autocomplete'` added as 10th captured attribute. This feeds the granular payment field detection in inferElementPurpose (DA-01).
- **Impact:** No regression. The snapshot now includes the `autocomplete` attribute for each element when present. This is a small increase in snapshot payload size (one additional key-value pair per element with an autocomplete attribute). The AI benefits from seeing autocomplete hints directly in the element data.
- **Proposed Fix:** None needed. Standard HTML5 attribute, commonly present on form fields.

## Snapshot Format Comparison

The DOM snapshot format is structurally identical between v0.9.24 and current. All existing fields are preserved. The only changes are additive:

### Fields Added (current only)

| Field | Location | Added By |
|-------|----------|----------|
| `attributes.autocomplete` | Per-element `attributes` object | DA-05 (only when element has autocomplete attr) |
| `_fromOverlay` | Per-element, overlay elements only | DA-04 (CDK overlay scan) |

### Fields Unchanged from v0.9.24

| Field | Location | Notes |
|-------|----------|-------|
| `elementId` | Per-element | Semantic ID generation unchanged |
| `type` | Per-element | Tag name lowercase |
| `description` | Per-element | generateElementDescription unchanged |
| `purpose` | Per-element | inferElementPurpose expanded (DA-01) but same field shape |
| `text` | Per-element | innerText/textContent extraction unchanged |
| `id`, `class` | Per-element | Direct property reads unchanged |
| `position` | Per-element | BoundingClientRect extraction unchanged |
| `attributes` | Per-element | Same shape, one new key (autocomplete) |
| `visibility` | Per-element | Computed style reads unchanged |
| `interactionState` | Per-element | disabled/readonly/checked/focused unchanged |
| `selectors` | Per-element | generateSelectors call unchanged |
| `cluster` | Per-element | getElementCluster unchanged |
| `context` | Per-element | labelText/formId/parentContext/hintText unchanged |
| `isNew` | Per-element | Element diffing logic unchanged |
| `scrollPosition` | Top-level | Unchanged |
| `scrollInfo` | Top-level | getScrollInfo unchanged |
| `viewport` | Top-level | window dimensions unchanged |
| `captchaPresent` | Top-level | CAPTCHA detection unchanged |
| `pageContext` | Top-level | detectPageContext unchanged |
| `_markdownSnapshot` | Top-level | buildMarkdownSnapshot unchanged |
| `_totalElements` | Top-level | Count tracking unchanged |

### Schema Verdict

No breaking changes. All v0.9.24 consumers can read the current snapshot without modification. The two new fields (`autocomplete` attribute, `_fromOverlay` flag) are additive and optional.

## Caller Contract Audit

### background.js -> content script (getDOM message)

**Contract:** background.js sends `{ action: 'getDOM', options: { useIncrementalDiff, maxElements, prioritizeViewport, includeCompactSnapshot } }` to content script tab. Content script calls `FSB.getStructuredDOM(domOptions)` and returns `{ success: true, structuredDOM: result }`.

**v0.9.24 status:** Unchanged. The message format, option names, and response shape are identical.

**Current status:** Intact. background.js (line 7714-7727) sends the same payload. content/messaging.js (line 735-751) handles it with the same call to `FSB.getStructuredDOM(domOptions)`. The response includes `structuredDOM` with `elements`, `_totalElements`, and other fields.

**Verdict:** OK -- no contract mismatch.

### agent-loop.js -> content script (get_page_snapshot tool)

**Contract:** agent-loop.js intercepts `get_page_snapshot` tool calls locally (line 1518). Sends `{ action: 'getMarkdownSnapshot', options: { charBudget: 12000, maxElements: 80 } }` to content script. Returns `{ snapshot, elementCount }` to the tool result.

**v0.9.24 status:** This was the intended contract. agent-loop.js was introduced in v0.9.24.

**Current status:** Intact. The tool interception, message format, and response handling are unchanged.

**Verdict:** OK -- no contract mismatch.

### background.js -> content script (getMarkdownSnapshot message)

**Contract:** background.js can also send `{ action: 'getMarkdownSnapshot', options: { guideSelectors, charBudget, maxElements } }` directly. content/messaging.js (line 753-771) calls `FSB.buildMarkdownSnapshot(options)` and returns `{ success, markdownSnapshot, refGeneration, elementCount }`.

**v0.9.24 status:** Same contract.

**Current status:** Intact. No changes to message format or response shape.

**Verdict:** OK -- no contract mismatch.

### content/messaging.js diff since v0.9.24

Only change: 4 comment lines added (audit annotations on the sessionStatus handler). Zero behavior changes. The DOM message handlers (`getDOM`, `getMarkdownSnapshot`, `readPage`) are byte-for-byte identical to v0.9.24.

## Functions Audited

### content/dom-analysis.js

| Function | Verdict | Notes |
|----------|---------|-------|
| hashElement() | OK | Element hashing for diffing. Unchanged. |
| isInViewport() | OK | Viewport detection. Unchanged. |
| isElementInViewport() | OK | Rect-based viewport check. Unchanged. |
| slugify() | OK | Text slug generation for semantic IDs. Unchanged. |
| generateSemanticElementId() | OK | Semantic ID generation (tag_text_index pattern). Unchanged. |
| inferElementPurpose() | CHANGED-OK | Payment field detection expanded with autocomplete (DA-01). Improvement. |
| getRelationshipContext() | OK | Element relationship detection. Unchanged. |
| generateElementDescription() | OK | Human-readable element descriptions. Unchanged. |
| getColorName() | OK | RGB color naming helper. Unchanged. |
| getElementCluster() | OK | UI region clustering. Unchanged. |
| getVisualProperties() | OK | Computed style extraction. Unchanged. |
| getShadowPath() | OK | Shadow DOM path computation. Unchanged. |
| prioritizeElements() | OK | Element priority scoring. Unchanged. |
| diffDOM() | OK | Incremental DOM diffing. Unchanged. |
| extractRelevantHTML() | OK | Raw HTML extraction. Unchanged. |
| detectPageContext() | OK | Page type detection (search, login, form, etc.). Unchanged. |
| detectSearchNoResults() | OK | Search results absence detection. Unchanged. |
| extractErrorMessages() | OK | Error message extraction. Unchanged. |
| isElementVisible() | OK | Computed style visibility check. Unchanged. |
| detectCompletionSignals() | OK | Task completion signal detection. Unchanged. |
| inferPageIntent() | OK | Page intent classification. Unchanged. |
| extractEcommerceProducts() | OK | Product card extraction. Unchanged. |
| calculateElementScore() | OK | Element relevance scoring. Unchanged. |
| findElementByStrategies() | OK | Multi-strategy element lookup. Unchanged. |
| getFilteredElements() | OK | 3-stage element filtering pipeline. Unchanged. |
| getRegion() | OK | DOM region classification. Unchanged. |
| inferActionForElement() | OK | Action inference for elements. Unchanged. |
| buildGuideAnnotations() | OK | Site guide annotation injection. Unchanged. |
| isBlockElement() | OK | Block element detection. Unchanged. |
| isVisibleForSnapshot() | OK | Snapshot visibility filter. Unchanged. |
| formatInlineRef() | OK | Inline ref formatting for markdown. Unchanged. |
| walkDOMToMarkdown() | OK | DOM-to-markdown walker. Unchanged. |
| buildMarkdownSnapshot() | OK | Markdown snapshot builder. Unchanged. |
| findMainContentRoot() | OK | Main content detection. Unchanged. |
| extractPageText() | OK | Page text extraction for readpage. Unchanged. |
| getStructuredDOM() | CHANGED-OK | data-fsb-id stamping (DA-02), autocomplete capture (DA-05), CDK overlay scan (DA-04). All additive. |
| getCanvasPixelFallback() | OK | Canvas pixel sampling. Unchanged. |

### content/selectors.js

| Function | Verdict | Notes |
|----------|---------|-------|
| generateSelectors() | OK | Multi-strategy selector generation (ID, data-testid, aria-label, CSS class, nth-child). Unchanged. |
| sanitizeSelector() | OK | jQuery pseudo-selector removal. Unchanged. |
| querySelectorWithShadow() | CHANGED-OK | data-fsb-id fallback added (DA-03). Improvement. |
| resolveRef() | OK | Compact ref (e1, e2) resolution via RefMap. Unchanged. |
| querySelectorAllWithShadow() | OK | Multi-element query with shadow DOM. Unchanged. |
| computeAccessibleName() | OK | ARIA accessible name computation. Unchanged. |
| getImplicitRole() | OK | HTML5 implicit ARIA role mapping. Unchanged. |
| getARIARelationships() | OK | ARIA relationship extraction. Unchanged. |
| isElementActionable() | OK | Actionability assessment. Unchanged. |

### Selector Resolution Fallback Chain (querySelectorWithShadow)

The full fallback chain in order:

1. **Sanitize:** Remove jQuery-only pseudo-selectors (:eq, :first, :visible, etc.)
2. **Cache check:** FSB.elementCache.get(sanitized) for fast repeated lookups
3. **XPath:** If selector starts with `//` or `/`, use document.evaluate
4. **Shadow DOM pierce:** If selector contains `>>>`, split and traverse shadow roots
5. **Regular querySelector:** Standard document.querySelector(sanitized)
6. **Unicode aria-label fallback:** Strip invisible Unicode chars from aria-label and retry
7. **data-fsb-id fallback:** NEW (DA-03) -- If selector matches `/^[a-z][a-z0-9_-]+$/`, try `[data-fsb-id="..."]`
8. **Cache + return:** Store found element in FSB.elementCache

The chain is well-ordered -- CSS selectors always tried first, with increasingly specialized fallbacks. The new step 7 is correctly positioned after all standard mechanisms.
