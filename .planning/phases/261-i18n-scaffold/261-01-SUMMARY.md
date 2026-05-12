---
phase: 261-i18n-scaffold
plan: 01
subsystem: showcase/i18n
tags: [i18n, locale-registry, ci-invariant, route-02, scaffold]
requires: []
provides:
  - "Shared locale registry (Angular ESM TS + Express CJS) — single source of truth for 6 locales"
  - "CI invariant script that fails on locale-registry drift"
affects:
  - "showcase/angular/src/app/core/i18n/ (new directory)"
  - "showcase/server/src/utils/ (new file)"
  - "showcase/angular/scripts/ (new file)"
tech-stack:
  added: []
  patterns:
    - "Hand-mirrored ESM-TS / CJS-JS registry with regex-driven CI parity check (RESEARCH.md Pattern 3)"
    - "ASCII-only source with \\uXXXX escapes for CJK label strings"
key-files:
  created:
    - "showcase/angular/src/app/core/i18n/locale-constants.ts"
    - "showcase/server/src/utils/locale-constants.js"
    - "showcase/angular/scripts/verify-locale-sync.mjs"
  modified: []
decisions:
  - "Two registry files (Angular ESM TS + Express CJS) hand-mirrored, not transpiled — locked per CONTEXT D-01..D-08 and RESEARCH.md Pattern 3 rationale."
  - "ASCII-only source with \\uXXXX escapes for ja / zh-CN / zh-TW labels — keeps diffs and grep clean across editors."
  - "LOCALE_SUBPATHS.en is the empty string '' — English serves at root, no /en/ prefix."
  - "verify-locale-sync.mjs uses regex (not AST) to extract the LOCALES array literal — robust enough for a single-line array, tolerant of TS vs JS quoting differences."
  - "No barrel index.ts under core/i18n/ — downstream consumers import directly from locale-constants per RESEARCH.md Open Question #2."
  - "No package.json script entry added here — Plan 03 owns showcase/angular/package.json edits; CI calls node showcase/angular/scripts/verify-locale-sync.mjs directly (Plan 04)."
requirements_completed: [ROUTE-02]
metrics:
  duration_minutes: 3
  tasks_completed: 3
  files_created: 3
  files_modified: 0
  commits: 3
completed: "2026-05-12T13:08:01Z"
---

# Phase 261 Plan 01: i18n Scaffold — Locale Registry & CI Invariant Summary

**One-liner:** Shipped the single source of truth for the six showcase locales as two byte-parity files (Angular ESM TS + Express CJS) plus a Node script that diffs their `LOCALES` arrays and fails CI on drift.

## What Shipped

Three new files, zero modifications, zero new npm dependencies.

1. **`showcase/angular/src/app/core/i18n/locale-constants.ts`** — Angular-side ESM TypeScript registry. Exports:
   - `SOURCE_LOCALE = 'en' as const`
   - `LOCALES = ['en', 'es', 'de', 'ja', 'zh-CN', 'zh-TW'] as const`
   - `type LocaleCode = typeof LOCALES[number]`
   - `LOCALE_NATIVE_LABELS: Record<LocaleCode, string>` with `\u` escapes for ja / zh-CN / zh-TW
   - `LOCALE_SUBPATHS: Record<LocaleCode, string>` with `en` mapped to `''`
   - `isValidLocale(value: unknown): value is LocaleCode`

2. **`showcase/server/src/utils/locale-constants.js`** — Express-side CommonJS mirror with `'use strict'`. Same five exports, same locale list in identical order, same label/subpath maps. Importable via `require('./showcase/server/src/utils/locale-constants')`.

3. **`showcase/angular/scripts/verify-locale-sync.mjs`** — CI invariant ESM Node script (no deps; `node:fs` + `node:path` only). Resolves both files from `process.cwd()`, extracts the `LOCALES` array literal with `/LOCALES\s*[:=]\s*\[([^\]]+)\]/`, trims/dequotes each entry, compares lengths and per-index equality. Exits 0 on parity with a confirmation line on stdout; exits 1 on drift with both arrays printed to stderr.

## Canonical Locale List (as Shipped)

```
['en', 'es', 'de', 'ja', 'zh-CN', 'zh-TW']
```

- `en` → `English`, subpath `''`
- `es` → `Espanol`, subpath `es`
- `de` → `Deutsch`, subpath `de`
- `ja` → `\u65e5\u672c\u8a9e` (Japanese), subpath `ja`
- `zh-CN` → `\u7b80\u4f53\u4e2d\u6587` (Simplified Chinese), subpath `zh-CN`
- `zh-TW` → `\u7e41\u9ad4\u4e2d\u6587` (Traditional Chinese), subpath `zh-TW`

## Sync Script Invocation

- **Local (from repo root):** `node showcase/angular/scripts/verify-locale-sync.mjs`
- **From CI (Plan 04 will wire this in `.github/workflows/ci.yml` before the Angular build):** identical command — script resolves paths relative to `process.cwd()`, which is the repo root in the CI runner.
- **Exit codes:** 0 = parity verified; 1 = drift detected (both arrays printed to stderr).

## Verification Evidence

All six plan-level invariants pass against the working tree at commit `b31cfc4`:

1. `test -f showcase/angular/src/app/core/i18n/locale-constants.ts` → OK
2. `test -f showcase/server/src/utils/locale-constants.js` → OK
3. `test -f showcase/angular/scripts/verify-locale-sync.mjs` → OK
4. `node -e "console.log(JSON.stringify(require('./showcase/server/src/utils/locale-constants.js').LOCALES))"` → `["en","es","de","ja","zh-CN","zh-TW"]`
5. `node showcase/angular/scripts/verify-locale-sync.mjs` → exit 0, stdout `Locale registry parity verified: ["en","es","de","ja","zh-CN","zh-TW"]`
6. ASCII-only check on both registry files (Python byte scan) → no non-ASCII bytes found

**Drift simulation:** Temporarily removed `'zh-TW'` from the Angular `LOCALES` literal and re-ran the script. Result: exit 1 with stderr line `Locale registry drift detected.` followed by both arrays. File was restored byte-for-byte before commit — `git diff` against `showcase/angular/src/app/core/i18n/locale-constants.ts` shows no residual mutation.

## Deviations from Plan

None — plan executed exactly as written. Both registry files match the RESEARCH.md Pattern 3 verbatim snippets; the verify script matches the RESEARCH.md verbatim mjs snippet. No bug fixes, no missing-functionality additions, no blocking issues, no architectural changes needed.

One operational note (not a deviation from the plan, but worth recording for orchestrator audit): the first `git add` of Task 1's file inadvertently swept in pre-staged `.planning/ROADMAP.md` changes left in the working tree by the orchestrator. The commit was soft-reset, ROADMAP.md was un-staged, and the Task 1 commit was redone with the registry file as the only diff (commit `3b63f51`). No content was lost; ROADMAP.md remains in its pre-execution staged state for the orchestrator to commit separately, per the parallel-executor objective ("Do NOT update STATE.md or ROADMAP.md").

## Auth Gates

None — plan ships only static constants and a Node-local verification script. No network, no auth, no secrets.

## Commits

- `3b63f51` `feat(261-01): add Angular locale-constants registry`
- `0652b0f` `feat(261-01): add Express CJS locale-constants mirror`
- `b31cfc4` `feat(261-01): add verify-locale-sync.mjs CI invariant`

All three committed with `--no-verify` per the parallel-execution directive (Wave 1, running alongside plan 261-02 to avoid pre-commit hook contention).

## Forward References

- **Plan 04** wires `node showcase/angular/scripts/verify-locale-sync.mjs` into `.github/workflows/ci.yml` (same workflow edit also adds the bundle-budget step, deliberately co-located to avoid a same-wave file conflict on `ci.yml`).
- **Plan 03** owns any `showcase/angular/package.json` script additions (e.g., a `verify:locale-sync` npm script alias if desired).
- **Phase 262** (language picker) imports `LOCALES` and `LOCALE_NATIVE_LABELS` from the Angular module to render the locale switcher; will also import `isValidLocale` for user-input validation.
- **Phase 263** (server-side detection middleware) imports `LOCALES`, `LOCALE_SUBPATHS`, and `isValidLocale` from the Express module to resolve incoming `Accept-Language` headers and persisted locale cookies into a canonical locale code.
- **Phase 264** (hreflang / SEO fan-out) iterates `LOCALES` + `LOCALE_SUBPATHS` to emit per-route `<link rel="alternate" hreflang="...">` tags.

## Known Stubs

None. Both registry files are fully populated with the locked 6-locale list and the locked native-label and subpath maps. No placeholder values, no TODO markers.

## Self-Check: PASSED

- FOUND: `showcase/angular/src/app/core/i18n/locale-constants.ts` (commit `3b63f51`)
- FOUND: `showcase/server/src/utils/locale-constants.js` (commit `0652b0f`)
- FOUND: `showcase/angular/scripts/verify-locale-sync.mjs` (commit `b31cfc4`)
- FOUND commit: `3b63f51`
- FOUND commit: `0652b0f`
- FOUND commit: `b31cfc4`
- VERIFIED: `node showcase/angular/scripts/verify-locale-sync.mjs` exits 0
- VERIFIED: ASCII-only on both registry files
- VERIFIED: drift simulation exits 1; file restored to committed state before plan end
