# Milestone v0.9.62 Requirements -- Implicit Visual Session Contract

**Defined:** 2026-05-11
**Goal:** Make the MCP visual-session signal implicit on every action tool call so external agents stop missing it, replacing the explicit start/end tools with a required field + sliding-window timeout + explicit task-complete signal.

**Branch:** `refinements`
**Phase numbering:** continues from v0.9.61 (last phase 253) -- this milestone starts at Phase 254.

**Conventions:**
- REQ-ID format: `[CATEGORY]-[NUMBER]`
- Scope boundary: MCP manual tools only. Autopilot `run_task` overlay management is untouched.
- Field-bundle key names (working titles, finalised in Phase 254 plan): `visual_reason` (string), `client` (badge label, allowlisted), `is_final` (boolean, optional).
- Badge allowlist reuses the existing v0.9.36 server/extension shared validator (no freeform labels).
- Breaking change: existing explicit `visual_session` start/end MCP tools are removed in this milestone; OpenClaw skill and CHANGELOG migrate callers.

---

## v1 Requirements

### Contract (field shape + tool coverage)

- [ ] **CONTRACT-01**: The set of MCP action tools is enumerated and frozen for this milestone in a canonical list (committed to `.planning/v0.9.62-CONTRACT.md`). The complete list -- verified against the live `TOOL_REGISTRY` in `mcp/ai/tool-definitions.cjs` on 2026-05-11 -- is the following 36 tools: `click`, `type_text`, `navigate`, `scroll`, `drag`, `select_option`, `press_key`, `press_enter`, `drag_drop`, `hover`, `focus`, `clear_input`, `check_box`, `drop_file`, `click_and_hold`, `double_click`, `right_click`, `click_at`, `scroll_at`, `double_click_at`, `drag_variable_speed`, `set_attribute`, `insert_text`, `search`, `refresh`, `go_back`, `go_forward`, `open_tab`, `close_tab`, `switch_tab`, `execute_js`, `select_text_range`, `scroll_to_top`, `scroll_to_bottom`, `scroll_to_element`, `fill_sheet`. Resolutions vs the original Phase 254 draft list: dropped `back` (transcription duplicate of `go_back`; live registry has only `go_back` / `go_forward`); added the 6 action tools the live registry carries that the draft list omitted (`execute_js`, `select_text_range`, `scroll_to_top`, `scroll_to_bottom`, `scroll_to_element`, `fill_sheet`). `wait_for_element` and `wait_for_stable` are CLASSIFIED AS READ-ONLY for this milestone (see CONTRACT-05); their registry `_readOnly` flag is flipped to `true` in Phase 255.
- [ ] **CONTRACT-02**: Every action tool in the canonical list requires the new field bundle in its MCP input schema: `visual_reason` (required, short human-readable string), `client` (required, validated against badge allowlist), and `is_final` (optional, boolean).
- [ ] **CONTRACT-03**: Calling an action tool with `visual_reason` or `client` missing produces a typed validation error (`VISUAL_FIELDS_REQUIRED`) and the underlying action does not execute.
- [ ] **CONTRACT-04**: `client` is validated against the same fixed allowlist used by v0.9.36 visual sessions; invalid value yields a typed `BADGE_NOT_ALLOWED` error. Allowlist source of truth is the shared server/extension validator (no per-tool duplication).
- [ ] **CONTRACT-05**: The complete read-only MCP tool list -- enumerated from the live `TOOL_REGISTRY` on 2026-05-11 plus the two classification flips from the Phase 254 resolutions -- is: `read_sheet`, `read_page`, `get_text`, `get_attribute`, `get_dom_snapshot`, `list_tabs`, `get_page_snapshot`, `get_site_guide`, `search_memory`, `report_progress`, `complete_task`, `partial_task`, `fail_task`, `wait_for_element`, `wait_for_stable` (15 tools total). These read-only tools do not carry the new fields; their input schemas remain byte-for-byte unchanged. Resolutions: dropped `get_logs` and `get_task_status` from the original draft list (neither exists in the live registry; both were transcription artifacts from the milestone-discuss draft). Added `wait_for_element` and `wait_for_stable` to the read-only set (Phase 255 also flips their registry `_readOnly` flag from `false` to `true` so the schema-lock test asserts against them).

### Timeout (sliding window lifecycle)

- [ ] **TIMEOUT-01**: The first action-tool call from an agent on a tab implicitly starts a visual session with the supplied `visual_reason` / `client` / badge -- no prior explicit start call is required.
- [ ] **TIMEOUT-02**: Each subsequent action-tool call from the same agent on the same tab re-arms the 60-second death timer (sliding window).
- [ ] **TIMEOUT-03**: After 60 seconds with no further carrying tool call, the visual session auto-clears (overlay glow, badge, and client labels removed) without requiring an explicit end call.
- [ ] **TIMEOUT-04**: Sliding-window session state is per-tab and survives MV3 service-worker eviction by replaying from `chrome.storage.session`, following the v0.9.36 visual-session persistence pattern.
- [ ] **TIMEOUT-05**: When a different agent issues an action on a tab with an active session owned by a previous agent, ownership-gated rejection applies first (existing `TAB_NOT_OWNED` behaviour); the previous session's overlay state is not silently merged.

### Complete (explicit task-complete signal)

- [ ] **COMPLETE-01**: Callers can mark a tool call as the final action of a task by setting `is_final: true` in the visual-session fields on that call.
- [ ] **COMPLETE-02**: When `is_final: true`, the visual session clears immediately after the tool's `change_report` resolves -- does not wait for the 60-second timeout.
- [ ] **COMPLETE-03**: `is_final` is idempotent: redundant final signals on a tab with no active session are no-ops and do not error.

### Migration (removal + breaking change handling)

- [ ] **MIGRATION-01**: The existing explicit `visual_session` start/end MCP tools (the v0.9.36 / v0.9.0 contract) are removed from the server registry and are no longer dispatchable.
- [ ] **MIGRATION-02**: An MCP client calling the removed tool names receives a typed `TOOL_REMOVED` error with a body that names the new contract and points at the v0.9.62 migration recipe.
- [ ] **MIGRATION-03**: `CHANGELOG.md` captures the breaking change with a concrete before/after recipe (old explicit start/end call -> new required field bundle on action tool).
- [ ] **MIGRATION-04**: `mcp/README.md` and `skills/FSB Skill/USAGE.md` flag the contract change at the top of their visual-session sections.
- [ ] **MIGRATION-05**: `fsb-mcp-server` package version is bumped (0.8.0 -> 0.9.0) to reflect the breaking change; `server.json` and `tests/version-parity.test.js` are updated in lockstep.

### Test (contract enforcement)

- [ ] **TEST-01**: `tests/mcp-visual-tick-contract.test.js` is rewritten to assert the new implicit contract end-to-end: required fields, sliding-window re-arming, immediate clear on `is_final`, badge allowlist, MV3 SW eviction replay.
- [ ] **TEST-02**: A `TOOL_REMOVED` contract test confirms that calling the removed `visual_session` start/end tool names returns the typed error with the migration recipe pointer.
- [ ] **TEST-03**: A required-field validation test confirms that omitting `visual_reason` or `client` on every action tool in the canonical list yields the `VISUAL_FIELDS_REQUIRED` error.
- [ ] **TEST-04**: A read-tool no-op test confirms that read-only MCP tools' schemas remain unchanged (no `visual_reason` / `client` fields injected) and continue to accept their existing input shape unchanged.
- [ ] **TEST-05**: All new and rewritten tests run as part of `npm test` and pass the `ci / all-green` gate.

### Docs (downstream consumers)

- [ ] **DOCS-01**: `skills/FSB Skill/USAGE.md` is updated for the new contract; old explicit `visual_session` start/end instructions removed; at least one worked example shows the required field bundle on a sample action-tool call.
- [ ] **DOCS-02**: `skills/FSB Skill/references/visual-session-lifecycle.md` is rewritten for the implicit-lifecycle pattern; sliding-window timeout, `is_final`, and the action-tool-vs-read-tool split are explained.
- [ ] **DOCS-03**: `skills/FSB Skill/references/tool-decision-tree.md` flags the new required fields when guiding callers toward action tools (read-first guidance preserved).
- [ ] **DOCS-04**: The OpenClaw skill's `SKILL.md` body or supplementary doc captures the canonical action-tool list (or links to it) so callers know exactly which tools require the field bundle.

---

## Future Requirements (deferred)

### Autopilot Visual Session Parity

- **PARITY-FUTURE-01**: Autopilot `run_task` adopts the same implicit visual-session field bundle internally for consistency with the MCP manual contract.
- **PARITY-FUTURE-02**: Optional duration hint (`expected_duration_ms` on the field bundle) for long-running operations so the sliding-window can extend without waiting for the next tick.

### MCP Identity Derivation

- **IDENT-FUTURE-01**: `client` badge derives automatically from MCP connection / handshake metadata so callers no longer need to send an allowlisted label on every action call. (Carried forward from v0.9.36 deferred list.)

---

## Out of Scope

| Feature | Reason |
|---------|--------|
| Adding visual-session fields to read-only MCP tools | Bloats ~50 tool schemas with no overlay benefit; reads are silent by design. |
| Refactoring autopilot `run_task` overlay management | Already has working internal lifecycle; refactor is a separate concern with different risk profile. |
| New badge labels in the allowlist | Allowlist additions are governed by the v0.9.36 badge policy; not opened by this milestone. |
| Cross-tab / cross-window visual-session coordination | Carried over from v0.9.36 deferred; remains deferred. |
| Freeform `client` strings | Re-introduces spoofing class that v0.9.36 fixed; allowlist is the policy. |

---

## Traceability

Which phases cover which requirements. Filled in by `/gsd-roadmap` on 2026-05-11.

| Requirement | Phase | Status |
|-------------|-------|--------|
| CONTRACT-01 | Phase 254 | Pending |
| CONTRACT-02 | Phase 255 | Pending |
| CONTRACT-03 | Phase 255 | Pending |
| CONTRACT-04 | Phase 255 | Pending |
| CONTRACT-05 | Phase 255 | Pending |
| TIMEOUT-01 | Phase 256 | Pending |
| TIMEOUT-02 | Phase 256 | Pending |
| TIMEOUT-03 | Phase 256 | Pending |
| TIMEOUT-04 | Phase 256 | Pending |
| TIMEOUT-05 | Phase 256 | Pending |
| COMPLETE-01 | Phase 257 | Pending |
| COMPLETE-02 | Phase 257 | Pending |
| COMPLETE-03 | Phase 257 | Pending |
| MIGRATION-01 | Phase 258 | Pending |
| MIGRATION-02 | Phase 258 | Pending |
| MIGRATION-03 | Phase 258 | Pending |
| MIGRATION-04 | Phase 258 (mcp/README.md) + Phase 260 (USAGE.md) | Pending |
| MIGRATION-05 | Phase 258 | Pending |
| TEST-01 | Phase 259 | Pending |
| TEST-02 | Phase 259 | Pending |
| TEST-03 | Phase 259 | Pending |
| TEST-04 | Phase 259 | Pending |
| TEST-05 | Phase 259 | Pending |
| DOCS-01 | Phase 260 | Pending |
| DOCS-02 | Phase 260 | Pending |
| DOCS-03 | Phase 260 | Pending |
| DOCS-04 | Phase 260 | Pending |

**Coverage:**
- v1 requirements: 27 total
- Mapped to phases: 27
- Unmapped: 0

---

*Requirements defined: 2026-05-11*
*Last updated: 2026-05-11 -- traceability filled in by /gsd-roadmap (7 phases 254-260; 27/27 mapped).*
