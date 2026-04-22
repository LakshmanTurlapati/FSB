import { FSB_EXTENSION_BRIDGE_URL } from './version.js';

export const FSB_ERROR_MESSAGES: Record<string, string> = {
  'extension_not_connected':
    `Extension WebSocket not connected. The FSB Chrome extension must be running with a WebSocket connection to ${FSB_EXTENSION_BRIDGE_URL}. Verify the extension is installed, enabled, and the browser is open.`,
  'no_active_tab':
    'No active browser tab found. Open a browser tab or use the navigate tool to go to a URL first.',
  'restricted_active_tab':
    'The active tab is a restricted/browser-internal page ({pageType}: {currentUrl}). Page-reading and interaction tools cannot run there because Chrome blocks content script injection. {restrictedRecovery}',
  'mcp_route_unavailable':
    'Missing direct MCP route for {tool} ({routeFamily}). {recoveryHint}',
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
function getRecoveryHint(
  error: string,
  options?: { errorKey?: string; validRecoveryTools?: string[] },
): string {
  const lower = error.toLowerCase();

  if (options?.errorKey === 'restricted_active_tab' || lower.includes('restricted/browser-internal page')) {
    const recoveryTools = formatRecoveryToolList(options?.validRecoveryTools);
    return ` [Recovery: Use ${recoveryTools} to move to a normal website before using page-reading or interaction tools.]`;
  }

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

const DEFAULT_RESTRICTED_RECOVERY_TOOLS = ['navigate', 'open_tab', 'switch_tab', 'list_tabs'];

function getValidRecoveryTools(fsbResult: Record<string, unknown> | null | undefined): string[] {
  const rawTools = Array.isArray(fsbResult?.validRecoveryTools)
    ? fsbResult.validRecoveryTools
    : DEFAULT_RESTRICTED_RECOVERY_TOOLS;
  const tools = rawTools
    .filter((tool): tool is string => typeof tool === 'string' && tool.trim().length > 0)
    .filter(tool => tool !== 'run_task');
  return tools.length > 0 ? tools : DEFAULT_RESTRICTED_RECOVERY_TOOLS;
}

function formatRecoveryToolList(tools: string[] | undefined): string {
  const list = Array.isArray(tools) && tools.length > 0 ? tools : DEFAULT_RESTRICTED_RECOVERY_TOOLS;
  return list.join(', ');
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
  const errorCode = typeof fsbResult?.errorCode === 'string' ? fsbResult.errorCode : '';
  let errorKey = errorCode || 'action_rejected'; // default

  if (!FSB_ERROR_MESSAGES[errorKey]) {
    errorKey = 'action_rejected';

    // Map known error patterns to specific error keys
    if (errorMsg.includes('not found')) errorKey = 'element_not_found';
    else if (errorMsg.includes('No active tab') || errorMsg.includes('no tab'))
      errorKey = 'no_active_tab';
    else if (errorMsg.includes('timeout') || errorMsg.includes('timed out'))
      errorKey = 'task_timeout';
    else if (errorMsg.includes('extension_not_connected') || errorMsg.includes('Bridge disconnected'))
      errorKey = 'extension_not_connected';
    else if (errorMsg.includes('Content script communication failed') || errorMsg.includes('Receiving end does not exist'))
      errorKey = 'content_script_failed';
    else if (errorMsg.includes('injection failed') || errorMsg.includes('Content script injection'))
      errorKey = 'injection_failed';
  }

  let text = FSB_ERROR_MESSAGES[errorKey] || errorMsg || 'Unknown error';
  const validRecoveryTools = getValidRecoveryTools(fsbResult);

  // Replace placeholders
  const mergedContext: Record<string, string> = {
    currentUrl: typeof fsbResult?.currentUrl === 'string' ? fsbResult.currentUrl : '',
    pageType: typeof fsbResult?.pageType === 'string' ? fsbResult.pageType : 'Restricted page',
    restrictedRecovery: `Use ${formatRecoveryToolList(validRecoveryTools)} to move to a normal webpage first.`,
    tool: typeof fsbResult?.tool === 'string' ? fsbResult.tool : '',
    routeFamily: typeof fsbResult?.routeFamily === 'string' ? fsbResult.routeFamily : '',
    recoveryHint: typeof fsbResult?.recoveryHint === 'string' ? fsbResult.recoveryHint : 'Use a supported MCP route or navigation recovery tool.',
    url: typeof fsbResult?.url === 'string'
      ? fsbResult.url
      : (typeof fsbResult?.currentUrl === 'string' ? fsbResult.currentUrl : ''),
    selector: typeof fsbResult?.selector === 'string' ? fsbResult.selector : '',
    ...(context || {}),
  };
  for (const [key, val] of Object.entries(mergedContext)) {
    if (typeof val === 'string') {
      text = text.replace(`{${key}}`, val);
    }
  }

  // Always append the raw error for debugging transparency
  if (errorMsg && errorMsg !== errorCode && !text.includes(errorMsg)) {
    text += `\n\n[Raw error: ${errorMsg}]`;
  }

  // Append actionable recovery hint based on error patterns
  const hint = getRecoveryHint(text, { errorKey, validRecoveryTools });
  if (hint) {
    text += hint;
  }

  // Log to stderr for MCP server-side debugging
  console.error(`[FSB MCP] Tool error: key=${errorKey} raw="${errorMsg}"`);

  return { content: [{ type: 'text', text }], isError: true };
}
