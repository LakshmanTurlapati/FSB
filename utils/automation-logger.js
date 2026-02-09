// Guard against re-injection - content scripts can be injected multiple times
// Use globalThis which works in both service workers (self) and content scripts (window)
if (globalThis.__FSB_AUTOMATION_LOGGER_LOADED__) {
  console.log('[FSB] automation-logger.js already loaded, skipping');
} else {
  // Mark as loaded
  globalThis.__FSB_AUTOMATION_LOGGER_LOADED__ = true;
  console.log('[FSB] automation-logger.js loading');

  // Automation Logger for FSB v9.0.1
  // Provides structured logging for debugging automation loops

  class AutomationLogger {
    constructor() {
      this.logs = [];
      this.maxLogs = 5000;
      this.logLevel = 'debug';
      this.maxSessionLogs = 1000;
      this.storageMode = 'full';
      this.actionRecords = [];
      this._persistTimer = null;
    }

    log(level, message, data = null) {
      const entry = {
        timestamp: new Date().toISOString(),
        level,
        message,
        data
      };

      this.logs.push(entry);

      if (this.logs.length > this.maxLogs) {
        this.logs.shift();
      }

      const consoleMethod = level === 'error' ? 'error' :
                           level === 'warn' ? 'warn' :
                           'log';
      console[consoleMethod](`[FSB ${level.toUpperCase()}]`, message, data || '');

      // PERF: Debounce persistLogs to batch writes every 2 seconds
      if (!this._persistTimer) {
        this._persistTimer = setTimeout(() => {
          this.persistLogs();
          this._persistTimer = null;
        }, 2000);
      }
    }

    error(message, data) { this.log('error', message, data); }
    warn(message, data) { this.log('warn', message, data); }
    info(message, data) { this.log('info', message, data); }
    debug(message, data) { this.log('debug', message, data); }

    logSessionStart(sessionId, task, tabId) {
      this.info('Automation session started', {
        sessionId, task, tabId,
        startTime: new Date().toISOString()
      });
    }

    logIteration(sessionId, iterationCount, domHash, stuckCounter) {
      this.debug(`Iteration ${iterationCount}`, {
        sessionId, iterationCount, domHash, stuckCounter,
        isStuck: stuckCounter >= 3
      });
    }

    logAction(sessionId, action, result) {
      const level = result?.success ? 'info' : 'warn';
      this.log(level, `Action ${action.tool} ${result?.success ? 'succeeded' : 'failed'}`, {
        sessionId, action, result,
        timestamp: new Date().toISOString()
      });
    }

    logAIResponse(sessionId, reasoning, actions, taskComplete) {
      this.info('AI response received', {
        sessionId,
        actionCount: actions?.length || 0,
        actions: actions?.map(a => `${a.tool}(${JSON.stringify(a.params)})`),
        taskComplete
      });
    }

    logStuckDetection(sessionId, stuckCounter, lastActions) {
      this.warn('Automation may be stuck', {
        sessionId, stuckCounter,
        lastActions: lastActions.slice(-5).map(a => ({
          tool: a.tool, success: a.result?.success, error: a.result?.error
        }))
      });
    }

    logSessionEnd(sessionId, status, totalActions, duration) {
      this.info('Automation session ended', {
        sessionId, status, totalActions,
        duration: `${duration}ms`,
        durationReadable: this.formatDuration(duration)
      });
    }

    logPrompt(sessionId, systemPrompt, userPrompt, iteration) {
      this.debug('AI Prompt', {
        sessionId, iteration, logType: 'prompt',
        systemPrompt: systemPrompt ? systemPrompt.substring(0, 5000) : '',
        userPrompt: userPrompt ? userPrompt.substring(0, 10000) : '',
        systemPromptLength: systemPrompt?.length || 0,
        userPromptLength: userPrompt?.length || 0
      });
    }

    logRawResponse(sessionId, rawResponse, parseSuccess, iteration = null) {
      this.debug('AI Raw Response', {
        sessionId, iteration, logType: 'rawResponse',
        rawResponse: rawResponse ? rawResponse.substring(0, 10000) : '',
        rawResponseLength: rawResponse?.length || 0,
        parseSuccess,
        truncated: (rawResponse?.length || 0) > 10000
      });
    }

    logReasoning(sessionId, reasoning, iteration = null) {
      this.info('AI Reasoning', {
        sessionId, iteration, logType: 'reasoning',
        situationAnalysis: reasoning?.situationAnalysis || '',
        goalAssessment: reasoning?.goalAssessment || '',
        reasoning: reasoning?.reasoning || '',
        confidence: reasoning?.confidence || 'unknown'
      });
    }

    logDOMState(sessionId, domState, iteration) {
      const elements = domState?.elements || [];

      // Handle delta payloads where elements array is empty but _totalElements tracks the real count
      let elementCount = elements.length;
      let deltaInfo = null;
      if (domState?._isDelta && domState?.type === 'delta') {
        elementCount = domState._totalElements || 0;
        const added = domState.changes?.added?.length || 0;
        const removed = domState.changes?.removed?.length || 0;
        const modified = domState.changes?.modified?.length || 0;
        deltaInfo = `delta: +${added}/-${removed}/~${modified}`;
      }

      const elementSummary = elements.slice(0, 50).map(el => ({
        type: el.type, id: el.id || '',
        text: el.text ? el.text.substring(0, 50) : '',
        selector: el.selectors?.[0] || ''
      }));

      this.debug(`DOM State: ${elementCount} elements${deltaInfo ? ` (${deltaInfo})` : ''}`, {
        sessionId, iteration, logType: 'domState',
        url: domState?.url || '', title: domState?.title || '',
        elementCount,
        isDelta: !!domState?._isDelta,
        deltaInfo,
        elementSummary,
        pageState: domState?.pageContext?.pageState || null,
        pageTypes: domState?.pageContext?.pageTypes || null
      });
    }

    logContentMessage(sessionId, direction, messageType, payload = null, result = null) {
      this.debug('Content Script Message', {
        sessionId, logType: 'contentMessage',
        direction, messageType,
        success: result?.success
      });
    }

    logTokenUsage(sessionId, model, inputTokens, outputTokens, source, iteration = null) {
      this.info('Token Usage', {
        sessionId, iteration, logType: 'tokenUsage',
        model: model || 'unknown',
        inputTokens: inputTokens || 0,
        outputTokens: outputTokens || 0,
        totalTokens: (inputTokens || 0) + (outputTokens || 0)
      });
    }

    logTiming(sessionId, category, operation, durationMs, details = {}) {
      this.debug('Timing', {
        sessionId, logType: 'timing',
        category, operation, durationMs, ...details
      });
    }

    logComm(sessionId, direction, type, success, details = {}) {
      const level = success ? 'debug' : 'warn';
      this.log(level, 'Communication', {
        sessionId, logType: 'comm',
        direction, type, success, ...details
      });
    }

    logRecovery(sessionId, issue, action, result, details = {}) {
      const level = result === 'success' ? 'info' : 'warn';
      this.log(level, 'Recovery', {
        sessionId, logType: 'recovery',
        issue, action, result, ...details
      });
    }

    logNavigation(sessionId, type, from, to, details = {}) {
      this.info('Navigation', {
        sessionId, logType: 'navigation', type,
        from: from ? from.substring(0, 200) : '',
        to: to ? to.substring(0, 200) : '',
        ...details
      });
    }

    logDOMOperation(sessionId, operation, metrics = {}, details = {}) {
      this.debug('DOM Operation', {
        sessionId, logType: 'domOperation',
        operation, ...metrics, ...details
      });
    }

    logActionExecution(sessionId, tool, phase, details = {}) {
      const level = phase === 'complete' && details.success === false ? 'warn' : 'debug';
      this.log(level, 'Action Execution', {
        sessionId, logType: 'actionExec',
        tool, phase, ...details
      });
    }

    logActionRecord(record) {
      if (!record || !record.tool || !record.timestamp) {
        this.warn('Invalid action record', { record });
        return;
      }
      const level = (!record.success || !record.elementFound) ? 'warn' : 'info';
      this.log(level, 'Action Record', { ...record, logType: 'actionRecord' });
      this.actionRecords.push(record);
      if (this.actionRecords.length > 500) {
        this.actionRecords = this.actionRecords.slice(-250);
      }
    }

    getSessionActionRecords(sessionId) {
      return this.actionRecords.filter(r => r.sessionId === sessionId);
    }

    async getReplayData(sessionId) {
      const session = await this.loadSession(sessionId);
      if (!session) return null;
      const actionRecords = this.getSessionActionRecords(sessionId);
      return {
        version: '1.0', id: sessionId,
        metadata: {
          task: session.task, startTime: session.startTime,
          endTime: session.endTime, status: session.status,
          actionCount: actionRecords.length
        },
        steps: actionRecords.map((record, index) => ({
          stepNumber: index + 1, timestamp: record.timestamp,
          action: { tool: record.tool, params: record.params || {} },
          targeting: {
            selectorTried: record.selectorTried,
            selectorUsed: record.selectorUsed,
            elementFound: record.elementFound,
            coordinatesUsed: record.coordinatesUsed
          },
          result: {
            success: record.success, error: record.error,
            hadEffect: record.hadEffect, diagnostic: record.diagnostic
          },
          duration: record.duration
        })),
        summary: {
          totalSteps: actionRecords.length,
          successfulSteps: actionRecords.filter(r => r.success).length,
          failedSteps: actionRecords.filter(r => !r.success).length
        }
      };
    }

    async exportHumanReadable(sessionId) {
      const replay = await this.getReplayData(sessionId);
      if (!replay) return 'Session not found.';
      const lines = [];
      lines.push('=' .repeat(80));
      lines.push('FSB AUTOMATION SESSION REPORT');
      lines.push('='.repeat(80));
      lines.push(`Session ID: ${replay.id}`);
      lines.push(`Task: ${replay.metadata.task}`);
      lines.push(`Status: ${replay.metadata.status}`);
      lines.push(`Steps: ${replay.summary.successfulSteps}/${replay.summary.totalSteps} successful`);
      lines.push('');
      replay.steps.forEach(step => {
        const status = step.result.success ? '[OK]' : '[FAILED]';
        lines.push(`${status} Step ${step.stepNumber}: ${step.action.tool}`);
        lines.push(`    Selector: ${step.targeting.selectorUsed || step.targeting.selectorTried || 'N/A'}`);
      });
      return lines.join('\n');
    }

    logAPI(sessionId, provider, operation, details = {}) {
      this.debug('API', {
        sessionId, logType: 'api', provider, operation, ...details
      });
    }

    logServiceWorker(event, details = {}) {
      this.debug('Service Worker', {
        logType: 'serviceWorker', event, ...details
      });
    }

    logInit(component, status, details = {}) {
      const level = status === 'failed' ? 'error' : 'info';
      this.log(level, 'Init', {
        logType: 'init', component, status, ...details
      });
    }

    logQueue(sessionId, operation, details = {}) {
      this.debug('Queue', {
        sessionId, logType: 'queue', operation, ...details
      });
    }

    logCache(sessionId, operation, key, details = {}) {
      this.debug('Cache', {
        sessionId, logType: 'cache', operation,
        key: key ? key.substring(0, 100) : '', ...details
      });
    }

    logValidation(sessionId, type, valid, details = {}) {
      const level = valid ? 'debug' : 'warn';
      this.log(level, 'Validation', {
        sessionId, logType: 'validation', type, valid, ...details
      });
    }

    formatDuration(ms) {
      const seconds = Math.floor(ms / 1000);
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;
      if (minutes > 0) return `${minutes}m ${remainingSeconds}s`;
      return `${seconds}s`;
    }

    getRecentLogs(count = 50) { return this.logs.slice(-count); }
    getSessionLogs(sessionId) { return this.logs.filter(log => log.data?.sessionId === sessionId); }
    clearLogs() {
      this.logs = [];
      // Cancel any pending debounced write and persist immediately
      if (this._persistTimer) {
        clearTimeout(this._persistTimer);
        this._persistTimer = null;
      }
      this.persistLogs();
    }

    // Flush any pending debounced log writes (call at session end)
    flush() {
      if (this._persistTimer) {
        clearTimeout(this._persistTimer);
        this._persistTimer = null;
        this.persistLogs();
      }
    }

    async persistLogs() {
      try {
        const recentLogs = this.logs.slice(-100);
        await chrome.storage.local.set({ automationLogs: recentLogs });
      } catch (error) {
        console.error('Failed to persist logs:', error);
      }
    }

    async loadLogs() {
      try {
        const stored = await chrome.storage.local.get('automationLogs');
        if (stored.automationLogs) this.logs = stored.automationLogs;
      } catch (error) {
        console.error('Failed to load logs:', error);
      }
    }

    exportLogs() {
      const logsJson = JSON.stringify(this.logs, null, 2);
      const blob = new Blob([logsJson], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      return { url, filename: `fsb-automation-logs-${timestamp}.json` };
    }

    generateReport(sessionId = null) {
      const relevantLogs = sessionId ? this.getSessionLogs(sessionId) : this.logs;
      return {
        totalLogs: relevantLogs.length,
        errors: relevantLogs.filter(l => l.level === 'error').length,
        warnings: relevantLogs.filter(l => l.level === 'warn').length
      };
    }

    async saveSession(sessionId, sessionData = {}) {
      try {
        const sessionLogs = this.getSessionLogs(sessionId);
        if (sessionLogs.length === 0) return false;
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
        const stored = await chrome.storage.local.get(['fsbSessionLogs', 'fsbSessionIndex']);
        const sessionStorage = stored.fsbSessionLogs || {};
        const sessionIndex = stored.fsbSessionIndex || [];
        sessionStorage[sessionId] = session;
        const indexEntry = {
          id: sessionId, task: session.task, startTime: session.startTime,
          endTime: session.endTime, status: session.status, actionCount: session.actionCount
        };
        const existingIndex = sessionIndex.findIndex(s => s.id === sessionId);
        if (existingIndex !== -1) sessionIndex[existingIndex] = indexEntry;
        else sessionIndex.unshift(indexEntry);
        if (sessionIndex.length > 50) {
          const toRemove = sessionIndex.slice(50);
          toRemove.forEach(entry => delete sessionStorage[entry.id]);
          sessionIndex.length = 50;
        }
        await chrome.storage.local.set({ fsbSessionLogs: sessionStorage, fsbSessionIndex: sessionIndex });
        console.log(`[FSB Logger] Session ${sessionId} saved with ${sessionLogs.length} logs`);
        return true;
      } catch (error) {
        console.error('[FSB Logger] Failed to save session:', error);
        return false;
      }
    }

    async loadSession(sessionId) {
      try {
        const stored = await chrome.storage.local.get(['fsbSessionLogs']);
        return (stored.fsbSessionLogs || {})[sessionId] || null;
      } catch (error) {
        console.error('[FSB Logger] Failed to load session:', error);
        return null;
      }
    }

    async listSessions() {
      try {
        const stored = await chrome.storage.local.get(['fsbSessionIndex']);
        return stored.fsbSessionIndex || [];
      } catch (error) {
        return [];
      }
    }

    async deleteSession(sessionId) {
      try {
        const stored = await chrome.storage.local.get(['fsbSessionLogs', 'fsbSessionIndex']);
        const sessionStorage = stored.fsbSessionLogs || {};
        const sessionIndex = stored.fsbSessionIndex || [];
        delete sessionStorage[sessionId];
        const updatedIndex = sessionIndex.filter(s => s.id !== sessionId);
        await chrome.storage.local.set({ fsbSessionLogs: sessionStorage, fsbSessionIndex: updatedIndex });
        return true;
      } catch (error) {
        return false;
      }
    }

    async exportSession(sessionId) {
      const session = await this.loadSession(sessionId);
      if (!session) return `Session ${sessionId} not found.`;
      const lines = [];
      lines.push('='.repeat(80));
      lines.push('FSB Automation Session Report');
      lines.push('='.repeat(80));
      lines.push(`Session ID: ${session.id}`);
      lines.push(`Task: ${session.task}`);
      lines.push(`Started: ${new Date(session.startTime).toLocaleString()}`);
      lines.push(`Ended: ${new Date(session.endTime).toLocaleString()}`);
      lines.push(`Status: ${session.status.toUpperCase()}`);
      lines.push(`Duration: ${this.formatDuration(session.endTime - session.startTime)}`);
      lines.push(`Total Actions: ${session.actionCount}`);
      lines.push('');
      lines.push('SESSION LOGS');
      lines.push('-'.repeat(80));
      (session.logs || []).forEach(log => {
        const time = new Date(log.timestamp).toLocaleTimeString();
        lines.push(`[${time}] [${log.level.toUpperCase()}] ${log.message}`);
      });
      lines.push('');
      lines.push(`Report generated: ${new Date().toLocaleString()}`);
      return lines.join('\n');
    }

    async clearAllSessions() {
      try {
        await chrome.storage.local.remove(['fsbSessionLogs', 'fsbSessionIndex']);
        return true;
      } catch (error) {
        return false;
      }
    }
  }

  // Create singleton and attach to globalThis (works in both service workers and content scripts)
  globalThis.automationLogger = new AutomationLogger();
  globalThis.automationLogger.loadLogs();
}

// Export from globalThis - use var because it can be re-declared safely
var automationLogger = globalThis.automationLogger;
