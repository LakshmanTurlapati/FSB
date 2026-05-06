# Project Milestones: FSB (Full Self-Browsing)

## v0.9.60 Multi-Agent Tab Concurrency (Shipped: 2026-05-06)

**Phases completed:** 8 phases, 24 plans, 28 tasks

**Key accomplishments:**

- 1. [Rule 1 — Test bug] Test 1 hardcoded agentIdShort prefix did not match formatAgentIdForDisplay output.
- 1. [Rule 1 - Bug] mcp-tool-smoke.test.js invokeTool helper offset
- Modern AI loop terminal exits and user-stop now feed the lifecycle bus, unblocking the run_task return-on-completion fix that the original Phase 236 was deferred for.
- 1. [Rule 3 - Blocking] Subscribe-time `_sendProgress` removed; replaced with subscribe-time `writeSnapshot` only
- Closes Phase 239 by stitching Plan 01's lifecycle bus and Plan 02's heartbeat + persistence into a strict single-resolve discipline. Both 300s ceilings raised to 600s safety nets; lifecycle event always wins the race; SW eviction now resolves the originating MCP call cleanly with a documented partial_state.
- Inline checkOwnershipGate at dispatchMcpToolRoute (sync, same microtask) with three typed reject codes; bindTab in 3 of 4 D-08 handlers; AgentScope ownershipToken capture; 6 mcp-tool-smoke deepEqual sites strengthened with token_test_smoke.
- Modified -- documentation comment only.
- 1. [Rule 3 - Blocking] Pre-existing 20-concurrent mutex stress test broken by new default cap=8
- 1. bindTab needed an opts argument to receive `forced: true`.
- Registers a single-step ownership-gated `back` MCP tool in agents.ts that emits a structured `{status, resultingUrl, historyDepth}` reply over a new `mcp:go-back` bridge envelope, threading the canonical Phase 238/240/241 agentId/ownershipToken/connectionId triple.
- 1. [Rule 3 - Blocking] Wired 'back' through tests/mcp-tool-smoke.test.js
- 1. [Rule 3 - File extension] Plan referenced `tool-definitions.cjs`; actual file is `tool-definitions.js`
- LOG-04 'agent-tab-user-navigation' diagnostic on user-initiated webNavigation commits of non-legacy agent-owned tabs, with 500ms registry-stamped suppression to filter Phase 242 back-tool transitionType auto_bookmark false-positives.
- 1. [Rule 3 - Module reachability] Lazy formatAgentIdForDisplay resolution
- mcp/src/tools/agents.ts (back)
- 1. [Rule 2 - Missing critical functionality] Triple-bump version.ts alongside package.json + server.json

---

## v0.9.50 Autopilot Refinement (MCP-Parity) (Shipped: 2026-05-03)

**Phases completed:** 7 GSD-tracked (224-230) + 3 opportunistic (231-233 untracked); 54 commits, 91 files changed (+7607 / −362)

**Archive:** `.planning/milestones/v0.9.50-ROADMAP.md` and `.planning/milestones/v0.9.50-REQUIREMENTS.md`

**Audit status:** `tech_debt` accepted — `.planning/v0.9.50-MILESTONE-AUDIT.md`

**Key accomplishments:**

- Established autopilot baseline (Phase 224) — side-by-side autopilot-vs-MCP tool surface inventory, baseline `run_task` log run with failure categorization, reproducible operator verification recipe. Surfaced two unexpected findings: element targeting was already clean; real failure modes were tool-choice escapes and stuck-no-detection long loops.
- Tool layer aligned with MCP (Phase 225) — verified annotation parity is structural via shared TOOL_REGISTRY (no-op fix); shipped MCP autopilot reliability fixes (in-flight session lookup, stop_task on active session); confirmed CDP routing parity. MCP server-side `run_task` return-on-completion subscribe deferred to Phase 236.
- Prompt rules added with baseline-evidence (Phase 226) — 5 new system prompt rules + dropdown two-click pattern. Mid-milestone reversal: original "no-shortcut-escapes" rule replaced with "JS-first" policy after Amazon Add-to-cart loops showed native click failing repeatedly while JS click succeeded in one shot.
- Stuck-detection enhanced (Phase 227 + meta-cognitive Phase 233) — strict consecutive-action-repetition detector (warn@3, force-stop@5) plus windowed goal-progress heuristic, both with attributed reason codes. Phase 233 added per-target attempt counter (warn@4, force-stop@6, 12-iteration window) that pools mixed click+execute_js attempts and operates independently of the lossy `actionHistory` pipeline.
- Dynamic model discovery shipped (Phase 228) — replaced hardcoded model lists with live `/v1/models` API calls per provider (xAI, OpenAI, Anthropic, Gemini, OpenRouter); FALLBACK_MODELS preserved as constants; per-provider response shape handled in single discovery module.
- Visual overlay stabilization (Phases 229 + 230) — 400ms debounce, glow position memoization, monotonic progress clamp, reduced-motion CSS, then 1200ms minimum-display-duration floor on top; replaced percent in pill with phase wording ("Acting…", "Thinking…", "Writing…").
- Cost-limit removed (Phase 231 untracked) — $2/session cost circuit breaker disabled per operator request; iteration limit + time limit gate sessions now.
- Model-discovery cache + sticky selection (Phase 232 untracked) — discovered model list now persists to `chrome.storage.local` with 24h TTL (survives MV3 service-worker restarts); user's saved model preserved as `(saved)` synthetic entry rather than silently reassigned.
- Version bumped 0.9.31 → 0.9.50 across extension manifest, package.json, runtime headers, README, showcase APP_VERSION.

**Accepted debt (tech_debt audit):**

- MCP `run_task` 300s ceiling — extension-side completion broadcaster ships, MCP server-side subscriber not yet published (Phase 236).
- Phase 230 documentation gap — single atomic commit, no per-plan SUMMARYs (work itself sound; Phase 234 formalizes).
- PROMPT-08 fallback escape — drag still falls back to `execute_js` JS-swap when CDP returns observable no-op; partially mitigated by Phase 233 meta-cognitive force-stop.
- Three opportunistic phases (231/232/233) bypassed GSD lifecycle — 231 committed clean, 232+233 uncommitted at archive time. Phase 235 retroactive coverage planned.
- REQUIREMENTS.md grew from declared 13 to actual 36 REQ-IDs over the milestone; mid-milestone REQ families (DISCOVERY-*, OVERLAY-*, DWELL-*) backfilled at completion time.
- Stray `mcp/ai/tool-definitions.cjs` drift from another phase mixed into Phase 232's working tree.
- `actionHistory` recording bug — primary mutation tools (click) and most execute_js calls don't reach `session.actionHistory.push`. Worked around in Phase 233 with defensive `session.toolCallLog`. Root-cause fix not in scope.

**Gap-closure phases planned (carry to next milestone):** 234 (REQUIREMENTS backfill formalization), 235 (retro PLAN/SUMMARY/VERIFICATION for 231/232/233 + commit cleanup), 236 (MCP `run_task` return-on-completion publish + lifecycle bus subscriber).

---

## v0.9.49 Remote Control Rebrand & Showcase Metrics Wire-up (Shipped: 2026-05-02)

**Phases completed:** 1 phases, 4 plans, 6 tasks

**Key accomplishments:**

- Full local CI matrix green (validate:extension OK, npm test all suites pass, showcase:build OK, showcase:smoke 46/0); autonomous UAT AUTO-PASS recorded against all four ROADMAP success criteria with live-extension visual confirmation deferred as carry-over validation debt.

---

## v0.9.48 Angular 20 Migration (Shipped: 2026-05-02)

**Delivered:** Migrated `showcase/angular/` from Angular 19 to Angular 20 ahead of the 2026-05-19 Angular 19 EOL (shipped 17 days early). All v0.9.46 SEO/GEO surfaces preserved; production smoke crawler against `https://full-selfbrowsing.com/` passed 46/46 assertions post-deploy.

**Archive:** `.planning/milestones/v0.9.48-ROADMAP.md` and `.planning/milestones/v0.9.48-REQUIREMENTS.md`

**Phases completed:** 2 phases (221 mechanical upgrade, 222 production verification), 1 plan, 3 commits, 12 files (+2815 / −2368 — mostly lockfile churn)

**Key accomplishments:**

- `ng update @angular/cli@20 @angular/core@20 @angular/build@20 @angular/ssr@20 --allow-dirty` ran the v19 → v20 schematic suite to completion. Schematic auto-rewrote `provideServerRouting` → `provideServerRendering(withRoutes(...))` in `app.config.server.ts`; moved `DOCUMENT` imports from `@angular/common` to `@angular/core` across 4 page components.
- All `@angular/*` packages now `^20.3.x`; TypeScript bumped 5.6 → 5.9.3.
- `zone.js` retained at v20-compatible version (zoneless deferred to future milestone).
- One manual cleanup: removed unused `withRoutes` import from `app.routes.server.ts` (schematic added it speculatively).
- Lockfile-drift fix: PR #15 regenerated `showcase/angular/package-lock.json` cleanly after the Phase 221 commit failed `npm ci` in the Docker build.
- All v0.9.46 SEO/GEO surfaces preserved: per-route prerender of `/`, `/about`, `/privacy`, `/support`; route-specific titles + canonicals + OG/Twitter; Organization + SoftwareApplication JSON-LD; runtime `noindex` on `/dashboard`; `robots.txt`/`sitemap.xml`/`llms.txt`/`llms-full.txt` at apex.
- Production smoke 46/46 post-deploy.

**Accepted debt:**

- `serve:ssr:showcase-angular` npm script is now dead — Angular 20 + `outputMode: static` no longer writes `dist/showcase-angular/server/`. Production unaffected; cleanup in a future docs/scripts pass.
- Lockfile-drift risk between dev (Node 25) and CI/Docker (Node 20) — caused the deploy retry. Future migrations should validate `npm ci` from a clean tree before pushing.

---

## v0.9.47 Workspace Reorganization (extension / mcp / showcase) (Shipped: 2026-05-02)

**Delivered:** Reorganized the repo into three clearly-bounded top-level packages — `extension/`, `mcp/`, `showcase/`. Each package owns its own assets and README. Cross-package boundaries are now explicit. Mechanical reorg only — no functional changes, no bundler/tooling changes, no Angular migration.

**Archive:** `.planning/milestones/v0.9.47-ROADMAP.md` and `.planning/milestones/v0.9.47-REQUIREMENTS.md`

**Phases completed:** 4 phases (217–220), 4 plans, 5 commits, 406 files (+513 / −164)

**Key accomplishments:**

- Phase 217: Moved 16 dirs/files (`background.js`, `manifest.json`, `content/`, `ui/`, `agents/`, `ws/`, `ai/`, `offscreen/`, `lib/`, `assets/`, `config/`, plus 5 supporting dirs) under `extension/` via `git mv`; updated `scripts/validate-extension.mjs` to walk `extension/`; patched ~35 test files; created `extension/README.md`.
- Phase 218: Renamed `mcp-server/` → `mcp/`; npm package `fsb-mcp-server@0.7.4` name unchanged; updated `npm-publish.yml` `working-directory`, `ci.yml` job, root `package.json` test scripts, 8 test files + harness.
- Phase 219: Moved `server/` (Express + SQLite + ws deploy backend) → `showcase/server/`; updated `Dockerfile` (3 `COPY` lines), `.dockerignore`, `.gitignore`. `fly.toml` and `deploy.yml` untouched (no internal path references).
- Phase 220: Added Repository Layout section to root README; created `showcase/README.md`; verified CI workflow paths post-reorg; full local + production validation passed (`curl https://full-selfbrowsing.com/` → 200 with SSR payload).
- CI gating preserved end-to-end: `extension` + `mcp` + `showcase` + `all-green` aggregator. Branch protection on `all-green` held through every reorg PR (#7, #8, #9, #10, #11).

**Accepted debt:**

- Angular 19 EOL: 2026-05-19 — A20 migration is the next milestone (v0.9.48).
- Cross-package import path: `mcp/package.json` build script does `cp ../extension/ai/tool-definitions.js`. Couples mcp build to extension layout.
- Root README still 948 lines of landing-page content; could be slimmed in a future docs pass.

---

## v0.9.46 Site Discoverability (SEO + GEO) (Shipped: 2026-05-02)

**Delivered:** Made `full-selfbrowsing.com` discoverable to traditional search engines and generative AI search by prerendering the four marketing routes (`/`, `/about`, `/privacy`, `/support`) and shipping LLM/crawler-aware root files. Pre-milestone the site returned only the literal string "FSB" to non-JS crawlers; post-milestone every route returns route-specific prerendered HTML with structured data (Organization + SoftwareApplication) and the site exposes `/robots.txt`, `/sitemap.xml`, `/llms.txt`, `/llms-full.txt`. Verified live via Google Rich Results Test.

**Archive:** `.planning/milestones/v0.9.46-ROADMAP.md` and `.planning/milestones/v0.9.46-REQUIREMENTS.md`

**Phases completed:** 2 phases (215, 216), 8 plans, 47 commits, 68 files (+8965 / −1533)

**Key accomplishments:**

- Static prerender pipeline (`@angular/ssr@^19` with `outputMode: "static"` + `provideServerRouting`) emitting per-route `index.html` for the four marketing routes; `/dashboard` stays SPA.
- Per-route metadata via Angular `Title` + `Meta` services + `Renderer2`-driven `<link rel="canonical">`; OpenGraph and Twitter Card tags on every route; runtime `noindex,nofollow` on `/dashboard`.
- Structured data: `Organization` JSON-LD baked into `src/index.html` (inherited by every prerendered route); `SoftwareApplication` JSON-LD on home with `publisher.@id` cross-reference; T-LD-01 mitigated via `\u003c` escape.
- Crawler root files: `robots.txt` allowlists 15 named LLM bots (GPTBot, ClaudeBot, PerplexityBot, Google-Extended, Applebot-Extended, etc.); `sitemap.xml` lists 4 routes; `llms.txt` (llmstxt.org-format) + `llms-full.txt` long-form GEO source.
- Single-file ESM Node prebuild (`build-crawler-files.mjs`) regenerates `sitemap.xml`, `llms-full.txt`, and `version.ts` from `manifest.json.version` via npm `prebuild` lifecycle hook; zero new dependencies.
- Express SPA-fallback patched: per-route prerendered HTML preferred over root `index.html`; `/dashboard` exact-match whitelisted; `*.txt` / `*.xml` pinned to `Cache-Control: public, max-age=3600`.
- Production crawler smoke (`smoke-crawler.mjs`, 46 assertions) usable against `BASE_URL`; 5-entry manual UAT scaffold in `216-HUMAN-UAT.md` for Rich Results Test + GSC Live URL.
- Live post-deploy verification: Google Rich Results Test detects 1 valid `SoftwareApplication` with 0 errors; direct GPTBot-UA crawls of all 4 routes return route-specific titles + canonicals.

**Accepted debt:**

- Angular 19 EOL is 2026-05-19 — Angular 20 migration tracked separately as a future milestone.
- `scripts/llms-full.source.md` hardcodes "50+ browser actions, 142+ site guides"; drift risk flagged for revisit if release counts diverge.
- `sitemap.xml` `lastmod` is build-day UTC and refreshes on every CI build (D-07; acceptable for low-frequency crawl audience).
- 215-HUMAN-UAT.md has 2 items pending operator session (dashboard runtime `noindex` DOM check, FOUC under cleared `localStorage`); functionally low-risk.

---

## v0.9.40 Session Lifecycle Reliability (Shipped: 2026-04-25)

**Delivered:** Fixed silent task abandonment where the agent loop exits without notifying the sidepanel. All exit paths now finalize properly, every termination records a structured reason, background.js lifecycle handles edge cases without silent loss, and the sidepanel self-heals as a last resort.

**Phases completed:** 3 phases, 4 plans, 12 commits

**Key accomplishments:**

- All 5 broken agent-loop exit paths (stuck force-stop, 3 safety breaker paths, guard clauses) now call `finalizeSession()` with structured termination reasons (`stuck_force_stop`, `cost_limit_exceeded`, `time_limit_exceeded`, `iteration_limit_exceeded`, `session_not_found`, `session_not_running`).
- Guard clauses send blind `automationComplete` broadcasts to the sidepanel even when the session object is missing, ensuring the sidepanel always resets to idle.
- Stale session cleanup now guards running sessions from periodic 30-minute deletion.
- Tab close handler sends full `automationComplete` with `reason: 'tab_closed'` and cleans up overlays before deleting the session.
- Service worker wake immediately notifies the sidepanel with `reason: 'service_worker_restart'` for non-resumable restored sessions.
- 15 silent `.catch(function(){})` on sendMessage calls replaced with diagnostic `console.warn` logging (3 in agent-loop.js, 12 in background.js).
- Sidepanel 10-second liveness poll with 2-failure grace period detects orphaned "working" state and self-heals to idle.

**Accepted debt:**

- UAT Tests 1 and 3 (SW kill orphan recovery, interval cleanup) skipped due to MCP bridge relay timeout preventing remote observation. Code-level verification passed 4/4 must-haves. Manual testing recommended during next interactive session.

---

## v0.9.36 MCP Visual Lifecycle & Client Identity (Shipped: 2026-04-24)

**Delivered:** Explicit MCP visual-session ownership, trusted client badges, persisted overlay replay, and lifecycle validation/docs for MCP-driven browser work outside the built-in autopilot loop.

**Archive:** `.planning/milestones/v0.9.36-ROADMAP.md` and `.planning/milestones/v0.9.36-REQUIREMENTS.md`

**Phases completed:** 3 phases, 6 plans, 12 tasks

**Key accomplishments:**

- Explicit MCP visual-session start/end tools with trusted client labels, separate tab ownership, and token-aware overlay metadata.
- Token-aware progress and final task-status updates for client-owned MCP visual sessions, with deterministic final-clear behavior and narration-safe regressions locked down.
- Trusted MCP client badges now render consistently on the live page overlay and the mirrored dashboard preview, including frozen overlay states.
- Client-owned visual sessions now survive reinjection and service-worker churn, replay with the same trusted owner, and degrade or clear safely instead of leaving the glow stuck.
- The MCP visual-session lifecycle is now backed by packaged smoke for start/end, explicit idempotent cleanup assertions, and tighter overlay/preview regressions for degraded and frozen client-owned states.
- The MCP package guide now explains how to own the glow with visual sessions, when `run_task` is still the better fit, and where trusted client labels and `session_token` threading matter.

**Accepted closeout notes:**

- No standalone `v0.9.36-MILESTONE-AUDIT.md` file was created before archive; closeout relies on the archived roadmap snapshot, requirements snapshot, and phase summaries.

---

## v0.9.35 MCP Plug-and-Play Reliability (Shipped: 2026-04-24)

**Delivered:** Plug-and-play MCP reliability across reconnect lifecycle, tool routing, diagnostics, install parity, and release-smoke validation.

**Phases completed:** 5 phases, 15 plans, 24 tasks

**Key accomplishments:**

- Bridge lifecycle now reconnects across browser-first, server-first, service-worker wake, and hub/relay handoff scenarios without requiring extension reload loops.
- MCP browser, autopilot, observability, and restricted-tab paths now route through explicit verified contracts instead of fragile background self-dispatch.
- `doctor`, `status --watch`, and recovery messaging now identify the failing layer and point operators at one concrete next action.
- Installer/config parity now covers Codex TOML preservation, Claude/Cursor/Windsurf guidance, and explicit manual fallback posture for unstable hosts like OpenCode/OpenClaw.
- Release smoke now includes automated lifecycle/tool suites plus dated host evidence and diagnostics-first troubleshooting docs.

**Accepted closeout debt:**

- No standalone `v0.9.35-MILESTONE-AUDIT.md` file was produced before archive.
- Phase 202 records residual live-UAT risk because paid-model host prompt sessions were not auto-triggered when local host preflight was already red or unconfigured.

---

## v0.9.34 Vault, Payments & Secure MCP Access (Shipped: 2026-04-22)

**Delivered:** Vault unlock repair, payment method management, autopilot/MCP vault fill surfaces, and security boundary fixes for sensitive credential/payment flows.

**Phases completed:** 8 phases, 11 plans, 14 tasks

**Key accomplishments:**

- Restored vault lifecycle messaging and eager session/payment-access rehydration across service worker restarts.
- Wired payment method CRUD, masked listing, separate payment unlock state, and options-page payment management UI.
- Added autopilot credential/payment fill paths with sidepanel confirmation before payment fills.
- Added MCP vault tools that return metadata only and keep raw secrets inside the extension/content-script boundary.
- Closed MCP security audit gaps for active-tab domain derivation, sidepanel payment confirmation, content-script param redaction, and the 125-second MCP payment confirmation timeout.
- Shipped backlog MCP tool hardening for route-aware dispatch and text-based click targeting.

**Accepted validation debt:**

- Archived milestone audit is `gaps_found` and predates the Phase 197 gap-closure commits; Phase 197 closed the listed MCP-04, SEC-01, and SEC-02 code gaps, but the milestone audit was not rerun.
- `REQUIREMENTS.md` still had 19 unchecked v1 requirement rows at archive time; those are preserved in `milestones/v0.9.34-REQUIREMENTS.md` as validation debt.
- Live UAT remains pending for Phase 191 vault behavior and Phase 197 MCP payment approve/deny/delayed-approval behavior.

---

## v0.9.30 MCP Platform Install Flags (Shipped: 2026-04-18)

**Phases completed:** 3 phases, 6 plans, 10 tasks

**Key accomplishments:**

- Platform registry module with 10 MCP platform configs, cross-OS path resolution, and config format parsing dependencies
- Format-aware config read-merge-write engine with JSON/JSONC/TOML/YAML support, backup, idempotency, and error handling
- Install/uninstall CLI orchestration for all 7 JSON-format platforms with version constants and end-to-end wiring
- Non-JSON platform support: Claude Code CLI delegation (execSync), TOML/YAML format gate removal, serializeByFormat export
- --dry-run preview with [DRY RUN] prefix and --all bulk install/uninstall across all 10 platforms with per-platform status

---

## v0.9.29 Showcase Angular Migration (Shipped: 2026-04-15)

**Phases completed:** 1 phases, 7 plans, 14 tasks

**Key accomplishments:**

- Standalone Angular migration foundation with deterministic showcase build output and compile-ready home/about/dashboard route component contracts.
- Canonical Angular shell routing plus `fsb-showcase-theme` pre-bootstrap/runtime parity contracts, protected by a source-contract regression test.
- Legacy home/about/dashboard route content now lives in Angular templates with preserved parity anchors, normalized home asset paths, and dashboard runtime DOM IDs intact.
- Global token/theme contracts now live in shared styles while each migrated route owns its legacy-equivalent visuals in component SCSS.
- Express now serves Angular shell routes on canonical showcase URLs with fixed legacy `.html` redirects, and one regression command enforces route/theme/content/server contracts together.
- Compile-ready Angular privacy and support standalone route component contracts with explicit placeholder headings for tranche-B D-02 coverage.
- Privacy and support routes are fully migrated into Angular templates, and a single five-route parity contract test now guards canonical anchors, dashboard IDs, and required asset paths.

**Accepted gaps at close:**

- Phase 174 (`DASH-08` to `DASH-10`) deferred.
- Phase 175 (`DASH-11` to `DASH-13`) deferred.
- Phase 176 (`DASH-14` to `DASH-17`) deferred.
- Phase 177 (`MIGR-01` to `MIGR-03`) deferred.

---

## v0.9.27 Usage Dashboard Fix (Shipped: 2026-04-14)

**Phases completed:** 2 phases, 3 plans, 6 tasks

**Key accomplishments:**

- Dashboard analytics refresh now waits for analytics initialization and reloads usage data from `chrome.storage.local` instead of relying on stale in-memory state.
- Off-screen analytics updates are deferred through `dashboardState.analyticsNeedsRefresh` and replayed when the operator returns to the dashboard.
- Missing dashboard label nodes are now null-safe, and the analytics refresh lifecycle is locked in place by `tests/dashboard-analytics-refresh.test.js` in the main `npm test` suite.
- Local unpacked-extension smoke verification confirmed that a real task completion updates request count, token totals, cost, and chart data on the options page.

**Accepted debt at close:**

- `Off-Screen Dashboard Refresh Smoke` remains explicitly deferred for a final local rerun before any push or release tagging.
- No standalone `v0.9.27` milestone-audit document was created; closure relies on the phase-level review, security, UAT, and verification artifacts for Phases 171-172.

**Stats:**

- 2 phases, 3 plans, 6 tasks
- Key files: `ui/options.js`, `utils/analytics.js`, `tests/dashboard-analytics-refresh.test.js`, `package.json`

---

## v0.9.26 Progress Overlay Refinement (Shipped: 2026-04-12)

**Phases completed:** 3 phases, 5 plans, 9 tasks

**Key accomplishments:**

- Status:
- GPU-composited scaleX progress bar, actionCount data pipeline from background through overlay-state, and tabular-nums on meta row digits
- rAF-driven elapsed timer in M:SS format, action count from overlayState.actionCount, success/failure completion presentation with 3s auto-hide, and frozen guard for post-completion safety

---

## v0.9.25 MCP & Dashboard Reliability Closure (Shipped: 2026-04-11)

**Phases completed:** 5 phases, 8 plans, 11 requirements (9 satisfied, 2 satisfied with debt)

**Key accomplishments:**

- Restricted-tab MCP parity: browser-safe navigation, tab, and run_task tools now operate from `chrome://newtab` and other restricted pages; smart-start routing is preserved and DOM/manual tools return actionable recovery guidance instead of raw injection errors.
- Dashboard reliability rebaseline: preview rejects stale DOM stream updates and resnapshots on divergence, remote control keeps bounded coordinates and recoverable debugger ownership through toggles and stream-tab changes, and dashboard task runs stay bound to one `taskRunId` across reconnect recovery.
- Runtime carryover hardening: `CostTracker` now hydrates after the final mode-aware safety config resolution so its cost limit matches the active mode, and the unused `emitter` passthrough option on `runAgentLoop` no longer advertises dead agent-loop plumbing.
- Auth outcome smoke verification: preserved partial/manual handoff and same-session auth resume are recorded as live-confirmed outcomes from a real extension session.
- Live dashboard verification pass: deterministic matrix executed against the real hosted dashboard, surfaced a duplicate legacy printable `char` echo defect, and shipped a defensive suppression fix in `background.js` covered by `tests/dashboard-runtime-state.test.js`.
- Shipped version bumped from 0.9.20 to 0.9.25 across `manifest.json`, `package.json`, UI surfaces, `README.md`, and project `CLAUDE.md` to realign with the closing milestone label.

**Accepted debt at close:**

- Phase 165 hosted-environment live reruns for DET-06/DET-07/DET-08/DET-13/DET-15/DET-16/DET-17/DET-18 and the 8 JS-heavy rows remain deferred. Requires a reloaded unpacked extension in the active Chrome session and a hosted dashboard build that exposes `window.__FSBDashboardTransportDiagnostics`. Code posture is stable; the remaining gap is live-environment observability only.

**Stats:**

- 5 phases, 8 plans, 11 requirements
- Key files: `background.js`, `tests/dashboard-runtime-state.test.js`, `ai/cost-tracker.js`, `ai/agent-loop.js`, `mcp-server/**`

---

## v0.9.24 Claude Code Architecture Adaptation (Shipped: 2026-04-05)

**Phases completed:** 10 phases, 20 plans, 33 requirements

**Key accomplishments:**

- Built the typed session-state foundation for the runtime with `createSession`, hot/warm persistence semantics, transcript storage, structured turn results, action history, and a state emitter.
- Extracted engine configuration seams for pricing, cost tracking, execution modes, session defaults, and permission gating so the runtime no longer relies on scattered inline constants.
- Introduced a reusable HookPipeline and refactored the agent loop to use lifecycle hooks, extracted modules, and resumable session behavior while preserving MV3-safe iteration flow.
- Structured service-worker bootstrap and migrated remaining consumers onto the new module contracts, including mode-aware session construction and session persistence.
- Wired runtime progress events into popup and sidepanel consumers, then added first-class partial outcomes and auth-wall handoff preservation so useful work survives blocked final steps.
- Made overlay/debugger feedback resilient across reconnects, navigation, long provider waits, and dashboard DOM-stream preview synchronization.

**Accepted debt at close:**

- `CostTracker` still needs a small ordering cleanup so its instantiated limit always matches the final per-mode session config.
- Auth-wall behavior shipped, but live browser smoke coverage is still recommended for no-sidepanel fallback, skip/timeout preservation, and same-session resume.

**Stats:**

- 10 phases, 20 plans, 33 requirements
- Key files: `ai/session-schema.js`, `ai/transcript-store.js`, `ai/hook-pipeline.js`, `ai/engine-config.js`, `ai/cost-tracker.js`, `background.js`, `ai/agent-loop.js`

---

## v0.9.21 UI Retouch & Cohesion (Shipped: 2026-04-02)

**Phases completed:** 5 phases, 9 plans

**Key accomplishments:**

- Established a shared `fsb-ui-core.css` baseline so popup, sidepanel, control panel, and dashboard surfaces all consume one FSB visual system
- Retouched the sidepanel into a cleaner persistent workspace with better hierarchy, history chrome, footer metadata, and composer behavior
- Retouched the popup into a cleaner quick-launch sibling with flatter chrome, aligned states, and tighter footer/composer treatment
- Flattened the control-panel/dashboard shell to a black-neutral dark mode, reduced oversized density, cleaned up pairing/docs surfaces, and normalized dashboard naming
- Replaced the oversized rectangular text highlight behavior with target-aware overlay feedback that uses text-style emphasis for inline targets and fitted boxes for controls, with DOM stream parity

**Stats:**

- 5 phases, 9 plans, 15 requirements
- Key files: `shared/fsb-ui-core.css`, `ui/sidepanel.css`, `ui/popup.css`, `ui/options.css`, `content/visual-feedback.js`

---

## v0.9.9.1 Phantom Stream (Shipped: 2026-03-31)

**Phases completed:** 9 phases (5 planned + 4 inserted fixes), 16 plans

**Key accomplishments:**

- Auto-connect DOM stream on WebSocket handshake with active tab tracking, recovery on disconnect, and 4-state health badge
- LZ-string compression for WS payloads (90%+ reduction on 100KB+ DOM snapshots) with envelope-based backward compat
- 4-mode layout system (inline, maximized, PiP with drag-to-reposition, fullscreen with mouse-tracked exit overlay)
- Full computed style capture (66 CSS properties) fixing broken layouts on complex sites like Google and YouTube
- Native alert/confirm/prompt dialog mirroring to dashboard with styled overlay cards
- Remote browser control (click/type/scroll) through preview with coordinate reverse-scaling and blue border active state
- Idempotent stop signals with promise resolution, eliminating hanging promises and duplicate task-complete messages
- Orange glow overlay broadcast during automation for visual element targeting in preview

**Stats:**

- 9 phases, 16 plans
- Key files: dashboard.js (2,718 lines), dom-stream.js (878 lines), ws-client.js (527 lines)

---

## v0.9.8.1 npm Publishing (Shipped: 2026-04-02)

**Phases completed:** 2 phases, 2 plans

**Key accomplishments:**

- npm-ready package with metadata, files whitelist, `.npmignore`, `prepublishOnly`, and tag-driven GitHub Actions publish workflow
- Public npm release means users can install and run the FSB MCP server via `npx -y fsb-mcp-server` without cloning the repo
- MCP docs now cover stdio usage, optional local HTTP mode, and setup/diagnostic commands without changing the extension bridge contract

**Stats:**

- 2 phases, 2 formal plans
- Key files: `mcp-server/package.json`, `mcp-server/README.md`, `.github/workflows/npm-publish.yml`, `mcp-server/server.json`

---

## v0.9.20 Autopilot Agent Architecture Rewrite (Shipped: 2026-04-02)

**Phases completed:** 8 phases (5 planned + 3 gap closures), 11 plans, 32 requirements

**Key accomplishments:**

- Replaced custom CLI text parsing autopilot with native tool_use agent loop -- the same pattern Claude Code, Computer Use API, and MCP clients all use. AI returns structured tool_use blocks, extension executes via unified tool-executor.js, feeds tool_result back, loops until AI emits end_turn.
- Canonical tool registry (tool-definitions.js, 47 tools in JSON Schema) shared between autopilot and MCP server via CJS-to-ESM schema-bridge.ts. MCP manual.ts reduced from 374 to 78 lines.
- Provider format adapter (tool-use-adapter.js) supporting all 6 providers (xAI, OpenAI, Anthropic, Gemini, OpenRouter, Custom) with native tool_use format translation. No more CLI text parsing or 5-strategy response fallbacks.
- Safety mechanisms: $2 cost circuit breaker, 10-minute time limit, 3-strike stuck detection with recovery hint injection, setTimeout-chained iterations for Chrome MV3 service worker compatibility, session persistence for SW resurrection.
- On-demand DOM snapshots and site guides (AI calls tools when needed instead of auto-injection every iteration), sliding window history compression at 80% token budget, Anthropic prompt caching.
- Net -11,184 lines removed (14,489 deleted, 3,305 added). background.js 14K->9.7K, ai-integration.js 5.2K->2.6K. cli-parser.js and cli-validator.js deleted entirely.

**Stats:**

- 33 files changed
- 3,305 lines added, 14,489 lines removed (net -11,184)
- 8 phases, 11 plans, 32 requirements (100% satisfied)
- 12 post-phase bug fix commits (importScripts scope, storage API, keyboard emulator, overlay cleanup, sidepanel notification)

---

## v0.9.11 MCP Tool Quality (Shipped: 2026-03-31)

**Phases completed:** 6 phases, 7 plans, 13 tasks

**Key accomplishments:**

- Main-content-first extraction with 8K MCP cap via findMainContentRoot selector cascade and fixed full flag passthrough
- Quick-extract-then-retry-if-sparse pattern in readPage handler: auto-waits up to 3s for DOM stability on JS-heavy SPA pages returning sparse content
- Content script auto-reconnects port on BF cache restore via pageshow listener, and MCP execute-action returns navigation info instead of cryptic port errors when clicks trigger page transitions
- Header-aware scroll pipeline with fixed/sticky detection, post-scroll compensation, obstruction recovery retries, and accurate fast-path viewport checks
- pressEnter handler now auto-discovers and clicks submit buttons when Enter key dispatch has no observable effect on form elements
- 3-tier cookie consent detection (6 CMPs + generic + text fallback) with reject-preferring dismiss, wired proactively into readPage and smartEnsureReady pipelines
- 5-tier DOM heuristic cascade detecting site search inputs (type=search, role=search, name=q, placeholder, form action) with visibility filtering and Google fallback

---

## v0.9.9 Excalidraw Mastery (Shipped: 2026-03-25)

**Phases completed:** 9 phases, 14 plans, 56 requirements

**Key accomplishments:**

- Fixed 2 gating engine bugs (isCanvasEditorUrl, isCanvasBasedEditor) preventing multi-step Excalidraw automation; added inserttext CLI command, dblclickat CDP tool, and batch CDP direct routing
- Expanded Excalidraw site guide from ~60 to ~893 lines covering all drawing primitives, text entry (3 modes), canvas operations, element editing, connectors/arrows, styling, alignment, export, and natural language diagram generation
- Built universal Canvas Vision system: canvas-interceptor.js wraps CanvasRenderingContext2D prototype at document_start in MAIN world, captures all draw calls (fillRect, fillText, lineTo, arc etc.), and injects structured CANVAS SCENE section into DOM snapshots
- Canvas Vision proven on 3 live apps (Excalidraw, TradingView, Photopea) with architectural coverage for 12/15 canvas apps; AI can now read canvas content without screenshots
- Added pixel-based fallback (color grid + edge detection) for when draw call interception is unavailable
- Fixed 9 systemic issues found during deep testing: debugger contention, guidance truncation (500->3000 for canvas), dynamic page fast-path threshold (3->6 iterations for editors), site guide CLI verb format, batch action CDP routing

---

## v0.9.8 Autopilot Refinement (Shipped: 2026-03-23)

**Phases completed:** 8 phases, 14 plans, 27 tasks

**Key accomplishments:**

- Procedural memory auto-extraction from successful sessions with RECOMMENDED APPROACH injection into autopilot prompts for proven action replay
- Auto-consolidation fires after every 10 sessions or at 80% per-type capacity via fire-and-forget pattern; all dead EPISODIC code removed from 5 files leaving 3 clean memory types
- Cross-domain procedural memory fallback with [from domain] attribution and mid-session domain-change memory refresh
- CDP tools reject out-of-viewport coordinates before execution; stuck recovery suggests opposite interaction paradigm (coordinate vs DOM) based on recent action history
- Progressive 3-stage prompt trimming at 200K char threshold and two-stage CLI parse failure recovery with simplified hint before full reformat
- Direct CDP tool dispatch in background automation loop, bypassing broken nested content-to-background message round-trip that caused 100% false failure reporting
- Dynamic page completion fast-path accepting AI done signals within 2 iterations for media/gaming/canvas tasks, plus 5-minute running session inactivity auto-expiry
- Registered 7 new CDP/interaction tools in CLI_COMMAND_TABLE prompt reference and isValidTool validator for autopilot tool parity with MCP
- 7 new COMMAND_REGISTRY verb entries for CDP/text/file tools plus enhanced dragdrop with MCP-parity optional parameters
- TOOL SELECTION GUIDE decision table and canvas task-type-aware PRIORITY TOOLS injection for autopilot system prompt
- 20 site guides enriched with distilled AUTOPILOT STRATEGY HINTS from v0.9.7 CANVAS and MICRO-INTERACTION diagnostic reports, prepended within 500-char continuation prompt window
- 20 site guides enriched with distilled autopilot strategy hints from SCROLL (phases 67-76) and CONTEXT (phases 77-86) diagnostic reports, prepended within the 500-char continuation prompt window
- 10 dark pattern site guides enriched with AUTOPILOT STRATEGY HINTS from diagnostic DARK-01 through DARK-10 reports -- countermeasure intelligence prepended at top of guidance strings for continuation prompt visibility

---

## v0.9.7 MCP Edge Case Validation (Shipped: 2026-03-22)

**Phases completed:** 50 phases, 100 plans, 183 tasks

**Key accomplishments:**

- CDP-based click_at and drag MCP tools for canvas interaction using Input.dispatchMouseEvent trusted events
- CANVAS-01 validated PASS: Fibonacci retracement drawn on TradingView via CDP click_at (click-click pattern, all 7 levels confirmed)
- CDP click_at and drag tools now accept shift/ctrl/alt modifiers, enabling shift+click multi-select and constrained drag in canvas apps
- Excalidraw site guide created and live MCP test confirms canvas drawing workflow (press_key + cdpDrag) works; multi-select/alignment blocked by MCP server restart needed for modifier params
- CDP mouseWheel tool for coordinate-targeted zoom on Google Maps and canvas apps, dispatching trusted Input.dispatchMouseEvent at specific viewport coordinates
- Google Maps site guide with 15 selectors, zoom/pan/search workflows, and CANVAS-03 diagnostic report (PARTIAL -- tooling ready, live test deferred to human checkpoint)
- Google Solitaire site guide with Klondike card game DOM selectors, click/drag card interaction workflows, and background.js registration
- Live MCP test of Google Solitaire revealing iframe-hosted game requires CDP coordinate tools (click_at/drag), not DOM selectors -- PARTIAL outcome with key architectural discovery
- Photopea site guide with magic wand background removal workflow, Photoshop keyboard shortcuts, and canvas/toolbar DOM split
- CANVAS-05 PARTIAL: Photopea editor launches and CDP clicks register, but entire UI is canvas-rendered with zero DOM elements -- all site guide selectors invalid
- Nike 3D viewer site guide with model-viewer/WebGL canvas selectors, Sketchfab fallback, and half-width horizontal drag rotation workflow for 180-degree shoe rotation
- Live MCP CDP drag on Sketchfab Nike Air Jordan 3D viewer -- rotation confirmed via horizontal drag, PARTIAL outcome human-approved
- Canvas browser game site guide with pixel-coordinate click_at workflows for fully canvas-rendered HTML5/WebGL game buttons
- CANVAS-07 live MCP test with PARTIAL outcome -- CDP click_at confirmed on Poki/Crossy Road game iframe, canvas button targeting blocked by game loading ads
- Online piano site guide for virtualpiano.net with press_key keyboard mapping (A=C4,S=D4,D=E4), DOM click, and click_at canvas fallback workflows for playing E-D-C-D (Mary Had a Little Lamb)
- CANVAS-08 PASS: all 4 notes of Mary Had a Little Lamb (E-D-C-D) played via press_key debuggerAPI on virtualpiano.net with corrected keyboard mapping (t=C4, y=D4, u=E4)
- Online PDF editor site guide with signature placement workflows for Smallpdf/Sejda/DocHub targeting click_at page placement and DOM click toolbar interaction
- CANVAS-09 PARTIAL outcome -- Smallpdf navigation confirmed via live MCP, DOM-based UI verified, signature placement blocked by WebSocket bridge disconnect
- Miro whiteboard site guide with sticky note creation, drag-to-cluster, and full 12-step clustering workflow using CDP canvas events
- CANVAS-10 diagnostic report with SKIP-AUTH outcome: Miro requires sign-in, 14-step test plan documented, 10 autopilot recommendations including Excalidraw fallback
- HTML5 video player site guide with click_at/drag volume slider workflows targeting 37% precision, supporting Vimeo, Dailymotion, JW Player, Plyr, and Video.js
- MICRO-01 diagnostic report with PARTIAL outcome -- click_at/drag tools confirmed capable for volume slider precision, live execution blocked by WebSocket bridge disconnect, 10 autopilot recommendations documented
- click_and_hold CDP tool wired through all three MCP layers (manual.ts, actions.js, background.js) with mousePressed -> holdMs delay -> mouseReleased, plus voice recorder site guide with dual record workflows
- MICRO-02 diagnostic report with PARTIAL outcome -- click_and_hold tool chain verified across all layers, live execution blocked by WebSocket bridge disconnect, 10 autopilot recommendations for hold/toggle recording
- drag_drop MCP tool exposing DOM-level 3-method fallback chain (HTML5 DragEvent, PointerEvent, MouseEvent) with Trello site guide 3-tier drag-and-drop reorder workflow
- MICRO-03 diagnostic report with PARTIAL outcome: drag_drop MCP tool chain verified complete with 3-method fallback, Trello 3-tier workflow ready, live Kanban card reorder blocked by WebSocket bridge disconnect
- select_text_range MCP tool with TreeWalker-based Range API substring selection, plus Wikipedia site guide with highlightSentence workflow for MICRO-04 sentence targeting
- MICRO-04 diagnostic report with PARTIAL outcome: select_text_range tool chain validated against live Albert Einstein article content, sentence boundary detection confirmed (offsets 113-345 for second sentence), live browser execution blocked by WebSocket bridge disconnect
- Color picker site guide with selectCustomHex workflow covering hue strip positioning, shade area reticle targeting, and hex value readout using click_at/drag CDP tools
- MICRO-05 diagnostic report generated with live DOM validation confirming all 6 colorpicker.me selectors, critical hue formula inversion bug found, 10 autopilot recommendations for coordinate-based color picker interaction
- Carousel site guide with scrollCarouselHorizontally workflow covering arrow buttons, scroll_at deltaX, and drag swipe methods with vertical scroll verification
- MICRO-06 carousel diagnostic with PARTIAL outcome -- Target.com carousel selectors validated against live DOM, 10 autopilot recommendations, WebSocket bridge persistent blocker
- Mega-menu site guide with two interaction strategies (DOM hover+click for JS menus, CDP drag+click_at for CSS :hover menus) covering Best Buy, Home Depot, and Lowes
- MICRO-07 PARTIAL: Lowes.com mega-menu DOM validated (click-to-open modal pattern with data-linkid selectors), physical hover/click blocked by WebSocket bridge disconnect
- drop_file MCP tool with synthetic File + DataTransfer + DragEvent dispatch, plus file-upload site guide with simulateFileUpload workflow covering Dropzone.js, react-dropzone, and native HTML5 patterns
- MICRO-08 diagnostic report with PARTIAL outcome: drop_file tool chain validated, DOM selectors tested against three live sites (dropzone.dev, file.io, gofile.io), WebSocket bridge disconnect blocked physical DragEvent dispatch
- drag_variable_speed MCP tool with quadratic ease-in-out timing curve and slider-captcha site guide with solveSliderCaptcha workflow for GEETEST/Tencent/generic slider CAPTCHAs
- MICRO-09 diagnostic report with PARTIAL outcome: drag_variable_speed tool chain validated at code level, GEETEST JS-rendered DOM structure documented, live MCP execution blocked by WebSocket bridge disconnect (persistent blocker Phases 55-65)
- Podcast audio timeline scrub site guide with click_at/drag workflows for seeking to 14:22 (862s), covering 12 podcast platforms with 5-second tolerance verification
- MICRO-10 diagnostic report with PARTIAL outcome -- Buzzsprout DOM validated (native range input, aria-valuemax=2144, 40.2% position calculation), Spreaker Alpine.js SPA confirmed, live CDP execution blocked by WebSocket bridge disconnect
- Twitter site guide updated with scrollAndCountPosts workflow, virtualized DOM recycling documentation, and permalink-based deduplication for extracting the 150th post from infinite scroll feed
- SCROLL-01 PARTIAL: X/Twitter SPA architecture confirmed (245KB React shell, zero server-rendered tweets), all 10 selectors UNTESTABLE without live browser, WebSocket bridge disconnect blocks MCP execution (Phases 55-67)
- Amazon site guide updated with 14-step scrapeAllSearchResults workflow using ASIN-based deduplication for paginated 500+ product name extraction
- SCROLL-02 diagnostic report with PARTIAL outcome -- Amazon paginated selectors validated via HTTP on amazon.in, ASIN deduplication confirmed with 3 cross-page overlaps, live MCP execution blocked by WebSocket bridge disconnect
- GitHub site guide updated with 12-step findLogEntryByDate workflow, 8 activity feed selectors, relative-time datetime parsing, and href-based event deduplication for SCROLL-03
- SCROLL-03 PARTIAL: GitHub activity timeline structure validated, target date (March 18) confirmed via contribution calendar and REST API (5 torvalds commits extracted), live MCP scroll-through-feed blocked by WebSocket bridge disconnect
- Reddit site guide updated with scrollToBottomAndReply workflow, 12 comment selectors for both new Reddit (Shreddit) and old Reddit, load-more-comments expansion pattern, and SKIP-AUTH reply documentation
- SCROLL-04 PARTIAL: old.reddit.com thread validated with 184/3342 server-rendered comments, 73 load-more buttons identified, last comment identified (kalaban101 at 09:36:59Z), reply auth-gated as SKIP-AUTH, live MCP scroll loop blocked by WebSocket bridge disconnect
- pdf.js virtualized viewer site guide with readVirtualizedDocument workflow (14 steps), textLayer text extraction, page virtualization detection, and 4 workflows for scroll-and-read automation
- SCROLL-05 diagnostic report with PARTIAL outcome -- pdf.js viewer validated via HTTP + viewer.mjs source analysis confirming textLayer/virtualization architecture, 4 selector corrections found, 10 autopilot recommendations, live MCP blocked by WebSocket bridge disconnect
- HN site guide with expandAllThreads workflow (12-step paginated expansion cycle), countComments workflow, 14 selectors, and full page navigation documentation for 1000+ comment threads
- SCROLL-06 HN thread expansion diagnostic with HTTP DOM validation across 3 threads (1115, 2530, 2507 comments), finding that HN loads all comments on a single page with no morelink pagination on comment threads
- Airbnb site guide updated with 11-step panMapForListings workflow, 9 map selectors, CDP drag panning strategy, and pin-count verification for SCROLL-07 edge case
- SCROLL-07 diagnostic report with PARTIAL outcome -- Airbnb map container validated via data-testid, listing pins confirmed client-rendered, live CDP drag panning blocked by WebSocket bridge disconnect
- TikTok site guide with scrollFeedForCatVideo workflow using data-e2e selectors, search-page-first auth avoidance, and cat keyword matching in video descriptions
- SCROLL-08 diagnostic report with PARTIAL outcome -- TikTok fully client-rendered SPA returns zero content in server HTML, all 11 data-e2e selectors untestable via HTTP, live MCP blocked by WebSocket bridge disconnect
- SaaS pricing table site guide with 15-step scroll-read-deduplicate extraction workflow, 18+ selectors, and Notion/Airtable targeting for SCROLL-09
- SCROLL-09 diagnostic report with PARTIAL outcome: Notion pricing page fully server-rendered (58 rows in 429KB HTML), generic table selectors 0/6 match, CSS Module prefix matching required, live scroll-read-deduplicate loop blocked by WebSocket bridge disconnect
- News feed site guide with 15-step scrollToYesterdaysArticles workflow, 21 selectors (generic + BBC/CNN/Reuters), and datetime-preferred date detection for SCROLL-10
- SCROLL-10 PARTIAL outcome: BBC News 47 articles validated via HTTP with 15 yesterday articles confirmed from __NEXT_DATA__ JSON, live scroll-stop loop blocked by WebSocket bridge disconnect
- ESPN scoreboard site guide with 17-step monitorLiveScores polling workflow, 20+ selectors (generic + ESPN/CBS/NBA-specific), and snapshot-based change detection for 30-minute sustained monitoring
- CONTEXT-01 diagnostic with PARTIAL outcome: ESPN NBA scoreboard HTTP polling confirmed 3 score changes across 5 polls (Thunder 69->73, Wizards 64->70), 13/27 selectors matched, 2-snapshot retention validated, 30-minute sustained polling blocked by WebSocket bridge disconnect
- Observable notebook editing site guide with forkAndEditCell workflow (15-step fork/tinker + cell edit sequence), verifyCellUnchanged workflow, 16 selectors, CodeMirror 6 interaction patterns, and background.js wiring
- CONTEXT-02 diagnostic with PARTIAL outcome: Observable notebook HTTP-validated (38 cells via __NEXT_DATA__ JSON), all 16 cell selectors client-rendered only, context bloat analysis showing breadth-based mitigation via targeted getText, live cell editing blocked by WebSocket bridge disconnect
- readPdfAndFillForm workflow and cross-site context retention guidance added to pdf-viewer.js for 50-page PDF to web form data transfer
- CONTEXT-03 PARTIAL diagnostic: pdf.js viewer toolbar (6/16 selectors match) and httpbin form (4 text-fillable fields) validated via HTTP, cross-site PDF-to-form chain blocked by WebSocket bridge disconnect
- compareFlightsMultiTab workflow and CONTEXT-04 guidance added to google-travel.js with 18-step multi-tab comparison sequence, tab lifecycle docs, and context bloat mitigation (under 2500 chars for 5 tabs)
- CONTEXT-04 diagnostic report with PARTIAL outcome: Google Flights HTTP-validated with 12+ server-rendered flight suggestions containing prices in aria-labels, 5-tab open_tab/switch_tab/list_tabs workflow documented but blocked by WebSocket bridge disconnect, Context Bloat Analysis showing 97-99% savings from targeted price-only extraction
- Demo-store.js site guide with 14-step multiStepCheckoutWithCorrection workflow targeting 5 auth-free e-commerce stores for CONTEXT-05 zip correction and tax verification
- CONTEXT-05 PARTIAL outcome: SauceDemo validated as best checkout correction target with data-test selectors for postalCode input and tax summary, but all 5 demo stores use flat tax (not zip-dependent), and live MCP execution blocked by persistent WebSocket bridge disconnect
- Support chatbot site guide with 13-step chatbot15TurnSummary workflow, CONTEXT-06 15-turn conversation strategy, iframe-aware widget detection, and context bloat mitigation for multi-turn exchanges
- CONTEXT-06 diagnostic report with PARTIAL outcome: 5 chatbot targets HTTP-validated (tidio.com, crisp.chat, drift.com, hubspot.com, intercom.com), context bloat analysis showing 92-97% savings via compact turn tracking, 10 chatbot-specific autopilot recommendations, zero conversation turns due to WebSocket bridge disconnect
- Two-factor-auth.js site guide with twoFactorMultiTab workflow documenting multi-tab 2FA authentication flow (login, email code fetch, tab switch, code entry) for CONTEXT-07
- CONTEXT-07 diagnostic report with PARTIAL outcome: 5 login targets and guerrillamail validated via HTTP, 9/14 selectors confirmed, 85-95% context savings from compact {authTabId, emailTabId, code} state tracking, live MCP blocked by WebSocket bridge disconnect
- manualWordReplace workflow with 5-phase Ctrl+F/double-click/type strategy for canvas-based Google Docs word replacement without Find/Replace dialog
- SKIP-AUTH diagnostic for Google Doc manual word replacement -- Ctrl+F search delegation saves 83-96% context, all 10 selectors untestable via HTTP due to auth gate
- crm-hr-cross-ref.js site guide with crossReferenceEmployees 12-step workflow, CONTEXT-09 batch processing guidance for 50-name CRM-to-HR cross-reference, selectors for DemoQA and herokuapp, 5 auth-free fallback targets
- CONTEXT-09 PARTIAL diagnostic: HR portal (herokuapp) fully validated with 7/12 selectors confirmed, CRM (DemoQA) client-rendered, DummyJSON fallback CRM with 208 users, 0 cross-reference matches (independent datasets), 84-96% context savings from batch-of-10 extraction with HR caching
- Session expiry site guide with 14-step handleSessionExpiry workflow, 4 detection patterns, and CONTEXT-10 context bloat mitigation via compact task state under 500 chars
- CONTEXT-10 diagnostic with PARTIAL outcome: herokuapp login selectors validated, session expiry via 302 redirect confirmed, 243-byte compact task state under 500-char budget, 10 autopilot recommendations for re-auth handling
- Freeware download site guide with 12-step downloadRealFile workflow, 8 ad detection heuristics, and elimination-based real link identification for DARK-01 dark pattern avoidance
- DARK-01 PARTIAL: SourceForge VLC real download button identified via 8-heuristic elimination (a.button.download.big-text.green), zero server-rendered fake download buttons found, 22 ad/promotional elements classified, live click blocked by WebSocket bridge disconnect
- Cookie consent dark pattern avoidance site guide with 5-CMP detection, 3-tier hidden reject strategy, and 10-step rejectAllCookies workflow for EU news sites
- DARK-02 diagnostic with PARTIAL outcome: 5 EU news sites validated via HTTP confirming Sourcepoint/iubenda/custom CMP detection, 100% JS-rendered consent UIs, 3 selector mismatches, and 10 cookie consent dark pattern autopilot recommendations
- Shuffled-cancel.js site guide with DARK-03 cancelSubscription workflow using text-based button identification for randomized Keep/Cancel positions
- DARK-03 diagnostic with PARTIAL outcome: userinyerface.com cancel modal validated via HTTP with trick-question "Cancel" = keep-intent pattern, Math.random/Shuffle randomization confirmed in app.js, text-based classification validated across 7 targets, and 10 shuffled button autopilot recommendations
- DARK-04 closePopupAd workflow with 3-tier DOM-based close button detection, decoy filtering, iframe handling, and 5 fallback dismissal strategies for camouflaged pop-up ad overlays
- DARK-04 PARTIAL: BusinessInsider aria-label="Close this ad" with SVG close-icon validated via Tier 1 attribute detection, delayed appearance (5s rollUpTimeout) confirmed from ad config JSON, live click blocked by WebSocket bridge disconnect
- DARK-05 adblocker modal bypass site guide with 8-step bypassAdblockerModal workflow, DOM removal and CSS override strategies, 4 detection library patterns, and MutationObserver re-detection handling
- DARK-05 diagnostic report with PARTIAL outcome: 5 live targets HTTP-validated (BlockAdBlock, Forbes, Wired, BusinessInsider, DetectAdBlock), adblocker detection infrastructure confirmed, all modals 100% JavaScript-rendered, DOM removal and CSS override bypass strategies validated against documented library patterns
- DARK-06 site guide with selectCheapestFlight 8-step workflow using numeric price comparison to defeat 7 misleading premium highlighting techniques across 5 airline sites
- PARTIAL outcome diagnostic for misleading premium highlighting: 12 Google Flights + 329 Kayak prices extracted via HTTP, cheapest identified ($56 ATL-TPA, $20 Kayak global), badge manipulation confirmed (Kayak "Best" is composite not cheapest), live click blocked by WebSocket bridge disconnect
- Newsletter-uncheck.js site guide with DARK-07 uncheckNewsletterBeforeSubmit workflow documenting 8 hiding techniques, checkbox classification strategy, and pre-checked newsletter detection using DOM-only analysis
- DARK-07 PARTIAL diagnostic: 2 of 4 targets HTTP-validated, 89% checkbox classification accuracy, 9/11 selectors matched, 10 autopilot recommendations for pre-checked newsletter detection and unchecking
- DARK-08 site guide with findBuriedLoginLink workflow using text-based login vs signup classification across header, footer, hamburger menu, and signup page fallback locations
- DARK-08 diagnostic report with HTTP validation across 5 SaaS homepages confirming login link identification via text/href classification on 4 sites, login:signup ratio 1:3 to 1:5, and CTA asymmetry on 3/4 sites
- DARK-09 skip-ad-countdown site guide with temporal gating workflow using wait_for_element to detect skip button appearance after pre-roll ad countdown, covering YouTube/Dailymotion/Twitch/JW Player/VAST/Vimeo
- DARK-09 diagnostic report with PARTIAL outcome -- HTTP validation confirms ad infrastructure on YouTube/Dailymotion/Twitch (adPlacements JSON, skip feature flags, client-side ad modules) with all skip button elements confirmed 100% client-rendered, wait_for_element validated as correct temporal gating counter-strategy, live execution blocked by WebSocket bridge disconnect
- DARK-10 site guide with extractProtectedText workflow documenting 8 anti-scrape protection types, 6 target sites, and DOM-level bypass strategies using get_dom_snapshot, read_page, and get_text
- DARK-10 PARTIAL diagnostic: Genius lyrics (1.18MB, styled-components sc-HASH) and NYTimes (1.34MB, Emotion css-HASH) both server-render text extractable via structural selectors despite class obfuscation; 3/5 sites blocked by HTTP-level bot detection; live MCP blocked by WebSocket bridge disconnect

---

## v0.9.5 Progress Overlay Intelligence (Shipped: 2026-03-17)

**Delivered:** Enhanced the automation progress overlay with AI-generated live action summaries, smart task-aware progress/ETA estimation, fixed debug feedback leaking to the overlay, and wired debug intelligence back into the AI continuation prompt for better recovery decisions.

**Phases completed:** 36-39 (8 plans across 4 phases)

**Key accomplishments:**

- sanitizeOverlayText strips markdown and clamps to 80 chars, expanded phase labels for sheets workflows
- AI debugger diagnosis and 8-point diagnostic suggestions wired into continuation prompt via slimActionResult + retroactive actionHistory patching
- detectTaskPhase classifies actions into navigation/extraction/writing with phase-weighted progress bands (0-30%, 30-70%, 70-100%)
- Complexity-aware ETA blending with decaying weight formula (70% estimate early, 10% late)
- Multi-site progress shows company completion, Sheets progress shows row completion
- generateActionSummary with 2.5s timeout and 50-entry FIFO cache, fire-and-forget per action
- Task summary line in overlay, recovery state display during debug fallback, 300ms debounce on phase transitions

**Stats:**

- 23 commits
- 37 files changed
- 2,224 lines added, 290 lines removed
- 4 phases, 8 plans, 17 requirements (100% satisfied)
- 1 day (2026-03-17)

**Git range:** `6453f92` -> `22cbf8c`

---

## v0.9.2-v0.9.4 Productivity, Memory & AI Quality (Shipped: 2026-03-17)

**Delivered:** Three milestones shipped in one burst: expanded site intelligence to 7 productivity apps, overhauled Memory tab with unified Task Memories and graph visualization, and added cross-cutting AI perception/action quality improvements (scroll-aware snapshots, 8-point diagnostics, stability detection, parallel debug fallback).

**Phases completed:** 30-35 (17 plans across 6 phases)

**Key accomplishments:**

- Generalized fsbElements pipeline + 7 productivity app site guides (Notion, Calendar, Trello, Keep, Todoist, Airtable, Jira) with keyword routing
- Unified Task Memory schema -- one consolidated recon report per automation session replacing 1-5 fragments
- Polished Memory tab with task cards, collapsible detail views, per-task graph visualization, knowledge graph integration
- Theme-aware rendering with zero hardcoded colors, JSON export/import with duplicate detection
- Scroll-aware DOM snapshots with viewport-complete element inclusion (no arbitrary cap)
- 8-point action diagnostics on every failure with natural language suggestions
- Observation-based stability detection (STABILITY_PROFILES) replacing all hardcoded setTimeout delays
- Hybrid continuation prompt preserving reasoning framework and site guide knowledge across iterations
- Context-aware selector re-resolution with unique match enforcement
- Parallel debug fallback -- heuristic engine and AI debugger fire concurrently on every failure

**Stats:**

- 72 commits
- 56 files changed
- 10,415 lines added, 872 lines removed
- 6 phases, 17 plans, 47 requirements (100% satisfied)
- 2 days (2026-03-16 to 2026-03-17)

**Git range:** `49784b9` -> `505db19`

---

## v10.0 CLI Architecture (Shipped: 2026-03-15)

**Delivered:** Replaced FSB's entire AI-to-extension communication protocol from JSON tool calls to line-based CLI commands, redesigned DOM snapshots as unified markdown with interleaved element refs, and hardened Google Sheets automation with multi-strategy selector resilience -- achieving ~40-60% token reduction and eliminating JSON parsing failures.

**Phases completed:** 15-29 (37 plans across 15 phases)

**Key accomplishments:**

- CLI command protocol: hand-written state-machine tokenizer with 75-command registry parses line-based AI output (click e5, type e12 "hello") into {tool, params} objects -- zero JSON fallback
- Unified markdown DOM snapshot: page text and backtick element refs interwoven (`` `e5: button "Submit"` ``), region headings, 12K char budget -- replacing verbose JSON/YAML with ~40-60% measured token reduction
- Full prompt architecture rewrite: system prompt, continuation, stuck recovery, and 43+ site guide files all speaking CLI grammar exclusively
- Multi-signal completion validator: media/extraction task types, URL pattern matching, DOM snapshot evidence, and consecutive-done escape hatch replacing unreliable AI self-report
- Google Sheets resilience: multi-strategy selector lookup (5 strategies per element), 24 toolbar/menu fsbElements, canvas-aware stuck recovery, keyboard-first interaction patterns, first-snapshot health check
- ~800 lines dead YAML/compact code removed, redundant HTML context eliminated from prompts when markdown present

**Stats:**

- 134 commits
- 237 files changed
- 26,343 lines added, 4,999 lines removed
- 15 phases, 37 plans, 67 requirements (100% satisfied)
- 16 days from start to ship (2026-02-27 to 2026-03-15)

**Git range:** `b5c737d` -> `f92f8b3`

**Tech debt (non-blocking):** 7 items -- stale JSDoc refs to deleted YAML functions (2), dead readPage message handler branch (2), fsbElements annotation format divergence (1), legacy viewport patterns (1), single-slash comment syntax (1)

---

## v9.3 Tech Debt Cleanup (Shipped: 2026-02-23)

**Delivered:** Modularized content.js into 10 logical modules, removed dead code, made ElementCache configurable, fixed AI memory extraction, overhauled memory intelligence with AI enrichment and cost tracking, and split site guides into 43 per-site files with a browsable viewer.

**Phases completed:** 4-8 (17 plans total)

**Key accomplishments:**

- Modularized 13K-line content.js into 10 modules with FSB._modules tracking and badge error indicator
- Removed waitForActionable dead code (158 lines), orphaned files, and unused UI helpers
- Made ElementCache configurable via Options page with preset dropdown and live storage updates (default 200)
- Fixed UniversalProvider constructor so AI memory extraction actually runs when configured
- AI enrichment pipeline for all memory types with cross-site pattern learning and expandable detail panels
- Split 9 site guide categories into 43 per-site files with browsable viewer in Memory tab

**Stats:**

- 100 files changed
- 21,950 lines added, 18,960 lines removed
- 5 phases, 17 plans, 9 requirements (100% satisfied)
- 3 days from start to ship (2026-02-21 to 2026-02-23)

**Git range:** `8249bf3` -> `ad5a4bd`

**Known issues:** Site Guides Viewer displays as custom accordion instead of memory-style list with mind maps (UAT blocker, deferred)

---

## v9.0.2 AI Situational Awareness (Shipped: 2026-02-18)

**Delivered:** Complete AI situational awareness -- the AI sees full page context, remembers what it did, detects changes accurately, and knows when the task is done. Plus session continuity, history, replay, career workflows, memory tab, and Google Docs formatted paste.

**Phases completed:** 1-10 (21 plans total)

**Key accomplishments:**

- 3x DOM context delivery (5K -> 15K prompt budget) with priority-aware truncation and task-adaptive content modes
- Multi-signal completion verification replacing unreliable AI self-report (task-type validators, weighted scoring, critical action registry)
- Structured change detection replacing coarse hash comparison (4-channel DOM signals, structural fingerprints, false stuck elimination)
- Resilient conversation memory with hard facts, compaction fallback, and long-term memory retrieval
- Session continuity, history UI, and action replay across conversations
- Career page search with Google Sheets data entry workflows
- Memory tab population with episodic/semantic/procedural memories

**Stats:**

- 194 files created/modified
- 28,148 lines added, 1,366 lines removed
- 32,578 LOC across core JavaScript files
- 10 phases, 21 plans, 22 requirements (100% satisfied)
- 4 days from start to ship (2026-02-14 to 2026-02-18)
- 10/10 systemic issues resolved

**Git range:** `fab9fe0` -> `e0ed6d5`

---

## v0.9 Reliability Improvements (Shipped: 2026-02-14)

**Delivered:** Transformed FSB from unreliable "hit or miss" automation into a precise single-attempt execution engine with visual feedback, smart debugging, and fast execution.

**Phases completed:** 1-11 (24 plans total, Phase 10 deferred)

**Key accomplishments:**

- Selector generation with uniqueness scoring and coordinate fallback when all selectors fail
- Element readiness checks (visibility, interactability, obscuration) before every action
- Orange glow visual highlighting and progress overlay using Shadow DOM isolation
- 3-stage element filtering pipeline reducing DOM from 300+ to ~50 relevant elements
- Action verification with state capture, expected-effects validation, and alternative selector retry
- Debugging infrastructure: action recording, element inspector, session replay, log export
- Execution speed optimization: element caching, outcome-based delays, parallel prefetch, batch execution
- Control panel cleanup: removed dead UI code, wired Debug Mode and Test API settings

**Stats:**

- 18 files created/modified
- 43,283 lines of JavaScript
- 11 phases, 24 plans
- 2 days from start to ship (2026-02-03 to 2026-02-04)

**Git range:** `feat(01-01)` to `fix(debug)`

**What's next:** Smart multi-tab management, advanced CAPTCHA integration, workflow templates

---

## v9.4 Career Search Automation (Shipped: 2026-02-28)

**Delivered:** Autonomous career search across 30+ company websites with formatted Google Sheets output. Parsed 38 crowd session logs into site intelligence (sitemaps + site guides), built single-site and multi-site career search workflows, and added Google Sheets data entry with professional formatting.

**Phases completed:** 9-14.3 (18 plans across 9 phases in v9.4 scope)

**Key accomplishments:**

- Session log parser converts 38 crowd logs into per-company site guides with confidence-scored selectors and direct career URLs
- 5 ATS base guides (Workday, Greenhouse, Lever, iCIMS, Taleo) covering 15+ companies with stability-classified selectors
- Single-company career search: navigate site, search, extract jobs (company, title, apply link, date, location, description)
- Multi-site orchestration: sequential 2-10 company search with chrome.storage persistence, deduplication, and progress reporting
- Google Sheets output via Name Box + Tab/Enter pattern with bold colored headers, frozen row, auto-sized columns, and context-aware sheet naming
- Batch action execution engine: AI returns multiple actions per turn with DOM-based completion detection between each, plus timezone/country locale injection

**Stats:**

- 20 commits
- 9 phases (6 main + 3 hotfix), 18 plans
- 21 requirements defined, 21 satisfied (100%)
- 4 days from start to ship (2026-02-23 to 2026-02-27)

**Git range:** `bd0b1ef` -> `19bad00`

**Known issues:** ACCEL-01, ACCEL-02, ACCEL-05 traceability table not updated to Complete (requirements checked off in body)

---
