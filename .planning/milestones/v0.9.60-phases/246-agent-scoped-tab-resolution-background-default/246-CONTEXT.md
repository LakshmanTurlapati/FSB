# Phase 246: Agent-Scoped Tab Resolution + Background-Default open_tab - Context

**Gathered:** 2026-05-06
**Status:** Ready for planning
**Source:** Interactive discuss-phase (all 4 gray areas explored, all recommendations accepted)

<domain>
## Phase Boundary

Replace `chrome.tabs.query({active:true})` with agent-registry-driven tab resolution across read tools, visual-session, and action tools, default `open_tab` to background, and ensure MCP-routed surfaces never steal focus from the user or other agents. Closes the multi-agent concurrency gap surfaced in the v0.9.60 smoke test where read/action calls and visual-session attached to the user's foreground tab regardless of which agent owned it.

The phase introduces ONE helper -- `resolveAgentTabOrError(agentId, params, client)` -- consumed by read, visual-session, and action tool paths in `mcp-bridge-client.js` and `mcp-tool-dispatcher.js`. Registry lookup drives MCP agent paths; a single explicit branch on `legacy:*` agentId prefixes preserves popup/sidepanel/autopilot UX byte-for-byte. The resolved tabId is folded back into dispatch params so Phase 240's ownership gate enforces `(agentId, tabId, ownership_token)` on every non-creating tool call -- closing today's tab-arm-skip gap.

Out of scope (later phases or backlog):
- Audit of `chrome.tabs.update({active:true})` / `chrome.tabs.query({active:true})` call sites OUTSIDE the MCP-routed paths (popup/sidepanel/options/ws-client.js stay untouched -- they have legitimate user-driven focus needs).
- Multi-tab live-preview UI in dashboard.
- Persistent agent identity across browser restart (still `chrome.storage.session`).

</domain>

<decisions>
## Implementation Decisions

### Read tool resolution

- **D-01: Auto-resolve via registry.** When an MCP agent calls a read tool (`read_page`, `get_dom_snapshot`, `get_text`, `get_attribute`, `read_sheet`, `get_page_snapshot`) WITHOUT an explicit `tab_id`, the extension calls `registry.getAgentTabs(agentId)`:
  - exactly 1 owned tab -> use it
  - 0 owned tabs -> typed error `NO_OWNED_TAB { agentId }` ("agent must `open_tab` or have a tab bound first")
  - 2+ owned tabs -> typed error `AMBIGUOUS_TAB { agentId, tabIds }` ("agent owns multiple tabs; pass `tab_id` to disambiguate")
- **D-02: Optional `tab_id` on read tool MCP schemas.** Add `tab_id?: number` to read_page, get_dom_snapshot, get_text, get_attribute, read_sheet, get_page_snapshot. When omitted, extension auto-resolves per D-01. When provided, Phase 240's existing dispatch gate enforces ownership via `_resolveTabIdForGate`.
- **D-03: Resolution happens extension-side.** MCP server threads `agentId` (and optional `tabId`) through the bridge payload. Extension's `mcp-bridge-client.js` / `mcp-tool-dispatcher.js` reads the registry. Single new helper: `resolveAgentTabOrError(agentId, params, client)` returning `{ tabId, ownershipToken } | { error: { code, ... } }`. Registry is extension-owned; MCP server has no view into it. Matches Phase 237/240 split.
- **D-04: Legacy:* agentId prefix branch.** First line of `resolveAgentTabOrError`: `if (typeof agentId === 'string' && agentId.startsWith('legacy:')) return { tab: await client._getActiveTab() };`. Else use registry. One branch, one rule, audit-friendly. Preserves popup/sidepanel/autopilot UX.

### open_tab default

- **D-05: open_tab defaults to background.** `chrome.tabs.create({ url, active: params.active === true })`. Caller MUST pass `active: true` explicitly to steal focus. Aligns with smoke-test memo's "no focus-stealing on action tools".
- **D-06: MCP schema for `active` is optional with documented default.** Schema: `active?: boolean (default false)`. Description includes "Multi-agent default is FALSE (background) so this agent does not steal focus from the user or another agent. Set true ONLY when the new tab needs immediate user visibility." Lets LLM-driven agents make informed choices.
- **D-07: Audit scope is MCP-routed paths only.** Fix call sites reachable via MCP tool dispatch: `extension/ws/mcp-bridge-client.js`, `extension/ws/mcp-tool-dispatcher.js`, `extension/utils/mcp-visual-session.js`, and any `background.js` handlers triggered by MCP tools. Leave `popup.js`, `sidepanel.js`, `options.js`, `ws-client.js` untouched -- they have legitimate user-driven focus needs (the user IS on the active tab there).
- **D-08: Phase 240 D-08 bind+ownership_token contract preserved.** open_tab still calls `bindTab(agentId, tab.id)` on success and returns `ownershipToken` in the response. Only the `active` default flips. The test surface for `bindTab + ownershipToken` from Phase 240 stays valid byte-for-byte.

### Visual session resolution

- **D-09: Same registry-driven resolver as read tools.** `handleStartVisualSessionRoute` and any callers in `mcp-bridge-client.js` switch from `getActiveTabFromClient(client)` to `resolveAgentTabOrError(agentId, payload, client)`. Same 3-branch behavior: 1 owned -> use, 0 -> NO_OWNED_TAB, 2+ -> AMBIGUOUS_TAB. Single mental model across all read-shaped surfaces.
- **D-10: Optional `tab_id` on `start_visual_session`.** Schema adds `tab_id?: number`. Description: "Tab the visual session attaches to. Omit when this agent owns exactly one tab; required when this agent owns multiple." Consistent with read tool schema change. The dispatch gate (Phase 240) enforces ownership when `tab_id` is provided; the resolver handles the auto path.
- **D-11: Phase 240 D-03 same-agent resume contract preserved.** When `resolveAgentTabOrError` returns a tabId that already has an active visual session for the same agentId, `mcp-visual-session.js:startSession` runs the existing resume code path (D-03). No new logic in mcp-visual-session.js; the resolver just feeds the right tabId. Cross-agent re-entry still rejects with `tab_owned_by_other_agent` (already implemented in Phase 240).
- **D-12: Shared error code surface.** `NO_OWNED_TAB` and `AMBIGUOUS_TAB` are defined ONCE (in `extension/ws/mcp-tool-dispatcher.js` or a small `errors.js` helper) and shared across read tool, visual-session, and action paths. Visual-session-specific codes (`invalid_client_label`, `visual_surface_busy`, `restricted_active_tab`) keep their existing names. The legacy `no_active_tab` code stays for the legacy:* path (which uses `_getActiveTab`); the new codes only fire on the registry path.

### Action tools (~30+ tools)

- **D-13: Action tools use the same resolver.** `_handleExecuteAction` in `mcp-bridge-client.js` calls `resolveAgentTabOrError(agentId, payload, client)` instead of `_getActiveTab()`. Same 3-branch behavior. Applies to every content-routed and CDP-routed action tool dispatched through this entry point: click, type_text, click_at, double_click, right_click, hover, focus, scroll variants, press_key, press_enter, drag variants, fill_credential (via `_handleFillCredential` -- same pattern), use_payment_method (same), select_option, check_box, set_attribute, select_text_range, drop_file, etc.
- **D-14: Optional `tab_id` on all action tool MCP schemas.** Every action tool's MCP schema adds `tab_id?: number`. The TOOL_REGISTRY in `extension/ai/tool-definitions.js` is the single source of truth; bumping the inputSchema there propagates to MCP via `mcp/src/tools/manual.ts` (and the schema-bridge layer that converts JSON Schema to Zod). Tool descriptions get a "Multi-agent: pass tab_id when this agent owns multiple tabs" line, mirroring the existing "Multi-agent: agent-scoped tabs..." copy.
- **D-15: Single legacy:* branch covers all tool families.** `resolveAgentTabOrError` is the one helper for read, visual, AND action paths. The `legacy:*` prefix branch on its first line handles popup/sidepanel/autopilot uniformly regardless of the tool family that called it. No special-casing per tool family; one rule.
- **D-16: Resolver feeds resolved tabId back into params before dispatch.** After `resolveAgentTabOrError` returns the tabId (whether registry-resolved or legacy-resolved), `_handleExecuteAction` (and the read tool / visual-session paths) sets `routeParams.tabId = resolvedTabId` before calling `dispatchMcpToolRoute`. Phase 240's `checkOwnershipGate` -> `_resolveTabIdForGate` then sees the tabId in params and enforces `(agentId, tabId, ownership_token)` ownership for non-legacy agents. For legacy:* agents, the gate's `hasAgent` check passes (synthesized agentIds are registered), and the tab arm enforces ownership against the legacy agent's bindings (autopilot already binds; popup/sidepanel synthesize and bind on first dispatch -- planner confirms exact mechanism). This closes Phase 240's tab-arm-skip gap permanently for ALL non-creating tool calls.

### Claude's Discretion

The planner decides:
- **Resolver location:** new file `extension/utils/agent-tab-resolver.js` vs inline in `mcp-bridge-client.js` vs co-located in `agent-registry.js`. Recommend `extension/utils/agent-tab-resolver.js` for testability (`tests/agent-tab-resolver.test.js`); the helper is small (~30 lines) and reused across 40+ call sites.
- **Exact error envelope shape:** plain-object `{ success: false, code: 'NO_OWNED_TAB', agentId }` vs `FsbResolverError` class. Recommend plain object for parity with Phase 240's existing error shapes.
- **Test fixture naming:** `tests/agent-tab-resolver.test.js` for the helper; `tests/read-tool-tab-resolution.test.js` for read tool integration; `tests/visual-session-agent-scoped.test.js` for visual session; `tests/action-tool-agent-scoped.test.js` for action tools; or merged into one large `tests/agent-scoped-tab-resolution.test.js`.
- **MCP schema bump strategy:** add `tab_id` to all 30+ action tools in one large diff vs split by tool category (navigation/interaction/scroll/CDP). Recommend single diff in tool-definitions.js -- the Zod-bridge auto-derivation means there's no per-tool wiring to do beyond schema declaration.
- **Whether to retire `_getActiveTab` entirely:** the helper has 5+ call sites in `mcp-bridge-client.js`. Once the resolver replaces all of them, `_getActiveTab` may have no remaining callers. Recommend deleting it once all callers migrate; mention in plan's deletions section.
- **`active` default for `chrome.tabs.update({active:...})` in `handleSwitchTabRoute`:** today switches to active when `_forceForeground` is true (Phase 243). Switch_tab is the legitimate "bring to front" tool; default stays foreground. Confirm in planning that this is preserved.
- **Whether `legacy:popup` / `legacy:sidepanel` actually need to bindTab to the active tab on every dispatch (so the gate enforces ownership) or if the resolver's legacy-branch return is sufficient:** decided in D-04/D-15 that the resolver branch returns the active tab directly without going through the gate. The gate's `hasAgent(legacy:popup)` check still passes (synthesized agentIds are registered). For action tools where the resolver feeds tabId back to params, the legacy gate path needs careful planning -- the planner verifies legacy:* surfaces don't trip TAB_NOT_OWNED on the user's active tab when popup/sidepanel haven't bound it. Recommended approach: legacy:* surfaces continue to NOT push tabId into routeParams (gate skips tab arm) while MCP agents DO push tabId (gate enforces). The resolver returns `{ tabId, skipGate: true }` for legacy paths.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 246 contract sources

- `.planning/STATE.md` (Phase 246 origin note: "agent-scoped-tab-resolution-background-default -- closes multi-agent concurrency gap surfaced in v0.9.60 smoke test; read tools and visual-session must thread agentId and resolve target tab via registry, not chrome.tabs.query({active:true}); open_tab default to background; no focus-stealing on action tools.")
- `.planning/REQUIREMENTS.md` (v0.9.60 OWN-01..05, AGENT-01..04 -- this phase tightens enforcement against those requirements; no new REQ-IDs introduced; this is gap-closure on existing v0.9.60 requirements after smoke-test feedback)
- `.planning/ROADMAP.md` Phase 246 entry (currently TBD goal -- this CONTEXT defines it)

### Existing call sites this phase modifies

- `extension/ws/mcp-bridge-client.js:486 _getActiveTab` -- the helper to retire (5+ call sites at lines 524, 537, 565, 1196, 1248)
- `extension/ws/mcp-bridge-client.js:520 _handleGetDOM` -- read tool entry, switches to resolver
- `extension/ws/mcp-bridge-client.js:533 _handleReadPage` -- read tool entry, switches to resolver
- `extension/ws/mcp-bridge-client.js:564 _handleExecuteAction` -- action tool dispatch entry; resolver replaces _getActiveTab and resolved tabId pushed to routeParams (D-16)
- `extension/ws/mcp-bridge-client.js:1195 _handleFillCredential` -- credential fill, switches to resolver
- `extension/ws/mcp-bridge-client.js:1248 _handleUsePaymentMethod` -- payment use, switches to resolver
- `extension/ws/mcp-tool-dispatcher.js:312 getActiveTabFromClient` -- helper used by visual-session and restricted-tab response paths
- `extension/ws/mcp-tool-dispatcher.js:912 handleOpenTabRoute:917` -- `chrome.tabs.create({ ..., active: params.active !== false })` flips to `active: params.active === true` (D-05)
- `extension/ws/mcp-tool-dispatcher.js:1175 handleStartVisualSessionRoute:1195` -- `getActiveTabFromClient(client)` switches to `resolveAgentTabOrError`
- `extension/ws/mcp-tool-dispatcher.js:161 _resolveTabIdForGate` and `178 checkOwnershipGate` -- D-16 makes these load-bearing for action tools (resolver pushes tabId so the gate's tab arm fires)

### Schema sources

- `extension/ai/tool-definitions.js` -- TOOL_REGISTRY (~51 tools); D-02/D-10/D-14 add `tab_id?: number` to read tools, start_visual_session, and action tools' inputSchema
- `mcp/src/tools/read-only.ts` -- read-only tools' MCP registration; D-02 schema bump propagates via `jsonSchemaToZod` in `schema-bridge.ts`. Note line 90-92: "Phase 238 D-06: scope discipline -- read-only is signature-parity only; no agent identity injection here per CONTEXT.md." Phase 246 OVERTURNS this for read-only tools (we now thread agentId AND optional tab_id)
- `mcp/src/tools/manual.ts` -- action tools' MCP registration; agentId already threaded (line 52-69); D-14 adds tab_id to per-tool params
- `mcp/src/tools/visual-session.ts` -- visual session MCP tool; D-10 adds tab_id; agentId already threaded (line 58-82)
- `mcp/src/tools/schema-bridge.ts` -- TOOL_REGISTRY -> Zod conversion; should pick up new tab_id fields automatically once tool-definitions.js declares them

### Pattern parity references

- `.planning/phases/237-agent-registry-foundation/237-CONTEXT.md` -- registry API; this phase consumes `registry.getAgentTabs(agentId)`
- `.planning/phases/240-tab-ownership-enforcement-on-dispatch/240-CONTEXT.md` -- D-02 (legacy:* synthesis), D-03 (visual-session same-agent resume), D-04 (ownership_token), D-08 (bindTab on tab-creating handlers), D-06/D-07 (single chokepoint, no-await rule). D-16 of this phase makes Phase 240's tab-arm-skip path load-bearing.
- `.planning/phases/243-background-tab-audit-ui-badge-integration/243-CONTEXT.md` -- D-01 (`_forceForeground` flag pattern); this phase doesn't introduce new flags, but the open_tab default change is in the same spirit.
- `.planning/phases/245-post-action-change-report/245-CONTEXT.md` -- D-05 (`_emitChangeReport` flag); resolver runs upstream of the change-report wrap so it sees the resolved tabId for the harvest.

### Codebase architecture

- `.planning/codebase/ARCHITECTURE.md` -- bridge architecture between MCP server and extension SW
- `.planning/codebase/CONVENTIONS.md` -- node:test plain-assert harness; FSB's plain-object error pattern; importScripts ordering in background.js

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`globalThis.fsbAgentRegistryInstance.getAgentTabs(agentId)`** (Phase 237; line 1023 in `extension/utils/agent-registry.js`) returns the array of tabs an agent owns. Sync, plain-object return -- exactly what the resolver needs for the no-await dispatch discipline (Phase 240 D-07).
- **`registry.getOwner(tabId)`, `registry.isOwnedBy(tabId, agentId, ownership_token)`, `registry.getTabMetadata(tabId)`** -- all sync; the resolver may use them for follow-up validation when `tab_id` is explicitly provided.
- **`_getActiveTab()` itself** (extension/ws/mcp-bridge-client.js:486) -- the resolver's legacy:* branch calls it. Don't delete the helper until the resolver migration completes; consider keeping it as a private detail of the resolver after.
- **15-handler destructure pattern from Phase 238** -- already extracts `agentId` and `ownershipToken` from payload; resolver consumes the same destructure.
- **Phase 245's `wrapWithChangeReport`** (line 600 in mcp-bridge-client.js) wraps action tools after tab resolution. The resolver runs UPSTREAM, so the harvest sees the right tabId without modification.

### Established Patterns

- **Plain-object error returns** (Phase 240 D-01 path): `{ success: false, code: 'NAME', ... }`. Resolver follows this shape.
- **Single chokepoint discipline** (Phase 240 D-06): the dispatch gate is the one place ownership is checked. The resolver runs BEFORE the gate; it doesn't replace the gate. Resolver: "which tab does this agent want?" Gate: "is this agent allowed to touch that tab?"
- **Sync registry reads** (Phase 240 D-07): `registry.getAgentTabs` is sync; the resolver stays sync up to the legacy:* `_getActiveTab` await (the only async branch).
- **MCP schema -> Zod auto-derivation** (`mcp/src/tools/schema-bridge.ts`): adding `tab_id` to a tool's `inputSchema` in `tool-definitions.js` propagates to the MCP layer without per-tool wiring.

### Integration Points

- **Resolver (new file `extension/utils/agent-tab-resolver.js`):** consumed by 3 entry points -- read tool handlers (`_handleGetDOM`, `_handleReadPage`), visual-session (`handleStartVisualSessionRoute`), action tool dispatch (`_handleExecuteAction`).
- **TOOL_REGISTRY (`extension/ai/tool-definitions.js`):** schema bump for ~37 tools (6 read + 1 visual + ~30 action). Single diff; auto-propagates to MCP via schema-bridge.
- **Phase 240 dispatch gate (`checkOwnershipGate` in mcp-tool-dispatcher.js:178):** D-16 makes the gate's `_resolveTabIdForGate` path load-bearing for non-legacy MCP agents. Resolver pushes resolved tabId into `routeParams` before `dispatchMcpToolRoute`.
- **mcp-visual-session.js startSession (line 90):** `tabId` already required; resolver feeds it. Phase 240 D-03 same-agent resume code path stays.
- **MCP server-side (mcp/src/tools/{read-only,manual,visual-session}.ts):** read-only.ts D-06 scope discipline (line 90) gets overturned -- agentId AND optional tab_id are now threaded through. manual.ts and visual-session.ts already thread agentId; just add optional tab_id forwarding.

</code_context>

<specifics>
## Specific Ideas

- **Single resolver, three call families.** "One mental model" was an explicit user signal: read, visual, action all flow through the same `resolveAgentTabOrError` helper with the same legacy:* branch and the same error contract.
- **Defense-in-depth via Phase 240 gate.** D-16's "resolver feeds tabId to gate" was chosen specifically because it gives two independent layers of correctness: resolver picks the tab, gate enforces ownership. If either has a bug, the other catches it.
- **MCP-routed audit only.** User explicitly accepted "leave popup/sidepanel/options/ws-client.js untouched". They are user-driven surfaces with legitimate active-tab semantics. Don't expand scope.
- **Optional, not required, tab_id.** Single-tab-agent ergonomics matter: the LLM should not have to remember tab_id for every call when there's only one. Multi-tab agents pay the explicit-tab_id cost only when they're actually multi-tab.
- **Smoke-test memo is the canonical motivation.** The phase exists because v0.9.60 smoke tests caught real-world tab-resolution bugs in multi-agent scenarios. Every decision traces back to one of three smoke-test failures: (a) agent A's read_page hit agent B's tab; (b) agent's visual session attached to user's active tab not its own; (c) open_tab stole user focus mid-task.

</specifics>

<deferred>
## Deferred Ideas

- **Audit of `chrome.tabs.update({active:true})` and `chrome.tabs.query({active:true})` outside MCP-routed paths** -- explicitly out of scope per D-07. background.js has 5 sites (lines 2971, 3485, 11502, 12572, 12625), ws-client.js has 4-5 sites, popup/sidepanel/options use them legitimately. Future hardening phase if real-world testing surfaces issues.
- **Required (not optional) tab_id on action tools** -- considered and rejected. Single-tab-agent ergonomics win. Reconsider only if multi-tab adoption proves the optional path bug-prone.
- **MCP server-side preflight registry mirror** -- considered and rejected (D-03). Adds round-trips and creates a second source of truth for agent->tab mapping. Reconsider only if extension-side resolution proves a latency bottleneck (unlikely; sync registry reads).
- **Per-agent dashboard preview pane multi-stream UI** -- carry-forward from v0.9.60 deferred list (REQUIREMENTS.md "Future Requirements"). Multi-tab visibility on the dashboard side is a separate concern from extension-side resolution.
- **Removing `_getActiveTab` entirely from `mcp-bridge-client.js`** -- recommended in Claude's Discretion but deferred to planning. Once all 5 callers migrate to the resolver, the helper has no users. Plan can include the deletion or keep it as a private detail of the resolver.
- **`forward` MCP tool companion to `back`** -- carry-forward from v0.9.60 REQUIREMENTS Future Requirements list; not affected by this phase.

</deferred>

---

*Phase: 246-agent-scoped-tab-resolution-background-default*
*Context gathered: 2026-05-06 via interactive discuss-phase (4/4 areas, all recommendations accepted)*
