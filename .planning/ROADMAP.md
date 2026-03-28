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
- v0.9.8.1 npm Publishing (shipped 2026-03-27)
- v0.9.9 Excalidraw Mastery (shipped 2026-03-27)
- v0.9.10 Agent Intelligence (pending)

## v0.9.8.1 npm Publishing

**Milestone Goal:** Publish the FSB MCP server as an npm package so users can install it with a single `npx` command instead of cloning the repo.

### Phases (v0.9.8.1)

- [x] **Phase 105: Package & Distribution** - npm-ready package with metadata, build pipeline, CI publish, and npx installation (completed 2026-03-24)
- [x] **Phase 106: Documentation** - README with FSB branding, MCP client config examples, and full tool reference (completed 2026-03-27)

<details>
<summary>Phase Details (v0.9.8.1)</summary>

### Phase 105: Package & Distribution
**Goal**: Users can install and run the FSB MCP server via `npx -y fsb-mcp-server` without cloning the repo
**Depends on**: Nothing (first phase of milestone)
**Requirements**: PKG-01, PKG-02, PKG-03, PKG-04, DIST-01, DIST-02, DIST-03
**Success Criteria** (what must be TRUE):
  1. `npm pack --dry-run` shows only build output files and README (no source, no dev artifacts)
  2. `node build/index.js` runs successfully with the shebang present at line 1
  3. `npm run prepublishOnly` compiles TypeScript without errors
  4. GitHub Actions workflow triggers on release tag and publishes to npm registry
  5. `npx -y fsb-mcp-server` downloads and starts the MCP server on a clean machine
**Plans**: 2 plans
Plans:
- [x] 105-01-PLAN.md -- Package metadata, files whitelist, .npmignore, and prepublishOnly script
- [x] 105-02-PLAN.md -- GitHub Actions publish workflow and end-to-end local verification

### Phase 106: Documentation
**Goal**: Users can configure the FSB MCP server in their preferred MCP client by following the README
**Depends on**: Phase 105
**Requirements**: DOCS-01, DOCS-02, DOCS-03
**Success Criteria** (what must be TRUE):
  1. README.md in the mcp-server directory has FSB branding (logo, badges) and matches the main project style
  2. A user can copy-paste the Claude Desktop JSON config, the Claude Code CLI command, or the Cursor config and connect to the server
  3. All 42+ exposed MCP tools are listed in the README by category with brief descriptions
**Plans**: [to be planned]

</details>

---

## Current: v0.9.9 Excalidraw Mastery

**Milestone Goal:** Make FSB fully capable on Excalidraw -- every drawing tool, styling option, connector, alignment, export, and canvas operation works reliably, plus natural language diagram generation where FSB plans layouts autonomously from descriptions.

## Phases

- [x] **Phase 107: Engine Fixes & Session Foundation** - Fix gating bugs in progress detection and text entry routing, establish clean session setup (completed 2026-03-24)
- [x] **Phase 108: Drawing Primitives & Text Entry** - All shape types drawable, standalone and in-shape text entry via transient textarea (completed 2026-03-24)
- [x] **Phase 109: Canvas Operations** - Undo/redo, clear, zoom, pan, select all, zoom-to-fit (completed 2026-03-24)
- [x] **Phase 110: Element Editing** - Select, move, delete, duplicate, resize, rotate, group, lock, style copy (completed 2026-03-24)
- [x] **Phase 111: Connectors & Arrows** - Auto-binding arrows, elbow routing, arrowhead styles, labeled connectors (completed 2026-03-24)
- [x] **Phase 112: Styling & Layout** - Stroke/fill colors, width, style, fill pattern, opacity, fonts, alignment, distribution, layer ordering (completed 2026-03-24)
- [x] **Phase 113: Export** - PNG to clipboard, SVG export, clipboard copy (completed 2026-03-24)
- [x] **Phase 114: Natural Language Diagrams** - Flowcharts, architecture diagrams, mind maps from descriptions with grid-based layout (completed 2026-03-24)
- [x] **Phase 115: Canvas Vision** - Analyze and convert HTML5 canvas content into structured text so FSB can see what is drawn on any canvas-based app (completed 2026-03-27, human verification pending)

## Phase Details

### Phase 107: Engine Fixes & Session Foundation
**Goal**: FSB's automation loop survives multi-step Excalidraw sessions without aborting, and text entry reaches the canvas
**Depends on**: Nothing (first phase of milestone)
**Requirements**: ENGINE-01, ENGINE-02, ENGINE-03
**Success Criteria** (what must be TRUE):
  1. FSB runs a 10+ iteration Excalidraw session without the progress detector aborting for "no progress"
  2. Text typed during an Excalidraw session reaches the canvas via CDP direct path (not the broken type tool round-trip)
  3. Every new Excalidraw session starts with modals dismissed, canvas cleared, and zoom reset to default
**Plans**: 2 plans
Plans:
- [x] 107-01-PLAN.md -- Fix isCanvasEditorUrl and isCanvasBasedEditor for Excalidraw detection
- [x] 107-02-PLAN.md -- Add session setup sequence and text entry workflow to site guide

### Phase 108: Drawing Primitives & Text Entry
**Goal**: Users can draw any shape type and add text labels on the Excalidraw canvas through FSB automation
**Depends on**: Phase 107
**Requirements**: DRAW-01, DRAW-02, DRAW-03, DRAW-04, DRAW-05, DRAW-06, DRAW-07, TEXT-01, TEXT-02, TEXT-03
**Success Criteria** (what must be TRUE):
  1. User can ask FSB to draw a rectangle, ellipse, diamond, line, arrow, freedraw stroke, or frame and each appears on the canvas
  2. User can ask FSB to add a standalone text label at a specific canvas location and the text appears
  3. User can ask FSB to add text inside a shape (via double-click) and the text renders within the shape boundary
  4. User can ask FSB to edit existing text on a shape and the updated text replaces the original
  5. The Excalidraw site guide documents keyboard shortcuts, tool-key re-press rules, and the transient textarea workflow
**Plans**: 2 plans
Plans:
- [x] 108-01-PLAN.md -- Add drawing primitive workflows for all 7 shape types
- [x] 108-02-PLAN.md -- Expand text entry with standalone, in-shape, and edit workflows

### Phase 109: Canvas Operations
**Goal**: Users can control the Excalidraw canvas state -- undo, redo, clear, zoom, pan, select all
**Depends on**: Phase 108
**Requirements**: CANVAS-01, CANVAS-02, CANVAS-03, CANVAS-04, CANVAS-05, CANVAS-06
**Success Criteria** (what must be TRUE):
  1. User can ask FSB to undo and redo actions and the canvas state changes accordingly
  2. User can ask FSB to clear the canvas and all elements are removed
  3. User can ask FSB to zoom in, zoom out, reset zoom, and zoom to fit content
  4. User can ask FSB to pan the canvas and the viewport shifts
  5. User can ask FSB to select all elements and every element on canvas becomes selected
**Plans**: 1 plan
Plans:
- [x] 109-01-PLAN.md -- Add canvas operations guidance and workflows to Excalidraw site guide
### Phase 110: Element Editing
**Goal**: Users can manipulate existing elements on the Excalidraw canvas -- select, move, resize, rotate, duplicate, delete, group, lock, copy style
**Depends on**: Phase 109
**Requirements**: EDIT-01, EDIT-02, EDIT-03, EDIT-04, EDIT-05, EDIT-06, EDIT-07, EDIT-08
**Success Criteria** (what must be TRUE):
  1. User can ask FSB to select an element and move it to a new position on the canvas
  2. User can ask FSB to delete, duplicate, resize, or rotate an element and the result is visible
  3. User can ask FSB to group multiple elements and then ungroup them
  4. User can ask FSB to lock an element (preventing accidental moves) and unlock it
  5. User can ask FSB to copy the style from one element and paste it onto another
**Plans**: 1 plan
Plans:
- [x] 110-01-PLAN.md -- Add element editing guidance and workflow arrays to Excalidraw site guide

### Phase 111: Connectors & Arrows
**Goal**: Users can create connected, labeled arrows between shapes with routing and endpoint control
**Depends on**: Phase 110
**Requirements**: CONN-01, CONN-02, CONN-03, CONN-04
**Success Criteria** (what must be TRUE):
  1. User can ask FSB to draw an arrow from one shape to another and the arrow auto-binds to shape edges
  2. User can ask FSB to create an elbow (orthogonal) arrow between shapes
  3. User can ask FSB to change arrowhead styles (arrow, bar, dot, triangle, none) on existing arrows
  4. User can ask FSB to add a text label to an arrow or connector
**Plans**: 1 plan
Plans:
- [x] 111-01-PLAN.md -- Add connectors and arrows guidance to Excalidraw site guide

### Phase 112: Styling & Layout
**Goal**: Users can control the visual appearance and spatial arrangement of elements on the Excalidraw canvas
**Depends on**: Phase 111
**Requirements**: STYLE-01, STYLE-02, STYLE-03, STYLE-04, STYLE-05, STYLE-06, STYLE-07, ALIGN-01, ALIGN-02, ALIGN-03
**Success Criteria** (what must be TRUE):
  1. User can ask FSB to change stroke color, fill color, stroke width, stroke style, and fill pattern of any element
  2. User can ask FSB to change element opacity
  3. User can ask FSB to change font size, font family, and text alignment on text elements
  4. User can ask FSB to align multiple elements (left, right, top, bottom, center) and distribute them evenly
  5. User can ask FSB to change layer ordering (bring forward, send back, bring to front, send to back)
**Plans**: 1 plan
Plans:
- [x] 112-01-PLAN.md -- Add STYLING and ALIGNMENT AND LAYOUT sections to Excalidraw site guide
### Phase 113: Export
**Goal**: Users can export their Excalidraw drawings in common formats
**Depends on**: Phase 112
**Requirements**: EXPORT-01, EXPORT-02, EXPORT-03
**Success Criteria** (what must be TRUE):
  1. User can ask FSB to export the drawing as PNG to clipboard
  2. User can ask FSB to export the drawing as SVG
  3. User can ask FSB to copy the drawing to clipboard for pasting into other applications
**Plans**: 1 plan
Plans:
- [x] 113-01-PLAN.md -- Add EXPORT section with PNG clipboard, SVG export, and clipboard copy workflows

### Phase 114: Natural Language Diagrams
**Goal**: Users can describe a diagram in plain English and FSB autonomously plans layout, draws shapes, adds labels, and connects elements on Excalidraw
**Depends on**: Phase 113
**Requirements**: NL-01, NL-02, NL-03, NL-04, NL-05
**Success Criteria** (what must be TRUE):
  1. User can describe a flowchart (e.g., "draw a login flow with input, validation, success, and error states") and FSB produces a connected, labeled diagram
  2. User can describe an architecture diagram (e.g., "draw a 3-tier web app with frontend, API, and database") and FSB produces a connected, labeled diagram
  3. User can describe a mind map (e.g., "draw a mind map for project planning with 4 branches") and FSB produces a radial layout with labeled nodes
  4. Generated diagrams use consistent spacing (approximately 150px horizontal, 120px vertical) so shapes do not overlap or cluster
  5. Every shape and connector in a generated diagram has a text label
**Plans**: 1 plan
Plans:
- [x] 114-01-PLAN.md -- Add NATURAL LANGUAGE DIAGRAM GENERATION section with layout templates for flowcharts, architecture diagrams, and mind maps
## Progress

**Execution Order:** 107 -> 108 -> 109 -> 110 -> 111 -> 112 -> 113 -> 114 -> 115

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 107. Engine Fixes & Session Foundation | 2/2 | Complete    | 2026-03-24 |
| 108. Drawing Primitives & Text Entry | 2/2 | Complete    | 2026-03-24 |
| 109. Canvas Operations | 1/1 | Complete    | 2026-03-24 |
| 110. Element Editing | 1/1 | Complete    | 2026-03-24 |
| 111. Connectors & Arrows | 1/1 | Complete    | 2026-03-24 |
| 112. Styling & Layout | 1/1 | Complete    | 2026-03-24 |
| 113. Export | 1/1 | Complete    | 2026-03-24 |
| 114. Natural Language Diagrams | 1/1 | Complete    | 2026-03-24 |
| 115. Canvas Vision | 4/5 | Gap closure    | - |

### Phase 115: Canvas Vision
**Goal**: FSB can see what is drawn on HTML5 canvas elements by intercepting draw calls and converting them to structured text, enabling the AI to read, verify, and reason about canvas content on any Canvas 2D app
**Depends on**: Phase 114
**Requirements**: VISION-01, VISION-02, VISION-03, VISION-04, VISION-05, VISION-06, VISION-07
**Success Criteria** (what must be TRUE):
  1. A canvas-interceptor.js content script (world: MAIN, run_at: document_start) wraps Canvas 2D prototype methods and logs draw calls
  2. Draw call logs are summarized into structured text (texts, rectangles, paths) and appear in DOM snapshot markdown as a CANVAS SCENE section
  3. Already-loaded pages get a re-render trigger so interception captures existing content
  4. A pixel-based fallback (color grid + edge detection) works when interception is unavailable
  5. The AI can read canvas content on every iteration and use it to verify drawings or extract information
  6. Canvas vision works on at least 10 of 15 canvas apps in FSB scope
**Plans**: 5 plans
Plans:
- [x] 115-01-PLAN.md -- Canvas interceptor script (prototype wrapping, getCanvasScene, re-render trigger)
- [x] 115-02-PLAN.md -- Pixel fallback (color grid + edge detection via Runtime.evaluate)
- [x] 115-03-PLAN.md -- DOM snapshot integration (wire interceptor + fallback into markdown pipeline)
- [x] 115-04-PLAN.md -- Testing and validation (structural tests + manual Excalidraw verification)
- [ ] 115-05-PLAN.md -- Gap closure: CDP canvas element detection for generic canvas apps

---

### v0.9.8.1 npm Publishing Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 105. Package & Distribution | 2/2 | Complete   | 2026-03-24 |
| 106. Documentation | done | Complete   | 2026-03-27 |

---

## Next: v0.9.10 Agent Intelligence

**Milestone Goal:** Make FSB's background agents production-ready — expose agent management via MCP, fix cost tracking, add scheduling flexibility, improve replay intelligence, give agents a dedicated UI in the sidepanel, and close verification gaps from v0.9.6.

**Context:** v0.9.6 shipped the core agent infrastructure (manager, scheduler, executor, server sync, replay recording) plus the full remote dashboard (relay, QR pairing, DOM cloning, remote task control). The agent scaffolding works but has gaps: MCP clients can't manage agents, cost data is hardcoded, replay timing ignores recorded durations, and the only UI is buried in the options page. Phase 44 (DOM cloning) was never formally verified. This milestone closes all of those gaps.

### Phases (v0.9.10)

- [ ] **Phase 116: MCP Agent Tools** - Expose create/list/run/stop/delete agent operations as MCP tools so external clients (Claude Code, Cursor, etc.) can manage background agents
- [ ] **Phase 117: Cost & Metrics Pipeline** - Thread real token count and cost data from AI integration through executeAutomationTask into agent run history and recorded scripts
- [ ] **Phase 118: Scheduling Enhancements** - Add cron expression support, weekly schedules, retry-on-failure with exponential backoff, and persistent server sync queue
- [ ] **Phase 119: Replay Intelligence** - Use recorded original action durations for replay timing, add step-level error recovery (retry individual steps before full AI fallback), track replay success rates per step
- [ ] **Phase 120: Sidepanel Agents UI** - Dedicated Agents tab in sidepanel with agent list, status indicators, run history, create/edit form, and one-click run
- [ ] **Phase 121: DOM Cloning Verification** - Formal E2E verification of Phase 44 DOM cloning stream (snapshot fidelity, mutation sync, scroll tracking, overlay positioning, iframe scaling)

<details>
<summary>Phase Details (v0.9.10)</summary>

### Phase 116: MCP Agent Tools
**Goal**: MCP clients can create, list, run, stop, and delete background agents without touching the extension UI
**Depends on**: Nothing (first phase)
**Requirements**: MCP-AGENT-01, MCP-AGENT-02, MCP-AGENT-03, MCP-AGENT-04, MCP-AGENT-05
**Success Criteria** (what must be TRUE):
  1. `create_agent` MCP tool creates a background agent with name, task, schedule, and URL
  2. `list_agents` MCP tool returns all agents with status, schedule, last run time, and replay info
  3. `run_agent_now` MCP tool triggers immediate execution of a specific agent
  4. `stop_agent` MCP tool stops a running agent execution
  5. `delete_agent` MCP tool removes an agent and its alarm
**Plans**: 2 plans
Plans:
- [ ] 116-01-PLAN.md -- MCP server agent tools (types, agents.ts, index.ts, queue.ts)
- [ ] 116-02-PLAN.md -- Extension handleMCPMessage agent cases (background.js)

### Phase 117: Cost & Metrics Pipeline
**Goal**: Agent run history shows accurate token usage and cost, not hardcoded placeholders
**Depends on**: Nothing (independent)
**Requirements**: COST-01, COST-02, COST-03
**Success Criteria** (what must be TRUE):
  1. `executeAutomationTask` resolve object includes real `tokensUsed` and `costUsd` from the AI provider response
  2. Agent `recordedScript.estimatedCostPerRun` reflects actual cost of the recording run
  3. Agent stats dashboard (options page) shows accurate cumulative cost and tokens
**Plans**: [to be planned]

### Phase 118: Scheduling Enhancements
**Goal**: Agents can run on flexible schedules with automatic retry on failure
**Depends on**: Nothing (independent)
**Requirements**: SCHED-01, SCHED-02, SCHED-03, SCHED-04
**Success Criteria** (what must be TRUE):
  1. Agents accept cron-style expressions (e.g., `"0 9 * * 1-5"` for weekdays at 9am) as a schedule type
  2. Failed agent runs are retried with exponential backoff (1min, 5min, 15min) up to 3 attempts
  3. Server sync queue persists to `chrome.storage.local` and resumes after service worker restart
  4. Agent scheduler validates and displays human-readable schedule descriptions
**Plans**: [to be planned]

### Phase 119: Replay Intelligence
**Goal**: Agent replay uses smart timing and recovers from individual step failures without full AI fallback
**Depends on**: Phase 117 (needs accurate cost data for savings calculations)
**Requirements**: REPLAY-01, REPLAY-02, REPLAY-03, REPLAY-04
**Success Criteria** (what must be TRUE):
  1. Replay steps use the recorded `originalDuration` (with min/max clamps) instead of hardcoded delays
  2. When a single replay step fails, the executor retries that step up to 2 times before falling back to AI
  3. Per-step success rates are tracked and steps below 50% success rate trigger automatic script re-recording
  4. Replay cost savings (AI cost avoided) are accurately calculated from real cost data
**Plans**: [to be planned]

### Phase 120: Sidepanel Agents UI
**Goal**: Users can manage all background agents from the sidepanel without opening the options page
**Depends on**: Phase 116 (UI should match MCP tool capabilities)
**Requirements**: UI-AGENT-01, UI-AGENT-02, UI-AGENT-03, UI-AGENT-04, UI-AGENT-05
**Success Criteria** (what must be TRUE):
  1. Sidepanel has an "Agents" tab showing all agents with name, status (active/paused/running), and next run time
  2. Each agent row has quick actions: run now, pause/resume, delete
  3. Expanding an agent shows run history (last 10 runs) with status, duration, cost, and execution mode (AI/replay)
  4. A create/edit form allows setting agent name, task description, target URL, and schedule
  5. Running agents show live progress (iteration count, current action) via status updates
**Plans**: [to be planned]

### Phase 121: DOM Cloning Verification
**Goal**: Formally verify that the Phase 44 DOM cloning stream works end-to-end (extension → relay → dashboard)
**Depends on**: Nothing (independent, verification-only)
**Requirements**: DOM-VERIFY-01, DOM-VERIFY-02, DOM-VERIFY-03, DOM-VERIFY-04, DOM-VERIFY-05
**Success Criteria** (what must be TRUE):
  1. `serializeDOM()` snapshot renders faithfully in dashboard iframe (layout, images, styles)
  2. MutationObserver diffs apply correctly (add/remove/attr/text ops by `data-fsb-nid`)
  3. Scroll tracking syncs extension viewport position to dashboard iframe
  4. Orange glow overlay and progress indicator position correctly over the iframe
  5. DOM stream pause/resume on dashboard tab visibility works without data loss
**Plans**: [to be planned]

</details>

### Progress

**Execution Order:** 116 + 117 + 121 (parallel) -> 118 -> 119 -> 120

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 116. MCP Agent Tools | 0/2 | Complete    | 2026-03-28 |
| 117. Cost & Metrics Pipeline | -/- | Pending | - |
| 118. Scheduling Enhancements | -/- | Pending | - |
| 119. Replay Intelligence | -/- | Pending | - |
| 120. Sidepanel Agents UI | -/- | Pending | - |
| 121. DOM Cloning Verification | -/- | Pending | - |
