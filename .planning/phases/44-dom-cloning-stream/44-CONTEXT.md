# Phase 44: DOM Cloning Stream - Context

**Gathered:** 2026-03-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Dashboard shows a live structural reconstruction of the page FSB is automating, updated in real time. This is a non-interactive preview — users watch FSB work but cannot click or interact with the cloned page. The preview appears below the task progress area during active tasks and disappears when no task is running. DOM streaming activates automatically when a task starts and stops when it completes, with zero performance overhead when not streaming.

</domain>

<decisions>
## Implementation Decisions

### DOM viewer layout
- **Non-interactive preview** — the cloned DOM is purely for watching, no clicks or interactions. Iframe uses `pointer-events: none`
- Preview appears **below the task progress area** when a task is running, collapses when no task active
- Container uses **16:9 aspect ratio** that scales with dashboard width — feels like watching a screen
- Preview **auto-scrolls to follow FSB's viewport position** — dashboard user always sees what FSB sees. Extension sends scroll coordinates as part of the stream, preview iframe scrolls to match
- Agent grid remains visible below the preview

### Snapshot serialization (DOM-01)
- **Full page snapshot** on task start — serialize entire `<body>`, not just viewport (~200-500KB one-time payload)
- **Visual fidelity** — capture computed styles inline (non-default values only), keep external stylesheet `<link>` tags (load from original CDN), absolutify all URLs for images/links/resources
- **Strip all `<script>` tags** entirely — no JavaScript execution in the clone
- **Skip iframes** — replace with empty placeholder boxes. No cross-origin complications
- Strip FSB-injected elements (progress overlay, glow host) from the serialized DOM — overlays are re-created separately

### Incremental mutations (DOM-02)
- After initial snapshot, stream **only mutation diffs** via WS (~1-10KB per update)
- Use existing `DOMStateManager` MutationObserver infrastructure (25-attribute filter already configured)
- Mutation messages include: node additions/removals, attribute changes, text content changes, scroll position updates
- Batch mutations on a short timer (e.g., 100-200ms) to avoid flooding the WS connection

### Dashboard reconstruction (DOM-03)
- Render in a **sandboxed iframe** on the dashboard
- Initial snapshot written to iframe via `srcdoc` or blob URL
- Mutations applied to iframe DOM by a lightweight JS renderer running in the dashboard
- No interaction forwarding — iframe is display-only

### Resource loading (DOM-04)
- All URLs absolutified in the snapshot — images, stylesheets, fonts load directly from original CDN
- No server proxying (per PROJECT.md constraint)
- Mixed content warnings possible on HTTPS dashboard loading HTTP resources — accept as limitation

### Overlay visibility in clone (DOM-05)
- **Re-inject overlays via separate WS events** — don't clone Shadow DOM
- Extension sends `ext:dom-overlay` messages with glow rect position `{ x, y, w, h, state }` and progress data `{ percent, phase, eta }`
- Dashboard renders its own lightweight CSS overlay on top of the iframe — orange border rect for glow, small progress indicator
- Clean separation: DOM stream handles page content, overlay stream handles FSB visual state

### Streaming activation (DOM-06)
- **Automatic** — dashboard sends `dash:dom-stream-start` when a task begins, `dash:dom-stream-stop` when task completes
- No manual toggle button needed
- Stream **pauses when dashboard tab is hidden** (Page Visibility API) — sends `dash:dom-stream-pause`, extension stops sending mutations
- Stream **resumes when tab becomes visible** — sends `dash:dom-stream-resume`, extension sends fresh snapshot to re-sync
- Zero overhead on extension when no dashboard is requesting a stream

### WS message protocol additions
- `dash:dom-stream-start` — Dashboard requests DOM streaming for active task
- `dash:dom-stream-stop` — Dashboard stops DOM streaming
- `dash:dom-stream-pause` — Dashboard tab hidden, pause stream
- `dash:dom-stream-resume` — Dashboard tab visible, resume stream (triggers fresh snapshot)
- `ext:dom-snapshot` — Extension sends full page serialized HTML + stylesheet links + scroll position
- `ext:dom-mutations` — Extension sends batched mutation diffs
- `ext:dom-scroll` — Extension sends scroll position update
- `ext:dom-overlay` — Extension sends overlay state (glow rect + progress data)

### Claude's Discretion
- Exact mutation batching interval (100-200ms range)
- DOM serialization implementation details (TreeWalker vs recursive walk)
- How computed styles are filtered for "non-default" (comparison to default stylesheet or heuristic)
- Iframe sandbox attribute combination
- How mutation diffs are structured as JSON (node path addressing vs ID-based)
- Whether to use `srcdoc` or blob URL for initial iframe content
- Overlay CSS styling on dashboard side
- Aspect ratio container CSS implementation
- Whether to send a fresh snapshot on reconnect or just resume mutations

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Content script DOM infrastructure
- `content/dom-state.js` — DOMStateManager class: MutationObserver setup (lines 41-67), 25-attribute filter, `computeDiff()` (lines 156-226), `generateOptimizedPayload()` (lines 278-367), ElementCache with invalidation
- `content/dom-analysis.js` — OptimizedDOMSerializer (lines 158-251): string deduplication, compact element format, 40-60% compression. `buildMarkdownSnapshot()` for page structure analysis
- `content/visual-feedback.js` — ProgressOverlay (lines 219-493): Shadow DOM host, fixed position, z-index 2147483647. ViewportGlow (lines 509-800+): four-bar border glow with CSS variable animation, Shadow DOM mode: closed

### Content script module system
- `content/init.js` — `window.FSB` namespace, module registry pattern
- `content/messaging.js` — Background communication, iframe detection (lines 16-40), cross-origin handling

### WebSocket infrastructure
- `ws/ws-client.js` — Extension WS client: `send()` method, typed JSON envelope `{ type, payload, ts }`, reconnection with snapshot
- `server/src/ws/handler.js` — Blind relay server, room-based routing (`hashKey → { extensions, dashboards }`), raw message forwarding

### Dashboard
- `showcase/js/dashboard.js` — `handleWSMessage()` dispatches on `msg.type`, task state machine (idle/running/success/failed), WS connection management
- `showcase/dashboard.html` — Dashboard layout: task area, agent grid, detail panel
- `showcase/css/dashboard.css` — Accent color #ff6b35, responsive breakpoints

### Phase 42 context (task control patterns)
- `.planning/phases/42-remote-task-control/42-CONTEXT.md` — Task lifecycle WS messages (ext:task-progress, ext:task-complete), inline state transitions

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `content/dom-state.js` DOMStateManager: MutationObserver with 25-attribute filter already configured — extend for DOM streaming instead of building from scratch
- `content/dom-state.js` `computeDiff()`: Returns `{ added, removed, modified }` — use as basis for mutation encoding
- `content/dom-analysis.js` OptimizedDOMSerializer: String deduplication achieves 40-60% compression — may inform snapshot compression strategy
- `ws/ws-client.js` `send()`: Can send any typed JSON — add DOM stream message types
- `showcase/js/dashboard.js` `handleWSMessage()`: Already dispatches on `msg.type` — add DOM stream handlers

### Established Patterns
- WS messages: `{ type: 'ext:*' | 'dash:*', payload: {...}, ts: Date.now() }`
- Content script modules: IIFE with `window.FSB` namespace, guard against double-init
- Shadow DOM for overlays: host element with `all: initial`, attachShadow, high z-index
- Server is blind relay — no message parsing, no DOM-specific routing needed
- Task lifecycle: dash:task-submit → ext:task-progress → ext:task-complete

### Integration Points
- `content/` directory — New DOM streaming module (or extend dom-state.js) for serialization + mutation capture + WS sending
- `background.js` — Route `dash:dom-stream-start/stop/pause/resume` messages from WS to content script
- `ws/ws-client.js` — Handle dashboard DOM stream control messages, forward to content script via chrome.tabs.sendMessage
- `showcase/dashboard.html` — Add live preview container (aspect-ratio iframe) below task progress area
- `showcase/js/dashboard.js` — Add DOM renderer: receive snapshot, apply mutations, render overlay, manage iframe lifecycle
- `showcase/css/dashboard.css` — Aspect-ratio container, overlay positioning, preview state transitions

</code_context>

<specifics>
## Specific Ideas

- The preview should feel like watching a screen recording of someone using a website — you see exactly what FSB sees as it works
- Non-interactive is key: this is observation-only, not remote control (remote control is the task input)
- Auto-scroll tracking means the dashboard user never needs to manually scroll — the view follows FSB's actions naturally
- Overlay re-injection keeps the DOM stream clean (just page content) while still showing FSB's visual state (glow + progress)

</specifics>

<deferred>
## Deferred Ideas

- Selective DOM region streaming (optimization over full cloning) — TMPL-02 in future requirements
- Interactive DOM preview (clicking elements to target them) — future consideration
- DOM stream recording/playback for reviewing past task executions — future consideration

</deferred>

---

*Phase: 44-dom-cloning-stream*
*Context gathered: 2026-03-17*
