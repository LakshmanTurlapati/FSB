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

### Active

- [ ] Complete page awareness -- AI sees full DOM context without truncation losing critical elements
- [ ] Task completion detection -- system-level verification that the task objective was met, not just AI self-report
- [ ] Accurate DOM change detection -- element-level deltas instead of coarse hash comparison
- [ ] Reliable CAPTCHA detection -- eliminate false positives on normal pages
- [ ] Sufficient element text -- full names, labels, and content visible to AI for identification
- [ ] Operational memory -- conversation history preserves what actions succeeded across iterations
- [ ] Accurate viewport detection -- split-pane layouts (Gmail, LinkedIn, Slack) handled correctly
- [ ] Consistent element finding -- waitForElement and click use the same resolution path
- [ ] Action sequence verification -- confirm intermediate state between multi-step actions (type then send)
- [ ] Navigation intelligence -- site-specific strategy hints to reduce wasted iterations

### Out of Scope

- Firefox support -- requires significant Manifest V2/V3 adaptation, defer to future
- CAPTCHA solving -- third-party integration complexity, users can solve manually
- Offline mode -- AI requires connectivity, not feasible for core functionality

## Context

**Current state:** Shipped v0.9 Reliability Improvements. Mechanics are precise but the AI lacks situational awareness. Log analysis of a LinkedIn messaging task revealed 10 systemic issues: the AI can't detect task completion, loses 74% of DOM context to truncation, gets false CAPTCHA warnings, loses operational memory to aggressive compaction, and can't identify elements with truncated text. The next milestone focuses on giving the AI complete awareness of what's on the page and whether its actions worked. 43,283 lines of JavaScript across content.js, background.js, ai-integration.js, and UI files.

## Current Milestone: v9.4 Career Search Automation

**Goal:** Turn crowd session logs into site intelligence (sitemaps + site guides) for 30+ career websites and Google Sheets, enabling FSB to autonomously search career sites for job listings matching user criteria and produce beautifully formatted Google Sheets with results (company, title, date posted, apply link, job description, with styled headers and highlighting).

**Target features:**
- Parse crowd session logs into sitemaps and site guides for each career site
- Parse Google Sheets session logs into site guide for Sheets formatting (headers, colors, bold, column sizing)
- End-to-end career search workflow: user prompt -> navigate career sites -> extract job data -> create formatted Google Sheet
- AI uses sitemap intelligence to navigate each career site efficiently (knows where search boxes, filters, job listings, and pagination are)
- Google Sheets output: company name, job title, date posted, apply link, job description, with formatted headers, bolding, and relevant highlighting

**Session logs available (in /logs/):**
- Career sites: Microsoft, Amazon, Meta, Apple, Google, Boeing, Goldman Sachs, Tesla, NVIDIA, JP Morgan, Visa, Walmart, Target, Deloitte, Bank of America, Home Depot, J&J, Mastercard, McKesson, Mr Cooper, TI, UnitedHealth, CVS Health, Lowe's, OpenAI, AT&T, Capital One, Costco, IBM, Lockheed Martin, Morgan Stanley, Oracle, Pfizer, Verizon, Qatar Airways
- Google Docs/Sheets: docs.google.com session
- Google Search: google.com sessions (for discovering career pages)

## Current State: v9.3 Shipped

**Shipped:** 2026-02-23. Tech Debt Cleanup milestone complete.

**What shipped in v9.3:**
- content.js modularized into 10 logical modules with FSB._modules tracking
- Dead code removed (waitForActionable, orphaned files, unused UI helpers)
- ElementCache configurable via Options page (preset dropdown, live updates, default 200)
- UniversalProvider constructor fixed for AI memory extraction
- Memory Intelligence Overhaul: AI enrichment for all memory types, cross-site pattern learning, detail panels, auto-refresh, cost tracking
- Site Guides Viewer: 43 per-site files across 9 categories, browsable in Memory tab

**Previous milestones:** v9.0.2 (AI Situational Awareness), v0.9 (Reliability Improvements)

**Tech stack:** Chrome Extension Manifest V3, vanilla JavaScript (ES2021+), xAI Grok / OpenAI / Anthropic / Gemini APIs.
**Codebase:** ~100 files changed in v9.3 (21,950 additions, 18,960 deletions). content.js split into content/ modules.

**Known tech debt:**
- Site Guides Viewer design mismatch (displays as accordion, should match memory-style list with mind maps)
- 53 script tags for per-site guide files in options.html (could be bundled)

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

---
*Last updated: 2026-02-23 after v9.4 Career Search Automation milestone started*
