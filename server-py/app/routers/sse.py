import asyncio
import json

from fastapi import APIRouter, Header, HTTPException
from starlette.responses import StreamingResponse

router = APIRouter(prefix="/api/sse", tags=["sse"])


@router.get("")
async def sse_stream(
    x_fsb_hash_key: str | None = Header(None, alias="X-FSB-Hash-Key"),
):
    """Server-Sent Events stream for real-time updates."""
    if not x_fsb_hash_key:
        raise HTTPException(status_code=401, detail="Missing X-FSB-Hash-Key header")

    # Import the shared client registry from agents router
    from .agents import sse_clients

    queue: asyncio.Queue = asyncio.Queue(maxsize=256)

    # Register client
    if x_fsb_hash_key not in sse_clients:
        sse_clients[x_fsb_hash_key] = []
    sse_clients[x_fsb_hash_key].append(queue)

    async def event_generator():
        try:
            # Send initial connected event
            yield f"data: {json.dumps({'type': 'connected'})}\n\n"

            while True:
                try:
                    # Wait for a message with a 30s timeout for keepalive
                    message = await asyncio.wait_for(queue.get(), timeout=30.0)
                    yield f"data: {message}\n\n"
                except asyncio.TimeoutError:
                    # Send keepalive comment
                    yield ": keepalive\n\n"
        except asyncio.CancelledError:
            pass
        finally:
            # Cleanup on disconnect
            clients = sse_clients.get(x_fsb_hash_key)
            if clients and queue in clients:
                clients.remove(queue)
                if not clients:
                    sse_clients.pop(x_fsb_hash_key, None)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
