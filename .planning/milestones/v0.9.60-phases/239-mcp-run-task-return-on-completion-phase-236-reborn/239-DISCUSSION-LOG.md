# Phase 239: MCP `run_task` Return-on-Completion - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md -- this log preserves the alternatives considered.

**Date:** 2026-05-06
**Phase:** 239-mcp-run-task-return-on-completion-phase-236-reborn
**Areas discussed:** Heartbeat payload shape, chrome.storage.session persistence granularity, SW-wake resume semantics, 600s safety-net firing behavior

---

## Gray Area Selection

| Option | Description | Selected |
|--------|-------------|----------|
| Heartbeat payload shape | Minimal vs progress-rich vs two-tier | Yes |
| chrome.storage.session persistence granularity | Minimal vs rich snapshot vs append-only event log | Yes |
| SW-wake resume semantics | Settle from persisted state vs keep running vs explicit sw_evicted | Yes |
| 600s safety-net firing behavior | Reject vs partial_outcome vs probe-then-decide | Yes |

**User's choice:** All four areas selected for discussion.

---

## Heartbeat payload shape

| Option | Description | Selected |
|--------|-------------|----------|
| Progress-rich | {timestamp, sessionId, taskId, alive, step, elapsed_ms, current_url, ai_cycles, last_action}; MCP hosts get real-time visibility; couples MCP server to extension internals more tightly | Yes |
| Minimal | {timestamp, sessionId, taskId, alive: true} only; simpler wire format; decouples server from extension internals | |
| Two-tier | Minimal default; rich payload only when run_task caller passes verbose: true | |

**User's choice:** Progress-rich (Recommended).
**Notes:** FSB already exposes the rich fields via `_sendProgress`, so no new extension surface needed. Hosts (Claude Code, Cursor, OpenClaw) benefit from real-time signal on long tasks. -> D-01.

### Follow-up: Wire shape for the rich fields

| Option | Description | Selected |
|--------|-------------|----------|
| Stuff into _meta block | notifications/progress with rich object under `_meta`; spec-clean MCP escape hatch | Yes |
| Stringify as `message` field | Carry rich object as JSON inside top-level `message`; works on every host but ugly literal | |
| Two parallel notifications | Standard notifications/progress + custom fsb/heartbeat with rich payload; doubles wire traffic | |

**User's choice:** Stuff into _meta block (Recommended). -> D-02.

---

## chrome.storage.session persistence granularity

| Option | Description | Selected |
|--------|-------------|----------|
| Rich snapshot | Mirrors v0.9.36 visual-session shape; enables resume-and-decide on SW wake | Yes |
| Minimal | Only {task_id, status, last_heartbeat_at, final_result?}; cheapest; loses smart-resume context | |
| Append-only event log | {task_id, events: [...]} log; heaviest; best forensics; overkill for SW-wake recovery | |

**User's choice:** Rich snapshot (Recommended). -> D-03.
**Notes:** Mirrors the v0.9.36 visual-session pattern (extension/utils/mcp-visual-session.js) and the Phase 237 agent-registry pattern. Both have proven survivable across SW eviction.

### Follow-up: Write cadence

| Option | Description | Selected |
|--------|-------------|----------|
| Every heartbeat tick + every state transition | ~2 writes/min steady state plus terminal events; SW wake always finds a snapshot at most 30s stale | Yes |
| Only on state transitions | Cheaper; on SW eviction during quiet stretch, snapshot could be 5+ min stale | |
| Every action commit | High write rate; best forensics; risky for >5min tasks given chrome.storage.session quota/rate-limits | |

**User's choice:** Every heartbeat tick + every state transition (Recommended). -> D-04.

---

## SW-wake resume semantics

| Option | Description | Selected |
|--------|-------------|----------|
| Explicit sw_evicted outcome | Settle the originating MCP call with {success, sw_evicted: true, partial_state, last_heartbeat_at}; clean contract; host knows the gap happened | Yes |
| Settle from persisted state silently | Read last persisted lifecycle event and settle without flagging eviction; smoothest UX; hides a real failure mode | |
| Attempt to keep running | Try to resume the automation loop from current_step; ambitious; new resume code path; high regression risk | |

**User's choice:** Explicit sw_evicted outcome (Recommended). -> D-05.
**Notes:** Cleanest contract. Attempt-to-keep-running deliberately deferred to a follow-up phase if demand surfaces post-v0.8.0.

---

## 600s safety-net firing behavior

| Option | Description | Selected |
|--------|-------------|----------|
| partial_outcome with timeout reason | Resolve with {success: true, partial_outcome: 'timeout', partial_state, hint}; hosts salvage progress; loud enough to surface as a bug | Yes |
| Typed timeout reject | Reject with code: mcp_run_task_timeout; hard fail; loses progress | |
| Probe-then-decide | One final storage probe with 5s race window; defensive; extra round-trip | |

**User's choice:** partial_outcome with timeout reason (Recommended). -> D-06.

---

## Compatibility for v0.8.0 release

| Option | Description | Selected |
|--------|-------------|----------|
| Additive only | Existing run_task callers see no diff; new fields appear only on edge cases; documented as additive in v0.8.0 changelog | Yes |
| Bump return-shape version field | Top-level response_version: 2 on every response; explicit migration; heavier | |
| Gate behind opt-in flag | extended_response: true required to see new fields; fragments API surface | |

**User's choice:** Additive only (Recommended). -> D-07.

---

## Cleanup-path audit deliverable

| Option | Description | Selected |
|--------|-------------|----------|
| Written audit + regression tests | 239-CLEANUP-AUDIT.md table + one regression test per path; future maintainers can extend | Yes |
| Regression tests only | Inline assertions only; less drift risk than a separate doc but findings live only in commits | |
| Audit + tests + pre-commit gate | All of the above + pre-commit grep gate; over-engineered; defer to Phase 244 hardening if needed | |

**User's choice:** Written audit + regression tests (Recommended). -> D-08.

---

## Claude's Discretion

The user accepted the recommended option for every question, so no areas were explicitly deferred to Claude. However, the following implementation details were left to the planner per CONTEXT.md `<decisions>` Claude's Discretion subsection:

- TypeScript shape declarations for the persisted snapshot (D-03)
- Module placement of the sw_evicted/partial_outcome decision logic (autopilot.ts vs new run-task-resolver.ts vs bridge client)
- Plain-Node assert harness for D-08 regression tests
- Whether to use a thin `mcp-task-store.js` helper or inline the chrome.storage.session calls
- Whether to extend the bridge client's existing lifecycle-bus subscription block or add a parallel one for the new sw_evicted/partial_outcome wiring

## Deferred Ideas

- Attempt-to-keep-running on SW wake (Option B from D-05)
- Probe-then-decide on 600s fire (Option C from D-06)
- Append-only event log for the persisted snapshot (Option C from D-03)
- response_version: 2 schema bump (Option B from D-07)
- Pre-commit grep gate for cleanup-path lifecycle emission (Option C from D-08)
- Removing the 600s safety net entirely -- conditional on audit + 5 UAT runs proving zero dropped events
