---
phase: 247
slug: recovery-tools-bootstrap-from-restricted-active-tab
status: ready
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-08
---

# Phase 247 Validation

## Validation Strategy

Phase 247 validates a protocol edge case that only appears when the active tab is a Chrome-internal restricted page and the calling MCP agent has no owned tabs.

## Automated Coverage

- `node tests/recovery-tools-bootstrap.test.js`
- `node tests/mcp-recovery-messaging.test.js`
- `node tests/mcp-restricted-tab.test.js`
- `node tests/action-tool-agent-scoped.test.js`
- `node tests/multi-agent-regression.test.js`

## Human UAT

See `247-HUMAN-UAT.md`. Live MCP verified:

- `list_tabs` works with active `chrome://newtab/`;
- `open_tab({ active:false })` recovers without changing active tab;
- zero-owned `navigate` recovers from active `chrome://newtab/` by creating/binding a background tab;
- restricted `read_page` names truthful recovery tools;
- cross-owner `switch_tab`/`navigate` reject as `Tab ownership`.

## Sign-Off

Nyquist validation accepted with the documented caveat that the exact live unowned-target `switch_tab` branch was not reproducible because local candidate tabs were automatically owned by `legacy:sidepanel`. Automated dispatcher coverage closes that branch.
