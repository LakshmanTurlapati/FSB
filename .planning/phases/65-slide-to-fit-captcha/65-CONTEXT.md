# Phase 65: Slide-to-Fit CAPTCHA - Context

**Gathered:** 2026-03-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Execute slide-to-fit puzzle CAPTCHA drag at variable speed via MCP manual tools. Fix any interaction blockers found in-phase. Generate structured autopilot diagnostic report.

</domain>

<decisions>
## Implementation Decisions

### Target Site & Setup
- Find a demo slide-to-fit puzzle CAPTCHA (slider CAPTCHA demo page)
- Options: GEETEST demo, hCaptcha slider demo, or custom slider CAPTCHA examples
- No auth required for demo pages
- This tests the drag tool with variable speed -- not actual CAPTCHA solving

### Test Workflow
- Navigate to a slider CAPTCHA demo
- Identify the slider thumb element
- Drag the slider to the target position at variable speed (slow start, acceleration, slow end)
- Verify the slider moved to approximately the right position

### Pass/Fail & Diagnostics
- PASS = slider dragged with variable speed to approximate target position
- PARTIAL = slider moved but snapped back or speed wasn't variable
- FAIL = couldn't interact with slider CAPTCHA
- Use existing drag tool with custom steps/stepDelay for variable speed
- Same diagnostic report template

### Claude's Discretion
- Which CAPTCHA demo to use
- How to implement variable speed (vary stepDelay during drag)
- Target position for slider
- Diagnostic details

</decisions>

<canonical_refs>
## Canonical References

### MCP tools
- `mcp-server/src/tools/manual.ts` -- drag (steps, stepDelayMs params)

### Milestone requirements
- `.planning/REQUIREMENTS.md` -- MICRO-09 requirement
- `.planning/ROADMAP.md` -- Phase 65 success criteria

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `drag` MCP tool: Already supports configurable steps and stepDelayMs
- Variable speed requires multiple drag calls with different stepDelay values
- Or a new `drag_variable_speed` tool with acceleration curve

### Integration Points
- May need enhanced drag with speed curve parameter
- Site guide in `site-guides/security/`

</code_context>

<specifics>
## Specific Ideas

- Variable speed drag = series of small drags with decreasing then increasing delay
- Anti-bot CAPTCHAs detect uniform speed -- variable speed mimics human behavior
- Current drag tool uses uniform stepDelay -- may need enhancement for acceleration curve

</specifics>

<deferred>
## Deferred Ideas

None

</deferred>

---

*Phase: 65-slide-to-fit-captcha*
*Context gathered: 2026-03-21*
