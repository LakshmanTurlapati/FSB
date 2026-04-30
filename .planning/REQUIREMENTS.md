# Requirements: FSB v0.9.45rc1 Sync Surface, Agent Sunset & Stream Reliability

**Defined:** 2026-04-28
**Core Value:** Reliable single-attempt execution -- the AI decides correctly, the mechanics execute precisely

## Milestone Goal

Refocus FSB on what it does best -- ship a dedicated Sync tab for remote control, gracefully retire background agents in favor of OpenClaw / Claude Routines, and harden the streaming pipeline the dashboard relies on.

## Already Validated (counted toward this milestone)

- **SYNC-VALID-01**: Dashboard click/key/scroll commands reach the active streaming tab via Chrome DevTools Protocol with lifecycle state broadcast through `ext:remote-control-state` -- Phase 209 (live UAT pending: 7 human_needed items)
- **SYNC-VALID-02**: QR code pairing restored -- `#btnPairDashboard` POSTs `/api/pair/generate`, renders QR with 60s server-driven countdown, regenerate-on-expiry affordance -- Phase 210

## v1 Requirements (in scope for v0.9.45rc1)

### Sync Tab (SYNC)

- [ ] **SYNC-01**: User can find a top-level "Sync" tab in the FSB control panel that consolidates QR pairing, hash key, server URL, and connection status into a single dedicated surface
- [ ] **SYNC-02**: User sees a live connection-status pill in the Sync tab that reflects current `ext:remote-control-state` (replay-on-attach via `getRemoteControlState` runtime action; live updates via `remoteControlStateChanged` runtime push)
- [ ] **SYNC-03**: Showcase home and dashboard surfaces reference the new Sync tab in their copy and pairing instructions ("Open the Sync tab in FSB")

### Background Agents Sunset (AGENTS)

- [ ] **AGENTS-01**: User sees a playful "we're not reinventing this wheel" deprecation card replacing the Background Agents tab body, naming OpenClaw and Claude Routines as recommended successors with link-out and effective version
- [ ] **AGENTS-02**: Agent-only code paths are commented out (not deleted) across `agents/*.js`, `background.js` agent surfaces, `ws/ws-client.js` agent dispatch, MCP agent tools, popup/sidepanel slash commands, and `ui/options.js` agent UI controllers, each annotated `// DEPRECATED v0.9.45rc1: superseded by OpenClaw / Claude Routines -- see PROJECT.md.`; shared utilities preserved untouched
- [ ] **AGENTS-03**: On extension update from a prior version that had agents, user sees a one-time `fsb_sunset_notice` card listing the names of their previously created agents with a copy-to-clipboard export (NAMES ONLY, no task text -- avoid leaking credentials)
- [ ] **AGENTS-04**: Showcase home page (Background Agents feature card) and dashboard surfaces (vanilla `dashboard.html` + Angular `dashboard-page.component.html/ts`) mirror the agents-sunset messaging consistently; `ext:remote-control-state` and `_lz` decompression paths preserved on the showcase side
- [ ] **AGENTS-05**: `chrome.storage.local['bgAgents']` is preserved (not deleted); `chrome.alarms` `fsb_agent_*` entries are NOT proactively cleaned (accepted risk -- see Future Requirements)
- [ ] **AGENTS-06**: The shared `chrome.alarms.onAlarm` listener in `background.js` retains its `MCP_RECONNECT_ALARM` early-return path; only the agent branch is commented out

### DOM Streaming Hardening (STREAM)

- [x] **STREAM-01**: DOM streaming pipeline includes a two-tier watchdog -- `chrome.alarms`-backed in the service worker (survives SW idle eviction; same pattern as `ws/mcp-bridge-client.js:205`), `setTimeout` + monotonic `lastDrainTs` counter in the content script (5s stuck threshold) -- that detects stuck mutation queues and forces a flush
- [x] **STREAM-02**: Stale-mutation counter resets on successful flush (`flushMutations()` draining the queue); counter value is surfaced in a NEW `staleFlushCount` field on `ext:stream-state` (the existing `ext:dom-mutations` payload shape MUST NOT change)
- [x] **STREAM-03**: Large-DOM snapshot generation completes in under 200ms on a 5MB / ~50k-node fixture; algorithm uses a single `TreeWalker` pass with cached `getBoundingClientRect` results into a `Map<nid, top>` before any clone mutation
- [x] **STREAM-04**: DOM truncation operates at the node level (not byte level); the last included subtree is complete; emits a `truncated: true, missingDescendants: N` sentinel; cap is 80% of relay's per-message limit

### WebSocket Compression (WS)

- [x] **WS-01**: WebSocket inbound handler in `ws/ws-client.js:515-522` decompresses `_lz` envelope frames using `LZString.decompressFromBase64`, mirroring the dashboard decoder at `showcase/js/dashboard.js:3517-3528`; envelope is self-identifying per-frame (`{_lz: true, d: <base64>}`); plain JSON falls through unchanged
- [x] **WS-02**: When `LZString` is unavailable or decompression returns null, the failure is recorded via `recordFSBTransportFailure('decompress-failed' | 'decompress-unavailable', ...)` instead of silently dropping the frame
- [x] **WS-03**: The `_lz` envelope contract is documented inline at `ws/ws-client.js:580` (outbound site) so future contributors understand the round-trip shape

### Diagnostic Logging (LOG)

- [x] **LOG-01**: Silent `.catch(() => {})` calls in dialog relay and message-delivery paths are replaced with diagnostic logging using layered prefixes (`[FSB DLG]`, `[FSB BG]`, `[FSB WS]`, `[FSB DOM]`, `[FSB SYNC]`); recoverable warnings stay recoverable (no implicit re-throw)
- [x] **LOG-02**: Hot-path diagnostic logging is rate-limited per error category (one `console.warn` per 10s with a counter-rollup summary at the rate-limit boundary) and routed through a `redactForLog` helper that logs origin only (not full URL), length+presence only (not text content), status code only (not response body)
- [x] **LOG-03**: Benign SPA-navigation `.catch(() => {})` (e.g. `content/lifecycle.js:462,472,480`) downgrade to `automationLogger.debug` rather than `console.warn` to avoid console spam during normal page reloads
- [x] **LOG-04**: Diagnostic events are stored in a `chrome.storage.local` ring buffer (last 100 entries) with an "Export diagnostics" affordance accessible from the Sync tab

### MCP Installer Expansion Regression Fixes (FIX)

These requirements close regressions introduced by the in-flight 21-platform installer expansion WIP that landed alongside this milestone. They are not user-facing features; they restore invariants the WIP broke.

- [ ] **FIX-01**: An MCP client labeling itself `'OpenClaw 🦀'` (crab variant added to the server allowlist at `mcp-server/src/tools/visual-session.ts:10`) round-trips through the extension without a spurious `invalid_client_label` rejection -- `utils/mcp-visual-session.js` MCP_VISUAL_CLIENT_LABELS includes the crab label so server-side and extension-side normalization agree, restoring the "must match the extension's allowlist" invariant documented at `mcp-server/src/tools/visual-session.ts:7`
- [ ] **FIX-02**: `fsb-mcp-server setup` continues to surface an OpenClaw section in `getSetupSections()` so users see manual/unsupported fallback guidance for OpenClaw alongside the new ChatGPT/Claude.ai/Warp instructions sections; `tests/mcp-setup-guidance.test.js` returns to 35 passed / 0 failed (regression from the WIP's accidental section deletion is closed)
- [ ] **FIX-03**: Root `README.md` version badge, document title, and the intro `Note` line reflect the active milestone (`0.9.45rc1`) instead of the stale `0.9.36` left over from the WIP rewrite, so contributors and downstream packagers see an accurate version surface

## Future Requirements (deferred to v0.9.46+)

These items were research-flagged as P1 mitigations but were explicitly NOT selected for this rc1 cycle. They remain on the radar:

- [ ] **AGENTS-FUTURE-01**: One-time `chrome.alarms.getAll()` cleanup of `fsb_agent_*` alarms on `chrome.runtime.onInstalled` (reason=update). Risk if deferred: stranded zombie alarm fires for agents that no longer have handlers.
- [ ] **AGENTS-FUTURE-02**: MCP agent tools (`create_agent`, `list_agents`, `run_agent`, `stop_agent`, `delete_agent`, `toggle_agent`, `agent_stats`, `agent_history`) return structured `{ ok: false, deprecated: true, message: '...' }` payloads instead of being silently registered. Risk if deferred: MCP hosts (Claude Desktop, Codex, OpenCode) may treat empty payloads as success.
- [ ] **SYNC-FUTURE-01**: Deep-link redirect shim in `ui/options.js` rewriting legacy hashes (`#dashboard`, `#agents`, `#pair`, `#remote`) to `#sync` on `DOMContentLoaded`. Risk if deferred: bookmarks and showcase nav links to old anchors silently no-op.
- [ ] **SYNC-FUTURE-02**: Manual fallback pairing code (small token) displayed under the QR for users without a phone camera handy.
- [ ] **SYNC-FUTURE-03**: Last-paired timestamp + UA string persisted to `chrome.storage.local` and shown in the Sync tab.
- [ ] **SYNC-FUTURE-04**: Manual Reconnect button visible only when status is `disconnected` or `reconnecting`.
- [ ] **SYNC-FUTURE-05**: Live remote-control state chip ("Idle" / "Active -- clicking" / "Active -- typing") with debounced echo to avoid flicker.
- [ ] **STREAM-FUTURE-01**: Dashboard-ack-based stale-counter reset (`dash:dom-mutation-ack` envelope with sequence id) for end-to-end delivery confirmation. Larger contract surface; explicitly deferred in favor of flush-based reset (STREAM-02).
- [ ] **STREAM-FUTURE-02**: Stream health card UI (mutations/sec, queue depth, last flush age) for power users.

## Out of Scope (explicit exclusions)

These are explicitly NOT being done in v0.9.45rc1:

- **Per-message-deflate WebSocket extension negotiation** -- per-connection stateful compression has sliding-window-corruption failure modes (RFC 7692). Stay at the app-layer `_lz` envelope.
- **Migration to `pako` or `DecompressionStream("deflate-raw")`** -- LZ-string is a custom LZW variant, NOT RFC 1951 DEFLATE; switching transports is a multi-phase migration with feature-flag handshake. Reuse the already-loaded `LZString`.
- **Deletion of `chrome.storage.local['bgAgents']`** -- permanent loss of user-created agent definitions. Preservation costs nothing; user can revive later if scope reverses.
- **Angular 19 -> 20 migration** -- new build pipeline + router APIs + signal-component conventions; multi-week migration. Pin `^19.0.0`. Schedule as separate milestone before EOL 2026-05-19.
- **New build system / bundler / transpiler** -- project explicitly forbids it (CLAUDE.md). Continue to vendor minified files; load directly.
- **New UI framework (React, Vue, Svelte, Lit, Alpine)** -- forces a build system; 30 lines of HTML do not need a framework. Use plain `document.createElement` + the existing `data-section` pattern.
- **Rewrite of the pairing protocol** -- Phase 210 is shipped and working. Strict relocation + polish only.
- **CAPTCHA detection improvements** -- already on backlog, not in this milestone.
- **Multi-tab management** -- already on backlog, not in this milestone.

## Known Tech Debt

- **Angular 19 EOL: 2026-05-19** -- the showcase Angular shell must migrate to Angular 20 before this date. Out of scope for v0.9.45rc1; explicit milestone-after-next deadline.
- **Phase 209 has 7 human_needed UAT items** -- live CDP click/keyboard/scroll delivery, extension-side visual state, runtime tab-id resolution. Accepted as rc1 debt; address ad-hoc once Sync tab lands.
- **`mcp-server/src/tools/visual-session.ts.bak-openclaw-crab`** -- prior aborted sunset artifact noted by architecture research. One-line check during AGENTS-02 planning: safe to leave or remove?

## Traceability

Every v1 requirement maps to exactly one phase. Validated requirements are mapped to the phase that shipped them.

| REQ-ID | Phase | Plan | Status |
|--------|-------|------|--------|
| SYNC-VALID-01 | 209 | 209-01 | shipped (live UAT pending) |
| SYNC-VALID-02 | 210 | 210-01 | shipped |
| SYNC-01 | 213 | TBD | active |
| SYNC-02 | 213 | TBD | active |
| SYNC-03 | 213 | TBD | active |
| AGENTS-01 | 212 | TBD | active |
| AGENTS-02 | 212 | TBD | active |
| AGENTS-03 | 212 | TBD | active |
| AGENTS-04 | 212 | TBD | active |
| AGENTS-05 | 212 | TBD | active |
| AGENTS-06 | 212 | TBD | active |
| STREAM-01 | 211 | TBD | active |
| STREAM-02 | 211 | TBD | active |
| STREAM-03 | 211 | TBD | active |
| STREAM-04 | 211 | TBD | active |
| WS-01 | 211 | TBD | active |
| WS-02 | 211 | TBD | active |
| WS-03 | 211 | TBD | active |
| LOG-01 | 211 | TBD | active |
| LOG-02 | 211 | TBD | active |
| LOG-03 | 211 | TBD | active |
| LOG-04 | 211 | TBD | active |
| FIX-01 | 214 | 214-01 | active |
| FIX-02 | 214 | 214-01 | active |
| FIX-03 | 214 | 214-01 | active |

**Coverage:** 27/27 requirements mapped (2 validated + 25 active). No orphans, no duplicates.

---
*Defined: 2026-04-28*
*Traceability filled: 2026-04-28 (roadmap phases 211, 212, 213 defined)*
