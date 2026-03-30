# Requirements: FSB v0.9.9.1 Phantom Stream

**Defined:** 2026-03-29
**Core Value:** Reliable single-attempt execution -- the AI decides correctly, the mechanics execute precisely

## v0.9.9.1 Requirements

Requirements for making the dashboard DOM stream fully functional with high fidelity and remote control.

### Connection

- [x] **CONN-01**: Dashboard DOM stream starts automatically when WebSocket connects (no task submission needed)
- [x] **CONN-02**: Stream stays active between tasks showing live browser state continuously
- [x] **CONN-03**: Stream auto-recovers after WebSocket disconnect with a fresh snapshot on reconnect
- [x] **CONN-04**: Visual status badge shows stream health (connected/buffering/disconnected) in the preview container

### Layout

- [x] **LAYOUT-01**: User can maximize preview to fill the full dashboard content area
- [x] **LAYOUT-02**: User can minimize preview back to inline thumbnail size
- [x] **LAYOUT-03**: Preview container reshapes dynamically to match actual browser viewport dimensions (not fixed 16:9)
- [x] **LAYOUT-04**: User can enter picture-in-picture mode with a floating draggable preview
- [x] **LAYOUT-05**: User can enter fullscreen preview mode (Escape to exit)

### Fidelity

- [x] **FIDELITY-01**: Alert dialogs, confirm boxes, and modal overlays visible in the page appear in the cloned preview
- [ ] **FIDELITY-02**: CSS transitions and keyframe animations are mirrored in the cloned preview
- [ ] **FIDELITY-03**: Mutation batching is synced to requestAnimationFrame for smooth display-matched updates
- [ ] **FIDELITY-04**: Snapshot captures inline computed styles for pixel-accurate clone rendering

### Control

- [ ] **CONTROL-01**: User can click elements in the preview to trigger clicks on the corresponding element in the real browser
- [ ] **CONTROL-02**: User can type in preview input fields to type in the corresponding field in the real browser
- [ ] **CONTROL-03**: User can scroll the preview to scroll the real browser page
- [ ] **CONTROL-04**: User can stop a running automation task from the preview overlay

## Future Requirements

### Advanced Control

- **CONTROL-05**: Right-click context menu forwarding
- **CONTROL-06**: Keyboard shortcut passthrough (Ctrl+C, Ctrl+V, etc.)
- **CONTROL-07**: Multi-touch gesture forwarding

### Advanced Fidelity

- **FIDELITY-05**: Canvas element content mirroring (toDataURL snapshots)
- **FIDELITY-06**: Video element poster frame capture
- **FIDELITY-07**: Shadow DOM content serialization

## Out of Scope

| Feature | Reason |
|---------|--------|
| Pixel-level screenshot streaming | DOM cloning approach is lower bandwidth; pixel capture would require WebRTC or similar |
| Audio forwarding | No audio capture API in content scripts |
| WebGL/3D content mirroring | Canvas-based rendering not serializable via DOM cloning |
| Multi-tab simultaneous streaming | Single tab stream keeps complexity manageable for v0.9.9.1 |
| Mobile responsive preview | Dashboard is desktop-only for now |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| CONN-01 | Phase 122 | Complete |
| CONN-02 | Phase 122 | Complete |
| CONN-03 | Phase 122 | Complete |
| CONN-04 | Phase 122 | Complete |
| LAYOUT-01 | Phase 123 | Complete |
| LAYOUT-02 | Phase 123 | Complete |
| LAYOUT-03 | Phase 123 | Complete |
| LAYOUT-04 | Phase 123 | Complete |
| LAYOUT-05 | Phase 123 | Complete |
| FIDELITY-01 | Phase 124 | Complete |
| FIDELITY-02 | Phase 124 | Pending |
| FIDELITY-03 | Phase 124 | Pending |
| FIDELITY-04 | Phase 124 | Pending |
| CONTROL-01 | Phase 125 | Pending |
| CONTROL-02 | Phase 125 | Pending |
| CONTROL-03 | Phase 125 | Pending |
| CONTROL-04 | Phase 125 | Pending |

**Coverage:**
- v0.9.9.1 requirements: 17 total
- Mapped to phases: 17
- Unmapped: 0

---
*Requirements defined: 2026-03-29*
*Traceability updated: 2026-03-29*
