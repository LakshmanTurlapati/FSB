/**
 * Phase 243 plan 03 (UI-01) -- pure helper for the overlay client/agent badge.
 *
 * The visual-feedback.js renderer used to read `overlayState.clientLabel` and
 * write it directly into `.fsb-client-badge`. Phase 243 D-04 extends the badge
 * to display `<clientLabel> / <agentIdShort>` so multiple concurrent agents
 * (Phase 240/241 multi-agent registry) are distinguishable on the page.
 *
 * Extracting the combine logic into a pure helper keeps the renderer slim and
 * makes the rule unit-testable without a DOM:
 *
 *   - Both present  -> "<clientLabel> / <agentIdShort>"
 *   - clientLabel only -> "<clientLabel>"
 *   - agentIdShort only -> "<agentIdShort>"
 *   - Neither -> ""
 *   - Inputs are trimmed; null / undefined coerce to ""
 *
 * IMPORTANT: agentIdShort MUST be produced upstream by the canonical
 * formatAgentIdForDisplay helper from extension/utils/agent-registry.js. This
 * file does NOT slice agent IDs locally -- per Phase 243 RESEARCH anti-pattern,
 * local slicing is forbidden.
 *
 * Classic-script load shape mirrors extension/utils/overlay-state.js: registers
 * on globalThis for content-script consumption AND exports for Node tests.
 */
(function(global) {
  'use strict';

  function _norm(value) {
    if (value === undefined || value === null) return '';
    return String(value).trim();
  }

  function combineBadgeText(clientLabel, agentIdShort) {
    var c = _norm(clientLabel);
    var a = _norm(agentIdShort);
    if (c && a) return c + ' / ' + a;
    if (c) return c;
    if (a) return a;
    return '';
  }

  var exportsObj = {
    combineBadgeText: combineBadgeText
  };

  global.FSBBadgeCombine = exportsObj;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exportsObj;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
