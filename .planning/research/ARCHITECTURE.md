# Architecture Research -- v0.9.46 Site Discoverability (SEO + GEO)

**Domain:** Angular 19 SPA + Express static host -- prerender / per-route metadata / crawler files integration
**Researched:** 2026-04-30
**Confidence:** HIGH (verified against Angular v19 prerender docs + direct read of repo wiring)

## Executive Summary

This is an **integration architecture**, not a greenfield design. The existing Angular 19 + Express + Fly.io stack already has every hook the milestone needs:

- `@angular/build:application` builder supports prerender natively in v19 (no Universal needed for static marketing pages).
- `angular.json` already globs `showcase/angular/public/**/*` to dist root and `showcase/assets/**/*` to `dist/.../assets/`, so root crawler files have a zero-config home.
- `express.static(staticPath, ...)` is registered BEFORE the SPA fallback, so any prerendered `about/index.html` is served by static middleware automatically -- the SPA fallback only fires when static misses.
- The catch-all SPA fallback is currently scoped (`['/', '/about', '/dashboard', '/privacy', '/support']`), not global `app.get('*')`, so it already coexists cleanly with future static prerender output.

The minimal-disruption integration is: (1) enable prerender in `angular.json`, (2) inject `Title`/`Meta` per route component, (3) drop crawler root files into `showcase/angular/public/`, (4) tweak the Express SPA fallback to prefer per-route `index.html` over the root.

## Existing System Map (file:line)

```
showcase/angular/angular.json:35-50          assets globs (public/ + ../assets/ -> dist)
showcase/angular/angular.json:22-27          builder + outputPath base/browser
showcase/angular/src/index.html:5            <title>FSB</title>          <-- single static title today
showcase/angular/src/index.html:6            <base href="/">              <-- required for prerender
showcase/angular/src/app/app.routes.ts:3-10  5 lazy routes; '**' redirectTo ''
showcase/angular/src/app/app.config.ts:5-10  provideRouter(routes), no provideClientHydration yet
showcase/angular/src/main.ts:5               bootstrapApplication              <-- prerender hook target
server/server.js:73-83                       staticPath resolution (public OR dist)
server/server.js:86-95                       legacy .html -> clean URL 301 redirects
server/server.js:97-108                      express.static (cache headers)
server/server.js:110-117                     SCOPED SPA fallback (5 routes)         <-- patch target
```

## Standard Architecture (Post-Integration)

```
+--------------------------------------------------------------------------+
|                      BUILD TIME (npm run build)                          |
+--------------------------------------------------------------------------+
|   src/index.html  --+                                                    |
|                     |                                                    |
|   app.routes.ts  ---+--> @angular/build:application (prerender: true)    |
|                     |                                                    |
|   *Page.component --+                                                    |
|                     v                                                    |
|        +-----------------------------+                                   |
|        | Prerender executes routes,  |  ngOnInit fires; Title/Meta       |
|        | invokes appConfig, runs     |  services write into <head> of    |
|        | each component to ngOnInit, |  the captured HTML snapshot.      |
|        | serializes DOM to HTML      |                                   |
|        +--------------+--------------+                                   |
|                       v                                                  |
|   public/  --+        dist/showcase-angular/browser/                     |
|   robots.txt |        +-- index.html              (route '')             |
|   sitemap.xml+------> +-- about/index.html        (route 'about')        |
|   llms.txt   |        +-- privacy/index.html      (route 'privacy')      |
|   llms-full  |        +-- support/index.html      (route 'support')      |
|              |        +-- robots.txt              (from public/)         |
|              |        +-- sitemap.xml             (from public/)         |
|              |        +-- llms.txt, llms-full.txt (from public/)         |
|              |        +-- assets/                 (from ../assets/)      |
|              |        +-- main-<hash>.js, *.css                          |
+--------------------------------------------------------------------------+
                                  |
                                  v
+--------------------------------------------------------------------------+
|                  REQUEST TIME (Fly.io / Express)                         |
+--------------------------------------------------------------------------+
|  GET /robots.txt                                                         |
|     -> express.static finds dist/browser/robots.txt   [HIT, served]      |
|                                                                          |
|  GET /about                                                              |
|     -> express.static checks /about (no extension)    [default index]    |
|     -> express.static checks /about/index.html        [HIT, served]      |
|        (express.static index option defaults to 'index.html'; this       |
|         normally would resolve. BUT the scoped fallback at line 111      |
|         is registered for /about and would take over if static misses    |
|         for any reason. Patch makes the fallback prerender-aware.)       |
|                                                                          |
|  GET /dashboard                                                          |
|     -> /dashboard EXCLUDED from prerender list, no per-route file.       |
|     -> express.static misses; SPA fallback serves root index.html        |
|        (same as today -- /dashboard remains live SPA shell).             |
+--------------------------------------------------------------------------+
```

## Component Responsibilities (Integration Touch Points)

| Component | Existing Responsibility | New Responsibility | File:Line |
|-----------|-------------------------|--------------------|-----------|
| `angular.json` build target | Bundle, asset glob | Add `prerender` block under build options | `showcase/angular/angular.json:23-54` |
| `app.routes.ts` | 5 lazy routes | Unchanged. Source of truth for explicit prerender route list | `showcase/angular/src/app/app.routes.ts:3-10` |
| `app.config.ts` | `provideRouter`, zone config | Optional: `provideClientHydration()` if any client-side state needs preserving across hydration. Not required for static marketing pages. | `showcase/angular/src/app/app.config.ts:5-10` |
| `index.html` | Hard-coded `<title>FSB</title>` | Drop or keep as fallback; per-route Title service overrides at render time | `showcase/angular/src/index.html:5` |
| `*-page.component.ts` (5 files) | Lazy route view | Inject `Title`, `Meta`; call in `ngOnInit` (or constructor for prerender) | NEW behavior in existing files |
| `showcase/angular/public/` | Asset glob source (icons today) | Host `robots.txt`, `sitemap.xml`, `llms.txt`, `llms-full.txt` | NEW files |
| `server/server.js` static | `express.static(staticPath)` cache headers | Unchanged | `server/server.js:97-108` |
| `server/server.js` SPA fallback | `app.get(['/','/about',...])` -> root `index.html` | Prefer `staticPath/<route>/index.html` if present; fall back to root for `/dashboard` | `server/server.js:110-117` |

## Recommended Integration Layout

```
showcase/
  angular/
    angular.json                  [MOD] add "prerender" block under build options
    src/
      index.html                  [MOD] drop hard-coded <title>; keep <base href="/">
      app/
        app.config.ts             [MAYBE] add provideClientHydration() (optional)
        app.routes.ts             [UNCHANGED]
        pages/
          home/home-page.component.ts        [MOD] Title/Meta + JSON-LD (Org + SoftwareApplication)
          about/about-page.component.ts      [MOD] Title/Meta + canonical
          privacy/privacy-page.component.ts  [MOD] Title/Meta + canonical
          support/support-page.component.ts  [MOD] Title/Meta + canonical
          dashboard/dashboard-page.component.ts [MOD] noindex meta only; NOT prerendered
    public/                       [NEW FILES, glob already configured]
      robots.txt
      sitemap.xml
      llms.txt
      llms-full.txt
server/
  server.js                       [PATCH] SPA-fallback handler (see Pattern 4 below)
```

### Why this layout

- **`public/` not `../assets/`:** root crawler files MUST live at site root, not under `/assets/`. The `public/` glob in `angular.json:36-39` (`{glob: "**/*", input: "public"}` with no `output:` field) outputs to `browser/` root. The `../assets/` glob (`angular.json:40-44`) writes to `browser/assets/` due to its explicit `"output": "assets"`. Wrong location for crawler files.
- **No new components:** Title/Meta injection happens inside the existing 5 page components. Angular's built-in `Title` and `Meta` services from `@angular/platform-browser` are sufficient for v0.9.46.
- **JSON-LD as inline `<script type="application/ld+json">`:** add via direct DOM injection in component `ngOnInit`, OR introduce a tiny `MetaService` helper. Either is a 5-line helper, not a new architectural layer. Recommend inline for v0.9.46 -- only one route (`/`) needs JSON-LD per scope.

## Architectural Patterns

### Pattern 1: Static Prerender via `@angular/build:application`

**What:** Angular 19's unified `@angular/build:application` builder supports prerender as a build-time option. It boots the app inside Node, resolves each route from `app.routes.ts`, executes the component lifecycle through `ngOnInit`, snapshots the resulting DOM, and writes one HTML file per route.

**When to use:** Marketing routes with stable content. Perfect for FSB's `/`, `/about`, `/privacy`, `/support`. NOT for `/dashboard` (auth, runtime state, WebSocket).

**Trade-offs:**
- Pro: zero Express/Universal runtime overhead; output is plain HTML; works on any static host or with `express.static`.
- Pro: prerender executes the same Angular code that runs in the browser, so Title/Meta injected in `ngOnInit` lands in the served HTML.
- Con: prerender is build-time. Sitemap and content updates require a redeploy.
- Con: prerender does NOT wait indefinitely for async observables. For FSB's static marketing pages this doesn't matter -- all metadata is static strings.

**`angular.json` minimal patch (under `architect.build.options`):**
```json
"prerender": {
  "discoverRoutes": false,
  "routes": ["/", "/about", "/privacy", "/support"]
}
```
Explicit `routes` list excludes `/dashboard` and avoids `discoverRoutes` crawling the `'**'` redirect entry in `app.routes.ts:9`.

### Pattern 2: Per-Route Title/Meta Injection

**What:** Inject `Title` and `Meta` from `@angular/platform-browser` in each page component's constructor or `ngOnInit`. Prerender executes through `ngOnInit`, so writes to `<head>` are captured in the snapshot.

**When to use:** Always, for every prerendered route. Without it, every route gets the same `<title>FSB</title>` from `src/index.html:5`.

**Critical detail re: prerender lifecycle:**
- Prerender **does** wait for `ngOnInit` synchronous code.
- Prerender **does** execute inside Angular's injection context (component DI works normally).
- `runInInjectionContext` is NOT required for component-scoped DI. It's only needed if you call DI from outside an injection context (e.g., a top-level function). Title/Meta services are constructor-injected in components, so the standard pattern applies.
- Prerender does NOT wait indefinitely for async observables. All FSB metadata is synchronous strings -- no awaits needed.

**Example (home-page.component.ts):**
```typescript
import { Component, OnInit, inject } from '@angular/core';
import { Title, Meta } from '@angular/platform-browser';

@Component({ /* ... */ })
export class HomePageComponent implements OnInit {
  private title = inject(Title);
  private meta = inject(Meta);

  ngOnInit() {
    this.title.setTitle('FSB - Full Self-Browsing AI Browser Automation');
    this.meta.updateTag({ name: 'description', content: '...' });
    this.meta.updateTag({ property: 'og:title', content: 'FSB' });
    this.meta.updateTag({ name: 'twitter:card', content: 'summary_large_image' });
    // canonical link via Meta service or direct head manipulation
    this.meta.updateTag({ rel: 'canonical', href: 'https://full-selfbrowsing.com/' }, "rel='canonical'");
  }
}
```

**JSON-LD pattern (one-time, on `/`):**
```typescript
ngOnInit() {
  // ...title/meta...
  const ld = document.createElement('script');
  ld.type = 'application/ld+json';
  ld.textContent = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'FSB',
    /* ... */
  });
  document.head.appendChild(ld);
}
```
During prerender this runs against the synthetic DOM and is serialized into the static HTML output.

### Pattern 3: Crawler Files as Public Static Assets

**What:** Place `robots.txt`, `sitemap.xml`, `llms.txt`, `llms-full.txt` under `showcase/angular/public/`. The existing `angular.json:36-39` glob copies them to `dist/showcase-angular/browser/` root unchanged.

**When to use:** Always for root-level crawler files. Never use `showcase/assets/` -- that glob has `"output": "assets"`, which is the wrong URL path.

**Trade-offs:**
- Pro: zero server changes. `express.static(staticPath)` (server/server.js:98) finds and serves them with correct content-type before any SPA fallback can intercept.
- Pro: no MIME-type issues -- `.txt` and `.xml` are recognized by Express's built-in `mime` lookup.
- Con: hand-maintained sitemap requires a redeploy on route changes. With 5 routes (4 prerendered + dashboard) and low churn, this is the right trade.

### Pattern 4: SPA Fallback That Prefers Per-Route Prerender

**What:** Update the catch-all so it serves `staticPath/<route>/index.html` when present, else falls back to root `index.html`. This preserves `/dashboard` SPA behavior.

**When to use:** Whenever you mix prerendered routes with SPA-only routes in the same Express server.

**Why this matters even though `express.static` would normally find `/about/index.html` automatically:**

The current handler at `server/server.js:111-117` is registered for `['/','/about','/dashboard','/privacy','/support']` and returns the root `index.html` unconditionally. Express middleware order (server.js:97 static, then 111 SPA fallback) means: `express.static` is tried FIRST. Express's `serveStatic` `index` option defaults to `'index.html'`, so `/about` -> `/about/index.html` IS resolved automatically when present. **However**, when static cannot find it (e.g., `/dashboard` is excluded from prerender), the explicit handler at line 111 catches the request. The patch below makes the explicit handler ALSO prerender-aware as a defensive measure -- so even if static-middleware behavior shifts (e.g., a future express upgrade) the fallback still serves the right HTML.

**Minimal patch (server/server.js:110-117):**
```javascript
// SPA fallback -- prefer per-route prerendered HTML, fall back to root index.html for SPA-only routes
app.get(['/', '/about', '/dashboard', '/privacy', '/support'], (req, res) => {
  if (!staticPath) {
    res.status(503).type('text/plain')
       .send('Showcase build not found. Run `npm --prefix showcase/angular run build` first.');
    return;
  }
  // Prefer prerendered per-route index.html (e.g., /about/index.html)
  if (req.path !== '/') {
    const perRoute = path.join(staticPath, req.path, 'index.html');
    if (fs.existsSync(perRoute)) {
      return res.sendFile(perRoute);
    }
  }
  // Fall back to root index.html (SPA shell -- /dashboard, '/' if not prerendered, etc.)
  res.sendFile(path.join(staticPath, 'index.html'));
});
```

**Why minimal:**
- Preserves the 503 guard for missing builds (server.js:112-115).
- Preserves `/` behavior (root `index.html` serves whether or not `/` is prerendered, since prerendered `/` writes to root `index.html` already).
- Preserves `/dashboard` SPA behavior: if `/dashboard/index.html` is not in dist (because we excluded it from prerender), `fs.existsSync` returns false and we fall through to root `index.html` -- same as today.
- `fs.existsSync` is sync and runs in-process; the prerender output set is small (4 paths). For a stricter perf posture, build a `Set` at startup and check membership -- documented as a deferred optimization, not required for v0.9.46.
- `fs` is already required at `server/server.js:75`, so no new imports.

## Data Flow

### Build-Time Flow (new)

```
npm --prefix showcase/angular run build
   |
   v
@angular/build:application reads angular.json
   |
   +-- bundles main.ts, lazy chunks, styles
   |
   +-- copies assets per glob:
   |     public/**/*       -> browser/                 (no output prefix)
   |     ../assets/**/*    -> browser/assets/          (output: "assets")
   |
   +-- if prerender.routes set:
   |       for each route in [/, /about, /privacy, /support]:
   |          boot app, navigate, run ngOnInit (Title/Meta/JSON-LD writes)
   |          serialize DOM -> browser/<route>/index.html
   |
   v
dist/showcase-angular/browser/  (includes robots.txt, sitemap.xml, llms.txt, llms-full.txt verbatim)
```

### Request-Time Flow (post-patch)

```
Cloudflare/Fly edge -> Express :3847
   |
   v
[server.js:41]  request logger
   |
   v
[server.js:53-66] /api/* routers          -- short-circuit for API
   |
   v (non-API)
[server.js:93]  htmlRedirects /about.html -> 301 /about
   |
   v
[server.js:98]  express.static(staticPath)
   - finds robots.txt, sitemap.xml, llms*.txt at root: SERVE
   - finds /about/index.html via default index resolution: SERVE
   - finds /assets/icon48.png: SERVE
   - misses /dashboard (no /dashboard/index.html in dist): NEXT
   |
   v
[server.js:111 patched] SPA fallback (5 routes)
   - /dashboard: existsSync(/dashboard/index.html) = false -> root index.html (SPA shell)
   - / : root index.html (already prerendered as root)
   |
   v
[server.js:120] error handler
```

## Suggested Build Order (Phase Sequencing)

The milestone has natural data-dependency ordering. **Build prerender first, then JSON-LD, then Express patch, then crawler files.**

| Phase Order | Phase | Why this order | Dependencies |
|-------------|-------|----------------|--------------|
| **1** | **Prerender enablement + per-route Title/Meta** | Prerender output is the foundation. Without it, sitemap entries point at empty `<app-root>` shells and AI crawlers see nothing. JSON-LD also requires prerendered HTML to land in the snapshot. Doing this first means every subsequent phase can verify against real prerendered HTML in `dist/.../browser/about/index.html`. | None (only repo). |
| **2** | **JSON-LD structured data** | Adds Organization + SoftwareApplication blocks via `ngOnInit` DOM injection. Verifies in `view-source` of prerendered HTML. | Requires phase 1 (prerender executes the `ngOnInit` that writes JSON-LD). |
| **3** | **Express SPA-fallback patch** | Once per-route HTML exists in dist, the patch becomes meaningful. If you patch first with no prerender output, the patch is a no-op AND you can't verify it works. | Requires phase 1 (per-route files must exist for `existsSync` to ever return true). |
| **4** | **Crawler root files (`robots.txt`, `sitemap.xml`, `llms.txt`, `llms-full.txt`)** | Sitemap MUST point at canonical URLs. `llms.txt` should reference real prerendered content. Building these last means each `<url>` entry is verified against an actual file. | Requires phase 1 for sitemap entry validation; soft-depends on phase 3 for the smoke test (`curl /about` returns prerendered HTML). |

**Reasoning against doing crawler files first:** A `sitemap.xml` shipped before prerender is a sitemap of empty shells. AI crawlers fetch the sitemap, follow URLs, get HTML with empty `<app-root>`, and the discoverability problem is unchanged. The whole point of v0.9.46 is non-JS crawler visibility -- sitemap is the LAST link in the chain, not the first.

**Reasoning against doing the Express patch first:** The patch is defensive (preserves `/dashboard`). It can be written and tested independently, but verifying it requires per-route files in dist. So it pairs naturally with phase 3 once prerender output exists. Phases 1 and 3 can also be combined into a single phase if the orchestrator prefers fewer phase boundaries -- they touch different files and don't conflict.

## Sitemap Strategy: Static File vs Build-Step Generator

**Recommendation: hand-maintained static file in `showcase/angular/public/sitemap.xml`.**

| Criterion | Static (recommended) | Generated |
|-----------|----------------------|-----------|
| Route count | 5 routes (4 in sitemap, dashboard noindex) -- trivially manageable | overkill |
| Churn | Marketing routes are extremely stable; new routes happen at milestone cadence (~monthly) | overkill |
| Build complexity | Zero -- file is in `public/`, glob copies it | New build script, new package.json target, new failure mode |
| Verification | grep + eyeball | Requires running the script |
| Future-proofing | If we add comparison pages (`/vs-mariner`) deferred per PROJECT.md:25-26, hand-edit one file once | Generator pays off if route count exceeds ~20 or `getPrerenderParams`-style dynamic routes are introduced |

**Trigger to revisit:** if comparison pages or FAQ land (currently deferred per PROJECT.md:25-26) and route count crosses ~15-20, write a generator that reads `app.routes.ts` and emits `sitemap.xml` to `showcase/angular/public/` as a `prebuild` npm script. Until then, static file is the right call.

## Anti-Patterns

### Anti-Pattern 1: Putting crawler files in `../assets/` (`showcase/assets/`)

**What people do:** Drop `robots.txt` in `showcase/assets/` because that's where icons live.
**Why it's wrong:** `angular.json:40-44` globs `../assets/**/*` to `output: "assets"`, producing `browser/assets/robots.txt` -- which is reachable at `/assets/robots.txt`, not `/robots.txt`. Crawlers only check site root.
**Do this instead:** Put crawler root files in `showcase/angular/public/`. That glob (`angular.json:36-39`) has no `output:` prefix, so files land at dist root.

### Anti-Pattern 2: Setting Title/Meta in app.component.ts

**What people do:** Centralize title/meta in `AppComponent.ngOnInit` with a giant route-to-title map keyed by URL.
**Why it's wrong:** During prerender, `AppComponent` constructs once but Angular renders different child components per route. A central map duplicates the routing logic that already exists in `app.routes.ts`. Worse, prerender may snapshot before the route's child component has resolved its title write.
**Do this instead:** Each page component owns its own metadata in its own `ngOnInit`. Co-located with the page content, no central registry.

### Anti-Pattern 3: Replacing the SPA fallback with `app.get('*')`

**What people do:** Convert `app.get(['/','/about',...])` to `app.get('*')` for "future-proofing."
**Why it's wrong:** Wildcard catches `/api/*` if API routers don't fully consume the request, and it catches arbitrary URLs that should 404. The current scoped allowlist is a feature, not a limitation.
**Do this instead:** Keep the scoped list at server.js:111. Add new routes to the allowlist explicitly when added to `app.routes.ts`. The patch above preserves this discipline.

### Anti-Pattern 4: Prerendering `/dashboard`

**What people do:** Add `/dashboard` to the prerender route list so "everything is consistent."
**Why it's wrong:** `/dashboard` is the live remote-control surface (Phase 209-211: WebSocket, QR pairing, DOM stream). Prerendering produces a snapshot HTML that confuses runtime hydration of the dashboard's stateful UI, and SEO is irrelevant for an auth-walled control surface.
**Do this instead:** Explicit `prerender.routes` list in `angular.json` excludes `/dashboard`. Add `<meta name="robots" content="noindex">` in `dashboard-page.component.ts` `ngOnInit` for belt-and-suspenders coverage.

### Anti-Pattern 5: Globbing `discoverRoutes: true` for prerender

**What people do:** Let the builder discover routes from `app.routes.ts` automatically.
**Why it's wrong:** Discovery includes the `'**'` wildcard redirect entry (`app.routes.ts:9`) and lazy-chunk paths in confusing ways. With only 5 routes, explicit is clearer and prevents accidental `/dashboard` prerender.
**Do this instead:** `discoverRoutes: false` + explicit `routes: ["/", "/about", "/privacy", "/support"]`.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| AI crawlers (GPTBot, ClaudeBot, PerplexityBot, Google-Extended) | Static `robots.txt` Allow rules at `/robots.txt` | Zero runtime cost; bot identification is by User-Agent on their side |
| Search engines (Googlebot, Bingbot) | Static `sitemap.xml` referenced from `robots.txt`'s `Sitemap:` directive | Hand-maintained file, 4 entries |
| Fly.io edge | Existing `force_https`, single region SJC | No changes needed; static files cache via Express headers (server.js:101-106) |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `angular.json` -> `@angular/build:application` | Build config | New `prerender` block; assets globs unchanged |
| Page component -> `@angular/platform-browser` (`Title`, `Meta`) | DI inject | Standard injection context; no `runInInjectionContext` needed |
| `prerender` runtime -> component `ngOnInit` | Lifecycle | Synchronous Title/Meta writes captured in HTML snapshot; async work needs explicit await (not required for FSB v0.9.46) |
| `express.static` -> SPA fallback | Middleware order | Static at server.js:98 runs FIRST; fallback at server.js:111 runs only on miss; patch makes fallback prerender-aware as defense-in-depth |

## Confidence Notes

- **HIGH** on prerender output structure (`browser/<route>/index.html`): verified against [Angular v19 prerender docs](https://v19.angular.dev/guide/prerendering); v18 -> v19 retained the folder + `index.html` convention.
- **HIGH** on `angular.json` glob behavior: read the file directly; `public/**/*` with no `output:` writes to dist root, matches Angular CLI conventions.
- **HIGH** on Express middleware order and static-vs-fallback resolution: read `server/server.js:97-117` directly. Current scoped fallback is intentional and the patch preserves its semantics.
- **HIGH** on Title/Meta injection during prerender: Angular's prerender runs `ngOnInit` inside the standard component injection context; this is documented behavior of `@angular/build:application`.
- **MEDIUM** on JSON-LD via direct `document.createElement` during prerender: works because prerender runs in a DOM-emulated environment, but if Angular ever swaps to a stricter platform, switch to `Renderer2` or pre-define in component template via `[innerHTML]` with `DomSanitizer.bypassSecurityTrustHtml`. For v0.9.46 the simple approach is fine.
- **MEDIUM** on `provideClientHydration()` necessity: not required for static prerender (no hydration-of-server-state needed), but adding it future-proofs if the team later moves to true SSR. Not required for v0.9.46 scope.

## Sources

- [Build-time prerendering -- Angular v19 docs](https://v19.angular.dev/guide/prerendering)
- [Server-side and hybrid-rendering -- Angular](https://angular.dev/guide/ssr)
- [What's new in Angular 19.0 -- Ninja Squad](https://blog.ninja-squad.com/2024/11/19/what-is-new-angular-19.0)
- Local file: `showcase/angular/angular.json` (assets globs lines 35-50, builder config 22-77)
- Local file: `server/server.js` (static + fallback lines 73-117)
- Local file: `showcase/angular/src/app/app.routes.ts` (route table)
- Local file: `showcase/angular/src/index.html` (current static head)
- Local file: `.planning/PROJECT.md` (milestone scope, lines 11-30)

---
*Architecture research for: v0.9.46 Site Discoverability (SEO + GEO) integration*
*Researched: 2026-04-30*
