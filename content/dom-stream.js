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
  var dialogRelayActive = false;

  // Attributes that need URL absolutification
  var URL_ATTRS = ['src', 'href', 'action', 'poster', 'data'];

  // Default computed style values to skip (reduces payload size)
  // Keys are kebab-case to match getComputedStyle property iteration
  var STYLE_DEFAULTS = {
    'display': 'block',
    'position': 'static',
    'opacity': '1',
    'visibility': 'visible',
    'overflow': 'visible',
    'transform': 'none',
    'box-shadow': 'none',
    'z-index': 'auto',
    'float': 'none',
    'clear': 'none',
    'cursor': 'auto',
    'pointer-events': 'auto',
    'text-decoration': 'none solid rgb(0, 0, 0)',
    'text-align': 'start',
    'vertical-align': 'baseline',
    'font-style': 'normal',
    'font-variant': 'normal',
    'text-transform': 'none',
    'white-space': 'normal',
    'word-break': 'normal',
    'overflow-wrap': 'normal',
    'list-style-type': 'disc',
    'border-collapse': 'separate',
    'resize': 'none'
  };

  // =========================================================================
  // 0. Dialog Interception (D-01/D-03)
  // =========================================================================

  /**
   * Inject a page-level script that monkey-patches window.alert, window.confirm,
   * and window.prompt to fire CustomEvents the content script can listen for.
   * Per D-01/D-03: intercept native dialogs and relay to dashboard.
   */
  function injectDialogInterceptor() {
    // Only inject once
    if (document.getElementById('fsb-dialog-interceptor')) return;

    var script = document.createElement('script');
    script.id = 'fsb-dialog-interceptor';
    script.textContent = '(' + function() {
      var origAlert = window.alert;
      var origConfirm = window.confirm;
      var origPrompt = window.prompt;

      window.alert = function(message) {
        document.dispatchEvent(new CustomEvent('fsb-dialog', {
          detail: { type: 'alert', message: String(message || '') }
        }));
        var result = origAlert.call(window, message);
        document.dispatchEvent(new CustomEvent('fsb-dialog-dismiss', {
          detail: { type: 'alert' }
        }));
        return result;
      };

      window.confirm = function(message) {
        document.dispatchEvent(new CustomEvent('fsb-dialog', {
          detail: { type: 'confirm', message: String(message || '') }
        }));
        var result = origConfirm.call(window, message);
        document.dispatchEvent(new CustomEvent('fsb-dialog-dismiss', {
          detail: { type: 'confirm', result: result }
        }));
        return result;
      };

      window.prompt = function(message, defaultValue) {
        document.dispatchEvent(new CustomEvent('fsb-dialog', {
          detail: { type: 'prompt', message: String(message || ''), defaultValue: defaultValue || '' }
        }));
        var result = origPrompt.call(window, message, defaultValue);
        document.dispatchEvent(new CustomEvent('fsb-dialog-dismiss', {
          detail: { type: 'prompt', result: result }
        }));
        return result;
      };
    } + ')();';

    (document.head || document.documentElement).appendChild(script);
  }

  /**
   * Listen for dialog events from the page-level interceptor and relay to background.js.
   */
  function setupDialogRelay() {
    if (dialogRelayActive) return;
    dialogRelayActive = true;

    document.addEventListener('fsb-dialog', function(e) {
      var detail = e.detail || {};
      try {
        chrome.runtime.sendMessage({
          action: 'domStreamDialog',
          dialog: {
            type: detail.type,
            message: detail.message,
            defaultValue: detail.defaultValue,
            state: 'open'
          }
        }).catch(function() {});
      } catch (err) { /* extension context invalidated */ }
    });

    document.addEventListener('fsb-dialog-dismiss', function(e) {
      var detail = e.detail || {};
      try {
        chrome.runtime.sendMessage({
          action: 'domStreamDialog',
          dialog: {
            type: detail.type,
            result: detail.result,
            state: 'closed'
          }
        }).catch(function() {});
      } catch (err) { /* extension context invalidated */ }
    });
  }

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
   * Capture ALL computed styles for an element via full property iteration.
   * Iterates every property from getComputedStyle (300+ properties) and
   * skips common defaults to reduce payload size (D-07, D-08).
   * @param {Element} original - The original DOM element (for getComputedStyle)
   * @param {Element} clone - The cloned element to set inline styles on
   */
  function captureComputedStyles(original, clone) {
    try {
      var computed = window.getComputedStyle(original);
      var styles = [];

      for (var i = 0; i < computed.length; i++) {
        var prop = computed[i]; // kebab-case property name
        var val = computed.getPropertyValue(prop);
        if (!val || val === '') continue;
        // Skip common defaults to reduce payload (per D-08)
        if (STYLE_DEFAULTS[prop] === val) continue;
        // Skip values that are just browser defaults for most elements
        if (val === '0px' || val === 'normal' || val === 'none' || val === 'auto' || val === '0s' || val === '0px 0px') {
          if (!STYLE_DEFAULTS[prop]) continue;
        }
        styles.push(prop + ':' + val);
      }

      if (styles.length > 0) {
        clone.setAttribute('style', styles.join(';'));
      }
    } catch (e) {
      // getComputedStyle can fail for detached elements
    }
  }

  /**
   * Serialize the full DOM body into a clean HTML string.
   * Strips scripts, absolutifies URLs, assigns data-fsb-nid attributes,
   * renders iframes live with absolutified src, and captures ALL computed styles.
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

      // Keep iframes live with absolutified src (D-04)
      if (tag === 'iframe') {
        var iframeSrc = cl.getAttribute('src');
        if (iframeSrc) {
          cl.setAttribute('src', absolutifyUrl(iframeSrc));
        }
        // Security: prevent interaction with embedded content (D-05)
        var existingStyle = cl.getAttribute('style') || '';
        cl.setAttribute('style', existingStyle + ';pointer-events:none');
        // Assign nid for mutation tracking
        cl.setAttribute('data-fsb-nid', String(nextNodeId++));
        // Capture computed styles for sizing/positioning
        captureComputedStyles(orig, cl);
        continue;
      }

      // Assign data-fsb-nid
      cl.setAttribute('data-fsb-nid', String(nextNodeId++));

      // Canvas-to-img conversion: capture canvas content before it's lost in the clone
      if (tag === 'canvas') {
        try {
          var dataUrl = orig.toDataURL('image/png');
          var img = clone.ownerDocument.createElement('img');
          img.src = dataUrl;
          img.setAttribute('data-fsb-nid', String(nextNodeId++));
          img.setAttribute('style', 'width:' + (orig.width || 300) + 'px;height:' + (orig.height || 150) + 'px;');
          if (cl.parentNode) {
            cl.parentNode.replaceChild(img, cl);
          }
        } catch (e) {
          // Tainted canvas or security error -- leave as empty canvas
          cl.setAttribute('data-fsb-nid', String(nextNodeId - 1 >= 1 ? nextNodeId - 1 : nextNodeId++));
        }
        continue;
      }

      // Absolutify URL attributes
      for (var a = 0; a < URL_ATTRS.length; a++) {
        var attrVal = cl.getAttribute(URL_ATTRS[a]);
        if (attrVal) {
          cl.setAttribute(URL_ATTRS[a], absolutifyUrl(attrVal));
        }
      }

      // SVG xlink:href absolutification
      try {
        var xlinkHref = cl.getAttributeNS('http://www.w3.org/1999/xlink', 'href');
        if (xlinkHref) {
          cl.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', absolutifyUrl(xlinkHref));
        }
      } catch (e) { /* not an SVG element or no xlink support */ }

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

    // Collect inline <style> tags from document.head
    var inlineStyles = [];
    var styleTags = document.querySelectorAll('head style');
    for (var st = 0; st < styleTags.length; st++) {
      var cssText = styleTags[st].textContent;
      if (cssText && cssText.length < 500000) {
        inlineStyles.push(cssText);
      }
    }

    var html = clone.innerHTML;
    var truncated = false;

    // Large page safety: cap at 2MB
    if (html.length > 2 * 1024 * 1024) {
      // Remove elements below the fold (below 3x viewport height)
      var viewportCutoff = window.innerHeight * 3;
      var allEls = clone.querySelectorAll('[data-fsb-nid]');
      for (var t = allEls.length - 1; t >= 0; t--) {
        try {
          // Use original element positions via nid mapping
          var nidVal = allEls[t].getAttribute('data-fsb-nid');
          var origByNid = document.querySelector('[data-fsb-nid="' + nidVal + '"]');
          if (origByNid) {
            var elRect = origByNid.getBoundingClientRect();
            if (elRect.top > viewportCutoff) {
              allEls[t].parentNode && allEls[t].parentNode.removeChild(allEls[t]);
            }
          }
        } catch (e) { /* skip */ }
      }
      html = clone.innerHTML;
      truncated = true;
    }

    return {
      html: html,
      truncated: truncated,
      stylesheets: stylesheets,
      inlineStyles: inlineStyles,
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
   * Batches mutations via requestAnimationFrame for display-matched delivery (D-06).
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

      // Batch flush synced to browser paint cycle via rAF (FIDELITY-03)
      if (batchTimer) cancelAnimationFrame(batchTimer);
      batchTimer = requestAnimationFrame(flushMutations);
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
      cancelAnimationFrame(batchTimer);
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

    // Read glow position from ActionGlowOverlay (used during automation) or HighlightManager (fallback)
    try {
      var glowSource = (FSB.actionGlowOverlay && FSB.actionGlowOverlay.targetElement)
        || (FSB.highlightManager && FSB.highlightManager.activeHighlight);
      if (glowSource && glowSource.getBoundingClientRect) {
        var rect = glowSource.getBoundingClientRect();
        glow = {
          x: rect.x,
          y: rect.y,
          w: rect.width,
          h: rect.height,
          state: 'active'
        };
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
        injectDialogInterceptor();
        setupDialogRelay();
        // Re-injection guard: stop existing stream before restarting
        if (streaming) {
          stopMutationStream();
          stopScrollTracker();
        }
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

  // Signal background.js that this page has a DOM stream module ready
  // This triggers the ext:page-ready -> dash:dom-stream-start auto-start chain
  try {
    chrome.runtime.sendMessage({ action: 'domStreamReady' }).catch(function() {});
  } catch (e) { /* ignore -- background may not be listening yet */ }

  logger.info('[DOM Stream] Module loaded');
})();
