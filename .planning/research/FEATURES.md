# Feature Landscape

**Domain:** Remote browser automation control, WebSocket relay, real-time DOM streaming, background agents
**Researched:** 2026-03-17
**Confidence:** HIGH for agent features (code reviewed), MEDIUM for WebSocket/DOM cloning (patterns validated via web research)

---

## Existing Code Inventory

Before listing features, critical context: substantial code already exists for this milestone. Assessed via direct code review.

| Module | Status | What Exists |
|--------|--------|-------------|
| `agents/agent-manager.js` | Complete | CRUD, run history (50 max), replay stats, storage coordination, cache layer |
| `agents/agent-executor.js` | Complete | Background tab lifecycle, replay-first/AI-fallback, script extraction, 3 concurrent max, 4-min timeout |
| `agents/agent-scheduler.js` | Complete | chrome.alarms integration, interval/daily/once scheduling, double-run guards, SW restart recovery |
| `agents/server-sync.js` | Complete | HTTP sync to server, retry with exponential backoff, offline queue (100 cap), hash key auth |
| `server/server.js` | Partial | Express + SQLite + SSE. Has auth, agents CRUD, SSE streaming. Missing: WebSocket, DOM relay, remote task commands |
| `server/src/db/schema.js` | Complete | hash_keys, agents, agent_runs tables with proper indexes |
| `server/src/routes/sse.js` | Complete | Unidirectional SSE with keepalive, per-hashKey client tracking |
| `showcase/dashboard.html` | Partial | Stats bar, agent grid, run history panel, login via hash key paste. Missing: QR scan, DOM viewer, task creation form, WS connection |

**Implication:** Background agents and replay are DONE. The real work is: WebSocket relay, QR pairing, remote task creation, live monitoring, and DOM cloning.

---

## Table Stakes

Features users expect when "remote control dashboard" is promised. Missing = product feels broken.

| Feature | Why Expected | Complexity | Depends On (existing) | Notes |
|---------|--------------|------------|----------------------|-------|
| WebSocket relay server | SSE is read-only. Remote control requires bidirectional commands. Without WS, dashboard cannot send tasks to extension | Med | server.js (rewrite SSE to WS) | Use `ws` npm package. Room-based routing: each hashKey = one room. Chrome 116+ keeps MV3 service worker alive with active WS (send keepalive every 20s). Confirmed in official Chrome docs |
| QR code pairing | Hash key paste (current flow) is terrible UX. Users expect scan-and-go device linking | Low | Existing hash key generation (`/api/auth/register`) | Extension generates QR encoding `{ hashKey, serverUrl }`. Dashboard uses camera or file upload to decode. Libraries: `qrcode` (generation), `jsQR` (decoding). No new auth protocol -- QR is just a transport for the existing hash key |
| Remote task creation | The core promise. "Type a task on your phone dashboard, watch your PC browser execute it" | Med | WebSocket relay, extension WS command handler | Dashboard sends `{ type: "task:create", payload: { task, targetUrl } }` via WS. Extension receives, calls existing `executeAutomationTask()`. Need new message dispatcher in SW |
| Live task monitoring | Users need to see what FSB is doing remotely. Without it, remote task creation is fire-and-forget | Med | WebSocket relay, existing progress/action events | Extension already generates: phase detection, progress %, AI action summaries (v0.9.5), action results. Forward these as WS events. Dashboard renders progress bar + action feed |
| Connection status indicator | Users must know "is my browser connected right now?" Trust depends on this | Low | WebSocket heartbeat | Heartbeat ping/pong every 20s. Dashboard shows: connected (green) / disconnected (red) / reconnecting (yellow). Partially built -- `dash-sse-status` badge exists in dashboard.html |
| Agent monitoring on dashboard | Users expect to see their background agents, run history, success rates, costs | Low | Already built (server DB, dashboard UI). Upgrade SSE to WS | Existing dashboard.html has complete stats bar, agent grid, run history panel. Just needs transport upgrade from SSE to WS |

---

## Differentiators

Features that make FSB's remote control compelling beyond basic "send task, see result."

| Feature | Value Proposition | Complexity | Depends On | Notes |
|---------|-------------------|------------|------------|-------|
| Real-time DOM cloning stream | See the actual page reconstructed live on dashboard -- not a screenshot, not a video. Lightweight text deltas, images from original CDN | High | WebSocket relay, content script DOM serializer | The hardest and most impressive feature. Architecture: (1) Full DOM snapshot on task start -- serialize document HTML, strip scripts, rewrite relative URLs to absolute. (2) MutationObserver streams incremental deltas (node add/remove, attribute change, text change). (3) Dashboard reconstructs in sandboxed iframe. Images load from original CDN (no proxy per PROJECT.md). Estimated payload: 50-500KB initial snapshot, 0.1-5KB per delta batch. Use rrweb's approach (snapshot + incremental) but custom-built (rrweb is 50KB+ with unneeded features) |
| AI action summaries on dashboard | Human-readable descriptions of what FSB is doing: "Clicking Add to Cart on Amazon" appearing live on dashboard | Low | WebSocket relay | Already fully built in v0.9.5 (fire-and-forget AI summaries, 2.5s timeout). Just forward `actionSummary` events over WS to dashboard |
| Replay cost savings display | Show exactly how much money automation replay saved vs AI-only. Makes the value proposition tangible | Low | Existing replayStats in agent-manager.js | Already tracked per-agent: totalReplays, totalAISaves, estimatedCostSaved. Already shown in dashboard stats bar (`stat-cost-saved`). Just ensure WS pushes updated stats |
| Multi-agent status view | See all running agents simultaneously with their progress and tab status | Med | agent-executor.js `getRunningAgents()`, WebSocket relay | AgentExecutor already tracks running agents with tabId and runningFor duration. Surface via periodic WS status push |
| Agent creation from dashboard | Create new background agents without opening the extension popup. Full remote management | Med | WebSocket relay, reverse command channel | Dashboard form -> WS -> relay -> extension -> agentManager.createAgent(). Needs: form UI on dashboard, new WS message type, command handler in extension |
| Task templates | Pre-configured common tasks (e.g., "check Amazon price for [X]") launchable with one click | Low | Remote task creation working | Pure dashboard feature. Store templates in localStorage or server DB. Each template = { name, task, targetUrl }. No extension changes needed |

---

## Anti-Features

Features to explicitly NOT build. These are scope traps.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Video/screenshot streaming | Bandwidth-heavy (1-5 Mbps vs 1-50 KB/s for DOM deltas), encoding complexity, latency. PROJECT.md explicitly prohibits: "DOM cloning with CDN images, not visual capture" | DOM cloning with incremental mutations. Images load from original CDN URLs in the cloned DOM |
| Headless server-side execution | PROJECT.md: "server is relay only, user's browser must stay active." Server has no Chrome instance. Adding one turns a relay into a SaaS product | Keep all execution in user's browser. Server only routes messages between dashboard and extension |
| User account system / login | Adds authentication complexity, password management, GDPR obligations. Hash keys are simpler and anonymous | Hash key auth. Extension generates unique key, dashboard uses it to pair. No passwords, no email, no PII |
| Persistent always-on WebSocket | Battery drain, bandwidth waste, fights MV3 SW lifecycle. Extension should not maintain WS when no dashboard is watching | Connect WS only when user has dashboard open or agents are running. Use `chrome.alarms` for periodic check-in otherwise |
| Proxy/tunnel for page resources | Proxying images/CSS through server adds bandwidth costs, latency, and legal/CORS issues | Images and resources in cloned DOM load directly from original CDN URLs. Sandboxed iframe handles naturally |
| Mobile native app | Native app = separate product with separate maintenance burden | Make dashboard responsive and PWA-installable. Web works on mobile browsers already |
| Multi-user shared dashboards | Access control, permissions, team management = massive scope creep for personal automation | Single hash key = single user. Each user gets isolated view |
| CAPTCHA solving integration | Third-party integration complexity. Users can solve manually | Detect CAPTCHA, notify user via dashboard, pause agent, resume after manual solve |
| Full rrweb library integration | 50KB+ bundle, includes canvas recording, mouse tracking, input replay -- overkill for live DOM viewing | Build minimal custom DOM serializer. Only need: HTML serialization, MutationObserver deltas, URL rewriting. Skip: mouse tracking, input recording, canvas support |

---

## Feature Dependencies

```
WebSocket Relay Server (MUST BUILD FIRST)
  |
  +---> QR Code Pairing (needs relay URL to encode in QR)
  |
  +---> Remote Task Creation (needs bidirectional WS channel)
  |       |
  |       +---> Task Templates (needs remote task creation working)
  |
  +---> Live Task Monitoring (needs event forwarding over WS)
  |       |
  |       +---> AI Action Summaries on Dashboard (subset of monitoring events)
  |
  +---> DOM Cloning Stream (needs high-throughput WS channel)
  |
  +---> Agent Creation from Dashboard (needs reverse command channel)
  |
  +---> Agent Status Updates (replaces current SSE push)

Background Agents (ALREADY COMPLETE -- no dependencies)
  |
  +---> Replay Mode (ALREADY COMPLETE)
  |
  +---> Server Sync (ALREADY COMPLETE -- HTTP with queue)
  |
  +---> Cost Savings Display (ALREADY TRACKED -- display only)

Extension WS Client (MUST BUILD)
  |
  +---> SW keepalive (20s ping, Chrome 116+ native support)
  |
  +---> WS reconnection on SW restart (read hashKey from storage, reconnect)
  |
  +---> WS message dispatcher (route incoming commands to handlers)

Dashboard WS Client (MUST BUILD)
  |
  +---> Connection UI (status badge, reconnect button)
  |
  +---> Event rendering (progress bar, action feed, DOM viewer)
```

---

## MVP Recommendation

### Phase 1: Infrastructure (WebSocket + Pairing)
1. **WebSocket relay server** -- everything depends on this. Add `ws` to existing Express server. Room routing by hashKey. Keepalive at 20s
2. **Extension WS client** -- service worker connects to relay, sends keepalive, dispatches incoming commands, forwards outgoing events
3. **QR code pairing** -- extension generates QR in popup/options page. Dashboard decodes via camera or paste. Low effort, high UX impact
4. **Connection status** -- heartbeat-based indicator on dashboard

### Phase 2: Core Remote Control
5. **Remote task creation** -- dashboard form sends task via WS to extension. Extension calls existing automation infrastructure
6. **Live task monitoring** -- forward progress events (phase, %, action summary) from extension to dashboard over WS
7. **Agent dashboard upgrade** -- migrate existing SSE-based dashboard to WebSocket transport

### Phase 3: DOM Cloning (Differentiator)
8. **DOM snapshot serializer** -- content script serializes page HTML, strips scripts, rewrites URLs
9. **MutationObserver delta stream** -- incremental DOM changes sent as JSON patches over WS
10. **Dashboard DOM viewer** -- reconstruct page in sandboxed iframe from snapshot + deltas

### Defer to Post-MVP
- **Agent creation from dashboard** -- can still create agents in extension UI
- **Task templates** -- pure dashboard feature, addable anytime
- **Selective DOM region streaming** -- optimization, build full cloning first

---

## Complexity Assessment

| Feature | Extension Work | Server Work | Dashboard Work | Risk |
|---------|---------------|-------------|----------------|------|
| WebSocket relay | Med (WS client in SW, keepalive, reconnect, message dispatch) | Med (ws package, room routing by hashKey, connection tracking) | Low (upgrade WS client from SSE) | MV3 SW lifecycle -- must handle restarts gracefully |
| QR pairing | Low (generate QR with hash+URL) | None | Low (camera scan or paste decode) | Camera API permission on dashboard |
| Remote task creation | Med (WS command handler -> executeAutomationTask bridge) | Low (message passthrough routing) | Med (task form, target URL input, status display) | Task execution conflicts with user activity on same browser |
| Live monitoring | Low (forward existing events over WS) | Low (message routing) | Med (progress bar, action feed, phase indicator) | Event volume -- need throttling for fast actions |
| DOM cloning | High (DOM serializer, MutationObserver, delta batching, URL rewriting) | Low (binary WS frame passthrough) | High (DOM reconstructor, sandboxed iframe, CSS/image loading) | Payload size, cross-origin images, script stripping edge cases |
| Agent stats upgrade | None (already syncing via HTTP) | Low (add WS push for real-time) | Low (already built, swap transport) | Minimal |

---

## Key Technical Considerations

### MV3 Service Worker + WebSocket
- Chrome 116+: active WS connections keep SW alive (official Chrome docs confirm)
- Must send keepalive every 20 seconds to prevent SW termination
- On SW restart: read hashKey from `chrome.storage.local`, reconnect to relay
- `chrome.alarms` already in manifest permissions -- use as fallback heartbeat
- Existing `offscreen` permission available if needed for WS fallback

### WebSocket Message Protocol
```javascript
// Extension -> Relay -> Dashboard
{ type: "task:progress", payload: { phase, progress, summary, action } }
{ type: "task:complete", payload: { success, result, duration, cost } }
{ type: "dom:snapshot", payload: { html, baseUrl, timestamp } }
{ type: "dom:delta", payload: { mutations: [...], timestamp } }
{ type: "agent:status", payload: { agents: [...] } }
{ type: "agent:run", payload: { agentId, runResult } }
{ type: "extension:status", payload: { connected: true, version, activeTab } }

// Dashboard -> Relay -> Extension
{ type: "task:create", payload: { task, targetUrl, options } }
{ type: "task:cancel", payload: { sessionId } }
{ type: "agent:create", payload: { name, task, targetUrl, schedule } }
{ type: "agent:toggle", payload: { agentId } }
{ type: "dom:subscribe", payload: { tabId } }
{ type: "dom:unsubscribe", payload: {} }

// Bidirectional
{ type: "ping" } / { type: "pong" }
```

### DOM Cloning Architecture
1. **Serialization (content script):** `document.documentElement.outerHTML`, strip `<script>` tags, rewrite relative URLs (`src`, `href`, `srcset`, `style` background URLs) to absolute using `document.baseURI`
2. **Delta capture:** `MutationObserver` watching `{ childList: true, attributes: true, characterData: true, subtree: true }`. Batch mutations every 200-500ms to avoid flooding
3. **Transmission:** JSON for metadata + HTML strings. Full snapshot could be compressed (but adds latency -- start uncompressed, optimize later)
4. **Reconstruction (dashboard):** `<iframe sandbox="allow-same-origin" srcdoc="...">`. Apply deltas via DOM manipulation inside iframe. Sandbox prevents script execution
5. **Images:** Load from original URLs. Cross-origin images will show if server sends proper CORS headers (most CDNs do). Broken images are acceptable -- this is monitoring, not pixel-perfect mirroring

### QR Code Flow
1. Extension generates hash key via existing `/api/auth/register` endpoint
2. Extension renders QR encoding: `JSON.stringify({ hashKey, serverUrl })` using `qrcode` library (or canvas-based generator for zero dependencies)
3. Dashboard offers two pairing methods: (a) camera scan via `getUserMedia`, (b) manual hash key paste (already built)
4. Dashboard decodes QR -> extracts hashKey -> opens WS connection to relay with that key
5. Both extension and dashboard are now in the same relay room, authenticated by hashKey

---

## Sources

### HIGH confidence (official docs, codebase review)
- [Chrome WebSocket in Service Workers](https://developer.chrome.com/docs/extensions/how-to/web-platform/websockets) -- confirms Chrome 116+ WS keepalive for MV3 SW
- [Longer extension service worker lifetimes](https://developer.chrome.com/blog/longer-esw-lifetimes) -- official blog on extended SW lifetimes
- Existing codebase: `agents/`, `server/`, `showcase/` directories -- confirmed built features via direct code review

### MEDIUM confidence (validated patterns)
- [rrweb - DOM recording/replay library](https://github.com/rrweb-io/rrweb) -- reference architecture for snapshot + incremental delta approach
- [Menlo Security Smart DOM](https://www.menlosecurity.com/blog/the-mobile-isolation-era-begins-smart-dom) -- validates DOM mirroring as proven technique
- [mirror-dom multi-client DOM sharing](https://github.com/fooby/mirror-dom) -- small reference implementation of DOM mirroring over WebSocket
- [QR cross-device authentication pattern](https://medium.com/@adeesha-savinda/how-to-implement-qr-code-authentication-login-21a78a3e7418) -- standard QR pairing flow
- [WebSocket relay server patterns](https://github.com/nick-hill-dev/wsrelay-server) -- relay server for browser-to-browser communication
- [Chrome MV3 WebSocket setup guide](https://dev.to/orieasy1/how-to-set-up-websocket-communication-between-a-chrome-extension-and-a-nodejs-server-1ad2) -- practical implementation reference
