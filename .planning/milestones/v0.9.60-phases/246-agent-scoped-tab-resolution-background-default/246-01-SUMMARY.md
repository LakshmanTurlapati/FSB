---
phase: 246-agent-scoped-tab-resolution-background-default
plan: 01
subsystem: mcp
tags: [agent-scope, tab-resolution, mcp, registry, multi-agent, ownership]

# Dependency graph
requires:
  - phase: 237-agent-registry-foundation
    provides: globalThis.fsbAgentRegistryInstance.getAgentTabs(agentId) sync read
  - phase: 238-agentscope-bridge-wiring
    provides: AgentScope.ensure / currentOwnershipToken / currentConnectionId
  - phase: 240-tab-ownership-enforcement-on-dispatch
    provides: checkOwnershipGate at dispatchMcpToolRoute; bindTab + ownershipToken contract
  - phase: 245-post-action-change-report
    provides: action-verification harvest wrap (resolver runs upstream so harvest sees the resolved tabId)
provides:
  - resolveAgentTabOrError(agentId, params, client) helper at extension/utils/agent-tab-resolver.js
  - Read-tool tab resolution via registry for _handleGetDOM, _handleReadPage, handleGetPageSnapshotRoute
  - open_tab background-default (active: params.active === true)
  - Optional tab_id schema property on all 6 read tools (read_page, get_text, get_attribute, get_dom_snapshot, get_page_snapshot, read_sheet)
  - read-only.ts agentScope overturn (Phase 238 D-06 -> Phase 246 D-02)
affects:
  - 246-02 (visual session + action tools migration; consumes resolver)
  - 246-03 (cross-cut integration tests + tool-definitions parity safety net)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Resolver helper as a module-scope IIFE registering globalThis symbol (mirrors action-verification.js / mcp-visual-session.js pattern)"
    - "Plain-object error envelope {success:false, code, agentId?, tabIds?} continues Phase 240 shape"
    - "skipGate:true convention for legacy:* surfaces (call site does not push tabId into routeParams)"
    - "Source-detection skeleton gates (test files short-circuit until paired migration lands)"

key-files:
  created:
    - extension/utils/agent-tab-resolver.js
    - tests/agent-tab-resolver.test.js
    - tests/read-tool-tab-resolution.test.js
    - tests/open-tab-background-default.test.js
  modified:
    - extension/background.js (importScripts the resolver)
    - extension/ws/mcp-bridge-client.js (_handleGetDOM, _handleReadPage)
    - extension/ws/mcp-tool-dispatcher.js (handleGetPageSnapshotRoute, handleOpenTabRoute)
    - extension/ai/tool-definitions.js (open_tab schema + 6 read tool tab_id additions)
    - mcp/ai/tool-definitions.cjs (kept byte-identical with .js)
    - mcp/src/tools/read-only.ts (agentScope overturn, MESSAGE_TYPE_MAP tab_id forwards)
    - package.json (3 new tests appended to npm test chain)

key-decisions:
  - "Resolver lives in extension/utils/agent-tab-resolver.js (separate file, mirrors action-verification.js for testability)"
  - "Plain-object error envelope (no FsbResolverError class; parity with Phase 240 codes)"
  - "Legacy:* branch returns skipGate:true so call sites do not push tabId into routeParams (preserves Phase 240 tab-arm-skip path for popup/sidepanel/autopilot)"
  - "open_tab schema declares active: { type: boolean, default: false } explicitly (was untyped before)"
  - "read-only.ts MESSAGE_TYPE_MAP forwards p.tab_id only when defined (...(p.tab_id !== undefined ? { tab_id } : {}))"

patterns-established:
  - "Single resolver chokepoint for read tools (Plan 02 will extend to visual + action; Plan 03 lands cross-cut tests)"
  - "Source-detection test gates allow scaffolds to land in Wave 0 without breaking npm test before paired migrations land"

requirements-completed: [D-01, D-02, D-03, D-04, D-05, D-06, D-07, D-08, D-12]

# Metrics
duration: 12min
completed: 2026-05-06
---

# Phase 246 Plan 01: Agent-Scoped Tab Resolution + open_tab Background-Default Summary

**Resolver helper with 3-branch registry resolution (D-01) and legacy:* skipGate fall-through (D-04); read-tool dispatch path migrated end-to-end (read_page, get_dom_snapshot, get_page_snapshot via dispatcher; get_text, get_attribute, read_sheet via execute-action chain); open_tab default flipped to background; read-only.ts now agentScope-aware with optional tab_id forwarded.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-05-06T16:57:59-05:00
- **Completed:** 2026-05-06T17:09:35-05:00
- **Tasks:** 7 (all atomic commits, all green)
- **Files modified:** 9 (3 created tests, 1 created helper, 5 modified source/schema)

## Accomplishments

- Single chokepoint resolver helper `resolveAgentTabOrError(agentId, params, client)` with D-01 three-branch registry resolution and D-04 legacy:* first-line fall-through. 8 unit-test cases pass (single owned, zero owned NO_OWNED_TAB, multi owned AMBIGUOUS_TAB, legacy popup, legacy + no-active-tab NO_ACTIVE_TAB, snake_case tab_id passthrough, camelCase tabId passthrough, missing-registry AGENT_REGISTRY_UNAVAILABLE).
- Read-tool migration: `_handleGetDOM`, `_handleReadPage` (extension/ws/mcp-bridge-client.js) and `handleGetPageSnapshotRoute` (extension/ws/mcp-tool-dispatcher.js) now route via the resolver. Single-tab agents auto-resolve; multi-tab agents get AMBIGUOUS_TAB; explicit tab_id passes through with gate-enforcement; legacy:* surfaces preserve byte-for-byte UX. 6 integration tests pass.
- open_tab default flipped: `active: params.active === true` replaces the legacy `active: params.active !== false`. Phase 240 D-08 bindTab + ownershipToken contract preserved byte-for-byte. 5 integration tests pass.
- Schema rollout: `tab_id?: number` added to 6 read tools' inputSchemas in BOTH tool-definitions files (kept byte-identical via the mcp build's cp step). open_tab schema also gains explicit `active: { type: boolean, default: false }`. jsonSchemaToZod auto-derives `z.number().optional()` at the MCP boundary with no per-tool wiring needed.
- read-only.ts overturn: `void agentScope` removed; `agentScope.ensure(bridge)` + ownershipToken/connectionId capture now thread agentId through every read-tool bridge payload. MESSAGE_TYPE_MAP forwards `p.tab_id` for the 6 tab-aware tools. Phase 238 D-06 exemption is now a Phase 246 D-02 contract.

## Task Commits

Each task was committed atomically (per-task `--no-verify` per parallel-execution policy):

1. **Task 1: Wave 0 RED scaffolds for resolver, read-tool resolution, open_tab default** - `7739066` (test)
2. **Task 2: Add resolveAgentTabOrError helper, wire importScripts, retire RED skeleton** - `b6fab6e` (feat)
3. **Task 3: Migrate _handleGetDOM and _handleReadPage to resolver** - `2dcd488` (feat)
4. **Task 4: Migrate handleGetPageSnapshotRoute to resolver and enable Test 5** - `3a9ac68` (feat)
5. **Task 5: Flip open_tab default to background, document active flag in schemas** - `c4d8391` (feat)
6. **Task 6: Add optional tab_id to all 6 read tool inputSchemas** - `e4b69f0` (feat)
7. **Task 7: Overturn read-only.ts agentScope exemption, thread agentId + tab_id** - `20a5cfa` (feat)

## Files Created/Modified

**Created:**

- `extension/utils/agent-tab-resolver.js` - resolveAgentTabOrError(agentId, params, client) helper. IIFE-wrapped exports, registers globalThis symbol. ~85 lines.
- `tests/agent-tab-resolver.test.js` - 8 resolver unit tests (D-01 + D-04 + explicit tab_id + missing registry). 25/25 PASS.
- `tests/read-tool-tab-resolution.test.js` - 6 read-tool integration tests (D-02 covered for all 6 read tools). 20/20 PASS.
- `tests/open-tab-background-default.test.js` - 5 open_tab default-flip + bindTab/ownershipToken tests (D-05 + D-06 + D-08). 10/10 PASS.

**Modified:**

- `extension/background.js` - one importScripts line for `utils/agent-tab-resolver.js` between agent-registry.js and agent-nav-emission.js. Pure additive.
- `extension/ws/mcp-bridge-client.js` - `_handleGetDOM` and `_handleReadPage` bodies replaced. Both now call `globalThis.resolveAgentTabOrError(agentId, params, this)` and surface the resolver's error envelope on `success === false`.
- `extension/ws/mcp-tool-dispatcher.js` - `handleGetPageSnapshotRoute` body replaced (resolver + chrome.tabs.get for URL); `handleOpenTabRoute` line 917 flipped to `active: params.active === true`. Phase 240 D-08 bindTab logic untouched.
- `extension/ai/tool-definitions.js` - open_tab schema: explicit `active` property + appended description; 6 read tools: optional `tab_id` property + appended description.
- `mcp/ai/tool-definitions.cjs` - synchronized via `cp` from .js (the mcp build's last step copies the .js into .cjs). Byte-identical after every edit.
- `mcp/src/tools/read-only.ts` - `void agentScope` and Phase 238 D-06 comment block removed; MESSAGE_TYPE_MAP entries forward `p.tab_id` for the 6 tab-aware tools; server.tool body now mirrors manual.ts (agentScope.ensure, ownershipToken/connectionId capture, payloadWithAgent assembly, captureOwnershipToken on response).
- `package.json` - 3 new tests appended to npm test chain.

## Decisions Made

- **Resolver location:** separate file `extension/utils/agent-tab-resolver.js` (per Open Question 3 RESOLVED in RESEARCH.md). Easier unit testing; mirrors `action-verification.js` pattern from Phase 245.
- **Error envelope shape:** plain-object `{success:false, code, agentId?, tabIds?}` (per Open Question 5 RESOLVED). No `FsbResolverError` class; parity with Phase 240 codes.
- **skipGate field naming:** kept `skipGate: true` (per Open Question 7 RESOLVED). Concise; matches the call-site pattern `if (resolved.skipGate) { /* don't push tabId */ }`.
- **Test gating strategy (NEW for this plan):** added a source-detection gate to `tests/open-tab-background-default.test.js` so the file short-circuits cleanly between Task 2 (resolver lands) and Task 5 (open_tab default flip). Without the gate, Test 1 would FAIL between Tasks 2 and 5 because the dispatcher source still has the legacy `params.active !== false` expression. Gate retired in Task 5 once the flip lands. This pattern keeps `npm test` green throughout the plan.
- **mcp build sync:** the mcp build script does `cp ../extension/ai/tool-definitions.js ai/tool-definitions.cjs` as its last step, so `mcp/ai/tool-definitions.cjs` is effectively a build artifact. We still maintain it manually in the source tree (the source-of-truth for npm test runs without rebuilding); `npm --prefix mcp run build` re-syncs it. Byte-identity verified after every edit via `diff -q`.

## Deviations from Plan

None - plan executed exactly as written. The Open Questions in RESEARCH.md were RESOLVED before plan finalization; this execution honors every decision.

The Task 1 plan said the open_tab tests would "exit 0 in their RED-skeleton state (skeletons short-circuit gracefully when resolver not yet present)". The resolver-presence skeleton suffices for Tests 1-4, 6 of read-tool-tab-resolution.test.js (those just need the resolver), but the open_tab default-flip tests also need Task 5's source change. I added a SECOND skeleton gate (source-detection on `'active: params.active === true'`) to keep `npm test` green between Tasks 2-4 (resolver lands but flip hasn't). Gate retired in Task 5. This is a strict tightening of the plan's intent (keep npm test green throughout), not a deviation from the plan's design contract.

## Issues Encountered

- **Worktree branch base mismatch at start.** `git merge-base HEAD <expected_base>` returned the current HEAD (a merge commit), not the expected base. Pre-existing changes were unrelated v0.9.45rc1 / pooling work that landed via PRs #20-#22. Reset hard to the expected base commit `0c849bf` (per the worktree_branch_check protocol in the prompt) before any task work. Outcome: clean base; all 7 task commits land cleanly atop it.
- **Pre-existing diffs in extension/ws/mcp-bridge-client.js, extension/background.js, tests/mcp-bridge-client-lifecycle.test.js after the reset.** These were modifications already present in the worktree filesystem (from a previous staged state). Used `git add -p` to stage ONLY my hunks for Tasks 2-5; left the pre-existing diffs unstaged. They are not part of this plan's scope.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Resolver is ready for Plan 02 consumption (visual session + ~30 action tools + vault).
- read-only.ts overturn is ready for Plan 03 to extend `tests/agent-id-threading.test.js` with read-only.ts coverage.
- Plan 03's tool-definitions parity safety net (`tests/tool-definitions-parity.test.js`) is unblocked: tool-definitions.js and tool-definitions.cjs are byte-identical and have the new schemas.
- No blockers; npm test green; mcp build green.

## Self-Check: PASSED

- Resolver file exists: FOUND extension/utils/agent-tab-resolver.js
- 3 new test files exist: FOUND tests/agent-tab-resolver.test.js, tests/read-tool-tab-resolution.test.js, tests/open-tab-background-default.test.js
- 7 task commits exist:
  - FOUND 7739066 (Task 1)
  - FOUND b6fab6e (Task 2)
  - FOUND 2dcd488 (Task 3)
  - FOUND 3a9ac68 (Task 4)
  - FOUND c4d8391 (Task 5)
  - FOUND e4b69f0 (Task 6)
  - FOUND 20a5cfa (Task 7)
- tool-definitions byte-identical: PASS (`diff -q` returns no output)
- mcp build green: PASS (`npm --prefix mcp run build` exits 0)
- npm test green: PASS (60+ tests; 0 failures)
- No emojis introduced: PASS

---
*Phase: 246-agent-scoped-tab-resolution-background-default*
*Plan: 01*
*Completed: 2026-05-06*
