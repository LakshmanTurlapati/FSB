# Roadmap: FSB (Full Self-Browsing)

## Status

Active milestone: **v0.9.50 Autopilot Refinement (MCP-Parity)** — roadmap created 2026-05-02. First phase: 224 (continues numbering from v0.9.49's Phase 223).

## Milestones

- 🟡 **v0.9.50 Autopilot Refinement (MCP-Parity)** -- in progress (Phases 224-227)
- ✅ **v0.9.49 Remote Control Rebrand & Showcase Metrics Wire-up** -- shipped 2026-05-02 (Phase 223 + Sync consolidation; archive: [v0.9.49-ROADMAP.md](milestones/v0.9.49-ROADMAP.md))
- ✅ **v0.9.48 Angular 20 Migration** -- shipped 2026-05-02 (deadline 2026-05-19 met 17 days early)
- ✅ **v0.9.47 Workspace Reorganization** -- shipped 2026-05-02
- ✅ **v0.9.46 Site Discoverability (SEO + GEO)** -- shipped 2026-05-02
- ✅ **v0.9.45rc1 Sync Surface, Agent Sunset & Stream Reliability** -- shipped 2026-04-29
- ✅ **v0.9.40 Session Lifecycle Reliability** -- shipped 2026-04-25
- ✅ **v0.9.36 MCP Visual Lifecycle & Client Identity** -- shipped 2026-04-24
- ✅ **v0.9.35 MCP Plug-and-Play Reliability** -- shipped 2026-04-24
- ✅ **v0.9.34 Vault, Payments & Secure MCP Access** -- shipped 2026-04-22

## Phases

### v0.9.50 Autopilot Refinement (MCP-Parity)

- [ ] **Phase 224: Audit & Verification Baseline** -- Side-by-side autopilot vs MCP tool surface inventory, baseline `run_task` log capture with failure categorization, and reproducible operator verification recipe
- [ ] **Phase 225: Tools Alignment** -- Adopt MCP-style annotations, reconcile parameter shapes, achieve routing parity (CDP click_at, click_and_hold, drag, scroll_at), and audit autopilot-only/MCP-only tool gaps
- [ ] **Phase 226: Prompt Refinement** -- Tool-selection decision rules for ambiguous pairs, strengthened element-targeting guidance, and DOM/element-ref context formatting audited against MCP-driving agents
- [ ] **Phase 227: Target Precision** -- Selector/element-ref disambiguation pass and targeted fixes for misclick patterns surfaced by Phase 224 baseline

## Phase Details

### v0.9.50 Phase Details

#### Phase 224: Audit & Verification Baseline
**Goal**: Establish the evidence base — what autopilot's tool surface looks like vs MCP, what's actually failing in the wild, and how the operator will repeatably verify each subsequent phase
**Depends on**: Nothing (first phase of milestone)
**Requirements**: AUDIT-01, AUDIT-02, VERIFY-01, VERIFY-02
**Success Criteria** (what must be TRUE):
  1. Operator can read a single audit document listing every autopilot tool side-by-side with its MCP counterpart, with annotation/parameter/routing gaps explicitly called out
  2. A baseline `run_task` log run against the fixed prompt set exists on disk, with each outcome categorized (element / tool-choice / completion / infra / other)
  3. Operator can re-run the verification recipe end-to-end from documentation alone (no tribal knowledge), scoring outcomes by category
  4. Logs from any autopilot failure are sufficient to attribute the failure to a category without adding instrumentation per run
  5. GUARD-01 holds: every Validated capability in PROJECT.md still operational after this phase (smoke verified); GUARD-02 holds: `npm test` green; GUARD-03 holds: no autopilot tools removed
**Plans**: 3 plans
- [ ] 224-01-PLAN.md — Tool Surface Audit (AUDIT-01)
- [ ] 224-02-PLAN.md — Verification Recipe + Logging Inventory (VERIFY-01, VERIFY-02)
- [ ] 224-03-PLAN.md — Baseline Run Capture (AUDIT-02)

#### Phase 225: Tools Alignment
**Goal**: Autopilot's tool layer matches MCP's contract shape — annotations, parameter shapes, and reachable execution paths — so the same prompt drives the same effective behavior
**Depends on**: Phase 224 (uses AUDIT-01 gap list as scope and AUDIT-02 failures to prioritize)
**Requirements**: TOOLS-01, TOOLS-02, TOOLS-03, TOOLS-04
**Success Criteria** (what must be TRUE):
  1. Every autopilot tool definition that appeared weaker in the audit now carries MCP-style purpose / when-to-use / examples / parameter descriptions
  2. Parameter shapes and defaults for any tool present in both surfaces are byte-aligned (or divergence has a documented justification)
  3. Autopilot can reach CDP click_at, click_and_hold, drag, scroll_at execution paths via its own tool layer (verified by `run_task` against prompts that previously failed in baseline)
  4. Each autopilot-only tool retained has a documented justification; each MCP-only capability that closes a known gap is either surfaced to autopilot or has a recorded deferral note
  5. Re-running the Phase 224 verification recipe shows reduced failures in the tool-choice and routing categories without new failures in any other category
  6. GUARD-01 holds: every Validated capability still operational (smoke verified); GUARD-02 holds: `npm test` green; GUARD-03 holds: no tool removals without explicit deprecation note + operator confirmation
**Plans**: 3 plans
- [x] 225-01-PLAN.md — MCP autopilot reliability (run_task return-on-completion + in-flight session lookup)
- [ ] 225-02-PLAN.md — MCP read-only surface gaps (get_page_snapshot/get_site_guide) + autopilot search_memory exposure
- [x] 225-03-PLAN.md — CDP drag reachability verification + conditional wiring fix

#### Phase 226: Prompt Refinement
**Goal**: Autopilot's system prompt and context formatting drive correct tool selection and element targeting at parity with what MCP-driving external agents see
**Depends on**: Phase 225 (prompts reference the now-aligned tool contracts) and Phase 224 (uses baseline failures to focus guidance)
**Requirements**: PROMPT-01, PROMPT-02, PROMPT-03
**Success Criteria** (what must be TRUE):
  1. Tool-selection guide in the system prompt contains explicit decision rules for click vs CDP click_at, type vs press_enter, scroll vs scroll_at, and any other ambiguous pairs surfaced by AUDIT-02
  2. Element-targeting guidance addresses parent/nested confusion and label/control disambiguation with examples
  3. DOM snapshot and element-ref formatting matches the clarity MCP-driving agents see (or divergence is documented with rationale)
  4. Re-running the Phase 224 verification recipe shows reduced failures in the tool-choice and element categories
  5. GUARD-01 holds: every Validated capability still operational (smoke verified); GUARD-02 holds: `npm test` green; GUARD-03 holds: no autopilot tools removed
**Plans**: 2 plans
- [ ] 226-01-PLAN.md — System prompt rules (no-shortcut-escapes, pagination-before-scroll, no-progress-toward-goal, action-matches-request self-check)
- [ ] 226-02-PLAN.md — Tool annotations + dropdown two-click pattern (select_option native-only, click two-click pattern, execute_js not-a-shortcut)

#### Phase 227: Target Precision (REINTERPRETED → Stuck-Detection Enhancement)
**Goal**: Phase 224 baseline showed element-targeting clean; reinterpret to add code-side enforcement of the no-progress-toward-goal heuristic so PROMPT-05 / PROMPT-10 / EDGE-11 long-loop failures terminate cleanly with attributed reason codes
**Depends on**: Phase 226 (prompt baseline stable) and Phase 224 (uses logged loop patterns + LOGGING-INVENTORY gap C-1)
**Requirements**: TARGET-02 (TARGET-01 explicitly deferred per CONTEXT — no element-targeting evidence in baseline)
**Success Criteria** (what must be TRUE):
  1. Consecutive-action-repetition detector fires at warn=3 / force-stop=5 with outcomeDetails.reason='stuck_action_repetition'
  2. Goal-progress heuristic (windowed unique-state-vector) fires with outcomeDetails.reason='stuck_no_goal_progress' when no progress in last N iterations (default 8, per-task-type override)
  3. Existing DOM-hash stuck-detection preserved and attributed as 'stuck_dom_hash'
  4. PROMPT-05 / PROMPT-10 / EDGE-11 baseline reruns terminate <50 actions with new reason codes; PASS prompts (01,02,04,06,07,09,13) show no false-positive stuck fires
  5. GUARD-01 holds: every Validated capability still operational (smoke verified); GUARD-02 holds: `npm test` green; GUARD-03 holds: no autopilot tools removed
**Plans**: 2 plans
- [x] 227-01-PLAN.md — Action-repetition detector + outcome-reason attribution (warn@3 / force-stop@5)
- [x] 227-02-PLAN.md — Goal-progress heuristic (unique-state-vector, task-type override, action-repetition precedence)

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

### Carry-over from prior milestones

- Deferred Angular migration requirements (DASH-08 through MIGR-03) remain parked from v0.9.29
- Live UAT for v0.9.34 vault behavior and MCP payment approve/deny/delayed approval remains accepted validation debt
- Phase 999.1 backlog (`mcp-tool-gaps-click-heuristics`) parked
- Phase 209 has 7 human_needed UAT items (live CDP click/keyboard/scroll delivery)

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 224. Audit & Verification Baseline | 0/3 | Planned | - |
| 225. Tools Alignment | 2/3 | In Progress|  |
| 226. Prompt Refinement | 0/2 | Planned | - |
| 227. Target Precision | 2/2 | Complete   | 2026-05-03 |

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
*Roadmap updated for v0.9.50: 2026-05-02*
*First phase: 224 (continues numbering from v0.9.49's Phase 223)*
