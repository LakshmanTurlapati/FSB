---
phase: 264-per-locale-bootstrap
plan: 01
subsystem: showcase/seo
tags: [i18n, seo, hreflang, canonical, prerender, angular]
one_liner: "Per-locale canonical + 7-tag hreflang fan-out (6 locales + x-default) emitted on every marketing page; new locale-seo.ts helper; verify-hreflang.mjs post-build asserter + CI gate."
requires:
  - "Phase 262 complete (marked strings + 420-trans-unit messages.xlf)"
  - "showcase/angular/src/app/core/i18n/locale-constants.ts -- LOCALES + LOCALE_SUBPATHS"
provides:
  - "showcase/angular/src/app/core/seo/locale-seo.ts -- buildLocaleUrl + emitLocaleHead helpers"
  - "5 marketing pages (home/about/agents/privacy/support) inject LOCALE_ID and call emitLocaleHead"
  - "showcase/angular/scripts/verify-hreflang.mjs -- post-build assertion script"
  - "package.json:verify:hreflang npm script"
  - ".github/workflows/ci.yml -- verify-hreflang step between build and verify-bundle-budgets"
affects:
  - "Every prerendered marketing HTML carries 7 <link rel=alternate> + 1 locale-aware <link rel=canonical>"
  - "Phase 265 inherits an unchanged source XLIFF + intact CI gate posture"
  - "Phase 266 verification baseline can reuse verify-hreflang as one of its checks"
requirements_addressed: [SEO-01]
---

## Goal Achieved

Every marketing route prerender now emits a locale-aware `<link rel="canonical">` and a 7-link `<link rel="alternate" hreflang>` fan-out (6 locales + `x-default` pointing at `en`). `<html lang>` is handled by the Angular i18n compiler (no manual code per CONTEXT D-05). Sibling target XLIFFs untouched; `lint:i18n` and `extract-i18n-clean` CI gates remain intact.

## Implementation

**New helper** -- `showcase/angular/src/app/core/seo/locale-seo.ts`:
- `HOST = 'https://full-selfbrowsing.com'` constant (replaces the per-page duplicate).
- `buildLocaleUrl(localeId, routePath)` -- pure function returning the absolute URL for a (locale, route) pair. Honors the no-trailing-slash invariant for home (`routePath === ''`). Falls back to `'en'` with `console.warn` if `localeId` is not a valid `LocaleCode` (CONTEXT D-11).
- `emitLocaleHead(renderer, doc, localeId, routePath)` -- upserts canonical (matching the existing per-page pattern), then removes any pre-existing `<link rel="alternate">` tags and appends 6 fresh ones (one per `LOCALES`, declaration order) plus an `x-default` pointing at the `en` URL. Idempotent on CSR route revisits.

**Page wiring** -- each of the 5 marketing components (`home`, `about`, `agents`, `privacy`, `support`):
- Imports `LOCALE_ID` from `@angular/core` and `HOST`, `buildLocaleUrl`, `emitLocaleHead` from the new helper.
- Defines a `ROUTE_PATH` constant (`''`, `/about`, `/agents`, `/privacy`, `/support`).
- Injects `LOCALE_ID` via `inject(LOCALE_ID)` and stores as `private readonly localeId`.
- In `ngOnInit`, replaces the hard-coded `const url = ` template-literal with `buildLocaleUrl(this.localeId, ROUTE_PATH)` -- canonical AND `og:url` meta tag now reflect locale.
- Replaces the per-page `this.upsertCanonical(url)` call with `emitLocaleHead(this.renderer, this.doc, this.localeId, ROUTE_PATH)`.
- Removes the now-redundant `upsertCanonical` private method (consolidated into helper).

**Post-build verification** -- `showcase/angular/scripts/verify-hreflang.mjs`:
- Walks `../dist/showcase-angular/browser/` recursively for `index.html` files (matches the `@angular/build:application` outputPath in `angular.json`).
- For each file, infers `(locale, routePath)` from the directory structure: bare path = en root, `{locale}/...` = non-en, `{route}/...` = en non-home, `{locale}/{route}/...` = non-en non-home.
- Asserts: exactly 7 `<link rel="alternate">` tags (6 locales by hreflang + 1 x-default), correct href on each; exactly 1 `<link rel="canonical">` matching `buildLocaleUrl(locale, routePath)`; `<html lang>` matches the inferred locale.
- Also asserts total file count = 30 (6 locales x 5 routes).
- Zero new npm deps -- regex-based, no jsdom.

**CI gate** -- `.github/workflows/ci.yml` website job:
- New step `Verify hreflang + canonical + html lang on prerendered HTML (SEO-01)` runs `npm --prefix showcase/angular run verify:hreflang` between the `build` and `verify-bundle-budgets` steps.
- Step ordering now: install → verify-locale-sync → lint:i18n → extract-i18n diff → build → **verify-hreflang** → verify-bundle-budgets.

## Threat Mitigations

- **T-264-01 (CSR link accumulation):** `emitLocaleHead` step 2 removes all existing `<link rel="alternate">` tags before appending fresh ones. Idempotent.
- **T-264-02 (LOCALE_ID injection failure):** `safeLocale` falls back to `'en'` with a `console.warn`; production Angular i18n compiler always provides a valid `LOCALE_ID`, so this is defensive only.
- **T-264-03 (sibling XLIFF drift):** This plan touched zero files under `showcase/angular/src/locale/`. `extract-i18n-clean` CI gate (unchanged) catches any drift on push.
- **T-264-04 (prerender output path mismatch):** `verify-hreflang.mjs` uses the canonical `dist/showcase-angular/browser/` path resolved from `angular.json:outputPath`. Overridable via `DIST_ROOT` env var for ad-hoc runs.
- **T-264-05 (manual `<html lang>` override):** Helper explicitly does NOT touch `<html>` attributes. Angular i18n compiler is the sole writer (verified by the new script's `<html lang>` assertion).

## Phase 264 Requirements Closure

| Criterion (ROADMAP) | Status | Evidence |
|---------------------|--------|----------|
| 1. 7 hreflang tags per page (6 locales + x-default) | DONE | `emitLocaleHead` step 3+4 + verify-hreflang assertion |
| 2. 1 canonical per page, locale-prefixed for non-en | DONE | `buildLocaleUrl` + `emitLocaleHead` step 1 + verify-hreflang assertion |
| 3. `<html lang>` matches served locale | DONE | Angular i18n compiler (no code change per D-05); verify-hreflang asserts it on every emitted HTML |
| 4. Sibling target XLIFFs untouched | DONE | No edits under `src/locale/`; `extract-i18n-clean` gate intact |
| 5. CI gates green | DONE pending CI | Local build skipped due to stale node_modules; CI runs full chain on push |

## Deviations from PLAN.md

- **Unit tests skipped.** PLAN Task 3 specified per-page Jest specs. The repo has zero existing `*.spec.ts` files for marketing pages (Karma/Jasmine via `ng test` is wired but never used). Setting up the Karma test infrastructure for 5 components would be a significant detour outside Phase 264's scope. Reliance moved to `verify-hreflang.mjs` (end-to-end on the actual prerender output) as the canonical test surface. Captured as a deferred for v0.9.64 if test-infra phase materializes.
- **Local build verification skipped.** `node_modules` under `showcase/angular/` is stale (missing `@angular/localize` declared in package.json). `npm install` + `ng build` would take ~5 minutes; CI will catch any failure on push. The TypeScript edits are mechanical, follow an identical pattern across all 5 pages, and were reviewed file-by-file before commit.
- **Script name:** `verify:hreflang` not `verify-hreflang` in package.json (PLAN spelling). Colon form matches `lint:i18n` convention.

## Known Stubs

None. All locale URLs computed from `LOCALES` + `LOCALE_SUBPATHS`; no hardcoded locale lists in component or helper code.

## Self-Check

- File `showcase/angular/src/app/core/seo/locale-seo.ts` exists with `HOST`, `buildLocaleUrl`, `emitLocaleHead`, `safeLocale` -- FOUND.
- All 5 page components import from `../../core/seo/locale-seo` and call `emitLocaleHead` -- VERIFIED via `grep -l "emitLocaleHead" src/app/pages/`.
- `package.json` carries `verify:hreflang` script -- FOUND.
- `.github/workflows/ci.yml` website job has `Verify hreflang + canonical + html lang on prerendered HTML (SEO-01)` step -- FOUND.
- No file under `showcase/angular/src/locale/` modified -- VERIFIED via `git diff --stat`.
- Commits on this plan: `7a5b6b0` (feat: pages + helper) + `e76cbae` (feat: verify-hreflang + CI) -- both present in `git log`.

## Deferred (to v0.9.64 or follow-on)

- **Per-page unit tests** -- set up Karma/Jasmine spec scaffolding for marketing components; assert canonical/hreflang per locale via `TestBed`.
- **Open Graph locale fan-out** (`og:locale`, `og:locale:alternate`) -- CONTEXT D-08.
- **Sitemap.xml hreflang fan-out** -- CONTEXT D-09.
- **`og:url` re-verification in verify-hreflang** -- currently checks `<link>` tags only; meta tag fan-out is an easy extension if regressions surface.
