# Phase 204: Overlay Badge & Session Persistence - Context

**Gathered:** 2026-04-23T22:42:00-0500
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 204 makes the trusted MCP client identity visible on the live page overlay and mirrored preview surfaces, then keeps that same client-owned visual session coherent through content-script reinjection, same-tab navigation, and stale-session cleanup.

This phase does not change the Phase 203 public MCP start/progress/end contract, add arbitrary branding beyond the approved allowlist, or write the final validation/docs package. Phase 205 owns the broader regression/documentation closeout.

</domain>

<decisions>
## Implementation Decisions

### On-Page Badge Presentation
- **D-01:** [auto] The page overlay should show a compact text badge for the canonical `clientLabel` in the existing header row, alongside the current FSB branding, rather than replacing the task or progress copy.
- **D-02:** [auto] Badge styling stays neutral and trusted for this milestone: text-only, no caller HTML, no freeform logos, and no per-client accent-color customization.
- **D-03:** [auto] The same badge remains visible during running, degraded/reconnecting, and frozen final states until the session actually clears, so the viewer can still tell which MCP client owns the visible surface.

### Mirrored Preview Parity
- **D-04:** [auto] DOM-stream overlay payloads must carry `clientLabel`, `sessionToken`, `version`, and `lifecycle` in addition to progress text so mirrored surfaces can render source identity and suppress stale updates correctly.
- **D-05:** [auto] The Angular dashboard preview should render the same trusted client badge near its existing overlay/progress treatment instead of collapsing client identity into plain status text only.
- **D-06:** [auto] Frozen/disconnected preview states should preserve the last trusted client badge until cleanup so remote observers see the same owner identity as the live page.

### Persistence And Replay
- **D-07:** [auto] Client-owned visual-session state should be persisted in `chrome.storage.session` from background, not only in memory, so reinjection, BF-cache restore, same-tab navigation, and service-worker wake can replay the active session without asking the MCP client to call start again.
- **D-08:** [auto] When the owned tab's main-frame content script becomes ready again, background should replay the latest running or final overlay state for that same `sessionToken` onto the tab immediately.
- **D-09:** [auto] Same-tab navigation across normal webpages keeps the same session ownership. If the tab is temporarily unavailable or not yet ready, the session may survive only within the existing stale-session window and should replay once the page is ready again.
- **D-10:** [auto] Final-state replay must preserve the original clear deadline instead of restarting a fresh freeze on every reinjection. If the freeze window already expired while the page was unavailable, background should clear instead of re-showing stale glow.

### Stale Cleanup And Ownership Safety
- **D-11:** [auto] The existing 60s watchdog degrade and 120s orphan cleanup remain the canonical stale-session timing for client-owned visual sessions too; Phase 204 should not invent a second badge-specific timeout model.
- **D-12:** [auto] Background cleanup must remove persisted client-owned session records and pending finalization metadata when a session ends, times out, loses tab ownership, or is replaced, so replay cannot resurrect cleared glow.
- **D-13:** [auto] Replay, degradation, and cleanup stay token-scoped: a stale or replaced persisted session must never overwrite or clear a newer visual-session owner on the same tab.

### the agent's Discretion
- Exact badge copy layout and CSS details on the live overlay and dashboard preview, as long as the badge stays compact, trusted, and visually subordinate to the task text.
- Exact storage key/helper names for persisted client-owned visual sessions and final-clear deadlines.
- Whether replay is triggered from `contentScriptReady`, main-frame port readiness, startup restore, or a small shared helper that serves all of them, as long as same-tab reinjection/navigation works reliably.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase Scope And Requirements
- `.planning/ROADMAP.md` - Phase 204 goal, dependency on Phase 203, and success criteria for badge rendering, preview parity, persistence, and cleanup.
- `.planning/REQUIREMENTS.md` - `LIFE-04`, `BADGE-02`, `BADGE-03`, and `BADGE-04`.
- `.planning/PROJECT.md` - Milestone goal and trusted-client badge expectations.
- `.planning/STATE.md` - Current focus and handoff from completed Phase 203 work.

### Prior Phase Constraints
- `.planning/phases/203-mcp-visual-session-contract/203-CONTEXT.md` - Locked contract decisions for `start_visual_session`, token-aware progress/finalization, allowlist identity, and stale-token suppression.
- `.planning/phases/199-mcp-tool-routing-contract/199-CONTEXT.md` - Restricted-page recovery posture and direct MCP routing constraints that Phase 204 must preserve.
- `.planning/phases/200-doctor-status-watch-recovery-messaging/200-CONTEXT.md` - Existing recovery/degraded-state wording posture and diagnostics consistency expectations.

### Live Overlay And Session Runtime
- `utils/mcp-visual-session.js` - Canonical client allowlist, session manager, and visual-session status builders.
- `utils/overlay-state.js` - Overlay normalization plus `sessionToken` / `version` stale-message guards.
- `background.js` - `sendSessionStatus()`, content readiness tracking, tab lifecycle hooks, and current MCP visual-session finalize/clear behavior.
- `content/messaging.js` - `sessionStatus` consumption, watchdog degrade/orphan cleanup, and overlay lifecycle handling.
- `content/visual-feedback.js` - Overlay Shadow DOM, header layout, and final-freeze rendering.
- `content/lifecycle.js` - Content-script reconnect/BF-cache behavior and main-frame readiness signals.

### Mirrored Preview Surface
- `content/dom-stream.js` - Overlay broadcast payload currently sent to the dashboard stream.
- `ws/ws-client.js` - Relay transport contract for `ext:dom-overlay`.
- `showcase/angular/src/app/pages/dashboard/dashboard-page.component.ts` - Dashboard preview overlay/glow rendering and frozen-preview handling.
- `showcase/js/dashboard-runtime-state.js` - Preview runtime-state copy and frozen/disconnected surface conventions.

### Tests To Extend
- `tests/test-overlay-state.js` - Overlay normalization and stale-state suppression coverage.
- `tests/mcp-visual-session-contract.test.js` - Visual-session lifecycle contract harness from Phase 203.
- `tests/mcp-bridge-client-lifecycle.test.js` - Bridge/client lifecycle routing harness patterns.
- `tests/dashboard-runtime-state.test.js` - Preview runtime-state/frozen-surface assertions.
- `tests/mcp-recovery-messaging.test.js` - Recovery/degraded-message coverage patterns near cleanup behavior.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `utils/overlay-state.js` already preserves `clientLabel`, `sessionToken`, and `version`, so Phase 204 can render and mirror that data without reshaping the public MCP contract.
- `utils/mcp-visual-session.js` already tracks per-tab ownership, `lastUpdateAt`, and final-clear delay constants, which can be extended with persistence/replay helpers.
- `background.js` already owns the canonical `sendSessionStatus()` path plus tab/content readiness tracking; replay should reuse that pipeline instead of inventing a second content-script message.
- `content/messaging.js` already centralizes live/final/degraded/cleared overlay handling with the watchdog timers; persistence work should feed this path better state rather than duplicate cleanup logic elsewhere.
- `content/visual-feedback.js` already has a clean overlay header inside Shadow DOM, making it the natural place to add a compact badge without exposing host-page CSS interference.
- `content/dom-stream.js` and `showcase/angular/src/app/pages/dashboard/dashboard-page.component.ts` already mirror progress/glow state to the dashboard preview; they need richer identity/lifecycle payload, not a new preview channel.

### Established Patterns
- Recoverable runtime state that must survive MV3 service-worker churn is commonly persisted in `chrome.storage.session`.
- Main-frame readiness is tracked through both persistent ports and `contentScriptReady`, so replay can hook into the same lifecycle instead of polling.
- Preview message freshness is already keyed by `streamSessionId` / `snapshotId`, while page overlay freshness is keyed by `sessionToken` / `version`; Phase 204 should combine rather than replace those guards.
- Focused regression coverage continues to use plain Node assertion scripts and VM harnesses rather than introducing a new test framework.

### Integration Points
- `background.js` startup restore, `contentScriptReady`, port-ready handling, `webNavigation` events, and tab removal are the main points for persisting/replaying/clearing client-owned visual sessions.
- `content/visual-feedback.js` and `content/messaging.js` are the on-page integration points for rendering the badge and keeping final/degraded states visually coherent.
- `content/dom-stream.js` -> `background.js` -> `ws/ws-client.js` -> `showcase/angular/.../dashboard-page.component.ts` is the mirrored preview path that must preserve badge identity and lifecycle state end to end.

</code_context>

<specifics>
## Specific Ideas

- The user explicitly wants the "little animation" / glow to start from an MCP call and stop when the end MCP call happens, with a small badge showing which trusted client started it.
- The badge source must come from the fixed allowlist introduced in Phase 203, with names like Claude, Codex, ChatGPT, Perplexity, Windsurf, Cursor, Antigravity, OpenCode, OpenClaw, Grok, and Gemini.
- No custom logos, arbitrary badge text, or per-client art direction were requested for this phase; the key ask is visible identity plus reliable cleanup.

</specifics>

<deferred>
## Deferred Ideas

- Richer badge visuals such as icons or per-client accent colors remain future `MCPP-02` work.
- Phase 205 still owns the final route/UI regression sweep and operator-facing MCP usage docs.

</deferred>

---

*Phase: 204-overlay-badge-session-persistence*
*Context gathered: 2026-04-23*
