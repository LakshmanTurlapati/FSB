/**
 * Site Guide: Notion
 * Per-site guide for Notion workspace application.
 * Selector strategy: aria/role-first (Notion uses React with CSS Modules -- class names change on every deploy)
 */

registerSiteGuide({
  site: 'Notion',
  category: 'Productivity Tools',
  patterns: [
    /notion\.so/i,
    /notion\.site/i
  ],
  guidance: `NOTION-SPECIFIC INTELLIGENCE:

SLASH COMMANDS (PRIMARY BLOCK CREATION METHOD):
  Type "/" at the beginning of a new line to open the slash command menu:
    /text or /p       - Plain text paragraph
    /h1, /h2, /h3     - Headings (level 1, 2, 3)
    /todo              - To-do checkbox
    /bullet            - Bulleted list
    /number            - Numbered list
    /toggle            - Toggle block (collapsible)
    /quote             - Quote block
    /divider           - Horizontal divider (---)
    /code              - Code block (with language selector)
    /table             - Simple table
    /callout           - Callout box (with emoji icon)
    /page              - New sub-page (nested inside current page)
    /image             - Image embed (upload or URL)
    /database          - Inline database (full page or inline)
    /link              - Link to page
    /mention           - Mention a person or page
    /date              - Insert date or date range
    /embed             - Embed external content (URL)
    /equation          - LaTeX equation block
    /toc               - Table of contents

  After typing the command, press Enter to insert the block.
  To search: type "/" then start typing any word to filter the menu.
  Slash commands only work at the start of an empty line or at cursor position in an empty block.

KEYBOARD SHORTCUTS:
  Ctrl+N:            New page
  Ctrl+Shift+N:      New page in sidebar
  Ctrl+K:            Quick search / link to page
  Ctrl+P:            Quick search (alternative)
  Ctrl+/:            Toggle sidebar
  Ctrl+Shift+H:      Toggle hide sidebar
  Enter:             New block below current
  Tab:               Indent block (nest inside previous)
  Shift+Tab:         Outdent block (un-nest)
  Ctrl+Shift+0:      Convert block to text
  Ctrl+Shift+1:      Convert block to heading 1
  Ctrl+Shift+2:      Convert block to heading 2
  Ctrl+Shift+3:      Convert block to heading 3
  Ctrl+Shift+4:      Convert block to to-do
  Ctrl+Shift+5:      Convert block to bullet list
  Ctrl+Shift+6:      Convert block to numbered list
  Ctrl+Shift+7:      Convert block to toggle list
  Ctrl+Shift+8:      Convert block to code block
  Ctrl+Shift+9:      Convert block to page
  Ctrl+D:            Duplicate block
  Ctrl+Shift+D:      Duplicate page
  Ctrl+B:            Bold text
  Ctrl+I:            Italic text
  Ctrl+U:            Underline text
  Ctrl+Shift+S:      Strikethrough
  Ctrl+E:            Inline code
  Ctrl+Shift+M:      Add comment
  Ctrl+Z:            Undo
  Ctrl+Shift+Z:      Redo
  @:                 Mention person or page (opens popover)
  [[:                Link to page (opens page search popover)

CONTENTEDITABLE INTERACTION:
  Notion uses contenteditable blocks. Every block is its own contenteditable region.
  - Click the target block first to place cursor (CRITICAL -- without focus, keyboard shortcuts fire instead of typing)
  - Type text after clicking -- keystrokes go to the focused block
  - Press Enter to create a new block below
  - Blocks are individually selectable -- click to focus, then type
  - To edit an existing block, click directly on the text you want to edit
  - To select multiple blocks: click first block, then Shift+click last block
  - To select all text in a block: Ctrl+A (first press selects block text, second press selects all blocks)

NAVIGATION:
  - Use Ctrl+K or Ctrl+P to search for any page by title
  - Sidebar shows page tree -- click to navigate, use arrows to expand/collapse sections
  - Breadcrumb at top shows page hierarchy -- click any breadcrumb to navigate up
  - Back/Forward browser buttons work for page navigation history

DATABASE INTERACTION:
  - Database views: Table, Board (Kanban), Calendar, Gallery, List, Timeline
  - Click view tabs to switch between views of the same data
  - Filter button: add property-based filters to narrow visible rows
  - Sort button: order rows by any property
  - "New" button or click empty row to add a new database entry
  - Click any row to open it as a full page with all properties

IMPORTANT: ALWAYS prefer slash commands for creating new content blocks.
Slash commands are faster, more reliable, and work regardless of UI state.`,
  fsbElements: {
    'sidebar-toggle': {
      label: 'Sidebar expand/collapse button',
      selectors: [
        { strategy: 'aria', selector: '[aria-label="Toggle sidebar"]' },
        { strategy: 'role', selector: '[role="button"][aria-label*="sidebar" i]' },
        { strategy: 'context', selector: '.notion-sidebar-container [role="button"]:first-child' },
        { strategy: 'id', selector: '[data-testid="sidebar-toggle"]' },
        { strategy: 'class', selector: '.notion-sidebar-toggle' }
      ]
    },
    'sidebar-search': {
      label: 'Quick search in sidebar (Ctrl+K trigger)',
      selectors: [
        { strategy: 'aria', selector: '[aria-label="Search"]' },
        { strategy: 'role', selector: '[role="button"][aria-label*="Search" i]' },
        { strategy: 'context', selector: '.notion-sidebar [role="button"][aria-label*="Search"]' },
        { strategy: 'id', selector: '[data-testid="sidebar-search"]' },
        { strategy: 'class', selector: '.notion-sidebar-search-button' }
      ]
    },
    'sidebar-new-page': {
      label: 'New page button in sidebar',
      selectors: [
        { strategy: 'aria', selector: '[aria-label="New page"]' },
        { strategy: 'role', selector: '[role="button"][aria-label*="New page" i]' },
        { strategy: 'context', selector: '.notion-sidebar [role="button"]:last-child' },
        { strategy: 'id', selector: '[data-testid="sidebar-new-page"]' },
        { strategy: 'class', selector: '.notion-sidebar-new-page-button' }
      ]
    },
    'sidebar-favorites': {
      label: 'Favorites section in sidebar',
      selectors: [
        { strategy: 'aria', selector: '[aria-label="Favorites"]' },
        { strategy: 'role', selector: '[role="treeitem"][aria-label*="Favorites" i]' },
        { strategy: 'context', selector: '.notion-sidebar [role="tree"] [role="treeitem"]:first-of-type' },
        { strategy: 'id', selector: '[data-testid="sidebar-favorites"]' },
        { strategy: 'class', selector: '.notion-sidebar-favorites' }
      ]
    },
    'sidebar-private': {
      label: 'Private section in sidebar',
      selectors: [
        { strategy: 'aria', selector: '[aria-label="Private"]' },
        { strategy: 'role', selector: '[role="treeitem"][aria-label*="Private" i]' },
        { strategy: 'context', selector: '.notion-sidebar [role="tree"] [role="treeitem"]:nth-of-type(2)' },
        { strategy: 'id', selector: '[data-testid="sidebar-private"]' },
        { strategy: 'class', selector: '.notion-sidebar-private' }
      ]
    },
    'page-title': {
      label: 'Page title / heading area',
      selectors: [
        { strategy: 'aria', selector: '[aria-label="Title"]' },
        { strategy: 'role', selector: '[role="heading"][contenteditable="true"]' },
        { strategy: 'context', selector: '.notion-page-content [placeholder*="Untitled"]' },
        { strategy: 'id', selector: '[data-block-id] [placeholder*="title" i]' },
        { strategy: 'class', selector: '.notion-page-block .notion-selectable [contenteditable]' }
      ]
    },
    'page-body': {
      label: 'Main content body area (block container)',
      selectors: [
        { strategy: 'role', selector: '[role="main"] [contenteditable="true"]' },
        { strategy: 'aria', selector: '[aria-label*="content" i][contenteditable]' },
        { strategy: 'context', selector: '.notion-page-content [data-block-id]' },
        { strategy: 'id', selector: '[data-content-editable-root="true"]' },
        { strategy: 'class', selector: '.notion-page-content' }
      ]
    },
    'add-block-button': {
      label: 'Plus button for adding new blocks (hover-triggered)',
      selectors: [
        { strategy: 'aria', selector: '[aria-label="Add block"]' },
        { strategy: 'role', selector: '[role="button"][aria-label*="Add" i]' },
        { strategy: 'context', selector: '[data-block-id] [role="button"][aria-label*="block"]' },
        { strategy: 'id', selector: '[data-testid="block-add-button"]' },
        { strategy: 'class', selector: '.notion-block-add-button' }
      ]
    },
    'drag-handle': {
      label: 'Block drag handle (six-dot icon, hover-triggered)',
      selectors: [
        { strategy: 'aria', selector: '[aria-label="Drag"]' },
        { strategy: 'role', selector: '[role="button"][aria-roledescription="draggable"]' },
        { strategy: 'context', selector: '[data-block-id] [role="button"][draggable="true"]' },
        { strategy: 'id', selector: '[data-testid="block-drag-handle"]' },
        { strategy: 'class', selector: '.notion-block-drag-handle' }
      ]
    },
    'toolbar-breadcrumb': {
      label: 'Breadcrumb navigation at top',
      selectors: [
        { strategy: 'role', selector: '[role="navigation"] [role="list"]' },
        { strategy: 'aria', selector: '[aria-label="Breadcrumb"]' },
        { strategy: 'context', selector: '.notion-topbar [role="navigation"]' },
        { strategy: 'id', selector: '[data-testid="breadcrumb"]' },
        { strategy: 'class', selector: '.notion-topbar-breadcrumb' }
      ]
    },
    'toolbar-share': {
      label: 'Share button in top-right toolbar',
      selectors: [
        { strategy: 'aria', selector: '[aria-label="Share"]' },
        { strategy: 'role', selector: '[role="button"][aria-label="Share"]' },
        { strategy: 'context', selector: '.notion-topbar [role="button"][aria-label="Share"]' },
        { strategy: 'id', selector: '[data-testid="share-button"]' },
        { strategy: 'class', selector: '.notion-topbar-share-button' }
      ]
    },
    'toolbar-favorite': {
      label: 'Favorite/star button',
      selectors: [
        { strategy: 'aria', selector: '[aria-label="Favorite"]' },
        { strategy: 'role', selector: '[role="button"][aria-label*="Favorite" i]' },
        { strategy: 'context', selector: '.notion-topbar [role="button"][aria-label*="avorite"]' },
        { strategy: 'id', selector: '[data-testid="favorite-button"]' },
        { strategy: 'class', selector: '.notion-topbar-favorite-button' }
      ]
    },
    'toolbar-more': {
      label: 'More options menu (...)',
      selectors: [
        { strategy: 'aria', selector: '[aria-label="More"]' },
        { strategy: 'role', selector: '[role="button"][aria-label*="More" i]' },
        { strategy: 'context', selector: '.notion-topbar [role="button"]:last-child' },
        { strategy: 'id', selector: '[data-testid="more-button"]' },
        { strategy: 'class', selector: '.notion-topbar-more-button' }
      ]
    },
    'toolbar-updates': {
      label: 'Updates/comments button',
      selectors: [
        { strategy: 'aria', selector: '[aria-label="Updates"]' },
        { strategy: 'role', selector: '[role="button"][aria-label*="Updates" i]' },
        { strategy: 'context', selector: '.notion-topbar [role="button"][aria-label*="pdate"]' },
        { strategy: 'id', selector: '[data-testid="updates-button"]' },
        { strategy: 'class', selector: '.notion-topbar-updates-button' }
      ]
    },
    'slash-menu': {
      label: 'Slash command dropdown (when visible)',
      selectors: [
        { strategy: 'role', selector: '[role="menu"][aria-label*="slash" i]' },
        { strategy: 'aria', selector: '[aria-label="Slash commands"]' },
        { strategy: 'context', selector: '.notion-slash-menu, [role="listbox"]' },
        { strategy: 'id', selector: '[data-testid="slash-menu"]' },
        { strategy: 'class', selector: '.notion-slash-menu' }
      ]
    },
    'database-view-tabs': {
      label: 'Database view tabs (Table, Board, Calendar, etc.)',
      selectors: [
        { strategy: 'role', selector: '[role="tablist"]' },
        { strategy: 'aria', selector: '[aria-label="Views"]' },
        { strategy: 'context', selector: '.notion-collection-view-tabs [role="tablist"]' },
        { strategy: 'id', selector: '[data-testid="view-tabs"]' },
        { strategy: 'class', selector: '.notion-collection-view-tab-bar' }
      ]
    },
    'database-filter-button': {
      label: 'Filter button in database views',
      selectors: [
        { strategy: 'aria', selector: '[aria-label="Filter"]' },
        { strategy: 'role', selector: '[role="button"][aria-label="Filter"]' },
        { strategy: 'context', selector: '.notion-collection-view-header [role="button"][aria-label*="Filter"]' },
        { strategy: 'id', selector: '[data-testid="filter-button"]' },
        { strategy: 'class', selector: '.notion-collection-filter-button' }
      ]
    },
    'database-sort-button': {
      label: 'Sort button in database views',
      selectors: [
        { strategy: 'aria', selector: '[aria-label="Sort"]' },
        { strategy: 'role', selector: '[role="button"][aria-label="Sort"]' },
        { strategy: 'context', selector: '.notion-collection-view-header [role="button"][aria-label*="Sort"]' },
        { strategy: 'id', selector: '[data-testid="sort-button"]' },
        { strategy: 'class', selector: '.notion-collection-sort-button' }
      ]
    },
    'database-new-button': {
      label: 'New button for new database row',
      selectors: [
        { strategy: 'aria', selector: '[aria-label="New"]' },
        { strategy: 'role', selector: '[role="button"][aria-label="New"]' },
        { strategy: 'context', selector: '.notion-collection-view [role="button"][aria-label*="New"]' },
        { strategy: 'id', selector: '[data-testid="new-row-button"]' },
        { strategy: 'class', selector: '.notion-collection-new-item-button' }
      ]
    }
  },
  selectors: {
    sidebarToggle: '[aria-label="Toggle sidebar"]',
    sidebarSearch: '[aria-label="Search"]',
    sidebarNewPage: '[aria-label="New page"]',
    pageTitle: '[aria-label="Title"], [placeholder*="Untitled"]',
    pageBody: '[data-content-editable-root="true"], .notion-page-content',
    breadcrumb: '[aria-label="Breadcrumb"], [role="navigation"] [role="list"]',
    shareButton: '[aria-label="Share"]',
    moreButton: '[aria-label="More"]',
    slashMenu: '[role="menu"][aria-label*="slash" i], .notion-slash-menu',
    databaseViewTabs: '[role="tablist"]',
    filterButton: '[aria-label="Filter"]',
    sortButton: '[aria-label="Sort"]'
  },
  workflows: {
    createPage: [
      'Press Ctrl+N to create a new page (or click "New page" in sidebar)',
      'A new blank page opens with the title field focused',
      'Type the page title',
      'Press Enter to move cursor into the page body',
      'Type your content -- each Enter creates a new block',
      'Use slash commands (/) to insert specific block types',
      'VERIFY: Page title appears in the sidebar navigation tree',
      'STUCK: If Ctrl+N does not work, click the sidebar "New page" button. If sidebar is hidden, press Ctrl+/ to toggle it first.'
    ],
    addBlocks: [
      'Click at the end of the last block on the page (or press Enter to create a new empty block)',
      'Type "/" to open the slash command menu',
      'Type the block type name (e.g., "h1", "todo", "code", "table")',
      'Press Enter to insert the selected block',
      'Type the block content',
      'Press Enter to create the next block',
      'VERIFY: The new block appears below with the correct type (heading style, checkbox, code formatting, etc.)',
      'STUCK: If slash menu does not appear, ensure cursor is at the start of an empty block. Try pressing Enter first to create a new empty block, then type "/".'
    ],
    createTodo: [
      'Click at the end of the last block or press Enter to create new block',
      'Type "/todo" and press Enter to insert a to-do checkbox block',
      'Type the task text next to the checkbox',
      'Press Enter to create the next to-do item automatically',
      'Repeat for all tasks',
      'To check/uncheck a todo: use the togglecheck command -- togglecheck N (where N is the todo number, e.g., togglecheck 1)',
      'VERIFY: Each line shows a checkbox with task text. Checked items show strikethrough text.',
      'STUCK: If /todo does not work, try Ctrl+Shift+4 to convert current block to a to-do. Or type "[]" followed by Space at the start of a line.'
    ],
    toggleTodo: [
      'CRITICAL: Notion todo checkboxes do NOT appear as element refs in the page snapshot. The checkbox is invisible to the DOM walker.',
      'Use the togglecheck command: togglecheck N  -- where N is the todo position (1 = first todo, 2 = second, etc.)',
      'togglecheck works by: (1) clicking the todo block to focus it, (2) pressing Escape to enter block selection mode, (3) pressing Ctrl+Enter which is the official Notion shortcut to toggle a to-do checkbox.',
      'Example: togglecheck 1 (checks/unchecks the first todo), togglecheck 2 (second todo), etc.',
      'To toggle ALL todos: use togglecheck 1, then togglecheck 2, then togglecheck 3, etc. -- one command per line, NOT batched.',
      'VERIFY: togglecheck returns { toggled: true/false, wasChecked, nowChecked }. If toggled is true, the checkbox state changed.',
      'STUCK: If togglecheck says "No Notion todo blocks found", scroll down first to render the todos. If toggled is false, click elsewhere on the page first to deselect, then retry.'
    ],
    createTable: [
      'Type "/table" and press Enter to insert a simple table',
      'A 3-column, 2-row table appears with the first cell focused',
      'Type content in the first cell',
      'Press Tab to move to the next cell (right)',
      'Press Enter within a cell to add a new line inside that cell',
      'Press Tab at the last column to move to the first cell of the next row',
      'Click the "+" at the bottom of the table to add a new row',
      'Click the "+" at the right of the table to add a new column',
      'VERIFY: Table appears with correct number of rows and columns, cells contain expected text',
      'STUCK: If /table does not appear, try typing "/simple table" or "/table - simple". For database table, use "/database" instead.'
    ],
    navigateDatabase: [
      'Open a page that contains a database (inline or full-page)',
      'Click the view tabs at the top of the database (Table, Board, Calendar, Gallery, List, Timeline)',
      'The data re-renders in the selected view format',
      'Click the Filter button to add property-based filters',
      'Click the Sort button to reorder entries',
      'Click "New" button or the "+" at the bottom to add a new entry',
      'Click any entry/row to open it as a full page',
      'VERIFY: View changes visually (e.g., Board shows columns, Calendar shows date grid). Filter/sort buttons show active indicator when applied.',
      'STUCK: If view tabs are not visible, the database might be inline -- scroll up to find the database header. Or search for the database page using Ctrl+K.'
    ],
    searchContent: [
      'Press Ctrl+K (or Ctrl+P) to open the Quick Search dialog',
      'Type your search query -- results update live as you type',
      'Use Arrow Down / Arrow Up to navigate through results',
      'Press Enter to open the selected result',
      'Search matches page titles, content text, and database entries',
      'VERIFY: The target page opens after pressing Enter. Breadcrumb shows the correct page.',
      'STUCK: If Ctrl+K does not open search, try clicking "Search" in the sidebar. If sidebar is hidden, press Ctrl+/ first.'
    ],
    moveBlock: [
      'Click on the target block to select it',
      'Use Ctrl+Shift+Up to move the block up one position',
      'Use Ctrl+Shift+Down to move the block down one position',
      'Repeat until the block is in the desired position',
      'Alternative: hover over block to reveal drag handle (six-dot icon), then drag to new position',
      'VERIFY: Block content appears in the new position. Surrounding blocks reflow correctly.',
      'STUCK: If keyboard move does not work, try the drag handle. If drag handle does not appear, click the block and use the "..." menu > "Move to" option.'
    ],
    linkToPage: [
      'Place cursor where you want to insert the link (in any text block)',
      'Type "[[" (two opening brackets) to open the page link popover',
      'Start typing the target page name -- results filter live',
      'Use Arrow Down / Arrow Up to navigate suggestions',
      'Press Enter to insert the link to the selected page',
      'The link appears inline as a styled page reference',
      'VERIFY: The linked page name appears as a clickable reference in the text. Hovering shows a preview.',
      'STUCK: If [[ does not trigger, try Ctrl+K to open the link dialog instead. Type the page name and select "Link to page".'
    ]
  },
  warnings: [
    'Notion uses CSS Modules -- class names change on EVERY deploy. NEVER rely on class selectors as primary strategy. Use aria/role attributes first, then [data-block-id] patterns.',
    'Slash commands only work at the start of an empty line or at cursor position in an empty block. They do NOT work in the middle of existing text. Press Enter first to create an empty block if needed.',
    'CONTENTEDITABLE BLOCKS: Click the target block FIRST to establish focus, then type. Without focus, keyboard shortcuts fire globally instead of entering text into the block.',
    '@ mentions and [[ page links open popovers that render asynchronously. Wait for the popover to appear before selecting from it. Use waitForElement or waitForDOMStable.',
    'Database views (Table, Board, Calendar, etc.) are different views of the SAME data. Switching views does not lose data or changes.',
    '"New page" in sidebar creates a top-level page. To create a sub-page INSIDE an existing page, use /page inside that page body.',
    'Notion auto-saves continuously -- there is NO save button. Changes persist immediately.',
    'Undo (Ctrl+Z) works within a session but has limits on cross-session undo. Undo history resets when closing and reopening a page.',
    'The sidebar can be collapsed/hidden. If sidebar elements are not found, press Ctrl+/ to toggle the sidebar open first.',
    'Block drag handles (six-dot icon) only appear on MOUSE HOVER. They are not visible by default. Prefer keyboard shortcuts (Ctrl+Shift+Up/Down) for block movement.',
    'Code blocks use a monospace editor with a language selection dropdown at the top. Click the language label to change the syntax highlighting language.',
    'Images and embeds use a separate upload/URL flow. /image opens a picker with tabs for Upload, Embed link, and Unsplash. Cannot fully automate file upload via keyboard.',
    'notion.site URLs are for PUBLISHED/public pages which are read-only. Editing requires accessing the page via notion.so workspace URL.',
    'When a page has a database, the database can be inline (embedded in page) or full-page. Inline databases show view tabs directly in the page. Full-page databases open as their own page.',
    'Notion renders blocks lazily -- blocks below the viewport may not be in the DOM until scrolled to. Use scrolling before trying to interact with blocks far down the page.',
    'CRITICAL -- TODO CHECKBOXES: Notion todo checkboxes do NOT appear as element refs in the page snapshot. Use the togglecheck command: togglecheck N (1-indexed position). togglecheck clicks the block, presses Escape to enter block selection mode, then Ctrl+Enter (official Notion shortcut) to toggle the checkbox. NEVER try to click the checkbox via element ref, CSS selector, hover, or doubleClick -- the checkbox element is invisible to the DOM. NEVER press Ctrl+Enter directly without first entering block selection mode via Escape.'
  ],
  toolPreferences: ['navigate', 'click', 'type', 'keyPress', 'togglecheck', 'waitForTabLoad', 'getText', 'waitForElement', 'getAttribute', 'waitForDOMStable']
});
