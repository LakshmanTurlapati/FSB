# Milestone v0.9.63 -- Showcase i18n -- Requirements

**Branch:** `feat/showcase-i18n`
**Started:** retroactively registered 2026-05-12 (Phases 261 + 262 already shipped on this branch prior to registration)
**Goal:** Translate the FSB marketing site (`showcase/angular`) into es / de / ja / zh-CN / zh-TW while keeping English source-of-truth, locking copy-drift in CI, and emitting per-locale prerendered HTML with correct hreflang + canonical fan-out.

## Requirement IDs

REQ IDs are namespaced by concern: `COPY-*` (string marking), `ROUTE-*` (locale routing), `CI-*` (drift gates), `TRANS-*` (translation fill), `SEO-*` (hreflang / canonical), `BUILD-*` (prerender output).

| ID | Description | Phase | Status |
|----|-------------|-------|--------|
| ROUTE-02 | LocaleService + locale-constants module; supported locales = en, es, de, ja, zh-CN, zh-TW | 261 | DONE |
| CI-05 | `verify-locale-sync` script enforces locale constants <-> angular.json parity | 261 | DONE |
| CI-03 | `@angular-eslint/template/i18n` rule wired in `eslint.config.js`; `lint:i18n` npm script available | 261 | DONE |
| COPY-01 | Every visible marketing string marked with `i18n` / `$localize` across home, about, agents, privacy, support, shell + picker | 262 | DONE |
| COPY-03 | `ng extract-i18n` produces `messages.xlf` (source XLIFF) with 420 trans-units across 7 namespaces | 262 | DONE |
| CI-02 | `extract-i18n-clean` CI gate: `messages.xlf` byte-equal to a fresh extract | 262 | DONE |
| CI-01 | `lint:i18n` promoted to hard-fail CI step (website job) | 262 | DONE |
| COPY-02 | TS-side SEO `Title` + `Meta` strings marked via `$localize` tagged template (5 pages x 2 markers) | 262 | DONE |
| SEO-01 | Per-locale `index.html` bootstrap fan-out with correct `<link rel="alternate" hreflang>` + canonical | 264 | TODO |
| TRANS-01 | AI translator fills target XLIFFs (es, de, ja, zh-CN, zh-TW) from `messages.xlf` | 265 | TODO |
| CI-04 | `i18nMissingTranslation` flipped from `warning` to `error` once target XLIFFs are filled | 265 | TODO |
| BUILD-01 | `ng build` emits 30 prerendered HTMLs (6 marketing routes x 5 locale subpaths + en root) | 266 | TODO |
| VERIFY-01 | Verification baseline: lint:i18n 0 errors, extract-clean 0 diff, build 30 HTMLs, no untranslated trans-units in target XLIFFs | 266 | TODO |
| ROUTE-03 | Server-side Accept-Language redirect on `/` (cookie-respecting, bot-safe, 302) -- routes first-visit users to their preferred supported locale subpath | 267 | TODO |

## Coverage notes

- Phases 261 + 262 were executed before this REQUIREMENTS.md was created; REQ IDs above were backfilled from each plan's frontmatter `requirements_addressed` and from the `requirements_addressed` line in Plan 262-05's narrative. Original plan summaries are the source of truth for what was satisfied.
- Phase 263 dropped from milestone (dashboard surface explicitly deferred to v0.9.65 by user decision 2026-05-12); active phases are 261, 262, 264, 265, 266, 267.
- Phase 267 added 2026-05-13 (post-verification) for Accept-Language auto-detection -- user decision after Phase 266 surfaced the gap that picker writes a cookie but server never reads it.
- 264 / 265 / 266 phase boundaries follow the pointers in Plan 262-05's SUMMARY ("Phase 264 hreflang/canonical", "Phase 265 AI translator", "Phase 266 verification baseline").

## Out of scope (deferred)

- Dashboard surface (`src/app/pages/dashboard/**`) -- deferred to v0.9.65 per user decision 2026-05-12; `--ignore-pattern` in `lint:i18n` carries forward.
- Extension UI / popup translation (no current REQ).
- MCP server / skills text (English-only by design; CLI output).
