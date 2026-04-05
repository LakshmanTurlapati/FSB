# Phase 16: YAML DOM Snapshot - Context

**Gathered:** 2026-02-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace the current verbose JSON DOM snapshot with a compact, structured text format using element refs (e1, e2, ...) that is at least 40% smaller than the current JSON format while preserving all information needed for accurate AI action decisions. This phase builds the snapshot formatter only -- prompt rewrites (Phase 17) and parser wiring (Phase 18) are separate.

</domain>

<decisions>
## Implementation Decisions

### Element Line Format
- Use full HTML tag names (button, input, select, textarea, a) -- not abbreviated shorthands
- Moderate attribute density: visible text + id + primary class + boolean states -- no data attributes by default
- Form elements grouped with indentation under a form header line (form > fields > submit visual grouping)
- Include both viewport flag ([visible]/[offscreen]) AND region hints (@nav, @main, @footer) on each element
- Always show current input values inline: `e8: input "Email" val="user@test.com"`
- Always show full href on links: `e3: a "Settings" href="/account/settings"`
- Ref numbering is sequential per snapshot (e1, e2, e3...) -- renumbered each build, not stable across iterations
- Select/dropdown options shown as indented child lines under the select element

### Filtering Strategy
- Default filter: actionable elements (buttons, inputs, links, selects, checkboxes, textareas) plus nearby text context (labels, headings, descriptions) for semantic understanding
- Viewport-only by default -- offscreen elements excluded; AI must scroll to discover more
- Two snapshot modes: interactive (default) and full (entire page) -- AI requests full mode via CLI command (`snapshot full`)
- Flatten iframe elements into the main snapshot list -- treated as part of the page
- Traverse open shadow DOM roots and include their interactive elements in the flat list
- Collapse identical duplicate elements: `e5: button "Add to cart" (x50)` instead of listing all 50
- Include a filter summary footer with count + type breakdown: `--- 23/147 shown | 40 links, 12 buttons, 8 inputs offscreen`

### Metadata Header Block
- YAML-style key:value format for all metadata
- Required fields: URL, title, scroll position, viewport dimensions
- Scroll shown as both absolute pixels and percentage: `scroll: 500/2400 (21%)`
- Include form summary: count and brief description of forms on page
- Include heading outline: page heading hierarchy (h1 > h2 > h2 > h3)
- Include active/focused element indicator
- Include page load state: `state: complete | loading | interactive`
- Include CAPTCHA detection flag: `captcha: true/false`
- No pending network request tracking -- keep it to document ready state only

### Site Guide Annotations
- Bracket tag format appended to element line: `e12: input "Search" #search-box [hint:searchBox:type]`
- Annotations convey role name + suggested action verb (e.g., `[hint:searchBox:type]`, `[hint:submitBtn:click]`)
- No workflow-level hints injected into the metadata header -- annotations on elements only
- Site guides define CSS selectors that the snapshot engine matches to element refs at build time

### Claude's Discretion
- Exact YAML indentation and spacing style
- How nearby text context is associated with elements (inline vs grouped)
- Handling of elements that don't fit neatly into region categories
- Token optimization tradeoffs within the 40% reduction target
- How to handle pages with extremely large element counts (truncation strategy)

</decisions>

<specifics>
## Specific Ideas

- Element line example from success criteria: `e5: button "Submit Form" .btn-primary [disabled]`
- Annotated element example: `e12: input "Search" [hint:searchBox:type]`
- Filter footer example: `--- 23/147 shown | 40 links, 12 buttons, 8 inputs offscreen`
- The format should be readable by humans during debugging, not just machine-parseable
- Duplicate collapse example: `e5: button "Add to cart" (x50)` -- single line represents many identical elements

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 16-yaml-dom-snapshot*
*Context gathered: 2026-02-28*
