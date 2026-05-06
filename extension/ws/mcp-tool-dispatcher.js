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
  // Phase 242: single-step ownership-gated history back. handleBackRoute
  // performs history.length precheck, chrome.tabs.goBack, settle race,
  // 5-status classification, and bindTab parity (D-08). Background-tab
  // compatible: NEVER calls chrome.tabs.update inside the handler body.
  'mcp:go-back':    { routeFamily: 'browser', handler: handleBackRoute },
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

// ---- Phase 240 ownership gate ------------------------------------------
// D-06: single chokepoint at dispatchMcpToolRoute. D-07: synchronous; no
// await between gate check and route.handler invocation. The cached
// metadata on the registry record (Phase 240 plan 01) eliminates the need
// for any chrome.tabs.get round-trip at dispatch time. Plain-object error
// pattern matches Phase 238 createMcpRouteError shape.

function _resolveTabIdForGate(tool, params, payload) {
  const tabIdParam = params && Number.isFinite(params.tabId) ? params.tabId : null;
  const tabIdPayload = payload && Number.isFinite(payload.tabId) ? payload.tabId : null;
  if (tabIdParam !== null) return tabIdParam;
  if (tabIdPayload !== null) return tabIdPayload;
  // Tools that create a tab or do not target one: gate skips the tabId arm.
  // (open_tab creates; list_tabs enumerates; navigate without explicit tabId
  // resolves via getActiveTabFromClient inside the handler -- gate cannot
  // resolve sync, so the handler's own bindTab call (D-08) is the backstop.)
  return null;
}

// Sync reads the gate consumes via the `reg` alias (= globalThis.fsbAgentRegistryInstance):
//   reg.hasAgent, reg.isOwnedBy, reg.getOwner,
//   globalThis.fsbAgentRegistryInstance.getTabMetadata,
//   reg.getAgentWindowId
// All Map.get-shaped lookups; D-07 same-microtask discipline preserved.
function checkOwnershipGate({ tool, params, payload }) {
  const reg = (typeof globalThis !== 'undefined') ? globalThis.fsbAgentRegistryInstance : null;
  if (!reg) return null; // pre-Phase-237 boot or test harness without registry; graceful pass

  const src = (payload && Object.keys(payload).length) ? payload : (params || {});
  const agentId = src.agentId || null;
  const ownershipToken = src.ownershipToken || null;

  if (!agentId || (typeof reg.hasAgent === 'function' && !reg.hasAgent(agentId))) {
    return { success: false, code: 'AGENT_NOT_REGISTERED', requestingAgentId: agentId };
  }

  const tabId = _resolveTabIdForGate(tool, params, payload);
  if (tabId === null) return null; // tab-creating tool or active-tab-resolved-later; agent-only check passed

  // 1. Token-aware ownership (D-04).
  if (typeof reg.isOwnedBy === 'function' && !reg.isOwnedBy(tabId, agentId, ownershipToken)) {
    const ownerAgentId = (typeof reg.getOwner === 'function') ? (reg.getOwner(tabId) || null) : null;
    return { success: false, code: 'TAB_NOT_OWNED', ownerAgentId, requestedTabId: tabId, requestingAgentId: agentId };
  }

  // 2. Incognito reject (D-10 / OWN-05).
  const meta = (typeof reg.getTabMetadata === 'function') ? reg.getTabMetadata(tabId) : null;
  if (meta && meta.incognito === true) {
    return { success: false, code: 'TAB_INCOGNITO_NOT_SUPPORTED', tabId };
  }

  // 3. Cross-window reject (Open Q2: per-agent windowId pinning). Set-once on
  // first bindTab; null pin means "not yet pinned" -- skip this arm.
  if (meta && Number.isFinite(meta.windowId) && typeof reg.getAgentWindowId === 'function') {
    const pinnedWindowId = reg.getAgentWindowId(agentId);
    if (Number.isFinite(pinnedWindowId) && pinnedWindowId !== meta.windowId) {
      return { success: false, code: 'TAB_OUT_OF_SCOPE', tabId, reason: 'cross_window' };
    }
  }

  return null; // pass
}

async function dispatchMcpToolRoute({ tool, params = {}, client = null, tab = null, payload = {} }) {
  const route = MCP_PHASE199_TOOL_ROUTES[tool];
  if (!route) {
    return createMcpRouteError(tool, 'tool', MCP_ROUTE_RECOVERY_HINT);
  }

  if (typeof route.handler !== 'function') {
    return createMcpRouteError(tool, route.routeFamily, MCP_ROUTE_RECOVERY_HINT);
  }

  // Phase 240 D-06 / D-07: inline ownership gate. Sync; no await between gate
  // check and route.handler invocation. Same microtask discipline.
  const gateResult = checkOwnershipGate({ tool, params, payload });
  if (gateResult) return gateResult;

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
  const { agentId } = params || {};
  // Phase 240: agentId now load-bearing for the bindTab D-08 site below.
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

    // Phase 240 D-08: bindTab on the navigated tab BEFORE returning success
    // so the originating agent owns the tab; the freshly minted ownershipToken
    // threads back through sanitizeSingleTab so AgentScope can capture it.
    let bindResult = null;
    if (agentId
        && typeof globalThis !== 'undefined'
        && globalThis.fsbAgentRegistryInstance
        && typeof globalThis.fsbAgentRegistryInstance.bindTab === 'function'
        && Number.isFinite(targetTabId)) {
      try {
        bindResult = await globalThis.fsbAgentRegistryInstance.bindTab(agentId, targetTabId);
      } catch (_e) {
        // Tab may have closed mid-flight; success return continues with null bindResult.
        bindResult = null;
      }
    }
    const extra = (bindResult && bindResult.ownershipToken)
      ? { ownershipToken: bindResult.ownershipToken }
      : {};
    return sanitizeSingleTab('navigate', { ...activeTab, ...updatedTab, id: targetTabId, url: updatedTab?.url || params.url }, extra);
  } catch (error) {
    return createMcpRouteError('navigate', 'browser', MCP_ROUTE_RECOVERY_HINT, { error: error.message || String(error) });
  }
}

async function handleNavigationHistoryRoute({ tool, params, client }) {
  const { agentId } = params || {};
  // Phase 240: agentId now load-bearing for the bindTab D-08 site below.
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

    // Phase 240 D-08: bindTab on the navigated tab BEFORE returning success.
    let bindResult = null;
    if (agentId
        && typeof globalThis !== 'undefined'
        && globalThis.fsbAgentRegistryInstance
        && typeof globalThis.fsbAgentRegistryInstance.bindTab === 'function'
        && Number.isFinite(targetTabId)) {
      try {
        bindResult = await globalThis.fsbAgentRegistryInstance.bindTab(agentId, targetTabId);
      } catch (_e) {
        bindResult = null;
      }
    }
    const response = { success: true, tool, tabId: targetTabId };
    if (bindResult && bindResult.ownershipToken) {
      response.ownershipToken = bindResult.ownershipToken;
    }
    return response;
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

// ---- Phase 242 'back' MCP tool helpers ---------------------------------
// Single-step ownership-gated history-back. Order in declaration:
//   waitForBackSettle  -- helper used by handleBackRoute settle race.
//   classifyBackOutcome -- helper used by handleBackRoute status mapping.
//   handleBackRoute     -- the route entry exposed via MCP_PHASE199_MESSAGE_ROUTES.
// Hard invariants (BACK-02..BACK-05, D-08):
//   * No chrome.tabs.update reference anywhere in this section
//     (background-tab compatibility).
//   * The 5-code status discriminator is canonical:
//       'ok' | 'no_history' | 'cross_origin' | 'bf_cache' | 'fragment_only'.
//   * Phase 240 ownership gate is invoked at the TOP of handleBackRoute
//     because dispatchMcpMessageRoute does NOT inline-gate message routes
//     today (only dispatchMcpToolRoute does, line 194).

/**
 * Race three legs to detect when chrome.tabs.goBack has settled:
 *   1. chrome.tabs.onUpdated 'complete' for the target tab.
 *   2. window 'pageshow' event observed inside the post-back document via
 *      chrome.scripting.executeScript injection. Captures event.persisted
 *      so the caller can distinguish BF-cache restoration.
 *   3. Hard 2s timeout (caller passes timeoutMs).
 * Self-cleans the onUpdated listener and the timeout regardless of which
 * leg wins. Resolves at most once via the `finished` guard.
 *
 * @param {number} tabId  Target tab id (must be finite).
 * @param {number} timeoutMs  Outer hard cap (ms). RESEARCH lines 333-371.
 * @returns {Promise<{method:'pageshow'|'onUpdated'|'timeout', persisted: boolean|null}>}
 */
function waitForBackSettle(tabId, timeoutMs) {
  return new Promise((resolve) => {
    let finished = false;
    const finish = (result) => {
      if (finished) return;
      finished = true;
      try { cleanup(); } catch (_e) { /* swallow */ }
      resolve(result);
    };

    let onUpdatedListener = null;
    let timeoutHandle = null;

    const cleanup = () => {
      if (onUpdatedListener && typeof chrome !== 'undefined'
          && chrome.tabs && chrome.tabs.onUpdated
          && typeof chrome.tabs.onUpdated.removeListener === 'function') {
        try { chrome.tabs.onUpdated.removeListener(onUpdatedListener); } catch (_e) {}
      }
      onUpdatedListener = null;
      if (timeoutHandle !== null) {
        try { clearTimeout(timeoutHandle); } catch (_e) {}
        timeoutHandle = null;
      }
    };

    // Leg 1: chrome.tabs.onUpdated 'complete'.
    if (typeof chrome !== 'undefined'
        && chrome.tabs && chrome.tabs.onUpdated
        && typeof chrome.tabs.onUpdated.addListener === 'function') {
      onUpdatedListener = (updatedTabId, changeInfo) => {
        if (updatedTabId === tabId && changeInfo && changeInfo.status === 'complete') {
          finish({ method: 'onUpdated', persisted: null });
        }
      };
      try { chrome.tabs.onUpdated.addListener(onUpdatedListener); } catch (_e) { onUpdatedListener = null; }
    }

    // Leg 2: pageshow via injected one-shot listener.
    if (typeof chrome !== 'undefined' && chrome.scripting
        && typeof chrome.scripting.executeScript === 'function') {
      // Inner timeout deliberately above the outer budget so the outer
      // Promise.race's timeout leg always resolves first when no pageshow.
      const innerTimeoutMs = Math.max(timeoutMs + 500, 2500);
      const inject = async () => {
        try {
          const results = await chrome.scripting.executeScript({
            target: { tabId },
            func: (innerTimeout) => new Promise((res) => {
              const handler = (event) => {
                window.removeEventListener('pageshow', handler);
                res({ method: 'pageshow', persisted: !!event.persisted });
              };
              window.addEventListener('pageshow', handler, { once: true });
              setTimeout(() => {
                try { window.removeEventListener('pageshow', handler); } catch (_e) {}
                res({ method: 'pageshow', persisted: null, timeout: true });
              }, innerTimeout);
            }),
            args: [innerTimeoutMs]
          });
          if (Array.isArray(results) && results.length > 0) {
            const inner = results[0] && results[0].result;
            if (inner && inner.method === 'pageshow' && inner.timeout !== true) {
              finish({ method: 'pageshow', persisted: !!inner.persisted });
            }
          }
        } catch (_e) {
          // Intentional swallow per RESEARCH line 350-356: chrome:// pages
          // and other restricted contexts cannot host injection. Let the
          // other legs decide the outcome.
        }
      };
      inject();
    }

    // Leg 3: hard timeout.
    timeoutHandle = setTimeout(() => {
      finish({ method: 'timeout', persisted: null });
    }, Math.max(0, timeoutMs));
  });
}

/**
 * Map pre/post URL components + settle outcome to the canonical 5-status
 * discriminator. Mirrors RESEARCH lines 376-396 with the Pitfall-1 SPA
 * carve-out (timeout + URL changed + same origin -> 'ok', not 'bf_cache').
 *
 * Resolution order (first match wins):
 *   1. preUrl === postUrl                        -> 'ok' (defensive; SPA replaceState).
 *   2. same origin + same pathname + same search + different hash -> 'fragment_only'.
 *   3. preOrigin && postOrigin && preOrigin !== postOrigin -> 'cross_origin'.
 *   4. settled.method === 'pageshow' && settled.persisted === true -> 'bf_cache'.
 *   5. settled.method === 'timeout' && postUrl === preUrl -> 'bf_cache'.
 *   6. default                                            -> 'ok'.
 *
 * Note: case (1) returns 'ok' rather than a no-op marker because callers
 * upstream (Phase 240 gate + handleBackRoute) treat 'ok' as the success
 * baseline; SPA replaceState scenarios where the URL is identical are
 * indistinguishable from idempotent back without observable state change,
 * so 'ok' is the truthful classification.
 *
 * WR-02 best-effort caveat: the 'bf_cache' discriminator is only as
 * accurate as the pageshow leg of waitForBackSettle. That leg injects
 * its listener via chrome.scripting.executeScript AFTER chrome.tabs.goBack
 * has already fired (handleBackRoute step 5 -> step 6), so a same-origin
 * BF-cache restoration whose pageshow event fires before the listener
 * lands will fall through to the 'ok' default branch instead of being
 * classified as 'bf_cache'. Callers relying on 'bf_cache' for snapshot
 * invalidation should treat 'ok' as best-effort and may occasionally
 * shadow a missed BF-cache event.
 *
 * Note: 'no_history' is decided upstream by handleBackRoute's
 * history.length precheck (step 4); this helper only classifies the
 * post-goBack settle outcome.
 *
 * @param {object} args
 * @param {string} args.preUrl    URL from chrome.tabs.get BEFORE goBack.
 * @param {string} args.postUrl   URL from chrome.tabs.get AFTER settle.
 * @param {string} args.preOrigin URL.origin parsed from preUrl, or '' on parse failure.
 * @param {string} args.postOrigin URL.origin parsed from postUrl, or '' on parse failure.
 * @param {{method:string,persisted:boolean|null}} args.settled  waitForBackSettle output.
 * @returns {'ok'|'cross_origin'|'bf_cache'|'fragment_only'}
 */
function classifyBackOutcome({ preUrl, postUrl, preOrigin, postOrigin, settled }) {
  if (preUrl === postUrl) {
    // Defensive: SPA replaceState back may not change observable URL.
    return 'ok';
  }

  // Fragment-only: same origin + same pathname + same search, different hash.
  let prePath = '', preSearch = '', preHash = '';
  let postPath = '', postSearch = '', postHash = '';
  try { const u = new URL(preUrl); prePath = u.pathname; preSearch = u.search; preHash = u.hash; } catch (_e) {}
  try { const u = new URL(postUrl); postPath = u.pathname; postSearch = u.search; postHash = u.hash; } catch (_e) {}
  if (preOrigin && postOrigin && preOrigin === postOrigin
      && prePath === postPath && preSearch === postSearch && preHash !== postHash) {
    return 'fragment_only';
  }

  if (preOrigin && postOrigin && preOrigin !== postOrigin) {
    return 'cross_origin';
  }

  if (settled && settled.method === 'pageshow' && settled.persisted === true) {
    return 'bf_cache';
  }

  // Pitfall-1: timeout with URL change is the SPA case -- classify as 'ok'.
  // Only timeout WITHOUT URL change is treated as bf_cache.
  if (settled && settled.method === 'timeout' && postUrl === preUrl) {
    return 'bf_cache';
  }

  return 'ok';
}

/**
 * Phase 242 BACK-02..BACK-05: handle the 'mcp:go-back' bridge message.
 *
 * Flow (synchronous up to first await; D-07 gate discipline):
 *   1. Defensive ownership gate (since dispatchMcpMessageRoute does NOT
 *      inline-gate message routes today; the inline gate lives only in
 *      dispatchMcpToolRoute at line 194). Cross-agent calls reject here
 *      with TAB_NOT_OWNED + ownerAgentId before any chrome API touches.
 *   2. Resolve targetTabId (payload.tabId or active tab).
 *   3. Capture pre-back URL via chrome.tabs.get.
 *   4. history.length precheck via chrome.scripting.executeScript. On
 *      depth <= 1 OR injection failure (chrome:// etc.), return
 *      { status: 'no_history', resultingUrl: preUrl, historyDepth }
 *      WITHOUT calling chrome.tabs.goBack.
 *   5. chrome.tabs.goBack -- background-tab safe (no chrome.tabs.update).
 *   6. waitForBackSettle race (pageshow / onUpdated complete / 2s timeout).
 *   7. chrome.tabs.get post-back. If tab closed mid-flight, return
 *      { errorCode: 'tab_closed_during_back' } (Pitfall 5).
 *   8. classifyBackOutcome -> 5-code status.
 *   9. bindTab parity (D-08 mirrors handleNavigationHistoryRoute lines
 *      431-443 exactly) so cross-origin back refreshes the
 *      (agentId, tabId, ownershipToken) triple.
 *
 * @param {object} args
 * @param {string} args.type     'mcp:go-back'.
 * @param {object} args.payload  Bridge envelope payload (agentId, ownershipToken, tabId?).
 * @param {object} [args.client] Optional bridge client (active-tab resolver).
 * @returns {Promise<object>}    Either { success:true, status, resultingUrl, historyDepth, tabId, ownershipToken? }
 *                               or a Phase 240 reject {success:false, code:'TAB_NOT_OWNED', ...}
 *                               or createMcpRouteError-shaped error.
 */
async function handleBackRoute({ payload = {}, client = null }) {
  // 1. Defensive ownership gate (mirror dispatchMcpToolRoute line 194).
  // dispatchMcpMessageRoute does not inline-gate today; this defensive call
  // ensures cross-agent calls reject before any side effect.
  const gateResult = checkOwnershipGate({ tool: 'back', params: {}, payload });
  if (gateResult) return gateResult;

  const agentId = (payload && payload.agentId) || null;

  // 2. Resolve targetTabId.
  let targetTabId = (payload && Number.isFinite(payload.tabId)) ? payload.tabId : null;
  try {
    getChromeTabsApi();
  } catch (error) {
    return createMcpRouteError('back', 'browser', MCP_ROUTE_RECOVERY_HINT, {
      errorCode: 'navigation_unavailable',
      error: error.message || String(error)
    });
  }

  if (targetTabId === null) {
    let activeTab = null;
    try {
      activeTab = await getActiveTabFromClient(client);
    } catch (_e) {
      activeTab = null;
    }
    if (!activeTab || !Number.isFinite(activeTab.id)) {
      return createMcpRouteError('back', 'browser', 'Use list_tabs or open_tab to find a navigable tab before retrying.', {
        errorCode: 'no_active_tab',
        error: 'No active tab available for back navigation'
      });
    }
    targetTabId = activeTab.id;

    // WR-01: The gate above (step 1) ran with payload.tabId omitted, which
    // causes _resolveTabIdForGate to skip the tab-ownership arm entirely.
    // Now that we have a concrete tabId, re-run the gate so a registered-
    // but-non-owning agent cannot drive history-back on a tab it does not
    // own. The gate is sync and cheap; thread the resolved tabId through a
    // fresh payload object to preserve the existing contract.
    const recheck = checkOwnershipGate({
      tool: 'back',
      params: {},
      payload: { ...payload, tabId: targetTabId }
    });
    if (recheck) return recheck;
  }

  // 3. Capture pre-back state.
  let preTab = null;
  try {
    preTab = await chrome.tabs.get(targetTabId);
  } catch (error) {
    return createMcpRouteError('back', 'browser', MCP_ROUTE_RECOVERY_HINT, {
      errorCode: 'tab_unavailable',
      tabId: targetTabId,
      error: error.message || String(error)
    });
  }
  const preUrl = (preTab && typeof preTab.url === 'string') ? preTab.url : '';
  let preOrigin = '';
  try { preOrigin = new URL(preUrl).origin; } catch (_e) { preOrigin = ''; }

  // 4. history.length precheck (BACK-02). Failure modes (chrome://, no
  // permission, tab in restricted context) all collapse to 'no_history'
  // fail-closed: never call goBack on an unverifiable history length.
  let historyDepth = 0;
  let prechecked = false;
  try {
    if (chrome && chrome.scripting && typeof chrome.scripting.executeScript === 'function') {
      const results = await chrome.scripting.executeScript({
        target: { tabId: targetTabId },
        func: () => window.history.length
      });
      if (Array.isArray(results) && results.length > 0) {
        const raw = results[0] && results[0].result;
        if (Number.isFinite(raw)) {
          historyDepth = raw;
          prechecked = true;
        }
      }
    }
  } catch (_e) {
    // Restricted contexts (chrome://, devtools, etc.) -- fall through to
    // the no_history fail-closed branch below.
    prechecked = false;
  }
  if (!prechecked || historyDepth <= 1) {
    return {
      success: true,
      status: 'no_history',
      resultingUrl: preUrl,
      historyDepth: prechecked ? historyDepth : 1,
      tabId: targetTabId,
      tool: 'back'
    };
  }

  // 5. Fire goBack. NEVER call the focus-stealing tabs update API here
  //    (D-08 background-tab posture; verification gate excludes the literal
  //    method call from this handler body).
  try {
    await chrome.tabs.goBack(targetTabId);
  } catch (error) {
    return {
      success: false,
      errorCode: 'navigation_unavailable',
      tool: 'back',
      tabId: targetTabId,
      error: error.message || String(error)
    };
  }

  // 6. Settle race (BACK-04).
  const settled = await waitForBackSettle(targetTabId, 2000);

  // 7. Read post-back state.
  let postTab = null;
  try {
    postTab = await chrome.tabs.get(targetTabId);
  } catch (error) {
    return {
      success: false,
      errorCode: 'tab_closed_during_back',
      tool: 'back',
      tabId: targetTabId,
      error: error.message || String(error)
    };
  }
  const postUrl = (postTab && typeof postTab.url === 'string') ? postTab.url : '';
  let postOrigin = '';
  try { postOrigin = new URL(postUrl).origin; } catch (_e) { postOrigin = ''; }

  // 8. Classify (BACK-03).
  const status = classifyBackOutcome({ preUrl, postUrl, preOrigin, postOrigin, settled });

  // 9. bindTab parity (D-08): mirror handleNavigationHistoryRoute exactly so
  // cross-origin back refreshes the (agentId, tabId, ownershipToken) triple.
  let bindResult = null;
  if (agentId
      && typeof globalThis !== 'undefined'
      && globalThis.fsbAgentRegistryInstance
      && typeof globalThis.fsbAgentRegistryInstance.bindTab === 'function'
      && Number.isFinite(targetTabId)) {
    try {
      bindResult = await globalThis.fsbAgentRegistryInstance.bindTab(agentId, targetTabId);
    } catch (_e) {
      bindResult = null;
    }
  }

  const response = {
    success: true,
    status,
    resultingUrl: postUrl,
    historyDepth,
    tabId: targetTabId,
    tool: 'back'
  };
  if (bindResult && bindResult.ownershipToken) {
    response.ownershipToken = bindResult.ownershipToken;
  }
  return response;
}

async function handleOpenTabRoute({ params }) {
  const { agentId } = params || {};
  // Phase 240: agentId now load-bearing for the bindTab D-08 site below.
  try {
    getChromeTabsApi();
    const tab = await chrome.tabs.create({ url: params.url || 'about:blank', active: params.active !== false });

    // Phase 240 D-08: bindTab on the freshly created tab BEFORE returning
    // success. open_tab claims a tab no other agent has touched, so the
    // bind is unconditional once the create succeeds.
    let bindResult = null;
    if (agentId
        && typeof globalThis !== 'undefined'
        && globalThis.fsbAgentRegistryInstance
        && typeof globalThis.fsbAgentRegistryInstance.bindTab === 'function'
        && tab && Number.isFinite(tab.id)) {
      try {
        bindResult = await globalThis.fsbAgentRegistryInstance.bindTab(agentId, tab.id);
      } catch (_e) {
        bindResult = null;
      }
    }
    const extra = (bindResult && bindResult.ownershipToken)
      ? { ownershipToken: bindResult.ownershipToken }
      : {};
    return sanitizeSingleTab('open_tab', tab, extra);
  } catch (error) {
    return createMcpRouteError('open_tab', 'browser', MCP_ROUTE_RECOVERY_HINT, { error: error.message || String(error) });
  }
}

async function handleSwitchTabRoute({ params }) {
  const { agentId } = params || {};
  // Phase 240 will validate agent_id; Phase 238 deliberately ignores it.
  void agentId;
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
  const { agentId } = params || {};
  // Phase 240 will validate agent_id; Phase 238 deliberately ignores it.
  void agentId;
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

async function handleExecuteJsRoute({ payload } = {}) {
  const { agentId } = payload || {};
  // Phase 240 will validate agent_id; Phase 238 deliberately ignores it.
  void agentId;
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
  const { agentId } = payload || {};
  // Phase 240 D-09: agentId is threaded into handleStartMcpVisualSession so
  // the same-agent resume / cross-agent reject branch in
  // McpVisualSessionManager.startSession can fire on production dispatch.
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
      detail: boundedString(payload?.detail, 1000),
      agentId: typeof agentId === 'string' && agentId ? agentId : null
    },
    { tab: { id: tab.id } }
  );
}

async function handleEndVisualSessionRoute({ payload }) {
  const { agentId } = payload || {};
  // Phase 240 will validate agent_id; Phase 238 deliberately ignores it.
  void agentId;
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

async function handleAgentRegisterRoute({ payload } = {}) {
  const reg = globalThis.fsbAgentRegistryInstance;
  if (!reg || typeof reg.registerAgent !== 'function') {
    return { success: false, errorCode: 'agent_registry_unavailable', error: 'AgentRegistry not initialized' };
  }
  // D-12: ignore caller-supplied agentId; registry mints fresh via crypto.randomUUID().
  const minted = await reg.registerAgent();
  // Phase 241 D-03: cap-rejection branch -- the registry returns a typed
  // AGENT_CAP_REACHED envelope when the active count is at the cap. Surface
  // it upstream as { success:false, code, cap, active } so the MCP server's
  // AgentScope can throw a typed error instead of treating the response as a
  // successful mint.
  if (minted && minted.code === 'AGENT_CAP_REACHED') {
    return {
      success: false,
      code: 'AGENT_CAP_REACHED',
      cap: minted.cap,
      active: minted.active
    };
  }
  const agentId = minted && minted.agentId;
  const agentIdShort = (minted && minted.agentIdShort)
    || ((globalThis.FsbAgentRegistry && typeof globalThis.FsbAgentRegistry.formatAgentIdForDisplay === 'function')
      ? globalThis.FsbAgentRegistry.formatAgentIdForDisplay(agentId || '')
      : (typeof agentId === 'string' ? agentId.slice(0, 12) : ''));
  // Phase 241 D-08: capture per-bridge connection_id from the caller's payload
  // and stamp it on the agent record so a later bridge onclose can stage all
  // matching agents for grace-window release. The bridge mints the UUID at
  // onopen and threads it through every agent:register; the registry's
  // findAgentByConnectionId path keys off this stamp.
  const connectionId = (payload && typeof payload.connectionId === 'string' && payload.connectionId.length > 0)
    ? payload.connectionId
    : null;
  if (connectionId && typeof reg.stampConnectionId === 'function') {
    try { reg.stampConnectionId(agentId, connectionId); } catch (_e) { /* best-effort */ }
  }
  console.log('[FSB MCP Dispatcher] agent:register minted ' + agentIdShort);
  // Phase 240 Open Q1 resolution: agent:register response carries an empty
  // ownershipTokens map at register time. Subsequent bindTab-firing handlers
  // include `ownershipToken: <new>` in their per-call response; the MCP
  // server's AgentScope (Plan 03 owns server-side AgentScope wiring)
  // accumulates them per-tab.
  // Phase 241 D-08: reflect connectionId on the response so AgentScope can
  // capture it (server-side) -- additive field; older callers ignore it.
  return { success: true, agentId, agentIdShort, ownershipTokens: {}, connectionId: connectionId };
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
  const { agentId } = payload || {};
  // Phase 240 will validate agent_id; Phase 238 deliberately ignores it.
  void agentId;
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
  const { agentId } = payload || {};
  // Phase 240 will validate agent_id; Phase 238 deliberately ignores it.
  void agentId;
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

async function handleGetStatusRoute({ payload } = {}) {
  const { agentId } = payload || {};
  // Phase 240 will validate agent_id; Phase 238 deliberately ignores it.
  void agentId;
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

async function handleReportProgressRoute({ params, payload }) {
  const { agentId } = payload || {};
  // Phase 240 will validate agent_id; Phase 238 deliberately ignores it.
  void agentId;
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

async function handleCompleteTaskRoute({ params, payload }) {
  const { agentId } = payload || {};
  // Phase 240 will validate agent_id; Phase 238 deliberately ignores it.
  void agentId;
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

async function handlePartialTaskRoute({ params, payload }) {
  const { agentId } = payload || {};
  // Phase 240 will validate agent_id; Phase 238 deliberately ignores it.
  void agentId;
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

async function handleFailTaskRoute({ params, payload }) {
  const { agentId } = payload || {};
  // Phase 240 will validate agent_id; Phase 238 deliberately ignores it.
  void agentId;
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
