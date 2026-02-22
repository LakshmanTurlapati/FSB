# Research Summary: Content Script Modularization & Tech Debt Cleanup

**Project:** FSB v9.0.2 - Tech Debt Cleanup
**Domain:** Chrome Extension content script decomposition
**Researched:** 2026-02-21
**Overall confidence:** HIGH

## Executive Summary

FSB's `content.js` is a 13,429-line monolith containing 7 distinct functional domains all inside a single re-injection guard block. The file has grown organically over 10 releases and now contains DOM state management classes, 5 Shadow DOM overlay systems, 25+ browser automation tool functions, element utility/ARIA helpers, DOM serialization logic, site explorer data collectors, and the central message dispatcher. The code works correctly but is unmaintainable: git diffs are incomprehensible, onboarding requires understanding the entire file, and independent testing of components is impossible.

Research confirms that Chrome Extension Manifest V3 content scripts -- whether declared in `manifest.json` or injected via `chrome.scripting.executeScript` -- share a single global scope per frame per extension. Files listed in the `js` array execute sequentially and can access each other's top-level declarations. This means the monolith can be split into multiple files without a build system, transpiler, or any architectural gymnastics. The existing pattern of injecting `['utils/automation-logger.js', 'content.js']` already proves this works.

The recommended approach is a **shared namespace object** (`window.FSB`) with **IIFE-wrapped module files** loaded in dependency order. Each module registers its exports on the namespace. The message handler (loaded last) dispatches to tools and serializers via the namespace. The re-injection guard moves to a bootstrap file, and each module has its own lightweight guard.

ES modules (`import`/`export`) are confirmed NOT supported in content scripts. Dynamic `import()` breaks isolated world access to Chrome APIs. Bundlers are excluded by project constraints. The multi-file shared-scope approach is the only viable path.

## Key Findings

**Stack:** Split content.js into 9 files using `window.FSB` namespace, loaded via `chrome.scripting.executeScript({ files: [...] })` array ordering. No build system needed.

**Architecture:** Linear dependency chain: namespace -> dom-state -> visual-feedback -> element-utils -> action-verification -> tools -> dom-serializer -> explorer -> message-handler. No circular dependencies exist in the current code.

**Critical pitfall:** All 3 injection points in `background.js` must be updated simultaneously. Missing a file from the array causes silent failures (module registers as `null`, message handler can't find tools).

## Implications for Roadmap

Based on research, suggested phase structure:

1. **Phase 1: Foundation** - Create namespace bootstrap, update injection points
   - Addresses: Re-injection guard refactoring, injection point consolidation
   - Avoids: Partial injection bug (missing files from array)
   - Deliverable: `_namespace.js` + `_config.js`, `CONTENT_SCRIPT_FILES` constant in background.js

2. **Phase 2: Extract passive modules** - DOM state, visual feedback, element utilities
   - Addresses: Largest code sections with fewest external callers
   - Avoids: Breaking the tools/message handler (high-risk modules deferred)
   - Deliverable: 3 module files extracted, content.js reduced by ~3,800 lines

3. **Phase 3: Extract active modules** - Action verification, tools, DOM serializer
   - Addresses: Core automation logic, the tools registry
   - Avoids: Partial extraction (tools must be complete or not at all)
   - Deliverable: 3 module files extracted, content.js reduced by ~6,600 lines

4. **Phase 4: Extract message handler and finalize** - Message handler, explorer, dead code cleanup
   - Addresses: Final extraction, dead code removal, hardcoded config values
   - Avoids: Premature dead code removal (wait until module boundaries are clear)
   - Deliverable: content.js eliminated, all code in content/ directory

**Phase ordering rationale:**
- Namespace must exist before any module can register on it
- Passive modules (state, visuals, utilities) are lower risk because they are called by other modules but do not call outward
- The tools registry and message handler are the highest-risk extractions because they wire everything together
- Dead code removal happens last because module boundaries make dead code obvious

**Research flags for phases:**
- Phase 3: The `tools` object is 3,700 lines with deep cross-cutting dependencies. Needs careful dependency analysis before extraction.
- Phase 4: `generateSelector` is defined twice (lines 2986 and 10759). Needs investigation to determine which is authoritative.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack (shared scope mechanics) | HIGH | Verified against Chrome official docs + existing codebase pattern |
| Features (what to extract) | HIGH | Direct codebase analysis, clear section boundaries |
| Architecture (dependency order) | HIGH | Traced all cross-references in content.js |
| Pitfalls (injection bugs) | HIGH | Found 3 injection points with inconsistent file lists |

## Gaps to Address

- The exact list of dead functions should be determined during Phase 2-3 extraction (grep for callers during each move)
- Constructor argument bugs in utility modules (mentioned in milestone context) were not researched in this stack-focused investigation -- they need a separate targeted review
- Performance impact of 10-file vs 1-file injection should be benchmarked but is expected to be negligible based on Chrome's local file loading
