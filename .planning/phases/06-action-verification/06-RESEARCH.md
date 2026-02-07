# Phase 6: Action Verification - Research

**Researched:** 2026-02-04
**Domain:** Browser Automation Action Verification and State Change Detection
**Confidence:** HIGH

## Summary

This research investigates how to verify that browser automation actions have succeeded before proceeding to the next step. The domain is well-established in testing frameworks like Playwright, Cypress, and Puppeteer, which all use state-based verification rather than timing-based assumptions.

The current FSB implementation already has partial verification in `tools.click` (lines 2966-3152) that captures pre/post state and detects changes. However, this pattern is not consistently applied across all action handlers, and the alternative selector retry mechanism exists in `background.js` but is triggered too late (after the action already failed). The key gap is: verification and retry logic should be unified in content.js action handlers, not split between content and background scripts.

The standard approach in 2026 is to: (1) capture state before action, (2) execute action, (3) verify state changed as expected, (4) retry with alternative strategies if verification fails, (5) report success only after page stability. This follows Playwright's "auto-waiting" pattern where actions don't return until the expected effect is confirmed.

**Primary recommendation:** Create a unified `verifyActionEffect` utility that all action handlers call after execution, returning success only when the expected state change is confirmed, with built-in alternative selector retry before reporting failure.

## Standard Stack

This phase uses only native browser APIs - no external libraries required.

### Core
| API | Purpose | Why Standard |
|-----|---------|--------------|
| `MutationObserver` | Track DOM changes in real-time | Native, event-driven DOM monitoring |
| `Performance API` | Track pending network requests | Native, `performance.getEntriesByType('resource')` |
| `window.location` | Detect URL changes | Native, reliable navigation detection |
| `document.querySelectorAll()` | Verify element count changes | Native DOM query |
| `Element.getAttribute()` | Track ARIA/data attribute changes | Native attribute access |
| `window.getComputedStyle()` | Detect visibility/style changes | Native style computation |

### Supporting
| API | Purpose | When to Use |
|-----|---------|-------------|
| `document.activeElement` | Track focus changes | Verify focus/type actions |
| `Element.value` | Track input value changes | Verify type/clear actions |
| `Element.checked` | Track checkbox/radio state | Verify toggleCheckbox action |
| `Element.selectedIndex` | Track select value changes | Verify selectOption action |
| `XMLHttpRequest/fetch` | Intercept network activity | Page stability detection |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| MutationObserver | polling | MutationObserver is event-driven, no polling overhead |
| Custom state tracking | ResizeObserver | ResizeObserver only tracks size, not content/attributes |
| Manual URL polling | Navigation API | Navigation API has limited browser support |

**No Installation Required** - All functionality uses native browser APIs already available in content scripts.

## Architecture Patterns

### Recommended Code Structure
```
content.js (modification)
  // New unified verification utilities
  captureActionState()           # Capture state before action
  verifyActionEffect()           # Verify state changed after action
  waitForPageStability()         # Wait for DOM stable + no pending requests

  // Enhanced action handlers (pattern)
  tools.click                    # Already has state capture; add unified verification
  tools.type                     # Add verification for value change
  tools.selectOption             # Add verification for selection change
  tools.navigate                 # Add verification for URL change
  // ... all other action handlers
```

### Pattern 1: State Capture Before/After Action
**What:** Capture comprehensive state before action, compare after, detect any change
**When to use:** All action handlers that expect observable effects
**Example:**
```javascript
// Source: Playwright auto-waiting pattern + existing FSB click implementation
function captureActionState(element, actionType) {
  const state = {
    timestamp: Date.now(),
    url: window.location.href,

    // DOM metrics
    bodyTextLength: document.body.innerText.length,
    elementCount: document.querySelectorAll('*').length,
    activeElement: document.activeElement?.tagName,

    // Element-specific state
    element: element ? {
      exists: true,
      className: element.className,
      value: element.value,
      checked: element.checked,
      selectedIndex: element.selectedIndex,
      innerText: element.innerText?.substring(0, 100),
      ariaExpanded: element.getAttribute('aria-expanded'),
      ariaSelected: element.getAttribute('aria-selected'),
      ariaChecked: element.getAttribute('aria-checked'),
      ariaPressed: element.getAttribute('aria-pressed'),
      dataState: element.getAttribute('data-state')
    } : { exists: false }
  };

  // Capture related elements based on action type
  if (actionType === 'click' && element) {
    state.relatedElements = captureRelatedElements(element);
  }

  return state;
}
```

### Pattern 2: Expected Effect Verification
**What:** Define expected effects per action type, verify against actual changes
**When to use:** After every action execution
**Example:**
```javascript
// Source: Playwright assertions + Cypress retry-ability pattern
const EXPECTED_EFFECTS = {
  click: {
    anyOf: ['urlChanged', 'elementCountChanged', 'contentChanged',
            'ariaExpandedChanged', 'focusChanged', 'classChanged'],
    timeout: 1000  // Max wait for effect
  },
  type: {
    required: ['valueChanged'],  // Input value must change
    anyOf: ['contentChanged'],
    timeout: 500
  },
  selectOption: {
    required: ['selectedIndexChanged', 'valueChanged'],
    timeout: 500
  },
  navigate: {
    required: ['urlChanged'],
    timeout: 10000
  },
  toggleCheckbox: {
    required: ['checkedChanged'],
    timeout: 500
  },
  pressEnter: {
    anyOf: ['urlChanged', 'elementCountChanged', 'contentChanged', 'focusChanged'],
    timeout: 2000
  }
};

function verifyActionEffect(preState, postState, actionType, element) {
  const expected = EXPECTED_EFFECTS[actionType] || { anyOf: ['any'], timeout: 1000 };
  const changes = detectChanges(preState, postState);

  // Check required changes
  if (expected.required) {
    const missingRequired = expected.required.filter(e => !changes[e]);
    if (missingRequired.length > 0) {
      return {
        verified: false,
        reason: `Missing required changes: ${missingRequired.join(', ')}`,
        changes
      };
    }
  }

  // Check anyOf changes
  if (expected.anyOf) {
    const hasAnyExpected = expected.anyOf.some(e => changes[e]);
    if (!hasAnyExpected && expected.anyOf[0] !== 'any') {
      return {
        verified: false,
        reason: `No expected effect detected. Expected one of: ${expected.anyOf.join(', ')}`,
        changes
      };
    }
  }

  return { verified: true, changes };
}
```

### Pattern 3: Alternative Selector Retry
**What:** When first selector shows no effect, try alternative selectors before failing
**When to use:** When action executes but verification fails
**Example:**
```javascript
// Source: Existing FSB tryAlternativeAction pattern, moved to content script
async function executeWithAlternativeRetry(action, selectors, executeAction) {
  const { tool, params } = action;

  // Try primary selector first
  for (let i = 0; i < selectors.length; i++) {
    const selector = selectors[i];
    const element = querySelectorWithShadow(selector);

    if (!element) continue;  // Skip if element not found

    // Capture pre-state
    const preState = captureActionState(element, tool);

    // Execute action
    const result = await executeAction(element, params);

    // Short wait for effect
    await new Promise(r => setTimeout(r, 100));

    // Capture post-state
    const postState = captureActionState(element, tool);

    // Verify effect
    const verification = verifyActionEffect(preState, postState, tool, element);

    if (verification.verified) {
      return {
        success: true,
        selectorUsed: selector,
        selectorIndex: i,
        usedFallback: i > 0,
        verification
      };
    }

    // Log failed selector attempt, try next
    console.log(`[FSB] Selector ${i} (${selector.substring(0, 30)}...) no effect, trying next`);
  }

  // All selectors failed
  return {
    success: false,
    error: 'Action had no effect with any available selector',
    selectorsTriad: selectors.length
  };
}
```

### Pattern 4: Page Stability Detection
**What:** Wait for DOM stable + no pending network requests before reporting completion
**When to use:** Before reporting final task completion (VERIFY-04)
**Example:**
```javascript
// Source: Existing FSB waitForDOMStable + enhanced network tracking
async function waitForPageStability(options = {}) {
  const {
    maxWait = 5000,
    stableTime = 500,  // DOM must be stable for this long
    networkQuietTime = 300  // No network activity for this long
  } = options;

  const startTime = Date.now();
  let lastDOMChange = Date.now();
  let lastNetworkActivity = Date.now();
  let pendingRequestCount = 0;

  // Track network requests
  const originalFetch = window.fetch;
  const originalXHROpen = XMLHttpRequest.prototype.open;
  const originalXHRSend = XMLHttpRequest.prototype.send;

  window.fetch = function(...args) {
    pendingRequestCount++;
    lastNetworkActivity = Date.now();
    return originalFetch.apply(this, args).finally(() => {
      pendingRequestCount--;
      lastNetworkActivity = Date.now();
    });
  };

  // Track DOM changes
  const observer = new MutationObserver(() => {
    lastDOMChange = Date.now();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    characterData: true
  });

  return new Promise((resolve) => {
    const check = () => {
      const now = Date.now();
      const domStableFor = now - lastDOMChange;
      const networkQuietFor = now - lastNetworkActivity;
      const elapsed = now - startTime;

      const isDOMStable = domStableFor >= stableTime;
      const isNetworkQuiet = pendingRequestCount === 0 && networkQuietFor >= networkQuietTime;
      const isTimedOut = elapsed >= maxWait;

      if ((isDOMStable && isNetworkQuiet) || isTimedOut) {
        observer.disconnect();
        window.fetch = originalFetch;
        XMLHttpRequest.prototype.open = originalXHROpen;

        resolve({
          stable: isDOMStable && isNetworkQuiet,
          timedOut: isTimedOut,
          domStableFor,
          networkQuietFor,
          pendingRequests: pendingRequestCount,
          waitTime: elapsed
        });
        return;
      }

      setTimeout(check, 50);
    };

    check();
  });
}
```

### Anti-Patterns to Avoid
- **Fixed delays instead of verification:** Using `setTimeout(500)` instead of waiting for actual state change
- **Success without verification:** Returning `success: true` immediately after dispatching events
- **Split verification logic:** Keeping some verification in content.js and some in background.js
- **Ignoring alternative selectors:** Failing immediately when primary selector has no effect
- **Verification on stale element:** Not re-querying element after scroll or DOM changes

## Don't Hand-Roll

Problems that look simple but have edge cases:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| DOM change detection | Polling innerHTML | MutationObserver | Event-driven, no CPU waste, catches all mutations |
| Network activity tracking | Polling resource count | Intercept fetch/XHR | Real-time, catches in-flight requests |
| Element state comparison | Deep object equality | Explicit field comparison | Faster, handles undefined/null correctly |
| URL change detection | setInterval polling | Single comparison pre/post | Page unloads before interval fires |
| Focus change detection | document.activeElement polling | Single comparison | Focus changes are synchronous |

**Key insight:** Verification seems like simple before/after comparison, but browser timing, async behavior, and DOM quirks make it complex. The click handler already has good state capture; the gap is unifying this across all handlers and adding retry with alternative selectors.

## Common Pitfalls

### Pitfall 1: Verifying Too Early
**What goes wrong:** Action dispatched, verification runs before DOM updates, reports no effect
**Why it happens:** Some state changes are async (React updates, framework digests)
**How to avoid:** Add short delay (100-300ms) after action, or use MutationObserver to wait for change
**Warning signs:** Intermittent "no effect" errors, actions work manually but fail in automation

### Pitfall 2: Over-Strict Verification
**What goes wrong:** Action succeeds but verification rejects due to unrelated DOM changes
**Why it happens:** Expecting specific changes, but unrelated elements also changed
**How to avoid:** Use "anyOf" pattern - accept if any expected change occurred, not all
**Warning signs:** Actions that should succeed are rejected; manual retries work

### Pitfall 3: Network-Blind Stability
**What goes wrong:** Reporting "stable" while AJAX request is in flight
**Why it happens:** Only checking DOM mutations, not network activity
**How to avoid:** Intercept fetch/XHR, track pending requests, require network quiet time
**Warning signs:** Task marked complete, but page still updating from AJAX

### Pitfall 4: Alternative Selector Order
**What goes wrong:** Best alternative selector is tried last, wasting time
**Why it happens:** Alternatives generated but not scored/sorted by reliability
**How to avoid:** Use selectors array from Phase 1 which is already sorted by score
**Warning signs:** Slow automation, many selector retries before success

### Pitfall 5: Verification After Navigation
**What goes wrong:** Verification code runs, but page has navigated away
**Why it happens:** URL change detected, but content script context is invalid
**How to avoid:** Detect navigation immediately (URL changed), return success early for navigate actions
**Warning signs:** Errors about "element not found" after navigate/click that triggers navigation

### Pitfall 6: Forgetting to Restore Interceptors
**What goes wrong:** fetch/XHR intercepted but never restored, breaks page functionality
**Why it happens:** Exception thrown before cleanup code runs
**How to avoid:** Always use try/finally for interceptor cleanup
**Warning signs:** Page functionality breaks after automation runs

## Code Examples

Verified patterns from existing FSB implementation and best practices:

### Change Detection Function (from existing click handler)
```javascript
// Source: Existing FSB content.js lines 3069-3086
function detectChanges(preState, postState) {
  return {
    urlChanged: preState.url !== postState.url,
    contentChanged: Math.abs(postState.bodyTextLength - preState.bodyTextLength) > 10,
    elementCountChanged: Math.abs(postState.elementCount - preState.elementCount) > 5,
    focusChanged: preState.activeElement !== postState.activeElement,
    // Element-specific changes
    classChanged: preState.element?.className !== postState.element?.className,
    valueChanged: preState.element?.value !== postState.element?.value,
    checkedChanged: preState.element?.checked !== postState.element?.checked,
    selectedIndexChanged: preState.element?.selectedIndex !== postState.element?.selectedIndex,
    ariaExpandedChanged: preState.element?.ariaExpanded !== postState.element?.ariaExpanded,
    ariaSelectedChanged: preState.element?.ariaSelected !== postState.element?.ariaSelected,
    dataStateChanged: preState.element?.dataState !== postState.element?.dataState
  };
}
```

### Verification Result Format
```javascript
// Source: Consistent with Phase 2 result object pattern
// { passed, reason, details }
function createVerificationResult(verified, changes, options = {}) {
  return {
    verified: verified,
    reason: options.reason || (verified ? 'Action had expected effect' : 'No expected effect detected'),
    details: {
      changes: changes,
      selectorUsed: options.selectorUsed,
      selectorIndex: options.selectorIndex,
      usedFallback: options.usedFallback || false,
      retryCount: options.retryCount || 0,
      waitTime: options.waitTime
    }
  };
}
```

### Unified Action Handler Pattern
```javascript
// Source: Combining existing FSB patterns with verification
async function executeWithVerification(params, actionType, executeCore) {
  const selectors = params.selectors || [params.selector];

  for (let i = 0; i < selectors.length; i++) {
    const selector = selectors[i];
    let element = querySelectorWithShadow(selector);

    if (!element) {
      if (i === selectors.length - 1) {
        return { success: false, error: 'Element not found', selector };
      }
      continue;  // Try next selector
    }

    // 1. Readiness check (Phase 2)
    const readiness = await ensureElementReady(element, actionType);
    if (!readiness.ready) {
      if (i === selectors.length - 1) {
        return {
          success: false,
          error: `Element not ready: ${readiness.failureReason}`,
          selector,
          checks: readiness.checks
        };
      }
      continue;  // Try next selector
    }

    // 2. Re-fetch if scrolled
    if (readiness.scrolled) {
      element = querySelectorWithShadow(selector);
      if (!element) continue;
    }

    // 3. Capture pre-state
    const preState = captureActionState(element, actionType);

    // 4. Execute action
    const coreResult = await executeCore(element, params);

    // 5. Short wait for async effects
    await new Promise(r => setTimeout(r, 100));

    // 6. Capture post-state
    const postState = captureActionState(element, actionType);

    // 7. Verify effect
    const verification = verifyActionEffect(preState, postState, actionType, element);

    if (verification.verified) {
      return {
        success: true,
        selector,
        selectorIndex: i,
        usedFallback: i > 0,
        hadEffect: true,
        verification: verification.details
      };
    }

    // Try next selector if this one had no effect
    console.log(`[FSB] Selector ${i} no effect, trying alternative`);
  }

  // All selectors exhausted
  return {
    success: false,
    error: 'Action had no effect with any available selector',
    hadEffect: false,
    selectorsTriad: selectors.length
  };
}
```

### No Effect Detection Reporting
```javascript
// Source: VERIFY-03 requirement
function reportNoEffect(action, verification) {
  return {
    success: false,
    error: 'Action executed but had no detectable effect on the page',
    hadEffect: false,
    tool: action.tool,
    selector: action.params?.selector,
    verification: {
      changesDetected: verification.changes,
      expectedChanges: EXPECTED_EFFECTS[action.tool],
      suggestion: getSuggestionForNoEffect(action.tool, verification.changes)
    }
  };
}

function getSuggestionForNoEffect(actionType, changes) {
  if (actionType === 'click') {
    return 'Element may not be interactive, try hover first or check if element is covered by overlay';
  }
  if (actionType === 'type') {
    return 'Input may be readonly or disabled, or requires focus first';
  }
  if (actionType === 'selectOption') {
    return 'Option may not exist or select may be disabled';
  }
  return 'Element may require different interaction method';
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Fixed delays (sleep 500ms) | State-based verification | ~2020 | Faster, more reliable |
| Single selector retry | Multiple selector fallback | ~2021 | Higher success rate |
| Success = no exception | Success = verified effect | ~2022 | True reliability measurement |
| DOM polling | MutationObserver | ~2018 | Event-driven, efficient |
| Split content/background verification | Unified content-side verification | Current gap | Simpler, faster |

**Deprecated/outdated:**
- Fixed `setTimeout` delays between actions: Replaced by DOM stability waiting
- Single selector attempts: Multiple selectors with scoring (Phase 1) should all be tried
- Verification in background.js: Should be in content.js for direct DOM access

## Open Questions

Things that couldn't be fully resolved:

1. **Verification timeout per action type**
   - What we know: Click needs ~300ms, navigate needs up to 10s
   - What's unclear: Optimal timeouts for type, selectOption, pressEnter
   - Recommendation: Start with conservative timeouts (500ms default), tune based on telemetry

2. **When to skip verification**
   - What we know: Some actions (scroll, hover) may not have observable DOM effects
   - What's unclear: Whether hover should verify element state (opacity, cursor change)?
   - Recommendation: Start by verifying all actions, add exceptions for specific no-effect patterns

3. **Multiple element state changes**
   - What we know: Click can trigger multiple related elements to change (dropdown + options)
   - What's unclear: How to capture all related element changes efficiently
   - Recommendation: Use existing relatedElements pattern from click, expand to other actions

## Integration with Existing Code

The current codebase already has significant verification infrastructure:

### Existing in content.js
- **State capture (lines 2966-3000):** preClickState/postClickState pattern
- **Change detection (lines 3069-3102):** Comprehensive change object
- **waitForDOMStable (lines 4053-4163):** DOM + network stability
- **detectLoadingState (lines 4165-4220):** Loading indicator detection

### Existing in background.js
- **tryAlternativeAction (lines 1135-1209):** Alternative execution strategies
- **generateAlternativeSelectors (lines 1211-1259):** Selector fallback generation
- **Verification tracking (lines 3476-3508):** noEffectActions tracking

### Gap Analysis
| Capability | Currently | Needed |
|------------|-----------|--------|
| State capture | Click only | All action handlers |
| Effect verification | Click returns success:false on no effect | All handlers should |
| Alternative selector retry | In background.js | Move to content.js for speed |
| Page stability before completion | Called in background.js | Enforce before any completion |

## Sources

### Primary (HIGH confidence)
- **Existing FSB content.js** - tools.click state capture/verification (lines 2966-3152)
- **Existing FSB background.js** - tryAlternativeAction pattern (lines 1135-1209)
- **MDN MutationObserver** - https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver
- **Playwright Auto-Waiting** - https://playwright.dev/docs/actionability

### Secondary (MEDIUM confidence)
- **Cypress Retry-ability** - https://docs.cypress.io/guides/core-concepts/retry-ability
- **Puppeteer waitForSelector** - https://pptr.dev/api/puppeteer.page.waitforselector

### Tertiary (LOW confidence)
- General web search on browser automation verification patterns

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Uses only native browser APIs already in codebase
- Architecture patterns: HIGH - Patterns extracted from existing FSB code
- Pitfalls: HIGH - Based on actual issues in current implementation
- Code examples: HIGH - Adapted from existing working code

**Research date:** 2026-02-04
**Valid until:** 60 days (stable domain, patterns unlikely to change)
