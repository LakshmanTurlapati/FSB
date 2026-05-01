# Roadmap: FSB (Full Self-Browsing)

## Status

Active milestone: **v0.9.46 Site Discoverability (SEO + GEO)**.

Make `full-selfbrowsing.com` discoverable to traditional search engines and generative AI search by prerendering the Angular SPA marketing routes (`/`, `/about`, `/privacy`, `/support`) and shipping LLM/crawler-aware root files. The site currently returns only the literal string "FSB" to non-JS crawlers; static prerender plus crawler files unblocks every downstream discoverability play.

## Milestones

- 🟡 **v0.9.46 Site Discoverability (SEO + GEO)** -- in progress (started 2026-04-30)
- ✅ **v0.9.45rc1 Sync Surface, Agent Sunset & Stream Reliability** -- shipped 2026-04-29
- ✅ **v0.9.40 Session Lifecycle Reliability** -- shipped 2026-04-25
- ✅ **v0.9.36 MCP Visual Lifecycle & Client Identity** -- shipped 2026-04-24
- ✅ **v0.9.35 MCP Plug-and-Play Reliability** -- shipped 2026-04-24
- ✅ **v0.9.34 Vault, Payments & Secure MCP Access** -- shipped 2026-04-22

## Phases

- [ ] **Phase 215: Prerender Foundation, Per-Route Metadata & Structured Data** - Enable Angular static prerender for `/`, `/about`, `/privacy`, `/support`; per-route `Title`/`Meta`/canonical/OG/Twitter via Angular services; `Organization` JSON-LD in `index.html` + `SoftwareApplication` JSON-LD on home; `noindex` on `/dashboard`; guard `localStorage` access in `index.html` for the prerender environment
- [ ] **Phase 216: Crawler Root Files, Express Wiring & Production Validation** - Generate `robots.txt` / `sitemap.xml` / `llms.txt` / `llms-full.txt` via prebuild Node script; patch `server/server.js` SPA fallback to prefer per-route prerendered HTML and pin `*.txt`/`*.xml` headers; live `curl -A GPTBot` smoke against production; Rich Results Test validation

## Phase Details

### Phase 215: Prerender Foundation, Per-Route Metadata & Structured Data
**Goal**: A production build emits per-route prerendered `index.html` files for the four marketing routes with route-specific metadata and structured data baked into the served HTML, so AI crawlers (GPTBot, ClaudeBot, PerplexityBot) and traditional search engines can read what FSB is without executing JavaScript
**Depends on**: Nothing (keystone phase -- every other v0.9.46 deliverable depends on prerender output existing on disk)
**Requirements**: PRE-01, PRE-02, PRE-03, PRE-04, PRE-05, META-01, META-02, META-03, META-04, LD-01, LD-02
**Success Criteria** (what must be TRUE):
  1. `npm --prefix showcase/angular run build` completes successfully and emits `dist/showcase-angular/browser/index.html`, `about/index.html`, `privacy/index.html`, and `support/index.html`; `dist/showcase-angular/browser/dashboard/index.html` does NOT exist
  2. Opening each prerendered file in a text editor shows a route-specific `<title>` and `<meta name="description">` (no two prerendered pages share the same title), a `<link rel="canonical" href="https://full-selfbrowsing.com/<route>">`, and the full set of OpenGraph + Twitter Card tags for that route
  3. The home page's prerendered `index.html` contains exactly one `<script type="application/ld+json">` block with `@type: "Organization"` (inherited shape, present on every prerendered route) and exactly one with `@type: "SoftwareApplication"` (home only); both JSON payloads escape `</` as `\u003c/` to defeat script-tag injection
  4. The `/dashboard` route, when reached at runtime in a browser, sets `<meta name="robots" content="noindex, nofollow">` via Angular's `Meta` service so search engines that JS-render the page do not index it
  5. The inline theme bootstrap IIFE in `showcase/angular/src/index.html` (lines 8-15) is wrapped in a `typeof localStorage !== 'undefined'` guard so the prerender environment does not throw `ReferenceError: localStorage is not defined`
**Plans:** 5 plans
  - [x] 216-01-PLAN.md -- Static crawler files (robots.txt + llms.txt + llms-full.source.md, CRAWL-01 + CRAWL-03)
  - [x] 216-02-PLAN.md -- Prebuild script + generated sitemap.xml + llms-full.txt + version.ts (CRAWL-02 + CRAWL-04 + CRAWL-05 + LD-03 carry)
  - [x] 216-03-PLAN.md -- Express server SPA-fallback patch + .txt/.xml Cache-Control (SRV-01 + SRV-02 + SRV-03)
  - [x] 216-04-PLAN.md -- Production smoke script + verify-smoke.sh (SMOKE-01 + SMOKE-02 + SMOKE-03)
  - [x] 216-05-PLAN.md -- HUMAN-UAT scaffold for Search Console + Rich Results (LD-03 + SMOKE-04)

### Phase 216: Crawler Root Files, Express Wiring & Production Validation
**Goal**: Crawler-aware root files live at the apex (`/robots.txt`, `/sitemap.xml`, `/llms.txt`, `/llms-full.txt`) with correct headers, the Express server prefers per-route prerendered HTML over the SPA shell for marketing routes while preserving `/dashboard` SPA behavior, and the deployed site passes a live `curl -A GPTBot` smoke plus Google's Rich Results Test
**Depends on**: Phase 215 (sitemap entries must point at real prerendered HTML; the Express patch is a no-op without per-route files on disk; production validation requires the prerendered output to be deployed)
**Requirements**: LD-03, CRAWL-01, CRAWL-02, CRAWL-03, CRAWL-04, CRAWL-05, SRV-01, SRV-02, SRV-03, SMOKE-01, SMOKE-02, SMOKE-03, SMOKE-04
**Success Criteria** (what must be TRUE):
  1. `curl -I https://full-selfbrowsing.com/robots.txt` returns HTTP 200 with `Content-Type: text/plain; charset=utf-8` and `Cache-Control: public, max-age=3600`; the body contains explicit `User-agent: <name>` + `Allow: /` blocks for GPTBot, ChatGPT-User, OAI-SearchBot, ClaudeBot, Claude-User, Claude-SearchBot, PerplexityBot, Perplexity-User, Google-Extended, Applebot-Extended, Amazonbot, Bytespider, CCBot, Meta-ExternalAgent, DuckAssistBot plus `User-agent: *` allow-all and a final `Sitemap: https://full-selfbrowsing.com/sitemap.xml` line; the same posture holds for `/sitemap.xml` (`application/xml; charset=utf-8`), `/llms.txt`, and `/llms-full.txt` (each `text/plain; charset=utf-8`); `wc -c llms-full.txt` < 256000
  2. `curl -A "GPTBot" https://full-selfbrowsing.com/about` returns the prerendered about-page HTML with the route-specific `<title>` and canonical (NOT the home page), and the same holds for `/privacy` and `/support`; `curl -A "GPTBot" https://full-selfbrowsing.com/` returns prerendered home HTML with non-empty `<app-root>` and at least one `<script type="application/ld+json">` block
  3. `curl -I https://full-selfbrowsing.com/dashboard` continues to return the SPA shell (root `index.html`) so the live runtime surface bootstraps as it does today; the server fallback whitelist preserves `/dashboard` and only `/dashboard` for SPA fallback
  4. Every `<loc>` in `sitemap.xml` resolves to HTTP 200 prerendered HTML when curled with a non-JS user agent; the `prebuild` npm script regenerates `sitemap.xml` `<lastmod>` and `llms-full.txt` content at build time with zero new npm dependencies
  5. Google's Rich Results Test (https://search.google.com/test/rich-results) on the deployed home URL detects exactly one `Organization` and exactly one `SoftwareApplication` block with zero errors and zero warnings; Search Console "Test live URL" passes for `/`, `/about`, `/privacy`, `/support` (rendered HTML matches prerendered HTML; no `noindex` leaks; no JavaScript-only content)
**Plans:** 5 plans
  - [x] 216-01-PLAN.md -- Static crawler files (robots.txt + llms.txt + llms-full.source.md, CRAWL-01 + CRAWL-03)
  - [x] 216-02-PLAN.md -- Prebuild script + generated sitemap.xml + llms-full.txt + version.ts (CRAWL-02 + CRAWL-04 + CRAWL-05 + LD-03 carry)
  - [x] 216-03-PLAN.md -- Express server SPA-fallback patch + .txt/.xml Cache-Control (SRV-01 + SRV-02 + SRV-03)
  - [x] 216-04-PLAN.md -- Production smoke script + verify-smoke.sh (SMOKE-01 + SMOKE-02 + SMOKE-03)
  - [x] 216-05-PLAN.md -- HUMAN-UAT scaffold for Search Console + Rich Results (LD-03 + SMOKE-04)

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 215. Prerender Foundation, Per-Route Metadata & Structured Data | 3/3 | Complete    | 2026-04-30 |
| 216. Crawler Root Files, Express Wiring & Production Validation | 5/5 | Complete    | 2026-05-01 |

## Backlog

### v0.9.46 deferred (research-flagged, explicitly out of scope)

- **CRAWL-FUTURE-01**: Per-route OG images (4 unique 1200x630 PNGs) -- v0.9.46 ships with one shared image; design pass deferred
- **DISCO-FUTURE-01**: FAQ page (`/faq`) with `FAQPage` JSON-LD (15-25 definition-first Q&A pairs)
- **DISCO-FUTURE-02**: Comparison pages (`/vs-browser-use`, `/vs-project-mariner`, `/vs-stagehand`, `/vs-browseros`) with `Article` schema
- **DISCO-FUTURE-03**: `BreadcrumbList` JSON-LD on every route (deferred until route depth exceeds 1)
- **DISCO-FUTURE-04**: Off-page push -- Show HN, Reddit launches, awesome-list PRs, 90-second YouTube demo with transcript
- **DISCO-FUTURE-05**: Search Console + Bing Webmaster Tools registration with property verification and weekly index-coverage monitoring
- **PRE-FUTURE-01**: `provideClientHydration()` future-proofing for hybrid SSR migration

### Carry-over from prior milestones

- Deferred Angular migration requirements (DASH-08 through MIGR-03) remain parked from v0.9.29
- Live UAT for v0.9.34 vault behavior and MCP payment approve/deny/delayed approval remains accepted validation debt
- Phase 999.1 backlog (`mcp-tool-gaps-click-heuristics`) parked
- Phase 209 has 7 human_needed UAT items (live CDP click/keyboard/scroll delivery)

### Known tech debt with milestone-after-next deadline

- **Angular 19 EOL: 2026-05-19** -- the showcase Angular shell must migrate to Angular 20 before this date. Out of scope for v0.9.46; explicit milestone-after-next deadline tracked in PROJECT.md

<details>
<summary>✅ v0.9.45rc1 Sync Surface, Agent Sunset & Stream Reliability (Phases 209-214) -- SHIPPED 2026-04-29</summary>

Archive:
- [.planning/milestones/v0.9.45rc1-ROADMAP.md](./milestones/v0.9.45rc1-ROADMAP.md)
- [.planning/milestones/v0.9.45rc1-REQUIREMENTS.md](./milestones/v0.9.45rc1-REQUIREMENTS.md)

</details>

Older milestone phase details live in the archived roadmap snapshots under `.planning/milestones/`.

---
*Roadmap created for v0.9.46: 2026-04-30*
*First phase: 215 (continues numbering from v0.9.45rc1's Phase 214)*
