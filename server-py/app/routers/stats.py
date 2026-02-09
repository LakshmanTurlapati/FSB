from fastapi import APIRouter, Depends

from ..auth import require_hash_key
from ..db import get_pool
from ..models import StatsResponse

router = APIRouter(prefix="/api/stats", tags=["stats"])


@router.get("", response_model=StatsResponse)
async def get_stats(hash_key: str = Depends(require_hash_key)):
    pool = await get_pool()
    async with pool.acquire() as conn:
        # All-time stats
        all_time = await conn.fetchrow(
            """
            SELECT
                COUNT(DISTINCT agent_id) AS total_agents_from_runs,
                COUNT(*) AS total_runs,
                SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) AS successful_runs,
                COALESCE(SUM(tokens_used), 0) AS total_tokens,
                COALESCE(SUM(cost_usd), 0) AS total_cost,
                COALESCE(SUM(duration_ms), 0) AS total_duration,
                COALESCE(SUM(cost_saved), 0) AS total_cost_saved,
                SUM(CASE WHEN execution_mode = 'replay' THEN 1 ELSE 0 END) AS replay_runs,
                SUM(CASE WHEN execution_mode = 'ai_fallback' THEN 1 ELSE 0 END) AS ai_fallback_runs
            FROM agent_runs
            WHERE hash_key = $1
            """,
            hash_key,
        )

        # Today stats
        today = await conn.fetchrow(
            """
            SELECT
                COUNT(*) AS runs_today,
                SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) AS successful_today
            FROM agent_runs
            WHERE hash_key = $1 AND completed_at >= NOW() - INTERVAL '1 day'
            """,
            hash_key,
        )

        # Agent counts
        agents = await conn.fetch(
            "SELECT enabled FROM agents WHERE hash_key = $1", hash_key
        )

    total_agents = len(agents)
    enabled_agents = sum(1 for a in agents if a["enabled"])
    total_runs = all_time["total_runs"] or 0
    successful_runs = all_time["successful_runs"] or 0

    return StatsResponse(
        totalAgents=total_agents,
        enabledAgents=enabled_agents,
        totalRuns=total_runs,
        successfulRuns=successful_runs,
        runsToday=today["runs_today"] or 0,
        successfulToday=today["successful_today"] or 0,
        successRate=round((successful_runs / total_runs) * 100) if total_runs > 0 else 0,
        totalTokens=int(all_time["total_tokens"]),
        totalCost=round(float(all_time["total_cost"]), 4),
        totalDuration=int(all_time["total_duration"]),
        totalCostSaved=round(float(all_time["total_cost_saved"]), 4),
        replayRuns=int(all_time["replay_runs"] or 0),
        aiFallbackRuns=int(all_time["ai_fallback_runs"] or 0),
    )
