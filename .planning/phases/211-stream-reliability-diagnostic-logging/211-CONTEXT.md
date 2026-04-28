# Phase 211: Stream Reliability & Diagnostic Logging - Context

**Gathered:** 2026-04-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Harden the DOM streaming pipeline and WebSocket transport BEFORE the Sync tab surfaces live state, and replace silent error swallowing in dialog relay and message-delivery paths with redacted, rate-limited diagnostic logging. This is plumbing, not user-visible UI -- the only UI surface this phase touches is a `chrome.runtime` message handler that Phase 213's Sync tab will later call.

In scope: STREAM-01 through STREAM-04, WS-01 through WS-03, LOG-01 through LOG-04 (11 requirements).

</domain>

<decisions>
## Implementation Decisions

### Plan split (3 parallel-safe plans)

- **D-01:** Phase 211 decomposes into 3 plans that all run in parallel in a single executor wave:
  - **211-01: WebSocket inbound `_lz` decompression symmetry** -- single-file change in `ws/ws-client.js` lines 515-522 + outbound contract doc at line 580. Delivers WS-01, WS-02, WS-03.
  - **211-02: DOM streaming hardening** -- `content/dom-stream.js` watchdog (SW alarm + content-script timer), node-level truncation rewrite, stale counter reset + new `staleFlushCount` field on `ext:stream-state`. Delivers STREAM-01, STREAM-02, STREAM-03, STREAM-04.
  - **211-03: Diagnostic logging refactor** -- new `utils/redactForLog.js` helper, layered-prefix + rate-limited `console.warn` replacements at all silent-catch call sites in dialog relay + message delivery, ring buffer in `chrome.storage.local`, `chrome.runtime` `exportDiagnostics` message handler. Delivers LOG-01, LOG-02, LOG-03, LOG-04.

  **File-overlap note (parallelism remains valid):** The three plans have minimal but real file-set overlap and remain parallel-safe because their patches do not collide:
    - 211-01 touches `ws/ws-client.js` at lines 515-522 (inbound onmessage) + line 580 (outbound contract comment).
    - 211-02 touches `ws/ws-client.js` at line 875 only (the `this.send('ext:stream-state', { ... })` call inside `_emitStreamState`) — byte-disjoint from 211-01's edits in the same file.
    - 211-02 and 211-03 both touch `content/dom-stream.js`: 211-02 touches lines 12-23, 466-507, 637-657, 663-690, 695-724, 917-925; 211-03 touches lines 208, 222, 653, 718, 753, 839, 864, 897, 932. Lines 653 and 718 fall inside functions (`flushMutations`, `stopMutationStream`) that 211-02 also modifies, so 211-03 uses string-anchored Edits rather than line-anchored Edits to remain robust under 211-02's line shifts.
    - The executor MAY serialize this wave or genuinely parallelize the three plans — both paths complete correctly because every cross-plan edit operates on a string anchor or byte-disjoint region.

### Watchdog tuning constants

- **D-02:** Service worker watchdog cadence: `chrome.alarms.create('fsb-domstream-watchdog', { periodInMinutes: 1 })`. 1 minute is the platform floor; matches `ws/mcp-bridge-client.js:205` precedent. Survives SW idle eviction.
- **D-03:** Content-script stuck-queue threshold: 5 seconds. The watchdog re-checks every 500ms via `setTimeout`; if `pendingMutations.length > 0 && Date.now() - lastDrainTs > 5000`, force a flush. Tight enough to recover before users notice the dashboard mirror is frozen, loose enough to avoid false positives on quiet pages.
- **D-04:** Diagnostic `console.warn` rate-limit window per error category: 10 seconds. One warn per (prefix, category) per 10s window with counter rollup at the boundary -- format: `[FSB DOM] sendMessage delivery failed (suppressed 47 in last 10s)`. Catches transient bursts without flooding DevTools.

### Truncation strategy

- **D-05:** Single-tier viewport-aware truncation algorithm. No tiered cliffs.
  - Single `TreeWalker` pass on the LIVE document (`NodeFilter.SHOW_ELEMENT`) reads `getBoundingClientRect()` once per `[data-fsb-nid]` element into a `Map<nid, top>` BEFORE any clone mutation -- collapses N forced layout flushes into 1.
  - If `clone.innerHTML.length` exceeds 80% of the relay's per-message limit, walk the clone's annotated elements and remove subtrees with `top > viewport*3` first.
  - If still over, walk node-by-node and emit complete-subtree cuts (no mid-element byte truncation) until under cap.
  - Emit `{ truncated: true, missingDescendants: N }` sentinel in the snapshot envelope.
- **D-06:** Relay per-message size limit is a hardcoded constant in `content/dom-stream.js` (`RELAY_PER_MESSAGE_LIMIT_BYTES`). Comment cites the relay code path (`server/src/ws/handler.js`). No new server contract. Update as a constant change if relay limits change.
- **D-07:** SLA fixture is a synthetic 50k-node generator at `tests/fixtures/dom-stream-50k.html`: nested `<div>`s with 50,000 `data-fsb-nid` annotations, ~5MB serialized size. Deterministic, no network dependency, fast iteration. Snapshot generation must complete in under 200ms on this fixture (measured via `performance.now()`).

### Export-diagnostics handoff

- **D-08:** Phase 211 ships back-end only -- ring buffer + `chrome.runtime.onMessage` handler for `action: 'exportDiagnostics'`. Handler returns the buffer as JSON (and accepts an optional `{ clear: true }` to clear after export). No UI button in Phase 211. Phase 213 wires the Sync tab button to call this handler. Keeps Phase 211 strictly back-end and gives Phase 213 a clean stable contract.
- **D-09:** Ring buffer entry shape: `{ ts, level, prefix, category, message, redactedContext: { origin?, lengths?, statusCode?, kind? } }`. Buffer holds last 100 entries, FIFO. Stored in `chrome.storage.local.fsb_diagnostics_ring`.
- **D-10:** Benign SPA-navigation catches (`content/lifecycle.js:462, 472, 480`) downgrade to `automationLogger.debug` for the console (debug-level filtered by default), AND DO append to the ring buffer with `level: 'debug'`. Console stays quiet; export captures the full picture. Critical for triaging "silent SPA reload broke streaming" support reports.

### Log infrastructure conventions

- **D-11:** Layered prefixes per layer: `[FSB DLG]` (dialog relay), `[FSB BG]` (background runtime), `[FSB WS]` (websocket transport), `[FSB DOM]` (content stream), `[FSB SYNC]` (Sync tab UI -- reserved for Phase 213). Each layer logs its own failures only; do NOT log the same error three times as it bubbles up.
- **D-12:** `redactForLog(value, hint)` helper signature: returns `{}` for arbitrary objects with these rules -- URLs become `URL(x).origin` only (no path, no query, no fragment); strings become `{ kind: hint || 'text', length: x.length }`; HTTP responses become `{ statusCode: x.status }` only (no body); arrays become `{ kind: 'array', length: x.length }`. Default behavior is "log shape, not content".
- **D-13:** Recoverable warns stay recoverable. NO `.catch(err => { console.warn(...); throw err; })` without explicit comment justifying upstream re-catch. Default replacement pattern: `.catch((err) => { console.warn('[FSB <LAYER>] <action> failed', redactForLog(err)); })` -- log and return undefined / fallback. This preserves v0.9.40's exit-path guarantees.

### Stream contract (additive only)

- **D-14:** `ext:dom-mutations` payload shape MUST NOT change. `staleFlushCount` is surfaced exclusively in `ext:stream-state` (existing event). Phase 211 adds the field; the dashboard at `dashboard-page.component.ts:3386` and `dashboard.js:3811` continue to consume the existing `ext:dom-mutations` shape without modification.
- **D-15:** `MCP_RECONNECT_ALARM` early-return at `background.js:12533-12540` is preserved verbatim. The agent alarm branch (12542-12605) is OUT of scope for Phase 211 -- Phase 212 owns that. Phase 211's `chrome.alarms.onAlarm` watchdog dispatch slots in alongside the existing listener (separate alarm name `fsb-domstream-watchdog`).

### `_lz` envelope contract (newly documented)

- **D-16:** Inbound check is FIRST in `_handleMessage`'s entry path (before any other dispatch). Envelope: `{ _lz: true, d: <base64> }`. When detected, `LZString.decompressFromBase64` runs against `d` and the decoded JSON replaces `raw` before falling through to the existing dispatcher. When absent, raw JSON falls through unchanged. Stateless per-frame; do NOT introduce per-connection compression negotiation.
- **D-17:** Decompression failures are recorded via existing `recordFSBTransportFailure(...)` (in `ws-client.js`) with categories `'decompress-failed'` (LZString returned null/empty) and `'decompress-unavailable'` (typeof LZString === 'undefined' due to importScripts failure). Frame is dropped silently (no thrown error -- preserves the message-loop). The transport failure is the diagnostic surface.

### Claude's Discretion

- Exact hot-path call-site list for silent-catch replacement: research/ARCHITECTURE.md (a) section enumerated likely sites (`content/dom-stream.js:208,222,653,718,753,839,864,897,932`, `background.js:6358,6405,6641,8901,8936,9090,9922,10557,10593,10639,10686,10724,10869,10922`, `content/lifecycle.js:462,472,480`); planner/researcher should grep for `.catch(()=>{})` and `.catch(function(){})` in scope and produce the final list.
- Test harness: planner picks between Vitest (existing) and a new lightweight runner for the 50k-node fixture; whichever integrates with the current test surface.
- Whether `chrome.alarms` watchdog also broadcasts a heartbeat to the dashboard: research suggested optional; planner decides. If shipped, must be additive on `ext:stream-state` -- not a new event.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone & phase docs
- `.planning/PROJECT.md` -- core value, current milestone, decisions log
- `.planning/REQUIREMENTS.md` -- 11 reqs in scope: STREAM-01..04, WS-01..03, LOG-01..04
- `.planning/ROADMAP.md` §Phase 211 -- goal, success criteria, dependencies
- `.planning/MILESTONES.md` -- v0.9.40 silent-task-abandonment fix sets the diagnostic-logging precedent

### Research artifacts (this milestone)
- `.planning/research/SUMMARY.md` -- cross-cutting decisions, anti-list, phase shape rationale
- `.planning/research/STACK.md` §Stream Reliability + WebSocket -- LZString reuse, TreeWalker, chrome.alarms; anti-list
- `.planning/research/ARCHITECTURE.md` (c) DOM Streaming Pipeline + (d) WebSocket Frame Handling -- exact line ranges and current pipeline shape
- `.planning/research/PITFALLS.md` P5/P6/P7/P8/P9/P10/P11/P12/P13 -- watchdog/truncation/compression/logging risks with concrete mitigations

### FSB code paths in scope
- `ws/ws-client.js` -- inbound at 515-522, outbound at 568-606, transport-failure recorder near 86-96
- `content/dom-stream.js` -- module state 13-23, observer at 670-688, processMutationBatch 552-632, flushMutations 637-657, truncation 467-489, stop+flush 695-724
- `content/lifecycle.js` -- benign SPA-navigation catches at 462, 472, 480
- `background.js` -- LZString import at 37, alarms listener 12532-12606 (preserve MCP_RECONNECT_ALARM early-return at 12533-12540), domStreamMutations dispatch 5841-5850
- `ws/mcp-bridge-client.js:205, 219` -- canonical `chrome.alarms` reconnect pattern (the watchdog mirrors this)

### FSB code paths to leave alone (downstream consumers)
- `showcase/js/dashboard.js:3517-3528` -- already-validated decompression reference (mirror, do not modify)
- `showcase/js/dashboard.js:3811` and `showcase/angular/.../dashboard-page.component.ts:3386` -- consumers of `ext:dom-mutations` (payload shape MUST NOT change)
- `tests/dashboard-runtime-state.test.js`, `tests/remote-control-handlers.test.js` -- existing contracts that already cover `ext:remote-control-state` and `_lz` (do not break)

### Web platform / external specs
- W3C ServiceWorker issue #790 -- requestIdleCallback NOT available in ServiceWorkerGlobalScope
- MDN: `chrome.alarms` API + Sec-WebSocket-Extensions
- RFC 7692 (permessage-deflate) -- referenced as a pattern to AVOID introducing
- npm `lz-string@1.5.0` -- already vendored at `lib/lz-string.min.js` and `showcase/js/lz-string.min.js`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`LZString.compressToBase64` / `decompressFromBase64`** -- already loaded in the SW via `importScripts('lib/lz-string.min.js')` at `background.js:37`. Mirror the dashboard's decoder shape from `showcase/js/dashboard.js:3517-3528`.
- **`recordFSBTransportFailure(category, payload)`** -- exists in `ws-client.js:86-96`. Reuse for decompress-failed / decompress-unavailable categories.
- **`automationLogger.debug(...)`** -- existing logger; SPA-navigation catches downgrade to this (instead of `console.warn`).
- **`chrome.alarms` watchdog pattern** -- `ws/mcp-bridge-client.js:205, 219` shows the canonical SW-side timer primitive. Mirror the same pattern (alarm name `fsb-domstream-watchdog`, periodInMinutes: 1).
- **Existing `MutationObserver` + rAF batching** -- `content/dom-stream.js:670-688`. Watchdog ADDS to this; does NOT replace.
- **Existing transport-failure surface** -- `recordFSBTransportFailure` integrates with the ring buffer naturally (each transport failure is also a buffer entry).

### Established Patterns
- **No build system** -- vanilla JS via `importScripts` (SW) and `<script>` (content). The new `utils/redactForLog.js` follows the same pattern: top-level `globalThis.redactForLog = function(...)` or `window.redactForLog`, importable from any context that loads it.
- **No new dependencies** -- `lz-string@1.5.0` and existing logger / transport recorder cover everything. `package.json` does not change.
- **Layered logging prefixes** already exist in scattered `console.log` calls (e.g. `[FSB WS]`, `[FSB BG]`). Phase 211 standardizes the convention across all 5 layers.
- **`chrome.storage.local` is the canonical key-value store** -- ring buffer is one more key (`fsb_diagnostics_ring`), no schema migration needed.

### Integration Points
- **`background.js:12532-12606`** -- existing `chrome.alarms.onAlarm` listener. Phase 211 adds a branch for `alarm.name === 'fsb-domstream-watchdog'`; the existing MCP_RECONNECT_ALARM early-return at 12533-12540 stays verbatim above the new branch.
- **`ws/ws-client.js:515-522`** -- inbound `onmessage` -- one block-level edit adds the `_lz` envelope check before `_handleMessage`.
- **`content/dom-stream.js:467-489`** -- truncation hot path -- replace the per-element `getBoundingClientRect` loop with the TreeWalker + Map<nid, top> approach.
- **All silent `.catch(() => {})` sites** in dialog relay + message delivery -- replace with `.catch((err) => { console.warn('[FSB <LAYER>] <action> failed', redactForLog(err)); })` (rate-limited via the helper).
- **`chrome.runtime.onMessage`** -- new handler for `action: 'exportDiagnostics'` returning `{ entries: [...], clearedAt: ts? }` based on optional `{ clear: true }` request param.

</code_context>

<specifics>
## Specific Ideas

- The `_lz` envelope is **stateless per-frame** -- the inbound check is a self-identifying envelope, not a connection-level negotiation. Avoid the temptation to "tidy up" by introducing `Sec-WebSocket-Extensions` handshake; that has sliding-window-corruption failure modes (per PITFALLS.md P9).
- Watchdog must call `cancelAnimationFrame(batchTimer); batchTimer = null;` BEFORE invoking `flushMutations` directly -- otherwise the rAF and the watchdog can both flush in the same tick (PITFALLS.md P5 mitigation).
- The `redactForLog` helper is the single choke point for redaction. NO direct logging of `err.stack`, `event.data`, or response bodies anywhere in the touched call sites -- always route through `redactForLog`.
- `tests/fixtures/dom-stream-50k.html` is a NEW file. Generator script (or a one-time emit) creates 50k nested div annotations totalling ~5MB. The Vitest harness loads it via `JSDOM` or `happy-dom`, runs the snapshot path, asserts `< 200ms`.
- The `_lz` envelope contract code comment at `ws/ws-client.js:580` (outbound site) is REQUIRED by WS-03. Comment shape: `// Outbound: { _lz: true, d: LZString.compressToBase64(JSON.stringify({type, payload, ts})) } when raw > 1024 bytes and compressed shorter. Inbound mirrors at line 515-522. Self-identifying; no per-connection negotiation.`

</specifics>

<deferred>
## Deferred Ideas

None added during this discussion. Items already deferred at the milestone level (in REQUIREMENTS.md "Future Requirements"):

- **STREAM-FUTURE-01**: Dashboard-ack-based stale-counter reset (`dash:dom-mutation-ack` envelope with sequence id). Larger contract surface; explicitly deferred in favor of D-01's flush-based reset.
- **STREAM-FUTURE-02**: Stream health card UI (mutations/sec, queue depth, last flush age). UI surface; belongs in Phase 213 follow-up or v0.9.46.
- Tiered-cliff truncation strategy (1MB / 2MB / 4MB) -- considered and rejected in favor of the simpler single-tier viewport-aware approach (D-05). Revisit only if the synthetic 50k fixture surfaces edge cases the single-tier approach can't handle.
- Server-fetched relay limit (vs hardcoded constant) -- considered and rejected (D-06). Revisit if relay limits become dynamic per-tier.

</deferred>

---

*Phase: 211-stream-reliability-diagnostic-logging*
*Context gathered: 2026-04-28*
