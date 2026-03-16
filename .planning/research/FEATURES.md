# Feature Landscape: Productivity Site Intelligence Guides

**Domain:** Custom site intelligence (fsbElements, multi-strategy selectors, keyboard-first guidance, workflows) for 7 productivity/choring web apps
**Researched:** 2026-03-16
**Confidence:** HIGH (keyboard shortcuts from official docs), MEDIUM (DOM selectors require live inspection)

---

## Reference Baseline: Google Sheets Guide Depth

The Google Sheets guide sets the standard for "full treatment." Any new app guide should match this depth where applicable:

- **24 fsbElements** with 5-strategy selectors each (id, class, aria, role, context)
- **Tiered element organization:** Tier 1 (toolbar buttons), Tier 2 (menu bar), Tier 3 (sheet management)
- **Mechanical tools:** fillsheet/readsheet for bulk operations that bypass DOM limitations
- **13 workflows** covering creation, navigation, data entry, formatting, verification
- **17 warnings** about canvas rendering, edit mode trapping, Name Box patterns
- **Keyboard-first guidance** as primary interaction path (Escape-before-navigate, Tab/Enter patterns)
- **Canvas-aware stuck recovery** for unreadable grid areas

---

## Per-App Analysis

### 1. Notion (notion.so)

**URL patterns:** `notion.so/*`, `notion.com/*`

**Top 5 User Tasks:**
1. Create a new page and write content (headings, lists, text blocks)
2. Create/populate a database (table, board, list, calendar views)
3. Add and rearrange blocks (text, images, embeds, toggles)
4. Use slash commands to insert content types
5. Search and navigate between pages

**Critical UI Elements for fsbElements:**

| Element | Why Critical | Estimated Selector Difficulty |
|---------|-------------|-------------------------------|
| Block editor (contenteditable) | Primary typing target -- React contenteditable div, NOT canvas | Medium -- class names like `notion-selectable`, `notion-text-block` exist but Notion actively monitors DOM mutations and may revert changes |
| Slash command menu | Appears on `/` keystroke, lists block types | Medium -- overlay menu with dynamic positioning |
| Page title input | Contenteditable heading at top of every page | Low -- distinct element, likely has `placeholder` attribute |
| Sidebar navigation | Page tree, workspace switcher, favorites | Medium -- tree structure with expandable sections |
| Database toolbar (filter/sort/view switcher) | Controls database views | High -- multiple overlapping popovers |
| New page button (`+` in sidebar) | Creates pages from sidebar | Low -- button with aria-label |
| Property editors (in databases) | Select, date, person, relation fields | High -- each type has different popover/input patterns |
| Breadcrumb / page path | Shows hierarchy, enables navigation | Low -- standard breadcrumb pattern |
| Share button | Top-right, opens sharing popover | Low -- standard button |
| Block drag handle | `::` handle on hover for reordering | High -- appears on hover, position-absolute overlay |

**Keyboard Shortcuts (from official docs -- HIGH confidence):**
- `Cmd/Ctrl+N` -- New page
- `Cmd/Ctrl+P` or `Cmd/Ctrl+K` -- Search / quick jump
- `Cmd/Ctrl+[` / `]` -- Navigate back/forward
- `/` -- Open slash command menu
- `#`, `##`, `###` + space -- Headings
- `*` or `-` + space -- Bullet list
- `[]` + space -- Checkbox
- `1.` + space -- Numbered list
- `>` + space -- Toggle
- `---` -- Divider
- `Tab` / `Shift+Tab` -- Indent/outdent blocks
- `Cmd/Ctrl+Shift+arrow` -- Move blocks up/down
- `Cmd/Ctrl+D` -- Duplicate block
- `Cmd/Ctrl+/` -- Change block type (turn into)
- `Cmd/Ctrl+B/I/U` -- Bold/Italic/Underline
- `Cmd/Ctrl+E` -- Inline code
- `Cmd/Ctrl+Shift+M` -- Comment
- `Esc` -- Select block / deselect
- `Enter` -- Edit block text
- `@` -- Mention person, page, or date

**DOM Architecture Notes:**
- Notion uses React with contenteditable divs, NOT canvas rendering -- standard DOM automation works
- Each block has a `data-block-id` attribute and uses classes like `notion-selectable`, `notion-text-block`, `notion-page-block`
- Notion monitors DOM mutations and may revert external class modifications (console warning: "reverting mutations")
- Slash command menu renders as an overlay with dynamic items, filterable by typing
- Database views render as standard DOM tables/boards, NOT canvas
- The sidebar tree uses expandable/collapsible sections with state management

**Automation Complexity: MEDIUM-HIGH**
- ContentEditable blocks work well with keyboard input but require understanding of block focus vs text cursor
- Slash commands are purely keyboard-driven (type `/`, then filter text, then Enter) -- ideal for keyboard-first automation
- Database property editors each have unique popover patterns (date picker, select dropdown, person picker)

---

### 2. Google Calendar (calendar.google.com)

**URL patterns:** `calendar.google.com/*`

**Top 5 User Tasks:**
1. Create a new event (with title, date/time, description)
2. View calendar in day/week/month mode
3. Edit an existing event (change time, add attendees, modify details)
4. Delete an event
5. Search for events and navigate to specific dates

**Critical UI Elements for fsbElements:**

| Element | Why Critical | Estimated Selector Difficulty |
|---------|-------------|-------------------------------|
| Create event button (`+`) | Primary creation entry point | Low -- Material Design FAB, likely has aria-label |
| Quick event popover | Appears on clicking time slot or pressing `q` | Medium -- popover with title input, time pickers |
| Full event editor | Detailed form with all event fields | Medium -- standard form with input fields |
| Time grid (day/week view) | Canvas-like grid but actually DOM-based time slots | Medium -- time slots are divs with data attributes |
| Event chips on calendar | Colored event blocks on the grid | Medium -- positioned divs with event data |
| Date picker (mini calendar) | Left sidebar small calendar for navigation | Low -- standard Material Design date picker |
| View switcher (Day/Week/Month/Year) | Toolbar buttons for view modes | Low -- button group with aria-labels |
| Search bar | Top search input | Low -- standard input element |
| Settings gear | Opens settings page | Low -- icon button |
| Event title input (in popover) | First field when creating event | Low -- auto-focused input in popover |
| Time picker dropdowns | Start/end time selection | High -- custom dropdown with scrollable time list |
| Attendee input (email) | Add people to events | Medium -- autocomplete input |
| All-day toggle | Switch between timed and all-day event | Low -- checkbox/toggle |

**Keyboard Shortcuts (from official docs -- HIGH confidence):**
- `C` -- Create event (full screen editor)
- `Q` or `Shift+C` -- Quick create event (popover)
- `E` -- View/edit selected event
- `Backspace/Delete` -- Delete event
- `1` or `D` -- Day view
- `2` or `W` -- Week view
- `3` or `M` -- Month view
- `4` or `X` -- Custom view
- `5` or `A` -- Agenda view
- `6` or `Y` -- Year view
- `T` -- Go to today
- `G` -- Go to specific date
- `J/N` -- Next period
- `K/P` -- Previous period
- `R` -- Refresh
- `S` -- Settings
- `/` -- Search
- `Z` -- Undo
- `Ctrl/Cmd+S` -- Save event
- `Esc` -- Exit event / close popover
- `?` or `Shift+/` -- Show all shortcuts

**DOM Architecture Notes:**
- Google Calendar time grid is NOT pure canvas -- time slots are DOM elements with click handlers
- Event chips are positioned absolutely within the grid using inline styles
- The quick event popover (`Q`) is a lightweight form ideal for automation -- title + time + save
- The full event editor (`C`) is a separate page/panel with standard form inputs
- Material Design components use predictable aria-label patterns
- Time pickers use custom dropdown lists, not native HTML `<select>` or `<input type="time">`
- Keyboard shortcuts must be ENABLED in settings first (not enabled by default)

**Automation Complexity: MEDIUM**
- Most interactions work via keyboard shortcuts (view switching, event creation)
- The quick event popover (`Q`) is the best automation target -- type title, tab to time, save
- Time picker dropdowns are the trickiest part -- custom scrollable lists require careful selector strategy
- Event editing requires first selecting the event (clicking on grid), then pressing `E`

---

### 3. Trello (trello.com)

**URL patterns:** `trello.com/b/*`, `trello.com/c/*`

**Top 5 User Tasks:**
1. Create a new card in a list
2. Move cards between lists (drag-and-drop or keyboard)
3. Edit card details (title, description, labels, due date, members)
4. Create a new list on a board
5. Filter/search cards on a board

**Critical UI Elements for fsbElements:**

| Element | Why Critical | Estimated Selector Difficulty |
|---------|-------------|-------------------------------|
| Add card button (per list) | "Add a card" link at bottom of each list | Medium -- dynamic, per-list |
| Card composer textarea | Appears when adding card -- inline text input | Medium -- dynamically rendered |
| Card title (on board) | Clickable to open card detail | Medium -- list items with card data |
| Card detail modal/overlay | Full card editing view (description, labels, etc.) | Medium -- overlay modal pattern |
| List title | Editable list name at top of each column | Low -- contenteditable element |
| Board header/title | Board name, star button, visibility | Low -- standard header elements |
| Card labels | Color labels on cards and in detail view | Medium -- color-coded spans |
| Due date badge | Shows on card, editable in detail | Medium -- badge element |
| Member avatars | Assigned members shown on card | Medium -- avatar images |
| Quick actions sidebar (in card detail) | Right sidebar with Add members, Labels, Checklist, Date, etc. | Medium -- button list in modal |
| Board menu (right sidebar) | Settings, activity, archived items | Low -- slide-out panel |
| Filter button | Opens filter panel | Low -- toolbar button |
| List actions menu (`...`) | Archive list, move list, copy list | Low -- dropdown menu |
| "Add another list" input | Creates new list at end of board | Low -- persistent input area |

**Keyboard Shortcuts (from official docs -- HIGH confidence):**
- `N` -- New card (below hovered card)
- `T` -- Edit card title
- `F` -- Open filter
- `X` -- Clear filters
- `Q` -- Toggle "my cards" filter
- `B` -- Board selector (search/open boards)
- `J/K` or `Up/Down` -- Navigate between cards
- `<` / `>` -- Move card to adjacent list
- `C` -- Archive card (while hovering)
- `Z` -- Undo
- `Shift+Z` -- Redo
- `R` -- Repeat last action
- `Shift+?` -- Show all shortcuts
- `Enter` -- Open selected card
- `Esc` -- Close card / cancel edit
- `Shift+Scroll` -- Horizontal scroll

**DOM Architecture Notes:**
- Trello uses BEM-like CSS class naming (historically), but has migrated to React with dynamic class names
- Trello frequently changes DOM structure and CSS classes -- selectors break often
- Card elements, list containers, and board layout are standard DOM (NOT canvas)
- Drag-and-drop uses react-beautiful-dnd or similar library -- keyboard alternative via `<`/`>` is more reliable for automation
- Card detail opens as a modal overlay with a gray backdrop
- Lists are horizontally scrollable containers
- Trello uses `data-testid` attributes in some places (useful for resilient selectors)

**Automation Complexity: MEDIUM**
- Standard DOM elements throughout -- no canvas rendering
- Keyboard shortcuts cover most common actions
- Card creation is straightforward: click "Add a card" or hover+press `N`, type title, Enter
- Card editing opens a modal with standard form elements
- The biggest challenge is that Trello DOM structure changes frequently -- multi-strategy selectors are essential
- Drag-and-drop should be replaced with keyboard-based move (`<`/`>`) in site guide

---

### 4. Google Keep (keep.google.com)

**URL patterns:** `keep.google.com/*`

**Top 5 User Tasks:**
1. Create a new note (text or checklist)
2. Edit an existing note (add text, check/uncheck items)
3. Pin, archive, or delete notes
4. Add labels and colors to notes
5. Search for notes

**Critical UI Elements for fsbElements:**

| Element | Why Critical | Estimated Selector Difficulty |
|---------|-------------|-------------------------------|
| "Take a note" input bar | Main creation entry point at top | Medium -- collapsed input that expands on focus |
| Note title input (in editor) | Title field when creating/editing note | Medium -- contenteditable or input |
| Note body (text area) | Main content area of note | Medium -- contenteditable div |
| Checkbox list items | Individual checkable items in list notes | Medium -- list with checkboxes |
| Note cards (grid view) | Card elements in the masonry grid | Medium -- cards with varying heights |
| Pin button | Pin/unpin note (per note) | Low -- icon button with aria-label |
| Archive button | Archive note | Low -- icon button |
| Color picker | Change note background color | Medium -- popover with color palette |
| Label button | Add/manage labels | Medium -- popover with label list |
| Reminder button | Set reminder for note | Medium -- date/time picker popover |
| Delete button | Send to trash | Low -- icon button in more menu |
| Search bar | Top search input | Low -- standard input |
| "New list" button | Creates checklist note instead of text note | Low -- icon button near "Take a note" |
| Note toolbar (bottom of open note) | Row of action buttons (color, label, image, etc.) | Medium -- icon button row |

**Keyboard Shortcuts (from official docs -- HIGH confidence):**
- `C` -- Create new note
- `L` -- Create new list
- `J/K` -- Navigate between notes
- `Shift+J/K` -- Reorder notes
- `N/P` -- Navigate list items within a note
- `Shift+N/P` -- Reorder list items
- `Enter` -- Open selected note
- `Esc` -- Close editor
- `F` -- Pin/unpin note
- `E` -- Archive note
- `#` -- Delete note
- `X` -- Select note without opening
- `/` -- Search
- `?` -- Show shortcuts
- `@` -- Submit feedback
- `Ctrl+G` -- Toggle grid/list view
- `Ctrl+]` / `Ctrl+[` -- Adjust list item indentation
- `Ctrl+Shift+8` -- Toggle checkboxes

**DOM Architecture Notes:**
- Google Keep uses standard DOM rendering (NOT canvas) -- notes are div elements
- Note cards are arranged in a masonry/grid layout with CSS columns
- The "Take a note" bar is a collapsed input that expands into a full editor on click/focus
- Checklist items are standard DOM elements with checkbox inputs
- Color picker is a popover panel with color swatches
- Google Keep uses obfuscated/minified class names (like `gkA`, `Q0hgme`) -- NOT human-readable
- aria-labels are more reliable than class names for selectors
- The note editor appears inline (not a modal) -- the card expands in place or opens a detail view

**Automation Complexity: LOW-MEDIUM**
- Simple app with limited interaction patterns
- Keyboard shortcuts cover all primary actions
- The main challenge is obfuscated class names -- must rely on aria-label and role selectors
- No canvas rendering, no complex popovers, no drag-and-drop for core tasks
- Checklist management is purely DOM-based with keyboard navigation

---

### 5. Todoist (todoist.com)

**URL patterns:** `todoist.com/app/*`, `app.todoist.com/*`

**Top 5 User Tasks:**
1. Add a new task (with project, date, priority, labels)
2. Complete/check off tasks
3. Navigate between projects and views (Today, Upcoming, Inbox)
4. Edit task details (reschedule, change priority, add comments)
5. Organize tasks (move to project, add labels, create sub-tasks)

**Critical UI Elements for fsbElements:**

| Element | Why Critical | Estimated Selector Difficulty |
|---------|-------------|-------------------------------|
| Quick Add bar | Global task entry (press `Q`) -- floats over any view | Medium -- overlay input with inline shortcuts |
| Task item row | Individual task in list view | Medium -- list items with checkbox, title, metadata |
| Task checkbox | Complete/uncomplete toggle | Low -- circular checkbox element |
| Task title (inline editor) | Editable task name | Medium -- contenteditable inline |
| Task detail panel | Right panel or modal with full task info | Medium -- panel with multiple sections |
| Project sidebar | Left sidebar with project list, labels, filters | Medium -- tree navigation |
| Date picker (natural language) | Schedule tasks with NLP input | High -- custom date picker with NLP parsing |
| Priority selector | P1-P4 flag colors | Low -- dropdown or inline flag buttons |
| Label selector | Tag tasks with labels | Medium -- autocomplete popover |
| Add task button (per section) | "Add task" link within project sections | Low -- inline action link |
| Section headers | Organize tasks into sections within projects | Low -- editable headers |
| Command menu (`Cmd/Ctrl+K`) | Global command palette | Medium -- overlay search/command input |
| Comment box | Add comments to tasks | Low -- standard textarea |
| Sub-task indentation controls | Create task hierarchy | Medium -- depends on tab/indent behavior |

**Keyboard Shortcuts (from official docs -- HIGH confidence):**
- `Q` -- Quick Add task (global)
- `A` -- Add task to bottom
- `Shift+A` -- Add task to top
- `Enter` -- Save and create next task / Open task view
- `E` -- Complete task
- `Cmd/Ctrl+E` -- Edit task
- `T` -- Set date
- `Shift+T` -- Remove date
- `1/2/3/4` -- Set priority (P1-P4)
- `Y` -- Change priority
- `C` -- Add comment
- `L` -- Add label
- `V` -- Move task to project
- `X` -- Select task
- `Cmd/Ctrl+Delete` -- Delete task
- `J/K` or `Up/Down` -- Navigate tasks
- `Cmd/Ctrl+Up/Down` -- Move task up/down
- `Ctrl+]/[` -- Indent/outdent (sub-tasks)
- `M` -- Toggle sidebar
- `H` or `G then H` -- Go to Home
- `G then I` -- Go to Inbox
- `G then T` -- Go to Today
- `G then U` -- Go to Upcoming
- `D` -- Sort by date
- `P` -- Sort by priority
- `N` -- Sort by name
- `S` -- Add section
- `/` or `F` -- Search
- `?` -- Show shortcuts
- `Cmd/Ctrl+K` -- Command menu

**Quick Add Inline Shortcuts (within task title -- HIGH confidence):**
- `#project-name` -- Assign to project
- `/section-name` -- Assign to section
- `@label-name` -- Add label
- `p1`, `p2`, `p3`, `p4` -- Set priority
- `+person` -- Assign to person
- `!time` -- Set reminder
- Natural language dates: "tomorrow", "next Friday", "every Monday"

**DOM Architecture Notes:**
- Todoist uses React with standard DOM rendering
- Task items are list elements with consistent structure
- Quick Add is a floating overlay with a rich text input that parses inline shortcuts
- The date picker combines calendar widget with natural language text input
- Todoist uses `data-testid` attributes for some elements
- The sidebar navigation uses a collapsible tree pattern
- Task detail opens as a side panel (not a full modal)

**Automation Complexity: MEDIUM**
- Excellent keyboard shortcut coverage -- almost every action has a shortcut
- Quick Add (`Q`) is the ideal automation entry point -- type task with inline metadata, press Enter
- The inline shortcut syntax (`#project`, `@label`, `p1`, date text) makes Quick Add extremely powerful for keyboard-first automation
- Date picker NLP is a major advantage -- no need to click calendar widgets
- Challenge: distinguishing between task editing inline vs Quick Add overlay

---

### 6. Airtable (airtable.com)

**URL patterns:** `airtable.com/*`

**Top 5 User Tasks:**
1. Add/edit records in grid view (cell-by-cell data entry)
2. Create and configure fields (columns with types)
3. Switch between views (grid, kanban, calendar, gallery, form)
4. Filter, sort, and group records
5. Expand a record to see/edit all fields

**Critical UI Elements for fsbElements:**

| Element | Why Critical | Estimated Selector Difficulty |
|---------|-------------|-------------------------------|
| Grid cells | Primary data entry targets in grid view | HIGH -- Airtable uses canvas-like custom grid rendering, cells may not be standard DOM |
| Record expansion panel | Full record view with all fields | Medium -- modal/panel overlay |
| Field header row | Column headers with field names and types | Medium -- header cells with type icons |
| Add field button (`+`) | Creates new column | Low -- button at end of header row |
| Add record button (`+`) | Creates new row at bottom | Low -- button below grid |
| View switcher tabs | Switch between grid, kanban, calendar, gallery | Low -- tab bar with view names |
| Filter button/panel | Opens filter configuration | Low -- toolbar button, then popover form |
| Sort button/panel | Opens sort configuration | Low -- toolbar button, then popover form |
| Group button/panel | Opens grouping configuration | Low -- toolbar button, then popover form |
| Search/Find bar | Find records within view | Low -- `Ctrl+F` opens search bar |
| Rich field editors (per type) | Date picker, select dropdown, attachment upload, etc. | HIGH -- each field type has unique editor widget |
| View configuration toolbar | Toolbar with Hide fields, Filter, Sort, Group, Color | Medium -- button row above grid |
| Table tabs | Switch between tables in a base | Low -- tab bar at top |
| Record detail modal | Expanded record with all fields | Medium -- modal with field editors |

**Keyboard Shortcuts (from official docs -- HIGH confidence):**
- `Space` -- Expand record
- `Shift+Space` -- Expand active cell
- `Enter` -- Edit cell / confirm edit
- `Esc` -- Cancel edit / close expanded record
- `Tab` -- Move to next cell
- `Shift+Tab` -- Move to previous cell
- `Arrow keys` -- Navigate cells
- `Ctrl+Arrow` -- Jump to edge of data
- `Ctrl+Shift+Arrow` -- Jump and select range
- `Shift+Enter` -- Insert new record below
- `Ctrl+C/X/V` -- Copy/Cut/Paste cells
- `Ctrl+Z` -- Undo
- `Ctrl+Shift+Z` -- Redo
- `Ctrl+F` -- Find bar
- `Ctrl+J` -- Table switcher
- `Ctrl+K` -- Quick base switcher
- `Ctrl+Shift+K` -- View switcher
- `Ctrl+Shift+F` -- Filter menu
- `Ctrl+Shift+S` -- Sort menu
- `Ctrl+Shift+D` -- Grouped records menu
- `Ctrl+Shift+\` -- Toggle extensions (blocks)
- `Ctrl+;` -- Set date/datetime field to now
- `Ctrl+P` -- Print
- `PgUp/PgDn` -- Scroll up/down
- `Alt+PgUp/PgDn` -- Scroll left/right

**DOM Architecture Notes:**
- Airtable's grid view uses a CUSTOM RENDERING ENGINE that may be partially canvas-based or heavily virtualized -- only visible rows/cells exist in DOM
- This is similar to Google Sheets but Airtable cells ARE interactive DOM elements (unlike Sheets' pure canvas)
- Cell editing activates an inline editor overlay specific to the field type
- Rich field types (select, date, linked record, attachment) each open unique editing widgets
- Kanban view uses drag-and-drop cards (similar DOM patterns to Trello)
- Gallery view shows record cards in a grid
- Calendar view renders events on a date grid
- Ctrl+F search recently changed behavior -- may use `Alt+/` in interface views

**Automation Complexity: HIGH**
- Grid cell navigation is similar to Google Sheets patterns (Tab, Enter, arrow keys)
- The biggest complexity is field-type-specific editors -- each field type requires different interaction
- Virtualized rows mean off-screen records are not in DOM -- must scroll to materialize them
- Multi-strategy selectors are essential due to complex rendering
- May need a mechanical tool similar to fillsheet for bulk data entry if grid is heavily virtualized
- Record expansion (`Space`) provides a more automation-friendly view of all fields

---

### 7. Jira (*.atlassian.net/jira/*)

**URL patterns:** `*.atlassian.net/jira/*`, `*.atlassian.net/browse/*`, `*.atlassian.net/board/*`

**Top 5 User Tasks:**
1. Create a new issue (bug, story, task with fields)
2. View and update issue status (move through workflow)
3. Navigate board view (kanban/scrum columns)
4. Search/filter issues (JQL or basic filters)
5. Edit issue details (assignee, priority, description, comments)

**Critical UI Elements for fsbElements:**

| Element | Why Critical | Estimated Selector Difficulty |
|---------|-------------|-------------------------------|
| Create issue button | Global `+` / `C` shortcut to open issue creation modal | Low -- prominent button with aria-label |
| Issue creation modal | Form with summary, description, type, priority, assignee | Medium -- modal dialog with multiple field types |
| Issue summary input | Title field in creation modal and issue view | Low -- standard text input |
| Issue description editor | Rich text editor (Atlassian Editor / ProseMirror) | HIGH -- ProseMirror-based contenteditable with toolbar |
| Board columns | Kanban/scrum columns showing issues | Medium -- column containers with issue cards |
| Issue cards (on board) | Draggable cards in board view | Medium -- card elements with issue data |
| Status dropdown | Change issue status/transition | Medium -- dropdown with workflow states |
| Assignee picker | Assign issue to team member | Medium -- autocomplete dropdown |
| Priority selector | Set issue priority | Low -- dropdown with icon options |
| Sprint selector | Assign to sprint (in backlog) | Medium -- dropdown |
| Issue type selector | Bug, Story, Task, Epic | Low -- dropdown with type icons |
| Comment box | Add comments to issues | Medium -- ProseMirror editor |
| Sidebar navigation | Projects, boards, filters, backlog | Medium -- collapsible navigation tree |
| Backlog panel | List of issues in backlog view | Medium -- draggable list |
| Quick search | `Cmd/Ctrl+K` command palette / `/` search | Low -- overlay search input |
| Filter bar | JQL or basic filter controls | Medium -- structured filter builder |

**Keyboard Shortcuts (from official docs -- HIGH confidence):**
- `C` -- Create issue
- `?` -- View all shortcuts
- `/` -- Quick search
- `Ctrl/Cmd+K` -- Command palette
- `[` -- Show/hide sidebar
- `G then P` -- Go to project
- `G then I` -- Go to issue navigator
- `1` -- Go to backlog
- `2` -- Go to board
- `3` -- Go to reports
- `4` -- Go to timeline
- `O` -- Open selected issue
- `A` -- Assign issue
- `I` -- Assign to me
- `M` -- Add comment
- `L` -- Edit labels
- `D` -- Change status (transition)
- `J/K` -- Next/previous issue
- `N/P` -- Next/previous column (board view)
- `T` -- Toggle list/detail view
- `Z` -- Expand issue
- `S then T` -- Send to top of column
- `S then B` -- Send to bottom of column
- `-` -- Toggle all swimlanes
- `E` -- Toggle epic panel
- `V` -- Toggle version panel
- `Ctrl+Enter` -- Submit comment/description
- `Shift+Alt+S` -- Confirm issue transitions

**DOM Architecture Notes:**
- Jira Cloud uses React with Atlassian Design System components
- Atlassian components use `data-testid` attributes extensively -- good for resilient selectors
- The issue creation modal is a standard modal dialog with form fields
- The description/comment editor is ProseMirror-based (Atlassian Editor) -- contenteditable with toolbar
- Board view uses drag-and-drop for cards between columns
- Jira uses `role` and `aria-label` attributes consistently (Atlassian accessibility standards)
- Issue detail view can be either a full page or a side panel, depending on settings
- The URL structure includes issue keys (e.g., `PROJ-123`) which is useful for navigation verification

**Automation Complexity: MEDIUM-HIGH**
- Issue creation via modal is straightforward -- form fields with predictable selectors
- The ProseMirror description editor is similar to Notion's contenteditable but with toolbar formatting
- Board drag-and-drop should be replaced with keyboard shortcuts (`N`/`P` for columns, `S+T`/`S+B` for ordering)
- Status transitions (`D`) open a dropdown -- keyboard navigation through workflow states
- JQL search is powerful but complex -- basic filters are better for automated workflows
- Atlassian's `data-testid` attributes provide the best selector resilience strategy

---

## Table Stakes Features

Features every productivity app guide MUST have. Missing = guide feels incomplete and automation fails on basic tasks.

| Feature | Why Expected | Complexity | Applies To |
|---------|-------------|------------|------------|
| fsbElements with 5-strategy selectors | Core infrastructure for reliable element targeting | Medium per element | All 7 apps |
| Keyboard shortcut documentation in guidance text | Keyboard-first is more reliable than clicking for these apps | Low | All 7 apps |
| Create item workflow (page/event/card/note/task/record/issue) | #1 user task across all apps | Medium | All 7 apps |
| Edit item workflow | #2-3 user task across all apps | Medium | All 7 apps |
| Navigation guidance (between views/sections/items) | Users need to move between contexts | Low-Medium | All 7 apps |
| Search/filter workflow | Finding existing content is universal need | Low | All 7 apps |
| Canvas/rendering warnings | Prevent AI from trying to read unreadable areas | Low | Airtable, possibly Calendar |
| Modal/popover interaction patterns | All 7 apps use overlays for editing | Medium | All 7 apps |
| Edit mode escape patterns | Prevent stuck states in contenteditable/forms | Low | Notion, Airtable, Jira |
| URL pattern matching | Site guide activation | Low | All 7 apps |

**Minimum fsbElement counts per app (estimated):**

| App | Estimated Elements | Rationale |
|-----|-------------------|-----------|
| Notion | 12-15 | Editor, sidebar, slash menu, database toolbar, breadcrumb, share, page title, block handles, plus button, property editors |
| Google Calendar | 10-12 | Create button, event popover inputs, view switcher, date picker, search, time pickers, event chips |
| Trello | 10-14 | Add card button, card composer, card detail modal, list title, labels, due date, member picker, board menu, filter |
| Google Keep | 8-10 | Note input bar, note title, note body, pin, archive, color picker, label picker, search, checkbox items |
| Todoist | 10-12 | Quick Add, task checkbox, task title, date picker, priority selector, label picker, sidebar projects, section headers, command menu |
| Airtable | 12-16 | Grid cells, field headers, add field, add record, view tabs, filter/sort/group buttons, record expansion, table tabs, field editors |
| Jira | 12-16 | Create button, creation modal fields (summary, description, type, priority, assignee), board columns, issue cards, status dropdown, comment box, search, backlog |

---

## Differentiators

Features that go beyond basic functionality to make FSB stand out on these apps.

| Feature | Value Proposition | Complexity | Applies To |
|---------|-------------------|------------|------------|
| Mechanical tools (like fillsheet/readsheet) | Bypass DOM limitations for bulk operations | High | Airtable (most needed), possibly Notion databases |
| Inline shortcut awareness (Quick Add parsing) | Use app-native NLP/shortcut syntax for efficient automation | Medium | Todoist (`#project @label p1 tomorrow`), Notion (`/slash` commands), Google Calendar (natural language event creation) |
| Workflow chaining (multi-step sequences) | Complete complex tasks reliably (e.g., "create event, invite 3 people, set reminder") | Medium | All 7 apps |
| View-specific guidance | Different guidance for board view vs list view vs calendar view | Medium | Trello (board), Airtable (grid/kanban/calendar/gallery), Jira (board/backlog/timeline), Notion (table/board/list/calendar) |
| Stuck recovery patterns | App-specific recovery when automation gets trapped in modals, popovers, or edit modes | Medium | All 7 apps |
| Cross-app workflow support | Tasks that span multiple apps (e.g., "copy Jira issues to Airtable") | High | Cross-app scenarios |
| Database/spreadsheet bulk operations | Efficient multi-record entry without per-cell navigation overhead | High | Airtable, Notion databases |
| Template-aware creation | Understand and use app-specific templates (Notion templates, Jira issue templates) | Medium | Notion, Jira |

---

## Anti-Features

Features to explicitly NOT build. Either too complex for the return, too fragile, or counterproductive.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Drag-and-drop automation | Fragile, position-dependent, breaks across screen sizes | Use keyboard shortcuts for moving items (`<`/`>` in Trello, `Cmd+Arrow` in Todoist, `N`/`P` columns in Jira) |
| Canvas grid cell clicking (Airtable) | Similar to Google Sheets canvas problem -- unreliable | Use keyboard navigation (Tab, Enter, Arrow keys) and record expansion (`Space`) |
| Real-time collaboration detection | Detecting other users' cursors/edits is extremely complex | Warn about potential conflicts in guidance text, do not try to detect |
| Rich text formatting toolbar clicking | Toolbar buttons have fragile selectors, vary by app version | Use keyboard shortcuts for formatting (`Ctrl+B`, `Ctrl+I`, etc.) -- already universal |
| Custom automation/macro builders | Each app has its own automation system (Notion buttons, Airtable automations, Jira workflows) -- too app-specific | Focus on direct UI interaction, not meta-automation |
| Mobile-responsive layout handling | These apps render differently on small screens | Guide assumes desktop Chrome at standard viewport |
| Per-field-type mechanical tools for Airtable | Building a tool for every Airtable field type (select, date, linked record, etc.) is unbounded | Start with basic text/number cell entry, expand to specific types based on user demand |
| Notion API integration | Using Notion's official API instead of UI automation | FSB is a UI automation tool -- stay on the UI path, do not integrate with app APIs |

---

## Feature Dependencies

```
fsbElements infrastructure (existing) ─> Per-app fsbElement definitions
  |
  ├─> Selector strategies (id, class, aria, role, context) -- existing pattern from Google Sheets
  |
  ├─> Keyboard shortcut guidance text -- depends on fsbElements for fallback targeting
  |
  └─> Workflows -- depend on fsbElements for element references

Shared productivity category guidance (existing _shared.js) ─> Updated to cover non-canvas apps
  |
  └─> Per-app guides inherit from shared guidance

Google Sheets guide (reference implementation) ─> Pattern for all new guides
  |
  ├─> fsbElement structure (tiered, 5 strategies)
  ├─> Workflow structure (step-by-step arrays)
  ├─> Warning patterns (canvas, edit mode, navigation)
  └─> toolPreferences array

registerSiteGuide function (existing) ─> All new guides register the same way
  |
  └─> URL patterns, guidance text, fsbElements, selectors, workflows, warnings, toolPreferences

Simple apps (Google Keep, Todoist) ─> Build first (lower complexity, validate pattern)
  |
  └─> Complex apps (Notion, Airtable, Jira) ─> Build after pattern validated
        |
        └─> Google Calendar, Trello ─> Mid-complexity, can parallel with either group
```

---

## MVP Recommendation

**Priority order based on automation value and complexity:**

### Phase 1: Quick Wins (validate the pattern)
1. **Google Keep** -- Simplest app, fewest elements, keyboard shortcuts cover everything. Good first test of the new guide pattern for non-canvas apps.
2. **Todoist** -- Excellent keyboard shortcut coverage, Quick Add with inline syntax is a perfect automation target. High user value.

### Phase 2: High-Value Medium Complexity
3. **Google Calendar** -- Very common user need, keyboard shortcuts handle most tasks, time pickers are the main challenge.
4. **Trello** -- Standard DOM, good keyboard shortcuts, but DOM stability is a concern (needs robust multi-strategy selectors).

### Phase 3: Complex Apps
5. **Notion** -- Contenteditable blocks, slash commands, database property editors -- high complexity but high user demand.
6. **Jira** -- ProseMirror editor, workflow transitions, multiple view types -- enterprise users demand this.
7. **Airtable** -- Highest complexity (field-type-specific editors, virtualized grid, closest to Google Sheets problems). Consider mechanical tools.

**Defer:**
- Mechanical tools for Airtable/Notion databases: Build basic keyboard navigation first, add mechanical tools only if keyboard-first approach proves insufficient.
- Cross-app workflow support: Not needed for individual guide quality.
- View-specific guidance (multiple database views): Start with primary view (grid for Airtable, board for Trello/Jira), add secondary views later.

---

## Shared Productivity Category Guidance Updates

The existing `_shared.js` focuses exclusively on canvas-based apps (Sheets, Docs). It needs expansion to cover the new app patterns:

**Current coverage:** Canvas rendering, Tab/Enter data entry, keyboard formatting shortcuts
**Needed additions:**
- Contenteditable block editor patterns (Notion, Jira description editor)
- Modal/popover interaction patterns (universal across all 7 apps)
- Keyboard shortcut enabling note (Google Calendar requires opt-in)
- Quick Add / command palette patterns (Todoist, Jira, Notion)
- Card-based layouts (Trello, Google Keep, Airtable kanban/gallery)

---

## Complexity Budget Estimates

| App | fsbElements | Workflows | Warnings | Guidance Lines | Total Effort |
|-----|------------|-----------|----------|----------------|-------------|
| Google Keep | 8-10 | 4-5 | 5-7 | 60-80 | Small |
| Todoist | 10-12 | 6-8 | 6-8 | 80-100 | Small-Medium |
| Google Calendar | 10-12 | 5-7 | 6-8 | 80-100 | Medium |
| Trello | 10-14 | 6-8 | 7-9 | 80-110 | Medium |
| Notion | 12-15 | 8-10 | 8-12 | 100-140 | Medium-Large |
| Jira | 12-16 | 7-10 | 8-12 | 100-140 | Medium-Large |
| Airtable | 12-16 | 7-10 | 10-14 | 110-150 | Large |

**Note:** All fsbElement counts above require LIVE DOM INSPECTION for actual selector values. The keyboard shortcuts and workflows can be built from documented sources, but the 5-strategy selector definitions for each fsbElement require visiting each app in Chrome DevTools to identify real selector values. This is the primary implementation bottleneck.

---

## Sources

### Official Documentation (HIGH confidence)
- [Notion Keyboard Shortcuts](https://www.notion.com/help/keyboard-shortcuts)
- [Google Calendar Keyboard Shortcuts](https://support.google.com/calendar/answer/37034)
- [Trello Keyboard Shortcuts](https://support.atlassian.com/trello/docs/keyboard-shortcuts-in-trello/)
- [Google Keep Keyboard Shortcuts](https://support.google.com/keep/answer/12862970)
- [Todoist Keyboard Shortcuts](https://www.todoist.com/help/articles/use-keyboard-shortcuts-in-todoist-Wyovn2)
- [Airtable Keyboard Shortcuts](https://support.airtable.com/docs/airtable-keyboard-shortcuts)
- [Jira Cloud Keyboard Shortcuts](https://support.atlassian.com/jira-software-cloud/docs/use-keyboard-shortcuts/)
- [Notion Slash Commands Guide](https://www.notion.com/help/guides/using-slash-commands)
- [Notion Database Intro](https://www.notion.com/help/intro-to-databases)
- [Todoist Quick Add](https://www.todoist.com/help/articles/use-task-quick-add-in-todoist-va4Lhpzz)
- [Airtable Grid View](https://support.airtable.com/docs/airtable-grid-view)

### Community/Third-Party (MEDIUM confidence)
- [Airtable Shortcuts - UseTheKeyboard](https://usethekeyboard.com/airtable/)
- [Jira Shortcuts - Atlassian Community](https://community.atlassian.com/forums/App-Central-articles/Jira-Keyboard-Shortcuts-A-Comprehensive-List-for-Power-Users/ba-p/2546146)
- [Google Calendar Shortcuts - HowToGeek](https://www.howtogeek.com/670718/keyboard-shortcuts-for-google-calendar-a-cheat-sheet/)
- [Google Keep Shortcuts - MakeUseOf](https://www.makeuseof.com/google-keep-keyboard-shortcuts/)
- [Trello CSS Guide (historical)](https://gist.github.com/bobbygrace/9e961e8982f42eb91b80)
- [Notion DOM class observations](https://community.latenode.com/t/applying-custom-css-classes-to-notions-editor-interface/19363)

### LOW confidence (needs live verification)
- DOM selector values for all 7 apps (require Chrome DevTools inspection)
- Airtable grid rendering engine details (canvas vs virtualized DOM)
- Notion DOM mutation monitoring behavior
- Trello current CSS class naming patterns (known to change frequently)
