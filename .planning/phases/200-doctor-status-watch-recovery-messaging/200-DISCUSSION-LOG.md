# Phase 200: Doctor, Status Watch & Recovery Messaging - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-23T17:45:15Z
**Phase:** 200-Doctor, Status Watch & Recovery Messaging
**Areas discussed:** Failure Layer Classification, Status Watch Surface, Recovery Messaging Policy, Version Source Of Truth

---

## Failure Layer Classification

| Option | Description | Selected |
|--------|-------------|----------|
| Layered fixed-order diagnosis | Classify failures in a stable order: package/config, bridge, extension, content script, then routing. | ✓ |
| Symptom heuristic matching | Pick the diagnosis from whichever symptom string looks strongest at runtime. | |
| Connected vs disconnected only | Collapse diagnostics into a simple online/offline result. | |

**User's choice:** [auto] Layered fixed-order diagnosis
**Notes:** Recommended default accepted to keep momentum. This matches the roadmap success criteria and the telemetry already available in `mcp-server/src/diagnostics.ts`, `mcp-server/src/bridge.ts`, and `background.js`.

---

## Status Watch Surface

| Option | Description | Selected |
|--------|-------------|----------|
| Human watch stream by default | Show a compact live view for bridge mode, extension status, heartbeat age, hub/relay state, and disconnect reason; keep JSON opt-in. | ✓ |
| JSON-only event stream | Emit structured events only and leave humans to parse them manually. | |
| Full troubleshooting transcript each tick | Repeat remediation prose on every watch refresh. | |

**User's choice:** [auto] Human watch stream by default
**Notes:** Recommended default accepted to keep the live surface readable during repeated checks. `doctor` remains the deeper one-shot diagnosis path; `status --watch` stays operational.

---

## Recovery Messaging Policy

| Option | Description | Selected |
|--------|-------------|----------|
| Single best next action per detected layer | Tell the user the broken layer, why it was chosen, and the one action most likely to fix it. | ✓ |
| Broad multi-step checklist | Print several possible fixes even when only one layer is implicated. | |
| Restart-first guidance for most failures | Default to restarting host/browser/extension even when a narrower fix exists. | |

**User's choice:** [auto] Single best next action per detected layer
**Notes:** Recommended default accepted. This carries forward the Phase 199 handoff that recovery wording should become more polished here without weakening the routing-specific hints already in `mcp-server/src/errors.ts`.

---

## Version Source Of Truth

| Option | Description | Selected |
|--------|-------------|----------|
| Explicit parity contract across package/runtime/docs | Treat package metadata, runtime constants, server metadata, CLI output, and docs as one MCP version surface and verify them together. | ✓ |
| Root package.json as the sole source of truth | Reuse the extension app version for the MCP package version story. | |
| Manual release checklist only | Rely on humans to notice drift before publish. | |

**User's choice:** [auto] Explicit parity contract across package/runtime/docs
**Notes:** Recommended default accepted because the repo currently has visible drift between `mcp-server/package.json`, `mcp-server/src/version.ts`, `mcp-server/server.json`, and README references.

---

## the agent's Discretion

- Exact terminal redraw style for `status --watch`
- Exact helper naming for classification and parity checks
- Exact automated parity-check mechanism

## Deferred Ideas

None.

---

*Phase: 200-doctor-status-watch-recovery-messaging*
*Discussion log generated: 2026-04-23*
