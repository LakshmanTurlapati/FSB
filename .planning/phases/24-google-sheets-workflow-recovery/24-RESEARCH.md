# Phase 24: Google Sheets Workflow Recovery - Research (Re-Research: Interaction Layer)

**Researched:** 2026-03-09
**Domain:** Element interaction pipeline, readiness checks, canvas editor bypasses, batch execution
**Confidence:** HIGH

## Summary

The detection-layer fixes from the original Phase 24 work are implemented and working (weighted keyword matching, URL extraction, generic prompt enhancement, canvas-aware stuck recovery, guide logging). The remaining blocker is the **interaction layer**: the AI cannot click Google Sheets elements because the readiness pipeline (`smartEnsureReady` -> `ensureElementReady`) blocks or times out, and batch suppression drops inter-cell navigation keystrokes.

The full action pipeline is: **background.js** `executeBatchActions`/`startAutomationLoop` -> `sendMessageWithRetry` -> **messaging.js** `executeAction` handler (ref resolution, 10s timeout wrapper) -> **actions.js** `tools.click`/`tools.type` (element lookup, readiness check, action execution) -> **accessibility.js** readiness checks (visibility, enabled, stability, obscuration, editable).

Three concrete problems were identified through code analysis and test session data: (1) Click actions on Sheets elements hang in `checkElementStable` because the Name Box input (`#t-name-box`) has a zero-height bounding rect that causes `requestAnimationFrame` instability measurements to fail, then `checkElementReceivesEvents` (now bypassed for canvas editors) was the second blocker. (2) Batch suppression in `executeBatchActions` drops all actions after the first `type` when 2+ type actions exist, losing Tab/Enter keystrokes between cells. (3) The AI's interaction strategy is suboptimal -- the site guide instructs "click Name Box" but click is the action that fails; the AI should use keyboard-only navigation patterns that bypass readiness entirely.

**Primary recommendation:** Three-pronged fix: (A) Add canvas editor bypass to click action's readiness pipeline (skip `ensureElementReady` for Sheets toolbar elements, use direct DOM click), (B) Replace batch suppression with per-action inter-action delays for Sheets, (C) Update the site guide to prefer keyboard-only patterns that avoid click on problematic elements.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Research best practices for fuzzy keyword matching in task-routing systems (researcher directive -- don't lock an approach yet)
- Investigate weighted/priority keywords where strong signals like "google sheet" can single-handedly match, vs weak signals like "sheet" needing corroboration
- Extract URLs from task text and run them through getGuideForUrl() -- if user says "fill in this sheet: docs.google.com/spreadsheets/d/...", that's an instant match
- Scope: Productivity Tools keywords only (Sheets/Docs) -- don't audit all 9 categories
- Debug existing flow first -- the code already calls getGuideForTask(task, currentUrl) each iteration, something is passing the wrong URL
- Ensure background script queries chrome.tabs.get(tabId) for the current URL before each AI call, not rely on cached/initial URL
- Add info-level log when guide activates mid-session: "Site guide activated: Google Sheets (detected via URL)" for easy debugging
- First-turn behavior without guide is acceptable if task just navigates -- Claude's discretion on whether to pre-load guide from task keywords
- Add exploration guidance to the generic (no-guide) fallback prompt: identify interactive elements, try form fields and buttons, use keyboard shortcuts (Tab, Enter, Escape, arrow keys) for navigation on canvas-heavy pages
- Smarter stuck recovery for canvas pages: when stuck on a canvas-heavy page, recovery should suggest keyboard-based interaction rather than refresh/new-tab loops
- This is a safety net -- detection fixes are the primary fix, but the AI should be self-sufficient enough to explore unfamiliar pages

### Claude's Discretion
- Exact implementation of weighted keyword matching (after research)
- Whether to pre-load guide from task keywords on first iteration
- Specific wording of generic prompt exploration guidance
- How to detect "canvas-heavy page" for stuck recovery hints

### Deferred Ideas (OUT OF SCOPE)
- Audit all 9 category keyword lists for similar singular/verb gaps -- future phase
- Generic canvas-app site guide template for other canvas-heavy apps (Google Slides, Figma, etc.) -- future phase
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| P24-01 | URLs extracted from task text matched via getGuideForUrl() | ALREADY IMPLEMENTED (commit d6c04f6) |
| P24-02 | Weighted keyword matching replaces flat 2-match threshold | ALREADY IMPLEMENTED (commit 342655d) |
| P24-03 | Productivity Tools includes singular forms as strong keywords | ALREADY IMPLEMENTED (commit 342655d) |
| P24-04 | Generic prompt includes exploration guidance with keyboard shortcuts | ALREADY IMPLEMENTED (commit d16f7ca) |
| P24-05 | Canvas-aware stuck recovery on Sheets/Docs/Slides URLs | ALREADY IMPLEMENTED (commit 03c35f2) |
| P24-06 | Guide activation logged at info level with detection method | ALREADY IMPLEMENTED (commit d16f7ca) |
| NEW-01 | Click actions succeed on Google Sheets toolbar elements (Name Box, formula bar) | Canvas editor click bypass in actions.js + accessibility.js analysis |
| NEW-02 | Batch execution preserves Tab/Enter keystrokes between type actions on Sheets | Batch suppression replacement with inter-action delay strategy |
| NEW-03 | Site guide instructs keyboard-only patterns that avoid click failures | Guide update to prefer keyPress-based navigation |
</phase_requirements>

## Standard Stack

### Core (No New Dependencies)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Chrome Extension APIs | MV3 | Action dispatch, CDP keyboard, debugger API | Existing stack |
| Vanilla JS | ES2022+ | All implementation | Project convention -- no build system |

### Supporting (Existing Internal Modules)
| Module | File | Purpose | When to Use |
|--------|------|---------|-------------|
| accessibility.js | content/accessibility.js | Element readiness pipeline | Click/type action gating |
| actions.js | content/actions.js | Action implementations (click, type, keyPress, typeWithKeys) | All user-facing actions |
| messaging.js | content/messaging.js | Message handler, ref resolution, isCanvasBasedEditor() | Action dispatch from background |
| background.js | background.js | Batch execution, automation loop, sendMessageWithRetry | Batch action orchestration |
| google-sheets.js | site-guides/productivity/google-sheets.js | Sheets-specific AI guidance | Site guide content |

## Architecture Patterns

### Full Action Pipeline: End-to-End Trace

```
background.js: startAutomationLoop (line ~9245)
  |-- AI returns batchActions[] or actions[]
  |-- If batchActions: executeBatchActions(actions, session, tabId) (line 6105)
  |     |-- BATCH SUPPRESSION CHECK (line 6112-6140): if Sheets URL + 2+ type actions, suppress entire batch
  |     |     |-- Returns {suppressed: true}, fallback to single-action (line 9257-9266)
  |     |-- For each action: sendMessageWithRetry(tabId, {action:'executeAction', tool, params})
  |-- If single action: sendMessageWithRetry(tabId, {action:'executeAction', tool, params})
  |
  v
messaging.js: handleBackgroundMessage case 'executeAction' (line 795)
  |-- REF RESOLUTION (line 816-838): params.ref -> FSB.resolveRef -> generateSelectors -> params.selector
  |-- REF-LESS FALLBACK (line 841-857): for type/pressEnter/keyPress without ref, use document.activeElement
  |-- TIMEOUT WRAPPER (line 888-891): 10 seconds for all actions except solveCaptcha
  |-- FSB.tools[tool](params) -- dispatches to actions.js
  |
  v
actions.js: tools.click(params) (line 1033)
  |-- ELEMENT LOOKUP (line 1044-1050): FSB.querySelectorWithShadow(selector)
  |-- READINESS CHECK (line 1102): FSB.smartEnsureReady(element, 'click')
  |     |-- performQuickReadinessCheck(element) (accessibility.js:902)
  |     |     |-- hasSize: rect.width > 0 && rect.height > 0
  |     |     |-- notDisabled: !element.disabled
  |     |     |-- visible: display/visibility/opacity checks
  |     |     |-- inViewport: rect within window bounds
  |     |     |-- receivesEvents: elementFromPoint check (BYPASSED for canvas editors since ce1f306)
  |     |     |-- If definitelyReady: return fast-path success
  |     |     |-- If any concern: fall through to ensureElementReady()
  |     |
  |     |-- ensureElementReady(element, 'click') (accessibility.js:1007)
  |           |-- 1. checkElementVisibility: zero-dim check, checkVisibility API, CSS checks
  |           |-- 2. checkElementEnabled: :disabled, aria-disabled, inert
  |           |-- 3. scrollIntoViewIfNeeded
  |           |-- 4. checkElementStable(element, 300ms): requestAnimationFrame position comparison
  |           |-- 5. checkElementReceivesEvents: elementFromPoint 5-point check (BYPASSED for canvas)
  |           |-- 6. checkElementEditable: only for type/fill actions
  |           |-- Any failure -> {ready: false, failureReason: ...}
  |
  |-- If not ready: return {success: false, error: "Element not ready: ..."}
  |-- If ready: dispatch mouse events (mousedown, mouseup, click) + element.click()
  |-- Verify effect via captureActionState/verifyActionEffect
```

### Where Click Fails on Google Sheets (Root Cause Analysis)

**The Name Box (`#t-name-box`) is an `<input>` element in the Sheets toolbar.** It has normal dimensions (non-zero width/height), is not disabled, and is CSS-visible. Here is why click still fails:

**Failure Scenario 1: `checkElementStable` timeout (300ms)**
The Name Box's bounding rect can shift during Sheets' dynamic toolbar rendering. If the toolbar is still settling (common on initial load or after resize), `checkElementStable` enters its retry loop (50ms intervals up to 300ms). If position delta exceeds 1px tolerance within that window, it returns `{passed: false, reason: 'Element position is unstable (animating)'}`. This triggers `ensureElementReady` to fail, which makes `smartEnsureReady` return `{ready: false}`.

**Failure Scenario 2: Quick check `inViewport` failure**
The quick readiness check at line 937-940 uses strict viewport bounds: `rect.top >= 0 && rect.bottom <= window.innerHeight && rect.left >= 0 && rect.right <= window.innerWidth`. If the Name Box is partially outside the viewport (e.g., due to scrolled toolbar state), it fails the fast path and falls through to the full `ensureElementReady`, which adds time toward the 10-second timeout.

**Failure Scenario 3: Combined timeout cascade**
Even with the `checkElementReceivesEvents` bypass (commit ce1f306), the 10-second timeout in messaging.js (line 888-891) can fire if the element lookup + readiness pipeline + action execution takes too long. The cascading checks (visibility + enabled + scroll + stability + events) each add latency, and on slow machines the aggregate can approach the timeout.

**Key Insight:** The `type` action SUCCEEDS on Sheets because:
1. When `canvasEditor = true` AND `!isInput` (line 1641), it skips readiness entirely and goes straight to `typeWithKeys` via CDP keyboard debugger
2. When `canvasEditor = true` AND `isInput` (line 1603), the Name Box guard redirects to `typeWithKeys` for non-cell-reference text
3. The post-loop canvas fallback (line 2428-2458) catches ALL selector failures and uses `typeWithKeys` directly
4. `typeWithKeys` uses `chrome.runtime.sendMessage({action: 'keyboardDebuggerAction'})` which bypasses ALL DOM readiness checks

**Click has NO equivalent bypass.** Click always goes through the full readiness pipeline even on canvas editor pages.

### Fix Strategy A: Canvas Editor Click Bypass in actions.js

**Where:** `content/actions.js`, click action (line 1033), before the readiness check at line 1102.

**What:** When `FSB.isCanvasBasedEditor()` is true and the target element is a recognized Sheets toolbar element (Name Box, formula bar, menu items, toolbar buttons), skip `smartEnsureReady` and perform the click directly. The element is a standard DOM element in the toolbar (not canvas-rendered), so `element.click()` works -- the issue is only that the readiness pipeline gates the click.

```javascript
// content/actions.js -- after element lookup (line 1050), before readiness check (line 1102)

// Canvas editor toolbar bypass: skip readiness checks for known toolbar elements
// These are standard DOM elements, but Sheets' dynamic toolbar causes false
// failures in stability/viewport checks. The elementFromPoint bypass (ce1f306)
// is insufficient because checkElementStable also fails.
if (FSB.isCanvasBasedEditor()) {
  const isToolbarElement = element.closest(
    '#docs-chrome, .docs-titlebar-container, #docs-toolbar, ' +
    '.waffle-name-box, #t-name-box, .cell-input, #t-formula-bar-input, ' +
    '[id^="docs-"], .docs-menubar, .goog-toolbar'
  );
  if (isToolbarElement) {
    // Direct click -- skip readiness pipeline entirely
    const clickRect = element.getBoundingClientRect();
    const centerX = clickRect.left + clickRect.width / 2;
    const centerY = clickRect.top + clickRect.height / 2;
    const mouseEventInit = {
      bubbles: true, cancelable: true, view: window,
      clientX: centerX, clientY: centerY,
      button: 0, buttons: 1
    };
    element.dispatchEvent(new MouseEvent('mousedown', mouseEventInit));
    element.dispatchEvent(new MouseEvent('mouseup', mouseEventInit));
    element.dispatchEvent(new MouseEvent('click', mouseEventInit));
    element.click();
    element.focus();

    return {
      success: true,
      clicked: params.selector,
      hadEffect: true,
      method: 'canvas_editor_toolbar_bypass',
      note: 'Skipped readiness checks for canvas editor toolbar element'
    };
  }
}
```

**Why this is safe:** Toolbar elements are real DOM elements. Sheets' canvas only affects the cell grid. The readiness pipeline's value (preventing clicks on invisible/obscured elements) is counterproductive here because Sheets' layered UI triggers false positives.

### Fix Strategy B: Replace Batch Suppression with Inter-Action Delays

**Where:** `background.js`, `executeBatchActions` (line 6112-6140)

**Current behavior:** If the URL is a Sheets spreadsheet and the batch has 2+ type actions, the ENTIRE batch is suppressed. Only the first action executes. This drops Tab/Enter keystrokes that move the cursor between cells.

**Problem:** A typical Sheets data entry batch looks like:
```
type e46 "Company"    # types into cell
key "Tab"             # moves to next column  -- DROPPED
type "Role"           # types into next cell   -- DROPPED
key "Tab"             # moves to next column   -- DROPPED
type "Location"       # types into next cell   -- DROPPED
key "Enter"           # moves to next row      -- DROPPED
```

When suppressed, only `type e46 "Company"` executes. All subsequent actions including Tab/Enter are lost, so all data goes into a single cell.

**Fix:** Replace the blanket suppression with a targeted inter-action delay. The actual problem is that Sheets needs time between actions to process keyboard input and update the canvas. Adding a 150-200ms delay between batch actions on Sheets URLs solves the concatenation issue without dropping actions.

```javascript
// background.js -- replace lines 6112-6140 with:

// Google Sheets canvas grid: add inter-action delay for reliable cell navigation
// The canvas needs time to process keyboard input between actions.
let sheetsInterActionDelay = 0;
try {
  const tab = await chrome.tabs.get(tabId);
  const currentUrl = tab?.url || '';
  if (/docs\.google\.com\/spreadsheets\/d\//i.test(currentUrl)) {
    sheetsInterActionDelay = 200; // 200ms between actions on Sheets
    automationLogger.info('Google Sheets detected: applying 200ms inter-action delay', {
      sessionId,
      actionCount: actions.length
    });
  }
} catch (urlCheckError) {
  automationLogger.debug('URL check for Sheets delay failed', { error: urlCheckError.message });
}

// Then in the action loop (after each action result at ~line 6200):
if (sheetsInterActionDelay > 0 && i < actions.length - 1) {
  await new Promise(resolve => setTimeout(resolve, sheetsInterActionDelay));
}
```

### Fix Strategy C: Update Site Guide to Prefer Keyboard-Only Patterns

**Where:** `site-guides/productivity/google-sheets.js`

**Problem:** The current site guide instructs `click e5 # Name Box` as the primary navigation method. But click is the action that times out. The AI should be instructed to use keyboard-only navigation that bypasses readiness checks entirely.

**Key insight:** `keyPress` uses the CDP debugger API (line 3236-3256) which talks directly to the browser's keyboard input system. It does NOT go through any readiness pipeline. Similarly, `typeWithKeys` uses the CDP keyboard debugger. Both work perfectly on Sheets.

**Updated pattern for the guide:**
```
# Instead of: click e5 → type e5 "A1" → enter
# Use: key "Escape" → key "ctrl+g" or focus Name Box via Tab → type "A1" → enter

# Simplest reliable pattern:
key "Escape"              # exit any edit mode
key "Ctrl" "Home"         # go to A1 (known starting point)
type "Header1"            # types into A1
key "Tab"                 # move to B1
type "Header2"            # types into B1
key "Enter"               # move to A2
```

However, the Name Box click pattern IS the most flexible (for jumping to arbitrary cells like "F25"). So click on the Name Box should still be documented, but with the canvas bypass in place it will work. The guide should also document the keyboard-only fallback.

### Anti-Patterns to Avoid

- **Adding more bypasses to accessibility.js without scoping:** The `checkElementReceivesEvents` bypass (commit ce1f306) applies to ALL elements on canvas editor pages. This is correct for obscuration, but further bypasses should be scoped to specific element categories (toolbar vs canvas content).
- **Removing batch execution entirely for Sheets:** Batches are critical for Sheets -- a single AI response needs to type + Tab + type + Tab + Enter as an atomic sequence. Removing batches forces single-action-per-iteration which is 6x slower.
- **Over-delaying batch actions:** 200ms is enough for Sheets to process a keystroke. Going higher (500ms+) would make data entry painfully slow. The delay should be the minimum needed for reliability.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Keyboard input on Sheets | Custom DOM keyboard event dispatch | CDP debugger API via `typeWithKeys`/`keyPress` | Google Sheets intercepts and processes CDP keyboard events; DOM events are ignored by the canvas |
| Click on Sheets toolbar | Custom coordinate-based clicking | Standard DOM click with readiness bypass | Toolbar elements ARE real DOM elements; the issue is readiness gates, not click dispatch |
| Cell navigation | Click on canvas coordinates | Name Box input (type cell ref + Enter) or keyboard shortcuts (Tab, Enter, Ctrl+Home) | Canvas cells are not DOM elements; coordinate clicking is unreliable |
| Inter-action timing | Fixed sleep in AI response | Framework-level delay in `executeBatchActions` | AI shouldn't manage timing; the execution layer should handle it |

## Common Pitfalls

### Pitfall 1: Click Bypass Too Broad
**What goes wrong:** Bypassing readiness for ALL elements on canvas editor pages causes clicks on actually-invisible or disabled elements to appear successful.
**Why it happens:** The bypass doesn't distinguish between toolbar elements (real DOM) and canvas-area elements (not real DOM targets).
**How to avoid:** Scope the bypass using `element.closest()` with toolbar container selectors (`#docs-chrome`, `#docs-toolbar`, `.docs-titlebar-container`, `.waffle-name-box`). Only toolbar/menubar elements get the bypass.
**Warning signs:** Click actions returning `success: true` but having no visible effect on non-toolbar elements.

### Pitfall 2: Batch Delay Too Short
**What goes wrong:** Tab/Enter keystrokes fire before Sheets processes the previous type action. Text ends up concatenated in one cell.
**Why it happens:** Google Sheets' canvas rendering has variable latency. Under load (large sheets, slow machine), 100ms may not be enough.
**How to avoid:** Use 200ms as the baseline delay. Monitor via action logs for `method: 'google_sheets_keyboard'` with verification that cursor actually moved.
**Warning signs:** Data appearing in wrong cells, concatenated values, missing Tab transitions.

### Pitfall 3: Ref Resolution Returns Stale Selector
**What goes wrong:** The AI sends `click({ref: "e67"})`, ref resolution generates a selector, but the selector doesn't find the element because the DOM changed.
**Why it happens:** Google Sheets dynamically rebuilds its toolbar during navigation, sheet switching, and sidebar open/close.
**How to avoid:** For the Name Box specifically, add a direct `#t-name-box` fallback selector. The ref resolution in messaging.js (line 816-838) should have a canvas-editor fallback that uses known stable selectors from the site guide.
**Warning signs:** "Element not found" errors on known-good toolbar elements.

### Pitfall 4: keyPress Without Focus Target
**What goes wrong:** `keyPress({key: "Tab"})` fires but nothing happens because focus is on `document.body` (no active element in Sheets).
**Why it happens:** After a failed click, focus may not be on any Sheets element. keyPress uses `document.activeElement` which defaults to body.
**How to avoid:** The keyPress action (line 3236) uses the CDP debugger API by default (`useDebuggerAPI: true`), which sends the keystroke at the browser level regardless of DOM focus. Ensure this path remains the default.
**Warning signs:** keyPress returning `success: true` with `method: 'debuggerAPI'` but no visible effect (rare -- CDP usually works).

### Pitfall 5: 10-Second Timeout Racing with Readiness
**What goes wrong:** The readiness pipeline takes 8 seconds (stability retries + scroll + re-check), then the action starts but the 10-second timeout in messaging.js fires 2 seconds into execution.
**Why it happens:** The timeout wraps the ENTIRE action (readiness + execution), not just execution.
**How to avoid:** The canvas editor toolbar bypass completely eliminates this race for Sheets toolbar elements. For other elements, the timeout remains appropriate as a safety net.
**Warning signs:** Actions timing out with `failureReason` containing stability/viewport concerns.

## Code Examples

### Canvas Editor Click Bypass (actions.js)

```javascript
// content/actions.js -- insert after element lookup at line 1050, before readiness check at line 1102
// Source: Codebase analysis of click failure on Sheets toolbar elements

// Canvas editor toolbar bypass: skip readiness for known toolbar DOM elements
// Readiness checks (stability, viewport bounds) produce false failures on
// Sheets/Docs/Slides dynamic toolbars. These are real DOM elements -- safe to click directly.
if (FSB.isCanvasBasedEditor()) {
  const toolbarContainers = '#docs-chrome, .docs-titlebar-container, #docs-toolbar, ' +
    '.waffle-name-box, #t-name-box, .cell-input, #t-formula-bar-input, ' +
    '[id^="docs-"], .docs-menubar, .goog-toolbar, .docs-sheet-tab-container';
  const isToolbarElement = element.matches(toolbarContainers) || element.closest(toolbarContainers);

  if (isToolbarElement) {
    logger.logActionExecution(FSB.sessionId, 'click', 'canvas_toolbar_bypass', {
      tagName: element.tagName,
      id: element.id,
      selector: selectorUsed
    });

    // Scroll into view if needed (simple, no stability check)
    if (!isElementInViewport(element)) {
      element.scrollIntoView({ behavior: 'instant', block: 'center' });
      await new Promise(r => setTimeout(r, 50));
    }

    // Direct click with full mouse event sequence
    const clickRect = element.getBoundingClientRect();
    const centerX = clickRect.left + clickRect.width / 2;
    const centerY = clickRect.top + clickRect.height / 2;
    const mouseEventInit = {
      bubbles: true, cancelable: true, view: window,
      clientX: centerX, clientY: centerY,
      screenX: centerX + window.screenX, screenY: centerY + window.screenY,
      button: 0, buttons: 1
    };

    element.dispatchEvent(new MouseEvent('mousedown', mouseEventInit));
    element.dispatchEvent(new MouseEvent('mouseup', mouseEventInit));
    element.dispatchEvent(new MouseEvent('click', mouseEventInit));
    element.click();
    element.focus();

    // Brief wait for Sheets to process the click
    await new Promise(r => setTimeout(r, 100));

    actionRecorder.record(null, 'click', params, {
      selectorTried, selectorUsed, elementFound: true,
      elementDetails: captureElementDetails(element),
      success: true, hadEffect: true,
      method: 'canvas_editor_toolbar_bypass',
      duration: Date.now() - startTime
    });

    return {
      success: true,
      clicked: params.selector,
      hadEffect: true,
      method: 'canvas_editor_toolbar_bypass',
      scrolled: false
    };
  }
}
```

### Batch Suppression Replacement (background.js)

```javascript
// background.js -- replace lines 6112-6140 (batch suppression block)
// Source: Analysis of batch suppression dropping Tab/Enter keystrokes

// Google Sheets inter-action delay: instead of suppressing batches entirely,
// add delay between actions so the canvas has time to process each keystroke.
let sheetsInterActionDelay = 0;
try {
  const tab = await chrome.tabs.get(tabId);
  const currentUrl = tab?.url || '';
  if (/docs\.google\.com\/spreadsheets\/d\//i.test(currentUrl)) {
    sheetsInterActionDelay = 200;
    automationLogger.info('Google Sheets batch: applying 200ms inter-action delay', {
      sessionId,
      actionCount: actions.length,
      tools: actions.map(a => a.tool)
    });
  }
} catch (urlCheckError) {
  automationLogger.debug('URL check for Sheets delay failed', { error: urlCheckError.message });
}

// Then after each action result processing (~line 6200, after results.push):
// Add Sheets inter-action delay
if (sheetsInterActionDelay > 0 && i < actions.length - 1) {
  await new Promise(resolve => setTimeout(resolve, sheetsInterActionDelay));
}
```

### Site Guide Keyboard-Only Pattern Addition

```javascript
// site-guides/productivity/google-sheets.js -- add to guidance string
// Source: Analysis of which actions bypass readiness pipeline

// Add after existing COMMON PATTERNS block:
`
KEYBOARD-FIRST NAVIGATION (MOST RELIABLE):
  # The following pattern avoids click reliability issues on canvas editors:
  key "Escape"              # exit edit mode
  click e5                  # click Name Box (works with toolbar bypass)
  type e5 "A1"              # type cell reference
  key "Enter"               # navigate to cell
  type "data value"         # type into active cell (no ref needed)
  key "Tab"                 # move to next column
  type "next value"         # type into next cell
  key "Enter"               # confirm and move to next row

IMPORTANT: After navigating to a cell via Name Box, you do NOT need to click
the cell. Just type -- keystrokes go to the active cell automatically.
For sequential data entry (fill a row): type value, Tab, type value, Tab, ..., Enter.
`
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| No canvas editor bypass | `checkElementReceivesEvents` bypassed for canvas editors | Commit ce1f306 | Partially fixes click -- obscuration check skipped |
| Full readiness for all elements | Quick readiness fast-path (`performQuickReadinessCheck`) | Earlier phase | Speeds up ready elements but still fails on Sheets toolbar |
| Batch suppression for Sheets | To be replaced with inter-action delay | This phase | Preserves Tab/Enter keystrokes between cells |
| Click-based Name Box workflow | Keyboard-first with click as primary (now working) | This phase | Reliable cell navigation |

## Open Questions

1. **Exact stability failure frequency on Name Box**
   - What we know: `checkElementStable` uses requestAnimationFrame with 1px tolerance and 300ms max wait. Name Box is part of Sheets' dynamic toolbar.
   - What's unclear: Whether the stability check fails consistently or only during specific toolbar states (e.g., loading, sidebar open/close).
   - Recommendation: The toolbar bypass makes this moot -- skip stability for toolbar elements entirely.

2. **Inter-action delay optimal value**
   - What we know: 200ms is a reasonable estimate based on Sheets' rendering cadence.
   - What's unclear: Whether slower machines need more time, or if certain action sequences (type + Tab) need different timing than others (type + Enter).
   - Recommendation: Start with 200ms, add logging to track success rates, tune later if needed.

3. **Whether `element.focus()` is needed after click bypass**
   - What we know: Name Box requires focus to accept keyboard input. Standard click dispatches focus events, but the bypass uses `element.click()` + `element.focus()` explicitly.
   - What's unclear: Whether `element.focus()` alone is sufficient or whether the full MouseEvent sequence is needed for Sheets' event handlers.
   - Recommendation: Keep both. The MouseEvent sequence triggers Sheets' internal click handlers, and `element.focus()` ensures the DOM focus state is correct.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Manual testing via browser extension debug mode |
| Config file | None -- manual verification |
| Quick run command | Load extension, submit Sheets task, check debug logs |
| Full suite command | Manual: run all Sheets workflow scenarios (create sheet, enter data, navigate cells) |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| NEW-01 | Click on Name Box succeeds without timeout | manual-only | Submit task targeting Name Box click, verify success in debug logs | N/A |
| NEW-02 | Batch type+Tab+type fills multiple cells | manual-only | Submit task "create sheet with 3 columns of data", verify Tab navigation works | N/A |
| NEW-03 | AI uses keyboard-first navigation pattern | manual-only | Observe AI action sequence in debug logs, verify keyboard patterns used | N/A |

### Sampling Rate
- **Per task commit:** Manual verification of specific fix via debug logs
- **Per wave merge:** Run golden test suite (24 tests) for regression check
- **Phase gate:** Manual Sheets workflow test: create new sheet, enter header row, enter 3 data rows

### Wave 0 Gaps
None -- no automated test infrastructure changes needed. All validation is manual.

## Sources

### Primary (HIGH confidence)
- `content/actions.js` -- Full source read: click action (lines 1033-1252), type action (lines 1538-2510), typeWithKeys (lines 3329-3416), keyPress (lines 3236-3276). Canvas editor bypasses at lines 1599, 1641, 2428.
- `content/accessibility.js` -- Full source read: checkElementVisibility (309-423), checkElementStable (500-590), checkElementReceivesEvents (638-756, canvas bypass at 642-643), checkElementEditable (763-819), performQuickReadinessCheck (902-971, canvas bypass at 944-945), smartEnsureReady (980-998), ensureElementReady (1007-1104).
- `content/messaging.js` -- Full source read: executeAction handler (795-938), ref resolution (816-838), ref-less fallback (841-857), 10s timeout (888-891), isCanvasBasedEditor (217-225), FSB namespace exports (1290-1308).
- `background.js` -- Full source read: executeBatchActions (6105-6250, batch suppression 6112-6140), batch suppression fallback (9245-9290), sendMessageWithRetry (2394-2463).
- `site-guides/productivity/google-sheets.js` -- Full 256-line guide read.

### Secondary (MEDIUM confidence)
- UAT results (24-UAT.md) -- Test session gap analysis showing click timeout and batch suppression failures.
- VERIFICATION results (24-VERIFICATION.md) -- All detection-layer requirements verified.

## Metadata

**Confidence breakdown:**
- Click failure root cause: HIGH - traced full pipeline through source code, identified exact failure points in readiness checks
- Batch suppression analysis: HIGH - read exact suppression logic, understood fallback behavior
- Type action success path: HIGH - traced canvas editor bypass through all three paths (main, Name Box guard, fallback)
- Click bypass fix strategy: HIGH - modeled on existing type action canvas bypass pattern
- Batch delay fix strategy: MEDIUM - 200ms is educated estimate, needs empirical validation
- Site guide update: HIGH - straightforward text change with clear rationale

**Research date:** 2026-03-09
**Valid until:** 2026-04-09 (stable codebase, no external dependencies)
