(function(global) {
  'use strict';

  /**
   * Phase 237 plan 01 -- agent registry foundation.
   *
   * Keystone module that owns "who owns which tab" for v0.9.60 multi-agent
   * tab concurrency. This file ships the SKELETON only:
   *
   *   - In-memory Maps (agents, tabOwners, tabsByAgent)
   *   - registerAgent / releaseAgent / bindTab / releaseTab
   *   - isOwnedBy / getOwner / getAgentTabs / listAgents
   *   - formatAgentIdForDisplay (D-02 canonical 6-char prefix helper)
   *   - withRegistryLock (4-line promise-chain mutex; serializes all
   *     mutating ops within the single-threaded MV3 service worker)
   *
   * The chrome.storage.session write-through mirror and SW-wake reconciliation
   * land in plan 02. The hydrate() and _persist() methods here are stubs that
   * resolve immediately. Plan 02 replaces them with real implementations.
   *
   * Background.js wiring lands in plan 03.
   *
   * Per CONTEXT.md D-01: file path is utils/, sibling to mcp-visual-session.js
   * (the legacy sunset directory is intentionally avoided).
   *
   * Per CONTEXT.md D-04: registry is connection-agnostic in Phase 237.
   * The MCP-transport linkage field lands cleanly in Phase 241.
   */

  // ---- Constants ----------------------------------------------------------

  var FSB_AGENT_REGISTRY_STORAGE_KEY = 'fsbAgentRegistry';
  var FSB_AGENT_REGISTRY_PAYLOAD_VERSION = 1;
  var FSB_AGENT_ID_PREFIX = 'agent_';
  var FSB_AGENT_DISPLAY_HEX_LENGTH = 6;
  var FSB_AGENT_LOG_PREFIX = 'AGT';
  var FSB_AGENT_REAP_RATE_LIMIT_CATEGORY_BASE = 'agent-reaped';

  // ---- Promise-chain mutex (RESEARCH.md Pattern 3 verbatim) ---------------
  //
  // Module-scope (NOT instance-scope). The MV3 service worker is single-
  // threaded; one chain serializes all callers across all registry instances.
  // After SW eviction, the chain is reborn as Promise.resolve() -- correct
  // because no operations are in-flight on a freshly-spawned SW.
  //
  // The .then(fn, fn) shape runs the next handler whether the prior one
  // fulfilled or rejected, so a single thrown handler does NOT poison the
  // chain. The .catch(() => {}) on assignment ensures _registryChain itself
  // never holds a rejected promise (which would leak to UnhandledRejection).

  var _registryChain = Promise.resolve();
  function withRegistryLock(fn) {
    var next = _registryChain.then(fn, fn);
    _registryChain = next.catch(function() { /* swallow so chain continues */ });
    return next;
  }

  // ---- Display helper (D-02 canonical) ------------------------------------
  //
  // Single source of truth for short-prefix display. UI / log call sites
  // MUST use this helper rather than slicing IDs locally. Phase 243 (badge)
  // and Phase 244 (MCP tool descriptions) both consume it.

  function formatAgentIdForDisplay(agentId) {
    if (typeof agentId !== 'string') return '';
    if (agentId.indexOf(FSB_AGENT_ID_PREFIX) !== 0) return '';
    var hex = agentId.slice(FSB_AGENT_ID_PREFIX.length).replace(/-/g, '');
    return FSB_AGENT_ID_PREFIX + hex.slice(0, FSB_AGENT_DISPLAY_HEX_LENGTH);
  }

  // ---- AgentRecord helpers ------------------------------------------------

  function isPositiveInteger(value) {
    return typeof value === 'number' && Number.isFinite(value) && value > 0 && Math.floor(value) === value;
  }

  function cloneRecord(record) {
    if (!record || typeof record !== 'object') return null;
    try {
      return JSON.parse(JSON.stringify(record));
    } catch (_err) {
      return null;
    }
  }

  function mintAgentId() {
    if (typeof crypto !== 'undefined' && crypto && typeof crypto.randomUUID === 'function') {
      return FSB_AGENT_ID_PREFIX + crypto.randomUUID();
    }
    // Defensive fallback. Should never trigger in MV3 SW or Node 18+ (both
    // expose crypto.randomUUID natively). Kept so the module never throws.
    var rand = Math.random().toString(16).slice(2, 10);
    var stamp = Date.now().toString(16);
    return FSB_AGENT_ID_PREFIX + stamp + '-' + rand;
  }

  // ---- AgentRegistry constructor ------------------------------------------
  //
  // Mirrors mcp-visual-session.js:85-88 -- the v0.9.36 storage-keyed manager
  // pattern. Three Maps form the in-memory authoritative state:
  //
  //   _agents      : agentId  -> AgentRecord { agentId, createdAt, tabIds }
  //   _tabOwners   : tabId    -> agentId      (AUTHORITATIVE owner index)
  //   _tabsByAgent : agentId  -> Set<tabId>   (reverse index for fast lookup)
  //
  // _hydrated flips true after hydrate() runs (plan 02 enforces "must hydrate
  // before serving requests"; in plan 01 the flag is informational only).

  function AgentRegistry() {
    this._agents = new Map();
    this._tabOwners = new Map();
    this._tabsByAgent = new Map();
    this._hydrated = false;
  }

  // ---- Public API ---------------------------------------------------------

  /**
   * Register a new agent. ALWAYS mints a fresh agent_<full-uuid> via
   * crypto.randomUUID(). Caller-supplied ids are IGNORED (AGENT-01).
   * Caller-supplied opts are IGNORED in plan 01 (D-04 -- the registry is
   * connection-agnostic in Phase 237).
   *
   * @returns Promise<{ agentId, agentIdShort }>
   */
  AgentRegistry.prototype.registerAgent = function(/* opts ignored */) {
    var self = this;
    return withRegistryLock(function() {
      var agentId = mintAgentId();
      var record = {
        agentId: agentId,
        createdAt: Date.now(),
        tabIds: []
      };
      self._agents.set(agentId, record);
      self._tabsByAgent.set(agentId, new Set());
      // Plan 02 will add: await self._persist();
      return Promise.resolve({
        agentId: agentId,
        agentIdShort: formatAgentIdForDisplay(agentId)
      });
    });
  };

  /**
   * Release an agent. Removes the agent and ALL of its tab bindings.
   * Idempotent: returns false if agentId is unknown, no throw.
   *
   * @returns Promise<boolean>
   */
  AgentRegistry.prototype.releaseAgent = function(agentId, _reason) {
    var self = this;
    return withRegistryLock(function() {
      if (typeof agentId !== 'string' || !self._agents.has(agentId)) {
        return Promise.resolve(false);
      }
      var ownedTabs = self._tabsByAgent.get(agentId);
      if (ownedTabs) {
        ownedTabs.forEach(function(tabId) {
          if (self._tabOwners.get(tabId) === agentId) {
            self._tabOwners.delete(tabId);
          }
        });
      }
      self._tabsByAgent.delete(agentId);
      self._agents.delete(agentId);
      // Plan 02 will add: await self._persist();
      return Promise.resolve(true);
    });
  };

  /**
   * Bind a tab to an agent. Tab gets a single owner; if the tab is already
   * owned, this call returns false (Phase 240 enforces displacement vs reject
   * semantics; Phase 237 is structural only). Returns false on unknown agent
   * or invalid tabId, no throw.
   *
   * @returns Promise<boolean>
   */
  AgentRegistry.prototype.bindTab = function(agentId, tabId) {
    var self = this;
    return withRegistryLock(function() {
      if (typeof agentId !== 'string' || !self._agents.has(agentId)) {
        return Promise.resolve(false);
      }
      if (!isPositiveInteger(tabId)) {
        return Promise.resolve(false);
      }
      // If another agent already owns this tab, refuse silently. Phase 240
      // ships the dispatch-gate enforcement that decides displace-vs-reject.
      var currentOwner = self._tabOwners.get(tabId);
      if (currentOwner && currentOwner !== agentId) {
        return Promise.resolve(false);
      }
      self._tabOwners.set(tabId, agentId);
      var ownedTabs = self._tabsByAgent.get(agentId);
      if (!ownedTabs) {
        ownedTabs = new Set();
        self._tabsByAgent.set(agentId, ownedTabs);
      }
      ownedTabs.add(tabId);
      var record = self._agents.get(agentId);
      if (record) {
        record.tabIds = Array.from(ownedTabs);
      }
      // Plan 02 will add: await self._persist();
      return Promise.resolve(true);
    });
  };

  /**
   * Release a tab binding. IDEMPOTENT: a no-op for never-owned or already-
   * released tabs (Pitfall 6). Returns true if a binding was removed,
   * false otherwise. Never throws.
   *
   * Phase 237 does NOT release the agent when its last tab is released --
   * that lifecycle decision belongs to Phase 241 (reconnect grace).
   *
   * @returns Promise<boolean>
   */
  AgentRegistry.prototype.releaseTab = function(tabId) {
    var self = this;
    return withRegistryLock(function() {
      if (!self._tabOwners.has(tabId)) {
        return Promise.resolve(false);
      }
      var agentId = self._tabOwners.get(tabId);
      self._tabOwners.delete(tabId);
      var ownedTabs = self._tabsByAgent.get(agentId);
      if (ownedTabs) {
        ownedTabs.delete(tabId);
        var record = self._agents.get(agentId);
        if (record) {
          record.tabIds = Array.from(ownedTabs);
        }
      }
      // Plan 02 will add: await self._persist();
      return Promise.resolve(true);
    });
  };

  /**
   * Synchronous read: is this tab owned by this agent?
   * Read-only path; no mutex needed.
   */
  AgentRegistry.prototype.isOwnedBy = function(tabId, agentId) {
    return this._tabOwners.get(tabId) === agentId;
  };

  /**
   * Synchronous read: who owns this tab? Returns the full agentId or null.
   */
  AgentRegistry.prototype.getOwner = function(tabId) {
    var owner = this._tabOwners.get(tabId);
    return owner || null;
  };

  /**
   * Synchronous read: which tabs does this agent own? Returns an array
   * (never the live Set) or null if the agent is unknown.
   */
  AgentRegistry.prototype.getAgentTabs = function(agentId) {
    var ownedTabs = this._tabsByAgent.get(agentId);
    if (!ownedTabs) return null;
    return Array.from(ownedTabs);
  };

  /**
   * Synchronous read: list all agents. Returns shallow CLONES so callers
   * cannot mutate live records. Order is insertion order (Map semantics).
   */
  AgentRegistry.prototype.listAgents = function() {
    var out = [];
    this._agents.forEach(function(record) {
      var clone = cloneRecord(record);
      if (clone) out.push(clone);
    });
    return out;
  };

  /**
   * STUB in plan 01. Plan 02 implements:
   *   - Read fsbAgentRegistry from chrome.storage.session
   *   - Rebuild Maps from persisted records
   *   - Reconcile against chrome.tabs.query({}); drop ghost records
   *   - Emit agent:reaped diagnostic events for dropped records
   *   - Write reconciled snapshot back to storage
   *
   * In plan 01 this resolves immediately and flips _hydrated true so any
   * gating code in plan 02/03 that checks the flag will not deadlock when
   * stubbed against a fresh registry.
   */
  AgentRegistry.prototype.hydrate = function() {
    var self = this;
    return withRegistryLock(function() {
      self._hydrated = true;
      return Promise.resolve();
    });
  };

  /**
   * STUB in plan 01. Plan 02 implements write-through to chrome.storage.session
   * under FSB_AGENT_REGISTRY_STORAGE_KEY with the v=1 envelope shape.
   */
  AgentRegistry.prototype._persist = function() {
    return Promise.resolve();
  };

  /**
   * Test-only hook. Clears all in-memory state. NOT called from production
   * code. Plan 03 integration adds a grep guard against accidental use.
   *
   * Note: the module-scope _registryChain self-heals via .catch(() => {}),
   * so resetting it here is unnecessary.
   */
  AgentRegistry.prototype._resetForTests = function() {
    this._agents.clear();
    this._tabOwners.clear();
    this._tabsByAgent.clear();
    this._hydrated = false;
  };

  // ---- Export shape (mirrors mcp-visual-session.js:505-527) ---------------
  //
  // Both globalThis (for SW importScripts) AND module.exports (for Node test
  // harness). The module is loadable in either environment.

  var exportsObj = {
    AgentRegistry: AgentRegistry,
    formatAgentIdForDisplay: formatAgentIdForDisplay,
    withRegistryLock: withRegistryLock,
    FSB_AGENT_REGISTRY_STORAGE_KEY: FSB_AGENT_REGISTRY_STORAGE_KEY,
    FSB_AGENT_REGISTRY_PAYLOAD_VERSION: FSB_AGENT_REGISTRY_PAYLOAD_VERSION,
    FSB_AGENT_ID_PREFIX: FSB_AGENT_ID_PREFIX,
    FSB_AGENT_DISPLAY_HEX_LENGTH: FSB_AGENT_DISPLAY_HEX_LENGTH,
    FSB_AGENT_LOG_PREFIX: FSB_AGENT_LOG_PREFIX,
    FSB_AGENT_REAP_RATE_LIMIT_CATEGORY_BASE: FSB_AGENT_REAP_RATE_LIMIT_CATEGORY_BASE
  };

  global.FsbAgentRegistry = exportsObj;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exportsObj;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
