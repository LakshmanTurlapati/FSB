# Phase 41: QR Pairing & Showcase Site - Context

**Gathered:** 2026-03-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Users pair their browser to the dashboard by scanning a QR code displayed in the extension's control panel. The dashboard is accessible as a public showcase site with mobile support. Pairing uses one-time tokens (not raw hash keys) with 60-second expiry. The existing paste-key flow remains as a fallback.

</domain>

<decisions>
## Implementation Decisions

### QR pairing flow
- QR code displayed in the **control panel** (ui/control_panel.html), in the server sync section next to the existing hash key display
- "Pair Dashboard" button next to Generate/Copy hash key buttons — clicking it **inline-expands** a QR code below the hash key area
- QR encodes a one-time pairing token (not the raw hash key) with 60-second TTL and a visible countdown timer
- QR collapses after successful scan or expiry; user can regenerate
- On the dashboard side, camera viewfinder is built into the login card (no separate page)

### Dashboard login — tabbed layout
- Login card redesigned with two tabs: **"Scan QR"** (default/primary) and **"Paste Key"** (fallback)
- "Scan QR" tab shows camera viewfinder with instruction: "Point camera at QR code in FSB extension control panel"
- "Paste Key" tab preserves existing hash key input + Connect button
- On scan failure or camera denied: auto-fallback to "Paste Key" tab with brief error message ("Camera unavailable" or "Scan failed")

### Session management
- Paired sessions last **24 hours** before requiring re-pairing
- Session token stored in dashboard localStorage, validated against server on each connection
- On expiry: dashboard content fades, login card reappears with message "Session expired. Scan QR code to reconnect." — gentle, no jarring error
- On return visit within 24h: auto-connect immediately, skip login (check localStorage token validity)
- Dashboard header shows "Paired" status with Disconnect/Unpair button (replaces login section entirely when paired)

### Dashboard paired state
- Login card disappears when paired — dashboard content shows with status bar in header
- Header shows paired status + extension online/offline indicator (reuses Phase 40 connection indicator)
- Disconnect/Unpair button in header to revoke session

### Landing page
- **Keep and polish existing** index.html — already has hero section and feature highlights
- Add prominent "Open Dashboard" CTA button in hero section (in addition to existing nav link)
- Ensure mobile responsiveness: nav hamburger (already exists), hero stacks vertically, feature cards go single-column
- Update content to reflect v0.9.6 capabilities if outdated

### Public access
- Dashboard requires pairing (login card shown until paired) — SITE-02 says "QR pairing is the auth"
- Landing page (index.html) is the public showcase — no login needed
- No public demo/read-only dashboard view

### Mobile responsiveness
- Landing page must work well on mobile (SITE-03 requirement)
- Dashboard must work on mobile browsers (primary use case: scanning QR from phone camera)
- Existing nav hamburger menu already handles mobile nav

### Claude's Discretion
- QR code generation library choice (lightweight, vanilla JS compatible)
- Camera/barcode scanning library choice (lightweight, no build system)
- Pairing token format and server-side token exchange implementation
- Exact countdown timer visual design (ring, bar, or numeric)
- Session token storage format and validation mechanism
- Transition animations between login and dashboard states
- Mobile breakpoints and responsive layout details

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Extension control panel (QR code host)
- `ui/control_panel.html` — Control panel layout, sidebar nav, server sync section with hash key display (lines 693-697)
- `ui/options.js` — Control panel JavaScript (hash key generation, server sync toggle logic)
- `ui/options.css` — Control panel styles

### Dashboard (QR scanner + auth)
- `showcase/dashboard.html` — Current login card (lines 58-76), dashboard content section, header with status badges
- `showcase/js/dashboard.js` — Hash key login flow, WS connection, localStorage STORAGE_KEY, validateAndConnect()
- `showcase/css/dashboard.css` — Login card styles, dashboard layout, connection status badge styles

### Landing page (showcase site)
- `showcase/index.html` — Current landing page with hero, features, nav
- `showcase/css/home.css` — Landing page styles
- `showcase/css/main.css` — Shared styles, nav, responsive breakpoints

### Server (token exchange)
- `server/server.js` — Express server, WS upgrade handler
- `server/src/routes/auth.js` — Hash key registration and validation
- `server/src/db/schema.js` — SQLite schema (will need pairing_tokens table)
- `server/src/db/queries.js` — Database query functions
- `server/src/ws/handler.js` — WebSocket room manager, broadcastToRoom

### Phase 40 context (inherited patterns)
- `.planning/phases/40-websocket-infrastructure/40-CONTEXT.md` — WS protocol decisions, connection lifecycle, vanilla JS locked

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `showcase/dashboard.html` login card (lines 58-76): Existing card layout with icon, heading, input, button — restructure into tabbed layout
- `showcase/js/dashboard.js` validateAndConnect(): Hash key validation flow — reuse for paste-key tab, extend for token-based pairing
- `ui/control_panel.html` hash key section: "Generate" and "Copy" buttons — add "Pair Dashboard" button alongside
- Phase 40 connection status indicator: Three-state badge (connected/disconnected/reconnecting) — reuse in paired dashboard header

### Established Patterns
- Vanilla JS, no build system (locked from Phase 40)
- localStorage for client-side state (dashboard uses `fsb-dashboard-key` key)
- Relative URLs for all API calls (Phase 40 decision)
- CSS class toggling for state changes (dash-sse-connected, dash-sse-disconnected, dash-sse-reconnecting)
- Mobile nav: hamburger toggle with `.nav-mobile` overlay (already in showcase pages)

### Integration Points
- `server/src/routes/auth.js`: Add pairing token generation endpoint (POST /api/pair/generate) and token exchange endpoint (POST /api/pair/exchange)
- `server/src/db/schema.js`: Add pairing_tokens table (token, hash_key, created_at, expires_at, used)
- `ui/control_panel.html` line 695-697: Add "Pair Dashboard" button next to existing Generate/Copy buttons
- `showcase/dashboard.html` line 59-76: Replace login card internals with tabbed Scan QR / Paste Key layout
- `showcase/js/dashboard.js` line 14: localStorage key — add session token alongside hash key

</code_context>

<specifics>
## Specific Ideas

- QR code appears inline in control panel server sync section — not a modal, not a new page
- Dashboard login card has two tabs, "Scan QR" is default — feels modern and frictionless
- Session expiry is a gentle fade back to login, not an error state
- Return visits within 24h skip login entirely — seamless like a messaging app

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 41-qr-pairing-showcase-site*
*Context gathered: 2026-03-17*
