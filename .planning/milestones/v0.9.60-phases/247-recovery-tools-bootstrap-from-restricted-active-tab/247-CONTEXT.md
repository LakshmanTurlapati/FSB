# Phase 247: Recovery Tools Bootstrap From Restricted Active Tab - Context

**Gathered:** 2026-05-07
**Status:** Ready for planning
**Source:** Protocol bug report from restricted `chrome://newtab/` recovery test

<domain>
## Phase Boundary

Fix the MCP recovery protocol when the active browser tab is a restricted browser-internal page and the calling MCP agent owns zero tabs.

The current bridge is healthy: `agent:register` succeeds and read tools work when the caller supplies an explicit owned `tab_id`. The failure is narrower: MCP write/recovery tools that should not need a content-script-attachable active tab (`open_tab`, `navigate`, `switch_tab`) are blocked before they can create or claim a usable tab. The error surfaced to the MCP host is also misleading because code-only ownership/resolver envelopes fall through to the generic `Page navigation` mapper.

This phase must preserve the Phase 240 ownership model and the Phase 246 resolver model for normal content/action tools. It should only carve out protocol-safe bootstrap behavior for tools whose purpose is to create, claim, or move to a tab without reading page DOM.

Out of scope:
- Any broad rollback of Phase 246 resolver behavior for content tools.
- Any permission or manifest change.
- Any popup/sidepanel UX change.
- Any change to the rule that cross-agent owned tabs reject with `TAB_NOT_OWNED`.

</domain>

<decisions>
## Implementation Decisions

### Root cause

- `extension/ws/mcp-bridge-client.js::_handleExecuteAction` calls `resolveAgentTabOrError` before dispatching every action tool.
- That is correct for normal content/action tools, but wrong for tab creators and claimers.
- `open_tab` is a tab creator. It should not require an existing owned tab.
- `navigate` can be a bootstrap claimer when the agent owns zero tabs and no `tab_id` was provided. It uses `chrome.tabs.update`, not content-script injection, so `chrome://newtab/` is a valid source tab as long as the tab is unowned or already owned by the caller.
- `switch_tab` can be a bootstrap claimer when the target tab is unowned. It must still reject if another agent owns the target tab.
- `list_tabs` is already a safe recovery tool and should remain free of restricted-active-tab content checks.
- MCP server-side `mapFSBError` only keys on `errorCode`; many extension gate/resolver errors return only `code`, so `NO_OWNED_TAB`, `TAB_NOT_OWNED`, and related protocol errors fall through to the default `Page navigation` detail.

### Tool classes

- Add an explicit, local classification for bootstrap-safe browser tools:
  - `open_tab`: creates a new tab and binds it to the calling agent on success.
  - `navigate`: may claim an unowned target tab before navigating; with no `tab_id`, it may use the active tab if unowned or same-agent owned.
  - `switch_tab`: may claim an unowned target tab before or after switching; if the target is owned by another agent, reject before focus transfer.
  - `list_tabs`: enumerate tabs; do not require content-script attachability.
- Keep all other tools on the existing Phase 246 resolver path. A zero-owned agent calling `click`, `read_page`, `start_visual_session`, etc. should still get `NO_OWNED_TAB`.

### Ownership safety

- `open_tab` skips tab resolution entirely and calls the dispatcher with no `tabId`; Phase 240's agent-registration arm still runs, and `handleOpenTabRoute` binds the created tab.
- `navigate` must not mutate a tab owned by another agent. If the target was resolved from the active tab inside the handler, check owner metadata before `chrome.tabs.update`.
- `switch_tab` must not foreground a tab owned by another agent. Check owner metadata before `chrome.tabs.update({active:true})`.
- Unowned tab claim is allowed for `navigate` and `switch_tab` because it is the only recovery path after registry reset/SW reload when a normal tab exists but the agent owns nothing.
- `bindTab` remains the only ownership minting primitive. Do not write ownership maps directly.

### Restricted-page behavior

- Restricted active pages should block content-script-dependent read/interaction tools.
- Restricted active pages should not block `open_tab`, `list_tabs`, `switch_tab`, or `navigate` before they perform tab-level Chrome API work.
- The restricted read response can continue to suggest `navigate`, `open_tab`, `switch_tab`, and `list_tabs` only after those tools are proven to work from `chrome://newtab/`.

### Error mapping

- MCP error mapping must inspect both `errorCode` and `code`.
- Add protocol-specific layered details for at least:
  - `NO_OWNED_TAB`
  - `AMBIGUOUS_TAB`
  - `AGENT_NOT_REGISTERED`
  - `TAB_NOT_OWNED`
  - `TAB_INCOGNITO_NOT_SUPPORTED`
  - `TAB_OUT_OF_SCOPE`
  - `AGENT_CAP_REACHED`
  - `AGENT_REGISTRY_UNAVAILABLE`
- These errors must not display `Detected: Page navigation` unless the actual failure is a navigation failure.
- Extension envelopes may add `errorCode` alongside `code`, but must preserve `code` for existing tests and callers.

</decisions>

<canonical_refs>
## Canonical References

### Current milestone and phase context

- `.planning/STATE.md` - current v0.9.60 state and Phase 246 origin note.
- `.planning/ROADMAP.md` - Phase 246 entry and v0.9.60 constraints.
- `.planning/phases/246-agent-scoped-tab-resolution-background-default/246-CONTEXT.md` - resolver contract and D-16 tab-arm enforcement.
- `.planning/phases/246-agent-scoped-tab-resolution-background-default/246-VERIFICATION.md` - confirms current resolver behavior and test gaps.
- `.planning/phases/240-tab-ownership-enforcement-on-dispatch/240-02-PLAN.md` - dispatch gate and bindTab sites.

### Production code

- `extension/utils/agent-tab-resolver.js` - zero-owned and ambiguous-tab resolver behavior.
- `extension/ws/mcp-bridge-client.js` - `_handleExecuteAction` currently runs resolver before every action tool.
- `extension/ws/mcp-tool-dispatcher.js` - `checkOwnershipGate`, restricted-page response helpers, `handleOpenTabRoute`, `handleNavigateRoute`, `handleSwitchTabRoute`.
- `extension/utils/agent-registry.js` - `bindTab`, `isOwnedBy`, `getOwner`, `getAgentTabs`, `getTabMetadata`.
- `extension/ai/tool-definitions.js` and `mcp/ai/tool-definitions.cjs` - canonical tool registry and background route metadata.
- `mcp/src/errors.ts` - MCP host-facing layered error mapper.

### Existing tests to extend

- `tests/open-tab-background-default.test.js` - only tests direct dispatcher path today; does not cover real MCP `_handleExecuteAction`.
- `tests/action-tool-agent-scoped.test.js` - exercises resolver path but currently lacks `open_tab` bootstrap coverage.
- `tests/ownership-error-codes.test.js` - gate codes and D-16 ownership enforcement.
- `tests/mcp-restricted-tab.test.js` - restricted-page recovery tool list.
- `tests/mcp-recovery-messaging.test.js` - layered MCP error text.
- `tests/multi-agent-regression.test.js` - Phase 246 scenarios; direct dispatcher coverage for `open_tab`.

</canonical_refs>

<specifics>
## Specific Test Case From Bug Report

Initial state:
- Bridge connected.
- `agent:register` succeeds.
- Calling agent owns zero tabs.
- Active foreground tab is `chrome://newtab/`.
- A normal Google tab exists, for example tab id `695902575`.

Expected after this phase:
- `open_tab({ url: "https://example.com" })` succeeds, creates a background tab, binds it to the agent, and returns `tabId` plus `ownershipToken`.
- `navigate({ url: "https://example.com" })` succeeds from `chrome://newtab/` if the active tab is unowned or already owned by the caller, and binds the navigated tab.
- `switch_tab({ tabId: 695902575 })` succeeds if that tab is unowned, foregrounds it, and binds it to the caller. If it is owned by another agent, it rejects with `TAB_NOT_OWNED` before focus transfer.
- `read_page()` on `chrome://newtab/` still rejects with `restricted_active_tab`, but its suggested recovery tools are now truthful.
- Code-only protocol failures no longer render as generic `Page navigation`.

</specifics>

<deferred>
## Deferred Ideas

- Per-agent "adopt tab" tool with explicit user-facing semantics. Phase 247 keeps adoption limited to recovery tools.
- Dashboard UI for orphan/unowned tabs.
- Persistent ownership across browser restart.

</deferred>

---

*Phase: 247-recovery-tools-bootstrap-from-restricted-active-tab*
*Context gathered: 2026-05-07*
