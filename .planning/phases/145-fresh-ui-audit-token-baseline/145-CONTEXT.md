# Phase 145: Fresh UI Audit & Token Baseline - Context

**Gathered:** 2026-04-02
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure phase -- discuss skipped)

<domain>
## Phase Boundary

Every replica built in this milestone starts from an accurate, verified snapshot of the current extension UI -- not stale assumptions or outdated CSS values. Audit sidepanel.css, options.css, and fsb-ui-core.css for exact token values. Map existing rec- variables against real values. Enumerate structural gaps between current about.html recreations and real extension HTML.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion -- pure infrastructure/audit phase. Use ROADMAP phase goal, success criteria, and codebase conventions to guide decisions. The user recently made UI changes, so a fresh re-scout of the actual CSS files is required before any replica work begins.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- showcase/css/recreations.css (1282 lines) -- existing rec- token system with --rec-sp-* and --rec-opt-* namespaces
- showcase/about.html -- existing recreation HTML structure (3 recreations: Google Search, Dashboard, Form)
- showcase/js/recreations.js -- existing animation functions (typing cascade, counters)

### Established Patterns
- rec- CSS prefix namespace for all replica styling
- --rec-* CSS custom properties for theme-aware token isolation
- [data-theme] toggle convention (dark default, light override on showcase)
- .browser-frame container pattern for all recreations

### Integration Points
- Real extension CSS files: ui/sidepanel.css, ui/options.css, shared/fsb-ui-core.css (read-only reference)
- Real extension HTML: ui/sidepanel.html, ui/control_panel.html (read-only reference)
- MCP tool definitions: mcp-server/src/tools/*.ts (reference for terminal content)

</code_context>

<specifics>
## Specific Ideas

User has made recent UI changes -- fresh audit of current state is essential before building any replicas. Do not rely on research findings for exact values; re-read the actual CSS files.

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope.

</deferred>
