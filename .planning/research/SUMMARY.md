# Project Research Summary

**Project:** FSB v0.9.6 — Server Relay, Dashboard, QR Pairing, DOM Cloning, Background Agents, Automation Replay
**Domain:** Remote browser automation control, WebSocket relay, real-time DOM streaming
**Researched:** 2026-03-17
**Confidence:** HIGH (core architecture verified against Chrome official docs and direct codebase analysis)

## Executive Summary

FSB v0.9.6 is primarily an infrastructure and connectivity milestone, not a greenfield build. Direct codebase analysis confirms that background agents (manager, scheduler, executor), automation replay, and server-sync HTTP are already complete. The real work is wiring three new capabilities: (1) upgrading the existing SSE-based server to bidirectional WebSocket, (2) a QR pairing flow so dashboards can connect without manual hash key entry, and (3) a live DOM cloning stream so the dashboard can observe the browser in real time. The recommended approach is a single fly.io app serving both the dashboard site and the WebSocket relay, using the `ws` npm package alongside Express, with vanilla JS throughout (no build system, consistent with the existing extension).

The most important technical decision confirmed by research is to reject rrweb for DOM streaming. rrweb is stuck at alpha (v2.0.0-alpha.4, main package last published 3 years ago), adds 50KB+ overhead, and solves pixel-perfect session replay — a different problem. FSB already has a DOM snapshot pipeline. The correct approach is to extend that pipeline with MutationObserver incremental diffs sent as compact JSON deltas. Images load directly from their original CDN URLs on the dashboard side, meaning zero server bandwidth for image data.

The primary risk is the MV3 service worker lifecycle. WebSocket connections in service workers require Chrome 116+ and a 20-second keepalive ping to survive Chrome's 30-second idle termination. Setting `minimum_chrome_version: "116"` in the manifest is safe (Chrome 116 is from August 2023) and is the correct mitigation. A secondary risk is QR pairing security: the QR code must encode a short-lived one-time pairing token, never the persistent hash key, to prevent QRLJacking (OWASP documented attack). Both risks have clear, well-documented mitigations that must be implemented in Phase 1 and Phase 2 respectively.

## Key Findings

### Recommended Stack

The server is a single fly.io Node.js 20 LTS app combining Express (HTTP + static dashboard serving) and the `ws` package (WebSocket server). They share one HTTP server via the `upgrade` event — no separate processes or port management needed. Cost is approximately $2/month on a shared-cpu-1x instance with `min_machines_running = 1` to avoid cold start delays on WebSocket connections. For QR generation server-side, use `@paulmillr/qr` (zero-dependency, actively maintained). Extension and dashboard both vendor standalone JS files (QRCode.js for extension QR display, jsQR for dashboard camera scanning) since neither has a build system.

**Core technologies:**
- `ws` ^8.19.0: WebSocket server — zero dependencies, battle-tested, attaches to existing Express HTTP server
- `express` ^4.21.0: HTTP + static files — serves dashboard site, REST API, and WebSocket upgrade in one process
- `@paulmillr/qr` ^0.5.3: Server-side QR generation — zero-dep, actively maintained (unlike `qrcode` which is 2 years stale)
- `chrome.alarms` (built-in): Background agent scheduling — already in manifest, persists across service worker restarts
- `WebSocket` (browser built-in, Chrome 116+): Extension-to-server relay — requires `minimum_chrome_version: "116"` in manifest
- `MutationObserver` (browser built-in): DOM delta capture — already used for stability detection, extend for streaming
- fly.io: Hosting — WebSocket-native, auto-TLS, ~$2/month; Vercel/Netlify excluded (no persistent WebSocket)

**What NOT to add:** Socket.IO (50KB overhead, unnecessary), rrweb (alpha for 3 years, wrong abstraction), Redis/PostgreSQL (relay is stateless, in-memory Map sufficient), `node-cron` (scheduling stays in extension via `chrome.alarms`).

### Expected Features

Direct codebase review confirmed agents, replay, and server-sync are already built. The remaining work is WebSocket infrastructure and what depends on it.

**Must have (table stakes):**
- WebSocket relay server — SSE is read-only; remote task creation requires bidirectional commands; everything else depends on this
- QR code pairing — manual hash key paste is poor UX; scan-and-go device linking is the expected pattern
- Remote task creation — the core product promise: type a task on the dashboard, watch the browser execute it
- Live task monitoring — without feedback, remote task creation is fire-and-forget and unusable
- Connection status indicator — users need to know if their browser is actively connected; trust depends on this
- Agent monitoring dashboard — already partially built; upgrade SSE transport to WebSocket

**Should have (competitive differentiators):**
- Real-time DOM cloning stream — live structural view of the page in the dashboard (not a screenshot)
- AI action summaries on dashboard — already built in v0.9.5, just needs forwarding over WebSocket
- Replay cost savings display — already tracked per-agent, surface it prominently
- Multi-agent status view — see all running agents simultaneously

**Defer to post-MVP:**
- Agent creation from dashboard (can create agents in extension UI for now)
- Task templates (pure dashboard feature, addable any time without extension changes)
- Selective DOM region streaming (optimization; build full cloning first)

### Architecture Approach

The system topology is: Chrome extension service worker ↔ fly.io WebSocket relay ↔ dashboard SPA. The relay is a pure message router — it maintains an in-memory Map of `hashKey -> { extensions: Set<ws>, dashboards: Set<ws> }` and forwards messages between paired connections. No database writes for real-time events. The extension maintains a single WebSocket connection carrying all message types (DOM stream, task events, agent status, ping/pong), using a typed JSON envelope `{ type, payload, timestamp }` for routing. DOM observation is injected on-demand only when a dashboard is actively viewing — zero overhead otherwise.

**Major components:**
1. `ws/ws-client.js` (extension, NEW) — WebSocket connection manager: keepalive, reconnect with exponential backoff, message dispatcher
2. `content/dom-observer.js` (extension, NEW) — MutationObserver-based DOM serialization: initial full snapshot + incremental diffs, injected on-demand
3. `server/src/ws/handler.js` (server, NEW) — WebSocket handler: room-based routing by hashKey, extension/dashboard connection tracking
4. `server/src/routes/qr.js` (server, NEW) — QR pairing: one-time token generation (60s TTL), token validation, hashKey binding
5. `server/src/routes/tasks.js` (server, NEW) — Remote task endpoint: accept from dashboard, push to extension via WebSocket
6. Dashboard WS components (NEW) — DOMViewer, TaskCreator, QRPairing, ConnectionStatus, useWebSocket hook replacing useSSE

**Key patterns confirmed:**
- Single WebSocket per extension instance (not multiple connections per feature)
- DOM observer as opt-in content script injection (not default manifest injection)
- SSE replaced entirely by WebSocket (not maintained in parallel, except as showcase fallback)
- QR encodes one-time token, never the persistent hash key

### Critical Pitfalls

1. **MV3 service worker kills WebSocket at 30s idle** — Set `minimum_chrome_version: "116"` in manifest.json. Implement `setInterval` keepalive ping every 20 seconds (NOT `chrome.alarms` — 30s minimum is too close to the deadline). Reconnect with exponential backoff (1s, 3s, 8s, 15s). Address in Phase 1 before anything else.

2. **DOM serialization bandwidth explosion** — Never send full outerHTML on every mutation. Use the rrweb two-phase pattern: full snapshot once with stable node IDs, then compact incremental diffs. Throttle mutation batches to 200-500ms. Cap message size at 50KB; if exceeded, send a resync flag. Applies to Phase 4.

3. **QR pairing enables session hijacking (QRLJacking)** — QR must encode a one-time pairing token with 60-second TTL and single-use invalidation, never the persistent hash key. Rate-limit pairing attempts: 3 per minute per IP. Address in Phase 2 before any QR code is shown to users.

4. **Service worker 5-minute kill during long agent execution** — During automation, send `chrome.storage.session.set` or open a `chrome.runtime.Port` from the content script every 25 seconds to reset the idle timer. The existing 4-minute `EXECUTION_TIMEOUT` is not sufficient protection alone. Address in Phase 5.

5. **fly.io SQLite data loss on machine replacement** — SQLite on the ephemeral filesystem is lost when the fly.io machine is replaced. Mount a fly.io volume for the database file. Add a `/health` endpoint returning 200 for fly.io health checks. Address in Phase 1 deployment setup.

## Implications for Roadmap

Based on dependencies discovered across all four research files, a 5-phase structure is recommended:

### Phase 1: WebSocket Infrastructure
**Rationale:** Every feature in this milestone depends on bidirectional communication. The SSE-to-WebSocket migration and the MV3 keepalive problem must be solved before any remote control feature can be built or tested.
**Delivers:** Extension connects to relay server via WebSocket with keepalive; agent run results flow via WebSocket replacing HTTP; server has room-based routing; fly.io deployment with persistent SQLite volume.
**Addresses:** WebSocket relay (table stakes), connection status indicator, agent stats upgrade
**Avoids:** SSE/WebSocket mismatch pitfall, service worker idle termination, fly.io data loss
**Stack used:** `ws` package, Express upgrade event, `minimum_chrome_version: "116"`, fly.io volume configuration

### Phase 2: QR Pairing and Showcase
**Rationale:** The dashboard needs authentication before it can receive any data. QR pairing is a prerequisite for all dashboard features. Showcase page is a natural companion — both are public-facing and served from the same Express routes.
**Delivers:** Extension generates QR code; dashboard scans or manually enters pairing code; secure one-time token flow; showcase landing page at root URL.
**Addresses:** QR pairing (table stakes), showcase/landing page
**Avoids:** QRLJacking security pitfall (one-time token, 60s TTL, rate limiting)
**Stack used:** `@paulmillr/qr` (server), QRCode.js (extension, vendored), jsQR (dashboard, vendored)

### Phase 3: Remote Task Control and Live Monitoring
**Rationale:** With WebSocket infrastructure (Phase 1) and authentication (Phase 2) in place, remote task creation is straightforward wiring. Live monitoring is a prerequisite for remote task creation to feel usable — fire-and-forget is not acceptable.
**Delivers:** Dashboard form creates tasks that execute on the extension; progress events (phase, %, AI action summaries) flow to dashboard in real-time; dashboard migrated fully from SSE to WebSocket.
**Addresses:** Remote task creation (table stakes), live monitoring (table stakes), AI summaries on dashboard (differentiator)
**Avoids:** Event flooding pitfall (throttle progress events), concurrent task prevention (dashboard disables form while task runs)
**Architecture:** Adds `remote_tasks` table, `useWebSocket` hook replaces `useSSE`, new TaskCreator and ConnectionStatus components

### Phase 4: DOM Cloning Stream
**Rationale:** The most complex new feature and the primary differentiator. Depends on Phase 1 (WebSocket with room routing) and benefits from Phase 3 being complete (validated WS message flow pattern). Isolated to contain its complexity.
**Delivers:** Dashboard shows a live structural reconstruction of the page being automated; initial snapshot on task start; incremental mutations in real time; images load from original CDN URLs.
**Addresses:** Real-time DOM cloning (differentiator)
**Avoids:** Bandwidth explosion pitfall (incremental diffs, 50KB cap), dashboard RAM exhaustion (apply diffs incrementally, never full innerHTML replace), cross-origin image errors (use original URLs, show placeholder on failure)
**Architecture:** `content/dom-observer.js` (new, injected on-demand), `ws/dom-stream.js` (new), DOMViewer component with sandboxed iframe

### Phase 5: Hardening and Polish
**Rationale:** Several existing systems need hardening for real-world use before the milestone is complete. Background agent execution reliability and automation replay robustness are known gaps that would cause user-visible failures.
**Delivers:** Agent executor survives slow page loads (5-min kill mitigation); replay validates selectors before executing and detects site changes; dashboard handles disconnection gracefully with reconnect UX; extension shows remote-view indicator when dashboard is connected.
**Addresses:** Multi-agent status view (differentiator), cost savings display
**Avoids:** 5-minute service worker kill, replay selector rot, DOM clone stale state after reconnection
**Also includes:** Fly.io health check endpoint, responsive dashboard layout, error messages mapped to human-readable text

### Phase Ordering Rationale

- Phase 1 is a strict prerequisite: all real-time features depend on the WebSocket relay being stable
- Phase 2 is a strict prerequisite for dashboard access: no auth = no dashboard features
- Phase 3 validates the bidirectional message flow with a simpler payload (JSON task events) before Phase 4 adds high-throughput DOM streaming
- Phase 4 is isolated to contain its complexity; its failure mode (DOM out of sync) does not break remote task control
- Phase 5 is purely additive hardening and can be prioritized internally based on what breaks during earlier phase testing
- Background agents and automation replay are already built and require only WebSocket integration (Phase 1)

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 4 (DOM Cloning):** The custom serialization format (node IDs, diff operations, URL rewriting for Shadow DOM) has implementation-level decisions not fully resolved. Specifically: how to handle FSB's own Shadow DOM overlay in MutationObserver output, and whether to use outerHTML strings or a JSON node tree for the initial snapshot. Plan for a design spike.
- **Phase 5 (Service Worker Hardening):** The `chrome.runtime.Port` keepalive approach for agent execution needs testing — Port lifecycle behavior during background tab creation is not fully documented.

Phases with standard patterns (skip research-phase):
- **Phase 1 (WebSocket Infrastructure):** Chrome official docs fully document the keepalive pattern. `ws` + Express integration is a standard pattern with fly.io's own example app (flychat-ws).
- **Phase 2 (QR Pairing):** One-time token pairing is a documented pattern. Server-side QR SVG generation with `@paulmillr/qr` is straightforward.
- **Phase 3 (Remote Task Control):** The WebSocket message protocol is fully designed in FEATURES.md. Wiring to the existing `executeAutomationTask` function is low-risk integration.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Core libraries verified via npm. Chrome WebSocket docs confirmed. fly.io patterns confirmed via official blog. No speculative choices. |
| Features | HIGH | Existing features confirmed via direct codebase read. Remaining features derived from clear product requirements. WebSocket/DOM patterns validated via community sources. |
| Architecture | HIGH | Component boundaries match existing code structure. Chrome service worker behavior confirmed via official docs. Pattern decisions (single WS connection, on-demand DOM injection) are well-reasoned. |
| Pitfalls | HIGH | MV3 service worker timing verified against Chrome official docs. QRLJacking documented by OWASP. fly.io idle timeout and volume loss confirmed via fly.io configuration reference. |

**Overall confidence:** HIGH

### Gaps to Address

- **DOM serialization format for Shadow DOM:** FSB uses Shadow DOM for its own overlays. The MutationObserver in `content/dom-observer.js` must explicitly filter out FSB's own Shadow DOM mutations (to avoid streaming the extension UI) while optionally capturing page Shadow DOM. The exact filter logic needs a design decision during Phase 4 planning.
- **Dashboard tech stack discrepancy:** STACK.md recommends vanilla JS dashboard, but ARCHITECTURE.md references React SPA (`dashboard/src/`, `.jsx` files). The server directory apparently has a React + Vite dashboard already. This contradiction needs resolution at project start: is the new dashboard work added to the existing React app or rebuilt in vanilla JS? Likely React (existing code), but this should be confirmed against the actual `server/dashboard/` directory before Phase 3.
- **fly.io volume persistence for SQLite:** PITFALLS.md flags this as a HIGH recovery cost issue. fly.io volumes must be configured before first production deployment. The fly.toml template in STACK.md does not include a volume mount — this must be added during Phase 1.
- **`chrome.alarms` 30s minimum vs 30s SW idle:** Research notes that `chrome.alarms` minimum interval was tightened to 30 seconds in Chrome 120, which makes it unsuitable as the sole keepalive mechanism. The `setInterval`-based 20s ping inside the service worker is the correct solution, confirmed by Chrome docs. Do not use `chrome.alarms` for WebSocket keepalive.

## Sources

### Primary (HIGH confidence)
- [Chrome WebSocket in Service Workers](https://developer.chrome.com/docs/extensions/how-to/web-platform/websockets) — Chrome 116+ keepalive behavior, 20-second ping pattern
- [Chrome Service Worker Lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle) — 30-second idle timeout, 5-minute event handler limit
- [chrome.alarms API](https://developer.chrome.com/docs/extensions/reference/api/alarms) — 30-second minimum interval (Chrome 120+), persistence across restarts
- [fly.io configuration reference](https://fly.io/docs/reference/configuration/) — idle_timeout, min_machines_running, health checks, volumes
- [ws npm package](https://www.npmjs.com/package/ws) — v8.19.0, zero dependencies, verified active
- [OWASP QRLJacking](https://owasp.org/www-community/attacks/Qrljacking) — QR code session hijacking attack
- FSB codebase: `agents/`, `server/`, `background.js`, `manifest.json` — direct code review confirming existing feature status

### Secondary (MEDIUM confidence)
- [fly.io WebSocket blog](https://fly.io/blog/websockets-and-fly/) — Express + ws pattern, flychat-ws example, TLS termination behavior
- [rrweb serialization docs](https://github.com/rrweb-io/rrweb/blob/master/docs/serialization.md) — incremental snapshot architecture reference (used for design inspiration, not implementation)
- [jsQR GitHub](https://github.com/cozmo/jsQR) — pure JS QR reader for dashboard camera scanning
- [MV3 service worker keepalive discussion](https://medium.com/@dzianisv/vibe-engineering-mv3-service-worker-keepalive-how-chrome-keeps-killing-our-ai-agent-9fba3bebdc5b) — real-world AI agent SW termination experience

### Tertiary (LOW confidence)
- rrweb performance benchmarks — DOM serialization overhead estimates (~6MB memory, ~21% CPU); needs validation against FSB's specific snapshot format

---
*Research completed: 2026-03-17*
*Ready for roadmap: yes*
