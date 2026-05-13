# Phase 264: Per-Locale Bootstrap — Context

**Gathered:** 2026-05-12
**Mode:** `--auto` (full autonomous, recommended-default selection per gray area)
**Branch:** `feat/showcase-i18n`

<domain>
## Phase Boundary

Per-locale `index.html` rendered at prerender time for every supported locale (`en`, `es`, `de`, `ja`, `zh-CN`, `zh-TW`) across all 6 marketing routes (`/`, `/about`, `/agents`, `/privacy`, `/support`, and the `/` home alias for non-`en` locale roots). Each prerendered HTML carries:

1. `<link rel="alternate" hreflang="...">` fan-out covering all 6 locales **plus `x-default`** (pointing at `en`).
2. Exactly one `<link rel="canonical">` pointing at the page's own locale-specific absolute URL.
3. `<html lang="...">` matching the served locale.

Sibling target XLIFFs (`messages.{es,de,ja,zh-CN,zh-TW}.xlf`) are **owned by Phase 265**; this phase MUST NOT modify them. `lint:i18n` and `extract-i18n-clean` CI gates must stay green throughout.

**Out of scope (deferred):**
- Dashboard surface (v0.9.65).
- Open Graph / Twitter Card `og:locale` and `og:locale:alternate` fan-out (capture in Deferred Ideas; Phase 266 verification may surface it).
</domain>

<canonical_refs>
## Canonical Refs

- `.planning/ROADMAP.md` — Phase 264 success criteria (5 items) and milestone hard constraints.
- `.planning/REQUIREMENTS.md` — SEO-01 (this phase's primary REQ).
- `.planning/phases/262-marketing-strings/262-05-SUMMARY.md` — locks the "known limitation" that `ng extract-i18n` doesn't scan `index.html`; Phase 264 is the phase that revisits per-locale `index.html` bootstrap (cited explicitly).
- `showcase/angular/src/app/core/i18n/locale-constants.ts` — `LOCALES` + `LOCALE_SUBPATHS` + `SOURCE_LOCALE` (source of truth for hreflang list and URL path construction).
- `showcase/angular/src/app/core/i18n/locale.service.ts` — runtime locale resolution; reused by per-page canonical/hreflang logic.
- `showcase/angular/angular.json` (i18n block) — `locales.{es,de,ja,zh-CN,zh-TW}.subPath` already maps each locale to its URL prefix; the Angular i18n build sets `<html lang="...">` automatically on prerender.
- `showcase/angular/src/app/pages/{home,about,agents,privacy,support}/<page>-page.component.ts` — existing per-page canonical setters in `ngOnInit` via `Renderer2` (HOME, ABOUT, AGENTS, PRIVACY, SUPPORT pages each manage their own canonical).
- `showcase/angular/src/index.html` — static bootstrap; `<html lang="...">` value at prerender is set by Angular's i18n compiler based on the active locale (per `angular.json` `locales` map).
- `.planning/codebase/STACK.md`, `.planning/codebase/STRUCTURE.md`, `.planning/codebase/INTEGRATIONS.md` — codebase intel for downstream agents.
</canonical_refs>

<code_context>
## Existing Code Insights

**Reusable assets:**
- `LOCALE_SUBPATHS` (locale-constants.ts:21-28) maps each locale to its URL prefix: `'en'→''`, `'es'→'es'`, etc. Reuse verbatim for both canonical path construction and hreflang `href` values.
- Each marketing page component already imports `Renderer2` + `DOCUMENT` and has an `ngOnInit` that sets `<link rel="canonical">` for the EN baseline (e.g., `home-page.component.ts:HOST = 'https://full-selfbrowsing.com'`, `about-page.component.ts` uses `${HOST}/about`). Extending these handlers is preferable to a new shared service — keeps per-page route knowledge collocated and avoids a wide refactor.
- Angular's i18n compiler sets `<html lang="...">` automatically when building with `--localize` per locale entry in `angular.json`. **No code change required** for criterion 3 — only verification in Phase 266.

**Patterns to follow:**
- Locale-aware URL construction: `LOCALE_SUBPATHS[locale]` returns `''` for `en` and the subpath for non-`en`. Canonical for any page on locale L = `${HOST}${LOCALE_SUBPATHS[L] ? '/' + LOCALE_SUBPATHS[L] : ''}${routePath}` (home uses `''` route path; other routes use `/about`, `/agents`, etc.).
- Existing `home-page.component.ts` honors a doc-level invariant: home canonical has **no trailing slash** (`'https://full-selfbrowsing.com'`, not `.../`). Preserve this for non-`en` home variants: `https://full-selfbrowsing.com/es` (not `/es/`).

**Integration points:**
- `verify-locale-sync.mjs` CI invariant — any change to locale list must update both `showcase/angular/src/app/core/i18n/locale-constants.ts` and `showcase/server/src/utils/locale-constants.js`. This phase does NOT add locales; constraint applies if downstream phases do.
- Existing `build-crawler-files.mjs` + smoke-crawler tooling — Phase 266 verification likely extends these to assert hreflang/canonical correctness on prerendered HTML. Not in this phase's scope.
</code_context>

<decisions>
## Implementation Decisions (auto-selected per `--auto` mode)

### D-01 — Implementation surface: per-page component `ngOnInit` (extend existing)
**Auto: Selected.** Extend each marketing page's existing canonical-setter `ngOnInit` to also write the locale-aware canonical and the hreflang fan-out. Alternatives considered: (a) shared `LocaleSeoService` injected into each page (rejected — adds an indirection for code that's already collocated and runs per-page anyway), (b) build-time post-process script over prerendered HTML (rejected — fragile, duplicates URL knowledge already in component code, harder to test). Extending in-place keeps route → URL → canonical knowledge in one file per page and reuses the existing `Renderer2`/`DOCUMENT` injection.

### D-02 — Hreflang list source: `LOCALES` from locale-constants.ts
**Auto: Selected.** Iterate `LOCALES` (which includes `en`) to emit 6 `<link rel="alternate" hreflang>` tags, then emit a 7th with `hreflang="x-default"` pointing at the `en` URL. No hardcoded locale lists in components.

### D-03 — `x-default` target: `en`
**Auto: Selected.** Per ROADMAP success criterion 1 (locked), `x-default` points at the `en` URL for the same route. This matches Google's recommendation for English-as-source-of-truth sites.

### D-04 — Canonical URL form: locale-prefixed for non-`en`, bare for `en`
**Auto: Selected.** Reuse `LOCALE_SUBPATHS`: canonical for locale L on route R = `${HOST}${LOCALE_SUBPATHS[L] ? '/' + LOCALE_SUBPATHS[L] : ''}${R}`. Home (R = `''`) on `en` stays at `https://full-selfbrowsing.com` (no trailing slash, per existing home-page invariant); home on `es` becomes `https://full-selfbrowsing.com/es`. Other routes: `/about` → `https://full-selfbrowsing.com/about` (en) / `https://full-selfbrowsing.com/es/about` (es).

### D-05 — `<html lang>`: rely on Angular i18n compiler (no code change)
**Auto: Selected.** Angular's `@angular/build` localize step sets `<html lang="{locale}">` on each prerendered HTML based on the `angular.json` locales map. This phase MUST NOT manually set `<html lang>` (would conflict with the compiler). Phase 266 verification asserts the value is correct on every prerendered HTML.

### D-06 — Active locale discovery in components: `LOCALE_ID` injection token
**Auto: Selected.** Each page component injects `@Inject(LOCALE_ID) private localeId: string` (Angular's built-in token, set by the i18n compiler to the active locale string e.g. `'en'`, `'zh-CN'`). The component uses `this.localeId as LocaleCode` (with `isValidLocale` guard for safety) to look up `LOCALE_SUBPATHS[localeId]`. This avoids a runtime call to `LocaleService` for SSR-safe behavior at prerender time.

### D-07 — Hreflang link emission: cleanup + write pattern matching existing canonical setter
**Auto: Selected.** Each `ngOnInit` first removes any pre-existing `<link rel="alternate">` tags from `<head>` (idempotency in case of route re-entry on CSR), then emits 7 new ones via `Renderer2.createElement` + `Renderer2.appendChild`. Mirrors the existing canonical-link upsert pattern in each page's component.

### D-08 — `og:locale` / `og:locale:alternate` Open Graph fan-out
**Auto: Deferred.** Captured in `<deferred>`. Out of scope for SEO-01; can land in v0.9.64 as a follow-on or be folded into Phase 266 if verification surfaces it as a regression in social preview.

### D-09 — Sitemap regeneration with per-locale entries
**Auto: Deferred.** Captured in `<deferred>`. The existing `sitemap.xml` is produced by `build-crawler-files.mjs` (v0.9.46 SEO milestone). Phase 266 verification or a follow-on phase will revisit whether sitemap fan-out is needed alongside hreflang on the HTML itself.

### D-10 — Testing strategy: unit + post-build assertion
**Auto: Selected.** (a) Per-page unit test: assert canonical href and hreflang list count for `en` and one non-`en` locale (mock `LOCALE_ID` via `TestBed.configureTestingModule({providers: [{ provide: LOCALE_ID, useValue: 'es' }]})`). (b) Post-prerender assertion script (could be reused/extended from `smoke-crawler.mjs` or new): grep each prerendered HTML for 7 hreflang tags + 1 canonical + correct `<html lang>`. Plan-phase researcher decides between extending smoke-crawler vs. a new dedicated script.

### D-11 — Failure mode on unknown `LOCALE_ID`
**Auto: Selected.** Defensive: if `isValidLocale(this.localeId)` returns false, log a `console.warn` and fall back to `'en'` for URL construction. Should never happen in production (Angular i18n compiler always sets a valid locale), but guards against test misconfiguration and runtime CSR weirdness.

### Folded Todos

None — no relevant pending todos for this phase.
</decisions>

<specifics>
## Specific Ideas (locked from milestone-level constraints)

- **Host:** `https://full-selfbrowsing.com` (no trailing slash on home; matches existing `HOST` constant in `home-page.component.ts`).
- **Locale order in hreflang block:** `en`, `es`, `de`, `ja`, `zh-CN`, `zh-TW`, then `x-default`. Iterate `LOCALES` in declaration order for stability.
- **Marketing routes covered:** `/`, `/about`, `/agents`, `/privacy`, `/support` — 5 routes x 6 locales = 30 prerendered HTMLs (matches Phase 266 BUILD-01).
- **Verification site URL:** Phase 266 uses Google Rich Results Test + manual hreflang lint (or a node script) against the prerendered HTML in `dist/`.
</specifics>

<deferred>
## Deferred Ideas (out of v0.9.63 scope)

- **Open Graph locale tags** (`og:locale`, `og:locale:alternate`) — social-preview fidelity for non-`en` shares. Capture as follow-on REQ in v0.9.64 or fold into Phase 266 if regression observed.
- **Sitemap.xml hreflang fan-out** — extend `build-crawler-files.mjs` to emit `<xhtml:link rel="alternate" hreflang>` entries inside `sitemap.xml`. Currently the sitemap lists routes once; hreflang lives on the HTML. Google accepts both forms; HTML-level is sufficient for crawler discovery. Defer to v0.9.64.
- **Per-locale `robots.txt` or `llms.txt`** — current files are EN-only and language-agnostic. No action this milestone.
- **Search-engine submitted URL inspection** — Google Search Console URL submission for non-`en` URLs after milestone ships. User action, not engineering scope.
- **Dashboard surface** — explicitly deferred to v0.9.65 per user decision 2026-05-12.
</deferred>
