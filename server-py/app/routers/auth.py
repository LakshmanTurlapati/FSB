from fastapi import APIRouter, Header

from ..config import settings
from ..db import get_pool
from ..models import ErrorResponse, RegisterResponse, ValidateResponse
from ..utils import generate_hash_key

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=RegisterResponse)
async def register():
    """Generate a new hash key."""
    pool = await get_pool()
    hash_key = generate_hash_key(settings.FSB_SERVER_SECRET)
    async with pool.acquire() as conn:
        await conn.execute("INSERT INTO hash_keys (hash_key) VALUES ($1)", hash_key)
    return RegisterResponse(
        hashKey=hash_key,
        message="Hash key created. Save this key - it cannot be recovered.",
    )


@router.get("/validate", response_model=ValidateResponse)
async def validate(
    x_fsb_hash_key: str | None = Header(None, alias="X-FSB-Hash-Key"),
):
    """Validate a hash key."""
    if not x_fsb_hash_key:
        return ValidateResponse(valid=False, error="No hash key provided")

    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT created_at FROM hash_keys WHERE hash_key = $1", x_fsb_hash_key
        )
    if not row:
        return ValidateResponse(valid=False)

    return ValidateResponse(
        valid=True, createdAt=row["created_at"].isoformat() if row["created_at"] else None
    )
