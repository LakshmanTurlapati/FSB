---
gsd_state_version: 1.0
milestone: v0.9.46
milestone_name: Site Discoverability (SEO + GEO)
status: defining-requirements
last_updated: "2026-04-30T00:00:00.000Z"
last_activity: 2026-04-30
progress:
  total_phases: 0
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-30)

**Core value:** Reliable single-attempt execution -- the AI decides correctly, the mechanics execute precisely
**Current focus:** Milestone v0.9.46 -- defining requirements (SEO + GEO discoverability)

## Current Position

Phase: Not started (defining requirements)
Plan: --
Status: Defining requirements
Last activity: 2026-04-30 -- Milestone v0.9.46 started

## Performance Metrics

- Phases shipped this milestone: 0/0 (roadmap pending)
- Plans shipped this milestone: 0/0
- Active requirements: TBD (defined in REQUIREMENTS.md after research)

## Accumulated Context

### Decisions

Full decision log in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [v0.9.46]: Static prerender via Angular 19 `@angular/build:application` (`prerender: true`). No SSR/Universal -- overkill for a marketing showcase. Marketing routes prerender; `/dashboard` stays SPA (interactive runtime state).
- [v0.9.46]: AI crawlers (GPTBot, ClaudeBot, PerplexityBot) do NOT execute JavaScript -- prerender is the load-bearing fix. Verified live: `curl -A GPTBot full-selfbrowsing.com` returns only the literal "FSB".
- [v0.9.46]: Root crawler files dropped via `showcase/angular/public/` (already globbed to dist root by `angular.json`).
- [v0.9.46]: Express SPA fallback at `server/server.js:110-117` will try per-route prerendered HTML before the index.html catch-all.
- [v0.9.45rc1]: Phase ordering is 211 (stream/log) -> 212 (agents sunset) -> 213 (Sync tab) by isolation -> dependency direction.
- [v0.9.45rc1]: Comment, do not delete. Agent code preserved with `// DEPRECATED v0.9.45rc1: superseded by OpenClaw / Claude Routines -- see PROJECT.md.` annotation.
- [v0.9.40]: All agent loop exit paths now finalize properly with structured termination reasons
- [v0.9.36]: MCP visual sessions use explicit start/end tools with trusted client labels
- [v0.9.35]: MCP reliability first -- bridge lifecycle, diagnostics, installer parity before new features

### Pending Todos

- Run 4 parallel researchers (Stack, Features, Architecture, Pitfalls) for v0.9.46.
- Synthesize research into SUMMARY.md.
- Define REQUIREMENTS.md by category (Prerender, Metadata, JSON-LD, Crawler files, Server fallback).
- Spawn roadmapper starting from Phase 215.

### Blockers/Concerns

- Angular 19 EOL is 2026-05-19. v0.9.46 is small enough to ship under Angular 19; future Angular 20 upgrade tracked separately.
- `/dashboard` route inlines runtime state -- must be excluded from the prerender route list to avoid baking transient state into static HTML.
- Express SPA fallback rewrite must preserve the existing `/dashboard` SPA behavior while serving `/about/index.html`, `/privacy/index.html`, `/support/index.html` directly.

## Session Continuity

Last session ended with: Milestone v0.9.46 (Site Discoverability) summary confirmed. Research first selected.

Next session should: 4 parallel gsd-project-researcher agents (Stack, Features, Architecture, Pitfalls), then synthesizer, then requirements scoping, then roadmap from Phase 215.
