---
phase: 40-websocket-infrastructure
plan: 01
subsystem: infra
tags: [websocket, ws, express, fly-io, docker, relay, rooms]

# Dependency graph
requires: []
provides:
  - WebSocket relay server with room-based routing by hashKey
  - setupWSHandler and broadcastToRoom exports from ws/handler.js
  - fly.io deployment configuration with SQLite volume mount
  - Showcase static file serving with cache headers
affects: [42-extension-ws-client, 43-dashboard-vanilla, 44-testing-deployment]

# Tech tracking
tech-stack:
  added: [ws]
  patterns: [room-based-ws-relay, hashKey-auth-on-upgrade, typed-message-routing]

key-files:
  created:
    - server/src/ws/handler.js
    - Dockerfile
    - fly.toml
    - .dockerignore
  modified:
    - server/server.js
    - server/src/routes/agents.js
    - server/src/routes/auth.js
    - server/src/utils/hash.js
    - server/package.json

key-decisions:
  - "Removed SERVER_SECRET; hashKey generated via crypto.randomBytes(32) instead of HMAC"
  - "Placed Dockerfile and fly.toml at repo root for simpler fly deploy with both server/ and showcase/"
  - "Showcase static files served from ../showcase in dev, /app/public in Docker"

patterns-established:
  - "Room-based WS relay: hashKey -> { extensions: Set, dashboards: Set }"
  - "WS upgrade auth: query param ?key=hashKey&role=extension on /ws path"
  - "Typed message routing: ping handled server-side, all others relayed to opposite side"
  - "broadcastToRoom(hashKey, msgObj) for REST-to-WS event push"

requirements-completed: [SERV-01, SERV-05, SERV-06, SERV-07]

# Metrics
duration: 5min
completed: 2026-03-17
---

# Phase 40 Plan 01: WebSocket Infrastructure Summary

**WebSocket relay server with room-based hashKey routing, typed message handling, and fly.io deployment config replacing SSE**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-17T12:27:58Z
- **Completed:** 2026-03-17T12:33:06Z
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments
- WebSocket handler with room-based relay (extensions <-> dashboards), ping/pong, and ext:status broadcasts
- Server.js rewritten with http.createServer, WS upgrade authentication, configurable DB_PATH
- agents.js migrated from SSE to WS broadcast; SSE route and dead dashboard/ directory removed
- fly.io deployment fully configured: Dockerfile, fly.toml with volume mount, .dockerignore

## Task Commits

Each task was committed atomically:

1. **Task 1: Create WS handler module and update server.js for WebSocket relay** - `01a4e09` (feat)
2. **Task 2: Create fly.io deployment configuration** - `84764cd` (chore)

## Files Created/Modified
- `server/src/ws/handler.js` - WebSocket room manager with relay, ping/pong, broadcast helpers
- `server/server.js` - Express + WS on single HTTP server with upgrade auth
- `server/src/routes/agents.js` - Switched from SSE to broadcastToRoom
- `server/src/routes/auth.js` - Removed serverSecret parameter
- `server/src/utils/hash.js` - Simplified to crypto.randomBytes(32)
- `server/package.json` - Added ws dependency
- `Dockerfile` - Node.js 20 Alpine with server + showcase
- `fly.toml` - fly.io config with SQLite volume mount at /data
- `.dockerignore` - Excludes dev files from Docker build

## Decisions Made
- Removed SERVER_SECRET entirely -- hash key IS the auth token, generated via crypto.randomBytes
- Placed Dockerfile and fly.toml at repo root so Docker build context can copy both server/ and showcase/
- Showcase static files resolve from ../showcase locally, /app/public in Docker container
- Dashboard SPA fallback tries dashboard.html first (from showcase), falls back to index.html

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- WebSocket relay server is complete and ready for extension and dashboard clients
- fly.io deployment files ready for `fly deploy` from repo root
- broadcastToRoom export available for any route that needs to push WS events

---
*Phase: 40-websocket-infrastructure*
*Completed: 2026-03-17*
