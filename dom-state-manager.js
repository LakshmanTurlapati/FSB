/**
 * DOM State Manager for FSB Extension
 * Handles incremental DOM diffing to reduce AI context payload
 */

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
    const hash = `${element.type}|${element.id || ''}|${element.class || ''}|${text}|${element.position?.x || 0},${element.position?.y || 0}`;
    return btoa(hash).replace(/[^a-zA-Z0-9]/g, '').substring(0, 16);
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
    const diff = this.computeDiff(currentDOM);
    
    // For initial load, return filtered full DOM
    if (diff.isInitial) {
      return {
        type: 'initial',
        elements: this.filterAndCompressElements(diff.added),
        htmlContext: this.compressHTMLContext(currentDOM.htmlContext),
        metadata: {
          totalElements: diff.metadata.totalElements,
          includedElements: diff.added.length
        }
      };
    }
    
    // For updates, return only changes
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
      payload.htmlContext = this.compressHTMLContext(currentDOM.htmlContext);
    }
    
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

// Export for use in content script
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DOMStateManager;
}