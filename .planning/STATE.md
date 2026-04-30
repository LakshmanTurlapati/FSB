---
gsd_state_version: 1.0
milestone: v0.9.46
milestone_name: deferred
status: executing
last_updated: "2026-04-30T20:55:53.172Z"
last_activity: 2026-04-30
progress:
  total_phases: 2
  completed_phases: 1
  total_plans: 8
  completed_plans: 4
  percent: 50
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-30)

**Core value:** Reliable single-attempt execution -- the AI decides correctly, the mechanics execute precisely
**Current focus:** Phase 216 — Crawler Root Files, Express Wiring & Production Validation

## Current Position

Phase: 216 (Crawler Root Files, Express Wiring & Production Validation) — EXECUTING
Plan: 2 of 5
Status: Ready to execute
Last activity: 2026-04-30

## Performance Metrics

- Phases shipped this milestone: 0/2
- Plans shipped this milestone: 0/0 (plans decomposed at phase-plan time)
- Active requirements: 24 (all mapped, 0 orphans)

## Accumulated Context

### Decisions

Full decision log in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [v0.9.46]: Two-phase shape -- Phase 215 bundles prerender + per-route metadata + JSON-LD because LD-01 lives in `index.html` and LD-02 lives in the home component, both touched in the same surgery as the prerender enablement and `Title`/`Meta` injection. Minimum-thrash atomic commits over minimum phase count.
- [v0.9.46]: Phase 216 bundles crawler files + Express wiring + production validation because they share the same verification flow (`curl -I` headers, content-type, end-to-end sitemap entry resolution); the `llms-full.txt` generator depends on prerendered HTML existing on disk; the Express patch is meaningful only when per-route HTML exists.
- [v0.9.46]: LD-03 (Rich Results Test validation) belongs to Phase 216 alongside SMOKE because both are operational verification gates run against the deployed site, not code-level changes.
- [v0.9.46]: Static prerender via Angular 19 `@angular/build:application` (`outputMode: "static"`, `prerender.discoverRoutes: false`, `prerender.routesFile: "prerender-routes.txt"`). No SSR/Universal -- overkill for a marketing showcase. `/dashboard` stays SPA.
- [v0.9.46]: AI crawlers (GPTBot, ClaudeBot, PerplexityBot) do NOT execute JavaScript -- prerender is the load-bearing fix.
- [v0.9.46]: Root crawler files dropped via `showcase/angular/public/` (already globbed to dist root by `angular.json`).
- [v0.9.46]: Express SPA fallback at `server/server.js:110-117` will try per-route prerendered HTML before the index.html catch-all; `/dashboard` is the only whitelisted SPA-only route in the patched fallback.
- [v0.9.45rc1]: Phase ordering was 211 -> 212 -> 213 by isolation -> dependency direction (archived).
- [v0.9.45rc1]: Comment, do not delete. Agent code preserved with deprecation annotation (archived).
- [Phase 216]: robots.txt is hand-authored per D-08; llms.txt opens with verbatim D-01 paragraph (no paraphrase); llms-full.source.md uses six D-04 sections with neutral comparison tone; ASCII-only across all three

### Pending Todos

- Plan Phase 215 via `/gsd-plan-phase 215` (decomposes into wave-1 parallel plans where file-disjoint).
- Likely Phase 215 plan boundaries (orchestrator decides at plan time):
  - Plan A: `angular.json` + `prerender-routes.txt` + `localStorage` guard (PRE-01..05)
  - Plan B: per-route `Title`/`Meta`/canonical/OG/Twitter in 4 page components + `noindex` on `/dashboard` (META-01..04)
  - Plan C: JSON-LD `Organization` in `index.html` + `SoftwareApplication` in home component with `</` escaping (LD-01, LD-02)
- After Phase 215 ships: plan Phase 216.
- Likely Phase 216 plan boundaries:
  - Plan A: `scripts/build-crawler-files.mjs` + `prebuild` wiring + `public/robots.txt`/`sitemap.xml`/`llms.txt`/`llms-full.txt` (CRAWL-01..05)
  - Plan B: `server/server.js` SPA-fallback patch + `Content-Type`/`Cache-Control` headers (SRV-01..03)
  - Plan C: production smoke pass + Rich Results Test evidence capture (LD-03, SMOKE-01..04)

### Blockers/Concerns

- Angular 19 EOL is 2026-05-19. v0.9.46 is small enough to ship under Angular 19; future Angular 20 upgrade tracked separately.
- `/dashboard` route inlines runtime state -- must be excluded from the prerender route list (`discoverRoutes: false` + explicit `routesFile`) to avoid baking transient state into static HTML. Build-time assertion that `dist/.../browser/dashboard/index.html` does NOT exist.
- `localStorage` access in `showcase/angular/src/index.html` (lines 8-15) will crash prerender unless wrapped in `typeof localStorage !== 'undefined'` guard. Must land in Phase 215 before any prerender attempt.
- Express SPA fallback rewrite must preserve the existing `/dashboard` SPA behavior while serving `/about/index.html`, `/privacy/index.html`, `/support/index.html` directly. Whitelist `/dashboard` only.
- JSON-LD must escape `</` -> `\u003c/` to defeat script-tag injection (Pitfall 4 in research/PITFALLS.md).
- Single-region Fly.io (`sjc`) + `auto_stop_machines = 'stop'` -- non-US AI crawlers may hit cold-start latency. Mitigation `min_machines_running = 1` already set; revisit only if crawl budget becomes a concern post-launch.

## Session Continuity

Last session ended with: Research synthesized, requirements scoped (24 v1 items), roadmap created with 2 phases (Phase 215 + Phase 216).

Next session should: `/gsd-plan-phase 215` to decompose Phase 215 into wave-1 parallel plans (likely 3 plans -- prerender enablement, per-route metadata, JSON-LD).
