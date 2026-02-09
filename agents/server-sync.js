/**
 * Server Sync for FSB Background Agents
 * Extension-side HTTP client for syncing agent results to the backend server.
 * Fully optional - extension works without server.
 */

class ServerSync {
  constructor() {
    this.MAX_RETRIES = 3;
    this.RETRY_DELAYS = [1000, 3000, 8000]; // Exponential backoff
    this._queue = []; // Queue for failed syncs
    this._syncing = false;
  }

  /**
   * Get server config from storage
   * @returns {Promise<{url: string, hashKey: string, enabled: boolean}>}
   */
  async getConfig() {
    try {
      const stored = await chrome.storage.local.get(['serverUrl', 'serverHashKey', 'serverSyncEnabled']);
      return {
        url: stored.serverUrl || 'https://fsb-server.fly.dev',
        hashKey: stored.serverHashKey || '',
        enabled: stored.serverSyncEnabled || false
      };
    } catch {
      return { url: '', hashKey: '', enabled: false };
    }
  }

  /**
   * Sync a run result to the server
   * @param {Object} agent - Agent data
   * @param {Object} runResult - Run result to sync
   * @returns {Promise<boolean>}
   */
  async syncRun(agent, runResult) {
    const config = await this.getConfig();
    if (!config.url || !config.hashKey) return false;

    const payload = {
      agentId: agent.agentId,
      name: agent.name,
      task: agent.task,
      targetUrl: agent.targetUrl,
      scheduleType: agent.schedule?.type,
      scheduleConfig: JSON.stringify(agent.schedule),
      enabled: agent.enabled,
      run: {
        runId: runResult.runId || 'run_' + Date.now().toString(36),
        startedAt: new Date(Date.now() - (runResult.duration || 0)).toISOString(),
        completedAt: new Date().toISOString(),
        status: runResult.success ? 'success' : 'failed',
        result: runResult.result || null,
        error: runResult.error || null,
        iterations: runResult.iterations || 0,
        tokensUsed: runResult.tokensUsed || 0,
        costUsd: runResult.costUsd || 0,
        durationMs: runResult.duration || 0,
        executionMode: runResult.executionMode || 'ai_initial',
        costSaved: runResult.costSaved || 0
      }
    };

    for (let attempt = 0; attempt < this.MAX_RETRIES; attempt++) {
      try {
        const resp = await fetch(config.url + '/api/agents/' + agent.agentId + '/runs', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-FSB-Hash-Key': config.hashKey
          },
          body: JSON.stringify(payload)
        });

        if (resp.ok) {
          console.log('[FSB Sync] Run synced for agent:', agent.agentId);
          return true;
        }

        if (resp.status === 401) {
          console.warn('[FSB Sync] Invalid hash key, skipping sync');
          return false;
        }

        // Retry on server errors
        if (resp.status >= 500) {
          await this._delay(this.RETRY_DELAYS[attempt] || 8000);
          continue;
        }

        console.warn('[FSB Sync] Sync failed with status:', resp.status);
        return false;

      } catch (error) {
        console.warn('[FSB Sync] Sync attempt', attempt + 1, 'failed:', error.message);
        if (attempt < this.MAX_RETRIES - 1) {
          await this._delay(this.RETRY_DELAYS[attempt] || 8000);
        }
      }
    }

    // All retries failed - queue for later
    this._queueSync(payload, config);
    return false;
  }

  /**
   * Sync agent definition to the server
   * @param {Object} agent - Agent data
   * @returns {Promise<boolean>}
   */
  async syncAgent(agent) {
    const config = await this.getConfig();
    if (!config.url || !config.hashKey) return false;

    try {
      const resp = await fetch(config.url + '/api/agents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-FSB-Hash-Key': config.hashKey
        },
        body: JSON.stringify({
          agentId: agent.agentId,
          name: agent.name,
          task: agent.task,
          targetUrl: agent.targetUrl,
          scheduleType: agent.schedule?.type,
          scheduleConfig: JSON.stringify(agent.schedule),
          enabled: agent.enabled
        })
      });

      return resp.ok;
    } catch (error) {
      console.warn('[FSB Sync] Agent sync failed:', error.message);
      return false;
    }
  }

  /**
   * Queue a failed sync for later retry
   * @param {Object} payload
   * @param {Object} config
   */
  _queueSync(payload, config) {
    this._queue.push({ payload, config, timestamp: Date.now() });
    // Cap queue size
    if (this._queue.length > 100) {
      this._queue = this._queue.slice(-50);
    }
    console.log('[FSB Sync] Queued sync, queue size:', this._queue.length);
  }

  /**
   * Process queued syncs (call periodically or when server becomes reachable)
   */
  async processQueue() {
    if (this._syncing || this._queue.length === 0) return;
    this._syncing = true;

    const config = await this.getConfig();
    if (!config.url || !config.hashKey) {
      this._syncing = false;
      return;
    }

    const failed = [];
    for (const item of this._queue) {
      try {
        const resp = await fetch(config.url + '/api/agents/' + item.payload.agentId + '/runs', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-FSB-Hash-Key': config.hashKey
          },
          body: JSON.stringify(item.payload)
        });

        if (!resp.ok && resp.status >= 500) {
          failed.push(item);
        }
      } catch {
        failed.push(item);
      }
    }

    this._queue = failed;
    this._syncing = false;
    if (failed.length > 0) {
      console.log('[FSB Sync] Queue processed, remaining:', failed.length);
    }
  }

  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export for service worker importScripts
const serverSync = new ServerSync();
