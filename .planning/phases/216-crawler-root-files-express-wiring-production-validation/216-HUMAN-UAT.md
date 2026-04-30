---
status: partial
phase: 216-crawler-root-files-express-wiring-production-validation
source: [216-VERIFICATION.md, 216-05-PLAN.md]
started: 2026-04-30
updated: 2026-04-30
---

## Current Test

[awaiting human testing]

## Tests

### 1. Rich Results Test -- Home page JSON-LD (LD-03)
expected: Rich Results Test (https://search.google.com/test/rich-results) on https://full-selfbrowsing.com/ detects EXACTLY one Organization block and EXACTLY one SoftwareApplication block, with zero errors and zero warnings. Organization carries name "FSB", alternateName "Full Self-Browsing", url "https://full-selfbrowsing.com", logo "https://full-selfbrowsing.com/assets/fsb_logo_dark.png", sameAs ["https://github.com/lakshmanturlapati/FSB"]. SoftwareApplication carries applicationCategory "BrowserApplication", operatingSystem "Chrome", offers.price "0", softwareVersion matching manifest.json's version field, publisher.@id cross-referencing the Organization @id.
result: [pending]

### 2. Search Console "Test live URL" -- Home (/) (SMOKE-04)
expected: Google Search Console -> Inspect URL -> Test Live URL on https://full-selfbrowsing.com/ returns "URL is available to Google" with rendered HTML matching the prerendered HTML; no `noindex` warnings; no "JavaScript-only content" notes; rendered DOM contains route-specific title and JSON-LD blocks (Organization + SoftwareApplication).
result: [pending]

### 3. Search Console "Test live URL" -- About (/about) (SMOKE-04)
expected: Google Search Console -> Inspect URL -> Test Live URL on https://full-selfbrowsing.com/about returns "URL is available to Google"; rendered HTML matches prerendered HTML; route-specific title `FSB -- About` and canonical `https://full-selfbrowsing.com/about`; no `noindex`; no JavaScript-only-content note.
result: [pending]

### 4. Search Console "Test live URL" -- Privacy (/privacy) (SMOKE-04)
expected: Google Search Console -> Inspect URL -> Test Live URL on https://full-selfbrowsing.com/privacy returns "URL is available to Google"; rendered HTML matches prerendered HTML; route-specific title `FSB -- Privacy` and canonical `https://full-selfbrowsing.com/privacy`; no `noindex`; no JavaScript-only-content note.
result: [pending]

### 5. Search Console "Test live URL" -- Support (/support) (SMOKE-04)
expected: Google Search Console -> Inspect URL -> Test Live URL on https://full-selfbrowsing.com/support returns "URL is available to Google"; rendered HTML matches prerendered HTML; route-specific title `FSB -- Support` and canonical `https://full-selfbrowsing.com/support`; no `noindex`; no JavaScript-only-content note.
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps

(operator: record any deviations from expected outcomes here when running the UAT post-deploy)

---

# Phase 216 Human UAT -- Detailed Entries

This file tracks manual validation checks that require a Google account, browser session, and a live production deploy. Per CONTEXT.md D-13 these cannot be scripted. The automated smoke (Plan 04 verify-smoke.sh + smoke-crawler.mjs) is the file-level gate; this UAT covers the rendering-engine and structured-data validators that only Google itself can run.

Run order: deploy first; verify automated smoke against production with `BASE_URL=https://full-selfbrowsing.com npm --prefix showcase/angular run smoke:crawler`; THEN run the five UAT entries below. Update each entry's Status / Evidence / Date fields when complete.

<!-- UAT entry separator -->

## UAT-216-01: Search Console "Test live URL" -- Home (/)

- **Requirement:** SMOKE-04
- **URL to test:** https://full-selfbrowsing.com/
- **Tool:** Google Search Console -> Inspect URL -> Test Live URL (https://search.google.com/search-console)
- **Expected outcome:** "URL is available to Google" with rendered HTML matching the prerendered HTML; no `noindex` warnings; no "JavaScript-only content" notes; the rendered DOM contains the route-specific title `FSB -- Full Self-Browsing` and the JSON-LD blocks (Organization + SoftwareApplication).
- **Status:** [ ] not yet run
- **Evidence:** _(operator: paste Search Console screenshot URL or archive link here)_
- **Date:** _(YYYY-MM-DD when run)_

<!-- UAT entry separator -->

## UAT-216-02: Search Console "Test live URL" -- About (/about)

- **Requirement:** SMOKE-04
- **URL to test:** https://full-selfbrowsing.com/about
- **Tool:** Google Search Console -> Inspect URL -> Test Live URL (https://search.google.com/search-console)
- **Expected outcome:** "URL is available to Google"; rendered HTML matches prerendered HTML; route-specific title `FSB -- About` and route-specific canonical (`https://full-selfbrowsing.com/about`); no `noindex`; no JavaScript-only-content note.
- **Status:** [ ] not yet run
- **Evidence:** _(operator: paste screenshot or archive link)_
- **Date:** _(YYYY-MM-DD when run)_

<!-- UAT entry separator -->

## UAT-216-03: Search Console "Test live URL" -- Privacy (/privacy)

- **Requirement:** SMOKE-04
- **URL to test:** https://full-selfbrowsing.com/privacy
- **Tool:** Google Search Console -> Inspect URL -> Test Live URL (https://search.google.com/search-console)
- **Expected outcome:** "URL is available to Google"; rendered HTML matches prerendered HTML; route-specific title `FSB -- Privacy` and canonical `https://full-selfbrowsing.com/privacy`; no `noindex`; no JavaScript-only-content note.
- **Status:** [ ] not yet run
- **Evidence:** _(operator: paste screenshot or archive link)_
- **Date:** _(YYYY-MM-DD when run)_

<!-- UAT entry separator -->

## UAT-216-04: Search Console "Test live URL" -- Support (/support)

- **Requirement:** SMOKE-04
- **URL to test:** https://full-selfbrowsing.com/support
- **Tool:** Google Search Console -> Inspect URL -> Test Live URL (https://search.google.com/search-console)
- **Expected outcome:** "URL is available to Google"; rendered HTML matches prerendered HTML; route-specific title `FSB -- Support` and canonical `https://full-selfbrowsing.com/support`; no `noindex`; no JavaScript-only-content note.
- **Status:** [ ] not yet run
- **Evidence:** _(operator: paste screenshot or archive link)_
- **Date:** _(YYYY-MM-DD when run)_

<!-- UAT entry separator -->

## UAT-216-05: Rich Results Test -- Home page JSON-LD

- **Requirement:** LD-03 + SMOKE-04 (Rich Results clause)
- **URL to test:** https://full-selfbrowsing.com/
- **Tool:** Rich Results Test (https://search.google.com/test/rich-results)
- **Expected outcome:** Detected items list contains EXACTLY one `Organization` block and EXACTLY one `SoftwareApplication` block (Phase 215 LD-01 + LD-02). Zero errors. Zero warnings. The Organization block carries `name: "FSB"`, `alternateName: "Full Self-Browsing"`, `url: "https://full-selfbrowsing.com"`, `logo: "https://full-selfbrowsing.com/assets/fsb_logo_dark.png"`, `sameAs: ["https://github.com/lakshmanturlapati/FSB"]`. The SoftwareApplication block carries `applicationCategory: "BrowserApplication"`, `operatingSystem: "Chrome"`, `offers.price: "0"`, `softwareVersion` matching manifest.json's version field, and `publisher.@id` cross-referencing the Organization's @id.
- **Status:** [ ] not yet run
- **Evidence:** _(operator: paste Rich Results Test screenshot URL or archive link; include the "View tested page" rendered HTML if there are any warnings)_
- **Date:** _(YYYY-MM-DD when run)_

<!-- UAT entry separator -->

## Sign-off

Once all five entries above are Status: PASSED, Phase 216 is complete and the v0.9.46 milestone is signed off. If any entry fails, follow the gap-closure path: open a follow-up phase (216.1 or 217) to address the specific finding, do NOT silently update the entry's expected outcome.
