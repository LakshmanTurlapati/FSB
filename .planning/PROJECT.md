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

### Active

- [ ] Server relay on fly.io — WebSocket coordinator connecting all FSB instances
- [ ] Showcase/dashboard site on fly.io — public landing page + QR-authenticated control center
- [ ] QR code pairing — FSB generates unique hash per user, dashboard scans to pair
- [ ] DOM cloning stream — real-time DOM reconstruction on dashboard (images via CDN, not proxied)
- [ ] Remote task control — create and monitor tasks from dashboard, see FSB working live
- [ ] Background polling agents — cron-like tasks (price monitoring etc.) with default safe refresh rates, user's browser stays active
- [ ] Automation replay agents — save successful action selectors, replay without AI, AI re-engages on errors/page changes

### Backlog

- [ ] Reliable CAPTCHA detection -- eliminate false positives on normal pages
- [ ] Smart multi-tab management -- context-aware navigation across multiple tabs

### Out of Scope

- Firefox support -- requires significant Manifest V2/V3 adaptation, defer to future
- CAPTCHA solving -- third-party integration complexity, users can solve manually
- Offline mode -- AI requires connectivity, not feasible for core functionality
- Headless server-side execution -- server is relay only, user's browser must stay active
- Video/screenshot streaming -- DOM cloning with CDN images, not visual capture

## Current Milestone: v0.9.7 MCP Edge Case Validation

**Goal:** Systematically test all 50 edge case prompts through FSB's MCP manual mode, fix every blocker found in-phase, and generate autopilot diagnostic reports -- building the evidence base for a future autopilot refinement milestone.

**Target features:**
- Execute each of 50 edge case prompts via MCP manual tools (no vision, DOM only)
- Fix tool/extension bugs discovered during each test in-phase
- Document what works, what fails, and what autopilot would struggle with
- Generate per-prompt autopilot diagnostic report
- Skip only prompts requiring paid auth with no free alternative

**Approach:** Each phase = one edge case prompt. Try it, fix blockers, document findings.

## Previous State: v0.9.6 Shipped

**Shipped:** 2026-03-19. Agents & Remote Control -- WebSocket relay, QR pairing, dashboard, DOM cloning, MCP server with WebSocket bridge (7 phases, phases 40-46). Plus mid-milestone MCP fixes: observability tools, verb mapping fixes (18/28 broken verbs corrected), progress wiring, memory leak fix.

## Previous State: v0.9.5 Shipped

**Shipped:** 2026-03-17. Progress overlay intelligence — AI-generated live action summaries, phase-weighted progress, debug intelligence pipeline, overlay UX polish (17 requirements, 4 phases).

## Previous State: v0.9.4 Shipped

**Shipped:** 2026-03-17. Three milestones completed in a single day:

**v0.9.2 Productivity Site Intelligence** — Site guides with fsbElements, keyboard-first workflows for Notion, Calendar, Trello, Keep, Todoist, Airtable, Jira (17 requirements)
**v0.9.3 Memory Tab Overhaul** — Unified Task Memory schema, consolidated recon reports, graph visualization, export/import (10 requirements)
**v0.9.4 AI Perception & Action Quality** — Scroll-aware snapshots, 8-point diagnostics, stability detection, parallel debug fallback (20 requirements)

## Context

**Previous milestones:** v0.9 (Reliability), v9.0.2 (AI Situational Awareness), v9.3 (Tech Debt), v9.4 (Career Search), v10.0 (CLI Architecture), v0.9.2 (Productivity Sites), v0.9.3 (Memory Tab), v0.9.4 (AI Quality), v0.9.5 (Progress Overlay Intelligence)

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

---
*Last updated: 2026-03-17 after v0.9.6 milestone started*
