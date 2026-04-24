# Phase 205: Validation & MCP Usage Docs - Context

**Gathered:** 2026-04-24T00:20:00-0500
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 205 closes the milestone by proving the explicit MCP visual-session lifecycle is trustworthy in automation and understandable to operators. It locks the route/smoke/test surface around `start_visual_session`, token-aware progress/finalization, trusted client identity, replay-safe cleanup, and the live/preview overlay behavior added in Phases 203 and 204.

This phase does not add new UI affordances beyond test-driven gap fixes, change the trusted client allowlist, or replace `run_task`. It validates the contract we already shipped and teaches callers when to use it.

</domain>

<decisions>
## Implementation Decisions

### Regression Scope
- **D-01:** [auto] `VALID-01` must be proven by automated MCP tests that cover explicit start/progress/end flows, trusted allowlist enforcement, and idempotent cleanup behavior for repeated end/clear calls.
- **D-02:** [auto] Release smoke should exercise the explicit visual-session lifecycle tool surface, not just `run_task`, so packaged MCP drift is caught before release.

### Overlay And Preview Coverage
- **D-03:** [auto] `VALID-02` must assert badge rendering, final-state freeze behavior, watchdog degradation/orphan cleanup posture, and stale-message suppression for client-owned sessions.
- **D-04:** [auto] UI and overlay tests should verify structured lifecycle fields such as `clientLabel`, `sessionToken`, `version`, `lifecycle`, and `result` rather than depending on loosely formatted display text.

### Documentation Posture
- **D-05:** [auto] `VALID-03` must document a simple lifecycle flow: `start_visual_session` -> zero or more `report_progress` calls -> `complete_task` / `partial_task` / `fail_task` -> `end_visual_session` when explicit cleanup is still needed.
- **D-06:** [auto] Docs must clearly distinguish client-owned visible work from autopilot `run_task`: use the lifecycle tools when the MCP caller owns the steps and only wants FSB to show trusted visible progress; use `run_task` when FSB should decide and execute the steps itself.
- **D-07:** [auto] Docs may mention only the fixed trusted client labels supported by the shared allowlist. No arbitrary badge text, logos, or caller-defined branding should be implied.

### the agent's Discretion
- Exact test split between smoke, route-contract, and overlay/UI suites, as long as the required contract coverage becomes explicit and durable.
- Exact documentation structure, examples, and cross-links, as long as the package guide remains the canonical MCP usage reference.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase Scope And Requirements
- `.planning/ROADMAP.md` - Phase 205 goal, dependencies, and success criteria for validation plus docs.
- `.planning/REQUIREMENTS.md` - `VALID-01`, `VALID-02`, and `VALID-03`.
- `.planning/PROJECT.md` - Milestone goal and the user-facing ask for explicit MCP-owned glow/badge lifecycle.
- `.planning/STATE.md` - Current handoff after Phase 204 completion.

### Prior Phase Constraints
- `.planning/phases/203-mcp-visual-session-contract/203-CONTEXT.md` - Locked contract decisions for start/end tools, trusted client identity, and token-aware progress/finalization.
- `.planning/phases/203-mcp-visual-session-contract/203-02-SUMMARY.md` - Finalized semantics for `report_progress`, `complete_task`, `partial_task`, and `fail_task`.
- `.planning/phases/204-overlay-badge-session-persistence/204-CONTEXT.md` - Locked decisions for live badge rendering, preview parity, persistence, replay, and stale cleanup.
- `.planning/phases/204-overlay-badge-session-persistence/204-01-SUMMARY.md` - Delivered live/preview badge behavior.
- `.planning/phases/204-overlay-badge-session-persistence/204-02-SUMMARY.md` - Delivered persistence, replay, and stale-session cleanup posture.

### Runtime And Docs Surfaces
- `utils/mcp-visual-session.js` - Trusted client allowlist, final-clear timing, and visual-session helpers.
- `utils/overlay-state.js` - Canonical overlay normalization plus stale-message suppression via `sessionToken` and `version`.
- `background.js` - Canonical lifecycle dispatch, replay, and cleanup behavior.
- `mcp-server/README.md` - Package-level MCP guide that currently documents `run_task` but not the explicit visual-session lifecycle.
- `README.md` - Repo-level MCP entrypoint that should point readers at the canonical package guide.

### Tests To Extend
- `tests/mcp-tool-smoke.test.js` - Packaged tool smoke for release sanity checks.
- `tests/mcp-lifecycle-smoke.test.js` - Bridge/client lifecycle smoke that should stay aligned with release smoke expectations.
- `tests/mcp-tool-routing-contract.test.js` - Public MCP route surface and alias contract.
- `tests/mcp-visual-session-contract.test.js` - Allowlist, lifecycle, replay, and cleanup contract coverage.
- `tests/test-overlay-state.js` - Overlay normalization and stale-message suppression coverage.
- `tests/dashboard-runtime-state.test.js` - Preview/runtime source contracts for live and frozen badge state.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `tests/mcp-tool-routing-contract.test.js` already proves the public MCP tool surface includes the explicit lifecycle tools; Phase 205 should deepen behavior guarantees instead of inventing a new harness.
- `tests/mcp-visual-session-contract.test.js` already covers allowlist normalization, token-aware progress/finalization, deterministic final clear timing, and replay-aware stale protection.
- `tests/test-overlay-state.js` already validates `clientLabel`, `sessionToken`, and `version` pass-through plus stale-message suppression for newer tokens.
- `tests/dashboard-runtime-state.test.js` already source-contracts the Angular preview badge and frozen badge rendering path.
- `mcp-server/README.md` still centers `run_task` and its tool table, so the explicit client-owned lifecycle remains under-documented relative to the shipped code.

### Established Patterns
- Node-based assertion scripts are the established way to extend contract and smoke coverage in this repo.
- The canonical MCP guide lives in `mcp-server/README.md`; the root `README.md` links into it rather than duplicating package details.
- Final visual-session outcomes preserve a short frozen overlay window before clearing, while idle sessions degrade and later clear via the watchdog/orphan posture established in Phases 203 and 204.

### Integration Points
- `tests/mcp-tool-smoke.test.js` and `tests/mcp-lifecycle-smoke.test.js` are the release-facing smoke path for packaged MCP behavior.
- `tests/mcp-visual-session-contract.test.js`, `tests/test-overlay-state.js`, and `tests/dashboard-runtime-state.test.js` are the main regression surfaces for VALID-01 and VALID-02.
- `mcp-server/README.md` is the main implementation-facing place to explain when to use explicit lifecycle tools versus `run_task`.

</code_context>

<specifics>
## Specific Ideas

- The user explicitly wants the glow/overlay to begin from an MCP call, end from an MCP call, and show a small trusted badge naming the MCP client.
- The badge source is the fixed allowlist introduced in Phase 203, with labels such as Claude, Codex, ChatGPT, Perplexity, Windsurf, Cursor, Antigravity, OpenCode, OpenClaw, Grok, and Gemini.
- Phase 205 should make that lifecycle easy to trust in both code and docs, without changing the behavior already delivered in Phases 203 and 204.

</specifics>

<deferred>
## Deferred Ideas

- Richer badge visuals such as logos, icons, or per-client accent colors remain future work.
- Live operator UAT and broader milestone audit/cleanup remain outside this phase unless a regression is discovered during execution.

</deferred>

---

*Phase: 205-validation-mcp-usage-docs*
*Context gathered: 2026-04-24*
