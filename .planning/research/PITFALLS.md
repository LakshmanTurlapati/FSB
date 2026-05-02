# Pitfalls Research

**Domain:** Adding SEO + GEO (Generative Engine Optimization) to an existing Angular 19 SPA hosted on Express + Fly.io
**Researched:** 2026-04-30
**Confidence:** HIGH for prerender + Express middleware ordering + JSON-LD validation; MEDIUM for AI-crawler file conventions (`llms.txt`/`llms-full.txt` are de-facto standards, not W3C); MEDIUM for Fly.io crawler latency specifics.
**Stack confirmed:** Angular 19 standalone routes (`HomePage`, `AboutPage`, `DashboardPage`, `PrivacyPage`, `SupportPage` -- all `loadComponent` lazy), Express static + SPA fallback in `server/server.js`, single-region `sjc` Fly.io with `force_https = true`, and an inline `<script>` in `src/index.html` that calls `localStorage.getItem('fsb-showcase-theme')` before bootstrap.

## Critical Pitfalls

### Pitfall 1: `localStorage` access in `index.html` crashes Angular prerender

**What goes wrong:**
The current `showcase/angular/src/index.html` ships an inline IIFE that calls `localStorage.getItem('fsb-showcase-theme')` (lines 8-15) and conditionally sets `data-theme` on `<html>` before Angular bootstraps. Under Angular's static prerender (`@angular/build:prerender` builder, which runs the app in a Node + JSDOM-like environment), `localStorage` is undefined. The script throws `ReferenceError: localStorage is not defined` (or in some configurations, `window is not defined`), which either fails the prerender entirely or -- worse -- silently produces an HTML file with the wrong theme baked in and an unhandled exception that breaks hydration once SSR is later turned on.

**Why it happens:**
The inline script was written under the SPA-only assumption that the document is always rendered in a browser. Prerender executes the `index.html` template plus the bootstrapped app in a server-like context where DOM globals are mocked but storage APIs are not. Developers add prerender expecting Angular code to be flagged via `isPlatformBrowser()` guards but forget that **inline scripts in `index.html` run before any Angular guard exists**.

**How to avoid:**
- Wrap the inline IIFE in a `typeof localStorage !== 'undefined'` guard:
  ```html
  <script>
    (function initShowcaseTheme() {
      if (typeof localStorage === 'undefined') return;
      try {
        const saved = localStorage.getItem('fsb-showcase-theme');
        if (saved === 'light') document.documentElement.setAttribute('data-theme', 'light');
      } catch (_) { /* private mode, prerender, etc. */ }
    })();
  </script>
  ```
- Bake the **default (dark) theme** into the prerendered HTML; the inline script only **upgrades** to light when `localStorage` is available at runtime. This avoids a Flash Of Unstyled Theme (FOUT) on the prerendered page.
- For any Angular component that touches `localStorage`, `window`, `document.cookie`, etc., use `inject(PLATFORM_ID)` + `isPlatformBrowser(platformId)` and gate the access. This is a hard requirement before any future SSR migration.

**Warning signs:**
- `npm run prerender` (or `ng build --prerender`) emits `ReferenceError: localStorage is not defined` or `window is not defined`.
- Prerendered `index.html` is byte-identical to the SPA shell (i.e., prerender silently fell back to the empty `<app-root>`).
- Production build succeeds but `curl -A "GPTBot" https://full-selfbrowsing.com/` still returns the literal string "FSB" with no head metadata.

**Phase to address:**
**Phase: Prerender Foundation** -- must land the `typeof localStorage` guard before any prerender attempt. This is the very first code change of the milestone.

---

### Pitfall 2: `/dashboard` accidentally prerendered, breaking interactive runtime

**What goes wrong:**
`/dashboard` is the QR-paired remote control surface and depends on live WebSocket state, `chrome.storage.local`-derived data flowing through `dashboard-runtime-state.js`, and runtime-only globals (`html5-qrcode`, `lz-string`). If it gets included in the prerender route list, the static HTML will bake in an empty/uninitialized state -- users hitting `/dashboard` will see a stale skeleton until JS hydrates, **or** the prerender will throw because it tries to call browser-only APIs during static generation.

Worse: if the prerendered `/dashboard/index.html` ships with cached `Cache-Control` headers from Fly.io's edge or a CDN, users can be served a stale snapshot for hours.

**Why it happens:**
The default Angular prerender configuration (`outputMode: 'static'` with `prerender: true`) prerenders **every route in `app.routes.ts` that doesn't have a wildcard or a parameter**. All five routes (`''`, `about`, `dashboard`, `privacy`, `support`) match this filter. Developers must explicitly opt `/dashboard` out.

**How to avoid:**
- Use the explicit `routes` array in the prerender config (Angular 19 supports `prerender: { routes: [...] }` in `angular.json` or a `routes.txt` discovery file). List only `/`, `/about`, `/privacy`, `/support`.
- Alternatively, supply a `routes.txt` to `@angular/build:prerender` containing exactly those four lines.
- Add a build-time assertion: after prerender, run a script that asserts `dist/showcase-angular/browser/dashboard/index.html` does **not** exist. Fail the build if it does.
- In `server/server.js`, the SPA fallback for `/dashboard` must continue serving the unmodified `index.html` (the SPA shell), not any prerendered variant.

**Warning signs:**
- `dist/.../browser/dashboard/index.html` exists after build.
- Dashboard QR pairing fails on first paint with "lz-string is not defined" or empty state until manual reload.
- Live UAT shows users seeing yesterday's pairing state.

**Phase to address:**
**Phase: Prerender Foundation** -- explicit route allowlist must be declared and asserted in the same phase that introduces prerender.

---

### Pitfall 3: Express middleware order swallows `/robots.txt`, `/sitemap.xml`, and prerendered HTML

**What goes wrong:**
Two compounding ordering bugs are likely in `server/server.js`:

1. **Prerendered HTML shadowed by SPA catch-all.** The current SPA fallback (lines 111-117) handles `'/', '/about', '/dashboard', '/privacy', '/support'` by sending `path.join(staticPath, 'index.html')` -- the **root** `index.html`. After prerender, the per-route HTML lives at `dist/.../browser/about/index.html`, `dist/.../browser/privacy/index.html`, etc. If the route handler keeps sending the root `index.html`, the prerendered content is **never served**, even though `express.static` could find it. Crawlers continue to receive empty `<app-root>`.
2. **`/robots.txt` and `/sitemap.xml` swallowed if placed in catch-all.** If a developer adds an `app.get('*', ...)` SPA fallback (as is common in stale Angular guides), it intercepts `/robots.txt`, `/sitemap.xml`, `/llms.txt`, `/llms-full.txt` before `express.static` has a chance to serve them. Result: crawlers get HTML instead of plaintext, and `Content-Type: text/plain` is missing.

**Why it happens:**
Express runs middleware in registration order. The current code registers `express.static` *before* the SPA fallback (good), but the SPA fallback **explicitly handles enumerated routes** and always sends the SPA `index.html` rather than letting `express.static` find a per-route prerendered file first. The fix is to let `express.static` serve `about/index.html` for `/about` (via the `index` option), then only fall through to a single SPA shell for SPA-only routes (`/dashboard`).

**How to avoid:**
- Configure `express.static` with `{ extensions: ['html'], index: 'index.html' }` so a request for `/about` resolves to `dist/.../browser/about/index.html` automatically.
- Replace the enumerated SPA fallback with a **narrow** fallback that only serves the unmodified shell for the SPA-only routes -- explicitly **`/dashboard`** in this codebase. Marketing routes must fall through `express.static`.
- Place root files (`robots.txt`, `sitemap.xml`, `llms.txt`, `llms-full.txt`) in the static path **before** any catch-all. If they live in the Angular `src/` as `assets/`, they'll be copied to `dist/.../browser/` at root level -- verify with `ls dist/showcase-angular/browser/robots.txt` after build.
- Recommended final order: `cors` -> `json` -> request log -> `/api/*` routers -> legacy `.html` redirects -> `express.static(staticPath, { extensions: ['html'] })` -> narrow `/dashboard` SPA shell handler -> error handler.

**Warning signs:**
- `curl -I https://full-selfbrowsing.com/robots.txt` returns `Content-Type: text/html`.
- `curl https://full-selfbrowsing.com/about` returns the SPA shell (empty `<app-root>`) instead of the prerendered HTML with metadata.
- Search Console reports "Sitemap could not be read" because it received HTML.

**Phase to address:**
**Phase: Express Wiring & Crawler Files** -- must land in the same phase that introduces `robots.txt`/`sitemap.xml`/`llms.txt`. Before this phase, prerender output is invisible to crawlers.

---

### Pitfall 4: Invalid or duplicate JSON-LD silently ignored by Google / cited incorrectly by LLMs

**What goes wrong:**
Several failure modes:
1. **Multiple `Organization` blocks** across pages with conflicting fields (e.g., different `logo`, `sameAs`) cause Google to either pick one arbitrarily or ignore all of them. LLMs that scrape JSON-LD as a corpus (Perplexity, ChatGPT browse) may cite stale or contradictory facts.
2. **Wrong `@context`.** `"@context": "http://schema.org"` (HTTP) is technically still parsed by Google but flagged as deprecated; LLM scrapers using strict JSON-LD parsers may reject it. Correct value: `"https://schema.org"`.
3. **Escaping bugs in inline `<script type="application/ld+json">`.** Embedding the literal substring `</script>` anywhere in a value (e.g., a description that mentions "a `</script>` injection bug") closes the JSON-LD block early, breaks the entire document, and causes silent validation failure. The HTML parser is not JSON-aware.
4. **Trailing commas, single quotes, or unescaped newlines** -- JSON-LD requires strict JSON. Angular template interpolation that uses single quotes or pretty-prints multiline strings will produce invalid JSON.
5. **Wrong type combination.** `SoftwareApplication` requires `applicationCategory` and `offers`; missing them downgrades the rich result eligibility. `Organization` requires `name` and `url` minimum.

**Why it happens:**
Developers eyeball the JSON in a template and assume it's valid. Schema.org has 800+ types and most validators (Google Rich Results Test, schema.org validator) only flag *some* errors. JSON-LD is parsed by `JSON.parse`, which is unforgiving of any deviation.

**How to avoid:**
- Use **one** canonical `Organization` block, embedded only on `/` (homepage). Other pages reference it via `@id` rather than redefining it.
- Use **`@id`** anchors: `"@id": "https://full-selfbrowsing.com/#organization"`. The `SoftwareApplication` block on `/` references `"publisher": { "@id": "https://full-selfbrowsing.com/#organization" }`.
- Always use `"@context": "https://schema.org"` (HTTPS).
- Build JSON-LD via a TypeScript function that returns an object, then `JSON.stringify(obj)` it into a sanitized inline script. Run a regex post-process to escape `</` as `<\/` to defeat the script-close attack:
  ```typescript
  const jsonLd = JSON.stringify(schema).replace(/</g, '\\u003c');
  ```
- Validate every generated page in CI: `curl http://localhost:3847/about | npx schema-dts-validator` (or use Google's Rich Results Test API). Fail the build on any error.
- Run **Google Rich Results Test** and **schema.org validator** against every prerendered page before merging.

**Warning signs:**
- Google Rich Results Test reports "Parsing error: Missing comma or '}' after object member."
- Search Console "Enhancements" tab shows zero detected items despite JSON-LD being present.
- LLM-generated answers cite a stale logo URL or wrong company name.

**Phase to address:**
**Phase: Structured Data (JSON-LD)** -- dedicated phase for schema design, sanitization helper, and CI validation gate.

---

### Pitfall 5: `robots.txt` typos block legitimate traffic or expose the dashboard

**What goes wrong:**
- **`Disallow: /` typo** (intended `Disallow:` empty meaning allow-all) blocks the entire site from every crawler. Recovery takes weeks because some crawlers cache `robots.txt` for 24h+.
- **Missing `Allow:` for AI bots** under a restrictive `User-agent: *` group. The grouping rules in robots.txt are scoped: `User-agent: GPTBot` followed by no rules means GPTBot inherits *nothing* -- it's actually allowed by default -- but `User-agent: *` with `Disallow: /` followed by `User-agent: GPTBot` with `Allow: /` works because GPTBot picks the most specific group.
- **Allowing `/dashboard`** to be crawled -- it's an authenticated runtime surface; crawlers will index empty SPA shells with no real content, polluting Google's index with thin pages.
- **Missing or wrong `Sitemap:` line.** Must be absolute URL with protocol: `Sitemap: https://full-selfbrowsing.com/sitemap.xml`. A relative path is silently ignored.
- **Conflicting `User-agent: *` rules.** Two `User-agent: *` blocks in the same file cause undefined behavior across crawlers.
- **CRLF line endings or BOM.** Some crawlers (older Bing variants) reject `robots.txt` with a UTF-8 BOM. Use LF and no BOM.

**Why it happens:**
`robots.txt` syntax is deceptively simple but has subtle precedence rules (most-specific-group-wins, longest-match-path-wins). Developers paste examples from blog posts that target a different site structure.

**How to avoid:**
- Use a known-good template:
  ```
  User-agent: *
  Allow: /
  Disallow: /dashboard
  Disallow: /api/

  User-agent: GPTBot
  Allow: /
  Disallow: /dashboard
  Disallow: /api/

  User-agent: ClaudeBot
  Allow: /
  Disallow: /dashboard
  Disallow: /api/

  User-agent: PerplexityBot
  Allow: /
  Disallow: /dashboard
  Disallow: /api/

  User-agent: Google-Extended
  Allow: /

  Sitemap: https://full-selfbrowsing.com/sitemap.xml
  ```
- Validate with Google's robots.txt Tester (Search Console) before deploy.
- Add a CI check: `curl -s https://staging-url/robots.txt | grep -E "^Disallow: /$"` should return nothing.
- Save the file as ASCII / UTF-8 without BOM, LF line endings.

**Warning signs:**
- `Disallow: /` appears anywhere in the file.
- `Sitemap:` line is missing or uses `http://` (mixed-content) or relative path.
- Search Console shows "Blocked by robots.txt" on the homepage.
- `curl -A "GPTBot" https://full-selfbrowsing.com/` returns 200 but the bot's logs show it never crawled.

**Phase to address:**
**Phase: Crawler Files (robots/sitemap/llms)** -- must include explicit per-bot rules and a validation script in CI.

---

### Pitfall 6: `sitemap.xml` rejected by Search Console (lastmod format, 404 routes, wrong protocol)

**What goes wrong:**
- **`lastmod` in wrong format.** Must be **W3C Datetime** (ISO 8601). `"2026-04-30"` is valid; `"04/30/2026"` and `"April 30, 2026"` are rejected.
- **Listing routes that 404.** If you list `/faq` (deferred per PROJECT.md) but it's not implemented, Search Console flags it as an error and may de-prioritize the entire sitemap.
- **Wrong protocol or host.** `<loc>http://full-selfbrowsing.com/about</loc>` will be rejected because the canonical is HTTPS (Fly.io `force_https` redirects). The sitemap host **must match** the deployed host exactly (no `www.` if the site is apex, no trailing slash mismatch).
- **Missing XML declaration or namespace.** Must start with `<?xml version="1.0" encoding="UTF-8"?>` and use `xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"`.
- **Sitemap > 50MB or > 50,000 URLs** without sitemap index -- not an issue for this site (5 routes), but worth noting.
- **No `Content-Type: application/xml`.** If served as `text/html`, some validators complain.

**Why it happens:**
Search Console is strict; manually-written XML often has subtle errors. Developers test by visiting the URL in a browser (which renders any well-formed XML) and assume it works.

**How to avoid:**
- Generate the sitemap programmatically (build script that reads the prerender route list) so it stays in sync with `app.routes.ts` minus `/dashboard`.
- Validate at build time: `xmllint --noout dist/.../browser/sitemap.xml` and pipe through an XML sitemap validator before deploy.
- Use `YYYY-MM-DD` for `lastmod` (W3C Datetime short form is acceptable).
- Hard-code the production base URL `https://full-selfbrowsing.com` and assert in the build script that every `<loc>` starts with that exact prefix.
- Ensure `express.static` serves `.xml` with `Content-Type: application/xml` (Express does this by default via `mime-types`, but verify with `curl -I`).

**Warning signs:**
- Search Console: "Couldn't fetch" or "URL not allowed".
- `xmllint` exits non-zero.
- Any `<loc>` URL returns non-200 when curled.

**Phase to address:**
**Phase: Crawler Files (robots/sitemap/llms)** -- sitemap generation must be part of the build, not hand-maintained.

---

### Pitfall 7: `llms.txt` / `llms-full.txt` pointing at JS-rendered URLs or oversized

**What goes wrong:**
- **`llms.txt` links to URLs that require JavaScript.** The whole point of `llms.txt` is that LLM crawlers (which often don't execute JS) get a curated map of human-readable content. If `llms.txt` links to `/dashboard` or to a SPA route that hasn't been prerendered, the LLM scrapes empty HTML.
- **`llms-full.txt` exceeds practical size limits.** No formal size cap exists, but published llms.txt examples and reference implementations suggest staying under ~1MB; some crawlers truncate at ~256KB. Dumping every page's full text plus chat logs blows past this.
- **Format drift.** `llms.txt` is a markdown-flavored format with a specific header convention (`# Title`, `> Summary`, `## Section`, list items as `- [Name](url): description`). Some 2024 examples used different conventions; the de-facto standard codified in late-2024/early-2025 by Anthropic + community is markdown with H1 title and H2 sections.
- **Content-Type wrong.** Must be `text/plain; charset=utf-8` (or `text/markdown` per some specs). HTML or octet-stream causes some scrapers to skip.
- **Linking to non-canonical URLs.** Listing `https://full-selfbrowsing.com/about/` (trailing slash) when the canonical is `/about` (no slash, per Angular routing) creates duplicate-content issues.

**Why it happens:**
`llms.txt` is a young convention (proposed 2024, gaining adoption 2025); guidance is fragmented across blog posts. Developers copy a template and forget to verify their own links resolve in a non-JS context.

**How to avoid:**
- Verify every URL in `llms.txt` returns meaningful prerendered HTML: `curl -A "ClaudeBot" https://full-selfbrowsing.com/about | grep -c "<title>"` should be > 0 and the title should not be the literal "FSB" placeholder.
- Cap `llms-full.txt` at the **prerendered marketing pages only** (`/`, `/about`, `/privacy`, `/support`). Do **not** include dashboard content, dynamic data, or API responses.
- Keep `llms-full.txt` under 256KB; if it grows beyond that, split into per-page sections and rely on `llms.txt` as the index.
- Use the canonical (no-trailing-slash) URLs that match `app.routes.ts` exactly.
- Set `Content-Type: text/plain; charset=utf-8` explicitly in `express.static` (override via `setHeaders` callback if needed).
- Pin to the current spec at https://llmstxt.org/ (community reference) and Anthropic's own examples; revisit quarterly because the format is evolving.

**Warning signs:**
- `wc -c dist/.../browser/llms-full.txt` > 256000.
- Any link in `llms.txt` returns empty `<app-root>` when fetched without JS.
- Multiple H1s, missing summary blockquote, or list items without descriptions.

**Phase to address:**
**Phase: Crawler Files (robots/sitemap/llms)** -- generate `llms.txt` from prerendered output, not from source.

---

### Pitfall 8: Fly.io `force_https` redirect chain breaks bots that don't follow redirects

**What goes wrong:**
With `force_https = true` in `fly.toml`, Fly's edge proxy issues a 301 redirect from `http://full-selfbrowsing.com/*` -> `https://full-selfbrowsing.com/*`. Most major bots (Googlebot, GPTBot, ClaudeBot) follow redirects, but:
- **Some smaller AI scrapers** (academic research crawlers, less-mature bots) don't follow redirects and just record the 301.
- **Submission tools** (Bing Webmaster, IndexNow ping endpoints) may submit `http://` URLs from a paste; if the redirect chain has any hop that returns 5xx during a Fly machine cold start (machines `auto_stop_machines = 'stop'`), the submission can fail silently.
- **Cold starts.** With `min_machines_running = 1` and `auto_stop_machines = 'stop'`, single-region `sjc` deployment, an Asia-Pacific or European crawler hits cold-start latency. Some crawlers have ~5-10s timeouts and abandon the fetch.
- **Mixed protocol in `Sitemap:` directive.** If `robots.txt` says `Sitemap: http://...` and Fly redirects, some crawlers report a "warning: redirect on sitemap" and de-prioritize.

**Why it happens:**
`force_https` is correct for browser users but adds a hop for crawlers. Single-region deployment is fine for human users (Fly's anycast routes to nearest edge) but the actual app server is in `sjc` only.

**How to avoid:**
- Always use `https://` URLs in **all** crawler-facing files: `robots.txt` `Sitemap:`, `sitemap.xml` `<loc>`, `llms.txt` links, JSON-LD `url` and `@id`. No exceptions.
- Keep `min_machines_running = 1` (already set) -- do **not** lower it. Cold starts of >2s will hurt crawl budget.
- Monitor Fly's response time from non-US regions: `curl -w "@curl-format.txt" -o /dev/null https://full-selfbrowsing.com/` from EU/AP probes (use uptimerobot or similar).
- Consider adding a second region (e.g., `cdg` or `nrt`) for crawler latency if Search Console reports "soft 404" or slow-crawl warnings -- but defer this until evidence shows it matters.
- Verify the redirect chain is **one hop**: `curl -sI http://full-selfbrowsing.com/ | grep -i location` should show a single `https://...` redirect, not a chain.

**Warning signs:**
- Search Console crawl stats show p95 response time > 1500ms.
- Bing Webmaster reports "URL not reachable" intermittently.
- Any redirect chain longer than one hop.

**Phase to address:**
**Phase: Production Validation** -- end-of-milestone smoke pass that includes redirect-chain check, cold-start timing from non-US, and live `curl -A "GPTBot"` validation.

---

### Pitfall 9: Hydration mismatch if SSR is added later without per-route content parity

**What goes wrong:**
This milestone is **static prerender only** (per PROJECT.md "Out of scope: Angular Universal full SSR -- overkill"). But it's worth flagging the trap for the future: if SSR is added in a later milestone, **hydration mismatches** between the SSR-generated HTML and the client-side render will cause flicker, console errors, or full DOM teardown. Common causes:
- Components that render based on `Date.now()` or `Math.random()`.
- Components that read `localStorage` on init without `isPlatformBrowser` guards (already flagged in Pitfall 1).
- Components that conditionally render based on `window.innerWidth` (responsive logic).
- Meta tags set by `Title`/`Meta` services on the client that **differ** from the prerendered/SSR'd `<head>`.

**Why it happens:**
Hydration assumes the server-rendered DOM is byte-equivalent to what the client would render on first paint. Any non-determinism between server and client breaks this contract.

**How to avoid:**
- Even though SSR is deferred, **build the `Meta`/`Title` service usage to be deterministic** during prerender so future SSR migration is painless. Set meta tags in `ngOnInit` (which runs in the prerender context) using only data available statically.
- Avoid `Date.now()`, `Math.random()`, and `window.*` in render paths.
- Defer responsive logic to CSS media queries rather than JS-driven conditional rendering.

**Warning signs:**
- Future SSR phase: console errors `NG0500: Hydration completed but contains mismatches`.
- Visible flicker of meta tags or page content on first paint.

**Phase to address:**
**Phase: Per-Route Metadata (Title/Meta services)** -- establish deterministic meta-tag patterns now, even though SSR is deferred. Future SSR phase will benefit.

---

### Pitfall 10: Cache-Control headers leak onto crawler files or override prerendered HTML

**What goes wrong:**
The current `express.static` config (lines 98-107 of `server/server.js`) sets `Cache-Control: no-cache, must-revalidate` for `.js`, `.css`, `.html`. Two issues to watch for as crawler files are added:
1. **`.txt` and `.xml` files get the default `maxAge: 0` with no `Cache-Control`.** Some intermediate proxies (Cloudflare, ISP caches) will cache aggressively without an explicit directive. A bad `robots.txt` deploy could be cached for hours.
2. **Prerendered HTML inherits the `no-cache` policy** -- which is *correct* for invalidating stale content but *wrong* for crawl budget. Crawlers rely on `Last-Modified` / `ETag` to skip unchanged pages. `no-cache` forces a revalidation but `etag: true` is set, so 304s should still work. Verify.
3. **Gzip on `.txt` confuses some bots.** Express doesn't gzip by default unless `compression` middleware is added. If/when that's added, some legacy crawlers fail on gzipped `robots.txt`. Modern crawlers (Googlebot, GPTBot, ClaudeBot) handle it fine, but the spec recommends serving `robots.txt` uncompressed.

**Why it happens:**
Caching policy is set globally and rarely audited per-file-type. Crawler files have different caching needs than HTML.

**How to avoid:**
- Set explicit headers per file type in the `setHeaders` callback:
  ```javascript
  if (filePath.endsWith('robots.txt') || filePath.endsWith('sitemap.xml') || filePath.endsWith('llms.txt') || filePath.endsWith('llms-full.txt')) {
    res.setHeader('Cache-Control', 'public, max-age=3600'); // 1h is safe
    res.setHeader('Content-Type', filePath.endsWith('.xml') ? 'application/xml' : 'text/plain; charset=utf-8');
  }
  ```
- Verify 304 responses work: `curl -I -H 'If-None-Match: "<etag>"' https://full-selfbrowsing.com/about` should return 304 on unchanged content.
- If `compression` middleware is later added, exclude `*.txt` (configure `filter` option).

**Warning signs:**
- `curl -I https://full-selfbrowsing.com/robots.txt` shows no `Cache-Control` header.
- Cloudflare/Fly edge cache holds a stale `robots.txt` after deploy.
- Search Console crawl stats show 100% 200 responses (no 304s) on unchanged pages -- wasted crawl budget.

**Phase to address:**
**Phase: Express Wiring & Crawler Files** -- explicit per-file-type headers in `setHeaders` callback.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Hand-write `sitemap.xml` instead of generating from routes | Fast first ship | Drifts from `app.routes.ts` on every route change | Never -- generate from build |
| Skip CI validation of JSON-LD / robots.txt / sitemap | Faster CI | Silent SEO regression on any future PR | Never for a discoverability milestone |
| Inline JSON-LD as a string template instead of `JSON.stringify(obj)` | Fewer files | Trailing-comma / escape bugs that silently invalidate the schema | Never |
| Skip the `localStorage` guard because "prerender works on my machine" | One less file change | Random prerender failures in CI on clean Node | Never -- always guard |
| Prerender all routes including `/dashboard` because "it'll just hydrate" | One less config line | Stale dashboard state served to users | Never |
| Use a wildcard `app.get('*', ...)` SPA fallback | Simple routing | Swallows `/robots.txt`, `/sitemap.xml`, all crawler files | Never on an SEO-bearing site |
| Defer `llms.txt` to a future milestone | Smaller scope now | AI search bots ignore the site for another quarter | Acceptable if traditional SEO is the only goal -- but PROJECT.md explicitly includes GEO |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Google Search Console | Submitting sitemap before HTTPS canonical is final | Verify `force_https` redirect and HTTPS sitemap URL first |
| `@angular/build:prerender` (Angular 19) | Letting it auto-discover all routes including `/dashboard` | Explicit `routes` array; assert `dashboard/index.html` is absent post-build |
| Express `express.static` | Default behavior doesn't resolve `/about` -> `about/index.html` | Pass `{ extensions: ['html'] }` so prerendered files are served |
| Fly.io edge proxy | Assuming `force_https` is free for crawlers | Always emit HTTPS URLs in crawler files; verify single-hop redirect |
| schema.org JSON-LD | Hand-stringifying with template literals | `JSON.stringify` + escape `</` to `<\/` to defeat script-tag injection |
| `llms.txt` | Pointing at SPA-rendered URLs | Only link to prerendered routes; verify each with `curl` (no JS) |
| Angular `Title`/`Meta` services | Setting tags after first paint causes hydration mismatch in future SSR | Set tags in `ngOnInit` synchronously, deterministic only |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Cold start on `auto_stop_machines = 'stop'` | Crawlers see 5-10s TTFB intermittently | Keep `min_machines_running = 1` (already set); monitor p95 TTFB | When `min_machines_running` is lowered to 0 |
| Single-region (`sjc`) crawler latency | EU/AP crawlers slow; Bing complains | Add second region only if Search Console flags it | When non-US crawl rate matters (after off-page push) |
| Oversized `llms-full.txt` | Some crawlers truncate or skip the file | Cap at ~256KB; split if larger | When marketing copy grows beyond ~50 pages |
| Prerendered HTML without `etag` | Every crawl re-downloads unchanged HTML, eating crawl budget | `etag: true` is already set in `express.static` -- keep it | Never if etag stays on |
| No gzip on prerendered HTML | Slower TTFB for crawlers and users | Add `compression` middleware, but exclude `*.txt` | When HTML pages grow beyond ~20KB each |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Exposing `/dashboard` in `sitemap.xml` | Indexed thin/empty pages, possible session-state leak via cached HTML | `sitemap.xml` excludes `/dashboard` and `/api/*` |
| `</script>` injection in JSON-LD via unescaped user data | XSS if any field comes from user-controlled source | Always `JSON.stringify(obj).replace(/</g, '\\u003c')`; never interpolate user data into JSON-LD |
| `robots.txt` `Disallow: /api/` not enforced server-side | Sec-by-obscurity -- robots.txt is advisory | Real auth on `/api/*` (already present via `authMiddleware`); robots.txt is just hygiene |
| Leaking internal route names via sitemap | Disclosure of unfinished/staging routes | Generate sitemap from explicit allowlist, not auto-discovery |
| Crawler files cached with wrong Cache-Control after a bad deploy | Bad `robots.txt` blocks site for hours | `max-age=3600` on crawler files; manual purge ready if needed |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Flash Of Unstyled Theme on prerendered pages | Page renders dark, then snaps to user's saved light theme | Bake default (dark) into prerender; `localStorage` guard upgrades to light only when available |
| Prerendered page shows old Open Graph image after deploy | Social shares look broken until cache clears | Version OG image URLs (`og-image.png?v=2`) on every change |
| Empty `<title>` or duplicate "FSB" titles across all routes | Bad search snippet, no differentiation | Per-route `Title` service call with descriptive titles (e.g., "About -- FSB", "Privacy -- FSB") |
| `/dashboard` appears in Google search results with empty snippet | Confusing entry point for organic searchers | `noindex` meta on `/dashboard` + `Disallow` in robots.txt |
| Canonical URL mismatch (e.g., trailing slash) | Duplicate content penalty, split link equity | Single canonical convention (no trailing slash) enforced via `<link rel="canonical">` and Express normalization |

## "Looks Done But Isn't" Checklist

- [ ] **Prerender:** Often missing the `localStorage` guard in `index.html` -- verify `npm run prerender` succeeds on a clean Node container with no DOM.
- [ ] **Prerender:** Often missing explicit route allowlist -- verify `dist/.../browser/dashboard/index.html` does NOT exist post-build.
- [ ] **Express:** Often missing `extensions: ['html']` on `express.static` -- verify `curl https://full-selfbrowsing.com/about` returns prerendered HTML, not SPA shell.
- [ ] **Express:** Often missing per-route static resolution -- verify each of `/`, `/about`, `/privacy`, `/support` returns *different* `<title>` tags.
- [ ] **JSON-LD:** Often missing `@id` cross-references -- verify Rich Results Test detects exactly one `Organization` and one `SoftwareApplication`.
- [ ] **JSON-LD:** Often missing `</` escaping -- verify `dist/.../browser/index.html` contains `\u003c/` not literal `</` inside JSON-LD blocks.
- [ ] **robots.txt:** Often missing absolute `Sitemap:` URL -- verify with `curl https://full-selfbrowsing.com/robots.txt | grep "^Sitemap: https://"`.
- [ ] **robots.txt:** Often missing `Disallow: /dashboard` -- verify with grep.
- [ ] **sitemap.xml:** Often missing W3C-format `lastmod` -- verify `xmllint --noout` passes and Search Console accepts.
- [ ] **sitemap.xml:** Often listing 404 routes -- verify every `<loc>` returns 200 via `curl`.
- [ ] **llms.txt:** Often pointing at non-prerendered URLs -- verify each link returns prerendered HTML when fetched with `curl -A "ClaudeBot"` (no JS).
- [ ] **llms-full.txt:** Often oversized -- verify `wc -c < llms-full.txt` < 256000.
- [ ] **Meta tags:** Often duplicated or missing canonical -- verify each prerendered page has exactly one `<link rel="canonical">` matching the request URL.
- [ ] **Cache headers:** Often missing on `*.txt` and `*.xml` -- verify `curl -I` shows explicit `Cache-Control` and correct `Content-Type`.
- [ ] **Fly redirect:** Often a multi-hop chain -- verify `curl -sI http://full-selfbrowsing.com/` shows exactly one `Location:` header.
- [ ] **Per-bot rules:** Often forgetting `Google-Extended` (the AI training opt-in/out signal, distinct from Googlebot) -- verify it appears in robots.txt explicitly.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| `Disallow: /` typo deployed | HIGH | 1) Push corrected `robots.txt` immediately. 2) Use Search Console "Validate fix" to expedite re-crawl. 3) Submit `sitemap.xml` again. 4) Wait -- some crawlers cache for 24h; no faster path exists. |
| `/dashboard` accidentally prerendered and indexed | MEDIUM | 1) Add `noindex` meta + `Disallow` in robots. 2) Use Search Console "Remove URL" tool for fast removal. 3) Re-deploy with `/dashboard` excluded from prerender. |
| JSON-LD validation errors | LOW | 1) Fix the schema. 2) Re-deploy. 3) Use Rich Results Test "Test live URL" to expedite re-crawl (no waiting). |
| Sitemap rejected by Search Console | LOW | 1) Run `xmllint`. 2) Fix and re-submit via Search Console -- re-validation is < 1 hour. |
| `llms.txt` linking to empty SPA pages | LOW | 1) Verify prerender output. 2) Update `llms.txt` to canonical URLs. 3) Re-deploy. AI crawlers re-fetch on a faster cadence than Google. |
| Express middleware order wrong (SPA shadowing prerender) | LOW | 1) Reorder middleware. 2) Re-deploy. Crawlers will pick up the change on next visit. |
| `localStorage` prerender crash | LOW | 1) Add the guard. 2) Re-run prerender. 3) Re-deploy. Pre-deploy issue, not user-facing. |
| Bad `Cache-Control` on `robots.txt` cached at edge | MEDIUM | 1) Push corrected file. 2) Manually purge Fly edge cache (if available) or wait `max-age` to expire. 3) Verify via direct curl. |

## Pitfall-to-Phase Mapping

This assumes a roadmap structure of approximately: **Phase A: Prerender Foundation** -> **Phase B: Per-Route Metadata** -> **Phase C: Structured Data (JSON-LD)** -> **Phase D: Express Wiring & Crawler Files** -> **Phase E: Production Validation**.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| `localStorage` in index.html breaks prerender (P1) | Phase A: Prerender Foundation | Prerender succeeds on clean Node; CI runs prerender in Docker container |
| `/dashboard` accidentally prerendered (P2) | Phase A: Prerender Foundation | Build script asserts `dashboard/index.html` does not exist |
| Express middleware order shadows prerender + crawler files (P3) | Phase D: Express Wiring & Crawler Files | `curl /about` returns prerendered HTML (different `<title>` per route); `curl /robots.txt` returns `text/plain` |
| Invalid / duplicate JSON-LD (P4) | Phase C: Structured Data | CI runs Google Rich Results Test API on every prerendered page; build fails on errors |
| robots.txt typos / blocking dashboard (P5) | Phase D: Express Wiring & Crawler Files | CI grep for `^Disallow: /$`; manual Search Console robots-tester before deploy |
| Sitemap rejected (P6) | Phase D: Express Wiring & Crawler Files | `xmllint --noout` in CI; every `<loc>` curl'd for 200 |
| llms.txt drift / oversize (P7) | Phase D: Express Wiring & Crawler Files | CI: each link fetched with no-JS user agent; `wc -c llms-full.txt` < 256000 |
| Fly redirect / cold-start (P8) | Phase E: Production Validation | Live curl from non-US probes; redirect-chain check in smoke pass |
| Hydration determinism (future SSR) (P9) | Phase B: Per-Route Metadata | Lint rule / code review: no `Date.now()` / `Math.random()` / unguarded `window.*` in render paths |
| Cache-Control on crawler files (P10) | Phase D: Express Wiring & Crawler Files | `curl -I` smoke pass on all crawler files; verify explicit headers |

## Sources

- Angular 19 prerender docs: https://angular.dev/guide/hydration and https://angular.dev/guide/prerendering (Context7-resolvable; verified pattern matches Angular 17/18/19 progression -- HIGH confidence)
- schema.org JSON-LD spec: https://schema.org/docs/jsonld.html (HIGH confidence -- official)
- Google Search Central -- robots.txt: https://developers.google.com/search/docs/crawling-indexing/robots/intro (HIGH confidence -- official, includes precedence rules)
- Google Search Central -- sitemaps: https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap (HIGH confidence -- official)
- llmstxt.org community spec (Anthropic-aligned): https://llmstxt.org/ (MEDIUM confidence -- de-facto standard, evolving)
- Google Rich Results Test: https://search.google.com/test/rich-results (HIGH confidence -- official validator)
- Express `static` middleware docs: https://expressjs.com/en/api.html#express.static (HIGH confidence -- official)
- Fly.io `force_https` and machine lifecycle: https://fly.io/docs/networking/services/ and https://fly.io/docs/apps/autostart-stop/ (HIGH confidence -- official)
- Google-Extended user agent: https://blog.google/technology/ai/an-update-on-web-publisher-controls/ (HIGH confidence -- Google announcement, Sept 2023)
- GPTBot / ClaudeBot / PerplexityBot user-agent strings: official OpenAI, Anthropic, Perplexity docs (HIGH confidence)
- Personal experience with Angular SSR/prerender + Express + JSON-LD on similar marketing sites (informs the `localStorage` and middleware-ordering pitfalls -- HIGH confidence on those specifics).

---
*Pitfalls research for: Adding SEO + GEO to FSB Angular 19 showcase on Express + Fly.io*
*Researched: 2026-04-30*
