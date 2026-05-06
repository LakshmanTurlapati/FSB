# Phase 243 Deferred Items

## Pre-existing test failures (NOT caused by this phase)

### tests/agent-cap-ui.test.js Test 8 - "saveSettings includes fsbAgentCap: parseInt(elements.fsbAgentCap...)"

- **Status:** Pre-existing failure verified by `git stash` (test fails on the unmodified `Refinements` branch baseline, before any 243-04 edits).
- **Root cause:** A subsequent (post-Phase-241) refactor wrapped the `fsbAgentCap` serialisation in an IIFE pattern (`fsbAgentCap: (function() { var raw = parseInt(elements.fsbAgentCap?.value, 10); ... })()`). The Phase 241 test still asserts the literal `fsbAgentCap: parseInt(elements.fsbAgentCap` substring.
- **Scope:** Out of scope for Plan 243-04 (UI-03 cap counter polish). The IIFE refactor predates this plan.
- **Suggested fix:** Update the Phase 241 test regex to accept either pattern, or update the IIFE in `saveSettings` back to the literal `parseInt(elements.fsbAgentCap?.value, 10)` form.
- **Discovered during:** Plan 243-04 Task 2 verification.
