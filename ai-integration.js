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
  search: "CRITICAL: For search tasks you MUST: 1) Type query, then look for submit button (button[type='submit'], buttons with 'Search'/'Submit'/'Go'/'Find' text, or search/submit classes). If found, click button. If no button, use pressEnter: true, 2) Wait for results to load, 3) Extract the actual answer from the page, 4) ONLY mark taskComplete: true after you have the answer. When completing, provide the specific information found, not just 'found the answer'. Example result: 'I found the current weather in New York is 72°F with clear skies and 15% humidity.'",
  form: "Fill all required fields, then submit. When completing, describe exactly what information was submitted and confirm the form was processed successfully. Example result: 'I successfully filled out the contact form with your name, email, and message, then submitted it. The page confirmed your message was received and you should expect a response within 24 hours.'",
  extraction: "Extract the requested information and provide the exact values found. When completing, include all the specific data extracted, not generic statements. Example result: 'I extracted the following product details: Price $299.99, Rating 4.8/5 stars, Stock: 15 units available, Shipping: Free 2-day delivery.'",
  navigation: "Navigate to the specified page or section. When completing, confirm what page you reached and describe what's available there. Example result: 'I successfully navigated to the Settings page where I can see options for Account Settings, Privacy Controls, Notification Preferences, and Security Settings.'",
  multitab: "TAB CONTROL LIMITATIONS: CRITICAL - You can ONLY control the original tab where automation started. 1) openNewTab creates new tabs but automation stays on original tab, 2) switchToTab is BLOCKED for security - cannot switch to other tabs, 3) listTabs shows tab titles for context only (no URLs), 4) All DOM actions happen only on the session tab. You can see other tab names for reference but cannot control them. Example result: 'I can see there are tabs for Gmail, YouTube, and Facebook open, but I am working only in the original tab where the automation started.'",
  general: "Complete the task using appropriate tools. When completing, provide a detailed summary of all actions taken and their outcomes. Be specific about what was accomplished."
};

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
    
    // Create appropriate provider instance
    this.provider = this.createProvider();
    
    // Request queue and cache
    this.requestQueue = [];
    this.isProcessing = false;
    this.responseCache = new Map();
    this.cacheMaxSize = 50;
    this.cacheMaxAge = 5 * 60 * 1000; // 5 minutes
  }
  
  // Migrate legacy settings to new format
  migrateSettings(settings) {
    const migrated = { ...settings };
    
    // Handle legacy speedMode
    if (!migrated.modelName && migrated.speedMode) {
      migrated.modelProvider = 'xai';
      migrated.modelName = migrated.speedMode === 'fast' ? 'grok-3-mini-fast' : 'grok-3-mini';
    }
    
    // Set defaults
    migrated.modelProvider = migrated.modelProvider || 'xai';
    migrated.modelName = migrated.modelName || 'grok-3-mini';
    
    return migrated;
  }
  
  // Create provider instance based on settings
  createProvider() {
    console.log('Creating AI provider for:', this.settings.modelProvider);
    console.log('Model name:', this.settings.modelName);
    
    try {
      // Check if provider classes are available
      if (typeof XAIProvider !== 'undefined' && typeof GeminiProvider !== 'undefined') {
        switch (this.settings.modelProvider) {
          case 'gemini':
            console.log('Creating GeminiProvider instance');
            return new GeminiProvider(this.settings);
          case 'xai':
          default:
            console.log('Creating XAIProvider instance');
            return new XAIProvider(this.settings);
        }
      } else if (typeof createAIProvider !== 'undefined') {
        // Fallback to factory function
        console.log('Using createAIProvider factory');
        return createAIProvider(this.settings);
      }
    } catch (error) {
      console.error('Failed to create provider:', error);
    }
    
    // Fallback for environments where ai-providers.js isn't loaded
    console.warn('AI providers not loaded, using legacy xAI implementation');
    return null;
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
      console.log('Using cached AI response for:', key, `(expires in ${Math.round((maxAge - (Date.now() - cached.timestamp)) / 1000)}s)`);
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
   * @param {string} task - The task description in natural language
   * @param {Object} domState - The structured DOM state from content script
   * @param {Object|null} context - Optional context including action history and stuck detection
   * @returns {Promise<Object>} AI response with actions, reasoning, and completion status
   */
  async getAutomationActions(task, domState, context = null) {
    // Generate context-aware cache key
    const cacheKey = this.generateCacheKey(task, domState, context);
    
    // Check cache first (but not if we're stuck or in later iterations)
    if (!context?.isStuck && (!context?.iterationCount || context.iterationCount < 3)) {
      const cachedResponse = this.getCachedResponse(cacheKey);
      if (cachedResponse) {
        console.log('Using cached response for key:', cacheKey);
        return cachedResponse;
      }
    }
    
    // Retry configuration
    const maxRetries = 3;
    const baseDelay = 1000; // 1 second
    let lastError = null;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // Build prompt with retry enhancements
        let prompt = this.buildPrompt(task, domState, context);
        
        // Enhance prompt on retry
        if (attempt > 0) {
          prompt = this.enhancePromptForRetry(prompt, attempt);
        }
        
        // Queue the request for processing
        const response = await new Promise((resolve, reject) => {
          this.requestQueue.push({
            prompt,
            cacheKey,
            resolve,
            reject,
            attempt
          });
          
          // Process queue if not already processing
          if (!this.isProcessing) {
            this.processQueue();
          }
        });
        
        // Validate response quality
        if (this.isValidResponse(response)) {
          // Cache successful response
          this.setCachedResponse(cacheKey, response);
          return response;
        } else {
          throw new Error('Invalid response structure: missing required fields');
        }
        
      } catch (error) {
        lastError = error;
        console.error(`AI request attempt ${attempt + 1}/${maxRetries} failed:`, error.message);
        
        // If it's the last attempt, return fallback
        if (attempt === maxRetries - 1) {
          return this.createFallbackResponse(task, lastError);
        }
        
        // Otherwise, wait with exponential backoff
        const delay = baseDelay * Math.pow(2, attempt);
        console.log(`Retrying in ${delay}ms...`);
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
      
      // Adaptive delay calculation
      if (this.requestQueue.length > 0) {
        const baseDelay = 100;
        const queuePressure = Math.min(this.requestQueue.length / 10, 1); // 0-1 scale
        const errorPressure = Math.min(recentErrors / 3, 1); // 0-1 scale
        const performancePressure = avgResponseTime > 5000 ? 0.5 : 0; // Add delay if slow
        
        // Calculate adaptive delay (100ms - 2000ms)
        const adaptiveDelay = Math.min(
          baseDelay * (1 + queuePressure * 2 + errorPressure * 5 + performancePressure * 3),
          2000
        );
        
        console.log(`Adaptive queue delay: ${Math.round(adaptiveDelay)}ms (queue: ${this.requestQueue.length}, errors: ${recentErrors})`);
        await new Promise(resolve => setTimeout(resolve, adaptiveDelay));
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
  buildPrompt(task, domState, context = null) {
    // Determine task type for specialized prompting
    const taskType = this.detectTaskType(task);
    
    // Core system prompt - concise and focused
    const systemPrompt = `You are a browser automation agent. Analyze the DOM and complete the given task.

CRITICAL REQUIREMENT: Respond with ONLY valid JSON. No markdown, no explanations, no code blocks.

SEARCH SUBMISSION RULE: For search forms, follow this priority order:
1. FIRST: Look for submit buttons - button[type="submit"], buttons with text "Search"/"Submit"/"Go"/"Find", or classes containing "search"/"submit"/"btn"
2. If submit button found: Click it after typing
3. ONLY if no submit button: Use pressEnter: true

Example with button: 
{"tool": "type", "params": {"selector": "#search", "text": "query"}}
{"tool": "click", "params": {"selector": "button[type='submit']"}}

Example fallback: 
{"tool": "type", "params": {"selector": "#search", "text": "query", "pressEnter": true}}

TASK COMPLETION RULES: NEVER mark taskComplete: true until you have ACTUALLY completed the task:

For search tasks:
- taskComplete: false after typing the query
- taskComplete: false while waiting for results  
- taskComplete: true ONLY after extracting the answer

For messaging tasks:
- taskComplete: false after clicking message button
- taskComplete: false if type actions FAILED
- taskComplete: true ONLY after message is successfully typed AND sent
- CRITICAL: If any type action failed, you MUST retry before completing

For form tasks:
- taskComplete: false after filling individual fields
- taskComplete: true ONLY after successful form submission

COMPLETION SUMMARY REQUIREMENT: When marking taskComplete: true, you MUST provide a detailed result that includes:
1. What specific actions were completed successfully
2. What information was found/extracted (exact values, not just "found it")
3. What the final outcome was
4. Confirmation that critical actions (like typing) succeeded
5. Any relevant details discovered during the process

Example good result: "I successfully navigated to the LinkedIn profile, clicked the message button, typed 'Hello' into the message field, and sent the message. The message was delivered successfully."

Example bad result: "Task completed" or "Sent the message" or "Message sent" (without confirming typing succeeded)

Your response must be EXACTLY this format:
{
  "reasoning": "brief analysis",
  "actions": [{"tool": "name", "params": {}, "description": "what I'm doing"}],
  "taskComplete": boolean,
  "result": "detailed summary of what was accomplished and found",
  "currentStep": "current status"
}

FAILURE TO PROVIDE VALID JSON OR DETAILED RESULT WILL RESULT IN TASK FAILURE.

${this.getModelSpecificInstructions()}

Task Type: ${taskType}

AVAILABLE TOOLS:
${this.getToolsDocumentation(taskType)}

${TASK_PROMPTS[taskType]}`;
    
    // Validate domState structure
    if (!domState || typeof domState !== 'object') {
      throw new Error('Invalid DOM state provided to AI integration');
    }
    
    // Build user prompt with context
    let userPrompt = `Task: ${task}

Current page state:
URL: ${domState.url || 'Unknown'}
Title: ${domState.title || 'Unknown'}
Scroll position: Y=${domState.scrollPosition?.y || 0}
CAPTCHA present: ${domState.captchaPresent || false}`;
    
    // Add context information if available
    if (context) {
      userPrompt += `\n\nAUTOMATION CONTEXT:`;
      
      // Add stuck warning
      if (context.isStuck) {
        userPrompt += `\nIMPORTANT: The automation appears STUCK! The DOM has not changed for ${context.stuckCounter} iterations.`;
        userPrompt += `\nYou MUST try a DIFFERENT approach than before. Do NOT repeat the same actions.`;
      }
      
      // Add DOM and URL change status
      userPrompt += `\nDOM changed since last action: ${context.domChanged ? 'Yes' : 'No'}`;
      userPrompt += `\nURL changed since last action: ${context.urlChanged ? 'Yes' : 'No'}`;
      userPrompt += `\nCurrent URL: ${context.currentUrl}`;
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
      if (context.actionHistory && context.actionHistory.length > 0) {
        userPrompt += `\n\nRECENT ACTION HISTORY (last ${context.actionHistory.length} actions):`;
        
        // Track critical failures for messaging tasks
        const criticalFailures = [];
        const isMessagingTask = context.task && (
          context.task.toLowerCase().includes('message') || 
          context.task.toLowerCase().includes('send') ||
          context.task.toLowerCase().includes('text')
        );
        
        context.actionHistory.forEach((action, idx) => {
          const status = action.result?.success ? 'SUCCESS' : 'FAILED';
          userPrompt += `\n${idx + 1}. ${action.tool}(${JSON.stringify(action.params)}) - ${status}`;
          
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
          userPrompt += `\n\n⚠️ WARNING: Multiple critical actions (${criticalFailures.length}) have failed recently.`;
          userPrompt += `\nEnsure essential actions succeed before marking taskComplete=true.`;
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
      if (context.forceAlternativeStrategy && context.failedActionDetails && context.failedActionDetails.length > 0) {
        userPrompt += `\n\n🚨 CRITICAL: REPEATED ACTION FAILURES DETECTED! 🚨`;
        userPrompt += `\nThe following actions have failed multiple times and MUST use alternative strategies:\n`;
        
        context.failedActionDetails.forEach(failure => {
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
      
      // Strong instruction when stuck
      if (context.isStuck) {
        userPrompt += `\n\nCRITICAL: Since previous approaches failed, you MUST:
1. Try a completely different strategy
2. Use alternative selectors or methods
3. Consider if the page needs navigation or different interaction
4. Check if elements might be in iframes or hidden
5. Try waiting for elements if they might be loading
6. Consider if the task might already be complete

UNIVERSAL STUCK RECOVERY (When verification is failing):
If you've successfully completed the main action sequence but verification is stuck:
1. ANALYZE SEQUENCE: Review if the intended actions (type, click, submit, etc.) completed successfully
2. TRY ALTERNATIVES: Use different verification approaches - content detection, state changes, success indicators
3. BROADEN SEARCH: Look in different page areas, use more general selectors, check for partial matches
4. CHECK TIMING: Consider if results need time to appear, try waiting or refreshing  
5. ASSUME SUCCESS: After 3+ verification attempts, if action sequence succeeded without errors, complete task
6. PROVIDE DETAILED EVIDENCE: Set taskComplete=true with a comprehensive summary explaining:
   - What actions were completed successfully
   - What evidence supports the task completion
   - What the final state/outcome is
   - Any information that was found or extracted
   
   Example: "I successfully submitted the contact form by filling in the name field with 'John Doe', email with 'john@example.com', and message with 'Hello'. After clicking submit, the form disappeared and I can see the page title changed to include 'Thank You', indicating successful submission."

INFORMATION EXTRACTION STUCK RECOVERY:
If you're stuck while trying to extract information (prices, data, text):
1. CHECK getText RESULTS: Review if any getText actions returned values - even if not the exact selector expected
2. USE EXTRACTED DATA: If you've extracted ANY relevant text, complete the task with that data
3. TRY BROADER SELECTORS: Use parent elements or more general selectors to capture larger text blocks
4. COMPLETE WITH PARTIAL DATA: If you found some information, complete with what you have rather than getting stuck
5. FORMAT PROPERLY: Include any extracted values in the result field, even if partial

CRITICAL FOR INFORMATION EXTRACTION:
When using getText and receiving a response like "0.3996 USD", you MUST:
1. Recognize this as the extracted value you were looking for
2. Format it into a complete, detailed summary (e.g., "I successfully found the current Dogecoin price is $0.3996 USD on this cryptocurrency exchange page")
3. Mark the task as complete with this detailed summary in the result field
4. Include context about where/how the information was found
5. DO NOT keep trying the same selector if you already got a value

ALWAYS provide complete sentences and context, not just raw extracted values.`;
      }
      
      // Add execution timing context
      userPrompt += `\n\nEXECUTION OPTIMIZATION:
- The system now uses smart delays between actions
- Typing actions (type, clearInput, focus) have shorter delays (200-500ms)
- Click and navigation actions have longer delays (800-2000ms) 
- You can safely include 3-5 related actions in a single response
- Form filling and typing sequences are optimized for speed
- Group related actions together for better performance`;
    }
    
    userPrompt += `\n\nSTRUCTURED ELEMENTS (with positions and metadata):
${this.formatElements(domState.elements || [])}

HTML CONTEXT (actual markup for better understanding):
${this.formatHTMLContext(domState.htmlContext)}

What actions should I take to complete the task?`;
    
    const finalPrompt = { systemPrompt, userPrompt };
    
    // Store prompt for token estimation
    this.storePrompt(finalPrompt);
    
    return finalPrompt;
  }
  
  // Format elements for AI context with enhanced information
  formatElements(elements) {
    if (!Array.isArray(elements)) {
      console.warn('formatElements received non-array:', elements);
      return 'No elements available';
    }
    
    return elements.map(el => {
      let desc = `[${el.elementId}] ${el.type}`;
      
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
      desc += ` at (${el.position.x}, ${el.position.y})`;
      
      // Add form association
      if (el.formId) desc += ` in ${el.formId}`;
      
      // Add primary selector
      if (el.selectors && el.selectors.length > 0) {
        desc += ` selector: "${el.selectors[0]}"`;
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
        formatted += `${i + 1}. ${element.tag.toUpperCase()} at (${element.position.x}, ${element.position.y})\n`;
        formatted += `   Selector: ${element.selector}\n`;
        if (element.text) {
          formatted += `   Text: "${element.text}"\n`;
        }
        formatted += `   HTML: ${element.html}\n\n`;
      });
    }
    
    return formatted;
  }
  
  // Call AI API using the appropriate provider
  async callAPI(prompt) {
    // Use provider if available, otherwise fallback to legacy implementation
    if (this.provider) {
      try {
        console.log(`Making API call using ${this.settings.modelProvider} provider`);
        console.log(`Model: ${this.settings.modelName}`);
        
        // Set current provider for parsing context
        this.currentProvider = this.provider;
        
        const requestBody = await this.provider.buildRequest(prompt, {});
        const response = await this.provider.sendRequest(requestBody);
        const parsed = this.provider.parseResponse(response);
        
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
        console.error(`${this.settings.modelProvider} API call failed:`, error);
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
    const model = this.settings.modelName || 'grok-3-mini';
    
    console.log('Making xAI API call (legacy):', apiEndpoint);
    console.log('Using model:', model);
    
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
      console.error('xAI API call failed:', error);
      this.trackTokenUsage(null, false);
      throw error;
    }
  }
  
  // Extract content from xAI API response
  extractContent(data) {
    console.log('Extracting content from xAI response...');
    console.log('Full response data:', JSON.stringify(data, null, 2));
    
    // Log the response structure in detail
    console.log('Response structure analysis:');
    console.log('- Has choices:', !!data.choices);
    console.log('- Choices is array:', Array.isArray(data.choices));
    console.log('- Choices length:', data.choices?.length);
    
    if (data.choices && data.choices.length > 0) {
      console.log('- First choice exists:', !!data.choices[0]);
      console.log('- First choice keys:', Object.keys(data.choices[0] || {}));
      
      if (data.choices[0].message) {
        console.log('- Message exists:', !!data.choices[0].message);
        console.log('- Message keys:', Object.keys(data.choices[0].message || {}));
        console.log('- Message content exists:', !!data.choices[0].message.content);
      }
    }
    
    // Try multiple possible response formats for xAI Grok
    let messageContent = null;
    
    // Standard OpenAI format
    if (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) {
      messageContent = data.choices[0].message.content;
      console.log('Found content using OpenAI format');
    }
    // Alternative xAI format - sometimes content is at root level
    else if (data.content) {
      messageContent = data.content;
      console.log('Found content at root level');
    }
    // Another alternative - text field
    else if (data.choices && data.choices[0] && data.choices[0].text) {
      messageContent = data.choices[0].text;
      console.log('Found content in text field');
    }
    // Direct message format
    else if (data.message) {
      messageContent = data.message;
      console.log('Found content in direct message field');
    }
    
    if (messageContent) {
      console.log('Extracted message content:', messageContent);
      console.log('Message content type:', typeof messageContent);
      console.log('Message content length:', messageContent?.length);
      return messageContent;
    } else {
      console.error('Could not find message content in any expected location');
      console.error('Available keys in response:', Object.keys(data));
      throw new Error('Could not extract message content from xAI API response');
    }
  }
  
  // Parse Grok-3-mini response into actions
  parseResponse(responseText) {
    const provider = this.currentProvider?.provider || 'unknown';
    console.log(`Parsing AI response from ${provider}...`);
    console.log('Response preview (first 200 chars):', responseText?.substring(0, 200));
    
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
          console.log(`Successfully parsed ${provider} response using strategy ${strategyIndex + 1}`);
          return result;
        }
      } catch (error) {
        lastError = error;
        console.log(`Strategy ${strategyIndex + 1} failed for ${provider}:`, error.message);
      }
      strategyIndex++;
    }
    
    // If all strategies fail, throw a clear error demanding proper JSON
    console.error(`${provider} AI Response that failed to parse:`, responseText.substring(0, 500));
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
    
    return {
      actions: response.actions || [],
      reasoning: response.reasoning || '',
      taskComplete: response.taskComplete || false,
      result: response.result || null,
      currentStep: response.currentStep || null
    };
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
      'click', 'type', 'pressEnter', 'scroll', 'moveMouse', 'solveCaptcha', 
      'navigate', 'searchGoogle', 'waitForElement', 'rightClick', 'doubleClick',
      'keyPress', 'selectText', 'focus', 'blur', 'hover', 'selectOption',
      'toggleCheckbox', 'refresh', 'goBack', 'goForward', 'getText',
      'getAttribute', 'setAttribute', 'clearInput',
      
      // Multi-tab management tools
      'openNewTab', 'switchToTab', 'closeTab', 'listTabs', 'waitForTabLoad', 'getCurrentTab',
      
      // Advanced DOM and verification tools
      'waitForDOMStable', 'detectLoadingState', 'verifyMessageSent'
    ].includes(tool);
  }
  
  // Detect task type from user input
  detectTaskType(task) {
    const taskLower = task.toLowerCase();
    
    if (taskLower.includes('new tab') || taskLower.includes('open tab') || taskLower.includes('switch tab') || 
        taskLower.includes('multiple tab') || taskLower.includes('other tab') || taskLower.includes('different tab') ||
        taskLower.includes('compare') || taskLower.includes('both sites') || taskLower.includes('cross-reference')) {
      return 'multitab';
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
        return ['type', 'click', 'pressEnter', 'getText'];
      case 'form':
        return ['type', 'click', 'selectOption', 'toggleCheckbox', 'clearInput'];
      case 'extraction':
        return ['getText', 'getAttribute', 'scroll', 'waitForElement'];
      case 'navigation':
        return ['navigate', 'click', 'searchGoogle', 'goBack', 'goForward'];
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
      scroll: { params: {amount: 200}, desc: "Scroll page" },
      waitForElement: { params: {selector: "...", timeout: 5000}, desc: "Wait for element" },
      pressEnter: { params: {selector: "..."}, desc: "Press Enter key" }
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
      console.error('Validation failed: response is not an object', response);
      return false;
    }
    
    // Check required fields
    if (!Array.isArray(response.actions)) {
      console.error('Validation failed: actions is not an array', typeof response.actions, response.actions);
      return false;
    }
    
    if (typeof response.taskComplete !== 'boolean') {
      console.error('Validation failed: taskComplete is not a boolean', typeof response.taskComplete, response.taskComplete);
      return false;
    }
    
    // Validate each action
    for (let i = 0; i < response.actions.length; i++) {
      const action = response.actions[i];
      if (!action.tool || !this.isValidTool(action.tool)) {
        console.error(`Validation failed: action[${i}] has invalid tool`, action.tool);
        return false;
      }
      if (!action.params || typeof action.params !== 'object') {
        console.error(`Validation failed: action[${i}] has invalid params`, action.params);
        return false;
      }
      
      // Validate required parameters for specific tools
      if (action.tool === 'openNewTab') {
        if (!action.params.url || typeof action.params.url !== 'string' || action.params.url.trim() === '') {
          console.error(`Validation failed: action[${i}] openNewTab requires url parameter`, action.params);
          return false;
        }
        if (!action.params.url.startsWith('http://') && !action.params.url.startsWith('https://')) {
          console.error(`Validation failed: action[${i}] openNewTab url must be a valid HTTP/HTTPS URL`, action.params.url);
          return false;
        }
      }
      
      if (action.tool === 'switchToTab' || action.tool === 'closeTab') {
        if (!action.params.tabId) {
          console.error(`Validation failed: action[${i}] ${action.tool} requires tabId parameter`, action.params);
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
  createFallbackResponse(task, error) {
    console.log('Creating fallback response due to repeated failures');
    
    return {
      actions: [],
      reasoning: '',
      taskComplete: true,
      result: `I encountered an error while processing your request: ${error?.message || 'Unknown error'}. Please try again or check the browser console for details.`,
      currentStep: 'Error occurred',
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
      console.log(`Testing ${this.settings.modelProvider} API connection...`);
      return await this.provider.testConnection();
    }
    
    // Legacy xAI test implementation
    if (!this.settings.apiKey) {
      throw new Error('API key is required for testing');
    }
    
    console.log('Testing xAI API connection (legacy)...');
    
    // Test the configured model
    const modelName = this.settings.modelName || 'grok-3-mini';
    console.log(`Trying model: ${modelName}`);
      
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
          console.log(`✓ API test successful with model ${modelName}:`, result);
          
          // Update the working model name
          this.model = modelName;
          return result;
          
        } else {
          const errorText = await response.text();
          result.error = errorText;
          console.log(`✗ Model ${modelName} failed:`, result);
          
          // Return the error result
          return result;
        }
        
      } catch (error) {
        console.error(`Connection failed for model ${modelName}:`, error);
        
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
      
      console.log('Tracking token usage - API Response structure:', {
        hasUsage: !!(apiResponse && apiResponse.usage),
        usage: apiResponse?.usage,
        success: success,
        responseKeys: apiResponse ? Object.keys(apiResponse) : null
      });
      
      if (apiResponse && apiResponse.usage) {
        // Standard OpenAI-compatible usage format
        inputTokens = apiResponse.usage.prompt_tokens || 0;
        outputTokens = apiResponse.usage.completion_tokens || 0;
        tokenSource = 'api';
        console.log('Using API-provided token counts:', { inputTokens, outputTokens });
      } else if (apiResponse && success) {
        // Estimate token usage if not provided
        const responseText = this.extractContent(apiResponse);
        
        // Improved estimation: GPT-style tokens are roughly 0.75 words or 4 characters
        const promptText = JSON.stringify(this.lastPrompt || '');
        inputTokens = Math.ceil(promptText.length / 3.5); // More accurate estimate
        outputTokens = Math.ceil((responseText?.length || 0) / 3.5);
        tokenSource = 'estimated';
        
        console.log('Using estimated token counts:', {
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
        
        console.log('Tracking failed request:', { inputTokens, outputTokens });
      }
      
      console.log('Final token tracking data:', {
        model: this.model,
        inputTokens,
        outputTokens,
        success,
        tokenSource
      });
      
      // Check if analytics is available (from options page)
      if (typeof window !== 'undefined' && window.analytics) {
        console.log('Tracking via window.analytics');
        window.analytics.trackUsage(this.model, inputTokens, outputTokens, success);
      } else {
        console.log('window.analytics not available - using background script');
      }
      
      // Check if we're in the background script context
      if (typeof initializeAnalytics !== 'undefined') {
        // We're in the background script, track directly
        console.log('AI Integration: In background context, tracking directly');
        try {
          const analytics = initializeAnalytics();
          analytics.trackUsage(this.model, inputTokens, outputTokens, success).then(() => {
            console.log('AI Integration: Direct usage tracking completed');
          }).catch((error) => {
            console.error('AI Integration: Direct tracking failed:', error);
          });
        } catch (error) {
          console.error('AI Integration: Failed to initialize analytics:', error);
        }
      } else if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        // We're in a content script or other context, send message
        const trackingData = {
          action: 'TRACK_USAGE',
          data: {
            model: this.model,
            inputTokens: inputTokens,
            outputTokens: outputTokens,
            success: success,
            tokenSource: tokenSource,
            timestamp: Date.now()
          }
        };
        
        console.log('AI Integration: Sending tracking message to background:', trackingData);
        
        chrome.runtime.sendMessage(trackingData).then((response) => {
          console.log('AI Integration: Background response received:', response);
          if (response && response.error) {
            console.error('AI Integration: Background returned error:', response.error);
          } else if (!response) {
            console.warn('AI Integration: Background returned no response');
          } else if (response.success) {
            console.log('AI Integration: Usage tracking confirmed by background');
          }
        }).catch((error) => {
          console.error('AI Integration: Failed to send tracking message:', error);
          console.error('AI Integration: Error details:', {
            name: error.name,
            message: error.message,
            stack: error.stack
          });
        });
      } else {
        console.warn('AI Integration: Chrome runtime not available for usage tracking');
        console.warn('AI Integration: Available globals:', Object.keys(typeof window !== 'undefined' ? window : global || self));
      }
    } catch (error) {
      console.error('Failed to track token usage:', error);
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