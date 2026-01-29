// Automation Logger for FSB v0.1
// Provides structured logging for debugging automation loops

class AutomationLogger {
  constructor() {
    this.logs = [];
    this.maxLogs = 5000; // Increased for comprehensive logging capture
    this.logLevel = 'debug'; // 'error', 'warn', 'info', 'debug'
    this.maxSessionLogs = 1000; // Max logs per session before compaction
    this.storageMode = 'full'; // 'full', 'compact', 'minimal'
  }
  
  // Add a log entry
  log(level, message, data = null) {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      data
    };
    
    this.logs.push(entry);
    
    // Keep logs under limit
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }
    
    // Also log to console with appropriate method
    const consoleMethod = level === 'error' ? 'error' : 
                         level === 'warn' ? 'warn' : 
                         'log';
    console[consoleMethod](`[FSB ${level.toUpperCase()}]`, message, data || '');
    
    // Store in chrome.storage for persistence
    this.persistLogs();
  }
  
  // Convenience methods
  error(message, data) { this.log('error', message, data); }
  warn(message, data) { this.log('warn', message, data); }
  info(message, data) { this.log('info', message, data); }
  debug(message, data) { this.log('debug', message, data); }
  
  // Log automation session start
  logSessionStart(sessionId, task, tabId) {
    this.info('Automation session started', {
      sessionId,
      task,
      tabId,
      startTime: new Date().toISOString()
    });
  }
  
  // Log iteration details
  logIteration(sessionId, iterationCount, domHash, stuckCounter) {
    this.debug(`Iteration ${iterationCount}`, {
      sessionId,
      iterationCount,
      domHash,
      stuckCounter,
      isStuck: stuckCounter >= 3
    });
  }
  
  // Log action execution
  logAction(sessionId, action, result) {
    const level = result?.success ? 'info' : 'warn';
    this.log(level, `Action ${action.tool} ${result?.success ? 'succeeded' : 'failed'}`, {
      sessionId,
      action,
      result,
      timestamp: new Date().toISOString()
    });
  }
  
  // Log AI response
  logAIResponse(sessionId, reasoning, actions, taskComplete) {
    this.info('AI response received', {
      sessionId,
      // reasoning: reasoning?.substring(0, 200) + '...',
      actionCount: actions?.length || 0,
      actions: actions?.map(a => `${a.tool}(${JSON.stringify(a.params)})`),
      taskComplete
    });
  }
  
  // Log stuck detection
  logStuckDetection(sessionId, stuckCounter, lastActions) {
    this.warn('Automation may be stuck', {
      sessionId,
      stuckCounter,
      lastActions: lastActions.slice(-5).map(a => ({
        tool: a.tool,
        success: a.result?.success,
        error: a.result?.error
      }))
    });
  }
  
  // Log session end
  logSessionEnd(sessionId, status, totalActions, duration) {
    this.info('Automation session ended', {
      sessionId,
      status,
      totalActions,
      duration: `${duration}ms`,
      durationReadable: this.formatDuration(duration)
    });
  }

  // ==========================================
  // Enhanced Comprehensive Logging Methods
  // ==========================================

  /**
   * Log full AI prompt (system + user)
   * @param {string} sessionId - The session ID
   * @param {string} systemPrompt - The system prompt sent to AI
   * @param {string} userPrompt - The user prompt sent to AI
   * @param {number} iteration - Current iteration number
   */
  logPrompt(sessionId, systemPrompt, userPrompt, iteration) {
    this.debug('AI Prompt', {
      sessionId,
      iteration,
      logType: 'prompt',
      systemPrompt: systemPrompt ? systemPrompt.substring(0, 5000) : '',
      userPrompt: userPrompt ? userPrompt.substring(0, 10000) : '',
      systemPromptLength: systemPrompt?.length || 0,
      userPromptLength: userPrompt?.length || 0,
      totalPromptLength: (systemPrompt?.length || 0) + (userPrompt?.length || 0),
      estimatedTokens: Math.ceil(((systemPrompt?.length || 0) + (userPrompt?.length || 0)) / 3.5)
    });
  }

  /**
   * Log raw AI response before parsing
   * @param {string} sessionId - The session ID
   * @param {string} rawResponse - The raw response text from AI
   * @param {boolean} parseSuccess - Whether parsing succeeded
   * @param {number} iteration - Current iteration number
   */
  logRawResponse(sessionId, rawResponse, parseSuccess, iteration = null) {
    this.debug('AI Raw Response', {
      sessionId,
      iteration,
      logType: 'rawResponse',
      rawResponse: rawResponse ? rawResponse.substring(0, 10000) : '',
      rawResponseLength: rawResponse?.length || 0,
      parseSuccess,
      truncated: (rawResponse?.length || 0) > 10000
    });
  }

  /**
   * Log AI reasoning fields (all fields from response)
   * @param {string} sessionId - The session ID
   * @param {Object} reasoning - Object containing all reasoning fields
   * @param {number} iteration - Current iteration number
   */
  logReasoning(sessionId, reasoning, iteration = null) {
    this.info('AI Reasoning', {
      sessionId,
      iteration,
      logType: 'reasoning',
      situationAnalysis: reasoning?.situationAnalysis || '',
      goalAssessment: reasoning?.goalAssessment || '',
      reasoning: reasoning?.reasoning || '',
      confidence: reasoning?.confidence || 'unknown',
      assumptions: reasoning?.assumptions || [],
      fallbackPlan: reasoning?.fallbackPlan || '',
      currentStep: reasoning?.currentStep || ''
    });
  }

  /**
   * Log DOM state snapshot
   * @param {string} sessionId - The session ID
   * @param {Object} domState - The DOM state object
   * @param {number} iteration - Current iteration number
   */
  logDOMState(sessionId, domState, iteration) {
    // Create condensed element summary (first 50 elements)
    const elements = domState?.elements || [];
    const elementSummary = elements.slice(0, 50).map(el => ({
      type: el.type,
      id: el.id || '',
      text: el.text ? el.text.substring(0, 50) : '',
      selector: el.selectors?.[0] || ''
    }));

    this.debug('DOM State', {
      sessionId,
      iteration,
      logType: 'domState',
      url: domState?.url || '',
      title: domState?.title || '',
      elementCount: elements.length,
      isDelta: domState?._isDelta || false,
      payloadSize: JSON.stringify(domState || {}).length,
      elementSummary,
      captchaPresent: domState?.captchaPresent || false,
      scrollPosition: domState?.scrollPosition || null,
      viewport: domState?.viewport || null,
      formCount: domState?.htmlContext?.pageStructure?.forms?.length || 0
    });
  }

  /**
   * Log content script communication
   * @param {string} sessionId - The session ID
   * @param {string} direction - 'send' or 'receive'
   * @param {string} messageType - The type of message (e.g., 'getDOM', 'executeAction')
   * @param {Object} payload - The message payload
   * @param {Object} result - The result (for receive direction)
   */
  logContentMessage(sessionId, direction, messageType, payload = null, result = null) {
    const payloadStr = payload ? JSON.stringify(payload) : '';
    const resultStr = result ? JSON.stringify(result) : '';

    this.debug('Content Script Message', {
      sessionId,
      logType: 'contentMessage',
      direction,
      messageType,
      payload: payloadStr.substring(0, 2000),
      payloadSize: payloadStr.length,
      payloadTruncated: payloadStr.length > 2000,
      result: resultStr.substring(0, 2000),
      resultSize: resultStr.length,
      resultTruncated: resultStr.length > 2000,
      success: result?.success
    });
  }

  /**
   * Log token usage for API calls
   * @param {string} sessionId - The session ID
   * @param {string} model - The AI model used
   * @param {number} inputTokens - Number of input tokens
   * @param {number} outputTokens - Number of output tokens
   * @param {string} source - Token source ('api', 'estimated', 'error')
   * @param {number} iteration - Current iteration number
   */
  logTokenUsage(sessionId, model, inputTokens, outputTokens, source, iteration = null) {
    this.info('Token Usage', {
      sessionId,
      iteration,
      logType: 'tokenUsage',
      model: model || 'unknown',
      inputTokens: inputTokens || 0,
      outputTokens: outputTokens || 0,
      totalTokens: (inputTokens || 0) + (outputTokens || 0),
      source: source || 'unknown'
    });
  }

  // ==========================================
  // New Category-Specific Logging Methods
  // ==========================================

  /**
   * Log timing/performance metrics
   * @param {string} sessionId - The session ID
   * @param {string} category - Category: 'LLM', 'DOM', 'ACTION', 'WAIT'
   * @param {string} operation - Operation name: 'api_call', 'fetch', 'dom_stable'
   * @param {number} durationMs - Duration in milliseconds
   * @param {Object} details - Additional details
   */
  logTiming(sessionId, category, operation, durationMs, details = {}) {
    this.debug('Timing', {
      sessionId,
      logType: 'timing',
      category,
      operation,
      durationMs,
      ...details
    });
  }

  /**
   * Log communication events (content script messaging)
   * @param {string} sessionId - The session ID
   * @param {string} direction - 'send', 'receive', 'health'
   * @param {string} type - Message type: 'healthCheck', 'getDOM', 'executeAction'
   * @param {boolean} success - Whether communication succeeded
   * @param {Object} details - Additional details
   */
  logComm(sessionId, direction, type, success, details = {}) {
    const level = success ? 'debug' : 'warn';
    this.log(level, 'Communication', {
      sessionId,
      logType: 'comm',
      direction,
      type,
      success,
      ...details
    });
  }

  /**
   * Log recovery attempts
   * @param {string} sessionId - The session ID
   * @param {string} issue - Issue type: 'bfcache', 'comm_failure', 'selector_fail'
   * @param {string} action - Recovery action: 're-inject', 'wake_page', 'alternative'
   * @param {string} result - Result: 'success', 'failed', 'retry'
   * @param {Object} details - Additional details
   */
  logRecovery(sessionId, issue, action, result, details = {}) {
    const level = result === 'success' ? 'info' : 'warn';
    this.log(level, 'Recovery', {
      sessionId,
      logType: 'recovery',
      issue,
      action,
      result,
      ...details
    });
  }

  /**
   * Log navigation events
   * @param {string} sessionId - The session ID
   * @param {string} type - Navigation type: 'smart', 'click', 'redirect', 'back'
   * @param {string} from - Source URL
   * @param {string} to - Destination URL
   * @param {Object} details - Additional details
   */
  logNavigation(sessionId, type, from, to, details = {}) {
    this.info('Navigation', {
      sessionId,
      logType: 'navigation',
      type,
      from: from ? from.substring(0, 200) : '',
      to: to ? to.substring(0, 200) : '',
      ...details
    });
  }

  /**
   * Log DOM operations
   * @param {string} sessionId - The session ID
   * @param {string} operation - Operation: 'capture', 'serialize', 'compress', 'optimize'
   * @param {Object} metrics - Operation metrics (element count, size, etc.)
   * @param {Object} details - Additional details
   */
  logDOMOperation(sessionId, operation, metrics = {}, details = {}) {
    this.debug('DOM Operation', {
      sessionId,
      logType: 'domOperation',
      operation,
      ...metrics,
      ...details
    });
  }

  /**
   * Log detailed action execution phases
   * @param {string} sessionId - The session ID
   * @param {string} tool - Tool/action name
   * @param {string} phase - Phase: 'start', 'attempt', 'fallback', 'complete'
   * @param {Object} details - Additional details
   */
  logActionExecution(sessionId, tool, phase, details = {}) {
    const level = phase === 'complete' && details.success === false ? 'warn' : 'debug';
    this.log(level, 'Action Execution', {
      sessionId,
      logType: 'actionExec',
      tool,
      phase,
      ...details
    });
  }

  /**
   * Log API/Provider operations
   * @param {string} sessionId - The session ID
   * @param {string} provider - Provider: 'xai', 'gemini', 'openai', 'anthropic'
   * @param {string} operation - Operation: 'call', 'response', 'parse', 'cache'
   * @param {Object} details - Additional details
   */
  logAPI(sessionId, provider, operation, details = {}) {
    this.debug('API', {
      sessionId,
      logType: 'api',
      provider,
      operation,
      ...details
    });
  }

  /**
   * Log service worker events
   * @param {string} event - Event type: 'keepalive', 'cleanup', 'session_count'
   * @param {Object} details - Additional details
   */
  logServiceWorker(event, details = {}) {
    this.debug('Service Worker', {
      logType: 'serviceWorker',
      event,
      ...details
    });
  }

  /**
   * Log initialization events
   * @param {string} component - Component: 'content_script', 'analytics', 'provider'
   * @param {string} status - Status: 'loaded', 'ready', 'failed'
   * @param {Object} details - Additional details
   */
  logInit(component, status, details = {}) {
    const level = status === 'failed' ? 'error' : 'info';
    this.log(level, 'Init', {
      logType: 'init',
      component,
      status,
      ...details
    });
  }

  /**
   * Log queue/batching operations
   * @param {string} sessionId - The session ID
   * @param {string} operation - Operation: 'enqueue', 'dequeue', 'process', 'flush'
   * @param {Object} details - Additional details including queue size, delays
   */
  logQueue(sessionId, operation, details = {}) {
    this.debug('Queue', {
      sessionId,
      logType: 'queue',
      operation,
      ...details
    });
  }

  /**
   * Log cache operations
   * @param {string} sessionId - The session ID
   * @param {string} operation - Operation: 'hit', 'miss', 'set', 'expire', 'clear'
   * @param {string} key - Cache key (truncated)
   * @param {Object} details - Additional details
   */
  logCache(sessionId, operation, key, details = {}) {
    this.debug('Cache', {
      sessionId,
      logType: 'cache',
      operation,
      key: key ? key.substring(0, 100) : '',
      ...details
    });
  }

  /**
   * Log validation operations
   * @param {string} sessionId - The session ID
   * @param {string} type - Validation type: 'selector', 'response', 'action', 'params'
   * @param {boolean} valid - Whether validation passed
   * @param {Object} details - Additional details
   */
  logValidation(sessionId, type, valid, details = {}) {
    const level = valid ? 'debug' : 'warn';
    this.log(level, 'Validation', {
      sessionId,
      logType: 'validation',
      type,
      valid,
      ...details
    });
  }

  // Format duration to human readable
  formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    }
    return `${seconds}s`;
  }
  
  // Get recent logs
  getRecentLogs(count = 50) {
    return this.logs.slice(-count);
  }
  
  // Get logs for a specific session
  getSessionLogs(sessionId) {
    return this.logs.filter(log => log.data?.sessionId === sessionId);
  }
  
  // Clear logs
  clearLogs() {
    this.logs = [];
    this.persistLogs();
  }
  
  // Persist logs to storage
  async persistLogs() {
    try {
      // Only store recent logs to avoid storage limits
      const recentLogs = this.logs.slice(-100);
      await chrome.storage.local.set({ automationLogs: recentLogs });
    } catch (error) {
      console.error('Failed to persist logs:', error);
    }
  }
  
  // Load logs from storage
  async loadLogs() {
    try {
      const stored = await chrome.storage.local.get('automationLogs');
      if (stored.automationLogs) {
        this.logs = stored.automationLogs;
      }
    } catch (error) {
      console.error('Failed to load logs:', error);
    }
  }
  
  // Export logs to file
  exportLogs() {
    const logsJson = JSON.stringify(this.logs, null, 2);
    const blob = new Blob([logsJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    // Create download link
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `fsb-automation-logs-${timestamp}.json`;
    
    return { url, filename };
  }
  
  // Generate summary report
  generateReport(sessionId = null) {
    const relevantLogs = sessionId ? 
      this.getSessionLogs(sessionId) : 
      this.logs;
    
    const report = {
      totalLogs: relevantLogs.length,
      errors: relevantLogs.filter(l => l.level === 'error').length,
      warnings: relevantLogs.filter(l => l.level === 'warn').length,
      timeRange: {
        start: relevantLogs[0]?.timestamp,
        end: relevantLogs[relevantLogs.length - 1]?.timestamp
      },
      actionSummary: {}
    };
    
    // Count actions by type
    relevantLogs.forEach(log => {
      if (log.message.includes('Action') && log.data?.action) {
        const tool = log.data.action.tool;
        if (!report.actionSummary[tool]) {
          report.actionSummary[tool] = { total: 0, success: 0, failed: 0 };
        }
        report.actionSummary[tool].total++;
        if (log.data.result?.success) {
          report.actionSummary[tool].success++;
        } else {
          report.actionSummary[tool].failed++;
        }
      }
    });
    
    return report;
  }

  // ==========================================
  // Session-Based Storage Methods
  // ==========================================

  /**
   * Save a complete session to persistent storage
   * @param {string} sessionId - The session ID
   * @param {Object} sessionData - Additional session metadata (task, status, etc.)
   * @returns {Promise<boolean>} Success status
   */
  async saveSession(sessionId, sessionData = {}) {
    try {
      const sessionLogs = this.getSessionLogs(sessionId);

      if (sessionLogs.length === 0) {
        console.warn(`[FSB Logger] No logs found for session ${sessionId}`);
        return false;
      }

      // Create session object
      const session = {
        id: sessionId,
        task: sessionData.task || 'Unknown task',
        startTime: sessionData.startTime || Date.now(),
        endTime: Date.now(),
        status: sessionData.status || 'completed',
        tabId: sessionData.tabId || null,
        actionCount: sessionData.actionHistory?.length || 0,
        iterationCount: sessionData.iterationCount || 0,
        logs: sessionLogs
      };

      // Load existing sessions
      const stored = await chrome.storage.local.get(['fsbSessionLogs', 'fsbSessionIndex']);
      const sessionStorage = stored.fsbSessionLogs || {};
      const sessionIndex = stored.fsbSessionIndex || [];

      // Add new session
      sessionStorage[sessionId] = session;

      // Update index
      const indexEntry = {
        id: sessionId,
        task: session.task,
        startTime: session.startTime,
        endTime: session.endTime,
        status: session.status,
        actionCount: session.actionCount
      };

      // Remove existing index entry if present
      const existingIndex = sessionIndex.findIndex(s => s.id === sessionId);
      if (existingIndex !== -1) {
        sessionIndex[existingIndex] = indexEntry;
      } else {
        sessionIndex.unshift(indexEntry); // Add to beginning (most recent first)
      }

      // Clean old sessions (keep last 50)
      await this.cleanOldSessions(sessionStorage, sessionIndex, 50);

      // Save to storage
      await chrome.storage.local.set({
        fsbSessionLogs: sessionStorage,
        fsbSessionIndex: sessionIndex
      });

      console.log(`[FSB Logger] Session ${sessionId} saved with ${sessionLogs.length} logs`);
      return true;

    } catch (error) {
      console.error('[FSB Logger] Failed to save session:', error);
      return false;
    }
  }

  /**
   * Load a specific session's logs from storage
   * @param {string} sessionId - The session ID to load
   * @returns {Promise<Object|null>} Session data or null if not found
   */
  async loadSession(sessionId) {
    try {
      const stored = await chrome.storage.local.get(['fsbSessionLogs']);
      const sessionStorage = stored.fsbSessionLogs || {};

      if (sessionStorage[sessionId]) {
        return sessionStorage[sessionId];
      }

      console.warn(`[FSB Logger] Session ${sessionId} not found`);
      return null;

    } catch (error) {
      console.error('[FSB Logger] Failed to load session:', error);
      return null;
    }
  }

  /**
   * List all saved sessions (summary only)
   * @returns {Promise<Array>} Array of session summaries
   */
  async listSessions() {
    try {
      const stored = await chrome.storage.local.get(['fsbSessionIndex']);
      return stored.fsbSessionIndex || [];

    } catch (error) {
      console.error('[FSB Logger] Failed to list sessions:', error);
      return [];
    }
  }

  /**
   * Delete a specific session from storage
   * @param {string} sessionId - The session ID to delete
   * @returns {Promise<boolean>} Success status
   */
  async deleteSession(sessionId) {
    try {
      const stored = await chrome.storage.local.get(['fsbSessionLogs', 'fsbSessionIndex']);
      const sessionStorage = stored.fsbSessionLogs || {};
      const sessionIndex = stored.fsbSessionIndex || [];

      // Remove from storage
      delete sessionStorage[sessionId];

      // Remove from index
      const updatedIndex = sessionIndex.filter(s => s.id !== sessionId);

      // Save changes
      await chrome.storage.local.set({
        fsbSessionLogs: sessionStorage,
        fsbSessionIndex: updatedIndex
      });

      console.log(`[FSB Logger] Session ${sessionId} deleted`);
      return true;

    } catch (error) {
      console.error('[FSB Logger] Failed to delete session:', error);
      return false;
    }
  }

  /**
   * Export a session as formatted plain text
   * @param {string} sessionId - The session ID to export
   * @returns {Promise<string>} Formatted session report
   */
  async exportSession(sessionId) {
    try {
      const session = await this.loadSession(sessionId);

      if (!session) {
        return `Session ${sessionId} not found.`;
      }

      return this.formatSessionReport(session);

    } catch (error) {
      console.error('[FSB Logger] Failed to export session:', error);
      return `Error exporting session: ${error.message}`;
    }
  }

  /**
   * Format a session as a readable report
   * @param {Object} session - The session object
   * @returns {string} Formatted report text
   */
  formatSessionReport(session) {
    const lines = [];
    const divider = '='.repeat(80);
    const shortDivider = '-'.repeat(80);

    // Header
    lines.push(divider);
    lines.push('FSB Automation Session Report');
    lines.push(divider);
    lines.push('');

    // Session info
    lines.push(`Session ID: ${session.id}`);
    lines.push(`Task: ${session.task}`);
    lines.push(`Started: ${new Date(session.startTime).toLocaleString()}`);
    lines.push(`Ended: ${new Date(session.endTime).toLocaleString()}`);
    lines.push(`Status: ${session.status.toUpperCase()}`);
    lines.push(`Duration: ${this.formatDuration(session.endTime - session.startTime)}`);
    lines.push(`Total Actions: ${session.actionCount}`);
    lines.push(`Iterations: ${session.iterationCount || 'N/A'}`);
    lines.push('');

    // Log entries
    lines.push(divider);
    lines.push('SESSION LOGS');
    lines.push(divider);
    lines.push('');

    if (session.logs && session.logs.length > 0) {
      session.logs.forEach(log => {
        const time = new Date(log.timestamp).toLocaleTimeString('en-US', {
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          fractionalSecondDigits: 3
        });

        lines.push(`[${time}] [${log.level.toUpperCase()}] ${log.message}`);

        // Include relevant data if present
        if (log.data) {
          const dataStr = this.formatLogData(log.data);
          if (dataStr) {
            lines.push(`  ${dataStr}`);
          }
        }
        lines.push('');
      });
    } else {
      lines.push('No logs recorded for this session.');
    }

    lines.push(divider);
    lines.push(`Report generated: ${new Date().toLocaleString()}`);

    return lines.join('\n');
  }

  /**
   * Format log data for export
   * @param {Object} data - Log data object
   * @returns {string} Formatted data string
   */
  formatLogData(data) {
    if (!data) return '';

    const parts = [];

    // Handle common fields
    if (data.action) {
      parts.push(`Action: ${data.action.tool}(${JSON.stringify(data.action.params || {})})`);
    }
    if (data.result !== undefined) {
      const resultStr = typeof data.result === 'object'
        ? JSON.stringify(data.result)
        : String(data.result);
      parts.push(`Result: ${resultStr.substring(0, 200)}${resultStr.length > 200 ? '...' : ''}`);
    }
    if (data.error) {
      parts.push(`Error: ${data.error}`);
    }
    if (data.iterationCount !== undefined) {
      parts.push(`Iteration: ${data.iterationCount}`);
    }
    if (data.domHash) {
      parts.push(`DOM Hash: ${data.domHash}`);
    }
    if (data.stuckCounter !== undefined) {
      parts.push(`Stuck Counter: ${data.stuckCounter}`);
    }
    if (data.actionCount !== undefined) {
      parts.push(`Actions: ${data.actionCount}`);
    }
    if (data.taskComplete !== undefined) {
      parts.push(`Task Complete: ${data.taskComplete}`);
    }

    return parts.join(' | ');
  }

  /**
   * Clean old sessions to stay within limit
   * @param {Object} sessionStorage - Session storage object
   * @param {Array} sessionIndex - Session index array
   * @param {number} maxSessions - Maximum sessions to keep
   */
  async cleanOldSessions(sessionStorage, sessionIndex, maxSessions = 50) {
    if (sessionIndex.length <= maxSessions) {
      return;
    }

    // Sort by start time (newest first)
    sessionIndex.sort((a, b) => b.startTime - a.startTime);

    // Remove excess sessions
    const toRemove = sessionIndex.slice(maxSessions);
    toRemove.forEach(entry => {
      delete sessionStorage[entry.id];
    });

    // Trim index
    sessionIndex.length = maxSessions;

    console.log(`[FSB Logger] Cleaned ${toRemove.length} old sessions`);
  }

  /**
   * Clear all saved sessions
   * @returns {Promise<boolean>} Success status
   */
  async clearAllSessions() {
    try {
      await chrome.storage.local.remove(['fsbSessionLogs', 'fsbSessionIndex']);
      console.log('[FSB Logger] All sessions cleared');
      return true;
    } catch (error) {
      console.error('[FSB Logger] Failed to clear sessions:', error);
      return false;
    }
  }
}

// Create singleton instance
const automationLogger = new AutomationLogger();

// Load existing logs on initialization
automationLogger.loadLogs();

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = automationLogger;
}