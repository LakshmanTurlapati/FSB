// Background service worker for FSB v0.1

// Import configuration and AI integration modules
importScripts('config.js');
importScripts('init-config.js');
importScripts('ai-integration.js');
importScripts('automation-logger.js');
importScripts('analytics.js');

// Store for active automation sessions
let activeSessions = new Map();

// Global analytics instance
let globalAnalytics = null;

// Service Worker compatible analytics class
class BackgroundAnalytics {
  constructor() {
    this.usageData = [];
    this.currentModel = 'grok-3-mini';
    this.initialized = false;
    this.initPromise = this.initialize();
  }
  
  async initialize() {
    try {
      console.log('Background Analytics initializing...');
      await this.loadStoredData();
      this.initialized = true;
      console.log('Background Analytics initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Background Analytics:', error);
    }
  }
  
  async loadStoredData() {
    try {
      const result = await chrome.storage.local.get(['fsbUsageData', 'fsbCurrentModel']);
      if (result.fsbUsageData) {
        this.usageData = result.fsbUsageData;
        console.log(`Background: Loaded ${this.usageData.length} usage entries`);
      }
      if (result.fsbCurrentModel) {
        this.currentModel = result.fsbCurrentModel;
      }
    } catch (error) {
      console.error('Background: Failed to load analytics data:', error);
    }
  }
  
  async saveData() {
    try {
      console.log('Background: Saving analytics data...', {
        entries: this.usageData.length,
        model: this.currentModel
      });
      
      await chrome.storage.local.set({
        fsbUsageData: this.usageData,
        fsbCurrentModel: this.currentModel
      });
      
      console.log(`Background: Successfully saved ${this.usageData.length} usage entries`);
      
      // Verify save by reading back
      const verify = await chrome.storage.local.get(['fsbUsageData']);
      console.log('Background: Verification - saved entries:', verify.fsbUsageData?.length);
    } catch (error) {
      console.error('Background: Failed to save analytics data:', error);
      throw error; // Re-throw to be caught by caller
    }
  }
  
  calculateCost(model, inputTokens, outputTokens) {
    const pricing = {
      'grok-4': { input: 3.00, output: 15.00 },
      'grok-3': { input: 3.00, output: 15.00 },
      'grok-3-mini': { input: 0.30, output: 0.50 },
      'gpt-4o': { input: 2.50, output: 10.00 },
      'gpt-4o-mini': { input: 0.15, output: 0.60 }
    };
    
    const modelPricing = pricing[model] || pricing['grok-3-mini'];
    const inputCost = (inputTokens / 1000000) * modelPricing.input;
    const outputCost = (outputTokens / 1000000) * modelPricing.output;
    return inputCost + outputCost;
  }
  
  async trackUsage(model, inputTokens, outputTokens, success = true) {
    try {
      // Ensure initialization is complete
      if (!this.initialized) {
        await this.initPromise;
      }
      
      const entry = {
        timestamp: Date.now(),
        model: model,
        inputTokens: inputTokens || 0,
        outputTokens: outputTokens || 0,
        success: success,
        cost: this.calculateCost(model, inputTokens, outputTokens)
      };

      this.usageData.push(entry);
      this.currentModel = model;
      
      console.log('Background: Usage tracked:', entry);
      console.log('Background: Total entries:', this.usageData.length);
      
      // Clean old data (keep only last 30 days)
      const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
      this.usageData = this.usageData.filter(entry => entry.timestamp > thirtyDaysAgo);
      
      await this.saveData();
      console.log('Background: Data saved successfully');
      
    } catch (error) {
      console.error('Background: Failed to track usage:', error);
      throw error; // Re-throw to be caught by caller
    }
  }
}

// Initialize analytics
function initializeAnalytics() {
  if (!globalAnalytics) {
    globalAnalytics = new BackgroundAnalytics();
    console.log('Background analytics created');
  }
  return globalAnalytics;
}

// Listen for messages from popup and content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Background received message:', request.action);
  console.log('Full request object:', request);
  
  switch (request.action) {
    case 'startAutomation':
      handleStartAutomation(request, sender, sendResponse);
      return true; // Will respond asynchronously
      
    case 'stopAutomation':
      handleStopAutomation(request, sender, sendResponse);
      break;
      
    case 'callAI':
      handleAICall(request, sender, sendResponse);
      return true; // Will respond asynchronously
      
    case 'getStatus':
      sendResponse({ 
        status: 'ready', 
        activeSessions: activeSessions.size 
      });
      break;
      
    case 'testAPI':
      handleTestAPI(request, sender, sendResponse);
      return true; // Will respond asynchronously
      
    case 'TRACK_USAGE':
      return handleTrackUsage(request, sender, sendResponse);
      
    default:
      sendResponse({ error: 'Unknown action' });
  }
});

/**
 * Handles the start of a new automation session
 * @param {Object} request - The automation start request
 * @param {string} request.task - The task description in natural language
 * @param {number} request.tabId - The ID of the tab to automate
 * @param {Object} sender - The message sender information
 * @param {Function} sendResponse - Function to send response back to sender
 * @returns {Promise<void>}
 */
async function handleStartAutomation(request, sender, sendResponse) {
  const { task, tabId } = request;
  
  try {
    // Create new session with enhanced tracking
    const sessionId = `session_${Date.now()}`;
    const sessionData = {
      task,
      tabId: tabId || sender.tab?.id,
      status: 'running',
      startTime: Date.now(),
      actionHistory: [],        // Track all actions executed
      stateHistory: [],         // Track DOM state changes
      failedAttempts: {},       // Track failed actions by type
      lastDOMHash: null,        // Hash of last DOM state to detect changes
      stuckCounter: 0,          // Counter for detecting stuck state
      iterationCount: 0,        // Total iterations
      urlHistory: [],           // Track URL changes
      lastUrl: null,            // Last known URL
      actionSequences: [],      // Track sequences of actions to detect patterns
      sequenceRepeatCount: {},  // Count how many times each sequence repeats
    };
    
    activeSessions.set(sessionId, sessionData);
    
    automationLogger.logSessionStart(sessionId, task, sessionData.tabId);
    console.log('Background: Created new session:', sessionId);
    console.log('Background: Session data:', sessionData);
    console.log('Background: Total active sessions:', activeSessions.size);
    
    // Inject content script if needed
    if (tabId || sender.tab?.id) {
      await chrome.scripting.executeScript({
        target: { tabId: tabId || sender.tab.id },
        files: ['content.js']
      });
    }
    
    sendResponse({ 
      success: true, 
      sessionId,
      message: 'Automation started' 
    });
    
    // Start the automation loop
    startAutomationLoop(sessionId);
    
  } catch (error) {
    console.error('Error starting automation:', error);
    sendResponse({ 
      success: false, 
      error: error.message 
    });
  }
}



// Handle automation stop
function handleStopAutomation(request, sender, sendResponse) {
  const { sessionId } = request;
  
  console.log('Background: Stop automation request received');
  console.log('Background: Session ID to stop:', sessionId);
  console.log('Background: Active sessions:', Array.from(activeSessions.keys()));
  
  if (activeSessions.has(sessionId)) {
    const session = activeSessions.get(sessionId);
    console.log('Background: Found session, current status:', session.status);
    
    session.status = 'stopped';
    activeSessions.delete(sessionId);
    
    console.log('Background: Session stopped and removed');
    sendResponse({ 
      success: true, 
      message: 'Automation stopped' 
    });
  } else {
    console.log('Background: Session not found in active sessions');
    sendResponse({ 
      success: false, 
      error: 'Session not found' 
    });
  }
}

// Handle API test
async function handleTestAPI(request, sender, sendResponse) {
  try {
    // Get settings for API test
    const settings = await config.getAll();
    
    // Check appropriate API key based on provider
    const provider = settings.modelProvider || 'xai';
    if (provider === 'gemini' && !settings.geminiApiKey) {
      sendResponse({ 
        success: false, 
        error: 'Gemini API key not configured. Please set it in extension settings.' 
      });
      return;
    } else if (provider === 'xai' && !settings.apiKey) {
      sendResponse({ 
        success: false, 
        error: 'xAI API key not configured. Please set it in extension settings.' 
      });
      return;
    }
    
    // Create AI integration instance and test connection
    const ai = new AIIntegration(settings);
    const testResult = await ai.testConnection();
    
    sendResponse({ 
      success: !testResult.connectionFailed && testResult.ok, 
      result: testResult 
    });
    
  } catch (error) {
    console.error('API test error:', error);
    sendResponse({ 
      success: false, 
      error: error.message 
    });
  }
}

// Handle AI API calls
async function handleAICall(request, sender, sendResponse) {
  const { prompt, structuredDOM, apiKey } = request;
  
  try {
    // This is where we'll integrate with xAI Grok or OpenAI
    // For now, we'll simulate an AI response
    const aiResponse = await callAIAPI(prompt, structuredDOM, apiKey);
    
    sendResponse({ 
      success: true, 
      response: aiResponse 
    });
  } catch (error) {
    console.error('AI API error:', error);
    sendResponse({ 
      success: false, 
      error: error.message 
    });
  }
}

/**
 * Calculates smart delays between actions based on action types and context
 * @param {Object} currentAction - The current action being executed
 * @param {string} currentAction.tool - The tool/action type
 * @param {Object} currentAction.params - Action parameters
 * @param {Object} nextAction - The next action to be executed
 * @param {string} nextAction.tool - The next tool/action type
 * @returns {number} Delay in milliseconds
 */
function calculateActionDelay(currentAction, nextAction) {
  // Define action categories
  const fastActions = ['type', 'clearInput', 'selectText', 'focus', 'blur', 'pressEnter', 'keyPress'];
  const mediumActions = ['hover', 'moveMouse', 'getAttribute', 'getText'];
  const slowActions = ['click', 'rightClick', 'doubleClick', 'selectOption', 'toggleCheckbox'];
  const verySlowActions = ['navigate', 'refresh', 'goBack', 'goForward', 'solveCaptcha', 'waitForElement'];
  
  // Base delays in milliseconds
  const delays = {
    fastToFast: 300,      // Fast typing sequences
    fastToMedium: 500,    // Type then hover
    fastToSlow: 800,      // Type then click
    fastToVerySlow: 1500, // Type then navigate
    
    mediumToFast: 400,    // Hover then type
    mediumToMedium: 600,  // Hover then move
    mediumToSlow: 800,    // Hover then click
    mediumToVerySlow: 1500,
    
    slowToFast: 1000,     // Click then type (need DOM to settle)
    slowToMedium: 800,    // Click then hover
    slowToSlow: 1200,     // Click then click
    slowToVerySlow: 2000, // Click then navigate
    
    verySlowToAny: 3000   // Navigation actions need time
  };
  
  // Categorize actions
  function getActionCategory(action) {
    if (!action) return 'unknown';
    
    if (fastActions.includes(action.tool)) return 'fast';
    if (mediumActions.includes(action.tool)) return 'medium';
    if (slowActions.includes(action.tool)) return 'slow';
    if (verySlowActions.includes(action.tool)) return 'verySlow';
    return 'medium'; // Default
  }
  
  const currentCategory = getActionCategory(currentAction);
  const nextCategory = getActionCategory(nextAction);
  
  // Special cases for related actions
  if (currentAction.tool === 'type' && nextAction && nextAction.tool === 'type') {
    // Fast consecutive typing - check if they're in the same form
    const currentSelector = currentAction.params?.selector || '';
    const nextSelector = nextAction.params?.selector || '';
    
    // If typing in different fields of same form, use shorter delay
    if (currentSelector.includes('input') && nextSelector.includes('input')) {
      return 200; // Very fast for form filling
    }
    if (currentSelector.includes('textarea') && nextSelector.includes('textarea')) {
      return 300; // Fast for text areas
    }
  }
  
  // Click followed by type (common pattern like clicking input then typing)
  if (currentAction.tool === 'click' && nextAction && nextAction.tool === 'type') {
    return 600; // Moderate delay for click-to-type
  }
  
  // Type with pressEnter followed by anything needs more time
  if (currentAction.tool === 'type' && currentAction.params?.pressEnter) {
    return 1000; // Enter key usually triggers actions
  }
  
  // Use category-based delays
  const delayKey = `${currentCategory}To${nextCategory.charAt(0).toUpperCase() + nextCategory.slice(1)}`;
  
  if (currentCategory === 'verySlow') {
    return delays.verySlowToAny;
  }
  
  return delays[delayKey] || delays.mediumToMedium; // Default fallback
}

// Helper function to create smart sequence signatures that group similar actions
function createSmartSequenceSignature(actions) {
  return actions.map(action => {
    // Normalize action signatures to group similar actions
    if (action.tool === 'type') {
      // Group typing actions by selector type, not exact text
      const selector = action.params?.selector || '';
      let selectorType = 'unknown';
      
      if (selector.includes('input')) selectorType = 'input';
      else if (selector.includes('textarea')) selectorType = 'textarea';
      else if (selector.includes('search')) selectorType = 'search';
      else if (selector.includes('email')) selectorType = 'email';
      else if (selector.includes('password')) selectorType = 'password';
      
      return `type:${selectorType}`;
    }
    
    if (action.tool === 'click') {
      // Group clicks by element type
      const selector = action.params?.selector || '';
      let elementType = 'unknown';
      
      if (selector.includes('button') || selector.includes('btn')) elementType = 'button';
      else if (selector.includes('link') || selector.includes('a[')) elementType = 'link';
      else if (selector.includes('submit')) elementType = 'submit';
      else if (selector.includes('form')) elementType = 'form';
      
      return `click:${elementType}`;
    }
    
    // For other actions, use a simplified signature
    return action.tool;
  }).join('->');
}

// Helper function to check if repetition is harmful
function checkHarmfulRepetition(actions, repeatCount, session) {
  // Don't flag as harmful if repeat count is low
  if (repeatCount <= 2) return false;
  
  // Check if the actions are making progress
  const hasProgressIndicators = actions.some(action => {
    // Actions that typically indicate progress
    return ['navigate', 'searchGoogle', 'refresh', 'solveCaptcha'].includes(action.tool) ||
           (action.tool === 'type' && action.params?.pressEnter) || // Form submissions
           (action.tool === 'click' && action.params?.selector?.includes('submit'));
  });
  
  // If actions include progress indicators, be less aggressive about flagging
  if (hasProgressIndicators && repeatCount <= 4) return false;
  
  // Check recent success rate
  const recentActions = session.actionHistory.slice(-10);
  const recentFailures = recentActions.filter(a => !a.result?.success).length;
  const failureRate = recentActions.length > 0 ? recentFailures / recentActions.length : 0;
  
  // If most actions are succeeding, don't flag as harmful even with repetition
  if (failureRate < 0.3 && repeatCount <= 5) return false;
  
  // Check if we're stuck on the same URL without making progress
  const urlHistory = session.urlHistory.slice(-3);
  const sameUrlCount = urlHistory.filter(entry => entry.url === session.lastUrl).length;
  
  // If we're repeating the same actions on the same URL multiple times, it's likely harmful
  if (sameUrlCount >= 2 && repeatCount >= 3) return true;
  
  // Default threshold - flag as harmful if repeated more than 4 times
  return repeatCount > 4;
}

// Helper function to create a more intelligent hash of DOM state
function createDOMHash(domState) {
  // Filter out elements that should not affect stuck detection
  const coreElements = (domState.elements || []).filter(el => {
    const classStr = String(el.class || '').toLowerCase();
    const idStr = String(el.id || '').toLowerCase();
    const textStr = String(el.text || '').toLowerCase();
    
    // Exclude common modal/overlay indicators
    const isModal = classStr.includes('modal') || classStr.includes('overlay') || 
                   classStr.includes('popup') || classStr.includes('dialog') ||
                   idStr.includes('modal') || idStr.includes('overlay') ||
                   classStr.includes('dropdown') || classStr.includes('menu');
    
    // Exclude elements that are typically transient
    const isTransient = classStr.includes('loading') || classStr.includes('spinner') ||
                       classStr.includes('toast') || classStr.includes('alert') ||
                       classStr.includes('notification') || classStr.includes('tooltip') ||
                       classStr.includes('progress') || classStr.includes('skeleton');
    
    // Exclude dynamic content that changes frequently
    const isDynamic = classStr.includes('timestamp') || classStr.includes('counter') ||
                     classStr.includes('badge') || classStr.includes('status') ||
                     textStr.includes('ago') || textStr.includes('now') ||
                     textStr.includes('online') || textStr.includes('offline');
    
    // Exclude animations and transitions
    const isAnimated = classStr.includes('animate') || classStr.includes('transition') ||
                      classStr.includes('fade') || classStr.includes('slide') ||
                      classStr.includes('bounce') || classStr.includes('pulse');
    
    // Exclude ads and tracking elements
    const isAd = classStr.includes('ad') || classStr.includes('advertisement') ||
                classStr.includes('promo') || classStr.includes('banner') ||
                idStr.includes('ad') || classStr.includes('google') ||
                classStr.includes('facebook') || classStr.includes('twitter');
    
    // Exclude temporary UI states
    const isTemporaryState = classStr.includes('hover') || classStr.includes('focus') ||
                            classStr.includes('active') || classStr.includes('selected') ||
                            classStr.includes('highlighted');
    
    return !isModal && !isTransient && !isDynamic && !isAnimated && !isAd && !isTemporaryState;
  });
  
  // Create a more meaningful key that represents the core page state
  // Focus on stable elements that indicate real page structure changes
  const stableElements = coreElements.filter(el => {
    // Only include elements that are likely to be stable page structure
    return ['button', 'input', 'select', 'textarea', 'form', 'nav', 'header', 'main', 'section'].includes(el.type) ||
           (el.id && el.id.length > 2) || // Elements with meaningful IDs
           (el.text && el.text.trim().length > 3 && el.text.length < 100); // Elements with meaningful text
  });
  
  const key = [
    domState.url,
    domState.title,
    stableElements.length,
    // Include key element identifiers to detect real changes
    stableElements.slice(0, 15).map(el => {
      const identifier = el.id || el.class?.split(' ')[0] || el.type;
      const text = el.text ? el.text.substring(0, 20) : '';
      return `${el.type}-${identifier}-${text}`;
    }).join(',')
  ].join('-');
  
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    const char = key.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString();
}

/**
 * Main automation loop that executes AI-generated actions iteratively
 * @param {string} sessionId - The unique session identifier
 * @returns {Promise<void>}
 */
async function startAutomationLoop(sessionId) {
  const session = activeSessions.get(sessionId);
  if (!session || session.status !== 'running') return;
  
  session.iterationCount++;
  console.log(`Automation loop iteration ${session.iterationCount} for session ${sessionId}`);
  
  try {
    // Ensure content script is injected
    try {
      await chrome.scripting.executeScript({
        target: { tabId: session.tabId },
        files: ['content.js']
      });
    } catch (injectionError) {
      // Content script might already be injected, continue
      console.log('Content script injection skipped (might already exist)');
    }
    
    // Get current DOM state
    const domResponse = await chrome.tabs.sendMessage(session.tabId, {
      action: 'getDOM'
    });
    
    // Check if DOM response is valid
    if (!domResponse || !domResponse.success || !domResponse.structuredDOM) {
      throw new Error('Failed to get DOM state from content script. Response: ' + JSON.stringify(domResponse));
    }
    
    // Create hash of current DOM state
    const currentDOMHash = createDOMHash(domResponse.structuredDOM);
    const currentUrl = domResponse.structuredDOM.url;
    
    // Track URL changes
    let urlChanged = false;
    if (session.lastUrl) {
      urlChanged = currentUrl !== session.lastUrl;
      if (urlChanged) {
        session.urlHistory.push({
          url: currentUrl,
          timestamp: Date.now(),
          iteration: session.iterationCount
        });
        console.log(`URL changed from ${session.lastUrl} to ${currentUrl}`);
      }
    }
    session.lastUrl = currentUrl;
    
    // Check if DOM has changed since last iteration
    let domChanged = true;
    if (session.lastDOMHash) {
      domChanged = currentDOMHash !== session.lastDOMHash;
      if (!domChanged && !urlChanged) {
        // Smart stuck detection - consider recent action types
        const recentActions = session.actionHistory.slice(-3);
        const isTypingSequence = recentActions.length > 0 && 
          recentActions.every(action => ['type', 'clearInput', 'selectText', 'focus', 'blur', 'pressEnter', 'keyPress'].includes(action.tool));
        
        // Don't increment stuck counter for typing sequences unless they're repetitive
        if (isTypingSequence) {
          // Check if it's the same typing action repeated
          const lastAction = recentActions[recentActions.length - 1];
          const sameTypeRepeats = recentActions.filter(action => 
            action.tool === lastAction?.tool && 
            JSON.stringify(action.params) === JSON.stringify(lastAction?.params)
          ).length;
          
          if (sameTypeRepeats >= 2) {
            session.stuckCounter++;
            console.log(`Repetitive typing detected - stuck counter: ${session.stuckCounter}`);
          } else {
            console.log(`Typing sequence in progress - not counting as stuck`);
          }
        } else {
          session.stuckCounter++;
          console.log(`DOM and URL unchanged for ${session.stuckCounter} iterations`);
        }
        
        if (session.stuckCounter > 0) {
          automationLogger.logStuckDetection(sessionId, session.stuckCounter, session.actionHistory);
        }
      } else {
        session.stuckCounter = 0; // Reset counter on change
      }
    }
    session.lastDOMHash = currentDOMHash;
    
    // Log iteration details
    automationLogger.logIteration(sessionId, session.iterationCount, currentDOMHash, session.stuckCounter);
    
    // Store state history
    session.stateHistory.push({
      timestamp: Date.now(),
      url: domResponse.structuredDOM.url,
      domHash: currentDOMHash,
      elementCount: domResponse.structuredDOM.elements?.length || 0
    });
    
    // If stuck for too long, notify AI to try different approach
    const isStuck = session.stuckCounter >= 3;
    
    // Get settings for AI call using config
    const settings = await config.getAll();
    
    // Prepare context with action history and task plan
    const context = {
      actionHistory: session.actionHistory.slice(-10), // Last 10 actions
      isStuck,
      stuckCounter: session.stuckCounter,
      domChanged,
      urlChanged,
      failedAttempts: session.failedAttempts,
      iterationCount: session.iterationCount,
      urlHistory: session.urlHistory.slice(-5), // Last 5 URL changes
      currentUrl: currentUrl,
      // Add sequence repetition info
      repeatedSequences: Object.entries(session.sequenceRepeatCount)
        .filter(([_, count]) => count > 2)
        .map(([signature, count]) => ({ signature, count })),
      lastSequences: session.actionSequences.slice(-3), // Last 3 action sequences
      // Add current task plan to context
    };
    
    // Call AI to get next actions with context
    const aiResponse = await callAIAPI(
      session.task,
      domResponse.structuredDOM,
      settings,
      context
    );
    
    // Log AI response
    // automationLogger.logAIResponse(sessionId, aiResponse.reasoning, aiResponse.actions, aiResponse.taskComplete);
    automationLogger.logAIResponse(sessionId, '', aiResponse.actions, aiResponse.taskComplete); // Reasoning disabled for performance
    
    
    // Send dynamic status update to UI
    if (aiResponse.currentStep) {
      chrome.runtime.sendMessage({
        action: 'statusUpdate',
        sessionId,
        message: aiResponse.currentStep
      }).catch(() => {
        // Ignore errors if no listeners
      });
    }
    
    // Execute actions and track results
    if (aiResponse.actions && aiResponse.actions.length > 0) {
      // Create a smart signature for this action sequence
      const sequenceSignature = createSmartSequenceSignature(aiResponse.actions);
      
      // Track sequence repetition with context awareness
      const sequenceKey = `${sequenceSignature}:${domResponse.structuredDOM.url}`;
      if (!session.sequenceRepeatCount[sequenceKey]) {
        session.sequenceRepeatCount[sequenceKey] = 0;
      }
      session.sequenceRepeatCount[sequenceKey]++;
      
      // Check if this sequence has been repeated too many times
      const sequenceRepeats = session.sequenceRepeatCount[sequenceKey];
      const isHarmfulRepetition = checkHarmfulRepetition(aiResponse.actions, sequenceRepeats, session);
      
      if (isHarmfulRepetition) {
        console.warn(`Potentially harmful action sequence repeated ${sequenceRepeats} times: ${sequenceSignature}`);
        session.stuckCounter = Math.max(session.stuckCounter, 2); // Increase stuck counter but not too aggressively
      }
      
      // Add to sequence history
      session.actionSequences.push({
        signature: sequenceSignature,
        actions: aiResponse.actions,
        iteration: session.iterationCount,
        repeatCount: sequenceRepeats
      });
      
      for (let i = 0; i < aiResponse.actions.length; i++) {
        const action = aiResponse.actions[i];
        const nextAction = aiResponse.actions[i + 1];
        
        console.log(`Executing action ${i + 1}/${aiResponse.actions.length}: ${action.tool}`, action.params);
        
        // Send action-specific status update to UI
        if (action.description) {
          chrome.runtime.sendMessage({
            action: 'statusUpdate',
            sessionId,
            message: action.description
          }).catch(() => {
            // Ignore errors if no listeners
          });
        }
        
        const actionResult = await chrome.tabs.sendMessage(session.tabId, {
          action: 'executeAction',
          tool: action.tool,
          params: action.params
        });
        
        // Track action in history
        const actionRecord = {
          timestamp: Date.now(),
          tool: action.tool,
          params: action.params,
          result: actionResult,
          iteration: session.iterationCount
        };
        session.actionHistory.push(actionRecord);
        
        // Log action result
        automationLogger.logAction(sessionId, action, actionResult);
        
        // Track failures
        if (!actionResult?.success) {
          if (!session.failedAttempts[action.tool]) {
            session.failedAttempts[action.tool] = 0;
          }
          session.failedAttempts[action.tool]++;
          console.warn(`Action failed: ${action.tool}`, actionResult?.error);
        }
        
        // Smart delay calculation based on action types
        if (i < aiResponse.actions.length - 1) { // Don't delay after the last action
          const delay = calculateActionDelay(action, nextAction);
          console.log(`Waiting ${delay}ms before next action`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    
    // Check if we're stuck in a loop
    if (session.stuckCounter >= 5) {
      console.error('Automation appears stuck - stopping');
      session.status = 'stuck';
      session.error = 'Automation stuck in loop - no progress after 5 attempts';
      activeSessions.delete(sessionId);
      
      // Notify UI
      chrome.runtime.sendMessage({
        action: 'automationError',
        sessionId,
        error: session.error
      });
      return;
    }
    
    // VERIFICATION ENFORCEMENT: Check for premature completion
    if (aiResponse.taskComplete) {
      // Check if AI is trying to complete task while still running verification actions
      const hasVerificationActions = aiResponse.actions && aiResponse.actions.some(action => 
        action.tool === 'getText' || 
        action.tool === 'getAttribute' ||
        action.tool === 'waitForElement' ||
        (action.description && action.description.toLowerCase().includes('verif'))
      );
      
      // If AI claims completion but is still verifying, don't complete yet
      if (hasVerificationActions) {
        console.warn('⚠️ AI claimed taskComplete=true but still running verification actions. Continuing automation...');
        automationLogger.logWarning(sessionId, 'Premature completion blocked - verification actions still running');
        aiResponse.taskComplete = false; // Override the AI's decision
      }
      
      // Require result evidence for completion
      if (!aiResponse.result || aiResponse.result.length < 10) {
        console.warn('⚠️ AI claimed taskComplete=true but provided insufficient result evidence. Continuing automation...');
        automationLogger.logWarning(sessionId, 'Premature completion blocked - insufficient result evidence');
        aiResponse.taskComplete = false; // Override the AI's decision
      }
    }
    
    // Check if task is complete (after verification enforcement)
    if (aiResponse.taskComplete) {
      session.status = 'completed';
      const duration = Date.now() - session.startTime;
      
      automationLogger.logSessionEnd(sessionId, 'completed', session.actionHistory.length, duration);
      console.log('Task completed successfully');
      console.log('Total actions executed:', session.actionHistory.length);
      
      activeSessions.delete(sessionId);
      
      // Notify popup
      chrome.runtime.sendMessage({
        action: 'automationComplete',
        sessionId,
        result: aiResponse.result
      });
    } else {
      // Dynamic delay based on stuck counter
      const delay = session.stuckCounter > 0 ? 
        Math.min(2000 * Math.pow(1.5, session.stuckCounter), 10000) : // Exponential backoff up to 10s
        2000; // Normal 2s delay
      
      console.log(`Continuing loop in ${delay}ms`);
      setTimeout(() => startAutomationLoop(sessionId), delay);
    }
    
  } catch (error) {
    console.error('Automation loop error:', error);
    session.status = 'error';
    session.error = error.message;
    
    // Notify UI about error
    chrome.runtime.sendMessage({
      action: 'automationError',
      sessionId,
      error: error.message
    });
  }
}

/**
 * Calls the xAI Grok-3-mini API to generate automation actions
 * @param {string} task - The task description in natural language
 * @param {Object} structuredDOM - The structured DOM representation
 * @param {Object} settings - Extension settings including API key
 * @param {Object|null} context - Optional context for stuck detection and history
 * @returns {Promise<Object>} AI response with actions and completion status
 */
async function callAIAPI(task, structuredDOM, settings, context = null) {
  try {
    // Get settings if not provided
    if (!settings) {
      settings = await config.getAll();
    }
    
    // Check if appropriate API key is configured
    const provider = settings.modelProvider || 'xai';
    if (provider === 'gemini' && !settings.geminiApiKey) {
      throw new Error('Gemini API key not configured. Please set it in extension settings.');
    } else if (provider === 'xai' && !settings.apiKey) {
      throw new Error('xAI API key not configured. Please set it in extension settings.');
    }
    
    // Create AI integration instance (now available via importScripts)
    const ai = new AIIntegration(settings);
    
    // Get automation actions from Grok-3-mini with context
    const result = await ai.getAutomationActions(task, structuredDOM, context);
    
    return result;
    
  } catch (error) {
    console.error('xAI Grok-3-mini API error:', error);
    
    // Return fallback response for testing
    return {
      actions: [],
      taskComplete: false,
      // reasoning: `Error: ${error.message}`,
      reasoning: '', // Disabled for performance
      error: true
    };
  }
}

// Handle usage tracking from all contexts
function handleTrackUsage(request, sender, sendResponse) {
  console.log('Background: handleTrackUsage called');
  
  // Initialize analytics if not already done
  const analytics = initializeAnalytics();
  
  const { model, inputTokens, outputTokens, success, tokenSource, timestamp } = request.data;
  
  console.log('Background: Received tracking request:', {
    model,
    inputTokens,
    outputTokens,
    success,
    tokenSource,
    timestamp,
    context: sender.tab ? 'content' : 'extension',
    senderId: sender.id
  });
  
  // Track the usage and handle response
  analytics.trackUsage(model, inputTokens, outputTokens, success)
    .then(() => {
      // Broadcast update to all extension contexts
      broadcastAnalyticsUpdate();
      
      console.log('Background: Usage tracking completed successfully');
      sendResponse({ success: true, message: 'Usage tracked successfully' });
    })
    .catch((error) => {
      console.error('Background: Failed to handle usage tracking:', error);
      sendResponse({ success: false, error: error.message });
    });
  
  // Return true to indicate async response
  return true;
}

// Broadcast analytics updates to all extension contexts
function broadcastAnalyticsUpdate() {
  // Send to all extension contexts (popup, sidepanel, options)
  chrome.runtime.sendMessage({
    type: 'ANALYTICS_UPDATE'
  }).catch(() => {
    // Ignore errors if no listeners
  });
}

// Handle action (icon) clicks - open global side panel
chrome.action.onClicked.addListener(async (tab) => {
  console.log('Extension icon clicked - opening global side panel');
  
  // Open global side panel for the entire browser window
  try {
    await chrome.sidePanel.open({ windowId: tab.windowId });
    console.log('Global side panel opened successfully');
  } catch (error) {
    console.error('Failed to open global side panel:', error);
    // Fallback to popup window if side panel fails
    chrome.windows.create({
      url: chrome.runtime.getURL('popup.html'),
      type: 'popup',
      width: 400,
      height: 600
    });
  }
});

// Set up side panel behavior
chrome.runtime.onInstalled.addListener(async () => {
  console.log('FSB v0.1 installed');
  
  // Initialize analytics
  initializeAnalytics();
  
  // Set default UI mode if not set
  const { uiMode } = await chrome.storage.local.get(['uiMode']);
  if (!uiMode) {
    await chrome.storage.local.set({ uiMode: 'sidepanel' });
    console.log('Default UI mode set to sidepanel');
  }
  
  // Configure side panel to open automatically on action click
  try {
    await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
    console.log('Side panel behavior configured for automatic opening');
  } catch (error) {
    console.log('Side panel API not available (Chrome < 114)');
  }
});

// Initialize analytics on startup
chrome.runtime.onStartup.addListener(() => {
  console.log('FSB service worker starting up');
  initializeAnalytics();
});