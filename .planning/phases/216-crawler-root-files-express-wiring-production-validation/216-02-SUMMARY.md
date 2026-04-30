---
phase: 216
plan: 02
subsystem: crawler-prebuild-pipeline
tags: [seo, geo, prebuild, sitemap, llms-full, build-pipeline]
requires:
  - showcase/angular/scripts/llms-full.source.md (Plan 01)
  - manifest.json (.version)
provides:
  - showcase/angular/scripts/build-crawler-files.mjs (single-file ESM prebuild)
  - showcase/angular/public/sitemap.xml (CRAWL-02 generated artifact)
  - showcase/angular/public/llms-full.txt (CRAWL-04 generated artifact)
  - showcase/angular/src/app/core/seo/version.ts (D-14 generated constant)
  - showcase/angular/package.json prebuild hook (CRAWL-05 wiring)
  - .planning/phases/216-.../verify-prebuild.sh
affects:
  - showcase/angular/package.json scripts.prebuild
  - showcase/angular/src/app/core/seo/version.ts (Phase 215 Plan 03 interim constant overwritten)
tech-stack:
  added: []
  patterns:
    - npm "prebuild" lifecycle hook -- runs automatically before "build" with no Angular Builder modification
    - import.meta.url + fileURLToPath path resolution -- script works from any CWD (repo root, showcase/angular, npm prebuild)
    - Single-file ESM Node script with three named functions (generateSitemap, copyLlmsFull, writeVersion); zero new npm deps per CRAWL-05
    - Build-date ISO 8601 short-form lastmod uniformly applied across sitemap entries (D-07)
    - Generated-at HTML-comment header on llms-full.txt with byte-length assertion < 256000 (D-05, T-216-D1 mitigation)
    - manifest.json .version as canonical softwareVersion source -- write-time, not runtime read (D-14)
key-files:
  created:
    - showcase/angular/scripts/build-crawler-files.mjs
    - .planning/phases/216-crawler-root-files-express-wiring-production-validation/verify-prebuild.sh
    - showcase/angular/public/sitemap.xml (generated)
    - showcase/angular/public/llms-full.txt (generated)
  modified:
    - showcase/angular/package.json (added "prebuild" script entry, no dep changes)
    - showcase/angular/src/app/core/seo/version.ts (regenerated header + literal from manifest.json)
decisions:
  - "Single-file mjs structure picked over split (build-sitemap.mjs / build-llms.mjs / write-version.ts) per CONTEXT.md Claude's discretion -- the script is small and reads as one cohesive prebuild step"
  - "Sitemap pretty-printed with 2-space indents and one element per line per CONTEXT.md discretion -- improves human review during PR diffs"
  - "Path resolution uses fileURLToPath(import.meta.url) instead of process.cwd() so the script is invocation-agnostic (npm prebuild fires it from showcase/angular/, but standalone debugging may run it from repo root)"
  - "Umbrella verify.sh required no edits -- Plan 01 already wired conditional `[ -f path ] && bash path` chaining for verify-prebuild.sh"
metrics:
  duration: ~6 minutes
  tasks: 3
  files: 6
  completed: 2026-04-30
requirements: [CRAWL-02, CRAWL-04, CRAWL-05, LD-03]
---

# Phase 216 Plan 02: Prebuild Script & Build-Time Crawler Artifact Pipeline Summary

Locked the build-time pipeline that keeps sitemap.xml lastmod fresh, llms-full.txt content fresh, and the JSON-LD softwareVersion tied to manifest.json -- all wired to fire automatically before every `npm --prefix showcase/angular run build` with zero new npm dependencies.

## Files Shipped

| File | Bytes | Purpose |
|------|-------|---------|
| `showcase/angular/scripts/build-crawler-files.mjs` | 3204 | Single-file ESM prebuild orchestrator (CRAWL-05) |
| `showcase/angular/public/sitemap.xml` | 516 | 4-route sitemap with build-date lastmod (CRAWL-02) |
| `showcase/angular/public/llms-full.txt` | 9440 | Long-form crawler dump with generated-at header (CRAWL-04) |
| `showcase/angular/src/app/core/seo/version.ts` | regenerated | APP_VERSION='0.9.31' sourced from manifest.json (D-14) |
| `showcase/angular/package.json` | +1 line | Adds `"prebuild": "node scripts/build-crawler-files.mjs"` |
| `.planning/phases/216-.../verify-prebuild.sh` | 100 lines | CRAWL-02/04/05 + D-14 assertions |

## Commits

- `b0dce14` feat(216-02): add build-crawler-files.mjs prebuild script
- `302a06b` feat(216-02): wire prebuild npm hook to build-crawler-files.mjs
- `57ad02b` test(216-02): add verify-prebuild.sh asserting CRAWL-02/04/05 + D-14

## Script Structure Decision

Single mjs file with three top-level functions (`generateSitemap`, `copyLlmsFull`, `writeVersion`) sequenced inside `main()`. Considered splitting into `build-sitemap.mjs` + `build-llms.mjs` + `write-version.ts` per CONTEXT.md Claude's-discretion note, but the entire script is ~85 lines and three functions read more naturally co-located than as three nearly-empty files. The npm prebuild hook then has a single command target (`node scripts/build-crawler-files.mjs`), not a shell-and that chains three.

## Build-Log Excerpt (prebuild firing)

```
> npm --prefix showcase/angular run build

> showcase-angular@0.0.0 prebuild
> node scripts/build-crawler-files.mjs

[build-crawler-files] sitemap.xml written (516 bytes, lastmod=2026-04-30)
[build-crawler-files] llms-full.txt written (9440 bytes)
[build-crawler-files] version.ts written (APP_VERSION='0.9.31')
[build-crawler-files] all crawler-file artifacts regenerated

> showcase-angular@0.0.0 build
> ng build

...
Prerendered 4 static routes.
Application bundle generation complete. [4.868 seconds]
Output location: /Users/lakshmanturlapati/Desktop/FSB/showcase/dist/showcase-angular
```

The prebuild hook fires automatically -- no `&&` chaining, no Angular Builder change. After build, `showcase/dist/showcase-angular/browser/sitemap.xml` and `llms-full.txt` are present (public glob shipped them) and `dashboard/index.html` remains absent (Phase 215 D-18 invariant preserved).

## Generated-Artifact Byte Sizes

- sitemap.xml: 516 bytes (XML decl + urlset + 4 url blocks with loc/lastmod, pretty-printed)
- llms-full.txt: 9440 bytes (83-byte generated-at header + 9357-byte llms-full.source.md from Plan 01)
- version.ts: 2-line file (1 comment + 1 export)

llms-full.txt is well under the 256000-byte budget (3.7% of the limit). The script's `Buffer.byteLength` guard halts the build with a printed reason if a future content edit pushes the total over budget (T-216-D1 mitigation).

## version.ts Diff (before vs after)

Before (Phase 215 Plan 03 interim, 11 lines):
```typescript
/**
 * Interim softwareVersion source for Phase 215 SoftwareApplication JSON-LD (LD-02 / D-14).
 *
 * Phase 216 (CRAWL-05) will replace this hand-edited constant with a prebuild-generated value
 * read from /manifest.json:4 by scripts/build-crawler-files.mjs. Until then, bump APP_VERSION
 * here when the root package.json version field is bumped.
 *
 * Source: /Users/lakshmanturlapati/Desktop/FSB/package.json "version" field.
 */
export const APP_VERSION = '0.9.31';
```

After Plan 02 prebuild (3 lines including trailing newline):
```typescript
// Generated by scripts/build-crawler-files.mjs from manifest.json -- do not edit by hand.
export const APP_VERSION = '0.9.31';
```

The literal value is unchanged (`0.9.31` matches `manifest.json .version` byte-for-byte), but the source of truth has shifted: future version bumps now happen in manifest.json and propagate to the SoftwareApplication JSON-LD on the home page automatically at build time. This is the Phase 215 D-14 carry-forward.

## Idempotency

Re-running `node showcase/angular/scripts/build-crawler-files.mjs` produces byte-identical output for sitemap.xml, llms-full.txt, and version.ts (modulo the date in the lastmod / header if the UTC day rolls over between invocations). Verified by running the script twice in succession during Task 1.

## Angular Build Pipeline Interaction

No surprises. npm's `prebuild` lifecycle conventions invoked the script automatically when `npm run build` was called -- no Angular Builder configuration, no angular.json modification, no `predefaultProject` indirection. The `public` glob already wired in Phase 215 (`showcase/angular/angular.json` -> `assets[]` `{ "glob": "**/*", "input": "public" }`) carried sitemap.xml + llms-full.txt to `dist/showcase-angular/browser/` automatically. Total integration cost: one new line in package.json.

## Threat Model Adherence

- T-216-D1 (llms-full.txt size growth): mitigated -- `copyLlmsFull` throws if `Buffer.byteLength(body) >= 256000`, halting the build before deploy.
- T-216-T3 (sitemap route drift): mitigated -- ROUTES is a hardcoded array in build-crawler-files.mjs; verify-prebuild.sh CRAWL-02-C asserts the four expected `<loc>` entries plus the absence of `/dashboard`.
- T-216-T2 (manifest.json -> APP_VERSION tampering): accepted per the threat register; Plan 05's Rich Results manual UAT catches semantic mismatches between JSON-LD payload and on-page content.
- T-216-S1 (npm prebuild lifecycle hijack): accepted; the prebuild script invokes only a local committed file, no network, no process substitution.

## Deviations from Plan

None. Plan executed exactly as written across all three tasks. The umbrella verify.sh required no edits because Plan 01 had already wired conditional chaining for `verify-prebuild.sh` (the `wave_1_context` note that suggested extending it was based on an earlier umbrella shape; the version Plan 01 shipped already included the conditional).

## Self-Check: PASSED

Verified after writing this SUMMARY:

- `showcase/angular/scripts/build-crawler-files.mjs` -- FOUND
- `showcase/angular/public/sitemap.xml` -- FOUND
- `showcase/angular/public/llms-full.txt` -- FOUND
- `showcase/angular/src/app/core/seo/version.ts` -- FOUND, contains `APP_VERSION = '0.9.31'`
- `showcase/angular/package.json` -- FOUND, contains `"prebuild": "node scripts/build-crawler-files.mjs"`
- `.planning/phases/216-crawler-root-files-express-wiring-production-validation/verify-prebuild.sh` -- FOUND, executable
- Commit `b0dce14` -- FOUND in git log
- Commit `302a06b` -- FOUND in git log
- Commit `57ad02b` -- FOUND in git log
- `bash verify-prebuild.sh` -- exits 0 with `ALL PASSED`
- `bash verify.sh` (umbrella) -- exits 0 with `ALL AVAILABLE ASSERTIONS PASSED`
- `npm --prefix showcase/angular run build` -- exits 0; prebuild fires; dist contains sitemap.xml + llms-full.txt; dashboard/index.html absent
- Zero new entries in `showcase/angular/package.json` dependencies or devDependencies (verified by grep deny-list in verify-prebuild.sh)
