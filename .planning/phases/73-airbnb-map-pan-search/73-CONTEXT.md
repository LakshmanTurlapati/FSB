# Phase 73: Airbnb Map Pan Search - Context

**Gathered:** 2026-03-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Execute Airbnb map pan to populate new listing pins via MCP manual tools; fix blockers.

</domain>

<decisions>
## Implementation Decisions

### Target Site & Setup
- Use Airbnb (airbnb.com) search results with map view -- no auth for browsing
- Search for a location to get map + listings view
- Dismiss cookie/consent popups

### Test Workflow
- Navigate to Airbnb search results with map visible
- Pan the map to a new area using drag
- Wait for new listing pins to load
- Verify new pins appeared (different listings visible)

### Pass/Fail & Diagnostics
- PASS = map panned + new listing pins loaded in the new area
- PARTIAL = map panned but new listings didn't load
- FAIL = couldn't interact with the map
- Use drag for map panning (same as Google Maps Phase 49), wait_for_stable for pin loading
- Same diagnostic report template

### Claude's Discretion
- Which Airbnb search location
- Pan direction and distance
- How to verify new pins loaded
- Diagnostic details

</decisions>

<canonical_refs>
## Canonical References

### MCP tools
- `mcp-server/src/tools/manual.ts` -- drag, click_at, scroll_at, navigate

### Prior art
- `.planning/phases/49-google-maps-path-tracing/49-DIAGNOSTIC.md` -- Map drag interaction

### Milestone requirements
- `.planning/REQUIREMENTS.md` -- SCROLL-07 requirement
- `.planning/ROADMAP.md` -- Phase 73 success criteria

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `drag` for map panning (confirmed working on Google Maps)
- `navigate`, `read_page`, `get_dom_snapshot`, `wait_for_stable`
- Google Maps site guide patterns applicable to Airbnb map

### Integration Points
- Site guide in `site-guides/ecommerce/airbnb.js` or `site-guides/travel/airbnb.js`

</code_context>

<specifics>
## Specific Ideas

- Airbnb uses Google Maps or Mapbox for their map -- drag panning should work
- Listing pins are DOM elements overlaid on the map canvas
- After panning, Airbnb makes an API call to fetch listings for the new viewport

</specifics>

<deferred>
## Deferred Ideas

None

</deferred>

---

*Phase: 73-airbnb-map-pan-search*
*Context gathered: 2026-03-21*
