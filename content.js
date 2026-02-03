// Content script for FSB v0.9
// Handles DOM reading and action execution

// Double-injection protection - exit early if already loaded
if (window.__FSB_CONTENT_SCRIPT_LOADED__) {
  console.log('[FSB Content] Already loaded, skipping duplicate injection');
  // But still try to reconnect port if it was lost
  if (typeof establishBackgroundConnection === 'function' && !backgroundPort) {
    establishBackgroundConnection();
  }
  // Exit early to prevent duplicate listeners and state
  throw new Error('FSB_ALREADY_LOADED');
}
window.__FSB_CONTENT_SCRIPT_LOADED__ = true;

// Current session ID for logging (set by background.js messages)
let currentSessionId = null;

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
    
    // PERFORMANCE: Observe with optimized config using attributeFilter
    // Only track attributes that actually matter for automation
    this.mutationObserver.observe(document.body, {
      childList: true,
      attributes: true,
      attributeOldValue: true,
      characterData: false, // Ignore text node changes (reduces callback noise)
      subtree: true,
      // PERFORMANCE: Only observe attributes that affect automation decisions
      attributeFilter: [
        'class', 'style', 'disabled', 'readonly', 'hidden',
        'aria-hidden', 'aria-expanded', 'aria-selected', 'aria-checked', 'aria-pressed',
        'aria-label', 'aria-describedby', 'aria-busy',
        'value', 'checked', 'selected', 'href', 'src', 'data-state',
        'data-testid', 'data-test-id', 'role', 'tabindex', 'contenteditable'
      ]
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
   * PERFORMANCE FIX: Compare delta vs full size and use smaller one
   */
  generateOptimizedPayload(currentDOM) {
    automationLogger.logDOMOperation(currentSessionId, 'compute_diff', { phase: 'start' });
    const diff = this.computeDiff(currentDOM);

    // Log diff statistics
    automationLogger.logDOMOperation(currentSessionId, 'diff_computed', {
      isInitial: diff.isInitial || false,
      added: diff.added.length,
      removed: diff.removed.length,
      modified: diff.modified.length,
      unchanged: diff.unchanged.length,
      changeRatio: (diff.metadata.changeRatio * 100).toFixed(1) + '%'
    });

    // For initial load, return filtered full DOM
    if (diff.isInitial) {
      automationLogger.logDOMOperation(currentSessionId, 'initial_capture', { reason: 'no_previous_state' });
      const payload = {
        type: 'initial',
        elements: this.filterAndCompressElements(diff.added),
        htmlContext: this.compressHTMLContext(currentDOM.htmlContext),
        metadata: {
          totalElements: diff.metadata.totalElements,
          includedElements: diff.added.length
        }
      };
      automationLogger.logDOMOperation(currentSessionId, 'initial_payload', { elementCount: payload.elements.length });
      return payload;
    }

    // PERFORMANCE FIX: Build both delta and compact full payloads, use smaller one
    // Build delta payload
    const deltaPayload = {
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
      deltaPayload.htmlContext = this.compressHTMLContext(currentDOM.htmlContext);
    }

    // Build compact full payload (just essential elements for AI)
    const compactFullPayload = {
      type: 'compact_full',
      elements: this.filterAndCompressElements(
        (currentDOM.elements || [])
          .filter(el => el.position?.inViewport || el.isButton || el.isInput || el.isLink)
          .slice(0, 100), // Limit to top 100 most relevant elements
        false
      ),
      htmlContext: this.compressHTMLContext(currentDOM.htmlContext),
      metadata: {
        totalElements: currentDOM.elements?.length || 0,
        includedElements: Math.min(100, currentDOM.elements?.length || 0)
      }
    };

    // Compare sizes and use smaller payload
    const deltaSize = JSON.stringify(deltaPayload).length;
    const compactFullSize = JSON.stringify(compactFullPayload).length;

    automationLogger.logDOMOperation(currentSessionId, 'payload_comparison', {
      deltaSize,
      compactFullSize,
      winner: deltaSize < compactFullSize ? 'DELTA' : 'COMPACT_FULL',
      savings: Math.abs(deltaSize - compactFullSize)
    });

    // Use whichever is smaller (with 20% margin to prefer delta for consistency)
    if (deltaSize < compactFullSize * 0.8) {
      automationLogger.logDOMOperation(currentSessionId, 'using_delta', { reason: 'smaller_payload' });
      return deltaPayload;
    } else {
      automationLogger.logDOMOperation(currentSessionId, 'using_compact_full', { reason: 'smaller_or_similar' });
      return compactFullPayload;
    }
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

/**
 * Check if the document is fully ready for interaction
 * Provides detailed readiness state for smart page load detection
 * @returns {Object} Readiness state with details
 */
function checkDocumentReady() {
  const state = {
    readyState: document.readyState,
    isComplete: document.readyState === 'complete',
    isInteractive: document.readyState !== 'loading',
    hasBody: !!document.body,
    bodyHasContent: document.body?.children?.length > 0,

    // Check for common loading indicators
    isLoading: !!document.querySelector(
      '[class*="loading"], [class*="spinner"], [aria-busy="true"], ' +
      '.loader, .skeleton, [data-loading="true"], .is-loading, ' +
      '.MuiCircularProgress-root, .ant-spin, .el-loading-mask'
    ),

    // Check for blocking overlays
    hasBlockingOverlay: false,

    // Network activity (if Performance API available)
    pendingResources: 0,

    // Additional context
    url: window.location.href,
    timestamp: Date.now()
  };

  // Check for visible blocking overlays
  const overlaySelectors = [
    '.overlay:not([style*="display: none"]):not([style*="display:none"])',
    '.modal-backdrop:not([style*="display: none"])',
    '[class*="loading-overlay"]:not([style*="display: none"])',
    '.loading-mask:not([style*="display: none"])',
    '[class*="page-loader"]:not([style*="display: none"])'
  ];

  for (const selector of overlaySelectors) {
    try {
      const overlay = document.querySelector(selector);
      if (overlay) {
        const rect = overlay.getBoundingClientRect();
        const styles = window.getComputedStyle(overlay);
        // Only count as blocking if visible and covers significant area
        if (rect.width > 100 && rect.height > 100 &&
            styles.display !== 'none' &&
            styles.visibility !== 'hidden' &&
            parseFloat(styles.opacity) > 0.1) {
          state.hasBlockingOverlay = true;
          break;
        }
      }
    } catch (e) {
      // Ignore selector errors
    }
  }

  // Check for pending resources via Performance API
  if (window.performance && window.performance.getEntriesByType) {
    try {
      const resources = window.performance.getEntriesByType('resource');
      // Count resources that haven't finished loading
      state.pendingResources = resources.filter(r =>
        r.responseEnd === 0 || r.duration === 0
      ).length;
    } catch (e) {
      // Performance API might not be available
    }
  }

  // Determine overall readiness
  state.isReady = state.isComplete &&
                  state.hasBody &&
                  state.bodyHasContent &&
                  !state.isLoading &&
                  !state.hasBlockingOverlay;

  return state;
}

// Legacy DOM state cache for backward compatibility
let previousDOMState = null;
let domStateCache = new Map();

// ============================================================================
// IFRAME SUPPORT - Detect if running in iframe and manage cross-frame comms
// ============================================================================

// Detect if content script is running inside an iframe
const isInIframe = window !== window.top;
const frameId = isInIframe ? `frame_${Math.random().toString(36).substr(2, 9)}` : 'main';

// Frame context for communicating iframe hierarchy
const frameContext = {
  isIframe: isInIframe,
  frameId: frameId,
  frameOrigin: window.location.origin,
  frameSrc: window.location.href,
  parentOrigin: null,
  isCrossOrigin: false
};

// Try to get parent origin (will fail for cross-origin iframes)
if (isInIframe) {
  try {
    frameContext.parentOrigin = window.parent.location.origin;
    frameContext.isCrossOrigin = false;
  } catch (e) {
    // Cross-origin iframe - can't access parent
    frameContext.isCrossOrigin = true;
    automationLogger.logInit('content_script', 'cross_origin_iframe', { url: window.location.href });
  }
}

// Log frame context on initialization
if (isInIframe) {
  automationLogger.logInit('content_script', 'iframe_loaded', frameContext);
} else {
  automationLogger.logInit('content_script', 'main_frame_loaded', {});
}

// Generate frame-aware selector prefix for elements in iframes
function getFrameAwareSelector(selector) {
  if (!isInIframe) {
    return selector;
  }

  // Create a unique frame identifier for the selector
  // Format: iframe[src*="domain"] >>> selector
  try {
    const frameUrl = new URL(window.location.href);
    const frameDomain = frameUrl.hostname;
    const framePathPart = frameUrl.pathname.split('/').slice(0, 2).join('/');

    // Use CSS-like syntax for frame-aware selectors
    return `iframe[src*="${frameDomain}${framePathPart}"] >>> ${selector}`;
  } catch (e) {
    // Fallback to simple frame identifier
    return `[data-fsb-frame="${frameId}"] >>> ${selector}`;
  }
}

// Handle messages from parent frame for coordinated DOM extraction
window.addEventListener('message', (event) => {
  // Only process FSB-specific messages
  if (!event.data || event.data.type !== 'FSB_FRAME_REQUEST') {
    return;
  }

  const { action, requestId } = event.data;

  if (action === 'getFrameDOM') {
    // Parent is requesting this frame's DOM
    try {
      const domData = getStructuredDOM({
        maxElements: 500, // Limit elements per frame
        prioritizeViewport: true
      });

      // Add frame context to response
      domData.frameContext = frameContext;

      // Prefix all selectors with frame context
      if (domData.elements) {
        domData.elements = domData.elements.map(el => ({
          ...el,
          selectors: el.selectors?.map(sel => getFrameAwareSelector(sel)) || [],
          _frameId: frameId
        }));
      }

      // Send response back to parent
      window.parent.postMessage({
        type: 'FSB_FRAME_RESPONSE',
        requestId: requestId,
        success: true,
        data: domData
      }, '*');
    } catch (error) {
      window.parent.postMessage({
        type: 'FSB_FRAME_RESPONSE',
        requestId: requestId,
        success: false,
        error: error.message
      }, '*');
    }
  }
});

// Collect DOM from child iframes (only run in main frame)
async function collectChildFramesDom(timeout = 3000) {
  if (isInIframe) {
    // Child frames don't collect from other frames
    return [];
  }

  const iframes = document.querySelectorAll('iframe');
  if (iframes.length === 0) {
    return [];
  }

  automationLogger.logDOMOperation(currentSessionId, 'collect_iframes', { iframeCount: iframes.length });

  const framePromises = [];
  const pendingRequests = new Map();

  // Set up message listener for responses
  const responseHandler = (event) => {
    if (event.data?.type === 'FSB_FRAME_RESPONSE') {
      const { requestId, success, data, error } = event.data;
      const resolver = pendingRequests.get(requestId);
      if (resolver) {
        resolver({ success, data, error });
        pendingRequests.delete(requestId);
      }
    }
  };

  window.addEventListener('message', responseHandler);

  for (const iframe of iframes) {
    const requestId = `req_${Math.random().toString(36).substr(2, 9)}`;

    // Create promise for this iframe's response
    const framePromise = new Promise((resolve) => {
      pendingRequests.set(requestId, resolve);

      // Set timeout for this frame
      setTimeout(() => {
        if (pendingRequests.has(requestId)) {
          pendingRequests.delete(requestId);
          resolve({ success: false, error: 'timeout' });
        }
      }, timeout);

      // Send request to iframe
      try {
        iframe.contentWindow.postMessage({
          type: 'FSB_FRAME_REQUEST',
          action: 'getFrameDOM',
          requestId: requestId
        }, '*');
      } catch (e) {
        // Cross-origin iframe, can't send message directly
        resolve({ success: false, error: 'cross-origin' });
      }
    });

    framePromises.push(framePromise.then(result => ({
      iframe: {
        src: iframe.src,
        id: iframe.id,
        name: iframe.name,
        title: iframe.title
      },
      ...result
    })));
  }

  // Wait for all responses
  const results = await Promise.all(framePromises);

  // Clean up listener
  window.removeEventListener('message', responseHandler);

  // Filter successful results
  const successfulFrames = results.filter(r => r.success);
  automationLogger.logDOMOperation(currentSessionId, 'iframes_collected', { successful: successfulFrames.length, total: iframes.length });

  return results;
}

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
  // EASY WIN #1: Accessibility-first selector generation (40% more stable)

  // Strategy 1: Prefer ID if available
  if (element.id) {
    return `#${element.id}`;
  }

  // Strategy 2: ARIA role-based selectors (most stable - Testing Library pattern)
  const role = element.getAttribute('role') || element.getAttribute('aria-role');
  const tag = element.tagName.toLowerCase();

  if (role) {
    // Try role + accessible name combination
    const ariaLabel = element.getAttribute('aria-label');
    const ariaLabelledBy = element.getAttribute('aria-labelledby');

    if (ariaLabel) {
      const roleWithLabel = `[role="${role}"][aria-label="${ariaLabel}"]`;
      if (document.querySelectorAll(roleWithLabel).length === 1) {
        return roleWithLabel;
      }
    }

    // Try role + tag combination
    const roleWithTag = `${tag}[role="${role}"]`;
    const roleMatches = document.querySelectorAll(roleWithTag);
    if (roleMatches.length > 0 && roleMatches.length <= 5) {
      return roleWithTag;
    }
  }

  // Strategy 3: Use unique attributes (accessibility-first order)
  const uniqueAttrs = [
    'aria-label',       // Accessibility first
    'aria-labelledby',
    'data-testid',      // Test IDs
    'data-test',
    'data-qa',
    'data-cy',
    'data-id'
  ];
  for (const attr of uniqueAttrs) {
    const value = element.getAttribute(attr);
    if (value) {
      const selector = `[${attr}="${value}"]`;
      // Verify uniqueness
      if (document.querySelectorAll(selector).length === 1) {
        return selector;
      }

      // Try with tag for better specificity
      const tagSelector = `${tag}${selector}`;
      if (document.querySelectorAll(tagSelector).length === 1) {
        return tagSelector;
      }
    }
  }

  // Strategy 3: Use classes with fallback strategies
  if (element.className && typeof element.className === 'string') {
    const classes = element.className.trim().split(/\s+/).filter(c => c);

    if (classes.length > 0) {
      // Try full class combination
      const fullSelector = `.${classes.join('.')}`;
      const fullMatches = document.querySelectorAll(fullSelector);
      if (fullMatches.length > 0 && fullMatches.length <= 3) {
        return fullSelector;
      }

      // IMPROVED: Try partial class combinations (more robust)
      // Try first 2 classes
      if (classes.length >= 2) {
        const partialSelector = `.${classes.slice(0, 2).join('.')}`;
        const partialMatches = document.querySelectorAll(partialSelector);
        if (partialMatches.length > 0 && partialMatches.length <= 5) {
          return partialSelector;
        }
      }

      // Try just the first class
      const singleClass = `.${classes[0]}`;
      const singleMatches = document.querySelectorAll(singleClass);
      if (singleMatches.length > 0 && singleMatches.length <= 10) {
        return singleClass;
      }
    }
  }

  // Strategy 4: Tag + type combination (tag already declared above at line 919)
  if (element.type) {
    const typeSelector = `${tag}[type="${element.type}"]`;
    if (document.querySelectorAll(typeSelector).length <= 5) {
      return typeSelector;
    }
  }

  // Strategy 5: Tag + name combination
  if (element.name) {
    const nameSelector = `${tag}[name="${element.name}"]`;
    if (document.querySelectorAll(nameSelector).length <= 3) {
      return nameSelector;
    }
  }

  // Strategy 6: Tag + aria-label (even if not unique)
  // Note: ariaLabel may already be declared for role-based selectors, use different var name
  const labelForTag = element.getAttribute('aria-label');
  if (labelForTag) {
    return `${tag}[aria-label="${labelForTag}"]`;
  }

  // Strategy 7: Tag + role combination (role already checked in strategy 2)
  const elemRole = element.getAttribute('role');
  if (elemRole) {
    const roleSelector = `${tag}[role="${elemRole}"]`;
    if (document.querySelectorAll(roleSelector).length <= 5) {
      return roleSelector;
    }
  }

  // Fallback: Just the tag
  return tag;
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

/**
 * Sanitizes a CSS selector by removing invalid pseudo-selectors
 * that are not supported by native querySelector (e.g., jQuery's :contains())
 * @param {string} selector - The selector to sanitize
 * @returns {string} A valid CSS selector
 */
function sanitizeSelector(selector) {
  if (!selector || typeof selector !== 'string') {
    return selector;
  }

  // Remove jQuery-style pseudo-selectors that aren't valid CSS
  const invalidPseudos = [
    /:contains\([^)]*\)/gi,      // :contains('text') - jQuery only
    /:has\([^)]*\)/gi,           // :has() - limited browser support, can cause issues
    /:eq\(\d+\)/gi,              // :eq(n) - jQuery only
    /:gt\(\d+\)/gi,              // :gt(n) - jQuery only
    /:lt\(\d+\)/gi,              // :lt(n) - jQuery only
    /:first(?![-\w])/gi,         // :first - jQuery only (but not :first-child, :first-of-type)
    /:last(?![-\w])/gi,          // :last - jQuery only (but not :last-child, :last-of-type)
    /:even/gi,                   // :even - jQuery only
    /:odd/gi,                    // :odd - jQuery only
    /:visible/gi,                // :visible - jQuery only
    /:hidden/gi,                 // :hidden - jQuery only
    /:animated/gi,               // :animated - jQuery only
    /:parent/gi                  // :parent - jQuery only
  ];

  let sanitized = selector;
  for (const pattern of invalidPseudos) {
    sanitized = sanitized.replace(pattern, '');
  }

  // Clean up any resulting empty selectors or dangling commas
  // Split by comma, filter out empty parts, rejoin
  const parts = sanitized.split(',')
    .map(s => s.trim())
    .filter(s => s.length > 0 && s !== '*'); // Remove empty or just asterisk

  if (parts.length === 0) {
    automationLogger.warn('Selector completely invalidated after sanitization', { sessionId: currentSessionId, selector });
    return null;
  }

  return parts.join(', ');
}

// Query selector that supports shadow DOM
function querySelectorWithShadow(selector) {
  // Sanitize selector first to remove invalid pseudo-selectors
  const sanitized = sanitizeSelector(selector);
  if (!sanitized) {
    automationLogger.warn('Cannot query with invalid selector', { sessionId: currentSessionId, selector });
    return null;
  }

  // Check if selector contains shadow DOM piercing operator
  if (sanitized.includes('>>>')) {
    const parts = sanitized.split('>>>').map(s => s.trim());
    let element = null;
    try {
      element = document.querySelector(parts[0]);
    } catch (e) {
      automationLogger.warn('Invalid selector part', { sessionId: currentSessionId, part: parts[0], error: e.message });
      return null;
    }

    for (let i = 1; i < parts.length && element; i++) {
      if (element.shadowRoot) {
        try {
          element = element.shadowRoot.querySelector(parts[i]);
        } catch (e) {
          automationLogger.warn('Invalid shadow selector part', { sessionId: currentSessionId, part: parts[i], error: e.message });
          return null;
        }
      } else {
        element = null;
      }
    }

    return element;
  }

  // Regular querySelector for non-shadow DOM
  try {
    return document.querySelector(sanitized);
  } catch (e) {
    automationLogger.warn('querySelector failed', { sessionId: currentSessionId, selector: sanitized, error: e.message });
    return null;
  }
}

// Query all elements including shadow DOM
function querySelectorAllWithShadow(selector) {
  // Sanitize selector first to remove invalid pseudo-selectors
  const sanitized = sanitizeSelector(selector);
  if (!sanitized) {
    automationLogger.warn('Cannot queryAll with invalid selector', { sessionId: currentSessionId, selector });
    return [];
  }

  const results = [];

  // Regular query first
  try {
    results.push(...document.querySelectorAll(sanitized));
  } catch (e) {
    automationLogger.warn('querySelectorAll failed', { sessionId: currentSessionId, selector: sanitized, error: e.message });
    return [];
  }

  // Then search in all shadow roots
  function searchShadowRoots(root) {
    try {
      const elements = root.querySelectorAll('*');
      for (const element of elements) {
        if (element.shadowRoot) {
          try {
            results.push(...element.shadowRoot.querySelectorAll(sanitized));
          } catch (e) {
            // Ignore errors in shadow roots
          }
          searchShadowRoots(element.shadowRoot);
        }
      }
    } catch (e) {
      // Ignore errors during shadow root traversal
    }
  }

  searchShadowRoots(document);
  return results;
}

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

  // 2. aria-label
  const ariaLabel = node.getAttribute('aria-label');
  if (ariaLabel) return { name: ariaLabel, source: 'aria-label' };

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
    return {
      passed: false,
      reason: 'Element has zero dimensions',
      details: {
        rect: { width: rect.width, height: rect.height, top: rect.top, left: rect.left }
      }
    };
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
 * Check if element can receive pointer events (not obscured by other elements)
 * Uses multi-point hit testing for more reliable detection
 * @param {Element} element - The DOM element to check
 * @returns {Object} { passed: boolean, reason: string|null, details: object, obscuredBy?: string }
 */
function checkElementReceivesEvents(element) {
  const rect = element.getBoundingClientRect();

  // Calculate 5 check points: center + 4 quadrant points
  const points = [
    { name: 'center', x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 },
    { name: 'topLeft', x: rect.left + rect.width * 0.25, y: rect.top + rect.height * 0.25 },
    { name: 'topRight', x: rect.left + rect.width * 0.75, y: rect.top + rect.height * 0.25 },
    { name: 'bottomLeft', x: rect.left + rect.width * 0.25, y: rect.top + rect.height * 0.75 },
    { name: 'bottomRight', x: rect.left + rect.width * 0.75, y: rect.top + rect.height * 0.75 }
  ];

  // Filter to points within viewport
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  const pointsInViewport = points.filter(p =>
    p.x >= 0 && p.x <= viewportWidth && p.y >= 0 && p.y <= viewportHeight
  );

  if (pointsInViewport.length === 0) {
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
 * Smart wait for element to be actionable using DOM mutation detection
 * NO hardcoded timeouts - uses actual DOM signals for fail-fast behavior
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
      const element = querySelectorWithShadow(selector);
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
      if (typeof tools !== 'undefined' && tools.detectLoadingState) {
        const loadingState = tools.detectLoadingState({});
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
// END ACCESSIBILITY TREE FUNCTIONS
// =============================================================================

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
    // AUTO-DISMISS: Try to dismiss common overlays before attempting click
    // This reduces "obscured" errors caused by cookie banners, modals, etc.
    const overlayDismissSelectors = [
      '[class*="modal-backdrop"]:not([style*="display: none"])',
      '[class*="overlay-close"]',
      '[class*="popup-close"]',
      '[aria-label="Close"]',
      '[aria-label="Dismiss"]',
      '.modal .close',
      '[data-dismiss="modal"]',
      'button[class*="cookie"][class*="accept"]',
      'button[class*="consent"][class*="accept"]',
      '[id*="cookie"] button[class*="accept"]'
    ];

    for (const selector of overlayDismissSelectors) {
      try {
        const overlay = document.querySelector(selector);
        if (overlay && overlay.offsetParent !== null) {
          overlay.click();
          await new Promise(r => setTimeout(r, 200));
        }
      } catch (e) {
        // Ignore errors - overlay dismissal is best-effort
      }
    }

    // AUTO-WAIT: Wait for element to be actionable before attempting click
    // Implements Playwright-style auto-wait for improved reliability
    const waitResult = await waitForActionable(params.selector, {
      timeout: 3000,
      waitFor: ['visible', 'enabled', 'stable']
    });

    if (!waitResult.success) {
      return {
        success: false,
        error: `Element not actionable: ${waitResult.reason}`,
        selector: params.selector,
        waitTime: waitResult.waitTime
      };
    }

    let element = waitResult.element;

    if (element) {
      // Get position info for viewport check (after waitForActionable confirms visibility)
      const rect = element.getBoundingClientRect();
      const isInViewport = rect.top >= 0 && rect.left >= 0 &&
                          rect.bottom <= window.innerHeight &&
                          rect.right <= window.innerWidth;

      // EASY WIN #2: Always scroll to center for reliability (reduces failures by 30-50%)
      // Even if in viewport, center positioning avoids fixed headers/footers
      element.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'center'
      });

      // Wait for scroll animation to complete
      await new Promise(resolve => setTimeout(resolve, 300));

      // EASY WIN #3: Re-locate element after scroll (DOM might have changed during scroll)
      element = querySelectorWithShadow(params.selector);
      if (!element) {
        return {
          success: false,
          error: 'Element became stale after scrolling',
          selector: params.selector
        };
      }

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
          automationLogger.logActionExecution(currentSessionId, 'click', 'redirect_navigation', { originalTarget: anchor.target, href: anchor.href });

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

      // Capture comprehensive state before click
      const preClickState = {
        url: window.location.href,
        bodyTextLength: document.body.innerText.length,
        elementCount: document.querySelectorAll('*').length,
        activeElement: document.activeElement?.tagName,
        timestamp: Date.now(),
        // ENHANCED: Capture element-specific state for better verification
        elementClass: element.className,
        elementAriaExpanded: element.getAttribute('aria-expanded'),
        elementAriaSelected: element.getAttribute('aria-selected'),
        elementAriaChecked: element.getAttribute('aria-checked'),
        elementAriaPressed: element.getAttribute('aria-pressed'),
        elementAriaHidden: element.getAttribute('aria-hidden'),
        elementDataState: element.getAttribute('data-state'),
        elementChecked: element.checked,
        elementOpen: element.open
      };

      // Capture related elements that might change (dropdowns, menus, modals)
      const relatedElements = [
        element.nextElementSibling,
        element.querySelector('[role="menu"], [role="listbox"], .dropdown-menu, .submenu'),
        document.querySelector(`[aria-labelledby="${element.id}"]`),
        document.querySelector(`[aria-controls="${element.id}"]`),
        element.id ? document.querySelector(`#${element.id}-content, #${element.id}-panel, #${element.id}-menu`) : null
      ].filter(Boolean);

      const preRelatedStates = relatedElements.map(el => ({
        display: getComputedStyle(el).display,
        visibility: getComputedStyle(el).visibility,
        opacity: getComputedStyle(el).opacity,
        height: el.getBoundingClientRect().height,
        ariaHidden: el.getAttribute('aria-hidden')
      }));

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

      // Wait a bit for immediate effects
      await new Promise(resolve => setTimeout(resolve, 300));

      // Check for immediate DOM changes
      const postClickState = {
        url: window.location.href,
        bodyTextLength: document.body.innerText.length,
        elementCount: document.querySelectorAll('*').length,
        activeElement: document.activeElement?.tagName,
        timestamp: Date.now(),
        // ENHANCED: Capture element-specific state after click
        elementClass: element.className,
        elementAriaExpanded: element.getAttribute('aria-expanded'),
        elementAriaSelected: element.getAttribute('aria-selected'),
        elementAriaChecked: element.getAttribute('aria-checked'),
        elementAriaPressed: element.getAttribute('aria-pressed'),
        elementAriaHidden: element.getAttribute('aria-hidden'),
        elementDataState: element.getAttribute('data-state'),
        elementChecked: element.checked,
        elementOpen: element.open
      };

      // Check related elements after click
      const postRelatedStates = relatedElements.map(el => ({
        display: getComputedStyle(el).display,
        visibility: getComputedStyle(el).visibility,
        opacity: getComputedStyle(el).opacity,
        height: el.getBoundingClientRect().height,
        ariaHidden: el.getAttribute('aria-hidden')
      }));

      // Check if any related element's visibility changed
      const relatedVisibilityChanged = preRelatedStates.some((pre, i) => {
        const post = postRelatedStates[i];
        return pre.display !== post.display ||
               pre.visibility !== post.visibility ||
               pre.opacity !== post.opacity ||
               Math.abs(pre.height - post.height) > 5 ||
               pre.ariaHidden !== post.ariaHidden;
      });

      // Detect changes - ENHANCED with more checks
      const changes = {
        urlChanged: preClickState.url !== postClickState.url,
        contentChanged: Math.abs(postClickState.bodyTextLength - preClickState.bodyTextLength) > 10,
        elementCountChanged: Math.abs(postClickState.elementCount - preClickState.elementCount) > 5,
        focusChanged: preClickState.activeElement !== postClickState.activeElement,
        loadingDetected: !!document.querySelector('.loading, .spinner, [class*="load"], [aria-busy="true"]'),
        // NEW: Enhanced change detection
        classChanged: preClickState.elementClass !== postClickState.elementClass,
        ariaExpandedChanged: preClickState.elementAriaExpanded !== postClickState.elementAriaExpanded,
        ariaSelectedChanged: preClickState.elementAriaSelected !== postClickState.elementAriaSelected,
        ariaCheckedChanged: preClickState.elementAriaChecked !== postClickState.elementAriaChecked,
        ariaPressedChanged: preClickState.elementAriaPressed !== postClickState.elementAriaPressed,
        dataStateChanged: preClickState.elementDataState !== postClickState.elementDataState,
        checkedChanged: preClickState.elementChecked !== postClickState.elementChecked,
        openChanged: preClickState.elementOpen !== postClickState.elementOpen,
        relatedVisibilityChanged: relatedVisibilityChanged
      };

      // Determine if click had an effect
      // For anchor tags, require URL change or significant DOM change (not just focus)
      const isAnchorElement = element.tagName === 'A' || element.closest('a');
      const hasSignificantChange = changes.urlChanged ||
                                   changes.contentChanged ||
                                   changes.elementCountChanged ||
                                   changes.loadingDetected ||
                                   changes.ariaExpandedChanged ||
                                   changes.relatedVisibilityChanged;

      // For links: require URL/content change, not just focus
      // For other elements: any change counts
      const hadEffect = isAnchorElement
        ? hasSignificantChange
        : Object.values(changes).some(v => v);

      // CRITICAL FIX: Return success=false when click has no effect
      // This prevents AI from continuing after failed clicks
      if (!hadEffect) {
        return {
          success: false,
          error: 'Click executed but had no detectable effect on the page',
          clicked: params.selector,
          hadEffect: false,
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
          suggestion: 'Element may not be interactive or may require different interaction method'
        };
      }

      return {
        success: true,
        clicked: params.selector,
        hadEffect: true,
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
        }
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
  
  // Click on search result links (Google, Bing, DuckDuckGo, etc.)
  clickSearchResult: async (params) => {
    automationLogger.logActionExecution(currentSessionId, 'clickSearchResult', 'start', params);
    
    // Common selectors for search result links across different search engines
    // NOTE: Modern Google uses "a > h3" structure (link contains heading), not "h3 > a"
    const searchResultSelectors = [
      // Google search results - MODERN STRUCTURE (link contains heading)
      'a[href] h3',                     // Link contains H3 heading (current Google structure)
      'a[href] h2',                     // Link contains H2 heading
      '.yuRUbf a',                      // Current Google result container
      '.g a[href]:not([href*="google"])', // Result links (not Google's own links)
      'a[jsname]',                      // Google's JS-rendered results

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
      const element = querySelectorWithShadow(params.selector);
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
              automationLogger.logActionExecution(currentSessionId, 'clickSearchResult', 'domain_match', { domain: params.domain, href: targetLink.href });
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
              automationLogger.logActionExecution(currentSessionId, 'clickSearchResult', 'text_match', { text: params.text, href: targetLink.href });
            }
          }

          // FIXED: Use actual click instead of navigation
          targetLink.click();
          automationLogger.logActionExecution(currentSessionId, 'clickSearchResult', 'clicked', { href: targetLink.href });

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
        automationLogger.debug('Selector failed for search result', { sessionId: currentSessionId, selector, error: e.message });
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
    automationLogger.logActionExecution(currentSessionId, 'type', 'start', params);

    try {
      // AUTO-WAIT: Wait for element to be actionable before typing
      const waitResult = await waitForActionable(params.selector, {
        timeout: 3000,
        waitFor: ['visible', 'enabled', 'stable']
      });

      if (!waitResult.success) {
        return {
          success: false,
          error: `Element not actionable for typing: ${waitResult.reason}`,
          selector: params.selector,
          waitTime: waitResult.waitTime
        };
      }

      const element = waitResult.element;
      automationLogger.logActionExecution(currentSessionId, 'type', 'element_found', { tagName: element ? element.tagName : 'null', waitTime: waitResult.waitTime });

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
      let insertionSuccess = false;  // Declare at function scope to avoid 'not defined' errors

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
        insertionSuccess = false;  // Reset for this branch (already declared at function scope)
        
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
            automationLogger.debug('execCommand insertText failed', { sessionId: currentSessionId, error: e.message });
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
            automationLogger.debug('Clipboard paste simulation failed', { sessionId: currentSessionId, error: e.message });
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
            automationLogger.debug('Range/Selection API insertion failed', { sessionId: currentSessionId, error: e.message });
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
            automationLogger.debug('Direct manipulation failed', { sessionId: currentSessionId, error: e.message });
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
            automationLogger.debug('Event dispatch failed', { sessionId: currentSessionId, eventType: event.type, error: e.message });
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
        automationLogger.logActionExecution(currentSessionId, 'type', 'amazon_retry', { reason: 'initial_typing_failed' });

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
            automationLogger.logActionExecution(currentSessionId, 'type', 'amazon_retry_success', {});
          }
        } catch (amazonError) {
          automationLogger.warn('Amazon-specific retry failed', { sessionId: currentSessionId, error: amazonError.message });
        }
      }
      
      // CRITICAL FIX: Strengthen validation - require exact match, not partial
      const finalCheck = element.textContent || element.value || '';
      const trimmedFinal = finalCheck.trim();
      const trimmedExpected = params.text.trim();

      // Exact match or contentEditable might have added formatting
      const exactMatch = trimmedFinal === trimmedExpected;

      // For contentEditable, allow if the text is present without extra characters
      // but don't allow partial matches
      const contentEditableMatch = isContentEditable &&
                                   trimmedFinal.replace(/\s+/g, ' ') === trimmedExpected.replace(/\s+/g, ' ');

      // Final success requires either exact match or proper contentEditable match
      const finalSuccess = exactMatch || contentEditableMatch;

      // CRITICAL FIX: For contentEditable, check if insertion actually worked
      // If all 4 methods failed, insertionSuccess is still false
      const contentEditableActuallyWorked = !isContentEditable || (insertionSuccess && finalSuccess);

      // Return failure if typing didn't work
      if (!finalSuccess || (isContentEditable && !insertionSuccess)) {
        // ENHANCED: Try CDP-based text insertion as last resort for stubborn editors
        automationLogger.logActionExecution(currentSessionId, 'type', 'cdp_fallback_attempt', { reason: 'standard_methods_failed' });

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

          // Verify CDP insertion worked
          await new Promise(resolve => setTimeout(resolve, 200));
          const cdpFinalCheck = element.textContent || element.value || '';
          const cdpSuccess = cdpFinalCheck.includes(params.text) || cdpFinalCheck.trim() === params.text.trim();

          if (cdpSuccess) {
            automationLogger.logActionExecution(currentSessionId, 'type', 'cdp_fallback_success', {});
            return {
              success: true,
              typed: params.text,
              method: 'cdp_fallback',
              pressedEnter: !!params.pressEnter,
              clickedFirst: !shouldSkipClick,
              elementInfo: {
                tag: element.tagName,
                type: isInput ? element.type : 'contenteditable',
                name: element.name || element.id || element.className
              }
            };
          }
        } catch (cdpError) {
          automationLogger.debug('CDP fallback failed', { sessionId: currentSessionId, error: cdpError.message });
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
            name: element.name || element.id || element.className,
            contentEditable: isContentEditable
          },
          suggestion: isContentEditable
            ? 'Try alternative selector or wait for page to be ready'
            : 'Element may not accept input correctly'
        };
      }

      // Universal return object for both input types
      return {
        success: true,
        typed: params.text,
        actualValue: finalCheck,
        pressedEnter: !!params.pressEnter,
        clickedFirst: !shouldSkipClick,
        focused: document.activeElement === element,
        focusAttempts: focusAttempts,
        scrolled: rect.top < 0 || rect.top > window.innerHeight,
        insertionSuccess: isContentEditable ? insertionSuccess : true,
        amazonSpecific: isAmazonSearch,
        validationPassed: true,
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
    automationLogger.debug('Trying fallback selectors for type', { sessionId: currentSessionId, count: fallbackSelectors.length });

    for (const fallbackSelector of fallbackSelectors) {
      const fallbackElement = document.querySelector(fallbackSelector);
      if (fallbackElement) {
        automationLogger.logActionExecution(currentSessionId, 'type', 'fallback_found', { selector: fallbackSelector });
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

    automationLogger.error('Failed to find typeable element', { sessionId: currentSessionId, selector: params.selector, availableInputs });
    
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
      automationLogger.error('Unexpected error in type function', {
        sessionId: currentSessionId,
        error: error.message,
        stack: error.stack,
        params
      });

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

          // FSB TIMING: Log DOM stability wait time
          automationLogger.logTiming(currentSessionId, 'WAIT', 'dom_stable', totalTime, { changes: changeCount });
          automationLogger.logDOMOperation(currentSessionId, 'stability_check', result);
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
    // FSB TIMING: Track loading state detection
    const detectStart = Date.now();
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
          const result = {
            loading: true,
            indicator: pattern,
            element: {
              tag: element.tagName,
              class: element.className,
              id: element.id
            }
          };
          automationLogger.logTiming(currentSessionId, 'WAIT', 'loading_detect', Date.now() - detectStart, { loading: true, indicator: pattern });
          return result;
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
          const result = {
            loading: true,
            indicator: 'text',
            text: element.textContent?.trim().substring(0, 50)
          };
          automationLogger.logTiming(currentSessionId, 'WAIT', 'loading_detect', Date.now() - detectStart, { loading: true, indicator: 'text' });
          return result;
        }
      }
    }
    
    automationLogger.logTiming(currentSessionId, 'WAIT', 'loading_detect', Date.now() - detectStart, { loading: false });
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
          automationLogger.logRecovery(currentSessionId, 'debugger_api_failed', 'dom_events_fallback', 'started', { error: response.error });
        }
      } catch (error) {
        automationLogger.logRecovery(currentSessionId, 'debugger_api_unavailable', 'dom_events_fallback', 'started', { error: error.message });
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
          automationLogger.logRecovery(currentSessionId, 'debugger_api_key_sequence_failed', 'dom_events_fallback', 'started', { error: response.error });
        }
      } catch (error) {
        automationLogger.logRecovery(currentSessionId, 'debugger_api_key_sequence_unavailable', 'dom_events_fallback', 'started', { error: error.message });
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
          // Return failure with details - don't silently fall through to DOM fallback
          // This ensures the caller knows the actual result
          automationLogger.logRecovery(currentSessionId, 'debugger_api_text_failed', 'return_error', 'failed', { error: response.error });
          return {
            success: false,
            error: response.error || 'Keyboard debugger API failed',
            completedChars: response.result?.completedChars || 0,
            method: 'debugger-failed',
            text,
            action: 'typeWithKeys'
          };
        }
      } catch (error) {
        // Return failure on exception - don't silently fall through
        automationLogger.logRecovery(currentSessionId, 'debugger_api_text_unavailable', 'return_error', 'failed', { error: error.message });
        return {
          success: false,
          error: error.message || 'Debugger API unavailable',
          method: 'debugger-exception',
          text,
          action: 'typeWithKeys'
        };
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
          automationLogger.logRecovery(currentSessionId, 'debugger_api_special_key_failed', 'dom_events_fallback', 'started', { error: response.error });
        }
      } catch (error) {
        automationLogger.logRecovery(currentSessionId, 'debugger_api_special_key_unavailable', 'dom_events_fallback', 'started', { error: error.message });
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
  
  // Focus on element with auto-wait
  focus: async (params) => {
    // AUTO-WAIT: Wait for element to be actionable before focusing
    const waitResult = await waitForActionable(params.selector, {
      timeout: 2000,
      waitFor: ['visible', 'enabled']
    });

    if (!waitResult.success) {
      return {
        success: false,
        error: `Element not actionable for focus: ${waitResult.reason}`,
        selector: params.selector,
        waitTime: waitResult.waitTime
      };
    }

    const element = waitResult.element;
    if (element) {
      element.focus();
      return { success: true, focused: params.selector, waitTime: waitResult.waitTime };
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

// ============================================================================
// SELECTOR VALIDATION UTILITIES
// These functions validate whether selectors uniquely identify elements
// ============================================================================

/**
 * Validates whether a CSS selector uniquely identifies exactly one element
 * @param {string} selector - The CSS selector to validate
 * @param {Element|Document} root - The root element to search within (default: document)
 * @returns {Object} Validation result with isValid, isUnique, count, selector, and optional error
 */
function validateSelectorUniqueness(selector, root = document) {
  try {
    const matches = root.querySelectorAll(selector);
    const count = matches.length;
    return {
      isValid: true,
      isUnique: count === 1,
      count: count,
      selector: selector
    };
  } catch (error) {
    return {
      isValid: false,
      isUnique: false,
      count: 0,
      selector: selector,
      error: error.message
    };
  }
}

/**
 * Validates whether an XPath selector uniquely identifies exactly one element
 * @param {string} xpath - The XPath expression to validate
 * @param {Element|Document} root - The root element to search within (default: document)
 * @returns {Object} Validation result with isValid, isUnique, count, selector, and optional error
 */
function validateXPathUniqueness(xpath, root = document) {
  try {
    const result = document.evaluate(
      xpath,
      root,
      null,
      XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
      null
    );
    const count = result.snapshotLength;
    return {
      isValid: true,
      isUnique: count === 1,
      count: count,
      selector: xpath
    };
  } catch (error) {
    return {
      isValid: false,
      isUnique: false,
      count: 0,
      selector: xpath,
      error: error.message
    };
  }
}

// ============================================================================
// ENHANCED ID AND CLASS FILTERING PATTERNS
// These patterns help filter out auto-generated IDs and dynamic state classes
// ============================================================================

/**
 * Pattern to match auto-generated IDs from common frameworks
 * Matches: UUID patterns, react-*, vue-*, ember-*, angular (ng-), radix-*, headless, etc.
 * @type {RegExp}
 */
const AUTO_GENERATED_ID_PATTERN = /^[0-9a-f]{8}-|^uid-|^react-|^ember-|^:r[a-z0-9]+:|^__react|^ng-|^vue-|^el-|^radix-|^headless|^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Checks if an ID appears to be auto-generated by a framework
 * @param {string} id - The ID to check
 * @returns {boolean} True if the ID appears to be auto-generated
 */
function isAutoGeneratedId(id) {
  if (!id) {
    return false;
  }

  // Check against known framework patterns
  if (AUTO_GENERATED_ID_PATTERN.test(id)) {
    return true;
  }

  // Check for pure hex strings of 6+ characters (likely hashes)
  if (/^[0-9a-f]{6,}$/i.test(id)) {
    return true;
  }

  return false;
}

/**
 * Patterns to match dynamic/state classes that should be filtered out
 * These classes change based on UI state and are not stable for targeting
 * @type {RegExp[]}
 */
const DYNAMIC_CLASS_PATTERNS = [
  /^(active|selected|hover|focus|disabled|loading|hidden|show|visible|open|closed)$/i,  // State classes
  /^(is-|has-|js-|css-)/i,  // State prefixes
  /^[a-z]{1,2}[0-9a-f]{4,}$/i,  // CSS Modules hashes (e.g., "a1b2c3d4")
  /^_[a-zA-Z0-9]+_[a-zA-Z0-9]+$/,  // Styled-components (e.g., "_Button_1a2b3")
  /^[A-Z][a-zA-Z]+__[a-zA-Z]+--/,  // BEM modifier states (e.g., "Block__element--modifier")
];

/**
 * Filters out dynamic/state classes from a class string
 * Returns only stable classes suitable for selector generation
 * @param {string} classString - Space-separated class string
 * @returns {string[]} Array of stable class names
 */
function filterDynamicClasses(classString) {
  if (!classString || typeof classString !== 'string') {
    return [];
  }

  const classes = classString.trim().split(/\s+/);

  return classes.filter(className => {
    // Skip empty strings
    if (!className) {
      return false;
    }

    // Check against all dynamic patterns
    for (const pattern of DYNAMIC_CLASS_PATTERNS) {
      if (pattern.test(className)) {
        return false;
      }
    }

    return true;
  });
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
  if (element.id && !isAutoGeneratedId(element.id)) { // Skip auto-generated IDs
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
    const classes = filterDynamicClasses(element.className).slice(0, 2); // Limit to 2 most significant classes

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
  
  // Validate uniqueness for each selector and adjust scores
  const validatedSelectors = selectors.map(selector => {
    const isXPath = selector.startsWith('//');
    const validation = isXPath
      ? validateXPathUniqueness(selector)
      : validateSelectorUniqueness(selector);

    let score = selectorScores.get(selector) || 0;

    // Adjust score based on uniqueness
    if (!validation.isValid) {
      score = 0; // Invalid selector
    } else if (validation.isUnique) {
      score += 5; // Bonus for unique selectors
    } else if (validation.count === 0) {
      score = 0; // No matches
    } else {
      score = Math.max(score - 3, 1); // Penalty for non-unique
    }

    return {
      selector,
      score,
      isUnique: validation.isUnique,
      matchCount: validation.count
    };
  });

  // Sort: unique first, then by score
  const sortedSelectors = validatedSelectors.sort((a, b) => {
    if (a.isUnique !== b.isUnique) {
      return b.isUnique ? 1 : -1; // Unique selectors first
    }
    return b.score - a.score; // Then by score
  });

  // PERFORMANCE: Return only top 3 selectors (was 5) to reduce payload size
  // Most elements only need 2-3 good selectors; the extra ones are rarely used
  return sortedSelectors.slice(0, 3);
}

/**
 * PERFORMANCE: Generate minimal selectors on-demand based on action type
 * This is more efficient than always generating 5+ selectors per element
 * @param {Element} element - The DOM element
 * @param {string} actionType - The type of action (click, type, extract, etc.)
 * @returns {Array} Array of selector objects with score
 */
function generateSelectorsForAction(element, actionType = 'default') {
  const selectors = [];
  const selectorScores = new Map();

  // Best: ID (if not auto-generated)
  if (element.id && !isAutoGeneratedId(element.id)) {
    const selector = `#${CSS.escape(element.id)}`;
    selectors.push(selector);
    selectorScores.set(selector, 10);
  }

  // Good: test-id attributes
  const testId = element.getAttribute('data-testid') || element.getAttribute('data-test-id');
  if (testId) {
    const selector = `[data-testid="${testId}"]`;
    selectors.push(selector);
    selectorScores.set(selector, 9);
  }

  // ARIA label (especially good for click actions)
  if (actionType === 'click' || actionType === 'default') {
    const ariaLabel = element.getAttribute('aria-label');
    if (ariaLabel) {
      const selector = `[aria-label="${ariaLabel}"]`;
      selectors.push(selector);
      selectorScores.set(selector, 9);
    }
  }

  // For type actions, prioritize name and label association
  if (actionType === 'type') {
    if (element.name) {
      const selector = `[name="${CSS.escape(element.name)}"]`;
      selectors.push(selector);
      selectorScores.set(selector, 9);
    }

    // Placeholder for inputs
    if (element.placeholder) {
      const selector = `[placeholder="${CSS.escape(element.placeholder)}"]`;
      selectors.push(selector);
      selectorScores.set(selector, 7);
    }
  }

  // Fallback: role attribute
  const role = element.getAttribute('role');
  if (role && selectors.length < 2) {
    const selector = `[role="${role}"]`;
    selectors.push(selector);
    selectorScores.set(selector, 6);
  }

  // Last resort: class-based selector (only if we have < 2 selectors)
  if (selectors.length < 2 && element.className && typeof element.className === 'string') {
    const classes = filterDynamicClasses(element.className).slice(0, 2);

    if (classes.length > 0) {
      const selector = `.${classes.map(c => CSS.escape(c)).join('.')}`;
      selectors.push(selector);
      selectorScores.set(selector, 5);
    }
  }

  // Validate uniqueness for each selector and adjust scores
  const validatedSelectors = selectors.map(selector => {
    const validation = validateSelectorUniqueness(selector);

    let score = selectorScores.get(selector) || 0;

    // Adjust score based on uniqueness
    if (!validation.isValid) {
      score = 0; // Invalid selector
    } else if (validation.isUnique) {
      score += 5; // Bonus for unique selectors
    } else if (validation.count === 0) {
      score = 0; // No matches
    } else {
      score = Math.max(score - 3, 1); // Penalty for non-unique
    }

    return {
      selector,
      score,
      isUnique: validation.isUnique,
      matchCount: validation.count
    };
  });

  // Sort: unique first, then by score; return max 3 selectors
  return validatedSelectors
    .sort((a, b) => {
      if (a.isUnique !== b.isUnique) {
        return b.isUnique ? 1 : -1; // Unique selectors first
      }
      return b.score - a.score; // Then by score
    })
    .slice(0, 3);
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

/**
 * Infer the semantic purpose of an element
 * Classifies elements by their role, intent, and sensitivity
 * @param {Element} element - DOM element to analyze
 * @returns {Object} Purpose classification with role, intent, and flags
 */
function inferElementPurpose(element) {
  const text = (element.textContent || '').toLowerCase().trim();
  const ariaLabel = (element.getAttribute('aria-label') || '').toLowerCase();
  const className = (element.className || '').toLowerCase();
  const type = element.type?.toLowerCase() || '';
  const name = (element.name || '').toLowerCase();
  const id = (element.id || '').toLowerCase();
  const placeholder = (element.placeholder || '').toLowerCase();
  const role = (element.getAttribute('role') || '').toLowerCase();

  const combined = `${text} ${ariaLabel} ${className} ${name} ${id} ${placeholder}`;

  // Button/action classification
  if (element.tagName === 'BUTTON' || element.tagName === 'A' || type === 'submit' || role === 'button') {
    // Primary submit actions
    if (/submit|send|post|confirm|done|finish|complete|checkout|pay|purchase|buy|order/.test(combined)) {
      return { role: 'primary-action', intent: 'submit', danger: false, priority: 'high' };
    }

    // Search actions
    if (/search|find|look|go|query/.test(combined)) {
      return { role: 'search-action', intent: 'search', danger: false, priority: 'high' };
    }

    // Login actions
    if (/login|sign.?in|log.?in|authenticate/.test(combined)) {
      return { role: 'auth-action', intent: 'login', danger: false, priority: 'high' };
    }

    // Signup/registration
    if (/signup|sign.?up|register|create.?account|join/.test(combined)) {
      return { role: 'auth-action', intent: 'signup', danger: false, priority: 'high' };
    }

    // Navigation forward
    if (/next|continue|proceed|forward|advance/.test(combined)) {
      return { role: 'navigation', intent: 'next-step', danger: false, priority: 'medium' };
    }

    // Navigation backward
    if (/back|previous|return|go.?back/.test(combined)) {
      return { role: 'navigation', intent: 'back', danger: false, priority: 'low' };
    }

    // Cancel/dismiss actions
    if (/cancel|close|dismiss|no|decline|skip|later|not.?now/.test(combined)) {
      return { role: 'secondary-action', intent: 'cancel', danger: false, priority: 'low' };
    }

    // Destructive actions
    if (/delete|remove|destroy|clear|reset|unsubscribe/.test(combined)) {
      return { role: 'destructive-action', intent: 'delete', danger: true, priority: 'low' };
    }

    // Edit actions
    if (/edit|modify|change|update/.test(combined)) {
      return { role: 'edit-action', intent: 'edit', danger: false, priority: 'medium' };
    }

    // Add/create actions
    if (/add|create|new|plus|\+/.test(combined)) {
      return { role: 'create-action', intent: 'add', danger: false, priority: 'medium' };
    }

    // Share/social actions
    if (/share|tweet|post|send|invite/.test(combined)) {
      return { role: 'social-action', intent: 'share', danger: false, priority: 'medium' };
    }

    // Download actions
    if (/download|export|save.?as/.test(combined)) {
      return { role: 'download-action', intent: 'download', danger: false, priority: 'medium' };
    }

    // If it has text, it's likely a meaningful action button
    if (text.length > 0 && text.length < 30) {
      return { role: 'action-button', intent: 'interact', danger: false, priority: 'medium' };
    }
  }

  // Input field classification
  if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA' || element.tagName === 'SELECT') {
    // Password fields
    if (type === 'password' || /password|pwd|pass/.test(name + id)) {
      return { role: 'credential-input', intent: 'password', sensitive: true, priority: 'high' };
    }

    // Email fields
    if (type === 'email' || /email|e-mail|mail/.test(combined)) {
      return { role: 'contact-input', intent: 'email', sensitive: false, priority: 'high' };
    }

    // Username/login fields
    if (/username|user.?name|user.?id|login|account/.test(combined)) {
      return { role: 'credential-input', intent: 'username', sensitive: false, priority: 'high' };
    }

    // Search input fields
    if (type === 'search' || /search|query|q$|find|keyword/.test(name + id + className) ||
        role === 'searchbox' || element.getAttribute('aria-label')?.toLowerCase().includes('search')) {
      return { role: 'search-input', intent: 'search-query', sensitive: false, priority: 'high' };
    }

    // Payment/card fields
    if (/card|credit|debit|payment|cvv|cvc|ccv|expir|billing/.test(combined)) {
      return { role: 'payment-input', intent: 'payment', sensitive: true, priority: 'high' };
    }

    // Phone fields
    if (type === 'tel' || /phone|tel|mobile|cell/.test(combined)) {
      return { role: 'contact-input', intent: 'phone', sensitive: false, priority: 'medium' };
    }

    // Name fields
    if (/first.?name|last.?name|full.?name|^name$/.test(name + id)) {
      return { role: 'personal-input', intent: 'name', sensitive: false, priority: 'medium' };
    }

    // Address fields
    if (/address|street|city|state|zip|postal|country/.test(combined)) {
      return { role: 'address-input', intent: 'address', sensitive: false, priority: 'medium' };
    }

    // Date fields
    if (type === 'date' || /date|birth|dob/.test(combined)) {
      return { role: 'date-input', intent: 'date', sensitive: false, priority: 'medium' };
    }

    // Quantity/number fields
    if (type === 'number' || /quantity|qty|amount|count/.test(combined)) {
      return { role: 'numeric-input', intent: 'quantity', sensitive: false, priority: 'medium' };
    }

    // URL fields
    if (type === 'url' || /url|website|link|href/.test(combined)) {
      return { role: 'url-input', intent: 'url', sensitive: false, priority: 'low' };
    }

    // General text input
    if (type === 'text' || element.tagName === 'TEXTAREA') {
      // Check for message/comment context
      if (/message|comment|note|description|content|body|text/.test(combined)) {
        return { role: 'text-input', intent: 'message', sensitive: false, priority: 'medium' };
      }
      return { role: 'text-input', intent: 'general-text', sensitive: false, priority: 'low' };
    }

    // Checkbox/radio
    if (type === 'checkbox' || type === 'radio') {
      if (/agree|terms|consent|accept|remember|subscribe/.test(combined)) {
        return { role: 'consent-input', intent: 'agreement', sensitive: false, priority: 'medium' };
      }
      return { role: 'toggle-input', intent: 'selection', sensitive: false, priority: 'low' };
    }

    // Select dropdowns
    if (element.tagName === 'SELECT') {
      return { role: 'select-input', intent: 'selection', sensitive: false, priority: 'medium' };
    }
  }

  // Link classification
  if (element.tagName === 'A') {
    const href = (element.href || '').toLowerCase();

    if (/logout|sign.?out|log.?out/.test(combined + href)) {
      return { role: 'auth-link', intent: 'logout', danger: true, priority: 'low' };
    }

    if (/help|support|faq|contact/.test(combined + href)) {
      return { role: 'help-link', intent: 'help', danger: false, priority: 'low' };
    }

    if (/privacy|terms|policy|legal/.test(combined + href)) {
      return { role: 'legal-link', intent: 'legal', danger: false, priority: 'low' };
    }

    return { role: 'navigation-link', intent: 'navigate', danger: false, priority: 'low' };
  }

  return { role: 'unknown', intent: null, danger: false, sensitive: false, priority: 'low' };
}

// Generate human-readable description of element (enhanced with purpose)
function generateElementDescription(element) {
  const parts = [];

  // Get element purpose for enhanced description
  const purpose = inferElementPurpose(element);

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

  // Add purpose-based description if available
  if (purpose.role !== 'unknown') {
    parts.push(`[${purpose.role}:${purpose.intent}]`);
  }

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

  // Add danger/sensitive flags
  if (purpose.danger) {
    parts.push('[DESTRUCTIVE]');
  }
  if (purpose.sensitive) {
    parts.push('[SENSITIVE]');
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

        // Viewport-only: skip elements outside viewport to reduce prompt size
        if (rect.bottom < 0 || rect.top > window.innerHeight ||
            rect.right < 0 || rect.left > window.innerWidth) {
          return;
        }

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
        
        // PERFORMANCE FIX: Reduce HTML context to 500 chars max to prevent payload bloat
        // 4000 chars per element * 500 elements = 2MB+ which causes API timeouts
        let truncatedHTML = elementHTML;
        if (elementHTML.length > 500) {
          // Try to find a good breaking point at tag or word boundaries
          const breakPoints = [
            elementHTML.lastIndexOf('>', 450),  // End of a tag
            elementHTML.lastIndexOf(' ', 480),  // End of a word
            450  // Hard cutoff
          ];
          const breakPoint = Math.max(...breakPoints.filter(p => p > 0));
          truncatedHTML = elementHTML.substring(0, breakPoint) + '...';
        }

        relevantElements.push({
          selector: generateSelector(element),
          html: truncatedHTML,
          text: element.innerText?.trim().substring(0, 100),  // REDUCED from 200 to 100
          tag: element.tagName.toLowerCase(),
          position: {
            x: Math.round(rect.left),
            y: Math.round(rect.top)
          }
        });
      });
    } catch (error) {
      automationLogger.warn('Error processing selector', { sessionId: currentSessionId, selector, error: error.message });
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
  
  // PERFORMANCE FIX: Reduced element limit to prevent massive payloads
  // Old limit of 500 elements * 500 chars HTML each = 250KB just for HTML context
  const maxElementsToSend = Math.min(
    Math.max(50, Math.floor(relevantElements.length * 0.2)), // At least 50, or 20% of found elements
    100 // REDUCED: Hard cap at 100 to prevent token overflow
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
 * Detect page context for semantic understanding
 * Automatically classifies the page type, state, and available actions
 * @returns {Object} Page context with type detection, state, and primary actions
 */
function detectPageContext() {
  const url = window.location.href.toLowerCase();
  const title = document.title.toLowerCase();
  const hostname = window.location.hostname.toLowerCase();
  const h1Text = document.querySelector('h1')?.textContent?.toLowerCase() || '';
  const bodyText = document.body?.innerText?.toLowerCase() || '';

  // Detect page type from URL patterns, content, and structure
  const pageTypes = {
    login: /login|signin|sign-in|sign_in|auth|logon|log-on/.test(url + title) ||
           document.querySelector('input[type="password"]') !== null,

    signup: /signup|sign-up|register|create.*account|join/.test(url + title),

    search: /search|results|query|q=|s\?|\/s\//.test(url) ||
            document.querySelector('[role="search"], [type="search"]') !== null,

    checkout: /checkout|payment|cart|basket|order|purchase/.test(url + title),

    product: /product|item|\/dp\/|\/p\/|\/pd\/|detail/.test(url) ||
             document.querySelector('[itemtype*="Product"], .product-details, #product') !== null,

    form: document.forms.length > 0 &&
          document.querySelectorAll('input:not([type="hidden"]), select, textarea').length >= 2,

    listing: document.querySelectorAll('[class*="result"], [class*="item"], [class*="card"], [class*="listing"]').length > 5,

    article: document.querySelector('article, [itemtype*="Article"], .post-content, .article-body') !== null,

    settings: /settings|preferences|profile|account|config/.test(url + title),

    dashboard: /dashboard|admin|panel|overview|home/.test(url + title) &&
               document.querySelectorAll('[class*="widget"], [class*="card"], [class*="stat"]').length > 2,

    messaging: /message|inbox|chat|conversation|compose/.test(url + title) ||
               document.querySelector('[class*="message"], [class*="chat"], [aria-label*="message"]') !== null
  };

  // Detect primary interactive actions available on the page
  const primaryActions = [];

  // Find submit/action buttons
  const actionButtons = document.querySelectorAll(
    'button[type="submit"], input[type="submit"], ' +
    'button.primary, button.btn-primary, .btn-primary, ' +
    '[class*="submit"], [class*="send"], [class*="save"], ' +
    'button:not([type="button"]):not([disabled])'
  );

  actionButtons.forEach(el => {
    if (!isElementVisible(el)) return;

    const text = (el.textContent?.trim() || el.value || '').toLowerCase();
    const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase();
    const combined = text + ' ' + ariaLabel;

    let actionType = 'unknown';
    if (/submit|send|post|save|confirm|done|finish|complete|continue|next|proceed/.test(combined)) {
      actionType = 'submit';
    } else if (/search|find|look|go/.test(combined)) {
      actionType = 'search';
    } else if (/login|sign.?in|log.?in/.test(combined)) {
      actionType = 'login';
    } else if (/signup|sign.?up|register|create|join/.test(combined)) {
      actionType = 'signup';
    } else if (/buy|purchase|add.?to.?cart|checkout|pay/.test(combined)) {
      actionType = 'purchase';
    } else if (/cancel|back|close|dismiss|no|decline/.test(combined)) {
      actionType = 'cancel';
    } else if (/delete|remove|clear/.test(combined)) {
      actionType = 'delete';
    }

    if (actionType !== 'unknown' || text.length > 0) {
      primaryActions.push({
        text: text.substring(0, 50),
        selector: generateSelector(el),
        type: actionType,
        ariaLabel: el.getAttribute('aria-label')
      });
    }
  });

  // Limit to most relevant actions
  const limitedActions = primaryActions.slice(0, 5);

  // Detect page state (errors, success, loading)
  const pageState = {
    hasErrors: document.querySelector(
      '[class*="error"]:not([class*="no-error"]), [role="alert"][class*="error"], ' +
      '.alert-danger, .alert-error, .error-message, [aria-invalid="true"]'
    ) !== null,

    hasSuccess: document.querySelector(
      '[class*="success"], .alert-success, .success-message, [role="status"][class*="success"]'
    ) !== null,

    isLoading: document.querySelector(
      '[class*="loading"], [class*="spinner"], [aria-busy="true"], ' +
      '.loader, .progress, [class*="skeleton"]'
    ) !== null,

    hasModal: document.querySelector(
      '[role="dialog"], [class*="modal"][class*="show"], [class*="overlay"][class*="visible"]'
    ) !== null,

    hasCaptcha: document.querySelector(
      '.g-recaptcha, .h-captcha, [class*="captcha"], iframe[src*="recaptcha"]'
    ) !== null,

    errorMessages: extractErrorMessages()
  };

  // Infer overall page intent
  const pageIntent = inferPageIntent(pageTypes, limitedActions, pageState);

  automationLogger.logDOMOperation(currentSessionId, 'page_context', {
    pageTypes: Object.entries(pageTypes).filter(([k, v]) => v).map(([k]) => k),
    pageIntent,
    primaryActionsCount: limitedActions.length,
    hasErrors: pageState.hasErrors,
    hasSuccess: pageState.hasSuccess,
    isLoading: pageState.isLoading
  });

  return {
    pageTypes,
    primaryActions: limitedActions,
    pageState,
    pageIntent,
    url: window.location.href,
    hostname: hostname,
    title: document.title
  };
}

/**
 * Extract visible error messages from the page
 * @returns {Array<string>} List of error messages found
 */
function extractErrorMessages() {
  const errorMessages = [];

  // Common error element selectors
  const errorSelectors = [
    '[class*="error-message"]',
    '[class*="error-text"]',
    '[role="alert"]',
    '.alert-danger',
    '.alert-error',
    '[aria-live="assertive"]',
    '.form-error',
    '.field-error',
    '.validation-error'
  ];

  errorSelectors.forEach(selector => {
    document.querySelectorAll(selector).forEach(el => {
      const text = el.textContent?.trim();
      if (text && text.length > 5 && text.length < 200 && isElementVisible(el)) {
        if (!errorMessages.includes(text)) {
          errorMessages.push(text);
        }
      }
    });
  });

  return errorMessages.slice(0, 5); // Limit to 5 most visible errors
}

/**
 * Check if an element is visible on the page
 * @param {Element} el - DOM element to check
 * @returns {boolean} Whether the element is visible
 */
function isElementVisible(el) {
  if (!el) return false;

  const rect = el.getBoundingClientRect();
  const style = window.getComputedStyle(el);

  return rect.width > 0 &&
         rect.height > 0 &&
         style.display !== 'none' &&
         style.visibility !== 'hidden' &&
         style.opacity !== '0';
}

/**
 * Infer the primary intent/purpose of the current page
 * @param {Object} pageTypes - Detected page types
 * @param {Array} primaryActions - Available primary actions
 * @param {Object} pageState - Current page state
 * @returns {string} The inferred page intent
 */
function inferPageIntent(pageTypes, primaryActions, pageState) {
  // Priority-based intent inference
  if (pageState.hasCaptcha) return 'captcha-challenge';
  if (pageState.hasErrors && pageTypes.form) return 'form-error-correction';
  if (pageState.hasSuccess) return 'success-confirmation';
  if (pageState.isLoading) return 'waiting-for-content';

  if (pageTypes.login) return 'authentication';
  if (pageTypes.signup) return 'registration';
  if (pageTypes.checkout) return 'purchase-flow';
  if (pageTypes.product) return 'product-evaluation';
  if (pageTypes.search) return 'search-results-review';
  if (pageTypes.form) return 'data-entry';
  if (pageTypes.listing) return 'browse-options';
  if (pageTypes.messaging) return 'communication';
  if (pageTypes.settings) return 'configuration';
  if (pageTypes.dashboard) return 'overview-monitoring';
  if (pageTypes.article) return 'content-consumption';

  // Check primary actions for hints
  const hasSearchAction = primaryActions.some(a => a.type === 'search');
  const hasSubmitAction = primaryActions.some(a => a.type === 'submit');
  const hasPurchaseAction = primaryActions.some(a => a.type === 'purchase');

  if (hasPurchaseAction) return 'shopping';
  if (hasSearchAction) return 'search-initiation';
  if (hasSubmitAction) return 'form-submission';

  return 'general-browsing';
}

/**
 * Extract e-commerce product listings with semantic information
 * Detects product cards on Amazon, eBay, Walmart, etc. and extracts structured data
 * @returns {Object} E-commerce context with product listings
 */
function extractEcommerceProducts() {
  const isEcommerceSite = /amazon|ebay|walmart|bestbuy|target|newegg|etsy|aliexpress|shopping/i.test(window.location.hostname);
  const isSearchResults = /s\?|search|results|browse/i.test(window.location.href);

  if (!isEcommerceSite && !isSearchResults) {
    return null;
  }

  automationLogger.logDOMOperation(currentSessionId, 'ecommerce_detect', { hostname: window.location.hostname });

  const products = [];

  // Amazon-specific selectors
  const amazonSelectors = {
    productCard: '[data-component-type="s-search-result"], .s-result-item[data-asin]',
    title: 'h2 a span, .a-size-medium.a-text-normal, .a-size-base-plus',
    price: '.a-price .a-offscreen, .a-price-whole',
    rating: '.a-icon-star-small .a-icon-alt, .a-icon-star .a-icon-alt',
    reviewCount: '.a-size-base.s-underline-text',
    sponsored: '.s-label-popover-default, [data-component-type="sp-sponsored-result"]',
    prime: '.a-icon-prime, .s-prime',
    seller: '.a-row.a-size-base .a-size-base'
  };

  // eBay-specific selectors
  const ebaySelectors = {
    productCard: '.s-item, .srp-results .s-item__wrapper',
    title: '.s-item__title, .s-item__title--has-tags',
    price: '.s-item__price',
    rating: '.x-star-rating',
    sponsored: '.s-item__ad-badge'
  };

  // Walmart-specific selectors
  const walmartSelectors = {
    productCard: '[data-item-id], .search-result-gridview-item',
    title: '[data-automation-id="product-title"], .product-title-link',
    price: '[data-automation-id="product-price"], .price-main',
    rating: '.stars-container, .rating-number'
  };

  // Generic e-commerce selectors (fallback)
  const genericSelectors = {
    productCard: '[class*="product-card"], [class*="product-item"], [class*="search-result"], [data-testid*="product"]',
    title: '[class*="product-title"], [class*="item-title"], h3, h2',
    price: '[class*="price"], [class*="cost"], [data-testid*="price"]',
    rating: '[class*="rating"], [class*="stars"], [class*="review"]',
    sponsored: '[class*="sponsored"], [class*="ad-badge"], [class*="promoted"]'
  };

  // Detect which site and use appropriate selectors
  let selectors = genericSelectors;
  if (/amazon/i.test(window.location.hostname)) {
    selectors = amazonSelectors;
  } else if (/ebay/i.test(window.location.hostname)) {
    selectors = ebaySelectors;
  } else if (/walmart/i.test(window.location.hostname)) {
    selectors = walmartSelectors;
  }

  // Find all product cards
  const productCards = document.querySelectorAll(selectors.productCard);
  automationLogger.logDOMOperation(currentSessionId, 'ecommerce_cards_found', { count: productCards.length });

  productCards.forEach((card, index) => {
    if (index >= 20) return; // Limit to first 20 products for context

    try {
      // Extract title
      const titleEl = card.querySelector(selectors.title);
      const title = titleEl?.textContent?.trim() || '';

      // Skip if no title (likely not a real product)
      if (!title || title.length < 3) return;

      // Extract price
      const priceEl = card.querySelector(selectors.price);
      let price = priceEl?.textContent?.trim() || '';
      // Clean up price - extract just the number
      const priceMatch = price.match(/[\$\d,\.]+/);
      price = priceMatch ? priceMatch[0] : price;

      // Extract rating
      const ratingEl = card.querySelector(selectors.rating);
      let rating = ratingEl?.textContent?.trim() || '';
      // Extract star rating number
      const ratingMatch = rating.match(/[\d\.]+/);
      rating = ratingMatch ? ratingMatch[0] + ' stars' : rating;

      // Extract review count
      const reviewEl = card.querySelector(selectors.reviewCount);
      const reviewCount = reviewEl?.textContent?.trim() || '';

      // Check if sponsored/ad
      const sponsoredEl = card.querySelector(selectors.sponsored);
      const isSponsored = !!sponsoredEl || /sponsor|ad|promoted/i.test(card.className);

      // Check for Prime badge (Amazon)
      const primeEl = card.querySelector(selectors.prime);
      const isPrime = !!primeEl;

      // Get the clickable link
      const linkEl = card.querySelector('a[href*="/dp/"], a[href*="/itm/"], a[href*="/ip/"], a[href]');
      const productLink = linkEl?.href || '';

      // Generate a reliable selector for this product card
      const cardSelector = generateSelector(card);

      // Get the ASIN or product ID if available
      const asin = card.getAttribute('data-asin') || card.getAttribute('data-item-id') || '';

      products.push({
        index: index + 1,
        title: title.substring(0, 150), // Truncate long titles
        price: price,
        rating: rating,
        reviewCount: reviewCount,
        isSponsored: isSponsored,
        isPrime: isPrime,
        productId: asin,
        selector: cardSelector,
        linkSelector: linkEl ? generateSelector(linkEl) : cardSelector + ' a',
        productUrl: productLink.substring(0, 200)
      });
    } catch (e) {
      automationLogger.warn('Error extracting product', { sessionId: currentSessionId, index, error: e.message });
    }
  });

  if (products.length === 0) {
    return null;
  }

  automationLogger.logDOMOperation(currentSessionId, 'ecommerce_extracted', { productCount: products.length });

  return {
    isEcommercePage: true,
    site: window.location.hostname,
    productCount: products.length,
    products: products
  };
}

/**
 * Extracts and structures DOM information for AI processing
 * ENHANCED: Viewport-first traversal for better performance
 * @param {Object} options - Configuration options for DOM extraction
 * @param {boolean} options.useDiffing - Whether to use DOM diffing for optimization
 * @param {boolean} options.prioritizeViewport - Whether to prioritize visible elements
 * @param {boolean} options.viewportOnlyMode - Capture ONLY viewport elements (60-70% prompt reduction)
 * @param {number} options.maxElements - Maximum number of elements to extract
 * @param {boolean} options.includeAllAttributes - Whether to include all element attributes
 * @param {boolean} options.includeComputedStyles - Whether to include computed styles
 * @returns {Object} Structured DOM representation with elements, context, and metadata
 */
function getStructuredDOM(options = {}) {
  // PERFORMANCE FIX: Reduced defaults to prevent 135k-191k char payloads that cause API timeouts
  // Target: Keep prompts under 50k chars (~15k tokens) for reliable 30s responses
  const {
    useDiffing = false, // Disable diffing to get full context
    prioritizeViewport = true, // Viewport-first for performance
    viewportOnlyMode = true, // Viewport-only mode: AI can scroll to reveal more content when needed, keeps payloads smaller
    maxElements = 300, // REDUCED from 2000 - 300 is sufficient for most pages
    includeAllAttributes = false, // CHANGED: Only include essential attributes
    includeComputedStyles = false // CHANGED: Skip computed styles to save ~40% payload
  } = options;

  // PERFORMANCE: Viewport dimensions for prioritization
  const viewportRect = {
    top: 0,
    left: 0,
    bottom: window.innerHeight,
    right: window.innerWidth
  };

  // PERFORMANCE: Separate collections for viewport vs offscreen elements
  const viewportElements = [];
  const offscreenElements = [];
  let totalElementCount = 0;

  // Also extract raw HTML for better context
  const relevantHTML = extractRelevantHTML();

  // Helper to check if element is in viewport
  function isInViewportRect(rect) {
    return rect.bottom >= viewportRect.top &&
           rect.top <= viewportRect.bottom &&
           rect.right >= viewportRect.left &&
           rect.left <= viewportRect.right;
  }

  function traverse(node, depth = 0) {
    // Use combined count for limit
    const currentTotal = viewportElements.length + offscreenElements.length;
    if (currentTotal >= maxElements || depth > 10) return;
    
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
      const semanticId = generateSemanticElementId(node, totalElementCount);
      
      // Log semantic ID generation for debugging (only in verbose mode)
      // Debug logging removed to reduce noise - IDs are visible in DOM structure
      
      const elementData = {
        // Unique element identifier with semantic naming
        elementId: semanticId,
        type: node.tagName.toLowerCase(),
        // Human-readable description
        description: generateElementDescription(node),
        // NEW: Semantic purpose classification
        purpose: inferElementPurpose(node),
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
        // Accessibility tree properties (Playwright MCP-inspired)
        accessibilityName: computeAccessibleName(node),
        implicitRole: getImplicitRole(node),
        ariaRelationships: getARIARelationships(node),
        actionability: isElementActionable(node),
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
      
      // PERFORMANCE: Sort elements into viewport vs offscreen collections
      const inViewport = isInViewportRect(rect);
      if (inViewport) {
        viewportElements.push(elementData);
      } else if (!viewportOnlyMode) {
        // Only collect offscreen elements if not in viewport-only mode
        offscreenElements.push(elementData);
      }
      totalElementCount++;

        // Traverse children
        for (const child of node.children) {
          traverse(child, depth + 1);
        }

        // Traverse shadow DOM if present
        if (node.shadowRoot && node.shadowRoot.mode === 'open') {
          automationLogger.logDOMOperation(currentSessionId, 'shadow_dom_found', { tagName: node.tagName, id: node.id || node.className });

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
      automationLogger.error('Error processing DOM node - CRITICAL', {
        sessionId: currentSessionId,
        error: error.message,
        stack: error.stack,
        nodeTag: node?.tagName,
        nodeId: node?.id
      });
      // Log to console for immediate visibility during debugging
      console.error('[FSB] DOM traverse error:', error);
      // Continue processing other nodes even if one fails
    }
  }

  traverse(document.body);

  // PERFORMANCE: Combine viewport and offscreen elements with viewport priority
  let elements;
  let viewportBudget;
  let offscreenBudget;
  let importantOffscreen = [];

  if (viewportOnlyMode) {
    // Viewport-only mode: use full budget for viewport elements only
    // AI can use scroll/click tools to reveal more content when needed
    viewportBudget = maxElements;
    offscreenBudget = 0;
    elements = viewportElements.slice(0, maxElements);
  } else {
    // Legacy mode: 70/30 split between viewport and important offscreen elements
    viewportBudget = Math.min(viewportElements.length, Math.floor(maxElements * 0.7));
    offscreenBudget = Math.min(
      offscreenElements.length,
      maxElements - viewportBudget
    );

    // Filter offscreen elements to only include important ones
    importantOffscreen = offscreenElements
      .filter(el => el.isButton || el.isInput || el.isLink ||
                    el.attributes?.['data-testid'] || el.attributes?.['aria-label'] ||
                    el.isCaptcha)
      .slice(0, offscreenBudget);

    // Combine: viewport elements first, then important offscreen elements
    elements = [
      ...viewportElements.slice(0, viewportBudget),
      ...importantOffscreen
    ];
  }

  // Log viewport-first performance stats
  automationLogger.logDOMOperation(currentSessionId, 'viewport_first_collection', {
    viewportOnlyMode,
    viewportElements: viewportElements.length,
    offscreenElements: viewportOnlyMode ? 0 : offscreenElements.length,
    viewportBudget,
    offscreenBudget,
    importantOffscreenIncluded: importantOffscreen.length,
    totalCombined: elements.length
  });

  // Apply optimizations (legacy path for backwards compatibility)
  let processedElements = elements;

  // Apply viewport prioritization (additional sorting if needed)
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
  
  // Detect page context for semantic understanding
  const pageContext = detectPageContext();

  // Build the base DOM structure
  const domStructure = {
    elements: elementsToSend,
    htmlContext: relevantHTML, // Add HTML context for better AI understanding
    // NEW: Page context for semantic understanding
    pageContext: pageContext,
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
    captchaPresent: elements.some(el => el.isCaptcha) || pageContext.pageState.hasCaptcha,
    // E-commerce product extraction for shopping intelligence
    ecommerceContext: extractEcommerceProducts(),
    timestamp: Date.now(),
    optimization: {
      totalElements: elements.length,
      sentElements: elementsToSend.length,
      usedDiffing: useDiffing,
      usedViewportPriority: prioritizeViewport,
      viewportOnlyMode: viewportOnlyMode
    }
  };
  
  // Use DOM State Manager for intelligent diffing if available
  if (domStateManager && options.useIncrementalDiff !== false) {
    automationLogger.logDOMOperation(currentSessionId, 'dom_capture_start', {
      totalElements: elements.length,
      filteredElements: elementsToSend.length,
      method: 'state_manager'
    });

    const optimizedPayload = domStateManager.generateOptimizedPayload(domStructure);

    // Add optimization metadata
    domStructure.optimization.diffType = optimizedPayload.type;
    domStructure.optimization.deltaSize = JSON.stringify(optimizedPayload).length;
    domStructure.optimization.fullSize = JSON.stringify(domStructure).length;
    domStructure.optimization.compressionRatio =
      (domStructure.optimization.fullSize - domStructure.optimization.deltaSize) / domStructure.optimization.fullSize;

    automationLogger.logDOMOperation(currentSessionId, 'dom_capture_optimized', {
      mode: optimizedPayload.type.toUpperCase(),
      fullSize: domStructure.optimization.fullSize,
      deltaSize: domStructure.optimization.deltaSize,
      compressionRatio: (domStructure.optimization.compressionRatio * 100).toFixed(1) + '%',
      savings: domStructure.optimization.fullSize - domStructure.optimization.deltaSize
    });
    
    // Return optimized payload
    // For delta updates, exclude the full elements array to prevent payload explosion
    if (optimizedPayload.type === 'delta') {
      // Remove elements from domStructure for delta payloads
      const { elements, ...domStructureWithoutElements } = domStructure;

      return {
        ...domStructureWithoutElements,
        ...optimizedPayload,
        _isDelta: true,
        // Only include element count for reference
        _totalElements: elements?.length || 0
      };
    }

    // For initial/full payloads, include everything
    return {
      ...domStructure,
      ...optimizedPayload,
      _isDelta: false
    };
  }
  
  // Apply compact serialization for better performance
  const useCompactFormat = options.useCompactFormat !== false;

  if (useCompactFormat && elementsToSend.length > 50) {
    automationLogger.logDOMOperation(currentSessionId, 'compact_serialization', { elementCount: elementsToSend.length });
    const serializer = new OptimizedDOMSerializer();
    const compactPayload = serializer.serialize(elementsToSend);

    // Calculate compression metrics
    const originalSize = JSON.stringify(elementsToSend).length;
    const compactSize = JSON.stringify(compactPayload).length;
    const compressionRatio = serializer.getCompressionRatio(elementsToSend, compactPayload);

    automationLogger.logDOMOperation(currentSessionId, 'compact_serialization_complete', {
      originalSize,
      compactSize,
      compressionRatio: (compressionRatio * 100).toFixed(1) + '%',
      stringTableSize: compactPayload.strings.length
    });
    
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
  
  automationLogger.logDOMOperation(currentSessionId, 'full_dom_capture', {
    totalElements: elements.length,
    sentElements: elementsToSend.length,
    payloadSize: JSON.stringify(domStructure).length
  });

  return domStructure;
}

// Async message handler with timeout support
async function handleAsyncMessage(request, sendResponse) {
  automationLogger.logComm(currentSessionId, 'handle', request.action, true, { type: 'async' });

  try {
    let result;
    const startTime = Date.now();

    switch (request.action) {
      case 'getDOM':
        automationLogger.logDOMOperation(currentSessionId, 'get_dom_start', {});
        // Enable incremental diff by default, can be disabled via request options
        const domOptions = {
          ...request.options,
          useIncrementalDiff: request.options?.useIncrementalDiff !== false
        };
        // FSB TIMING: Track getStructuredDOM time
        const domStart = Date.now();
        result = getStructuredDOM(domOptions);
        const domTime = Date.now() - domStart;
        automationLogger.logTiming(currentSessionId, 'DOM', 'getStructuredDOM', domTime, { elements: result.elements?.length || result._totalElements || 0 });
        if (result._isDelta) {
          automationLogger.logDOMOperation(currentSessionId, 'delta_diff_used', {
            compressionRatio: (result.optimization?.compressionRatio * 100).toFixed(1) + '%'
          });
        }
        sendResponse({ success: true, structuredDOM: result });
        break;
        
      case 'executeAction':
        const { tool, params } = request;
        automationLogger.logActionExecution(currentSessionId, tool, 'start', params);

        if (tools[tool]) {
          // Add timeout wrapper for long-running operations
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error(`Action ${tool} timed out after 10 seconds`)), 10000);
          });

          // FSB TIMING: Track action execution time in content script
          const execStart = Date.now();
          const actionPromise = tools[tool](params);
          result = await Promise.race([actionPromise, timeoutPromise]);
          automationLogger.logTiming(currentSessionId, 'ACTION', tool, Date.now() - execStart, { success: result?.success });

          // Validate result structure
          if (result === undefined || result === null) {
            automationLogger.warn('Action returned null/undefined result', { sessionId: currentSessionId, tool });
            sendResponse({
              success: false,
              error: `Action ${tool} returned no result`,
              tool: tool,
              executionTime: Date.now() - startTime
            });
          } else {
            // FIX: Pass through the action's success status directly
            // Previously we wrapped with {success: true} which masked action failures
            // The result object already has its own success field
            sendResponse({
              ...result,  // Spread result first (includes result.success)
              tool: tool,
              executionTime: Date.now() - startTime
            });
          }
        } else {
          automationLogger.error('Unknown tool requested', { sessionId: currentSessionId, tool });
          sendResponse({ success: false, error: `Unknown tool: ${tool}` });
        }
        break;

      default:
        automationLogger.error('Unknown async action', { sessionId: currentSessionId, action: request.action });
        sendResponse({ success: false, error: `Unknown action: ${request.action}` });
    }
  } catch (error) {
    automationLogger.error('Error in async message handler', { sessionId: currentSessionId, action: request.action, error: error.message });
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
  // Store sessionId from any incoming message for logging
  if (request.sessionId) {
    currentSessionId = request.sessionId;
  }

  automationLogger.logComm(currentSessionId, 'receive', request.action, true, { hasSessionId: !!request.sessionId });

  // Handle async operations properly by returning true to keep message channel open
  if (request.action === 'executeAction' || request.action === 'getDOM') {
    handleAsyncMessage(request, sendResponse);
    return true; // Keep message channel open for async response
  }
  
  switch (request.action) {
    case 'healthCheck':
      // Enhanced healthCheck with page readiness information
      const readiness = checkDocumentReady();
      sendResponse({
        success: true,
        healthy: true,
        ready: readiness.isReady,
        readyState: readiness.readyState,
        isLoading: readiness.isLoading,
        hasBlockingOverlay: readiness.hasBlockingOverlay,
        timestamp: Date.now()
      });
      break;

    case 'checkPageReady':
      // Detailed page readiness check for smart load detection
      const pageReadiness = checkDocumentReady();
      sendResponse({ success: true, ...pageReadiness });
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

    // Reset DOM state cache between sessions to prevent stale state comparison
    case 'resetDOMState':
      try {
        automationLogger.logDOMOperation(currentSessionId, 'reset_state', { reason: 'new_session' });
        domStateManager.reset();
        previousDOMState = null;
        domStateCache.clear();
        sendResponse({ success: true, message: 'DOM state reset successfully' });
      } catch (error) {
        automationLogger.error('Error resetting DOM state', { sessionId: currentSessionId, error: error.message });
        sendResponse({ success: false, error: error.message });
      }
      break;

    // Get frame context information for iframe-aware automation
    case 'getFrameContext':
      sendResponse({
        success: true,
        frameContext: frameContext,
        isMainFrame: !isInIframe
      });
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
      automationLogger.logDOMOperation(currentSessionId, 'significant_changes', { changeCount: accumulatedChanges });

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

// Start observing - with null check for fast-loading pages
if (document.body) {
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true
  });
  automationLogger.logInit('mutation_observer', 'started', { target: 'document.body' });
} else {
  // Body not ready yet, wait for it
  automationLogger.logInit('mutation_observer', 'waiting', { reason: 'document.body not ready' });
  const startObserver = () => {
    if (document.body) {
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true
      });
      automationLogger.logInit('mutation_observer', 'started_after_dom', {});
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startObserver);
  } else {
    // Already loaded but body still null? Try one more time
    setTimeout(startObserver, 100);
  }
}

automationLogger.logInit('content_script', 'loaded', { version: '0.9', url: window.location.href });

// Google-specific SPA navigation detection
// Google uses History API for navigation within search results
if (window.location.hostname.includes('google.com')) {
  const originalPushState = history.pushState;
  history.pushState = function(...args) {
    originalPushState.apply(this, args);
    chrome.runtime.sendMessage({
      action: 'spaNavigation',
      url: args[2],
      method: 'pushState'
    }).catch(() => {});
  };

  const originalReplaceState = history.replaceState;
  history.replaceState = function(...args) {
    originalReplaceState.apply(this, args);
    chrome.runtime.sendMessage({
      action: 'spaNavigation',
      url: args[2],
      method: 'replaceState'
    }).catch(() => {});
  };

  window.addEventListener('popstate', () => {
    chrome.runtime.sendMessage({
      action: 'spaNavigation',
      url: window.location.href,
      method: 'popstate'
    }).catch(() => {});
  });

  automationLogger.logInit('spa_detection', 'enabled', { hostname: 'google.com' });
}

// Establish persistent connection to background script
let backgroundPort = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;

function establishBackgroundConnection() {
  try {
    backgroundPort = chrome.runtime.connect({ name: 'content-script' });

    backgroundPort.onDisconnect.addListener(() => {
      backgroundPort = null;
      const lastError = chrome.runtime.lastError;
      automationLogger.warn('Background port disconnected', {
        error: lastError?.message,
        reconnectAttempts
      });

      // Attempt to reconnect with exponential backoff
      if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 10000);
        setTimeout(() => {
          reconnectAttempts++;
          establishBackgroundConnection();
        }, delay);
      }
    });

    backgroundPort.onMessage.addListener((msg) => {
      if (msg.type === 'heartbeat') {
        backgroundPort.postMessage({
          type: 'heartbeat-ack',
          timestamp: Date.now()
        });
      }
    });

    // Reset reconnect counter on successful connection
    reconnectAttempts = 0;

    // Send ready signal via port (most reliable method)
    backgroundPort.postMessage({
      type: 'ready',
      url: window.location.href,
      readyState: document.readyState,
      timestamp: Date.now()
    });

    automationLogger.logComm(currentSessionId, 'send', 'port_ready', true, {});
  } catch (e) {
    automationLogger.error('Failed to establish background connection', { error: e.message });
  }
}

// Signal to background script that content script is fully initialized and ready
// Uses multi-strategy approach for maximum reliability
(async function sendReadySignal() {
  // Strategy 1: Port-based connection (most reliable, bidirectional)
  establishBackgroundConnection();

  // Strategy 2: Message-based fallback with retries
  // This ensures we still work even if port connection fails
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      await chrome.runtime.sendMessage({
        action: 'contentScriptReady',
        timestamp: Date.now(),
        url: window.location.href,
        readyState: document.readyState,
        attempt
      });
      automationLogger.logComm(currentSessionId, 'send', 'contentScriptReady', true, { attempt });

      // Send confirmation ping after short delay
      await new Promise(resolve => setTimeout(resolve, 50));
      await chrome.runtime.sendMessage({
        action: 'contentScriptConfirmation',
        timestamp: Date.now(),
        url: window.location.href
      });
      automationLogger.logComm(currentSessionId, 'send', 'contentScriptConfirmation', true, {});
      break; // Success, exit retry loop
    } catch (e) {
      if (attempt < 5) {
        // Exponential backoff: 100ms, 200ms, 400ms, 800ms
        await new Promise(r => setTimeout(r, 100 * Math.pow(2, attempt - 1)));
      } else {
        automationLogger.error('All ready signal attempts failed', { error: e.message });
      }
    }
  }
})();

// Global error handler for uncaught errors in content script
window.addEventListener('error', (event) => {
  automationLogger.error('Uncaught error in content script', {
    sessionId: currentSessionId,
    error: event.error?.message,
    filename: event.filename,
    lineno: event.lineno
  });

  // Try to notify background script of the error
  try {
    chrome.runtime.sendMessage({
      action: 'contentScriptError',
      error: event.error?.message || 'Unknown error',
      stack: event.error?.stack || '',
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      url: window.location.href,
      timestamp: Date.now()
    }).catch(() => {
      // Can't even send error message
      automationLogger.error('Could not send error report to background', { sessionId: currentSessionId });
    });
  } catch (e) {
    automationLogger.error('Error in error handler', { sessionId: currentSessionId, error: e.message });
  }
});

// Global promise rejection handler
window.addEventListener('unhandledrejection', (event) => {
  automationLogger.error('Unhandled promise rejection in content script', { sessionId: currentSessionId, reason: String(event.reason) });

  // Try to notify background script
  try {
    chrome.runtime.sendMessage({
      action: 'contentScriptError',
      error: `Unhandled promise rejection: ${event.reason}`,
      url: window.location.href,
      timestamp: Date.now()
    }).catch(() => {
      automationLogger.error('Could not send rejection report to background', { sessionId: currentSessionId });
    });
  } catch (e) {
    automationLogger.error('Error in rejection handler', { sessionId: currentSessionId, error: e.message });
  }
});