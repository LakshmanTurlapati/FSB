# Roadmap: FSB (Full Self-Browsing)

## Status

No active milestone. v0.9.50 shipped 2026-05-03; next milestone TBD via `/gsd-new-milestone`.

## Milestones

- ✅ **v0.9.50 Autopilot Refinement (MCP-Parity)** -- shipped 2026-05-03 (Phases 224-230 + opportunistic 231-233; archive: [v0.9.50-ROADMAP.md](milestones/v0.9.50-ROADMAP.md))
- ✅ **v0.9.49 Remote Control Rebrand & Showcase Metrics Wire-up** -- shipped 2026-05-02 (Phase 223 + Sync consolidation; archive: [v0.9.49-ROADMAP.md](milestones/v0.9.49-ROADMAP.md))
- ✅ **v0.9.48 Angular 20 Migration** -- shipped 2026-05-02 (deadline 2026-05-19 met 17 days early)
- ✅ **v0.9.47 Workspace Reorganization** -- shipped 2026-05-02
- ✅ **v0.9.46 Site Discoverability (SEO + GEO)** -- shipped 2026-05-02
- ✅ **v0.9.45rc1 Sync Surface, Agent Sunset & Stream Reliability** -- shipped 2026-04-29
- ✅ **v0.9.40 Session Lifecycle Reliability** -- shipped 2026-04-25
- ✅ **v0.9.36 MCP Visual Lifecycle & Client Identity** -- shipped 2026-04-24
- ✅ **v0.9.35 MCP Plug-and-Play Reliability** -- shipped 2026-04-24
- ✅ **v0.9.34 Vault, Payments & Secure MCP Access** -- shipped 2026-04-22

## Backlog

### v0.9.46 deferred (carried into next milestone or backlog)

- **CRAWL-FUTURE-01**: Per-route OG images (4 unique 1200x630 PNGs)
- **DISCO-FUTURE-01**: FAQ page (`/faq`) with `FAQPage` JSON-LD (15-25 definition-first Q&A pairs)
- **DISCO-FUTURE-02**: Comparison pages (`/vs-browser-use`, `/vs-project-mariner`, `/vs-stagehand`, `/vs-browseros`)
- **DISCO-FUTURE-03**: `BreadcrumbList` JSON-LD on every route (deferred until route depth > 1)
- **DISCO-FUTURE-04**: Off-page push (Show HN, Reddit launches, awesome-list PRs, demo video)
- **DISCO-FUTURE-05**: Search Console + Bing Webmaster Tools registration + weekly monitoring
- **PRE-FUTURE-01**: `provideClientHydration()` future-proofing for hybrid SSR migration

### v0.9.50 deferred (from REQUIREMENTS Future Requirements)

- Autonomous test-harness re-introduction (operator-driven this milestone)
- MCP visual-session auto-wrap for autopilot flows (carry-over from v0.9.36 deferred set)
- Loop / completion-detection refinement (secondary failure modes — defer unless surfaced by AUDIT-02)

### v0.9.50 gap-closure phases (planned but not executed; carry to next milestone)

These were created by `/gsd-plan-milestone-gaps` against the v0.9.50 audit but not run before milestone completion. Planning artifacts in `.planning/phases/234-*`, `235-*`, `236-*`.

- **Phase 234**: REQUIREMENTS.md backfill + traceability sweep (largely auto-completed by archive-time updates; thin formalization remaining)
- **Phase 235**: Retroactive GSD coverage for Phases 231/232/233 (PLAN/SUMMARY/VERIFICATION docs; split stray `mcp/ai/tool-definitions.cjs` drift; commit 232+233)
- **Phase 236**: MCP `run_task` return-on-completion publish (`fsb-mcp-server@0.7.5` ship + lifecycle bus subscriber)

### v0.9.50 follow-up (from rerun verification, deferred from Phase 227-VERIFICATION)

- **Stuck-detection diagnostic-tool filtering**: PROMPT-10 rerun showed autopilot evades the strict 5-consecutive-fingerprint detector by interleaving `get_dom_snapshot` / `report_progress` between primary actions — partially addressed by Phase 233 meta-cognitive tracker.
- **Fingerprint-family matching**: detect `[click→snapshot→click→snapshot]` as a single repeating family, not 4 distinct fingerprints.
- **No-shortcut-escapes fallback policy**: PROMPT-08 rerun showed model picks the right tool first (drag_drop) but falls back to `execute_js` when CDP returns no observable change. Tighten to "report failure, do not escape".
- **Action-matches-request self-check enhancement**: must look at actual action history, not prompt-time intent. PROMPT-08 rerun showed false success despite admitting JS escape in completionMessage.
- **MCP `run_task` 300s timeout end-to-end verification**: extension-side fix landed in Plan 225-01; needs `fsb-mcp-server` republish (0.7.4 → 0.7.5) OR Claude Code MCP host repoint to local `mcp/build/` to verify end-to-end. Tracked as Phase 236.

### Carry-over from prior milestones

- Deferred Angular migration requirements (DASH-08 through MIGR-03) remain parked from v0.9.29
- Live UAT for v0.9.34 vault behavior and MCP payment approve/deny/delayed approval remains accepted validation debt
- Phase 999.1 backlog (`mcp-tool-gaps-click-heuristics`) parked
- Phase 209 has 7 human_needed UAT items (live CDP click/keyboard/scroll delivery)

## Progress

<details>
<summary>✅ v0.9.50 Autopilot Refinement (MCP-Parity) (Phases 224-230 + opportunistic 231-233) — SHIPPED 2026-05-03</summary>

Archive: [milestones/v0.9.50-ROADMAP.md](milestones/v0.9.50-ROADMAP.md) · [milestones/v0.9.50-REQUIREMENTS.md](milestones/v0.9.50-REQUIREMENTS.md) · [v0.9.50-MILESTONE-AUDIT.md](v0.9.50-MILESTONE-AUDIT.md)

54 commits, 91 files changed (+7607/−362). Audit status: tech_debt accepted (3 gap-closure phases 234-236 carried into next milestone).

</details>

<details>
<summary>✅ v0.9.49 Remote Control Rebrand & Showcase Metrics Wire-up (Phase 223) — SHIPPED 2026-05-02</summary>

- [x] Phase 223: Remote Control rename + showcase metrics wire-up (4/4 plans, 16/16 reqs) — full details in [milestones/v0.9.49-ROADMAP.md](milestones/v0.9.49-ROADMAP.md)
- Post-ship refinement: Sync consolidation (PR #19) — Remote Control tab folded into Sync (Beta); deprecation card relocated.

</details>

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
*Roadmap last updated: 2026-05-03 (v0.9.50 archived; next milestone TBD via `/gsd-new-milestone`)*
