---
status: partial
phase: 211-stream-reliability-diagnostic-logging
source: [211-VERIFICATION.md]
started: 2026-04-28T00:00:00.000Z
updated: 2026-04-28T00:00:00.000Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Live extension WebSocket reconnect under stale conditions
expected: Inbound `{_lz: true, d: <base64>}` frames decompress via `LZString.decompressFromBase64` and dispatch the inner `msg.type` correctly. Plain JSON frames fall through unchanged. When `LZString` is unavailable or returns null, `recordFSBTransportFailure('decompress-failed' | 'decompress-unavailable', ...)` records the drop without throwing. Test by exercising the live socket path through a relay-side compressed-frame test or chrome.devtools injection that sends a `_lz` envelope to the extension.
result: [pending]

### 2. DOM streaming watchdog under real-browser conditions
expected: Load `tests/fixtures/dom-stream-50k.html` in Chrome with the extension active. Verify (a) the 200ms perf bound holds for snapshot generation on a 5MB / ~50k-node fixture; (b) the 5s content-script stuck-queue threshold actually trips and forces a flush when the page is backgrounded and rAF is throttled; (c) the chrome.alarms-backed SW watchdog recovers after SW idle eviction (force-stop the SW from chrome://extensions, wait 30s, return to streaming tab — alarm refires and stream is re-validated); (d) `staleFlushCount` field appears on `ext:stream-state` payloads observable via dashboard or chrome devtools WS inspector.
result: [pending]

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps
