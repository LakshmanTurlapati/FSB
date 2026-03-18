/**
 * Parameterized database queries
 */

class Queries {
  constructor(db) {
    this.db = db;
    this._prepareStatements();
  }

  _prepareStatements() {
    // Hash keys
    this.insertHashKey = this.db.prepare(
      'INSERT INTO hash_keys (hash_key) VALUES (?)'
    );
    this.getHashKey = this.db.prepare(
      'SELECT * FROM hash_keys WHERE hash_key = ?'
    );
    this.updateLastSeen = this.db.prepare(
      "UPDATE hash_keys SET last_seen_at = datetime('now') WHERE hash_key = ?"
    );

    // Agents
    this.upsertAgent = this.db.prepare(`
      INSERT INTO agents (hash_key, agent_id, name, task, target_url, schedule_type, schedule_config, enabled)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(hash_key, agent_id) DO UPDATE SET
        name = excluded.name,
        task = excluded.task,
        target_url = excluded.target_url,
        schedule_type = excluded.schedule_type,
        schedule_config = excluded.schedule_config,
        enabled = excluded.enabled,
        updated_at = datetime('now')
    `);

    this.getAgents = this.db.prepare(
      'SELECT * FROM agents WHERE hash_key = ? ORDER BY created_at DESC'
    );

    this.getAgent = this.db.prepare(
      'SELECT * FROM agents WHERE hash_key = ? AND agent_id = ?'
    );

    this.deleteAgent = this.db.prepare(
      'DELETE FROM agents WHERE hash_key = ? AND agent_id = ?'
    );

    // Agent runs
    this.insertRun = this.db.prepare(`
      INSERT INTO agent_runs (hash_key, agent_id, run_id, started_at, completed_at, status, result, error, iterations, tokens_used, cost_usd, duration_ms, execution_mode, cost_saved)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    this.getRuns = this.db.prepare(`
      SELECT * FROM agent_runs
      WHERE hash_key = ? AND agent_id = ?
      ORDER BY completed_at DESC
      LIMIT ? OFFSET ?
    `);

    this.getRunCount = this.db.prepare(
      'SELECT COUNT(*) as count FROM agent_runs WHERE hash_key = ? AND agent_id = ?'
    );

    this.getRecentRuns = this.db.prepare(`
      SELECT * FROM agent_runs
      WHERE hash_key = ?
      ORDER BY completed_at DESC
      LIMIT ?
    `);

    // Stats
    this.getStats = this.db.prepare(`
      SELECT
        COUNT(DISTINCT agent_id) as total_agents,
        COUNT(*) as total_runs,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful_runs,
        SUM(tokens_used) as total_tokens,
        SUM(cost_usd) as total_cost,
        SUM(cost_saved) as total_cost_saved,
        SUM(duration_ms) as total_duration
      FROM agent_runs
      WHERE hash_key = ?
    `);

    this.getTodayStats = this.db.prepare(`
      SELECT
        COUNT(*) as runs_today,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful_today
      FROM agent_runs
      WHERE hash_key = ? AND completed_at >= datetime('now', '-1 day')
    `);

    // Pairing tokens
    this.insertPairingToken = this.db.prepare(
      'INSERT INTO pairing_tokens (token, hash_key, expires_at) VALUES (?, ?, ?)'
    );
    this.selectPairingToken = this.db.prepare(
      'SELECT * FROM pairing_tokens WHERE token = ?'
    );
    this.markTokenUsed = this.db.prepare(
      'UPDATE pairing_tokens SET used = 1, session_token = ?, session_expires_at = ? WHERE token = ?'
    );
    this.invalidateTokensByHashKey = this.db.prepare(
      'UPDATE pairing_tokens SET used = 1 WHERE hash_key = ? AND used = 0'
    );
    this.selectSessionByToken = this.db.prepare(
      'SELECT * FROM pairing_tokens WHERE session_token = ? AND used = 1'
    );
    this.cleanExpiredTokens = this.db.prepare(
      "DELETE FROM pairing_tokens WHERE expires_at < datetime('now') AND used = 0"
    );
    this.deleteSessionByToken = this.db.prepare(
      'DELETE FROM pairing_tokens WHERE session_token = ?'
    );

    // Agent toggle
    this.updateAgentEnabled = this.db.prepare(
      "UPDATE agents SET enabled = ?, updated_at = datetime('now') WHERE hash_key = ? AND agent_id = ?"
    );

    // Per-agent stats
    this.getAgentPerStats = this.db.prepare(`
      SELECT
        COUNT(*) as total_runs,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful_runs,
        SUM(CASE WHEN execution_mode = 'replay' THEN 1 ELSE 0 END) as replay_runs,
        SUM(CASE WHEN execution_mode = 'ai_fallback' THEN 1 ELSE 0 END) as ai_fallback_runs,
        SUM(tokens_used) as tokens_saved,
        SUM(cost_saved) as cost_saved
      FROM agent_runs
      WHERE hash_key = ? AND agent_id = ?
    `);
  }

  // Hash key operations
  createHashKey(hashKey) {
    return this.insertHashKey.run(hashKey);
  }

  validateHashKey(hashKey) {
    const row = this.getHashKey.get(hashKey);
    if (row) {
      this.updateLastSeen.run(hashKey);
    }
    return row || null;
  }

  // Agent operations
  upsertAgentData(hashKey, data) {
    return this.upsertAgent.run(
      hashKey, data.agentId, data.name, data.task,
      data.targetUrl, data.scheduleType, data.scheduleConfig || '{}',
      data.enabled ? 1 : 0
    );
  }

  listAgents(hashKey) {
    return this.getAgents.all(hashKey);
  }

  getAgentData(hashKey, agentId) {
    return this.getAgent.get(hashKey, agentId);
  }

  removeAgent(hashKey, agentId) {
    return this.deleteAgent.run(hashKey, agentId);
  }

  toggleAgentEnabled(hashKey, agentId, enabled) {
    return this.updateAgentEnabled.run(enabled ? 1 : 0, hashKey, agentId);
  }

  getPerAgentStats(hashKey, agentId) {
    const row = this.getAgentPerStats.get(hashKey, agentId);
    return {
      totalRuns: row.total_runs || 0,
      successfulRuns: row.successful_runs || 0,
      replayRuns: row.replay_runs || 0,
      aiFallbackRuns: row.ai_fallback_runs || 0,
      tokensSaved: row.tokens_saved || 0,
      costSaved: Math.round((row.cost_saved || 0) * 10000) / 10000
    };
  }

  // Run operations
  recordRun(hashKey, agentId, run) {
    return this.insertRun.run(
      hashKey, agentId, run.runId,
      run.startedAt, run.completedAt,
      run.status, run.result, run.error,
      run.iterations || 0, run.tokensUsed || 0,
      run.costUsd || 0, run.durationMs || 0,
      run.executionMode || 'ai_initial',
      run.costSaved || 0
    );
  }

  listRuns(hashKey, agentId, limit = 20, offset = 0) {
    return this.getRuns.all(hashKey, agentId, limit, offset);
  }

  countRuns(hashKey, agentId) {
    return this.getRunCount.get(hashKey, agentId).count;
  }

  listRecentRuns(hashKey, limit = 50) {
    return this.getRecentRuns.all(hashKey, limit);
  }

  // Pairing token operations
  createPairingToken(token, hashKey, expiresAt) {
    return this.insertPairingToken.run(token, hashKey, expiresAt);
  }

  getPairingToken(token) {
    return this.selectPairingToken.get(token) || null;
  }

  consumePairingToken(token, sessionToken, sessionExpiresAt) {
    return this.markTokenUsed.run(sessionToken, sessionExpiresAt, token);
  }

  invalidatePairingTokens(hashKey) {
    return this.invalidateTokensByHashKey.run(hashKey);
  }

  getSessionByToken(sessionToken) {
    return this.selectSessionByToken.get(sessionToken) || null;
  }

  cleanExpiredPairingTokens() {
    return this.cleanExpiredTokens.run();
  }

  revokeSession(sessionToken) {
    return this.deleteSessionByToken.run(sessionToken);
  }

  // Stats
  getAgentStats(hashKey) {
    const allTime = this.getStats.get(hashKey);
    const today = this.getTodayStats.get(hashKey);
    const agents = this.getAgents.all(hashKey);

    return {
      totalAgents: agents.length,
      enabledAgents: agents.filter(a => a.enabled).length,
      totalRuns: allTime.total_runs || 0,
      successfulRuns: allTime.successful_runs || 0,
      runsToday: today.runs_today || 0,
      successfulToday: today.successful_today || 0,
      successRate: allTime.total_runs > 0
        ? Math.round((allTime.successful_runs / allTime.total_runs) * 100)
        : 0,
      totalTokens: allTime.total_tokens || 0,
      totalCost: Math.round((allTime.total_cost || 0) * 10000) / 10000,
      totalCostSaved: Math.round((allTime.total_cost_saved || 0) * 10000) / 10000,
      totalDuration: allTime.total_duration || 0
    };
  }
}

module.exports = Queries;
