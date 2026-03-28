# Phase 40: WebSocket Infrastructure - Research

**Researched:** 2026-03-17
**Domain:** WebSocket relay server, Chrome MV3 service worker WS client, dashboard WS client, fly.io deployment
**Confidence:** HIGH

## Summary

This phase upgrades the existing Express+SSE server to a WebSocket relay, deploys it on fly.io as a single app serving the showcase site and WS/REST API, and connects the extension service worker and dashboard via WebSocket with connection status indicators. The existing codebase has significant infrastructure to build on: `server/server.js` (Express + SQLite + SSE), `server/src/routes/sse.js` (hashKey-based client routing), `agents/server-sync.js` (extension-side HTTP client), and `showcase/js/dashboard.js` (SSE dashboard client). The SSE implementation is replaced entirely with WebSocket.

The server-side addition is the `ws` npm package (v8.19.0), which attaches to the existing Express HTTP server for WebSocket upgrades. The extension uses the browser's built-in `WebSocket` API in the service worker (Chrome 116+ keeps the worker alive when WS activity occurs within 30s). The dashboard rewrites its SSE connection to WebSocket using relative URLs since the server now serves the showcase files directly.

**Primary recommendation:** Add `ws` ^8.19.0 to the server, capture the HTTP server from `app.listen()`, handle `upgrade` events for WS connections authenticated by hashKey, implement room-based routing (hashKey -> {extensions, dashboards}), and replace the SSE route entirely. Keep the REST API unchanged.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- `showcase/` is the ONLY dashboard -- vanilla JS, no build system
- `server/dashboard/` is dead code -- remove entirely during this phase
- Server serves showcase static files + WS relay + REST API from a single fly.io app
- Dashboard uses relative URLs (`/api/...`) since server serves it -- no hardcoded API_BASE
- Static assets get proper `Cache-Control` headers; fly.io edge CDN handles caching
- Hybrid approach: keep REST API for agent CRUD and run results (reliable, retryable via server-sync.js HTTP). Use WS only for real-time events (progress, DOM stream, status, remote task commands)
- Server is a pure relay -- no event persistence. If dashboard disconnects, real-time events are lost
- Always-on WS when serverSyncEnabled is true -- dashboard can connect anytime and see extension online status
- Aggressive reconnection: immediate retry, then exponential backoff (1s, 2s, 4s, 8s... capped at 30s). Never give up
- Accept termination when Chrome fully closes -- WS dies, reconnect automatically on next Chrome launch
- On reconnect, extension sends state snapshot automatically -- dashboard auto-refreshes, seamless UX
- Badge icon on extension icon: green dot = connected, red dot = disconnected
- Chrome 116+ required for WS keepalive in service worker (20s ping interval)
- fly.io account and fsb-server.fly.dev domain already exist
- SQLite + fly.io volume mount at /data for persistence across redeploys
- Manual `fly deploy` from CLI (no CI/CD for now)
- Drop FSB_SERVER_SECRET -- hash key IS the auth. Server just verifies hash key exists in DB

### Claude's Discretion
- WS message envelope format (typed JSON envelope recommended by research)
- Server routing strategy (blind relay vs typed routing)
- Exact reconnection backoff parameters
- fly.toml and Dockerfile specifics
- How to handle the SSE-to-WS migration (remove SSE route, replace with WS upgrade handler)
- Badge icon implementation details

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SERV-01 | Server upgrades from SSE to WebSocket relay with room-based routing by hashKey | `ws` ^8.19.0 attaches to Express HTTP server via `upgrade` event; room map pattern (hashKey -> {extensions: Set, dashboards: Set}) replaces SSE client map |
| SERV-02 | Extension service worker maintains WebSocket connection with 20s keepalive ping | Chrome 116+ keeps SW alive on WS activity; `setInterval` at 20s sends ping; reconnect with exponential backoff on close |
| SERV-03 | Dashboard establishes WebSocket connection and receives real-time events | Dashboard rewrites SSE to `new WebSocket(ws://...)` with relative URL; receives typed JSON messages from relay |
| SERV-04 | Connection status indicator shows connected/disconnected/reconnecting on dashboard | Dashboard tracks `ws.onopen`/`ws.onclose`/reconnect timer; renders three-state indicator; extension badge icon via `chrome.action.setBadgeText` |
| SERV-05 | Single fly.io app serves dashboard static files + WebSocket relay + REST API | Express serves showcase/ as static, REST routes unchanged, WS upgrade on same HTTP server |
| SERV-06 | SQLite database persists via fly.io volume mount | `[[mounts]]` in fly.toml with `source="fsb_data"` `destination="/data"`, DB_PATH=/data/fsb-data.db |
| SERV-07 | Auto-TLS and production deployment configuration on fly.io | `force_https=true` in fly.toml, fly.io auto-provisions Let's Encrypt cert for fsb-server.fly.dev |
</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `ws` | ^8.19.0 (verified 2026-03-17) | WebSocket server for Node.js | De facto standard. 0 dependencies, handles upgrade from HTTP server, supports permessage-deflate. Node.js has native WS client but no native WS server |
| `express` | ^4.22.1 (keep existing ^4.21.0) | HTTP server, static files, REST API | Already in use. Express 5.x (5.2.1) is available but the project already uses 4.x -- no reason to migrate mid-feature |
| `better-sqlite3` | ^12.8.0 (keep existing ^11.0.0) | SQLite database | Already in use. Synchronous API, no async overhead for simple queries |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `cors` | ^2.8.5 (existing) | CORS headers | Already in use for REST API |
| `dotenv` | ^16.4.0 (existing) | Environment variables | Already in use |

### What NOT to Add

| Library | Why Not |
|---------|---------|
| Socket.IO | 50KB client overhead, rooms/namespaces overkill for relay pattern, user explicitly excluded |
| `helmet` | Overkill for this phase -- add security headers manually in middleware if needed later |
| `uuid` | Use `crypto.randomUUID()` (Node.js built-in since v19) |

**Installation:**
```bash
cd server
npm install ws
```

That is the ONLY new dependency for this phase. Everything else is already installed or built-in.

## Architecture Patterns

### Recommended Project Structure (server changes)

```
server/
  server.js                    # Modified: capture HTTP server, attach WS
  src/
    ws/
      handler.js               # NEW: WebSocket connection manager + room routing
    routes/
      sse.js                   # DELETED: replaced by WebSocket
      auth.js                  # Modified: remove SERVER_SECRET dependency
      agents.js                # Modified: broadcast via WS instead of SSE
    middleware/
      auth.js                  # Unchanged
    db/
      schema.js                # Unchanged (no new tables for this phase)
      queries.js               # Unchanged
  Dockerfile                   # NEW: node:20-alpine for fly.io
  fly.toml                     # NEW: replaces server-py/fly.toml
  .dockerignore                # NEW
```

### Extension changes

```
ws/
  ws-client.js                 # NEW: WebSocket connection manager with keepalive + reconnect
```

### Dashboard changes

```
showcase/
  js/
    dashboard.js               # Modified: SSE -> WS, relative URLs, connection status
```

### Pattern 1: WebSocket Upgrade from Express HTTP Server

**What:** `ws` attaches to the HTTP server returned by `app.listen()`, handling the `upgrade` event. Express handles all HTTP traffic; `ws` handles WebSocket upgrades on a specific path.

**When to use:** Always -- this is the only correct way to share Express and WebSocket on one port.

```javascript
// server.js
const { WebSocketServer } = require('ws');
const http = require('http');

const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (request, socket, head) => {
  // Parse URL and validate
  const url = new URL(request.url, `http://${request.headers.host}`);
  if (url.pathname !== '/ws') {
    socket.destroy();
    return;
  }

  // Authenticate via hashKey query param
  const hashKey = url.searchParams.get('key');
  const keyRecord = queries.validateHashKey(hashKey);
  if (!keyRecord) {
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
    socket.destroy();
    return;
  }

  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request, hashKey);
  });
});

server.listen(PORT, () => { /* ... */ });
```

**Source:** [ws npm README - External HTTP/S server](https://github.com/websockets/ws#external-https-server)

### Pattern 2: Room-Based Client Routing by hashKey

**What:** Server maintains a Map of hashKey to connected clients. Each hashKey "room" holds extension and dashboard WebSocket connections separately. Messages from extension are relayed to all dashboards in the same room and vice versa.

```javascript
// ws/handler.js
const rooms = new Map(); // hashKey -> { extensions: Set<ws>, dashboards: Set<ws> }

function addClient(hashKey, ws, role) {
  if (!rooms.has(hashKey)) {
    rooms.set(hashKey, { extensions: new Set(), dashboards: new Set() });
  }
  const room = rooms.get(hashKey);
  if (role === 'extension') room.extensions.add(ws);
  else room.dashboards.add(ws);
}

function removeClient(hashKey, ws) {
  const room = rooms.get(hashKey);
  if (!room) return;
  room.extensions.delete(ws);
  room.dashboards.delete(ws);
  if (room.extensions.size === 0 && room.dashboards.size === 0) {
    rooms.delete(hashKey);
  }
}

function relayToRoom(hashKey, senderWs, message) {
  const room = rooms.get(hashKey);
  if (!room) return;
  const targets = room.extensions.has(senderWs) ? room.dashboards : room.extensions;
  const data = typeof message === 'string' ? message : JSON.stringify(message);
  for (const client of targets) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  }
}
```

### Pattern 3: Typed JSON Message Envelope

**What:** All WebSocket messages use a typed envelope for clean routing.

```javascript
// Message envelope format
{
  type: 'ext:status' | 'ext:snapshot' | 'task:progress' | 'task:complete' |
        'dom:snapshot' | 'dom:diff' | 'ping' | 'pong',
  payload: { /* type-specific */ },
  ts: 1710000000000
}
```

**Recommendation:** Server does typed routing (not blind relay). The server inspects `type` to:
1. Handle `ping`/`pong` internally (don't relay keepalives)
2. Track extension online/offline status based on connection presence
3. Relay all other messages to the other side of the room
4. Broadcast `ext:status` to dashboards when extension connects/disconnects

### Pattern 4: Extension WebSocket Client with Keepalive

**What:** Service worker WebSocket client with 20s keepalive and exponential backoff reconnection.

```javascript
// ws/ws-client.js (extension side)
class FSBWebSocket {
  constructor() {
    this.ws = null;
    this.keepaliveTimer = null;
    this.reconnectDelay = 0;
    this.maxReconnectDelay = 30000;
  }

  async connect() {
    const config = await this._getConfig();
    if (!config.enabled || !config.hashKey) return;

    const wsUrl = config.url.replace(/^http/, 'ws') + '/ws?key=' +
      encodeURIComponent(config.hashKey) + '&role=extension';

    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      this.reconnectDelay = 0;
      this._startKeepalive();
      this._sendStateSnapshot();
      this._updateBadge(true);
    };

    this.ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      this._handleMessage(msg);
    };

    this.ws.onclose = () => {
      this._stopKeepalive();
      this._updateBadge(false);
      this._scheduleReconnect();
    };

    this.ws.onerror = () => {}; // onclose will fire after onerror
  }

  _startKeepalive() {
    this._stopKeepalive();
    this.keepaliveTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping', ts: Date.now() }));
      }
    }, 20000);
  }

  _scheduleReconnect() {
    // Immediate first retry, then exponential backoff
    if (this.reconnectDelay === 0) {
      this.reconnectDelay = 1000;
      this.connect();
      return;
    }
    setTimeout(() => this.connect(), this.reconnectDelay);
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
  }

  _updateBadge(connected) {
    chrome.action.setBadgeText({ text: connected ? '' : '!' });
    chrome.action.setBadgeBackgroundColor({
      color: connected ? '#22c55e' : '#ef4444'
    });
  }
}
```

### Pattern 5: Dashboard WS Client with Connection Status

**What:** Dashboard replaces SSE with WebSocket, tracks three states: connected, disconnected, reconnecting.

```javascript
// showcase/js/dashboard.js (modified)
var WS_STATES = { CONNECTED: 'connected', DISCONNECTED: 'disconnected', RECONNECTING: 'reconnecting' };
var wsState = WS_STATES.DISCONNECTED;
var ws = null;
var wsReconnectDelay = 0;

function connectWS() {
  // Use relative URL -- server serves both static and WS
  var proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  var wsUrl = proto + '//' + location.host + '/ws?key=' +
    encodeURIComponent(hashKey) + '&role=dashboard';

  ws = new WebSocket(wsUrl);
  setWsState(WS_STATES.RECONNECTING);

  ws.onopen = function () {
    wsReconnectDelay = 0;
    setWsState(WS_STATES.CONNECTED);
  };

  ws.onmessage = function (event) {
    var msg = JSON.parse(event.data);
    handleWSMessage(msg);
  };

  ws.onclose = function () {
    setWsState(WS_STATES.DISCONNECTED);
    scheduleReconnect();
  };
}

function setWsState(state) {
  wsState = state;
  // Update UI indicator
  var el = document.getElementById('dash-sse-status'); // reuse existing element
  el.textContent = state;
  el.className = 'dash-sse-badge ' +
    (state === 'connected' ? 'dash-sse-connected' :
     state === 'reconnecting' ? 'dash-sse-reconnecting' :
     'dash-sse-disconnected');
}
```

### Anti-Patterns to Avoid

- **Keeping SSE alongside WebSocket:** Creates two real-time transports, two reconnection logics, two auth flows. Remove SSE entirely -- the WS connection handles everything SSE did.
- **Hardcoded server URL in dashboard:** The dashboard is served by the same Express app, so use `location.host` for WS URLs. No more `API_BASE = 'https://fsb-server.fly.dev'`.
- **Multiple WS connections:** One connection per client carries all message types, routed by `type` field.
- **Storing connection state in SQLite:** WS client tracking is purely in-memory. `rooms` Map is ephemeral.
- **Using `ws.ping()`/`ws.pong()` frames for keepalive:** These are protocol-level pings that don't count as "WebSocket activity" for Chrome's service worker idle timer. Use application-level JSON messages (`{ type: 'ping' }`) instead.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| WebSocket server | Raw `http.createServer` + manual frame parsing | `ws` ^8.19.0 | Frame parsing, masking, close handshake, permessage-deflate are deceptively complex |
| WebSocket protocol compliance | Custom upgrade handler | `ws` `handleUpgrade()` | Upgrade negotiation has edge cases around Sec-WebSocket-Key, extensions, subprotocols |
| UUID generation | Custom random string | `crypto.randomUUID()` | Built into Node.js, cryptographically random, RFC 4122 compliant |

**Key insight:** The server is a thin relay. Most complexity is in connection lifecycle management (keepalive, reconnect, auth), not in the message processing itself. The relay just reads `type` and forwards to the right room side.

## Common Pitfalls

### Pitfall 1: `app.listen()` Does Not Return the HTTP Server Object

**What goes wrong:** Code calls `app.listen(PORT)` and tries to attach `ws` to `app`, but Express `app` is not an HTTP server -- it's a request handler function.

**Why it happens:** Express documentation examples often show `app.listen()` which internally creates an HTTP server, but the return value must be captured or you must create the server explicitly.

**How to avoid:** Use `const server = http.createServer(app); server.listen(PORT);` explicitly, or capture `const server = app.listen(PORT);` (which does return the HTTP server). The explicit `http.createServer` approach is clearer.

**Warning signs:** `wss` never receives connections; `upgrade` event never fires.

### Pitfall 2: Chrome SW Keepalive Using Protocol-Level Pings

**What goes wrong:** Extension sends WebSocket protocol pings (`ws.ping()`) instead of application-level messages. Chrome's idle timer is NOT reset by protocol-level pings -- only data frames (actual messages) reset it.

**Why it happens:** `ws` library documentation recommends `ws.ping()` for keepalive, which works for server-side Node.js. But Chrome's service worker idle timer only counts application-level WebSocket `send()`/`onmessage` activity.

**How to avoid:** Send `ws.send(JSON.stringify({ type: 'ping' }))` every 20 seconds. Server responds with `{ type: 'pong' }`. Both are data frames that reset Chrome's timer.

**Warning signs:** WS connection drops after exactly 30s of no user interaction, even with ping/pong enabled.

### Pitfall 3: fly.io Idle Timeout Kills WebSocket

**What goes wrong:** fly.io's default HTTP idle timeout (60s or less) closes inactive WebSocket connections.

**Why it happens:** fly.io's proxy has its own idle timeout separate from the app.

**How to avoid:** Server-side pings every 30s ensure the connection is never "idle" from fly.io's perspective. The 20s client-side pings will trigger server-side responses, keeping both sides active. Optionally set `[http_service.http_options]` idle_timeout in fly.toml.

### Pitfall 4: SQLite on Ephemeral Filesystem

**What goes wrong:** SQLite DB file is written to the app container's filesystem. fly.io resets the filesystem on every deploy, losing all data.

**Why it happens:** Default working directory is not a volume mount.

**How to avoid:** Configure `[[mounts]]` in fly.toml to mount a persistent volume at `/data`. Set `DB_PATH` to `/data/fsb-data.db`. Create the volume with `fly volumes create fsb_data --region sjc --size 1`.

**Warning signs:** All agents and hash keys disappear after each `fly deploy`.

### Pitfall 5: Dashboard API_BASE Hardcoded to External URL

**What goes wrong:** Dashboard JS has `var API_BASE = 'https://fsb-server.fly.dev'` hardcoded. When server serves the dashboard, this creates unnecessary cross-origin requests to itself and breaks local development.

**Why it happens:** The current dashboard was built as a separate site connecting to an external API.

**How to avoid:** Replace `API_BASE` with `''` (empty string) for relative URLs. All fetch calls become `fetch('/api/agents', ...)` instead of `fetch('https://fsb-server.fly.dev/api/agents', ...)`. WebSocket URL uses `location.host`.

### Pitfall 6: Badge Icon Requires Explicit Background Color

**What goes wrong:** `chrome.action.setBadgeText({ text: '' })` clears the badge but there is no visual "green dot" indicator.

**Why it happens:** Chrome's badge API shows text, not colored dots. An empty badge text shows nothing.

**How to avoid:** For "connected" state, use a small unicode character or a single space with green background: `chrome.action.setBadgeText({ text: ' ' }); chrome.action.setBadgeBackgroundColor({ color: '#22c55e' })`. For "disconnected": `chrome.action.setBadgeText({ text: '!' }); chrome.action.setBadgeBackgroundColor({ color: '#ef4444' })`. Clear badge entirely when WS is not configured.

## Code Examples

### Server: Complete WS Setup Pattern

```javascript
// server/server.js -- key modifications
const http = require('http');
const { WebSocketServer } = require('ws');
const { setupWSHandler } = require('./src/ws/handler');

// ... existing Express setup ...

// Create HTTP server explicitly (instead of app.listen)
const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });

// WS upgrade handler with auth
server.on('upgrade', (request, socket, head) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  if (url.pathname !== '/ws') {
    socket.destroy();
    return;
  }

  const hashKey = url.searchParams.get('key');
  const role = url.searchParams.get('role'); // 'extension' or 'dashboard'

  if (!hashKey || !queries.validateHashKey(hashKey)) {
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
    socket.destroy();
    return;
  }

  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request, { hashKey, role });
  });
});

// Setup WS message handling
setupWSHandler(wss);

server.listen(PORT, () => {
  console.log(`[FSB Server] Running on http://localhost:${PORT}`);
});
```

### Server: WS Handler Module

```javascript
// server/src/ws/handler.js
const WebSocket = require('ws');

const rooms = new Map();

function setupWSHandler(wss) {
  wss.on('connection', (ws, request, { hashKey, role }) => {
    addClient(hashKey, ws, role);

    // Notify dashboards when extension connects
    if (role === 'extension') {
      broadcast(hashKey, 'dashboards', {
        type: 'ext:status', payload: { online: true }, ts: Date.now()
      });
    }

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data);
        if (msg.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong', ts: Date.now() }));
          return;
        }
        // Relay to opposite side of room
        relayToRoom(hashKey, ws, data.toString());
      } catch { /* ignore malformed */ }
    });

    ws.on('close', () => {
      removeClient(hashKey, ws);
      if (role === 'extension') {
        broadcast(hashKey, 'dashboards', {
          type: 'ext:status', payload: { online: false }, ts: Date.now()
        });
      }
    });
  });
}
```

### fly.toml Configuration

```toml
app = "fsb-server"
primary_region = "sjc"

[build]

[http_service]
  internal_port = 3847
  force_https = true
  auto_stop_machines = "stop"
  auto_start_machines = true
  min_machines_running = 1

[[mounts]]
  source = "fsb_data"
  destination = "/data"

[[vm]]
  memory = "256mb"
  cpu_kind = "shared"
  cpus = 1

[env]
  NODE_ENV = "production"
  PORT = "3847"
  DB_PATH = "/data/fsb-data.db"
```

### Dockerfile

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY server/package*.json ./
RUN npm ci --production

COPY server/ .
COPY showcase/ ./public/

EXPOSE 3847

CMD ["node", "server.js"]
```

### Serving Showcase Static Files

```javascript
// server/server.js -- replace dashboard serving with showcase
const showcasePath = path.join(__dirname, 'public'); // showcase/ copied here in Docker
app.use(express.static(showcasePath, {
  maxAge: '1d',
  etag: true
}));

// SPA fallback for dashboard route
app.get('/dashboard*', (req, res) => {
  res.sendFile(path.join(showcasePath, 'dashboard.html'));
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| SSE for server-to-dashboard push | WebSocket for bidirectional relay | This phase | Enables remote task commands, connection status, future DOM streaming |
| `API_BASE` hardcoded external URL | Relative URLs (server serves dashboard) | This phase | No CORS issues, simpler deployment, works in local dev |
| `FSB_SERVER_SECRET` for auth | Hash key IS the auth (verified in DB) | This phase | Simpler auth model, no shared secret management |
| `server-py/fly.toml` (Python) | `server/fly.toml` (Node.js) | This phase | Previous fly.io config was for a Python prototype; new config for production Node.js server |
| `server/dashboard/` (React+Vite) | `showcase/` (vanilla JS) | Already decided | Dead React dashboard removed, showcase is the only dashboard |

## Open Questions

1. **Volume creation on fly.io**
   - What we know: fly.toml declares `[[mounts]]` with `source = "fsb_data"`, but the volume must be pre-created with `fly volumes create`
   - What's unclear: Whether the existing fly.io app already has a volume (the `server-py/fly.toml` has no mounts section)
   - Recommendation: Plan should include a step to create the volume before first deploy: `fly volumes create fsb_data --region sjc --size 1`

2. **Port number alignment**
   - What we know: Current server uses 3847, the Python server-py used 8080. fly.io proxy maps external 443 to internal port.
   - What's unclear: Whether to keep 3847 or switch to a conventional port
   - Recommendation: Keep 3847 for consistency with existing code. fly.toml maps it correctly.

3. **Extension badge icon behavior when WS is not configured**
   - What we know: Badge should show connection status only when `serverSyncEnabled` is true
   - What's unclear: Should badge be completely hidden (no badge) when server sync is disabled?
   - Recommendation: No badge when WS is not configured. Only show badge when `serverSyncEnabled` is true.

## Sources

### Primary (HIGH confidence)
- [ws npm package v8.19.0](https://www.npmjs.com/package/ws) -- verified current version via `npm view ws version`
- [Chrome: Use WebSockets in Service Workers](https://developer.chrome.com/docs/extensions/how-to/web-platform/websockets) -- Chrome 116+ WebSocket keepalive behavior, 20s interval recommendation
- [Chrome: Service Worker Lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle) -- 30s idle timeout, activity reset behavior
- [fly.io: App Configuration (fly.toml)](https://fly.io/docs/reference/configuration/) -- fly.toml reference for services, mounts, VM config
- [fly.io: Volume Storage](https://fly.io/docs/launch/volume-storage/) -- `[[mounts]]` configuration for persistent SQLite
- Codebase analysis: `server/server.js`, `server/src/routes/sse.js`, `agents/server-sync.js`, `showcase/js/dashboard.js` -- direct code reading of existing patterns

### Secondary (MEDIUM confidence)
- [fly.io: WebSockets and Fly](https://fly.io/blog/websockets-and-fly/) -- Express + ws deployment pattern on fly.io
- Express 4.22.1 latest on npm (verified), Express 5.2.1 available but not recommended for migration during feature work
- `server-py/fly.toml` -- existing fly.io app configuration (Python, to be replaced)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- `ws` is the de facto Node.js WebSocket server, verified current version, existing Express server provides clear integration point
- Architecture: HIGH -- room-based relay pattern mirrors existing SSE client map, well-documented in ws and fly.io docs, extensive existing codebase analysis
- Pitfalls: HIGH -- Chrome 116 keepalive verified in official docs, fly.io volume mount documented, `app.listen` vs `http.createServer` is a well-known Express pattern
- Deployment: MEDIUM -- fly.io volume and Dockerfile specifics need validation during implementation; existing `server-py/fly.toml` provides reference but Node.js config differs

**Research date:** 2026-03-17
**Valid until:** 2026-04-17 (stable domain -- ws, Express, and fly.io APIs change slowly)
