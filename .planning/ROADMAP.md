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
- v0.9.11 MCP Tool Quality (shipped 2026-03-31) -- [archive](milestones/v0.9.11-ROADMAP.md)
- v0.9.12 MCP Developer Experience (in progress)
- v0.9.20 Autopilot Agent Architecture Rewrite (in progress)

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

## v0.9.12 MCP Developer Experience

**Milestone Goal:** Make every FSB MCP tool self-documenting so any AI connecting via MCP can use the tools effectively without reading source code -- through enriched tool descriptions, discoverable MCP prompts, and actionable error recovery hints.

### Phases (v0.9.12)

- [ ] **Phase 132: Tool Description Enrichment** - Every tool description includes usage context hints, related tool references, accurate behavior descriptions, and parameter examples
- [ ] **Phase 133: MCP Prompts** - Discoverable prompts registered via server.prompt() that teach the read-then-act workflow and provide a categorized tool reference
- [ ] **Phase 134: Error Recovery Hints** - Tool failures include actionable recovery suggestions, and descriptions document fallback tools for common failure scenarios

### Phase Details (v0.9.12)

### Phase 132: Tool Description Enrichment
**Goal**: An AI reading any FSB tool's MCP description knows when to use it, what tools to combine it with, and how to fill in each parameter -- without needing external documentation
**Depends on**: Nothing (first phase of milestone)
**Requirements**: DESC-01, DESC-02, DESC-03, DESC-04
**Success Criteria** (what must be TRUE):
  1. Every tool description contains a "When to use" sentence that distinguishes it from similar tools (e.g., click vs click_at vs cdp_click_at)
  2. Every tool description references at least one related tool with a brief explanation of the relationship (e.g., "Use get_dom_snapshot first to find selectors")
  3. The search tool description accurately states it uses the site's own search bar (not Google redirect), matching the v0.9.11 behavior
  4. Every parameter with a non-obvious format includes a concrete example value in its description
**Plans**: TBD

### Phase 133: MCP Prompts
**Goal**: An MCP client can discover and invoke FSB prompts that teach the AI how to approach browser automation tasks, without the user having to explain the workflow
**Depends on**: Phase 132 (prompts reference tool names from enriched descriptions)
**Requirements**: PROMPT-01, PROMPT-02, PROMPT-03
**Success Criteria** (what must be TRUE):
  1. An MCP client listing prompts sees "browser-automation-guide" and "tool-reference" in the available prompts
  2. The "browser-automation-guide" prompt teaches the read-then-act pattern: call get_dom_snapshot, find the target element, then call the appropriate action tool
  3. The "tool-reference" prompt returns a categorized tool list (navigation, interaction, extraction, waiting) with usage examples and tool relationships
**Plans**: TBD

### Phase 134: Error Recovery Hints
**Goal**: When a tool call fails, the AI receives specific guidance on what to try next instead of a generic error message
**Depends on**: Phase 132 (error hints reference related tools already documented in descriptions)
**Requirements**: ERR-01, ERR-02
**Success Criteria** (what must be TRUE):
  1. When click fails on a selector, the error response includes a hint like "Element not found -- try get_dom_snapshot to refresh selectors, or use click_at with viewport coordinates"
  2. Tool descriptions for tools with common failure modes mention their fallback tools (e.g., click description mentions click_at as coordinate-based fallback)
**Plans**: TBD

---

### v0.9.12 MCP Developer Experience Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 132. Tool Description Enrichment | 1/1 | Complete | 2026-03-31 |
| 133. MCP Prompts | 1/1 | Complete | 2026-03-31 |
| 134. Error Recovery Hints | 1/1 | Complete | 2026-03-31 |

---

## v0.9.20 Autopilot Agent Architecture Rewrite

**Milestone Goal:** Replace the custom iteration loop + CLI text parsing autopilot with a native tool_use agent loop -- the same pattern Claude Code, Computer Use API, and MCP clients all use -- so the built-in autopilot performs at MCP-level speed and intelligence.

### Phases (v0.9.20)

- [x] **Phase 135: Provider Format Adapters & Tool Registry** - Canonical tool definitions in JSON Schema shared between autopilot and MCP, plus provider-specific format adapters for xAI/OpenAI, Anthropic, and Gemini (completed 2026-04-01)
- [ ] **Phase 136: Unified Tool Executor & MCP Migration** - Single executeTool() dispatch function replacing two parallel execution paths, with MCP server importing from shared registry
- [ ] **Phase 137: Agent Loop Core & Safety Mechanisms** - Native tool_use agent loop with setTimeout-chaining, cost circuit breaker, time limit, external stuck detection, and session persistence
- [ ] **Phase 138: Context Management & On-Demand Tools** - DOM snapshot and site guides as on-demand tools, sliding window history compression, progress reporting, and prompt caching
- [ ] **Phase 139: Dead Code Removal & Polish** - Remove ~3,100 lines of CLI parser, prompt templates, completion validator, and per-iteration DOM fetching

### Phase Details (v0.9.20)

### Phase 135: Provider Format Adapters & Tool Registry
**Goal**: All 42 browser tools are defined once in JSON Schema with routing metadata, and every supported AI provider can send/receive tool_use messages in its native format
**Depends on**: Nothing (first phase of milestone)
**Requirements**: PROV-01, PROV-02, PROV-03, PROV-04, PROV-05, PROV-06, TOOL-01, TOOL-02
**Success Criteria** (what must be TRUE):
  1. User can start an autopilot session with xAI Grok and the AI returns structured tool_use blocks (not CLI text) that the extension parses correctly
  2. User can switch to OpenAI, Anthropic, or Gemini and the same tool definitions produce valid tool_use responses from each provider
  3. Tool definitions exist in one file (tool-definitions.js) and include routing metadata indicating whether each tool runs in content script, CDP, background, or data layer
  4. OpenRouter and custom OpenAI-compatible endpoints work through the same adapter as xAI/OpenAI without additional code
**Plans**: 2 plans
Plans:
- [x] 135-01-PLAN.md -- Canonical tool registry (42 tools) in ai/tool-definitions.js with JSON Schema and routing metadata
- [x] 135-02-PLAN.md -- Provider format adapter in ai/tool-use-adapter.js with 5 functions for OpenAI/Anthropic/Gemini formats

### Phase 136: Unified Tool Executor & MCP Migration
**Goal**: Autopilot and MCP execute tools through the same code path, so a tool call produces identical results regardless of whether it came from the agent loop or an MCP client
**Depends on**: Phase 135
**Requirements**: TOOL-03, EXEC-01, EXEC-02, EXEC-03
**Success Criteria** (what must be TRUE):
  1. A single executeTool(name, params) function dispatches click, type, navigate, and all other tools to the correct handler -- same function called by both autopilot and MCP
  2. Every tool execution returns a structured result object with success/hadEffect/error/navigationTriggered fields that the AI can reason about
  3. Read-only tools (get_dom_snapshot, read_page, get_text) execute immediately without waiting for the mutation queue
  4. MCP server imports tool schemas from the shared tool-definitions.js registry instead of defining them inline with Zod
**Plans**: 2 plans
Plans:
- [ ] 136-01-PLAN.md -- Unified tool executor (ai/tool-executor.js) with executeTool dispatch and structured results
- [ ] 136-02-PLAN.md -- MCP schema migration: manual.ts, read-only.ts, queue.ts import from shared tool-definitions.js registry

### Phase 137: Agent Loop Core & Safety Mechanisms
**Goal**: User can run an autopilot task end-to-end using the native tool_use protocol, with the AI controlling iteration and safety mechanisms preventing runaway sessions
**Depends on**: Phase 135, Phase 136
**Requirements**: LOOP-01, LOOP-02, LOOP-03, LOOP-04, LOOP-05, SAFE-01, SAFE-02, SAFE-03, SAFE-04
**Success Criteria** (what must be TRUE):
  1. User types a task in the sidepanel and the autopilot executes it by sending messages with tool definitions, receiving tool_use blocks, executing them, and feeding tool_result back until the AI emits end_turn
  2. The session survives Chrome's 5-minute service worker kill because the loop uses setTimeout-chaining (not a blocking while-loop) and persists state after every iteration
  3. A session that exceeds $2 estimated cost or 10 minutes duration is automatically stopped with a clear message to the user
  4. When the AI makes 3+ consecutive tool calls that produce no DOM change, a recovery hint is injected into the next tool_result suggesting alternative approaches
  5. User can click the stop button in the sidepanel at any point and the automation halts within one iteration
**Plans**: TBD

### Phase 138: Context Management & On-Demand Tools
**Goal**: The AI fetches page context and site intelligence only when needed, conversation history stays within token budget, and the user sees live progress and cost
**Depends on**: Phase 137
**Requirements**: CTX-01, CTX-02, CTX-03, CTX-04, PROG-01, PROG-02, PROG-03
**Success Criteria** (what must be TRUE):
  1. The AI calls get_page_snapshot as a tool when it needs DOM context -- the system no longer auto-injects a snapshot every iteration
  2. The AI calls get_site_guide(domain) as a tool to fetch site-specific intelligence -- guides are no longer always injected into the system prompt
  3. On a 30+ step task, old tool_results are compacted when conversation history reaches 80% of the token budget, and the AI continues without losing critical context
  4. The progress overlay shows the current tool being executed, the AI's reasoning via report_progress, and the estimated session cost in real-time
**Plans**: TBD

### Phase 139: Dead Code Removal & Polish
**Goal**: All legacy autopilot infrastructure is removed after the new agent loop is proven stable, leaving a cleaner codebase with ~3,100 fewer lines
**Depends on**: Phase 137, Phase 138
**Requirements**: CLN-01, CLN-02, CLN-03, CLN-04
**Success Criteria** (what must be TRUE):
  1. cli-parser.js and CLI_COMMAND_TABLE are deleted and no remaining code references them
  2. The old buildPrompt/TASK_PROMPTS template system is deleted and the system prompt is a minimal ~1-2KB description
  3. The multi-signal completion validator is deleted and task completion is determined solely by the AI's stop_reason/end_turn signal
  4. Autopilot no longer fetches a DOM snapshot before every iteration -- the only DOM access is through the on-demand get_page_snapshot tool
**Plans**: TBD

---

### v0.9.20 Autopilot Agent Architecture Rewrite Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 135. Provider Format Adapters & Tool Registry | 2/2 | Complete    | 2026-04-01 |
| 136. Unified Tool Executor & MCP Migration | 0/2 | Planned | - |
| 137. Agent Loop Core & Safety Mechanisms | 0/? | Not started | - |
| 138. Context Management & On-Demand Tools | 0/? | Not started | - |
| 139. Dead Code Removal & Polish | 0/? | Not started | - |
