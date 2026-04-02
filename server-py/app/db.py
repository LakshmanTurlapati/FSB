import pathlib

import asyncpg

from .config import settings

_pool: asyncpg.Pool | None = None

_SCHEMA_SQL = (pathlib.Path(__file__).parent / "schema.sql").read_text()


async def init_pool() -> asyncpg.Pool:
    global _pool
    _pool = await asyncpg.create_pool(settings.DATABASE_URL, min_size=2, max_size=10)
    await run_migrations()
    return _pool


async def close_pool() -> None:
    global _pool
    if _pool:
        await _pool.close()
        _pool = None


async def get_pool() -> asyncpg.Pool:
    if _pool is None:
        raise RuntimeError("Database pool not initialized")
    return _pool


async def run_migrations() -> None:
    """Execute schema DDL (all statements are IF NOT EXISTS, safe to re-run)."""
    if _pool is None:
        raise RuntimeError("Database pool not initialized")
    async with _pool.acquire() as conn:
        await conn.execute(_SCHEMA_SQL)
        await conn.execute(
            "ALTER TABLE agents ADD COLUMN IF NOT EXISTS start_mode TEXT NOT NULL DEFAULT 'pinned'"
        )
    print("[FSB Server] Database schema initialized")
