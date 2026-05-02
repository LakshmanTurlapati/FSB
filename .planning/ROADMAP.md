# Roadmap: FSB (Full Self-Browsing)

## Status

Active milestone: **v0.9.47 Workspace Reorganization (extension / mcp / showcase)**.

Reorganize the repo into three clearly-bounded top-level packages — `extension/`, `mcp/`, `showcase/` — each owning its own assets, README, and tests. Cross-package boundaries become explicit; future work has a single obvious place to land. Mechanical, well-defined work; no functional changes.

## Milestones

- 🟡 **v0.9.47 Workspace Reorganization** -- in progress (started 2026-05-02)
- ✅ **v0.9.46 Site Discoverability (SEO + GEO)** -- shipped 2026-05-02
- ✅ **v0.9.45rc1 Sync Surface, Agent Sunset & Stream Reliability** -- shipped 2026-04-29
- ✅ **v0.9.40 Session Lifecycle Reliability** -- shipped 2026-04-25
- ✅ **v0.9.36 MCP Visual Lifecycle & Client Identity** -- shipped 2026-04-24
- ✅ **v0.9.35 MCP Plug-and-Play Reliability** -- shipped 2026-04-24
- ✅ **v0.9.34 Vault, Payments & Secure MCP Access** -- shipped 2026-04-22

## Phases

- [ ] **Phase 217: Move extension files to `extension/`** — Move `background.js`, `manifest.json`, `canvas-interceptor.js`, `content/`, `ui/`, `agents/`, `ws/`, `ai/`, `offscreen/`, `lib/`, `assets/`, `config/` under `extension/`; update manifest paths, importScripts, ui html relative paths, and any cross-package imports; load-test by pointing Chrome at `extension/` as unpacked extension root.
- [ ] **Phase 218: Rename `mcp-server/` → `mcp/`** — Folder rename only; npm package `fsb-mcp-server` unchanged. Update `mcp/package.json` build script `cp ../extension/ai/tool-definitions.js`; update `npm-publish.yml` `working-directory` from `mcp-server` to `mcp`; update `tests/mcp-version-parity.test.js` and any other test that hardcodes `mcp-server/`.
- [ ] **Phase 219: Move `server/` → `showcase/server/`** — Move Express + SQLite deploy backend; update `Dockerfile` COPY/CMD paths; update `fly.toml` build artifact; update `deploy.yml` paths-ignore + working-directory.
- [ ] **Phase 220: READMEs + CI paths + final validation** — Rewrite root `README.md` as repo overview; create per-package READMEs; update `ci.yml` job paths; update `scripts/validate-extension.mjs` to walk `extension/`; update root `package.json` test script paths; final VAL-01..04 (npm pack diff, manual extension UAT, production deploy verification, fresh-clone smoke).

## Phase Details

### Phase 217: Move extension files to `extension/`
**Goal**: All Chrome-extension source files live under `extension/`; the extension loads cleanly when Chrome is pointed at `extension/` as the unpacked root; no extension-loadable JS file exists at repo root.
**Depends on**: Nothing (keystone phase — Phase 218 depends on extension/ai/ existing for the tool-definitions copy)
**Requirements**: EXT-01, EXT-02, EXT-03, EXT-04, EXT-05
**Success Criteria** (what must be TRUE):
  1. `git mv` (or equivalent) places `background.js`, `manifest.json`, `canvas-interceptor.js`, `content/`, `ui/`, `agents/`, `ws/`, `ai/`, `offscreen/`, `lib/`, `assets/`, `config/` under `extension/`. Repo root contains no `*.js` extension entry points (excluding root `scripts/`, root tests, etc.).
  2. `extension/manifest.json` paths are root-relative (e.g., `background.service_worker = "background.js"`); manifest validation (per `scripts/validate-extension.mjs` walking `extension/`) passes with zero errors.
  3. Loading `extension/` as an unpacked Chrome extension installs cleanly: service worker boots, `importScripts(...)` calls in `background.js` resolve, popup HTML opens, side panel opens, control panel opens. DevTools console shows zero 404s.
  4. `extension/README.md` exists with: load-as-unpacked instructions, key entry points, link back to root README.
  5. The smoke automation case (open chrome://newtab → search → glow) runs end-to-end against the relocated extension.
**Plans**: TBD (planner decomposition)

### Phase 218: Rename `mcp-server/` → `mcp/`
**Goal**: Folder is renamed; npm package name is unchanged; `mcp/build` produces identical artifacts to pre-rename; CI `mcp-smoke` job passes; `npm-publish.yml` would publish `fsb-mcp-server@<next>` correctly on the next `mcp-v*` tag.
**Depends on**: Phase 217 (the build script's `cp ../extension/ai/tool-definitions.js` path requires `extension/ai/` to exist).
**Requirements**: MCP-01, MCP-02, MCP-03, MCP-04, MCP-05
**Success Criteria**:
  1. `git mv mcp-server mcp` (and update internal references); `mcp/package.json` name is still `fsb-mcp-server`; version unchanged.
  2. `npm --prefix mcp run build` exits 0 and produces `mcp/build/index.js` byte-equivalent to the pre-rename build (modulo timestamps).
  3. `.github/workflows/npm-publish.yml` `defaults.run.working-directory: mcp`; CI dry-run via `gh workflow run npm-publish.yml` (workflow_dispatch) succeeds (no actual publish — just resolves the path).
  4. `npm run test:mcp-smoke` passes (lifecycle + tools).
  5. `mcp/README.md` exists.
**Plans**: TBD

### Phase 219: Move `server/` → `showcase/server/`
**Goal**: Deploy backend lives under `showcase/`; production deploy works post-merge; fly.io serves `https://full-selfbrowsing.com/` correctly.
**Depends on**: Nothing (independent of 217/218; can run in parallel but executed sequentially per single-tree convention).
**Requirements**: SRV-01, SRV-02, SRV-03, SRV-04, SRV-05
**Success Criteria**:
  1. `git mv server showcase/server`; internal file structure unchanged.
  2. `Dockerfile` paths updated; `docker build .` succeeds locally (or in CI dry-run).
  3. `fly.toml` artifact paths updated; `flyctl deploy --remote-only --config fly.toml` is the same command (no flag changes needed).
  4. `.github/workflows/deploy.yml` paths-ignore + working-directory updated; workflow triggers on push to main.
  5. After merge, `curl -A GPTBot https://full-selfbrowsing.com/` returns prerendered HTML (re-verifies SMOKE-01 from v0.9.46).
**Plans**: TBD

### Phase 220: READMEs + CI paths + final validation
**Goal**: All four READMEs exist (root + 3 packages); CI workflow paths point at the new layout; root orchestration scripts work; fresh-clone smoke passes.
**Depends on**: Phases 217, 218, 219
**Requirements**: DOC-01, DOC-02, DOC-03, DOC-04, CI-01, CI-02, CI-03, CI-04, VAL-01, VAL-02, VAL-03, VAL-04
**Success Criteria**:
  1. Four READMEs in place, each scoped to its package; root README is overview-only with links.
  2. `.github/workflows/ci.yml` job paths updated; `extension`, `mcp-smoke`, `showcase`, `all-green` all pass on the milestone PR.
  3. `scripts/validate-extension.mjs` walks `extension/`; zero false positives, zero false negatives.
  4. Root `package.json` test script paths updated; `npm test` from repo root passes.
  5. `npm pack --dry-run` from `mcp/` produces a tarball whose file list matches `fsb-mcp-server@0.7.4` published tarball (path-stable, no surprise additions/deletions).
  6. Manual extension UAT: load `extension/` as unpacked, run smoke automation case.
  7. After merge: production deploy serves correctly; fresh clone of main + `npm install && npm test && npm run validate:extension && npm run test:mcp-smoke && npm run showcase:build` exits 0.
**Plans**: TBD

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 217. Move extension files to `extension/` | 0/0 | Not started | — |
| 218. Rename `mcp-server/` → `mcp/` | 0/0 | Not started | — |
| 219. Move `server/` → `showcase/server/` | 0/0 | Not started | — |
| 220. READMEs + CI paths + final validation | 0/0 | Not started | — |

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
