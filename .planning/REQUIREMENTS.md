# Requirements: FSB v0.9.36 MCP Visual Lifecycle & Client Identity

**Defined:** 2026-04-23
**Core Value:** Reliable single-attempt execution -- the AI decides correctly, the mechanics execute precisely

## v1 Requirements

Requirements for letting MCP clients explicitly control the visible browser automation feedback surface without relying on FSB's built-in autopilot loop.

### Visual Session Contract

- [ ] **LIFE-01**: User can call an MCP visual-session start tool on the active normal webpage and show the viewport glow plus progress overlay without invoking `run_task`.
- [ ] **LIFE-02**: An active MCP visual session can receive progress/detail updates that change the overlay text while preserving the same session ownership and active-tab target.
- [ ] **LIFE-03**: An MCP visual session can end through success, partial, failure, cancel, or explicit end calls and the glow/overlay clears predictably instead of lingering.
- [ ] **LIFE-04**: If the MCP client disconnects or forgets to end the session, watchdog/timeout handling degrades or clears the visual state safely so stale glow is not left behind.

### Client Identity

- [ ] **BADGE-01**: MCP visual-session start accepts only an approved client label from a fixed allowlist (for example Claude, Codex, ChatGPT, Perplexity, Windsurf, Cursor, Antigravity, OpenCode, OpenClaw, Grok, Gemini) and rejects arbitrary badge text.
- [ ] **BADGE-02**: The on-page progress overlay displays a compact badge with the approved MCP client label for the active visual session.
- [ ] **BADGE-03**: Dashboard and DOM-stream preview surfaces reflect the same client label and lifecycle state so remote observers see the same source identity as the page overlay.
- [ ] **BADGE-04**: Client identity persists across content-script reinjection and same-session navigation on the active tab until the visual session ends or times out.

### Validation

- [ ] **VALID-01**: Automated MCP routing tests cover start/progress/end flows, allowlist enforcement, and idempotent cleanup behavior.
- [ ] **VALID-02**: Overlay-state and UI tests cover badge rendering, final-state freeze, watchdog degradation, and stale-message suppression for client-driven sessions.
- [ ] **VALID-03**: MCP docs explain the visual-session start/progress/end contract and clarify when callers should use it instead of FSB autopilot `run_task`.

## v2 Requirements

Deferred to future releases.

### Advanced MCP Presence

- **MCPP-01**: FSB derives client identity automatically from trusted MCP handshake metadata instead of requiring the caller to send an allowlisted label every time.
- **MCPP-02**: Approved MCP clients can opt into richer badge presentation such as icons or per-client accent colors.
- **MCPP-03**: Manual MCP browser tools can auto-wrap themselves in a visual session when the client opts in.
- **MCPP-04**: Multiple concurrent MCP visual sessions can be tracked safely across different tabs or windows.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Arbitrary freeform client names or logos in the overlay | The badge should stay trusted and spoof-resistant rather than rendering caller-supplied branding |
| Replacing `run_task` with a new MCP-owned planning engine | This milestone only exposes the visible automation lifecycle, not a second autopilot stack |
| Visual sessions on restricted/internal browser pages | Existing MCP restrictions still apply; this milestone targets normal webpage automation surfaces |
| Per-client analytics, billing, or long-term history | The immediate user need is visible start/end feedback and client identity, not reporting infrastructure |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| LIFE-01 | Phase 203 | Pending |
| LIFE-02 | Phase 203 | Pending |
| LIFE-03 | Phase 203 | Pending |
| BADGE-01 | Phase 203 | Pending |
| LIFE-04 | Phase 204 | Pending |
| BADGE-02 | Phase 204 | Pending |
| BADGE-03 | Phase 204 | Pending |
| BADGE-04 | Phase 204 | Pending |
| VALID-01 | Phase 205 | Pending |
| VALID-02 | Phase 205 | Pending |
| VALID-03 | Phase 205 | Pending |

**Coverage:**
- v1 requirements: 11 total
- Mapped to phases: 11
- Unmapped: 0

---
*Requirements defined: 2026-04-23*
*Last updated: 2026-04-23 after initial milestone definition*
