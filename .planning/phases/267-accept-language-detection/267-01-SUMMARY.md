---
phase: 267-accept-language-detection
plan: 01
subsystem: showcase/server
tags: [server, i18n, routing, accept-language]
one_liner: "Accept-Language auto-detection middleware landed on bare GET / with cookie-respecting, bot-safe 302 redirect; 42 tests pass, CI green (run 25782178828)."
requires:
  - "Phase 266 complete"
provides:
  - "showcase/server/src/middleware/accept-language.js"
  - "tests/server-accept-language.test.js (42 assertions)"
  - "server.js wiring before marketing-routes block"
  - "ROUTE-03 closed"
affects:
  - "Express request flow: GET / now 302-redirects to /{best-locale}/ when Accept-Language matches a supported locale and no fsb-locale cookie is present"
requirements_addressed: [ROUTE-03]
---

## Goal Achieved

All 8 ROADMAP success criteria verified. Middleware is live, tests pass locally and in CI, live curl smoke matches expected redirects.

| Criterion | Verified |
|-----------|----------|
| 1. GET / + Accept-Language ja => 302 /ja/ | Live smoke + test |
| 2. GET / + Accept-Language zh-Hant-TW => 302 /zh-TW/ | Live smoke + test |
| 3. GET / + Accept-Language en-US,en;q=0.9 => no redirect | Live smoke + test |
| 4. GET / + NO Accept-Language header => no redirect (bot-safe) | Live smoke + test |
| 5. GET / + Accept-Language ja + Cookie fsb-locale=de => no redirect (cookie wins) | Live smoke + test |
| 6. GET / + Accept-Language ko,fr => no redirect (unsupported) | Live smoke + test |
| 7. GET /about etc. => never redirected | Live smoke + test |
| 8. Non-GET (POST) => never redirected | Test |

CI run [25782178828](https://github.com/LakshmanTurlapati/FSB/actions/runs/25782178828) all 4 jobs success.

## Implementation

### Middleware (`showcase/server/src/middleware/accept-language.js`)

Three exports, zero new dependencies:
- `pickBestLocale(header, supported)` -- pure parser. BCP-47 q-value parsing per RFC 7231. Returns canonical supported locale code or null.
- `parseCookieHeader(raw, name)` -- inline cookie parser (~10 LOC); avoids adding `cookie-parser` dep.
- `createAcceptLanguageMiddleware({ supported, defaultLocale, cookieName })` -- factory returning Express middleware.

**Alias map (CONTEXT D-06):**
- `zh-Hans*`, `zh-CN`, `zh-SG`, plain `zh` -> `zh-CN`
- `zh-Hant*`, `zh-TW`, `zh-MO`, `zh-HK` -> `zh-TW`
- Exact match (case-insensitive) wins next
- Primary subtag fallback: `es-MX` -> `es`, `de-AT` -> `de`

**Defensive behavior (T-267-04 mitigation):** parser tolerates empty / null / undefined / `;;;` / `q=abc` / 1000-char gibberish without throwing. Middleware wraps everything in try/catch; any error -> `next()`.

### Wiring (`showcase/server/server.js`)

One block inserted immediately before the marketing-routes block (line ~172):
```js
app.use(createAcceptLanguageMiddleware({
  supported: ['es', 'de', 'ja', 'zh-CN', 'zh-TW'],
  defaultLocale: 'en',
  cookieName: 'fsb-locale',
}));
```

Order matters: this MUST run before the static-file send so a redirect short-circuits the response.

### Tests (`tests/server-accept-language.test.js`)

42 assertions, all pass:
- 23 `pickBestLocale` cases (happy paths, aliases, malformed input, edge cases, quality ordering, q=0 handling, case insensitivity, whitespace tolerance, 1000-char gibberish)
- 6 `parseCookieHeader` cases (basic, multi-cookie, absent, null, empty, whitespace)
- 13 middleware cases via mocked `req` / `res` / `next` (GET/HEAD/POST, cookie precedence, deep-link pass-through, bot fall-through, default-locale fall-through, unsupported fall-through, malformed-header fall-through, redirect-status verification)

Wired into root `package.json` test chain so the extension job runs it on CI.

### Documentation cleanup

`locale.service.ts` had 2 stale comments referencing "Phase 263" for the server-side cookie/Accept-Language work (Phase 263 was dropped from this milestone and reassigned to dashboard work in v0.9.65). Updated both to "Phase 267."

## Threat Mitigations

- **T-267-01 (bot misrouted):** Mitigated. Confirmed: GET / without Accept-Language header returns no redirect.
- **T-267-02 (redirect loop):** Structurally impossible. Only `/` is gated; redirect target `/{locale}/` is never gated.
- **T-267-03 (cookie clobbering):** Mitigated. Cookie path is read-only; picker is the only writer.
- **T-267-04 (malformed header crashes server):** Mitigated. Parser + middleware both wrapped in try/catch; 1000-char gibberish + `;;;` + `q=abc` all return null without throwing.
- **T-267-05 (301 caching nightmare):** Mitigated. Status is 302.

## Live Smoke (curl against localhost:3849)

| Request | Response | Verdict |
|---------|----------|---------|
| `GET /` (no headers) | 503* | OK (fell through, no redirect) |
| `GET /` + `Accept-Language: ja,en;q=0.8` | 302 -> `/ja/` | ✓ |
| `GET /` + `Accept-Language: zh-Hant-TW,en;q=0.8` | 302 -> `/zh-TW/` | ✓ |
| `GET /` + `Accept-Language: ja` + `Cookie: fsb-locale=de` | 503* | OK (cookie wins, fell through) |
| `GET /about` + `Accept-Language: ja` | 503* | OK (deep link, no redirect) |
| `GET /` + `Accept-Language: es-MX,en;q=0.9` | 302 -> `/es/` | ✓ |
| `GET /` + `Accept-Language: en-US,en;q=0.9` | 503* | OK (default, no redirect) |
| `GET /` + `Accept-Language: ko,fr` | 503* | OK (unsupported, no redirect) |

\* 503 is unrelated to the middleware -- the showcase server's hard-coded staticPath search expects the build at `server/public` or sibling `dist/`, and the test environment had the build at `showcase/dist/showcase-angular/browser`. In production the staticPath resolves correctly and 503 becomes 200.

## Deviations from PLAN

None.

## Self-Check

- 42/42 tests pass locally.
- CI green on run 25782178828 (all 4 jobs).
- `showcase/server/server.js` change is one block, well-placed.
- `locale.service.ts` stale comments fixed.
- Zero new npm dependencies.
- No regression in Phase 266 chain (showcase job still green).

## Deferred (to v0.9.64 or follow-on)

- **Geo-IP routing** -- needs CDN feature; not portable. Document as v0.9.64+ if needed.
- **`Vary: Accept-Language` response header** -- relevant once a CDN sits in front of `/`. Defer to deploy hardening.
- **Telemetry counter on redirects** -- useful for observability; defer.
- **Per-route Accept-Language detection** (e.g. `GET /about` -> `/es/about`) -- intentionally out of scope; deep links are honored verbatim per D-02.

## Next Step

`/gsd-audit-milestone v0.9.63` -> `/gsd-complete-milestone v0.9.63` -> `/gsd-cleanup`.
