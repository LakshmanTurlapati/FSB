---
phase: 210-qr-code-pairing-restoration
verified: 2026-04-26T00:00:00Z
status: human_needed
score: 8/8 must-haves verified (automated)
overrides_applied: 0
human_verification:
  - test: "End-to-end QR pairing handshake with the showcase dashboard"
    expected: "Reload the extension, open the options page, click Pair Dashboard, verify the centered overlay renders a scannable QR with a ticking 60s countdown, scan with a phone using showcase/js/dashboard.js handleScannedQR, and confirm the dashboard reports a successful pairing exchange"
    why_human: "Requires Chrome MV3 runtime, chrome.storage, real DOM, and a phone camera scanning the QR. Cannot be exercised under Node static analysis."
  - test: "Visual urgency at remaining <= 10s"
    expected: "Wait until the countdown reaches 10s and observe #pairingCountdown turning orange, switching to weight 700, and pulsing once per second via the existing pairingPulse keyframe"
    why_human: "CSS animation rendering and color perception cannot be verified programmatically; only DOM class toggle is automatable (verified)"
  - test: "D-02 in-overlay regenerate-on-expiry"
    expected: "Let the countdown reach 0 and verify (a) overlay does NOT auto-close, (b) #pairingCountdown shows 'Expired' in red via .pairing-qr-expired, (c) the QR slot is replaced by a single 'Generate new code' control-btn.accent button, (d) clicking it re-fetches a token, re-renders the QR, and restarts the 60s countdown without closing the overlay"
    why_human: "Requires waiting through a real 60s timer in the live extension; the static-analysis test only confirms code paths exist, not that they execute correctly under real timing"
  - test: "D-01 silent hash-key auto-gen on a fresh install"
    expected: "Clear chrome.storage.local.serverHashKey via DevTools, click Pair Dashboard once, and verify (a) no error toast, (b) the overlay opens with a working QR, (c) #serverHashKey input is now populated with the freshly registered key"
    why_human: "Requires running chrome.storage.local in the live extension and observing the network call to /api/auth/register"
  - test: "Duplicate-click guard against rapid Pair Dashboard clicks"
    expected: "Click #btnPairDashboard rapidly several times in succession and verify only one /api/pair/generate request fires in the Network tab and only one QR renders"
    why_human: "Requires DevTools Network tab inspection to confirm no token burn"
  - test: "Cancel resets all DOM state cleanly"
    expected: "Open the overlay, click the close x, then click Pair Dashboard again, and verify the overlay re-opens with a fresh QR (no stale countdown, no stale urgent or expired classes, no stale message text)"
    why_human: "Requires sequential interactive verification of DOM state across cancel/reopen cycles"
  - test: "Regression check on neighboring Server Sync flows"
    expected: "Verify Generate Hash Key, Copy Hash Key, and Test Connection buttons in the Server Sync card still work as before"
    why_human: "These existing flows are adjacent to the new listener registration block; manual confirmation that no listeners were disturbed"
  - test: "Locked surface verification (visual)"
    expected: "Confirm overlay layout, popup card styling, close x positioning, and Pair Dashboard button styling match the locked UI-SPEC visually after extension reload"
    why_human: "Visual fidelity to the locked CSS contract requires human inspection"
---

# Phase 210: QR Code Pairing Restoration Verification Report

**Phase Goal:** Restore the QR code pairing controller so the existing Pair Dashboard button on the options page generates a 60-second QR pairing token, renders a scannable QR for the showcase dashboard, runs a visible countdown with urgency styling at <=10s, and supports cancel + in-overlay regenerate-on-expiry.

**Verified:** 2026-04-26T00:00:00Z
**Status:** human_needed
**Re-verification:** No - initial verification

## Goal Achievement

### Observable Truths

| #   | Truth                                                                                                                                                                                                                                                                            | Status     | Evidence                                                                                                                                                                                                                |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Clicking #btnPairDashboard calls POST /api/pair/generate with X-FSB-Hash-Key header and renders a QR encoding {t: token, s: serverUrl} into #pairingQRCode                                                                                                                       | VERIFIED   | ui/options.js:4795-4804 (fetchPairingToken with X-FSB-Hash-Key header), 4806-4813 (renderPairingQR with JSON.stringify({t, s})), 4887-4927 (showPairingQR composes them); listener registered ui/options.js:4199-4201   |
| 2   | If chrome.storage.local.serverHashKey is missing, the extension silently calls POST /api/auth/register and persists the returned hashKey before requesting the pairing token (D-01)                                                                                              | VERIFIED   | ui/options.js:4781-4793 ensureHashKey: silent /api/auth/register POST, persists serverHashKey to chrome.storage.local, mirrors into #serverHashKey input, returns key directly to caller (no DOM re-read race)         |
| 3   | After QR is rendered, #pairingQROverlay.style.display is set to 'flex' and a 60-second countdown driven by the server's expiresAt ticks once per second in #pairingCountdown                                                                                                     | VERIFIED   | ui/options.js:4920 (overlay.style.display = 'flex' AFTER renderPairingQR), 4815-4836 (startPairingCountdown driven by new Date(expiresAt).getTime() with self-rescheduling setTimeout)                                  |
| 4   | When remaining <= 10s, .pairing-countdown-urgent class is toggled on #pairingCountdown; the class is removed when the countdown is reset (D-03)                                                                                                                                  | VERIFIED   | ui/options.js:4823-4827 (add .pairing-countdown-urgent when remaining <= 10 && remaining > 0; remove when remaining > 10); also removed in cancelPairing:4938 and showPairingQR:4916                                  |
| 5   | When the countdown reaches 0, the overlay does NOT auto-close; #pairingCountdown shows 'Expired' with .pairing-qr-expired and #pairingQRCode is replaced by a 'Generate new code' button that re-runs the fetch and restarts the countdown without closing the overlay (D-02)    | VERIFIED   | ui/options.js:4838-4855 renderExpiredState: removes urgent class, adds .pairing-qr-expired, sets text to 'Expired', clears qrCodeEl, creates control-btn.accent regenerate button; 4854 explicitly leaves overlay open |
| 6   | Clicking #btnCancelPairing clears the timer, hides the overlay (display: 'none'), and resets #pairingCountdown text, urgent/expired classes, the QR slot, and the message slot                                                                                                   | VERIFIED   | ui/options.js:4929-4946 cancelPairing: clearPairingCountdown first, overlay.style.display = 'none', innerHTML cleared, classes removed, textContent reset, message cleared                                              |
| 7   | Duplicate clicks on #btnPairDashboard while the overlay is open are no-ops, so server tokens are not burned                                                                                                                                                                      | VERIFIED   | ui/options.js:4890 early return if overlay.style.display === 'flex' OR pairingFetchInFlight; pairingFetchInFlight set in try/finally at 4900/4925                                                                       |
| 8   | tests/qr-pairing.test.js exits 0 and is wired into npm test                                                                                                                                                                                                                      | VERIFIED   | node tests/qr-pairing.test.js exits 0 (confirmed via Bash); package.json line 16 ends scripts.test with `&& node tests/qr-pairing.test.js`                                                                              |

**Score:** 8/8 truths verified (automated layer)

### Required Artifacts

| Artifact                       | Expected                                                                                                                                                                                                                       | Status     | Details                                                                                                                                                                                                                                                |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| tests/qr-pairing.test.js       | Static-analysis structural test for the controller; reads ui/options.js as a string; assertions on listener wiring, /api/pair/generate fetch, JSON.stringify({t,s}), urgency threshold, expired path, /api/auth/register, qrcode( | VERIFIED   | 68 lines; 22 assert(...) calls grouped by 10 console.log section headers; runs with exit 0; covers all listed assertions                                                                                                                              |
| ui/options.js                  | showPairingQR, cancelPairing, startPairingCountdown, clearPairingCountdown, ensureHashKey, regeneratePairingToken, renderExpiredState helpers + listener registration                                                          | VERIFIED   | All 9 helpers present at ui/options.js:4774-4946 (clearPairingCountdown, ensureHashKey, fetchPairingToken, renderPairingQR, startPairingCountdown, renderExpiredState, regeneratePairingToken, showPairingQR, cancelPairing); listeners at 4199-4202    |
| package.json                   | Test invocation wired into the existing test script chain                                                                                                                                                                      | VERIFIED   | scripts.test ends with `&& node tests/qr-pairing.test.js` (line 16); existing tests preserved; valid JSON                                                                                                                                              |

### Key Link Verification

| From                                       | To                                | Via                                                          | Status | Details                                                                                                                                                              |
| ------------------------------------------ | --------------------------------- | ------------------------------------------------------------ | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ui/options.js fetchPairingToken            | POST {serverUrl}/api/pair/generate | fetch with X-FSB-Hash-Key header; awaits JSON {token, expiresAt} | WIRED  | ui/options.js:4796-4803; explicit method:'POST', headers:{'X-FSB-Hash-Key': hashKey}, validates {token, expiresAt} on response                                       |
| ui/options.js renderPairingQR              | qrcode-generator library          | qrcode(0, 'M').addData(JSON.stringify({t,s})).make() and createSvgTag | WIRED  | ui/options.js:4806-4813 invokes qrcode(0, 'M'), addData(payload), make(), createSvgTag({cellSize: 4, margin: 2})                                                     |
| ui/options.js startPairingCountdown        | #pairingCountdown classList        | toggle .pairing-countdown-urgent when remaining <= 10        | WIRED  | ui/options.js:4823-4827 add when (remaining <= 10 && remaining > 0); remove when (remaining > 10)                                                                    |
| ui/options.js cancelPairing                | #pairingQROverlay.style.display    | 'flex' for show, 'none' for hide                             | WIRED  | showPairingQR:4920 sets 'flex'; cancelPairing:4935 sets 'none'                                                                                                       |
| listener block (line 4199-4202)            | showPairingQR / cancelPairing      | addEventListener('click', ...)                               | WIRED  | btnPair.addEventListener('click', showPairingQR); btnCancelPair.addEventListener('click', cancelPairing); both null-guarded                                          |

### Data-Flow Trace (Level 4)

| Artifact                                | Data Variable          | Source                                              | Produces Real Data | Status   |
| --------------------------------------- | ---------------------- | --------------------------------------------------- | ------------------ | -------- |
| #pairingQRCode (innerHTML SVG)          | token + serverUrl      | fetchPairingToken POST /api/pair/generate           | Yes (server-validated hex token, 60s TTL) | FLOWING  |
| #pairingCountdown (textContent)         | remaining seconds      | new Date(expiresAt).getTime() - Date.now()          | Yes (server expiresAt drives monotonic countdown) | FLOWING  |
| #serverHashKey (input value)            | hashKey                | POST /api/auth/register response.hashKey            | Yes (silent auto-gen path D-01)              | FLOWING  |

### Behavioral Spot-Checks

| Behavior                                                  | Command                                | Result                                                          | Status |
| --------------------------------------------------------- | -------------------------------------- | --------------------------------------------------------------- | ------ |
| QR pairing static-analysis test passes                    | node tests/qr-pairing.test.js          | exit 0; "All QR pairing controller assertions passed."          | PASS   |
| All 9 controller helpers present in ui/options.js         | grep for function names                | 9 matches (showPairingQR, cancelPairing, startPairingCountdown, clearPairingCountdown, ensureHashKey, regeneratePairingToken, renderExpiredState, fetchPairingToken, renderPairingQR) | PASS   |
| package.json test chain ends with qr-pairing.test.js      | grep '&& node tests/qr-pairing.test.js' package.json | match                                                            | PASS   |
| No token logging anti-pattern                             | grep 'console\.log.*\btoken\b' ui/options.js | 0 matches                                                       | PASS   |
| Regression guard against legacy #pairingQRContainer       | grep 'pairingQRContainer' ui/options.js | 0 matches                                                       | PASS   |
| Locked DOM IDs intact in control_panel.html               | grep DOM IDs                            | btnPairDashboard, pairingQROverlay, pairingQRCode, pairingCountdown, pairingQRMessage, btnCancelPairing all present at lines 722-737 | PASS   |
| Locked files (control_panel.html, options.css, qrcode-generator.min.js) unchanged | git diff HEAD -- locked files          | empty diff                                                      | PASS   |

### Requirements Coverage

| Requirement | Source Plan | Description                                                                                                          | Status     | Evidence                                                                                                                                                                                                            |
| ----------- | ----------- | -------------------------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| QR-01       | 210-01-PLAN | User can generate a QR code from the extension options page that the showcase dashboard can scan to pair             | SATISFIED  | ui/options.js:4887-4927 showPairingQR + 4806-4813 renderPairingQR encode JSON.stringify({t, s}) per dashboard contract; listener wired at 4199-4201; test asserts QR payload shape and qrcode() invocation         |
| QR-02       | 210-01-PLAN | QR pairing shows a 60-second countdown with visual urgency indicator before token expiry                              | SATISFIED  | ui/options.js:4815-4836 startPairingCountdown drives countdown from server expiresAt; toggles .pairing-countdown-urgent at remaining <= 10 to trigger existing pairingPulse keyframe                                |
| QR-03       | 210-01-PLAN | User can cancel an active pairing attempt, hiding the overlay and resetting the button state                         | SATISFIED  | ui/options.js:4929-4946 cancelPairing clears timer, hides overlay (display='none'), resets countdown text/classes, clears QR + message slots; listener wired at 4202                                                |

No orphaned requirement IDs from REQUIREMENTS.md - all three (QR-01, QR-02, QR-03) are claimed by 210-01-PLAN and verified in the codebase.

### Anti-Patterns Found

| File           | Line       | Pattern                                                  | Severity | Impact                                                                                                                                                  |
| -------------- | ---------- | -------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ui/options.js  | 4865, 4918, 4940 | Hardcoded '60s' placeholder text duplicates server TTL constant | Info     | If server lowers/raises the pairing TTL, the overlay will briefly flash the wrong number for ~1 frame before tick() overwrites it. Tracked as IN-01 in code review. |
| ui/options.js  | 4860-4867 | regeneratePairingToken does not null-check qrCodeEl/countdownEl | Info     | If locked DOM contract is violated, this throws an unhandled exception inside the click handler whereas cancelPairing silently no-ops. Tracked as IN-02. |
| ui/options.js  | 4857-4859 | clearPairingCountdown runs before duplicate-click guard in regeneratePairingToken | Info     | Fragile ordering: any future change letting timers run during in-flight fetches would silently kill them on duplicate clicks. Tracked as IN-03.       |
| ui/options.js  | 4815-4836 | startPairingCountdown does not null-check countdownEl    | Info     | If contract violated, failure mode is a setTimeout-fired exception with no stack trace tied to user action. Tracked as IN-04.                          |
| ui/options.js  | 4857-4885 | Cancel-during-regenerate race: in-flight fetch can mutate hidden overlay after cancel | Warning  | Per WR-01 in 210-REVIEW.md: if user cancels while regeneratePairingToken is awaiting, the resolved fetch still calls renderPairingQR + startPairingCountdown on the now-hidden overlay, leaving a stray timer for up to 60s. Polish item, does not invalidate must-haves; surfaced for follow-up. |

### Human Verification Required

See the `human_verification` block in this report's frontmatter for 8 manual UAT items. The static-analysis layer covers structural conformance to the locked DOM, server, and CSS contracts; live behavior (Chrome MV3 runtime, real DOM, real network, phone camera scanning, CSS keyframe rendering, countdown timing across 60s) cannot be exercised under Node and is intentionally manual. The plan documents this and reserves a separate `210-HUMAN-UAT.md` for the recorded outcome.

### Gaps Summary

No automated gaps. All eight observable truths are verified, all artifacts exist and are substantive, all key links are wired, all three requirement IDs (QR-01, QR-02, QR-03) are satisfied, and the locked file surfaces (ui/control_panel.html, ui/options.css, ui/lib/qrcode-generator.min.js) are untouched per `git diff -- ...` returning empty.

The phase deliverable is structurally complete and ready for the documented manual UAT. The single review-surfaced WR-01 polish item (cancel-during-regenerate race) is a defense-in-depth follow-up rather than a goal-blocking gap and does not invalidate any must-have. The four IN-* items are minor defensive style improvements.

Status is `human_needed` because end-to-end goal achievement (the QR being scanned by a phone and the dashboard reporting a successful pair) inherently requires a human + real Chrome MV3 + real phone camera, which is the documented design of this verification path (CONTEXT D-04 forbade adding a polling endpoint to detect consumption).

---

_Verified: 2026-04-26T00:00:00Z_
_Verifier: Claude (gsd-verifier)_
