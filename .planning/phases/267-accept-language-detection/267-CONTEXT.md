---
phase: 267-accept-language-detection
subsystem: showcase/server
tags: [server, i18n, routing, accept-language, seo]
one_liner: "Express middleware: parse Accept-Language on /, 302-redirect first-visit users to best supported locale subpath; cookie-respecting and bot-safe."
requires:
  - "Phase 266 complete (per-locale subpaths exist + verification baseline green)"
provides:
  - "showcase/server/src/middleware/accept-language.js -- BCP-47 q-value parser + matcher + Express middleware factory"
  - "Wired into showcase/server/server.js before the marketing-routes block"
  - "tests/server-accept-language.test.js -- unit + handler tests (zero new deps)"
affects:
  - "Express request flow: GET / with Accept-Language and no fsb-locale cookie now 302-redirects"
  - "Bot/SEO behavior: no header => no redirect (Googlebot lands on EN root, unaffected)"
requirements_addressed: [ROUTE-03]
---

## Locked Decisions

### D-01 -- Mechanism: server-side Express middleware (not geo-IP, not client JS)
Per discussion 2026-05-13: cleanest, no new deps, hosting-portable, SEO-safe (Google explicitly approves cookie+header redirects, warns against geo-IP). No FOUC. Bots fall through cleanly.

### D-02 -- Trigger scope: bare `/` GET only
Only redirect when `req.path === '/' && req.method === 'GET'`. Deep links (`/about`, `/es/about`, `/zh-TW/`) are never redirected -- users got there intentionally, redirecting them mid-session would be hostile. HEAD requests also pass through (mirrors GET semantics for crawlers).

### D-03 -- Cookie precedence: `fsb-locale` cookie wins over Accept-Language
If `Cookie: fsb-locale=<valid-locale>` is present, fall through (no redirect). The picker already writes this cookie; respecting it is the only way to make the picker behavior sticky.

### D-04 -- Redirect status: 302 (not 301)
Bots and CDNs must not cache the decision. The user's headers can change (different machine, different browser language). 301 would break that.

### D-05 -- BCP-47 quality-value parsing, no new deps
Parse `Accept-Language` per RFC 7231: comma-separated entries, each with optional `;q=0.x` weight. Sort by quality descending, then return the first that matches a supported locale (with subtag aliasing per D-06). Pure Node stdlib -- ~25 LOC.

### D-06 -- Subtag aliasing
- `zh-Hans*` (anywhere in the tag) -> `zh-CN`
- `zh-Hant*` -> `zh-TW`
- `zh-TW`, `zh-MO`, `zh-HK` -> `zh-TW`
- `zh-CN`, `zh-SG` -> `zh-CN`
- Plain `zh` -> `zh-CN` (mainland default, matches Google CLDR convention)
- All other tags: exact match against supported (`en`, `es`, `de`, `ja`, `zh-CN`, `zh-TW`); then primary subtag match (`es-MX` -> `es`, `de-AT` -> `de`, `ja-JP` -> `ja`).

### D-07 -- EN special case: never redirect TO `/en/`
EN is served from root `/`, not `/en/`. If best match is `en`, no redirect.

### D-08 -- Bot safety
Browsers always send `Accept-Language`. Googlebot, Bingbot, etc. typically do NOT. The middleware only redirects when the header is PRESENT. Missing header => fall through => EN root => bots crawl normally via existing hreflang fan-out.

### D-09 -- Unsupported language fallback
If no supported locale matches (e.g. `Accept-Language: ko,fr`), fall through. EN is the source-of-truth fallback per existing LocaleService logic.

### D-10 -- Test surface
Single test file: `tests/server-accept-language.test.js`. Tests target the matcher function (pure, fast) plus a handful of end-to-end Express tests via supertest -- BUT supertest is not currently a dep. To keep "zero new deps": test the matcher as a pure function (covers 95% of risk), and add one Bash-style test that hits the running server with curl. Stick to pure-function tests in this phase to keep the test fast and zero-dep.

### D-11 -- No client-side changes
LocaleService stays as-is. The stale "Phase 263 will set the cookie server-side" comment in `locale.service.ts` is updated to reference Phase 267 instead.

### D-12 -- Out of scope
- Geo-IP routing (deferred; needs CDN feature)
- Cookie-parser middleware (parse `Cookie` header inline, ~3 LOC)
- Updating the picker (it already writes the cookie correctly)
- Telemetry / logging redirects (deferred; can add a counter later if desired)
- Vary: Accept-Language response header on `/` (defer -- CDN cache config concern, low priority for current deploy)

## Threat Model

- **T-267-01 -- Bot misrouted:** Mitigation D-08 (no header => no redirect).
- **T-267-02 -- Redirect loop:** Mitigation D-02 (only `/` is gated; redirect target is `/{locale}/` which is NEVER gated -> no loop possible).
- **T-267-03 -- Cookie clobbering:** Mitigation D-03 (cookie wins; only set elsewhere).
- **T-267-04 -- Malformed header crashes server:** Pure parser must tolerate `Accept-Language: ` (empty), `;;;`, `q=abc`, very long strings. Wrap parser in try/catch; on any error, fall through.
- **T-267-05 -- 301 caching nightmare:** Mitigation D-04 (302).

## Acceptance (mirrors ROADMAP success criteria)

See ROADMAP.md Phase 267 success criteria 1-8.

## Next Step

Single PLAN: `267-01-PLAN.md` covers middleware + wiring + tests + locale.service.ts comment update.
