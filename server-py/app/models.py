from __future__ import annotations

from pydantic import BaseModel, Field


# --- Auth ---

class RegisterResponse(BaseModel):
    hashKey: str
    message: str


class ValidateResponse(BaseModel):
    valid: bool
    createdAt: str | None = None
    error: str | None = None


# --- Agents ---

class AgentUpsert(BaseModel):
    agentId: str
    name: str
    task: str
    startMode: str = "pinned"
    targetUrl: str = ""
    scheduleType: str = "interval"
    scheduleConfig: str = "{}"
    enabled: bool = True


class AgentResponse(BaseModel):
    success: bool = True
    agent: dict | None = None


class AgentListResponse(BaseModel):
    agents: list[dict]


class DeleteResponse(BaseModel):
    success: bool = True


# --- Runs ---

class RunPayloadRun(BaseModel):
    runId: str | None = None
    startedAt: str | None = None
    completedAt: str | None = None
    status: str = "unknown"
    result: str | None = None
    error: str | None = None
    iterations: int = 0
    tokensUsed: int = 0
    costUsd: float = 0
    durationMs: int = 0
    executionMode: str = "ai_initial"
    costSaved: float = 0


class RunReportPayload(BaseModel):
    """Body for POST /api/agents/{agentId}/runs -- includes agent upsert fields + run."""
    name: str | None = None
    task: str | None = None
    startMode: str = "pinned"
    targetUrl: str | None = None
    scheduleType: str = "interval"
    scheduleConfig: str = "{}"
    enabled: bool = True
    run: RunPayloadRun = Field(default_factory=RunPayloadRun)


class RunListResponse(BaseModel):
    runs: list[dict]
    total: int
    limit: int
    offset: int


# --- Stats ---

class StatsResponse(BaseModel):
    totalAgents: int = 0
    enabledAgents: int = 0
    totalRuns: int = 0
    successfulRuns: int = 0
    runsToday: int = 0
    successfulToday: int = 0
    successRate: int = 0
    totalTokens: int = 0
    totalCost: float = 0
    totalDuration: int = 0
    totalCostSaved: float = 0
    replayRuns: int = 0
    aiFallbackRuns: int = 0


# --- Generic ---

class ErrorResponse(BaseModel):
    error: str
