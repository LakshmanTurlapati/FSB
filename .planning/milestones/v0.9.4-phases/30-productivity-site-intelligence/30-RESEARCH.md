# Phase 30: Productivity Site Intelligence - Research

**Researched:** 2026-03-16
**Domain:** Chrome Extension site guide system -- fsbElements injection generalization + 7 new productivity app guides
**Confidence:** HIGH

## Summary

This phase has two distinct halves: (1) a surgical infrastructure refactor to generalize the fsbElements injection pipeline from Sheets-only to any site guide, and (2) creating 7 new site guide files following the established google-sheets.js pattern. The infrastructure change is small (~30 lines modified across 1 file) but is a hard prerequisite -- without it, fsbElements defined in any new guide are silently ignored. The guide creation work is repetitive but large (~300-400 lines per guide, 7 guides = ~2100-2800 lines of new code).

The codebase investigation reveals exactly three URL-gated blocks in `content/dom-analysis.js` that must be generalized: the Stage 1b fsbElements injection (line 1810), the Sheets snapshot logging (line 2540), and the Sheets health check (line 2558). The `findElementByStrategies()` function (line 1758) and the Stage 2 visibility bypass for fsbRole elements (line 1876) are already fully generic. The background.js guide resolution (line 8483) already passes `fsbElements` from any matched guide -- so the moment dom-analysis.js drops the URL gate, all new guides' fsbElements start working.

**Primary recommendation:** Do infrastructure generalization first (INFRA-01/02/03), verify Google Sheets still works, then build guides in complexity tiers: Keep+Todoist (simple DOM) -> Trello+Calendar (modals) -> Notion+Jira+Airtable (fragile selectors).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Match Google Sheets depth: every app gets 5-8 detailed workflows with exact keyboard sequences and fallback patterns (~300-400 lines per guide)
- Document exact keystroke-by-keystroke sequences, not intent-based descriptions
- Every workflow ends with a verification step; every workflow includes stuck recovery patterns
- Always keyboard-first for ALL apps -- keyboard is primary, click instructions only as fallback
- For apps requiring opt-in keyboard shortcuts (Google Calendar), guide's first workflow step is "Enable keyboard shortcuts in Settings"
- For contenteditable editors (Notion, Jira): always click-then-type
- Drag-and-drop: investigate and build a mechanical drag-and-drop tool using Input.dispatchMouseEvent or native DragEvent injection. Do NOT simply document keyboard alternatives
- Todoist Quick Add is THE primary create method -- document full natural language syntax
- Notion slash commands are the primary block creation method
- Jira: full form coverage -- every common field in create issue modal
- Airtable: per-field-type interaction guidance
- Match Sheets density: 15-25 fsbElements per app, always 5 strategies per fsbElement
- aria/role-first strategy ordering for React apps (Notion, Airtable). data-testid first for Atlassian apps (Trello, Jira)
- Reuse Sheets diagnostic pattern: health check on first page load

### Claude's Discretion
- Exact selector values per fsbElement (discovered during live DevTools inspection)
- Specific block of 5-8 workflows chosen per app
- Internal structure of the drag-and-drop tool (CDP approach vs native DragEvent injection)
- How to handle Airtable's exotic field types (formula, rollup) if not directly editable

### Deferred Ideas (OUT OF SCOPE)
- Airtable fillairtable mechanical tool for bulk data entry
- Notion database bulk entry tool
- Cross-app workflows (Jira issues to Airtable, Calendar events from Todoist)
- Per-site guide unit tests with mock DOM fragments
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| INFRA-01 | fsbElements injection generalized from Sheets-only to any guide with fsbElements | Exact code locations identified: dom-analysis.js lines 1810, 2540, 2558. Three URL gates to remove/replace. |
| INFRA-02 | Keyword matching updated for 7 new apps | index.js categoryKeywords structure documented. Need strong/weak keyword format for Productivity Tools. |
| INFRA-03 | Google domain disambiguation | isCanvasBasedEditor() at messaging.js:217 returns true for ALL docs.google.com -- Calendar/Keep use different subdomains. URL patterns handle this. |
| KEEP-01 | Google Keep site guide | URL pattern: keep.google.com. Standard DOM, no fsbElements needed initially. |
| KEEP-02 | Keep workflows | 5-8 workflows: create note, create checklist, pin/archive/delete, add labels, search. |
| TODO-01 | Todoist site guide | URL pattern: app.todoist.com. Standard DOM. Single-key shortcut conflict warnings critical. |
| TODO-02 | Todoist workflows | Quick Add natural language syntax is primary. Workflows: quick-add, complete, organize. |
| TREL-01 | Trello site guide with fsbElements | URL pattern: trello.com. data-testid selectors. 3-8 fsbElements. |
| TREL-02 | Trello workflows | Create card, move card (keyboard), edit card, create list, board nav. |
| GCAL-01 | Google Calendar site guide with fsbElements | URL pattern: calendar.google.com. 5-10 fsbElements. Shortcut opt-in required. |
| GCAL-02 | Calendar workflows | Create event, edit, navigate dates, switch views, RSVP. |
| NOTN-01 | Notion site guide with fsbElements | URL pattern: notion.so. 10-18 fsbElements. aria/role-first selectors. Hashed CSS. |
| NOTN-02 | Notion workflows | Create page, add blocks via slash commands, database nav, search. |
| JIRA-01 | Jira site guide with fsbElements | URL pattern: *.atlassian.net. 8-12 fsbElements. data-testid first. New UI only. |
| JIRA-02 | Jira workflows | Create issue (full form), transition status, board nav, search/filter, comment. |
| ATBL-01 | Airtable site guide with fsbElements | URL pattern: airtable.com. 10-16 fsbElements. aria/role-first. |
| ATBL-02 | Airtable workflows | Navigate grid, edit cells by field type, create record, switch views, sort/filter. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vanilla JS (ES2021+) | N/A | All site guide code | Existing codebase constraint -- no build system, no bundler |
| Chrome Extension MV3 | manifest_version: 3 | Extension framework | Already in use, no version change |
| registerSiteGuide() | Built-in | Guide registration API | Existing pattern, works for any new site |
| findElementByStrategies() | Built-in | Multi-strategy selector resolution | Already generic in dom-analysis.js |
| registerCategoryGuidance() | Built-in | Category-level shared guidance | Already exists in _shared.js pattern |

### Supporting
No new dependencies. Zero npm packages. Zero new Chrome APIs. Zero new permissions.

### Alternatives Considered
None -- the existing architecture is architecturally sufficient. The only change is removing URL gates.

## Architecture Patterns

### File Structure (New Files)
```
site-guides/productivity/
  _shared.js           # MODIFY: rewrite for non-canvas app paradigms
  google-sheets.js     # EXISTING: reference implementation (DO NOT MODIFY)
  google-docs.js       # EXISTING (DO NOT MODIFY)
  google-keep.js       # NEW
  google-calendar.js   # NEW
  todoist.js           # NEW
  trello.js            # NEW
  notion.js            # NEW
  jira.js              # NEW
  airtable.js          # NEW
```

### Files to Modify
```
content/dom-analysis.js     # INFRA-01: Generalize 3 URL gates
site-guides/index.js        # INFRA-02: Add keywords for 7 apps
site-guides/productivity/_shared.js  # Rewrite shared guidance
background.js               # Add 7 importScripts lines (after line 132)
ui/options.html             # Add 7 script tags (after line 1309)
```

### Pattern 1: Site Guide File Template (derived from google-sheets.js)

Every new guide file MUST follow this exact structure:

```javascript
/**
 * Site Guide: {App Name}
 * Per-site guide for {app description}.
 */

registerSiteGuide({
  site: '{App Name}',           // Display name (e.g., 'Google Calendar')
  category: 'Productivity Tools', // Always this category
  patterns: [
    /pattern1/i,                // Primary URL regex
    /pattern2/i                 // Alternate URL regex (if needed)
  ],
  guidance: `{APP NAME}-SPECIFIC INTELLIGENCE:

{Detailed keyboard-first guidance text}
{Interaction patterns}
{Keyboard shortcuts}
{Common patterns with tool command examples}

CRITICAL WARNING:
{App-specific gotchas}`,

  fsbElements: {
    '{role-name}': {
      label: '{Human-readable description}',
      selectors: [
        { strategy: 'id', selector: '{#id-selector}' },
        { strategy: 'class', selector: '{.class-selector}' },
        { strategy: 'aria', selector: '{[aria-label="..."]}' },
        { strategy: 'role', selector: '{[role="..."][aria-label="..."]}' },
        { strategy: 'context', selector: '{parent child}' }
      ]
    }
    // 15-25 elements per app
  },

  selectors: {
    // Simple key:selector pairs for guide annotations (separate from fsbElements)
    key1: '#selector1',
    key2: '.selector2'
  },

  workflows: {
    workflowName: [
      'Step 1 with exact keystroke sequence',
      'Step 2 with verification',
      'Step 3 with fallback pattern',
      'VERIFY: {how to confirm success}',
      'STUCK: {recovery pattern if step fails}'
    ]
    // 5-8 workflows per app
  },

  warnings: [
    'Warning 1 about app-specific gotcha',
    'Warning 2 about timing/focus issues'
    // 5-15 warnings per app
  ],

  toolPreferences: ['navigate', 'click', 'type', 'keyPress', 'waitForTabLoad',
                     'getText', 'waitForElement', 'getAttribute', 'waitForDOMStable']
});
```

### Pattern 2: Infrastructure Generalization (INFRA-01)

**The Critical Change -- dom-analysis.js Stage 1b (lines 1809-1870):**

Current code (lines 1809-1811):
```javascript
// Sheets-specific elements (formula bar and name box)
if (/spreadsheets\/d\//.test(window.location.pathname)) {
  const fsbElements = guideSelectors?.fsbElements;
```

Must become:
```javascript
// Site guide fsbElements injection (any guide with fsbElements)
const fsbElements = guideSelectors?.fsbElements;
if (fsbElements) {
```

This single gate change (removing the URL regex and using fsbElements presence) unlocks the entire fsbElements pipeline for all 7 new apps. The rest of the injection loop (lines 1814-1838) is already generic -- it iterates `fsbElements` entries and calls `findElementByStrategies()`.

**BUT** there are complications -- the logging and fallback code inside the URL gate also need attention:

1. **Lines 1840-1857 (fallback hardcoded selectors):** The `else` branch with hardcoded Sheets selectors (`#t-formula-bar-input`, `#t-name-box`) should be kept but moved inside a Sheets-specific check, or removed entirely since the fsbElements path handles it.

2. **Lines 1860-1869 (injection logging):** The `sheets_injection` log label should be generalized to `fsbElements_injection`. The specific `formulaBar`/`nameBox` presence checks are Sheets-specific and should be replaced with generic matched/failed counts.

3. **Lines 1901-1918 (visibility filter logging):** The `/spreadsheets\/d\//` gate on this logging block should be removed or replaced with a generic `fsbInjectedCount > 0` check.

4. **Lines 2540-2555 (snapshot summary logging):** Sheets-specific snapshot logging. Should be generalized or conditioned on fsbElements presence rather than URL.

5. **Lines 2558-2608 (health check):** The Sheets-specific health check. Should be generalized to work for any guide with fsbElements. The `minExpectedFsbElements` should come from the guide definition or be set to a reasonable minimum.

**Important:** The `isCanvasBasedEditor()` gate on line 1794 is SEPARATE and should remain. It controls injection of canvas-specific elements (`.kix-page-column`, `.kix-appview-editor`, `.docs-title-input`). The fsbElements injection on line 1810+ is nested INSIDE this gate, which is the actual bug. The fsbElements injection should be moved OUTSIDE the `isCanvasBasedEditor()` block so it fires for non-canvas apps too.

**Corrected understanding of the code structure:**
```
Line 1794: if (FSB.isCanvasBasedEditor()) {        // <-- Canvas-specific block
Line 1800:   inject .kix-page-column etc.           // <-- Canvas stuff (keep gated)
Line 1809:   // Sheets-specific fsbElements          // <-- THIS must move OUTSIDE
Line 1810:   if (/spreadsheets\/d\//) {              // <-- THIS URL gate must go
Line 1814:     if (fsbElements) { ... }              // <-- This loop is generic
Line 1870:   }                                       // <-- End of Sheets block
Line 1871: }                                         // <-- End of isCanvasBasedEditor
```

**The fix:** Move the fsbElements injection block (lines 1809-1870) OUTSIDE and AFTER the `isCanvasBasedEditor()` block (after line 1871). Remove the URL regex check. Keep the canvas editor injection (lines 1794-1808) inside its gate.

### Pattern 3: Keyword Matching Addition (INFRA-02)

Current `categoryKeywords['Productivity Tools']` (index.js lines 193-201):
```javascript
'Productivity Tools': {
  strong: [
    'google sheets', 'google sheet', 'spreadsheet', 'google docs', 'google doc'
  ],
  weak: [
    'sheets', 'sheet', 'create sheet', 'new sheet', 'add to sheet', 'enter data',
    'create document', 'new document', 'write document', 'share document', 'edit document'
  ]
}
```

Must add to `strong` array:
```javascript
'notion', 'google calendar', 'google keep', 'todoist', 'trello', 'jira', 'airtable'
```

Must add to `weak` array:
```javascript
'calendar event', 'create event', 'schedule meeting',
'note', 'create note', 'checklist',
'task', 'create task', 'todo', 'add task',
'card', 'create card', 'board', 'kanban',
'issue', 'create issue', 'ticket', 'sprint', 'backlog',
'base', 'record', 'create record', 'grid view',
'page', 'create page', 'block', 'database'
```

**Keyword collision risk:** "issue" could match Coding Platforms (GitHub issues). "board" could match other categories. The weighted matching system handles this -- strong keywords (weight 2) for app names dominate, weak keywords (weight 1) only matter when multiple match. App name in the task text (e.g., "create a Jira issue") will always win because "jira" is a strong keyword (weight 2) plus "issue" is weak (weight 1) = score 3, well above threshold.

### Pattern 4: Google Domain Disambiguation (INFRA-03)

The URL pattern matching system in `getGuideForUrl()` tests patterns in registration order. Google subdomains are naturally disambiguated:

| App | URL Pattern | Hostname |
|-----|-------------|----------|
| Google Sheets | `docs.google.com/spreadsheets` | docs.google.com |
| Google Docs | `docs.google.com/document` | docs.google.com |
| Google Calendar | `calendar.google.com` | calendar.google.com |
| Google Keep | `keep.google.com` | keep.google.com |

Calendar and Keep use distinct subdomains, so their patterns never collide with Sheets/Docs. No special disambiguation code is needed -- the existing regex matching handles it naturally.

**BUT:** `extractDomain()` in index.js (line 86-89) has a `knownSubdomains` list that includes `'docs'` but NOT `'calendar'` or `'keep'`. If `extractDomain` is used for anything beyond what's visible, it may need updating. However, `extractDomain` is not used in the guide matching flow (`getGuideForUrl` uses regex `.test()` directly), so this is not blocking.

### Pattern 5: Background/Options Loading

**background.js** -- Add after line 132 (`importScripts('site-guides/productivity/google-docs.js');`):
```javascript
importScripts('site-guides/productivity/google-keep.js');
importScripts('site-guides/productivity/google-calendar.js');
importScripts('site-guides/productivity/todoist.js');
importScripts('site-guides/productivity/trello.js');
importScripts('site-guides/productivity/notion.js');
importScripts('site-guides/productivity/jira.js');
importScripts('site-guides/productivity/airtable.js');
```

**ui/options.html** -- Add after line 1309 (`<script src="../site-guides/productivity/google-docs.js"></script>`):
```html
<script src="../site-guides/productivity/google-keep.js"></script>
<script src="../site-guides/productivity/google-calendar.js"></script>
<script src="../site-guides/productivity/todoist.js"></script>
<script src="../site-guides/productivity/trello.js"></script>
<script src="../site-guides/productivity/notion.js"></script>
<script src="../site-guides/productivity/jira.js"></script>
<script src="../site-guides/productivity/airtable.js"></script>
```

**sidepanel.html** does NOT load site guides (confirmed by grep). No changes needed there.

**Content scripts:** Site guide files are NOT loaded as content scripts. They run in background.js (service worker) and options.html only. The `guideSelectors` object is passed to content scripts via `chrome.tabs.sendMessage()` at runtime (background.js line 8690). No manifest.json changes needed.

### Pattern 6: _shared.js Rewrite

Current `_shared.js` is entirely canvas-focused (Google Sheets/Docs paradigm). Must be rewritten to cover all productivity app paradigms:

```javascript
registerCategoryGuidance({
  category: 'Productivity Tools',
  icon: 'fa-list-check',
  guidance: `PRODUCTIVITY TOOLS INTELLIGENCE:

INTERACTION PARADIGMS:
- Canvas-based apps (Google Sheets, Docs): Use tool-specific navigation (Name Box, keyboard shortcuts)
- Block editors (Notion): Click to place cursor in block, use slash commands for new blocks
- Card/board layouts (Trello, Jira): Use keyboard shortcuts for navigation, Enter to open cards
- Form-based apps (Todoist, Jira create): Tab between fields, use dropdowns via keyboard
- Grid apps (Airtable): Arrow keys to navigate cells, Enter to edit, Escape to exit

KEYBOARD-FIRST APPROACH:
- Always attempt keyboard shortcuts before clicking
- Most productivity apps have comprehensive shortcut coverage
- If shortcuts require opt-in (Google Calendar), enable them first
- Verify input focus before typing -- lost focus causes shortcut interception

MODAL/POPOVER TIMING:
- All apps use animated overlays (100-400ms render time)
- After triggering a modal, use waitForElement targeting [role="dialog"] or [role="menu"]
- Do NOT type into modals immediately -- wait for the animation to complete

CONTENTEDITABLE EDITORS:
- Notion, Jira, Airtable rich text fields use contenteditable
- Always click the target field first to establish focus
- Then type content -- keystrokes go to the focused element
- Press Escape to exit edit mode

AUTO-SAVE:
- Most productivity apps auto-save (Google suite, Notion, Airtable)
- Todoist and Trello save on action (Enter, click Save)
- Jira requires explicit Save/Update button clicks`,
  warnings: [
    'KEYBOARD FIRST: Always try keyboard shortcuts before clicking. Most productivity apps have comprehensive shortcut coverage.',
    'FOCUS VERIFICATION: Before typing, verify the correct input/field has focus. Lost focus causes keyboard shortcuts to fire instead of text input.',
    'MODAL TIMING: After opening a modal or popover, wait 200-400ms for animation to complete before interacting.',
    'CONTENTEDITABLE: For rich text editors (Notion, Jira), click the field first to focus, then type.',
    'AUTO-SAVE: Google suite and Notion auto-save. Todoist/Trello save on action. Jira requires explicit save.',
    'VIEW-ONLY: Check for edit/view mode toggles before attempting modifications.'
  ]
});
```

### Pattern 7: inferElementPurpose Generalization

The `inferElementPurpose()` function in dom-analysis.js (lines 276-284) currently only recognizes Sheets-specific fsbRoles (`document-body`, `document-title`, `formula-bar`, `name-box`). For new apps, fsbRole values like `create-button`, `search-bar`, `toolbar`, etc. will fall through to the generic return on line 284:

```javascript
return { role: 'editor-container', intent: 'edit', danger: false, sensitive: false, priority: 'medium' };
```

This is acceptable for v1 -- the element still gets priority: 'medium' and bypasses visibility checks. However, a more accurate classification could be added later. For now, no changes needed -- the generic fallback works.

### Anti-Patterns to Avoid
- **DO NOT add fsbElements without first generalizing Stage 1b** -- elements will be silently ignored
- **DO NOT use class-based selectors as primary strategy** for React apps (Notion, Airtable) -- hashed CSS changes on every deploy
- **DO NOT assume canvas-based rendering** for non-Google apps -- only Sheets/Docs use canvas
- **DO NOT duplicate google-sheets.js patterns** (Name Box, formula bar) in non-spreadsheet guides

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Multi-strategy selector lookup | Custom querySelector loops | `findElementByStrategies()` (line 1758) | Already handles ordered fallback with logging |
| Guide URL matching | Custom hostname checks | `registerSiteGuide({ patterns: [...] })` | Existing regex matching in `getGuideForUrl()` |
| Element visibility bypass | Custom visibility logic | `el.dataset.fsbRole` data attribute | Stage 2 already bypasses all checks for fsbRole elements |
| Guide loading/registration | Manual global variable management | `importScripts()` + `registerSiteGuide()` | Existing pattern across 50+ guides |
| Keyword task routing | Custom NLP parsing | `categoryKeywords` in index.js | Weighted matching with strong/weak keywords |

## Common Pitfalls

### Pitfall 1: fsbElements Injected But Never Used (CRITICAL)
**What goes wrong:** New guide defines fsbElements, but Stage 1b in dom-analysis.js ignores them because the injection is gated behind `isCanvasBasedEditor()` AND `/spreadsheets\/d\//`.
**Why it happens:** The fsbElements injection loop is nested inside a canvas-editor-specific code block.
**How to avoid:** Move fsbElements injection OUTSIDE the `isCanvasBasedEditor()` block. Verify by loading a non-Sheets page with a guide that has fsbElements and checking that `data-fsbRole` attributes appear in DOM.
**Warning signs:** Guide loads (guidance text appears in system prompt) but fsbElements don't appear in snapshot. No `[hint:...]` annotations for the new app.

### Pitfall 2: isCanvasBasedEditor Returns True for Calendar/Keep
**What goes wrong:** `isCanvasBasedEditor()` in messaging.js:217 returns `true` for ALL `docs.google.com` hostnames. Google Calendar uses `calendar.google.com` and Keep uses `keep.google.com` -- they will NOT match this check. This is actually fine -- the pitfall would be if someone tried to gate Calendar/Keep elements behind `isCanvasBasedEditor()`.
**How to avoid:** The fsbElements injection for new apps must NOT be inside the `isCanvasBasedEditor()` block.

### Pitfall 3: Sheets Health Check Regression
**What goes wrong:** After generalizing Stage 1b, the Sheets-specific health check (lines 2558-2608) might break or produce misleading results.
**How to avoid:** Keep the health check but make it site-aware. Use `guideSelectors?.fsbElements` presence to trigger a generic health check. Keep Sheets-specific checks (nameBox, formulaBar) conditional on Sheets URL.

### Pitfall 4: Todoist Single-Key Shortcut Interception
**What goes wrong:** Todoist has 20+ unmodified single-key shortcuts (Q=Quick Add, E=Edit, A=Add task below, M=Move). If the AI types text without focus on an input field, letters trigger shortcuts instead of text entry.
**How to avoid:** Every Todoist workflow that involves typing must include a focus verification step. The guide warnings must explicitly document this hazard.

### Pitfall 5: Selector Fragility on Notion/Airtable
**What goes wrong:** CSS class names change on every deploy due to CSS Modules hashing. Selectors like `.css-1ab2cd3` break within days.
**How to avoid:** Use aria/role-first selector ordering. For Notion, use `[data-block-id]`, `[role="textbox"]`, `[aria-label="..."]`. For Airtable, use `[role="gridcell"]`, `[aria-colindex]`, `[data-rowindex]`. Class selectors should be strategy 5 (last resort only).

### Pitfall 6: Options Page Missing Guide Script Tags
**What goes wrong:** Guides load in background.js (service worker) but not in options.html (settings UI), so the settings page shows an incomplete guide count.
**How to avoid:** Always add both importScripts in background.js AND script tags in ui/options.html for every new guide.

### Pitfall 7: Drag-and-Drop Feasibility
**What goes wrong:** CDP synthetic mouse events (`Input.dispatchMouseEvent`) do not trigger react-beautiful-dnd or similar libraries that use pointer capture and complex event sequences.
**Research finding:** `content/actions.js` uses `element.dispatchEvent(new MouseEvent('mousedown', ...))` at lines 148-149 and 1209-1210 for click simulation, but there is NO existing drag-and-drop implementation. The user explicitly wants drag-and-drop investigated and built.
**Approach options:**
1. **CDP Input.dispatchMouseEvent sequence:** mousedown at source coords -> multiple mousemove to destination -> mouseup at destination. This works for native HTML5 drag-and-drop but fails for libraries that use pointer events or custom drag implementations.
2. **Native DragEvent injection:** `new DragEvent('dragstart', { dataTransfer })` -> `dragover` -> `drop`. May work for some apps but `DataTransfer` constructor is restricted in some contexts.
3. **Page-level script injection:** Inject a script into the page context that directly calls the app's drag API. Most invasive but most reliable.
**Recommendation:** Build a drag-and-drop tool in actions.js that attempts CDP mouse event sequences first. If that fails on a specific app, the guide should document keyboard alternatives. The tool should be a mechanical action returning `{ success: boolean }`.

## Code Examples

### Example 1: Generalized fsbElements Injection (dom-analysis.js)

The refactored Stage 1b should look like:

```javascript
// Stage 1b: Inject canvas-based editor elements (Google Docs/Sheets specific)
if (FSB.isCanvasBasedEditor && FSB.isCanvasBasedEditor()) {
  const canvasEditorSelectors = [
    { selector: '.kix-page-column', role: 'document-body', label: 'Document body (canvas editor)' },
    { selector: '.kix-appview-editor', role: 'editor-container', label: 'Editor container' },
    { selector: '.docs-title-input', role: 'document-title', label: 'Document title field' }
  ];
  for (const { selector, role, label } of canvasEditorSelectors) {
    const el = document.querySelector(selector);
    if (el && !candidateArray.includes(el)) {
      el.dataset.fsbRole = role;
      el.dataset.fsbLabel = label;
      candidateArray.push(el);
    }
  }
}

// Stage 1c: Inject site guide fsbElements (generic -- works for ANY guide)
const fsbElements = guideSelectors?.fsbElements;
if (fsbElements) {
  const selectorMatches = {};
  for (const [role, def] of Object.entries(fsbElements)) {
    const result = findElementByStrategies(def);
    if (result) {
      const { element: el, matchedIndex, matchedStrategy, total } = result;
      el.dataset.fsbRole = role;
      el.dataset.fsbLabel = def.label;
      if (!candidateArray.includes(el)) {
        candidateArray.push(el);
      }
      selectorMatches[role] = `${def.selectors[matchedIndex].selector} [${matchedIndex + 1}/${total}]`;
    } else {
      selectorMatches[role] = 'NONE';
    }
  }

  // Generic injection logging
  const siteName = guideSelectors?._siteName || 'unknown';
  const fsbInjectedCount = candidateArray.filter(el => el.dataset.fsbRole).length;
  logger.logDOMOperation(FSB.sessionId, 'fsbElements_injection', {
    site: siteName,
    totalFsbElements: fsbInjectedCount,
    matchedCount: Object.values(selectorMatches).filter(v => v !== 'NONE').length,
    failedCount: Object.values(selectorMatches).filter(v => v === 'NONE').length,
    selectorMatches
  });
}
```

### Example 2: Minimal Guide (Google Keep -- simplest tier)

```javascript
registerSiteGuide({
  site: 'Google Keep',
  category: 'Productivity Tools',
  patterns: [
    /keep\.google\.com/i
  ],
  guidance: `GOOGLE KEEP-SPECIFIC INTELLIGENCE:

CREATE NOTE:
  # Open Keep and create a new note
  click e{N}          # "Take a note..." input area
  type "Note title"   # Type the title
  key "Enter"         # Move to note body
  type "Note content" # Type the body text
  # Click outside the note or press Escape to close and save

KEYBOARD SHORTCUTS:
  # Navigation
  J / K: Move between notes (next / previous)
  / : Search notes
  # Actions on selected note
  E: Archive selected note
  # (backspace): Delete selected note
  L: Add/change labels
  # Creation
  C: Create new note (when not editing)

...`,
  fsbElements: {
    // Keep may need minimal fsbElements -- 5-10 elements
    'new-note-input': {
      label: 'Take a note input area',
      selectors: [
        { strategy: 'aria', selector: '[aria-label="Take a note"]' },
        { strategy: 'role', selector: '[role="textbox"][aria-label*="note"]' },
        { strategy: 'class', selector: '.IZ65Hb-YPqjbf' },
        { strategy: 'context', selector: '.IZ65Hb-r4nke [contenteditable]' },
        { strategy: 'id', selector: '#gkeep-new-note' }
      ]
    }
    // ... more elements
  },
  // ... selectors, workflows, warnings
});
```

### Example 3: Guide with Weighted Keyword Matching

The `categoryKeywords` update pattern:
```javascript
'Productivity Tools': {
  strong: [
    'google sheets', 'google sheet', 'spreadsheet', 'google docs', 'google doc',
    'notion', 'google calendar', 'google keep', 'todoist', 'trello', 'jira', 'airtable'
  ],
  weak: [
    'sheets', 'sheet', 'create sheet', 'new sheet', 'add to sheet', 'enter data',
    'create document', 'new document', 'write document', 'share document', 'edit document',
    'calendar event', 'create event', 'schedule meeting', 'schedule',
    'note', 'create note', 'checklist', 'keep note',
    'task', 'create task', 'todo', 'add task', 'quick add',
    'card', 'create card', 'board', 'kanban',
    'issue', 'create issue', 'ticket', 'sprint', 'backlog', 'story points',
    'base', 'record', 'create record', 'grid view', 'table view',
    'page', 'create page', 'block', 'slash command', 'database view'
  ]
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Sheets-only fsbElements | Generic fsbElements for any guide | This phase | Unlocks all 7 new apps |
| Canvas-only shared guidance | Multi-paradigm shared guidance | This phase | Correct guidance for non-canvas apps |
| Sheets-only health check | Per-site health check | This phase | Validates pipeline for each app |

## Open Questions

1. **Drag-and-drop tool feasibility**
   - What we know: CDP `Input.dispatchMouseEvent` works for native HTML5 drag. Libraries like react-beautiful-dnd intercept and require pointer events. actions.js has mousedown/mouseup dispatch at lines 148-149 but no drag sequence.
   - What's unclear: Which of the 7 apps use react-beautiful-dnd vs native drag vs custom implementations. Whether pointer event sequences work for Trello/Jira/Calendar.
   - Recommendation: Build the tool as a best-effort mechanical action. Test against each app. Document keyboard alternatives in guides for apps where it fails. The user's directive is to investigate and build, not guarantee 100% coverage.

2. **Airtable rendering engine**
   - What we know: Research produced conflicting findings (canvas vs virtualized DOM).
   - What's unclear: Whether grid cells are true DOM elements or canvas-drawn.
   - Recommendation: Live DevTools inspection during implementation. If DOM-based, standard fsbElements work. If canvas, the guide must document keyboard-only navigation (like Sheets).

3. **Exact fsbElement selector values for all 7 apps**
   - What we know: Strategy ordering is defined (aria/role-first for React apps, data-testid first for Atlassian apps). Reference patterns from google-sheets.js.
   - What's unclear: Exact selector strings -- these require live DevTools inspection per app.
   - Recommendation: Each guide's fsbElements will contain placeholder selectors during initial implementation, refined via live inspection. The 5-strategy pattern ensures resilience.

4. **Background.js guideSelectors._siteName**
   - What we know: Line 8483 constructs `iterationGuideSelectors = { ...guide.selectors, fsbElements: guide.fsbElements }`. It does NOT pass the site name.
   - Recommendation: Add `_siteName: guide.site` to the spread so logging can identify which guide's fsbElements are being injected.

## Build Order

Based on dependency analysis and complexity:

### Wave 1: Infrastructure (INFRA-01, INFRA-02, INFRA-03)
1. Generalize dom-analysis.js Stage 1b (move fsbElements injection out of isCanvasBasedEditor block, remove URL gate)
2. Generalize logging blocks (3 Sheets-specific URL checks)
3. Generalize health check
4. Update index.js categoryKeywords
5. Rewrite _shared.js
6. Verify Google Sheets still works (regression test)

### Wave 2: Simple Apps (KEEP-01/02, TODO-01/02)
7. Add 2 importScripts + 2 script tags (background.js, options.html)
8. Create google-keep.js
9. Create todoist.js
10. Verify fsbElements appear in DOM snapshots for both apps

### Wave 3: Medium Apps (TREL-01/02, GCAL-01/02)
11. Add 2 importScripts + 2 script tags
12. Create trello.js
13. Create google-calendar.js
14. Verify modal/popover workflows

### Wave 4: Complex Apps (NOTN-01/02, JIRA-01/02, ATBL-01/02)
15. Add 3 importScripts + 3 script tags
16. Create notion.js
17. Create jira.js
18. Create airtable.js

### Wave 5: Drag-and-Drop Tool (cross-cutting)
19. Build drag-and-drop mechanical action in content/actions.js
20. Test against Trello, Calendar, Airtable
21. Update guides with drag tool usage or keyboard fallbacks

## Sources

### Primary (HIGH confidence)
- `content/dom-analysis.js` lines 1758-1870, 1876, 1901-1918, 2540-2608: Stage 1b injection, visibility bypass, logging, health check -- all read directly
- `content/messaging.js` line 217: `isCanvasBasedEditor()` definition -- gates on `docs.google.com` hostname
- `site-guides/index.js` lines 155-232: categoryKeywords structure, weighted matching logic
- `site-guides/productivity/google-sheets.js` lines 1-585: Complete reference implementation -- fsbElements, guidance, workflows, warnings, selectors, toolPreferences
- `site-guides/productivity/google-docs.js`: Comparison guide without fsbElements
- `site-guides/productivity/_shared.js`: Current canvas-only shared guidance
- `background.js` lines 16-132, 8476-8488: importScripts loading, guideSelectors resolution
- `ui/options.html` lines 1257-1309: Script tag loading pattern
- `content/actions.js` lines 148-149, 1209-1210: mousedown/mouseup dispatch (no drag implementation)
- `manifest.json`: No content_scripts for site guides -- they load in service worker only

### Secondary (MEDIUM confidence)
- Research SUMMARY.md: Complexity tier assessment, pitfall enumeration, keyboard shortcut verification

### Tertiary (LOW confidence -- needs live validation)
- Exact fsbElement selector values for all 7 apps (require DevTools inspection)
- Drag-and-drop tool effectiveness per app (requires testing)
- Airtable rendering engine determination (conflicting sources)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- zero new dependencies, verified by codebase reading
- Architecture: HIGH -- exact line numbers for all changes, complete pattern analysis
- Infrastructure changes: HIGH -- read all relevant code paths, understand the 3-gate problem
- Guide template: HIGH -- derived directly from 585-line google-sheets.js reference
- Pitfalls: MEDIUM-HIGH -- infrastructure pitfalls verified, per-app DOM pitfalls need live inspection
- Drag-and-drop: LOW -- feasibility unverified, requires prototyping

**Research date:** 2026-03-16
**Valid until:** 2026-04-16 (stable codebase, no external dependencies)
