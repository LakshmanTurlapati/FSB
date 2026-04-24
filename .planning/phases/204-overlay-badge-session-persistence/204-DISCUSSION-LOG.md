# Phase 204: Overlay Badge & Session Persistence - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md - this log preserves the alternatives considered.

**Date:** 2026-04-23T22:42:00-0500
**Phase:** 204-overlay-badge-session-persistence
**Areas discussed:** on-page badge presentation, mirrored preview parity, reinjection/navigation persistence, stale cleanup timing

---

## On-Page Badge Presentation

| Option | Description | Selected |
|--------|-------------|----------|
| Header badge | Add a compact trusted-client badge in the overlay header beside existing FSB branding | ✓ |
| Progress-pill replacement | Reuse the existing progress pill for client identity instead of a dedicated badge | |
| Let the agent decide | Leave badge placement fully open for planning | |

**User's choice:** [auto] Header badge
**Notes:** Keep the badge compact, text-only, and subordinate to the main task/progress copy.

---

## Mirrored Preview Parity

| Option | Description | Selected |
|--------|-------------|----------|
| Mirror badge and lifecycle | Extend DOM-stream/dashboard preview payload so remote observers see the same client label and lifecycle state | ✓ |
| Page-only badge | Show the badge only on the live page and keep preview text-only | |
| Let the agent decide | Leave preview identity handling open for planning | |

**User's choice:** [auto] Mirror badge and lifecycle
**Notes:** The dashboard preview already renders glow/progress, so the right move is to upgrade that path instead of creating a second mirror channel.

---

## Reinjection And Navigation Persistence

| Option | Description | Selected |
|--------|-------------|----------|
| Persist and replay | Persist client-owned visual sessions in background storage and replay them when the owned tab becomes ready again | ✓ |
| Caller must restart | Require the MCP client to call `start_visual_session` again after navigation/reinjection | |
| Let the agent decide | Leave persistence strategy open for planning | |

**User's choice:** [auto] Persist and replay
**Notes:** Same-tab navigation, BF-cache restore, and content-script reinjection should not force the MCP client to re-announce ownership if the session is still active.

---

## Final And Stale Cleanup

| Option | Description | Selected |
|--------|-------------|----------|
| Preserve existing timers | Keep the current 60s degrade / 120s orphan cleanup windows and preserve the original final-clear deadline on replay | ✓ |
| Reset timers on replay | Treat reinjection like a fresh overlay session and restart the final/degrade timers every time | |
| Let the agent decide | Leave stale cleanup timing open for planning | |

**User's choice:** [auto] Preserve existing timers
**Notes:** Replaying the same session should not extend stale glow lifetime. If the clear window already expired, the replay path should clear instead of resurrecting the overlay.

---

## the agent's Discretion

- Exact CSS/spacing treatment for the live overlay badge and the dashboard preview badge.
- Exact storage key names and helper shapes for persisted visual-session state and remaining clear deadlines.
- Whether replay is driven from `contentScriptReady`, port readiness, startup restore, or a shared helper serving all of them.

## Deferred Ideas

- Richer icons and per-client accent colors belong to future `MCPP-02` scope.
- Phase 205 owns the broader validation/docs closeout.
