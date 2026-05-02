# Requirements: FSB v0.9.48 Angular 20 Migration

**Defined:** 2026-05-02
**Deadline:** 2026-05-19 (Angular 19 EOL — 17 days from start)
**Core Value:** Reliable single-attempt execution — the AI decides correctly, the mechanics execute precisely

## Milestone Goal

Migrate the showcase Angular project (`showcase/angular/`) from Angular 19 to Angular 20 before the 2026-05-19 EOL. All v0.9.46 SEO/GEO surfaces must continue to work post-migration: per-route prerender of `/`, `/about`, `/privacy`, `/support`; route-specific titles, canonicals, OG/Twitter meta; Organization + SoftwareApplication JSON-LD; `/dashboard` SPA shell with runtime `noindex`; `robots.txt`, `sitemap.xml`, `llms.txt`, `llms-full.txt` at the apex; Express SPA-fallback in `showcase/server/`. Production deploy to fly.io continues to work.

## Already Validated (counted toward this milestone)

None. v0.9.48 is a greenfield migration — no prior phase landed any of these requirements.

## v1 Requirements (in scope for v0.9.48)

### Mechanical Upgrade (UPG)

- [ ] **UPG-01**: `npm --prefix showcase/angular install @angular/cli@20 @angular/core@20` (and the rest of the `@angular/*` packages) succeeds; `package.json` `@angular/*` versions all reflect `^20.x` with no peer-dep warnings that would fail CI.
- [ ] **UPG-02**: `npx --prefix showcase/angular ng update @angular/cli @angular/core` runs the v19 → v20 schematic suite to completion; any required code mods (control-flow, standalone API, signal helpers, etc.) land in the same commit as the schematic output.
- [ ] **UPG-03**: TypeScript version meets Angular 20's minimum (currently `~5.6` in 19; v20 typically requires `~5.7+`). `package.json` `typescript` devDependency is updated to satisfy the v20 peer constraint.
- [ ] **UPG-04**: Node engine: `package.json` `engines.node` (or root) is verified at >=20.x; Node 20 is what CI already uses.
- [ ] **UPG-05**: `zone.js` stays in dependencies (NOT migrating to zoneless in this milestone — zoneless adoption is deferred to a future milestone). Dependency bumped to whatever version Angular 20 schematics select.

### Build & Prerender Continuity (BLD)

- [ ] **BLD-01**: `npm --prefix showcase/angular run build` exits 0 and emits `dist/showcase-angular/browser/{,about,privacy,support}/index.html` (per Phase 215 PRE-05 contract, unchanged). `dist/showcase-angular/browser/dashboard/index.html` still does NOT exist.
- [ ] **BLD-02**: `angular.json` `outputMode: "static"` semantics still apply (or whatever Angular 20 calls the equivalent — if the key was renamed, update accordingly so the build emits per-route HTML).
- [ ] **BLD-03**: `provideServerRouting` (Phase 215-01) continues to drive prerender; if Angular 20 renamed/replaced this API, migrate to the v20 equivalent in `app.config.server.ts` so the same four routes prerender.
- [ ] **BLD-04**: `showcase/angular/prebuild` script (`build-crawler-files.mjs`) still runs and regenerates `sitemap.xml`, `llms-full.txt`, `version.ts` (CRAWL-05 from v0.9.46). Build output unchanged.
- [ ] **BLD-05**: `showcase/angular/scripts/smoke-crawler.mjs` still runs against a local SSR server and against production with `BASE_URL` (Phase 216 contract preserved).

### SSR / Express Integration (SSR)

- [ ] **SSR-01**: `showcase/angular/src/server.ts` (Angular 20-shape) continues to wire the Express adapter so `node showcase/dist/showcase-angular/server/server.mjs` boots a server that serves prerendered routes + dashboard SPA fallback.
- [ ] **SSR-02**: `showcase/server/server.js` (Express + SQLite deploy backend, post-Phase-219) continues to serve `dist/showcase-angular/browser/*` correctly. No changes required if the Angular dist output structure is unchanged; if Angular 20 changed the dist layout, update the Express static-path config accordingly.
- [ ] **SSR-03**: Production smoke after deploy: `curl -A GPTBot https://full-selfbrowsing.com/` returns prerendered HTML with non-empty `<app-root>` (re-verifies SMOKE-01); same for `/about`, `/privacy`, `/support`; same for `/robots.txt`, `/sitemap.xml`, `/llms.txt`, `/llms-full.txt`.

### Structured Data Continuity (LD)

- [ ] **LD-01**: `Organization` JSON-LD (baked into `src/index.html`) is unchanged in the Angular 20 build output — same payload, same `@id`, same shape.
- [ ] **LD-02**: `SoftwareApplication` JSON-LD on home (injected via `Renderer2` in `home-page.component.ts`) is unchanged. The `Renderer2`-based DOM injection pattern must continue to work in Angular 20.
- [ ] **LD-03**: Google Rich Results Test on the deployed home URL still detects exactly one Organization + exactly one SoftwareApplication block with zero errors (manual UAT, post-deploy).

### Per-Route Metadata Continuity (META)

- [ ] **META-01**: Route-specific `Title.setTitle` + `Meta.updateTag` calls in each route component (Home, About, Privacy, Support) continue to emit unique titles + descriptions in the prerendered HTML.
- [ ] **META-02**: Canonical `<link>` injection via `DOCUMENT` token + `Renderer2` (Phase 215-02 pattern) still works — prerendered HTML has route-specific canonical hrefs.
- [ ] **META-03**: OpenGraph + Twitter Card tags continue to emit per route.
- [ ] **META-04**: `/dashboard` runtime `noindex,nofollow` via `Meta.updateTag` in `ngOnInit` continues to work.

### CI / Tests (CI)

- [ ] **CI-01**: `npm --prefix showcase/angular install` + `npm --prefix showcase/angular run build` continue to work in CI; existing `showcase` job in `ci.yml` is unchanged unless Angular 20 requires a different invocation.
- [ ] **CI-02**: Existing root `npm test`, `npm run validate:extension`, `npm run test:mcp-smoke` are unaffected by the Angular upgrade — all pass post-migration.
- [ ] **CI-03**: All four CI jobs go green on the milestone PR (`extension`, `mcp`, `showcase`, `all-green`).

### Validation (VAL)

- [ ] **VAL-01**: All v0.9.46 SEO/GEO automated assertions in `smoke-crawler.mjs` (46 assertions) still pass against the post-migration production deploy.
- [ ] **VAL-02**: Visual smoke of `https://full-selfbrowsing.com/` post-deploy: home page renders, theme bootstrap works, navigation between routes works, dashboard route loads (manual UAT).
- [ ] **VAL-03**: Lighthouse-style sanity: home page returns a populated DOM in <3s on a typical connection; no obvious regressions in load behavior. (Spot-check, not a regression suite.)

## Future Requirements (deferred to v0.9.49+)

These items were considered but explicitly NOT selected for v0.9.48:

- **ZONELESS-01**: Migrate to Angular 20 zoneless mode (`provideExperimentalZonelessChangeDetection` or equivalent stable API). Defer to a future milestone — touching change detection during a major-version migration multiplies risk.
- **CRAWL-FUTURE-01**: Per-route OG images (carried from v0.9.46).
- **DISCO-FUTURE-01..05**: FAQ page, comparison pages, off-page push, GSC + Bing Webmaster registration (carried from v0.9.46).

## Out of Scope (explicit exclusions)

- **Zoneless change detection** — see above.
- **Migrating from RxJS to signals everywhere** — Angular 20 makes signals more attractive but the showcase's existing reactive surface is small and stable; bulk rewrites are out of scope.
- **Replacing `@angular/build` with a different bundler** — already on the modern esbuild-based builder; v20 keeps it.
- **Angular 21+ alpha/beta** — v20 stable only.
- **New features** — this is a maintenance migration only. No new pages, components, or content.
- **Refactoring the existing component tree** — minimum-change migration; only modify what `ng update` schematics or v20 breaking changes require.

## Known Tech Debt

- **Single-region Fly.io** — carried forward from v0.9.46; still tolerated.
- **Build-day `lastmod` in sitemap.xml** — carried forward.
- **`scripts/llms-full.source.md` hardcoded counts** — carried forward.
- **Cross-package import path** (`mcp/build` cp) — carried forward from v0.9.47.

## Traceability

| REQ-ID | Phase | Plan | Status |
|--------|-------|------|--------|
| UPG-01..05 | 221 | TBD | active |
| BLD-01..05 | 221 | TBD | active |
| SSR-01..03 | 221 (1-2), 222 (3) | TBD | active |
| LD-01..02 | 221 | TBD | active |
| LD-03 | 222 | TBD | active |
| META-01..04 | 221 | TBD | active |
| CI-01..03 | 221 | TBD | active |
| VAL-01..03 | 222 | TBD | active |

**Coverage:** 25/25 mapped. No orphans, no duplicates.

**Phase distribution (preliminary):**
- Phase 221 (Mechanical upgrade): UPG-01..05 (5), BLD-01..05 (5), SSR-01..02 (2), LD-01..02 (2), META-01..04 (4), CI-01..03 (3) = 21 reqs
- Phase 222 (Production verification): SSR-03 (1), LD-03 (1), VAL-01..03 (3) = 4 reqs (1 manual UAT)

---
*Defined: 2026-05-02*
