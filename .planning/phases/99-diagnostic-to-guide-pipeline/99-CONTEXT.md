# Phase 99: Diagnostic-to-Guide Pipeline - Context

**Gathered:** 2026-03-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Extract autopilot recommendations from 50 v0.9.7 diagnostic reports (phases 47-96) and embed them as strategy hints in the corresponding site guide files, categorized by interaction type (canvas, drag, scroll, dark pattern). The hints must appear in autopilot continuation prompt context when operating on enriched sites.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion -- infrastructure/data pipeline phase. Key context:

- 50 diagnostic reports exist at `.planning/phases/{47-96}-*/*-DIAGNOSTIC.md`
- Each has an "Autopilot Recommendations" section with 2-5 recommendations
- Site guide files are JavaScript at `site-guides/{category}/{site}.js` using `registerSiteGuide()` pattern
- Site guides have a `guidance` text field that gets injected into the autopilot prompt
- Existing guides already contain site-specific intelligence (keyboard shortcuts, selectors, workflows)
- The `formatSiteKnowledge()` function in ai-integration.js formats guide data for prompt injection
- Recommendations should be categorized by interaction type: canvas, drag, scroll, dark pattern, context, micro-interaction

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- 50 diagnostic reports with "Autopilot Recommendations" sections (phases 47-96)
- Site guide files in site-guides/ directory (18 categories, 43+ sites)
- `registerSiteGuide()` pattern with `guidance` text field
- `formatSiteKnowledge()` in ai/ai-integration.js for prompt injection
- Existing guides (excalidraw.js, miro.js, tradingview.js, google-maps.js) already have MCP-tested intelligence

### Established Patterns
- Site guides use `guidance` string with newline-separated sections (KEYBOARD SHORTCUTS, CANVAS ELEMENT, etc.)
- Guide matching via `patterns` array (URL regex)
- `_buildTaskGuidance()` injects guide text into system prompt
- Diagnostic reports categorized as CANVAS-xx, SCROLL-xx, CONTEXT-xx, MICRO-xx, DARK-xx

### Integration Points
- `formatSiteKnowledge()` formats guide data for prompt context (budget ~500-800 chars)
- `_buildTaskGuidance()` provides the injection point where guide text enters the prompt
- Site guide `toolPreferences` array influences tool selection via `getRelevantTools()`

</code_context>

<specifics>
## Specific Ideas

No specific requirements -- infrastructure phase

</specifics>

<deferred>
## Deferred Ideas

None

</deferred>
