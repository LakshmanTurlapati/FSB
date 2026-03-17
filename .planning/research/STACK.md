# Technology Stack: v0.9.6 Agents & Remote Control

**Project:** FSB v0.9.6 - Server Relay, Dashboard, QR Pairing, DOM Cloning, Background Agents, Automation Replay
**Researched:** 2026-03-17
**Constraint:** Vanilla JS extension (no build system), new Node.js server component on fly.io
**Overall confidence:** HIGH (core libraries verified via npm/official docs; fly.io deployment patterns well-documented)

---

## Executive Summary

This milestone introduces FSB's first server-side component and first external web application. The extension remains vanilla JS with no build system -- the server is a separate Node.js project deployed to fly.io. The stack additions are minimal and deliberate: `ws` for WebSocket relay, `express` for serving the dashboard + API, `qr` for QR code pairing, and custom DOM serialization (NOT rrweb) for the cloning stream. Background agents use Chrome's existing `chrome.alarms` API. No new Chrome permissions are needed beyond what's already in the manifest.

**Key decision: Build the DOM cloning yourself, do NOT use rrweb.** The project already has a sophisticated DOM snapshot system (unified markdown snapshots with element refs). rrweb is stuck in alpha (v2.0.0-alpha.4, main package last published 3 years ago), adds 50KB+ of code, and solves a different problem (pixel-perfect session replay). FSB needs structural DOM cloning for a control dashboard, not video-like replay. Extend the existing snapshot pipeline to emit serialized DOM deltas over WebSocket.

---

## Recommended Stack

### Server-Side (NEW -- fly.io)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Node.js | 20 LTS | Server runtime | LTS stability, native WebSocket client support since v22 but v20 is the safe choice for production |
| `ws` | ^8.19.0 | WebSocket server | De facto standard for Node.js WS servers. 0 dependencies, blazing fast, thoroughly tested. Node.js v22 has native WS client but NO native WS server -- `ws` fills this gap |
| `express` | ^4.21.0 | HTTP server + static files | Serves dashboard site, handles QR pairing API, and upgrades connections to WebSocket. Single app serves both static site and WS relay |
| `@paulmillr/qr` (aka `qr`) | ^0.5.3 | QR code generation (server-side) | Zero-dependency, 4KB, generates SVG/ASCII QR codes. Server generates pairing QR that dashboard page displays. Actively maintained (last published ~1 month ago) |
| `crypto` (Node built-in) | N/A | Pairing hash generation | `crypto.randomUUID()` + `crypto.createHash()` for unique pairing tokens. No external dependency needed |

### Extension-Side (CHANGES to existing)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `WebSocket` (browser built-in) | N/A | Connect to relay server | Chrome 116+ supports WebSocket in MV3 service workers with keepalive. Extension already requires Chrome 88+; bump minimum to 116 |
| `chrome.alarms` | Existing API | Background polling agent scheduling | Already in manifest permissions. Minimum interval 1 minute. Wakes service worker reliably. Perfect for cron-like polling tasks |
| `MutationObserver` (browser built-in) | N/A | DOM change detection for cloning stream | Already used in the stability detection system. Extend to emit serialized DOM deltas for real-time cloning |
| QRCode.js | 1.0.0 (vendored) | QR code display in extension popup | Zero-dependency, works via script tag, generates QR on canvas. Vendored (copied into extension), NOT npm-installed. Extension shows QR for phone/dashboard scanning |

### Dashboard Site (NEW -- served from same fly.io app)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Vanilla HTML/CSS/JS | N/A | Dashboard UI | Matches the extension's no-build-system constraint. The dashboard is a single-page app with a few HTML files served by Express |
| `WebSocket` (browser built-in) | N/A | Connect to relay for live updates | Dashboard receives DOM clones and task status via WebSocket |
| `qr-scanner` or camera API | N/A | QR scanning on dashboard | Dashboard needs to scan QR codes displayed by the extension. Use `navigator.mediaDevices.getUserMedia()` + jsQR (vendored) for camera-based scanning, OR manual code entry as fallback |

### Infrastructure

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| fly.io | N/A | Hosting platform | WebSocket-native (no special config needed), auto-TLS, global edge network, ~$2/month for a shared-cpu-1x instance. Single app serves both static dashboard and WebSocket relay |
| Docker | N/A | Deployment container | fly.io auto-generates Dockerfile from Node.js app. Standard `node:20-alpine` base |

---

## Architecture: Single fly.io App

The server is ONE application that handles three responsibilities:

```
fly.io app (fsb-relay)
  |
  +-- Express static files --> Dashboard/showcase site (HTML/CSS/JS)
  +-- Express REST API     --> POST /api/pair (QR pairing), GET /api/status
  +-- ws WebSocket server  --> /ws endpoint (relay between extension <-> dashboard)
```

This avoids the complexity and cost of separate apps. Express serves the static dashboard files AND handles HTTP API routes. The `ws` library attaches to the same HTTP server for WebSocket upgrades.

---

## Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `jsQR` | 1.4.0 (vendored in dashboard) | QR code reading from camera | Dashboard scans QR codes shown by extension. Vendored into dashboard static files, not npm-installed in extension |
| `helmet` | ^8.0.0 | HTTP security headers | Express middleware for the dashboard. Sets CSP, HSTS, etc. Small, focused, well-maintained |
| `cors` | ^2.8.5 | CORS headers for API | Extension needs to POST to the relay server from any origin. Scoped to specific routes only |
| `uuid` | ^11.1.0 | Pairing token generation | Generate unique pairing codes. Could use `crypto.randomUUID()` instead to avoid the dependency -- prefer built-in |

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| WebSocket library | `ws` | Socket.IO | Socket.IO adds 50KB+ client-side, auto-reconnect/rooms are nice but overkill for a relay. `ws` is lighter, the extension's service worker handles reconnection logic directly |
| WebSocket library | `ws` | `uWebSockets.js` | uWS is faster but requires native compilation, complicates Docker deployment, and the relay won't have enough connections to need it |
| Dashboard framework | Vanilla HTML/JS | React/Vue/Svelte | No build system constraint applies to the dashboard too. The dashboard is simple enough (DOM viewer, task list, settings) that a framework adds complexity without proportional value |
| QR generation (extension) | QRCode.js (vendored) | `qr` npm package | Extension has no build system and no npm. QRCode.js is a single file that works with a script tag in HTML pages |
| QR generation (server) | `qr` (@paulmillr) | `qrcode` npm | `qrcode` hasn't been updated in 2 years. `qr` is zero-dep, actively maintained, smaller |
| DOM streaming | Custom (extend existing snapshots) | rrweb | rrweb main package stuck at alpha for 3 years. 50KB+. Solves pixel-perfect replay, not structural cloning. FSB already has DOM serialization -- extend it with MutationObserver deltas |
| DOM streaming | Custom | Chrome DevTools Protocol (CDP) | CDP `DOM.getDocument` would work but requires `debugger` permission active (already have it). However, CDP DOM snapshots are verbose XML and don't leverage FSB's existing element-aware serialization. Custom approach reuses existing code |
| Background scheduling | `chrome.alarms` | `setInterval` | Service workers terminate after 30s idle. `setInterval` timers die with the worker. `chrome.alarms` persists across worker restarts |
| Hosting | fly.io | Vercel/Netlify | Vercel/Netlify are serverless -- no persistent WebSocket connections. fly.io runs actual servers with WebSocket support natively |
| Hosting | fly.io | Railway | Railway works but fly.io has better WebSocket documentation, edge network, and the user specified fly.io |
| Hosting | fly.io | Render | Render's free tier spins down (kills WebSocket connections). fly.io machines stay warm for ~$2/month |

---

## Chrome Extension Changes

### Minimum Chrome Version Bump

**Current:** Chrome 88+ (implicit from MV3)
**Required:** Chrome 116+ (for WebSocket support in service workers)

Chrome 116 (released August 2023) added proper WebSocket lifecycle management in MV3 service workers. Active WebSocket connections now extend the service worker's idle timer. A heartbeat message every 20 seconds keeps the connection alive.

**Impact:** Minimal. Chrome 116 is 2.5+ years old. Users on older versions can still use the extension for local automation; remote features gracefully degrade.

### No New Permissions Needed

The manifest already has everything:
- `alarms` -- for background polling agent scheduling
- `storage` / `unlimitedStorage` -- for saving automation recordings and agent configurations
- `offscreen` -- could be used for WebSocket keepalive if needed (already present)
- `tabs`, `activeTab`, `scripting` -- for automation replay
- `<all_urls>` host permission -- allows connecting to the relay server

### New Manifest Entry: `externally_connectable` (MAYBE)

If the dashboard needs to communicate directly with the extension (not through the relay), add:
```json
"externally_connectable": {
  "matches": ["https://fsb-relay.fly.dev/*"]
}
```
**Decision: Probably NOT needed.** All communication should go through the WebSocket relay. Direct extension messaging from a web page is fragile and requires the extension ID.

---

## WebSocket Protocol Design (Stack Implications)

The relay server is stateless -- it routes messages between paired clients. No database needed.

```
Extension (ws client) <---> fly.io relay (ws server) <---> Dashboard (ws client)
```

**Message format:** JSON over WebSocket (not binary). Messages are small (DOM deltas, task status, commands). No need for protobuf or MessagePack.

**Pairing flow:**
1. Extension generates pairing token via `crypto.randomUUID()`
2. Extension connects to relay: `wss://fsb-relay.fly.dev/ws?token=<token>`
3. Extension displays token as QR code (using QRCode.js)
4. Dashboard scans QR (using jsQR + camera) or user types code manually
5. Dashboard connects to relay with same token
6. Relay matches the two connections, begins forwarding messages

**Server state:** In-memory Map of `token -> [extensionSocket, dashboardSocket]`. No persistence needed -- if the server restarts, clients reconnect and re-pair (the token is stored in extension storage).

---

## DOM Cloning Strategy (Stack Implications)

**Do NOT proxy images.** The PROJECT.md explicitly states "images via CDN, not proxied." The DOM clone sends image URLs as-is. The dashboard renders them directly from the original CDN sources. This means:

- No image proxy server needed
- No bandwidth costs for image relay
- Dashboard must handle CORS/mixed content for images (some will fail to load -- acceptable)

**Serialization approach:**
1. **Initial snapshot:** Full DOM serialization (extend existing `buildDomSnapshot()` to output JSON tree instead of markdown)
2. **Incremental updates:** MutationObserver captures DOM changes, serializes only the delta (added/removed/modified nodes)
3. **Dashboard reconstruction:** Receives JSON tree, builds DOM in an iframe or shadow DOM container

**Estimated data volume:** Initial snapshot ~50-200KB depending on page complexity. Deltas typically 1-5KB per change batch. At 1-2 updates/second, this is well within WebSocket bandwidth.

---

## Background Agent Scheduling

**`chrome.alarms` constraints:**
- Minimum interval: 1 minute (Chrome enforces this)
- Alarms persist across service worker restarts
- Listener must be registered at top level of service worker
- Maximum ~500 alarms (undocumented but practical limit)

**Agent types and intervals:**
| Agent Type | Default Interval | Configurable? |
|------------|-----------------|---------------|
| Price monitor | 15 minutes | Yes (min 1 min) |
| Stock check | 5 minutes | Yes (min 1 min) |
| Page change detection | 30 minutes | Yes (min 1 min) |
| Custom polling | 10 minutes | Yes (min 1 min) |

**Storage for agent configs:** `chrome.storage.local` (already have `unlimitedStorage` permission). Each agent stores:
- URL to check
- Polling interval
- Last result hash (for change detection)
- Action to take on change (notify, run automation, etc.)

---

## Automation Replay (Stack Implications)

**No new libraries needed.** Replay uses the existing action execution pipeline:

1. **Recording:** During a successful automation, save the action sequence with selectors to `chrome.storage.local`
2. **Replay:** Re-execute saved actions using `findElementByStrategies()` with the saved selectors
3. **AI fallback:** If a selector fails (page changed), pass the current DOM snapshot + saved action intent to AI for re-resolution

**Storage format:**
```javascript
{
  id: "recording-uuid",
  name: "Add to cart on Amazon",
  url: "https://amazon.com/...",
  actions: [
    { type: "click", selectors: [...], description: "Click search box" },
    { type: "type", value: "wireless mouse", selectors: [...] },
    { type: "click", selectors: [...], description: "Click first result" }
  ],
  createdAt: "2026-03-17T...",
  lastSuccess: "2026-03-17T..."
}
```

---

## Installation

### Server (new project)

```bash
# Initialize server project
mkdir fsb-relay && cd fsb-relay
npm init -y

# Core dependencies
npm install ws express qr helmet cors

# Dev dependencies (optional)
npm install -D nodemon

# fly.io deployment
fly launch --name fsb-relay
fly deploy
```

### Extension (modifications only)

```
# No npm install needed -- extension has no build system
# Vendor QRCode.js into extension:
# Download https://davidshimjs.github.io/qrcodejs/qrcode.min.js
# Save as lib/qrcode.min.js

# Vendor jsQR into dashboard static files:
# Download from https://github.com/cozmo/jsQR
# Save as dashboard/lib/jsqr.min.js (server-side, not in extension)
```

### fly.toml (server config)

```toml
app = "fsb-relay"
primary_region = "iad"

[build]

[http_service]
  internal_port = 3000
  force_https = true
  auto_stop_machines = "stop"
  auto_start_machines = true
  min_machines_running = 1

[env]
  PORT = "3000"
  NODE_ENV = "production"
```

---

## Cost Estimate

| Component | Monthly Cost | Notes |
|-----------|-------------|-------|
| fly.io shared-cpu-1x (256MB) | ~$2.00 | Single machine, always running |
| fly.io bandwidth | ~$0.00 | 100GB free outbound, DOM deltas are tiny |
| fly.io TLS certificate | $0.00 | Auto-provisioned via Let's Encrypt |
| **Total** | **~$2/month** | Can scale to shared-cpu-2x ($3.50/mo) if needed |

---

## Version Compatibility Matrix

| Component | Minimum Version | Reason |
|-----------|----------------|--------|
| Chrome | 116 | WebSocket in MV3 service workers |
| Node.js (server) | 20.x LTS | `crypto.randomUUID()`, stable ESM support |
| `ws` | 8.x | Stable API, permessage-deflate support |
| `express` | 4.x | Battle-tested, 5.x still in beta |
| fly.io CLI (`flyctl`) | Latest | Deployment tool, always use latest |

---

## What NOT to Add

| Technology | Why Not |
|------------|---------|
| Socket.IO | Overhead of polling fallback, rooms, namespaces -- all unnecessary for a simple relay |
| rrweb | Alpha for 3 years, wrong abstraction (session replay vs structural cloning), 50KB+ |
| React/Vue/Svelte (dashboard) | No-build-system constraint. Dashboard is simple enough for vanilla JS |
| Redis/PostgreSQL | Server is stateless relay. In-memory Map is sufficient. If server restarts, clients reconnect |
| Protobuf/MessagePack | JSON is fine for DOM deltas and task commands. Complexity not justified |
| nginx reverse proxy | fly.io handles TLS termination and routing. Express serves everything directly |
| Puppeteer/Playwright | Server does NOT run browsers. User's browser stays active. Server is relay only |
| `node-cron` | Server doesn't schedule tasks. Chrome's `chrome.alarms` handles scheduling in the extension |
| Screenshot/video streaming | PROJECT.md explicitly says "DOM cloning with CDN images, not visual capture" |

---

## Sources

### Official Documentation (HIGH confidence)
- [ws npm package](https://www.npmjs.com/package/ws) -- v8.19.0, last published ~2 months ago
- [Chrome WebSocket in Service Workers](https://developer.chrome.com/docs/extensions/how-to/web-platform/websockets) -- Chrome 116+ support, heartbeat pattern
- [chrome.alarms API](https://developer.chrome.com/docs/extensions/reference/api/alarms) -- 1-minute minimum interval, persistence across restarts
- [fly.io WebSocket blog](https://fly.io/blog/websockets-and-fly/) -- no special config needed, Express + ws pattern
- [fly.io static site docs](https://fly.io/docs/languages-and-frameworks/static/) -- nginx or Express for static serving
- [fly.io Node.js docs](https://fly.io/docs/deep-dive/nodejs/) -- deployment patterns
- [fly.io pricing](https://fly.io/pricing/) -- pay-as-you-go, ~$2/month for shared-cpu-1x
- [qr npm package](https://www.npmjs.com/package/qr) -- v0.5.3, zero-dep, last published ~1 month ago
- [QRCode.js](https://davidshimjs.github.io/qrcodejs/) -- cross-browser, no dependencies, canvas-based

### Community/Verified (MEDIUM confidence)
- [Express + ws on fly.io pattern](https://fly.io/blog/websockets-and-fly/) -- flychat-ws example app
- [jsQR GitHub](https://github.com/cozmo/jsQR) -- pure JS QR reader, works in browser
- [Chrome MV3 service worker lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle) -- 30s idle timeout, alarm wakeup

### Architecture Decisions (HIGH confidence -- from PROJECT.md)
- "DOM cloning with CDN images, not visual capture" -- no image proxying
- "Server is relay only, user's browser must stay active" -- no headless execution
- "No build system: Direct JavaScript execution" -- vanilla JS for all components
