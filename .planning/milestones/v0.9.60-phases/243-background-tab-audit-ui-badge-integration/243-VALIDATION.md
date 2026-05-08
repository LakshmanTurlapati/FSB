---
phase: 243
slug: background-tab-audit-ui-badge-integration
status: ready
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-06
---

# Phase 243 — Validation Strategy

## Test Infrastructure
| Property | Value |
|----------|-------|
| Framework | Plain-Node assert harness |
| Quick run | `node tests/foreground-audit.test.js && node tests/agent-tab-user-navigation.test.js && node tests/badge-agent-id.test.js && node tests/cap-counter-live.test.js` |
| Full | `npm test` + `npm --prefix mcp run build` |
| Runtime | Quick: <30s. Full: ~120s. |

## Sampling
- After every task commit: quick filter
- After every wave: full chain
- Existing v0.9.36 / Phase 238/239/240/241/242 contracts UNCHANGED

## Per-Task Verification Map
Populated by planner. Suggested rows: foreground audit table; force_foreground flag honored on switch_tab; webNavigation pause emission with agent-nav suppression; badge agentIdShort suffix; popup/sidepanel chip; cap helper text + current-active counter.

## Wave 0 Requirements
- [x] tests/foreground-audit.test.js — grep-only (or AST-only) check that no chrome.tabs.update({active:true}) outside switch_tab in tool routes
- [x] tests/agent-tab-user-navigation.test.js — listener emits LOG-04 on user-initiated navigation, suppresses on agent-initiated
- [x] tests/badge-agent-id.test.js — overlay state appends agentIdShort
- [x] tests/cap-counter-live.test.js — current-active counter updates on chrome.storage.session change; legacy:* filtered

## Manual UAT (auto-deferred)
- Real Chrome: badge shows agent_id suffix on overlay
- Real Chrome: popup shows "owned by Agent X" chip when foreign agent owns active tab
- Real Chrome: cap counter increments/decrements live
- Real Chrome: user navigation on agent-owned tab triggers pause signal log

## Sign-Off
- [x] All tasks have automated verify
- [x] Sampling continuity OK
- [x] Wave 0 covers MISSING refs

Approval: ready
