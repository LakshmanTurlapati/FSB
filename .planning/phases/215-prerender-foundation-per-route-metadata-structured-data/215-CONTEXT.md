# Phase 215: Prerender Foundation, Per-Route Metadata & Structured Data - Context

**Gathered:** 2026-04-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Make the four marketing routes (`/`, `/about`, `/privacy`, `/support`) emit prerendered static HTML with route-specific `<head>` metadata (title, description, canonical, OG, Twitter card) and JSON-LD structured data baked in, so non-JS AI crawlers (GPTBot, ClaudeBot, PerplexityBot, Google-Extended, etc.) can read what FSB is on first request.

`/dashboard` is explicitly excluded from prerender -- its interactive runtime state must not be baked into static HTML. It receives `noindex, nofollow` at runtime instead.

This phase is the keystone for the v0.9.46 milestone: every other discoverability lever (crawler files, Express patch, production smoke) is observability-only without prerendered HTML to verify against.

</domain>

<decisions>
## Implementation Decisions

### Title + Canonical
- **D-01:** Title pattern is `FSB — {Page}` for sub-routes, em-dash separator, brand first. Home is the exception: `FSB — Full Self-Browsing` (the tagline IS the page).
- **D-02:** Canonical host is `https://full-selfbrowsing.com` -- no `www` subdomain, https-only, no trailing slash on routes (`/about`, not `/about/`).

### Per-Route Copy (titles + meta descriptions)
Each route's `Title.setTitle(...)` + `Meta.updateTag({ name: 'description' })` calls land in the route component's `ngOnInit`. OG and Twitter Card descriptions mirror the meta description verbatim for v0.9.46 (per-route OG copy variants deferred).

- **D-03 (Home `/`)**:
  - title: `FSB — Full Self-Browsing`
  - description: `Open-source Chrome extension that automates the browser through natural language. Multi-model AI (xAI, OpenAI, Anthropic, Gemini, local), 50+ actions, 142+ site guides.`

- **D-04 (About `/about`)**:
  - title: `FSB — About`
  - description: `Watch FSB drive Google, search Amazon, and book travel autonomously. See the open-source AI browser agent in action — your browser, your keys, your data.`

- **D-05 (Privacy `/privacy`)**:
  - title: `FSB — Privacy`
  - description: `How FSB handles your data: API keys encrypted in Chrome local storage, no telemetry, automation runs locally in your browser. BYO key, BYO browser.`

- **D-06 (Support `/support`)**:
  - title: `FSB — Support`
  - description: `Get help with FSB: setup guides, troubleshooting, GitHub issues, and direct contact. MIT-licensed open-source Chrome extension.`

### OpenGraph + Twitter Card
- **D-07:** Shared OG image for v0.9.46 is `showcase/assets/fsb_logo_dark.png` (1000×1000). Per-route 1200×630 cards are deferred to v0.9.47.
- **D-08:** Twitter Card type is `summary` (1:1 layout) -- matches the square OG image; `summary_large_image` (2:1) would letterbox.
- **D-09:** OG `og:title` and `og:description` mirror the meta `<title>` and `<meta name="description">` for each route. OG `og:type` is `website`. OG `og:site_name` is `FSB — Full Self-Browsing`. OG `og:url` is the canonical URL of the route.

### JSON-LD Identity (Organization)
Lives in `showcase/angular/src/index.html` so every prerendered route inherits it. Single `Organization` block, no duplicates.

- **D-10:** `name: "FSB"`, `alternateName: "Full Self-Browsing"` -- matches Google/LLM entity-resolution best practice (short canonical name + long-form alternate).
- **D-11:** `url: "https://full-selfbrowsing.com"`, `logo: "https://full-selfbrowsing.com/assets/fsb_logo_dark.png"` (use the absolute URL, not a relative path -- Google's structured-data validator requires absolute for `logo`).
- **D-12:** `sameAs: ["https://github.com/lakshmanturlapati/FSB"]` -- GitHub repo only for v0.9.46. No Twitter/LinkedIn/contact email yet (defer until profiles exist or contact is published).

### JSON-LD Identity (SoftwareApplication)
Lives in the home component (`/` only) -- semantically bound to the landing page, not the site shell.

- **D-13:** `applicationCategory: "BrowserApplication"`, `operatingSystem: "Chrome"`, `offers: { "@type": "Offer", price: "0", priceCurrency: "USD" }`. Free, browser-bound, Chrome-only -- matches reality.
- **D-14:** `softwareVersion` is read from `manifest.json` at build time by the prebuild script (Phase 216 will own that script; for Phase 215 the home component can pull from a generated constant or fall back to the package.json version). Avoids stale hardcoded versions.
- **D-15:** `downloadUrl: "https://github.com/lakshmanturlapati/FSB"` -- repo URL until Chrome Web Store listing exists. Honest signal: "open source, install from source."
- **D-16:** `name: "FSB"`, `description: "Open-source Chrome extension for AI-powered browser automation through natural language"`, `url: "https://full-selfbrowsing.com"`. Mirror the home page's meta description's first sentence; Google's Rich Results Test rejects mismatches between schema and on-page content.

### JSON-LD Escaping (universal)
- **D-17:** All inline `<script type="application/ld+json">` payloads are emitted via `JSON.stringify(obj).replace(/</g, '\\u003c')` to defeat `</script>` injection. This applies uniformly to D-10..D-16 blocks. Pattern documented inline in code with a comment citing PITFALLS.md P4.

### `/dashboard` Exclusion
- **D-18:** `/dashboard` is NOT in `prerender-routes.txt`. Build-time assertion: after `npm --prefix showcase/angular run build`, the path `dist/showcase-angular/browser/dashboard/index.html` must NOT exist. If a future contributor accidentally adds it, the assertion fails the build.
- **D-19:** `/dashboard` adds `<meta name="robots" content="noindex, nofollow">` at runtime via the dashboard component's `Meta.updateTag` call. This protects against Googlebot (which DOES execute JS) indexing transient runtime state.

### `localStorage` Guard
- **D-20:** The IIFE in `showcase/angular/src/index.html:7-15` (`localStorage.getItem('fsb-showcase-theme')`) is wrapped in `typeof localStorage !== 'undefined'` (NOT `try/catch`) so the prerender environment doesn't throw. The light-theme attribute application stays inside the guard so the IIFE remains a no-op during prerender.

### Claude's Discretion

- **SEO service architecture**: whether to introduce a shared `SeoService` (injected into each route component) or call `Title.setTitle` / `Meta.updateTag` / `Renderer2.setAttribute` directly inside each component's `ngOnInit`. Either is acceptable -- planner picks based on code-quality fit. If five-plus components end up with near-identical metadata wiring, factor to a service; if it's just four routes with bespoke copy, direct calls are fine.
- **Canonical injection mechanism**: Angular's `Meta` service does not natively support `<link>` tags, so canonical must be set via `DOCUMENT` token + `Renderer2.setAttribute` (or `document.head.appendChild`). Planner picks the cleaner pattern; the constraint is just that the tag must end up in the prerendered HTML.
- **JSON-LD constant location**: whether the Organization payload lives as a literal `<script>` block hand-written in `index.html`, or is constructed in TypeScript and injected during prerender via `DOCUMENT.head`. Hand-written in `index.html` is simpler and verifiable by `grep`; TypeScript-injected is more maintainable if the payload grows. Both satisfy D-10..D-12.
- **`softwareVersion` source for Phase 215**: Phase 216 owns the prebuild script that reads `manifest.json`. For Phase 215, the home component can either (a) import a constant from a small `version.ts` file that's hand-edited per release, or (b) read from `package.json` at build via Angular's filesystem-aware build. Planner picks; the constraint is just that it not be a string literal that goes stale silently.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase planning + research
- `.planning/REQUIREMENTS.md` §"Static Prerender Foundation (PRE)" — PRE-01..05
- `.planning/REQUIREMENTS.md` §"Per-Route Metadata (META)" — META-01..04
- `.planning/REQUIREMENTS.md` §"Structured Data / JSON-LD (LD)" — LD-01..02 (LD-03 belongs to Phase 216)
- `.planning/ROADMAP.md` §"Phase 215" — goal, success criteria, traceability
- `.planning/research/STACK.md` — `@angular/ssr@^19` install path, `outputMode: "static"` config snippet, what NOT to use
- `.planning/research/FEATURES.md` — verified 2026 crawler list, JSON-LD type weighting, Twitter Card type guidance
- `.planning/research/ARCHITECTURE.md` — prerender output convention (`browser/<route>/index.html`), `ngOnInit` is captured by prerender, asset glob already routes `public/**` to dist root
- `.planning/research/PITFALLS.md` — P1 (localStorage guard), P2 (/dashboard exclusion), P4 (JSON-LD `</` escaping), P9 (deterministic Title/Meta patterns)
- `.planning/research/SUMMARY.md` — synthesis + phase ordering rationale

### Existing code (touch points)
- `showcase/angular/angular.json:21-66` — build target where `outputMode: "static"` and `prerender` config land
- `showcase/angular/src/app/app.routes.ts` — 5 lazy-loaded routes (1 SPA, 4 prerendered)
- `showcase/angular/src/index.html:7-15` — `localStorage` IIFE that needs guarding (D-20); also where the `Organization` JSON-LD block lands (D-10..D-12)
- `showcase/angular/src/app/pages/home/home-page.component.ts` — receives `Title`/`Meta` calls + `SoftwareApplication` JSON-LD injection
- `showcase/angular/src/app/pages/about/about-page.component.ts` — receives `Title`/`Meta` calls
- `showcase/angular/src/app/pages/privacy/privacy-page.component.ts` — receives `Title`/`Meta` calls
- `showcase/angular/src/app/pages/support/support-page.component.ts` — receives `Title`/`Meta` calls
- `showcase/angular/src/app/pages/dashboard/dashboard-page.component.ts` — receives `noindex, nofollow` `Meta` call (D-19); NOT prerendered
- `manifest.json:4` — `"version": "0.9.31"` source for `softwareVersion` (D-14)
- `package.json:3` — `"version": "0.9.31"` parallel source if manifest path is awkward
- `showcase/assets/fsb_logo_dark.png` — OG image (D-07)

### External standards (reference only)
- https://schema.org/Organization — D-10..D-12
- https://schema.org/SoftwareApplication — D-13..D-16
- https://search.google.com/test/rich-results — Phase 216 validates against this
- https://v19.angular.dev/guide/prerendering — `@angular/build:application` static prerender (already cited in STACK.md)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Brand assets in `showcase/assets/`** — `fsb_logo_dark.png`, `fsb_logo_light.png`, `fsb.png`, `0.9.png` are all 1000×1000. `angular.json:36-39` already globs them to dist root via the `public/**` + `../assets/**` asset configs. OG image path resolves at runtime to `/assets/fsb_logo_dark.png`.
- **Existing on-page hero copy** — `home-page.component.html:5-6` carries the brand voice ("Full Self-Browsing — AI-powered browser automation through natural language. Tell it what to do, and watch it browse for you."). Per-route descriptions (D-03..D-06) echo this voice; Rich Results Test will not flag mismatches.
- **GitHub repo URL** — already referenced in `home-page.component.html:11` (`https://github.com/lakshmanturlapati/FSB`). Same URL in `package.json:7`. Reuse for `sameAs` (D-12) and `downloadUrl` (D-15).

### Established Patterns
- **Standalone components** — every page component is `standalone: true` (modern Angular 19). `Title` and `Meta` services are provided by `BrowserModule` automatically; no module wiring needed.
- **Lazy-loaded routes** — `app.routes.ts` uses `loadComponent: () => import(...).then(m => m...)`. `@angular/ssr` prerender awaits these dynamic imports during the prerender hook -- no special config needed.
- **No existing SEO service** — no `SeoService`, `MetaService`, or shared metadata helper exists. Greenfield decision (Claude's discretion).
- **`<base href="/">`** — set in `index.html:5`. Compatible with Angular 19 prerender; per-route prerendered HTML inherits it.

### Integration Points
- **`angular.json` build options** — add `outputMode: "static"` + `prerender: { discoverRoutes: false, routesFile: "prerender-routes.txt" }` under `projects.showcase-angular.architect.build.options` (around line 21-44).
- **`prerender-routes.txt`** — new file at `showcase/angular/prerender-routes.txt`, four lines (`/`, `/about`, `/privacy`, `/support`).
- **`index.html` `<head>`** — `Organization` JSON-LD `<script>` block lands here, after the existing icon `<link>` and before `<app-root>`. Existing `localStorage` IIFE (lines 7-15) gets the typeof guard.
- **Each route component's `ngOnInit`** — `constructor(private title: Title, private meta: Meta, @Inject(DOCUMENT) private doc: Document, private renderer: Renderer2)`. Title/Meta calls in `ngOnInit`. Canonical via `Renderer2.setAttribute(linkEl, 'href', url)` after `renderer.appendChild(doc.head, linkEl)`.
- **Home component specifically** — gets the `SoftwareApplication` JSON-LD block injected via `DOCUMENT.head.appendChild` in `ngOnInit` (or hand-written in `home-page.component.html` as a `<script>` block; planner decides).

</code_context>

<specifics>
## Specific Ideas

- **Em-dash, not hyphen**, in titles: `FSB — About` (U+2014), not `FSB - About`. The em-dash is the brand voice already used elsewhere on the site.
- **JSON-LD `@id` cross-reference**: the `Organization` block's `@id` (e.g., `https://full-selfbrowsing.com/#org`) should be referenced from `SoftwareApplication`'s `publisher` field via `{ "@id": "..." }`. This is the canonical Google pattern for binding the two entities -- AI search engines use it too.
- **OG `og:url` vs canonical**: they should be the same per-route URL. Some implementations diverge (canonical is "preferred", OG `og:url` is "this share"); for static marketing pages they're identical. Prevents AI search crawlers from disagreeing about which URL is authoritative.
- **`fsb_logo_dark.png` for OG**: dark logo on (presumably) dark background -- if the unfurl preview shows on light social-card backgrounds (LinkedIn does), it'll still render OK because the logo has internal contrast. Per-route 1200×630 cards land in v0.9.47 with proper light/dark variants.

</specifics>

<deferred>
## Deferred Ideas

- **Per-route 1200×630 OG image variants** — explicit user preference is to defer until v0.9.47 design pass.
- **Twitter `@site` / `@creator` handles** — no Twitter profile claimed yet; revisit when one exists.
- **Organization `contactPoint`** — no public contact email yet; skip the field. Schema permits.
- **`BreadcrumbList` JSON-LD** — out of scope per REQUIREMENTS.md; route depth is currently flat (max 1 segment), so breadcrumbs are redundant.
- **`FAQPage` JSON-LD** — DISCO-FUTURE-01 in REQUIREMENTS.md; needs an actual `/faq` page first.
- **`provideClientHydration()` in `app.config.ts`** — PRE-FUTURE-01 in REQUIREMENTS.md; not required for static prerender.
- **Reading `softwareVersion` from `manifest.json` via a build script** — the prebuild script lives in Phase 216 (CRAWL-05). Phase 215 uses a simpler interim source (Claude's discretion); Phase 216 can refactor to share the version-read with the sitemap/llms-full generator.

</deferred>

---

*Phase: 215-prerender-foundation-per-route-metadata-structured-data*
*Context gathered: 2026-04-30*
