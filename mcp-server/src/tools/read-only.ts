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
    'Read the text content of the current page. Use to understand what is on the page before interacting. Returns page text with structure preserved.',
    { full: z.boolean().optional().describe('If true, read entire page; if false (default), read visible viewport only') },
    async ({ full }) => {
      if (!bridge.isConnected) {
        return mapFSBError({ success: false, error: 'extension_not_connected' });
      }
      return queue.enqueue('read_page', async () => {
        const result = await bridge.sendAndWait(
          { type: 'mcp:read-page', payload: { full } },
          { timeout: 30_000 },
        );
        return mapFSBError(result);
      });
    },
  );

  server.tool(
    'get_text',
    'Get the text content of a specific element. Use to read a particular section or value on the page. Returns the element\'s text.',
    { selector: z.string().describe('CSS selector or element reference to get text from') },
    async ({ selector }) => {
      if (!bridge.isConnected) {
        return mapFSBError({ success: false, error: 'extension_not_connected' });
      }
      return queue.enqueue('get_text', async () => {
        const result = await bridge.sendAndWait(
          { type: 'mcp:execute-action', payload: { tool: 'gettext', params: { selector } } },
          { timeout: 30_000 },
        );
        return mapFSBError(result);
      });
    },
  );

  server.tool(
    'get_attribute',
    'Get an HTML attribute value from an element. Use to read href, src, value, or other attributes. Returns the attribute value.',
    {
      selector: z.string().describe('CSS selector or element reference'),
      attribute: z.string().describe('HTML attribute name (e.g., \'href\', \'src\', \'value\')'),
    },
    async ({ selector, attribute }) => {
      if (!bridge.isConnected) {
        return mapFSBError({ success: false, error: 'extension_not_connected' });
      }
      return queue.enqueue('get_attribute', async () => {
        const result = await bridge.sendAndWait(
          { type: 'mcp:execute-action', payload: { tool: 'getattr', params: { selector, attribute } } },
          { timeout: 30_000 },
        );
        return mapFSBError(result);
      });
    },
  );

  server.tool(
    'get_dom_snapshot',
    'Get a structured DOM snapshot of the current page with element references. Use to understand page structure and find selectors. Returns JSON with elements, selectors, and form data.',
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
    'List all open browser tabs with title, URL, and active status. Use to see what tabs are available. Returns array of tab objects.',
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
