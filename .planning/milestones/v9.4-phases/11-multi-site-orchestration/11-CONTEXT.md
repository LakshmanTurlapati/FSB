# Phase 11: Multi-Site Orchestration with Data Persistence - Context

**Gathered:** 2026-02-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Sequential multi-company career search (2-10 companies per prompt) with persistent data accumulation across service worker restarts. Users name multiple companies in one prompt, FSB searches each sequentially, persists extracted jobs to chrome.storage.local after each company, deduplicates at the end, and reports results. The AI gets storeJobData/getStoredJobs tools for accumulation.

</domain>

<decisions>
## Implementation Decisions

### Failure & Recovery Behavior
- Auth walls: present the existing login flow so user can authenticate, then auto-resume search for that company once login detected
- Non-blocking auth: do NOT pause the entire workflow for one auth wall -- present login option, tell user FSB will continue with other companies, search remaining companies, populate Sheets if applicable, then check back on the auth-walled company. If user logged in, search it and update Sheets. If not, pause only for that one login
- Other failures (site down, no page load): retry once, then skip and move to next company
- Timeout: aggressive -- ~5 seconds first attempt, ~10 seconds retry, then move on (speed matters for automation)
- Partial results: keep whatever was extracted before a failure (better than nothing)
- No retry pass at end: after all companies attempted, proceed to next workflow step with whatever data was collected
- Failure communication: silent during workflow, all failures listed in final summary
- Total failure (all companies fail): AI gives specific summary distinguishing "no results found" from "site failure". If no data to document, skip Sheets step entirely and say so

### Progress Reporting
- No progress messages in chat -- use the existing ProgressOverlay (floating black dialog, top-right corner with Shadow DOM)
- Populate ProgressOverlay with meaningful, concise multi-site context (Claude's discretion on exact text format)
- Progress bar calculation: use existing approach, can be refined generally (not phase-specific)
- Respect user's overlay toggle setting -- if overlay is turned off, search runs silently
- Final chat summary: context-dependent -- only show table/listing if user explicitly asked for it. Otherwise, concise natural language summary of what was done
- If documenting to Sheets, no need to repeat all data in chat

### Duplicate Detection
- Duplicate = same apply link (URL match)
- Silently drop duplicates -- no mention to user
- Dedup happens once at the end after all companies searched, before Sheets output

### Data Lifecycle & Session Scope
- Session memory (history/replay data) is permanent -- never deleted
- Temporary job accumulation buffer (for Sheets export) can be cleared after successful Sheets export
- New search with old data: context-dependent -- if old data is relevant to the new search, keep it; if irrelevant (different search terms/role), replace it
- No preview of stored data needed -- data flows directly from storage to Sheets
- No explicit storage cap -- use what chrome.storage.local allows (~5MB, thousands of jobs)

### Claude's Discretion
- Exact ProgressOverlay text formatting for multi-site context
- Progress bar calculation refinements (general, not phase-specific)
- How to determine if old accumulated data is "relevant" to a new search
- Technical storage schema and key structure in chrome.storage.local
- How to detect login success for auto-resume after auth wall

</decisions>

<specifics>
## Specific Ideas

- User emphasized speed: "we want things to be quick" -- aggressive timeouts, no unnecessary waiting
- Auth flow is explicitly non-blocking: "We don't want to pause everything because of one login" -- continue other companies, come back to auth-walled company last
- The existing ProgressOverlay in visual-feedback.js is the progress UI -- no chat-based progress messages
- Final summaries should be driven by user intent: if they asked to find and list, show details; if they asked to find and document, just summarize what was done

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 11-multi-site-orchestration*
*Context gathered: 2026-02-23*
