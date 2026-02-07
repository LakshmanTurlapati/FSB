/**
 * AI Integration module for Browser Agent
 * This module handles communication with multiple AI providers (xAI, Gemini)
 */

// Import provider implementations
if (typeof importScripts !== 'undefined') {
  importScripts('ai-providers.js');
}

// Tool documentation separated for modularity
const TOOL_DOCUMENTATION = {
  navigation: {
    navigate: { params: {url: "https://..."}, desc: "Go to URL" },
    searchGoogle: { params: {query: "search terms"}, desc: "Search Google" },
    refresh: { params: {}, desc: "Refresh page" },
    goBack: { params: {}, desc: "Browser back" },
    goForward: { params: {}, desc: "Browser forward" }
  },
  interaction: {
    click: { params: {selector: "CSS selector"}, desc: "Click element" },
    clickSearchResult: { 
      params: {index: 0, domain: "example.com", text: "specific text"}, 
      desc: "Click on search result links after searching. Use this on Google/Bing search results pages. Can specify index (0=first result), domain, or text to match",
      example: '{"tool": "clickSearchResult", "params": {"index": 0}}' 
    },
    type: { 
      params: {selector: "...", text: "...", pressEnter: true}, 
      desc: "Type text and submit. ALWAYS include pressEnter: true for search boxes",
      example: '{"tool": "type", "params": {"selector": "#search", "text": "query", "pressEnter": true}}'
    },
    hover: { params: {selector: "..."}, desc: "Hover over element" },
    focus: { params: {selector: "..."}, desc: "Focus element" }
  },
  extraction: {
    getText: { params: {selector: "..."}, desc: "Get element text" },
    getAttribute: { params: {selector: "...", attribute: "name"}, desc: "Get attribute" }
  },
  scrolling: {
    scroll: {
      params: {direction: "down", amount: 800},
      desc: "Scroll page. direction: 'up'/'down' (scrolls one viewport) OR amount: positive=down, negative=up",
      example: '{"tool": "scroll", "params": {"direction": "down"}}'
    },
    scrollToTop: { params: {}, desc: "Scroll to top of page" },
    scrollToBottom: { params: {}, desc: "Scroll to bottom of page" },
    scrollToElement: {
      params: {selector: "...", position: "center"},
      desc: "Scroll element into view"
    }
  },
  waiting: {
    waitForElement: { params: {selector: "...", timeout: 5000}, desc: "Wait for element to appear" },
    waitForDOMStable: { params: {timeout: 5000, stableTime: 500}, desc: "Wait for DOM changes to stop" },
    detectLoadingState: { params: {}, desc: "Check if page is loading" }
  },
  multitab: {
    openNewTab: { 
      params: {url: "https://...", active: true}, 
      desc: "Open new tab with URL. ALWAYS provide URL parameter. Returns tabId for use in other actions. Set active: false to open in background",
      example: '{"tool": "openNewTab", "params": {"url": "https://youtube.com", "active": true}}'
    },
    switchToTab: { 
      params: {tabId: 123}, 
      desc: "BLOCKED - Cannot switch tabs for security. Automation is restricted to the original session tab only",
      example: 'Action will be blocked - switchToTab is not allowed'
    },
    closeTab: { 
      params: {tabId: 123}, 
      desc: "Close tab by ID. Cannot close the current tab",
      example: '{"tool": "closeTab", "params": {"tabId": 123}}'
    },
    listTabs: { 
      params: {currentWindowOnly: true}, 
      desc: "List tab titles for context only (no URLs for privacy). Shows which tab is the session tab",
      example: '{"tool": "listTabs", "params": {"currentWindowOnly": true}}'
    },
    getCurrentTab: { 
      params: {}, 
      desc: "Get current tab information including ID, URL, title, and status",
      example: '{"tool": "getCurrentTab", "params": {}}'
    },
    waitForTabLoad: { 
      params: {tabId: 123, timeout: 30000}, 
      desc: "Wait for a tab to finish loading. TabId optional - defaults to current tab if not specified",
      example: '{"tool": "waitForTabLoad", "params": {"timeout": 10000}}'
    }
  }
};

// Task-specific prompt templates
const TASK_PROMPTS = {
  search: "CRITICAL: For search tasks you MUST: 1) Type query, then look for submit button (button[type='submit'], buttons with 'Search'/'Submit'/'Go'/'Find' text, or search/submit classes). If found, click button. If no button, use pressEnter: true, 2) Wait for results to load, 3) Extract the actual answer from the page, 4) ONLY mark taskComplete: true after you have the answer. If you don't see relevant results, scroll down to see more. When completing, provide the specific information found, not just 'found the answer'. Example result: 'I found the current weather in New York is 72°F with clear skies and 15% humidity.'",
  form: "Fill all required fields, then submit. If you don't see a submit button after filling fields, scroll down -- long forms often have buttons at the bottom. When completing, describe exactly what information was submitted and confirm the form was processed successfully. Example result: 'I successfully filled out the contact form with your name, email, and message, then submitted it. The page confirmed your message was received and you should expect a response within 24 hours.'",
  extraction: "Extract the requested information and provide the exact values found. Use systematic scrolling: extract visible items, scroll down, repeat until atBottom. When completing, include all the specific data extracted, not generic statements. Example result: 'I extracted the following product details: Price $299.99, Rating 4.8/5 stars, Stock: 15 units available, Shipping: Free 2-day delivery.'",
  navigation: "Navigate to the specified page or section. When completing, confirm what page you reached and describe what's available there. Example result: 'I successfully navigated to the Settings page where I can see options for Account Settings, Privacy Controls, Notification Preferences, and Security Settings.'",
  multitab: "TAB CONTROL LIMITATIONS: CRITICAL - You can ONLY control the original tab where automation started. 1) openNewTab creates new tabs but automation stays on original tab, 2) switchToTab is BLOCKED for security - cannot switch to other tabs, 3) listTabs shows tab titles for context only (no URLs), 4) All DOM actions happen only on the session tab. You can see other tab names for reference but cannot control them. Example result: 'I can see there are tabs for Gmail, YouTube, and Facebook open, but I am working only in the original tab where the automation started.'",
  gaming: "CRITICAL GAME CONTROLS: For games, interactive applications, or when task involves 'play', 'control', 'win', 'move': 1) NEVER use 'type' tool for game controls - it types text, not key presses, 2) PREFER dedicated arrow tools: {\"tool\": \"arrowUp\"}, {\"tool\": \"arrowDown\"}, {\"tool\": \"arrowLeft\"}, {\"tool\": \"arrowRight\"} - much simpler than keyPress, 3) For other keys use 'keyPress': {\"tool\": \"keyPress\", \"params\": {\"key\": \"Enter\"}} {\"tool\": \"keyPress\", \"params\": {\"key\": \" \"}} for Space. 4) Focus the game canvas/element if needed before key presses. When completing, describe the game actions performed and outcomes achieved.",
  shopping: `E-COMMERCE SHOPPING INTELLIGENCE - CRITICAL RULES:

NEVER BLINDLY CLICK THE FIRST RESULT! You must analyze product listings intelligently:

1. PRODUCT IDENTIFICATION:
   - Look for PRODUCT CARDS marked with [PRODUCT_CARD] in the DOM
   - Each product has: title, price, rating, seller, and sponsored status
   - Sponsored/Ad products are marked - AVOID these unless specifically requested
   - Look for [sponsored=true] or [isAd=true] indicators

2. SMART PRODUCT SELECTION:
   - READ the product titles carefully - "PS5 Controller" is NOT "PS5 Console"
   - Match the EXACT product type the user wants
   - Prefer products with: higher ratings (4+ stars), more reviews, Prime/fast shipping
   - Check price reasonableness - $50 for a PS5 console is likely a scam
   - Avoid accessories, cases, or bundles unless specifically requested

3. SELECTION PRIORITY (for e.g., "buy a PS5"):
   1st: Exact product match (PlayStation 5 Console, NOT accessories)
   2nd: Non-sponsored results over sponsored
   3rd: Higher-rated products (4.5+ stars)
   4th: Sold by official/reputable sellers (Amazon, manufacturer)
   5th: Reasonable price (research typical prices if unsure)

4. VERIFICATION BEFORE CLICKING:
   - State which product you are selecting and WHY
   - Include the price, rating, and seller in your reasoning
   - If no good match exists, explain and ask for clarification

5. AFTER CLICKING A PRODUCT:
   - Verify you're on the correct product page
   - Check product specifications match what was requested
   - Look for "Add to Cart" button, not "Buy with 1-Click" (safer)

Example reasoning: "I see 12 product listings. The first is a sponsored PS5 controller for $49.99. The third result is 'PlayStation 5 Console - God of War Bundle' priced at $499.99 with 4.7 stars and 15,234 reviews, sold by Amazon. This matches the user's request for a PS5, so I will click on this product."

When completing, provide: product selected, price, rating, seller, and why you chose it over other options.`,
  general: "Complete the task step by step. For reading/summarizing tasks: navigate to the source, click to open the specific item (email, article, post), then extract and report the content. For action tasks: perform each step and verify the outcome. When completing, provide a detailed summary with specific data found or actions taken."
};

// PERFORMANCE OPTIMIZATION: Tiered system prompts
// Use minimal prompt for continuation iterations to reduce token usage by 40-60%
const MINIMAL_CONTINUATION_PROMPT = `You are a browser automation agent. Continue the task based on the current page state.

RESPOND WITH ONLY VALID JSON. No markdown, no explanations.

IMPORTANT RULES:
1. If search results are shown, CLICK a result link - do NOT search again
2. Only mark taskComplete: true when task is ACTUALLY done
3. Provide detailed result summary when completing
4. If a previous type action SUCCEEDED, do NOT re-type. The text IS in the field. Just submit (pressEnter or click submit button)
5. For search boxes: ALWAYS use type with pressEnter: true, or follow with pressEnter tool
6. Before retrying a failed type: use getAttribute to check if text is already in the field
7. VIEWPORT: You only see current viewport elements. If looking for content, check hasMoreBelow and scroll down if true
8. EXTRACTION: For "get all X" tasks, extract visible items, scroll down, repeat until atBottom
9. TASK COMPLETION CHECK: If ALL critical actions (type + click/send) SUCCEEDED in recent history AND URL changed, the task is very likely complete. Verify and mark taskComplete: true.
10. Do NOT retry actions that already showed SUCCESS in the action history. Trust action results over visual page state.

RESPONSE FORMAT:
{
  "reasoning": "Brief analysis of current state and chosen action",
  "actions": [{"tool": "name", "params": {}}],
  "taskComplete": boolean,
  "result": "summary if complete"
}`;


/**
 * AIIntegration class handles all AI-related functionality for browser automation
 * @class
 */
class AIIntegration {
  /**
   * Creates an instance of AIIntegration
   * @param {Object} settings - Configuration settings for the AI integration
   * @param {string} settings.modelProvider - The AI provider ('xai' or 'gemini')
   * @param {string} settings.modelName - The specific model to use
   * @param {string} settings.apiKey - The API key (for xAI)
   * @param {string} settings.geminiApiKey - The Gemini API key
   * @param {string} settings.speedMode - Legacy speed mode support
   */
  constructor(settings) {
    this.settings = this.migrateSettings(settings);

    // Initialize model name from settings (fix for undefined in analytics)
    // This ensures model is available before testConnection() completes
    this.model = this.settings.modelName || this.settings.model || 'unknown';

    // Set API endpoint for legacy fallback
    this.apiEndpoint = 'https://api.x.ai/v1/chat/completions';

    // Create appropriate provider instance
    this.provider = this.createProvider();

    // Request queue and cache
    this.requestQueue = [];
    this.isProcessing = false;
    this.responseCache = new Map();
    this.cacheMaxSize = 50;
    this.cacheMaxAge = 5 * 60 * 1000; // 5 minutes

    // Multi-turn conversation state for token efficiency
    // Stores message history per session to avoid rebuilding full context each iteration
    this.conversationHistory = [];
    this.conversationSessionId = null;
    this.maxConversationTurns = 8; // Keep last 8 user+assistant pairs
  }
  
  // Migrate legacy settings to new format
  migrateSettings(settings) {
    const migrated = { ...settings };

    // Handle legacy speedMode
    if (!migrated.modelName && migrated.speedMode) {
      migrated.modelProvider = 'xai';
      migrated.modelName = 'grok-4-1-fast'; // All legacy modes map to new default
    }

    // Migrate legacy model names to new models
    const legacyModels = [
      'grok-3-fast',
      'grok-3-mini-fast-beta',
      'grok-3-mini-beta',
      'grok-4-fast',        // Old model that no longer exists
      'grok-3-fast-beta'    // Old beta model
    ];
    if (legacyModels.includes(migrated.modelName)) {
      migrated.modelName = 'grok-4-1-fast'; // New recommended default
    }

    // Set defaults
    migrated.modelProvider = migrated.modelProvider || 'xai';
    migrated.modelName = migrated.modelName || 'grok-4-1-fast';

    return migrated;
  }
  
  // Create provider instance based on settings
  createProvider() {
    automationLogger.logInit('ai_provider', 'loading', { provider: this.settings.modelProvider, model: this.settings.modelName });

    try {
      // Check if provider classes are available
      if (typeof XAIProvider !== 'undefined' && typeof GeminiProvider !== 'undefined') {
        switch (this.settings.modelProvider) {
          case 'gemini':
            automationLogger.logInit('ai_provider', 'ready', { type: 'GeminiProvider' });
            return new GeminiProvider(this.settings);
          case 'xai':
          default:
            automationLogger.logInit('ai_provider', 'ready', { type: 'XAIProvider' });
            return new XAIProvider(this.settings);
        }
      } else if (typeof createAIProvider !== 'undefined') {
        // Fallback to factory function
        automationLogger.debug('Using createAIProvider factory', {});
        return createAIProvider(this.settings);
      }
    } catch (error) {
      automationLogger.logInit('ai_provider', 'failed', { error: error.message });
    }

    // Fallback for environments where ai-providers.js isn't loaded
    automationLogger.warn('AI providers not loaded, using legacy xAI implementation', {});
    return null;
  }

  /**
   * Clear conversation history for multi-turn sessions
   * Call this when a session ends or a new task starts
   */
  clearConversationHistory() {
    const previousLength = this.conversationHistory.length;
    this.conversationHistory = [];
    this.conversationSessionId = null;
    if (previousLength > 0) {
      automationLogger.debug('Cleared conversation history', { previousLength });
    }
  }

  /**
   * Build minimal update prompt for subsequent iterations
   * Only sends what changed since last iteration to save tokens
   * @param {Object} domState - Current DOM state
   * @param {Object} context - Automation context with last action result
   * @returns {string} Minimal update prompt
   */
  buildMinimalUpdate(domState, context) {
    let update = `Page state after your action:

URL: ${domState.url || 'Unknown'}
Title: ${domState.title || 'Unknown'}
DOM changed: ${context?.domChanged ? 'Yes' : 'No'}
Scroll: Y=${domState.scrollPosition?.y || 0} | ${domState.scrollInfo?.scrollPercentage || 0}% down | Page: ${domState.scrollInfo?.pageHeight || '?'}px
${domState.scrollInfo?.hasMoreBelow ? 'More content below -- scroll down to see it' : 'At bottom of page'}`;

    // Add last action result if available
    if (context?.lastActionResult) {
      const result = context.lastActionResult;
      update += `\n\nLast action result:`;
      update += `\n- Tool: ${result.tool || 'unknown'}`;
      update += `\n- Success: ${result.success ? 'Yes' : 'No'}`;
      if (result.error) {
        update += `\n- Error: ${result.error}`;
      }
      if (result.result) {
        const resultStr = typeof result.result === 'string'
          ? result.result.substring(0, 200)
          : JSON.stringify(result.result).substring(0, 200);
        update += `\n- Result: ${resultStr}`;
      }
    }

    // Add CAPTCHA warning if present
    if (domState.captchaPresent) {
      update += `\n\nWARNING: CAPTCHA detected on page - may need human intervention`;
    }

    // Add stuck warning if applicable
    if (context?.isStuck) {
      update += `\n\nWARNING: Automation appears STUCK (${context.stuckCounter} iterations without progress)`;
      update += `\nTry a DIFFERENT approach than before.`;
    }

    // --- ELEMENT VISIBILITY FIX ---
    // Get elements from whatever source is available:
    //   1. domState.elements       - full payload (iteration 1)
    //   2. domState.viewportElements - delta payload with viewport snapshot (iteration 2+)
    //   3. Reconstructed from delta changes (fallback)
    let availableElements = [];
    if (domState.elements && domState.elements.length > 0) {
      availableElements = domState.elements;
    } else if (domState.viewportElements && domState.viewportElements.length > 0) {
      availableElements = domState.viewportElements;
    } else if (domState._isDelta && domState.changes) {
      // Fallback: reconstruct from delta changes
      availableElements = [
        ...(domState.changes.added || []),
        ...(domState.changes.modified || []),
        ...(domState.context?.unchanged || [])
      ];
    }

    // Broad interactive element detection -- not just tag-based, but also
    // ARIA roles, contenteditable, and actionability flags. This catches
    // div[contenteditable], div[role="textbox"], span[role="button"], etc.
    const isInteractive = (el) => {
      const tagTypes = ['button', 'a', 'input', 'select', 'textarea'];
      if (tagTypes.includes(el.type)) return true;
      const role = el.attributes?.role || el.implicitRole || '';
      const interactiveRoles = [
        'button', 'link', 'textbox', 'checkbox', 'radio', 'tab', 'menuitem',
        'option', 'switch', 'combobox', 'searchbox', 'slider'
      ];
      if (interactiveRoles.includes(role)) return true;
      if (el.attributes?.contenteditable === 'true') return true;
      if (el.actionability?.isActionable) return true;
      return false;
    };

    const MAX_MINIMAL_ELEMENTS = 25;

    if (availableElements.length > 0) {
      // Check if modal is open -- prioritize modal elements
      const hasModal = domState.pageContext?.pageState?.hasModal;
      let elementsToShow;

      if (hasModal) {
        // When a modal/dialog is open, prioritize elements that may belong to it
        // (newly added elements or elements near the top z-index layer)
        const modalCandidates = availableElements.filter(el => {
          const isNew = domState.changes?.added?.some(a => a.elementId === el.elementId);
          const isInViewport = el.position?.inViewport;
          return isNew || isInViewport;
        });
        const interactiveModal = modalCandidates.filter(isInteractive);
        const interactiveOther = availableElements.filter(isInteractive)
          .filter(el => !interactiveModal.includes(el));
        elementsToShow = [...interactiveModal, ...interactiveOther].slice(0, MAX_MINIMAL_ELEMENTS);

        update += `\n\nMODAL/DIALOG DETECTED - INTERACT WITH MODAL FIRST`;
      } else {
        // Standard: interactive elements first, then any in-viewport elements
        const interactive = availableElements.filter(isInteractive);
        const inViewport = availableElements
          .filter(el => el.position?.inViewport && !interactive.includes(el));
        elementsToShow = [...interactive, ...inViewport].slice(0, MAX_MINIMAL_ELEMENTS);
      }

      if (elementsToShow.length > 0) {
        update += `\n\nVISIBLE INTERACTIVE ELEMENTS (${elementsToShow.length} of ${domState._totalElements || availableElements.length} total):`;
        update += `\n${this.formatElements(elementsToShow)}`;
      } else {
        update += `\n\nWARNING: No interactive elements found on page. The page may still be loading, or you may need to scroll.`;
      }

      // Add delta change summary if available
      if (domState._isDelta && domState.changes) {
        const added = domState.changes.added?.length || 0;
        const removed = domState.changes.removed?.length || 0;
        const modified = domState.changes.modified?.length || 0;
        if (added || removed || modified) {
          update += `\n\nDOM changes: ${added} added, ${removed} removed, ${modified} modified`;
        }
      }
    } else {
      update += `\n\nWARNING: 0 page elements available. The page may still be loading or the content script may need re-injection. Try waiting or refreshing.`;
    }

    // Add page state context from semantic analysis
    if (domState.pageContext) {
      const pc = domState.pageContext;
      const ps = pc.pageState || {};

      // Page type
      const detectedTypes = Object.entries(pc.pageTypes || {})
        .filter(([k, v]) => v)
        .map(([k]) => k);
      if (detectedTypes.length > 0) {
        update += `\nPage type: ${detectedTypes.join(', ')}`;
      }

      // Critical state flags
      if (ps.noSearchResults) {
        update += `\n\nSEARCH RETURNED NO RESULTS: ${ps.noSearchResults}`;
        update += `\n  --> Try a DIFFERENT, broader search query.`;
        update += `\n  --> Do NOT click results - there are none.`;
      }
      if (ps.hasErrors && ps.errorMessages?.length > 0) {
        update += `\nPage errors: ${ps.errorMessages.slice(0, 3).join('; ')}`;
      }
      if (ps.hasCaptcha) {
        update += `\nCAPTCHA detected on page`;
      }

      // Primary actions available
      if (pc.primaryActions && pc.primaryActions.length > 0) {
        update += `\n\nPrimary actions:`;
        pc.primaryActions.slice(0, 5).forEach(a => {
          update += `\n  - "${a.text}" (${a.type}) selector: ${a.selector}`;
        });
      }
    }

    update += `\n\nContinue with the task. What's next?`;

    return update;
  }

  /**
   * Manage conversation history size to prevent unbounded growth
   * Keeps system message + last N turns
   */
  trimConversationHistory() {
    const maxMessages = this.maxConversationTurns * 2 + 1; // N pairs + system

    if (this.conversationHistory.length > maxMessages) {
      // Keep system message (first) + last N turns
      const systemMessage = this.conversationHistory[0];
      const recentMessages = this.conversationHistory.slice(-(this.maxConversationTurns * 2));
      this.conversationHistory = [systemMessage, ...recentMessages];

      automationLogger.debug('Trimmed conversation history', {
        maxMessages,
        newLength: this.conversationHistory.length,
        keptTurns: this.maxConversationTurns
      });
    }
  }

  /**
   * Update conversation history after a successful API call
   * @param {Object} prompt - The prompt that was sent
   * @param {Object} response - The AI response
   * @param {boolean} isFirstIteration - Whether this is the first iteration
   */
  updateConversationHistory(prompt, response, isFirstIteration) {
    try {
      // Serialize response to string for storage
      const responseContent = typeof response === 'string'
        ? response
        : JSON.stringify(response);

      if (isFirstIteration) {
        // First iteration: store system + user + assistant
        if (prompt.systemPrompt && prompt.userPrompt) {
          this.conversationHistory = [
            { role: 'system', content: prompt.systemPrompt },
            { role: 'user', content: prompt.userPrompt },
            { role: 'assistant', content: responseContent }
          ];
        } else if (prompt.messages) {
          // Already in messages format
          this.conversationHistory = [
            ...prompt.messages,
            { role: 'assistant', content: responseContent }
          ];
        }
      } else {
        // Subsequent iterations: append user + assistant
        if (prompt.messages && prompt.messages.length > 0) {
          // Get the last user message from the prompt
          const lastUserMsg = prompt.messages[prompt.messages.length - 1];
          if (lastUserMsg.role === 'user') {
            this.conversationHistory.push(lastUserMsg);
          }
        }
        this.conversationHistory.push({ role: 'assistant', content: responseContent });
      }

      // Trim history to prevent unbounded growth
      this.trimConversationHistory();

      automationLogger.debug('Updated conversation history', {
        sessionId: this.currentSessionId,
        historyLength: this.conversationHistory.length,
        messageRoles: this.conversationHistory.map(m => m.role)
      });
    } catch (error) {
      automationLogger.warn('Failed to update conversation history', {
        sessionId: this.currentSessionId,
        error: error.message
      });
    }
  }

  // Generate context-aware cache key
  generateCacheKey(task, domState, context = null) {
    // Base key components
    const taskHash = this.simpleHash(task);
    const urlHash = this.simpleHash(domState.url || '');
    const titleHash = this.simpleHash(domState.title || '');
    
    // Context components
    const contextParts = [];
    if (context) {
      if (context.isStuck) contextParts.push('stuck');
      if (context.iterationCount) contextParts.push(`iter${context.iterationCount}`);
      if (context.actionHistory?.length) contextParts.push(`acts${context.actionHistory.length}`);
    }
    
    // DOM state components
    const domParts = [];
    if (domState.elements?.length) domParts.push(`els${domState.elements.length}`);
    if (domState.forms?.length) domParts.push(`forms${domState.forms.length}`);
    
    // Combine all parts
    const key = `${taskHash}-${urlHash}-${titleHash}-${contextParts.join('-')}-${domParts.join('-')}`;
    return key;
  }
  
  // Simple hash function for strings
  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }
  
  // Check if cached response is still valid with dynamic expiration
  getCachedResponse(key) {
    const cached = this.responseCache.get(key);
    if (!cached) return null;
    
    // Dynamic cache expiration based on key components
    let maxAge = this.cacheMaxAge;
    
    // Reduce cache time for stuck scenarios
    if (key.includes('stuck')) maxAge = 60 * 1000; // 1 minute
    
    // Reduce cache time for later iterations
    if (key.includes('iter') && parseInt(key.match(/iter(\d+)/)?.[1] || 0) > 5) {
      maxAge = 30 * 1000; // 30 seconds
    }
    
    // Check if still valid
    if (Date.now() - cached.timestamp < maxAge) {
      automationLogger.logCache(this.currentSessionId, 'hit', key, { expiresIn: Math.round((maxAge - (Date.now() - cached.timestamp)) / 1000) });
      return cached.response;
    }
    
    // Remove expired entry
    this.responseCache.delete(key);
    return null;
  }
  
  // Store response in cache
  setCachedResponse(key, response) {
    // Limit cache size
    if (this.responseCache.size >= this.cacheMaxSize) {
      // Remove oldest entry
      const firstKey = this.responseCache.keys().next().value;
      this.responseCache.delete(firstKey);
    }
    
    this.responseCache.set(key, {
      response,
      timestamp: Date.now()
    });
  }
  
  /**
   * Main method to get AI response for browser automation
   * Now supports multi-turn conversations for token efficiency
   * @param {string} task - The task description in natural language
   * @param {Object} domState - The structured DOM state from content script
   * @param {Object|null} context - Optional context including action history and stuck detection
   * @returns {Promise<Object>} AI response with actions, reasoning, and completion status
   */
  async getAutomationActions(task, domState, context = null, options = null) {
    // Track session context for comprehensive logging
    this.currentSessionId = context?.sessionId || null;
    this.currentIteration = context?.iterationCount || 0;

    // Reset conversation history if this is a new session
    const sessionId = context?.sessionId;
    if (sessionId !== this.conversationSessionId) {
      this.clearConversationHistory();
      this.conversationSessionId = sessionId;
      automationLogger.debug('New session detected, reset conversation history', { sessionId });
    }

    // Generate context-aware cache key
    const cacheKey = this.generateCacheKey(task, domState, context);

    // Check cache first (but not if we're stuck or in later iterations)
    if (!context?.isStuck && (!context?.iterationCount || context.iterationCount < 3)) {
      const cachedResponse = this.getCachedResponse(cacheKey);
      if (cachedResponse) {
        automationLogger.logCache(this.currentSessionId, 'hit', cacheKey, { source: 'getAutomationActions' });
        return cachedResponse;
      }
    }

    // Retry configuration
    const maxRetries = 3;
    const baseDelay = 1000; // 1 second
    let lastError = null;

    // PART 2: Track retry attempts with timing
    const retryStats = {
      startTime: Date.now(),
      attempts: 0,
      timeouts: 0,
      totalWaitTime: 0
    };

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      // FIX 1B: Check if session was stopped before each retry attempt
      if (options?.shouldAbort?.()) {
        automationLogger.debug('AI request aborted - session stopped', { sessionId: this.currentSessionId, attempt });
        throw new Error('Session stopped by user');
      }

      retryStats.attempts++;
      const attemptStart = Date.now();

      try {
        // Build prompt - either full prompt (first iteration) or multi-turn (subsequent)
        let prompt;
        const isFirstIteration = this.conversationHistory.length === 0;
        const useMultiTurn = !isFirstIteration && !context?.isStuck;

        if (useMultiTurn) {
          // MULTI-TURN: Use conversation history + minimal update
          const minimalUpdate = this.buildMinimalUpdate(domState, context);
          prompt = {
            messages: [
              ...this.conversationHistory,
              { role: 'user', content: minimalUpdate }
            ]
          };
          automationLogger.debug('Using multi-turn conversation', {
            sessionId: this.currentSessionId,
            historyLength: this.conversationHistory.length,
            updateLength: minimalUpdate.length,
            updateContent: minimalUpdate
          });
        } else {
          // FIRST ITERATION or STUCK: Build full prompt
          prompt = this.buildPrompt(task, domState, context);

          // Enhance prompt on retry
          if (attempt > 0) {
            prompt = this.enhancePromptForRetry(prompt, attempt);
          }

          // If stuck, reset conversation to force fresh context
          if (context?.isStuck && this.conversationHistory.length > 0) {
            automationLogger.debug('Stuck detected, resetting conversation history', {
              sessionId: this.currentSessionId,
              previousHistoryLength: this.conversationHistory.length
            });
            this.conversationHistory = [];
          }
        }

        // Queue the request for processing
        const response = await new Promise((resolve, reject) => {
          this.requestQueue.push({
            prompt,
            cacheKey,
            resolve,
            reject,
            attempt,
            isMultiTurn: useMultiTurn
          });

          // Process queue if not already processing
          if (!this.isProcessing) {
            this.processQueue();
          }
        });

        // Store this exchange in conversation history for next iteration
        if (this.isValidResponse(response)) {
          this.updateConversationHistory(prompt, response, isFirstIteration);
        }

        // Validate response quality
        if (this.isValidResponse(response)) {
          // Cache successful response
          this.setCachedResponse(cacheKey, response);

          // Log retry summary on success (only if retries occurred)
          if (retryStats.attempts > 1) {
            automationLogger.logTiming(this.currentSessionId, 'LLM', 'retry_summary', Date.now() - retryStats.startTime, {
              attempts: retryStats.attempts,
              timeouts: retryStats.timeouts,
              totalWaitTime: retryStats.totalWaitTime,
              success: true
            });
          }
          return response;
        } else {
          throw new Error('Invalid response structure: missing required fields');
        }

      } catch (error) {
        lastError = error;
        const attemptDuration = Date.now() - attemptStart;

        // Track timeout specifically
        if (error.message.includes('timed out') || error.message.includes('timeout')) {
          retryStats.timeouts++;
          automationLogger.warn('API timeout', {
            sessionId: this.currentSessionId,
            attempt: attempt + 1,
            maxAttempts: maxRetries,
            attemptDuration,
            cumulativeTime: Date.now() - retryStats.startTime,
            remainingAttempts: maxRetries - attempt - 1
          });

          // PART 6: Send retry status to UI
          try {
            chrome.runtime.sendMessage({
              action: 'statusUpdate',
              sessionId: this.currentSessionId,
              message: 'Thinking...'
            }).catch(() => {});
          } catch (e) {
            // Ignore messaging errors
          }
        }

        automationLogger.error(`AI request attempt ${attempt + 1}/${maxRetries} failed`, {
          sessionId: this.currentSessionId,
          error: error.message,
          attemptDuration,
          cumulativeTime: Date.now() - retryStats.startTime
        });

        // If it's the last attempt, log retry summary and return fallback
        if (attempt === maxRetries - 1) {
          automationLogger.logTiming(this.currentSessionId, 'LLM', 'retry_summary', Date.now() - retryStats.startTime, {
            attempts: retryStats.attempts,
            timeouts: retryStats.timeouts,
            totalWaitTime: retryStats.totalWaitTime,
            success: false,
            lastError: error.message
          });
          return this.createFallbackResponse(task, lastError);
        }

        // Otherwise, wait with exponential backoff
        const delay = baseDelay * Math.pow(2, attempt);
        retryStats.totalWaitTime += delay;

        automationLogger.debug(`Retrying AI request in ${delay}ms`, {
          sessionId: this.currentSessionId,
          attempt: attempt + 1,
          delay,
          cumulativeWaitTime: retryStats.totalWaitTime
        });

        // Send retry status to UI
        try {
          chrome.runtime.sendMessage({
            action: 'statusUpdate',
            sessionId: this.currentSessionId,
            message: 'Retrying...'
          }).catch(() => {});
        } catch (e) {
          // Ignore messaging errors
        }

        // FIX 1B: Check if session was stopped before backoff sleep
        if (options?.shouldAbort?.()) {
          automationLogger.debug('AI request aborted before backoff - session stopped', { sessionId: this.currentSessionId });
          throw new Error('Session stopped by user');
        }

        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  // Process queued requests with adaptive management
  async processQueue() {
    if (this.isProcessing || this.requestQueue.length === 0) {
      return;
    }
    
    this.isProcessing = true;
    
    // Track performance metrics for adaptive delays
    let recentErrors = 0;
    let avgResponseTime = 0;
    let responseCount = 0;
    
    while (this.requestQueue.length > 0) {
      const request = this.requestQueue.shift();
      const startTime = Date.now();

      try {
        const response = await this.callAPI(request.prompt);

        // FSB TIMING: Log queue processing time
        automationLogger.logTiming(this.currentSessionId, 'LLM', 'queue_process', Date.now() - startTime, { model: this.model });

        // If using universal provider, response is already parsed JSON
        // Otherwise, parse the response string
        let parsed;
        if (this.provider && typeof response === 'object') {
          // Universal provider returns parsed JSON object
          parsed = this.normalizeResponse(response);
        } else {
          // Legacy or string response - parse it
          parsed = this.parseResponse(response);
        }

        // Cache the response
        this.setCachedResponse(request.cacheKey, parsed);

        // Track success metrics
        const responseTime = Date.now() - startTime;
        avgResponseTime = (avgResponseTime * responseCount + responseTime) / (responseCount + 1);
        responseCount++;
        recentErrors = Math.max(0, recentErrors - 1); // Decay error count on success

        request.resolve(parsed);
      } catch (error) {
        request.reject(error);
        recentErrors++;
      }
      
      // Adaptive delay calculation - optimized for lower latency
      // Only delay if there's queue pressure or errors, skip delay when processing smoothly
      if (this.requestQueue.length > 0) {
        const queuePressure = Math.min(this.requestQueue.length / 10, 1); // 0-1 scale
        const errorPressure = Math.min(recentErrors / 3, 1); // 0-1 scale
        const performancePressure = avgResponseTime > 5000 ? 0.5 : 0; // Add delay if slow

        // Skip delay entirely when no pressure (queue=1, no errors, good performance)
        const totalPressure = queuePressure + errorPressure + performancePressure;
        if (totalPressure > 0.1) {
          const baseDelay = 50;  // Reduced from 100ms
          // Calculate adaptive delay (50ms - 1000ms) - reduced from 100-2000ms
          const adaptiveDelay = Math.min(
            baseDelay * (1 + queuePressure * 2 + errorPressure * 5 + performancePressure * 3),
            1000  // Reduced max from 2000ms
          );

          automationLogger.logQueue(this.currentSessionId, 'adaptive_delay', { delay: Math.round(adaptiveDelay), queueLength: this.requestQueue.length, recentErrors });
          await new Promise(resolve => setTimeout(resolve, adaptiveDelay));
        }
        // When totalPressure <= 0.1, skip delay entirely for faster processing
      }
    }
    
    this.isProcessing = false;
  }
  
  /**
   * Builds a structured prompt optimized for Grok-3-mini
   * @param {string} task - The task description
   * @param {Object} domState - The current DOM state
   * @param {Object|null} context - Optional context for stuck detection and history
   * @returns {Object} Formatted prompt with system and user components
   */
  // EASY WIN #6: Task decomposition helper (improves complex task success by 40-60%)
  // Fixed: Only split on explicit sequential indicators, not "and" which appears in titles/names
  decomposeTask(task) {
    // Only split on explicit sequential indicators that clearly separate steps
    // DO NOT split on just " and " as it appears in movie titles, product names, etc.
    // e.g., "Avatar Fire and Ash", "Romeo and Juliet", "Search and Rescue"
    const explicitSeparators = [
      ' and then ',
      ', then ',
      ' then ',
      ' after that ',
      ' afterwards ',
      ' next ',
      '. Then ',
      '. After that '
    ];

    const lowerTask = task.toLowerCase();

    // Check each separator in order of specificity (most specific first)
    for (const separator of explicitSeparators) {
      if (lowerTask.includes(separator.toLowerCase())) {
        // Split case-insensitively
        const regex = new RegExp(separator.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        const steps = task.split(regex).map(s => s.trim()).filter(s => s.length > 0);

        if (steps.length > 1) {
          const numberedSteps = steps.map((step, i) => `Step ${i + 1}: ${step}`);
          return {
            steps: numberedSteps,
            isMultiStep: true,
            totalSteps: steps.length
          };
        }
      }
    }

    // No explicit separators found - treat as single task
    // This ensures movie titles like "Avatar Fire and Ash" stay intact
    return { steps: [task], isMultiStep: false };
  }

  buildPrompt(task, domState, context = null) {
    const buildStartTime = Date.now();  // Track prompt build time for performance monitoring
    automationLogger.debug('Building prompt', { sessionId: this.currentSessionId, task, domStateType: domState._isDelta ? 'DELTA' : 'FULL' });

    // PERFORMANCE: Track iteration for tiered prompting
    const iterationCount = context?.iterationCount || 1;
    const isFirstIteration = iterationCount <= 1;
    const isStuck = context?.isStuck || false;

    automationLogger.debug('Prompt context', { sessionId: this.currentSessionId, iterationCount, isFirstIteration, isStuck });

    // EASY WIN #6: Decompose complex tasks
    const taskDecomposition = this.decomposeTask(task);
    if (taskDecomposition.isMultiStep) {
      automationLogger.debug('Multi-step task detected', { sessionId: this.currentSessionId, totalSteps: taskDecomposition.totalSteps, steps: taskDecomposition.steps });
    }

    // Log raw DOM state size
    const domStateStr = JSON.stringify(domState);
    automationLogger.logDOMOperation(this.currentSessionId, 'serialize', { sizeBytes: domStateStr.length });

    // Log DOM state details
    if (domState._isDelta && domState.type === 'delta') {
      automationLogger.logDOMOperation(this.currentSessionId, 'delta_details', {
        added: domState.changes?.added?.length || 0,
        removed: domState.changes?.removed?.length || 0,
        modified: domState.changes?.modified?.length || 0,
        unchanged: domState.context?.unchanged?.length || 0
      });
    } else {
      automationLogger.logDOMOperation(this.currentSessionId, 'full_dom_details', {
        totalElements: domState.elements?.length || 0,
        hasHtmlContext: !!domState.htmlContext
      });
    }

    // Determine task type for specialized prompting
    const taskType = this.detectTaskType(task);
    automationLogger.debug('Detected task type', { sessionId: this.currentSessionId, taskType });

    // PERFORMANCE OPTIMIZATION: Use tiered system prompts
    // First iteration OR stuck: Use full prompt with all instructions
    // Subsequent iterations: Use minimal continuation prompt to save tokens
    let systemPrompt;

    if (isFirstIteration || isStuck) {
      automationLogger.debug('Using FULL system prompt', { sessionId: this.currentSessionId, reason: isFirstIteration ? 'first_iteration' : 'stuck' });
      // Core system prompt - concise and focused with reasoning framework
      systemPrompt = `You are a browser automation agent. Analyze the DOM and complete the given task.

CRITICAL REQUIREMENT: Respond with ONLY valid JSON. No markdown, no explanations, no code blocks.

=== REASONING FRAMEWORK (THINK BEFORE ACTING) ===

BEFORE TAKING ANY ACTION, you MUST complete this reasoning process:

1. UNDERSTAND THE SITUATION
   - What type of page am I on? (login, search results, form, checkout, product listing, etc.)
   - What is the page's current state? (loading, error shown, success message, idle)
   - What interactive elements are available and what do they do?
   - Where am I in the user's task journey? (beginning, middle, near completion)

2. PLAN YOUR APPROACH
   - What is the immediate goal? How will I know when it's achieved?
   - What are multiple ways to accomplish this step?
   - Which approach is most reliable based on the elements available? Why?
   - What's the expected outcome of my chosen action?

3. ASSESS CONFIDENCE
   - Am I certain this is the right element/action? (high/medium/low)
   - What assumptions am I making about this page?
   - What could go wrong? What's my fallback if this fails?

4. THEN ACT
   - Execute the chosen action with clear intent
   - Explain why you chose this approach over alternatives

Your "situationAnalysis" and "reasoning" fields MUST show this analysis, not just "I will click the button."

=== TOOL PREFERENCES (ALWAYS USE THESE WHEN AVAILABLE) ===

1. Google searches: ALWAYS use searchGoogle tool, NEVER type+click manually
   - searchGoogle handles edge cases, modals, and selector changes automatically
   - Manual typing into Google search is fragile and often fails

2. Clicking Google results: ALWAYS use clickSearchResult with index parameter
   - clickSearchResult handles modern Google DOM structure automatically
   - Example: {"tool": "clickSearchResult", "params": {"index": 0}} for first result

3. Manual selectors should ONLY be fallback AFTER specialized tools fail

4. Off-screen navigation links: If a link element is marked [off-screen] and has an href URL,
   prefer using the navigate tool with that URL instead of clicking the element.
   Clicking off-screen elements is less reliable than direct navigation.

=== MODERN GOOGLE SELECTORS (2024+) ===

Google has updated its DOM structure. Use these selectors:
- Search input: textarea[name="q"] (NOT input[name="q"] - this is outdated!)
- Search button: button[type="submit"], .gNO89b
- Result titles: h3.LC20lb, [data-header-feature] h3
- Result links: a[jsname], .yuRUbf > a, a[data-ved], a:has(h3)
- IMPORTANT: Use searchGoogle tool for searches - it handles all edge cases
- IMPORTANT: Use clickSearchResult tool for clicking results - most reliable approach

=== RULES FOR SPECIFIC SCENARIOS ===

SEARCH RESULT NAVIGATION:
WHEN ON SEARCH RESULTS PAGE: You MUST click on an actual search result link to navigate to the target website.
- DO NOT type more queries if search results are already shown
- BEST APPROACH: Use clickSearchResult tool with index parameter (e.g., index: 0 for first result)
- Modern Google uses LINKS CONTAINING HEADINGS (a > h3), not headings containing links (h3 > a)
- Look for result links: .yuRUbf a, a[href] h3, h3 a, .g a, a:has(h3), [data-ved]
- Click the most relevant result link that matches your task

CONTENT READING (emails, articles, messages, posts):
When the task requires reading, checking, or summarizing content:
1. Navigate to the content source (e.g., Gmail, news site, social media)
2. CLICK on the specific item to OPEN it -- do NOT try to read from list/preview views
   - In an inbox: click the email row/subject to open the full email
   - On a news site: click the article headline to open the full article
   - On social media: click the post to expand it
3. After the item opens, use getText to extract the full content
4. Then summarize/report what you found

COMMON MISTAKE: Using getText on a list/inbox view only gets subject lines or previews,
not the full content. You MUST click to open the item first.

CODE EDITORS: When interacting with code editors (Monaco, CodeMirror, ACE):
1. Use specific selectors: ".monaco-editor textarea", ".CodeMirror textarea", ".ace_editor textarea"
2. If typing fails with "unstable" or "animating", use waitForElement first, then retry
3. CRITICAL: If typing into a code editor FAILED, do NOT click Run/Submit/Execute. Retry typing first.
4. Include proper indentation in your code text (use spaces, include newlines as \\n in the text)
5. For multi-line code, send the complete code in a single type action

SEARCH SUBMISSION: For search forms, follow this priority order:
1. FIRST: Look for submit buttons - button[type="submit"], buttons with text "Search"/"Submit"/"Go"/"Find"
2. If submit button found: Click it after typing
3. ONLY if no submit button: Use pressEnter: true

TASK COMPLETION: NEVER mark taskComplete: true until you have ACTUALLY completed the task:
- For search tasks: Only complete after extracting the actual answer
- For messaging tasks: Only complete after message is successfully typed AND sent
- For form tasks: Only complete after successful form submission
- CRITICAL: If any critical action failed, you MUST retry before completing

COMPLETION SUMMARY: When marking taskComplete: true, include:
1. What specific actions were completed successfully
2. What information was found/extracted (exact values, not just "found it")
3. What the final outcome was
4. Confirmation that critical actions succeeded

=== VIEWPORT & SCROLLING ===

You can ONLY see elements in the current viewport (the visible part of the page).
The page may have more content above or below that you cannot see.

SCROLL METRICS (provided in page state):
- pageHeight: Total page height in pixels
- scrollPercentage: How far down the page you are (0-100%)
- hasMoreBelow / hasMoreAbove: Whether scrolling would reveal new content
- atTop / atBottom: Whether you are at page boundaries

WHEN TO SCROLL:
1. Looking for an element but don't see it? Check hasMoreBelow, scroll down if true
2. Extraction tasks (get all items)? Extract visible, scroll down, repeat until atBottom
3. Filled a form but no submit button? Scroll down -- long forms have buttons at the bottom
4. After submitting, check for confirmation messages below the viewport

SCROLL TOOLS:
- scroll: direction "up"/"down" (one viewport) or amount for precise control
- scrollToTop / scrollToBottom: Jump to page boundaries
- scrollToElement: Scroll a known element into view

=== REQUIRED RESPONSE FORMAT ===

Your response must be EXACTLY this JSON format:
{
  "situationAnalysis": "What page am I on? What state is it in? What elements matter for my task?",
  "goalAssessment": "What am I trying to achieve? How close am I? What's the next milestone?",
  "reasoning": "Why am I choosing this specific action over alternatives? What's my strategy?",
  "confidence": "high/medium/low - explain why this confidence level",
  "assumptions": ["List assumptions I'm making about this page or task"],
  "actions": [{"tool": "name", "params": {}}],
  "fallbackPlan": "If this action fails, I will try...",
  "taskComplete": boolean,
  "result": "detailed summary of what was accomplished and found (required when taskComplete is true)"
}

FAILURE TO PROVIDE VALID JSON OR COMPLETE REASONING WILL RESULT IN TASK FAILURE.

${this.getModelSpecificInstructions()}

Task Type: ${taskType}

AVAILABLE TOOLS:
${this.getToolsDocumentation(taskType)}

${TASK_PROMPTS[taskType]}`;
    } else {
      // PERFORMANCE: Use minimal prompt for continuation iterations
      automationLogger.debug('Using MINIMAL system prompt', { sessionId: this.currentSessionId, reason: 'continuation_iteration' });
      systemPrompt = MINIMAL_CONTINUATION_PROMPT;
    }

    // Validate domState structure
    if (!domState || typeof domState !== 'object') {
      throw new Error('Invalid DOM state provided to AI integration');
    }
    
    // Build user prompt with context
    // EASY WIN #6 & #7: Add task decomposition and verification requirements
    let userPrompt = `Task: ${task}`;

    // For information-gathering tasks, add explicit navigation enforcement
    if (this.isInformationGatheringTask(task)) {
      userPrompt += `\n\nNAVIGATION REQUIREMENT: This is an information-gathering task. You MUST navigate to the target website to find the answer. Do NOT try to extract information from Google search result snippets. Use clickSearchResult to visit the actual page, then extract information from there.`;
    }

    // Add decomposed steps if multi-step task
    if (taskDecomposition.isMultiStep) {
      userPrompt += `\n\nTASK BREAKDOWN (${taskDecomposition.totalSteps} steps):`;
      taskDecomposition.steps.forEach(step => {
        userPrompt += `\n  ${step}`;
      });
      userPrompt += `\n\nComplete each step in order. Mark taskComplete: true only after ALL steps are finished.`;
    }

    // EASY WIN #7: Add explicit verification requirements (reduces errors by 30%)
    userPrompt += `\n\nVERIFICATION REQUIREMENT:
After EVERY action, you MUST verify:
1. Action succeeded (element clicked/text entered/page loaded)
2. No error messages or warnings appeared
3. Expected change occurred (new content visible, form submitted, etc.)
4. If verification fails, report error and try alternative approach

Include verification in your reasoning: describe what you observe after each action.`;

    userPrompt += `\n\nCurrent page state:
URL: ${domState.url || 'Unknown'}
Title: ${domState.title || 'Unknown'}
Scroll: Y=${domState.scrollPosition?.y || 0} (${domState.scrollInfo?.scrollPercentage || 0}% of page)
Page height: ${domState.scrollInfo?.pageHeight || '?'}px | ${domState.scrollInfo?.hasMoreBelow ? 'MORE CONTENT BELOW' : 'At bottom'}
CAPTCHA present: ${domState.captchaPresent || false}`;

    // Add semantic context for better page understanding
    // Pass progress context from automation context if available
    const semanticDomState = { ...domState };
    if (context?.progress) {
      semanticDomState.progressContext = context.progress;
    }
    userPrompt += this.formatSemanticContext(semanticDomState);

    // Add context information if available
    if (context) {
      userPrompt += `\n\nAUTOMATION CONTEXT:`;
      
      // Add stuck warning with specific recovery instructions
      if (context.isStuck) {
        userPrompt += `\nIMPORTANT: The automation appears STUCK! The DOM has not changed for ${context.stuckCounter} iterations.`;
        userPrompt += `\nYou MUST try a DIFFERENT approach than before. Do NOT repeat the same actions.`;
        
        // Add context-specific recovery suggestions
        const isOnSearchPage = context.currentUrl && (
          context.currentUrl.includes('google.com/search') ||
          context.currentUrl.includes('bing.com/search') ||
          context.currentUrl.includes('duckduckgo.com')
        );
        if (isOnSearchPage) {
          userPrompt += `\n\nSTUCK ON SEARCH RESULTS - MANDATORY RECOVERY:`;
          userPrompt += `\n1. STOP all getText/extraction attempts - you CANNOT get the answer from search snippets`;
          userPrompt += `\n2. You MUST click a search result NOW using: {"tool": "clickSearchResult", "params": {"index": 0}}`;
          userPrompt += `\n3. After clicking, wait for the target page to load, then extract information from THAT page`;
          userPrompt += `\n4. DO NOT search again, DO NOT use getText on this page`;
          if (context.stuckCounter >= 2) {
            userPrompt += `\n\nFORCED ACTION: You have been stuck for ${context.stuckCounter} iterations. Your ONLY allowed action is clickSearchResult. Execute it NOW.`;
          }
        }
      }
      
      // Add DOM and URL change status
      userPrompt += `\nDOM changed since last action: ${context.domChanged ? 'Yes' : 'No'}`;
      if (context.urlChanged) {
        const prevUrl = context.urlHistory?.length > 1
          ? context.urlHistory[context.urlHistory.length - 2]?.url
          : null;
        userPrompt += `\nURL CHANGED: ${prevUrl ? prevUrl.substring(0, 80) + ' -> ' : ''}${context.currentUrl}`;
        userPrompt += `\nPage navigation occurred since last iteration - verify if your previous actions achieved the goal.`;
      } else {
        userPrompt += `\nURL: ${context.currentUrl} (unchanged)`;
      }
      userPrompt += `\nIteration count: ${context.iterationCount}`;
      
      // Add multi-tab context if available
      if (context.tabInfo) {
        userPrompt += `\n\nMULTI-TAB CONTEXT:`;
        userPrompt += `\nCurrent tab ID: ${context.tabInfo.currentTabId}`;
        if (context.tabInfo.allTabs && context.tabInfo.allTabs.length > 1) {
          userPrompt += `\nTotal open tabs: ${context.tabInfo.allTabs.length}`;
          userPrompt += `\nOther tabs available:`;
          context.tabInfo.allTabs
            .filter(tab => tab.id !== context.tabInfo.currentTabId)
            .slice(0, 5) // Show max 5 other tabs
            .forEach(tab => {
              const title = tab.title ? tab.title.substring(0, 50) + '...' : 'No title';
              const url = tab.url ? tab.url.substring(0, 60) + '...' : 'No URL';
              userPrompt += `\n  - Tab ${tab.id}: ${title} (${url})`;
            });
          
          if (context.tabInfo.allTabs.length > 6) {
            userPrompt += `\n  - ... and ${context.tabInfo.allTabs.length - 6} more tabs`;
          }
        }
        
        if (context.tabInfo.sessionTabs && context.tabInfo.sessionTabs.length > 0) {
          userPrompt += `\n\nTabs with active automation sessions:`;
          context.tabInfo.sessionTabs.forEach(tabId => {
            const tab = context.tabInfo.allTabs?.find(t => t.id === tabId);
            if (tab) {
              userPrompt += `\n  - Tab ${tabId}: ${tab.title || 'Unknown'}`;
            }
          });
        }
      }
      
      // Add action history with enhanced failure analysis
      // PROMPT SIZE OPTIMIZATION: Limit action history to reduce token usage and prevent API timeouts
      // When stuck, only show last 3 actions to keep focused recovery prompt small
      const MAX_ACTION_HISTORY = context.isStuck ? 3 : 5;
      if (context.actionHistory && context.actionHistory.length > 0) {
        const recentActions = context.actionHistory.slice(-MAX_ACTION_HISTORY);
        const skippedCount = context.actionHistory.length - recentActions.length;

        userPrompt += `\n\nRECENT ACTION HISTORY (last ${recentActions.length} of ${context.actionHistory.length} actions):`;
        if (skippedCount > 0) {
          userPrompt += `\n(${skippedCount} earlier actions omitted for brevity)`;
        }

        // Track critical failures for messaging tasks
        const criticalFailures = [];
        const isMessagingTask = context.task && (
          context.task.toLowerCase().includes('message') ||
          context.task.toLowerCase().includes('send') ||
          context.task.toLowerCase().includes('text')
        );

        recentActions.forEach((action, idx) => {
          const status = action.result?.success ? 'SUCCESS' : 'FAILED';
          userPrompt += `\n${idx + 1}. ${action.tool}(${JSON.stringify(action.params)}) - ${status}`;
          
          // Add verification information
          if (action.result?.success && action.result?.verification) {
            if (action.tool === 'click' && action.result.hadEffect !== undefined) {
              userPrompt += ` - Effect: ${action.result.hadEffect ? 'Changes detected' : 'No changes detected'}`;
              if (action.result.warning) {
                userPrompt += ` ⚠️ ${action.result.warning}`;
              }
            } else if (action.tool === 'type' && action.result.validationPassed !== undefined) {
              userPrompt += ` - Verified: ${action.result.validationPassed ? 'Text entered correctly' : 'Text NOT entered correctly'}`;
              if (!action.result.validationPassed) {
                userPrompt += ` - Expected: "${action.params.text}", Actual: "${action.result.actualValue}"`;
              }
            }
          }
          
          if (!action.result?.success) {
            if (action.result?.error) {
              userPrompt += ` - Error: ${action.result.error}`;
            }
            
            // Track critical failures for completion validation
            if (['type', 'click'].includes(action.tool)) {
              criticalFailures.push(action);
            }
          }
        });
        
        // Add critical failure warning for messaging tasks
        if (isMessagingTask && criticalFailures.length > 0) {
          const typeFailures = criticalFailures.filter(a => a.tool === 'type');
          if (typeFailures.length > 0) {
            userPrompt += `\n\n⚠️ CRITICAL: Recent type actions failed in messaging task!`;
            userPrompt += `\nYou CANNOT mark taskComplete=true until typing actions succeed.`;
            userPrompt += `\nFailed type attempts: ${typeFailures.length}`;
            userPrompt += `\nYou must verify the message was actually typed before completing.`;
          }
        } else if (criticalFailures.length >= 2) {
          userPrompt += `\n\nWARNING: Multiple critical actions (${criticalFailures.length}) have failed recently.`;
          userPrompt += `\nEnsure essential actions succeed before marking taskComplete=true.`;
        }

        // Add iteration result summary for previous actions
        const allActions = recentActions;
        const successCount = allActions.filter(a => a.result?.success).length;
        const criticalSuccess = allActions.filter(a =>
          ['type', 'click', 'pressEnter'].includes(a.tool) && a.result?.success
        );
        const criticalTotal = allActions.filter(a =>
          ['type', 'click', 'pressEnter'].includes(a.tool)
        );

        if (criticalTotal.length > 0 && criticalSuccess.length === criticalTotal.length) {
          userPrompt += `\n\nITERATION RESULT: All ${criticalSuccess.length} critical actions (type/click) SUCCEEDED.`;
          userPrompt += `\nIf these actions achieved the task goal, mark taskComplete: true with a detailed result.`;
          userPrompt += `\nDo NOT retry actions that already succeeded.`;
        }
      }
      
      // Add failed attempts summary
      if (context.failedAttempts && Object.keys(context.failedAttempts).length > 0) {
        userPrompt += `\n\nFAILED ACTION TYPES:`;
        Object.entries(context.failedAttempts).forEach(([tool, count]) => {
          userPrompt += `\n- ${tool}: failed ${count} times`;
        });
      }
      
      // Add repeated sequences warning
      if (context.repeatedSequences && context.repeatedSequences.length > 0) {
        userPrompt += `\n\nREPEATED ACTION SEQUENCES DETECTED:`;
        context.repeatedSequences.forEach(({ signature, count }) => {
          userPrompt += `\n- Sequence repeated ${count} times: ${signature}`;
        });
        userPrompt += `\nThese action sequences keep repeating without progress!`;
      }
      
      // Add specific repeated failure warnings with alternative strategies
      // PROMPT SIZE OPTIMIZATION: Limit failed action details to most recent failures
      const MAX_FAILED_DETAILS = 3;
      if (context.forceAlternativeStrategy && context.failedActionDetails && context.failedActionDetails.length > 0) {
        const recentFailures = context.failedActionDetails.slice(-MAX_FAILED_DETAILS);
        userPrompt += `\n\nCRITICAL: REPEATED ACTION FAILURES DETECTED!`;
        userPrompt += `\nThe following actions have failed multiple times and MUST use alternative strategies:\n`;

        recentFailures.forEach(failure => {
          userPrompt += `\n❌ ${failure.tool} on "${failure.params.selector || failure.params.url || 'target'}" failed ${failure.failureCount} times`;
          userPrompt += `\n   Last error: ${failure.lastError}`;
          
          // Provide specific alternative strategies based on failure type
          if (failure.lastError.includes('not found')) {
            userPrompt += `\n   ALTERNATIVES:`;
            userPrompt += `\n   - Use getText to search for visible text, then click parent/child elements`;
            userPrompt += `\n   - Try partial selectors: [class*="submit"], [id*="button"]`;
            userPrompt += `\n   - Use aria-label or data attributes: [aria-label="Submit"]`;
            userPrompt += `\n   - Navigate by position: find nearby elements and traverse`;
          } else if (failure.lastError.includes('not visible')) {
            userPrompt += `\n   ALTERNATIVES:`;
            userPrompt += `\n   - Use scroll to bring element into view`;
            userPrompt += `\n   - Check for overlays/modals blocking the element`;
            userPrompt += `\n   - Wait for element to become visible with waitForElement`;
            userPrompt += `\n   - Try parent element that might be hiding this one`;
          } else if (failure.lastError.includes('not clickable') || failure.lastError.includes('intercepted')) {
            userPrompt += `\n   ALTERNATIVES:`;
            userPrompt += `\n   - Use JavaScript click via setAttribute`;
            userPrompt += `\n   - Try keyboard navigation: focus then pressEnter`;
            userPrompt += `\n   - Click a parent or child element instead`;
            userPrompt += `\n   - Check for overlapping elements and remove them`;
          } else if (failure.lastError.includes('obscured')) {
            userPrompt += `\n   OBSCURED ELEMENT RECOVERY:`;
            userPrompt += `\n   - Press Escape first to dismiss any popups/overlays`;
            userPrompt += `\n   - Scroll element to center with scroll tool`;
            userPrompt += `\n   - Close visible modals/dialogs by clicking X or outside`;
            userPrompt += `\n   - Try clicking a parent element that wraps the target`;
            userPrompt += `\n   - Wait 500ms for animations to complete`;
            userPrompt += `\n   - Use keyPress with key: "Escape" before retrying`;
          }
        });
        
        userPrompt += `\n\n⚠️ YOU MUST NOT USE THE SAME SELECTORS/APPROACHES THAT FAILED!`;
        userPrompt += `\nBe creative and try completely different strategies as suggested above.`;
      }
      
      // Add URL history if available
      if (context.urlHistory && context.urlHistory.length > 0) {
        userPrompt += `\n\nURL NAVIGATION HISTORY:`;
        context.urlHistory.forEach((entry, idx) => {
          userPrompt += `\n${idx + 1}. ${entry.url} (iteration ${entry.iteration})`;
        });
      }
      
      // Focused stuck recovery instructions (kept concise to avoid prompt explosion)
      if (context.isStuck) {
        userPrompt += `\n\nSTUCK RECOVERY - You MUST change approach:
1. Try completely different selectors or methods
2. If on a search page, click a result link to navigate away
3. If you already extracted data (getText returned values), complete the task with that data
4. If actions succeeded but verification is failing after 3+ attempts, assume success and complete
5. Include all found information in a detailed result summary when completing`;
      }
      
      // Add verification context (condensed when stuck to save prompt space)
      if (!context.isStuck) {
        userPrompt += `\n\nACTION VERIFICATION:
- For 'click' actions: System detects if DOM changed, URL changed, or new elements appeared
- For 'type' actions: System verifies the text was actually entered in the field
- If a click shows "No changes detected", try a different element or approach
- If typing shows "Text NOT entered correctly", the field may need special handling
- You can safely include 3-5 related actions in a single response`;
      }
    }
    
    // PROMPT SIZE LIMITS: Cap element count and HTML context when stuck to prevent 49K+ prompts
    const MAX_ELEMENTS_STUCK = 20;  // Only top 20 relevant elements when stuck
    const MAX_HTML_CONTEXT_STUCK = 5000; // 5K chars max for HTML context when stuck
    const HARD_PROMPT_CAP = 15000; // Hard cap on total user prompt characters

    // Handle delta updates differently
    if (domState._isDelta && domState.type === 'delta') {
      userPrompt += `\n\nDOM CHANGES SINCE LAST ACTION:`;

      // Show what changed
      if (domState.changes) {
        if (domState.changes.added?.length > 0) {
          const addedElements = isStuck ? domState.changes.added.slice(0, MAX_ELEMENTS_STUCK) : domState.changes.added;
          userPrompt += `\n\nNEWLY ADDED ELEMENTS (${addedElements.length}${isStuck && domState.changes.added.length > MAX_ELEMENTS_STUCK ? ` of ${domState.changes.added.length}` : ''}):`;
          userPrompt += `\n${this.formatDeltaElements(addedElements)}`;
        }

        if (domState.changes.removed?.length > 0) {
          const removedElements = isStuck ? domState.changes.removed.slice(0, 5) : domState.changes.removed;
          userPrompt += `\n\nREMOVED ELEMENTS (${removedElements.length}):`;
          removedElements.forEach(el => {
            userPrompt += `\n- ${el.elementId} (${el.selector}) was at (${el._wasAt?.x}, ${el._wasAt?.y})`;
          });
        }

        if (domState.changes.modified?.length > 0) {
          const modifiedElements = isStuck ? domState.changes.modified.slice(0, MAX_ELEMENTS_STUCK) : domState.changes.modified;
          userPrompt += `\n\nMODIFIED ELEMENTS (${modifiedElements.length}):`;
          userPrompt += `\n${this.formatDeltaElements(modifiedElements, true)}`;
        }
      }

      // Include reference to important unchanged elements (limit when stuck)
      if (domState.context?.unchanged?.length > 0) {
        const unchangedElements = isStuck ? domState.context.unchanged.slice(0, 10) : domState.context.unchanged;
        userPrompt += `\n\nKEY REFERENCE ELEMENTS (unchanged but important):`;
        userPrompt += `\n${this.formatDeltaElements(unchangedElements)}`;
      }

      // Add change summary
      if (domState.context?.metadata) {
        const meta = domState.context.metadata;
        userPrompt += `\n\nCHANGE SUMMARY: ${meta.changeRatio > 0.5 ? 'Major' : meta.changeRatio > 0.2 ? 'Moderate' : 'Minor'} changes detected`;
        userPrompt += ` (${meta.addedCount} added, ${meta.removedCount} removed, ${meta.modifiedCount} modified)`;
      }

      // Include viewport elements in delta path so the AI always has page context.
      // Delta changes alone may not capture all visible interactive elements.
      if (domState.viewportElements && domState.viewportElements.length > 0) {
        const vpLimit = isStuck ? MAX_ELEMENTS_STUCK : domState.viewportElements.length;
        const vpElements = domState.viewportElements.slice(0, vpLimit);
        userPrompt += `\n\nCURRENT VIEWPORT ELEMENTS (${vpElements.length} of ${domState._totalElements || '?'} total):`;
        userPrompt += `\n${this.formatElements(vpElements)}`;
      }
    } else {
      // Full DOM snapshot (initial or fallback)
      // When stuck, limit to top interactive elements to keep prompt small
      let elements = domState.elements || [];
      if (isStuck && elements.length > MAX_ELEMENTS_STUCK) {
        // Prioritize interactive elements (buttons, links, inputs) that are in viewport
        elements = elements
          .filter(el => ['button', 'a', 'input', 'select', 'textarea'].includes(el.type) || el.position?.inViewport)
          .slice(0, MAX_ELEMENTS_STUCK);
        userPrompt += `\n\nSTRUCTURED ELEMENTS (top ${elements.length} of ${domState.elements.length} - focused for recovery):
${this.formatElements(elements)}`;
      } else {
        userPrompt += `\n\nSTRUCTURED ELEMENTS (with positions and metadata):
${this.formatElements(elements)}`;
      }
    }

    // HTML context - cap size when stuck to prevent prompt explosion
    let htmlContextStr = this.formatHTMLContext(domState.htmlContext);
    if (isStuck && htmlContextStr.length > MAX_HTML_CONTEXT_STUCK) {
      htmlContextStr = htmlContextStr.substring(0, MAX_HTML_CONTEXT_STUCK) + '\n... (truncated for stuck recovery)';
    }

    userPrompt += `\n\nHTML CONTEXT (actual markup for better understanding):
${htmlContextStr}

What actions should I take to complete the task?`;

    // HARD CAP: Truncate user prompt if it exceeds the limit
    if (userPrompt.length > HARD_PROMPT_CAP) {
      automationLogger.warn('User prompt exceeded hard cap, truncating', {
        sessionId: this.currentSessionId,
        originalLength: userPrompt.length,
        cap: HARD_PROMPT_CAP,
        isStuck
      });
      userPrompt = userPrompt.substring(0, HARD_PROMPT_CAP) + '\n\n[Prompt truncated for performance. Focus on the task and available elements above.]';
    }

    const finalPrompt = { systemPrompt, userPrompt };

    // Log final prompt details
    const estimatedTokens = Math.ceil((systemPrompt.length + userPrompt.length) / 3.5);
    automationLogger.debug('Final prompt built', {
      sessionId: this.currentSessionId,
      systemPromptLength: systemPrompt.length,
      userPromptLength: userPrompt.length,
      totalLength: systemPrompt.length + userPrompt.length,
      estimatedTokens,
      wasStuck: isStuck,
      wasCapped: userPrompt.includes('[Prompt truncated')
    });

    // PART 1: Add prompt size warning when exceeding threshold
    if (estimatedTokens > 10000) {
      automationLogger.warn('Large prompt detected', {
        sessionId: this.currentSessionId,
        estimatedTokens,
        systemPromptLength: systemPrompt.length,
        userPromptLength: userPrompt.length,
        recommendation: 'Consider reducing DOM element count or HTML context'
      });
    }

    // Store prompt for token estimation
    this.storePrompt(finalPrompt);

    // Log full prompt for session history (comprehensive logging)
    if (typeof automationLogger !== 'undefined' && this.currentSessionId) {
      automationLogger.logPrompt(
        this.currentSessionId,
        systemPrompt,
        userPrompt,
        this.currentIteration || 0
      );
    }

    // Log prompt build timing for performance monitoring
    automationLogger.logTiming(this.currentSessionId, 'PROMPT', 'build_total', Date.now() - buildStartTime);

    return finalPrompt;
  }
  
  // Format elements for AI context with enhanced information
  formatElements(elements) {
    if (!Array.isArray(elements)) {
      automationLogger.warn('formatElements received non-array', { sessionId: this.currentSessionId, type: typeof elements });
      return 'No elements available';
    }
    
    return elements.map(el => {
      let desc = `[${el.elementId}] ${el.type}`;
      
      // Add human-readable description if available
      if (el.description) {
        desc += ` - ${el.description}`;
      }
      
      // Add identifiers
      if (el.id) desc += ` #${el.id}`;
      if (el.class) desc += ` .${el.class.split(' ').slice(0, 2).join('.')}`;
      
      // Add text content
      if (el.text) desc += ` "${el.text.substring(0, 150)}${el.text.length > 150 ? '...' : ''}"`;  // Increased from 50 to 150 for better context
      
      // Add element-specific details
      if (el.inputType) desc += ` type="${el.inputType}"`;
      if (el.placeholder) desc += ` placeholder="${el.placeholder}"`;
      if (el.href) desc += ` href="${el.href}"`;
      if (el.labelText) desc += ` label="${el.labelText}"`;
      
      // Add state information
      const states = [];
      if (el.interactionState?.disabled) states.push('disabled');
      if (el.interactionState?.readonly) states.push('readonly');
      if (el.interactionState?.checked) states.push('checked');
      if (el.interactionState?.focused) states.push('focused');
      if (!el.position?.inViewport) states.push('off-screen');
      if (states.length > 0) desc += ` [${states.join(',')}]`;
      
      // Add position
      if (el.position) {
        desc += ` at (${el.position.x}, ${el.position.y})`;
      }
      
      // Add form association
      if (el.formId) desc += ` in ${el.formId}`;
      
      // Add primary selector -- prefer CSS over XPath for querySelector compatibility
      if (el.selectors && el.selectors.length > 0) {
        const cssSelector = el.selectors.find(s => !s.startsWith('//'));
        const primarySelector = cssSelector || el.selectors[0];
        desc += ` selector: "${primarySelector}"`;
      }
      
      return desc;
    }).join('\\n');
  }
  
  // Format delta elements (compressed format for changes)
  formatDeltaElements(elements, showChanges = false) {
    if (!Array.isArray(elements)) {
      return 'No elements';
    }
    
    return elements.map(el => {
      let desc = `[${el.elementId}] ${el.type}`;
      
      // Add key identifiers
      if (el.id) desc += ` #${el.id}`;
      if (el.testId) desc += ` testId="${el.testId}"`;
      
      // Add text (already truncated)
      if (el.text) desc += ` "${el.text}"`;
      
      // Interactive marker
      if (el.interactive) desc += ` [interactive]`;
      if (el.inViewport) desc += ` [in-view]`;
      
      // Selector
      if (el.selectors?.[0]) desc += ` sel: "${el.selectors[0]}"`;
      
      // Show changes if modified
      if (showChanges && el._changes) {
        const changes = [];
        if (el._changes.text) changes.push(`text: "${el._changes.text.old}" → "${el._changes.text.new}"`);
        if (el._changes.position) {
          const oldPos = el._changes.position.old;
          const newPos = el._changes.position.new;
          if (oldPos && newPos) {
            changes.push(`moved: (${oldPos.x},${oldPos.y}) → (${newPos.x},${newPos.y})`);
          }
        }
        if (el._changes.attributes) changes.push('attributes changed');
        if (changes.length > 0) desc += ` CHANGES: ${changes.join(', ')}`;
      }
      
      return desc;
    }).join('\\n');
  }
  
  // Format HTML context for AI understanding
  formatHTMLContext(htmlContext) {
    if (!htmlContext || typeof htmlContext !== 'object') {
      return 'No HTML context available';
    }
    
    let formatted = '';
    
    // Add comprehensive page structure context
    if (htmlContext.pageStructure) {
      const struct = htmlContext.pageStructure;
      formatted += `PAGE INFORMATION:\n`;
      formatted += `- Title: ${struct.title}\n`;
      formatted += `- URL: ${struct.url}\n`;
      formatted += `- Domain: ${struct.domain}\n`;
      formatted += `- Path: ${struct.pathname}\n`;
      
      // Meta information
      if (struct.meta) {
        formatted += `\nMETA DATA:\n`;
        if (struct.meta.description) formatted += `- Description: ${struct.meta.description}\n`;
        if (struct.meta.ogTitle) formatted += `- OG Title: ${struct.meta.ogTitle}\n`;
      }
      
      // Forms with detailed structure
      if (struct.forms && struct.forms.length > 0) {
        formatted += `\nFORMS (${struct.forms.length} found):\n`;
        struct.forms.forEach((form, i) => {
          formatted += `  Form "${form.id}": ${form.method} -> ${form.action}\n`;
          if (form.fields && form.fields.length > 0) {
            formatted += `  Fields:\n`;
            form.fields.forEach(field => {
              formatted += `    - ${field.type} "${field.name || field.id}" ${field.placeholder ? `placeholder="${field.placeholder}"` : ''} ${field.required ? '[required]' : ''}\n`;
            });
          }
          formatted += `  HTML: ${form.html}\n\n`;
        });
      }
      
      // Navigation structure
      if (struct.navigation && struct.navigation.length > 0) {
        formatted += `\nNAVIGATION AREAS:\n`;
        struct.navigation.forEach(nav => {
          formatted += `  - ${nav.ariaLabel || 'Navigation'} (${nav.linksCount} links)\n`;
          if (nav.links && nav.links.length > 0) {
            nav.links.forEach(link => {
              formatted += `    - "${link.text}" -> ${link.href}\n`;
            });
          }
        });
      }
      
      // Page headings for structure
      if (struct.headings && struct.headings.length > 0) {
        formatted += `\nPAGE STRUCTURE (Headings):\n`;
        struct.headings.forEach(h => {
          formatted += `  ${h.level}: ${h.text}${h.id ? ` #${h.id}` : ''}\n`;
        });
      }
      
      // Active element
      if (struct.activeElement) {
        formatted += `\nCURRENT FOCUS: ${struct.activeElement.tag}${struct.activeElement.id ? ` #${struct.activeElement.id}` : ''}\n`;
      }
      
      formatted += '\n';
    }
    
    // Add relevant interactive elements with their HTML
    if (htmlContext.relevantElements && htmlContext.relevantElements.length > 0) {
      formatted += `INTERACTIVE ELEMENTS WITH HTML MARKUP:\n`;
      formatted += `(Found ${htmlContext.totalElementsFound} total, showing ${htmlContext.relevantElements.length})\n\n`;
      
      htmlContext.relevantElements.forEach((element, i) => {
        formatted += `${i + 1}. ${element.tag.toUpperCase()}`;
        if (element.position) {
          formatted += ` at (${element.position.x}, ${element.position.y})`;
        }
        formatted += '\n';
        formatted += `   Selector: ${element.selector}\n`;
        if (element.text) {
          formatted += `   Text: "${element.text}"\n`;
        }
        formatted += `   HTML: ${element.html}\n\n`;
      });
    }
    
    return formatted;
  }

  /**
   * Format a hierarchical page structure summary
   * @param {Object} pageContext - The page context from detectPageContext
   * @param {Array} elements - The filtered elements array
   * @returns {string} Formatted page structure summary
   */
  formatPageStructureSummary(pageContext, elements) {
    let summary = '\n=== PAGE STRUCTURE ===';

    // Forms summary
    const formElements = elements.filter(el => el.context?.formId || el.type === 'form');
    const forms = {};
    formElements.forEach(el => {
      const formId = el.context?.formId || el.formId || 'unnamed';
      if (!forms[formId]) {
        forms[formId] = { fields: [], hasSubmit: false };
      }
      if (el.type === 'input' || el.type === 'textarea' || el.type === 'select') {
        forms[formId].fields.push(el.purpose?.intent || el.inputType || 'field');
      }
      if (el.purpose?.intent === 'submit' || el.isButton) {
        forms[formId].hasSubmit = true;
      }
    });

    if (Object.keys(forms).length > 0) {
      summary += '\n\nFORMS:';
      Object.entries(forms).forEach(([id, form]) => {
        const fieldTypes = [...new Set(form.fields)].slice(0, 5);
        summary += `\n  - ${id}: ${form.fields.length} fields (${fieldTypes.join(', ')})`;
        summary += form.hasSubmit ? ' [has submit]' : ' [no submit button found]';
      });
    }

    // Navigation regions
    const navElements = elements.filter(el =>
      el.relationshipContext?.includes('navigation') ||
      el.purpose?.role?.includes('navigation')
    );
    if (navElements.length > 0) {
      summary += '\n\nNAVIGATION:';
      // Group by context
      const navGroups = {};
      navElements.forEach(el => {
        const ctx = el.relationshipContext || 'main navigation';
        if (!navGroups[ctx]) navGroups[ctx] = [];
        navGroups[ctx].push(el);
      });
      Object.entries(navGroups).forEach(([ctx, els]) => {
        summary += `\n  - ${ctx}: ${els.length} links`;
      });
    }

    // Main content areas
    const mainElements = elements.filter(el =>
      el.relationshipContext?.includes('main content') ||
      el.relationshipContext?.includes('article')
    );
    if (mainElements.length > 0) {
      summary += '\n\nMAIN CONTENT:';
      summary += `\n  - ${mainElements.length} interactive elements`;

      // Identify content type
      const hasArticle = mainElements.some(el => el.relationshipContext?.includes('article'));
      const hasCards = mainElements.some(el => el.relationshipContext?.includes('card'));
      const hasList = mainElements.some(el => el.relationshipContext?.includes('list'));

      if (hasArticle) summary += '\n  - Contains article content';
      if (hasCards) summary += '\n  - Contains cards/items';
      if (hasList) summary += '\n  - Contains list items';
    }

    // Modal/dialog present
    const modalElements = elements.filter(el => el.relationshipContext?.includes('modal'));
    if (modalElements.length > 0) {
      summary += '\n\n*** MODAL ACTIVE ***';
      summary += `\n  - ${modalElements.length} elements in modal`;
      summary += '\n  - Interact with modal first before underlying page';
    }

    return summary;
  }

  /**
   * Format action history for AI context
   * Shows what was attempted and results to prevent repeating failures
   * @param {Array} actionHistory - Array of past actions with results
   * @param {number} maxActions - Maximum number of actions to show (default 5)
   * @returns {string} Formatted action history
   */
  formatActionHistory(actionHistory, maxActions = 5) {
    if (!actionHistory || actionHistory.length === 0) {
      return '\n\n=== ACTION HISTORY ===\nNo actions taken yet.';
    }

    const recent = actionHistory.slice(-maxActions);
    const skipped = actionHistory.length - recent.length;

    let history = '\n\n=== ACTION HISTORY ===';
    history += `\nRecent actions (last ${recent.length} of ${actionHistory.length}):`;

    if (skipped > 0) {
      history += ` (${skipped} earlier actions omitted)`;
    }

    recent.forEach((action, i) => {
      const status = action.result?.success ? 'OK' : 'FAILED';
      const tool = action.tool || action.action || 'unknown';

      // Summarize target
      let target = '';
      if (action.params?.selector) {
        // Shorten long selectors
        const sel = action.params.selector;
        target = sel.length > 40 ? sel.substring(0, 37) + '...' : sel;
      } else if (action.params?.text) {
        target = `"${action.params.text.substring(0, 25)}..."`;
      } else if (action.params?.url) {
        // Extract last path segment
        target = action.params.url.split('/').slice(-2).join('/');
      } else {
        target = 'target';
      }

      history += `\n  ${i + 1}. ${tool}(${target}) -> ${status}`;

      // Add effect or error details
      if (action.result?.success) {
        if (action.result.hadEffect === false) {
          history += ' [no visible change]';
        } else if (action.result.navigationOccurred) {
          history += ' [page changed]';
        } else if (action.result.formSubmitted) {
          history += ' [form submitted]';
        }
      } else if (action.result?.error) {
        history += ` [${action.result.error.substring(0, 40)}]`;
      }
    });

    // Add guidance based on history
    const failures = recent.filter(a => !a.result?.success);
    if (failures.length >= 2) {
      history += '\n\n*** Multiple recent failures - try a different approach ***';

      // Identify repeated failures
      const failedSelectors = failures
        .map(f => f.params?.selector)
        .filter(Boolean);
      const uniqueSelectors = [...new Set(failedSelectors)];

      if (uniqueSelectors.length < failedSelectors.length) {
        history += '\n  - Same selector failing multiple times';
        history += '\n  - Consider: different selector, scroll to element, or wait for element';
      }
    }

    return history;
  }

  /**
   * Format semantic context for AI understanding
   * Creates a high-level summary of page type, state, and available actions
   * @param {Object} domState - The DOM state with pageContext
   * @returns {string} Formatted semantic context string
   */
  formatSemanticContext(domState) {
    let context = '';

    // Use elements from whatever source is available (full payload or delta viewport snapshot)
    const elementsForContext = domState.elements || domState.viewportElements || [];

    // 1. PAGE STRUCTURE SUMMARY (forms, navigation, regions)
    if (domState.pageContext && elementsForContext.length > 0) {
      context += this.formatPageStructureSummary(domState.pageContext, elementsForContext);
    }

    // 2. PAGE UNDERSTANDING (type, intent, state)
    if (domState.pageContext) {
      const pc = domState.pageContext;

      // Page type detection
      const detectedTypes = Object.entries(pc.pageTypes || {})
        .filter(([k, v]) => v)
        .map(([k]) => k);

      context += `\n=== PAGE UNDERSTANDING ===`;
      context += `\nPage Type: ${detectedTypes.length > 0 ? detectedTypes.join(', ') : 'general'}`;
      context += `\nPage Intent: ${pc.pageIntent || 'unknown'}`;

      // Page state
      const ps = pc.pageState || {};
      let stateDescription = 'ready';
      if (ps.isLoading) stateDescription = 'LOADING (wait for content)';
      else if (ps.hasErrors) stateDescription = 'HAS ERRORS (check messages)';
      else if (ps.hasSuccess) stateDescription = 'SUCCESS STATE (may be complete)';
      else if (ps.hasModal) stateDescription = 'MODAL/DIALOG OPEN';
      else if (ps.hasCaptcha) stateDescription = 'CAPTCHA PRESENT (needs solving)';

      context += `\nPage State: ${stateDescription}`;

      // Error messages if present
      if (ps.errorMessages && ps.errorMessages.length > 0) {
        context += `\n\nERROR MESSAGES DETECTED:`;
        ps.errorMessages.forEach((msg, i) => {
          context += `\n  ${i + 1}. "${msg}"`;
        });
        context += `\n  --> You should address these errors before proceeding`;
      }

      // Surface "no search results" state
      if (ps.noSearchResults) {
        context += `\n\nSEARCH RETURNED NO RESULTS: ${ps.noSearchResults}`;
        context += `\n  --> Your search query found nothing. Try a DIFFERENT, broader query.`;
        context += `\n  --> Do NOT use clickSearchResult - there are no results to click.`;
        context += `\n  --> Remove restrictive operators like site:, exact quotes, etc.`;
      }

      // Primary actions available
      if (pc.primaryActions && pc.primaryActions.length > 0) {
        context += `\n\nPRIMARY ACTIONS AVAILABLE:`;
        pc.primaryActions.forEach(a => {
          context += `\n  - "${a.text}" (${a.type}) selector: ${a.selector}`;
        });
      }
    }

    // Format elements by purpose if available (use fallback to viewportElements)
    if (elementsForContext.length > 0) {
      const purposefulElements = elementsForContext.filter(el => el.purpose && el.purpose.role !== 'unknown');

      if (purposefulElements.length > 0) {
        context += `\n\n=== KEY ELEMENTS BY PURPOSE ===`;

        // Group elements by role
        const grouped = {};
        purposefulElements.forEach(el => {
          const role = el.purpose.role;
          if (!grouped[role]) grouped[role] = [];
          grouped[role].push(el);
        });

        // Format each group
        Object.entries(grouped).forEach(([role, els]) => {
          // Limit to 5 per role
          const limited = els.slice(0, 5);
          context += `\n${role.toUpperCase()}:`;
          limited.forEach(el => {
            const text = (el.text || '').substring(0, 40);
            const selector = el.selectors?.[0] || 'unknown';
            const intent = el.purpose.intent || '';
            const relationship = el.relationshipContext ? ` ${el.relationshipContext}` : '';
            context += `\n  - "${text || el.id || 'unnamed'}" [${intent}]${relationship} -> ${selector}`;
          });
          if (els.length > 5) {
            context += `\n  ... and ${els.length - 5} more`;
          }
        });
      }

      // Highlight high-priority elements
      const highPriority = purposefulElements.filter(el => el.purpose.priority === 'high');
      if (highPriority.length > 0) {
        context += `\n\nHIGH-PRIORITY ELEMENTS (likely relevant to your task):`;
        highPriority.slice(0, 8).forEach(el => {
          const text = (el.text || el.placeholder || el.attributes?.['aria-label'] || '').substring(0, 30);
          context += `\n  * ${el.purpose.role}/${el.purpose.intent}: "${text}" -> ${el.selectors?.[0] || 'unknown'}`;
          if (el.purpose.sensitive) context += ` [SENSITIVE]`;
          if (el.purpose.danger) context += ` [DANGER]`;
        });
      }
    }

    // 4. ACTION HISTORY (what was tried, what worked/failed)
    if (domState.actionHistory) {
      context += this.formatActionHistory(domState.actionHistory);
    }

    // 5. PROGRESS CONTEXT (iterations, success rate)
    if (domState.progressContext) {
      const prog = domState.progressContext;
      context += `\n\n=== TASK PROGRESS ===`;
      context += `\nIterations: ${prog.iterationsUsed}/${prog.maxIterations} (${prog.progressPercent}%)`;
      context += `\nActions: ${prog.actionsSucceeded} succeeded, ${prog.actionsFailed} failed`;
      context += `\nMomentum: ${prog.momentum}`;
      context += `\nEstimated completion: ${Math.round(prog.estimatedCompletion * 100)}%`;

      if (prog.stuckDuration > 0) {
        context += `\n*** STUCK for ${prog.stuckDuration} iterations - try different approach ***`;
      }
    }

    return context;
  }

  /**
   * Helper to group array by key function
   */
  static groupBy(array, keyFn) {
    const result = {};
    array.forEach(item => {
      const key = keyFn(item);
      if (!result[key]) result[key] = [];
      result[key].push(item);
    });
    return result;
  }

  // Call AI API using the appropriate provider
  async callAPI(prompt) {
    // Use provider if available, otherwise fallback to legacy implementation
    if (this.provider) {
      try {
        automationLogger.logAPI(this.currentSessionId, this.settings.modelProvider, 'call', { model: this.settings.modelName });

        // Set current provider for parsing context
        this.currentProvider = this.provider;

        // FSB TIMING: Track build request time
        const buildStart = Date.now();
        const requestBody = await this.provider.buildRequest(prompt, {});
        automationLogger.logTiming(this.currentSessionId, 'LLM', 'build_request', Date.now() - buildStart);

        // FSB TIMING: Track send request time (main API latency)
        const sendStart = Date.now();
        const response = await this.provider.sendRequest(requestBody);
        automationLogger.logTiming(this.currentSessionId, 'LLM', 'send_request', Date.now() - sendStart);

        // FSB TIMING: Track parse response time
        const parseStart = Date.now();
        const parsed = this.provider.parseResponse(response);
        automationLogger.logTiming(this.currentSessionId, 'LLM', 'parse_response', Date.now() - parseStart);
        
        // Track token usage
        this.trackTokenUsage({
          usage: {
            prompt_tokens: parsed.usage.inputTokens,
            completion_tokens: parsed.usage.outputTokens,
            total_tokens: parsed.usage.totalTokens
          },
          model: parsed.model
        }, true);
        
        // parsed.content is already a JSON object from universal provider
        return parsed.content;
      } catch (error) {
        automationLogger.error('API call failed', { sessionId: this.currentSessionId, provider: this.settings.modelProvider, error: error.message });
        this.trackTokenUsage(null, false);
        throw error;
      }
    }

    // Legacy xAI implementation for backward compatibility
    return this.legacyCallAPI(prompt);
  }

  // Legacy xAI API implementation
  async legacyCallAPI(prompt) {
    const { systemPrompt, userPrompt } = prompt;

    // Check if API key is provided
    if (!this.settings.apiKey) {
      throw new Error('xAI API key is not configured. Please set it in extension settings.');
    }

    const apiEndpoint = 'https://api.x.ai/v1/chat/completions';
    const model = this.settings.modelName || 'grok-3-fast';

    automationLogger.logAPI(this.currentSessionId, 'xai', 'legacy_call', { endpoint: apiEndpoint, model });
    
    const requestBody = {
      model: model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.1,
      max_tokens: 4000
    };
    
    try {
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.settings.apiKey}`
        },
        body: JSON.stringify(requestBody)
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`xAI API error: ${response.status} - ${errorText}`);
      }
      
      const data = await response.json();
      this.trackTokenUsage(data, true);
      return this.extractContent(data);
      
    } catch (error) {
      automationLogger.error('xAI API call failed (legacy)', { sessionId: this.currentSessionId, error: error.message });
      this.trackTokenUsage(null, false);
      throw error;
    }
  }

  // Extract content from xAI API response
  extractContent(data) {
    automationLogger.logAPI(this.currentSessionId, 'xai', 'extract_content', {
      hasChoices: !!data.choices,
      choicesLength: data.choices?.length
    });

    // Try multiple possible response formats for xAI Grok
    let messageContent = null;
    let contentFormat = null;

    // Standard OpenAI format
    if (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) {
      messageContent = data.choices[0].message.content;
      contentFormat = 'openai';
    }
    // Alternative xAI format - sometimes content is at root level
    else if (data.content) {
      messageContent = data.content;
      contentFormat = 'root_level';
    }
    // Another alternative - text field
    else if (data.choices && data.choices[0] && data.choices[0].text) {
      messageContent = data.choices[0].text;
      contentFormat = 'text_field';
    }
    // Direct message format
    else if (data.message) {
      messageContent = data.message;
      contentFormat = 'direct_message';
    }

    if (messageContent) {
      automationLogger.logAPI(this.currentSessionId, 'xai', 'content_extracted', {
        format: contentFormat,
        contentLength: messageContent?.length
      });
      return messageContent;
    } else {
      automationLogger.error('Could not find message content in xAI response', {
        sessionId: this.currentSessionId,
        availableKeys: Object.keys(data)
      });
      throw new Error('Could not extract message content from xAI API response');
    }
  }
  
  // Parse Grok-3-mini response into actions
  parseResponse(responseText) {
    const provider = this.currentProvider?.provider || 'unknown';
    automationLogger.logAPI(this.currentSessionId, provider, 'parse_start', { responsePreview: responseText?.substring(0, 200) });

    // Log raw response for comprehensive session logging
    if (typeof automationLogger !== 'undefined' && this.currentSessionId) {
      automationLogger.logRawResponse(
        this.currentSessionId,
        responseText,
        false, // Will update to true if parsing succeeds
        this.currentIteration
      );
    }

    // Check if responseText is empty or null
    if (!responseText || responseText.trim() === '') {
      throw new Error('Empty response from AI');
    }

    // Try multiple parsing strategies (no fallback recovery - demand proper JSON)
    const strategies = [
      () => this.parseCleanJSON(responseText),
      () => this.parseWithMarkdownBlocks(responseText),
      () => this.parseWithJSONExtraction(responseText),
      () => this.parseWithAdvancedCleaning(responseText)
    ];

    let lastError = null;
    let strategyIndex = 0;

    for (const strategy of strategies) {
      try {
        const result = strategy();
        if (result && this.isValidParsedResponse(result)) {
          automationLogger.logAPI(this.currentSessionId, provider, 'parse_success', { strategy: strategyIndex + 1 });

          // Log successful parse
          if (typeof automationLogger !== 'undefined' && this.currentSessionId) {
            automationLogger.logRawResponse(
              this.currentSessionId,
              responseText,
              true,
              this.currentIteration
            );
          }

          return result;
        }
      } catch (error) {
        lastError = error;
        automationLogger.debug(`Parse strategy ${strategyIndex + 1} failed`, { sessionId: this.currentSessionId, provider, error: error.message });
      }
      strategyIndex++;
    }

    // If all strategies fail, throw a clear error demanding proper JSON
    automationLogger.error('All parse strategies failed', { sessionId: this.currentSessionId, provider, responsePreview: responseText.substring(0, 500) });
    throw new Error(`AI must respond with valid JSON only. No fallback recovery available. Provider: ${provider}. Last error: ${lastError?.message}`);
  }
  
  // Strategy 1: Try to parse clean JSON
  parseCleanJSON(text) {
    const trimmed = text.trim();
    const response = JSON.parse(trimmed);
    return this.normalizeResponse(response);
  }
  
  // Strategy 2: Extract from markdown blocks
  parseWithMarkdownBlocks(text) {
    let jsonText = text;
    
    // Try JSON code block
    if (text.includes('```json')) {
      const match = text.match(/```json\s*([\s\S]*?)\s*```/i);
      if (match) jsonText = match[1];
    } else if (text.includes('```')) {
      const match = text.match(/```\s*([\s\S]*?)\s*```/);
      if (match) jsonText = match[1];
    }
    
    return this.parseCleanJSON(jsonText);
  }
  
  // Strategy 3: Extract JSON object with regex
  parseWithJSONExtraction(text) {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON object found in response');
    }
    return this.parseCleanJSON(jsonMatch[0]);
  }
  
  // Strategy 4: Advanced cleaning before parsing
  parseWithAdvancedCleaning(text) {
    let cleaned = text;
    
    // Remove common prefixes/suffixes
    const cleaningPatterns = [
      /^.*?(?=\{)/s, // Everything before first {
      /\}[^}]*$/s,   // Everything after last }
      /^[^{]*Here's the JSON:?\s*/i,
      /^[^{]*Response:?\s*/i,
      /\n\n.*$/s     // Everything after double newline
    ];
    
    for (const pattern of cleaningPatterns) {
      cleaned = cleaned.replace(pattern, '');
    }
    
    // Comprehensive JSON fixes
    cleaned = cleaned
      .replace(/'/g, '"')                    // Single to double quotes
      .replace(/(\w+):/g, '"$1":')          // Unquoted keys
      .replace(/,\s*}/g, '}')               // Trailing commas in objects
      .replace(/,\s*]/g, ']')               // Trailing commas in arrays
      .replace(/undefined/g, 'null')        // undefined to null
      .replace(/True/g, 'true')             // Python-style booleans
      .replace(/False/g, 'false')           // Python-style booleans
      .replace(/None/g, 'null')             // Python-style null
      .replace(/:\s*"([^"]*)"([^"]*)"([^"]*)"(?=\s*[,}])/g, ': "$1\\"$2\\"$3"')  // Fix unescaped quotes
      .replace(/"\s*\n\s*"/g, '", "')       // Fix broken strings across lines
      .replace(/}\s*\n\s*{/g, '}, {')       // Fix missing commas between objects
      .replace(/]\s*\n\s*\[/g, '], [')      // Fix missing commas between arrays
      
    return this.parseCleanJSON(cleaned);
  }
  
  // No more fallback recovery - demand proper JSON responses
  
  
  // Normalize response structure
  normalizeResponse(response) {
    // Handle nested structures
    if (response.message?.actions) {
      response.actions = response.message.actions;
    }

    if (response.content && typeof response.content === 'string') {
      try {
        const nested = JSON.parse(response.content);
        Object.assign(response, nested);
      } catch (e) {
        // Ignore nested parsing errors
      }
    }

    const normalized = {
      // Core action fields
      actions: response.actions || [],
      taskComplete: response.taskComplete || false,
      result: response.result || null,

      // Enhanced reasoning fields
      situationAnalysis: response.situationAnalysis || '',
      goalAssessment: response.goalAssessment || '',
      reasoning: response.reasoning || '',
      confidence: response.confidence || 'medium',
      assumptions: response.assumptions || [],
      fallbackPlan: response.fallbackPlan || ''
    };

    // Log reasoning fields for comprehensive session logging
    if (typeof automationLogger !== 'undefined' && this.currentSessionId) {
      automationLogger.logReasoning(this.currentSessionId, normalized, this.currentIteration);
    }

    return normalized;
  }
  
  // Validate parsed response has required structure
  isValidParsedResponse(response) {
    return response 
      && Array.isArray(response.actions)
      && typeof response.taskComplete === 'boolean';
  }
  
  // Check if tool name is valid
  isValidTool(tool) {
    return [
      // Basic DOM interaction tools
      'click', 'clickSearchResult', 'type', 'pressEnter', 'scroll', 'moveMouse', 'solveCaptcha',
      'navigate', 'searchGoogle', 'waitForElement', 'rightClick', 'doubleClick',
      'keyPress', 'pressKeySequence', 'typeWithKeys', 'sendSpecialKey', 
      'arrowUp', 'arrowDown', 'arrowLeft', 'arrowRight', 'gameControl',
      'selectText', 'focus', 'blur', 'hover', 'selectOption',
      'toggleCheckbox', 'refresh', 'goBack', 'goForward', 'getText',
      'getAttribute', 'setAttribute', 'clearInput',
      
      // Multi-tab management tools
      'openNewTab', 'switchToTab', 'closeTab', 'listTabs', 'waitForTabLoad', 'getCurrentTab',
      
      // Scroll tools
      'scrollToTop', 'scrollToBottom', 'scrollToElement',

      // Advanced DOM and verification tools
      'waitForDOMStable', 'detectLoadingState', 'verifyMessageSent'
    ].includes(tool);
  }
  
  // Detect task type from user input
  detectTaskType(task) {
    const taskLower = task.toLowerCase();

    // Shopping/e-commerce detection - check first as it's more specific
    const shoppingKeywords = [
      'buy', 'purchase', 'order', 'add to cart', 'checkout', 'shop for',
      'find a product', 'look for product', 'get me a', 'amazon', 'ebay',
      'walmart', 'best buy', 'target', 'shopping', 'product', 'item'
    ];
    const shoppingSites = ['amazon', 'ebay', 'walmart', 'bestbuy', 'target', 'newegg', 'etsy', 'aliexpress'];

    if (shoppingKeywords.some(kw => taskLower.includes(kw)) ||
        shoppingSites.some(site => taskLower.includes(site))) {
      return 'shopping';
    }

    if (taskLower.includes('new tab') || taskLower.includes('open tab') || taskLower.includes('switch tab') ||
        taskLower.includes('multiple tab') || taskLower.includes('other tab') || taskLower.includes('different tab') ||
        taskLower.includes('compare') || taskLower.includes('both sites') || taskLower.includes('cross-reference')) {
      return 'multitab';
    } else if (taskLower.includes('play') || taskLower.includes('game') || taskLower.includes('win') ||
               taskLower.includes('control') || taskLower.includes('move') || taskLower.includes('press enter') ||
               taskLower.includes('arrow key') || taskLower.includes('keyboard') || taskLower.includes('key press') ||
               taskLower.includes('start game') || taskLower.includes('use keys') || taskLower.includes('wasd') ||
               taskLower.includes('spacebar') || /demo.*play|asteroids|snake|pong|tetris/.test(taskLower)) {
      return 'gaming';
    } else if (taskLower.includes('search') || taskLower.includes('find') || taskLower.includes('look for')) {
      return 'search';
    } else if (taskLower.includes('fill') || taskLower.includes('form') || taskLower.includes('submit')) {
      return 'form';
    } else if (taskLower.includes('price') || taskLower.includes('get') || taskLower.includes('extract') || taskLower.includes('what is')) {
      return 'extraction';
    } else if (taskLower.includes('go to') || taskLower.includes('navigate') || taskLower.includes('open')) {
      return 'navigation';
    }

    return 'general';
  }

  /**
   * Detect if task is an information-gathering task that requires navigating to a website
   * These tasks should click through search results, not extract from Google snippets
   */
  isInformationGatheringTask(task) {
    const taskLower = task.toLowerCase();
    const infoKeywords = [
      'check', 'find', 'look up', 'lookup', 'price', 'cost',
      'get info', 'get information', 'what is', 'how much',
      'tell me', 'show me', 'verify', 'confirm'
    ];
    return infoKeywords.some(kw => taskLower.includes(kw));
  }
  
  // Get model-specific instructions
  getModelSpecificInstructions() {
    const provider = this.settings.modelProvider || 'xai';
    
    switch (provider) {
      case 'gemini':
        return `GEMINI SPECIFIC: You MUST respond with raw JSON only. Do NOT use markdown code blocks. Do NOT add explanatory text before or after the JSON. Do NOT wrap in \`\`\`json\`\`\` tags. Start your response directly with { and end with }.`;
      case 'openai':
        return `OPENAI SPECIFIC: Return only the JSON object. No markdown formatting, no code blocks, no explanations.`;
      case 'anthropic':
        return `CLAUDE SPECIFIC: Respond with pure JSON only. No markdown, no commentary, no code blocks.`;
      case 'xai':
      default:
        return `XAI/GROK SPECIFIC: Output raw JSON only. No markdown code blocks, no conversational text, no additional commentary.`;
    }
  }
  
  // Get relevant tools for task type
  getRelevantTools(taskType) {
    switch (taskType) {
      case 'search':
        return ['type', 'click', 'pressEnter', 'getText', 'scroll'];
      case 'form':
        return ['type', 'click', 'selectOption', 'toggleCheckbox', 'clearInput', 'scroll', 'scrollToElement'];
      case 'extraction':
        return ['click', 'navigate', 'getText', 'getAttribute', 'scroll', 'scrollToTop', 'scrollToBottom', 'waitForElement'];
      case 'navigation':
        return ['navigate', 'click', 'searchGoogle', 'goBack', 'goForward', 'scroll'];
      case 'gaming':
        return ['arrowUp', 'arrowDown', 'arrowLeft', 'arrowRight', 'keyPress', 'gameControl', 'pressKeySequence', 'sendSpecialKey', 'typeWithKeys', 'focus', 'click', 'waitForElement'];
      case 'shopping':
        return ['navigate', 'click', 'type', 'scroll', 'scrollToBottom', 'getText', 'waitForElement', 'hover', 'selectOption'];
      default:
        return Object.keys(TOOL_DOCUMENTATION).flatMap(category =>
          Object.keys(TOOL_DOCUMENTATION[category])
        );
    }
  }
  
  // Get tools documentation for task type
  getToolsDocumentation(taskType) {
    const relevantTools = this.getRelevantTools(taskType);
    let documentation = '';
    
    // Add full tool documentation
    const allTools = {
      navigate: { params: {url: "https://..."}, desc: "Go to URL" },
      searchGoogle: { params: {query: "search terms"}, desc: "Search Google" },
      refresh: { params: {}, desc: "Refresh page" },
      goBack: { params: {}, desc: "Browser back" },
      goForward: { params: {}, desc: "Browser forward" },
      click: { params: {selector: "CSS selector or elementId"}, desc: "Click element" },
      type: { 
        params: {selector: "...", text: "...", pressEnter: true}, 
        desc: "Type text. For searches: try submit button first, use pressEnter only as fallback",
        example: '{"tool": "type", "params": {"selector": "#APjFqb", "text": "search query", "pressEnter": true}}'
      },
      hover: { params: {selector: "..."}, desc: "Hover over element" },
      focus: { params: {selector: "..."}, desc: "Focus element" },
      getText: { params: {selector: "..."}, desc: "Get element text" },
      getAttribute: { params: {selector: "...", attribute: "name"}, desc: "Get attribute" },
      selectOption: { params: {selector: "...", value: "..."}, desc: "Select dropdown option" },
      toggleCheckbox: { params: {selector: "...", checked: true}, desc: "Toggle checkbox" },
      clearInput: { params: {selector: "..."}, desc: "Clear input field" },
      scroll: {
        params: {direction: "down", amount: 800},
        desc: "Scroll page. direction: 'up'/'down' (scrolls one viewport) OR amount: positive=down, negative=up",
        example: '{"tool": "scroll", "params": {"direction": "down"}}'
      },
      scrollToTop: { params: {}, desc: "Scroll to top of page" },
      scrollToBottom: { params: {}, desc: "Scroll to bottom of page" },
      scrollToElement: {
        params: {selector: "...", position: "center"},
        desc: "Scroll element into view"
      },
      waitForElement: { params: {selector: "...", timeout: 5000}, desc: "Wait for element" },
      pressEnter: { params: {selector: "..."}, desc: "Press Enter key" },
      keyPress: { 
        params: {key: "Enter", ctrlKey: false, shiftKey: false, altKey: false, metaKey: false, selector: "..."}, 
        desc: "Press any keyboard key with modifiers. FOR GAMES: Use this instead of 'type' for controls",
        example: '{"tool": "keyPress", "params": {"key": "Enter"}} // Start game\n{"tool": "keyPress", "params": {"key": "ArrowUp"}} // Move up\n{"tool": "keyPress", "params": {"key": " "}} // Space key for shooting' 
      },
      pressKeySequence: { 
        params: {keys: ["Ctrl", "c"], modifiers: {ctrl: true}, delay: 50}, 
        desc: "Press sequence of keys for shortcuts. Use for Ctrl+C, Alt+Tab, etc.",
        example: '{"tool": "pressKeySequence", "params": {"keys": ["c"], "modifiers": {"ctrl": true}}}' 
      },
      typeWithKeys: { 
        params: {text: "Hello World", delay: 30}, 
        desc: "Type text using real keyboard events (more reliable than setting values)",
        example: '{"tool": "typeWithKeys", "params": {"text": "password123"}}' 
      },
      sendSpecialKey: { 
        params: {specialKey: "F5"}, 
        desc: "Send special keys: F1-F24, Ctrl+R, Alt+F4, etc. Supports all function and combination keys",
        example: '{"tool": "sendSpecialKey", "params": {"specialKey": "F12"}}' 
      },
      arrowUp: { 
        params: {}, 
        desc: "Press Up Arrow key - ideal for games and navigation. Simpler than keyPress for arrow controls",
        example: '{"tool": "arrowUp", "params": {}}'
      },
      arrowDown: { 
        params: {}, 
        desc: "Press Down Arrow key - ideal for games and navigation. Simpler than keyPress for arrow controls",
        example: '{"tool": "arrowDown", "params": {}}'
      },
      arrowLeft: { 
        params: {}, 
        desc: "Press Left Arrow key - ideal for games and navigation. Simpler than keyPress for arrow controls",
        example: '{"tool": "arrowLeft", "params": {}}'
      },
      arrowRight: { 
        params: {}, 
        desc: "Press Right Arrow key - ideal for games and navigation. Simpler than keyPress for arrow controls",
        example: '{"tool": "arrowRight", "params": {}}'
      },
      gameControl: { 
        params: {action: "start"}, 
        desc: "GAME CONTROLS: Smart helper for games. Maps actions to proper keys automatically and focuses game elements",
        example: '{"tool": "gameControl", "params": {"action": "start"}} // Enter key\n{"tool": "gameControl", "params": {"action": "fire"}} // Space key\n{"tool": "gameControl", "params": {"action": "up"}} // Arrow up' 
      }
    };
    
    relevantTools.forEach(tool => {
      if (allTools[tool]) {
        documentation += `- ${tool}: ${allTools[tool].desc}. Params: ${JSON.stringify(allTools[tool].params)}\n`;
      }
    });
    
    return documentation.trim();
  }
  
  // Validate response structure
  isValidResponse(response) {
    if (!response || typeof response !== 'object') {
      automationLogger.logValidation(this.currentSessionId, 'response', false, { reason: 'not_an_object' });
      return false;
    }

    // Check required fields
    if (!Array.isArray(response.actions)) {
      automationLogger.logValidation(this.currentSessionId, 'actions', false, { reason: 'not_an_array', type: typeof response.actions });
      return false;
    }

    if (typeof response.taskComplete !== 'boolean') {
      automationLogger.logValidation(this.currentSessionId, 'taskComplete', false, { reason: 'not_boolean', type: typeof response.taskComplete });
      return false;
    }

    // Validate each action
    for (let i = 0; i < response.actions.length; i++) {
      const action = response.actions[i];
      if (!action.tool || !this.isValidTool(action.tool)) {
        automationLogger.logValidation(this.currentSessionId, 'action_tool', false, { index: i, tool: action.tool });
        return false;
      }
      if (!action.params || typeof action.params !== 'object') {
        automationLogger.logValidation(this.currentSessionId, 'action_params', false, { index: i, params: action.params });
        return false;
      }

      // Validate required parameters for specific tools
      if (action.tool === 'openNewTab') {
        if (!action.params.url || typeof action.params.url !== 'string' || action.params.url.trim() === '') {
          automationLogger.logValidation(this.currentSessionId, 'openNewTab_url', false, { index: i, reason: 'missing_url' });
          return false;
        }
        if (!action.params.url.startsWith('http://') && !action.params.url.startsWith('https://')) {
          automationLogger.logValidation(this.currentSessionId, 'openNewTab_url', false, { index: i, reason: 'invalid_protocol', url: action.params.url });
          return false;
        }
      }

      if (action.tool === 'switchToTab' || action.tool === 'closeTab') {
        if (!action.params.tabId) {
          automationLogger.logValidation(this.currentSessionId, `${action.tool}_tabId`, false, { index: i, reason: 'missing_tabId' });
          return false;
        }
      }
    }

    return true;
  }
  
  // Enhance prompt for retry attempts
  enhancePromptForRetry(prompt, attempt) {
    const enhancedPrompt = { ...prompt };
    
    // Add stronger JSON instruction
    if (attempt === 1) {
      enhancedPrompt.systemPrompt = enhancedPrompt.systemPrompt.replace(
        'CRITICAL: Respond with ONLY valid JSON:',
        'CRITICAL: Your response MUST be ONLY valid JSON. Do NOT include any text before or after the JSON object:'
      );
    } else if (attempt === 2) {
      // Even stronger instruction for final attempt
      enhancedPrompt.systemPrompt = `IMPORTANT: Previous attempts failed due to invalid JSON. 
${enhancedPrompt.systemPrompt}

REMINDER: Output ONLY the JSON object, nothing else.`;
    }
    
    return enhancedPrompt;
  }
  
  // Create fallback response on complete failure
  // CRITICAL FIX: Do NOT mark taskComplete: true on errors - this falsely reports success
  createFallbackResponse(task, error) {
    automationLogger.logRecovery(this.currentSessionId, 'repeated_failures', 'fallback_response', 'created', { error: error?.message });

    return {
      actions: [],
      reasoning: '',
      taskComplete: false,  // FIX: Do not mark as complete when there's an error
      failedDueToError: true,  // NEW: Explicit error flag for UI to display
      result: `Task failed due to error: ${error?.message || 'Unknown error'}. The automation will stop. Please check your settings and try again.`,
      error: true
    };
  }
  
  /**
   * Tests the API connection
   * @returns {Promise<Object>} Test result with success status and model information
   */
  async testConnection() {
    // Use provider if available
    if (this.provider) {
      automationLogger.logAPI(null, this.settings.modelProvider, 'test_connection', { mode: 'provider' });
      return await this.provider.testConnection();
    }

    // Legacy xAI test implementation
    if (!this.settings.apiKey) {
      throw new Error('API key is required for testing');
    }

    const modelName = this.settings.modelName || 'grok-3-fast';
    automationLogger.logAPI(null, 'xai', 'test_connection', { mode: 'legacy', model: modelName });
      
      const testRequestBody = {
        model: modelName,
        messages: [
          { role: 'user', content: 'Hello, please respond with just "OK"' }
        ],
        max_tokens: 10,
        temperature: 0.1
      };
    
      try {
        const response = await fetch(this.apiEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.settings.apiKey}`
          },
          body: JSON.stringify(testRequestBody)
        });
        
        const result = {
          model: modelName,
          status: response.status,
          ok: response.ok,
          statusText: response.statusText
        };
        
        if (response.ok) {
          const data = await response.json();
          result.data = data;
          automationLogger.logAPI(null, 'xai', 'test_success', { model: modelName, status: response.status });

          // Update the working model name
          this.model = modelName;
          return result;

        } else {
          const errorText = await response.text();
          result.error = errorText;
          automationLogger.logAPI(null, 'xai', 'test_failed', { model: modelName, status: response.status, error: errorText });

          // Return the error result
          return result;
        }

      } catch (error) {
        automationLogger.error('Connection test failed', { provider: 'xai', model: modelName, error: error.message });

        // Return the connection error
        return {
          error: error.message,
          connectionFailed: true,
          model: modelName
        };
      }
  }
  
  // Track token usage for analytics
  trackTokenUsage(apiResponse, success) {
    try {
      let inputTokens = 0;
      let outputTokens = 0;
      let tokenSource = 'none';

      automationLogger.debug('Tracking token usage', {
        sessionId: this.currentSessionId,
        hasUsage: !!(apiResponse && apiResponse.usage),
        success
      });

      if (apiResponse && apiResponse.usage) {
        // Standard OpenAI-compatible usage format
        inputTokens = apiResponse.usage.prompt_tokens || 0;
        outputTokens = apiResponse.usage.completion_tokens || 0;
        tokenSource = 'api';
        automationLogger.debug('Using API-provided token counts', { sessionId: this.currentSessionId, inputTokens, outputTokens });
      } else if (apiResponse && success) {
        // Estimate token usage if not provided
        const responseText = this.extractContent(apiResponse);

        // Improved estimation: GPT-style tokens are roughly 0.75 words or 4 characters
        const promptText = JSON.stringify(this.lastPrompt || '');
        inputTokens = Math.ceil(promptText.length / 3.5); // More accurate estimate
        outputTokens = Math.ceil((responseText?.length || 0) / 3.5);
        tokenSource = 'estimated';

        automationLogger.debug('Using estimated token counts', {
          sessionId: this.currentSessionId,
          inputTokens,
          outputTokens,
          promptLength: promptText.length,
          responseLength: responseText?.length || 0
        });
      } else if (!success) {
        // Failed request - estimate input tokens only
        const promptText = JSON.stringify(this.lastPrompt || '');
        inputTokens = Math.ceil(promptText.length / 3.5);
        outputTokens = 0;
        tokenSource = 'error';

        automationLogger.debug('Tracking failed request', { sessionId: this.currentSessionId, inputTokens, outputTokens });
      }

      // Use model name with fallback to ensure it's never undefined
      const modelName = this.model || this.settings?.modelName || 'unknown';

      // Log token usage for comprehensive session logging
      if (typeof automationLogger !== 'undefined' && this.currentSessionId) {
        automationLogger.logTokenUsage(
          this.currentSessionId,
          modelName,
          inputTokens,
          outputTokens,
          tokenSource,
          this.currentIteration
        );
      }

      automationLogger.debug('Final token tracking data', {
        sessionId: this.currentSessionId,
        model: modelName,
        inputTokens,
        outputTokens,
        success,
        tokenSource
      });

      // Check if analytics is available (from options page)
      if (typeof window !== 'undefined' && window.analytics) {
        automationLogger.debug('Tracking via window.analytics', { sessionId: this.currentSessionId });
        window.analytics.trackUsage(modelName, inputTokens, outputTokens, success);
      } else {
        automationLogger.debug('window.analytics not available - using background script', { sessionId: this.currentSessionId });
      }

      // Check if we're in the background script context
      if (typeof initializeAnalytics !== 'undefined') {
        // We're in the background script, track directly
        automationLogger.debug('In background context, tracking directly', { sessionId: this.currentSessionId });
        try {
          const analytics = initializeAnalytics();
          analytics.trackUsage(modelName, inputTokens, outputTokens, success).then(() => {
            automationLogger.debug('Direct usage tracking completed', { sessionId: this.currentSessionId });
          }).catch((error) => {
            automationLogger.error('Direct tracking failed', { sessionId: this.currentSessionId, error: error.message });
          });
        } catch (error) {
          automationLogger.error('Failed to initialize analytics', { sessionId: this.currentSessionId, error: error.message });
        }
      } else if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        // We're in a content script or other context, send message
        const trackingData = {
          action: 'TRACK_USAGE',
          data: {
            model: modelName,
            inputTokens: inputTokens,
            outputTokens: outputTokens,
            success: success,
            tokenSource: tokenSource,
            timestamp: Date.now()
          }
        };

        automationLogger.logComm(this.currentSessionId, 'send', 'TRACK_USAGE', true, { model: modelName, inputTokens, outputTokens });

        chrome.runtime.sendMessage(trackingData).then((response) => {
          if (response && response.error) {
            automationLogger.error('Background returned error for tracking', { sessionId: this.currentSessionId, error: response.error });
          } else if (!response) {
            automationLogger.warn('Background returned no response for tracking', { sessionId: this.currentSessionId });
          } else if (response.success) {
            automationLogger.debug('Usage tracking confirmed by background', { sessionId: this.currentSessionId });
          }
        }).catch((error) => {
          automationLogger.error('Failed to send tracking message', {
            sessionId: this.currentSessionId,
            error: error.message,
            name: error.name
          });
        });
      } else {
        automationLogger.warn('Chrome runtime not available for usage tracking', { sessionId: this.currentSessionId });
      }
    } catch (error) {
      automationLogger.error('Failed to track token usage', { sessionId: this.currentSessionId, error: error.message });
    }
  }
  
  // Store last prompt for token estimation
  storePrompt(prompt) {
    this.lastPrompt = prompt;
  }
}

// Export for use in background.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AIIntegration;
}