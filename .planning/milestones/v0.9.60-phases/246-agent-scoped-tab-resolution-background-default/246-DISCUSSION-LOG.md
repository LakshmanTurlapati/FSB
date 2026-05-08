# Phase 246: Agent-Scoped Tab Resolution + Background-Default open_tab - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md -- this log preserves the alternatives considered.

**Date:** 2026-05-06
**Phase:** 246-agent-scoped-tab-resolution-background-default
**Areas discussed:** Read tool resolution, open_tab default, Visual session resolution, Action tools + legacy fallback

---

## Read tool resolution

### Q1: How should the extension pick which tab to read when read_page (or get_dom_snapshot, etc.) is called WITHOUT tab_id?

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-resolve via registry (Recommended) | registry.getAgentTabs(agentId): 1 -> use, 0 -> NO_OWNED_TAB, 2+ -> AMBIGUOUS_TAB. No MCP schema change for single-tab case. | YES |
| Always require tab_id at MCP | Add tab_id as required field on every read tool's MCP schema. | |
| Auto-resolve, no error on multiple | If 1 use, if 2+ pick most-recently-bound. No error path. | |

**User's choice:** Auto-resolve via registry (Recommended)
**Notes:** Foundational decision; sets pattern for visual session and action tools.

### Q2: Should read tool MCP schemas expose an optional tab_id?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, optional tab_id on read tools (Recommended) | tab_id?: number on read_page, get_dom_snapshot, get_text, get_attribute, read_sheet, get_page_snapshot. | YES |
| No, agent_id-only resolution | Schemas stay as today; multi-tab agents must list_tabs + switch_tab. | |
| tab_id only on a subset | Add tab_id only to read_page and get_dom_snapshot; leave the rest. Inconsistent. | |

**User's choice:** Yes, optional tab_id on read tools (Recommended)
**Notes:** Lets multi-tab agents disambiguate without breaking single-tab callers.

### Q3: Where should agent-to-tab resolution happen?

| Option | Description | Selected |
|--------|-------------|----------|
| Extension-side resolution (Recommended) | MCP server threads agentId + optional tabId. Extension reads registry. Helper resolveAgentTabOrError. | YES |
| MCP server-side preflight | Server queries extension via new agent:owned-tabs RPC before each call. Adds round-trip. | |
| Hybrid (server hints, extension authoritative) | Server caches agentTabs map; extension re-validates. Two sources of truth; sync bugs likely. | |

**User's choice:** Extension-side resolution (Recommended)
**Notes:** Registry is extension-owned; matches Phase 237/240 split.

### Q4: How should legacy:popup/sidepanel/autopilot agents be handled?

| Option | Description | Selected |
|--------|-------------|----------|
| Branch on agentId prefix (Recommended) | First line: if agentId.startsWith('legacy:') return _getActiveTab(client); else use registry. | YES |
| Legacy surfaces bypass the resolver | popup/sidepanel/autopilot keep calling _getActiveTab() directly; only MCP paths switch. Two code paths. | |
| Legacy surfaces bind active tab on every action | Active rebind on every action. Confuses ownership semantics. | |

**User's choice:** Branch on agentId prefix (Recommended)
**Notes:** Preserves popup/sidepanel/autopilot UX byte-for-byte.

---

## open_tab default

### Q1: How should open_tab default for multi-agent?

| Option | Description | Selected |
|--------|-------------|----------|
| Default background, opt-in foreground (Recommended) | chrome.tabs.create({active: params.active === true}). Caller must pass active:true to steal focus. | YES |
| Always background, drop active param | Remove the active parameter entirely. Breaks legitimate foreground openers. | |
| Agent-aware default | Foreground for legacy:* agents, background for MCP agents. | |

**User's choice:** Default background, opt-in foreground (Recommended)
**Notes:** Aligns with smoke-test memo's "no focus-stealing" goal.

### Q2: How should the MCP open_tab schema describe `active`?

| Option | Description | Selected |
|--------|-------------|----------|
| Optional active, default false, documented (Recommended) | active?: boolean (default false). Description explains multi-agent default. | YES |
| Remove active from schema | Drop active from MCP schema entirely. | |
| Required active, no default | Force every caller to pass active:true|false explicitly. Friction for trivial cases. | |

**User's choice:** Optional active, default false, documented (Recommended)
**Notes:** Lets LLMs make informed choices.

### Q3: How wide should the focus-steal audit go?

| Option | Description | Selected |
|--------|-------------|----------|
| MCP-routed paths only (Recommended) | Audit mcp-bridge-client.js, mcp-tool-dispatcher.js, mcp-visual-session.js, MCP-triggered background.js handlers. Leave popup/sidepanel/options/ws-client.js. | YES |
| Full audit + flag-driven control | Audit ALL chrome.tabs focus-changing call sites repo-wide. Wrap each in _forceForeground. | |
| open_tab only this phase | Fix open_tab default; defer rest to a future phase. | |

**User's choice:** MCP-routed paths only (Recommended)
**Notes:** Scoped, predictable diff. Popup/sidepanel/options/ws-client legitimately operate on user's active tab.

### Q4: Should open_tab's bindTab + ownership_token contract change?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, bind + return token (Recommended) | Phase 240 D-08 already does this. Phase 246 keeps it; only the active default flips. | YES |
| Bind only when active:false | Auto-bind background tabs only; foreground tabs require explicit follow-up. Asymmetric. | |
| Caller passes tab_id back explicitly | Don't auto-bind; require new bind_tab MCP tool after open_tab. Maximum friction. | |

**User's choice:** Yes, bind + return token (Recommended)
**Notes:** Phase 240 D-08 contract preserved byte-for-byte.

---

## Visual session resolution

### Q1: How should start_visual_session pick a tab when called by an agent?

| Option | Description | Selected |
|--------|-------------|----------|
| Same as read tools: registry-driven (Recommended) | resolveAgentTabOrError. 1 -> use, 0 -> NO_OWNED_TAB, 2+ -> AMBIGUOUS_TAB. | YES |
| Visual session is special: needs explicit tab_id | Always require tab_id in start_visual_session MCP schema. | |
| Last-bound tab fallback | If 0 or 2+, pick most-recently-bound. No error. Masks bugs. | |

**User's choice:** Same as read tools: registry-driven (Recommended)
**Notes:** Consistent contract; one mental model.

### Q2: Should start_visual_session expose optional tab_id at the MCP layer?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, optional tab_id (Recommended) | Schema adds tab_id?: number with multi-agent description. | YES |
| Required tab_id on visual session | Force every call to pass tab_id. Use only if Q1 chose "special". | |
| Keep schema unchanged | Schema stays signature-parity with v0.9.36. Multi-tab agents must release. | |

**User's choice:** Yes, optional tab_id (Recommended)
**Notes:** Consistent with read tool schema change.

### Q3: How should same-agent re-entry behave with registry-driven resolution?

| Option | Description | Selected |
|--------|-------------|----------|
| Resolver returns tab; existing D-03 resume fires (Recommended) | Resolver picks tab; mcp-visual-session.js sees existing session for (tabId, sameAgent), runs resume code path. | YES |
| Resolver returns existing-session tab preferentially | If 2+ owned and one has session, pick that one (skip AMBIGUOUS_TAB). Hides multi-tab ambiguity. | |
| Re-entry requires explicit session_token | Force callers to pass session_token to re-attach. Breaks v0.9.36 idempotent contract. | |

**User's choice:** Resolver returns tab; existing D-03 resume fires (Recommended)
**Notes:** No new logic needed in mcp-visual-session.js.

### Q4: What error contract should the visual-session resolver use?

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse read-tool error codes + visual-session-specific extras (Recommended) | NO_OWNED_TAB and AMBIGUOUS_TAB shared with read tools. VS-specific codes kept. | YES |
| Visual-session prefixed codes | VS_NO_OWNED_TAB, VS_AMBIGUOUS_TAB. Distinct namespace; no real win. | |
| Map all to existing no_active_tab | Squash into legacy code. Loses signal between "0 owned" and "2+ owned". | |

**User's choice:** Reuse read-tool error codes + visual-session-specific extras (Recommended)
**Notes:** Composable; tests can share fixtures.

---

## Action tools + legacy fallback

### Q1: How should action tools (click, type_text, etc.) resolve their target tab?

| Option | Description | Selected |
|--------|-------------|----------|
| Same resolver as read/visual (Recommended) | _handleExecuteAction calls resolveAgentTabOrError. 1 -> use, 0 -> NO_OWNED_TAB, 2+ -> AMBIGUOUS_TAB. | YES |
| Action tools require tab_id at MCP | Add required tab_id to every action tool's MCP schema. Larger contract change. | |
| Action tools keep _getActiveTab for legacy compat | Only fix read tools and visual session. Contradicts smoke-test memo. | |

**User's choice:** Same resolver as read/visual (Recommended)
**Notes:** Single contract; predictable across all tool families.

### Q2: Should action tools' MCP schemas expose optional tab_id?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, optional tab_id on all action tools (Recommended) | Schema adds tab_id?: number to ~30+ action tools. Auto-resolve when omitted; gate enforces when present. | YES |
| Optional tab_id only on highest-risk actions | Add only to navigate, click, type_text, press_key, execute_js. Inconsistent surface. | |
| Don't expose tab_id on action tools | Auto-resolve only; never accept tab_id at MCP layer. Forces sequential single-tab automation. | |

**User's choice:** Yes, optional tab_id on all action tools (Recommended)
**Notes:** Consistent contract; single Zod-schema-bridge mechanic.

### Q3: Should the legacy:* prefix branch apply to actions identically?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, same legacy:* branch in resolver (Recommended) | One helper for read/visual/action; legacy:* falls through to _getActiveTab regardless of tool family. | YES |
| Legacy autopilot binds active tab | Autopilot bindTabs to legacy:autopilot at session start; popup/sidepanel still use _getActiveTab. Inconsistent. | |
| Per-surface custom resolver | Different helpers per legacy surface. Maximum complexity. | |

**User's choice:** Yes, same legacy:* branch in resolver (Recommended)
**Notes:** One branch, one rule.

### Q4: Should resolver feed resolved tabId back into params before dispatch?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, resolver feeds resolved tabId to gate (Recommended) | After resolveAgentTabOrError, _handleExecuteAction sets params.tabId = resolvedTabId. Phase 240 gate enforces. | YES |
| Keep gate skipping tab arm; trust resolver | Resolver picks tab; gate skips tab arm. Two layers of trust; worse defense-in-depth. | |
| Gate stays as-is, resolver only fills _getActiveTab fallback | Resolver replaces _getActiveTab but doesn't push tabId. Same correctness; loses observability. | |

**User's choice:** Yes, resolver feeds resolved tabId to gate (Recommended)
**Notes:** Closes Phase 240's tab-arm-skip gap permanently for action tools.

---

## Final check

### Q: Anything else feel unclear before writing CONTEXT.md?

| Option | Description | Selected |
|--------|-------------|----------|
| I'm ready for context | Decisions captured are sufficient. Generate CONTEXT.md. | YES |
| Explore more gray areas | Resolver location, error code names, MCP schema rollout, test surface, ws-client.js audit. | |

**User's choice:** I'm ready for context

---

## Claude's Discretion

(Captured in CONTEXT.md `<decisions>` section; planner may decide:)
- Resolver location (new file `extension/utils/agent-tab-resolver.js` recommended)
- Exact error envelope shape (plain object recommended for parity with Phase 240)
- Test fixture naming
- MCP schema bump strategy (single diff recommended)
- Whether to retire `_getActiveTab` entirely
- `chrome.tabs.update({active:...})` default in `handleSwitchTabRoute` (stays foreground; switch_tab is the legitimate "bring to front" tool)
- Whether legacy:popup/sidepanel need bindTab on every dispatch or if resolver legacy-branch return is sufficient (resolver returns `{ tabId, skipGate: true }` recommended)

## Deferred Ideas

(Captured in CONTEXT.md `<deferred>` section; not in scope for Phase 246:)
- Audit of `chrome.tabs.*({active:...})` outside MCP-routed paths (popup/sidepanel/options/ws-client.js, ~10 sites in background.js)
- Required (not optional) tab_id on action tools
- MCP server-side preflight registry mirror
- Per-agent dashboard preview pane multi-stream UI
- Removing `_getActiveTab` entirely (recommended but deferred to planner)
- `forward` MCP tool companion to `back`
