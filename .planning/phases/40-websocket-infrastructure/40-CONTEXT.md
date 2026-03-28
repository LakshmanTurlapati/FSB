# Phase 40: WebSocket Infrastructure - Context

**Gathered:** 2026-03-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Upgrade the existing Express+SSE server to a WebSocket relay, deploy to fly.io as a single app serving both the showcase site and WS/REST API, connect extension service worker and dashboard via WebSocket with connection status indicators. SSE is replaced, not augmented.

</domain>

<decisions>
## Implementation Decisions

### Dashboard codebase
- `showcase/` is the ONLY dashboard — vanilla JS, no build system
- `server/dashboard/` is dead code — remove entirely during this phase
- Server serves showcase static files + WS relay + REST API from a single fly.io app
- Dashboard uses relative URLs (`/api/...`) since server serves it — no hardcoded API_BASE
- Static assets get proper `Cache-Control` headers; fly.io edge CDN handles caching

### WS message protocol
- Hybrid approach: keep REST API for agent CRUD and run results (reliable, retryable via server-sync.js HTTP). Use WS only for real-time events (progress, DOM stream, status, remote task commands)
- Server is a pure relay — no event persistence. If dashboard disconnects, real-time events are lost. Agent run results still persist via existing REST API
- Claude's discretion on message envelope format and whether server does typed routing or blind relay

### Connection lifecycle
- Always-on WS when serverSyncEnabled is true — dashboard can connect anytime and see extension online status
- Aggressive reconnection: immediate retry, then exponential backoff (1s, 2s, 4s, 8s... capped at 30s). Never give up
- Accept termination when Chrome fully closes — WS dies, reconnect automatically on next Chrome launch. Agents resume via chrome.alarms
- On reconnect, extension sends state snapshot automatically — dashboard auto-refreshes, seamless UX
- Badge icon on extension icon: green dot = connected, red dot = disconnected. Visible at a glance without opening popup
- Chrome 116+ required for WS keepalive in service worker (20s ping interval)

### Deployment
- fly.io account and fsb-server.fly.dev domain already exist
- SQLite + fly.io volume mount at /data for persistence across redeploys
- Manual `fly deploy` from CLI (no CI/CD for now)
- Drop FSB_SERVER_SECRET — hash key IS the auth. Server just verifies hash key exists in DB

### Claude's Discretion
- WS message envelope format (typed JSON envelope recommended by research)
- Server routing strategy (blind relay vs typed routing)
- Exact reconnection backoff parameters
- fly.toml and Dockerfile specifics
- How to handle the SSE-to-WS migration (remove SSE route, replace with WS upgrade handler)
- Badge icon implementation details

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing server code
- `server/server.js` — Current Express server, SSE client tracking, route setup, static file serving
- `server/src/routes/sse.js` — SSE implementation to replace with WebSocket (30s keepalive, hashKey-based client map)
- `server/src/routes/auth.js` — Hash key registration and validation
- `server/src/routes/agents.js` — Agent CRUD REST API (keep as-is)
- `server/src/middleware/auth.js` — Hash key auth middleware (keep as-is)
- `server/src/db/schema.js` — SQLite schema (hash_keys, agents, agent_runs tables)
- `server/src/db/queries.js` — Database query functions
- `server/package.json` — Current dependencies (express, better-sqlite3, cors, dotenv)

### Extension server sync
- `agents/server-sync.js` — Extension-side HTTP client, hardcoded to fsb-server.fly.dev, retry queue

### Dashboard (showcase)
- `showcase/js/dashboard.js` — Current SSE connection, agent grid, run history, hash key login
- `showcase/dashboard.html` — Dashboard HTML with login section, stats bar, agent grid, runs panel
- `showcase/css/dashboard.css` — Dashboard styles

### Dead code to remove
- `server/dashboard/` — React+Vite dashboard, superseded by showcase/

### Research
- `.planning/research/STACK.md` — Stack recommendations (ws ^8.19, Chrome 116+ WS in SW)
- `.planning/research/ARCHITECTURE.md` — Architecture with data flow and component breakdown
- `.planning/research/PITFALLS.md` — MV3 lifecycle risks, WS keepalive requirements

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `server/src/routes/sse.js`: SSE client map pattern (hashKey -> [clients]) — same routing logic applies to WS, just different transport
- `server/src/middleware/auth.js`: Hash key auth middleware — reuse for WS authentication on upgrade
- `agents/server-sync.js`: HTTP sync client — stays as-is for agent CRUD, but needs new WS client class alongside it
- `showcase/js/dashboard.js`: SSE connection logic — rewrite to WS but same event handling patterns

### Established Patterns
- hashKey-based client routing (SSE already does this)
- Express middleware for auth (reuse for WS upgrade validation)
- chrome.storage.local for server config (serverUrl, serverHashKey, serverSyncEnabled)
- No build system — vanilla JS everywhere

### Integration Points
- `server/server.js` line 88: `app.listen()` needs to capture the HTTP server for WS upgrade attachment
- `showcase/js/dashboard.js` line 9: `API_BASE` hardcoded — replace with relative URLs
- `agents/server-sync.js` line 22: `serverSyncEnabled` storage key — WS connection uses same flag
- Extension service worker (background.js): new WS client module needs to be loaded

</code_context>

<specifics>
## Specific Ideas

- Single fly.io app serving everything — no separate containers
- Badge icon for connection status is the only extension UI change in this phase
- Extension should reconnect seamlessly without user intervention — like a messaging app that's always synced

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 40-websocket-infrastructure*
*Context gathered: 2026-03-17*
