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
- v0.9.8.1 npm Publishing (shipped 2026-04-01)
- v0.9.9.1 Phantom Stream (shipped 2026-03-31)
- v0.9.11 MCP Tool Quality (shipped 2026-03-31) -- [archive](milestones/v0.9.11-ROADMAP.md)
- v0.9.20 Autopilot Agent Architecture Rewrite (shipped 2026-04-02) -- [archive](milestones/v0.9.20-ROADMAP.md)
- v0.9.21 UI Retouch & Cohesion (in progress)
- v0.9.22 Showcase High-Fidelity Replicas (in progress)

---

## v0.9.8.1 npm Publishing

**Milestone Goal:** Publish the FSB MCP server as an npm package so users can install it with a single `npx` command instead of cloning the repo.

### Phases (v0.9.8.1)

- [x] **Phase 105: Package & Distribution** - npm-ready package with metadata, build pipeline, CI publish, and npx installation (completed 2026-03-24)
- [x] **Phase 106: Documentation** - README with FSB branding, MCP client config examples, and full tool reference (completed 2026-04-01)

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
| 106. Documentation | 0/0 | Complete | 2026-04-01 |

---

## v0.9.9.1 Phantom Stream

**Milestone Goal:** Make the dashboard DOM stream fully functional -- auto-connect on WebSocket, full-fidelity live preview with viewport-adaptive resize, display-matched frame rate, and remote browser control from the dashboard.

### Phases (v0.9.9.1)

- [x] **Phase 122: Connection & Auto-Start** - Stream starts on WS connect, stays alive between tasks, recovers from disconnects, shows health status (completed 2026-03-29)
- [x] **Phase 122.1: Stream Overlay Fix** - Fix glow overlay not appearing in DOM stream preview during automation (INSERTED) (completed 2026-03-29)
- [x] **Phase 122.2: Stop Signal & Final Outcome** - Dashboard stop button doesn't halt FSB automation, and task completion/failure result not relayed back to dashboard (INSERTED) (completed 2026-03-31)
- [x] **Phase 122.3: WS Payload Compression** - DOM stream snapshots and task results reliably reach dashboard by compressing WS payloads client-side before sending through relay (INSERTED) (completed 2026-03-31)
- [x] **Phase 122.4: Dashboard Relay Fix** - End-to-end investigation and fix for dashboard not receiving task results, stream not rendering, and relay message delivery failures (INSERTED) (completed 2026-03-31)
- [x] **Phase 123: Layout Modes** - Maximize/minimize toggle, viewport-adaptive resize, picture-in-picture, fullscreen preview (completed 2026-03-31)
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
- [x] 122-01-PLAN.md -- Extension-side active tab tracking, stream-aware forwarding, decouple stream from task lifecycle
- [x] 122-02-PLAN.md -- Dashboard auto-start on page-ready, toggle button, recovery logic, status badge enhancement

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
- [x] 124-01-PLAN.md -- Full computed style capture, rAF mutation batching, live iframe rendering in dom-stream.js
- [x] 124-02-PLAN.md -- Native dialog interception pipeline (page script, content relay, WS forwarding, dashboard card rendering)
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
- [x] 125-02-PLAN.md -- Dashboard toggle button, transparent overlay, event capture, coordinate reverse-scaling, and WS forwarding
**UI hint**: yes

</details>

---

### v0.9.9.1 Phantom Stream Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 122. Connection & Auto-Start | 2/2 | Complete | 2026-03-29 |
| 122.1. Stream Overlay Fix | 1/1 | Complete | 2026-03-29 |
| 122.2. Stop Signal & Final Outcome | 2/2 | Complete | 2026-03-31 |
| 122.3. WS Payload Compression | 1/1 | Complete | 2026-03-31 |
| 122.4. Dashboard Relay Fix | 1/1 | Complete | 2026-03-31 |
| 123. Layout Modes | 2/2 | Complete | 2026-03-31 |
| 123.1. Stream Fidelity Fix | 1/1 | Complete | 2026-03-30 |
| 124. Visual Fidelity | 2/2 | Complete | 2026-03-30 |
| 125. Remote Control | 2/2 | Complete | 2026-03-31 |

---

## v0.9.21 UI Retouch & Cohesion

**Milestone Goal:** Retouch the existing FSB UI so the sidepanel, popup, control panel, dashboard, and automation highlight feedback feel cohesive, polished, and precise without changing the product's overall aesthetic direction.

### Phases (v0.9.21)

- [x] **Phase 140: Shared Surface Audit & Design Corrections** - Normalize shared visual primitives, remove cross-surface styling drift, and define the retouch baseline without redesigning FSB (completed 2026-04-02)
- [x] **Phase 141: Sidepanel & Popup Retouch** - Polish the operator-facing chat surfaces, including header states, history/composer treatments, and shared action controls (completed 2026-04-02)
- [ ] **Phase 142: Control Panel & Dashboard Retouch** - Polish settings and monitoring surfaces by fixing layout drift, card inconsistencies, and awkward responsive states
- [ ] **Phase 143: Context-Aware Overlay Feedback** - Refine automation highlight feedback so links/text and larger controls get more precise, visually appropriate target emphasis
- [ ] **Phase 144: UI Sweep & Regression Cleanup** - Perform a final consistency pass across touched surfaces to remove leftover polish issues and prevent UI regressions

### Phase Details (v0.9.21)

### Phase 140: Shared Surface Audit & Design Corrections
**Goal**: Shared UI building blocks look and feel consistent across audited FSB surfaces while preserving the existing brand aesthetic
**Depends on**: Nothing (first phase of milestone)
**Requirements**: COH-01, COH-02, COH-03
**Success Criteria** (what must be TRUE):
  1. Shared buttons, badges, cards, headers, and status indicators follow one visual treatment across popup, sidepanel, control panel, and dashboard
  2. The retouch keeps FSB's existing tone and color direction rather than introducing a different visual language
  3. Audited surfaces no longer show obvious spacing, sizing, or typographic drift in their default states
**Plans**: 2 plans
Plans:
- [x] 140-01-PLAN.md -- Audit repeated UI primitives and define the retouch baseline across shared surfaces
- [x] 140-02-PLAN.md -- Implement shared style corrections for buttons, cards, badges, spacing, and core surface chrome

### Phase 141: Sidepanel & Popup Retouch
**Goal**: The sidepanel and popup feel like polished versions of the same product surface, with cleaner hierarchy, spacing, and state feedback
**Depends on**: Phase 140
**Requirements**: SID-01, SID-02, POP-01, POP-02
**Success Criteria** (what must be TRUE):
  1. Sidepanel header, history view, composer, and footer present a cleaner, more consistent hierarchy with no clipped or awkward states
  2. Popup controls, status display, and composer styling align with the sidepanel where patterns are shared
  3. Hover, active, disabled, and busy states on buttons and controls feel deliberate instead of visually inconsistent
  4. High-frequency chat interactions look polished without changing existing behavior
**Plans**: 2 plans
Plans:
- [x] 141-01-PLAN.md -- Retouch sidepanel layout, header/actions, history surface, and chat composer states
- [x] 141-02-PLAN.md -- Align popup hierarchy and shared control styling with the sidepanel retouch baseline

### Phase 142: Control Panel & Dashboard Retouch
**Goal**: Settings and monitoring surfaces feel cohesive with the rest of FSB while fixing visual noise, card drift, and awkward responsive composition
**Depends on**: Phase 140
**Requirements**: CP-01, CP-02, DSH-01
**Success Criteria** (what must be TRUE):
  1. Control panel navigation, headers, cards, forms, analytics, and utility sections use a consistent visual system
  2. Settings and dashboard areas no longer show broken spacing, mismatched surfaces, or low-quality responsive behavior
  3. The showcase dashboard keeps the same FSB aesthetic while feeling more polished and internally consistent
**Plans**: 2 plans
Plans:
- [ ] 142-01-PLAN.md -- Retouch control panel navigation, content sections, cards, forms, and settings composition
- [ ] 142-02-PLAN.md -- Retouch showcase dashboard controls, task surfaces, preview chrome, and responsive polish issues

### Phase 143: Context-Aware Overlay Feedback
**Goal**: Automation highlight feedback looks precise and appropriate for the target type rather than relying on one padded rectangle treatment
**Depends on**: Phase 140
**Requirements**: OVR-01, OVR-02, OVR-03
**Success Criteria** (what must be TRUE):
  1. Link and inline text targets can be emphasized in a way that reads like text highlighting rather than an oversized field box
  2. Larger controls such as inputs and buttons still receive clear, well-fitted target overlays
  3. The highlight animation remains smooth and consistent in both the live page and dashboard DOM stream
**Plans**: 2 plans
Plans:
- [ ] 143-01-PLAN.md -- Redesign highlight target selection and presentation rules for text-centric versus control-centric targets
- [ ] 143-02-PLAN.md -- Implement and verify overlay animation, positioning, and DOM stream parity for the new highlight behavior

### Phase 144: UI Sweep & Regression Cleanup
**Goal**: The milestone ends with a visible quality uplift across all touched surfaces and no obvious regressions from the retouch
**Depends on**: Phase 141, Phase 142, Phase 143
**Requirements**: QA-01, QA-02
**Success Criteria** (what must be TRUE):
  1. All touched UI surfaces remain fully usable after the retouch with no interaction or theme regressions
  2. Obvious visual inconsistencies and low-quality states identified during the milestone are resolved before ship
  3. The final UI pass feels cohesive across extension and dashboard surfaces rather than like isolated one-off fixes
**Plans**: 1 plan
Plans:
- [ ] 144-01-PLAN.md -- Run a full UI consistency sweep, close polish gaps, and fix regressions across touched surfaces

---

### v0.9.21 UI Retouch & Cohesion Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 140. Shared Surface Audit & Design Corrections | 2/2 | Complete   | 2026-04-02 |
| 141. Sidepanel & Popup Retouch | 2/2 | Complete   | 2026-04-02 |
| 142. Control Panel & Dashboard Retouch | 0/2 | Not started | - |
| 143. Context-Aware Overlay Feedback | 0/2 | Not started | - |
| 144. UI Sweep & Regression Cleanup | 0/1 | Not started | - |

---

## v0.9.22 Showcase High-Fidelity Replicas

**Milestone Goal:** Replace the outdated "See It in Action" renders on the showcase site with pixel-accurate HTML/CSS/JS replicas of the real sidepanel, control panel (options.html), and MCP-in-Claude-Code examples.

### Phases (v0.9.22)

- [x] **Phase 145: Fresh UI Audit & Token Baseline** - Audit current extension UI state and establish exact color token mappings for all replicas (completed 2026-04-02)
- [ ] **Phase 146: Sidepanel Replica** - Pixel-accurate recreation of the real sidepanel Chat view in the showcase
- [ ] **Phase 147: Control Panel Replica** - Pixel-accurate recreation of the real control panel Dashboard view in the showcase
- [ ] **Phase 148: MCP Terminal Examples** - Claude Code-styled terminal blocks showing autopilot and manual mode MCP usage
- [ ] **Phase 149: Final Verification & Sync Comments** - Side-by-side fidelity check and version-stamped sync comments for drift detection

### Phase Details (v0.9.22)

### Phase 145: Fresh UI Audit & Token Baseline
**Goal**: Every replica built in this milestone starts from an accurate, verified snapshot of the current extension UI -- not stale assumptions or outdated CSS values
**Depends on**: Nothing (first phase of milestone)
**Requirements**: AUD-01
**Success Criteria** (what must be TRUE):
  1. A documented audit of the current sidepanel.css and options.css color tokens, font sizes, border radii, and shadows exists as the reference for all subsequent phases
  2. The existing rec- CSS variable namespace has been mapped against real extension values, and every stale value is identified with its correct replacement
  3. Structural gaps between the current about.html recreation HTML and the real extension HTML are enumerated (missing elements, wrong icons, incorrect hierarchy)
**Plans**: 1 plan
Plans:
- [x] 145-01-PLAN.md -- Audit real CSS tokens, fix stale rec- variables, enumerate structural HTML gaps

### Phase 146: Sidepanel Replica
**Goal**: Visitors see a showcase sidepanel that is visually indistinguishable from the real FSB sidepanel Chat view in both dark and light themes
**Depends on**: Phase 145
**Requirements**: SP-01, SP-02, SP-03
**Success Criteria** (what must be TRUE):
  1. The showcase sidepanel replica matches the real sidepanel header (FSB title, status dot, history/new-chat/settings icon buttons), all message bubble types (user/ai/system/action/error), input bar with mic button and model selector, and footer text
  2. Switching the showcase theme toggle between dark and light renders the sidepanel replica with accurate color tokens from sidepanel.css in both modes
  3. Scrolling the sidepanel replica into view triggers an animated message cascade using the existing IntersectionObserver pattern
  4. No visual element from the real sidepanel Chat view is missing or obviously wrong in the replica
**Plans**: TBD
**UI hint**: yes

### Phase 147: Control Panel Replica
**Goal**: Visitors see a showcase control panel that is visually indistinguishable from the real FSB options.html Dashboard view in both dark and light themes
**Depends on**: Phase 145
**Requirements**: CP-01, CP-02, CP-03
**Success Criteria** (what must be TRUE):
  1. The showcase control panel replica matches the real Dashboard view: sidebar nav (8 items with correct icons including fa-brain for Memory and fa-server for Background Agents), analytics hero cards, SVG line chart, and session history cards with status badges
  2. Switching the showcase theme toggle between dark and light renders the control panel replica with accurate warm-gray tokens from options.css and fsb-ui-core.css in both modes
  3. Scrolling the control panel replica into view triggers animated counters and SVG chart line draw
  4. No visual element from the real Dashboard view is missing or obviously wrong in the replica
**Plans**: TBD
**UI hint**: yes

### Phase 148: MCP Terminal Examples
**Goal**: Visitors see realistic Claude Code terminal sessions demonstrating FSB MCP tools in action -- showing both autopilot and manual orchestration flows
**Depends on**: Nothing (independent of sidepanel/control panel replicas; can run after Phase 145 for color consistency but has no hard dependency)
**Requirements**: MCP-01, MCP-02, MCP-03
**Success Criteria** (what must be TRUE):
  1. An autopilot terminal block shows a run_task command with realistic progress output lines and a completion summary, styled as a Claude Code terminal session
  2. A manual mode terminal block shows a multi-tool orchestration flow (read_page + click + type_text sequence) with tool-use blocks and result blocks, styled as a Claude Code terminal session
  3. Both terminal blocks use accurate Claude Code dark theme colors, monospace typography, and semantic CSS classes (not inline styles)
  4. Terminal blocks trigger a typing animation on scroll using IntersectionObserver following the existing recreations.js IIFE pattern
**Plans**: TBD
**UI hint**: yes

### Phase 149: Final Verification & Sync Comments
**Goal**: All replicas pass a side-by-side fidelity check against the real extension and are stamped with version metadata for future drift detection
**Depends on**: Phase 146, Phase 147, Phase 148
**Requirements**: AUD-02, AUD-03
**Success Criteria** (what must be TRUE):
  1. A side-by-side comparison of each replica against the real extension in both dark and light themes shows no obvious visual discrepancies
  2. Each replica section in about.html includes a version-stamped sync comment (e.g., <!-- Replica of: ui/sidepanel.html | Last synced: v0.9.22 -->) for future drift detection
  3. Accessibility attributes (role="img", aria-label, aria-hidden="true" on internals) are present on all replica containers
**Plans**: TBD

---

### v0.9.22 Showcase High-Fidelity Replicas Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 145. Fresh UI Audit & Token Baseline | 1/1 | Complete   | 2026-04-02 |
| 146. Sidepanel Replica | 0/? | Not started | - |
| 147. Control Panel Replica | 0/? | Not started | - |
| 148. MCP Terminal Examples | 0/? | Not started | - |
| 149. Final Verification & Sync Comments | 0/? | Not started | - |

---

## v0.9.20 Autopilot Agent Architecture Rewrite

**Milestone Goal:** Replace the custom iteration loop + CLI text parsing autopilot with a native tool_use agent loop -- the same pattern Claude Code, Computer Use API, and MCP clients all use.

### Phase 138: Context Management & On-Demand Tools
**Goal**: The AI fetches page context and site intelligence only when needed, conversation history stays within token budget, and the user sees live progress and cost
**Depends on**: Phase 137
**Requirements**: CTX-01, CTX-02, CTX-03, CTX-04, PROG-01, PROG-02, PROG-03
**Plans**: 2 plans
Plans:
- [x] 138-01-PLAN.md -- Register 3 on-demand tools, local interception in agent loop, sliding-window history compression, Anthropic prompt caching
- [x] 138-02-PLAN.md -- Progress overlay enrichment with cost display, AI reasoning fields, dashboard broadcast wiring

### Phase 139: Dead Code Removal & Polish
**Goal**: All legacy autopilot infrastructure is removed after the new agent loop is proven stable, leaving a cleaner codebase with ~3,100 fewer lines
**Depends on**: Phase 138
**Requirements**: CLN-01, CLN-02, CLN-03, CLN-04
**Plans**: 2 plans
Plans:
- [x] 139-01-PLAN.md -- Rewire executeAutomationTask to call runAgentLoop, making startAutomationLoop fully dead code
- [x] 139-02-PLAN.md -- Delete startAutomationLoop, completion validators, prefetchDOM, and supporting dead code

### Phase 139.1: ai-integration.js Dead Code Cleanup (GAP CLOSURE)
**Goal**: Remove all remaining dead code from ai-integration.js and options.js left after Phase 139, achieving full CLN-01 and CLN-02 satisfaction
**Depends on**: Phase 139
**Requirements**: CLN-01, CLN-02
**Gap Closure**: Closes gaps from v0.9.20 milestone audit
**Success Criteria** (what must be TRUE):
  1. CLI_COMMAND_TABLE, TASK_PROMPTS, buildPrompt, buildMinimalUpdate, and all related constants/methods are deleted from ai-integration.js
  2. No remaining references to parseCliResponse in ai-integration.js
  3. CLIValidator references removed from options.js
  4. grep for CLI_COMMAND_TABLE, TASK_PROMPTS, buildPrompt, parseCliResponse returns zero matches in active codebase
**Plans**: 1 plan
Plans:
- [ ] 139.1-01-PLAN.md -- Delete dead code from ai-integration.js (~760 lines) and CLI validation section from options.js (~430 lines)

### v0.9.20 Autopilot Agent Architecture Rewrite Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 135. Provider Format Adapters & Tool Registry | 2/2 | Complete | 2026-04-01 |
| 136. Unified Tool Executor & MCP Migration | 2/2 | Complete | 2026-04-01 |
| 137. Agent Loop Core & Safety Mechanisms | 2/2 | Complete | 2026-04-01 |
| 138. Context Management & On-Demand Tools | 2/2 | Complete | 2026-04-01 |
| 139. Dead Code Removal & Polish | 2/2 | Complete | 2026-04-01 |
| 139.1. ai-integration.js Dead Code Cleanup | 1/1 | Complete | 2026-04-01 |
| 139.2. Fill Sheet Case Fix & Autopilot Sheets | 1/1 | Complete | 2026-04-02 |
| 139.3. Agent Loop Session Logging | 0/? | Not started | - |
