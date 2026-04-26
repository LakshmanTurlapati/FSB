---
status: partial
phase: 210-qr-code-pairing-restoration
source: [210-VERIFICATION.md]
started: 2026-04-26T00:00:00Z
updated: 2026-04-26T00:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. End-to-end QR pairing handshake with the showcase dashboard
expected: Reload the extension, open the options page, click Pair Dashboard, verify the centered overlay renders a scannable QR with a ticking 60s countdown, scan with a phone using showcase/js/dashboard.js handleScannedQR, and confirm the dashboard reports a successful pairing exchange
result: [pending]

### 2. Visual urgency at remaining <= 10s
expected: Wait until the countdown reaches 10s and observe #pairingCountdown turning orange, switching to weight 700, and pulsing once per second via the existing pairingPulse keyframe
result: [pending]

### 3. D-02 in-overlay regenerate-on-expiry
expected: Let the countdown reach 0 and verify (a) overlay does NOT auto-close, (b) #pairingCountdown shows 'Expired' in red via .pairing-qr-expired, (c) the QR slot is replaced by a single 'Generate new code' control-btn.accent button, (d) clicking it re-fetches a token, re-renders the QR, and restarts the 60s countdown without closing the overlay
result: [pending]

### 4. D-01 silent hash-key auto-gen on a fresh install
expected: Clear chrome.storage.local.serverHashKey via DevTools, click Pair Dashboard once, and verify (a) no error toast, (b) the overlay opens with a working QR, (c) #serverHashKey input is now populated with the freshly registered key
result: [pending]

### 5. Duplicate-click guard against rapid Pair Dashboard clicks
expected: Click #btnPairDashboard rapidly several times in succession and verify only one /api/pair/generate request fires in the Network tab and only one QR renders
result: [pending]

### 6. Cancel resets all DOM state cleanly
expected: Open the overlay, click the close x, then click Pair Dashboard again, and verify the overlay re-opens with a fresh QR (no stale countdown, no stale urgent or expired classes, no stale message text)
result: [pending]

### 7. Regression check on neighboring Server Sync flows
expected: Verify Generate Hash Key, Copy Hash Key, and Test Connection buttons in the Server Sync card still work as before
result: [pending]

### 8. Locked surface verification (visual)
expected: Confirm overlay layout, popup card styling, close x positioning, and Pair Dashboard button styling match the locked UI-SPEC visually after extension reload
result: [pending]

## Summary

total: 8
passed: 0
issues: 0
pending: 8
skipped: 0
blocked: 0

## Gaps
