# Roadmap: FSB (Full Self-Browsing)

## Status

Active milestone: **v0.9.45rc1 Sync Surface, Agent Sunset & Stream Reliability**.

Refocus FSB on what it does best -- ship a dedicated Sync tab for remote control, gracefully retire background agents in favor of OpenClaw / Claude Routines, and harden the streaming pipeline the dashboard relies on.

## Milestones

- 🟡 **v0.9.45rc1 Sync Surface, Agent Sunset & Stream Reliability** — in progress (started 2026-04-28)
- ✅ **v0.9.40 Session Lifecycle Reliability** — shipped 2026-04-25
- ✅ **v0.9.36 MCP Visual Lifecycle & Client Identity** — shipped 2026-04-24
- ✅ **v0.9.35 MCP Plug-and-Play Reliability** — shipped 2026-04-24
- ✅ **v0.9.34 Vault, Payments & Secure MCP Access** — shipped 2026-04-22
- ✅ **v0.9.30 MCP Platform Install Flags** — shipped 2026-04-18

## Phases

- [x] **Phase 209: Remote Control Handlers** - CDP click/key/scroll handlers with `ext:remote-control-state` lifecycle broadcast (live UAT pending)
- [x] **Phase 210: QR Code Pairing Restoration** - `/api/pair/generate` flow with 60s server-driven countdown and regenerate-on-expiry affordance
- [ ] **Phase 211: Stream Reliability & Diagnostic Logging** - WebSocket inbound `_lz` decompression symmetry, DOM streaming watchdog + node-level truncation, redacted/rate-limited diagnostic logging
- [ ] **Phase 212: Background Agents Sunset** - Playful deprecation card replaces agents UI, agent-only code paths commented out (not deleted) with deprecation annotations, showcase mirrors the messaging
- [ ] **Phase 213: Sync Tab Build** - New top-level Sync tab consolidates QR pairing, hash key, server URL, and live connection-status pill into a single surface; showcase copy points at it

## Phase Details

### Phase 209: Remote Control Handlers
**Goal**: Dashboard click/key/scroll commands reach the active streaming tab via Chrome DevTools Protocol with lifecycle state broadcast through `ext:remote-control-state`
**Depends on**: Nothing (already shipped before milestone formalized)
**Requirements**: SYNC-VALID-01
**Success Criteria** (what must be TRUE):
  1. Dashboard remote-control click commands successfully dispatch to the active streaming tab via CDP
  2. Dashboard remote-control key/scroll commands successfully dispatch to the active streaming tab via CDP
  3. The extension broadcasts `ext:remote-control-state` with `{enabled, attached, tabId, reason, ownership}` whenever attach/detach lifecycle changes
  4. Dashboard surfaces consume the broadcast and reflect the live attached/idle state
**Plans**: 209-01 (shipped)
**Status**: Shipped (live UAT pending: 7 human_needed items per `.planning/phases/209-remote-control-handlers/209-HUMAN-UAT.md`)

### Phase 210: QR Code Pairing Restoration
**Goal**: Restore QR-based dashboard pairing with a server-driven countdown and operator-visible regenerate-on-expiry affordance
**Depends on**: Phase 209 (shares `ext:remote-control-state` surface)
**Requirements**: SYNC-VALID-02
**Success Criteria** (what must be TRUE):
  1. Operator clicks `#btnPairDashboard` in the FSB control panel and the extension POSTs to `/api/pair/generate`
  2. A QR code renders on screen using the server-issued pairing token
  3. The displayed countdown reflects the 60-second server-issued expiry, not a hardcoded client timer
  4. When the countdown reaches zero, an explicit "regenerate" affordance appears so the operator can request a fresh token without reopening the dialog
**Plans**: 210-01 (shipped)
**Status**: Shipped
**UI hint**: yes

### Phase 211: Stream Reliability & Diagnostic Logging
**Goal**: Harden the DOM streaming pipeline and WebSocket transport before the Sync tab surfaces live state, and replace silent error swallowing with redacted, rate-limited diagnostic logging
**Depends on**: Nothing (maximally isolated; parallel-safe plans across `ws/ws-client.js`, `content/dom-stream.js`, dialog/message-delivery paths)
**Requirements**: STREAM-01, STREAM-02, STREAM-03, STREAM-04, WS-01, WS-02, WS-03, LOG-01, LOG-02, LOG-03, LOG-04
**Success Criteria** (what must be TRUE):
  1. The extension WebSocket inbound handler decompresses `{_lz: true, d: <base64>}` envelopes via `LZString.decompressFromBase64` and dispatches the inner message; plain JSON falls through unchanged
  2. A two-tier mutation watchdog (`chrome.alarms` in the service worker plus `setTimeout` + monotonic `lastDrainTs` in the content script) detects stuck mutation queues within 5 seconds and forces a flush; the stale counter resets on successful drain and is surfaced via a new `staleFlushCount` field on `ext:stream-state` (the existing `ext:dom-mutations` payload shape is unchanged)
  3. Snapshot generation on a 5MB / ~50k-node DOM fixture completes in under 200ms using a single `TreeWalker` pass with cached `getBoundingClientRect` results, and large-DOM truncation operates at the node level with a `truncated: true, missingDescendants: N` sentinel capped at 80% of the relay's per-message limit
  4. Silent `.catch(() => {})` calls in dialog relay and message-delivery paths emit layered diagnostic logs (`[FSB DLG]`, `[FSB BG]`, `[FSB WS]`, `[FSB DOM]`, `[FSB SYNC]`), are rate-limited per category (one `console.warn` per 10s with counter rollup), route through a `redactForLog` helper that logs origin/length/status only, and benign SPA-navigation catches downgrade to `automationLogger.debug`
  5. Diagnostic events persist to a `chrome.storage.local` ring buffer (last 100 entries) with an "Export diagnostics" affordance that the Sync tab can later expose
**Plans**: TBD

### Phase 212: Background Agents Sunset
**Goal**: Retire the background-agents feature in favor of OpenClaw / Claude Routines via a playful deprecation card, comment-out (not delete) every agent-only code path with annotation, and mirror the messaging across showcase/dashboard surfaces -- preserving shared utilities, storage, and the MCP reconnect alarm path
**Depends on**: Phase 211 is preferable to ship first (so watchdog/decompression are present), but no hard code dependency. Must precede Phase 213 because Sync tab moves the Server Sync card OUT OF the `#background-agents` section.
**Requirements**: AGENTS-01, AGENTS-02, AGENTS-03, AGENTS-04, AGENTS-05, AGENTS-06
**Success Criteria** (what must be TRUE):
  1. Operator opens the FSB control panel and the Background Agents tab body shows a playful "we're not reinventing this wheel" deprecation card naming OpenClaw and Claude Routines as recommended successors with link-out and effective version
  2. Every agent-only code path across `agents/*.js`, `background.js` agent surfaces, `ws/ws-client.js` agent dispatch, MCP agent tools, popup/sidepanel slash commands, and `ui/options.js` agent UI controllers is commented out (not deleted) and annotated `// DEPRECATED v0.9.45rc1: superseded by OpenClaw / Claude Routines -- see PROJECT.md.`; shared utilities are untouched
  3. On extension update from a prior version that had agents, the operator sees a one-time `fsb_sunset_notice` card listing the names of their previously created agents with a copy-to-clipboard export of names only (no task text)
  4. Showcase home (Background Agents feature card) and dashboard surfaces (vanilla `dashboard.html` and Angular `dashboard-page.component.html/ts`) display the same agents-sunset messaging; `ext:remote-control-state` and `_lz` decompression paths remain intact on the showcase side
  5. `chrome.storage.local['bgAgents']` data and `fsb_agent_*` `chrome.alarms` entries are preserved (not proactively cleaned), and the shared `chrome.alarms.onAlarm` listener retains its `MCP_RECONNECT_ALARM` early-return path -- only the agent branch is commented out
**Plans**: TBD
**UI hint**: yes

### Phase 213: Sync Tab Build
**Goal**: Add a single top-level Sync tab to the FSB control panel that consolidates QR pairing, hash key, server URL, and a live connection-status pill into one dedicated surface; update showcase/dashboard copy to point at it
**Depends on**: Phase 212 (Sync tab MOVES the Server Sync card out of the `#background-agents` section that Phase 212 sunsets)
**Requirements**: SYNC-01, SYNC-02, SYNC-03
**Success Criteria** (what must be TRUE):
  1. Operator finds a top-level "Sync" tab in the FSB control panel that consolidates QR pairing, hash key, server URL, and connection status into one dedicated surface (relocated from the retired Background Agents section, IDs unchanged)
  2. The Sync tab shows a live connection-status pill that reflects current `ext:remote-control-state`, with replay-on-attach via a new `getRemoteControlState` runtime action and live updates via a `remoteControlStateChanged` runtime push
  3. The showcase home page and dashboard pairing copy reference the new Sync tab by name ("Open the Sync tab in FSB") instead of the retired Background Agents location
**Plans**: TBD
**UI hint**: yes

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 209. Remote Control Handlers | 1/1 | Shipped (live UAT pending) | 2026-04-27 |
| 210. QR Code Pairing Restoration | 1/1 | Shipped | 2026-04-28 |
| 211. Stream Reliability & Diagnostic Logging | 0/? | Ready to plan | - |
| 212. Background Agents Sunset | 0/? | Not started | - |
| 213. Sync Tab Build | 0/? | Not started | - |

## Backlog

- Deferred Angular migration requirements (DASH-08 through MIGR-03) remain parked from v0.9.29.
- Live UAT for v0.9.34 vault behavior and MCP payment approve/deny/delayed approval remains accepted validation debt unless it overlaps future verification work.
- Phase 999.1 backlog (`mcp-tool-gaps-click-heuristics`) is unrelated to v0.9.45rc1; remains parked.
- Phase 209 has 7 human_needed UAT items (live CDP click/keyboard/scroll delivery, extension-side visual state, runtime tab-id resolution) -- accepted debt for rc1, address ad-hoc once Sync tab lands.

### v0.9.46+ Future Requirements (research-flagged, deferred)

- **AGENTS-FUTURE-01**: One-time `chrome.alarms.getAll()` cleanup of `fsb_agent_*` alarms on `chrome.runtime.onInstalled` (reason=update)
- **AGENTS-FUTURE-02**: MCP agent tools return structured `{ ok: false, deprecated: true, message: '...' }` payloads instead of being silently registered
- **SYNC-FUTURE-01**: Deep-link redirect shim in `ui/options.js` rewriting legacy hashes (`#dashboard`, `#agents`, `#pair`, `#remote`) to `#sync`
- **SYNC-FUTURE-02**: Manual fallback pairing code (small token) displayed under the QR
- **SYNC-FUTURE-03**: Last-paired timestamp + UA string persisted and displayed in the Sync tab
- **SYNC-FUTURE-04**: Manual Reconnect button visible only when status is `disconnected` or `reconnecting`
- **SYNC-FUTURE-05**: Live remote-control state chip ("Idle" / "Active -- clicking" / "Active -- typing") with debounced echo
- **STREAM-FUTURE-01**: Dashboard-ack-based stale-counter reset (`dash:dom-mutation-ack` envelope with sequence id)
- **STREAM-FUTURE-02**: Stream health card UI (mutations/sec, queue depth, last flush age) for power users

<details>
<summary>✅ v0.9.36 MCP Visual Lifecycle & Client Identity (Phases 203-205) — SHIPPED 2026-04-24</summary>

- [x] Phase 203: MCP Visual Session Contract (2/2 plans) — completed 2026-04-23
- [x] Phase 204: Overlay Badge & Session Persistence (2/2 plans) — completed 2026-04-23
- [x] Phase 205: Validation & MCP Usage Docs (2/2 plans) — completed 2026-04-24

Archive:
- [.planning/milestones/v0.9.36-ROADMAP.md](./milestones/v0.9.36-ROADMAP.md)
- [.planning/milestones/v0.9.36-REQUIREMENTS.md](./milestones/v0.9.36-REQUIREMENTS.md)

</details>

Older milestone phase details live in the archived roadmap snapshots under `.planning/milestones/`.

---
*Roadmap reorganized: 2026-04-24*
*Last updated: 2026-04-28 after defining v0.9.45rc1 phase structure (Phases 211, 212, 213)*
