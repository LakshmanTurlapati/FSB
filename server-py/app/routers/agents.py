import asyncio
import json
import time

from fastapi import APIRouter, Depends, HTTPException, Query

from ..auth import require_hash_key
from ..db import get_pool
from ..models import (
    AgentListResponse,
    AgentResponse,
    AgentUpsert,
    DeleteResponse,
    RunListResponse,
    RunReportPayload,
)

router = APIRouter(prefix="/api/agents", tags=["agents"])

# SSE clients registry: hash_key -> list[asyncio.Queue]
sse_clients: dict[str, list[asyncio.Queue]] = {}


def broadcast_sse(hash_key: str, data: dict) -> None:
    """Push an event to all SSE clients subscribed to this hash_key."""
    clients = sse_clients.get(hash_key)
    if not clients:
        return
    message = json.dumps(data)
    dead = []
    for i, q in enumerate(clients):
        try:
            q.put_nowait(message)
        except asyncio.QueueFull:
            dead.append(i)
    # Clean up dead queues
    for i in reversed(dead):
        clients.pop(i)
    if not clients:
        sse_clients.pop(hash_key, None)


def _row_to_dict(row) -> dict:
    """Convert an asyncpg Record to a JSON-friendly dict."""
    d = dict(row)
    for k, v in d.items():
        if hasattr(v, "isoformat"):
            d[k] = v.isoformat()
    return d


# --- GET /api/agents ---
@router.get("", response_model=AgentListResponse)
async def list_agents(hash_key: str = Depends(require_hash_key)):
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT * FROM agents WHERE hash_key = $1 ORDER BY created_at DESC",
            hash_key,
        )
    return AgentListResponse(agents=[_row_to_dict(r) for r in rows])


# --- POST /api/agents ---
@router.post("", response_model=AgentResponse)
async def upsert_agent(body: AgentUpsert, hash_key: str = Depends(require_hash_key)):
    effective_start_mode = body.startMode or ("pinned" if body.targetUrl else "ai_routed")

    if not body.agentId or not body.name or not body.task:
        raise HTTPException(
            status_code=400,
            detail="Missing required fields: agentId, name, task",
        )
    if effective_start_mode == "pinned" and not body.targetUrl:
        raise HTTPException(status_code=400, detail="Pinned agents require targetUrl")

    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO agents (hash_key, agent_id, name, task, start_mode, target_url, schedule_type, schedule_config, enabled)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9)
            ON CONFLICT (hash_key, agent_id) DO UPDATE SET
                name = EXCLUDED.name,
                task = EXCLUDED.task,
                start_mode = EXCLUDED.start_mode,
                target_url = EXCLUDED.target_url,
                schedule_type = EXCLUDED.schedule_type,
                schedule_config = EXCLUDED.schedule_config,
                enabled = EXCLUDED.enabled,
                updated_at = NOW()
            """,
            hash_key,
            body.agentId,
            body.name,
            body.task,
            effective_start_mode,
            body.targetUrl or "",
            body.scheduleType,
            body.scheduleConfig or "{}",
            body.enabled,
        )
        row = await conn.fetchrow(
            "SELECT * FROM agents WHERE hash_key = $1 AND agent_id = $2",
            hash_key,
            body.agentId,
        )

    agent_dict = _row_to_dict(row) if row else None
    broadcast_sse(hash_key, {"type": "agent_updated", "agent": agent_dict})
    return AgentResponse(success=True, agent=agent_dict)


# --- DELETE /api/agents/{agentId} ---
@router.delete("/{agentId}", response_model=DeleteResponse)
async def delete_agent(agentId: str, hash_key: str = Depends(require_hash_key)):
    pool = await get_pool()
    async with pool.acquire() as conn:
        result = await conn.execute(
            "DELETE FROM agents WHERE hash_key = $1 AND agent_id = $2",
            hash_key,
            agentId,
        )
    # result is e.g. "DELETE 1" or "DELETE 0"
    if result.endswith("0"):
        raise HTTPException(status_code=404, detail="Agent not found")

    broadcast_sse(hash_key, {"type": "agent_deleted", "agentId": agentId})
    return DeleteResponse(success=True)


# --- POST /api/agents/{agentId}/runs ---
@router.post("/{agentId}/runs")
async def report_run(
    agentId: str, body: RunReportPayload, hash_key: str = Depends(require_hash_key)
):
    pool = await get_pool()
    async with pool.acquire() as conn:
        # Upsert agent data if provided
        if body.name and body.task and body.targetUrl is not None:
            effective_start_mode = body.startMode or ("pinned" if body.targetUrl else "ai_routed")
            await conn.execute(
                """
                INSERT INTO agents (hash_key, agent_id, name, task, start_mode, target_url, schedule_type, schedule_config, enabled)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9)
                ON CONFLICT (hash_key, agent_id) DO UPDATE SET
                    name = EXCLUDED.name,
                    task = EXCLUDED.task,
                    start_mode = EXCLUDED.start_mode,
                    target_url = EXCLUDED.target_url,
                    schedule_type = EXCLUDED.schedule_type,
                    schedule_config = EXCLUDED.schedule_config,
                    enabled = EXCLUDED.enabled,
                    updated_at = NOW()
                """,
                hash_key,
                agentId,
                body.name,
                body.task,
                effective_start_mode,
                body.targetUrl or "",
                body.scheduleType,
                body.scheduleConfig or "{}",
                body.enabled,
            )

        # Record the run
        run = body.run
        run_id = run.runId or f"run_{int(time.time() * 1000):x}"
        from datetime import datetime, timezone

        now_iso = datetime.now(timezone.utc).isoformat()

        await conn.execute(
            """
            INSERT INTO agent_runs
                (hash_key, agent_id, run_id, started_at, completed_at, status,
                 result, error, iterations, tokens_used, cost_usd, duration_ms,
                 execution_mode, cost_saved)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
            """,
            hash_key,
            agentId,
            run_id,
            run.startedAt or now_iso,
            run.completedAt or now_iso,
            run.status,
            run.result,
            run.error,
            run.iterations,
            run.tokensUsed,
            run.costUsd,
            run.durationMs,
            run.executionMode,
            run.costSaved,
        )

    broadcast_sse(hash_key, {"type": "run_completed", "agentId": agentId, "run": run.model_dump()})
    return {"success": True}


# --- GET /api/agents/{agentId}/runs ---
@router.get("/{agentId}/runs", response_model=RunListResponse)
async def list_runs(
    agentId: str,
    limit: int = Query(20, le=100),
    offset: int = Query(0, ge=0),
    hash_key: str = Depends(require_hash_key),
):
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT * FROM agent_runs
            WHERE hash_key = $1 AND agent_id = $2
            ORDER BY completed_at DESC
            LIMIT $3 OFFSET $4
            """,
            hash_key,
            agentId,
            limit,
            offset,
        )
        total_row = await conn.fetchrow(
            "SELECT COUNT(*) AS count FROM agent_runs WHERE hash_key = $1 AND agent_id = $2",
            hash_key,
            agentId,
        )

    return RunListResponse(
        runs=[_row_to_dict(r) for r in rows],
        total=total_row["count"] if total_row else 0,
        limit=limit,
        offset=offset,
    )
