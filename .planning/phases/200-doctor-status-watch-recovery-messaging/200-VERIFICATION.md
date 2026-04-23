---
phase: 200-doctor-status-watch-recovery-messaging
verified: 2026-04-23T18:20:40Z
status: passed
score: 9/9 must-haves verified
overrides_applied: 0
---

# Phase 200: Doctor, Status Watch & Recovery Messaging Verification Report

**Phase Goal:** Users can diagnose and recover MCP failures without guessing whether to restart the host, extension, browser, or config.
**Verified:** 2026-04-23T18:20:40Z
**Status:** passed
**Re-verification:** No - initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `doctor` classifies package/config/bridge/extension/content-script/tool-routing failures separately. | VERIFIED | `classifyDoctorLayer()` in `mcp-server/src/diagnostics.ts` implements the ordered classifier; `node tests/mcp-diagnostics-status.test.js` passed all seven layer fixtures. |
| 2 | `status --watch` streams live bridge mode, extension heartbeat, hub/relay state, disconnect reason, and diagnosed layer. | VERIFIED | `watchBridgeDiagnostics()` polls `collectBridgeDiagnostics()` and `formatWatchSnapshot()` renders `Mode`, `Ext`, `Heartbeat`, `Hub`, `Relays`, `Disconnect`, and `Layer`; ordering is locked by `tests/mcp-diagnostics-status.test.js`. |
| 3 | The extension can distinguish extension attachment from content-script availability for the active tab. | VERIFIED | `background.js` exposes bounded `activeTab`, `contentScript`, and `bridgeClient` state through the internal `mcp:get-diagnostics` route; content-script readiness is built from `contentScriptPorts` and `contentScriptReadyStatus`. |
| 4 | MCP tool failures use the same named layers as doctor/status and give one concrete next action. | VERIFIED | `mapFSBError()` in `mcp-server/src/errors.ts` now emits `Detected`, `Why`, and `Next action` blocks using the shared layer names; `node tests/mcp-recovery-messaging.test.js` passed all required fixtures. |
| 5 | Restricted-page recovery remains navigation-only and continues to exclude `run_task`. | VERIFIED | `getValidRecoveryTools()` still filters `run_task`, and both `tests/mcp-recovery-messaging.test.js` and `tests/mcp-restricted-tab.test.js` assert the four allowed recovery tools only. |
| 6 | MCP version surfaces agree on `0.6.0` across runtime, registry metadata, CLI output, and docs. | VERIFIED | `mcp-server/package.json`, `mcp-server/src/version.ts`, `mcp-server/server.json`, and the built version artifacts all report `0.6.0`; `node tests/mcp-version-parity.test.js` passed. |
| 7 | MCP docs route failures through `doctor` and `status --watch` before manual reinstall or restart steps. | VERIFIED | Both `mcp-server/README.md` and `README.md` now point users to `doctor` first and `status --watch` second; parity test asserts those references. |
| 8 | The root MCP test suite now runs restricted recovery, recovery messaging, version parity, and diagnostics together. | VERIFIED | `package.json` runs `mcp-restricted-tab.test.js`, `mcp-recovery-messaging.test.js`, `mcp-version-parity.test.js`, and `mcp-diagnostics-status.test.js` in sequence after the MCP build. |
| 9 | Phase 200 does not reintroduce broad shotgun guidance like `restart everything`. | VERIFIED | `rg "restart everything|try a few things" mcp-server/src/errors.ts` returned no matches, and the recovery messaging regression explicitly guards against that copy. |

**Score:** 9/9 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `mcp-server/src/diagnostics.ts` | Normalized snapshot, classifier, and watch helper | VERIFIED | Exists and contains `classifyDoctorLayer`, `watchBridgeDiagnostics`, version parity checks, and structured probe notes. |
| `mcp-server/src/index.ts` | `status --watch` and shared doctor/status/watch renderers | VERIFIED | Exists and supports `--watch`, `--interval`, shared field rendering, and direct-import-safe exports for tests. |
| `mcp-server/src/errors.ts` | Layer-aware MCP tool error formatter | VERIFIED | Exists and emits `Detected`, `Why`, and `Next action` using the required layer labels. |
| `tests/mcp-diagnostics-status.test.js` | Doctor/status/watch regression coverage | VERIFIED | Passed 25/25. |
| `tests/mcp-recovery-messaging.test.js` | Recovery-copy regression coverage | VERIFIED | Passed 30/30. |
| `tests/mcp-version-parity.test.js` | Version/docs/CLI parity regression coverage | VERIFIED | Passed 10/10. |
| `README.md` and `mcp-server/README.md` | Doctor/status-first troubleshooting flow | VERIFIED | Both docs now include `doctor` and `status --watch` guidance. |

### Behavioral Verification

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| MCP server builds | `npm --prefix mcp-server run build` | Exit 0 | PASS |
| Diagnostics regression | `node tests/mcp-diagnostics-status.test.js` | 25 passed, 0 failed | PASS |
| Recovery messaging regression | `node tests/mcp-recovery-messaging.test.js` | 30 passed, 0 failed | PASS |
| Restricted recovery regression | `node tests/mcp-restricted-tab.test.js` | 74 passed, 0 failed | PASS |
| Version parity regression | `node tests/mcp-version-parity.test.js` | 10 passed, 0 failed | PASS |
| CLI help version output | `node mcp-server/build/index.js help` | Prints `FSB MCP Server 0.6.0` | PASS |
| CLI install usage version output | `node mcp-server/build/index.js install` | Prints `FSB MCP Server 0.6.0` | PASS |

Root `npm test` was not rerun as a phase gate because the project still carries a pre-existing unrelated `tests/runtime-contracts.test.js` failure around `SessionStateEmitter` / `sessionStateEvent`. The Phase 200-owned MCP slice passed all focused verification.

### Requirements Coverage

| Requirement | Description | Status | Evidence |
|-------------|-------------|--------|----------|
| DIAG-01 | `doctor` identifies the failing layer. | SATISFIED | Ordered classifier, doctor guidance copy, and seven-layer diagnostics regression all passed. |
| DIAG-02 | `status --watch` shows live bridge/heartbeat/topology state. | SATISFIED | Watch helper and renderer ship in `mcp-server/src/index.ts` / `mcp-server/src/diagnostics.ts`; diagnostics regression covers the required labels. |
| DIAG-03 | MCP errors provide exact recovery steps tied to the detected layer. | SATISFIED | `mapFSBError()` emits layer-aware `Detected / Why / Next action` blocks; recovery regression covers extension, content script, restricted page, tool routing, and page navigation. |
| DIAG-04 | Package, runtime, README, and reported server version metadata agree on one version string. | SATISFIED | Runtime, registry metadata, CLI output, and docs all align on `0.6.0`; parity regression passed. |

### Gaps Summary

No Phase 200 gaps found. The implementation satisfies all four roadmap success criteria with focused automated verification and a coherent user-facing diagnostics vocabulary.

---

_Verified: 2026-04-23T18:20:40Z_
_Verifier: Codex_
