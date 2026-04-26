# Requirements: FSB v0.9.45 Dashboard Control & Stream Reliability

**Defined:** 2026-04-24
**Core Value:** Reliable single-attempt execution -- the AI decides correctly, the mechanics execute precisely

## v1 Requirements

Requirements for this milestone. Each maps to roadmap phases.

### Remote Control

- [ ] **RC-01**: User can click elements in the browser tab from the dashboard preview via remote control
- [ ] **RC-02**: User can type keyboard input into the browser tab from the dashboard
- [ ] **RC-03**: User can scroll the browser tab from the dashboard preview
- [ ] **RC-04**: Remote control has explicit start/stop lifecycle with state tracking between dashboard and extension

### QR Pairing

- [ ] **QR-01**: User can generate a QR code from the extension options page that the showcase dashboard can scan to pair
- [ ] **QR-02**: QR pairing shows a 60-second countdown with visual urgency indicator before token expiry
- [ ] **QR-03**: User can cancel an active pairing attempt, hiding the overlay and resetting the button state

### Stream Hardening

- [ ] **STRM-01**: Mutation queue has a size watchdog that force-flushes when pending mutations exceed a threshold
- [ ] **STRM-02**: Large DOM truncation uses a pre-built element map instead of O(n^2) per-element querySelector lookups
- [ ] **STRM-03**: Stale mutation counter resets after valid mutation batches to prevent premature resync
- [ ] **STRM-04**: WebSocket client decompresses incoming LZString-compressed messages symmetrically with outgoing compression

### Diagnostics

- [ ] **DIAG-01**: Dialog relay errors are logged with diagnostic context instead of silently swallowed
- [ ] **DIAG-02**: DOM stream message delivery failures are logged with diagnostic context instead of silently discarded

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### MCP Follow-up (from v0.9.36)

- **MCP-01**: FSB derives trusted MCP client identity from connection or handshake metadata instead of requiring callers to send an allowlisted label each time
- **MCP-02**: Approved MCP clients can opt into auto-wrapping manual browser tools in a visual session when visible feedback is desired
- **MCP-03**: MCP visual sessions can be coordinated safely across multiple tabs or windows without badge/glow collisions

### Angular Migration (from v0.9.29)

- **DASH-08**: Dashboard session/auth, agent lifecycle management, and run-history views ported to Angular
- **DASH-11**: Task execution, live preview streaming, and remote-control state handling ported to Angular
- **MIGR-01**: Migration parity and regression checks in place

## Out of Scope

| Feature | Reason |
|---------|--------|
| Relay server rate limiting | Server-side hardening is separate from client-side fixes |
| Remote control multi-tab coordination | Single active tab is sufficient for v1 remote control |
| WebSocket reconnect retry backoff | Existing reconnect logic is adequate; focus is on message handling |
| Message ordering guarantees | Current ordering is sufficient; out-of-order is rare and non-critical |
| End-to-end encryption for relay | Security hardening is a separate milestone concern |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| RC-01 | Phase 209 | Pending |
| RC-02 | Phase 209 | Pending |
| RC-03 | Phase 209 | Pending |
| RC-04 | Phase 209 | Pending |
| QR-01 | Phase 210 | Pending |
| QR-02 | Phase 210 | Pending |
| QR-03 | Phase 210 | Pending |
| STRM-01 | Phase 211 | Pending |
| STRM-02 | Phase 211 | Pending |
| STRM-03 | Phase 211 | Pending |
| STRM-04 | Phase 211 | Pending |
| DIAG-01 | Phase 211 | Pending |
| DIAG-02 | Phase 211 | Pending |

**Coverage:**
- v1 requirements: 13 total
- Mapped to phases: 13
- Unmapped: 0

---
*Requirements defined: 2026-04-24*
*Last updated: 2026-04-25 after roadmap creation with full traceability*
