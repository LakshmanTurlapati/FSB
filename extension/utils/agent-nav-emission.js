(function(global) {
  'use strict';

  /**
   * Phase 243 plan 02 -- BG-04 user-initiated navigation pause emission
   * helper.
   *
   * Pure module. No chrome.* dependency, no globalThis side-effect at load
   * time. The webNavigation.onCommitted listener in background.js calls
   * _maybeEmitUserNavigation(details, registry, now) on every main-frame
   * commit; this helper applies the BG-04 filter set and, when all
   * preconditions hold, calls registry-side display formatting + the
   * provided rateLimitedWarn (or globalThis.rateLimitedWarn) to push a
   * LOG-04 'agent-tab-user-navigation' event into the diagnostics ring.
   *
   * Decision matrix (all must pass to emit):
   *   1. details.frameId === 0                   (Pitfall 3 -- subframe filter)
   *   2. transitionType in USER_INITIATED_TRANSITIONS
   *      = { typed, auto_bookmark, reload, link } (CONTEXT D-03)
   *   3. registry.findAgentByTabId(tabId) returns a non-null agentId
   *   4. agentId does NOT start with 'legacy:'   (legacy:* owners are the
   *      synthesized popup/sidepanel/autopilot surfaces -- they do NOT
   *      pause on user nav by design; only true MCP agents do)
   *   5. now - lastAgentNavigationAt > 500       (Pitfall 2 / Phase 242
   *      back transitionType auto_bookmark false-positive guard; the
   *      stamp lives on _tabMetadata, populated by stampAgentNavigation)
   *
   * Tests live in tests/agent-tab-user-navigation.test.js.
   *
   * Exports both globalThis (for background.js importScripts) AND
   * module.exports (for Node test harness) per the codebase convention.
   */

  // CONTEXT D-03 transitionType set. Excluded values per plan + Pitfall 3
  // (form_submit / auto_subframe / manual_subframe / generated / start_page
  //  / keyword / keyword_generated).
  var USER_INITIATED_TRANSITIONS = new Set(['typed', 'auto_bookmark', 'reload', 'link']);

  // 500ms suppression window past the most recent agent-initiated nav
  // stamp. Phase 242 `back` produces transitionType auto_bookmark which
  // falls inside USER_INITIATED_TRANSITIONS; the stamp lets us distinguish
  // the agent-driven case from a true user click without depending on the
  // unreliable Chrome transitionQualifier set.
  var AGENT_NAV_SUPPRESSION_MS = 500;

  /**
   * Pure helper. Returns true iff a LOG-04 emission was actually made.
   *
   * @param {object} details            chrome.webNavigation.onCommitted details
   *                                    (frameId, transitionType, tabId, url)
   * @param {object} registry           agent-registry instance (must expose
   *                                    findAgentByTabId, getTabMetadata,
   *                                    formatAgentIdForDisplay)
   * @param {number} now                Date.now() at listener entry
   * @param {object} [opts]             optional overrides
   * @param {function} [opts.rateLimitedWarn]
   *                                    test-injected emitter; defaults to
   *                                    globalThis.rateLimitedWarn
   * @returns {boolean}                 true if emitted, false if suppressed
   */
  function _maybeEmitUserNavigation(details, registry, now, opts) {
    if (!details || details.frameId !== 0) return false;
    if (!USER_INITIATED_TRANSITIONS.has(details.transitionType)) return false;
    if (!registry || typeof registry.findAgentByTabId !== 'function') return false;

    var ownerAgentId = registry.findAgentByTabId(details.tabId);
    if (!ownerAgentId) return false;
    if (typeof ownerAgentId === 'string' && ownerAgentId.indexOf('legacy:') === 0) return false;

    // Pitfall 2: 500ms suppression. (now - lastAgentNav) must be STRICTLY
    // greater than 500 to emit; equal-or-less suppresses. The boundary
    // choice matches the test contract (Test 4(e) boundary case).
    var meta = (typeof registry.getTabMetadata === 'function')
      ? registry.getTabMetadata(details.tabId)
      : null;
    var lastAgentNav = (meta && typeof meta.lastAgentNavigationAt === 'number')
      ? meta.lastAgentNavigationAt
      : 0;
    var elapsed = (typeof now === 'number' ? now : Date.now()) - lastAgentNav;
    if (elapsed <= AGENT_NAV_SUPPRESSION_MS) return false;

    // Resolve emitter. Test harness threads its capture via opts; in the
    // service worker the global rateLimitedWarn is the live LOG-04 sink.
    var warn = (opts && typeof opts.rateLimitedWarn === 'function')
      ? opts.rateLimitedWarn
      : (typeof global.rateLimitedWarn === 'function' ? global.rateLimitedWarn : null);
    if (!warn) return false;

    // Resolve display helper. Prefer the registry's instance method so the
    // service worker uses the canonical 6-hex-prefix SSOT; tests stub the
    // same shape on their fake registry.
    var agentIdShort = (typeof registry.formatAgentIdForDisplay === 'function')
      ? registry.formatAgentIdForDisplay(ownerAgentId)
      : ownerAgentId;

    try {
      warn(
        'AGT',
        'agent-tab-user-navigation',
        'user-initiated navigation on agent-owned tab',
        {
          agentIdShort: agentIdShort,
          tabId: details.tabId,
          transitionType: details.transitionType,
          url: details.url
        }
      );
    } catch (_e) {
      // Diagnostic emission is best-effort; never poison the listener.
      return false;
    }
    return true;
  }

  var exportsObj = {
    _maybeEmitUserNavigation: _maybeEmitUserNavigation,
    USER_INITIATED_TRANSITIONS: USER_INITIATED_TRANSITIONS,
    AGENT_NAV_SUPPRESSION_MS: AGENT_NAV_SUPPRESSION_MS
  };

  // Service-worker / browser surface. Mirrors agent-registry.js export shape.
  global.FsbAgentNavEmission = exportsObj;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exportsObj;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
