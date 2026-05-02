---
phase: 216
plan: 05
subsystem: discoverability-uat
tags: [seo, geo, manual-uat, search-console, rich-results, milestone-gate]
dependency-graph:
  requires:
    - 215-03 (Organization + SoftwareApplication JSON-LD on home page)
    - 216-01 (robots.txt / sitemap.xml / llms.txt static files committed)
    - 216-02 (prebuild crawler-file pipeline)
    - 216-03 (Express server prefers prerendered HTML for marketing routes)
    - 216-04 (smoke-crawler.mjs validates production build end-to-end)
  provides:
    - "216-HUMAN-UAT.md scaffold tracking manual SMOKE-04 + LD-03 verdicts"
    - "verify-uat.sh asserting scaffold structure (chained into umbrella verify.sh)"
    - "Sign-off footer marking the v0.9.46 milestone gate"
  affects:
    - "Phase 216 closure: code-complete when umbrella verify.sh exits 0; shipped when 216-HUMAN-UAT.md Status fields all flip to [x]"
tech-stack:
  added: []
  patterns:
    - "Manual UAT scaffold pattern (frontmatter status: partial + Tests block) carried over from 215-HUMAN-UAT.md"
    - "verify-*.sh chained into umbrella via [ -f path ] && bash path guard (Phase 215 pattern)"
    - "ASCII-only assertion via perl regex (BSD grep on macOS lacks -P)"
key-files:
  created:
    - .planning/phases/216-crawler-root-files-express-wiring-production-validation/216-HUMAN-UAT.md
    - .planning/phases/216-crawler-root-files-express-wiring-production-validation/verify-uat.sh
  modified: []
decisions:
  - "Hybrid scaffold structure: 215-precedent frontmatter + Tests block (status: partial, 5 pending entries) AT the top, plus richer UAT-216-01..05 detail sections below the separator. Operator can use either surface to capture results; verify-uat.sh asserts both shapes."
  - "verify-uat.sh exits 0 even when entries are pending (informational 'manual UAT pending' line). Pre-deploy CI must not be blocked by a UAT that, by definition, requires post-deploy live testing (CONTEXT.md D-13)."
  - "Umbrella verify.sh required no edits -- Plan 01 had already wired the [ -f path ] && bash path guard for verify-uat.sh in anticipation of Plan 05."
metrics:
  duration: "~10 minutes"
  completed: 2026-04-30
  tasks: 2
  files: 2
---

# Phase 216 Plan 05: Manual UAT Scaffold Summary

Scaffolds the 216-HUMAN-UAT.md artifact and its verify-uat.sh structural verifier so the operator has a defined place to record SMOKE-04 (Search Console "Test live URL") and LD-03 (Rich Results Test) verdicts after the production deploy. The plan does not run the UAT; it commits the scaffold and the verifier that confirms the scaffold's shape.

## What Shipped

### 216-HUMAN-UAT.md

The scaffold has two surfaces:

1. **Top section -- 215-precedent format.** Frontmatter (`status: partial`, started/updated dates, source) followed by a `## Tests` block with five `### N.` entries (one Rich Results + four Search Console). Each entry records `expected: ...` and `result: [pending]`. A `## Summary` block tallies total/passed/issues/pending/skipped/blocked counters. A `## Gaps` block captures deviations. This shape mirrors `215-HUMAN-UAT.md` exactly and feeds whatever orchestration reads the 215-style format.

2. **Bottom section -- detailed UAT-216-XX entries.** Five second-level sections (`## UAT-216-01:` through `## UAT-216-05:`) carrying Requirement reference, URL to test, Tool URL, verbatim Expected outcome (extracted from REQUIREMENTS.md SMOKE-04 + LD-03 + ROADMAP.md Phase 216 success criterion 5), and Status / Evidence / Date capture stubs. The Sign-off footer at the bottom is the milestone gate.

Five entries:

| ID | Requirement | URL | Tool |
|----|-------------|-----|------|
| UAT-216-01 | SMOKE-04 | https://full-selfbrowsing.com/ | Search Console live URL |
| UAT-216-02 | SMOKE-04 | https://full-selfbrowsing.com/about | Search Console live URL |
| UAT-216-03 | SMOKE-04 | https://full-selfbrowsing.com/privacy | Search Console live URL |
| UAT-216-04 | SMOKE-04 | https://full-selfbrowsing.com/support | Search Console live URL |
| UAT-216-05 | LD-03 + SMOKE-04 | https://full-selfbrowsing.com/ | Rich Results Test |

### verify-uat.sh

Phase-directory script (chmod +x) that asserts the scaffold's structural completeness:

1. UAT-FILE-EXISTS -- the file is present
2. UAT-FRONTMATTER -- `status: partial` line present
3. UAT-TESTS-BLOCK -- exactly 5 `### N.` entries
4. UAT-COUNT -- exactly 5 `## UAT-216-` detail sections
5. UAT-RICH-RESULTS -- references `search.google.com/test/rich-results`
6. UAT-SEARCH-CONSOLE -- references `search.google.com/search-console`
7. UAT-LD-COVERAGE -- both `Organization` and `SoftwareApplication` mentioned
8. UAT-ASCII -- file is ASCII-only (perl `[^\x00-\x7F]` regex; BSD grep lacks `-P`)
9. UAT-SIGNOFF -- `## Sign-off` footer present
10. INFO -- counts pending Status entries; reports informationally without failing

The verifier exits 0 with `manual UAT pending -- operator runs the 5 entries post-deploy` so it can be chained into the umbrella verify.sh without blocking pre-deploy CI. The actual UAT verdicts are the operator's milestone gate per CONTEXT.md D-13.

### Umbrella verify.sh

No edits required. Plan 01 had already wired the `[ -f "$PHASE_DIR/verify-uat.sh" ] && bash ...` guard, so the moment verify-uat.sh landed on disk the umbrella picked it up. The full chain order is:

```
verify-static.sh -> verify-prebuild.sh -> verify-server.sh -> verify-smoke.sh -> verify-uat.sh
```

Confirmed via `bash .planning/phases/216-.../verify.sh`: all five sub-verifiers passed, smoke-crawler reported 46/46 assertions PASS, umbrella exited 0 with `[216 umbrella] ALL AVAILABLE ASSERTIONS PASSED`.

## What the Operator Does Next

After the v0.9.46 deploy:

1. Run `BASE_URL=https://full-selfbrowsing.com npm --prefix showcase/angular run smoke:crawler` to confirm the production build still passes the same 46 assertions verify-smoke ran locally.
2. Open Google Rich Results Test (https://search.google.com/test/rich-results), test https://full-selfbrowsing.com/, capture the screenshot of the detected items panel, paste into UAT-216-05's Evidence field, flip Status to `[x]` if the panel shows exactly 1 Organization + 1 SoftwareApplication with 0 errors / 0 warnings.
3. In Google Search Console, run "Inspect URL -> Test Live URL" against `/`, `/about`, `/privacy`, `/support` (UAT-216-01..04). Capture the "URL is available to Google" panel for each, paste evidence link, flip Status when each passes.
4. When all five entries are `[x]` with Evidence + Date, the Sign-off footer marks Phase 216 shipped and the v0.9.46 milestone is closed.
5. Also flip the `## Tests` block top-section results from `[pending]` to `[passed]` and update the Summary counters so any orchestrator reading the 215-style frontmatter format sees the verdict too.

If any entry fails, do NOT silently weaken the expected outcome. Open a follow-up phase (216.1 or 217) addressing the specific finding, document the gap-closure path in the new phase's CONTEXT, and re-run only the affected UAT entry after the fix ships.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking issue] BSD grep on macOS lacks `-P` flag**
- **Found during:** Task 2 verifier authoring
- **Issue:** The plan's verifier sketch suggested `grep -qP "[^\x00-\x7F]"` for the ASCII-only assertion, but BSD grep (default on macOS) does not support `-P`; the assertion would have failed on developer laptops while passing on Linux CI.
- **Fix:** Replaced with `perl -ne 'exit 1 if /[^\x00-\x7F]/'` which is universally available and behaviorally identical.
- **Files modified:** verify-uat.sh
- **Commit:** 894b17c

### Reconciled User-Prompt Constraints

The orchestrator prompt's `<critical_constraints>` block required:
- Frontmatter + Tests structure matching 215-HUMAN-UAT.md (frontmatter `status: partial`, Tests block with 5 entries)
- verify-uat.sh exit 0 with informational "manual UAT pending" message

The PLAN.md required:
- Five `## UAT-216-XX` second-level sections with detailed Expected outcome / Status / Evidence / Date stubs
- verify-uat.sh assertions on tool URLs, ASCII-only, Sign-off footer

Both shapes were combined into a single file (215-style top + UAT-216-XX detail sections below). verify-uat.sh asserts the union of both verifier specs and exits 0 informationally. No deviation from intent -- the user's "use the same frontmatter + Tests block format" instruction was additive to the plan, not contradictory.

## Authentication Gates

None encountered during execution. SMOKE-04 + LD-03 themselves are auth-gated (Google account required), but Plan 05 only scaffolds the artifact -- the operator hits the auth gates post-deploy when running the actual UAT entries.

## Verification

```
bash .planning/phases/216-.../verify-uat.sh    -> [216] verify-uat.sh: ALL PRESENT, manual UAT pending
bash .planning/phases/216-.../verify.sh        -> [216 umbrella] ALL AVAILABLE ASSERTIONS PASSED
```

Full chain (Plans 01-05) green at 46/46 smoke-crawler assertions plus all static / prebuild / server / UAT-scaffold structural assertions. Phase 216 is code-complete.

## Self-Check: PASSED

- 216-HUMAN-UAT.md exists at the planned path -- FOUND
- verify-uat.sh exists at the planned path -- FOUND
- Task 1 commit 578893f exists -- FOUND
- Task 2 commit 894b17c exists -- FOUND
- Umbrella verify.sh exits 0 with all five sub-verifiers chained -- CONFIRMED
