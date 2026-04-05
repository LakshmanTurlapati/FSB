# Phase 129: Smart Enter Fallback - Context

**Gathered:** 2026-03-31
**Status:** Ready for planning
**Mode:** Auto-generated (surgical fix in autonomous mode)

<domain>
## Phase Boundary

press_enter reliably submits forms even when the Enter key has no observable effect -- automatically detecting and clicking the form's submit button as a fallback. Tested on Indeed (Enter has no effect) and Amazon (Enter triggers autocomplete instead of submit).

</domain>

<decisions>
## Implementation Decisions

### Fallback Strategy
- **D-01:** After pressing Enter, check if the action had an observable effect (URL change, content change, form submission). If no effect detected within ~500ms, find the nearest submit button and click it.
- **D-02:** Submit button detection: find the containing form element, look for `button[type=submit]`, `input[type=submit]`, or the last button inside the form.
- **D-03:** Only trigger fallback when Enter truly had no effect. If the page changed (URL, content, DOM), don't double-submit.

### Claude's Discretion
All implementation details not specified above are at Claude's discretion.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- pressEnter action in content/actions.js already has verification logic (checks urlChanged, contentChanged, etc.)
- The pressEnter handler already returns `hadEffect` boolean
- Form detection: the handler already has `isInsideForm` check

### Integration Points
- content/actions.js pressEnter handler -- add submit button fallback after Enter has no effect

</code_context>

<specifics>
## Specific Ideas

No specific requirements beyond the fallback mechanism.

</specifics>

<deferred>
## Deferred Ideas

None.

</deferred>
