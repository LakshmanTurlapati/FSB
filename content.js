// Content script for FSB v0.1
// Handles DOM reading and action execution

// DOM state cache for diffing
let previousDOMState = null;
let domStateCache = new Map();

// Tool functions for browser automation
const tools = {
  // Scroll the page
  scroll: (params) => {
    const amount = params.amount || 100;
    window.scrollBy(0, amount);
    return { success: true, scrollY: window.scrollY };
  },
  
  // Click an element
  click: (params) => {
    const element = document.querySelector(params.selector);
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
        setTimeout(() => {}, 500);
      }
      
      element.click();
      return { 
        success: true, 
        clicked: params.selector,
        elementInfo: {
          tag: element.tagName,
          text: element.textContent?.trim().substring(0, 50),
          wasInViewport: isInViewport
        }
      };
    }
    
    // Try alternative selectors if primary fails
    const alternatives = [];
    if (params.selector.startsWith('elem_')) {
      // It's an elementId, try to find by other means
      const allElements = document.querySelectorAll('*');
      for (const el of allElements) {
        if (el.textContent?.includes(params.selector)) {
          alternatives.push(el);
        }
      }
    }
    
    return { 
      success: false, 
      error: 'Element not found',
      selector: params.selector,
      alternatives: alternatives.length,
      suggestion: alternatives.length > 0 ? 'Found elements with similar content' : null
    };
  },
  
  // Type text into an input
  type: async (params) => {
    const element = document.querySelector(params.selector);
    if (element) {
      // Check if it's a valid input element with enhanced contenteditable detection
      const isInput = element.tagName === 'INPUT' || element.tagName === 'TEXTAREA';
      
      // Enhanced social media and rich text editor detection
      const isContentEditable = element.contentEditable === 'true' || 
                                element.getAttribute('contenteditable') === 'true' ||
                                element.hasAttribute('contenteditable') ||
                                element.getAttribute('role') === 'textbox' ||
                                // Social media specific patterns
                                element.classList.contains('msg-form__contenteditable') ||  // LinkedIn messages
                                element.classList.contains('tweet-box') ||                   // Twitter legacy
                                element.classList.contains('rich-editor') ||                // Twitter/X rich editor
                                element.hasAttribute('aria-label') && (
                                  element.getAttribute('aria-label').includes('happening') ||     // Twitter/X
                                  element.getAttribute('aria-label').includes('message') ||      // General messaging
                                  element.getAttribute('aria-label').includes('comment') ||      // Comments
                                  element.getAttribute('aria-label').includes('post') ||        // General posts
                                  element.getAttribute('aria-label').includes('compose')        // Compose fields
                                ) ||
                                element.hasAttribute('data-testid') && (
                                  element.getAttribute('data-testid').includes('tweet') ||       // Twitter/X
                                  element.getAttribute('data-testid').includes('post') ||        // General posts
                                  element.getAttribute('data-testid').includes('compose') ||     // Compose
                                  element.getAttribute('data-testid').includes('message')        // Messages
                                ) ||
                                element.hasAttribute('placeholder') && (
                                  element.getAttribute('placeholder').includes('mind') ||        // Facebook "What's on your mind"
                                  element.getAttribute('placeholder').includes('happening') ||   // Twitter "What's happening"
                                  element.getAttribute('placeholder').includes('message')        // Message placeholders
                                );
      
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
      
      // Universal return object for both input types
      return { 
        success: true, 
        typed: params.text,
        pressedEnter: !!params.pressEnter,
        clickedFirst: !shouldSkipClick,
        focused: document.activeElement === element,
        focusAttempts: focusAttempts,
        scrolled: rect.top < 0 || rect.top > window.innerHeight,
        insertionSuccess: isContentEditable ? insertionSuccess : true,
        finalTextContent: element.textContent || element.value || '',
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
    
    return { 
      success: false, 
      error: 'Input element not found',
      selector: params.selector,
      searched: true
    };
  },
  
  // Press Enter key on an element
  pressEnter: (params) => {
    const element = document.querySelector(params.selector);
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
  navigate: (params) => {
    if (!params.url) {
      return { success: false, error: 'No URL provided' };
    }
    
    // Validate URL
    try {
      const url = new URL(params.url);
      window.location.href = params.url;
      return { success: true, navigatingTo: params.url };
    } catch (e) {
      // If not a valid URL, try adding https://
      if (!params.url.startsWith('http://') && !params.url.startsWith('https://')) {
        const urlWithProtocol = 'https://' + params.url;
        try {
          new URL(urlWithProtocol);
          window.location.href = urlWithProtocol;
          return { success: true, navigatingTo: urlWithProtocol };
        } catch (e2) {
          return { success: false, error: 'Invalid URL format' };
        }
      }
      return { success: false, error: 'Invalid URL format' };
    }
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
  
  // Right click on element
  rightClick: (params) => {
    const element = document.querySelector(params.selector);
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
    const element = document.querySelector(params.selector);
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
  
  // Keyboard key press
  keyPress: (params) => {
    const { key, ctrlKey = false, shiftKey = false, altKey = false, selector } = params;
    const target = selector ? document.querySelector(selector) : document.activeElement;
    
    if (!target) {
      return { success: false, error: 'No target element' };
    }
    
    const keyEvent = new KeyboardEvent('keydown', {
      key,
      code: key,
      ctrlKey,
      shiftKey,
      altKey,
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
      bubbles: true,
      cancelable: true
    });
    
    target.dispatchEvent(keyUpEvent);
    
    return { success: true, key, target: selector || 'activeElement' };
  },
  
  // Select text in element
  selectText: (params) => {
    const element = document.querySelector(params.selector);
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
    const element = document.querySelector(params.selector);
    if (element) {
      element.focus();
      return { success: true, focused: params.selector };
    }
    return { success: false, error: 'Element not found' };
  },
  
  // Blur (unfocus) element
  blur: (params) => {
    const element = document.querySelector(params.selector);
    if (element) {
      element.blur();
      return { success: true, blurred: params.selector };
    }
    return { success: false, error: 'Element not found' };
  },
  
  // Hover over element
  hover: (params) => {
    const element = document.querySelector(params.selector);
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
    const element = document.querySelector(params.selector);
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
    const element = document.querySelector(params.selector);
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
    const element = document.querySelector(params.selector);
    if (element) {
      return { 
        success: true, 
        text: element.innerText || element.textContent || element.value || '' 
      };
    }
    return { success: false, error: 'Element not found' };
  },
  
  // Get attribute value
  getAttribute: (params) => {
    const element = document.querySelector(params.selector);
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
    const element = document.querySelector(params.selector);
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
    const element = document.querySelector(params.selector);
    if (element && (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA')) {
      element.value = '';
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
      return { success: true, cleared: params.selector };
    }
    return { success: false, error: 'Input element not found' };
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

// Generate multiple selectors for an element
function generateSelectors(element) {
  const selectors = [];
  
  // ID selector
  if (element.id) {
    selectors.push(`#${element.id}`);
  }
  
  // Class selector
  if (element.className && typeof element.className === 'string') {
    const classes = element.className.trim().split(/\s+/).filter(c => c);
    if (classes.length > 0) {
      selectors.push(`.${classes.join('.')}`);
    }
  }
  
  // Data-testid selector
  if (element.getAttribute('data-testid')) {
    selectors.push(`[data-testid="${element.getAttribute('data-testid')}"]`);
  }
  
  // Aria-label selector
  if (element.getAttribute('aria-label')) {
    selectors.push(`[aria-label="${element.getAttribute('aria-label')}"]`);
  }
  
  // Name attribute selector
  if (element.name) {
    selectors.push(`[name="${element.name}"]`);
  }
  
  // Tag + text selector (for buttons and links)
  if ((element.tagName === 'BUTTON' || element.tagName === 'A') && element.textContent) {
    const text = element.textContent.trim();
    if (text) {
      selectors.push(`${element.tagName.toLowerCase()}:contains("${text}")`);
    }
  }
  
  // Nth-child selector
  const parent = element.parentElement;
  if (parent) {
    const siblings = Array.from(parent.children);
    const index = siblings.indexOf(element) + 1;
    const parentSelector = generateBasicSelector(parent);
    if (parentSelector) {
      selectors.push(`${parentSelector} > ${element.tagName.toLowerCase()}:nth-child(${index})`);
    }
  }
  
  return selectors;
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
        
        // Truncate very long HTML to prevent token overflow
        const truncatedHTML = elementHTML.length > 250 
          ? elementHTML.substring(0, 250) + '...'
          : elementHTML;
        
        relevantElements.push({
          selector: generateSelector(element),
          html: truncatedHTML,
          text: element.innerText?.trim().substring(0, 100),
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
      const elementData = {
        // Unique element identifier
        elementId: `elem_${elementCount}`,
        type: node.tagName.toLowerCase(),
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
        // Generate multiple selectors
        selectors: generateSelectors(node),
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
  
  return {
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
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Content script received message:', request.action);
  
  switch (request.action) {
    case 'getDOM':
      try {
        const structuredDOM = getStructuredDOM();
        sendResponse({ success: true, structuredDOM });
      } catch (error) {
        console.error('Error getting DOM structure:', error);
        sendResponse({ success: false, error: error.message || 'Unknown error in DOM parsing' });
      }
      break;
      
    case 'executeAction':
      try {
        const { tool, params } = request;
        if (tools[tool]) {
          const result = tools[tool](params);
          sendResponse({ success: true, result });
        } else {
          sendResponse({ success: false, error: 'Unknown tool' });
        }
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
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
});

// Set up mutation observer for dynamic content
const observer = new MutationObserver((mutations) => {
  // Notify background script of significant DOM changes
  // This helps the automation adapt to dynamic pages
  if (mutations.length > 10) {
    chrome.runtime.sendMessage({
      action: 'domChanged',
      changeCount: mutations.length
    });
  }
});

// Start observing
observer.observe(document.body, {
  childList: true,
  subtree: true,
  attributes: true
});

console.log('FSB v0.1 content script loaded');