---
phase: 244
slug: hardening-regression-mcp-0-8-0-release
status: ready
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-06
---

# Phase 244 — Validation Strategy

## Test Infrastructure
| Property | Value |
|----------|-------|
| Framework | Plain-Node assert harness |
| Quick run | `node tests/multi-agent-regression.test.js` |
| Full | Full milestone test sweep + `npm --prefix mcp run build` |
| Runtime | Quick: ~30s. Full: ~180s. |

## Sampling
- After every task commit: quick filter
- Before verify: full milestone sweep — every test from Phases 237-243 must pass UNCHANGED

## Per-Task Verification Map
Populated by planner. Suggested rows: multi-agent regression suite (6 named cases); tool descriptions updated for every named tool; version bumps in package.json + server.json + sdk dep; CHANGELOG/README in mcp/.

## Wave 0 Requirements
- [x] tests/multi-agent-regression.test.js — 6 named cases (N parallel; N+1 reject; clean release; SW eviction reconciliation; 20-concurrent stress; tab-ID reuse race)

## Manual UAT (auto-deferred)
- Live MCP host (Claude Code / Cursor / OpenClaw) drives 8 parallel agents on real Chrome
- 0.8.0 build installed locally; smoke-test the back tool, run_task with heartbeat, multi-agent ownership rejects
- npm publish executed by user via tag-driven workflow

## Sign-Off
- [x] All tasks have automated verify
- [x] Sampling covers regression
- [x] Wave 0 covers MISSING refs

Approval: ready
