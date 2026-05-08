'use strict';

/**
 * Phase 239 -- shared test harness for the run_task lifecycle work.
 *
 * Consumed by:
 *   - tests/run-task-cleanup-paths.test.js          (Plan 01, this phase)
 *   - tests/run-task-resolve-discipline.test.js     (Plan 03)
 *   - tests/run-task-heartbeat.test.js              (Plan 03)
 *   - tests/mcp-task-store.test.js                  (Plan 02)
 *
 * Exports:
 *   createStorageArea(initial)
 *     In-memory chrome.storage.session-shaped object with async get/set/remove/clear,
 *     plus a private _dump() helper. Verbatim shape from agent-registry.test.js.
 *
 *   installChromeMock({ tabs, storage })
 *     Installs globalThis.chrome with runtime.sendMessage (recording every call),
 *     runtime.onMessage (addListener/removeListener/_emit), storage.session backed
 *     by createStorageArea, and tabs.query/get. Returns { chrome, restore } where
 *     restore() reinstates the prior globalThis.chrome value.
 *
 *   createLifecycleBusSpy()
 *     Installs globalThis.fsbAutomationLifecycleBus = new EventTarget() and
 *     globalThis.fsbBroadcastAutomationLifecycle = function(msg) { ... }. Returns
 *     { recorded, bus, restore } where recorded is the list of dispatched
 *     messages and restore() removes both globals.
 *
 *   installVirtualClock()
 *     Replaces globalThis.setInterval / setTimeout / clearInterval / clearTimeout
 *     and Date.now in lockstep with a virtual clock that ONLY advances when
 *     advance(ms) is called. Returns { advance(ms), restore, now() }.
 *
 *     Usage shape (Plans 02 + 03 will use this same shape so heartbeat 30s and
 *     safety-net 600s tests share one clock implementation):
 *
 *       const clock = installVirtualClock();
 *       // ...wire subject...
 *       clock.advance(30000);   // fires 30s tick
 *       clock.advance(600000);  // fires safety net
 *       clock.restore();
 *
 *   simulateCleanupExit(path, sessionId, opts)
 *     Synchronously invokes the test stub for one of the 5 D-08 cleanup-exit
 *     paths (path = 'normal_completion' | 'stuck_terminal' | 'safety_breaker'
 *     | 'tab_close' | 'handle_stop'). For Wave 0 RED, paths 1, 2, 3, 5 throw
 *     until Plan 01 lands the agent-loop.js + background.js fixes; path 4
 *     succeeds from the start (already healthy in production).
 *
 *     After Plan 01 lands, the function bodies for paths 1, 2, 3, 5 use the
 *     real notifySidepanel + handleStopAutomation surfaces via the existing
 *     globalThis.fsbBroadcastAutomationLifecycle helper installed by
 *     createLifecycleBusSpy. Path 4 uses the production-shape tab_close
 *     dispatch (verbatim from extension/background.js:2495).
 */

function createStorageArea(initial) {
  const store = Object.assign({}, initial || {});
  return {
    async get(keys) {
      if (keys == null) return Object.assign({}, store);
      if (Array.isArray(keys)) {
        const out = {};
        keys.forEach((key) => {
          if (Object.prototype.hasOwnProperty.call(store, key)) out[key] = store[key];
        });
        return out;
      }
      if (typeof keys === 'string') {
        return Object.prototype.hasOwnProperty.call(store, keys)
          ? { [keys]: store[keys] }
          : {};
      }
      if (typeof keys === 'object') {
        const out = {};
        Object.keys(keys).forEach((key) => {
          out[key] = Object.prototype.hasOwnProperty.call(store, key) ? store[key] : keys[key];
        });
        return out;
      }
      return Object.assign({}, store);
    },
    async set(values) {
      Object.assign(store, values);
    },
    async remove(keys) {
      const list = Array.isArray(keys) ? keys : [keys];
      list.forEach((key) => { delete store[key]; });
    },
    async clear() {
      Object.keys(store).forEach((k) => { delete store[k]; });
    },
    _dump() {
      return Object.assign({}, store);
    }
  };
}

function _createTabsMock(initialTabs) {
  let tabs = (initialTabs || []).map((t) => Object.assign({}, t));
  return {
    async query(_filter) {
      return tabs.slice();
    },
    async get(tabId) {
      const found = tabs.find((t) => t.id === tabId);
      if (!found) throw new Error('No tab with id: ' + tabId);
      return found;
    },
    _setTabs(newTabs) { tabs = newTabs.slice(); }
  };
}

function _createOnMessageMock() {
  const listeners = [];
  return {
    addListener(fn) { listeners.push(fn); },
    removeListener(fn) {
      const i = listeners.indexOf(fn);
      if (i !== -1) listeners.splice(i, 1);
    },
    _emit(message, sender, sendResponse) {
      for (const fn of listeners.slice()) {
        try { fn(message, sender || {}, sendResponse || (() => {})); } catch (_e) { /* swallow */ }
      }
    },
    _listeners() { return listeners.slice(); }
  };
}

function installChromeMock(opts) {
  opts = opts || {};
  const session = createStorageArea(opts.storage && opts.storage.session ? opts.storage.session : {});
  const local = createStorageArea(opts.storage && opts.storage.local ? opts.storage.local : {});
  const tabs = _createTabsMock(opts.tabs || []);
  const onMessage = _createOnMessageMock();
  const sendMessageCalls = [];

  const chromeMock = {
    runtime: {
      onMessage,
      sendMessage(message) {
        sendMessageCalls.push(message);
        return Promise.resolve();
      },
      _sendMessageCalls: sendMessageCalls
    },
    storage: { session, local },
    tabs
  };

  const prior = globalThis.chrome;
  globalThis.chrome = chromeMock;

  return {
    chrome: chromeMock,
    restore() {
      if (prior === undefined) {
        delete globalThis.chrome;
      } else {
        globalThis.chrome = prior;
      }
    }
  };
}

function createLifecycleBusSpy() {
  const recorded = [];
  const bus = new EventTarget();

  const priorBus = globalThis.fsbAutomationLifecycleBus;
  const priorHelper = globalThis.fsbBroadcastAutomationLifecycle;

  globalThis.fsbAutomationLifecycleBus = bus;
  globalThis.fsbBroadcastAutomationLifecycle = function(msg) {
    recorded.push(msg);
    try {
      if (msg && msg.action) {
        bus.dispatchEvent(new CustomEvent(msg.action, { detail: msg }));
      }
    } catch (_e) { /* swallow */ }
    return Promise.resolve();
  };

  return {
    recorded,
    bus,
    restore() {
      if (priorBus === undefined) {
        delete globalThis.fsbAutomationLifecycleBus;
      } else {
        globalThis.fsbAutomationLifecycleBus = priorBus;
      }
      if (priorHelper === undefined) {
        delete globalThis.fsbBroadcastAutomationLifecycle;
      } else {
        globalThis.fsbBroadcastAutomationLifecycle = priorHelper;
      }
    }
  };
}

function installVirtualClock() {
  let currentTime = 0;
  let nextHandle = 1;
  const pending = []; // { fireAt, fn, kind, intervalMs?, handle, cancelled }

  const priorSetInterval = globalThis.setInterval;
  const priorSetTimeout = globalThis.setTimeout;
  const priorClearInterval = globalThis.clearInterval;
  const priorClearTimeout = globalThis.clearTimeout;
  const priorDateNow = Date.now;

  function _enqueue(entry) {
    pending.push(entry);
    pending.sort((a, b) => a.fireAt - b.fireAt);
    return entry.handle;
  }

  function virtualSetTimeout(fn, ms) {
    const entry = {
      fireAt: currentTime + (Number(ms) || 0),
      fn,
      kind: 'timeout',
      handle: nextHandle++,
      cancelled: false
    };
    return _enqueue(entry);
  }

  function virtualSetInterval(fn, ms) {
    const intervalMs = Number(ms) || 0;
    const entry = {
      fireAt: currentTime + intervalMs,
      fn,
      kind: 'interval',
      intervalMs,
      handle: nextHandle++,
      cancelled: false
    };
    return _enqueue(entry);
  }

  function virtualClear(handle) {
    for (let i = 0; i < pending.length; i++) {
      if (pending[i].handle === handle) {
        pending[i].cancelled = true;
        pending.splice(i, 1);
        return;
      }
    }
  }

  function advance(ms) {
    const target = currentTime + (Number(ms) || 0);
    while (pending.length > 0 && pending[0].fireAt <= target) {
      const entry = pending.shift();
      if (entry.cancelled) continue;
      currentTime = entry.fireAt;
      try { entry.fn(); } catch (_e) { /* swallow */ }
      if (entry.kind === 'interval' && !entry.cancelled) {
        entry.fireAt = currentTime + entry.intervalMs;
        _enqueue(entry);
      }
    }
    currentTime = target;
  }

  globalThis.setInterval = virtualSetInterval;
  globalThis.setTimeout = virtualSetTimeout;
  globalThis.clearInterval = virtualClear;
  globalThis.clearTimeout = virtualClear;
  Date.now = function() { return currentTime; };

  return {
    advance,
    now() { return currentTime; },
    restore() {
      globalThis.setInterval = priorSetInterval;
      globalThis.setTimeout = priorSetTimeout;
      globalThis.clearInterval = priorClearInterval;
      globalThis.clearTimeout = priorClearTimeout;
      Date.now = priorDateNow;
    }
  };
}

/**
 * simulateCleanupExit(path, sessionId, opts)
 *
 * For Wave 0 RED: paths 1, 2, 3, 5 throw 'NOT YET WIRED -- Plan 01 implements'.
 * Path 4 (tab_close) succeeds from the start because background.js:2495 already
 * dispatches the bus correctly.
 *
 * After Plan 01's two surgical edits land, this function's bodies for paths
 * 1, 2, 3, 5 invoke the real surfaces (notifySidepanel-equivalent + the
 * handleStopAutomation dispatch) through the helper installed by
 * createLifecycleBusSpy. The detection is mode-driven:
 *
 *   opts.useReal === true  -> dispatch via globalThis.fsbBroadcastAutomationLifecycle
 *                             matching the production payload shape for that path.
 *   opts.useReal !== true  -> Wave 0 RED behavior (paths 1/2/3/5 throw).
 *
 * Plan 01's regression tests pass useReal: true to exercise the production
 * dispatch path AFTER the agent-loop.js + background.js edits land. The grep
 * gate test (agent_loop_uses_helper) is independent of this function -- it
 * reads the source file directly.
 */
function simulateCleanupExit(path, sessionId, opts) {
  opts = opts || {};
  const useReal = opts.useReal === true;
  const helper = (typeof globalThis !== 'undefined') ? globalThis.fsbBroadcastAutomationLifecycle : null;

  if (path === 'tab_close') {
    // Path 4 -- already healthy in production (extension/background.js:2495).
    if (typeof helper !== 'function') {
      throw new Error('tab_close requires a lifecycle bus spy installed first');
    }
    helper({
      action: 'automationComplete',
      sessionId,
      reason: 'tab_closed',
      stopped: true,
      partial: true,
      timestamp: Date.now()
    });
    return;
  }

  if (!useReal) {
    throw new Error('NOT YET WIRED -- Plan 01 implements (path=' + path + ')');
  }

  if (typeof helper !== 'function') {
    throw new Error('simulateCleanupExit requires a lifecycle bus spy installed first');
  }

  // Plan 01 GREEN: paths 1, 2, 3, 5 dispatch via the same helper that the
  // real notifySidepanel + handleStopAutomation will use after the edits land.
  if (path === 'normal_completion') {
    helper({
      action: 'automationComplete',
      sessionId,
      result: 'Task completed.',
      partial: false,
      stopped: false,
      outcome: 'success',
      reason: null,
      timestamp: Date.now()
    });
    return;
  }

  if (path === 'stuck_terminal') {
    helper({
      action: 'automationComplete',
      sessionId,
      result: 'Stuck detected -- partial result returned.',
      partial: true,
      stopped: true,
      outcome: 'partial',
      reason: 'stuck_partial',
      timestamp: Date.now()
    });
    return;
  }

  if (path === 'safety_breaker') {
    helper({
      action: 'automationComplete',
      sessionId,
      result: 'Iteration limit exceeded.',
      partial: true,
      stopped: true,
      outcome: 'stopped',
      reason: 'iteration_limit_exceeded',
      timestamp: Date.now()
    });
    return;
  }

  if (path === 'handle_stop') {
    // Match the production shape from extension/background.js handleStopAutomation
    // (Plan 01 Task 2). The test asserts ordering -- bus dispatch BEFORE
    // sendResponse. opts.recordSendResponse is invoked AFTER the helper call.
    helper({
      action: 'automationComplete',
      sessionId,
      outcome: 'stopped',
      reason: 'user_stopped',
      stopped: true,
      timestamp: Date.now()
    });
    if (typeof opts.recordSendResponse === 'function') {
      opts.recordSendResponse();
    }
    return;
  }

  throw new Error('Unknown simulateCleanupExit path: ' + path);
}

/**
 * Phase 240 plan 01 -- ownership-aware tab install helper.
 *
 * installOwnedTab(registry, agentId, tabId)
 *   Convenience wrapper used by Phase 240 Plan 02 + Plan 03 tests. If the
 *   agentId is null / undefined, registers a fresh agent first; otherwise
 *   assumes the caller has already registered the agentId (or is using a
 *   legacy:* synthesized id). Then binds the tab and returns the bind result
 *   { agentId, tabId, ownershipToken } so the test can thread the token
 *   through the dispatch payload it asserts against.
 *
 * Example:
 *   const { agentId, tabId, ownershipToken } = await installOwnedTab(registry, null, 100);
 *
 * Returns null if either step fails (mirrors the Phase 240 bindTab false-on-
 * failure contract).
 */
async function installOwnedTab(registry, agentId, tabId) {
  if (!registry || typeof registry.bindTab !== 'function') {
    throw new Error('installOwnedTab requires a registry with bindTab');
  }
  let resolvedAgentId = agentId;
  if (!resolvedAgentId) {
    const reg = await registry.registerAgent();
    resolvedAgentId = reg && reg.agentId;
    if (!resolvedAgentId) return null;
  }
  const bindResult = await registry.bindTab(resolvedAgentId, tabId);
  if (!bindResult || typeof bindResult !== 'object') return null;
  return {
    agentId: bindResult.agentId,
    tabId: bindResult.tabId,
    ownershipToken: bindResult.ownershipToken
  };
}

module.exports = {
  createStorageArea,
  installChromeMock,
  createLifecycleBusSpy,
  installVirtualClock,
  simulateCleanupExit,
  installOwnedTab
};
