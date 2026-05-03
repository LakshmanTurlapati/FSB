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
  'invalid_client_label':
    'The MCP client label is not on the trusted visual-session allowlist. Use one of the approved client names exactly as documented.',
  'visual_session_not_found':
    'The provided visual-session token does not match an active client-owned visual session. The token may be stale, already finalized, or already cleared. Start a new visual session or use the latest token returned by start_visual_session.',
  'visual_surface_busy':
    'The active visual surface is already owned by an FSB automation session. Wait for the current run to finish or stop it before starting a client-owned visual session.',
  'session_not_found':
    'The requested session id was not found in the active automation map or in the saved session history. The id may be stale, mistyped, or for a session that has been cleared.',
};

const DEFAULT_RESTRICTED_RECOVERY_TOOLS = ['navigate', 'open_tab', 'switch_tab', 'list_tabs'];
const LAYER_LABELS = {
  package: 'Package / version parity',
  configuration: 'Configuration',
  bridge: 'Bridge ownership',
  extension: 'Extension attachment',
  contentScript: 'Content script availability',
  toolRouting: 'Tool routing',
  restrictedPage: 'Restricted page',
  pageNavigation: 'Page navigation',
  visualSession: 'Visual session contract',
  sessionLookup: 'Session lookup',
} as const;

type LayerLabel = typeof LAYER_LABELS[keyof typeof LAYER_LABELS];
type ErrorDetail = {
  detected: LayerLabel;
  why: string;
  nextAction: string;
};

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

function getAllowedClientLabels(
  fsbResult: Record<string, unknown> | null | undefined,
): string[] {
  return Array.isArray(fsbResult?.allowedClients)
    ? fsbResult.allowedClients.filter((label): label is string => typeof label === 'string' && label.trim().length > 0)
    : [];
}

function resolveErrorKey(
  fsbResult: Record<string, unknown> | null | undefined,
  errorMsg: string,
): string {
  const errorCode = typeof fsbResult?.errorCode === 'string' ? fsbResult.errorCode : '';
  if (FSB_ERROR_MESSAGES[errorCode]) {
    return errorCode;
  }

  const lower = errorMsg.toLowerCase();
  if (lower.includes('version mismatch') || lower.includes('package.json') || lower.includes('server.json')) {
    return 'package_version_mismatch';
  }
  if (
    lower.includes('config probe failed')
    || lower.includes('modelprovider')
    || lower.includes('model provider')
    || lower.includes('modelname')
    || lower.includes('model name')
    || lower.includes('selectedprovider')
    || lower.includes('selectedmodel')
  ) {
    return 'configuration_error';
  }
  if (lower.includes('not found')) return 'element_not_found';
  if (lower.includes('no active tab') || lower.includes('no tab')) return 'no_active_tab';
  if (lower.includes('timeout') || lower.includes('timed out')) return 'task_timeout';
  if (lower.includes('extension_not_connected') || lower.includes('bridge disconnected')) {
    return 'extension_not_connected';
  }
  if (lower.includes('content script communication failed') || lower.includes('receiving end does not exist')) {
    return 'content_script_failed';
  }
  if (lower.includes('injection failed') || lower.includes('content script injection')) {
    return 'injection_failed';
  }
  return 'action_rejected';
}

function isBridgeOwnershipError(
  fsbResult: Record<string, unknown> | null | undefined,
  errorMsg: string,
): boolean {
  return fsbResult?.bridgeMode === 'disconnected'
    || fsbResult?.hubConnected === false
    || /bridge disconnected|port 7225|relay|disconnected mode/i.test(errorMsg);
}

function buildLayeredDetail(
  errorKey: string,
  fsbResult: Record<string, unknown> | null | undefined,
  errorMsg: string,
  validRecoveryTools: string[],
): ErrorDetail {
  const currentUrl = typeof fsbResult?.currentUrl === 'string' ? fsbResult.currentUrl : '';
  const pageType = typeof fsbResult?.pageType === 'string' ? fsbResult.pageType : 'Restricted page';
  const tool = typeof fsbResult?.tool === 'string' ? fsbResult.tool : 'this tool';
  const routeFamily = typeof fsbResult?.routeFamily === 'string' ? fsbResult.routeFamily : 'unknown';
  const recoveryHint = typeof fsbResult?.recoveryHint === 'string' && fsbResult.recoveryHint.trim().length > 0
    ? fsbResult.recoveryHint
    : 'Update the MCP server/extension pair so this direct route exists, then retry.';
  const url = typeof fsbResult?.url === 'string'
    ? fsbResult.url
    : (typeof fsbResult?.currentUrl === 'string' ? fsbResult.currentUrl : '');
  const allowedClients = getAllowedClientLabels(fsbResult);
  const clientLabel = typeof fsbResult?.clientLabel === 'string' ? fsbResult.clientLabel : '';

  switch (errorKey) {
    case 'package_version_mismatch':
      return {
        detected: LAYER_LABELS.package,
        why: 'The MCP runtime and package metadata do not agree on the installed version.',
        nextAction: 'Reinstall or rebuild fsb-mcp-server so the package metadata and runtime version match.',
      };
    case 'configuration_error':
      return {
        detected: LAYER_LABELS.configuration,
        why: 'The extension is attached, but its provider/model configuration is incomplete or unreadable.',
        nextAction: 'Open the FSB extension settings, choose a provider and model, then retry.',
      };
    case 'extension_not_connected':
      if (isBridgeOwnershipError(fsbResult, errorMsg)) {
        return {
          detected: LAYER_LABELS.bridge,
          why: 'The local MCP bridge is disconnected or does not own the active extension connection.',
          nextAction: 'Keep one fsb-mcp-server instance running as the bridge owner, then retry.',
        };
      }
      return {
        detected: LAYER_LABELS.extension,
        why: `The bridge is reachable, but the FSB browser extension is not attached to ${FSB_EXTENSION_BRIDGE_URL}.`,
        nextAction: 'Open Chrome/Edge/Brave with FSB enabled, then retry.',
      };
    case 'content_script_failed':
    case 'injection_failed':
      return {
        detected: LAYER_LABELS.contentScript,
        why: currentUrl
          ? `The active tab (${currentUrl}) does not have a ready content script.`
          : 'The active tab does not have a ready content script.',
        nextAction: 'Refresh or navigate the tab, wait for page readiness, then retry.',
      };
    case 'restricted_active_tab':
      return {
        detected: LAYER_LABELS.restrictedPage,
        why: `${pageType} (${currentUrl || 'no active URL'}) cannot run page-reading or interaction tools because the browser blocks content scripts there.`,
        nextAction: `Use ${formatRecoveryToolList(validRecoveryTools)} to move to a normal website first.`,
      };
    case 'mcp_route_unavailable':
      return {
        detected: LAYER_LABELS.toolRouting,
        why: `The direct MCP route for ${tool} (${routeFamily}) is unavailable.`,
        nextAction: recoveryHint,
      };
    case 'navigation_failed':
      return {
        detected: LAYER_LABELS.pageNavigation,
        why: `Navigation to ${url || 'the requested URL'} failed.`,
        nextAction: 'Verify the destination URL or switch to a normal website tab, then retry.',
      };
    case 'invalid_client_label':
      return {
        detected: LAYER_LABELS.visualSession,
        why: clientLabel
          ? `${clientLabel} is not on the trusted visual-session client allowlist.`
          : 'The requested client label is not on the trusted visual-session client allowlist.',
        nextAction: allowedClients.length > 0
          ? `Retry with one of the approved client labels: ${allowedClients.join(', ')}.`
          : 'Retry with one of the approved client labels documented for visual sessions.',
      };
    case 'visual_session_not_found':
      return {
        detected: LAYER_LABELS.visualSession,
        why: 'The provided visual-session token does not match an active client-owned visual session, which usually means it is stale, already finalized, or already cleared.',
        nextAction: 'Start a new visual session or retry with the latest token returned by start_visual_session before sending more progress or final-status updates.',
      };
    case 'visual_surface_busy':
      return {
        detected: LAYER_LABELS.visualSession,
        why: 'The active tab is already owned by an FSB automation run, so a second visual-session owner cannot claim the surface right now.',
        nextAction: 'Wait for the current automation to finish or stop it before starting a client-owned visual session.',
      };
    case 'session_not_found':
      return {
        detected: LAYER_LABELS.sessionLookup,
        why: errorMsg || 'The requested session id was not found in the active automation map or in the saved session history.',
        nextAction: typeof fsbResult?.recoveryHint === 'string' && fsbResult.recoveryHint.trim().length > 0
          ? fsbResult.recoveryHint
          : 'Use list_sessions to see historical sessions, or get_task_status to check for an active session.',
      };
    case 'no_active_tab':
      return {
        detected: LAYER_LABELS.pageNavigation,
        why: 'There is no active browser tab available for this tool call.',
        nextAction: `Use ${formatRecoveryToolList(validRecoveryTools)} to open or switch to a normal website tab, then retry.`,
      };
    default:
      return {
        detected: LAYER_LABELS.pageNavigation,
        why: errorMsg || 'The current page state did not allow the requested tool call to complete.',
        nextAction: 'Refresh page state with read_page or get_dom_snapshot, then retry.',
      };
  }
}

function appendRawError(text: string, errorMsg: string, errorKey: string): string {
  if (!errorMsg || errorMsg === errorKey || text.includes(errorMsg)) {
    return text;
  }
  return `${text}\n\nRaw error: ${errorMsg}`;
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
  const validRecoveryTools = getValidRecoveryTools(fsbResult);
  const errorKey = resolveErrorKey(fsbResult, errorMsg);
  const detail = buildLayeredDetail(errorKey, { ...(fsbResult || {}), ...(context || {}) }, errorMsg, validRecoveryTools);
  let text = [
    `Detected: ${detail.detected}`,
    `Why: ${detail.why}`,
    `Next action: ${detail.nextAction}`,
  ].join('\n');
  text = appendRawError(text, errorMsg, errorKey);

  // Log to stderr for MCP server-side debugging
  console.error(`[FSB MCP] Tool error: key=${errorKey} raw="${errorMsg}"`);

  return { content: [{ type: 'text', text }], isError: true };
}
