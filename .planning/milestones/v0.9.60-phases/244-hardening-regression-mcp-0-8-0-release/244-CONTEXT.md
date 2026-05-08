# Phase 244: Hardening, Regression, MCP 0.8.0 Release - Context

**Gathered:** 2026-05-06
**Status:** Ready for planning
**Source:** Auto-generated context (autonomous mode, recommended decisions)

<domain>
## Phase Boundary

Final phase of v0.9.60: belt-and-suspenders verification across SW eviction, tab-ID reuse, saturation; multi-agent regression suite; MCP tool descriptions document the new contract; mcp/package.json + server.json bumped to 0.8.0; @modelcontextprotocol/sdk to ^1.29.x; CHANGELOG/README updated. The actual `npm publish` is the orchestrator's responsibility (autonomous mode does NOT execute it — flag for user).

</domain>

<decisions>
## Implementation Decisions

### Multi-agent regression suite (SC#2)

- **D-01 New regression test file: tests/multi-agent-regression.test.js.** Single file, plain-Node assert harness (project convention). Sections:
  - N parallel agents drive distinct tabs successfully (N = configured cap = 8)
  - (N+1)th claim rejects with AGENT_CAP_REACHED { cap: 8, active: 8 }
  - All release cleanly on disconnect (bridge onclose -> stagedRelease -> grace expiry releases all)
  - SW eviction + wake reconciliation: persist 5 active agents, simulate eviction (clear in-memory state), call hydrate, verify 5 agents restored AND any with releaseTab events that fired during eviction get reconciled (ghost records reaped per Phase 237 D-09 reconciliation pattern)
  - 20-concurrent-claim stress test: spawn 20 register calls in parallel; assert exactly 8 successes + 12 AGENT_CAP_REACHED rejections
  - Tab-ID-reuse race: agent A claims tab T1, A queues an action on T1, T1 closes (releaseTab), agent B opens new tab whose ID is recycled to T1 by Chrome, B claims T1; verify A's queued action on T1 cannot corrupt B's tab (verify via the existing isOwnedBy check + ownershipToken being a per-bindTab fresh randomUUID).

### Tool descriptions (SC#3)

- **D-02 Update descriptions in agents.ts (back), autopilot.ts (run_task), manual.ts (every manual tool), visual-session.ts (start/end visual session).** Each description block adds:
  - "agent_id is FSB-issued and required (server captures via agent:register; do not provide)"
  - "tab_id is agent-scoped — only tabs owned by the calling agent can be addressed"
  - "Concurrency cap is configurable (default 8, range 1-64); the (N+1)th agent claim is rejected with AGENT_CAP_REACHED"
  - "Ownership enforcement: cross-agent calls reject with TAB_NOT_OWNED; incognito tabs reject with TAB_INCOGNITO_NOT_SUPPORTED; cross-window tabs reject with TAB_OUT_OF_SCOPE"
  - Per-tool: enumerate the typed error codes that tool can return (e.g., back tool also returns NO_BACK_HISTORY, BF_CACHE, FRAGMENT_ONLY, etc.)

### Version bump + dependency upgrade (SC#4)

- **D-03 mcp/package.json bumped from 0.7.4 to 0.8.0.** Single-line edit. Also update mcp/server.json if present.
- **D-04 @modelcontextprotocol/sdk bumped from ^1.27.1 to ^1.29.x.** Run `npm --prefix mcp install @modelcontextprotocol/sdk@^1.29` (or pin exact 1.29.0 if 1.29.x has known issues — verify via npm view at plan time). Zod stays on ^3.x. Run `npm --prefix mcp run build` after upgrade to verify TypeScript compiles cleanly.
- **D-05 CHANGELOG.md + README.md in mcp/ reflect:**
  - Phase 236 reborn (run_task return-on-completion)
  - Multi-agent contract (AgentScope, agent:register/release/status, ownership gate, ownership tokens, cap)
  - back tool with 5 status codes
  - Heartbeat (30s notifications/progress with _meta fields)
  - chrome.storage.session task persistence with sw_evicted recovery

### npm publish (SC#5)

- **D-06 npm publish is NOT executed by autonomous mode.** The plan prepares everything (tag-ready commit; CHANGELOG complete; tests green; build clean) and ends with a "ready to publish" marker. The user runs the actual publish via the existing tag-driven workflow.

### Claude's Discretion

- Test naming inside multi-agent-regression.test.js (per-section)
- The npm view check for @modelcontextprotocol/sdk@1.29.x latest stable
- Whether to extract the test fixtures into shared helpers (recommend yes for tab-ID-reuse fixture and SW-eviction simulation fixture; reuse Phase 239's run-task-harness pattern)
- Exact wording of tool descriptions — match existing description style (terse, one to two sentences)

</decisions>

<canonical_refs>
- `.planning/ROADMAP.md` (Phase 244 — 5 SC; depends on all prior phases)
- `.planning/REQUIREMENTS.md` MCP-01, MCP-02, MCP-07, MCP-08, TEST-01..05
- All Phase 237/238/239/240/241/242/243 SUMMARY.md files (full milestone context)
- mcp/package.json, mcp/server.json (version bump targets)
- mcp/src/tools/agents.ts, autopilot.ts, manual.ts, visual-session.ts (description targets)
- Phase 239's tests/fixtures/run-task-harness.js (helper pattern reference)
- Phase 237's hydrate / reconcile path in agent-registry.js (SW-eviction simulation reference)

</canonical_refs>

<code_context>
- Multi-agent regression tests use the same plain-Node assert harness as Phases 237-243
- SW-eviction simulation: drop in-memory `_agents` Map + `_tabMetadata`, then call hydrate from a pre-persisted chrome.storage.session shape
- Tab-ID-reuse race needs a fixture that simulates Chrome recycling a tab ID
- Existing test infrastructure (tests/fixtures/run-task-harness.js, agent-registry.test.js, ownership-gate.test.js) provides templates

</code_context>

<specifics>
- Phase 244 is the LAST phase of v0.9.60. After this, the milestone is complete and the orchestrator runs audit -> complete-milestone -> cleanup.
- npm publish step is deferred to the user — autonomous mode prepares but does not execute the publish.
- The 0.8.0 release is what makes Phase 236 reborn (Phase 239) reach external consumers.

</specifics>

<deferred>
- Real-Chrome end-to-end test of the 0.8.0 build with a live MCP host — manual UAT per VALIDATION.md
- Migration of setTimeout 1-30s waits to chrome.alarms (Phase 243 BG-02 follow-up list, 12 entries)
- Full automation of npm publish (current pattern is tag-driven via existing workflow)
- Cross-version compatibility tests (0.7.x -> 0.8.0) — defer unless real users surface issues post-release

</deferred>

---

*Phase: 244-hardening-regression-mcp-0-8-0-release*
