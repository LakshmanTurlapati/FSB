# Phase 114: Natural Language Diagrams - Context

**Gathered:** 2026-03-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Add natural language diagram generation capability to the Excalidraw site guide. When a user describes a diagram in plain English (e.g., "draw a flowchart for user login"), FSB autonomously plans the layout, draws shapes, adds labels, and connects elements. Covers flowcharts, architecture diagrams, and mind maps.

</domain>

<decisions>
## Implementation Decisions

### Diagram Layout Planning
- AI plans layouts using a coordinate grid: 150px horizontal spacing, 120px vertical spacing, 150x80px default shape size
- Flowcharts: top-to-bottom flow, decision diamonds branch left/right
- Architecture diagrams: left-to-right tiers, components within each tier stacked vertically
- Mind maps: center node with radial branches, each branch gets a direction (right/up/left/down)
- The AI uses # comment lines in its first iteration to plan coordinates before drawing

### Implementation Approach
- This is purely site guide content -- add a NATURAL LANGUAGE DIAGRAM GENERATION section with layout templates
- Include coordinate templates for each diagram type so the AI has concrete starting positions
- Include step-by-step sequences: plan layout -> draw shapes -> add labels -> draw connectors -> align
- No code changes needed -- all existing CDP tools and site guide sections already support the operations

### Claude's Discretion
- Exact coordinate positions for templates
- How many example layouts to include
- Level of detail in the planning instructions

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- site-guides/design/excalidraw.js -- comprehensive site guide with all drawing, text, styling, connector, and export workflows from Phases 107-113
- All keyboard shortcuts and CDP tool patterns already documented
- Coordinate convention (150px/120px) already established in Phase 108

### Established Patterns
- AI uses # comment lines for reasoning/planning during automation
- Multi-step sequences work via the automation loop (draw shapes first, then label, then connect)
- Site guide guidance is injected into AI system prompt automatically

### Integration Points
- Add NATURAL LANGUAGE DIAGRAM GENERATION section to guidance string
- Add layout template workflow arrays for flowchart, architecture, mind map
- Reference existing DRAWING PRIMITIVES, TEXT ENTRY, CONNECTORS sections

</code_context>

<specifics>
## Specific Ideas

The key insight is that the AI already knows how to draw shapes, add text, and draw arrows. What it lacks is a layout planning framework -- given a description like "draw a login flowchart", it needs to know HOW to position the shapes in a grid before starting to draw.

Provide concrete coordinate templates:
- 4-step flowchart: shapes at (300,200), (300,320), (300,440), (300,560) connected by arrows
- 3-tier architecture: tier labels at x=200,500,800, components stacked at y=200,320,440
- Mind map: center at (600,400), 4 branches extending 200px in each direction

</specifics>

<deferred>
## Deferred Ideas

- Sequence diagrams (complex layout engine needed)
- ER diagrams (relationship labeling complexity)
- Swimlane diagrams (lane boundaries need precise alignment)

</deferred>
