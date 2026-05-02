# Requirements: FSB v0.9.47 Workspace Reorganization (extension / mcp / showcase)

**Defined:** 2026-05-02
**Core Value:** Reliable single-attempt execution — the AI decides correctly, the mechanics execute precisely

## Milestone Goal

Reorganize the repo into three clearly-bounded top-level packages — `extension/`, `mcp/`, `showcase/` — each owning its own assets, README, and tests. Cross-package boundaries become explicit; future work (Angular 20 migration, MCP features, extension features) has a single obvious place to land.

## Already Validated (counted toward this milestone)

None. v0.9.47 is purely structural — no prior phase landed any of these requirements.

## v1 Requirements (in scope for v0.9.47)

### Extension Move (EXT)

- [ ] **EXT-01**: All extension source files move under `extension/`: `background.js`, `manifest.json`, `canvas-interceptor.js`, `content/`, `ui/`, `agents/`, `ws/`, `ai/`, `offscreen/`, `lib/`, `assets/`, `config/` (extension config; do not move `.github/`/`.planning/` etc.). After the move, no extension-loadable JS file exists at repo root.
- [ ] **EXT-02**: `extension/manifest.json` references all paths relative to itself (e.g., `background.service_worker = "background.js"`, not `"extension/background.js"`); the extension loads cleanly when the user points Chrome at `extension/` as the unpacked extension root.
- [ ] **EXT-03**: All `importScripts(...)` calls inside `extension/background.js` resolve relative to `extension/` (e.g., `importScripts('ai/agent-loop.js')` works because background.js is now at `extension/background.js` and `ai/` is at `extension/ai/`); zero runtime path errors when service worker boots.
- [ ] **EXT-04**: All HTML files in `extension/ui/` reference scripts/CSS via paths relative to `extension/ui/` (existing relative paths like `../background.js` adjust to `../background.js` from the new root). Manual smoke: open `extension/ui/control_panel.html` from `chrome-extension://...` URL — page loads, no 404s in DevTools console.
- [ ] **EXT-05**: `extension/README.md` exists and describes: how to load the extension as unpacked, where to find Chrome Web Store packaging script, key entry points (`background.js`, `manifest.json`, `content/`, `ui/`).

### MCP Rename (MCP)

- [ ] **MCP-01**: `mcp-server/` is renamed to `mcp/`. The directory contents are unchanged (no internal restructure); the npm package name `fsb-mcp-server` in `mcp/package.json` is unchanged; all internal paths inside `mcp/src/` continue to resolve.
- [ ] **MCP-02**: `mcp/build` script (`tsc && cp ../ai/tool-definitions.js ai/tool-definitions.cjs`) is updated to point at the new extension location: `cp ../extension/ai/tool-definitions.js ai/tool-definitions.cjs` (since `ai/` moved into `extension/` per EXT-01). The `mcp/build/` artifacts continue to be produced identically.
- [ ] **MCP-03**: `.github/workflows/npm-publish.yml` `defaults.run.working-directory` is updated from `mcp-server` to `mcp`; the workflow continues to publish `fsb-mcp-server@<version>` to npm on `mcp-v*` tag pushes (no functional change to the publish step itself).
- [ ] **MCP-04**: `tests/mcp-version-parity.test.js` and any other test that hardcodes `mcp-server/` is updated to read from `mcp/`. All existing MCP smoke tests (`mcp-lifecycle-smoke`, `mcp-tool-smoke`, etc.) pass.
- [ ] **MCP-05**: `mcp/README.md` exists (carrying over from `mcp-server/README.md` if present, or new). It describes installation (`npx fsb-mcp-server`), CLI verbs, MCP client integration.

### Showcase Server Move (SRV)

- [ ] **SRV-01**: `server/` (Express + SQLite deploy backend) is moved to `showcase/server/`. Internal file structure unchanged.
- [ ] **SRV-02**: `Dockerfile` `COPY` and `CMD` paths are updated to reference `showcase/server/server.js` (or whichever entrypoint), and the Dockerfile builds successfully (`docker build .` exits 0). If the Dockerfile copies `package.json` from `server/`, that path becomes `showcase/server/package.json`.
- [ ] **SRV-03**: `fly.toml` `[build]` and `[processes]` directives continue to point at the right artifact post-move; `flyctl deploy --remote-only` (the actual deploy.yml command) succeeds in CI.
- [ ] **SRV-04**: `.github/workflows/deploy.yml` paths-ignore list is updated as needed; the workflow still triggers on push-to-main and runs the same `flyctl deploy` step.
- [ ] **SRV-05**: Production deploy works end-to-end after merge — `https://full-selfbrowsing.com/` returns 200 with prerendered HTML; `/dashboard` SPA shell still bootstraps.

### Documentation (DOC)

- [ ] **DOC-01**: Root `README.md` is rewritten as a repo overview: short project description, three-package map (extension/ + mcp/ + showcase/) with one-paragraph description and link to each sub-README, build/dev quickstart, license, contribution pointer.
- [ ] **DOC-02**: `extension/README.md` covers extension-specific docs (per EXT-05).
- [ ] **DOC-03**: `mcp/README.md` covers MCP-server-specific docs (per MCP-05).
- [ ] **DOC-04**: `showcase/README.md` covers showcase-specific docs: how to dev the Angular site (`npm start` in `showcase/angular`), how the deploy backend works (`showcase/server/`), how prerender + crawler files are generated, link to `showcase/angular/README.md` if any.

### CI / Tooling (CI)

- [ ] **CI-01**: `.github/workflows/ci.yml` job paths are updated: `extension` job points at `extension/` for `validate:extension` + tests; `mcp-smoke` job uses `mcp/` working-directory; `showcase` job uses `showcase/angular/` (unchanged but verified).
- [ ] **CI-02**: `scripts/validate-extension.mjs` walks `extension/` (not the repo root) for the manifest sanity + JS syntax check. Exit-zero on a clean extension/.
- [ ] **CI-03**: Root `package.json` test script is updated: every `node tests/*.test.js` line resolves to the new test location (`extension/tests/*.test.js` or wherever tests land per EXT-01); the existing `npm test` invocation succeeds in CI.
- [ ] **CI-04**: `npm run validate:extension`, `npm run test:mcp-smoke`, `npm run showcase:build` all continue to work from repo root (script invocations may move into per-package package.jsons but root-level orchestration scripts remain).

### Validation (VAL)

- [ ] **VAL-01**: `npm publish` from `mcp/` produces an identical-to-before tarball (same files, same package name, same version) — verified via `npm pack --dry-run` diff against the published `fsb-mcp-server@0.7.4` tarball (allow only path changes inside the tarball if any, no surprise file additions/deletions).
- [ ] **VAL-02**: Loading `extension/` as an unpacked Chrome extension works end-to-end: extension installs, popup opens, side panel opens, control panel opens, a basic automation task runs (smoke-level — open `chrome://newtab`, type a search, observe glow). Manual UAT.
- [ ] **VAL-03**: Production deploy after merge serves `https://full-selfbrowsing.com/` correctly, prerender + crawler files intact (re-verified via `smoke-crawler.mjs` against production).
- [ ] **VAL-04**: After PR merge, fresh clone of `main` followed by `npm install && npm test && npm run validate:extension && npm run test:mcp-smoke && npm run showcase:build` exits 0 — proves the reorg holds for a fresh-checkout developer.

## Future Requirements (deferred to v0.9.48+)

- **A20-01..N**: Angular 19 → 20 migration (deadline 2026-05-19) — first candidate for v0.9.48
- **CRAWL-FUTURE-01**: Per-route OG images
- **DISCO-FUTURE-01..05**: FAQ page, comparison pages, off-page push, GSC + Bing Webmaster registration

## Out of Scope (explicit exclusions)

- **Workspace tooling** (npm workspaces, Yarn workspaces, Nx, Turborepo) — folder rename only; tooling change is a separate milestone if ever
- **Renaming the npm package `fsb-mcp-server`** — already on npm at 0.7.4; folder rename does NOT change package name
- **Code refactors beyond import-path fixes** — no functional changes; this milestone is mechanical
- **Bundling / transpiling extension code** — extension stays raw JS loaded by Chrome
- **New CI matrix** (per-package independent CI runners) — keep the existing `extension` + `mcp-smoke` + `showcase` + `all-green` job structure with paths updated
- **MCP-server semver bump** — folder rename doesn't justify a release; next mcp-v* tag is whenever the next functional change lands

## Known Tech Debt

- **Angular 19 EOL: 2026-05-19** — must migrate to A20 next milestone (v0.9.48)
- **Cross-package import path: `mcp/build` script `cp ../extension/ai/tool-definitions.js`** — couples mcp-server build to extension layout. Tolerable for now; revisit if mcp/ should own its own copy of tool-definitions instead of cross-package symlink-style copy.
- **Dockerfile + fly.toml hardcoded paths** — manual update required; risk of drift if anyone restructures showcase/server/ later. Mitigation: deploy.yml verify smoke against production catches this.

## Traceability

Every v1 requirement maps to exactly one phase. The traceability table below is filled by the roadmapper.

| REQ-ID | Phase | Plan | Status |
|--------|-------|------|--------|
| EXT-01..05 | 217 | TBD | active |
| MCP-01..05 | 218 | TBD | active |
| SRV-01..05 | 219 | TBD | active |
| DOC-01..04 | 220 | TBD | active |
| CI-01..04 | 220 | TBD | active |
| VAL-01..04 | 220 | TBD | active |

**Coverage:** 27/27 requirements mapped. No orphans, no duplicates.

**Phase distribution (preliminary):** Phase 217 = 5 (EXT-01..05). Phase 218 = 5 (MCP-01..05). Phase 219 = 5 (SRV-01..05). Phase 220 = 12 (DOC + CI + VAL).

---
*Defined: 2026-05-02*
