# Project Research Summary

**Project:** FSB v0.9.1 -- AI Situational Awareness Milestone
**Domain:** Chrome Extension AI Browser Automation (awareness, completion detection, DOM context, memory)
**Researched:** 2026-02-14
**Confidence:** HIGH

## Executive Summary

FSB v0.9.1 is a working browser automation extension with 10 systemic awareness failures identified from a real LinkedIn session log. The root causes cluster into five domains: (1) the AI receives only 26% of the DOM due to a 5K character hard cap and flat serialization, (2) the DOM change detector uses a coarse hash that misses content and state changes, (3) conversation memory compacts to as few as 27 characters losing all operational context, (4) task completion relies on AI self-report with no independent verification, and (5) CAPTCHA detection produces false positives on every LinkedIn page. All four research dimensions agree on one fundamental conclusion: **DOM serialization quality is the upstream bottleneck** -- the AI cannot reason about what it cannot see, and every downstream system (memory, completion, stuck detection) degrades when the input is truncated or inaccurate.

The recommended approach is a five-phase build that fixes signal accuracy first (CAPTCHA, viewport, Shadow DOM -- trivial isolated fixes), then expands DOM serialization capacity (raise the 5K cap to 15K with budget-based allocation across prompt sections), then improves change detection (multi-signal hash replacing the coarse URL+count hash), then strengthens memory (fix compaction failures, enrich session memory extraction), and finally adds task-type-specific completion verification as the capstone. This ordering follows the data dependency chain: each phase's output feeds the next phase's input. All changes are modifications to existing functions in three core files (`background.js`, `content.js`, `ai/ai-integration.js`) -- no new files, no new dependencies, no build system changes.

The primary risk is changing DOM serialization, memory, and completion detection simultaneously, which creates a cascading failure scenario: if the new DOM format breaks the AI's interpretation, completion detection produces false results, and those broken iterations get compacted into memory, poisoning future decisions. The mitigation is strict sequential phasing with validation between phases. The architecture research confirms all 8 issues map to modifications of ~18 existing functions, totaling approximately 19 hours of focused development.

## Key Findings

### Recommended Stack (Techniques, Not Libraries)

All four research files converge on a "no new dependencies" constraint. FSB is vanilla JS with no build system, and every recommendation preserves this.

**Core techniques to implement:**

- **Token Budget Allocator**: Replace `HARD_PROMPT_CAP = 5000` with proportional allocation (40% system, 50% page context, 10% memory). Target 10-15K tokens total. Use character-ratio estimation (~3.7 chars/token) instead of a tokenizer library.
- **Hierarchical DOM Serializer**: Replace flat element lists with indented tree format preserving parent-child relationships. Research from D2Snap and browser-use confirms hierarchy is the single strongest UI feature for LLM task success (15-25% improvement). Implement as tree-walk with indentation in `content.js`, no new dependency.
- **Multi-Signal DOM Hash**: Replace `urlPath|title|elementCount|topTypes` with content sampling, interaction state signatures, and page state flags. Enables detecting text changes, state changes, and modal appearances that the current hash misses.
- **Stable Element Fingerprinting**: Remove viewport-relative position from element hashes. Use structural path (`body>main>form>input:nth-of-type(2)`) plus stable attributes (id, data-testid, role, name). Eliminates scroll-induced hash invalidation.
- **TaskCompletionOracle**: Multi-signal confidence scoring (URL patterns 0.3, DOM success indicators 0.25, AI self-report 0.2, action chain 0.15, stability 0.1). Replaces sole reliance on `aiResponse.taskComplete` boolean.
- **Confidence-Scored CAPTCHA Detection**: Domain-verified iframe checking + `data-sitekey` requirement + visibility gating + anti-signals for documentation pages. Replaces overly broad `classNames.includes('captcha')`.

**What NOT to build (consensus across all four files):**
- No `chrome.debugger` / accessibility tree extraction (shows warning banner on all windows)
- No external vector database or embedding-based memory (requires build system/server)
- No vision-only approach (unreliable for interactive elements, expensive)
- No AI-based completion verification call (doubles cost and latency)
- No full virtual DOM diff library (overkill for element fingerprinting)
- No DOM-to-markdown or tokenizer libraries (loses control, adds dependency)

### Expected Features

**Must have (table stakes -- every serious browser agent has solved these):**
1. **Semantic Change Detection** -- Fix domHash granularity, add change summaries. Root cause of "didn't know it was done" and "domHash says no change."
2. **Step-Level Goal Evaluation** -- Synthesize action verification into structured verdicts ("Previous action: click Send. Result: SUCCESS -- compose window closed"). Mechanical verification exists in `action-verification.js`; needs cognitive synthesis for the AI.
3. **Structured Memory Fixes** -- Fix compaction producing 27-char summaries. Improve sessionMemory extraction from fragile regex to structured action results. Integrate long-term memory at session start.
4. **CAPTCHA False Positive Fix** -- Tighten detection to require visible, interactive, dimension-verified CAPTCHA elements. Drop overly generic `.captcha-container` selectors.
5. **Explicit Completion Signal** -- Convert `taskComplete` boolean to verification-backed completion flow where the system verifies independently before ending the session.

**Should have (differentiators -- would set FSB apart):**
6. **Proactive Completion Signals** -- System detects success messages, confirmation pages, form resets and surfaces evidence to AI rather than waiting for AI to notice.
7. **Page Intent for Context** -- Extend existing `inferPageIntent()` to drive DOM serialization strategy and completion detection hints.
8. **Task-Adaptive DOM Content Modes** -- Send different DOM representations based on sub-task (text_only for reading, input_fields for forms).

**Defer to v0.10+:**
- Confidence-Scored Completion (add after basic completion flow works)
- Selective Vision Augmentation (requires multimodal model integration)
- Full Accessibility Tree DOM via CDP (significant architectural change; better serialization of existing DOM approach is sufficient for this milestone)
- Hierarchical Change Summaries (polish feature)

### Architecture Approach

All changes are modifications to existing functions across three files. No new modules, no new message channels, no new file architecture. The existing `chrome.tabs.sendMessage` / `chrome.runtime.onMessage` communication pattern handles all proposed changes.

**Major change targets (18 functions across 3 files):**

1. **ai-integration.js** (9 functions): `buildPrompt()`, `formatElements()`, `formatHTMLContext()`, `buildMinimalUpdate()`, `HARD_PROMPT_CAP`, `updateSessionMemory()`, `describeAction()`, `triggerCompaction()`, `buildMemoryContext()`
2. **background.js** (5 functions): `createDOMHash()`, stuck detection block, context object assembly, completion validation, progress tracking
3. **content.js** (4 functions): `isElementInViewport()`, CAPTCHA detection (page-level + element-level), `waitForElement` handler

**Critical integration invariants to preserve:**
- Action execution path through `sendMessageWithRetry()` must not change
- `[PAGE_CONTENT]` prompt injection markers must continue wrapping all untrusted page content
- Multi-turn conversation `{ messages: [...] }` format must remain provider-compatible
- Session cleanup must clear all new tracking data
- Race condition protections (`isSessionTerminating()`, `loopResolve?.()`) must remain intact

### Critical Pitfalls (Top 5)

1. **Completion relies solely on AI self-report** -- AI says done when it should not, or continues when it should stop. LinkedIn message was sent successfully but AI re-sent it. Prevention: build independent verification layer with task-type-specific success signals. (CRITICAL)

2. **DOM serialization format changes break AI understanding** -- Changing field names, truncation, or compression silently invalidates AI interpretation. Prevention: canonical format spec, format versioning, never change format and prompt in same commit. (CRITICAL)

3. **Conversation compaction destroys critical context** -- Compaction API fails silently, fallback hard-trims to near-zero context. Prevention: minimum context floor, local fallback compaction, "hard facts" section that is never compacted (original task, discovered selectors, whether final action executed). (CRITICAL)

4. **False CAPTCHA detection on reCAPTCHA v3 scoring** -- Every LinkedIn page triggers false positive because reCAPTCHA v3 injects invisible scoring iframe. Prevention: visibility and dimension checks, `data-sitekey` requirement. (CRITICAL)

5. **Element hash instability after scroll** -- Position in hash means every scroll invalidates all element fingerprints. Prevention: remove viewport-relative position from hash, use structural path instead. (MODERATE but pervasive)

## Implications for Roadmap

### Phase 1: Signal Accuracy Fixes

**Rationale:** Three isolated, zero-dependency, low-risk fixes that immediately improve data quality for all downstream phases. Every research file identifies these as independent and prerequisite. Architecture research estimates ~2 hours total.

**Delivers:** Correct viewport classification, eliminated CAPTCHA false positives, consistent element resolution across Shadow DOM.

**Addresses:** CAPTCHA false positive fix, viewport overlap detection (Pitfall 5), waitForElement Shadow DOM consistency.

**Avoids:** Pitfall 4 (false CAPTCHA detection), Pitfall 5 (viewport misclassification).

**Specific changes:**
- `content.js:isElementInViewport()` -- overlap-based check (25% visibility threshold)
- `content.js:10098-10100` -- visibility-gated CAPTCHA with domain-verified iframes
- `content.js:10740-10746` -- require `data-sitekey` + size check for element-level CAPTCHA
- `content.js:6714` -- `waitForElement` uses `querySelectorWithShadow()`

### Phase 2: DOM Serialization Pipeline

**Rationale:** Highest-impact single change. The AI currently receives only 26% of DOM data. Every downstream improvement (memory, completion, stuck detection) benefits from the AI seeing more complete page context. Stack research prescribes a token budget system; architecture research confirms the specific functions to modify and their line numbers.

**Delivers:** 3-4x more DOM data reaching the AI. Budget-based prompt allocation. Priority-aware truncation that never cuts mid-element.

**Addresses:** Over-aggressive filtering (Pitfall 9), text truncation below identification threshold (Pitfall 12).

**Avoids:** Pitfall 2 (format changes breaking AI) -- mitigated by increasing budget first (5 min change), then restructuring format with A/B validation.

**Specific changes:**
- `ai-integration.js:1898` -- Increase HARD_PROMPT_CAP from 5000 to ~15000
- `ai-integration.js:1318` -- Restructure `buildPrompt()` with tiered budget allocation
- `ai-integration.js:2069` -- `formatElements()` accepts char budget parameter
- `ai-integration.js:2172` -- `formatHTMLContext()` accepts char budget parameter
- `ai-integration.js:340` -- `buildMinimalUpdate()` uses budget-based element selection

### Phase 3: DOM Change Detection

**Rationale:** With Phase 1 fixing viewport classification and Phase 2 ensuring the AI sees the DOM, change detection becomes meaningful. The current coarse hash misses content changes, state changes, and modal appearances. Stack research prescribes stable fingerprinting; pitfalls research warns about hash instability from scroll.

**Delivers:** Multi-signal DOM hash detecting content, state, and structural changes. Structured change descriptors instead of boolean `domChanged`. Fewer false stuck detections.

**Addresses:** Semantic change detection (TS-4), hash instability after scroll (Pitfall 7), diff type-switching confusion (Pitfall 11).

**Avoids:** Pitfall 6 (MutationObserver performance regression) -- bound `pendingMutations` array, debounce processing, release node references.

**Specific changes:**
- `background.js:4494` -- `createDOMHash()` with content sampling, state signatures, page-state flags
- `background.js:5073-5123` -- Stuck detection uses structured change signals
- `background.js:5376-5401` -- Context object passes `changeSignals` alongside `domChanged`
- `content.js:222-237` -- `hashElement()` removes viewport-relative position, uses structural path

### Phase 4: Conversation Memory

**Rationale:** With the AI now seeing more DOM data and detecting changes accurately, memory improvements ensure this richer context persists across iterations. Fixes the 27-character compaction disaster. All four research files identify memory as critical but dependent on DOM quality.

**Delivers:** Resilient compaction with retry and local fallback. Richer session memory with element-specific action descriptions. "Hard facts" section exempt from compaction. Long-term memory retrieval at session start.

**Addresses:** Structured memory (TS-5), step-level goal evaluation (TS-3), verification-action gap (Pitfall 8).

**Avoids:** Pitfall 3 (compaction destroys context), Pitfall 10 (compaction API failure degrades silently).

**Specific changes:**
- `ai-integration.js:629` -- `updateSessionMemory()` with comprehensive tracking (all actions, not just successful)
- `ai-integration.js:697` -- `describeAction()` includes element text/selector context
- `ai-integration.js:715` -- `triggerCompaction()` with retry + local extractive fallback
- `ai-integration.js:787` -- `buildMemoryContext()` with structured output and hard facts section
- `background.js:5376-5401` -- Pass richer action metadata including element descriptions

### Phase 5: Task Completion Verification

**Rationale:** The capstone phase. With better DOM data, better change detection, and better memory, the system can now make accurate completion decisions. Building this last means it leverages all prior improvements. Stack research prescribes a multi-signal oracle; features research prescribes an explicit `markComplete` tool; architecture research provides the specific validation block to restructure.

**Delivers:** Task-type-specific completion validators. Multi-signal confidence scoring. Critical action registry preventing duplicate side effects. Enhanced progress tracking reducing false hard stops.

**Addresses:** Explicit completion signal (TS-1), proactive completion signals (D-5), page intent for context (D-3).

**Avoids:** Pitfall 1 (AI self-report unreliable), Pitfall 8 (duplicate side effects from verification gap).

**Specific changes:**
- `background.js:6178-6330` -- Restructure completion validation with task-type-specific validators
- `background.js:6010-6060` -- Enhanced progress tracking using multi-signal change descriptors
- New utility function `classifyTask()` in background.js (not a new file)
- Critical action registry: irrevocable actions (send, submit, purchase) recorded with verification results, always included in prompt

### Phase Ordering Rationale

- **Data dependency chain**: Phase 1 (signals) feeds Phase 2 (serialization) feeds Phase 3 (change detection) feeds Phase 4 (memory) feeds Phase 5 (completion). Each phase's output is the next phase's input.
- **Risk isolation**: Phase 1 fixes are isolated functions with zero downstream coupling. Phase 2 is the riskiest change (DOM format affects everything) and is done early with validation before proceeding. Phases 3-5 build on a validated foundation.
- **Pitfall avoidance**: The architecture research and pitfalls research independently arrive at the same order. Pitfalls explicitly warn: "Change one system at a time. Validate each change with real-world tasks before proceeding to the next."
- **Feature grouping**: Features that share code paths are grouped. Step evaluation (TS-3) and memory (TS-5) share session memory infrastructure. Completion (TS-1) and proactive signals (D-5) share the completion detection block.

### Research Flags

**Phases needing deeper research during planning:**
- **Phase 2 (DOM Serialization):** The hierarchical format (D2Snap-inspired tree vs current flat list) is well-researched conceptually but FSB-specific prompt engineering will require experimentation. The token budget ratios (40/50/10) are starting points, not benchmarked for FSB. Run A/B comparisons on real tasks.
- **Phase 5 (Completion):** Task-type-specific validators are FSB-specific logic. The signal weights (0.3/0.25/0.2/0.15/0.1) need tuning against real task data. The critical action registry pattern has no direct open-source precedent.

**Phases with standard patterns (skip deeper research):**
- **Phase 1 (Signal Accuracy):** All three fixes are straightforward: overlap-based viewport check (well-documented), visibility-gated CAPTCHA detection (vendor docs), Shadow DOM querySelector (existing pattern in codebase).
- **Phase 3 (Change Detection):** Multi-signal hashing is established. Structural path fingerprinting is used by browser-use. MutationObserver optimization is documented by Chrome DevTools.
- **Phase 4 (Memory):** Three-tier memory is proven (Google ADK, architecture survey paper). FSB is already 60% there; this phase is mostly bug fixes and enrichment.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Verified against browser-use (DeepWiki), D2Snap (arxiv), architecture paper (arxiv), MDN. No-dependency constraint is clear and validated. |
| Features | MEDIUM-HIGH | Priority verified against browser-use, Agent-E, WebVoyager, OpenAI CUA. Some differentiators (D-3, D-5) are FSB-specific and untested. |
| Architecture | HIGH | Direct source code analysis with line-number references across all three core files. All claims verified against actual code. |
| Pitfalls | HIGH | 4 critical + 4 moderate + 4 minor pitfalls from codebase analysis + session log + domain research. Real failures (27-char compaction, false CAPTCHA) observed in production. |

**Overall confidence:** HIGH

### Gaps to Address

- **Token budget ratios need empirical tuning:** The 40/50/10 split for system/page/memory is a starting point. Monitor costs and response quality after Phase 2.
- **Completion signal weights are theoretical:** The 0.3/0.25/0.2/0.15/0.1 weights have no FSB-specific benchmark. Log signal values for 50+ real tasks before finalizing.
- **Chrome Side Panel viewport on older versions:** Confirmed on Chrome 114+ that `window.innerWidth` reflects reduced width. Untested on Chrome 88-113. Low risk.
- **Hierarchical DOM format + prompt coupling:** System prompt and `MINIMAL_CONTINUATION_PROMPT` reference current flat element format. Changing to hierarchical format requires simultaneous prompt updates -- highest-risk coupling point.
- **Long-term memory retrieval quality:** MemoryManager keyword-based search accuracy for domain-specific procedural memories is unvalidated. Phase 4 integration depends on relevant results.
- **MutationObserver memory on heavy pages:** Unbounded `pendingMutations` on Gmail-scale pages (5000+ elements) needs benchmarking. Bound/debounce mitigation is prescribed but unverified at scale.
- **`lib/memory/` integration:** Untracked directory contains a memory subsystem that may overlap with or complement session memory changes -- investigate before Phase 4.

## Sources

### Primary (HIGH confidence)
- [browser-use DOM Processing Engine (DeepWiki)](https://deepwiki.com/browser-use/browser-use/2.4-dom-processing-engine) -- DOM serialization, agent loop, memory
- [Building Browser Agents (arxiv 2511.19477)](https://arxiv.org/html/2511.19477v1) -- Three-tier memory, accessibility tree, element versioning
- [D2Snap: DOM Downsampling (arxiv 2508.04412)](https://arxiv.org/html/2508.04412v1) -- Hierarchy preservation, 15-25% improvement
- [MutationObserver (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver) -- DOM change detection API
- [VisualViewport (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/VisualViewport) -- Viewport detection
- [Google ADK Context Compaction](https://google.github.io/adk-docs/context/compaction/) -- Sliding window compaction pattern
- FSB source code: `background.js`, `content.js`, `ai/ai-integration.js` -- direct line-number analysis

### Secondary (MEDIUM confidence)
- [Agent-E (Emergence AI)](https://github.com/EmergenceAI/Agent-E) -- DOM distillation, content modes
- [Skyvern](https://github.com/Skyvern-AI/skyvern) -- Validator Agent pattern, CAPTCHA detection
- [Agent Browser Context Efficiency (paddo.dev)](https://paddo.dev/blog/agent-browser-context-efficiency/) -- Token usage comparisons
- [Memory in AI Agents (arxiv 2512.13564)](https://arxiv.org/abs/2512.13564) -- Episodic/semantic/procedural memory survey
- [Chrome DevTools: Mutation Observers](https://developer.chrome.com/blog/detect-dom-changes-with-mutation-observers) -- Performance

### Tertiary (LOW confidence)
- Token budget 10-15K sweet spot -- community practice, not FSB-benchmarked
- Completion oracle signal weights -- theoretical starting points
- Side panel viewport behavior Chrome 88-113 -- untested
- CAPTCHA false positive rates -- competitor marketing claims

---
*Research completed: 2026-02-14*
*Ready for roadmap: yes*
