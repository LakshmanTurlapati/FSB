# Architecture Patterns

**Domain:** Remote control dashboard, WebSocket relay, QR pairing, DOM cloning, background agents for Chrome Extension MV3
**Researched:** 2026-03-17
**Confidence:** HIGH (based on codebase analysis of existing v0.9.5 + existing server/agents scaffolding + Chrome official docs)

## Executive Summary

The v0.9.6 milestone adds six major features to FSB: WebSocket relay server, showcase/dashboard site, QR pairing, real-time DOM cloning stream, background polling agents, and automation replay agents. Critically, **significant scaffolding already exists** -- the `agents/` directory has a complete agent manager, scheduler, executor with replay support, and server-sync client. The `server/` directory has an Express server with SQLite, SSE-based real-time updates, hash-key auth, and a React dashboard. This is not greenfield -- it is wiring, upgrading, and filling gaps in existing infrastructure.

The three genuinely new capabilities that require substantial new code are: (1) upgrading SSE to WebSocket for bidirectional communication (remote task creation requires server-to-extension messages), (2) DOM cloning stream via content script MutationObserver serialization, and (3) QR code pairing flow replacing the current manual hash-key entry. Everything else is enhancement of existing patterns.

## Existing Infrastructure Audit

Before defining new components, here is what already exists and its readiness state:

### Extension Side (Chrome Extension MV3)

| Component | File(s) | Status | What Works | What's Missing |
|-----------|---------|--------|------------|----------------|
| Agent Manager | `agents/agent-manager.js` | **Complete** | CRUD, run history, replay stats, storage | Nothing -- fully functional |
| Agent Scheduler | `agents/agent-scheduler.js` | **Complete** | chrome.alarms scheduling, interval/daily/once, reschedule | Nothing -- fully functional |
| Agent Executor | `agents/agent-executor.js` | **Complete** | Background tab creation, AI execution, replay with AI fallback, script recording | Nothing -- fully functional |
| Server Sync | `agents/server-sync.js` | **Partial** | HTTP POST to server for run results + agent defs, retry queue | Only pushes data. No pull (remote tasks). No WebSocket. No DOM stream. |
| Alarm Handler | `background.js:11927` | **Complete** | Fires agent, records run, reschedules, syncs to server | Nothing -- fully functional |
| Offscreen Document | `offscreen/stt.js` | **Complete** | STT via offscreen API pattern | Could host WebSocket if needed, but Chrome 116+ makes this unnecessary |

### Server Side

| Component | File(s) | Status | What Works | What's Missing |
|-----------|---------|--------|------------|----------------|
| Express Server | `server/server.js` | **Core complete** | REST API, SQLite, SSE, static dashboard serving | WebSocket upgrade, DOM relay, QR pairing endpoints, showcase page |
| Database Schema | `server/src/db/schema.js` | **Partial** | hash_keys, agents, agent_runs tables | No DOM snapshots table (not needed -- stream only), no task queue table |
| Auth Middleware | `server/src/middleware/auth.js` | **Complete** | X-FSB-Hash-Key validation | Nothing -- works for WebSocket auth too |
| Auth Routes | `server/src/routes/auth.js` | **Partial** | Register hash key, validate | No QR code generation, no pairing flow |
| Agent Routes | `server/src/routes/agents.js` | **Complete** | CRUD + run recording + SSE broadcast | Needs task creation endpoint (server -> extension) |
| SSE Routes | `server/src/routes/sse.js` | **Will be replaced** | Server-to-dashboard streaming | Replace with WebSocket for bidirectional |
| Dashboard | `server/dashboard/` | **Partial** | React + Vite, agent cards, run timeline, live feed, login | No DOM viewer, no task creation UI, no QR pairing, no showcase page |

## Recommended Architecture

### System Topology

```
+-------------------+         WebSocket          +------------------+
|  Chrome Extension |<=========================>|   FSB Server     |
|  (user's browser) |   wss://fsb.fly.dev/ws    |   (fly.io)       |
|                   |                            |                  |
|  background.js    |--- keepalive 20s --------->|  ws-handler.js   |
|  (service worker) |<-- remote tasks -----------|                  |
|                   |--- DOM stream, results --->|  SQLite + memory |
|                   |                            |                  |
|  content script   |                            |  Express + WS    |
|  (DOM observer)   |                            |                  |
+-------------------+                            +--------+---------+
                                                          |
                                               WebSocket  |  HTTPS
                                                          |
                                                 +--------+---------+
                                                 |   Dashboard      |
                                                 |   (React SPA)    |
                                                 |                  |
                                                 |  DOM viewer      |
                                                 |  Task creation   |
                                                 |  Agent monitoring|
                                                 |  QR pairing      |
                                                 +------------------+
```

### Component Boundaries

| Component | Responsibility | Communicates With | New vs Modified |
|-----------|---------------|-------------------|-----------------|
| **WebSocket Client** (extension) | Persistent connection to server, send DOM stream + results, receive remote tasks | background.js service worker, content scripts | **NEW** -- replaces `server-sync.js` HTTP calls |
| **WebSocket Handler** (server) | Manage connected extensions + dashboards, route messages, relay DOM stream | Express server, SQLite queries | **NEW** -- replaces SSE route |
| **DOM Cloning Observer** (content script) | MutationObserver-based DOM serialization, initial snapshot + incremental diffs | Extension WebSocket client via chrome.runtime messages | **NEW** content script module |
| **DOM Viewer** (dashboard) | Reconstruct DOM from snapshot + diffs, render in sandboxed iframe | Dashboard WebSocket connection | **NEW** React component |
| **QR Pairing Flow** (server + extension) | Generate pairing QR, validate scan, bind hash key to extension instance | Auth routes, extension popup/options | **NEW** route + extension UI |
| **Remote Task Queue** (server) | Accept task creation from dashboard, push to extension via WebSocket | WebSocket handler, agent routes | **NEW** route + DB table |
| **Showcase Page** (server) | Public landing page with product info, QR pairing entry point | Static files, auth routes | **NEW** static page |
| **Agent Manager** (extension) | CRUD, run history, replay stats | Agent scheduler, executor, storage | **EXISTING** -- no changes |
| **Agent Scheduler** (extension) | chrome.alarms scheduling | Agent manager, chrome.alarms API | **EXISTING** -- no changes |
| **Agent Executor** (extension) | Background tab execution, replay | Agent manager, automation task runner | **EXISTING** -- minor: add DOM stream hookup |
| **Server Sync** (extension) | HTTP fallback sync for when WS is disconnected | Server REST API | **MODIFIED** -- becomes fallback for WS |

### Data Flow

#### 1. QR Pairing Flow

```
Dashboard (new device)           Server                    Extension (paired browser)
        |                          |                              |
        |-- GET /api/auth/qr ---->|                              |
        |<-- QR image + token ----|                              |
        |                          |                              |
User scans QR in extension popup/options                         |
        |                          |<--- POST /api/auth/pair ----|
        |                          |     { pairToken, hashKey }  |
        |                          |                              |
        |                          |--- validate + bind -------->|
        |<-- WS: paired event ----|                              |
        |                          |                              |
Dashboard stores hashKey in localStorage, connects WS
```

#### 2. WebSocket Connection Lifecycle

```
Extension SW starts (install/wakeup)
    |
    v
Check serverUrl + hashKey in chrome.storage.local
    |
    v (if configured)
Open WebSocket to wss://fsb.fly.dev/ws?key={hashKey}
    |
    v
Server validates hashKey, registers connection
    |
    v
setInterval keepalive ping every 20 seconds (Chrome 116+ requirement)
    |
    +--- SW receives 'task:create' message ---> create agent + execute
    +--- Content script sends DOM diff -------> relay to dashboard WS clients
    +--- Agent run completes -----------------> send result via WS (replaces HTTP POST)
    |
    v (on SW shutdown / disconnect)
Server marks extension as offline
Dashboard shows "Extension offline" indicator
    |
    v (on reconnect)
Resend current DOM snapshot (full) to catch up dashboard
```

#### 3. DOM Cloning Stream

```
Content Script (active tab)        Background SW          Server           Dashboard
        |                              |                    |                 |
  MutationObserver fires               |                    |                 |
        |                              |                    |                 |
  Serialize mutation batch             |                    |                 |
  (add/remove/attr/text diffs)         |                    |                 |
        |                              |                    |                 |
  chrome.runtime.sendMessage           |                    |                 |
  { action: 'domDiff', diffs }  -----> |                    |                 |
        |                              |                    |                 |
        |                    ws.send('dom:diff', diffs) --> |                 |
        |                              |                    |                 |
        |                              |          relay to dashboard WS ---> |
        |                              |                    |                 |
        |                              |                    |          Patch virtual DOM
        |                              |                    |          Re-render in iframe
```

#### 4. Remote Task Creation

```
Dashboard                    Server                     Extension
    |                          |                           |
    |-- POST /api/tasks ------>|                           |
    |   { task, targetUrl }    |                           |
    |                          |-- WS: task:create ------->|
    |                          |   { taskId, task, url }   |
    |                          |                           |
    |                          |                  agentExecutor.execute()
    |                          |                  (opens background tab)
    |                          |                           |
    |                          |<-- WS: task:progress -----|
    |<-- WS: relay progress ---|   { phase, action, etc } |
    |                          |                           |
    |                          |<-- WS: task:complete -----|
    |<-- WS: relay complete ---|   { result, duration }    |
```

## Critical Architecture Decisions

### Decision 1: WebSocket in Service Worker (Not Offscreen Document)

**Use WebSocket directly in background.js service worker.**

Chrome 116+ keeps the service worker alive as long as a WebSocket has activity within the 30-second window. FSB already requires a recent Chrome version (uses alarms, offscreen, sidePanel). Setting `"minimum_chrome_version": "116"` in manifest.json is safe.

**Why not offscreen document:** An offscreen document would add a message-passing hop between the offscreen doc and the service worker. The service worker already has direct access to all extension APIs (tabs, storage, alarms, scripting). Adding an intermediary offscreen doc just for WebSocket creates unnecessary complexity. The 20-second keepalive ping is trivial to implement.

**Implementation:**
```javascript
// In background.js or new file: ws-client.js (importScripts)
let ws = null;

function connectWebSocket() {
  const config = /* from chrome.storage.local */;
  if (!config.serverUrl || !config.hashKey) return;

  ws = new WebSocket(config.serverUrl.replace('https', 'wss') + '/ws?key=' + config.hashKey);

  ws.onopen = () => {
    console.log('[FSB WS] Connected');
    // Send current state snapshot
  };

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    handleServerMessage(msg);
  };

  ws.onclose = () => {
    // Reconnect after 5 seconds
    setTimeout(connectWebSocket, 5000);
  };

  // Chrome 116+ keepalive
  setInterval(() => {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'ping' }));
    }
  }, 20000);
}
```

### Decision 2: SSE-to-WebSocket Migration Path

**Keep SSE as fallback, add WebSocket as primary.**

The server currently uses SSE (server/src/routes/sse.js) for dashboard real-time updates. SSE is unidirectional (server -> client). Remote task creation requires bidirectional communication. Rather than ripping out SSE, upgrade the server to support both:

1. WebSocket for extension connections (bidirectional: DOM stream up, tasks down)
2. WebSocket for dashboard connections (bidirectional: task creation up, DOM stream + status down)
3. SSE remains as degraded fallback for dashboards that can't connect via WS

**Server WebSocket implementation:** Use the `ws` npm package alongside Express. Express and `ws` can share the same HTTP server by handling the `upgrade` event.

### Decision 3: DOM Serialization Format (Custom Lightweight, Not rrweb)

**Use a custom lightweight serialization, not rrweb.**

rrweb is a comprehensive session recording library (pixel-perfect replay with CSS, animations, canvas, etc.). FSB's DOM cloning needs are different:

- FSB already has a DOM snapshot format (unified markdown with element refs)
- The dashboard needs a structural view of the page (what elements exist, their text, their state) -- not pixel-perfect visual replay
- Images are loaded via CDN URLs (not proxied) per PROJECT.md
- rrweb would add ~100KB+ to content scripts and is overkill

**Custom serialization approach:**

1. **Initial snapshot:** Serialize the DOM tree to a JSON structure with node IDs, tag names, attributes, text content, and computed styles for layout (display, position, dimensions). Images get their original `src` URLs (CDN, not proxied). Scripts are stripped.

2. **Incremental diffs:** MutationObserver batches changes into a compact diff format:
   ```javascript
   {
     type: 'diff',
     timestamp: Date.now(),
     mutations: [
       { op: 'add', parentId: 42, afterId: 41, node: { id: 99, tag: 'div', attrs: {...}, text: '...' } },
       { op: 'remove', id: 55 },
       { op: 'attr', id: 42, attrs: { class: 'new-class' } },
       { op: 'text', id: 43, text: 'updated text' }
     ]
   }
   ```

3. **Throttling:** Batch diffs every 500ms to avoid overwhelming the WebSocket. If more than 50 mutations in a batch, send a full re-snapshot instead (the page changed too much for diffs to be efficient).

4. **Dashboard reconstruction:** Build a virtual DOM tree from the snapshot JSON, apply diffs incrementally, render into a sandboxed iframe using `document.createElement` calls.

### Decision 4: QR Pairing Architecture

**QR encodes a one-time pairing token, not the hash key itself.**

The pairing flow:

1. Dashboard requests `GET /api/auth/qr` -- server generates a short-lived pairing token (UUID, expires in 5 minutes), returns a QR code image (server-generated SVG or base64 PNG) containing the pairing URL: `https://fsb.fly.dev/pair?token={uuid}`

2. Extension has a "Pair with Dashboard" button in options page. User scans the QR code. Extension extracts the token from the URL and sends `POST /api/auth/pair` with `{ pairToken, hashKey }`.

3. Server validates the token (not expired, not already used), binds the hashKey to the pairing session, and marks the dashboard session as paired.

4. Dashboard receives a WebSocket event `{ type: 'paired', hashKey }` and stores the hashKey, completing the connection.

**Why not encode the hash key in the QR?** The hash key is a 64-char hex string that grants full access to the account. Putting it in a QR code that could be screenshotted or intercepted is a security risk. The pairing token is single-use and short-lived.

**QR code generation:** Use `qrcode` npm package server-side to generate SVG. No client-side QR generation needed.

### Decision 5: Remote Task Queue Design

**Tasks are ephemeral (not persisted to DB), pushed directly via WebSocket.**

Remote task creation from the dashboard does not need a persistent task queue because:

- Tasks execute immediately on the user's browser (which must be online and connected)
- If the extension is offline, the task cannot execute (browser must stay active per PROJECT.md)
- Task results are already stored as agent runs in the existing `agent_runs` table

**Flow:** Dashboard sends `POST /api/tasks` -> Server validates, sends WebSocket message to extension -> Extension creates a temporary agent via `agentManager.createAgent()` with `schedule.type: 'once'` -> Extension runs it immediately via `agentExecutor.execute()` -> Results flow back via WebSocket.

**New DB table for task tracking (minimal):**

```sql
CREATE TABLE IF NOT EXISTS remote_tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  hash_key TEXT NOT NULL,
  task_id TEXT UNIQUE NOT NULL,
  task TEXT NOT NULL,
  target_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',  -- pending, running, completed, failed
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT,
  result TEXT,
  error TEXT,
  FOREIGN KEY (hash_key) REFERENCES hash_keys(hash_key) ON DELETE CASCADE
);
```

## New Files Required

### Extension Side

| File | Purpose | Estimated Lines |
|------|---------|-----------------|
| `ws/ws-client.js` | WebSocket connection manager with keepalive, reconnect, message routing | ~200 |
| `ws/dom-stream.js` | Coordinate DOM snapshots from content script, forward to WS | ~100 |
| `content/dom-observer.js` | MutationObserver-based DOM serialization (initial snapshot + incremental diffs) | ~350 |

### Server Side

| File | Purpose | Estimated Lines |
|------|---------|-----------------|
| `server/src/ws/handler.js` | WebSocket connection management, message routing, room-based relay | ~250 |
| `server/src/routes/tasks.js` | Remote task creation endpoint | ~60 |
| `server/src/routes/qr.js` | QR code generation and pairing endpoints | ~80 |
| `server/src/db/schema.js` | Add `remote_tasks` table (migration) | ~15 (addition) |

### Dashboard Side

| File | Purpose | Estimated Lines |
|------|---------|-----------------|
| `server/dashboard/src/components/DOMViewer.jsx` | DOM reconstruction and rendering in iframe | ~300 |
| `server/dashboard/src/components/TaskCreator.jsx` | Remote task creation form | ~120 |
| `server/dashboard/src/components/QRPairing.jsx` | QR code display and pairing flow UI | ~100 |
| `server/dashboard/src/components/ConnectionStatus.jsx` | Extension online/offline indicator | ~50 |
| `server/dashboard/src/hooks/useWebSocket.js` | WebSocket hook replacing useSSE | ~100 |
| `server/dashboard/src/pages/Showcase.jsx` | Public landing/showcase page | ~150 |

### Showcase (public site)

| File | Purpose | Notes |
|------|---------|-------|
| `server/public/index.html` | Public showcase landing page | Static HTML, served at `/` instead of redirect to `/dashboard` |
| `server/public/assets/` | Showcase CSS, images, demo screenshots | Static assets |

## Modified Files

| File | Change | Risk |
|------|--------|------|
| `manifest.json` | Add `"minimum_chrome_version": "116"` | ZERO -- Chrome 116 is from Aug 2023, all current users are past this |
| `background.js` | Add `importScripts('ws/ws-client.js', 'ws/dom-stream.js')`, wire WS connection on install/startup, route incoming WS messages | LOW -- additive |
| `agents/server-sync.js` | Add WS-based sync path alongside existing HTTP, use WS when connected | LOW -- fallback preserved |
| `agents/agent-executor.js` | Emit progress events to WS during execution (optional hook) | LOW -- additive |
| `server/server.js` | Add WebSocket upgrade handling via `ws` package, add QR + task routes | MEDIUM -- server startup changes |
| `server/package.json` | Add `ws`, `qrcode` dependencies | ZERO |
| `server/src/routes/sse.js` | Keep as fallback but mark deprecated | ZERO |
| `server/dashboard/src/App.jsx` | Add routing for showcase vs dashboard, QR pairing page | LOW |
| `server/dashboard/src/pages/Dashboard.jsx` | Add DOM viewer tab, task creation, connection status | MEDIUM -- significant UI additions |
| `server/dashboard/src/hooks/useSSE.js` | Replace with useWebSocket.js or keep as fallback | LOW |
| `ui/control_panel.html` or `ui/options.html` | Add "Pair with Dashboard" section with QR scanner or manual hash entry | LOW |

## Patterns to Follow

### Pattern 1: WebSocket Message Protocol

**What:** All WebSocket messages use a typed JSON envelope with consistent structure.

**Why:** Enables clean message routing without inspecting payloads. Both extension and dashboard can handle the same protocol.

```javascript
// Every WS message follows this shape:
{
  type: 'dom:snapshot' | 'dom:diff' | 'task:create' | 'task:progress' | 'task:complete' |
        'agent:run_complete' | 'agent:status' | 'ext:status' | 'ping' | 'pong' | 'paired',
  payload: { /* type-specific data */ },
  timestamp: 1710000000000
}
```

### Pattern 2: Room-Based WebSocket Relay

**What:** Server groups WebSocket connections by hashKey. Extension connections and dashboard connections with the same hashKey are in the same "room." DOM stream from extension is relayed only to dashboard connections in the same room.

**When:** Always -- this is the core relay pattern.

```javascript
// Server-side connection tracking
const rooms = new Map(); // hashKey -> { extensions: Set<ws>, dashboards: Set<ws> }

// On extension message:
function handleExtensionMessage(hashKey, msg) {
  const room = rooms.get(hashKey);
  if (!room) return;

  // Relay DOM diffs to all dashboard connections in this room
  if (msg.type === 'dom:snapshot' || msg.type === 'dom:diff') {
    for (const dashboard of room.dashboards) {
      dashboard.send(JSON.stringify(msg));
    }
  }
}
```

### Pattern 3: Content Script DOM Observer as Opt-In Module

**What:** The DOM observer content script (`content/dom-observer.js`) is NOT injected by default. It is only injected when a dashboard is actively viewing the tab (triggered by a message from background.js).

**Why:** DOM observation has performance overhead (MutationObserver callbacks, serialization, message passing). Most of the time no dashboard is watching, so there is zero overhead. When a dashboard connects and requests DOM view, background.js injects the observer into the active tab.

```javascript
// background.js: only inject when dashboard requests DOM view
function handleDashboardViewRequest(tabId) {
  chrome.scripting.executeScript({
    target: { tabId },
    files: ['content/dom-observer.js']
  });
}
```

### Pattern 4: Graceful Degradation

**What:** Every new feature degrades gracefully when the server is unreachable or WebSocket disconnects.

**When:** Always -- the extension must remain fully functional without the server.

- WebSocket disconnects: Fall back to HTTP sync (existing `server-sync.js`)
- Server unreachable: Queue sync operations, retry with exponential backoff (existing pattern)
- Dashboard offline: Extension works normally, DOM observer is not injected
- Extension offline: Dashboard shows "Extension offline," task creation is disabled

## Anti-Patterns to Avoid

### Anti-Pattern 1: Proxying Images Through the Server

**What:** Routing page images through the FSB server for dashboard DOM viewer.
**Why bad:** Massive bandwidth cost, latency, potential copyright/legal issues. Images on web pages are already on CDNs.
**Instead:** Send image `src` URLs in DOM snapshots. Dashboard loads images directly from their original CDN URLs. Set `crossorigin` and handle CORS failures gracefully (show placeholder for images that can't load cross-origin).

### Anti-Pattern 2: Streaming Full DOM Snapshots Continuously

**What:** Sending the entire serialized DOM tree on every change.
**Why bad:** A complex page can have 5000+ nodes. Serializing and sending the full tree at 500ms intervals would be tens of KB per second.
**Instead:** Initial full snapshot once, then incremental MutationObserver diffs. Only re-snapshot when the page navigates or diffs exceed the batch threshold (>50 mutations).

### Anti-Pattern 3: Using the Offscreen Document for WebSocket

**What:** Creating an offscreen document just to host the WebSocket connection.
**Why bad:** Adds an unnecessary message-passing layer between offscreen doc and service worker. Chrome 116+ keeps the service worker alive with WebSocket activity. The offscreen document already exists for STT -- creating another one requires a separate HTML file (Chrome allows only one offscreen doc at a time per reason, and different reasons need different documents or the existing one needs modification).
**Instead:** WebSocket directly in the service worker with 20-second keepalive pings.

### Anti-Pattern 4: Storing DOM Snapshots in SQLite

**What:** Persisting DOM snapshots/diffs to the server database.
**Why bad:** DOM data is ephemeral and potentially huge. It is only useful in real-time for the dashboard viewer. Storing it adds DB bloat and serves no purpose -- nobody replays historical DOM state.
**Instead:** DOM stream is purely in-memory relay. Server receives from extension WebSocket, immediately forwards to dashboard WebSocket connections in the same room. Nothing persisted.

### Anti-Pattern 5: Multiple WebSocket Connections from Extension

**What:** Opening separate WebSocket connections for DOM stream, task events, and agent sync.
**Why bad:** Each connection has its own keepalive overhead, reconnect logic, and auth handshake. Multiple connections multiply the chance of one being in a degraded state.
**Instead:** Single WebSocket connection carrying all message types, routed by the `type` field in the message envelope.

## Scalability Considerations

| Concern | At 1 user (MVP) | At 100 users | At 1K users |
|---------|-----------------|--------------|-------------|
| WebSocket connections | 2 (1 extension + 1 dashboard) | 200 | 2000 -- need connection limits per hashKey |
| DOM stream bandwidth | ~5-20 KB/s per active view | Only streams when dashboard is viewing | Add per-room throttling |
| SQLite write load | Trivial | ~100 run records/hour | Consider PostgreSQL migration |
| Server memory | <50MB | ~200MB (WS buffers) | Need horizontal scaling (not v0.9.6 scope) |
| Fly.io hosting | Single instance | Single instance + more RAM | Multiple instances need sticky sessions for WS |

For v0.9.6 (single user with possible demo), a single fly.io instance is sufficient.

## Suggested Build Order (Dependency-Driven)

### Phase 1: WebSocket Infrastructure (must come first)

Everything else depends on bidirectional server-extension communication.

1. Add `ws` + `qrcode` to server/package.json
2. Create `server/src/ws/handler.js` -- WebSocket connection management with room-based routing
3. Modify `server/server.js` -- add WebSocket upgrade handling alongside Express
4. Create `ws/ws-client.js` in extension -- WebSocket connection with keepalive, reconnect, message routing
5. Modify `background.js` -- importScripts, connect on startup, route incoming messages
6. Modify `agents/server-sync.js` -- use WS when connected, HTTP as fallback
7. Add `minimum_chrome_version: "116"` to manifest.json
8. Test: extension connects to server via WS, keepalive works, agent run results flow via WS

### Phase 2: QR Pairing + Showcase

Dashboard needs auth before it can receive anything.

9. Create `server/src/routes/qr.js` -- QR code generation, pairing token lifecycle
10. Create `server/dashboard/src/components/QRPairing.jsx` -- display QR, wait for pairing
11. Add pairing button to extension options page (scan QR or enter server URL + hash key)
12. Create showcase landing page at `server/public/index.html`
13. Modify `server/server.js` -- serve showcase at `/`, dashboard at `/dashboard`
14. Test: dashboard shows QR, extension scans/enters code, connection established

### Phase 3: Remote Task Control

Requires Phase 1 (WebSocket) and Phase 2 (auth/pairing).

15. Create `server/src/routes/tasks.js` -- task creation endpoint
16. Add `remote_tasks` table to schema
17. Create `server/dashboard/src/components/TaskCreator.jsx` -- task creation form
18. Add WS message handler in extension for `task:create` -- creates one-time agent, executes
19. Add WS progress reporting during task execution
20. Replace `useSSE` hook with `useWebSocket` in dashboard
21. Add `ConnectionStatus.jsx` to dashboard
22. Test: create task from dashboard, see it execute on extension, results flow back

### Phase 4: DOM Cloning Stream

Most complex new feature, depends on Phase 1 (WebSocket) and Phase 3 (remote task visible in dashboard).

23. Create `content/dom-observer.js` -- MutationObserver, initial snapshot serialization, incremental diff generation
24. Create `ws/dom-stream.js` in extension -- coordinate observer injection, forward snapshots/diffs to WS
25. Add DOM relay logic in `server/src/ws/handler.js` -- forward DOM messages within room
26. Create `server/dashboard/src/components/DOMViewer.jsx` -- reconstruct DOM in sandboxed iframe
27. Add "Live View" tab to dashboard with DOM viewer
28. Test: navigate to a page, dashboard shows reconstructed DOM updating in real-time

### Phase 5: Polish and Integration

29. Agent monitoring enhancements in dashboard (existing agent cards + WS-based live status)
30. Dashboard UI polish (responsive layout, loading states, error handling)
31. Extension connection status indicator in popup/sidepanel
32. Showcase page content and design
33. Fly.io deployment configuration (Dockerfile, fly.toml)

**Ordering rationale:**
- Phase 1 is prerequisite for all real-time features
- Phase 2 is prerequisite for dashboard access (auth)
- Phase 3 validates the bidirectional message flow pattern before adding the more complex DOM stream
- Phase 4 builds on the established WebSocket + room pattern
- Phase 5 is polish that benefits from all infrastructure being in place
- Background agents and automation replay are ALREADY BUILT -- they just need WS integration (Phase 1)

## Sources

- [Chrome Official: Use WebSockets in Service Workers](https://developer.chrome.com/docs/extensions/how-to/web-platform/websockets) -- Chrome 116+ keepalive behavior (HIGH confidence)
- [Chrome Official: Service Worker Lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle) -- 30-second inactivity timeout (HIGH confidence)
- [Chrome Official: Migrate to Service Workers](https://developer.chrome.com/docs/extensions/develop/migrate/to-service-workers) -- MV3 migration guidance (HIGH confidence)
- [rrweb Serialization Docs](https://github.com/rrweb-io/rrweb/blob/master/docs/serialization.md) -- DOM serialization approach reference (HIGH confidence, used for comparison)
- [rrweb Observer Docs](https://github.com/rrweb-io/rrweb/blob/master/docs/observer.md) -- MutationObserver patterns (HIGH confidence)
- [Firefox Ecosystem: Pairing Flow Architecture](https://mozilla.github.io/ecosystem-platform/explanation/pairing-flow-architecture) -- QR pairing architecture reference (MEDIUM confidence, different platform but same pattern)
- [Cross-Device Communication via WebSockets](https://medium.com/@getflourish/from-mobile-to-desktop-cross-device-communication-using-websockets-f9c48f669c8) -- QR + WebSocket room pattern (MEDIUM confidence)
- FSB codebase analysis: `agents/` directory (agent-manager.js, agent-scheduler.js, agent-executor.js, server-sync.js), `server/` directory (server.js, src/), `background.js` lines 11927-11990 (alarm handler), `offscreen/stt.js` (offscreen pattern), `manifest.json` (permissions) -- (HIGH confidence, direct code reading)
