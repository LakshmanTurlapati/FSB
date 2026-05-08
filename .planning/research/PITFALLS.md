# Pitfalls Research

**Domain:** Adding multi-agent tab ownership and concurrency to FSB (a Chrome MV3 extension originally designed single-agent), with an MCP server (`fsb-mcp-server@0.8.0`) brokering external clients, a hard concurrency cap of 8, forced-new-tab pooling, and a new `back` tool. Layered on top of the v0.9.36 visual-session contract (`McpVisualSessionManager`) and the existing single-agent autopilot (`activeSessions`, `agent-loop.js`).
**Researched:** 2026-05-05
**Confidence:** HIGH for MV3 service-worker lifecycle pitfalls, `chrome.tabs.onRemoved` race conditions, JS single-threaded TOCTOU semantics, and v0.9.36 integration risk (verified against `extension/utils/mcp-visual-session.js` and `extension/background.js` `onRemoved` handlers). HIGH for `chrome.tabs.create` empty-history behavior on the new `back` tool. MEDIUM for background-tab throttling specifics (Chrome's heuristics evolve; verified against current Chromium docs for timer throttling and IntersectionObserver gating). MEDIUM for MCP transport reconnection semantics (depends on which transport `fsb-mcp-server` advertises; current implementation uses stdio + WebSocket bridge with a 300s timeout in `extension/ws/mcp-bridge-client.js:680`).

**Code anchors verified:**
- `extension/utils/mcp-visual-session.js` -- `_sessionsByToken` and `_tokenByTabId` are in-memory Maps; restoration happens via `restoreSession` from `chrome.storage.session` records (v0.9.36 contract).
- `extension/background.js:2455` and `:12616` -- two separate `chrome.tabs.onRemoved` listeners (one for content-script port cleanup, one for `keyboardEmulator` debugger detach). No agent registry cleanup exists yet.
- `extension/ws/mcp-bridge-client.js:680` -- `setTimeout(..., 300000)` hardcoded run_task ceiling that Phase 236 must address.
- `mcp/src/tools/autopilot.ts:58` -- mirror of the 300s ceiling on the MCP server side via `bridge.sendAndWait({ timeout: 300_000, onProgress })`.
- `extension/ws/mcp-tool-dispatcher.js:326` -- `chrome.tabs.goBack(targetTabId)` already exists for autopilot; the new MCP `back` tool needs to wrap this with ownership + history-empty handling.

---

## Critical Pitfalls

### Pitfall 1: Agent registry held only in memory dies with the MV3 service worker

**What goes wrong:**
The natural first cut of the multi-agent registry is a JavaScript `Map<agentId, AgentRecord>` and a `Map<tabId, agentId>` reverse index living in `background.js` module scope -- exactly mirroring the existing `McpVisualSessionManager._sessionsByToken` / `_tokenByTabId` pair. MV3 service workers are evicted aggressively (Chrome targets 30s of idle, hard cap of 5 minutes for any single SW activation, and any unhandled-promise pending `await` does **not** keep the worker alive). When the SW is suspended and re-spawned, both Maps are empty. Subsequent `mcp:request_tab` or progress messages from a still-alive MCP client land in the new SW with no record of which agent owns which tab. The system either:
1. Rejects every reconnecting agent's claim ("unknown agent") even though their tab is still open and the user is mid-task, or
2. Silently re-allocates a fresh agent slot, leaking the original's tab into "orphaned but locked" state where the cap counter still excludes it.

The second failure mode is the more dangerous one because it corrupts the cap accounting (`8 agents` becomes `4 ghosts + 4 live` and the 9th request is denied for no visible reason).

**Why it happens:**
Single-agent FSB has been able to lean on `chrome.storage.session` (v0.9.36) and `chrome.storage.local` (`activeSessions`, `bgSessions`) as fallbacks because there's exactly one canonical session at a time. Multi-agent introduces N records with referential integrity (an agent record references tab IDs; a tab record references an agent ID), and that referential integrity must survive eviction. Developers porting single-agent patterns assume "we'll reload state on next message" is enough -- it's not, because messages arriving during the rehydration window can be processed with a partially-populated registry.

**How to avoid:**
- Treat the agent registry as **persisted by default, in-memory cached**. Source of truth = `chrome.storage.session` (cleared on browser shutdown, survives SW eviction); cache = module-scope `Map`. Every mutation writes to storage **before** returning success to the caller; every read goes through a single `loadRegistry()` helper that lazy-rehydrates on first access after eviction.
- Use `chrome.storage.session` (not `local`) so a browser restart does not resurrect agents whose tabs were closed during shutdown. Single-source-of-truth in `local` is a trap: stale agent records survive Chrome restarts and bind tab IDs from a previous session.
- Add an `extension/utils/agent-registry.js` module mirroring the shape of `mcp-visual-session.js`: serializable record format, `toJSON` / `fromJSON`, and a `rehydrate(records)` method that asserts the cap (drop ghost records whose `tabId` no longer resolves via `chrome.tabs.get`).
- On every SW wake (`chrome.runtime.onStartup`, first message after silence), run a **reconciliation pass**: for each persisted agent record, call `chrome.tabs.get(tabId)` -- if it rejects with "No tab with id", drop the record and decrement the cap counter. Do this **before** servicing any new agent request.
- Document the invariant: "cap counter = number of registry records whose `tabId` resolves to a live tab, computed at every cap-affecting operation, never cached as a number."

**Warning signs:**
- "Cap reached" errors at 4-7 active agents instead of 8.
- After a long Chrome idle window followed by activity, the same agent gets two different `agent_id` values across messages.
- `chrome.storage.session.get('fsb_agent_registry')` returns records whose `tabId` is no longer in `chrome.tabs.query({})`.
- Sidepanel shows "no active agents" but `chrome.storage.session` has 3 records.

**Phase to address:**
**Phase: Agent Registry Foundation** -- must land before any tab ownership / cap enforcement / MCP wiring. Modeled on `McpVisualSessionManager` shape but persisted to `chrome.storage.session`. Includes the reconciliation pass and a unit test covering a simulated SW eviction + wake.

---

### Pitfall 2: `chrome.tabs.onRemoved` fires after action dispatch -- the race window

**What goes wrong:**
The existing single-agent code has a gentle race: a tab closes mid-action and `onRemoved` cleans up `contentScriptPorts.delete(tabId)` (background.js:2456) *after* the next agent action has already been dispatched via `chrome.tabs.sendMessage`. In single-agent mode the failure is loud and recoverable -- the message rejects with `Error: The tab was closed` and the agent loop's exit-path handlers (Phase 206) finalize cleanly. In multi-agent mode the same race becomes a **cross-agent corruption** vector:
1. Agent A owns tab T1. User closes T1.
2. `onRemoved` is queued but not yet fired.
3. Agent A dispatches `click` to T1; the dispatch enters the MV3 message queue.
4. `onRemoved` fires; the registry releases T1 and decrements the cap from 8 to 7.
5. Agent B's pending "open new tab" request was waiting on the cap; it now succeeds and `chrome.tabs.create` returns -- with the **same numeric `tabId`** as the freshly-closed T1 (Chromium does reuse tab IDs within a session, especially under high churn).
6. Agent A's queued `click` message resolves against B's brand-new tab. B's task is corrupted by an action it never asked for.

This is the canonical TOCTOU bug for tab-bound concurrency. It's not theoretical -- Chromium's tab-id reuse behavior is documented as "do not rely on tab IDs being unique across the session" and the MV3 message-passing model offers no atomic "send-if-still-owned" primitive.

**Why it happens:**
Tab IDs are 32-bit integers allocated by Chromium and are **not guaranteed unique across a browser session**. The single-agent code didn't notice because there was only one agent, so a closed-then-reused tab ID just meant the agent saw a "fresh" page and recovered. Multi-agent breaks the assumption catastrophically.

**How to avoid:**
- **Never address an action by `tabId` alone.** Every action dispatch carries an `(agentId, tabId, ownershipToken)` triple. The `ownershipToken` is a UUID minted at tab-claim time and stored in the registry. The dispatch path -- `mcp-tool-dispatcher.js` and `tool-executor.js` -- verifies, inside the same synchronous JS turn, that the registry still maps `tabId -> agentId` *and* the stored token equals the dispatch's token. Mismatch = abort with "ownership lost" error before sending the message.
- Hold the registry check + message dispatch in the **same microtask** (i.e., synchronous code path, no `await` between check and `chrome.tabs.sendMessage`). JavaScript's single-threaded execution makes this a real atomic guard; a pending `await` would invalidate it.
- In the `onRemoved` listener, set a tombstone (`agentRegistry.markTabClosed(tabId, closedAt)`) *before* deleting the record. The reconciliation guard checks the tombstone too, so an in-flight action that just barely missed the deletion still aborts when it sees `closedAt !== null`.
- Treat tab-ID reuse as expected, not exceptional. When `chrome.tabs.create` returns a `tabId` that exists in the tombstone map, increment a generation counter on that tab record so old ownership tokens cannot match.
- Don't bet on "tab IDs are unique within a window" or any folklore. The only safe contract is the ownership token.

**Warning signs:**
- Logs show actions executing on a tab whose `agentId` in the registry differs from the dispatch's `agentId`.
- A user reports "I had two tasks running and one of them suddenly typed into the other tab."
- Test harness that opens/closes tabs in a tight loop produces non-deterministic test failures.
- `chrome.tabs.sendMessage` errors with "no tab with that id" alternate with successes for the same logical action.

**Phase to address:**
**Phase: Tab Ownership & Token Enforcement** -- defines the `(agentId, tabId, ownershipToken)` triple and threads it through `mcp-tool-dispatcher.js`, `tool-executor.js`, `agent-loop.js`. Must include a regression test that simulates `onRemoved` firing between dispatch decision and message send.

---

### Pitfall 3: `onRemoved` cleanup on a pooled tab releases its sibling, or fails to

**What goes wrong:**
Forced-new-tab pooling says: if agent A owns tab T1 and opens T2, both pool under A and stay locked together. The "stay locked together" invariant has two opposite failure modes that are both wrong:

1. **Over-release.** User closes T1 manually. A naive implementation interprets "T1 closed" as "agent A's task ended" and releases T2 too -- yanking the agent's working tab out from under it. From the user's perspective: "I just closed an old tab and FSB stopped my running task on a different tab."
2. **Under-release.** Same scenario, but the implementation only shrinks the pool and keeps T2 owned. User then closes T2 too. A buggy `onRemoved` sees "T2 was the last tab in pool A; release agent A" but the previous T1-close handler had already decremented `pool.size` without removing T2 from the index, so the cap counter is now off by one and the slot leaks.

Compounding this: the order of `onRemoved` events is not guaranteed when a window with multiple tabs is closed at once. Chromium fires them in tab-index order on most platforms, but extensions get them via the message queue where ordering relative to other in-flight messages is undefined.

**Why it happens:**
Pool semantics are easy to write down ("two tabs, one owner") and easy to implement wrong because the mental model conflates "user closed a tab" with "agent finished using a tab." The first is a *user signal* (they didn't want that tab anymore); the second is a *task signal* (the agent is done). Locks should release on task signals, not user signals.

**How to avoid:**
- Define the invariant explicitly: **closing one tab in a pool shrinks the pool, never releases the agent**. The agent only releases when (a) all tabs in its pool are closed, (b) the task ends normally, (c) the MCP client disconnects, or (d) safety/cap enforcement forcibly evicts it.
- Represent the pool as `Set<tabId>` per agent record; `onRemoved` calls `pool.delete(tabId)` and only triggers full release when `pool.size === 0`.
- Never compute pool size by counting events; always read `pool.size` from the persisted record after the `delete` returns.
- Order-independence: `onRemoved` handlers must be idempotent and commutative. Test with a fixture that closes T1 and T2 in both orders and asserts identical end-state.
- For window-close events (`chrome.windows.onRemoved`), iterate the registry's pools and remove each contained tab one at a time through the same code path -- don't add a separate "window closed -> release whole agent" shortcut, because that bypasses the pool-shrink invariant and may leak locks.

**Warning signs:**
- "Cap reached" on the 5th agent when the user only sees 3 visible tabs (leaked pool slots).
- Sidepanel shows agent A as "running" but its highlighted tab is gone.
- Closing tabs in different orders produces different cap counters.
- Tests fail intermittently when run with `--randomize`.

**Phase to address:**
**Phase: Forced-New-Tab Pooling** -- lock release semantics, idempotent `onRemoved`, pool-shrink-vs-release distinction. Includes a fixture-based test harness that exercises every closure ordering.

---

### Pitfall 4: Cross-window / cross-profile / incognito invariant violations

**What goes wrong:**
The plan implicitly assumes all tabs live in the user's normal profile and a single window. Reality:
1. **Incognito tabs:** `chrome.tabs.create({ url, ... })` from a non-incognito-allowed extension throws. If allowed, an agent in a non-incognito context that opens a tab in an incognito window may encounter sealed message channels -- content scripts injected from a "regular" extension instance can't reach incognito tabs unless the extension is allowed in incognito explicitly. Worse, two extension instances exist when "split" incognito mode is used: a regular instance and an incognito instance, with separate service workers and **separate registries**. An agent opened in the regular instance has no view of incognito tabs and vice versa -- but a single MCP client may issue requests that touch both.
2. **Cross-profile:** Chrome profiles have entirely separate extension instances; cross-profile is not a concern *for the extension* but is a concern if the MCP client is configured to connect to "the user's Chrome" without specifying which profile. The MCP server bridges into one extension instance and silently ignores the other.
3. **Cross-window:** Same profile, different window. Tab IDs are unique across windows in the same profile, so the registry works -- *but* the dashboard's live-preview surface, the `chrome.windows.onFocusChanged` listener, and any "active tab" heuristics implicitly assume one window. A second-window agent may still automate correctly but the user has no UI affordance to see it.
4. **Detached tabs:** `chrome.tabs.move` or user drag-out creates a new window with the same `tabId`; `onAttached`/`onDetached` events fire. If the registry indexes by `(windowId, tabId)` instead of `tabId` alone, drag-out breaks ownership.

**Why it happens:**
Chrome's profile/incognito/window model is genuinely complex and the MV3 docs treat "incognito split" as an advanced topic. Default behavior favors regular-profile-only and developers ship before testing incognito.

**How to avoid:**
- **Explicitly opt out of incognito for v0.9.60.** In `manifest.json`, set `"incognito": "not_allowed"` (or leave the default `"spanning"` and reject any request whose target tab is in an incognito window via `chrome.tabs.get(...).incognito === true`). Document the limitation in the `back`/`run_task` tool descriptions and in the milestone REQUIREMENTS.
- Index the registry by `tabId` only (Chrome guarantees uniqueness within a single profile/extension instance). Window ID is metadata, not an ownership key. `onAttached`/`onDetached` updates the metadata field but not the lock.
- For cross-window: dashboard preview chooses one tab to mirror (see Pitfall 8); other agents' tabs are accessible via the sidepanel's agent list but not live-previewed in v0.9.60.
- Reject `mcp:request_tab` if the caller passes an incognito tab ID with a clear error code (`"incognito_unsupported"`) so the MCP client can surface it to the model.
- Test fixture: open a window, drag out a tab to a new window, verify the agent's lock and pool composition are unchanged.

**Warning signs:**
- `chrome.tabs.sendMessage` fails silently on tabs that exist but are unreachable (incognito with extension not allowed).
- Two extension instances logging to two separate consoles, both claiming to own the same logical agent ID.
- User opens incognito, runs an MCP task, sees no glow and no error.
- Agent ownership changes after a tab is dragged into a new window.

**Phase to address:**
**Phase: Tab Ownership & Token Enforcement** -- explicit incognito opt-out check at the dispatch boundary; `manifest.json` audit; documented limitation in REQUIREMENTS. A small dedicated phase or sub-section, not its own milestone phase.

---

### Pitfall 5: MCP client disconnect/reconnect race against lock release

**What goes wrong:**
Specification says: "Lock release on task/session ends, MCP client disconnects, user closes the tab (no idle timeout)." This is correct policy but invites a race:
1. Network blip causes the MCP client to drop its WebSocket / stdio bridge to the extension.
2. Disconnect handler in `mcp-bridge-client.js` releases all locks held by that client (decrements cap by N).
3. Within 2-5 seconds the MCP client reconnects (stdio transports auto-reconnect; the FSB bridge does too).
4. The reconnected client expects its agents to still exist -- it has in-memory state about agentIds, pending `run_task` promises, etc.
5. The extension says "no such agent" because the disconnect already released everything. The model retries by spawning new agents, which may now race against fresh user actions on the abandoned tabs (cap counter is fine, but the user has live tabs that "belonged" to no one for 3 seconds and may have been touched).

The opposite policy (don't release on disconnect, wait for explicit "end_task" or timeout) has the failure mode that a crashed MCP client leaks all 8 slots permanently, locking the user out until they reload the extension.

**Why it happens:**
"Disconnect" is ambiguous: at the transport layer (WebSocket close, stdio EOF) it's a momentary event that may or may not signal client-state loss. At the application layer (the model decided to stop) it's a final event. Conflating them yields one of the two failure modes above.

**How to avoid:**
- Distinguish **transport disconnect** (TCP/WS/stdio gone) from **session disconnect** (client formally ended). Add a **grace window** of 10-15 seconds: on transport drop, mark the client's agents as `provisionally_released` (locks held, cap counter unchanged, no new actions accepted). If the client reconnects within the grace window with the same `client_id` (derived from v0.9.36 trusted-client allowlist or a connection-level token), restore the agents. If the grace expires, fully release.
- On reconnect, the MCP client must re-introduce itself with both `client_label` and a stable `connection_id` (the server can mint a session UUID at first connect; client persists it for the duration of its process). Without `connection_id`, treat as a fresh client and don't restore.
- During the grace window, *user* actions on the agent's tab are allowed (it's the user's browser); the lock just prevents *other agents* from claiming the tab.
- Make the grace window configurable but small; document the tradeoff (longer = more reconnect tolerance but slower cap recovery from real client crashes).
- The 300s `setTimeout` ceiling in `mcp-bridge-client.js:680` does NOT serve as the grace window -- that's a per-task timeout, separate concern. Add a dedicated `RECONNECT_GRACE_MS` constant.

**Warning signs:**
- Logs show "agent released" followed by "unknown agent" within 5 seconds, repeatedly.
- MCP client retries `run_task` and gets a different `agent_id` than the one it started with for what the user perceives as the same task.
- Cap counter ratchets up without reaching 8 because crashed clients don't release.
- User reports "I closed Claude and FSB still says 8 agents are running."

**Phase to address:**
**Phase: MCP Lifecycle & Reconnect Grace** -- defines the grace window, the `connection_id` protocol, the disconnect/reconnect handlers, and the interaction with v0.9.36 trusted-client labels. Wires into both `mcp-bridge-client.js` (extension side) and `mcp/src/runtime.ts` / `mcp/src/tools/visual-session.ts` (server side).

---

### Pitfall 6: Cap enforcement TOCTOU -- check-then-allocate races

**What goes wrong:**
Naive cap check:
```javascript
async function claimSlot(agent) {
  const count = await registry.count();
  if (count >= 8) throw new Error('cap_reached');
  await registry.add(agent);  // [*]
}
```
Even though JS is single-threaded, every `await` yields the event loop. Two concurrent `claimSlot` calls can each see `count === 7`, both pass the check, both add, and now `count === 9`. The single-thread assumption helps *only* between explicit `await` points.

In FSB the worse instance is during SW wake when several queued `mcp:claim_agent` messages are drained from the message queue in rapid succession, each with their own `await registry.load()` from `chrome.storage.session` (which is asynchronous).

**Why it happens:**
The atomic primitive (`Atomics`, `Mutex`) is absent in service workers. `chrome.storage.session` operations are async and don't expose CAS. Developers default to "JavaScript is single-threaded so it's fine" without realizing the granularity is per-microtask, not per-async-function.

**How to avoid:**
- Implement the cap check + allocation as a **single synchronous critical section** that runs against the in-memory registry (which is already loaded). Persist to storage as a *post-success* side effect. The synchronous critical section is naturally atomic.
- Serialize cap-affecting operations through a **promise-chained queue** (single-slot mutex pattern):
  ```javascript
  let registryMutex = Promise.resolve();
  function withRegistryLock(fn) {
    const next = registryMutex.then(() => fn()).catch((e) => { throw e; });
    registryMutex = next.catch(() => {});
    return next;
  }
  ```
  All claim/release/reconcile operations go through `withRegistryLock`. This serializes them deterministically and removes the TOCTOU window.
- Persist with optimistic concurrency: include a registry-level version counter in `chrome.storage.session`; if a write reads version N and another microtask wrote N+1 in between, retry the operation. This is belt-and-suspenders for the SW wake scenario where the in-memory cache might be stale.
- Never use the cap counter as a cached number. Always compute `registry.size` from the live in-memory record set inside the critical section.

**Warning signs:**
- Stress test with 20 concurrent `mcp:claim_agent` requests succeeds 9 or 10 of them instead of capping at 8.
- Logs show `count: 7` followed by `count: 8` followed by `count: 9` in successive log lines.
- Cap appears to "drift" upward across long sessions.

**Phase to address:**
**Phase: Concurrency Cap & Mutex** -- the `withRegistryLock` helper, the version counter, and a stress test. Co-located with the registry phase but distinct because the policy (cap = 8, behavior on exceed) is its own concern.

---

### Pitfall 7: Background-tab automation -- throttled timers, rAF, IntersectionObserver, focus-dependent inputs

**What goes wrong:**
The milestone explicitly requires no foregrounding ("Background-tab execution: no requirement that the owned tab be active/foregrounded"). Chromium aggressively throttles background tabs in ways that affect FSB's content scripts:
1. **Timer throttling.** `setTimeout`/`setInterval` callbacks in background tabs are throttled to a minimum interval (currently 1s after 5 minutes background, or sooner under "intensive throttling" if the page hasn't sent network traffic recently). FSB's `waitForDOMStable`, completion detection, and any code path with retry-after-N-ms loops may stall.
2. **`requestAnimationFrame` paused.** Background tabs do not invoke `rAF` callbacks at all. Any FSB code (visual-feedback overlay, scroll observers) that uses rAF will silently never fire. The orange-glow highlight overlay in particular is rAF-driven for the pulse animation.
3. **IntersectionObserver gated.** `IntersectionObserver` callbacks are deferred or coalesced when the tab is occluded. FSB's viewport-aware click logic that waits for an element to be visible may hang.
4. **Focus-dependent inputs.** Many sites' search boxes, autocomplete dropdowns, and file inputs require `document.hasFocus() === true`. Typing into a background tab that doesn't have focus may emit the keystrokes but the page won't react (no autocomplete suggestions appear, blur-triggered submit doesn't fire). Sites using `:focus-visible` selectors may skip key handlers entirely.
5. **CDP differs.** Chrome DevTools Protocol commands (used by FSB's `cdpClickAt`, keyboard emulator) bypass *most* of the throttling because they target the renderer directly, but `Input.dispatchKeyEvent` still requires the page to be active for some focus-dependent cases. Mixing high-level (`chrome.tabs.sendMessage` -> content script) and low-level (CDP) execution paths in a background tab gives heterogeneous reliability.

**Why it happens:**
Chrome's throttling is a power-management feature, ramped up in 2021-2024 ("intensive throttling," "battery saver"). The behavior changes silently across Chrome versions; what worked in Chrome 112 may stall in Chrome 124. Single-agent FSB always operated on the active tab so no one tested the matrix.

**How to avoid:**
- **Document and enforce: "owned" does not mean "foregrounded."** Tabs work in the background but with caveats. List which actions require foregrounded tabs (focus-dependent inputs, file pickers, certain dropdown widgets) and have those actions auto-foreground the tab via `chrome.tabs.update(tabId, { active: true })` before dispatch -- *only* if the agent's lock permits it (which it does, the agent owns the tab).
- For multi-agent: foregrounding A's tab steals focus from B. Mitigate by deferring foreground-required actions until the agent is "leading" (current foreground), or by serializing focus-required actions across all agents so only one steals focus at a time.
- Replace `setTimeout`-based waits with `chrome.alarms` (which is not throttled) for any wait > 1s. Use `chrome.alarms.create(..., { delayInMinutes: ... })` -- minimum 30s in MV3 but suitable for long waits. For shorter waits, accept that throttled background timers add jitter and design completion detection to be event-driven, not time-driven.
- For rAF-driven UI in content scripts running in background tabs: use `requestIdleCallback` with a max timeout, or fall back to `setTimeout(0)` when `document.visibilityState === 'hidden'`.
- Prefer CDP for input dispatch when the tab is not active. The keyboard emulator (`extension/background.js:12616`) is already attached per-tab; ensure it survives non-active tabs.
- Test matrix: each tool against a background, foreground, and minimized-window tab. Mark tools that require foreground in the tool definition (`tool-definitions.cjs`).

**Warning signs:**
- Tasks succeed when run as the only agent and fail randomly when running 2+ agents.
- `waitForDOMStable` reports "stable" prematurely on a backgrounded tab (the throttled timer fired before the page had time to mutate).
- Search boxes accept typed text but show no autocomplete; the form doesn't submit.
- The orange-glow overlay never animates on background tabs.

**Phase to address:**
**Phase: Background-Tab Execution & Throttling Mitigation** -- a dedicated sub-phase under tool execution that audits each tool for foreground dependence, swaps long timers for `chrome.alarms`, and documents the tradeoffs. Includes a per-tool "foreground required" flag in `tool-definitions.cjs`.

---

### Pitfall 8: Dashboard live-preview surface picks the wrong agent (or all of them)

**What goes wrong:**
The v0.9.36 / v0.9.45rc1 dashboard live-preview / DOM-streaming surface assumes a single canonical "the active task" and streams its DOM via `extension/content/dom-stream.js`. With N agents:
1. **Naive: stream them all.** Each agent's tab streams concurrently to the dashboard, multiplying outbound WebSocket traffic by N (already bandwidth-heavy on large DOMs, see Phase 211 truncation work). Cold tabs may starve.
2. **Naive: stream the most-recent.** A "recency wins" picker oscillates as agents take turns acting; the preview flickers between tabs.
3. **Naive: stream the user's active tab.** Defeats the purpose of background-tab automation -- the user can't watch agent C's tab without losing the preview when they switch.
4. **Naive: stream none until user picks.** Regression vs single-agent UX where preview "just works."

Plus: the v0.9.36 visual session contract assumes one owner per tab. If the dashboard preview itself counts as a "viewer," multi-agent doesn't break it -- but if a future feature lets the dashboard send remote-control commands (Phase 209), those commands need to pick a target tab unambiguously.

**Why it happens:**
The dashboard was designed for a 1:1 map of "user :: their FSB :: one tab." Multi-agent breaks the cardinality and there's no UX precedent in the product to fall back on.

**How to avoid:**
- **Declare DOM-stream multi-agent OUT OF SCOPE for v0.9.60.** Stream the most-recently-acted-upon owned tab (the "leading agent's" tab). Show a sidepanel list of all active agents with click-to-switch-preview, but only one stream at a time. Phase 212 LZ-decompression and watchdog guarantees still hold.
- Document explicitly that "multi-agent live preview" is a deferred follow-up; reference Phase 211/212 work as the foundation a future milestone will extend.
- If a user has the dashboard open and starts a second agent, surface a non-blocking notice ("Agent B started on tab X -- click to preview") rather than auto-switching mid-preview.
- For remote-control (Phase 209 CDP routing), require an explicit `agent_id` on every dashboard command; reject "untargeted" commands when N > 1.
- Verify the existing `staleFlushCount` field on `ext:stream-state` (Phase 211) still rolls up correctly when the streamed tab switches; add a regression test.

**Warning signs:**
- Dashboard preview oscillates between two tabs every few seconds.
- WebSocket throughput >2x baseline for the same workload.
- Remote-control click lands on the wrong agent's tab (silent corruption).
- Phase 211 watchdog fires more often under multi-agent.

**Phase to address:**
**Phase: Dashboard Multi-Agent Surface (v0.9.60 minimal)** -- agent list in sidepanel, single-tab preview, click-to-switch, explicit `agent_id` on remote-control commands, deferred-feature documentation. Small scope, clear cutoff.

---

### Pitfall 9: `back` tool on a chrome.tabs.create-opened tab has empty history -- silent no-op or hard error?

**What goes wrong:**
A tab opened via `chrome.tabs.create({ url: 'https://example.com' })` has a session history of length 1 (just the destination). `chrome.tabs.goBack(tabId)` (already used in `extension/ws/mcp-tool-dispatcher.js:326` for autopilot) on such a tab:
- In Chromium current behavior: rejects the promise with `Error: Cannot find a next page in history.` (since the API uses promises) or invokes the callback with `chrome.runtime.lastError`.
- Older Chromium (pre-118 ish) in some configurations silently no-op'd.

For a new MCP `back` tool, choosing the wrong contract corrupts model behavior:
1. **Silent no-op:** the model thinks "back" succeeded and reasons about a previous page that was never visited. Subsequent actions target the wrong DOM.
2. **Hard error:** the model gets a thrown error and may loop trying to back up further, never realizing the tab was opened fresh. Or it abandons the task with a confusing error.
3. **bf-cache surprises:** even when history exists, `goBack` may navigate to a bf-cached version of the prior page where event listeners are detached / replaced. FSB v0.9.11 already handles bf-cache resilience for click via content-script re-injection; the `back` tool needs the same treatment.
4. **Cross-origin back:** if the prior history entry is a different origin, content scripts injected for the current origin are gone after the back; the agent's next "read DOM" call lands on an uninjected page. Agent-loop must re-inject.
5. **Within-page anchor history:** `goBack` from `https://x/page#section2` to `https://x/page#section1` doesn't reload, doesn't refire `pageshow`, and the agent's mental model of "we navigated" is wrong.

**Why it happens:**
Browser history is one of those primitives that "works fine" until it doesn't, and `chrome.tabs.create` produces pristine-history tabs that don't match a normal-navigation user's mental model. Models trained on web-browsing assume "back goes back" without modeling the empty-history case.

**How to avoid:**
- The MCP `back` tool returns a structured result: `{ status: 'ok' | 'no_history' | 'cross_origin' | 'bf_cache' | 'fragment_only', resultingUrl, historyDepth }`. Models can branch on the status; humans can read it in logs.
- Implementation: before calling `chrome.tabs.goBack`, query the current tab's history depth via `chrome.scripting.executeScript({ target, func: () => history.length })`. If `length <= 1`, return `no_history` immediately without invoking `goBack`. (Note: `history.length` includes forward entries too; but for a fresh `chrome.tabs.create` tab it's 1.)
- After `goBack` succeeds, compare the new URL's origin to the pre-back URL's origin; if different, mark `cross_origin` and trigger content-script re-injection through the existing v0.9.11 BF-cache resilience path.
- Document the contract in the tool description: "Returns no_history without error if the tab has no prior page (e.g., the agent opened it via navigate)."
- Add a warning to the model in the prompt: "After `back`, verify the resulting URL before acting."
- Wrap `chrome.tabs.goBack` with a `pageshow`-listener-based "did the page actually change" check (with a 2s timeout). If no `pageshow` fired and URL is unchanged, classify as `fragment_only` or `no_history`.

**Warning signs:**
- Logs show `back` returning success on a tab whose URL didn't change.
- Agent loops "back, back, back" on a freshly-opened tab.
- After `back`, `mcp:get_dom` returns an error about no content script.
- Cross-origin navigation produces stale element selectors.

**Phase to address:**
**Phase: `back` Tool Implementation** -- structured result codes, history-depth precheck, cross-origin re-injection, prompt updates. Co-locate with tool-definitions update.

---

### Pitfall 10: Phase 236 `run_task` return-on-completion -- long-poll timeout under MCP transports

**What goes wrong:**
Current state (verified): `extension/ws/mcp-bridge-client.js:680` has `setTimeout(..., 300000)` and `mcp/src/tools/autopilot.ts:58` has `bridge.sendAndWait({ timeout: 300_000, onProgress })`. Phase 236 wants `run_task` to return on actual task completion instead of hitting the 300s ceiling. Several traps:
1. **Client-side timeout.** MCP host clients (Claude Code, Cursor, Codex, OpenClaw) impose their own per-tool timeouts -- typically 30s to 5min, not configurable for tool calls. Even if FSB's MCP server holds the response open for 30 minutes, the client may abort and re-issue. The model then sees "tool failed" and may launch another task, creating duplicate work and possibly two agents trying to claim the same tab.
2. **stdio buffer pressure.** stdio MCP transport buffers progress messages. If the task runs 30 minutes and emits a progress message every action (potentially hundreds), the buffer can pressurize the host process, causing the OS to throttle stdout writes. The extension never sees the back-pressure but the host may stall.
3. **WebSocket keepalive.** WS transports between MCP client and `fsb-mcp-server` rely on idle-detection; long-running tasks with sparse progress may trip server-side proxies (especially in cloud-relay scenarios) that close idle connections at 60s/120s.
4. **Network hiccup mid-task.** Same as Pitfall 5 but for the per-task channel: the client reconnects, the new `run_task` call expects to find an existing task. If the protocol doesn't expose "resume_task" / "subscribe_to_task," the model launches a fresh duplicate.
5. **MV3 SW eviction during long task.** A long-running task may span SW evictions if the agent loop is paused (waiting for a slow page load). The pending `run_task` promise in the SW dies with the SW. On wake, the registry rehydrates the agent but the `run_task` resolver is gone; the MCP client never gets a response.
6. **Premature 300s removal.** If Phase 236 simply removes the 300s timeout without adding heartbeats or resume support, a stuck task hangs the MCP client indefinitely.

**Why it happens:**
The 300s ceiling was a defensive bound that masked all the issues above. Removing it surfaces the underlying transport assumptions.

**How to avoid:**
- **Keep an outer timeout, but make it generous and configurable** (e.g., 30 minutes default, configurable per tool call via `taskTimeout` parameter). Document it as "task wall-clock limit, not transport timeout."
- **Heartbeat progress**: ensure progress messages flow at least every 30s even when the agent is in a long wait. The `_sendProgress` path in `mcp-bridge-client.js` already exists; add a heartbeat tick (`'phase: waiting'`) when no real progress arrives.
- **Persist task lifecycle** in `chrome.storage.session` keyed by `taskId`. On SW wake, the agent loop's auto-resumption path (Phase 159) can find pending tasks and resume; the MCP server side should persist the open `progressToken` -> `taskId` map similarly so it can re-bind on bridge reconnect.
- **Add a `subscribe_task(taskId)` MCP tool** that the model can call after a transport reconnect to resume listening. Phase 236 scope likely doesn't include this -- in which case document the limitation: "If the MCP transport drops mid-task, the task continues in the browser but the result will not be delivered to this client. Use `get_task_status` to poll."
- **Surface client-side timeout handling in tool description**: warn that some hosts cap tool calls at 5 minutes and recommend `taskTimeout` <= host's known cap.
- For stdio buffer pressure: throttle non-essential progress messages; coalesce duplicates; emit a summarized batch every N seconds rather than per-action under high-volume. Phase 211's diagnostic ring buffer is a good model.
- Cross-check that Phase 211's `staleFlushCount` and DOM-stream watchdog don't fire spurious failures during long quiet periods.

**Warning signs:**
- Tasks completing successfully in the browser but the MCP client reports timeout.
- Duplicate agents spawned for what should be a single task.
- Long tasks producing thousands of log lines in one burst (buffer flush).
- After SW eviction during a long task, `run_task` never returns.
- Models retrying `run_task` because they didn't see a response.

**Phase to address:**
**Phase: Phase 236 (`run_task` return-on-completion) + Long-Task Hardening** -- the configurable wall-clock timeout, heartbeats, persistence across SW wake, and documented client-cap limitations. This is the single biggest "easy to under-scope" risk in the milestone.

---

### Pitfall 11: Existing single-agent contracts silently regress when `agent_id` becomes implicit

**What goes wrong:**
Existing single-agent users (popup, sidepanel, autopilot via `chrome.runtime.sendMessage`) call `mcp:start-automation` and similar messages without any `agent_id` field. Two regression vectors:
1. **Implicit-default `agent_id`.** If the multi-agent code defaults missing `agent_id` to a synthetic "legacy" agent, that legacy agent inherits the cap-counted slot but cannot be addressed by tab ID from new code paths -- mixing implicit and explicit agents creates a silent two-tier system where the legacy agent occasionally loses races.
2. **Required `agent_id`.** If the new code rejects messages without `agent_id`, every popup click breaks until callers are updated. The popup, sidepanel, options dashboard, the v0.9.36 visual-session contract (which doesn't know about agents), the v0.9.45rc1 Sync tab, and `tests/mcp-visual-session-contract.test.js` all need updates.
3. **The v0.9.36 `McpVisualSessionManager` contract** (`extension/utils/mcp-visual-session.js`) is keyed by `(sessionToken, tabId)`, not agent. If an agent's tab also has a visual session, a release path that drops the agent must also end the visual session -- but only if no other agent or autopilot owns it. Ownership disambiguation between visual sessions and agent ownership is currently undefined.
4. **`activeSessions` (autopilot) state machine** assumes single owner; multi-agent introduces N parallel `activeSessions` whose lifecycles are independent. Phase 206 finalize-on-exit was written for the single case.
5. **CLI parser / agent loop invariants** (Phase 159) assume one agent loop running at a time; module state in `agent-loop.js` (e.g., the `HookPipeline` if singleton) may not be reentrant.

**Why it happens:**
The multi-agent feature is layered on a system where "the agent" was always implicit. Every place that referenced "the current agent" needs a parameterization, and missing one creates a regression.

**How to avoid:**
- **Audit pass before code changes**: enumerate every reference to `activeSessions`, `bgSessions`, `currentAgent`, `getActiveSession()`, `agentLoop` singletons, and the visual-session contract. Produce a checklist of touch points.
- **`agent_id` is required for all NEW code paths; legacy paths are wrapped.** The wrapper synthesizes a stable `agent_id = 'legacy:popup'` (or `'legacy:sidepanel'`, `'legacy:autopilot'`) for messages from in-extension UIs. This legacy agent is real (occupies a cap slot) but is administered by the extension itself; it auto-releases when the user navigates away or closes the surface.
- **Visual-session bridge**: when an agent claims a tab, also start a visual session via `McpVisualSessionManager.startSession` *if one isn't already running*. When the agent releases, end the visual session *only if its `clientLabel` came from the same MCP client* (to avoid stomping a session started by another contract). Track the `originator` field on visual sessions.
- **`activeSessions`** continues to mean "autopilot in-flight tasks." It is now *one of N* registries, not the canonical one. Multi-agent registry holds `agent_id -> activeSessionId?` link.
- **Reentrancy audit on `agent-loop.js`**: ensure module-scope state (rate limiters, caches, hook pipeline) is keyed by agent or instantiated per agent. Phase 159 docs imply a hook factory pattern -- verify this is per-agent.
- **Tests**: `tests/mcp-visual-session-contract.test.js`, `tests/mcp-tool-routing-contract.test.js`, `tests/mcp-in-flight-session-lookup.test.js`, `tests/mcp-recovery-messaging.test.js` must pass unchanged after the migration. Add multi-agent variants as new tests, not as modifications -- regression coverage is the safety net.

**Warning signs:**
- A popup-launched task fails with "agent_id required" error after the migration.
- Autopilot orange glow flickers off when an MCP client starts a parallel session.
- `activeSessions.size > 1` causes Phase 206 finalizer to mis-attribute outcomeDetails.
- Existing tests fail after the migration even though their assertions look correct.
- Visual-session orange-glow latches on a tab whose agent already released.

**Phase to address:**
**Phase: Single-Agent Compatibility & v0.9.36 Bridge** -- the audit, the legacy-wrapper synthesis, the visual-session bridge with `originator` field, the reentrancy audit on `agent-loop.js`, and the regression-test pass. This phase precedes any multi-client testing; if it slips, every later phase compounds the regression risk.

---

### Pitfall 12: User-vs-agent action collision on a "background" owned tab

**What goes wrong:**
"Owned" doesn't mean the user can't touch the tab. The user may switch to agent A's background tab, click around, navigate away, type into a search box, etc. With multiple agents this becomes likely (the user is curious what each agent is doing). Failure modes:
1. **User navigates the tab.** Agent's stored selectors are stale; the next action targets the wrong page.
2. **User types into a field the agent is about to type into.** Race produces interleaved characters.
3. **User closes a dialog the agent was about to dismiss.** Agent's "dismiss the dialog" action targets a non-existent element.
4. **User scrolls.** Agent's viewport-aware logic re-targets but logs the change as anomalous.
5. **User opens devtools.** Some debugger-protocol tools (`cdpClickAt`, keyboard emulator) collide with devtools also being attached.

In single-agent mode the user's mental model was "if I touch the tab, I'm cooperating with FSB." In multi-agent the user has *less* awareness of which tab is "active" and more incentive to check on background tabs.

**Why it happens:**
Multi-agent makes background-tab automation a first-class flow. The user no longer expects to leave the browser alone.

**How to avoid:**
- Treat user-initiated navigation (`chrome.webNavigation.onCommitted` with `transitionType !== 'auto_subframe'`) as a signal that the agent's page model is invalid. Reset the agent's DOM cache, pause the loop briefly, snapshot the new state, and continue (or fail-soft if the new URL is wildly off-task).
- Detect debugger collision: if `chrome.debugger.attach` fails with "Another debugger is already attached," surface a clear error and either wait or fall back to non-CDP tools.
- For typed input: the v0.9.4 stability detection already monitors DOM changes; extend it to detect "input value changed by an external source" (compare the value FSB just typed vs. the post-action value).
- Surface user activity in the agent-status overlay: "User interacted with this tab -- agent paused for 2s." Avoid auto-resuming if the URL changed.
- Document for the user: "FSB agents work on background tabs. If you switch to an agent's tab and start typing, the agent will pause and may abandon the in-progress action."

**Warning signs:**
- Agent action races with user input (interleaved characters in form fields).
- "Another debugger is already attached" errors when devtools is open.
- Agent actions executing on the wrong page after a user-initiated navigation.
- Stuck-detection (v0.9.50 Phase 228) firing because the user moved the agent's target offscreen.

**Phase to address:**
**Phase: Background-Tab Execution & Throttling Mitigation** (same phase as Pitfall 7) -- adds the user-collision detection layer.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Skip the `withRegistryLock` mutex because "JS is single-threaded" | One less file | Cap drift under load (Pitfall 6); intermittent stress-test failures | Never -- TOCTOU is real across `await` |
| Ignore tab-ID reuse and address actions by `tabId` only | Simpler dispatch path | Cross-agent corruption when tab IDs recycle (Pitfall 2) | Never -- ownership tokens are mandatory |
| Persist registry only in `chrome.storage.local` | Survives browser restart "for free" | Stale agent records bind tabIds from a previous session (Pitfall 1) | Never -- use `session` storage |
| Default missing `agent_id` to a synthetic legacy agent silently | One less migration | Two-tier system with race-prone implicit agents (Pitfall 11) | Acceptable if the synthetic agent is named, cap-counted, and explicitly documented as a legacy bridge |
| Stream all agents' DOMs to the dashboard | "Just works" UX | Multiplied WS bandwidth, oscillating preview (Pitfall 8) | Never -- single stream, click-to-switch is the v0.9.60 contract |
| Remove the 300s `run_task` timeout entirely | Phase 236 done | Stuck tasks hang clients indefinitely (Pitfall 10) | Never -- raise the timeout, don't remove it |
| Allow incognito tabs in v0.9.60 | Feature parity | Profile-split registry duplication, sealed message channels (Pitfall 4) | Never for v0.9.60; revisit when the multi-instance registry is designed |
| Release locks immediately on transport disconnect | Simple lifecycle | Reconnects within 5s lose state (Pitfall 5) | Never -- 10-15s grace window is mandatory |
| Use `chrome.windows.onRemoved` shortcut for batched tab close | One handler instead of N | Bypasses pool-shrink invariant; leaks slots (Pitfall 3) | Never -- delegate to per-tab `onRemoved` |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| v0.9.36 `McpVisualSessionManager` | Releasing the visual session whenever the agent releases | Track `originator`; only end the session if originator matches releasing agent |
| `chrome.tabs.onRemoved` | Single listener mutates registry directly | Idempotent + commutative handler that sets a tombstone before deletion (Pitfall 2) |
| `chrome.storage.session` | Treating reads as cheap | Cache in-memory, write-through; the rehydrate-on-wake path is the only reader |
| MCP transport (stdio + WS bridge) | Conflating transport disconnect with session end | 10-15s grace window keyed by `connection_id`; only release after grace expires |
| `chrome.tabs.create` | Opening a tab without claiming it for the agent first | Claim + create inside the registry mutex; rollback on `create` failure |
| `chrome.tabs.goBack` | Trusting "success" without verifying URL changed | Compare pre/post URL; check `pageshow`; classify result (`no_history`, `cross_origin`, `fragment_only`) |
| `chrome.scripting.executeScript` on background tab | Assumes works identically to active tab | Works for code execution; throttled timers / paused rAF inside the executed code still apply (Pitfall 7) |
| Phase 211 DOM-stream watchdog | Per-tab assumption | Verify watchdog state is per-tab, not global; agent's tab swap shouldn't reset another's stream |
| Phase 159 hook pipeline | Singleton across agents | Per-agent factory; verify hook handlers don't capture agent-scoped state in module closures |
| v0.9.45rc1 Sync tab | Assumes single dashboard pairing | Multi-agent doesn't re-pair, but the Sync tab UI must handle "N agents" without recreating WS connections |
| Phase 209 CDP remote control | Untargeted commands | Require `agent_id` on every dashboard-originated command when N > 1 |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Background-tab timer throttling | `waitForDOMStable` resolves too early or too late | `chrome.alarms` for >1s waits; event-driven completion checks | Always under multi-agent (only 1 tab can be foreground) |
| `chrome.storage.session` write churn | SW eviction-resistance write per registry mutation -- many writes | Coalesce writes within a microtask (debounce 50ms) -- but never delay reads | When >5 agents mutating concurrently |
| MCP progress message volume | stdio buffer pressure on long tasks (Pitfall 10) | Coalesce + heartbeat; cap progress to 1/sec per agent | Tasks >5min with frequent actions |
| DOM-stream multiplexing (if attempted) | WS bandwidth N× baseline; dashboard frame drops | Single-stream policy for v0.9.60 (Pitfall 8) | Never attempt multi-stream until a future milestone |
| Reconciliation pass on every wake | Slow first-message-after-idle (each `chrome.tabs.get` is async) | Batch reconciliation with `chrome.tabs.query({})` once and diff | Registries with >4 agents and slow Chrome (low-end devices) |
| `agent-loop.js` module-state contention | Two agents racing on the same in-memory cache | Per-agent state instances; reentrancy audit | Always under multi-agent |
| Cap counter computed by counting events | Drift on missed events under load | Always read `registry.size` from authoritative source inside the mutex | At cap saturation under churn |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Trusting caller-supplied `agent_id` for ownership decisions | Agent A spoofs agent B's ID to access B's tab | Bind `agent_id` to the originating MCP `connection_id` at claim time; reject mismatches at the dispatch boundary |
| Allowing agents to claim tabs they didn't open | Agent claims user's banking tab and reads DOM | Restrict claims to tabs created by the agent OR explicitly granted via user gesture; reject ambient claims |
| Shared `ownershipToken` across agents (e.g., timestamp-based) | Token collisions / forgery | Use `crypto.randomUUID()` like `mcp-visual-session.js:50`; never derive from clock |
| `chrome.storage.session` registry readable via debugging surfaces | A compromised content script reads other agents' state | Registry lives in background SW only; content scripts never have direct access -- enforce via message-API gateway |
| Logging full `agent_id` + tabId in production logs | Eavesdropper on shared logs reconstructs ownership | Use the redactForLog helper from Phase 211 for any registry log emission |
| MCP `back` tool on a tab opened by user (not agent) | Mutating user history without consent | Reject `back` on tabs not in the agent's pool; require ownership |
| Cap-bypass via rapid claim/release cycles | DoS on cap counter (claim+release at 100Hz exhausts memory if records leak) | Mutex serializes; rate-limit claim attempts per `connection_id` (e.g., 10/sec) |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| No visible indication of multiple agents running | User thinks one task; sees random tab activity, gets confused | Sidepanel agent list with per-agent status; badge count on extension icon |
| "Cap reached" error with no explanation | Looks like a generic failure | Error includes "8/8 agents active -- close a tab or wait for a task to finish"; link to sidepanel agent list |
| Background-tab agent silently fails on focus-required actions | User sees no progress; doesn't know to foreground | Agent surfaces "needs your attention" status; offers a "bring to front" button |
| Closing a tab silently kills its agent's task | User loses 5min of work without warning | Confirm dialog when closing an agent's tab mid-task; offer "let it finish" or "stop now" |
| Dashboard preview switches to a different tab without notice | Disorienting; user loses track of what they were watching | Notice with click-to-switch-back; preview switching is opt-in |
| User can't tell which agent caused a notification | "FSB completed your task" -- which one? | Notifications include agent label / first-line of original task |
| `back` returning `no_history` looks like a success | Model proceeds as if it backed up | UI surfaces "back: no history available" as a distinct state, not a green check |

## "Looks Done But Isn't" Checklist

- [ ] **Registry persistence:** Often missing the SW-eviction test -- verify `chrome.storage.session` round-trip with simulated SW wake (Pitfall 1).
- [ ] **Tab ownership:** Often missing the `ownershipToken` field in the dispatch path -- grep `chrome.tabs.sendMessage` for callers that bypass ownership check (Pitfall 2).
- [ ] **Pool semantics:** Often missing the "close one tab shrinks pool" test -- assert pool.size after each `onRemoved` in both orderings (Pitfall 3).
- [ ] **Incognito:** Often missing the explicit reject -- verify `manifest.json` and dispatch boundary both block incognito (Pitfall 4).
- [ ] **Reconnect grace:** Often missing the `connection_id` round-trip -- verify a simulated transport flap of 5s preserves agent state (Pitfall 5).
- [ ] **Cap mutex:** Often missing the stress test -- verify 20 concurrent claims cap at exactly 8 (Pitfall 6).
- [ ] **Background throttle:** Often missing the per-tool foreground flag -- audit `tool-definitions.cjs` for focus-dependent ops (Pitfall 7).
- [ ] **Single-stream preview:** Often missing the click-to-switch UI -- verify dashboard surfaces only one stream when N > 1 (Pitfall 8).
- [ ] **`back` empty history:** Often missing the `history.length` precheck -- verify `back` on a fresh `chrome.tabs.create` tab returns `no_history` not error (Pitfall 9).
- [ ] **Long-task heartbeat:** Often missing the 30s heartbeat -- verify a 10-min task emits at least 20 progress messages (Pitfall 10).
- [ ] **Single-agent regression:** Often missing the legacy wrapper -- verify popup task launches still work without explicit `agent_id` (Pitfall 11).
- [ ] **Visual-session bridge:** Often missing the `originator` field -- verify two clients can't end each other's visual sessions (Pitfall 11).
- [ ] **User collision:** Often missing the user-navigation reset -- verify agent pauses when user navigates the owned tab (Pitfall 12).
- [ ] **Tab-ID reuse:** Often missing the generation counter -- verify a closed-then-reused tabId doesn't honor old ownership tokens (Pitfall 2).
- [ ] **Phase 236 + SW eviction:** Often missing the resume-on-wake path -- verify a long task survives SW eviction and still delivers its result (Pitfall 10).
- [ ] **Existing test pass:** Often missing pre-flight regression -- run `tests/mcp-visual-session-contract.test.js`, `tests/mcp-tool-routing-contract.test.js`, `tests/mcp-in-flight-session-lookup.test.js`, `tests/mcp-bridge-client-lifecycle.test.js`, `tests/mcp-recovery-messaging.test.js`, `tests/dashboard-runtime-state.test.js` unchanged.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Cap counter drift (Pitfall 1, 6) | LOW | 1) Trigger reconciliation pass via debug tool. 2) Reload extension if drift persists. 3) Investigate which writes bypassed the mutex. |
| Cross-agent corruption from tab-ID reuse (Pitfall 2) | HIGH | 1) Stop affected agents. 2) Audit logs for ownership-token mismatch. 3) Add ownership checks at any dispatch sites that were missed. 4) No way to undo corruption already applied to user pages. |
| Pool slot leak (Pitfall 3) | MEDIUM | 1) Reload extension. 2) Identify the missing `onRemoved` path. 3) Add idempotency test before re-deploy. |
| Incognito tab silently failing (Pitfall 4) | LOW | 1) Surface the `incognito_unsupported` error to the user/model. 2) User retries in regular profile. |
| Reconnect failure during transport flap (Pitfall 5) | MEDIUM | 1) Verify `connection_id` is being sent on reconnect. 2) Tune grace window. 3) If grace window is correct but agent still released, investigate `client_label` mismatch. |
| Cap allows >8 (Pitfall 6) | MEDIUM | 1) Reload extension to reset registry. 2) Audit mutex usage in claim path. 3) Add stress regression test. |
| Background-tab task stalls (Pitfall 7) | LOW | 1) Foreground the tab manually. 2) For systemic fix: replace blocking timers with `chrome.alarms` or events. |
| Dashboard preview oscillates (Pitfall 8) | LOW | 1) User clicks the agent they want to watch. 2) For fix: ensure preview swap is gesture-driven, not auto-driven. |
| `back` no-op on fresh tab (Pitfall 9) | LOW | 1) Surface `no_history` to model; let it adapt. 2) If contract was wrong, deploy fix and update prompt. |
| Long task hangs MCP client (Pitfall 10) | MEDIUM | 1) `stop_task` to abort. 2) Reduce task scope or split. 3) Add resume support in a follow-up milestone. |
| Single-agent regression (Pitfall 11) | HIGH | 1) Hotfix the legacy wrapper. 2) Add regression test before next deploy. 3) For users on broken release: roll back via store rollback or push patch. |
| User-action collision (Pitfall 12) | LOW | 1) Agent's stuck-detection (v0.9.50 Phase 228) eventually fires. 2) For systemic fix: hook `webNavigation.onCommitted` to detect user nav. |

## Pitfall-to-Phase Mapping

This assumes a roadmap structure approximately:
- **Phase A: Agent Registry Foundation** (persistence, rehydrate-on-wake, reconciliation)
- **Phase B: Concurrency Cap & Mutex** (`withRegistryLock`, version counter, stress test)
- **Phase C: Tab Ownership & Token Enforcement** (ownershipToken, dispatch-boundary check, incognito reject)
- **Phase D: Forced-New-Tab Pooling** (pool semantics, idempotent `onRemoved`)
- **Phase E: MCP Lifecycle & Reconnect Grace** (connection_id, grace window, transport-vs-session distinction)
- **Phase F: Background-Tab Execution & Throttling Mitigation** (per-tool foreground flag, alarms swap, user-collision detection)
- **Phase G: `back` Tool Implementation** (structured result, history precheck, cross-origin reinjection)
- **Phase H: Phase 236 (`run_task` return-on-completion) + Long-Task Hardening** (configurable timeout, heartbeats, persistence)
- **Phase I: Single-Agent Compatibility & v0.9.36 Bridge** (legacy wrapper, visual-session originator, reentrancy audit)
- **Phase J: Dashboard Multi-Agent Surface (minimal)** (agent list, single stream, agent_id on remote-control)
- **Phase K: Production Validation & Regression Sweep** (run all v0.9.36/v0.9.45rc1/v0.9.50 tests; multi-agent stress fixtures)

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Registry dies with SW (P1) | Phase A | Simulated SW eviction test; round-trip via `chrome.storage.session`; reconciliation drops ghost records |
| `onRemoved` race / tab-ID reuse (P2) | Phase C | Ownership-token enforcement at dispatch; tombstone + generation counter test |
| Pool over/under-release (P3) | Phase D | Idempotent `onRemoved` test in both orderings; pool.size invariants |
| Incognito / cross-window (P4) | Phase C | Manifest opt-out; dispatch boundary rejects incognito tabs; cross-window drag test |
| MCP disconnect/reconnect race (P5) | Phase E | Simulated transport flap of 5s and 30s preserves vs. releases correctly |
| Cap TOCTOU (P6) | Phase B | 20-concurrent-claim stress test caps at exactly 8 |
| Background-tab throttle (P7) | Phase F | Per-tool foreground flag audit; `chrome.alarms` substitution test; background-vs-foreground matrix |
| Dashboard preview surface (P8) | Phase J | Single-stream contract; click-to-switch UI; agent_id required on remote control |
| `back` empty history (P9) | Phase G | `chrome.tabs.create` -> `back` returns `no_history`; cross-origin reinjection verified |
| Phase 236 long-poll (P10) | Phase H | Configurable timeout test; 30s heartbeat; SW eviction during long task delivers result on wake |
| Single-agent regression (P11) | Phase I | All v0.9.36/v0.9.45rc1/v0.9.50 tests pass; legacy wrapper exercised; visual-session `originator` test |
| User-action collision (P12) | Phase F | User-navigation pauses agent; debugger collision surfaces clear error |

## Sources

- `extension/utils/mcp-visual-session.js` (verified) -- v0.9.36 `McpVisualSessionManager` shape, in-memory Maps backed by `chrome.storage.session` rehydrate flow. HIGH confidence.
- `extension/background.js:2455`, `:12616` (verified) -- existing `chrome.tabs.onRemoved` listeners scope and ordering. HIGH confidence.
- `extension/ws/mcp-bridge-client.js:680` and `mcp/src/tools/autopilot.ts:58` (verified) -- the 300s timeout that Phase 236 must address. HIGH confidence.
- `extension/ws/mcp-tool-dispatcher.js:326` (verified) -- existing `chrome.tabs.goBack` usage as template for `back` tool. HIGH confidence.
- Chromium MV3 service-worker lifecycle: https://developer.chrome.com/docs/extensions/reference/api/runtime#service-worker-lifecycle and https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle (HIGH confidence -- official, current).
- Chromium tab-ID reuse / message-passing semantics: https://developer.chrome.com/docs/extensions/reference/api/tabs and the Chromium issue tracker discussions on tab-id allocation (MEDIUM-HIGH confidence; the "do not assume unique across session" guidance is in the docs but easy to miss).
- Chromium background-tab throttling / intensive throttling: https://developer.chrome.com/blog/timer-throttling-in-chrome-88 and https://developer.chrome.com/blog/background_tabs (HIGH confidence on the existence and direction of throttling; MEDIUM on exact thresholds because they shift across releases).
- `requestAnimationFrame` paused for hidden tabs: https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame (HIGH confidence -- web standard).
- IntersectionObserver gating in occluded tabs: https://developer.mozilla.org/en-US/docs/Web/API/IntersectionObserver (MEDIUM-HIGH confidence on browser behavior under occlusion).
- MCP protocol transport semantics (stdio + WebSocket reconnect): https://modelcontextprotocol.io/docs and `fsb-mcp-server` runtime in `mcp/src/runtime.ts` (MEDIUM confidence; protocol is young, exact reconnect semantics depend on transport implementation).
- Chrome incognito split mode: https://developer.chrome.com/docs/extensions/reference/manifest/incognito (HIGH confidence -- official).
- `chrome.tabs.goBack` empty-history rejection behavior: verified via Chrome DevTools experimentation and https://developer.chrome.com/docs/extensions/reference/api/tabs#method-goBack (HIGH confidence on rejection; MEDIUM on the exact error string across versions).
- v0.9.36 / v0.9.45rc1 / v0.9.50 phase notes referenced from `.planning/PROJECT.md` (verified). HIGH confidence on which contracts must be preserved.
- Personal architecture experience with multi-agent locking, TOCTOU patterns in async JS, and MV3 SW eviction recovery (informs Pitfalls 1, 2, 6, 11). HIGH confidence on those specifics.

---
*Pitfalls research for: Adding multi-agent tab ownership and concurrency to FSB v0.9.60 (MCP 0.8.0)*
*Researched: 2026-05-05*
