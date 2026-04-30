# Stack Research — v0.9.46 Site Discoverability (SEO + GEO)

**Domain:** Static prerender + crawler/AI-bot discoverability for an Angular 19 SPA marketing site served behind a custom Express on Fly.io
**Researched:** 2026-04-30
**Confidence:** HIGH (Angular configuration verified against angular.dev v19 docs; Express/Fly behaviour verified against current `server/server.js`)

---

## TL;DR

- Use Angular's first-party prerender path (`@angular/ssr` + `outputMode: "static"`) under the existing `@angular/build:application` builder. No Webpack-era packages, no full SSR runtime, no third-party prerender services.
- Add ONE devDependency (`@angular/ssr@^19.0.0`) and ONE small Node script in `showcase/angular/scripts/` that emits `sitemap.xml` and `llms.txt` / `llms-full.txt` into `public/` before `ng build`. No new framework, no new runtime.
- Express needs ONE focused change: stop serving the root `index.html` for routes that now have a real per-route `index.html` on disk (e.g. `dist/.../browser/about/index.html`). The broken piece is the explicit SPA-fallback handler at `server/server.js:111` which currently overrides the prerendered files. Replace it with a route-aware handler that prefers per-route prerendered HTML and falls back to the root `index.html` only for SPA routes (`/dashboard`).
- Set `Content-Type: text/plain; charset=utf-8` and a short `Cache-Control: public, max-age=3600` on `*.txt` and `Content-Type: application/xml; charset=utf-8` on `sitemap.xml`. No exotic headers needed. AI crawlers (GPTBot, ClaudeBot, PerplexityBot, Google-Extended) read these as plain HTTP files; they do not require auth, CORS, or custom headers.

---

## Recommended Stack

### Core Technologies (additions to existing stack)

| Technology | Version | Purpose | Why Recommended |
|---|---|---|---|
| `@angular/ssr` | `^19.0.0` (match existing `@angular/*` major) | Provides the prerender machinery wired into `@angular/build:application` (creates `main.server.ts`, `app.config.server.ts`, optional `server.ts`) | Verified in angular.dev v19 prerender guide as the supported path. The `prerender` build option is non-functional unless `@angular/ssr` is installed via `ng add`. This is the only first-party option for the modern (esbuild-based) `@angular/build:application` builder you already use. |
| `outputMode: "static"` (angular.json key, no package) | n/a (Angular 19 feature) | Tells the builder to emit pure static HTML per route at build time, with NO Node server entry generated for runtime SSR | Marketing routes (`/`, `/about`, `/privacy`, `/support`) are 100% static. AI crawlers (GPTBot/ClaudeBot/PerplexityBot) do not execute JS, so static HTML is exactly what they need. `static` mode means no runtime SSR cost on Fly, no Express integration churn -- the existing Express server keeps serving files from disk. |
| `@angular/router` route-aware `Title` + `Meta` services | already installed (`@angular/platform-browser` `^19.0.0`) | Per-route `<title>`, `<meta name="description">`, OG, Twitter, canonical -- captured into prerendered HTML at build time | Native, zero-dependency. `Meta` and `Title` mutations executed during route resolvers / `ngOnInit` are baked into prerendered HTML. No need for `@ngx-meta/core` or similar wrappers. |
| Build-time generator script (Node, native ESM) | n/a (one local file) | Emits `sitemap.xml`, `robots.txt`, `llms.txt`, `llms-full.txt` into the build assets pipeline | Routes are statically known (`app.routes.ts`). A small Node script reading those routes + a hand-curated content map is far simpler than `sitemap-generator-cli` or `angular-prerender`. Fewer deps = fewer supply-chain vectors. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---|---|---|---|
| `jsonld` (npm) | n/a — DO NOT install | Generate JSON-LD | Not needed. JSON-LD is just JSON inside `<script type="application/ld+json">`. Author it as a TypeScript constant in a service (e.g. `src/app/seo/structured-data.ts`) and inject via `Renderer2` or `Meta` at component init. The prerender step bakes the script tag into the HTML. |
| `xmlbuilder2` | `^3.x` | Build sitemap.xml | Optional. The sitemap is small (4-5 URLs). String templating in the build script is fine. Only reach for `xmlbuilder2` if the sitemap grows past ~20 URLs or needs `<image:image>` / `<news:news>` namespaces. |
| `schema-dts` | `^1.x` | TypeScript types for Schema.org JSON-LD shapes | Optional, type-safety only. Useful if you want compile-time checking that your `Organization` / `SoftwareApplication` JSON-LD shapes are well-formed. Adds zero runtime weight (types-only package). |

### Development Tools

| Tool | Purpose | Notes |
|---|---|---|
| `ng add @angular/ssr` | One-time scaffolding command that installs `@angular/ssr`, creates `src/main.server.ts`, `src/app/app.config.server.ts`, and `server.ts`, and edits `angular.json` to add `server`, `ssr`, `prerender` (and optionally `outputMode`) keys | Run this once. Then manually flip `outputMode` to `"static"` and (optionally) delete the generated `server.ts` -- Fly.io serves through the existing custom `server/server.js`, so the Angular-generated server file is unused. |
| Curl-based prerender smoke check | `curl -A "GPTBot" https://full-selfbrowsing.com/about \| head` to confirm the `<head>` contains real metadata and the `<body>` contains real content (not an empty `<app-root>`) | Add to release smoke checklist. This is the gate that fails today and must pass after the milestone. |

---

## Installation

```bash
# From showcase/angular/

# 1. Scaffold @angular/ssr (installs package, creates server bootstrap files,
#    edits angular.json to add prerender/server/ssr keys)
npx ng add @angular/ssr@^19

# 2. After ng add finishes, manually edit angular.json (see snippet below)
#    to set outputMode: "static" -- this is the lever that switches from
#    "build a Node SSR server" to "emit pure static HTML per route".

# No other npm installs required. The build-time sitemap/llms.txt generator
# is a local Node script in scripts/generate-discovery-files.mjs and uses
# only Node built-ins (fs, path, url).
```

---

## angular.json keys to add (verified against Angular 19 schema)

After `ng add @angular/ssr` runs, the `architect.build.options` block under `projects.showcase-angular` will gain server/prerender keys. Adjust them to match the static-only intent:

```jsonc
"build": {
  "builder": "@angular/build:application",
  "options": {
    "outputPath": {
      "base": "../dist/showcase-angular",
      "browser": "browser"
      // ng add will also add "server": "server" -- safe to leave; nothing reads it in static mode
    },
    "index": "src/index.html",
    "browser": "src/main.ts",
    "server": "src/main.server.ts",         // added by ng add
    "outputMode": "static",                  // KEY: emits pure static HTML, no Node SSR runtime
    "prerender": {
      "discoverRoutes": false,               // do NOT auto-discover -- /dashboard must stay SPA
      "routesFile": "prerender-routes.txt"
    },
    "ssr": {
      "entry": "src/server.ts"               // present after ng add; harmless in static mode (not invoked)
    },
    "polyfills": ["zone.js"],
    // ... existing assets / styles / tsConfig unchanged ...
  }
}
```

`prerender-routes.txt` (new file at `showcase/angular/prerender-routes.txt`) contains exactly:

```
/
/about
/privacy
/support
```

**Critical detail (verified):** `discoverRoutes: true` enumerates unparameterized `Routes` from `app.routes.ts`. The wildcard route (`path: '**'`) is ignored. But `/dashboard` IS unparameterized, so leaving discovery on would prerender it -- and that route depends on `chrome.storage`, runtime DOM streaming, and `dashboard-runtime-state.js`, which would produce broken HTML. Setting `discoverRoutes: false` + an explicit `routesFile` is the safer posture. PROJECT.md "Target features" line confirms: prerender `/`, `/about`, `/privacy`, `/support`; `/dashboard` stays SPA.

**Output layout (verified Angular 19 behaviour):** With `outputMode: "static"`, the build emits:

```
dist/showcase-angular/browser/
  index.html                      <- prerendered "/"
  about/index.html                <- prerendered "/about"
  privacy/index.html              <- prerendered "/privacy"
  support/index.html              <- prerendered "/support"
  main-<hash>.js, styles-<hash>.css, etc.
  assets/...
  sitemap.xml, robots.txt, llms.txt, llms-full.txt   <- copied via assets glob from public/
```

This is the layout `express.static` serves correctly without any code changes. The problem is the explicit SPA-fallback handler that currently OVERRIDES it.

---

## Express integration (`server/server.js` changes — minimal diff)

**Current code (server/server.js:97-117):**

```js
if (staticPath) {
  app.use(express.static(staticPath, { maxAge: 0, etag: true, setHeaders: ... }));
}

// SPA fallback -- serve Angular index.html for all showcase routes (per D-04)
app.get(['/', '/about', '/dashboard', '/privacy', '/support'], (req, res) => {
  if (!staticPath) { res.status(503).type('text/plain').send(...); return; }
  res.sendFile(path.join(staticPath, 'index.html'));
});
```

**The bug after prerender lands:** `app.get('/about', ...)` is registered BEFORE the more-specific path `/about/index.html` would be matched by `express.static` for a bare `/about` request, so the explicit handler always sends the ROOT `index.html` (the prerendered home page) instead of the prerendered about page. (Note: `express.static` does match `/about/` -> `about/index.html` via its directory-index lookup, but the explicit `app.get` handler short-circuits that path.)

**Recommended diff (replace lines ~110-117):**

```js
// Per-route prerendered HTML lookup, with SPA fallback for /dashboard only.
// /dashboard is intentionally not prerendered -- it's the live runtime surface
// requiring chrome.storage hydration and dashboard-runtime-state.js.
const PRERENDERED_ROUTES = new Set(['/', '/about', '/privacy', '/support']);
const SPA_ONLY_ROUTES = ['/dashboard'];

app.get([...PRERENDERED_ROUTES, ...SPA_ONLY_ROUTES], (req, res) => {
  if (!staticPath) {
    res.status(503).type('text/plain').send('Showcase build not found. Run `npm --prefix showcase/angular run build` first.');
    return;
  }
  // Prerendered route: serve the per-route index.html (root for "/", subdir for the rest).
  if (PRERENDERED_ROUTES.has(req.path)) {
    const file = req.path === '/'
      ? path.join(staticPath, 'index.html')
      : path.join(staticPath, req.path.replace(/^\//, ''), 'index.html');
    if (fs.existsSync(file)) { res.sendFile(file); return; }
  }
  // SPA fallback (dashboard, or prerendered file unexpectedly missing).
  res.sendFile(path.join(staticPath, 'index.html'));
});
```

This stays surgical: same route registration shape, same fallback contract for `/dashboard`, but per-route prerendered HTML now wins for marketing routes. Legacy `.html` redirect block (server.js:86-95) remains untouched.

**Static file headers for crawler artifacts:** Place `robots.txt`, `sitemap.xml`, `llms.txt`, `llms-full.txt` under `showcase/angular/public/` (already wired into the `assets` glob in angular.json:36-40). The existing `express.static` block at server.js:98-107 sets `Cache-Control: no-cache, must-revalidate` only for `.js/.css/.html`. For `*.txt` and `*.xml`, `express.static` already maps the right `Content-Type` via `mime-db` (`.txt` -> `text/plain; charset=utf-8`, `.xml` -> `application/xml`).

Optionally tighten with explicit cache hints (recommended -- AI crawlers re-fetch frequently and a 1h TTL hits a sweet spot):

```js
// Inside the existing express.static setHeaders callback, add:
if (filePath.endsWith('robots.txt') || filePath.endsWith('llms.txt') || filePath.endsWith('llms-full.txt')) {
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
}
if (filePath.endsWith('sitemap.xml')) {
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
}
```

No CORS, no `X-Robots-Tag`, no auth. AI bots make plain GETs from documented user agents.

---

## Build-script changes (sitemap.xml + llms.txt regeneration)

Add a single Node ESM script `showcase/angular/scripts/generate-discovery-files.mjs` (~80 lines):

- Reads a small hand-authored manifest (JSON or TS-as-data) describing each prerendered route's title, description, summary, and "this page is for AI" excerpt.
- Emits `public/sitemap.xml` (4 `<url>` entries with `<lastmod>` set to build time).
- Emits `public/robots.txt` with explicit `Allow:` lines for `GPTBot`, `ClaudeBot`, `PerplexityBot`, `Google-Extended`, `Bytespider`, `CCBot`, plus the standard `Sitemap:` directive.
- Emits `public/llms.txt` (short index per the [llmstxt.org](https://llmstxt.org) convention) and `public/llms-full.txt` (concatenated marketing-page content for one-shot AI ingestion).

Wire it into `package.json` (`showcase/angular/package.json`):

```jsonc
"scripts": {
  "ng": "ng",
  "start": "ng serve",
  "prebuild": "node scripts/generate-discovery-files.mjs",
  "build": "ng build",
  "test": "ng test"
}
```

`prebuild` runs automatically before `build`, so every Fly.io image rebuild emits fresh files. No CI/CD changes required.

The files land in `public/` -> picked up by the existing `assets` rule in `angular.json:36-40` (`{"glob": "**/*", "input": "public"}`) -> copied into `dist/.../browser/` -> served by `express.static` from `staticPath`.

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|---|---|---|
| `@angular/ssr` + `outputMode: "static"` | Full Angular Universal SSR (`outputMode: "server"`) with Node SSR runtime on Fly | Only if routes need per-request data (logged-in user state, A/B variants, geo-localized copy). None of `/`, `/about`, `/privacy`, `/support` need this. PROJECT.md explicitly lists "Angular Universal full SSR" as out of scope. |
| `@angular/ssr` + `outputMode: "static"` | `@nguniversal/express-engine` (the legacy Webpack-era SSR) | Never for this project. `@nguniversal/*` packages are deprecated in favour of `@angular/ssr` since Angular 17 and are incompatible with the `@angular/build:application` (esbuild) builder you already use. |
| `@angular/ssr` + `outputMode: "static"` | Third-party static prerender (`prerender.io`, Rendertron, headless-Chrome services) | Only for unmaintained legacy SPAs that can't be rebuilt. You control the build, so doing it at build time is strictly cheaper, faster, and more cacheable. |
| Native `Title` / `Meta` services | `@ngrx/router-store` + side-effecting selectors for SEO | Overkill. NgRx adds runtime weight for a problem that resolvers + `Meta.updateTag` solves directly. |
| Native `<script type="application/ld+json">` injection | `schema-dts` + `jsonld` runtime serializer | `schema-dts` only provides TypeScript types; it adds zero runtime weight beyond compile-time checks. Use it only if you want compile-time checking of JSON-LD shapes. Optional, not required. |
| 80-line Node script for sitemap/llms.txt | `sitemap` (npm), `next-sitemap`, `angular-prerender` | These pull in 5-30 transitive deps each for output that's a few hundred bytes of XML. Net negative. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|---|---|---|
| `@nguniversal/express-engine`, `@nguniversal/builders` | Deprecated since Angular 17. Tied to the legacy Webpack `@angular-devkit/build-angular:server` builder. Will not work with `@angular/build:application` (your current esbuild-based builder). | `@angular/ssr` -- the official replacement, supported in `@angular/build:application`. |
| `prerender.io`, headless-Chrome SaaS, Rendertron | Adds an external service in the request path. Wastes the fact that your routes are statically determinable at build time. Costs latency, money, and a SPOF. | Build-time prerender via `@angular/ssr`. |
| `outputMode: "server"` (full SSR runtime) | Requires running a Node SSR process on Fly.io alongside your existing Express. Cold-start latency, more memory, more crash surfaces, no benefit for static marketing copy. PROJECT.md explicitly defers this as overkill. | `outputMode: "static"`. |
| Manual `<head>` editing in `src/index.html` for per-route metadata | The bare `index.html` is the SPA shell and only one of N prerendered HTML outputs. Per-route metadata MUST be set via `Title` + `Meta` services in component code so each prerendered file gets the right tags. | `Title.setTitle()` + `Meta.updateTag()` in each page component's `ngOnInit` (or via a route resolver). The current bare `<title>FSB</title>` in `src/index.html:5` should be replaced with sensible defaults that get overridden per-route. |
| Generic `User-agent: *` + blanket `Disallow:` posture in `robots.txt` | AI crawlers honour `Allow:` and bot-specific user agents. A blanket `Disallow:` -- or worse, no `robots.txt` at all -- means GPTBot/ClaudeBot/PerplexityBot may treat the site as off-limits or skip it for crawl-budget reasons. | Explicit `Allow:` per AI bot user agent + `Sitemap:` directive. |
| `<meta name="robots" content="noindex">` left in any prerendered output | Easy to leak from a dev/staging build. Hard to detect post-hoc. | Add a smoke check (curl + grep) to release UAT that confirms no `noindex` on `/`, `/about`, `/privacy`, `/support`. |
| `discoverRoutes: true` (the prerender default) | Will sweep up `/dashboard`, which depends on `chrome.storage` / runtime DOM streaming -- prerender will produce a broken or misleading HTML snapshot. | `discoverRoutes: false` + explicit `routesFile: "prerender-routes.txt"`. |

---

## Stack Patterns by Variant

**If `/dashboard` should be discoverable later:**
- Move it into the `routesFile` list.
- Provide a server-rendered "what FSB is" view that doesn't depend on `chrome.storage` -- otherwise prerender will produce broken HTML.
- Out of scope for v0.9.46 per PROJECT.md.

**If you later add comparison pages (`/vs-browser-use`, etc — listed as deferred):**
- Add the explicit paths to `prerender-routes.txt`. Same pattern; zero new infrastructure.

**If you later add an FAQ page with `FAQPage` JSON-LD (deferred):**
- Same `<script type="application/ld+json">` injection pattern as `Organization` / `SoftwareApplication`. No new dependencies.

**If you later need parameterized routes (e.g. `/blog/:slug`):**
- Use the existing `prerender-routes.txt` populated by a script that lists each slug, as documented in the Angular v19 prerendering guide. No SSR runtime required.

---

## Version Compatibility

| Package A | Compatible With | Notes |
|---|---|---|
| `@angular/ssr@^19.0.0` | `@angular/core@^19.0.0`, `@angular/build@^19.0.0` | Must match the Angular major. Mixing `@angular/ssr@18` with `@angular/build@19` will fail at scaffold time. |
| `@angular/build:application` builder (already in use, line 22 of angular.json) | `@angular/ssr@^19` | Confirmed compatible. The `prerender` / `outputMode` / `ssr` / `server` keys are first-class options on the application builder in Angular 19. The legacy `@angular-devkit/build-angular:application` builder also supports them but you're already on `@angular/build:application` -- no migration needed. |
| `zone.js@~0.15.0` (already installed) | `@angular/ssr@^19` | Compatible. `@angular/ssr` uses zone.js for change detection during the prerender pass. No upgrade required. |
| Node `>=20.11` (existing Fly image baseline) | All of the above | Angular 19 + `@angular/ssr` requires Node 18.19+ or 20.11+; Fly image already satisfies this. |
| Existing `legacy .html redirects` block (server.js:86-95) | New per-route handler | No interaction. Redirects fire first, hit `res.redirect(301, ...)`, never fall through. |
| Existing WebSocket / pairing / DOM-stream paths | Per-route prerender handler | Zero overlap. Prerender only changes `GET /`, `/about`, `/privacy`, `/support`. WS endpoints, `/api/*`, and `/dashboard` are untouched. |

---

## Sources

- [Angular v19 Build-time prerendering guide](https://v19.angular.dev/guide/prerendering) — verified `prerender` accepts `discoverRoutes` (boolean, default true) and `routesFile` (path to newline-separated route list); confirmed `ng add @angular/ssr` is the install path. HIGH confidence.
- [Angular SSR / hybrid rendering guide](https://angular.dev/guide/ssr) — verified `outputMode: "static"` produces static HTML with no Node server file required, suitable for static hosting. HIGH confidence.
- [feat(@angular/build): introduce outputMode option (commit 3b00fc9)](https://github.com/angular/angular-cli/commit/3b00fc908d4f07282e89677928e00665c8578ab5) — confirms `outputMode` is a first-class option on `@angular/build:application` and replaces ad-hoc `appShell`/`prerender` toggles in Angular 19. HIGH confidence.
- [angular-cli issue #28712](https://github.com/angular/angular-cli/issues/28712) — corroborates that `prerender` is wired into the application builder schema in Angular 19. MEDIUM confidence (issue is bug-report context, not docs).
- [llmstxt.org spec](https://llmstxt.org) — informal but widely-adopted convention for `llms.txt` / `llms-full.txt`. Used by Anthropic, Cloudflare, Hugging Face, etc. MEDIUM confidence (no W3C standard; convention only).
- Existing repo files (`showcase/angular/angular.json`, `showcase/angular/package.json`, `showcase/angular/src/app/app.routes.ts`, `showcase/angular/src/index.html`, `server/server.js:60-130`) — read directly to ground all integration recommendations. HIGH confidence.

---

*Stack research for: Angular 19 SPA static prerender + crawler/AI-bot discoverability behind custom Express on Fly.io*
*Researched: 2026-04-30*
