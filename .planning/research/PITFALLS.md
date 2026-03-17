# Pitfalls Research

**Domain:** Remote control dashboard, WebSocket relay, DOM cloning, background agents, automation replay -- added to existing Chrome Extension MV3 project
**Researched:** 2026-03-17
**Confidence:** HIGH (most pitfalls verified against Chrome developer docs and existing codebase)

## Critical Pitfalls

### Pitfall 1: MV3 Service Worker Kills WebSocket Connections

**What goes wrong:**
The service worker opens a WebSocket to the fly.io relay server. After 30 seconds of no extension events, Chrome terminates the service worker, closing the WebSocket. The dashboard shows "disconnected" and all live DOM streaming stops. Users think the extension crashed.

**Why it happens:**
Chrome MV3 service workers have a hard 30-second idle timeout. Prior to Chrome 116, WebSocket activity did NOT count as "activity" -- the worker would die even with an active socket. Starting with Chrome 116, WebSocket message exchange resets the idle timer, but only if messages are actually being sent/received within that window.

**How to avoid:**
- Set `"minimum_chrome_version": "116"` in manifest.json (already requires modern Chrome).
- Implement a 20-second keepalive ping interval on the WebSocket (10s buffer before the 30s deadline). The existing codebase already uses `chrome.alarms` for agent scheduling -- do NOT rely on alarms for keepalive (minimum alarm interval is 30s, too close to the deadline).
- Use `setInterval()` inside the service worker to send keepalive pings while the WebSocket is connected. Clear interval on disconnect.
- Handle reconnection gracefully: exponential backoff (1s, 3s, 8s, 15s) with jitter. The service worker WILL restart on the next chrome.alarms fire or user interaction, so reconnect logic must be idempotent.
- Consider an offscreen document as a fallback for WebSocket hosting if the service worker approach proves unreliable during testing.

**Warning signs:**
- Dashboard shows "connected" then goes blank after ~30 seconds of no user interaction with the extension.
- Server logs show WebSocket connections opening and closing in rapid succession.
- `chrome://serviceworker-internals` shows the FSB worker constantly restarting.

**Phase to address:**
Server relay infrastructure phase (Phase 1). This is foundational -- if the WebSocket dies, nothing else works.

---

### Pitfall 2: DOM Serialization Bandwidth Explosion

**What goes wrong:**
Serializing the full DOM of a complex page (Amazon product page, Gmail inbox) produces 2-15MB of HTML. Sending this every time the page changes saturates the user's upload bandwidth, causes visible lag on the page being automated, and overwhelms the relay server.

**Why it happens:**
Naive approach: `document.documentElement.outerHTML` on every MutationObserver callback. Complex SPAs have 5,000-50,000 DOM nodes. Even "small" changes (a spinner appearing) trigger a full re-serialize if you're not diffing.

**How to avoid:**
- Use a two-phase approach inspired by rrweb's architecture:
  1. **Initial full snapshot**: Serialize DOM once when streaming starts. Assign stable numeric IDs to every node (rrweb pattern). Strip inline images -- replace `<img src="data:...">` with placeholder, load images via their original URLs on the dashboard side.
  2. **Incremental mutations**: Use MutationObserver to capture only changes (added nodes, removed nodes, attribute changes, text changes). Send compact delta events referencing node IDs.
- Throttle mutation batches to 200-500ms intervals. MutationObserver already batches, but you need a secondary debounce to avoid flooding the WebSocket.
- Set a size cap per message (50KB). If a mutation batch exceeds this, drop it and send a "resync" flag that triggers a fresh full snapshot.
- Never serialize `<script>`, `<style>` content, or `<svg>` path data beyond a reasonable limit.
- Offload serialization to a Web Worker if performance testing shows main thread impact > 5ms per batch.

**Warning signs:**
- Pages feel sluggish while DOM streaming is active.
- Network tab shows sustained upload > 500KB/s from the extension.
- Dashboard rendering lags behind actual page state by more than 2 seconds.

**Phase to address:**
DOM cloning stream phase (Phase 3). Must be designed right from the start -- retrofitting incremental updates onto a full-snapshot system is a near-rewrite.

---

### Pitfall 3: QR Pairing Hash Reuse Enables Session Hijacking (QRLJacking)

**What goes wrong:**
If the QR code encodes a static hash that never rotates, anyone who photographs or screenshots the QR code can pair their own dashboard to the victim's extension permanently. This is the exact attack vector documented by OWASP as QRLJacking.

**Why it happens:**
The existing `hash.js` generates a single HMAC-SHA256 hash per user. This hash is used as the auth token for all API calls (`X-FSB-Hash-Key` header). If the QR code simply encodes this hash, it's equivalent to sharing your API key via a photograph.

**How to avoid:**
- QR code must encode a **one-time pairing token**, NOT the persistent hash key.
- Flow: Extension generates a random pairing token (32 bytes, hex) -> stores it in memory with 60-second TTL -> encodes it in QR -> dashboard scans QR -> sends pairing token to server -> server validates token against the extension's registration -> server returns a session-scoped dashboard token -> pairing token is immediately invalidated.
- The pairing token must expire after first use OR after 60 seconds, whichever comes first.
- Rate-limit pairing attempts: max 3 per minute per hash key.
- Display pairing status in the extension popup: "Dashboard paired at [time] from [IP]" so users can detect unauthorized pairing.
- Add a "Revoke all dashboard sessions" button.

**Warning signs:**
- QR code doesn't change when regenerated.
- No expiry mechanism on pairing tokens.
- Dashboard works indefinitely after a single scan with no session renewal.

**Phase to address:**
QR pairing phase (Phase 2). Security architecture must be decided before any pairing code is written.

---

### Pitfall 4: Service Worker 5-Minute Hard Kill During Agent Execution

**What goes wrong:**
The `AgentExecutor` runs automation tasks in background tabs. The existing `EXECUTION_TIMEOUT` is 4 minutes, which seems safe under Chrome's 5-minute event handler limit. But the 5-minute limit applies to the **event handler** that triggered the work, not to the total service worker lifetime. If the alarm fires, the `onAlarm` handler must resolve within 5 minutes, but Chrome may also kill the worker at 30 seconds of idle if no extension APIs are being called during the automation.

**Why it happens:**
During automation, the service worker is `await`-ing message responses from content scripts via `chrome.tabs.sendMessage`. Between messages, there may be 2-10 second gaps (page loading, stability detection). Chrome sees these gaps as "idle" and may terminate the worker mid-task. The `executeAutomationTask` function in `background.js` keeps the worker alive through continuous API calls, but a long page load with no messages can still trigger termination.

**How to avoid:**
- The existing `chrome.alarms` approach is correct for scheduling. For execution keepalive, maintain a heartbeat: send `chrome.runtime.sendMessage` to self or use `chrome.storage.session.set` every 25 seconds during agent execution to reset the idle timer.
- Alternatively, open a `chrome.runtime.Port` from the content script to the service worker during agent execution. Open ports prevent service worker termination entirely.
- The `_executeWithTimeout` wrapper should include a keepalive interval that clears on completion.
- Test with `chrome://serviceworker-internals` -- enable "Update on reload" and watch for unexpected terminations during long-running agents.

**Warning signs:**
- Agents that work on fast pages succeed, but agents on slow-loading pages (Workday, Taleo) consistently fail with "Extension context invalidated" errors.
- `_running` map is empty on service worker restart but the background tab is still open.

**Phase to address:**
Background agent execution phase (Phase 5). The existing agent executor code needs this hardening before real-world use.

---

### Pitfall 5: Automation Replay Brittleness from Selector Rot

**What goes wrong:**
Recorded scripts store selectors from the original successful AI run. When the target site updates its UI (new deploy, A/B test, locale change), selectors break. The replay fails at step N, falls back to AI, and then the new script overwrites the old one. If the site changes frequently, replay never works -- every run is an AI run, defeating the cost-saving purpose.

**Why it happens:**
The existing `_extractRecordedScript` captures `action.params` which include selectors chosen by the AI. These selectors may use class names, data attributes, or nth-child patterns that are fragile. The existing FSB system already has uniqueness-scored selectors and multi-strategy fallbacks for live automation, but recorded scripts store a single selector per step.

**How to avoid:**
- Store multiple selector strategies per step (the FSB system already generates these for live automation -- reuse the same selector array format).
- Add a `urlPattern` check before replay: if the page URL structure changed significantly, skip replay entirely.
- Implement "soft validation" before each replay step: verify the target element exists and matches expected attributes (tag, text content, visible) before clicking. If validation fails, abort replay at that step rather than clicking the wrong element.
- Track replay success rate per agent. If replay fails 3 consecutive times, auto-disable replay and alert the user that the site may have changed.
- Never overwrite a working script with a new one unless the new run also succeeds. The current code overwrites on every AI success, which means a flaky AI run can replace a reliable script.

**Warning signs:**
- Agent run history shows alternating replay/ai_fallback/replay/ai_fallback pattern.
- `replayFailedAtStep` is always the same step number (indicates a persistent selector break).
- `replayStats.totalAISaves` is growing faster than `totalReplays`.

**Phase to address:**
Automation replay phase (Phase 6). Must be designed alongside the recording mechanism, not bolted on after.

---

### Pitfall 6: SSE vs WebSocket Architecture Mismatch

**What goes wrong:**
The existing server uses SSE (Server-Sent Events) for real-time updates to the dashboard. SSE is one-directional (server to client). But DOM streaming needs bidirectional communication: dashboard needs to send commands back (start task, stop task, request resync). The codebase now has SSE for dashboard updates AND will need WebSocket for extension-to-server communication. Two real-time channels create complexity: race conditions, ordering issues, and split state.

**Why it happens:**
SSE was a reasonable choice for the initial agent status updates -- it's simpler than WebSocket for server-push. But adding remote task control and DOM streaming requires bidirectional flow, and maintaining both SSE and WebSocket creates unnecessary complexity.

**How to avoid:**
- Migrate to WebSocket for ALL real-time communication. Drop SSE entirely. The server already needs WebSocket for the extension relay -- use the same WebSocket for dashboard connections too.
- Single connection type means single reconnection logic, single auth flow, single message routing system.
- If SSE must be kept (for simplicity of the showcase/landing page which only needs to display status), isolate it to the public showcase page only. The authenticated dashboard should use WebSocket exclusively.
- Define a clear message protocol: `{ type: "dom_snapshot" | "dom_mutation" | "task_status" | "task_command" | "agent_update", payload: ... }`.

**Warning signs:**
- Dashboard has both `EventSource` and `WebSocket` connections open simultaneously.
- State updates arrive out of order because SSE and WebSocket have different latency characteristics.
- Two different reconnection/auth flows to maintain.

**Phase to address:**
Server relay infrastructure phase (Phase 1). Architecture decision must be made before building the relay.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Full DOM snapshot every N seconds instead of incremental diffs | Simple implementation, no node ID tracking | 10-100x bandwidth, unusable on complex pages | Never in production; acceptable for 1-day prototype to validate concept |
| Static hash in QR code | No pairing token flow needed | Permanent session hijacking vulnerability | Never |
| Single WebSocket connection for all agents + DOM stream | Simpler connection management | Head-of-line blocking; one slow agent's DOM stream delays all others | Acceptable for v1 with < 5 concurrent agents |
| Storing recorded scripts in `chrome.storage.local` | No server dependency, works offline | Storage limit (10MB with unlimitedStorage, but scripts accumulate) | Acceptable with periodic cleanup of old scripts |
| Hardcoded 500ms/800ms/2000ms delays in replay steps | Simple, predictable timing | Too slow on fast pages, too fast on slow pages | MVP only; replace with observation-based stability detection (already exists in FSB) |
| `better-sqlite3` on fly.io | Fast, embedded, no external DB dependency | Single-machine limit, no replication, data loss on machine replacement | Acceptable for single-user/small-scale; switch to Turso/LiteFS for persistence |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| fly.io WebSocket | Assuming `ws://` works; fly.io terminates TLS at edge so internal is HTTP but external must be `wss://` | Use `wss://` in client code; server listens on plain HTTP/WS internally. fly.io handles TLS. Set `force_https = true` in fly.toml |
| fly.io idle timeout | Default idle timeout kills inactive WebSocket connections | Set `[http_service.http_options] idle_timeout = "300s"` (5 minutes) in fly.toml. Server-side keepalive pings every 30s |
| fly.io machine sleep | Machines auto-stop after inactivity; first WebSocket connection gets a cold start delay | Set `min_machines_running = 1` in fly.toml or accept 2-5s cold start on first connection |
| chrome.storage.local from content script | Content scripts can't directly access `chrome.storage`; must message service worker | All storage access goes through `chrome.runtime.sendMessage` to the service worker |
| MutationObserver in content script | Observing `document.body` with `subtree: true` captures everything including FSB's own Shadow DOM overlay changes | Filter mutations: skip nodes inside FSB's Shadow DOM host element. Check `mutation.target.closest('.fsb-overlay-host')` or equivalent |
| Cross-origin images in DOM clone | Dashboard tries to render `<img>` from the original page; CORS blocks some images | Use original `src` URLs directly (browser will load them). For `data:` URIs, pass them through. For truly blocked images, show a placeholder |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Sending every MutationObserver callback immediately | WebSocket message queue grows unboundedly; page jank | Batch mutations with 200-500ms debounce; drop batches if queue > 10 | Immediately on any SPA with frequent renders (React, Vue) |
| JSON.stringify on full DOM snapshot | Main thread blocked 50-200ms on complex pages | Use a Web Worker for serialization; or stream the serialization in chunks | Pages with > 5,000 DOM nodes |
| Dashboard rendering full DOM on every mutation | Dashboard tab consumes 500MB+ RAM, becomes unresponsive | Apply mutations incrementally to an existing DOM mirror; never `innerHTML` the full snapshot | After 5+ minutes of continuous streaming |
| WebSocket reconnection storm | Multiple tabs/windows all reconnect simultaneously after server restart | Add random jitter (0-5s) to reconnection delay; deduplicate connections by extension instance ID | When server restarts with > 3 connected clients |
| Storing all run history in chrome.storage.local | Storage reads slow down as data grows; 10MB practical limit | Cap history at 50 runs per agent (already done); archive old runs to server | After ~200 total agent runs across all agents |
| Replaying scripts without verifying page state | Replay clicks on wrong elements because page loaded differently | Add pre-step element verification: check element exists, is visible, matches expected tag/text | On sites with A/B tests, login walls, or dynamic content |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| QR code contains the persistent hash key | Anyone who sees/photographs the QR can control the extension permanently | QR encodes a one-time pairing token with 60-second TTL; hash key never leaves the extension |
| Hash key transmitted in URL query parameters | Appears in server logs, browser history, referrer headers | Always use `X-FSB-Hash-Key` header (already implemented), never in URL |
| No rate limiting on pairing endpoint | Brute-force pairing token guessing | Rate limit: 3 attempts/minute per IP, 5 attempts/minute per hash key |
| Dashboard sends arbitrary automation commands | Compromised dashboard session could execute malicious automation | Validate task descriptions server-side; extension should confirm remote tasks via user notification before executing |
| WebSocket messages not authenticated per-message | After initial auth, any message on the socket is trusted | Include hash key in WebSocket upgrade request AND validate message origin for sensitive operations |
| Recorded scripts contain sensitive data | Selector params might include form values, personal data from the original recording | Strip `value` fields from type/input actions in recorded scripts; only store selector + action type |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| DOM clone shows stale state after reconnection | User sees a frozen page and thinks automation is stuck | Show a clear "Reconnecting..." overlay; request fresh snapshot on reconnect; timestamp the last update visibly |
| No indication of dashboard connection in extension | User doesn't know if their browser is being remotely viewed | Show a persistent subtle indicator (small dot/badge) in the extension popup when a dashboard is connected |
| QR code too small or low contrast | Users can't scan it, especially on laptop screens at arm's length | Generate QR at minimum 200x200px with high error correction (level H); include a manual pairing code fallback |
| Agent runs happen silently in background | User doesn't know tabs are being opened/closed in their browser | Show a notification for each agent run start/completion; group notifications if multiple agents fire simultaneously |
| Dashboard shows raw error messages from AI failures | Non-technical users see "ECONNREFUSED" or "context invalidated" | Map common errors to human-readable messages: "The page took too long to load" instead of "Navigation timeout after 15000ms" |

## "Looks Done But Isn't" Checklist

- [ ] **WebSocket relay:** Often missing reconnection after laptop sleep/wake cycle -- verify extension reconnects after machine resume, not just network blips
- [ ] **DOM streaming:** Often missing iframe content -- verify `<iframe>` contents are serialized (or explicitly excluded with a placeholder)
- [ ] **DOM streaming:** Often missing Shadow DOM content -- verify elements inside Shadow DOM roots are captured (FSB itself uses Shadow DOM for overlays)
- [ ] **QR pairing:** Often missing session expiry -- verify dashboard sessions expire after 24 hours of inactivity, not just when the extension closes
- [ ] **Remote task control:** Often missing concurrent task prevention -- verify dashboard can't start a new task while one is already running
- [ ] **Agent replay:** Often missing navigation state verification -- verify replay confirms the page URL matches expected URL before executing steps
- [ ] **Agent replay:** Often missing scroll position -- verify replay scrolls to the target element before clicking (element may be off-screen)
- [ ] **fly.io deployment:** Often missing health check endpoint -- verify `/health` or `/` returns 200 for fly.io's health checks, otherwise machines get killed
- [ ] **fly.io deployment:** Often missing persistent volume for SQLite -- verify `better-sqlite3` database file is on a fly.io volume, not the ephemeral filesystem

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Service worker killed mid-automation | MEDIUM | Agent executor detects orphaned tabs on restart via `chrome.tabs.query`; close orphaned background tabs; reschedule the interrupted agent for retry |
| DOM stream out of sync (dashboard shows wrong state) | LOW | Dashboard sends "resync" command; extension takes fresh full snapshot; dashboard replaces entire mirror |
| QR hash compromised | LOW | User clicks "Revoke all sessions" in extension; server invalidates all dashboard tokens for that hash key; user re-pairs |
| Recorded script broken by site update | LOW | Auto-detected by 3 consecutive replay failures; extension clears script and runs AI on next trigger; notifies user |
| fly.io machine data loss (SQLite on ephemeral disk) | HIGH | All data lost; must re-pair, re-register agents on server. Prevention: use fly.io volumes or migrate to Turso |
| WebSocket reconnection storm after server deploy | MEDIUM | Server tracks connection count per hash key; rejects excess connections with "retry-after" header; clients respect backoff |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Service worker kills WebSocket | Phase 1: Server relay | WebSocket stays connected for 5+ minutes with no user interaction; verify via `chrome://serviceworker-internals` |
| DOM serialization bandwidth | Phase 3: DOM cloning | Measure bandwidth on Amazon product page: must be < 100KB/s sustained after initial snapshot |
| QR session hijacking | Phase 2: QR pairing | Pairing token expires after single use; second scan of same QR code fails; verify with manual test |
| 5-minute kill during agent execution | Phase 5: Background agents | Run agent against slow-loading Workday page (15+ second loads); verify completion without "context invalidated" |
| Replay selector rot | Phase 6: Automation replay | Modify target page DOM (simulate site update); verify replay detects mismatch and falls back cleanly |
| SSE vs WebSocket mismatch | Phase 1: Server relay | Only one real-time transport exists in the codebase after Phase 1; no EventSource in dashboard code |
| fly.io data loss | Phase 1: Server relay | Server data survives `fly machine restart`; verify SQLite is on a volume mount |
| Cross-origin image loading | Phase 3: DOM cloning | Dashboard renders Amazon/Gmail page clone; images load without CORS errors |

## Sources

- [Chrome WebSocket in Service Workers docs](https://developer.chrome.com/docs/extensions/how-to/web-platform/websockets) - Official Chrome documentation confirming Chrome 116+ requirement and 20-second keepalive pattern (HIGH confidence)
- [Chrome Service Worker Lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle) - 30-second idle timeout, 5-minute event handler limit (HIGH confidence)
- [chrome.alarms API](https://developer.chrome.com/docs/extensions/reference/api/alarms) - Minimum 30-second alarm interval from Chrome 120 (HIGH confidence)
- [OWASP QRLJacking](https://owasp.org/www-community/attacks/Qrljacking) - QR code login hijacking attack vector documentation (HIGH confidence)
- [rrweb session replay performance benchmark](https://www.highlight.io/blog/session-replay-performance) - DOM serialization overhead: ~6MB memory increase, ~21% CPU increase with full recording (MEDIUM confidence)
- [rrweb serialization docs](https://github.com/rrweb-io/rrweb/blob/master/docs/serialization.md) - Incremental snapshot strategy with node ID assignment (HIGH confidence)
- [fly.io WebSocket blog](https://fly.io/blog/websockets-and-fly/) - TLS termination at edge, internal plain WS, idle timeout configuration (MEDIUM confidence)
- [fly.io configuration reference](https://fly.io/docs/reference/configuration/) - idle_timeout, min_machines_running, health check configuration (HIGH confidence)
- [MV3 Service Worker keepalive discussion](https://medium.com/@dzianisv/vibe-engineering-mv3-service-worker-keepalive-how-chrome-keeps-killing-our-ai-agent-9fba3bebdc5b) - Real-world experience with AI agent service worker termination (MEDIUM confidence)

---
*Pitfalls research for: FSB v0.9.6 Agents & Remote Control*
*Researched: 2026-03-17*
