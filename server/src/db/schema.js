/**
 * SQLite database schema setup
 */

function initializeDatabase(db) {
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS hash_keys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hash_key TEXT UNIQUE NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_seen_at TEXT,
      metadata TEXT DEFAULT '{}'
    );

    CREATE TABLE IF NOT EXISTS agents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hash_key TEXT NOT NULL,
      agent_id TEXT NOT NULL,
      name TEXT NOT NULL,
      task TEXT NOT NULL,
      target_url TEXT NOT NULL,
      schedule_type TEXT NOT NULL,
      schedule_config TEXT DEFAULT '{}',
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (hash_key) REFERENCES hash_keys(hash_key) ON DELETE CASCADE,
      UNIQUE(hash_key, agent_id)
    );

    CREATE TABLE IF NOT EXISTS agent_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hash_key TEXT NOT NULL,
      agent_id TEXT NOT NULL,
      run_id TEXT NOT NULL,
      started_at TEXT,
      completed_at TEXT NOT NULL DEFAULT (datetime('now')),
      status TEXT NOT NULL DEFAULT 'unknown',
      result TEXT,
      error TEXT,
      iterations INTEGER DEFAULT 0,
      tokens_used INTEGER DEFAULT 0,
      cost_usd REAL DEFAULT 0,
      duration_ms INTEGER DEFAULT 0,
      execution_mode TEXT DEFAULT 'ai_initial',
      cost_saved REAL DEFAULT 0,
      FOREIGN KEY (hash_key) REFERENCES hash_keys(hash_key) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_agents_hash_key ON agents(hash_key);
    CREATE INDEX IF NOT EXISTS idx_agent_runs_hash_key ON agent_runs(hash_key);
    CREATE INDEX IF NOT EXISTS idx_agent_runs_agent_id ON agent_runs(agent_id);
    CREATE INDEX IF NOT EXISTS idx_agent_runs_completed_at ON agent_runs(completed_at);

    CREATE TABLE IF NOT EXISTS pairing_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token TEXT UNIQUE NOT NULL,
      hash_key TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at TEXT NOT NULL,
      used INTEGER NOT NULL DEFAULT 0,
      session_token TEXT,
      session_expires_at TEXT,
      FOREIGN KEY (hash_key) REFERENCES hash_keys(hash_key) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_pairing_tokens_token ON pairing_tokens(token);
    CREATE INDEX IF NOT EXISTS idx_pairing_tokens_hash_key ON pairing_tokens(hash_key);
  `);

  // Migration: add replay columns to existing databases
  try {
    db.exec(`ALTER TABLE agent_runs ADD COLUMN execution_mode TEXT DEFAULT 'ai_initial'`);
  } catch { /* column already exists */ }
  try {
    db.exec(`ALTER TABLE agent_runs ADD COLUMN cost_saved REAL DEFAULT 0`);
  } catch { /* column already exists */ }

  console.log('[FSB Server] Database schema initialized');
}

module.exports = { initializeDatabase };
