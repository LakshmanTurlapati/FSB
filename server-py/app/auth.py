from fastapi import Depends, Header, HTTPException

from .db import get_pool


async def require_hash_key(
    x_fsb_hash_key: str | None = Header(None, alias="X-FSB-Hash-Key"),
) -> str:
    """Dependency that validates X-FSB-Hash-Key header and returns the key."""
    if not x_fsb_hash_key:
        raise HTTPException(status_code=401, detail="Missing X-FSB-Hash-Key header")

    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT id FROM hash_keys WHERE hash_key = $1", x_fsb_hash_key
        )
        if not row:
            raise HTTPException(status_code=401, detail="Invalid hash key")

        # Update last_seen_at
        await conn.execute(
            "UPDATE hash_keys SET last_seen_at = NOW() WHERE hash_key = $1",
            x_fsb_hash_key,
        )

    return x_fsb_hash_key
