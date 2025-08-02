// Action Verification Module for FSB v0.1
// Provides post-action verification to ensure actions have their intended effects

/**
 * Captures the current state of the page for comparison
 */
function capturePageState() {
  return {
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
          selector: el.id ? `#${el.id}` : el.className ? `.${el.className.split(' ')[0]}` : el.tagName.toLowerCase()
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
 * Waits for DOM to stabilize with a timeout
 */
async function waitForDOMStable(maxWait = 3000) {
  const startTime = Date.now();
  let lastChangeTime = Date.now();
  let previousHTML = document.body.innerHTML;
  
  return new Promise((resolve) => {
    const checkInterval = setInterval(() => {
      const currentHTML = document.body.innerHTML;
      const elapsed = Date.now() - startTime;
      
      if (currentHTML !== previousHTML) {
        lastChangeTime = Date.now();
        previousHTML = currentHTML;
      }
      
      const stableTime = Date.now() - lastChangeTime;
      
      // DOM is stable if no changes for 500ms or max wait reached
      if (stableTime > 500 || elapsed > maxWait) {
        clearInterval(checkInterval);
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
  
  // Compare states
  const changes = comparePageStates(preClickState, postClickState);
  
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