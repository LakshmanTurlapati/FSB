import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { WebSocketBridge } from '../bridge.js';
import type { TaskQueue } from '../queue.js';
import { mapFSBError } from '../errors.js';

/**
 * Register read-only information tools. These bypass the TaskQueue
 * mutation serialization (their names are in the readOnlyTools set)
 * so they can execute even while a mutation tool is running.
 */
export function registerReadOnlyTools(
  server: McpServer,
  bridge: WebSocketBridge,
  queue: TaskQueue,
): void {
  server.tool(
    'read_page',
    'Read the text content of the current page. When to use: as the FIRST step after navigating to understand what is on the page. Automatically waits for DOM stability on JS-heavy sites. Returns main content prioritized over sidebars/nav/footer, capped at ~8K chars. Related: get_dom_snapshot (get structured element data with selectors for interaction), navigate (go to a page first), scroll (scroll to load more content before reading).',
    { full: z.boolean().optional().describe('If true, read entire page; if false (default), read visible viewport only') },
    async ({ full }) => {
      if (!bridge.isConnected) {
        return mapFSBError({ success: false, error: 'extension_not_connected' });
      }
      return queue.enqueue('read_page', async () => {
        const result = await bridge.sendAndWait(
          { type: 'mcp:read-page', payload: { full } },
          { timeout: 45_000 },
        );
        return mapFSBError(result);
      });
    },
  );

  server.tool(
    'get_text',
    'Get the text content of a specific element. Returns the element\'s text. When to use: to read a specific element\'s text without reading the whole page. Related: read_page (read full page), get_attribute (read element attributes like href, src).',
    { selector: z.string().describe('CSS selector or element ref (e.g., "#price", ".title", or "e3" from get_dom_snapshot)') },
    async ({ selector }) => {
      if (!bridge.isConnected) {
        return mapFSBError({ success: false, error: 'extension_not_connected' });
      }
      return queue.enqueue('get_text', async () => {
        const result = await bridge.sendAndWait(
          { type: 'mcp:execute-action', payload: { tool: 'getText', params: { selector } } },
          { timeout: 30_000 },
        );
        return mapFSBError(result);
      });
    },
  );

  server.tool(
    'get_attribute',
    'Get an HTML attribute value from an element. Returns the attribute value. When to use: to read href, src, value, data attributes, or ARIA properties from an element. Related: get_text (read element text content), get_dom_snapshot (find element selectors).',
    {
      selector: z.string().describe('CSS selector or element ref (e.g., "#link", "a.nav-item", or "e7" from get_dom_snapshot)'),
      attribute: z.string().describe('HTML attribute name (e.g., \'href\', \'src\', \'value\')'),
    },
    async ({ selector, attribute }) => {
      if (!bridge.isConnected) {
        return mapFSBError({ success: false, error: 'extension_not_connected' });
      }
      return queue.enqueue('get_attribute', async () => {
        const result = await bridge.sendAndWait(
          { type: 'mcp:execute-action', payload: { tool: 'getAttribute', params: { selector, attribute } } },
          { timeout: 30_000 },
        );
        return mapFSBError(result);
      });
    },
  );

  server.tool(
    'get_dom_snapshot',
    'Get a structured DOM snapshot with element references (e.g., e1, e2, e3). When to use: BEFORE any interaction tool (click, type_text, etc.) to find the right selector or element ref. Returns elements with tag, text, attributes, and position data. Element refs like \'e5\' can be passed directly to click, type_text, hover, and other tools. Related: read_page (quick text content), click/type_text/hover (use refs from this snapshot).',
    { maxElements: z.number().optional().describe('Maximum elements to include (default: 2000)') },
    async ({ maxElements }) => {
      if (!bridge.isConnected) {
        return mapFSBError({ success: false, error: 'extension_not_connected' });
      }
      return queue.enqueue('get_dom_snapshot', async () => {
        const result = await bridge.sendAndWait(
          { type: 'mcp:get-dom', payload: { maxElements } },
          { timeout: 30_000 },
        );
        return mapFSBError(result);
      });
    },
  );

  server.tool(
    'list_tabs',
    'List all open browser tabs with title, URL, and active status. Returns array of tab objects. When to use: to see all open tabs before switching. Related: switch_tab (switch to a tab by ID), open_tab (open a new tab).',
    {},
    async () => {
      if (!bridge.isConnected) {
        return mapFSBError({ success: false, error: 'extension_not_connected' });
      }
      return queue.enqueue('list_tabs', async () => {
        const result = await bridge.sendAndWait(
          { type: 'mcp:get-tabs', payload: {} },
          { timeout: 5_000 },
        );
        return mapFSBError(result);
      });
    },
  );
}
