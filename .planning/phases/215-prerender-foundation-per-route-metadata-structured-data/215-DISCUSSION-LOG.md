# Phase 215: Prerender Foundation, Per-Route Metadata & Structured Data - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-30
**Phase:** 215-prerender-foundation-per-route-metadata-structured-data
**Areas discussed:** Title pattern + canonical host, OG image source, JSON-LD identity, Per-route copy

---

## Gray Area Selection

| Option | Description | Selected |
|--------|-------------|----------|
| Per-route copy | Title + meta description for /, /about, /privacy, /support | ✓ |
| OG image source | Existing brand assets vs commission new 1200×630 | ✓ |
| JSON-LD identity | Organization name/sameAs/contact + SoftwareApplication version/downloadUrl | ✓ |
| Title pattern + canonical host | `FSB — About` vs `About | FSB` vs `About - Full Self-Browsing`; canonical host format | ✓ |

**User selected all 4 areas.**

---

## Title pattern + canonical host

### Title format

| Option | Description | Selected |
|--------|-------------|----------|
| `FSB — About` | Em-dash, brand first, scannable in browser tabs. Pattern `FSB — {Page}`. | ✓ |
| `About \| FSB` | Page first, pipe separator, brand last. Conventional SEO pattern. | |
| `About - Full Self-Browsing` | Page first, hyphen, full name. Most descriptive but longest. | |

**User's choice:** `FSB — About` (em-dash, brand first).
**Notes:** Home is the exception — `FSB — Full Self-Browsing` (the tagline IS the page).

### Canonical host

| Option | Description | Selected |
|--------|-------------|----------|
| `https://full-selfbrowsing.com` (no www, no trailing slash) | Confirmed canonical. | ✓ |
| Add www subdomain | Would require redirects to change later. | |
| Use trailing slash on routes | `/about/` instead of `/about`. Rarely matters today. | |

**User's choice:** `https://full-selfbrowsing.com`, no www, https-only, no trailing slash on routes.

---

## OG image source

| Option | Description | Selected |
|--------|-------------|----------|
| Use `fsb_logo_dark.png` as-is | Existing 1000×1000 dark logo. Set `twitter:card: summary` (1:1). Unblocks today. | ✓ |
| Use `0.9.png` | If 0.9.png is the richer marketing asset. Same 1:1 caveat. | |
| Commission new 1200×630 now | Cleanest social-card render but blocks Phase 215 on a design step. | |
| Provide one before plan-phase | User drops a 1200×630 in the repo before planning. | |

**User's choice:** `showcase/assets/fsb_logo_dark.png`, `twitter:card: summary` (1:1 layout). Per-route 1200×630 variants explicitly deferred to v0.9.47.

---

## JSON-LD identity

### Organization name

| Option | Description | Selected |
|--------|-------------|----------|
| `FSB — Full Self-Browsing` | `name: "FSB"`, `alternateName: "Full Self-Browsing"`. Best for entity resolution. | ✓ |
| `Full Self-Browsing` | Long form only. `name: "Full Self-Browsing"`, `alternateName: "FSB"`. | |
| `FSB only` | Short form only. Risk: ambiguous match against other entities. | |

**User's choice:** `name: "FSB"`, `alternateName: "Full Self-Browsing"`.

### Organization sameAs links

| Option | Description | Selected |
|--------|-------------|----------|
| GitHub repo | https://github.com/lakshmanturlapati/FSB | ✓ |
| Twitter/X profile | Add if exists. | |
| LinkedIn | Personal or company page. | |
| GitHub only | Skip Twitter/LinkedIn for now. | |

**User's choice:** GitHub repo only. No Twitter/LinkedIn/contact email yet (defer until profiles exist).

### SoftwareApplication softwareVersion

| Option | Description | Selected |
|--------|-------------|----------|
| Read from `manifest.json` at build | Build script injects current version. Stays accurate. | ✓ |
| Hardcode `0.9.46` | Match this milestone version. Goes stale on next ship. | |
| Omit `softwareVersion` | Schema permits omission. | |

**User's choice:** Read from `manifest.json` at build time (Phase 216 owns the build script; Phase 215 uses an interim source per Claude's discretion).

### SoftwareApplication downloadUrl

| Option | Description | Selected |
|--------|-------------|----------|
| GitHub repo URL | https://github.com/lakshmanturlapati/FSB. Honest "install from source" signal. | ✓ |
| GitHub Releases page | More direct if release artifacts exist. | |
| Omit downloadUrl | Skip until CWS listing exists. | |

**User's choice:** `https://github.com/lakshmanturlapati/FSB` (repo root, not Releases — repo URL is more discoverable).

---

## Per-route copy

Drafts presented inline (titles + meta descriptions, with OG/Twitter mirroring meta description for v0.9.46):

- **/** — `FSB — Full Self-Browsing` / `Open-source Chrome extension that automates the browser through natural language. Multi-model AI (xAI, OpenAI, Anthropic, Gemini, local), 50+ actions, 142+ site guides.`
- **/about** — `FSB — About` / `Watch FSB drive Google, search Amazon, and book travel autonomously. See the open-source AI browser agent in action — your browser, your keys, your data.`
- **/privacy** — `FSB — Privacy` / `How FSB handles your data: API keys encrypted in Chrome local storage, no telemetry, automation runs locally in your browser. BYO key, BYO browser.`
- **/support** — `FSB — Support` / `Get help with FSB: setup guides, troubleshooting, GitHub issues, and direct contact. MIT-licensed open-source Chrome extension.`

| Option | Description | Selected |
|--------|-------------|----------|
| Approve all 4 | Lock these as the per-route copy for Phase 215. | ✓ |
| Adjust one or more | Tell me which route(s) to rewrite. | |
| Use shorter descriptions | Re-draft all 4 under 120 chars. | |

**User's choice:** Approve all 4.
**Notes:** OG/Twitter description copy mirrors the meta description verbatim for v0.9.46.

---

## Claude's Discretion

- SEO service architecture (shared `SeoService` vs direct `Title`/`Meta` calls in each component)
- Canonical injection mechanism (`Renderer2.setAttribute` vs `document.head.appendChild`)
- JSON-LD constant location (hand-written `<script>` in `index.html` vs TypeScript-injected at runtime)
- Phase 215 `softwareVersion` interim source (constant import vs Angular filesystem-read) — Phase 216 will refactor to share with the sitemap/llms-full generator

---

## Deferred Ideas

- Per-route 1200×630 OG image variants — v0.9.47 design pass
- Twitter `@site` / `@creator` handles — no profile yet
- Organization `contactPoint` — no public contact email yet
- `BreadcrumbList` JSON-LD — DISCO-FUTURE-03, redundant at flat route depth
- `FAQPage` JSON-LD — DISCO-FUTURE-01, needs `/faq` page first
- `provideClientHydration()` — PRE-FUTURE-01, not required for static prerender
