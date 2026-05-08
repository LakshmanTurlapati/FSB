---
quick_id: 260508-gu8
title: Add Agents nav + page to showcase
date: 2026-05-08
status: complete
---

# Quick Task 260508-gu8 Summary

## What was built

A new `/agents` route on the showcase site introducing the FSB OpenClaw skill, the FSB MCP power story, install instructions, try-it prompts, and CTAs. "Agents" nav link added between Dashboard and Privacy in the desktop nav (with OpenClaw logo), mobile menu, and footer Pages column. Prerender + SEO files updated.

## Files

**New:**
- `showcase/angular/src/app/pages/agents/agents-page.component.ts` (88 lines) -- standalone Angular component, SEO meta + OG tags + canonical + JSON-LD `SoftwareApplication` injection following the about-page pattern.
- `showcase/angular/src/app/pages/agents/agents-page.component.html` (~150 lines) -- 6 sections: Hero (OpenClaw badge + headline + CTA), Meet the FSB Skill (3-card feature grid), Why FSB MCP is powerful (4-card stat grid: 50+ tools, multi-agent identity, vault boundary, real Chrome session), Install in 3 Steps (numbered list with copy-paste code blocks), Try It (manual + autopilot with strict NEVER-unless-explicit rule), CTA band.
- `showcase/angular/src/app/pages/agents/agents-page.component.scss` (~280 lines) -- matches showcase visual language (`.section`, `.container`, `.reveal` patterns; CSS variables for theming; orange accent for Phase highlights; responsive breakpoints).

**Modified:**
- `showcase/angular/src/app/app.routes.ts` -- added `/agents` lazy route between Dashboard and Privacy.
- `showcase/angular/src/app/app.routes.server.ts` -- added `/agents` Prerender entry.
- `showcase/angular/src/app/layout/showcase-shell/showcase-shell.component.html` -- added "Agents" link in 3 places (desktop nav with `<img src="assets/providers/openclaw.svg">`, mobile menu with the same icon, footer Pages column without icon).
- `showcase/angular/src/app/layout/showcase-shell/showcase-shell.component.scss` -- added `.nav-with-icon` + `.nav-icon` styles (18x18 svg, 6px gap).
- `showcase/angular/scripts/build-crawler-files.mjs` -- added `/agents` to the ROUTES array.
- `showcase/angular/scripts/llms-full.source.md` -- added agents page mention in OpenClaw skill section + Links list.
- `showcase/angular/public/llms.txt` -- added agents page entry to Docs list.

**Regenerated (auto via `node showcase/angular/scripts/build-crawler-files.mjs`):**
- `showcase/angular/public/sitemap.xml` -- now includes `https://full-selfbrowsing.com/agents`.
- `showcase/angular/public/llms-full.txt` -- now mentions `/agents` route (2 references).

## Verification

- Build green: `npm --prefix showcase/angular run build` -> 5 static routes prerendered (Home, About, Agents, Privacy, Support); agents-page-component chunk weighs 20.16 kB.
- ASCII-only across all 3 new agents files (perl scan returns 0 non-ASCII bytes).
- Phase 251 skill-fsb-spec test still passes (48/48) -- skill artifacts untouched.
- Sitemap + llms.txt + llms-full.txt all reference `/agents`.

## Logo source

`/assets/providers/openclaw.svg` (already present at `showcase/assets/providers/openclaw.svg`; Angular asset config maps `../assets` -> `/assets/` at build time).

## Self-Check: PASSED

- `/agents` route registered + prerendered.
- Component scaffolded with all 6 sections.
- Nav link present in 3 locations (count verified: 3x `routerLink="/agents"`).
- OpenClaw logo on desktop nav + mobile menu.
- SEO files include `/agents`.
- Build passes.
- No emojis. ASCII only.
- No skill regressions.

## Commit

(Filled in by orchestrator after final commit.)
