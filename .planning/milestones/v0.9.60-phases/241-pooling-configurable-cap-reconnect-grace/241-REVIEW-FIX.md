---
phase: 241-pooling-configurable-cap-reconnect-grace
fixed_at: 2026-05-05T00:00:00Z
review_path: .planning/phases/241-pooling-configurable-cap-reconnect-grace/241-REVIEW.md
iteration: 1
findings_in_scope: 2
fixed: 2
skipped: 0
status: all_fixed
---

# Phase 241: Code Review Fix Report

**Fixed at:** 2026-05-05
**Source review:** .planning/phases/241-pooling-configurable-cap-reconnect-grace/241-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 2 (Critical: 0, Warning: 2; Info findings out of scope per fix_scope=critical_warning)
- Fixed: 2
- Skipped: 0

## Fixed Issues

### WR-01: stageReleaseByConnectionId leaks the prior timer if called twice for the same connectionId

**Files modified:** `extension/utils/agent-registry.js`
**Commit:** 94966ec
**Applied fix:** Inserted a prior-entry lookup (`self._stagedReleases.get(connectionId)`) immediately after the empty-agentIds early return and before scheduling the new `setTimeout`. If a prior entry exists with a `timeoutId`, `clearTimeout` is invoked (wrapped in try/catch to swallow any environment-specific clearTimeout error). Comment block references Phase 241 WR-01 and explains the duplicated-onclose / replay-path leak scenario the guard prevents. The replacement `_stagedReleases.set` line is unchanged, so the new entry still overwrites cleanly. Verified syntax with `node -c`. Note: this is a defensive guard against a duplicate-stage path; the fix itself is structural rather than logic-altering, so it does not require human re-verification.

### WR-02: saveSettings writes fsbAgentCap to storage without range clamping

**Files modified:** `extension/ui/options.js`
**Commit:** 8df55b6
**Applied fix:** Replaced `parseInt(elements.fsbAgentCap?.value, 10) || 8` with an IIFE that performs explicit three-step clamping: (1) `Number.isFinite` check returning 8 on NaN/non-finite input, (2) lower-bound clamp to 1 if `raw < 1`, (3) upper-bound clamp to 64 if `raw > 64`. Comment block extended to reference Phase 241 WR-02 and explain the DevTools-tampered / stale-export attack vectors this addresses. Symmetric with the load path at `options.js:805-818`. Verified syntax with `node -c`.

## Skipped Issues

None.

---

_Fixed: 2026-05-05_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
