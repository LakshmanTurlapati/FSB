# Roadmap: FSB (Full Self-Browsing)

## Status

Active milestone: **v0.9.49 Remote Control Rebrand & Showcase Metrics Wire-up** (started 2026-05-02). Phase 223 ready to plan.

## Milestones

- 🔄 **v0.9.49 Remote Control Rebrand & Showcase Metrics Wire-up** -- in progress (started 2026-05-02)
- ✅ **v0.9.48 Angular 20 Migration** -- shipped 2026-05-02 (deadline 2026-05-19 met 17 days early)
- ✅ **v0.9.47 Workspace Reorganization** -- shipped 2026-05-02
- ✅ **v0.9.46 Site Discoverability (SEO + GEO)** -- shipped 2026-05-02
- ✅ **v0.9.45rc1 Sync Surface, Agent Sunset & Stream Reliability** -- shipped 2026-04-29
- ✅ **v0.9.40 Session Lifecycle Reliability** -- shipped 2026-04-25
- ✅ **v0.9.36 MCP Visual Lifecycle & Client Identity** -- shipped 2026-04-24
- ✅ **v0.9.35 MCP Plug-and-Play Reliability** -- shipped 2026-04-24
- ✅ **v0.9.34 Vault, Payments & Secure MCP Access** -- shipped 2026-04-22

## Phases

### Phase 223: Remote Control rename + showcase metrics wire-up

**Goal:** "Remote Control (Beta)" replaces "Agents" across the extension control panel and showcase mirror, AND on connect the extension pushes live control-panel metrics (connection state, session counters, cost/tokens, active tab) to the showcase `/dashboard` so it renders real data.

**Depends on:** Nothing (keystone for v0.9.49).

**Requirements mapped:** RBR-01..05, MET-01..08, QA-01..03 (16)

**Success criteria:**
1. User loads the extension and sees "Remote Control" with a Beta badge as the dashboard tab; no "Agents" copy anywhere on the surface or in the showcase mirror.
2. User pairs the extension with the showcase site; on connect, the showcase `/dashboard` immediately renders connection state, session counters, cost/token totals, and the active controlled tab + URL — all sourced from the extension, no static placeholders left.
3. User disconnects; the showcase dashboard transitions back to "no data yet" within one render cycle.
4. `tests/sync-tab-runtime.test.js` and the existing PR-gating CI matrix (`extension`, `mcp-smoke`, `showcase`, `all-green`) stay green; Phase 209 `remoteControlStateChanged` broadcast contract preserved.

**Plans:** Decomposed at `/gsd-plan-phase 223` (likely two plans — UI rename, then metrics wire-up — but planner decides).



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
