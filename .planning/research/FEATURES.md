# Feature Research

**Domain:** SEO + GEO/AEO/LLMO discoverability for Angular 19 SPA marketing site (`full-selfbrowsing.com`)
**Researched:** 2026-04-30
**Milestone:** v0.9.46 Site Discoverability
**Confidence:** HIGH (crawler list, llms.txt spec, sitemap status verified against vendor docs and Cloudflare data; JSON-LD weighting MEDIUM — community consensus rather than vendor-stated rankings)

## Existing Surface (Constraints On New Features)

- 5 Angular routes: `/`, `/about`, `/dashboard`, `/privacy`, `/support` (`showcase/angular/src/app/app.routes.ts`)
- `index.html` ships only `<title>FSB</title>` plus a CDN block for `html5-qrcode` and `lz-string` -- no description, no OG, no canonical, no JSON-LD
- Per the milestone in `PROJECT.md`, marketing routes (`/`, `/about`, `/privacy`, `/support`) are prerendered; `/dashboard` stays SPA (auth-gated, not for crawlers)
- Express SPA-fallback must serve prerendered HTML before the catch-all -- already in target features

These constrain where each feature can live: anything that must be visible to non-JS crawlers has to be in prerendered HTML at build time, not injected by Angular runtime on a stale `<app-root>`.

## Feature Landscape

### Table Stakes (Users Expect These)

Missing any of these = the site looks abandoned to Google, ChatGPT, Claude, and Perplexity.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Per-route `<title>` and `<meta name="description">` | Single hardcoded `FSB` title on every URL is a known anti-pattern; Google shows the description in SERPs and LLMs cite it as the page summary | LOW (4 components x ~5 lines via Angular `Title`/`Meta` services in `ngOnInit`) | Must be applied **before prerender freezes the HTML**. Use Angular's static prerender so the meta tags end up in the on-disk HTML, not just runtime DOM |
| Per-route `<link rel="canonical">` | Prevents duplicate-content split between `https://full-selfbrowsing.com/about` and trailing-slash / case variants; mandatory for Google indexing | LOW (one line per page component, set via `Meta.updateTag` or via Angular's `DOCUMENT` token) | Canonical URL must be absolute, `https://`, no trailing slash for consistency. Skip on `/dashboard` (noindex anyway) |
| Open Graph tags (`og:title`, `og:description`, `og:image`, `og:url`, `og:type`) | Required for link previews on Twitter/X, LinkedIn, Slack, Discord, iMessage; missing = unfurled link shows raw URL | LOW (5-6 tags per route, same `Meta` service) | Need a 1200x630 PNG at `/assets/og/<route>.png`. `og:type=website` for marketing pages. Single shared image is acceptable for v1 |
| Twitter Card tags (`twitter:card`, `twitter:title`, `twitter:description`, `twitter:image`) | X/Twitter still ignores OG for the card type itself; needs `twitter:card=summary_large_image` to render the wide preview | LOW (4 tags, set alongside OG) | Can reuse OG image. No `twitter:site` needed unless an X handle exists |
| `robots.txt` at site root with explicit `Allow` for AI crawlers + `Sitemap:` line | Default Angular build ships none. Crawlers (Google, GPTBot, ClaudeBot, PerplexityBot) explicitly check `/robots.txt` first; missing = ambiguous policy | TRIVIAL (~30 lines, plain text in `showcase/express/public/robots.txt`) | Must be served as `text/plain` at the apex. Express static must resolve it before SPA fallback. **Current verified 2026 list below** |
| `sitemap.xml` with the 5 routes + `<lastmod>` | Google Search Console requires this for fast indexing of new sites; sitemap URL goes in `robots.txt` | LOW (~25 lines, hand-written or generated at build) | Drop `<changefreq>` and `<priority>` -- Google explicitly ignores both in 2026 (sitemaps.org keeps them in spec, but they are noise). Keep only `<loc>` and `<lastmod>` |
| `Organization` JSON-LD in prerendered HTML | The single highest-leverage structured-data signal for LLM entity recognition; ChatGPT/Claude/Perplexity parse it to identify "what is FSB" | LOW (15-line script tag in `index.html` `<head>`) | Place in `index.html` so all prerendered routes inherit it. One `Organization` per site, not per page |
| `SoftwareApplication` JSON-LD on home route | FSB is a Chrome extension -- `SoftwareApplication` (or `WebApplication`) is the canonical schema.org type. Surfaces in Google rich results and is the strongest "this is software, here is what it does" signal for LLMs | LOW (20-line script tag, prerendered into `/index.html`) | Place per-route (only on `/`) so it is bound to the home page, not every page. `applicationCategory: BrowserApplication`, `operatingSystem: Chrome` |
| Noindex on `/dashboard` | Auth-gated; SPA-only; crawlers should not waste budget there or surface it in search | TRIVIAL (one `<meta name="robots" content="noindex,nofollow">` injected via Angular `Meta` for that route) | Belt-and-suspenders: also add `Disallow: /dashboard` in `robots.txt` |

### Differentiators (Competitive Advantage)

Features competitors in adjacent space (Browser-Use, Stagehand, BrowserOS) mostly skip. Cheap wins for AI-search visibility.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| `llms.txt` at site root | Markdown index pointing LLMs at the canonical content map. Anthropic's own docs ship one; Cloudflare and Stripe adopted; 844K+ sites by Oct 2025. **No major LLM has officially confirmed they read it**, but it is a low-cost bet that costs nothing if ignored and pays off if adopted | TRIVIAL (~40 lines markdown, hand-written, served as `text/markdown` or `text/plain`) | Per llmstxt.org spec: H1 title, blockquote summary, `## Docs` section with markdown links, optional `## Optional` section. Keep under 100 lines for v1 |
| `llms-full.txt` at site root | Concatenated full-text of marketing pages in one file, optimized for single-fetch LLM ingestion. Lets a crawler grab the entire FSB pitch in one request | LOW (~500-1500 lines, generated at build from prerendered HTML stripped to markdown) | Spec is informal; norms are "everything important, in markdown, in one file." Practical cap ~50-100KB. Auto-generate from the 4 prerendered routes to avoid drift |
| Explicit `User-agent:` blocks per AI crawler in `robots.txt` (vs. one wildcard `Allow`) | Signals intentional opt-in to GPTBot, ClaudeBot, PerplexityBot, Google-Extended, Applebot-Extended individually. Some operators read explicit Allow as stronger consent than wildcard | TRIVIAL (extends robots.txt by ~25 lines) | See verified 2026 list below. Each Anthropic/OpenAI bot has independent semantics (training vs search vs user-fetch) -- being explicit shows you understand the distinction |
| `BreadcrumbList` JSON-LD on `/about`, `/privacy`, `/support` | Surfaces breadcrumb trail in Google SERPs ("fsb.com > About"); modest CTR lift, helps LLMs understand site hierarchy | LOW (10-line script per non-home route) | Skip on `/` (it IS the breadcrumb root). Trivial since the site is shallow (one level deep) |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| `FAQPage` JSON-LD | Trendy for AEO/GEO; thought to surface in AI Overviews | FSB has no FAQ page yet (deferred per `PROJECT.md` "Out of scope"). Faking FAQs in JSON-LD that do not exist as visible page content violates Google's structured-data policy and risks manual action. Revisit when a real FAQ page ships | Defer until FAQ page exists. Then add `FAQPage` schema bound to that page's visible Q&A |
| `HowTo` JSON-LD | Tempting for "how to install FSB" content | Google deprecated `HowTo` rich results in late 2023 and has not reinstated them. Markup is harmless but yields zero SERP benefit; LLM weighting is unproven | Use plain prose with clear `<h2>` step headings. LLMs parse step lists from semantic HTML fine without `HowTo` markup |
| `priority` and `changefreq` in sitemap.xml | Standard sitemap-builder output; "feels complete" | Google explicitly ignores both in 2026. Bing largely ignores them. They add bytes and a maintenance burden (every release someone debates "is this 0.7 or 0.8?") with zero ranking impact | Ship `<loc>` + `<lastmod>` only. Drop the other two |
| `WebSite` schema with `SearchAction` (sitelinks searchbox) | Classic SEO checklist item | FSB has no site-wide search. Declaring a `SearchAction` that points to a non-existent `/search?q={query}` is a structured-data lie; Google can de-list rich results for it | Skip until on-site search exists (not on roadmap) |
| Wildcard `User-agent: *` `Disallow: /` then per-bot `Allow:` blocks | "Allowlist-only" feels safer | Inverts the open-web default; risks accidentally blocking Googlebot if a config typo slips in. Also unfriendly to legitimate aggregators (archive.org, search engines you forgot about) | Default-allow with explicit per-bot `Allow:` blocks for AI crawlers (signals intent without blocking the open web). Only `Disallow: /dashboard` |
| `noai` / `noimageai` `<meta>` tags | Some publishers use these to opt out of AI training | FSB *wants* AI ingestion (it is a developer tool; LLM citations are the goal). Adding these signals the opposite of FSB's intent | Explicitly omit. Document in code comment that absence is intentional |
| Angular Universal full SSR | "Proper" SSR feels more legitimate than prerender | Already explicitly out of scope per `PROJECT.md`. Static prerender of 4 marketing routes is sufficient -- there is no per-request dynamic content to render | Stay with static prerender; add SSR only if dynamic per-user marketing emerges (it will not) |
| Per-route OG images generated dynamically | Visual polish | Each unique image is a design+infra task. v1 ships fine with one shared `og-default.png`. Per-route images are a v2 polish pass | One shared 1200x630 PNG; revisit per-route variants once core SEO ships |

## Verified 2026 AI Crawler List

Cross-referenced against OpenAI's `platform.openai.com/docs/bots`, Anthropic's `support.claude.com` crawler page, and Cloudflare Radar's verified-bots directory.

| User-Agent | Operator | Purpose | Should Allow? |
|-----------|----------|---------|---------------|
| `GPTBot` | OpenAI | Training data for foundation models | YES (FSB wants AI to know what it is) |
| `ChatGPT-User` | OpenAI | User-initiated fetch when a ChatGPT user asks ChatGPT to read a URL | YES |
| `OAI-SearchBot` | OpenAI | ChatGPT search index | YES |
| `ClaudeBot` | Anthropic | Training data | YES |
| `Claude-User` | Anthropic | User-initiated fetch from Claude | YES |
| `Claude-SearchBot` | Anthropic | Claude search index | YES |
| `PerplexityBot` | Perplexity | Search indexing (no foundation-model training per Cloudflare) | YES |
| `Perplexity-User` | Perplexity | User-initiated fetch | YES |
| `Google-Extended` | Google | Opt-out token for Gemini/Vertex training (NOT a real crawler -- controls how content from Googlebot's existing crawl is used) | YES (allow training use) |
| `Applebot-Extended` | Apple | Same shape as Google-Extended -- controls Apple Intelligence training use | YES |
| `Amazonbot` | Amazon | Alexa / Amazon AI ingestion | YES |
| `Bytespider` | ByteDance | Training crawler (no public vendor doc page; identified by Cloudflare) | YES (consistent posture) |
| `CCBot` | Common Crawl | Open-data web crawl that feeds many LLM training sets | YES |
| `Meta-ExternalAgent` | Meta | Llama training + Meta AI search; 16.7% of global AI bot traffic in March 2026 | YES |
| `DuckAssistBot` | DuckDuckGo | DuckDuckGo AI assist | YES (optional, low traffic) |
| `Googlebot` | Google | Standard web search | YES (implicit -- default-allow) |

**Verification sources:**
- OpenAI docs (`platform.openai.com/docs/bots`) -- confirms GPTBot/1.1, ChatGPT-User/1.0, OAI-SearchBot/1.0 as the three independent identifiers
- Anthropic docs (`support.claude.com` / `privacy.claude.com`) -- confirms ClaudeBot, Claude-User, Claude-SearchBot are independent and all honor robots.txt
- Cloudflare bot list (`developers.cloudflare.com/bots/concepts/bot/`) and Cloudflare Radar (`radar.cloudflare.com/bots/directory/meta-externalagent`) -- confirms Meta-ExternalAgent, Bytespider, CCBot, Applebot, PetalBot, TikTokSpider as the verified-bot universe in 2026

## Concrete Example Payloads

### `robots.txt` (table-stakes minimum, ~40 lines)

```
# https://full-selfbrowsing.com/robots.txt
# FSB explicitly opts into AI ingestion -- we want LLMs to know what FSB is.

User-agent: *
Allow: /
Disallow: /dashboard

# OpenAI
User-agent: GPTBot
Allow: /

User-agent: ChatGPT-User
Allow: /

User-agent: OAI-SearchBot
Allow: /

# Anthropic
User-agent: ClaudeBot
Allow: /

User-agent: Claude-User
Allow: /

User-agent: Claude-SearchBot
Allow: /

# Perplexity
User-agent: PerplexityBot
Allow: /

User-agent: Perplexity-User
Allow: /

# Google / Apple AI training opt-in
User-agent: Google-Extended
Allow: /

User-agent: Applebot-Extended
Allow: /

# Other major AI crawlers
User-agent: Amazonbot
Allow: /

User-agent: Bytespider
Allow: /

User-agent: CCBot
Allow: /

User-agent: Meta-ExternalAgent
Allow: /

Sitemap: https://full-selfbrowsing.com/sitemap.xml
```

### `sitemap.xml` (4 marketing routes, lastmod only)

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://full-selfbrowsing.com/</loc>
    <lastmod>2026-04-30</lastmod>
  </url>
  <url>
    <loc>https://full-selfbrowsing.com/about</loc>
    <lastmod>2026-04-30</lastmod>
  </url>
  <url>
    <loc>https://full-selfbrowsing.com/privacy</loc>
    <lastmod>2026-04-30</lastmod>
  </url>
  <url>
    <loc>https://full-selfbrowsing.com/support</loc>
    <lastmod>2026-04-30</lastmod>
  </url>
</urlset>
```

(`/dashboard` intentionally absent -- it is `noindex` and `Disallow`-ed.)

### `Organization` JSON-LD (place in `index.html` `<head>`, inherited by all prerendered routes)

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "FSB",
  "alternateName": "Full Self-Browsing",
  "url": "https://full-selfbrowsing.com",
  "logo": "https://full-selfbrowsing.com/assets/icon48.png",
  "description": "FSB is an AI-powered browser automation Chrome extension that executes tasks through natural language instructions, with reliable single-attempt execution and an MCP server for external clients.",
  "sameAs": [
    "https://github.com/LakshmanTurlapati/FSB",
    "https://www.npmjs.com/package/fsb-mcp-server"
  ]
}
</script>
```

### `SoftwareApplication` JSON-LD (home route only, prerendered into `/index.html`)

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "FSB (Full Self-Browsing)",
  "applicationCategory": "BrowserApplication",
  "operatingSystem": "Chrome, Chromium-based browsers",
  "description": "AI-powered browser automation Chrome extension. Describe a task in natural language; FSB executes the clicks, types, and navigation reliably on the first attempt. Includes MCP server for Claude, Codex, Cursor, and other AI hosts.",
  "url": "https://full-selfbrowsing.com",
  "downloadUrl": "https://github.com/LakshmanTurlapati/FSB",
  "softwareVersion": "0.9.46",
  "offers": {
    "@type": "Offer",
    "price": "0",
    "priceCurrency": "USD"
  },
  "author": {
    "@type": "Person",
    "name": "Lakshman Turlapati"
  }
}
</script>
```

### Per-route meta in Angular component (example: `about-page.component.ts` `ngOnInit`)

```typescript
ngOnInit() {
  this.title.setTitle('About FSB -- AI Browser Automation Chrome Extension');
  this.meta.updateTag({ name: 'description', content: 'FSB executes browser tasks from natural language. Built on reliable single-attempt mechanics with an MCP server for Claude, Codex, and Cursor.' });
  // Canonical: prefer setting via DOCUMENT token since Meta service does not handle <link>
  this.meta.updateTag({ property: 'og:title', content: 'About FSB' });
  this.meta.updateTag({ property: 'og:description', content: 'How FSB works and why single-attempt reliability matters.' });
  this.meta.updateTag({ property: 'og:url', content: 'https://full-selfbrowsing.com/about' });
  this.meta.updateTag({ property: 'og:image', content: 'https://full-selfbrowsing.com/assets/og/default.png' });
  this.meta.updateTag({ property: 'og:type', content: 'website' });
  this.meta.updateTag({ name: 'twitter:card', content: 'summary_large_image' });
  this.meta.updateTag({ name: 'twitter:title', content: 'About FSB' });
  this.meta.updateTag({ name: 'twitter:description', content: 'How FSB works and why single-attempt reliability matters.' });
  this.meta.updateTag({ name: 'twitter:image', content: 'https://full-selfbrowsing.com/assets/og/default.png' });
}
```

### `llms.txt` (site root, ~40 lines)

```markdown
# FSB (Full Self-Browsing)

> AI-powered browser automation Chrome extension. Describe a task in natural language; FSB executes the clicks, types, and navigation reliably on the first attempt. Ships with an MCP server (`fsb-mcp-server` on npm) so external AI hosts (Claude, Codex, Cursor, Continue, OpenClaw) can drive a real browser surface.

FSB is open source. The core value is reliable single-attempt execution: the AI decides correctly and the mechanics execute precisely. Every click hits the right element with uniqueness-scored selectors, visible orange-glow feedback, and post-action verification.

## Docs

- [Home](https://full-selfbrowsing.com/): What FSB is and how to install
- [About](https://full-selfbrowsing.com/about): Architecture, MCP integration, supported hosts
- [Privacy](https://full-selfbrowsing.com/privacy): Data handling, encrypted API keys, no telemetry by default
- [Support](https://full-selfbrowsing.com/support): GitHub issues, MCP host setup, troubleshooting

## Optional

- [GitHub repository](https://github.com/LakshmanTurlapati/FSB): Source code, issue tracker, releases
- [npm: fsb-mcp-server](https://www.npmjs.com/package/fsb-mcp-server): MCP server distribution
- [Full content export](https://full-selfbrowsing.com/llms-full.txt): Concatenated marketing pages for single-fetch ingestion
```

## Feature Dependencies

```
Static prerender of marketing routes (build pipeline)
    +-- required by --> Per-route <title>/<meta>/<link rel=canonical>
    +-- required by --> Per-route OG / Twitter Card tags
    +-- required by --> Organization JSON-LD (inherited via index.html)
    +-- required by --> SoftwareApplication JSON-LD (home only)
    +-- required by --> BreadcrumbList JSON-LD (about/privacy/support)

Express SPA-fallback adjustment (serve prerendered HTML before catch-all)
    +-- required by --> All of the above (or crawlers see the empty <app-root> with title=FSB)

robots.txt
    +-- references --> sitemap.xml (Sitemap: line)
    +-- enhances --> llms.txt (parallel signal; both opt AI crawlers in)

llms.txt
    +-- references --> llms-full.txt (link in Optional section)
    +-- references --> Per-route prerendered HTML (links in Docs section)

llms-full.txt
    +-- generated from --> Prerendered HTML of /, /about, /privacy, /support

noindex on /dashboard (Angular Meta in ngOnInit)
    +-- reinforced by --> Disallow: /dashboard in robots.txt
```

### Dependency Notes

- **Everything visible to crawlers requires prerender first.** Angular's `Title`/`Meta` services running in `ngOnInit` only mutate the runtime DOM. Without prerender, crawlers (which mostly do not execute JS -- including all OpenAI/Anthropic/Perplexity bots) see only the literal `<title>FSB</title>` and an empty `<app-root>`. This is why prerender is the keystone phase, not an optional polish.
- **JSON-LD placement matters.** `Organization` belongs in `index.html` `<head>` so all prerendered routes inherit it (one definition, every page). `SoftwareApplication` belongs in the home-route component's prerendered output only, so it is bound semantically to `/`. `BreadcrumbList` belongs per non-home page.
- **Express ordering is a silent failure mode.** If the catch-all `app.get('*', sendIndex)` runs before the static handler for `/about/index.html`, every prerendered file is shadowed and crawlers still see the SPA shell. The Express change is a hard prerequisite for the meta/JSON-LD phases.
- **`llms-full.txt` should be generated, not hand-written.** Hand-maintained = drifts from the actual site within one release. Build-time generation from prerendered HTML keeps it in sync.
- **`robots.txt`'s `Sitemap:` line is the only reliable sitemap discovery path.** Search Console submission is deferred per `PROJECT.md`; the robots.txt reference is what tells Googlebot/Bingbot where to look on first crawl.

## MVP Definition

### Launch With (v0.9.46 -- this milestone)

The minimum to flip the site from "invisible to AI search" to "fully indexed and cited." Everything below is a hard requirement to ship the milestone.

- [ ] Static prerender of `/`, `/about`, `/privacy`, `/support` -- keystone enabling everything else
- [ ] Express SPA-fallback ordering fix -- prerendered HTML must win over `index.html` catch-all
- [ ] Per-route `<title>` and `<meta name="description">` via Angular `Title`/`Meta` in 4 page components
- [ ] Per-route `<link rel="canonical">`
- [ ] Per-route OG tags (`og:title`, `og:description`, `og:image`, `og:url`, `og:type`) + one shared default OG image
- [ ] Per-route Twitter Card tags (`twitter:card=summary_large_image`, `twitter:title`, `twitter:description`, `twitter:image`)
- [ ] `Organization` JSON-LD in `index.html` `<head>`
- [ ] `SoftwareApplication` JSON-LD prerendered into `/index.html` (home route only)
- [ ] `<meta name="robots" content="noindex,nofollow">` on `/dashboard`
- [ ] `robots.txt` at site root with explicit per-bot Allow blocks + `Sitemap:` line + `Disallow: /dashboard`
- [ ] `sitemap.xml` at site root with 4 marketing routes, `<loc>` and `<lastmod>` only

### Add After Validation (v0.9.47+)

Ship after v0.9.46 lands and there is at least one cycle of evidence (Search Console impressions, ChatGPT/Perplexity citations) confirming the foundation works.

- [ ] `llms.txt` -- trigger: v0.9.46 ships and the milestone proves the pipeline works end-to-end
- [ ] `llms-full.txt` (auto-generated at build) -- trigger: same as above; bundle in same follow-up phase as `llms.txt`
- [ ] `BreadcrumbList` JSON-LD on `/about`, `/privacy`, `/support` -- trigger: v0.9.46 ships clean and there is appetite for SERP polish
- [ ] Per-route OG images (4 distinct 1200x630 PNGs) -- trigger: design pass after v0.9.46

### Future Consideration (v0.9.50+)

Explicitly deferred per `PROJECT.md` "Out of scope" or pending product evolution.

- [ ] `FAQPage` JSON-LD -- defer until a real FAQ page exists (currently OOS)
- [ ] Comparison pages + `Article` schema (`/vs-browser-use`, `/vs-mariner`, `/vs-stagehand`, `/vs-browseros`) -- OOS in current milestone
- [ ] Search Console / Bing Webmaster registration + sitemap submission -- OOS
- [ ] Off-page push (Show HN, Reddit, awesome-list PRs, YouTube) -- OOS
- [ ] Angular Universal full SSR -- OOS, prerender is sufficient for static marketing
- [ ] `WebSite` schema with `SearchAction` -- defer until on-site search exists (not on roadmap)

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Static prerender of 4 marketing routes | HIGH | MEDIUM | P1 |
| Express SPA-fallback ordering | HIGH | LOW | P1 |
| Per-route `<title>` + `<meta description>` | HIGH | LOW | P1 |
| Canonical link tag | HIGH | LOW | P1 |
| OG + Twitter Card tags | HIGH | LOW | P1 |
| `robots.txt` with AI crawler allowlist | HIGH | LOW | P1 |
| `sitemap.xml` (loc + lastmod) | HIGH | LOW | P1 |
| `Organization` JSON-LD | HIGH | LOW | P1 |
| `SoftwareApplication` JSON-LD | HIGH | LOW | P1 |
| `noindex` on `/dashboard` | MEDIUM | LOW | P1 |
| `llms.txt` | MEDIUM | LOW | P2 |
| `llms-full.txt` (generated) | MEDIUM | LOW | P2 |
| `BreadcrumbList` JSON-LD | LOW | LOW | P2 |
| Per-route OG images | LOW | MEDIUM | P3 |
| `FAQPage` JSON-LD | MEDIUM | MEDIUM (requires FAQ page first) | P3 |
| `HowTo` JSON-LD | LOW (Google deprecated rich result) | LOW | Anti-feature |
| `priority`/`changefreq` in sitemap | LOW (Google ignores) | LOW | Anti-feature |
| `WebSite` `SearchAction` | LOW (no on-site search exists) | LOW | Anti-feature |

**Priority key:**
- P1: Must ship in v0.9.46
- P2: Add in v0.9.47 follow-up milestone
- P3: Defer until product/design appetite emerges

## Sources

### OpenAI (verified)
- OpenAI: Overview of OpenAI Crawlers -- https://platform.openai.com/docs/bots (canonical source for GPTBot/1.1, ChatGPT-User/1.0, OAI-SearchBot/1.0 identifiers and independent semantics)
- OpenAI Help Center: Publishers and Developers FAQ -- https://help.openai.com/en/articles/12627856-publishers-and-developers-faq

### Anthropic (verified)
- Anthropic Privacy Center: Does Anthropic crawl data from the web -- https://privacy.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler
- Anthropic Support (same article) -- https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler
- Search Engine Journal: Anthropic's Claude Bots Make Robots.txt Decisions More Granular -- https://www.searchenginejournal.com/anthropics-claude-bots-make-robots-txt-decisions-more-granular/568253/

### Cloudflare (verified bot data)
- Cloudflare bots concepts -- https://developers.cloudflare.com/bots/concepts/bot/ (verified-bot universe including Applebot, Bytespider, ClaudeBot, GPTBot, Meta-ExternalAgent, CCBot)
- Cloudflare Radar: Meta-ExternalAgent -- https://radar.cloudflare.com/bots/directory/meta-externalagent (March 2026 traffic share data)
- Cloudflare blog: Control content use for AI training -- https://blog.cloudflare.com/control-content-use-for-ai-training/
- Cloudflare blog: From Googlebot to GPTBot -- https://blog.cloudflare.com/from-googlebot-to-gptbot-whos-crawling-your-site-in-2025/

### llms.txt specification
- llmstxt.org official spec -- https://llmstxt.org/
- Mintlify: What is llms.txt -- https://www.mintlify.com/blog/what-is-llms-txt (co-developer perspective; notes Anthropic collaboration and skepticism about actual ingestion)
- Search Engine Land: llms.txt proposed standard -- https://searchengineland.com/llms-txt-proposed-standard-453676

### Sitemap status (Google ignoring priority/changefreq in 2026)
- sitemaps.org Protocol -- https://www.sitemaps.org/protocol.html (canonical schema; both fields still valid spec but "support varies")
- Iridium Works: Change Frequency, Last Change and Priority Values in Sitemaps -- https://www.iridium-works.com/en/blog-post/change-frequency-last-change-and-priority-values-in-sitemaps (2026 Google posture)

### JSON-LD / Schema.org for LLMs (MEDIUM confidence -- community consensus, not vendor-stated weighting)
- Szymon Slowik: Schema & JSON-LD for LLM Search (LLMO/AEO/GEO) -- https://www.szymonslowik.com/json-ld-for-llm-seo/
- Schema Pilot: JSON-LD Complete Guide 2026 -- https://www.schemapilot.app/blog/json-ld-guide/
- SchemaApp: Why Structured Data is the Future of LLMs -- https://www.schemaapp.com/schema-markup/why-structured-data-not-tokenization-is-the-future-of-llms/
- Schema.org SoftwareApplication -- https://schema.org/SoftwareApplication

### General 2026 AI crawler landscape
- No Hacks: AI User-Agent Landscape 2026 -- https://nohacks.co/blog/ai-user-agents-landscape-2026
- WebSearchAPI: Monthly AI Crawler Report March 2026 -- https://websearchapi.ai/blog/monthly-ai-crawler-report
- Lumina SEO: AI Crawlers 2026 Guide -- https://lumina-seo.com/blog/ai-crawlers-guide/

---
*Feature research for: SEO + GEO/AEO/LLMO discoverability for `full-selfbrowsing.com`*
*Researched: 2026-04-30*
