// Content script for FSB v0.1
// Handles DOM reading and action execution

// DOM State Manager class definition (inline for content script)
class DOMStateManager {
  constructor() {
    // Previous DOM state for comparison
    this.previousState = null;
    
    // Cache of elements by their hash
    this.elementCache = new Map();
    
    // Track mutations in real-time
    this.mutationObserver = null;
    this.pendingMutations = [];
    
    // Changed elements since last snapshot
    this.changedElements = new Set();
    
    // Configuration
    this.config = {
      maxUnchangedElements: 50, // Max unchanged elements to include
      importantSelectors: [
        'button', 'a[href]', 'input', 'textarea', 'select',
        '[role="button"]', '[onclick]', 'form', '[data-testid]'
      ],
      textTruncateLength: 100,
      enableMutationTracking: true
    };
  }
  
  /**
   * Initialize MutationObserver to track real-time DOM changes
   */
  initMutationObserver() {
    if (!this.config.enableMutationTracking) return;
    
    this.mutationObserver = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        this.recordMutation(mutation);
      });
    });
    
    // Observe entire document with specific config
    this.mutationObserver.observe(document.body, {
      childList: true,
      attributes: true,
      attributeOldValue: true,
      characterData: true,
      characterDataOldValue: true,
      subtree: true
    });
  }
  
  /**
   * Record a DOM mutation for later processing
   */
  recordMutation(mutation) {
    this.pendingMutations.push({
      type: mutation.type,
      target: mutation.target,
      addedNodes: Array.from(mutation.addedNodes),
      removedNodes: Array.from(mutation.removedNodes),
      attributeName: mutation.attributeName,
      oldValue: mutation.oldValue
    });
  }
  
  /**
   * Generate a unique hash for element identification
   */
  hashElement(element) {
    // Create hash from stable element properties
    const text = element.text ? element.text.substring(0, 20) : '';
    const hashStr = `${element.type}|${element.id || ''}|${element.class || ''}|${text}|${element.position?.x || 0},${element.position?.y || 0}`;
    
    // Simple string hash that handles Unicode
    let hash = 0;
    for (let i = 0; i < hashStr.length; i++) {
      const char = hashStr.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    // Convert to base36 for shorter string and ensure positive
    return 'h' + Math.abs(hash).toString(36);
  }
  
  /**
   * Check if an element is important and should be included even if unchanged
   */
  isImportantElement(element) {
    // Interactive elements are always important
    if (element.isButton || element.isInput || element.isLink) return true;
    
    // Elements in viewport are important
    if (element.position?.inViewport) return true;
    
    // Elements with specific attributes
    if (element.attributes?.['data-testid'] || element.attributes?.['aria-label']) return true;
    
    // Form elements
    if (element.formId) return true;
    
    return false;
  }
  
  /**
   * Check if an element has changed between states
   */
  hasElementChanged(current, previous) {
    // Check text changes
    if (current.text !== previous.text) return true;
    
    // Check position changes (significant moves only)
    const posChange = Math.abs((current.position?.x || 0) - (previous.position?.x || 0)) > 10 ||
                     Math.abs((current.position?.y || 0) - (previous.position?.y || 0)) > 10;
    if (posChange) return true;
    
    // Check visibility changes
    if (current.visibility?.display !== previous.visibility?.display) return true;
    
    // Check interaction state changes
    if (JSON.stringify(current.interactionState) !== JSON.stringify(previous.interactionState)) return true;
    
    // Check attribute changes
    if (JSON.stringify(current.attributes) !== JSON.stringify(previous.attributes)) return true;
    
    return false;
  }
  
  /**
   * Compute diff between current and previous DOM states
   */
  computeDiff(currentDOM) {
    const diff = {
      added: [],
      removed: [],
      modified: [],
      unchanged: [],
      metadata: {
        totalElements: currentDOM.elements?.length || 0,
        previousElements: this.previousState?.elements?.length || 0,
        changeRatio: 0
      }
    };
    
    // First time - return full DOM
    if (!this.previousState) {
      this.updateState(currentDOM);
      return {
        ...diff,
        added: currentDOM.elements || [],
        isInitial: true
      };
    }
    
    // Create current element map
    const currentElementMap = new Map();
    (currentDOM.elements || []).forEach(element => {
      const hash = this.hashElement(element);
      currentElementMap.set(hash, element);
    });
    
    // Find added and modified elements
    currentElementMap.forEach((element, hash) => {
      const previousElement = this.elementCache.get(hash);
      
      if (!previousElement) {
        diff.added.push(element);
      } else if (this.hasElementChanged(element, previousElement)) {
        diff.modified.push({
          ...element,
          _changes: this.getElementChanges(element, previousElement)
        });
      } else if (this.isImportantElement(element)) {
        // Include important unchanged elements (limited number)
        if (diff.unchanged.length < this.config.maxUnchangedElements) {
          diff.unchanged.push(element);
        }
      }
    });
    
    // Find removed elements
    this.elementCache.forEach((element, hash) => {
      if (!currentElementMap.has(hash)) {
        diff.removed.push({
          ...element,
          _wasAt: { x: element.position?.x, y: element.position?.y }
        });
      }
    });
    
    // Calculate change metrics
    const totalChanges = diff.added.length + diff.removed.length + diff.modified.length;
    diff.metadata.changeRatio = totalChanges / Math.max(diff.metadata.totalElements, 1);
    diff.metadata.addedCount = diff.added.length;
    diff.metadata.removedCount = diff.removed.length;
    diff.metadata.modifiedCount = diff.modified.length;
    
    // Update state for next comparison
    this.updateState(currentDOM);
    
    return diff;
  }
  
  /**
   * Get specific changes between two element states
   */
  getElementChanges(current, previous) {
    const changes = {};
    
    if (current.text !== previous.text) {
      changes.text = { old: previous.text, new: current.text };
    }
    
    if (current.position?.x !== previous.position?.x || current.position?.y !== previous.position?.y) {
      changes.position = {
        old: { x: previous.position?.x, y: previous.position?.y },
        new: { x: current.position?.x, y: current.position?.y }
      };
    }
    
    if (JSON.stringify(current.attributes) !== JSON.stringify(previous.attributes)) {
      changes.attributes = {
        old: previous.attributes,
        new: current.attributes
      };
    }
    
    return changes;
  }
  
  /**
   * Update internal state with new DOM snapshot
   */
  updateState(currentDOM) {
    this.previousState = currentDOM;
    
    // Update element cache
    this.elementCache.clear();
    (currentDOM.elements || []).forEach(element => {
      const hash = this.hashElement(element);
      this.elementCache.set(hash, element);
    });
    
    // Clear pending mutations
    this.pendingMutations = [];
    this.changedElements.clear();
  }
  
  /**
   * Generate optimized DOM payload for AI
   */
  generateOptimizedPayload(currentDOM) {
    console.log('[FSB DOMStateManager] Computing DOM diff...');
    const diff = this.computeDiff(currentDOM);
    
    // Log diff statistics
    console.log('[FSB DOMStateManager] Diff computed:', {
      isInitial: diff.isInitial || false,
      added: diff.added.length,
      removed: diff.removed.length,
      modified: diff.modified.length,
      unchanged: diff.unchanged.length,
      changeRatio: (diff.metadata.changeRatio * 100).toFixed(1) + '%'
    });
    
    // For initial load, return filtered full DOM
    if (diff.isInitial) {
      console.log('[FSB DOMStateManager] Initial DOM capture - sending full filtered DOM');
      const payload = {
        type: 'initial',
        elements: this.filterAndCompressElements(diff.added),
        htmlContext: this.compressHTMLContext(currentDOM.htmlContext),
        metadata: {
          totalElements: diff.metadata.totalElements,
          includedElements: diff.added.length
        }
      };
      console.log('[FSB DOMStateManager] Initial payload elements:', payload.elements.length);
      return payload;
    }
    
    // For updates, return only changes
    console.log('[FSB DOMStateManager] Creating delta payload...');
    
    const payload = {
      type: 'delta',
      changes: {
        added: this.filterAndCompressElements(diff.added),
        removed: diff.removed.map(el => ({
          elementId: el.elementId,
          selector: el.selectors?.[0],
          _wasAt: el._wasAt
        })),
        modified: this.filterAndCompressElements(diff.modified)
      },
      context: {
        unchanged: this.filterAndCompressElements(diff.unchanged, true), // Heavy compression
        metadata: diff.metadata
      }
    };
    
    // Include updated HTML context only if significant changes
    if (diff.metadata.changeRatio > 0.3) {
      console.log('[FSB DOMStateManager] Including HTML context due to significant changes (>', (diff.metadata.changeRatio * 100).toFixed(1) + '%)');
      payload.htmlContext = this.compressHTMLContext(currentDOM.htmlContext);
    }
    
    // Log delta details
    console.log('[FSB DOMStateManager] Delta payload created:', {
      addedElements: payload.changes.added.length,
      removedElements: payload.changes.removed.length,
      modifiedElements: payload.changes.modified.length,
      unchangedReferences: payload.context.unchanged.length,
      hasHtmlContext: !!payload.htmlContext
    });
    
    return payload;
  }
  
  /**
   * Filter and compress elements for smaller payload
   */
  filterAndCompressElements(elements, heavyCompression = false) {
    return elements.map(el => {
      const compressed = {
        elementId: el.elementId,
        type: el.type,
        selectors: el.selectors?.slice(0, 2) // Limit selectors
      };
      
      // Add essential properties
      if (el.text) {
        compressed.text = el.text.substring(0, heavyCompression ? 50 : this.config.textTruncateLength);
      }
      
      if (!heavyCompression) {
        // Include more details for changed elements
        if (el.id) compressed.id = el.id;
        if (el.class) compressed.class = el.class.split(' ').slice(0, 3).join(' ');
        if (el.position?.inViewport) compressed.inViewport = true;
        if (el.attributes?.['data-testid']) compressed.testId = el.attributes['data-testid'];
        if (el._changes) compressed._changes = el._changes;
        
        // Include interaction properties
        if (el.isButton || el.isInput || el.isLink) {
          compressed.interactive = true;
          if (el.href) compressed.href = el.href;
          if (el.inputType) compressed.inputType = el.inputType;
        }
      }
      
      return compressed;
    });
  }
  
  /**
   * Compress HTML context for smaller payload
   */
  compressHTMLContext(htmlContext) {
    if (!htmlContext) return null;
    
    const compressed = {};
    
    if (htmlContext.pageStructure) {
      compressed.page = {
        title: htmlContext.pageStructure.title,
        url: htmlContext.pageStructure.url
      };
      
      // Include only form structure
      if (htmlContext.pageStructure.forms?.length > 0) {
        compressed.forms = htmlContext.pageStructure.forms.map(form => ({
          id: form.id,
          fields: form.fields?.length || 0
        }));
      }
    }
    
    return compressed;
  }
  
  /**
   * Reset state (useful for navigation)
   */
  reset() {
    this.previousState = null;
    this.elementCache.clear();
    this.pendingMutations = [];
    this.changedElements.clear();
    
    if (this.mutationObserver) {
      this.mutationObserver.disconnect();
    }
  }
  
  /**
   * Cleanup resources
   */
  destroy() {
    this.reset();
    this.mutationObserver = null;
  }
}

// Initialize DOM state manager instance
const domStateManager = new DOMStateManager();

// Legacy DOM state cache for backward compatibility
let previousDOMState = null;
let domStateCache = new Map();

/**
 * Enhanced universal message input detection for all platforms
 * @param {Element} element - The element to check
 * @returns {boolean} True if element is likely a message input
 */
function isUniversalMessageInput(element) {
  // Get all relevant attributes for pattern matching
  const className = (element.className || '').toLowerCase();
  const id = (element.id || '').toLowerCase();
  const ariaLabel = (element.getAttribute('aria-label') || '').toLowerCase();
  const placeholder = (element.getAttribute('placeholder') || '').toLowerCase();
  const dataTestId = (element.getAttribute('data-testid') || '').toLowerCase();
  const dataTestid = (element.getAttribute('data-testid') || '').toLowerCase(); // Alternative casing
  const role = (element.getAttribute('role') || '').toLowerCase();
  const name = (element.getAttribute('name') || '').toLowerCase();
  const parentClass = (element.parentElement?.className || '').toLowerCase();
  const grandParentClass = (element.parentElement?.parentElement?.className || '').toLowerCase();
  
  // Universal messaging keywords
  const messagingKeywords = [
    'message', 'msg', 'chat', 'compose', 'write', 'text', 'comment', 'reply',
    'post', 'tweet', 'status', 'update', 'note', 'memo', 'send', 'typing',
    'input', 'editor', 'content', 'body', 'description', 'caption'
  ];
  
  // Platform-specific patterns (comprehensive)
  const platformPatterns = {
    // LinkedIn
    linkedin: ['msg-form__contenteditable', 'msg-form__placeholder', 'compose-publisher', 'ql-editor'],
    // Twitter/X
    twitter: ['tweet-box', 'rich-editor', 'notranslate', 'draftjs-editor', 'tweet-compose'],
    // Facebook/Meta
    facebook: ['notranslate', '_1mf', 'composerInput', 'UFIAddCommentInput', '_5rpu'],
    // WhatsApp Web
    whatsapp: ['selectable-text', 'copyable-text', '_3FRCZ', '_1awRl'],
    // Discord
    discord: ['textArea-', 'slateTextArea-', 'markup-', 'editor-'],
    // Slack
    slack: ['ql-editor', 'msg_input', 'p-message_input'],
    // Telegram Web
    telegram: ['input-message-input', 'composer_rich_textarea'],
    // Generic messaging
    generic: ['input-field', 'text-input', 'message-input', 'chat-input', 'compose-input']
  };
  
  // Check for contenteditable div (common in modern messaging)
  if (element.contentEditable === 'true' || element.hasAttribute('contenteditable')) {
    // Additional checks for contenteditable elements
    const allText = [className, id, ariaLabel, placeholder, dataTestId, parentClass, grandParentClass].join(' ');
    
    // Check for messaging keywords in any attribute
    if (messagingKeywords.some(keyword => allText.includes(keyword))) {
      return true;
    }
    
    // Check for platform-specific patterns
    for (const [platform, patterns] of Object.entries(platformPatterns)) {
      if (patterns.some(pattern => allText.includes(pattern))) {
        return true;
      }
    }
  }
  
  // Check role and ARIA attributes
  if (role === 'textbox' || role === 'combobox') {
    return true;
  }
  
  // Check for messaging-related aria-labels
  const messagingAriaPatterns = [
    'message', 'compose', 'write', 'chat', 'comment', 'reply', 'post', 'tweet',
    'happening', 'mind', 'think', 'share', 'status', 'update', 'note'
  ];
  
  if (messagingAriaPatterns.some(pattern => ariaLabel.includes(pattern))) {
    return true;
  }
  
  // Check placeholder text
  const messagingPlaceholders = [
    'message', 'type', 'write', 'compose', 'chat', 'comment', 'reply', 'post',
    'happening', 'mind', 'think', 'share', 'status', 'say', 'tell'
  ];
  
  if (messagingPlaceholders.some(pattern => placeholder.includes(pattern))) {
    return true;
  }
  
  // Check data-testid attributes
  const testIdPatterns = [
    'message', 'compose', 'chat', 'input', 'editor', 'text', 'comment', 'reply',
    'post', 'tweet', 'status', 'dm-', 'msg-', 'chat-'
  ];
  
  if (testIdPatterns.some(pattern => dataTestId.includes(pattern) || dataTestid.includes(pattern))) {
    return true;
  }
  
  // Check class names for messaging patterns
  const classPatterns = [
    'message', 'msg', 'chat', 'compose', 'editor', 'input', 'text', 'comment',
    'reply', 'post', 'tweet', 'status', 'contenteditable', 'rich-text', 'wysiwyg'
  ];
  
  if (classPatterns.some(pattern => className.includes(pattern))) {
    return true;
  }
  
  // Check name attribute
  const namePatterns = [
    'message', 'msg', 'text', 'comment', 'content', 'body', 'description', 'caption'
  ];
  
  if (namePatterns.some(pattern => name.includes(pattern))) {
    return true;
  }
  
  // Check parent element context (sometimes inputs are wrapped)
  if (parentClass.includes('message') || parentClass.includes('compose') || 
      parentClass.includes('chat') || parentClass.includes('input')) {
    return true;
  }
  
  // Check for common input wrapper patterns
  const wrapperPatterns = ['input-wrapper', 'text-wrapper', 'editor-wrapper', 'compose-wrapper'];
  if (wrapperPatterns.some(pattern => parentClass.includes(pattern) || grandParentClass.includes(pattern))) {
    return true;
  }
  
  return false;
}

/**
 * Enhanced selector generation for messaging interfaces
 * @param {string} baseSelector - The original selector that failed
 * @returns {Array} Array of fallback selectors to try
 */
function generateMessagingSelectors(baseSelector) {
  const fallbacks = [];
  
  // Add the original selector first
  if (baseSelector && !fallbacks.includes(baseSelector)) {
    fallbacks.push(baseSelector);
  }
  
  // Common messaging input selectors
  const messagingSelectors = [
    // Universal patterns
    '[contenteditable="true"]',
    '[role="textbox"]',
    'div[contenteditable]',
    'div[data-testid*="message"]',
    'div[data-testid*="compose"]',
    'div[data-testid*="input"]',
    'div[aria-label*="message"]',
    'div[aria-label*="compose"]',
    'div[aria-label*="write"]',
    'div[aria-label*="type"]',
    
    // LinkedIn specific
    '.msg-form__contenteditable',
    '.msg-form__placeholder',
    '.compose-publisher [contenteditable]',
    '.ql-editor',
    
    // Twitter/X specific
    '.tweet-box',
    '.rich-editor',
    '.notranslate[contenteditable]',
    '.draftjs-editor',
    
    // Facebook specific
    '.notranslate._1mf',
    '.composerInput',
    '.UFIAddCommentInput',
    '._5rpu',
    
    // WhatsApp Web specific
    '.selectable-text[contenteditable]',
    '._3FRCZ[contenteditable]',
    '._1awRl',
    
    // Discord specific
    '[class*="textArea-"]',
    '[class*="slateTextArea-"]',
    '[class*="editor-"]',
    
    // Slack specific
    '.ql-editor',
    '.msg_input',
    '.p-message_input',
    
    // Generic patterns
    '.message-input',
    '.chat-input',
    '.compose-input',
    '.text-input[contenteditable]',
    'textarea[placeholder*="message"]',
    'input[placeholder*="message"]',
    'textarea[placeholder*="type"]',
    'input[placeholder*="type"]'
  ];
  
  // Add messaging selectors that aren't already included
  messagingSelectors.forEach(selector => {
    if (!fallbacks.includes(selector)) {
      fallbacks.push(selector);
    }
  });
  
  return fallbacks;
}

/**
 * Find alternative selectors for an element that couldn't be found
 * @param {string} failedSelector - The selector that failed
 * @param {string} actionType - The type of action being attempted
 * @returns {Array} Array of alternative selectors to try
 */
function findAlternativeSelectors(failedSelector, actionType) {
  const alternatives = [];
  
  // Extract meaningful parts from the failed selector
  const selectorParts = failedSelector.match(/[\w-]+/g) || [];
  
  // If it's a button/submit action, look for common button patterns
  if (actionType === 'click') {
    // Look for buttons with similar text
    document.querySelectorAll('button, [role="button"], input[type="submit"], input[type="button"], a.btn, a.button').forEach(el => {
      const text = el.textContent?.trim().toLowerCase() || '';
      const ariaLabel = el.getAttribute('aria-label')?.toLowerCase() || '';
      
      // Check if any part of the failed selector matches the element
      const matches = selectorParts.some(part => 
        text.includes(part.toLowerCase()) || 
        ariaLabel.includes(part.toLowerCase()) ||
        el.className.includes(part) ||
        el.id.includes(part)
      );
      
      if (matches && !alternatives.includes(el)) {
        // Generate a reliable selector for this element
        const selector = generateSelector(el);
        if (selector) {
          alternatives.push(selector);
        }
      }
    });
    
    // Look for clickable elements with similar classes
    if (failedSelector.includes('.')) {
      const className = failedSelector.match(/\.([^.\s]+)/)?.[1];
      if (className) {
        // Try partial class matches
        document.querySelectorAll(`[class*="${className}"]`).forEach(el => {
          if (el.tagName.match(/^(A|BUTTON|INPUT|SPAN|DIV)$/) && isClickable(el)) {
            const selector = generateSelector(el);
            if (selector && !alternatives.includes(selector)) {
              alternatives.push(selector);
            }
          }
        });
      }
    }
  }
  
  // For input fields, look for similar inputs
  if (actionType === 'type') {
    document.querySelectorAll('input, textarea, [contenteditable="true"]').forEach(el => {
      const placeholder = el.placeholder?.toLowerCase() || '';
      const label = el.getAttribute('aria-label')?.toLowerCase() || '';
      const name = el.name?.toLowerCase() || '';
      
      const matches = selectorParts.some(part => 
        placeholder.includes(part.toLowerCase()) ||
        label.includes(part.toLowerCase()) ||
        name.includes(part.toLowerCase()) ||
        el.className.includes(part) ||
        el.id.includes(part)
      );
      
      if (matches) {
        const selector = generateSelector(el);
        if (selector && !alternatives.includes(selector)) {
          alternatives.push(selector);
        }
      }
    });
  }
  
  return alternatives;
}

/**
 * Generate a reliable selector for an element
 * @param {Element} element - The element to generate a selector for
 * @returns {string|null} A CSS selector for the element
 */
function generateSelector(element) {
  // Prefer ID if available
  if (element.id) {
    return `#${element.id}`;
  }
  
  // Use unique attributes
  const uniqueAttrs = ['data-testid', 'data-test', 'data-id', 'aria-label'];
  for (const attr of uniqueAttrs) {
    const value = element.getAttribute(attr);
    if (value) {
      return `[${attr}="${value}"]`;
    }
  }
  
  // Use class if specific enough
  if (element.className && typeof element.className === 'string') {
    const classes = element.className.trim().split(/\s+/);
    if (classes.length > 0 && classes[0]) {
      // Check if this class selector would be unique enough
      const selector = `.${classes.join('.')}`;
      const matches = document.querySelectorAll(selector);
      if (matches.length <= 3) {
        return selector;
      }
    }
  }
  
  // Fall back to tag + attributes
  const tag = element.tagName.toLowerCase();
  if (element.type) {
    return `${tag}[type="${element.type}"]`;
  }
  
  return null;
}

/**
 * Check if an element appears to be clickable
 * @param {Element} element - The element to check
 * @returns {boolean} Whether the element seems clickable
 */
function isClickable(element) {
  const clickableTags = ['A', 'BUTTON', 'INPUT'];
  if (clickableTags.includes(element.tagName)) return true;
  
  const style = window.getComputedStyle(element);
  if (style.cursor === 'pointer') return true;
  
  if (element.onclick || element.getAttribute('onclick')) return true;
  if (element.getAttribute('role') === 'button') return true;
  
  return false;
}

// Query selector that supports shadow DOM
function querySelectorWithShadow(selector) {
  // Check if selector contains shadow DOM piercing operator
  if (selector.includes('>>>')) {
    const parts = selector.split('>>>').map(s => s.trim());
    let element = document.querySelector(parts[0]);
    
    for (let i = 1; i < parts.length && element; i++) {
      if (element.shadowRoot) {
        element = element.shadowRoot.querySelector(parts[i]);
      } else {
        element = null;
      }
    }
    
    return element;
  }
  
  // Regular querySelector for non-shadow DOM
  return document.querySelector(selector);
}

// Query all elements including shadow DOM
function querySelectorAllWithShadow(selector) {
  const results = [];
  
  // Regular query first
  results.push(...document.querySelectorAll(selector));
  
  // Then search in all shadow roots
  function searchShadowRoots(root) {
    const elements = root.querySelectorAll('*');
    for (const element of elements) {
      if (element.shadowRoot) {
        results.push(...element.shadowRoot.querySelectorAll(selector));
        searchShadowRoots(element.shadowRoot);
      }
    }
  }
  
  searchShadowRoots(document);
  return results;
}

// Tool functions for browser automation
const tools = {
  // Scroll the page
  scroll: (params) => {
    const amount = params.amount || 100;
    window.scrollBy(0, amount);
    return { success: true, scrollY: window.scrollY };
  },
  
  // Click an element
  click: async (params) => {
    const element = querySelectorWithShadow(params.selector);
    if (element) {
      // Check if element is visible and clickable
      const rect = element.getBoundingClientRect();
      const isVisible = rect.width > 0 && rect.height > 0;
      const isInViewport = rect.top >= 0 && rect.left >= 0 && 
                          rect.bottom <= window.innerHeight && 
                          rect.right <= window.innerWidth;
      
      if (!isVisible) {
        return { 
          success: false, 
          error: 'Element not visible',
          selector: params.selector,
          visibility: { width: rect.width, height: rect.height }
        };
      }
      
      // Scroll into view if needed
      if (!isInViewport) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Wait a bit for scroll
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      // Capture state before click
      const preClickState = {
        url: window.location.href,
        bodyTextLength: document.body.innerText.length,
        elementCount: document.querySelectorAll('*').length,
        activeElement: document.activeElement?.tagName,
        timestamp: Date.now()
      };
      
      // Perform the click
      element.click();
      
      // Wait a bit for immediate effects
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Check for immediate DOM changes
      const postClickState = {
        url: window.location.href,
        bodyTextLength: document.body.innerText.length,
        elementCount: document.querySelectorAll('*').length,
        activeElement: document.activeElement?.tagName,
        timestamp: Date.now()
      };
      
      // Detect changes
      const changes = {
        urlChanged: preClickState.url !== postClickState.url,
        contentChanged: Math.abs(postClickState.bodyTextLength - preClickState.bodyTextLength) > 10,
        elementCountChanged: Math.abs(postClickState.elementCount - preClickState.elementCount) > 5,
        focusChanged: preClickState.activeElement !== postClickState.activeElement,
        loadingDetected: !!document.querySelector('.loading, .spinner, [class*="load"], [aria-busy="true"]')
      };
      
      // Determine if click had an effect
      const hadEffect = Object.values(changes).some(v => v);
      
      return { 
        success: true, 
        clicked: params.selector,
        hadEffect: hadEffect,
        verification: {
          changes: changes,
          preState: {
            url: preClickState.url,
            elementCount: preClickState.elementCount
          },
          postState: {
            url: postClickState.url,
            elementCount: postClickState.elementCount
          }
        },
        elementInfo: {
          tag: element.tagName,
          text: element.textContent?.trim().substring(0, 50),
          wasInViewport: isInViewport
        },
        warning: !hadEffect ? 'Click completed but no immediate changes detected' : null
      };
    }
    
    // Try to find alternative selectors
    const alternatives = findAlternativeSelectors(params.selector, 'click');
    
    return { 
      success: false, 
      error: 'Element not found',
      selector: params.selector,
      alternatives: alternatives.length,
      alternativeSelectors: alternatives.slice(0, 3), // Return up to 3 alternatives
      suggestion: alternatives.length > 0 ? 'Try one of the alternative selectors' : 'No similar elements found'
    };
  },
  
  // Type text into an input
  type: async (params) => {
    console.log('[FSB Type] Starting type action with params:', params);
    
    try {
      const element = querySelectorWithShadow(params.selector);
      console.log('[FSB Type] Found element:', element ? element.tagName : 'null');
    
    if (element) {
      // Check if it's a valid input element with enhanced contenteditable detection
      const isInput = element.tagName === 'INPUT' || element.tagName === 'TEXTAREA';
      
      // Enhanced universal text input detection for all platforms
      const isContentEditable = element.contentEditable === 'true' || 
                                element.getAttribute('contenteditable') === 'true' ||
                                element.hasAttribute('contenteditable') ||
                                element.getAttribute('role') === 'textbox' ||
                                // Universal messaging patterns
                                isUniversalMessageInput(element);
      
      if (!isInput && !isContentEditable) {
        return { 
          success: false, 
          error: 'Element is not an input field',
          selector: params.selector,
          elementType: element.tagName,
          suggestion: 'Element found but it\'s not typeable'
        };
      }
      
      // Universal activation strategy - click ALL input elements by default
      // Modern websites often require click activation regardless of framework
      const shouldSkipClick = params.clickFirst === false; // Explicit opt-out only
      
      // Ensure element is visible and scroll into view if needed
      const rect = element.getBoundingClientRect();
      if (rect.top < 0 || rect.top > window.innerHeight) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Wait for scroll to complete
        await new Promise(resolve => setTimeout(resolve, 300));
      }
      
      // Universal click-first activation (unless explicitly disabled)
      if (!shouldSkipClick) {
        // Try clicking the element itself first
        element.click();
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // If not focused after click, try clicking associated label
        if (document.activeElement !== element && element.id) {
          const label = document.querySelector(`label[for="${element.id}"]`);
          if (label) {
            label.click();
            await new Promise(resolve => setTimeout(resolve, 50));
          }
        }
        
        // If still not focused, try clicking parent container
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
      
      if (isInput) {
        // Store previous value for comparison
        previousValue = element.value;
        
        // Clear existing value if needed
        element.value = '';
        
        // Type the new value
        element.value = params.text;
        
        // Dispatch multiple events for better compatibility
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
        element.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
      } else if (isContentEditable) {
        // Store previous content for comparison
        previousValue = element.textContent || element.innerText || '';
        
        // Advanced ContentEditable Text Insertion
        let insertionSuccess = false;
        
        // Method 1: Try execCommand insertText (proper caret positioning)
        if (document.execCommand) {
          try {
            // Clear existing content first
            element.focus();
            document.execCommand('selectAll', false, null);
            if (document.execCommand('insertText', false, params.text)) {
              insertionSuccess = true;
            }
          } catch (e) {
            console.log('execCommand insertText failed:', e);
          }
        }
        
        // Method 2: Clipboard paste simulation (for stubborn editors like Twitter/X)
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
            
            // Check if paste worked
            await new Promise(resolve => setTimeout(resolve, 50));
            if (element.textContent.includes(params.text)) {
              insertionSuccess = true;
            }
          } catch (e) {
            console.log('Clipboard paste simulation failed:', e);
          }
        }
        
        // Method 3: Range/Selection API insertion (modern approach)
        if (!insertionSuccess) {
          try {
            // Clear existing content
            element.innerHTML = '';
            element.textContent = '';
            
            // Create text node and insert
            const textNode = document.createTextNode(params.text);
            element.appendChild(textNode);
            
            // Position caret at end
            const range = document.createRange();
            const selection = window.getSelection();
            range.setStartAfter(textNode);
            range.collapse(true);
            selection.removeAllRanges();
            selection.addRange(range);
            
            insertionSuccess = true;
          } catch (e) {
            console.log('Range/Selection API insertion failed:', e);
          }
        }
        
        // Method 4: Direct manipulation fallback
        if (!insertionSuccess) {
          // Clear existing content properly (handle various structures)
          if (element.innerHTML.includes('<p><br></p>') || element.innerHTML.includes('<br>')) {
            element.innerHTML = '';
          } else {
            element.textContent = '';
          }
          
          // Try innerHTML then textContent
          try {
            element.innerHTML = params.text;
            if (element.textContent !== params.text) {
              element.textContent = params.text;
            }
            insertionSuccess = true;
          } catch (e) {
            console.log('Direct manipulation failed:', e);
          }
        }
        
        // Enhanced event dispatching for rich text editors
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
            console.log('Event dispatch failed:', event.type, e);
          }
        });
        
        // Additional delay for social media platforms to process
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Optional: Press Enter after typing (works for both input types)
      if (params.pressEnter) {
        const enterEvent = new KeyboardEvent('keydown', {
          key: 'Enter',
          code: 'Enter',
          keyCode: 13,
          which: 13,
          bubbles: true,
          cancelable: true
        });
        
        element.dispatchEvent(enterEvent);
        
        // Also dispatch keyup for completeness
        const enterUpEvent = new KeyboardEvent('keyup', {
          key: 'Enter',
          code: 'Enter',
          keyCode: 13,
          which: 13,
          bubbles: true,
          cancelable: true
        });
        
        element.dispatchEvent(enterUpEvent);
      }
      
      // Post-typing validation to ensure text was actually inserted
      const finalValue = element.textContent || element.value || '';
      const typingSuccessful = finalValue.includes(params.text) || finalValue === params.text;
      
      // Amazon-specific validation
      const isAmazonSearch = element.id === 'twotabsearchtextbox' || 
                           element.name === 'searchtext' ||
                           window.location.hostname.includes('amazon');
      
      if (isAmazonSearch && !typingSuccessful) {
        console.log('[FSB Type] Amazon search input detected, attempting enhanced typing...');
        
        // Amazon-specific retry with different approach
        try {
          element.focus();
          await new Promise(resolve => setTimeout(resolve, 100));
          
          // Clear and set value directly for Amazon
          element.value = '';
          element.value = params.text;
          
          // Trigger Amazon's search events
          element.dispatchEvent(new Event('input', { bubbles: true }));
          element.dispatchEvent(new Event('change', { bubbles: true }));
          element.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: params.text.slice(-1) }));
          element.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: params.text.slice(-1) }));
          
          await new Promise(resolve => setTimeout(resolve, 200));
          
          // Re-validate
          const retryValue = element.value || '';
          if (retryValue.includes(params.text) || retryValue === params.text) {
            console.log('[FSB Type] Amazon-specific retry succeeded');
          }
        } catch (amazonError) {
          console.warn('[FSB Type] Amazon-specific retry failed:', amazonError);
        }
      }
      
      // Final validation
      const finalCheck = element.textContent || element.value || '';
      const finalSuccess = finalCheck.includes(params.text) || finalCheck === params.text;
      
      // Universal return object for both input types
      return { 
        success: finalSuccess,
        typed: params.text,
        actualValue: finalCheck,
        pressedEnter: !!params.pressEnter,
        clickedFirst: !shouldSkipClick,
        focused: document.activeElement === element,
        focusAttempts: focusAttempts,
        scrolled: rect.top < 0 || rect.top > window.innerHeight,
        insertionSuccess: isContentEditable ? insertionSuccess : true,
        amazonSpecific: isAmazonSearch,
        validationPassed: finalSuccess,
        finalTextContent: finalCheck,
        elementInfo: {
          tag: element.tagName,
          type: isInput ? element.type : 'contenteditable',
          previousValue: previousValue.substring(0, 20),
          name: element.name || element.id || element.className,
          contentEditable: isContentEditable,
          ariaLabel: element.getAttribute('aria-label'),
          dataTestId: element.getAttribute('data-testid'),
          className: element.className
        }
      };
    }
    
    // Try fallback selectors for messaging interfaces
    const fallbackSelectors = generateMessagingSelectors(params.selector);
    console.log('[FSB Type] Trying fallback selectors:', fallbackSelectors);
    
    for (const fallbackSelector of fallbackSelectors) {
      const fallbackElement = document.querySelector(fallbackSelector);
      if (fallbackElement) {
        console.log('[FSB Type] Found element with fallback selector:', fallbackSelector);
        // Recursively call type with the working selector
        return await tools.type({...params, selector: fallbackSelector});
      }
    }
    
    // Enhanced error reporting for debugging
    const availableInputs = Array.from(document.querySelectorAll('input, textarea, [contenteditable="true"]'))
      .map(el => ({
        tag: el.tagName,
        id: el.id,
        name: el.name,
        class: el.className,
        type: el.type || 'contenteditable',
        visible: el.offsetWidth > 0 && el.offsetHeight > 0
      }))
      .slice(0, 5); // Limit to first 5 for logging
    
    console.error(`[FSB Type] Failed to find typeable element with selector: ${params.selector}`);
    console.error(`[FSB Type] Available inputs on page:`, availableInputs);
    
    return { 
      success: false, 
      error: 'Input element not found with any selector',
      selector: params.selector,
      fallbacksAttempted: fallbackSelectors.length,
      searched: true,
      availableInputs: availableInputs,
      isAmazonPage: window.location.hostname.includes('amazon'),
      currentUrl: window.location.href,
      suggestion: 'No typeable element found - check selector or page state'
    };
    } catch (error) {
      console.error('[FSB Type] Unexpected error in type function:', error);
      console.error('[FSB Type] Error stack:', error.stack);
      console.error('[FSB Type] Params at time of error:', params);
      
      return {
        success: false,
        error: error.message || 'Unknown error occurred in type function',
        selector: params.selector,
        stackTrace: error.stack,
        errorType: error.name || 'UnknownError',
        isAmazonPage: window.location.hostname.includes('amazon'),
        currentUrl: window.location.href,
        timestamp: Date.now(),
        paramsUsed: params
      };
    }
  },
  
  // Press Enter key on an element
  pressEnter: (params) => {
    const element = querySelectorWithShadow(params.selector);
    if (element) {
      // Focus the element first
      element.focus();
      
      // Create and dispatch keydown event
      const enterDownEvent = new KeyboardEvent('keydown', {
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        which: 13,
        bubbles: true,
        cancelable: true
      });
      
      element.dispatchEvent(enterDownEvent);
      
      // Create and dispatch keyup event for completeness
      const enterUpEvent = new KeyboardEvent('keyup', {
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        which: 13,
        bubbles: true,
        cancelable: true
      });
      
      element.dispatchEvent(enterUpEvent);
      
      return { success: true, key: 'Enter', selector: params.selector };
    }
    return { success: false, error: 'Element not found' };
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
  
  // Placeholder for CAPTCHA solving
  solveCaptcha: async (params) => {
    // TODO: Integrate with Buster or CapSolver
    const captchaElement = document.querySelector('.g-recaptcha');
    if (captchaElement) {
      return { success: false, error: 'CAPTCHA solving not yet implemented' };
    }
    return { success: false, error: 'No CAPTCHA found' };
  },
  
  // Navigate to a URL
  navigate: async (params) => {
    if (!params.url) {
      return { success: false, error: 'No URL provided' };
    }
    
    // Capture current state
    const preNavState = {
      url: window.location.href,
      timestamp: Date.now()
    };
    
    // Validate URL
    let targetUrl;
    try {
      const url = new URL(params.url);
      targetUrl = params.url;
    } catch (e) {
      // If not a valid URL, try adding https://
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
    
    // Initiate navigation
    window.location.href = targetUrl;
    
    // Note: We can't verify navigation completion here as the page will unload
    // The verification should happen in the next iteration when the new page loads
    return { 
      success: true, 
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
    
    // Encode the query for URL
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
        const element = document.querySelector(selector);
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
  
  // Wait for DOM to stabilize (no changes for a period)
  // Verify if a message was successfully sent by checking DOM changes
  verifyMessageSent: async (params) => {
    const { timeout = 5000, messageText = '' } = params;
    const startTime = Date.now();
    
    try {
      // Look for indicators that a message was sent
      const indicators = [
        // Message appears in chat history
        () => {
          const messages = document.querySelectorAll([
            '[data-testid*="message"]',
            '.message',
            '.chat-message',
            '.msg-',
            '[aria-label*="message"]',
            '.conversation-message',
            '.dm-message',
            '.tweet-text', // Twitter
            '.msg-form__sent-confirm', // LinkedIn
            '.message-in', // WhatsApp
            '.copyable-text' // WhatsApp
          ].join(', '));
          
          if (messageText) {
            // Check if our specific message appears
            return Array.from(messages).some(msg => 
              msg.textContent?.includes(messageText.substring(0, 20))
            );
          } else {
            // Check if messages list grew (new message added)
            const currentCount = messages.length;
            const previousCount = window.fsb_lastMessageCount || 0;
            window.fsb_lastMessageCount = currentCount;
            return currentCount > previousCount;
          }
        },
        
        // Input field cleared after sending
        () => {
          const inputs = document.querySelectorAll([
            '[contenteditable="true"]',
            'textarea',
            'input[type="text"]',
            '.message-input',
            '.compose-input'
          ].join(', '));
          
          return Array.from(inputs).some(input => {
            const content = input.textContent || input.value || '';
            return content.trim() === ''; // Input was cleared
          });
        },
        
        // Success confirmation elements
        () => {
          const confirmations = document.querySelectorAll([
            '.sent-confirmation',
            '.message-sent',
            '.delivery-confirmation',
            '[aria-label*="sent"]',
            '.success-indicator',
            '.checkmark'
          ].join(', '));
          
          return confirmations.length > 0 && 
                 Array.from(confirmations).some(el => 
                   el.offsetParent !== null // Element is visible
                 );
        },
        
        // Send button state changed (disabled/loading)
        () => {
          const sendButtons = document.querySelectorAll([
            '[aria-label*="send"]',
            'button[type="submit"]',
            '.send-button',
            '.submit-button',
            '[data-testid*="send"]'
          ].join(', '));
          
          return Array.from(sendButtons).some(button => 
            button.disabled || 
            button.classList.contains('loading') ||
            button.classList.contains('sent') ||
            button.textContent?.toLowerCase().includes('sent')
          );
        }
      ];
      
      // Check indicators periodically
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
        
        // Wait before next check
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      // Timeout reached - no verification found
      return {
        success: true, // Don't fail the action
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
    
    // Monitor network requests for better stability detection
    const originalFetch = window.fetch;
    const originalXHROpen = XMLHttpRequest.prototype.open;
    
    // Track fetch requests
    window.fetch = function(...args) {
      networkRequestCount++;
      lastChangeTime = Date.now();
      return originalFetch.apply(this, args);
    };
    
    // Track XHR requests
    XMLHttpRequest.prototype.open = function(...args) {
      networkRequestCount++;
      lastChangeTime = Date.now();
      return originalXHROpen.apply(this, args);
    };
    
    return new Promise((resolve) => {
      const observer = new MutationObserver((mutations) => {
        // Filter out trivial changes
        const significantMutations = mutations.filter(mutation => {
          // Ignore style changes on loading indicators
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
        attributeFilter: ['class', 'id', 'data-*', 'aria-*'] // Focus on meaningful attributes
      });
      
      const checkInterval = setInterval(() => {
        const now = Date.now();
        const timeSinceLastChange = now - lastChangeTime;
        const totalTime = now - startTime;
        
        // More intelligent stability detection
        const isStable = timeSinceLastChange >= stableTime;
        const hasTimedOut = totalTime >= timeout;
        
        if (isStable || hasTimedOut) {
          clearInterval(checkInterval);
          observer.disconnect();
          
          // Restore original functions
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
          
          console.log(`[FSB] DOM stability check completed:`, result);
          resolve(result);
        }
      }, 50); // Check more frequently for better precision
      
      // Safety timeout to prevent hanging
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
    const loadingPatterns = [
      // Common loading class names
      '.loading', '.loader', '.spinner', '.progress', '.loading-spinner',
      '.load-more', '.is-loading', '.in-progress', '.pending',
      // Common loading elements
      'div[class*="loading"]', 'div[class*="loader"]', 'div[class*="spinner"]',
      'div[class*="progress"]', '[aria-busy="true"]',
      // Specific site patterns
      '.MuiCircularProgress-root', '.ant-spin', '.el-loading-mask',
      // Custom data attributes
      '[data-loading="true"]', '[data-state="loading"]'
    ];
    
    // Check for visible loading indicators
    for (const pattern of loadingPatterns) {
      const elements = document.querySelectorAll(pattern);
      for (const element of elements) {
        const rect = element.getBoundingClientRect();
        const isVisible = rect.width > 0 && rect.height > 0 && 
                         window.getComputedStyle(element).display !== 'none' &&
                         window.getComputedStyle(element).visibility !== 'hidden';
        
        if (isVisible) {
          return {
            loading: true,
            indicator: pattern,
            element: {
              tag: element.tagName,
              class: element.className,
              id: element.id
            }
          };
        }
      }
    }
    
    // Check for common loading text
    const loadingTexts = ['loading', 'please wait', 'processing', 'fetching', 'updating'];
    const textElements = document.querySelectorAll('*');
    
    for (const element of textElements) {
      const text = element.textContent?.toLowerCase() || '';
      if (loadingTexts.some(loadingText => text.includes(loadingText))) {
        const rect = element.getBoundingClientRect();
        const isVisible = rect.width > 0 && rect.height > 0;
        
        if (isVisible && element.children.length === 0) { // Leaf node with text
          return {
            loading: true,
            indicator: 'text',
            text: element.textContent?.trim().substring(0, 50)
          };
        }
      }
    }
    
    return { loading: false };
  },
  
  // Right click on element
  rightClick: (params) => {
    const element = querySelectorWithShadow(params.selector);
    if (element) {
      const event = new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: element.getBoundingClientRect().left + 10,
        clientY: element.getBoundingClientRect().top + 10
      });
      element.dispatchEvent(event);
      return { success: true, rightClicked: params.selector };
    }
    return { success: false, error: 'Element not found' };
  },
  
  // Double click on element
  doubleClick: (params) => {
    const element = querySelectorWithShadow(params.selector);
    if (element) {
      const event = new MouseEvent('dblclick', {
        bubbles: true,
        cancelable: true,
        view: window
      });
      element.dispatchEvent(event);
      return { success: true, doubleClicked: params.selector };
    }
    return { success: false, error: 'Element not found' };
  },
  
  // Enhanced keyboard key press with Chrome Debugger API fallback
  keyPress: async (params) => {
    const { key, ctrlKey = false, shiftKey = false, altKey = false, metaKey = false, selector, useDebuggerAPI = true } = params;
    
    // First try Chrome Debugger API for more reliable key events
    if (useDebuggerAPI) {
      try {
        const response = await chrome.runtime.sendMessage({
          action: 'keyboardDebuggerAction',
          method: 'pressKey',
          key: key,
          modifiers: {
            ctrl: ctrlKey,
            shift: shiftKey,
            alt: altKey,
            meta: metaKey
          }
        });
        
        if (response.success) {
          return {
            success: true,
            key,
            method: 'debuggerAPI',
            target: selector || 'activeElement',
            result: response.result
          };
        } else {
          console.warn('[FSB] Debugger API failed, falling back to DOM events:', response.error);
        }
      } catch (error) {
        console.warn('[FSB] Debugger API unavailable, falling back to DOM events:', error);
      }
    }
    
    // Fallback to standard DOM events
    const target = selector ? document.querySelector(selector) : document.activeElement;
    
    if (!target) {
      return { success: false, error: 'No target element' };
    }
    
    // Focus the target element first
    target.focus();
    
    const keyEvent = new KeyboardEvent('keydown', {
      key,
      code: key,
      ctrlKey,
      shiftKey,
      altKey,
      metaKey,
      bubbles: true,
      cancelable: true
    });
    
    target.dispatchEvent(keyEvent);
    
    // Also dispatch keyup
    const keyUpEvent = new KeyboardEvent('keyup', {
      key,
      code: key,
      ctrlKey,
      shiftKey,
      altKey,
      metaKey,
      bubbles: true,
      cancelable: true
    });
    
    target.dispatchEvent(keyUpEvent);
    
    return { 
      success: true, 
      key, 
      method: 'domEvents',
      target: selector || 'activeElement',
      modifiers: { ctrlKey, shiftKey, altKey, metaKey }
    };
  },

  // Press a sequence of keys (e.g., Ctrl+C, Alt+Tab)
  pressKeySequence: async (params) => {
    const { keys, modifiers = {}, delay = 50, useDebuggerAPI = true } = params;
    
    if (!Array.isArray(keys) || keys.length === 0) {
      return { success: false, error: 'Keys array is required' };
    }
    
    // Try Chrome Debugger API first
    if (useDebuggerAPI) {
      try {
        const response = await chrome.runtime.sendMessage({
          action: 'keyboardDebuggerAction',
          method: 'pressKeySequence',
          keys: keys,
          modifiers: modifiers,
          delay: delay
        });
        
        if (response.success) {
          return {
            success: true,
            action: 'pressKeySequence',
            keys,
            modifiers,
            method: 'debuggerAPI',
            result: response.result
          };
        } else {
          console.warn('[FSB] Debugger API failed for key sequence, falling back to DOM events:', response.error);
        }
      } catch (error) {
        console.warn('[FSB] Debugger API unavailable for key sequence, falling back to DOM events:', error);
      }
    }
    
    // Fallback to DOM events
    const results = [];
    try {
      for (const key of keys) {
        const result = await tools.keyPress({
          key,
          ctrlKey: modifiers.ctrl || modifiers.control,
          shiftKey: modifiers.shift,
          altKey: modifiers.alt,
          metaKey: modifiers.meta || modifiers.cmd,
          useDebuggerAPI: false // Avoid infinite recursion
        });
        
        results.push(result);
        
        if (!result.success) {
          return {
            success: false,
            error: `Failed at key: ${key}`,
            completedKeys: results.length - 1,
            results
          };
        }

        if (delay > 0 && keys.indexOf(key) < keys.length - 1) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }

      return {
        success: true,
        action: 'pressKeySequence',
        keys,
        modifiers,
        method: 'domEvents',
        results
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Key sequence failed',
        keys,
        modifiers,
        results
      };
    }
  },

  // Type text using real keyboard events (more reliable than setting values)
  typeWithKeys: async (params) => {
    const { text, delay = 30, useDebuggerAPI = true } = params;
    
    if (!text || typeof text !== 'string') {
      return { success: false, error: 'Text parameter is required' };
    }
    
    // Try Chrome Debugger API first
    if (useDebuggerAPI) {
      try {
        const response = await chrome.runtime.sendMessage({
          action: 'keyboardDebuggerAction',
          method: 'typeText',
          text: text,
          delay: delay
        });
        
        if (response.success) {
          return {
            success: true,
            action: 'typeWithKeys',
            text,
            method: 'debuggerAPI',
            characterCount: text.length,
            result: response.result
          };
        } else {
          console.warn('[FSB] Debugger API failed for text typing, falling back to DOM events:', response.error);
        }
      } catch (error) {
        console.warn('[FSB] Debugger API unavailable for text typing, falling back to DOM events:', error);
      }
    }
    
    // Fallback to DOM events
    const results = [];
    try {
      for (const char of text) {
        let key = char;
        let modifiers = {};

        // Handle uppercase letters
        if (char >= 'A' && char <= 'Z') {
          key = char.toLowerCase();
          modifiers.shift = true;
        }

        // Handle special characters that require shift
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

        const result = await tools.keyPress({
          key,
          shiftKey: modifiers.shift,
          useDebuggerAPI: false // Avoid infinite recursion
        });
        
        results.push({ char, key, modifiers, result });

        if (!result.success) {
          return {
            success: false,
            error: `Failed at character: ${char}`,
            completedChars: results.length - 1,
            results
          };
        }

        if (delay > 0 && text.indexOf(char) < text.length - 1) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }

      return {
        success: true,
        action: 'typeWithKeys',
        text,
        method: 'domEvents',
        characterCount: text.length,
        results
      };

    } catch (error) {
      return {
        success: false,
        error: error.message || 'Text typing failed',
        text,
        results
      };
    }
  },

  // Send special keys like function keys or complex combinations
  sendSpecialKey: async (params) => {
    const { specialKey, useDebuggerAPI = true } = params;
    
    if (!specialKey || typeof specialKey !== 'string') {
      return { success: false, error: 'SpecialKey parameter is required' };
    }
    
    // Try Chrome Debugger API first
    if (useDebuggerAPI) {
      try {
        const response = await chrome.runtime.sendMessage({
          action: 'keyboardDebuggerAction',
          method: 'sendSpecialKey',
          specialKey: specialKey
        });
        
        if (response.success) {
          return {
            success: true,
            action: 'sendSpecialKey',
            specialKey,
            method: 'debuggerAPI',
            result: response.result
          };
        } else {
          console.warn('[FSB] Debugger API failed for special key, falling back to DOM events:', response.error);
        }
      } catch (error) {
        console.warn('[FSB] Debugger API unavailable for special key, falling back to DOM events:', error);
      }
    }
    
    // Fallback to DOM events - parse the special key
    try {
      const parts = specialKey.split('+').map(part => part.trim());
      const modifiers = {};
      let targetKey = parts[parts.length - 1]; // Last part is the main key

      // Extract modifiers
      for (let i = 0; i < parts.length - 1; i++) {
        const modifier = parts[i].toLowerCase();
        if (modifier === 'ctrl' || modifier === 'control') {
          modifiers.ctrlKey = true;
        } else if (modifier === 'alt') {
          modifiers.altKey = true;
        } else if (modifier === 'shift') {
          modifiers.shiftKey = true;
        } else if (modifier === 'meta' || modifier === 'cmd' || modifier === 'command') {
          modifiers.metaKey = true;
        }
      }

      const result = await tools.keyPress({
        key: targetKey,
        ...modifiers,
        useDebuggerAPI: false // Avoid infinite recursion
      });

      return {
        success: result.success,
        action: 'sendSpecialKey',
        specialKey,
        method: 'domEvents',
        parsedKey: targetKey,
        parsedModifiers: modifiers,
        result
      };

    } catch (error) {
      return {
        success: false,
        error: error.message || 'Special key send failed',
        specialKey
      };
    }
  },
  
  // Select text in element
  selectText: (params) => {
    const element = querySelectorWithShadow(params.selector);
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
  
  // Focus on element
  focus: (params) => {
    const element = querySelectorWithShadow(params.selector);
    if (element) {
      element.focus();
      return { success: true, focused: params.selector };
    }
    return { success: false, error: 'Element not found' };
  },
  
  // Blur (unfocus) element
  blur: (params) => {
    const element = querySelectorWithShadow(params.selector);
    if (element) {
      element.blur();
      return { success: true, blurred: params.selector };
    }
    return { success: false, error: 'Element not found' };
  },
  
  // Hover over element
  hover: (params) => {
    const element = querySelectorWithShadow(params.selector);
    if (element) {
      const rect = element.getBoundingClientRect();
      const mouseOverEvent = new MouseEvent('mouseover', {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: rect.left + rect.width / 2,
        clientY: rect.top + rect.height / 2
      });
      element.dispatchEvent(mouseOverEvent);
      
      const mouseEnterEvent = new MouseEvent('mouseenter', {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: rect.left + rect.width / 2,
        clientY: rect.top + rect.height / 2
      });
      element.dispatchEvent(mouseEnterEvent);
      
      return { success: true, hovering: params.selector };
    }
    return { success: false, error: 'Element not found' };
  },
  
  // Select dropdown option
  selectOption: (params) => {
    const element = querySelectorWithShadow(params.selector);
    if (element && element.tagName === 'SELECT') {
      if (params.value !== undefined) {
        element.value = params.value;
      } else if (params.index !== undefined) {
        element.selectedIndex = params.index;
      } else if (params.text !== undefined) {
        const option = Array.from(element.options).find(opt => opt.text === params.text);
        if (option) {
          option.selected = true;
        }
      }
      
      // Dispatch change event
      element.dispatchEvent(new Event('change', { bubbles: true }));
      
      return { success: true, selected: params.value || params.text || params.index };
    }
    return { success: false, error: 'Select element not found' };
  },
  
  // Check/uncheck checkbox or radio
  toggleCheckbox: (params) => {
    const element = querySelectorWithShadow(params.selector);
    if (element && (element.type === 'checkbox' || element.type === 'radio')) {
      if (params.checked !== undefined) {
        element.checked = params.checked;
      } else {
        element.checked = !element.checked;
      }
      
      // Dispatch change event
      element.dispatchEvent(new Event('change', { bubbles: true }));
      
      return { success: true, checked: element.checked };
    }
    return { success: false, error: 'Checkbox/radio element not found' };
  },
  
  // Refresh page
  refresh: () => {
    window.location.reload();
    return { success: true, action: 'page refresh initiated' };
  },
  
  // Go back in browser history
  goBack: () => {
    window.history.back();
    return { success: true, action: 'navigated back' };
  },
  
  // Go forward in browser history
  goForward: () => {
    window.history.forward();
    return { success: true, action: 'navigated forward' };
  },
  
  // Get element text
  getText: (params) => {
    const element = querySelectorWithShadow(params.selector);
    if (element) {
      const textValue = element.innerText || element.textContent || element.value || '';
      return { 
        success: true, 
        text: textValue,
        value: textValue // Also include as 'value' for consistency with background.js expectations
      };
    }
    return { success: false, error: 'Element not found' };
  },
  
  // Get attribute value
  getAttribute: (params) => {
    const element = querySelectorWithShadow(params.selector);
    if (element) {
      const value = element.getAttribute(params.attribute);
      return { 
        success: true, 
        attribute: params.attribute,
        value: value 
      };
    }
    return { success: false, error: 'Element not found' };
  },
  
  // Set attribute value
  setAttribute: (params) => {
    const element = querySelectorWithShadow(params.selector);
    if (element) {
      element.setAttribute(params.attribute, params.value);
      return { 
        success: true, 
        attribute: params.attribute,
        value: params.value 
      };
    }
    return { success: false, error: 'Element not found' };
  },
  
  // Clear input field
  clearInput: (params) => {
    const element = querySelectorWithShadow(params.selector);
    if (element && (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA')) {
      element.value = '';
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
      return { success: true, cleared: params.selector };
    }
    return { success: false, error: 'Input element not found' };
  },

  // Multi-tab management tools
  
  // Open new tab
  openNewTab: async (params) => {
    const url = params.url || 'about:blank';
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'openNewTab',
        url: url,
        active: params.active !== false // Default to true
      });
      
      if (response.success) {
        return { 
          success: true, 
          tabId: response.tabId,
          url: url,
          active: params.active !== false
        };
      } else {
        return { 
          success: false, 
          error: response.error || 'Failed to open new tab'
        };
      }
    } catch (error) {
      return { 
        success: false, 
        error: `Failed to communicate with background script: ${error.message}`
      };
    }
  },

  // Switch to existing tab
  switchToTab: async (params) => {
    const tabId = params.tabId;
    if (!tabId) {
      return { success: false, error: 'Tab ID is required' };
    }

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'switchToTab',
        tabId: tabId
      });
      
      if (response.success) {
        return { 
          success: true, 
          tabId: tabId,
          previousTab: response.previousTab
        };
      } else {
        return { 
          success: false, 
          error: response.error || 'Failed to switch to tab'
        };
      }
    } catch (error) {
      return { 
        success: false, 
        error: `Failed to communicate with background script: ${error.message}`
      };
    }
  },

  // Close tab
  closeTab: async (params) => {
    const tabId = params.tabId;
    if (!tabId) {
      return { success: false, error: 'Tab ID is required' };
    }

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'closeTab',
        tabId: tabId
      });
      
      if (response.success) {
        return { 
          success: true, 
          tabId: tabId,
          closed: true
        };
      } else {
        return { 
          success: false, 
          error: response.error || 'Failed to close tab'
        };
      }
    } catch (error) {
      return { 
        success: false, 
        error: `Failed to communicate with background script: ${error.message}`
      };
    }
  },

  // List all tabs
  listTabs: async (params) => {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'listTabs',
        currentWindowOnly: params.currentWindowOnly !== false // Default to true
      });
      
      if (response.success) {
        return { 
          success: true, 
          tabs: response.tabs,
          currentTab: response.currentTab,
          totalTabs: response.tabs.length
        };
      } else {
        return { 
          success: false, 
          error: response.error || 'Failed to list tabs'
        };
      }
    } catch (error) {
      return { 
        success: false, 
        error: `Failed to communicate with background script: ${error.message}`
      };
    }
  },

  // Get current tab info
  getCurrentTab: async (params) => {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'getCurrentTab'
      });
      
      if (response.success) {
        return { 
          success: true, 
          tabId: response.tab.id,
          url: response.tab.url,
          title: response.tab.title,
          active: response.tab.active,
          tab: response.tab
        };
      } else {
        return { 
          success: false, 
          error: response.error || 'Failed to get current tab info'
        };
      }
    } catch (error) {
      return { 
        success: false, 
        error: `Failed to communicate with background script: ${error.message}`
      };
    }
  },

  // Wait for tab to load
  waitForTabLoad: async (params) => {
    const tabId = params.tabId;
    const timeout = params.timeout || 30000; // 30 seconds default
    
    if (!tabId) {
      return { success: false, error: 'Tab ID is required' };
    }

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'waitForTabLoad',
        tabId: tabId,
        timeout: timeout
      });
      
      if (response.success) {
        return { 
          success: true, 
          tabId: tabId,
          loaded: true,
          url: response.url,
          loadTime: response.loadTime
        };
      } else {
        return { 
          success: false, 
          error: response.error || 'Tab failed to load within timeout'
        };
      }
    } catch (error) {
      return { 
        success: false, 
        error: `Failed to communicate with background script: ${error.message}`
      };
    }
  },

  // Game controls helper - detects game context and uses optimal key sending method
  gameControl: async (params) => {
    const { action } = params;
    
    // Map common game actions to proper key events
    const gameKeyMap = {
      'start': 'Enter',
      'enter': 'Enter', 
      'up': 'ArrowUp',
      'down': 'ArrowDown',
      'left': 'ArrowLeft',
      'right': 'ArrowRight',
      'fire': ' ', // Space key
      'shoot': ' ', // Space key
      'jump': ' ', // Space key
      'thrust': 'ArrowUp',
      'hyperspace': 'Shift',
      'pause': 'Escape'
    };
    
    const key = gameKeyMap[action.toLowerCase()] || action;
    
    // Try to find game canvas or interactive element
    const gameTargets = [
      'canvas',
      'iframe[src*="game"]',
      'div[id*="game"]',
      'div[class*="game"]',
      'body' // Fallback
    ];
    
    let targetElement = null;
    for (const selector of gameTargets) {
      targetElement = document.querySelector(selector);
      if (targetElement) break;
    }
    
    // Focus the game element if found
    if (targetElement && targetElement !== document.body) {
      targetElement.focus();
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    // Use keyPress tool for reliable game controls
    const result = await tools.keyPress({
      key: key,
      useDebuggerAPI: true // Prefer Chrome Debugger API for games
    });
    
    return {
      success: result.success,
      action: action,
      key: key,
      targetElement: targetElement ? targetElement.tagName : 'body',
      gameControlUsed: true,
      result: result
    };
  },

  // Explicit arrow key tools for gaming and navigation
  arrowUp: async (params = {}) => {
    return await tools.keyPress({ 
      key: 'ArrowUp', 
      useDebuggerAPI: true, 
      ...params 
    });
  },

  arrowDown: async (params = {}) => {
    return await tools.keyPress({ 
      key: 'ArrowDown', 
      useDebuggerAPI: true, 
      ...params 
    });
  },

  arrowLeft: async (params = {}) => {
    return await tools.keyPress({ 
      key: 'ArrowLeft', 
      useDebuggerAPI: true, 
      ...params 
    });
  },

  arrowRight: async (params = {}) => {
    return await tools.keyPress({ 
      key: 'ArrowRight', 
      useDebuggerAPI: true, 
      ...params 
    });
  }
};

// Create a hash for an element to detect changes
function hashElement(element) {
  return `${element.type}-${element.id}-${element.class}-${element.text}-${element.position.x}-${element.position.y}`;
}

// Check if element is in viewport
function isInViewport(element) {
  const viewportHeight = window.innerHeight;
  const viewportWidth = window.innerWidth;
  const scrollY = window.scrollY;
  const scrollX = window.scrollX;
  
  return (
    element.position.y >= scrollY &&
    element.position.y <= scrollY + viewportHeight &&
    element.position.x >= scrollX &&
    element.position.x <= scrollX + viewportWidth
  );
}

// Check if element rect is in viewport
function isElementInViewport(rect) {
  return (
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.bottom <= window.innerHeight &&
    rect.right <= window.innerWidth
  );
}

// Slugify text for element ID generation
function slugify(text, maxLength = 30) {
  if (!text) return '';
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special chars
    .replace(/[\s_-]+/g, '_') // Replace spaces with underscore
    .replace(/^_+|_+$/g, '') // Remove leading/trailing underscores
    .substring(0, maxLength);
}

// Generate semantic element ID based on element properties and context
function generateSemanticElementId(element, elementIndex) {
  const parts = [];
  
  // 1. Element type or role
  const role = element.getAttribute('role');
  if (role) {
    parts.push(role);
  } else {
    parts.push(element.tagName.toLowerCase());
  }
  
  // 2. Primary identifier (in order of preference)
  if (element.id) {
    parts.push(slugify(element.id));
  } else if (element.getAttribute('aria-label')) {
    parts.push(slugify(element.getAttribute('aria-label')));
  } else if (element.getAttribute('data-testid')) {
    parts.push(slugify(element.getAttribute('data-testid')));
  } else if (element.name) {
    parts.push(slugify(element.name));
  } else if (element.textContent && element.textContent.trim().length > 0) {
    // For buttons, links, etc. use their text content
    const textContent = element.textContent.trim();
    if (['BUTTON', 'A', 'LABEL', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6'].includes(element.tagName)) {
      parts.push(slugify(textContent, 20));
    }
  }
  
  // 3. Context (parent form, section, etc.)
  const contextElement = element.closest('form, section, article, nav, header, footer, main, aside, [role]');
  if (contextElement) {
    const contextId = contextElement.id || 
                     contextElement.getAttribute('aria-label') || 
                     contextElement.getAttribute('role') ||
                     contextElement.className?.split(' ')[0];
    if (contextId) {
      parts.push(slugify(contextId, 15));
    }
  }
  
  // 4. Add element type suffix for common interactive elements
  if (element.tagName === 'INPUT' && element.type) {
    parts.push(element.type);
  }
  
  // 5. Ensure uniqueness with index if parts are too generic
  const baseId = parts.filter(Boolean).join('_') || `elem_${element.tagName.toLowerCase()}`;
  
  // Add index for uniqueness only if needed
  if (baseId === element.tagName.toLowerCase() || baseId.length < 5) {
    return `${baseId}_${elementIndex}`;
  }
  
  return baseId;
}

// Optimized DOM Serializer with string deduplication and compact format
class OptimizedDOMSerializer {
  constructor() {
    this.stringTable = new Map();
    this.stringIndex = 0;
  }
  
  // Build string table for deduplication
  addToStringTable(str) {
    if (!str || typeof str !== 'string') return null;
    
    if (!this.stringTable.has(str)) {
      this.stringTable.set(str, this.stringIndex++);
    }
    return this.stringTable.get(str);
  }
  
  // Convert string table to array for serialization
  getStringTableArray() {
    const arr = new Array(this.stringTable.size);
    for (const [str, index] of this.stringTable) {
      arr[index] = str;
    }
    return arr;
  }
  
  // Compact element representation using string references
  compactElement(element) {
    const compact = {
      // Use string table references for text content
      eId: this.addToStringTable(element.elementId),
      t: this.addToStringTable(element.type),
      // Pack position data as array for smaller size
      p: [element.position.x, element.position.y, element.position.width, element.position.height],
      v: element.position.inViewport ? 1 : 0
    };
    
    // Only include non-empty values
    if (element.text) compact.tx = this.addToStringTable(element.text.substring(0, 100));
    if (element.id) compact.id = this.addToStringTable(element.id);
    if (element.class) compact.cl = this.addToStringTable(element.class);
    
    // Selectors as array of string indices
    if (element.selectors?.length > 0) {
      compact.s = element.selectors.slice(0, 3).map(s => this.addToStringTable(s));
    }
    
    // Interactive properties as bit flags
    let flags = 0;
    if (element.isButton) flags |= 1;
    if (element.isInput) flags |= 2;
    if (element.isLink) flags |= 4;
    if (element.interactionState?.disabled) flags |= 8;
    if (element.interactionState?.checked) flags |= 16;
    if (element.interactionState?.focused) flags |= 32;
    if (flags > 0) compact.f = flags;
    
    // Important attributes
    const attrs = {};
    if (element.attributes?.['aria-label']) attrs.al = this.addToStringTable(element.attributes['aria-label']);
    if (element.attributes?.['data-testid']) attrs.dt = this.addToStringTable(element.attributes['data-testid']);
    if (element.href) attrs.h = this.addToStringTable(element.href);
    if (element.inputType) attrs.it = this.addToStringTable(element.inputType);
    if (Object.keys(attrs).length > 0) compact.a = attrs;
    
    return compact;
  }
  
  // Serialize elements with optimal format
  serialize(elements) {
    // Reset for new serialization
    this.stringTable.clear();
    this.stringIndex = 0;
    
    // Compact all elements
    const compactElements = elements.map(el => this.compactElement(el));
    
    return {
      // String lookup table
      strings: this.getStringTableArray(),
      // Compact element data
      elements: compactElements,
      // Metadata for decoding
      version: 2,
      compressed: true
    };
  }
  
  // Calculate compression ratio
  getCompressionRatio(original, compressed) {
    const originalSize = JSON.stringify(original).length;
    const compressedSize = JSON.stringify(compressed).length;
    return 1 - (compressedSize / originalSize);
  }
}

// Generate multiple selectors for an element with ARIA-first strategy
function generateSelectors(element, semanticId = null) {
  const selectors = [];
  const selectorScores = new Map(); // Track stability scores
  
  // 0. Semantic ID selector (if available) - for AI reference
  if (semanticId && semanticId !== `elem_${element.tagName.toLowerCase()}`) {
    // Add as a comment selector for AI to understand element purpose
    const semanticSelector = `[data-fsb-id="${semanticId}"]`; // Virtual selector for AI understanding
    selectors.push(semanticSelector);
    selectorScores.set(semanticSelector, 11); // Highest priority for AI comprehension
  }
  
  // 1. ARIA selectors (highest priority - most stable)
  // Aria-label selector
  if (element.getAttribute('aria-label')) {
    const selector = `[aria-label="${element.getAttribute('aria-label')}"]`;
    selectors.push(selector);
    selectorScores.set(selector, 10); // Highest score
  }
  
  // Role + aria attributes combo
  const role = element.getAttribute('role');
  if (role) {
    let roleSelector = `[role="${role}"]`;
    
    // Add aria-labelledby for more specificity
    if (element.getAttribute('aria-labelledby')) {
      roleSelector += `[aria-labelledby="${element.getAttribute('aria-labelledby')}"]`;
    }
    // Add aria-describedby for additional context
    else if (element.getAttribute('aria-describedby')) {
      roleSelector += `[aria-describedby="${element.getAttribute('aria-describedby')}"]`;
    }
    
    selectors.push(roleSelector);
    selectorScores.set(roleSelector, 9);
  }
  
  // Other ARIA attributes
  const ariaAttrs = ['aria-controls', 'aria-owns', 'aria-expanded', 'aria-selected', 'aria-checked'];
  for (const attr of ariaAttrs) {
    if (element.hasAttribute(attr)) {
      const selector = `[${attr}="${element.getAttribute(attr)}"]`;
      selectors.push(selector);
      selectorScores.set(selector, 8);
    }
  }
  
  // 2. Test ID selector (very stable for testing)
  if (element.getAttribute('data-testid')) {
    const selector = `[data-testid="${element.getAttribute('data-testid')}"]`;
    selectors.push(selector);
    selectorScores.set(selector, 9);
  }
  
  // 3. ID selector (stable but may not always exist)
  if (element.id && !element.id.match(/^[0-9a-f]{8}-|^uid-|^react-|^ember-/i)) { // Skip auto-generated IDs
    const selector = `#${CSS.escape(element.id)}`;
    selectors.push(selector);
    selectorScores.set(selector, 8);
  }
  
  // 4. Semantic HTML5 selectors
  const semanticTags = ['nav', 'main', 'header', 'footer', 'section', 'article', 'aside'];
  if (semanticTags.includes(element.tagName.toLowerCase())) {
    const tagSelector = element.tagName.toLowerCase();
    // Add context if available
    if (element.className && typeof element.className === 'string') {
      const primaryClass = element.className.trim().split(/\s+/)[0];
      if (primaryClass && !primaryClass.match(/^js-|^css-|^is-|^has-/)) {
        const selector = `${tagSelector}.${CSS.escape(primaryClass)}`;
        selectors.push(selector);
        selectorScores.set(selector, 7);
      }
    } else {
      selectors.push(tagSelector);
      selectorScores.set(tagSelector, 6);
    }
  }
  
  // 5. Name attribute selector (good for forms)
  if (element.name) {
    const selector = `[name="${CSS.escape(element.name)}"]`;
    selectors.push(selector);
    selectorScores.set(selector, 7);
  }
  
  // 6. Class selector (less stable, filter out dynamic classes)
  if (element.className && typeof element.className === 'string') {
    const classes = element.className.trim().split(/\s+/)
      .filter(c => c && !c.match(/^(active|selected|hover|focus|disabled|loading|hidden|show)/i))
      .slice(0, 2); // Limit to 2 most significant classes
    
    if (classes.length > 0) {
      const selector = `.${classes.map(c => CSS.escape(c)).join('.')}`;
      selectors.push(selector);
      selectorScores.set(selector, 5);
    }
  }
  
  // 7. Text content selector for interactive elements
  if (['BUTTON', 'A', 'LABEL'].includes(element.tagName) && element.textContent) {
    const text = element.textContent.trim().substring(0, 30);
    if (text && text.length > 2) {
      // XPath selector for exact text match
      const selector = `//${element.tagName.toLowerCase()}[normalize-space(.)="${text}"]`;
      selectors.push(selector);
      selectorScores.set(selector, 6);
    }
  }
  
  // 8. Input type specific selectors
  if (element.tagName === 'INPUT' && element.type) {
    const typeSelector = `input[type="${element.type}"]`;
    if (element.placeholder) {
      const selector = `${typeSelector}[placeholder="${CSS.escape(element.placeholder)}"]`;
      selectors.push(selector);
      selectorScores.set(selector, 6);
    } else {
      selectors.push(typeSelector);
      selectorScores.set(typeSelector, 4);
    }
  }
  
  // 9. Nth-child as last resort (least stable)
  if (selectors.length === 0) {
    const parent = element.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children);
      const index = siblings.indexOf(element) + 1;
      const parentSelector = generateBasicSelector(parent);
      if (parentSelector) {
        const selector = `${parentSelector} > ${element.tagName.toLowerCase()}:nth-child(${index})`;
        selectors.push(selector);
        selectorScores.set(selector, 2);
      }
    }
  }
  
  // Sort selectors by stability score (highest first)
  const sortedSelectors = selectors.sort((a, b) => {
    const scoreA = selectorScores.get(a) || 0;
    const scoreB = selectorScores.get(b) || 0;
    return scoreB - scoreA;
  });
  
  // Return top 5 selectors with scores
  return sortedSelectors.slice(0, 5).map(sel => ({
    selector: sel,
    score: selectorScores.get(sel) || 0
  }));
}

// Check if element is inside shadow DOM
function isInShadowDOM(element) {
  let node = element;
  while (node && node !== document) {
    if (node.toString() === '[object ShadowRoot]') {
      return true;
    }
    node = node.parentNode || node.host;
  }
  return false;
}

// Generate human-readable description of element
function generateElementDescription(element) {
  const parts = [];
  
  // Start with element type description
  const typeDescriptions = {
    'button': 'button',
    'a': 'link',
    'input': element.type ? `${element.type} input` : 'input field',
    'select': 'dropdown',
    'textarea': 'text area',
    'img': 'image',
    'video': 'video',
    'audio': 'audio',
    'iframe': 'embedded frame'
  };
  
  parts.push(typeDescriptions[element.tagName.toLowerCase()] || element.tagName.toLowerCase());
  
  // Add descriptive text
  const ariaLabel = element.getAttribute('aria-label');
  const text = element.textContent?.trim();
  const placeholder = element.placeholder;
  const alt = element.alt;
  const title = element.title;
  
  if (ariaLabel) {
    parts.push(`"${ariaLabel}"`);
  } else if (text && text.length > 0 && text.length < 50) {
    parts.push(`"${text}"`);
  } else if (placeholder) {
    parts.push(`with placeholder "${placeholder}"`);
  } else if (alt) {
    parts.push(`"${alt}"`);
  } else if (title) {
    parts.push(`"${title}"`);
  }
  
  // Add visual characteristics
  const styles = window.getComputedStyle(element);
  const bgColor = styles.backgroundColor;
  const color = styles.color;
  
  // Add color if it's distinctive
  if (bgColor && bgColor !== 'rgba(0, 0, 0, 0)' && bgColor !== 'transparent') {
    const colorName = getColorName(bgColor);
    if (colorName) parts.push(colorName);
  }
  
  // Add position context
  const rect = element.getBoundingClientRect();
  const viewport = { width: window.innerWidth, height: window.innerHeight };
  
  if (rect.top < viewport.height * 0.2) {
    parts.push('at top');
  } else if (rect.bottom > viewport.height * 0.8) {
    parts.push('at bottom');
  }
  
  if (rect.left < viewport.width * 0.3) {
    parts.push('left side');
  } else if (rect.right > viewport.width * 0.7) {
    parts.push('right side');
  } else if (rect.left > viewport.width * 0.4 && rect.right < viewport.width * 0.6) {
    parts.push('center');
  }
  
  // Add form context
  const form = element.closest('form');
  if (form) {
    const formName = form.getAttribute('aria-label') || form.id || form.name;
    if (formName) {
      parts.push(`in "${formName}" form`);
    } else {
      parts.push('in form');
    }
  }
  
  return parts.join(' ');
}

// Helper function to get color name from RGB
function getColorName(rgbString) {
  // Simple color detection - could be enhanced
  const rgb = rgbString.match(/\d+/g);
  if (!rgb || rgb.length < 3) return null;
  
  const [r, g, b] = rgb.map(Number);
  
  // Basic color detection
  if (r > 200 && g < 100 && b < 100) return 'red';
  if (r < 100 && g > 200 && b < 100) return 'green';
  if (r < 100 && g < 100 && b > 200) return 'blue';
  if (r > 200 && g > 200 && b < 100) return 'yellow';
  if (r > 200 && g < 150 && b > 200) return 'purple';
  if (r > 200 && g > 100 && b < 50) return 'orange';
  if (r > 200 && g > 200 && b > 200) return 'white';
  if (r < 50 && g < 50 && b < 50) return 'black';
  if (r > 100 && g > 100 && b > 100 && r < 200) return 'gray';
  
  return null;
}

// Get element clustering information
function getElementCluster(element) {
  const cluster = {
    formContext: null,
    sectionContext: null,
    nearbyButtons: [],
    nearbyLabels: [],
    siblingInputs: [],
    navigationContext: null
  };
  
  // Find parent form
  const form = element.closest('form');
  if (form) {
    cluster.formContext = {
      id: form.id || null,
      name: form.name || null,
      action: form.action || null,
      ariaLabel: form.getAttribute('aria-label') || null,
      totalFields: form.querySelectorAll('input, select, textarea').length
    };
  }
  
  // Find parent section/article
  const section = element.closest('section, article, aside, nav, header, footer, main, [role]');
  if (section) {
    cluster.sectionContext = {
      tag: section.tagName.toLowerCase(),
      id: section.id || null,
      role: section.getAttribute('role') || null,
      ariaLabel: section.getAttribute('aria-label') || null,
      heading: section.querySelector('h1, h2, h3, h4, h5, h6')?.textContent?.trim() || null
    };
  }
  
  // Find nearby interactive elements
  const parent = element.parentElement;
  if (parent) {
    // Find sibling buttons
    const siblingButtons = Array.from(parent.querySelectorAll('button, [role="button"], input[type="submit"], input[type="button"]'))
      .filter(btn => btn !== element)
      .slice(0, 3)
      .map(btn => ({
        text: btn.textContent?.trim() || btn.value || '',
        type: btn.tagName.toLowerCase(),
        ariaLabel: btn.getAttribute('aria-label') || null
      }));
    cluster.nearbyButtons = siblingButtons;
    
    // Find sibling inputs (for form context)
    if (element.tagName === 'INPUT' || element.tagName === 'SELECT' || element.tagName === 'TEXTAREA') {
      const siblingInputs = Array.from(parent.querySelectorAll('input, select, textarea'))
        .filter(input => input !== element)
        .slice(0, 3)
        .map(input => ({
          type: input.type || input.tagName.toLowerCase(),
          name: input.name || null,
          placeholder: input.placeholder || null,
          label: input.labels?.[0]?.textContent?.trim() || null
        }));
      cluster.siblingInputs = siblingInputs;
    }
  }
  
  // Find nearby labels
  const nearbyLabels = [];
  
  // Check for associated label
  if (element.labels && element.labels.length > 0) {
    nearbyLabels.push(...Array.from(element.labels).map(label => label.textContent?.trim()));
  }
  
  // Check for aria-labelledby
  const labelledBy = element.getAttribute('aria-labelledby');
  if (labelledBy) {
    const labelElement = document.getElementById(labelledBy);
    if (labelElement) {
      nearbyLabels.push(labelElement.textContent?.trim());
    }
  }
  
  // Check for preceding label-like elements
  const prevSibling = element.previousElementSibling;
  if (prevSibling && ['LABEL', 'SPAN', 'DIV'].includes(prevSibling.tagName)) {
    const text = prevSibling.textContent?.trim();
    if (text && text.length < 50) {
      nearbyLabels.push(text);
    }
  }
  
  cluster.nearbyLabels = [...new Set(nearbyLabels)]; // Remove duplicates
  
  // Find navigation context
  const nav = element.closest('nav, [role="navigation"]');
  if (nav) {
    cluster.navigationContext = {
      ariaLabel: nav.getAttribute('aria-label') || null,
      totalLinks: nav.querySelectorAll('a').length,
      currentPage: nav.querySelector('[aria-current="page"]')?.textContent?.trim() || null
    };
  }
  
  return cluster;
}

// Get visual element properties
function getVisualProperties(element) {
  const rect = element.getBoundingClientRect();
  const styles = window.getComputedStyle(element);
  
  return {
    centerPoint: {
      x: Math.round(rect.left + rect.width / 2),
      y: Math.round(rect.top + rect.height / 2)
    },
    visualSize: {
      width: rect.width,
      height: rect.height,
      area: rect.width * rect.height
    },
    color: styles.color,
    backgroundColor: styles.backgroundColor,
    fontSize: styles.fontSize,
    fontWeight: styles.fontWeight,
    borderColor: styles.borderColor,
    isVisible: styles.display !== 'none' && styles.visibility !== 'hidden' && styles.opacity !== '0',
    zIndex: parseInt(styles.zIndex) || 0,
    cursor: styles.cursor,
    isInteractive: ['pointer', 'hand', 'move', 'text', 'crosshair'].includes(styles.cursor)
  };
}

// Get shadow DOM path for element
function getShadowPath(element) {
  const path = [];
  let node = element;
  
  while (node && node !== document) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      let selector = node.tagName.toLowerCase();
      if (node.id) {
        selector = `#${CSS.escape(node.id)}`;
      } else if (node.className && typeof node.className === 'string') {
        const classes = node.className.trim().split(/\s+/).filter(c => c);
        if (classes.length > 0) {
          selector += `.${classes[0]}`;
        }
      }
      path.unshift(selector);
    }
    
    // Check if we're crossing a shadow boundary
    if (node.parentNode && node.parentNode.toString() === '[object ShadowRoot]') {
      path.unshift('>>>'); // Shadow DOM piercing operator
      node = node.parentNode.host;
    } else {
      node = node.parentNode;
    }
  }
  
  return path.join(' ');
}

// Generate basic selector for parent elements
function generateBasicSelector(element) {
  if (element.id) return `#${element.id}`;
  if (element.className && typeof element.className === 'string') {
    const classes = element.className.trim().split(/\s+/).filter(c => c);
    if (classes.length > 0) return `.${classes[0]}`;
  }
  return element.tagName.toLowerCase();
}

// Prioritize elements by relevance
function prioritizeElements(elements) {
  return elements.map(el => {
    let score = 0;
    
    // In viewport gets highest priority
    if (isInViewport(el)) score += 100;
    
    // Interactive elements get high priority
    if (el.isButton || el.isInput || el.isLink) score += 50;
    
    // Elements with specific attributes
    if (el.attributes && (el.attributes['data-testid'] || el.attributes['aria-label'])) score += 30;
    
    // Elements with text content
    if (el.text && el.text.length > 0) score += 20;
    
    // Visible size matters
    if (el.position.width > 50 && el.position.height > 20) score += 10;
    
    return { ...el, relevanceScore: score };
  })
  .sort((a, b) => b.relevanceScore - a.relevanceScore);
}

// Perform DOM diffing to detect changes
function diffDOM(currentElements) {
  if (!previousDOMState) {
    previousDOMState = new Map();
    currentElements.forEach(el => {
      previousDOMState.set(hashElement(el), el);
    });
    return { changed: currentElements, unchanged: [] };
  }
  
  const changed = [];
  const unchanged = [];
  const currentHashes = new Map();
  
  currentElements.forEach(el => {
    const hash = hashElement(el);
    currentHashes.set(hash, el);
    
    if (!previousDOMState.has(hash)) {
      changed.push(el);
    } else {
      unchanged.push(el);
    }
  });
  
  // Update cache
  previousDOMState = currentHashes;
  
  return { changed, unchanged };
}

// Extract relevant HTML markup for AI context
function extractRelevantHTML() {
  // Get interactive and important elements with their HTML context
  const relevantSelectors = [
    'button', 'input', 'textarea', 'select', 'a[href]', 
    'form', '[role="button"]', '[role="link"]', '[onclick]',
    '[data-testid]', '[aria-label]', '.btn', '.button',
    'nav', 'header', 'main', 'section[class*="search"]',
    '[class*="login"]', '[class*="submit"]', '[class*="search"]'
  ];
  
  const relevantElements = [];
  const seenElements = new Set();
  
  relevantSelectors.forEach(selector => {
    try {
      const elements = document.querySelectorAll(selector);
      elements.forEach((element, index) => {
        // Avoid duplicates
        const elementKey = `${element.tagName}-${element.className}-${element.id}-${index}`;
        if (seenElements.has(elementKey)) return;
        seenElements.add(elementKey);
        
        // Skip invisible elements
        const rect = element.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;
        
        // Extract and compress the element HTML
        let elementHTML = element.outerHTML;
        
        // Compress HTML - remove unnecessary attributes and whitespace
        if (elementHTML) {
          // Remove style attributes
          elementHTML = elementHTML.replace(/\sstyle="[^"]*"/g, '');
          // Remove data- attributes except data-testid
          elementHTML = elementHTML.replace(/\sdata-(?!testid)[^=]*="[^"]*"/g, '');
          // Remove class attributes with long values
          elementHTML = elementHTML.replace(/\sclass="[^"]{100,}"/g, ' class="[long-class]"');
          // Remove excess whitespace
          elementHTML = elementHTML.replace(/\s+/g, ' ').trim();
        }
        
        // Smart truncation to preserve important context while preventing token overflow
        let truncatedHTML = elementHTML;
        if (elementHTML.length > 1000) {
          // Try to find a good breaking point
          const breakPoints = [
            elementHTML.lastIndexOf('>', 900),  // End of a tag
            elementHTML.lastIndexOf(' ', 950),  // End of a word
            900  // Hard cutoff
          ];
          const breakPoint = Math.max(...breakPoints.filter(p => p > 0));
          truncatedHTML = elementHTML.substring(0, breakPoint) + '...';
        }
        
        relevantElements.push({
          selector: generateSelector(element),
          html: truncatedHTML,
          text: element.innerText?.trim().substring(0, 200),  // Increased from 100 to 200 for better context
          tag: element.tagName.toLowerCase(),
          position: {
            x: Math.round(rect.left),
            y: Math.round(rect.top)
          }
        });
      });
    } catch (error) {
      console.warn(`Error processing selector ${selector}:`, error);
    }
  });
  
  // Get comprehensive page structure context
  const pageStructure = {
    title: document.title,
    url: window.location.href,
    domain: window.location.hostname,
    pathname: window.location.pathname,
    // Meta information
    meta: {
      description: document.querySelector('meta[name="description"]')?.content || '',
      keywords: document.querySelector('meta[name="keywords"]')?.content || '',
      viewport: document.querySelector('meta[name="viewport"]')?.content || '',
      ogTitle: document.querySelector('meta[property="og:title"]')?.content || '',
      ogDescription: document.querySelector('meta[property="og:description"]')?.content || ''
    },
    // All forms with detailed structure
    forms: Array.from(document.forms).map((form, idx) => ({
      id: form.id || `form_${idx}`,
      name: form.name,
      action: form.action,
      method: form.method,
      fields: Array.from(form.elements).map(field => ({
        type: field.type,
        name: field.name,
        id: field.id,
        placeholder: field.placeholder,
        required: field.required,
        value: field.type === 'password' ? '[hidden]' : field.value
      })),
      html: (() => {
        let html = form.outerHTML;
        // Compress form HTML
        html = html.replace(/\sstyle="[^"]*"/g, '');
        html = html.replace(/\sdata-(?!testid)[^=]*="[^"]*"/g, '');
        html = html.replace(/\s+/g, ' ').trim();
        return html.length > 400 ? html.substring(0, 400) + '...' : html;
      })()
    })),
    // Page headings for structure understanding
    headings: Array.from(document.querySelectorAll('h1, h2, h3, h4')).slice(0, 20).map(h => ({
      level: h.tagName,
      text: h.innerText?.trim(),
      id: h.id,
      html: h.outerHTML.replace(/\sstyle="[^"]*"/g, '').replace(/\s+/g, ' ').trim()
    })),
    // Navigation elements
    navigation: Array.from(document.querySelectorAll('nav, [role="navigation"]')).map(nav => ({
      role: nav.getAttribute('role'),
      ariaLabel: nav.getAttribute('aria-label'),
      linksCount: nav.querySelectorAll('a').length,
      links: Array.from(nav.querySelectorAll('a')).slice(0, 10).map(link => ({
        text: link.textContent?.trim(),
        href: link.href,
        target: link.target
      }))
    })),
    // Iframe detection
    iframes: Array.from(document.querySelectorAll('iframe')).map(iframe => ({
      src: iframe.src,
      id: iframe.id,
      name: iframe.name,
      title: iframe.title
    })),
    // Current focus
    activeElement: document.activeElement ? {
      tag: document.activeElement.tagName,
      id: document.activeElement.id,
      type: document.activeElement.type
    } : null
  };
  
  // Dynamic element limit based on page complexity and element quality
  const maxElementsToSend = Math.min(
    Math.max(150, Math.floor(relevantElements.length * 0.3)), // At least 150, or 30% of found elements
    500 // Hard cap at 500 to prevent token overflow
  );
  
  return {
    relevantElements: relevantElements.slice(0, maxElementsToSend),
    pageStructure,
    totalElementsFound: relevantElements.length,
    elementsSent: Math.min(maxElementsToSend, relevantElements.length)
  };
}

/**
 * Generates a reliable CSS selector for a DOM element
 * @param {Element} element - The DOM element to generate a selector for
 * @returns {string} A CSS selector string that can uniquely identify the element
 */
function generateSelector(element) {
  // Prefer ID
  if (element.id) {
    return `#${element.id}`;
  }
  
  // Try data-testid
  if (element.getAttribute('data-testid')) {
    return `[data-testid="${element.getAttribute('data-testid')}"]`;
  }
  
  // Try aria-label
  if (element.getAttribute('aria-label')) {
    return `[aria-label="${element.getAttribute('aria-label')}"]`;
  }
  
  // Try name attribute for inputs
  if (element.name) {
    return `${element.tagName.toLowerCase()}[name="${element.name}"]`;
  }
  
  // Use class if available and not too generic
  if (element.className && typeof element.className === 'string') {
    const classes = element.className.trim().split(/\s+/);
    const specificClass = classes.find(cls => 
      cls.length > 2 && 
      !['active', 'show', 'hide', 'disabled'].includes(cls.toLowerCase())
    );
    if (specificClass) {
      return `.${specificClass}`;
    }
  }
  
  // Fall back to tag with text content for buttons and links
  if (['button', 'a'].includes(element.tagName.toLowerCase()) && element.innerText) {
    const text = element.innerText.trim().substring(0, 20);
    return `${element.tagName.toLowerCase()}:contains("${text}")`;
  }
  
  // Last resort: tag name with nth-child
  const parent = element.parentElement;
  if (parent) {
    const siblings = Array.from(parent.children).filter(child => 
      child.tagName === element.tagName
    );
    const index = siblings.indexOf(element) + 1;
    return `${element.tagName.toLowerCase()}:nth-child(${index})`;
  }
  
  return element.tagName.toLowerCase();
}

/**
 * Extracts and structures DOM information for AI processing
 * @param {Object} options - Configuration options for DOM extraction
 * @param {boolean} options.useDiffing - Whether to use DOM diffing for optimization
 * @param {boolean} options.prioritizeViewport - Whether to prioritize visible elements
 * @param {number} options.maxElements - Maximum number of elements to extract
 * @param {boolean} options.includeAllAttributes - Whether to include all element attributes
 * @param {boolean} options.includeComputedStyles - Whether to include computed styles
 * @returns {Object} Structured DOM representation with elements, context, and metadata
 */
function getStructuredDOM(options = {}) {
  const { 
    useDiffing = false, // Disable diffing to get full context
    prioritizeViewport = false, // Send all elements, not just viewport
    maxElements = 2000, // Increased limit for comprehensive context
    includeAllAttributes = true, // Include all element attributes
    includeComputedStyles = true // Include visibility and display info
  } = options;
  
  const elements = [];
  let elementCount = 0;
  
  // Also extract raw HTML for better context
  const relevantHTML = extractRelevantHTML();
  
  function traverse(node, depth = 0) {
    if (elementCount >= maxElements || depth > 10) return;
    
    try {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const rect = node.getBoundingClientRect();
        
        // Skip truly invisible elements but preserve semantic ones
        const isSemanticElement = ['LABEL', 'LEGEND', 'FIELDSET', 'FORM', 'SECTION', 'NAV', 'HEADER', 'FOOTER', 'MAIN', 'ASIDE'].includes(node.tagName);
        const hasImportantAttributes = node.hasAttribute('aria-label') || node.hasAttribute('data-testid') || node.hasAttribute('role');
        const isHiddenButImportant = node.type === 'hidden' || node.style.position === 'absolute';
        
        if (rect.width === 0 && rect.height === 0 && !isSemanticElement && !hasImportantAttributes && !isHiddenButImportant) {
          return;
        }
      
      // Extract element data with comprehensive context
      const semanticId = generateSemanticElementId(node, elementCount);
      
      // Log semantic ID generation for debugging
      if (node.tagName === 'BUTTON' || node.tagName === 'A' || node.tagName === 'INPUT') {
        console.log('[FSB Semantic ID]', node.tagName, 'generated ID:', semanticId, 'from:', {
          id: node.id,
          'aria-label': node.getAttribute('aria-label'),
          'data-testid': node.getAttribute('data-testid'),
          text: node.textContent?.trim()?.substring(0, 30)
        });
      }
      
      const elementData = {
        // Unique element identifier with semantic naming
        elementId: semanticId,
        type: node.tagName.toLowerCase(),
        // Human-readable description
        description: generateElementDescription(node),
        // Visual properties for better understanding
        visualProperties: getVisualProperties(node),
        // Shadow DOM context
        inShadowDOM: isInShadowDOM(node),
        shadowPath: isInShadowDOM(node) ? getShadowPath(node) : null,
        text: node.innerText?.trim() || node.textContent?.trim() || '',
        id: node.id || '',
        class: node.className ? String(node.className) : '',
        position: {
          x: Math.round(rect.left),
          y: Math.round(rect.top),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          inViewport: isElementInViewport(rect)
        },
        attributes: {},
        // Add all data attributes
        dataAttributes: {},
        // Add computed visibility
        visibility: {
          display: window.getComputedStyle(node).display,
          visibility: window.getComputedStyle(node).visibility,
          opacity: window.getComputedStyle(node).opacity,
          zIndex: window.getComputedStyle(node).zIndex
        },
        // Add interaction states
        interactionState: {
          disabled: node.disabled || false,
          readonly: node.readOnly || false,
          checked: node.checked || false,
          selected: node.selected || false,
          focused: document.activeElement === node
        },
        // Generate multiple selectors with stability scores
        selectors: (() => {
          const selectorData = generateSelectors(node, semanticId);
          elementData._selectorScores = selectorData; // Store scores for later use
          return selectorData.map(s => s.selector); // Return just the selector strings
        })(),
        // Element clustering for better context
        cluster: getElementCluster(node),
        // Enhanced context information
        context: {
          // Associated label text (for inputs)
          labelText: (() => {
            if (node.tagName === 'INPUT' || node.tagName === 'TEXTAREA' || node.tagName === 'SELECT') {
              // Look for associated label
              const labelElement = node.id ? document.querySelector(`label[for="${node.id}"]`) : 
                                 node.closest('label') || 
                                 node.parentElement?.querySelector('label');
              return labelElement ? labelElement.textContent?.trim() : null;
            }
            return null;
          })(),
          // Form association
          formId: node.form ? (node.form.id || node.form.name || 'form_' + Array.from(document.forms).indexOf(node.form)) : null,
          // Parent container context
          parentContext: node.parentElement ? {
            tag: node.parentElement.tagName,
            class: node.parentElement.className,
            role: node.parentElement.getAttribute('role'),
            'aria-label': node.parentElement.getAttribute('aria-label')
          } : null,
          // Placeholder or hint text
          hintText: node.placeholder || node.title || node.getAttribute('aria-describedby') ? 
                   document.getElementById(node.getAttribute('aria-describedby'))?.textContent?.trim() : null
        }
      };
      
      // Special handling for different element types with safety checks
      if (node.tagName === 'INPUT') {
        elementData.inputType = node.type || '';
        elementData.placeholder = node.placeholder || '';
        elementData.value = node.value || '';
        elementData.isInput = true;
      } else if (node.tagName === 'BUTTON') {
        elementData.isButton = true;
      } else if (node.tagName === 'A') {
        elementData.href = node.href || '';
        elementData.isLink = true;
      } else if (node.tagName === 'IMG') {
        elementData.src = node.src || '';
        elementData.alt = node.alt || '';
        elementData.isImage = true;
      }
      
      // Check for CAPTCHA - safely handle className
      const classNames = node.className ? String(node.className) : '';
      if (classNames.includes('g-recaptcha') || classNames.includes('recaptcha')) {
        elementData.isCaptcha = true;
      }
      
      // Add ALL attributes
      if (includeAllAttributes) {
        Array.from(node.attributes).forEach(attr => {
          elementData.attributes[attr.name] = attr.value;
          // Separate data attributes
          if (attr.name.startsWith('data-')) {
            elementData.dataAttributes[attr.name] = attr.value;
          }
        });
      } else {
        // Add useful attributes
        ['data-testid', 'aria-label', 'name', 'role', 'type', 'value', 'placeholder', 'title', 'alt'].forEach(attr => {
          if (node.getAttribute(attr)) {
            elementData.attributes[attr] = node.getAttribute(attr);
          }
        });
      }
      
      // Add form relationships
      if (node.form) {
        elementData.formId = node.form.id || `form_${Array.from(document.forms).indexOf(node.form)}`;
      }
      
      // Add label associations
      if (node.labels && node.labels.length > 0) {
        elementData.labelText = Array.from(node.labels).map(l => l.textContent?.trim()).join(' ');
      }
      
      elements.push(elementData);
      elementCount++;
      
        // Traverse children
        for (const child of node.children) {
          traverse(child, depth + 1);
        }
        
        // Traverse shadow DOM if present
        if (node.shadowRoot && node.shadowRoot.mode === 'open') {
          console.log('[FSB Shadow DOM] Found open shadow root on:', node.tagName, node.id || node.className);
          
          // Add shadow DOM indicator to parent element
          elementData.hasShadowRoot = true;
          elementData.shadowRootMode = 'open';
          
          // Traverse shadow DOM children
          for (const shadowChild of node.shadowRoot.children) {
            traverse(shadowChild, depth + 1);
          }
        }
      }
    } catch (error) {
      console.warn('Error processing DOM node:', error, node);
      // Continue processing other nodes even if one fails
    }
  }
  
  traverse(document.body);
  
  // Apply optimizations
  let processedElements = elements;
  
  // Apply viewport prioritization
  if (prioritizeViewport) {
    processedElements = prioritizeElements(processedElements);
    // Take top elements based on relevance
    processedElements = processedElements.slice(0, maxElements);
  }
  
  // Apply DOM diffing
  let elementsToSend = processedElements;
  if (useDiffing) {
    const { changed, unchanged } = diffDOM(processedElements);
    // Include all changed elements plus a sample of unchanged important ones
    // Dynamic limits for unchanged elements based on page complexity
    const unchangedLimit = Math.min(
      Math.max(100, Math.floor(unchanged.length * 0.2)), // At least 100, or 20% of unchanged
      200 // Hard cap at 200 unchanged elements
    );
    
    const importantUnchanged = unchanged
      .filter(el => el.isButton || el.isInput || el.isLink || isInViewport(el))
      .slice(0, unchangedLimit);
    elementsToSend = [...changed, ...importantUnchanged];
  }
  
  // Build the base DOM structure
  const domStructure = {
    elements: elementsToSend,
    htmlContext: relevantHTML, // Add HTML context for better AI understanding
    scrollPosition: {
      x: window.scrollX,
      y: window.scrollY
    },
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight
    },
    url: window.location.href,
    title: document.title,
    captchaPresent: elements.some(el => el.isCaptcha),
    timestamp: Date.now(),
    optimization: {
      totalElements: elements.length,
      sentElements: elementsToSend.length,
      usedDiffing: useDiffing,
      usedViewportPriority: prioritizeViewport
    }
  };
  
  // Use DOM State Manager for intelligent diffing if available
  if (domStateManager && options.useIncrementalDiff !== false) {
    console.log('[FSB DOM Optimization] ===== DOM CAPTURE =====');
    console.log('[FSB DOM Optimization] Using DOM State Manager for optimized payload');
    console.log('[FSB DOM Optimization] Total elements found:', elements.length);
    console.log('[FSB DOM Optimization] Elements after filtering:', elementsToSend.length);
    
    const optimizedPayload = domStateManager.generateOptimizedPayload(domStructure);
    
    // Add optimization metadata
    domStructure.optimization.diffType = optimizedPayload.type;
    domStructure.optimization.deltaSize = JSON.stringify(optimizedPayload).length;
    domStructure.optimization.fullSize = JSON.stringify(domStructure).length;
    domStructure.optimization.compressionRatio = 
      (domStructure.optimization.fullSize - domStructure.optimization.deltaSize) / domStructure.optimization.fullSize;
    
    // Verbose logging
    console.log('[FSB DOM Optimization] Mode:', optimizedPayload.type.toUpperCase());
    console.log('[FSB DOM Optimization] Original DOM size:', domStructure.optimization.fullSize.toLocaleString(), 'bytes');
    console.log('[FSB DOM Optimization] Optimized size:', domStructure.optimization.deltaSize.toLocaleString(), 'bytes');
    console.log('[FSB DOM Optimization] Compression ratio:', (domStructure.optimization.compressionRatio * 100).toFixed(1) + '%');
    console.log('[FSB DOM Optimization] Savings:', (domStructure.optimization.fullSize - domStructure.optimization.deltaSize).toLocaleString(), 'bytes');
    
    // Log the raw payload (truncated for very large payloads)
    const payloadStr = JSON.stringify(optimizedPayload, null, 2);
    if (payloadStr.length > 5000) {
      console.log('[FSB DOM Optimization] RAW PAYLOAD (truncated to 5000 chars):');
      console.log(payloadStr.substring(0, 5000) + '\n... [TRUNCATED]');
    } else {
      console.log('[FSB DOM Optimization] RAW PAYLOAD:');
      console.log(payloadStr);
    }
    
    // Return optimized payload
    return {
      ...domStructure,
      ...optimizedPayload,
      _isDelta: true
    };
  }
  
  // Log full DOM capture
  // Apply compact serialization for better performance
  const useCompactFormat = options.useCompactFormat !== false;
  
  if (useCompactFormat && elementsToSend.length > 50) {
    console.log('[FSB DOM Optimization] Using compact serialization format');
    const serializer = new OptimizedDOMSerializer();
    const compactPayload = serializer.serialize(elementsToSend);
    
    // Calculate compression metrics
    const originalSize = JSON.stringify(elementsToSend).length;
    const compactSize = JSON.stringify(compactPayload).length;
    const compressionRatio = serializer.getCompressionRatio(elementsToSend, compactPayload);
    
    console.log('[FSB DOM Optimization] ===== COMPACT SERIALIZATION =====');
    console.log('[FSB DOM Optimization] Original size:', originalSize.toLocaleString(), 'bytes');
    console.log('[FSB DOM Optimization] Compact size:', compactSize.toLocaleString(), 'bytes');
    console.log('[FSB DOM Optimization] Compression:', (compressionRatio * 100).toFixed(1) + '%');
    console.log('[FSB DOM Optimization] String table size:', compactPayload.strings.length);
    
    // Return compact format
    return {
      ...domStructure,
      elements: compactPayload.elements,
      stringTable: compactPayload.strings,
      format: 'compact',
      version: compactPayload.version,
      optimization: {
        ...domStructure.optimization,
        compressionRatio,
        originalSize,
        compactSize
      }
    };
  }
  
  console.log('[FSB DOM Optimization] ===== FULL DOM CAPTURE (No optimization) =====');
  console.log('[FSB DOM Optimization] Total elements:', elements.length);
  console.log('[FSB DOM Optimization] Sent elements:', elementsToSend.length);
  console.log('[FSB DOM Optimization] Payload size:', JSON.stringify(domStructure).length.toLocaleString(), 'bytes');
  
  return domStructure;
}

// Async message handler with timeout support
async function handleAsyncMessage(request, sendResponse) {
  console.log('[FSB Content] Handling async message:', request.action);
  
  try {
    let result;
    const startTime = Date.now();
    
    switch (request.action) {
      case 'getDOM':
        console.log('[FSB Content] Getting DOM structure...');
        // Enable incremental diff by default, can be disabled via request options
        const domOptions = {
          ...request.options,
          useIncrementalDiff: request.options?.useIncrementalDiff !== false
        };
        result = getStructuredDOM(domOptions);
        console.log('[FSB Content] DOM structure obtained in', Date.now() - startTime, 'ms');
        if (result._isDelta) {
          console.log('[FSB Content] Using delta diff - compression ratio:', 
            (result.optimization?.compressionRatio * 100).toFixed(1) + '%');
        }
        sendResponse({ success: true, structuredDOM: result });
        break;
        
      case 'executeAction':
        const { tool, params } = request;
        console.log(`[FSB Content] Executing ${tool} action with params:`, params);
        
        if (tools[tool]) {
          // Add timeout wrapper for long-running operations
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error(`Action ${tool} timed out after 10 seconds`)), 10000);
          });
          
          const actionPromise = tools[tool](params);
          result = await Promise.race([actionPromise, timeoutPromise]);
          
          console.log(`[FSB Content] Action ${tool} completed in ${Date.now() - startTime}ms, result:`, result);
          
          // Validate result structure
          if (result === undefined || result === null) {
            console.warn(`[FSB Content] Action ${tool} returned null/undefined result`);
            sendResponse({ 
              success: false, 
              error: `Action ${tool} returned no result`,
              tool: tool,
              executionTime: Date.now() - startTime
            });
          } else {
            sendResponse({ 
              success: true, 
              result: result,
              tool: tool,
              executionTime: Date.now() - startTime
            });
          }
        } else {
          console.error(`[FSB Content] Unknown tool: ${tool}`);
          sendResponse({ success: false, error: `Unknown tool: ${tool}` });
        }
        break;
        
      default:
        console.error(`[FSB Content] Unknown async action: ${request.action}`);
        sendResponse({ success: false, error: `Unknown action: ${request.action}` });
    }
  } catch (error) {
    console.error(`[FSB Content] Error in async message handler:`, error);
    sendResponse({ 
      success: false, 
      error: error.message || 'Unknown error in async handler',
      stack: error.stack,
      action: request.action,
      executionTime: Date.now() - (request.startTime || Date.now())
    });
  }
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Content script received message:', request.action);
  
  // Handle async operations properly by returning true to keep message channel open
  if (request.action === 'executeAction' || request.action === 'getDOM') {
    handleAsyncMessage(request, sendResponse);
    return true; // Keep message channel open for async response
  }
  
  switch (request.action) {
    case 'healthCheck':
      sendResponse({ success: true, healthy: true, timestamp: Date.now() });
      break;
      
    case 'getDOM':
      // This case is now handled above in async handler
      break;
      
    case 'executeAction':
      // This case is now handled above in async handler
      break;
      
    case 'highlightElement':
      try {
        const element = document.querySelector(request.selector);
        if (element) {
          element.style.outline = '3px solid red';
          setTimeout(() => {
            element.style.outline = '';
          }, 2000);
          sendResponse({ success: true });
        } else {
          sendResponse({ success: false, error: 'Element not found' });
        }
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
      break;
      
    default:
      sendResponse({ error: 'Unknown action' });
  }
  
  // Return true to indicate we'll send response asynchronously (needed for await)
  return true;
});

// Intelligent DOM change filtering
let lastNotificationTime = 0;
let accumulatedChanges = 0;
let significantChangeTimeout = null;

// Helper to check if mutation is significant
function isSignificantMutation(mutation) {
  // Ignore pure style changes
  if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
    return false;
  }
  
  // Ignore changes to invisible elements
  if (mutation.target.nodeType === Node.ELEMENT_NODE) {
    const styles = window.getComputedStyle(mutation.target);
    if (styles.display === 'none' || styles.visibility === 'hidden') {
      return false;
    }
  }
  
  // Ignore changes in script/style tags
  if (mutation.target.tagName === 'SCRIPT' || mutation.target.tagName === 'STYLE') {
    return false;
  }
  
  // Ignore attribute changes on non-interactive elements
  if (mutation.type === 'attributes' && 
      !['INPUT', 'BUTTON', 'A', 'SELECT', 'TEXTAREA'].includes(mutation.target.tagName)) {
    const importantAttrs = ['id', 'class', 'data-testid', 'aria-label', 'href', 'src'];
    if (!importantAttrs.includes(mutation.attributeName)) {
      return false;
    }
  }
  
  return true;
}

// Set up mutation observer for dynamic content
const observer = new MutationObserver((mutations) => {
  // Filter out insignificant mutations
  const significantMutations = mutations.filter(isSignificantMutation);
  
  if (significantMutations.length === 0) return;
  
  accumulatedChanges += significantMutations.length;
  
  // Clear existing timeout
  if (significantChangeTimeout) {
    clearTimeout(significantChangeTimeout);
  }
  
  // Batch DOM change notifications
  significantChangeTimeout = setTimeout(() => {
    const now = Date.now();
    const timeSinceLastNotification = now - lastNotificationTime;
    
    // Only notify if we have significant changes and enough time has passed
    if (accumulatedChanges > 5 && timeSinceLastNotification > 1000) {
      console.log('[FSB DOM Monitor] Significant changes detected:', accumulatedChanges);
      
      chrome.runtime.sendMessage({
        action: 'domChanged',
        changeCount: accumulatedChanges,
        significantChanges: true
      });
      
      lastNotificationTime = now;
      accumulatedChanges = 0;
    }
  }, 500); // Wait 500ms to batch changes
});

// Start observing
observer.observe(document.body, {
  childList: true,
  subtree: true,
  attributes: true
});

console.log('FSB v0.1 content script loaded');