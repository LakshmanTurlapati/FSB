---
status: passed_with_caveat
phase: 247-recovery-tools-bootstrap-from-restricted-active-tab
source: [247-01-SUMMARY.md]
started: 2026-05-08T06:35:00Z
updated: 2026-05-08T10:10:00Z
---

## Current Test

MCP closeout UAT rerun completed after creating an unowned `chrome://newtab/` outside FSB/MCP. Restricted active-tab recovery passes for the two zero-owned recovery paths that previously blocked (`open_tab` and `navigate`), and restricted-page messaging is truthful. The live `switch_tab` unowned-target branch could not be reproduced because browser-created candidate tabs were auto-owned by `legacy:sidepanel`; the unowned switch claim path remains covered by `tests/recovery-tools-bootstrap.test.js`.

## Tests

### 1. Restricted active tab recovery
expected: With the unpacked extension loaded, reload the extension or otherwise start from a fresh agent registry. Make `chrome://newtab/` the active foreground tab. From MCP, run `agent:register`; it succeeds even though the active tab is restricted. Run `list_tabs`; it succeeds and shows available tabs. Run `open_tab({ url: "https://example.com" })`; it succeeds, creates a tab, binds ownership to the calling agent, and returns an ownership token. Reset or release the agent, make `chrome://newtab/` active again, then run `navigate({ url: "https://example.com" })`; it succeeds if the active tab is unowned or same-agent owned and returns ownership. Reset or release again, make `chrome://newtab/` active, then run `switch_tab({ tabId: <unowned normal tab> })`; it succeeds, focuses the normal tab, binds ownership, and returns ownership. `read_page()` while targeting `chrome://newtab/` still reports `restricted_active_tab` and lists truthful recovery tools.
result: [passed_with_caveat]
why_human: Requires a real Chrome extension runtime, browser foreground tab state, and the MCP bridge connected to the unpacked extension. Node tests cover the bridge and dispatcher protocol paths, but the exact active-tab recovery loop must be confirmed in Chrome.
evidence:
- Strict setup used AppleScript, not FSB/MCP, to create active tab `695914147` at `chrome://newtab/`, so the caller had zero owned tabs and the active tab was unowned.
- `list_tabs()` succeeded and reported active restricted tab `695914147`.
- `open_tab({ url: "https://example.com/?fsb_uat=strict_open", active: false })` succeeded from the restricted active tab, returned tab `695914148` plus an ownership token, and active tab remained `695914147`.
- `navigate({ url: "https://example.com/?fsb_uat=strict_navigate" })` succeeded from the restricted active tab in the zero-owned state, created background tab `695914152`, returned an ownership token, and active tab remained `695914147`.
- `read_page()` while the active tab was `chrome://newtab/` returned the restricted-page error and named the truthful recovery tools: `navigate`, `open_tab`, `switch_tab`, and `list_tabs`.
- Live `switch_tab({ tabId: <unowned normal tab>, active: false })` could not be reproduced because normal tabs created from the current browser window were immediately owned by `legacy:sidepanel` (`695914157`, `695914164`). Those calls correctly rejected with `Detected: Tab ownership`.
- Automated dispatcher coverage for the unowned `switch_tab` claim branch passed in `node tests/recovery-tools-bootstrap.test.js`.

### 2. Cross-agent target remains protected
expected: With two registered MCP agents, make agent B own a normal tab. Agent A's `navigate({ tab_id: <B tab>, url: "https://example.com" })` and `switch_tab({ tabId: <B tab> })` reject with `TAB_NOT_OWNED` before navigation or focus transfer. MCP error text names `Tab ownership`, not `Page navigation`.
result: [passed]
why_human: Node tests verify the dispatcher rejects before side effects. Chrome UAT confirms the browser tab is not visibly navigated or foregrounded during a real MCP session.
evidence:
- User reported "#2 is done" during 2026-05-08 closeout.
- The same closeout session also observed live `Tab ownership` labels for cross-owner `navigate` / `switch_tab` attempts, not the old generic `Page navigation` label.

## Summary

total: 2
passed: 2
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

No blocking gaps for Phase 247 closeout.

Caveat: the live browser environment auto-owned manually created normal tabs as `legacy:sidepanel`, so the exact live unowned-target `switch_tab` claim branch could not be reproduced. This is accepted with automated evidence because `tests/recovery-tools-bootstrap.test.js` covers the dispatcher claim path and the live run confirmed cross-owner protection still rejects before focus transfer.
