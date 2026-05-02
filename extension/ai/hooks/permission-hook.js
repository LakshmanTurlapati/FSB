/**
 * Permission hook handler for tool execution gating.
 *
 * Wraps PermissionContext.isAllowed() and createDenial() to provide
 * pre-execution permission checks via the HookPipeline.
 *
 * Registered on LIFECYCLE_EVENTS.BEFORE_TOOL_EXECUTION by Phase 159.
 * When a tool is denied, returns a structured denial object that Phase 159
 * uses to construct a tool_result error for the AI.
 *
 * Fail-open on error (D-05): a buggy permission check must not block
 * automation.
 *
 * @module hooks/permission-hook
 */

'use strict';

// ---------------------------------------------------------------------------
// createPermissionHook factory
// ---------------------------------------------------------------------------

/**
 * Create a permission hook handler for the HookPipeline.
 *
 * Wraps a PermissionContext instance (passed via closure) and checks
 * whether the requested tool is allowed for the given origin.
 *
 * @param {Object} permissionContext - A PermissionContext instance with
 *   isAllowed(toolName, origin) and createDenial(toolName) methods.
 * @returns {Function} Handler suitable for pipeline.register(BEFORE_TOOL_EXECUTION, handler).
 */
function createPermissionHook(permissionContext) {
  /**
   * @param {Object} context - Pipeline event context.
   * @param {string} context.toolName - Name of the tool being executed.
   * @param {string} [context.origin=''] - Page origin for origin-based rules.
   * @returns {{ shouldStop: boolean, denied: boolean, denial?: Object }}
   */
  function permissionHandler(context) {
    try {
      var allowed = permissionContext.isAllowed(context.toolName, context.origin || '');
      if (!allowed) {
        var denial = permissionContext.createDenial(context.toolName);
        return { shouldStop: false, denied: true, denial: denial };
      }
      return { shouldStop: false, denied: false };
    } catch (err) {
      console.warn('[permission-hook] permissionHandler error:', err);
      // Fail-open: buggy permission check must not block automation
      return { shouldStop: false, denied: false };
    }
  }

  return permissionHandler;
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { createPermissionHook: createPermissionHook };
}
