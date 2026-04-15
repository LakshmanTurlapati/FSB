/**
 * Permission context for tool execution gating.
 *
 * Stub implementation per D-02: isAllowed() always returns true.
 * Future: deny-list rules stored in chrome.storage.local (D-03)
 * using origin-aware Chrome match patterns (not path-based prefixes).
 *
 * Mirrors Claude Code's ToolPermissionContext (permissions.py) adapted
 * for Chrome MV3 service worker environment.
 *
 * @module permission-context
 */

'use strict';

// ---------------------------------------------------------------------------
// PermissionContext constructor
// ---------------------------------------------------------------------------

/**
 * Permission context for tool execution gating.
 *
 * Stub implementation per D-02: isAllowed() always returns true.
 * Future: deny-list rules stored in chrome.storage.local (D-03)
 * using origin-aware Chrome match patterns (not path-based prefixes).
 *
 * Mirrors Claude Code's ToolPermissionContext adapted for Chrome MV3.
 *
 * @param {Object} [options={}]
 * @param {string[]} [options.denyNames=[]] - Tool names to block (case-insensitive)
 * @param {string[]} [options.denyOrigins=[]] - Chrome match patterns for origin-based blocking
 * @constructor
 */
function PermissionContext(options) {
  var opts = options || {};
  /** @type {Set<string>} */
  this.denyNames = new Set((opts.denyNames || []).map(function(n) { return n.toLowerCase(); }));
  /** @type {string[]} */
  this.denyOrigins = opts.denyOrigins || [];
}

// ---------------------------------------------------------------------------
// Prototype methods
// ---------------------------------------------------------------------------

/**
 * Check if a tool is allowed for a given origin.
 *
 * Stub: always returns true. Future implementation will check
 * denyNames and origin match patterns.
 *
 * @param {string} toolName - Tool name to check
 * @param {string} [origin=''] - Page origin (e.g., 'https://example.com')
 * @returns {boolean} true if the tool is allowed
 */
PermissionContext.prototype.isAllowed = function(toolName, origin) {
  // Stub: always allow. Phase 158 hook pipeline will call this
  // before each tool execution.
  // Future: check this.denyNames.has(toolName.toLowerCase())
  // Future: check origin against this.denyOrigins match patterns
  return true;
};

/**
 * Return a structured denial result for a blocked tool.
 * Used by the permission hook (Phase 158) to create error responses
 * the AI receives as a tool_result error.
 *
 * @param {string} toolName - The blocked tool name
 * @param {string} [reason=''] - Why the tool was denied
 * @returns {{ denied: boolean, toolName: string, reason: string }}
 */
PermissionContext.prototype.createDenial = function(toolName, reason) {
  return {
    denied: true,
    toolName: toolName,
    reason: reason || 'Tool "' + toolName + '" is not permitted for this origin'
  };
};

/**
 * Serialize permission state for persistence.
 * @returns {{ denyNames: string[], denyOrigins: string[] }}
 */
PermissionContext.prototype.toJSON = function() {
  return {
    denyNames: Array.from(this.denyNames),
    denyOrigins: this.denyOrigins.slice()
  };
};

// ---------------------------------------------------------------------------
// Factory function
// ---------------------------------------------------------------------------

/**
 * Create a PermissionContext from chrome.storage.local rules.
 * Stub: returns empty (allow-all) context.
 *
 * @returns {Promise<PermissionContext>}
 */
async function loadPermissionContext() {
  // Future: read deny-list from chrome.storage.local
  // var stored = await chrome.storage.local.get({ permissionRules: { denyNames: [], denyOrigins: [] } });
  // return new PermissionContext(stored.permissionRules);
  return new PermissionContext();
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PermissionContext: PermissionContext, loadPermissionContext: loadPermissionContext };
}
