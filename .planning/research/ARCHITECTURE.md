# Architecture Integration Map -- v0.9.45rc1

**Project:** FSB v0.9.45rc1 -- Sync surface, Agent sunset, Stream reliability
**Mode:** Project Research (architecture)
**Confidence:** HIGH (all findings confirmed by direct file inspection)

## Executive Summary

- **Tab convention is sidebar nav, NOT tabs.** The control panel uses `<li class="nav-item" data-section="X">` paired with `<section class="content-section" id="X">`. Activation toggles `.active` on both. Adding a "Sync" surface = add 1 nav-item + 1 content-section + an `initializeSyncSection()` JS function. No tab framework.
- **Pairing logic already exists at the function level** (`showPairingQR`, `cancelPairing`, `regeneratePairingToken`, `ensureHashKey`, `fetchPairingToken`, `renderPairingQR`, `startPairingCountdown`) in `ui/options.js` lines 4766-4946. They are bound to DOM IDs that currently live inside the `background-agents` section. Sync tab can re-host these IDs without rewriting the controller.
- **Remote-control state is a one-way broadcast contract.** `ws/ws-client.js:130-161` sends `ext:remote-control-state` to dashboard. There is no inbound listener to options.js for that event today; the Sync tab will need a NEW pull-model API (`chrome.runtime.sendMessage({action:'getRemoteControlState'})`) plus an in-extension push (`chrome.runtime.sendMessage({action:'remoteControlStateChanged', state})`).
- **Agent code is cleanly file-isolated.** `agents/agent-manager.js`, `agents/agent-scheduler.js`, `agents/agent-executor.js`, `agents/server-sync.js` are imported only at `background.js:160-163`. Message router cases live in `background.js:5586-5752`. The alarm handler at `background.js:12532-12606` is partially shared (MCP reconnect alarm handled in same listener -- preserve early-return). Agent UI is concentrated in `ui/control_panel.html:563-749` and `ui/options.js:4160-4665`, plus slash commands in `ui/sidepanel.js:1928-2013` and `ui/popup.js:846-930`.
- **Compression is asymmetric, confirmed.** Outbound compresses payloads >1024 bytes via `LZString.compressToBase64` (`ws/ws-client.js:580-606`). Inbound at `ws-client.js:515-522` does `JSON.parse(event.data)` then dispatches; no `_lz` envelope check. Dashboard does decompress (`showcase/js/dashboard.js:3517-3518` and `dashboard-page.component.ts:3204-3205`).
- **Mutation pipeline has no watchdog and no stale counter.** `content/dom-stream.js:670-679` uses `requestAnimationFrame(flushMutations)`. If page is backgrounded and rAF is throttled, `pendingMutations` grows unbounded. The 2MB truncation at lines 467-489 is brute-force `clone.querySelectorAll('[data-fsb-nid]')` + per-element `getBoundingClientRect` (O(n) DOM thrash).

---

## (a) Sync Tab Integration

### Convention discovered

**HTML pattern** (`ui/control_panel.html`):
- Nav item: `<li class="nav-item" data-section="<id>"><i class="fas fa-..."></i><span>Label</span></li>` inside `<ul class="nav-list">` at lines 53-90.
- Content section: `<section class="content-section" id="<id>"> ... </section>` inside `<main class="dashboard-content">` at lines 95-1542.
- Default-active section: add `active` class to BOTH nav-item and section.

**CSS pattern** (`ui/options.css`):
- `.nav-item` base styling at lines 335-365; `.nav-item.active` at 354-360.
- `.content-section { display: none; }` at 376; `.content-section.active { display: block; }` at 382.
- Layout is grid-driven by `.dashboard-sidebar` + `.dashboard-content`.

**JS activation** (`ui/options.js`):
- Element collection at lines 127-128: `elements.navItems = querySelectorAll('.nav-item')`, `elements.contentSections = querySelectorAll('.content-section')`.
- Click wiring at line 199.
- `switchSection(sectionId)` at lines 482-497 toggles `.active`, updates `dashboardState.currentSection`, updates URL hash.
- `initializeSections()` at 499-505 reads `window.location.hash.slice(1)` and calls `switchSection`.
- Per-tab lazy refresh hook at lines 3082-3099: `switchSection` is monkey-patched in `initializeCredentialManager()` to call section-specific loaders. **Canonical extension point for "on Sync tab open, refresh remote-control state".**

### Existing pairing/remote-control surface

**Pairing module** (already factored in `ui/options.js`):
- `ensureHashKey` (4781), `fetchPairingToken` (4795), `renderPairingQR` (4806), `startPairingCountdown` (4815), `renderExpiredState` (4838), `regeneratePairingToken` (4857), `showPairingQR` (4887), `cancelPairing` (4929), `generateHashKey` (4697), `copyHashKey` (4719), `testServerConnection` (4733).
- Module state vars: `pairingCountdownTimer`, `pairingFetchInFlight` (4771-4772).
- DOM IDs (raw `getElementById`): `serverUrl`, `serverHashKey`, `pairingQROverlay`, `pairingQRCode`, `pairingCountdown`, `pairingQRMessage`, `btnPairDashboard`, `btnCancelPairing`, `btnGenerateHashKey`, `btnCopyHashKey`, `btnTestConnection`, `connectionStatus`. **IDs are document-scoped, will continue to work if relocated to a Sync section.**
- Initial wiring in `initializeAgentsSection()` at lines 4189-4205. **This wiring needs to migrate to a new `initializeSyncSection()`.**

**Remote-control state contract:**
- Outbound only today. `ws/ws-client.js:130-161`: `_broadcastRemoteControlState(wsInstance, enabled, reason, tabId)` sends `ext:remote-control-state` with `{enabled, attached, tabId, reason, ownership}`.
- Module-scope: `_remoteControlActive`, `_lastRemoteControlState`.
- Dashboard handlers: `showcase/js/dashboard.js:3811`, `showcase/angular/.../dashboard-page.component.ts:3386`.
- Test contract: `tests/dashboard-runtime-state.test.js:195-208`, `tests/remote-control-handlers.test.js:61`.
- **Gap:** `options.js` does NOT subscribe to `ext:remote-control-state`. Sync tab needs a fresh state-getter or a runtime message bus.

### Recommended Sync tab integration

```
ui/control_panel.html:
  + <li class="nav-item" data-section="sync"><i class="fas fa-link"></i><span>Sync</span></li>
    (insert after nav-item dashboard, before api-config; ~line 57)
  + <section class="content-section" id="sync"> ... </section>
    Move (do NOT copy) Server Sync settings card (701-748) and pairingQROverlay
    out of #background-agents into #sync.

ui/options.js:
  + initializeSyncSection() that wires btnGenerate/btnCopy/btnTest/btnPair/btnCancelPair
    using the EXISTING handler functions (do not duplicate).
  + Extend the switchSection monkey-patch (3082-3099) with
      if (sectionId === 'sync') { refreshRemoteControlState(); }
  + refreshRemoteControlState() asks background.js for current state via runtime.sendMessage.
  + chrome.runtime.onMessage listener for action 'remoteControlStateChanged' for live updates.

background.js:
  + New action 'getRemoteControlState' returns _lastRemoteControlState.
  + In ws-client.js _broadcastRemoteControlState, also chrome.runtime.sendMessage(
      {action:'remoteControlStateChanged', state}).catch(...)
```

**Integration risk:** Sync section invisible until clicked. If `_broadcastRemoteControlState` fires before `options.js` loads, options misses the broadcast and shows stale state. **Mitigation:** Sync tab activation MUST pull last-known state via `getRemoteControlState`; do not rely on broadcast-only delivery (replay-on-attach pattern).

---

## (b) Background-Agent Dependency Graph

### Agent-only files (entire file SAFE-TO-COMMENT)

| File | What | Status |
|------|------|--------|
| `agents/agent-manager.js` | CRUD (`createAgent`, `updateAgent`, `deleteAgent`, `listAgents`, `toggleAgent`, `getAgent`, `recordRun`, `getStats`, `getRunHistory`, `clearRecordedScript`). Storage key `'bgAgents'` (line 8). | SAFE-TO-COMMENT (whole file) |
| `agents/agent-scheduler.js` | Alarm management. Alarm prefix `'fsb_agent_'` (line 9). | SAFE-TO-COMMENT (whole file) |
| `agents/agent-executor.js` | Background-tab execution + replay engine. `MAX_CONCURRENT=3`, `EXECUTION_TIMEOUT=4min`. | SAFE-TO-COMMENT (whole file) |
| `agents/server-sync.js` | `serverSync.syncRun(agent, result)` for dashboard mirroring. | SAFE-TO-COMMENT (whole file) |
| `mcp-server/src/tools/agents.ts` | MCP tools `create_agent`, `list_agents`, `run_agent`, `stop_agent`, `delete_agent`, `toggle_agent`, `agent_stats`, `agent_history`. | SAFE-TO-COMMENT (whole file) + remove `registerAgentTools` import (`mcp-server/src/runtime.ts:10, 35`) |

### Agent-only entry points inside SHARED files

| File | Range | What | Status |
|------|-------|------|--------|
| `background.js` | 160-163 | importScripts of agent files | SAFE-TO-COMMENT |
| `background.js` | 5586-5752 | Message router cases (createAgent, updateAgent, deleteAgent, listAgents, toggleAgent, runAgentNow, getAgentStats, getAgentRunHistory, clearAgentScript, getAgentReplayInfo, toggleAgentReplay) | SAFE-TO-COMMENT (whole switch block) |
| `background.js` | 12531-12606 | `chrome.alarms.onAlarm` -- **MIXED**. 12533-12540 handle `MCP_RECONNECT_ALARM` (PRESERVE early-return). 12542-12605 handle agent alarms (SAFE-TO-COMMENT). | PARTIAL |
| `background.js` | 12634, 12652 | `agentScheduler.rescheduleAllAgents()` calls in onInstalled/onStartup | SAFE-TO-COMMENT (2 lines) |
| `ws/ws-client.js` | 934-936 | `case 'dash:agent-run-now'` | SAFE-TO-COMMENT |
| `ws/ws-client.js` | 1181-1203 | `_handleAgentRunNow(payload)` | SAFE-TO-COMMENT |
| `ui/control_panel.html` | 62-65 | `<li class="nav-item" data-section="background-agents">` | SAFE-TO-COMMENT (replace nav with sunset card or hide) |
| `ui/control_panel.html` | 563-749 | Entire `<section id="background-agents">`, EXCEPT 700-748 (Server Sync card + pairing overlay) which **MUST MOVE** to `#sync` | PARTIAL: comment agent UI; relocate Server Sync block |
| `ui/options.js` | 4160-4221 | `initializeAgentsSection()` -- **MIXED**. 4160-4188 agent form wiring. 4189-4205 pairing wiring (MOVE to initializeSyncSection). 4207-4221 agent list/stats + agentRunComplete listener. | PARTIAL |
| `ui/options.js` | 4224-4665 | `showAgentForm`, `saveAgent`, `loadAgentList`, `renderAgentCard`, `loadAgentStats`, `toggleAgent`, etc. | SAFE-TO-COMMENT |
| `ui/sidepanel.js` | 378-379, 1928-2013 | `/agent` slash command | SAFE-TO-COMMENT |
| `ui/popup.js` | 203-204, 846-930 | Same slash-command pattern | SAFE-TO-COMMENT |
| `showcase/dashboard.html` | 67, 99-181, 252, 278-435 | Vanilla dashboard agent UI | SAFE-TO-COMMENT (replace with sunset card) |
| `showcase/js/dashboard.js` | ~226 hits | Click handlers (`dash-new-agent-btn` 653, `dash-save-agent-btn` 702, `stat-agents` 1747) | SAFE-TO-COMMENT |
| `showcase/angular/.../dashboard-page.component.ts` | ~221 hits | Angular agent mirror | SAFE-TO-COMMENT (preserve `ext:remote-control-state` and `_lz` paths) |
| `showcase/angular/.../dashboard-page.component.html` | 8, 40-181, 252, 278-435 | Angular agent UI mirror | SAFE-TO-COMMENT |
| `showcase/angular/.../home-page.component.html` | 60-63 | "Background Agents" feature card | REPLACE with sunset/relocation messaging pointing at OpenClaw + Claude Routines |
| `mcp-server/src/runtime.ts` | 10, 35 | Import + call `registerAgentTools` | SAFE-TO-COMMENT (2 lines) |

### SHARED-DO-NOT-TOUCH

| Resource | Used by agents via | Used by non-agents via |
|----------|---------------------|--------------------------|
| `chrome.alarms.onAlarm` listener | Agent alarms (`fsb_agent_<id>`) | MCP reconnect alarm (`MCP_RECONNECT_ALARM`) -- **PRESERVE listener with MCP guard, delete agent branch only** |
| `activeSessions` Map | `_handleAgentRunNow` checks `[...activeSessions.values()]` | Autopilot/dashboard tasks/MCP visual sessions all use it. **DO NOT TOUCH** |
| `chrome.runtime.sendMessage({action:'startAutomation'})` | Indirectly via executor | Dashboard task submit, popup, sidepanel. **DO NOT TOUCH** |
| `serverUrl`/`serverHashKey` storage keys | `agents/server-sync.js` | ws-client.js auto-register, dashboard pairing. **DO NOT TOUCH** |
| `_streamingTabId`, `_dashboardTaskTabId` | n/a | Dashboard task routing. **DO NOT TOUCH** |
| `ext:remote-control-state` contract | n/a | Phase 209 + dashboard. **DO NOT TOUCH** |

### Agent storage keys (preserve, don't delete)

- `chrome.storage.local['bgAgents']` -- agent definitions and run history (`agents/agent-manager.js:8`).
- `chrome.alarms` named `fsb_agent_<id>` (`agents/agent-scheduler.js:9`).

Both can stay populated during deprecation. Data preservation costs nothing; user can re-enable later if scope reverses.

---

## (c) DOM Streaming Pipeline

### Mutation observer pipeline

**File:** `content/dom-stream.js`

| Stage | Location | Detail |
|-------|----------|--------|
| Module state | 13-23 | `mutationObserver`, `batchTimer`, `pendingMutations[]`, `nextNodeId`, `streamSessionId`, `currentSnapshotId` |
| Observer creation | 670-688 (`startMutationStream`) | `MutationObserver(cb)` accumulates into `pendingMutations`, then `requestAnimationFrame(flushMutations)`. Observes `document.body` with full subtree. |
| Batch processing | 552-632 (`processMutationBatch`) | Builds `{op:'add'\|'rm'\|'attr'\|'text', ...}` diffs, skips FSB overlay nodes |
| Outbound | 637-657 (`flushMutations`) | `chrome.runtime.sendMessage({action:'domStreamMutations', ...}).catch(()=>{})` -- **silent catch** |
| Forwarding to relay | `background.js:5841-5850` | `fsbWebSocket.send('ext:dom-mutations', ...)` |
| Stop + flush | 695-724 (`stopMutationStream`) | Cancels rAF, flushes pending, silent `.catch(()=>{})` at 718 |

### Outbound frame batching

**Single rAF batching only.** Each `MutationObserver` callback overwrites `batchTimer`. Result: at most one flush per paint frame. **No secondary watchdog** -- if rAF stalls (backgrounded tab, throttled paints), `pendingMutations` grows without bound.

### Large-DOM truncation

**File:** `content/dom-stream.js`, lines 467-489.
**Trigger:** `clone.innerHTML.length > 2 * 1024 * 1024` (2MB).
**Mechanism:**
1. `viewportCutoff = window.innerHeight * 3`
2. `clone.querySelectorAll('[data-fsb-nid]')` -- walks entire annotated DOM
3. Per element: `document.querySelector('[data-fsb-nid="..."]')` + `getBoundingClientRect()`
4. Removes elements with `top > viewportCutoff`
5. Re-reads `clone.innerHTML`
6. Sets `truncated: true`

**Performance issues:**
- O(n) `querySelector` round-trips with attribute selectors
- O(n) layout-thrashing `getBoundingClientRect` reads
- Single-pass; if still >2MB after viewport-3x cull, no second pass

### Stale counter

**No stale counter today.** Searching for `stale`, `staleCount` returns nothing.

**Recommended:** module-scope `pendingFlushAge`, `staleFlushCount`, plus a `chrome.alarms`-backed watchdog (NOT `setInterval` -- v0.9.40 lessons re: SW lifecycle). Watchdog fires if `pendingMutations.length > 0 && Date.now() - lastFlushAt > 1000`. Reset `staleFlushCount = 0` after a successful empty-queue flush. Surface `staleFlushCount` in `ext:stream-state`, NOT in `ext:dom-mutations` (do not change existing payload shape).

### Integration risk

If watchdog fires while rAF still scheduled, double-flush. **Mitigation:** watchdog must `cancelAnimationFrame(batchTimer); batchTimer = null;` before calling `flushMutations`. `flushMutations` already idempotent on empty queue (line 639).

---

## (d) WebSocket Frame Handling

### Inbound frame handler

**File:** `ws/ws-client.js`
- Receive entry: `this.ws.onmessage` at 515-522 -- `JSON.parse(event.data); _handleMessage(msg)`. **No `_lz` check.**
- Dispatcher: `_handleMessage(msg)` at 918-976 -- switch on `msg.type` (cases: `pong`, `dash:task-submit`, `dash:stop-task`, `dash:request-status`, `dash:agent-run-now`, `dash:dom-stream-*`, `dash:remote-control-*`, `dash:remote-click/key/scroll`, `dash:navigate`, etc.).

### Outbound compression

**File:** `ws/ws-client.js`, function `send(type, payload)` at 568-606.
1. `var raw = JSON.stringify({type, payload, ts:Date.now()})`
2. If `raw.length > 1024 && typeof LZString !== 'undefined'`:
   - `compressed = LZString.compressToBase64(raw)`
   - If `compressed.length < raw.length`: `this.ws.send(JSON.stringify({_lz:true, d:compressed}))`
3. Otherwise: `this.ws.send(raw)`

`LZString` loaded via `importScripts('lib/lz-string.min.js')` at `background.js:37` (try/catch wrapped).

### Round-trip envelope

| Direction | Compressed | Uncompressed |
|-----------|-----------|---------------|
| Outbound (extension -> relay -> dashboard) | `{_lz:true, d:<base64 LZ>}` decoded body = `{type, payload, ts}` | `{type, payload, ts}` |
| Inbound (dashboard -> relay -> extension) | TODO: dashboard does not currently compress, but relay may re-emit compressed if added server-side. Today's relay (`server/src/ws/handler.js:190`) at minimum identifies `'compressed-envelope'`. | `{type, payload, ts}` |

### Symmetric fix

```js
this.ws.onmessage = (event) => {
  try {
    var raw = JSON.parse(event.data);
    if (raw && raw._lz === true && typeof raw.d === 'string' && typeof LZString !== 'undefined') {
      var decompressed = LZString.decompressFromBase64(raw.d);
      if (!decompressed) {
        recordFSBTransportFailure('decompress-failed', { type: '_lz', target: 'inbound', error: 'LZString returned null' });
        return;
      }
      raw = JSON.parse(decompressed);
    }
    this._handleMessage(raw);
  } catch (err) {
    console.warn('[FSB WS] Failed to parse message:', err.message);
  }
};
```

**Integration risk:** If `LZString` failed to load (importScripts try/catch), today the extension silently drops compressed inbound frames. Fix must guard `typeof LZString !== 'undefined'` and emit `recordFSBTransportFailure('decompress-unavailable', ...)`.

---

## (e) Showcase Dashboard Mirror

### Sync surface link/copy updates

| File | Section | Update |
|------|---------|--------|
| `showcase/angular/.../home-page.component.html` | 70-72 (Remote Dashboard feature card) | Update copy to point at the new Sync tab name |
| `showcase/angular/.../dashboard-page.component.html` | 6 (`fa-qrcode` header), 11-16 (Scan QR tab) | Update copy to "Open the Sync tab in FSB" instead of "Background Agents" |
| `showcase/angular/.../dashboard-page.component.ts` | 5, 3204-3205, 3386 | Already handles `ext:remote-control-state` and `_lz`. **No code change needed; copy/labels only.** |
| `showcase/dashboard.html` | 6-7 (`<title>`, meta), 67 (`<h2>`) | Replace title and primary heading with sync-focused copy |
| `showcase/js/dashboard.js` | 653, 702, 1747 | Hide agent-specific UI elements once HTML block is removed |

### Agents-sunset card

| File | Section | Update |
|------|---------|--------|
| `showcase/angular/.../home-page.component.html` | 59-63 (Background Agents feature card) | **Replace** body: "Background agents are now handled by [OpenClaw](link) and [Claude Routines](link). FSB stays focused on precise execution." Keep `fa-robot` icon for visual continuity. |
| `showcase/dashboard.html` | 99-181, 278-435 | Replace `#dash-agent-container` block with single sunset card pointing at OpenClaw / Claude Routines |
| `showcase/angular/.../dashboard-page.component.html` | 40-181, 278-435 | Same replacement as vanilla |
| `showcase/angular/.../dashboard-page.component.ts` | (~221 hits) | Comment out agent-related component methods/state. **Do not delete `ext:remote-control-state` or `_lz` paths.** |
| `showcase/js/dashboard.js` | (~226 hits) | Same: comment agent block, preserve transport + remote-control + decompression |

### Showcase nav (no changes)

`showcase-shell.component.html` and `app.routes.ts` have no agent or sync references.

---

## Suggested Build Order

### Phase 1 -- Stream Reliability (parallel-safe, isolated)

**Why first:** No coupling to Sync tab or agent sunset. Pure content-script + ws-client.js work.

1. **Phase 1A -- WebSocket compression symmetry** (`ws/ws-client.js:515-522`). Add `_lz` envelope decompression to inbound `onmessage`. Single-file change, low risk.
2. **Phase 1B -- Diagnostic logging for silent catches**: `content/dom-stream.js:208,222,653,718,753,839,864,897,932`, `background.js:6358,6405,6641,8901,8936,9090,9922,10557,10593,10639,10686,10724,10869,10922`, `content/lifecycle.js:462,472,480`. Replace `.catch(()=>{})` with `.catch((err)=>console.warn('[FSB <module>] <action> sendMessage delivery failed', err && err.message))`. **Skip `extractAndStoreMemories.catch`** -- intentional fire-and-forget. Lifecycle.js SPA-navigation catches likely become `automationLogger.debug`, not `console.warn` (fire on every reload).
3. **Phase 1C -- DOM streaming hardening** (`content/dom-stream.js`). Watchdog timer (chrome.alarms-backed, NOT setInterval) flushes if `pendingMutations.length > 0 && Date.now() - lastFlushAt > 1000`. Reset `staleFlushCount` on successful empty flush. Smarter truncation: replace per-element `getBoundingClientRect` loop with TreeWalker pass + cached positions, OR tiered cliffs (1MB -> 2MB -> 4MB with progressive culling). Surface `staleFlushCount` in `ext:stream-state` (NEW field, do NOT modify `ext:dom-mutations` shape).

### Phase 2 -- Background Agent Sunset (must precede Sync tab)

**Why second:** Sync tab moves Server Sync card OUT OF background-agents section. Sunsetting agents first means the destination is already comment-fenced when migration happens.

4. **Phase 2A -- Comment out agent code**:
   - `agents/*.js` (4 whole files)
   - `background.js:160-163, 5586-5752, 12542-12605, 12634, 12652`
   - `ws/ws-client.js:934-936, 1181-1203`
   - `mcp-server/src/runtime.ts:10, 35` + whole `mcp-server/src/tools/agents.ts`
   - `ui/sidepanel.js:378-379, 1928-2013`, `ui/popup.js:203-204, 846-930`
   - `ui/options.js:4222-4665` (NOT 4189-4205 server-sync wiring)
   Annotate every comment block: `// DEPRECATED v0.9.45rc1: Background agents retired in favor of OpenClaw / Claude Routines. See PROJECT.md.`
5. **Phase 2B -- Update HTML** in `ui/control_panel.html`: replace `#background-agents` body (563-697) with sunset card. **Preserve Server Sync card (701-748) for relocation in Phase 3.** Update sidebar nav-item label/icon.
6. **Phase 2C -- Showcase sunset mirror**: `home-page.component.html:59-63`, both dashboards. Comment `dashboard.js` and `dashboard-page.component.ts` agent blocks. **Preserve `ext:remote-control-state` and `_lz` paths.**

### Phase 3 -- Sync Tab Build (depends on Phase 2B)

7. **Phase 3A -- Add Sync nav-item + section** to `ui/control_panel.html`. **Move** Server Sync card (formerly 701-748) and pairingQROverlay block (727-739) into new section. IDs unchanged.
8. **Phase 3B -- Add `initializeSyncSection()`** in `ui/options.js`. Re-wire btnGenerate/btnCopy/btnTest/btnPair/btnCancelPair. Extend `switchSection` monkey-patch with `sync` case calling `refreshRemoteControlState()`.
9. **Phase 3C -- Remote-control state push**: in `_broadcastRemoteControlState`, also `chrome.runtime.sendMessage({action:'remoteControlStateChanged', state}).catch(...)`. New `case 'getRemoteControlState'` in `background.js` returns `_lastRemoteControlState`. New `chrome.runtime.onMessage` listener in `options.js` for live updates.
10. **Phase 3D -- Showcase Sync surface copy**: home-page Remote Dashboard card mention new Sync tab. QR-pairing copy: "Open the Sync tab in FSB."

### Parallelism opportunities

- Phase 1A, 1B, 1C run in parallel (different modules)
- Phase 2A, 2B, 2C run in parallel (different layers)
- Phase 3A and 3B = single atomic commit (co-dependent IDs + handlers)
- Phase 3C and 3D in parallel (extension <-> showcase)

### Critical sequencing

- Phase 3 MUST follow Phase 2B (Server Sync relocation requires source location commented out)
- Phase 1A does NOT block any other phase (purely additive)
- Phase 1C MUST NOT change `ext:dom-mutations` payload shape -- dashboard at `dashboard-page.component.ts:3386` and `dashboard.js:3811` consume it. Stale counter additions must be in NEW field (e.g. `staleFlushCount` in `ext:stream-state`)

### Per-area integration risks

| Area | Risk | Mitigation |
|------|------|------------|
| Sync tab | Extension just opened: state broadcast fires before options.js attaches listener -> stale "Disconnected" UX | Sync tab activation MUST pull last state via new `getRemoteControlState` action (replay-on-attach pattern) |
| Agent sunset | `chrome.alarms.onAlarm` listener guards MCP reconnect alarms on same dispatch | Preserve `if (isMcpReconnectAlarm) {...}` early-return at `background.js:12533-12540`. Regression test: fire `MCP_RECONNECT_ALARM`, assert routes to `armMcpBridge` |
| Agent sunset | `_handleAgentRunNow` references `activeSessions` (shared) and `startAgentRunNow` (commented) | When commenting `_handleAgentRunNow`, also comment `case 'dash:agent-run-now'` to avoid runtime ReferenceError. Better: respond with `ext:agent-run-complete {error:'agents-retired'}` |
| DOM streaming | New watchdog double-flushing if rAF lands at same tick | Watchdog must cancel rAF before flush; `flushMutations` stays idempotent on empty (line 639) |
| WebSocket | `LZString` may have failed to load | Decompression guards `typeof LZString !== 'undefined'`, emits `recordFSBTransportFailure('decompress-unavailable', ...)` |
| Diagnostic logging | Replacing silent catches with `console.warn` could swamp dev console (extension context invalidation is benign + frequent) | Use `automationLogger.debug` for in-extension paths; reserve `console.warn` for paths where caller would not retry. Lifecycle.js SPA-navigation catches (462/472/480) -> `automationLogger.debug` |
| Showcase mirror | Removing `dash-new-agent-btn` HTML while leaving JS handlers causes silent no-ops | Comment HTML AND JS handlers in same commit per surface |

---

## Open Questions for Roadmapper

- "Stale counter reset path" requirement in PROJECT.md is ambiguous: (a) reset on successful flush, (b) reset on stream-state-change, or (c) both. Roadmapper should clarify with user before Phase 1C planning.
- `mcp-server/src/tools/visual-session.ts.bak-openclaw-crab` exists -- possibly prior aborted sunset attempt. One-line check during Phase 2A: safe to leave or remove?
- The `_lz` envelope contract is undocumented. Phase 1A should add code comment at `ws/ws-client.js:580` to spec the envelope shape.
