# Phase 9: Data Pipeline Foundation - Context

**Gathered:** 2026-02-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Parse 38 research session logs into per-company career site guides using the existing site-guides/ infrastructure. Guides contain selectors, interaction sequences, and confidence scores so Phase 10's AI can navigate career pages with precision. Also audit and improve the 4 existing career site guides. Single-site search automation is Phase 10; multi-site is Phase 11.

</domain>

<decisions>
## Implementation Decisions

### Site Guide Content
- Full interaction path coverage: search box, filters (location/department), results container, individual job cards, pagination, and apply button
- Hashed/unstable CSS selectors are included but flagged with stability warnings (stable alternatives tried first)
- ATS-based inheritance: company guides extend ATS base guides (workday.js, greenhouse.js, etc.) with company-specific overrides
- Primary career URL only per company (no alternate/category URLs)
- Selectors and URLs only -- no behavioral metadata (auth walls, AJAX quirks). AI discovers those at runtime
- Even all-hashed-selector sites get a guide generated (something is better than nothing)
- Interaction sequence included: ordered workflow (e.g., cookie dismiss -> search -> filter -> results)
- When multiple sessions conflict on interaction order, most recent session wins
- Machine-optimized, minimal format (no comments or human-readable explanations)
- Flexible structure per company (no forced standard interface). Phase 10 adapts to whatever each guide provides
- ATS auto-detected from session logs via URL patterns and DOM signatures (no manual mapping)
- 5 ATS base guides created: Workday, Greenhouse, Lever, iCIMS, Taleo (as separate files)
- Generic ATS fallback guide also created in Phase 9 for unrecognized platforms

### Session Log Parsing
- Source: 38 research logs in Logs/ directory (fsb-research-domain-YYYY-MM-DD.json format)
- Research logs only; session logs (fsb-session-*.json) are ignored
- Extract everything from logs (all interactive elements, forms, headings, links). Guide generation step filters what's career-relevant
- All page depths used (depth 0, 1, 2, etc.) -- deeper pages may contain job detail selectors
- Incomplete/partial logs: extract what's there. Even URL-only from a partial log is valuable
- Multiple sessions for same company: union of all selectors (combine data from all sessions)
- Parser is a build-time tool Claude runs during development, not runtime. Output ships as static assets
- No summary report generated -- just produce the guide files
- Raw log files kept in Logs/ directory as-is after parsing

### Confidence Scoring
- Combination scoring: both element coverage AND selector stability determine confidence
- HIGH = good element coverage + mostly stable selectors
- MEDIUM = partial coverage or mixed selector quality
- LOW = below minimum quality bar (fewer than 3 usable elements AND all selectors fragile) -> URL-only guidance + generic ATS fallback
- Confidence score stored inside each site guide file (no separate manifest)
- Score is informational only -- does NOT affect how Phase 10 uses the guide. Phase 10 always tries whatever selectors exist

### Output Structure
- New company guides go into existing site-guides/career/ directory following established format (selectors, workflows, patterns, toolPreferences, etc.)
- 5 separate ATS base files created: workday.js, greenhouse.js, lever.js, icims.js, taleo.js in site-guides/career/
- Parser auto-updates site-guides/index.js registry AND background.js imports
- No separate sitemap JSON files -- site guides are the sole output
- Existing 4 career guides (generic.js, indeed.js, glassdoor.js, builtin.js) audited and improved to match new quality bar

### Claude's Discretion
- Exact confidence scoring algorithm and thresholds
- How to filter career-relevant elements from raw extraction
- File naming convention for per-company guides
- Internal parser architecture and implementation approach
- How ATS detection heuristics work (URL pattern matching, DOM signature matching)

</decisions>

<specifics>
## Specific Ideas

- Existing site guide format is the template: site, category, patterns, guidance, selectors, workflows, warnings, toolPreferences
- The knowledge graph (lib/visualization/knowledge-graph.js) visualizes site intelligence -- new guides should appear there automatically via the registry
- ATS detection should use URL patterns (e.g., myworkdayjobs.com, boards.greenhouse.io) and DOM signatures from the research logs
- "No matter what, refine to the best" -- every guide, new or existing, should be polished to the highest quality

</specifics>

<deferred>
## Deferred Ideas

- Audit and improve ALL 53 site guides across all 9 categories (not just career) -- future phase
- Site Guides Viewer design mismatch (noted in STATE.md as deferred from v9.3)

</deferred>

---

*Phase: 09-data-pipeline-foundation*
*Context gathered: 2026-02-23*
