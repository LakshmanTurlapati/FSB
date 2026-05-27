---
phase: quick
plan: 260527-gue
quick_id: 260527-gue
status: complete
subsystem: website-ci
tags: [angular, i18n, xlf, crawler-metadata, ci]
requires:
  - phase: quick
    provides: existing showcase Angular i18n catalogs and crawler metadata
provides:
  - Angular source i18n catalog synchronized with current support FAQ template copy
  - Translated support FAQ XLF targets with placeholder parity across es/de/ja/zh-CN/zh-TW
  - Public LLM crawler metadata without advertised /stats entry
affects: [showcase-angular, website-ci, crawler-metadata, support-page-i18n]
tech-stack:
  added: []
  patterns: [Angular extract-i18n source catalog, targeted XLF placeholder parity repair]
key-files:
  created:
    - .planning/quick/260527-gue-fix-docs-branch-ci-failures-from-stale-s/260527-gue-SUMMARY.md
  modified:
    - showcase/angular/src/locale/messages.xlf
    - showcase/angular/src/locale/messages.es.xlf
    - showcase/angular/src/locale/messages.de.xlf
    - showcase/angular/src/locale/messages.ja.xlf
    - showcase/angular/src/locale/messages.zh-CN.xlf
    - showcase/angular/src/locale/messages.zh-TW.xlf
    - showcase/angular/scripts/llms-full.source.md
    - showcase/angular/public/llms-full.txt
    - showcase/angular/public/llms.txt
key-decisions:
  - "Kept /stats route and stats source untouched; removed only public LLM crawler metadata references."
  - "Used Angular extractor output as the source of truth for messages.xlf and matched translated placeholder multisets to that refreshed source."
patterns-established:
  - "Support FAQ XLF repairs should update source and translated target together for each affected trans-unit."
requirements-completed: []
duration: 14min
completed: 2026-05-27
---

# Quick Task 260527-gue: Docs Branch CI i18n and Crawler Metadata Summary

**Angular support FAQ i18n catalogs and LLM crawler metadata were resynchronized so the docs branch website CI path passes locally.**

## Performance

- **Duration:** 14 min
- **Started:** 2026-05-27T17:13:21Z
- **Completed:** 2026-05-27T17:27:03Z
- **Tasks:** 3/3
- **Files modified:** 10, including this summary

## Accomplishments

- Refreshed `messages.xlf` from `ng extract-i18n`; the extraction diff is clean.
- Updated support FAQ target translations across `es`, `de`, `ja`, `zh-CN`, and `zh-TW` with matching placeholder IDs.
- Removed `/stats` from `llms-full.source.md`, generated `llms-full.txt`, and `llms.txt` while leaving app routes untouched.

## Task Commits

1. **Task 1: Refresh extracted Angular i18n source** - `08ce882b`
2. **Task 2: Repair translated locale placeholder parity** - `1ad08cc6`
3. **Task 3: Remove /stats from crawler metadata** - `2c237df8`

## Verification

- `node showcase/angular/scripts/verify-locale-sync.mjs`
- `npm --prefix showcase/angular run lint:i18n` (exited 0; existing unused eslint-disable warning remains)
- `mkdir -p /tmp/extract-check && npx --prefix showcase/angular ng extract-i18n --output-path /tmp/extract-check --progress=false && diff -u showcase/angular/src/locale/messages.xlf /tmp/extract-check/messages.xlf`
- `npm --prefix showcase/angular run build --silent`
- `npm --prefix showcase/angular run verify:hreflang`
- `node showcase/angular/scripts/verify-bundle-budgets.mjs`
- `node tests/showcase-build-smoke.test.js` (94 passed, 0 failed)

## Deviations from Plan

None - plan executed as written.

## Issues Encountered

- Angular extract/build subprocesses aborted under the sandbox with no useful stderr. Reran the same verification commands outside the sandbox; all passed.
- `lint:i18n` reports one pre-existing warning in `agents-page.component.html`; it exits 0 and was not part of this quick task.

## Known Stubs

None found in the files modified by this quick task.

## Threat Flags

None - no network endpoints, auth paths, file access paths, or trust-boundary schema changes were introduced.

## Self-Check: PASSED

- Summary file exists at `.planning/quick/260527-gue-fix-docs-branch-ci-failures-from-stale-s/260527-gue-SUMMARY.md`.
- Task commits found in git history: `08ce882b`, `1ad08cc6`, `2c237df8`.
