---
phase: 247-recovery-tools-bootstrap-from-restricted-active-tab
verified: 2026-05-08T10:10:00Z
status: passed_with_caveat
score: protocol bug closed; one live switch_tab branch accepted by automated evidence
---

# Phase 247 Verification

Status: passed with caveat.

## Goal Coverage

| Contract | Status | Evidence |
|----------|--------|----------|
| `open_tab` is bootstrap-safe from restricted active tabs | SATISFIED | Live UAT opened background tab `695914148` from active `chrome://newtab/` and returned ownership. |
| Zero-owned `navigate` can recover from restricted active tab | SATISFIED | Live UAT created/bound background tab `695914152` while active tab remained `chrome://newtab/`. |
| `switch_tab` can claim an unowned normal target | SATISFIED-AUTOMATED | Covered by `tests/recovery-tools-bootstrap.test.js`; live candidate tabs were already owned by `legacy:sidepanel`. |
| Cross-agent/cross-owner targets remain protected | SATISFIED | Live UAT observed `Detected: Tab ownership`; automated tests assert rejection before navigation/focus side effects. |
| Error labels are accurate | SATISFIED | Protocol/ownership errors map to Agent scope or Tab ownership instead of generic Page navigation; restricted-page `read_page` gives truthful recovery guidance. |

## Verification Commands

- `node tests/recovery-tools-bootstrap.test.js`
- `node tests/mcp-recovery-messaging.test.js`
- `node tests/mcp-restricted-tab.test.js`
- `node tests/action-tool-agent-scoped.test.js`
- `node tests/multi-agent-regression.test.js`
- Live MCP UAT in `247-HUMAN-UAT.md`.

## Caveat

The current Chrome environment auto-owned manually created normal tabs as `legacy:sidepanel`, so a live unowned-target `switch_tab` claim could not be reproduced. The observed live behavior is still correct for cross-owner protection, and the unowned claim path is covered by automated dispatcher tests.
