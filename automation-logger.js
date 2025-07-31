// Automation Logger for FSB v0.1
// Provides structured logging for debugging automation loops

class AutomationLogger {
  constructor() {
    this.logs = [];
    this.maxLogs = 1000;
    this.logLevel = 'debug'; // 'error', 'warn', 'info', 'debug'
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
}

// Create singleton instance
const automationLogger = new AutomationLogger();

// Load existing logs on initialization
automationLogger.loadLogs();

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = automationLogger;
}