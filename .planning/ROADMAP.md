# Roadmap: FSB (Full Self-Browsing)

## Status

Active milestone: **v0.9.48 Angular 20 Migration**.

Migrate `showcase/angular/` from Angular 19 to Angular 20 before the 2026-05-19 EOL. All v0.9.46 SEO/GEO surfaces must continue to work post-migration. Mechanical upgrade + production verification — no new features.

## Milestones

- 🟡 **v0.9.48 Angular 20 Migration** -- in progress (started 2026-05-02; deadline 2026-05-19)
- ✅ **v0.9.47 Workspace Reorganization** -- shipped 2026-05-02
- ✅ **v0.9.46 Site Discoverability (SEO + GEO)** -- shipped 2026-05-02
- ✅ **v0.9.45rc1 Sync Surface, Agent Sunset & Stream Reliability** -- shipped 2026-04-29
- ✅ **v0.9.40 Session Lifecycle Reliability** -- shipped 2026-04-25
- ✅ **v0.9.36 MCP Visual Lifecycle & Client Identity** -- shipped 2026-04-24
- ✅ **v0.9.35 MCP Plug-and-Play Reliability** -- shipped 2026-04-24
- ✅ **v0.9.34 Vault, Payments & Secure MCP Access** -- shipped 2026-04-22

## Phases

- [ ] **Phase 221: Angular 19 → 20 mechanical upgrade** — `ng update @angular/cli @angular/core` (and supporting packages); fix any breaking-change call sites the schematic doesn't auto-migrate (likely candidates: `provideServerRouting` API surface, prerender config keys, TypeScript version bump); verify local `npm --prefix showcase/angular run build` emits per-route HTML byte-equivalent to v19 output (modulo timestamps); verify Organization + SoftwareApplication JSON-LD, route-specific titles + canonicals, OG/Twitter, dashboard runtime noindex all still emit; CI green.
- [ ] **Phase 222: Production verification** — Deploy to fly.io; re-run `smoke-crawler.mjs` against production (46 assertions); manual Rich Results Test on home page (LD-03); spot-check visual smoke of all 4 marketing routes + dashboard SPA; sign off VAL-01..03.

## Phase Details

### Phase 221: Angular 19 → 20 mechanical upgrade
**Goal**: `showcase/angular/` is on Angular 20.x with all v0.9.46 SEO/GEO surfaces preserved; local build emits the same per-route prerender output as v19; CI green; no production deploy yet.
**Depends on**: Nothing (keystone).
**Requirements**: UPG-01..05, BLD-01..05, SSR-01..02, LD-01..02, META-01..04, CI-01..03
**Success Criteria** (what must be TRUE):
  1. `npm --prefix showcase/angular install` succeeds with `@angular/*` at `^20.x` and no peer-dep warnings that fail CI.
  2. `npm --prefix showcase/angular run build` exits 0 and emits `dist/showcase-angular/browser/{,about,privacy,support}/index.html`. `dist/showcase-angular/browser/dashboard/index.html` does NOT exist.
  3. Each prerendered HTML file contains route-specific `<title>`, `<meta name="description">`, `<link rel="canonical">`, OG + Twitter tags. Diff against v19 prerender output should be near-zero (modulo Angular runtime version strings).
  4. Home page prerendered HTML still contains exactly one `Organization` JSON-LD block and exactly one `SoftwareApplication` JSON-LD block.
  5. Local SSR boot: `node showcase/dist/showcase-angular/server/server.mjs` starts without error and serves the marketing routes; `/dashboard` runtime noindex meta is set.
  6. CI passes: `extension`, `mcp`, `showcase`, `all-green` all green on the migration PR.
**Plans**: TBD (planner decomposition)

### Phase 222: Production verification
**Goal**: Production deploy is healthy post-migration; all v0.9.46 SEO/GEO automated assertions pass; manual UAT items signed off.
**Depends on**: Phase 221.
**Requirements**: SSR-03, LD-03, VAL-01..03
**Success Criteria**:
  1. Deploy completes successfully via `flyctl deploy` (deploy.yml on push to main).
  2. `BASE_URL=https://full-selfbrowsing.com npm --prefix showcase/angular run smoke:crawler` exits 0 (46/46 assertions pass) — same contract as v0.9.46 SMOKE-01..03.
  3. Google Rich Results Test on home page detects 1 valid SoftwareApplication, 0 errors (LD-03 — manual UAT).
  4. Visual smoke (operator-driven, 5-min check): home renders correctly, navigation works, dashboard SPA bootstraps, theme bootstrap doesn't FOUC.
**Plans**: TBD

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 221. Angular 19 → 20 mechanical upgrade | 0/0 | Not started | — |
| 222. Production verification | 0/0 | Not started | — |

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

### Known tech debt with milestone-after-next deadline

- **Angular 19 EOL: 2026-05-19** -- the showcase Angular shell must migrate to Angular 20 before this date. Out of scope for v0.9.46; explicit milestone-after-next deadline tracked in PROJECT.md

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
