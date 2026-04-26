---
phase: 210-qr-code-pairing-restoration
plan: 01
subsystem: ui
tags: [chrome-extension, ui, qr, pairing, options-page, qrcode-generator, server-sync]

requires:
  - phase: 196 (Server Sync wiring)
    provides: Server Sync card markup, /api/auth/register flow, FSB_DEFAULT_SERVER_URL constant, generateHashKey reference shape
  - phase: v0.9.6 P41 (original QR pairing)
    provides: Locked DOM IDs, vendored qrcode-generator.min.js, .pairing-* CSS classes, server endpoint POST /api/pair/generate
provides:
  - QR pairing controller (showPairingQR, cancelPairing, startPairingCountdown, clearPairingCountdown, ensureHashKey, regeneratePairingToken, renderExpiredState, renderPairingQR, fetchPairingToken)
  - Listener wiring for #btnPairDashboard and #btnCancelPairing
  - Static-analysis test contract at tests/qr-pairing.test.js
  - Silent hash-key auto-gen flow (D-01)
  - In-overlay regenerate-on-expiry affordance (D-02)
  - Countdown urgency styling threshold at remaining <= 10s (D-03)
  - Duplicate-click guard preventing server token burn
affects: [phase-211-mcp-bridge, phase-212-relay-streaming, dashboard-pairing, showcase-handleScannedQR]

tech-stack:
  added: []
  patterns:
    - "Static-analysis test stub for source contract (mirrors tests/remote-control-handlers.test.js)"
    - "setTimeout self-reschedule for monotonic countdown (no setInterval drift)"
    - "Closure-only secret retention (token never persisted to chrome.storage)"
    - "Idempotent timer cleanup as first line of every controller entry point"

key-files:
  created:
    - tests/qr-pairing.test.js
  modified:
    - ui/options.js (controller helpers + listener wiring)
    - package.json (test chain wiring)

key-decisions:
  - "JS-only restoration: control_panel.html, options.css, qrcode-generator.min.js are LOCKED and untouched"
  - "Closure-only token retention: pairing token never written to chrome.storage, never logged (T-210-01, T-210-02)"
  - "Duplicate-click guard via overlay.style.display === 'flex' check + pairingFetchInFlight flag (T-210-06)"
  - "ensureHashKey returns just-fetched key directly to caller; no DOM re-read race window (T-210-07)"
  - "URL trailing-slash strip applied before both QR encoding and fetch URL build (Pitfall 6)"
  - "setTimeout self-reschedule (not setInterval) for accurate countdown and clean cancellation (Pitfall 4)"

patterns-established:
  - "Phase 210 controller pattern: top-level helpers + listener registration in setupAgentsSection, mirrors Server Sync (generateHashKey, copyHashKey, testServerConnection)"
  - "Static-analysis source contract test (read source as string + assert structural patterns) suitable for Chrome MV3 + DOM + chrome.storage code paths that cannot run under Node"

requirements-completed: [QR-01, QR-02, QR-03]

duration: 18min
completed: 2026-04-26
---

# Phase 210 Plan 01: QR Code Pairing Restoration Summary

**Restored the QR pairing controller in ui/options.js: #btnPairDashboard now POSTs /api/pair/generate, renders a JSON.stringify({t,s}) QR via qrcode-generator(0,'M'), runs a 60s countdown driven by server expiresAt with .pairing-countdown-urgent at remaining<=10, and offers an in-overlay 'Generate new code' affordance on expiry instead of auto-closing.**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-04-26T (start of plan execution)
- **Completed:** 2026-04-26
- **Tasks:** 2 (Wave-0 RED test + GREEN implementation)
- **Files modified:** 3 (ui/options.js, tests/qr-pairing.test.js, package.json)

## Accomplishments

- **#btnPairDashboard wired** — clicking the Pair Dashboard button now invokes async showPairingQR which fetches a single-use 60s pairing token from POST /api/pair/generate using X-FSB-Hash-Key header, then renders a centered QR overlay (display: flex)
- **D-01 silent hash-key auto-gen** — when chrome.storage.local.serverHashKey is absent, ensureHashKey transparently calls POST /api/auth/register, persists the returned hashKey, mirrors it into #serverHashKey.value, and returns it directly to the caller (no race window per Pitfall 3)
- **D-02 in-overlay regenerate** — on countdown expiry, .pairing-qr-expired is added, #pairingCountdown shows 'Expired', the QR slot is replaced by a 'Generate new code' button (control-btn accent), and the overlay stays open. Clicking the button calls regeneratePairingToken which clears expired state, re-fetches a token, re-renders the QR, and restarts the countdown — all without touching #pairingQROverlay.style.display
- **D-03 urgency at <=10s** — startPairingCountdown drives a setTimeout self-reschedule loop bound to (new Date(expiresAt) - Date.now()); when remaining <= 10 && remaining > 0, .pairing-countdown-urgent is added (triggers existing pairingPulse keyframe); class is removed if remaining > 10 again on reset
- **#btnCancelPairing wired** — cancelPairing clears the timer, hides the overlay (display: none), empties #pairingQRCode, resets #pairingCountdown to '60s', and removes both .pairing-countdown-urgent and .pairing-qr-expired classes
- **Duplicate-click guard** — showPairingQR returns early if overlay is already open or pairingFetchInFlight is set, preventing server token burn from rapid double-clicks (T-210-06)
- **Static-analysis test contract** — 22 individual assert(...) calls covering 16 contract points across QR-01/QR-02/QR-03 + D-01/D-02/D-03 (listener wiring, function existence, server endpoints, payload shape, urgency threshold, expired class, regenerate copy, overlay show/hide, timer hygiene, regression guard against #pairingQRContainer, npm test chain wiring)

## Task Commits

Each task was committed atomically:

1. **Task 1: Write Wave 0 static-analysis test stub for the QR pairing controller** — `72eb79f` (test) — RED step: test fails at first assertion (btnPairDashboard lookup) because controller does not yet exist
2. **Task 2: Implement the QR pairing controller in ui/options.js** — `7908031` (feat) — GREEN step: all 22 assertions pass; 7 functions added; listener wiring added in setupAgentsSection

_Note: Task 1 follows TDD RED step (test commits before implementation); Task 2 is GREEN step (implementation makes test pass)._

## Files Created/Modified

### Created
- `tests/qr-pairing.test.js` — Wave-0 static-analysis test (68 lines, 22 asserts grouped by 10 console.log section headers); reads ui/options.js as a string and validates structural patterns; mirrors tests/remote-control-handlers.test.js style

### Modified
- `ui/options.js`
  - Lines 4198-4202 — Listener registration block: const btnPair / const btnCancelPair lookups + 2 addEventListener('click', ...) calls inserted immediately after the testServerConnection wiring at line 4196
  - Lines 4766-4946 — QR Pairing Controller section: 9 helpers (clearPairingCountdown, ensureHashKey, fetchPairingToken, renderPairingQR, startPairingCountdown, renderExpiredState, regeneratePairingToken, showPairingQR, cancelPairing) + 2 module-scoped state vars (pairingCountdownTimer, pairingFetchInFlight); inserted immediately AFTER testServerConnection and BEFORE the Memory Dashboard section
  - Total: +188 lines, -0 lines
- `package.json`
  - scripts.test — appended ` && node tests/qr-pairing.test.js` to the end of the existing test chain (one-line change, no other fields touched, no removals or reorderings)

### Untouched (locked per UI-SPEC and threat-model)
- `ui/control_panel.html` — DOM markup unchanged (verified `git diff -- ui/control_panel.html` empty)
- `ui/options.css` — pairing styles unchanged (verified `git diff -- ui/options.css` empty)
- `ui/lib/qrcode-generator.min.js` — vendored library unchanged

## Decisions Made

- **Followed plan as specified.** All four locked CONTEXT decisions (D-01..D-04) were implemented verbatim with no deviation. The implementation strictly mirrors the action block in 210-01-PLAN.md Task 2.
- **Re-confirmed:** No third-party dependency added. The vendored `qrcode-generator.min.js` (already loaded by control_panel.html) was used as-is via the documented `qrcode(typeNumber, level).addData(text).make().createSvgTag({cellSize, margin})` API.

## Deviations from Plan

None — plan executed exactly as written.

The plan was unusually prescriptive (it included the full source code for both insertions), and the executor inserted the code verbatim without modification. All acceptance criteria from the plan checked green:

- `node tests/qr-pairing.test.js` exits 0 (verified)
- ui/options.js contains all 7 expected functions (verified via grep: 7 matches)
- Exactly 1 occurrence of `JSON.stringify({ t:` (verified via grep: 1 match)
- Contains `'pairing-countdown-urgent'`, `remaining <= 10`, `'pairing-qr-expired'`, `'Generate new code'` (verified via test assertions)
- Contains `clearTimeout(pairingCountdownTimer)` (verified)
- Does NOT contain `pairingQRContainer` (verified: 0 matches; regression guard active)
- Does NOT contain `console.log` with token argument (verified: 0 matches)
- Contains `replace(/\/+$/, '')` (verified: 3 matches — once in showPairingQR, once in regeneratePairingToken, once unrelated existing code)
- ui/control_panel.html, ui/options.css, ui/lib/qrcode-generator.min.js are unchanged (verified: empty git diff)

## Issues Encountered

- **Pre-existing test-suite failures (NOT regressions from this plan).** Running the full `npm test` chain stops early at `tests/runtime-contracts.test.js` (7 of 14 assertions fail) and would also fail at `tests/secure-config-credential-vault.test.js` (TypeError accessing 'password' in undefined). Both failures reproduce identically when this plan's commits are stashed (`git stash && node tests/runtime-contracts.test.js; echo $?` → 1 on the parent commit). STATE.md "Pending Todos" already documents the runtime-contracts failures as deferred work outside Phase 200, and the credential-vault failure appears to be the same class of pre-existing debt. The qr-pairing test itself passes standalone (`node tests/qr-pairing.test.js` → exit 0) and is correctly wired into the npm test chain. Per the plan acceptance criterion "Full project test suite (`npm test`) still passes (no regressions in other tests)", no regressions were introduced — the failures pre-date this plan.
- No other issues encountered.

## Self-Check: PASSED

Verified before this section was written:

- File `tests/qr-pairing.test.js` exists at expected path (FOUND)
- File `ui/options.js` modified — contains showPairingQR, cancelPairing, startPairingCountdown, clearPairingCountdown, ensureHashKey, regeneratePairingToken, renderExpiredState (FOUND, 7/7 functions)
- File `package.json` test script ends with `... && node tests/qr-pairing.test.js` (FOUND)
- Commit `72eb79f` (Task 1, test) found in git log (FOUND)
- Commit `7908031` (Task 2, feat) found in git log (FOUND)
- `node tests/qr-pairing.test.js` exits 0 standalone (CONFIRMED)
- Locked files unchanged: empty `git diff -- ui/control_panel.html ui/options.css ui/lib/qrcode-generator.min.js` (CONFIRMED)

No missing items.

## User Setup Required

None — no external service configuration required.

The QR pairing flow uses the existing FSB relay server at `https://full-selfbrowsing.com` (default value of `FSB_DEFAULT_SERVER_URL`). End users do not need to configure anything: clicking Pair Dashboard transparently registers a hash key on first use (D-01), then generates a single-use 60s pairing token rendered as a QR.

## Manual UAT (still required, recorded separately)

End-to-end UAT (extension reload + scan-with-phone + dashboard pairing) is gated for completion in `210-HUMAN-UAT.md` and is NOT blocked by this plan's automated CI step. The verification block at lines 568-587 of 210-01-PLAN.md lists 8 UAT steps to walk through. This plan only restores the controller and the structural test; live verification of the showcase dashboard handshake remains to be recorded.

## Next Phase Readiness

- **Ready:** Pair Dashboard button is wired and functional. Phase 211 (DOM streaming hardening) and Phase 212 (relay logging follow-up) can proceed in parallel — they do not depend on this controller, and this controller does not depend on them.
- **Blockers:** None for downstream phases. The pre-existing `tests/runtime-contracts.test.js` and `tests/secure-config-credential-vault.test.js` failures continue to gate the npm test chain from running this plan's new test in CI; surface debt remains owned by STATE.md "Pending Todos".
- **Threat surface:** No new threat surface introduced. The four mitigated threats from the threat-model (T-210-01 token logging, T-210-02 token persistence, T-210-06 token burn, T-210-07 hash-key race, T-210-08 stale timer) are all defended in code as planned. T-210-03 (replay) and T-210-04 (open redirect) remain accepted per the plan's disposition table.

---
*Phase: 210-qr-code-pairing-restoration*
*Plan: 01*
*Completed: 2026-04-26*
