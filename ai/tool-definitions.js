/**
 * Canonical Tool Registry for FSB Browser Automation
 *
 * Single source of truth for all 43 browser automation tool definitions.
 * Shared between autopilot (agent loop) and MCP server.
 *
 * Per D-11/D-12: Each tool is a plain object with JSON Schema inputSchema
 * and routing metadata (_route, _readOnly, _contentVerb, _cdpVerb).
 *
 * Per D-01: All tool names use snake_case matching MCP convention.
 * Per D-04: All 43 tools defined from day one.
 *
 * @module tool-definitions
 */

'use strict';

/**
 * @typedef {Object} ToolDefinition
 * @property {string} name - snake_case tool name (per D-01)
 * @property {string} description - When to use, what it does, related tools
 * @property {Object} inputSchema - JSON Schema object with type, properties, required
 * @property {'content'|'cdp'|'background'} _route - Execution route
 * @property {boolean} _readOnly - True for read-only tools that bypass mutation queue
 * @property {string|null} _contentVerb - FSB.tools key for content-routed tools
 * @property {string|null} _cdpVerb - executeCDPToolDirect switch case for CDP tools
 */

/**
 * All 43 browser automation tool definitions.
 * Grouped by category: Navigation, Interaction, Scrolling, Waiting, Tabs, Data, CDP, Read-Only.
 * @type {ToolDefinition[]}
 */
const TOOL_REGISTRY = [

  // =========================================================================
  // NAVIGATION TOOLS (5 tools)
  // =========================================================================

  {
    name: 'navigate',
    description: 'Open a URL in the active browser tab. Returns the final URL after any redirects. When to use: as the first step to reach a target website. Related: read_page (read content after navigating), list_tabs (see what tabs are already open).',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL to navigate to' }
      },
      required: ['url']
    },
    _route: 'background',
    _readOnly: false,
    _contentVerb: null,
    _cdpVerb: null
  },

  {
    name: 'search',
    description: 'Search for content on the current site or web. When to use: to find content on the current site or web. Automatically detects the site\'s search input (Amazon, YouTube, GitHub, etc.) via DOM heuristics -- only falls back to Google when no site search exists. Returns search results status. Related: read_page (read search results after searching), click (click a specific search result).',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query text' }
      },
      required: ['query']
    },
    _route: 'content',
    _readOnly: false,
    _contentVerb: 'siteSearch',
    _cdpVerb: null
  },

  {
    name: 'go_back',
    description: 'Navigate back one page in browser history. Returns the new URL. When to use: to return to the previous page after following a link or navigating away. Related: go_forward (undo a go_back), navigate (go to a specific URL instead).',
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    },
    _route: 'background',
    _readOnly: false,
    _contentVerb: null,
    _cdpVerb: null
  },

  {
    name: 'go_forward',
    description: 'Navigate forward one page in browser history. Returns the new URL. When to use: after using go_back, to move forward again. Related: go_back (go back in history), navigate (go to a specific URL instead).',
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    },
    _route: 'background',
    _readOnly: false,
    _contentVerb: null,
    _cdpVerb: null
  },

  {
    name: 'refresh',
    description: 'Reload the current page. Returns the refreshed URL. When to use: when page content may be stale, after errors, or to reset page state. Related: navigate (go to a different URL), wait_for_stable (wait for page to settle after refresh).',
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    },
    _route: 'background',
    _readOnly: false,
    _contentVerb: null,
    _cdpVerb: null
  },

  // =========================================================================
  // INTERACTION TOOLS (14 tools)
  // =========================================================================

  {
    name: 'click',
    description: 'Click an element on the page. When to use: to press buttons, follow links, activate controls, or select items. Get selectors from get_dom_snapshot first. If click fails, try refreshing selectors with get_dom_snapshot or use click_at with viewport coordinates. Returns whether the click succeeded. Related: get_dom_snapshot (find element selectors/refs), click_at (coordinate-based fallback for canvas/overlay elements), hover (for menus that need hover before click).',
    inputSchema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector or element reference from get_dom_snapshot (e.g., "#submit-btn", ".nav-link", or element ref "e5")' }
      },
      required: ['selector']
    },
    _route: 'content',
    _readOnly: false,
    _contentVerb: 'click',
    _cdpVerb: null
  },

  {
    name: 'type_text',
    description: 'Type text into an input field by selector. When to use: to fill text inputs, search boxes, or text areas. Use clear_input first if the field already has text. Returns confirmation of typed text. Related: clear_input (clear field before typing), press_enter (submit after typing), get_dom_snapshot (find input selectors).',
    inputSchema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector or element ref for the input field (e.g., "#email", "input[name=search]", or "e12" from get_dom_snapshot)' },
        text: { type: 'string', description: 'Text to type into the field' }
      },
      required: ['selector', 'text']
    },
    _route: 'content',
    _readOnly: false,
    _contentVerb: 'type',
    _cdpVerb: null
  },

  {
    name: 'press_enter',
    description: 'Press the Enter key to submit a form or confirm input. When to use: after typing into a search box or form field. Automatically falls back to clicking the submit button if Enter has no effect. Returns key press confirmation. Related: type_text (type before pressing Enter), click (click submit button directly).',
    inputSchema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'Optional CSS selector or element reference to press Enter on' }
      },
      required: []
    },
    _route: 'content',
    _readOnly: false,
    _contentVerb: 'pressEnter',
    _cdpVerb: null
  },

  {
    name: 'press_key',
    description: 'Press a keyboard key with optional modifiers (ctrl, shift, alt). Returns key press confirmation. When to use: for keyboard shortcuts (Ctrl+C, Ctrl+V), special keys (Escape, Tab, ArrowDown), or key combinations. Related: press_enter (dedicated Enter key tool), type_text (type full strings), focus (focus element before sending keys).',
    inputSchema: {
      type: 'object',
      properties: {
        key: { type: 'string', description: 'Key to press (e.g., \'Escape\', \'Tab\', \'ArrowDown\')' },
        ctrl: { type: 'boolean', description: 'Hold Ctrl' },
        shift: { type: 'boolean', description: 'Hold Shift' },
        alt: { type: 'boolean', description: 'Hold Alt' }
      },
      required: ['key']
    },
    _route: 'content',
    _readOnly: false,
    _contentVerb: 'keyPress',
    _cdpVerb: null
  },

  {
    name: 'select_option',
    description: 'Select an option from a dropdown by value. When to use: to choose from <select> dropdown menus. Returns the selected value. Related: get_dom_snapshot (find select element selectors), click (for custom non-native dropdowns).',
    inputSchema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector or element ref for the <select> dropdown (e.g., "#country", "select[name=size]", or "e8")' },
        value: { type: 'string', description: 'Option value attribute or visible text (e.g., "US", "Large", "Option 3")' }
      },
      required: ['selector', 'value']
    },
    _route: 'content',
    _readOnly: false,
    _contentVerb: 'selectOption',
    _cdpVerb: null
  },

  {
    name: 'check_box',
    description: 'Toggle a checkbox element. Returns the new checked state. When to use: to check or uncheck form checkboxes or toggle switches. Related: get_dom_snapshot (find checkbox selectors), click (alternative for custom checkbox UI components).',
    inputSchema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector or element reference for the checkbox' }
      },
      required: ['selector']
    },
    _route: 'content',
    _readOnly: false,
    _contentVerb: 'toggleCheckbox',
    _cdpVerb: null
  },

  {
    name: 'hover',
    description: 'Move the mouse over an element. Returns hover confirmation. When to use: to reveal dropdown menus, tooltips, or hover-activated content before clicking. Related: click (click revealed menu item after hover), get_dom_snapshot (find element selectors).',
    inputSchema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector or element reference to hover over' }
      },
      required: ['selector']
    },
    _route: 'content',
    _readOnly: false,
    _contentVerb: 'hover',
    _cdpVerb: null
  },

  {
    name: 'right_click',
    description: 'Open context menu on an element. Returns context menu confirmation. When to use: to access right-click context menu options on an element. Related: click (standard left-click), get_dom_snapshot (find element selectors).',
    inputSchema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector or element reference to right-click' }
      },
      required: ['selector']
    },
    _route: 'content',
    _readOnly: false,
    _contentVerb: 'rightClick',
    _cdpVerb: null
  },

  {
    name: 'double_click',
    description: 'Double-click an element. Returns click confirmation. When to use: for actions requiring double-click such as selecting a word, opening items in file managers, or activating edit mode. Related: click (single click), select_text_range (precise text selection by offsets), get_dom_snapshot (find element selectors).',
    inputSchema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector or element reference to double-click' }
      },
      required: ['selector']
    },
    _route: 'content',
    _readOnly: false,
    _contentVerb: 'doubleClick',
    _cdpVerb: null
  },

  {
    name: 'select_text_range',
    description: 'Select a specific substring within a DOM element by character offsets. Uses the Range API to highlight text from startOffset to endOffset within the element\'s text content. Essential for precise text selection like highlighting a specific sentence in a paragraph. Returns the selected text for verification. For selecting an entire element\'s text, use double-click instead. Related: double_click (select entire word/element text), get_text (read element text to determine offsets), get_dom_snapshot (find container selectors).',
    inputSchema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector or element reference for the container element (e.g., "#mw-content-text p:nth-of-type(3)" for third paragraph)' },
        startOffset: { type: 'number', description: 'Character offset where selection starts (0-based, counting from start of element text content)' },
        endOffset: { type: 'number', description: 'Character offset where selection ends (exclusive, like string.substring)' }
      },
      required: ['selector', 'startOffset', 'endOffset']
    },
    _route: 'content',
    _readOnly: false,
    _contentVerb: 'selectTextRange',
    _cdpVerb: null
  },

  {
    name: 'drag_drop',
    description: 'Drag and drop one DOM element onto another using element references. Tries three methods in order: HTML5 DragEvent (dragstart/drop), PointerEvent sequence (for react-beautiful-dnd and similar libraries), and MouseEvent sequence (basic fallback). Use for Kanban card reordering, sortable lists, file drag targets, or any drag-and-drop interaction between two identifiable DOM elements. Returns which method succeeded. For canvas/coordinate-based drag, use the drag tool instead. Related: drag (coordinate-based drag for canvas/map), drop_file (drop files onto upload zones), get_dom_snapshot (find source and target element refs).',
    inputSchema: {
      type: 'object',
      properties: {
        sourceSelector: { type: 'string', description: 'CSS selector or element reference (e.g., "e5", "#card-1") for the element to drag' },
        targetSelector: { type: 'string', description: 'CSS selector or element reference (e.g., "e12", "#column-2") for the drop target element' },
        steps: { type: 'number', description: 'Number of intermediate move events during drag (default 10)' },
        holdMs: { type: 'number', description: 'Milliseconds to hold before starting drag motion (default 150, increase for libraries that need longer press)' },
        stepDelayMs: { type: 'number', description: 'Delay in ms between each move step (default 20)' }
      },
      required: ['sourceSelector', 'targetSelector']
    },
    _route: 'content',
    _readOnly: false,
    _contentVerb: 'dragdrop',
    _cdpVerb: null
  },

  {
    name: 'drop_file',
    description: 'Simulate dropping a file onto a dropzone element. Creates a synthetic File with the given name, content, and MIME type, then dispatches HTML5 DragEvent sequence (dragenter, dragover, drop) on the target element. Use for file upload dropzones (Dropzone.js, react-dropzone, native HTML5 drop handlers). For drag-and-drop of DOM elements (not files), use drag_drop instead. Related: drag_drop (drag DOM elements between containers), get_dom_snapshot (find dropzone selectors).',
    inputSchema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector for the dropzone element (the area where files are dropped)' },
        fileName: { type: 'string', description: 'Name of the synthetic file to drop (e.g., "photo.jpg", "document.pdf")' },
        fileContent: { type: 'string', description: 'Text content of the file (for text-based files)' },
        mimeType: { type: 'string', description: 'MIME type of the file (e.g., "text/plain", "image/png", "application/pdf")' }
      },
      required: ['selector']
    },
    _route: 'content',
    _readOnly: false,
    _contentVerb: 'dropfile',
    _cdpVerb: null
  },

  {
    name: 'focus',
    description: 'Move keyboard focus to an element. Returns focus confirmation. When to use: to prepare an element for keyboard input, or to bring an element into the accessibility focus ring. Related: type_text (type into a focused input), press_key (send keystrokes to focused element), click (also focuses the clicked element).',
    inputSchema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector or element reference to focus' }
      },
      required: ['selector']
    },
    _route: 'content',
    _readOnly: false,
    _contentVerb: 'focus',
    _cdpVerb: null
  },

  {
    name: 'clear_input',
    description: 'Clear the contents of an input field. Returns clear confirmation. When to use: before typing new text into an already-filled field to remove existing content. Related: type_text (type new text after clearing), get_dom_snapshot (find input selectors).',
    inputSchema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector or element reference for the input to clear' }
      },
      required: ['selector']
    },
    _route: 'content',
    _readOnly: false,
    _contentVerb: 'clearInput',
    _cdpVerb: null
  },

  // =========================================================================
  // SCROLLING TOOLS (4 tools)
  // =========================================================================

  {
    name: 'scroll',
    description: 'Scroll the page up or down by a specified amount. Returns new scroll position. When to use: to bring off-screen content into view, load lazy-loaded content, or navigate long pages. Related: scroll_to_top, scroll_to_bottom (quick jumps), read_page (read content after scrolling).',
    inputSchema: {
      type: 'object',
      properties: {
        direction: { type: 'string', enum: ['up', 'down'], description: 'Scroll direction' },
        amount: { type: 'number', description: 'Scroll amount in pixels (default: one viewport)' }
      },
      required: ['direction']
    },
    _route: 'content',
    _readOnly: false,
    _contentVerb: 'scroll',
    _cdpVerb: null
  },

  {
    name: 'scroll_to_top',
    description: 'Scroll to the top of the page. Returns confirmation. When to use: to return to the beginning of the page or reset scroll position. Related: scroll_to_bottom (jump to end), scroll (scroll by specific amount), read_page (read content after scrolling).',
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    },
    _route: 'content',
    _readOnly: false,
    _contentVerb: 'scrollToTop',
    _cdpVerb: null
  },

  {
    name: 'scroll_to_bottom',
    description: 'Scroll to the bottom of the page. Returns confirmation. When to use: to reach the end of the page, load lazy content, or trigger infinite scroll. Related: scroll_to_top (jump to beginning), scroll (scroll by specific amount), read_page (read content after scrolling).',
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    },
    _route: 'content',
    _readOnly: false,
    _contentVerb: 'scrollToBottom',
    _cdpVerb: null
  },

  {
    name: 'scroll_to_element',
    description: 'Scroll a specific element into the visible viewport. Returns confirmation with element position. When to use: when you need to bring a particular element into view before interacting with it, especially on long pages where the element is off-screen. Related: scroll (scroll by pixel amount), click (interact after scrolling into view), get_dom_snapshot (find element selectors).',
    inputSchema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector or element reference to scroll into view' }
      },
      required: ['selector']
    },
    _route: 'content',
    _readOnly: false,
    _contentVerb: 'scrollToElement',
    _cdpVerb: null
  },

  // =========================================================================
  // WAITING TOOLS (2 tools)
  // =========================================================================

  {
    name: 'wait_for_element',
    description: 'Wait until an element matching the selector appears on the page. Returns when element is found or times out. When to use: after navigation or actions that load new content asynchronously. Related: wait_for_stable (wait for all DOM changes to settle), read_page (read content after element appears).',
    inputSchema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector to wait for (e.g., ".results-loaded", "#content", "table.data") -- must be CSS, not element ref' }
      },
      required: ['selector']
    },
    _route: 'content',
    _readOnly: false,
    _contentVerb: 'waitForElement',
    _cdpVerb: null
  },

  {
    name: 'wait_for_stable',
    description: 'Wait until the page stops changing (no DOM mutations). Returns when page is stable. When to use: after actions that trigger dynamic content loading, animations, or AJAX requests. Note: read_page already auto-waits for stability internally. Related: wait_for_element (wait for a specific element), read_page (read content after page stabilizes).',
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    },
    _route: 'content',
    _readOnly: false,
    _contentVerb: 'waitForDOMStable',
    _cdpVerb: null
  },

  // =========================================================================
  // TAB TOOLS (2 tools)
  // =========================================================================

  {
    name: 'open_tab',
    description: 'Open a new browser tab with the given URL. Returns the new tab ID. When to use: when you need to work on a different site without losing the current page. Related: switch_tab (switch between open tabs), list_tabs (see all open tabs), navigate (change URL in current tab instead).',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL to open in new tab' }
      },
      required: ['url']
    },
    _route: 'background',
    _readOnly: false,
    _contentVerb: null,
    _cdpVerb: null
  },

  {
    name: 'switch_tab',
    description: 'Switch the active browser tab by tab ID. Returns confirmation with the new active tab info. When to use: to move between open tabs for multi-tab workflows. Related: list_tabs (get available tab IDs first), open_tab (open a new tab).',
    inputSchema: {
      type: 'object',
      properties: {
        tabId: { type: 'number', description: 'Tab ID to switch to (get IDs from list_tabs tool)' }
      },
      required: ['tabId']
    },
    _route: 'background',
    _readOnly: false,
    _contentVerb: null,
    _cdpVerb: null
  },

  // =========================================================================
  // DATA TOOLS (2 tools)
  // =========================================================================

  {
    name: 'fill_sheet',
    description: 'Fill cells in a spreadsheet starting from a given cell with CSV data. Returns fill confirmation. When to use: for bulk data entry into Google Sheets. Related: read_sheet (read existing data before filling), navigate (go to the spreadsheet first).',
    inputSchema: {
      type: 'object',
      properties: {
        startCell: { type: 'string', description: 'Starting cell reference (e.g., "A1", "B5", "D10")' },
        csvData: { type: 'string', description: 'CSV data with \\n for row breaks' },
        sheetName: { type: 'string', description: 'Optional sheet name to set' }
      },
      required: ['startCell', 'csvData']
    },
    _route: 'content',
    _readOnly: false,
    _contentVerb: 'fillsheet',
    _cdpVerb: null
  },

  {
    name: 'read_sheet',
    description: 'Read cell values from a spreadsheet range. Returns cell values as array. When to use: to extract tabular data from a spreadsheet. Related: fill_sheet (write data), navigate (go to the spreadsheet first).',
    inputSchema: {
      type: 'object',
      properties: {
        range: { type: 'string', description: 'Cell range to read (e.g., \'A1:C5\')' }
      },
      required: ['range']
    },
    _route: 'content',
    _readOnly: true,
    _contentVerb: 'readsheet',
    _cdpVerb: null
  },

  // =========================================================================
  // CDP COORDINATE TOOLS (7 tools)
  // =========================================================================

  {
    name: 'click_at',
    description: 'Click at specific viewport coordinates using CDP trusted events. Supports modifier keys for shift+click (multi-select), ctrl+click, alt+click. Coordinates are CSS pixels relative to the browser viewport (use getBoundingClientRect() values). Returns success/failure with method used. When to use: for canvas elements, SVG graphics, overlays, or any element where DOM-based click (click tool) does not work. Fallback for click failures. Related: click (preferred for DOM elements -- use click_at only when click fails), get_dom_snapshot (check element coordinates via position data), drag (for click-and-drag interactions).',
    inputSchema: {
      type: 'object',
      properties: {
        x: { type: 'number', description: 'X coordinate in viewport CSS pixels' },
        y: { type: 'number', description: 'Y coordinate in viewport CSS pixels' },
        shift: { type: 'boolean', description: 'Hold Shift key during click (for multi-select)' },
        ctrl: { type: 'boolean', description: 'Hold Ctrl key during click' },
        alt: { type: 'boolean', description: 'Hold Alt key during click' }
      },
      required: ['x', 'y']
    },
    _route: 'cdp',
    _readOnly: false,
    _contentVerb: null,
    _cdpVerb: 'cdpClickAt'
  },

  {
    name: 'click_and_hold',
    description: 'Click and hold at specific viewport coordinates for a specified duration using CDP trusted events. Dispatches mousePressed, waits holdMs milliseconds, then dispatches mouseReleased at the same position. Coordinates are CSS pixels relative to the browser viewport. When to use: for record buttons, long-press menus, or any UI that requires sustained mouse press. Related: click_at (simple click without hold), drag (click, move, and release for dragging interactions).',
    inputSchema: {
      type: 'object',
      properties: {
        x: { type: 'number', description: 'X coordinate in viewport CSS pixels' },
        y: { type: 'number', description: 'Y coordinate in viewport CSS pixels' },
        holdMs: { type: 'number', description: 'Duration to hold the mouse button in milliseconds (default 5000 = 5 seconds)' }
      },
      required: ['x', 'y']
    },
    _route: 'cdp',
    _readOnly: false,
    _contentVerb: null,
    _cdpVerb: 'cdpClickAndHold'
  },

  {
    name: 'drag',
    description: 'Drag from one viewport coordinate to another using CDP trusted events. Produces mousePressed at start, N intermediate mouseMoved events, then mouseReleased at end. Essential for canvas drawing tools, sliders, and map interactions where DOM drag events are ignored. Supports modifier keys for constrained drawing (shift+drag). Coordinates are CSS pixels relative to the browser viewport. Related: drag_drop (DOM element-to-element drag using selectors), drag_variable_speed (human-like variable-speed drag for CAPTCHAs), click_at (simple click at coordinates), click_and_hold (press and hold without moving).',
    inputSchema: {
      type: 'object',
      properties: {
        startX: { type: 'number', description: 'Start X coordinate in viewport CSS pixels' },
        startY: { type: 'number', description: 'Start Y coordinate in viewport CSS pixels' },
        endX: { type: 'number', description: 'End X coordinate in viewport CSS pixels' },
        endY: { type: 'number', description: 'End Y coordinate in viewport CSS pixels' },
        steps: { type: 'number', description: 'Number of intermediate mouseMoved events (default 10, increase for smoother drag)' },
        stepDelayMs: { type: 'number', description: 'Delay in ms between each mouseMoved step (default 20)' },
        shift: { type: 'boolean', description: 'Hold Shift key during drag (for constrained movement)' },
        ctrl: { type: 'boolean', description: 'Hold Ctrl key during drag' },
        alt: { type: 'boolean', description: 'Hold Alt key during drag' }
      },
      required: ['startX', 'startY', 'endX', 'endY']
    },
    _route: 'cdp',
    _readOnly: false,
    _contentVerb: null,
    _cdpVerb: 'cdpDrag'
  },

  {
    name: 'drag_variable_speed',
    description: 'Drag from one viewport coordinate to another at variable speed using an ease-in-out timing curve. Produces mousePressed at start, N intermediate mouseMoved events with varying delays (slow-fast-slow), then mouseReleased at end. The speed curve mimics human drag behavior: slow acceleration at start, peak speed in the middle, slow deceleration at end. Essential for slider CAPTCHAs and puzzle CAPTCHAs where constant-speed drag is detected as bot behavior. For uniform-speed drag (canvas drawing, map panning), use the regular drag tool instead. Related: drag (uniform-speed drag for canvas/maps), drag_drop (DOM element-to-element drag).',
    inputSchema: {
      type: 'object',
      properties: {
        startX: { type: 'number', description: 'Start X coordinate in viewport CSS pixels (slider thumb position)' },
        startY: { type: 'number', description: 'Start Y coordinate in viewport CSS pixels (slider thumb position)' },
        endX: { type: 'number', description: 'End X coordinate in viewport CSS pixels (target/gap position)' },
        endY: { type: 'number', description: 'End Y coordinate in viewport CSS pixels (usually same as startY for horizontal slider)' },
        steps: { type: 'number', description: 'Number of intermediate mouseMoved events (default 20, more = smoother curve)' },
        minDelayMs: { type: 'number', description: 'Minimum delay in ms between steps at peak speed (default 5, center of drag)' },
        maxDelayMs: { type: 'number', description: 'Maximum delay in ms between steps at start/end (default 40, edges of drag)' }
      },
      required: ['startX', 'startY', 'endX', 'endY']
    },
    _route: 'cdp',
    _readOnly: false,
    _contentVerb: null,
    _cdpVerb: 'cdpDragVariableSpeed'
  },

  {
    name: 'scroll_at',
    description: 'Scroll (mouse wheel) at specific viewport coordinates using CDP trusted events. Negative deltaY = zoom in / scroll up, positive deltaY = zoom out / scroll down. Each call dispatches one wheel tick; call multiple times for more zoom. Coordinates are CSS pixels relative to the browser viewport. When to use: for map zoom (Google Maps, Leaflet), canvas zoom, or any element where page-level scrolling does not trigger the desired zoom/scroll behavior. Related: scroll (page-level scroll up/down), scroll_to_top/scroll_to_bottom (quick page jumps).',
    inputSchema: {
      type: 'object',
      properties: {
        x: { type: 'number', description: 'X coordinate in viewport CSS pixels (center of zoom target)' },
        y: { type: 'number', description: 'Y coordinate in viewport CSS pixels (center of zoom target)' },
        deltaY: { type: 'number', description: 'Vertical scroll delta (-120 = one tick zoom in, 120 = one tick zoom out)' },
        deltaX: { type: 'number', description: 'Horizontal scroll delta (usually 0)' }
      },
      required: ['x', 'y']
    },
    _route: 'cdp',
    _readOnly: false,
    _contentVerb: null,
    _cdpVerb: 'cdpScrollAt'
  },

  {
    name: 'insert_text',
    description: 'Insert text at the current cursor position via CDP Input.insertText. Bypasses DOM event dispatch and directly inserts into the focused element. When to use: for canvas-based editors (Excalidraw, Google Docs, Slack) where type_text does not work because there is no real input element. The element must already be focused or in edit mode (use double_click_at or click_at first). Related: type_text (for real DOM input fields), double_click_at (enter edit mode in canvas editors before inserting text), click_at (focus canvas element before inserting).',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Text to insert at current cursor position via CDP' }
      },
      required: ['text']
    },
    _route: 'cdp',
    _readOnly: false,
    _contentVerb: null,
    _cdpVerb: 'cdpInsertText'
  },

  {
    name: 'double_click_at',
    description: 'Double-click at specific viewport coordinates using CDP trusted events. Dispatches two rapid mousePressed/mouseReleased cycles with clickCount=2 on the second pair. Supports modifier keys. Coordinates are CSS pixels relative to the browser viewport. When to use: for entering edit mode in canvas-based editors (Excalidraw text boxes, Google Sheets cells), selecting words in contenteditable elements, or any double-click on coordinate-targeted elements. Related: click_at (single click at coordinates), double_click (double-click DOM elements by selector), insert_text (type text after entering edit mode via double-click).',
    inputSchema: {
      type: 'object',
      properties: {
        x: { type: 'number', description: 'X coordinate in viewport CSS pixels' },
        y: { type: 'number', description: 'Y coordinate in viewport CSS pixels' },
        shift: { type: 'boolean', description: 'Hold Shift key during double-click' },
        ctrl: { type: 'boolean', description: 'Hold Ctrl key during double-click' },
        alt: { type: 'boolean', description: 'Hold Alt key during double-click' }
      },
      required: ['x', 'y']
    },
    _route: 'cdp',
    _readOnly: false,
    _contentVerb: null,
    _cdpVerb: 'cdpDoubleClickAt'
  },

  // =========================================================================
  // READ-ONLY / INFORMATION TOOLS (6 tools)
  // =========================================================================

  {
    name: 'read_page',
    description: 'Read the text content of the current page. When to use: as the FIRST step after navigating to understand what is on the page. Automatically waits for DOM stability on JS-heavy sites. Returns main content prioritized over sidebars/nav/footer, capped at ~8K chars. Related: get_dom_snapshot (get structured element data with selectors for interaction), navigate (go to a page first), scroll (scroll to load more content before reading).',
    inputSchema: {
      type: 'object',
      properties: {
        full: { type: 'boolean', description: 'If true, read entire page; if false (default), read visible viewport only' }
      },
      required: []
    },
    _route: 'content',
    _readOnly: true,
    _contentVerb: 'readPage',
    _cdpVerb: null
  },

  {
    name: 'get_text',
    description: 'Get the text content of a specific element. Returns the element\'s text. When to use: to read a specific element\'s text without reading the whole page. Related: read_page (read full page), get_attribute (read element attributes like href, src).',
    inputSchema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector or element ref (e.g., "#price", ".title", or "e3" from get_dom_snapshot)' }
      },
      required: ['selector']
    },
    _route: 'content',
    _readOnly: true,
    _contentVerb: 'getText',
    _cdpVerb: null
  },

  {
    name: 'get_attribute',
    description: 'Get an HTML attribute value from an element. Returns the attribute value. When to use: to read href, src, value, data attributes, or ARIA properties from an element. Related: get_text (read element text content), get_dom_snapshot (find element selectors).',
    inputSchema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector or element ref (e.g., "#link", "a.nav-item", or "e7" from get_dom_snapshot)' },
        attribute: { type: 'string', description: 'HTML attribute name (e.g., \'href\', \'src\', \'value\')' }
      },
      required: ['selector', 'attribute']
    },
    _route: 'content',
    _readOnly: true,
    _contentVerb: 'getAttribute',
    _cdpVerb: null
  },

  {
    name: 'set_attribute',
    description: 'Set an HTML attribute value on an element. Returns confirmation. When to use: to modify element attributes for form manipulation, changing hidden field values, toggling ARIA states, or setting data attributes. Related: get_attribute (read attribute value first), get_dom_snapshot (find element selectors).',
    inputSchema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector or element ref for the target element' },
        attribute: { type: 'string', description: 'HTML attribute name to set' },
        value: { type: 'string', description: 'Value to set the attribute to' }
      },
      required: ['selector', 'attribute', 'value']
    },
    _route: 'content',
    _readOnly: false,
    _contentVerb: 'setAttribute',
    _cdpVerb: null
  },

  {
    name: 'get_dom_snapshot',
    description: 'Get a structured DOM snapshot with element references (e.g., e1, e2, e3). When to use: BEFORE any interaction tool (click, type_text, etc.) to find the right selector or element ref. Returns elements with tag, text, attributes, and position data. Element refs like \'e5\' can be passed directly to click, type_text, hover, and other tools. Related: read_page (quick text content), click/type_text/hover (use refs from this snapshot).',
    inputSchema: {
      type: 'object',
      properties: {
        maxElements: { type: 'number', description: 'Maximum elements to include (default: 2000)' }
      },
      required: []
    },
    _route: 'content',
    _readOnly: true,
    _contentVerb: null,
    _cdpVerb: null
  },

  {
    name: 'list_tabs',
    description: 'List all open browser tabs with title, URL, and active status. Returns array of tab objects. When to use: to see all open tabs before switching. Related: switch_tab (switch to a tab by ID), open_tab (open a new tab).',
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    },
    _route: 'background',
    _readOnly: true,
    _contentVerb: null,
    _cdpVerb: null
  },

  // =========================================================================
  // ON-DEMAND CONTEXT TOOLS (3 tools) -- Phase 138
  // =========================================================================

  {
    name: 'get_page_snapshot',
    description: 'Get a markdown snapshot of the current page DOM. Returns interactive elements with ref IDs for targeting. When to use: BEFORE any click/type/interaction to see current page state. Call this at the start of each new page or when you need to find elements. Related: read_page (plain text content), get_text (single element text).',
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    },
    _route: 'content',
    _readOnly: true,
    _contentVerb: null,
    _cdpVerb: null
  },

  {
    name: 'get_site_guide',
    description: 'Get site-specific automation guidance for a domain. Returns selectors, navigation patterns, and tips for automating the site. When to use: when starting work on a new site or when standard selectors fail. Related: get_page_snapshot (see current elements), get_dom_snapshot (raw DOM).',
    inputSchema: {
      type: 'object',
      properties: {
        domain: {
          type: 'string',
          description: 'Domain name to get guide for (e.g. "google.com", "github.com")'
        }
      },
      required: ['domain']
    },
    _route: 'background',
    _readOnly: true,
    _contentVerb: null,
    _cdpVerb: null
  },

  {
    name: 'report_progress',
    description: 'Update the progress overlay with a status message visible to the user. When to use: before complex multi-step operations to inform the user what you are doing. Related: all action tools (call report_progress before sequences of actions).',
    inputSchema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          description: 'Progress message to display to the user (e.g. "Filling out the contact form", "Searching for flights")'
        }
      },
      required: ['message']
    },
    _route: 'background',
    _readOnly: true,
    _contentVerb: null,
    _cdpVerb: null
  },

  // =========================================================================
  // TASK LIFECYCLE TOOLS (3 tools)
  // =========================================================================

  {
    name: 'complete_task',
    description: 'Signal that the task is fully complete. ONLY call this when the user\'s requested task has been fully achieved -- all data collected, all entries made, all actions performed. Include a summary of what was accomplished.',
    inputSchema: {
      type: 'object',
      properties: {
        summary: { type: 'string', description: 'Summary of what was accomplished (e.g. "Found 50 Tesla internships and added them to Google Sheet with title, department, location columns")' }
      },
      required: ['summary']
    },
    _route: 'background',
    _readOnly: true,
    _contentVerb: null,
    _cdpVerb: null
  },

  {
    name: 'partial_task',
    description: 'Signal that the task is partially complete because useful work was completed but an external blocker prevents the final step. Include a summary of what was accomplished plus the blocker. Use this instead of fail_task when the user can still benefit from the completed work.',
    inputSchema: {
      type: 'object',
      properties: {
        summary: { type: 'string', description: 'Summary of the useful work that was completed before the blocker was hit' },
        blocker: { type: 'string', description: 'What prevented the final step from being completed (e.g. "Messaging requires login", "Manual approval required")' },
        next_step: { type: 'string', description: 'Optional next step the user can take to finish manually or resume later' },
        reason: { type: 'string', description: 'Optional machine-readable blocker category (e.g. "blocked", "auth_required", "manual_approval")' }
      },
      required: ['summary', 'blocker']
    },
    _route: 'background',
    _readOnly: true,
    _contentVerb: null,
    _cdpVerb: null
  },

  {
    name: 'fail_task',
    description: 'Signal that the task cannot be completed. Include the reason why. Call this instead of just stopping when you encounter an unrecoverable problem.',
    inputSchema: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why the task cannot be completed (e.g. "Page requires login", "Data not found on page")' }
      },
      required: ['reason']
    },
    _route: 'background',
    _readOnly: true,
    _contentVerb: null,
    _cdpVerb: null
  }
];

// =========================================================================
// HELPER FUNCTIONS
// =========================================================================

/**
 * Look up a tool definition by name.
 * @param {string} name - Tool name (snake_case)
 * @returns {ToolDefinition|null} Tool definition or null if not found
 */
function getToolByName(name) {
  return TOOL_REGISTRY.find(t => t.name === name) || null;
}

/**
 * Get all read-only tools (those that bypass the mutation queue).
 * @returns {ToolDefinition[]} Array of read-only tool definitions
 */
function getReadOnlyTools() {
  return TOOL_REGISTRY.filter(t => t._readOnly);
}

/**
 * Get all tools for a specific execution route.
 * @param {'content'|'cdp'|'background'} route - The execution route
 * @returns {ToolDefinition[]} Array of tool definitions for that route
 */
function getToolsByRoute(route) {
  return TOOL_REGISTRY.filter(t => t._route === route);
}

// =========================================================================
// EXPORTS
// =========================================================================

// CommonJS for Chrome extension context and Node.js require()
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { TOOL_REGISTRY, getToolByName, getReadOnlyTools, getToolsByRoute };
}
