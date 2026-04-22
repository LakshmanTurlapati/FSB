'use strict';

// In Chrome extension importScripts context, TOOL_REGISTRY and getToolByName
// are globals from ai/tool-definitions.js. In Node.js/tests, fall back to require().
var _mcp_defs = (typeof TOOL_REGISTRY !== 'undefined')
  ? { TOOL_REGISTRY, getToolByName }
  : require('../ai/tool-definitions.js');
var _mcp_getToolByName = _mcp_defs.getToolByName;

const MCP_NAVIGATION_RECOVERY_TOOLS = ['navigate', 'open_tab', 'switch_tab', 'list_tabs'];
const MCP_ROUTE_RECOVERY_HINT = 'Use an explicitly supported MCP route or a navigation recovery tool.';
const MCP_PHASE199_EXCLUDED_BACKGROUND_TOOLS = new Set(['fill_credential', 'fill_payment_method']);

const MCP_PHASE199_TOOL_ROUTES = {
  navigate: { routeFamily: 'browser', handler: handleNavigateRoute },
  go_back: { routeFamily: 'browser', handler: handleNavigationHistoryRoute },
  go_forward: { routeFamily: 'browser', handler: handleNavigationHistoryRoute },
  refresh: { routeFamily: 'browser', handler: handleNavigationHistoryRoute },
  open_tab: { routeFamily: 'browser', handler: handleOpenTabRoute },
  switch_tab: { routeFamily: 'browser', handler: handleSwitchTabRoute },
  list_tabs: { routeFamily: 'browser', handler: handleListTabsRoute },
  execute_js: { routeFamily: 'browser', handler: handleExecuteJsRoute },
  get_site_guide: { routeFamily: 'browser', handler: handleGetSiteGuideRoute },
  report_progress: { routeFamily: 'task-status', handler: handleReportProgressRoute },
  complete_task: { routeFamily: 'task-status', handler: handleCompleteTaskRoute },
  partial_task: { routeFamily: 'task-status', handler: handlePartialTaskRoute },
  fail_task: { routeFamily: 'task-status', handler: handleFailTaskRoute }
};

const MCP_PHASE199_MESSAGE_ROUTES = {
  'mcp:get-tabs': { routeFamily: 'read-only', helperName: '_handleGetTabs' },
  'mcp:get-dom': { routeFamily: 'read-only', helperName: '_handleGetDOM' },
  'mcp:read-page': { routeFamily: 'read-only', helperName: '_handleReadPage' }
};

function createMcpRouteError(tool, routeFamily, error, extra = {}) {
  return {
    success: false,
    errorCode: extra.errorCode || 'mcp_route_unavailable',
    tool,
    routeFamily,
    recoveryHint: extra.recoveryHint || MCP_ROUTE_RECOVERY_HINT,
    error: error || `No direct MCP route is available for ${tool}`,
    ...extra
  };
}

function createMcpInvalidParamsError(tool, error, extra = {}) {
  return createMcpRouteError(tool, 'browser', error, {
    errorCode: 'mcp_route_invalid_params',
    recoveryHint: 'Provide the required MCP tool parameters and retry.',
    ...extra
  });
}

function hasMcpToolRoute(tool) {
  return Object.prototype.hasOwnProperty.call(MCP_PHASE199_TOOL_ROUTES, tool);
}

function hasMcpMessageRoute(type) {
  return Object.prototype.hasOwnProperty.call(MCP_PHASE199_MESSAGE_ROUTES, type);
}

function getMcpRouteContracts() {
  return {
    toolRoutes: Object.fromEntries(Object.entries(MCP_PHASE199_TOOL_ROUTES).map(([tool, route]) => [
      tool,
      { routeFamily: route.routeFamily, handler: route.handler.name }
    ])),
    messageRoutes: Object.fromEntries(Object.entries(MCP_PHASE199_MESSAGE_ROUTES).map(([type, route]) => [
      type,
      { routeFamily: route.routeFamily, helperName: route.helperName }
    ])),
    excludedBackgroundTools: Array.from(MCP_PHASE199_EXCLUDED_BACKGROUND_TOOLS),
    navigationRecoveryTools: MCP_NAVIGATION_RECOVERY_TOOLS.slice()
  };
}

async function dispatchMcpToolRoute({ tool, params = {}, client = null, tab = null, payload = {} }) {
  const route = MCP_PHASE199_TOOL_ROUTES[tool];
  if (!route) {
    return createMcpRouteError(tool, 'tool', `Unsupported MCP tool route: ${tool}`);
  }

  if (typeof route.handler !== 'function') {
    return createMcpRouteError(tool, route.routeFamily, `MCP tool route ${tool} has no handler`);
  }

  return route.handler({ tool, params: params || {}, client, tab, payload });
}

async function dispatchMcpMessageRoute({ type, payload = {}, client = null, mcpMsgId = null }) {
  const route = MCP_PHASE199_MESSAGE_ROUTES[type];
  if (!route) {
    return createMcpRouteError(type, 'message', `Unsupported MCP message route: ${type}`);
  }

  if (!client || typeof client[route.helperName] !== 'function') {
    return createMcpRouteError(type, 'message', 'Bridge client helper unavailable');
  }

  try {
    return await client[route.helperName](payload || {}, mcpMsgId);
  } catch (error) {
    return maybeBuildRestrictedResponse({ error, tool: type, client });
  }
}

function buildRestrictedMcpResponse({ currentUrl, pageType, tool, error }) {
  return {
    success: false,
    errorCode: 'restricted_active_tab',
    tool,
    currentUrl: currentUrl || '',
    pageType: pageType || getPageTypeDescriptionForMcp(currentUrl),
    error: error?.message || String(error || 'Content scripts are blocked on this page'),
    validRecoveryTools: MCP_NAVIGATION_RECOVERY_TOOLS.slice(),
    recoveryHint: 'Use navigate, open_tab, switch_tab, or list_tabs to move to a normal webpage first.'
  };
}

async function maybeBuildRestrictedResponse({ error, tool, client }) {
  const activeTab = await getActiveTabFromClient(client).catch(() => null);
  const currentUrl = activeTab?.url || '';
  if (!isRestrictedMcpUrl(currentUrl)) {
    throw error;
  }

  return buildRestrictedMcpResponse({
    currentUrl,
    pageType: getPageTypeDescriptionForMcp(currentUrl),
    tool,
    error
  });
}

async function getActiveTabFromClient(client) {
  if (client && typeof client._getActiveTab === 'function') {
    return client._getActiveTab();
  }
  const tabsApi = getChromeTabsApi();
  const tabs = await tabsApi.query({ active: true, currentWindow: true });
  return tabs && tabs[0] ? tabs[0] : null;
}

function getChromeTabsApi() {
  if (typeof chrome === 'undefined' || !chrome.tabs) {
    throw new Error('chrome.tabs API unavailable');
  }
  return chrome.tabs;
}

function isRestrictedMcpUrl(url) {
  if (!url) return true;
  const restrictedProtocols = ['chrome://', 'chrome-extension://', 'moz-extension://', 'edge://', 'about:', 'file://'];
  return restrictedProtocols.some(protocol => url.startsWith(protocol));
}

function getPageTypeDescriptionForMcp(url) {
  if (!url) return 'Restricted page';
  if (url.startsWith('chrome://')) return 'Chrome internal page';
  if (url.startsWith('chrome-extension://')) return 'Chrome extension page';
  if (url.startsWith('edge://')) return 'Edge internal page';
  if (url.startsWith('about:')) return 'Browser internal page';
  if (url.startsWith('file://')) return 'Local file';
  return 'Restricted page';
}

function getDomainFromUrl(url) {
  if (!url) return '';
  try {
    return new URL(url).hostname;
  } catch (_) {
    return '';
  }
}

function sanitizeTab(tab) {
  return {
    id: tab?.id ?? null,
    title: tab?.title || 'Untitled Tab',
    isActive: Boolean(tab?.active),
    domain: getDomainFromUrl(tab?.url),
    windowId: tab?.windowId ?? null
  };
}

function sanitizeSingleTab(tool, tab, extra = {}) {
  return {
    success: true,
    tool,
    tabId: tab?.id ?? null,
    url: tab?.url || '',
    domain: getDomainFromUrl(tab?.url),
    title: tab?.title || '',
    ...extra
  };
}

async function handleNavigateRoute() {
  return createMcpRouteError('navigate', 'browser', 'navigate direct handler unavailable');
}

async function handleNavigationHistoryRoute({ tool }) {
  return createMcpRouteError(tool, 'browser', `${tool} direct handler unavailable`);
}

async function handleOpenTabRoute() {
  return createMcpRouteError('open_tab', 'browser', 'open_tab direct handler unavailable');
}

async function handleSwitchTabRoute({ params }) {
  const numericTabId = Number(params?.tabId);
  if (!Number.isFinite(numericTabId)) {
    return createMcpInvalidParamsError('switch_tab', 'switch_tab requires numeric tabId');
  }
  return createMcpRouteError('switch_tab', 'browser', 'switch_tab direct handler unavailable', { tabId: numericTabId });
}

async function handleListTabsRoute() {
  return createMcpRouteError('list_tabs', 'browser', 'list_tabs direct handler unavailable');
}

async function handleExecuteJsRoute() {
  return createMcpRouteError('execute_js', 'browser', 'execute_js remains handled by the bridge client direct scripting path');
}

async function handleGetSiteGuideRoute() {
  return createMcpRouteError('get_site_guide', 'browser', 'get_site_guide is handled by the bridge client background helper');
}

function boundedString(value, maxLength) {
  return String(value || '').trim().slice(0, maxLength);
}

async function handleReportProgressRoute({ params }) {
  const message = boundedString(params?.message, 500);
  if (!message) {
    return createMcpInvalidParamsError('report_progress', 'report_progress requires message');
  }

  if (typeof automationLogger !== 'undefined' && automationLogger?.info) {
    automationLogger.info('MCP progress report', { message });
  }

  return { success: true, tool: 'report_progress', hadEffect: false, message };
}

async function handleCompleteTaskRoute({ params }) {
  const summary = boundedString(params?.summary, 2000);
  if (!summary) {
    return createMcpInvalidParamsError('complete_task', 'complete_task requires summary');
  }

  return { success: true, tool: 'complete_task', status: 'completed', hadEffect: false, summary };
}

async function handlePartialTaskRoute({ params }) {
  const summary = boundedString(params?.summary, 2000);
  const blocker = boundedString(params?.blocker, 1000);
  if (!summary || !blocker) {
    return createMcpInvalidParamsError('partial_task', 'partial_task requires summary and blocker');
  }

  const nextStep = boundedString(params?.next_step, 1000);
  const reason = boundedString(params?.reason, 100);
  return {
    success: true,
    tool: 'partial_task',
    status: 'partial',
    hadEffect: false,
    summary,
    blocker,
    ...(nextStep ? { nextStep } : {}),
    ...(reason ? { reason } : {})
  };
}

async function handleFailTaskRoute({ params }) {
  const reason = boundedString(params?.reason, 1000);
  if (!reason) {
    return createMcpInvalidParamsError('fail_task', 'fail_task requires reason');
  }

  return { success: false, tool: 'fail_task', status: 'failed', hadEffect: false, error: reason, reason };
}

const _mcp_dispatcher_exports = {
  dispatchMcpToolRoute,
  dispatchMcpMessageRoute,
  hasMcpToolRoute,
  hasMcpMessageRoute,
  getMcpRouteContracts,
  buildRestrictedMcpResponse,
  MCP_NAVIGATION_RECOVERY_TOOLS,
  createMcpRouteError,
  MCP_PHASE199_TOOL_ROUTES,
  MCP_PHASE199_MESSAGE_ROUTES,
  MCP_PHASE199_EXCLUDED_BACKGROUND_TOOLS
};

if (typeof globalThis !== 'undefined') {
  globalThis.fsbMcpToolDispatcher = _mcp_dispatcher_exports;
  globalThis.dispatchMcpToolRoute = dispatchMcpToolRoute;
  globalThis.dispatchMcpMessageRoute = dispatchMcpMessageRoute;
  globalThis.hasMcpToolRoute = hasMcpToolRoute;
  globalThis.hasMcpMessageRoute = hasMcpMessageRoute;
  globalThis.getMcpRouteContracts = getMcpRouteContracts;
  globalThis.buildRestrictedMcpResponse = buildRestrictedMcpResponse;
  globalThis.MCP_NAVIGATION_RECOVERY_TOOLS = MCP_NAVIGATION_RECOVERY_TOOLS;
  globalThis.createMcpRouteError = createMcpRouteError;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = _mcp_dispatcher_exports;
}
