# Phase 128: Viewport-Aware Interaction - Context

**Gathered:** 2026-03-31
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure phase in autonomous mode)

<domain>
## Phase Boundary

Click and hover work on any element regardless of its position on the page -- off-viewport elements are scrolled into the visible area accounting for fixed/sticky headers before interaction. Post-scroll elementFromPoint verification confirms the target is actually exposed before clicking.

</domain>

<decisions>
## Implementation Decisions

### Scroll Strategy
- **D-01:** After scrollIntoView, detect fixed/sticky header height via getComputedStyle position check on top-level elements, then scroll additional offset to clear the header.
- **D-02:** Post-scroll verification via elementFromPoint at the element's center coordinates -- if the element is obscured (by a fixed header or overlay), scroll further down.
- **D-03:** The existing `smartEnsureReady` function in content/accessibility.js (line ~828) already calls scrollIntoViewIfNeeded -- enhance it rather than creating a parallel scroll mechanism.

### Error Recovery
- **D-04:** If element is still obscured after 2 scroll attempts, report the obstruction (what element is covering it) rather than silently failing with "outside viewport".

### Claude's Discretion
All implementation details not specified above are at Claude's discretion.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `smartEnsureReady()` in content/accessibility.js (~line 828) -- already handles scrollIntoView, visibility checks
- `scrollIntoViewIfNeeded()` in content/accessibility.js -- the actual scroll function
- Click and hover actions in content/actions.js use smartEnsureReady before interaction

### Integration Points
- content/accessibility.js -- enhance scrollIntoViewIfNeeded with header compensation and elementFromPoint verification
- content/actions.js click/hover handlers -- should benefit automatically from accessibility.js improvements

</code_context>

<specifics>
## Specific Ideas

- Detect fixed headers: iterate top-level children, check getComputedStyle(el).position === 'fixed' || 'sticky', measure their height
- elementFromPoint check: after scroll, call document.elementFromPoint(rect.left + rect.width/2, rect.top + rect.height/2) and verify it returns the target element (or a descendant)

</specifics>

<deferred>
## Deferred Ideas

None.

</deferred>
