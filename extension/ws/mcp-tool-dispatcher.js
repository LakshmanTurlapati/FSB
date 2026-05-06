'use strict';

// In Chrome extension importScripts context, TOOL_REGISTRY and getToolByName
// are globals from ai/tool-definitions.js. In Node.js/tests, fall back to require().
var _mcp_defs = (typeof TOOL_REGISTRY !== 'undefined')
  ? { TOOL_REGISTRY, getToolByName }
  : (typeof require !== 'undefined' ? require('../ai/tool-definitions.js') : {});
var _mcp_getToolByName = _mcp_defs.getToolByName;
var _mcp_visual_defs = (typeof MCPVisualSessionUtils !== 'undefined')
  ? MCPVisualSessionUtils
  : (typeof require !== 'undefined' ? require('../utils/mcp-visual-session.js') : {});
var _mcp_normalizeVisualClientLabel = _mcp_visual_defs.normalizeMcpVisualClientLabel;
var _mcp_getAllowedVisualClientLabels = _mcp_visual_defs.getAllowedMcpVisualClientLabels;

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
  start_visual_session: { routeFamily: 'visual-session', messageType: 'mcp:start-visual-session', handler: handleToolAliasRoute },
  end_visual_session: { routeFamily: 'visual-session', messageType: 'mcp:end-visual-session', handler: handleToolAliasRoute },
  execute_js: { routeFamily: 'browser', handler: handleExecuteJsRoute },
  run_task: { routeFamily: 'autopilot', messageType: 'mcp:start-automation', handler: handleToolAliasRoute },
  stop_task: { routeFamily: 'autopilot', messageType: 'mcp:stop-automation', handler: handleToolAliasRoute },
  get_task_status: { routeFamily: 'autopilot', messageType: 'mcp:get-status', handler: handleToolAliasRoute },
  get_site_guide: { routeFamily: 'read-only', messageType: 'mcp:get-site-guides', handler: handleToolAliasRoute },
  get_page_snapshot: { routeFamily: 'read-only', messageType: 'mcp:get-page-snapshot', handler: handleToolAliasRoute },
  list_sessions: { routeFamily: 'observability', messageType: 'mcp:list-sessions', handler: handleToolAliasRoute },
  get_session_detail: { routeFamily: 'observability', messageType: 'mcp:get-session', handler: handleToolAliasRoute },
  get_logs: { routeFamily: 'observability', messageType: 'mcp:get-logs', handler: handleToolAliasRoute },
  search_memory: { routeFamily: 'observability', messageType: 'mcp:search-memory', handler: handleToolAliasRoute },
  get_memory_stats: { routeFamily: 'observability', messageType: 'mcp:get-memory', handler: handleToolAliasRoute },
  read_page: { routeFamily: 'read-only', messageType: 'mcp:read-page', handler: handleToolAliasRoute },
  get_dom_snapshot: { routeFamily: 'read-only', messageType: 'mcp:get-dom', handler: handleToolAliasRoute },
  report_progress: { routeFamily: 'task-status', handler: handleReportProgressRoute },
  complete_task: { routeFamily: 'task-status', handler: handleCompleteTaskRoute },
  partial_task: { routeFamily: 'task-status', handler: handlePartialTaskRoute },
  fail_task: { routeFamily: 'task-status', handler: handleFailTaskRoute }
};

const MCP_PHASE199_MESSAGE_ROUTES = {
  'mcp:get-tabs': { routeFamily: 'read-only', helperName: '_handleGetTabs' },
  'mcp:get-diagnostics': { routeFamily: 'diagnostics', handler: handleGetDiagnosticsMessageRoute },
  'mcp:get-site-guides': { routeFamily: 'read-only', handler: handleGetSiteGuidesRoute },
  'mcp:get-page-snapshot': { routeFamily: 'read-only', handler: handleGetPageSnapshotRoute },
  'mcp:get-dom': { routeFamily: 'read-only', helperName: '_handleGetDOM' },
  'mcp:read-page': { routeFamily: 'read-only', helperName: '_handleReadPage' },
  'mcp:start-visual-session': { routeFamily: 'visual-session', handler: handleStartVisualSessionRoute },
  'mcp:end-visual-session': { routeFamily: 'visual-session', handler: handleEndVisualSessionRoute },
  'mcp:start-automation': { routeFamily: 'autopilot', handler: handleStartAutomationRoute },
  'mcp:stop-automation': { routeFamily: 'autopilot', handler: handleStopAutomationRoute },
  'mcp:get-status': { routeFamily: 'autopilot', handler: handleGetStatusRoute },
  'mcp:list-sessions': { routeFamily: 'observability', handler: handleListSessionsMessageRoute },
  'mcp:get-session': { routeFamily: 'observability', handler: handleGetSessionMessageRoute },
  'mcp:get-logs': { routeFamily: 'observability', handler: handleGetLogsMessageRoute },
  'mcp:search-memory': { routeFamily: 'observability', handler: handleSearchMemoryMessageRoute },
  'mcp:get-memory': { routeFamily: 'observability', handler: handleGetMemoryMessageRoute },
  // Phase 238: agent identity routes. Resolve through globalThis.fsbAgentRegistryInstance
  // (Phase 237 registry surface). Phase 240 will validate ownership at every dispatch
  // boundary; Phase 238 is structural setup only.
  'agent:register': { routeFamily: 'agent', handler: handleAgentRegisterRoute },
  'agent:release':  { routeFamily: 'agent', handler: handleAgentReleaseRoute },
  'agent:status':   { routeFamily: 'agent', handler: handleAgentStatusRoute }
};

function createMcpRouteError(tool, routeFamily, recoveryHint = MCP_ROUTE_RECOVERY_HINT, extra = {}) {
  return {
    success: false,
    errorCode: extra.errorCode || 'mcp_route_unavailable',
    tool,
    routeFamily,
    recoveryHint: extra.recoveryHint || recoveryHint || MCP_ROUTE_RECOVERY_HINT,
    error: extra.error || `Missing direct MCP route for ${tool}`,
    ...extra
  };
}

function createMcpInvalidParamsError(tool, error, extra = {}) {
  const routeFamily = extra.routeFamily || 'browser';
  const rest = { ...extra };
  delete rest.routeFamily;
  return createMcpRouteError(tool, routeFamily, 'Provide the required MCP tool parameters and retry.', {
    errorCode: 'mcp_route_invalid_params',
    error,
    ...rest
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
      { routeFamily: route.routeFamily, handler: route.handler.name, ...(route.messageType ? { messageType: route.messageType } : {}) }
    ])),
    messageRoutes: Object.fromEntries(Object.entries(MCP_PHASE199_MESSAGE_ROUTES).map(([type, route]) => [
      type,
      { routeFamily: route.routeFamily, ...(route.helperName ? { helperName: route.helperName } : {}), ...(route.handler ? { handler: route.handler.name } : {}) }
    ])),
    excludedBackgroundTools: Array.from(MCP_PHASE199_EXCLUDED_BACKGROUND_TOOLS),
    navigationRecoveryTools: MCP_NAVIGATION_RECOVERY_TOOLS.slice()
  };
}

async function dispatchMcpToolRoute({ tool, params = {}, client = null, tab = null, payload = {} }) {
  const route = MCP_PHASE199_TOOL_ROUTES[tool];
  if (!route) {
    return createMcpRouteError(tool, 'tool', MCP_ROUTE_RECOVERY_HINT);
  }

  if (typeof route.handler !== 'function') {
    return createMcpRouteError(tool, route.routeFamily, MCP_ROUTE_RECOVERY_HINT);
  }

  return route.handler({ tool, params: params || {}, client, tab, payload, route });
}

async function dispatchMcpMessageRoute({ type, payload = {}, client = null, mcpMsgId = null }) {
  const route = MCP_PHASE199_MESSAGE_ROUTES[type];
  if (!route) {
    return createMcpRouteError(type, 'message', MCP_ROUTE_RECOVERY_HINT);
  }

  const restrictedReadResponse = await buildRestrictedResponseIfReadRoute({ type, client });
  if (restrictedReadResponse) return restrictedReadResponse;

  if (typeof route.handler === 'function') {
    try {
      return await route.handler({ type, payload: payload || {}, client, mcpMsgId, route });
    } catch (error) {
      return maybeBuildRestrictedResponse({ error, tool: type, client });
    }
  }

  if (!client || typeof client[route.helperName] !== 'function') {
    const restrictedResponse = await buildRestrictedResponseIfActive({ client, tool: type, error: new Error('Bridge client helper unavailable') });
    if (restrictedResponse) return restrictedResponse;
    return createMcpRouteError(type, 'message', MCP_ROUTE_RECOVERY_HINT, { error: 'Bridge client helper unavailable' });
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
    error: error?.message || String(error || 'Active tab is restricted'),
    currentUrl: currentUrl || '',
    pageType: pageType || 'Restricted page',
    tool: tool || null,
    validRecoveryTools: MCP_NAVIGATION_RECOVERY_TOOLS.slice()
  };
}

async function buildRestrictedResponseIfReadRoute({ type, client }) {
  if (type !== 'mcp:read-page' && type !== 'mcp:get-dom') return null;
  const activeTab = await getActiveTabFromClient(client).catch(() => null);
  const currentUrl = activeTab?.url || '';
  if (!isRestrictedMcpUrl(currentUrl)) return null;

  return buildRestrictedMcpResponse({
    currentUrl,
    pageType: getPageTypeDescriptionForMcp(currentUrl),
    tool: type === 'mcp:read-page' ? 'read_page' : 'get_dom_snapshot',
    error: 'Active tab is restricted'
  });
}

async function maybeBuildRestrictedResponse({ error, tool, client }) {
  const restrictedResponse = await buildRestrictedResponseIfActive({ client, tool, error });
  if (restrictedResponse) return restrictedResponse;
  throw error;
}

async function buildRestrictedResponseIfActive({ client, tool, error }) {
  const activeTab = await getActiveTabFromClient(client).catch(() => null);
  const currentUrl = activeTab?.url || '';
  if (!isRestrictedMcpUrl(currentUrl)) {
    return null;
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
  if (typeof isRestrictedURL === 'function' && isRestrictedURL(url)) return true;
  const restrictedPages = [
    'about:blank',
    'about:newtab',
    'chrome://newtab/',
    'chrome://settings/',
    'chrome://extensions/',
    'chrome://history/',
    'chrome://downloads/'
  ];
  if (restrictedPages.some(page => url.startsWith(page))) return true;
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

function hasActiveAutomationSessionForTab(tabId) {
  if (!Number.isFinite(tabId)) return false;
  const sessions = getActiveSessionsMap();
  for (const session of sessions.values()) {
    if (!session || session.isBackgroundAgent) continue;
    if (session.tabId === tabId || session.originalTabId === tabId || session.previousTabId === tabId) {
      return true;
    }
  }
  return false;
}

async function handleNavigateRoute({ params, client }) {
  if (!params?.url || typeof params.url !== 'string') {
    return createMcpInvalidParamsError('navigate', 'navigate requires url');
  }

  try {
    getChromeTabsApi();
    const activeTab = await getActiveTabFromClient(client);
    if (!activeTab?.id && !Number.isFinite(params.tabId)) {
      return createMcpRouteError('navigate', 'browser', 'Use list_tabs or open_tab to find a navigable tab before retrying.', {
        errorCode: 'no_active_tab',
        error: 'No active tab available for navigation'
      });
    }

    const targetTabId = Number.isFinite(params.tabId) ? params.tabId : activeTab.id;
    const updatedTab = await chrome.tabs.update(targetTabId, { url: params.url });
    return sanitizeSingleTab('navigate', { ...activeTab, ...updatedTab, id: targetTabId, url: updatedTab?.url || params.url });
  } catch (error) {
    return createMcpRouteError('navigate', 'browser', MCP_ROUTE_RECOVERY_HINT, { error: error.message || String(error) });
  }
}

async function handleNavigationHistoryRoute({ tool, params, client }) {
  let targetTabId = Number.isFinite(params?.tabId) ? params.tabId : null;
  try {
    getChromeTabsApi();
    const activeTab = await getActiveTabFromClient(client);
    if (!activeTab?.id && targetTabId === null) {
      return createMcpRouteError(tool, 'browser', 'Use list_tabs or open_tab to find a navigable tab before retrying.', {
        errorCode: 'no_active_tab',
        error: 'No active tab available for navigation'
      });
    }

    targetTabId = targetTabId === null ? activeTab.id : targetTabId;
    if (tool === 'go_back') {
      await chrome.tabs.goBack(targetTabId);
    } else if (tool === 'go_forward') {
      await chrome.tabs.goForward(targetTabId);
    } else {
      await chrome.tabs.reload(targetTabId);
    }

    return { success: true, tool, tabId: targetTabId };
  } catch (error) {
    return {
      success: false,
      errorCode: 'navigation_unavailable',
      tool,
      tabId: targetTabId,
      error: error.message || String(error)
    };
  }
}

async function handleOpenTabRoute({ params }) {
  try {
    getChromeTabsApi();
    const tab = await chrome.tabs.create({ url: params.url || 'about:blank', active: params.active !== false });
    return sanitizeSingleTab('open_tab', tab);
  } catch (error) {
    return createMcpRouteError('open_tab', 'browser', MCP_ROUTE_RECOVERY_HINT, { error: error.message || String(error) });
  }
}

async function handleSwitchTabRoute({ params }) {
  if (!Number.isFinite(params?.tabId)) {
    return createMcpInvalidParamsError('switch_tab', 'switch_tab requires numeric tabId');
  }

  try {
    getChromeTabsApi();
    const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const previousTabId = currentTab ? currentTab.id : null;
    let tab = await chrome.tabs.update(params.tabId, { active: true });
    if (chrome.tabs.get) {
      tab = await chrome.tabs.get(params.tabId);
    }
    if (typeof chrome !== 'undefined' && chrome.windows?.update && tab?.windowId) {
      await chrome.windows.update(tab.windowId, { focused: true });
    }

    return sanitizeSingleTab('switch_tab', tab, { tabId: params.tabId, previousTabId });
  } catch (error) {
    return createMcpRouteError('switch_tab', 'browser', MCP_ROUTE_RECOVERY_HINT, { error: error.message || String(error), tabId: params.tabId });
  }
}

async function handleListTabsRoute({ params }) {
  try {
    getChromeTabsApi();
    const queryOptions = {};
    if (params?.currentWindowOnly === true) {
      queryOptions.currentWindow = true;
    }

    const tabs = await chrome.tabs.query(queryOptions);
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const sanitizedTabs = tabs.map(sanitizeTab);
    return {
      success: true,
      tool: 'list_tabs',
      tabs: sanitizedTabs,
      activeTabId: activeTab?.id ?? null,
      totalTabs: sanitizedTabs.length
    };
  } catch (error) {
    return createMcpRouteError('list_tabs', 'browser', MCP_ROUTE_RECOVERY_HINT, { error: error.message || String(error) });
  }
}

async function handleExecuteJsRoute() {
  return createMcpRouteError('execute_js', 'browser', MCP_ROUTE_RECOVERY_HINT, { error: 'execute_js remains handled by the bridge client direct scripting path' });
}

async function handleGetSiteGuideRoute({ params, client }) {
  if (!client || typeof client._handleGetSiteGuides !== 'function') {
    return createMcpRouteError('get_site_guide', 'browser', MCP_ROUTE_RECOVERY_HINT, { error: 'Bridge client site guide helper unavailable' });
  }
  return client._handleGetSiteGuides(params);
}

function boundedString(value, maxLength) {
  return String(value || '').trim().slice(0, maxLength);
}

function boundedPositiveInt(value, defaultValue, maxValue) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return defaultValue;
  return Math.min(parsed, maxValue);
}

function isPromptOrRawResponseLog(entry) {
  const logType = entry?.data?.logType || entry?.logType || null;
  return logType === 'prompt' || logType === 'rawResponse';
}

function isSensitiveKey(key) {
  return /password|passcode|token|secret|apikey|api_key|authorization|credential|cardnumber|card_number|cvv|cvc|vault|payment|privatekey|private_key/i.test(String(key || ''));
}

function sanitizeValue(value, options = {}, depth = 0) {
  const maxString = options.maxString || 1000;
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return value.slice(0, maxString);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) {
    const maxArray = options.maxArray || 50;
    return value.slice(0, maxArray).map(item => sanitizeValue(item, options, depth + 1));
  }
  if (typeof value === 'object') {
    if (depth >= (options.maxDepth || 3)) return '[object]';
    const output = {};
    for (const [key, item] of Object.entries(value)) {
      if (isSensitiveKey(key)) continue;
      output[key] = sanitizeValue(item, options, depth + 1);
    }
    return output;
  }
  return String(value).slice(0, maxString);
}

function sanitizeLogEntry(entry) {
  return sanitizeValue(entry || {}, { maxString: 1000, maxArray: 50, maxDepth: 4 });
}

function filterAndCapLogs(logs, limit) {
  const cappedLimit = boundedPositiveInt(limit, 50, 200);
  return (Array.isArray(logs) ? logs : [])
    .filter(entry => !isPromptOrRawResponseLog(entry))
    .slice(-cappedLimit)
    .map(sanitizeLogEntry);
}

function sanitizeSessionMetadata(session) {
  if (!session || typeof session !== 'object') return null;
  const sanitized = sanitizeValue(session, { maxString: 1000, maxArray: 100, maxDepth: 4 });
  delete sanitized.logs;
  delete sanitized.actionHistory;
  return sanitized;
}

function sanitizeActionHistoryEntry(action) {
  const params = (action?.params && typeof action.params === 'object') ? action.params : {};
  const result = (action?.result && typeof action.result === 'object') ? action.result : {};
  return {
    tool: action?.tool || null,
    timestamp: action?.timestamp || null,
    iteration: action?.iteration || null,
    ...(params.selector ? { selector: boundedString(params.selector, 250) } : {}),
    ...(params.url ? { domain: getDomainFromUrl(params.url) } : {}),
    result: {
      success: Boolean(result.success),
      ...(result.error ? { error: boundedString(result.error, 500) } : {})
    }
  };
}

function sanitizeSessionDetail(session) {
  if (!session || typeof session !== 'object') {
    return null;
  }

  const sanitized = sanitizeSessionMetadata(session);
  sanitized.logs = filterAndCapLogs(session.logs || [], 200);
  if (Array.isArray(session.actionHistory)) {
    sanitized.actionHistory = session.actionHistory.slice(-100).map(sanitizeActionHistoryEntry);
  }
  // Phase 233: defensive iteration intent log (toolCallLog) — captures every
  // tool call the LLM emitted regardless of whether actionHistory recorded it.
  if (Array.isArray(session.toolCallLog)) {
    sanitized.toolCallLog = session.toolCallLog.slice(-200);
  }
  return sanitized;
}

function sanitizeMemoryEntry(memory) {
  return {
    id: memory?.id || null,
    type: memory?.type || null,
    text: String(memory?.text || '').slice(0, 500),
    metadata: sanitizeValue(memory?.metadata || {}, { maxString: 500, maxArray: 25, maxDepth: 3 })
  };
}

function getMemoryListStorageUsageBytes(memories) {
  try {
    return new Blob([JSON.stringify(memories || [])]).size;
  } catch (_) {
    try {
      return JSON.stringify(memories || []).length;
    } catch (__) {
      return 0;
    }
  }
}

function getActiveSessionsMap() {
  return (typeof activeSessions !== 'undefined' && activeSessions instanceof Map) ? activeSessions : new Map();
}

function callCallbackHandler(handlerName, request, sender = {}, routeFamily = 'autopilot') {
  const handler = typeof globalThis !== 'undefined' ? globalThis[handlerName] : null;
  const directHandler = typeof handler === 'function'
    ? handler
    : (handlerName === 'handleStartAutomation' && typeof handleStartAutomation === 'function')
      ? handleStartAutomation
      : (handlerName === 'handleStopAutomation' && typeof handleStopAutomation === 'function')
        ? handleStopAutomation
        : null;

  if (typeof directHandler !== 'function') {
    return Promise.resolve(createMcpRouteError(request?.action || handlerName, routeFamily, MCP_ROUTE_RECOVERY_HINT, { error: `${handlerName} unavailable` }));
  }

  return new Promise((resolve) => {
    try {
      const result = directHandler(request, sender, (response) => resolve(response || {}));
      if (result && typeof result.catch === 'function') {
        result.catch((error) => resolve({ success: false, error: error.message || String(error) }));
      }
    } catch (error) {
      resolve({ success: false, error: error.message || String(error) });
    }
  });
}

async function handleToolAliasRoute({ params, client, route }) {
  return dispatchMcpMessageRoute({
    type: route.messageType,
    payload: params || {},
    client
  });
}

async function handleStartVisualSessionRoute({ payload, client }) {
  const clientLabel = _mcp_normalizeVisualClientLabel(payload?.clientLabel || payload?.client);
  if (!clientLabel) {
    return createMcpRouteError('start_visual_session', 'visual-session', 'Retry with one of the approved MCP client labels.', {
      errorCode: 'invalid_client_label',
      error: 'Unapproved MCP client label',
      clientLabel: payload?.clientLabel || payload?.client || null,
      allowedClients: _mcp_getAllowedVisualClientLabels()
    });
  }

  const task = boundedString(payload?.task, 500);
  if (!task) {
    return createMcpInvalidParamsError('start_visual_session', 'start_visual_session requires task', { routeFamily: 'visual-session' });
  }

  const tab = await getActiveTabFromClient(client);
  if (!tab?.id) {
    return createMcpRouteError('start_visual_session', 'visual-session', 'Use navigate, open_tab, switch_tab, or list_tabs to move to a normal webpage first.', {
      errorCode: 'no_active_tab',
      error: 'No active tab available for visual session'
    });
  }

  if (isRestrictedMcpUrl(tab.url || '')) {
    return buildRestrictedMcpResponse({
      currentUrl: tab.url || '',
      pageType: getPageTypeDescriptionForMcp(tab.url || ''),
      tool: 'start_visual_session',
      error: 'Active tab is restricted'
    });
  }

  if (hasActiveAutomationSessionForTab(tab.id)) {
    return createMcpRouteError('start_visual_session', 'visual-session', 'Wait for the current FSB automation to finish or stop it before starting a client-owned visual session.', {
      errorCode: 'visual_surface_busy',
      error: 'FSB automation already owns the active visual surface on this tab',
      tabId: tab.id
    });
  }

  return callCallbackHandler(
    'handleStartMcpVisualSession',
    {
      action: 'startMcpVisualSession',
      tabId: tab.id,
      clientLabel,
      task,
      detail: boundedString(payload?.detail, 1000)
    },
    { tab: { id: tab.id } }
  );
}

async function handleEndVisualSessionRoute({ payload }) {
  const sessionToken = boundedString(payload?.sessionToken || payload?.session_token, 200);
  if (!sessionToken) {
    return createMcpInvalidParamsError('end_visual_session', 'end_visual_session requires sessionToken', { routeFamily: 'visual-session' });
  }

  return callCallbackHandler(
    'handleEndMcpVisualSession',
    {
      action: 'endMcpVisualSession',
      sessionToken,
      reason: boundedString(payload?.reason, 100)
    },
    {}
  );
}

// Phase 238: agent identity routes. Resolve through the Phase 237 registry
// surface (globalThis.fsbAgentRegistryInstance). Phase 240 will validate
// ownership at every dispatch boundary; Phase 238 is structural setup only.

async function handleAgentRegisterRoute() {
  const reg = globalThis.fsbAgentRegistryInstance;
  if (!reg || typeof reg.registerAgent !== 'function') {
    return { success: false, errorCode: 'agent_registry_unavailable', error: 'AgentRegistry not initialized' };
  }
  // D-12: ignore caller-supplied agentId; registry mints fresh via crypto.randomUUID().
  const minted = await reg.registerAgent();
  const agentId = minted && minted.agentId;
  const agentIdShort = (minted && minted.agentIdShort)
    || ((globalThis.FsbAgentRegistry && typeof globalThis.FsbAgentRegistry.formatAgentIdForDisplay === 'function')
      ? globalThis.FsbAgentRegistry.formatAgentIdForDisplay(agentId || '')
      : (typeof agentId === 'string' ? agentId.slice(0, 12) : ''));
  console.log('[FSB MCP Dispatcher] agent:register minted ' + agentIdShort);
  return { success: true, agentId, agentIdShort };
}

async function handleAgentReleaseRoute({ payload } = {}) {
  const reg = globalThis.fsbAgentRegistryInstance;
  if (!reg || typeof reg.releaseAgent !== 'function') {
    return { success: false, errorCode: 'agent_registry_unavailable', error: 'AgentRegistry not initialized' };
  }
  const agentId = payload && payload.agentId;
  if (!agentId) {
    return createMcpInvalidParamsError('agent:release', 'agent:release requires agentId', { routeFamily: 'agent' });
  }
  const reason = (payload && payload.reason) || 'mcp-explicit';
  const result = await reg.releaseAgent(agentId, reason);
  // The Phase 237 registry returns a plain boolean today; future evolution may
  // return { released, releasedTabIds }. Accept either shape defensively.
  const released = (result === true) || !!(result && result.released);
  return { success: true, released };
}

async function handleAgentStatusRoute({ payload } = {}) {
  const reg = globalThis.fsbAgentRegistryInstance;
  if (!reg || typeof reg.getAgentTabs !== 'function') {
    return { success: false, errorCode: 'agent_registry_unavailable', error: 'AgentRegistry not initialized' };
  }
  const agentId = payload && payload.agentId;
  if (!agentId) {
    return createMcpInvalidParamsError('agent:status', 'agent:status requires agentId', { routeFamily: 'agent' });
  }
  const tabIds = reg.getAgentTabs(agentId) || [];
  const fmt = (globalThis.FsbAgentRegistry && typeof globalThis.FsbAgentRegistry.formatAgentIdForDisplay === 'function')
    ? globalThis.FsbAgentRegistry.formatAgentIdForDisplay
    : (id) => String(id || '').slice(0, 12);
  return { success: true, agentId, agentIdShort: fmt(agentId), tabIds };
}

async function handleStartAutomationRoute({ payload, client }) {
  const tab = await getActiveTabFromClient(client);
  if (!tab?.id) {
    return createMcpRouteError('run_task', 'autopilot', 'Use navigate, open_tab, switch_tab, or list_tabs to move to a normal webpage first.', {
      errorCode: 'no_active_tab',
      error: 'No active tab available for automation'
    });
  }

  return callCallbackHandler(
    'handleStartAutomation',
    {
      action: 'startAutomation',
      task: payload.task,
      tabId: tab.id,
      source: 'mcp'
    },
    { tab: { id: tab.id } }
  );
}

async function handleStopAutomationRoute({ payload, client }) {
  const tab = await getActiveTabFromClient(client).catch(() => null);

  // Phase 225-01 (Task 2): MCP stop_task tool ships no sessionId in its
  // schema, so payload.sessionId is undefined and handleStopAutomation cannot
  // find anything in storage. Resolve to the in-flight session via the active
  // sessions map (same source get_task_status uses for currentSessionId).
  let sessionId = payload && payload.sessionId;
  if (!sessionId) {
    const sessions = getActiveSessionsMap();
    const ids = Array.from(sessions.keys());
    if (ids.length > 0) {
      sessionId = ids[0];
      try {
        const redact = (typeof globalThis !== 'undefined' && typeof globalThis.redactForLog === 'function')
          ? globalThis.redactForLog
          : (v) => v;
        console.log('[FSB MCP] stop_task resolved in-flight session', redact({ sessionId }));
      } catch (_e) { /* logging never blocks dispatch */ }
    }
  }

  if (!sessionId) {
    return {
      success: false,
      errorCode: 'session_not_found',
      tool: 'stop_task',
      routeFamily: 'autopilot',
      error: 'No active automation session to stop',
      recoveryHint: 'Use get_task_status to confirm whether a session is running before calling stop_task.'
    };
  }

  return callCallbackHandler(
    'handleStopAutomation',
    {
      action: 'stopAutomation',
      sessionId
    },
    tab?.id ? { tab: { id: tab.id } } : {}
  );
}

async function handleGetStatusRoute() {
  const sessions = getActiveSessionsMap();
  const sessionIds = Array.from(sessions.keys());
  const firstSession = sessionIds.length > 0 ? sessions.get(sessionIds[0]) : null;
  return {
    status: 'ready',
    activeSessions: sessions.size,
    sessionIds,
    currentSessionId: sessionIds[0] || null,
    currentTask: firstSession?.task || null,
    currentStartTime: firstSession?.startTime || null,
    currentIterationCount: firstSession?.iterationCount || 0,
    currentMaxIterations: firstSession?.maxIterations || 20,
    currentActionCount: firstSession?.actionHistory?.length || 0
  };
}

async function handleGetPageSnapshotRoute({ payload, client }) {
  const tab = await getActiveTabFromClient(client).catch(() => null);
  if (!tab?.id) {
    return createMcpRouteError('get_page_snapshot', 'read-only', 'Use navigate, open_tab, switch_tab, or list_tabs to move to a normal webpage first.', {
      errorCode: 'no_active_tab',
      error: 'No active tab available for page snapshot'
    });
  }

  if (isRestrictedMcpUrl(tab.url || '')) {
    return buildRestrictedMcpResponse({
      currentUrl: tab.url || '',
      pageType: getPageTypeDescriptionForMcp(tab.url || ''),
      tool: 'get_page_snapshot',
      error: 'Active tab is restricted'
    });
  }

  const charBudget = boundedPositiveInt(payload?.charBudget, 12000, 32000);
  const maxElements = boundedPositiveInt(payload?.maxElements, 80, 250);

  const sendToContentScript = (typeof client?._sendToContentScript === 'function')
    ? (tabId, message) => client._sendToContentScript(tabId, message)
    : (tabId, message) => new Promise((resolve, reject) => {
        try {
          getChromeTabsApi();
          chrome.tabs.sendMessage(tabId, message, { frameId: 0 }, (response) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
              return;
            }
            resolve(response || {});
          });
        } catch (error) {
          reject(error);
        }
      });

  try {
    const response = await sendToContentScript(tab.id, {
      action: 'getMarkdownSnapshot',
      options: { charBudget, maxElements }
    });
    if (response && response.success && response.markdownSnapshot) {
      return {
        success: true,
        tool: 'get_page_snapshot',
        snapshot: response.markdownSnapshot,
        elementCount: response.elementCount || 0,
        url: tab.url || '',
        tabId: tab.id
      };
    }
    return createMcpRouteError('get_page_snapshot', 'read-only', MCP_ROUTE_RECOVERY_HINT, {
      error: (response && response.error) || 'Snapshot unavailable'
    });
  } catch (error) {
    return createMcpRouteError('get_page_snapshot', 'read-only', MCP_ROUTE_RECOVERY_HINT, {
      error: error.message || String(error)
    });
  }
}

async function handleGetSiteGuidesRoute({ payload }) {
  const task = payload.task || payload.query || '';
  const url = payload.url || payload.domain || '';
  let guide = null;

  if (task && typeof getGuideForTask === 'function') {
    guide = getGuideForTask(task, url);
  } else if (url && typeof getGuideForUrl === 'function') {
    guide = getGuideForUrl(url);
  }

  return { success: true, guide: guide || null };
}

async function handleGetDiagnosticsMessageRoute() {
  const helper = (typeof globalThis !== 'undefined' && typeof globalThis.collectMcpDiagnosticsSnapshot === 'function')
    ? globalThis.collectMcpDiagnosticsSnapshot
    : (typeof collectMcpDiagnosticsSnapshot === 'function' ? collectMcpDiagnosticsSnapshot : null);

  if (typeof helper !== 'function') {
    return createMcpRouteError('mcp:get-diagnostics', 'diagnostics', MCP_ROUTE_RECOVERY_HINT, {
      error: 'Background diagnostics helper unavailable'
    });
  }

  return helper();
}

async function handleListSessionsMessageRoute({ payload }) {
  if (typeof automationLogger === 'undefined' || typeof automationLogger?.listSessions !== 'function') {
    return createMcpRouteError('list_sessions', 'observability', MCP_ROUTE_RECOVERY_HINT, { error: 'Automation logger sessions unavailable' });
  }

  const limit = boundedPositiveInt(payload.limit, 50, 50);
  const sessions = await automationLogger.listSessions();
  return {
    success: true,
    sessions: (Array.isArray(sessions) ? sessions : []).slice(0, limit).map(sanitizeSessionMetadata).filter(Boolean)
  };
}

function buildInFlightSessionSnapshot(sessionId, session) {
  if (!session || typeof session !== 'object') return null;
  const lastAction = Array.isArray(session.actionHistory) && session.actionHistory.length > 0
    ? session.actionHistory[session.actionHistory.length - 1]
    : null;
  return {
    sessionId,
    final: false,
    status: session.status || 'in-flight',
    startedAt: session.startTime || null,
    iterationCount: session.iterationCount || 0,
    maxIterations: session.maxIterations || null,
    actionCount: Array.isArray(session.actionHistory) ? session.actionHistory.length : 0,
    currentAction: lastAction ? sanitizeActionHistoryEntry(lastAction) : null,
    taskDescription: typeof session.task === 'string' ? boundedString(session.task, 500) : null,
    tabId: typeof session.tabId === 'number' ? session.tabId : null,
    lastUrl: typeof session.lastUrl === 'string' ? session.lastUrl : null,
    note: 'In-flight session: no terminal outcome yet. Re-query after completion (or via list_sessions) for full history.'
  };
}

async function handleGetSessionMessageRoute({ payload }) {
  if (!payload.sessionId) {
    return createMcpInvalidParamsError('get_session_detail', 'get_session_detail requires sessionId', { routeFamily: 'observability' });
  }
  if (typeof automationLogger === 'undefined' || typeof automationLogger?.loadSession !== 'function') {
    return createMcpRouteError('get_session_detail', 'observability', MCP_ROUTE_RECOVERY_HINT, { error: 'Automation logger session loader unavailable' });
  }

  const session = await automationLogger.loadSession(payload.sessionId);
  if (session) {
    return {
      success: true,
      session: sanitizeSessionDetail(session)
    };
  }

  // Phase 225-01 (Task 2): historical lookup missed -- fall back to in-flight
  // sessions. Active sessions live in the activeSessions map (same source
  // currentSessionId is derived from in handleGetStatusRoute) and are NOT yet
  // in the history store. Without this fallback, get_session_detail returns
  // "Session not found" while the session is actively running.
  const activeSessions = getActiveSessionsMap();
  const liveSession = activeSessions.get(payload.sessionId);
  if (liveSession) {
    try {
      const redact = (typeof globalThis !== 'undefined' && typeof globalThis.redactForLog === 'function')
        ? globalThis.redactForLog
        : (v) => v;
      console.log('[FSB MCP] get_session_detail resolved in-flight session', redact({ sessionId: payload.sessionId, status: liveSession.status }));
    } catch (_e) { /* logging never blocks dispatch */ }
    return {
      success: true,
      session: buildInFlightSessionSnapshot(payload.sessionId, liveSession),
      inFlight: true
    };
  }

  return {
    success: false,
    errorCode: 'session_not_found',
    tool: 'get_session_detail',
    routeFamily: 'observability',
    error: `Session ${payload.sessionId} not found in active or historical sessions`,
    recoveryHint: 'Use list_sessions to see historical sessions, or get_task_status to check for an active session.'
  };
}

async function handleGetLogsMessageRoute({ payload }) {
  if (typeof automationLogger === 'undefined') {
    return createMcpRouteError('get_logs', 'observability', MCP_ROUTE_RECOVERY_HINT, { error: 'Automation logger unavailable' });
  }

  const requestedLimit = payload.count || payload.limit || 50;
  const logs = payload.sessionId && typeof automationLogger.getSessionLogs === 'function'
    ? automationLogger.getSessionLogs(payload.sessionId)
    : typeof automationLogger.getRecentLogs === 'function'
      ? automationLogger.getRecentLogs(boundedPositiveInt(requestedLimit, 50, 200))
      : [];
  const sanitizedLogs = filterAndCapLogs(logs, requestedLimit);
  return {
    success: true,
    logs: sanitizedLogs,
    count: sanitizedLogs.length
  };
}

async function handleSearchMemoryMessageRoute({ payload }) {
  if (typeof memoryManager === 'undefined' || typeof memoryManager?.search !== 'function') {
    return createMcpRouteError('search_memory', 'observability', MCP_ROUTE_RECOVERY_HINT, { error: 'Memory search unavailable' });
  }

  const filters = payload.filters || {
    ...(payload.domain ? { domain: payload.domain } : {}),
    ...(payload.type ? { type: payload.type } : {})
  };
  const options = {
    ...(payload.options || {}),
    topN: boundedPositiveInt(payload.options?.topN || payload.topN || payload.limit, 5, 25)
  };
  const results = await memoryManager.search(payload.query || '', filters, options);
  return {
    success: true,
    results: (Array.isArray(results) ? results : []).slice(0, options.topN).map(sanitizeMemoryEntry)
  };
}

async function handleGetMemoryMessageRoute({ payload }) {
  if (typeof memoryManager === 'undefined' || typeof memoryManager?.getAll !== 'function') {
    return createMcpRouteError('get_memory_stats', 'observability', MCP_ROUTE_RECOVERY_HINT, { error: 'Memory manager unavailable' });
  }

  const memories = await memoryManager.getAll();
  const memoryList = Array.isArray(memories) ? memories : [];
  if (payload.statsOnly === true) {
    const byType = {};
    for (const memory of memoryList) {
      const type = memory?.type || 'unknown';
      byType[type] = (byType[type] || 0) + 1;
    }
    return {
      success: true,
      stats: {
        total: memoryList.length,
        byType,
        storageUsageBytes: getMemoryListStorageUsageBytes(memoryList)
      }
    };
  }

  const limit = boundedPositiveInt(payload.limit, 25, 100);
  return {
    success: true,
    memories: memoryList.slice(0, limit).map(sanitizeMemoryEntry),
    total: memoryList.length
  };
}

async function handleReportProgressRoute({ params }) {
  const message = boundedString(params?.message, 500);
  if (!message) {
    return createMcpInvalidParamsError('report_progress', 'report_progress requires message', { routeFamily: 'task-status' });
  }

  const sessionToken = boundedString(params?.session_token || params?.sessionToken, 200);
  if (sessionToken) {
    return callCallbackHandler(
      'handleMcpVisualSessionTaskStatus',
      {
        action: 'mcpVisualSessionTaskStatus',
        tool: 'report_progress',
        sessionToken,
        message
      },
      {},
      'visual-session'
    );
  }

  if (typeof automationLogger !== 'undefined' && automationLogger?.info) {
    automationLogger.info('MCP progress report', { message });
  }

  return { success: true, tool: 'report_progress', hadEffect: false, message };
}

async function handleCompleteTaskRoute({ params }) {
  const summary = boundedString(params?.summary, 2000);
  if (!summary) {
    return createMcpInvalidParamsError('complete_task', 'complete_task requires summary', { routeFamily: 'task-status' });
  }

  const sessionToken = boundedString(params?.session_token || params?.sessionToken, 200);
  if (sessionToken) {
    return callCallbackHandler(
      'handleMcpVisualSessionTaskStatus',
      {
        action: 'mcpVisualSessionTaskStatus',
        tool: 'complete_task',
        sessionToken,
        summary
      },
      {},
      'visual-session'
    );
  }

  return { success: true, tool: 'complete_task', status: 'completed', hadEffect: false, summary };
}

async function handlePartialTaskRoute({ params }) {
  const summary = boundedString(params?.summary, 2000);
  const blocker = boundedString(params?.blocker, 1000);
  if (!summary || !blocker) {
    return createMcpInvalidParamsError('partial_task', 'partial_task requires summary and blocker', { routeFamily: 'task-status' });
  }

  const nextStep = boundedString(params?.next_step, 1000);
  const reason = boundedString(params?.reason, 100);
  const sessionToken = boundedString(params?.session_token || params?.sessionToken, 200);
  if (sessionToken) {
    return callCallbackHandler(
      'handleMcpVisualSessionTaskStatus',
      {
        action: 'mcpVisualSessionTaskStatus',
        tool: 'partial_task',
        sessionToken,
        summary,
        blocker,
        ...(nextStep ? { nextStep } : {}),
        ...(reason ? { reason } : {})
      },
      {},
      'visual-session'
    );
  }

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
    return createMcpInvalidParamsError('fail_task', 'fail_task requires reason', { routeFamily: 'task-status' });
  }

  const sessionToken = boundedString(params?.session_token || params?.sessionToken, 200);
  if (sessionToken) {
    return callCallbackHandler(
      'handleMcpVisualSessionTaskStatus',
      {
        action: 'mcpVisualSessionTaskStatus',
        tool: 'fail_task',
        sessionToken,
        reason
      },
      {},
      'visual-session'
    );
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
  MCP_PHASE199_EXCLUDED_BACKGROUND_TOOLS,
  // Phase 238: agent identity route handlers exported for unit-test access.
  handleAgentRegisterRoute,
  handleAgentReleaseRoute,
  handleAgentStatusRoute
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
