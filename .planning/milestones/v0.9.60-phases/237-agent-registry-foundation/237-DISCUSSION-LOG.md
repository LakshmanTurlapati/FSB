# Phase 237: Agent Registry Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md -- this log preserves the alternatives considered.

**Date:** 2026-05-05
**Phase:** 237-agent-registry-foundation
**Areas discussed:** Module location & namespace, agent_id format & log readability, Reconciliation on stale records, AGENT-04 scope split (237 vs 241)

---

## Module location & namespace

| Option | Description | Selected |
|--------|-------------|----------|
| `extension/utils/` (Recommended) | Co-locate next to `mcp-visual-session.js` for direct v0.9.36 pattern parity. Deprecated `extension/agents/` namespace stays as-is with sunset code. | OK |
| `extension/agents/` | Reclaim the deprecated namespace -- live registry coexists alongside commented-out bg-agent files. Risks confusion; would suggest renaming agents/ later. | |
| `extension/runtime/` (new) | Create a new directory for multi-agent/runtime concerns. Cleanest separation but introduces a fresh namespace. | |
| `extension/lib/` | Place alongside other lib utilities. Less specific than utils/ but still neutral. | |

**User's choice:** `extension/utils/` (recommended)
**Notes:** Pattern parity with v0.9.36 wins -- `mcp-visual-session.js` is the reference implementation. Deprecated `extension/agents/` namespace is left untouched with its sunset annotation.

---

## agent_id format & log readability

| Option | Description | Selected |
|--------|-------------|----------|
| Hybrid (Recommended) | Full UUID stored internally (`agent_550e8400-...`); short 6-char prefix surfaced in logs and the badge (`agent_550e84`). Collision-proof + readable. | OK |
| Full UUID everywhere | `agent_<full-uuid>` in every surface. Ugly in logs and badges but zero ambiguity. | |
| Short hex only | `agent_a3f1c2` (6 hex). Readable; collision risk is negligible at cap <=64 but theoretically possible across long sessions. | |

**User's choice:** Hybrid
**Notes:** Full UUID internal canonical key; `formatAgentIdForDisplay` helper provides 6-char short prefix for any user-facing surface.

---

## Reconciliation on stale records

| Option | Description | Selected |
|--------|-------------|----------|
| Drop + diagnostic (Recommended) | Drop the record + emit a structured `agent:reaped { agentId, tabId, reason }` event so future telemetry / dashboards can see reaping rate. Cheap; surfaces silent state loss. | OK |
| Drop silently | Minimal code, no observability. Risk: future bugs that leak ownership go undetected. | |
| Tombstone briefly | Hold the record for 30s in case the tab is restored from BF cache or reopened. More code; rarely useful since reopened tabs get new tab_ids. | |

**User's choice:** Drop + diagnostic
**Notes:** Reuse Phase 211 LOG-04 ring-buffer infrastructure (`chrome.storage.local.fsb_diagnostics_ring`, `redactForLog`, rate-limited 1/10s). New layer prefix `[FSB AGT]`.

---

## AGENT-04 scope split (237 vs 241)

| Option | Description | Selected |
|--------|-------------|----------|
| Registry allows N independent agent_ids; 241 wires connection_id (Recommended) | 237 keeps registry connection-agnostic -- each agent_id is independent. Phase 241 layers `connection_id` onto records when wiring reconnect-grace + bridge `onclose` handler. | OK |
| 237 stores agent_id + optional connection_id field | Registry knows about connection_id from day one (just a field; no behavior). Phase 241 still owns the lifecycle wiring around it. Slightly more upfront work; clearer schema. | |
| Defer entirely to Phase 238 | Phase 237 mints agent_ids but doesn't model multi-per-client at all. Phase 238 (AgentScope) introduces the relationship between MCP process and agent_ids. | |

**User's choice:** Registry allows N independent agent_ids; 241 wires connection_id
**Notes:** Co-mapped requirement -- 237 satisfies the data-structural side of AGENT-04; 241 satisfies the lifecycle side. No `connection_id` field added to `AgentRecord` in 237.

---

## Claude's Discretion

The user did not weigh in on the following; planner has flexibility:

- Storage key name (recommend `fsbAgentRegistry`; versioned payload `{ v: 1, records: { ... } }`)
- Mutex implementation shape (recommend promise-chain mutex; no async-mutex lib)
- Test surface conventions (recommend new `tests/agent-registry.test.js` matching existing FSB test pattern)
- Public API export shape
- Generation counter stub on records (Phase 240 owns the actual tombstone consumption)

## Deferred Ideas

- `connection_id` field on `AgentRecord` -- Phase 241
- Ownership token consumption / tombstone semantics -- Phase 240
- Telemetry rollup of reaping rate (dashboard surface) -- post-v0.9.60
- Per-agent rate-limiting / queueing -- post-v0.9.60
- Stuck-slot reaping / idle timeout -- explicit non-feature, OUT OF SCOPE
- Schema migration tooling -- not needed in 237 (no v0 to migrate from)
