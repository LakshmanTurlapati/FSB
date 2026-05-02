# Project Research Summary

**Project:** FSB v0.9.46 Site Discoverability (SEO + GEO)
**Domain:** Static prerender + crawler/AI-bot discoverability for an Angular 19 SPA marketing site behind a custom Express on Fly.io
**Researched:** 2026-04-30
**Confidence:** HIGH

## Executive Summary

This is a focused integration milestone, not a greenfield design. `full-selfbrowsing.com` is an Angular 19 SPA whose marketing routes (`/`, `/about`, `/privacy`, `/support`) currently return only an empty `<app-root>` with the literal `<title>FSB</title>` to every non-JS crawler -- meaning GPTBot, ClaudeBot, PerplexityBot, Google-Extended, and standard Googlebot collectively see nothing about what FSB is. The verified, expert-validated approach is Angular's first-party static prerender path (`@angular/ssr` + `outputMode: "static"` under the existing `@angular/build:application` builder), per-route `Title`/`Meta` injection in the existing 5 page components, JSON-LD (`Organization` + `SoftwareApplication`) baked into prerendered HTML, and four crawler root files (`robots.txt`, `sitemap.xml`, `llms.txt`, `llms-full.txt`) shipped from `showcase/angular/public/`.

The recommendation is **build-time static only** -- no runtime SSR, no third-party prerender SaaS, no `@nguniversal/*` (deprecated and incompatible with the esbuild-based builder already in use). Total dependency surface: one new devDep (`@angular/ssr@^19`) and one ~80-line Node ESM script for the discovery files. The Express server needs a single surgical change: the existing scoped SPA-fallback handler at `server/server.js:111` currently serves the root `index.html` for every marketing route, **shadowing** any per-route prerendered HTML. The fix is to make the handler prerender-aware (prefer `staticPath/<route>/index.html` when present, fall back to root only for `/dashboard`).

Key risks are concentrated and well-known: (1) the inline `localStorage` IIFE in `src/index.html` will crash prerender unless guarded with `typeof localStorage !== 'undefined'`; (2) `/dashboard` must be explicitly excluded from the prerender route list (it depends on `chrome.storage`, runtime DOM streaming, and live WebSocket state -- prerendering it produces broken HTML); (3) Express middleware order must let static middleware win over the SPA fallback for marketing routes while still serving the SPA shell for `/dashboard`; (4) JSON-LD must use `JSON.stringify` with `</` -> `<\/` escaping to defeat script-tag injection. All four are preventable with explicit code patterns documented in the research files.

## Key Findings

### Recommended Stack

The entire milestone is delivered with one new package and one local Node script -- no new framework, no new runtime, no third-party services. The existing `@angular/build:application` builder, Express server, Fly.io deployment, and `public/` asset glob already provide every hook needed.

**Core technologies:**
- `@angular/ssr@^19.0.0` (devDep) -- provides the prerender machinery wired into the existing application builder. Verified as the only first-party path for Angular 19's esbuild-based builder.
- `outputMode: "static"` (angular.json key, no package) -- tells the builder to emit pure static HTML per route at build time with no Node SSR runtime. Marketing routes have no per-request data; static is correct.
- `@angular/router` `Title` + `Meta` services (already installed via `@angular/platform-browser`) -- per-route `<title>`, `<meta name="description">`, OG, Twitter, canonical written in `ngOnInit` and captured into the prerendered HTML snapshot.
- ~80-line local Node ESM build script (`scripts/generate-discovery-files.mjs`) -- emits `sitemap.xml`, `robots.txt`, `llms.txt`, `llms-full.txt` into `public/` from a hand-curated route manifest. Runs as `prebuild` npm script.

**What NOT to use:** `@nguniversal/*` (deprecated, Webpack-era, incompatible with `@angular/build:application`); `prerender.io` / Rendertron / headless-Chrome SaaS (external SPOF, latency tax, defeats the point of build-time prerender); full SSR `outputMode: "server"` (overkill, explicitly OOS per PROJECT.md); `sitemap` / `next-sitemap` / `angular-prerender` npm packages (5-30 transitive deps for a few hundred bytes of XML).

See [STACK.md](STACK.md) for the full angular.json patch, Express integration diff, and version-compatibility matrix.

### Expected Features

Marketing-site discoverability has well-established table stakes in 2026. AI-crawler-aware files (`llms.txt`, explicit per-bot `robots.txt` Allow blocks) are still convention-rather-than-standard, but the cost-benefit strongly favors shipping them.

**Must have (table stakes for v0.9.46 -- ship-or-fail):**
- Static prerender of `/`, `/about`, `/privacy`, `/support` (the keystone -- every other feature depends on it landing first)
- Express SPA-fallback ordering fix (without this, prerendered HTML is shadowed and crawlers still see the empty shell)
- Per-route `<title>` + `<meta name="description">` via Angular `Title`/`Meta` services
- Per-route `<link rel="canonical">` (absolute HTTPS URL, no trailing slash)
- Per-route Open Graph + Twitter Card tags + one shared 1200x630 default OG image
- `Organization` JSON-LD in `index.html` `<head>` (inherited by all prerendered routes via `@id` reference)
- `SoftwareApplication` JSON-LD on home route only (semantically bound to `/`)
- `<meta name="robots" content="noindex,nofollow">` on `/dashboard` (auth-gated, no SEO value)
- `robots.txt` at site root with explicit per-bot `Allow:` blocks for GPTBot, ChatGPT-User, OAI-SearchBot, ClaudeBot, Claude-User, Claude-SearchBot, PerplexityBot, Google-Extended, Applebot-Extended, Amazonbot, Bytespider, CCBot, Meta-ExternalAgent + `Sitemap:` directive + `Disallow: /dashboard`
- `sitemap.xml` at site root with 4 marketing routes, `<loc>` and `<lastmod>` only (Google explicitly ignores `priority` and `changefreq` in 2026)

**Should have (differentiators -- ship in same milestone if cheap, else v0.9.47):**
- `llms.txt` (markdown index per llmstxt.org convention, used by Anthropic, Cloudflare, Stripe; 844K+ adopters by Oct 2025)
- `llms-full.txt` (auto-generated from prerendered HTML, capped at ~256KB per practical scraper limits)
- `BreadcrumbList` JSON-LD on `/about`, `/privacy`, `/support`

**Defer (v0.9.50+ or pending product evolution):**
- `FAQPage` JSON-LD (no FAQ page exists yet -- faking content violates Google policy)
- Comparison pages + `Article` schema (`/vs-browser-use`, etc., explicitly OOS in PROJECT.md)
- Search Console / Bing Webmaster registration (OOS)
- Off-page push (Show HN, Reddit, awesome-list PRs, YouTube) (OOS)
- Angular Universal full SSR (OOS, prerender is sufficient)
- `WebSite` `SearchAction` (no on-site search exists)

**Anti-features to actively reject:** `HowTo` JSON-LD (Google deprecated rich result late 2023); `priority`/`changefreq` in sitemap (Google ignores); `noai` / `noimageai` meta (FSB *wants* AI ingestion -- LLM citations are the goal); wildcard `Disallow: /` -> per-bot `Allow:` posture (inverts open-web default, fragile); auto-discovered prerender routes (would sweep `/dashboard` into prerender).

See [FEATURES.md](FEATURES.md) for the verified 2026 AI-crawler list with vendor citations, concrete payloads (robots.txt, sitemap.xml, JSON-LD blocks, per-route meta), and the priority matrix.

### Architecture Approach

This is an **integration architecture**, not a greenfield design. Every hook exists today: the application builder supports prerender natively in v19, the `public/**/*` asset glob already writes to dist root with no `output:` prefix, `express.static` is registered before the SPA fallback, and the SPA fallback is already scoped (not a global wildcard). The minimal-disruption integration is four touches: enable prerender in `angular.json`, inject `Title`/`Meta` per route component, drop crawler files in `showcase/angular/public/`, patch the Express SPA fallback to prefer per-route `index.html`.

**Major components (all touch points are modifications to existing files; no new architectural layers):**
1. **`angular.json` build target** -- add `prerender: { discoverRoutes: false, routesFile: "prerender-routes.txt" }` and `outputMode: "static"` under the existing `@angular/build:application` block. Explicit route list excludes `/dashboard`.
2. **5 page components** (`home/about/privacy/support/dashboard-page.component.ts`) -- inject `Title` and `Meta` from `@angular/platform-browser` in `ngOnInit`; home component additionally injects `SoftwareApplication` JSON-LD via `document.createElement('script')`; dashboard component sets `noindex,nofollow`.
3. **`showcase/angular/public/`** -- host `robots.txt`, `sitemap.xml`, `llms.txt`, `llms-full.txt` (existing glob copies them to dist root). Generated at build time by a new `scripts/generate-discovery-files.mjs` invoked via `prebuild` npm script.
4. **`server/server.js:111` SPA-fallback handler** -- replace the unconditional root-index.html send with a prerender-aware handler that prefers `staticPath/<route>/index.html` when present and falls back to root only for `/dashboard`. Existing `express.static` cache headers extended with explicit `Cache-Control: public, max-age=3600` and `Content-Type` for `*.txt` and `*.xml`.

See [ARCHITECTURE.md](ARCHITECTURE.md) for the full file:line map, build-time and request-time data flow diagrams, integration anti-patterns, and the static-vs-generated sitemap trade-off discussion.

### Critical Pitfalls

The pitfalls research identified ten distinct failure modes; the four below are the high-impact ones that single-handedly determine whether the milestone ships clean.

1. **`localStorage` access in `src/index.html` crashes prerender.** The current inline IIFE (lines 8-15 of `src/index.html`) calls `localStorage.getItem('fsb-showcase-theme')` before Angular bootstraps. Under prerender, `localStorage` is undefined and the script throws `ReferenceError`, which either fails the prerender entirely or silently emits an HTML file with the wrong theme baked in. **Avoid:** wrap the IIFE in `if (typeof localStorage === 'undefined') return;`. Bake default (dark) theme into prerender; let the inline script *upgrade* to light when storage is available at runtime.
2. **`/dashboard` accidentally prerendered.** The default prerender configuration enumerates all unparameterized `Routes`. `/dashboard` is unparameterized, so it sweeps in by default -- and prerendering it produces broken HTML because the page depends on `chrome.storage`, `dashboard-runtime-state.js`, `html5-qrcode`, and live WebSocket state. **Avoid:** explicit `discoverRoutes: false` + `routesFile: prerender-routes.txt` listing only `/`, `/about`, `/privacy`, `/support`. Add a build-time assertion that `dist/.../browser/dashboard/index.html` does NOT exist.
3. **Express middleware order shadows prerender output and/or swallows crawler files.** The current SPA-fallback handler at `server/server.js:111` returns the *root* `index.html` for every marketing route, overriding any per-route prerendered file. A naive "future-proofing" change to `app.get('*', ...)` would additionally swallow `/robots.txt`, `/sitemap.xml`, `/llms.txt`. **Avoid:** keep the scoped allowlist; make the handler prerender-aware (prefer `staticPath/<route>/index.html` if it exists, else root); never use a wildcard.
4. **Invalid or duplicate JSON-LD.** Failure modes include multiple conflicting `Organization` blocks across pages, wrong `@context` (`http://schema.org`), `</script>` substring inside a JSON-LD value closing the script block early, trailing commas / single quotes / unescaped newlines from template-literal authoring. **Avoid:** one canonical `Organization` block on `/` only; cross-reference via `@id` from other pages; build via `JSON.stringify(obj).replace(/</g, '\\u003c')`; validate every prerendered page with Google Rich Results Test in CI before merge.

Honorable mentions worth tracking in phase planning:
- **`robots.txt` `Disallow: /` typo** has a 24h+ recovery window because some crawlers cache it; CI grep for `^Disallow: /$` catches it before deploy.
- **`sitemap.xml` `lastmod` format** must be W3C ISO 8601 (`YYYY-MM-DD`); `xmllint --noout` in CI catches malformed XML.
- **Cache-Control on `*.txt` / `*.xml` defaults to nothing** -- explicit `Cache-Control: public, max-age=3600` prevents bad-deploy edge-cache poisoning.
- **`llms.txt` linking to non-prerendered URLs** undoes the entire point; verify each link with `curl -A "ClaudeBot"` (no JS).
- **Hydration determinism** (future SSR concern) -- write `Title`/`Meta` calls deterministically now to keep the future SSR migration painless.

See [PITFALLS.md](PITFALLS.md) for the full ten-pitfall catalog with warning signs, recovery costs, and the pitfall-to-phase mapping.

## Implications for Roadmap

The four research files converge on the same phase ordering: **prerender first, structured data second, Express + crawler files third, validation last.** Each phase's output is a prerequisite for the next phase's verification, so deviating from this order forces phases to be re-tested.

### Phase 1: Prerender Foundation + Per-Route Metadata

**Rationale:** Prerender is the keystone -- without static HTML on disk, sitemap entries point at empty shells, JSON-LD never lands in served HTML, the Express patch has nothing to serve, and AI crawlers continue to see the literal `<title>FSB</title>`. The `localStorage` guard fix is bundled here because it is a hard prerequisite for prerender to even succeed in CI. Per-route `Title`/`Meta` is also bundled because (a) prerender output without per-route metadata is a fundamentally incomplete artifact, and (b) prerender execution is the only way to verify that `Title`/`Meta` writes actually land in the served HTML rather than just the runtime DOM.
**Delivers:** `npm run build` emits `dist/showcase-angular/browser/{index,about/index,privacy/index,support/index}.html`, each with route-specific `<title>`, `<meta name="description">`, canonical, OG, and Twitter Card tags. `dashboard/index.html` does NOT exist. `/dashboard` page component sets `noindex,nofollow`.
**Addresses:** "Static prerender of marketing routes", "Per-route SEO/AEO metadata via Angular `Title`/`Meta` services" (FEATURES.md must-haves).
**Avoids:** Pitfall 1 (`localStorage` prerender crash); Pitfall 2 (`/dashboard` accidentally prerendered); Pitfall 9 (hydration determinism for future SSR).
**Uses:** `@angular/ssr@^19.0.0`, `outputMode: "static"`, `prerender.routesFile`, `Title`/`Meta` from `@angular/platform-browser`.

### Phase 2: Structured Data (JSON-LD)

**Rationale:** JSON-LD requires Phase 1 to land first because the script tags are injected via `ngOnInit` and only the prerender pass captures them into the served HTML. Verification is via `view-source:` of the prerendered HTML files, which only exist after Phase 1. Bundling JSON-LD with Phase 1 would conflate two distinct verification gates (route-level metadata correctness vs. schema.org validity); separating them keeps each phase's success criterion sharp.
**Delivers:** `Organization` JSON-LD in `index.html` `<head>` (inherited by all prerendered routes via `@id`); `SoftwareApplication` JSON-LD on `/index.html` only; CI gate that runs Google Rich Results Test API on every prerendered page.
**Addresses:** "JSON-LD structured data (Organization + SoftwareApplication) embedded in prerendered HTML" (FEATURES.md must-have).
**Avoids:** Pitfall 4 (invalid or duplicate JSON-LD); the `</script>` injection vector via the `JSON.stringify(...).replace(/</g, '\\u003c')` pattern.
**Uses:** Schema.org `Organization` and `SoftwareApplication` types; optional `schema-dts` for compile-time type-checking only.

### Phase 3: Express Wiring + Crawler Root Files

**Rationale:** The Express SPA-fallback patch is meaningful only when per-route prerendered files exist on disk (Phase 1 prerequisite). The crawler root files (`robots.txt`, `sitemap.xml`, `llms.txt`, `llms-full.txt`) are bundled into the same phase because they share the same verification flow (`curl -I` headers, content-type, cache-control, end-to-end sitemap entry resolution). The `llms-full.txt` generator depends on prerendered HTML existing on disk to extract content from. Splitting Express from crawler files would force two rounds of `curl` smoke testing; bundling lets one validation pass cover both.
**Delivers:** `server/server.js:111` patched to prefer per-route prerendered HTML; explicit `Cache-Control: public, max-age=3600` and `Content-Type` headers for `*.txt`/`*.xml`. `scripts/generate-discovery-files.mjs` emits `robots.txt` (with verified 2026 AI-crawler allowlist), `sitemap.xml` (4 routes, `<loc>` + `<lastmod>` only), `llms.txt`, `llms-full.txt` (capped at 256KB) into `public/` via `prebuild` npm script.
**Addresses:** "AI-crawler root files at site root", "Express SPA-fallback adjustment" (FEATURES.md must-haves); `llms.txt` / `llms-full.txt` (FEATURES.md should-haves -- bundle in same phase since the generator script handles both for free).
**Avoids:** Pitfall 3 (Express ordering shadowing prerender + crawler files); Pitfall 5 (`robots.txt` typos); Pitfall 6 (`sitemap.xml` rejection); Pitfall 7 (`llms.txt` drift / oversize); Pitfall 10 (Cache-Control leaks).

### Phase 4: Production Validation

**Rationale:** Final gate before milestone close. Must run against the real Fly.io deployment (not localhost) because Pitfall 8 (Fly `force_https` redirect chain, cold-start latency, single-region `sjc` distance from EU/AP crawlers) is only observable in production. Earlier phases verify code-level correctness; this phase verifies operational correctness.
**Delivers:** Recorded smoke evidence: `curl -A "GPTBot" https://full-selfbrowsing.com/about` returns prerendered HTML with route-specific `<title>` and JSON-LD; `curl -I https://full-selfbrowsing.com/robots.txt` returns 200 with `Content-Type: text/plain` and `Cache-Control: public, max-age=3600`; redirect chain is exactly one hop; Search Console "Test live URL" passes for all four marketing routes; Rich Results Test detects exactly one `Organization` and one `SoftwareApplication` site-wide.
**Addresses:** Operational verification of all FEATURES.md must-haves landing in production.
**Avoids:** Pitfall 8 (Fly redirect / cold-start) caught only by live probing; the "Looks Done But Isn't" checklist from PITFALLS.md.

### Phase Ordering Rationale

- **Hard data dependency: prerender must land first.** Every other phase verifies against per-route HTML on disk. Crawler files in Phase 3 reference URLs that must resolve to real prerendered content; JSON-LD in Phase 2 must land in the prerendered snapshot, not just runtime DOM.
- **Bundling driven by shared verification gates.** Phase 1 bundles `localStorage` guard + prerender enablement + per-route `Title`/`Meta` because all three are verified by a single `npm run build` + curl-prerendered-output check. Phase 3 bundles Express wiring + all four crawler files because all five are verified by a single `curl -I` smoke pass against the local Fly-shaped Express server.
- **Express patch with prerender, not before.** Patching the Express handler before per-route HTML exists makes the patch a no-op AND impossible to verify; co-locating the patch with crawler files in Phase 3 means one Express deploy validates both.
- **Validation as a separate phase, not folded into Phase 3.** Production validation requires the real Fly.io deployment (HTTPS canonical, redirect chain, cold-start timing, single-region latency) which Phase 3's local smoke cannot exercise. Folding it in would conflate "code is correct" with "deployment is correct."

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 1:** `provideClientHydration()` decision (defer to Phase 1 planning; not required for static prerender but optional future-proofing for hydration-aware migrations). Confirm Angular 19 prerender behavior with the existing `<base href="/">` in `src/index.html`.
- **Phase 3:** `llms-full.txt` content extraction strategy -- decide between (a) regex-stripping prerendered HTML to markdown vs. (b) maintaining a separate hand-curated content map. Recommend (a) per FEATURES.md to avoid drift; planning should specify the exact extraction rules (which tags survive, which are stripped, code-fence handling).

Phases with standard patterns (skip dedicated `/gsd-research-phase`):
- **Phase 2:** JSON-LD authoring is well-documented (schema.org spec, Google Rich Results Test); the `JSON.stringify` + `</` escape pattern is canonical.
- **Phase 4:** Production smoke pass is checklist-driven (the "Looks Done But Isn't" section of PITFALLS.md is effectively the runbook).

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Verified against Angular 19 official docs (angular.dev v19 prerender + SSR guides), the `outputMode` introduction commit (3b00fc9), and direct read of `showcase/angular/angular.json`, `package.json`, and `server/server.js`. The `@angular/build:application` builder is already in use; the prerender keys are first-class options on its schema. |
| Features | HIGH | AI-crawler list verified against OpenAI (`platform.openai.com/docs/bots`), Anthropic (`support.claude.com`, `privacy.claude.com`), and Cloudflare Radar (verified-bots directory + March 2026 traffic share). Sitemap `priority`/`changefreq` 2026 status verified. JSON-LD weighting for LLMs is MEDIUM (community consensus, no vendor-stated rankings) but the schema.org spec and Google Rich Results behavior are HIGH. llms.txt convention is MEDIUM (de-facto standard, 844K+ adopters, no W3C ratification). |
| Architecture | HIGH | Verified by direct read of `angular.json` asset globs (lines 35-50), builder config (22-77), `app.routes.ts`, `index.html`, and `server/server.js:73-117`. Middleware order, `express.static` `index` option behavior, and the existing scoped SPA fallback are all confirmed in code. JSON-LD via `document.createElement` during prerender is MEDIUM (works because prerender uses DOM emulation, but `Renderer2` is the safer alternative if the platform contract tightens). |
| Pitfalls | HIGH | Angular 19 prerender, schema.org JSON-LD, Google robots.txt, Google sitemap, Express static middleware, and Fly.io `force_https` are all verified against official docs. llms.txt convention is MEDIUM (evolving standard). Fly.io crawler-latency specifics (cold-start impact on EU/AP crawlers) are MEDIUM (no public Fly-specific crawler benchmark; inferred from machine `auto_stop_machines` semantics). |

**Overall confidence:** HIGH

### Gaps to Address

- **`provideClientHydration()` necessity** -- defer to Phase 1 planning. Not required for static prerender; optional future-proofing for hydration migrations. Decision can be made by reading the Angular 19 hydration guide once Phase 1 planning starts.
- **`llms-full.txt` content extraction algorithm** -- defer to Phase 3 planning. Choice between regex-strip-from-prerendered-HTML vs. hand-curated content map; trade-offs are auto-sync vs. editorial control. Recommendation in FEATURES.md is auto-generation; planning should pin the exact extraction rules.
- **Per-route OG image strategy** -- Phase 1 ships with one shared default OG image per FEATURES.md. Per-route variants are P3 (deferred). No gap blocks v0.9.46.
- **CI gating for JSON-LD validation** -- PITFALLS.md recommends running Google Rich Results Test API in CI; the current CI/CD posture is not documented in any research file. Phase 2 planning should confirm whether the CI gate is enforceable today or if validation is manual-pre-deploy.
- **Fly.io edge cache behavior on `*.txt` / `*.xml`** -- explicit `Cache-Control` headers are recommended in PITFALLS.md and STACK.md, but Fly's edge proxy may layer additional caching. Phase 4 validation should `curl -I` from external probes to verify the headers survive the edge.

## Sources

### Primary (HIGH confidence)
- Angular v19 prerender guide -- https://v19.angular.dev/guide/prerendering
- Angular SSR / hybrid rendering guide -- https://angular.dev/guide/ssr
- `outputMode` introduction commit -- https://github.com/angular/angular-cli/commit/3b00fc908d4f07282e89677928e00665c8578ab5
- OpenAI Crawlers reference -- https://platform.openai.com/docs/bots (GPTBot, ChatGPT-User, OAI-SearchBot)
- Anthropic crawler reference -- https://support.claude.com/en/articles/8896518-... (ClaudeBot, Claude-User, Claude-SearchBot)
- Cloudflare bots concepts -- https://developers.cloudflare.com/bots/concepts/bot/
- Cloudflare Radar verified-bots directory + March 2026 traffic data
- Google Search Central (robots.txt + sitemaps) -- https://developers.google.com/search/docs/crawling-indexing/
- schema.org JSON-LD spec -- https://schema.org/docs/jsonld.html
- Google-Extended announcement -- https://blog.google/technology/ai/an-update-on-web-publisher-controls/
- Express `static` middleware docs -- https://expressjs.com/en/api.html#express.static
- Fly.io `force_https` + machine lifecycle -- https://fly.io/docs/networking/services/, https://fly.io/docs/apps/autostart-stop/
- Repo files: `showcase/angular/angular.json`, `showcase/angular/package.json`, `showcase/angular/src/app/app.routes.ts`, `showcase/angular/src/index.html`, `server/server.js`, `.planning/PROJECT.md`

### Secondary (MEDIUM confidence)
- llmstxt.org community spec -- https://llmstxt.org/ (de-facto convention, 844K+ adopters, no W3C ratification)
- Mintlify "What is llms.txt" -- https://www.mintlify.com/blog/what-is-llms-txt
- angular-cli issue #28712 -- https://github.com/angular/angular-cli/issues/28712 (corroborates `prerender` schema in v19)
- Sitemaps.org Protocol -- https://www.sitemaps.org/protocol.html (canonical schema; `priority`/`changefreq` "support varies")
- JSON-LD-for-LLM community write-ups (Szymon Slowik, SchemaApp, Schema Pilot) -- community consensus, not vendor-stated weighting
- Cloudflare blog "From Googlebot to GPTBot" -- https://blog.cloudflare.com/from-googlebot-to-gptbot-whos-crawling-your-site-in-2025/
- 2026 AI-crawler landscape surveys (No Hacks, WebSearchAPI, Lumina SEO)

### Tertiary (LOW confidence -- noted for transparency, not relied on for decisions)
- Personal-experience pitfall observations on `localStorage` + prerender + Express middleware ordering (informs warning signs and recovery cost estimates; corroborated by official Angular hydration guide where available)

---
*Research completed: 2026-04-30*
*Ready for roadmap: yes*
