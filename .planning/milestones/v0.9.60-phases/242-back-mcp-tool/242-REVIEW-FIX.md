---
phase: 242-back-mcp-tool
fixed_at: 2026-05-05T00:00:00Z
review_path: .planning/phases/242-back-mcp-tool/242-REVIEW.md
iteration: 1
findings_in_scope: 2
fixed: 2
skipped: 0
status: all_fixed
---

# Phase 242: Code Review Fix Report

**Fixed at:** 2026-05-05
**Source review:** .planning/phases/242-back-mcp-tool/242-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 2
- Fixed: 2
- Skipped: 0

## Fixed Issues

### WR-01: Active-tab resolution path skips ownership verification

**Files modified:** `extension/ws/mcp-tool-dispatcher.js`
**Commit:** 06d749f
**Applied fix:** After the active-tab is resolved via `getActiveTabFromClient(client)` in `handleBackRoute`, re-invoke `checkOwnershipGate` with a fresh payload object that threads the resolved `targetTabId`. This closes the gap where `_resolveTabIdForGate` returned null on the dispatcher entry (because `payload.tabId` was omitted), letting `checkOwnershipGate` skip the tab-ownership arm and only validate agent registration. A registered-but-non-owning agent can no longer drive history-back on a tab it does not own. The recheck is sync and cheap; the existing contract is preserved by spreading `payload` before overriding `tabId`. An inline comment references WR-01 so future readers see the rationale.

### WR-02: Settle race can misclassify BF-cache restoration as ok

**Files modified:** `extension/ws/mcp-tool-dispatcher.js`
**Commit:** 0c0be6f
**Applied fix:** Documented the best-effort caveat in the `classifyBackOutcome` JSDoc (option 1 from the review). The pageshow listener is injected via `chrome.scripting.executeScript` AFTER `chrome.tabs.goBack` fires, so a same-origin BF-cache restoration whose pageshow event fires before the listener lands will be classified as `ok` rather than `bf_cache`. The JSDoc now explicitly tells callers the `bf_cache` discriminator is best-effort and that `ok` may occasionally shadow a missed BF-cache event. Option 2 (re-order the injection ahead of `goBack`) would require splitting `waitForBackSettle` into arm/await phases and is deferred as structural surgery beyond a targeted fix; the orchestrator authorized falling back to JSDoc when re-ordering is non-trivial.

While editing the JSDoc, the IN-01 clarification (`'no_history'` is decided upstream by `handleBackRoute` step 4) was also folded in since it was adjacent and trivial. This is a minor scope expansion noted here for transparency; it was not committed separately.

---

_Fixed: 2026-05-05_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
