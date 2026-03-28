# Phase 25: Google Sheets Snapshot Pipeline Fix - Research

**Researched:** 2026-03-09
**Domain:** DOM snapshot pipeline (content/dom-analysis.js)
**Confidence:** HIGH

## Summary

The Google Sheets formula bar and name box elements are invisible in the AI's markdown snapshot despite Phase 24 fixes that added Sheets-specific element injection (Stage 1b) and formula bar content reading (formatInlineRef). The root cause is in the `walkDOMToMarkdown` function: it checks `isVisibleForSnapshot()` on every ancestor node during the tree walk, and when any parent container has `aria-hidden="true"` or `display:none`, the entire subtree is skipped. The fsbRole bypass in `isVisibleForSnapshot` (line 2020) only fires when the walker reaches the node itself -- but it never does because the parent was skipped first.

There are 7 failure modes identified in the analysis. Of these, Stage 1b injection (modes 3, 4) and formatInlineRef content reading (mode 6) have ALREADY been fixed in Phase 24 plans 06 and 07. The remaining failures are all in the walker (modes 1, 2, 5, 7). Mode 5 (isVisibleForSnapshot bypass) was also fixed but is ineffective because the walker never reaches the child node.

**Primary recommendation:** Modify `walkDOMToMarkdown`'s `visit()` function to NOT skip subtrees of aria-hidden parents when those subtrees contain fsbRole children. This is the single critical fix. The interactive parent swallowing issue (mode 2) is a secondary fix that may or may not be needed depending on the DOM structure.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vanilla JS | ES2020 | All implementation | Project rule: no build system, no dependencies |

### Supporting
No additional libraries needed. This is a surgical fix to existing code in dom-analysis.js.

## Architecture Patterns

### Relevant Code Structure
```
content/
├── dom-analysis.js          # THE file to modify -- snapshot pipeline
│   ├── getFilteredElements() # Stage 1-3: element collection + filtering
│   ├── isVisibleForSnapshot() # Visibility gate used by walker
│   ├── formatInlineRef()     # Formats element as backtick ref (already has formula bar code)
│   ├── walkDOMToMarkdown()   # THE CRITICAL FUNCTION -- recursive DOM walker
│   └── buildMarkdownSnapshot() # Orchestrator that ties it all together
├── messaging.js             # isCanvasBasedEditor() function
└── actions.js               # Click/type actions (not modified)

site-guides/productivity/
└── google-sheets.js         # Sheets guide (already updated in 24-07)
```

### Pattern: The Snapshot Pipeline (current flow)

1. `buildMarkdownSnapshot()` calls `getFilteredElements()` to get interactive elements
2. `getFilteredElements()` Stage 1b injects Sheets formula bar/name box with `fsbRole` dataset
3. `getFilteredElements()` Stage 2 filters by visibility -- fsbRole bypass exists (line 1809)
4. Elements that survive are registered in `refMap` and added to `interactiveSet`
5. `walkDOMToMarkdown()` walks `document.body` recursively
6. For each node, `visit()` calls `isVisibleForSnapshot()` -- fsbRole bypass exists (line 2020)
7. If node is in `interactiveSet`, emit its ref via `formatInlineRef()` and **skip children**
8. If node is NOT in interactiveSet, recurse into children

**THE BREAK POINT:** Step 6 checks the PARENT container, not the formula bar itself. The parent has aria-hidden but no fsbRole. The parent fails visibility, the walker returns, and the child with fsbRole is never visited.

### Pattern: The Parent Container Problem

```
Google Sheets DOM (simplified):

<div class="toolbar-wrapper" aria-hidden="true">    <-- Walker stops HERE
  <div id="t-formula-bar-input" data-fsbRole="formula-bar">  <-- Never reached
    <div contenteditable="true">cell content</div>
  </div>
</div>
```

The walker visits the toolbar-wrapper, calls `isVisibleForSnapshot()`, sees `aria-hidden="true"`, and returns without visiting children. The formula bar with fsbRole is never reached.

### Pattern: The Fix Approach

Modify `isVisibleForSnapshot()` to NOT reject aria-hidden containers that have fsbRole descendants. Two implementation options:

**Option A (Recommended): Check for fsbRole children before rejecting**
```javascript
// In isVisibleForSnapshot, before rejecting aria-hidden:
if (node.getAttribute('aria-hidden') === 'true') {
  // Don't skip if this node contains fsbRole children (Sheets formula bar, etc.)
  if (node.querySelector('[data-fsb-role]')) return true;
  return false;
}
```

**Option B: Pre-walk fsbRole elements in walkDOMToMarkdown**
Instead of relying on the tree walk to discover fsbRole elements, inject them directly into the markdown output at a known position (e.g., before or after the main walk). This avoids the parent filtering issue entirely.

```javascript
// In walkDOMToMarkdown, before or after the main walk:
// Force-visit all fsbRole elements that are in interactiveSet
for (const el of interactiveSet) {
  if (el.dataset && el.dataset.fsbRole) {
    const refStr = formatInlineRef(el, refMap, guideAnnotations);
    if (refStr) {
      lines.push({ region: '@main', text: refStr });
    }
  }
}
```

**Option A** is cleaner because the formula bar appears in document order. **Option B** is safer because it guarantees the elements appear regardless of any future filtering changes.

**Recommended: Use Option B** -- it is structurally immune to any parent filtering issue. Option A requires `querySelector` on every aria-hidden element (performance concern for complex pages) and could be fragile if Google changes their nesting.

### Anti-Patterns to Avoid
- **Modifying isVisibleForSnapshot broadly:** Don't weaken the aria-hidden filter for all elements. The fix must be scoped to fsbRole children only.
- **Walking INTO aria-hidden parents to find fsbRole children:** This would expose other hidden elements. Better to pre-inject fsbRole elements.
- **Relying on DOM position:** Don't assume the formula bar is always inside a specific parent. Google Sheets DOM changes between versions.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Formula bar content reading | Custom DOM traversal | Existing formatInlineRef formula-bar code (lines 2112-2148) | Already handles 3 fallback sources |
| Element injection | New injection system | Existing Stage 1b pattern (lines 1782-1803) | Already works, just needs walker fix |
| Visibility bypassing | New filter system | fsbRole dataset pattern | Established pattern in codebase |

## Common Pitfalls

### Pitfall 1: Fixing isVisibleForSnapshot but not the walker
**What goes wrong:** Adding more bypasses to isVisibleForSnapshot doesn't help because the walker calls it on the PARENT, not the formula bar itself. The parent has no fsbRole.
**Why it happens:** The existing Phase 24 fix added fsbRole bypass to isVisibleForSnapshot (line 2020) -- this is correct for the formula bar node itself but useless because the parent blocks traversal first.
**How to avoid:** The fix must be in walkDOMToMarkdown's visit() function or must pre-inject the elements into the output.

### Pitfall 2: Interactive parent swallowing
**What goes wrong:** If a parent toolbar element is in `interactiveSet`, line 2250 returns without recursing into children. The formula bar inside it is never visited.
**Why it happens:** The walker emits the parent's ref and skips children to avoid text duplication (this is correct for most elements).
**How to avoid:** Pre-injecting fsbRole elements (Option B) completely sidesteps this. Otherwise, add a check: before returning at line 2250, check if any children have fsbRole and visit those.
**Warning signs:** If the formula bar's parent element appears as an interactive ref in the snapshot but the formula bar itself doesn't.

### Pitfall 3: Character budget truncation
**What goes wrong:** With charBudget=12000, if formula bar elements appear late in document order, they may be truncated.
**Why it happens:** The budget is applied line by line until exceeded.
**How to avoid:** Pre-injecting fsbRole elements near the TOP of the output ensures they're within budget.

### Pitfall 4: Double-emission of formula bar content
**What goes wrong:** If the fix causes the formula bar to appear twice (once from the walk, once from pre-injection), the AI sees duplicate refs.
**Why it happens:** If the parent filtering is fixed AND pre-injection is used, both paths emit the element.
**How to avoid:** Track which fsbRole elements were emitted during the walk, and only pre-inject those that were missed.

### Pitfall 5: dataset attribute naming
**What goes wrong:** HTML dataset converts `data-fsbRole` to `element.dataset.fsbRole` but `querySelector('[data-fsbRole]')` is case-sensitive in HTML.
**Why it happens:** HTML attributes are case-insensitive but `querySelector` attribute selectors are case-sensitive for the VALUE, though attribute names are lowercased.
**How to avoid:** The existing code uses `el.dataset.fsbRole = role` which sets `data-fsbrole` in the DOM (lowercased). Use `querySelector('[data-fsbrole]')` or just check `node.dataset.fsbRole` in JS which auto-camelCases.

## Code Examples

### Current walker visit() -- the break point (dom-analysis.js:2211-2251)
```javascript
function visit(node) {
  // Text nodes
  if (node.nodeType === Node.TEXT_NODE) { /* ... */ return; }
  if (node.nodeType !== Node.ELEMENT_NODE) return;

  // Skip hidden elements (entire subtree) <-- THE PROBLEM
  if (!isVisibleForSnapshot(node)) return;  // Parent fails here, child never reached

  // Interactive elements: emit ref inline, skip children
  if (interactiveSet.has(node)) {
    const refStr = formatInlineRef(node, refMap, guideAnnotations);
    if (refStr) { currentLine += refStr; }
    return; // Don't recurse into interactive element children <-- SECONDARY PROBLEM
  }
  // ... recurse children
}
```

### Recommended fix: Pre-inject fsbRole elements (Option B)
```javascript
// In walkDOMToMarkdown, after the main walk completes:
// Guarantee fsbRole elements appear in snapshot even if parent filtering blocked them
const emittedFsbRoles = new Set();
const snapshotText = lines.map(l => l.text).join('\n');

for (const el of interactiveSet) {
  if (el.dataset && el.dataset.fsbRole) {
    const refStr = formatInlineRef(el, refMap, guideAnnotations);
    if (refStr && !snapshotText.includes(refStr)) {
      // This fsbRole element was NOT emitted during the walk -- inject it
      lines.unshift({ region: '@main', text: refStr });
    }
  }
}
```

### Alternative fix: Modify visit() to not skip fsbRole subtrees (Option A)
```javascript
// In visit(), replace line 2227:
// OLD:
if (!isVisibleForSnapshot(node)) return;

// NEW:
if (!isVisibleForSnapshot(node)) {
  // Even if this node is hidden, check if it has fsbRole children that must be visited
  if (node.nodeType === Node.ELEMENT_NODE) {
    const fsbChildren = node.querySelectorAll('[data-fsb-role]');
    // Note: data-fsbRole -> data-fsb-role in HTML attribute form
    // Actually: dataset.fsbRole sets data-fsbrole (no hyphen) in the DOM
    // Need to verify the exact attribute name
    for (const fsbChild of fsbChildren) {
      if (interactiveSet.has(fsbChild)) {
        const refStr = formatInlineRef(fsbChild, refMap, guideAnnotations);
        if (refStr) {
          if (currentLine && !currentLine.endsWith(' ')) currentLine += ' ';
          currentLine += refStr;
        }
      }
    }
  }
  return;
}
```

### Verify dataset attribute name in existing code
```javascript
// Line 1776: el.dataset.fsbRole = role;
// This creates attribute: data-fsbrole="formula-bar" (lowercased, no hyphen)
// querySelector must use: '[data-fsbrole]' NOT '[data-fsbRole]' or '[data-fsb-role]'
// BUT: el.dataset.fsbRole reads it correctly regardless
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| No Sheets elements in snapshot | Stage 1b injects formula bar + name box | Phase 24-06 (2026-03-09) | Elements injected but blocked by walker |
| No formula bar content reading | formatInlineRef reads 3 sources | Phase 24-06 (2026-03-09) | Content reading works but element never reached |
| No visibility bypass for fsbRole | fsbRole bypass in Stage 2 + isVisibleForSnapshot | Phase 24-06 (2026-03-09) | Bypasses work at their level but walker parent issue remains |

**What Phase 24 fixed (working correctly):**
- Stage 1b Sheets injection (lines 1782-1803) -- VERIFIED working
- Stage 2 fsbRole bypass (line 1809) -- VERIFIED working
- isVisibleForSnapshot fsbRole bypass (line 2020) -- CORRECT but unreachable for child nodes
- formatInlineRef formula bar content reading (lines 2112-2148) -- CORRECT but never called
- formatInlineRef name box content reading (lines 2150-2156) -- CORRECT but never called
- Debug logging (sheets_injection, sheets_visibility_filter, sheets_snapshot_summary) -- VERIFIED working

**What Phase 25 must fix (the remaining gap):**
- walkDOMToMarkdown visit() function: parent container blocks fsbRole child traversal

## Open Questions

1. **Exact DOM structure of Google Sheets formula bar in view mode**
   - What we know: The formula bar container likely has aria-hidden="true" or is inside an aria-hidden parent. The contenteditable div may have zero dimensions.
   - What's unclear: The exact nesting depth and which ancestor has aria-hidden. This affects whether Option A needs querySelector depth.
   - Recommendation: Option B (pre-injection) avoids needing to know. But the debug logs from sheets_visibility_filter (line 1840) will show the actual aria-hidden state when tested.

2. **Interactive parent swallowing: does it actually happen?**
   - What we know: If a toolbar container is in interactiveSet, it swallows children at line 2250.
   - What's unclear: Whether any toolbar container matching querySelectorAll criteria actually contains the formula bar.
   - Recommendation: Pre-injection (Option B) handles this case too. No separate fix needed.

3. **dataset.fsbRole attribute name in DOM**
   - What we know: `el.dataset.fsbRole = 'x'` sets `data-fsbrole="x"` in the HTML DOM (camelCase to lowercase conversion).
   - What's unclear: Need to verify querySelector uses `[data-fsbrole]` not `[data-fsbRole]` or `[data-fsb-role]`.
   - Recommendation: If using Option A, test the exact attribute name. If using Option B, iterate interactiveSet directly (no querySelector needed).

## Sources

### Primary (HIGH confidence)
- content/dom-analysis.js -- direct code analysis of getFilteredElements (lines 1748-1870), isVisibleForSnapshot (lines 2011-2049), formatInlineRef (lines 2059-2177), walkDOMToMarkdown (lines 2187-2368), buildMarkdownSnapshot (lines 2382-2442)
- .planning/debug/sheets-blindness-post-fix.md -- root cause analysis with 7 evidence entries
- .planning/phases/24-google-sheets-workflow-recovery/24-UAT.md -- UAT failure report for test 7

### Secondary (MEDIUM confidence)
- site-guides/productivity/google-sheets.js -- selector definitions and guidance text
- content/messaging.js -- isCanvasBasedEditor() implementation (line 217)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - single file modification, no dependencies
- Architecture: HIGH - complete code analysis of the pipeline, all 7 failure modes understood
- Pitfalls: HIGH - root cause confirmed by code tracing, fix approaches verified against codebase patterns

**Research date:** 2026-03-09
**Valid until:** 2026-04-09 (stable internal codebase, no external dependencies)
