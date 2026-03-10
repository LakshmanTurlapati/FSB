// =============================================================================
// FSB Content Script Module: actions.js
// Extracted from content.js lines 4578-9252
// Contains: tools object (all 25+ browser action functions), coordinate utilities,
//           action verification, diagnostics, and ActionRecorder
// =============================================================================
(function() {
  if (window.__FSB_SKIP_INIT__) return;

  const FSB = window.FSB;
  const logger = FSB.logger;

// =============================================================================
// COORDINATE FALLBACK UTILITIES
// Used when all selectors fail and stored coordinates are available
// =============================================================================

/**
 * Validates that coordinates point to a clickable element.
 * Uses elementFromPoint to check what's actually at the viewport coordinates.
 * @param {number} x - Viewport X coordinate
 * @param {number} y - Viewport Y coordinate
 * @returns {{valid: boolean, element?: Element, reason?: string}}
 */
function validateCoordinates(x, y) {
  // Check coordinates are within viewport bounds
  if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight) {
    return { valid: false, reason: 'coordinates_outside_viewport' };
  }

  const element = document.elementFromPoint(x, y);
  if (!element) {
    return { valid: false, reason: 'no_element_at_coordinates' };
  }

  // Check element is interactable (not hidden, not pointer-events:none)
  const style = window.getComputedStyle(element);
  if (style.pointerEvents === 'none') {
    return { valid: false, reason: 'element_has_pointer_events_none', element };
  }
  if (style.visibility === 'hidden') {
    return { valid: false, reason: 'element_is_hidden', element };
  }

  return { valid: true, element };
}

/**
 * Scrolls to make document coordinates visible in viewport.
 * Converts stored document coordinates to current viewport coordinates.
 * @param {number} docX - Document X coordinate (stored from getBoundingClientRect + scroll)
 * @param {number} docY - Document Y coordinate (stored from getBoundingClientRect + scroll)
 * @param {number} width - Element width
 * @param {number} height - Element height
 * @returns {Promise<{x: number, y: number, scrolled: boolean}>}
 */
async function ensureCoordinatesVisible(docX, docY, width, height) {
  // Convert stored document coordinates to current viewport coordinates
  const viewportX = docX - window.scrollX;
  const viewportY = docY - window.scrollY;

  // Check if already visible (with padding for element size)
  const padding = 50;
  const isVisible = viewportX >= padding &&
                    viewportY >= padding &&
                    viewportX + width <= window.innerWidth - padding &&
                    viewportY + height <= window.innerHeight - padding;

  if (!isVisible) {
    // Scroll to center the target area
    window.scrollTo({
      left: Math.max(0, docX - window.innerWidth / 2 + width / 2),
      top: Math.max(0, docY - window.innerHeight / 2 + height / 2),
      behavior: 'smooth'
    });

    // Wait for scroll animation to complete
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  // Return current viewport coordinates after potential scroll
  return {
    x: docX - window.scrollX,
    y: docY - window.scrollY,
    scrolled: !isVisible
  };
}

/**
 * Clicks at stored coordinates as a fallback when selectors fail.
 * This is a last-resort mechanism for when DOM changes make selectors unreliable.
 * @param {{x: number, y: number, width: number, height: number, originalSelector?: string, reason?: string}} params
 * @returns {Promise<{success: boolean, fallbackUsed: true, ...}>}
 */
async function clickAtCoordinates(params) {
  const { x, y, width = 0, height = 0, originalSelector, reason } = params;

  // Log that we're using coordinate fallback
  logger.warn('Using coordinate fallback', {
    sessionId: FSB.sessionId,
    reason: reason || 'all_selectors_failed',
    originalSelector,
    targetCoordinates: { x, y, width, height }
  });

  // Calculate center point of the element
  const centerX = x + width / 2;
  const centerY = y + height / 2;

  // Ensure coordinates are visible (scroll if needed)
  const scrollResult = await ensureCoordinatesVisible(x, y, width, height);

  // Convert center to current viewport coordinates
  const viewportCenterX = centerX - window.scrollX;
  const viewportCenterY = centerY - window.scrollY;

  // Validate there's a clickable element at these coordinates
  const validation = validateCoordinates(viewportCenterX, viewportCenterY);
  if (!validation.valid) {
    logger.warn('Coordinate fallback validation failed', {
      sessionId: FSB.sessionId,
      reason: validation.reason,
      coordinates: { x: viewportCenterX, y: viewportCenterY }
    });
    return {
      success: false,
      error: `Coordinate fallback failed: ${validation.reason}`,
      coordinates: { x: viewportCenterX, y: viewportCenterY },
      fallbackUsed: true
    };
  }

  const element = validation.element;

  // Dispatch full mouse event sequence (proven pattern from existing click tool)
  const mouseEventInit = {
    bubbles: true,
    cancelable: true,
    view: window,
    clientX: viewportCenterX,
    clientY: viewportCenterY,
    screenX: viewportCenterX + window.screenX,
    screenY: viewportCenterY + window.screenY,
    button: 0,
    buttons: 1
  };

  element.dispatchEvent(new MouseEvent('mousedown', mouseEventInit));
  element.dispatchEvent(new MouseEvent('mouseup', mouseEventInit));
  element.dispatchEvent(new MouseEvent('click', mouseEventInit));

  // Also call native click as fallback
  if (typeof element.click === 'function') {
    element.click();
  }

  // Wait for potential effects
  await new Promise(resolve => setTimeout(resolve, 300));

  logger.log('info', 'Coordinate fallback click executed', {
    sessionId: FSB.sessionId,
    clickedElement: {
      tag: element.tagName,
      id: element.id || null,
      class: FSB.getClassName(element).substring(0, 50) || null
    },
    coordinates: { x: viewportCenterX, y: viewportCenterY },
    scrolled: scrollResult.scrolled
  });

  return {
    success: true,
    fallbackUsed: true,
    clickedElement: {
      tag: element.tagName,
      id: element.id || null,
      class: FSB.getClassName(element).substring(0, 50) || null
    },
    coordinates: { x: viewportCenterX, y: viewportCenterY },
    scrolled: scrollResult.scrolled,
    message: 'Clicked using coordinate fallback (selector-based approach failed)'
  };
}

// =============================================================================
// END COORDINATE FALLBACK UTILITIES
// =============================================================================

// =============================================================================
// ACTION VERIFICATION UTILITIES
// =============================================================================

/**
 * Captures comprehensive state before/after an action for verification
 * @param {Element|null} element - The element being acted upon (null for page-level actions)
 * @param {string} actionType - Type of action being performed (click, type, etc.)
 * @returns {Object} State snapshot for comparison
 */
function captureActionState(element, actionType) {
  // Global state - always captured
  const state = {
    timestamp: Date.now(),
    url: window.location.href,
    bodyTextLength: document.body?.innerText?.length || 0,
    elementCount: document.querySelectorAll('*').length,
    activeElement: document.activeElement?.tagName || null,
    element: { exists: false },
    relatedElements: []
  };

  // Element-specific state (if element provided)
  if (element && document.contains(element)) {
    state.element = {
      exists: true,
      tagName: element.tagName,
      className: FSB.getClassName(element),
      value: element.value !== undefined ? element.value : null,
      textContent: element.isContentEditable ? (element.textContent || '').substring(0, 500) : null,
      checked: element.checked !== undefined ? element.checked : null,
      selectedIndex: element.selectedIndex !== undefined ? element.selectedIndex : null,
      innerText: (element.innerText || '').substring(0, 100),
      // ARIA state
      ariaExpanded: element.getAttribute('aria-expanded'),
      ariaSelected: element.getAttribute('aria-selected'),
      ariaChecked: element.getAttribute('aria-checked'),
      ariaPressed: element.getAttribute('aria-pressed'),
      ariaHidden: element.getAttribute('aria-hidden'),
      dataState: element.getAttribute('data-state'),
      // Additional element state
      open: element.open !== undefined ? element.open : null,
      disabled: element.disabled !== undefined ? element.disabled : null
    };

    // For click actions, capture related elements that might change
    if (actionType === 'click' || actionType === 'hover') {
      let relatedSelectors = [];
      try {
        const escapedId = element.id ? CSS.escape(element.id) : null;
        relatedSelectors = [
          element.nextElementSibling,
          element.querySelector('[role="menu"], [role="listbox"], .dropdown-menu, .submenu'),
          element.id ? document.querySelector(`[aria-labelledby="${element.id}"]`) : null,
          element.id ? document.querySelector(`[aria-controls="${element.id}"]`) : null,
          escapedId ? document.querySelector(`#${escapedId}-content, #${escapedId}-panel, #${escapedId}-menu`) : null
        ].filter(Boolean);
      } catch (e) {
        // Don't let related element lookup crash the action
      }

      state.relatedElements = relatedSelectors.map(el => {
        try {
          const style = getComputedStyle(el);
          return {
            tagName: el.tagName,
            display: style.display,
            visibility: style.visibility,
            opacity: style.opacity,
            height: el.getBoundingClientRect().height,
            ariaHidden: el.getAttribute('aria-hidden')
          };
        } catch (e) {
          return null;
        }
      }).filter(Boolean);
    }
  }

  return state;
}

/**
 * Expected effects for each action type
 * - required: All must occur for verification to pass
 * - anyOf: At least one must occur (unless optional is true)
 * - optional: Action may not have visible effect (e.g., hover)
 * - timeout: Suggested wait time for effects to manifest
 */
const EXPECTED_EFFECTS = {
  click: {
    anyOf: ['urlChanged', 'contentChanged', 'elementCountChanged', 'ariaExpandedChanged',
            'focusChanged', 'classChanged', 'relatedVisibilityChanged', 'loadingDetected'],
    timeout: 300
  },
  type: {
    anyOf: ['valueChanged', 'textContentChanged'],
    timeout: 200
  },
  selectOption: {
    required: ['selectedIndexChanged'],
    anyOf: ['valueChanged'],
    timeout: 200
  },
  toggleCheckbox: {
    required: ['checkedChanged'],
    timeout: 200
  },
  pressEnter: {
    anyOf: ['urlChanged', 'elementCountChanged', 'contentChanged', 'focusChanged'],
    timeout: 1000
  },
  navigate: {
    required: ['urlChanged'],
    timeout: 5000
  },
  hover: {
    anyOf: ['classChanged', 'ariaExpandedChanged', 'relatedVisibilityChanged'],
    optional: true  // Hover may not have visible effect
  },
  focus: {
    required: ['focusChanged'],
    timeout: 100
  }
};

/**
 * Detects changes between pre and post action states
 * @param {Object} preState - State before action
 * @param {Object} postState - State after action
 * @returns {Object} Object with boolean flags for each type of change
 */
function detectChanges(preState, postState) {
  const changes = {
    // Global changes
    urlChanged: preState.url !== postState.url,
    contentChanged: Math.abs(postState.bodyTextLength - preState.bodyTextLength) > 10,
    elementCountChanged: Math.abs(postState.elementCount - preState.elementCount) > 2,
    focusChanged: preState.activeElement !== postState.activeElement,
    loadingDetected: !!document.querySelector('.loading, .spinner, [class*="load"], [aria-busy="true"]')
  };

  // Element-specific changes (only if element exists in both states)
  if (preState.element.exists && postState.element.exists) {
    changes.classChanged = preState.element.className !== postState.element.className;
    changes.valueChanged = preState.element.value !== postState.element.value;
    changes.textContentChanged = preState.element.textContent !== postState.element.textContent;
    changes.checkedChanged = preState.element.checked !== postState.element.checked;
    changes.selectedIndexChanged = preState.element.selectedIndex !== postState.element.selectedIndex;
    changes.ariaExpandedChanged = preState.element.ariaExpanded !== postState.element.ariaExpanded;
    changes.ariaSelectedChanged = preState.element.ariaSelected !== postState.element.ariaSelected;
    changes.ariaCheckedChanged = preState.element.ariaChecked !== postState.element.ariaChecked;
    changes.ariaPressedChanged = preState.element.ariaPressed !== postState.element.ariaPressed;
    changes.dataStateChanged = preState.element.dataState !== postState.element.dataState;
    changes.openChanged = preState.element.open !== postState.element.open;
  } else {
    // Element became unavailable - treat as a change
    changes.elementLost = preState.element.exists && !postState.element.exists;
    changes.classChanged = false;
    changes.valueChanged = false;
    changes.checkedChanged = false;
    changes.selectedIndexChanged = false;
    changes.ariaExpandedChanged = false;
    changes.ariaSelectedChanged = false;
    changes.ariaCheckedChanged = false;
    changes.ariaPressedChanged = false;
    changes.dataStateChanged = false;
    changes.openChanged = false;
  }

  // Related element visibility changes (for click/hover actions)
  changes.relatedVisibilityChanged = false;
  if (preState.relatedElements.length > 0 && postState.relatedElements.length > 0) {
    changes.relatedVisibilityChanged = preState.relatedElements.some((pre, i) => {
      const post = postState.relatedElements[i];
      if (!post) return false;
      return pre.display !== post.display ||
             pre.visibility !== post.visibility ||
             pre.opacity !== post.opacity ||
             Math.abs(pre.height - post.height) > 5 ||
             pre.ariaHidden !== post.ariaHidden;
    });
  }

  return changes;
}

/**
 * Verifies that an action had its expected effect
 * @param {Object} preState - State captured before action
 * @param {Object} postState - State captured after action
 * @param {string} actionType - Type of action performed
 * @returns {Object} Verification result { verified, reason, changes, details }
 */
function verifyActionEffect(preState, postState, actionType) {
  const changes = detectChanges(preState, postState);
  const expectations = EXPECTED_EFFECTS[actionType];

  // If no expectations defined for this action type, assume verified
  if (!expectations) {
    return {
      verified: true,
      reason: 'No expectations defined for action type',
      changes,
      details: { actionType, expectationsDefined: false }
    };
  }

  const result = {
    verified: false,
    reason: '',
    changes,
    details: {
      actionType,
      expectations,
      requiredMet: null,
      anyOfMet: null
    }
  };

  // Check required changes (all must occur)
  if (expectations.required) {
    const requiredMet = expectations.required.every(change => changes[change] === true);
    result.details.requiredMet = requiredMet;

    if (!requiredMet) {
      const missingRequired = expectations.required.filter(change => !changes[change]);
      result.reason = `Required changes not detected: ${missingRequired.join(', ')}`;
      return result;
    }
  }

  // Check anyOf changes (at least one must occur)
  if (expectations.anyOf) {
    const anyOfMet = expectations.anyOf.some(change => changes[change] === true);
    result.details.anyOfMet = anyOfMet;

    if (!anyOfMet) {
      // If action is optional, still verify but with note
      if (expectations.optional) {
        result.verified = true;
        result.reason = 'Optional action - no detectable effect (may be normal)';
        return result;
      }

      result.reason = `No expected effects detected. Expected one of: ${expectations.anyOf.join(', ')}`;
      return result;
    }
  }

  // All checks passed
  result.verified = true;
  const detectedChanges = Object.entries(changes)
    .filter(([key, value]) => value === true)
    .map(([key]) => key);
  result.reason = `Action verified: ${detectedChanges.join(', ')}`;

  return result;
}
// =============================================================================
// DIAGNOSTIC MESSAGES AND ACTION RECORDING
// =============================================================================

/**
 * Diagnostic message templates for different failure types
 * Each provides: message, details, suggestions, and optional fields
 */
const DIAGNOSTIC_MESSAGES = {
  elementNotFound: {
    message: 'Element not found',
    getDetails: (context) => `Selector "${context.selector}" did not match any element on the page`,
    suggestions: [
      'Element may not exist yet - check if page is still loading',
      'Selector may be stale - page content may have changed',
      'Element may be inside an iframe or shadow DOM',
      'Try using a more specific or alternative selector'
    ]
  },
  elementNotVisible: {
    message: 'Element not visible',
    getDetails: (context) => {
      const style = context.style || {};
      return `Element exists but is not visible: display=${style.display || 'unknown'}, visibility=${style.visibility || 'unknown'}, opacity=${style.opacity || 'unknown'}`;
    },
    suggestions: [
      'Element may be hidden by CSS - check parent containers',
      'Element may require scroll into view',
      'Element may be covered by overlay or modal',
      'Wait for animation to complete'
    ]
  },
  elementDisabled: {
    message: 'Element disabled',
    getDetails: (context) => `Element has disabled=${context.disabled}, aria-disabled=${context.ariaDisabled || 'false'}`,
    suggestions: [
      'Wait for element to become enabled',
      'Check if prerequisite actions are needed (form validation, etc.)',
      'Fill required fields before interacting with this element'
    ]
  },
  clickIntercepted: {
    message: 'Click intercepted by overlay',
    getDetails: (context) => {
      const cover = context.coveringElement || {};
      return `Click would hit ${cover.tagName || 'unknown'}.${typeof cover.className === 'string' ? cover.className : ''} instead of target`;
    },
    suggestions: [
      'Close any modal or overlay first',
      'Scroll to bring element into view',
      'Wait for animation to complete',
      'Try clicking the covering element to dismiss it'
    ]
  },
  noEffect: {
    message: 'Action had no effect',
    getDetails: (context) => `${context.action || 'Action'} executed but no expected changes detected`,
    suggestions: [
      'Element may not be interactive (decoration only)',
      'JavaScript event handler may not be attached',
      'Try alternative selector or action method',
      'Element may require focus before interaction'
    ]
  },
  notReady: {
    message: 'Element not ready',
    getDetails: (context) => {
      const checks = context.checks || {};
      const failed = Object.entries(checks)
        .filter(([key, val]) => val && !val.passed)
        .map(([key]) => key);
      return `Element failed readiness checks: ${failed.join(', ') || 'unknown'}`;
    },
    suggestions: [
      'Wait for element to stabilize',
      'Element may be animating or transitioning',
      'Check if element is covered by another element',
      'Ensure element is within viewport'
    ]
  }
};

/**
 * Generates a diagnostic object for a specific failure type
 * @param {string} failureType - One of: elementNotFound, elementNotVisible, elementDisabled, clickIntercepted, noEffect, notReady
 * @param {Object} context - Context data for the failure (selector, style, checks, etc.)
 * @returns {Object} Diagnostic object with message, details, suggestions, and context-specific fields
 */
function generateDiagnostic(failureType, context = {}) {
  const template = DIAGNOSTIC_MESSAGES[failureType];

  if (!template) {
    return {
      message: failureType || 'Unknown failure',
      details: JSON.stringify(context),
      suggestions: ['Check the logs for more information']
    };
  }

  const diagnostic = {
    message: template.message,
    details: template.getDetails(context),
    suggestions: template.suggestions
  };

  // Add context-specific fields
  if (context.selector) {
    diagnostic.tried = Array.isArray(context.tried) ? context.tried : [context.selector];
  }

  if (context.coveringElement) {
    diagnostic.coveringElement = {
      tagName: context.coveringElement.tagName,
      className: FSB.getClassName(context.coveringElement),
      id: context.coveringElement.id
    };
  }

  if (context.checks) {
    diagnostic.checkResults = context.checks;
  }

  return diagnostic;
}

/**
 * Captures details about an element for action recording
 * @param {Element|null} element - The DOM element to capture details from
 * @returns {Object|null} Element details including visibility, position, interactability, or null if element is null
 */
function captureElementDetails(element) {
  if (!element) return null;

  try {
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;

    return {
      // Basic identity
      tagName: element.tagName,
      id: element.id || null,
      className: FSB.getClassName(element) || null,
      text: (element.innerText || element.textContent || '').substring(0, 50),

      // Visibility state
      isVisible: style.display !== 'none' &&
                 style.visibility !== 'hidden' &&
                 parseFloat(style.opacity) > 0,
      isEnabled: !element.disabled && element.getAttribute('aria-disabled') !== 'true',
      isInViewport: rect.top >= 0 && rect.left >= 0 &&
                    rect.bottom <= viewportHeight &&
                    rect.right <= viewportWidth,

      // Position
      boundingRect: {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height)
      }
    };
  } catch (error) {
    // Return minimal info on error
    return {
      tagName: element.tagName || 'UNKNOWN',
      error: error.message
    };
  }
}

/**
 * ActionRecorder class for structured action logging
 * Records every action attempt with full context for debugging and replay
 */
class ActionRecorder {
  constructor() {
    this.records = [];
    this.currentSessionId = null;
  }

  /**
   * Sets the current session ID for all subsequent records
   * @param {string} sessionId - The session ID to associate with records
   */
  setSession(sessionId) {
    this.currentSessionId = sessionId;
  }

  /**
   * Records an action with full context
   * @param {string|null} actionId - Unique action ID (generated if not provided)
   * @param {string} tool - The tool/action name (e.g., 'click', 'type')
   * @param {Object} params - Original parameters passed to the tool
   * @param {Object} data - Additional data (selectorTried, elementFound, coordinates, success, etc.)
   * @returns {string} The action ID for reference
   */
  record(actionId, tool, params, data = {}) {
    const id = actionId || crypto.randomUUID();

    const record = {
      actionId: id,
      sessionId: this.currentSessionId,
      timestamp: Date.now(),
      tool,
      params,
      // Spread additional data fields
      selectorTried: data.selectorTried || null,
      selectorUsed: data.selectorUsed || null,
      elementFound: data.elementFound !== undefined ? data.elementFound : null,
      elementDetails: data.elementDetails || null,
      coordinatesUsed: data.coordinatesUsed || null,
      coordinateSource: data.coordinateSource || null,
      success: data.success !== undefined ? data.success : null,
      error: data.error || null,
      hadEffect: data.hadEffect !== undefined ? data.hadEffect : null,
      effectDetails: data.effectDetails || null,
      diagnostic: data.diagnostic || null,
      duration: data.duration || null
    };

    // Store in local records
    this.records.push(record);

    // Keep records bounded
    if (this.records.length > 1000) {
      this.records = this.records.slice(-500);
    }

    // Log via logger if available
    if (logger && logger.logActionRecord) {
      logger.logActionRecord(record);
    }

    return id;
  }

  /**
   * Returns all recorded actions
   * @returns {Array} All action records
   */
  getRecords() {
    return this.records;
  }

  /**
   * Clears all records
   */
  clear() {
    this.records = [];
  }
}

// Create singleton instance
const actionRecorder = new ActionRecorder();

/**
 * SPEED-01: Detects the outcome of an action to determine appropriate wait strategy
 * Classifies outcomes: navigation, network, majorDOMChange, minorDOMChange, elementStateChange, noChange
 * @param {Object} preState - State captured before action (from captureActionState)
 * @param {Object} postState - State captured after action (from captureActionState)
 * @param {Object} actionResult - Result from action handler (contains verification info)
 * @returns {Object} Outcome { type, confidence, details }
 */
function detectActionOutcome(preState, postState, actionResult = {}) {
  // Calculate deltas
  const elementDelta = Math.abs((postState?.elementCount || 0) - (preState?.elementCount || 0));
  const textDelta = Math.abs((postState?.bodyTextLength || 0) - (preState?.bodyTextLength || 0));

  // Priority 1: Navigation detected (URL changed)
  if (preState?.url && postState?.url && preState.url !== postState.url) {
    return {
      type: 'navigation',
      confidence: 'HIGH',
      details: {
        fromUrl: preState.url,
        toUrl: postState.url
      }
    };
  }

  // Priority 2: Network activity (actionResult indicates network or pending requests)
  if (actionResult?.triggeredNetwork || (postState?.pendingRequests && postState.pendingRequests > 0)) {
    return {
      type: 'network',
      confidence: 'HIGH',
      details: {
        triggeredNetwork: actionResult?.triggeredNetwork || false,
        pendingRequests: postState?.pendingRequests || 0
      }
    };
  }

  // Priority 3: Major DOM change (significant element or text changes)
  if (elementDelta > 10 || textDelta > 500) {
    return {
      type: 'majorDOMChange',
      confidence: 'HIGH',
      details: {
        elementDelta,
        textDelta
      }
    };
  }

  // Priority 4: Minor DOM change (any element or text change)
  if (elementDelta > 0 || textDelta > 0) {
    return {
      type: 'minorDOMChange',
      confidence: 'MEDIUM',
      details: {
        elementDelta,
        textDelta
      }
    };
  }

  // Priority 5: Element state change (class, aria-expanded, etc.)
  const changes = actionResult?.verification?.changes || {};
  if (changes.classChanged || changes.ariaExpandedChanged ||
      changes.ariaSelectedChanged || changes.ariaPressedChanged ||
      changes.dataStateChanged || changes.openChanged) {
    return {
      type: 'elementStateChange',
      confidence: 'HIGH',
      details: {
        classChanged: changes.classChanged,
        ariaExpandedChanged: changes.ariaExpandedChanged,
        ariaSelectedChanged: changes.ariaSelectedChanged,
        ariaPressedChanged: changes.ariaPressedChanged
      }
    };
  }

  // Default: No detectable change
  return {
    type: 'noChange',
    confidence: 'HIGH',
    details: {
      elementDelta,
      textDelta,
      reason: 'No detectable outcome from action'
    }
  };
}

/**
 * Waits for page stability - both DOM stable AND network quiet
 * Enhanced version of waitForDOMStable with proper network request tracking
 * @param {Object} options - Configuration options
 * @param {number} options.maxWait - Maximum wait time in ms (default: 5000)
 * @param {number} options.stableTime - DOM must be stable for this long in ms (default: 500)
 * @param {number} options.networkQuietTime - No network activity for this long in ms (default: 300)
 * @returns {Promise<Object>} Stability info { stable, timedOut, domStableFor, networkQuietFor, pendingRequests, waitTime }
 */
async function waitForPageStability(options = {}) {
  const {
    maxWait = 5000,
    stableTime = 500,
    networkQuietTime = 300
  } = options;

  const startTime = Date.now();
  let lastDOMChange = Date.now();
  let lastNetworkActivity = Date.now();
  let pendingRequestCount = 0;
  let domChangeCount = 0;
  let networkRequestCount = 0;

  // Store original functions
  const originalFetch = window.fetch;
  const originalXHROpen = XMLHttpRequest.prototype.open;
  const originalXHRSend = XMLHttpRequest.prototype.send;

  // Track fetch requests with proper completion tracking
  window.fetch = function(...args) {
    pendingRequestCount++;
    networkRequestCount++;
    lastNetworkActivity = Date.now();
    return originalFetch.apply(this, args).finally(() => {
      pendingRequestCount--;
      lastNetworkActivity = Date.now();
    });
  };

  // Track XHR requests with proper completion tracking
  XMLHttpRequest.prototype.open = function(...args) {
    networkRequestCount++;
    lastNetworkActivity = Date.now();
    return originalXHROpen.apply(this, args);
  };

  XMLHttpRequest.prototype.send = function(...args) {
    pendingRequestCount++;
    lastNetworkActivity = Date.now();

    // Track completion
    this.addEventListener('loadend', () => {
      pendingRequestCount--;
      lastNetworkActivity = Date.now();
    }, { once: true });

    return originalXHRSend.apply(this, args);
  };

  // Create mutation observer
  const observer = new MutationObserver((mutations) => {
    // Filter out trivial changes (loading indicators, etc.)
    const significantMutations = mutations.filter(mutation => {
      if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
        const target = mutation.target;
        if (target.classList && (
          target.classList.contains('loading') ||
          target.classList.contains('spinner') ||
          target.classList.contains('progress')
        )) {
          return false;
        }
      }
      return true;
    });

    if (significantMutations.length > 0) {
      domChangeCount += significantMutations.length;
      lastDOMChange = Date.now();
    }
  });

  try {
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeOldValue: false,
      characterData: true,
      attributeFilter: ['class', 'id', 'data-state', 'aria-expanded', 'aria-hidden', 'aria-selected']
    });

    return await new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        const now = Date.now();
        const totalTime = now - startTime;
        const domStableFor = now - lastDOMChange;
        const networkQuietFor = now - lastNetworkActivity;

        // Check if both DOM and network are stable
        const isDOMStable = domStableFor >= stableTime;
        const isNetworkQuiet = networkQuietFor >= networkQuietTime && pendingRequestCount === 0;
        const isStable = isDOMStable && isNetworkQuiet;
        const hasTimedOut = totalTime >= maxWait;

        if (isStable || hasTimedOut) {
          clearInterval(checkInterval);
          observer.disconnect();

          // Restore original functions
          window.fetch = originalFetch;
          XMLHttpRequest.prototype.open = originalXHROpen;
          XMLHttpRequest.prototype.send = originalXHRSend;

          const result = {
            stable: isStable,
            timedOut: hasTimedOut && !isStable,
            domStableFor,
            networkQuietFor,
            pendingRequests: pendingRequestCount,
            waitTime: totalTime,
            domChangeCount,
            networkRequestCount,
            reason: isStable ? 'stable' : (hasTimedOut ? 'timeout' : 'pending')
          };

          // Log for debugging
          if (logger && FSB.sessionId) {
            logger.logTiming(FSB.sessionId, 'WAIT', 'page_stability', totalTime, {
              domChanges: domChangeCount,
              networkRequests: networkRequestCount,
              pendingRequests: pendingRequestCount,
              stable: isStable
            });
          }

          resolve(result);
        }
      }, 50);

      // Safety timeout
      setTimeout(() => {
        clearInterval(checkInterval);
        observer.disconnect();

        // Restore original functions
        window.fetch = originalFetch;
        XMLHttpRequest.prototype.open = originalXHROpen;
        XMLHttpRequest.prototype.send = originalXHRSend;

        resolve({
          stable: false,
          timedOut: true,
          domStableFor: Date.now() - lastDOMChange,
          networkQuietFor: Date.now() - lastNetworkActivity,
          pendingRequests: pendingRequestCount,
          waitTime: maxWait + 1000,
          domChangeCount,
          networkRequestCount,
          reason: 'safety_timeout'
        });
      }, maxWait + 1000);
    });
  } catch (error) {
    // Ensure restoration on error
    observer.disconnect();
    window.fetch = originalFetch;
    XMLHttpRequest.prototype.open = originalXHROpen;
    XMLHttpRequest.prototype.send = originalXHRSend;

    return {
      stable: false,
      timedOut: false,
      error: error.message,
      waitTime: Date.now() - startTime,
      reason: 'error'
    };
  }
}

// =============================================================================
// END ACTION VERIFICATION UTILITIES
// =============================================================================
// Tool functions for browser automation
const tools = {
  // Scroll the page - supports direction ("up"/"down") or raw amount
  scroll: async (params) => {
    let amount;
    if (params.direction) {
      const viewportScroll = window.innerHeight - 100;
      amount = params.direction === 'up' ? -viewportScroll : viewportScroll;
    } else {
      amount = params.amount || 300;
    }
    window.scrollBy(0, amount);
    await new Promise(r => setTimeout(r, 300));
    const pageHeight = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
    const maxScroll = pageHeight - window.innerHeight;
    const atBottom = window.scrollY >= maxScroll - 10;
    return {
      success: true,
      scrollY: window.scrollY,
      pageHeight,
      atTop: window.scrollY === 0,
      atBottom,
      hasMoreBelow: !atBottom
    };
  },

  // Scroll to top of page
  scrollToTop: async () => {
    window.scrollTo(0, 0);
    await new Promise(r => setTimeout(r, 300));
    return { success: true, scrollY: 0, atTop: true };
  },

  // Scroll to bottom of page
  scrollToBottom: async () => {
    window.scrollTo(0, document.body.scrollHeight);
    await new Promise(r => setTimeout(r, 300));
    return { success: true, scrollY: window.scrollY, atBottom: true };
  },

  // Scroll a specific element into view
  scrollToElement: async (params) => {
    const selector = params.selector;
    if (!selector) return { success: false, error: 'No selector provided' };
    const element = document.querySelector(selector);
    if (!element) return { success: false, error: `Element not found: ${selector}` };
    const position = params.position || 'center';
    element.scrollIntoView({ behavior: 'smooth', block: position === 'center' ? 'center' : 'start' });
    await new Promise(r => setTimeout(r, 300));
    const rect = element.getBoundingClientRect();
    const inViewport = rect.top >= 0 && rect.bottom <= window.innerHeight;
    return { success: true, scrollY: window.scrollY, elementInViewport: inViewport };
  },

  // Click an element
  click: async (params) => {
    const startTime = Date.now();
    const selectorTried = params.selector;
    let coordinatesUsed = null;
    let coordinateSource = null;

    // Support selector cascade -- try multiple selectors before falling back to coordinates
    const selectors = params.selectors || [params.selector];
    let element = null;
    let selectorUsed = null;

    for (const sel of selectors) {
      element = FSB.querySelectorWithShadow(sel);
      if (element) {
        selectorUsed = sel;
        break;
      }
    }

    if (!element) {
      // Try coordinate fallback if coordinates provided
      if (params.coordinates && typeof params.coordinates.x === 'number' && typeof params.coordinates.y === 'number') {
        coordinatesUsed = { x: params.coordinates.x, y: params.coordinates.y };
        coordinateSource = 'fallback';
        const result = await clickAtCoordinates({
          x: params.coordinates.x,
          y: params.coordinates.y,
          width: params.coordinates.width || 0,
          height: params.coordinates.height || 0,
          originalSelector: params.selector,
          reason: 'selector_not_found'
        });
        // Record the action
        actionRecorder.record(null, 'click', params, {
          selectorTried,
          selectorUsed: null,
          elementFound: false,
          elementDetails: null,
          coordinatesUsed,
          coordinateSource,
          success: result.success,
          error: result.error || null,
          hadEffect: result.hadEffect,
          duration: Date.now() - startTime
        });
        return result;
      }

      // Record failure - element not found, no fallback
      actionRecorder.record(null, 'click', params, {
        selectorTried,
        selectorUsed: null,
        elementFound: false,
        elementDetails: null,
        coordinatesUsed: null,
        coordinateSource: null,
        success: false,
        error: 'Element not found and no coordinates available for fallback',
        diagnostic: generateDiagnostic('elementNotFound', { selector: selectorTried }),
        duration: Date.now() - startTime
      });
      return {
        success: false,
        error: 'Element not found and no coordinates available for fallback',
        selector: params.selector
      };
    }

    // Canvas editor toolbar bypass: skip readiness pipeline for known toolbar elements
    // on Google Sheets/Docs/Slides where readiness checks false-fail on canvas UI
    if (FSB.isCanvasBasedEditor && FSB.isCanvasBasedEditor()) {
      // Note: these selectors must be hardcoded (runs before Stage 1b fsbRole injection)
      const toolbarSelectors = '#docs-chrome, .docs-titlebar-container, #docs-toolbar, ' +
        '.waffle-name-box, #t-name-box, .cell-input, #t-formula-bar-input, ' +
        '[id^="docs-"], .docs-menubar, .goog-toolbar, .docs-sheet-tab-container';
      const isToolbarElement = element.matches(toolbarSelectors) || element.closest(toolbarSelectors);

      if (isToolbarElement) {
        logger.logActionExecution(FSB.sessionId, 'click', 'canvas_toolbar_bypass', {
          tagName: element.tagName,
          id: element.id,
          selector: selectorUsed
        });

        // Scroll into view if not in viewport
        const rect = element.getBoundingClientRect();
        const inViewport = rect.top >= 0 && rect.bottom <= window.innerHeight && rect.left >= 0 && rect.right <= window.innerWidth;
        if (!inViewport) {
          element.scrollIntoView({ behavior: 'instant', block: 'center' });
          await new Promise(r => setTimeout(r, 50));
        }

        // Dispatch full mouse event sequence with coordinates from element center
        const clickRect = element.getBoundingClientRect();
        const centerX = clickRect.left + clickRect.width / 2;
        const centerY = clickRect.top + clickRect.height / 2;
        const mouseOpts = {
          bubbles: true,
          cancelable: true,
          view: window,
          clientX: centerX,
          clientY: centerY,
          screenX: centerX + window.screenX,
          screenY: centerY + window.screenY
        };
        element.dispatchEvent(new MouseEvent('mousedown', mouseOpts));
        element.dispatchEvent(new MouseEvent('mouseup', mouseOpts));
        element.dispatchEvent(new MouseEvent('click', mouseOpts));

        element.click();
        element.focus();

        // Wait for Sheets to process the click
        await new Promise(r => setTimeout(r, 100));

        // Record the action
        actionRecorder.record(null, 'click', params, {
          selectorTried,
          selectorUsed,
          elementFound: true,
          elementDetails: captureElementDetails(element),
          coordinatesUsed: null,
          coordinateSource: null,
          success: true,
          hadEffect: true,
          method: 'canvas_editor_toolbar_bypass',
          duration: Date.now() - startTime
        });

        return {
          success: true,
          clicked: params.selector,
          hadEffect: true,
          method: 'canvas_editor_toolbar_bypass',
          scrolled: false
        };
      }
    }

    // SPEED-05: Use smart readiness check with fast-path for ready elements
    const readiness = await FSB.smartEnsureReady(element, 'click');
    if (!readiness.ready) {
      // Record failure - element not ready
      actionRecorder.record(null, 'click', params, {
        selectorTried,
        selectorUsed: selectorUsed,
        elementFound: true,
        elementDetails: captureElementDetails(element),
        coordinatesUsed: null,
        coordinateSource: null,
        success: false,
        error: `Element not ready: ${readiness.failureReason}`,
        diagnostic: generateDiagnostic('notReady', { selector: selectorUsed, checks: readiness.checks }),
        duration: Date.now() - startTime
      });
      return {
        success: false,
        error: `Element not ready: ${readiness.failureReason}`,
        selector: params.selector,
        checks: readiness.checks,
        failureDetails: readiness.failureDetails
      };
    }

    // Re-fetch element after scroll (may have become stale)
    if (readiness.scrolled) {
      element = FSB.querySelectorWithShadow(selectorUsed);
      if (!element) {
        return {
          success: false,
          error: 'Element became stale after scrolling',
          selector: params.selector
        };
      }
    }

    // Track if element was scrolled for response
    const wasScrolled = readiness.scrolled;

    if (element) {
      // Verify element is still interactive
      if (!document.contains(element)) {
        return {
          success: false,
          error: 'Element no longer in DOM',
          selector: params.selector
        };
      }

      // FIX: Handle target="_blank" links that would open in a new tab
      // Instead, navigate in the current tab for automation continuity
      const anchor = element.tagName === 'A' ? element : element.closest('a');
      if (anchor) {
        const opensNewTab = anchor.target === '_blank' ||
                            anchor.target === '_new' ||
                            anchor.rel?.includes('noopener');

        if (opensNewTab && anchor.href) {
          logger.logActionExecution(FSB.sessionId, 'click', 'redirect_navigation', { originalTarget: anchor.target, href: anchor.href });

          // Navigate directly using window.location for same-tab navigation
          const targetUrl = anchor.href;
          window.location.href = targetUrl;

          return {
            success: true,
            clicked: params.selector,
            hadEffect: true,
            navigationTriggered: true,
            method: 'direct-navigation',
            message: 'Navigated directly instead of opening in new tab',
            targetUrl: targetUrl,
            originalTarget: anchor.target
          };
        }
      }

      // VERIFY-04: Capture pre-state using SHARED verification utility
      const preState = captureActionState(element, 'click');

      // Perform the click using proper mouse events for better compatibility
      // Many modern sites (Amazon, etc.) need full event sequence
      const clickRect = element.getBoundingClientRect();
      const centerX = clickRect.left + clickRect.width / 2;
      const centerY = clickRect.top + clickRect.height / 2;

      const mouseEventInit = {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: centerX,
        clientY: centerY,
        screenX: centerX + window.screenX,
        screenY: centerY + window.screenY,
        button: 0,
        buttons: 1
      };

      // Dispatch full mouse event sequence for proper JS handler triggering
      element.dispatchEvent(new MouseEvent('mousedown', mouseEventInit));
      element.dispatchEvent(new MouseEvent('mouseup', mouseEventInit));
      element.dispatchEvent(new MouseEvent('click', mouseEventInit));

      // Also call native click as fallback for some elements
      element.click();

      // VERIFY-04: Wait for page stability (REPLACE fixed 300ms with dynamic stability detection)
      await waitForPageStability({ maxWait: 1000, stableTime: 200 });

      // VERIFY-04: Capture post-state and verify using SHARED utilities
      const postState = captureActionState(element, 'click');
      const verification = verifyActionEffect(preState, postState, 'click');

      // Check for loading indicators (not captured by standard verification)
      const loadingDetected = !!document.querySelector('.loading, .spinner, [class*="load"], [aria-busy="true"]');

      // Determine if click had an effect
      // For anchor tags, require URL change or significant DOM change (not just focus)
      // For radio/checkbox elements, treat checkedChanged as a valid effect
      const isAnchorElement = element.tagName === 'A' || element.closest('a');
      const isCheckableElement = element.type === 'radio' || element.type === 'checkbox' ||
        element.getAttribute('role') === 'radio' || element.getAttribute('role') === 'checkbox' ||
        element.getAttribute('role') === 'switch';
      // Canvas-based editors (Google Docs, Sheets, Slides) handle clicks internally;
      // DOM verification is not possible so treat clicks as successful
      const isCanvasTarget = FSB.isCanvasBasedEditor() || element.tagName === 'CANVAS';
      const hadEffect = isCanvasTarget
        ? true
        : isCheckableElement
          ? (verification.changes?.checkedChanged || verification.changes?.ariaExpandedChanged || verification.verified)
          : isAnchorElement
            ? (verification.changes?.urlChanged || verification.changes?.contentChanged ||
               verification.changes?.elementCountChanged || verification.changes?.ariaExpandedChanged ||
               verification.changes?.relatedVisibilityChanged || loadingDetected || false)
            : (verification.verified || loadingDetected);

      // CRITICAL FIX: Return success=false when click has no effect
      // This prevents AI from continuing after failed clicks
      if (!hadEffect) {
        // FALLBACK: For anchor tags with valid href, try direct navigation
        // Google and other sites may intercept click events, preventing programmatic navigation
        const failedAnchor = element.tagName === 'A' ? element : element.closest('a');
        if (failedAnchor && failedAnchor.href &&
            failedAnchor.href.startsWith('http') &&
            !failedAnchor.href.includes('javascript:')) {
          logger.logActionExecution(FSB.sessionId, 'click', 'href_fallback', {
            href: failedAnchor.href,
            originalSelector: params.selector
          });
          window.location.href = failedAnchor.href;
          return {
            success: true,
            clicked: params.selector,
            hadEffect: true,
            navigationTriggered: true,
            method: 'href-fallback',
            message: 'Click had no effect, navigated via href fallback',
            targetUrl: failedAnchor.href,
            elementInfo: {
              tag: element.tagName,
              text: element.textContent?.trim().substring(0, 50),
              wasScrolledIntoView: wasScrolled
            }
          };
        }

        // FALLBACK 2: For form submit buttons, try form.submit()
        const isSubmitButton = (element.tagName === 'INPUT' && element.type === 'submit') ||
          (element.tagName === 'BUTTON' && (element.type === 'submit' || !element.type));
        const parentForm = element.closest('form');
        if (isSubmitButton && parentForm) {
          logger.logActionExecution(FSB.sessionId, 'click', 'form_submit_fallback', {
            formAction: parentForm.action,
            originalSelector: params.selector
          });
          try {
            parentForm.submit();
            return {
              success: true,
              clicked: params.selector,
              hadEffect: true,
              navigationTriggered: true,
              method: 'form-submit-fallback',
              message: 'Click had no effect, submitted form directly',
              elementInfo: {
                tag: element.tagName,
                text: element.textContent?.trim().substring(0, 50) || element.value?.substring(0, 50),
                wasScrolledIntoView: wasScrolled
              }
            };
          } catch (formError) {
            logger.warn('Form submit fallback failed', { error: formError.message });
          }
        }

        // Record action - click had no effect
        actionRecorder.record(null, 'click', params, {
          selectorTried,
          selectorUsed: selectorTried,
          elementFound: true,
          elementDetails: captureElementDetails(element),
          coordinatesUsed: { x: Math.round(centerX), y: Math.round(centerY) },
          coordinateSource: 'selector',
          success: false,
          error: 'Click executed but had no detectable effect on the page',
          hadEffect: false,
          effectDetails: verification.changes,
          verification: {
            verified: verification.verified,
            changes: verification.changes,
            reason: verification.reason
          },
          diagnostic: generateDiagnostic('noEffect', { action: 'click', changes: verification.changes }),
          duration: Date.now() - startTime
        });
        return {
          success: false,
          error: 'Click executed but had no detectable effect on the page',
          clicked: params.selector,
          hadEffect: false,
          verification: {
            preState,
            postState,
            verified: verification.verified,
            changes: verification.changes,
            reason: verification.reason
          },
          elementInfo: {
            tag: element.tagName,
            text: element.textContent?.trim().substring(0, 50),
            wasScrolledIntoView: wasScrolled
          },
          suggestion: 'Element may not be interactive or may require different interaction method'
        };
      }

      // Record successful action
      actionRecorder.record(null, 'click', params, {
        selectorTried,
        selectorUsed: selectorTried,
        elementFound: true,
        elementDetails: captureElementDetails(element),
        coordinatesUsed: { x: Math.round(centerX), y: Math.round(centerY) },
        coordinateSource: 'selector',
        success: true,
        hadEffect: true,
        effectDetails: verification.changes,
        verification: {
          verified: verification.verified,
          changes: verification.changes,
          reason: verification.reason
        },
        duration: Date.now() - startTime
      });
      return {
        success: true,
        clicked: params.selector,
        hadEffect: true,
        scrolled: wasScrolled,
        verification: {
          preState,
          postState,
          verified: verification.verified,
          changes: verification.changes,
          reason: verification.reason
        },
        elementInfo: {
          tag: element.tagName,
          text: element.textContent?.trim().substring(0, 50),
          wasScrolledIntoView: wasScrolled
        }
      };
    }
  },

  // Click on search result links (Google, Bing, DuckDuckGo, etc.)
  clickSearchResult: async (params) => {
    logger.logActionExecution(FSB.sessionId, 'clickSearchResult', 'start', params);

    // Detect "no results" pages before attempting to click
    const noResultsDetected = FSB.detectSearchNoResults();
    if (noResultsDetected) {
      logger.logActionExecution(FSB.sessionId, 'clickSearchResult', 'no_results_page', { message: noResultsDetected });
      return {
        success: false,
        error: `Search returned no results: ${noResultsDetected}`,
        noResults: true,
        suggestion: 'Try a different search query with fewer or different keywords'
      };
    }

    // Common selectors for search result links across different search engines
    // NOTE: Modern Google uses "a > h3" structure (link contains heading), not "h3 > a"
    const searchResultSelectors = [
      // Google search results - MODERN STRUCTURE (link contains heading)
      'a[href] h3',                     // Link contains H3 heading (current Google structure)
      'a[href] h2',                     // Link contains H2 heading
      '.yuRUbf a',                      // Current Google result container
      '.g a[href]:not([href*="google"])', // Result links (not Google's own links)
      '#search a[jsname]',              // Google's JS-rendered results (only within search container)

      // Google search results - LEGACY STRUCTURE (heading contains link)
      'h3 a',                           // Older Google: H3 contains link
      '.rc .r a',                       // Older Google format

      // Bing search results
      '.b_algo h2 a',                   // Bing main results
      '.b_title a',                     // Bing title links

      // DuckDuckGo results
      '.result__a',                     // DuckDuckGo results
      '.result__title a',               // DuckDuckGo title links

      // Generic patterns - handles various search engines
      '[role="listitem"] a[href]',     // Accessible list-based results
      '[data-testid*="result"] a',     // Test ID patterns
      '.search-result a',               // Generic search result class
      '.result a',                      // Generic result class
      'article a[href]',                // Article-based results

      // If specific text is provided, try to match it
      params.text ? `a:contains("${params.text}")` : null,
      params.domain ? `a[href*="${params.domain}"]` : null
    ].filter(Boolean);

    // Try primary selector if provided
    if (params.selector) {
      const element = FSB.querySelectorWithShadow(params.selector);
      if (element && element.tagName === 'A') {
        element.click();
        return {
          success: true,
          clicked: params.selector,
          href: element.href,
          text: element.textContent?.trim().substring(0, 100)
        };
      }
    }

    // Try to find the nth result if index is specified
    if (params.index !== undefined) {
      // Include both modern (a > h3) and legacy (h3 > a) patterns for maximum compatibility
      const allResults = document.querySelectorAll('a[href] h3, h3 a, .yuRUbf a, .b_algo h2 a, .result__a');
      if (allResults[params.index]) {
        const result = allResults[params.index];
        result.click();
        return {
          success: true,
          clicked: `Result #${params.index + 1}`,
          href: result.href,
          text: result.textContent?.trim().substring(0, 100)
        };
      }
    }

    // CRITICAL FIX: Improved search result click logic
    // Try each selector to find a clickable result
    for (const selector of searchResultSelectors) {
      try {
        const elements = document.querySelectorAll(selector);

        // FIXED: Better filtering logic - don't filter out legitimate nested Google links
        const visibleLinks = Array.from(elements).filter(el => {
          if (el.tagName !== 'A') return false;
          const rect = el.getBoundingClientRect();
          const isVisible = rect.width > 0 && rect.height > 0;
          const hasHref = el.href && !el.href.includes('javascript:');

          // FIXED: Only filter out actual Google search page links, not legitimate result links
          // Allow links that are search results even if they contain google.com
          const isSearchPageLink = el.href.includes('google.com/search?') ||
                                   el.href.includes('google.com/url?');
          const notSearchLink = !isSearchPageLink;

          return isVisible && hasHref && notSearchLink;
        });

        if (visibleLinks.length > 0) {
          // Click the first visible result or one matching the domain/text
          let targetLink = visibleLinks[0];

          // IMPROVED: Better domain matching with priority
          if (params.domain) {
            const domainMatch = visibleLinks.find(link => {
              const linkDomain = new URL(link.href).hostname.toLowerCase();
              const searchDomain = params.domain.toLowerCase();
              return linkDomain.includes(searchDomain) || searchDomain.includes(linkDomain);
            });
            if (domainMatch) {
              targetLink = domainMatch;
              logger.logActionExecution(FSB.sessionId, 'clickSearchResult', 'domain_match', { domain: params.domain, href: targetLink.href });
            }
          }

          // IMPROVED: Better text matching - check both link text and parent heading
          if (params.text) {
            const textMatch = visibleLinks.find(link => {
              const linkText = link.textContent?.toLowerCase() || '';
              const parentText = link.closest('h3, h2, h1')?.textContent?.toLowerCase() || '';
              const searchText = params.text.toLowerCase();
              return linkText.includes(searchText) || parentText.includes(searchText);
            });
            if (textMatch) {
              targetLink = textMatch;
              logger.logActionExecution(FSB.sessionId, 'clickSearchResult', 'text_match', { text: params.text, href: targetLink.href });
            }
          }

          // FIXED: Use actual click instead of navigation
          targetLink.click();
          logger.logActionExecution(FSB.sessionId, 'clickSearchResult', 'clicked', { href: targetLink.href });

          return {
            success: true,
            clicked: selector,
            href: targetLink.href,
            text: targetLink.textContent?.trim().substring(0, 100),
            totalResults: visibleLinks.length,
            matchMethod: params.domain ? 'domain' : params.text ? 'text' : 'first'
          };
        }
      } catch (e) {
        logger.debug('Selector failed for search result', { sessionId: FSB.sessionId, selector, error: e.message });
      }
    }

    // REMOVED: Navigation fallback - force proper clicking instead
    // If we get here, no results were found - return proper error

    return {
      success: false,
      error: 'No search results found to click',
      suggestion: 'Make sure search results are loaded or try a different search query'
    };
  },
  // Type text into an input
  type: async (params) => {
    const startTime = Date.now();
    logger.logActionExecution(FSB.sessionId, 'type', 'start', params);

    // Build selectors array for alternative selector support
    const selectors = params.selectors || [params.selector];
    let lastAttemptError = null;
    let lastVerification = null;
    let selectorUsed = null;
    let lastElement = null;

    // Try each selector until one succeeds with verified effect
    for (let selectorIndex = 0; selectorIndex < selectors.length; selectorIndex++) {
      const currentSelector = selectors[selectorIndex];
      logger.debug('Trying selector for type', { sessionId: FSB.sessionId, selectorIndex, selector: currentSelector });

    try {
      // Find element using shadow DOM aware query
      let element = FSB.querySelectorWithShadow(currentSelector);
      if (!element) {
        lastAttemptError = `Element not found with selector: ${currentSelector}`;
        continue; // Try next selector
      }

      // SPEED-05: Use smart readiness check with fast-path for ready elements
      const readiness = await FSB.smartEnsureReady(element, 'type');
      if (!readiness.ready) {
        lastAttemptError = `Element not ready for typing: ${readiness.failureReason}`;
        continue; // Try next selector
      }

      // Re-fetch element after potential scroll (may have become stale)
      if (readiness.scrolled) {
        element = FSB.querySelectorWithShadow(currentSelector);
        if (!element) {
          lastAttemptError = 'Element became stale after scrolling';
          continue; // Try next selector
        }
      }

      logger.logActionExecution(FSB.sessionId, 'type', 'element_ready', { tagName: element.tagName, scrolled: readiness.scrolled });

      // Capture pre-state for verification
      const preState = captureActionState(element, 'type');

    if (element) {
      // Check if it's a valid input element with enhanced contenteditable detection
      const isInput = element.tagName === 'INPUT' || element.tagName === 'TEXTAREA';

      // Enhanced universal text input detection for all platforms
      const isContentEditable = element.contentEditable === 'true' ||
                                element.getAttribute('contenteditable') === 'true' ||
                                element.hasAttribute('contenteditable') ||
                                element.getAttribute('role') === 'textbox' ||
                                // Universal messaging patterns
                                FSB.isUniversalMessageInput(element);

      const codeEditorInfo = FSB.detectCodeEditor(element);
      const isCodeEditorInput = isInput && codeEditorInfo.isCodeEditor;

      // Canvas-based editor bypass: skip element gate and use CDP directly.
      const canvasEditor = FSB.isCanvasBasedEditor();

      // Google Sheets Name Box guard: if AI targets the Name Box with non-cell-reference text,
      // redirect to keyboard emulator to type into the active cell instead.
      if (canvasEditor && isInput) {
        const isGoogleSheets = window.location.hostname === 'docs.google.com' &&
                               window.location.pathname.startsWith('/spreadsheets/');
        const isNameBox = element.dataset?.fsbRole === 'name-box' ||
                          element.id === 't-name-box' ||
                          element.getAttribute('name') === 't-name-box';
        const textVal = (params.text || '').trim();
        const isCellReference = /^[A-Z]{1,3}[0-9]{1,7}(:[A-Z]{1,3}[0-9]{1,7})?$/i.test(textVal);

        if (isGoogleSheets && isNameBox && textVal && !isCellReference) {
          logger.debug('Name Box guard: redirecting non-cell-reference data to active cell', {
            text: textVal.substring(0, 30),
            sessionId: FSB.sessionId
          });
          // Press Escape first to blur the Name Box and return focus to the grid
          try { await tools.keyPress({ key: 'Escape', useDebuggerAPI: true }); } catch(e) {}
          await new Promise(resolve => setTimeout(resolve, 100));
          try {
            const twkResult = await tools.typeWithKeys({ text: params.text, clearFirst: false, delay: 20 });
            if (twkResult.success) {
              if (params.pressEnter) {
                await new Promise(resolve => setTimeout(resolve, 100));
                await tools.keyPress({ key: 'Enter', useDebuggerAPI: true });
              }
              return {
                success: true,
                typed: params.text,
                method: 'google_sheets_keyboard',
                pressedEnter: !!params.pressEnter,
                hadEffect: true,
                note: 'Google Sheets Name Box guard -- data redirected to active cell via keyboard emulator'
              };
            }
          } catch (e) {
            logger.debug('Name Box guard typeWithKeys failed, falling through', { error: e.message });
          }
        }
      }

      if (canvasEditor && !isInput) {
        // Google Sheets: use keyboard emulator (typeWithKeys) instead of CDP Input.insertText.
        // Google Sheets requires keyDown events to enter cell edit mode -- Input.insertText
        // bypasses the keyboard event pipeline entirely, so text has nowhere to go.
        const isGoogleSheets = window.location.hostname === 'docs.google.com' &&
                               window.location.pathname.startsWith('/spreadsheets/');
        if (isGoogleSheets) {
          logger.logActionExecution(FSB.sessionId, 'type', 'google_sheets_keyboard_entry', { hostname: window.location.hostname, textLength: params.text?.length });
          try {
            // clearFirst: false -- in Sheets, typing into a selected cell naturally replaces content.
            // Ctrl+A before typing would select all cells (catastrophic), not just cell content.
            const twkResult = await tools.typeWithKeys({ text: params.text, clearFirst: false, delay: 20 });
            if (twkResult.success) {
              if (params.pressEnter) {
                await new Promise(resolve => setTimeout(resolve, 100));
                await tools.keyPress({ key: 'Enter', useDebuggerAPI: true });
              }
              return {
                success: true,
                typed: params.text,
                method: 'google_sheets_keyboard',
                pressedEnter: !!params.pressEnter,
                hadEffect: true,
                note: 'Google Sheets -- keyboard emulator used for proper keyDown event processing'
              };
            }
          } catch (twkError) {
            logger.debug('Google Sheets typeWithKeys failed, falling through to CDP', { error: twkError.message });
          }
          // Fall through to standard CDP path as last resort
        }

        logger.logActionExecution(FSB.sessionId, 'type', 'canvas_editor_cdp_direct', { hostname: window.location.hostname });

        // --- FORMATTED PASTE PATH ---
        const isGoogleDocs = window.location.hostname === 'docs.google.com' &&
                             window.location.pathname.startsWith('/document/');
        const textHasFormatting = FSB.hasMarkdownFormatting(params.text);

        if (isGoogleDocs && textHasFormatting) {
          logger.logActionExecution(FSB.sessionId, 'type', 'gdocs_formatted_paste_attempt', {
            textLength: params.text.length,
            hasFormatting: true
          });
          try {
            const cursorTarget = document.querySelector('.kix-page-content-wrapper') ||
                                 document.querySelector('.kix-paginateddocumentplugin') ||
                                 document.querySelector('.kix-page') ||
                                 document.querySelector('.kix-appview-editor');
            if (cursorTarget) {
              cursorTarget.focus();
              cursorTarget.click();
              logger.debug('gdocs_formatted_paste: focused cursor target', { tagName: cursorTarget.tagName, className: cursorTarget.className?.substring?.(0, 60) });
              await new Promise(r => setTimeout(r, 200));
            }

            // If clearFirst, select all and delete before pasting
            if (params.clearFirst) {
              const isMac = navigator.userAgent?.includes('Macintosh') || navigator.platform?.includes('Mac');
              await new Promise((resolve, reject) => {
                chrome.runtime.sendMessage({
                  action: 'keyboardDebuggerAction',
                  method: 'pressKey',
                  key: 'a',
                  modifiers: { ctrl: !isMac, meta: isMac, shift: false, alt: false }
                }, (response) => {
                  if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
                  else resolve(response);
                });
              });
              await new Promise(r => setTimeout(r, 200));
              await new Promise((resolve, reject) => {
                chrome.runtime.sendMessage({
                  action: 'keyboardDebuggerAction',
                  method: 'pressKey',
                  key: 'Backspace',
                  modifiers: { ctrl: false, meta: false, shift: false, alt: false }
                }, (response) => {
                  if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
                  else resolve(response);
                });
              });
              await new Promise(r => setTimeout(r, 200));
            }

            const html = FSB.markdownToHTML(params.text);
            const plainText = FSB.stripMarkdown(params.text);
            const pasteResult = await FSB.clipboardPasteHTML(html, plainText);

            if (pasteResult.success) {
              logger.logActionExecution(FSB.sessionId, 'type', 'gdocs_formatted_paste_verified', {
                textLenBefore: pasteResult.textLenBefore,
                textLenAfter: pasteResult.textLenAfter
              });
              if (params.pressEnter) {
                await new Promise(resolve => setTimeout(resolve, 100));
                document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
                document.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
              }
              return {
                success: true,
                typed: params.text,
                method: 'gdocs_formatted_clipboard_paste',
                pressedEnter: !!params.pressEnter,
                note: 'Google Docs -- markdown converted to HTML, pasted via clipboard for rich formatting'
              };
            }
            // If clipboard paste failed (verified -- no text appeared), fall through to plain CDP insertText
            logger.warn('Formatted paste failed (verified), falling back to plain CDP insertText', {
              error: pasteResult.error,
              textLenBefore: pasteResult.textLenBefore,
              textLenAfter: pasteResult.textLenAfter
            });
          } catch (fmtError) {
            logger.debug('Formatted paste error, falling back to plain CDP insertText', { error: fmtError.message });
          }
        }
        // --- END FORMATTED PASTE PATH ---

        const cdpText = (isGoogleDocs && textHasFormatting) ? FSB.stripMarkdown(params.text) : params.text;

        try {
          const cdpResult = await new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({
              action: 'cdpInsertText',
              text: cdpText,
              clearFirst: !!params.clearFirst
            }, (response) => {
              if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
              else if (response && response.success) resolve(response);
              else reject(new Error(response?.error || 'CDP insertion failed'));
            });
          });
          // Trust CDP on canvas editors -- no DOM validation possible
          if (params.pressEnter) {
            await new Promise(resolve => setTimeout(resolve, 100));
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
            document.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
          }
          return {
            success: true,
            typed: params.text,
            method: 'canvas_editor_cdp',
            pressedEnter: !!params.pressEnter,
            note: 'Canvas-based editor -- CDP insertion used, DOM validation skipped'
          };
        } catch (cdpError) {
          logger.debug('Canvas editor CDP failed, trying typeWithKeys', { error: cdpError.message });
          try {
            const twkResult = await tools.typeWithKeys({ text: params.text, clearFirst: false });
            if (twkResult.success) return { ...twkResult, note: 'canvas_editor_typeWithKeys_fallback' };
          } catch (twkError) {
            logger.debug('Canvas editor typeWithKeys also failed', { error: twkError.message });
          }
          return { success: false, error: 'Canvas-based editor: CDP and typeWithKeys both failed', typed: params.text };
        }
      }

      if (!isInput && !isContentEditable) {
        lastAttemptError = 'Element is not an input field';
        continue; // Try next selector
      }

      // Universal activation strategy - click ALL input elements by default
      const shouldSkipClick = params.clickFirst === false; // Explicit opt-out only

      // Universal click-first activation (unless explicitly disabled)
      if (!shouldSkipClick) {
        element.click();
        await new Promise(resolve => setTimeout(resolve, 100));

        if (document.activeElement !== element && element.id) {
          const label = document.querySelector(`label[for="${element.id}"]`);
          if (label) {
            label.click();
            await new Promise(resolve => setTimeout(resolve, 50));
          }
        }

        if (document.activeElement !== element && element.parentElement) {
          element.parentElement.click();
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }

      // Always focus after clicking
      element.focus();
      await new Promise(resolve => setTimeout(resolve, 50));

      // Final verification - ensure element is truly focused and ready
      let focusAttempts = 0;
      while (document.activeElement !== element && focusAttempts < 3) {
        element.click();
        element.focus();
        await new Promise(resolve => setTimeout(resolve, 100));
        focusAttempts++;
      }

      // Universal text insertion handling for both input elements and contenteditable
      let previousValue = '';
      let insertionSuccess = false;

      // CODE EDITOR CDP FAST-PATH
      if (codeEditorInfo.isCodeEditor) {
        // STEP 1: Try MAIN world executeEdits (Monaco/CM6)
        if (codeEditorInfo.type === 'monaco' || codeEditorInfo.type === 'codemirror6') {
          try {
            logger.debug('Trying editor API via MAIN world injection', {
              sessionId: FSB.sessionId,
              editorType: codeEditorInfo.type,
              textLength: params.text.length
            });

            const editorResult = await new Promise((resolve, reject) => {
              chrome.runtime.sendMessage({
                action: 'monacoEditorInsert',
                text: params.text
              }, (response) => {
                if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
                else if (response?.success) resolve(response);
                else reject(new Error(response?.error || 'Editor API failed'));
              });
            });

            await new Promise(resolve => setTimeout(resolve, 200));

            logger.debug('Editor API via MAIN world succeeded', {
              sessionId: FSB.sessionId,
              editorType: codeEditorInfo.type,
              method: editorResult.method
            });

            return {
              success: true,
              typed: params.text,
              method: editorResult.method,
              pressedEnter: !!params.pressEnter,
              clickedFirst: !shouldSkipClick,
              editorType: codeEditorInfo.type,
              elementInfo: {
                tag: element.tagName,
                type: 'code_editor',
                name: element.name || element.id || element.className
              }
            };
          } catch (editorApiError) {
            logger.debug('Editor API failed, falling through to CDP', {
              sessionId: FSB.sessionId,
              error: editorApiError.message
            });
          }
        }

        // STEP 2: CDP fast-path
        try {
          logger.debug('Code editor detected, using CDP fast-path', {
            sessionId: FSB.sessionId,
            editorType: codeEditorInfo.type,
            elementTag: element.tagName,
            textLength: params.text.length
          });

          const cdpResult = await new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({
              action: 'cdpInsertText',
              text: params.text,
              clearFirst: true
            }, (response) => {
              if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
              else if (response?.success) resolve(response);
              else reject(new Error(response?.error || 'CDP failed'));
            });
          });

          await new Promise(resolve => setTimeout(resolve, 300));

          logger.debug('CDP code editor fast-path succeeded', {
            sessionId: FSB.sessionId,
            editorType: codeEditorInfo.type
          });

          return {
            success: true,
            typed: params.text,
            method: 'cdp_code_editor',
            pressedEnter: !!params.pressEnter,
            clickedFirst: !shouldSkipClick,
            editorType: codeEditorInfo.type,
            elementInfo: {
              tag: element.tagName,
              type: 'code_editor',
              name: element.name || element.id || element.className
            }
          };
        } catch (cdpCodeEditorError) {
          logger.debug('CDP code editor fast-path failed, falling through to standard methods', {
            sessionId: FSB.sessionId,
            error: cdpCodeEditorError.message
          });
        }
      }

      if (isCodeEditorInput) {
        previousValue = element.value || '';
        element.focus();
        await new Promise(resolve => setTimeout(resolve, 150));

        let codeInserted = false;

        if (!codeInserted && document.execCommand) {
          try {
            element.select();
            if (document.execCommand('insertText', false, params.text)) {
              codeInserted = true;
            }
          } catch (e) {
            logger.debug('Code editor execCommand failed', { error: e.message });
          }
        }

        if (!codeInserted) {
          try {
            element.select();
            element.dispatchEvent(new InputEvent('beforeinput', {
              inputType: 'insertText',
              data: params.text,
              bubbles: true,
              cancelable: true,
              composed: true
            }));
            element.dispatchEvent(new InputEvent('input', {
              inputType: 'insertText',
              data: params.text,
              bubbles: true
            }));
            codeInserted = true;
          } catch (e) {
            logger.debug('Code editor InputEvent failed', { error: e.message });
          }
        }

        if (!codeInserted) {
          try {
            const dataTransfer = new DataTransfer();
            dataTransfer.setData('text/plain', params.text);
            element.dispatchEvent(new ClipboardEvent('paste', {
              clipboardData: dataTransfer,
              bubbles: true,
              cancelable: true
            }));
            await new Promise(resolve => setTimeout(resolve, 100));
            codeInserted = true;
          } catch (e) {
            logger.debug('Code editor clipboard paste failed', { error: e.message });
          }
        }

        if (!codeInserted) {
          element.value = params.text;
          element.dispatchEvent(new Event('input', { bubbles: true }));
          element.dispatchEvent(new Event('change', { bubbles: true }));
        }

        logger.debug('Code editor typing complete', {
          sessionId: FSB.sessionId,
          editorType: codeEditorInfo.type,
          method: codeInserted ? 'specialized' : 'fallback',
          textLength: params.text.length
        });

      } else if (isInput) {
        previousValue = element.value;
        element.value = '';
        element.value = params.text;
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
        element.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
      } else if (isContentEditable) {
        previousValue = element.textContent || element.innerText || '';
        insertionSuccess = false;

        if (!insertionSuccess && document.execCommand) {
          try {
            element.focus();
            document.execCommand('selectAll', false, null);
            if (document.execCommand('insertText', false, params.text)) {
              insertionSuccess = true;
            }
          } catch (e) {
            logger.debug('execCommand insertText failed', { sessionId: FSB.sessionId, error: e.message });
          }
        }

        if (!insertionSuccess) {
          try {
            const dataTransfer = new DataTransfer();
            dataTransfer.setData('text/plain', params.text);
            const pasteEvent = new ClipboardEvent('paste', {
              clipboardData: dataTransfer,
              bubbles: true,
              cancelable: true
            });
            element.dispatchEvent(pasteEvent);
            await new Promise(resolve => setTimeout(resolve, 50));
            if (element.textContent.includes(params.text)) {
              insertionSuccess = true;
            }
          } catch (e) {
            logger.debug('Clipboard paste simulation failed', { sessionId: FSB.sessionId, error: e.message });
          }
        }

        if (!insertionSuccess) {
          try {
            element.innerHTML = '';
            element.textContent = '';
            const textNode = document.createTextNode(params.text);
            element.appendChild(textNode);
            const range = document.createRange();
            const selection = window.getSelection();
            range.setStartAfter(textNode);
            range.collapse(true);
            selection.removeAllRanges();
            selection.addRange(range);
            insertionSuccess = true;
          } catch (e) {
            logger.debug('Range/Selection API insertion failed', { sessionId: FSB.sessionId, error: e.message });
          }
        }

        if (!insertionSuccess) {
          if (element.innerHTML.includes('<p><br></p>') || element.innerHTML.includes('<br>')) {
            element.innerHTML = '';
          } else {
            element.textContent = '';
          }
          try {
            element.textContent = params.text;
            insertionSuccess = true;
          } catch (e) {
            logger.debug('Direct manipulation failed', { sessionId: FSB.sessionId, error: e.message });
          }
        }

        const events = [
          new Event('input', { bubbles: true }),
          new Event('change', { bubbles: true }),
          new KeyboardEvent('keydown', { bubbles: true }),
          new KeyboardEvent('keyup', { bubbles: true }),
          new Event('blur', { bubbles: true }),
          new Event('focus', { bubbles: true })
        ];

        events.forEach(event => {
          try {
            element.dispatchEvent(event);
          } catch (e) {
            logger.debug('Event dispatch failed', { sessionId: FSB.sessionId, eventType: event.type, error: e.message });
          }
        });

        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Gmail/email recipient field: dispatch Tab to confirm the recipient "chip"
      const recipientKeywords = ['to recipients', 'cc recipients', 'bcc recipients', 'to', 'cc', 'bcc', 'recipients'];
      const elAriaLabel = (element.getAttribute('aria-label') || '').toLowerCase();
      const elName = (element.getAttribute('name') || '').toLowerCase();
      const isRecipientField = recipientKeywords.some(kw => elAriaLabel.includes(kw)) ||
                               ['to', 'cc', 'bcc'].includes(elName);
      const looksLikeEmail = params.text && params.text.includes('@');

      if (isRecipientField && looksLikeEmail) {
        logger.debug('Recipient field detected, sending Tab to confirm chip', {
          sessionId: FSB.sessionId, ariaLabel: elAriaLabel, text: params.text
        });
        await new Promise(resolve => setTimeout(resolve, 200));
        element.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Tab', code: 'Tab', keyCode: 9, which: 9, bubbles: true, cancelable: true
        }));
        element.dispatchEvent(new KeyboardEvent('keyup', {
          key: 'Tab', code: 'Tab', keyCode: 9, which: 9, bubbles: true, cancelable: true
        }));
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      // Optional: Press Enter after typing
      if (params.pressEnter) {
        const enterEvent = new KeyboardEvent('keydown', {
          key: 'Enter', code: 'Enter', keyCode: 13, which: 13,
          bubbles: true, cancelable: true
        });
        element.dispatchEvent(enterEvent);
        const enterUpEvent = new KeyboardEvent('keyup', {
          key: 'Enter', code: 'Enter', keyCode: 13, which: 13,
          bubbles: true, cancelable: true
        });
        element.dispatchEvent(enterUpEvent);
      }

      // Post-typing validation
      const finalValue = isInput ? (element.value || '') : (element.textContent || element.value || '');
      const typingSuccessful = finalValue.includes(params.text) || finalValue === params.text;

      // Amazon-specific validation
      const isAmazonSearch = element.id === 'twotabsearchtextbox' ||
                           element.name === 'searchtext' ||
                           window.location.hostname.includes('amazon');

      if (isAmazonSearch && !typingSuccessful) {
        logger.logActionExecution(FSB.sessionId, 'type', 'amazon_retry', { reason: 'initial_typing_failed' });
        try {
          element.focus();
          await new Promise(resolve => setTimeout(resolve, 100));
          element.value = '';
          element.value = params.text;
          element.dispatchEvent(new Event('input', { bubbles: true }));
          element.dispatchEvent(new Event('change', { bubbles: true }));
          element.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: params.text.slice(-1) }));
          element.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: params.text.slice(-1) }));
          await new Promise(resolve => setTimeout(resolve, 200));
          const retryValue = element.value || '';
          if (retryValue.includes(params.text) || retryValue === params.text) {
            logger.logActionExecution(FSB.sessionId, 'type', 'amazon_retry_success', {});
          }
        } catch (amazonError) {
          logger.warn('Amazon-specific retry failed', { sessionId: FSB.sessionId, error: amazonError.message });
        }
      }

      // CRITICAL FIX: Strengthen validation
      const finalCheck = isInput ? (element.value || '') : (element.textContent || element.value || '');
      const trimmedFinal = finalCheck.trim();
      const trimmedExpected = params.text.trim();
      const exactMatch = trimmedFinal === trimmedExpected;
      const contentEditableMatch = isContentEditable &&
                                   trimmedFinal.replace(/\s+/g, ' ') === trimmedExpected.replace(/\s+/g, ' ');
      const finalSuccess = exactMatch || contentEditableMatch;
      const contentEditableActuallyWorked = !isContentEditable || (insertionSuccess && finalSuccess);

      // Gmail recipient chip check
      if (isRecipientField && looksLikeEmail && !finalSuccess) {
        const chipEl = element.closest('[role="list"], .fX, .afV')?.querySelector(
          '.vR, [data-hovercard-id], [data-name], .afX'
        );
        const fieldCleared = trimmedFinal === '' || !trimmedFinal.includes(params.text);
        if (chipEl || fieldCleared) {
          logger.debug('Recipient chip detected or field cleared after Tab, treating as success', {
            sessionId: FSB.sessionId, chipFound: !!chipEl, fieldCleared
          });
          return {
            success: true,
            typed: params.text,
            method: 'recipient_chip',
            pressedEnter: !!params.pressEnter,
            clickedFirst: !shouldSkipClick,
            note: chipEl ? 'recipient_chip_confirmed' : 'field_cleared_after_tab',
            elementInfo: {
              tag: element.tagName,
              type: isInput ? element.type : 'contenteditable',
              name: element.name || element.id || FSB.getClassName(element)
            }
          };
        }
      }

      // Return failure if typing didn't work
      if (!finalSuccess || (isContentEditable && !isCodeEditorInput && !insertionSuccess)) {
        const recheck = isInput ? (element.value || '') : (element.textContent || element.innerText || '');
        if (recheck.includes(params.text)) {
          return {
            success: true,
            typed: params.text,
            method: 'standard',
            pressedEnter: !!params.pressEnter,
            clickedFirst: !shouldSkipClick,
            note: 'recheck_confirmed_text_present',
            elementInfo: {
              tag: element.tagName,
              type: isInput ? element.type : 'contenteditable',
              name: element.name || element.id || element.className
            }
          };
        }

        // ENHANCED: Try CDP-based text insertion as last resort
        logger.logActionExecution(FSB.sessionId, 'type', 'cdp_fallback_attempt', { reason: 'standard_methods_failed' });

        try {
          const cdpResult = await new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({
              action: 'cdpInsertText',
              text: params.text,
              clearFirst: true
            }, (response) => {
              if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
              } else if (response && response.success) {
                resolve(response);
              } else {
                reject(new Error(response?.error || 'CDP insertion failed'));
              }
            });
          });

          await new Promise(resolve => setTimeout(resolve, 200));
          const cdpCanvasEditor = FSB.isCanvasBasedEditor();
          const cdpFinalCheck = cdpCanvasEditor ? '' : (isInput ? (element.value || '') : (element.textContent || element.value || ''));
          const cdpSuccess = cdpCanvasEditor || cdpFinalCheck.includes(params.text) || cdpFinalCheck.trim() === params.text.trim();

          if (cdpSuccess) {
            logger.logActionExecution(FSB.sessionId, 'type', cdpCanvasEditor ? 'cdp_fallback_canvas_success' : 'cdp_fallback_success', {});
            return {
              success: true,
              typed: params.text,
              method: cdpCanvasEditor ? 'cdp_fallback_canvas' : 'cdp_fallback',
              pressedEnter: !!params.pressEnter,
              clickedFirst: !shouldSkipClick,
              note: cdpCanvasEditor ? 'Canvas-based editor -- DOM validation skipped, CDP trusted' : undefined,
              elementInfo: {
                tag: element.tagName,
                type: isInput ? element.type : 'contenteditable',
                name: element.name || element.id || element.className
              }
            };
          }
        } catch (cdpError) {
          logger.debug('CDP fallback failed', { sessionId: FSB.sessionId, error: cdpError.message });
        }

        return {
          success: false,
          error: isContentEditable
            ? 'ContentEditable insertion failed - text not entered correctly (CDP fallback also failed)'
            : 'Text validation failed - expected text not found in element',
          typed: params.text,
          actualValue: finalCheck,
          expectedValue: params.text,
          pressedEnter: !!params.pressEnter,
          clickedFirst: !shouldSkipClick,
          focused: document.activeElement === element,
          insertionSuccess: isContentEditable ? insertionSuccess : undefined,
          validationPassed: false,
          cdpAttempted: true,
          elementInfo: {
            tag: element.tagName,
            type: isInput ? element.type : 'contenteditable',
            previousValue: previousValue.substring(0, 20),
            name: element.name || element.id || FSB.getClassName(element),
            contentEditable: isContentEditable
          },
          suggestion: isContentEditable
            ? 'Try alternative selector or wait for page to be ready'
            : 'Element may not accept input correctly'
        };
      }

      // Wait for page stability before capturing post-state
      await waitForPageStability({ maxWait: 1000, stableTime: 200 });

      // Capture post-state for verification
      const postState = captureActionState(element, 'type');
      const verification = verifyActionEffect(preState, postState, 'type');
      lastVerification = verification;

      if (!verification.verified) {
        logger.debug('Type verification failed, trying next selector', {
          sessionId: FSB.sessionId,
          selector: currentSelector,
          reason: verification.reason
        });
        lastAttemptError = `Type action had no verified effect: ${verification.reason}`;
        continue; // Try next selector
      }

      // Record successful action
      selectorUsed = currentSelector;
      actionRecorder.record(null, 'type', params, {
        selectorTried: params.selector,
        selectorUsed: currentSelector,
        elementFound: true,
        elementDetails: captureElementDetails(element),
        coordinatesUsed: null,
        coordinateSource: null,
        success: true,
        hadEffect: true,
        effectDetails: verification.changes,
        duration: Date.now() - startTime
      });

      return {
        success: true,
        typed: params.text,
        selector: currentSelector,
        selectorIndex: selectorIndex,
        usedFallback: selectorIndex > 0,
        hadEffect: true,
        verification: {
          verified: verification.verified,
          reason: verification.reason,
          changes: verification.changes
        },
        actualValue: finalCheck,
        pressedEnter: !!params.pressEnter,
        clickedFirst: !shouldSkipClick,
        focused: document.activeElement === element,
        focusAttempts: focusAttempts,
        scrolled: readiness.scrolled || false,
        insertionSuccess: isContentEditable ? insertionSuccess : true,
        amazonSpecific: isAmazonSearch,
        validationPassed: true,
        finalTextContent: finalCheck,
        elementInfo: {
          tag: element.tagName,
          type: isInput ? element.type : 'contenteditable',
          previousValue: previousValue.substring(0, 20),
          name: element.name || element.id || FSB.getClassName(element),
          contentEditable: isContentEditable,
          ariaLabel: element.getAttribute('aria-label'),
          dataTestId: element.getAttribute('data-testid'),
          className: FSB.getClassName(element)
        }
      };
    }

    // Try fallback selectors for messaging interfaces
    const fallbackSelectors = FSB.generateMessagingSelectors(currentSelector);
    logger.debug('Trying fallback selectors for type', { sessionId: FSB.sessionId, count: fallbackSelectors.length });

    for (const fallbackSelector of fallbackSelectors) {
      const fallbackElement = document.querySelector(fallbackSelector);
      if (fallbackElement) {
        logger.logActionExecution(FSB.sessionId, 'type', 'fallback_found', { selector: fallbackSelector });
        return await tools.type({...params, selector: fallbackSelector});
      }
    }

    // Enhanced error reporting for debugging
    const availableInputs = Array.from(document.querySelectorAll('input, textarea, [contenteditable="true"]'))
      .map(el => ({
        tag: el.tagName,
        id: el.id,
        name: el.name,
        class: FSB.getClassName(el),
        type: el.type || 'contenteditable',
        visible: el.offsetWidth > 0 && el.offsetHeight > 0
      }))
      .slice(0, 5);

    logger.error('Failed to find typeable element', { sessionId: FSB.sessionId, selector: currentSelector, availableInputs });
    lastAttemptError = 'Input element not found with any selector';

    } catch (error) {
      logger.error('Unexpected error in type function', {
        sessionId: FSB.sessionId,
        error: error.message,
        stack: error.stack,
        params,
        currentSelector: currentSelector
      });

      if (lastVerification && lastVerification.verified) {
        logger.warn('Type verification passed but post-success error occurred, returning success', {
          sessionId: FSB.sessionId,
          error: error.message,
          verification: lastVerification.reason
        });
        return {
          success: true,
          typed: params.text,
          selector: currentSelector,
          hadEffect: true,
          verification: {
            verified: true,
            reason: lastVerification.reason,
            changes: lastVerification.changes
          },
          pressedEnter: !!params.pressEnter,
          validationPassed: true,
          recoveredFromError: error.message
        };
      }

      lastAttemptError = error.message || 'Unknown error occurred in type function';
    }
    } // End selector loop

    // Canvas editor fallback: when all selectors fail but we're on a canvas editor
    if (FSB.isCanvasBasedEditor()) {
      // Google Sheets: use keyboard emulator first (same reason as above -- Input.insertText
      // doesn't enter cell edit mode, so text goes nowhere)
      const isGoogleSheetsFallback = window.location.hostname === 'docs.google.com' &&
                                     window.location.pathname.startsWith('/spreadsheets/');
      if (isGoogleSheetsFallback) {
        logger.logActionExecution(FSB.sessionId, 'type', 'google_sheets_fallback_keyboard', {
          hostname: window.location.hostname,
          reason: 'all selectors exhausted, using keyboard emulator for Sheets'
        });
        try {
          const twkResult = await tools.typeWithKeys({ text: params.text, clearFirst: false, delay: 20 });
          if (twkResult.success) {
            if (params.pressEnter) {
              await new Promise(resolve => setTimeout(resolve, 100));
              await tools.keyPress({ key: 'Enter', useDebuggerAPI: true });
            }
            return {
              success: true,
              typed: params.text,
              method: 'google_sheets_keyboard_fallback',
              pressedEnter: !!params.pressEnter,
              note: 'Google Sheets fallback -- keyboard emulator used (all selectors exhausted)'
            };
          }
        } catch (twkErr) {
          logger.debug('Google Sheets fallback typeWithKeys failed', { error: twkErr.message });
        }
        // Fall through to standard canvas CDP fallback as last resort
      }

      logger.logActionExecution(FSB.sessionId, 'type', 'canvas_fallback_attempt', {
        hostname: window.location.hostname,
        reason: 'all selectors exhausted'
      });
      try {
        const canvasTarget = document.querySelector('.kix-page-column') || document.querySelector('.kix-appview-editor');
        if (canvasTarget) {
          canvasTarget.click();
          await new Promise(r => setTimeout(r, 200));
          const eventTargetIframe = document.querySelector('.docs-texteventtarget-iframe');
          if (eventTargetIframe && eventTargetIframe.contentDocument) {
            try {
              const innerEditable = eventTargetIframe.contentDocument.querySelector('[contenteditable="true"]');
              if (innerEditable) innerEditable.focus();
            } catch (e) {
              // Cross-origin iframe
            }
          }
          await new Promise(r => setTimeout(r, 200));
        }
        const cdpResult = await new Promise((resolve, reject) => {
          chrome.runtime.sendMessage({
            action: 'cdpInsertText',
            text: params.text,
            clearFirst: !!params.clearFirst
          }, (response) => {
            if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
            else if (response && response.success) resolve(response);
            else reject(new Error(response?.error || 'CDP insertion failed'));
          });
        });
        if (params.pressEnter) {
          await new Promise(resolve => setTimeout(resolve, 100));
          document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
          document.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
        }
        return {
          success: true,
          typed: params.text,
          method: 'canvas_editor_cdp_fallback',
          pressedEnter: !!params.pressEnter,
          note: 'Canvas editor fallback -- no element found, CDP insertion used directly'
        };
      } catch (cdpFallbackErr) {
        logger.debug('Canvas editor CDP fallback failed', { error: cdpFallbackErr.message });
        try {
          const twkResult = await tools.typeWithKeys({ text: params.text, clearFirst: false });
          if (twkResult.success) return { ...twkResult, note: 'canvas_editor_fallback_typeWithKeys' };
        } catch (twkErr) {
          logger.debug('Canvas editor fallback typeWithKeys also failed', { error: twkErr.message });
        }
        lastAttemptError = `Canvas editor CDP fallback failed: ${cdpFallbackErr.message}`;
      }
    }

    // Record failure - all selectors exhausted
    actionRecorder.record(null, 'type', params, {
      selectorTried: params.selector,
      selectorUsed: null,
      elementFound: false,
      elementDetails: null,
      coordinatesUsed: null,
      coordinateSource: null,
      success: false,
      error: lastAttemptError || 'Type action had no effect with any available selector',
      hadEffect: false,
      diagnostic: generateDiagnostic('elementNotFound', { selector: params.selector, tried: selectors }),
      duration: Date.now() - startTime
    });

    return {
      success: false,
      error: lastAttemptError || 'Type action had no effect with any available selector',
      hadEffect: false,
      selectorsTriad: selectors.length,
      lastVerification: lastVerification,
      suggestion: 'Input may be readonly, disabled, or requires focus first',
      isAmazonPage: window.location.hostname.includes('amazon'),
      currentUrl: window.location.href,
      timestamp: Date.now()
    };
  },
  // Press Enter key on an element with verification
  pressEnter: async (params) => {
    const startTime = Date.now();
    const selectors = params.selectors || [params.selector];
    let lastAttemptError = null;
    let lastVerification = null;
    let lastElement = null;

    for (let selectorIndex = 0; selectorIndex < selectors.length; selectorIndex++) {
      const currentSelector = selectors[selectorIndex];

      try {
        let element = FSB.querySelectorWithShadow(currentSelector);
        if (!element) {
          lastAttemptError = `Element not found with selector: ${currentSelector}`;
          continue;
        }

        const readiness = await FSB.smartEnsureReady(element, 'pressEnter');
        if (!readiness.ready) {
          lastAttemptError = `Element not ready: ${readiness.failureReason}`;
          continue;
        }

        if (readiness.scrolled) {
          element = FSB.querySelectorWithShadow(currentSelector);
          if (!element) {
            lastAttemptError = 'Element became stale after scrolling';
            continue;
          }
        }

        const isInsideForm = !!element.closest('form');
        const formElement = element.closest('form');
        const preState = captureActionState(element, 'pressEnter');

        element.focus();

        const enterDownEvent = new KeyboardEvent('keydown', {
          key: 'Enter', code: 'Enter', keyCode: 13, which: 13,
          bubbles: true, cancelable: true
        });
        element.dispatchEvent(enterDownEvent);

        const enterUpEvent = new KeyboardEvent('keyup', {
          key: 'Enter', code: 'Enter', keyCode: 13, which: 13,
          bubbles: true, cancelable: true
        });
        element.dispatchEvent(enterUpEvent);

        await waitForPageStability({ maxWait: 2000, stableTime: 300 });

        const postState = captureActionState(element, 'pressEnter');
        const verification = verifyActionEffect(preState, postState, 'pressEnter');
        lastVerification = verification;

        if (!verification.verified && isInsideForm) {
          lastAttemptError = `Enter key pressed but form submission had no effect`;
          continue;
        }

        actionRecorder.record(null, 'pressEnter', params, {
          selectorTried: params.selector,
          selectorUsed: currentSelector,
          elementFound: true,
          elementDetails: captureElementDetails(element),
          coordinatesUsed: null,
          coordinateSource: null,
          success: true,
          hadEffect: verification.verified,
          effectDetails: verification.changes,
          duration: Date.now() - startTime
        });

        return {
          success: true,
          key: 'Enter',
          selector: currentSelector,
          selectorIndex: selectorIndex,
          usedFallback: selectorIndex > 0,
          hadEffect: verification.verified,
          isInsideForm: isInsideForm,
          verification: {
            verified: verification.verified,
            reason: verification.reason,
            changes: verification.changes
          }
        };
      } catch (error) {
        lastAttemptError = error.message;
      }
    }

    actionRecorder.record(null, 'pressEnter', params, {
      selectorTried: params.selector,
      selectorUsed: null,
      elementFound: false,
      elementDetails: null,
      coordinatesUsed: null,
      coordinateSource: null,
      success: false,
      error: lastAttemptError || 'Enter key had no effect with any available selector',
      hadEffect: false,
      diagnostic: generateDiagnostic('elementNotFound', { selector: params.selector, tried: selectors }),
      duration: Date.now() - startTime
    });

    return {
      success: false,
      error: lastAttemptError || 'Enter key had no effect with any available selector',
      hadEffect: false,
      selectorsTriad: selectors.length,
      lastVerification: lastVerification,
      suggestion: 'Form may have validation errors or require button click instead'
    };
  },

  // Move mouse to coordinates (simulated)
  moveMouse: (params) => {
    const element = document.elementFromPoint(params.x, params.y);
    if (element) {
      element.dispatchEvent(new MouseEvent('mouseover', {
        bubbles: true,
        clientX: params.x,
        clientY: params.y
      }));
      return { success: true, movedTo: { x: params.x, y: params.y } };
    }
    return { success: false, error: 'No element at coordinates' };
  },

  // CAPTCHA solving via 2Captcha service
  solveCaptcha: async (params) => {
    const settings = await new Promise(resolve => {
      chrome.storage.local.get(['captchaSolverEnabled', 'captchaApiKey'], resolve);
    });

    if (!settings.captchaSolverEnabled) {
      return { success: false, error: 'CAPTCHA solving is disabled. Enable it in FSB settings (Advanced > CAPTCHA Solver).' };
    }
    if (!settings.captchaApiKey) {
      return { success: false, error: 'No 2Captcha API key configured. Add it in FSB settings (Advanced > CAPTCHA Solver).' };
    }

    let captchaType = null;
    let sitekey = null;

    // reCAPTCHA v2
    const recaptchaEl = document.querySelector('.g-recaptcha, [data-sitekey]');
    const recaptchaIframe = document.querySelector('iframe[src*="recaptcha"]');
    if (recaptchaEl) {
      captchaType = 'recaptcha';
      sitekey = recaptchaEl.getAttribute('data-sitekey');
    } else if (recaptchaIframe) {
      captchaType = 'recaptcha';
      try {
        const iframeSrc = new URL(recaptchaIframe.src);
        sitekey = iframeSrc.searchParams.get('k');
      } catch (e) { /* URL parse failed */ }
    }

    // hCaptcha
    if (!captchaType) {
      const hcaptchaEl = document.querySelector('.h-captcha, [data-hcaptcha-sitekey]');
      const hcaptchaIframe = document.querySelector('iframe[src*="hcaptcha"]');
      if (hcaptchaEl) {
        captchaType = 'hcaptcha';
        sitekey = hcaptchaEl.getAttribute('data-sitekey') || hcaptchaEl.getAttribute('data-hcaptcha-sitekey');
      } else if (hcaptchaIframe) {
        captchaType = 'hcaptcha';
        try {
          const iframeSrc = new URL(hcaptchaIframe.src);
          sitekey = iframeSrc.searchParams.get('sitekey');
        } catch (e) { /* URL parse failed */ }
      }
    }

    // Cloudflare Turnstile
    if (!captchaType) {
      const turnstileEl = document.querySelector('.cf-turnstile, [data-turnstile-sitekey]');
      const turnstileIframe = document.querySelector('iframe[src*="challenges.cloudflare.com"]');
      if (turnstileEl) {
        captchaType = 'turnstile';
        sitekey = turnstileEl.getAttribute('data-sitekey') || turnstileEl.getAttribute('data-turnstile-sitekey');
      } else if (turnstileIframe) {
        captchaType = 'turnstile';
        try {
          const iframeSrc = new URL(turnstileIframe.src);
          sitekey = iframeSrc.searchParams.get('k');
        } catch (e) { /* URL parse failed */ }
      }
    }

    if (!captchaType) {
      return { success: false, error: 'No supported CAPTCHA found on page (supports reCAPTCHA v2, hCaptcha, Turnstile).' };
    }
    if (!sitekey) {
      return { success: false, error: `Found ${captchaType} CAPTCHA but could not extract sitekey from the page.` };
    }

    try {
      const response = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({
          action: 'solveCaptcha',
          captchaType: captchaType,
          sitekey: sitekey,
          pageUrl: window.location.href,
          apiKey: settings.captchaApiKey
        }, (result) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(result);
          }
        });
      });

      if (!response || !response.success) {
        return { success: false, error: response?.error || 'CAPTCHA solve failed' };
      }

      const token = response.token;

      try {
        if (captchaType === 'recaptcha') {
          const textarea = document.querySelector('#g-recaptcha-response, textarea[name="g-recaptcha-response"]');
          if (textarea) {
            textarea.style.display = 'block';
            textarea.value = token;
            textarea.style.display = 'none';
          }
          const recaptchaWidget = document.querySelector('.g-recaptcha, [data-sitekey]');
          const callbackName = recaptchaWidget?.getAttribute('data-callback');
          if (callbackName && typeof window[callbackName] === 'function') {
            window[callbackName](token);
          } else if (typeof window.___grecaptcha_cfg !== 'undefined') {
            try {
              const clients = window.___grecaptcha_cfg?.clients;
              if (clients) {
                for (const clientKey of Object.keys(clients)) {
                  const client = clients[clientKey];
                  for (const key of Object.keys(client)) {
                    const obj = client[key];
                    if (obj && typeof obj === 'object') {
                      for (const innerKey of Object.keys(obj)) {
                        if (typeof obj[innerKey] === 'function') {
                          obj[innerKey](token);
                          break;
                        }
                      }
                    }
                  }
                }
              }
            } catch (e) { /* callback trigger failed, token still set */ }
          }
        } else if (captchaType === 'hcaptcha') {
          const textarea = document.querySelector('textarea[name="h-captcha-response"], textarea[name="g-recaptcha-response"]');
          if (textarea) {
            textarea.style.display = 'block';
            textarea.value = token;
            textarea.style.display = 'none';
          }
          const hcaptchaWidget = document.querySelector('.h-captcha, [data-hcaptcha-sitekey]');
          const callbackName = hcaptchaWidget?.getAttribute('data-callback');
          if (callbackName && typeof window[callbackName] === 'function') {
            window[callbackName](token);
          }
        } else if (captchaType === 'turnstile') {
          const input = document.querySelector('input[name="cf-turnstile-response"]');
          if (input) {
            input.value = token;
          }
          const turnstileWidget = document.querySelector('.cf-turnstile, [data-turnstile-sitekey]');
          const callbackName = turnstileWidget?.getAttribute('data-callback');
          if (callbackName && typeof window[callbackName] === 'function') {
            window[callbackName](token);
          }
        }

        return { success: true, captchaType: captchaType, message: `${captchaType} CAPTCHA solved and token injected` };
      } catch (injectError) {
        return {
          success: false,
          error: `Token injection failed: ${injectError.message}. Raw token available for manual use.`,
          token: token,
          captchaType: captchaType
        };
      }
    } catch (error) {
      return { success: false, error: `CAPTCHA solve request failed: ${error.message}` };
    }
  },

  // Navigate to a URL
  navigate: async (params) => {
    if (!params.url) {
      return { success: false, error: 'No URL provided' };
    }

    const preNavState = {
      url: window.location.href,
      timestamp: Date.now()
    };

    let targetUrl;
    try {
      const url = new URL(params.url);
      targetUrl = params.url;
    } catch (e) {
      if (!params.url.startsWith('http://') && !params.url.startsWith('https://')) {
        const urlWithProtocol = 'https://' + params.url;
        try {
          new URL(urlWithProtocol);
          targetUrl = urlWithProtocol;
        } catch (e2) {
          return { success: false, error: 'Invalid URL format' };
        }
      } else {
        return { success: false, error: 'Invalid URL format' };
      }
    }

    window.location.href = targetUrl;

    return {
      success: true,
      hadEffect: true,
      navigatingTo: targetUrl,
      fromUrl: preNavState.url,
      verification: {
        note: 'Navigation initiated - verification will occur after page load',
        expectedUrl: targetUrl
      }
    };
  },

  // Search Google for a website
  searchGoogle: (params) => {
    if (!params.query) {
      return { success: false, error: 'No search query provided' };
    }

    const encodedQuery = encodeURIComponent(params.query);
    const googleSearchUrl = `https://www.google.com/search?q=${encodedQuery}`;

    window.location.href = googleSearchUrl;
    return { success: true, searchingFor: params.query, url: googleSearchUrl };
  },

  // Wait for element to appear
  waitForElement: async (params) => {
    const { selector, timeout = 5000 } = params;
    const startTime = Date.now();

    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        const element = FSB.querySelectorWithShadow(selector);
        if (element || Date.now() - startTime > timeout) {
          clearInterval(checkInterval);
          resolve({
            success: !!element,
            found: !!element,
            selector,
            waitTime: Date.now() - startTime
          });
        }
      }, 100);
    });
  },

  // Verify if a message was successfully sent by checking DOM changes
  verifyMessageSent: async (params) => {
    const { timeout = 5000, messageText = '' } = params;
    const startTime = Date.now();

    try {
      const indicators = [
        () => {
          const messages = document.querySelectorAll([
            '[data-testid*="message"]', '.message', '.chat-message', '.msg-',
            '[aria-label*="message"]', '.conversation-message', '.dm-message',
            '.tweet-text', '.msg-form__sent-confirm', '.message-in', '.copyable-text'
          ].join(', '));

          if (messageText) {
            return Array.from(messages).some(msg =>
              msg.textContent?.includes(messageText.substring(0, 20))
            );
          } else {
            const currentCount = messages.length;
            const previousCount = window.fsb_lastMessageCount || 0;
            window.fsb_lastMessageCount = currentCount;
            return currentCount > previousCount;
          }
        },
        () => {
          const inputs = document.querySelectorAll([
            '[contenteditable="true"]', 'textarea', 'input[type="text"]',
            '.message-input', '.compose-input'
          ].join(', '));
          return Array.from(inputs).some(input => {
            const content = input.textContent || input.value || '';
            return content.trim() === '';
          });
        },
        () => {
          const confirmations = document.querySelectorAll([
            '.sent-confirmation', '.message-sent', '.delivery-confirmation',
            '[aria-label*="sent"]', '.success-indicator', '.checkmark'
          ].join(', '));
          return confirmations.length > 0 &&
                 Array.from(confirmations).some(el => el.offsetParent !== null);
        },
        () => {
          const sendButtons = document.querySelectorAll([
            '[aria-label*="send"]', 'button[type="submit"]',
            '.send-button', '.submit-button', '[data-testid*="send"]'
          ].join(', '));
          return Array.from(sendButtons).some(button =>
            button.disabled ||
            button.classList.contains('loading') ||
            button.classList.contains('sent') ||
            button.textContent?.toLowerCase().includes('sent')
          );
        }
      ];

      while (Date.now() - startTime < timeout) {
        for (let i = 0; i < indicators.length; i++) {
          try {
            if (indicators[i]()) {
              return {
                success: true,
                verified: true,
                method: `indicator_${i + 1}`,
                waitTime: Date.now() - startTime
              };
            }
          } catch (error) {
            // Ignore individual indicator errors
          }
        }
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      return {
        success: true,
        verified: false,
        waitTime: Date.now() - startTime,
        note: 'Could not verify message sending, but no errors occurred'
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        waitTime: Date.now() - startTime
      };
    }
  },
  waitForDOMStable: async (params) => {
    const { timeout = 5000, stableTime = 500 } = params;
    const startTime = Date.now();
    let lastChangeTime = Date.now();
    let changeCount = 0;
    let networkRequestCount = 0;

    const originalFetch = window.fetch;
    const originalXHROpen = XMLHttpRequest.prototype.open;

    window.fetch = function(...args) {
      networkRequestCount++;
      lastChangeTime = Date.now();
      return originalFetch.apply(this, args);
    };

    XMLHttpRequest.prototype.open = function(...args) {
      networkRequestCount++;
      lastChangeTime = Date.now();
      return originalXHROpen.apply(this, args);
    };

    return new Promise((resolve) => {
      const observer = new MutationObserver((mutations) => {
        const significantMutations = mutations.filter(mutation => {
          if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
            const target = mutation.target;
            if (target.classList && (
              target.classList.contains('loading') ||
              target.classList.contains('spinner') ||
              target.classList.contains('progress')
            )) {
              return false;
            }
          }
          return true;
        });

        if (significantMutations.length > 0) {
          changeCount += significantMutations.length;
          lastChangeTime = Date.now();
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeOldValue: false,
        characterData: true,
        attributeFilter: ['class', 'id', 'data-*', 'aria-*']
      });

      const checkInterval = setInterval(() => {
        const now = Date.now();
        const timeSinceLastChange = now - lastChangeTime;
        const totalTime = now - startTime;

        const isStable = timeSinceLastChange >= stableTime;
        const hasTimedOut = totalTime >= timeout;

        if (isStable || hasTimedOut) {
          clearInterval(checkInterval);
          observer.disconnect();

          window.fetch = originalFetch;
          XMLHttpRequest.prototype.open = originalXHROpen;

          const result = {
            success: true,
            stable: isStable,
            waitTime: totalTime,
            changeCount,
            networkRequestCount,
            reason: hasTimedOut ? 'timeout' : 'stable',
            stability: isStable ? 'good' : 'poor'
          };

          logger.logTiming(FSB.sessionId, 'WAIT', 'dom_stable', totalTime, { changes: changeCount });
          logger.logDOMOperation(FSB.sessionId, 'stability_check', result);
          resolve(result);
        }
      }, 50);

      setTimeout(() => {
        clearInterval(checkInterval);
        observer.disconnect();
        window.fetch = originalFetch;
        XMLHttpRequest.prototype.open = originalXHROpen;

        resolve({
          success: true,
          stable: false,
          waitTime: timeout,
          changeCount,
          networkRequestCount,
          reason: 'safety_timeout',
          stability: 'unknown'
        });
      }, timeout + 1000);
    });
  },

  // Detect loading indicators
  detectLoadingState: (params) => {
    const detectStart = Date.now();
    const loadingPatterns = [
      '.loading', '.loader', '.spinner', '.progress', '.loading-spinner',
      '.load-more', '.is-loading', '.in-progress', '.pending',
      'div[class*="loading"]', 'div[class*="loader"]', 'div[class*="spinner"]',
      'div[class*="progress"]', '[aria-busy="true"]',
      '.MuiCircularProgress-root', '.ant-spin', '.el-loading-mask',
      '[data-loading="true"]', '[data-state="loading"]'
    ];

    for (const pattern of loadingPatterns) {
      const elements = document.querySelectorAll(pattern);
      for (const element of elements) {
        const rect = element.getBoundingClientRect();
        const isVisible = rect.width > 0 && rect.height > 0 &&
                         window.getComputedStyle(element).display !== 'none' &&
                         window.getComputedStyle(element).visibility !== 'hidden';

        if (isVisible) {
          const result = {
            loading: true,
            indicator: pattern,
            element: {
              tag: element.tagName,
              class: FSB.getClassName(element),
              id: element.id
            }
          };
          logger.logTiming(FSB.sessionId, 'WAIT', 'loading_detect', Date.now() - detectStart, { loading: true, indicator: pattern });
          return result;
        }
      }
    }

    const loadingTexts = ['loading', 'please wait', 'processing', 'fetching', 'updating'];
    const textElements = document.querySelectorAll('*');

    for (const element of textElements) {
      const text = element.textContent?.toLowerCase() || '';
      if (loadingTexts.some(loadingText => text.includes(loadingText))) {
        const rect = element.getBoundingClientRect();
        const isVisible = rect.width > 0 && rect.height > 0;

        if (isVisible && element.children.length === 0) {
          const result = {
            loading: true,
            indicator: 'text',
            text: element.textContent?.trim().substring(0, 50)
          };
          logger.logTiming(FSB.sessionId, 'WAIT', 'loading_detect', Date.now() - detectStart, { loading: true, indicator: 'text' });
          return result;
        }
      }
    }

    logger.logTiming(FSB.sessionId, 'WAIT', 'loading_detect', Date.now() - detectStart, { loading: false });
    return { loading: false };
  },

  // Right click on element
  rightClick: async (params) => {
    const startTime = Date.now();
    let element = FSB.querySelectorWithShadow(params.selector);
    if (!element) {
      actionRecorder.record(null, 'rightClick', params, { selectorTried: params.selector, elementFound: false, success: false, error: 'Element not found', diagnostic: generateDiagnostic('elementNotFound', { selector: params.selector }), duration: Date.now() - startTime });
      return { success: false, error: 'Element not found', selector: params.selector };
    }

    const readiness = await FSB.smartEnsureReady(element, 'rightClick');
    if (!readiness.ready) {
      actionRecorder.record(null, 'rightClick', params, { selectorTried: params.selector, selectorUsed: params.selector, elementFound: true, elementDetails: captureElementDetails(element), success: false, error: `Element not ready for right click: ${readiness.failureReason}`, diagnostic: generateDiagnostic('notReady', { selector: params.selector, checks: readiness.checks }), duration: Date.now() - startTime });
      return { success: false, error: `Element not ready for right click: ${readiness.failureReason}`, selector: params.selector, checks: readiness.checks };
    }

    if (readiness.scrolled) {
      element = FSB.querySelectorWithShadow(params.selector);
      if (!element) {
        actionRecorder.record(null, 'rightClick', params, { selectorTried: params.selector, elementFound: false, success: false, error: 'Element became stale after scrolling', diagnostic: generateDiagnostic('elementNotFound', { selector: params.selector }), duration: Date.now() - startTime });
        return { success: false, error: 'Element became stale after scrolling', selector: params.selector };
      }
    }

    const rect = element.getBoundingClientRect();
    const event = new MouseEvent('contextmenu', {
      bubbles: true, cancelable: true, view: window,
      clientX: rect.left + rect.width / 2,
      clientY: rect.top + rect.height / 2
    });
    element.dispatchEvent(event);
    actionRecorder.record(null, 'rightClick', params, { selectorTried: params.selector, selectorUsed: params.selector, elementFound: true, elementDetails: captureElementDetails(element), coordinatesUsed: { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }, coordinateSource: 'element_center', success: true, hadEffect: true, duration: Date.now() - startTime });
    return { success: true, rightClicked: params.selector, scrolled: readiness.scrolled };
  },

  // Double click on element
  doubleClick: async (params) => {
    const startTime = Date.now();
    let element = FSB.querySelectorWithShadow(params.selector);
    if (!element) {
      actionRecorder.record(null, 'doubleClick', params, { selectorTried: params.selector, elementFound: false, success: false, error: 'Element not found', diagnostic: generateDiagnostic('elementNotFound', { selector: params.selector }), duration: Date.now() - startTime });
      return { success: false, error: 'Element not found', selector: params.selector };
    }

    const readiness = await FSB.smartEnsureReady(element, 'doubleClick');
    if (!readiness.ready) {
      actionRecorder.record(null, 'doubleClick', params, { selectorTried: params.selector, selectorUsed: params.selector, elementFound: true, elementDetails: captureElementDetails(element), success: false, error: `Element not ready for double click: ${readiness.failureReason}`, diagnostic: generateDiagnostic('notReady', { selector: params.selector, checks: readiness.checks }), duration: Date.now() - startTime });
      return { success: false, error: `Element not ready for double click: ${readiness.failureReason}`, selector: params.selector, checks: readiness.checks };
    }

    if (readiness.scrolled) {
      element = FSB.querySelectorWithShadow(params.selector);
      if (!element) {
        actionRecorder.record(null, 'doubleClick', params, { selectorTried: params.selector, elementFound: false, success: false, error: 'Element became stale after scrolling', diagnostic: generateDiagnostic('elementNotFound', { selector: params.selector }), duration: Date.now() - startTime });
        return { success: false, error: 'Element became stale after scrolling', selector: params.selector };
      }
    }

    const rect = element.getBoundingClientRect();
    const event = new MouseEvent('dblclick', {
      bubbles: true, cancelable: true, view: window,
      clientX: rect.left + rect.width / 2,
      clientY: rect.top + rect.height / 2
    });
    element.dispatchEvent(event);
    actionRecorder.record(null, 'doubleClick', params, { selectorTried: params.selector, selectorUsed: params.selector, elementFound: true, elementDetails: captureElementDetails(element), coordinatesUsed: { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }, coordinateSource: 'element_center', success: true, hadEffect: true, duration: Date.now() - startTime });
    return { success: true, doubleClicked: params.selector, scrolled: readiness.scrolled };
  },

  // Enhanced keyboard key press with Chrome Debugger API fallback
  keyPress: async (params) => {
    const { key, ctrlKey = false, shiftKey = false, altKey = false, metaKey = false, selector, useDebuggerAPI = true } = params;

    if (useDebuggerAPI) {
      try {
        const response = await chrome.runtime.sendMessage({
          action: 'keyboardDebuggerAction',
          method: 'pressKey',
          key: key,
          modifiers: { ctrl: ctrlKey, shift: shiftKey, alt: altKey, meta: metaKey }
        });

        if (response.success) {
          return { success: true, key, method: 'debuggerAPI', target: selector || 'activeElement', result: response.result };
        } else {
          logger.logRecovery(FSB.sessionId, 'debugger_api_failed', 'dom_events_fallback', 'started', { error: response.error });
        }
      } catch (error) {
        logger.logRecovery(FSB.sessionId, 'debugger_api_unavailable', 'dom_events_fallback', 'started', { error: error.message });
      }
    }

    const target = selector ? document.querySelector(selector) : document.activeElement;
    if (!target) {
      return { success: false, error: 'No target element' };
    }

    target.focus();

    const keyEvent = new KeyboardEvent('keydown', {
      key, code: key, ctrlKey, shiftKey, altKey, metaKey, bubbles: true, cancelable: true
    });
    target.dispatchEvent(keyEvent);

    const keyUpEvent = new KeyboardEvent('keyup', {
      key, code: key, ctrlKey, shiftKey, altKey, metaKey, bubbles: true, cancelable: true
    });
    target.dispatchEvent(keyUpEvent);

    return { success: true, key, method: 'domEvents', target: selector || 'activeElement', modifiers: { ctrlKey, shiftKey, altKey, metaKey } };
  },

  // Press a sequence of keys
  pressKeySequence: async (params) => {
    const { keys, modifiers = {}, delay = 50, useDebuggerAPI = true } = params;

    if (!Array.isArray(keys) || keys.length === 0) {
      return { success: false, error: 'Keys array is required' };
    }

    if (useDebuggerAPI) {
      try {
        const response = await chrome.runtime.sendMessage({
          action: 'keyboardDebuggerAction', method: 'pressKeySequence',
          keys: keys, modifiers: modifiers, delay: delay
        });

        if (response.success) {
          return { success: true, action: 'pressKeySequence', keys, modifiers, method: 'debuggerAPI', result: response.result };
        } else {
          logger.logRecovery(FSB.sessionId, 'debugger_api_key_sequence_failed', 'dom_events_fallback', 'started', { error: response.error });
        }
      } catch (error) {
        logger.logRecovery(FSB.sessionId, 'debugger_api_key_sequence_unavailable', 'dom_events_fallback', 'started', { error: error.message });
      }
    }

    const results = [];
    try {
      for (const key of keys) {
        const result = await tools.keyPress({
          key,
          ctrlKey: modifiers.ctrl || modifiers.control,
          shiftKey: modifiers.shift,
          altKey: modifiers.alt,
          metaKey: modifiers.meta || modifiers.cmd,
          useDebuggerAPI: false
        });
        results.push(result);
        if (!result.success) {
          return { success: false, error: `Failed at key: ${key}`, completedKeys: results.length - 1, results };
        }
        if (delay > 0 && keys.indexOf(key) < keys.length - 1) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
      return { success: true, action: 'pressKeySequence', keys, modifiers, method: 'domEvents', results };
    } catch (error) {
      return { success: false, error: error.message || 'Key sequence failed', keys, modifiers, results };
    }
  },

  // Type text using real keyboard events
  typeWithKeys: async (params) => {
    const { text, delay = 30, useDebuggerAPI = true, clearFirst = true } = params;

    if (!text || typeof text !== 'string') {
      return { success: false, error: 'Text parameter is required' };
    }

    if (useDebuggerAPI) {
      try {
        if (clearFirst) {
          try {
            await chrome.runtime.sendMessage({ action: 'keyboardDebuggerAction', method: 'pressKey', key: 'a', modifiers: { ctrl: true } });
            await new Promise(resolve => setTimeout(resolve, 30));
            await chrome.runtime.sendMessage({ action: 'keyboardDebuggerAction', method: 'pressKey', key: 'Backspace', modifiers: {} });
            await new Promise(resolve => setTimeout(resolve, 30));
          } catch (clearErr) { /* Non-fatal */ }
        }

        const response = await chrome.runtime.sendMessage({
          action: 'keyboardDebuggerAction', method: 'typeText', text: text, delay: delay
        });

        if (response.success) {
          return { success: true, action: 'typeWithKeys', text, method: 'debuggerAPI', characterCount: text.length, result: response.result };
        } else {
          logger.logRecovery(FSB.sessionId, 'debugger_api_text_failed', 'return_error', 'failed', { error: response.error });
          return { success: false, error: response.error || 'Keyboard debugger API failed', completedChars: response.result?.completedChars || 0, method: 'debugger-failed', text, action: 'typeWithKeys' };
        }
      } catch (error) {
        logger.logRecovery(FSB.sessionId, 'debugger_api_text_unavailable', 'return_error', 'failed', { error: error.message });
        return { success: false, error: error.message || 'Debugger API unavailable', method: 'debugger-exception', text, action: 'typeWithKeys' };
      }
    }

    // Fallback to DOM events
    const results = [];
    try {
      if (clearFirst) {
        const activeEl = document.activeElement;
        if (activeEl) {
          if (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA') {
            activeEl.value = '';
            activeEl.dispatchEvent(new Event('input', { bubbles: true }));
          } else if (activeEl.contentEditable === 'true') {
            document.execCommand('selectAll', false, null);
            document.execCommand('delete', false, null);
          }
        }
      }

      for (const char of text) {
        let key = char;
        let modifiers = {};

        if (char >= 'A' && char <= 'Z') {
          key = char.toLowerCase();
          modifiers.shift = true;
        }

        const shiftChars = {
          '!': '1', '@': '2', '#': '3', '$': '4', '%': '5',
          '^': '6', '&': '7', '*': '8', '(': '9', ')': '0',
          '_': '-', '+': '=', '{': '[', '}': ']', '|': '\\',
          ':': ';', '"': "'", '<': ',', '>': '.', '?': '/'
        };

        if (shiftChars[char]) {
          key = shiftChars[char];
          modifiers.shift = true;
        }

        const result = await tools.keyPress({ key, shiftKey: modifiers.shift, useDebuggerAPI: false });
        results.push({ char, key, modifiers, result });

        if (!result.success) {
          return { success: false, error: `Failed at character: ${char}`, completedChars: results.length - 1, results };
        }

        if (delay > 0 && text.indexOf(char) < text.length - 1) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }

      return { success: true, action: 'typeWithKeys', text, method: 'domEvents', characterCount: text.length, results };
    } catch (error) {
      return { success: false, error: error.message || 'Text typing failed', text, results };
    }
  },

  // Send special keys
  sendSpecialKey: async (params) => {
    const { specialKey, useDebuggerAPI = true } = params;

    if (!specialKey || typeof specialKey !== 'string') {
      return { success: false, error: 'SpecialKey parameter is required' };
    }

    if (useDebuggerAPI) {
      try {
        const response = await chrome.runtime.sendMessage({
          action: 'keyboardDebuggerAction', method: 'sendSpecialKey', specialKey: specialKey
        });
        if (response.success) {
          return { success: true, action: 'sendSpecialKey', specialKey, method: 'debuggerAPI', result: response.result };
        } else {
          logger.logRecovery(FSB.sessionId, 'debugger_api_special_key_failed', 'dom_events_fallback', 'started', { error: response.error });
        }
      } catch (error) {
        logger.logRecovery(FSB.sessionId, 'debugger_api_special_key_unavailable', 'dom_events_fallback', 'started', { error: error.message });
      }
    }

    try {
      const parts = specialKey.split('+').map(part => part.trim());
      const modifiers = {};
      let targetKey = parts[parts.length - 1];

      for (let i = 0; i < parts.length - 1; i++) {
        const modifier = parts[i].toLowerCase();
        if (modifier === 'ctrl' || modifier === 'control') modifiers.ctrlKey = true;
        else if (modifier === 'alt') modifiers.altKey = true;
        else if (modifier === 'shift') modifiers.shiftKey = true;
        else if (modifier === 'meta' || modifier === 'cmd' || modifier === 'command') modifiers.metaKey = true;
      }

      const result = await tools.keyPress({ key: targetKey, ...modifiers, useDebuggerAPI: false });
      return { success: result.success, action: 'sendSpecialKey', specialKey, method: 'domEvents', parsedKey: targetKey, parsedModifiers: modifiers, result };
    } catch (error) {
      return { success: false, error: error.message || 'Special key send failed', specialKey };
    }
  },

  // Select text in element
  selectText: (params) => {
    const element = FSB.querySelectorWithShadow(params.selector);
    if (element) {
      if (element.select) {
        element.select();
      } else if (window.getSelection) {
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(element);
        selection.removeAllRanges();
        selection.addRange(range);
      }
      return { success: true, selected: params.selector };
    }
    return { success: false, error: 'Element not found' };
  },

  // Focus on element with auto-wait
  focus: async (params) => {
    const startTime = Date.now();
    let element = FSB.querySelectorWithShadow(params.selector);
    if (!element) {
      actionRecorder.record(null, 'focus', params, { selectorTried: params.selector, elementFound: false, success: false, error: 'Element not found', diagnostic: generateDiagnostic('elementNotFound', { selector: params.selector }), duration: Date.now() - startTime });
      return { success: false, error: 'Element not found', selector: params.selector };
    }

    const readiness = await FSB.smartEnsureReady(element, 'focus');
    if (!readiness.ready) {
      actionRecorder.record(null, 'focus', params, { selectorTried: params.selector, selectorUsed: params.selector, elementFound: true, elementDetails: captureElementDetails(element), success: false, error: `Element not ready for focus: ${readiness.failureReason}`, diagnostic: generateDiagnostic('notReady', { selector: params.selector, checks: readiness.checks }), duration: Date.now() - startTime });
      return { success: false, error: `Element not ready for focus: ${readiness.failureReason}`, selector: params.selector, checks: readiness.checks };
    }

    if (readiness.scrolled) {
      element = FSB.querySelectorWithShadow(params.selector);
      if (!element) {
        actionRecorder.record(null, 'focus', params, { selectorTried: params.selector, elementFound: false, success: false, error: 'Element became stale after scrolling', diagnostic: generateDiagnostic('elementNotFound', { selector: params.selector }), duration: Date.now() - startTime });
        return { success: false, error: 'Element became stale after scrolling', selector: params.selector };
      }
    }

    element.focus();
    actionRecorder.record(null, 'focus', params, { selectorTried: params.selector, selectorUsed: params.selector, elementFound: true, elementDetails: captureElementDetails(element), success: true, hadEffect: true, duration: Date.now() - startTime });
    return { success: true, focused: params.selector, scrolled: readiness.scrolled };
  },

  // Blur (unfocus) element
  blur: (params) => {
    const startTime = Date.now();
    const element = FSB.querySelectorWithShadow(params.selector);
    if (element) {
      element.blur();
      actionRecorder.record(null, 'blur', params, { selectorTried: params.selector, selectorUsed: params.selector, elementFound: true, elementDetails: captureElementDetails(element), success: true, hadEffect: true, duration: Date.now() - startTime });
      return { success: true, blurred: params.selector };
    }
    actionRecorder.record(null, 'blur', params, { selectorTried: params.selector, elementFound: false, success: false, error: 'Element not found', diagnostic: generateDiagnostic('elementNotFound', { selector: params.selector }), duration: Date.now() - startTime });
    return { success: false, error: 'Element not found' };
  },

  // Hover over element
  hover: async (params) => {
    const startTime = Date.now();
    let element = FSB.querySelectorWithShadow(params.selector);
    if (!element) {
      actionRecorder.record(null, 'hover', params, { selectorTried: params.selector, elementFound: false, success: false, error: 'Element not found', diagnostic: generateDiagnostic('elementNotFound', { selector: params.selector }), duration: Date.now() - startTime });
      return { success: false, error: 'Element not found', selector: params.selector };
    }

    const readiness = await FSB.smartEnsureReady(element, 'hover');
    if (!readiness.ready) {
      actionRecorder.record(null, 'hover', params, { selectorTried: params.selector, selectorUsed: params.selector, elementFound: true, elementDetails: captureElementDetails(element), success: false, error: `Element not ready for hover: ${readiness.failureReason}`, diagnostic: generateDiagnostic('notReady', { selector: params.selector, checks: readiness.checks }), duration: Date.now() - startTime });
      return { success: false, error: `Element not ready for hover: ${readiness.failureReason}`, selector: params.selector, checks: readiness.checks };
    }

    if (readiness.scrolled) {
      element = FSB.querySelectorWithShadow(params.selector);
      if (!element) {
        actionRecorder.record(null, 'hover', params, { selectorTried: params.selector, elementFound: false, success: false, error: 'Element became stale after scrolling', diagnostic: generateDiagnostic('elementNotFound', { selector: params.selector }), duration: Date.now() - startTime });
        return { success: false, error: 'Element became stale after scrolling', selector: params.selector };
      }
    }

    const rect = element.getBoundingClientRect();
    element.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, cancelable: true, view: window, clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2 }));
    element.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true, cancelable: true, view: window, clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2 }));

    actionRecorder.record(null, 'hover', params, { selectorTried: params.selector, selectorUsed: params.selector, elementFound: true, elementDetails: captureElementDetails(element), success: true, hadEffect: true, duration: Date.now() - startTime });
    return { success: true, hovering: params.selector, scrolled: readiness.scrolled };
  },

  // Select dropdown option with verification
  selectOption: async (params) => {
    const startTime = Date.now();
    const selectors = params.selectors || [params.selector];
    let lastAttemptError = null;
    let lastVerification = null;

    for (let selectorIndex = 0; selectorIndex < selectors.length; selectorIndex++) {
      const currentSelector = selectors[selectorIndex];
      try {
        let element = FSB.querySelectorWithShadow(currentSelector);
        if (!element || element.tagName !== 'SELECT') { lastAttemptError = `Select element not found with selector: ${currentSelector}`; continue; }

        const readiness = await FSB.smartEnsureReady(element, 'selectOption');
        if (!readiness.ready) { lastAttemptError = `Element not ready: ${readiness.failureReason}`; continue; }
        if (readiness.scrolled) { element = FSB.querySelectorWithShadow(currentSelector); if (!element) { lastAttemptError = 'Element became stale after scrolling'; continue; } }

        const preState = captureActionState(element, 'selectOption');

        if (params.value !== undefined) { element.value = params.value; }
        else if (params.index !== undefined) { element.selectedIndex = params.index; }
        else if (params.text !== undefined) { const option = Array.from(element.options).find(opt => opt.text === params.text); if (option) { option.selected = true; } }

        element.dispatchEvent(new Event('change', { bubbles: true }));
        await waitForPageStability({ maxWait: 1000, stableTime: 200 });

        const postState = captureActionState(element, 'selectOption');
        const verification = verifyActionEffect(preState, postState, 'selectOption');
        lastVerification = verification;
        if (!verification.verified) { lastAttemptError = `Selection had no verified effect: ${verification.reason}`; continue; }

        actionRecorder.record(null, 'selectOption', params, { selectorTried: selectors[0], selectorUsed: currentSelector, elementFound: true, elementDetails: captureElementDetails(element), success: true, hadEffect: true, verification: verification, duration: Date.now() - startTime });
        return { success: true, selected: params.value || params.text || params.index, selector: currentSelector, selectorIndex, usedFallback: selectorIndex > 0, hadEffect: true, verification: { verified: verification.verified, reason: verification.reason, changes: verification.changes } };
      } catch (error) { lastAttemptError = error.message; }
    }

    actionRecorder.record(null, 'selectOption', params, { selectorTried: selectors[0], selectorUsed: null, elementFound: false, success: false, error: lastAttemptError || 'Selection had no effect with any available selector', diagnostic: generateDiagnostic('noEffect', { selector: selectors[0] }), duration: Date.now() - startTime });
    return { success: false, error: lastAttemptError || 'Selection had no effect with any available selector', hadEffect: false, selectorsTriad: selectors.length, lastVerification, suggestion: 'Option may not exist or select may be disabled' };
  },

  // Check/uncheck checkbox or radio with verification
  toggleCheckbox: async (params) => {
    const startTime = Date.now();
    const selectors = params.selectors || [params.selector];
    let lastAttemptError = null;
    let lastVerification = null;

    for (let selectorIndex = 0; selectorIndex < selectors.length; selectorIndex++) {
      const currentSelector = selectors[selectorIndex];
      try {
        let element = FSB.querySelectorWithShadow(currentSelector);
        if (!element || (element.type !== 'checkbox' && element.type !== 'radio')) { lastAttemptError = `Checkbox/radio element not found with selector: ${currentSelector}`; continue; }

        const readiness = await FSB.smartEnsureReady(element, 'toggleCheckbox');
        if (!readiness.ready) { lastAttemptError = `Element not ready: ${readiness.failureReason}`; continue; }
        if (readiness.scrolled) { element = FSB.querySelectorWithShadow(currentSelector); if (!element) { lastAttemptError = 'Element became stale after scrolling'; continue; } }

        const preState = captureActionState(element, 'toggleCheckbox');
        if (params.checked !== undefined) { element.checked = params.checked; } else { element.checked = !element.checked; }
        element.dispatchEvent(new Event('change', { bubbles: true }));
        await waitForPageStability({ maxWait: 1000, stableTime: 200 });

        const postState = captureActionState(element, 'toggleCheckbox');
        const verification = verifyActionEffect(preState, postState, 'toggleCheckbox');
        lastVerification = verification;
        if (!verification.verified) { lastAttemptError = `Toggle had no verified effect: ${verification.reason}`; continue; }

        actionRecorder.record(null, 'toggleCheckbox', params, { selectorTried: selectors[0], selectorUsed: currentSelector, elementFound: true, elementDetails: captureElementDetails(element), success: true, hadEffect: true, verification: verification, duration: Date.now() - startTime });
        return { success: true, checked: element.checked, selector: currentSelector, selectorIndex, usedFallback: selectorIndex > 0, hadEffect: true, verification: { verified: verification.verified, reason: verification.reason, changes: verification.changes } };
      } catch (error) { lastAttemptError = error.message; }
    }

    actionRecorder.record(null, 'toggleCheckbox', params, { selectorTried: selectors[0], selectorUsed: null, elementFound: false, success: false, error: lastAttemptError || 'Toggle had no effect with any available selector', diagnostic: generateDiagnostic('noEffect', { selector: selectors[0] }), duration: Date.now() - startTime });
    return { success: false, error: lastAttemptError || 'Toggle had no effect with any available selector', hadEffect: false, selectorsTriad: selectors.length, lastVerification, suggestion: 'Checkbox may be readonly or controlled by JavaScript' };
  },

  refresh: () => { window.location.reload(); return { success: true, action: 'page refresh initiated' }; },
  goBack: () => { window.history.back(); return { success: true, action: 'navigated back' }; },
  goForward: () => { window.history.forward(); return { success: true, action: 'navigated forward' }; },

  getText: (params) => {
    const element = FSB.querySelectorWithShadow(params.selector);
    if (element) {
      const textValue = element.innerText || element.textContent || element.value || '';
      return { success: true, text: textValue, value: textValue };
    }
    return { success: false, error: 'Element not found' };
  },

  readPage: (params) => {
    try {
      const fullMode = params.full === true;
      const selectorArg = params.selector || null;
      const root = selectorArg ? document.querySelector(selectorArg) : document.body;

      if (selectorArg && !root) {
        return { success: false, error: 'Selector not found: ' + selectorArg };
      }

      const text = FSB.extractPageText(root || document.body, {
        viewportOnly: !fullMode,
        format: 'markdown-lite'
      });

      if (!text || text.trim().length === 0) {
        return { success: true, text: '[No readable text content on page]', charCount: 0 };
      }
      return { success: true, text, charCount: text.length };
    } catch (err) {
      return { success: false, error: 'readPage failed: ' + err.message };
    }
  },

  getEditorContent: (params) => {
    const viewLines = document.querySelector('.view-lines');
    if (viewLines) { const lines = viewLines.querySelectorAll('.view-line'); const content = Array.from(lines).map(line => line.textContent).join('\n'); return { success: true, content, method: 'monacoViewLines', lineCount: lines.length }; }
    const editorSelector = params?.selector || '[role="textbox"]';
    const editor = document.querySelector(editorSelector);
    if (editor) { const content = editor.innerText || editor.textContent || ''; return { success: true, content, method: 'contenteditable', lineCount: content.split('\n').length }; }
    const cmContent = document.querySelector('.cm-content');
    if (cmContent) { const content = cmContent.innerText || cmContent.textContent || ''; return { success: true, content, method: 'codeMirror', lineCount: content.split('\n').length }; }
    const aceContent = document.querySelector('.ace_text-layer');
    if (aceContent) { const content = aceContent.innerText || aceContent.textContent || ''; return { success: true, content, method: 'aceEditor', lineCount: content.split('\n').length }; }
    const codeTextarea = document.querySelector('.monaco-editor textarea, .CodeMirror textarea, .ace_editor textarea');
    if (codeTextarea && codeTextarea.value) { return { success: true, content: codeTextarea.value, method: 'editorTextarea', lineCount: codeTextarea.value.split('\n').length }; }
    return { success: false, error: 'No code editor content found on page' };
  },

  getAttribute: (params) => {
    const element = FSB.querySelectorWithShadow(params.selector);
    if (element) { return { success: true, attribute: params.attribute, value: element.getAttribute(params.attribute) }; }
    return { success: false, error: 'Element not found' };
  },

  setAttribute: (params) => {
    const element = FSB.querySelectorWithShadow(params.selector);
    if (element) { element.setAttribute(params.attribute, params.value); return { success: true, attribute: params.attribute, value: params.value }; }
    return { success: false, error: 'Element not found' };
  },

  clearInput: (params) => {
    const startTime = Date.now();
    const element = FSB.querySelectorWithShadow(params.selector);
    if (element && (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA')) {
      element.value = '';
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
      actionRecorder.record(null, 'clearInput', params, { selectorTried: params.selector, selectorUsed: params.selector, elementFound: true, elementDetails: captureElementDetails(element), success: true, hadEffect: true, duration: Date.now() - startTime });
      return { success: true, cleared: params.selector };
    }
    actionRecorder.record(null, 'clearInput', params, { selectorTried: params.selector, elementFound: false, success: false, error: 'Input element not found', diagnostic: generateDiagnostic('elementNotFound', { selector: params.selector }), duration: Date.now() - startTime });
    return { success: false, error: 'Input element not found' };
  },

  // Multi-tab management tools
  openNewTab: async (params) => {
    const url = params.url || 'about:blank';
    try { const response = await chrome.runtime.sendMessage({ action: 'openNewTab', url: url, active: params.active !== false }); if (response.success) { return { success: true, tabId: response.tabId, url: url, active: params.active !== false }; } else { return { success: false, error: response.error || 'Failed to open new tab' }; } } catch (error) { return { success: false, error: `Failed to communicate with background script: ${error.message}` }; }
  },

  switchToTab: async (params) => {
    const tabId = params.tabId;
    if (!tabId) { return { success: false, error: 'Tab ID is required' }; }
    try { const response = await chrome.runtime.sendMessage({ action: 'switchToTab', tabId: tabId }); if (response.success) { return { success: true, tabId: tabId, previousTab: response.previousTab }; } else { return { success: false, error: response.error || 'Failed to switch to tab' }; } } catch (error) { return { success: false, error: `Failed to communicate with background script: ${error.message}` }; }
  },

  closeTab: async (params) => {
    const tabId = params.tabId;
    if (!tabId) { return { success: false, error: 'Tab ID is required' }; }
    try { const response = await chrome.runtime.sendMessage({ action: 'closeTab', tabId: tabId }); if (response.success) { return { success: true, tabId: tabId, closed: true }; } else { return { success: false, error: response.error || 'Failed to close tab' }; } } catch (error) { return { success: false, error: `Failed to communicate with background script: ${error.message}` }; }
  },

  listTabs: async (params) => {
    try { const response = await chrome.runtime.sendMessage({ action: 'listTabs', currentWindowOnly: params.currentWindowOnly !== false }); if (response.success) { return { success: true, tabs: response.tabs, currentTab: response.currentTab, totalTabs: response.tabs.length }; } else { return { success: false, error: response.error || 'Failed to list tabs' }; } } catch (error) { return { success: false, error: `Failed to communicate with background script: ${error.message}` }; }
  },

  getCurrentTab: async (params) => {
    try { const response = await chrome.runtime.sendMessage({ action: 'getCurrentTab' }); if (response.success) { return { success: true, tabId: response.tab.id, url: response.tab.url, title: response.tab.title, active: response.tab.active, tab: response.tab }; } else { return { success: false, error: response.error || 'Failed to get current tab info' }; } } catch (error) { return { success: false, error: `Failed to communicate with background script: ${error.message}` }; }
  },

  waitForTabLoad: async (params) => {
    const tabId = params.tabId;
    const timeout = params.timeout || 30000;
    if (!tabId) { return { success: false, error: 'Tab ID is required' }; }
    try { const response = await chrome.runtime.sendMessage({ action: 'waitForTabLoad', tabId: tabId, timeout: timeout }); if (response.success) { return { success: true, tabId: tabId, loaded: true, url: response.url, loadTime: response.loadTime }; } else { return { success: false, error: response.error || 'Tab failed to load within timeout' }; } } catch (error) { return { success: false, error: `Failed to communicate with background script: ${error.message}` }; }
  },

  // Game controls helper
  gameControl: async (params) => {
    const { action } = params;
    const gameKeyMap = { 'start': 'Enter', 'enter': 'Enter', 'up': 'ArrowUp', 'down': 'ArrowDown', 'left': 'ArrowLeft', 'right': 'ArrowRight', 'fire': ' ', 'shoot': ' ', 'jump': ' ', 'thrust': 'ArrowUp', 'hyperspace': 'Shift', 'pause': 'Escape' };
    const key = gameKeyMap[action.toLowerCase()] || action;
    const gameTargets = ['canvas', 'iframe[src*="game"]', 'div[id*="game"]', 'div[class*="game"]', 'body'];
    let targetElement = null;
    for (const selector of gameTargets) { targetElement = document.querySelector(selector); if (targetElement) break; }
    if (targetElement && targetElement !== document.body) { targetElement.focus(); await new Promise(resolve => setTimeout(resolve, 50)); }
    const result = await tools.keyPress({ key: key, useDebuggerAPI: true });
    return { success: result.success, action: action, key: key, targetElement: targetElement ? targetElement.tagName : 'body', gameControlUsed: true, result: result };
  },

  arrowUp: async (params = {}) => { return await tools.keyPress({ key: 'ArrowUp', useDebuggerAPI: true, ...params }); },
  arrowDown: async (params = {}) => { return await tools.keyPress({ key: 'ArrowDown', useDebuggerAPI: true, ...params }); },
  arrowLeft: async (params = {}) => { return await tools.keyPress({ key: 'ArrowLeft', useDebuggerAPI: true, ...params }); },
  arrowRight: async (params = {}) => { return await tools.keyPress({ key: 'ArrowRight', useDebuggerAPI: true, ...params }); }
};

  // =========================================================================
  // NAMESPACE EXPORTS
  // =========================================================================
  FSB.validateCoordinates = validateCoordinates;
  FSB.ensureCoordinatesVisible = ensureCoordinatesVisible;
  FSB.clickAtCoordinates = clickAtCoordinates;
  FSB.captureActionState = captureActionState;
  FSB.EXPECTED_EFFECTS = EXPECTED_EFFECTS;
  FSB.detectChanges = detectChanges;
  FSB.verifyActionEffect = verifyActionEffect;
  FSB.DIAGNOSTIC_MESSAGES = DIAGNOSTIC_MESSAGES;
  FSB.generateDiagnostic = generateDiagnostic;
  FSB.captureElementDetails = captureElementDetails;
  FSB.ActionRecorder = ActionRecorder;
  FSB.actionRecorder = actionRecorder;
  FSB.detectActionOutcome = detectActionOutcome;
  FSB.waitForPageStability = waitForPageStability;
  FSB.tools = tools;

  window.FSB._modules['actions'] = { loaded: true, timestamp: Date.now() };
})();
