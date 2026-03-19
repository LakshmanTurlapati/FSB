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
    'Open a URL in the active browser tab. Use to go to a specific page before interacting with it. Returns the final URL after any redirects.',
    { url: z.string().describe('URL to navigate to') },
    async ({ url }) => execAction(bridge, queue, 'navigate', 'navigate', { url }),
  );

  server.tool(
    'search',
    'Trigger a search on the current page. Use when the page has a search function and you need to find specific content. Returns search results status.',
    { query: z.string().describe('Search query text') },
    async ({ query }) => execAction(bridge, queue, 'search', 'searchGoogle', { query }),
  );

  server.tool(
    'go_back',
    'Navigate back one page in browser history. Use to return to the previous page. Returns the new URL.',
    {},
    async () => execAction(bridge, queue, 'go_back', 'goBack', {}),
  );

  server.tool(
    'go_forward',
    'Navigate forward one page in browser history. Use after going back. Returns the new URL.',
    {},
    async () => execAction(bridge, queue, 'go_forward', 'goForward', {}),
  );

  server.tool(
    'refresh',
    'Reload the current page. Use when page content may be stale. Returns the refreshed URL.',
    {},
    async () => execAction(bridge, queue, 'refresh', 'refresh', {}),
  );

  // --- Interaction tools ---

  server.tool(
    'click',
    'Click an element on the page by CSS selector or element reference. Use to press buttons, follow links, or activate controls. Returns whether the click succeeded.',
    { selector: z.string().describe('CSS selector or element reference (e.g., \'e5\', \'#submit-btn\')') },
    async ({ selector }) => execAction(bridge, queue, 'click', 'click', { selector }),
  );

  server.tool(
    'type_text',
    'Type text into an input field by selector. Use to fill text inputs, search boxes, or text areas. Returns confirmation of typed text.',
    {
      selector: z.string().describe('CSS selector or element reference for the input field'),
      text: z.string().describe('Text to type into the field'),
    },
    async ({ selector, text }) => execAction(bridge, queue, 'type_text', 'type', { selector, text }),
  );

  server.tool(
    'press_enter',
    'Press the Enter key, optionally on a specific element. Use to submit forms or confirm input. Returns key press confirmation.',
    { selector: z.string().optional().describe('Optional CSS selector or element reference to press Enter on') },
    async ({ selector }) => execAction(bridge, queue, 'press_enter', 'pressEnter', { selector }),
  );

  server.tool(
    'press_key',
    'Press a keyboard key with optional modifiers (ctrl, shift, alt). Use for keyboard shortcuts or special key input. Returns key press confirmation.',
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
    'Select an option from a dropdown by value. Use to choose from select menus. Returns the selected value.',
    {
      selector: z.string().describe('CSS selector or element reference for the select dropdown'),
      value: z.string().describe('Option value or visible text to select'),
    },
    async ({ selector, value }) => execAction(bridge, queue, 'select_option', 'selectOption', { selector, value }),
  );

  server.tool(
    'check_box',
    'Toggle a checkbox element. Use to check or uncheck form checkboxes. Returns the new checked state.',
    { selector: z.string().describe('CSS selector or element reference for the checkbox') },
    async ({ selector }) => execAction(bridge, queue, 'check_box', 'toggleCheckbox', { selector }),
  );

  server.tool(
    'hover',
    'Move the mouse over an element. Use to trigger hover menus, tooltips, or hover states. Returns hover confirmation.',
    { selector: z.string().describe('CSS selector or element reference to hover over') },
    async ({ selector }) => execAction(bridge, queue, 'hover', 'hover', { selector }),
  );

  server.tool(
    'right_click',
    'Open context menu on an element. Use to access right-click options. Returns context menu confirmation.',
    { selector: z.string().describe('CSS selector or element reference to right-click') },
    async ({ selector }) => execAction(bridge, queue, 'right_click', 'rightClick', { selector }),
  );

  server.tool(
    'double_click',
    'Double-click an element. Use for actions requiring double-click like text selection or opening items. Returns click confirmation.',
    { selector: z.string().describe('CSS selector or element reference to double-click') },
    async ({ selector }) => execAction(bridge, queue, 'double_click', 'doubleClick', { selector }),
  );

  server.tool(
    'focus',
    'Move keyboard focus to an element. Use to prepare an element for keyboard input. Returns focus confirmation.',
    { selector: z.string().describe('CSS selector or element reference to focus') },
    async ({ selector }) => execAction(bridge, queue, 'focus', 'focus', { selector }),
  );

  server.tool(
    'clear_input',
    'Clear the contents of an input field. Use before typing new text into an already-filled field. Returns clear confirmation.',
    { selector: z.string().describe('CSS selector or element reference for the input to clear') },
    async ({ selector }) => execAction(bridge, queue, 'clear_input', 'clearInput', { selector }),
  );

  // --- Scrolling tools ---

  server.tool(
    'scroll',
    'Scroll the page up or down by a specified amount. Use to bring off-screen content into view. Returns new scroll position.',
    {
      direction: z.enum(['up', 'down']).describe('Scroll direction'),
      amount: z.number().optional().describe('Scroll amount in pixels (default: one viewport)'),
    },
    async ({ direction, amount }) => execAction(bridge, queue, 'scroll', 'scroll', { direction, amount }),
  );

  server.tool(
    'scroll_to_top',
    'Scroll to the top of the page. Use to return to the beginning of the page. Returns confirmation.',
    {},
    async () => execAction(bridge, queue, 'scroll_to_top', 'scrollToTop', {}),
  );

  server.tool(
    'scroll_to_bottom',
    'Scroll to the bottom of the page. Use to reach the end of the page or load lazy content. Returns confirmation.',
    {},
    async () => execAction(bridge, queue, 'scroll_to_bottom', 'scrollToBottom', {}),
  );

  // --- Waiting tools ---

  server.tool(
    'wait_for_element',
    'Wait until an element matching the selector appears on the page. Use after navigation or actions that load new content. Returns when element is found or times out.',
    { selector: z.string().describe('CSS selector to wait for (not element reference -- must be a CSS selector)') },
    async ({ selector }) => execAction(bridge, queue, 'wait_for_element', 'waitForElement', { selector }),
  );

  server.tool(
    'wait_for_stable',
    'Wait until the page stops changing (no DOM mutations). Use after actions that trigger dynamic content loading. Returns when page is stable.',
    {},
    async () => execAction(bridge, queue, 'wait_for_stable', 'waitForDOMStable', {}),
  );

  // --- Tab tools ---

  server.tool(
    'open_tab',
    'Open a new browser tab with the given URL. Use when you need to work in a separate tab. Returns the new tab ID.',
    { url: z.string().describe('URL to open in new tab') },
    async ({ url }) => execAction(bridge, queue, 'open_tab', 'openNewTab', { url }),
  );

  server.tool(
    'switch_tab',
    'Switch the active browser tab by tab ID. Use to move between open tabs. Returns confirmation with the new active tab info.',
    { tabId: z.number().describe('Tab ID to switch to (from list_tabs)') },
    async ({ tabId }) => execAction(bridge, queue, 'switch_tab', 'switchToTab', { tabId }),
  );

  // --- Data tools ---

  server.tool(
    'fill_sheet',
    'Fill cells in a spreadsheet starting from a given cell with CSV data. Use for bulk data entry into Google Sheets or similar. Returns fill confirmation.',
    {
      startCell: z.string().describe('Starting cell reference (e.g., \'A1\')'),
      csvData: z.string().describe('CSV data with \\n for row breaks'),
      sheetName: z.string().optional().describe('Optional sheet name to set'),
    },
    async ({ startCell, csvData, sheetName }) =>
      execAction(bridge, queue, 'fill_sheet', 'fillsheet', { startCell, csvData, sheetName }),
  );

  server.tool(
    'read_sheet',
    'Read cell values from a spreadsheet range. Use to extract tabular data from Google Sheets or similar. Returns cell values as array.',
    { range: z.string().describe('Cell range to read (e.g., \'A1:C5\')') },
    async ({ range }) => execAction(bridge, queue, 'read_sheet', 'readsheet', { range }),
  );

  // --- CDP coordinate tools (for canvas/overlay elements) ---

  server.tool(
    'click_at',
    'Click at specific viewport coordinates using CDP trusted events. Use for canvas elements, overlays, or any element where DOM-based click does not work. Coordinates are CSS pixels relative to the browser viewport (use getBoundingClientRect() values). Returns success/failure with method used.',
    {
      x: z.number().describe('X coordinate in viewport CSS pixels'),
      y: z.number().describe('Y coordinate in viewport CSS pixels'),
    },
    async ({ x, y }) => execAction(bridge, queue, 'click_at', 'cdpClickAt', { x, y }),
  );

  server.tool(
    'drag',
    'Drag from one viewport coordinate to another using CDP trusted events. Produces mousePressed at start, N intermediate mouseMoved events, then mouseReleased at end. Essential for canvas drawing tools, sliders, and map interactions where DOM drag events are ignored. Coordinates are CSS pixels relative to the browser viewport.',
    {
      startX: z.number().describe('Start X coordinate in viewport CSS pixels'),
      startY: z.number().describe('Start Y coordinate in viewport CSS pixels'),
      endX: z.number().describe('End X coordinate in viewport CSS pixels'),
      endY: z.number().describe('End Y coordinate in viewport CSS pixels'),
      steps: z.number().optional().default(10).describe('Number of intermediate mouseMoved events (default 10, increase for smoother drag)'),
      stepDelayMs: z.number().optional().default(20).describe('Delay in ms between each mouseMoved step (default 20)'),
    },
    async ({ startX, startY, endX, endY, steps, stepDelayMs }) =>
      execAction(bridge, queue, 'drag', 'cdpDrag', { startX, startY, endX, endY, steps, stepDelayMs }),
  );
}
