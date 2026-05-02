# Phase 216: Crawler Root Files, Express Wiring & Production Validation - Context

**Gathered:** 2026-04-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 216 ships the apex-served crawler files (`/robots.txt`, `/sitemap.xml`, `/llms.txt`, `/llms-full.txt`) with correct headers, patches the Express server so per-route prerendered HTML is preferred over the SPA shell for marketing routes (while preserving `/dashboard` SPA behavior), and validates the deployed site via a curl-based smoke run plus manual Search Console / Rich Results checks. Builds on Phase 215's prerender output — without per-route HTML on disk, this phase is a no-op.

</domain>

<decisions>
## Implementation Decisions

### llms.txt voice (CRAWL-03)
- **D-01:** llms.txt opens with definition + capability framing. Structure:
  - H1: `# FSB (Full Self-Browsing)`
  - One-paragraph body (verbatim): `FSB (Full Self-Browsing) is an open-source Chrome extension that automates the browser through natural language. You describe a task; FSB plans the clicks, types, and navigation to complete it. Multi-model AI (xAI, OpenAI, Anthropic, Gemini, local), 50+ browser actions, 142+ site guides. MIT-licensed, BYO API key.`
  - Then `## Docs` section linking `/about`, `/support`, `/privacy`, `https://github.com/lakshmanturlapati/FSB`, and `/llms-full.txt` (each as a markdown link with one-line description per llmstxt.org convention).
- **D-02:** Action and site-guide counts ("50+ browser actions, 142+ site guides") are content claims that must match reality at build time. The prebuild script may templatize these (`{{ACTION_COUNT}}`, `{{GUIDE_COUNT}}`) sourcing from existing constants modules if the values would otherwise drift; if the script cannot read accurate counts deterministically, leave the literals and let the planner flag a follow-up todo.

### llms-full.txt comparison framing (CRAWL-04)
- **D-03:** Comparison vs Browser Use / Project Mariner / Operator uses neutral capability-matrix tone — short factual paragraphs of "what they are, where FSB overlaps, where FSB differs." No "better than" claims. The AI summarizer decides positioning. Lower drift risk if competitor pricing/features change.
- **D-04:** llms-full.txt section structure (top-down):
  1. Project description (long-form expansion of llms.txt paragraph)
  2. Capabilities list (action categories, supported AI providers, install posture)
  3. Install instructions (chrome://extensions → developer mode → load unpacked, BYO API key)
  4. Key concepts (uniqueness-scored selectors, visual feedback / orange glow, action verification, MCP server surface)
  5. Comparison framing (Browser Use, Project Mariner, Operator — neutral tone per D-03)
  6. Links section mirroring llms.txt Docs entries

### llms-full.txt assembly source (CRAWL-05)
- **D-05:** llms-full.txt is built from a single hand-curated source file checked into the repo at `showcase/angular/scripts/llms-full.source.md`. The prebuild script copies this file to `showcase/angular/public/llms-full.txt` with a generated-at header (`<!-- generated YYYY-MM-DD by build-crawler-files.mjs; edit llms-full.source.md -->`) and asserts byte length < 256000.
- **D-06:** Editorial control sits in one file; no auto-extraction from PROJECT.md / CLAUDE.md (those evolve for internal reasons unrelated to crawler positioning). Hybrid token-substitution (e.g., `{{VERSION}}`) is OUT of scope for v0.9.46 unless the planner finds counts that materially drift between builds.

### sitemap.xml generation (CRAWL-02 + CRAWL-05)
- **D-07:** `<lastmod>` is the build-date in ISO 8601 (`YYYY-MM-DD`), regenerated each `npm --prefix showcase/angular run build` via the prebuild script. Per-route file-mtime tracking is OUT of scope — single build-date applied to all four `<loc>` entries is acceptable for a 4-route marketing sitemap.

### robots.txt generation (CRAWL-01)
- **D-08:** robots.txt is hand-authored and checked in at `showcase/angular/public/robots.txt`. The prebuild script does NOT regenerate it — the bot list is a stable allowlist that changes rarely (verified 2026 list per ROADMAP.md). Drift here would be a deliberate edit, not a build artifact.

### Express server patch approach (SRV-01, SRV-02)
- **D-09:** Replace `server/server.js:111-117` with a custom middleware (NOT `express.static({ extensions: ['html'] })`) that:
  1. For `/`, `/about`, `/privacy`, `/support`: try `path.join(staticPath, req.path === '/' ? '' : req.path, 'index.html')` and `res.sendFile(...)` if the file exists.
  2. For `/dashboard` (exact match only — D-10): serve root `index.html` (SPA shell).
  3. Else: 404.
  Custom middleware is explicit and readable; avoids subtle interactions between `extensions: ['html']` and Express route ordering. The existing `express.static(...)` block at server.js:97-108 stays untouched (handles JS/CSS/asset serving with the existing no-cache header policy).
- **D-10:** `/dashboard` whitelist is exact-match only. No prefix matching. If future subroutes (`/dashboard/settings` etc.) are added, the whitelist is extended explicitly at that time. Prevents accidental SPA-shadowing of future apex routes that happen to start with `dashboard`.

### Cache-Control coexistence (SRV-03)
- **D-11:** Existing `setHeaders` at server.js:101-106 sets `no-cache, must-revalidate` for `.js`/`.css`/`.html` (preserves dashboard hot-update behavior). The crawler files (`*.txt`, `*.xml`) need `Cache-Control: public, max-age=3600`. Implementation: extend the existing `setHeaders` callback to set `public, max-age=3600` for `.txt`/`.xml` filenames, leaving `.js`/`.css`/`.html` on `no-cache` unchanged. Same `express.static` block, different branch.

### Smoke validation automation (SMOKE-01..03)
- **D-12:** Add `showcase/angular/scripts/smoke-crawler.mjs` invoked via `npm run smoke:crawler` in `showcase/angular/package.json`. The script:
  - Accepts `BASE_URL` env var (defaults to `https://full-selfbrowsing.com`).
  - Curls `/`, `/about`, `/privacy`, `/support` with `User-Agent: GPTBot`; asserts HTTP 200, route-specific `<title>` substring, route-specific canonical href, presence of `<script type="application/ld+json">` on home.
  - Curls `/robots.txt`, `/sitemap.xml`, `/llms.txt`, `/llms-full.txt`; asserts HTTP 200, expected `Content-Type` header, non-empty body, `wc -c` < 256000 for llms-full.txt.
  - Resolves every `<loc>` in sitemap.xml; asserts each returns 200 with route-specific HTML.
  - Uses `node:fetch` + `node:assert` only — zero new npm deps.
  - Exits 0 on success, non-zero with a printed report on failure.
- **D-13:** SMOKE-04 (Google Rich Results Test + Search Console "Test live URL") is a manual UAT item. Items are added to a `216-HUMAN-UAT.md` after execution; they require browser sessions and Google account auth and cannot be scripted.

### softwareVersion source (carries forward Phase 215 D-14)
- **D-14:** `showcase/angular/src/app/core/seo/version.ts` (created in Phase 215 Plan 03 as an interim constant) is now generated by the prebuild script from `manifest.json`'s `version` field. Build-time write, not runtime read. Replaces the Phase 215 hardcoded fallback.

### Claude's Discretion

- **smoke-crawler.mjs report format** — table, JSON, or plain text. Planner picks; the constraint is exit code semantics (0 = pass, non-zero = at least one assertion failed).
- **Prebuild script structure** — single mjs file with helper functions vs split into `build-sitemap.mjs` / `build-llms.mjs` / `write-version.ts`. Planner picks based on readability. Constraint: one npm `prebuild` script, zero new npm deps.
- **Express middleware vs router-based handler** — `app.use((req, res, next) => ...)` vs `app.get(['/', '/about', '/privacy', '/support'], ...)` + `app.get('/dashboard', ...)`. Either is acceptable; planner picks the cleaner expression for the route set in D-09.
- **Sitemap XML formatting** — pretty-printed (newlines per element) vs single-line. Pretty-print preferred for human review; not load-bearing.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope and decisions
- `.planning/REQUIREMENTS.md` §LD/CRAWL/SRV/SMOKE — locked acceptance criteria for LD-03, CRAWL-01..05, SRV-01..03, SMOKE-01..04
- `.planning/ROADMAP.md` Phase 216 section — goal, success criteria, dependency on Phase 215
- `.planning/phases/215-prerender-foundation-per-route-metadata-structured-data/215-CONTEXT.md` — D-02 canonical host, D-12 sameAs, D-14 softwareVersion source, D-16 home description, D-18 dashboard exclusion
- `.planning/phases/215-prerender-foundation-per-route-metadata-structured-data/215-RESEARCH.md` §Validation Architecture — pattern for build-output assertions reused here

### External standards
- `https://llmstxt.org/` — llms.txt + llms-full.txt format spec referenced by CRAWL-03/04
- `https://search.google.com/test/rich-results` — manual SMOKE-04 validation
- `https://www.sitemaps.org/protocol.html` §lastmod — locked behavior for CRAWL-02

### Source files to be modified
- `server/server.js:97-117` — express.static block (D-11) + SPA fallback (D-09, D-10)
- `showcase/angular/angular.json` §projects.showcase-angular.architect.build.options.assets — already has `{ "glob": "**/*", "input": "public" }`, no change needed
- `showcase/angular/package.json` — add `prebuild` and `smoke:crawler` scripts (D-05, D-12)
- `showcase/angular/src/app/core/seo/version.ts` — generated by prebuild from manifest.json (D-14)

### Files to be created
- `showcase/angular/public/robots.txt` (CRAWL-01) — hand-authored
- `showcase/angular/public/sitemap.xml` (CRAWL-02) — generated by prebuild
- `showcase/angular/public/llms.txt` (CRAWL-03) — generated from a source file (D-01) OR hand-authored, planner picks
- `showcase/angular/public/llms-full.txt` (CRAWL-04) — generated from `scripts/llms-full.source.md` (D-05)
- `showcase/angular/scripts/build-crawler-files.mjs` (CRAWL-05) — prebuild script
- `showcase/angular/scripts/llms-full.source.md` (D-05) — hand-curated long-form source
- `showcase/angular/scripts/smoke-crawler.mjs` (D-12) — production smoke script

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `server/server.js` express.static block (line 97-108) — extend `setHeaders` callback for `.txt`/`.xml` Cache-Control branch (D-11) instead of adding a parallel static handler
- `showcase/angular/angular.json` `public` glob — already wired; any file dropped into `showcase/angular/public/` ships to `dist/showcase-angular/browser/` with no further config
- `.planning/phases/215-*/verify.sh` umbrella + `verify-pre.sh` / `verify-meta.sh` / `verify-ld.sh` — proven pattern for plan-gated artifact verification; Phase 216 plans should follow the same shape
- `showcase/angular/src/app/core/seo/version.ts` (Phase 215 Plan 03) — interim hardcoded constant; the prebuild script overwrites it with manifest.json-sourced value (D-14)
- `manifest.json` (repo root) — Chrome extension manifest, source of truth for `softwareVersion` per Phase 215 D-14

### Established Patterns
- Phase 215 plans built file-disjoint waves with `verify-*.sh` per plan + umbrella that chains them. Phase 216 should follow the same pattern: per-plan verify scripts + umbrella, no JS test framework.
- `htmlRedirects` map at server.js:88-95 already redirects legacy `.html` URLs to clean `/about`, `/privacy`, `/support`. Keep — it complements D-09 (legacy URLs continue to redirect, then the patched fallback serves the prerendered HTML).
- No existing prebuild script. Adding `prebuild` to `package.json` runs automatically before `npm run build` per npm conventions; no Angular Builder modification needed.

### Integration Points
- The Express patch lands on the existing branch `Refinements`. No worktree/branching gymnastics required for this phase.
- The smoke script is invokable both locally (`BASE_URL=http://localhost:3000 npm run smoke:crawler`) and against production (`npm run smoke:crawler` with default `https://full-selfbrowsing.com`). Same script, different target.

</code_context>

<specifics>
## Specific Ideas

- llms.txt opening paragraph is **verbatim** as written in D-01. Do not paraphrase; do not let downstream agents rewrite for "tighter copy". The user picked this voice.
- llms-full.txt comparison section names exactly three competitors: Browser Use, Project Mariner, Operator. The deferred backlog (DISCO-FUTURE-02) tracks a future Articles/comparison page set; this is the only place comparison framing belongs in v0.9.46.
- The smoke script must work on a developer laptop without secrets — `BASE_URL=http://localhost:3000` mode is a hard requirement so contributors can sanity-check changes before deploy.
- Cache-Control: keep `.html` on `no-cache, must-revalidate` (existing) so dashboard updates ship live; only `.txt`/`.xml` get `public, max-age=3600`.

</specifics>

<deferred>
## Deferred Ideas

- **OG image per-route** (CRAWL-FUTURE-01) — already deferred in ROADMAP.md backlog
- **FAQ page + FAQPage JSON-LD** (DISCO-FUTURE-01) — already deferred
- **Comparison pages** (`/vs-browser-use`, etc., DISCO-FUTURE-02) — already deferred; llms-full.txt comparison framing per D-03/D-04 is the v0.9.46 surrogate
- **BreadcrumbList JSON-LD** (DISCO-FUTURE-03) — already deferred
- **Off-page push (Show HN, Reddit, awesome-list PRs)** (DISCO-FUTURE-04) — already deferred
- **Search Console + Bing Webmaster registration** (DISCO-FUTURE-05) — already deferred; SMOKE-04 manual UAT here is the v0.9.46 surrogate
- **provideClientHydration() future-proofing** (PRE-FUTURE-01) — already deferred from Phase 215
- **Token substitution / hybrid llms-full.txt assembly** — flagged in D-06 as out of scope; revisit if action/guide counts drift between releases enough to matter
- **Per-file mtime sitemap lastmod** — flagged in D-07 as out of scope for a 4-route sitemap; revisit when route count grows or content updates need finer granularity

</deferred>

---

*Phase: 216-crawler-root-files-express-wiring-production-validation*
*Context gathered: 2026-04-30*
