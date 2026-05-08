'use strict';

/**
 * Phase 244 plan 01 -- shared fixtures for the multi-agent regression suite.
 *
 * Consumed by tests/multi-agent-regression.test.js. Reuses the Phase 239 harness
 * primitives (createStorageArea, installChromeMock, installVirtualClock) so the
 * regression suite has a single import surface.
 *
 * Two new helpers land here:
 *
 *   simulateSwEviction(registry)
 *     Wipes the registry's in-memory Maps WITHOUT touching the
 *     chrome.storage.session-backed envelope. Models the MV3 service worker
 *     eviction path: the persisted snapshot survives, but the live JS heap
 *     does not. A subsequent registry.hydrate() must rebuild from disk.
 *     Reuses the existing test-only hook AgentRegistry.prototype._resetForTests
 *     (defined in extension/utils/agent-registry.js) -- this helper does NOT
 *     introduce a new diagnostic surface (T-244-02 disposition: accept).
 *
 *   recycleTabId(registry, tabId)
 *     Releases the binding on tabId (idempotent) and returns a thunk that the
 *     caller invokes with (newAgentId) to bindTab the recycled tabId. Used by
 *     the Phase 244 case 6 tab-ID-reuse race test to assert that the per-bindTab
 *     ownership_token differs between successive binds on the same tabId.
 *
 * Plus three pass-through re-exports from run-task-harness.js so the regression
 * suite has one require:
 *   - createStorageArea
 *   - installChromeMock
 *   - installVirtualClock
 */

const harness = require('./run-task-harness.js');

function simulateSwEviction(registry) {
  if (!registry || typeof registry._resetForTests !== 'function') {
    throw new Error('simulateSwEviction requires a registry instance with _resetForTests');
  }
  // Phase 244 D-01: clear in-memory Maps but DO NOT touch chrome.storage.session.
  // The persisted envelope is the recovery mechanism that hydrate() reads back.
  registry._resetForTests();
}

function recycleTabId(registry, tabId) {
  if (!registry || typeof registry.releaseTab !== 'function' ||
      typeof registry.bindTab !== 'function') {
    throw new Error('recycleTabId requires a registry with releaseTab + bindTab');
  }
  // Capture the prior ownershipToken (may be undefined if the tab was never
  // bound, or if metadata was already wiped by a prior reap).
  const priorMeta = (typeof registry.getTabMetadata === 'function')
    ? registry.getTabMetadata(tabId)
    : null;
  const priorToken = priorMeta ? priorMeta.ownershipToken : null;

  // Idempotent release. If the tab was never bound, releaseTab returns false
  // and is a no-op; the recycle thunk still works.
  return Promise.resolve(registry.releaseTab(tabId)).then(function() {
    return {
      priorToken: priorToken,
      // Thunk: bind the recycled tabId to a new agent and return the fresh
      // bind result so the caller can compare tokens.
      rebind: async function(newAgentId) {
        return registry.bindTab(newAgentId, tabId);
      }
    };
  });
}

module.exports = {
  simulateSwEviction: simulateSwEviction,
  recycleTabId: recycleTabId,
  createStorageArea: harness.createStorageArea,
  installChromeMock: harness.installChromeMock,
  installVirtualClock: harness.installVirtualClock
};
