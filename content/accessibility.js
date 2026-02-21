// =============================================================================
// ACCESSIBILITY TREE FUNCTIONS & ELEMENT READINESS CHECKS
// =============================================================================
// Extracted from content.js lines 3335-4576
// Depends on: init.js (FSB namespace, logger), utils.js (isFsbElement, stripUnicodeControl),
//             selectors.js (querySelectorWithShadow)

(function() {
  if (window.__FSB_SKIP_INIT__) return;
  const FSB = window.FSB;
  const logger = FSB.logger;

  // =============================================================================
  // ACCESSIBILITY TREE FUNCTIONS (Playwright MCP-inspired)
  // =============================================================================

  /**
   * Get the implicit ARIA role for an input element based on type
   * @param {HTMLInputElement} input - The input element
   * @returns {string|null} The implicit ARIA role
   */
  function getInputRole(input) {
    const typeRoles = {
      'button': 'button',
      'checkbox': 'checkbox',
      'email': 'textbox',
      'image': 'button',
      'number': 'spinbutton',
      'radio': 'radio',
      'range': 'slider',
      'reset': 'button',
      'search': 'searchbox',
      'submit': 'button',
      'tel': 'textbox',
      'text': 'textbox',
      'url': 'textbox',
      'password': 'textbox',
      'date': 'textbox',
      'datetime-local': 'textbox',
      'month': 'textbox',
      'week': 'textbox',
      'time': 'textbox',
      'file': 'button',
      'color': 'button'
    };
    return typeRoles[input.type] || 'textbox';
  }

  /**
   * Get the implicit ARIA role for semantic HTML elements
   * Based on WAI-ARIA specification
   * @param {Element} node - The DOM element
   * @returns {string|null} The implicit or explicit ARIA role
   */
  function getImplicitRole(node) {
    // Explicit role overrides implicit
    const explicitRole = node.getAttribute('role');
    if (explicitRole) return explicitRole;

    const tagRoles = {
      'A': node.href ? 'link' : null,
      'ARTICLE': 'article',
      'ASIDE': 'complementary',
      'BUTTON': 'button',
      'DATALIST': 'listbox',
      'DETAILS': 'group',
      'DIALOG': 'dialog',
      'FIELDSET': 'group',
      'FIGURE': 'figure',
      'FOOTER': 'contentinfo',
      'FORM': 'form',
      'H1': 'heading', 'H2': 'heading', 'H3': 'heading',
      'H4': 'heading', 'H5': 'heading', 'H6': 'heading',
      'HEADER': 'banner',
      'HR': 'separator',
      'IMG': node.alt ? 'img' : 'presentation',
      'INPUT': getInputRole(node),
      'LI': 'listitem',
      'MAIN': 'main',
      'MENU': 'menu',
      'NAV': 'navigation',
      'OL': 'list',
      'OPTGROUP': 'group',
      'OPTION': 'option',
      'OUTPUT': 'status',
      'PROGRESS': 'progressbar',
      'SECTION': node.getAttribute('aria-label') || node.getAttribute('aria-labelledby') ? 'region' : null,
      'SELECT': node.multiple ? 'listbox' : 'combobox',
      'SUMMARY': 'button',
      'TABLE': 'table',
      'TBODY': 'rowgroup', 'THEAD': 'rowgroup', 'TFOOT': 'rowgroup',
      'TD': 'cell',
      'TEXTAREA': 'textbox',
      'TH': 'columnheader',
      'TR': 'row',
      'UL': 'list'
    };

    return tagRoles[node.tagName] || null;
  }

  /**
   * Compute accessible name following ARIA specification algorithm
   * Priority: aria-labelledby > aria-label > native label > contents > title/placeholder
   * @param {Element} node - The DOM element
   * @returns {Object} { name: string, source: string }
   */
  function computeAccessibleName(node) {
    // 1. aria-labelledby (highest priority)
    const labelledBy = node.getAttribute('aria-labelledby');
    if (labelledBy) {
      const names = labelledBy.split(/\s+/)
        .map(id => document.getElementById(id)?.textContent?.trim())
        .filter(Boolean);
      if (names.length > 0) return { name: names.join(' '), source: 'aria-labelledby' };
    }

    // 2. aria-label (strip invisible Unicode control chars for clean AI output)
    const ariaLabel = node.getAttribute('aria-label');
    if (ariaLabel) return { name: FSB.stripUnicodeControl(ariaLabel), source: 'aria-label' };

    // 3. Native label association (for form controls)
    if (node.id) {
      const label = document.querySelector(`label[for="${node.id}"]`);
      if (label) return { name: label.textContent?.trim(), source: 'label-for' };
    }

    // Implicit label (wrapped in label element)
    const parentLabel = node.closest('label');
    if (parentLabel && parentLabel !== node) {
      const labelText = parentLabel.textContent?.trim();
      if (labelText) return { name: labelText, source: 'label-wrap' };
    }

    // 4. Text content (for buttons, links, etc.)
    const role = getImplicitRole(node);
    if (['button', 'link', 'menuitem', 'option', 'tab', 'treeitem'].includes(role)) {
      const text = node.textContent?.trim();
      if (text) return { name: text.substring(0, 200), source: 'contents' };
    }

    // 5. Special cases
    if (node.tagName === 'IMG') {
      if (node.alt) return { name: node.alt, source: 'alt' };
    }
    if (node.tagName === 'INPUT' || node.tagName === 'TEXTAREA') {
      if (node.placeholder) return { name: node.placeholder, source: 'placeholder' };
    }

    // 6. title attribute (lowest priority)
    const title = node.getAttribute('title');
    if (title) return { name: title, source: 'title' };

    return { name: '', source: 'none' };
  }

  /**
   * Extract ARIA relationships for an element
   * These help AI understand compound widgets and element associations
   * @param {Element} node - The DOM element
   * @returns {Object|null} Relationship mappings or null if none
   */
  function getARIARelationships(node) {
    const relationships = {};

    // aria-controls: elements this element controls
    const controls = node.getAttribute('aria-controls');
    if (controls) {
      relationships.controls = controls.split(/\s+/).filter(id => document.getElementById(id));
    }

    // aria-owns: elements logically owned by this element
    const owns = node.getAttribute('aria-owns');
    if (owns) {
      relationships.owns = owns.split(/\s+/).filter(id => document.getElementById(id));
    }

    // aria-describedby: elements that describe this element
    const describedBy = node.getAttribute('aria-describedby');
    if (describedBy) {
      const descriptions = describedBy.split(/\s+/)
        .map(id => document.getElementById(id)?.textContent?.trim())
        .filter(Boolean);
      if (descriptions.length > 0) {
        relationships.describedBy = descriptions.join(' ').substring(0, 200);
      }
    }

    // aria-activedescendant: currently active descendant
    const activeDesc = node.getAttribute('aria-activedescendant');
    if (activeDesc && document.getElementById(activeDesc)) {
      relationships.activeDescendant = activeDesc;
    }

    // aria-flowto: next element in reading order
    const flowTo = node.getAttribute('aria-flowto');
    if (flowTo) {
      relationships.flowTo = flowTo.split(/\s+/).filter(id => document.getElementById(id));
    }

    // Clean up empty arrays
    Object.keys(relationships).forEach(key => {
      if (Array.isArray(relationships[key]) && relationships[key].length === 0) {
        delete relationships[key];
      }
    });

    return Object.keys(relationships).length > 0 ? relationships : null;
  }

  /**
   * Check if element is truly actionable (can be clicked/typed/focused)
   * More comprehensive than simple visibility check
   * @param {Element} node - The DOM element
   * @returns {Object} { actionable: boolean, reasons: string[], focusable: boolean, obscuredBy?: string }
   */
  function isElementActionable(node) {
    const result = {
      actionable: true,
      reasons: []
    };

    // 1. Check display/visibility
    const style = window.getComputedStyle(node);
    if (style.display === 'none') {
      result.actionable = false;
      result.reasons.push('display:none');
    }
    if (style.visibility === 'hidden') {
      result.actionable = false;
      result.reasons.push('visibility:hidden');
    }
    if (parseFloat(style.opacity) === 0) {
      result.actionable = false;
      result.reasons.push('opacity:0');
    }

    // 2. Check pointer-events
    if (style.pointerEvents === 'none') {
      result.actionable = false;
      result.reasons.push('pointer-events:none');
    }

    // 3. Check disabled state (element and ancestors)
    if (node.disabled) {
      result.actionable = false;
      result.reasons.push('disabled');
    }
    if (node.getAttribute('aria-disabled') === 'true') {
      result.actionable = false;
      result.reasons.push('aria-disabled');
    }

    // Check parent fieldset disabled
    const fieldset = node.closest('fieldset');
    if (fieldset?.disabled && !node.closest('legend')) {
      result.actionable = false;
      result.reasons.push('fieldset-disabled');
    }

    // 4. Check if obscured by another element
    const rect = node.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      // Only check if center point is in viewport
      if (centerX >= 0 && centerX <= window.innerWidth &&
          centerY >= 0 && centerY <= window.innerHeight) {
        const topElement = document.elementFromPoint(centerX, centerY);
        if (topElement && topElement !== node && !node.contains(topElement) && !topElement.contains(node)) {
          // Ignore FSB's own overlay elements (including shadow DOM children)
          if (!FSB.isFsbElement(topElement)) {
            result.actionable = false;
            result.reasons.push('obscured');
            result.obscuredBy = topElement.tagName.toLowerCase() +
              (topElement.id ? `#${topElement.id}` : '') +
              (topElement.className && typeof topElement.className === 'string'
                ? `.${topElement.className.split(' ')[0]}`
                : '');
          }
        }
      }
    }

    // 5. Check if zero dimensions
    if (rect.width === 0 && rect.height === 0) {
      result.actionable = false;
      result.reasons.push('zero-size');
    }

    // 6. Check keyboard accessibility (for focus operations)
    const tabindex = node.getAttribute('tabindex');
    const isNativelyFocusable = ['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'].includes(node.tagName);
    result.focusable = isNativelyFocusable || (tabindex !== null && tabindex !== '-1');

    return result;
  }

  // =============================================================================
  // ELEMENT READINESS CHECK FUNCTIONS (Playwright-style actionability validation)
  // =============================================================================

  /**
   * Check if element is visible (not hidden by CSS or zero dimensions)
   * @param {Element} element - The DOM element to check
   * @returns {Object} { passed: boolean, reason: string|null, details: object }
   */
  function checkElementVisibility(element) {
    // Check element exists
    if (!element) {
      return {
        passed: false,
        reason: 'Element is null or undefined',
        details: { elementExists: false }
      };
    }

    // Check bounding box has non-zero dimensions
    const rect = element.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      // Contenteditable elements and role="textbox" can be interactable
      // even with zero bounding rect (e.g., Gmail compose body when empty)
      const isEditable = element.contentEditable === 'true' ||
                         element.hasAttribute('contenteditable') ||
                         element.getAttribute('role') === 'textbox';
      if (isEditable) {
        const style = window.getComputedStyle(element);
        const isCSSVisible = style.display !== 'none' &&
                             style.visibility !== 'hidden' &&
                             parseFloat(style.opacity) > 0;
        if (isCSSVisible) {
          // Allow through -- element is editable and CSS-visible despite zero rect
          logger.debug('Zero-dim editable element bypassed visibility check', {
            tag: element.tagName,
            role: element.getAttribute('role'),
            contentEditable: element.contentEditable,
            rect: { width: rect.width, height: rect.height, top: rect.top, left: rect.left }
          });
        } else {
          return {
            passed: false,
            reason: 'Element has zero dimensions',
            details: {
              rect: { width: rect.width, height: rect.height, top: rect.top, left: rect.left },
              editableBypass: 'failed-css-hidden'
            }
          };
        }
      } else {
        return {
          passed: false,
          reason: 'Element has zero dimensions',
          details: {
            rect: { width: rect.width, height: rect.height, top: rect.top, left: rect.left }
          }
        };
      }
    }

    // Use modern checkVisibility API if available
    if (typeof element.checkVisibility === 'function') {
      const isVisible = element.checkVisibility({ opacityProperty: true, visibilityProperty: true });
      if (!isVisible) {
        // Fallback to get specific reason via computed style
        const style = window.getComputedStyle(element);
        return {
          passed: false,
          reason: 'Element not visible (checkVisibility returned false)',
          details: {
            rect: { width: rect.width, height: rect.height, top: rect.top, left: rect.left },
            display: style.display,
            visibility: style.visibility,
            opacity: style.opacity
          }
        };
      }
    } else {
      // Fallback to getComputedStyle checks
      const style = window.getComputedStyle(element);

      if (style.display === 'none') {
        return {
          passed: false,
          reason: 'Element has display:none',
          details: {
            rect: { width: rect.width, height: rect.height, top: rect.top, left: rect.left },
            display: style.display
          }
        };
      }

      if (style.visibility === 'hidden') {
        return {
          passed: false,
          reason: 'Element has visibility:hidden',
          details: {
            rect: { width: rect.width, height: rect.height, top: rect.top, left: rect.left },
            visibility: style.visibility
          }
        };
      }

      if (parseFloat(style.opacity) === 0) {
        return {
          passed: false,
          reason: 'Element has opacity:0',
          details: {
            rect: { width: rect.width, height: rect.height, top: rect.top, left: rect.left },
            opacity: style.opacity
          }
        };
      }
    }

    return {
      passed: true,
      reason: null,
      details: {
        rect: { width: rect.width, height: rect.height, top: rect.top, left: rect.left }
      }
    };
  }

  /**
   * Check if element is enabled (not disabled by various mechanisms)
   * @param {Element} element - The DOM element to check
   * @returns {Object} { passed: boolean, reason: string|null, details: object }
   */
  function checkElementEnabled(element) {
    const details = {};

    // Check native disabled (catches fieldset-disabled too via :disabled pseudo-class)
    try {
      if (element.matches(':disabled')) {
        details.nativeDisabled = true;
        return {
          passed: false,
          reason: 'Element is disabled (native :disabled)',
          details
        };
      }
      details.nativeDisabled = false;
    } catch (e) {
      // :disabled not applicable to this element type
      details.nativeDisabled = false;
    }

    // Check aria-disabled on element
    if (element.getAttribute('aria-disabled') === 'true') {
      details.ariaDisabled = true;
      return {
        passed: false,
        reason: 'Element has aria-disabled="true"',
        details
      };
    }
    details.ariaDisabled = false;

    // Check ancestor aria-disabled
    const disabledAncestor = element.closest('[aria-disabled="true"]');
    if (disabledAncestor && disabledAncestor !== element) {
      details.ancestorAriaDisabled = true;
      return {
        passed: false,
        reason: 'Ancestor has aria-disabled="true"',
        details
      };
    }
    details.ancestorAriaDisabled = false;

    // Check inert (element is inert or inside inert container)
    try {
      if (element.matches('[inert], [inert] *')) {
        details.inert = true;
        return {
          passed: false,
          reason: 'Element is inert or inside inert container',
          details
        };
      }
      details.inert = false;
    } catch (e) {
      details.inert = false;
    }

    return {
      passed: true,
      reason: null,
      details
    };
  }

  /**
   * Check if element position is stable (not animating)
   * @param {Element} element - The DOM element to check
   * @param {number} maxWaitMs - Maximum time to wait for stability (default 300ms)
   * @returns {Promise<Object>} { passed: boolean, reason: string|null, details: object }
   */
  async function checkElementStable(element, maxWaitMs = 300) {
    const startTime = Date.now();
    const TOLERANCE = 1; // 1px tolerance for position comparison

    // Get initial position
    const getPosition = () => {
      const rect = element.getBoundingClientRect();
      return { top: rect.top, left: rect.left, width: rect.width, height: rect.height };
    };

    const initialPosition = getPosition();

    // Check position after one frame
    const checkAfterFrame = () => {
      return new Promise(resolve => {
        requestAnimationFrame(() => {
          const newPosition = getPosition();
          const delta = {
            top: Math.abs(newPosition.top - initialPosition.top),
            left: Math.abs(newPosition.left - initialPosition.left),
            width: Math.abs(newPosition.width - initialPosition.width),
            height: Math.abs(newPosition.height - initialPosition.height)
          };

          const isStable = delta.top <= TOLERANCE &&
                           delta.left <= TOLERANCE &&
                           delta.width <= TOLERANCE &&
                           delta.height <= TOLERANCE;

          resolve({ isStable, newPosition, delta });
        });
      });
    };

    // First check
    let result = await checkAfterFrame();

    if (result.isStable) {
      return {
        passed: true,
        reason: null,
        details: {
          position: initialPosition,
          checkTime: Date.now() - startTime
        }
      };
    }

    // Element is moving - wait for stability up to maxWaitMs
    while (Date.now() - startTime < maxWaitMs) {
      await new Promise(r => setTimeout(r, 50)); // Check every 50ms

      const prevPosition = result.newPosition;
      result = await checkAfterFrame();

      // Check against previous position, not initial
      const delta = {
        top: Math.abs(result.newPosition.top - prevPosition.top),
        left: Math.abs(result.newPosition.left - prevPosition.left),
        width: Math.abs(result.newPosition.width - prevPosition.width),
        height: Math.abs(result.newPosition.height - prevPosition.height)
      };

      const nowStable = delta.top <= TOLERANCE &&
                        delta.left <= TOLERANCE &&
                        delta.width <= TOLERANCE &&
                        delta.height <= TOLERANCE;

      if (nowStable) {
        return {
          passed: true,
          reason: null,
          details: {
            position: result.newPosition,
            checkTime: Date.now() - startTime
          }
        };
      }
    }

    // Timed out waiting for stability
    return {
      passed: false,
      reason: 'Element position is unstable (animating)',
      details: {
        position: result.newPosition,
        delta: result.delta,
        checkTime: Date.now() - startTime
      }
    };
  }

  /**
   * Detect if an element is inside a code editor (Monaco, CodeMirror, ACE, etc.)
   * Uses DOM ancestry inspection -- no site-specific logic.
   * @param {Element} element - The DOM element to check
   * @returns {Object} { isCodeEditor: boolean, type: string|null, container: Element|null }
   */
  function detectCodeEditor(element) {
    const editorPatterns = [
      { selector: '.monaco-editor', type: 'monaco' },
      { selector: '.CodeMirror', type: 'codemirror' },
      { selector: '.cm-editor', type: 'codemirror6' },
      { selector: '.ace_editor', type: 'ace' },
      { selector: '[data-mode-id]', type: 'monaco' },
      { selector: '.code-editor', type: 'generic' },
    ];

    for (const { selector, type } of editorPatterns) {
      const container = element.closest(selector);
      if (container) {
        return { isCodeEditor: true, type, container };
      }
    }

    // Broader check: walk up to 10 ancestors looking for editor-like class names
    let parent = element.parentElement;
    for (let depth = 0; parent && depth < 10; depth++) {
      if (parent.classList) {
        const hasEditorClass = Array.from(parent.classList).some(c =>
          /monaco|codemirror|ace[_-]editor|code[_-]?editor/i.test(c)
        );
        if (hasEditorClass) {
          return { isCodeEditor: true, type: 'unknown', container: parent };
        }
      }
      parent = parent.parentElement;
    }

    return { isCodeEditor: false, type: null, container: null };
  }

  /**
   * Check if element can receive pointer events (not obscured by other elements)
   * Uses multi-point hit testing for more reliable detection
   * @param {Element} element - The DOM element to check
   * @returns {Object} { passed: boolean, reason: string|null, details: object, obscuredBy?: string }
   */
  function checkElementReceivesEvents(element) {
    let rect = element.getBoundingClientRect();

    // Helper to calculate 5 check points from a rect
    const getCheckPoints = (r) => [
      { name: 'center', x: r.left + r.width / 2, y: r.top + r.height / 2 },
      { name: 'topLeft', x: r.left + r.width * 0.25, y: r.top + r.height * 0.25 },
      { name: 'topRight', x: r.left + r.width * 0.75, y: r.top + r.height * 0.25 },
      { name: 'bottomLeft', x: r.left + r.width * 0.25, y: r.top + r.height * 0.75 },
      { name: 'bottomRight', x: r.left + r.width * 0.75, y: r.top + r.height * 0.75 }
    ];

    let points = getCheckPoints(rect);

    // Filter to points within viewport
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let pointsInViewport = points.filter(p =>
      p.x >= 0 && p.x <= viewportWidth && p.y >= 0 && p.y <= viewportHeight
    );

    if (pointsInViewport.length === 0) {
      // Attempt to scroll element into view before giving up
      try {
        element.scrollIntoView({ behavior: 'instant', block: 'center' });
        // Re-check after scroll
        const newRect = element.getBoundingClientRect();
        const newPoints = getCheckPoints(newRect).filter(p =>
          p.x >= 0 && p.x <= viewportWidth && p.y >= 0 && p.y <= viewportHeight
        );
        if (newPoints.length > 0) {
          // Element is now in viewport after scroll -- update and continue with checks
          rect = newRect;
          points = getCheckPoints(newRect);
          pointsInViewport = newPoints;
        } else {
          return {
            passed: false,
            reason: 'Element is outside viewport (even after scroll attempt)',
            details: {
              checkedPoints: 0,
              passedPoints: 0,
              rect: { top: newRect.top, left: newRect.left, width: newRect.width, height: newRect.height }
            }
          };
        }
      } catch (e) {
        return {
          passed: false,
          reason: 'Element is outside viewport',
          details: {
            checkedPoints: 0,
            passedPoints: 0,
            rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height }
          }
        };
      }
    }

    // Check each point
    const checkedPoints = [];
    const passedPoints = [];
    let obscuredBy = null;

    for (const point of pointsInViewport) {
      const hitElement = document.elementFromPoint(point.x, point.y);
      checkedPoints.push(point.name);

      // Check if hit element is the target, or they have a parent/child relationship
      const hitIsTarget = hitElement === element;
      const targetContainsHit = hitElement && element.contains(hitElement);
      const hitContainsTarget = hitElement && hitElement.contains(element);

      if (hitIsTarget || targetContainsHit || hitContainsTarget) {
        passedPoints.push(point.name);
      } else if (FSB.isFsbElement(hitElement)) {
        // FSB's own overlay (including shadow DOM children) -- ignore, treat target as accessible
        passedPoints.push(point.name);
      } else if (!obscuredBy && hitElement) {
        // Record what's obscuring (only first one)
        obscuredBy = hitElement.tagName.toLowerCase() +
          (hitElement.id ? `#${hitElement.id}` : '') +
          (hitElement.className && typeof hitElement.className === 'string'
            ? `.${hitElement.className.split(' ')[0]}`
            : '');
      }
    }

    // Require center point to pass (if it was checked), or at least 1 point if center not in viewport
    const centerChecked = checkedPoints.includes('center');
    const centerPassed = passedPoints.includes('center');

    const passed = centerChecked ? centerPassed : passedPoints.length > 0;

    const result = {
      passed,
      reason: passed ? null : `Element is obscured at ${centerChecked ? 'center' : 'all visible points'}`,
      details: {
        checkedPoints: checkedPoints.length,
        passedPoints: passedPoints.length,
        checkedPointNames: checkedPoints,
        passedPointNames: passedPoints
      }
    };

    if (obscuredBy) {
      result.obscuredBy = obscuredBy;
    }

    return result;
  }

  /**
   * Check if element is editable (for input operations)
   * @param {Element} element - The DOM element to check
   * @returns {Object} { passed: boolean, reason: string|null, details: object }
   */
  function checkElementEditable(element) {
    const details = {};

    // Check disabled
    try {
      if (element.matches(':disabled')) {
        details.disabled = true;
        return {
          passed: false,
          reason: 'Element is disabled',
          details
        };
      }
      details.disabled = false;
    } catch (e) {
      details.disabled = false;
    }

    // Check readonly property
    if (element.readOnly) {
      details.readonly = true;
      return {
        passed: false,
        reason: 'Element is readonly',
        details
      };
    }
    details.readonly = false;

    // Check aria-readonly
    if (element.getAttribute('aria-readonly') === 'true') {
      details.ariaReadonly = true;
      return {
        passed: false,
        reason: 'Element has aria-readonly="true"',
        details
      };
    }
    details.ariaReadonly = false;

    // Check contenteditable="false" for contenteditable elements
    const contentEditable = element.getAttribute('contenteditable');
    if (contentEditable !== null) {
      details.contenteditable = contentEditable;
      if (contentEditable === 'false') {
        return {
          passed: false,
          reason: 'Element has contenteditable="false"',
          details
        };
      }
    }

    return {
      passed: true,
      reason: null,
      details
    };
  }

  /**
   * Scroll element into view only if needed (not fully visible or center not visible)
   * @param {Element} element - The DOM element to scroll into view
   * @returns {Promise<Object>} { scrolled: boolean, details: object }
   */
  async function scrollIntoViewIfNeeded(element) {
    const rect = element.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Check if element is fully visible in viewport
    const wasFullyVisible = rect.top >= 0 &&
                            rect.left >= 0 &&
                            rect.bottom <= viewportHeight &&
                            rect.right <= viewportWidth;

    // Check if center is visible (even if edges are clipped)
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const wasCenterVisible = centerX >= 0 &&
                             centerX <= viewportWidth &&
                             centerY >= 0 &&
                             centerY <= viewportHeight;

    const initialRect = {
      top: rect.top,
      left: rect.left,
      bottom: rect.bottom,
      right: rect.right,
      width: rect.width,
      height: rect.height
    };

    // If fully visible and center is visible, no need to scroll
    if (wasFullyVisible && wasCenterVisible) {
      return {
        scrolled: false,
        details: {
          initialRect,
          wasFullyVisible,
          wasCenterVisible
        }
      };
    }

    // Need to scroll - use smooth scroll to center
    element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });

    // Wait for scroll animation (300ms)
    await new Promise(r => setTimeout(r, 300));

    // Get final rect
    const finalRectRaw = element.getBoundingClientRect();
    const finalRect = {
      top: finalRectRaw.top,
      left: finalRectRaw.left,
      bottom: finalRectRaw.bottom,
      right: finalRectRaw.right,
      width: finalRectRaw.width,
      height: finalRectRaw.height
    };

    return {
      scrolled: true,
      details: {
        initialRect,
        finalRect,
        wasFullyVisible,
        wasCenterVisible
      }
    };
  }

  /**
   * Perform quick readiness check for fast-path detection
   * SPEED-05: Skip full readiness checks when element is obviously ready
   * @param {Element} element - The DOM element to check
   * @returns {Object} Quick check result with definitelyReady/definitelyNotReady flags
   */
  function performQuickReadinessCheck(element) {
    const checks = {
      hasSize: false,
      notDisabled: false,
      visible: false,
      receivesEvents: false,
      inViewport: false
    };

    // Early return for null/undefined element
    if (!element) {
      return {
        definitelyReady: false,
        definitelyNotReady: true,
        concern: 'no-element',
        checks
      };
    }

    // Get bounding rect for size and viewport checks
    const rect = element.getBoundingClientRect();

    // Check 1: Has size (width > 0 AND height > 0)
    checks.hasSize = rect.width > 0 && rect.height > 0;

    // Check 2: Not disabled
    checks.notDisabled = !element.disabled && element.getAttribute('aria-disabled') !== 'true';

    // Check 3: Visible (computed style)
    const style = getComputedStyle(element);
    checks.visible = style.display !== 'none' &&
                     style.visibility !== 'hidden' &&
                     parseFloat(style.opacity) > 0;

    // Check 4: In viewport
    checks.inViewport = rect.top >= 0 &&
                        rect.bottom <= window.innerHeight &&
                        rect.left >= 0 &&
                        rect.right <= window.innerWidth;

    // Check 5: Receives events (element at center point)
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const elementAtPoint = document.elementFromPoint(centerX, centerY);
    checks.receivesEvents = elementAtPoint === element || element.contains(elementAtPoint);

    // Determine overall status
    const basicChecksPass = checks.hasSize && checks.notDisabled && checks.visible;
    const definitelyNotReady = !checks.hasSize || !checks.notDisabled || !checks.visible;
    const definitelyReady = basicChecksPass && checks.inViewport && checks.receivesEvents;

    // Determine concern if not definitely ready
    let concern = null;
    if (!definitelyReady && !definitelyNotReady) {
      if (!checks.inViewport) concern = 'scroll';
      else if (!checks.receivesEvents) concern = 'obscured';
    }

    return {
      definitelyReady,
      definitelyNotReady,
      concern,
      checks
    };
  }

  /**
   * Smart element readiness wrapper that uses fast-path when possible
   * SPEED-05: Bypass full ensureElementReady when quick check passes
   * @param {Element} element - The DOM element to check
   * @param {string} actionType - Type of action to perform (default 'click')
   * @returns {Promise<Object>} Readiness result object
   */
  async function smartEnsureReady(element, actionType = 'click') {
    // Perform quick readiness check
    const quickCheck = performQuickReadinessCheck(element);

    // Fast path: element is definitely ready, skip full checks
    if (quickCheck.definitelyReady) {
      return {
        ready: true,
        element: element,
        scrolled: false,
        fastPath: true,
        checks: quickCheck.checks
      };
    }

    // Slow path: element has concerns or is definitely not ready
    // Fall through to full ensureElementReady
    return ensureElementReady(element, actionType);
  }

  /**
   * Orchestrator function to ensure element is ready for interaction
   * Calls all readiness checks in correct order and returns unified result
   * @param {Element} element - The DOM element to check
   * @param {string} actionType - Type of action to perform (default 'click')
   * @returns {Promise<Object>} Unified readiness result object
   */
  async function ensureElementReady(element, actionType = 'click') {
    const inputActions = ['type', 'fill', 'clear', 'clearInput', 'selectText'];
    const result = {
      ready: true,
      element: element,
      scrolled: false,
      checks: {},
      failureReason: null,
      failureDetails: null
    };

    // 1. Check visibility - fail fast if not visible
    const visibleCheck = checkElementVisibility(element);
    result.checks.visible = visibleCheck;
    if (!visibleCheck.passed) {
      result.ready = false;
      result.failureReason = visibleCheck.reason;
      result.failureDetails = visibleCheck.details;
      return result;
    }

    // 1b. Post-render delay for zero-dim editable elements
    // If the element passed visibility via the contenteditable bypass (zero rect but CSS-visible),
    // wait briefly for it to finish rendering, then re-check dimensions
    const elRect = element.getBoundingClientRect();
    if ((elRect.width === 0 || elRect.height === 0) &&
        (element.contentEditable === 'true' || element.hasAttribute('contenteditable') ||
         element.getAttribute('role') === 'textbox')) {
      logger.debug('Zero-dim editable passed visibility, waiting 200ms for render');
      await new Promise(resolve => setTimeout(resolve, 200));
      const updatedRect = element.getBoundingClientRect();
      if (updatedRect.width > 0 && updatedRect.height > 0) {
        logger.debug('Editable element gained dimensions after render wait', {
          width: updatedRect.width, height: updatedRect.height
        });
      }
      // Proceed regardless -- the contenteditable bypass already approved this element
    }

    // 2. Check enabled - fail fast if disabled
    const enabledCheck = checkElementEnabled(element);
    result.checks.enabled = enabledCheck;
    if (!enabledCheck.passed) {
      result.ready = false;
      result.failureReason = enabledCheck.reason;
      result.failureDetails = enabledCheck.details;
      return result;
    }

    // 3. Scroll into view if needed
    const scrollResult = await scrollIntoViewIfNeeded(element);
    result.scrolled = scrollResult.scrolled;

    // 4. Check stability - wait for animations
    const editorInfo = detectCodeEditor(element);
    const stabilityTimeout = editorInfo.isCodeEditor ? 1500 : 300;
    if (editorInfo.isCodeEditor) {
      logger.debug('Code editor detected, using extended stability timeout', {
        type: editorInfo.type,
        timeout: stabilityTimeout
      });
    }
    const stableCheck = await checkElementStable(element, stabilityTimeout);
    result.checks.stable = stableCheck;
    if (!stableCheck.passed) {
      result.ready = false;
      result.failureReason = stableCheck.reason;
      result.failureDetails = stableCheck.details;
      return result;
    }

    // 5. Check receives events - not obscured
    const eventsCheck = checkElementReceivesEvents(element);
    result.checks.receivesEvents = eventsCheck;
    if (!eventsCheck.passed) {
      result.ready = false;
      result.failureReason = eventsCheck.reason;
      result.failureDetails = eventsCheck.details;
      if (eventsCheck.obscuredBy) {
        result.failureDetails.obscuredBy = eventsCheck.obscuredBy;
      }
      return result;
    }

    // 6. Check editable - only for input actions
    if (inputActions.includes(actionType)) {
      const editableCheck = checkElementEditable(element);
      result.checks.editable = editableCheck;
      if (!editableCheck.passed) {
        result.ready = false;
        result.failureReason = editableCheck.reason;
        result.failureDetails = editableCheck.details;
        return result;
      }
    }

    return result;
  }

  /**
   * Smart wait for element to be actionable using DOM mutation detection
   * NO hardcoded timeouts - uses actual DOM signals for fail-fast behavior
   * NOTE: This is dead code per Phase 5 plans, but kept for now.
   * @param {string} selector - CSS selector for the element
   * @param {Object} options - Wait options
   * @param {number} options.maxWait - Safety cap for maximum wait time (default 10000)
   * @param {string[]} options.waitFor - Conditions to wait for (default ['visible', 'enabled', 'stable'])
   * @returns {Promise<Object>} { success: boolean, element?: Element, waitTime: number, reason?: string, domStableFor?: number }
   */
  async function waitForActionable(selector, options = {}) {
    const {
      maxWait = 10000,  // Safety cap only, not expected to hit this
      timeout = maxWait, // Support legacy callers using 'timeout'
      waitFor = ['visible', 'enabled', 'stable']
    } = options;

    const effectiveMaxWait = Math.min(maxWait, timeout);
    const startTime = Date.now();
    let lastReason = '';
    let domStableSince = null;
    let lastMutationTime = Date.now();
    const STABLE_THRESHOLD = 300; // DOM stable if no changes for 300ms

    // Set up MutationObserver to track DOM changes
    const mutationDetected = { value: false };
    const observer = new MutationObserver(() => {
      mutationDetected.value = true;
      lastMutationTime = Date.now();
      domStableSince = null; // Reset stability
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style', 'disabled', 'aria-disabled', 'hidden', 'aria-hidden']
    });

    try {
      while (Date.now() - startTime < effectiveMaxWait) {
        const element = FSB.querySelectorWithShadow(selector);
        const now = Date.now();
        const timeSinceLastMutation = now - lastMutationTime;

        // Track DOM stability
        if (timeSinceLastMutation >= STABLE_THRESHOLD) {
          if (!domStableSince) domStableSince = now;
        } else {
          domStableSince = null;
        }

        // Check for loading indicators (only call if tools is defined)
        let isPageLoading = false;
        if (typeof FSB.tools !== 'undefined' && FSB.tools && FSB.tools.detectLoadingState) {
          const loadingState = FSB.tools.detectLoadingState({});
          isPageLoading = loadingState.loading;
        }

        if (!element) {
          // SMART FAIL-FAST: If DOM is stable AND no loading indicators, element won't appear
          const domStableFor = domStableSince ? (now - domStableSince) : 0;

          if (!isPageLoading && domStableFor > 500) {
            // DOM has been stable for 500ms with no loading - fail fast
            return {
              success: false,
              reason: 'Element not found (DOM stable)',
              waitTime: now - startTime,
              domStableFor
            };
          }

          lastReason = 'Element not found';
          mutationDetected.value = false;
          await new Promise(r => setTimeout(r, 50));
          continue;
        }

        // Element exists - check actionability
        const actionability = isElementActionable(element);
        let ready = true;

        if (waitFor.includes('visible') && !actionability.actionable) {
          ready = false;
          lastReason = actionability.reasons.join(', ') || 'Not visible';

          // AUTO-RECOVERY: If element is obscured, try Escape key to dismiss popups
          if (actionability.reasons.includes('obscured')) {
            try {
              // Dispatch Escape key to document to dismiss popups/modals
              document.dispatchEvent(new KeyboardEvent('keydown', {
                key: 'Escape',
                code: 'Escape',
                keyCode: 27,
                which: 27,
                bubbles: true,
                cancelable: true
              }));
              document.dispatchEvent(new KeyboardEvent('keyup', {
                key: 'Escape',
                code: 'Escape',
                keyCode: 27,
                which: 27,
                bubbles: true,
                cancelable: true
              }));
              // Wait for any overlay dismissal animation
              await new Promise(r => setTimeout(r, 300));
              // Don't set ready=true yet - let the next loop iteration re-check
            } catch (e) {
              // Ignore escape key errors
            }
          }
        }

        if (waitFor.includes('enabled')) {
          if (element.disabled || element.getAttribute('aria-disabled') === 'true') {
            ready = false;
            lastReason = 'Element is disabled';
          }
        }

        if (waitFor.includes('stable') && ready) {
          // Check position stability (element not animating)
          const rect1 = element.getBoundingClientRect();
          await new Promise(r => setTimeout(r, 50));
          const rect2 = element.getBoundingClientRect();

          const isAnimating = Math.abs(rect1.left - rect2.left) > 1 ||
                             Math.abs(rect1.top - rect2.top) > 1 ||
                             Math.abs(rect1.width - rect2.width) > 1 ||
                             Math.abs(rect1.height - rect2.height) > 1;

          if (isAnimating) {
            ready = false;
            lastReason = 'Element is animating';
          }
        }

        if (ready) {
          return {
            success: true,
            element,
            waitTime: Date.now() - startTime
          };
        }

        // Element exists but not ready - wait for next DOM change or short interval
        mutationDetected.value = false;
        await new Promise(r => setTimeout(r, 50));
      }

      return { success: false, reason: lastReason || 'Max wait exceeded', waitTime: effectiveMaxWait };
    } finally {
      observer.disconnect();
    }
  }

  // =============================================================================
  // Attach all exports to FSB namespace
  // =============================================================================

  // ARIA / Accessibility functions
  FSB.getInputRole = getInputRole;
  FSB.getImplicitRole = getImplicitRole;
  FSB.computeAccessibleName = computeAccessibleName;
  FSB.getARIARelationships = getARIARelationships;
  FSB.isElementActionable = isElementActionable;

  // Element readiness check functions
  FSB.checkElementVisibility = checkElementVisibility;
  FSB.checkElementEnabled = checkElementEnabled;
  FSB.checkElementStable = checkElementStable;
  FSB.detectCodeEditor = detectCodeEditor;
  FSB.checkElementReceivesEvents = checkElementReceivesEvents;
  FSB.checkElementEditable = checkElementEditable;
  FSB.scrollIntoViewIfNeeded = scrollIntoViewIfNeeded;
  FSB.performQuickReadinessCheck = performQuickReadinessCheck;
  FSB.smartEnsureReady = smartEnsureReady;
  FSB.ensureElementReady = ensureElementReady;

  // Dead code kept for now (Phase 5 will evaluate)
  FSB.waitForActionable = waitForActionable;

})();
