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

### Active

- [ ] CLI-based AI action interface -- replace JSON tool calls with CLI-style commands for better LLM accuracy and token efficiency
- [ ] Compact DOM snapshot format -- YAML/text element refs instead of verbose JSON structures
- [ ] Complete page awareness -- AI sees full DOM context without truncation losing critical elements
- [ ] Task completion detection -- system-level verification that the task objective was met, not just AI self-report
- [ ] Reliable CAPTCHA detection -- eliminate false positives on normal pages

### Out of Scope

- Firefox support -- requires significant Manifest V2/V3 adaptation, defer to future
- CAPTCHA solving -- third-party integration complexity, users can solve manually
- Offline mode -- AI requires connectivity, not feasible for core functionality

## Current Milestone: v10.0 CLI Architecture

**Goal:** Replace FSB's JSON tool-call interface with a CLI-style command protocol, redesign DOM snapshots as compact YAML with element refs, and fully rewrite the prompt architecture -- all to dramatically improve LLM accuracy, reduce token costs ~3x, and eliminate JSON parsing failures.

**Target features:**
- CLI command protocol: AI outputs line-based commands (click e5, type e12 "hello") instead of JSON tool calls
- YAML DOM snapshots: structured element refs with types, text, and attributes instead of verbose JSON
- Full prompt architecture redesign: system prompt, context tiers, continuation, stuck recovery -- all CLI-native
- Action dispatch rewrite: new CLI parser in background.js, new content script dispatch, new response handling
- Backward-compatible migration: existing action toolset preserved, only the AI-to-extension protocol changes

## Context

**Current state:** Shipped v9.4 Career Search Automation. The core automation engine works well but the AI-to-extension communication layer has fundamental inefficiencies: verbose JSON tool-call format wastes tokens, a 5-tier JSON parsing pipeline handles malformed responses, and DOM snapshots are bloated. Industry evidence (Playwright CLI: 76% token reduction, webctl, agent-browser: 93% context reduction) shows CLI-style interfaces dramatically outperform JSON tool calls for LLM-driven browser automation. background.js (~11K lines), ai-integration.js (~5K lines), content/ modules (10 files).

## Current State: v9.4 Shipped

**Shipped:** 2026-02-27. Career Search Automation milestone complete.

**What shipped in v9.4:**
- Session log parser: 38 crowd logs -> per-company site guides with confidence-scored selectors
- 5 ATS base guides (Workday, Greenhouse, Lever, iCIMS, Taleo) covering 15+ companies
- Career search workflow: single-site and multi-site (2-10 companies) with data persistence
- Google Sheets output: Name Box data entry, bold/colored headers, frozen row, auto-sized columns
- Batch action execution: multiple actions per AI turn with DOM-based completion detection
- Timezone/country locale injection for location-aware AI decisions
- 3 hotfix phases for Google Sheets cell navigation precision

**Previous milestones:** v9.3 (Tech Debt Cleanup), v9.0.2 (AI Situational Awareness), v0.9 (Reliability Improvements)

**Tech stack:** Chrome Extension Manifest V3, vanilla JavaScript (ES2021+), xAI Grok / OpenAI / Anthropic / Gemini APIs.
**Codebase:** background.js (~11K lines), ai-integration.js (~5K lines), content/ modules (10 files), 43+ site guide files.

**Known tech debt:**
- Site Guides Viewer design mismatch (displays as accordion, should match memory-style list with mind maps)
- 53 script tags for per-site guide files in options.html (could be bundled)
- ACCEL traceability table rows not marked Complete (body checkboxes are correct)

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

---
| CLI-only mode (no JSON fallback) | Full commitment to CLI format -- models must comply | -- Pending |

---
*Last updated: 2026-02-27 after v10.0 CLI Architecture milestone started*
