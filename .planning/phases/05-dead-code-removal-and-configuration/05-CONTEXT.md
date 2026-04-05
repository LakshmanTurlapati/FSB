# Phase 5: Dead Code Removal and Configuration - Context

**Gathered:** 2026-02-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Eliminate dead code paths across the entire extension codebase and make the ElementCache maxCacheSize a user-configurable value instead of a hardcoded literal. No new features, no architecture changes -- remove what's unused and expose one hardcoded value as a setting.

</domain>

<decisions>
## Implementation Decisions

### Removal scope
- Remove waitForActionable and ALL references (primary target from ROADMAP.md)
- Additionally sweep ALL extension files for other dead code (not just content modules)
- Scope includes: content/, background.js, ai-integration.js, options.js, popup.js, sidepanel.js, and all other JS files
- Verification method: grep-confirmed zero references PLUS logical analysis of unreachable code paths
- Remove confirmed dead code regardless of size -- no size threshold
- Exception: preserve any scaffolding/placeholders related to future background agent functionality
- Clean up orphaned comments, TODOs, and JSDoc that reference deleted functions/code

### Configuration surface
- ElementCache maxCacheSize configurable from the Options page UI
- Setting lives in the existing Advanced Settings section (not a new section)
- Input control: preset dropdown with manual input option
- Presets include descriptive hints (e.g., "100 (Light pages)", "200 (Standard)", "500 (Heavy SPAs)")
- Manual input validated against a maximum limit of 1000 elements
- Value stored via existing config/storage patterns

### Default behavior
- Default cache size increased from 100 to 200 elements
- Changes take effect immediately on next page load or content script injection -- no extension reload required
- When cache size is reduced below current cached element count, clear entire cache and start fresh
- Backward compatibility: if no custom value is stored, default to 200

### Claude's Discretion
- Exact preset values for the dropdown (suggested: 50, 100, 200, 500)
- Minimum allowed cache size
- Implementation of the immediate-effect mechanism (storage listener vs message passing)
- How to structure the config read path in the content script modules

</decisions>

<specifics>
## Specific Ideas

- Dropdown presets should have contextual hints so users understand what each value is for without needing documentation
- The sweep should be thorough since Phase 4 modularization makes dead code more visible at module boundaries

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 05-dead-code-removal-and-configuration*
*Context gathered: 2026-02-22*
