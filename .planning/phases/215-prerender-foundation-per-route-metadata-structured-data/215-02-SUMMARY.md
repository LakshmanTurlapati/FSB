---
phase: 215
plan: 02
subsystem: showcase-angular
tags: [seo, meta, opengraph, twitter-card, canonical, robots, angular19]
requirements: [META-01, META-02, META-03, META-04]
dependency-graph:
  requires:
    - "Plan 215-01 prerender pipeline (provideServerRouting + outputMode: static)"
    - "@angular/platform-browser Title + Meta services (transitive via @angular/platform-browser)"
  provides:
    - "Per-route Title/description/canonical/OG/Twitter Card tags in prerendered HTML for /, /about, /privacy, /support"
    - "Runtime noindex,nofollow on /dashboard via Meta.updateTag in ngOnInit"
    - "verify-meta.sh META-01..04 assertions sourced by umbrella verify.sh"
  affects:
    - "Plan 215-03 (LD) layers JSON-LD on top of the same head; home component carries TODO(plan-03) marker for SoftwareApplication injection"
tech-stack:
  added: []
  patterns:
    - "ngOnInit applyMeta(t,d,url) helper across four marketing components (Title.setTitle + 12 Meta.updateTag calls)"
    - "upsertCanonical via DOCUMENT.head.querySelector + Renderer2.createElement/setAttribute/appendChild"
    - "Em-dash via \\u2014 Unicode escape (UTF-8 0xE2 0x80 0x94) per RESEARCH Pitfall 6"
key-files:
  created:
    - .planning/phases/215-prerender-foundation-per-route-metadata-structured-data/verify-meta.sh
  modified:
    - showcase/angular/src/app/pages/home/home-page.component.ts
    - showcase/angular/src/app/pages/about/about-page.component.ts
    - showcase/angular/src/app/pages/privacy/privacy-page.component.ts
    - showcase/angular/src/app/pages/support/support-page.component.ts
    - showcase/angular/src/app/pages/dashboard/dashboard-page.component.ts
decisions:
  - "Direct Title/Meta/Renderer2 calls per component (no shared SeoService) - only four marketing routes with bespoke copy, per CONTEXT.md Claude's-discretion threshold of 5+ components"
  - "applyMeta + upsertCanonical helpers duplicated across four components rather than extracted - keeps each component self-contained, matches per-route copy idiom"
  - "Home canonical resolves to bare HOST (no trailing slash) per D-02; about/privacy/support append /<route>"
  - "Em-dash uses TypeScript escape \\u2014 in source so the file is ASCII-clean; the prerendered HTML emits the actual UTF-8 em-dash character"
metrics:
  duration: "~12 minutes"
  completed-date: "2026-04-30"
  tasks-completed: 4
  commits: 4
---

# Phase 215 Plan 02: Per-Route Metadata Summary

Per-route head metadata wiring complete: all four marketing components (/ /about /privacy /support) now emit unique titles, descriptions, canonical links, six OpenGraph tags, and four Twitter Card tags into the prerendered HTML; /dashboard sets `noindex, nofollow` at runtime via Meta.updateTag.

## Per-Route Copy Shipped (Verbatim)

### `/` (home-page.component.ts:24-28)
- title: `FSB \u2014 Full Self-Browsing`
- description: `Open-source Chrome extension that automates the browser through natural language. Multi-model AI (xAI, OpenAI, Anthropic, Gemini, local), 50+ actions, 142+ site guides.`
- canonical: `https://full-selfbrowsing.com` (no trailing slash, D-02)
- TODO(plan-03) marker present for LD-02 SoftwareApplication injection handoff.

### `/about` (about-page.component.ts:53-58)
- title: `FSB \u2014 About`
- description: `Watch FSB drive Google, search Amazon, and book travel autonomously. See the open-source AI browser agent in action \u2014 your browser, your keys, your data.`
- canonical: `https://full-selfbrowsing.com/about`

### `/privacy` (privacy-page.component.ts:22-26)
- title: `FSB \u2014 Privacy`
- description: `How FSB handles your data: API keys encrypted in Chrome local storage, no telemetry, automation runs locally in your browser. BYO key, BYO browser.`
- canonical: `https://full-selfbrowsing.com/privacy`

### `/support` (support-page.component.ts:22-26)
- title: `FSB \u2014 Support`
- description: `Get help with FSB: setup guides, troubleshooting, GitHub issues, and direct contact. MIT-licensed open-source Chrome extension.`
- canonical: `https://full-selfbrowsing.com/support`

### `/dashboard` (dashboard-page.component.ts:71-77)
- runtime Meta.updateTag at top of `ngOnInit`: `<meta name="robots" content="noindex, nofollow">`
- no canonical, OG, Twitter, or JSON-LD per D-18 + D-19
- still excluded from prerender output (verified absent on disk).

## upsertCanonical Method Shape

Each marketing component carries the same private helper. Reference: `showcase/angular/src/app/pages/about/about-page.component.ts:88-95`:

```typescript
private upsertCanonical(href: string): void {
  let link = this.doc.head.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!link) {
    link = this.renderer.createElement('link') as HTMLLinkElement;
    this.renderer.setAttribute(link, 'rel', 'canonical');
    this.renderer.appendChild(this.doc.head, link);
  }
  this.renderer.setAttribute(link, 'href', href);
}
```

Same pattern lives at home:48-55, privacy:45-52, support:46-53.

## Dashboard Meta Call Position

The robots meta call sits at the top of `ngOnInit`, before any other dashboard wiring fires (chrome.storage handlers run in `ngAfterViewInit`, so ngOnInit was a clean greenfield insertion):

```typescript
// dashboard-page.component.ts:75-77
ngOnInit(): void {
  this.meta.updateTag({ name: 'robots', content: 'noindex, nofollow' });
}
```

Existing `ngAfterViewInit` and `ngOnDestroy` lifecycle methods preserved verbatim; class signature now reads `implements OnInit, AfterViewInit, OnDestroy`.

## Build Output Grep Confirmations

After `npm --prefix showcase/angular run build` (exits 0, "Prerendered 4 static routes."):

```
showcase/dist/showcase-angular/browser/index.html
  <title>FSB \u2014 Full Self-Browsing</title>
  rel="canonical" href="https://full-selfbrowsing.com"
  property="og:title" content="FSB \u2014 Full Self-Browsing"
  name="twitter:card" content="summary"

showcase/dist/showcase-angular/browser/about/index.html
  <title>FSB \u2014 About</title>
  rel="canonical" href="https://full-selfbrowsing.com/about"
  property="og:title" content="FSB \u2014 About"
  name="twitter:card" content="summary"

showcase/dist/showcase-angular/browser/privacy/index.html
  <title>FSB \u2014 Privacy</title>
  rel="canonical" href="https://full-selfbrowsing.com/privacy"

showcase/dist/showcase-angular/browser/support/index.html
  <title>FSB \u2014 Support</title>
  rel="canonical" href="https://full-selfbrowsing.com/support"

showcase/dist/showcase-angular/browser/dashboard/                  <-- ABSENT
```

Note: prerendered HTML emits the literal UTF-8 em-dash character (Unicode 0x2014); source uses the `\u2014` TypeScript escape so files remain ASCII-clean.

## How to Re-verify

```bash
cd /Users/lakshmanturlapati/Desktop/FSB
npm --prefix showcase/angular install   # if a fresh worktree
npm --prefix showcase/angular run build
bash .planning/phases/215-prerender-foundation-per-route-metadata-structured-data/verify.sh
```

Expected tail:
```
[215] verify-pre.sh: PRE-01..05 ALL PASSED
[215] verify-meta.sh: META-01..04 ALL PASSED
[215 umbrella] verify-ld.sh not present yet (Plan 03 creates it) - skipping
[215 umbrella] ALL AVAILABLE ASSERTIONS PASSED
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocker] Worktree node_modules missing @angular/ssr dependencies**

- **Found during:** Task 3 (production build invocation)
- **Issue:** First `npm --prefix showcase/angular run build` failed with `Could not resolve "@angular/ssr"`, `"@angular/platform-server"`, `"@angular/ssr/node"`, and `"express"`. Plan 01 added these to `showcase/angular/package.json` but this fresh parallel-execute worktree had not run `npm install`.
- **Fix:** Ran `npm --prefix showcase/angular install` (added 87 packages, took ~1s as the lockfile already pinned the resolved versions). Subsequent build succeeded with `Prerendered 4 static routes.`
- **Files modified:** none committed (node_modules is gitignored)
- **Commit:** n/a (environment fix, no source changes)

No Rule 1, Rule 2, or Rule 4 deviations.

## Authentication Gates

None.

## Deferred Issues

None for this plan. Plan 03 owns LD-01 (Organization JSON-LD in index.html) and LD-02 (SoftwareApplication JSON-LD in home component, keyed off the `TODO(plan-03)` marker added in Task 2).

## Threat Flags

None. The threat register entries T-META-01 (Information disclosure on /dashboard) and T-META-02 (Tampering on head metadata strings) are mitigated/accepted as planned: D-19 robots meta is wired, all metadata strings are compile-time constants, and Angular's Meta service handles attribute escaping.

## Self-Check: PASSED

Verified files exist:
- showcase/angular/src/app/pages/home/home-page.component.ts: FOUND (modified)
- showcase/angular/src/app/pages/about/about-page.component.ts: FOUND (modified)
- showcase/angular/src/app/pages/privacy/privacy-page.component.ts: FOUND (modified)
- showcase/angular/src/app/pages/support/support-page.component.ts: FOUND (modified)
- showcase/angular/src/app/pages/dashboard/dashboard-page.component.ts: FOUND (modified)
- .planning/phases/215-prerender-foundation-per-route-metadata-structured-data/verify-meta.sh: FOUND (chmod +x)

Verified prerendered HTML carries expected metadata:
- showcase/dist/showcase-angular/browser/index.html: title, canonical, og:title, twitter:card present
- showcase/dist/showcase-angular/browser/about/index.html: title, canonical, og:title, twitter:card present
- showcase/dist/showcase-angular/browser/privacy/index.html: title, canonical, og:title, twitter:card present
- showcase/dist/showcase-angular/browser/support/index.html: title, canonical, og:title, twitter:card present
- showcase/dist/showcase-angular/browser/dashboard/index.html: ABSENT (as required by D-18)

Verified commits exist on Refinements (worktree-agent-a7d04720):
- 3a1d824: FOUND (Task 1 - about/privacy/support)
- 75efd9c: FOUND (Task 2 - home + TODO(plan-03))
- a458993: FOUND (Task 3 - dashboard noindex,nofollow + build verified)
- 2d3e4cc: FOUND (Task 4 - verify-meta.sh)

Verified `bash .planning/phases/215-prerender-foundation-per-route-metadata-structured-data/verify.sh` exits 0 with PRE-01..05 + META-01..04 all green and verify-ld.sh informationally skipped.
