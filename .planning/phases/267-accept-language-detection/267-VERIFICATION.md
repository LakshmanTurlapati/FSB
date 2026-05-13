---
phase: 267-accept-language-detection
verified: 2026-05-13T00:00:00Z
status: passed
score: 8/8 truths verified
re_verification: false
requirements_satisfied: [ROUTE-03]
---

# Phase 267: Accept-Language Auto-Detection Verification Report

**Phase Goal:** Express middleware on `/` parses Accept-Language, picks best supported locale (BCP-47 q-value parsing), 302-redirects first-visit users to matching locale subpath. Cookie-respecting (`fsb-locale` cookie wins). Bot-safe (no Accept-Language header -> no redirect).
**Verified:** 2026-05-13T00:00:00Z
**Status:** passed
**Re-verification:** No -- retroactive verification per Plan 268-02 (D-268-02 / D-268-05).

---

## Goal Achievement

ROADMAP Phase 267 success criteria 1-8:

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | GET `/` with `Accept-Language: ja,en;q=0.8` -> 302 `/ja/` (no cookie) | VERIFIED | 267-01 SUMMARY live smoke; `tests/server-accept-language.test.js` 42 assertions |
| 2 | GET `/` with `Accept-Language: zh-Hant-TW,en;q=0.8` -> 302 `/zh-TW/` (BCP-47 alias) | VERIFIED | 267-01 SUMMARY; alias map covers `zh-Hant-TW` |
| 3 | GET `/` with `Accept-Language: en-US,en;q=0.9` -> 200 (EN root, no redirect) | VERIFIED | 267-01 SUMMARY |
| 4 | GET `/` with NO `Accept-Language` header -> 200 (bot-safe default) | VERIFIED | 267-01 SUMMARY (T-267-01 mitigation) |
| 5 | GET `/` with `Accept-Language: ja` AND `Cookie: fsb-locale=de` -> 200 (cookie wins) | VERIFIED | 267-01 SUMMARY live smoke; INTEGRATION-CHECK link #12 |
| 6 | GET `/` with unsupported `Accept-Language: ko,en;q=0.5` -> falls through to EN | VERIFIED | 267-01 SUMMARY |
| 7 | GET `/about`, `/agents`, `/es/about`, `/zh-TW/`, etc. -> never redirected | VERIFIED | 267-01 SUMMARY (D-02 scope: only bare `/`) |
| 8 | Non-GET (HEAD, POST) -> never redirected | VERIFIED | 267-01 SUMMARY (D-02 method scope) |

**Score:** 8/8 truths verified

---

## Required Artifacts

| Artifact | Source Plan | Status |
|----------|-------------|--------|
| `showcase/server/src/middleware/accept-language.js` | 267-01 | VERIFIED |
| `tests/server-accept-language.test.js` (42 assertions) | 267-01 | VERIFIED |
| `showcase/server/server.js` middleware wiring at bootstrap | 267-01 | VERIFIED |

---

## Key Link Verification

| From | To | Via | Status |
|------|----|-----|--------|
| `accept-language.js` factory | `server.js` bootstrap | `server.js:19` require + `app.use(...)` (INTEGRATION-CHECK link #11) | WIRED |
| Picker (`fsb-locale` cookie writer) | Middleware (cookie reader) | `COOKIE_NAME = 'fsb-locale'` (INTEGRATION-CHECK link #12) | WIRED |
| WARNING-01 (hardcoded locale literal) | Plan 268-01 resolution | commit `53d2bcc` (`.planning/phases/268-address-v0-9-63-tech-debt-locale-list-dedup-in-server-js-emi/268-01-SUMMARY.md`) | WIRED |

Primary cross-phase evidence base: `.planning/phases/v0.9.63-INTEGRATION-CHECK.md` (link #11, #12, Flow 1, Flow 2).

CI run: 25782178828 (267-01 push, green).

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status |
|-------------|------------|-------------|--------|
| ROUTE-03 | 267-01-PLAN.md | Accept-Language middleware on `/` | SATISFIED |

---

## Anti-Patterns Found

None detected.

---

## Verification Details

This retroactive verification draws on:

- `.planning/phases/v0.9.63-INTEGRATION-CHECK.md` -- link #11 confirms middleware wiring at `server.js`; link #12 confirms cookie precedence; Flow 1 + Flow 2 trace the two main code paths end-to-end.
- `267-01-SUMMARY.md` -- per-plan green CI evidence (run 25782178828) and live smoke results for all 8 success criteria.
- `.planning/REQUIREMENTS.md` -- confirms ROUTE-03 ownership by Phase 267.

### Non-critical gaps

Per CONTEXT D-268-05, the two warnings the milestone audit raised against Phase 267 are carried forward here for traceability. Neither blocks `status: passed` -- WARNING-01 is now resolved by Plan 268-01, and WARNING-02 is a locked UX decision deferred by design.

**WARNING-01 -- Duplicated supported-locale list in middleware wiring**
- **Original audit rationale (one-line):** `showcase/server/server.js:172` hardcoded the supported-locale literal `['es','de','ja','zh-CN','zh-TW']` instead of deriving from the canonical CJS registry at `showcase/server/src/utils/locale-constants.js`, bypassing the `verify-locale-sync.mjs` parity invariant.
- **Status:** resolved
- **resolved-in: 268-01** -- see `.planning/phases/268-address-v0-9-63-tech-debt-locale-list-dedup-in-server-js-emi/268-01-SUMMARY.md` (commit `53d2bcc`). Literal replaced with `LOCALES.filter(l => l !== SOURCE_LOCALE)`.

**WARNING-02 -- Picker-cookie short-circuit of bare-`/` redirect**
- **Original audit rationale (one-line):** A returning user with `fsb-locale=ja` who lands on bare `/` (e.g. shared link, fresh tab) sees the EN prerender at root, because the middleware short-circuits (`next()`) when the cookie is present rather than re-redirecting to `/{cookie-locale}/`.
- **Status:** deferred (locked UX behavior, not a bug)
- **Pointer:** `.planning/phases/267-accept-language-detection/267-CONTEXT.md` -- decision **D-02** (trigger scope: bare `/` GET only) and threat **T-267-03** (cookie clobbering mitigation) jointly lock the "cookie path is read-only" semantics. Flip to "redirect to cookie locale" reopens T-267-02 (redirect loop) and is explicitly deferred to v0.9.64+ pending UX telemetry.

---

_Verified: 2026-05-13T00:00:00Z_
_Verifier: Claude (Plan 268-02 retroactive backfill per D-268-02, D-268-05)_
