# Phase 14: Execution Acceleration - Context

**Gathered:** 2026-02-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Make the automation engine faster and smarter by (1) letting the AI batch multiple same-page actions into a single response with dynamic completion detection between each, and (2) injecting the user's timezone and country into every AI prompt so it makes location-aware decisions. Navigation-changing actions and new page context remain single-action-per-turn.

</domain>

<decisions>
## Implementation Decisions

### Action batching format
- AI explicitly declares batch intent via a new `batchActions` array (separate from the existing `actions` array)
- AI decides what's batchable based on page context -- system prompt tells it to always look for multi-action opportunities
- Batch size capped at 5-8 actions maximum
- Strictly sequential execution -- no conditional branching within a batch; if AI needs branching, it does so on the next iteration
- Navigation-triggering actions (clicks that may navigate, `navigate`, `searchGoogle`) must be the LAST action in any batch
- AI returns combined result after batch execution: "Executed N/M actions. Final page state: [DOM snapshot]"
- All tool types can be in a batch, but potential navigation actions must come last
- Existing single-action `actions` array still works unchanged for backward compatibility

### Completion detection
- Primary: Content script using MutationObserver (DOM) + PerformanceObserver (network)
- Fallback: Background script via CDP (chrome.debugger) if content script detection fails or is unavailable
- Action is "complete" when both DOM mutations have stopped AND no pending network requests
- Each action gets a fresh 5-second timeout; timer resets after each successful action
- No-DOM-change scenario: if DOM is quiet but network is also idle, action is considered complete
- If DOM is quiet but network is still active, wait for network to settle (up to 5s)

### Timezone/country injection
- Source: Browser APIs only -- `Intl.DateTimeFormat().resolvedOptions().timeZone` for timezone, derive country from timezone mapping
- Data passed to AI: country + local datetime (e.g., "User is in United States, local time: 2026-02-24 3:45 PM CST")
- Injected into ALL task types, not just career searches -- universally useful
- For career searches specifically: if user mentions a country or state in their prompt, use that; otherwise, default to user's detected country as the location filter
- No user configuration needed; purely automatic from browser APIs

### Failure and rollback
- If any action in a batch fails: stop the batch immediately, do not execute remaining actions
- No rollback of successfully completed actions -- they are committed to the page
- Failure report sent back to AI includes: which actions succeeded, which failed, failure reason, AND a fresh DOM snapshot of the current page state
- AI reconsiders the remaining (skipped) actions based on the new context -- it may retry differently, skip, or take an alternate path
- 5-second timeout on any action counts as a failure and stops the batch
- Combined result format includes success/failure status for each attempted action

### Claude's Discretion
- Exact DOM stability threshold (how many ms of quiet counts as "stable" -- likely 300-500ms)
- PerformanceObserver vs fetch/XHR interception for network monitoring in content script
- Timezone-to-country mapping implementation (static lookup table vs library)
- Exact prompt wording for batch instruction and locale injection
- Whether to use a separate `batchActions` key or extend the existing `actions` key with a `batch: true` flag

</decisions>

<specifics>
## Specific Ideas

- "What we did with fillSheetData was phenomenal -- we can apply this principle everywhere as long as we have the context and actions are on the same page"
- The core insight: instead of 1 action per AI iteration (with full DOM re-analysis each time), batch same-page actions to save the overhead of re-analyzing an unchanged page
- Career search was finding jobs worldwide because the AI had no location context -- timezone/country fixes this
- The engine should be the smart one for completion detection -- not fixed delays, not AI guessing

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 14-execution-acceleration*
*Context gathered: 2026-02-24*
