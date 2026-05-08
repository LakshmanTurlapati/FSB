---
phase: 247-recovery-tools-bootstrap-from-restricted-active-tab
plan: 01
subsystem: mcp
tags: [agent-scope, tab-ownership, restricted-page, recovery-tools, error-mapping]
completed: 2026-05-08T06:35:00Z
status: implemented
---

# Phase 247 Plan 01: Recovery Tools Bootstrap From Restricted Active Tab

## Summary

Implemented the Phase 247 protocol fix. A registered MCP agent with zero owned tabs can now recover from an active `chrome://newtab/` using `open_tab`, `navigate`, or `switch_tab`, while normal content tools still require an owned target and cross-agent owned tabs still reject before mutation or focus transfer.

## Changes

- `extension/ws/mcp-bridge-client.js`
  - `open_tab` bypasses pre-dispatch owned-tab resolution and dispatches without an invented `tabId`.
  - `navigate` stays on the resolver path normally, but falls back to bootstrap dispatch when the resolver returns `NO_OWNED_TAB`.
  - `switch_tab` dispatches directly with its target `tabId`; dispatcher ownership checks decide claim vs reject.
  - Existing legacy `skipGate` behavior remains intact.

- `extension/ws/mcp-tool-dispatcher.js`
  - Added claim-aware ownership checks for `navigate` and `switch_tab`.
  - Unowned targets can be claimed by recovery tools; tabs owned by another agent reject with `TAB_NOT_OWNED` before `chrome.tabs.update`.
  - Successful recovery-tool claims bind the tab through the registry and return `ownershipToken`.

- `mcp/src/errors.ts`
  - MCP layered error mapping now inspects code-only extension envelopes.
  - Agent-scope and tab-ownership errors no longer fall through to generic `Page navigation`.
  - Added actionable mappings for `NO_OWNED_TAB`, `AMBIGUOUS_TAB`, `AGENT_NOT_REGISTERED`, `TAB_NOT_OWNED`, `TAB_INCOGNITO_NOT_SUPPORTED`, `TAB_OUT_OF_SCOPE`, `AGENT_CAP_REACHED`, and `AGENT_REGISTRY_UNAVAILABLE`.

- `tests/recovery-tools-bootstrap.test.js`
  - Added bridge-level tests for zero-owned `open_tab`, `navigate`, and `switch_tab`.
  - Added dispatcher-level tests proving restricted active tab recovery, claim behavior, and cross-agent pre-side-effect rejection.

- `tests/mcp-recovery-messaging.test.js`
  - Added protocol/ownership mapper fixtures proving these errors do not render as `Page navigation`.

- `package.json`
  - Added `tests/recovery-tools-bootstrap.test.js` to the full `npm test` chain.

## Verification

- `node tests/recovery-tools-bootstrap.test.js` passed.
- `node tests/open-tab-background-default.test.js` passed.
- `node tests/ownership-error-codes.test.js` passed.
- `npm --prefix mcp run build` passed.
- `node tests/mcp-recovery-messaging.test.js` passed.
- `node tests/mcp-restricted-tab.test.js` passed.
- `node tests/action-tool-agent-scoped.test.js` passed.
- `node tests/multi-agent-regression.test.js` passed.
- `npm test` passed.

## Manual UAT

Created `247-HUMAN-UAT.md`. Human Chrome UAT is still pending because it requires a real unpacked-extension runtime and MCP bridge session.

## Notes

- No commits were created in this pass.
- `.planning/config.json` and unrelated untracked directories were already dirty and were left untouched.
