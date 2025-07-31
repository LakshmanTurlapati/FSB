/**
 * AI Integration module for Browser Agent
 * This module handles communication with multiple AI providers (xAI, Gemini)
 */

// Import provider implementations
if (typeof importScripts !== 'undefined') {
  importScripts('ai-providers.js');
}

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
  
  // Generate cache key from task and DOM state
  generateCacheKey(task, domState) {
    // Create a simplified key based on task and current URL
    const key = `${task}-${domState.url}-${domState.title}`;
    return key;
  }
  
  // Check if cached response is still valid
  getCachedResponse(key) {
    const cached = this.responseCache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheMaxAge) {
      console.log('Using cached AI response for:', key);
      return cached.response;
    }
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
    // Check cache first (but not if we're stuck)
    const cacheKey = this.generateCacheKey(task, domState);
    if (!context?.isStuck) {
      const cachedResponse = this.getCachedResponse(cacheKey);
      if (cachedResponse) {
        return cachedResponse;
      }
    }
    
    // Build prompt and add to queue
    const prompt = this.buildPrompt(task, domState, context);
    
    return new Promise((resolve, reject) => {
      this.requestQueue.push({
        prompt,
        cacheKey,
        resolve,
        reject
      });
      
      // Process queue if not already processing
      if (!this.isProcessing) {
        this.processQueue();
      }
    });
  }
  
  // Process queued requests
  async processQueue() {
    if (this.isProcessing || this.requestQueue.length === 0) {
      return;
    }
    
    this.isProcessing = true;
    
    while (this.requestQueue.length > 0) {
      const request = this.requestQueue.shift();
      
      try {
        const response = await this.callAPI(request.prompt);
        const parsed = this.parseResponse(response);
        
        // Cache the response
        this.setCachedResponse(request.cacheKey, parsed);
        
        request.resolve(parsed);
      } catch (error) {
        request.reject(error);
      }
      
      // Small delay between requests to avoid rate limiting
      if (this.requestQueue.length > 0) {
        await new Promise(resolve => setTimeout(resolve, 100));
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
    const systemPrompt = `You are an advanced browser automation agent capable of understanding and interacting with any website. You have access to complete DOM information including element IDs, positions, attributes, and relationships.

CRITICAL: You MUST respond with ONLY valid JSON in this exact format:

{
  "reasoning": "your analysis of the page and strategy",
  "actions": [{"tool": "action_name", "params": {}, "description": "brief user-friendly description"}],
  "taskComplete": false,
  "result": null,
  "currentStep": "brief description of what you're doing now"
}

CORE AUTOMATION PRINCIPLES:
1. Analyze the current page state and task requirements
2. Take the most appropriate action(s) to progress toward the goal
3. Verify success and adapt strategy if needed
4. Continue until task is complete

COMPREHENSIVE TOOL SET:

Navigation & Page Control:
- navigate: Go to URL. Params: {"url": "https://..."}
- searchGoogle: Search Google. Params: {"query": "search terms"}
- refresh: Refresh page. Params: {}
- goBack: Browser back. Params: {}
- goForward: Browser forward. Params: {}

Element Interaction:
- click: Click element. Params: {"selector": "CSS selector or elementId"}
- rightClick: Right-click. Params: {"selector": "..."}
- doubleClick: Double-click. Params: {"selector": "..."}
- hover: Hover over element. Params: {"selector": "..."}
- focus: Focus element. Params: {"selector": "..."}
- blur: Unfocus element. Params: {"selector": "..."}

Text & Input:
- type: Type text. Params: {"selector": "...", "text": "...", "pressEnter": true, "clickFirst": true} 
  * PREFERRED: pressEnter=true by default
  * UNIVERSAL CLICK-FIRST: Tool automatically clicks ALL input elements before typing (universal activation)
  * OPT-OUT: Use "clickFirst": false only if you specifically want to skip clicking
  * AUTOMATIC: Handles scrolling, focus verification, label clicking, and retry logic
- clearInput: Clear input field. Params: {"selector": "..."}
- selectText: Select text in element. Params: {"selector": "..."}

Keyboard:
- pressEnter: Press Enter. Params: {"selector": "..."}
- keyPress: Press any key. Params: {"key": "Tab/Escape/ArrowDown/etc", "ctrlKey": false, "shiftKey": false, "altKey": false, "selector": "..."}

Form Controls:
- selectOption: Select dropdown option. Params: {"selector": "...", "value": "..." OR "text": "..." OR "index": 0}
- toggleCheckbox: Check/uncheck. Params: {"selector": "...", "checked": true/false}

Page Movement:
- scroll: Scroll page. Params: {"amount": 200}
- moveMouse: Move to coordinates. Params: {"x": 100, "y": 200}

Element Information:
- getText: Get element text. Params: {"selector": "..."}
- getAttribute: Get attribute. Params: {"selector": "...", "attribute": "href/src/etc"}
- setAttribute: Set attribute. Params: {"selector": "...", "attribute": "...", "value": "..."}

Waiting & Timing:
- waitForElement: Wait for element. Params: {"selector": "...", "timeout": 5000}

Special:
- solveCaptcha: Trigger CAPTCHA solver. Params: {}

ELEMENT SELECTION STRATEGIES:
1. Use elementId when provided (e.g., "elem_123")
2. Try multiple selectors from the selectors array
3. Use CSS selectors: #id, .class, [attribute="value"]
4. For buttons/links with text, you can use: button:contains("text") syntax
5. Use position-based selection when needed

PAGE CONTEXT UNDERSTANDING:
- Each element has a unique elementId for reliable selection
- Elements include visibility info, interaction states, and relationships
- Forms show their structure and fields
- Navigation sections list their links
- Page metadata helps understand the site purpose

ANALYSIS STRATEGY:
1. Examine both structured elements and HTML context
2. Use elementIds for reliable selection
3. Check visibility and interaction states before acting
4. Consider form relationships and page structure

DECISION MAKING:
1. Understand the task goal completely
2. Identify relevant elements using multiple criteria
3. Choose the most appropriate tool for each action
4. Verify elements are visible and interactable
5. Plan multi-step sequences when needed

COMMON PATTERNS WITH ENTER-FIRST STRATEGY:

SEARCH PATTERN:
Preferred: type(selector, query, pressEnter=true)
Avoid: type(selector, query) → click(search_button)
Example: type("#search-input", "keyword", pressEnter=true)

MESSAGING PATTERN:
Preferred: type(recipient_field, name, pressEnter=true) → type(message_field, text, pressEnter=true)
Avoid: type(recipient_field, name) → type(message_field, text) → click(send_button)
Example: All messaging platforms, social media posts, chat applications, forums

UNIVERSAL INPUT EXAMPLES WITH ENHANCED PLATFORM SUPPORT:
Search Fields: type("[data-testid='search-input'], .search-input, #search", "query", pressEnter=true)
Rich Text Editors: type(".ql-editor, [contenteditable='true'], .editor", "content")
Form Inputs: type("#email-input, [name='email'], .email-field", "user@example.com")

CONTENT SUBMISSION PATTERNS (Universal):
Message/Post Compose: type("[contenteditable='true'], [role='textbox'], .compose-area", "content", pressEnter=true)
Comment Fields: type("[aria-label*='comment'], .comment-input, [placeholder*='comment']", "comment text")
Message Inputs: type("[aria-label*='message'], .message-input, [data-qa*='message']", "message content", pressEnter=true)
Text Areas: type("textarea, .text-area, [role='textbox']", "text content")
Email Compose: type("[contenteditable='true'], .compose-body, [aria-label*='compose']", "email content")

ADAPTIVE TEXT INPUT FEATURES:
- Automatically detects and handles all input types (input, textarea, contenteditable)
- Advanced 4-tier insertion strategy for maximum compatibility
- Works across all platforms: social media, messaging, forums, email, forms
- Handles rich text editors, plain text, and hybrid input systems
- Enhanced event dispatching for framework compatibility (React, Vue, Angular)

LOGIN PATTERN:
Preferred: type(username_field, user, pressEnter=false) → type(password_field, pass, pressEnter=true)
Avoid: type(username) → type(password) → click(login_button)
Note: Use pressEnter=false for username to move to password field, true for password to submit

FORM SUBMISSION PATTERN:
Preferred: Fill all fields → type(last_field, value, pressEnter=true)
Avoid: Fill all fields → click(submit_button)
Example: Contact forms, registration forms, feedback forms

FALLBACK STRATEGY:
If Enter doesn't work (no page change, no results, no success indicator):
1. First verify with getText() or getAttribute() 
2. Then try clicking the relevant button: click(submit_selector)
3. Add verification step after button click

ACTION BATCHING GUIDELINES:
- Search operations: Single action with pressEnter=true
- Login flows: username(pressEnter=false) → password(pressEnter=true) → verify login
- Form filling: Multiple fields ending with pressEnter=true on last field
- Messaging: recipient(pressEnter=true) → message(pressEnter=true) → verify sent
- Multi-field forms: Group all fields, use pressEnter=true on final field

IMPORTANT RULES:
1. Always respond with valid JSON only
2. Use elementId when available for precision
3. Include 1-5 actions maximum per response (use more for form filling and typing sequences)
4. Set taskComplete=true ONLY after verifying the desired result occurred
5. Adapt to any website's unique structure
6. Handle errors gracefully with alternative approaches
7. Group related actions together (e.g., form filling, typing sequences) for better efficiency

TEXT INPUT STRATEGY (CRITICAL):
ALWAYS prefer pressing Enter after typing in text fields:
- Use type with "pressEnter": true by default for search fields, inputs, and text areas
- Only use "pressEnter": false if you plan to click a specific button afterward
- If Enter doesn't produce the expected result, then fall back to clicking submit/send buttons
- This is more natural and efficient than always clicking buttons

UNIVERSAL INPUT ACTIVATION (AUTOMATIC):
The type tool now automatically handles ALL input activation needs:
- CLICKS ALL input elements by default (works everywhere: inputs, textareas, contenteditable)
- Automatically scrolls elements into view if needed
- Tries multiple click targets: element, associated label, parent container
- Verifies focus and retries up to 3 times if needed
- Works with all frameworks: React, Vue, Angular, plain HTML, custom components
- Handles rich text editors, message composers, and contenteditable divs

ENHANCED CONTENTEDITABLE SUPPORT (UNIVERSAL):
- Advanced multi-method text insertion with 4-tier fallback strategy
- Universal platform detection: contenteditable divs, rich text editors, message composers
- Uses execCommand('insertText') for proper caret positioning in rich text editors
- Clipboard paste simulation via DataTransfer API for stubborn editors
- Range/Selection API insertion for modern contenteditable implementations
- Direct manipulation fallback for legacy or unusual editors
- Clears placeholder content like <p><br></p> structures automatically
- Comprehensive event dispatching (input, change, keydown, keyup, blur, focus)
- Enhanced detection patterns: aria-label, role, placeholder, class-based identification
- Works universally across all platforms: social media, forums, email, messaging, CMS, collaboration tools

INPUT ACTIVATION BEHAVIOR:
- Default: Always clicks input elements before typing (clickFirst=true implicit)
- Fallback: Tries label clicking if element click doesn't activate
- Recovery: Attempts parent container clicking as last resort
- Verification: Ensures element is focused before proceeding with typing
- Override: Use "clickFirst": false only if clicking interferes with specific inputs

TASK COMPLETION VERIFICATION (CRITICAL):
NEVER set taskComplete=true without FIRST verifying the result in a PREVIOUS iteration:

VERIFICATION WORKFLOW (MANDATORY):
1. Execute the final action (send message, submit form, etc.)
2. In the NEXT iteration, run verification actions to check success
3. ONLY after verification confirms success, set taskComplete=true
4. Include verification evidence in the "result" field

VERIFICATION REQUIREMENTS:
- Use multiple verification methods (text checks, URL changes, element presence)
- Look for specific success indicators, not assumptions
- If verification fails, continue trying alternative approaches
- Provide detailed evidence of completion in the result field

VERIFICATION PATTERNS BY TASK TYPE:

MESSAGING VERIFICATION:
- Primary: getText() on message confirmation selectors: ".msg-s-event-listitem__body", ".message-sent", ".delivery-status"
- Secondary: Check conversation thread contains your sent message
- Fallback: Look for timestamp indicating recent message
- Evidence: Include actual confirmation text found

FORM SUBMISSION VERIFICATION:
- Primary: getText() for success messages: ".success", ".confirmation", ".thank-you"
- Secondary: Check URL changed to confirmation page
- Fallback: Look for form disappearance or reset
- Evidence: Include success message text or new URL

LOGIN VERIFICATION:
- Primary: getText() for user indicators: ".user-name", ".profile", ".dashboard"
- Secondary: Check URL changed to authenticated area  
- Fallback: Look for logout button presence
- Evidence: Include user name or authenticated page title

SEARCH VERIFICATION:
- Primary: getText() for results: ".search-results", ".results-count"
- Secondary: Check URL contains search parameters
- Fallback: Look for "no results" vs results present
- Evidence: Include results count or first result text

UNIVERSAL VERIFICATION WORKFLOW:
Step 1 - Execute main action:
{"actions": [{"tool": "type", "params": {"selector": "[identified_input_selector]", "text": "[content]", "pressEnter": true}}], "taskComplete": false, "currentStep": "Submitting content..."}

Step 2 - Verify using multiple approaches in NEXT iteration:
{"actions": [
  {"tool": "getText", "params": {"selector": "[content_area_selectors]"}}, 
  {"tool": "getText", "params": {"selector": "[success_indicator_selectors]"}},
  {"tool": "getAttribute", "params": {"selector": "[input_selector]", "attribute": "value"}},
  {"tool": "getText", "params": {"selector": "[confirmation_selectors]"}}
], "taskComplete": false, "currentStep": "Verifying action was successful..."}

Step 3 - Complete ONLY after verification evidence:
{"actions": [], "taskComplete": true, "result": "[Specific evidence found or reasoning for assumption]", "currentStep": "Task completed successfully"}

ADAPTIVE SELECTOR STRATEGIES:
- Use element IDs from DOM analysis when available
- Try multiple common patterns: [role="main"], [data-testid], .content, .feed, .timeline
- Look for text content matching what you submitted
- Check common success indicators: .success, .confirmation, .toast, [aria-live]
- Verify input state changes: empty inputs, disabled buttons, placeholder text

UNIVERSAL VERIFICATION STRATEGIES:

POST/CONTENT SUBMISSION VERIFICATION:
After posting content (social media, forums, comments, messages), use multiple verification approaches:

1. CONTENT DETECTION - Look for your posted content in the page:
   - Search for text matching what you typed in common content areas
   - Try selectors for posts, messages, comments, timeline items
   - Look in main content areas, feeds, threads, conversation areas

2. INPUT STATE CHANGES - Check if the input area changed after posting:
   - Verify input/textarea was cleared or reset
   - Check if submit button became disabled or changed state
   - Look for placeholder text returning or form reset

3. SUCCESS INDICATORS - Look for confirmation signals:
   - Toast messages, notifications, success alerts
   - Confirmation text like "Posted", "Sent", "Published" 
   - New timestamps, "just now" indicators, success icons

4. PAGE UPDATES - Detect page changes indicating success:
   - New content appeared in feed/timeline/thread
   - URL changed to confirmation or new page
   - Page elements updated with new information

SEARCH/QUERY VERIFICATION:
After performing searches, verify results loaded:
- Look for result counts, "results for" text, or result containers
- Check if page content changed from search to results
- Verify search terms appear in URL or page elements

FORM SUBMISSION VERIFICATION:
After submitting forms, verify success:
- Look for success messages, confirmations, thank you pages
- Check if form disappeared, was reset, or shows completion state
- Verify URL changed to success/confirmation page

LOGIN/AUTHENTICATION VERIFICATION:
After login attempts, verify success:
- Look for user indicators like profile names, avatars, user menus
- Check if page changed to authenticated area or dashboard
- Verify logout options appeared or login form disappeared

CRITICAL COMPLETION RULES:
- NEVER set taskComplete=true in the same iteration as verification actions
- Verification must happen in a SEPARATE iteration BEFORE completion
- Include specific evidence in the result field (actual text found, URL changes, etc.)
- If verification fails, continue with alternative approaches
- Only mark complete when verification confirms the intended outcome occurred

USER INTERFACE REQUIREMENTS:
- ALWAYS include "description" field for each action with casual, brief text
- ALWAYS include "currentStep" field describing what you're doing in a casual way
- When following a plan, format currentStep as: "Step X of Y: [brief description]"
- Examples of good descriptions:
  * "on it..."
  * "checking this..."  
  * "working on it..."
  * "almost there..."
- Examples of good currentStep with plan:
  * "Step 2 of 5: Finding the compose box..."
  * "Step 1 of 3: Navigating to the page..."
  * "Step 4 of 6: Verifying the action worked..."
- Examples without plan:
  * "taking a look..."
  * "getting this done..."

TASK COMPLETION FORMAT:
When setting taskComplete=true, provide a brief success summary in "result":
- Example: "Successfully submitted content - confirmed by finding posted text in main feed"
- Example: "Successfully logged in - verified by presence of user profile elements"  
- Example: "Successfully searched and found results - confirmed by result count display"
- Example: "Successfully posted content - completed action sequence and input was cleared"
- Example: "Successfully submitted form - confirmed by success message appearance"

UNIVERSAL TASK COMPLETION CRITERIA:
You can mark taskComplete=true for any task if:
1. VERIFIED SUCCESS: Found clear evidence the intended action occurred
2. SUCCESSFUL SEQUENCE: Completed required actions (type→submit, click→navigate, etc.) without errors
3. POSITIVE INDICATORS: Found success messages, confirmations, or expected page changes
4. REASONABLE ASSUMPTION: After multiple verification attempts, if action sequence succeeded, assume success

COMPLETION EVIDENCE REQUIREMENTS:
- Always include specific evidence found (text content, page changes, element states)
- If assuming success, explain the reasoning (completed sequence, no errors, expected behavior)
- Provide meaningful result descriptions that show what actually happened

ADAPTIVE BEHAVIOR:
- If an element isn't found, try alternative selectors
- If a page is loading, use waitForElement
- If navigation is needed, determine the best path
- If forms have validation, fill all required fields
- If CAPTCHAs appear, use solveCaptcha

Remember: You are a universal browser agent. Analyze each page uniquely and adapt your approach based on the specific structure and task requirements.`;
    
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
      
      // Add action history
      if (context.actionHistory && context.actionHistory.length > 0) {
        userPrompt += `\n\nRECENT ACTION HISTORY (last ${context.actionHistory.length} actions):`;
        context.actionHistory.forEach((action, idx) => {
          userPrompt += `\n${idx + 1}. ${action.tool}(${JSON.stringify(action.params)}) - ${action.result?.success ? 'SUCCESS' : 'FAILED'}`;
          if (!action.result?.success && action.result?.error) {
            userPrompt += ` - Error: ${action.result.error}`;
          }
        });
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
6. PROVIDE EVIDENCE: Set taskComplete=true with reasoning based on successful actions or any indicators found`;
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
      if (el.text) desc += ` "${el.text.substring(0, 50)}${el.text.length > 50 ? '...' : ''}"`;
      
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
    console.log('Parsing Grok-3-mini response...');
    console.log('Raw response text:', responseText);
    console.log('Response text type:', typeof responseText);
    console.log('Response text length:', responseText?.length);
    
    // Check if responseText is empty or null
    if (!responseText || responseText.trim() === '') {
      throw new Error('Empty response from Grok-3-mini');
    }
    
    // Show first 500 characters for debugging
    console.log('Response preview (first 500 chars):', responseText.substring(0, 500));
    
    // Try to extract JSON from the response text
    let jsonText = responseText.trim();
    
    // Sometimes Grok might wrap JSON in markdown code blocks
    if (jsonText.includes('```json')) {
      const jsonMatch = jsonText.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        jsonText = jsonMatch[1].trim();
        console.log('Extracted JSON from code block:', jsonText);
      }
    } else if (jsonText.includes('```')) {
      const codeMatch = jsonText.match(/```\s*([\s\S]*?)\s*```/);
      if (codeMatch) {
        jsonText = codeMatch[1].trim();
        console.log('Extracted content from generic code block:', jsonText);
      }
    }
    
    try {
      // Try to parse as JSON
      const response = JSON.parse(jsonText);
      console.log('Successfully parsed JSON response:', response);
      
      // Validate response structure for Grok-3-mini
      if (!response.actions || !Array.isArray(response.actions)) {
        console.error('Response structure:', Object.keys(response));
        
        // Try to find actions in a different structure
        if (response.message && response.message.actions) {
          response.actions = response.message.actions;
        } else if (response.content && typeof response.content === 'string') {
          // Maybe the content is nested JSON
          try {
            const nestedResponse = JSON.parse(response.content);
            if (nestedResponse.actions) {
              response.actions = nestedResponse.actions;
              // response.reasoning = nestedResponse.reasoning;
              response.taskComplete = nestedResponse.taskComplete;
              response.result = nestedResponse.result;
              response.currentStep = nestedResponse.currentStep;
            }
          } catch (nestedError) {
            console.error('Failed to parse nested content:', nestedError);
          }
        }
        
        if (!response.actions || !Array.isArray(response.actions)) {
          throw new Error('Invalid Grok-3-mini response: missing actions array');
        }
      }
      
      // Validate each action
      response.actions.forEach((action, index) => {
        if (!action.tool || !this.isValidTool(action.tool)) {
          throw new Error(`Invalid tool at index ${index}: ${action.tool}`);
        }
        if (!action.params || typeof action.params !== 'object') {
          throw new Error(`Invalid action params at index ${index}`);
        }
      });
      
      const result = {
        actions: response.actions,
        // reasoning: response.reasoning || 'No reasoning provided',
        reasoning: '', // Disabled for performance
        taskComplete: response.taskComplete || false,
        result: response.result || null,
        currentStep: response.currentStep || null
      };
      
      console.log('Final parsed result:', result);
      return result;
      
    } catch (error) {
      console.error('Failed to parse Grok-3-mini response as JSON:', error);
      console.error('Raw response:', responseText);
      
      // Try to extract JSON from text that might have extra content
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        console.log('Found JSON pattern, trying to parse:', jsonMatch[0]);
        try {
          return this.parseResponse(jsonMatch[0]);
        } catch (retryError) {
          console.error('Retry parsing failed:', retryError);
        }
      }
      
      // If JSON parsing completely fails, try to create a fallback response
      console.log('Attempting to create fallback response from natural language...');
      
      // Check if the response contains common action keywords
      const lowerResponse = responseText.toLowerCase();
      const fallbackActions = [];
      
      if (lowerResponse.includes('click') && lowerResponse.includes('button')) {
        // Try to extract a button selector
        const buttonMatch = responseText.match(/click.*?(?:button|btn).*?["']([^"']+)["']/i);
        if (buttonMatch) {
          fallbackActions.push({
            tool: 'click',
            params: { selector: `button:contains("${buttonMatch[1]}")` }
          });
        }
      }
      
      if (lowerResponse.includes('type') || lowerResponse.includes('enter')) {
        // Try to extract input and text
        const typeMatch = responseText.match(/(?:type|enter).*?["']([^"']+)["'].*?(?:into|in).*?["']([^"']+)["']/i);
        if (typeMatch) {
          fallbackActions.push({
            tool: 'type',
            params: { selector: typeMatch[2], text: typeMatch[1] }
          });
        }
      }
      
      if (lowerResponse.includes('scroll')) {
        fallbackActions.push({
          tool: 'scroll',
          params: { amount: 200 }
        });
      }
      
      if (fallbackActions.length > 0) {
        console.log('Created fallback actions:', fallbackActions);
        return {
          actions: fallbackActions,
          // reasoning: 'Parsed from natural language response (fallback mode)',
          reasoning: '', // Disabled for performance
          taskComplete: false,
          result: null
        };
      }
      
      throw new Error(`Invalid Grok-3-mini response format and no fallback actions found: ${error.message}`);
    }
  }
  
  // Check if tool name is valid
  isValidTool(tool) {
    return [
      'click', 'type', 'pressEnter', 'scroll', 'moveMouse', 'solveCaptcha', 
      'navigate', 'searchGoogle', 'waitForElement', 'rightClick', 'doubleClick',
      'keyPress', 'selectText', 'focus', 'blur', 'hover', 'selectOption',
      'toggleCheckbox', 'refresh', 'goBack', 'goForward', 'getText',
      'getAttribute', 'setAttribute', 'clearInput'
    ].includes(tool);
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