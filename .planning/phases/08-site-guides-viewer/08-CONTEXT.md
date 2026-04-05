# Phase 8: Site Guides Viewer - Context

**Gathered:** 2026-02-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Restructure the 9 built-in site guide categories into per-site granular files, then expose them as read-only browsable content in the Memory tab. This phase covers both the data reorganization (splitting category JS files into per-site files) and building the viewer UI. The guides currently live in `site-guides/` as category-level files (ecommerce.js, social.js, etc.) and are only used internally by the AI -- never shown to users.

</domain>

<decisions>
## Implementation Decisions

### Guide Data Restructuring
- Split each category file (ecommerce.js, social.js, etc.) into per-site files (amazon.js, ebay.js, linkedin.js, etc.)
- Organize in category subdirectories: `site-guides/ecommerce/amazon.js`, `site-guides/social/linkedin.js`, etc.
- Each site file is self-contained with its own selectors, workflows, warnings, and guidance
- Shared category-level guidance preserved alongside per-site overrides (both layers exist)
- When AI loads a guide for a URL: load the matched site's guide + the shared category guidance (lean context, not the whole category)

### Viewer Placement
- Separate sub-section below the memory list in the Memory tab, with a clear visual break (distinct section header, subtle background or divider)
- Section always visible (not collapsed by default)
- Section header shows title with site coverage count (e.g., "Built-in Site Guides -- 42 sites covered")
- Category-specific FontAwesome icons per guide category (cart for ecommerce, comments for social, chart-line for finance, plane for travel, envelope for email, code for coding, briefcase for career, gamepad for gaming, tasks for productivity)

### Viewer List Structure
- Flat list of all individual sites, grouped by category with header labels
- Category headers are collapsible -- users can collapse categories they don't care about
- Each site item shows: site name + category badge
- Expanding a site uses inline accordion (same as memory detail panels)
- One site expanded at a time (accordion behavior -- opening one collapses any other)

### Expanded Site Content
- Content organized as collapsible sub-sections within the expanded site panel (Guidance, Selectors, Workflows, Warnings)
- All sub-sections collapsed by default when a site is first expanded
- Tool preferences are NOT shown in the viewer (purely internal AI context)

### Search and Filtering
- Extend the existing Memory tab search box to also filter site guides
- Search matches against site names and category names only (not guide content)
- Matching filters the guide list -- non-matching sites and empty category headers are hidden
- The type filter dropdown (Episodic/Semantic/Procedural) remains for memories only; Site Guides section is always visible regardless of type filter selection

### Claude's Discretion
- Exact display format for selectors (table vs code block) -- depends on restructured data format
- Exact display format for workflows (ordered list, etc.)
- Exact display format for warnings
- How guidance text is rendered (plain text, formatted sections, etc.)
- Exact icons chosen per category
- CSS styling details matching existing detail panel patterns
- How category-level shared guidance vs site-specific guidance is presented in the viewer
- Whether sub-sections show item counts in their headers

</decisions>

<specifics>
## Specific Ideas

- User wants per-site granularity to avoid context bloat when AI uses guides -- the restructuring is the primary motivation, viewer is built on top
- The restructuring should happen first, viewer built on the restructured data
- Category grouping in the viewer provides navigational structure without losing the per-site granularity
- The flat-list-with-grouped-headers pattern should feel similar to browsing the existing memory list

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope. The guide restructuring (per-site files) was originally considered separate but the user confirmed it belongs in this phase as the foundation for the viewer.

</deferred>

---

*Phase: 08-site-guides-viewer*
*Context gathered: 2026-02-21*
