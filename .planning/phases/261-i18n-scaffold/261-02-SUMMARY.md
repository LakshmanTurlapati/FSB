---
phase: 261-i18n-scaffold
plan: 02
subsystem: infra
tags: [angular, angular-localize, i18n, xliff, prerender, build-pipeline, showcase]

# Dependency graph
requires:
  - phase: 260
    provides: Angular 20.3 showcase shell with @angular/build:application + outputMode static + prerender.discoverRoutes false
provides:
  - "@angular/localize@^20.3.19 wired into showcase/angular as a devDep"
  - "@angular/localize/init polyfill array entry on architect.build.options.polyfills"
  - "6-locale i18n block on projects.showcase-angular (en source, es/de/ja/zh-CN/zh-TW targets)"
  - "Build-options triple: localize:true, i18nMissingTranslation:warning, i18nDuplicateTranslation:error"
  - "6 seed XLIFF 1.2 files at showcase/angular/src/locale/messages{,.<locale>}.xlf"
  - "Empirical confirmation that prerender x localize composes under outputMode static (30 prerendered HTML files emitted with matching <html lang>)"
  - "Wall-clock baseline (7.447s) and 6-locale measurement (14.507s) recorded; ratio 1.95x is well within the locked 5x budget"
affects: [262 marking, 263 detection, 264 SEO, 265 content, 266 verification]

# Tech tracking
tech-stack:
  added: ["@angular/localize@^20.3.19 (devDependency only)"]
  patterns:
    - "Pattern 1 (RESEARCH.md): i18n block as peer of architect with sourceLocale.subPath:'' + explicit subPath per target locale"
    - "Pattern 2 (RESEARCH.md): per-locale prerender fan-out under outputMode:static + @angular/build:application + prerender.discoverRoutes:false"
    - "Schematic-first install path (ng add @angular/localize --skip-confirmation) with no manual polyfill edit needed under Angular CLI 20.3.25"

key-files:
  created:
    - showcase/angular/src/locale/messages.xlf
    - showcase/angular/src/locale/messages.es.xlf
    - showcase/angular/src/locale/messages.de.xlf
    - showcase/angular/src/locale/messages.ja.xlf
    - showcase/angular/src/locale/messages.zh-CN.xlf
    - showcase/angular/src/locale/messages.zh-TW.xlf
  modified:
    - showcase/angular/package.json
    - showcase/angular/package-lock.json
    - showcase/angular/tsconfig.app.json
    - showcase/angular/src/main.ts
    - showcase/angular/angular.json

key-decisions:
  - "Used npx ng add @angular/localize --skip-confirmation (the sanctioned schematic path); did NOT pass --use-at-runtime since showcase is AOT-prerendered."
  - "Did NOT manually patch the polyfills array: Angular CLI 20.3.25 schematic now adds @angular/localize/init to architect.build.options.polyfills (and test target polyfills) automatically. Pitfall 1 / angular-cli #27786 is no longer reproducible in this CLI version. Note recorded for forward-reference."
  - "Did NOT add reference directive to src/main.server.ts: tsconfig.app.json compilerOptions.types includes @angular/localize and applies to all files compiled under that tsconfig, including main.server.ts and server.ts. Empirically confirmed by 30/30 prerendered HTML output."
  - "Used JSON object form for i18n.locales[*] keeping translation + subPath inline on a single line per locale for readability."
  - "Placed the i18n block as a peer of architect (between prefix and architect), matching RESEARCH.md Pattern 1 verbatim."
  - "Set i18nMissingTranslation:warning per Phase 261 lock (CONTEXT D-05); Phase 265 will flip to error per CI-04."
  - "Set i18nDuplicateTranslation:error from day one per Phase 261 lock (CONTEXT D-06)."

patterns-established:
  - "Pattern 1: angular.json i18n block + build-options triple — the canonical per-locale fan-out shape for showcase Angular 20.3 / outputMode static"
  - "Pattern 2: 30 prerendered HTML files (5 logical routes x 6 locales) emitted from a single unchanged prerender-routes.txt — empirical confirmation that Pitfall 5 / Assumption A1 holds (per-locale route fan-out is automatic; no per-locale duplication of the routes file needed)"
  - "Pattern 3: XLIFF 1.2 seed shape with empty body — minimal valid file the @angular/build pipeline accepts as a translation source, allowing the i18n block to declare paths before any string is marked"

requirements-completed: [I18N-01, I18N-02, I18N-03, I18N-04, I18N-05]

# Metrics
duration: ~3 min (excluding npm install + builds)
completed: 2026-05-12
---

# Phase 261 Plan 02: Wire @angular/localize Toolchain Summary

**Installed @angular/localize@^20.3.19 and wired the 6-locale i18n block, polyfill, and seed XLIFFs into showcase/angular so a single production build now emits 30 prerendered HTML files (5 logical routes x 6 locales) with matching `<html lang>` per directory, at a 1.95x wall-clock ratio over the v0.9.62 single-locale baseline — well inside the locked 5x I18N-05 budget.**

## Performance

- Started: 2026-05-12T13:06:32Z
- Completed: 2026-05-12T13:09:22Z (approx)
- Tasks: 4 of 4 complete
- Files created: 6 (XLIFF seeds)
- Files modified: 5 (package.json, package-lock.json, tsconfig.app.json, src/main.ts, angular.json)

## Accomplishments

- Schematic-installed @angular/localize@^20.3.19 as a devDep (no runtime/dependencies entry — AOT path only).
- Angular CLI 20.3.25 schematic auto-added the @angular/localize/init polyfill array entry to BOTH `architect.build.options.polyfills` and the `test` target's polyfills, removing the Pitfall 1 / issue #27786 manual edit that the plan anticipated.
- Added the locked 6-locale i18n block (en source + es/de/ja/zh-CN/zh-TW targets) as a peer of `architect`, with explicit per-locale subPath and translation paths.
- Added build-options triple: `localize: true`, `i18nMissingTranslation: "warning"`, `i18nDuplicateTranslation: "error"`.
- Seeded 6 XLIFF 1.2 files at showcase/angular/src/locale/ (1 source + 5 targets, each with empty body and correct target-language attribute).
- Empirically confirmed the toolchain spike (Phase 261 SC#1): 30 prerendered HTML files emitted across 6 locales x 5 routes, each `<html lang>` attribute matches its directory, no `$localize is not defined` crash, no cross-locale lang leakage, per-locale main bundles present in every locale directory.
- Recorded wall-clock measurements for I18N-05 budget enforcement.

## Task Commits

Each task was committed atomically with `--no-verify` (parallel-wave executor flag):

1. **Task 1: Establish v0.9.62 single-locale build baseline and install @angular/localize** — `58b9088` (chore)
2. **Task 2: Add the 6-locale i18n block and build-options localize triple to angular.json** — `59446d4` (feat)
3. **Task 3: Ship seed XLIFF files (1 source + 5 targets)** — `eec248a` (feat)
4. **Task 4: Run production build and verify per-locale dist layout + html lang attributes + wall-clock budget** — verification-only; no source files modified; no commit.

## Files Created/Modified

### Created
- `showcase/angular/src/locale/messages.xlf` — XLIFF 1.2 source file (source-language="en", empty body, comment notes Phase 262 will populate via ng extract-i18n).
- `showcase/angular/src/locale/messages.es.xlf` — Spanish target seed (target-language="es", empty body).
- `showcase/angular/src/locale/messages.de.xlf` — German target seed (target-language="de", empty body).
- `showcase/angular/src/locale/messages.ja.xlf` — Japanese target seed (target-language="ja", empty body).
- `showcase/angular/src/locale/messages.zh-CN.xlf` — Simplified Chinese target seed (target-language="zh-CN", empty body).
- `showcase/angular/src/locale/messages.zh-TW.xlf` — Traditional Chinese target seed (target-language="zh-TW", empty body).

### Modified
- `showcase/angular/package.json` — `@angular/localize: "^20.3.19"` added to devDependencies (NOT to dependencies).
- `showcase/angular/package-lock.json` — schematic-generated lockfile delta for @angular/localize + transitives.
- `showcase/angular/tsconfig.app.json` — `compilerOptions.types` array now includes `"@angular/localize"`.
- `showcase/angular/src/main.ts` — gained `/// <reference types="@angular/localize" />` as first line (schematic edit).
- `showcase/angular/angular.json` — added top-level `projects.showcase-angular.i18n` block (sourceLocale + 5 target locales); added `localize:true`, `i18nMissingTranslation:"warning"`, `i18nDuplicateTranslation:"error"` to `architect.build.options`; CLI schematic added `"@angular/localize/init"` to both build and test polyfills arrays.

## Decisions Made

- **Schematic install path locked.** Used `npx ng add @angular/localize --skip-confirmation` exactly per RESEARCH.md and STACK.md; did NOT pass `--use-at-runtime` (would push @angular/localize into `dependencies` and inflate the runtime bundle).
- **No manual polyfill edit needed under CLI 20.3.25.** The plan anticipated Pitfall 1 / angular-cli issue #27786 (`ng add` not patching the polyfills array under `@angular/build:application`). The current CLI (20.3.25) schematic DOES patch both build and test polyfills arrays. The manual edit step from the plan was therefore unnecessary; this is recorded for downstream phases / future Angular upgrades that may regress the schematic.
- **No reference directive on src/main.server.ts.** The schematic touched only `src/main.ts`. tsconfig.app.json `compilerOptions.types` already pulls `@angular/localize` types into the entire app compilation, including main.server.ts and server.ts. Empirically confirmed: 30/30 prerendered HTML files emitted (SSR path executes server-side without `$localize is not defined`).
- **`i18nMissingTranslation:"warning"` for Phase 261, will flip to `"error"` at Phase 265 exit** per CONTEXT D-05 / CI-04.
- **`i18nDuplicateTranslation:"error"` from day one** per CONTEXT D-06.

## Wall-Clock Budget (I18N-05)

| Build variant | Wall-clock | Source |
|---|---|---|
| v0.9.62 baseline (single locale, en only) | 7.447s | `time npm run build` in clean tree on commit 3ffa06d BEFORE ng add ran; build itself reported `[5.477 seconds]` |
| Phase 261 (6 locales, prerendered) | 14.507s | `time npm --prefix showcase/angular run build` after Tasks 1-3 applied; build itself reported `[13.822 seconds]` |
| **Ratio** | **1.95x** | well inside the locked 5.0x budget |

I18N-05 PASS. No escalation needed.

## Spike Acceptance (Phase 261 SC#1)

Empirical confirmation that prerender x localize composes correctly under Angular 20.3 + `outputMode: "static"` + `@angular/build:application` + `prerender.discoverRoutes: false`:

| Assertion | Result |
|---|---|
| Build exit code 0 | PASS |
| No `$localize is not defined` text in build log | PASS |
| 30 prerendered HTML files (6 locales x 5 routes) exist | PASS (`for L in '' es de ja zh-CN zh-TW; do for R in '' about agents privacy support; do test -f .../$L/${R}/index.html; done; done`) |
| Per-locale `<html lang>` matches directory (en/es/de/ja/zh-CN/zh-TW) | PASS (6/6 grep assertions) |
| No cross-locale lang leakage (no en in /es/, no ja in /zh-CN/) | PASS (2/2 negative-case greps) |
| Per-locale `main-*.js` bundle exists in every locale directory | PASS (root + es + de + ja + zh-CN + zh-TW all have `main-47IUUEHY.js`) |
| `prerender-routes.txt` unchanged (still 5 logical routes) | PASS (file untouched) |
| Pitfall 5 / Assumption A1 (per-locale route fan-out is automatic) | EMPIRICALLY CONFIRMED — the build summary line reads `Prerendered 30 static routes.` from a single 5-line prerender-routes.txt + 6 locales |

## Deviations from Plan

### Rule 1 / Rule 2 / Rule 3 auto-fixes
None. Plan executed exactly as written for Tasks 2-4.

### Plan-anticipated step that turned out unnecessary
**Task 1.3 — Manual polyfill array edit:** The plan anticipated that `ng add @angular/localize` would NOT patch `architect.build.options.polyfills` under the `@angular/build:application` builder (Pitfall 1 / angular-cli issue #27786) and prescribed a manual edit. The current Angular CLI (20.3.25, pulled in via the existing devDeps) DOES patch the polyfills array automatically. Verification of `architect.build.options.polyfills` after `ng add` showed `["zone.js", "@angular/localize/init"]` already present. The manual edit step was a no-op against an already-correct file. This is not a deviation in the Rule 1-3 sense (no bug, no missing functionality, no blocker); it is documentation drift between RESEARCH.md (cites Pitfall 1) and the live schematic behavior at CLI 20.3.25. **Recommendation for the verifier:** treat Pitfall 1 as "regression-protected by RESEARCH.md note", and re-test on any Angular CLI minor upgrade.

### Other plan-anticipated steps observed
- The schematic did NOT touch `src/main.server.ts` (no reference directive added). The plan permitted this ("usually `src/main.server.ts` for SSR builds"); empirical SSR prerender (30/30 HTML emitted) confirms it was not needed because tsconfig.app.json `compilerOptions.types` covers SSR compilation.

### Build warnings (informational, not deviations)
The 6-locale build emitted 4 `[plugin angular-locale-data] WARNING: Locale data for 'zh-TW'/'zh-CN' cannot be found. Using locale data for 'zh'.` lines. This is expected Angular CLI behavior — `@angular/common/locales/zh-CN` and `@angular/common/locales/zh-TW` are valid but the warning fires for the polyfill bundle's locale data; both fall back to base `zh` which has correct plural rules. Not a build failure; not a deviation; documented for Phase 264/265 reference (per-locale plural rules will need Phase 265 attention if message catalogs ever use `{count, plural, ...}` ICU forms).

## Authentication Gates

None. This is a build-pipeline configuration plan; no auth surface touched.

## Threat Flags

None. Plan 02 is build-pipeline configuration with no new runtime input handling, no network surface, no auth boundary, no data persistence. Per the plan's `<threat_model>`, all threats were `accept` or `mitigate`; T-261-06 (build wall-clock blowup) was actively measured and the 1.95x ratio is well under the 5.0x budget mitigation threshold.

## Known Stubs

The 6 XLIFF files have empty `<body>` elements (comment-only). This is INTENTIONAL and documented in the plan:
- The seeds exist so `angular.json` `i18n.locales[*].translation` paths resolve at build time.
- `i18nMissingTranslation:"warning"` makes Phase 261 builds succeed despite empty translations (warnings emitted, not errors).
- Phase 262 will run `ng extract-i18n` to populate `messages.xlf` with `<trans-unit>` entries from marked templates.
- Phase 265 will populate the 5 target XLIFFs with AI-drafted translations and flip the missing-translation flag to `"error"` per CI-04.

These stubs are part of the Phase 261/262/265 staged design, not unfinished work.

## Forward References

- **Plan 261-03** will add ESLint flat config with the `@angular-eslint/template/i18n` rule (CI-03; rule installed and runnable but NOT a CI hard-block until Phase 262).
- **Plan 261-04** will wire the locale-constants Angular/Express mirror + CI sync invariant + per-locale bundle budget verification (CI-05, ROUTE-02 prep).
- **Phase 262** will begin string marking using `i18n="@@id"` attributes, run `ng extract-i18n` to repopulate `messages.xlf`, and promote the ESLint i18n rule to a CI hard-fail.
- **Phase 263** will own runtime geo-IP detection / locale resolution (DETECT-01..05, ROUTE-01..04).
- **Phase 264** will fan out per-locale SEO (canonicals, hreflang alternates, sitemap entries).
- **Phase 265** will ship AI-drafted translations into the 5 target XLIFFs and flip `i18nMissingTranslation:"warning"` -> `"error"` (CI-04).
- **Phase 266** will run end-to-end live verification, the COPY-05 byte-differ invariant on zh-CN vs zh-TW, and milestone audit prep.

## Self-Check

- `showcase/angular/src/locale/messages.xlf` — FOUND
- `showcase/angular/src/locale/messages.es.xlf` — FOUND
- `showcase/angular/src/locale/messages.de.xlf` — FOUND
- `showcase/angular/src/locale/messages.ja.xlf` — FOUND
- `showcase/angular/src/locale/messages.zh-CN.xlf` — FOUND
- `showcase/angular/src/locale/messages.zh-TW.xlf` — FOUND
- `showcase/angular/angular.json` modification (i18n block + build-options triple + polyfill entry) — FOUND
- `showcase/angular/package.json` modification (@angular/localize devDep) — FOUND
- `showcase/angular/tsconfig.app.json` modification (types: @angular/localize) — FOUND
- `showcase/angular/src/main.ts` modification (reference directive) — FOUND
- Commit `58b9088` (Task 1: install) — FOUND
- Commit `59446d4` (Task 2: angular.json i18n block) — FOUND
- Commit `eec248a` (Task 3: 6 XLIFF seeds) — FOUND
- Build artifact: 30 prerendered HTML files under `showcase/dist/showcase-angular/browser/{,es,de,ja,zh-CN,zh-TW}/{,about,agents,privacy,support}/index.html` — FOUND

## Self-Check: PASSED
