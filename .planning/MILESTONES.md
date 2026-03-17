# Project Milestones: FSB (Full Self-Browsing)

## v0.9.2-v0.9.4 Productivity, Memory & AI Quality (Shipped: 2026-03-17)

**Delivered:** Three milestones shipped in one burst: expanded site intelligence to 7 productivity apps, overhauled Memory tab with unified Task Memories and graph visualization, and added cross-cutting AI perception/action quality improvements (scroll-aware snapshots, 8-point diagnostics, stability detection, parallel debug fallback).

**Phases completed:** 30-35 (17 plans across 6 phases)

**Key accomplishments:**

- Generalized fsbElements pipeline + 7 productivity app site guides (Notion, Calendar, Trello, Keep, Todoist, Airtable, Jira) with keyword routing
- Unified Task Memory schema -- one consolidated recon report per automation session replacing 1-5 fragments
- Polished Memory tab with task cards, collapsible detail views, per-task graph visualization, knowledge graph integration
- Theme-aware rendering with zero hardcoded colors, JSON export/import with duplicate detection
- Scroll-aware DOM snapshots with viewport-complete element inclusion (no arbitrary cap)
- 8-point action diagnostics on every failure with natural language suggestions
- Observation-based stability detection (STABILITY_PROFILES) replacing all hardcoded setTimeout delays
- Hybrid continuation prompt preserving reasoning framework and site guide knowledge across iterations
- Context-aware selector re-resolution with unique match enforcement
- Parallel debug fallback -- heuristic engine and AI debugger fire concurrently on every failure

**Stats:**

- 72 commits
- 56 files changed
- 10,415 lines added, 872 lines removed
- 6 phases, 17 plans, 47 requirements (100% satisfied)
- 2 days (2026-03-16 to 2026-03-17)

**Git range:** `49784b9` -> `505db19`

---

## v10.0 CLI Architecture (Shipped: 2026-03-15)

**Delivered:** Replaced FSB's entire AI-to-extension communication protocol from JSON tool calls to line-based CLI commands, redesigned DOM snapshots as unified markdown with interleaved element refs, and hardened Google Sheets automation with multi-strategy selector resilience -- achieving ~40-60% token reduction and eliminating JSON parsing failures.

**Phases completed:** 15-29 (37 plans across 15 phases)

**Key accomplishments:**

- CLI command protocol: hand-written state-machine tokenizer with 75-command registry parses line-based AI output (click e5, type e12 "hello") into {tool, params} objects -- zero JSON fallback
- Unified markdown DOM snapshot: page text and backtick element refs interwoven (`` `e5: button "Submit"` ``), region headings, 12K char budget -- replacing verbose JSON/YAML with ~40-60% measured token reduction
- Full prompt architecture rewrite: system prompt, continuation, stuck recovery, and 43+ site guide files all speaking CLI grammar exclusively
- Multi-signal completion validator: media/extraction task types, URL pattern matching, DOM snapshot evidence, and consecutive-done escape hatch replacing unreliable AI self-report
- Google Sheets resilience: multi-strategy selector lookup (5 strategies per element), 24 toolbar/menu fsbElements, canvas-aware stuck recovery, keyboard-first interaction patterns, first-snapshot health check
- ~800 lines dead YAML/compact code removed, redundant HTML context eliminated from prompts when markdown present

**Stats:**

- 134 commits
- 237 files changed
- 26,343 lines added, 4,999 lines removed
- 15 phases, 37 plans, 67 requirements (100% satisfied)
- 16 days from start to ship (2026-02-27 to 2026-03-15)

**Git range:** `b5c737d` -> `f92f8b3`

**Tech debt (non-blocking):** 7 items -- stale JSDoc refs to deleted YAML functions (2), dead readPage message handler branch (2), fsbElements annotation format divergence (1), legacy viewport patterns (1), single-slash comment syntax (1)

---

## v9.3 Tech Debt Cleanup (Shipped: 2026-02-23)

**Delivered:** Modularized content.js into 10 logical modules, removed dead code, made ElementCache configurable, fixed AI memory extraction, overhauled memory intelligence with AI enrichment and cost tracking, and split site guides into 43 per-site files with a browsable viewer.

**Phases completed:** 4-8 (17 plans total)

**Key accomplishments:**

- Modularized 13K-line content.js into 10 modules with FSB._modules tracking and badge error indicator
- Removed waitForActionable dead code (158 lines), orphaned files, and unused UI helpers
- Made ElementCache configurable via Options page with preset dropdown and live storage updates (default 200)
- Fixed UniversalProvider constructor so AI memory extraction actually runs when configured
- AI enrichment pipeline for all memory types with cross-site pattern learning and expandable detail panels
- Split 9 site guide categories into 43 per-site files with browsable viewer in Memory tab

**Stats:**

- 100 files changed
- 21,950 lines added, 18,960 lines removed
- 5 phases, 17 plans, 9 requirements (100% satisfied)
- 3 days from start to ship (2026-02-21 to 2026-02-23)

**Git range:** `8249bf3` -> `ad5a4bd`

**Known issues:** Site Guides Viewer displays as custom accordion instead of memory-style list with mind maps (UAT blocker, deferred)

---

## v9.0.2 AI Situational Awareness (Shipped: 2026-02-18)

**Delivered:** Complete AI situational awareness -- the AI sees full page context, remembers what it did, detects changes accurately, and knows when the task is done. Plus session continuity, history, replay, career workflows, memory tab, and Google Docs formatted paste.

**Phases completed:** 1-10 (21 plans total)

**Key accomplishments:**

- 3x DOM context delivery (5K -> 15K prompt budget) with priority-aware truncation and task-adaptive content modes
- Multi-signal completion verification replacing unreliable AI self-report (task-type validators, weighted scoring, critical action registry)
- Structured change detection replacing coarse hash comparison (4-channel DOM signals, structural fingerprints, false stuck elimination)
- Resilient conversation memory with hard facts, compaction fallback, and long-term memory retrieval
- Session continuity, history UI, and action replay across conversations
- Career page search with Google Sheets data entry workflows
- Memory tab population with episodic/semantic/procedural memories

**Stats:**

- 194 files created/modified
- 28,148 lines added, 1,366 lines removed
- 32,578 LOC across core JavaScript files
- 10 phases, 21 plans, 22 requirements (100% satisfied)
- 4 days from start to ship (2026-02-14 to 2026-02-18)
- 10/10 systemic issues resolved

**Git range:** `fab9fe0` -> `e0ed6d5`

---

## v0.9 Reliability Improvements (Shipped: 2026-02-14)

**Delivered:** Transformed FSB from unreliable "hit or miss" automation into a precise single-attempt execution engine with visual feedback, smart debugging, and fast execution.

**Phases completed:** 1-11 (24 plans total, Phase 10 deferred)

**Key accomplishments:**
- Selector generation with uniqueness scoring and coordinate fallback when all selectors fail
- Element readiness checks (visibility, interactability, obscuration) before every action
- Orange glow visual highlighting and progress overlay using Shadow DOM isolation
- 3-stage element filtering pipeline reducing DOM from 300+ to ~50 relevant elements
- Action verification with state capture, expected-effects validation, and alternative selector retry
- Debugging infrastructure: action recording, element inspector, session replay, log export
- Execution speed optimization: element caching, outcome-based delays, parallel prefetch, batch execution
- Control panel cleanup: removed dead UI code, wired Debug Mode and Test API settings

**Stats:**
- 18 files created/modified
- 43,283 lines of JavaScript
- 11 phases, 24 plans
- 2 days from start to ship (2026-02-03 to 2026-02-04)

**Git range:** `feat(01-01)` to `fix(debug)`

**What's next:** Smart multi-tab management, advanced CAPTCHA integration, workflow templates

---

## v9.4 Career Search Automation (Shipped: 2026-02-28)

**Delivered:** Autonomous career search across 30+ company websites with formatted Google Sheets output. Parsed 38 crowd session logs into site intelligence (sitemaps + site guides), built single-site and multi-site career search workflows, and added Google Sheets data entry with professional formatting.

**Phases completed:** 9-14.3 (18 plans across 9 phases in v9.4 scope)

**Key accomplishments:**

- Session log parser converts 38 crowd logs into per-company site guides with confidence-scored selectors and direct career URLs
- 5 ATS base guides (Workday, Greenhouse, Lever, iCIMS, Taleo) covering 15+ companies with stability-classified selectors
- Single-company career search: navigate site, search, extract jobs (company, title, apply link, date, location, description)
- Multi-site orchestration: sequential 2-10 company search with chrome.storage persistence, deduplication, and progress reporting
- Google Sheets output via Name Box + Tab/Enter pattern with bold colored headers, frozen row, auto-sized columns, and context-aware sheet naming
- Batch action execution engine: AI returns multiple actions per turn with DOM-based completion detection between each, plus timezone/country locale injection

**Stats:**

- 20 commits
- 9 phases (6 main + 3 hotfix), 18 plans
- 21 requirements defined, 21 satisfied (100%)
- 4 days from start to ship (2026-02-23 to 2026-02-27)

**Git range:** `bd0b1ef` -> `19bad00`

**Known issues:** ACCEL-01, ACCEL-02, ACCEL-05 traceability table not updated to Complete (requirements checked off in body)

---

