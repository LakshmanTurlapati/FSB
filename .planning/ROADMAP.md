# Roadmap: FSB (Full Self-Browsing)

## Milestones

- v0.9 Reliability Improvements (shipped 2026-02-14)
- v9.0.2 AI Situational Awareness (shipped 2026-02-18)
- v9.3 Tech Debt Cleanup (shipped 2026-02-23)
- v9.4 Career Search Automation (shipped 2026-02-28)
- v10.0 CLI Architecture (shipped 2026-03-15)
- v0.9.2-v0.9.4 Productivity, Memory & AI Quality (shipped 2026-03-17)
- v0.9.5 Progress Overlay Intelligence (shipped 2026-03-17)
- v0.9.6 Agents & Remote Control (shipped 2026-03-19)
- v0.9.7 MCP Edge Case Validation (shipped 2026-03-22) -- [archive](milestones/v0.9.7-ROADMAP.md)
- v0.9.8 Autopilot Refinement (shipped 2026-03-23) -- [archive](milestones/v0.9.8-ROADMAP.md)
- v0.9.9 Excalidraw Mastery (shipped 2026-03-25) -- [archive](milestones/v0.9.9-ROADMAP.md)
- v0.9.8.1 npm Publishing (in progress, parallel)
- v0.9.9.1 Phantom Stream (current)

---

## v0.9.8.1 npm Publishing

**Milestone Goal:** Publish the FSB MCP server as an npm package so users can install it with a single `npx` command instead of cloning the repo.

### Phases (v0.9.8.1)

- [x] **Phase 105: Package & Distribution** - npm-ready package with metadata, build pipeline, CI publish, and npx installation (completed 2026-03-24)
- [ ] **Phase 106: Documentation** - README with FSB branding, MCP client config examples, and full tool reference

<details>
<summary>Phase Details (v0.9.8.1)</summary>

### Phase 105: Package & Distribution
**Goal**: Users can install and run the FSB MCP server via `npx -y fsb-mcp-server` without cloning the repo
**Depends on**: Nothing (first phase of milestone)
**Requirements**: PKG-01, PKG-02, PKG-03, PKG-04, DIST-01, DIST-02, DIST-03
**Plans**: 2 plans
Plans:
- [x] 105-01-PLAN.md -- Package metadata, files whitelist, .npmignore, and prepublishOnly script
- [x] 105-02-PLAN.md -- GitHub Actions publish workflow and end-to-end local verification

### Phase 106: Documentation
**Goal**: Users can configure the FSB MCP server in their preferred MCP client by following the README
**Depends on**: Phase 105
**Requirements**: DOCS-01, DOCS-02, DOCS-03
**Plans**: [to be planned]

</details>

---

### v0.9.8.1 npm Publishing Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 105. Package & Distribution | 2/2 | Complete   | 2026-03-24 |
| 106. Documentation | 0/? | Not started | - |

---

## v0.9.9.1 Phantom Stream

**Milestone Goal:** Make the dashboard DOM stream fully functional -- auto-connect on WebSocket, full-fidelity live preview with viewport-adaptive resize, display-matched frame rate, and remote browser control from the dashboard.

### Phases (v0.9.9.1)

- [ ] **Phase 122: Connection & Auto-Start** - Stream starts on WS connect, stays alive between tasks, recovers from disconnects, shows health status
- [x] **Phase 122.1: Stream Overlay Fix** - Fix glow overlay not appearing in DOM stream preview during automation (INSERTED) (completed 2026-03-29)
- [x] **Phase 122.2: Stop Signal & Final Outcome** - Dashboard stop button doesn't halt FSB automation, and task completion/failure result not relayed back to dashboard (INSERTED) (completed 2026-03-31)
- [x] **Phase 122.3: WS Payload Compression** - DOM stream snapshots and task results reliably reach dashboard by compressing WS payloads client-side before sending through relay (INSERTED) (completed 2026-03-31)
- [ ] **Phase 123: Layout Modes** - Maximize/minimize toggle, viewport-adaptive resize, picture-in-picture, fullscreen preview
- [x] **Phase 123.1: Stream Fidelity Fix** - DOM clone has broken layouts on complex sites -- CSS not loading properly, elements overlapping, content jumbled in iframe (INSERTED) (completed 2026-03-30)
- [x] **Phase 124: Visual Fidelity** - Dialog/modal mirroring, CSS animation replication, rAF-synced mutation batching, computed style capture (completed 2026-03-30)
- [x] **Phase 125: Remote Control** - Click/type/scroll through preview to control the real browser, plus task stop button (completed 2026-03-31)

### Phase Details (v0.9.9.1)

### Phase 122: Connection & Auto-Start
**Goal**: Dashboard shows a live preview of the user's browser from the moment WebSocket connects, with no dead state and automatic recovery
**Depends on**: Nothing (first phase of milestone; builds on Phase 44 DOM Cloning Stream infrastructure)
**Requirements**: CONN-01, CONN-02, CONN-03, CONN-04
**Success Criteria** (what must be TRUE):
  1. User opens dashboard and sees a live browser preview within seconds of WebSocket handshake -- no "Connecting to browser..." dead state
  2. User can navigate to different pages in their browser and the preview updates continuously, even when no automation task is running
  3. If the user's internet drops and reconnects, the preview recovers automatically with a fresh full snapshot
  4. A status badge in the preview container shows green/yellow/red for connected/buffering/disconnected
**Plans**: 2 plans
Plans:
- [ ] 122-01-PLAN.md -- Extension-side active tab tracking, stream-aware forwarding, decouple stream from task lifecycle
- [ ] 122-02-PLAN.md -- Dashboard auto-start on page-ready, toggle button, recovery logic, status badge enhancement

### Phase 122.1: Stream Overlay Fix (INSERTED)
**Goal**: The orange glow highlighting the element FSB is interacting with appears in the dashboard DOM stream preview during automation
**Depends on**: Phase 122
**Requirements**: FIDELITY-01 (partial -- glow overlay only)
**Success Criteria** (what must be TRUE):
  1. When FSB targets an element during automation, the orange glow rect appears on the corresponding element in the dashboard preview
  2. The glow follows element changes as FSB moves between targets
  3. The glow disappears when no element is actively targeted
**Plans**: 1 plan

### Phase 122.2: Stop Signal & Final Outcome (INSERTED)
**Goal**: Dashboard stop button halts FSB automation, and task completion/failure result is relayed back to the dashboard
**Depends on**: Phase 122
**Success Criteria** (what must be TRUE):
  1. Clicking Stop Task on the dashboard stops the running automation in the extension
  2. Task completion (success or failure) updates the dashboard UI with the final result
  3. Dashboard shows the correct final state (success summary or error message) after task ends
**Plans**: 2 plans
Plans:
- [x] 122.2-01-PLAN.md -- Rewire stop signal to handleStopAutomation, completion relay on all exit paths, dashboard stopped state display
- [x] 122.2-02-PLAN.md -- Gap closure: idempotency guards, resolve executeAutomationTask on stop, single ext:task-complete delivery

### Phase 122.3: WS Payload Compression (INSERTED)
**Goal**: DOM stream snapshots and task results reliably reach the dashboard by compressing WS payloads client-side before sending through the relay
**Depends on**: Phase 122
**Success Criteria** (what must be TRUE):
  1. DOM stream snapshots (100KB+) arrive at the dashboard and render in the preview iframe
  2. ext:task-complete messages arrive at the dashboard and update the task UI state
  3. Compression is transparent -- dashboard decompresses automatically, no relay changes needed
**Plans**: 1 plan
Plans:
- [x] 122.3-01-PLAN.md -- Vendor lz-string, compress in ws-client.js send(), decompress in dashboard.js ws.onmessage

### Phase 123: Layout Modes
**Goal**: User can view the live preview in the size and mode that fits their workflow -- from inline thumbnail to fullscreen takeover
**Depends on**: Phase 122
**Requirements**: LAYOUT-01, LAYOUT-02, LAYOUT-03, LAYOUT-04, LAYOUT-05
**Success Criteria** (what must be TRUE):
  1. User clicks a maximize button and the preview expands to fill the full dashboard content area; clicks minimize and it shrinks back to inline thumbnail
  2. Preview container aspect ratio dynamically matches the actual browser viewport (e.g., 1920x1080 becomes 16:9, 1280x800 becomes 16:10) rather than being fixed
  3. User can pop the preview into a floating draggable window (picture-in-picture) that stays on top while using other dashboard tabs
  4. User can enter fullscreen mode where the preview fills the entire screen, and press Escape to exit back to normal layout
**UI hint**: yes

### Phase 123.1: Stream Fidelity Fix (INSERTED)
**Goal**: DOM clone renders complex sites (Google, YouTube, etc.) with correct layouts -- all CSS loads, elements don't overlap, content matches the original page structure
**Depends on**: Phase 123
**Success Criteria** (what must be TRUE):
  1. Google search results page renders in the preview with correct layout (no overlapping text, proper grid/flex positioning)
  2. External stylesheets from CDNs load correctly in the sandboxed iframe
  3. Inline computed styles preserve element positioning, sizing, and layout properties
**Plans**: 0 plans (not yet planned)

### Phase 124: Visual Fidelity
**Goal**: The cloned preview is a pixel-accurate mirror of the real browser -- dialogs, animations, and computed styles all appear correctly
**Depends on**: Phase 122
**Requirements**: FIDELITY-01, FIDELITY-02, FIDELITY-03, FIDELITY-04
**Success Criteria** (what must be TRUE):
  1. When an alert/confirm dialog or modal overlay appears in the real browser, the user sees it rendered in the dashboard preview
  2. CSS transitions (e.g., hover effects, slide-ins) and keyframe animations (e.g., spinners, progress bars) play in the preview matching the real browser
  3. DOM mutations arrive at the preview in smooth batches synced to requestAnimationFrame, with no visible jank or stale frames
  4. Elements in the preview have correct colors, fonts, sizes, and spacing because inline computed styles are captured during serialization
**Plans**: 2 plans
Plans:
- [ ] 124-01-PLAN.md -- Full computed style capture, rAF mutation batching, live iframe rendering in dom-stream.js
- [ ] 124-02-PLAN.md -- Native dialog interception pipeline (page script, content relay, WS forwarding, dashboard card rendering)
**UI hint**: yes

### Phase 125: Remote Control
**Goal**: User can interact with the real browser by clicking, typing, and scrolling directly in the dashboard preview
**Depends on**: Phase 122, Phase 123
**Requirements**: CONTROL-01, CONTROL-02, CONTROL-03, CONTROL-04
**Success Criteria** (what must be TRUE):
  1. User clicks a button in the preview and the corresponding button in the real browser receives the click (verified by seeing the page change in the preview)
  2. User clicks an input field in the preview and types text that appears in the real browser's input field
  3. User scrolls the preview (mousewheel or trackpad) and the real browser page scrolls accordingly
  4. User can click a stop button on the preview overlay to halt a running automation task
**Plans**: 2 plans
Plans:
- [x] 125-01-PLAN.md -- Extension-side WS message routing and CDP dispatch for remote click, key, and scroll events
- [ ] 125-02-PLAN.md -- Dashboard toggle button, transparent overlay, event capture, coordinate reverse-scaling, and WS forwarding
**UI hint**: yes

---

### v0.9.9.1 Phantom Stream Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 122. Connection & Auto-Start | 0/2 | Planned | - |
| 122.2. Stop Signal & Final Outcome | 2/2 | Complete   | 2026-03-31 |
| 122.3. WS Payload Compression | 1/1 | Complete   | 2026-03-31 |
| 123. Layout Modes | 1/2 | In progress | - |
| 124. Visual Fidelity | 0/2 | Complete    | 2026-03-30 |
| 125. Remote Control | 1/2 | Complete    | 2026-03-31 |
