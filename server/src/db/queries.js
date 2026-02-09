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
      INSERT INTO agent_runs (hash_key, agent_id, run_id, started_at, completed_at, status, result, error, iterations, tokens_used, cost_usd, duration_ms)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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

  // Run operations
  recordRun(hashKey, agentId, run) {
    return this.insertRun.run(
      hashKey, agentId, run.runId,
      run.startedAt, run.completedAt,
      run.status, run.result, run.error,
      run.iterations || 0, run.tokensUsed || 0,
      run.costUsd || 0, run.durationMs || 0
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
      totalDuration: allTime.total_duration || 0
    };
  }
}

module.exports = Queries;
