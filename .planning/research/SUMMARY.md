# Project Research Summary

**Project:** FSB v0.9.60 -- Multi-Agent Tab Concurrency (MCP 0.8.0)
**Domain:** Chrome MV3 extension + npm-published TypeScript MCP server (`fsb-mcp-server@0.7.4` -> `0.8.0`)
**Researched:** 2026-05-05
**Confidence:** HIGH (every researcher walked the existing FSB codebase; convergent recommendations)

---

## Executive Summary

FSB's v0.9.60 milestone -- per-session agent identity, tab ownership, hard cap of 8, forced-new-tab pooling, lock release on task end / MCP disconnect / user closes tab, a new `back` tool, and `fsb-mcp-server@0.8.0` (including Phase 236 `run_task` return-on-completion) -- is fundamentally an **integration + invariant-enforcement milestone**, not a stack-expansion milestone. Every new capability can be implemented with already-installed dependencies (`@modelcontextprotocol/sdk`, `ws`, `zod`, `chrome.*` APIs), Node + Chrome built-ins (`crypto.randomUUID`, `chrome.storage.session`, `chrome.tabs.{create,goBack,onCreated,onRemoved}`, `chrome.windows.onRemoved`), and hand-rolled in-memory data structures mirroring the existing `activeSessions` / `MCP_VISUAL_SESSION_STORAGE_KEY` patterns. The only npm change is bumping `@modelcontextprotocol/sdk` from `^1.27.1` to `^1.29.x` and bumping `fsb-mcp-server` itself to `0.8.0`. **No new manifest permissions are required.**

The recommended approach is to build a single keystone module -- `extension/agents/agent-registry.js` -- that owns three Maps (`agents`, `tabOwners`, `tabsByAgent`), persists to `chrome.storage.session`, hydrates with reconciliation against `chrome.tabs.query({})` on every SW wake, and is gated by a single promise-chained mutex (`withRegistryLock`). Every MCP tool dispatch flows through one chokepoint (`mcp-tool-dispatcher.js:113`) where ownership is verified before any handler runs; cross-agent calls reject loudly with typed errors (`AGENT_CAP_REACHED`, `TAB_NOT_OWNED`, `NO_BACK_HISTORY`, etc.). Phase 236 is **independent** of multi-agent work and ~90% already implemented (the `fsbAutomationLifecycleBus` completion bus exists from Phase 225-01); the remaining change is raising the 300s ceiling at `mcp-bridge-client.js:680` and `mcp/src/tools/autopilot.ts:58` to a 600s safety net while heartbeats drive the actual return.

The dominant risks are concurrency invariants, not feature scope: **(1) cap-of-8 TOCTOU** between `await` points (mitigated by a synchronous critical section + `withRegistryLock`); **(2) tab-ID reuse** by Chromium creating cross-agent corruption (mitigated by an `ownershipToken` UUID per claim, verified inside the same microtask as dispatch); **(3) pool-shrink-vs-release confusion** when one tab in an agent's pool closes (closing one tab shrinks the pool, only `pool.size === 0` releases the agent); **(4) MCP transport disconnect vs session disconnect** (10-15s grace window keyed by `connection_id` distinguishes a network blip from a real client end). The v0.9.36 visual-session contract is preserved verbatim with one one-line cross-agent rejection in `startSession`; trusted-client badges get the agent ID appended (closes the v0.9.36 deferred "MCP visual sessions can be coordinated safely across multiple tabs" gap).

---

## Key Findings

### Recommended Stack

The stack is **frozen** for v0.9.60 except for two version bumps. Every researcher independently converged on "no new dependencies" -- the existing toolkit (`crypto.randomUUID`, `chrome.storage.session`, `chrome.tabs` APIs, `AbortController`, the existing `WebSocketBridge` and `TaskQueue`) covers every milestone capability.

**Core technologies (unchanged):**
- `@modelcontextprotocol/sdk` -- bumping `^1.27.1` -> `^1.29.x`. Compatible upgrade; progress-notification API unchanged. **Why:** active upstream + bug fixes since Feb 2026; required for Zod 3 peer-dep compatibility (do **not** bump to Zod 4).
- `crypto.randomUUID()` -- agent IDs (`agent_<uuid>`), task IDs, ownership tokens. **Why:** built into Node 18+ and Chrome MV3 SWs (no polyfill); ~3-12x faster than the `uuid` package; zero new deps.
- `chrome.storage.session` -- agent-registry mirror (in-memory, browser-lifetime; cleared on browser restart). **Why:** matches "lock release on disconnect" semantics; `local` storage would leak stale ownership across restarts.
- `chrome.tabs.goBack(tabId)` -- new `back` tool implementation. **Why:** already used at `mcp-tool-dispatcher.js:326`; works on background tabs without debugger attach.
- `fsb-mcp-server` -- self-bump to `0.8.0`. **Why:** milestone deliverable. `back` is additive; Phase 236 changes return semantics but is backward-compatible.

**Stack additions:** **none.** Explicit rejects: `async-mutex`/`p-queue`/`p-limit` (use a one-line promise-chain mutex), `uuid`/`ulid`/`nanoid` (use `crypto.randomUUID`), `lru-cache` (N=8 needs explicit lifecycle, not eviction), Zod 4 (breaks MCP SDK), TypeScript build for the extension (intentionally vanilla ES2021+).

### Expected Features

The feature contract is well-anchored on Browserbase Contexts, Playwright `BrowserContext`, Puppeteer-Cluster, Browser Use, and Stagehand v3 (HIGH-confidence primary docs). FSB's distinct posture: shared Chrome profile (single window), no idle timeout (interactive), tab-ownership lock instead of per-context isolation.

**Must have (table stakes):**
- **Per-agent ID** -- FSB-side `crypto.randomUUID()`, returned on `run_task`/manual session start, threaded through every tool call. Caller cannot invent IDs.
- **Tab ownership map** (`tabId -> agentId`) -- persisted in `chrome.storage.session`, mirrored in-memory.
- **Tool-dispatch ownership gate** -- single chokepoint in `mcp-tool-dispatcher.js`; cross-agent reject with `TAB_NOT_OWNED`.
- **Forced-new-tab pooling** -- `chrome.tabs.onCreated` + `openerTabId`; child tabs auto-pool under the originating agent.
- **Hard concurrency cap (8)** -- typed `AGENT_CAP_REACHED { cap: 8, active: N }`. Fail-loud, no silent queueing.
- **Lock release on (a) task end via existing `finalizeSession` (b) MCP client disconnect via bridge `onclose` + grace window (c) `chrome.tabs.onRemoved`.** Explicit "no idle timeout."
- **Background-tab execution** -- audit existing 25+ tools for `tabs.update({active:true})` side effects; gate behind explicit `force_foreground` flag (default false).
- **Typed errors** -- `AGENT_NOT_FOUND`, `TAB_NOT_OWNED`, `AGENT_CAP_REACHED`, `TAB_NOT_FOUND`, `AGENT_RELEASED`, `NO_BACK_HISTORY`, `NAVIGATION_TIMEOUT`.
- **`back` MCP tool** -- single-step (`chrome.tabs.goBack`), ownership-gated, structured result (`ok` | `no_history` | `cross_origin` | `bf_cache` | `fragment_only`). Not multi-step (`back(n)` is an anti-feature). No `forward` companion in v0.9.60 (defer).
- **MCP tool description updates** -- agent ID required, tab IDs are agent-scoped, cap is 8, ownership enforced. Updated for `run_task`, all manual tools, and `back`.
- **`fsb-mcp-server@0.8.0` release** -- includes Phase 236 (`run_task` returns on completion).

**Should have (differentiators):**
- **Trusted-client badge surfaces agent ID** -- extend v0.9.36 badge renderer to append short agent ID (e.g., "Claude / agent_a3f1"). Closes v0.9.36 deferred badge/glow-collision gap.
- **Per-agent overlay glow distinction** -- two parallel agents on different tabs both render correctly without stomping each other (largely an audit/regression-test problem on existing code).

**Defer (v0.9.61+):**
- `forward` MCP tool, pool-listing tool (`list_my_tabs`), per-agent dashboard preview pane, badge color-bucketing per agent.

**Anti-features (explicitly rejected):**
- Cross-window or incognito agent isolation, headless server-side workers, agent-to-agent messaging, idle timeout reaping, auto-promotion of orphaned tabs, per-agent fingerprint/stealth, dirty-form `back` confirmation, multi-step `back(n)`, cross-agent `back`.

### Architecture Approach

The architecture is a **keystone-module + chokepoint** design. One new file (`extension/agents/agent-registry.js`) owns all ownership state; one existing dispatcher (`extension/ws/mcp-tool-dispatcher.js:113`) gates every MCP tool call; one new server-side helper (`mcp/src/agent-scope.ts`) mints `agentId` per MCP process and threads it through every `bridge.sendAndWait` payload. The visual-session manager (`extension/utils/mcp-visual-session.js`) composes **beneath** ownership: agent ownership is the gate, visual session is the surface; on conflict, a one-line check in `startSession` rejects with `tab_owned_by_other_agent` instead of silently displacing.

**Major components:**
1. **`extension/agents/agent-registry.js` (NEW)** -- single source of truth. Maps: `agents (agentId -> AgentRecord)`, `tabOwners (tabId -> agentId)` *authoritative*, `tabsByAgent (agentId -> Set<tabId>)`. `chrome.storage.session` mirror. `hydrate()` reconciles against `chrome.tabs.query({})` on SW wake, dropping ghost records. `withRegistryLock` (promise-chain mutex) serializes all cap-affecting operations.
2. **`mcp-tool-dispatcher.js` (MODIFIED, single chokepoint)** -- accept `agentId` on every route input; resolve target tab; call `agentRegistry.isOwnedBy(tabId, agentId)`; reject mismatch with typed error before invoking `route.handler`. Bind newly-opened tabs into the pool inside the same dispatch function.
3. **`mcp/src/agent-scope.ts` (NEW)** -- per-MCP-process agent identity. One `AgentScope` instance per process; `ensure(bridge)` mints `agentId` lazily on first tool call via a new `agent:register` bridge message; threaded into every tool registration in `autopilot.ts`, `manual.ts`, `visual-session.ts`, `agents.ts`.
4. **Tab-lifecycle hooks (MODIFIED)** -- existing `chrome.tabs.onRemoved` handlers at `background.js:2455` and `:12616` get a third call-site that invokes `agentRegistry.releaseTab(tabId)`; `chrome.tabs.onCreated` listener checks `openerTabId` for pool inheritance; `chrome.windows.onRemoved` is iterated through per-tab path (no shortcut, preserves pool-shrink invariant).
5. **`fsbAutomationLifecycleBus` (REUSE)** -- already exists from Phase 225-01 (`background.js:2010`). Phase 236 piggybacks: extend `mcp-bridge-client.js:678-680` to settle on the bus event; raise the 300s ceiling to 600s as a safety net (don't remove entirely until cleanup-path audit confirms zero dropped events).
6. **`mcp/src/tools/agents.ts` (MODIFIED)** -- adds `back` tool registration. Implementation is essentially an alias for the existing `go_back` route in `mcp-tool-dispatcher.js:312` -- the work is already done; the new tool just ownership-gates it and adds structured result codes.

### Critical Pitfalls

The pitfalls research identified 12 risks; the five with highest blast radius:

1. **Cap enforcement TOCTOU between `await` points** -- two concurrent `claimSlot` calls each see `count===7`, both pass, both add, registry grows past 8. **Mitigation:** all cap-affecting ops go through a single `withRegistryLock` promise-chain mutex; cap check + insert happen synchronously against the in-memory registry before any `await`; storage writes are post-success side effects with an optimistic-concurrency version counter.

2. **Tab-ID reuse + `onRemoved` race** -- Chromium does reuse `tabId`s within a session. Agent A dispatches `click` to T1; T1 closes; cap drops; Agent B's `chrome.tabs.create` returns the same numeric `tabId`; A's queued click corrupts B's tab. **Mitigation:** every dispatch carries an `(agentId, tabId, ownershipToken)` triple where `ownershipToken` is a UUID minted at claim time; the registry check + `chrome.tabs.sendMessage` happen in the same microtask (no `await` between); `onRemoved` sets a tombstone before deletion; `chrome.tabs.create` returning a tombstoned `tabId` increments a generation counter.

3. **Agent registry in-memory only dies with the MV3 service worker** -- after SW eviction (30s idle target), naive in-memory Maps are empty; reconnecting agents either get rejected ("unknown agent") or silently re-allocated, leaking the original's tab into ghost-locked state and corrupting cap accounting. **Mitigation:** `chrome.storage.session` is the source of truth; in-memory is a write-through cache; every SW wake runs a reconciliation pass calling `chrome.tabs.get(tabId)` for each persisted record and dropping unresolvable ones before servicing any new request.

4. **MCP transport disconnect vs session disconnect** -- a 2-5s network blip drops the WS bridge; a naive disconnect handler immediately releases all locks, but the client reconnects and finds "no such agent." Conversely, a "never release on disconnect" policy leaks all 8 slots when an MCP client crashes. **Mitigation:** distinguish transport-disconnect from session-end with a 10-15s grace window keyed by `connection_id` (UUID minted at first connect, persisted by the client); during the grace window, locks are held but new actions rejected; reconnect within window restores; expiry fully releases.

5. **Phase 236 long-poll vs MCP host client timeouts** -- removing the 300s ceiling without heartbeats hangs MCP host clients (Claude Code, Cursor) which impose their own 30s-5min per-tool timeouts. The model sees "tool failed" and may launch a duplicate task. **Mitigation:** keep an outer 30-min configurable wall-clock timeout (raised from 300s, not removed); ensure progress messages flow at least every 30s via heartbeat ticks; persist task lifecycle in `chrome.storage.session` keyed by `taskId` so SW wake can resume.

Other pitfalls of note (covered in PITFALLS.md): pool over-/under-release (one-tab-close should shrink pool, not release agent), incognito/cross-window invariant violations (manifest `not_allowed` opt-out + dispatch-boundary reject), background-tab throttling for `setTimeout`/rAF/IntersectionObserver/focus-dependent inputs (per-tool `force_foreground` flag), dashboard live-preview multi-agent surface (single-stream + click-to-switch -- multi-stream is OUT OF SCOPE), `back` on a fresh `chrome.tabs.create` tab (history-depth precheck + `no_history` typed result), single-agent regression via implicit-vs-explicit `agent_id` (legacy wrapper synthesizes `agent_id = 'legacy:popup'` etc.), user-vs-agent action collision on background tabs (treat user `webNavigation.onCommitted` as a pause signal).

---

## Implications for Roadmap

### Reconciled Phase Build Order

The architecture researcher proposed 7 phases (A-G); the pitfalls researcher proposed 11 (A-K). Reconciling: **the architecture order is correct for build dependencies; the pitfalls phases collapse into the architecture phases as concerns within them.** The synthesizer's recommended structure is **8 phases** (architecture A-G + a final hardening sweep), with explicit pitfall-coverage callouts inside each.

### Phase 1: Agent Registry Foundation
**Rationale:** Every later phase depends on this module existing. No behavior change; new module isolated. Build first because A->D dependency is non-negotiable.
**Delivers:** `extension/agents/agent-registry.js` with full Map API, `chrome.storage.session` write-through persistence, `hydrate()` with `chrome.tabs.query({})` reconciliation, `withRegistryLock` promise-chain mutex, version counter. `chrome.tabs.onRemoved` wired to `releaseTab` (no enforcement yet). Unit tests cover registry CRUD, storage round-trip, simulated SW eviction + wake, 20-concurrent-claim stress test capping at 8.
**Addresses (FEATURES.md):** Per-agent ID issuance, tab ownership map.
**Avoids (PITFALLS.md):** P1 (registry dies with SW), P6 (cap TOCTOU), P3 (pool over/under-release groundwork via `Set<tabId>` per record).

### Phase 2: Bridge Messages + AgentScope (server-side wiring, no enforcement)
**Rationale:** Sets up data flow before any gate trips. Additive; all existing tools still work.
**Delivers:** `mcp/src/agent-scope.ts` (per-process singleton); `agent:register` / `agent:release` / `agent:status` routes added to `MCP_PHASE199_MESSAGE_ROUTES`; `agentId` threaded through every tool registration in `autopilot.ts`, `manual.ts`, `visual-session.ts`. Extension still ignores `agentId` in dispatch.
**Uses (STACK.md):** Existing `WebSocketBridge`, `crypto.randomUUID`, no new deps.
**Avoids (PITFALLS.md):** P11 groundwork (defines the `agent_id` contract before legacy paths break).

### Phase 3: Phase 236 (`run_task` Return-on-Completion) -- INDEPENDENT
**Rationale:** Decoupled from multi-agent work; lower-risk to land alone before adding new gates; **also unblocks the `fsb-mcp-server@0.8.0` release independently** if D-G slip. Can run in parallel with Phase 1 or 2.
**Delivers:** `mcp-bridge-client.js:678-680` raised from 300s to 600s safety net; `mcp/src/tools/autopilot.ts:58` `bridge.sendAndWait({ timeout: 600_000, onProgress })`; cleanup-path audit ensures every `cleanupSession` exit emits the lifecycle event; 30s heartbeat ticks added to `_sendProgress` when no real progress arrives; task lifecycle persisted in `chrome.storage.session` keyed by `taskId`. UAT: 5 long tasks return on completion not on timeout.
**Uses (STACK.md):** Existing `fsbAutomationLifecycleBus`, `chrome.storage.session`.
**Avoids (PITFALLS.md):** P10 (long-poll timeouts under MCP transports, SW eviction during long task).

### Phase 4: Tab-Ownership Enforcement on Dispatch
**Rationale:** Highest-risk phase -- every MCP call now flows through the gate. Phase 1, 2, and 3 must all be in before this lands or every MCP call fails.
**Delivers:** `mcp-tool-dispatcher.js:113` (`dispatchMcpToolRoute`) verifies `agentRegistry.isOwnedBy(tabId, agentId)` before invoking handler; `(agentId, tabId, ownershipToken)` triple verified in same microtask as dispatch; `mcp-tool-dispatcher.js:289/312/345` (`handleNavigateRoute`, `handleNavigationHistoryRoute`, `handleOpenTabRoute`) call `agentRegistry.bindTab(agentId, newTabId)` BEFORE returning success; `mcp-visual-session.js:90` gets cross-agent rejection one-liner; `handleStartAutomation` and `handleStopAutomation` scope to `agentId`; explicit incognito reject (`chrome.tabs.get(...).incognito === true`) at dispatch boundary; `manifest.json` audit confirms `incognito` posture.
**Addresses (FEATURES.md):** Tool-dispatch ownership gate, cross-agent reject with typed errors.
**Avoids (PITFALLS.md):** P2 (tab-ID reuse + `onRemoved` race via ownershipToken in same microtask), P4 (incognito/cross-window opt-out), P11 (single-agent regression via legacy `agent_id = 'legacy:popup'` wrapper synthesis).

### Phase 5: Forced-New-Tab Pooling + Cap Enforcement + Reconnect Grace
**Rationale:** Builds on Phase 4's gate. Lock-release semantics are the trickiest correctness invariant in the milestone -- splits naturally from Phase 4 because 4 is per-call gating and 5 is lifecycle.
**Delivers:** `chrome.tabs.onCreated` listener checks `openerTabId` and calls `bindTab(forced:true)`; `bindTab` rejects with `AGENT_CAP_REACHED { cap: 8, active: N }` when `agents.size >= 8`; bridge `onclose` handler with 10-15s `RECONNECT_GRACE_MS` keyed by `connection_id`; idempotent + commutative `chrome.tabs.onRemoved` handler that sets a tombstone before deletion and only releases the agent when `pool.size === 0`; `chrome.windows.onRemoved` iterates per-tab through the same code path.
**Addresses (FEATURES.md):** Hard cap, pooling, lock release on disconnect/close.
**Avoids (PITFALLS.md):** P3 (pool over/under-release), P5 (transport vs session disconnect grace), P6 (cap stress at saturation).

### Phase 6: `back` Tool
**Rationale:** Thin wrapper over existing `go_back` route; depends on Phase 4's enforcement infrastructure but is otherwise trivial.
**Delivers:** `back` registered in `mcp/src/tools/agents.ts`; ownership check via Phase 4 gate; `chrome.scripting.executeScript({ func: () => history.length })` precheck before `chrome.tabs.goBack`; structured result (`{ status: 'ok' | 'no_history' | 'cross_origin' | 'bf_cache' | 'fragment_only', resultingUrl, historyDepth }`); `pageshow`-based "did the page actually change" verification with 2s timeout; cross-origin re-injection through existing v0.9.11 BF-cache path; tool description documents the contract.
**Addresses (FEATURES.md):** `back` MCP tool single-step.
**Avoids (PITFALLS.md):** P9 (`back` on `chrome.tabs.create`-opened tab with empty history).

### Phase 7: Background-Tab Execution Audit + UI/Badge Integration
**Rationale:** Quality bar more than feature; high-value low-glamour. v0.9.36 badge work is finishing the deferred gap.
**Delivers:** Audit of all 25+ existing tools for `tabs.update({active:true})` side effects; per-tool `force_foreground` flag in `tool-definitions.cjs`; long `setTimeout`-based waits >1s swapped to `chrome.alarms`; `webNavigation.onCommitted` user-collision detection; v0.9.36 trusted-client badge renderer extended to append short agent ID; sidepanel/popup get read-only "owned by Agent X" badge (no enforcement -- option 3 from architecture research).
**Addresses (FEATURES.md):** Background-tab execution, agent ID in badge (differentiator).
**Avoids (PITFALLS.md):** P7 (background-tab throttling), P12 (user-vs-agent collision), P8 dashboard subset (single-stream contract).

### Phase 8: Hardening + Regression Sweep + 0.8.0 Release
**Rationale:** Belt-and-suspenders before publishing. Validates the contract under stress.
**Delivers:** Full e2e: 8 agents in parallel, 9th rejected, all 8 release on disconnect; existing MCP/visual-session/dashboard contract tests pass unchanged; multi-agent variants added as new tests; reconciliation tests across SW eviction; `mcp/package.json` + `mcp/server.json` bumped to `0.8.0`; CHANGELOG; README; `fsb-mcp-server@0.8.0` published.
**Addresses (FEATURES.md):** Release engineering.
**Avoids (PITFALLS.md):** P11 final guard (single-agent regression sweep before release).

### Phase Ordering Rationale

- **Phase 1 -> 4 is non-negotiable.** The dispatch gate cannot enforce against a non-existent registry.
- **Phase 2 -> 4 is non-negotiable.** The server can't pass `agentId` if `AgentScope` doesn't exist.
- **Phase 3 is independent and parallelizable.** It can land in parallel with Phase 1 or 2; ship with `0.8.0` even if 4-7 slip.
- **Phase 4 -> 5 and 4 -> 6.** Cap enforcement and `back` both rely on the dispatch gate.
- **Phase 7 absorbs the v0.9.36 deferred badge gap.** Combining the background-tab audit with the badge work is opportunistic but coherent.
- **Phase 8 is the only place where "everything composes" is verified.** Holding the release here de-risks the npm publish.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 4:** Legacy `agent_id` wrapper synthesis (`legacy:popup`, `legacy:sidepanel`, `legacy:autopilot`) is a known-unknown -- needs an enumeration pass over every place that calls `chrome.runtime.sendMessage` with implicit "the current agent." Plan a `/gsd-research-phase` for this.
- **Phase 5:** `RECONNECT_GRACE_MS` value (10s vs 15s vs 30s) is open. Calibrate from observed bridge reconnect latency on `Refinements`.
- **Phase 7:** The 25+ tool audit for foreground side effects is enumerative work; not "research" per se but needs a checklist before writing code.

Phases with standard patterns (skip research-phase):
- **Phase 1, 2, 3, 6, 8:** Direct ports of existing patterns / additive tool registration / known-good regression sweep.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All researchers verified against `mcp/package.json`, `extension/manifest.json`. MEDIUM only on the exact `1.29.x` minor (web-verified, not Context7-verified). |
| Features | HIGH | Browserbase, Playwright, Browser Use, Stagehand, Puppeteer-Cluster citations are primary docs. MEDIUM on Project Mariner specifics (no published API; product copy). |
| Architecture | HIGH | Codebase walked line-by-line for `extension/background.js`, `extension/ws/mcp-tool-dispatcher.js`, `extension/utils/mcp-visual-session.js`, `extension/ws/mcp-bridge-client.js`, `mcp/src/tools/*`. |
| Pitfalls | HIGH | Code anchors verified for all 12 pitfalls (line numbers cited). MEDIUM on background-tab throttling exact thresholds and MCP host-client per-tool timeouts. |

**Overall confidence:** HIGH. Convergence across all four researchers on every significant decision (storage choice, dispatch chokepoint, mutex pattern, `chrome.tabs.goBack` for `back`, no new npm deps, MCP SDK 1.27 -> 1.29, Phase 236 separability) is the strongest signal.

### Gaps to Address

- **`RECONNECT_GRACE_MS` calibration** -- pick during Phase 5 planning based on `Refinements` branch observed reconnect latency (1-2s typical). Default recommendation 10s.
- **Per-agent queue vs one-process-one-queue** -- Recommendation: keep one-process = one-agent for v0.9.60; revisit per-agent queues in a later milestone.
- **Cleanup-path audit completeness for Phase 236** -- the 300s safety net is raised to 600s rather than removed because audit completeness across every `cleanupSession` exit is a known risk.
- **Sidepanel/popup integration scope** -- Recommend Option 3 (read-only "owned by" badge, no enforcement). User may want full integration. Flag for requirements scoping.
- **Cap reached: queue or reject?** -- Confirmed reject (matches milestone brief). Queueing is anti-feature.
- **Multi-agent live-preview** -- Declared OUT OF SCOPE for v0.9.60 (single-stream + click-to-switch).

---

## Sources

### Primary (HIGH confidence)
- `extension/background.js` (lines 1981, 2010-2034, 2082, 2455, 6175, 6742, 12616) -- session/tab lifecycle, lifecycle bus
- `extension/ws/mcp-tool-dispatcher.js` (lines 19-65, 113, 203, 282, 312-343) -- routing chokepoint
- `extension/ws/mcp-bridge-client.js` (lines 600-740) -- completion bus subscription, 300s timeout
- `extension/utils/mcp-visual-session.js` (lines 4-17, 50, 85-200, 563-589) -- v0.9.36 contract pattern
- `mcp/src/tools/autopilot.ts:23-99` -- `run_task` registration, 300s ceiling
- `mcp/src/tools/manual.ts:19-83` -- execAction funnel
- `mcp/src/queue.ts` -- existing TaskQueue serialization
- `mcp/src/bridge.ts:153-189` -- `sendAndWait` + onProgress
- `mcp/package.json` -- dependency baseline
- `extension/manifest.json` -- permissions audit (no new perms required)
- `.planning/PROJECT.md` (lines 26-44) -- v0.9.60 milestone scope
- @modelcontextprotocol/sdk releases & docs -- `notifications/progress` semantics, transport lifecycle
- Chrome for Developers: chrome.tabs, chrome.storage.session, service-worker lifecycle
- MCP spec 2025-03-26: Progress utility (`progressToken`, no protocol timeout)
- Playwright BrowserContext API + Navigations docs (`page.goBack` semantics)
- Browserbase Contexts docs, Stagehand v3 GitHub, Browser Use GitHub, Puppeteer-Cluster GitHub

### Secondary (MEDIUM confidence)
- Project Mariner DeepMind / TechCrunch / DataCamp (product copy, not API)
- npm package version observations for `@modelcontextprotocol/sdk@1.29.x` (web-verified)
- Background-tab throttling thresholds (Chrome heuristics shift across releases)
- MCP host-client per-tool timeouts (vary by host: Claude Code, Cursor, Codex, OpenClaw)
- Chromium tab-ID reuse semantics (documented as "do not assume unique" but exact reuse cadence is implementation-detail)

---

*Research synthesized: 2026-05-05*
*Ready for requirements: yes*
*Detail in: STACK.md, FEATURES.md, ARCHITECTURE.md, PITFALLS.md*
