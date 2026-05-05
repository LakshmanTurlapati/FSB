(function(global) {
  'use strict';

  /**
   * Phase 237 plan 01 + 02 -- agent registry foundation with storage write-
   * through and SW-wake reconciliation.
   *
   * Keystone module that owns "who owns which tab" for v0.9.60 multi-agent
   * tab concurrency.
   *
   *   - In-memory Maps (agents, tabOwners, tabsByAgent)
   *   - registerAgent / releaseAgent / bindTab / releaseTab
   *   - isOwnedBy / getOwner / getAgentTabs / listAgents
   *   - formatAgentIdForDisplay (D-02 canonical 6-char prefix helper)
   *   - withRegistryLock (4-line promise-chain mutex; serializes all
   *     mutating ops within the single-threaded MV3 service worker)
   *   - chrome.storage.session write-through under FSB_AGENT_REGISTRY_STORAGE_KEY
   *     in versioned envelope { v: 1, records: { ... } } (AGENT-02)
   *   - hydrate() rebuilds Maps from storage and reconciles against
   *     chrome.tabs.query({}); ghost records are dropped from BOTH in-memory
   *     Maps AND storage. Each drop emits an agent:reaped event through the
   *     existing Phase 211 LOG-04 ring buffer via rateLimitedWarn (AGENT-03).
   *
   * Background.js wiring lands in plan 03.
   *
   * Per CONTEXT.md D-01: file path is utils/, sibling to mcp-visual-session.js
   * (the legacy sunset directory is intentionally avoided).
   *
   * Per CONTEXT.md D-03: ghost-record drops emit through rateLimitedWarn with
   * per-reason category 'agent-reaped-<reason>' so different drop reasons
   * surface independently in the diagnostics ring.
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

  // ---- Storage helpers (mirror background.js:563-591 with v: 1 envelope) --
  //
  // Both helpers reference globalThis.chrome lazily so the module loads
  // cleanly under Node test harnesses where chrome is mocked AFTER module
  // load. Errors are swallowed to a return-null / no-op posture; the SW
  // boot path must NEVER be poisoned by a storage hiccup.

  function _getChrome() {
    return (typeof globalThis !== 'undefined' && globalThis.chrome) ? globalThis.chrome : null;
  }

  async function readPersistedAgentRegistry() {
    var c = _getChrome();
    if (!c || !c.storage || !c.storage.session || typeof c.storage.session.get !== 'function') {
      return null;
    }
    try {
      var stored = await c.storage.session.get([FSB_AGENT_REGISTRY_STORAGE_KEY]);
      var payload = stored ? stored[FSB_AGENT_REGISTRY_STORAGE_KEY] : null;
      if (!payload || typeof payload !== 'object') return null;
      if (payload.v !== FSB_AGENT_REGISTRY_PAYLOAD_VERSION) return null;
      return payload;
    } catch (_e) {
      return null;
    }
  }

  async function writePersistedAgentRegistry(records) {
    var c = _getChrome();
    if (!c || !c.storage || !c.storage.session) return;
    try {
      var nextRecords = (records && typeof records === 'object') ? records : {};
      if (Object.keys(nextRecords).length === 0) {
        if (typeof c.storage.session.remove === 'function') {
          await c.storage.session.remove(FSB_AGENT_REGISTRY_STORAGE_KEY);
        }
        return;
      }
      var payload = {};
      payload[FSB_AGENT_REGISTRY_STORAGE_KEY] = {
        v: FSB_AGENT_REGISTRY_PAYLOAD_VERSION,
        records: nextRecords
      };
      if (typeof c.storage.session.set === 'function') {
        await c.storage.session.set(payload);
      }
    } catch (_e) {
      // best-effort; do not throw
    }
  }

  // ---- Diagnostic emission (RESEARCH.md Pattern 5 Option A; CONTEXT.md D-03)
  //
  // Lazy-references globalThis.rateLimitedWarn so a module load order issue
  // (Pitfall 5) does not crash the reaping path. Reaping is mandatory; the
  // diagnostic is best-effort.

  function emitAgentReapedEvent(agentId, tabId, reason) {
    var event = {
      type: 'agent:reaped',
      agentId: agentId,
      tabId: tabId,
      reason: reason,
      timestamp: Date.now(),
      agentIdShort: formatAgentIdForDisplay(agentId)
    };
    if (typeof globalThis !== 'undefined' && typeof globalThis.rateLimitedWarn === 'function') {
      try {
        globalThis.rateLimitedWarn(
          FSB_AGENT_LOG_PREFIX,
          FSB_AGENT_REAP_RATE_LIMIT_CATEGORY_BASE + '-' + reason,
          'agent reaped',
          { agentIdShort: event.agentIdShort, tabId: tabId, reason: reason }
        );
      } catch (_e) { /* swallow */ }
    }
    return event;
  }

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
    return withRegistryLock(async function() {
      var agentId = mintAgentId();
      var record = {
        agentId: agentId,
        createdAt: Date.now(),
        tabIds: []
      };
      self._agents.set(agentId, record);
      self._tabsByAgent.set(agentId, new Set());
      await self._persist();
      return {
        agentId: agentId,
        agentIdShort: formatAgentIdForDisplay(agentId)
      };
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
    return withRegistryLock(async function() {
      if (typeof agentId !== 'string' || !self._agents.has(agentId)) {
        return false;
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
      await self._persist();
      return true;
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
    return withRegistryLock(async function() {
      if (typeof agentId !== 'string' || !self._agents.has(agentId)) {
        return false;
      }
      if (!isPositiveInteger(tabId)) {
        return false;
      }
      // If another agent already owns this tab, refuse silently. Phase 240
      // ships the dispatch-gate enforcement that decides displace-vs-reject.
      var currentOwner = self._tabOwners.get(tabId);
      if (currentOwner && currentOwner !== agentId) {
        return false;
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
      await self._persist();
      return true;
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
    return withRegistryLock(async function() {
      if (!self._tabOwners.has(tabId)) {
        // No-op path: do NOT persist. Idempotency guarantee.
        return false;
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
      await self._persist();
      return true;
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
   * Hydrate the registry from chrome.storage.session and reconcile against
   * the live tab set. Idempotent (second call is a no-op). Gated by
   * withRegistryLock so concurrent registerAgent / bindTab / etc. calls
   * cannot interleave with the rebuild + reconcile pass.
   *
   * Steps (RESEARCH.md Pattern 4):
   *   1. Rebuild Maps from { v: 1, records: { ... } } envelope
   *   2. Query chrome.tabs.query({}) to build liveTabIds Set
   *   3. Drop records whose tabIds are not in the live set; if all of an
   *      agent's tabs are ghosts, drop the agent record too. Conservative
   *      posture if chrome.tabs.query throws: do NOT drop anything.
   *   4. Emit one rateLimitedWarn('AGT', 'agent-reaped-<reason>', ...) per
   *      drop with redactedContext { agentIdShort, tabId, reason }.
   *   5. If any records were reaped, write the reconciled snapshot back to
   *      storage so memory and disk stay in sync.
   */
  AgentRegistry.prototype.hydrate = function() {
    if (this._hydrated) return Promise.resolve();
    var self = this;
    return withRegistryLock(async function() {
      if (self._hydrated) return; // double-check after lock acquisition

      var payload = await readPersistedAgentRegistry();
      var records = (payload && payload.records && typeof payload.records === 'object')
        ? payload.records : {};

      // Step 1: rebuild Maps from persisted records.
      Object.keys(records).forEach(function(agentId) {
        var record = records[agentId];
        if (!record || typeof record !== 'object') return;
        var tabIds = Array.isArray(record.tabIds) ? record.tabIds.slice() : [];
        self._agents.set(agentId, {
          agentId: record.agentId || agentId,
          createdAt: typeof record.createdAt === 'number' ? record.createdAt : Date.now(),
          tabIds: tabIds.slice()
        });
        self._tabsByAgent.set(agentId, new Set(tabIds));
        tabIds.forEach(function(tabId) { self._tabOwners.set(tabId, agentId); });
      });

      // Step 2: query live tabs. If chrome.tabs.query is unavailable or throws,
      // be conservative: keep everything (do not reap).
      var c = _getChrome();
      if (!c || !c.tabs || typeof c.tabs.query !== 'function') {
        self._hydrated = true;
        return;
      }
      var liveTabs;
      try {
        liveTabs = await c.tabs.query({});
      } catch (_e) {
        self._hydrated = true;
        return;
      }
      var liveTabIds = new Set();
      (liveTabs || []).forEach(function(t) {
        if (t && typeof t.id === 'number') liveTabIds.add(t.id);
      });

      // Step 3: drop ghost records.
      var reapedThisWake = [];
      var tabOwnerSnapshot = Array.from(self._tabOwners.entries());
      tabOwnerSnapshot.forEach(function(entry) {
        var tabId = entry[0];
        var agentId = entry[1];
        if (!liveTabIds.has(tabId)) {
          reapedThisWake.push({ agentId: agentId, tabId: tabId, reason: 'tab_not_found' });
          self._tabOwners.delete(tabId);
          var setRef = self._tabsByAgent.get(agentId);
          if (setRef) {
            setRef.delete(tabId);
            // If this was the agent's last tab, the entire record is a ghost.
            // Phase 241 owns the "agent legitimately has no tabs" lifecycle;
            // here on hydrate specifically, an agent with all-ghost tabs IS
            // itself a ghost.
            if (setRef.size === 0) {
              self._tabsByAgent.delete(agentId);
              self._agents.delete(agentId);
            } else {
              var rec = self._agents.get(agentId);
              if (rec) rec.tabIds = Array.from(setRef);
            }
          }
        }
      });

      // Step 4: emit one diagnostic event per reaped record (rate-limited).
      reapedThisWake.forEach(function(reap) {
        emitAgentReapedEvent(reap.agentId, reap.tabId, reap.reason);
      });

      // Step 5: write reconciled snapshot back if anything changed.
      if (reapedThisWake.length > 0) {
        await self._persist();
      }

      self._hydrated = true;
    });
  };

  /**
   * Write-through helper. Serializes the live in-memory Maps into a plain
   * object keyed by agentId and writes the { v: 1, records } envelope to
   * chrome.storage.session under FSB_AGENT_REGISTRY_STORAGE_KEY. When the
   * registry is empty, writePersistedAgentRegistry removes the key entirely
   * (no stale envelope).
   *
   * Called from inside withRegistryLock by registerAgent / bindTab /
   * releaseTab / releaseAgent and from hydrate Step 5.
   */
  AgentRegistry.prototype._persist = async function() {
    var records = {};
    var self = this;
    this._agents.forEach(function(record, agentId) {
      var tabSet = self._tabsByAgent.get(agentId);
      records[agentId] = {
        agentId: record.agentId,
        createdAt: record.createdAt,
        tabIds: tabSet ? Array.from(tabSet) : []
      };
    });
    await writePersistedAgentRegistry(records);
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
    FSB_AGENT_REAP_RATE_LIMIT_CATEGORY_BASE: FSB_AGENT_REAP_RATE_LIMIT_CATEGORY_BASE,
    // _internal: test-only hooks. NOT to be consumed by production callers.
    _internal: {
      emitAgentReapedEvent: emitAgentReapedEvent,
      readPersistedAgentRegistry: readPersistedAgentRegistry,
      writePersistedAgentRegistry: writePersistedAgentRegistry
    }
  };

  global.FsbAgentRegistry = exportsObj;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exportsObj;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
