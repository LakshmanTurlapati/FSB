# Phase 154 Live Verification Checklist

Status: blocked on live extension/browser environment

This checklist is intentionally separate from a phase summary. The live browser-backed verification has not been completed in this terminal-only environment, so Phase 154 is not marked complete yet.

## Automated baseline completed on 2026-04-02

| Check | Result | Notes |
|------|--------|-------|
| `npm test` | PASS | Existing repo test suite passed: scheduler, overlay state, task router, and agent start mode tests |
| `node --check content/dom-stream.js` | PASS | DOM stream code parses |
| `node --check background.js` | PASS | Background service worker parses |
| `node --check ws/ws-client.js` | PASS | Relay client parses |
| `node --check showcase/js/dashboard.js` | PASS | Website dashboard parses |
| `node --check server/src/ws/handler.js` | PASS | Relay handler parses |

Automated checks above support the phase, but they do not prove live dashboard/relay/browser behavior.

## Live matrix to execute

### Stream lifecycle

| Scenario | Expected | Status | Evidence / Notes |
|---------|----------|--------|------------------|
| Initial dashboard connect with streamable tab | Preview reaches `streaming` without manual refresh | PENDING | |
| Relay reconnect while preview is active | Preview recovers or reaches explicit not-ready state | PENDING | |
| Streaming-tab switch | New tab replaces old preview cleanly | PENDING | |
| Restricted or closed tab | Dashboard shows explicit not-ready/disconnected reason | PENDING | |
| Mutation divergence recovery | Preview requests/resumes from fresh snapshot rather than freezing | PENDING | |

### Remote control

| Scenario | Expected | Status | Evidence / Notes |
|---------|----------|--------|------------------|
| Click inside preview | Real browser receives intended click target | PENDING | |
| Printable typing | Characters insert once, not twice | PENDING | |
| Shortcut keys | Enter, Backspace, Ctrl/Cmd combos still work | PENDING | |
| Scroll inside preview | Real browser scrolls in the intended area/direction | PENDING | |
| Toggle remote control repeatedly | Debugger attach/detach does not wedge remote control | PENDING | |
| Switch tabs while remote control is on | Remote control retargets or disables cleanly | PENDING | |

### Task relay

| Scenario | Expected | Status | Evidence / Notes |
|---------|----------|--------|------------------|
| Submit valid task | Dashboard receives accepted-running state with task context | PENDING | |
| Submit invalid task or busy state | Dashboard receives clear immediate rejection reason | PENDING | |
| Progress during run | Progress carries percent, phase, elapsed, and action | PENDING | |
| Stop task | Final stopped state arrives once with last-action context | PENDING | |
| Successful completion | Final success state arrives once with summary | PENDING | |
| Failed completion | Final failure state arrives once with error | PENDING | |
| Reconnect mid-task | Dashboard restores the same `taskRunId` and current running state | PENDING | |
| Reconnect after final state | Dashboard restores the correct final state once for that run | PENDING | |

### Diagnostics

| Scenario | Expected | Status | Evidence / Notes |
|---------|----------|--------|------------------|
| Dashboard diagnostics during reconnect | `__FSBDashboardTransportDiagnostics` shows recovery events | PENDING | |
| Extension diagnostics during relay issues | `__FSBTransportDiagnostics` shows send/receive/failure evidence | PENDING | |
| Relay diagnostics during dashboard/ext traffic | `getRoomDiagnostics(hashKey)` shows relay direction and delivery counters | PENDING | |

## Exit condition

Do not create `154-01-SUMMARY.md` or `154-VERIFICATION.md` until the live matrix above has been executed against a real extension + relay + browser setup.
