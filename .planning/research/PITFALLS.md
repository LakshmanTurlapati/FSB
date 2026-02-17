# Domain Pitfalls: AI Situational Awareness for Browser Automation

**Domain:** Adding awareness features (completion detection, DOM serialization, memory, detection accuracy) to an existing working browser automation Chrome extension
**Researched:** 2026-02-14
**Confidence:** HIGH (based on direct codebase analysis + real session logs + domain research)

---

## Critical Pitfalls

Mistakes that cause regressions, duplicate actions, or data loss. These must be addressed in the implementation plan.

---

### Pitfall 1: Completion Detection Relies Solely on AI Self-Report

**What goes wrong:** The AI says `taskComplete: true` based on its interpretation of the page state, but the task is not actually done. Current FSB has this exact problem: a LinkedIn message was sent successfully, but the AI did not recognize completion and sent it again. The existing validation in `background.js` lines 6178-6256 only checks for result string length (>10 chars) and recent action failure rates -- it never independently verifies the actual outcome.

**Why it happens:** The AI operates on a DOM snapshot that is stale by the time it responds. It cannot see the real-time effect of its own actions. The current `capturePageState()` in `action-verification.js` compares before/after states for individual actions, but this data never feeds back into the completion decision. The AI's `taskComplete` flag is pure self-assessment with no grounding.

**Consequences:**
- Duplicate messages sent (observed in LinkedIn session)
- False completions: AI claims done when nothing happened (e.g., send button click missed)
- False incompletes: AI keeps iterating when the task succeeded 3 iterations ago
- Users lose trust in the automation

**Prevention:**
1. Build a completion verification layer that runs AFTER the AI claims `taskComplete: true` but BEFORE reporting success to the user.
2. Define task-type-specific success signals: messaging tasks check for "sent" confirmation elements; navigation tasks verify URL; form tasks check for success banners or URL change.
3. Use the existing `comparePageStates()` infrastructure in `action-verification.js` -- it already tracks URL changes, new elements, and content changes. Wire this into the completion gate.
4. For messaging tasks specifically: track the DOM state of the message compose area. If it disappears or resets after the send action, that is a strong completion signal independent of AI judgment.

**Warning signs (detect early):**
- AI marks `taskComplete` on the same iteration it performed the final action, without waiting to see the effect
- `stuckCounter` reaches 4+ after a successful action (the repeated-success detector in lines 6101-6129 fires, meaning the AI kept going past a real completion)
- Action history shows the same action (e.g., `click` on send button) repeated 2+ times with success

**Severity:** CRITICAL -- This is the #1 user-visible problem from the session log.
**Feature area:** Task completion detection

---

### Pitfall 2: DOM Serialization Changes Break the AI's Learned Understanding

**What goes wrong:** Changing the DOM payload format (element structure, field names, compression scheme, or truncation limits) silently invalidates the AI's ability to interpret the page. The AI was trained/prompted on a specific format. If you change `elementId` to `id`, rename `inViewport` to `visible`, change how selectors are formatted, or alter truncation lengths, the system prompt and continuation prompt still reference the old format. The AI generates actions against element identifiers that no longer exist in the payload.

**Why it happens:** FSB has multiple layers of DOM processing, each with its own format:
- `content.js` line ~10570: Raw DOM traversal produces element objects with fields like `elementId`, `type`, `text`, `selectors`, `position.inViewport`
- `DOMStateManager.generateOptimizedPayload()` in content.js lines 407-496: Transforms to delta/compact_full format with different field names (`compressed.inViewport`, `compressed.interactive`)
- `AIIntegration.buildMinimalUpdate()` in ai-integration.js lines 340-513: Further reformats elements for the prompt with `formatElements()` and custom string building
- `AIIntegration.formatElements()`: Yet another transform into a string representation

Any change in one layer propagates unpredictably. The `compact_full` path (line 462-475) filters to `el.position?.inViewport` only and caps at 100 elements. The `delta` path includes added/removed/modified/unchanged. The AI sees completely different data depending on which path won the size comparison (line 489).

**Consequences:**
- AI generates CSS selectors that reference elements not in its current view
- AI cannot find elements it could previously find (the 74% DOM truncation problem from the session log)
- Silent degradation: automation runs but accuracy drops from 85% to 30%
- Debugging is extremely difficult because the prompt the AI actually receives differs from the raw DOM

**Prevention:**
1. Create a canonical DOM format specification document that all layers must conform to. Any change to this format requires updating the system prompt and continuation prompt simultaneously.
2. Add a "DOM format version" field to every payload. The system prompt should reference which version it expects.
3. When changing truncation limits or element budgets, A/B test with real tasks before deploying. The current 50-element budget with viewport-only mode (line 10571) caused the 74% truncation problem.
4. Log the EXACT prompt sent to the AI (including formatted elements) at debug level, so you can see what the AI actually saw when it made a bad decision.
5. Never change both the DOM format AND the prompt in the same commit. Change one, verify, then change the other.

**Warning signs (detect early):**
- AI starts referencing `elementId` values that do not appear in the current DOM payload
- Selector-based action failures increase after a DOM format change
- The AI says "I cannot find any interactive elements" on pages that clearly have them
- `compact_full` path starts winning over `delta` path consistently (indicates delta format is bloated)

**Severity:** CRITICAL -- Format changes affect every single AI interaction.
**Feature area:** DOM serialization / element visibility

---

### Pitfall 3: Conversation History Compaction Destroys Critical Context

**What goes wrong:** The conversation history compaction system (ai-integration.js lines 520-561, 715-781) aggressively truncates older turns, and the compacted summary loses task-critical details. The session log showed conversation history compacted to 27 characters -- the AI literally forgot what it had already done.

**Why it happens:** Multiple compounding factors in the current implementation:
1. `maxConversationTurns` is set to 4 (line 236), meaning only 4 turn pairs are kept raw. For a 20-iteration task, 80% of history is either compacted or lost.
2. `compactionThreshold` is also 4 (line 248), triggering compaction early.
3. The compaction prompt (lines 730-748) sends message content truncated to 500 chars each (`m.content.substring(0, 500)`). DOM snapshots and detailed action results are already thousands of characters -- truncating to 500 chars destroys them.
4. `compactedSummary` is capped at 1500 chars (line 763). For a complex task, 1500 chars cannot capture which elements were interacted with, what text was typed, what URLs were visited.
5. The `sessionMemory` object (lines 631-692) caps `stepsCompleted` at 15, `failedApproaches` at 8, `pagesVisited` at 10. These are reasonable individually but collectively may not capture a complex task.
6. When compaction has not yet completed (async) and trim runs, it falls back to the old behavior of just keeping last N messages with NO summary (lines 552-559). This is the 27-character scenario.

**Consequences:**
- AI repeats actions it already performed successfully (the LinkedIn duplicate message)
- AI forgets what text it typed, what buttons it clicked, what page it was on
- AI loses track of multi-step task progress (e.g., "fill form" -- forgets which fields are done)
- Compaction API call fails silently, fallback trim runs, nearly all context is lost

**Prevention:**
1. Never trim conversation history without a completed compaction OR a populated sessionMemory. The current fallback (lines 552-559) that trims without any summary is the root cause. Guard this: if no compaction and no sessionMemory, keep more raw turns even if it means a larger prompt.
2. Increase the compaction summary limit from 1500 to at least 3000 chars. The cost is ~1000 extra tokens per request, which is negligible compared to the cost of the AI repeating 3-5 iterations.
3. Make the sessionMemory.stepsCompleted entries more descriptive. Currently `describeAction()` (lines 697-709) produces generic text like "clicked element" -- it should include the selector or element text so the AI knows WHICH element was clicked.
4. Add a "hard facts" section to the memory context that is NEVER compacted: the original task, the target URL, critical element selectors already discovered, and whether the final action (send/submit/save) was executed.
5. Log when compaction fallback triggers (the path at lines 552-559). This is a degraded state that should be visible in debug logs.

**Warning signs (detect early):**
- `compactedSummary` length is under 200 chars (means compaction returned almost nothing)
- `pendingCompaction` is null but `conversationHistory.length` exceeds `maxConversationTurns * 2 + 1` (compaction failed silently)
- AI reasoning says "I need to check what has been done" or "Let me start by..." on iteration 8+
- AI re-types text that was already successfully entered

**Severity:** CRITICAL -- Memory loss causes all other awareness features to fail.
**Feature area:** Memory preservation / conversation management

---

### Pitfall 4: False CAPTCHA Detection on Sites That Use CAPTCHA-Like Selectors

**What goes wrong:** The CAPTCHA detection in content.js (lines 10098-10100) uses CSS class name matching:
```
'.g-recaptcha, .h-captcha, .cf-turnstile, .captcha-container, .captcha-challenge, iframe[src*="recaptcha"], iframe[src*="hcaptcha"], iframe[src*="challenges.cloudflare.com"]'
```
LinkedIn (and many other sites) load the reCAPTCHA JavaScript library preemptively for bot detection scoring, which injects an iframe with `src*="recaptcha"` even when no visible CAPTCHA challenge is presented. The element-level detection (lines 10740-10746) also matches on class substrings like `classNames.includes('recaptcha')`, which catches analytics/scoring elements.

**Why it happens:** reCAPTCHA v3 (invisible scoring) and LinkedIn's security infrastructure load CAPTCHA-related DOM elements for risk assessment without ever showing a visual challenge. The current detection makes no distinction between "CAPTCHA infrastructure loaded" and "CAPTCHA challenge presented to user." The `captchaPresent` flag (line 10921) propagates to the AI prompt, which then wastes iterations trying to solve a non-existent CAPTCHA.

**Consequences:**
- Every LinkedIn page (and many other sites) falsely reports `captchaPresent: true`
- AI prompt includes "WARNING: CAPTCHA detected on page" on every iteration
- AI may attempt `solveCaptcha` tool on pages with no actual challenge, wasting 180 seconds (the CAPTCHA action timeout at line 11117)
- The false signal adds noise to every AI decision

**Prevention:**
1. Distinguish between CAPTCHA infrastructure (reCAPTCHA v3 scoring script) and CAPTCHA challenge (visible widget with checkbox or image grid). Check visibility: `iframe[src*="recaptcha"]` is not a CAPTCHA challenge if the iframe has zero dimensions or is hidden.
2. For iframe-based detection, verify the iframe is visible AND has meaningful dimensions (width > 50px, height > 50px). reCAPTCHA v3 scoring iframes are typically 0x0 or 1x1 pixels.
3. For class-based detection (`.g-recaptcha`), verify the element has a `data-sitekey` attribute AND is visible. The reCAPTCHA v3 execute() call does not create visible `.g-recaptcha` elements.
4. Add a confirmation step: after initial detection, verify with the `solveCaptcha` tool's own detection logic (lines 6493-6543) which already checks for sitekey extraction. If sitekey extraction fails, it is not a solvable CAPTCHA.
5. Cache the CAPTCHA detection result per-page (per URL) to avoid re-detecting every iteration.

**Warning signs (detect early):**
- `captchaPresent: true` on every page of a site (should be rare, not universal)
- `solveCaptcha` tool returns "No supported CAPTCHA found" after detection said one existed
- AI reasoning mentions CAPTCHA on pages that clearly have no visual challenge

**Severity:** CRITICAL -- False signal on every LinkedIn page pollutes every AI decision.
**Feature area:** CAPTCHA detection accuracy

---

## Moderate Pitfalls

Mistakes that cause degraded performance, wasted iterations, or incorrect behavior in specific scenarios.

---

### Pitfall 5: Viewport Detection Fails on Split-Pane and Non-Standard Layouts

**What goes wrong:** The `isInViewportRect()` function (content.js line 10593-10598) checks:
```javascript
rect.bottom >= viewportRect.top &&    // 0
rect.top <= viewportRect.bottom &&    // window.innerHeight
rect.right >= viewportRect.left &&    // 0
rect.left <= viewportRect.right       // window.innerWidth
```
This treats the full browser viewport as the visible area. But on split-pane layouts (LinkedIn messaging, Gmail with preview pane, Outlook), the FSB side panel itself occupies part of the viewport. Elements in the "main content" pane that are technically within `window.innerWidth` may be behind the side panel. Conversely, `window.innerWidth` reports the FULL window width including the side panel, so `viewportRect.right` is too large, and ALL elements in the left pane appear "in viewport" even if some are scrolled out of the pane's own scroll container.

**Why it happens:** `getBoundingClientRect()` returns coordinates relative to the browser viewport, not relative to a scroll container. On pages with multiple scroll containers (LinkedIn messaging has left panel + right panel, each independently scrollable), an element can be within the browser viewport but scrolled out of view within its container. The viewport check only considers `window.innerHeight` and `window.innerWidth`, not the element's containing scrollable ancestor.

Additionally, Chrome has documented bugs where `getBoundingClientRect()` returns incorrect values in extension content scripts, particularly related to scrollbar handling and zoom levels.

**Consequences:**
- Session log showed "all elements marked off-screen on split-pane layouts"
- AI sees 0 interactive elements because everything is classified as "off-screen"
- Or conversely, AI sees elements from a scrolled-out pane section as "in viewport" and tries to click them, failing because they are not actually visible
- `compact_full` payload (line 462-466) filters by `el.position?.inViewport`, so if viewport detection is wrong, the ENTIRE payload is wrong

**Prevention:**
1. For viewport detection, check not just the browser viewport but also whether the element is within its nearest scrollable ancestor's visible area. Use `element.offsetParent` and check overflow properties on ancestor elements.
2. Add scroll container awareness: detect major scroll containers on the page (elements with `overflow: auto/scroll` and actual scrollable content), and track each element's visibility within its container.
3. Use `IntersectionObserver` as a more reliable alternative to manual `getBoundingClientRect()` comparisons. `IntersectionObserver` handles scroll containers and CSS transforms correctly.
4. For the FSB side panel specifically: detect if the extension's own side panel is open and adjust the effective viewport width accordingly. The side panel width can be queried from the extension API.
5. As a fallback, when 0 viewport elements are detected but total elements > 0, switch to a "relaxed viewport" mode that includes elements from the main content area regardless of precise viewport calculations.

**Warning signs (detect early):**
- 0 viewport elements but total element count > 50
- All or nearly all elements have `inViewport: false`
- AI says "No interactive elements found" on pages that clearly have interactive content
- The `viewportElements.length` vs `offscreenElements.length` ratio is abnormally low (< 0.1)

**Severity:** MODERATE (CRITICAL on specific sites like LinkedIn messaging, Gmail split view)
**Feature area:** Viewport detection / DOM serialization

---

### Pitfall 6: MutationObserver Performance Regression on Heavy Pages

**What goes wrong:** Adding fine-grained DOM change detection via MutationObserver creates performance problems on complex pages. The current `DOMStateManager` in content.js (lines 147-581) observes `document.body` with `{ childList: true, attributes: true, subtree: true }`. On pages like Gmail, LinkedIn, or Twitter, this can fire thousands of mutation callbacks per second during normal page operation (animations, live updates, ad rotations).

**Why it happens:** The `recordMutation()` method (lines 208-217) stores every mutation in `pendingMutations` array including `Array.from(mutation.addedNodes)` and `Array.from(mutation.removedNodes)`. On a Gmail inbox with 50 emails loading, this creates thousands of mutation records, each holding references to DOM nodes. The pending mutations are only cleared when `updateState()` runs (line 399), which only happens during `computeDiff()` calls. Between DOM snapshots, mutations accumulate without bound.

The current `attributeFilter` optimization (lines 195-201) helps but still tracks 20+ attributes across the entire subtree. On a page with 5000 elements, a CSS animation that changes `style` or `class` on multiple elements triggers cascading mutation callbacks.

**Consequences:**
- Content script becomes sluggish, causing action execution delays
- Memory grows unbounded between DOM snapshots as mutation records accumulate
- `pendingMutations` array holds strong references to DOM nodes, preventing garbage collection
- On very heavy pages, the browser may show jank or the content script may crash

**Prevention:**
1. Add a maximum size to `pendingMutations` (e.g., 500). When exceeded, flush old entries or switch to a "high-churn" mode that only tracks whether mutations occurred (boolean), not what specifically changed.
2. Debounce mutation processing. Instead of recording every individual mutation, batch them: record that mutations occurred in a time window, and only enumerate details when a DOM snapshot is requested.
3. Do not store `addedNodes` and `removedNodes` as arrays in the mutation record. These hold strong references to DOM nodes. Instead, extract only the information needed (tag name, id, class) and release the node references.
4. Consider lazy initialization: only start the MutationObserver when an automation session is active, and disconnect it when the session ends. Currently the observer is initialized at content script load time.
5. For the `DOMStateManager.hashElement()` function (lines 222-237): the hash includes `position.x` and `position.y` which change on scroll. This means scrolling invalidates the entire element cache, causing all elements to appear as "new" after every scroll. Use position relative to the document, not the viewport.

**Warning signs (detect early):**
- `pendingMutations.length` exceeds 1000 between snapshots
- DOM snapshot takes > 500ms (the perf target is 200-500ms per CLAUDE.md)
- Memory usage climbs steadily during a session without plateau
- Scrolling causes massive `diff.added` counts because hash invalidation

**Severity:** MODERATE -- affects heavy pages, may cause timeout failures
**Feature area:** Change detection / DOM diffing

---

### Pitfall 7: Element Hash Instability Causes False "New Element" Detection

**What goes wrong:** The `hashElement()` function in content.js (lines 222-237) creates hashes from:
```javascript
`${element.type}|${element.id || ''}|${element.class || ''}|${text}|${element.position?.x || 0},${element.position?.y || 0}`
```
Position (`x`, `y`) is included in the hash. When the user scrolls, every element's position changes (because `getBoundingClientRect()` returns viewport-relative coordinates). This means after any scroll action, the `computeDiff()` function (lines 285-355) will see every element as "new" because no hash matches the previous state. The entire DOM appears to have changed.

**Why it happens:** Position is included in the hash presumably to distinguish between multiple elements of the same type/class (e.g., multiple `<button>` elements with class "btn"). But viewport-relative position is the wrong dimension -- it changes on scroll, page resize, and even dynamic content insertion above the element.

The `isInViewport()` function (lines 8452-8463) also uses `scrollY`/`scrollX` in its calculation, coupling viewport membership to scroll position -- which is correct for viewport detection but compounds the hash instability problem.

**Consequences:**
- After every scroll action, the delta diff shows all elements as "added" and all previous elements as "removed"
- The `compact_full` path wins every size comparison after scroll because delta is enormous
- AI receives a "full DOM changed" signal when nothing actually changed except scroll position
- Token waste: full DOM payloads are larger than necessary deltas
- AI may interpret massive DOM changes as "page navigated" and reset its understanding

**Prevention:**
1. Remove position from the element hash entirely. Use a combination of: `type`, `id`, `class`, `text` (first 20 chars), `nth-child index`, and parent element info. This produces stable hashes across scrolls.
2. If position is needed for disambiguation, use document-relative position (`element.offsetTop`, `element.offsetLeft` relative to `document.body`) instead of viewport-relative position from `getBoundingClientRect()`.
3. Add a "scroll-aware" mode to `computeDiff()` that detects when the primary change is scroll position (URL unchanged, element types unchanged) and skips full re-diffing.
4. Track scroll events separately from DOM mutations. A scroll does not mean DOM changed.

**Warning signs (detect early):**
- `diff.metadata.changeRatio` > 0.8 after a scroll action (nearly everything "changed")
- `diff.added.length` approximately equals `diff.removed.length` approximately equals `diff.metadata.totalElements` (total churn)
- `compact_full` path wins consistently after scroll actions

**Severity:** MODERATE -- causes token waste and AI confusion after scroll, but does not break automation entirely
**Feature area:** Change detection / DOM diffing

---

### Pitfall 8: Verification-Action Gap Allows Duplicate Side Effects

**What goes wrong:** There is no verification step between performing a critical action (send message, submit form, confirm purchase) and proceeding to the next iteration. The AI types text, clicks send, and then in the NEXT iteration receives a new DOM snapshot. If the send was successful but the DOM snapshot is stale or ambiguous, the AI may try to send again. The current `action-verification.js` module verifies click effects but does not feed this verification into a "do not repeat" mechanism.

**Why it happens:** The automation loop in background.js executes actions, calls `smartWaitAfterAction()`, and then proceeds to the next iteration where the AI re-analyzes the page. The verification result from `verifyClickEffect()` is available but is not stored in a way the AI can reference. The `sessionMemory.stepsCompleted` tracks actions but in generic terms ("clicked element") that don't help the AI know "the send button was already clicked and the message was delivered."

The `MINIMAL_CONTINUATION_PROMPT` (line 184) includes rule #10: "Do NOT retry actions that already showed SUCCESS." But this relies on the action history being in the conversation context, which may have been compacted away (Pitfall 3).

**Consequences:**
- Duplicate messages sent on LinkedIn, Twitter, email
- Duplicate form submissions (potentially ordering items twice)
- Duplicate comments posted
- Users experience the worst possible outcome: the AI "worked" but did something harmful

**Prevention:**
1. Implement a "critical action registry" that records irrevocable actions (send, submit, purchase, delete, post) with their verification results. This registry persists across iterations and is ALWAYS included in the AI prompt, exempt from compaction.
2. After a send/submit/post action succeeds, inject a hard constraint into the next prompt: "CRITICAL: [send message] action was executed successfully at [timestamp]. Do NOT repeat this action. Verify completion and mark taskComplete if appropriate."
3. Use the `comparePageStates()` result after critical actions to detect success signals (compose window closing, success toast appearing, URL changing to sent/outbox). If these signals are detected, auto-mark the task as potentially complete rather than waiting for the AI to decide.
4. Add a "cooldown" mechanism for critical actions: once a send/submit/click action succeeds on a specific selector, that selector is blocked from being targeted again for 3 iterations.

**Warning signs (detect early):**
- Action history shows the same `click` on the same selector succeeding 2+ times
- AI reasoning on iteration N+1 says "I need to send the message" when the send action succeeded on iteration N
- `sessionMemory.stepsCompleted` contains duplicate entries

**Severity:** MODERATE (but user impact is HIGH for messaging/purchasing tasks)
**Feature area:** Task completion detection / verification pattern

---

## Minor Pitfalls

Mistakes that cause inefficiency or minor bugs but are recoverable.

---

### Pitfall 9: Over-Aggressive Element Filtering Hides Necessary Elements

**What goes wrong:** The current element budget is 50 elements with viewport-only mode (content.js line 10571). On complex pages, this filters out elements the AI needs. The 3-stage pipeline (`getFilteredElements()`) applies relevance scoring based on inferred task type, but task type inference (lines 10600-10611) uses simple URL pattern matching that can misclassify pages.

**Why it happens:** The budget was set for token efficiency, but 50 elements is often insufficient for pages with navigation menus, form fields, and action buttons. On a LinkedIn messaging page, the message compose area, recipient list, conversation list, and navigation may have 100+ interactive elements. Filtering to 50 may exclude the specific "Send" button the AI needs.

**Consequences:**
- AI cannot find elements that are on the page but filtered out of the payload
- AI reports "No interactive elements found" or uses `scroll` to search for elements that exist but were budget-cut
- Wastes iterations as AI searches for elements that were available but excluded

**Prevention:**
1. Make the element budget dynamic based on page complexity. Simple pages (< 30 interactive elements) get full coverage. Complex pages get a higher budget (100-150) with heavier compression per element.
2. Ensure the filtering pipeline never excludes elements that match the current task's keywords. If the task mentions "send," the send button must survive filtering regardless of budget.
3. Add a "missed element recovery" path: if the AI says it cannot find an element, re-run DOM collection with a higher budget or full-page mode for the next iteration.
4. Log which elements were filtered out at debug level, so filtering-related failures can be diagnosed.

**Warning signs (detect early):**
- AI uses `waitForElement` for elements that exist on the page but were filtered
- `optimization.totalElements` is much larger than `optimization.sentElements` (high filter ratio)
- Task failure rate increases after lowering element budget

**Severity:** MINOR -- causes wasted iterations, recoverable by scrolling/retrying
**Feature area:** DOM serialization / element visibility

---

### Pitfall 10: Compaction API Call Failure Degrades Silently

**What goes wrong:** The conversation compaction (ai-integration.js lines 750-781) is a fire-and-forget async API call. If the AI provider is slow, rate-limited, or the model returns an unusable response, `compactedSummary` stays null. The trim logic (lines 534-559) then falls through to the old behavior of keeping only `maxConversationTurns * 2` messages with no context. There is no retry, no alert, no fallback content.

**Why it happens:** Compaction runs in parallel with the main automation API call to avoid latency. This is good architecture. But the error handling (lines 772-780) catches the error, logs it as "non-critical," sets `pendingCompaction = null`, and moves on. The next `trimConversationHistory()` call sees no compactedSummary and no pendingCompaction, so it either keeps the status quo (if sessionMemory exists) or hard-trims (if it doesn't).

**Consequences:**
- Context quality degrades unpredictably based on whether a parallel API call succeeded
- Hard to reproduce in testing because it depends on API latency/availability
- The 27-character compaction scenario from the session log was likely this failure mode

**Prevention:**
1. If compaction fails, fall back to a local compaction strategy: concatenate the first 100 chars of each dropped message into a "raw summary" string. This is worse than AI-compacted but infinitely better than nothing.
2. Add a compaction health metric: track success/failure rate. If compaction fails 3+ times in a session, switch to keeping more raw turns (increase `rawTurnsToKeep` to 5 or 6) as a defensive measure.
3. Add a minimum viable context guarantee: the trim function should NEVER reduce total context below a floor (e.g., system prompt + 2000 chars of context + last 2 raw turns). If compaction failed, keep more raw turns to stay above the floor.

**Warning signs (detect early):**
- `compactedSummary` is null after 5+ iterations
- `pendingCompaction` resolves to null (compaction attempted but returned nothing useful)
- `conversationHistory.length` drops sharply between consecutive iterations

**Severity:** MINOR -- degraded context, not a crash, but compounds with Pitfalls 3 and 8
**Feature area:** Memory preservation

---

### Pitfall 11: DOM Diff Type-Switching Confuses the AI's Mental Model

**What goes wrong:** The `generateOptimizedPayload()` method (content.js lines 407-496) dynamically chooses between `delta` format (changes only) and `compact_full` format (viewport elements snapshot) based on payload size comparison. This means the AI receives `type: 'delta'` on one iteration and `type: 'compact_full'` on the next. The data structure is completely different between these two formats: delta has `changes.added`, `changes.removed`, `changes.modified`; compact_full has flat `elements` array. The AI prompt does not explain this switching or tell the AI how to interpret each format.

**Why it happens:** The optimization is sound from a bandwidth perspective -- use the smaller payload. But the AI is not informed about the format semantics. The `buildMinimalUpdate()` method (ai-integration.js lines 340-513) handles this partially by extracting elements from either format (lines 382-394), but the AI never sees the raw delta metadata about what specifically changed. It just sees a list of elements without knowing which are new vs modified vs unchanged.

**Consequences:**
- AI cannot distinguish between "this element just appeared" and "this element was always there"
- Delta information (which elements changed) is computed but never reaches the AI's reasoning
- The AI may think a page completely changed when it received a compact_full after a delta

**Prevention:**
1. If sending delta format, annotate elements in the prompt with their change status: [NEW], [MODIFIED], [UNCHANGED]. The current code marks `el.isNew` but does not consistently propagate this to the prompt.
2. If switching from delta to compact_full, include a note in the prompt: "Full page snapshot (replacing previous delta view)."
3. Consider standardizing on one format: compact_full is simpler for the AI to interpret and the size difference is often marginal. The delta optimization saves tokens but adds complexity that may not be worth the AI confusion cost.
4. The `_isDelta` flag and `changes` object are already passed through (line 387-393) -- ensure `buildMinimalUpdate()` always extracts and presents elements consistently regardless of underlying format.

**Warning signs (detect early):**
- AI reasoning references element states that don't match the current DOM format
- AI says elements "disappeared" when they just weren't included in a compact_full snapshot
- Frequent format switching (delta one iteration, compact_full the next, delta again)

**Severity:** MINOR -- causes occasional AI confusion but not systematic failure
**Feature area:** DOM serialization / change detection

---

### Pitfall 12: Text Truncation Below Identification Threshold

**What goes wrong:** Element text is truncated to 50 chars in heavy compression mode (content.js line 511: `el.text.substring(0, heavyCompression ? 50 : this.config.textTruncateLength)`) and 100 chars in normal mode (DOMStateManager config line 169: `textTruncateLength: 100`). For contact names, product titles, article headlines, and conversation thread labels, 50-100 characters may not be enough to distinguish between similar items. The session log noted "Element text truncated to ~50 chars (can't identify people/items)."

**Why it happens:** Truncation is necessary for payload size. But the threshold was set generically rather than based on the information content of different element types. A navigation link needs only 20 chars ("Home", "Settings"). A contact name needs 30-50 chars ("Lakshman Turlapati - Software..."). A product title might need 80-120 chars to be unique.

**Consequences:**
- AI cannot distinguish between "John Smith - Software Engineer at Google" and "John Smith - Software Engineer at Microsoft" if both are truncated to "John Smith - Software Engineer a..."
- AI clicks the wrong conversation, wrong product, wrong contact
- Particularly bad for list-heavy pages (email inbox, search results, contact lists)

**Prevention:**
1. Use adaptive truncation: elements in lists (detected by repeated parent structure or aria-list roles) get longer text allowances (150-200 chars). Single-instance elements (buttons, headers) can be shorter (50 chars).
2. For elements that the AI needs to click from a list, include a distinguishing suffix even after truncation (e.g., the element's position index in the list: "[3/10] John Smith - Software Engi...").
3. Truncate from the middle rather than the end for long strings: "Lakshman...at Google" preserves both the person's name and their affiliation.
4. Set minimum text length per element type in the filterAndCompressElements function rather than using a single global threshold.

**Warning signs (detect early):**
- AI clicks the wrong item from a list (e.g., wrong contact, wrong email)
- Multiple elements in the payload have identical truncated text
- AI reasoning shows uncertainty about which element to interact with

**Severity:** MINOR -- causes wrong-target clicks, recoverable but annoying
**Feature area:** DOM serialization / element visibility

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation | Severity |
|---|---|---|---|
| Task completion detection | #1: AI self-report is unreliable, #8: No verification-action bridge | Build independent verification layer + critical action registry | CRITICAL |
| DOM serialization changes | #2: Format changes break AI, #7: Hash instability after scroll | Canonical format spec, remove position from hash | CRITICAL |
| Change detection overhaul | #6: MutationObserver perf regression, #11: Format switching confuses AI | Bounded mutation buffer, consistent format presentation | MODERATE |
| Memory preservation | #3: Compaction destroys context, #10: Compaction API failure | Minimum context floor, local fallback compaction | CRITICAL |
| CAPTCHA detection fix | #4: False positives on reCAPTCHA v3 scoring | Visibility check + dimension check on CAPTCHA elements | CRITICAL |
| Viewport detection fix | #5: Split-pane layouts, #9: Budget too aggressive | Scroll container awareness, dynamic element budget | MODERATE |
| Text truncation improvements | #12: Cannot distinguish list items | Adaptive truncation by element type and context | MINOR |

---

## Integration Risk: Changing Multiple Systems Simultaneously

The highest-risk scenario for this milestone is changing DOM serialization, conversation memory, AND completion detection at the same time. Each of these systems feeds into the others:

- DOM serialization provides the data the AI reasons about
- Conversation memory preserves the AI's reasoning across iterations
- Completion detection depends on both to make accurate judgments

**If DOM format changes break the AI's interpretation, completion detection will produce false positives/negatives, and the broken iterations will be compacted into memory, polluting future iterations.**

Mitigation: Change one system at a time. Validate each change with real-world tasks (LinkedIn messaging, Gmail compose, Google search) before proceeding to the next. The order should be:

1. Fix CAPTCHA detection (isolated, no downstream effects)
2. Fix viewport detection (isolated change in one function)
3. Fix DOM serialization/truncation (affects AI input, validate thoroughly)
4. Fix memory/compaction (affects AI context, validate with long tasks)
5. Add completion detection (depends on all above being stable)

---

## Sources

- FSB codebase analysis: `content.js`, `background.js`, `ai/ai-integration.js`, `utils/action-verification.js`, `utils/dom-state-manager.js`
- FSB session log analysis: `.planning/STATE.md` (10 systemic issues from LinkedIn session)
- [MDN: getBoundingClientRect()](https://developer.mozilla.org/en-US/docs/Web/API/Element/getBoundingClientRect) -- viewport-relative coordinate behavior
- [Chrome Bug 1171408](https://bugs.chromium.org/p/chromium/issues/detail?id=1171408) -- getBoundingClientRect incorrect values in extensions
- [MutationObserver memory leak discussion (WHATWG)](https://github.com/whatwg/dom/issues/482) -- observer memory management
- [Mozilla MutationObserver performance issue](https://github.com/mozilla/contain-facebook/issues/884) -- real-world extension performance
- [Redis: Context Window Overflow](https://redis.io/blog/context-window-overflow/) -- LLM context degradation patterns
- [JetBrains Research: Efficient Context Management](https://blog.jetbrains.com/research/2025/12/efficient-context-management/) -- observation masking vs summarization
- [Paddo.dev: Agent Browser Context Efficiency](https://paddo.dev/blog/agent-browser-context-efficiency/) -- DOM observation token waste
- [BrowserStack: Automate Failure Detection](https://www.browserstack.com/guide/automate-failure-detection-in-qa-workflow) -- false positive reduction
- [Browser-Use Agent Benchmark](https://browser-use.com/posts/ai-browser-agent-benchmark) -- completion evaluation pitfalls
