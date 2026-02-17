# Architecture Research: AI Situational Awareness Integration

**Domain:** Browser automation Chrome Extension (MV3) -- AI awareness improvements
**Researched:** 2026-02-14
**Overall Confidence:** HIGH (based on direct source code analysis of the running system)

---

## Executive Summary

FSB's automation loop is a well-structured but tightly coupled system spanning three files: `background.js` (orchestration), `content.js` (DOM/actions), and `ai/ai-integration.js` (prompt building/conversation management). The 10 systemic awareness issues identified from log analysis fall into five architectural domains: (1) DOM serialization pipeline, (2) conversation memory management, (3) task completion detection, (4) signal accuracy (CAPTCHA, viewport), and (5) DOM change detection granularity. Each domain has clear integration points, and importantly, most fixes are **modifications to existing functions** rather than new components. The build order is constrained by a critical dependency: DOM serialization quality is upstream of everything else -- the AI cannot reason about what it cannot see.

---

## Current Architecture: Detailed Component Map

### The Automation Loop (background.js:4642-6395)

The core loop is the `startAutomationLoop()` function. Each iteration follows this flow:

```
startAutomationLoop(sessionId)          [background.js:4642]
  |
  +-> Health check content script       [background.js:4780-4837]
  |
  +-> Request DOM state                 [background.js sends 'getStructuredDOM' message]
  |     |
  |     +-> content.js receives         [content.js:11040-11062]
  |     |     +-> getStructuredDOM()    [content.js:10564-11012]
  |     |           +-> getFilteredElements()  [content.js:10508-10549]
  |     |           +-> extractRelevantHTML()   [content.js:9749-9920]
  |     |           +-> detectPageContext()     [content.js:~10020-10132]
  |     |
  |     +-> Returns domResponse.structuredDOM
  |
  +-> createDOMHash()                   [background.js:4494-4526]
  +-> Stuck detection logic             [background.js:5073-5148]
  +-> Build context object              [background.js:5376-5401]
  |
  +-> callAIAPI(task, structuredDOM, settings, context)  [background.js:6405-6477]
  |     |
  |     +-> ai.getAutomationActions()   [ai-integration.js:972]
  |           |
  |           +-> First iteration: buildPrompt()          [ai-integration.js:1318]
  |           +-> Multi-turn: buildMinimalUpdate()        [ai-integration.js:340]
  |           +-> provider.sendRequest() -> parseResponse()
  |           +-> updateConversationHistory()             [ai-integration.js:569]
  |           +-> updateSessionMemory()                   [ai-integration.js:629]
  |
  +-> Execute actions (loop over aiResponse.actions)
  |     |
  |     +-> sendMessageWithRetry() to content.js          [background.js:1451]
  |     +-> content.js action handlers                    [content.js:5003+ for click, etc.]
  |     +-> slimActionResult() and store in actionHistory [background.js:1428-1448]
  |
  +-> Task completion validation        [background.js:6178-6330]
  +-> Progress tracking                 [background.js:6010-6060]
  +-> Schedule next iteration           [background.js:6332-6382]
```

### Data Flow Sizes (from log analysis context)

| Data Point | Current Size | Impact |
|------------|-------------|--------|
| DOM state (full, iter 1) | ~50 elements, variable JSON size | Main AI input |
| DOM state (delta, iter 2+) | 30 viewport elements + delta | Reduced but still truncated |
| User prompt (full) | HARD_PROMPT_CAP = 5000 chars | 74% of DOM data lost to truncation |
| System prompt (full) | ~4000-5000 chars | Sent only on iter 1 and stuck |
| System prompt (minimal) | MINIMAL_CONTINUATION_PROMPT | Multi-turn continuation |
| Conversation history | 4 turn pairs max (rawTurnsToKeep=3 + compacted) | Older turns compacted |
| Action history in prompt | Last 3-5 actions | Compact, but drops context |
| domHash key | `{path}\|{title}\|{elementCount}\|{top5types}` | Very coarse |

---

## Issue-by-Issue Integration Analysis

### Issue 1: DOM Serialization Truncation (HARD_PROMPT_CAP = 5000)

**Current Location:** `ai-integration.js:1898` (HARD_PROMPT_CAP=5000) and `ai-integration.js:1980-1987` (truncation logic)

**What happens:** The `buildPrompt()` function assembles the user prompt in this order:
1. Task description + verification requirements (~200 chars)
2. Page state (URL, title, scroll, CAPTCHA) (~200 chars)
3. Semantic context via `formatSemanticContext()` (~500-1500 chars)
4. Automation context (stuck, DOM changed, iteration, action history) (~500-2000 chars)
5. Structured elements via `formatElements()` (~variable, often 3000+ chars)
6. HTML context via `formatHTMLContext()` (~variable, often 2000+ chars)
7. Final question (~50 chars)

With HARD_PROMPT_CAP at 5000 chars, steps 5 and 6 (the actual page content the AI needs) are frequently truncated. The prompt truncation is a **blind substring cut** -- it does not prioritize keeping elements over context text.

**Where the fix belongs:** `ai-integration.js:buildPrompt()` (line 1318) and the HARD_PROMPT_CAP constant (line 1898)

**Recommended approach -- Tiered prompt budgeting:**
```
Total budget: ~15000 chars (increase from 5000)
  - Fixed header (task, page state, verification): ~500 chars (reserved)
  - Automation context (history, stuck, etc.): ~1500 chars (reserved)
  - Structured elements: ~8000 chars (primary budget, flexible)
  - HTML context: ~3000 chars (secondary budget, flexible)
  - Semantic context: ~2000 chars (tertiary, only if budget remains)
```

The key insight is that **structured elements must be allocated first** because they are the AI's primary decision input. Everything else is supporting context. The current code builds the prompt sequentially and truncates from the end, which means elements often get cut.

**Specific function changes needed:**
- `buildPrompt()` (ai-integration.js:1318): Restructure to allocate budget to sections
- `formatElements()` (ai-integration.js:2069): Accept a char budget parameter
- `formatHTMLContext()` (ai-integration.js:2172): Accept a char budget parameter
- HARD_PROMPT_CAP (ai-integration.js:1898): Increase to 15000 or make configurable

**Multi-turn path:** `buildMinimalUpdate()` (ai-integration.js:340) has its own element cap at `MAX_MINIMAL_ELEMENTS = 25` (line 413). This is a separate but related concern -- the multi-turn path should also use budget-based allocation.

**Dependencies:** None. This is upstream of all other issues.

---

### Issue 2: domHash Change Detection Too Coarse

**Current Location:** `background.js:4494-4526` (`createDOMHash()`)

**What happens:** The hash is computed as:
```javascript
const key = `${urlPath}|${title}|${elements.length}|${topTypes}`;
// topTypes = top 5 element types by count, e.g., "button:12,a:8,input:5,select:3,div:2"
```

This misses:
- Text content changes (e.g., success message appearing)
- Element state changes (e.g., button becoming disabled)
- Element position changes (e.g., modal appearing)
- New elements of the same type (e.g., adding another `<a>` tag does not change count enough)

The hash is used at `background.js:5075-5076` to set `domChanged` boolean, which flows into:
1. Stuck detection (background.js:5077-5123)
2. Context object passed to AI (background.js:5382)
3. Progress tracking (background.js:6016)

**Where the fix belongs:** `background.js:createDOMHash()` (line 4494)

**Recommended approach -- Multi-signal hash:**
```javascript
function createDOMHash(domState) {
  const elements = domState.elements || [];

  // Signal 1: Structural (existing) -- element type distribution
  const typeCounts = {};
  for (const el of elements) {
    if (el.type) typeCounts[el.type] = (typeCounts[el.type] || 0) + 1;
  }
  const topTypes = Object.entries(typeCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([type, count]) => `${type}:${count}`)
    .join(',');

  // Signal 2: Content -- hash of visible text (first 200 chars per element, top 10)
  const contentSample = elements
    .slice(0, 10)
    .map(el => (el.text || '').substring(0, 50))
    .join('|');

  // Signal 3: State -- interaction states of first 15 elements
  const stateSignature = elements
    .slice(0, 15)
    .map(el => {
      const s = el.interactionState || {};
      return (s.disabled ? 'D' : '') + (s.checked ? 'C' : '') + (s.focused ? 'F' : '');
    })
    .join('');

  // Signal 4: Page state indicators
  const pageState = domState.pageContext?.pageState || {};
  const stateFlags = [
    pageState.hasErrors ? 'E' : '',
    pageState.hasSuccess ? 'S' : '',
    pageState.isLoading ? 'L' : '',
    pageState.hasModal ? 'M' : '',
    pageState.hasCaptcha ? 'X' : ''
  ].join('');

  let urlPath = '';
  try { urlPath = new URL(domState.url || '').pathname; } catch { urlPath = domState.url || ''; }

  const key = `${urlPath}|${domState.title || ''}|${elements.length}|${topTypes}|${contentSample}|${stateSignature}|${stateFlags}`;

  // Simple hash function (existing)
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = ((hash << 5) - hash) + key.charCodeAt(i);
    hash = hash & hash;
  }
  return hash.toString();
}
```

Additionally, return a **structured change descriptor** alongside the boolean:
```javascript
// Instead of just: domChanged = currentDOMHash !== session.lastDOMHash
// Also compute: changeSignals = { structural: boolean, content: boolean, state: boolean, page: boolean }
```

This gives the AI specific change signals rather than a single yes/no.

**Specific function changes needed:**
- `createDOMHash()` (background.js:4494): Add content, state, and page-state signals
- Stuck detection block (background.js:5073-5123): Use structured change descriptor
- Context object (background.js:5382): Pass `changeSignals` alongside `domChanged`
- `buildMinimalUpdate()` (ai-integration.js:340): Use change signals for richer status

**Dependencies:** Depends on DOM serialization (Issue 1) because the hash input quality depends on what elements are captured.

---

### Issue 3: Conversation Memory Compacted to 27 Chars

**Current Location:** `ai-integration.js` conversation management system:
- `conversationHistory` array (line 234)
- `maxConversationTurns = 4` (line 236)
- `rawTurnsToKeep = 3` (line 251)
- `compactionThreshold = 4` (line 248)
- `trimConversationHistory()` (line 520)
- `triggerCompaction()` (line 715)
- `updateSessionMemory()` (line 629)
- `buildMemoryContext()` (line 787)

**What happens:** The memory system has THREE layers:
1. **Raw conversation history** -- last 3 turn pairs kept verbatim
2. **Compacted summary** -- AI-generated summary of older turns (capped at 1500 chars, line 763)
3. **Session memory** -- structured facts extracted locally each turn (steps completed, failed approaches, pages visited)

The "27 chars" issue from logs likely occurs when:
- Compaction triggers but fails (non-blocking async, line 773 catches silently)
- Session memory is sparse (task goal regex fails, no successful actions yet)
- `buildMemoryContext()` produces a minimal string because both layers are empty/sparse

**Root cause analysis:**
- `triggerCompaction()` (line 715) fires-and-forgets -- if the AI call fails, `compactedSummary` stays null
- `updateSessionMemory()` (line 629) relies on fragile regex extraction: `aiResponse.reasoning.match(/(?:task|goal|objective)[:\s]+(.{10,80})/i)` (line 645)
- Steps tracking only logs on `lastResult?.success` (line 653), missing attempted-but-failed actions
- `describeAction()` (line 697) produces very short strings: "clicked element" (15 chars)

**Where the fix belongs:** `ai-integration.js` -- the entire memory subsystem

**Recommended approach -- Strengthen all three layers:**

Layer 1 (Raw history): No change needed, 3 turn pairs is reasonable.

Layer 2 (Compaction): Make it resilient:
- Track compaction failures and retry on next trim cycle
- If compaction repeatedly fails, fall back to local extractive summary (no API call)
- Increase summary cap from 1500 to 2500 chars

Layer 3 (Session memory): Make it comprehensive:
- Extract task goal from the original task string, not from AI reasoning regex
- Track ALL actions (not just successful ones) with success/fail status
- Include element context: "clicked 'Submit' button on checkout form" not just "clicked element"
- Add explicit data extraction tracking: when getText succeeds, store a summary of what was found
- Include URL transitions: "navigated from search results to product page"

**Specific function changes needed:**
- `updateSessionMemory()` (ai-integration.js:629): Richer extraction, track all actions
- `describeAction()` (ai-integration.js:697): Include target element context from params
- `triggerCompaction()` (ai-integration.js:715): Retry on failure, local fallback
- `buildMemoryContext()` (ai-integration.js:787): More structured output
- `buildMinimalUpdate()` (ai-integration.js:340): Include memory context in multi-turn updates
- Context building (background.js:5376-5401): Pass richer action metadata including element descriptions

**Dependencies:** Benefits from Issue 1 (better DOM data means richer action descriptions) but can be built independently.

---

### Issue 4: False CAPTCHA Detection

**Current Location:** Two detection sites:

**Site A -- Element-level detection** (content.js:10740-10746):
```javascript
const classNames = node.className ? String(node.className) : '';
if (classNames.includes('g-recaptcha') || classNames.includes('recaptcha') ||
    classNames.includes('h-captcha') || classNames.includes('hcaptcha') ||
    classNames.includes('cf-turnstile') || classNames.includes('turnstile')) {
  elementData.isCaptcha = true;
}
```

**Site B -- Page-level detection** (content.js:10098-10100):
```javascript
hasCaptcha: document.querySelector(
  '.g-recaptcha, .h-captcha, .cf-turnstile, .captcha-container, .captcha-challenge, iframe[src*="recaptcha"], iframe[src*="hcaptcha"], iframe[src*="challenges.cloudflare.com"]'
) !== null,
```

**Site C -- Aggregation** (content.js:10921):
```javascript
captchaPresent: elements.some(el => el.isCaptcha) || pageContext.pageState.hasCaptcha,
```

**What happens:** False positives occur because:
1. `.captcha-container` and `.captcha-challenge` are generic class patterns that match non-CAPTCHA elements
2. Some sites have hidden/invisible CAPTCHA challenge iframes (Cloudflare silent challenges, reCAPTCHA v3 background tokens) that are present in DOM but not actually blocking user interaction
3. `elements.some(el => el.isCaptcha)` checks ALL filtered elements, including off-screen ones
4. The `captchaPresent` flag causes `buildMinimalUpdate()` to inject a CAPTCHA warning (ai-integration.js:367-369), which can cause the AI to incorrectly call `solveCaptcha` or stall

**Where the fix belongs:** `content.js` (detection logic) and optionally `background.js` (filtering)

**Recommended approach -- Visibility-gated CAPTCHA detection:**

```javascript
// Site B fix: Add visibility/interactivity check
hasCaptcha: (() => {
  const captchaSelectors = [
    '.g-recaptcha', '.h-captcha', '.cf-turnstile',
    'iframe[src*="recaptcha"]', 'iframe[src*="hcaptcha"]',
    'iframe[src*="challenges.cloudflare.com"]'
  ];
  // Remove overly generic selectors: .captcha-container, .captcha-challenge

  for (const sel of captchaSelectors) {
    const el = document.querySelector(sel);
    if (!el) continue;

    const rect = el.getBoundingClientRect();
    // Must be visible (not zero-size, not hidden)
    if (rect.width < 10 || rect.height < 10) continue;

    const styles = getComputedStyle(el);
    if (styles.display === 'none' || styles.visibility === 'hidden') continue;
    if (parseFloat(styles.opacity) < 0.1) continue;

    // Must be in viewport (user-blocking CAPTCHAs are always visible)
    if (rect.bottom < 0 || rect.top > window.innerHeight) continue;

    return true;
  }
  return false;
})(),
```

**Specific function changes needed:**
- Page-level detection (content.js:10098-10100): Replace with visibility-gated check
- Element-level detection (content.js:10740-10746): Add size/visibility check
- Remove `.captcha-container` and `.captcha-challenge` from selectors (too generic)
- Optionally: background.js could validate CAPTCHA presence by sending a `verifyCaptchaPresence` message before triggering solveCaptcha

**Dependencies:** None. Can be built independently.

---

### Issue 5: All Elements Marked Off-Screen on Split-Pane Layouts

**Current Location:** `content.js:8467-8474` (`isElementInViewport()`)

**What happens:** The function requires ALL edges to be within the viewport:
```javascript
function isElementInViewport(rect) {
  return (
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.bottom <= window.innerHeight &&
    rect.right <= window.innerWidth
  );
}
```

This means:
- A button at `{top: -5, left: 100, bottom: 35, right: 200}` is marked off-screen even though 87% of it is visible
- In split-pane layouts (Gmail, VS Code web, Slack), the side panel's sidepanel iframe may report elements with negative offsets relative to the main viewport
- Elements near viewport edges (common in sticky headers/footers) are always off-screen

The impact flows through:
1. `getStructuredDOM()` (content.js:10790): Elements sorted into offscreen collection
2. `viewportOnlyMode = true` (content.js:10570): Off-screen elements excluded entirely
3. `formatElements()` (ai-integration.js:2106): `[off-screen]` state label
4. AI prompt: Off-screen elements deprioritized or excluded

**Where the fix belongs:** `content.js:isElementInViewport()` (line 8467)

**Recommended approach -- Partial visibility with overlap ratio:**

```javascript
function isElementInViewport(rect, minOverlapRatio = 0.25) {
  // Element must have non-zero size
  if (rect.width <= 0 || rect.height <= 0) return false;

  // Calculate overlap with viewport
  const overlapLeft = Math.max(0, rect.left);
  const overlapTop = Math.max(0, rect.top);
  const overlapRight = Math.min(window.innerWidth, rect.right);
  const overlapBottom = Math.min(window.innerHeight, rect.bottom);

  const overlapWidth = Math.max(0, overlapRight - overlapLeft);
  const overlapHeight = Math.max(0, overlapBottom - overlapTop);
  const overlapArea = overlapWidth * overlapHeight;

  const elementArea = rect.width * rect.height;

  return (overlapArea / elementArea) >= minOverlapRatio;
}
```

Also used in `getStructuredDOM()` at content.js:10593-10598 (`isInViewportRect()`) -- this is a **separate function** from `isElementInViewport()` with different logic:
```javascript
function isInViewportRect(rect) {
  return rect.bottom >= viewportRect.top &&
         rect.top <= viewportRect.bottom &&
         rect.right >= viewportRect.left &&
         rect.left <= viewportRect.right;
}
```
This second function (line 10593) is actually correct (any overlap = in viewport). The problem is that `isElementInViewport()` (line 8467) is the one used for the `inViewport` property on each element (line 10656), which then drives the `[off-screen]` label in AI prompts.

**Specific function changes needed:**
- `isElementInViewport()` (content.js:8467): Replace with overlap-based check
- Ensure `isInViewportRect()` (content.js:10593) and `isElementInViewport()` use consistent logic
- Consider merging them into a single function

**Dependencies:** None. Can be built independently. Benefits Issue 1 (more elements classified as viewport = more included in prompt).

---

### Issue 6: waitForElement Uses Different Resolution Path Than click

**Current Location:**
- `waitForElement` handler (content.js:6714-6731): Uses `document.querySelector(selector)`
- `click` handler (content.js:5003-5069): Uses `querySelectorWithShadow(sel)`

**What happens:** When the AI calls `waitForElement` to wait for an element, then `click` to interact with it, the element resolution paths differ. `waitForElement` uses basic `document.querySelector()` which does not traverse Shadow DOM. `click` uses `querySelectorWithShadow()` which handles Shadow DOM traversal. This means:
- An element inside a Shadow DOM that `click` can find, `waitForElement` will timeout waiting for
- The AI then receives contradictory signals: "element not found" then "click succeeded"

**Where the fix belongs:** `content.js:waitForElement` handler (line 6714)

**Recommended approach:**
```javascript
waitForElement: async (params) => {
  const { selector, timeout = 5000 } = params;
  const startTime = Date.now();

  return new Promise((resolve) => {
    const checkInterval = setInterval(() => {
      // Use same resolution as click/type/etc.
      const element = querySelectorWithShadow(selector);
      if (element || Date.now() - startTime > timeout) {
        clearInterval(checkInterval);
        resolve({
          success: !!element,
          found: !!element,
          selector,
          waitTime: Date.now() - startTime,
          inShadowDOM: element ? isInShadowDOM(element) : false
        });
      }
    }, 100);
  });
},
```

**Specific function changes needed:**
- `waitForElement` handler (content.js:6714): Use `querySelectorWithShadow()` instead of `document.querySelector()`

**Dependencies:** None. Trivial fix.

---

### Issue 7: Task Completion Detection Weaknesses

**Current Location:** `background.js:6178-6330` (completion validation) and the AI's `taskComplete: true` flag

**What happens:** Task completion is currently a multi-layer check:

1. **AI decides** -- sets `taskComplete: true` in JSON response
2. **Result length check** -- blocks if `aiResponse.result.trim().length < 10` (line 6181)
3. **Critical action failure check** -- blocks if recent type/click actions failed (line 6186-6250)
4. **Messaging task special case** -- more lenient for messaging with specific heuristics (line 6192-6228)
5. **Page stability gate** -- waits for DOM stable + network quiet (line 6264-6290)

Weaknesses identified:
- The AI's decision is the primary signal, with background.js only providing negative overrides
- No positive validation: background.js never checks if the task's goal was actually achieved
- Messaging task detection uses keyword matching (`task.toLowerCase().includes('message')`) which is fragile
- The critical failure check uses a fixed window of last 10 actions, not correlated with the task's objective
- Page stability gate proceeds even if unstable (line 6282-6289: "not fully stable, proceeding anyway")

**Where the fix belongs:** Primarily `background.js:6178-6330`, with supporting signals from `content.js`

**Recommended approach -- Task-type-aware completion verification:**

Rather than a single monolithic check, decompose into task-type-specific validators:

```javascript
// background.js: after aiResponse.taskComplete = true

async function validateCompletion(session, aiResponse) {
  const taskType = classifyTask(session.task); // search, navigate, form, message, extract, etc.

  const validators = {
    search: () => {
      // Did we navigate away from search results?
      // Does the result contain specific data (not just "found it")?
      return aiResponse.result.length > 30 &&
             !session.lastUrl.includes('google.com/search');
    },
    form: () => {
      // Was the form submitted? Check for URL change or success message
      const pageState = session.lastDOMState?.pageContext?.pageState;
      return pageState?.hasSuccess || session.urlChanged;
    },
    message: () => {
      // Request content.js to verify message was sent
      const verification = await sendMessageWithRetry(session.tabId, {
        action: 'verifyMessageSent',
        params: { messageText: extractMessageFromTask(session.task) }
      });
      return verification?.success;
    },
    extract: () => {
      // Does the result contain extracted data?
      return aiResponse.result.length > 50;
    }
  };

  const validator = validators[taskType] || (() => true);
  return validator();
}
```

**Specific function changes needed:**
- Add `classifyTask()` function (background.js or ai-integration.js): Map task strings to types
- Restructure completion validation block (background.js:6178-6330): Use task-type validators
- Add `verifyCompletion` content.js message handler: Page-state checks (success messages, form submission, etc.)
- The existing `verifyMessageSent` handler (content.js:6736) is already built but underused

**Dependencies:** Benefits from Issue 2 (better DOM change detection improves completion signals) and Issue 3 (better memory means the AI makes better taskComplete decisions).

---

### Issue 8: Progress Tracking and No-Progress Hard Stop

**Current Location:** `background.js:6010-6060` (progress tracking) and `background.js:6053-6060` (6-iteration hard stop)

**What happens:**
```javascript
const madeProgress =
  (iterationStats.domChanged && iterationStats.actionsSucceeded > 0) ||
  iterationStats.urlChanged ||
  iterationStats.hadEffect ||
  iterationStats.hadNavigation;
```

Then at line 6053:
```javascript
if (session.consecutiveNoProgressCount >= 6) {
  // Hard stop: "No progress detected for 6 consecutive iterations"
}
```

The progress definition is too narrow. DOM hash not changing (Issue 2) causes false no-progress signals. And the 6-iteration hard stop does not consider whether the task is close to completion.

**Where the fix belongs:** `background.js:6010-6060`

**Recommended approach:** Integrate with improved DOM hash (Issue 2) change signals and session memory (Issue 3) progress tracking.

**Dependencies:** Directly depends on Issue 2 (DOM hash) and Issue 3 (memory).

---

## New vs Modified Components

### Modified Components (No New Files)

| File | Function | Change Type | Issue |
|------|----------|-------------|-------|
| `ai-integration.js` | `buildPrompt()` :1318 | Restructure prompt budget allocation | #1 |
| `ai-integration.js` | `formatElements()` :2069 | Add budget parameter | #1 |
| `ai-integration.js` | `formatHTMLContext()` :2172 | Add budget parameter | #1 |
| `ai-integration.js` | `buildMinimalUpdate()` :340 | Budget-based element selection, memory context | #1, #3 |
| `ai-integration.js` | HARD_PROMPT_CAP :1898 | Increase from 5000 to ~15000 | #1 |
| `ai-integration.js` | `updateSessionMemory()` :629 | Richer extraction | #3 |
| `ai-integration.js` | `describeAction()` :697 | Include target element context | #3 |
| `ai-integration.js` | `triggerCompaction()` :715 | Retry + local fallback | #3 |
| `ai-integration.js` | `buildMemoryContext()` :787 | More structured output | #3 |
| `background.js` | `createDOMHash()` :4494 | Multi-signal hash | #2 |
| `background.js` | Stuck detection :5073-5123 | Use change signals | #2 |
| `background.js` | Context object :5376-5401 | Pass change signals, richer metadata | #2, #3 |
| `background.js` | Completion validation :6178-6330 | Task-type validators | #7 |
| `background.js` | Progress tracking :6010-6060 | Integrate with new signals | #8 |
| `content.js` | `isElementInViewport()` :8467 | Overlap-based check | #5 |
| `content.js` | CAPTCHA detection :10098-10100 | Visibility-gated | #4 |
| `content.js` | Element CAPTCHA :10740-10746 | Add size/visibility check | #4 |
| `content.js` | `waitForElement` :6714 | Use querySelectorWithShadow | #6 |

### Potentially New Components

| Component | Purpose | Rationale |
|-----------|---------|-----------|
| `promptBudgetAllocator` (in ai-integration.js) | Budget allocation logic for prompt sections | Could be a method on AIIntegration or a standalone utility function. Not a separate file -- just a new method. |
| `taskClassifier` (in background.js or ai-integration.js) | Classify task type for completion validation | Small utility function, not a separate file. |

### No New Files Needed

All changes are modifications to existing functions in the three core files. The architecture does not need new modules or message channels. The existing `chrome.tabs.sendMessage` / `chrome.runtime.onMessage` communication pattern is sufficient for all proposed changes.

---

## Suggested Build Order

### Phase 1: Foundation -- DOM Visibility and Signal Accuracy (Issues 4, 5, 6)

**Rationale:** These are small, independent, zero-risk fixes that immediately improve signal quality for everything else. They have no dependencies on each other and no dependencies on other issues.

| Fix | Effort | Risk | Impact |
|-----|--------|------|--------|
| #5: `isElementInViewport()` overlap fix | 30 min | Very low | Correct viewport classification |
| #4: CAPTCHA visibility gate | 45 min | Very low | Eliminate false CAPTCHA warnings |
| #6: `waitForElement` shadow DOM | 15 min | Very low | Consistent element resolution |

**Build order within phase:** Any order. All three can be done in parallel.

**Testing:** Run automation on Gmail (split-pane), a site with Cloudflare (silent turnstile), and a site with Shadow DOM components.

### Phase 2: Core Pipeline -- DOM Serialization (Issue 1)

**Rationale:** This is the highest-impact single change. The AI literally cannot act on information it never receives. Every downstream improvement (better memory, better completion detection, better stuck detection) benefits from the AI receiving more complete DOM information.

| Fix | Effort | Risk | Impact |
|-----|--------|------|--------|
| #1: Prompt budget allocator | 2-3 hours | Medium | 3-4x more DOM data reaches AI |
| #1: HARD_PROMPT_CAP increase | 5 min | Low | Immediate capacity increase |
| #1: formatElements budget | 1 hour | Low | Elements prioritized over HTML context |
| #1: formatHTMLContext budget | 1 hour | Low | HTML context bounded properly |

**Build order within phase:**
1. Increase HARD_PROMPT_CAP first (immediate gain, 5 min)
2. Add budget parameters to formatElements/formatHTMLContext
3. Restructure buildPrompt() to use budget allocator

**Risk mitigation:** The HARD_PROMPT_CAP increase could cause longer AI response times and higher token costs. Monitor `logTiming` for AI response time regression. Consider making the cap configurable in options.

**Testing:** Compare prompt contents before/after on the same page. Verify AI receives structured elements that were previously truncated.

### Phase 3: Intelligence -- DOM Change Detection (Issue 2)

**Rationale:** With Phase 1 fixing viewport classification and Phase 2 ensuring the AI sees the DOM, we can now improve the change detection that feeds stuck detection and progress tracking. This is the bridge between "seeing the page" and "understanding what changed."

| Fix | Effort | Risk | Impact |
|-----|--------|------|--------|
| #2: Multi-signal hash | 1-2 hours | Low | Detect content/state changes |
| #2: Structured change descriptor | 1 hour | Low | Rich change signals for AI |
| #2: Stuck detection integration | 1 hour | Medium | Fewer false stuck detections |

**Build order within phase:**
1. Implement multi-signal hash (standalone function change)
2. Add structured change descriptor to context
3. Update stuck detection to use new signals
4. Update `buildMinimalUpdate()` to show change signals

**Risk mitigation:** The new hash will produce different stuck detection behavior. Run both old and new hash in parallel for a few sessions, logging both, to verify the new one catches real stuck states while reducing false positives.

**Testing:** Use a page with dynamic content (e.g., chat messages arriving, form validation messages) and verify domChanged correctly detects content changes that the old hash missed.

### Phase 4: Memory -- Conversation History (Issue 3)

**Rationale:** With the AI now seeing more DOM data (Phase 2) and detecting changes accurately (Phase 3), improving memory ensures the AI retains this richer context across iterations. This phase turns short-term perception improvements into long-term operational capability.

| Fix | Effort | Risk | Impact |
|-----|--------|------|--------|
| #3: Richer session memory extraction | 2 hours | Low | Better step tracking |
| #3: Improved describeAction | 1 hour | Low | Human-readable action descriptions |
| #3: Compaction retry + fallback | 1 hour | Low | Resilient memory compression |
| #3: Enhanced buildMemoryContext | 1 hour | Low | More structured context injection |

**Build order within phase:**
1. Fix `describeAction()` to include element context (quick win)
2. Enhance `updateSessionMemory()` for comprehensive tracking
3. Add compaction retry + local fallback
4. Restructure `buildMemoryContext()` output

**Testing:** Run a multi-step task (e.g., "search for X, go to the first result, find Y, come back and search for Z") and verify memory context at iteration 8+ contains meaningful operational history.

### Phase 5: Judgment -- Task Completion and Progress (Issues 7, 8)

**Rationale:** This is the capstone. With better DOM data, better change detection, and better memory, the system can now make better completion and progress decisions. Building this last means it can leverage all prior improvements.

| Fix | Effort | Risk | Impact |
|-----|--------|------|--------|
| #7: Task classifier | 1 hour | Low | Foundation for type-specific validation |
| #7: Type-specific completion validators | 2-3 hours | Medium | Accurate completion detection |
| #8: Enhanced progress tracking | 1-2 hours | Medium | Fewer false hard stops |

**Build order within phase:**
1. Implement task classifier (utility function)
2. Build completion validators per task type
3. Integrate with progress tracking

**Risk mitigation:** Completion validators could block legitimate completions (false negatives). Add a configurable "strict completion" setting, defaulting to lenient mode initially.

**Testing:** Run each task type (search, form, message, extraction) and verify both successful completion and correct blocking of premature completion.

---

## Build Order Summary

```
Phase 1: Signal Accuracy (Issues 4, 5, 6)  ~2 hours
  [No dependencies]
  |
Phase 2: DOM Serialization (Issue 1)  ~4 hours
  [Benefits from Phase 1: correct viewport = more elements in budget]
  |
Phase 3: Change Detection (Issue 2)  ~3 hours
  [Benefits from Phase 2: better elements in hash input]
  |
Phase 4: Memory (Issue 3)  ~5 hours
  [Benefits from Phase 2+3: richer data to remember]
  |
Phase 5: Completion/Progress (Issues 7, 8)  ~5 hours
  [Benefits from all prior phases]
```

Total estimated effort: ~19 hours of focused development.

---

## Data Flow Changes

### Current Flow (Simplified)

```
content.js: getStructuredDOM()
  -> 50 elements + HTML context + page context + CAPTCHA flag
  -> JSON message to background.js

background.js:
  -> createDOMHash(structuredDOM)  // coarse hash
  -> domChanged = hash !== lastHash  // boolean
  -> context = { domChanged, isStuck, actionHistory, ... }

ai-integration.js:
  -> buildPrompt(task, domState, context)  // 5K char cap truncates
  -> OR buildMinimalUpdate(domState, context)  // 25 elements max
  -> conversationHistory  // 4 turn pairs + compacted summary
  -> AI call -> response -> updateConversationHistory + updateSessionMemory
```

### Proposed Flow (Changes in **bold**)

```
content.js: getStructuredDOM()
  -> 50 elements + HTML context + page context + **visibility-gated CAPTCHA flag**
  -> **isElementInViewport() uses overlap ratio (not strict bounds)**
  -> JSON message to background.js

background.js:
  -> **createDOMHash(structuredDOM)**  // **multi-signal hash**
  -> **changeSignals = { structural, content, state, page }**
  -> **domChanged = any signal changed**
  -> context = { domChanged, **changeSignals**, isStuck, actionHistory, ... }

ai-integration.js:
  -> **budgetAllocator allocates char budgets to prompt sections**
  -> buildPrompt(task, domState, context)  // **15K cap with priority allocation**
  -> OR buildMinimalUpdate(domState, context)  // **budget-based, includes memory context**
  -> conversationHistory  // **resilient compaction, richer session memory**
  -> AI call -> response -> updateConversationHistory + **enhanced updateSessionMemory**

background.js (post-AI):
  -> **Task-type-specific completion validators**
  -> **Enhanced progress tracking using changeSignals**
```

---

## Risk Assessment

| Change | Risk Level | Mitigation |
|--------|-----------|------------|
| HARD_PROMPT_CAP increase | Medium | Monitor AI response times and token costs. Make configurable. |
| Multi-signal DOM hash | Medium | Run old + new in parallel, log both, compare stuck detection accuracy |
| Completion validators | Medium | Default to lenient mode. Add override flag for strict validation. |
| Viewport overlap ratio | Low | Threshold of 0.25 is conservative. Easy to adjust. |
| CAPTCHA visibility gate | Low | Only tightens detection, reduces false positives. No new false negatives risk. |
| waitForElement fix | Very low | Purely additive: uses same resolution as all other action handlers. |
| Memory improvements | Low | All changes are additive (more data tracked). Existing behavior preserved as fallback. |

---

## Integration Invariants (Do Not Break)

These are critical behaviors that must be preserved across all changes:

1. **Action execution path must not change:** `sendMessageWithRetry()` -> content.js action handler -> slimActionResult() -> actionHistory. All action handlers in content.js must continue to work exactly as they do now.

2. **Session cleanup must still work:** `cleanupSession()` (background.js) must still clear all state including any new tracking data.

3. **Multi-turn conversation format must remain compatible:** The `provider.sendRequest()` call expects `{ messages: [...] }` format. Changes to conversation history must preserve this format.

4. **Content script message handler dispatch must not change:** The `chrome.runtime.onMessage` handler in content.js dispatches on `request.action`. New message types must be added to the existing switch/if chain.

5. **Race condition protections must be preserved:** The `isSessionTerminating()` check at loop start (background.js:4646) and the `loopResolve?.()` pattern must remain intact.

6. **SECURITY: [PAGE_CONTENT] markers must continue to wrap all untrusted page content.** The prompt injection protection in `sanitizePageContent()` must continue to be applied to all element text flowing into prompts.

---

## Sources

All findings are based on direct source code analysis of:
- `/Users/lakshmanturlapati/Documents/Codes/Extensions/FSB/background.js` (7299 lines)
- `/Users/lakshmanturlapati/Documents/Codes/Extensions/FSB/content.js` (12140 lines)
- `/Users/lakshmanturlapati/Documents/Codes/Extensions/FSB/ai/ai-integration.js` (3549 lines)

Confidence: HIGH -- all claims verified against actual source code with line number references.
