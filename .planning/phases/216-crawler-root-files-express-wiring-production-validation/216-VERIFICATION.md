---
phase: 216-crawler-root-files-express-wiring-production-validation
verified: 2026-04-30T00:00:00Z
status: human_needed
score: 5/5 must-haves verified (automated); 5 manual UAT items pending operator
overrides_applied: 0
human_verification:
  - test: "Rich Results Test on deployed home page (LD-03)"
    expected: "https://search.google.com/test/rich-results on https://full-selfbrowsing.com/ detects exactly one Organization + exactly one SoftwareApplication block; zero errors; zero warnings"
    why_human: "Requires Google account session and live deploy; Google's parser cannot be invoked headlessly"
  - test: "Search Console Test Live URL -- Home / (SMOKE-04)"
    expected: "Search Console returns 'URL is available to Google'; rendered HTML matches prerendered HTML; no noindex; no JS-only-content note"
    why_human: "Search Console requires Google account auth + deployed origin"
  - test: "Search Console Test Live URL -- /about (SMOKE-04)"
    expected: "URL available to Google; rendered HTML matches prerendered; route-specific title `FSB -- About` and canonical `https://full-selfbrowsing.com/about`"
    why_human: "Search Console requires Google account auth + deployed origin"
  - test: "Search Console Test Live URL -- /privacy (SMOKE-04)"
    expected: "URL available to Google; rendered HTML matches prerendered; route-specific title and canonical for /privacy"
    why_human: "Search Console requires Google account auth + deployed origin"
  - test: "Search Console Test Live URL -- /support (SMOKE-04)"
    expected: "URL available to Google; rendered HTML matches prerendered; route-specific title and canonical for /support"
    why_human: "Search Console requires Google account auth + deployed origin"
---

# Phase 216: Crawler Root Files, Express Wiring & Production Validation -- Verification Report

**Phase Goal:** Crawler-aware root files at the apex (/robots.txt, /sitemap.xml, /llms.txt, /llms-full.txt) with correct headers; Express server prefers per-route prerendered HTML over the SPA shell for marketing routes while preserving /dashboard SPA behavior; deployed site passes a live `curl -A GPTBot` smoke plus Google's Rich Results Test.
**Verified:** 2026-04-30
**Status:** human_needed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Apex crawler files served with correct content + headers (CRAWL-01..05, SRV-03) | VERIFIED | umbrella verify.sh runs verify-static.sh + verify-prebuild.sh + verify-server.sh; smoke-crawler.mjs PASS for /robots.txt, /sitemap.xml, /llms.txt, /llms-full.txt with text/plain (or application/xml) + Cache-Control: public, max-age=3600; bodies non-empty; llms-full.txt 9440 bytes < 256000 |
| 2 | Express prefers per-route prerendered HTML for /, /about, /privacy, /support over the SPA shell (SRV-01) | VERIFIED | verify-server.sh asserts route-specific titles + canonicals; smoke-crawler PASS lines for body title + canonical href on each route; server.js contains `marketingRoutes = new Set([...])` middleware with `path.join(staticPath, dir, 'index.html')` |
| 3 | /dashboard SPA shell preserved (exact-match whitelist; /dashboard/foo => 404) (SRV-02) | VERIFIED | verify-server.sh SRV-02-A/B/C: /dashboard returns root index, /dashboard/foo returns 404, unknown apex route returns 404 |
| 4 | T-216-01 mitigated: crawler files NOT shadowed by SPA fallback | VERIFIED | verify-server.sh step 15 asserts no `<html` or `<app-root` substrings in /robots.txt, /sitemap.xml, /llms.txt, /llms-full.txt bodies; express.static `redirect: false` prevents directory canonicalization 301 |
| 5 | sitemap.xml has 4 marketing routes (no /dashboard); every <loc> resolves 200 prerendered HTML; prebuild regenerates lastmod and llms-full.txt with zero new npm deps (CRAWL-02 + CRAWL-04 + CRAWL-05) | VERIFIED | smoke-crawler 4/4 sitemap loc PASS; verify-prebuild.sh asserts 4 `<loc>` entries, lastmod ISO 8601, deny-list grep on package.json (no marked/xml2js/etc.); package.json prebuild + smoke:crawler scripts present, no deps changed |
| 6 | Deployed site passes live `curl -A GPTBot` smoke + Google Rich Results Test (SMOKE-04 + LD-03) | HUMAN_PENDING | 216-HUMAN-UAT.md scaffold present with 5 entries (4 Search Console + 1 Rich Results); D-13 carve-outs requiring browser sessions and Google account auth |

**Score:** 5/5 automated truths verified. Truth 6 requires human verification (D-13 carve-out).

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `showcase/angular/public/robots.txt` | 15-bot allowlist + wildcard + Sitemap line | VERIFIED | 602 bytes; `User-agent: GPTBot` + 14 other named bots + `User-agent: *` + `Sitemap: https://full-selfbrowsing.com/sitemap.xml` |
| `showcase/angular/public/llms.txt` | Verbatim D-01 H1 + opening + Docs section | VERIFIED | 1007 bytes; serves with text/plain |
| `showcase/angular/scripts/llms-full.source.md` | 6-section D-04 structure | VERIFIED | 9357 bytes; Browser Use / Project Mariner / Operator sections |
| `showcase/angular/public/sitemap.xml` | 4 <loc> entries, build-date <lastmod>, no /dashboard | VERIFIED | 516 bytes; pretty-printed; `<urlset>` with 4 routes |
| `showcase/angular/public/llms-full.txt` | Generated-at header + source body, < 256000 bytes | VERIFIED | 9440 bytes; first line is `<!-- generated YYYY-MM-DD by build-crawler-files.mjs ... -->` |
| `showcase/angular/scripts/build-crawler-files.mjs` | ESM prebuild, zero new deps | VERIFIED | 3935 bytes; uses node:fs + node:path + node:url only |
| `showcase/angular/scripts/smoke-crawler.mjs` | GPTBot UA fetch + assertions, BASE_URL env | VERIFIED | 6085 bytes; node:fetch built-in; no new deps |
| `showcase/angular/src/app/core/seo/version.ts` | APP_VERSION generated from manifest.json | VERIFIED | Contains `export const APP_VERSION = '0.9.31';` matching manifest.json:4 |
| `showcase/angular/package.json` | prebuild + smoke:crawler scripts | VERIFIED | Both entries present; no dep changes |
| `server/server.js` | marketingRoutes middleware + .txt/.xml Cache-Control | VERIFIED | 6 occurrences of `marketingRoutes` / `Phase 216 SRV`; old `app.get(['/', '/about', '/dashboard', ...])` block removed |
| `216-HUMAN-UAT.md` | 5 entries (4 Search Console + 1 Rich Results) | VERIFIED | Frontmatter status: partial + Tests block + 5 detailed UAT-216-XX sections + Sign-off footer |
| 5 verify-*.sh scripts + umbrella verify.sh | All chained, all exit 0 | VERIFIED | umbrella `verify.sh` exits 0 with `[216 umbrella] ALL AVAILABLE ASSERTIONS PASSED` |

### Key Link Verification

| From | To | Via | Status |
|------|----|----|--------|
| robots.txt | sitemap.xml | `Sitemap:` directive | WIRED (smoke-crawler GET /robots.txt body contains directive) |
| build-crawler-files.mjs | manifest.json | fs.readFileSync + JSON.parse | WIRED (version.ts APP_VERSION='0.9.31' matches manifest.json .version) |
| build-crawler-files.mjs | llms-full.source.md | fs.readFileSync + write public/llms-full.txt | WIRED (build log shows `[build-crawler-files] llms-full.txt written (9440 bytes)`) |
| package.json | build-crawler-files.mjs | npm prebuild lifecycle hook | WIRED (`"prebuild": "node scripts/build-crawler-files.mjs"`) |
| server.js middleware | dist/showcase-angular/browser/<route>/index.html | path.join(staticPath, dir, 'index.html') + sendFile | WIRED (verify-server.sh SRV-01-A..D PASS for all 4 marketing routes with route-specific titles) |
| server.js setHeaders | Cache-Control: public, max-age=3600 for .txt/.xml | extended setHeaders branch | WIRED (verify-server.sh SRV-03-A..D PASS; SRV-03-E confirms .js retains no-cache) |
| smoke-crawler.mjs | BASE_URL env + sitemap <loc> | process.env.BASE_URL + regex extraction + fetch loop | WIRED (4/4 sitemap loc assertions PASS in local self-test) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Umbrella verify chains all 5 sub-verifiers | `bash .planning/phases/216-.../verify.sh` | exit 0; final line `[216 umbrella] ALL AVAILABLE ASSERTIONS PASSED` | PASS |
| smoke-crawler against local server | embedded in verify-smoke.sh | `passed=46 failed=0` | PASS |
| robots.txt headers + body | smoke-crawler GET | 200 + text/plain + body contains `User-agent: GPTBot` | PASS |
| sitemap loc round-trip | smoke-crawler checkSitemapLocs | 4/4 locs return 200 + body contains `<app-root` | PASS |
| /dashboard SPA shell still served | verify-server.sh SRV-02-A | 200 + `<app-root>` body | PASS |
| /dashboard/foo => 404 (D-10 exact-match) | verify-server.sh SRV-02-B | HTTP 404 | PASS |
| T-216-01 no SPA shadowing | verify-server.sh step 15 | bodies of all 4 crawler files free of `<html` / `<app-root` | PASS |
| Build run regenerates dist artifacts; /dashboard absent from dist | implicit in verify-prebuild.sh prelude | sitemap.xml + llms-full.txt present in dist; dist/.../dashboard/index.html absent | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| CRAWL-01 | 216-01 | robots.txt with 15-bot 2026 allowlist + wildcard + Sitemap | SATISFIED | verify-static.sh CRAWL-01-A/B/C pass; smoke-crawler asserts body |
| CRAWL-02 | 216-02 | Prebuild-generated sitemap.xml with 4 <loc> + ISO 8601 lastmod | SATISFIED | verify-prebuild.sh CRAWL-02-A..D pass; smoke-crawler 4 loc PASS |
| CRAWL-03 | 216-01 | llms.txt with verbatim D-01 + Docs section | SATISFIED | verify-static.sh CRAWL-03-A..C pass; smoke-crawler body contains `# FSB (Full Self-Browsing)` |
| CRAWL-04 | 216-01 + 216-02 | llms-full.txt < 256KB with generated-at header | SATISFIED | verify-prebuild.sh CRAWL-04-A..C pass; smoke-crawler body 9440 bytes |
| CRAWL-05 | 216-02 | Prebuild script with zero new npm deps | SATISFIED | verify-prebuild.sh CRAWL-05-A..D pass; deny-list grep on package.json |
| SRV-01 | 216-03 | Per-route prerendered HTML preferred over SPA shell | SATISFIED | verify-server.sh SRV-01-A..D pass; smoke-crawler title + canonical PASS |
| SRV-02 | 216-03 | /dashboard exact-match SPA whitelist preserved | SATISFIED | verify-server.sh SRV-02-A..C pass |
| SRV-03 | 216-03 | .txt/.xml Cache-Control: public, max-age=3600 | SATISFIED | verify-server.sh SRV-03-A..E pass; .js no-cache regression check pass |
| SMOKE-01 | 216-04 | GPTBot UA smoke against marketing routes | SATISFIED | smoke-crawler.mjs checkMarketingRoutes; verify-smoke.sh exit 0 |
| SMOKE-02 | 216-04 | Crawler files smoke (200 + Content-Type + size) | SATISFIED | smoke-crawler.mjs checkCrawlerFiles |
| SMOKE-03 | 216-04 | Every sitemap <loc> resolves to 200 prerendered HTML | SATISFIED | smoke-crawler.mjs checkSitemapLocs 4/4 PASS |
| SMOKE-04 | 216-05 | Search Console live-URL passes for /, /about, /privacy, /support | NEEDS HUMAN | 216-HUMAN-UAT.md UAT-216-01..04 scaffolded; D-13 carve-out |
| LD-03 | 216-02 + 216-05 | Rich Results Test passes with zero errors/warnings | NEEDS HUMAN | 216-HUMAN-UAT.md UAT-216-05 scaffolded; D-13 carve-out (manifest.json -> APP_VERSION pipeline source-side verified) |

No orphaned requirements. All 13 phase requirements either SATISFIED automatically or NEEDS HUMAN per D-13.

### Anti-Patterns Found

None blocking. The following deliberate decisions were noted (informational):

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| 216-HUMAN-UAT.md | 5 entries with `Status: [ ] not yet run` | INFO | Expected -- D-13 carve-outs awaiting operator post-deploy |
| smoke-crawler.mjs | No AbortController per-fetch timeout | INFO | Documented in 216-04-SUMMARY.md; CI orchestration timeouts catch hangs; deferred per Plan 04 threat register T-216-D2 |
| llms.txt | Action/guide counts ("50+ browser actions, 142+ site guides") | INFO | D-02 follow-up: counts are verbatim D-01 content; not validated against current source-of-truth constants in this phase |

### Human Verification Required

The 5 manual UAT items below are explicit D-13 carve-outs (CONTEXT.md): they require Google account authentication and a live production deploy, and cannot be scripted. They are scaffolded in `216-HUMAN-UAT.md` for the operator to execute post-deploy.

#### 1. Rich Results Test -- Home page JSON-LD (LD-03)

**Test:** Open https://search.google.com/test/rich-results, paste https://full-selfbrowsing.com/, run.
**Expected:** Detected items list shows exactly one `Organization` + exactly one `SoftwareApplication` block; zero errors; zero warnings; Organization carries name "FSB" / alternateName "Full Self-Browsing" / sameAs ["https://github.com/lakshmanturlapati/FSB"]; SoftwareApplication carries applicationCategory "BrowserApplication" / softwareVersion matching manifest.json .version.
**Why human:** Google's Rich Results parser cannot be invoked programmatically; requires browser session.

#### 2. Search Console "Test live URL" -- Home (/)

**Test:** Google Search Console -> Inspect URL -> Test Live URL on https://full-selfbrowsing.com/.
**Expected:** "URL is available to Google"; rendered HTML matches prerendered; no noindex; no "JavaScript-only content" notes; rendered DOM includes JSON-LD blocks.
**Why human:** Search Console requires Google account auth.

#### 3. Search Console "Test live URL" -- /about

**Test:** As above on https://full-selfbrowsing.com/about.
**Expected:** Available to Google; route-specific title `FSB -- About` and canonical `https://full-selfbrowsing.com/about`; no noindex.
**Why human:** Auth-gated.

#### 4. Search Console "Test live URL" -- /privacy

**Test:** As above on https://full-selfbrowsing.com/privacy.
**Expected:** Route-specific title and canonical for /privacy; no noindex.
**Why human:** Auth-gated.

#### 5. Search Console "Test live URL" -- /support

**Test:** As above on https://full-selfbrowsing.com/support.
**Expected:** Route-specific title and canonical for /support; no noindex.
**Why human:** Auth-gated.

### Gaps Summary

No automated gaps. The phase goal is met for everything that can be verified without a Google account + live deploy:

- All 4 crawler files at the apex with correct headers (CRAWL-01..05, SRV-03)
- Express server prefers per-route prerendered HTML (SRV-01)
- /dashboard SPA shell preserved exact-match (SRV-02)
- Local smoke (BASE_URL=http://localhost:3217) passes 46/46 assertions covering SMOKE-01..03
- T-216-01 (SPA shadow on crawler files) explicitly mitigated and verified
- Zero new npm dependencies (CRAWL-05)
- Phase 215 D-18 invariant preserved (no /dashboard prerender artifact)
- manifest.json -> APP_VERSION -> SoftwareApplication JSON-LD pipeline wired end-to-end at build time (D-14)

The remaining 5 items in 216-HUMAN-UAT.md are the LD-03 + SMOKE-04 manual gates Phase 216 explicitly carved out for the operator. These are not gaps; they are scheduled human verifications.

---

_Verified: 2026-04-30_
_Verifier: Claude (gsd-verifier)_
