# Phase 117: Cost & Metrics Pipeline - Context

**Gathered:** 2026-03-28
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure phase — discuss skipped)

<domain>
## Phase Boundary

Thread real token count and cost data from AI integration through executeAutomationTask into agent run history and recorded scripts. Fix the hardcoded $0.002 fallback so agent stats show accurate cumulative cost and tokens.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — pure infrastructure phase. Use ROADMAP phase goal, success criteria, and codebase conventions to guide decisions.

Key areas to investigate:
- Where AI provider response includes token/cost data (ai-integration.js or similar)
- How executeAutomationTask currently resolves (line ~6465 in background.js has placeholder)
- How agent executor reads cost from the resolve result
- How recordedScript.estimatedCostPerRun gets set

</decisions>

<code_context>
## Existing Code Insights

Codebase context will be gathered during plan-phase research.

</code_context>

<specifics>
## Specific Ideas

No specific requirements — infrastructure phase. Refer to ROADMAP phase description and success criteria.

</specifics>

<deferred>
## Deferred Ideas

None — discuss phase skipped.

</deferred>
