'use strict';

/**
 * Phase 246 plan 01 -- Agent-scoped tab resolver.
 *
 * Single chokepoint for picking a target tab for an MCP-routed tool call.
 * Consumed by:
 *   - extension/ws/mcp-bridge-client.js _handleGetDOM, _handleReadPage,
 *     _handleExecuteAction, _handleFillCredential, _handleUsePaymentMethod
 *   - extension/ws/mcp-tool-dispatcher.js handleGetPageSnapshotRoute,
 *     handleStartVisualSessionRoute (Plan 02)
 *
 * Decisions covered:
 *   D-01 -- registry-driven resolution (1 owned tab use, 0 owned
 *           NO_OWNED_TAB, 2+ owned tabs use selectedTabId when valid,
 *           otherwise AMBIGUOUS_TAB)
 *   D-04 -- legacy:<surface> first-line branch falls through to active tab
 *           via client._getActiveTab(), tagged skipGate:true so the gate's
 *           tab-arm is skipped (legacy synthesis does not track per-tab
 *           ownership tokens against arbitrary user-active tabs)
 *   D-12 -- shared error code surface (NO_OWNED_TAB / AMBIGUOUS_TAB /
 *           NO_ACTIVE_TAB / AGENT_REGISTRY_UNAVAILABLE)
 *
 * Returns either a resolved tab descriptor:
 *   { tabId: number, ownershipToken: string|null, skipGate: boolean }
 * or a plain-object error envelope (Phase 240 shape):
 *   { success: false, code: string, agentId?: string, tabIds?: number[] }
 */

(function (exports) {
  /**
   * Resolve the target tab for an MCP-routed tool call.
   *
   * @param {string} agentId   Agent identifier (or 'legacy:<surface>').
   * @param {object} params    Caller-supplied tool params (may include tab_id
   *                           or tabId; both accepted for snake/camel split).
   * @param {object} client    Bridge client (provides _getActiveTab for the
   *                           legacy fall-through branch).
   * @returns {Promise<{tabId:number, ownershipToken:string|null, skipGate:boolean}
   *           | {success:false, code:string, agentId?:string, tabIds?:number[]}>}
   */
  async function resolveAgentTabOrError(agentId, params, client) {
    // D-04 legacy:* branch -- first line, single rule.
    // skipGate:true signals the call site NOT to push tabId into routeParams
    // (preserves Phase 240's tab-arm-skip path for legacy popup/sidepanel/
    // autopilot surfaces, which do not track per-tab ownership tokens against
    // arbitrary user-active tabs after a tab switch).
    if (typeof agentId === 'string' && agentId.startsWith('legacy:')) {
      const tab = (client && typeof client._getActiveTab === 'function')
        ? await client._getActiveTab()
        : null;
      if (!tab || !Number.isFinite(tab.id)) {
        return { success: false, code: 'NO_ACTIVE_TAB', agentId };
      }
      return { tabId: tab.id, ownershipToken: null, skipGate: true };
    }

    // Explicit tab_id from caller -- gate enforces ownership downstream.
    // Snake-case form is the MCP boundary convention; camelCase form is
    // back-compat with already-camelCase callers (Pitfall 6 in RESEARCH.md).
    if (params && Number.isFinite(params.tab_id)) {
      return { tabId: params.tab_id, ownershipToken: null, skipGate: false };
    }
    if (params && Number.isFinite(params.tabId)) {
      return { tabId: params.tabId, ownershipToken: null, skipGate: false };
    }

    // Registry path -- D-01 three branches.
    const reg = (typeof globalThis !== 'undefined') ? globalThis.fsbAgentRegistryInstance : null;
    if (!reg || typeof reg.getAgentTabs !== 'function') {
      return { success: false, code: 'AGENT_REGISTRY_UNAVAILABLE', agentId };
    }
    const tabIds = reg.getAgentTabs(agentId) || [];
    if (tabIds.length === 0) {
      return { success: false, code: 'NO_OWNED_TAB', agentId };
    }
    if (tabIds.length > 1) {
      const selectedTabId = (typeof reg.getSelectedTabId === 'function')
        ? reg.getSelectedTabId(agentId)
        : null;
      if (Number.isFinite(selectedTabId) && tabIds.indexOf(selectedTabId) !== -1) {
        return { tabId: selectedTabId, ownershipToken: null, skipGate: false };
      }
      return { success: false, code: 'AMBIGUOUS_TAB', agentId, tabIds: tabIds.slice() };
    }
    return { tabId: tabIds[0], ownershipToken: null, skipGate: false };
  }

  exports.resolveAgentTabOrError = resolveAgentTabOrError;

  // Browser SW global registration so call sites can consult the resolver
  // without tracking an importScripts symbol.
  if (typeof globalThis !== 'undefined') {
    globalThis.resolveAgentTabOrError = resolveAgentTabOrError;
  }
})(typeof module !== 'undefined' && module.exports ? module.exports : {});
