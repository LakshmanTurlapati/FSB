# Phase 147: Control Panel Replica - Context

**Gathered:** 2026-04-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Pixel-accurate recreation of the real FSB control panel Dashboard/Analytics view in the showcase "See It in Action" section. The replica must be visually indistinguishable from the real options.html Dashboard view in both dark and light themes, using the corrected rec- token baseline from Phase 145.

</domain>

<decisions>
## Implementation Decisions

### Dashboard Content & Layout
- Show Dashboard/Analytics view -- most visually rich, matches existing recreation
- Display realistic sample analytics data: tasks: 247, tokens: 1.2M, cost: $4.82, success rate: 94%
- Show 3 session history cards with mixed statuses (completed, failed, in-progress)
- Include all 8 sidebar nav items with correct icons per 145-TOKENS.md audit (Dashboard, Analytics, Session Logs, Memory, Site Guides, Background Agents, Settings, Help & Documentation)

### Chart & Animation
- SVG line chart matching existing rec-line-svg pattern
- CountUp counter animation on scroll extending existing initCounterAnimation
- SVG stroke-dashoffset chart draw animation on scroll (CSS-only, no JS library needed)

### Claude's Discretion
- Exact session history card content (task descriptions, timestamps)
- CSS class naming within rec-opt-* namespace
- Whether to split large CSS additions into logical sections

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- showcase/css/recreations.css -- rec-dashboard classes exist, corrected tokens from Phase 145
- showcase/about.html -- existing Recreation 2 section with dashboard recreation
- showcase/js/recreations.js -- initCounterAnimation() and IntersectionObserver patterns
- .planning/phases/145-fresh-ui-audit-token-baseline/145-TOKENS.md -- token reference

### Established Patterns
- .browser-frame > .browser-header > .browser-content container pattern
- --rec-opt-* CSS variable namespace for dashboard tokens
- rec-line-svg polyline pattern for charts
- IntersectionObserver with threshold 0.3

### Integration Points
- Replace existing Recreation 2 HTML in about.html
- Update rec-dashboard CSS in recreations.css
- Extend animation functions in recreations.js

</code_context>

<specifics>
## Specific Ideas

From 145-TOKENS.md structural gap analysis, the dashboard replica is missing:
- "Help & Documentation" nav item (8th item)
- Wrong icons: fa-robot should be fa-server for Agents, fa-database should be fa-brain for Memory
- Wrong sidebar item order
- Missing cost-breakdown section in analytics

</specifics>

<deferred>
## Deferred Ideas

- Tab navigation beyond Dashboard view -- deferred per requirements scope
- Interactive sidebar navigation -- static replica only

</deferred>
