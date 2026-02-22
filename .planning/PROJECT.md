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

## Current Milestone: v9.3 Tech Debt Cleanup

**Goal:** Eliminate accumulated tech debt -- modularize the 13K-line content.js, remove dead code, make hardcoded values configurable, and fix constructor bugs.

**Target items:**
- content.js modularization (~13K lines into logical modules)
- Remove waitForActionable() dead code (~80 lines)
- Make ElementCache maxCacheSize configurable (currently hardcoded to 100)
- Fix memory-extractor.js UniversalProvider constructor args (local fallback always runs)

## Current State: v9.0.2 Shipped

**Shipped:** 2026-02-18. AI Situational Awareness milestone complete.

**What shipped:**
- 3x DOM context (15K prompt budget), multi-signal completion verification, structured change detection
- Resilient conversation memory with hard facts, long-term retrieval
- Session continuity, history UI, action replay
- Career page search + Google Sheets data entry
- Memory tab with episodic/semantic/procedural memories
- Google Docs formatted clipboard paste with markdown-to-HTML conversion

**Tech stack:** Chrome Extension Manifest V3, vanilla JavaScript (ES2021+), xAI Grok / OpenAI / Anthropic / Gemini APIs.
**Codebase:** ~32,578 LOC across core JS files. content.js (~13K), background.js (~8.7K), ai-integration.js (~4.4K).

**Known tech debt:**
- content.js still large (~13K lines) -- modularization deferred
- waitForActionable() dead code (~80 lines) still present
- ElementCache maxCacheSize hardcoded to 100
- memory-extractor.js UniversalProvider constructor args wrong (local fallback always runs)

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
| Local fallback for memory extraction | No AI dependency for memory population | Good -- memory tab always populates even when AI extraction fails |
| Formatted clipboard paste for Google Docs | Convert markdown to HTML, paste via Clipboard API + CDP | Good -- rich formatting (tables, bold, lists) in canvas editors |

---
*Last updated: 2026-02-21 after v9.3 Tech Debt Cleanup milestone started*
