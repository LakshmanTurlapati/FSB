# Phase 61: Color Picker Custom Hex - Context

**Gathered:** 2026-03-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Execute color picker hue slider and shade reticle drag to select custom hex via MCP manual tools. Fix any interaction blockers found in-phase. Generate structured autopilot diagnostic report.

</domain>

<decisions>
## Implementation Decisions

### Target Site & Setup
- Use a free online color picker (colorpicker.me, htmlcolorcodes.com, or w3schools color picker)
- No auth required
- Dismiss any cookie/consent popups

### Test Workflow
- Navigate to color picker page
- Drag the hue slider to select a base hue (e.g., blue range)
- Drag the shade/saturation reticle to select a specific shade
- Verify the resulting hex value matches approximately the target color
- Alternative: type hex value directly into input field if available

### Pass/Fail & Diagnostics
- PASS = hue slider dragged + shade reticle positioned + hex value visible/readable
- PARTIAL = some interaction worked but hex didn't match or verification failed
- FAIL = couldn't interact with color picker at all
- Reuse drag for slider/reticle movement, click_at for positioning, get_attribute for hex readout
- Same diagnostic report template

### Claude's Discretion
- Which color picker site to use
- Target hex color
- How to verify hex value (DOM attribute, text content, input value)
- Diagnostic details

</decisions>

<canonical_refs>
## Canonical References

### MCP tools
- `mcp-server/src/tools/manual.ts` -- drag, click_at, get_attribute
- `content/actions.js` -- Content script tools

### Milestone requirements
- `.planning/REQUIREMENTS.md` -- MICRO-05 requirement
- `.planning/ROADMAP.md` -- Phase 61 success criteria

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `drag` for slider/reticle movement
- `click_at` for precise positioning on color areas
- `get_attribute` for reading hex values from DOM
- `get_text` for reading displayed hex values

### Integration Points
- New site guide in `site-guides/utilities/color-picker.js`

</code_context>

<specifics>
## Specific Ideas

- Color pickers have two controls: hue strip (1D slider) and saturation/brightness area (2D reticle)
- Hue slider is typically a vertical or horizontal rainbow strip
- Shade area is a square gradient from white (top-left) to pure hue (top-right) to black (bottom)

</specifics>

<deferred>
## Deferred Ideas

None

</deferred>

---

*Phase: 61-color-picker-custom-hex*
*Context gathered: 2026-03-21*
