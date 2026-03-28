# Phase 26: Google Sheets Snapshot Diagnostic & Selector Resilience - Research

**Researched:** 2026-03-10
**Domain:** Google Sheets DOM selector resilience, diagnostic logging, content reading
**Confidence:** HIGH

## Summary

This phase hardens the Google Sheets snapshot pipeline against DOM changes by implementing multi-strategy selector lookup, enhanced diagnostic logging, and content reading improvements. The codebase already has a solid foundation: Stage 1b injection (dom-analysis.js:1764-1803), post-walk injection (dom-analysis.js:2370-2397), formatInlineRef content reading (dom-analysis.js:2112-2156), and 5 existing diagnostic log points. The work is primarily refactoring selector definitions out of dom-analysis.js into the site guide, adding fallback selectors per element, enhancing log messages to show which selector matched, and adding a first-snapshot health check.

Google Sheets DOM selectors are internal implementation details not publicly documented. They can change without notice during Google's frequent UI updates. The current codebase relies on 2 selectors per element (Name Box: `#t-name-box, .waffle-name-box`; Formula Bar: `#t-formula-bar-input, .cell-input`). Phase 26 expands this to 4-5 selectors per element using ID, class, aria-label, and role+context strategies, making the pipeline resilient to any single selector breaking.

**Primary recommendation:** Refactor selector definitions into the site guide as ordered arrays with metadata, make dom-analysis.js consume them generically, and add selector-match logging + first-snapshot health check as lightweight diagnostic layers.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Multi-strategy lookup: try selectors in priority order (ID -> class -> aria-label -> role+context), first match wins
- 4-5 well-researched selectors per element (Name Box, Formula Bar) -- enough depth that heuristic guessing is unnecessary
- Site guide (google-sheets.js) owns all selector definitions -- dom-analysis.js receives selector config, doesn't hardcode selectors
- When ALL selectors for an element fail: log a clear warning and skip the element (no heuristic scan fallback)
- Sheets-only scope -- no generic canvas-app pattern
- Console + debug log: use existing logger (FSB.sessionId-based) and also emit to console.debug when Debug Mode is enabled
- Log which selector in the priority chain matched for each fsbRole element
- One-line summary by default, detailed multi-field objects when verbose/debug mode is active
- One-time health check on first Sheets snapshot
- Empty formula bar: show element with (= "") so the AI knows it exists
- Name Box: validate cell reference format; if invalid, still show but flag in diagnostic log
- Pair Name Box value with Formula Bar content in the snapshot
- Show formula text not computed values
- Live DOM assertion on first Sheets snapshot when Debug Mode is enabled
- Verify both element presence in markdown output AND content format
- On failure: console warning + diagnostic dump of all 5 pipeline stages with pass/fail status
- First snapshot only per Sheets session -- no per-iteration overhead

### Claude's Discretion
- Exact heuristic aggressiveness for the last-resort fallback scan (if implemented beyond multi-strategy)
- Specific aria-label and role+context selector patterns for Name Box and Formula Bar (research Google Sheets DOM)
- How to pair Name Box + Formula Bar values in the markdown output format
- Self-test implementation details (assertion structure, dump format)

### Deferred Ideas (OUT OF SCOPE)
- Generic canvas-app selector resilience pattern for Google Docs, Slides, Figma
- Audit all 9 keyword categories for selector definitions
- Mock DOM unit test for snapshot pipeline
- Parent chain diagnosis logging
</user_constraints>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vanilla JS | ES2020 | All implementation | Project constraint: no build system, no new dependencies |
| AutomationLogger | Existing | Diagnostic logging | Already used throughout codebase via `logger.logDOMOperation()` |
| Site guide system | Existing | Selector ownership | `registerSiteGuide()` pattern already defines selectors per site |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| chrome.storage.local | MV3 | Debug mode flag access | Content script reads `debugMode` setting |
| FSB namespace | Existing | Cross-module state | `FSB.sessionId`, `FSB.isCanvasBasedEditor`, `FSB.refMap` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Ordered selector array | Selector map/object | Array preserves priority order naturally; object requires separate priority field |
| console.debug for debug output | logger.debug always | console.debug is only visible when DevTools filter includes verbose; logger.debug always writes to FSB log storage |

## Architecture Patterns

### Recommended Project Structure
```
site-guides/productivity/google-sheets.js   # Owns ALL selector definitions (expanded)
content/dom-analysis.js                      # Consumes selectors generically; health check
content/actions.js                           # Name Box guard (must stay in sync)
utils/automation-logger.js                   # Existing logger, no changes needed
```

### Pattern 1: Multi-Strategy Selector Lookup
**What:** Each element (Name Box, Formula Bar) has an ordered array of selector strategies. The lookup tries each in order, returning the first match.
**When to use:** Stage 1b injection (dom-analysis.js:1782-1795)

```javascript
// In google-sheets.js - selector definition format
fsbElements: {
  'name-box': {
    label: 'Name Box (current cell reference)',
    selectors: [
      { strategy: 'id', selector: '#t-name-box', description: 'Primary ID selector' },
      { strategy: 'class', selector: '.waffle-name-box', description: 'Waffle class' },
      { strategy: 'aria', selector: 'input[aria-label="Name Box"]', description: 'Aria label' },
      { strategy: 'role', selector: 'input[role="combobox"][title*="Name"]', description: 'Role+title combo' },
      { strategy: 'context', selector: '#docs-toolbar input[type="text"]:first-of-type', description: 'Toolbar context position' }
    ]
  },
  'formula-bar': {
    label: 'Formula bar (shows selected cell content)',
    selectors: [
      { strategy: 'id', selector: '#t-formula-bar-input', description: 'Primary ID selector' },
      { strategy: 'class', selector: '.cell-input', description: 'Cell input class' },
      { strategy: 'aria', selector: '[aria-label="Formula bar"]', description: 'Aria label' },
      { strategy: 'role', selector: '[contenteditable="true"][role="textbox"]', description: 'Editable textbox role' },
      { strategy: 'context', selector: '#formula-bar-container [contenteditable]', description: 'Formula bar container child' }
    ]
  }
}
```

```javascript
// In dom-analysis.js - generic consumer
function findElementByStrategies(fsbElementDef) {
  for (let i = 0; i < fsbElementDef.selectors.length; i++) {
    const { strategy, selector, description } = fsbElementDef.selectors[i];
    const el = document.querySelector(selector);
    if (el) {
      return { element: el, matchedIndex: i, matchedStrategy: strategy, total: fsbElementDef.selectors.length };
    }
  }
  return null; // All selectors failed
}
```

### Pattern 2: Selector Match Logging
**What:** Log which selector in the priority chain matched, as a one-liner.
**When to use:** After each successful element lookup in Stage 1b.

```javascript
// One-line format: "name-box found via #t-name-box [1/5]"
logger.logDOMOperation(FSB.sessionId, 'sheets_selector_match', {
  role: 'name-box',
  matched: `${selector} [${matchedIndex + 1}/${total}]`,
  strategy: matchedStrategy
});
```

### Pattern 3: First-Snapshot Health Check
**What:** On the first Sheets snapshot per session, run assertions and emit a pass/fail summary.
**When to use:** Inside `buildMarkdownSnapshot()` for Sheets URLs, gated by a session-level flag.

```javascript
// Gate: only run once per session
if (!FSB._sheetsHealthCheckDone && /spreadsheets\/d\//.test(window.location.pathname)) {
  FSB._sheetsHealthCheckDone = true;
  // Run health check...
}
```

### Pattern 4: Pairing Name Box + Formula Bar in Snapshot
**What:** Ensure both elements appear together in the snapshot with paired context.
**When to use:** In the post-walk injection output (dom-analysis.js:2370-2397).

The current formatInlineRef already emits `= "A1"` for Name Box and `= "cell content"` for Formula Bar. Pairing means both elements are injected adjacently. The post-walk injection already groups fsbRole elements at the top of the snapshot. The AI sees:

```markdown
`e5: toolbar-input "Name Box" [hint:nameBox] = "A1"`
`e8: toolbar-input "Formula bar" [hint:formulaBar] = "Revenue"`
```

This is already naturally paired. Enhancement: add a comment line between metadata header and first content if both are present:

```markdown
> **Selected cell:** A1 | **Content:** Revenue
```

### Anti-Patterns to Avoid
- **Hardcoding selectors in dom-analysis.js:** All selector strings must live in the site guide. dom-analysis.js should only receive and iterate over them.
- **Heuristic fallback scanning:** When all 5 selectors fail, do NOT scan the DOM for "anything that looks like a name box." Log the failure and skip.
- **Per-iteration health check:** The self-test runs exactly once per Sheets session (first snapshot). A session flag prevents re-running.
- **Hiding empty formula bar:** Show `= ""` so the AI knows the element exists and is empty, rather than omitting it.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| DOM element logging | Custom log format | Existing `logger.logDOMOperation()` | Consistent with 28+ existing call sites |
| Debug mode detection | Direct storage reads | Existing `fsbDebugMode` / message to background | Already wired up in background.js:627-631 |
| Selector priority ordering | Custom priority map | Simple ordered array with `.find()` | Array index IS the priority |
| Cell reference validation | New regex | Existing regex from actions.js:1679 | Already handles A1, B2:C10 patterns |

**Key insight:** The existing pipeline stages (1b injection, visibility filter, walker, post-inject, summary) already do the hard work. Phase 26 is about making them MORE resilient (multi-strategy selectors) and MORE visible (diagnostic logging), not rebuilding them.

## Common Pitfalls

### Pitfall 1: Selector Scope Collision
**What goes wrong:** A generic selector like `[contenteditable="true"]` matches multiple elements on the page, not just the formula bar.
**Why it happens:** Google Sheets has multiple contenteditable areas (formula bar, cell editor, document title).
**How to avoid:** Context-scoped selectors: `#formula-bar-container [contenteditable]` rather than bare `[contenteditable="true"]`. Each selector should be specific enough to match exactly one element.
**Warning signs:** Stage 1b injection count > expected (e.g., 3 formula bars found).

### Pitfall 2: Content Script Debug Mode Access
**What goes wrong:** Content scripts cannot directly read `fsbDebugMode` which lives in background.js scope.
**Why it happens:** Content scripts and service workers are separate execution contexts in MV3.
**How to avoid:** For the health check, either: (a) send a message to background to check debug mode, (b) read `chrome.storage.local.get('debugMode')` directly in content script, or (c) have the snapshot request message include a debugMode flag from the caller.
**Warning signs:** Health check never fires because debug mode check always returns undefined.

### Pitfall 3: Cell Reference Regex Gaps
**What goes wrong:** The existing regex `/^[A-Z]{1,3}[0-9]{1,7}(:[A-Z]{1,3}[0-9]{1,7})?$/i` doesn't handle `Sheet2!A1` or named ranges like `MyRange`.
**Why it happens:** Cross-sheet references use `SheetName!CellRef` format which the regex doesn't account for.
**How to avoid:** Extend validation to handle: `Sheet2!A1`, `'Sheet Name'!A1:B10`, and named ranges. Flag unrecognized formats in diagnostic log but still show the value.
**Warning signs:** Valid cross-sheet references flagged as "invalid cell reference" in diagnostic log.

### Pitfall 4: Post-Walk Injection Deduplication
**What goes wrong:** If selectors change, the string-based deduplication in post-walk injection (dom-analysis.js:2380 `emittedText.includes(refStr)`) might fail to detect already-emitted elements.
**Why it happens:** The refStr format includes the selector-derived text which may differ between walk emission and post-injection.
**How to avoid:** Deduplication should use the element reference (e.g., `e5:`) not the full formatted string.
**Warning signs:** Duplicate formula bar or name box entries in the snapshot.

### Pitfall 5: Selector Sync Between Site Guide and Actions.js
**What goes wrong:** actions.js:1676 hardcodes `element.id === 't-name-box'` for the Name Box guard. If selector definitions move to the site guide, this check falls out of sync.
**Why it happens:** Two separate code paths use different methods to identify the same element.
**How to avoid:** Share the element identification. The simplest approach: after Stage 1b injection, the element has `data-fsbRole="name-box"`. Actions.js can check `element.dataset.fsbRole === 'name-box'` instead of hardcoding the ID.
**Warning signs:** Name Box guard stops working after selector refactor.

## Code Examples

### Multi-Strategy Selector Definition (site guide format)
```javascript
// google-sheets.js - expanded selector definitions
selectors: {
  nameBox: '#t-name-box',           // Keep existing simple selector for backwards compat
  formulaBar: '#t-formula-bar-input, .cell-input',
  // ... other existing selectors unchanged ...
},
// NEW: ordered multi-strategy selectors for fsbRole elements
fsbElements: {
  'name-box': {
    label: 'Name Box (current cell reference)',
    selectors: [
      { strategy: 'id', selector: '#t-name-box' },
      { strategy: 'class', selector: '.waffle-name-box' },
      { strategy: 'aria', selector: 'input[aria-label*="Name Box"]' },
      { strategy: 'role', selector: 'input[role="combobox"][title*="ame"]' },
      { strategy: 'context', selector: '#docs-chrome input[type="text"]:first-child' }
    ]
  },
  'formula-bar': {
    label: 'Formula bar (shows selected cell content)',
    selectors: [
      { strategy: 'id', selector: '#t-formula-bar-input' },
      { strategy: 'class', selector: '.cell-input' },
      { strategy: 'aria', selector: '[aria-label*="formula" i]' },
      { strategy: 'role', selector: '[contenteditable="true"][role="textbox"]' },
      { strategy: 'context', selector: '#formula_bar [contenteditable]' }
    ]
  }
}
```

### Stage 1b Injection Refactored to Use Site Guide Selectors
```javascript
// dom-analysis.js - consume fsbElements from site guide
if (/spreadsheets\/d\//.test(window.location.pathname)) {
  // Get fsbElements from site guide (passed via guideSelectors)
  const fsbElements = guideSelectors?.fsbElements || {};

  for (const [role, config] of Object.entries(fsbElements)) {
    const result = findElementByStrategies(config);
    if (result) {
      const { element, matchedIndex, matchedStrategy, total } = result;
      if (!candidateArray.includes(element)) {
        element.dataset.fsbRole = role;
        element.dataset.fsbLabel = config.label;
        candidateArray.push(element);
      }
      logger.logDOMOperation(FSB.sessionId, 'sheets_selector_match', {
        role,
        matched: `${config.selectors[matchedIndex].selector} [${matchedIndex + 1}/${total}]`,
        strategy: matchedStrategy
      });
    } else {
      logger.log('warn', 'Sheets element not found', {
        sessionId: FSB.sessionId,
        role,
        selectorsAttempted: config.selectors.length
      });
    }
  }
}
```

### Health Check Implementation
```javascript
// dom-analysis.js - inside buildMarkdownSnapshot, after walkedLines are built
if (!FSB._sheetsHealthCheckDone && /spreadsheets\/d\//.test(window.location.pathname)) {
  FSB._sheetsHealthCheckDone = true;

  const snapshotText = walkedLines.map(l => l.text || l).join('\n');
  const cellRefRegex = /^('?[A-Za-z0-9 ]+!'?)?[A-Z]{1,3}[0-9]{1,7}(:[A-Z]{1,3}[0-9]{1,7})?$/i;

  const checks = {
    nameBoxPresent: snapshotText.includes('name-box') || snapshotText.includes('Name Box'),
    formulaBarPresent: snapshotText.includes('formula-bar') || snapshotText.includes('Formula bar'),
    nameBoxValue: snapshotText.match(/name.*?box.*?= "([^"]*?)"/i)?.[1] || null,
    formulaBarValue: snapshotText.match(/formula.*?= "([^"]*?)"/i)?.[1] || null
  };
  checks.nameBoxValidRef = checks.nameBoxValue ? cellRefRegex.test(checks.nameBoxValue) : null;
  checks.postInjectNeeded = postInjected > 0;

  const allPass = checks.nameBoxPresent && checks.formulaBarPresent;

  // Always log summary
  console.log(`[Sheets Health] name-box: ${checks.nameBoxPresent ? 'OK' : 'MISSING'}, ` +
    `formula-bar: ${checks.formulaBarPresent ? 'OK' : 'MISSING'}, ` +
    `post-inject: ${postInjected} needed`);

  if (!allPass) {
    console.warn('[Sheets Health] FAILED - diagnostic dump:', checks);
    logger.logDOMOperation(FSB.sessionId, 'sheets_health_check', {
      passed: false,
      ...checks,
      stages: {
        injection: !!document.querySelector('[data-fsb-role="name-box"], [data-fsb-role="formula-bar"]'),
        visibility: 'see sheets_visibility_filter log',
        walker: walkedLines.length > 0,
        postInject: postInjected,
        summary: 'FAILED'
      }
    });
  } else {
    logger.logDOMOperation(FSB.sessionId, 'sheets_health_check', { passed: true, ...checks });
  }
}
```

### Extended Cell Reference Validation
```javascript
// Enhanced regex that handles Sheet2!A1, 'Sheet Name'!A1:B10
const CELL_REF_REGEX = /^('?[A-Za-z0-9_ ]+!'?)?[A-Z]{1,3}[0-9]{1,7}(:[A-Z]{1,3}[0-9]{1,7})?$/i;

// Usage in Name Box content display
if (node.dataset && node.dataset.fsbRole === 'name-box') {
  const cellRef = (node.value || node.innerText || node.textContent || '').trim();
  if (cellRef) {
    parts.push(`= "${cellRef}"`);
    // Validate and log if suspicious
    if (!CELL_REF_REGEX.test(cellRef)) {
      logger.logDOMOperation(FSB.sessionId, 'sheets_namebox_unusual_value', {
        value: cellRef.substring(0, 40),
        looksLikeNamedRange: /^[A-Za-z_][A-Za-z0-9_]*$/.test(cellRef)
      });
    }
  } else {
    // Show empty Name Box so AI knows it exists
    parts.push(`= ""`);
  }
}
```

### Empty Formula Bar Display
```javascript
// In formatInlineRef, after the 3-source formula content lookup
if (node.dataset && node.dataset.fsbRole === 'formula-bar') {
  // ... existing 3-try content lookup ...
  if (formulaContent) {
    const truncVal = formulaContent.length > 80 ? formulaContent.substring(0, 77) + '...' : formulaContent;
    parts.push(`= "${truncVal}"`);
  } else {
    // Show empty formula bar so AI knows it exists and can interact
    parts.push(`= ""`);
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| 2 selectors per element | 4-5 selectors per element | Phase 26 | Survives 3 selector breakages before failure |
| Selectors hardcoded in dom-analysis.js | Selectors owned by site guide | Phase 26 | Single source of truth, easy to update |
| Silent failure when element not found | Warning log with attempted selectors | Phase 26 | Immediate visibility into selector breakage |
| No health check | First-snapshot health check | Phase 26 | Quick confidence that pipeline is working |
| Hidden empty formula bar | Empty formula bar shown as = "" | Phase 26 | AI knows element exists even when empty |

**Note:** Google Sheets DOM selectors are internal implementation details. Google can change element IDs, classes, and aria-labels at any time during UI updates. The selectors in this research are based on currently known patterns from the existing codebase. The multi-strategy approach is specifically designed so that if Google changes one selector, the others serve as fallbacks.

## Open Questions

1. **Exact aria-label values for Name Box and Formula Bar**
   - What we know: IDs are `#t-name-box` and `#t-formula-bar-input`; classes are `.waffle-name-box` and `.cell-input`
   - What's unclear: Exact aria-label text strings Google uses (e.g., "Name Box" vs "name box" vs "Cell reference")
   - Recommendation: The implementer should open Google Sheets in DevTools, inspect these elements, and capture the exact aria-label, role, and surrounding container IDs. The selector array in the site guide should be updated with verified values. Use case-insensitive attribute selectors (`[aria-label*="formula" i]`) for resilience.

2. **Content script debug mode access**
   - What we know: `fsbDebugMode` lives in background.js; content scripts use `logger.logDOMOperation()` which logs at debug level
   - What's unclear: Best way for content script to know if debug mode is on for conditional console.debug output
   - Recommendation: Read `chrome.storage.local.get('debugMode')` once at content script init (or first Sheets snapshot) and cache as `FSB._debugMode`. This avoids message overhead.

3. **Name Box + Formula Bar pairing format**
   - What we know: Both elements already appear in snapshot as inline refs with values
   - What's unclear: Whether an explicit paired summary line adds value or clutters the snapshot
   - Recommendation: Keep them as adjacent inline refs (current behavior via post-inject grouping). Add a one-line blockquote summary only if both have values: `> Selected: A1 | Content: Revenue`. This is compact and AI-friendly.

## Sources

### Primary (HIGH confidence)
- Existing codebase: dom-analysis.js Stage 1b (lines 1764-1803), post-walk injection (lines 2370-2397), formatInlineRef (lines 2112-2156)
- Existing codebase: google-sheets.js selector definitions (lines 126-145)
- Existing codebase: actions.js Name Box guard and cell ref regex (lines 1674-1679)
- Existing codebase: automation-logger.js logDOMOperation (lines 329-334)
- Existing codebase: background.js debugMode handling (lines 627-631, 11208-11210)

### Secondary (MEDIUM confidence)
- Google Sheets DOM structure: based on existing working selectors in codebase (#t-name-box, .waffle-name-box, #t-formula-bar-input, .cell-input) - these are verified to work as of the current codebase

### Tertiary (LOW confidence)
- Additional aria-label and role selectors for Name Box and Formula Bar: these are educated guesses based on Google's typical accessibility patterns and need DevTools verification before implementation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all vanilla JS, existing patterns, no new dependencies
- Architecture: HIGH - refactoring existing code, clear integration points documented in CONTEXT.md
- Pitfalls: HIGH - based on code analysis of actual integration points and known edge cases
- Selector values: LOW - aria-label and role+context selectors are hypothetical, need DevTools verification

**Research date:** 2026-03-10
**Valid until:** 2026-04-10 (stable -- no external dependencies, all internal refactoring)
