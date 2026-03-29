# Phase 122: Connection & Auto-Start - Context

**Gathered:** 2026-03-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Dashboard DOM stream starts on first real page navigation (not blank/chrome:// tabs), stays alive as user browses across tabs, recovers automatically from WS disconnects, and shows connection health in the preview container. The preview is always visible once streaming begins -- no task submission needed.

</domain>

<decisions>
## Implementation Decisions

### Stream trigger
- **On first navigation after WS connect** -- extension waits until a real page loads (not chrome://newtab or blank), then sends initial snapshot. This avoids streaming empty/restricted pages.
- **Toggle option** -- dashboard includes a stream on/off toggle so user can pause/resume streaming manually without disconnecting WS
- Dashboard sends `dash:dom-stream-start` automatically once it detects a real page is loaded (extension can signal this via existing `ext:task-progress` or a new `ext:page-ready` message)
- Preview container becomes visible on first snapshot arrival, not on WS connect (prevents "Connecting..." dead state)

### Tab scope (always-on)
- **Active tab follows** -- stream tracks whichever tab is currently active via `chrome.tabs.onActivated`
- When user switches tabs, extension sends a fresh full snapshot from the new tab and restarts MutationObserver
- Between tasks, stream continues showing whatever the user is browsing
- Extension uses `chrome.tabs.onActivated` listener to detect tab switches and automatically re-target the stream

### Recovery strategy
- **Fresh snapshot on reconnect** -- on WS reopen, dashboard sends `dash:dom-stream-start`, extension sends new full snapshot
- Same pattern as existing Page Visibility pause/resume in dashboard.js visibilitychange handler
- No mutation buffering or diff replay -- keep it simple
- Extension service worker restart: dashboard detects WS close, shows disconnected badge, auto-reconnects with existing exponential backoff, then triggers fresh snapshot

### Status badge
- **Inside preview container** -- enhance existing `.dash-preview-status` green dot
- States: green pulsing (streaming), yellow solid (buffering/reconnecting), red solid (disconnected), gray (stream paused by toggle)
- Add tooltip with connection details (latency, last snapshot time, tab URL)
- No dashboard header badge -- keep it contained to the preview

### Claude's Discretion
- Exact message type for page-ready signal (`ext:page-ready` vs extending existing message)
- Debounce interval for tab switch snapshots (avoid rapid-fire on quick tab cycling)
- Whether toggle state persists in localStorage or resets on page reload
- Tooltip implementation details (CSS title attr vs custom tooltip component)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Content script DOM streaming
- `content/dom-stream.js` -- Full DOM serialization (`serializeDOM` line 168), MutationObserver streaming (`startMutationStream` line 488), scroll tracking (`startScrollTracker` line 557), overlay state broadcast, `streaming` flag gating. IIFE with `window.__FSB_SKIP_INIT__` guard.

### Extension WebSocket client
- `ws/ws-client.js` -- `_handleMessage` switch for `dash:dom-stream-*` messages (lines 213-224), `_forwardToContentScript` method (line 324, uses `_dashboardTaskTabId`), `connectWS` and reconnection logic

### Background service worker
- `background.js` -- `_dashboardTaskTabId` tracking (line 821), `broadcastDashboardProgress` (line 823), `broadcastDashboardComplete` with auto-stop (line 895), DOM stream message forwarding (lines 5833-5851: domStreamSnapshot/Mutations/Scroll/Overlay -> ext:dom-*)

### Dashboard renderer
- `showcase/js/dashboard.js` -- `setPreviewState` (line 1595), `handleDOMSnapshot` (line 1650), `handleDOMMutations` (line 1725), `handleDOMScroll` (line 1789), `handleDOMOverlay` (line 1804), `updatePreviewScale` (line 1696), `connectWS` (line 1852), `setTaskState` (line 359, currently sends dash:dom-stream-start only in 'running' case at line 417)

### Dashboard HTML/CSS
- `showcase/dashboard.html` -- Preview container (lines 199-217): iframe, glow, progress, status dot, loading/disconnected/error overlays
- `showcase/css/dashboard.css` -- Preview styles (lines 1507-1629): .dash-preview, .dash-preview-iframe, .dash-preview-status, .dash-preview-glow, animations

### Phase 44 verification
- `.planning/phases/44-dom-cloning-stream/44-VERIFICATION.md` -- Full verification report (11/11 truths, 6/6 requirements), re-verified 2026-03-29 with two bug fixes applied
- `.planning/phases/44-dom-cloning-stream/44-CONTEXT.md` -- Original design decisions: WS message protocol, snapshot serialization, mutation batching, overlay re-injection, streaming activation

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `content/dom-stream.js` `serializeDOM()`: Full body clone with script stripping, URL absolutification, data-fsb-nid assignment, computed style capture, 2MB truncation -- use as-is for snapshots
- `content/dom-stream.js` `startMutationStream()`: MutationObserver with 150ms batch debounce -- use as-is, adjust interval for rAF sync in Phase 124
- `showcase/js/dashboard.js` `handleDOMSnapshot()` / `handleDOMMutations()`: Full iframe renderer with srcdoc injection and nid-based mutation application -- use as-is
- `showcase/js/dashboard.js` `setPreviewState()`: State machine with hidden/loading/streaming/disconnected/error states -- extend with new states
- `showcase/css/dashboard.css` `.dash-preview-status`: Green pulsing dot -- extend with yellow/red/gray variants

### Established Patterns
- WS messages: `{ type: 'ext:*' | 'dash:*', payload: {...}, ts: Date.now() }`
- Content script modules: IIFE with `window.FSB` namespace, `window.__FSB_SKIP_INIT__` guard
- Shadow DOM for overlays: host element with `all: initial`, attachShadow, high z-index
- Server is blind relay -- no message parsing, no routing changes needed
- Task lifecycle: `dash:task-submit` -> `ext:task-progress` -> `ext:task-complete`

### Integration Points
- `showcase/js/dashboard.js` `connectWS()` (line 1852): Add `dash:dom-stream-start` send after WS open + page-ready signal
- `ws/ws-client.js` `_forwardToContentScript()`: Already uses `_dashboardTaskTabId` -- needs to also work with a general "streaming tab" concept for always-on mode
- `background.js`: Add `chrome.tabs.onActivated` listener to re-target stream when user switches tabs
- `showcase/dashboard.html`: Add toggle button to preview container header area
- `showcase/css/dashboard.css`: Add yellow/red/gray status dot variants, toggle button styles

</code_context>

<specifics>
## Specific Ideas

- The preview should appear as soon as real content is available -- no "Connecting..." or loading spinners for more than a second
- Toggle should feel lightweight -- a small icon button in the preview header, not a big switch
- Tab following should be seamless -- when switching between tabs the preview should update within a second
- The status dot enhancement should reuse the existing pulsing animation but with different colors per state

</specifics>

<deferred>
## Deferred Ideas

- Multi-tab simultaneous streaming (show multiple browser tabs at once) -- future capability
- Stream recording/playback for reviewing past browsing sessions -- future capability
- Bandwidth optimization with selective region streaming -- future capability

</deferred>

---

*Phase: 122-connection-auto-start*
*Context gathered: 2026-03-29*
