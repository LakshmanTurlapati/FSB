/**
 * Site Guide: Trello
 * Per-site guide for Trello board/card management application.
 * Selector strategy: data-testid first (Atlassian pattern), then aria, role, class, context.
 */

registerSiteGuide({
  site: 'Trello',
  category: 'Productivity Tools',
  patterns: [
    /trello\.com\/b\//i,
    /trello\.com\/c\//i,
    /trello\.com\/w\//i
  ],
  guidance: `TRELLO-SPECIFIC INTELLIGENCE:

KEYBOARD-FIRST INTERACTION:
  Trello has excellent built-in keyboard shortcuts. Prefer these over click actions.
  Cards and lists can be navigated and managed almost entirely with the keyboard.

KEYBOARD SHORTCUTS (always available on board view):
  N           — New card at bottom of current/focused list
  ?           — Show all keyboard shortcuts overlay
  /           — Focus search input in header
  B           — Open board menu / board switcher
  W           — Toggle sidebar (board menu)
  F           — Open filter menu
  Q           — Toggle "My Cards" filter (show only cards assigned to you)
  Arrow keys  — Navigate between cards when a card has focus
  Enter       — Open the selected/focused card detail modal
  E           — Quick edit the selected card (inline edit on board)
  C           — Archive the selected card
  L           — Open labels picker on the selected card
  D           — Open due date picker on the selected card
  Space       — Assign/unassign yourself to the selected card
  M           — Add/remove members from the selected card
  T           — Edit the title of the selected card
  S           — Toggle watching (subscribe) on the selected card
  -           — Toggle label text (show/hide label names on board)
  Escape      — Close any open modal, popover, or menu

BOARD STRUCTURE:
  Trello boards contain LISTS (columns). Lists contain CARDS (items).
  Cards are the primary work item. Boards are the top-level container.

CARD DETAIL MODAL:
  Opening a card (Enter or click) shows a modal overlay.
  Wait for the modal to render before interacting: look for [data-testid="card-back"] or [role="dialog"].
  The modal contains: title, description, labels, due date, members, checklist, attachments, comments.
  Close modal with Escape or clicking outside it.

MOVING CARDS (keyboard alternative to drag-and-drop):
  1. Open card detail (Enter on card)
  2. Click "Move" action button in the card detail sidebar
  3. Select destination list from the dropdown
  4. Click "Move" to confirm
  This is MORE RELIABLE than drag-and-drop. Trello uses react-beautiful-dnd which resists synthetic events.

CREATING CARDS:
  Method 1 (keyboard): Focus a list, press N, type card title, press Enter to save
  Method 2 (click): Click "Add a card" at bottom of a list, type title, click "Add card" or press Enter
  The card composer input disappears on click outside — type immediately after opening.

CREATING LISTS:
  Click "Add another list" button (rightmost on board canvas)
  Type list name, press Enter or click "Add list"

COMMON PATTERNS:
  # Create a card in a specific list:
  click on the target list header to focus it
  key "n"              # opens card composer at bottom of that list
  type "Card title"    # type into card composer
  key "Enter"          # save the card

  # Open a card and edit description:
  navigate to card with arrow keys
  key "Enter"          # open card detail modal
  waitForElement [data-testid="card-back"]  # wait for modal
  click description area
  type "Description text"

  # Move a card between lists via menu:
  key "Enter"          # open card detail
  click "Move" button in sidebar
  select destination list
  click "Move"

FEEDBACK LOOP:
  After creating a card, verify by looking for the new card element in the target list.
  After moving a card, verify it appears in the destination list and is gone from the source list.
  Card detail modal changes are auto-saved — no explicit save button needed for most fields.`,
  fsbElements: {
    'board-header': {
      label: 'Board header/title area',
      selectors: [
        { strategy: 'data-testid', selector: '[data-testid="board-name-display"]' },
        { strategy: 'aria', selector: '[aria-label="Board name"]' },
        { strategy: 'role', selector: 'h1[role="heading"]' },
        { strategy: 'class', selector: '.board-header-btn-name' },
        { strategy: 'context', selector: '#board-header h1, .board-header .board-header-btn-name' }
      ]
    },
    'add-list-button': {
      label: 'Add another list button',
      selectors: [
        { strategy: 'data-testid', selector: '[data-testid="list-composer-button"]' },
        { strategy: 'aria', selector: '[aria-label="Add another list"]' },
        { strategy: 'role', selector: '[role="button"][name="Add another list"]' },
        { strategy: 'class', selector: '.js-add-list, .placeholder' },
        { strategy: 'context', selector: '#board .js-add-list, .list-wrapper:last-child [role="button"]' }
      ]
    },
    'add-card-button': {
      label: 'Add a card button (per list)',
      selectors: [
        { strategy: 'data-testid', selector: '[data-testid="list-add-card-button"]' },
        { strategy: 'aria', selector: '[aria-label="Add a card"]' },
        { strategy: 'role', selector: '[role="button"][data-testid*="add-card"]' },
        { strategy: 'class', selector: '.js-add-card, .card-composer-container button' },
        { strategy: 'context', selector: '.list-cards + [role="button"], .open-card-composer' }
      ]
    },
    'card-composer': {
      label: 'Card title input when adding new card',
      selectors: [
        { strategy: 'data-testid', selector: '[data-testid="list-card-composer-textarea"]' },
        { strategy: 'aria', selector: 'textarea[aria-label="Enter a title for this card"]' },
        { strategy: 'role', selector: 'textarea[role="textbox"]' },
        { strategy: 'class', selector: '.card-composer-container textarea, .list-card-composer-textarea' },
        { strategy: 'context', selector: '.card-composer textarea, .js-card-title' }
      ]
    },
    'card-item': {
      label: 'Individual card in a list (first visible)',
      selectors: [
        { strategy: 'data-testid', selector: '[data-testid="trello-card"]' },
        { strategy: 'aria', selector: '[aria-label][data-testid="trello-card"]' },
        { strategy: 'role', selector: '[role="link"][data-testid="trello-card"]' },
        { strategy: 'class', selector: '.list-card, .trello-card' },
        { strategy: 'context', selector: '.list-cards .list-card:first-child, [data-testid="list-cards"] > :first-child' }
      ]
    },
    'list-header': {
      label: 'List title/header',
      selectors: [
        { strategy: 'data-testid', selector: '[data-testid="list-name"]' },
        { strategy: 'aria', selector: '[aria-label="List name"]' },
        { strategy: 'role', selector: 'h2[role="heading"], textarea[aria-label*="list"]' },
        { strategy: 'class', selector: '.list-header-name, .list-header-name-assist' },
        { strategy: 'context', selector: '.list-header textarea, .list-header h2' }
      ]
    },
    'list-wrapper': {
      label: 'Individual list container',
      selectors: [
        { strategy: 'data-testid', selector: '[data-testid="list"]' },
        { strategy: 'aria', selector: '[aria-label][data-testid="list"]' },
        { strategy: 'role', selector: '[role="list"]' },
        { strategy: 'class', selector: '.list-wrapper, .js-list' },
        { strategy: 'context', selector: '#board .list-wrapper, .board-canvas .list' }
      ]
    },
    'board-canvas': {
      label: 'Main board scrollable area',
      selectors: [
        { strategy: 'data-testid', selector: '[data-testid="board-canvas"]' },
        { strategy: 'aria', selector: '[aria-label="Board canvas"]' },
        { strategy: 'role', selector: '[role="main"]' },
        { strategy: 'class', selector: '.board-canvas, #board' },
        { strategy: 'context', selector: '#content .board-canvas, .board-wrapper #board' }
      ]
    },
    'search-button': {
      label: 'Search icon/button in header',
      selectors: [
        { strategy: 'data-testid', selector: '[data-testid="header-search-input"]' },
        { strategy: 'aria', selector: '[aria-label="Search"]' },
        { strategy: 'role', selector: 'input[role="search"], [role="button"][aria-label*="Search"]' },
        { strategy: 'class', selector: '.header-search-input' },
        { strategy: 'context', selector: 'header [aria-label="Search"], #header input[type="text"]' }
      ]
    },
    'member-button': {
      label: 'Members button in board header',
      selectors: [
        { strategy: 'data-testid', selector: '[data-testid="board-header-members-button"]' },
        { strategy: 'aria', selector: '[aria-label="Members"]' },
        { strategy: 'role', selector: '[role="button"][aria-label*="Members"]' },
        { strategy: 'class', selector: '.board-header-btn-member' },
        { strategy: 'context', selector: '.board-header [aria-label="Members"]' }
      ]
    },
    'filter-button': {
      label: 'Filter cards button',
      selectors: [
        { strategy: 'data-testid', selector: '[data-testid="filter-popover-button"]' },
        { strategy: 'aria', selector: '[aria-label="Filter"]' },
        { strategy: 'role', selector: '[role="button"][aria-label*="Filter"]' },
        { strategy: 'class', selector: '.board-header-btn-filter' },
        { strategy: 'context', selector: '.board-header [aria-label="Filter"]' }
      ]
    },
    'menu-button': {
      label: 'Board menu (show menu / ...)',
      selectors: [
        { strategy: 'data-testid', selector: '[data-testid="board-header-more-menu-button"]' },
        { strategy: 'aria', selector: '[aria-label="Show menu"]' },
        { strategy: 'role', selector: '[role="button"][aria-label*="menu" i]' },
        { strategy: 'class', selector: '.board-header-btn-menu, .board-menu-btn' },
        { strategy: 'context', selector: '.board-header [aria-label*="menu" i]' }
      ]
    },
    'notification-button': {
      label: 'Notifications bell',
      selectors: [
        { strategy: 'data-testid', selector: '[data-testid="header-notifications-button"]' },
        { strategy: 'aria', selector: '[aria-label="Notifications"]' },
        { strategy: 'role', selector: '[role="button"][aria-label*="Notification"]' },
        { strategy: 'class', selector: '.header-notifications' },
        { strategy: 'context', selector: 'header [aria-label*="Notification"]' }
      ]
    },
    'card-detail-title': {
      label: 'Card title in detail modal',
      selectors: [
        { strategy: 'data-testid', selector: '[data-testid="card-back-title-input"]' },
        { strategy: 'aria', selector: '[aria-label="Card title"]' },
        { strategy: 'role', selector: 'textarea[aria-label*="title" i]' },
        { strategy: 'class', selector: '.card-detail-title-assist, .js-card-detail-title-input' },
        { strategy: 'context', selector: '[data-testid="card-back"] textarea, .card-detail-header textarea' }
      ]
    },
    'card-detail-description': {
      label: 'Card description in detail modal',
      selectors: [
        { strategy: 'data-testid', selector: '[data-testid="card-back-description"]' },
        { strategy: 'aria', selector: '[aria-label="Description"]' },
        { strategy: 'role', selector: '[role="textbox"][aria-label*="Description" i]' },
        { strategy: 'class', selector: '.card-detail-description, .js-desc' },
        { strategy: 'context', selector: '[data-testid="card-back"] .description-content, .card-detail-data .description' }
      ]
    },
    'card-detail-labels': {
      label: 'Labels section in card detail',
      selectors: [
        { strategy: 'data-testid', selector: '[data-testid="card-back-labels-container"]' },
        { strategy: 'aria', selector: '[aria-label="Labels"]' },
        { strategy: 'role', selector: '[role="list"][aria-label*="Labels"]' },
        { strategy: 'class', selector: '.card-detail-labels, .js-card-detail-labels' },
        { strategy: 'context', selector: '[data-testid="card-back"] .card-detail-item-labels' }
      ]
    },
    'card-detail-due-date': {
      label: 'Due date section in card detail',
      selectors: [
        { strategy: 'data-testid', selector: '[data-testid="card-back-due-date-button"]' },
        { strategy: 'aria', selector: '[aria-label="Due date"]' },
        { strategy: 'role', selector: '[role="button"][aria-label*="Due date"]' },
        { strategy: 'class', selector: '.card-detail-due-date, .js-card-detail-due-date' },
        { strategy: 'context', selector: '[data-testid="card-back"] .due-date-badge, .card-detail-data .due-date' }
      ]
    },
    'card-detail-checklist': {
      label: 'Checklist section in card detail',
      selectors: [
        { strategy: 'data-testid', selector: '[data-testid="card-back-checklist"]' },
        { strategy: 'aria', selector: '[aria-label="Checklist"]' },
        { strategy: 'role', selector: '[role="list"][aria-label*="Checklist"]' },
        { strategy: 'class', selector: '.checklist, .js-checklist' },
        { strategy: 'context', selector: '[data-testid="card-back"] .checklist-list, .card-detail-data .checklist' }
      ]
    }
  },
  selectors: {
    boardHeader: '[data-testid="board-name-display"], .board-header-btn-name',
    addListButton: '[data-testid="list-composer-button"], .js-add-list',
    addCardButton: '[data-testid="list-add-card-button"], .open-card-composer',
    cardComposer: '[data-testid="list-card-composer-textarea"], .card-composer textarea',
    cardItem: '[data-testid="trello-card"], .list-card',
    listHeader: '[data-testid="list-name"], .list-header-name',
    listWrapper: '[data-testid="list"], .list-wrapper',
    boardCanvas: '[data-testid="board-canvas"], #board',
    searchInput: '[data-testid="header-search-input"], [aria-label="Search"]',
    filterButton: '[data-testid="filter-popover-button"], [aria-label="Filter"]',
    menuButton: '[data-testid="board-header-more-menu-button"], [aria-label="Show menu"]',
    cardDetailModal: '[data-testid="card-back"], [role="dialog"]',
    cardDetailTitle: '[data-testid="card-back-title-input"], .js-card-detail-title-input',
    cardDetailDescription: '[data-testid="card-back-description"], .js-desc',
    moveButton: '[data-testid="card-back-move-card-button"], .js-move-card'
  },
  workflows: {
    createCard: [
      'Focus the target list by clicking its header or a card within it',
      'Press N to open the card composer at the bottom of the focused list',
      'ALTERNATIVE: Click "Add a card" button at the bottom of the target list',
      'Type the card title into the composer textarea',
      'Press Enter to save the card (or click "Add card" button)',
      'The card appears at the bottom of the list',
      'VERIFY: Check that a new card element appears in the list with the expected title',
      'STUCK: If N does not open composer, click the "Add a card" button directly. If composer disappears, click "Add a card" again — it dismisses on outside click'
    ],
    moveCard: [
      'Navigate to the card using arrow keys or click the card',
      'Press Enter to open the card detail modal',
      'Wait for the modal to render: waitForElement [data-testid="card-back"] or [role="dialog"]',
      'In the card detail sidebar, click the "Move" action button',
      'A popover appears with list/board selectors',
      'Select the destination list from the dropdown',
      'Optionally select a position within the destination list',
      'Click the "Move" button to confirm',
      'Press Escape to close the card detail modal',
      'VERIFY: Check the card now appears in the destination list and is gone from the source list',
      'STUCK: If "Move" button is not visible, scroll down in the card sidebar. If popover does not appear, press Escape and try again. Do NOT attempt drag-and-drop — use this Move button workflow instead'
    ],
    editCard: [
      'Navigate to the target card using arrow keys',
      'Press E for quick inline edit (edits title on the board without opening modal)',
      'ALTERNATIVE: Press Enter to open full card detail modal for all fields',
      'In quick edit mode: modify the title text, press Enter to save',
      'In detail modal: click the field to edit (title, description, etc.), make changes',
      'Description uses a rich text editor — click "Save" after editing description',
      'Other fields (labels, due date, members) auto-save on selection',
      'VERIFY: After editing, check the card displays the updated content on the board',
      'STUCK: If quick edit (E) does not work, use Enter to open full detail modal instead'
    ],
    createList: [
      'Scroll the board canvas to the right to find the "Add another list" button',
      'Click the "Add another list" button',
      'A text input appears for the list name',
      'Type the list name',
      'Press Enter or click "Add list" to save',
      'The new list appears on the board with the given name',
      'VERIFY: A new list column appears with the expected name in the header',
      'STUCK: If the button is not visible, scroll the board canvas horizontally to the right. Use Tab to cycle through board elements until the add list input is focused'
    ],
    addLabel: [
      'Navigate to the target card and press Enter to open card detail',
      'Wait for modal: waitForElement [data-testid="card-back"]',
      'Press L to open the labels popover (or click "Labels" in the sidebar)',
      'The labels popover shows available label colors',
      'Click a label color to toggle it on/off for this card',
      'To create a new label: click "Create a new label" at the bottom of the popover',
      'Enter label text (optional) and select a color, then click "Create"',
      'Press Escape to close the labels popover',
      'VERIFY: The selected label(s) appear on the card in the detail view and on the board',
      'STUCK: If L shortcut does not open labels, click the "Labels" button in the card detail sidebar. If no labels popover appears, click outside and try the sidebar button'
    ],
    setDueDate: [
      'Navigate to the target card and press Enter to open card detail',
      'Wait for modal: waitForElement [data-testid="card-back"]',
      'Press D to open the due date picker (or click "Dates" in the sidebar)',
      'A date picker popover appears with a calendar',
      'Click the desired due date on the calendar',
      'Optionally set a due time in the time field',
      'Click "Save" to confirm the due date',
      'VERIFY: The due date badge appears on the card in the detail view and on the board',
      'STUCK: If D shortcut does not work, click "Dates" in the card detail sidebar. If calendar does not render, press Escape and try clicking "Dates" again'
    ],
    searchCards: [
      'Press / to focus the search input in the header',
      'ALTERNATIVE: Click the search input in the top navigation bar',
      'Type the search query (card title, label, member name, etc.)',
      'Press Enter to execute the search',
      'Search results appear showing matching cards across boards',
      'Click a result to open that card detail',
      'VERIFY: Search results contain cards matching the query',
      'STUCK: If / does not focus search, click the search icon in the header directly. If no results appear, try broader search terms'
    ],
    navigateBoard: [
      'Use arrow keys (Up/Down) to navigate between cards within a list',
      'Use arrow keys (Left/Right) to navigate between lists',
      'Press Tab to cycle focus between major board elements',
      'Press B to open the board switcher for navigating to another board',
      'Press W to toggle the board sidebar/menu',
      'Press Enter on a focused card to open its detail',
      'Press Escape to close any open modal or popover',
      'VERIFY: The expected card or list has visible focus indicator',
      'STUCK: If keyboard navigation does not seem to work, click any card first to establish focus on the board, then use arrow keys'
    ]
  },
  warnings: [
    'Card detail is a MODAL OVERLAY — it renders on top of the board. Always wait for [data-testid="card-back"] or [role="dialog"] before interacting with card detail elements. Clicking outside the modal closes it.',
    '"Add a card" button is PER-LIST — each list has its own add button at the bottom. Make sure you click the correct one for the target list.',
    'Trello uses react-beautiful-dnd for drag-and-drop — synthetic mouse/pointer events will likely NOT trigger successful drags. Use the Move button in card detail as the reliable alternative. The dragdrop mechanical tool may work but is not guaranteed on Trello.',
    'Board canvas scrolls HORIZONTALLY — lists beyond the viewport require horizontal scroll. If a list or the "Add another list" button is not visible, scroll right.',
    'Card composer (add card input) DISAPPEARS on click outside — type the card title immediately after opening the composer. If you click elsewhere, you need to click "Add a card" again.',
    'Archived cards are NOT deleted — they remain accessible via the board menu > "Archived items". Pressing C archives a card, it does not delete it.',
    'Labels have COLORS and optional TEXT — clicking a label color without entering text creates an unnamed (color-only) label. This is valid but may be confusing when filtering.',
    'Checklist items in card detail use their OWN Enter key handling — pressing Enter in a checklist item adds a new checklist item below, it does not close the modal.',
    'Trello keyboard shortcuts only work when focus is on the BOARD — if focus is inside a text input (card composer, search, etc.), shortcuts act as normal text input. Press Escape first to exit the input.',
    'Card title quick edit (E key) opens an inline editor ON THE BOARD, not the full detail modal. Press Enter in quick edit to save, or Escape to cancel.',
    'Multiple boards may have the same name — always check the URL to confirm you are on the correct board.',
    'Power-Ups and custom fields may add extra UI elements to card detail — wait for the full modal to render before looking for specific sections.'
  ],
  toolPreferences: ['navigate', 'click', 'type', 'keyPress', 'waitForTabLoad', 'getText', 'waitForElement', 'getAttribute', 'waitForDOMStable']
});
