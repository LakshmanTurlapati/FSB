// Action Verification Module for FSB v0.9.50
// Provides post-action verification to ensure actions have their intended effects

/**
 * Safely extract className as a string (SVG elements have SVGAnimatedString, not a string)
 */
function getClassNameSafe(element) {
  if (!element) return '';
  const cn = element.className;
  if (typeof cn === 'string') return cn;
  if (cn && typeof cn.baseVal === 'string') return cn.baseVal;
  return '';
}

/**
 * Captures the current state of the page for comparison
 */
function capturePageState() {
  const state = {
    url: window.location.href,
    title: document.title,
    bodyText: document.body.innerText.substring(0, 1000), // First 1000 chars
    elementCount: document.querySelectorAll('*').length,
    inputValues: {},
    visibleElements: [],
    timestamp: Date.now()
  };

  // Capture input values
  const inputs = document.querySelectorAll('input, textarea, [contenteditable="true"]');
  inputs.forEach((input, index) => {
    if (index < 20) { // Limit to first 20 inputs
      const key = input.id || input.name || `input_${index}`;
      state.inputValues[key] = input.value || input.textContent || '';
    }
  });

  // Capture visible elements
  const visibleSelectors = ['button', 'a', '[role="button"]', '[onclick]', '.modal', '.dialog', '.popup'];
  visibleSelectors.forEach(selector => {
    const elements = document.querySelectorAll(selector);
    elements.forEach((el, index) => {
      if (index < 10 && el.offsetWidth > 0 && el.offsetHeight > 0) {
        state.visibleElements.push({
          tag: el.tagName,
          text: (el.textContent || '').trim().substring(0, 50),
          selector: el.id ? `#${el.id}` : getClassNameSafe(el) ? `.${getClassNameSafe(el).split(' ')[0]}` : el.tagName.toLowerCase()
        });
      }
    });
  });

  return state;
}

/**
 * Compares two page states and returns what changed
 */
function comparePageStates(before, after) {
  const changes = {
    urlChanged: before.url !== after.url,
    titleChanged: before.title !== after.title,
    contentChanged: before.bodyText !== after.bodyText,
    elementCountChanged: Math.abs(before.elementCount - after.elementCount) > 5, // Allow small changes
    inputValuesChanged: {},
    newVisibleElements: [],
    timeDiff: after.timestamp - before.timestamp
  };
  
  // Check input value changes
  for (const key in after.inputValues) {
    if (before.inputValues[key] !== after.inputValues[key]) {
      changes.inputValuesChanged[key] = {
        before: before.inputValues[key],
        after: after.inputValues[key]
      };
    }
  }
  
  // Check for new visible elements (like modals, popups)
  after.visibleElements.forEach(afterEl => {
    const existed = before.visibleElements.some(beforeEl => 
      beforeEl.selector === afterEl.selector && beforeEl.text === afterEl.text
    );
    if (!existed) {
      changes.newVisibleElements.push(afterEl);
    }
  });
  
  // Determine if significant changes occurred
  changes.hasSignificantChanges = 
    changes.urlChanged || 
    changes.titleChanged || 
    changes.elementCountChanged ||
    Object.keys(changes.inputValuesChanged).length > 0 ||
    changes.newVisibleElements.length > 0;
    
  return changes;
}

/**
 * Waits for DOM to stabilize with a timeout.
 * PERF: Uses MutationObserver instead of polling document.body.innerHTML
 * which was extremely expensive on large pages (full serialization every 100ms).
 */
async function waitForDOMStable(maxWait = 3000) {
  const startTime = Date.now();
  let lastChangeTime = Date.now();

  return new Promise((resolve) => {
    let observer;
    let checkTimer;

    const cleanup = () => {
      if (observer) observer.disconnect();
      if (checkTimer) clearInterval(checkTimer);
    };

    // Track DOM mutations via MutationObserver (lightweight)
    observer = new MutationObserver(() => {
      lastChangeTime = Date.now();
    });

    observer.observe(document.body, {
      childList: true,
      attributes: true,
      subtree: true,
      characterData: true
    });

    // Periodically check if DOM has been stable long enough
    checkTimer = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const stableTime = Date.now() - lastChangeTime;

      if (stableTime > 500 || elapsed > maxWait) {
        cleanup();
        resolve({
          stable: stableTime > 500,
          waitTime: elapsed,
          reason: stableTime > 500 ? 'dom_stable' : 'timeout'
        });
      }
    }, 100);
  });
}

/**
 * Verifies a click action had an effect
 */
async function verifyClickEffect(selector, preClickState) {
  // Wait for DOM to stabilize
  const stabilityResult = await waitForDOMStable();

  // Capture post-click state
  const postClickState = capturePageState();

  // FIX: Early success return if URL changed - navigation definitely worked
  // This prevents false negatives where clicks are reported as "no effect" despite navigating
  if (postClickState.url !== preClickState.url) {
    return {
      verified: true,
      changes: { urlChanged: true, navigated: true },
      effects: { navigation: true },
      stabilityResult,
      selector,
      suggestion: null
    };
  }

  // Compare states
  const changes = comparePageStates(preClickState, postClickState);

  // FIX: If DOM element count changed significantly, click definitely worked
  // This catches cases where content updates but URL stays the same
  if (Math.abs(postClickState.elementCount - preClickState.elementCount) > 10) {
    return {
      verified: true,
      changes: { domChanged: true, elementCountDelta: postClickState.elementCount - preClickState.elementCount },
      effects: { contentUpdate: true },
      stabilityResult,
      selector,
      suggestion: null
    };
  }

  // Check for specific click effects
  const clickEffects = {
    navigationStarted: changes.urlChanged,
    modalOpened: changes.newVisibleElements.some(el =>
      el.selector.includes('modal') || el.selector.includes('dialog') || el.selector.includes('popup')
    ),
    formSubmitted: changes.urlChanged || changes.contentChanged,
    dropdownOpened: changes.newVisibleElements.length > 2, // Multiple new elements suggest dropdown
    loadingStarted: document.querySelector('.loading, .spinner, [class*="load"]') !== null,
    contentUpdated: changes.contentChanged && !changes.urlChanged
  };

  // Determine if click was effective
  const wasEffective = changes.hasSignificantChanges || Object.values(clickEffects).some(v => v);

  return {
    verified: wasEffective,
    changes,
    effects: clickEffects,
    stabilityResult,
    selector,
    suggestion: wasEffective ? null : 'Click may not have had the intended effect'
  };
}

/**
 * Verifies a type action entered the text correctly
 */
function verifyTypeEffect(element, expectedText) {
  const actualValue = element.value || element.textContent || element.innerText || '';
  const isExactMatch = actualValue === expectedText;
  const containsText = actualValue.includes(expectedText);
  
  return {
    verified: isExactMatch || containsText,
    exactMatch: isExactMatch,
    containsText: containsText,
    actualValue,
    expectedText,
    suggestion: !containsText ? 'Text was not entered correctly' : null
  };
}

/**
 * Verifies navigation occurred
 */
async function verifyNavigationEffect(expectedUrl, preNavState) {
  // Wait a bit for navigation to start
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  const currentUrl = window.location.href;
  const urlChanged = currentUrl !== preNavState.url;
  const isExpectedUrl = expectedUrl ? currentUrl.includes(expectedUrl) : urlChanged;
  
  return {
    verified: isExpectedUrl,
    urlChanged,
    previousUrl: preNavState.url,
    currentUrl,
    expectedUrl,
    suggestion: !isExpectedUrl ? 'Navigation did not occur as expected' : null
  };
}

// Export for use in content script
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    capturePageState,
    comparePageStates,
    waitForDOMStable,
    verifyClickEffect,
    verifyTypeEffect,
    verifyNavigationEffect
  };
}
