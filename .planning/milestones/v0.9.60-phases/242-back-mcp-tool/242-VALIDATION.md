---
phase: 242
slug: back-mcp-tool
status: ready
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-06
---

# Phase 242 — Validation Strategy

## Test Infrastructure
| Property | Value |
|----------|-------|
| Framework | Plain-Node assert harness |
| Quick run | `node tests/back-tool.test.js && node tests/back-tool-ownership.test.js` |
| Full | `npm test` + `npm --prefix mcp run build && node tests/mcp-tool-smoke.test.js && node tests/mcp-tool-routing-contract.test.js` |
| Runtime | Quick: <30s. Full: ~120s. |

## Sampling Rate
- After every task commit: quick filter
- After every wave: full chain
- Before verify: existing v0.9.36 / 238 / 239 / 240 / 241 contracts UNCHANGED

## Per-Task Verification Map
Populated by planner per task. Suggested rows: agents.ts back tool registration; mcp:go-back route + handleBackRoute; 5 status codes (ok/no_history/cross_origin/bf_cache/fragment_only); ownership gate cross-agent reject.

## Wave 0 Requirements
- [x] tests/back-tool.test.js — 5 status code scaffolds
- [x] tests/back-tool-ownership.test.js — cross-agent reject
- [x] tests/mcp-tool-smoke.test.js extension — add 'back' to requiredSmokeTools

## Manual UAT (auto-deferred per autonomous run)
- Real Chrome: cross-agent back call returns TAB_NOT_OWNED with full ownerAgentId
- Real Chrome: back on background tab without focus switch
- Real Chrome: back through BF cache returns status: 'bf_cache' with resultingUrl

## Sign-Off
- [x] All tasks have automated verify
- [x] Sampling continuity OK
- [x] Wave 0 covers MISSING refs

Approval: ready
