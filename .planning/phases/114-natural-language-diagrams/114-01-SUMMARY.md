---
phase: 114-natural-language-diagrams
plan: 01
subsystem: site-guides
tags: [excalidraw, diagram-generation, flowchart, architecture-diagram, mind-map, layout-planning]

requires:
  - phase: 113-export
    provides: Complete Excalidraw site guide with drawing primitives, text entry, connectors, styling, and export workflows
provides:
  - Natural language diagram generation guidance section with coordinate templates for flowcharts, architecture diagrams, and mind maps
  - Three workflow arrays (generateFlowchart, generateArchitectureDiagram, generateMindMap) for step-by-step diagram creation
  - Layout planning rules with grid convention (150px horizontal, 120px vertical spacing)
affects: [excalidraw-site-guide, diagram-automation]

tech-stack:
  added: []
  patterns: [plan-before-draw coordinate templates, grid-based layout convention]

key-files:
  created: []
  modified: [site-guides/design/excalidraw.js]

key-decisions:
  - "Coordinate templates use concrete pixel values so AI can follow them directly without calculation"
  - "Planning step uses # comment lines to lay out all positions before any drawing actions"
  - "Mind map uses ellipse for center node and rectangles for branches to visually distinguish hierarchy"

patterns-established:
  - "Plan-before-draw: AI must plan all coordinates with # comments before drawing shapes"
  - "Grid convention: 150px horizontal, 120px vertical spacing, 150x80 default shape size"
  - "Execution sequence: plan -> shapes -> labels -> connectors -> align/style"

requirements-completed: [NL-01, NL-02, NL-03, NL-04, NL-05]

duration: 2min
completed: 2026-03-24
---

# Phase 114 Plan 01: Natural Language Diagram Generation Summary

**Grid-based coordinate templates for flowcharts (top-to-bottom with diamond branching), architecture diagrams (left-to-right tiers), and mind maps (radial branches) with plan-before-draw workflow sequences**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-24T07:54:11Z
- **Completed:** 2026-03-24T07:56:17Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Added NATURAL LANGUAGE DIAGRAM GENERATION section to Excalidraw site guide with 5 subsections: Layout Planning Rules, Flowchart Template, Architecture Diagram Template, Mind Map Template, General Scaling Rules
- Added 3 workflow arrays (generateFlowchart, generateArchitectureDiagram, generateMindMap) with 8 steps each covering plan -> setup -> draw -> label -> connect -> verify
- Added planning-before-drawing warning to warnings array
- All templates reference NL-01 through NL-05 requirement IDs and cross-reference existing DRAWING PRIMITIVES, TEXT ENTRY, and CONNECTORS sections

## Task Commits

Each task was committed atomically:

1. **Task 1: Add NATURAL LANGUAGE DIAGRAM GENERATION section to Excalidraw site guide** - `68b8c8f` (feat)

## Files Created/Modified
- `site-guides/design/excalidraw.js` - Added NATURAL LANGUAGE DIAGRAM GENERATION guidance section with coordinate templates, 3 workflow arrays, and 1 warning

## Decisions Made
- Coordinate templates use concrete pixel values (e.g., "top-left (300, 200), drag to (450, 280)") so the AI can follow them without calculation
- Planning step uses # comment lines rather than a separate planning tool -- lightweight and works within existing automation loop
- Mind map center uses ellipse (O key) while branches use rectangles (R key) to visually distinguish hierarchy levels

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- This is the final phase (114) of the v0.9.9 Excalidraw Mastery milestone
- All 8 phases (107-114) are now complete
- The Excalidraw site guide is comprehensive with session setup, drawing primitives, text entry, canvas operations, element editing, connectors, styling, export, and natural language diagram generation

---
*Phase: 114-natural-language-diagrams*
*Completed: 2026-03-24*
