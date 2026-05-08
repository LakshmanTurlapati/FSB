---
phase: 237-agent-registry-foundation
verified: 2026-05-05T00:00:00Z
status: passed
score: 5/5 ROADMAP success criteria + 4/4 REQ-IDs verified
overrides_applied: 0
re_verification: null
---

# Phase 237: Agent Registry Foundation Verification Report

**Phase Goal:** Single source of truth exists in the extension service worker for who owns which tab, survives MV3 service-worker eviction, and can be reasoned about by every later phase.

**Verified:** 2026-05-05
**Status:** PHASE COMPLETE
**Re-verification:** No (initial verification)

## PHASE COMPLETE

All 5 ROADMAP success criteria verified, all 4 phase requirements (AGENT-01..04) satisfied, all 4 user-locked decisions (D-01..D-04) honored, all unit tests pass (25 test groups, exit 0), `npm test` chain green with no regressions, no emojis introduced.

## Goal Achievement

### ROADMAP Success Criteria (5/5)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Module exists with `agents`, `tabOwners`, `tabsByAgent` Maps + `withRegistryLock` mutex; loaded via `importScripts` in `background.js` before `mcp-tool-dispatcher.js` | VERIFIED | `extension/utils/agent-registry.js:195-200` (3 Maps), `:137-142` (mutex), `extension/background.js:11` (importScripts agent-registry) preceeds `:12` (mcp-tool-dispatcher). Note: ROADMAP wording says `extension/agents/` but CONTEXT.md D-01 explicitly relocates to `extension/utils/`; the path deviation is a user-locked decision, not a gap. |
| 2 | Every mutation mirrored to `chrome.storage.session` under `fsbAgentRegistry` (write-through); `hydrate()` reconciles persisted records against `chrome.tabs.query({})`, dropping ghost records | VERIFIED | `_persist()` called from registerAgent (`:223`), bindTab (`:292`), releaseTab (`:324`), releaseAgent (`:253`), and hydrate Step 5 (`:462`). hydrate reconciliation Steps 1-5 at `:391-465`. Tests 1-5, 7, 9, 10 exercise round-trip + reaping. |
| 3 | `crypto.randomUUID()` mints `agent_<uuid>` IDs; caller-supplied IDs ignored | VERIFIED | `mintAgentId()` at `:172-181` calls `crypto.randomUUID()`. `registerAgent` signature ignores opts (`:212` comment "/* opts ignored */"). Test 3 ("registerAgent ignores caller-supplied agent_id") asserts `r1.agentId !== 'agent_pre-supplied'`. |
| 4 | Unit tests cover registry CRUD, storage round-trip, simulated SW eviction + wake reconciliation (drops ghost records), 20-concurrent-claim stress | VERIFIED | `tests/agent-registry.test.js` 971 lines, 25 test groups. CRUD = test 6; storage round-trip = tests 1-4; SW-eviction reconciliation = tests 7, 9-10; 20-concurrent stress = test 5. All green at ~200ms. |
| 5 | `chrome.tabs.onRemoved` wired to `releaseTab(tabId)` idempotently; no MCP tool yet rejects on ownership | VERIFIED | New listener at `extension/background.js:2543-2554`. `releaseTab` idempotent per test 7 (plan-01). No dispatch-gate enforcement modified (Phase 240 territory). |

**Score: 5/5 truths verified**

### User-Locked Decisions (4/4 D-01..D-04)

| Decision | Honored? | Evidence |
|----------|----------|----------|
| D-01: Module at `extension/utils/agent-registry.js` (NOT `extension/agents/`) | YES | File at `extension/utils/agent-registry.js`; no reference to `extension/agents/` in module (`grep -c "extension/agents/" extension/utils/agent-registry.js` = 0) |
| D-02: `formatAgentIdForDisplay` exists; full UUID is canonical key | YES | `:150-155` defines helper; full UUID stored in Map keys (`mintAgentId` returns `agent_<full-uuid>`) |
| D-03: Diagnostic emission via `rateLimitedWarn('AGT', ...)` reusing Phase 211 LOG-04 ring buffer | YES | `emitAgentReapedEvent` at `:103-123` calls `globalThis.rateLimitedWarn('AGT', 'agent-reaped-<reason>', ...)` with redacted ctx |
| D-04: NO `connection_id` field on `AgentRecord` (deferred to Phase 241) | YES | `grep -c "connection_id" extension/utils/agent-registry.js` = 0; AgentRecord shape is `{ agentId, createdAt, tabIds }` only |

### Required Artifacts (3/3)

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `extension/utils/agent-registry.js` | 250-350 lines (plan 01) extended to 320+ (plan 02) | VERIFIED | 535 lines; substantive (not stub); IIFE pattern mirrors `mcp-visual-session.js`; dual-export shape |
| `tests/agent-registry.test.js` | 200+ lines (plan 01) extended to 400+ (plan 02) | VERIFIED | 971 lines, 25 test groups; runs in ~200ms; exit 0 |
| `extension/background.js` integration | importScripts + bootstrap + 3rd onRemoved listener | VERIFIED | All three sites present at lines 11, 781-798, 2310, 2543-2554 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `extension/background.js:11` | `extension/utils/agent-registry.js` | `importScripts` BEFORE mcp-tool-dispatcher | WIRED | Line 11 (registry) precedes line 12 (dispatcher); both wrapped in try/catch with `[FSB]` console.error convention |
| `extension/background.js:2310` | `bootstrapAgentRegistry` | call inside `restoreSessionsFromStorage` | WIRED | `await bootstrapAgentRegistry().catch(() => {})` between `restoreConversationSessions` and `restorePersistedMcpVisualSessions`; both runtime entry points (line 2321 SW-evaluate fire-and-forget, line 12849 lifecycle-handler await) flow through the single bootstrap site |
| `bootstrapAgentRegistry` | `globalThis.fsbAgentRegistryInstance` | constructor | WIRED | `:783-784` constructs singleton on first invocation |
| `bootstrapAgentRegistry` | `hydrate()` | await | WIRED | `:787` awaits hydrate inside try/catch; `rateLimitedWarn('AGT', 'hydrate-failed', ...)` on failure (`:790-792`) |
| `chrome.tabs.onRemoved` (new 3rd listener) | `fsbAgentRegistryInstance.releaseTab(tabId)` | listener body | WIRED | `:2549` invokes releaseTab fire-and-forget under defensive guards; existing two listeners at 2485 and 12664 unchanged |
| Existing onRemoved listener at line 2485 (v0.9.36 cleanup) | -- | -- | UNCHANGED | `git diff 8f6447b..HEAD` shows only ONE ADDED `chrome.tabs.onRemoved.addListener` line; existing bodies byte-for-byte identical |
| Existing onRemoved listener at line 12664 (keyboard-emulator detach) | -- | -- | UNCHANGED | Same diff evidence; line shifted from 12616 (CONTEXT.md ref) to 12664 only because of additive insertions above it; body unchanged |
| `agent-registry.js` mutating ops | `chrome.storage.session.fsbAgentRegistry` | `_persist()` write-through | WIRED | All 4 mutation entry points + hydrate Step 5 (5 `_persist()` call sites total) |
| `hydrate()` | `chrome.tabs.query({})` | reconciliation Step 2 | WIRED | `:418` queries live tabs; conservative on throw (Step 2 returns without dropping per `:419-422`) |
| `emitAgentReapedEvent` | `globalThis.rateLimitedWarn` | lazy-reference diagnostic | WIRED | `:112-121`; lazy guard prevents crash if helper missing (Pitfall 5; test 15 covers) |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| `AgentRegistry._agents` Map | agentId records | registerAgent + hydrate from storage | YES (`crypto.randomUUID()` mints real IDs; storage payloads are versioned and validated) | FLOWING |
| `AgentRegistry._tabOwners` Map | tabId -> agentId | bindTab + hydrate from storage | YES | FLOWING |
| `chrome.storage.session.fsbAgentRegistry` | `{ v: 1, records: { ... } }` envelope | `writePersistedAgentRegistry()` | YES (test 1 asserts 5 records persisted; test 9 asserts ghost dropped from BOTH memory AND storage) | FLOWING |
| LOG-04 ring buffer entry | `{ prefix: 'AGT', category: 'agent-reaped-tab_not_found', ctx: { agentIdShort, tabId, reason } }` | `emitAgentReapedEvent` -> `rateLimitedWarn` | YES (test 14 asserts exact ctx shape; test 9 asserts emission happens on real ghost drop) | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Module loads cleanly under Node | `node tests/agent-registry.test.js` | exit 0, all 25 PASS lines | PASS |
| Background.js parses cleanly | `node --check extension/background.js` | exit 0 (no syntax errors) | PASS |
| Full test chain regression | `npm test` | exit 0, all suite green | PASS |
| importScripts ordering correct | `grep -n "importScripts.*agent-registry\|importScripts.*mcp-tool-dispatcher" extension/background.js` | line 11 (registry) precedes line 12 (dispatcher) | PASS |
| Three onRemoved listeners total | `grep -c "chrome.tabs.onRemoved.addListener" extension/background.js` | 3 (existing 2 + new) | PASS |
| Existing listeners byte-for-byte unchanged | `git diff 8f6447b..HEAD -- extension/background.js \| grep -cE "^[+-]chrome\.tabs\.onRemoved\.addListener"` | 1 (only ONE addition; no removals) | PASS |
| package.json test wired | `grep -c "agent-registry.test.js" package.json` | 1 (chained in `scripts.test`) | PASS |
| No emojis introduced | perl scan over module + tests + 3 SUMMARYs | no Unicode emoji code points found | PASS |
| D-04 boundary (no `connection_id`) | `grep -c "connection_id" extension/utils/agent-registry.js` | 0 | PASS |
| D-01 boundary (no `extension/agents/` ref) | `grep -c "extension/agents/" extension/utils/agent-registry.js` | 0 | PASS |

All 10 spot-checks pass.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| AGENT-01 | 237-01-PLAN.md | Each new MCP session/task gets a unique `agent_id` minted by FSB via `crypto.randomUUID()`; callers cannot invent IDs | SATISFIED | `mintAgentId()` (`:172-181`) calls `crypto.randomUUID()`. `registerAgent` ignores opts. Test 3 asserts caller-supplied id rejected; UUID v4 RFC-4122 shape verified. |
| AGENT-02 | 237-02-PLAN.md, 237-03-PLAN.md | Agent registry mirrored to `chrome.storage.session` (write-through); survives MV3 SW eviction within a browser session | SATISFIED | `_persist()` write-through at all 4 mutation entry points + hydrate Step 5. Versioned envelope `{ v: 1, records }`. Tests 1-5, 7 verify round-trip and SW-eviction-simulation. |
| AGENT-03 | 237-02-PLAN.md, 237-03-PLAN.md | On SW wake, registry hydrates and reconciles against `chrome.tabs.query({})`, dropping ghost records before servicing requests | SATISFIED | `hydrate()` Steps 1-5 at `:385-467`. Reaping drops from BOTH Maps AND storage. Per-reason `rateLimitedWarn` category emission. Conservative on tabs.query failure. Tests 9-15 cover. Bootstrap call site is BEFORE any message handler servicing. |
| AGENT-04 | 237-01-PLAN.md | One MCP client may run multiple parallel agents simultaneously, each with its own `agent_id` | SATISFIED (data-structural half) | Registry is connection-agnostic in Phase 237 per D-04 (the lifecycle half lands in Phase 241). Test 4 (5 agents coexist) and test 5 (20-concurrent stress) confirm independent multi-agent registration. REQUIREMENTS.md correctly co-maps AGENT-04 to Phases 237 + 241; the data-structural contribution is fully shipped here. |

No orphaned requirements. All 4 REQ-IDs from REQUIREMENTS.md mapping to Phase 237 are covered by the plan-frontmatter `requirements` fields and have verified implementation evidence.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| -- | -- | -- | -- | None found |

Scans for `TODO|FIXME|XXX|HACK|PLACEHOLDER`, "not yet implemented", `return null` / `return []` rendered to UI, hardcoded empty defaults flowing to user surfaces, `console.log`-only handlers — all clean for the new module and integration sites. The module's `_resetForTests` test-only hook is documented inline (`:493-499`) and not invoked from production code (verified by grep).

The defensive `Math.random` fallback in `mintAgentId` (`:178-180`) is intentional defense-in-depth (documented in plan-01 SUMMARY); never triggers on Node 18+ or Chrome 92+.

### Human Verification Required

None. All structural integration is automated-tested. The optional manual UAT scenarios documented in 237-VALIDATION.md "Manual-Only Verifications" and 237-03-SUMMARY.md (load unpacked extension, pre-populate ghost record, force SW eviction, observe `[FSB AGT]` diagnostic ring entry) are informational sanity checks for downstream confidence — they are NOT required to certify Phase 237 against its goal, because:

1. The SW-eviction reconciliation behavior is unit-tested via fresh-required modules + chrome mock harness (test 7 simulates SW eviction; tests 9-10 verify ghost reaping; test 15 verifies degradation when `rateLimitedWarn` absent).
2. The `chrome.tabs.onRemoved` -> `releaseTab` integration is unit-tested via test 6 (idempotency) and test 7 (release path).
3. The boot-time hydrate path is unit-tested via test 7 + test 12 (hydrate-vs-register lock interleave).

The phase goal — "Single source of truth exists in the extension service worker for who owns which tab, survives MV3 service-worker eviction, and can be reasoned about by every later phase" — is achieved at the code level and verified by the test suite. Phase 240 will exercise the dispatch chokepoint (and is the right place for end-to-end SW-eviction UAT). Phase 244's regression suite will lock in cross-phase behavior.

### Gaps Summary

No gaps. Phase 237 is structurally and behaviorally complete:

- The keystone module is implemented at `extension/utils/agent-registry.js` (D-01 path), exports the 3-Map + mutex + helpers contract, and is loadable from both MV3 SW (`globalThis.FsbAgentRegistry`) and Node test harness (`module.exports`).
- Storage write-through covers all mutation entry points; envelope is versioned for forward-migration; empty-records removes the key.
- Hydrate reconciles against `chrome.tabs.query({})` with conservative posture on query failure; ghost drops are mirrored to storage and emit per-reason diagnostics through the existing Phase 211 LOG-04 ring buffer.
- `crypto.randomUUID()` mints IDs FSB-side; opts argument is ignored at registration.
- 25 unit tests (10 plan-01 + 15 plan-02) lock down CRUD, mutex serialization (20-concurrent stress), storage round-trip, SW-eviction simulation, ghost-record reaping, idempotency, and the lazy-reference diagnostic safety path.
- Background.js integration is purely additive: one new importScripts line (registry-before-dispatcher), one new bootstrap function + call site, one new standalone third onRemoved listener. The two existing onRemoved listeners (lines 2485 and 12664) are byte-for-byte unchanged per `git diff` evidence.
- All four user-locked decisions (D-01..D-04) are honored.
- No regressions in `npm test` (full chain green).
- No emojis introduced (project rule).

The phase delivers exactly what its goal demanded: a single source of truth for tab ownership, SW-eviction-resilient via storage write-through and hydrate reconciliation, ready to be reasoned about by Phase 238 (AgentScope), Phase 240 (dispatch enforcement), Phase 241 (pooling + reconnect grace), and Phase 243 (UI badge integration).

---

*Verified: 2026-05-05*
*Verifier: Claude (gsd-verifier)*
