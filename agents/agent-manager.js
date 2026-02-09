/**
 * Background Agent Manager for FSB
 * Handles CRUD operations, run history, and storage coordination for background agents.
 */

class BackgroundAgentManager {
  constructor() {
    this.STORAGE_KEY = 'bgAgents';
    this.MAX_HISTORY = 50;
    this._cache = null;
    this._cacheTime = 0;
    this.CACHE_TTL = 2000; // 2 seconds
  }

  /**
   * Generate a unique agent ID
   * @returns {string}
   */
  _generateId() {
    return 'agent_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 8);
  }

  /**
   * Load all agents from storage
   * @returns {Promise<Object>} Map of agentId -> agent data
   */
  async loadAgents() {
    if (this._cache && Date.now() - this._cacheTime < this.CACHE_TTL) {
      return this._cache;
    }
    try {
      const result = await chrome.storage.local.get(this.STORAGE_KEY);
      this._cache = result[this.STORAGE_KEY] || {};
      this._cacheTime = Date.now();
      return this._cache;
    } catch (error) {
      console.error('[FSB AgentManager] Failed to load agents:', error.message);
      return {};
    }
  }

  /**
   * Save all agents to storage
   * @param {Object} agents - Map of agentId -> agent data
   */
  async saveAgents(agents) {
    try {
      await chrome.storage.local.set({ [this.STORAGE_KEY]: agents });
      this._cache = agents;
      this._cacheTime = Date.now();
    } catch (error) {
      console.error('[FSB AgentManager] Failed to save agents:', error.message);
      throw error;
    }
  }

  /**
   * Create a new background agent
   * @param {Object} params - Agent configuration
   * @param {string} params.name - Agent display name
   * @param {string} params.task - Task description for the AI
   * @param {string} params.targetUrl - URL to navigate to before executing
   * @param {Object} params.schedule - Schedule configuration
   * @param {string} params.schedule.type - 'interval' | 'daily' | 'once'
   * @param {number} [params.schedule.intervalMinutes] - Minutes between runs (for interval type)
   * @param {string} [params.schedule.dailyTime] - HH:MM format (for daily type)
   * @param {number[]} [params.schedule.daysOfWeek] - 0-6, Sun-Sat (for daily type)
   * @param {number} [params.maxIterations=15] - Max automation iterations per run
   * @returns {Promise<Object>} The created agent
   */
  async createAgent(params) {
    const { name, task, targetUrl, schedule, maxIterations = 15, replayEnabled = true } = params;

    if (!name || !task || !targetUrl) {
      throw new Error('Agent requires name, task, and targetUrl');
    }
    if (!schedule || !schedule.type) {
      throw new Error('Agent requires a schedule with type');
    }
    if (!['interval', 'daily', 'once'].includes(schedule.type)) {
      throw new Error('Schedule type must be interval, daily, or once');
    }

    const agents = await this.loadAgents();
    const agentId = this._generateId();

    const agent = {
      agentId,
      name: name.trim(),
      task: task.trim(),
      targetUrl: targetUrl.trim(),
      schedule: { ...schedule },
      enabled: true,
      createdAt: Date.now(),
      lastRunAt: null,
      lastRunStatus: null,
      lastRunResult: null,
      runCount: 0,
      totalTokensUsed: 0,
      totalCostUsd: 0,
      maxIterations: Math.min(Math.max(1, maxIterations), 50),
      serverHashKey: '',
      syncEnabled: false,
      replayEnabled: replayEnabled,
      recordedScript: null,
      replayStats: {
        totalReplays: 0,
        totalAISaves: 0,
        estimatedCostSaved: 0
      },
      runHistory: []
    };

    agents[agentId] = agent;
    await this.saveAgents(agents);

    console.log('[FSB AgentManager] Agent created:', agentId, name);
    return agent;
  }

  /**
   * Update an existing agent
   * @param {string} agentId - Agent to update
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>} Updated agent
   */
  async updateAgent(agentId, updates) {
    const agents = await this.loadAgents();
    const agent = agents[agentId];
    if (!agent) {
      throw new Error('Agent not found: ' + agentId);
    }

    // Fields that can be updated
    const allowedFields = [
      'name', 'task', 'targetUrl', 'schedule', 'enabled',
      'maxIterations', 'serverHashKey', 'syncEnabled',
      'replayEnabled', 'recordedScript', 'replayStats'
    ];

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        if (field === 'maxIterations') {
          agent[field] = Math.min(Math.max(1, updates[field]), 50);
        } else {
          agent[field] = updates[field];
        }
      }
    }

    agents[agentId] = agent;
    await this.saveAgents(agents);

    console.log('[FSB AgentManager] Agent updated:', agentId);
    return agent;
  }

  /**
   * Delete an agent
   * @param {string} agentId - Agent to delete
   * @returns {Promise<boolean>}
   */
  async deleteAgent(agentId) {
    const agents = await this.loadAgents();
    if (!agents[agentId]) {
      return false;
    }
    delete agents[agentId];
    await this.saveAgents(agents);
    console.log('[FSB AgentManager] Agent deleted:', agentId);
    return true;
  }

  /**
   * Get a single agent by ID
   * @param {string} agentId
   * @returns {Promise<Object|null>}
   */
  async getAgent(agentId) {
    const agents = await this.loadAgents();
    return agents[agentId] || null;
  }

  /**
   * List all agents
   * @returns {Promise<Object[]>}
   */
  async listAgents() {
    const agents = await this.loadAgents();
    return Object.values(agents).sort((a, b) => b.createdAt - a.createdAt);
  }

  /**
   * Toggle agent enabled/disabled state
   * @param {string} agentId
   * @returns {Promise<Object>} Updated agent
   */
  async toggleAgent(agentId) {
    const agents = await this.loadAgents();
    const agent = agents[agentId];
    if (!agent) {
      throw new Error('Agent not found: ' + agentId);
    }
    agent.enabled = !agent.enabled;
    agents[agentId] = agent;
    await this.saveAgents(agents);
    console.log('[FSB AgentManager] Agent toggled:', agentId, 'enabled:', agent.enabled);
    return agent;
  }

  /**
   * Record a run result for an agent
   * @param {string} agentId
   * @param {Object} runResult
   * @param {boolean} runResult.success
   * @param {string} [runResult.sessionId]
   * @param {string} [runResult.result]
   * @param {string} [runResult.error]
   * @param {number} [runResult.duration]
   * @param {number} [runResult.tokensUsed]
   * @param {number} [runResult.costUsd]
   * @param {number} [runResult.iterations]
   * @returns {Promise<Object>} Updated agent
   */
  async recordRun(agentId, runResult) {
    const agents = await this.loadAgents();
    const agent = agents[agentId];
    if (!agent) {
      throw new Error('Agent not found: ' + agentId);
    }

    const runEntry = {
      runId: 'run_' + Date.now().toString(36),
      timestamp: Date.now(),
      success: runResult.success,
      sessionId: runResult.sessionId || null,
      result: runResult.result ? runResult.result.substring(0, 500) : null,
      error: runResult.error ? runResult.error.substring(0, 500) : null,
      duration: runResult.duration || 0,
      tokensUsed: runResult.tokensUsed || 0,
      costUsd: runResult.costUsd || 0,
      iterations: runResult.iterations || 0,
      executionMode: runResult.executionMode || 'ai_initial',
      replayFailedAtStep: runResult.replayFailedAtStep || null,
      costSaved: runResult.costSaved || 0
    };

    // Update agent stats
    agent.lastRunAt = Date.now();
    agent.lastRunStatus = runResult.success ? 'success' : 'failed';
    agent.lastRunResult = runEntry.result || runEntry.error;
    agent.runCount++;
    agent.totalTokensUsed += runEntry.tokensUsed;
    agent.totalCostUsd += runEntry.costUsd;

    // Update replay stats
    if (!agent.replayStats) {
      agent.replayStats = { totalReplays: 0, totalAISaves: 0, estimatedCostSaved: 0 };
    }
    if (runEntry.executionMode === 'replay') {
      agent.replayStats.totalReplays++;
      agent.replayStats.estimatedCostSaved += runEntry.costSaved || 0;
    } else if (runEntry.executionMode === 'ai_fallback') {
      agent.replayStats.totalAISaves++;
    }

    // Add to history, cap at MAX_HISTORY
    if (!agent.runHistory) agent.runHistory = [];
    agent.runHistory.unshift(runEntry);
    if (agent.runHistory.length > this.MAX_HISTORY) {
      agent.runHistory = agent.runHistory.slice(0, this.MAX_HISTORY);
    }

    agents[agentId] = agent;
    await this.saveAgents(agents);

    console.log('[FSB AgentManager] Run recorded for agent:', agentId, 'success:', runResult.success);
    return agent;
  }

  /**
   * Get run history for an agent
   * @param {string} agentId
   * @param {number} [limit=10]
   * @returns {Promise<Object[]>}
   */
  async getRunHistory(agentId, limit = 10) {
    const agent = await this.getAgent(agentId);
    if (!agent) return [];
    return (agent.runHistory || []).slice(0, limit);
  }

  /**
   * Save a recorded script to an agent for replay
   * @param {string} agentId
   * @param {Object} script - RecordedScript object
   * @returns {Promise<Object>} Updated agent
   */
  async saveRecordedScript(agentId, script) {
    const agents = await this.loadAgents();
    const agent = agents[agentId];
    if (!agent) {
      throw new Error('Agent not found: ' + agentId);
    }

    agent.recordedScript = script;
    agents[agentId] = agent;
    await this.saveAgents(agents);

    console.log('[FSB AgentManager] Recorded script saved for agent:', agentId, 'steps:', script?.totalSteps || 0);
    return agent;
  }

  /**
   * Clear the recorded script for an agent (forces AI on next run)
   * @param {string} agentId
   * @returns {Promise<Object>} Updated agent
   */
  async clearRecordedScript(agentId) {
    const agents = await this.loadAgents();
    const agent = agents[agentId];
    if (!agent) {
      throw new Error('Agent not found: ' + agentId);
    }

    agent.recordedScript = null;
    agents[agentId] = agent;
    await this.saveAgents(agents);

    console.log('[FSB AgentManager] Recorded script cleared for agent:', agentId);
    return agent;
  }

  /**
   * Get aggregate stats across all agents
   * @returns {Promise<Object>}
   */
  async getStats() {
    const agents = await this.listAgents();
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;

    let totalRuns = 0;
    let runsToday = 0;
    let successfulRuns = 0;
    let totalTokens = 0;
    let totalCost = 0;
    let totalReplayRuns = 0;
    let totalCostSaved = 0;

    for (const agent of agents) {
      totalRuns += agent.runCount;
      totalTokens += agent.totalTokensUsed;
      totalCost += agent.totalCostUsd;

      if (agent.replayStats) {
        totalReplayRuns += agent.replayStats.totalReplays || 0;
        totalCostSaved += agent.replayStats.estimatedCostSaved || 0;
      }

      for (const run of (agent.runHistory || [])) {
        if (run.timestamp > oneDayAgo) {
          runsToday++;
          if (run.success) successfulRuns++;
        }
      }
    }

    return {
      totalAgents: agents.length,
      enabledAgents: agents.filter(a => a.enabled).length,
      totalRuns,
      runsToday,
      successRate: totalRuns > 0 ? Math.round((successfulRuns / Math.max(runsToday, 1)) * 100) : 0,
      totalTokens,
      totalCost: Math.round(totalCost * 10000) / 10000,
      totalReplayRuns,
      totalCostSaved: Math.round(totalCostSaved * 10000) / 10000
    };
  }
}

// Export for service worker importScripts
const agentManager = new BackgroundAgentManager();
