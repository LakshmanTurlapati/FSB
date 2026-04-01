export const FSB_ERROR_MESSAGES: Record<string, string> = {
  'extension_not_connected':
    'Extension WebSocket not connected. The FSB Chrome extension must be running with a WebSocket connection to ws://localhost:7225. Verify the extension is installed and running.',
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
  'action_rejected':
    'Action rejected by the extension. The requested action could not be performed on the current page. Use read_page or get_dom_snapshot to check the current page state.',
  'content_script_failed':
    'Content script communication failed. The content script may not be injected or has lost connection. Try navigating to the page again.',
  'injection_failed':
    'Content script injection failed. The extension could not inject its scripts into the current page.',
  'queue_timeout':
    'Tool call timed out waiting in queue. Another task is running and did not complete in time. Use stop_task to cancel the running task, or use read-only tools which bypass the queue.',
};

/**
 * Generate actionable recovery hints based on error message content.
 * Helps AI clients understand what to try next when a tool fails.
 */
function getRecoveryHint(error: string): string {
  const lower = error.toLowerCase();

  // Element not found errors
  if (lower.includes('not found') || lower.includes('no element') || lower.includes('null')) {
    return ' [Recovery: Call get_dom_snapshot to refresh element references, then retry with an updated selector. Element refs (e1, e2...) expire after page changes.]';
  }

  // Element not visible / not interactable
  if (lower.includes('not visible') || lower.includes('not interactable') || lower.includes('obscured') || lower.includes('covered')) {
    return ' [Recovery: The element may be behind a fixed header or overlay. Try scroll(direction="down") to reposition, or use click_at with viewport coordinates as a fallback.]';
  }

  // Extension not connected
  if (lower.includes('extension_not_connected') || lower.includes('not connected') || lower.includes('bridge')) {
    return ' [Recovery: The FSB Chrome Extension is not running or not connected. Make sure the extension is installed and active in Chrome, then retry.]';
  }

  // Timeout errors
  if (lower.includes('timeout') || lower.includes('timed out')) {
    return ' [Recovery: The page may be loading slowly. Try wait_for_stable first, then retry. For JS-heavy sites, read_page auto-waits for DOM stability.]';
  }

  // Navigation / page changed
  if (lower.includes('navigation') || lower.includes('page changed') || lower.includes('detached') || lower.includes('stale')) {
    return ' [Recovery: The page has changed since the last snapshot. Call get_dom_snapshot or read_page to get fresh content before retrying.]';
  }

  // Port disconnected / BF cache
  if (lower.includes('port') || lower.includes('disconnected') || lower.includes('bf cache')) {
    return ' [Recovery: Page navigation caused a disconnect. The content script will auto-reconnect. Wait a moment and retry the action.]';
  }

  return '';
}

/**
 * Map an FSB result object to an MCP tool content response.
 * Successful results are JSON-stringified; failures are mapped to
 * human-readable error messages with contextual placeholders filled in.
 *
 * IMPORTANT: The raw error from the extension is always appended to help
 * with debugging. The generic messages alone are not sufficient to
 * diagnose issues.
 */
export function mapFSBError(
  fsbResult: Record<string, unknown> | null | undefined,
  context?: Record<string, string>,
): { content: Array<{ type: 'text'; text: string }>; isError?: boolean } {
  if (fsbResult && fsbResult.success) {
    return { content: [{ type: 'text', text: JSON.stringify(fsbResult, null, 2) }] };
  }

  const errorMsg = String(fsbResult?.error ?? '');
  let errorKey = 'action_rejected'; // default

  // Map known error patterns to specific error keys
  if (errorMsg.includes('not found')) errorKey = 'element_not_found';
  else if (errorMsg.includes('No active tab') || errorMsg.includes('no tab'))
    errorKey = 'no_active_tab';
  else if (errorMsg.includes('timeout') || errorMsg.includes('timed out'))
    errorKey = 'task_timeout';
  else if (errorMsg.includes('Content script communication failed') || errorMsg.includes('Receiving end does not exist'))
    errorKey = 'content_script_failed';
  else if (errorMsg.includes('injection failed') || errorMsg.includes('Content script injection'))
    errorKey = 'injection_failed';

  let text = FSB_ERROR_MESSAGES[errorKey] || errorMsg || 'Unknown error';

  // Replace placeholders
  if (context) {
    for (const [key, val] of Object.entries(context)) {
      text = text.replace(`{${key}}`, val);
    }
  }

  // Always append the raw error for debugging transparency
  if (errorMsg && !text.includes(errorMsg)) {
    text += `\n\n[Raw error: ${errorMsg}]`;
  }

  // Append actionable recovery hint based on error patterns
  const hint = getRecoveryHint(text);
  if (hint) {
    text += hint;
  }

  // Log to stderr for MCP server-side debugging
  console.error(`[FSB MCP] Tool error: key=${errorKey} raw="${errorMsg}"`);

  return { content: [{ type: 'text', text }], isError: true };
}
