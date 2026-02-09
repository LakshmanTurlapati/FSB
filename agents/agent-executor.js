/**
 * Background Agent Executor for FSB
 * Wraps existing automation infrastructure for headless background execution.
 * Creates background tabs, runs automation, captures results, closes tabs.
 * Supports session replay: after a successful AI run, records the action sequence
 * as a script. Subsequent runs replay the script directly (no AI, zero cost).
 * If replay fails, falls back to AI and updates the script on success.
 */

// Read-only tools that exist only for AI decision-making -- skip during replay
const READONLY_TOOLS = new Set([
  'getText', 'getAttribute', 'waitForElement', 'listTabs',
  'getCurrentTab', 'detectLoadingState', 'waitForDOMStable'
]);

// Tools that trigger page navigation -- need extra wait after replay
const NAVIGATION_TOOLS = new Set([
  'navigate', 'searchGoogle', 'goBack', 'goForward', 'refresh'
]);

class AgentExecutor {
  constructor() {
    this.MAX_CONCURRENT = 3;
    this.EXECUTION_TIMEOUT = 4 * 60 * 1000; // 4 minutes (under MV3's 5-min limit)
    this._running = new Map(); // agentId -> { tabId, startTime, timeoutId }
  }

  /**
   * Get count of currently running agents
   * @returns {number}
   */
  get runningCount() {
    return this._running.size;
  }

  /**
   * Check if an agent is currently running
   * @param {string} agentId
   * @returns {boolean}
   */
  isRunning(agentId) {
    return this._running.has(agentId);
  }

  /**
   * Execute an agent's task in a background tab.
   * Decides between replay mode and AI mode based on agent configuration.
   * @param {Object} agent - Agent data from storage
   * @returns {Promise<Object>} Run result
   */
  async execute(agent) {
    if (this._running.size >= this.MAX_CONCURRENT) {
      return {
        success: false,
        error: 'Max concurrent agents reached (' + this.MAX_CONCURRENT + '). Try again later.',
        duration: 0
      };
    }

    if (this._running.has(agent.agentId)) {
      return {
        success: false,
        error: 'Agent is already running',
        duration: 0
      };
    }

    const startTime = Date.now();
    let backgroundTab = null;

    try {
      console.log('[FSB Executor] Starting agent:', agent.agentId, agent.name);

      // Create background tab
      backgroundTab = await chrome.tabs.create({
        url: agent.targetUrl,
        active: false
      });

      // Register running state
      const executionState = {
        tabId: backgroundTab.id,
        startTime,
        timeoutId: null
      };
      this._running.set(agent.agentId, executionState);

      // Wait for page to load
      await this._waitForTabLoad(backgroundTab.id, 15000);

      // Wait for content script to be ready
      await this._ensureContentScript(backgroundTab.id);

      // --- Decision gate: replay or AI? ---
      const hasScript = agent.recordedScript &&
        agent.recordedScript.steps &&
        agent.recordedScript.steps.length > 0;
      const replayEnabled = agent.replayEnabled !== false;

      if (hasScript && replayEnabled) {
        // --- REPLAY PATH ---
        console.log('[FSB Executor] Attempting replay for agent:', agent.agentId,
          'steps:', agent.recordedScript.steps.length);

        const replayResult = await this._executeWithTimeoutReplay(
          backgroundTab.id, agent.recordedScript, agent
        );

        if (replayResult.success) {
          // Replay succeeded -- zero cost
          const duration = Date.now() - startTime;
          const costSaved = agent.recordedScript.estimatedCostPerRun || 0.002;
          console.log('[FSB Executor] Replay succeeded for agent:', agent.agentId,
            'duration:', duration + 'ms', 'costSaved: $' + costSaved);

          return {
            success: true,
            sessionId: null,
            result: 'Task completed via replay (' + agent.recordedScript.totalSteps + ' steps)',
            error: null,
            duration,
            tokensUsed: 0,
            costUsd: 0,
            iterations: 0,
            executionMode: 'replay',
            costSaved
          };
        }

        // --- Replay failed: close tab, reopen fresh, run AI fallback ---
        console.log('[FSB Executor] Replay failed at step', replayResult.failedAtStep,
          '- falling back to AI for agent:', agent.agentId,
          'error:', replayResult.error);

        // Close the failed tab
        if (backgroundTab?.id) {
          await chrome.tabs.remove(backgroundTab.id).catch(() => {});
        }

        // Open fresh tab for AI fallback
        backgroundTab = await chrome.tabs.create({
          url: agent.targetUrl,
          active: false
        });

        // Update running state with new tab
        executionState.tabId = backgroundTab.id;

        await this._waitForTabLoad(backgroundTab.id, 15000);
        await this._ensureContentScript(backgroundTab.id);

        // Run AI fallback
        const aiResult = await this._executeWithTimeout(
          backgroundTab.id,
          agent.task,
          {
            maxIterations: agent.maxIterations || 15,
            isBackgroundAgent: true,
            agentId: agent.agentId
          }
        );

        const duration = Date.now() - startTime;

        // If AI succeeds, update the recorded script
        if (aiResult.success && aiResult.actionHistory) {
          const newScript = this._extractRecordedScript(
            aiResult, agent.targetUrl, aiResult.actionHistory
          );
          if (newScript) {
            try {
              await agentManager.saveRecordedScript(agent.agentId, newScript);
              console.log('[FSB Executor] Updated recorded script after AI fallback for agent:', agent.agentId);
            } catch (e) {
              console.error('[FSB Executor] Failed to save updated script:', e.message);
            }
          }
        }

        return {
          success: aiResult.success,
          sessionId: aiResult.sessionId || null,
          result: aiResult.result || null,
          error: aiResult.error || null,
          duration,
          tokensUsed: aiResult.tokensUsed || 0,
          costUsd: aiResult.costUsd || 0,
          iterations: aiResult.iterations || 0,
          executionMode: 'ai_fallback',
          replayFailedAtStep: replayResult.failedAtStep,
          costSaved: 0
        };
      }

      // --- AI PATH (no script yet) ---
      const result = await this._executeWithTimeout(
        backgroundTab.id,
        agent.task,
        {
          maxIterations: agent.maxIterations || 15,
          isBackgroundAgent: true,
          agentId: agent.agentId
        }
      );

      const duration = Date.now() - startTime;
      console.log('[FSB Executor] Agent completed:', agent.agentId,
        'success:', result.success, 'duration:', duration + 'ms');

      // If AI succeeds, extract and save the script for future replays
      if (result.success && result.actionHistory) {
        const script = this._extractRecordedScript(
          result, agent.targetUrl, result.actionHistory
        );
        if (script) {
          try {
            await agentManager.saveRecordedScript(agent.agentId, script);
            console.log('[FSB Executor] Saved initial recorded script for agent:', agent.agentId,
              'steps:', script.totalSteps);
          } catch (e) {
            console.error('[FSB Executor] Failed to save script:', e.message);
          }
        }
      }

      return {
        success: result.success,
        sessionId: result.sessionId || null,
        result: result.result || null,
        error: result.error || null,
        duration,
        tokensUsed: result.tokensUsed || 0,
        costUsd: result.costUsd || 0,
        iterations: result.iterations || 0,
        executionMode: 'ai_initial',
        costSaved: 0
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      console.error('[FSB Executor] Agent failed:', agent.agentId, error.message);
      return {
        success: false,
        error: error.message,
        duration,
        executionMode: 'ai_initial',
        costSaved: 0
      };
    } finally {
      // Cleanup: close background tab and clear running state
      this._cleanup(agent.agentId, backgroundTab?.id);
    }
  }

  /**
   * Extract a recorded script from a successful AI run's action history.
   * Filters to only successful, meaningful actions and assigns delays.
   * @param {Object} result - The AI execution result
   * @param {string} targetUrl - Agent's target URL
   * @param {Object[]} actionHistory - Array of action records from the session
   * @returns {Object|null} RecordedScript object, or null if no meaningful steps
   */
  _extractRecordedScript(result, targetUrl, actionHistory) {
    if (!actionHistory || actionHistory.length === 0) return null;

    const steps = [];
    let stepNumber = 0;

    for (const action of actionHistory) {
      // Only include actions that succeeded
      if (action.result && action.result.success === false) continue;
      // Skip if no tool specified
      if (!action.tool) continue;

      const isReadOnly = READONLY_TOOLS.has(action.tool);
      const isNavigation = NAVIGATION_TOOLS.has(action.tool);

      // Determine delay after this step
      let delayAfter = 500; // default
      if (isNavigation) {
        delayAfter = 2000;
      } else if (action.tool === 'type' || action.tool === 'clearInput') {
        delayAfter = 300;
      } else if (action.tool === 'click') {
        delayAfter = 800;
      }

      steps.push({
        stepNumber: stepNumber++,
        tool: action.tool,
        params: action.params || {},
        isNavigation,
        isReadOnly,
        delayAfter,
        metadata: {
          originalResult: {
            success: action.result?.success !== false,
            hadEffect: action.result?.hadEffect || action.result?.success !== false
          },
          originalDuration: action.duration || 0
        }
      });
    }

    // Filter out scripts with no meaningful (non-read-only) actions
    const meaningfulSteps = steps.filter(s => !s.isReadOnly);
    if (meaningfulSteps.length === 0) return null;

    const estimatedDuration = steps.reduce((sum, s) => sum + s.delayAfter + 200, 0);
    const estimatedCostPerRun = result.costUsd || 0.002;

    return {
      version: '1.0',
      recordedAt: Date.now(),
      sourceSessionId: result.sessionId || null,
      targetUrl,
      steps,
      totalSteps: steps.length,
      estimatedDuration,
      estimatedCostPerRun
    };
  }

  /**
   * Execute a recorded script by replaying actions sequentially.
   * Skips read-only steps. Fails fast on first step failure.
   * @param {number} tabId - Tab to execute in
   * @param {Object} script - RecordedScript object
   * @param {Object} agent - Agent data
   * @returns {Promise<Object>} { success, failedAtStep, error, duration }
   */
  async _executeReplayScript(tabId, script, agent) {
    const replayStart = Date.now();

    for (const step of script.steps) {
      // Skip read-only steps -- they were for AI reasoning
      if (step.isReadOnly) continue;

      try {
        // Send the action to the content script
        const actionResult = await sendMessageWithRetry(tabId, {
          action: 'executeAction',
          tool: step.tool,
          params: step.params
        });

        if (!actionResult || actionResult.success === false) {
          return {
            success: false,
            failedAtStep: step.stepNumber,
            error: 'Step ' + step.stepNumber + ' (' + step.tool + ') failed: ' +
              (actionResult?.error || 'action returned failure'),
            duration: Date.now() - replayStart
          };
        }

        // After navigation steps, wait for page to settle
        if (step.isNavigation) {
          try {
            await pageLoadWatcher.waitForPageReady(tabId, { maxWait: 8000 });
          } catch (e) {
            // Page load timeout is not necessarily fatal -- continue
            console.log('[FSB Executor] Page load wait timed out after navigation replay step:', step.stepNumber);
          }

          // Re-check content script after navigation
          try {
            await waitForContentScriptReady(tabId, 5000);
          } catch (e) {
            await ensureContentScriptInjected(tabId);
            const ready = await waitForContentScriptReady(tabId, 3000);
            if (!ready) {
              return {
                success: false,
                failedAtStep: step.stepNumber,
                error: 'Content script lost after navigation at step ' + step.stepNumber,
                duration: Date.now() - replayStart
              };
            }
          }
        }

        // Wait the prescribed delay before the next step
        if (step.delayAfter > 0) {
          await new Promise(resolve => setTimeout(resolve, step.delayAfter));
        }

      } catch (error) {
        return {
          success: false,
          failedAtStep: step.stepNumber,
          error: 'Step ' + step.stepNumber + ' (' + step.tool + ') threw: ' + error.message,
          duration: Date.now() - replayStart
        };
      }
    }

    return {
      success: true,
      failedAtStep: null,
      error: null,
      duration: Date.now() - replayStart
    };
  }

  /**
   * Execute replay script with a timeout.
   * Timeout is based on the script's estimated duration with a 3x multiplier.
   * @param {number} tabId
   * @param {Object} script - RecordedScript
   * @param {Object} agent
   * @returns {Promise<Object>}
   */
  _executeWithTimeoutReplay(tabId, script, agent) {
    const timeout = Math.min(
      (script.estimatedDuration || 30000) * 3,
      this.EXECUTION_TIMEOUT * 0.6
    );

    return new Promise((resolve) => {
      const timeoutId = setTimeout(() => {
        resolve({
          success: false,
          failedAtStep: -1,
          error: 'Replay timed out after ' + Math.round(timeout / 1000) + 's',
          duration: timeout
        });
      }, timeout);

      this._executeReplayScript(tabId, script, agent)
        .then(result => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeoutId);
          resolve({
            success: false,
            failedAtStep: -1,
            error: 'Replay error: ' + error.message,
            duration: 0
          });
        });
    });
  }

  /**
   * Ensure content script is loaded and ready on a tab
   * @param {number} tabId
   */
  async _ensureContentScript(tabId) {
    const isReady = await waitForContentScriptReady(tabId, 8000);
    if (!isReady) {
      await ensureContentScriptInjected(tabId);
      const retryReady = await waitForContentScriptReady(tabId, 5000);
      if (!retryReady) {
        throw new Error('Content script failed to initialize on target page');
      }
    }
  }

  /**
   * Execute automation with a timeout wrapper
   * @param {number} tabId
   * @param {string} task
   * @param {Object} options
   * @returns {Promise<Object>}
   */
  _executeWithTimeout(tabId, task, options) {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('Agent execution timed out after ' + (this.EXECUTION_TIMEOUT / 1000) + ' seconds'));
      }, this.EXECUTION_TIMEOUT);

      // Store timeout so we can clear it on cleanup
      const state = this._running.get(options.agentId);
      if (state) state.timeoutId = timeoutId;

      // Use the shared executeAutomationTask function from background.js
      executeAutomationTask(tabId, task, options)
        .then(result => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }

  /**
   * Wait for a tab to finish loading
   * @param {number} tabId
   * @param {number} timeout
   * @returns {Promise<void>}
   */
  _waitForTabLoad(tabId, timeout = 15000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        chrome.tabs.onUpdated.removeListener(listener);
        // Proceed even if timeout - page might be usable
        resolve();
      }, timeout);

      const listener = (updatedTabId, changeInfo) => {
        if (updatedTabId === tabId && changeInfo.status === 'complete') {
          clearTimeout(timer);
          chrome.tabs.onUpdated.removeListener(listener);
          // Small delay for dynamic content
          setTimeout(resolve, 500);
        }
      };

      // Check if already loaded
      chrome.tabs.get(tabId).then(tab => {
        if (tab.status === 'complete') {
          clearTimeout(timer);
          chrome.tabs.onUpdated.removeListener(listener);
          setTimeout(resolve, 500);
        } else {
          chrome.tabs.onUpdated.addListener(listener);
        }
      }).catch(() => {
        clearTimeout(timer);
        reject(new Error('Tab not accessible'));
      });
    });
  }

  /**
   * Cleanup after an agent execution
   * @param {string} agentId
   * @param {number} [tabId]
   */
  _cleanup(agentId, tabId) {
    const state = this._running.get(agentId);
    if (state?.timeoutId) {
      clearTimeout(state.timeoutId);
    }
    this._running.delete(agentId);

    // Close background tab
    if (tabId) {
      chrome.tabs.remove(tabId).catch(() => {
        // Tab may already be closed
      });
    }
  }

  /**
   * Force-stop a running agent
   * @param {string} agentId
   */
  async forceStop(agentId) {
    const state = this._running.get(agentId);
    if (!state) return;

    console.log('[FSB Executor] Force stopping agent:', agentId);
    this._cleanup(agentId, state.tabId);
  }

  /**
   * Get status of all running agents
   * @returns {Object[]}
   */
  getRunningAgents() {
    const result = [];
    for (const [agentId, state] of this._running) {
      result.push({
        agentId,
        tabId: state.tabId,
        runningFor: Date.now() - state.startTime
      });
    }
    return result;
  }
}

// Export for service worker importScripts
const agentExecutor = new AgentExecutor();
