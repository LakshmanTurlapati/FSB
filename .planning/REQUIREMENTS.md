# Requirements: FSB v0.9.6 Agents & Remote Control

**Defined:** 2026-03-17
**Core Value:** Reliable single-attempt execution — the AI decides correctly, the mechanics execute precisely

## v0.9.6 Requirements

Requirements for this milestone. Each maps to roadmap phases.

### Server Infrastructure

- [x] **SERV-01**: Server upgrades from SSE to WebSocket relay with room-based routing by hashKey
- [x] **SERV-02**: Extension service worker maintains WebSocket connection with 20s keepalive ping
- [ ] **SERV-03**: Dashboard establishes WebSocket connection and receives real-time events
- [ ] **SERV-04**: Connection status indicator shows connected/disconnected/reconnecting on dashboard
- [x] **SERV-05**: Single fly.io app serves dashboard static files + WebSocket relay + REST API
- [x] **SERV-06**: SQLite database persists via fly.io volume mount
- [x] **SERV-07**: Auto-TLS and production deployment configuration on fly.io

### QR Pairing

- [ ] **PAIR-01**: Extension generates unique one-time pairing token (not raw hash key) with 60s TTL
- [ ] **PAIR-02**: Extension displays pairing token as QR code in popup/sidepanel
- [ ] **PAIR-03**: Dashboard scans QR code via device camera to pair with extension
- [ ] **PAIR-04**: User can manually paste hash key as fallback when camera is unavailable
- [ ] **PAIR-05**: Dashboard shows paired status and allows unpairing/session revocation
- [ ] **PAIR-06**: Pairing session expires after configurable timeout with re-pair flow

### Remote Task Control

- [ ] **TASK-01**: User can type a task on dashboard and FSB executes it in the user's browser
- [ ] **TASK-02**: Dashboard shows real-time progress (%, phase, ETA) during task execution
- [ ] **TASK-03**: Dashboard displays AI-generated action summaries as task executes
- [ ] **TASK-04**: User can see task completion status and results on dashboard

### Agent Management

- [ ] **AGNT-01**: Dashboard displays all background agents with status, schedule, and run history
- [ ] **AGNT-02**: Dashboard shows replay cost savings and success rates per agent
- [ ] **AGNT-03**: User can create new background polling agents from dashboard
- [ ] **AGNT-04**: User can create new automation replay agents from dashboard
- [ ] **AGNT-05**: User can start/stop/delete agents from dashboard

### DOM Cloning Stream

- [ ] **DOM-01**: Content script serializes full DOM snapshot on task start (scripts stripped, URLs absolute)
- [ ] **DOM-02**: MutationObserver captures incremental DOM diffs and streams via WebSocket
- [ ] **DOM-03**: Dashboard reconstructs live page view in sandboxed iframe from snapshot + diffs
- [ ] **DOM-04**: Images and resources in cloned DOM load directly from original CDN URLs
- [ ] **DOM-05**: Orange glow highlighting and progress overlay visible in cloned DOM view
- [ ] **DOM-06**: DOM stream activates only when dashboard is actively viewing (zero overhead otherwise)

### Showcase Site

- [ ] **SITE-01**: Public landing page explains FSB and showcases capabilities
- [ ] **SITE-02**: Dashboard UI accessible without login (QR pairing is the auth)
- [ ] **SITE-03**: Responsive design works on mobile browsers

## Future Requirements

Deferred to post-v0.9.6. Tracked but not in current roadmap.

### Templates & Workflows

- **TMPL-01**: Pre-configured task templates launchable with one click from dashboard
- **TMPL-02**: Selective DOM region streaming (optimization over full cloning)

### Advanced Agents

- **AADV-01**: CAPTCHA detection notifies user via dashboard, pauses agent, resumes after manual solve
- **AADV-02**: Multi-user shared dashboards with access control

## Out of Scope

| Feature | Reason |
|---------|--------|
| Video/screenshot streaming | Bandwidth-heavy (1-5 Mbps vs 1-50 KB/s for DOM deltas), PROJECT.md explicitly prohibits |
| Headless server-side execution | Server is relay only, user's browser must stay active |
| User account system / login | Hash key auth is simpler and anonymous, no PII/GDPR obligations |
| Always-on WebSocket | Battery drain, fights MV3 lifecycle — connect only when dashboard open or agents running |
| Proxy/tunnel for page resources | Images load from original CDN, no server bandwidth cost |
| Mobile native app | Dashboard is responsive web, PWA-installable |
| Full rrweb integration | 50KB+ bundle, alpha for 3 years, wrong abstraction — custom MutationObserver approach |
| Socket.IO | 50KB overhead, unnecessary for typed JSON envelope protocol |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| SERV-01 | Phase 40 | Complete |
| SERV-02 | Phase 40 | Complete |
| SERV-03 | Phase 40 | Pending |
| SERV-04 | Phase 40 | Pending |
| SERV-05 | Phase 40 | Complete |
| SERV-06 | Phase 40 | Complete |
| SERV-07 | Phase 40 | Complete |
| PAIR-01 | Phase 41 | Pending |
| PAIR-02 | Phase 41 | Pending |
| PAIR-03 | Phase 41 | Pending |
| PAIR-04 | Phase 41 | Pending |
| PAIR-05 | Phase 41 | Pending |
| PAIR-06 | Phase 41 | Pending |
| TASK-01 | Phase 42 | Pending |
| TASK-02 | Phase 42 | Pending |
| TASK-03 | Phase 42 | Pending |
| TASK-04 | Phase 42 | Pending |
| AGNT-01 | Phase 43 | Pending |
| AGNT-02 | Phase 43 | Pending |
| AGNT-03 | Phase 43 | Pending |
| AGNT-04 | Phase 43 | Pending |
| AGNT-05 | Phase 43 | Pending |
| DOM-01 | Phase 44 | Pending |
| DOM-02 | Phase 44 | Pending |
| DOM-03 | Phase 44 | Pending |
| DOM-04 | Phase 44 | Pending |
| DOM-05 | Phase 44 | Pending |
| DOM-06 | Phase 44 | Pending |
| SITE-01 | Phase 41 | Pending |
| SITE-02 | Phase 41 | Pending |
| SITE-03 | Phase 41 | Pending |

**Coverage:**
- v0.9.6 requirements: 31 total
- Mapped to phases: 31
- Unmapped: 0

---
*Requirements defined: 2026-03-17*
*Last updated: 2026-03-17 after roadmap creation*
