# Pitfalls Research

**Domain:** FSB v0.9.45rc1 -- Sync surface consolidation, background-agent sunset, DOM stream hardening, WS compression symmetry, diagnostic logging
**Researched:** 2026-04-28
**Confidence:** HIGH (grounded in current FSB code + recent v0.9.36/v0.9.40 incidents)

This file enumerates pitfalls specific to ADDING the v0.9.45rc1 features to the existing FSB MV3 extension + showcase dashboard. It does not re-litigate already-validated subsystems (autopilot, MCP server, conversation history, vault, dashboard analytics). Each pitfall ties back to one of the six work areas in the milestone:

1. Sync tab consolidation (relocates Phase 209 + 210 UI)
2. Background-agents sunset (commented-out, not deleted)
3. DOM streaming hardening (mutation watchdog, large-DOM truncation, stale counter)
4. WebSocket inbound decompression (symmetric `_lz` envelope)
5. Diagnostic logging replacement (silent error swallowing -> `console.warn`)
6. Showcase/dashboard surface mirroring (sync messaging + agent-sunset copy)

---

## Critical Pitfalls

### Pitfall 1: Orphaning users mid-pairing during Sync tab consolidation

**What goes wrong:**
A user has the QR pairing UI open in `options.html#dashboard` (current Phase 210 surface) when the new Sync tab is rolled out. After update, the old anchor either silently scrolls to nothing, throws "section not found" in the console, or worse, lands on the dashboard tab without a QR code at all -- the regenerate-on-expiry timer was already counting down and now the user has no way to scan or refresh.

**Why it happens:**
Hash anchors in the options page (`options.html#dashboard`, `options.html#agents`, `options.html#mcp`) are deep links from documentation, the showcase site nav, and the FSB toolbar popup. Removing or renaming the section that an anchor points to makes the link a silent no-op inside an extension page (no 404 handling like a real web app gets). Phase 210 wired the QR generation to `#btnPairDashboard` inside `#dashboard`; if the Sync tab reuses the same button id but hangs it under `#sync`, every doc link, support email, and showcase CTA pointing at `#dashboard` will be broken on day one.

**How to avoid:**
1. Inventory every `#`-anchor reference in code before moving anything: grep `options.html#`, `chrome.runtime.openOptionsPage`, `showcase/**` href patterns, README, and the showcase Angular router.
2. Implement an in-page redirect shim in `ui/options.js` that runs on `DOMContentLoaded`: if `location.hash` matches a deprecated anchor (`#dashboard`, `#agents` for old tab, `#pair`, `#remote`), rewrite it to the new `#sync` anchor and call the tab activator before any other init runs. This must happen before the Phase 210 60s countdown wiring fires; otherwise a deep-link arrival will start the QR timer in a hidden tab.
3. Keep the redirect shim in place for at least the v0.9.45 + v0.9.46 cycle; remove only after telemetry shows the legacy anchors are no longer hit (or after a full release notes cycle).
4. The Sync tab MUST own a stable id (`#sync` only) -- do not introduce sub-anchors in this milestone. Sub-anchors invite the same problem on the next refactor.

**Warning signs:**
- Console error `Cannot read properties of null (reading 'classList')` on options.html load when arriving from a deep link.
- QR countdown badge shows 60s -> 59s -> ... in DevTools but no QR ever renders (timer started in a tab the user never saw).
- Showcase support page links land on a blank section.
- Users on Discord/issues report "where did the pair button go?" within hours of release.

**Phase to address:**
Sync tab consolidation phase. Make the redirect shim a Plan 1 task and the tab move a Plan 2 task. Do not let plan 1 be skipped -- the shim is what avoids the orphan window.

---

### Pitfall 2: Dangling message handlers after agent sunset (silent MCP failure)

**What goes wrong:**
Background-agent code paths get commented out in `ui/options.js`, `ui/sidepanel.js`, and `ui/popup.js`, but `background.js` still has the alarm listener (`chrome.alarms.onAlarm.addListener` at line ~12532), the agent run completion broadcaster (line ~12593), and the `dash:agent-run-now` WebSocket dispatch handler in `ws/ws-client.js`. MCP clients calling `agent_create`, `agent_list`, or `agent_run` get a half-alive response: tools registered in `mcp-server/src/tools/agents.ts` route through, hit a partially-commented background handler, and either return stale data, silently no-op, or crash the bridge mid-call. The user sees "MCP failed" without a clear cause because the layer that would have logged the deprecation was the UI, which is gone.

**Why it happens:**
"Comment out, don't delete" is correct at the file level (preserves shared utilities, supports future revival), but it's only safe if every entrypoint that activates that code is also gated. Background agents have at least four entrypoints beyond the UI: (a) `chrome.alarms.onAlarm` firing for previously-scheduled alarms that are still in the alarm registry, (b) MCP tools (`agent_create` etc.) registered server-side, (c) `dash:agent-run-now` from the dashboard, (d) `ws/mcp-bridge-client.js` request routing. Commenting only the UI leaves all four hot.

**How to avoid:**
1. Define a single deprecation gate constant `BG_AGENTS_DEPRECATED = true` exported from `agents/agent-manager.js` (or a new `agents/deprecation.js` if the manager file itself is being neutered). Every entrypoint -- alarm listener, MCP tool registration, dashboard dispatch, bridge route -- checks this gate first and returns a structured deprecation response (`{ ok: false, deprecated: true, message: 'Background agents are retired in v0.9.45 -- see OpenClaw / Claude Routines.' }`).
2. On extension upgrade (`chrome.runtime.onInstalled` with reason `update`), enumerate `chrome.alarms.getAll()`, find every alarm prefixed with the agent prefix (`agentScheduler.ALARM_PREFIX`), and clear them. Do this even though `agents/agent-scheduler.js#clearAllAlarms` is being commented out -- copy the few lines into the install handler so the cleanup runs once on the upgrade boundary regardless of whether the rest of the scheduler is dormant.
3. MCP tool surface: in `mcp-server/src/tools/agents.ts`, do not just return `{}`. Have each tool return an explicit deprecated-tool error so MCP hosts (Claude Desktop, Codex, OpenCode) display "this tool is retired" rather than treating an empty payload as success. Update `mcp-server/README.md` and the MCP package guide.
4. Run `node tests/agent-manager-start-mode.test.js` against the comment-out diff and confirm it fails on import (proving the deprecation surface is visible to existing tests). Then update the test to assert deprecation behavior, not pre-deprecation behavior.

**Warning signs:**
- Service worker logs `[FSB] Agent not found for alarm, clearing: agent_xyz` repeatedly after upgrade -- this is the symptom from `background.js:12550` firing on stranded alarms.
- MCP host logs show `agent_create` returning success with empty data (handler half-noops without raising).
- Dashboard "Run Now" button on a still-cached agents view triggers a 30-second hang because `dash:agent-run-now` reaches the bridge but never gets a reply.
- `console.warn('[FSB] agentRunComplete sendMessage delivery failed', ...)` fires for sessionIds that don't exist in any UI.

**Phase to address:**
Background-agent sunset phase. Make the deprecation gate + alarm-cleanup-on-update a Plan 1 task; UI commenting is Plan 2; MCP surface deprecation is Plan 3. The alarm cleanup MUST land in the same release where the UI is removed -- splitting them across two releases leaves users on the intermediate version with stranded zombies.

---

### Pitfall 3: Stored agent data lost without warning on extension upgrade

**What goes wrong:**
The `bgAgents` key in `chrome.storage.local` (see `agents/agent-manager.js:8`) holds every user-created agent definition, run history, and replay state. After sunset, those entries become inert but they're still 50-entry-per-agent histories on disk. If a future migration deletes the key, or a user reinstalls and Chrome syncs back partial data, they lose their agent run history without ever being told it existed in the first place.

**Why it happens:**
Two failure modes converge: (a) developers commenting out a feature often also "tidy up" by deleting its storage key in `onInstalled`, treating storage cleanup as part of the deprecation, and (b) users with active scheduled agents at the moment of upgrade have no warning -- the alarm fires, the handler is gated, the run never happens, and the user only notices days later when the result they expected isn't there.

**How to avoid:**
1. **Do not delete `bgAgents` storage in this milestone.** Comment out writes, but leave the data in place. Users who downgrade or who want to migrate to OpenClaw can still see their definitions.
2. Add a one-time migration in `chrome.runtime.onInstalled` (reason=update, only when version crosses 0.9.45) that:
   - Reads `bgAgents`.
   - Counts active (`enabled: true`) agents.
   - If count > 0, writes a notification record to `chrome.storage.local` under `fsb_sunset_notice` containing the agent names and their last scheduled times.
   - The Sync tab (or popup, on next open) reads `fsb_sunset_notice` and shows a one-time card listing those agents and what to do next (export task text to OpenClaw, links to docs).
3. Include an export action in the deprecation card: "Copy task definitions" that puts JSON of `{name, task, schedule}` pairs onto the clipboard. This is the "graceful sunset with data preservation" pattern -- the data stays, the user is informed, and they have a one-click export path.
4. Document the storage layout in `.planning/MILESTONES.md` v0.9.45 closeout so future revival (if strategic landscape changes) can re-read the same key.

**Warning signs:**
- User reports "my Tuesday morning report didn't run" 3-7 days after upgrade.
- Storage size for `bgAgents` is non-zero on machines where the agents UI is gone.
- No deprecation card has ever appeared on a profile that previously had agents (means `fsb_sunset_notice` write didn't fire).

**Phase to address:**
Background-agent sunset phase, Plan 1 (data preservation + notice) BEFORE Plan 2 (UI removal). Verification: on a profile with seeded `bgAgents` data, upgrade to 0.9.45rc1, confirm the notice card appears and `bgAgents` is unchanged.

---

### Pitfall 4: Mutation queue watchdog false-positive on legitimately quiet pages

**What goes wrong:**
The DOM streaming watchdog is intended to detect "the mutation observer has stopped delivering even though the stream session is supposedly alive" and trigger a recovery (resnapshot, restart observer, broadcast a transport warning). On pages that are intentionally quiet -- a finished article, a static documentation page, an idle Gmail inbox -- the watchdog fires every cycle, spamming `[FSB DOM] watchdog: stream stuck` warnings, forcing unnecessary resnapshots, and burning service-worker lifecycle budget.

**Why it happens:**
Watchdogs that key off "no mutations in N seconds" conflate two different states: (a) the observer is broken / detached and (b) nothing changed because nothing is supposed to change. The current `content/dom-stream.js` MutationObserver flushes on rAF (line 678) -- a stuck observer would manifest as no flushes -- but that's indistinguishable from a quiet page using the same signal.

**How to avoid:**
1. Watchdog must check **both** "no mutations" and "observer instance still attached + healthy". Track a `mutationObserver._lastFlushTime` AND a `mutationObserver._isConnected` flag (set on `observe()`, cleared on `disconnect()`). Stuck = no flush AND last expected reason for inactivity is gone (e.g. tab is foreground, page load complete, no pending navigation).
2. Use a heartbeat mutation rather than time-only: every 15s the watchdog calls `mutationObserver.takeRecords()` (synchronous, returns currently-queued records without flushing). If the call throws or returns null when a known-good observer would return `[]`, the observer is broken. If it returns `[]`, the page is just quiet -- not stuck.
3. Add a "quiet page" exemption: if the page has no animation frames running for 10 seconds AND `document.visibilityState === 'visible'` AND the dashboard preview's last-rendered DOM matches a recent extension-side hash, treat as healthy-quiet.
4. Watchdog log messages must be `console.log` (not `warn`) at info severity for healthy-quiet, `console.warn` only for actual stuck detection. Prevents log spam during normal browsing.

**Warning signs:**
- Service worker console shows `watchdog tick` more than once per minute.
- Resnapshot count from extension > 1 per actual page navigation.
- Dashboard preview flickers (full DOM reload) while the user is reading a static page.
- MV3 SW lifecycle stays "active" indefinitely on quiet pages -- watchdog activity prevents idle timeout and burns the 30s budget.

**Phase to address:**
DOM streaming hardening phase, Plan 1 (watchdog design) before Plan 2 (truncation). Verification: open a static documentation site, leave for 5 minutes; expect zero `[FSB DOM] watchdog: stream stuck` warnings and SW idles normally.

---

### Pitfall 5: setInterval watchdog timer fails after MV3 service worker idle

**What goes wrong:**
If the watchdog is implemented as `setInterval` in `background.js`, it stops firing 30 seconds after the SW goes idle (MV3 evicts timers along with the SW context). When the user comes back to the tab, the SW wakes, but the watchdog interval is gone -- there's no recovery mechanism for streams that broke during the SW-idle window. Worse, on SW wake the old `pendingMutations` / `streamSessionId` state may be partially restored from `chrome.storage.session`, so the system thinks streaming is active but no observer is actually running.

**Why it happens:**
Pre-MV3 muscle memory. `setInterval` in a persistent background page survives indefinitely; in MV3 a service worker is suspended after 30s of inactivity and `setInterval` callbacks are simply not delivered after that. The CLAUDE.md repeatedly calls out "MV3 service worker lifecycle" as a constraint, and Phase 207 (v0.9.40) explicitly handled SW-wake session resumption -- but a watchdog implemented in the wrong primitive will reintroduce the silent-loss problem v0.9.40 just fixed.

**How to avoid:**
1. **Use `chrome.alarms` for SW-side watchdogs.** `ws/mcp-bridge-client.js` already does this for reconnect (line 205, 219) -- copy the pattern. `chrome.alarms.create('fsb-domstream-watchdog', { periodInMinutes: 0.5 })` survives SW idle and wakes the SW to fire the alarm callback.
2. **Use rAF-driven `setInterval` in the content script** for the in-page side of the watchdog. Content scripts have a normal page lifecycle and `setInterval` works there. The split is: alarm wakes the SW, SW asks the content script "are you still streaming?", content script replies. Avoid having the SW guess from `chrome.storage.session` alone.
3. On SW wake, re-resolve stream state authoritatively: send a `domStreamHealthCheck` message to the content script in the active tab, wait for ack, only mark the stream alive if ack returns. If no ack in 2s, broadcast a stream-broken event to the dashboard so it shows the recovery chip from Phase 164.
4. Do NOT rely on `setTimeout` chains. Phase 102 (v0.9.8) and the v0.9.20 architecture rewrite both intentionally moved iteration timing to `setTimeout`-chained iterations because the iteration is short-lived; that pattern does NOT extend to long-running watchdogs.

**Warning signs:**
- Alarm registry (chrome://extensions DevTools) shows zero `fsb-domstream-*` alarms but DOM streaming is supposedly active.
- Watchdog stops working after the user closes/reopens the laptop lid.
- After SW wake (20+ seconds idle), dashboard preview shows stale DOM -- mutations stopped flowing during idle and no one noticed until the user clicked something.
- `chrome.alarms.getAll()` shows watchdog alarm with `scheduledTime` in the past.

**Phase to address:**
DOM streaming hardening phase, Plan 1 (watchdog primitive choice -- alarms not setInterval). Add a verification test that simulates SW eviction (force-stop the SW from chrome://extensions) and confirms the alarm refires on wake.

---

### Pitfall 6: Stale mutation counter resets at the wrong moment

**What goes wrong:**
The "stale mutation counter" is supposed to track the number of mutations queued without delivery confirmation, so the system knows when to force a resnapshot. If the counter resets on every successful send (instead of every successful render-confirmation from the dashboard), a relay that ACKs receipt but never delivers to the dashboard (server-side queue overflow, dashboard tab in a recovery chip state) will see counter resets and never trigger resnapshot. Net effect: dashboard is silently stale, the extension thinks everything is fine, and the system "looks done but isn't".

**Why it happens:**
ACK semantics confusion. There are three ACK boundaries: (1) `ws.send` returned without throwing, (2) relay server accepted and forwarded, (3) dashboard rendered the mutation. They are not the same. Phase 164 (v0.9.25) introduced `_lastRemoteControlState` for the remote-control case; the analogous DOM stream ACK is not yet wired authoritatively.

**How to avoid:**
1. The dashboard must send a `dash:dom-mutation-ack` envelope back to the extension after applying mutations, including a sequence number. The extension's stale counter resets only on receipt of that ack, not on local send.
2. Add a max-staleness threshold: if counter exceeds N (e.g., 200 mutations or 30 seconds) without ack, trigger a forced resnapshot via the existing `domStreamResnapshot` path.
3. Never reset the counter on transport-level success (`ws.send` returning true). That's a green light from one layer; staleness is a property of end-to-end delivery.
4. Use the same `streamSessionId` the dashboard already keys on (line 651 in `dom-stream.js`); send acks scoped to that session id so reconnects don't cross-pollinate ack streams.

**Warning signs:**
- `recordFSBTransportCount('sentByType', ...)` shows hundreds of `domStreamMutations` sends but the dashboard preview is visibly stale (e.g. user typing in the streaming tab, dashboard mirror is multiple keystrokes behind and never catches up).
- Resnapshots happen only on stream-start, never on staleness-recovery.
- Dashboard log shows `applied mutation` count diverging from extension's `sent mutation` count by orders of magnitude.

**Phase to address:**
DOM streaming hardening phase, Plan 2 (after watchdog primitive is stable). Verification: artificially block the dashboard apply path for 10 seconds, confirm the extension forces a resnapshot rather than continuing to send into a black hole.

---

### Pitfall 7: Large-DOM truncation cuts mid-element and renders invalid HTML

**What goes wrong:**
When a single DOM snapshot crosses the size cap, naive truncation chops the serialized string at byte N. If N falls inside `<div class="abc...` the dashboard renderer either silently drops the unclosed tag, renders broken layout, or (worst case) throws during deserialization and shows the recovery chip even though the upstream stream is healthy.

**Why it happens:**
String-level truncation treats a serialized DOM tree as opaque bytes. The serializer in `content/dom-stream.js` produces JSON with nested element objects, but the truncation point may land inside an attribute value, a closing tag, or a CSS property declaration. The dashboard's `applySnapshot` parser assumes well-formed input.

**How to avoid:**
1. Truncate at the **node** level, not the byte level. Walk the DOM tree, serialize subtrees, and stop adding subtrees once the cumulative serialized size approaches the cap. The last subtree included must be complete; the next one is dropped (with a sentinel `{ truncated: true, missingDescendants: N }` so the dashboard can show "page partially mirrored").
2. Truncation should be O(n) over the included tree, not O(n^2). Do NOT re-serialize the whole tree to measure size after each addition. Track running size as you walk; add subtrees in document order with a budget-aware DFS.
3. The dashboard side must explicitly handle the `truncated` sentinel: render whatever arrived, show a "partial DOM mirror" badge, and trigger an out-of-band fetch for the missing branches via a follow-up `domStreamRequestSubtree` message rather than retrying the whole snapshot.
4. The byte cap must be lower than the WebSocket relay's per-message limit (currently the relay enforces a size limit which is why compression exists in the first place per ws-client.js:582). Set the truncation cap at 80% of the relay limit to leave headroom for envelope overhead and for compression-resistant payloads where `_lz` doesn't reduce size.

**Warning signs:**
- Dashboard JS console shows `Unexpected end of JSON input` or `Invalid HTML in mirror`.
- Dashboard preview renders 90% of the page then a chunk is missing in the middle (a truncated subtree visible as missing children of a present parent).
- Compression ratio in `[FSB WS] Compressed ...` log is suspiciously close to 100% on truncated-but-valid snapshots (compression doesn't help on already-fragmented JSON).
- Truncation algorithm itself takes > 200ms on large pages -- indicates O(n^2) recursive re-walks.

**Phase to address:**
DOM streaming hardening phase, Plan 2 (truncation algorithm) -- co-located with watchdog so both touch `content/dom-stream.js` in one diff. Verification: open a 5MB+ DOM page (e.g., a long Wikipedia article with thousands of `<a>` elements), trigger snapshot, confirm dashboard renders without parse error and shows truncated-badge.

---

### Pitfall 8: Asymmetric WebSocket compression -- inbound `_lz` not decompressed

**What goes wrong:**
The extension's `ws/ws-client.js` line 588 sends `{ _lz: true, d: compressed }` envelopes for outbound messages > 1KB. The `_handleMessage` switch (line 918) does NOT have a `_lz` branch -- if the relay or dashboard ever sends a compressed envelope back, the extension calls `JSON.parse(event.data)` (line 517), gets `{ _lz: true, d: '...' }`, and falls through every `case` in the switch as an unknown type. Silent drop. The dashboard already has decompression (showcase/js/dashboard.js:3517), so the system is one-directional today; the moment any future change makes the dashboard or relay compress its outbound, FSB silently breaks.

**Why it happens:**
LZ-string was introduced in v0.9.9.1 (Phantom Stream) for the dashboard's outbound, and the extension copied the `send` path symmetry without copying the `receive` path. The asymmetry is documented in the milestone goals but the failure mode -- silent drop, not loud error -- means it has never surfaced as a bug because the dashboard has historically not initiated compression in this direction.

**How to avoid:**
1. In `_handleMessage`, before the switch, check `if (msg && msg._lz === true && typeof msg.d === 'string')` and call `LZString.decompressFromBase64(msg.d)`, then `JSON.parse` the result, then re-enter `_handleMessage` with the decompressed object. Use the same envelope shape the dashboard uses (showcase/js/dashboard.js:3517-3518) so the contract is symmetric.
2. Defensive parsing: if decompression returns null or throws, do NOT silently drop. `console.warn('[FSB WS] Failed to decompress _lz envelope', ...)` and call `recordFSBTransportFailure` with a `decompression-failed` reason. Drop the frame, but loudly.
3. **Do NOT negotiate per-frame** at the WebSocket extension level (RFC 7692 permessage-deflate). Stay at the application envelope layer (`{ _lz: true, d: '...' }`). RFC 7692 is supported by the browser but is a per-connection negotiation; mixing app-level `_lz` with a transport-level extension creates double-compression and mysterious size regressions.
4. Add a unit test in `tests/` (similar to `tests/dashboard-runtime-state.test.js`) that mocks an inbound `_lz` envelope, runs `_handleMessage`, and asserts the inner type was dispatched. Currently no such test exists.
5. Mixed-mode is fine because the envelope is self-identifying: `_lz: true` means decompress, absence means raw JSON. Per-frame detection is automatic. Document this in a comment near `_handleMessage`.

**Warning signs:**
- After a relay or dashboard release, certain extension-side handlers stop firing for large messages but small messages still work.
- `recordFSBTransportCount('receivedByType', undefined)` increments -- inbound messages with no `type` field, which is what `_lz`-wrapped envelopes look like to the un-decompressed switch.
- Dashboard sends "task submit" with a long task description, extension does nothing. Same task with a short description works.
- `[FSB WS] Failed to parse message` appears with no apparent cause -- the JSON.parse succeeded but the result has no `type` field.

**Phase to address:**
WebSocket inbound decompression phase, Plan 1 (decompression branch + tests). This is a single-file change in `ws/ws-client.js` plus a new test. Verification: extension and relay both running, dashboard sends a >1KB compressed task-submit, confirm extension dispatches it to the autopilot.

---

### Pitfall 9: Compression sliding-window state corruption after a single bad frame

**What goes wrong:**
LZ-string base64 envelopes are stateless per-frame (each compress/decompress is independent), so this pitfall is mostly avoided BY using LZ-string instead of permessage-deflate. But if a future contributor sees "compression" and reaches for `pako` or browser-native deflate to "improve compression ratio", they'll introduce permessage-deflate semantics where one corrupt frame poisons the sliding window for every subsequent frame on that connection -- and recovery requires closing and reopening the WebSocket.

**Why it happens:**
Engineers conflate LZ-string base64 (per-message, stateless) with deflate (per-connection, stateful) because both are called "compression". The performance numbers for deflate are better, so well-meaning optimization swaps the algorithm without realizing it changes the failure-mode semantics.

**How to avoid:**
1. **Stick with LZ-string base64.** Document in a code comment near `ws-client.js:588` why: "Per-message stateless compression. Do NOT replace with deflate/pako -- a single bad frame would corrupt the sliding window and require a reconnect to recover."
2. If compression ratio becomes a real problem (it isn't today), introduce per-payload-type strategies (e.g., DOM snapshots use a pre-trained dictionary) rather than a stateful stream codec.
3. Reject any future PR that introduces `Sec-WebSocket-Extensions: permessage-deflate` as a server-side option without a corresponding extension-side teardown plan.

**Warning signs:**
- Compression library swap appearing in package.json or vendored libs.
- `Sec-WebSocket-Extensions` header appearing in the WS upgrade.
- Reports of "extension stops receiving messages until reconnect" after an upgrade -- classic sliding-window corruption symptom.

**Phase to address:**
WebSocket inbound decompression phase, Plan 1 -- as a code comment / decision note. Not a separate plan, but enforced by review.

---

### Pitfall 10: Diagnostic log spam on hot paths after replacing silent swallowing

**What goes wrong:**
The v0.9.40 work already replaced 15 silent `.catch(function(){})` calls with `console.warn` (per MILESTONES.md). v0.9.45rc1 extends this to dialog relay and message delivery. If the new logging fires inside a hot loop -- e.g., DOM stream mutation forwarding (`dom-stream.js:653`), per-action statusUpdate sends, or per-frame visual feedback -- it will produce hundreds of warnings per second on a busy page, drowning out actionable signals and consuming disk space in DevTools' log buffer.

**Why it happens:**
The v0.9.40 fix targeted lifecycle events (session start/end, automation complete) which fire ~1/s at most. Dialog relay and message delivery happen per-event-per-action and can fire 10-50/s. Same logging pattern, very different volume.

**How to avoid:**
1. **Categorize before logging.** Lifecycle events (rare): unconditional `console.warn`. Per-action / per-mutation events (frequent): rate-limit to one warn per error category per 10 seconds, with a counter (`{cat: 'mutation-send', count: 47, last: '...'}`) flushed at the rate-limit boundary.
2. Use the existing `recordFSBTransportFailure` infrastructure (already present in `ws/ws-client.js:570`) for telemetry. That records to in-memory state without console output. Console logs are for human-attention; telemetry is for post-hoc investigation. Don't conflate them.
3. For dialog relay specifically: the relay path is `content/messaging.js` -> `background.js` -> `ws/ws-client.js`. Each layer should log its OWN failures with a layer prefix (`[FSB DLG]`, `[FSB BG]`, `[FSB WS]`). Avoid logging the same error three times as it bubbles up.
4. Severity discipline: `console.warn` for recoverable failures (port disconnect, message dropped during reconnect). `console.error` only for invariant violations (session state corruption, uninitialized module). Do NOT use `console.error` for transient transport failures -- it triggers DevTools red-badge alerts and trains users to ignore them.

**Warning signs:**
- `console.warn` rate exceeds 5/second during normal use (open DevTools, count over 30s).
- DevTools console "Logs" panel filter shows the same warning string repeated dozens of times in a single second.
- Memory profiler shows the SW context retaining MB of console history.
- User reports "extension is logging a wall of warnings, is it broken?".

**Phase to address:**
Diagnostic logging replacement phase, Plan 1 (rate-limiting policy + layer prefixes) BEFORE Plan 2 (actual log call insertions). Verification: run a busy task (100 actions over 60s) with new logging, confirm < 30 unique warning lines.

---

### Pitfall 11: Diagnostic logs leak user data into the console

**What goes wrong:**
A new `console.warn('[FSB DLG] dialog relay failed', { url, dialogText, response })` looks helpful for debugging but logs the page URL (potentially with auth tokens in query params) and the raw text the user typed into a `prompt()` (potentially passwords, MFA codes, addresses). Anyone with DevTools access can read these. If the user shares a debug log on Discord or a GitHub issue, the data is exfiltrated permanently.

**Why it happens:**
Diagnostic logging that's scoped narrowly (just an error message) is useless; logging that includes context (url, payload) is useful but dangerous. The default tendency is to log everything, then redact later -- which never happens.

**How to avoid:**
1. Establish a redaction whitelist. Logs may include: tab id (number), session id (opaque), error message string, message type, layer name. Logs may NOT include: full URL (only origin), user-typed text (only length and presence), response body (only status code), DOM content (only element type and selector signature).
2. Helper function `redactForLog(payload)` in `utils/` that takes a payload and returns a stripped version. Every new diagnostic log goes through it. Code review checklist: any new `console.warn` that doesn't use `redactForLog` is rejected.
3. URLs: log `new URL(url).origin` not the full URL. Query strings may contain OAuth code, JWT, password reset tokens.
4. Dialog content (this milestone's silent-swallow fix scope): log `{ kind: 'prompt', textLength: 23, hasResponse: true }`, never the actual text.
5. Rotate / disable verbose logging in production builds. Provide a debug-mode toggle in options.html that gates verbose payloads; default off.

**Warning signs:**
- A search for `console.warn.*\.url\b` or `console.warn.*payload` finds new instances introduced in this milestone.
- DevTools console captured during a UAT contains user-identifiable strings (search for known test account names, addresses, etc.).
- Issue reports include console snippets that contain URLs with `?code=` or `?token=`.

**Phase to address:**
Diagnostic logging replacement phase, Plan 1 (redaction helper + policy). Code review enforces. Verification: grep test that ensures `console.warn` calls in modified files all reference `redactForLog`.

---

### Pitfall 12: Refactor turns recoverable warns into thrown errors

**What goes wrong:**
While replacing `.catch(function(){})` with diagnostic logging, a developer "improves" a few sites by re-throwing after logging (`.catch(err => { console.warn(...); throw err; })`). The original silence was wrong, but throwing in those locations is also wrong because the upstream caller was written assuming the promise always resolves. Now the agent loop crashes mid-iteration, the session enters an undefined state, and -- the cruel irony -- the v0.9.40 finalizeSession() guarantees don't fire because the throw bypassed the structured exit paths.

**Why it happens:**
"Don't swallow errors" is a near-universal best-practice maxim. Applied without context, it turns into "always propagate", which fights the v0.9.40 architecture where the agent loop deliberately catches at well-defined boundaries.

**How to avoid:**
1. **Recoverable warns stay recoverable.** The pattern is: `.catch(err => { console.warn('[FSB X] foo failed', { err: err && err.message }); /* return undefined or fallback value */ })`. Never re-throw without explicit reason.
2. Document the invariant per call site: "this catch is recoverable because the upstream caller treats undefined as 'no data, continue'". Comment the rationale.
3. Test the agent loop's exit-path coverage by intentionally injecting failures at each new logging point. v0.9.40's `Phase 206` work establishes the exit paths -- run those tests after the diagnostic logging phase to confirm no path was broken.
4. Code review red flag: any new `.catch(err => { ...; throw err; })` requires an explicit comment explaining why upstream NEEDS the throw. Default-disallow.

**Warning signs:**
- Agent loop iteration count drops sharply after the logging phase ships (loop is exiting earlier due to thrown errors).
- Sidepanel gets `automationError` for sessions that previously completed successfully.
- `tests/dashboard-runtime-state.test.js` or v0.9.40 lifecycle tests start failing.
- Stack traces in console show errors propagating from formerly-silent layers.

**Phase to address:**
Diagnostic logging replacement phase, Plan 2 (actual changes). Verification: regression-run all v0.9.40 lifecycle tests after the diff lands.

---

### Pitfall 13: console.warn silently filtered by Chrome DevTools default level

**What goes wrong:**
Chrome DevTools' default console level filter shows Errors and Warnings, but Chromium-based browsers (Edge, Brave) and some older Chrome configs sometimes start with "Verbose" filtered out -- and `console.info` AND `console.log` may be hidden depending on the filter dropdown state. If a developer assumes "I logged it with console.warn so the user will see it", but the user has filter set to "Errors only", the warning is silently absent. This makes the logging seem useless when the user reports an issue.

**Why it happens:**
DevTools level filter is sticky per-origin and persists across sessions. Users debugging another extension or a website can have the filter set wherever they last left it. The extension's logs go to the SW console (chrome://extensions -> service worker), which has its own filter state independent of the page console.

**How to avoid:**
1. Document for support: "open chrome://extensions, click the FSB service worker link, ensure the console filter dropdown shows 'All levels' or includes 'Warnings'". Add this to the support page on the showcase.
2. Critical lifecycle warnings (session abandonment, unrecoverable transport failure) should also write to `chrome.storage.local` under a ring buffer (last 100 entries) so the support flow doesn't depend on console capture.
3. Provide an "Export diagnostics" button in the Sync tab (or options.html) that dumps the ring buffer + chrome.storage state + extension version. v0.9.30 introduced `doctor` and `status --watch` for the MCP side -- the Sync tab can offer the analogous flow.
4. For the hot-path logs (mutation send, dialog relay), `console.log` is fine -- they're for live debugging only. For lifecycle / connection / session events (the v0.9.40 set), use `console.warn` AND ring-buffer.

**Warning signs:**
- User reports "no logs anywhere" when developer is sure logs were written.
- Support tickets where the user pastes a screenshot showing only the extension's red badge alerts but no warns.
- Ring buffer is empty even though warns were emitted in this session.

**Phase to address:**
Diagnostic logging replacement phase, Plan 2 (ring buffer + export). Verification: emit a test warning, set DevTools filter to errors-only, confirm the ring buffer captured it and "Export diagnostics" returns it.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Comment out without deprecation gate | Fast UI removal | Zombie message handlers (Pitfall 2); silent MCP failures | Never -- always pair with gates |
| Skip the deep-link redirect shim | Saves one task | Day-one user reports (Pitfall 1); doc / showcase links broken | Only if EVERY caller is grep-verified migrated, including external docs |
| Delete `bgAgents` storage on upgrade | Cleaner storage panel | Permanent loss of user agent definitions (Pitfall 3); no graceful migration path | Never in this milestone -- defer storage cleanup to v0.9.46+ after sunset notice has cycled |
| `setInterval` for SW-side watchdog | Familiar primitive | Watchdog dies on SW idle (Pitfall 5); reintroduces v0.9.40-class silent-loss | Never in MV3 -- always `chrome.alarms` |
| Byte-level truncation of DOM JSON | Simple substring slice | Mid-element cuts (Pitfall 7); dashboard parse failures | Never -- truncation must be node-aware |
| Replace LZ-string with deflate for "better ratio" | Modest size win | Sliding-window corruption (Pitfall 9); per-connection failure mode | Never without per-frame teardown plan |
| Re-throw after console.warn for "correctness" | Looks like proper error handling | Breaks v0.9.40 exit-path guarantees (Pitfall 12) | Only at explicitly-documented boundaries with upstream re-catch |
| Log full URLs and dialog text "for debugging" | Faster bug repro | User-data leaks in shared logs (Pitfall 11) | Never in production logs -- always redact |
| Skip the watchdog quiet-page exemption | Simpler watchdog code | Log spam, SW idle starvation (Pitfall 4) | Only in dev builds with explicit verbose flag |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| chrome.alarms | Treating alarm name collisions as a runtime issue | Namespace by feature prefix (`fsb-domstream-`, `fsb-mcp-bridge-`, `fsb-agent-` -- already in use); `clearAllAlarms` filters by prefix, never by exact name |
| chrome.storage.local | Reading at module-load time, before SW restore | Always async-read inside an `onInstalled` / `onStartup` handler; cache TTL like `agent-manager.js:13` |
| WebSocket relay envelope | Assuming `JSON.parse(event.data)` returns a typed message | Check `_lz` envelope FIRST, then dispatch on `type`; defensive against unknown envelope shapes |
| chrome.debugger (CDP) | Multiple consumers attaching simultaneously | Per-command attach/detach with stale-debugger recovery, as established by Phase 209 -- watchdogs and remote control must NOT hold persistent debugger sessions |
| Extension upgrade lifecycle | Running migration on every SW restart | Gate by `chrome.runtime.onInstalled` reason=update AND a stored `migrationVersion` flag |
| MCP host quirks | Deprecating tools by removing them from the list | Return explicit `deprecated: true` payloads -- some hosts (OpenCode-style) cache tool lists and will keep calling old names |
| Showcase Angular dashboard | Asymmetric envelope handling | Must implement `_lz` decompression on extension side too (Pitfall 8); Angular dashboard already does it -- maintain symmetry |
| Service worker session storage | Treating `chrome.storage.session` as authoritative for stream state | On SW wake, re-validate via content-script ack before claiming stream is alive (Pitfall 5) |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| O(n^2) DOM truncation | Snapshot generation > 200ms on large pages | Single DFS with running budget; no re-serialization (Pitfall 7) | Pages with 5K+ DOM nodes (long Wikipedia articles, Reddit threads) |
| Watchdog wakes SW unnecessarily | SW lifecycle stays "active" indefinitely; battery drain reports | `chrome.alarms` with healthy-quiet exemption (Pitfall 4, 5) | Quiet pages left open in background tabs |
| Log spam on hot paths | DevTools console rate > 5/s | Rate-limit per error category (Pitfall 10) | Multi-action tasks with transient errors (e.g., reconnect storms) |
| Mutation queue without backpressure | Memory grows unboundedly when relay is slow | Cap pending mutation queue size; drop oldest with `truncated: true` sentinel | High-frequency-mutation pages (live dashboards, video) under degraded relay |
| Compression on small payloads | CPU cost exceeds bandwidth saving | Threshold check (already at 1024 bytes in ws-client.js:583); preserve | Small messages where `compressed.length >= raw.length` is common |
| Stale counter resetting on transport-success | Dashboard silently stale; counter never trips | Reset only on dashboard ack with sequence id (Pitfall 6) | When relay or dashboard is degraded but not failed |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Logging full URLs with query strings | Auth tokens, OAuth codes, password-reset tokens leaked to console (and screenshots, issue reports) | `redactForLog` helper -- log `URL(x).origin` only (Pitfall 11) |
| Logging dialog prompt content | Passwords, MFA codes, addresses leaked | Log `{kind, textLength}`, never the text |
| Decompressing untrusted `_lz` payloads | A malicious relay could send a payload that LZ-string parses but JSON.parse fails on -- DoS on parse loop | Wrap decompression+parse in try/catch; rate-limit `decompression-failed` events (Pitfall 8) |
| Trusting dashboard-supplied coordinates without bound check | Phase 209 already mitigated; preserved by the v0.9.45 work | Continue using `Number.isFinite` validation in remote control handlers; do NOT loosen for the Sync tab move |
| Migrating storage without integrity check | Storage corruption from interrupted upgrade leaves orphan records | One-time migration gated by `migrationVersion`; idempotent by design |
| Exposing `bgAgents` content in the deprecation card | Agents may include task text with credentials or private data | Show task NAMES only, not full task text, in the sunset notice card |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Sync tab missing without warning the prior tab is gone | "Where's pairing?" support tickets | Deep-link redirect shim PLUS in-options breadcrumb on first visit ("Pairing moved here") |
| Agent sunset card with no export path | User feels their work was discarded | Sunset card includes "copy task definitions" + link to OpenClaw and Claude Routines docs |
| Dashboard preview going blank during forced resnapshot | Looks like a crash | Show "resyncing" badge during resnapshot, not an empty preview |
| Truncation badge that doesn't explain | "Why is half my page missing?" | Truncation badge with an explicit "Page exceeds mirror size; partial mirror -- click to request full" affordance |
| Compression / decompression failures shown as red error chips | Trains users to ignore all chips | Distinguish recoverable (yellow chip, auto-clear) from unrecoverable (red chip, action required) |
| New `console.warn` flood after upgrade | "Extension is broken" reports | Rate-limit AND redact -- console should remain readable post-upgrade |
| Sync tab QR with stale countdown after deep-link arrival | User scans an expired code, gets "pairing failed" | Restart the countdown only when the Sync tab is foreground-visible (`document.visibilityState === 'visible'`) |

## "Looks Done But Isn't" Checklist

- [ ] **Sync tab consolidation:** Deep-link redirect shim verified for `#dashboard`, `#agents`, `#pair`, `#remote`, `#mcp` (if applicable). Verify by manually visiting `options.html#dashboard` and confirming the URL hash rewrites to `#sync` and the Phase 210 QR controller does NOT fire prematurely.
- [ ] **Agent sunset:** `chrome.alarms.getAll()` returns zero alarms with the agent prefix on a profile that previously had agents (proves on-update cleanup ran).
- [ ] **Agent sunset:** `mcp-server` returns explicit deprecated-tool errors for `agent_create`, `agent_list`, `agent_run`. Test via `npx -y fsb-mcp-server` then call the tools.
- [ ] **Agent sunset:** `bgAgents` storage key is preserved post-upgrade (verify via DevTools storage inspector).
- [ ] **Agent sunset:** Sunset notice card appears once for users who had active agents; never appears for users who didn't.
- [ ] **Watchdog:** On a static documentation page left open for 5 minutes, console shows zero `watchdog: stuck` warnings AND SW idles normally (chrome://extensions shows service worker as "inactive").
- [ ] **Watchdog:** Force-stop the SW (chrome://extensions), wait 30s, return to streaming tab; watchdog alarm refires and stream is re-validated via content-script ack.
- [ ] **Truncation:** 5MB DOM page snapshot renders on dashboard without parse error; truncated-badge visible.
- [ ] **Truncation:** Snapshot generation < 200ms on the 5MB page (no O(n^2) regression).
- [ ] **WS decompression:** Dashboard sends a > 1KB compressed payload (use a long task description); extension dispatches it to autopilot.
- [ ] **WS decompression:** Malformed `_lz` payload produces a single warn AND telemetry record, NOT a crash, NOT a silent drop.
- [ ] **Logging:** No new `console.warn` references full URLs or dialog text. Grep verification: `grep "console.warn.*url" `, `grep "console.warn.*dialogText"` -- both should return zero results in the modified diff.
- [ ] **Logging:** v0.9.40 lifecycle tests still pass after diagnostic logging changes.
- [ ] **Logging:** Diagnostic ring buffer captured at least one entry during a live test run; "Export diagnostics" button returns it.
- [ ] **Showcase mirror:** Showcase site nav and showcase Angular router both point at `#sync`, no stale `#dashboard` or `#agents` references remain.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Sync tab broke deep links (P1) | LOW | Add the redirect shim in a hotfix point release; the existing UI is unchanged |
| Zombie agent handlers (P2) | MEDIUM | Add deprecation gate constant, audit every entrypoint, ship a hotfix; users see deprecated-tool errors instead of half-noops |
| `bgAgents` data lost (P3) | HIGH | Storage is gone; only recovery is a Chrome sync restore. Prevent by NEVER deleting in this milestone. If accidental delete happens, ship an `onInstalled` migration that pulls from `chrome.storage.sync` if available. |
| Watchdog false-positive flood (P4) | LOW | Add the quiet-page exemption + heartbeat check; ship as patch |
| `setInterval` watchdog dies on SW idle (P5) | MEDIUM | Migrate to `chrome.alarms`; same pattern as `mcp-bridge-client.js:205`. No data loss, just observability gap during the broken window |
| Stale mutation counter (P6) | MEDIUM | Add ack semantics + sequence id; existing dashboards keep working until they upgrade |
| Truncation cuts mid-element (P7) | LOW | Switch to node-level truncation; dashboard parses cleaner snapshots |
| Asymmetric `_lz` decompression (P8) | LOW | Single-file change in `ws-client.js`; write a test |
| Permessage-deflate corruption (P9) | HIGH | Forced reconnect on every bad frame -- defer to next release if introduced; revert to LZ-string |
| Log spam (P10) | LOW | Add rate-limiter; ship as patch |
| Log data leak (P11) | HIGH | Once leaked, leaked. Rotate any tokens that were logged. Add `redactForLog`; require it via lint rule going forward |
| Re-thrown errors (P12) | MEDIUM | Restore `.catch` to no-op-with-warn at affected sites; rerun v0.9.40 lifecycle tests |
| DevTools level filter hides warns (P13) | LOW | Add ring buffer + export button; unaffected after the next user action |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| P1 (Orphan deep links) | Sync tab consolidation, Plan 1 | Manual: visit `options.html#dashboard`, confirm hash rewrites to `#sync` and QR controller fires only after Sync tab is foreground-visible |
| P2 (Zombie handlers) | Agent sunset, Plan 1 (gate) + Plan 3 (MCP surface) | MCP test: call retired tools and assert `deprecated: true` response; alarm test: assert no agent-prefix alarms after upgrade |
| P3 (Storage loss) | Agent sunset, Plan 1 (preservation) | Profile-with-agents upgrade test: verify `bgAgents` unchanged + sunset notice present |
| P4 (Watchdog false-positive) | DOM streaming hardening, Plan 1 | 5-minute idle on static page: zero stuck warnings, SW idles normally |
| P5 (setInterval dies on SW idle) | DOM streaming hardening, Plan 1 | Force-stop SW test: confirm alarm refires and stream is re-validated |
| P6 (Stale counter) | DOM streaming hardening, Plan 2 | Block dashboard apply for 10s: confirm forced resnapshot triggers |
| P7 (Mid-element truncation) | DOM streaming hardening, Plan 2 | 5MB DOM test: dashboard parses without error, truncated-badge present |
| P8 (Asymmetric `_lz`) | WS inbound decompression, Plan 1 | Compressed inbound test: extension dispatches inner type correctly |
| P9 (deflate sliding-window) | WS inbound decompression, Plan 1 (decision note) | Code review enforcement; no permessage-deflate header in any release |
| P10 (Log spam) | Diagnostic logging replacement, Plan 1 | Busy-task test: < 30 unique warning lines per 100 actions |
| P11 (Log data leak) | Diagnostic logging replacement, Plan 1 | Grep test: zero `console.warn` calls reference full URL or dialog text without `redactForLog` |
| P12 (Re-throw breaks v0.9.40) | Diagnostic logging replacement, Plan 2 | v0.9.40 lifecycle regression suite passes after diff |
| P13 (DevTools filter hides warns) | Diagnostic logging replacement, Plan 2 | Filter-set-to-errors test: ring buffer captures the warning regardless |

## FSB-Specific Past Incidents Repeating Here

These are previously-shipped fixes whose patterns must be re-applied -- not new pitfalls, but precedent that should not be re-broken:

1. **v0.9.40 silent-task-abandonment fix** (MILESTONES.md, "Phase 206-208"). Five agent-loop exit paths and 15 `.catch(function(){})` calls were patched. The diagnostic logging work in v0.9.45 must NOT regress these gains: Pitfall 12 (re-throw) explicitly defends this.
2. **v0.9.36 visual-session ownership** (PROJECT.md "Validated v0.9.36"). Persisted overlay replay across SW churn used `chrome.storage.session` for state. The DOM stream watchdog work must follow the same pattern -- on SW wake, re-validate via ack rather than trusting storage alone (Pitfall 5).
3. **v0.9.35 MCP bridge reconnect** (Phase 198, MILESTONES.md). Bridge survives browser-first, server-first, SW-wake, hub-handoff scenarios. Deprecating agents through MCP must explicitly gate at the bridge AND tool level -- the bridge's robustness means a stale tool call WILL reach background.js (Pitfall 2).
4. **v0.9.27 dashboard analytics refresh** (MILESTONES.md). Off-screen refresh deferral pattern. The Sync tab QR countdown should reuse this idea: defer the 60s timer start until `document.visibilityState === 'visible'` (Pitfall 1 / UX table).
5. **v0.9.25 defensive duplicate-suppression in background.js** (MILESTONES.md). Duplicate printable `char` echo defect was a silent dispatch issue. Pitfall 8 (asymmetric `_lz`) is the same class of failure -- silent drop / silent dup / silent dispatch -- and the same defensive testing pattern (`tests/dashboard-runtime-state.test.js` style) is the prevention.
6. **v0.9.9.1 LZ-string introduction** (MILESTONES.md "Phantom Stream"). Compression was added on the OUTBOUND side first; the inbound side has been a known asymmetry since 2026-03-31. Pitfall 8 closes this loop. Avoid the parallel temptation to "improve compression later" with deflate (Pitfall 9).

## Sources

- `/Users/lakshmanturlapati/Desktop/FSB/.planning/PROJECT.md` -- v0.9.45rc1 milestone goals (lines 11-26, 181-190, 252-260)
- `/Users/lakshmanturlapati/Desktop/FSB/.planning/MILESTONES.md` -- v0.9.40 sidepanel orphan recovery + 15 .catch swallow replacements (lines 3-22); v0.9.36 visual session lifecycle; v0.9.35 MCP bridge reconnect; v0.9.27 dashboard refresh deferral; v0.9.25 defensive `char` suppression; v0.9.9.1 LZ-string introduction
- `/Users/lakshmanturlapati/Desktop/FSB/.planning/phases/209-remote-control-handlers/209-01-SUMMARY.md` -- modifier validation, `Number.isFinite`, ext:remote-control-state pattern
- `/Users/lakshmanturlapati/Desktop/FSB/ws/ws-client.js` -- outbound `_lz` envelope (line 588), missing inbound branch in `_handleMessage` (line 918), keepalive setInterval (line 614)
- `/Users/lakshmanturlapati/Desktop/FSB/ws/mcp-bridge-client.js` -- chrome.alarms reconnect pattern (lines 205, 219)
- `/Users/lakshmanturlapati/Desktop/FSB/agents/agent-manager.js` -- `bgAgents` storage key (line 8), normalization patterns
- `/Users/lakshmanturlapati/Desktop/FSB/agents/agent-scheduler.js` -- `chrome.alarms.onAlarm` (background.js:12532), `clearAllAlarms` prefix-namespace pattern
- `/Users/lakshmanturlapati/Desktop/FSB/content/dom-stream.js` -- MutationObserver + rAF batching (line 670-689); silent `.catch(function(){})` at line 653 (a target of the diagnostic-logging milestone work)
- `/Users/lakshmanturlapati/Desktop/FSB/showcase/js/dashboard.js:3517-3518` -- existing inbound `_lz` decompression on the dashboard side (the symmetry FSB extension is missing)
- `/Users/lakshmanturlapati/Desktop/FSB/CLAUDE.md` -- MV3 SW lifecycle constraints; "no build system" simplicity discipline; security-first design principles
- RFC 7692 (permessage-deflate) -- referenced as a pattern to AVOID introducing (Pitfall 9). Stateful sliding window per connection vs. LZ-string base64 stateless per message.

---
*Pitfalls research for: FSB v0.9.45rc1 -- Sync surface, agent sunset, stream reliability*
*Researched: 2026-04-28*
