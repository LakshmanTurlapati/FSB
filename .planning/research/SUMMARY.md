# Project Research Summary

**Project:** FSB v0.9.45rc1 -- Sync Surface, Agent Sunset & Stream Reliability
**Domain:** Brownfield Chrome MV3 extension + WebSocket relay + Angular 19 showcase mirror
**Researched:** 2026-04-28
**Confidence:** HIGH

## Executive Summary

This milestone is **mechanics, not greenfield.** Phases 209 (remote-control handlers) and 210 (QR pairing restoration) already shipped, and the remaining five feature areas -- Sync tab consolidation, background-agent sunset, DOM streaming hardening, WebSocket compression symmetry, and diagnostic logging replacement -- are uniformly "fix the asymmetry, harden the hot path, surface the hidden state." The single most important cross-cutting decision is that **no new dependency is needed.** `lz-string@1.5.0` is already vendored at `lib/lz-string.min.js` and loaded by the service worker via `importScripts` (`background.js:37`); `qrcode-generator@2.0.4` is already at `ui/lib/`; `LZString.decompressFromBase64` is already proven on the dashboard side (`showcase/js/dashboard.js:3517-3518`). The "compression asymmetry" the milestone calls out is a five-line addition to the inbound `onmessage` handler in `ws/ws-client.js:515-522` -- not a new compression library, not per-message-deflate, not `pako`.

The recommended approach is to **reuse existing platform primitives and existing FSB conventions verbatim**: the control panel's `<li class="nav-item" data-section="X">` + `<section class="content-section" id="X">` pattern is the canonical extension point for both the new Sync tab and the deprecation card -- adding a framework would force a build system, which the project explicitly rejects (CLAUDE.md). The DOM streaming hardening uses native `TreeWalker` + a single batch-read of `getBoundingClientRect` to collapse N forced reflows into 1 layout flush, plus a two-tier watchdog (`chrome.alarms` SW-side, `setTimeout` + monotonic counter content-script-side) -- because `requestIdleCallback` is not exposed in `ServiceWorkerGlobalScope` and `setInterval` longer than ~30s dies on SW eviction. The agent sunset preserves shared utilities by commenting out (not deleting) at the file level AND adding a deprecation gate constant so every entrypoint -- alarm listener, MCP tool, dashboard `dash:agent-run-now`, `ws/mcp-bridge-client.js` route -- returns a structured `{ ok: false, deprecated: true, ... }` response instead of half-noop.

The biggest risks are not technical but procedural: **silent half-deprecation** (commenting UI but leaving alarm listeners + MCP tool registrations hot, producing zombie handlers), **silent log spam** (the v0.9.40 `.catch(()=>{})` -> `console.warn` pattern works for ~1/s lifecycle events but will flood DevTools at 10-50/s on per-mutation hot paths unless rate-limited), **silent data leakage** (logging full URLs with OAuth tokens or dialog text with passwords), and **silent stream staleness** (resetting the stale-mutation counter on `ws.send` returning truthy rather than on dashboard ack). All four are addressable up front with a deprecation gate constant + alarm-cleanup-on-update; rate-limited + redacted logging via a `redactForLog` helper; and an explicit ack contract for stale-counter resets.

## Key Findings

### Recommended Stack

**Verdict: zero net new dependencies.** This is not a stack-expansion milestone -- it is a stack-symmetry and stack-discipline milestone.

**Core primitives (all already present):**
- `lz-string@1.5.0` (`lib/lz-string.min.js`) -- inbound decompression to mirror outbound `LZString.compressToBase64` envelope; library loaded into the SW, the call site is missing.
- `qrcode-generator@2.0.4` (`ui/lib/qrcode-generator.min.js`) -- Phase 210's QR rendering, relocated unchanged.
- Native `TreeWalker` (`NodeFilter.SHOW_ELEMENT`) -- replaces `clone.querySelectorAll('[data-fsb-nid]')` + per-node `getBoundingClientRect()` in `content/dom-stream.js:467-489`.
- Native `chrome.alarms` (`fsb-domstream-watchdog`, `periodInMinutes: 1`) -- SW-side watchdog that survives idle eviction. Same pattern in `ws/mcp-bridge-client.js:205`.
- Native `setTimeout` + monotonic counter -- content-script side stuck detection.
- Existing `<li class="nav-item" data-section="X">` + `<section class="content-section" id="X">` (`ui/control_panel.html:50-90`) -- canonical for both Sync tab and deprecation card.

**Pinned, do NOT upgrade:** Angular 19.0.x. Angular 19 hits EOL 2026-05-19 (~3 weeks after this milestone target); the migration to Angular 20 is a separate milestone with its own scope.

See `STACK.md` for precise integration points, line numbers, and the rationale for each rejection.

### Expected Features

The five milestone areas decompose into 9 P1 features, 3 P2 nice-to-haves, and 4 P3 defers.

**P1 (must have):**
- Sync tab as a top-level nav-item with QR pairing, hash key, and connection status moved out of the Background Agents section. Phase 210 controller functions (`showPairingQR`, `cancelPairing`, etc. at `ui/options.js:4766-4946`) are bound to document-scoped IDs and continue to work after the section moves.
- Live connection status pill wired to `ext:remote-control-state` (Phase 209) with replay-on-attach via a new `getRemoteControlState` runtime action. Passive `#connectionStatus` text is insufficient.
- Background Agents tab body replaced with a deprecation card (playful tone, named alternatives: OpenClaw + Claude Routines, dated effective version, links out, no nag, no blocking modal).
- Comment-out (not delete) of agent-only code with `// DEPRECATED v0.9.45rc1: ...` annotation; preserved storage key `bgAgents`.
- Showcase mirror of the sunset messaging -- `home-page.component.html` Background Agents card replaced; agent blocks commented but `ext:remote-control-state` and `_lz` decompression preserved.
- DOM streaming watchdog + stale counter reset (two-tier; resets on `ext:snapshot` boundary; new `staleFlushCount` field in `ext:stream-state`, NOT in `ext:dom-mutations`).
- Large-DOM truncation perf fix -- TreeWalker + cached rect map. Truncate at the **node** level, not the byte level.
- WebSocket inbound `_lz` decompression -- five-line add to `ws/ws-client.js:515-522`. Self-identifying envelope.
- Diagnostic `console.warn` replacing silent `.catch(()=>{})` with layered prefixes (`[FSB DLG]`, `[FSB BG]`, `[FSB WS]`, `[FSB DOM]`, `[FSB SYNC]`), rate-limited per category, redacted via `redactForLog`.

**P2 (ship if cheap):** manual fallback pairing code under the QR; last-paired timestamp + UA; manual Reconnect button (visible only when disconnected/reconnecting).

**P3 (defer):** live remote-control state chip ("Idle" / "Active -- clicking" / "Active -- typing"); stream health card; one-click Unpair; rotating sunset taglines.

See `FEATURES.md` for the full prioritization matrix and microcopy bank.

### Architecture Approach

The architecture is **integration into existing surfaces**, not new components. Five concrete layers change, in order of independence:

1. **`ws/ws-client.js` inbound handler** (515-522) -- gains a `_lz` envelope check before `_handleMessage`. Single-file change, no new contract.
2. **`content/dom-stream.js` mutation pipeline** (467-489 truncation; 670-688 batching; new `lastDrainTs`, `staleFlushCount` module state) -- watchdog + truncation rewrite. Does NOT change `ext:dom-mutations` payload shape.
3. **`background.js` agent surface** (160-163, 5586-5752, 12542-12605, 12634, 12652) -- comment out alarm-handler agent branch (PRESERVE the `MCP_RECONNECT_ALARM` early-return at 12533-12540), comment out router cases, comment out rescheduler calls. Add deprecation gate constant; add one-time `chrome.alarms` cleanup-on-update for `fsb_agent_*` alarms.
4. **`ui/control_panel.html` + `ui/options.js` Sync tab** -- new `<li data-section="sync">` + `<section id="sync">`; **MOVE** (do not duplicate) Server Sync card and pairing overlay (700-748) into `#sync`; new `initializeSyncSection()` re-wires existing handlers. The `switchSection` monkey-patch at 3082-3099 extends with a `sync` case calling `refreshRemoteControlState()`.
5. **Showcase Angular shell + vanilla dashboard** -- copy/nav updates for Sync surface; agent-sunset card body replacement. **Preserve `ext:remote-control-state` and `_lz` decompression paths in `dashboard-page.component.ts:3204-3205, 3386`.**

**Cross-cutting state contracts:**
- Remote-control state today is one-way **outbound**; Sync tab needs a **pull** API (`getRemoteControlState`) plus an in-extension **push** (`remoteControlStateChanged` runtime message). Replay-on-attach is mandatory.
- Stale-mutation counter resets on the same boundary that emits `ext:snapshot` (NB: open question on ack-based vs flush-based -- see Research Flags).
- `chrome.storage.local['bgAgents']` is preserved.
- The shared `chrome.alarms.onAlarm` listener MUST keep its `MCP_RECONNECT_ALARM` early-return when the agent branch is commented out.

See `ARCHITECTURE.md` for precise per-file edit ranges, the SHARED-DO-NOT-TOUCH list, and per-area integration risks.

### Critical Pitfalls

Five pitfalls rise to "must address in Plan 1 of the relevant phase":

1. **Zombie agent handlers after partial sunset** (P2). Commenting only the UI leaves four entrypoints hot: `chrome.alarms.onAlarm`, MCP tool registrations, `dash:agent-run-now`, `ws/mcp-bridge-client.js`. **Mitigation:** export `BG_AGENTS_DEPRECATED = true` from a single source; gate every entrypoint at the top; one-time `chrome.alarms.getAll()` cleanup on update; MCP tools return explicit `{ ok: false, deprecated: true, message: '...' }`.
2. **Orphaned deep links to retired anchors** (P1). `options.html#agents`, `#pair`, `#remote` are referenced from showcase nav, popup, docs. **Mitigation:** in-page redirect shim in `ui/options.js` runs on `DOMContentLoaded` BEFORE any other init; rewrites legacy hashes to `#sync`; lives at least through v0.9.46.
3. **`setInterval` watchdog dies on MV3 SW idle** (P5). Pre-MV3 muscle memory will reach for `setInterval`; it stops firing 30s after SW idle. **Mitigation:** `chrome.alarms.create` survives SW eviction; on SW wake, re-resolve stream state via `domStreamHealthCheck` to the active content script and wait for ack.
4. **Mid-element truncation produces invalid HTML on the dashboard** (P7). Byte-level `string.slice` lands inside `<div class="abc...`. **Mitigation:** node-level truncation via TreeWalker; emit `truncated: true, missingDescendants: N` sentinel; cap at 80% of relay's per-message limit.
5. **Diagnostic logging leaks user data and floods the console** (P10 + P11). The v0.9.40 pattern fires ~1/s on lifecycle events but dialog-relay / message-delivery paths fire 10-50/s; naively logging `{url, dialogText, response}` exposes OAuth tokens, password-reset codes, MFA codes. **Mitigation:** `redactForLog` helper -- log `URL(x).origin` only, `{kind: 'prompt', textLength: 23}` not the text, status codes not bodies; rate-limit per error category (one warn per 10s with counter rollup); ring buffer in `chrome.storage.local` (last 100 entries); "Export diagnostics" button in Sync tab.

Remaining pitfalls (P3 storage loss, P4 watchdog false-positives, P6 stale-counter ack semantics, P8 asymmetric `_lz`, P9 deflate sliding-window, P12 re-throw breaks v0.9.40 exit guarantees, P13 DevTools level filter) are addressable in the same phases without milestone-blocker status, but each has a verification step in PITFALLS.md.

## Cross-Cutting Decisions

These decisions apply across multiple phases and must be enforced by review:

- **Zero new libraries.** No `package.json` changes. No new vendored libs.
- **Comment, do not delete.** Agent code preserved with `// DEPRECATED v0.9.45rc1: superseded by OpenClaw / Claude Routines -- see PROJECT.md.` for grep-findability.
- **Move, do not duplicate.** Server Sync card (700-748) is RELOCATED into `#sync`; IDs unchanged.
- **Replay-on-attach for runtime state.** Any UI subscribing to `ext:*` events MUST also pull last-known state via a `getX` runtime action.
- **Symmetric envelope semantics.** `_lz: true` is self-identifying and stateless per-frame. Do NOT introduce permessage-deflate or per-connection stateful compression.
- **Layered diagnostic prefixes.** `[FSB DLG]`, `[FSB BG]`, `[FSB WS]`, `[FSB DOM]`, `[FSB SYNC]`. Each layer logs its own failures.
- **Hot-path logging is rate-limited and redacted.** Lifecycle events: unconditional `console.warn`. Per-action / per-mutation: rate-limited per category, with a counter rollup.
- **Recoverable warns stay recoverable.** No `.catch(err => { console.warn(...); throw err; })` without explicit comment. Default: log and return undefined / fallback.
- **Use `chrome.alarms`, never long `setInterval`, in the service worker.** Same pattern as `ws/mcp-bridge-client.js:205`.
- **Preserve the `MCP_RECONNECT_ALARM` early-return** at `background.js:12533-12540`. Regression test required.
- **Showcase mirror is content + nav, not framework work.** Pin Angular 19.0.x.

## Anti-List (What NOT To Do)

| Tempting | Wrong because | Do this instead |
|----------|---------------|-----------------|
| Add a build system / bundler | CLAUDE.md forbids it. | Continue to vendor minified files; load directly. |
| Add React/Vue/Svelte/Lit/Alpine | Forces a build system; 30 lines of HTML do not need a framework. | `document.createElement` + `data-section` pattern. |
| Replace LZ-string with `pako` or `DecompressionStream("deflate-raw")` | LZ-string is custom LZW, NOT RFC 1951 DEFLATE. Switching ends up requiring a feature-flag handshake. | Reuse `LZString.decompressFromBase64`. |
| Negotiate `Sec-WebSocket-Extensions: permessage-deflate` | Per-connection stateful compression; one bad frame poisons the sliding window. | Stay at the `{_lz: true, d: ...}` app-layer envelope. |
| Delete `chrome.storage.local['bgAgents']` to "tidy up" | Permanent loss of every user-created agent. | Preserve. Add `fsb_sunset_notice` writer with copy-to-clipboard export. |
| Auto-redirect or 404 the old Background Agents tab | Users have muscle memory + bookmarks. | Keep nav-item visible with deprecation card body for one full release cycle. |
| Hide the Sync tab behind "Advanced" | Remote control IS the headline UX. | Top-level. |
| Block UI interaction during reconnect | Users want to keep configuring. | Status pill changes; rest stays interactive. |
| Add a "Disable Watchdog" toggle | Watchdog is correctness, not a feature. | Always on. |
| Toast notification on every watchdog trip | Toast spam = ignored toast. | Single rate-limited `console.warn` + ring-buffer entry. |
| `setInterval` watchdog in `background.js` | Dies on SW idle; reintroduces v0.9.40-class silent loss. | `chrome.alarms`. |
| Byte-level truncation of DOM JSON | Mid-element cuts produce invalid HTML. | Node-level with `truncated: true, missingDescendants: N` sentinel. |
| Reset stale-mutation counter on `ws.send` truthy | Transport success is not end-to-end delivery. | Reset on `dash:dom-mutation-ack` with sequence id (or on `ext:snapshot` boundary -- see Research Flags). |
| Re-throw after `console.warn` for "correctness" | Breaks v0.9.40 exit-path guarantees. | Recoverable warns stay recoverable. |
| Log full URLs and dialog text | Leaks OAuth tokens, MFA codes, passwords. | `redactForLog` -- origin only, length+presence only. |
| `console.error` for transient transport failures | Triggers DevTools red-badge alerts; trains users to ignore. | `console.warn` for recoverable; `console.error` only for invariant violations. |
| Per-mutation `console.warn` without rate-limiting | DevTools floods at 10-50/s. | Rate-limit per category to one warn per 10s with counter rollup. |
| Upgrade Angular 19 -> 20 in this milestone | New build pipeline; multi-week migration; out of scope. | Pin `^19.0.0`. Schedule Angular 20 migration as its own milestone before 2026-05-19. |
| Rewrite the pairing protocol while moving the UI | Phase 210 is shipped + working. | Strict relocation + polish. |

## Implications for Roadmap

**Suggested phase shape: 3 phases, ordered by isolation -> dependency direction.**

### Phase 1: Stream Reliability + Diagnostic Logging
**Rationale:** Maximally isolated. No coupling to Sync tab or agent sunset. Pure content-script + ws-client.js + grep-replace-and-test. Lands first so watchdog and decompression are present when the Sync tab starts surfacing live state in Phase 3. Three plans, parallelizable.
**Delivers:** WS inbound `_lz` decompression; DOM streaming hardening (TreeWalker + cached rects, two-tier watchdog, stale counter reset, node-level truncation with sentinel, `staleFlushCount` in `ext:stream-state`); `redactForLog` helper + diagnostic `console.warn` with layered prefixes, rate-limiting per category, ring buffer.
**Avoids:** P5, P7, P8, P9, P10, P11, P12, P13.

### Phase 2: Background Agent Sunset
**Rationale:** Must precede Sync-tab surgery -- the Sync tab MOVES the Server Sync card OUT OF the `#background-agents` section. Three plans (gate + alarm cleanup; UI commenting + showcase mirror; MCP surface deprecation) with strict ordering: gate BEFORE UI removal, alarm cleanup in the SAME release as UI removal.
**Delivers:** `BG_AGENTS_DEPRECATED = true` constant + deprecation gate at every entrypoint; `chrome.runtime.onInstalled` (reason=update) one-time alarm cleanup for `fsb_agent_*`; comment-out (not delete) of agent files and entrypoints with `// DEPRECATED v0.9.45rc1: ...` annotations; deprecation card replacing Background Agents tab body; showcase mirror; MCP tools return `{ ok: false, deprecated: true, ... }`.
**Avoids:** P2, P3.

### Phase 3: Sync Tab Build
**Rationale:** Depends on Phase 2's UI surgery. Four plans, with 3A and 3B as a single atomic commit (co-dependent IDs + handlers).
**Delivers:** `<li data-section="sync">` + `<section id="sync">` with relocated Server Sync card and pairing overlay (IDs unchanged); deep-link redirect shim rewriting `#dashboard`, `#agents`, `#pair`, `#remote` to `#sync`; `initializeSyncSection()` re-wiring; `getRemoteControlState` runtime action + `remoteControlStateChanged` push; live connection status pill; visibility-gated QR countdown; showcase Sync surface copy.
**Avoids:** P1.

### Phase ordering rationale
- Phase 1 -> 2 -> 3 by dependency direction.
- Within Phase 1, plans are parallel-safe (different files).
- Within Phase 2, plans are sequenced to avoid the zombie-handler window.
- Within Phase 3, 3A + 3B = atomic commit; 3C + 3D in parallel.
- No phase changes the `ext:dom-mutations` payload shape.

### Research Flags

Phases needing deeper research during planning:
- **Phase 1, Plan C (DOM hardening) needs a fixture** before declaring victory. Recommend a 50k-node fixture and a `performance.measure` baseline. **Open question:** acceptance bar (e.g., < 200ms snapshot generation on the fixture)?
- **Phase 1, Plan C ack semantics for stale-counter reset.** PROJECT.md says "stale mutation counter reset" without specifying the boundary. Three options: (a) reset on successful flush, (b) reset on stream-state-change, (c) reset on dashboard ack with sequence id. The dashboard-ack option is most correct (P6) but has the largest contract surface (requires a new `dash:dom-mutation-ack` envelope). Roadmapper must clarify with user before Phase 1C planning.
- **Phase 2, Plan A** -- one-line check during planning: `mcp-server/src/tools/visual-session.ts.bak-openclaw-crab` exists. Prior aborted sunset attempt? Safe to leave or delete?
- **Phase 3, Plan B** -- Phase 209's broadcast contract reliability across SW wake is a smoke-test concern. Add a manual verification step that simulates SW eviction.

Phases with standard patterns:
- Phase 1, Plan A (WS inbound decompression) -- dashboard's decoder at `showcase/js/dashboard.js:3517-3528` is the validated reference.
- Phase 1, Plan B (diagnostic logging refactor) -- the v0.9.40 pattern is established.
- Phase 2, Plan B (UI commenting) -- file-by-file edit ranges enumerated in ARCHITECTURE.md.
- Phase 3, Plan A (Sync tab HTML structure) -- canonical `data-section` pattern.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Every recommendation grounded in direct code inspection. The "no new dependency" verdict is verifiable in 5 minutes of grepping. |
| Features | MEDIUM-HIGH | Current FSB code paths: HIGH. Comparable-product UX (GitHub Sessions, 2FAS, Chrome Remote Desktop, rrweb): MEDIUM. Microcopy: subjective. |
| Architecture | HIGH | All findings confirmed by direct file inspection with specific line ranges. The `MCP_RECONNECT_ALARM` early-return preservation is the one detail most likely to be missed. |
| Pitfalls | HIGH | Grounded in current FSB code + recent v0.9.36 / v0.9.40 incidents. Pitfall-to-phase mapping table directly maps every pitfall to a verification step. |

**Overall confidence:** HIGH. Brownfield mechanics milestone with a well-understood codebase, established patterns from prior milestones, and zero net-new dependencies. Scope is contained.

### Gaps to Address

- **Stale-counter reset boundary** (PROJECT.md ambiguity): "on successful flush" vs "on stream-state-change" vs "on dashboard ack". Roadmapper: confirm with user before Phase 1C planning.
- **DOM truncation acceptance bar:** what fixture size and what time bound? Suggested default: 5MB DOM page snapshot generation < 200ms.
- **`mcp-server/src/tools/visual-session.ts.bak-openclaw-crab`:** prior aborted sunset artifact?
- **Phase 209 broadcast reliability across SW wake:** if the pill lies after SW wake, the Sync tab UX regresses below the existing passive `#connectionStatus` text.
- **`fsb_sunset_notice` content scope:** show task NAMES only or task TEXT? PITFALLS.md P11 says names only. Codify in Phase 2A plan.
- **Showcase Angular 19 EOL alignment:** Angular 19 EOL is 2026-05-19. Note in PROJECT.md "Known tech debt" for milestone-after-next deadline.

---
*Research completed: 2026-04-28*
*Ready for roadmap: yes*
