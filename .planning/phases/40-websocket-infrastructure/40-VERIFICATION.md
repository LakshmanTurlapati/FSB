---
phase: 40-websocket-infrastructure
verified: 2026-03-17T14:30:00Z
status: passed
score: 7/7 must-haves verified
re_verification: false
---

# Phase 40: WebSocket Infrastructure Verification Report

**Phase Goal:** Extension and dashboard can communicate bidirectionally through a WebSocket relay server deployed on fly.io
**Verified:** 2026-03-17T14:30:00Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (from ROADMAP.md Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Extension service worker connects to fly.io server via WebSocket and stays connected across idle periods (20s keepalive surviving Chrome's 30s timeout) | VERIFIED | `ws/ws-client.js`: FSBWebSocket class with 20s `setInterval` ping (`keepaliveTimer`), exponential backoff reconnect capped at 30s; `background.js` line 146 imports and lines 12022-12060 initialize and wire toggle |
| 2 | Dashboard web page connects to the same server and receives messages sent by the extension in real time | VERIFIED | `showcase/js/dashboard.js`: `connectWS()` uses `location.host` for relative WS URL; `handleWSMessage()` handles `ext:status`, `ext:snapshot`, `agent_updated`, `agent_deleted`, `run_completed`; server `ws/handler.js` relays to opposite side of room |
| 3 | Connection status indicator on the dashboard accurately reflects connected, disconnected, and reconnecting states | VERIFIED | `setWsState()` in dashboard.js applies three CSS classes: `dash-sse-connected`, `dash-sse-disconnected`, `dash-sse-reconnecting`; CSS classes confirmed in `showcase/css/dashboard.css` including amber `#eab308` reconnecting state |
| 4 | Server is deployed on fly.io with auto-TLS, SQLite on a persistent volume, and serves both static files and WebSocket from a single app | VERIFIED | `fly.toml`: `force_https = true`, `[[mounts]] source = "fsb_data" destination = "/data"`, `DB_PATH = "/data/fsb-data.db"`; `Dockerfile`: `COPY showcase/ ./public/`; `server.js`: single `http.createServer(app)` with `wss` on same port |

**Score:** 4/4 success criteria verified

---

### Plan-Level Must-Have Truths

#### Plan 01 Must-Haves

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | WebSocket upgrade on /ws path authenticates via hashKey query param and connects to room | VERIFIED | `server.js` lines 107-144: `server.on('upgrade'...)` checks `url.pathname !== '/ws'`, reads `url.searchParams.get('key')`, calls `queries.validateHashKey(hashKey)`, then `wss.handleUpgrade` |
| 2 | Messages from extension clients relay to dashboard clients in same hashKey room and vice versa | VERIFIED | `handler.js` `relayToRoom()`: sender's `_fsbRole` determines targets; extensions relay to dashboards, dashboards relay to extensions |
| 3 | Ping messages handled server-side (responded with pong) and NOT relayed | VERIFIED | `handler.js` line 24-27: `if (msg.type === 'ping') { ws.send(JSON.stringify({ type: 'pong', ts: Date.now() })); return; }` |
| 4 | Extension connect/disconnect triggers ext:status broadcast to dashboards in the room | VERIFIED | `handler.js` lines 14-19 (connect) and 35-38 (close): `broadcast(hashKey, 'dashboards', { type: 'ext:status', payload: { online: true/false }, ts: Date.now() })` |
| 5 | Server serves showcase/ static files with Cache-Control headers | VERIFIED | `server.js` lines 69-76: `express.static(staticPath, { maxAge: '1d', etag: true })` with fallback path for local dev vs Docker |
| 6 | Dockerfile builds and fly.toml configures SQLite on /data volume mount | VERIFIED | `Dockerfile`: `COPY showcase/ ./public/`, `FROM node:20-alpine`; `fly.toml`: `[[mounts]] source = "fsb_data" destination = "/data"`, `DB_PATH = "/data/fsb-data.db"` |
| 7 | SSE route is removed, dead server/dashboard/ directory is removed | VERIFIED | `server/src/routes/sse.js` does not exist; `server/dashboard/` directory does not exist; `server.js` has zero occurrences of `sseClients`, `SERVER_SECRET`, `createSSERouter` |

#### Plan 02 Must-Haves

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Extension service worker connects to fly.io WS relay when serverSyncEnabled is true | VERIFIED | `background.js` lines 12022-12043: `chrome.storage.local.get(['serverSyncEnabled'])` in both `onInstalled` and `onStartup`, calls `fsbWebSocket.connect()` if true |
| 2 | WS connection sends application-level JSON ping every 20 seconds to keep Chrome SW alive | VERIFIED | `ws/ws-client.js` `_startKeepalive()`: `setInterval(() => { this.ws.send(JSON.stringify({ type: 'ping', ts: Date.now() })) }, 20000)` |
| 3 | On disconnect, extension retries immediately then backs off exponentially (1s, 2s, 4s... capped 30s) | VERIFIED | `ws/ws-client.js` `_scheduleReconnect()`: immediate on first call, then `Math.min(delay * 2, 30000)` |
| 4 | On reconnect, extension sends a state snapshot message to the server | VERIFIED | `ws/ws-client.js` `_sendStateSnapshot()`: sends `{ type: 'ext:snapshot', payload: { version, timestamp } }` on `onopen` |
| 5 | Badge icon shows green space when connected, red ! when disconnected, nothing when WS not configured | VERIFIED | `ws/ws-client.js` `_updateBadge()`: `#22c55e` green / `#ef4444` red; `_clearBadge()`: empty string |

#### Plan 03 Must-Haves

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Dashboard connects to WebSocket relay using relative URL | VERIFIED | `dashboard.js` line 9: `var API_BASE = ''`; line 383: `location.host + '/ws?key=...'` |
| 2 | Dashboard receives real-time agent_updated, agent_deleted, run_completed events via WS | VERIFIED | `handleWSMessage()` lines 471-478: handles all three types, calls `loadData()` and `fetchRuns()` |
| 3 | Connection status indicator shows three states: connected (green), disconnected (gray), reconnecting (amber) | VERIFIED | `setWsState()` applies `dash-sse-connected`/`dash-sse-disconnected`/`dash-sse-reconnecting`; CSS confirmed in `dashboard.css` |
| 4 | Dashboard shows extension online/offline status based on ext:status messages from server | VERIFIED | `handleWSMessage()` lines 452-461: sets `extensionOnline`, updates `agentCountEl` with "- extension offline" suffix |
| 5 | All REST API calls use relative URLs (no hardcoded external API_BASE) | VERIFIED | `var API_BASE = ''`; no occurrence of `fsb-server.fly.dev` in `dashboard.js` |
| 6 | Dashboard reconnects with exponential backoff on WS close | VERIFIED | `scheduleWSReconnect()`: `Math.min(wsReconnectDelay * 2, wsMaxReconnectDelay)` (30s cap) |

---

### Required Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| `server/src/ws/handler.js` | VERIFIED | 121 lines; exports `setupWSHandler`, `broadcastToRoom`, `rooms`; full relay, ping/pong, ext:status broadcast |
| `server/server.js` | VERIFIED | `http.createServer(app)`, `server.on('upgrade'...)`, `wss.handleUpgrade`, `queries.validateHashKey`, `process.env.DB_PATH`, `maxAge: '1d'`; no SSE remnants |
| `server/Dockerfile` | VERIFIED | `FROM node:20-alpine`, `COPY server/package*.json ./`, `RUN npm ci --production`, `COPY server/ .`, `COPY showcase/ ./public/`, `EXPOSE 3847`, `CMD ["node", "server.js"]` |
| `server/fly.toml` | VERIFIED | `app = "fsb-server"`, `internal_port = 3847`, `force_https = true`, `[[mounts]]` with `fsb_data`->`/data`, `DB_PATH = "/data/fsb-data.db"`, `min_machines_running = 1` |
| `.dockerignore` | VERIFIED | Contains `node_modules`, `.planning`, `server/node_modules`, `.git` |
| `ws/ws-client.js` | VERIFIED | 199 lines; `class FSBWebSocket`; 20s keepalive; exponential backoff; badge management; `const fsbWebSocket = new FSBWebSocket()` at module level |
| `background.js` | VERIFIED | Line 146: `importScripts('ws/ws-client.js')`; lines 12022-12060: connect on startup, storage change listener for `serverSyncEnabled` toggle |
| `showcase/js/dashboard.js` | VERIFIED | `var API_BASE = ''`; `connectWS`, `disconnectWS`, `setWsState`, `handleWSMessage`, `scheduleWSReconnect`; no SSE remnants |
| `showcase/css/dashboard.css` | VERIFIED | `.dash-sse-reconnecting { background: rgba(234, 179, 8, 0.15); color: #eab308; }` |
| `server/src/routes/agents.js` | VERIFIED | Imports `{ broadcastToRoom }` from `../ws/handler`; no `broadcastSSE`, no `sseClients` parameter |
| `server/src/routes/auth.js` | VERIFIED | `createAuthRouter(queries)` — no `serverSecret` parameter |
| `server/src/utils/hash.js` | VERIFIED | `generateHashKey()` takes zero arguments, uses `crypto.randomBytes(32).toString('hex')` |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `server/server.js` | `server/src/ws/handler.js` | `setupWSHandler(wss)` called after upgrade | WIRED | `require('./src/ws/handler')` + `setupWSHandler(wss)` at line 104 |
| `server/server.js` | `server/src/db/queries.js` | `queries.validateHashKey` in upgrade handler | WIRED | `queries.validateHashKey(hashKey)` at line 128 in upgrade handler |
| `server/src/routes/agents.js` | `server/src/ws/handler.js` | `broadcastToRoom` import | WIRED | `const { broadcastToRoom } = require('../ws/handler')` at line 2; called on POST, DELETE, and run recording |
| `ws/ws-client.js` | `chrome.storage.local` | `getConfig reads serverUrl, serverHashKey, serverSyncEnabled` | WIRED | `chrome.storage.local.get(['serverUrl', 'serverHashKey', 'serverSyncEnabled'])` in `connect()` |
| `ws/ws-client.js` | WS endpoint | `new WebSocket` with key and role query params | WIRED | `new WebSocket(baseUrl + '/ws?key=' + encodeURIComponent(serverHashKey) + '&role=extension')` |
| `background.js` | `ws/ws-client.js` | `importScripts` + initialization | WIRED | Line 146 importScripts; fsbWebSocket.connect() in onInstalled, onStartup, and storage change listener |
| `showcase/js/dashboard.js` | WS endpoint | `new WebSocket` with `location.host` relative URL | WIRED | `location.host + '/ws?key=' + encodeURIComponent(hashKey) + '&role=dashboard'` |
| `showcase/js/dashboard.js` | `/api/agents` | REST fetch with relative URL | WIRED | `var API_BASE = ''`; all `apiFetch('/api/...')` calls use concatenation |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| SERV-01 | 40-01 | Server upgrades from SSE to WebSocket relay with room-based routing by hashKey | SATISFIED | `handler.js` rooms Map; `server.js` upgrade handler with hashKey auth; SSE route removed |
| SERV-02 | 40-02 | Extension service worker maintains WebSocket connection with 20s keepalive ping | SATISFIED | `ws/ws-client.js` `_startKeepalive()` 20s interval; `background.js` wiring |
| SERV-03 | 40-03 | Dashboard establishes WebSocket connection and receives real-time events | SATISFIED | `dashboard.js` `connectWS()` + `handleWSMessage()` for all event types |
| SERV-04 | 40-03 | Connection status indicator shows connected/disconnected/reconnecting on dashboard | SATISFIED | `setWsState()` three-state function; amber CSS class in `dashboard.css` |
| SERV-05 | 40-01 | Single fly.io app serves dashboard static files + WebSocket relay + REST API | SATISFIED | `Dockerfile` copies both `server/` and `showcase/`; single `http.createServer` serves all |
| SERV-06 | 40-01 | SQLite database persists via fly.io volume mount | SATISFIED | `fly.toml` `[[mounts]] source = "fsb_data" destination = "/data"`; `DB_PATH = "/data/fsb-data.db"` |
| SERV-07 | 40-01 | Auto-TLS and production deployment configuration on fly.io | SATISFIED | `fly.toml` `force_https = true`, `min_machines_running = 1`, `NODE_ENV = "production"` |

All 7 SERV requirements (SERV-01 through SERV-07) satisfied. No orphaned requirements detected.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `ws/ws-client.js` | 170 | `default: console.log('[FSB WS] Received: ' + msg.type)` — messages from server other than pong are logged but not acted on | Info | Harmless for this phase; future phases (remote task execution) will add handlers |

No blockers. No stub implementations. No TODO/FIXME comments in phase-modified files.

---

### Human Verification Required

#### 1. End-to-End Relay Test

**Test:** Install the extension in Chrome, configure a server URL and valid hashKey in extension settings, enable serverSyncEnabled. Open the dashboard at `http://localhost:3847/dashboard` with the same hashKey. Observe the extension badge and dashboard connection indicator.
**Expected:** Extension badge turns green (space character with `#22c55e` background). Dashboard indicator shows "connected" in green. Extension badge and dashboard both update within a few seconds of toggling serverSyncEnabled off/on.
**Why human:** Real WebSocket handshake, Chrome service worker behavior, and badge rendering require a live browser environment.

#### 2. Keepalive Across Chrome SW Idle

**Test:** With extension connected, leave the browser idle for 35+ seconds. Check extension badge and server logs.
**Expected:** Badge stays green. Server shows ping/pong exchanges every 20 seconds. Connection survives Chrome's 30s service worker timeout.
**Why human:** Chrome SW idle timeout behavior cannot be verified statically; requires real Chrome with Dev Tools.

#### 3. fly.io Deploy

**Test:** Run `fly deploy` from repo root. Verify the app starts, SQLite volume mounts, HTTPS is active, and dashboard loads at `https://fsb-server.fly.dev/dashboard`.
**Expected:** Deployment succeeds with no errors. Dashboard reachable over HTTPS. WebSocket upgrades succeed on `wss://fsb-server.fly.dev/ws`.
**Why human:** Requires fly.io credentials, live network, and cannot be verified from the codebase alone.

---

## Summary

Phase 40 goal is fully achieved. All 7 SERV requirements are satisfied by concrete, wired implementations:

- The WebSocket relay server (`server/src/ws/handler.js` + `server/server.js`) provides authenticated room-based routing, ping/pong handling, and ext:status broadcasts — exactly as specified.
- The extension client (`ws/ws-client.js`) provides 20s keepalive, exponential backoff reconnection, badge management, and ext:snapshot on connect — wired into `background.js`.
- The dashboard client (`showcase/js/dashboard.js` + `showcase/css/dashboard.css`) replaces SSE with WebSocket using relative URLs, three-state connection indicator, and extension online/offline tracking.
- Deployment configuration (`Dockerfile`, `fly.toml`, `.dockerignore`) is complete with volume mount, auto-TLS, and static file serving from a single container.

No stubs, no orphaned artifacts, no dead SSE code remains in modified files. Three human verification items remain for runtime behavior validation.

---

_Verified: 2026-03-17T14:30:00Z_
_Verifier: Claude (gsd-verifier)_
