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
- v0.9.9.1 Phantom Stream (in progress, parallel)
- v0.9.11 MCP Tool Quality (current)

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
- [x] **Phase 122.4: Dashboard Relay Fix** - End-to-end investigation and fix for dashboard not receiving task results, stream not rendering, and relay message delivery failures (INSERTED) (completed 2026-03-31)
- [ ] **Phase 123: Layout Modes** - Maximize/minimize toggle, viewport-adaptive resize, picture-in-picture, fullscreen preview
- [x] **Phase 123.1: Stream Fidelity Fix** - DOM clone has broken layouts on complex sites -- CSS not loading properly, elements overlapping, content jumbled in iframe (INSERTED) (completed 2026-03-30)
- [x] **Phase 124: Visual Fidelity** - Dialog/modal mirroring, CSS animation replication, rAF-synced mutation batching, computed style capture (completed 2026-03-30)
- [x] **Phase 125: Remote Control** - Click/type/scroll through preview to control the real browser, plus task stop button (completed 2026-03-31)

<details>
<summary>Phase Details (v0.9.9.1)</summary>

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

### Phase 122.4: Dashboard Relay Fix (INSERTED)
**Goal**: End-to-end investigation and fix for dashboard not receiving task results, stream not rendering, and relay message delivery failures
**Depends on**: Phase 122.3
**Success Criteria** (what must be TRUE):
  1. Dashboard preview shows live browser content (not stuck on "Connecting to browser...")
  2. Task completion result (success summary or error) appears in dashboard UI after task finishes
  3. All WS message types (ext:dom-snapshot, ext:task-complete, ext:task-progress) reliably reach dashboard
  4. Compressed _lz envelope messages are correctly decompressed and processed by dashboard
**Plans**: 1 plan
Plans:
- [x] 122.4-01-PLAN.md -- automationComplete .catch guards, startDashboardTask fallback timer, curated computed styles, overlay throttle

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

</details>

---

### v0.9.9.1 Phantom Stream Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 122. Connection & Auto-Start | 0/2 | Planned | - |
| 122.2. Stop Signal & Final Outcome | 2/2 | Complete   | 2026-03-31 |
| 122.3. WS Payload Compression | 1/1 | Complete    | 2026-03-31 |
| 122.4. Dashboard Relay Fix | 1/1 | Complete   | 2026-03-31 |
| 123. Layout Modes | 1/2 | In progress | - |
| 124. Visual Fidelity | 0/2 | Complete    | 2026-03-30 |
| 125. Remote Control | 1/2 | Complete    | 2026-03-31 |

---

## v0.9.11 MCP Tool Quality

**Milestone Goal:** Fix the 7 systemic MCP tool issues discovered during the 30-site audit so manual-mode browsing works reliably on any website.

### Phases (v0.9.11)

- [ ] **Phase 126: Content Extraction Reliability** - read_page auto-waits for DOM stability, prioritizes main content, caps output intelligently
- [ ] **Phase 127: BF Cache Resilience** - Click survives page transitions via proactive content script re-injection and port recovery
- [ ] **Phase 128: Viewport-Aware Interaction** - Click/hover scroll elements into view accounting for fixed headers, verify visibility before acting
- [ ] **Phase 129: Smart Enter Fallback** - press_enter auto-clicks submit button when Enter key has no effect on the form
- [ ] **Phase 130: Cookie Consent Auto-Dismiss** - Detect and dismiss cookie consent overlays proactively before they block interaction tools
- [ ] **Phase 131: Site-Aware Search** - Search tool uses site's own search input instead of always redirecting to Google

### Phase Details (v0.9.11)

### Phase 126: Content Extraction Reliability
**Goal**: read_page returns meaningful, well-structured content from any website on the first call -- no separate stability wait, no 30K walls of text, no empty results from JS-heavy sites
**Depends on**: Nothing (first phase of milestone)
**Requirements**: CONT-01, CONT-02, CONT-03, CONT-04, CONT-05
**Success Criteria** (what must be TRUE):
  1. User calls read_page on a JS-heavy site (Airbnb, Booking.com, Kayak) and gets meaningful content without needing to call wait_for_stable first
  2. User calls read_page on a content-heavy page (LeetCode problem, Wikipedia article) and receives the main content area prioritized over sidebar/nav/footer noise
  3. read_page output never exceeds ~8K chars -- long pages are intelligently truncated with main content preserved and a truncation notice appended
  4. On fast-loading sites, read_page returns immediately without unnecessary stability delays (quick-extract-then-retry only triggers when initial extraction is sparse)
**Plans**: 2 plans
Plans:
- [ ] 126-01-PLAN.md -- Main content prioritization, 8K char cap, full flag fix, MCP timeout increase
- [ ] 126-02-PLAN.md -- Quick-extract-then-retry-if-sparse DOM stability wrapper

### Phase 127: BF Cache Resilience
**Goal**: Click actions that cause page navigation return success with navigation info instead of cryptic BF cache errors, and the content script stays connected across back/forward transitions
**Depends on**: Nothing (independent of Phase 126; background.js changes only)
**Requirements**: NAV-01, NAV-02, NAV-03, NAV-04
**Success Criteria** (what must be TRUE):
  1. User clicks a link that navigates to a new page and the MCP tool returns a success response with navigation details (not a disconnection error)
  2. User presses browser Back button and then interacts with the restored page -- content script is alive and responds to tool calls without requiring a page refresh
  3. After a BF cache page restoration, the content script re-establishes its communication port with the background service worker automatically
  4. MCP caller receives an actionable response (success + URL change info, or clear error with recovery hint) from every click -- never an opaque "port disconnected" error
**Plans**: TBD

### Phase 128: Viewport-Aware Interaction
**Goal**: Click and hover work on any element regardless of its position on the page -- off-viewport elements are scrolled into the visible area accounting for fixed headers before interaction
**Depends on**: Nothing (independent; content script actions.js changes)
**Requirements**: INTR-01, INTR-02, INTR-04
**Success Criteria** (what must be TRUE):
  1. User clicks an element below the fold and it scrolls into view with enough clearance that fixed/sticky headers do not obscure it
  2. After scrolling an element into view, a visibility check (elementFromPoint) confirms the target element is actually exposed before the click fires
  3. Any element that get_text or get_attribute can access is also clickable and hoverable -- there is no class of "readable but not clickable" elements due to scroll position
**Plans**: TBD

### Phase 129: Smart Enter Fallback
**Goal**: press_enter reliably submits forms even when the Enter key has no effect -- automatically detecting and clicking the submit button as a fallback
**Depends on**: Nothing (surgical, independent of other phases)
**Requirements**: INTR-03
**Success Criteria** (what must be TRUE):
  1. User presses Enter on an Indeed/Amazon search form and the search submits successfully -- either via Enter key effect or automatic fallback to clicking the submit button
  2. The fallback only triggers when Enter key produces no observable effect (no navigation, no form submission, no DOM change) -- it does not interfere with forms where Enter works correctly
**Plans**: TBD

### Phase 130: Cookie Consent Auto-Dismiss
**Goal**: Cookie consent overlays are cleared proactively so they never block MCP tool interactions -- without accidentally dismissing login prompts, newsletter popups, or other non-cookie overlays
**Depends on**: Phase 128 (viewport-aware scroll needed for clicking dismiss buttons that may be off-viewport in consent banners)
**Requirements**: OVLY-01, OVLY-02, OVLY-03, OVLY-04
**Success Criteria** (what must be TRUE):
  1. User visits a GDPR-compliant EU site (e.g., BBC, Le Monde, Spiegel) and the cookie consent banner is dismissed automatically before any MCP tool interaction
  2. Cookie dismiss clicks the reject/decline/necessary-only button (not "Accept All") to minimize tracking
  3. A login prompt, newsletter signup popup, or paywall overlay on the same page is NOT dismissed -- only cookie consent overlays are targeted
  4. Cookie dismiss runs proactively before read_page and interaction tools, preventing the "invisible blocker" problem where the AI cannot see or work around the overlay
**Plans**: TBD

### Phase 131: Site-Aware Search
**Goal**: The search tool finds and uses the site's own search input on any website, falling back to Google only when no site search exists
**Depends on**: Phase 126 (stable read_page needed to verify search results), Phase 128 (viewport scroll needed if search input is off-screen), Phase 130 (cookie overlays must be cleared before interacting with search inputs)
**Requirements**: SRCH-01, SRCH-02, SRCH-03, SRCH-04
**Success Criteria** (what must be TRUE):
  1. User calls search on Amazon/YouTube/GitHub and the query is typed into the site's own search bar -- not redirected to Google
  2. The search tool detects the site's search input via deterministic DOM heuristics (input[type=search], [role=search], placeholder text matching) without AI calls
  3. After typing the query, the search form is submitted (via Enter key or submit button click) and the user sees site-native search results
  4. On a site with no search input (e.g., a static landing page), the search tool falls back to Google as a last resort and the user sees Google results for the query
**Plans**: TBD

---

### v0.9.11 MCP Tool Quality Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 126. Content Extraction Reliability | 0/2 | Planned | - |
| 127. BF Cache Resilience | 0/? | Not started | - |
| 128. Viewport-Aware Interaction | 0/? | Not started | - |
| 129. Smart Enter Fallback | 0/? | Not started | - |
| 130. Cookie Consent Auto-Dismiss | 0/? | Not started | - |
| 131. Site-Aware Search | 0/? | Not started | - |
