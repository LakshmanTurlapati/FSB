// Background service worker for FSB v0.1

// Import configuration and AI integration modules
importScripts('config.js');
importScripts('init-config.js');
importScripts('ai-integration.js');
importScripts('automation-logger.js');
importScripts('analytics.js');
importScripts('keyboard-emulator.js');

// Store for active automation sessions
let activeSessions = new Map();

// Global analytics instance
let globalAnalytics = null;

// Content script communication health tracking
let contentScriptHealth = new Map();

// Performance monitoring
const performanceMetrics = {
  sessionStats: new Map(),
  globalStats: {
    totalSessions: 0,
    successfulSessions: 0,
    totalActions: 0,
    successfulActions: 0,
    averageIterationsPerSession: 0,
    averageTimePerSession: 0,
    communicationFailures: 0,
    alternativeActionsUsed: 0
  }
};

// Failure classification system
const FAILURE_TYPES = {
  COMMUNICATION: 'communication',
  DOM: 'dom',
  SELECTOR: 'selector',
  NETWORK: 'network',
  TIMEOUT: 'timeout',
  PERMISSION: 'permission'
};

const RETRY_STRATEGIES = {
  [FAILURE_TYPES.COMMUNICATION]: 'reconnect_retry',
  [FAILURE_TYPES.DOM]: 'wait_retry',
  [FAILURE_TYPES.SELECTOR]: 'alternative_selector',
  [FAILURE_TYPES.NETWORK]: 'exponential_backoff',
  [FAILURE_TYPES.TIMEOUT]: 'increase_timeout',
  [FAILURE_TYPES.PERMISSION]: 'skip_action'
};

// Helper function to check if URL is restricted for content script access
function isRestrictedURL(url) {
  if (!url) return true;
  
  const restrictedProtocols = [
    'chrome://',
    'chrome-extension://',
    'moz-extension://',
    'edge://',
    'about:',
    'file://'
  ];
  
  const restrictedPages = [
    'chrome://extensions/',
    'chrome://settings/',
    'chrome://newtab/',
    'chrome://history/',
    'chrome://bookmarks/',
    'chrome://downloads/',
    'chrome://flags/',
    'chrome://version/',
    'chrome://webstore/',
    'edge://extensions/',
    'edge://settings/',
    'about:blank',
    'about:newtab'
  ];
  
  // Check exact matches first
  if (restrictedPages.some(page => url.startsWith(page))) {
    return true;
  }
  
  // Check protocol restrictions
  return restrictedProtocols.some(protocol => url.startsWith(protocol));
}

// Get user-friendly page type description
function getPageTypeDescription(url) {
  if (url.startsWith('chrome://')) return 'Chrome internal page';
  if (url.startsWith('chrome-extension://')) return 'Chrome extension page';
  if (url.startsWith('edge://')) return 'Edge internal page';
  if (url.startsWith('about:')) return 'Browser internal page';
  if (url.startsWith('file://')) return 'Local file';
  return 'Restricted page';
}

// Content script health monitoring
async function checkContentScriptHealth(tabId) {
  try {
    const response = await chrome.tabs.sendMessage(tabId, {
      action: 'healthCheck'
    });
    
    if (response && response.success) {
      contentScriptHealth.set(tabId, {
        lastCheck: Date.now(),
        healthy: true,
        failures: 0
      });
      return true;
    }
  } catch (error) {
    const health = contentScriptHealth.get(tabId) || { failures: 0 };
    health.lastCheck = Date.now();
    health.healthy = false;
    health.failures++;
    contentScriptHealth.set(tabId, health);
    return false;
  }
  return false;
}

// Enhanced content script injection with retry logic
async function ensureContentScriptInjected(tabId, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // First check if content script is already healthy
      const isHealthy = await checkContentScriptHealth(tabId);
      if (isHealthy) {
        console.log(`[FSB] Content script already healthy in tab ${tabId}`);
        return true;
      }
      
      // Inject content script
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['content.js']
      });
      
      // Wait a bit for injection to complete
      await new Promise(resolve => setTimeout(resolve, 100 * attempt));
      
      // Check health after injection
      const healthAfterInjection = await checkContentScriptHealth(tabId);
      if (healthAfterInjection) {
        console.log(`[FSB] Content script successfully injected and healthy in tab ${tabId} (attempt ${attempt})`);
        return true;
      }
      
    } catch (error) {
      console.warn(`[FSB] Content script injection attempt ${attempt} failed:`, error);
      if (attempt === maxRetries) {
        throw new Error(`Failed to inject content script after ${maxRetries} attempts: ${error.message}`);
      }
      // Exponential backoff between retries
      await new Promise(resolve => setTimeout(resolve, 200 * Math.pow(2, attempt - 1)));
    }
  }
  return false;
}

// Classify failure type based on error message and context
function classifyFailure(error, action, context = {}) {
  const errorMessage = (error.message || error || '').toLowerCase();
  
  // Communication failures
  if (errorMessage.includes('could not establish connection') ||
      errorMessage.includes('receiving end does not exist') ||
      errorMessage.includes('message port closed') ||
      errorMessage.includes('no tab with id') ||
      errorMessage.includes('cannot access') ||
      errorMessage.includes('communication failure')) {
    return FAILURE_TYPES.COMMUNICATION;
  }
  
  // DOM/Selector failures
  if (errorMessage.includes('element not found') ||
      errorMessage.includes('selector') ||
      errorMessage.includes('not visible') ||
      errorMessage.includes('not interactable')) {
    return FAILURE_TYPES.SELECTOR;
  }
  
  // Timeout failures
  if (errorMessage.includes('timeout') ||
      errorMessage.includes('timed out')) {
    return FAILURE_TYPES.TIMEOUT;
  }
  
  // Network failures
  if (errorMessage.includes('network') ||
      errorMessage.includes('connection') ||
      errorMessage.includes('fetch')) {
    return FAILURE_TYPES.NETWORK;
  }
  
  // Permission failures
  if (errorMessage.includes('permission') ||
      errorMessage.includes('restricted') ||
      errorMessage.includes('chrome://') ||
      errorMessage.includes('cannot execute')) {
    return FAILURE_TYPES.PERMISSION;
  }
  
  // Default to communication for unknown errors
  return FAILURE_TYPES.COMMUNICATION;
}

// Enhanced message sending with automatic retry and fallback
async function sendMessageWithRetry(tabId, message, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Check content script health first
      if (attempt === 1) {
        const isHealthy = await checkContentScriptHealth(tabId);
        if (!isHealthy) {
          console.log(`[FSB] Content script unhealthy, re-injecting...`);
          await ensureContentScriptInjected(tabId);
        }
      }
      
      const response = await chrome.tabs.sendMessage(tabId, message);
      
      // Success - reset health tracking
      contentScriptHealth.set(tabId, {
        lastCheck: Date.now(),
        healthy: true,
        failures: 0
      });
      
      return response;
      
    } catch (error) {
      const failureType = classifyFailure(error, message);
      console.warn(`[FSB] Message sending attempt ${attempt} failed (${failureType}):`, error.message);
      
      // Update health tracking
      const health = contentScriptHealth.get(tabId) || { failures: 0 };
      health.failures++;
      health.healthy = false;
      health.lastCheck = Date.now();
      contentScriptHealth.set(tabId, health);
      
      if (attempt === maxRetries) {
        throw {
          originalError: error,
          failureType,
          attempts: maxRetries,
          message: `Failed after ${maxRetries} attempts: ${error.message}`
        };
      }
      
      // Apply failure-specific retry strategy
      if (failureType === FAILURE_TYPES.COMMUNICATION) {
        console.log(`[FSB] Re-injecting content script for communication failure`);
        await ensureContentScriptInjected(tabId);
      } else {
        // For other failures, wait progressively longer
        const delay = 200 * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
}

// Alternative action strategies for failed operations
async function tryAlternativeAction(sessionId, originalAction, originalError) {
  const session = activeSessions.get(sessionId);
  if (!session) return null;
  
  const { tool, params } = originalAction;
  const alternatives = [];
  
  // Type action alternatives
  if (tool === 'type') {
    alternatives.push(
      // Try clicking first, then typing
      { tool: 'click', params: { selector: params.selector }, description: `Click element before typing` },
      // Try focus + clear + type
      { tool: 'focus', params: { selector: params.selector }, description: `Focus element before typing` },
      { tool: 'clearInput', params: { selector: params.selector }, description: `Clear input before typing` },
      { tool: 'type', params: { ...params, slow: true }, description: `Type slowly with delays` },
      // Try keyboard events instead
      { tool: 'keyPress', params: { selector: params.selector, key: params.text }, description: `Use keyboard events instead of typing` }
    );
  }
  
  // Click action alternatives
  if (tool === 'click') {
    alternatives.push(
      // Try different click methods
      { tool: 'doubleClick', params, description: `Try double-click instead` },
      { tool: 'rightClick', params, description: `Try right-click to trigger context` },
      // Try hovering first
      { tool: 'hover', params, description: `Hover before clicking` },
      { tool: 'click', params: { ...params, forceClick: true }, description: `Force click ignoring visibility` }
    );
  }
  
  // Selector alternatives for any action with selector
  if (params.selector && originalError.failureType === FAILURE_TYPES.SELECTOR) {
    const baseSelector = params.selector;
    const selectorAlternatives = generateAlternativeSelectors(baseSelector);
    
    for (const altSelector of selectorAlternatives) {
      alternatives.push({
        tool,
        params: { ...params, selector: altSelector },
        description: `Try alternative selector: ${altSelector.substring(0, 30)}...`
      });
    }
  }
  
  // Execute alternatives one by one
  for (const alternative of alternatives.slice(0, 3)) { // Limit to 3 alternatives
    try {
      console.log(`[FSB] Trying alternative action: ${alternative.description}`);
      
      const result = await sendMessageWithRetry(session.tabId, {
        action: 'executeAction',
        tool: alternative.tool,
        params: alternative.params
      });
      
      if (result && result.success) {
        console.log(`[FSB] Alternative action succeeded: ${alternative.description}`);
        return {
          success: true,
          result: result.result,
          alternativeUsed: alternative.description,
          originalError: originalError.error
        };
      }
    } catch (error) {
      console.warn(`[FSB] Alternative action failed: ${alternative.description}`, error);
      continue;
    }
  }
  
  return null; // No alternatives worked
}

// Generate alternative selectors for failed selector queries
function generateAlternativeSelectors(originalSelector) {
  const alternatives = [];
  
  // If it's an ID selector, try class-based alternatives
  if (originalSelector.startsWith('#')) {
    const id = originalSelector.substring(1);
    alternatives.push(
      `[id="${id}"]`,
      `*[id*="${id}"]`,
      `[id^="${id}"]`,
      `[id$="${id}"]`
    );
  }
  
  // If it's a class selector, try attribute alternatives
  if (originalSelector.startsWith('.')) {
    const className = originalSelector.substring(1);
    alternatives.push(
      `[class*="${className}"]`,
      `[class^="${className}"]`, 
      `[class$="${className}"]`
    );
  }
  
  // Try data attribute alternatives
  alternatives.push(
    `[data-testid*="${originalSelector.replace(/[#.]/g, '')}"]`,
    `[aria-label*="${originalSelector.replace(/[#.]/g, '')}"]`,
    `[name*="${originalSelector.replace(/[#.]/g, '')}"]`,
    `[title*="${originalSelector.replace(/[#.]/g, '')}"]`
  );
  
  // Try partial matches
  if (originalSelector.includes('[') && originalSelector.includes('=')) {
    const attrMatch = originalSelector.match(/\[([^=]+)="([^"]+)"\]/);
    if (attrMatch) {
      const [, attr, value] = attrMatch;
      alternatives.push(
        `[${attr}*="${value}"]`,
        `[${attr}^="${value}"]`,
        `[${attr}$="${value}"]`,
        `[${attr}~="${value}"]`
      );
    }
  }
  
  return alternatives.slice(0, 5); // Limit alternatives
}

// Enhanced stuck detection with pattern recognition
function analyzeStuckPatterns(session) {
  const recentActions = session.actionHistory.slice(-10); // Look at last 10 actions
  const patterns = {
    repetitiveActions: false,
    cyclingBetweenStates: false,
    failingOnSameElement: false,
    noProgressMade: false,
    severity: 'low'
  };
  
  if (recentActions.length < 3) return patterns;
  
  // Check for repetitive actions (same action/params repeated)
  const actionGroups = {};
  recentActions.forEach(action => {
    const key = `${action.tool}_${JSON.stringify(action.params)}`;
    actionGroups[key] = (actionGroups[key] || 0) + 1;
  });
  
  const maxRepeats = Math.max(...Object.values(actionGroups));
  if (maxRepeats >= 3) {
    patterns.repetitiveActions = true;
    patterns.severity = 'high';
  }
  
  // Check for cycling between different states
  const domHashes = session.stateHistory.slice(-5).map(state => state.domHash);
  const uniqueHashes = new Set(domHashes);
  if (uniqueHashes.size <= 2 && domHashes.length >= 4) {
    patterns.cyclingBetweenStates = true;
    patterns.severity = Math.max(patterns.severity, 'medium');
  }
  
  // Check for failing on same elements
  const failedSelectors = recentActions
    .filter(action => !action.result?.success && action.params?.selector)
    .map(action => action.params.selector);
  
  if (failedSelectors.length >= 3) {
    const selectorCounts = {};
    failedSelectors.forEach(selector => {
      selectorCounts[selector] = (selectorCounts[selector] || 0) + 1;
    });
    
    if (Math.max(...Object.values(selectorCounts)) >= 2) {
      patterns.failingOnSameElement = true;
      patterns.severity = 'high';
    }
  }
  
  // Check for overall lack of progress
  const recentSuccesses = recentActions.filter(action => action.result?.success).length;
  if (recentSuccesses / recentActions.length < 0.3) { // Less than 30% success rate
    patterns.noProgressMade = true;
    patterns.severity = 'high';
  }
  
  return patterns;
}

// Generate recovery strategies based on stuck patterns
function generateRecoveryStrategies(patterns, session) {
  const strategies = [];
  
  if (patterns.repetitiveActions) {
    strategies.push({
      type: 'break_repetition',
      description: 'Switch to alternative approach to break repetitive loop',
      priority: 'high'
    });
  }
  
  if (patterns.cyclingBetweenStates) {
    strategies.push({
      type: 'reset_state',
      description: 'Navigate to different page or refresh to reset state',
      priority: 'medium'
    });
  }
  
  if (patterns.failingOnSameElement) {
    strategies.push({
      type: 'alternative_selectors',
      description: 'Use completely different element selection strategy',
      priority: 'high'
    });
  }
  
  if (patterns.noProgressMade) {
    strategies.push({
      type: 'change_approach',
      description: 'Fundamentally change approach (e.g., use Google search instead of direct interaction)',
      priority: 'high'
    });
  }
  
  return strategies.sort((a, b) => {
    const priorityOrder = { high: 3, medium: 2, low: 1 };
    return priorityOrder[b.priority] - priorityOrder[a.priority];
  });
}

// Performance monitoring functions
function initializeSessionMetrics(sessionId) {
  performanceMetrics.sessionStats.set(sessionId, {
    startTime: Date.now(),
    endTime: null,
    totalActions: 0,
    successfulActions: 0,
    failedActions: 0,
    communicationFailures: 0,
    alternativeActionsUsed: 0,
    iterations: 0,
    stuckEvents: 0,
    domStabilityWaits: 0,
    averageActionTime: 0,
    actionTimes: []
  });
  
  performanceMetrics.globalStats.totalSessions++;
}

function trackActionPerformance(sessionId, action, result, startTime, alternativeUsed = false) {
  const sessionStats = performanceMetrics.sessionStats.get(sessionId);
  if (!sessionStats) return;
  
  const actionTime = Date.now() - startTime;
  sessionStats.actionTimes.push(actionTime);
  sessionStats.totalActions++;
  performanceMetrics.globalStats.totalActions++;
  
  if (result.success) {
    sessionStats.successfulActions++;
    performanceMetrics.globalStats.successfulActions++;
  } else {
    sessionStats.failedActions++;
    if (result.failureType === FAILURE_TYPES.COMMUNICATION) {
      sessionStats.communicationFailures++;
      performanceMetrics.globalStats.communicationFailures++;
    }
  }
  
  if (alternativeUsed) {
    sessionStats.alternativeActionsUsed++;
    performanceMetrics.globalStats.alternativeActionsUsed++;
  }
  
  // Update average action time
  sessionStats.averageActionTime = sessionStats.actionTimes.reduce((a, b) => a + b, 0) / sessionStats.actionTimes.length;
}

function finalizeSessionMetrics(sessionId, successful = false) {
  const sessionStats = performanceMetrics.sessionStats.get(sessionId);
  if (!sessionStats) return;
  
  sessionStats.endTime = Date.now();
  const sessionDuration = sessionStats.endTime - sessionStats.startTime;
  
  if (successful) {
    performanceMetrics.globalStats.successfulSessions++;
  }
  
  // Update global averages
  const allSessions = Array.from(performanceMetrics.sessionStats.values());
  const completedSessions = allSessions.filter(s => s.endTime !== null);
  
  if (completedSessions.length > 0) {
    const totalIterations = completedSessions.reduce((sum, s) => sum + s.iterations, 0);
    const totalDuration = completedSessions.reduce((sum, s) => sum + (s.endTime - s.startTime), 0);
    
    performanceMetrics.globalStats.averageIterationsPerSession = totalIterations / completedSessions.length;
    performanceMetrics.globalStats.averageTimePerSession = totalDuration / completedSessions.length;
  }
  
  console.log(`[FSB Performance] Session ${sessionId} completed:`, {
    duration: sessionDuration,
    iterations: sessionStats.iterations,
    actions: sessionStats.totalActions,
    successRate: (sessionStats.successfulActions / sessionStats.totalActions * 100).toFixed(1) + '%',
    avgActionTime: sessionStats.averageActionTime.toFixed(0) + 'ms',
    communicationFailures: sessionStats.communicationFailures,
    alternativeActionsUsed: sessionStats.alternativeActionsUsed
  });
}

function getPerformanceReport() {
  const global = performanceMetrics.globalStats;
  const actionSuccessRate = global.totalActions > 0 ? (global.successfulActions / global.totalActions * 100) : 0;
  const sessionSuccessRate = global.totalSessions > 0 ? (global.successfulSessions / global.totalSessions * 100) : 0;
  
  return {
    summary: {
      totalSessions: global.totalSessions,
      sessionSuccessRate: sessionSuccessRate.toFixed(1) + '%',
      totalActions: global.totalActions,
      actionSuccessRate: actionSuccessRate.toFixed(1) + '%',
      averageIterationsPerSession: global.averageIterationsPerSession.toFixed(1),
      averageTimePerSession: (global.averageTimePerSession / 1000).toFixed(1) + 's'
    },
    issues: {
      communicationFailures: global.communicationFailures,
      alternativeActionsNeeded: global.alternativeActionsUsed,
      communicationFailureRate: global.totalActions > 0 ? (global.communicationFailures / global.totalActions * 100).toFixed(1) + '%' : '0%'
    },
    recommendations: generatePerformanceRecommendations()
  };
}

function generatePerformanceRecommendations() {
  const global = performanceMetrics.globalStats;
  const recommendations = [];
  
  if (global.totalActions > 0) {
    const commFailureRate = global.communicationFailures / global.totalActions;
    if (commFailureRate > 0.3) {
      recommendations.push('High communication failure rate detected. Consider improving content script stability.');
    }
    
    const altActionRate = global.alternativeActionsUsed / global.totalActions;
    if (altActionRate > 0.2) {
      recommendations.push('High alternative action usage. Consider improving initial selector accuracy.');
    }
    
    if (global.averageIterationsPerSession > 20) {
      recommendations.push('High iteration count per session. Consider improving stuck detection and recovery.');
    }
  }
  
  if (recommendations.length === 0) {
    recommendations.push('Performance looks good! No issues detected.');
  }
  
  return recommendations;
}

// Smart navigation: Analyze task and determine best website to navigate to
function analyzeTaskAndGetTargetUrl(task) {
  const taskLower = task.toLowerCase();
  
  // Email-related tasks
  if (taskLower.includes('email') || taskLower.includes('gmail') || taskLower.includes('mail')) {
    return 'https://gmail.com';
  }
  
  // Social media tasks
  if (taskLower.includes('twitter') || taskLower.includes('tweet')) {
    return 'https://twitter.com';
  }
  if (taskLower.includes('facebook') || taskLower.includes('fb')) {
    return 'https://facebook.com';
  }
  if (taskLower.includes('linkedin')) {
    return 'https://linkedin.com';
  }
  if (taskLower.includes('instagram')) {
    return 'https://instagram.com';
  }
  
  // Video/Entertainment
  if (taskLower.includes('youtube') || taskLower.includes('video') || taskLower.includes('watch')) {
    return 'https://youtube.com';
  }
  if (taskLower.includes('netflix')) {
    return 'https://netflix.com';
  }
  
  // Music
  if (taskLower.includes('spotify') || taskLower.includes('music') || taskLower.includes('song') || taskLower.includes('play')) {
    return 'https://spotify.com';
  }
  
  // Shopping
  if (taskLower.includes('amazon') || taskLower.includes('shop') || taskLower.includes('buy')) {
    return 'https://amazon.com';
  }
  
  // News
  if (taskLower.includes('news') || taskLower.includes('article')) {
    return 'https://news.google.com';
  }
  
  // Development/GitHub
  if (taskLower.includes('github') || taskLower.includes('repository') || taskLower.includes('repo')) {
    return 'https://github.com';
  }
  
  // Wikipedia/Information
  if (taskLower.includes('wikipedia') || taskLower.includes('wiki') || taskLower.includes('information about') || taskLower.includes('learn about')) {
    return 'https://wikipedia.org';
  }
  
  // Maps/Navigation
  if (taskLower.includes('map') || taskLower.includes('direction') || taskLower.includes('navigate to')) {
    return 'https://maps.google.com';
  }
  
  // Weather
  if (taskLower.includes('weather') || taskLower.includes('forecast')) {
    return 'https://weather.com';
  }
  
  // Chat/Communication
  if (taskLower.includes('discord')) {
    return 'https://discord.com';
  }
  if (taskLower.includes('slack')) {
    return 'https://slack.com';
  }
  if (taskLower.includes('whatsapp')) {
    return 'https://web.whatsapp.com';
  }
  
  // Cloud Storage
  if (taskLower.includes('drive') || taskLower.includes('google drive')) {
    return 'https://drive.google.com';
  }
  if (taskLower.includes('dropbox')) {
    return 'https://dropbox.com';
  }
  
  // Productivity
  if (taskLower.includes('docs') || taskLower.includes('document')) {
    return 'https://docs.google.com';
  }
  if (taskLower.includes('sheets') || taskLower.includes('spreadsheet')) {
    return 'https://sheets.google.com';
  }
  
  // For search-related tasks or fallback, use Google
  if (taskLower.includes('search') || taskLower.includes('find') || taskLower.includes('look for') || taskLower.includes('google')) {
    return 'https://google.com';
  }
  
  // Default fallback - Google for general queries
  return 'https://google.com';
}

// Check if we should attempt smart navigation
function shouldUseSmartNavigation(url, task) {
  if (!isRestrictedURL(url)) {
    return false; // Not on a restricted page
  }
  
  // Only use smart navigation for chrome://newtab and about:blank
  // Don't navigate away from settings, extensions, etc.
  const navigablePages = [
    'chrome://newtab/',
    'about:blank',
    'chrome://newtab',
    'about:newtab'
  ];
  
  return navigablePages.some(page => url.startsWith(page));
}

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

/**
 * Validates if a result is meaningful based on task context
 * @param {string} result - The result to validate
 * @param {string} task - The original task
 * @returns {boolean} True if result is valid and meaningful
 */
function isValidResult(result, task) {
  // Handle null/undefined
  if (!result || result === null || result === undefined) {
    return false;
  }
  
  // Convert to string for analysis
  const resultStr = String(result).trim();
  
  // Empty results or placeholder text are invalid
  if (resultStr === '' || resultStr === 'null' || resultStr === 'undefined') {
    return false;
  }
  
  // Reject generic placeholder messages
  const genericMessages = [
    'task completed',
    'task completed successfully', 
    'completed successfully',
    'done',
    'finished',
    'success',
    'completed',
    'found it',
    'found the information',
    'extracted the data'
  ];
  
  const resultLower = resultStr.toLowerCase();
  if (genericMessages.some(msg => resultLower === msg || resultLower === msg + '.')) {
    return false;
  }
  
  // Accept any result that is reasonably detailed (shows AI provided context)
  // This is much more permissive than the old validation
  if (resultStr.length >= 15) {
    // Check if it contains meaningful content words (not just filler)
    const meaningfulWords = resultStr.match(/\b\w{3,}\b/g) || [];
    return meaningfulWords.length >= 3; // At least 3 meaningful words
  }
  
  // For shorter results, be more flexible - accept if it has specific data patterns
  // Numbers, currency, percentages, URLs, etc.
  const hasSpecificData = /(\d+\.?\d*|\$|%|https?:\/\/|@|#|\w+\.\w+)/.test(resultStr);
  if (hasSpecificData && resultStr.length >= 5) {
    return true;
  }
  
  // Accept if it looks like extracted data (has quotes, colons, specific formats)
  const hasDataFormat = /(["'].*["']|:\s*\w+|\w+:\s*\w+|\d+\s*(USD|EUR|BTC|°F|°C|%))/.test(resultStr);
  if (hasDataFormat) {
    return true;
  }
  
  // Default: accept anything with reasonable length and multiple words
  const wordCount = (resultStr.match(/\b\w+\b/g) || []).length;
  return wordCount >= 2 && resultStr.length >= 8;
}

/**
 * Creates a unique signature for an action based on tool and key parameters
 * @param {Object} action - The action object
 * @returns {string} A unique signature for the action
 */
function createActionSignature(action) {
  // Create a signature that uniquely identifies this action
  const tool = action.tool || '';
  const params = action.params || {};
  
  // For most actions, the selector is the key differentiator
  if (params.selector) {
    return `${tool}:${params.selector}`;
  }
  
  // For navigation actions, use the URL
  if (params.url) {
    return `${tool}:${params.url}`;
  }
  
  // For type actions, include the text (truncated)
  if (tool === 'type' && params.text) {
    const textPreview = params.text.substring(0, 20);
    return `${tool}:${params.selector || 'unknown'}:${textPreview}`;
  }
  
  // For other actions, create a simple hash of params
  const paramsStr = JSON.stringify(params);
  return `${tool}:${simpleHash(paramsStr)}`;
}

/**
 * Simple hash function for creating signatures
 * @param {string} str - String to hash
 * @returns {number} Hash value
 */
function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

/**
 * Detects if specific actions have failed repeatedly
 * @param {Object} session - The automation session
 * @returns {Array} Array of actions that need alternative strategies
 */
function detectRepeatedActionFailures(session) {
  const repeatedFailures = [];
  
  // Check each failed action
  for (const [signature, details] of Object.entries(session.failedActionDetails)) {
    // If an action has failed 2 or more times, it needs an alternative strategy
    if (details.count >= 2) {
      repeatedFailures.push({
        signature,
        tool: details.tool,
        params: details.params,
        failureCount: details.count,
        lastError: details.errors[details.errors.length - 1]?.error || 'Unknown error',
        allErrors: details.errors.map(e => e.error),
        timeSinceFirstFailure: Date.now() - details.firstFailure
      });
    }
  }
  
  return repeatedFailures;
}

/**
 * Detects if the same valid result has been extracted multiple times
 * @param {Object} session - The automation session
 * @returns {string|null} The repeated result if found, null otherwise
 */
function detectRepeatedSuccess(session) {
  // Look at recent getText actions
  const recentTextActions = session.actionHistory
    .filter(action => action.tool === 'getText' && action.result?.success && action.result?.value)
    .slice(-10); // Last 10 successful getText actions
  
  if (recentTextActions.length < 3) {
    return null; // Not enough data
  }
  
  // Count occurrences of each result
  const resultCounts = {};
  recentTextActions.forEach(action => {
    const value = String(action.result.value).trim();
    if (value && value !== 'null' && value !== 'undefined') {
      resultCounts[value] = (resultCounts[value] || 0) + 1;
    }
  });
  
  // Find results that appear at least 3 times
  for (const [result, count] of Object.entries(resultCounts)) {
    if (count >= 3 && isValidResult(result, session.task)) {
      console.log(`Found repeated valid result: "${result}" (appeared ${count} times)`);
      return result;
    }
  }
  
  // Also check for similar results (e.g., same number with different formatting)
  const numericResults = recentTextActions
    .map(action => {
      const value = String(action.result.value).trim();
      const numMatch = value.match(/(\d+\.?\d*)/);
      return numMatch ? parseFloat(numMatch[1]) : null;
    })
    .filter(num => num !== null);
  
  if (numericResults.length >= 3) {
    // Check if the same number appears multiple times
    const numCounts = {};
    numericResults.forEach(num => {
      numCounts[num] = (numCounts[num] || 0) + 1;
    });
    
    for (const [num, count] of Object.entries(numCounts)) {
      if (count >= 3) {
        console.log(`Found repeated numeric result: ${num} (appeared ${count} times)`);
        return String(num);
      }
    }
  }
  
  return null;
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
      
    case 'getPerformanceReport':
      const report = getPerformanceReport();
      sendResponse({ success: true, report });
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
      
    // Multi-tab management actions
    case 'openNewTab':
      handleOpenNewTab(request, sender, sendResponse);
      return true; // Will respond asynchronously
      
    case 'switchToTab':
      handleSwitchToTab(request, sender, sendResponse);
      return true; // Will respond asynchronously
      
    case 'closeTab':
      handleCloseTab(request, sender, sendResponse);
      return true; // Will respond asynchronously
      
    case 'listTabs':
      handleListTabs(request, sender, sendResponse);
      return true; // Will respond asynchronously
      
    case 'getCurrentTab':
      handleGetCurrentTab(request, sender, sendResponse);
      return true; // Will respond asynchronously
      
    case 'waitForTabLoad':
      handleWaitForTabLoad(request, sender, sendResponse);
      return true; // Will respond asynchronously
      
    case 'keyboardDebuggerAction':
      handleKeyboardDebuggerAction(request, sender, sendResponse);
      return true; // Will respond asynchronously
      
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
    // Get the target tab ID
    const targetTabId = tabId || sender.tab?.id;
    
    // Get tab information to check URL
    let tabInfo;
    try {
      tabInfo = await chrome.tabs.get(targetTabId);
    } catch (error) {
      throw new Error(`Cannot access tab ${targetTabId}. Tab may have been closed or is not accessible.`);
    }
    
    // Check if we need smart navigation for restricted URLs
    if (isRestrictedURL(tabInfo.url)) {
      if (shouldUseSmartNavigation(tabInfo.url, task)) {
        // Determine the best website for this task
        const targetUrl = analyzeTaskAndGetTargetUrl(task);
        
        console.log(`Smart navigation: ${tabInfo.url} -> ${targetUrl} for task: "${task}"`);
        
        // Navigate to the target website
        await chrome.tabs.update(targetTabId, { url: targetUrl });
        
        // Wait for navigation to complete
        await new Promise((resolve) => {
          const navigationListener = (tabId, changeInfo) => {
            if (tabId === targetTabId && changeInfo.status === 'complete') {
              chrome.tabs.onUpdated.removeListener(navigationListener);
              resolve();
            }
          };
          chrome.tabs.onUpdated.addListener(navigationListener);
          
          // Timeout after 10 seconds
          setTimeout(() => {
            chrome.tabs.onUpdated.removeListener(navigationListener);
            resolve();
          }, 10000);
        });
        
        // Update tabInfo after navigation
        try {
          tabInfo = await chrome.tabs.get(targetTabId);
        } catch (error) {
          throw new Error(`Tab became inaccessible after navigation to ${targetUrl}`);
        }
        
        console.log(`Navigation completed to: ${tabInfo.url}`);
      } else {
        // For non-navigable restricted pages (settings, extensions, etc.), show error
        const pageType = getPageTypeDescription(tabInfo.url);
        const error = new Error(`Chrome security restrictions prevent extensions from accessing this type of page (${tabInfo.url}). Please navigate to a regular website to use automation.`);
        error.isChromePage = true;
        throw error;
      }
    }
    
    // Track smart navigation for user feedback
    let navigationMessage = '';
    const originalUrl = tabInfo.url;
    let navigationPerformed = false;
    
    if (isRestrictedURL(originalUrl) && shouldUseSmartNavigation(originalUrl, task)) {
      const targetUrl = analyzeTaskAndGetTargetUrl(task);
      navigationMessage = `Navigated from ${getPageTypeDescription(originalUrl)} to ${new URL(targetUrl).hostname} to complete your task.`;
      navigationPerformed = true;
    }

    // Create new session with enhanced tracking
    const sessionId = `session_${Date.now()}`;
    const sessionData = {
      task,
      tabId: targetTabId,
      originalTabId: targetTabId,  // Store original tab - automation is restricted to this tab
      status: 'running',
      startTime: Date.now(),
      actionHistory: [],        // Track all actions executed
      stateHistory: [],         // Track DOM state changes
      failedAttempts: {},       // Track failed actions by type
      failedActionDetails: {},  // Track detailed failures by action signature
      lastDOMHash: null,        // Hash of last DOM state to detect changes
      stuckCounter: 0,          // Counter for detecting stuck state
      iterationCount: 0,        // Total iterations
      urlHistory: [],           // Track URL changes
      lastUrl: null,            // Last known URL
      actionSequences: [],      // Track sequences of actions to detect patterns
      sequenceRepeatCount: {},  // Count how many times each sequence repeats
      navigationMessage,        // Store navigation message for UI
    };
    
    activeSessions.set(sessionId, sessionData);
    
    automationLogger.logSessionStart(sessionId, task, sessionData.tabId);
    initializeSessionMetrics(sessionId);
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
      message: navigationMessage || 'Automation started',
      navigationPerformed: navigationPerformed
    });
    
    // Start the automation loop
    startAutomationLoop(sessionId);
    
  } catch (error) {
    console.error('Error starting automation:', error);
    sendResponse({ 
      success: false, 
      error: error.message,
      isChromePage: error.isChromePage || false
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
    finalizeSessionMetrics(sessionId, false); // Stopped, not completed
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
 * Handle multi-tab actions directly in background script
 * @param {Object} action - The action to execute
 * @param {number} currentTabId - The current tab ID for context
 * @returns {Promise<Object>} Action result
 */
async function handleMultiTabAction(action, currentTabId) {
  const { tool, params } = action;
  
  console.log(`[FSB] handleMultiTabAction called:`, { tool, params, currentTabId });
  
  return new Promise((resolve) => {
    const mockSender = { tab: { id: currentTabId } };
    const mockRequest = { ...params, action: tool };
    
    console.log(`[FSB] Mock request for ${tool}:`, mockRequest);
    
    switch (tool) {
      case 'openNewTab':
        console.log(`[FSB] Calling handleOpenNewTab with:`, mockRequest);
        handleOpenNewTab(mockRequest, mockSender, resolve);
        break;
        
      case 'switchToTab':
        // SECURITY: Block switching away from the original session tab
        const switchRequest = { ...mockRequest };
        if (switchRequest.tabId && typeof switchRequest.tabId === 'string') {
          switchRequest.tabId = parseInt(switchRequest.tabId, 10);
        }
        
        // Find the session to check originalTabId
        const session = Array.from(activeSessions.values()).find(s => s.tabId === currentTabId);
        if (session && switchRequest.tabId !== session.originalTabId) {
          console.log(`[FSB] BLOCKED: Attempt to switch from session tab ${session.originalTabId} to unauthorized tab ${switchRequest.tabId}`);
          resolve({
            success: false,
            error: `Security restriction: Automation is limited to the original tab (${session.originalTabId}). Cannot switch to tab ${switchRequest.tabId}.`,
            blocked: true
          });
          return;
        }
        
        console.log(`[FSB] Tab switch allowed: staying within session tab ${switchRequest.tabId}`);
        resolve({
          success: true,
          message: `Already on session tab ${switchRequest.tabId}`,
          tabId: switchRequest.tabId
        });
        break;
        
      case 'closeTab':
        // Fix: Convert string tabId to integer
        const closeRequest = { ...mockRequest };
        if (closeRequest.tabId && typeof closeRequest.tabId === 'string') {
          console.log(`[FSB] Converting tabId from string '${closeRequest.tabId}' to integer`);
          closeRequest.tabId = parseInt(closeRequest.tabId, 10);
        }
        console.log(`[FSB] Calling handleCloseTab with:`, closeRequest);
        handleCloseTab(closeRequest, mockSender, resolve);
        break;
        
      case 'listTabs':
        console.log(`[FSB] Calling handleListTabs with:`, mockRequest);
        handleListTabs(mockRequest, mockSender, resolve);
        break;
        
      case 'waitForTabLoad':
        // Fix: Convert string tabId to integer, default to current tab if not specified  
        const waitRequest = { ...mockRequest };
        if (waitRequest.tabId) {
          if (typeof waitRequest.tabId === 'string') {
            console.log(`[FSB] Converting tabId from string '${waitRequest.tabId}' to integer`);
            waitRequest.tabId = parseInt(waitRequest.tabId, 10);
          }
        } else {
          waitRequest.tabId = currentTabId;
          console.log(`[FSB] Using current tab ID: ${currentTabId}`);
        }
        console.log(`[FSB] Calling handleWaitForTabLoad with:`, waitRequest);
        handleWaitForTabLoad(waitRequest, mockSender, resolve);
        break;
        
      case 'getCurrentTab':
        console.log(`[FSB] Calling handleGetCurrentTab with:`, mockRequest);
        handleGetCurrentTab(mockRequest, mockSender, resolve);
        break;
        
      default:
        console.error(`[FSB] Unknown multi-tab action: ${tool}`);
        resolve({
          success: false,
          error: `Unknown multi-tab action: ${tool}`
        });
    }
  });
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
  
  // Track iteration in performance metrics
  const sessionStats = performanceMetrics.sessionStats.get(sessionId);
  if (sessionStats) {
    sessionStats.iterations = session.iterationCount;
  }
  console.log(`Automation loop iteration ${session.iterationCount} for session ${sessionId}`);
  
  try {
    // SECURITY: Only inject content script into the original session tab
    if (session.tabId !== session.originalTabId) {
      throw new Error(`Security violation: Attempted to inject content script into unauthorized tab ${session.tabId}. Session is restricted to tab ${session.originalTabId}.`);
    }
    
    // Ensure content script is injected into session tab only
    try {
      await chrome.scripting.executeScript({
        target: { tabId: session.originalTabId }, // Use originalTabId for security
        files: ['content.js']
      });
      console.log(`[FSB] Content script injected into session tab ${session.originalTabId}`);
    } catch (injectionError) {
      // Content script might already be injected, continue
      console.log('Content script injection skipped (might already exist)');
    }
    
    // Get current DOM state with enhanced error handling
    let domResponse;
    try {
      // Get DOM optimization settings from storage
      const settings = await chrome.storage.local.get([
        'domOptimization',
        'maxDOMElements', 
        'prioritizeViewport'
      ]);
      const domOptimizationEnabled = settings.domOptimization !== false;
      
      console.log(`[FSB Background] Requesting DOM for iteration ${session.iterationCount}`, {
        useIncrementalDiff: domOptimizationEnabled,
        maxElements: settings.maxDOMElements || 2000,
        prioritizeViewport: settings.prioritizeViewport !== false
      });
      
      domResponse = await sendMessageWithRetry(session.tabId, {
        action: 'getDOM',
        options: {
          useIncrementalDiff: domOptimizationEnabled,
          maxElements: settings.maxDOMElements || 2000,
          prioritizeViewport: settings.prioritizeViewport !== false
        }
      });
    } catch (messageError) {
      // Check if this is a restricted URL error
      let tabInfo;
      try {
        tabInfo = await chrome.tabs.get(session.tabId);
      } catch (tabError) {
        throw new Error('Tab has been closed or is no longer accessible.');
      }
      
      if (isRestrictedURL(tabInfo.url)) {
        const pageType = getPageTypeDescription(tabInfo.url);
        throw new Error(`Cannot access ${pageType} (${tabInfo.url}). The page navigated to a restricted URL that extensions cannot automate. Please navigate to a regular website to continue automation.`);
      }
      
      // Other message sending errors
      throw new Error(`Failed to communicate with the page (${tabInfo.url}). This may happen if the page is still loading, has security restrictions, or the content script failed to load. Error: ${messageError.message}`);
    }
    
    // Check if DOM response is valid
    if (!domResponse || !domResponse.success || !domResponse.structuredDOM) {
      throw new Error('Failed to get DOM state from content script. Response: ' + JSON.stringify(domResponse));
    }
    
    // Log DOM response details
    const domData = domResponse.structuredDOM;
    console.log('[FSB Background] DOM received:', {
      isDelta: domData._isDelta || false,
      type: domData.type || 'full',
      payloadSize: JSON.stringify(domData).length,
      optimization: domData.optimization || {}
    });
    
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
    
    // Enhanced stuck detection with pattern recognition
    const stuckPatterns = analyzeStuckPatterns(session);
    const isStuck = session.stuckCounter >= 3 || stuckPatterns.severity === 'high';
    
    // Generate recovery strategies if stuck
    let recoveryStrategies = [];
    if (isStuck) {
      recoveryStrategies = generateRecoveryStrategies(stuckPatterns, session);
      console.log(`[FSB] Stuck detected with patterns:`, stuckPatterns);
      console.log(`[FSB] Generated recovery strategies:`, recoveryStrategies);
    }
    
    // Get settings for AI call using config
    const settings = await config.getAll();
    
    // Detect repeated action failures
    const repeatedFailures = detectRepeatedActionFailures(session);
    const forceAlternativeStrategy = repeatedFailures.length > 0;
    
    // Gather multi-tab context
    let tabInfo = null;
    try {
      // Get all tabs in current window
      const allTabs = await chrome.tabs.query({ currentWindow: true });
      // Get tabs that have active sessions
      const sessionTabs = Array.from(activeSessions.values()).map(s => s.tabId);
      
      tabInfo = {
        currentTabId: session.tabId,
        allTabs: allTabs.map(tab => ({
          id: tab.id,
          url: tab.url,
          title: tab.title,
          active: tab.active,
          status: tab.status
        })),
        sessionTabs: sessionTabs
      };
    } catch (error) {
      console.log('Failed to gather tab context:', error.message);
    }
    
    // Prepare context with action history and task plan
    const context = {
      actionHistory: session.actionHistory.slice(-10), // Last 10 actions
      isStuck,
      stuckCounter: session.stuckCounter,
      domChanged,
      urlChanged,
      failedAttempts: session.failedAttempts,
      failedActionDetails: repeatedFailures, // Specific actions that keep failing
      forceAlternativeStrategy, // Flag to force AI to try different approach
      iterationCount: session.iterationCount,
      urlHistory: session.urlHistory.slice(-5), // Last 5 URL changes
      currentUrl: currentUrl,
      // Add sequence repetition info
      repeatedSequences: Object.entries(session.sequenceRepeatCount)
        .filter(([_, count]) => count > 2)
        .map(([signature, count]) => ({ signature, count })),
      lastSequences: session.actionSequences.slice(-3), // Last 3 action sequences
      // Add multi-tab context
      tabInfo: tabInfo
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
        const actionStartTime = Date.now();
        
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
        
        let actionResult;
        
        // Multi-tab actions should be handled directly by background script
        const multiTabActions = ['openNewTab', 'switchToTab', 'closeTab', 'listTabs', 'waitForTabLoad', 'getCurrentTab'];
        
        if (multiTabActions.includes(action.tool)) {
          // Handle multi-tab actions directly in background script
          console.log(`[FSB] Routing multi-tab action ${action.tool} directly to background handler`);
          try {
            actionResult = await handleMultiTabAction(action, session.tabId);
            console.log(`[FSB] Multi-tab action ${action.tool} result:`, actionResult);
          } catch (error) {
            console.error(`[FSB] Multi-tab action ${action.tool} failed:`, error);
            actionResult = {
              success: false,
              error: `Multi-tab action failed: ${error.message}`,
              tool: action.tool
            };
          }
        } else {
          // Send regular DOM actions to content script
          try {
            actionResult = await sendMessageWithRetry(session.tabId, {
              action: 'executeAction',
              tool: action.tool,
              params: action.params
            });
          } catch (messageError) {
            // Check if this is a restricted URL error during action execution
            let tabInfo;
            try {
              tabInfo = await chrome.tabs.get(session.tabId);
              if (isRestrictedURL(tabInfo.url)) {
                const pageType = getPageTypeDescription(tabInfo.url);
                throw new Error(`Cannot execute action on ${pageType} (${tabInfo.url}). The page navigated to a restricted URL during automation.`);
              }
            } catch (tabError) {
              throw new Error('Tab was closed or became inaccessible during action execution.');
            }
            
            // For other errors, provide a failure result with classification
            const failureType = classifyFailure(messageError, action);
            actionResult = {
              success: false,
              error: `Failed to execute ${action.tool}: ${messageError.message || messageError}`,
              tool: action.tool,
              failureType,
              retryable: failureType !== FAILURE_TYPES.PERMISSION
            };
          }
        }
        
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
        
        // Ensure actionResult has proper structure
        if (!actionResult) {
          actionResult = {
            success: false,
            error: 'Action returned no result - possible content script communication failure',
            tool: action.tool,
            failureType: FAILURE_TYPES.COMMUNICATION,
            retryable: true
          };
        }
        
        // Track failures and verification issues
        if (!actionResult.success) {
          // Track by tool type (existing)
          if (!session.failedAttempts[action.tool]) {
            session.failedAttempts[action.tool] = 0;
          }
          session.failedAttempts[action.tool]++;
          
          // Track detailed failures by action signature
          const actionSignature = createActionSignature(action);
          if (!session.failedActionDetails[actionSignature]) {
            session.failedActionDetails[actionSignature] = {
              tool: action.tool,
              params: action.params,
              count: 0,
              errors: [],
              firstFailure: Date.now(),
              lastFailure: null
            };
          }
          
          session.failedActionDetails[actionSignature].count++;
          session.failedActionDetails[actionSignature].lastFailure = Date.now();
          const errorMessage = actionResult.error || 'Unknown error - no error details provided';
          session.failedActionDetails[actionSignature].errors.push({
            error: errorMessage,
            timestamp: Date.now(),
            iteration: session.iterationCount
          });
          
          // Keep only last 3 errors to avoid memory bloat
          if (session.failedActionDetails[actionSignature].errors.length > 3) {
            session.failedActionDetails[actionSignature].errors.shift();
          }
          
          console.warn(`Action failed: ${action.tool}`, errorMessage, `(${session.failedActionDetails[actionSignature].count} failures)`);
          
          // Try alternative actions for critical failures
          if (actionResult.retryable && actionResult.failureType !== FAILURE_TYPES.PERMISSION) {
            console.log(`[FSB] Attempting alternative actions for failed ${action.tool}`);
            const alternativeResult = await tryAlternativeAction(sessionId, action, actionResult);
            
            if (alternativeResult && alternativeResult.success) {
              console.log(`[FSB] Alternative action succeeded: ${alternativeResult.alternativeUsed}`);
              actionResult = alternativeResult;
              
              // Log the successful alternative
              automationLogger.logAction(sessionId, {
                ...action,
                description: `${action.description} (Alternative: ${alternativeResult.alternativeUsed})`
              }, alternativeResult);
              
              // Track alternative action usage
              trackActionPerformance(sessionId, action, actionResult, actionStartTime, true);
            } else {
              // Track failed action
              trackActionPerformance(sessionId, action, actionResult, actionStartTime, false);
            }
          } else {
            // Track failed action
            trackActionPerformance(sessionId, action, actionResult, actionStartTime, false);
          }
        } else {
          // Track successful action
          trackActionPerformance(sessionId, action, actionResult, actionStartTime, false);
          
          // Check for verification warnings
          if (actionResult.success && (actionResult.warning || actionResult.hadEffect === false || actionResult.validationPassed === false)) {
            console.warn(`[FSB] Action succeeded but verification indicates potential issue:`, {
              tool: action.tool,
              selector: action.params.selector,
              warning: actionResult.warning,
              hadEffect: actionResult.hadEffect,
              validationPassed: actionResult.validationPassed
            });
            
            // Track actions that succeeded but had no effect
            if (!session.noEffectActions) {
              session.noEffectActions = [];
            }
            
            session.noEffectActions.push({
              tool: action.tool,
              params: action.params,
              warning: actionResult.warning || 'Action completed but verification failed',
              iteration: session.iterationCount,
              timestamp: Date.now()
            });
            
            // If too many no-effect actions, increase stuck counter
            const recentNoEffectCount = session.noEffectActions.filter(a => 
              Date.now() - a.timestamp < 30000 // Last 30 seconds
            ).length;
            
            if (recentNoEffectCount >= 3) {
              session.stuckCounter++;
              console.warn(`[FSB] Multiple no-effect actions detected - incrementing stuck counter to ${session.stuckCounter}`);
            }
          }
        }
        
        // Smart delay calculation based on action types and DOM state
        if (i < aiResponse.actions.length - 1) { // Don't delay after the last action
          const nextAction = aiResponse.actions[i + 1];
          
          // Check if page is loading with error handling
          let loadingCheck;
          try {
            loadingCheck = await sendMessageWithRetry(session.tabId, {
              action: 'executeAction',
              tool: 'detectLoadingState',
              params: {}
            });
          } catch (error) {
            // Silently handle loading check errors - continue with fixed delay
            console.log('Loading check failed, using fixed delay');
            loadingCheck = { success: false };
          }
          
          if (loadingCheck?.success && loadingCheck?.result?.loading) {
            console.log(`Loading indicator detected: ${loadingCheck.result.indicator}`);
            
            // Wait for DOM to stabilize with error handling
            let stableResult;
            try {
              stableResult = await sendMessageWithRetry(session.tabId, {
                action: 'executeAction',
                tool: 'waitForDOMStable',
                params: { timeout: 5000, stableTime: 500 }
              });
            } catch (error) {
              // If stability check fails, use fixed delay
              console.log('DOM stability check failed, using fixed delay');
              stableResult = { success: false };
            }
            
            console.log(`DOM stable after ${stableResult?.waitTime || 'unknown'}ms (${stableResult?.reason || 'unknown'})`);
          } else {
            // Use smart DOM-based waiting for certain action types
            const actionsThatCauseChanges = ['click', 'type', 'navigate', 'searchGoogle', 'pressEnter', 'submit'];
            const currentCausesChanges = actionsThatCauseChanges.includes(action.tool);
            
            if (currentCausesChanges) {
              // Wait for DOM to stabilize after actions that typically cause changes
              let stableResult;
              try {
                stableResult = await sendMessageWithRetry(session.tabId, {
                  action: 'executeAction',
                  tool: 'waitForDOMStable',
                  params: { timeout: 3000, stableTime: 300 }
                });
              } catch (error) {
                // If stability check fails, use fixed delay
                console.log('DOM stability check failed, using fixed delay');
                stableResult = { success: false };
              }
              
              console.log(`DOM stable after ${stableResult?.waitTime || 'unknown'}ms`);
            } else {
              // For other actions, use minimal delay
              const delay = calculateActionDelay(action, nextAction);
              console.log(`Using fixed delay: ${delay}ms`);
              await new Promise(resolve => setTimeout(resolve, delay));
            }
          }
        }
      }
    }
    
    
    // Smart stuck detection with early exit for repeated success
    // Check for repeated success earlier (at 4 iterations) to avoid unnecessary loops
    if (session.stuckCounter >= 4) {
      const repeatedResult = detectRepeatedSuccess(session);
      if (repeatedResult) {
        console.log(`Found repeated valid result at stuck counter ${session.stuckCounter}:`, repeatedResult);
        // Complete the task with the repeated result
        session.status = 'completed';
        const duration = Date.now() - session.startTime;
        automationLogger.logSessionEnd(sessionId, 'completed', session.actionHistory.length, duration);
        
        // Send success message via runtime message
        chrome.runtime.sendMessage({
          action: 'automationComplete',
          sessionId,
          result: repeatedResult,
          navigatedTo: currentUrl
        });
        
        // Clean up session
        finalizeSessionMetrics(sessionId, true); // Successfully completed
        activeSessions.delete(sessionId);
        return;
      }
    }
    
    // Check if we're stuck in a loop after more iterations
    if (session.stuckCounter >= 8) {
      
      console.error('Automation appears stuck - attempting to provide summary');
      session.status = 'stuck';
      
      // Provide a detailed summary of what was accomplished before getting stuck
      let finalResult = 'I attempted to complete your task but encountered repeated difficulties. ';
      
      // Check if we have any extracted text from recent actions
      const recentTextActions = session.actionHistory
        .filter(action => action.tool === 'getText' && action.result?.success && action.result?.value)
        .slice(-5); // Last 5 getText results
      
      if (recentTextActions.length > 0) {
        // We found some text, include it in the result
        const extractedTexts = recentTextActions.map(action => action.result.value).filter(text => text && text.trim());
        if (extractedTexts.length > 0) {
          finalResult += `Here's what I was able to extract: ${extractedTexts.join(', ')}. `;
        }
      }
      
      // Add information about successful actions
      const successfulActions = session.actionHistory.filter(a => a.result?.success);
      const failedActions = session.actionHistory.filter(a => !a.result?.success);
      
      if (successfulActions.length > 0) {
        const uniqueSuccessActions = [...new Set(successfulActions.map(a => a.tool))];
        finalResult += `Successfully completed: ${uniqueSuccessActions.join(', ')}. `;
      }
      
      if (failedActions.length > 0) {
        const uniqueFailedActions = [...new Set(failedActions.map(a => a.tool))];
        finalResult += `Had trouble with: ${uniqueFailedActions.join(', ')}. `;
      }
      
      // Add current URL if changed from start
      if (session.urlHistory.length > 1) {
        finalResult += `Currently on: ${session.lastUrl}. `;
      }
      
      finalResult += 'You may want to try rephrasing your request or breaking it into smaller steps.';
      
      finalizeSessionMetrics(sessionId, false); // Failed due to stuck loop
      activeSessions.delete(sessionId);
      
      // Send completion with partial results instead of error
      chrome.runtime.sendMessage({
        action: 'automationComplete',
        sessionId,
        result: finalResult,
        partial: true
      });
      
      automationLogger.logSessionEnd(sessionId, 'stuck', session.actionHistory.length, Date.now() - session.startTime);
      return;
    }
    
    // COMPLETION VALIDATION: Ensure AI provides meaningful results AND critical actions succeeded
    if (aiResponse.taskComplete) {
      // Check for meaningful result
      if (!aiResponse.result || aiResponse.result.trim().length < 10) {
        console.warn('⚠️ AI claimed taskComplete=true but provided no meaningful result. Continuing automation...');
        automationLogger.warn('Completion blocked - AI must provide result summary', {sessionId});
        aiResponse.taskComplete = false; // Override the AI's decision
      } else {
        // Check for recent critical action failures
        const criticalActions = ['type', 'click'];
        const recentActions = session.actionHistory.slice(-10); // Last 10 actions
        const recentCriticalFailures = recentActions.filter(action => 
          criticalActions.includes(action.tool) && !action.result?.success
        );
        
        // Enhanced messaging task completion validation
        const isMessagingTask = session.task.toLowerCase().includes('message') || 
                               session.task.toLowerCase().includes('send') ||
                               session.task.toLowerCase().includes('text') ||
                               session.task.toLowerCase().includes('chat') ||
                               session.task.toLowerCase().includes('reply') ||
                               session.task.toLowerCase().includes('comment');
        
        // For messaging tasks, check if message was actually sent
        if (isMessagingTask && recentCriticalFailures.length > 0) {
          const typeFailures = recentCriticalFailures.filter(action => action.tool === 'type');
          const clickSuccesses = recentActions.filter(action => 
            action.tool === 'click' && action.result?.success
          );
          
          // Allow completion if:
          // 1. Type failed but there were successful clicks (might have sent empty/existing message)
          // 2. Multiple attempts were made and DOM changed (likely successful)
          // 3. AI provides detailed result indicating success
          const shouldAllowCompletion = (
            (typeFailures.length > 0 && clickSuccesses.length >= 2) ||  // Clicked send buttons
            (session.stuckCounter < 3 && session.urlHistory.length > 0) || // Made progress
            (aiResponse.result && aiResponse.result.length > 50 && 
             aiResponse.result.toLowerCase().includes('sent')) || // AI claims success
            (recentActions.filter(a => a.result?.success).length >= recentActions.length * 0.7) // Most actions succeeded
          );
          
          if (typeFailures.length > 0 && !shouldAllowCompletion) {
            console.warn('⚠️ AI claimed taskComplete=true but critical type actions failed. Continuing automation...');
            automationLogger.warn('Completion blocked - critical type actions failed for messaging task', {
              sessionId,
              failedActions: typeFailures.map(a => ({tool: a.tool, params: a.params, error: a.result?.error})),
              clickSuccesses: clickSuccesses.length,
              shouldAllowCompletion
            });
            aiResponse.taskComplete = false; // Override the AI's decision
          } else if (typeFailures.length > 0 && shouldAllowCompletion) {
            console.log('✅ Allowing messaging task completion despite type failures due to other success indicators');
          }
        } else if (recentCriticalFailures.length >= 3) {
          // General rule: block completion if multiple critical actions failed recently
          // But be more lenient if there are signs of success
          const successRate = recentActions.length > 0 ? 
            recentActions.filter(a => a.result?.success).length / recentActions.length : 0;
          
          // Allow completion if success rate is decent (60%+) or if AI provides detailed result
          const hasDetailedResult = aiResponse.result && aiResponse.result.length > 30;
          const hasDecentSuccessRate = successRate >= 0.6;
          
          if (!hasDetailedResult && !hasDecentSuccessRate) {
            console.warn('⚠️ AI claimed taskComplete=true but multiple critical actions failed. Continuing automation...');
            automationLogger.warn('Completion blocked - multiple critical actions failed', {
              sessionId,
              failedActions: recentCriticalFailures.map(a => ({tool: a.tool, params: a.params, error: a.result?.error})),
              successRate,
              hasDetailedResult
            });
            aiResponse.taskComplete = false; // Override the AI's decision
          } else {
            console.log('✅ Allowing task completion despite failures due to success indicators:', {
              successRate,
              hasDetailedResult,
              resultLength: aiResponse.result?.length || 0
            });
          }
        }
        
        if (aiResponse.taskComplete) {
          console.log('✅ Task completion approved with result:', aiResponse.result.substring(0, 100) + '...');
        }
      }
    }
    
    // Check if task is complete (after verification enforcement)
    if (aiResponse.taskComplete) {
      session.status = 'completed';
      const duration = Date.now() - session.startTime;
      
      automationLogger.logSessionEnd(sessionId, 'completed', session.actionHistory.length, duration);
      console.log('Task completed successfully');
      console.log('Total actions executed:', session.actionHistory.length);
      
      finalizeSessionMetrics(sessionId, true); // Successfully completed
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
    
    console.log('[FSB Background] Sending to AI:', {
      task: task,
      domType: structuredDOM._isDelta ? 'delta' : 'full',
      contextProvided: !!context,
      iteration: context?.iterationCount || 0
    });
    
    // Get automation actions from Grok-3-mini with context
    const result = await ai.getAutomationActions(task, structuredDOM, context);
    
    return result;
    
  } catch (error) {
    console.error('xAI Grok-3-mini API error:', error);
    
    // Return a more helpful fallback response
    return {
      actions: [],
      taskComplete: true, // Mark as complete to avoid infinite loop
      reasoning: '', // Disabled for performance
      result: `I encountered an error while processing your request: ${error.message}. Please try again or check your API settings.`,
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

// Multi-tab management handler functions

/**
 * Handle opening a new tab
 * @param {Object} request - The request object containing url and active flag
 * @param {Object} sender - The message sender
 * @param {Function} sendResponse - Function to send response
 */
async function handleOpenNewTab(request, sender, sendResponse) {
  try {
    const { url, active } = request;
    console.log(`Opening new tab: ${url}, active: ${active}`);
    
    const tab = await chrome.tabs.create({
      url: url || 'about:blank',
      active: active !== false // Default to true
    });
    
    // If we need to inject content script into the new tab
    if (url && url !== 'about:blank') {
      // Wait a moment for the tab to load
      setTimeout(async () => {
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['content.js']
          });
        } catch (error) {
          console.log('Content script injection skipped for new tab:', error.message);
        }
      }, 1000);
    }
    
    sendResponse({
      success: true,
      tabId: tab.id,
      url: tab.url,
      active: tab.active
    });
    
  } catch (error) {
    console.error('Error opening new tab:', error);
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

/**
 * Handle switching to an existing tab
 * @param {Object} request - The request object containing tabId
 * @param {Object} sender - The message sender
 * @param {Function} sendResponse - Function to send response
 */
async function handleSwitchToTab(request, sender, sendResponse) {
  try {
    const { tabId } = request;
    console.log(`Switching to tab: ${tabId}`);
    
    // Get current active tab first
    const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // Switch to the target tab
    await chrome.tabs.update(tabId, { active: true });
    
    // Also bring the window to front
    const tab = await chrome.tabs.get(tabId);
    await chrome.windows.update(tab.windowId, { focused: true });
    
    sendResponse({
      success: true,
      tabId: tabId,
      previousTab: currentTab ? currentTab.id : null
    });
    
  } catch (error) {
    console.error('Error switching to tab:', error);
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

/**
 * Handle closing a tab
 * @param {Object} request - The request object containing tabId
 * @param {Object} sender - The message sender
 * @param {Function} sendResponse - Function to send response
 */
async function handleCloseTab(request, sender, sendResponse) {
  try {
    const { tabId } = request;
    console.log(`Closing tab: ${tabId}`);
    
    // Remove any active sessions for this tab
    for (const [sessionId, session] of activeSessions) {
      if (session.tabId === tabId) {
        console.log(`Stopping session ${sessionId} for closing tab ${tabId}`);
        session.status = 'stopped';
        finalizeSessionMetrics(sessionId, false); // Tab closed
        activeSessions.delete(sessionId);
      }
    }
    
    await chrome.tabs.remove(tabId);
    
    sendResponse({
      success: true,
      tabId: tabId,
      closed: true
    });
    
  } catch (error) {
    console.error('Error closing tab:', error);
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

/**
 * Handle listing all tabs
 * @param {Object} request - The request object containing currentWindowOnly flag
 * @param {Object} sender - The message sender
 * @param {Function} sendResponse - Function to send response
 */
async function handleListTabs(request, sender, sendResponse) {
  try {
    const { currentWindowOnly } = request;
    console.log(`Listing tabs, currentWindowOnly: ${currentWindowOnly}`);
    
    let queryOptions = {};
    if (currentWindowOnly !== false) {
      queryOptions.currentWindow = true;
    }
    
    const tabs = await chrome.tabs.query(queryOptions);
    const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // PRIVACY: Only return tab titles for context, not URLs or sensitive data
    // Find the requesting session to identify the session tab
    const requestingSession = Array.from(activeSessions.values()).find(session => 
      session.tabId === (sender.tab?.id || currentTab?.id)
    );
    
    const formattedTabs = tabs.map(tab => ({
      id: tab.id,
      title: tab.title || 'Untitled Tab',  // Only title for context
      isSessionTab: requestingSession && tab.id === requestingSession.originalTabId,
      isActive: tab.active,
      // URL and other sensitive data removed for privacy
    }));
    
    sendResponse({
      success: true,
      tabs: formattedTabs,
      sessionTabId: requestingSession ? requestingSession.originalTabId : null,
      currentTab: currentTab ? currentTab.id : null,
      totalTabs: formattedTabs.length,
      message: 'Tab titles shown for context only. Automation is restricted to the session tab.'
    });
    
  } catch (error) {
    console.error('Error listing tabs:', error);
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

/**
 * Handle getting current tab information
 * @param {Object} request - The request object
 * @param {Object} sender - The message sender
 * @param {Function} sendResponse - Function to send response
 */
async function handleGetCurrentTab(request, sender, sendResponse) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (tab) {
      sendResponse({
        success: true,
        tab: {
          id: tab.id,
          url: tab.url,
          title: tab.title,
          active: tab.active,
          windowId: tab.windowId,
          index: tab.index,
          status: tab.status,
          hasSession: Array.from(activeSessions.values()).some(session => session.tabId === tab.id)
        }
      });
    } else {
      sendResponse({
        success: false,
        error: 'No active tab found'
      });
    }
    
  } catch (error) {
    console.error('Error getting current tab:', error);
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

/**
 * Handle waiting for a tab to load
 * @param {Object} request - The request object containing tabId and timeout
 * @param {Object} sender - The message sender
 * @param {Function} sendResponse - Function to send response
 */
async function handleWaitForTabLoad(request, sender, sendResponse) {
  try {
    const { tabId, timeout = 30000 } = request;
    console.log(`Waiting for tab ${tabId} to load, timeout: ${timeout}ms`);
    
    const startTime = Date.now();
    
    // Check if tab is already loaded
    let tab = await chrome.tabs.get(tabId);
    if (tab.status === 'complete') {
      sendResponse({
        success: true,
        tabId: tabId,
        loaded: true,
        url: tab.url,
        loadTime: 0
      });
      return;
    }
    
    // Set up listener for tab updates
    const loadPromise = new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        chrome.tabs.onUpdated.removeListener(updateListener);
        reject(new Error('Tab load timeout'));
      }, timeout);
      
      const updateListener = (updatedTabId, changeInfo, updatedTab) => {
        if (updatedTabId === tabId && changeInfo.status === 'complete') {
          clearTimeout(timeoutId);
          chrome.tabs.onUpdated.removeListener(updateListener);
          resolve({
            url: updatedTab.url,
            loadTime: Date.now() - startTime
          });
        }
      };
      
      chrome.tabs.onUpdated.addListener(updateListener);
    });
    
    const result = await loadPromise;
    
    sendResponse({
      success: true,
      tabId: tabId,
      loaded: true,
      url: result.url,
      loadTime: result.loadTime
    });
    
  } catch (error) {
    console.error('Error waiting for tab load:', error);
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

// Global keyboard emulator instance
let keyboardEmulator = null;

/**
 * Initialize keyboard emulator if not already initialized
 */
function initializeKeyboardEmulator() {
  if (!keyboardEmulator) {
    keyboardEmulator = new KeyboardEmulator();
  }
  return keyboardEmulator;
}

/**
 * Handle keyboard emulator actions from content scripts
 * @param {Object} request - The keyboard action request
 * @param {Object} sender - The message sender
 * @param {Function} sendResponse - Response callback
 */
async function handleKeyboardDebuggerAction(request, sender, sendResponse) {
  try {
    const { method, key, keys, text, specialKey, modifiers = {}, delay = 50 } = request;
    const tabId = sender.tab.id;
    
    console.log(`[FSB Keyboard] Handling ${method} for tab ${tabId}`, { key, keys, text, specialKey, modifiers });
    
    // Initialize keyboard emulator
    const emulator = initializeKeyboardEmulator();
    
    let result;
    
    switch (method) {
      case 'pressKey':
        if (!key) {
          throw new Error('Key parameter is required for pressKey');
        }
        result = await emulator.pressKey(tabId, key, modifiers);
        break;
        
      case 'pressKeySequence':
        if (!keys || !Array.isArray(keys)) {
          throw new Error('Keys array is required for pressKeySequence');
        }
        result = await emulator.pressKeySequence(tabId, keys, modifiers, delay);
        break;
        
      case 'typeText':
        if (!text || typeof text !== 'string') {
          throw new Error('Text parameter is required for typeText');
        }
        result = await emulator.typeText(tabId, text, delay);
        break;
        
      case 'sendSpecialKey':
        if (!specialKey || typeof specialKey !== 'string') {
          throw new Error('SpecialKey parameter is required for sendSpecialKey');
        }
        result = await emulator.sendSpecialKey(tabId, specialKey);
        break;
        
      default:
        throw new Error(`Unknown keyboard emulator method: ${method}`);
    }
    
    console.log(`[FSB Keyboard] ${method} result:`, result);
    
    sendResponse({
      success: result.success,
      result: result,
      method: method,
      tabId: tabId
    });
    
  } catch (error) {
    console.error('[FSB Keyboard] Error in keyboard emulator action:', error);
    sendResponse({
      success: false,
      error: error.message || 'Keyboard emulator action failed',
      method: request.method
    });
  }
}

/**
 * Clean up keyboard emulator resources when tab is closed
 */
chrome.tabs.onRemoved.addListener(async (tabId, removeInfo) => {
  if (keyboardEmulator && keyboardEmulator.debuggerAttached) {
    try {
      await keyboardEmulator.detachDebugger(tabId);
      console.log(`[FSB Keyboard] Cleaned up emulator for closed tab ${tabId}`);
    } catch (error) {
      console.warn(`[FSB Keyboard] Failed to clean up emulator for tab ${tabId}:`, error);
    }
  }
});

/**
 * Clean up keyboard emulator when extension is suspended/unloaded
 */
chrome.runtime.onSuspend.addListener(async () => {
  if (keyboardEmulator) {
    console.log('[FSB Keyboard] Extension suspending, cleaning up keyboard emulator');
    try {
      // Get all tabs and detach debugger from each
      const tabs = await chrome.tabs.query({});
      for (const tab of tabs) {
        try {
          await keyboardEmulator.detachDebugger(tab.id);
        } catch (error) {
          // Ignore individual cleanup errors during shutdown
        }
      }
    } catch (error) {
      console.warn('[FSB Keyboard] Error during keyboard emulator cleanup:', error);
    }
  }
});

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