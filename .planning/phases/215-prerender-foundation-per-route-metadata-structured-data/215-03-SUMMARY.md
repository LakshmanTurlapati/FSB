---
phase: 215
plan: 03
subsystem: showcase-angular
tags: [seo, jsonld, schema-org, organization, softwareapplication, structured-data, angular19]
requirements: [LD-01, LD-02]
dependency-graph:
  requires:
    - "Plan 215-01 prerender pipeline (provideServerRouting + outputMode: static)"
    - "Plan 215-02 home component applyMeta + upsertCanonical wiring + TODO(plan-03) marker"
  provides:
    - "Organization JSON-LD baked into src/index.html, inherited by every prerendered route"
    - "SoftwareApplication JSON-LD injected via Renderer2 on home (/) only, with publisher.@id cross-reference to Organization"
    - "APP_VERSION constant at showcase/angular/src/app/core/seo/version.ts (interim source for D-14)"
    - "verify-ld.sh sourced by umbrella verify.sh, asserting LD-01, LD-02, T-LD-01"
  affects:
    - "Phase 216 CRAWL-05 will replace APP_VERSION's hand-edited value with a prebuild-generated read of manifest.json"
    - "Phase 216 LD-03 will run Google Rich Results Test against the deployed Organization + SoftwareApplication payloads"
tech-stack:
  added: []
  patterns:
    - "Hand-authored single-line strict JSON in <script type='application/ld+json'> for Organization (no '<' literal in any field, so no runtime escape pass needed)"
    - "Renderer2-driven idempotent JSON-LD injection with data-ld attribute guard for SoftwareApplication"
    - "T-LD-01 mitigation: JSON.stringify(payload).replace(/</g, '\\u003c') escapes every '<' literal as the JSON Unicode escape \\u003c, defeating </script> injection by construction"
    - "publisher.@id cross-reference binds SoftwareApplication to Organization via canonical @id 'https://full-selfbrowsing.com/#org' (Schema.org best practice for entity disambiguation)"
key-files:
  created:
    - showcase/angular/src/app/core/seo/version.ts
    - .planning/phases/215-prerender-foundation-per-route-metadata-structured-data/verify-ld.sh
  modified:
    - showcase/angular/src/index.html
    - showcase/angular/src/app/pages/home/home-page.component.ts
decisions:
  - "Organization JSON-LD location: hand-written single-line block in src/index.html (RESEARCH Open Question 3 RESOLVED) - simpler, grep-verifiable, atomic with the rest of the head, inherited by every prerendered route"
  - "softwareVersion source: showcase/angular/src/app/core/seo/version.ts exporting APP_VERSION='0.9.31' (RESEARCH Open Question 2 RESOLVED) - explicit, no tsconfig changes, replaceable by Phase 216 prebuild script without code-signature churn"
  - "Idempotency guard via data-ld='software-application' selector check in injectSoftwareApplicationJsonLd: prevents double-injection on route revisits, no observable side effects on prerender output"
  - "Verify-ld.sh script regex made attribute-flexible (<script\\b[^>]*\\btype=\"application/ld\\+json\"[^>]*>) so it matches both the hand-authored Organization block AND the Renderer2-injected SoftwareApplication block (which Angular decorates with _ngcontent-ng-c... and data-ld attributes BEFORE the type attr) - Rule 1 deviation, see below"
metrics:
  duration: "~9 minutes"
  completed-date: "2026-04-30"
  tasks-completed: 4
  commits: 4
---

# Phase 215 Plan 03: JSON-LD Structured Data Summary

JSON-LD identity baked into prerendered HTML: every route ships an Organization block (inherited from index.html), home additionally ships a SoftwareApplication block injected via Renderer2 with publisher.@id cross-referencing the Organization; T-LD-01 (XSS via JSON-LD `</script>` injection) mitigated by `JSON.stringify(...).replace(/</g, '\u003c')` and verified by python3 grep over output.

## Organization JSON-LD (LD-01) - As Committed

Inserted in `showcase/angular/src/index.html` between the icon link and the closing `</head>`, single line:

```json
{"@context":"https://schema.org","@type":"Organization","@id":"https://full-selfbrowsing.com/#org","name":"FSB","alternateName":"Full Self-Browsing","url":"https://full-selfbrowsing.com","logo":"https://full-selfbrowsing.com/assets/fsb_logo_dark.png","sameAs":["https://github.com/lakshmanturlapati/FSB"]}
```

- `@context`: `https://schema.org` (HTTPS, not HTTP -- Pitfall 3)
- `@id`: `https://full-selfbrowsing.com/#org` (canonical entity ID, cross-referenced by SoftwareApplication.publisher)
- Hand-authored, no `<` literal anywhere in payload, so no runtime escape pass needed
- Inherited by every prerendered route via index.html template

## SoftwareApplication JSON-LD (LD-02) - As Committed

Injected at runtime in `home-page.component.ts` `ngOnInit` via Renderer2 (home route only). Payload object before stringify:

```typescript
{
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'FSB',
  description: 'Open-source Chrome extension for AI-powered browser automation through natural language',
  url: 'https://full-selfbrowsing.com',
  applicationCategory: 'BrowserApplication',
  operatingSystem: 'Chrome',
  softwareVersion: APP_VERSION,            // imported from ../../core/seo/version (currently '0.9.31')
  downloadUrl: 'https://github.com/lakshmanturlapati/FSB',
  sameAs: ['https://github.com/lakshmanturlapati/FSB'],
  publisher: { '@id': 'https://full-selfbrowsing.com/#org' },
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
}
```

Serialized via `JSON.stringify(payload).replace(/</g, '\u003c')` (T-LD-01 mitigation: every `<` literal becomes the JSON Unicode escape `\u003c`, accepted by Schema.org parsers and Google Rich Results Test as a valid `<` while the HTML parser sees no `</script>` close tag).

Idempotency: `this.doc.head.querySelector('script[data-ld="software-application"]')` early-return prevents double-injection on route revisits.

The TODO(plan-03) marker in `home-page.component.ts:28` is REMOVED -- replaced with `this.injectSoftwareApplicationJsonLd();`.

## @id Cross-Reference

Organization in index.html exposes `@id: "https://full-selfbrowsing.com/#org"`. SoftwareApplication binds to it via `publisher: { "@id": "https://full-selfbrowsing.com/#org" }`. Schema.org parsers and AI search engines resolve the two entities as one bound pair (the canonical Google pattern for separate Organization and Product/Software entities).

## Verify Output (Full Phase 215 Gate)

```
$ npm --prefix showcase/angular run build
... Prerendered 4 static routes. Application bundle generation complete. [4.719 seconds]

$ bash .planning/phases/215-prerender-foundation-per-route-metadata-structured-data/verify.sh
[215 umbrella] running available sub-verifiers
[215] PRE-01: @angular/ssr installed
[215] PRE-02: angular.json outputMode + prerender wired
[215] PRE-03: prerender-routes.txt has exactly 4 marketing routes
[215] PRE-04: localStorage typeof guard present in index.html
[215] PRE-05: build output present for marketing routes; /dashboard absent
[215] verify-pre.sh: PRE-01..05 ALL PASSED
[215] META-01: each prerendered route has a unique <title>
[215] META-02: per-route canonical link present
[215] META-03: OG + Twitter Card tags present on each prerendered route
[215] META-04: dashboard component sets noindex,nofollow at runtime (source-level grep)
[215] verify-meta.sh: META-01..04 ALL PASSED
[215] LD-01: Organization JSON-LD on every prerendered route
[215] LD-02: SoftwareApplication exactly once on home, zero elsewhere
[215] T-LD-01: JSON-LD script bodies do NOT contain unescaped </
OK: showcase/dist/showcase-angular/browser/index.html -> 2 JSON-LD block(s), all '</' escaped as \u003c/
OK: showcase/dist/showcase-angular/browser/about/index.html -> 1 JSON-LD block(s), all '</' escaped as \u003c/
OK: showcase/dist/showcase-angular/browser/privacy/index.html -> 1 JSON-LD block(s), all '</' escaped as \u003c/
OK: showcase/dist/showcase-angular/browser/support/index.html -> 1 JSON-LD block(s), all '</' escaped as \u003c/
[215] verify-ld.sh: LD-01, LD-02, T-LD-01 ALL PASSED
[215 umbrella] ALL AVAILABLE ASSERTIONS PASSED
```

Note: home (`index.html`) reports 2 JSON-LD blocks (Organization inherited from src/index.html template + SoftwareApplication injected by home component); about/privacy/support each report 1 (Organization only). All four routes pass the T-LD-01 assertion: zero `</` substrings inside any script body across all prerendered HTML.

## How to Re-verify

```bash
cd /Users/lakshmanturlapati/Desktop/FSB
npm --prefix showcase/angular install   # if a fresh worktree
npm --prefix showcase/angular run build
bash .planning/phases/215-prerender-foundation-per-route-metadata-structured-data/verify.sh
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] verify-ld.sh python3 regex did not match Angular Renderer2-injected JSON-LD scripts**

- **Found during:** Task 4 (running verify-ld.sh after build)
- **Issue:** The plan's specified regex `<script type="application/ld\+json">(.*?)</script>` only matched scripts where `type` is the FIRST attribute. Angular's Renderer2 emits the SoftwareApplication script as `<script _ngcontent-ng-c1210430804 type="application/ld+json" data-ld="software-application">...</script>` -- the `_ngcontent-...` view-encapsulation attribute and `data-ld` decorator slot in BEFORE and AFTER the `type` attr. Result: the regex saw only the Organization block on home (count=1) and missed the SoftwareApplication block entirely. This is a load-bearing bug for T-LD-01: any future `</` substring inside the SoftwareApplication body would slip past the assertion.
- **Fix:** Replaced the regex with `<script\b[^>]*\btype="application/ld\+json"[^>]*>(.*?)</script>` (attribute-order-flexible, accepts any `<script>` opening tag carrying the `type="application/ld+json"` attribute regardless of position). Added an inline comment in verify-ld.sh explaining why. Re-ran: home now correctly reports 2 JSON-LD blocks, both pass the `</` check.
- **Files modified:** `.planning/phases/215-prerender-foundation-per-route-metadata-structured-data/verify-ld.sh`
- **Commit:** 315b812

No Rule 2, Rule 3, or Rule 4 deviations.

## Authentication Gates

None.

## Deferred Issues

None for this plan. Phase 215 is now fully gated; Phase 216 (CRAWL + SRV + SMOKE) is the next milestone phase and will:
- Replace `APP_VERSION` constant in `core/seo/version.ts` with a prebuild-generated value from `manifest.json:4` (D-14 / CRAWL-05).
- Run Google Rich Results Test against the deployed Organization + SoftwareApplication payloads (LD-03).

## Threat Flags

None. The threat register entries T-LD-01, T-LD-02, T-LD-03 are all addressed:
- T-LD-01 (Tampering / XSS via SoftwareApplication injection): mitigated by `JSON.stringify(...).replace(/</g, '\u003c')` at source level (`grep -q "replace(/</g, '\\u003c')"`) and at output level (verify-ld.sh python3 assertion confirms no `</` substring in any prerendered JSON-LD body).
- T-LD-02 (Tampering on Organization JSON-LD in index.html): mitigated by hand-authored single-line JSON containing zero `<` literals; verify-ld.sh assertion catches any future regression.
- T-LD-03 (Information disclosure via wrong entity claim): accepted -- payload claims are public marketing facts; Phase 216 LD-03 (Rich Results Test) catches semantic errors.

## Self-Check: PASSED

Verified files exist:
- showcase/angular/src/app/core/seo/version.ts: FOUND
- showcase/angular/src/index.html: FOUND (Organization JSON-LD inserted)
- showcase/angular/src/app/pages/home/home-page.component.ts: FOUND (TODO(plan-03) removed, injectSoftwareApplicationJsonLd added)
- .planning/phases/215-prerender-foundation-per-route-metadata-structured-data/verify-ld.sh: FOUND (chmod +x)
- showcase/dist/showcase-angular/browser/index.html: FOUND (2 JSON-LD blocks)
- showcase/dist/showcase-angular/browser/about/index.html: FOUND (1 JSON-LD block, Organization only)
- showcase/dist/showcase-angular/browser/privacy/index.html: FOUND (1 JSON-LD block, Organization only)
- showcase/dist/showcase-angular/browser/support/index.html: FOUND (1 JSON-LD block, Organization only)

Verified commits exist on Refinements (worktree-agent-aa1f1033):
- 061c2d4: FOUND (Task 1 - APP_VERSION constant)
- bda7ea6: FOUND (Task 2 - Organization JSON-LD in index.html)
- 5caca4b: FOUND (Task 3 - SoftwareApplication injection in home component)
- 315b812: FOUND (Task 4 - verify-ld.sh)

Verified `bash .planning/phases/215-prerender-foundation-per-route-metadata-structured-data/verify.sh` exits 0 with PRE-01..05 + META-01..04 + LD-01..02 + T-LD-01 all green.
