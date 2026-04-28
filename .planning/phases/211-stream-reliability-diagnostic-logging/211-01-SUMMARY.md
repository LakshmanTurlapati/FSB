---
phase: 211-stream-reliability-diagnostic-logging
plan: 01
subsystem: infra
tags: [websocket, lz-string, compression, transport, diagnostics]

# Dependency graph
requires:
  - phase: 198-mcp-bridge-lifecycle-reconnect-state
    provides: chrome.alarms reconnect pattern reused as the canonical SW timer primitive (referenced in CONTEXT.md but not directly invoked here)
provides:
  - Inbound _lz envelope decompression branch in ws/ws-client.js onmessage
  - decompress-failed and decompress-unavailable transport-failure categories
  - WS-03 outbound contract documentation comment block
  - tests/ws-client-decompress.test.js wired into npm test
affects:
  - 211-02-dom-streaming-hardening (touches a non-overlapping region of ws/ws-client.js at line 875; this plan only edits 515-549 and 580-587)
  - 211-03-diagnostic-logging-refactor (may surface decompress-* categories in the ring buffer once it lands)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Self-identifying _lz envelope as the symmetric inbound counterpart to the existing outbound LZString.compressToBase64 wrap
    - Static-analysis + sandboxed round-trip pattern for verifying browser-targeted vendored libraries from plain Node (mirrors tests/remote-control-handlers.test.js)

key-files:
  created:
    - tests/ws-client-decompress.test.js
    - .planning/phases/211-stream-reliability-diagnostic-logging/deferred-items.md
  modified:
    - ws/ws-client.js
    - package.json

key-decisions:
  - "Mirrored showcase/js/dashboard.js:3517-3528 verbatim for the inbound decoder shape (D-16) -- the dashboard contract is the validated reference implementation"
  - "Routed decompression failures through the existing recordFSBTransportFailure ring buffer with two new categories -- no new error surface (D-17)"
  - "Rephrased anti-deflate warning comments to refer to permessage-deflate / RFC 7692 / stateful deflate compression instead of the literal library name pako, to satisfy both the WS-03 documentation requirement AND the plan's anti-list grep without losing the warning's intent"
  - "Test loads lib/lz-string.min.js via new Function() into a sandbox object -- mirrors the importScripts contract in background.js:37 without adding lz-string as an npm dependency"

patterns-established:
  - "Pattern 1: Anti-list-safe warning comments. When a comment must warn about an anti-pattern AND a static-analysis test must reject literal mentions of that anti-pattern, refer to the pattern by RFC / specification name (RFC 7692 permessage-deflate) rather than by library identifier (pako)."
  - "Pattern 2: Sandboxed vendored-library testing. Browser-targeted vendored .min.js files can be exercised in plain Node tests via new Function('var window=this; var globalThis=this;\\n'+src+'\\nthis.X=X;').call(sandbox) without npm install."

requirements-completed: [WS-01, WS-02, WS-03]

# Metrics
duration: 5min
completed: 2026-04-28
---

# Phase 211 Plan 01: WebSocket inbound _lz decompression symmetry Summary

**Closed the WS compression asymmetry by adding a five-line inbound _lz decoder branch to ws-client.js onmessage, routed two new decompression-failure categories through the existing recordFSBTransportFailure ring buffer, documented the round-trip envelope contract at the outbound site, and wired a static-analysis + sandbox round-trip test into the npm test chain.**

## Performance

- **Duration:** ~5 minutes (199s wall clock)
- **Started:** 2026-04-28T22:00:00Z (approx)
- **Completed:** 2026-04-28T22:03:09Z
- **Tasks:** 2 (both auto-executed, no checkpoints)
- **Files modified:** 3 (1 source, 1 test created, 1 package.json)

## Accomplishments

- **WS-01 delivered:** Inbound onmessage handler at ws/ws-client.js now detects `{ _lz: true, d: <base64> }` envelopes and dispatches the decompressed inner message to `_handleMessage`. Plain JSON frames continue to fall through unchanged. Mirrors the validated dashboard decoder at showcase/js/dashboard.js:3517-3528.
- **WS-02 delivered:** Two new transport-failure categories -- `decompress-failed` (LZString returned null/empty) and `decompress-unavailable` (typeof LZString === 'undefined' due to importScripts failure) -- now route through the existing `recordFSBTransportFailure` ring buffer with structured payloads (`target`, `type`, `tabId`, `error`, `len`). Frames are dropped silently from the message-loop perspective; no new error surface introduced.
- **WS-03 delivered:** A six-line contract comment block at the outbound site (just above the `try {` in `send()` at line 580) documents the round-trip envelope shape, the >1024-byte / shorter-than-raw threshold, the inbound mirror line reference, and the anti-deflate rationale referencing PITFALLS.md P9.
- **Static-analysis + round-trip test added:** `tests/ws-client-decompress.test.js` validates all six contract assertions, the three anti-list constraints, a real round-trip against the vendored `lib/lz-string.min.js`, and a malformed-base64 negative case. Plain Node + `assert` -- no Vitest/Jest dependency. Wired into the npm test chain as the final entry.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add inbound _lz decompression branch to ws/ws-client.js onmessage handler and document the outbound contract** -- `7b579ec` (feat)
2. **Task 2: Add tests/ws-client-decompress.test.js (static analysis + round-trip) and wire into package.json npm test** -- `9920b92` (test)

**Plan metadata:** [pending final commit] (docs: complete plan)

## Files Created/Modified

- `ws/ws-client.js` -- Inbound onmessage handler at lines 515-550 now decompresses _lz envelopes; outbound site at lines 580-587 has the WS-03 contract comment block above the existing `try { ... }` body. No other lines touched.
- `tests/ws-client-decompress.test.js` (new) -- 6 PASS-line assertion sections covering WS-01, WS-02, WS-03, anti-list, round-trip, and malformed-base64 negative.
- `package.json` -- `scripts.test` chain has `&& node tests/ws-client-decompress.test.js` appended at the tail. No other fields changed (`dependencies`, `devDependencies`, `version`, `engines`, all other scripts unchanged).
- `.planning/phases/211-stream-reliability-diagnostic-logging/deferred-items.md` (new) -- Logs pre-existing npm test failures in `tests/runtime-contracts.test.js` (background contract cleanup + popup direct-consumer boundary sections) that are out of scope for Phase 211.

## Decisions Made

- **D-16 / D-17 honored verbatim:** Inbound check is FIRST in the message-loop entry. Stateless per-frame. No per-connection negotiation. Failures route through the existing recorder.
- **Comment phrasing for anti-list compatibility:** The plan required (a) a warning comment saying "Do NOT introduce ... pako" AND (b) a static-analysis assertion that the source contains no `\bpako\b` reference. Resolved by referring to the anti-pattern as "permessage-deflate or alternative deflate libraries" (inbound) and "stateful deflate compression / RFC 7692 permessage-deflate" (outbound). Same warning, no literal library name. The PITFALLS.md P9 reference is preserved verbatim and is the authoritative pointer.
- **Test sandbox load over npm dependency:** `lib/lz-string.min.js` is browser-targeted (declares `var LZString = ...` at top level). The test loads it via `new Function('var window=this; var globalThis=this;\n'+src+'\nthis.LZString=LZString;')` into a local sandbox object, mirroring the importScripts contract in background.js:37 without adding `lz-string` as an npm dependency. Honors D-01's "no new dependencies" rule.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Resolved internal contradiction between plan's required comment text and plan's anti-list assertion**

- **Found during:** Task 1 verification (the automated grep step in the plan failed because the warning comment that the plan REQUIRED to be added included the literal word `pako` -- which the plan's anti-list test then ALSO required to be absent).
- **Issue:** The plan's `<action>` block specified a comment line `// Do NOT introduce permessage-deflate or pako (PITFALLS.md P9 ...)` and a parallel comment `// Do NOT replace LZString with deflate/pako -- per-connection ...`. The plan's `<acceptance_criteria>` for Task 1 then asserted `ws/ws-client.js does NOT contain pako` and Task 2's static-analysis test asserted `!/\bpako\b/.test(wsClientSource)`. These two requirements directly contradict each other. The first verification command run after the literal insertion failed with `anti-list violation: pako=true`.
- **Fix:** Rephrased the inbound warning to "Do NOT introduce permessage-deflate or alternative deflate libraries (PITFALLS.md P9 ...)" and the outbound contract warning to "Do NOT replace LZString with stateful deflate compression -- per-connection stateful compression (RFC 7692 permessage-deflate) ...". Both warnings preserve the WS-03 anti-deflate intent (the PITFALLS.md P9 pointer is authoritative) without including the literal library identifier `pako` or the literal API `DecompressionStream`.
- **Files modified:** ws/ws-client.js (only the comment text inside the same edit; no behavior change)
- **Verification:** Anti-list grep `Sec-WebSocket-Extensions|\bpako\b|\bDecompressionStream\b` returns no matches. WS-03 contract assertions (`_lz envelope contract (round-trip)`, `PITFALLS.md P9`) still pass. Task 2 round-trip test passes 6/6.
- **Committed in:** 7b579ec (Task 1 commit -- the comment fix landed inside the same task edit)

---

**Total deviations:** 1 auto-fixed (Rule 1: bug -- internal plan contradiction)
**Impact on plan:** No scope creep. The deviation is purely cosmetic comment phrasing; behavior, contract, and threat-model dispositions are exactly as planned. WS-01, WS-02, and WS-03 are delivered unchanged.

## Issues Encountered

- **Pre-existing npm test failures in unrelated files (out of scope).** While running `npm test` to verify the new test integrates into the chain, observed 7 pre-existing failures in `tests/runtime-contracts.test.js` (background contract cleanup + direct consumer boundary sections about `SessionStateEmitter` / `sessionStateEvent` plumbing in `background.js` and `ui/popup.js`). Confirmed via `git stash` baseline check that these failures pre-exist on main BEFORE any Phase 211 edit. Logged to `deferred-items.md`. Per the GSD scope-boundary rule, only failures DIRECTLY caused by a task's changes are auto-fixed; pre-existing failures in unrelated files are deferred.

## User Setup Required

None - no external service configuration, no environment variables, no relay-side change. The relay does not (yet) emit compressed frames to the extension; this plan adds the latent symmetric path so any future relay or dashboard release that flips that behavior will be received correctly instead of silently dropped.

## Next Phase Readiness

- **211-02 (DOM streaming hardening) ready:** This plan touched ws/ws-client.js at lines 515-549 (inbound onmessage) and lines 580-587 (outbound contract comment). 211-02's planned edit at line 875 (`_emitStreamState` send call) is byte-disjoint and unaffected.
- **211-03 (diagnostic logging refactor) ready:** The two new transport-failure categories (`decompress-failed`, `decompress-unavailable`) are now flowing into the existing `forwardFailures` ring. When 211-03 lands the ring-buffer-to-`chrome.storage.local` exporter, these categories will surface in the diagnostic export naturally with no additional wiring.
- **No blockers, no open questions.**

---
*Phase: 211-stream-reliability-diagnostic-logging*
*Completed: 2026-04-28*

## Self-Check: PASSED

All claimed files exist on disk:
- ws/ws-client.js (modified)
- tests/ws-client-decompress.test.js (created)
- package.json (modified)
- .planning/phases/211-stream-reliability-diagnostic-logging/211-01-SUMMARY.md (this file)
- .planning/phases/211-stream-reliability-diagnostic-logging/deferred-items.md (created)

All claimed commits exist in git history:
- 7b579ec (Task 1: feat(211-01): add inbound _lz decompression symmetry to ws-client)
- 9920b92 (Task 2: test(211-01): add ws-client _lz decompression symmetry test)

All plan-level verification steps pass:
- node tests/ws-client-decompress.test.js -- exit 0 (6/6 sections PASS)
- node tests/remote-control-handlers.test.js -- exit 0
- node tests/dashboard-runtime-state.test.js -- exit 0
- grep "_lz === true" ws/ws-client.js -- 1 match (>= 1 required)
- grep "Sec-WebSocket-Extensions|pako|DecompressionStream" ws/ws-client.js -- 0 matches
