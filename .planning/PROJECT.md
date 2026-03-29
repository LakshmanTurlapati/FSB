# FSB (Full Self-Browsing)

## What This Is

FSB is an AI-powered browser automation Chrome extension that executes tasks through natural language instructions. Users describe what they want done ("search for wireless mouse on Amazon, add the first result to cart") and FSB figures out the clicks, types, and navigation to make it happen. It uses reliable element targeting with uniqueness-scored selectors, visual feedback (orange glow highlighting), and action verification to execute precisely on the first attempt.

## Core Value

**Reliable single-attempt execution.** The AI decides correctly; the mechanics execute precisely. Every click hits the right element, every action succeeds on the first try.

## Requirements

### Validated

- ✓ Chrome Extension MV3 architecture with service worker -- existing
- ✓ Multi-provider AI integration (xAI, OpenAI, Anthropic, Gemini) -- existing
- ✓ DOM analysis and element identification -- existing
- ✓ Action execution toolset (25+ browser actions) -- existing
- ✓ Session management with state tracking -- existing
- ✓ Stuck detection and recovery mechanisms -- existing
- ✓ Multi-UI (popup chat, sidepanel, options dashboard) -- existing
- ✓ Analytics and usage tracking -- existing
- ✓ Secure API key storage with encryption -- existing
- ✓ Conversation history for multi-turn tasks -- existing
- ✓ Precise element targeting with uniqueness-scored selectors -- v0.9
- ✓ Visual feedback with orange glow highlighting -- v0.9
- ✓ Fast execution with outcome-based dynamic delays -- v0.9
- ✓ Reliable selectors with coordinate fallback -- v0.9
- ✓ Quality context (3-stage filtering, 50 elements, semantic descriptions) -- v0.9
- ✓ Action verification with state capture and effect validation -- v0.9
- ✓ Debugging infrastructure (action recording, inspector, replay, export) -- v0.9
- ✓ Content script modularization (10 modules with dependency ordering) -- v9.3
- ✓ Configurable ElementCache with live storage updates -- v9.3
- ✓ AI memory extraction with correct provider instantiation -- v9.3
- ✓ AI enrichment for all memory types (episodic/semantic/procedural) -- v9.3
- ✓ Cross-site pattern learning from sitemaps -- v9.3
- ✓ Memory detail panels with type-specific renderers -- v9.3
- ✓ Memory cost tracking (dashboard + Memory tab) -- v9.3
- ✓ Per-site guide files (43 sites, 9 categories) -- v9.3
- ✓ Session log parsing into site guides with confidence scoring -- v9.4
- ✓ ATS base guides (Workday, Greenhouse, Lever, iCIMS, Taleo) -- v9.4
- ✓ Single-company career search with error reporting -- v9.4
- ✓ Multi-site sequential search with data persistence -- v9.4
- ✓ Google Sheets data entry via Name Box pattern -- v9.4
- ✓ Google Sheets formatting (headers, freeze, auto-size) -- v9.4
- ✓ Batch action execution with DOM completion detection -- v9.4
- ✓ Timezone/country locale injection for AI decisions -- v9.4
- ✓ CLI command protocol replacing JSON tool calls -- v10.0
- ✓ Unified markdown DOM snapshot with element refs -- v10.0
- ✓ Full prompt architecture rewrite for CLI grammar -- v10.0
- ✓ Multi-signal completion validator with task-type awareness -- v10.0
- ✓ Google Sheets multi-strategy selector resilience -- v10.0
- ✓ Page text extraction via readpage CLI command -- v10.0
- ✓ Site intelligence for 7 productivity apps (Notion, Calendar, Trello, Keep, Todoist, Airtable, Jira) -- v0.9.2
- ✓ Generalized fsbElements injection pipeline with keyword routing -- v0.9.2
- ✓ Unified Task Memory schema (one consolidated report per session) -- v0.9.3
- ✓ Task Memory display with collapsible recon report, per-task graph, knowledge graph integration -- v0.9.3
- ✓ Memory export/import with duplicate detection -- v0.9.3
- ✓ Scroll-aware DOM snapshots with viewport-complete element inclusion -- v0.9.4
- ✓ 8-point action diagnostics with natural language suggestions -- v0.9.4
- ✓ Observation-based stability detection replacing hardcoded delays -- v0.9.4
- ✓ Parallel heuristic + AI debug fallback on every failure -- v0.9.4
- ✓ Progress overlay text sanitization with markdown stripping -- v0.9.5
- ✓ Debug intelligence pipeline (diagnosis + suggestions in AI continuation prompt) -- v0.9.5
- ✓ Phase-weighted progress model with task phase detection -- v0.9.5
- ✓ Complexity-aware ETA blending from task estimator -- v0.9.5
- ✓ Multi-site and Sheets workflow-specific progress tracking -- v0.9.5
- ✓ AI-generated live action summaries with cache and timeout -- v0.9.5
- ✓ Overlay UX polish (task summary line, recovery state, phase debounce) -- v0.9.5
- ✓ 50 MCP edge case prompts validated across canvas, micro-interaction, scroll, context, and dark pattern categories -- v0.9.7
- ✓ 6 new CDP tools (scroll_at, click_and_hold, drag_drop, select_text_range, drop_file, drag_variable_speed) -- v0.9.7
- ✓ 30+ site guides created/updated with real-world automation intelligence -- v0.9.7
- ✓ 50 autopilot diagnostic reports with 500+ recommendations catalogued -- v0.9.7
- ✓ Autopilot CLI command table, parser registry, and isValidTool validator include all 7 CDP tools (cdpClickAt, cdpClickAndHold, cdpDrag, cdpDragVariableSpeed, cdpScrollAt, selectTextRange, dropfile) -- v0.9.8/P97
- ✓ Tool-aware system prompt with TOOL SELECTION GUIDE, canvas task type detection, PRIORITY TOOLS conditional injection, and text-selection/file-upload sub-pattern hints -- v0.9.8/P98
- ✓ 500+ v0.9.7 diagnostic recommendations embedded as prepended strategy hints in 49 site guide files across 5 categories (canvas, micro, scroll, context, dark) -- v0.9.8/P99
- ✓ Procedural memory extraction from successful sessions and RECOMMENDED APPROACH injection into autopilot prompts with per-domain cap of 5 -- v0.9.8/P100
- ✓ Autonomous memory intelligence: auto-consolidation (10-session/80% triggers), cross-domain strategy transfer with taskType matching, domain-change memory refresh, dead episodic code removed -- v0.9.8/P101
- ✓ Robustness hardening: viewport bounds validation for CDP tools, bidirectional stuck recovery, 3-stage progressive prompt trimming, 2-stage CLI parse retry with simplified hint -- v0.9.8/P102
- ✓ Validation test harness with 50 autopilot-adapted edge case prompts, results tracking, and milestone gate metrics (VALID-02/03/04) -- v0.9.8/P103 (harness built, manual execution pending)
- ✓ Verification mechanics fix: CDP direct routing bypasses broken round-trip, dynamic-page completion fast-path, 5-minute session inactivity timeout -- v0.9.8/P104

- ✓ Full Excalidraw mastery: text entry (inserttext + dblclickat), all drawing primitives, styling, connectors, alignment, export, NL diagram generation -- v0.9.9
- ✓ Universal Canvas Vision: draw call interception via Canvas2D prototype proxy, structured CANVAS SCENE in DOM snapshots, pixel fallback, 12/15 canvas apps covered -- v0.9.9/P115
- ✓ 9 systemic fixes: inserttext CLI command, batch CDP routing, debugger contention, guidance truncation 500->3000, fast-path threshold 3->6 for editors -- v0.9.9

### Active

- [ ] Auto-start DOM stream on WS connection -- v0.9.9.1
- [ ] Maximize/minimize preview toggle -- v0.9.9.1
- [ ] Viewport-adaptive preview resize -- v0.9.9.1
- [ ] Full visual fidelity (dialogs, modals, overlays mirrored) -- v0.9.9.1
- [ ] Display-matched frame rate (rAF-synced mutation batching) -- v0.9.9.1
- [ ] Remote control mode (interact through preview iframe) -- v0.9.9.1
- [ ] MCP agent tools — create/list/run/stop/delete agents via MCP -- v0.9.10/P116
- [ ] Cost & metrics pipeline — real token/cost data in agent history -- v0.9.10/P117
- [ ] Scheduling enhancements — cron expressions, retry with backoff -- v0.9.10/P118
- [ ] Replay intelligence — dynamic timing, step-level recovery -- v0.9.10/P119
- [ ] Sidepanel agents UI — dedicated tab for agent management -- v0.9.10/P120

### Backlog (Completed from previous milestones — v0.9.6)

- [x] Server relay on fly.io — WebSocket coordinator connecting all FSB instances -- v0.9.6/P40
- [x] Showcase/dashboard site on fly.io — public landing page + QR-authenticated control center -- v0.9.6/P43
- [x] QR code pairing — FSB generates unique hash per user, dashboard scans to pair -- v0.9.6/P41
- [x] DOM cloning stream — real-time DOM reconstruction on dashboard (code complete, unverified) -- v0.9.6/P44
- [x] Remote task control — create and monitor tasks from dashboard, see FSB working live -- v0.9.6/P42

### Backlog (Active from previous milestones)

- [ ] Publish MCP server to npm for easy `npx` installation (shelved from v0.9.8.1, running in parallel)

### Backlog

- [ ] Reliable CAPTCHA detection -- eliminate false positives on normal pages
- [ ] Smart multi-tab management -- context-aware navigation across multiple tabs

### Out of Scope

- Firefox support -- requires significant Manifest V2/V3 adaptation, defer to future
- CAPTCHA solving -- third-party integration complexity, users can solve manually
- Offline mode -- AI requires connectivity, not feasible for core functionality
- Headless server-side execution -- server is relay only, user's browser must stay active
- Video/screenshot streaming -- DOM cloning with CDN images, not pixel capture

## Current Milestone: v0.9.9.1 Phantom Stream

**Goal:** Make the dashboard DOM stream actually work -- auto-connect, full-fidelity live preview with viewport-adaptive resize, display-matched frame rate, and remote browser control from the dashboard.

**Target features:**
- Auto-start streaming on WS connection (eliminate "Connecting to browser..." dead state)
- Maximize/minimize toggle for the preview panel
- Viewport-adaptive resize (preview reshapes to match actual browser viewport dimensions)
- Full visual fidelity (dialogs, modals, popups, CSS animations, overlays all mirrored in clone)
- Display-matched frame rate (mutation batching synced to requestAnimationFrame for smooth updates)
- Remote control mode: click/type/scroll through the preview iframe to control the actual browser

## Previous Milestone: v0.9.9 Shipped

**Shipped:** 2026-03-25. Excalidraw Mastery -- full drawing tool mastery (all primitives, text entry, styling, connectors, alignment, export, NL diagram generation) plus universal Canvas Vision system (draw call interception for 12/15 canvas apps). 9 phases, 14 plans, 56 requirements.

## Previous Milestone: v0.9.8 Shipped

**Shipped:** 2026-03-23. Autopilot Refinement -- bridged tool gap with MCP manual mode, refined prompting with tool selection guide and canvas task detection, embedded 500+ diagnostic recommendations in 49 site guides, added procedural memory extraction and cross-domain strategy transfer, hardened robustness (viewport validation, prompt trimming, parse retry), fixed CDP direct routing and completion detection. 8 phases, 14 plans.

## Previous Milestone: v0.9.7 Shipped

**Shipped:** 2026-03-22. MCP Edge Case Validation -- 50 edge case prompts tested via MCP manual mode across canvas, micro-interaction, infinite scroll, context bloat, and dark pattern categories. 6 new CDP tools added, 30+ site guides created, 50 diagnostic reports generated. Evidence base built for autopilot refinement.

## Previous State: v0.9.6 Shipped

**Shipped:** 2026-03-19. Agents & Remote Control -- WebSocket relay, QR pairing, dashboard, DOM cloning, MCP server with WebSocket bridge (7 phases, phases 40-46).

## Context

**Previous milestones:** v0.9 (Reliability), v9.0.2 (AI Situational Awareness), v9.3 (Tech Debt), v9.4 (Career Search), v10.0 (CLI Architecture), v0.9.2 (Productivity Sites), v0.9.3 (Memory Tab), v0.9.4 (AI Quality), v0.9.5 (Progress Overlay Intelligence), v0.9.6 (Agents & Remote Control), v0.9.7 (MCP Edge Case Validation), v0.9.9 (Excalidraw Mastery + Canvas Vision)

**Tech stack:** Chrome Extension Manifest V3, vanilla JavaScript (ES2021+), xAI Grok / OpenAI / Anthropic / Gemini / OpenRouter APIs.
**Codebase:** background.js (~11K lines), ai-integration.js (~5K lines), content/ modules (10 files), 50+ site guide files, CLI parser (cli-parser.js), Task Memory system.

**Known tech debt:**
- `uiReadySelector` option in waitForPageStability implemented but no caller wires it yet
- Site Guides Viewer design mismatch (displays as accordion, should match memory-style list with mind maps)
- fsbElements use data-fsbLabel annotation path vs [hint:] tags from buildGuideAnnotations

## Constraints

- **Platform**: Chrome Extension Manifest V3 - service worker lifecycle, message passing patterns
- **No build system**: Direct JavaScript execution, no transpilation - keep it simple
- **AI dependency**: Relies on external AI APIs - must handle latency, rate limits, failures gracefully
- **Browser security**: Content scripts run in isolated world, limited access to page JavaScript context

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Focus on mechanics, not AI | User confirmed AI intent is correct, execution layer is the problem | Good -- v0.9 shipped with reliable execution |
| Visual feedback with orange glow | User specifically requested seeing what's being targeted | Good -- Shadow DOM isolation prevents CSS conflicts |
| Single-attempt reliability over retry sophistication | Core value is precision, not recovery from imprecision | Good -- verification + fallback selectors cover edge cases |
| 50 element limit for AI context | Reduce noise from 300+ elements | Good -- AI makes better decisions with focused context |
| Shadow DOM for visual overlays | Complete style isolation from page CSS | Good -- works on any website without conflicts |
| Outcome-based dynamic delays | Replace static category delays with actual page state detection | Good -- faster execution without sacrificing reliability |
| 15K prompt budget with 40/50/10 split | Balance system prompt, page context, and memory | Good -- 3x more context, AI identifies elements it previously missed |
| Multi-signal completion scoring | Replace unreliable AI self-report with weighted signals | Good -- system stops reliably within 1-2 iterations of actual completion |
| Data dependency chain for phases | Signals -> DOM -> changes -> memory -> completion | Good -- each phase's output feeds the next, no circular dependencies |
| Local fallback for memory extraction | No AI dependency for memory population | Revisit -- removed in v9.3, AI-only with badge error indicator |
| window.FSB namespace for modules | Module communication without ES modules or bare globals | Good -- clean namespace, works with programmatic injection |
| Store-first-enrich-second for memory AI | Enrichment never blocks storage | Good -- memory always saved, AI analysis added asynchronously |
| Pure heuristic cross-site patterns | No AI API costs during consolidation | Good -- keyword-based classification sufficient |
| AI-only extraction (no local fallback) | Surface configuration errors visibly | Good -- forces correct provider setup |
| Formatted clipboard paste for Google Docs | Convert markdown to HTML, paste via Clipboard API + CDP | Good -- rich formatting (tables, bold, lists) in canvas editors |
| Strict phase dependency chain for v9.4 | Pipeline -> single-site -> multi-site -> Sheets entry -> formatting | Good -- each phase's output feeds the next |
| Collect-all-then-write pattern | Accumulate jobs across all sites before opening Sheets once | Good -- avoids tab switching chaos, single Sheets session |
| Name Box navigation for Sheets | Canvas grid is unreadable, Name Box + Tab/Enter is reliable | Good -- works consistently, avoids coordinate guessing |
| URL-based batch suppression for Sheets | Sheets canvas concatenates rapid types, detect via URL regex | Good -- prevents data corruption with graceful fallback |
| Escape-before-NameBox protocol | Explicit Escape step before every Name Box navigation | Good -- eliminates cell edit mode trapping |
| Static timezone-to-country map (85 entries) | No npm dependency for locale detection | Good -- zero dependencies, covers all major timezones |
| CLI-only mode (no JSON fallback) | Full commitment to CLI format -- models must comply | Good -- all 4 providers comply, ~40-60% token reduction |
| Unified markdown snapshot | Interleave text and element refs instead of separate listings | Good -- AI sees page context naturally, token-efficient |
| Multi-strategy selector resilience | 5 selectors per Google Sheets element, first match wins | Good -- survives Google DOM changes |
| aria/role-first selectors for Notion/Airtable | CSS Module hash resilience via stable ARIA attributes | Good -- survives framework CSS changes |
| data-testid-first for Trello/Jira | Atlassian test IDs are more stable than class names | Good -- consistent across Atlassian UI updates |
| Recon report framing for AI extraction | Intelligence analyst producing consolidated report | Good -- single Task Memory per session vs 1-5 fragments |
| Observation-based stability detection | Replace setTimeout with DOM/network quiescence monitoring | Good -- faster on fast pages, patient on slow ones |
| Parallel debug fallback | Heuristic + AI fire concurrently, fastest wins | Good -- common fixes instant, rare ones get AI analysis |
| Retroactive actionHistory patching | Debug results arrive after slimActionResult; patch last entry | Good -- no flow restructuring needed, clean separation |
| diagnosticSuggestions naming | Avoid collision with existing singular `suggestion` field | Good -- clear distinction between 8-point and debug AI sources |
| Phase-weighted progress bands | navigation 0-30%, extraction 30-70%, writing 70-100% | Good -- progress reflects actual task advancement |
| Complexity-aware ETA with decaying weight | 70% estimate early, 10% late (trust actual data over time) | Good -- stable early ETA, accurate late ETA |
| Fire-and-forget AI summaries | generateActionSummary never awaited, 2.5s timeout | Good -- zero impact on automation speed |
| 300ms phase label debounce | Only debounce generic labels, bypass for explicit statusText | Good -- no flicker, AI summaries still instant |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? -> Move to Out of Scope with reason
2. Requirements validated? -> Move to Validated with phase reference
3. New requirements emerged? -> Add to Active
4. Decisions to log? -> Add to Key Decisions
5. "What This Is" still accurate? -> Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check -- still the right priority?
3. Audit Out of Scope -- reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-03-25 after v0.9.9 Excalidraw Mastery milestone shipped*
