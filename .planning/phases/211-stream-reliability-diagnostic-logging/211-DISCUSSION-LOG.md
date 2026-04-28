# Phase 211: Stream Reliability & Diagnostic Logging - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md -- this log preserves the alternatives considered.

**Date:** 2026-04-28
**Phase:** 211-stream-reliability-diagnostic-logging
**Areas discussed:** Plan split shape, Watchdog tuning constants, Truncation strategy, Export-diagnostics button handoff

---

## Plan split shape

| Option | Description | Selected |
|--------|-------------|----------|
| 3 plans -- WS / DOM / Logging (Recommended) | 211-01 WS inbound _lz decompression. 211-02 DOM streaming hardening. 211-03 Diagnostic logging (helper + call sites + ring buffer + export API). Parallel-safe. | ✓ |
| 4 plans -- split logging in two | Same as 3-plan but logging split: helper/buffer first, call-sites second. Sequenced; slower to ship. | |
| 2 plans -- transport / logging | 211-01 transport (WS + DOM). 211-02 logging. Fewer plans, larger diffs. | |

**User's choice:** 3 plans -- WS / DOM / Logging.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Parallel -- all 3 in one wave (Recommended) | Different files (ws-client.js / dom-stream.js / dialog+message-delivery + new utils/redactForLog.js). No conflicts. Matches gsd-executor wave-based parallelism. | ✓ |
| Sequential -- WS first, then DOM, then Logging | Lower review burden; slower. | |

**User's choice:** Parallel -- all 3 in one wave.

**Notes:** Plans confirmed file-disjoint by ARCHITECTURE.md research. 211-01 touches `ws/ws-client.js`; 211-02 touches `content/dom-stream.js`; 211-03 touches dialog/message-delivery sites + new `utils/redactForLog.js` + `chrome.storage.local` ring buffer + new `chrome.runtime` handler.

---

## Watchdog tuning constants

| Option | Description | Selected |
|--------|-------------|----------|
| 1 minute (the floor) (Recommended) | chrome.alarms minimum periodInMinutes is 1. Same cadence as ws/mcp-bridge-client.js precedent. | ✓ |
| 5 minutes | Lower wake frequency; extends worst-case stuck-stream detection latency on the SW side. | |

**User's choice:** 1 minute (the floor).

---

| Option | Description | Selected |
|--------|-------------|----------|
| 5 seconds (Recommended) | Aggressive enough to catch stalls before the user notices the dashboard is frozen; loose enough to avoid false positives on quiet pages. Watchdog re-checks every 500ms. | ✓ |
| 2 seconds | Tighter; risk of false positives on idle pages. | |
| 10 seconds | Looser; user may notice freezing before recovery. | |

**User's choice:** 5 seconds.

---

| Option | Description | Selected |
|--------|-------------|----------|
| 10s window (Recommended) | One console.warn per category per 10s + counter rollup at boundary. Catches transient bursts without flooding DevTools. | ✓ |
| 30s window | Calmer console; longer wait between visibility windows; could mask short-lived spikes. | |
| 1s window | Faster signal; louder; closer to no rate-limit on slow burns. | |

**User's choice:** 10s window.

**Notes:** Format example for counter rollup chosen: `[FSB DOM] sendMessage delivery failed (suppressed 47 in last 10s)`.

---

## Truncation strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Single-tier viewport-aware (Recommended) | Cap at 80% of relay's per-message limit. TreeWalker pre-pass builds Map<nid, top>. Drop subtrees with top > viewport*3 first; if still over, walk node-by-node and emit complete-subtree cuts. One algorithm, simpler test surface. | ✓ |
| Tiered cliffs (1MB / 2MB / 4MB) | Progressive culling: at 1MB, viewport*5; at 2MB, viewport*3; at 4MB, viewport*1. More edge cases. | |

**User's choice:** Single-tier viewport-aware.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Synthetic 50k-node generator (Recommended) | Deterministic: nested divs with 50k data-fsb-nid annotations, ~5MB serialized. Lives at tests/fixtures/dom-stream-50k.html. Reproducible, no network dependency. | ✓ |
| Captured Wikipedia long article | Real-world but variable across captures. | |
| Captured Reddit infinite-thread | Real-world but Reddit DOM evolves frequently. | |

**User's choice:** Synthetic 50k-node generator.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Hardcoded constant in dom-stream.js (Recommended) | Match relay's per-message limit. Comment cites relay code path. Trivial constant change if relay limits change. No new server contract. | ✓ |
| Fetched once from server on connect | Server exposes /api/limits or sends limit on handshake. Self-tuning; adds a server contract; out-of-scope. | |

**User's choice:** Hardcoded constant in dom-stream.js.

---

## Export-diagnostics button handoff

| Option | Description | Selected |
|--------|-------------|----------|
| Ring buffer + chrome.runtime message handler only (Recommended) | Phase 211 ships ring buffer + chrome.runtime.onMessage handler for action exportDiagnostics returning JSON. NO UI in 211. Phase 213 wires the Sync tab button to call the handler. | ✓ |
| Temporary button in existing Debug section | Phase 211 adds a button to the Debug Logs section; Phase 213 relocates it. Visible day one but creates UI churn. | |
| Ship in 211 directly under existing nav | Phase 211 adds a small Export link in a temporary spot; Phase 213 moves it. Adds UI scope to a phase explicitly scoped to plumbing. | |

**User's choice:** Ring buffer + chrome.runtime message handler only.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Redacted payload (Recommended) | Each entry: { ts, level, prefix, category, message, redactedContext: {origin, lengths, statusCode} }. Useful for support flows; no user data leak. | ✓ |
| Counters only | Each entry: { ts, level, prefix, category, count }. Smaller buffer; less actionable. | |

**User's choice:** Redacted payload.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Yes -- debug entries go to buffer too (Recommended) | automationLogger.debug calls also append to ring buffer at level 'debug'. Console quiet (debug filtered) but buffer captures full picture. | ✓ |
| No -- buffer is warn-and-above only | Smaller buffer; less context for support flows. | |

**User's choice:** Yes -- debug entries go to buffer too.

---

## Claude's Discretion

The following items were left for the planner/researcher to resolve without further user input:

- Exact hot-path call-site list for silent-catch replacement -- planner greps the codebase for `.catch(()=>{})` and `.catch(function(){})` in the dialog relay + message delivery scope and produces the final list.
- Test harness choice for the 50k-node fixture (Vitest vs new lightweight runner) -- planner picks whichever integrates with current test surface.
- Whether `chrome.alarms` watchdog also broadcasts a heartbeat to the dashboard (additive on `ext:stream-state`) -- optional; planner decides.

## Deferred Ideas

None added during this discussion. Items already at the milestone level (REQUIREMENTS.md "Future Requirements"):

- STREAM-FUTURE-01: Dashboard-ack-based stale-counter reset
- STREAM-FUTURE-02: Stream health card UI

Considered and explicitly rejected during this discussion:

- Tiered-cliff truncation (1MB / 2MB / 4MB) -- single-tier preferred for simpler test surface
- Server-fetched relay limit -- hardcoded constant preferred to avoid a new server contract
- Single-shot button placement in Phase 211 (Debug section or temporary nav slot) -- back-end-only handoff to Phase 213 preferred to keep Phase 211 strictly plumbing
