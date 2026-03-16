# Technology Stack: Productivity Site Intelligence Guides

**Project:** FSB v0.9.2 - Productivity Site Intelligence
**Researched:** 2026-03-16
**Mode:** Ecosystem (DOM patterns, keyboard shortcuts, mechanical tool needs per target app)
**Constraint:** Vanilla JS (ES2021+), no build system, Chrome Extension MV3, existing fsbElements + findElementByStrategies pipeline
**Overall confidence:** MEDIUM (DOM class names require live inspection; keyboard shortcuts HIGH from official docs)

---

## Executive Summary

Adding site intelligence for 7 productivity apps (Notion, Google Calendar, Trello, Google Keep, Todoist, Airtable, Jira) requires NO new external dependencies and NO new Chrome Extension APIs. The existing `registerSiteGuide()` / `fsbElements` / `findElementByStrategies()` pipeline is architecturally sufficient -- but has one critical bottleneck: the Stage 1b fsbElements injection in `dom-analysis.js` is hardcoded to only fire on Google Sheets URLs (`/spreadsheets\/d\/`). This gate must be generalized to run for ANY site guide that provides `fsbElements`, which is the single most important infrastructure change in this milestone.

The 7 target apps fall into three DOM-complexity tiers:

1. **Standard DOM (keyboard-first guidance only):** Google Keep, Todoist, Trello -- these render interactive elements as normal DOM nodes. Standard click/type commands work. They need site guides with keyboard shortcuts, fsbElements for key UI targets, and workflow recipes. No mechanical tools needed.

2. **React virtual DOM with dynamic selectors:** Notion, Jira -- these use React with frequently-changing class names but stable `data-block-id`/`data-testid`/`aria-label` attributes. Multi-strategy selectors are essential. Notion's contenteditable blocks and slash commands need special guidance. No mechanical tools needed.

3. **Canvas/hybrid rendering:** Google Calendar, Airtable -- these render parts of their UI on canvas or with custom grid renderers where cells are NOT standard DOM elements. Google Calendar uses DOM elements for the time grid slots but canvas for rendering event chips. Airtable uses a custom grid renderer that is NOT canvas-based (unlike Google Sheets) but has unique cell selection patterns. Neither needs mechanical tools at the level of fillsheet/readsheet -- keyboard navigation suffices.

**Net dependency change: ZERO new libraries. ZERO new Chrome APIs. One infrastructure change (generalize Stage 1b injection) + 7 new site guide files + 1 updated category shared file.**

---

## Critical Infrastructure Change

### Generalize Stage 1b fsbElements Injection

**Current state (hardcoded to Sheets):**
```javascript
// content/dom-analysis.js, line ~1810
if (/spreadsheets\/d\//.test(window.location.pathname)) {
    const fsbElements = guideSelectors?.fsbElements;
    // ... injection loop
}
```

**Required state (any site with fsbElements):**
```javascript
// Replace Sheets URL check with presence check
const fsbElements = guideSelectors?.fsbElements;
if (fsbElements) {
    // ... same injection loop, works for ALL sites
}
```

The `guideSelectors` object already carries `fsbElements` from the matched site guide (background.js line 8483 merges `guide.fsbElements` into the guideSelectors payload). The plumbing exists end-to-end. The ONLY gate is the hardcoded Sheets URL regex in `dom-analysis.js`. Removing that gate makes the entire fsbElements system work for all 7 new sites automatically.

**Also needed:** Move the Sheets-specific health check and logging outside the generalized block, or make them site-aware rather than Sheets-specific.

**Confidence: HIGH** -- verified by reading the actual code paths in dom-analysis.js, background.js, and messaging.js.

---

## Per-App DOM Analysis and Stack Needs

### 1. Notion (notion.so)

**DOM Rendering:** React app with contenteditable blocks. NOT canvas-based. Each block is a `div` with `contenteditable="true"` wrapping the text content. Notion uses CSS class names that include block type identifiers (like `notion-text-block`, `notion-to_do-block`, `notion-page-block`), though class name hashes change across builds.

**Stable selectors available:**
- `data-block-id` attribute on each block (UUID, stable)
- `contenteditable="true"` on editable blocks
- `[role="textbox"]` on the main page content area
- `[placeholder]` attributes on empty blocks (e.g., "Type '/' for commands")
- Sidebar navigation uses standard `[role="treeitem"]` patterns
- Database views use `[role="row"]`, `[role="cell"]` ARIA patterns

**Key DOM challenge:** Notion re-renders blocks aggressively via React. Elements may be removed and re-created between snapshots. The `data-block-id` attribute persists across re-renders and is the most reliable anchor. Class-based selectors are fragile due to CSS module hashing.

**Keyboard shortcuts (verified from official docs):**
| Action | Shortcut |
|--------|----------|
| Slash command menu | `/` |
| New page | `Ctrl+N` |
| Bold | `Ctrl+B` |
| Italic | `Ctrl+I` |
| Heading 1/2/3 | `Ctrl+Shift+1/2/3` |
| To-do | `Ctrl+Shift+4` |
| Bulleted list | `Ctrl+Shift+5` |
| Numbered list | `Ctrl+Shift+6` |
| Toggle list | `Ctrl+Shift+7` |
| Code block | `Ctrl+Shift+8` |
| Move block up/down | `Ctrl+Shift+ArrowUp/Down` |
| Indent/outdent | `Tab` / `Shift+Tab` |
| Search/quick find | `Ctrl+P` or `Ctrl+K` |
| Link | `Ctrl+K` |
| Comment | `Ctrl+Shift+M` |
| Duplicate block | `Ctrl+D` |
| Select block | `Esc` then arrow keys |

**Mechanical tool needed:** NO. Notion's contenteditable blocks accept standard type commands. Slash commands (`/todo`, `/heading1`, etc.) are text-based and work with the existing `type` tool. Keyboard shortcuts handle block creation and formatting.

**fsbElements needed:**
- `page-content` -- main editable area
- `sidebar-toggle` -- hamburger menu to open/close sidebar
- `new-page-button` -- create new page
- `search-input` -- quick find/search field
- `breadcrumb` -- navigation breadcrumb
- `database-add-row` -- add new row in database views

**Strategy priority:** aria > role > context > class (avoid id-based, Notion generates no stable IDs)

**Confidence:** MEDIUM -- DOM class naming pattern is well-known from community; exact current selectors need live inspection verification.

---

### 2. Google Calendar (calendar.google.com)

**DOM Rendering:** Polymer/Lit-based (Google internal framework, evolved from Closure). The time grid uses standard DOM elements -- NOT canvas. Each time slot is a `div` with `data-datekey` and `data-eventchip` attributes. Event chips are rendered as DOM elements with `data-eventid` attributes.

**Stable selectors available:**
- `[data-datekey]` on date cells
- `[data-eventid]` on event chips
- `[aria-label]` extensively used on all interactive elements
- `[data-view]` on view containers (day, week, month)
- Mini calendar uses standard `[role="grid"]` with `[data-date]` cells
- Event creation form uses `[aria-label]` on all fields

**Key DOM challenge:** Google Calendar aggressively lazy-loads events. Scrolling in week/month view triggers AJAX that inserts new event elements. Modal popovers for event details appear as overlays with dynamic positioning. The time grid itself is reliable DOM -- the challenge is event chips that appear/disappear based on scroll position.

**Keyboard shortcuts (verified from Google support docs):**
| Action | Shortcut |
|--------|----------|
| Create event | `C` |
| Day view | `D` |
| Week view | `W` |
| Month view | `M` |
| Year view | `Y` |
| Agenda view | `A` |
| Custom view | `X` |
| Go to today | `T` |
| Go to date | `G` (then type date) |
| Next period | `N` or `J` |
| Previous period | `P` or `K` |
| Search | `/` |
| Settings | `S` |
| Delete event | `Backspace` or `Delete` |
| Undo | `Z` |
| Show shortcuts | `?` |

**Mechanical tool needed:** NO. Events are created via the `C` shortcut which opens a standard form with labeled input fields. Date/time pickers use standard select/input elements. The time grid click-to-create interaction works with standard click commands at the correct grid position.

**fsbElements needed:**
- `create-event-button` -- floating "+" or toolbar create button
- `event-title-input` -- title field in event creation popover
- `event-date-input` -- date field
- `event-time-input` -- time field
- `event-save-button` -- save/create button
- `mini-calendar` -- the small date picker in the sidebar
- `view-switcher` -- day/week/month view toggle area
- `search-input` -- search box

**Strategy priority:** aria > data-attribute > role > context (Google uses aria-label extensively, stable IDs are rare)

**Confidence:** MEDIUM -- framework identification is well-known; exact selector stability needs live verification.

---

### 3. Trello (trello.com)

**DOM Rendering:** React app with standard DOM elements. Cards and lists are normal `div` elements with `data-testid` attributes (Atlassian convention). Drag-and-drop is handled by React DnD library but all card/list elements are accessible via standard selectors.

**Stable selectors available:**
- `[data-testid]` on major UI elements (Atlassian convention)
- `[aria-label]` on buttons and interactive elements
- Card links have `href` attributes containing card IDs
- Lists have `[data-list-id]` attributes (from Atlassian data attributes)
- `[role="button"]`, `[role="dialog"]`, `[role="textbox"]` on interactive elements

**Key DOM challenge:** Trello's list IDs are NOT exposed as DOM IDs directly. Cards within lists contain `href` attributes with card IDs. The board scrolls horizontally, and lists may not be in DOM if scrolled out of view (virtual scrolling). Modal overlays for card details use standard dialog patterns.

**Keyboard shortcuts (verified from Atlassian support docs):**
| Action | Shortcut |
|--------|----------|
| New card | `N` |
| Open card | `Enter` |
| Edit card title | `T` |
| Archive card | `C` |
| Move up/down | `J` / `K` or Arrow keys |
| Search boards | `B` |
| Filter cards | `F` |
| Repeat last action | `R` |
| Undo | `Z` |
| Redo | `Shift+Z` |
| Clear filters | `X` |
| Show shortcuts | `Shift+?` |
| Due date | `D` |
| Label | `L` |
| Members | `M` |
| Description | `E` |
| Quick edit | `E` (while hovering) |

**Mechanical tool needed:** NO. Card creation uses the `N` shortcut or the "Add a card" button. Card editing uses standard contenteditable/textarea elements. Labels, due dates, and members use standard click-to-select patterns.

**fsbElements needed:**
- `add-card-button` -- "Add a card" link at bottom of lists
- `add-list-button` -- "Add another list" button
- `card-title-input` -- textarea for card title when creating/editing
- `board-header` -- board name/header area
- `list-header` -- list name area (for renaming)
- `card-detail-modal` -- the card detail overlay
- `search-input` -- search box in header

**Strategy priority:** data-testid > aria > role > context (Atlassian uses data-testid consistently)

**Confidence:** MEDIUM -- Atlassian data-testid convention is well-documented; exact values need live verification.

---

### 4. Google Keep (keep.google.com)

**DOM Rendering:** Standard DOM with Polymer/Material Web Components. Notes are rendered as card elements with standard class names. Checkboxes are standard input elements. The note grid uses CSS grid/flexbox layout -- NOT canvas.

**Stable selectors available:**
- `[aria-label]` on interactive elements
- `[data-id]` on note cards
- `[role="listitem"]` on note cards in grid
- `contenteditable="true"` on note title and body
- Checkbox items use standard `[role="checkbox"]` or `input[type="checkbox"]`
- Color picker uses `[aria-label]` with color names

**Key DOM challenge:** Google Keep uses Material Design components that wrap standard elements in shadow DOM or custom elements. The note editing experience opens an overlay/modal that contains the editable fields. Notes in the grid are NOT directly editable -- you must click to open the edit overlay. The contenteditable areas in the overlay are standard and work with type commands.

**Keyboard shortcuts (verified from Google support and community docs):**
| Action | Shortcut |
|--------|----------|
| New note | `C` |
| New list | `L` |
| Search | `/` |
| Select note | `X` |
| Open note | `O` or `Enter` |
| Archive | `E` |
| Delete | `#` |
| Pin/unpin | `F` |
| Next note | `J` |
| Previous note | `K` |
| Next list item | `N` |
| Previous list item | `P` |
| Move item down | `Shift+N` |
| Move item up | `Shift+P` |
| Toggle grid/list | `Ctrl+G` |
| Toggle checkboxes | `Ctrl+Shift+8` |
| Indent | `Ctrl+]` |
| Dedent | `Ctrl+[` |
| Close note | `Esc` or `Ctrl+Enter` |
| Show shortcuts | `?` |

**Mechanical tool needed:** NO. Note creation uses `C` shortcut, list creation uses `L`. Text entry is standard contenteditable. Checkbox toggling is standard click on checkbox elements.

**fsbElements needed:**
- `new-note-button` -- compose new note
- `new-list-button` -- compose new list
- `search-input` -- search bar
- `note-title-input` -- title field in note editor
- `note-body-input` -- body contenteditable in note editor
- `add-checkbox-item` -- the "+ List item" button in list notes
- `color-picker` -- note background color selector
- `pin-button` -- pin/unpin button in note editor
- `close-note-button` -- done/close button

**Strategy priority:** aria > role > context > class (Google uses aria-label, avoids stable IDs in Keep)

**Confidence:** MEDIUM -- rendering approach verified via web search; exact selectors need live inspection.

---

### 5. Todoist (todoist.com)

**DOM Rendering:** React app with standard DOM elements. Uses `data-testid` attributes on some elements. Task items are standard DOM elements with contenteditable for inline editing. The quick-add bar is a standard input/contenteditable area.

**Stable selectors available:**
- `[data-testid]` on some UI elements
- `[aria-label]` on buttons and interactive elements
- `[role="listbox"]` on project/label dropdowns
- `[contenteditable="true"]` on task name editing fields
- Task checkboxes use standard checkbox patterns
- Priority indicators use `[data-priority]` or class-based indicators

**Key DOM challenge:** Todoist uses React with frequent re-renders. Class names include hashed suffixes (CSS modules). The inline task editor replaces the task display element when activated, so element references may become stale. The quick-add modal is a standard overlay with well-labeled fields. Date picker uses a custom popover with calendar grid.

**Keyboard shortcuts (verified from Todoist official docs):**
| Action | Shortcut |
|--------|----------|
| Quick add task | `Q` |
| Add to bottom | `A` |
| Add to top | `Shift+A` |
| Open task | `Enter` |
| Edit task | `Ctrl+E` |
| Complete task | `E` |
| Set date | `T` |
| Remove date | `Shift+T` |
| Set priority 1-4 | `1`, `2`, `3`, `4` |
| Add label | `L` |
| Add comment | `C` |
| Search | `/` or `F` |
| Go to Inbox | `G` then `I` |
| Go to Today | `G` then `T` |
| Go to Upcoming | `G` then `U` |
| Move up/down | `K`/`J` or arrows |
| Command menu | `Ctrl+K` |
| Add section | `S` |

**Mechanical tool needed:** NO. Task creation uses `Q` for quick-add or `A` for inline add. All fields accept standard type commands. Natural language date parsing means typing "tomorrow" or "next Monday" in the date field works directly.

**fsbElements needed:**
- `quick-add-button` -- the "+" button or quick add trigger
- `task-name-input` -- task name field in quick add or inline editor
- `date-picker-trigger` -- due date button/field
- `priority-picker` -- priority selection
- `project-selector` -- project dropdown
- `label-selector` -- label/tag dropdown
- `search-input` -- search bar
- `inbox-link` -- inbox navigation item
- `today-link` -- today view navigation item

**Strategy priority:** data-testid > aria > role > context (React app with CSS module hashing makes class selectors fragile)

**Confidence:** MEDIUM -- React architecture confirmed; keyboard shortcuts from official docs; exact selectors need live verification.

---

### 6. Airtable (airtable.com)

**DOM Rendering:** React app with a CUSTOM GRID RENDERER. The grid view is NOT canvas-based (unlike Google Sheets) -- cells are real DOM elements, but they use a virtualized rendering approach where only visible rows/columns are in the DOM. Cells use `[role="gridcell"]` ARIA pattern. Cell editing opens an inline editor overlay.

**Stable selectors available:**
- `[role="grid"]`, `[role="row"]`, `[role="gridcell"]`, `[role="columnheader"]` ARIA grid pattern
- `[aria-label]` on toolbar buttons and field type selectors
- `[aria-colindex]`, `[aria-rowindex]` on grid cells (standard ARIA grid attributes)
- `[data-columnid]`, `[data-rowid]` (Airtable-specific data attributes on some elements)
- Record expansion uses `[role="dialog"]` with `[aria-label]`
- Field type indicators use `[data-field-type]` or class-based patterns

**Key DOM challenge:** Airtable virtualizes the grid -- only ~20-30 visible rows exist in DOM at any time. Scrolling creates/destroys row elements. Cell editing triggers an inline expansion overlay that replaces the static cell content. Rich field types (attachments, linked records, selects) each have unique editor UIs. This is the most complex grid interaction of all 7 apps.

**Keyboard shortcuts (verified from Airtable official docs):**
| Action | Shortcut |
|--------|----------|
| Edit cell | `Enter` |
| Expand record | `Space` |
| Expand cell | `Shift+Space` |
| Navigate cells | Arrow keys |
| Jump to edge | `Ctrl+Arrow` |
| Select range | `Shift+Arrow` |
| Insert record below | `Shift+Enter` |
| Undo/Redo | `Ctrl+Z` / `Ctrl+Shift+Z` |
| Copy/Paste | `Ctrl+C` / `Ctrl+V` |
| Find | `Ctrl+F` |
| Table switcher | `Ctrl+J` |
| View switcher | `Ctrl+Shift+K` |
| Filters | `Ctrl+Shift+F` |
| Sort | `Ctrl+Shift+S` |
| Group | `Ctrl+Shift+D` |
| Page up/down | `PgUp` / `PgDn` |
| Scroll horizontal | `Alt+PgUp` / `Alt+PgDn` |
| Toggle blocks | `Ctrl+Shift+\` |
| Previous/Next record | `Ctrl+Shift+<` / `Ctrl+Shift+>` |
| Close expanded | `Esc` |

**Mechanical tool needed:** MAYBE (deferred). Airtable's grid is DOM-based (unlike Sheets' canvas) so standard click/type work for individual cells. However, bulk data entry into Airtable is tedious cell-by-cell. A future `fillairtable` mechanical tool could be valuable but is NOT required for the initial site guide. Keyboard navigation (arrow keys + Enter to edit + type + Tab to next cell) is reliable enough for the first version. Defer mechanical tool to a future milestone if demand arises.

**fsbElements needed:**
- `grid-container` -- the main grid area
- `add-row-button` -- "+" row at bottom of grid
- `add-field-button` -- "+" column header to add new field
- `search-input` -- search bar
- `view-switcher` -- view tabs (grid, kanban, calendar, etc.)
- `record-expand-button` -- row expand icon
- `table-switcher` -- table tabs at top
- `filter-button` -- filter toolbar button
- `sort-button` -- sort toolbar button

**Strategy priority:** aria > role > context > data-attribute (Airtable has excellent ARIA grid implementation)

**Confidence:** MEDIUM -- grid rendering approach (virtualized DOM, not canvas) confirmed by Airtable community discussions; exact selectors need live verification.

---

### 7. Jira (*.atlassian.net)

**DOM Rendering:** React app using Atlassian Design System (ADS). Uses `data-testid` attributes extensively (Atlassian testing convention). The board view uses React DnD for drag-and-drop. Issue creation uses a modal dialog. Sprint views use standard DOM elements.

**Stable selectors available:**
- `[data-testid]` -- Atlassian convention, present on most interactive elements
- `[aria-label]` on buttons, inputs, and navigation items
- `[role="dialog"]` on modals
- `[role="gridcell"]` on board columns/cards
- `[role="button"]`, `[role="menuitem"]` on toolbar actions
- Board columns use `[data-column-id]` attributes
- Issue keys (e.g., "PROJ-123") appear in `data-issue-key` or href attributes

**Key DOM challenge:** Jira Cloud changes DOM structure with each sprint release (bi-weekly). Atlassian explicitly warns against relying on DOM structure. However, `data-testid` attributes are stable across releases (they're part of Atlassian's testing infrastructure). The issue creation modal has many dynamic fields that appear/disappear based on project configuration (custom fields, issue types). Board drag-and-drop is complex but NOT needed for the guide -- keyboard shortcuts handle column transitions.

**Keyboard shortcuts (verified from Atlassian support docs):**
| Action | Shortcut |
|--------|----------|
| Create issue | `C` |
| Quick search | `/` |
| Show backlog | `1` |
| Show board | `2` |
| Show reports | `3` |
| Assign to me | `I` |
| Assign to other | `A` |
| Open issue | `O` |
| Edit labels | `L` |
| Add comment | `M` |
| Next/previous issue | `J` / `K` |
| Next/previous column | `N` / `P` |
| Show shortcuts | `?` |
| Command palette | `Ctrl+K` |

**Mechanical tool needed:** NO. Issue creation uses `C` shortcut to open the creation modal. All fields are standard form inputs (text, select, date pickers). Sprint management uses standard click interactions. Board card movement uses keyboard shortcuts.

**fsbElements needed:**
- `create-issue-button` -- the "Create" button in header
- `issue-summary-input` -- summary/title field in create modal
- `issue-type-selector` -- issue type dropdown
- `project-selector` -- project dropdown
- `assignee-selector` -- assignee field
- `priority-selector` -- priority dropdown
- `sprint-selector` -- sprint field
- `description-editor` -- rich text description field
- `board-column` -- board columns (for context)
- `search-input` -- global search bar
- `backlog-view` -- backlog navigation
- `board-view` -- board navigation

**Strategy priority:** data-testid > aria > role > context (Atlassian's data-testid is the most stable selector strategy)

**Confidence:** MEDIUM -- Atlassian data-testid convention well-documented; Jira DOM instability explicitly warned by Atlassian; data-testid stability confirmed.

---

## Recommended Stack (Changes from Current)

### No New Dependencies

| Category | Technology | Version | Purpose | Change |
|----------|-----------|---------|---------|--------|
| Runtime | Vanilla JS (ES2021+) | N/A | All site guide code | No change |
| Platform | Chrome Extension MV3 | N/A | Extension framework | No change |
| Element lookup | findElementByStrategies | Existing | Multi-strategy selector resolution | No change |
| Guide registry | registerSiteGuide | Existing | URL pattern matching + guide loading | No change |
| fsbElements pipeline | Stage 1b injection | Existing | Element injection into DOM snapshot | **Generalize** (remove Sheets URL gate) |

### New Files (7 site guides + 1 updated shared)

| File | Purpose | Estimated Size |
|------|---------|---------------|
| `site-guides/productivity/notion.js` | Notion block editor intelligence | ~300 lines |
| `site-guides/productivity/google-calendar.js` | Google Calendar event management | ~250 lines |
| `site-guides/productivity/trello.js` | Trello board/card management | ~200 lines |
| `site-guides/productivity/google-keep.js` | Google Keep note/list management | ~200 lines |
| `site-guides/productivity/todoist.js` | Todoist task management | ~200 lines |
| `site-guides/productivity/airtable.js` | Airtable grid/record management | ~300 lines |
| `site-guides/productivity/jira.js` | Jira issue/board/sprint management | ~300 lines |
| `site-guides/productivity/_shared.js` | Updated category guidance (add non-canvas app patterns) | ~50 line delta |

### Modified Files

| File | Change | Scope |
|------|--------|-------|
| `content/dom-analysis.js` | Generalize Stage 1b fsbElements injection (remove `/spreadsheets\/d\/` gate) | ~20 lines changed |
| `content/dom-analysis.js` | Make Sheets health check and logging site-aware | ~15 lines changed |
| `site-guides/index.js` | Add productivity app keywords to `categoryKeywords` for task-based routing | ~10 lines added |
| `options.html` | Add 7 `<script>` tags for new guide files | 7 lines added |
| `manifest.json` | Add new guide files to `content_scripts` or `web_accessible_resources` if needed | ~7 lines |

### No New Chrome Extension APIs Needed

The existing API surface is sufficient:
- `chrome.tabs.get()` -- already used for guide URL matching
- `chrome.debugger` -- already used for keyboard input via CDP
- Content script messaging -- already used for DOM snapshot + guide selector passing
- No new permissions needed in manifest.json

---

## Mechanical Tool Assessment

| App | Needs Mechanical Tool? | Rationale |
|-----|----------------------|-----------|
| Google Sheets | YES (existing) | Canvas-based grid; fillsheet/readsheet already implemented |
| Notion | NO | Contenteditable blocks accept standard type; slash commands are text-based |
| Google Calendar | NO | Event creation form has standard labeled inputs |
| Trello | NO | Card creation uses standard textarea/contenteditable |
| Google Keep | NO | Note body is contenteditable; checkbox is standard click |
| Todoist | NO | Quick-add and inline editing use standard inputs |
| Airtable | MAYBE (deferred) | DOM grid with keyboard nav works; bulk entry could benefit from future tool |
| Jira | NO | Issue creation modal has standard form fields |

**Rationale:** Mechanical tools (like fillsheet) are justified when the app's rendering makes standard DOM interaction impossible (canvas-based grid). None of the 7 new apps have that problem. Airtable's virtualized grid is the closest, but keyboard navigation (arrow + Enter + type + Tab) is reliable for single-record interaction. Bulk data entry into Airtable is an edge case that can be deferred.

---

## Site Guide Structure Template

Each new site guide follows the established pattern from `google-sheets.js`:

```javascript
registerSiteGuide({
  site: 'App Name',
  category: 'Productivity Tools',
  patterns: [
    /hostname\.com\/path/i  // URL patterns
  ],
  guidance: `APP-SPECIFIC INTELLIGENCE:
    // Keyboard shortcuts
    // Navigation patterns
    // Common workflows
    // Critical warnings
  `,
  fsbElements: {
    'element-name': {
      label: 'Human-readable label',
      selectors: [
        { strategy: 'aria', selector: '[aria-label="Label"]' },
        { strategy: 'role', selector: '[role="button"][aria-label*="Label"]' },
        { strategy: 'data-testid', selector: '[data-testid="element-id"]' },
        { strategy: 'context', selector: '.parent .child-pattern' },
        { strategy: 'class', selector: '.known-stable-class' }
      ]
    }
    // ... more elements
  },
  selectors: {
    // Legacy flat selector map (backward compatibility)
  },
  workflows: {
    // Step-by-step recipes for common tasks
  },
  warnings: [
    // Critical gotchas for the AI
  ],
  toolPreferences: ['navigate', 'click', 'type', 'keyPress', ...]
});
```

### Selector Strategy Ordering by App

| App | Strategy 1 | Strategy 2 | Strategy 3 | Strategy 4 | Strategy 5 |
|-----|-----------|-----------|-----------|-----------|-----------|
| Notion | aria | role | context | data-block-id | class |
| Google Calendar | aria | data-attribute | role | context | class |
| Trello | data-testid | aria | role | context | class |
| Google Keep | aria | role | context | class | id |
| Todoist | data-testid | aria | role | context | class |
| Airtable | aria | role | data-attribute | context | class |
| Jira | data-testid | aria | role | context | class |

---

## Category Shared Guidance Update

The current `_shared.js` assumes all productivity tools are canvas-based (Google Docs/Sheets). The update must add patterns for the non-canvas apps:

```
PRODUCTIVITY TOOLS INTELLIGENCE:

CANVAS-BASED APPLICATIONS (Google Sheets, Google Docs):
- ... (existing guidance unchanged)

BLOCK-EDITOR APPLICATIONS (Notion):
- Content is organized as blocks, each independently editable
- Use slash commands (/) to create new block types
- Use keyboard shortcuts for block manipulation
- Tab/Shift+Tab for indenting/outdenting blocks

CARD/BOARD APPLICATIONS (Trello, Jira):
- Content organized as cards within lists/columns
- Keyboard shortcuts (N, J, K) for card creation and navigation
- Modal overlays for detailed card/issue editing
- Drag-and-drop replaced by keyboard shortcuts for reliability

GRID APPLICATIONS (Airtable):
- Cells are real DOM elements (unlike Sheets canvas)
- Arrow keys to navigate, Enter to edit, Escape to confirm
- Space to expand record for full editing
- Virtualized rendering -- only visible rows in DOM

LIST APPLICATIONS (Todoist, Google Keep):
- Quick-add shortcuts (Q for Todoist, C for Keep)
- Inline editing with contenteditable
- Keyboard navigation (J/K) between items
```

---

## Task-Based Keyword Routing Update

The `categoryKeywords` in `site-guides/index.js` needs expanded weak keywords for the new apps:

```javascript
'Productivity Tools': {
  strong: [
    'google sheets', 'google sheet', 'spreadsheet', 'google docs', 'google doc',
    'notion', 'trello', 'google calendar', 'google keep', 'todoist', 'airtable', 'jira'
  ],
  weak: [
    'sheets', 'sheet', 'create sheet', 'new sheet', 'add to sheet', 'enter data',
    'create document', 'new document', 'write document', 'share document', 'edit document',
    'create page', 'new page', 'add block', 'database view', 'kanban',
    'create event', 'schedule meeting', 'calendar event', 'add to calendar',
    'create card', 'add card', 'move card', 'board',
    'new note', 'create note', 'checklist', 'keep note',
    'add task', 'create task', 'todo', 'due date', 'priority',
    'new record', 'add record', 'grid view', 'base',
    'create issue', 'new issue', 'sprint', 'backlog', 'epic'
  ]
}
```

---

## Complexity Tiers and Phase Ordering Recommendation

| Tier | Apps | Complexity Driver | Recommended Phase |
|------|------|-------------------|-------------------|
| 1 (Simple) | Google Keep, Todoist | Standard DOM, simple interactions, clear keyboard shortcuts | First -- validate the generalized pipeline |
| 2 (Medium) | Trello, Google Calendar | Standard DOM but with modals, popovers, lazy loading | Second -- more complex interactions |
| 3 (Complex) | Notion, Jira, Airtable | React virtual DOM, dynamic selectors, rich field types | Third -- most research-dependent |

**Phase ordering rationale:**
1. Start with Tier 1 (Keep + Todoist) because they test the generalized fsbElements pipeline with minimal DOM complexity. If the pipeline generalization works here, it works everywhere.
2. Tier 2 (Trello + Calendar) adds modal overlay patterns and lazy loading, but still uses standard DOM.
3. Tier 3 (Notion + Jira + Airtable) has the most fragile selectors and most complex interaction patterns. These benefit from the pipeline being battle-tested on simpler apps first.

---

## Alternatives Considered

| Decision | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| fsbElements injection | Generalize existing Stage 1b | Create per-site injection functions | Per-site functions would duplicate 90% identical logic; the existing loop already handles any fsbElements object |
| Selector strategy | 5 strategies per element (matching Sheets pattern) | Fewer strategies for simpler apps | Consistency across all guides; Sheets has proven the 5-strategy pattern catches DOM changes |
| Mechanical tools | None for new apps | Build fillnotion, fillairtable, etc. | None of these apps use canvas-based grids; standard DOM interaction is sufficient |
| Chrome API additions | None | requestAnimationFrame via chrome.scripting | Unnecessary; existing DOM snapshot timing is sufficient for all 7 apps |
| Category restructure | Keep all 7 in "Productivity Tools" | Split into "Project Management", "Notes", etc. | Unnecessary granularity; the category is already established and the shared guidance covers all patterns |

---

## Installation / File Changes

```
# New files to create (7 site guides):
site-guides/productivity/notion.js
site-guides/productivity/google-calendar.js
site-guides/productivity/trello.js
site-guides/productivity/google-keep.js
site-guides/productivity/todoist.js
site-guides/productivity/airtable.js
site-guides/productivity/jira.js

# Files to modify:
content/dom-analysis.js          # Generalize Stage 1b injection
site-guides/productivity/_shared.js  # Add non-canvas app patterns
site-guides/index.js             # Add productivity keywords
options.html                     # Add 7 script tags

# No new npm dependencies
# No new Chrome permissions
```

---

## Sources

### Official Documentation (HIGH confidence)
- [Notion Keyboard Shortcuts](https://www.notion.com/help/keyboard-shortcuts)
- [Notion Slash Commands](https://www.notion.com/help/guides/using-slash-commands)
- [Google Calendar Keyboard Shortcuts](https://support.google.com/calendar/answer/37034)
- [Trello Keyboard Shortcuts](https://support.atlassian.com/trello/docs/keyboard-shortcuts-in-trello/)
- [Todoist Keyboard Shortcuts](https://www.todoist.com/help/articles/use-keyboard-shortcuts-in-todoist-Wyovn2)
- [Todoist Quick Add](https://www.todoist.com/help/articles/use-task-quick-add-in-todoist-va4Lhpzz)
- [Airtable Keyboard Shortcuts](https://support.airtable.com/docs/airtable-keyboard-shortcuts)
- [Airtable Grid View](https://support.airtable.com/docs/airtable-grid-view)
- [Jira Cloud Keyboard Shortcuts](https://support.atlassian.com/jira-software-cloud/docs/use-keyboard-shortcuts/)
- [Google Keep Keyboard Shortcuts](https://support.google.com/keep/answer/12862970)

### Community/Third-Party (MEDIUM confidence)
- [UseTheKeyboard: Airtable](https://usethekeyboard.com/airtable/)
- [UseTheKeyboard: Todoist](https://usethekeyboard.com/todoist/)
- [DefKey: Google Keep](https://defkey.com/google-keep-shortcuts)
- [KeyCombiner: Notion](https://keycombiner.com/collections/notion/)
- [Notion Block API](https://developers.notion.com/reference/block)

### Codebase Analysis (HIGH confidence)
- `content/dom-analysis.js` lines 1790-1870 -- Stage 1b injection pipeline
- `content/dom-analysis.js` line 1758 -- findElementByStrategies implementation
- `background.js` line 8483 -- fsbElements passed to content script
- `site-guides/productivity/google-sheets.js` -- reference pattern for new guides
- `site-guides/index.js` -- guide registry and keyword routing
- `content/actions.js` lines 3769-3990 -- fillsheet/readsheet implementation (reference for mechanical tool pattern)

### LOW Confidence (needs live verification)
- Notion DOM class names (`notion-selectable`, `notion-text-block`, `data-block-id`) -- inferred from community tools and API docs, not directly inspected
- Airtable ARIA grid attributes (`aria-rowindex`, `aria-colindex`) -- inferred from W3C ARIA grid pattern, not directly verified on live Airtable
- Jira `data-testid` stability -- Atlassian states DOM is unstable but data-testid is maintained; needs confirmation on current Cloud version
- Google Calendar `data-datekey`, `data-eventid` attributes -- commonly cited but need live verification against current Calendar UI
- Google Keep `data-id` on note cards -- needs live verification
