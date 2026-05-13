---
phase: 266-verification-baseline
subsystem: showcase/i18n
tags: [i18n, ci, verification, milestone-gate]
one_liner: "End-to-end verification gate for v0.9.63 -- lint + extract-clean + locale-sync + build + hreflang + bundle budgets all green, locally and in CI."
requires:
  - "Phase 265 complete (all 5 target XLIFFs filled, i18nMissingTranslation=error)"
  - "Phase 264 complete (per-locale prerender + hreflang)"
  - "Phase 262 complete (messages.xlf at 420 trans-units)"
provides:
  - "Verified green CI run on feat/showcase-i18n branch"
  - "Locally-reproduced verification log captured in SUMMARY"
  - "Closure of BUILD-01 and VERIFY-01"
  - "Closure of Phase 265 deferred criterion (spot-review across all 5 locales)"
affects:
  - "Milestone v0.9.63 becomes mergeable"
requirements_addressed: [BUILD-01, VERIFY-01]
---

## Goal

Prove the milestone delivers what it promised. All six CI gates exit 0 locally first, then in CI:
1. `verify-locale-sync.mjs` (Angular vs Express locale registry parity)
2. `lint:i18n` (template marking)
3. `ng extract-i18n` diff vs committed `messages.xlf` (no drift)
4. `ng build` (emits 30 prerendered HTMLs = 5 routes x 6 locales)
5. `verify:hreflang` (hreflang + canonical + html lang on every prerendered HTML)
6. `verify-bundle-budgets.mjs` (per-locale gzipped bundle budget)

Plus: spot-review all 5 target XLIFFs for translation quality (closes Phase 265 deferred criterion).

## Scout Findings (locked, not gray)

- **CI workflow already wires the entire chain** (`.github/workflows/ci.yml:50-73`). No new CI job needed; no `extract-i18n-clean` npm script needed (CI inline-diffs at lines 64-67).
- **Scripts exist on disk** for `verify-locale-sync.mjs`, `verify-hreflang.mjs`, `verify-bundle-budgets.mjs`. Wired into CI but not all into `package.json` (only `lint:i18n` and `verify:hreflang` are npm-scripted).
- **`node_modules` stale** -- missing `@angular/localize`. Fresh `npm install` required before local verification.
- **Prerender routes** = 5 (`/`, `/about`, `/agents`, `/privacy`, `/support`) x 6 locales (`en` + 5 targets) = 30 HTMLs. Matches ROADMAP criterion 3.
- **Phase 265 SUMMARY** flags translation quality review as deferred -- D-04 below closes it.

## Locked Decisions

### D-01 -- Execution mode: local first, then CI
Run the full verification chain locally (after `npm install`) and capture results. Fix any failures inline before pushing. Then push and let CI confirm. Reason: catches drift before CI logs and gives a local verification log for SUMMARY.

### D-02 -- Failure handling: fix in-phase via gap-closure plans
Phase 266 owns the green-light deliverable. If any gate fails, create `266-02-PLAN.md`, `266-03-PLAN.md`, etc., scoped to closing that specific gap. Does NOT re-open prior phases. Keeps the milestone closeable in one phase.

### D-03 -- Plan shape: single sequential PLAN
`266-01-PLAN.md` with tasks executed sequentially because each gate can block the next:
1. `npm install` (or `npm ci`) in `showcase/angular/`
2. `node scripts/verify-locale-sync.mjs`
3. `npm run lint:i18n`
4. `ng extract-i18n --output-path /tmp/extract-check` + diff vs committed `messages.xlf`
5. `npm run build` (must emit 30 prerendered HTMLs; assert count)
6. `npm run verify:hreflang`
7. `node scripts/verify-bundle-budgets.mjs`
8. Spot-review all 5 target XLIFFs (per D-04)
9. Push to remote; capture CI run URL + green status
10. Write SUMMARY.md
Atomic commits per gate where source changes; verification-only steps commit collectively.

### D-04 -- Translation quality spot-review: all 5 locales, structured
Sample ~20 strings per locale across diverse namespaces (shell nav, home hero, about, agents, privacy, support) and verify:
- Brand tokens (`FSB`, `MCP`, `Claude`, `Codex`, `Cursor`) preserved verbatim in `<target>`
- Tone register matches CONTEXT D-03 from Phase 265 (es LATAM neutral, de formal Sie, ja です/ます, zh-CN mainland, zh-TW Taiwan vocab)
- No obviously machine-mangled CJK / no obviously wrong gender or pluralization in es/de
- Placeholder `<x id="..."/>` count matches source per trans-unit
Document findings per locale in SUMMARY. If issues found -> gap-closure plan; if clean -> close Phase 265 deferred criterion. Native-speaker review remains separately deferred (not blocking).

### D-05 -- Definition of "verified locally"
Each gate run shall be captured as a verbatim block in `266-01-SUMMARY.md` (exit code, stdout/stderr last 20 lines, wallclock). The push-to-CI step records the GitHub Actions run URL and final job conclusions.

### D-06 -- No new npm scripts in this phase
CI already invokes `node showcase/angular/scripts/verify-locale-sync.mjs` and `verify-bundle-budgets.mjs` directly. Adding `npm run` wrappers is a nice-to-have but out of scope -- deferred to housekeeping.

### D-07 -- Extract-i18n drift handling
The drift check uses `diff -u showcase/angular/src/locale/messages.xlf /tmp/extract-check/messages.xlf` (same as CI). If non-empty, the failure is a true regression in source XLIFF -- treat as a 262-class issue and fix via gap-closure plan (D-02).

### D-08 -- Build artifact assertion
After `ng build`, assert exactly 30 `index.html` files exist in `showcase/dist/showcase-angular/browser/` (and locale subdirs). Use:
```bash
find showcase/dist/showcase-angular/browser -name index.html | wc -l
```
Expected: 30. Mismatch -> investigate prerender config before declaring build pass.

### D-09 -- CI run capture
After local green, push branch and capture:
- GitHub Actions run URL
- Per-job conclusions (showcase job + any siblings)
- Total CI wallclock
Paste into SUMMARY as proof of CI confirmation.

### D-10 -- Out of scope
- Performance regression testing (deferred)
- Native-speaker translation review (deferred, separate workstream)
- New CI jobs / new npm scripts (D-06)
- TM database for re-extraction (deferred to next i18n milestone)
- Visual / Lighthouse review (deferred)

## Non-Goals
- No new tooling.
- No translation re-write (D-04 is review, not rewrite -- rewrites kick to gap-closure if needed).
- No CI workflow edits unless a gate is missing (scout confirms none are).

## Threat Model
- **T-266-01 -- Local env divergent from CI:** Different Node version or stale lockfile could pass locally + fail CI. Mitigation: `npm install` uses committed `package-lock.json`; final word is CI green (D-09).
- **T-266-02 -- Extract-i18n drift after 265 work:** Phase 265 should not have touched source XLIFF; if it did, drift surfaces here. Mitigation: D-07 routes to gap-closure.
- **T-266-03 -- Bundle budget breached by localize runtime:** Five extra locale bundles could push gzipped budget. Mitigation: budget script runs; if breached, gap-closure plan tunes the budget threshold or investigates split-points.
- **T-266-04 -- Translation review surfaces real issues:** Could cascade into translation rewrite work. Mitigation: scope review to red-flag patterns only (brand drift, placeholder loss, register break) -- not literary review.
- **T-266-05 -- Prerender count mismatch:** Build might emit fewer/more than 30 HTMLs if a route was dropped or prerender config drifted. Mitigation: D-08 asserts count.

## Acceptance (mirrors ROADMAP success criteria)
1. `npm run lint:i18n` exits 0.
2. `ng extract-i18n` produces a `messages.xlf` byte-equal to the committed one.
3. `ng build` emits exactly 30 prerendered `index.html` files.
4. Every prerendered HTML passes `verify:hreflang` (hreflang + canonical + html lang).
5. `verify-bundle-budgets.mjs` exits 0.
6. CI website job runs all 6 steps green on the pushed branch.
7. Spot-review of all 5 locales documented in SUMMARY; no blocking issues OR follow-on plan committed for any found.

## Next Step
`/gsd-plan-phase 266` -> single PLAN with the 10-task sequence in D-03.
