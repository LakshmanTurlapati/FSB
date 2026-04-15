CREATE TABLE IF NOT EXISTS hash_keys (
    id SERIAL PRIMARY KEY,
    hash_key TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS agents (
    id SERIAL PRIMARY KEY,
    hash_key TEXT NOT NULL REFERENCES hash_keys(hash_key) ON DELETE CASCADE,
    agent_id TEXT NOT NULL,
    name TEXT NOT NULL,
    task TEXT NOT NULL,
    start_mode TEXT NOT NULL DEFAULT 'pinned',
    target_url TEXT NOT NULL,
    schedule_type TEXT NOT NULL,
    schedule_config JSONB DEFAULT '{}'::jsonb,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(hash_key, agent_id)
);

CREATE TABLE IF NOT EXISTS agent_runs (
    id SERIAL PRIMARY KEY,
    hash_key TEXT NOT NULL REFERENCES hash_keys(hash_key) ON DELETE CASCADE,
    agent_id TEXT NOT NULL,
    run_id TEXT NOT NULL,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status TEXT NOT NULL DEFAULT 'unknown',
    result TEXT,
    error TEXT,
    iterations INTEGER DEFAULT 0,
    tokens_used INTEGER DEFAULT 0,
    cost_usd DOUBLE PRECISION DEFAULT 0,
    duration_ms INTEGER DEFAULT 0,
    execution_mode TEXT DEFAULT 'ai_initial',
    cost_saved DOUBLE PRECISION DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_agents_hash_key ON agents(hash_key);
CREATE INDEX IF NOT EXISTS idx_agent_runs_hash_key ON agent_runs(hash_key);
CREATE INDEX IF NOT EXISTS idx_agent_runs_agent_id ON agent_runs(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_runs_completed_at ON agent_runs(completed_at);
