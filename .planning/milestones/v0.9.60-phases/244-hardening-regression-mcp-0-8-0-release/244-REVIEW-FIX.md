---
phase: 244-hardening-regression-mcp-0-8-0-release
fixed_at: 2026-05-05T00:00:00Z
review_path: .planning/phases/244-hardening-regression-mcp-0-8-0-release/244-REVIEW.md
iteration: 1
findings_in_scope: 1
fixed: 1
skipped: 0
status: all_fixed
---

# Phase 244: Code Review Fix Report

**Fixed at:** 2026-05-05
**Source review:** .planning/phases/244-hardening-regression-mcp-0-8-0-release/244-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 1
- Fixed: 1
- Skipped: 0

## Fixed Issues

### WR-01: README Tools tables omit the new `back` tool

**Files modified:** `mcp/README.md`
**Commit:** 38b7595
**Applied fix:** Added the `back` tool row to the Autopilot table (now Autopilot (4)) with the description "Single-step browser-history back, ownership-gated. Returns `{ status, resultingUrl, historyDepth }`." Bumped the section heading from `## Tools (59 Total)` to `## Tools (60 Total)` and updated the matching ToC anchor from `#tools-59-total` to `#tools-60-total` so the in-page link stays live.

---

_Fixed: 2026-05-05_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
