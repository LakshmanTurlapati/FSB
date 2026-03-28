# Phase 120: Sidepanel Agents UI - Context

**Gathered:** 2026-03-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Add a dedicated Agents tab to the sidepanel (ui/sidepanel.js + sidepanel.html) where users can manage all background agents without opening the options page. The UI should show agent list with status, quick actions (run/pause/delete), run history, and a create/edit form.

</domain>

<decisions>
## Implementation Decisions

### UI Structure
- Add an "Agents" tab to sidepanel's existing tab navigation (alongside Chat tab)
- Agent list shows name, status badge (active/paused/running), next run time
- Each agent row has quick action buttons: Run Now, Pause/Resume, Delete
- Expandable agent detail shows last 10 runs with status, duration, cost, execution mode (AI/replay)
- Create/edit form: name, task description, target URL, schedule type (interval/daily/cron/once), schedule params

### Patterns
- Follow existing sidepanel.js patterns for tab switching, message passing, DOM manipulation
- Use chrome.runtime.sendMessage to existing agent handlers (createAgent, updateAgent, deleteAgent, listAgents, toggleAgent, runAgentNow, getAgentStats, getAgentRunHistory)
- Use existing progress broadcasting pattern for live run status

### Claude's Discretion
- CSS styling details (colors, spacing, animations)
- Exact HTML structure within the agents tab
- How to display schedule descriptions (use getScheduleDescription from Phase 118)
- Loading states and empty states

</decisions>

<code_context>
## Existing Code Insights

Codebase context will be gathered during plan-phase research.

</code_context>

<specifics>
## Specific Ideas

No specific requirements beyond ROADMAP success criteria.

</specifics>

<deferred>
## Deferred Ideas

None.

</deferred>
