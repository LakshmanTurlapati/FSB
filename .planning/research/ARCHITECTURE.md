# Architecture Research: Multi-Agent Tab Concurrency for FSB

**Domain:** Chrome Extension MV3 + MCP server, multi-agent tab ownership integration
**Researched:** 2026-05-05
**Mode:** Project Research (subsequent milestone v0.9.60)
**Confidence:** HIGH (codebase walked; no novel external deps)

---

## 1. Current State Assessment (read before designing)

### 1.1 Single-agent invariant today

FSB is built around an **implicit single-agent invariant**: there is conceptually one autopilot session at a time per surface, even though `activeSessions` (`extension/background.js:1981`) is a `Map`. The Map holds multiple session records (sidepanel, popup, dashboard, MCP) but the architecture has never hard-enforced ownership of a tab -- the "owner" is whoever last started a session targeting that tab.

Key existing collections (all in service-worker memory):

| Collection | Defined at | Lifecycle | Purpose |
|---|---|---|---|
| `activeSessions: Map<sessionId, Session>` | `background.js:1981` | SW memory + mirrored to `chrome.storage.session` via `persistSession` (`background.js:~2160`) | Authoritative session state |
| `sessionAIInstances: Map<sessionId, AIIntegration>` | `background.js:2082` | SW memory only (rebuilt on wake) | Per-session AI conversation history |
| `conversationSessions: Map<convId, {sessionId, lastActiveTime}>` | `background.js:2086` | Mirrored to `chrome.storage.session` via `restoreConversationSessions` | Follow-up reuse routing |
| `mcpVisualSessionManager._tokenByTabId: Map<tabId, sessionToken>` | `extension/utils/mcp-visual-session.js:88` | Mirrored to `chrome.storage.session` key `fsbMcpVisualSessions` | Visual overlay ownership (1:1 per tab) |
| `contentScriptPorts: Map<tabId, port>` | `background.js` | SW memory; `MAX_CONTENT_SCRIPT_ENTRIES = 200` cap | Per-tab content-script connection |

Critical observation: **`McpVisualSessionManager` already implements per-tab uniqueness with displacement semantics** (`extension/utils/mcp-visual-session.js:104-110`). When a new visual session starts on a tab that already has one, the existing token is evicted, a `replacedSession` record is returned, and the storage write is rebuilt. This is the closest existing analog to what tab ownership needs -- **but its policy is "last writer wins," which is the opposite of what agent ownership requires.**

### 1.2 Existing ownership-adjacent constructs

| Concept | Where | Granularity | Compatible with multi-agent? |
|---|---|---|---|
| Visual-session client allowlist (`Claude`, `Codex`, `Gemini`, ...) | `utils/mcp-visual-session.js:4-17` | Per-MCP-client (1 of 12 labels) | Yes -- but coarse: many parallel agents can share `Claude` label |
| Visual session per-tab uniqueness | `mcp-visual-session.js:104-110` | One client x one tab | Composes cleanly: ownership is finer-grained than client label |
| `session.tabId` / `session.originalTabId` / `session.previousTabId` | scanned at `mcp-tool-dispatcher.js:282` | Per-session tabs (no enforcement) | Already plumbed; needs an enforcement layer |
| `chrome.tabs.onRemoved` cleanup | `background.js:2455` and `background.js:12616` | Per-tab | Will need a third hook for agent registry cleanup |
| `getActiveTabFromClient` | `mcp-tool-dispatcher.js:203` | Falls back to `chrome.tabs.query({active: true, currentWindow: true})` | **This is the crux**: today MCP tools assume the active tab. Multi-agent will need explicit `tabId` per call OR a mapping from `agent_id` to a chosen tab. |

### 1.3 The MCP tool dispatcher (Phase 199 contracts)

All MCP tool entries flow through one of two route tables in `extension/ws/mcp-tool-dispatcher.js`:

- `MCP_PHASE199_TOOL_ROUTES` (lines 19-46) -- the canonical tool->handler mapping the bridge serves
- `MCP_PHASE199_MESSAGE_ROUTES` (lines 48-65) -- the legacy `mcp:` message-type table for in-SW dispatch

Every multi-agent enforcement must live here (or in a thin wrapper around it) -- this is the single chokepoint that touches every MCP tool. Bypassing it would create per-tool divergence.

### 1.4 Phase 236 status (mostly already done)

Reading `extension/ws/mcp-bridge-client.js:625-740` and the autopilot tool registration at `mcp/src/tools/autopilot.ts:23-62`, **the in-SW completion bus already exists**: `globalThis.fsbAutomationLifecycleBus` was added in Phase 225-01 to mirror `automationComplete`/`automationError` events to listeners in the same service worker as the broadcaster. The bridge client subscribes; on completion it `resolve()`s the promise that returns to MCP.

The remaining gap is the **300_000 ms timeout** at:
- `extension/ws/mcp-bridge-client.js:678-680` -- extension-side timeout that returns `status: 'timeout'`
- `mcp/src/tools/autopilot.ts:58` -- server-side `bridge.sendAndWait({timeout: 300_000})` ceiling

So Phase 236 is not "build a completion mechanism" -- it is "remove or extend the ceiling and verify the existing path resolves first." Confidence: HIGH.

---

## 2. Recommended Architecture (high-level diagram)

```
+----------------------------------------------------------------------+
|                   MCP CLIENTS (per-process)                          |
|  Claude Desktop --+    Cursor --+    Codex --+    Custom --+         |
+------+------------+--------+----+-------+----+-------+-----+---------+
       |                     |            |           |
       |   stdio / Streamable HTTP (one MCP process per client)        |
       v                     v            v           v
+----------------------------------------------------------------------+
|             MCP SERVER (mcp/src -- fsb-mcp-server@0.8.0)             |
|  +--------------+   +--------------+   +-----------------------------+
|  | tools/       |   | TaskQueue    |   | AgentScope (NEW)            |
|  |  autopilot   |   | (queue.ts)   |   |  - mints agent_id at        |
|  |  manual      |---|  readonly    |---|    session start            |
|  |  visual-sess |   |   bypass     |   |  - threads through every    |
|  |  agents      |   +--------------+   |    bridge.sendAndWait       |
|  +-----+--------+                      +-------------+---------------+
|        |                                             |
|        +------------- WebSocketBridge ---------------+
+-----------------------------+----------------------------------------+
                              |  ws://127.0.0.1:7225 (hub or relay)
                              v
+----------------------------------------------------------------------+
|        EXTENSION SERVICE WORKER (extension/background.js)            |
|                                                                      |
|  +----------------------------------------------------------------+  |
|  | AgentRegistry (NEW -- extension/agents/agent-registry.js)      |  |
|  |   agents:      Map<agent_id, AgentRecord>                       |  |
|  |   tabOwners:   Map<tab_id,  agent_id>          [authoritative]  |  |
|  |   tabsByAgent: Map<agent_id, Set<tab_id>>      [reverse index]  |  |
|  |   capacity:    hardCap=8, current=N                             |  |
|  |   storage:     chrome.storage.session (mirror; SW-restart safe) |  |
|  +-+--------------------------------------------------------------+  |
|    |                                                                 |
|    | ownership checks at every dispatch                              |
|    v                                                                 |
|  +-------------------------+    +---------------------------------+  |
|  | mcp-tool-dispatcher.js  |    | activeSessions / sessionAI      |  |
|  |  - augmented routes     |----|  (existing, augmented to carry  |  |
|  |  - rejects on mismatch  |    |   agent_id)                     |  |
|  +------------+------------+    +---------------------------------+  |
|               |                                                      |
|  +------------+----------------------------------------------------+  |
|  | Visual Session Manager (existing) -- composes BENEATH ownership |  |
|  |   per-agent overlay; client-label still allowlisted             |  |
|  +-----------------------------------------------------------------+  |
|                                                                      |
|  +------------------------------------------------------------------+ |
|  | Tab lifecycle hooks (chrome.tabs.onRemoved, onCreated,           | |
|  |  webNavigation.onCommitted) -- drive registry cleanup            | |
|  +------------------------------------------------------------------+ |
+----------------------------------------------------------------------+
```

---

## 3. New Components (proposed)

### 3.1 `extension/agents/agent-registry.js` -- single source of truth

**This is the keystone module.** Single global `AgentRegistry` instance loaded via `importScripts` near the top of `background.js` (after `mcp-visual-session.js`, before `mcp-tool-dispatcher.js` so dispatcher can reference it).

```js
// extension/agents/agent-registry.js (NEW)
class AgentRegistry {
  constructor() {
    this._agents      = new Map();   // agent_id -> AgentRecord
    this._tabOwners   = new Map();   // tab_id -> agent_id  (AUTHORITATIVE)
    this._tabsByAgent = new Map();   // agent_id -> Set<tab_id>
    this.HARD_CAP     = 8;
  }

  registerAgent({clientLabel, mcpInstanceId, sessionToken}) { /* ... */ }
  bindTab(agentId, tabId, {forced=false}) { /* throws CapReachedError / TabOwnedByOtherError */ }
  releaseAgent(agentId, reason) { /* releases all tabs */ }
  releaseTab(tabId) { /* chrome.tabs.onRemoved hook */ }
  isOwnedBy(tabId, agentId) { /* ... */ }
  ownerOf(tabId) { /* ... */ }
  size() { return this._agents.size; }

  // SW-restart durability
  async hydrate() { /* ... read chrome.storage.session ... */ }
  async _persist() { /* ... write chrome.storage.session ... */ }
}
```

**Storage choice (see section 5):** `chrome.storage.session`. Authoritative copy lives in SW memory; storage is the recovery snapshot.

### 3.2 `extension/agents/agent-lifecycle.js` (NEW, optional) -- thin coordinator

Wraps tab-lifecycle events (`chrome.tabs.onRemoved`, `chrome.webNavigation.onBeforeNavigate` for cross-origin discards) and calls the right `AgentRegistry` method. Splitting this out keeps `background.js` thinner and survives the existing `chrome.tabs.onRemoved` listeners at `:2455` and `:12616` without re-entrancy.

### 3.3 `mcp/src/agent-scope.ts` (NEW) -- per-MCP-process agent identity

```ts
// mcp/src/agent-scope.ts (NEW)
export class AgentScope {
  private agentId: string | null = null;
  private clientLabel: string;
  constructor(clientLabel: string) { this.clientLabel = clientLabel; }

  async ensure(bridge: WebSocketBridge): Promise<string> {
    if (this.agentId) return this.agentId;
    const r = await bridge.sendAndWait({
      type: 'agent:register',
      payload: { clientLabel: this.clientLabel },
    }, { timeout: 5_000 });
    this.agentId = r.agentId;
    return this.agentId;
  }
}
```

A single `AgentScope` instance is created in `mcp/src/runtime.ts` (next to bridge + queue) and threaded into every tool registration, so each MCP server process represents exactly one logical agent. Multiple MCP processes from the same client = multiple agents.

### 3.4 New MCP tools (in `mcp/src/tools/agents.ts` -- file already exists for `list_agents`)

| Tool | Purpose | Notes |
|---|---|---|
| `back` (NEW) | Browser back-button on agent's currently-bound tab | See section 6 |

Per the milestone scope, `back` is the only new agent-facing tool. Internal `agent:register` / `agent:release` go via the bridge protocol, not as MCP tools -- agents are minted implicitly on first use.

### 3.5 Schema additions

`extension/ai/session-schema.js` already defines a 57-field session record. Add (non-breaking):

| Field | Type | Source |
|---|---|---|
| `agentId` | string \| null | Set by `handleStartAutomation` from incoming MCP payload |
| `clientLabel` | string \| null | Mirrors visual-session label, stored on session for analytics |

---

## 4. Modified Components (every MCP entry point)

Per the quality gate, here is the explicit list of touch-points that must accept and verify `agent_id`. Ordered by likelihood of regression (most-used first):

### 4.1 MCP server side -- pass-through `agent_id` injection

| File | Function | Change |
|---|---|---|
| `mcp/src/tools/autopilot.ts:23` (`run_task`) | adds `agentId` from `AgentScope.ensure()` into `payload`; remove or raise `timeout: 300_000` (Phase 236) | **Modified** |
| `mcp/src/tools/autopilot.ts:67` (`stop_task`) | adds `agentId` so only that agent's session is stopped | **Modified** |
| `mcp/src/tools/autopilot.ts:84` (`get_task_status`) | adds `agentId` | **Modified** |
| `mcp/src/tools/manual.ts:36` (`execAction` helper) | adds `agentId` to every `mcp:execute-action` payload (one-line in the funnel) | **Modified** |
| `mcp/src/tools/visual-session.ts:55` / `:80` | already takes `client`; add `agentId` so visual session inherits agent ownership | **Modified** |
| `mcp/src/tools/agents.ts` | adds `back` tool registration | **Modified** |
| `mcp/src/queue.ts:51` | optional: queue scoping per agent (see section 4.4 trade-off) | **Modified or unchanged** |

### 4.2 Extension side -- verification + dispatch

| File | Function | Change |
|---|---|---|
| `extension/ws/mcp-tool-dispatcher.js:113` (`dispatchMcpToolRoute`) | accept `agentId` in input; before invoking `route.handler`, resolve target tab and call `agentRegistry.isOwnedBy(tabId, agentId)`; reject with `tab_not_owned` on mismatch | **Modified** |
| `extension/ws/mcp-tool-dispatcher.js:289` (`handleNavigateRoute`), `:312` (history), `:345` (`open_tab`) | when opening or navigating, call `agentRegistry.bindTab(agentId, newTabId, {forced})` BEFORE returning success; bound tab joins the agent's pool | **Modified** |
| `extension/ws/mcp-tool-dispatcher.js:203` (`getActiveTabFromClient`) | augment to prefer "agent's last-touched tab" when an `agentId` is present, falling back to current-window-active only if agent has no tabs | **Modified** |
| `extension/background.js:6175` (`handleStartAutomation`) | extract `agentId` from request; verify cap and ownership before binding `targetTabId`; record `session.agentId` | **Modified** |
| `extension/background.js:6742` (`handleStopAutomation`) | only stop sessions whose `session.agentId === request.agentId` | **Modified** |
| `extension/background.js:2455` (`chrome.tabs.onRemoved`) | additional call: `agentRegistry.releaseTab(tabId)`; if that empties an agent's pool, release the agent | **Modified** |
| `extension/utils/mcp-visual-session.js:90` (`startSession`) | optionally accept `agentId` so the overlay can show agent-distinguishing labels | **Modified, optional in v0.9.60 scope** |
| `extension/ws/mcp-bridge-client.js:625` (`_handleStartAutomation`) | timeout extension/removal (Phase 236) | **Modified** |

### 4.3 New bridge message types

Add to `MCP_PHASE199_MESSAGE_ROUTES` in `mcp-tool-dispatcher.js`:

```js
'agent:register': { routeFamily: 'agent', handler: handleAgentRegisterRoute },
'agent:release':  { routeFamily: 'agent', handler: handleAgentReleaseRoute },
'agent:status':   { routeFamily: 'agent', handler: handleAgentStatusRoute },
```

### 4.4 Per-agent queue trade-off (decide explicitly)

`mcp/src/queue.ts` today serializes ALL mutation tools globally, per-MCP-process. With multi-agent, the safer-but-slower default is "leave it alone -- one MCP process = one agent = one queue." If the milestone wants to allow one MCP client to drive 8 agents in parallel from a single MCP process, the queue must become a `Map<agent_id, TaskQueue>`. **Recommendation: keep one-process = one-agent for v0.9.60** (matches AgentScope shape); revisit per-agent queues in a later milestone.

---

## 5. Storage Layer Choice (explicit recommendation)

**Recommendation: `chrome.storage.session` for the registry mirror; SW memory authoritative.**

Rationale and trade-offs:

| Layer | Pros | Cons | Verdict |
|---|---|---|---|
| SW memory only | Fastest, no async cost on hot paths | **Lost on every SW eviction** -- Chrome aggressively suspends MV3 SWs after 30s idle. After eviction, an agent that opened 3 tabs would lose ownership and the next tool call would dispatch on the active tab. **Catastrophic for the milestone.** | Insufficient alone |
| `chrome.storage.session` | Survives SW restart for the browser session; cleared on browser close (matches "lock release on disconnect" semantics); same store FSB already uses for `fsbMcpVisualSessions`, `fsbConversationSessions`, persisted sessions | Async writes; ~10MB cap (irrelevant -- registry is tiny); cleared on browser restart, which is correct (no zombie ownership across restarts) | **Yes -- primary mirror** |
| `chrome.storage.local` | Persists across browser restarts | **Wrong semantics** -- locks must release when the MCP client disconnects. Persisting beyond a browser restart would leave dangling tab ownership for tabs that don't exist. | No |

**Pattern (matches existing `mcp-visual-session.js:563-589`):**

```js
async _persist() {
  const snapshot = {
    agents:    Array.from(this._agents.entries()),
    tabOwners: Array.from(this._tabOwners.entries()),
  };
  await chrome.storage.session.set({ fsbAgentRegistry: snapshot });
}
async hydrate() {
  const { fsbAgentRegistry } = await chrome.storage.session.get('fsbAgentRegistry');
  if (!fsbAgentRegistry) return;
  this._agents    = new Map(fsbAgentRegistry.agents);
  this._tabOwners = new Map(fsbAgentRegistry.tabOwners);
  for (const [tabId, agentId] of this._tabOwners) {
    if (!this._tabsByAgent.has(agentId)) this._tabsByAgent.set(agentId, new Set());
    this._tabsByAgent.get(agentId).add(tabId);
  }
  // Validate against actual open tabs (drop stale entries)
  const openTabs = new Set((await chrome.tabs.query({})).map(t => t.id));
  for (const tabId of [...this._tabOwners.keys()]) {
    if (!openTabs.has(tabId)) this.releaseTab(tabId);
  }
}
```

`hydrate()` runs once at SW startup, alongside the existing `restorePersistedMcpVisualSessions()` and `restoreConversationSessions()` calls. The "validate against actual open tabs" step is **mandatory** -- a tab closed during SW eviction won't have fired `onRemoved`, so the registry must reconcile on wake.

**Persistence triggers (write events):** `bindTab`, `releaseTab`, `releaseAgent`, `registerAgent`. Debounce writes to a microtask to coalesce burst updates (open_tab -> bindTab fires twice in 5ms otherwise).

---

## 6. Visual-Session Composition (which wins on conflict)

Two ownership models coexist after this milestone:

- **Visual session:** per-tab, per-MCP-client-LABEL (`Claude` / `Codex` / ...). Today: 1 session per tab; same-tab restart displaces.
- **Agent ownership:** per-tab, per-`agent_id`. Multiple `agent_id`s can share one client label (two `Claude` MCP processes = two agents).

**Recommendation: agent ownership is the gate; visual session is the surface.**

Concretely:
1. Tool dispatch checks `agentRegistry.isOwnedBy(tabId, agentId)` first.
2. If owned, the tool proceeds; visual-session lookup happens after for overlay updates only.
3. On conflict (`start_visual_session` on a tab owned by a different agent): reject with `tab_owned_by_other_agent`. **Do not silently displace** -- that would let one MCP client steal another agent's tab via the visual route.
4. The existing displacement semantics in `McpVisualSessionManager.startSession` (`mcp-visual-session.js:104-110`) should be **retained for same-agent re-entry** (e.g. agent restarts a session on a tab it already owns) and **disabled for cross-agent attempts**.

This requires a one-line check in `startSession`:

```js
// extension/utils/mcp-visual-session.js -- modified
if (existingToken && existingSession.agentId && existingSession.agentId !== input.agentId) {
  return { errorCode: 'tab_owned_by_other_agent', ownerAgentId: existingSession.agentId };
}
```

---

## 7. Agent Lifecycle Sequence Diagram

The cleanest sequence for the milestone's canonical scenario -- Agent A starts, opens T1, opens T2 (forced pooling), task ends:

```
MCP Client          MCP Server (one process)            Extension SW                     Browser
   |                       |                                |                              |
   |-- run_task("...") ----|                                |                              |
   |                       |-- AgentScope.ensure() --------->                              |
   |                       |                                | AgentRegistry.registerAgent  |
   |                       |                                |   agentId = a_7f3            |
   |                       <----- { agentId: a_7f3 } -------| persist()                    |
   |                       |                                |                              |
   |                       |-- mcp:start-automation -------->                              |
   |                       |      {agentId, task}           | handleStartAutomation        |
   |                       |                                |   targetTab = active or open |
   |                       |                                |-- tabs.update(T1, url) ----->|
   |                       |                                | bindTab(a_7f3, T1)           |
   |                       |                                | tabOwners[T1]=a_7f3          |
   |                       |                                | session.agentId = a_7f3      |
   |                       |                                | activeSessions[sid] = ...    |
   |                       |                                | persist()                    |
   |                       |                                |                              |
   |                       |                  +------- runAgentLoop iterates -----+        |
   |                       |                  | (no fixed timeout -- Phase 236)   |        |
   |                       |                  |                                   |        |
   |                       |                  | Agent decides "open new tab"      |        |
   |                       |                  | tool: open_tab -> handleOpenTab   |        |
   |                       |                  |-- tabs.create(url) -------------->| <- T2  |
   |                       |                  | bindTab(a_7f3, T2, forced:true)   |        |
   |                       |                  | tabOwners[T2]=a_7f3               |        |
   |                       |                  | tabsByAgent[a_7f3]={T1,T2}        |        |
   |                       |                  | persist()                         |        |
   |                       |                  +-----------------------------------+        |
   |                       |                                |                              |
   |                       |                                | task complete                |
   |                       |                                | fsbAutomationLifecycleBus    |
   |                       |                                |   .dispatch(automationCmpl)  |
   |                       |                                | bridge listener resolves     |
   |                       <--- { status:'completed', ... }-|                              |
   |                       |   AgentScope.release()         | (locks STAY held until       |
   |                       |  (only on session end / disc.) |  explicit release or         |
   |                       |                                |  client disconnect)          |
   |                       |                                |                              |
   |     -- session ends, MCP client disconnects --         |                              |
   |                       |-- ws.close -------------------->                              |
   |                       |                                | bridge.onclose detects       |
   |                       |                                | AgentRegistry.releaseAgent   |
   |                       |                                |   - tabsByAgent[a_7f3] = {}  |
   |                       |                                |   - tabOwners.delete(T1,T2)  |
   |                       |                                |   - persist()                |
   |                       |                                | (T1, T2 stay open in browser |
   |                       |                                |  but now ownerless -- next   |
   |                       |                                |  agent may bind them)        |
```

**Cap rejection flow** (alternate): if `AgentScope.ensure()` is called when `agentRegistry.size() >= 8`, return `{success: false, errorCode: 'agent_cap_reached', currentAgents: 8, hardCap: 8}` and the MCP `run_task` immediately resolves with that error -- no tab is ever bound.

**Lock-release triggers (all four must work):**
1. Task/session ends -> `cleanupSession` -> call `agentRegistry.releaseAgent(agentId)` if no other sessions reference it
2. MCP client disconnects -> bridge `onclose` -> release agent on a 5s grace timer (handles transient reconnects)
3. User closes a tab -> existing `chrome.tabs.onRemoved:2455` -> also call `agentRegistry.releaseTab(tabId)`; if `tabsByAgent[agentId]` becomes empty -> release agent
4. Explicit `agent:release` message -> forced release

---

## 8. The `back` Tool -- Implementation Path

**Closest sibling: `go_back`** (already registered at `mcp-tool-dispatcher.js:21`, handler `handleNavigationHistoryRoute` at `:312`). This is the "the work is already done" answer -- `back` is essentially a renamed alias.

### Three candidate implementations (recommend #1)

| Approach | Code path | Pros | Cons | Verdict |
|---|---|---|---|---|
| **1. `chrome.tabs.goBack(tabId)`** | already used at `mcp-tool-dispatcher.js:326`; same as `ws-client.js:473` for remote control | Works on **background tabs** (no need to focus); no debugger attach; tabId is explicit | Requires "tabs" permission (already granted) | **Recommended** |
| 2. CDP `Page.goBack` via debugger | requires `chrome.debugger.attach`; navigation-history API exists | Works during debugger sessions | Heavyweight; conflicts with `keyboardEmulator` debugger contention noted in CLAUDE.md fixes | No |
| 3. `window.history.back()` in content script | already exists at `extension/content/actions.js:4571` | Works for in-page SPA history | **Requires content script alive on a focused tab**; doesn't work cleanly for background tabs; SPA fragment-only navigations | No (bad fit for milestone's background-tab requirement) |

### Recommended implementation

```ts
// mcp/src/tools/agents.ts -- add back tool (NEW)
server.tool(
  'back',
  'Navigate back in the agent\'s currently-bound tab (browser back button). Works on background tabs; does not require the tab to be focused.',
  { tabId: z.number().optional().describe('Specific tab id; defaults to agent\'s last-touched tab') },
  async ({ tabId }) => {
    if (!bridge.isConnected) return mapFSBError({success: false, error: 'extension_not_connected'});
    const agentId = await agentScope.ensure(bridge);
    return queue.enqueue('back', async () => {
      const result = await bridge.sendAndWait({
        type: 'mcp:execute-tool-route',
        payload: { tool: 'go_back', params: { tabId }, agentId },
      }, { timeout: 10_000 });
      return mapFSBError(result);
    });
  },
);
```

Extension side: **no new handler needed** -- `handleNavigationHistoryRoute` already does the work. The only addition is the ownership check in the dispatcher wrapper (section 4.2) so that an agent can only `back` on tabs it owns.

**Edge case:** if `chrome.tabs.goBack` is called on a tab with no history (just opened), Chrome silently no-ops. Wrap in a try/catch and return a clean `{success: true, noOp: true, reason: 'no_history'}` -- this avoids spurious failures in agent loops. Existing handler at `:333` returns `{success: true}` unconditionally; modify to detect via `chrome.tabs.get(tabId).pendingUrl` change after a 100ms wait.

---

## 9. Phase 236 -- `run_task` Returns on Completion (integration shape)

### Current state (already 90% there)

- The completion event already exists: `globalThis.fsbAutomationLifecycleBus.dispatch('automationComplete')` (`background.js:2010-2034`).
- The bridge client already subscribes (`mcp-bridge-client.js:735-738`) and resolves the promise via `handleComplete` -> `settle()`.
- The remaining bug is the **300_000 ms hard ceiling** at `mcp-bridge-client.js:678` (extension side) and `mcp/src/tools/autopilot.ts:58` (server side).

### Recommended shape: **wait on session-completion event, no fixed ceiling**

Pick one of three integration shapes:

| Shape | Description | Recommendation |
|---|---|---|
| **A. No timeout (rely on event)** | Remove the `setTimeout(..., 300000)`; trust `fsbAutomationLifecycleBus` + the existing `automationComplete` broadcast on every cleanup path | **Recommended** -- but only after auditing every `cleanupSession` and stuck-detection path emits the event |
| B. Heartbeat-based timeout | Keep a timeout, but reset it on every `automationProgress` event (idle = no progress for 60s = timeout) | Safer if (A)'s audit reveals dropped events; more code |
| C. Streamed result via long-poll | `run_task` returns immediately with `taskId`, MCP client polls `get_task_status` | Breaks current contract; not needed |

**Recommendation A trade-offs honestly stated:**

- **Pro:** matches the milestone description verbatim ("returns on completion instead of hitting the 300s ceiling")
- **Con:** if any cleanup path silently drops the lifecycle event (and the existing audit at v0.9.40 shows there have historically been such paths), the MCP call will hang forever
- **Mitigation:** **shape A + 600s safety net** -- keep a timeout but raise it 2x while we add belt-and-suspenders coverage. Once we confirm zero drops in production telemetry over a milestone, remove entirely. This is safer than removing in one shot.

```ts
// mcp/src/tools/autopilot.ts -- Phase 236 modified
const result = await bridge.sendAndWait(
  { type: 'mcp:start-automation', payload: { task, agentId } },
  { timeout: 600_000, onProgress },  // 10min safety; bus event resolves earlier
);
```

```js
// extension/ws/mcp-bridge-client.js:678 -- modified
const timeout = setTimeout(() => {
  settle({ sessionId, status: 'timeout', message: 'Automation exceeded 10-minute safety ceiling' }, 'timeout');
}, 600_000);
```

**Audit checklist for "every cleanup path emits the lifecycle event"** -- this is the hard part:

- `background.js:2455` (tab closed): already emits via `fsbBroadcastAutomationLifecycle` -- verified
- `background.js:6742` (`handleStopAutomation`): verify
- Stuck-detection terminal exit (Phase 226 work): verify
- `cleanupSession` called from runAgentLoop completion: verify (this is the canonical path)
- SW eviction during automation: **gap** -- when SW evicts, no event fires. On wake, sessions are restored from `chrome.storage.session` and the loop should continue. If it can't continue (e.g., model API unreachable), the bridge listener will not fire. This is the case that needs the 600s ceiling.

---

## 10. Suggested Build Order (risk-minimized, dependency-aware)

Each step is a phase boundary that lands independently green. Do not collapse -- earlier dependencies must land before later enforcement.

### Phase A -- Registry foundation (no behavior change, new module isolated)
- Create `extension/agents/agent-registry.js` with full API + `chrome.storage.session` persistence
- Hydrate on SW startup; reconcile against `chrome.tabs.query({})`
- Wire `chrome.tabs.onRemoved` to `releaseTab` -- **but no tools enforce ownership yet**
- Tests: registry CRUD, storage round-trip, cap enforcement at API level
- **Risk:** low -- new module, zero callers
- **Why first:** every later phase depends on this existing

### Phase B -- Bridge messages + `AgentScope` (MCP server side, no enforcement)
- Add `agent:register` / `agent:release` / `agent:status` routes to `mcp-tool-dispatcher.js`
- Build `mcp/src/agent-scope.ts`; wire into `runtime.ts`
- Thread `agentId` through every tool registration (autopilot, manual, visual-session) -- but extension still ignores it
- Tests: agent_id present in payloads; AgentScope is process-singleton
- **Risk:** low -- additive; no enforcement yet
- **Why second:** sets up the data flow before any gate trips

### Phase C -- Phase 236 (`run_task` return-on-completion)
- Audit every cleanupSession exit path emits the lifecycle event
- Raise extension+server timeouts to 600s as safety ceiling
- Verify in prod: at least 5 long tasks return on completion not on timeout
- **Risk:** medium -- touches autopilot's hottest path
- **Why third:** decouples from multi-agent work; lower risk to land alone before adding the new gates; also unblocks the mcp@0.8.0 release independently

### Phase D -- Tab-ownership enforcement on dispatch
- Modify `mcp-tool-dispatcher.js:113` to verify ownership before invoking handlers
- Modify `handleStartAutomation` and `handleNavigateRoute`/`handleOpenTabRoute` to call `bindTab`
- Visual session compose check (section 6)
- Modify `handleStopAutomation` to scope to `agentId`
- **Risk:** high -- every MCP call now flows through the gate
- **Why fourth:** the registry (A) and the wiring (B) and the timeout fix (C) must all be in before this lands or every MCP call fails

### Phase E -- Forced-new-tab pooling + cap enforcement
- `bindTab(forced:true)` for `open_tab` and any agent-internal tab opens
- Cap-reached error path verified (the 9th agent-register fails cleanly)
- Lock-release on disconnect via bridge `onclose` (5s grace timer)
- **Risk:** medium -- multi-tab semantics
- **Why fifth:** builds on the gate from D

### Phase F -- `back` tool
- Register `back` in `mcp/src/tools/agents.ts` as alias for `go_back` route
- Ownership check via the gate from D (no new ext-side work)
- No-history no-op handling
- **Risk:** low -- thin wrapper over existing route
- **Why sixth:** depends on D's enforcement infrastructure but is otherwise trivial

### Phase G -- Hardening + UI
- Sidepanel/popup awareness of "tab is owned by external agent" (read-only badge, not enforcement) -- see section 11
- Reconciliation tests across SW eviction
- Full e2e: 8 agents in parallel, 9th rejected, all 8 release on disconnect
- mcp@0.8.0 publish

### Critical ordering constraints (non-negotiable)
- **A before D** -- gate cannot enforce against a non-existent registry
- **B before D** -- server can't pass `agentId` if `AgentScope` doesn't exist
- **C is independent** -- can land in parallel with A or B; ship with mcp@0.8.0 even if D-G slip
- **D before E and F** -- cap enforcement and `back` tool both rely on the dispatch gate

---

## 11. Integration with Existing Sidepanel / Popup / Dashboard (scope question)

**Recommendation: out-of-scope for v0.9.60; add a read-only "owned by" indicator only, no enforcement.**

The milestone says agents are MCP-driven. Sidepanel/popup are user-driven UI surfaces with their own existing session lifecycle (currently registered to the `null` or implicit "user" agent). Three options:

| Option | Description | Verdict |
|---|---|---|
| 1. UI surfaces become real agents | Mint an agent_id for the sidepanel, mint another for the popup; same enforcement applies | Over-scope; couples a stable user-facing surface to a new contract; high regression risk |
| 2. UI surfaces are "user agent" (single shared id) | Reserved `agent_id = 'user'`; competes for tabs against MCP agents | Cleaner, but still needs UI work to display "tab is owned by another agent" gracefully |
| **3. UI surfaces bypass the gate; show read-only owner badge** | Sidepanel/popup operate on whichever tab they target; if that tab is MCP-owned, show a non-blocking badge "Tab driven by Agent X (Claude)" | **Recommended** -- keeps regression surface small, preserves user override |

In option 3, the only required change is a 5-line addition to the sidepanel session card showing `agentRegistry.ownerOf(tabId)` if non-null. No enforcement. User starting an action on an MCP-owned tab will compete naturally -- last writer wins (same as today), but with visibility.

**Dashboard/showcase:** unchanged. Dashboard is read-only telemetry; add an "agents" panel later (use `list_agents` MCP tool which already exists in `tools/agents.ts`).

---

## 12. Confidence and Open Questions

| Topic | Confidence | Notes |
|---|---|---|
| Registry storage choice (`chrome.storage.session`) | HIGH | Three existing FSB stores already use this layer with the right semantics |
| `back` tool path (`chrome.tabs.goBack`) | HIGH | Already implemented in `handleNavigationHistoryRoute`; just needs to be exposed as `back` |
| Phase 236 shape (event-driven, raised ceiling) | MEDIUM | Depends on cleanup-path audit completeness; flagged 600s safety net |
| Agent-vs-visual-session conflict resolution | HIGH | The displacement code path already exists; just adding an early-return |
| Sequence diagram correctness | HIGH | Walked existing `handleStartAutomation` and bridge client paths line by line |
| Build order risk ranking | HIGH | Each phase verified to compile/test independently |
| Sidepanel/popup integration scope | MEDIUM | "Show owner badge only" is a recommendation; user may want full integration -- flag for roadmap discussion |

### Open questions for ROADMAP authoring

1. **Per-agent queue or one queue per MCP process?** Section 4.4 recommends one-process-one-agent; confirm this matches v0.9.60 product intent before D lands.
2. **Cap reached: queue or reject?** Section 7 shows reject. Some prior art (job schedulers) queues. Reject is simpler and matches the milestone's "9th request rejected with a clear cap-reached error" requirement.
3. **Disconnect grace period: 5s vs 30s?** Transient network blips on `Refinements` branch were 1-2s; 5s gives margin. Longer = stale ownership during reconnect storms.
4. **Agent identity: ephemeral (mint per session) vs sticky (per MCP process)?** AgentScope as written is sticky-per-process. If a single MCP process should be able to fork sub-agents, AgentScope becomes a registry itself. Defer.

---

## 13. Sources

- `extension/background.js` (lines 1981, 2082, 2455, 6175, 6742, 12616) -- session and tab lifecycle
- `extension/ws/mcp-tool-dispatcher.js` (lines 19-65, 113, 203, 282, 312-343) -- MCP routing and tab resolution
- `extension/ws/mcp-bridge-client.js` (lines 600-740) -- completion bus subscription and 300s timeout
- `extension/utils/mcp-visual-session.js` (lines 4-17, 85-200, 563-589) -- visual session manager and persistence pattern
- `mcp/src/tools/autopilot.ts:23-99` -- run_task / stop_task / get_task_status registration
- `mcp/src/tools/manual.ts:19-83` -- execAction funnel for all browser-action MCP tools
- `mcp/src/tools/visual-session.ts:32-92` -- visual-session MCP tool
- `mcp/src/queue.ts` -- TaskQueue with read-only bypass
- `mcp/src/bridge.ts:153-189` -- sendAndWait + onProgress wiring
- `.planning/PROJECT.md` (lines 26-44) -- v0.9.60 milestone scope and constraints
- `.planning/codebase/ARCHITECTURE.md` -- baseline single-agent architecture analysis

---
*Architecture research for: FSB v0.9.60 multi-agent tab concurrency*
*Researched: 2026-05-05*
