---
phase: 266-verification-baseline
plan: 01
subsystem: showcase/i18n
tags: [i18n, ci, verification, milestone-gate]
one_liner: "Milestone v0.9.63 verification baseline -- all 6 CI gates green locally and in CI (run 25780751313); milestone is mergeable."
requires:
  - "Phase 265 complete"
  - "Phase 264 complete"
  - "Phase 262 complete"
provides:
  - "Verified green CI run on feat/showcase-i18n (25780751313)"
  - "Closure of BUILD-01 + VERIFY-01"
  - "Closure of Phase 265 deferred translation-quality criterion"
  - "Two gap-closure plans landed (266-02: messages.xlf line-number refresh; 266-03: test regex tolerates i18n attrs)"
affects:
  - "Milestone v0.9.63 ready for merge to main"
requirements_addressed: [BUILD-01, VERIFY-01]
---

## Goal Achieved

All 6 verification gates exit 0 locally AND in CI. Milestone v0.9.63 (Showcase i18n) is mergeable.

| Gate | Local | CI |
|------|-------|----|
| verify-locale-sync.mjs | exit 0 | success |
| lint:i18n | exit 0 | success |
| extract-i18n diff vs committed | empty diff | success |
| ng build (30 prerendered HTMLs) | 30 emitted | success |
| verify:hreflang | 301 pass / 0 fail | success |
| verify-bundle-budgets.mjs | all locales within budget | success |

**CI run:** https://github.com/LakshmanTurlapati/FSB/actions/runs/25780751313 — status `completed`, conclusion `success`. Jobs: showcase ✓, mcp ✓, extension ✓, all-green ✓.

## Implementation

10 sequential tasks per `266-01-PLAN.md` executed end-to-end. Two gap-closure plans spawned mid-execution per CONTEXT D-02.

### Task 1 -- npm install
`cd showcase/angular && npm install --no-audit --no-fund` -> `added 116 packages in 1s`. `package-lock.json` unchanged. `@angular/localize` present in node_modules.

### Task 2 -- verify-locale-sync
```
Locale registry parity verified: ["en","es","de","ja","zh-CN","zh-TW"]
EXIT=0
```

### Task 3 -- lint:i18n
```
> showcase-angular@0.9.62 lint:i18n
> eslint "src/**/*.html" --ignore-pattern "src/app/pages/dashboard/**"
EXIT=0
```
(Zero errors.)

### Task 4 -- extract-i18n diff vs committed
First run: drift detected. Investigation showed only `<context-type="linenumber">` values shifted by 2-3 lines on six TS-side trans-units (about/agents/home/privacy/support page meta titles + descriptions). Root cause: Phase 264 commit `7a5b6b0` added a few lines to `*-page.component.ts` files after Phase 262 captured the original line numbers. Trans-unit count, IDs, and source content all unchanged.

**Gap closure:** `266-02-PLAN.md` -- refresh committed `messages.xlf` from fresh extract. Commit `3929e9d`. Re-ran diff -> empty.

### Task 5 -- ng build
`npm run build` -> exit 0, wallclock ~13s. Build output:
```
Prerendered 30 static routes.
Application bundle generation complete. [12.510 seconds]
```
`find showcase/dist/showcase-angular/browser -name index.html | wc -l` -> **30** ✓. Layout:
- `en` root: 5 HTMLs (`/`, `/about`, `/agents`, `/privacy`, `/support`)
- `es`, `de`, `ja`, `zh-CN`, `zh-TW`: 5 HTMLs each (locale subpaths)
- Total: 6 locales × 5 routes = 30 (CONTEXT D-08 assertion satisfied).

### Task 6 -- verify:hreflang
```
Summary: 301 pass, 0 fail
EXIT=0
```
Every prerendered HTML carries 7 alternates (en + 5 targets + x-default), correct canonical, correct `<html lang>`.

### Task 7 -- verify-bundle-budgets
```
  (source/en)  main-4EBIO34T.js  raw=17643 gz=5162  OK
  es           main-4EBIO34T.js  raw=17679 gz=5194  OK
  de           main-4EBIO34T.js  raw=17684 gz=5184  OK
  ja           main-4EBIO34T.js  raw=18239 gz=5270  OK
  zh-CN        main-4EBIO34T.js  raw=17861 gz=5239  OK
  zh-TW        main-4EBIO34T.js  raw=17861 gz=5242  OK
All locales within gzipped budget.
EXIT=0
```

### Task 8 -- Spot-review all 5 target XLIFFs

**Structural integrity (all 5 locales):**
| Locale | trans-units | translated | source `<x>` | target `<x>` | FSB | MCP | Claude | Codex | OpenClaw |
|--------|------------|------------|--------------|--------------|-----|-----|--------|-------|----------|
| es | 420 | 420 | 154 | 154 | 16 | 7 | 7 | 5 | 9 |
| de | 420 | 420 | 154 | 154 | 16 | 7 | 7 | 5 | 9 |
| ja | 420 | 420 | 154 | 154 | 16 | 7 | 7 | 5 | 9 |
| zh-CN | 420 | 420 | 154 | 154 | 16 | 7 | 7 | 5 | 9 |
| zh-TW | 420 | 420 | 154 | 154 | 16 | 7 | 7 | 5 | 9 |

Brand-token counts identical across all 5 locales -> tokens preserved verbatim. Placeholder count parity confirmed (154/154 every locale).

**Register sanity (red-flag pattern grep):**
| Check | Result |
|-------|--------|
| es: peninsular `vosotros`/`vuestr` | 0 ✓ (LATAM neutral confirmed) |
| de: formal `Sie`/`Ihr` occurrences | 45 ✓ |
| de: informal `du`/`dein` occurrences | 0 ✓ |
| ja: polite `です`/`ます` endings | 110 ✓ |
| zh-TW: Taiwan vocab (`軟體`/`網路`/`伺服器`) | 25 ✓ |
| zh-TW: mainland leakage (`軟件`/`服务器`/`软件`/`网络`/`网站`) | 0 ✓ |
| zh-CN: simplified usage (`软件`/`网络`/`服务器`) | 25 ✓ |
| zh-CN: traditional leakage (`軟體`/`網路`/`伺服器`) | 0 ✓ |

**Sample translation pairs (3 IDs spanning home + about action API):**
- `home.hero.title` (Full <x...>): es "Navegación", ja "フル", zh-CN "完全", zh-TW "完全", de "Full" (intentional brand retention -- "Full Self-Browsing" treated as brand phrase in de per CONTEXT D-03)
- `about.actions.tag.navigate`: all 5 locales "navigate" verbatim ✓ (DO-NOT-TRANSLATE action API)

**Findings:** No blocking issues. The de `home.hero.title` brand-retention pattern is consistent with the CONTEXT-D-03 register policy (de hero headline keeps brand "Full Self-Browsing" since translating "Full" alone reads awkwardly without the whole brand phrase). Phase 265 deferred criterion 5 (spot-review) **closed** with no remediation required.

### Task 9 -- Push + capture CI

First push (commit `3929e9d`): CI run **25780666786** -- showcase ✓, mcp ✓, extension ✘. Extension failure was `[SYNC-05] about-page architecture names Sync` -- a true regression caused by Phase 262's i18n attribute marking (`<h4 i18n="@@about.arch.box.sync.title">Sync</h4>` no longer matches literal `<h4>Sync</h4>` regex in `tests/remote-control-rebrand.test.js`).

**Gap closure:** `266-03-PLAN.md` -- update 3 test regexes to `<h4[^>]*>` form (and same for `<p>`) so they tolerate i18n attributes. Test re-ran locally -> 24 pass, 0 fail. Commit `01e13aa`. Pushed.

Second push (commit `01e13aa`): CI run **25780751313** -- **all 4 jobs success**.

### Task 10 -- this SUMMARY

## Phase 266 Requirements Closure

| Criterion (ROADMAP) | Status | Evidence |
|---------------------|--------|----------|
| 1. `npm run lint:i18n` exits 0 | DONE | Task 3 + CI |
| 2. `ng extract-i18n` byte-equal to committed | DONE | Task 4 + 266-02 fix + CI |
| 3. `ng build` emits 30 prerendered HTMLs | DONE | Task 5 ("Prerendered 30 static routes" + `find ... \| wc -l` = 30) |
| 4. hreflang + canonical + html lang green | DONE | Task 6 (301 pass / 0 fail) + CI |
| 5. zero `state="new"` or empty `<target>` | DONE | Task 8 structural table (420/420 translated per locale) |
| 6. CI website job all 6 steps green | DONE | Run 25780751313, all 4 jobs success |
| Phase 265 criterion 5 (spot-review) | DONE | Task 8 |

**Requirements satisfied:** BUILD-01, VERIFY-01.

## Threat Mitigations

- **T-266-01 (local/CI env divergence):** None encountered. `npm install` produced identical lockfile state; CI used same script invocations.
- **T-266-02 (extract-i18n drift after 265):** Materialized as expected -- linenumber drift only, no semantic change. Closed via `266-02-PLAN.md`.
- **T-266-03 (bundle budget breach):** None. All 6 locale main bundles within gzipped budget.
- **T-266-04 (translation review finds issues):** None blocking. Brand-token preservation, placeholder parity, and register sanity all green. De brand-retention on hero headline noted as intentional policy.
- **T-266-05 (prerender count mismatch):** None. Build emitted exactly 30 HTMLs, asserted via `find`.

## Deviations from PLAN.md

- **Two gap-closure plans spawned mid-execute** (per CONTEXT D-02): `266-02` (messages.xlf linenumber refresh) and `266-03` (test regex tolerates i18n attrs). Both fixes mechanical, no scope expansion.
- **Task 9 required two push iterations:** first push exposed an extension-test regression that local verification did not catch (the extension test suite isn't part of the showcase build chain run locally). Closed in second push.

## Known Stubs

None.

## Self-Check

- All 10 PLAN tasks marked complete -- VERIFIED.
- 5 commits on the phase: 266 CONTEXT, 266-01 PLAN, 266-02 plan+fix, 266-03 plan+fix, this SUMMARY (pending) -- VERIFIED.
- Final CI run on `feat/showcase-i18n` (25780751313) all jobs success -- VERIFIED.
- Milestone v0.9.63 success criteria all satisfied -- VERIFIED via this table.
- No target XLIFF touched in this phase (`git diff --stat` of messages.{es,de,ja,zh-CN,zh-TW}.xlf empty) -- VERIFIED.

## Deferred (to v0.9.64 or follow-on)

- **Native-speaker review** of all 5 locales -- AI translations not professionally reviewed. Same risk profile carried from Phase 265 SUMMARY.
- **Translation memory (TM) database** -- next i18n milestone.
- **Performance / Lighthouse / visual regression** -- separate workstream.
- **zh-TW hand-tuning pass** -- carried from Phase 265.
- **Sibling XLIFF lint as CI gate** -- low-priority hardening (current `i18nMissingTranslation=error` catches the same failure mode at build time).

## Next Step

`/gsd-audit-milestone v0.9.63` -> `/gsd-complete-milestone v0.9.63` -> `/gsd-cleanup`.
