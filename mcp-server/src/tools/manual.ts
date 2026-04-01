import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { WebSocketBridge } from '../bridge.js';
import type { TaskQueue } from '../queue.js';
import { mapFSBError } from '../errors.js';

type ToolCallResult = { content: Array<{ type: 'text'; text: string }>; isError?: boolean };

/**
 * Execute a single browser action through the FSB extension.
 * All manual tools funnel through this helper which checks connectivity,
 * enqueues via TaskQueue (mutation serialization), and maps the result.
 */
async function execAction(
  bridge: WebSocketBridge,
  queue: TaskQueue,
  toolName: string,
  fsbVerb: string,
  params: Record<string, unknown>,
): Promise<ToolCallResult> {
  if (!bridge.isConnected) {
    console.error(`[FSB Manual] ${toolName}: bridge not connected`);
    return mapFSBError({ success: false, error: 'extension_not_connected' });
  }
  console.error(`[FSB Manual] ${toolName}: sending verb=${fsbVerb} params=${JSON.stringify(params).slice(0, 150)}`);
  return queue.enqueue(toolName, async () => {
    try {
      const result = await bridge.sendAndWait(
        { type: 'mcp:execute-action', payload: { tool: fsbVerb, params } },
        { timeout: 30_000 },
      );
      if (!result?.success) {
        console.error(`[FSB Manual] ${toolName}: FAILED - ${result?.error || 'unknown error'}`);
      }
      return mapFSBError(result);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`[FSB Manual] ${toolName}: EXCEPTION - ${errMsg}`);
      return mapFSBError({ success: false, error: errMsg });
    }
  });
}

/**
 * Register all 25 manual browser action tools.
 * Each tool maps to an FSB CLI verb and sends mcp:execute-action
 * through the WebSocket bridge.
 */
export function registerManualTools(
  server: McpServer,
  bridge: WebSocketBridge,
  queue: TaskQueue,
): void {
  // --- Navigation tools ---

  server.tool(
    'navigate',
    'Open a URL in the active browser tab. Returns the final URL after any redirects. When to use: as the first step to reach a target website. Related: read_page (read content after navigating), list_tabs (see what tabs are already open).',
    { url: z.string().describe('URL to navigate to') },
    async ({ url }) => execAction(bridge, queue, 'navigate', 'navigate', { url }),
  );

  server.tool(
    'search',
    'Search for content on the current site or web. When to use: to find content on the current site or web. Automatically detects the site\'s search input (Amazon, YouTube, GitHub, etc.) via DOM heuristics -- only falls back to Google when no site search exists. Returns search results status. Related: read_page (read search results after searching), click (click a specific search result).',
    { query: z.string().describe('Search query text') },
    async ({ query }) => execAction(bridge, queue, 'search', 'siteSearch', { query }),
  );

  server.tool(
    'go_back',
    'Navigate back one page in browser history. Returns the new URL. When to use: to return to the previous page after following a link or navigating away. Related: go_forward (undo a go_back), navigate (go to a specific URL instead).',
    {},
    async () => execAction(bridge, queue, 'go_back', 'goBack', {}),
  );

  server.tool(
    'go_forward',
    'Navigate forward one page in browser history. Returns the new URL. When to use: after using go_back, to move forward again. Related: go_back (go back in history), navigate (go to a specific URL instead).',
    {},
    async () => execAction(bridge, queue, 'go_forward', 'goForward', {}),
  );

  server.tool(
    'refresh',
    'Reload the current page. Returns the refreshed URL. When to use: when page content may be stale, after errors, or to reset page state. Related: navigate (go to a different URL), wait_for_stable (wait for page to settle after refresh).',
    {},
    async () => execAction(bridge, queue, 'refresh', 'refresh', {}),
  );

  // --- Interaction tools ---

  server.tool(
    'click',
    'Click an element on the page. When to use: to press buttons, follow links, activate controls, or select items. Get selectors from get_dom_snapshot first. If click fails, try refreshing selectors with get_dom_snapshot or use click_at with viewport coordinates. Returns whether the click succeeded. Related: get_dom_snapshot (find element selectors/refs), click_at (coordinate-based fallback for canvas/overlay elements), hover (for menus that need hover before click).',
    { selector: z.string().describe('CSS selector or element reference from get_dom_snapshot (e.g., "#submit-btn", ".nav-link", or element ref "e5")') },
    async ({ selector }) => execAction(bridge, queue, 'click', 'click', { selector }),
  );

  server.tool(
    'type_text',
    'Type text into an input field by selector. When to use: to fill text inputs, search boxes, or text areas. Use clear_input first if the field already has text. Returns confirmation of typed text. Related: clear_input (clear field before typing), press_enter (submit after typing), get_dom_snapshot (find input selectors).',
    {
      selector: z.string().describe('CSS selector or element ref for the input field (e.g., "#email", "input[name=search]", or "e12" from get_dom_snapshot)'),
      text: z.string().describe('Text to type into the field'),
    },
    async ({ selector, text }) => execAction(bridge, queue, 'type_text', 'type', { selector, text }),
  );

  server.tool(
    'press_enter',
    'Press the Enter key to submit a form or confirm input. When to use: after typing into a search box or form field. Automatically falls back to clicking the submit button if Enter has no effect. Returns key press confirmation. Related: type_text (type before pressing Enter), click (click submit button directly).',
    { selector: z.string().optional().describe('Optional CSS selector or element reference to press Enter on') },
    async ({ selector }) => execAction(bridge, queue, 'press_enter', 'pressEnter', { selector }),
  );

  server.tool(
    'press_key',
    'Press a keyboard key with optional modifiers (ctrl, shift, alt). Returns key press confirmation. When to use: for keyboard shortcuts (Ctrl+C, Ctrl+V), special keys (Escape, Tab, ArrowDown), or key combinations. Related: press_enter (dedicated Enter key tool), type_text (type full strings), focus (focus element before sending keys).',
    {
      key: z.string().describe('Key to press (e.g., \'Escape\', \'Tab\', \'ArrowDown\')'),
      ctrl: z.boolean().optional().describe('Hold Ctrl'),
      shift: z.boolean().optional().describe('Hold Shift'),
      alt: z.boolean().optional().describe('Hold Alt'),
    },
    async ({ key, ctrl, shift, alt }) =>
      execAction(bridge, queue, 'press_key', 'keyPress', {
        key,
        ctrlKey: ctrl ?? false,
        shiftKey: shift ?? false,
        altKey: alt ?? false,
        useDebuggerAPI: true,
      }),
  );

  server.tool(
    'select_option',
    'Select an option from a dropdown by value. When to use: to choose from <select> dropdown menus. Returns the selected value. Related: get_dom_snapshot (find select element selectors), click (for custom non-native dropdowns).',
    {
      selector: z.string().describe('CSS selector or element ref for the <select> dropdown (e.g., "#country", "select[name=size]", or "e8")'),
      value: z.string().describe('Option value attribute or visible text (e.g., "US", "Large", "Option 3")'),
    },
    async ({ selector, value }) => execAction(bridge, queue, 'select_option', 'selectOption', { selector, value }),
  );

  server.tool(
    'check_box',
    'Toggle a checkbox element. Returns the new checked state. When to use: to check or uncheck form checkboxes or toggle switches. Related: get_dom_snapshot (find checkbox selectors), click (alternative for custom checkbox UI components).',
    { selector: z.string().describe('CSS selector or element reference for the checkbox') },
    async ({ selector }) => execAction(bridge, queue, 'check_box', 'toggleCheckbox', { selector }),
  );

  server.tool(
    'hover',
    'Move the mouse over an element. Returns hover confirmation. When to use: to reveal dropdown menus, tooltips, or hover-activated content before clicking. Related: click (click revealed menu item after hover), get_dom_snapshot (find element selectors).',
    { selector: z.string().describe('CSS selector or element reference to hover over') },
    async ({ selector }) => execAction(bridge, queue, 'hover', 'hover', { selector }),
  );

  server.tool(
    'right_click',
    'Open context menu on an element. Returns context menu confirmation. When to use: to access right-click context menu options on an element. Related: click (standard left-click), get_dom_snapshot (find element selectors).',
    { selector: z.string().describe('CSS selector or element reference to right-click') },
    async ({ selector }) => execAction(bridge, queue, 'right_click', 'rightClick', { selector }),
  );

  server.tool(
    'double_click',
    'Double-click an element. Returns click confirmation. When to use: for actions requiring double-click such as selecting a word, opening items in file managers, or activating edit mode. Related: click (single click), select_text_range (precise text selection by offsets), get_dom_snapshot (find element selectors).',
    { selector: z.string().describe('CSS selector or element reference to double-click') },
    async ({ selector }) => execAction(bridge, queue, 'double_click', 'doubleClick', { selector }),
  );

  server.tool(
    'select_text_range',
    'Select a specific substring within a DOM element by character offsets. Uses the Range API to highlight text from startOffset to endOffset within the element\'s text content. Essential for precise text selection like highlighting a specific sentence in a paragraph. Returns the selected text for verification. For selecting an entire element\'s text, use double-click instead. Related: double_click (select entire word/element text), get_text (read element text to determine offsets), get_dom_snapshot (find container selectors).',
    {
      selector: z.string().describe('CSS selector or element reference for the container element (e.g., "#mw-content-text p:nth-of-type(3)" for third paragraph)'),
      startOffset: z.number().describe('Character offset where selection starts (0-based, counting from start of element text content)'),
      endOffset: z.number().describe('Character offset where selection ends (exclusive, like string.substring)'),
    },
    async ({ selector, startOffset, endOffset }) =>
      execAction(bridge, queue, 'select_text_range', 'selectTextRange', { selector, startOffset, endOffset }),
  );

  server.tool(
    'drag_drop',
    'Drag and drop one DOM element onto another using element references. Tries three methods in order: HTML5 DragEvent (dragstart/drop), PointerEvent sequence (for react-beautiful-dnd and similar libraries), and MouseEvent sequence (basic fallback). Use for Kanban card reordering, sortable lists, file drag targets, or any drag-and-drop interaction between two identifiable DOM elements. Returns which method succeeded. For canvas/coordinate-based drag, use the drag tool instead. Related: drag (coordinate-based drag for canvas/map), drop_file (drop files onto upload zones), get_dom_snapshot (find source and target element refs).',
    {
      sourceSelector: z.string().describe('CSS selector or element reference (e.g., "e5", "#card-1") for the element to drag'),
      targetSelector: z.string().describe('CSS selector or element reference (e.g., "e12", "#column-2") for the drop target element'),
      steps: z.number().optional().default(10).describe('Number of intermediate move events during drag (default 10)'),
      holdMs: z.number().optional().default(150).describe('Milliseconds to hold before starting drag motion (default 150, increase for libraries that need longer press)'),
      stepDelayMs: z.number().optional().default(20).describe('Delay in ms between each move step (default 20)'),
    },
    async ({ sourceSelector, targetSelector, steps, holdMs, stepDelayMs }) =>
      execAction(bridge, queue, 'drag_drop', 'dragdrop', {
        sourceRef: sourceSelector,
        targetRef: targetSelector,
        steps,
        holdMs,
        stepDelayMs,
      }),
  );

  server.tool(
    'drop_file',
    'Simulate dropping a file onto a dropzone element. Creates a synthetic File with the given name, content, and MIME type, then dispatches HTML5 DragEvent sequence (dragenter, dragover, drop) on the target element. Use for file upload dropzones (Dropzone.js, react-dropzone, native HTML5 drop handlers). For drag-and-drop of DOM elements (not files), use drag_drop instead. Related: drag_drop (drag DOM elements between containers), get_dom_snapshot (find dropzone selectors).',
    {
      selector: z.string().describe('CSS selector for the dropzone element (the area where files are dropped)'),
      fileName: z.string().optional().default('test-upload.txt').describe('Name of the synthetic file to drop (e.g., "photo.jpg", "document.pdf")'),
      fileContent: z.string().optional().default('FSB automated file upload test content.').describe('Text content of the file (for text-based files)'),
      mimeType: z.string().optional().default('text/plain').describe('MIME type of the file (e.g., "text/plain", "image/png", "application/pdf")'),
    },
    async ({ selector, fileName, fileContent, mimeType }) =>
      execAction(bridge, queue, 'drop_file', 'dropfile', { selector, fileName, fileContent, mimeType }),
  );

  server.tool(
    'focus',
    'Move keyboard focus to an element. Returns focus confirmation. When to use: to prepare an element for keyboard input, or to bring an element into the accessibility focus ring. Related: type_text (type into a focused input), press_key (send keystrokes to focused element), click (also focuses the clicked element).',
    { selector: z.string().describe('CSS selector or element reference to focus') },
    async ({ selector }) => execAction(bridge, queue, 'focus', 'focus', { selector }),
  );

  server.tool(
    'clear_input',
    'Clear the contents of an input field. Returns clear confirmation. When to use: before typing new text into an already-filled field to remove existing content. Related: type_text (type new text after clearing), get_dom_snapshot (find input selectors).',
    { selector: z.string().describe('CSS selector or element reference for the input to clear') },
    async ({ selector }) => execAction(bridge, queue, 'clear_input', 'clearInput', { selector }),
  );

  // --- Scrolling tools ---

  server.tool(
    'scroll',
    'Scroll the page up or down by a specified amount. Returns new scroll position. When to use: to bring off-screen content into view, load lazy-loaded content, or navigate long pages. Related: scroll_to_top, scroll_to_bottom (quick jumps), read_page (read content after scrolling).',
    {
      direction: z.enum(['up', 'down']).describe('Scroll direction'),
      amount: z.number().optional().describe('Scroll amount in pixels (default: one viewport)'),
    },
    async ({ direction, amount }) => execAction(bridge, queue, 'scroll', 'scroll', { direction, amount }),
  );

  server.tool(
    'scroll_to_top',
    'Scroll to the top of the page. Returns confirmation. When to use: to return to the beginning of the page or reset scroll position. Related: scroll_to_bottom (jump to end), scroll (scroll by specific amount), read_page (read content after scrolling).',
    {},
    async () => execAction(bridge, queue, 'scroll_to_top', 'scrollToTop', {}),
  );

  server.tool(
    'scroll_to_bottom',
    'Scroll to the bottom of the page. Returns confirmation. When to use: to reach the end of the page, load lazy content, or trigger infinite scroll. Related: scroll_to_top (jump to beginning), scroll (scroll by specific amount), read_page (read content after scrolling).',
    {},
    async () => execAction(bridge, queue, 'scroll_to_bottom', 'scrollToBottom', {}),
  );

  // --- Waiting tools ---

  server.tool(
    'wait_for_element',
    'Wait until an element matching the selector appears on the page. Returns when element is found or times out. When to use: after navigation or actions that load new content asynchronously. Related: wait_for_stable (wait for all DOM changes to settle), read_page (read content after element appears).',
    { selector: z.string().describe('CSS selector to wait for (e.g., ".results-loaded", "#content", "table.data") -- must be CSS, not element ref') },
    async ({ selector }) => execAction(bridge, queue, 'wait_for_element', 'waitForElement', { selector }),
  );

  server.tool(
    'wait_for_stable',
    'Wait until the page stops changing (no DOM mutations). Returns when page is stable. When to use: after actions that trigger dynamic content loading, animations, or AJAX requests. Note: read_page already auto-waits for stability internally. Related: wait_for_element (wait for a specific element), read_page (read content after page stabilizes).',
    {},
    async () => execAction(bridge, queue, 'wait_for_stable', 'waitForDOMStable', {}),
  );

  // --- Tab tools ---

  server.tool(
    'open_tab',
    'Open a new browser tab with the given URL. Returns the new tab ID. When to use: when you need to work on a different site without losing the current page. Related: switch_tab (switch between open tabs), list_tabs (see all open tabs), navigate (change URL in current tab instead).',
    { url: z.string().describe('URL to open in new tab') },
    async ({ url }) => execAction(bridge, queue, 'open_tab', 'openNewTab', { url }),
  );

  server.tool(
    'switch_tab',
    'Switch the active browser tab by tab ID. Returns confirmation with the new active tab info. When to use: to move between open tabs for multi-tab workflows. Related: list_tabs (get available tab IDs first), open_tab (open a new tab).',
    { tabId: z.number().describe('Tab ID to switch to (get IDs from list_tabs tool)') },
    async ({ tabId }) => execAction(bridge, queue, 'switch_tab', 'switchToTab', { tabId }),
  );

  // --- Data tools ---

  server.tool(
    'fill_sheet',
    'Fill cells in a spreadsheet starting from a given cell with CSV data. Returns fill confirmation. When to use: for bulk data entry into Google Sheets. Related: read_sheet (read existing data before filling), navigate (go to the spreadsheet first).',
    {
      startCell: z.string().describe('Starting cell reference (e.g., "A1", "B5", "D10")'),
      csvData: z.string().describe('CSV data with \\n for row breaks'),
      sheetName: z.string().optional().describe('Optional sheet name to set'),
    },
    async ({ startCell, csvData, sheetName }) =>
      execAction(bridge, queue, 'fill_sheet', 'fillsheet', { startCell, data: csvData, sheetName }),
  );

  server.tool(
    'read_sheet',
    'Read cell values from a spreadsheet range. Returns cell values as array. When to use: to extract tabular data from a spreadsheet. Related: fill_sheet (write data), navigate (go to the spreadsheet first).',
    { range: z.string().describe('Cell range to read (e.g., \'A1:C5\')') },
    async ({ range }) => execAction(bridge, queue, 'read_sheet', 'readsheet', { range }),
  );

  // --- CDP coordinate tools (for canvas/overlay elements) ---

  server.tool(
    'click_at',
    'Click at specific viewport coordinates using CDP trusted events. Supports modifier keys for shift+click (multi-select), ctrl+click, alt+click. Coordinates are CSS pixels relative to the browser viewport (use getBoundingClientRect() values). Returns success/failure with method used. When to use: for canvas elements, SVG graphics, overlays, or any element where DOM-based click (click tool) does not work. Fallback for click failures. Related: click (preferred for DOM elements -- use click_at only when click fails), get_dom_snapshot (check element coordinates via position data), drag (for click-and-drag interactions).',
    {
      x: z.number().describe('X coordinate in viewport CSS pixels'),
      y: z.number().describe('Y coordinate in viewport CSS pixels'),
      shift: z.boolean().optional().describe('Hold Shift key during click (for multi-select)'),
      ctrl: z.boolean().optional().describe('Hold Ctrl key during click'),
      alt: z.boolean().optional().describe('Hold Alt key during click'),
    },
    async ({ x, y, shift, ctrl, alt }) => execAction(bridge, queue, 'click_at', 'cdpClickAt', {
      x, y,
      shiftKey: shift ?? false,
      ctrlKey: ctrl ?? false,
      altKey: alt ?? false,
    }),
  );

  server.tool(
    'click_and_hold',
    'Click and hold at specific viewport coordinates for a specified duration using CDP trusted events. Dispatches mousePressed, waits holdMs milliseconds, then dispatches mouseReleased at the same position. Coordinates are CSS pixels relative to the browser viewport. When to use: for record buttons, long-press menus, or any UI that requires sustained mouse press. Related: click_at (simple click without hold), drag (click, move, and release for dragging interactions).',
    {
      x: z.number().describe('X coordinate in viewport CSS pixels'),
      y: z.number().describe('Y coordinate in viewport CSS pixels'),
      holdMs: z.number().default(5000).describe('Duration to hold the mouse button in milliseconds (default 5000 = 5 seconds)'),
    },
    async ({ x, y, holdMs }) => execAction(bridge, queue, 'click_and_hold', 'cdpClickAndHold', { x, y, holdMs }),
  );

  server.tool(
    'drag',
    'Drag from one viewport coordinate to another using CDP trusted events. Produces mousePressed at start, N intermediate mouseMoved events, then mouseReleased at end. Essential for canvas drawing tools, sliders, and map interactions where DOM drag events are ignored. Supports modifier keys for constrained drawing (shift+drag). Coordinates are CSS pixels relative to the browser viewport. Related: drag_drop (DOM element-to-element drag using selectors), drag_variable_speed (human-like variable-speed drag for CAPTCHAs), click_at (simple click at coordinates), click_and_hold (press and hold without moving).',
    {
      startX: z.number().describe('Start X coordinate in viewport CSS pixels'),
      startY: z.number().describe('Start Y coordinate in viewport CSS pixels'),
      endX: z.number().describe('End X coordinate in viewport CSS pixels'),
      endY: z.number().describe('End Y coordinate in viewport CSS pixels'),
      steps: z.number().optional().default(10).describe('Number of intermediate mouseMoved events (default 10, increase for smoother drag)'),
      stepDelayMs: z.number().optional().default(20).describe('Delay in ms between each mouseMoved step (default 20)'),
      shift: z.boolean().optional().describe('Hold Shift key during drag (for constrained movement)'),
      ctrl: z.boolean().optional().describe('Hold Ctrl key during drag'),
      alt: z.boolean().optional().describe('Hold Alt key during drag'),
    },
    async ({ startX, startY, endX, endY, steps, stepDelayMs, shift, ctrl, alt }) =>
      execAction(bridge, queue, 'drag', 'cdpDrag', {
        startX, startY, endX, endY, steps, stepDelayMs,
        shiftKey: shift ?? false,
        ctrlKey: ctrl ?? false,
        altKey: alt ?? false,
      }),
  );

  server.tool(
    'drag_variable_speed',
    'Drag from one viewport coordinate to another at variable speed using an ease-in-out timing curve. Produces mousePressed at start, N intermediate mouseMoved events with varying delays (slow-fast-slow), then mouseReleased at end. The speed curve mimics human drag behavior: slow acceleration at start, peak speed in the middle, slow deceleration at end. Essential for slider CAPTCHAs and puzzle CAPTCHAs where constant-speed drag is detected as bot behavior. For uniform-speed drag (canvas drawing, map panning), use the regular drag tool instead. Related: drag (uniform-speed drag for canvas/maps), drag_drop (DOM element-to-element drag).',
    {
      startX: z.number().describe('Start X coordinate in viewport CSS pixels (slider thumb position)'),
      startY: z.number().describe('Start Y coordinate in viewport CSS pixels (slider thumb position)'),
      endX: z.number().describe('End X coordinate in viewport CSS pixels (target/gap position)'),
      endY: z.number().describe('End Y coordinate in viewport CSS pixels (usually same as startY for horizontal slider)'),
      steps: z.number().optional().default(20).describe('Number of intermediate mouseMoved events (default 20, more = smoother curve)'),
      minDelayMs: z.number().optional().default(5).describe('Minimum delay in ms between steps at peak speed (default 5, center of drag)'),
      maxDelayMs: z.number().optional().default(40).describe('Maximum delay in ms between steps at start/end (default 40, edges of drag)'),
    },
    async ({ startX, startY, endX, endY, steps, minDelayMs, maxDelayMs }) =>
      execAction(bridge, queue, 'drag_variable_speed', 'cdpDragVariableSpeed', {
        startX, startY, endX, endY, steps, minDelayMs, maxDelayMs,
      }),
  );

  server.tool(
    'scroll_at',
    'Scroll (mouse wheel) at specific viewport coordinates using CDP trusted events. Negative deltaY = zoom in / scroll up, positive deltaY = zoom out / scroll down. Each call dispatches one wheel tick; call multiple times for more zoom. Coordinates are CSS pixels relative to the browser viewport. When to use: for map zoom (Google Maps, Leaflet), canvas zoom, or any element where page-level scrolling does not trigger the desired zoom/scroll behavior. Related: scroll (page-level scroll up/down), scroll_to_top/scroll_to_bottom (quick page jumps).',
    {
      x: z.number().describe('X coordinate in viewport CSS pixels (center of zoom target)'),
      y: z.number().describe('Y coordinate in viewport CSS pixels (center of zoom target)'),
      deltaY: z.number().optional().default(-120).describe('Vertical scroll delta (-120 = one tick zoom in, 120 = one tick zoom out)'),
      deltaX: z.number().optional().default(0).describe('Horizontal scroll delta (usually 0)'),
    },
    async ({ x, y, deltaY, deltaX }) =>
      execAction(bridge, queue, 'scroll_at', 'cdpScrollAt', { x, y, deltaX, deltaY }),
  );
}
