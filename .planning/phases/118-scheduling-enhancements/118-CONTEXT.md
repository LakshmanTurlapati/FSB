# Phase 118: Scheduling Enhancements - Context

**Gathered:** 2026-03-28
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure phase — discuss skipped)

<domain>
## Phase Boundary

Add cron expression support, weekly schedules, retry-on-failure with exponential backoff, and persistent server sync queue to the agent scheduler. Extend existing interval/daily/once schedule types without breaking them.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — pure infrastructure phase. Use ROADMAP phase goal, success criteria, and codebase conventions to guide decisions.

Key areas to investigate:
- agents/agent-scheduler.js — existing schedule types (interval, daily, once), alarm management
- agents/server-sync.js — in-memory retry queue that's lost on SW restart
- background.js chrome.alarms.onAlarm handler — where agent runs are dispatched
- Cron parsing approach — lightweight parser vs library (note: Chrome extension, no npm in runtime)

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
