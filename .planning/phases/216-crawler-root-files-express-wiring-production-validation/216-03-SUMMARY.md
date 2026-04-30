---
phase: 216
plan: 03
subsystem: express-wiring
tags: [seo, geo, express, server, spa-fallback, cache-control, crawler]
requires:
  - showcase/dist/showcase-angular/browser/{index.html,about/index.html,privacy/index.html,support/index.html} (Phase 215 prerender output)
  - showcase/dist/showcase-angular/browser/{robots.txt,sitemap.xml,llms.txt,llms-full.txt} (Plans 01 + 02 output, copied via angular.json public glob)
provides:
  - server/server.js patched setHeaders callback (.txt/.xml -> Cache-Control: public, max-age=3600)
  - server/server.js marketingRoutes-aware custom middleware (per-route prerendered HTML for /, /about, /privacy, /support; SPA shell only for /dashboard exact-match; 404 otherwise)
  - .planning/phases/216-.../verify-server.sh (boots server, asserts SRV-01/02/03 + T-216-01)
affects:
  - server/server.js:97-150 (express.static block + replaced SPA fallback)
tech-stack:
  added: []
  patterns:
    - express.static({ redirect: false }) -- disable trailing-slash directory redirect so the custom middleware can serve about/index.html instead of express.static 301-ing /about to /about/
    - app.use((req, res, next) => ...) middleware-form fallback over app.get([...]) router-form -- one decision tree (marketingRoutes Set + /dashboard exact-match + 404) reads more naturally as a single middleware
    - Set.has() exact-match whitelist for SPA-shell routes (D-10) -- prevents accidental prefix-match shadowing of future apex routes that happen to start with "dashboard"
    - setHeaders branch ordering: .txt/.xml first with `return` short-circuit so .js/.css/.html branch cannot double-fire on a hypothetical foo.html.txt filename
key-files:
  created:
    - .planning/phases/216-crawler-root-files-express-wiring-production-validation/verify-server.sh
  modified:
    - server/server.js
decisions:
  - "Picked app.use((req, res, next) => ...) middleware form over app.get([...]) router form per CONTEXT.md Claude's discretion -- the route-set + dashboard-whitelist + 404 fallthrough is one decision tree and reads cleaner as a single middleware"
  - "Added redirect: false to express.static options (Rule 3 inline fix) -- without it, express.static 301-redirects /about to /about/ before the custom middleware can serve about/index.html, breaking SRV-01"
  - "Port 3216 chosen for verify-server.sh default to avoid collision with the dev port 3847 and the legacy 3000; PORT env var override supported"
  - "SPA-shell <app-root marker grepped without closing > because the prerendered tag carries ng-version + ng-server-context attributes (<app-root ng-version=\"19.2.21\" ng-server-context=\"ssg\">)"
  - "Express auto-emits 404 with HTML body for unmatched routes after middleware fallthrough -- no need for an explicit catch-all 404 handler; Express default suffices for SRV-02-B/C"
  - "sitemap.xml Content-Type emitted by Express mime database is application/xml (no charset suffix) -- verify regex accepts (application|text)/xml to be portable across mime versions"
metrics:
  duration: ~10 minutes
  tasks: 3
  files: 2
  completed: 2026-04-30
requirements: [SRV-01, SRV-02, SRV-03]
---

# Phase 216 Plan 03: Express Wiring -- Per-Route Prerendered HTML, Whitelist SPA Shell, Crawler Cache-Control Summary

Patched `server/server.js` so marketing routes serve their per-route prerendered HTML (Phase 215 output) instead of the root SPA shell, the `/dashboard` exact-match continues to bootstrap the SPA, and crawler files (`*.txt`, `*.xml`) carry `Cache-Control: public, max-age=3600` -- with a verify-server.sh that boots the server end-to-end and enforces the T-216-01 no-shadowing invariant.

## Files Shipped

| File | Bytes | Purpose |
|------|-------|---------|
| `server/server.js` | modified +71 / -19 | setHeaders extended with .txt/.xml branch (Task 1); SPA fallback replaced with marketingRoutes middleware (Task 2); express.static gets `redirect: false` (Task 2 inline fix) |
| `.planning/phases/216-.../verify-server.sh` | 193 lines | Boots server on port 3216, asserts SRV-01/02/03 + T-216-01 |

## Commits

- `6fdb972` feat(216-03): extend express.static setHeaders with .txt/.xml Cache-Control
- `819b779` feat(216-03): replace SPA fallback with marketingRoutes middleware (D-09/D-10)
- `7c93399` test(216-03): add verify-server.sh asserting SRV-01/02/03 + T-216-01

## server.js Diff -- Before / After

### Task 1 -- setHeaders callback (server.js:101-106 -> 101-114)

Before:
```javascript
setHeaders: function(res, filePath) {
  // Prevent stale JS/CSS from being served -- dashboard updates must take effect immediately
  if (filePath.endsWith('.js') || filePath.endsWith('.css') || filePath.endsWith('.html')) {
    res.setHeader('Cache-Control', 'no-cache, must-revalidate');
  }
}
```

After:
```javascript
setHeaders: function(res, filePath) {
  // Phase 216 SRV-03 / D-11: crawler files cache for 1 hour at the edge.
  // The .txt/.xml branch must come first and short-circuit so a future stray
  // filename (e.g. foo.html.txt) does not double-fire and pick up the no-cache header.
  if (filePath.endsWith('.txt') || filePath.endsWith('.xml')) {
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return;
  }
  // Existing policy: prevent stale JS/CSS/HTML -- dashboard updates must take effect immediately.
  if (filePath.endsWith('.js') || filePath.endsWith('.css') || filePath.endsWith('.html')) {
    res.setHeader('Cache-Control', 'no-cache, must-revalidate');
  }
}
```

The `.txt`/`.xml` branch comes first and returns; the original `.js`/`.css`/`.html` branch is preserved verbatim. Verified by SRV-03-E regression check (main-6QX5FO3V.js still emits `no-cache, must-revalidate`).

### Task 2 -- SPA fallback (server.js:110-117 replaced)

Before (the original eight-line `app.get(...)`):
```javascript
app.get(['/', '/about', '/dashboard', '/privacy', '/support'], (req, res) => {
  if (!staticPath) {
    res.status(503).type('text/plain').send('Showcase build not found. Run `npm --prefix showcase/angular run build` first.');
    return;
  }
  res.sendFile(path.join(staticPath, 'index.html'));
});
```

After (37-line custom middleware with the marketingRoutes Set, /dashboard exact-match whitelist, and 404 fallthrough). See server.js:117-153.

Plus an in-place addition to the express.static options block:
```javascript
// Phase 216 SRV-01 / D-09: disable trailing-slash directory redirect so /about
// does NOT 301 to /about/ before our custom middleware can serve about/index.html.
// The custom middleware below handles marketing routes explicitly via path.join.
redirect: false,
```

## Form Choice: app.use vs app.get

Picked `app.use((req, res, next) => ...)` over `app.get([...]/, '/about', ...])` + a separate `app.get('/dashboard', ...)`. Reasons:

1. **Single decision tree.** The "marketingRoutes / /dashboard / fall-through" logic is one nested conditional. Splitting it across two `app.get` handlers would duplicate the staticPath null guard and split the 404 fallthrough across two places.
2. **Explicit fallthrough.** `next()` makes "this route is not for me, let the 404 happen" inspectable in one place.
3. **Easier diff.** The marketingRoutes Set sits at the top of the block, adjacent to the middleware that consumes it; future contributors adding a route only touch one Set literal.

CONTEXT.md "Claude's Discretion" note explicitly permits either form for the D-09 patch. Tradeoff considered: `app.get([...])` is slightly more idiomatic Express and shows up in route enumeration tools. Not load-bearing here -- this server is small enough that grep finds the middleware regardless of registration form.

## Inline Rule 3 Fix: express.static `redirect: false`

The original express.static block at server.js:97-108 ran with default options (`redirect: true`). When the custom middleware was first wired, `/about` came back as `301 -> /about/` instead of route-specific HTML. Root cause: express.static, sitting earlier in the middleware chain, sees `staticPath/about` is a directory and 301-redirects to `/about/` to canonicalize. The redirect fires before the custom middleware ever sees the request.

Fix: pass `redirect: false` to `express.static`. Now the static handler skips directories silently (it never serves directory index.html files in the first place -- Phase 215's prerender only generates `about/index.html` etc., it does not configure express.static for directory listing), and the custom middleware handles `/about` -> `path.join(staticPath, '/about', 'index.html')` -> `res.sendFile(...)` cleanly.

This was a Rule 3 inline fix (blocking issue: original Task 2 patch failed end-to-end smoke). Tracked here, no separate deviation entry needed because the plan's own action note ("If the plan executor finds Express defaults to a different status, add an explicit ...") flagged that Express defaults could surface during execution.

## Port Choice: 3216

verify-server.sh defaults to PORT=3216 (chosen because it encodes the phase number and is unlikely to collide with the dev server on 3847 or any common dev port like 3000/8080). PORT env var override supported -- contributors running parallel verifiers can do `PORT=3217 bash verify-server.sh`. The script polls `curl -fsS http://localhost:$PORT/` for up to 10 seconds (20 iterations of 0.5s) before giving up.

## Smoke Run -- Live Server Output

```
[216] verify-server.sh starting (port=3216)
[216] CHECK: dist artifacts present
[216] CHECK: server bound on port 3216 (pid=4032)
[216] CHECK: SRV-01-A /about (/about)
[216] CHECK: SRV-01-B /privacy (/privacy)
[216] CHECK: SRV-01-C /support (/support)
[216] CHECK: SRV-01-D / (/)
[216] CHECK: SRV-01-D LD-02 JSON-LD present on /
[216] CHECK: SRV-02-A /dashboard returns SPA shell with no /dashboard canonical
[216] CHECK: SRV-02-B /dashboard/foo -> 404
[216] CHECK: SRV-02-C /nonexistent-marketing-route -> 404
[216] CHECK: SRV-03-A robots.txt (/robots.txt) headers correct
[216] CHECK: SRV-03-B sitemap.xml (/sitemap.xml) headers correct
[216] CHECK: SRV-03-C llms.txt (/llms.txt) headers correct
[216] CHECK: SRV-03-D llms-full.txt (/llms-full.txt) headers correct
[216] CHECK: T-216-01 crawler files NOT shadowed by SPA fallback
[216] CHECK: SRV-03-E /main-6QX5FO3V.js retains no-cache, must-revalidate
[216] verify-server.sh: SRV-01, SRV-02, SRV-03, T-216-01 ALL PASSED
```

Header excerpts captured during the run:

```
# /about
<title>FSB - About</title>
rel="canonical" href="https://full-selfbrowsing.com/about"

# /robots.txt
Cache-Control: public, max-age=3600
Content-Type: text/plain; charset=UTF-8

# /sitemap.xml
Cache-Control: public, max-age=3600
Content-Type: application/xml

# main-*.js (regression)
Cache-Control: no-cache, must-revalidate
```

## Unexpected Interactions

1. **express.static directory redirect** -- documented above; resolved via `redirect: false`.
2. **<app-root tag form** -- Phase 215's prerender carries `ng-version` and `ng-server-context` attributes on the `<app-root` opener, so the dashboard-shell assertion uses `<app-root` (no closing `>`) instead of `<app-root>`.
3. **Express mime DB for .xml** -- the running version emits `Content-Type: application/xml` with no charset suffix (the README and CONTEXT.md mention `application/xml; charset=utf-8`). Verifier accepts `(application|text)/xml` to remain portable across mime versions.
4. **Phase 215 D-18 dashboard exclusion** -- /dashboard has no per-route canonical because Phase 215 deliberately omitted one (D-18). SRV-02-A asserts the absence rather than the presence.

## htmlRedirects Untouched

The legacy `.html` -> clean URL 301 map at server.js:86-95 remains exactly as Plan 01 wired it. `/about.html` still redirects to `/about`, then the new custom middleware serves the prerendered `about/index.html`. Two-step round trip, but stable for any links pointing at the legacy URLs.

## Threat Model Adherence

- **T-216-01 (Spoofing / Information Disclosure: SPA shadow on crawler files):** mitigated. `marketingRoutes` is a Set-backed exact-match check; crawler files (.txt/.xml) are served by express.static earlier in the pipeline; verify-server.sh step 15 explicitly grep-asserts `<html` and `<app-root` are NOT in the body of any crawler file. Run output confirms.
- **T-216-02 (Tampering: future /dashboard/settings silently treated as SPA):** mitigated. D-10 exact-match documented inline; verify-server.sh SRV-02-B asserts `/dashboard/foo` returns 404. Adding subroutes is an explicit edit to the middleware.
- **T-216-T1 (Tampering: path traversal via req.path):** accepted. Express URL parser rejects `..` segments; marketingRoutes Set.has() exact-match prevents traversal segments from reaching `path.join`.
- **T-216-D1 (DoS: misconfigured Cache-Control on .html breaks dashboard hot-update):** mitigated. SRV-03-E regression check asserts main-*.js retains `no-cache, must-revalidate`; the .js/.css/.html branch is preserved byte-for-byte.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking issue] express.static directory redirect intercepted /about**
- **Found during:** Task 2 smoke verification (first curl of /about returned 301 -> /about/ instead of route-specific HTML).
- **Issue:** Default `redirect: true` in `express.static` 301-redirected `/about` to `/about/` (because `staticPath/about/` exists as a directory) before the custom middleware could serve `about/index.html`.
- **Fix:** Added `redirect: false` to the express.static options block, with an inline traceability comment citing Phase 216 SRV-01 / D-09. The custom middleware now handles marketing routes via explicit `path.join(staticPath, dir, 'index.html')` lookup.
- **Files modified:** server/server.js (lines 100-103 added inside express.static options).
- **Commit:** `819b779` (rolled into the Task 2 commit because the fix is part of the same SRV-01 wiring).

The plan's `<action>` block explicitly anticipated Express-default surprises and authorized inline mitigation: "If the plan executor finds Express defaults to a different status, add an explicit ... AFTER the middleware". This fix follows that escape hatch.

## Self-Check: PASSED

Verified after writing this SUMMARY:

- `server/server.js` -- FOUND, contains `Phase 216 SRV-03`, `marketingRoutes = new Set`, `Phase 216 SRV-01 / SRV-02 / D-09 / D-10`, `redirect: false`
- `node -c server/server.js` -- exits 0 (syntax clean)
- `! grep -q "app.get(\['/', '/about', '/dashboard'" server/server.js` -- old block fully removed
- `.planning/phases/216-crawler-root-files-express-wiring-production-validation/verify-server.sh` -- FOUND, executable
- Commit `6fdb972` -- FOUND in git log (`feat(216-03): extend express.static setHeaders with .txt/.xml Cache-Control`)
- Commit `819b779` -- FOUND in git log (`feat(216-03): replace SPA fallback with marketingRoutes middleware`)
- Commit `7c93399` -- FOUND in git log (`test(216-03): add verify-server.sh asserting SRV-01/02/03 + T-216-01`)
- `bash verify-server.sh` -- exits 0 with `ALL PASSED`; trap cleanup runs (no orphan node processes after the run, verified via `pgrep -fl "node server/server.js"`)
- `bash verify.sh` (umbrella) -- exits 0 with `ALL AVAILABLE ASSERTIONS PASSED`; chains verify-static.sh + verify-prebuild.sh + verify-server.sh
