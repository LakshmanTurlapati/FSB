# Phase 216: Crawler Root Files, Express Wiring & Production Validation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-30
**Phase:** 216-crawler-root-files-express-wiring-production-validation
**Areas discussed:** llms voice, llms-full.txt assembly source, Express patch + dashboard whitelist, smoke validation automation

---

## llms.txt + llms-full.txt content/voice

### Q1: llms.txt opening paragraph — which voice do you want AI crawlers to quote?

| Option | Description | Selected |
|--------|-------------|----------|
| Definition + capability (Recommended) | Mirrors home meta description plus capability counts (50+ actions, 142+ guides) and BYO API key positioning. | ✓ |
| Definition + differentiator | Leans into BYO/privacy posture vs hosted agents. | |
| Definition + comparison hint | Puts Project Mariner / Browser Use comparisons up front. | |

**User's choice:** Definition + capability (Recommended)
**Notes:** Voice locked verbatim in D-01. Capability counts may be templated by prebuild script if drift is observed (D-02).

### Q2: llms-full.txt comparison framing tone vs Browser Use / Project Mariner / Operator

| Option | Description | Selected |
|--------|-------------|----------|
| Neutral, capability-matrix tone (Recommended) | Factual short paragraphs of overlap/diff per competitor; no "better than" claims. | ✓ |
| Positioned, FSB-as-alternative tone | Frames FSB as the open-source extension-based alternative for each competitor. | |
| Honest acknowledgment tone | Acknowledges FSB's hobby-scale; lead with what FSB does well, where competitors lead. | |

**User's choice:** Neutral, capability-matrix tone (Recommended)
**Notes:** Lower drift risk if competitor pricing/features change. Recorded as D-03.

---

## llms-full.txt assembly source

### Q3: Where does the prebuild script source content from to assemble llms-full.txt?

| Option | Description | Selected |
|--------|-------------|----------|
| Hand-curated source file (Recommended) | Author `scripts/llms-full.source.md` once; prebuild copies to public/llms-full.txt with generated-at header. Editorial control, decoupled from PROJECT.md churn. | ✓ |
| Auto-assemble from existing markdown | Concatenate PROJECT.md + CLAUDE.md sections + page meta descriptions; stays in sync but harder to author tone consistently. | |
| Hybrid: hand-curated + injected version + capability counts | Hand-curated source + prebuild script substitutes `{{VERSION}}`/`{{ACTION_COUNT}}`/`{{GUIDE_COUNT}}` from constants modules. | |

**User's choice:** Hand-curated source file (Recommended)
**Notes:** Recorded as D-05/D-06. Token substitution explicitly deferred unless count drift becomes material.

---

## Express patch approach + /dashboard whitelist

### Q4: How should the Express patch serve per-route prerendered HTML?

| Option | Description | Selected |
|--------|-------------|----------|
| Custom middleware: try `req.path/index.html`, fallback to /dashboard SPA shell (Recommended) | Explicit route-aware lookup; readable; no surprises. | ✓ |
| express.static({ extensions: ['html'] }) + minimal /dashboard handler | Idiomatic Express; subtle interactions with route ordering. | |
| Both: extensions: ['html'] + custom middleware as belt-and-suspenders | More robust; adds complexity for a 4-route problem. | |

**User's choice:** Custom middleware: try `req.path/index.html`, fallback to /dashboard SPA shell (Recommended)
**Notes:** Recorded as D-09. Existing express.static(...) at server.js:97-108 stays untouched.

### Q5: What's the /dashboard SPA-fallback whitelist pattern?

| Option | Description | Selected |
|--------|-------------|----------|
| Exact match `/dashboard` only (Recommended) | Minimal surface area; future subroutes added explicitly. | ✓ |
| Prefix match `/dashboard*` for forward-compat | Easier when nesting later; bigger blast radius. | |

**User's choice:** Exact match `/dashboard` only (Recommended)
**Notes:** Recorded as D-10.

---

## Smoke validation automation

### Q6: How should SMOKE-01..03 run after deploy?

| Option | Description | Selected |
|--------|-------------|----------|
| npm run smoke:crawler script (Recommended) | Node script; curl + assert; re-runnable; zero new npm deps. SMOKE-04 stays manual. | ✓ |
| Hand-runnable bash script + UAT checklist | Faster to author; easier to forget on subsequent deploys. | |
| Inline in verify.sh umbrella + manual UAT | Reuses existing verify infra; supports local + remote BASE_URL. | |

**User's choice:** npm run smoke:crawler script (Recommended)
**Notes:** Recorded as D-12 (script details) and D-13 (SMOKE-04 manual UAT carve-out).

---

## Claude's Discretion

- smoke-crawler.mjs report format (table/JSON/plain) — planner picks; exit-code semantics are the constraint
- Prebuild script structure — single file vs split — planner picks
- Express middleware vs router-based handler shape — either acceptable
- Sitemap XML formatting (pretty-print vs single-line) — pretty-print preferred

## Deferred Ideas

(All previously deferred at the milestone level — restated for traceability.)

- Per-route OG images (CRAWL-FUTURE-01)
- FAQ page + FAQPage JSON-LD (DISCO-FUTURE-01)
- Comparison pages (DISCO-FUTURE-02) — llms-full.txt comparison framing is the v0.9.46 surrogate
- BreadcrumbList JSON-LD (DISCO-FUTURE-03)
- Off-page push (DISCO-FUTURE-04)
- Search Console + Bing Webmaster registration (DISCO-FUTURE-05) — manual SMOKE-04 is the surrogate
- provideClientHydration() future-proofing (PRE-FUTURE-01)
- Token substitution / hybrid llms-full.txt assembly
- Per-file mtime sitemap lastmod
