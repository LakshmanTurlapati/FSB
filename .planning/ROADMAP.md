# Roadmap: FSB (Full Self-Browsing)

## Status

Between milestones. v0.9.48 (Angular 20 Migration) shipped 2026-05-02 — three milestones shipped today (v0.9.46 SEO/GEO, v0.9.47 Workspace Reorg, v0.9.48 Angular 20). Next milestone TBD.

## Milestones

- ✅ **v0.9.48 Angular 20 Migration** -- shipped 2026-05-02 (deadline 2026-05-19 met 17 days early)
- ✅ **v0.9.47 Workspace Reorganization** -- shipped 2026-05-02
- ✅ **v0.9.46 Site Discoverability (SEO + GEO)** -- shipped 2026-05-02
- ✅ **v0.9.45rc1 Sync Surface, Agent Sunset & Stream Reliability** -- shipped 2026-04-29
- ✅ **v0.9.40 Session Lifecycle Reliability** -- shipped 2026-04-25
- ✅ **v0.9.36 MCP Visual Lifecycle & Client Identity** -- shipped 2026-04-24
- ✅ **v0.9.35 MCP Plug-and-Play Reliability** -- shipped 2026-04-24
- ✅ **v0.9.34 Vault, Payments & Secure MCP Access** -- shipped 2026-04-22

## Phases

_None active — define the next milestone with `/gsd-new-milestone`. Candidates: GEO content pack (FAQ + comparison pages), zoneless change detection migration, off-page launch + monitoring._

## Backlog

### v0.9.46 deferred (carried into next milestone or backlog)

- **CRAWL-FUTURE-01**: Per-route OG images (4 unique 1200x630 PNGs)
- **DISCO-FUTURE-01**: FAQ page (`/faq`) with `FAQPage` JSON-LD (15-25 definition-first Q&A pairs)
- **DISCO-FUTURE-02**: Comparison pages (`/vs-browser-use`, `/vs-project-mariner`, `/vs-stagehand`, `/vs-browseros`)
- **DISCO-FUTURE-03**: `BreadcrumbList` JSON-LD on every route (deferred until route depth > 1)
- **DISCO-FUTURE-04**: Off-page push (Show HN, Reddit launches, awesome-list PRs, demo video)
- **DISCO-FUTURE-05**: Search Console + Bing Webmaster Tools registration + weekly monitoring
- **PRE-FUTURE-01**: `provideClientHydration()` future-proofing for hybrid SSR migration

### Carry-over from prior milestones

- Deferred Angular migration requirements (DASH-08 through MIGR-03) remain parked from v0.9.29
- Live UAT for v0.9.34 vault behavior and MCP payment approve/deny/delayed approval remains accepted validation debt
- Phase 999.1 backlog (`mcp-tool-gaps-click-heuristics`) parked
- Phase 209 has 7 human_needed UAT items (live CDP click/keyboard/scroll delivery)

<details>
<summary>✅ v0.9.48 Angular 20 Migration (Phases 221-222) -- SHIPPED 2026-05-02</summary>

Archive:
- [.planning/milestones/v0.9.48-ROADMAP.md](./milestones/v0.9.48-ROADMAP.md)
- [.planning/milestones/v0.9.48-REQUIREMENTS.md](./milestones/v0.9.48-REQUIREMENTS.md)

</details>

<details>
<summary>✅ v0.9.47 Workspace Reorganization (Phases 217-220) -- SHIPPED 2026-05-02</summary>

Archive:
- [.planning/milestones/v0.9.47-ROADMAP.md](./milestones/v0.9.47-ROADMAP.md)
- [.planning/milestones/v0.9.47-REQUIREMENTS.md](./milestones/v0.9.47-REQUIREMENTS.md)

</details>

<details>
<summary>✅ v0.9.46 Site Discoverability (SEO + GEO) (Phases 215-216) -- SHIPPED 2026-05-02</summary>

Archive:
- [.planning/milestones/v0.9.46-ROADMAP.md](./milestones/v0.9.46-ROADMAP.md)
- [.planning/milestones/v0.9.46-REQUIREMENTS.md](./milestones/v0.9.46-REQUIREMENTS.md)
- [.planning/v0.9.46-MILESTONE-AUDIT.md](./v0.9.46-MILESTONE-AUDIT.md)

</details>

<details>
<summary>✅ v0.9.45rc1 Sync Surface, Agent Sunset & Stream Reliability (Phases 209-214) -- SHIPPED 2026-04-29</summary>

Archive:
- [.planning/milestones/v0.9.45rc1-ROADMAP.md](./milestones/v0.9.45rc1-ROADMAP.md)
- [.planning/milestones/v0.9.45rc1-REQUIREMENTS.md](./milestones/v0.9.45rc1-REQUIREMENTS.md)

</details>

Older milestone phase details live in the archived roadmap snapshots under `.planning/milestones/`.

---
*Roadmap created for v0.9.46: 2026-04-30*
*First phase: 215 (continues numbering from v0.9.45rc1's Phase 214)*
