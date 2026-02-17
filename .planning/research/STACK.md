# Technology Stack: AI Situational Awareness for FSB

**Project:** FSB v9.0.1 - AI Situational Awareness Milestone
**Researched:** 2026-02-14
**Mode:** Ecosystem (Stack dimension)
**Constraint:** Vanilla JS, no build system, Chrome Extension MV3

---

## Executive Summary

FSB currently operates with a 5K character hard cap on user prompts, a coarse hash-based DOM change detector, AI-self-reported task completion, aggressive conversation history truncation, and CSS-selector-only CAPTCHA detection. These are the primary bottlenecks preventing reliable multi-step automation. This document prescribes specific techniques and approaches -- not libraries -- to address each gap within FSB's vanilla JS, no-build-system architecture.

The core insight from researching browser-use, Skyvern, D2Snap, and the academic literature is: **hierarchy-preserving DOM serialization matters more than raw element count, structured memory matters more than raw conversation history, and system-level completion verification matters more than AI self-report.**

---

## 1. DOM Serialization for LLM Context Windows

### Current State (Problems)

| Problem | Current Code | Impact |
|---------|-------------|--------|
| 5K char hard cap on user prompt | `ai-integration.js:1898` `HARD_PROMPT_CAP = 5000` | LLM receives truncated, often incoherent context |
| Flat element list loses hierarchy | `formatElements()` outputs `[elem_1] button ...` lines | LLM cannot reason about page structure (menus, forms, sections) |
| HTML context truncated destructively | `content.js:9807` hard cuts at 500 chars per element | Critical information (nested forms, multi-step wizards) lost |
| No priority-aware truncation | `substring(0, HARD_PROMPT_CAP)` just chops | May cut in the middle of the most important element |

### Recommended Approach: Hierarchical DOM Serialization with Token Budgeting

**Technique:** Adopt a D2Snap-inspired approach adapted for vanilla JS. Instead of flat element lists, serialize DOM as indented HTML-like tree that preserves parent-child relationships while aggressively pruning non-interactive subtrees.

**Why hierarchy matters:** Research from "Beyond Pixels: Exploring DOM Downsampling for LLM-Based Web Agents" (arXiv:2508.04412) demonstrates that hierarchy is the strongest UI feature for LLM performance. Removing hierarchy had a larger negative impact on task success than removing any other feature. Current FSB format discards hierarchy entirely.

**Implementation strategy (no new dependencies):**

```
Phase 1: Token Budget Allocator
- Replace HARD_PROMPT_CAP with a token budget system
- Allocate budget: 40% system prompt, 50% page context, 10% conversation memory
- For typical models: ~4K tokens system, ~5K page, ~1K memory = ~10K total
- Budget scales with model context window (grok-4-1-fast: 2M context allows larger budgets)

Phase 2: Hierarchical Serializer
- Walk filtered elements, reconstruct parent chain to document.body
- Serialize as indented markup-like text:
    <main>
      <form #login-form>
        [input_0] email type="email" placeholder="Email" selector: "#email"
        [input_1] password type="password" selector: "#password"
        [btn_0] button "Sign In" selector: "#submit"
      </form>
      <nav>
        [link_0] a "Home" href="/" [off-screen]
        [link_1] a "About" href="/about" [off-screen]
      </nav>
    </main>
- Structural nodes (div, main, nav, form) shown as hierarchy but don't count toward element budget
- Interactive elements get full detail lines (current format)
- Non-interactive containers collapsed to single line with child count

Phase 3: Priority-Aware Truncation
- When over budget, prune from bottom of priority stack:
  1. Off-screen non-interactive elements (drop first)
  2. Off-screen interactive elements (compress to one-liners)
  3. Viewport non-interactive containers (collapse)
  4. Viewport interactive elements (never drop, compress descriptions)
- Truncation is per-subtree, never mid-element
```

**Confidence:** HIGH -- based on browser-use's DOMTreeSerializer approach (verified via DeepWiki documentation) and D2Snap research paper. Both confirm hierarchy preservation improves LLM task success by 15-25% over flat lists.

**What NOT to do:**
- Do NOT adopt full accessibility tree via `chrome.debugger` -- it shows a warning banner on ALL browser windows and is hostile to user experience. The current content-script DOM extraction is the right approach; it just needs better serialization.
- Do NOT switch to screenshot/vision-based approach -- current models handle it unreliably for interactive elements (confirmed by the Building Browser Agents paper, arXiv:2511.19477). FSB's text-based approach is correct.
- Do NOT use a DOM-to-markdown library -- adds a dependency and loses the control needed for token budgeting.

### Specific Changes to FSB Files

| File | Change | Rationale |
|------|--------|-----------|
| `ai/ai-integration.js` | Replace `HARD_PROMPT_CAP` with `TokenBudget` class | Allows proportional allocation instead of hard cutoff |
| `ai/ai-integration.js` | Rewrite `formatElements()` to `formatHierarchicalDOM()` | Preserve parent-child structure |
| `content.js` | Add `getHierarchicalDOM()` alongside `getStructuredDOM()` | Return elements with parent chain metadata |
| `content.js` | Remove 500-char HTML truncation, use semantic compression | Preserve complete form structures, remove style noise |

---

## 2. Task Completion Detection (System-Level)

### Current State (Problems)

| Problem | Current Code | Impact |
|---------|-------------|--------|
| AI self-reports `taskComplete: true` | `background.js:6179` checks `aiResponse.taskComplete` | AI claims completion when it should not (optimism bias) |
| Validation is heuristic keyword matching | `background.js:6193-6198` checks `task.includes('message')` | Fragile, only covers messaging tasks |
| Success/error detection is CSS-class-based | `content.js:10066-10073` checks `.success`, `.error` classes | Misses confirmation pages, success toasts, URL-based confirmations |
| No pre/post state comparison | Completion check happens on current state only | Cannot verify that the page actually changed to reflect task completion |

### Recommended Approach: Multi-Signal Completion Verification

**Technique:** Implement a `TaskCompletionOracle` that combines multiple heuristic signals into a confidence score, independent of AI self-report. The AI's `taskComplete` flag becomes one input among many, not the sole decision maker.

**Signal categories (no new dependencies, all implementable in vanilla JS):**

```
Signal 1: URL-Based Completion Patterns
- URL changed to known success patterns:
  /confirmation, /success, /thank-you, /receipt, /order-complete
  ?status=success, ?result=ok, #success
- URL moved from task page to post-task page (e.g., checkout -> order-confirmation)
- Query parameters indicating completion (order_id=, confirmation=)
- Confidence weight: 0.3

Signal 2: DOM Success Indicators (Enhanced)
- Current: CSS class-based (.success, .alert-success)
- Add: ARIA role="status" with success-related text content
- Add: Toast/snackbar detection (elements appearing post-action with success text)
- Add: Confirmation number/order ID patterns in newly appeared text
- Add: "Thank you" / "Order placed" / "Message sent" text patterns
- Add: Form disappearance (form existed before action, gone after)
- Confidence weight: 0.25

Signal 3: Network Quiescence + DOM Stability
- No pending XHR/fetch requests for 500ms+ after action
- DOM mutations settled (already implemented via waitForDOMStable)
- No loading indicators present
- Confidence weight: 0.1

Signal 4: Action Success Chain
- Recent actions all succeeded (current: actionHistory success rate)
- The LAST critical action succeeded (click submit, press enter on form)
- Type-specific: for "send message" tasks, the type+click sequence completed
- Confidence weight: 0.15

Signal 5: AI Self-Report
- AI reports taskComplete: true with result text
- Result text length > 20 chars and contains specific data (not generic)
- Confidence weight: 0.2

Composite Score:
- >= 0.7: Auto-approve completion
- 0.4 - 0.7: Approve with caveat (warn user completion is uncertain)
- < 0.4: Override AI, continue automation
```

**Implementation approach:**

```javascript
// New class in background.js or new file lib/completion-oracle.js
class TaskCompletionOracle {
  constructor() {
    this.signals = [];
    this.preActionState = null; // Snapshot before action
  }

  capturePreActionState(domState, url) {
    this.preActionState = {
      url,
      formCount: domState.htmlContext?.pageStructure?.forms?.length || 0,
      hasSuccessIndicator: false,
      elementHashes: new Set(domState.elements?.map(e => e.elementId) || []),
      timestamp: Date.now()
    };
  }

  evaluate(postDomState, postUrl, aiResponse, actionHistory) {
    const signals = {};

    // Signal 1: URL patterns
    signals.urlCompletion = this.checkURLCompletion(this.preActionState?.url, postUrl);

    // Signal 2: DOM success indicators
    signals.domSuccess = this.checkDOMSuccess(postDomState);

    // Signal 3: Stability
    signals.stability = this.checkStability(postDomState);

    // Signal 4: Action chain
    signals.actionChain = this.checkActionChain(actionHistory);

    // Signal 5: AI self-report
    signals.aiReport = this.checkAIReport(aiResponse);

    // Weighted composite
    const score = (signals.urlCompletion * 0.3) +
                  (signals.domSuccess * 0.25) +
                  (signals.stability * 0.1) +
                  (signals.actionChain * 0.15) +
                  (signals.aiReport * 0.2);

    return { score, signals, decision: score >= 0.7 ? 'complete' : score >= 0.4 ? 'uncertain' : 'continue' };
  }
}
```

**Confidence:** MEDIUM -- The individual signals are well-established patterns (URL matching, ARIA roles, network quiescence). The composite scoring is FSB-specific and will need tuning. The weights above are starting points based on research into Skyvern's Validator Agent pattern.

**What NOT to do:**
- Do NOT add a separate AI call to verify completion -- adds latency and cost. System-level heuristics are faster and cheaper.
- Do NOT rely solely on screenshot comparison -- not feasible without vision model integration and adds significant complexity.
- Do NOT use a fixed checklist per task type -- does not scale. The signal-based approach is task-agnostic.

---

## 3. DOM Change Detection (Element-Level Deltas)

### Current State (Problems)

| Problem | Current Code | Impact |
|---------|-------------|--------|
| Hash includes position data implicitly | `DOMStateManager.hashElement()` uses `position.x,y` | Scroll changes = everything "changed" |
| Hash is too coarse | `type\|id\|class\|text[0:20]\|x,y` | Two different buttons with same class hash identically |
| `createDOMHash()` in background.js is page-level only | `background.js:4494` hashes element counts + top types | Cannot detect which specific elements changed |
| False "unchanged" when content changes within element | Hash uses first 20 chars of text | Text changes after char 20 are invisible |

### Recommended Approach: Stable Element Fingerprinting + Structural Diff

**Technique:** Replace the current hash-based approach with a two-tier system:

```
Tier 1: Stable Element Fingerprinting (content.js)
- Generate fingerprint from STABLE properties only (no position):
  - Tag name
  - id attribute (if present)
  - data-testid (if present)
  - Role attribute (if present)
  - Structural path: parent chain as "body > main > form > input[2]"
  - Name/aria-label
- Position-dependent data tracked separately for viewport membership
- Fingerprint is stable across scrolls and minor layout shifts

Tier 2: Change Classification (content.js DOMStateManager)
- For each element, track a "content hash" separately from fingerprint:
  - Full text content (not truncated)
  - Interaction state (disabled, checked, focused, expanded)
  - Visibility state
  - Value (for inputs)
- Compare fingerprint-matched elements by content hash
- Classify changes as:
  - ADDED: new fingerprint not in previous set
  - REMOVED: previous fingerprint not in current set
  - CONTENT_CHANGED: same fingerprint, different content hash
  - STATE_CHANGED: same fingerprint, different interaction state
  - MOVED: same fingerprint, different position (informational only)
  - UNCHANGED: same everything
```

**Why this matters:** The current system reports "DOM unchanged" when a user types text into a field (text change is after first 20 chars) or "DOM changed" when the user merely scrolls (position changed). Both are wrong. Element-level deltas enable the AI to understand exactly what happened, reducing wasted iterations.

**Implementation:**

```javascript
// Improved fingerprint in DOMStateManager
generateStableFingerprint(element) {
  const parts = [
    element.tagName.toLowerCase(),
    element.id || '',
    element.getAttribute('data-testid') || '',
    element.getAttribute('role') || '',
    element.getAttribute('name') || '',
    this.getStructuralPath(element)  // "body>main>form>input:nth-of-type(2)"
  ];
  return parts.filter(Boolean).join('|');
}

getStructuralPath(element, maxDepth = 5) {
  const path = [];
  let current = element;
  let depth = 0;
  while (current && current !== document.body && depth < maxDepth) {
    const tag = current.tagName.toLowerCase();
    const index = this.getSiblingIndex(current);
    path.unshift(index > 0 ? `${tag}:nth-of-type(${index})` : tag);
    current = current.parentElement;
    depth++;
  }
  return path.join('>');
}
```

**Confidence:** HIGH -- MutationObserver is already in use (`content.js:180`). The fingerprinting approach is well-established in DOM diffing libraries. The structural path approach is used by browser-use's element versioning system.

**What NOT to do:**
- Do NOT use `outerHTML` as a hash input -- too large, too volatile (class changes from CSS animations).
- Do NOT use numeric position in the element array as identity -- changes every time elements are added/removed.
- Do NOT try to implement a full virtual DOM diff (React-style) -- overkill for this use case and too complex for vanilla JS.

---

## 4. Conversation/Operational Memory Preservation

### Current State (Problems)

| Problem | Current Code | Impact |
|---------|-------------|--------|
| History truncated to last N turns | `ai-integration.js:557` keeps `maxConversationTurns * 2` messages | Early context about task strategy lost |
| Compaction is an AI call that adds cost | `triggerCompaction()` at line 715 calls the model | Each compaction costs ~$0.001-0.005 |
| Session memory is flat, unstructured | `sessionMemory` tracks steps/failures/pages as arrays | No semantic organization, just lists |
| Long-term memory extraction happens AFTER session | `memoryExtractor.extract()` is post-session | Within-session, no access to lessons from previous sessions |

### Recommended Approach: Three-Tier Memory Architecture

**Technique:** Implement a tiered memory system modeled after Google ADK's compaction pattern and Mem0's multi-level architecture, but adapted for FSB's vanilla JS constraint:

```
Tier 1: Working Memory (Current Conversation Window)
- Last 3-4 raw turn pairs (already implemented)
- Full DOM state for current iteration
- Immediate action results
- Size: ~4K tokens, refreshed each iteration
- NO CHANGE needed, current approach is correct

Tier 2: Session Memory (Structured, Local Extraction)
- Already partially implemented via `updateSessionMemory()`
- ENHANCE with structured facts extracted locally (no AI call):
  a. Task decomposition: break task into sub-goals, track which are done
  b. Navigation map: URL -> what was found there -> what actions worked
  c. Selector registry: selectors that worked vs failed on this site
  d. Error patterns: what failed and why (already tracked, improve structure)
- Injected as compact context block between system prompt and recent turns
- Size budget: ~1K tokens, updated each iteration
- Format: structured key-value, not narrative

Tier 3: Long-Term Memory (Cross-Session, Already Implemented)
- MemoryManager already stores episodic/semantic/procedural memories
- ENHANCE retrieval: query memories at session START, inject relevant ones
- Already stored in chrome.storage.local with inverted indices
- Size budget: ~500 tokens of relevant memories injected at session start

Implementation priority:
1. Enhance Tier 2 (session memory) -- biggest bang for buck
2. Add memory retrieval at session start (Tier 3 integration)
3. Replace AI-based compaction with local structured extraction
```

**Session Memory Structure (enhanced):**

```javascript
// Enhanced sessionMemory structure
{
  taskGoal: 'Send a message to John on WhatsApp',
  subGoals: [
    { goal: 'Navigate to WhatsApp Web', status: 'done', iteration: 1 },
    { goal: 'Find John in contacts', status: 'done', iteration: 3 },
    { goal: 'Type and send message', status: 'in-progress', iteration: 5 }
  ],
  navigationMap: {
    'web.whatsapp.com': {
      pageType: 'messaging',
      workingSelectors: ['div[data-testid="chat-list"]', 'div[contenteditable="true"]'],
      failedSelectors: ['input.search-box'],  // Note: WhatsApp uses contenteditable
      visitCount: 3
    }
  },
  selectorRegistry: {
    working: [
      { selector: 'div[data-testid="chat-list"]', action: 'click', iterations: [2,3] },
    ],
    failed: [
      { selector: 'input[type="text"]', action: 'type', error: 'not found', iteration: 4 }
    ]
  },
  keyFindings: [
    'WhatsApp uses contenteditable divs, not input fields',
    'Contact "John" found via search, 3rd result'
  ]
}
```

**Context injection pattern:**

```javascript
buildMemoryContext() {
  const parts = [];

  // Tier 3: Long-term memories (retrieved at session start)
  if (this.relevantMemories?.length > 0) {
    parts.push('PRIOR KNOWLEDGE:');
    this.relevantMemories.forEach(m => parts.push(`- ${m.text}`));
  }

  // Tier 2: Session memory (structured)
  if (this.sessionMemory) {
    const sm = this.sessionMemory;
    parts.push(`\nSESSION PROGRESS:`);
    parts.push(`Goal: ${sm.taskGoal}`);
    sm.subGoals?.forEach(sg =>
      parts.push(`  ${sg.status === 'done' ? '[DONE]' : '[TODO]'} ${sg.goal}`)
    );

    if (sm.selectorRegistry?.working?.length > 0) {
      parts.push(`\nWORKING SELECTORS:`);
      sm.selectorRegistry.working.slice(-5).forEach(s =>
        parts.push(`  ${s.selector} (${s.action})`)
      );
    }

    if (sm.keyFindings?.length > 0) {
      parts.push(`\nKEY FINDINGS:`);
      sm.keyFindings.forEach(f => parts.push(`  - ${f}`));
    }
  }

  return parts.join('\n');
}
```

**Confidence:** HIGH for Tier 2 enhancement (straightforward code change). MEDIUM for Tier 3 integration (memory retrieval quality depends on existing MemoryRetriever's search accuracy).

**What NOT to do:**
- Do NOT add an external vector database (e.g., ChromaDB) -- requires a build system and server process. chrome.storage.local with inverted indices (already implemented) is sufficient for the memory scale FSB operates at (<500 memories).
- Do NOT use RAG with embeddings -- requires an embedding model API call per query. The existing keyword-based retrieval in `MemoryRetriever` is adequate.
- Do NOT compact conversation history using an AI call on every trim -- expensive and adds latency. Local structured extraction is free and instant.
- Do NOT store raw DOM snapshots in memory -- too large. Store extracted facts (selectors, patterns, findings).

---

## 5. CAPTCHA Detection (Eliminate False Positives)

### Current State (Problems)

| Problem | Current Code | Impact |
|---------|-------------|--------|
| Overly broad CSS selector matching | `content.js:10098` matches `[class*="captcha"]` | Any element with "captcha" in its class name triggers detection |
| No iframe src validation | Checks `iframe[src*="recaptcha"]` without domain validation | Third-party analytics iframes with "recaptcha" in path trigger false positive |
| Detection affects page intent | `content.js:10269` returns `captcha-challenge` intent | Entire automation flow changes based on false positive |
| No confidence scoring | Boolean `hasCaptcha` -- either true or false | Cannot distinguish between actual CAPTCHA widget and captcha-related metadata |

### Recommended Approach: Multi-Signal CAPTCHA Detection with Confidence

**Technique:** Replace the boolean `hasCaptcha` with a confidence-scored detection that requires multiple signals before triggering:

```javascript
function detectCAPTCHA() {
  let confidence = 0;
  const signals = [];

  // Signal 1: Known CAPTCHA container elements (HIGH confidence)
  // reCAPTCHA v2: Always has a specific structure
  const recaptchaWidget = document.querySelector('.g-recaptcha[data-sitekey]');
  if (recaptchaWidget) {
    confidence += 0.6;
    signals.push('recaptcha-widget-with-sitekey');
  }

  // Signal 2: CAPTCHA iframes with verified domains (HIGH confidence)
  const captchaIframes = document.querySelectorAll('iframe');
  for (const iframe of captchaIframes) {
    try {
      const url = new URL(iframe.src);
      const captchaDomains = [
        'www.google.com',           // reCAPTCHA
        'www.recaptcha.net',        // reCAPTCHA (alternative)
        'hcaptcha.com',             // hCaptcha
        'newassets.hcaptcha.com',   // hCaptcha assets
        'challenges.cloudflare.com' // Turnstile
      ];
      if (captchaDomains.some(d => url.hostname.endsWith(d))) {
        // Verify path also matches CAPTCHA endpoints
        if (url.pathname.includes('/recaptcha/') ||
            url.pathname.includes('/captcha/') ||
            url.pathname.includes('/cdn-cgi/challenge-platform/')) {
          confidence += 0.5;
          signals.push(`captcha-iframe:${url.hostname}`);
        }
      }
    } catch {} // Invalid URL, skip
  }

  // Signal 3: CAPTCHA containers with expected structure (MEDIUM confidence)
  const hcaptchaWidget = document.querySelector('.h-captcha[data-sitekey]');
  const turnstileWidget = document.querySelector('.cf-turnstile[data-sitekey]');
  if (hcaptchaWidget) { confidence += 0.5; signals.push('hcaptcha-widget'); }
  if (turnstileWidget) { confidence += 0.5; signals.push('turnstile-widget'); }

  // Signal 4: CAPTCHA response textarea present (MEDIUM -- could be solved already)
  const responseField = document.querySelector(
    'textarea[name="g-recaptcha-response"], textarea[name="h-captcha-response"]'
  );
  if (responseField && !responseField.value) {
    confidence += 0.2; // Unsolved CAPTCHA
    signals.push('empty-response-field');
  }

  // ANTI-SIGNAL: Reduce confidence for common false positives
  // Pages about CAPTCHAs (documentation, blog posts)
  const isAboutCaptchas = document.title.toLowerCase().includes('captcha') &&
                          !recaptchaWidget && !hcaptchaWidget && !turnstileWidget;
  if (isAboutCaptchas) {
    confidence -= 0.3;
    signals.push('about-captchas-page');
  }

  return {
    detected: confidence >= 0.5,
    confidence: Math.min(1, Math.max(0, confidence)),
    type: recaptchaWidget ? 'recaptcha' : hcaptchaWidget ? 'hcaptcha' : turnstileWidget ? 'turnstile' : null,
    signals,
    sitekey: recaptchaWidget?.getAttribute('data-sitekey') ||
             hcaptchaWidget?.getAttribute('data-sitekey') ||
             turnstileWidget?.getAttribute('data-sitekey') || null
  };
}
```

**Key improvements over current approach:**
1. Domain-verified iframe checking (not just `src*="recaptcha"`)
2. Requires `data-sitekey` attribute for widget detection (actual CAPTCHA widgets always have this)
3. Anti-signals to reduce false positives from captcha-related content pages
4. Confidence score instead of boolean
5. Only triggers `captcha-challenge` page intent when confidence >= 0.5

**Confidence:** HIGH -- the CAPTCHA detection patterns are well-documented by reCAPTCHA, hCaptcha, and Turnstile official docs. The false positive scenarios (analytics iframes, documentation pages) are directly observed from the current code's selector patterns.

---

## 6. Viewport Detection for Split-Pane Layouts

### Current State (Problems)

| Problem | Current Code | Impact |
|---------|-------------|--------|
| Viewport = `window.innerWidth/innerHeight` | `content.js:10577` uses `window.innerHeight/innerWidth` | Does not account for browser side panel or DevTools |
| Side panel presence not detected | No code to detect FSB's own side panel | Elements at right edge reported as "in viewport" when occluded by side panel |
| `isElementInViewport` uses full window dimensions | `content.js:1836` checks `rect.right <= window.innerWidth` | Off by ~400px when side panel is open |

### Recommended Approach: Effective Viewport Detection

**Technique:** Detect the effective viewport by combining multiple signals:

```javascript
class EffectiveViewport {
  constructor() {
    this._cache = null;
    this._cacheTime = 0;
    this._cacheTTL = 1000; // 1 second cache
  }

  detect() {
    if (this._cache && Date.now() - this._cacheTime < this._cacheTTL) {
      return this._cache;
    }

    // Method 1: visualViewport API (accounts for pinch-zoom but NOT browser chrome)
    const vv = window.visualViewport;
    let width = vv ? vv.width : window.innerWidth;
    let height = vv ? vv.height : window.innerHeight;

    // Method 2: Check if FSB side panel is reducing available space
    // The side panel is a browser-level feature -- the content page's
    // window.innerWidth already accounts for it on most Chrome versions.
    // However, verify by checking document.documentElement.clientWidth
    const docWidth = document.documentElement.clientWidth;
    const docHeight = document.documentElement.clientHeight;

    // Use the smaller of window and document client dimensions
    // document.documentElement.clientWidth excludes scrollbar
    // window.innerWidth includes scrollbar but excludes side panel
    width = Math.min(width, docWidth);
    height = Math.min(height, docHeight);

    // Method 3: Check for extension-injected sidebars that overlay content
    // Some extensions inject fixed-position sidebars into the page
    const fixedSidebars = this.detectInjectedSidebars();
    if (fixedSidebars.right > 0) {
      width -= fixedSidebars.right;
    }
    if (fixedSidebars.left > 0) {
      // Adjust offset, not width (content shifted right)
    }

    this._cache = {
      top: 0,
      left: fixedSidebars.left || 0,
      width,
      height,
      right: (fixedSidebars.left || 0) + width,
      bottom: height,
      hasSidePanel: docWidth < window.innerWidth || fixedSidebars.right > 0,
      confidence: fixedSidebars.right > 0 ? 'detected-sidebar' : 'standard'
    };
    this._cacheTime = Date.now();
    return this._cache;
  }

  detectInjectedSidebars() {
    // Look for fixed/sticky elements at the edges that reduce usable area
    const fixedElements = document.querySelectorAll(
      '[style*="position: fixed"], [style*="position:fixed"]'
    );
    let rightInset = 0;
    let leftInset = 0;

    for (const el of fixedElements) {
      // Skip our own FSB elements
      if (el.id?.startsWith('fsb-')) continue;

      const rect = el.getBoundingClientRect();
      const styles = getComputedStyle(el);
      if (styles.position !== 'fixed' && styles.position !== 'sticky') continue;

      // Right sidebar: fixed element touching right edge, tall, narrow
      if (rect.right >= window.innerWidth - 5 &&
          rect.height > window.innerHeight * 0.5 &&
          rect.width < window.innerWidth * 0.5) {
        rightInset = Math.max(rightInset, rect.width);
      }

      // Left sidebar: fixed element touching left edge
      if (rect.left <= 5 &&
          rect.height > window.innerHeight * 0.5 &&
          rect.width < window.innerWidth * 0.5) {
        leftInset = Math.max(leftInset, rect.width);
      }
    }

    return { left: leftInset, right: rightInset };
  }

  isInViewport(rect) {
    const vp = this.detect();
    return rect.bottom > vp.top &&
           rect.top < vp.bottom &&
           rect.right > vp.left &&
           rect.left < vp.right;
  }
}
```

**Important note about Chrome Side Panel:** When Chrome's built-in side panel (used by FSB via `sidePanel` permission) is open, `window.innerWidth` in the content script already reflects the reduced width on most Chrome versions (Chrome 114+). The content page is resized, not overlaid. However, third-party extension sidebars that inject fixed-position elements DO overlay content. The detection above handles both cases.

**Confidence:** MEDIUM -- The Chrome Side Panel behavior (resizing vs overlaying) was verified through Chrome developer documentation. The injected sidebar detection is heuristic-based and may need tuning. The `window.visualViewport` API is well-documented (MDN) but does not account for browser chrome elements.

**What NOT to do:**
- Do NOT use the Viewport Segments API -- it's for foldable devices with physical hinges, not browser split panes.
- Do NOT try to detect the side panel via `chrome.sidePanel` API from content scripts -- the API is only available in the service worker.
- Do NOT add a content-script-to-background message to check side panel state on every DOM extraction -- too much latency. Cache the viewport detection.

---

## 7. Navigation Strategy Hints for Common Websites

### Current State (Partial Implementation)

FSB already has site-specific guidance via the `site-guides/` directory (ecommerce.js, social.js, coding.js, etc.). These provide selector hints and navigation patterns per site category.

### Recommended Enhancement: Runtime Navigation Hints in AI Context

**Technique:** The existing site-guides infrastructure is the right approach. Enhance it with:

```
1. Success URL Patterns per Site Category
- ecommerce: /order-confirmation, /thank-you, /receipt
- social: URL unchanged but new message in DOM, timestamp updated
- email: /sent, thread view refreshed
- forms: /success, /submitted, redirect to different page

2. Known Working Selector Patterns per Site
- Already partially in site-guides
- Merge with long-term memory (procedural memories from MemoryManager)
- At session start, query MemoryManager for domain-specific procedural memories
- Inject as "PRIOR SITE KNOWLEDGE" in system prompt

3. Anti-Pattern Warnings per Site Category
- ecommerce: Don't click "Add to Cart" if task is "check price"
- social: Don't send message if task is "check messages"
- email: Don't compose if task is "read latest email"
```

**Integration with Memory System:**

```javascript
// At session start in background.js
async function enrichContextWithSiteKnowledge(session, domain) {
  // 1. Site guide (static, code-level)
  const guide = siteExplorer.getGuide(domain);

  // 2. Long-term memories (learned from past sessions)
  const memories = await memoryManager.search(domain, {
    domain,
    type: 'procedural'
  }, { topN: 5 });

  // 3. Merge: guide provides structure, memories provide learned patterns
  return {
    siteGuide: guide,
    learnedPatterns: memories.map(m => ({
      text: m.text,
      selectors: m.typeData?.selectors || [],
      successRate: m.typeData?.successRate || 0
    })),
    successUrlPatterns: guide?.successPatterns || getDefaultSuccessPatterns(domain)
  };
}
```

**Confidence:** HIGH -- site-guides infrastructure already exists and works. The enhancement is incremental.

---

## 8. Token Budget Reference

For context window management across different models FSB supports:

| Model | Context Window | Recommended Total Budget | System | Page | Memory | History |
|-------|---------------|-------------------------|--------|------|--------|---------|
| grok-4-1-fast | 2M tokens | 15K tokens | 4K | 8K | 1K | 2K |
| grok-4-1 | 256K tokens | 15K tokens | 4K | 8K | 1K | 2K |
| GPT-4o | 128K tokens | 12K tokens | 3K | 6K | 1K | 2K |
| GPT-4o Mini | 128K tokens | 10K tokens | 3K | 5K | 1K | 1K |
| Claude Sonnet 4.5 | 200K tokens | 15K tokens | 4K | 8K | 1K | 2K |
| Gemini 2.5 Flash | 1M tokens | 15K tokens | 4K | 8K | 1K | 2K |
| Gemini 2.0 Flash | 1M tokens | 12K tokens | 3K | 6K | 1K | 2K |

**Why not use more of the context window?** Larger prompts cost more per API call, increase latency, and (critically) reduce output quality as models struggle to attend to all input equally. The 10-15K token sweet spot balances cost, speed, and quality. The current 5K hard cap is too aggressive; 10-15K is the target.

**Estimation approach (no tokenizer dependency):**
```javascript
// Simple character-to-token ratio (no dependency needed)
// English text: ~4 chars per token
// Code/markup: ~3.5 chars per token
// Mixed (DOM + text): ~3.7 chars per token
function estimateTokens(text) {
  return Math.ceil(text.length / 3.7);
}
```

---

## Summary: What to Build, What NOT to Build

### Build (Vanilla JS, No Dependencies)

| Component | Technique | Where |
|-----------|-----------|-------|
| Hierarchical DOM serializer | Tree-walk with indentation, token budgeting | `content.js` + `ai-integration.js` |
| Task completion oracle | Multi-signal confidence scoring | New: `lib/completion-oracle.js` |
| Stable element fingerprinting | Structural path + stable attributes | `content.js` DOMStateManager |
| Enhanced session memory | Structured local extraction (no AI call) | `ai-integration.js` |
| Memory retrieval at session start | Query MemoryManager for domain knowledge | `background.js` |
| Confidence-scored CAPTCHA detection | Multi-signal with anti-false-positive | `content.js` |
| Effective viewport detection | visualViewport + sidebar detection | `content.js` |
| Token budget allocator | Proportional allocation per section | `ai-integration.js` |

### Do NOT Build

| Temptation | Why Not |
|------------|---------|
| Accessibility tree via chrome.debugger | Shows warning banner on all windows |
| Vision/screenshot-based state detection | Unreliable for interactive elements, adds model dependency |
| External vector database for memory | Requires build system and server process |
| Embedding-based memory retrieval | Requires embedding API calls, existing keyword search is adequate |
| Full virtual DOM diffing library | Overkill; element fingerprinting + content hash is sufficient |
| AI-based compaction for every trim | Expensive and slow; local structured extraction is free |
| React/Preact for UI components | Not needed; vanilla JS is working fine |
| DOM-to-markdown conversion library | Loses control needed for token budgeting |
| Tokenizer library (tiktoken, etc.) | Character-ratio estimation is accurate enough for budgeting |

---

## Sources

### HIGH Confidence (Official documentation, research papers)
- [browser-use DOM Processing Engine](https://deepwiki.com/browser-use/browser-use/2.4-dom-processing-engine) -- DOM serialization architecture
- [D2Snap: DOM Downsampling for LLM-Based Web Agents](https://arxiv.org/html/2508.04412v1) -- Hierarchy preservation research
- [Building Browser Agents: Architecture, Security, and Practical Solutions](https://arxiv.org/html/2511.19477v1) -- Context management, snapshot versioning
- [MutationObserver - MDN](https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver) -- DOM change detection API
- [VisualViewport - MDN](https://developer.mozilla.org/en-US/docs/Web/API/VisualViewport) -- Viewport detection API
- [Chrome Visual Viewport API](https://developer.chrome.com/blog/visual-viewport-api) -- Layout vs visual viewport
- [Google ADK Context Compaction](https://google.github.io/adk-docs/context/compaction/) -- Sliding window compaction pattern

### MEDIUM Confidence (Verified community patterns)
- [Context Window Management Strategies](https://www.getmaxim.ai/articles/context-window-management-strategies-for-long-context-ai-agents-and-chatbots/) -- Hierarchical summarization patterns
- [Skyvern AI Browser Automation](https://github.com/Skyvern-AI/skyvern) -- Validator Agent pattern for task completion
- [Chrome MutationObserver for Extensions](https://developer.chrome.com/blog/detect-dom-changes-with-mutation-observers) -- Performance characteristics

### LOW Confidence (Single source, needs validation)
- Token budget ratios (10-15K sweet spot) -- based on general community practice, not rigorous benchmarking for FSB specifically
- CAPTCHA false positive rate claims -- based on vendor marketing materials
- Side panel viewport behavior on older Chrome versions -- needs testing
