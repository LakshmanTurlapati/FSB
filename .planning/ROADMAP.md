# Roadmap -- v0.9.62 Implicit Visual Session Contract

**Milestone:** v0.9.62 Implicit Visual Session Contract
**Branch:** `refinements`
**Granularity:** fine
**Phases:** 7 (numbered 254-260; continues from v0.9.61 last phase 253)
**Coverage:** 27/27 v1 requirements mapped
**Created:** 2026-05-11

---

## Goal

Make the MCP visual-session signal implicit on every action tool call so external agents stop missing it. Replace the explicit `visual_session` start/end MCP tools (v0.9.36 / v0.9.0 contract) with a required field bundle (`visual_reason` + `client` + optional `is_final`) on every action tool, a sliding 60-second death timer that re-arms on each carrying call, and an explicit `is_final: true` signal that clears the overlay immediately. MCP manual tools only -- autopilot `run_task` is out of scope.

## Hard Constraints (apply to every phase)

- MCP manual tools only. Autopilot `run_task` overlay management stays untouched (it already manages its own lifecycle internally).
- Read-only MCP tools (`get_text`, `read_page`, `list_tabs`, `get_dom_snapshot`, `get_page_snapshot`, `get_attribute`, `get_logs`, `get_task_status`, `search_memory`, `wait_for_element`, `wait_for_stable`, etc.) MUST NOT carry the new fields; their input schemas remain byte-for-byte unchanged.
- Field-bundle key names are: `visual_reason` (required string), `client` (required, allowlisted), `is_final` (optional boolean). Finalised in Phase 254 plan and referenced everywhere downstream by the same names.
- Badge allowlist reuses the existing v0.9.36 shared server/extension validator. No freeform `client` strings. No new badge labels added in this milestone.
- Sliding-window state is per-tab; cross-tab / cross-window coordination remains deferred (carried over from v0.9.36 deferred list).
- MV3 SW-eviction safety follows the v0.9.36 visual-session persistence pattern using `chrome.storage.session`.
- Existing v0.9.60 ownership-gated rejection (`TAB_NOT_OWNED`) wins over visual-session merge: a cross-agent action on an owned tab rejects at the dispatch gate before any session state is touched.
- ASCII-only diagnostics and migration error bodies; no emojis anywhere in code, tests, docs, CHANGELOG, or logs.
- Package version bump (`fsb-mcp-server` 0.8.0 -> 0.9.0) is part of this milestone; final `npm publish` remains user-gated (mirrors v0.9.60 posture).

## Hard Gate

**Phase 254 is a hard gate.** Phases 255-260 cannot start until Phase 254 lands. The canonical action-tool list (~31 tools), the field-bundle key names (`visual_reason` / `client` / `is_final`), the badge-allowlist reuse decision, and the typed error names (`VISUAL_FIELDS_REQUIRED`, `BADGE_NOT_ALLOWED`, `TOOL_REMOVED`) must be pinned in `.planning/` before any schema, lifecycle, or doc work begins. Every downstream phase references these names verbatim.

---

## Phases

- [ ] **Phase 254: Contract Foundation (action-tool list + field-bundle naming + typed errors)** -- Pin the canonical action-tool list, field-bundle key names, badge-allowlist reuse decision, and typed-error names before any code or doc work.
- [x] **Phase 255: Schema Enforcement on Action Tools** -- Apply the required field bundle to every action tool in the canonical list and enforce typed validation; leave read-only tool schemas untouched. (completed 2026-05-11)
- [ ] **Phase 256: Sliding-Window Lifecycle (implicit start + 60s death timer + SW-eviction replay)** -- Make the first action call implicitly start a visual session per-tab, re-arm the 60s timer on every carrying call, auto-clear after silence, and survive MV3 service-worker eviction.
- [ ] **Phase 257: Explicit Completion (`is_final` immediate clear)** -- Honour `is_final: true` as an immediate post-change-report clear; keep redundant final signals idempotent.
- [ ] **Phase 258: Removal, Migration Errors, Package 0.9.0** -- Remove the old explicit `visual_session` start/end tools, return `TOOL_REMOVED` with migration pointer, bump `fsb-mcp-server` 0.8.0 -> 0.9.0 (server.json + version-parity test), and write the CHANGELOG/mcp-README breaking-change recipe.
- [ ] **Phase 259: Test Rewrites & CI Lock** -- Rewrite `tests/mcp-visual-tick-contract.test.js` for the new implicit contract end-to-end, add `TOOL_REMOVED` + required-field + read-tool no-op tests, and wire everything into `npm test` so `ci / all-green` gates the contract.
- [ ] **Phase 260: Skill Docs Migration** -- Update `skills/FSB Skill/USAGE.md`, `references/visual-session-lifecycle.md`, `references/tool-decision-tree.md`, and the SKILL.md body so callers see the new contract on the surfaces they read first; canonical action-tool list referenced.

---

## Phase Details

### Phase 254: Contract Foundation (action-tool list + field-bundle naming + typed errors)

**Goal**: A pinned, single-source-of-truth contract document under `.planning/` (e.g. `.planning/v0.9.62-CONTRACT.md`) that locks the canonical action-tool list, the field-bundle key names, the badge-allowlist reuse decision, and the typed-error names -- so every downstream phase references the same names verbatim and the migration recipe in CHANGELOG can point at a stable artifact.

**Depends on**: Nothing (gate phase; first phase of milestone).

**Requirements**: CONTRACT-01.

**Success Criteria** (what must be TRUE):
  1. `.planning/v0.9.62-CONTRACT.md` (or equivalent canonical artifact) exists and lists the 31 action tools in the canonical scope verbatim: `click`, `type_text`, `navigate`, `scroll`, `drag`, `select_option`, `press_key`, `press_enter`, `drag_drop`, `hover`, `focus`, `clear_input`, `check_box`, `drop_file`, `click_and_hold`, `double_click`, `right_click`, `click_at`, `scroll_at`, `double_click_at`, `drag_variable_speed`, `set_attribute`, `insert_text`, `search`, `refresh`, `go_back`, `go_forward`, `open_tab`, `close_tab`, `switch_tab`, `back`.
  2. The same document pins the field-bundle key names exactly as `visual_reason` (required string), `client` (required, allowlisted), `is_final` (optional boolean); records that the `client` allowlist source-of-truth is the shared v0.9.36 server/extension validator; and pins the three typed-error names exactly as `VISUAL_FIELDS_REQUIRED`, `BADGE_NOT_ALLOWED`, `TOOL_REMOVED`.
  3. The list of read-only MCP tools whose schemas MUST remain unchanged is enumerated alongside the canonical action-tool list, so Phase 255 has a "do not touch" allowlist to assert against in tests.
  4. The artifact is closed with an explicit "contract pinned" sign-off so Phases 255-260 can start without re-deriving names; every downstream phase that references field names or typed errors cites this document.

**Plans**: 1 plan
  - [ ] 254-01-PLAN.md -- Write `.planning/v0.9.62-CONTRACT.md` (all six locked decisions, verification diff, sign-off) and commit on branch `refinements`

---

### Phase 255: Schema Enforcement on Action Tools

**Goal**: Every action tool in the canonical list accepts and requires the new field bundle in its MCP input schema; missing or invalid fields fail loud with the pinned typed errors before the underlying action executes; read-only tools stay byte-for-byte unchanged.

**Depends on**: Phase 254 (canonical action-tool list, field-bundle key names, typed-error names, read-only do-not-touch list all pinned).

**Requirements**: CONTRACT-02, CONTRACT-03, CONTRACT-04, CONTRACT-05.

**Success Criteria** (what must be TRUE):
  1. Every action tool in the Phase 254 canonical list (all 31 tools) declares `visual_reason` (required string) and `client` (required, allowlisted) in its MCP input schema, plus optional `is_final` (boolean); discoverable via the MCP server `tools/list` response.
  2. Calling any action tool without `visual_reason` or without `client` returns a typed `VISUAL_FIELDS_REQUIRED` error and the underlying browser action does not execute (no DOM mutation, no `change_report`, no overlay state change).
  3. Calling any action tool with a `client` value not present in the v0.9.36 shared allowlist returns a typed `BADGE_NOT_ALLOWED` error and the underlying action does not execute; the validator is the same source-of-truth shared with v0.9.36 visual sessions (not a per-tool duplicate).
  4. Every read-only MCP tool listed in Phase 254 retains a byte-for-byte unchanged input schema; calling them with the existing pre-v0.9.62 argument shape continues to work without `visual_reason` / `client`, and adding those fields to a read tool call is silently ignored or rejected per the read-tool spec (the schema MUST NOT have grown).

**Plans**: 4 plans
  - [x] 255-01-PLAN.md -- Declare VISUAL_SESSION_FIELDS fragment + withVisualSessionFields helper in mcp/ai/tool-definitions.cjs, apply the helper to the canonical 36 action tools, flip _readOnly: true on wait_for_element / wait_for_stable, mirror byte-identically to extension/ai/tool-definitions.js (Wave 1; CONTRACT-02 + CONTRACT-05)
  - [x] 255-02-PLAN.md -- Add VISUAL_FIELDS_REQUIRED + BADGE_NOT_ALLOWED to CODE_ONLY_ERROR_KEYS and buildLayeredDetail switch arms in mcp/src/errors.ts (Wave 1; CONTRACT-03 + CONTRACT-04 error-name registration)
  - [x] 255-03-PLAN.md -- Wire validateVisualSessionFields + stripVisualSessionFields into the dispatch chokepoint in mcp/src/tools/manual.ts; widen exports in mcp/src/tools/visual-session.ts so the shared v0.9.36 allowlist helpers are importable (Wave 2; CONTRACT-03 + CONTRACT-04 runtime enforcement; depends on 01 + 02)
  - [x] 255-04-PLAN.md -- Author tests/visual-session-schema-lock.test.js asserting schema-shape invariants for the 36 action tools and 15 read-only tools plus dispatcher-rejection invariants for both typed errors; wire into root npm test chain (Wave 2; CONTRACT-02 + CONTRACT-03 + CONTRACT-04 + CONTRACT-05 CI lock; depends on 01 + 02 + 03)

---

### Phase 256: Sliding-Window Lifecycle (implicit start + 60s death timer + SW-eviction replay)

**Goal**: An action-tool call from an MCP agent on a tab is sufficient to bring the overlay up with the supplied reason/client/badge; subsequent action calls from the same agent re-arm a sliding 60-second death timer; prolonged silence auto-clears the overlay; the lifecycle survives MV3 service-worker eviction by replaying from `chrome.storage.session`; ownership gating from v0.9.60 still wins over any session merge.

**Depends on**: Phase 255 (schema enforcement -- every action tool now carries the bundle and rejects malformed payloads before reaching lifecycle code).

**Requirements**: TIMEOUT-01, TIMEOUT-02, TIMEOUT-03, TIMEOUT-04, TIMEOUT-05.

**Success Criteria** (what must be TRUE):
  1. The first action-tool call from an MCP agent on a tab with no active visual session brings up the overlay with the supplied `visual_reason` and `client`/badge -- no prior explicit `start_visual_session` call is required; the visible overlay state matches what v0.9.36 produced via explicit start.
  2. Each subsequent action call from the same agent on the same tab re-arms the 60-second death timer; calling repeatedly within 60s keeps the overlay alive indefinitely with no flicker between calls.
  3. After 60 seconds with no further carrying tool call, the overlay glow, badge, and client label clear automatically -- without requiring any explicit end call -- and a follow-up read-only tool call (e.g. `read_page`) does NOT re-arm the timer because read tools do not carry the bundle.
  4. Killing and restarting the MV3 service worker mid-session (cold/warm boot or 30s eviction) restores the same owner, badge, and remaining-deadline state by replaying from `chrome.storage.session`; the overlay either resumes seamlessly or correctly times out by the original deadline -- the death-timer arithmetic does not silently reset on SW wake.
  5. An action call from a different MCP agent on a tab already owned by another agent rejects with the existing v0.9.60 `TAB_NOT_OWNED` typed error at the dispatch gate before any visual-session state is read or written; the previous agent's overlay/badge is not silently merged or hijacked.

**Plans**: TBD

---

### Phase 257: Explicit Completion (`is_final` immediate clear)

**Goal**: Callers signalling task completion via `is_final: true` on a tool call get the overlay cleared as soon as the tool's `change_report` resolves -- not 60 seconds later -- so user-visible feedback ends in step with the agent's logical completion; redundant final signals are no-ops.

**Depends on**: Phase 256 (sliding-window lifecycle in place -- `is_final` is a controlled early-exit on top of it, not a parallel mechanism).

**Requirements**: COMPLETE-01, COMPLETE-02, COMPLETE-03.

**Success Criteria** (what must be TRUE):
  1. An action-tool call with `is_final: true` accepted at the schema layer; the action executes, the `change_report` resolves, and immediately afterward the overlay glow, badge, and client label clear -- no 60-second wait.
  2. A user watching the page sees the overlay disappear in step with the final action's visible effect (the click/type/navigate result lands and the overlay vanishes within the same animation frame budget the v0.9.36 explicit-end pattern provided); the death timer is cancelled, not merely re-armed.
  3. Calling an action tool with `is_final: true` on a tab that has no active visual session (e.g. first call of a fresh sequence, or after a previous auto-clear) is a no-op for the lifecycle (no error thrown, no overlay flash) -- the action itself still executes normally; redundant final signals from confused callers do not pollute logs with typed errors.

**Plans**: TBD

---

### Phase 258: Removal, Migration Errors, Package 0.9.0

**Goal**: The old explicit `visual_session` start/end MCP tools (v0.9.36 / v0.9.0 contract) are deleted from the server registry; any caller invoking them gets a typed `TOOL_REMOVED` error pointing at the new contract; `fsb-mcp-server` is bumped 0.8.0 -> 0.9.0 in lockstep with `server.json` and `tests/version-parity.test.js`; CHANGELOG and `mcp/README.md` capture the breaking change with a concrete before/after recipe. Lands AFTER Phases 255-257 so callers always have a working path forward (avoids a window where neither contract works).

**Depends on**: Phases 255, 256, 257 (the new implicit contract is wired end-to-end before the old tools are removed -- per dependency rule #3, no window where neither works).

**Requirements**: MIGRATION-01, MIGRATION-02, MIGRATION-03, MIGRATION-04, MIGRATION-05.

**Success Criteria** (what must be TRUE):
  1. The MCP server's `tools/list` response no longer advertises the v0.9.36 explicit `visual_session` start/end tool names; the underlying tool registrations are removed (not commented out) from the server source; dispatch of those names goes through a dedicated removed-tool handler, not generic "unknown tool".
  2. An MCP client invoking either of the removed tool names by name receives a typed `TOOL_REMOVED` error whose body explicitly names the new contract (required `visual_reason` / `client` field bundle on action tools, implicit start, sliding 60s window, `is_final: true` for early clear) and points at the v0.9.62 migration recipe location (CHANGELOG section + `mcp/README.md` visual-session section).
  3. `CHANGELOG.md` (or `mcp/CHANGELOG.md` -- whichever holds the package changelog) records v0.9.62 as a breaking change with a concrete before/after recipe: an explicit `start_visual_session(...) -> click(...) -> end_visual_session(...)` example rewritten as the new `click(..., visual_reason="...", client="...", is_final=true)` single-call form.
  4. `mcp/README.md` and `skills/FSB Skill/USAGE.md` flag the contract change at the top of their visual-session sections (USAGE.md content lands in Phase 260; this phase only requires the `mcp/README.md` flag and the section anchor that USAGE.md will link to).
  5. `fsb-mcp-server` package version is bumped 0.8.0 -> 0.9.0 across `package.json`, `server.json`, and `tests/version-parity.test.js`; running `npm test` against the bumped tree passes the version-parity assertion; final `npm publish fsb-mcp-server@0.9.0` remains user-gated (mirrors v0.9.60 posture and is recorded as such in the milestone close, not blocked on by this phase).

**Plans**: TBD

---

### Phase 259: Test Rewrites & CI Lock

**Goal**: The new implicit contract is locked behind the existing `ci / all-green` PR gate. `tests/mcp-visual-tick-contract.test.js` is rewritten end-to-end for the new contract; new tests cover `TOOL_REMOVED`, required-field validation across every action tool in the canonical list, and the read-tool no-op guarantee; everything runs via root `npm test`.

**Depends on**: Phase 258 (the full new contract -- schema + lifecycle + completion + removal + package version -- is wired before tests assert against it).

**Requirements**: TEST-01, TEST-02, TEST-03, TEST-04, TEST-05.

**Success Criteria** (what must be TRUE):
  1. `tests/mcp-visual-tick-contract.test.js` is rewritten and asserts the new implicit contract end-to-end: required fields enforced, first call brings up the overlay, subsequent calls re-arm the 60s window, prolonged silence auto-clears, `is_final: true` clears immediately, badge allowlist enforced, and MV3 SW-eviction replay restores deadline/owner. No assertions remain that depend on the removed explicit `visual_session` start/end tool names.
  2. A `TOOL_REMOVED` contract test confirms that calling either removed tool name returns the typed `TOOL_REMOVED` error and that the error body contains the migration recipe pointer (matched on stable substrings, not whole-string equality).
  3. A required-field validation test enumerates every action tool in the Phase 254 canonical list and confirms that omitting `visual_reason` or `client` produces the `VISUAL_FIELDS_REQUIRED` typed error and that the underlying action does not execute (no DOM mutation, no `change_report`, no overlay change observed on the test fixture).
  4. A read-tool no-op test enumerates the Phase 254 read-only tool list and confirms each tool's input schema in `tools/list` has not grown `visual_reason` / `client` fields, and that calling each read tool with its existing pre-v0.9.62 argument shape succeeds unchanged.
  5. All new and rewritten tests run as part of the root `npm test` chain (no separate harness), pass locally, and a draft PR touching any MCP server tool or visual-session module triggers them under the `ci / all-green` gate.

**Plans**: TBD

---

### Phase 260: Skill Docs Migration

**Goal**: The OpenClaw FSB skill surfaces (`skills/FSB Skill/USAGE.md` and `references/`) match the v0.9.62 contract -- callers reading USAGE.md, the visual-session lifecycle reference, or the tool decision tree get the new field-bundle / sliding-window / `is_final` story and zero residual instructions for the removed explicit `visual_session` start/end tools. SKILL.md body (or supplementary doc) carries the canonical action-tool list pointer so callers can answer "do I need to send the fields?" by lookup, not by trial.

**Depends on**: Phase 258 (`mcp/README.md` section anchor and CHANGELOG migration recipe exist for USAGE.md to link to). Can run in parallel with Phase 259 -- docs do not block tests and tests do not block docs -- but landing both before milestone close keeps the skill USAGE.md consistent with the test-locked behaviour.

**Requirements**: DOCS-01, DOCS-02, DOCS-03, DOCS-04.

**Success Criteria** (what must be TRUE):
  1. `skills/FSB Skill/USAGE.md` is updated for the new contract: all v0.9.36 / v0.9.0 instructions to call explicit `start_visual_session` / `end_visual_session` are removed; at least one worked example shows a sample action-tool call carrying `visual_reason` and `client`, plus a second example showing `is_final: true` on the last action of a task; a banner / callout at the top of the visual-session section flags the v0.9.62 breaking change and links to `CHANGELOG.md` + `mcp/README.md`.
  2. `skills/FSB Skill/references/visual-session-lifecycle.md` is rewritten for the implicit-lifecycle pattern: explains that the bundle is required on every action tool, that the 60s sliding window re-arms per call, that `is_final` clears immediately, and that read tools do not carry the bundle -- with one explicit example contrasting an action-tool call (carries bundle) against a read-tool call (does not).
  3. `skills/FSB Skill/references/tool-decision-tree.md` is updated so any branch that lands on an action tool tells the caller to supply `visual_reason` + `client` (and to consider `is_final: true` on the last action of a task); the read-first guidance for `read_page` / `get_dom_snapshot` / `get_page_snapshot` is preserved unchanged, and the tree still references only tool names that exist in `mcp/ai/tool-definitions.cjs` (with the removed explicit visual-session tools no longer present anywhere in the tree).
  4. SKILL.md body (or a supplementary doc under `references/` that the body links to) carries -- or links to -- the canonical action-tool list from Phase 254 so a caller can answer "does this tool require the field bundle?" by lookup; the skill test (`tests/skill-fsb-spec.test.js`) is updated as needed so it still passes against the new doc surfaces.

**Plans**: TBD

---

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 254. Contract Foundation (action-tool list + field-bundle naming + typed errors) | 0/1 | Not started | -- |
| 255. Schema Enforcement on Action Tools | 4/4 | Complete    | 2026-05-11 |
| 256. Sliding-Window Lifecycle (implicit start + 60s death timer + SW-eviction replay) | 0/TBD | Not started | -- |
| 257. Explicit Completion (`is_final` immediate clear) | 0/TBD | Not started | -- |
| 258. Removal, Migration Errors, Package 0.9.0 | 0/TBD | Not started | -- |
| 259. Test Rewrites & CI Lock | 0/TBD | Not started | -- |
| 260. Skill Docs Migration | 0/TBD | Not started | -- |

---

## Coverage Validation

27 v1 requirements -> 7 phases -> 100% coverage, no orphans, no duplicates.

| Category | Count | Phase | REQ-IDs |
|----------|-------|-------|---------|
| Contract foundation (canonical list) | 1 | 254 | CONTRACT-01 |
| Contract schema enforcement | 4 | 255 | CONTRACT-02, CONTRACT-03, CONTRACT-04, CONTRACT-05 |
| Sliding-window lifecycle | 5 | 256 | TIMEOUT-01, TIMEOUT-02, TIMEOUT-03, TIMEOUT-04, TIMEOUT-05 |
| Explicit completion | 3 | 257 | COMPLETE-01, COMPLETE-02, COMPLETE-03 |
| Removal + migration + package bump | 5 | 258 | MIGRATION-01, MIGRATION-02, MIGRATION-03, MIGRATION-04, MIGRATION-05 |
| Test rewrites & CI lock | 5 | 259 | TEST-01, TEST-02, TEST-03, TEST-04, TEST-05 |
| Skill docs migration | 4 | 260 | DOCS-01, DOCS-02, DOCS-03, DOCS-04 |
| **Total** | **27** | -- | -- |

Mapped: 27/27. No orphans. No duplicates.

### Why CONTRACT-01 sits alone in Phase 254

CONTRACT-01 is the pinned canonical-list artifact that every downstream phase references verbatim (action-tool surface, field-bundle key names, typed-error names, read-tool do-not-touch list). Bundling it with schema enforcement (CONTRACT-02..05) would let Phase 255 drift if the list shifts mid-implementation. A separate hard-gate phase forces the contract names to settle before any code or doc work, and gives CHANGELOG / `TOOL_REMOVED` body a stable artifact to point at.

### Why MIGRATION-04 (mcp/README + USAGE.md flag) splits across Phase 258 and Phase 260

The breaking-change flag in `mcp/README.md` ships in Phase 258 alongside the actual removal so the package-level docs match the package-level behaviour at release time. The corresponding flag and worked examples in `skills/FSB Skill/USAGE.md` ship in Phase 260 alongside the rest of the skill doc rewrite, because the skill docs are versioned with the OpenClaw skill -- not with the MCP server package. Both surfaces flag the change; only their landing phases differ.

### Why TEST-04 (read-tool no-op) lives with the test rewrites, not with Phase 255

Phase 255's success criterion #4 requires that read-tool schemas do not grow -- a structural invariant verified at implementation time. TEST-04 is the regression-coverage assertion that locks that invariant against future drift via the CI gate. Both are required; they cover the same property at different layers (implementation vs. CI lock), which is why both phases reference the read-only do-not-touch list pinned in Phase 254.

---

## Dependencies & Order

Strict ordering, with Phase 254 as a hard gate:

```
254 (gate) -> 255 -> 256 -> 257 -> 258 -> 259
                                       \-> 260 (can run parallel to 259)
```

Cross-phase invariants:

- Phases 255-260 cannot start until Phase 254 names are pinned in `.planning/`.
- Phase 256 (lifecycle) depends on Phase 255 (schema): the dispatch gate must reject malformed payloads before lifecycle code reads `visual_reason` / `client`.
- Phase 257 (`is_final`) depends on Phase 256 (sliding window): `is_final` is an early-exit on top of the death timer, not a parallel mechanism.
- Phase 258 (removal + package bump) waits for Phases 255-257 to land first -- per the dependency rule "removal lands AFTER the new contract is wired so callers always have a working path forward" (no window where neither works).
- Phase 259 (tests) depends on Phase 258 because TEST-02 asserts `TOOL_REMOVED` and TEST-05 asserts version parity at 0.9.0.
- Phase 260 (skill docs) depends on Phase 258 (mcp/README + CHANGELOG anchors exist for USAGE.md to link to). Phases 259 and 260 can land in either order and may run in parallel; both should land before milestone close to keep the skill USAGE.md consistent with the CI-locked behaviour.

---

## Anti-Scope (do not add to any phase)

- Refactoring autopilot `run_task` overlay management (already has working internal lifecycle; separate concern with different risk profile -- PARITY-FUTURE-01).
- Adding the `visual_reason` / `client` / `is_final` fields to read-only MCP tools (`get_text`, `read_page`, `list_tabs`, `get_dom_snapshot`, `get_page_snapshot`, `get_attribute`, `get_logs`, `get_task_status`, `search_memory`, `wait_for_element`, `wait_for_stable`). Reads stay silent by design.
- Adding new badge labels to the allowlist. Allowlist additions are governed by the v0.9.36 badge policy and are not opened by this milestone.
- Freeform `client` strings or any path that bypasses the shared allowlist validator. Reintroduces the spoofing class that v0.9.36 fixed.
- Deriving `client` automatically from MCP connection metadata (carried-forward IDENT-FUTURE-01 from v0.9.36 deferred list; remains deferred).
- Cross-tab / cross-window visual-session coordination (carried over from v0.9.36 deferred list; remains deferred).
- Optional `expected_duration_ms` duration-hint field on the bundle (PARITY-FUTURE-02; remains deferred).
- Adding a queue or grace period that survives `TAB_NOT_OWNED` rejection. v0.9.60 ownership gating wins; visual-session lifecycle never observes a cross-agent action.
- Background-process or chrome.alarms-based death timer that runs without an action call. The sliding window is driven exclusively by carrying action-tool ticks (re-arm on call) plus an `is_final` early exit.
- Pinning `fsb-mcp-server@0.9.0` via `npm publish` inside the milestone. The bump is in-tree; the publish is user-gated (mirrors v0.9.60).
- Edits to extension manifest / showcase package versions in this milestone. Only `fsb-mcp-server` (and its parity test + `server.json`) bumps to 0.9.0.
- Emojis or non-ASCII status markers in code, tests, docs, CHANGELOG, error bodies, or logs.

---

*Roadmap created: 2026-05-11 -- branch `refinements` -- continues from v0.9.61 last phase 253.*
