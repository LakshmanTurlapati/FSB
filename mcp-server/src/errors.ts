export const FSB_ERROR_MESSAGES: Record<string, string> = {
  'extension_not_connected':
    'Extension not connected. The FSB Chrome extension must be running and connected via Native Messaging. Verify the extension is installed and the native host is registered.',
  'no_active_tab':
    'No active browser tab found. Open a browser tab or use the navigate tool to go to a URL first.',
  'task_already_running':
    'A task is already running. Wait for it to complete or use stop_task to cancel it. Read-only tools (read_page, get_dom_snapshot, list_tabs) still work while a task runs.',
  'element_not_found':
    'Element not found: {selector}. The selector did not match any element on the current page. Use get_dom_snapshot to see available elements and their selectors.',
  'navigation_failed':
    'Navigation to {url} failed. The URL may be invalid or unreachable. Verify the URL and try again.',
  'task_timeout':
    'Task timed out after {seconds} seconds. The automation did not complete within the allowed time. Try a simpler task or break it into smaller steps using manual mode tools.',
  'native_messaging_error':
    'Native messaging communication failed. The bridge between the MCP server and Chrome extension is broken. Restart the MCP server and verify the native host manifest is correctly installed.',
  'action_rejected':
    'Action rejected by the extension. The requested action could not be performed on the current page. Use read_page or get_dom_snapshot to check the current page state.',
  'queue_timeout':
    'Tool call timed out waiting in queue. Another task is running and did not complete in time. Use stop_task to cancel the running task, or use read-only tools which bypass the queue.',
};

/**
 * Map an FSB result object to an MCP tool content response.
 * Successful results are JSON-stringified; failures are mapped to
 * human-readable error messages with contextual placeholders filled in.
 */
export function mapFSBError(
  fsbResult: Record<string, unknown> | null | undefined,
  context?: Record<string, string>,
): { content: Array<{ type: 'text'; text: string }>; isError?: boolean } {
  if (fsbResult && fsbResult.success) {
    return { content: [{ type: 'text', text: JSON.stringify(fsbResult, null, 2) }] };
  }

  let errorKey = 'action_rejected'; // default
  const errorMsg = String(fsbResult?.error ?? '');

  if (errorMsg.includes('not found')) errorKey = 'element_not_found';
  else if (errorMsg.includes('No active tab') || errorMsg.includes('no tab'))
    errorKey = 'no_active_tab';
  else if (errorMsg.includes('timeout') || errorMsg.includes('timed out'))
    errorKey = 'task_timeout';

  let text = FSB_ERROR_MESSAGES[errorKey] || errorMsg || 'Unknown error';

  // Replace placeholders
  if (context) {
    for (const [key, val] of Object.entries(context)) {
      text = text.replace(`{${key}}`, val);
    }
  }

  return { content: [{ type: 'text', text }], isError: true };
}
