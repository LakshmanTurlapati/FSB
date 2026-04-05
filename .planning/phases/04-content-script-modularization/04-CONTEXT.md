# Phase 4: Content Script Modularization - Context

**Gathered:** 2026-02-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Split the 13K-line content.js monolith into separate module files under a flat content/ directory, using the window.FSB namespace pattern with programmatic injection via chrome.scripting.executeScript. All existing functionality must be preserved identically. No new features, no architecture changes -- extract existing code into files and clean up.

</domain>

<decisions>
## Implementation Decisions

### Module naming and file structure
- Simple file names: init.js, utils.js, actions.js, dom-analysis.js, etc. (no prefix)
- Flat content/ directory -- all module files at same level, no subdirectories
- ~10 modules as defined in existing plans (init.js, utils.js, dom-state.js, selectors.js, visual-feedback.js, accessibility.js, actions.js, dom-analysis.js, messaging.js, lifecycle.js)
- No loader file -- background.js directly lists all content script files in a CONTENT_SCRIPTS array with explicit dependency order

### Namespace organization
- Hybrid namespace: core utilities at top level (FSB.init, FSB.config), feature modules nested (FSB.actions.click, FSB.dom.analyze, FSB.utils.delay)
- Modules merge into existing namespace via Object.assign -- safe for any load order, no errors on existing keys
- Only public API exposed on FSB namespace -- internal helpers stay private within each module's IIFE/closure
- FSB._modules property tracks loaded modules and their status for debugging injection issues

### Transition and rollback strategy
- Module-by-module extraction across plans (content.js shrinks gradually, each step independently testable)
- Clean cut at the end -- old content.js deleted, no parallel coexistence period
- Manual smoke test after each plan execution to verify nothing broke
- Fix forward if issues arise -- debug and fix in the extracted module, don't revert

### Module failure behavior
- Two tiers: core modules and additive modules
- Core modules (init, utils, actions, dom-analysis, messaging, dom-state, selectors, lifecycle): if any core module fails to load, fail completely -- extension won't work on that tab
- Additive modules (visual-feedback, accessibility, site guides, analytics): failure does not break core automation -- FSB can still click, type, navigate without them
- Per-module guard against double-injection: each module checks if its namespace already exists before registering
- Load errors reported via console error + extension badge indicator

### Claude's Discretion
- Exact function-to-module assignments (which functions go where)
- Module load order within the CONTENT_SCRIPTS array
- IIFE vs other closure patterns for module encapsulation
- FSB._modules data structure and what metadata to track

</decisions>

<specifics>
## Specific Ideas

- "Core always works" -- the fundamental automation (click, type, navigate, DOM analysis) must function even if higher-level features like site guides or analytics fail to load
- Extension badge should indicate error state when module loading fails

</specifics>

<deferred>
## Deferred Ideas

- Site guide refinement: Make site guides more granular and per-site specific, with FSB having enough generic context to work on any site even without site-specific guides -- future phase
- Smart multi-tab management with context-aware navigation -- already tracked in pending todos

</deferred>

---

*Phase: 04-content-script-modularization*
*Context gathered: 2026-02-22*
