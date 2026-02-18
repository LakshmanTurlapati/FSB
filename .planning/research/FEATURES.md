# Feature Landscape: AI Situational Awareness for Browser Automation

**Domain:** AI browser agent situational awareness (task completion, DOM context, change detection, memory, CAPTCHA)
**Researched:** 2026-02-14
**Overall Confidence:** MEDIUM-HIGH

---

## Table Stakes

Features users (and the AI agent) expect. Missing = the agent feels broken or unreliable. These are problems every serious AI browser agent has solved.

### TS-1: Explicit Task Completion Signal (the "done" Action Pattern)

**Why Expected:** Every production AI browser agent (browser-use, Agent-E, OpenAI CUA, Vercel agent-browser) uses an explicit "done" action rather than relying on the AI to set a boolean flag in its response. The current FSB approach -- where the LLM sets `taskComplete: true` in the same JSON as its actions -- creates a dual-path problem: the AI can mark completion without performing a verification action, or complete while still having pending actions.

**How Others Do It:**
- **browser-use:** The agent must call a `done(text, success)` tool as its LAST action. If the ultimate task is complete, `success=true`. The agent loop checks `model_output.is_done` after each step. On the final allowed step, the system forces completion via `DoneAgentOutput` constraint. [Source: DeepWiki browser-use agent system]
- **Agent-E:** Returns natural language description of outcome from each skill execution, with the orchestrating agent deciding completion.
- **OpenAI CUA:** Uses `computer_call` tool pattern where completion is a distinct tool invocation, not a flag.
- **General pattern:** The naive "stop when no tool calls" approach fails because agents finish prematurely, so frameworks force explicit completion by requiring the agent to call a done tool. [Source: browser-use GitHub]

**What FSB Has Today:**
- `taskComplete: boolean` flag in AI response JSON
- Background.js validates: blocks completion if result is <10 chars, checks for recent critical action failures
- No verification step between the AI deciding "done" and the session ending

**Gap:** FSB relies on the AI self-reporting completion. The LinkedIn session log proved this fails: the AI sent a message successfully but continued iterating because it had no confirmation signal from the page.

**Complexity:** Medium
**Dependencies:** Existing action execution system, AI prompt engineering
**Recommendation:** Convert task completion into a two-phase pattern: (1) AI calls a `markComplete` tool with a result summary, (2) system performs automated verification checks (URL changed? confirmation text visible? success indicators present?) before actually ending the session. This is how browser-use does it and it works.

---

### TS-2: Accessibility Tree-Based DOM Serialization

**Why Expected:** Raw HTML DOM is far too verbose for LLM context windows. Every leading AI browser agent uses the accessibility tree as their primary page representation. This is the single most impactful architectural choice in the entire browser agent ecosystem.

**How Others Do It:**
- **browser-use:** Five-stage pipeline: (1) raw CDP extraction of DOM tree + Accessibility tree + DOM Snapshot in parallel, (2) merge into `EnhancedDOMTreeNode`, (3) simplify by removing non-interactive elements (script, style, meta), (4) multi-filter by paint order and bounding boxes to eliminate occluded/contained nodes, (5) assign sequential indices and build `selector_map`. The output is `SerializedDOMState` with `llm_representation` (compact string) and `selector_map` (index-to-selector lookup). [Source: DeepWiki browser-use, HIGH confidence]
- **Agent-E:** Uses DOM Accessibility Tree instead of regular HTML DOM, since "the accessibility tree is geared toward helping screen readers, which is closer to the mission of web automation." Injects `mmid` attribute on every DOM element for stable identification. Three content modes: `text_only` (for info retrieval), `input_fields` (for form filling), `all_content` (comprehensive). The LLM requests the mode it needs per sub-task. [Source: Emergence AI blog, MEDIUM confidence]
- **Vercel agent-browser:** "Snapshot + Refs" system returns compact references like `@e1: button 'Sign In'` instead of DOM subtrees. Claims 93% less context than Playwright MCP. [Source: paddo.dev blog, MEDIUM confidence]
- **WebVoyager:** Text-only mode uses accessibility tree from WebArena. Primary mode uses annotated screenshots with Set-of-Mark visual overlays. [Source: arxiv WebVoyager paper]
- **Architecture survey paper:** "A simple form field requiring 100+ lines of HTML compresses to 2-3 lines via accessibility snapshots, reducing token consumption while preserving semantic structure (roles, labels, focus state, descriptions)." [Source: arxiv 2511.19477]

**What FSB Has Today:**
- Custom recursive DOM traversal in content.js building element objects with elementId, type, text, selectors, position, attributes
- 3-stage filtering: viewport priority, importance filtering, ~50 element budget
- Text truncated to ~50 chars per element
- Prompt truncated to 5K chars total (74% DOM lost in LinkedIn session)
- No accessibility tree usage at all

**Gap:** FSB uses raw DOM traversal and custom heuristic filtering. This means: (a) the output format is verbose (full element objects instead of compact semantic descriptions), (b) important semantic information is lost (ARIA roles, states, relationships), (c) the filtering is by position/importance heuristics rather than by semantic relevance, (d) 74% of DOM is truncated away, proving the format is too verbose.

**Complexity:** High (requires Chrome DevTools Protocol or `chrome.debugger` API for accessibility tree access, or fallback to `document.querySelectorAll('[role], [aria-label]')`)
**Dependencies:** Content script architecture, AI prompt format
**Recommendation:** Use Chrome's accessibility tree as the primary representation. FSB is a Chrome extension and has access to `chrome.debugger` API for CDP. Even without CDP, the `aria-*` attributes and semantic HTML can be harvested more efficiently than raw DOM. The accessibility tree naturally filters to interactive/meaningful elements, eliminating the need for heuristic budgeting.

---

### TS-3: Step-Level Goal Evaluation

**Why Expected:** The AI needs to know whether its PREVIOUS action succeeded before deciding the next one. Without this, the agent blindly chains actions and cannot self-correct.

**How Others Do It:**
- **browser-use:** Uses `evaluation_previous_goal` assessment after each step. The agent evaluates whether the last action achieved its intended effect before planning the next action. This is done through the LLM examining the new page state against what was expected. [Source: arxiv 2511.19477, DeepWiki]
- **Architecture paper:** Agents follow Observe-Reason-Act-Reflect cycle. The "Reflect" step evaluates the answer compared to expectations. On failure, the loop sends this to a Reasoning Engine for a remedial plan. [Source: WebSearch, MEDIUM confidence]
- **General pattern:** "Memory-driven evaluation" where agents document outcomes via a `memory` parameter on each tool call, summarizing what happened. [Source: arxiv 2511.19477]

**What FSB Has Today:**
- `action-verification.js` captures pre/post page state and compares (URL, title, body text, element count, input values, visible elements)
- `verifyClickEffect`, `verifyTypeEffect`, `verifyNavigationEffect` functions exist
- Results are passed back but the AI only sees them as action results, not as structured step evaluation

**Gap:** FSB has the mechanical verification but lacks the cognitive loop. The verification results are not structured as "your previous goal [X] succeeded/failed because [Y]" -- they are raw state diffs. The AI needs a synthesized verdict, not raw data.

**Complexity:** Medium
**Dependencies:** Existing action-verification.js, AI prompt format
**Recommendation:** Add a structured step evaluation that synthesizes verification results into a natural language verdict: "Previous action: click Send button. Result: SUCCESS - compose window closed, URL unchanged, 3 elements removed (compose UI). The message appears to have been sent." This verdict becomes part of the next iteration's context.

---

### TS-4: Semantic Change Detection (Beyond domHash)

**Why Expected:** The AI needs to know WHAT changed on the page, not just whether something changed. A coarse hash that says "changed" or "not changed" is insufficient for an AI agent to reason about causality.

**How Others Do It:**
- **browser-use:** `_assign_interactive_indices_and_mark_new_nodes()` marks newly-appeared interactive elements during serialization. The LLM can see which elements are new (appeared since last step) vs. stable. Index tracking between serializations provides structural change awareness. [Source: DeepWiki browser-use]
- **Architecture paper:** Element references include version identifiers. When the execution layer receives a tool call, it verifies the requested version matches current state. Stale references produce descriptive errors. "Each element reference includes a version identifier...when the execution layer receives a tool call, it verifies that the requested version matches the current state." [Source: arxiv 2511.19477]
- **Playwright:** Discourages `networkidle` waiting. Instead uses auto-waiting on actionability (element visible, enabled, stable) and encourages web assertions over polling. [Source: Playwright docs]
- **General MutationObserver patterns:** MutationObserver fires on microtask queue, is ~88x faster than polling. Delivers mutations in batches. Best practice: limit callback logic, restrict observation scope. [Source: Chrome DevTools blog, macarthur.me]

**What FSB Has Today:**
- `domHash` computed per iteration in background.js; if hash matches previous, stuckCounter increments
- `DOMStateManager` class with `computeDiff()` that tracks added/removed/modified elements
- `waitForDOMStable` using MutationObserver (already implemented)
- `comparePageStates` comparing URL, title, body text, element count, input values

**Gap:** The domHash is too coarse -- it reports "no change" after successful actions (as seen in the LinkedIn session log). The DOMStateManager has good diff logic but its output is structural (lists of element objects), not semantic ("a confirmation dialog appeared" or "the message input was cleared"). The AI gets the raw diff data but cannot easily reason about what it means.

**Complexity:** Medium
**Dependencies:** DOMStateManager, content script, AI prompt format
**Recommendation:** Two improvements: (1) Make domHash more granular -- hash interactive elements separately from decorative ones, or use multiple hashes (interactive elements hash, text content hash, structure hash). (2) Synthesize diff results into natural language change summaries: "Changes since last action: 1 modal appeared ('Message sent successfully'), 2 input fields cleared, compose panel removed."

---

### TS-5: Structured Memory with Tiered Retention

**Why Expected:** Multi-step browser tasks regularly exceed 10-15 iterations. Without memory management, either the context window overflows (expensive, slow) or critical context is lost (agent forgets what it did).

**How Others Do It:**
- **browser-use:** Two parallel hierarchies: (1) Agent State (serializable): `MessageManagerState`, `ActionLoopDetector`, `AgentHistoryList` with complete execution trace. (2) Browser State (transient): cached `BrowserStateSummary`, CDP session pool. `MessageManager.create_state_messages()` reconstructs prompts from task + browser state + history + available actions. [Source: DeepWiki browser-use]
- **Architecture paper (Three-Tier Memory):** (1) Single Snapshot Retention -- only latest accessibility tree in context, previous discarded. (2) Intelligent Trimming -- lightweight model (Gemini 2.5 Flash Lite) filters large snapshots to 500-1,000 tokens. (3) Conversation History Compression -- older steps summarized, recent 40-50 steps retain full detail. Cost impact: without compression 43K+ tokens for 15 actions; with compression ~12,600 tokens. [Source: arxiv 2511.19477, HIGH confidence]
- **Agent memory research (2026):** Three memory types are now standard: Episodic (past session summaries), Semantic (learned facts about sites/patterns), Procedural (successful action sequences). Episodic-to-semantic consolidation allows agents to learn generalizable knowledge from specific experiences. [Source: arxiv 2512.13564, MarkTechPost, machinelearningmastery.com]
- **Strands Agents framework:** Two strategies: Sliding Window (trim oldest messages) and Summarization (summarize older messages instead of discarding). `reduce_context` method called on context window overflow. [Source: Strands Agents docs]

**What FSB Has Today:**
- `conversationHistory` array with `maxConversationTurns = 4` (reduced from 8)
- `sessionMemory`: structured facts extracted locally each turn (task goal, steps completed, current phase, failed approaches, key findings, pages visited)
- `compactedSummary`: AI-generated summary of older turns (max 1500 chars)
- `buildMemoryContext()`: combines structured memory + compacted summary + long-term memories
- `trimConversationHistory()`: keeps system + memory context + last N raw turn pairs
- `lib/memory/` module: episodic, semantic, procedural memory types for cross-session learning

**Gap:** The LinkedIn session showed compacted summary was 27 chars -- the compaction process itself is failing or producing trivially short summaries. The `sessionMemory` extraction is regex-based (`reasoning.match()`) which is fragile. The memory architecture is designed but the session-level memory (within a single task) is too aggressive in discarding context. The long-term memory module exists but is not yet integrated into the active session loop.

**Complexity:** Medium (session memory improvements), Low (compaction fixes)
**Dependencies:** AI integration module, existing memory module
**Recommendation:** Fix compaction to produce meaningful summaries (minimum length validation, retry on short output). Improve sessionMemory extraction to use structured action results instead of regex on reasoning text. Integrate long-term memory retrieval at session start. The three-tier approach (latest snapshot only + structured step log + compacted older context) from the architecture paper is proven and FSB's architecture is already 60% there.

---

## Differentiators

Features that would set FSB apart from other AI browser agents. Not expected, but competitively valuable.

### D-1: Task-Adaptive DOM Content Modes

**Value Proposition:** Most browser agents send the same DOM representation regardless of what the task needs. Agent-E's three content modes (text_only, input_fields, all_content) show that adapting the DOM representation to the current sub-task dramatically reduces token usage while improving accuracy.

**How It Would Work:** When the AI is reading/extracting information, send only text content and headings (no input fields, no button details). When filling forms, send input fields with their labels and current values. When navigating, send links and navigation elements. FSB already has task type detection (`search`, `form`, `extraction`, `navigation`, `email`, `shopping`) in `TASK_PROMPTS` -- extend this to control DOM serialization mode.

**Complexity:** Medium
**Dependencies:** Content script DOM extraction, task type detection in ai-integration.js
**Competitive Edge:** Most open-source browser agents (browser-use included) send the same full DOM representation every iteration. Agent-E does this but is Python-based and heavyweight. FSB doing this as a lightweight Chrome extension would be distinctive.

---

### D-2: Confidence-Scored Completion with Verification Actions

**Value Proposition:** Instead of binary "done or not done," the AI reports a confidence score AND the system runs automated verification checks. If confidence is below a threshold, the system asks the AI to perform an explicit verification action before completing.

**How It Would Work:**
1. AI reports `{ "complete": true, "confidence": 0.85, "evidence": "compose window closed" }`
2. System checks: Did URL change? Did expected elements appear/disappear? Is there a confirmation message?
3. If system-side checks corroborate AI's assessment: complete.
4. If discrepancy (AI says done but system sees no change): inject verification prompt asking AI to confirm by checking a specific indicator.

**Complexity:** Medium
**Dependencies:** Action verification system, step evaluation
**Competitive Edge:** No open-source browser agent currently does confidence-scored completion with system-side corroboration. browser-use uses LLM judges for evaluation benchmarks but not during live execution.

---

### D-3: Page Intent Classification for Context Optimization

**Value Proposition:** FSB already has `inferPageIntent()` that classifies pages as `captcha-challenge`, `form-error-correction`, `success-confirmation`, `authentication`, `search-results-review`, etc. Extending this to drive both DOM serialization strategy and completion detection would create an integrated awareness system that no other extension-based agent has.

**How It Would Work:**
- `success-confirmation` intent triggers completion candidate check
- `form-error-correction` intent highlights error messages in DOM context
- `search-results-review` intent serializes result cards with emphasis on links
- `captcha-challenge` intent triggers CAPTCHA-specific handling (not false alarm)
- Page intent changes between iterations become part of the change summary

**Complexity:** Low-Medium (extends existing functionality)
**Dependencies:** Existing `inferPageIntent()`, DOM serialization, completion detection
**Competitive Edge:** Uniquely FSB -- no other agent ties page classification to DOM representation and completion logic in a unified way.

---

### D-4: Hierarchical Change Summaries

**Value Proposition:** Instead of raw DOM diffs, provide the AI with human-readable change summaries organized by significance level. This is what the architecture paper recommends but no open-source implementation does well.

**How It Would Work:**
- **Critical changes:** "A modal appeared saying 'Message sent successfully'" or "Page navigated to confirmation page"
- **Significant changes:** "3 input fields were cleared, compose panel removed from DOM"
- **Minor changes:** "2 animation classes toggled, timestamp updated"
- The AI sees: `"Changes: [CRITICAL] Confirmation dialog appeared with text 'Your message has been sent'. [SIGNIFICANT] Message compose area removed. [MINOR] 4 cosmetic updates."`

**Complexity:** Medium-High
**Dependencies:** DOMStateManager diff output, natural language synthesis (can be template-based, does not need AI)
**Competitive Edge:** Every agent I researched either sends raw diffs or no diff information. Hierarchical natural language summaries would be a genuine innovation.

---

### D-5: Proactive Completion Signals from Page Semantics

**Value Proposition:** Instead of waiting for the AI to decide it is done, the system proactively detects completion signals from the page itself and injects them into context.

**Signals to detect:**
- Confirmation messages: "sent", "submitted", "saved", "added to cart", "order placed", "success", "thank you"
- Redirect to confirmation/receipt pages (URL patterns: `/confirm`, `/success`, `/thank-you`, `/receipt`)
- Success indicators: green checkmarks, success alert classes (`.alert-success`, `.notification-success`)
- Toast/snackbar notifications appearing
- Form reset (all fields cleared after submission)
- Navigation away from the task page (e.g., back to inbox after sending email)

**How It Would Work:** After each action, scan for completion signals and inject: `"COMPLETION SIGNAL DETECTED: Page shows success message 'Your message has been sent to John'. Consider whether the task is complete."` The AI still makes the final decision, but the system surfaces evidence.

**Complexity:** Medium
**Dependencies:** Action verification, page state analysis
**Competitive Edge:** This directly solves the LinkedIn session problem where the AI sent a message but didn't know it was done. No other extension-based agent has explicit completion signal detection at the content script level.

---

### D-6: Selective Vision Augmentation

**Value Proposition:** For pages where the accessibility tree or DOM text is insufficient (canvas elements, complex charts, image-heavy layouts), capture a screenshot and send it alongside the text representation. This is the hybrid approach recommended by the architecture paper.

**How It Would Work:**
- Detect when the page has significant non-DOM content (canvas, SVG charts, image galleries)
- Use `chrome.tabs.captureVisibleTab()` to capture screenshot
- Send screenshot + text DOM to a multimodal model (GPT-4o, Gemini 2.5, Grok with vision)
- Only use vision when text representation is clearly insufficient

**Complexity:** High
**Dependencies:** Multi-modal model support, screenshot capture, model routing
**Competitive Edge:** WebVoyager uses vision-only; browser-use uses text-only with optional vision. FSB could intelligently switch between modes based on page content, which is what the architecture paper recommends as optimal.

---

## Anti-Features

Things to deliberately NOT build. Common mistakes in this domain that waste effort or make things worse.

### AF-1: Full Accessibility Tree Dump

**Why Avoid:** Sending the complete accessibility tree to the LLM is almost as bad as sending raw DOM. On complex pages, the accessibility tree can still be thousands of nodes and 15,000+ tokens. [Source: paddo.dev, Vercel agent-browser]

**What to Do Instead:** Filter the accessibility tree to interactive and semantically meaningful elements. Use Agent-E's approach of content-mode-adaptive filtering. The goal is 500-1,500 tokens of DOM context per step, not 15,000.

---

### AF-2: Vision-Only Page Understanding

**Why Avoid:** WebVoyager's vision-only approach requires multimodal models (expensive, slower) and struggles with text-heavy pages where the information is in the DOM, not visible on screen. SeeAct's reliance on visual grounding with cross-encoder models adds latency. Screenshot-based approaches also struggle with off-screen content and scrolling. [Source: arxiv WebVoyager paper, deepsense.ai evaluation]

**What to Do Instead:** Text-first, vision-supplement approach. Use DOM/accessibility tree as primary representation (fast, cheap, comprehensive). Add vision only for specific scenarios where DOM is insufficient (captchas, charts, image recognition tasks).

---

### AF-3: Continuous DOM Polling for Change Detection

**Why Avoid:** Polling `document.body.innerHTML` or re-serializing the entire DOM at fixed intervals (e.g., every 100ms) is extremely expensive. FSB's action-verification.js already correctly uses MutationObserver, which is ~88x more efficient than polling. Do not regress to polling patterns. [Source: Chrome DevTools blog, macarthur.me]

**What to Do Instead:** MutationObserver for real-time change tracking (already implemented). Post-action snapshot comparison (already implemented). Targeted re-serialization only of changed subtrees.

---

### AF-4: CAPTCHA Auto-Solve as Default Behavior

**Why Avoid:** CAPTCHA solving services (2Captcha, CapSolver) cost money per solve, are slow (10-30 seconds), and solving CAPTCHAs that were not actually blocking the task wastes time and money. The current false positive problem (every LinkedIn page triggers CAPTCHA warning) would make auto-solve disastrously expensive. Additionally, automatically bypassing CAPTCHAs has legal and ethical implications on many sites. [Source: Skyvern blog, capsolver docs]

**What to Do Instead:** Fix CAPTCHA detection accuracy first. Only trigger solve when a CAPTCHA is confirmed to be blocking task progress (visible, interactive, on-task-path). Make solving opt-in per task, not automatic.

---

### AF-5: Unbounded Conversation History

**Why Avoid:** Keeping all conversation turns raw leads to linear token growth. The architecture paper showed 15 actions accumulating 43,000+ tokens without compression, vs 12,600 with compression. At $0.20-$3.00 per million input tokens, this directly impacts cost and speed. Some models have context limits that would be exceeded. [Source: arxiv 2511.19477]

**What to Do Instead:** The three-tier approach: (1) only latest page snapshot in context, (2) structured step log (not raw conversation), (3) summarized older context. FSB already has this architecture -- fix the compaction quality, do not remove the compaction.

---

### AF-6: Building a Custom LLM Evaluator for Task Completion

**Why Avoid:** browser-use's benchmark system uses GPT-4o/Gemini as judges for their test suite, but this is for offline evaluation, not live task execution. Running a second LLM call to evaluate whether the first LLM's task is complete doubles API costs and latency. [Source: browser-use benchmark post]

**What to Do Instead:** Use deterministic heuristics and page signals for completion detection during live execution. The system can check for confirmation messages, URL changes, form resets, and other observable signals without calling an LLM. Reserve LLM-based evaluation for post-session quality metrics, not in-loop decisions.

---

## Feature Dependencies

```
TS-2 (Accessibility Tree DOM)
  |
  +---> D-1 (Task-Adaptive Content Modes) -- requires the tree to filter
  |
  +---> D-4 (Hierarchical Change Summaries) -- needs semantic elements for meaningful diffs
  |
  +---> D-6 (Selective Vision) -- needs text baseline to know when vision is needed

TS-3 (Step Evaluation) + TS-4 (Semantic Change Detection)
  |
  +---> TS-1 (Task Completion) -- completion depends on knowing if actions worked
  |
  +---> D-2 (Confidence-Scored Completion) -- confidence requires evidence from verification
  |
  +---> D-5 (Proactive Completion Signals) -- extends change detection to detect success patterns

TS-5 (Structured Memory)
  |
  +---> Standalone, but improves all other features by preserving context
  |
  +---> D-3 (Page Intent) benefits from memory of previous page intents in the session

TS-1 (Task Completion) depends on TS-3 and TS-4
D-3 (Page Intent Classification) is low-dependency (extends existing code)
AF fixes (especially CAPTCHA false positives) are independent and can be done anytime
```

---

## MVP Recommendation

For the v9.0.2 milestone ("AI Situational Awareness"), prioritize in this order:

### Must Have (Phase 1 - Foundation)
1. **TS-4: Semantic Change Detection** -- Fix the domHash granularity, add change summaries. This is the root cause of the "didn't know it was done" problem and the "domHash says no change" problem from the session log. Low-medium complexity, high impact.
2. **TS-3: Step-Level Goal Evaluation** -- Synthesize action verification into structured verdicts. The mechanical verification already exists; this is about formatting it for the AI. Medium complexity, high impact.
3. **TS-5: Structured Memory (Fixes)** -- Fix compaction to not produce 27-char summaries. Improve sessionMemory extraction. This is mostly bug fixes to existing architecture. Low complexity, high impact.
4. **CAPTCHA False Positive Fix** (from AF-4) -- The CSS class-name matching approach produces false positives on any page that happens to have elements with "captcha" in class names even when no CAPTCHA is actually present/blocking. Tighten detection to require: (a) visible CAPTCHA iframe or challenge element, (b) element is actually blocking interaction, (c) CAPTCHA is the type that requires user action (not invisible reCAPTCHA v3 which scores silently). Low complexity, high impact.

### Should Have (Phase 2 - Intelligence)
5. **TS-1: Explicit Completion Signal** -- Convert taskComplete boolean to a verification-backed completion flow. Depends on TS-3 and TS-4 being in place. Medium complexity, high impact.
6. **D-5: Proactive Completion Signals** -- Detect success messages, confirmation pages, form resets. Medium complexity, medium-high impact.
7. **D-3: Page Intent for Context** -- Extend existing inferPageIntent to drive DOM serialization and completion hints. Low-medium complexity, medium impact.

### Nice to Have (Phase 3 - Optimization)
8. **TS-2: Accessibility Tree DOM** -- Major refactor of DOM serialization. High complexity, very high long-term impact, but the system works (imperfectly) without it. This is a significant architectural change.
9. **D-1: Task-Adaptive Content Modes** -- Depends on TS-2. Medium complexity, medium impact.
10. **D-4: Hierarchical Change Summaries** -- Polish feature. Medium-high complexity, medium impact.

### Defer to Future Milestone
- **D-2: Confidence-Scored Completion** -- Valuable but can be added after the basic completion flow works
- **D-6: Selective Vision** -- Requires multimodal model integration, complex routing logic

---

## Sources

### HIGH Confidence (Context7 / Official Documentation / Authoritative Technical Sources)
- [DeepWiki: browser-use Agent System](https://deepwiki.com/browser-use/browser-use/2.1-agent-system) -- Detailed architecture of browser-use's agent loop, DOM serialization, and memory management
- [Building Browser Agents: Architecture, Security, and Practical Solutions (arxiv)](https://arxiv.org/html/2511.19477v1) -- Comprehensive architecture paper covering accessibility tree serialization, three-tier memory, element versioning, and security patterns
- [Chrome DevTools: Mutation Observers](https://developer.chrome.com/blog/detect-dom-changes-with-mutation-observers) -- Official Chrome documentation on MutationObserver performance
- [Playwright waitForLoadState](https://playwright.dev/docs/api/class-page) -- Official Playwright docs on page load state detection

### MEDIUM Confidence (WebSearch Verified with Multiple Sources)
- [Agent-Browser Context Efficiency](https://paddo.dev/blog/agent-browser-context-efficiency/) -- Token usage comparison between DOM serialization approaches
- [browser-use GitHub](https://github.com/browser-use/browser-use) -- Open source repository confirming "done" action pattern
- [Agent-E GitHub](https://github.com/EmergenceAI/Agent-E) -- DOM distillation and mmid injection approach
- [Emergence AI: Distilling the Web](https://www.emergence.ai/blog/distilling-the-web-for-multi-agent-automation) -- Agent-E's three content type modes
- [WebVoyager Paper (arxiv)](https://arxiv.org/html/2401.13919v4) -- Set-of-Mark visual approach and text-only accessibility tree mode
- [Skyvern: CAPTCHA Bypass Methods](https://www.skyvern.com/blog/best-way-to-bypass-captcha-for-ai-browser-automation-september-2025/) -- CAPTCHA detection and solving landscape
- [Memory in the Age of AI Agents (arxiv)](https://arxiv.org/abs/2512.13564) -- Comprehensive survey of agent memory architectures
- [browser-use Benchmark](https://browser-use.com/posts/ai-browser-agent-benchmark) -- Task completion evaluation methodology

### LOW Confidence (Single Source / Unverified)
- [reCAPTCHA v3 false positive rates](https://friendlycaptcha.com/insights/recaptcha-v3/) -- Claims about false positive rates from a competitor
- [Agent-browser 93% context saving](https://medium.com/@richardhightower/agent-browser-ai-first-browser-automation-that-saves-93-of-your-context-window-7a2c52562f8c) -- Self-reported metric from Vercel team
