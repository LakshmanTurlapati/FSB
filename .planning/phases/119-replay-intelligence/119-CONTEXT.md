# Phase 119: Replay Intelligence - Context

**Gathered:** 2026-03-28
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure phase — discuss skipped)

<domain>
## Phase Boundary

Make agent replay smarter: use recorded original action durations instead of hardcoded delays, add step-level error recovery (retry individual steps before full AI fallback), track per-step success rates, and accurately calculate cost savings from real cost data (wired in Phase 117).

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — pure infrastructure phase.

Key areas to investigate:
- agents/agent-executor.js — _executeReplayScript() with hardcoded delays, _extractRecordedScript(), replay/AI fallback decision gate
- RecordedScript.steps[] — each step has metadata.originalDuration but it's ignored during replay
- replayStats tracking — totalReplays, totalAISaves, estimatedCostSaved fields
- Phase 117 output — real costUsd now flows through executeAutomationTask resolve

</decisions>

<code_context>
## Existing Code Insights

Codebase context will be gathered during plan-phase research.

</code_context>

<specifics>
## Specific Ideas

No specific requirements — infrastructure phase.

</specifics>

<deferred>
## Deferred Ideas

None.

</deferred>
