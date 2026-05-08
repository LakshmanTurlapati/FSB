# Phase 238: AgentScope + Bridge Wiring - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md -- this log preserves the alternatives considered.

**Date:** 2026-05-05
**Phase:** 238-agentscope-bridge-wiring
**Areas discussed:** AgentScope mechanics, Payload threading shape, agent:release / agent:status route scope, Extension-side ignore posture

---

## AgentScope mechanics

### Q1: AgentScope lifetime -- how long does a single agent_id live?

| Option | Description | Selected |
|--------|-------------|----------|
| Per-process singleton | One agent_id per MCP server process; minted on first tool call, reused for the lifetime of the process. Matches ARCHITECTURE.md and milestone framing. | YES |
| Per session/task (ephemeral) | New agent_id minted at run_task start, released at completion. Breaks "one MCP client may run multiple parallel agents". | |
| Per tool invocation | Mint a fresh agent_id per call. Defeats the registry purpose. | |

**User's choice:** Per-process singleton

### Q2: Where does AgentScope get the clientLabel for agent:register?

| Option | Description | Selected |
|--------|-------------|----------|
| Defer label -- mint without it | clientLabel=null in P238; visual-session remains the only label-declaring path. | YES |
| Constructor arg from runtime.ts (env / cli) | Read FSB_MCP_CLIENT_LABEL at server boot. | |
| Lazy: capture from first start_visual_session call | Couples registration ordering to visual-session lifecycle. | |
| MCP initialize-handshake clientInfo.name | Pull from MCP protocol; doesn't 1:1 the FSB allowlist. | |

**User's choice:** Defer label

### Q3: How does ensure() handle concurrent first-call races?

| Option | Description | Selected |
|--------|-------------|----------|
| Cached promise | this._pending = registerCall(); concurrent callers await the same promise. | YES |
| Promise-chain mutex (mirror P237 pattern) | Re-use withRegistryLock shape. Over-engineering for one-shot init. | |
| Eager mint at server start | Call agent:register at startup. Couples boot to bridge availability. | |

**User's choice:** Cached promise

### Q4: What does AgentScope.ensure() do when agent:register fails?

| Option | Description | Selected |
|--------|-------------|----------|
| Throw, don't cache | Reject the ensure() promise; next call retries cleanly. | YES |
| Throw + cache the failure for short window | Cache rejection ~5s. Adds complexity for marginal benefit. | |
| Cache null and let tool calls proceed without agent_id | Nasty surprise when P240 enforcement lands. | |

**User's choice:** Throw, don't cache

---

## Payload threading shape

### Q1: Where does agent_id live on the wire format?

| Option | Description | Selected |
|--------|-------------|----------|
| Top-level of payload | { type, payload: { tool, params, agentId } }. Minimal change. | YES |
| Nested envelope under payload.agent | Future-proof but every handler relearns the shape. | |
| Bridge-level metadata, not payload | Wider blast radius -- types.ts and bridge.ts edits. | |

**User's choice:** Top-level of payload

### Q2: How is agent_id injected into payloads -- one helper or per-tool inline?

| Option | Description | Selected |
|--------|-------------|----------|
| Inline at each call site | Explicit, greppable, easy to audit at P244. | YES |
| Wrap bridge.sendAndWait in agent-aware helper | Hides the threading; harder to spot a missed call site. | |
| Patch bridge.sendAndWait directly | Wrong layering; couples bridge to server-tools concerns. | |

**User's choice:** Inline at each call site

### Q3: agents.ts currently has zero live tools -- what does threading mean for P238?

| Option | Description | Selected |
|--------|-------------|----------|
| Skip -- add an import comment marker only | Avoids inventing scaffolding nobody calls. | YES |
| Pre-stage a helper for Phase 242 | Minor over-engineering; back tool is one phase away. | |
| Drop agents.ts from SC #3 wording | Just document the intentional no-op. | |

**User's choice:** Skip -- add an import comment marker only

### Q4: Which call sites should AgentScope.ensure() be awaited at?

| Option | Description | Selected |
|--------|-------------|----------|
| Inside each tool handler, before sendAndWait | Lazy-mint per ROADMAP SC #1. | YES |
| Inside execAction() / queue.enqueue() funnels | Inconsistent across families that don't share a funnel. | |
| Eagerly at runtime startup (after bridge.connect) | Couples startup to bridge connectivity. | |

**User's choice:** Inside each tool handler, before sendAndWait

---

## agent:release / agent:status scope

### Q1: Does agent:release have a caller in Phase 238, or only a handler?

| Option | Description | Selected |
|--------|-------------|----------|
| Handler only -- no server-side caller | Phase 241 wires bridge onclose with reconnect grace. | YES |
| Handler + bridge.onclose -> agent:release | Without RECONNECT_GRACE_MS, releases too aggressively on transient blips. | |
| Handler + explicit MCP server SIGTERM hook | Irrelevant when extension SW also evicts state. | |

**User's choice:** Handler only -- no server-side caller

### Q2: What does agent:status return in Phase 238?

| Option | Description | Selected |
|--------|-------------|----------|
| Caller's agent only -- { agentId, agentIdShort, tabIds } | Echoes AgentScope's view + bound tabs (empty in P238). | YES |
| Full registry snapshot { agents[], cap, count } | Leaks cross-agent state before ownership enforcement. | |
| Minimal echo -- { agentId } only | Tests can't observe tab bindings. | |

**User's choice:** Caller's agent only

### Q3: Where does agentScope live in the runtime composition root?

| Option | Description | Selected |
|--------|-------------|----------|
| Add to FSBRuntime + thread into every register*Tools | Explicit DI; matches existing bridge/queue threading. | YES |
| Module-level singleton imported by tool files | Implicit global state; harder to test. | |
| Attach to bridge as bridge.agentScope | Mixes concerns and pollutes WebSocketBridge surface. | |

**User's choice:** Add to FSBRuntime + thread into every register*Tools

### Q4: Test surface for Phase 238?

| Option | Description | Selected |
|--------|-------------|----------|
| Unit + contract tests | AgentScope unit + 3 routes unit + contract pass + register-fires-once integration. | YES |
| Contract tests only -- trust unit coverage to come later | Cached-promise race semantics break silently if untested. | |
| Add an end-to-end multi-agent smoke now | Premature -- no enforcement to verify yet. | |

**User's choice:** Unit + contract tests

---

## Extension-side ignore posture

### Q1: How do existing extension handlers treat the new payload.agentId field?

| Option | Description | Selected |
|--------|-------------|----------|
| Read into a local var, don't act on it | Pre-stages P240 validation; small P240 diff. | YES |
| Silently drop -- do not even destructure | P240 grows the destructure plus the check. | |
| Log-and-drop (debug aid) | Adds debug noise via rateLimitedWarn. | |

**User's choice:** Read into a local var, don't act on it

### Q2: Which extension handlers need touching to receive the new payload shape gracefully?

| Option | Description | Selected |
|--------|-------------|----------|
| None -- destructure-by-default tolerates extra fields | JS ignores unknown keys; dispatcher passes payload opaquely. | YES |
| Audit all 8 message-route handlers + 25+ tool routes | Redundant work. | |
| Add a one-line agentId parameter to every handler signature | Couples P238 to P240 dispatcher refactor. | |

**User's choice:** None -- destructure-by-default tolerates extra fields

### Q3: Does Phase 238 mint any extension-side AgentRecord?

| Option | Description | Selected |
|--------|-------------|----------|
| agent:register calls agentRegistry.registerAgent() | Honors AGENT-01 server-side and on the dispatcher route. | YES |
| AgentScope mints client-side, sends agent_id along | Violates AGENT-01 ("FSB-side mint, callers cannot supply IDs"). | |
| Defer registry writes to Phase 241 | Wrong -- ROADMAP SC #2 explicitly says "resolve through the new AgentRegistry". | |

**User's choice:** agent:register calls agentRegistry.registerAgent()

### Q4: How does the v0.9.36 visual-session displacement contract interact with the new agent_id field?

| Option | Description | Selected |
|--------|-------------|----------|
| No change in P238 -- visual-session ignores agentId | Phase 240 adds OWN-04 cross-agent reject. | YES |
| Stash agentId on the visual-session record now (no enforcement) | Risk of regressing existing visual-session contract tests. | |

**User's choice:** No change in P238 -- visual-session ignores agentId

---

## Claude's Discretion

- Exact AgentScope public API shape (`ensure` / `current` / test-only `reset`)
- Exact wording of the TODO Phase 242 marker comment in agents.ts
- Test file locations (mcp/test/ unit/contract split)
- Logging cadence in AgentScope.ensure() ([FSB AgentScope] console errors)
- TypeScript strictness for the new agent_id field on payload types

## Deferred Ideas

- bridge.onclose -> agent:release with RECONNECT_GRACE_MS (Phase 241)
- clientLabel on AgentRecord (Phase 241 or 243)
- Visual-session storing agentId (Phase 240 OWN-04)
- Concurrency cap enforcement at agent:register (Phase 241)
- back MCP tool registration in agents.ts (Phase 242)
- End-to-end multi-MCP-process smoke (Phase 244)
- Per-agent queue scoping (later milestone)
- MCP initialize.clientInfo.name -> clientLabel (revisit when label sourcing returns)
