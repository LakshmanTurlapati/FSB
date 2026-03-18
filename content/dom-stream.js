// content/dom-stream.js -- FSB DOM Streaming Module
// Serializes full DOM snapshots, streams incremental MutationObserver diffs,
// tracks scroll position, and responds to stream control messages from background.js.
// Depends on: content/init.js (FSB namespace), content/visual-feedback.js (overlay reading)

(function() {
  if (window.__FSB_SKIP_INIT__) return;

  var FSB = window.FSB;
  var logger = FSB.logger;

  // --- Module state ---
  var streaming = false;
  var mutationObserver = null;
  var batchTimer = null;
  var pendingMutations = [];
  var nextNodeId = 1;
  var scrollHandler = null;
  var lastScrollSend = 0;

  // Attributes that need URL absolutification
  var URL_ATTRS = ['src', 'href', 'action', 'poster', 'data'];

  // Computed style properties to capture for visual fidelity
  var STYLE_PROPS = [
    'display', 'position', 'width', 'height', 'margin', 'padding',
    'background', 'color', 'fontSize', 'fontFamily', 'border',
    'borderRadius', 'opacity', 'visibility', 'overflow',
    'flexDirection', 'alignItems', 'justifyContent', 'gap',
    'gridTemplateColumns', 'gridTemplateRows', 'transform',
    'boxShadow', 'textAlign', 'lineHeight', 'fontWeight',
    'zIndex', 'maxWidth', 'minHeight'
  ];

  // CSS property name mapping (camelCase -> kebab-case)
  var STYLE_PROP_CSS = [
    'display', 'position', 'width', 'height', 'margin', 'padding',
    'background', 'color', 'font-size', 'font-family', 'border',
    'border-radius', 'opacity', 'visibility', 'overflow',
    'flex-direction', 'align-items', 'justify-content', 'gap',
    'grid-template-columns', 'grid-template-rows', 'transform',
    'box-shadow', 'text-align', 'line-height', 'font-weight',
    'z-index', 'max-width', 'min-height'
  ];

  // Default computed style values to skip (reduces payload size)
  var STYLE_DEFAULTS = {
    display: 'block',
    position: 'static',
    opacity: '1',
    visibility: 'visible',
    overflow: 'visible',
    transform: 'none',
    boxShadow: 'none',
    zIndex: 'auto'
  };

  // =========================================================================
  // 1. DOM Serializer
  // =========================================================================

  /**
   * Check if an element should be skipped during serialization.
   * Skips FSB overlay elements and their children.
   * @param {Element} el
   * @returns {boolean}
   */
  function isFsbOverlay(el) {
    if (el.hasAttribute && el.hasAttribute('data-fsb-overlay')) return true;
    if (el.closest && el.closest('[data-fsb-overlay]')) return true;
    // Check if inside an FSB shadow root
    var root = el.getRootNode();
    if (root instanceof ShadowRoot && root.host && root.host.className &&
        typeof root.host.className === 'string' && root.host.className.indexOf('fsb') !== -1) {
      return true;
    }
    return false;
  }

  /**
   * Absolutify a URL attribute value relative to the current document.
   * @param {string} val - The attribute value
   * @returns {string} Absolute URL or original value if invalid
   */
  function absolutifyUrl(val) {
    if (!val || val.startsWith('data:') || val.startsWith('blob:') || val.startsWith('javascript:')) {
      return val;
    }
    try {
      return new URL(val, document.baseURI).href;
    } catch (e) {
      return val;
    }
  }

  /**
   * Absolutify srcset attribute (comma-separated URL descriptors).
   * @param {string} srcset
   * @returns {string}
   */
  function absolutifySrcset(srcset) {
    if (!srcset) return srcset;
    return srcset.split(',').map(function(entry) {
      var parts = entry.trim().split(/\s+/);
      if (parts.length > 0) {
        parts[0] = absolutifyUrl(parts[0]);
      }
      return parts.join(' ');
    }).join(', ');
  }

  /**
   * Capture key computed styles for an element that has non-default styling.
   * Only captures styles for elements that have a style attribute or classes.
   * @param {Element} original - The original DOM element (for getComputedStyle)
   * @param {Element} clone - The cloned element to set inline styles on
   */
  function captureComputedStyles(original, clone) {
    // Heuristic: only capture computed styles if element has style attr or classes
    if (!original.getAttribute('style') && !original.className) return;

    try {
      var computed = window.getComputedStyle(original);
      var styles = [];

      for (var i = 0; i < STYLE_PROPS.length; i++) {
        var val = computed[STYLE_PROPS[i]];
        if (!val || val === '' || val === STYLE_DEFAULTS[STYLE_PROPS[i]]) continue;
        // Skip values that are just the default 0px/normal/etc
        if (val === '0px' || val === 'normal' || val === 'none' || val === 'auto') {
          if (!STYLE_DEFAULTS[STYLE_PROPS[i]]) continue;
        }
        styles.push(STYLE_PROP_CSS[i] + ':' + val);
      }

      if (styles.length > 0) {
        clone.setAttribute('style', styles.join(';'));
      }
    } catch (e) {
      // getComputedStyle can fail for detached elements
    }
  }

  /**
   * Create an iframe placeholder div element.
   * @param {Document} doc - The document to create the element in
   * @returns {Element}
   */
  function createIframePlaceholder(doc) {
    var div = doc.createElement('div');
    div.setAttribute('data-fsb-iframe-placeholder', '');
    div.setAttribute('style',
      'width:100%;height:200px;background:#e5e7eb;border:1px dashed #9ca3af;' +
      'display:flex;align-items:center;justify-content:center;color:#6b7280;font-size:14px;'
    );
    div.textContent = 'iframe';
    return div;
  }

  /**
   * Serialize the full DOM body into a clean HTML string.
   * Strips scripts, absolutifies URLs, assigns data-fsb-nid attributes,
   * replaces iframes with placeholders, and captures computed styles.
   *
   * @returns {Object} { html, stylesheets, scrollX, scrollY, viewportWidth, viewportHeight,
   *                     pageWidth, pageHeight, url, title }
   */
  function serializeDOM() {
    // Reset node ID counter for each full snapshot
    nextNodeId = 1;

    // Clone the body for transformation
    var clone = document.body.cloneNode(true);

    // Build a map from original elements to cloned elements for computed style capture.
    // Walk original body and clone in parallel using TreeWalker.
    var origWalker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_ELEMENT,
      null
    );
    var cloneWalker = document.createTreeWalker(
      clone,
      NodeFilter.SHOW_ELEMENT,
      null
    );

    // Collect elements to process (TreeWalker is live, so modifying during walk is risky)
    var pairs = [];
    var origEl = origWalker.nextNode();
    var cloneEl = cloneWalker.nextNode();
    while (origEl && cloneEl) {
      pairs.push({ orig: origEl, clone: cloneEl });
      origEl = origWalker.nextNode();
      cloneEl = cloneWalker.nextNode();
    }

    // Elements to remove from clone (scripts, noscript, FSB overlays)
    var toRemove = [];

    for (var i = 0; i < pairs.length; i++) {
      var orig = pairs[i].orig;
      var cl = pairs[i].clone;
      var tag = cl.tagName ? cl.tagName.toLowerCase() : '';

      // Skip script and noscript tags
      if (tag === 'script' || tag === 'noscript') {
        toRemove.push(cl);
        continue;
      }

      // Skip FSB overlay elements
      if (cl.hasAttribute('data-fsb-overlay')) {
        toRemove.push(cl);
        continue;
      }
      // Check if inside an FSB overlay (in the clone tree)
      if (cl.closest && cl.closest('[data-fsb-overlay]')) {
        // Parent will be removed; skip
        continue;
      }

      // Replace iframes with placeholder
      if (tag === 'iframe') {
        var placeholder = createIframePlaceholder(clone.ownerDocument || document);
        if (cl.parentNode) {
          cl.parentNode.replaceChild(placeholder, cl);
        }
        continue;
      }

      // Assign data-fsb-nid
      cl.setAttribute('data-fsb-nid', String(nextNodeId++));

      // Absolutify URL attributes
      for (var a = 0; a < URL_ATTRS.length; a++) {
        var attrVal = cl.getAttribute(URL_ATTRS[a]);
        if (attrVal) {
          cl.setAttribute(URL_ATTRS[a], absolutifyUrl(attrVal));
        }
      }

      // Absolutify srcset
      var srcsetVal = cl.getAttribute('srcset');
      if (srcsetVal) {
        cl.setAttribute('srcset', absolutifySrcset(srcsetVal));
      }

      // Capture computed styles from original element
      captureComputedStyles(orig, cl);
    }

    // Remove marked elements
    for (var r = 0; r < toRemove.length; r++) {
      if (toRemove[r].parentNode) {
        toRemove[r].parentNode.removeChild(toRemove[r]);
      }
    }

    // Collect stylesheet URLs from document.head
    var stylesheets = [];
    var links = document.querySelectorAll('head link[rel="stylesheet"]');
    for (var s = 0; s < links.length; s++) {
      var href = links[s].getAttribute('href');
      if (href) {
        stylesheets.push(absolutifyUrl(href));
      }
    }

    return {
      html: clone.innerHTML,
      stylesheets: stylesheets,
      scrollX: window.scrollX,
      scrollY: window.scrollY,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      pageWidth: document.documentElement.scrollWidth,
      pageHeight: document.documentElement.scrollHeight,
      url: location.href,
      title: document.title
    };
  }

  // =========================================================================
  // 2. MutationObserver Streaming
  // =========================================================================

  /**
   * Absolutify URLs in an HTML string fragment (for added nodes).
   * @param {Element} el - Element whose outerHTML to process
   * @returns {string} Processed outerHTML
   */
  function processAddedNode(el) {
    // Assign nid to the added node and its descendants
    if (el.nodeType === Node.ELEMENT_NODE) {
      el.setAttribute('data-fsb-nid', String(nextNodeId++));

      // Absolutify URL attributes on the node itself
      for (var a = 0; a < URL_ATTRS.length; a++) {
        var val = el.getAttribute(URL_ATTRS[a]);
        if (val) el.setAttribute(URL_ATTRS[a], absolutifyUrl(val));
      }
      var srcset = el.getAttribute('srcset');
      if (srcset) el.setAttribute('srcset', absolutifySrcset(srcset));

      // Process descendant elements
      var descendants = el.querySelectorAll('*');
      for (var d = 0; d < descendants.length; d++) {
        var desc = descendants[d];
        desc.setAttribute('data-fsb-nid', String(nextNodeId++));
        for (var b = 0; b < URL_ATTRS.length; b++) {
          var dv = desc.getAttribute(URL_ATTRS[b]);
          if (dv) desc.setAttribute(URL_ATTRS[b], absolutifyUrl(dv));
        }
        var ds = desc.getAttribute('srcset');
        if (ds) desc.setAttribute('srcset', absolutifySrcset(ds));
      }
    }
    return el.outerHTML || '';
  }

  /**
   * Process a batch of accumulated mutations into diff objects.
   * @param {MutationRecord[]} mutations
   * @returns {Array} Array of diff objects
   */
  function processMutationBatch(mutations) {
    var diffs = [];

    for (var i = 0; i < mutations.length; i++) {
      var m = mutations[i];

      // Skip mutations on FSB overlay elements
      if (m.target && m.target.nodeType === Node.ELEMENT_NODE && isFsbOverlay(m.target)) {
        continue;
      }
      if (m.target && m.target.nodeType === Node.TEXT_NODE &&
          m.target.parentElement && isFsbOverlay(m.target.parentElement)) {
        continue;
      }

      if (m.type === 'childList') {
        // Added nodes
        for (var a = 0; a < m.addedNodes.length; a++) {
          var added = m.addedNodes[a];
          if (added.nodeType === Node.ELEMENT_NODE) {
            if (isFsbOverlay(added)) continue;

            var parentNid = m.target.dataset ? m.target.dataset.fsbNid : null;
            if (!parentNid) continue; // Parent not tracked

            var html = processAddedNode(added);
            var nextSib = added.nextElementSibling;
            var beforeNid = (nextSib && nextSib.dataset) ? nextSib.dataset.fsbNid || null : null;

            diffs.push({
              op: 'add',
              parentNid: parentNid,
              html: html,
              beforeNid: beforeNid
            });
          }
        }

        // Removed nodes
        for (var r = 0; r < m.removedNodes.length; r++) {
          var removed = m.removedNodes[r];
          if (removed.nodeType === Node.ELEMENT_NODE) {
            var nid = removed.dataset ? removed.dataset.fsbNid : null;
            if (!nid) continue; // Not tracked
            diffs.push({ op: 'rm', nid: nid });
          }
        }
      } else if (m.type === 'attributes') {
        var targetNid = m.target.dataset ? m.target.dataset.fsbNid : null;
        if (!targetNid) continue;

        var attrVal = m.target.getAttribute(m.attributeName);
        // Absolutify URL attributes in mutations
        if (URL_ATTRS.indexOf(m.attributeName) !== -1 && attrVal) {
          attrVal = absolutifyUrl(attrVal);
        }
        if (m.attributeName === 'srcset' && attrVal) {
          attrVal = absolutifySrcset(attrVal);
        }

        diffs.push({
          op: 'attr',
          nid: targetNid,
          attr: m.attributeName,
          val: attrVal
        });
      } else if (m.type === 'characterData') {
        var parentEl = m.target.parentElement;
        var textNid = parentEl && parentEl.dataset ? parentEl.dataset.fsbNid : null;
        if (!textNid) continue;

        diffs.push({
          op: 'text',
          nid: textNid,
          text: m.target.textContent
        });
      }
    }

    return diffs;
  }

  /**
   * Flush pending mutations: encode and send via chrome.runtime.sendMessage.
   */
  function flushMutations() {
    batchTimer = null;
    if (pendingMutations.length === 0) return;

    var batch = pendingMutations;
    pendingMutations = [];

    var diffs = processMutationBatch(batch);
    if (diffs.length === 0) return;

    try {
      chrome.runtime.sendMessage({
        action: 'domStreamMutations',
        mutations: diffs
      }).catch(function() {});
    } catch (e) {
      // Extension context may be invalidated
    }
  }

  /**
   * Start the MutationObserver stream on document.body.
   * Batches mutations on a 150ms debounce timer.
   */
  function startMutationStream() {
    if (mutationObserver) {
      mutationObserver.disconnect();
    }

    pendingMutations = [];

    mutationObserver = new MutationObserver(function(mutations) {
      // Accumulate mutations
      for (var i = 0; i < mutations.length; i++) {
        pendingMutations.push(mutations[i]);
      }

      // Debounce: clear existing timer, set new 150ms timer
      if (batchTimer) clearTimeout(batchTimer);
      batchTimer = setTimeout(flushMutations, 150);
    });

    mutationObserver.observe(document.body, {
      childList: true,
      attributes: true,
      characterData: true,
      subtree: true,
      attributeOldValue: true
    });

    logger.info('[DOM Stream] MutationObserver started');
  }

  /**
   * Stop the MutationObserver stream and flush any pending mutations.
   */
  function stopMutationStream() {
    if (batchTimer) {
      clearTimeout(batchTimer);
      batchTimer = null;
    }

    if (mutationObserver) {
      mutationObserver.disconnect();
      mutationObserver = null;
    }

    // Flush any remaining mutations
    if (pendingMutations.length > 0) {
      var batch = pendingMutations;
      pendingMutations = [];
      var diffs = processMutationBatch(batch);
      if (diffs.length > 0) {
        try {
          chrome.runtime.sendMessage({
            action: 'domStreamMutations',
            mutations: diffs
          }).catch(function() {});
        } catch (e) { /* ignore */ }
      }
    }

    logger.info('[DOM Stream] MutationObserver stopped');
  }

  // =========================================================================
  // 3. Scroll Tracker
  // =========================================================================

  /**
   * Start tracking scroll position changes.
   * Throttled to max 1 event per 200ms using timestamp check.
   */
  function startScrollTracker() {
    if (scrollHandler) {
      window.removeEventListener('scroll', scrollHandler);
    }

    lastScrollSend = 0;

    scrollHandler = function() {
      var now = Date.now();
      if (now - lastScrollSend < 200) return;
      lastScrollSend = now;

      try {
        chrome.runtime.sendMessage({
          action: 'domStreamScroll',
          scrollX: window.scrollX,
          scrollY: window.scrollY
        }).catch(function() {});
      } catch (e) { /* ignore */ }
    };

    window.addEventListener('scroll', scrollHandler, { passive: true });
    logger.info('[DOM Stream] Scroll tracker started');
  }

  /**
   * Stop tracking scroll position changes.
   */
  function stopScrollTracker() {
    if (scrollHandler) {
      window.removeEventListener('scroll', scrollHandler);
      scrollHandler = null;
    }
    logger.info('[DOM Stream] Scroll tracker stopped');
  }

  // =========================================================================
  // 4. Overlay Event Broadcaster
  // =========================================================================

  /**
   * Read current FSB overlay state (highlight glow + progress) and broadcast it.
   * Called by the background script via domStreamRequestOverlay message.
   */
  function broadcastOverlayState() {
    var glow = null;
    var progress = null;

    // Read HighlightManager active highlight position
    try {
      if (FSB.highlightManager && FSB.highlightManager.activeHighlight) {
        var el = FSB.highlightManager.activeHighlight;
        if (el && el.getBoundingClientRect) {
          var rect = el.getBoundingClientRect();
          glow = {
            x: rect.x,
            y: rect.y,
            w: rect.width,
            h: rect.height,
            state: 'active'
          };
        }
      }
    } catch (e) { /* ignore */ }

    // Read ProgressOverlay state if available
    try {
      if (FSB.progressOverlay) {
        var po = FSB.progressOverlay;
        if (po._percent !== undefined || po.percent !== undefined) {
          progress = {
            percent: po._percent || po.percent || 0,
            phase: po._phase || po.phase || '',
            eta: po._eta || po.eta || null
          };
        }
      }
    } catch (e) { /* ignore */ }

    try {
      chrome.runtime.sendMessage({
        action: 'domStreamOverlay',
        glow: glow,
        progress: progress
      }).catch(function() {});
    } catch (e) { /* ignore */ }
  }

  // =========================================================================
  // 5. Message Listener for Control Commands
  // =========================================================================

  chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    switch (request.action) {
      case 'domStreamStart':
        logger.info('[DOM Stream] Start requested');
        var snapshot = serializeDOM();
        try {
          chrome.runtime.sendMessage({
            action: 'domStreamSnapshot',
            snapshot: snapshot
          }).catch(function() {});
        } catch (e) { /* ignore */ }
        startMutationStream();
        startScrollTracker();
        streaming = true;
        sendResponse({ success: true });
        break;

      case 'domStreamStop':
        logger.info('[DOM Stream] Stop requested');
        stopMutationStream();
        stopScrollTracker();
        streaming = false;
        sendResponse({ success: true });
        break;

      case 'domStreamPause':
        logger.info('[DOM Stream] Pause requested');
        stopMutationStream();
        stopScrollTracker();
        // Keep streaming = true (paused state, not stopped)
        sendResponse({ success: true });
        break;

      case 'domStreamResume':
        logger.info('[DOM Stream] Resume requested -- sending fresh snapshot');
        var freshSnapshot = serializeDOM();
        try {
          chrome.runtime.sendMessage({
            action: 'domStreamSnapshot',
            snapshot: freshSnapshot
          }).catch(function() {});
        } catch (e) { /* ignore */ }
        startMutationStream();
        startScrollTracker();
        streaming = true;
        sendResponse({ success: true });
        break;

      case 'domStreamRequestOverlay':
        broadcastOverlayState();
        sendResponse({ success: true });
        break;
    }
  });

  // =========================================================================
  // 6. Module Registration
  // =========================================================================

  FSB.domStream = {
    serializeDOM: serializeDOM,
    startMutationStream: startMutationStream,
    stopMutationStream: stopMutationStream,
    startScrollTracker: startScrollTracker,
    stopScrollTracker: stopScrollTracker,
    broadcastOverlayState: broadcastOverlayState,
    isStreaming: function() { return streaming; }
  };

  window.FSB._modules['dom-stream'] = { loaded: true, timestamp: Date.now() };

  logger.info('[DOM Stream] Module loaded');
})();
