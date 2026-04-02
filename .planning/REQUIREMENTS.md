# Requirements: FSB v0.9.23 Dashboard Stream & Remote Control Reliability

**Defined:** 2026-04-02
**Core Value:** Reliable single-attempt execution -- the AI decides correctly, the mechanics execute precisely

## v0.9.23 Requirements

Requirements for making the website dashboard sync path reliable end-to-end across the dashboard, relay server, extension WebSocket client, background handlers, and DOM stream pipeline.

### Stream Lifecycle

- [ ] **STRM-01**: User sees the website dashboard preview start automatically after the dashboard connects and the extension has a streamable browser tab
- [ ] **STRM-02**: User sees the preview recover after relay reconnects, service worker restarts, or streaming-tab changes without getting stuck in loading or disconnected until a manual refresh
- [ ] **STRM-03**: User sees snapshot, mutation, scroll, overlay, and dialog updates applied without the dashboard silently freezing on stale page state

### Remote Control

- [ ] **CTRL-01**: User can click inside the dashboard preview and the corresponding point in the real browser receives the intended click
- [ ] **CTRL-02**: User can type and send modifier keys through the dashboard preview without the dashboard stealing focus or corrupting text input in the browser tab
- [ ] **CTRL-03**: User can scroll through the dashboard preview and the real browser scrolls in the same direction and target area
- [ ] **CTRL-04**: User can toggle remote control on and off repeatedly without debugger attach/detach conflicts leaving remote input broken

### Task Relay

- [ ] **RLY-01**: User can start a task from the website dashboard and either receive a clear immediate rejection reason or a running task state
- [ ] **RLY-02**: User sees progress updates reach the dashboard during execution with current action, phase, elapsed time, and percent when available
- [ ] **RLY-03**: User sees stop, success, and failure outcomes delivered exactly once with the correct final status and last-action context when available
- [ ] **RLY-04**: User who reconnects the website dashboard or the extension mid-task sees recovered task state instead of losing progress or completion context

### Diagnostics & Verification

- [ ] **VER-01**: Developers can inspect targeted diagnostics for dashboard WebSocket connectivity, relay direction, and per-message-type delivery when debugging stream or control failures
- [ ] **VER-02**: A documented end-to-end verification pass covers stream start, reconnect, remote click, remote typing, remote scroll, task progress, stop, and completion delivery

## Future Requirements

### Deferred from v0.9.23

- **CTRL-05**: User can perform remote drag, drop, or text-selection interactions through the website dashboard preview
- **VER-03**: Automated end-to-end regression harness validates dashboard sync flows without requiring manual browser walkthroughs

## Out of Scope

| Feature | Reason |
|---------|--------|
| Dashboard visual redesign or showcase replica work | This milestone targets functional reliability, not presentation changes |
| New non-dashboard extension UI polish | Out of scope unless directly required to fix dashboard transport behavior |
| Pixel or video streaming | FSB uses DOM-based preview; media streaming is a different architecture |
| Multi-user or multi-dashboard control arbitration | Current relay model assumes one user session, not collaborative control |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| STRM-01 | Phase 150 | Pending |
| STRM-02 | Phase 150 | Pending |
| VER-01 | Phase 150 | Pending |
| STRM-03 | Phase 151 | Pending |
| RLY-04 | Phase 151 | Pending |
| CTRL-01 | Phase 152 | Pending |
| CTRL-02 | Phase 152 | Pending |
| CTRL-03 | Phase 152 | Pending |
| CTRL-04 | Phase 152 | Pending |
| RLY-01 | Phase 153 | Pending |
| RLY-02 | Phase 153 | Pending |
| RLY-03 | Phase 153 | Pending |
| VER-02 | Phase 154 | Pending |

**Coverage:**
- v0.9.23 requirements: 13 total
- Mapped to phases: 13
- Unmapped: 0

---
*Requirements defined: 2026-04-02*
*Last updated: 2026-04-02 after milestone requirements definition*
