# Architecture Patterns

**Domain:** Productivity Site Intelligence for Browser Automation Extension
**Researched:** 2026-03-16
**Confidence:** HIGH (based on thorough codebase analysis of existing patterns)

## Executive Summary

The 7 target apps (Notion, Google Calendar, Trello, Google Keep, Todoist, Airtable, Jira) integrate with FSB's existing site guide architecture with **no structural changes** to the registry, guide format, or loading pipeline. The core architectural question is whether Stage 1b injection (currently gated behind `isCanvasBasedEditor()`) needs to be generalized for non-canvas complex apps -- it does, but the change is surgical. Three of the 7 apps need fsbElements (Notion, Airtable, Google Calendar), four work primarily through standard DOM + keyboard shortcuts, and none require new mechanical tools comparable to fillsheet/readsheet.

## Recommended Architecture

### Category Organization: All 7 Stay in `productivity/`

All 7 apps belong in `site-guides/productivity/` under the existing `Productivity Tools` category. No new categories needed.

**Rationale:** The existing category taxonomy groups by user intent (shopping, coding, finance). All 7 apps serve the same intent -- task/content management and organization. Splitting into subcategories (e.g., "Project Management" for Trello/Jira, "Notes" for Notion/Keep) would fragment keyword matching in `getGuideForTask()` and add complexity without benefit. The `_shared.js` guidance needs updating to cover non-canvas productivity apps, but the category itself is correct.

### App Classification by DOM Complexity

The 7 apps fall into 3 tiers based on how much they diverge from standard DOM patterns:

| Tier | Apps | DOM Type | fsbElements Needed | Keyboard-First |
|------|------|----------|-------------------|----------------|
| **Tier 1: Complex non-standard** | Notion, Airtable, Google Calendar | Block editor / Canvas grid / Custom time grid | YES (10-20 each) | YES |
| **Tier 2: SPA with overlays** | Trello, Jira | React SPA, modals, boards | MINIMAL (3-5 each) | MODERATE |
| **Tier 3: Straightforward SPA** | Google Keep, Todoist | Standard DOM with card/list UI | NO | YES |

### Component Boundaries

| Component | Responsibility | Modification Needed |
|-----------|---------------|---------------------|
| `site-guides/index.js` | Registry, URL matching, keyword matching | Update `categoryKeywords['Productivity Tools']` with new strong/weak keywords |
| `site-guides/productivity/_shared.js` | Category-level guidance | Rewrite to cover both canvas and non-canvas app patterns |
| `site-guides/productivity/{app}.js` | Per-app guide (7 new files) | NEW FILES -- guidance, fsbElements, selectors, workflows, warnings |
| `content/dom-analysis.js` | Stage 1b injection, element scoring | Generalize Stage 1b gate from `isCanvasBasedEditor()` to fsbElements-aware |
| `content/messaging.js` | `isCanvasBasedEditor()` detection | NO CHANGE -- keep as-is for Google Docs/Sheets |
| `content/actions.js` | Action execution, type handler | NO CHANGE -- existing contenteditable handling covers Notion/Airtable |
| `background.js` | importScripts, completion validator | Add 7 importScripts lines; optionally update `isCanvasEditorUrl()` |
| `ui/options.html` | Script loading for site guides viewer | Add 7 script tags |

### Data Flow

```
User visits notion.so
    |
    v
getGuideForUrl(url) --> matches /notion\.so/i pattern
    |
    v
Returns notion.js guide with fsbElements, selectors, workflows
    |
    v
getFilteredElements() -- Stage 1b:
    IF guide has fsbElements (NEW CONDITION -- not just isCanvasBasedEditor)
        findElementByStrategies() for each fsbElement
        Inject into candidateArray with data-fsbRole/data-fsbLabel
    |
    v
Stage 2 (visibility) -- fsbRole elements bypass visibility check (existing)
    |
    v
Stage 3 (scoring) -- fsbRole elements get score boost (existing)
    |
    v
Markdown snapshot includes fsbElements with [hint:] annotations
    |
    v
AI receives guidance + annotated snapshot, uses keyboard shortcuts
```

## Critical Architecture Change: Stage 1b Generalization

### Current State (Problem)

Stage 1b injection in `dom-analysis.js` is gated behind two conditions:
1. `FSB.isCanvasBasedEditor()` must return true (only for docs.google.com)
2. For fsbElements specifically: `/spreadsheets\/d\//.test(window.location.pathname)` (only for Sheets)

This means fsbElements defined in a Notion or Airtable guide will **never be injected** into the candidate array. The multi-strategy lookup code (`findElementByStrategies()`) exists and is generic, but it is unreachable for non-Google sites.

### Required Change

Replace the Sheets-specific pathname check with a guide-aware check:

```
BEFORE (dom-analysis.js ~line 1794):
    if (FSB.isCanvasBasedEditor && FSB.isCanvasBasedEditor()) {
        // hardcoded canvas editor selectors
        // ...
        if (/spreadsheets\/d\//.test(window.location.pathname)) {
            const fsbElements = guideSelectors?.fsbElements;
            // multi-strategy lookup
        }
    }

AFTER:
    // Canvas editor hardcoded selectors (Google Docs/Sheets baseline)
    if (FSB.isCanvasBasedEditor && FSB.isCanvasBasedEditor()) {
        // existing .kix-page-column, .kix-appview-editor, .docs-title-input injection
    }

    // Guide-driven fsbElements injection (works for ANY site with fsbElements)
    const fsbElements = guideSelectors?.fsbElements;
    if (fsbElements && Object.keys(fsbElements).length > 0) {
        for (const [role, def] of Object.entries(fsbElements)) {
            const result = findElementByStrategies(def);
            if (result) {
                const { element: el, matchedIndex, matchedStrategy, total } = result;
                el.dataset.fsbRole = role;
                el.dataset.fsbLabel = def.label;
                if (!candidateArray.includes(el)) {
                    candidateArray.push(el);
                }
                // logging...
            }
        }
    }
```

**Impact:** This is a ~30 line refactor that unlocks fsbElements for all 7 new apps (and any future guides). The existing Sheets fallback path remains for backward compatibility. The `findElementByStrategies()` function, visibility bypass (`if (el.dataset.fsbRole) return true`), scoring boost, and snapshot annotation all work unchanged because they key off `data-fsbRole`, not the canvas editor check.

### What Does NOT Need Changing

- **`isCanvasBasedEditor()`** -- Keep this function as-is. It correctly identifies Google Docs/Sheets for CDP keyboard routing. Notion/Airtable/etc. do NOT need CDP keyboard routing because they use standard contenteditable/input elements.
- **`isCanvasEditorUrl()`** in background.js -- Keep as-is. Only Google Docs/Sheets need the canvas editor progress tracking bypass.
- **`fillsheet`/`readsheet` guards** -- Keep `isCanvasBasedEditor()` guard. These mechanical tools are Sheets-specific.
- **Type action canvas path** -- The `canvasEditor` branch in the type handler routes to CDP `Input.insertText` or `typeWithKeys`. Notion/Airtable/etc. use the standard contenteditable path which already works (line 1596-1601 in actions.js detects `contentEditable`, `role="textbox"`, etc.).

## Per-App Integration Architecture

### 1. Notion (notion.so)

**DOM Characteristics:**
- React SPA with contenteditable block elements
- Each block has `data-block-id` attribute
- Slash command menu renders as a dropdown overlay
- Database views use virtualized rendering (only visible rows in DOM)
- Page content wrapper: `.notion-page-content`
- Sidebar: `.notion-sidebar`
- Topbar: `.notion-topbar`

**fsbElements (estimated 12-15):**
- `page-content`: Main content area (`.notion-page-content`, `[contenteditable="true"]` child)
- `page-title`: Page title input (`.notion-page-block [placeholder]`)
- `sidebar-toggle`: Sidebar toggle button
- `new-page-button`: Create new page
- `search-input`: Quick search (`Cmd+K` triggered overlay)
- `slash-menu`: Slash command menu (appears on `/`)
- `database-add-row`: Add row button in database views
- `database-filter`: Filter button in database toolbar
- `database-sort`: Sort button in database toolbar
- `breadcrumb-nav`: Breadcrumb navigation at top

**Keyboard-First Strategy:**
- `Cmd+N` / `Ctrl+N`: New page
- `Cmd+K` / `Ctrl+K`: Quick search / page link
- `/` at line start: Slash command menu (critical -- this is primary block creation)
- `Tab` / `Shift+Tab`: Indent/outdent blocks
- `Cmd+Shift+M` / `Ctrl+Shift+M`: Comment
- `Cmd+D` / `Ctrl+D`: Duplicate block
- Arrow keys: Navigate between blocks
- `Enter`: New block below
- `Backspace` at empty block: Delete block, merge with above

**Automation Challenges:**
- Block IDs change on every page load -- cannot use `data-block-id` for stable selectors
- Slash command menu is a floating overlay that mounts/unmounts dynamically
- Database views virtualize rows -- only visible rows are in DOM
- Notion's React reconciliation may not reflect typed text immediately in DOM

**Typing Approach:** Standard contenteditable -- existing FSB type handler works (line 1596 detects `contentEditable`). No CDP keyboard bypass needed.

**No Mechanical Tools Needed:** Notion's block editor accepts standard typing. Slash commands handle block creation naturally.

### 2. Google Calendar (calendar.google.com)

**DOM Characteristics:**
- NOT canvas-rendered (unlike Sheets/Docs). Uses standard DOM with CSS grid for time slots
- Events render as positioned divs with `data-eventid` and `data-eventchip` attributes
- Time grid uses `role="grid"` / `role="gridcell"` ARIA attributes
- Event creation popover: `[data-eventid]` overlay or full-page edit form
- Date cells: `[data-datekey]` attributes
- Mini calendar (sidebar): standard buttons with `aria-label` containing date strings

**fsbElements (estimated 10-12):**
- `create-event-button`: FAB or "Create" button (`[aria-label="Create"]`, `[data-tooltip="Create"]`)
- `event-title-input`: Title input in event creation form
- `event-date-start`: Start date picker
- `event-date-end`: End date picker
- `event-time-start`: Start time picker
- `event-time-end`: End time picker
- `event-save-button`: Save button in event form
- `search-bar`: Calendar search input
- `view-switcher`: Day/Week/Month/Agenda view buttons
- `mini-calendar`: Date navigation sidebar
- `today-button`: "Today" button to jump to current date

**Keyboard-First Strategy:**
- `c`: Create new event (critical -- primary entry point)
- `e`: Edit selected event
- `s` or `Ctrl+S`: Save event
- `1`/`2`/`3`/`4`: Switch to Day/Week/Month/Year view
- `t`: Jump to today
- `j`/`k` or arrow keys: Navigate between dates
- `Delete` / `Backspace`: Delete selected event
- `/`: Open search

**Automation Challenges:**
- Event time slots are positioned divs, not actual grid cells -- clicking at specific Y positions within a day column targets specific times
- Date/time pickers are custom widgets (not native `<input type="date">`)
- The event creation form can be a quick popover OR a full-page detail editor
- View state (day/week/month) changes the entire DOM structure

**Typing Approach:** Standard inputs and contenteditable fields. No canvas bypass needed.

**No Mechanical Tools Needed:** `c` to create event, then fill standard form fields.

### 3. Trello (trello.com)

**DOM Characteristics:**
- React SPA with dynamic lists and cards
- Board layout: `.board-main-content` with list containers
- Cards: `[data-testid="trello-card"]` or `.list-card`
- Card modals: overlay dialog with form inputs
- Drag-and-drop uses visual position, not DOM order manipulation

**fsbElements (estimated 3-5):**
- `add-card-button`: "Add a card" link at bottom of each list
- `card-title-input`: Card title textarea (in compose mode)
- `card-modal-title`: Title input in opened card modal
- `board-menu-button`: Board menu trigger
- `search-input`: Board search

**Keyboard-First Strategy:**
- `n`: New card (hover-based -- adds card below hovered card)
- `j`/`k`: Navigate between cards
- `<`/`>`: Move card between lists
- `t`: Edit card title (when card is selected)
- `e`: Quick edit card (opens inline edit)
- `Enter`: Open selected card
- `Esc`: Close dialog/modal

**Automation Challenges:**
- `n` shortcut is hover-position dependent -- must hover correct list first
- Card modals are overlay portals (React portals) -- not in the DOM tree of the board
- Drag-and-drop is visual, not keyboard-addressable for positioning
- List/card order changes via AJAX, not page reload

**Typing Approach:** Standard inputs and textareas. No special handling needed.

**No Mechanical Tools Needed.**

### 4. Google Keep (keep.google.com)

**DOM Characteristics:**
- Standard DOM with masonry card grid layout
- Notes rendered as cards with `role="listitem"` or `[data-id]`
- Note editor: contenteditable for title and body
- Checklist items: checkbox inputs within note cards
- Color picker: palette of color buttons
- Labels: dropdown with checkboxes

**fsbElements: NONE needed.**
- All elements are standard DOM (buttons, inputs, contenteditable)
- Masonry grid is CSS-based, not canvas
- No virtualization -- all visible notes are in DOM

**Keyboard-First Strategy:**
- `c`: Create new note (critical -- must close any open note first)
- `l`: Create new list (checklist note)
- `j`/`k`: Navigate between notes
- `Esc`: Close/save note
- `e`: Archive note
- `/`: Search

**Automation Challenges:**
- Creating a note requires no other note to be open (the `c` shortcut only works when no note is focused)
- Notes auto-save on blur -- no explicit save needed
- Color picker requires clicking the palette icon then a color swatch
- PIN/Unpin is a toggle button on hover

**Typing Approach:** Contenteditable (already handled by existing type action code). The existing `inferElementPurpose` function at line 287-294 already matches contenteditable editors on any site.

**No Mechanical Tools Needed.** Simplest of the 7 apps.

### 5. Todoist (todoist.com / app.todoist.com)

**DOM Characteristics:**
- React SPA with project/task list views
- Tasks rendered as list items with custom components
- Quick Add overlay: floating modal for task creation
- Inline editing: contenteditable task names
- Date picker: custom popover calendar widget
- Priority selector: colored flag icons (p1-p4)

**fsbElements: NONE needed (or minimal 2-3).**
- Quick Add dialog is triggered by `q` shortcut, contains standard input
- Task items are clickable list elements
- Possible fsbElements for priority/date pickers if selectors are unstable

**Keyboard-First Strategy:**
- `q`: Open Quick Add (critical -- primary task creation)
- `a`: Add task to bottom of list
- `Shift+A`: Add task to top of list
- `Ctrl+K` / `Cmd+K`: Command menu (powerful -- search, navigate, actions)
- `Enter`: Save task (in edit mode)
- `Esc`: Cancel edit
- `1`-`4`: Set priority (in task context)

**Automation Challenges:**
- Quick Add uses natural language parsing (e.g., "Buy groceries tomorrow p1 #Shopping") -- the AI should use this
- Date picker is a custom widget, but natural language in Quick Add bypasses it
- Projects/labels are typed directly into Quick Add with `#` and `@` prefixes
- The command menu (`Ctrl+K`) provides another automation path

**Typing Approach:** Standard inputs and contenteditable. No special handling.

**No Mechanical Tools Needed.** Quick Add natural language is the optimal automation path.

### 6. Airtable (airtable.com)

**DOM Characteristics:**
- Grid view: **Canvas-rendered cells** (similar to Google Sheets)
- Row headers and column headers are DOM elements
- Cell editing: clicking a cell opens an inline editor overlay (standard input/textarea)
- Expanded record modal: standard form fields
- Rich field types: attachments, linked records, single/multi select dropdowns
- Virtual scrolling: only visible rows are in DOM

**fsbElements (estimated 12-18):**
- `grid-container`: Main grid area
- `add-row-button`: "+" button to add new row
- `add-field-button`: "+" button to add new column/field
- `cell-editor`: Active cell edit overlay
- `expand-record-button`: Expand row button
- `search-bar`: Grid search input
- `filter-button`: Filter controls
- `sort-button`: Sort controls
- `group-button`: Grouping controls
- `view-switcher`: Grid/Kanban/Calendar/Form view tabs
- `field-config-modal`: Field type configuration
- `record-title`: Primary field in expanded record

**Keyboard-First Strategy:**
- `Space`: Expand selected record (critical -- opens full record modal)
- `Shift+Space`: Expand individual cell
- `Tab` / `Shift+Tab`: Move between cells in a row
- `Arrow keys`: Navigate grid cells
- `Enter`: Begin editing selected cell / Move to next row
- `Esc`: Cancel cell edit / Close modal
- `Ctrl+/` / `Cmd+/`: Show shortcuts
- `Shift+Enter`: Add new record below

**Automation Challenges:**
- **Grid is canvas-rendered** -- individual cells are NOT in the DOM (like Google Sheets)
- Cell editing opens an overlay input, but navigation to specific cells must use keyboard (arrow keys, Tab)
- Rich field types (linked records, attachments) have complex custom editors
- No equivalent of Sheets' Name Box -- cannot jump to a specific cell by reference
- Virtual scrolling means off-screen rows are not in DOM

**Typing Approach:** Cell editor overlays are standard inputs/contenteditable. But navigating TO the correct cell requires keyboard arrows + Tab, not clicking (because the grid is canvas).

**Potential Mechanical Tool:** A `fillairtable` tool COULD be valuable for bulk data entry (navigate by arrow keys + enter data + Tab pattern), but this is a **future optimization**, not a launch requirement. For v0.9.2, keyboard-first guidance with fsbElements for the toolbar is sufficient.

### 7. Jira (atlassian.net)

**DOM Characteristics:**
- React SPA built on Atlassian Design System (Atlaskit)
- Board view: Kanban columns with draggable issue cards
- Issue creation: Modal dialog with form fields
- Sprint planning: Drag between sprints
- Backlog: Sortable list with inline editing
- Rich text: Atlassian editor (ProseMirror-based contenteditable)

**fsbElements (estimated 5-8):**
- `create-issue-button`: "Create" button in top nav (or `c` shortcut)
- `issue-summary-input`: Summary/title field in create modal
- `issue-type-select`: Issue type dropdown (Bug, Story, Task, Epic)
- `issue-priority-select`: Priority dropdown
- `issue-assignee-select`: Assignee people picker
- `board-search`: Board/backlog search
- `sprint-selector`: Active sprint filter
- `issue-description`: Rich text editor for description (ProseMirror)

**Keyboard-First Strategy:**
- `c`: Create issue (critical -- opens create modal)
- `j`/`k`: Navigate between issues
- `/`: Search
- `1`/`2`/`3`: Switch to Backlog/Board/Reports
- `n`/`p`: Next/Previous column (board view)
- `Enter`: Open selected issue
- `?`: Show all shortcuts

**Automation Challenges:**
- Jira Cloud has frequent DOM structure changes (Atlassian's own warning)
- ProseMirror-based description editor requires special handling for rich text
- Issue types, priorities, and workflows are project-configurable -- cannot hardcode exact values
- Sprint board drag-and-drop is the primary issue movement mechanism
- Atlassian's design system changes class names between releases

**Typing Approach:** Standard inputs for summary. ProseMirror contenteditable for description (FSB's existing contenteditable detection handles this). The check at dom-analysis.js line 291 already matches `ProseMirror` class: `/editor|page|content|body|compose|write|kix|ql-editor|ProseMirror/i`.

**No Mechanical Tools Needed.**

## Patterns to Follow

### Pattern 1: Keyboard-First Guidance Over Selector-Heavy Automation

**What:** For all 7 apps, the primary guidance strategy should be keyboard shortcuts + natural flow, with fsbElements providing fallback anchor points. Do NOT try to click on every UI element via selectors.

**When:** Always -- this is the core lesson from Google Sheets (Name Box + keyboard beats clicking cells).

**Example (Notion):**
```javascript
guidance: `NOTION-SPECIFIC INTELLIGENCE:

CREATE NEW BLOCK:
  # Preferred: slash command from keyboard
  key "Enter"         # new line
  type "/"            # opens slash menu
  type "heading 1"    # filter slash menu
  key "Enter"         # select block type
  type "My heading"   # type content

  # Fallback: click approach
  click e5            # click in content area
  type "/" ...        # same slash menu flow
`
```

### Pattern 2: fsbElements for Toolbar/Navigation Anchors Only

**What:** Use fsbElements for elements that are always present and structurally important (toolbars, search bars, navigation), NOT for content elements that change per page state.

**When:** For Tier 1 and Tier 2 apps that have complex, non-standard toolbars.

**Example (Google Calendar):**
```javascript
fsbElements: {
  // YES -- always present, structurally stable
  'create-event': {
    label: 'Create event button',
    selectors: [
      { strategy: 'aria', selector: '[aria-label="Create"]' },
      { strategy: 'data', selector: '[data-tooltip="Create"]' },
      { strategy: 'role', selector: '[role="button"][data-view="event"]' }
    ]
  },
  // NO -- do not define fsbElements for individual events, time slots, etc.
}
```

### Pattern 3: Multi-Strategy Selectors with Aria-First Priority

**What:** For every fsbElement, define 3-5 selectors in priority order: `aria` > `role` > `data-*` > `class` > `context`. Aria and role selectors survive framework upgrades better than class names.

**When:** For all fsbElement definitions in React/SPA apps.

**Rationale:** Google Sheets uses `id` as first strategy because Sheets has stable IDs. React apps (Notion, Trello, Jira, Todoist) typically do NOT have stable IDs. Aria labels are the most stable selectors for React SPAs because they are accessibility-driven and change less frequently than class names.

### Pattern 4: Workflow Step Sequences for Complex Operations

**What:** Define `workflows` for multi-step operations that the AI cannot easily infer from the DOM alone.

**When:** For operations involving overlays, multiple form fields, or specific execution order.

**Example (Jira issue creation):**
```javascript
workflows: {
  createIssue: [
    'Press "c" to open the Create Issue dialog (or click the Create button)',
    'Wait for the modal to fully load',
    'Select the Issue Type from the dropdown (default is usually "Task")',
    'Type the issue summary in the Summary field',
    'Optionally set Priority, Assignee, Sprint from respective dropdowns',
    'For description, click the description editor and type content',
    'Click "Create" button to save, or press Cmd+Enter'
  ]
}
```

## Anti-Patterns to Avoid

### Anti-Pattern 1: Extending `isCanvasBasedEditor()` for Non-Canvas Apps

**What:** Adding Notion/Trello/Jira/etc. to `isCanvasBasedEditor()`.
**Why bad:** This function gates CDP keyboard bypass and canvas-specific type handling. Notion et al. use standard contenteditable -- they do NOT need CDP bypass. Adding them would route their typing through the wrong code path (keyboard emulator instead of standard focus+insertText).
**Instead:** Generalize Stage 1b to check for guide fsbElements presence, independent of canvas detection.

### Anti-Pattern 2: Creating Mechanical Tools for Every App

**What:** Building `fillnotion`, `filltrello`, `fillcalendar` equivalents.
**Why bad:** `fillsheet`/`readsheet` exist because Sheets has a fundamentally un-automatable canvas grid that requires deterministic cell-by-cell navigation. The other 7 apps have standard DOM inputs (even Airtable's cell editor opens as a standard input overlay). The AI can fill forms normally.
**Instead:** Rely on keyboard-first guidance + standard type/click actions. Revisit mechanical tools only if real-world testing reveals specific patterns that fail repeatedly.

### Anti-Pattern 3: Hardcoding App-Specific Branches in dom-analysis.js

**What:** Adding `if (window.location.hostname === 'notion.so') { ... }` checks.
**Why bad:** The Google Sheets-specific pathname check (`/spreadsheets\/d\/`) is already technical debt. Every new app should not add another hostname branch.
**Instead:** The Stage 1b generalization (check for `guideSelectors?.fsbElements` presence) handles all apps uniformly. App-specific behavior lives in the guide files, not in core infrastructure.

### Anti-Pattern 4: Over-Defining fsbElements for Simple Apps

**What:** Defining 20+ fsbElements for Google Keep or Todoist.
**Why bad:** These apps have standard DOM that FSB's Stage 1 (interactive element query selector) already captures. Adding fsbElements for standard buttons/inputs just duplicates what the generic element collector finds.
**Instead:** Only define fsbElements for elements that Stage 1 misses or mis-identifies. Keep and Todoist need zero or near-zero fsbElements. Their guides are primarily guidance + workflows + warnings.

## Scalability Considerations

| Concern | At 7 apps (v0.9.2) | At 20+ apps (future) | Mitigation |
|---------|-------------------|--------------------|-----------|
| Script tag count | 60 tags (53 + 7) | 70+ tags | Known tech debt. Bundling deferred. Acceptable for now. |
| Stage 1b performance | 7 apps x ~10 fsbElements = negligible | 200+ fsbElements across all guides | fsbElements only looked up when guide matches URL -- max ~20 per page |
| Registry size | ~50 guides | 100+ guides | `getGuideForUrl()` is O(n) pattern test -- fast enough at 200 |
| Keyword matching | Add 7 app names to Productivity strong/weak lists | Growing keyword lists | Weighted matching already handles disambiguation |
| Background.js size | 7 new importScripts lines | More lines | Acceptable. Service worker loads all at startup regardless. |

## Integration Summary: What to Build vs What to Modify

### New Files (7)

| File | fsbElements | Workflows | Complexity |
|------|-------------|-----------|-----------|
| `site-guides/productivity/notion.js` | 12-15 | 5-7 | HIGH -- block editor, databases |
| `site-guides/productivity/google-calendar.js` | 10-12 | 4-6 | MEDIUM -- event CRUD, view nav |
| `site-guides/productivity/trello.js` | 3-5 | 3-5 | MEDIUM -- board/card/modal |
| `site-guides/productivity/google-keep.js` | 0 | 3-4 | LOW -- standard DOM |
| `site-guides/productivity/todoist.js` | 0-3 | 3-5 | LOW-MEDIUM -- Quick Add + natural language |
| `site-guides/productivity/airtable.js` | 12-18 | 5-7 | HIGH -- canvas grid, rich fields |
| `site-guides/productivity/jira.js` | 5-8 | 4-6 | MEDIUM -- modal forms, ProseMirror |

### Modified Files (5)

| File | Change | Risk |
|------|--------|------|
| `content/dom-analysis.js` | Generalize Stage 1b fsbElements gate | LOW -- additive, existing Sheets path preserved |
| `site-guides/productivity/_shared.js` | Update category guidance for non-canvas apps | LOW -- text-only change |
| `site-guides/index.js` | Update Productivity keyword lists | LOW -- add new strong/weak keywords |
| `background.js` | Add 7 importScripts lines | ZERO -- mechanical addition |
| `ui/options.html` | Add 7 script tags | ZERO -- mechanical addition |

### Unchanged (everything else)

- `content/actions.js` -- no changes needed
- `content/messaging.js` -- no changes needed
- `content/accessibility.js` -- no changes needed
- `ai/cli-parser.js` -- no changes needed
- All existing site guides -- no changes needed

## Suggested Build Order (Dependency-Driven)

### Phase 0: Infrastructure (must come first)
1. Stage 1b generalization in `dom-analysis.js`
2. `_shared.js` rewrite for category guidance
3. `index.js` keyword list updates
4. `background.js` and `options.html` script registration

### Phase 1: Lowest complexity, validate pattern (2 apps)
5. Google Keep guide (simplest -- validates guide-only approach)
6. Todoist guide (simple with Quick Add natural language)

### Phase 2: Medium complexity (2 apps)
7. Trello guide (SPA with modals, minimal fsbElements)
8. Google Calendar guide (non-canvas time grid, moderate fsbElements)

### Phase 3: Highest complexity (3 apps)
9. Jira guide (ProseMirror editor, configurable workflows)
10. Notion guide (block editor, slash commands, databases)
11. Airtable guide (canvas grid, rich field types, virtual scrolling)

**Ordering rationale:**
- Phase 0 is prerequisite for any guide with fsbElements
- Phase 1 validates the pattern works without fsbElements (low risk)
- Phase 2 adds moderate fsbElements, validating the Stage 1b generalization
- Phase 3 tackles the most complex apps after the pattern is proven
- Notion and Airtable are last because they have the most unknowns (block editor semantics, canvas grid navigation)

## `_shared.js` Rewrite Recommendation

The current `_shared.js` is canvas-centric (Google Docs/Sheets). Needs to be rewritten to cover three paradigms:

```
PRODUCTIVITY TOOLS INTELLIGENCE:

CANVAS-BASED APPLICATIONS (Google Sheets, Google Docs, Airtable grid):
  [existing canvas guidance]

BLOCK EDITORS (Notion):
  - Content is organized in blocks. Each block is a separate element.
  - Use slash commands (type "/" at an empty line) to create new block types.
  - Arrow keys navigate between blocks. Tab indents/outdents.
  - Databases use virtual rendering -- only visible rows are in the DOM.

KEYBOARD-FIRST APPS (Google Calendar, Trello, Jira, Todoist, Google Keep):
  - Most actions are triggered by single-key shortcuts (c, n, q, etc.)
  - Keyboard shortcuts MUST be enabled in the app settings (especially Google Calendar)
  - Modals/overlays contain standard form fields -- use click + type normally
  - Auto-save is common -- explicit save is rarely needed

COMMON PATTERNS:
  - Esc: Close modal/cancel edit (universal)
  - Enter: Confirm/save (context-dependent)
  - /: Search (many apps)
  - j/k: Navigate items (Gmail-style pattern used by Calendar, Trello, Jira, Keep)
```

## `index.js` Keyword Update

Current Productivity Tools keyword config:
```javascript
'Productivity Tools': {
  strong: ['google sheets', 'google sheet', 'spreadsheet', 'google docs', 'google doc'],
  weak: ['sheets', 'sheet', 'create sheet', 'new sheet', 'add to sheet', 'enter data',
         'create document', 'new document', 'write document', 'share document', 'edit document']
}
```

Recommended additions:
```javascript
'Productivity Tools': {
  strong: [
    'google sheets', 'google sheet', 'spreadsheet', 'google docs', 'google doc',
    'notion', 'google calendar', 'trello', 'google keep', 'todoist', 'airtable', 'jira'
  ],
  weak: [
    'sheets', 'sheet', 'create sheet', 'new sheet', 'add to sheet', 'enter data',
    'create document', 'new document', 'write document', 'share document', 'edit document',
    'calendar', 'event', 'schedule', 'meeting', 'appointment',
    'board', 'card', 'kanban', 'trello board',
    'note', 'keep note', 'checklist', 'sticky note',
    'task', 'todo', 'to-do', 'project', 'due date', 'reminder',
    'base', 'table', 'record', 'field', 'view',
    'issue', 'sprint', 'backlog', 'epic', 'story', 'bug report'
  ]
}
```

## Sources

- FSB codebase analysis: `content/dom-analysis.js` (Stage 1b pipeline, lines 1758-1870), `content/actions.js` (type handler lines 1590-1710, fillsheet lines 3766-3990), `content/messaging.js` (isCanvasBasedEditor lines 217-225), `site-guides/index.js` (registry, keyword matching), `site-guides/productivity/google-sheets.js` (fsbElements pattern), `site-guides/productivity/google-docs.js` (canvas guide pattern), `background.js` (importScripts lines 16-132, isCanvasEditorUrl line 9933)
- [Notion Keyboard Shortcuts](https://www.notion.com/help/keyboard-shortcuts) -- official Notion Help Center (HIGH confidence)
- [Notion Slash Commands](https://www.notion.com/help/guides/using-slash-commands) -- official Notion Help Center (HIGH confidence)
- [Google Calendar Keyboard Shortcuts](https://support.google.com/calendar/answer/37034) -- official Google Support (HIGH confidence)
- [Trello Keyboard Shortcuts](https://support.atlassian.com/trello/docs/keyboard-shortcuts-in-trello/) -- official Atlassian Support (HIGH confidence)
- [Todoist Keyboard Shortcuts](https://www.todoist.com/help/articles/use-keyboard-shortcuts-in-todoist-Wyovn2) -- official Todoist Help (HIGH confidence)
- [Todoist Quick Add](https://www.todoist.com/help/articles/use-task-quick-add-in-todoist-va4Lhpzz) -- official Todoist Help (HIGH confidence)
- [Airtable Keyboard Shortcuts](https://support.airtable.com/docs/airtable-keyboard-shortcuts) -- official Airtable Support (HIGH confidence)
- [Jira Keyboard Shortcuts](https://support.atlassian.com/jira-software-cloud/docs/use-keyboard-shortcuts/) -- official Atlassian Support (HIGH confidence)
- [Google Keep Keyboard Shortcuts](https://support.google.com/keep/answer/12862970) -- official Google Support (HIGH confidence)
- [Jira Frontend API](https://developer.atlassian.com/server/jira/platform/jira-frontend-api/) -- Atlassian developer docs, notes DOM instability (MEDIUM confidence)
