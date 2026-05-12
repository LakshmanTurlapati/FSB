# Phase 256: Sliding-Window Lifecycle - Context

**Gathered:** 2026-05-11
**Status:** Ready for planning
**Mode:** Smart-discuss (decisions locked at milestone level; this CONTEXT locks the lifecycle-shape decisions)
**Authoritative reference:** `.planning/v0.9.62-CONTRACT.md` (pinned by Phase 254). Phase 256 implements the IMPLICIT lifecycle on top of the schema layer landed by Phase 255.

<domain>
## Phase Boundary

Phase 256 adds the lifecycle code that makes the v0.9.62 visual session implicit. Phase 255 wired the schema + validator (every action tool now requires `visual_reason` + `client`); Phase 256 makes those fields actually drive overlay state without callers having to send an explicit start.

What lands in this phase:

1. **Implicit start** -- the FIRST action-tool call from an MCP agent on a tab (with no active visual session) creates a new session with the supplied `visual_reason` + `client` + badge. No prior explicit `start_visual_session` call required. The visible overlay state matches what v0.9.36 produced via explicit start.

2. **Sliding 60-second death timer** -- each subsequent action-tool call from the same agent on the same tab re-arms a 60-second death timer. Repeated calls within 60s keep the overlay alive indefinitely (no flicker between calls). After 60s with no further carrying tool call, the overlay glow + badge + client label clear automatically. A follow-up read-only tool call (e.g. `read_page`) does NOT re-arm the timer (read tools do not carry the field bundle, so the chokepoint validator skips them and they never reach lifecycle code).

3. **MV3 service-worker eviction safety** -- killing and restarting the SW mid-session (cold/warm boot or 30s eviction) restores the same owner + badge + remaining-deadline state by replaying from `chrome.storage.session`. The death-timer arithmetic does NOT silently reset on SW wake. Follows the v0.9.36 visual-session persistence pattern.

4. **Ownership-gating precedence** -- a cross-agent action on a tab already owned by another agent rejects with the existing v0.9.60 `TAB_NOT_OWNED` typed error at the dispatch gate BEFORE any visual-session state is read or written. The previous agent's overlay/badge is NOT silently merged or hijacked.

5. **`is_final` is accepted at schema layer; runtime no-op for now** -- Phase 256 does NOT implement the immediate-clear behaviour of `is_final: true`. The field is parsed and stored on the call but the runtime ignores it. Phase 257 wires the runtime semantics.

OUT OF SCOPE for Phase 256:
- `is_final` runtime semantics (Phase 257).
- Removal of the v0.9.36 explicit `start_visual_session` / `end_visual_session` MCP tools (Phase 258).
- `TOOL_REMOVED` error or CHANGELOG entries (Phase 258).
- Skill USAGE.md / references rewrites (Phase 260).
- Adding new badge labels to the allowlist (governed by v0.9.36 policy; not opened by this milestone).
- Cross-tab / cross-window session coordination (carried over from v0.9.36 deferred list; remains deferred).

</domain>

<decisions>
## Implementation Decisions

### Persistence: chrome.storage.session

Lifecycle state is keyed `mcpVisualSession:<tabId>` and stored in `chrome.storage.session` (NOT `chrome.storage.local`). Mirrors the v0.9.36 visual-session replay pattern.

Each per-tab entry shape (working title; planner may refine field names):

```javascript
{
  tabId: 12345,                       // chrome.tabs.Tab.id
  agentId: 'agent_<uuid>',            // v0.9.60 agent identity from registry
  client: 'Claude',                   // canonical badge label (allowlisted, normalised)
  visualReason: 'Logging in...',      // most-recent reason string from the latest tick
  startedAt: 1715472000000,           // wall-clock ms at session creation (for diagnostics)
  lastTickAt: 1715472030000,          // wall-clock ms at most-recent action call
  deadlineAt: 1715472090000,          // wall-clock ms at which auto-clear fires (lastTickAt + 60000)
  isFinal: false,                     // captured for Phase 257 (runtime no-op in Phase 256)
}
```

Reads / writes happen via small helper functions in a NEW module file (suggested: `extension/utils/mcp-visual-session-lifecycle.js`) that the background service worker imports. The helpers debounce writes (single write per tick is fine -- the v0.9.36 throttle pattern is reused).

Allowed write entry-points:
- Create: when the dispatch chokepoint calls `recordVisualSessionTick(tabId, agentId, fields)` for the first time on a tab with no active session.
- Update: subsequent ticks reuse the same key and overwrite `lastTickAt`, `deadlineAt`, `visualReason`, `isFinal`.
- Delete: when the deadline fires (auto-clear) OR Phase 257 honours `is_final` immediate-clear OR the tab closes / browser exits.

### Timer: deadline timestamp + chrome.alarms wake-up

Use `chrome.alarms` (NOT `setTimeout`) for the death-timer wake-up. `chrome.alarms` is MV3-safe -- it survives SW eviction and reliably wakes the SW at the scheduled time.

The alarm name is `mcpVisualDeath:<tabId>`. On every tick, the helper clears any existing alarm with that name and creates a new one with `when: deadlineAt`. On SW wake (`chrome.alarms.onAlarm`):

1. Look up the lifecycle entry from `chrome.storage.session`.
2. If entry is missing (already cleared by another path), no-op.
3. If `Date.now() >= entry.deadlineAt`, fire the auto-clear path (delete entry + send `clear` message to the content script in tab `entry.tabId`).
4. If `Date.now() < entry.deadlineAt` (clock skew or alarm fired early), reschedule the alarm with the corrected `when`.

This pattern handles SW eviction gracefully: even if the SW was evicted mid-session, the next alarm wake-up restores the same deadline arithmetic because the deadline is stored persistently.

Chrome's minimum alarm period is 30 seconds (in production) -- 60s is well within bounds. For testing / development, the planner can record the alarm-minimum caveat in the lifecycle module's header comment.

### State mutation chokepoint

All lifecycle state mutations route through `recordVisualSessionTick(tabId, agentId, fieldBundle)` in the new lifecycle module. The dispatch chokepoint in `mcp/src/tools/manual.ts` (or its host-side equivalent in `background.js`) calls this helper AFTER the Phase 255 validator passes AND AFTER the v0.9.60 ownership gate passes, but BEFORE the underlying browser action executes.

Ordering at the chokepoint (with Phase 256 additions in bold):

1. Tool exists in TOOL_REGISTRY.
2. Tool is action (`_readOnly: false`); read-only tools skip to step 6.
3. `visual_reason` + `client` present -- else `VISUAL_FIELDS_REQUIRED`.
4. `client` allowlisted -- else `BADGE_NOT_ALLOWED`.
5. v0.9.60 ownership gate -- else `TAB_NOT_OWNED` / `AGENT_CAP_REACHED`.
6. **(Phase 256 new)** `recordVisualSessionTick(tabId, agentId, { visualReason, client, isFinal })` -- creates or refreshes the lifecycle entry; re-arms the death timer.
7. Action executes.
8. Existing post-action `change_report` returns.

Read-only tools skip steps 3-6, so they do NOT touch lifecycle state. This is the contract: reads are silent.

### Overlay rendering reuses v0.9.36 surface

The visible overlay (orange glow, badge, client label, reason text) is the SAME shadow-DOM overlay rendered by v0.9.36. Phase 256 does NOT create a new overlay; it reuses the existing renderer.

The wiring is:
- Background SW sends `{type: 'mcpVisualSession:tick', tabId, payload: { visualReason, client, isFinal }}` to the tab's content script on every accepted tick.
- Content script handles the message by calling the existing v0.9.36 visual-session renderer (`startMcpVisualSession` / `updateMcpVisualSessionReason` / similar -- planner discovers the exact symbol names by reading the existing content script and `extension/utils/mcp-visual-session.js`).
- Background SW sends `{type: 'mcpVisualSession:clear', tabId}` on auto-clear (deadline fired).
- Content script handles the clear by calling the existing renderer's stop hook.

NO new overlay code. The lifecycle module is a STATE + EVENT layer on top of the existing renderer.

### Ownership-gating wins, always

Cross-agent rejection at the dispatch gate runs BEFORE lifecycle code (step 5 above). A different agent's call on an owned tab never reaches `recordVisualSessionTick`. The previous owner's overlay is preserved unchanged.

If the previous owner's session is auto-cleared while a different agent's call is being rejected, that is fine -- the rejection is independent of lifecycle. The clear path is event-driven (alarm fired); the rejection path is dispatch-driven.

### MV3 SW-startup hook

On every SW startup (cold or warm), the lifecycle module's init function:

1. Reads all keys matching `mcpVisualSession:*` from `chrome.storage.session`.
2. For each entry, computes `remaining = entry.deadlineAt - Date.now()`.
3. If `remaining <= 0`, fires auto-clear immediately (sends `clear` to the tab).
4. If `remaining > 0`, creates a new `chrome.alarms` entry with `when: entry.deadlineAt`.

This makes the lifecycle resilient to MV3 SW eviction at any point. The state always lives in `chrome.storage.session`; alarms are derived from state.

### `chrome.tabs.onRemoved` cleanup

When a tab closes, the lifecycle module deletes any `mcpVisualSession:<tabId>` entry and cancels the matching alarm. Prevents stale state from accumulating in `chrome.storage.session`.

### Claude's Discretion

- Exact lifecycle module filename (suggest `extension/utils/mcp-visual-session-lifecycle.js`; planner can refine).
- Exact helper function names (suggest `recordVisualSessionTick`, `clearVisualSession`, `restoreVisualSessionsFromStorage`; planner can refine).
- Exact alarm-name format (suggest `mcpVisualDeath:<tabId>`; planner can refine).
- Whether to debounce writes within a single SW execution (allowed but not required; the chokepoint already ensures one tick = one write).
- Whether to add a small in-memory cache on top of `chrome.storage.session` for hot-path reads (allowed; v0.9.36 has precedent for this).
- Whether to emit telemetry events for tick / auto-clear (allowed but not required; v0.9.60 dashboard wiring is a separate surface).

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets

- `extension/utils/mcp-visual-session.js` -- v0.9.36 source-of-truth for `MCP_VISUAL_CLIENT_LABELS` + `normalizeMcpVisualClientLabel` + `isAllowedMcpVisualClientLabel` + `getAllowedMcpVisualClientLabels`. Phase 256 does NOT modify this file (allowlist values stay frozen).
- v0.9.36 visual-session renderer (location TBD by planner -- grep for `start_visual_session` / `MCP_VISUAL` / `visual_session` in `content/` and `background.js`). Phase 256 REUSES this renderer end-to-end; only the trigger changes.
- `mcp/src/tools/manual.ts` -- Phase 255 added the validator chokepoint here. Phase 256 wires `recordVisualSessionTick` into the SAME chokepoint, AFTER the v0.9.60 ownership gate and BEFORE the underlying action executes.
- `chrome.storage.session` -- v0.9.36 visual-session uses this for replay-after-SW-eviction. Same pattern reused here.
- `chrome.alarms` -- existing pattern in `background.js` for SW-survivable timers. Examples in v0.9.45rc1 stream watchdog and v0.9.60 reconnect-grace timers.
- v0.9.60 agent identity registry (mints `agent_<uuid>` IDs). Phase 256 reads the agent_id from the registry, never from caller-supplied input.

### Established Patterns

- Per-tab state in `chrome.storage.session` keyed by `<feature>:<tabId>` (v0.9.36 / v0.9.60 precedent).
- Alarms named `<feature>:<tabId>` or `<feature>:<connectionId>`; cleared on resolution; cancelled on tab close (v0.9.60 reconnect-grace pattern).
- Lifecycle modules export pure functions for state mutation; the background service worker drives invocation; the content script renders state changes.
- Cross-cutting concerns (ownership, validation, lifecycle) run at the dispatch chokepoint in a fixed order; do NOT spread into per-tool handlers.
- All MV3 storage writes go through tiny single-purpose helpers (not raw `chrome.storage.session.set` scattered around). Easier to debounce and easier to test.

### Integration Points

- `mcp/src/tools/manual.ts` -- the dispatch chokepoint already has the Phase 255 validator. Phase 256 adds the `recordVisualSessionTick(...)` call after the existing ownership gate.
- `background.js` (or `extension/background.js` / `extension/sw/*.js` -- planner discovers the actual SW entry file) -- registers the `chrome.alarms.onAlarm` and `chrome.tabs.onRemoved` listeners.
- `extension/utils/mcp-visual-session.js` -- imported by the new lifecycle module for allowlist + normalisation helpers.
- The existing v0.9.36 content-script renderer -- receives `mcpVisualSession:tick` / `mcpVisualSession:clear` messages from the new lifecycle module.
- `tests/` -- the existing `tests/visual-session-schema-lock.test.js` (Phase 255) stays unchanged; Phase 256 adds a NEW test or extends an existing v0.9.36 lifecycle test (planner decides). At minimum, lifecycle behaviour gets unit coverage; SW-eviction replay coverage may be deferred to Phase 259 if a clean unit-test fixture isn't feasible.

</code_context>

<specifics>
## Specific Ideas

### Plan shape (planner refines; 4-6 plans total recommended)

Suggested plan layout:

- **256-01 Lifecycle module + per-tab state shape** -- new `extension/utils/mcp-visual-session-lifecycle.js` with the helpers (`recordVisualSessionTick`, `clearVisualSession`, `restoreFromStorage`, alarm wiring). Pure module; no integration yet.
- **256-02 Dispatch-chokepoint integration** -- `mcp/src/tools/manual.ts` calls `recordVisualSessionTick(...)` after the v0.9.60 ownership gate; cross-agent rejection still wins.
- **256-03 Background SW wiring** -- register `chrome.alarms.onAlarm` and `chrome.tabs.onRemoved` listeners in `background.js`; on SW startup, call `restoreFromStorage` to re-arm timers.
- **256-04 Content-script messaging** -- send `mcpVisualSession:tick` / `:clear` messages from background to the active tab's content script; content script routes to the existing v0.9.36 renderer.
- **256-05 Lifecycle tests** -- unit tests for tick / clear / re-arm / SW-eviction restore. Wired into `npm test`.

Six plans is the maximum; collapsing 01+04 (lifecycle module + content-script wiring) or 02+03 (dispatch + SW wiring) is fine if natural.

### Test scope for Phase 256

Phase 256 owns lifecycle unit tests:

1. `recordVisualSessionTick(tabId, agentId, fields)` on a tab with no active session writes a new entry and creates a `chrome.alarms` entry at `deadlineAt`.
2. `recordVisualSessionTick` on a tab with an active session updates `lastTickAt` + `deadlineAt`, leaves `startedAt` unchanged, rebuilds the alarm.
3. Auto-clear path: when the alarm fires AND `Date.now() >= deadlineAt`, the entry is deleted and a clear message is sent.
4. SW-eviction restore: emulate SW restart by calling `restoreFromStorage` against a populated storage map; assert alarms are recreated with the correct `when` and stale entries (deadline elapsed) trigger immediate clear.
5. `chrome.tabs.onRemoved` cleanup: closing the tab deletes the entry and cancels the alarm.
6. Read-only tools do NOT trigger `recordVisualSessionTick` (covered by Phase 255 validator skipping read tools; restated here for completeness).

End-to-end (live overlay) coverage stays in Phase 259's contract test.

### What Phase 256 does NOT do

- Does NOT change the v0.9.36 explicit `start_visual_session` / `end_visual_session` tool surface (still works; Phase 258 removes them).
- Does NOT introduce a separate per-agent timer; sliding window is per-tab (the agent_id is recorded but the timer is keyed by tabId).
- Does NOT change how the overlay renders (existing v0.9.36 shadow-DOM renderer reused unchanged).
- Does NOT add new badge labels.

</specifics>

<deferred>
## Deferred Ideas

None new for Phase 256. The carry-forward deferred items (PARITY-FUTURE-01 autopilot parity, PARITY-FUTURE-02 expected_duration_ms hint, IDENT-FUTURE-01 connection-derived client) remain deferred per the milestone roadmap.

</deferred>

---

*Phase: 256-sliding-window-lifecycle-implicit-start-60s-death-timer-sw-eviction-replay*
*Context gathered: 2026-05-11 via smart-discuss (decisions locked at milestone level)*
