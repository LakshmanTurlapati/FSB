# Roadmap: FSB v0.9.6 Agents & Remote Control

## Overview

This milestone transforms FSB from a local-only Chrome extension into a remotely controllable automation platform. The work progresses through five phases: first establishing a WebSocket relay server on fly.io (the foundation everything depends on), then building QR-based device pairing with a public showcase site, then wiring remote task creation and live monitoring, then surfacing agent management on the dashboard, and finally streaming a live DOM clone so the dashboard can observe the browser working in real time.

## Phases

**Phase Numbering:**
- Integer phases (40, 41, 42...): Planned milestone work
- Decimal phases (40.1, 40.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 40: WebSocket Infrastructure** - Server upgrades from SSE to WebSocket relay with fly.io deployment, extension keepalive, and dashboard connectivity (completed 2026-03-17)
- [x] **Phase 41: QR Pairing & Showcase Site** - Secure device pairing via QR code with one-time tokens, plus public landing page and dashboard shell (completed 2026-03-17)
- [ ] **Phase 42: Remote Task Control** - Create tasks from dashboard and monitor execution with real-time progress, summaries, and completion status
- [ ] **Phase 43: Agent Dashboard** - View, create, and manage background polling and automation replay agents from the dashboard
- [ ] **Phase 44: DOM Cloning Stream** - Real-time DOM reconstruction on dashboard via initial snapshot plus incremental MutationObserver diffs

## Phase Details

### Phase 40: WebSocket Infrastructure
**Goal**: Extension and dashboard can communicate bidirectionally through a WebSocket relay server deployed on fly.io
**Depends on**: Nothing (first phase)
**Requirements**: SERV-01, SERV-02, SERV-03, SERV-04, SERV-05, SERV-06, SERV-07
**Success Criteria** (what must be TRUE):
  1. Extension service worker connects to fly.io server via WebSocket and stays connected across idle periods (20s keepalive surviving Chrome's 30s timeout)
  2. Dashboard web page connects to the same server and receives messages sent by the extension in real time
  3. Connection status indicator on the dashboard accurately reflects connected, disconnected, and reconnecting states
  4. Server is deployed on fly.io with auto-TLS, SQLite on a persistent volume, and serves both static files and WebSocket from a single app
**Plans**: 3 plans

Plans:
- [ ] 40-01-PLAN.md — WS relay server core, deployment config, SSE removal, dead code cleanup
- [ ] 40-02-PLAN.md — Extension WS client with keepalive, reconnection, and badge icon
- [ ] 40-03-PLAN.md — Dashboard SSE-to-WS rewrite with connection status indicator

### Phase 41: QR Pairing & Showcase Site
**Goal**: Users can pair their browser to the dashboard by scanning a QR code, and the dashboard is accessible as a public showcase site
**Depends on**: Phase 40
**Requirements**: PAIR-01, PAIR-02, PAIR-03, PAIR-04, PAIR-05, PAIR-06, SITE-01, SITE-02, SITE-03
**Success Criteria** (what must be TRUE):
  1. Extension displays a QR code in the popup that encodes a one-time pairing token (not the raw hash key) with 60-second expiry
  2. Dashboard scans the QR code via device camera and pairs to the extension within seconds
  3. User can manually paste their hash key as a fallback when camera is unavailable
  4. Dashboard shows paired status with the ability to unpair, and sessions expire after a configurable timeout requiring re-pairing
  5. Public landing page at the root URL explains FSB capabilities, and the dashboard works on mobile browsers
**Plans**: 3 plans

Plans:
- [ ] 41-01-PLAN.md — Server pairing token infrastructure (DB schema, API routes, root URL fix)
- [ ] 41-02-PLAN.md — Extension QR code generation with countdown timer in control panel
- [ ] 41-03-PLAN.md — Dashboard QR scanning, session management, landing page CTA

### Phase 42: Remote Task Control
**Goal**: Users can create and monitor automation tasks from the dashboard while watching FSB execute them in real time
**Depends on**: Phase 41
**Requirements**: TASK-01, TASK-02, TASK-03, TASK-04
**Success Criteria** (what must be TRUE):
  1. User can type a natural language task on the dashboard and FSB begins executing it in the paired browser
  2. Dashboard displays real-time progress percentage, current phase, and ETA as the task runs
  3. Dashboard shows AI-generated action summaries describing what FSB is doing at each step
  4. User can see task completion status and results on the dashboard when execution finishes
**Plans**: 2 plans

Plans:
- [ ] 42-01-PLAN.md — Extension WS wiring: task receipt, progress broadcasting, completion notifications
- [ ] 42-02-PLAN.md — Dashboard UI: task input, progress display, state machine, WS message handlers

### Phase 43: Agent Dashboard
**Goal**: Users can view, create, and control background polling agents and automation replay agents entirely from the dashboard
**Depends on**: Phase 42
**Requirements**: AGNT-01, AGNT-02, AGNT-03, AGNT-04, AGNT-05
**Success Criteria** (what must be TRUE):
  1. Dashboard displays all background agents with their current status, schedule, and run history
  2. Dashboard shows replay cost savings (tokens saved vs full AI execution) and success rates per agent
  3. User can create new background polling agents and automation replay agents from the dashboard
  4. User can start, stop, and delete agents from the dashboard and see the state change reflected immediately
**Plans**: TBD

Plans:
- [ ] 43-01: TBD
- [ ] 43-02: TBD

### Phase 44: DOM Cloning Stream
**Goal**: Dashboard shows a live structural reconstruction of the page FSB is automating, updated in real time
**Depends on**: Phase 42
**Requirements**: DOM-01, DOM-02, DOM-03, DOM-04, DOM-05, DOM-06
**Success Criteria** (what must be TRUE):
  1. When a task starts, the dashboard renders a full page view reconstructed from a serialized DOM snapshot (scripts stripped, URLs absolute)
  2. As FSB interacts with the page, DOM mutations stream to the dashboard and the view updates incrementally in real time
  3. Images and resources in the cloned view load directly from the original CDN URLs (no server proxying)
  4. FSB's orange glow highlighting and progress overlay are visible in the cloned DOM view on the dashboard
  5. DOM streaming activates only when the dashboard is actively viewing -- zero performance overhead on the extension otherwise
**Plans**: TBD

Plans:
- [ ] 44-01: TBD
- [ ] 44-02: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 40 -> 41 -> 42 -> 43 -> 44

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 40. WebSocket Infrastructure | 3/3 | Complete    | 2026-03-17 |
| 41. QR Pairing & Showcase Site | 3/3 | Complete    | 2026-03-17 |
| 42. Remote Task Control | 1/2 | In Progress|  |
| 43. Agent Dashboard | 0/? | Not started | - |
| 44. DOM Cloning Stream | 0/? | Not started | - |

### Phase 45: MCP Server Interface

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 44
**Plans:** 1/2 plans executed

Plans:
- [ ] TBD (run /gsd:plan-phase 45 to break down)
