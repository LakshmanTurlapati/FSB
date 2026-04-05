# Phase 112: Styling & Layout - Context

**Gathered:** 2026-03-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Add styling and layout workflows to the Excalidraw site guide: stroke/fill colors, stroke width/style, fill patterns, opacity, font properties, alignment, distribution, layer ordering.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion -- site guide expansion.

Key patterns from research:
- Stroke color: S shortcut opens stroke color picker, click swatch or type hex
- Background color: G shortcut opens background color picker
- Stroke width: 1-4 thin/bold/extra-bold via property panel buttons
- Stroke style: solid/dashed/dotted via property panel buttons
- Fill pattern: transparent/solid/hachure/cross-hatch via property panel
- Opacity: slider in properties panel (0-100)
- Font size: small/medium/large/extra-large buttons in properties
- Font family: Virgil (hand-drawn), Helvetica, Cascadia (mono) -- radio buttons
- Text alignment: left/center/right buttons
- Align: Ctrl+Shift+Left/Right/Up/Down for alignment after multi-select
- Distribute: distribution buttons in alignment panel after 3+ element select
- Layer ordering: Ctrl+] bring forward, Ctrl+[ send back, Ctrl+Shift+] front, Ctrl+Shift+[ back

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- site-guides/design/excalidraw.js -- current comprehensive site guide

### Integration Points
- Add STYLING section and ALIGNMENT AND LAYOUT section to guidance string
- Add workflow arrays for each styling and layout operation

</code_context>

<specifics>
## Specific Ideas
Color picker DOM selectors need live validation -- use keyboard shortcuts (S/G) as primary, DOM clicks as fallback.
</specifics>

<deferred>
## Deferred Ideas
None
</deferred>
