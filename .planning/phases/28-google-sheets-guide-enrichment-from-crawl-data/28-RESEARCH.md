# Phase 28: Google Sheets Guide Enrichment from Crawl Data - Research

**Researched:** 2026-03-12
**Domain:** Google Sheets site guide fsbElements expansion + selectors map enrichment
**Confidence:** HIGH

## Summary

This phase extends the Phase 26 multi-strategy resilience pattern (currently covering only `name-box` and `formula-bar`) to all high-value interactive elements discovered in the crawl session data (`logs/fsb-research-docs.google.com-2026-03-12.json`). The crawl captured 60+ interactive elements from a live Google Sheets page, most of which have stable `#id`-based selectors that Google has maintained across Sheets versions.

The existing architecture in `dom-analysis.js` already supports arbitrary fsbElements -- the `for (const [role, def] of Object.entries(fsbElements))` loop at line 1808 iterates all entries in the site guide's `fsbElements` map, calls `findElementByStrategies()` for each, and sets `data-fsbRole`/`data-fsbLabel` attributes. No changes to dom-analysis.js are needed for adding new elements. The work is entirely in `google-sheets.js` (site guide enrichment) plus minor updates to the health check and annotation system.

**Primary recommendation:** Add 20-25 high-value fsbElements to the google-sheets.js site guide covering toolbar formatting buttons, menu bar items, sheet tabs, and cell input. Update the selectors map with stable `#id`-based selectors from the crawl. Expand the health check to validate beyond just name-box and formula-bar.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vanilla JS | N/A | All implementation | Project mandate: no build system, no dependencies |

### Files to Modify
| File | Purpose | Changes |
|------|---------|---------|
| `site-guides/productivity/google-sheets.js` | Site guide definition | Add fsbElements, update selectors map, add annotation labels |
| `content/dom-analysis.js` | DOM analysis pipeline | Expand health check, update hasFsbValueHandler guard |

## Architecture Patterns

### Pattern 1: fsbElements Multi-Strategy Definition
**What:** Each element gets an ordered array of 5 selectors tried in priority order (id -> class -> aria -> role -> context). First match wins.
**When to use:** For every element the AI needs to interact with that is not a standard DOM form element.
**Current implementation (lines 1806-1831 of dom-analysis.js):**
```javascript
// Site guide defines:
fsbElements: {
  'role-name': {
    label: 'Human readable description',
    selectors: [
      { strategy: 'id', selector: '#stable-id' },
      { strategy: 'class', selector: '.some-class' },
      { strategy: 'aria', selector: '[aria-label="Something"]' },
      { strategy: 'role', selector: '[role="button"][title*="partial"]' },
      { strategy: 'context', selector: '#parent-container .child-selector' }
    ]
  }
}

// dom-analysis.js iterates all entries automatically:
for (const [role, def] of Object.entries(fsbElements)) {
  const result = findElementByStrategies(def);
  if (result) {
    el.dataset.fsbRole = role;
    el.dataset.fsbLabel = def.label;
  }
}
```

### Pattern 2: Selectors Map for Guide Annotations
**What:** The `selectors` object in the site guide maps semantic names to CSS selectors. `buildGuideAnnotations()` (line 1998) matches these against elements in the snapshot to produce `[hint:keyName]` annotations.
**How it works:** For each key/selector pair, it calls `document.querySelector(part)` and if the element is in the snapshot's interactive set, it adds `[hint:keyName]` to the inline ref string.
**Example output:** `e5: toolbar-input "Name Box (current cell reference)" [hint:nameBox] = "A1"`

### Pattern 3: fsbRole Value Display
**What:** Elements with specific `data-fsbRole` values get custom value extraction in `formatInlineRef()` (line 2160+).
**Current special cases:**
- `name-box`: Reads `node.value || innerText`, validates against cell reference regex, shows `= "A1"`
- `formula-bar`: Multi-source value extraction (direct, contenteditable child, sibling spans), shows `= "Revenue"`
**Important guard (line 2161):** `hasFsbValueHandler` skips generic input value display for name-box and formula-bar to avoid duplicate values.
**Implication for new elements:** New toolbar buttons do NOT need custom value handlers -- they are buttons, not inputs. The guard only matters for input-type elements.

### Pattern 4: guideSelectors Threading
**What:** background.js resolves guide selectors once per iteration (line 8336-8342) and passes them through to the content script.
**Flow:** `getGuideForTask()` -> extract `guide.selectors` + `guide.fsbElements` -> pass as `guideSelectors` option to `getMarkdownSnapshot` -> received by `getFilteredElements()` -> used in Stage 1b injection.
**No changes needed:** The threading already passes the entire fsbElements object. Adding entries to the site guide automatically makes them available.

### Anti-Patterns to Avoid
- **Adding fsbElements that are not interactable by the AI:** Toolbar containers (#docs-toolbar) should be in selectors (for annotations) but NOT in fsbElements (they are not clickable targets).
- **Duplicating elements across fsbElements and Stage 1 candidates:** The code already handles this with `if (!candidateArray.includes(el))` checks, but adding container-level elements (menubar, toolbar) as fsbElements would clutter the snapshot.
- **Using dynamic IDs as primary selectors:** Some elements like sheet tabs have dynamic IDs (`:10`, `:e`, `:f`) that change between sessions. Use aria-label or class as primary strategy for these.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Multi-strategy element lookup | Custom per-element finder | `findElementByStrategies()` | Already exists, handles logging and diagnostics |
| Annotation hints | Manual hint injection | `buildGuideAnnotations()` via selectors map | Already wired into markdown snapshot |
| Canvas element injection | New injection point | Existing Stage 1b loop | Automatically iterates all fsbElements entries |

## Common Pitfalls

### Pitfall 1: Dynamic IDs on Sheet Tabs and Some Elements
**What goes wrong:** Sheet tabs use IDs like `:10`, `:e`, `:f` that are session-specific.
**Why it happens:** Google Closure Library generates these IDs dynamically.
**How to avoid:** For sheet tabs, use class-based or aria-label selectors as primary strategies. The `#\\:e` CSS escape is valid but the ID value itself changes.
**Warning signs:** Selectors that include `:` prefixed IDs (`:e`, `:f`, `:10`).

### Pitfall 2: Snapshot Token Budget Bloat
**What goes wrong:** Adding 25+ fsbElements could push too many toolbar buttons into the snapshot, consuming token budget that should go to page content.
**Why it happens:** All fsbRole elements bypass visibility filters (line 1865: `if (el.dataset.fsbRole) return true`).
**How to avoid:** Only add elements the AI ACTUALLY interacts with. Toolbar buttons that have keyboard shortcuts (bold = Ctrl+B) may be better left as keyboard-only interactions rather than fsbElements. Focus on elements that the AI needs to FIND and CLICK.
**Recommendation:** Prioritize elements that have no keyboard shortcut equivalent: font family, font size, zoom, borders, merge, text/fill color pickers, number formats, alignment menus.

### Pitfall 3: hasFsbValueHandler Guard Expansion
**What goes wrong:** If new fsbElements are input-type elements (font size input, zoom input), their values will display twice -- once from the generic input handler and once from an fsbRole handler.
**How to avoid:** Add new input-type fsbRoles to the `hasFsbValueHandler` guard at line 2161. For button-type elements, no change needed.
**Elements needing guard update:** `font-size` (input), `zoom` (input) -- these are text inputs with values.

### Pitfall 4: Menu Data Item Has Dynamic ID
**What goes wrong:** The Data menu item has `id="w183"` which is a dynamic Closure Library ID, NOT a stable semantic ID.
**How to avoid:** Use `#docs-data-menu` is NOT available (crawl shows `id: "w183"` for Data). Use the existing selectors map entry `menuData: '#docs-data-menu'` -- but this selector may not match. Verify by checking if the crawl shows `docs-data-menu` anywhere. It does NOT. The crawl shows `id: "w183"` for the Data menu item. Use aria/text-based selectors as primary.
**Affected element:** Data menu only -- all other menus have stable `#docs-*-menu` IDs.

### Pitfall 5: Health Check Hardcoded to Two Elements
**What goes wrong:** The health check (line 2548+) only validates name-box and formula-bar presence. Adding 25 elements without expanding the check means failures go undetected.
**How to avoid:** The existing `fsbRoleCount` already counts ALL fsbRole elements. The check could be expanded to validate a configurable minimum count (e.g., `fsbRoleCount >= 5` instead of just `> 0`).

## Crawl Data Analysis

### Complete Element Inventory from Crawl

**Toolbar Formatting Buttons (all have stable #id selectors):**
| Element | ID | aria-label | Priority |
|---------|----|----|----------|
| Undo | `#t-undo` | "Undo (Ctrl+Z)" | MEDIUM (has shortcut) |
| Redo | `#t-redo` | "Redo (Ctrl+Y)" | MEDIUM (has shortcut) |
| Print | `#t-print` | "Print (Ctrl+P)" | LOW |
| Paint format | `#t-paintformat` | "Paint format" | MEDIUM |
| Currency format | `#t-num-fmt-currency` | "Format as currency" | HIGH |
| Percent format | `#t-num-fmt-percent` | "Format as percent" | HIGH |
| Decimal decrease | `#t-num-fmt-decimal-decrease` | "Decrease decimal places" | MEDIUM |
| Decimal increase | `#t-num-fmt-decimal-increase` | "Increase decimal places" | MEDIUM |
| More formats | `#t-num-fmt-other` | "More formats" | HIGH |
| Font size decrement | `#fontSizeDecrement` | "Decrease font size" | MEDIUM |
| Font size increment | `#fontSizeIncrement` | "Increase font size" | MEDIUM |
| Bold | `#t-bold` | "Bold (Ctrl+B)" | MEDIUM (has shortcut) |
| Italic | `#t-italic` | "Italic (Ctrl+I)" | MEDIUM (has shortcut) |
| Strikethrough | `#t-strikethrough` | "Strikethrough (Alt+Shift+5)" | LOW |
| Text color | `#t-text-color` | "Text color" | HIGH |
| Fill color | `#t-cell-color` | "Fill color" | HIGH |
| Borders | `#t-border` | "Borders" | HIGH |
| Merge cells | `#t-merge-button` | "Merge cells" | HIGH |
| Merge menu | `#t-merge-menu` | "Select merge type" | MEDIUM |
| Horizontal align | `#t-align` | "Horizontal align" | HIGH |
| Vertical align | `#t-valign` | "Vertical align" | MEDIUM |
| Text wrapping | `#t-textwrap` | "Text wrapping" | MEDIUM |
| Text rotation | `#t-text-rotation` | "Text rotation" | LOW |
| Insert link | `#t-insert-link` | "Insert link (Ctrl+K)" | MEDIUM |
| Insert comment | `#t-insert-doco` | "Insert comment" | LOW |
| Insert chart | `#t-insert-chart` | "Insert chart" | MEDIUM |
| Filter toggle | `#t-autofilter-toggle` | "Create a filter" | HIGH |
| Filter views | `#t-autofilter-menu` | "Filter views" | MEDIUM |
| Functions | `#t-formula` | "Functions" | HIGH |
| View mode | `#viewModeButton` | "Hide the menus" | LOW |

**Combo/Input Elements:**
| Element | ID/Selector | aria-label | Priority |
|---------|------------|------------|----------|
| Font family | `#docs-font-family` | "Font" | HIGH |
| Font size select | `#fontSizeSelect` | N/A | HIGH |
| Font size input | `[aria-label="Font size"]` | "Font size" | HIGH |
| Zoom combo | `#t-zoom` | N/A | MEDIUM |
| Zoom input | `[aria-label="Zoom"]` | "Zoom" | MEDIUM |

**Menu Bar Items (all have stable #docs-*-menu IDs except Data):**
| Element | ID | Text | Priority |
|---------|----|----|----------|
| File | `#docs-file-menu` | "File" | HIGH |
| Edit | `#docs-edit-menu` | "Edit" | HIGH |
| View | `#docs-view-menu` | "View" | HIGH |
| Insert | `#docs-insert-menu` | "Insert" | HIGH |
| Format | `#docs-format-menu` | "Format" | HIGH |
| Data | `#w183` (DYNAMIC) | "Data" | HIGH |
| Tools | `#docs-tools-menu` | "Tools" | MEDIUM |
| Gemini | `#docs-gemini-menu` | "Gemini" | LOW |
| Extensions | `#docs-extensions-menu` | "Extensions" | LOW |
| Help | `#docs-help-menu` | "Help" | LOW |
| Accessibility | `#docs-screenreader-menu` | "Accessibility" | LOW |

**Sheet Management:**
| Element | ID/Selector | aria-label | Priority |
|---------|------------|------------|----------|
| Add Sheet button | `#\\:e` (DYNAMIC) | "Add Sheet" | HIGH |
| All Sheets button | `#\\:f` (DYNAMIC) | "All Sheets" | MEDIUM |
| Sheet tab (Sheet1) | `#\\:10` (DYNAMIC) | N/A | HIGH |
| Name box dropdown | `#t-name-box-dropdown` | "Name box menu button..." | LOW |

**Other Elements:**
| Element | ID/Selector | aria-label | Priority |
|---------|------------|------------|----------|
| Rename input | `.docs-title-input` | "Rename" | HIGH |
| Menu search | `.docs-omnibox-input` | "Menus" | MEDIUM |
| Cell input | `.cell-input` | (role=textbox) | Already covered by formula-bar |
| Star | `#docs-star` | "Star" | LOW |
| Side toolbar | `#docs-side-toolbar` | "Mode and view" | LOW |

### Existing Coverage (Phase 26 fsbElements)
Currently only 2 elements have multi-strategy fsbElements coverage:
1. `name-box` -- 5 strategies (id, class, aria, role, context)
2. `formula-bar` -- 5 strategies (id, class, aria, role, context)

### Existing Selectors Map Coverage
The selectors map has 16 entries but uses simple CSS selectors without multi-strategy resilience:
- `nameBox`, `cellInput`, `formulaBar`, `formulaBarInput` -- input elements
- `menuFile` through `menuTools` -- 7 menu items
- `sheetTabs`, `addSheet` -- sheet management
- `toolbar`, `spreadsheetTitle`, `gridContainer`, `blankTemplate`, `newSheet` -- page structure

### Recommended fsbElements Additions (Prioritized)

**Tier 1 -- High-value elements the AI needs to click (no keyboard shortcut):**
1. `bold` -- formatting (has shortcut but AI often clicks it)
2. `italic` -- formatting (has shortcut but AI often clicks it)
3. `text-color` -- no keyboard shortcut
4. `fill-color` -- no keyboard shortcut
5. `borders` -- no keyboard shortcut
6. `merge` -- no keyboard shortcut
7. `h-align` -- no keyboard shortcut
8. `font-family` -- no keyboard shortcut
9. `font-size` -- combo input
10. `num-fmt-currency` -- no keyboard shortcut
11. `num-fmt-percent` -- no keyboard shortcut
12. `num-fmt-other` -- more formats dropdown
13. `filter-toggle` -- no keyboard shortcut
14. `functions` -- no keyboard shortcut
15. `insert-chart` -- no keyboard shortcut

**Tier 2 -- Menu bar items (needed for workflow navigation):**
16. `menu-file` -- used in workflows
17. `menu-edit`
18. `menu-view` -- used in freeze workflow
19. `menu-insert`
20. `menu-format` -- used in alternating colors workflow
21. `menu-data`

**Tier 3 -- Sheet management:**
22. `add-sheet` -- dynamic ID, use aria-label primary
23. `sheet-tab` -- dynamic ID, use class primary
24. `spreadsheet-title` -- used in rename workflow

**Recommendation:** Implement Tier 1 (15 elements) + Tier 2 (6 menus) + Tier 3 (3 elements) = 24 new fsbElements. Total with existing 2 = 26 fsbElements.

### Selectors Map Updates
Update existing selectors map entries to use the stable `#id` selectors confirmed by the crawl:
- `menuData`: Change from `#docs-data-menu` to verify -- crawl shows dynamic ID `w183`. Use `[role="menuitem"]:nth-child(6)` or text-based matching.
- `addSheet`: Currently `#sheet-button` -- crawl shows `#\\:e` with `aria-label="Add Sheet"`. Use aria-label instead.
- All `#t-*` and `#docs-*` IDs are confirmed stable by crawl data.

## Code Examples

### Adding a new fsbElement (pattern to follow)
```javascript
// In google-sheets.js fsbElements:
'text-color': {
  label: 'Text color picker',
  selectors: [
    { strategy: 'id', selector: '#t-text-color' },
    { strategy: 'class', selector: '.docs-toolbar-color-menu-button:first-of-type' },
    { strategy: 'aria', selector: '[aria-label="Text color"]' },
    { strategy: 'role', selector: '[role="button"][aria-label*="color" i]' },
    { strategy: 'context', selector: '#docs-toolbar .docs-toolbar-color-menu-button' }
  ]
}
```

### Adding a menu item fsbElement
```javascript
'menu-format': {
  label: 'Format menu',
  selectors: [
    { strategy: 'id', selector: '#docs-format-menu' },
    { strategy: 'class', selector: '.menu-button[id="docs-format-menu"]' },
    { strategy: 'aria', selector: '[role="menuitem"]:nth-of-type(5)' },
    { strategy: 'role', selector: '#docs-menubar [role="menuitem"]:nth-child(5)' },
    { strategy: 'context', selector: '#docs-menubar .menu-button:nth-child(5)' }
  ]
}
```

### Adding a sheet management element with dynamic ID
```javascript
'add-sheet': {
  label: 'Add new sheet tab',
  selectors: [
    { strategy: 'aria', selector: '[aria-label="Add Sheet"]' },
    { strategy: 'class', selector: '.docs-sheet-add-button' },
    { strategy: 'role', selector: '[role="button"].docs-sheet-add-button' },
    { strategy: 'context', selector: '.docs-sheet-button.docs-sheet-add-button' },
    { strategy: 'id', selector: '#sheet-button' }
  ]
}
```

### Updating hasFsbValueHandler for new input elements
```javascript
// line 2161 of dom-analysis.js -- add font-size and zoom
const hasFsbValueHandler = node.dataset?.fsbRole === 'name-box' ||
  node.dataset?.fsbRole === 'formula-bar' ||
  node.dataset?.fsbRole === 'font-size' ||
  node.dataset?.fsbRole === 'zoom';
```

### Expanding the health check
```javascript
// After existing name-box/formula-bar checks:
checks.fsbRoleElementCount = fsbRoleCount;
checks.minExpectedFsbElements = 5; // Tier 1 minimum
const allPass = checks.nameBoxPresent && checks.formulaBarPresent && fsbRoleCount >= 5;
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hardcoded selectors in dom-analysis.js | fsbElements in site guide | Phase 26 | Selectors are maintainable per-site |
| Single selector per element | 5-strategy priority chain | Phase 26 | Resilient to Google Closure Library class churn |
| Only name-box + formula-bar | All high-value toolbar elements | Phase 28 (this) | AI can find and interact with formatting tools |

## Open Questions

1. **Token budget impact of 26 fsbElements**
   - What we know: All fsbRole elements bypass visibility filter, so they ALWAYS appear in snapshot.
   - What's unclear: Whether 26 toolbar refs will push snapshots over the 12K char budget on complex sheets.
   - Recommendation: Monitor snapshot size during testing. Consider adding a configurable `maxFsbElements` cap if needed. Toolbar buttons are compact refs (~40-60 chars each), so 26 elements adds ~1-1.5K chars -- likely acceptable within 12K budget.

2. **Data menu dynamic ID**
   - What we know: Crawl shows `id="w183"` for Data menu, not the expected `docs-data-menu`.
   - What's unclear: Whether `docs-data-menu` exists as an attribute on a different element, or if Google simply uses a different naming convention for Data.
   - Recommendation: Use text-content matching as a fallback strategy: `[role="menuitem"]` filtered by text.

3. **Should toolbar buttons be fsbElements or just selectors?**
   - What we know: fsbElements get injected as interactive elements in the snapshot. Selectors only produce [hint:] annotations on already-present elements.
   - What's unclear: Whether toolbar buttons are already captured by Stage 1 querySelectorAll (they have `[role="button"]` and `tabindex`).
   - Recommendation: Most toolbar buttons ARE already in Stage 1 candidates (they match `[role="button"]` or `[tabindex]`). For these, we only need selectors map entries (for hints), NOT fsbElements. Reserve fsbElements for elements that might be MISSED by Stage 1 (like the canvas-hidden formula bar). Test which elements Stage 1 captures before adding them as fsbElements. If an element is already captured, adding it as an fsbElement just adds redundant label/role metadata.

## Sources

### Primary (HIGH confidence)
- `logs/fsb-research-docs.google.com-2026-03-12.json` -- Live crawl data, all element IDs verified
- `site-guides/productivity/google-sheets.js` -- Current site guide, read in full
- `content/dom-analysis.js` -- Lines 1750-1860 (findElementByStrategies, getFilteredElements Stage 1b), 1998-2026 (buildGuideAnnotations), 2130-2240 (formatInlineRef value display), 2530-2597 (health check)
- `background.js` -- Lines 8333-8342 (guideSelectors resolution), 8545-8549 (guideSelectors threading)

### Secondary (MEDIUM confidence)
- Google Sheets DOM stability: `#t-*` prefixed IDs appear to be intentionally stable toolbar element IDs (confirmed by multiple crawl sessions showing same IDs). `#docs-*-menu` IDs are stable across Google Workspace apps.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All code is vanilla JS, well-understood project patterns
- Architecture: HIGH - Existing fsbElements pattern fully understood from source code
- Pitfalls: HIGH - Identified from direct code analysis (hasFsbValueHandler, dynamic IDs, health check)
- Crawl data: HIGH - Direct analysis of actual crawl output

**Research date:** 2026-03-12
**Valid until:** 2026-04-12 (stable -- Google Sheets DOM structure changes slowly)
