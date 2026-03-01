// content/messaging.js -- Background script communication, message handlers, iframe support, markdown helpers
// Depends on: init.js, utils.js, dom-state.js, selectors.js, visual-feedback.js, accessibility.js, actions.js, dom-analysis.js
(function() {
  if (window.__FSB_SKIP_INIT__) return;

  const FSB = window.FSB;
  const logger = FSB.logger;

  // Local aliases for cross-module dependencies
  const getClassName = FSB.getClassName;

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
      logger.logInit('content_script', 'cross_origin_iframe', { url: window.location.href });
    }
  }

  // Log frame context on initialization
  if (isInIframe) {
    logger.logInit('content_script', 'iframe_loaded', frameContext);
  } else {
    logger.logInit('content_script', 'main_frame_loaded', {});
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

    // Validate origin: only accept messages from same origin
    if (event.origin !== window.location.origin) {
      return;
    }

    const { action, requestId } = event.data;

    if (action === 'getFrameDOM') {
      // Parent is requesting this frame's DOM
      try {
        const domData = FSB.getStructuredDOM({
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

        // Send response back to parent (restrict to same origin)
        window.parent.postMessage({
          type: 'FSB_FRAME_RESPONSE',
          requestId: requestId,
          success: true,
          data: domData
        }, window.location.origin);
      } catch (error) {
        window.parent.postMessage({
          type: 'FSB_FRAME_RESPONSE',
          requestId: requestId,
          success: false,
          error: error.message
        }, window.location.origin);
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

    logger.logDOMOperation(FSB.sessionId, 'collect_iframes', { iframeCount: iframes.length });

    const framePromises = [];
    const pendingRequests = new Map();

    // Set up message listener for responses
    const responseHandler = (event) => {
      // Validate origin of frame responses
      if (event.origin !== window.location.origin) {
        return;
      }
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

        // Send request to iframe (use iframe's origin instead of wildcard)
        try {
          const iframeOrigin = iframe.src ? new URL(iframe.src).origin : window.location.origin;
          iframe.contentWindow.postMessage({
            type: 'FSB_FRAME_REQUEST',
            action: 'getFrameDOM',
            requestId: requestId
          }, iframeOrigin);
        } catch (e) {
          // Cross-origin iframe or invalid URL, can't send message directly
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
    logger.logDOMOperation(FSB.sessionId, 'iframes_collected', { successful: successfulFrames.length, total: iframes.length });

    return results;
  }

  // ============================================================================
  // CANVAS-BASED EDITOR DETECTION AND MARKDOWN UTILITIES
  // ============================================================================

  /**
   * Detect canvas-based editors (Google Docs, Sheets, Slides, etc.)
   */
  function isCanvasBasedEditor() {
    const host = window.location.hostname;
    if (host === 'docs.google.com') return true;
    // Check for Google Docs kix classes or the text event target iframe
    if (document.querySelector('.kix-appview-editor, .kix-page, .docs-texteventtarget-iframe')) return true;
    // Check for Google Sheets waffle classes
    if (document.querySelector('.waffle-comments-provider, .waffle-selection-handle')) return true;
    return false;
  }

  /**
   * Detect whether a string contains markdown formatting that should be rendered.
   */
  function hasMarkdownFormatting(text) {
    if (!text || typeof text !== 'string') return false;
    const patterns = [
      /^#{1,6}\s+/m,           // Headings
      /\*\*[^*]+\*\*/,         // Bold
      /\*[^*]+\*/,             // Italic
      /__[^_]+__/,             // Bold
      /_[^_]+_/,               // Italic
      /^\s*[-*+]\s+/m,         // Unordered lists
      /^\s*\d+\.\s+/m,         // Ordered lists
      /\[([^\]]+)\]\(([^)]+)\)/, // Links
      /`[^`]+`/,               // Inline code
      /^>\s+/m,                // Blockquotes
      /^---$/m,                // Horizontal rules
      /~~[^~]+~~/              // Strikethrough
    ];
    let matchCount = 0;
    for (const pattern of patterns) {
      if (pattern.test(text)) {
        matchCount++;
        if (matchCount >= 2) return true;
      }
    }
    if (/^#{1,6}\s+/m.test(text)) return true;
    if (/\*\*[^*]{3,}\*\*/.test(text)) return true;
    return false;
  }

  /**
   * Convert markdown text to clean HTML suitable for pasting into Google Docs.
   */
  function markdownToHTML(markdown) {
    if (!markdown || typeof markdown !== 'string') return '';

    let html = markdown;

    // Normalize line endings
    html = html.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    // Split into lines for block-level processing
    const lines = html.split('\n');
    const outputBlocks = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];
      const trimmed = line.trim();

      // Empty line -- paragraph separator
      if (trimmed === '') {
        i++;
        continue;
      }

      // Horizontal rule
      if (/^(---|\*\*\*|___)$/.test(trimmed)) {
        outputBlocks.push('<hr>');
        i++;
        continue;
      }

      // Headings
      const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
      if (headingMatch) {
        const level = headingMatch[1].length;
        const text = applyInlineFormatting(headingMatch[2]);
        outputBlocks.push(`<h${level}>${text}</h${level}>`);
        i++;
        continue;
      }

      // Blockquote
      if (trimmed.startsWith('>')) {
        const quoteLines = [];
        while (i < lines.length && lines[i].trim().startsWith('>')) {
          quoteLines.push(lines[i].trim().replace(/^>\s*/, ''));
          i++;
        }
        const quoteContent = applyInlineFormatting(quoteLines.join('<br>'));
        outputBlocks.push(`<blockquote>${quoteContent}</blockquote>`);
        continue;
      }

      // Unordered list
      if (/^\s*[-*+]\s+/.test(line)) {
        const listItems = [];
        while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
          const itemText = lines[i].replace(/^\s*[-*+]\s+/, '');
          listItems.push(`<li>${applyInlineFormatting(itemText)}</li>`);
          i++;
        }
        outputBlocks.push(`<ul>${listItems.join('')}</ul>`);
        continue;
      }

      // Ordered list
      if (/^\s*\d+\.\s+/.test(line)) {
        const listItems = [];
        while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
          const itemText = lines[i].replace(/^\s*\d+\.\s+/, '');
          listItems.push(`<li>${applyInlineFormatting(itemText)}</li>`);
          i++;
        }
        outputBlocks.push(`<ol>${listItems.join('')}</ol>`);
        continue;
      }

      // Table (markdown pipe table)
      if (/^\|.+\|$/.test(trimmed)) {
        const tableRows = [];
        while (i < lines.length && /^\|.+\|$/.test(lines[i].trim())) {
          tableRows.push(lines[i].trim());
          i++;
        }
        if (tableRows.length >= 2) {
          const parseRow = (row) => row.split('|').slice(1, -1).map(cell => cell.trim());
          const headerCells = parseRow(tableRows[0]);
          const isSeparator = (row) => /^\|[\s\-:|]+\|$/.test(row);
          let bodyStartIdx = 1;
          if (tableRows.length > 1 && isSeparator(tableRows[1])) {
            bodyStartIdx = 2;
          }
          let tableHTML = '<table style="border-collapse:collapse;width:100%">';
          tableHTML += '<thead><tr>';
          for (const cell of headerCells) {
            tableHTML += `<th style="border:1px solid #ccc;padding:6px 12px;background:#f0f0f0;font-weight:bold">${applyInlineFormatting(cell)}</th>`;
          }
          tableHTML += '</tr></thead>';
          if (bodyStartIdx < tableRows.length) {
            tableHTML += '<tbody>';
            for (let r = bodyStartIdx; r < tableRows.length; r++) {
              const cells = parseRow(tableRows[r]);
              tableHTML += '<tr>';
              for (let c = 0; c < headerCells.length; c++) {
                tableHTML += `<td style="border:1px solid #ccc;padding:6px 12px">${applyInlineFormatting(cells[c] || '')}</td>`;
              }
              tableHTML += '</tr>';
            }
            tableHTML += '</tbody>';
          }
          tableHTML += '</table>';
          outputBlocks.push(tableHTML);
        } else {
          outputBlocks.push(`<p>${applyInlineFormatting(tableRows[0])}</p>`);
        }
        continue;
      }

      // Regular paragraph
      const paraLines = [];
      while (i < lines.length) {
        const pLine = lines[i];
        const pTrimmed = pLine.trim();
        if (pTrimmed === '') break;
        if (/^#{1,6}\s+/.test(pTrimmed)) break;
        if (/^(---|\*\*\*|___)$/.test(pTrimmed)) break;
        if (pTrimmed.startsWith('>')) break;
        if (/^\s*[-*+]\s+/.test(pLine)) break;
        if (/^\s*\d+\.\s+/.test(pLine)) break;
        if (/^\|.+\|$/.test(pTrimmed)) break;
        paraLines.push(pTrimmed);
        i++;
      }
      if (paraLines.length > 0) {
        const paraText = applyInlineFormatting(paraLines.join('<br>'));
        outputBlocks.push(`<p>${paraText}</p>`);
      }
    }

    return outputBlocks.join('\n');
  }

  /**
   * Apply inline markdown formatting (bold, italic, code, links, strikethrough).
   */
  function applyInlineFormatting(text) {
    // Inline code (must come first)
    text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
    // Bold + italic
    text = text.replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>');
    text = text.replace(/___([^_]+)___/g, '<strong><em>$1</em></strong>');
    // Bold
    text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/__([^_]+)__/g, '<strong>$1</strong>');
    // Italic
    text = text.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    text = text.replace(/_([^_]+)_/g, '<em>$1</em>');
    // Strikethrough
    text = text.replace(/~~([^~]+)~~/g, '<s>$1</s>');
    // Links
    text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
    return text;
  }

  /**
   * Write HTML to the system clipboard and simulate paste via CDP.
   */
  async function clipboardPasteHTML(html, plainText) {
    try {
      const htmlBlob = new Blob([html], { type: 'text/html' });
      const textBlob = new Blob([plainText], { type: 'text/plain' });
      const clipboardItem = new ClipboardItem({
        'text/html': htmlBlob,
        'text/plain': textBlob
      });

      try {
        await navigator.clipboard.write([clipboardItem]);
      } catch (clipErr) {
        logger.warn('clipboardPasteHTML: clipboard.write() failed', { error: clipErr.message });
        return { success: false, method: 'clipboard_paste_html', error: 'Clipboard write failed: ' + clipErr.message };
      }

      logger.debug('clipboardPasteHTML: clipboard written', { htmlLength: html.length, plainTextLength: plainText.length });

      await new Promise(r => setTimeout(r, 150));

      const getDocTextLength = () => {
        const pageElements = document.querySelectorAll('.kix-paragraphrenderer');
        let totalLen = 0;
        for (const el of pageElements) {
          totalLen += (el.textContent || '').length;
        }
        return totalLen;
      };
      const textLenBefore = getDocTextLength();

      const isMac = navigator.userAgent?.includes('Macintosh') || navigator.platform?.includes('Mac');
      const pasteResult = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({
          action: 'keyboardDebuggerAction',
          method: 'pressKey',
          key: 'v',
          modifiers: {
            ctrl: !isMac,
            meta: isMac,
            shift: false,
            alt: false
          }
        }, (response) => {
          if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
          else if (response && response.success) resolve(response);
          else reject(new Error(response?.error || 'Paste key simulation failed'));
        });
      });

      logger.debug('clipboardPasteHTML: paste key dispatched', { pasteResult: pasteResult.success });

      await new Promise(r => setTimeout(r, 800));

      const textLenAfter = getDocTextLength();
      const textInserted = textLenAfter > textLenBefore;

      logger.debug('clipboardPasteHTML: verification', {
        textLenBefore,
        textLenAfter,
        textInserted,
        expectedMinChars: Math.min(plainText.length, 10)
      });

      if (!textInserted) {
        logger.warn('clipboardPasteHTML: paste key succeeded but no text appeared in editor');
        return {
          success: false,
          method: 'clipboard_paste_html',
          error: 'Paste dispatched but no text appeared in editor (cursor may not be in editable area)',
          textLenBefore,
          textLenAfter
        };
      }

      return { success: true, method: 'clipboard_paste_html', textLenBefore, textLenAfter };
    } catch (error) {
      logger.warn('clipboardPasteHTML failed', { error: error.message });
      return { success: false, method: 'clipboard_paste_html', error: error.message };
    }
  }

  /**
   * Strip markdown formatting to produce clean plain text.
   */
  function stripMarkdown(markdown) {
    if (!markdown) return '';
    let text = markdown;
    text = text.replace(/^#{1,6}\s+/gm, '');
    text = text.replace(/\*\*\*([^*]+)\*\*\*/g, '$1');
    text = text.replace(/\*\*([^*]+)\*\*/g, '$1');
    text = text.replace(/\*([^*]+)\*/g, '$1');
    text = text.replace(/___([^_]+)___/g, '$1');
    text = text.replace(/__([^_]+)__/g, '$1');
    text = text.replace(/_([^_]+)_/g, '$1');
    text = text.replace(/~~([^~]+)~~/g, '$1');
    text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
    text = text.replace(/`([^`]+)`/g, '$1');
    text = text.replace(/^>\s*/gm, '');
    text = text.replace(/^(---|\*\*\*|___)$/gm, '');
    return text.trim();
  }

  // ============================================================================
  // UNIVERSAL MESSAGE INPUT DETECTION AND MESSAGING SELECTORS
  // ============================================================================

  /**
   * Enhanced universal message input detection for all platforms
   */
  function isUniversalMessageInput(element) {
    const className = getClassName(element).toLowerCase();
    const id = (element.id || '').toLowerCase();
    const ariaLabel = (element.getAttribute('aria-label') || '').toLowerCase();
    const placeholder = (element.getAttribute('placeholder') || '').toLowerCase();
    const dataTestId = (element.getAttribute('data-testid') || '').toLowerCase();
    const dataTestid = (element.getAttribute('data-testid') || '').toLowerCase();
    const role = (element.getAttribute('role') || '').toLowerCase();
    const name = (element.getAttribute('name') || '').toLowerCase();
    const parentClass = getClassName(element.parentElement).toLowerCase();
    const grandParentClass = getClassName(element.parentElement?.parentElement).toLowerCase();

    const messagingKeywords = [
      'message', 'msg', 'chat', 'compose', 'write', 'text', 'comment', 'reply',
      'post', 'tweet', 'status', 'update', 'note', 'memo', 'send', 'typing',
      'input', 'editor', 'content', 'body', 'description', 'caption'
    ];

    const platformPatterns = {
      linkedin: ['msg-form__contenteditable', 'msg-form__placeholder', 'compose-publisher', 'ql-editor'],
      twitter: ['tweet-box', 'rich-editor', 'notranslate', 'draftjs-editor', 'tweet-compose'],
      facebook: ['notranslate', '_1mf', 'composerInput', 'UFIAddCommentInput', '_5rpu'],
      whatsapp: ['selectable-text', 'copyable-text', '_3FRCZ', '_1awRl'],
      discord: ['textArea-', 'slateTextArea-', 'markup-', 'editor-'],
      slack: ['ql-editor', 'msg_input', 'p-message_input'],
      telegram: ['input-message-input', 'composer_rich_textarea'],
      generic: ['input-field', 'text-input', 'message-input', 'chat-input', 'compose-input']
    };

    // Check for contenteditable div
    if (element.contentEditable === 'true' || element.hasAttribute('contenteditable')) {
      const allText = [className, id, ariaLabel, placeholder, dataTestId, parentClass, grandParentClass].join(' ');

      if (messagingKeywords.some(keyword => allText.includes(keyword))) {
        return true;
      }

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

    const messagingAriaPatterns = [
      'message', 'compose', 'write', 'chat', 'comment', 'reply', 'post', 'tweet',
      'happening', 'mind', 'think', 'share', 'status', 'update', 'note'
    ];

    if (messagingAriaPatterns.some(pattern => ariaLabel.includes(pattern))) {
      return true;
    }

    const messagingPlaceholders = [
      'message', 'type', 'write', 'compose', 'chat', 'comment', 'reply', 'post',
      'happening', 'mind', 'think', 'share', 'status', 'say', 'tell'
    ];

    if (messagingPlaceholders.some(pattern => placeholder.includes(pattern))) {
      return true;
    }

    const testIdPatterns = [
      'message', 'compose', 'chat', 'input', 'editor', 'text', 'comment', 'reply',
      'post', 'tweet', 'status', 'dm-', 'msg-', 'chat-'
    ];

    if (testIdPatterns.some(pattern => dataTestId.includes(pattern) || dataTestid.includes(pattern))) {
      return true;
    }

    const classPatterns = [
      'message', 'msg', 'chat', 'compose', 'editor', 'input', 'text', 'comment',
      'reply', 'post', 'tweet', 'status', 'contenteditable', 'rich-text', 'wysiwyg'
    ];

    if (classPatterns.some(pattern => className.includes(pattern))) {
      return true;
    }

    const namePatterns = [
      'message', 'msg', 'text', 'comment', 'content', 'body', 'description', 'caption'
    ];

    if (namePatterns.some(pattern => name.includes(pattern))) {
      return true;
    }

    if (parentClass.includes('message') || parentClass.includes('compose') ||
        parentClass.includes('chat') || parentClass.includes('input')) {
      return true;
    }

    const wrapperPatterns = ['input-wrapper', 'text-wrapper', 'editor-wrapper', 'compose-wrapper'];
    if (wrapperPatterns.some(pattern => parentClass.includes(pattern) || grandParentClass.includes(pattern))) {
      return true;
    }

    return false;
  }

  /**
   * Enhanced selector generation for messaging interfaces
   */
  function generateMessagingSelectors(baseSelector) {
    const fallbacks = [];

    if (baseSelector && !fallbacks.includes(baseSelector)) {
      fallbacks.push(baseSelector);
    }

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

    messagingSelectors.forEach(selector => {
      if (!fallbacks.includes(selector)) {
        fallbacks.push(selector);
      }
    });

    return fallbacks;
  }

  // ============================================================================
  // ASYNC MESSAGE HANDLER
  // ============================================================================

  // Async message handler with timeout support
  async function handleAsyncMessage(request, sendResponse) {
    logger.logComm(FSB.sessionId, 'handle', request.action, true, { type: 'async' });

    try {
      let result;
      const startTime = Date.now();

      switch (request.action) {
        case 'getDOM':
          logger.logDOMOperation(FSB.sessionId, 'get_dom_start', {});
          const domOptions = {
            ...request.options,
            useIncrementalDiff: request.options?.useIncrementalDiff !== false
          };
          const domStart = Date.now();
          result = FSB.getStructuredDOM(domOptions);
          const domTime = Date.now() - domStart;
          logger.logTiming(FSB.sessionId, 'DOM', 'getStructuredDOM', domTime, { elements: result.elements?.length || result._totalElements || 0 });
          if (result._isDelta) {
            logger.logDOMOperation(FSB.sessionId, 'delta_diff_used', {
              compressionRatio: (result.optimization?.compressionRatio * 100).toFixed(1) + '%'
            });
          }
          // Optionally embed compact snapshot
          if (domOptions.includeCompactSnapshot) {
            const compactStart = Date.now();
            const compact = FSB.generateCompactSnapshot(domOptions);
            result._compactSnapshot = compact.snapshot;
            result._refGeneration = compact.refGeneration;
            result._compactElementCount = compact.elementCount;
            result._compactMetadata = compact.metadata;
            logger.logTiming(FSB.sessionId, 'DOM', 'generateCompactSnapshot', Date.now() - compactStart, { elements: compact.elementCount });
          }
          sendResponse({ success: true, structuredDOM: result });
          break;

        case 'getCompactDOM':
          const compactResult = FSB.generateCompactSnapshot(request.options || {});
          sendResponse({ success: true, compactSnapshot: compactResult });
          break;

        case 'getYAMLSnapshot':
          const yamlMode = request.options?.mode || 'interactive';
          const yamlGuideSelectors = request.options?.guideSelectors || null;
          const yamlStart = Date.now();
          const yamlResult = FSB.buildYAMLSnapshot({
            mode: yamlMode,
            guideSelectors: yamlGuideSelectors
          });
          const yamlTime = Date.now() - yamlStart;
          logger.logTiming(FSB.sessionId, 'DOM', 'buildYAMLSnapshot', yamlTime, {
            mode: yamlMode,
            elements: yamlResult.elementCount
          });
          sendResponse({
            success: true,
            yamlSnapshot: yamlResult.snapshot,
            refGeneration: yamlResult.refGeneration,
            elementCount: yamlResult.elementCount
          });
          break;

        case 'executeAction':
          const { tool, params, visualContext } = request;
          logger.logActionExecution(FSB.sessionId, tool, 'start', params);

          // VIS-02: Initialize/update progress overlay on action start
          if (visualContext) {
            try {
              FSB.progressOverlay.create();
              FSB.progressOverlay.update({
                taskName: visualContext.taskName,
                stepNumber: visualContext.stepNumber,
                stepText: `${tool}: Preparing...`,
                progress: ((visualContext.stepNumber - 1) / visualContext.totalSteps) * 100
              });
              FSB.progressOverlay.show();
            } catch (overlayError) {
              console.warn('[FSB] Progress overlay error (non-blocking):', overlayError.message);
            }
          }

          // COMPACT REF RESOLUTION
          if (params && params.ref && !params.selector) {
            const resolvedElement = FSB.resolveRef(params.ref);
            if (resolvedElement) {
              const refInfo = FSB.refMap.getInfo(params.ref);
              params.selector = refInfo?.selector;
              if (!params.selector) {
                const sels = FSB.generateSelectors(resolvedElement);
                const cssSel = sels.find(s => typeof s === 'string' ? !s.startsWith('//') : !s.selector?.startsWith('//'));
                params.selector = typeof cssSel === 'string' ? cssSel : (cssSel?.selector || sels[0]?.selector || sels[0] || '');
              }
              if (params.selector) FSB.elementCache.set(params.selector, resolvedElement);
              logger.debug('Resolved ref to selector', {
                sessionId: FSB.sessionId, ref: params.ref, selector: params.selector, role: refInfo?.role
              });
            } else {
              const refInfo = FSB.refMap.getInfo(params.ref);
              const errorMsg = refInfo
                ? `Element ref "${params.ref}" (${refInfo.role} "${refInfo.name}") is stale. The page has changed. Use elements from the current snapshot.`
                : `Unknown ref "${params.ref}". Use refs from the latest page snapshot.`;
              logger.warn('Stale or unknown ref', { sessionId: FSB.sessionId, ref: params.ref });
              sendResponse({ success: false, error: errorMsg, tool, refStale: true });
              return;
            }
          }

          if (FSB.tools[tool]) {
            // VIS-01/VIS-03: Show highlight on target element
            if (params && (params.selector || params.ref)) {
              try {
                const targetElement = params.ref ? FSB.resolveRef(params.ref) : FSB.querySelectorWithShadow(params.selector);
                if (targetElement) {
                  if (visualContext?.animatedHighlights !== false) {
                    FSB.actionGlowOverlay.show(targetElement);
                    try { FSB.viewportGlow.setState('acting'); } catch (e) { /* non-blocking */ }
                  }
                }
              } catch (highlightError) {
                console.warn('[FSB] Highlight error (non-blocking):', highlightError.message);
              }
            }

            // Update progress
            if (visualContext) {
              try {
                FSB.progressOverlay.update({
                  stepText: `${tool}: Executing...`,
                  progress: (visualContext.stepNumber / visualContext.totalSteps) * 100
                });
              } catch (updateError) {
                // Non-blocking
              }
            }

            // Timeout wrapper
            const actionTimeout = tool === 'solveCaptcha' ? 180000 : 10000;
            const timeoutPromise = new Promise((_, reject) => {
              setTimeout(() => reject(new Error(`Action ${tool} timed out after ${actionTimeout / 1000} seconds`)), actionTimeout);
            });

            try {
              const execStart = Date.now();
              const actionPromise = FSB.tools[tool](params);
              result = await Promise.race([actionPromise, timeoutPromise]);
              logger.logTiming(FSB.sessionId, 'ACTION', tool, Date.now() - execStart, { success: result?.success });

              // Invalidate cached element indexes
              FSB.invalidateElementIndexes();

              // Clean up highlights
              try { FSB.actionGlowOverlay.hide(); } catch (e) { /* non-blocking */ }
              FSB.highlightManager.hide();
              try { FSB.viewportGlow.setState('thinking'); } catch (e) { /* non-blocking */ }

              if (result === undefined || result === null) {
                logger.warn('Action returned null/undefined result', { sessionId: FSB.sessionId, tool });
                sendResponse({
                  success: false,
                  error: `Action ${tool} returned no result`,
                  tool: tool,
                  executionTime: Date.now() - startTime
                });
              } else {
                sendResponse({
                  ...result,
                  tool: tool,
                  executionTime: Date.now() - startTime
                });
              }
            } catch (actionError) {
              try {
                FSB.actionGlowOverlay.destroy();
                FSB.highlightManager.hide();
              } catch (cleanupError) {
                // Ignore cleanup errors
              }
              throw actionError;
            }
          } else {
            try {
              FSB.actionGlowOverlay.destroy();
            } catch (e) { /* ignore */ }
            logger.error('Unknown tool requested', { sessionId: FSB.sessionId, tool });
            sendResponse({ success: false, error: `Unknown tool: ${tool}` });
          }
          break;

        case 'getExplorerData':
          result = FSB.collectExplorerData();
          sendResponse({ success: true, data: result });
          break;

        default:
          logger.error('Unknown async action', { sessionId: FSB.sessionId, action: request.action });
          sendResponse({ success: false, error: `Unknown action: ${request.action}` });
      }
    } catch (error) {
      try {
        FSB.actionGlowOverlay.destroy();
        FSB.highlightManager.hide();
      } catch (cleanupError) {
        // Ignore cleanup errors
      }
      logger.error('Error in async message handler', { sessionId: FSB.sessionId, action: request.action, error: error.message });
      sendResponse({
        success: false,
        error: error.message || 'Unknown error in async handler',
        stack: error.stack,
        action: request.action,
        executionTime: Date.now() - (request.startTime || Date.now())
      });
    }
  }

  // ============================================================================
  // MAIN MESSAGE HANDLER
  // ============================================================================

  // Named message handler function - allows Chrome to dedupe on re-injection
  function handleBackgroundMessage(request, sender, sendResponse) {
    // Store sessionId from any incoming message for logging
    if (request.sessionId) {
      FSB.sessionId = request.sessionId;
    }

    logger.logComm(FSB.sessionId, 'receive', request.action, true, { hasSessionId: !!request.sessionId });

    // Handle async operations properly
    if (request.action === 'executeAction' || request.action === 'getDOM' || request.action === 'getYAMLSnapshot') {
      handleAsyncMessage(request, sendResponse);
      return true; // Keep message channel open for async response
    }

    // Direct login handler
    if (request.action === 'executeDirectLogin') {
      (async () => {
        try {
          const result = await FSB.executeDirectLogin(request);
          sendResponse(result);
        } catch (error) {
          sendResponse({ success: false, error: 'Login execution failed' });
        }
      })();
      return true;
    }

    switch (request.action) {
      case 'healthCheck':
        const readiness = FSB.checkDocumentReady();
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
        const pageReadiness = FSB.checkDocumentReady();
        sendResponse({ success: true, ...pageReadiness });
        break;

      case 'sessionStatus':
        try {
          const { phase, taskName, iteration, maxIterations, reason,
                  animatedHighlights, statusText, progressPercent,
                  estimatedTimeRemaining, taskSummary } = request;

          if (phase === 'ended') {
            if (FSB._overlayWatchdogTimer) {
              clearTimeout(FSB._overlayWatchdogTimer);
              FSB._overlayWatchdogTimer = null;
            }
            FSB.viewportGlow.destroy();
            FSB.progressOverlay.destroy();
            FSB.actionGlowOverlay.destroy();
            FSB.lastActionStatusText = null;
          } else {
            if (animatedHighlights !== false) {
              const glowState = (phase === 'acting') ? 'acting' : 'thinking';
              FSB.viewportGlow.show(glowState);
            }

            if (statusText) {
              FSB.lastActionStatusText = statusText;
            }

            FSB.progressOverlay.create();
            const phaseLabels = {
              analyzing: 'Analyzing page...',
              thinking: 'Planning next step...',
              acting: 'Executing...'
            };
            const displayText = statusText
              || FSB.lastActionStatusText
              || phaseLabels[phase]
              || phase;

            FSB.progressOverlay.update({
              taskName: taskSummary || taskName,
              stepNumber: iteration || 0,
              totalSteps: maxIterations,
              stepText: displayText,
              progress: progressPercent !== undefined
                ? progressPercent
                : (maxIterations ? (iteration / maxIterations) * 100 : 0),
              eta: estimatedTimeRemaining
            });
            FSB.progressOverlay.show();

            if (FSB._overlayWatchdogTimer) {
              clearTimeout(FSB._overlayWatchdogTimer);
            }
            FSB._overlayWatchdogTimer = setTimeout(() => {
              FSB._overlayWatchdogTimer = null;
              console.warn('[FSB] Overlay watchdog: no session status for 60s, cleaning up orphaned overlays');
              try {
                FSB.viewportGlow.destroy();
                FSB.progressOverlay.destroy();
                FSB.actionGlowOverlay.destroy();
                FSB.lastActionStatusText = null;
              } catch (e) { /* non-blocking */ }
            }, 60000);
          }
          sendResponse({ success: true });
        } catch (e) {
          console.warn('[FSB] sessionStatus handler error (non-blocking):', e.message);
          sendResponse({ success: false, error: e.message });
        }
        break;

      case 'getDOM':
        // Handled above in async handler
        break;

      case 'executeAction':
        // Handled above in async handler
        break;

      case 'highlightElement':
        (async () => {
          try {
            const element = FSB.querySelectorWithShadow(request.selector);
            if (element) {
              await FSB.highlightManager.show(element, { duration: request.duration || 2000 });
              sendResponse({ success: true });
            } else {
              sendResponse({ success: false, error: 'Element not found' });
            }
          } catch (error) {
            sendResponse({ success: false, error: error.message });
          }
        })();
        return true;

      case 'resetDOMState':
        try {
          logger.logDOMOperation(FSB.sessionId, 'reset_state', { reason: 'new_session' });
          FSB.domStateManager.reset();
          FSB._previousDOMState = null;
          FSB.domStateCache.clear();
          sendResponse({ success: true, message: 'DOM state reset successfully' });
        } catch (error) {
          logger.error('Error resetting DOM state', { sessionId: FSB.sessionId, error: error.message });
          sendResponse({ success: false, error: error.message });
        }
        break;

      case 'getFrameContext':
        sendResponse({
          success: true,
          frameContext: frameContext,
          isMainFrame: !isInIframe
        });
        break;

      case 'detectActionOutcome':
        try {
          const outcome = FSB.detectActionOutcome(
            request.preState,
            request.postState,
            request.actionResult
          );
          sendResponse(outcome);
        } catch (error) {
          logger.error('Error detecting action outcome', {
            sessionId: FSB.sessionId,
            error: error.message
          });
          sendResponse({ type: 'noChange', confidence: 'LOW', error: error.message });
        }
        break;

      case 'waitForPageStability':
        (async () => {
          try {
            const stabilityResult = await FSB.waitForPageStability(request.options || {});
            sendResponse(stabilityResult);
          } catch (error) {
            logger.error('waitForPageStability message handler error', {
              sessionId: FSB.sessionId,
              error: error.message
            });
            sendResponse({ stable: false, error: error.message, timedOut: true });
          }
        })();
        return true;

      case 'waitForInteractiveElements':
        (async () => {
          const timeout = request.timeout || 3000;
          const startTime = Date.now();
          const interactiveSelector = 'button, input, a[href], [role="button"], textarea, select, [contenteditable="true"]';

          try {
            const existing = document.querySelectorAll(interactiveSelector);
            if (existing.length > 0) {
              sendResponse({ success: true, found: true, elementCount: existing.length, waitTime: 0 });
              return;
            }

            const result = await new Promise((resolve) => {
              const observer = new MutationObserver(() => {
                const found = document.querySelectorAll(interactiveSelector);
                if (found.length > 0) {
                  observer.disconnect();
                  resolve({ found: true, elementCount: found.length, waitTime: Date.now() - startTime });
                }
              });

              observer.observe(document.body || document.documentElement, {
                childList: true,
                subtree: true
              });

              setTimeout(() => {
                observer.disconnect();
                const found = document.querySelectorAll(interactiveSelector);
                resolve({ found: found.length > 0, elementCount: found.length, waitTime: Date.now() - startTime });
              }, timeout);
            });

            sendResponse({ success: true, ...result });
          } catch (error) {
            sendResponse({ success: false, found: false, elementCount: 0, waitTime: Date.now() - startTime, error: error.message });
          }
        })();
        return true;

      case 'capturePageState':
        try {
          const pageState = {
            url: window.location.href,
            bodyTextLength: document.body?.innerText?.length || 0,
            elementCount: document.querySelectorAll('*').length,
            activeElement: document.activeElement?.tagName || null,
            urlChanged: false,
            timestamp: Date.now()
          };
          sendResponse(pageState);
        } catch (error) {
          logger.error('Error capturing page state', {
            sessionId: FSB.sessionId,
            error: error.message
          });
          sendResponse({ error: error.message });
        }
        break;

      case 'toggleInspectionMode':
        try {
          if (FSB.elementInspector.isActive) {
            FSB.elementInspector.disable();
          } else {
            FSB.elementInspector.enable();
          }
          sendResponse({ success: true, active: FSB.elementInspector.isActive });
        } catch (error) {
          logger.error('Error toggling inspection mode', {
            sessionId: FSB.sessionId,
            error: error.message
          });
          sendResponse({ success: false, error: error.message });
        }
        break;

      case 'getInspectionModeStatus':
        sendResponse({ active: FSB.elementInspector.isActive });
        break;

      // -- Crawl progress overlay handlers (in-page overlay for SiteExplorer) --
      case 'showCrawlOverlay':
        try {
          FSB.crawlProgressOverlay.create();
          FSB.crawlProgressOverlay.update(request);
          sendResponse({ success: true });
        } catch (e) {
          sendResponse({ success: false, error: e.message });
        }
        break;

      case 'updateCrawlOverlay':
        try {
          if (FSB.crawlProgressOverlay.host) {
            FSB.crawlProgressOverlay.update(request);
          }
          sendResponse({ success: true });
        } catch (e) {
          sendResponse({ success: false, error: e.message });
        }
        break;

      case 'hideCrawlOverlay':
        try {
          FSB.crawlProgressOverlay.destroy();
          sendResponse({ success: true });
        } catch (e) {
          sendResponse({ success: false, error: e.message });
        }
        break;

      default:
        sendResponse({ error: 'Unknown action' });
    }

    return true;
  }

  // Register the named function - Chrome deduplicates identical function references
  chrome.runtime.onMessage.addListener(handleBackgroundMessage);

  // ============================================================================
  // EXPORT TO NAMESPACE
  // ============================================================================

  FSB.isInIframe = isInIframe;
  FSB.frameId = frameId;
  FSB.frameContext = frameContext;
  FSB.getFrameAwareSelector = getFrameAwareSelector;
  FSB.collectChildFramesDom = collectChildFramesDom;
  FSB.isCanvasBasedEditor = isCanvasBasedEditor;
  FSB.hasMarkdownFormatting = hasMarkdownFormatting;
  FSB.markdownToHTML = markdownToHTML;
  FSB.applyInlineFormatting = applyInlineFormatting;
  FSB.clipboardPasteHTML = clipboardPasteHTML;
  FSB.stripMarkdown = stripMarkdown;
  FSB.isUniversalMessageInput = isUniversalMessageInput;
  FSB.generateMessagingSelectors = generateMessagingSelectors;
  FSB.handleAsyncMessage = handleAsyncMessage;
  FSB.handleBackgroundMessage = handleBackgroundMessage;

  window.FSB._modules['messaging'] = { loaded: true, timestamp: Date.now() };
})();
