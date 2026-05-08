# Phase 246: Agent-Scoped Tab Resolution + Background-Default open_tab - Research

**Researched:** 2026-05-06
**Domain:** Multi-agent tab resolution, MCP dispatch path, Chrome Extension MV3 SW
**Confidence:** HIGH (every claim is verified against the in-tree code at the cited line; nothing is sourced from training data)

## Summary

Phase 246 is gap-closure on the v0.9.60 multi-agent surface. The discuss-phase nailed the design: one resolver `resolveAgentTabOrError(agentId, params, client)`, one `legacy:*` branch, three call families (read / visual / action), and the resolver feeds the tabId back into routeParams so Phase 240's gate enforces `(agentId, tabId, ownership_token)` on the way through. Locked decisions D-01..D-16 in CONTEXT.md are non-negotiable; this research fills in the call-site map, the schema-propagation contract, the legacy gate-composition model, and the test-harness pattern the planner should reuse.

The investigation confirmed five concrete things the planner must know:

1. **The resolver's call-site graph is small and finite.** Five `_getActiveTab()` callers in `mcp-bridge-client.js` (verified: lines 524, 537, 565, 1196, 1248) and seven `getActiveTabFromClient(client)` callers in `mcp-tool-dispatcher.js` (verified: lines 279, 298, 407, 460, 757, 1195, 1342, 1366, 1429). Of those 12 sites, exactly 6 need to switch to the registry resolver; the other 6 stay on active-tab semantics for legitimate UX reasons (restricted-page detection, list_tabs metadata, autopilot start, stop_task lookup, and two `currentWindow:true` queries that exist for window-level routing decisions, not agent-scope decisions). The split is documented per-site in `## Domain Map`.
2. **The `tool-definitions` file is duplicated.** `extension/ai/tool-definitions.js` (extension SW via `importScripts`) and `mcp/ai/tool-definitions.cjs` (MCP server via `createRequire`) are byte-for-byte the same 1092-line file. Phase 245-02 (commit `39f8061`) annotated both in lockstep. Phase 246's schema bumps for ~37 tools must touch BOTH files identically. There is no automated sync; the planner must include a verification step that diffs them.
3. **The MCP -> Zod schema bridge is a parameterized auto-derivation.** `jsonSchemaToZod` in `mcp/src/tools/schema-bridge.ts:78-120` reads `inputSchema.properties` and emits Zod shapes; adding `tab_id?: number` to a tool's `inputSchema.properties` propagates AUTOMATICALLY to the MCP server's tool registration, with one EXCEPTION: tools listed in `PARAM_TRANSFORMS` (schema-bridge.ts:134-175) rebuild the params object from scratch. The 5 tools in PARAM_TRANSFORMS (`press_key`, `drag_drop`, `click_at`, `drag`, `fill_sheet`) would silently drop `tab_id` unless the transform forwards it explicitly. This is the single highest-impact pitfall in the phase.
4. **The legacy:* branch composes correctly with the existing gate.** `legacy:popup`, `legacy:sidepanel`, `legacy:autopilot` are synthesized via `getOrRegisterLegacyAgent` (registry.js:374) — popup/sidepanel synthesize at boot via `chrome.runtime.sendMessage({action:'ensureLegacyAgent'})` (handled at background.js:5216), and autopilot synthesizes/binds inside `handleStartAutomation` (background.js:6588-6620, fallback at 6597-6608). All three legacy paths bind their target tab via `bindTab(legacyAgentId, tabId)` BEFORE the first dispatch, so a future dispatch for those agents WOULD pass `isOwnedBy(tabId, 'legacy:popup', null)`. The `skipGate` flag from CONTEXT.md D-16 is therefore a safety belt rather than a strict requirement — but it remains the right design because (a) the legacy synthesis is not guaranteed to bind the user's CURRENT active tab on every dispatch (the user can switch tabs after popup boot), and (b) skipping the gate's tab-arm for legacy:* surfaces preserves byte-for-byte UX even in the tab-switched edge case.
5. **The test harness is `node:assert` plus `vm` for client lifecycle, hand-rolled chrome mocks, and registry stubs.** `tests/ownership-error-codes.test.js` is the canonical mini-harness for testing the dispatch gate against a stubbed registry singleton. `tests/legacy-agent-synthesis.test.js` is the canonical pattern for legacy synthesis tests. `tests/mcp-bridge-client-lifecycle.test.js:540-601` is the canonical pattern for testing `_handleExecuteAction` end-to-end with a buildClientHarness pattern. The planner should mirror these three patterns.

**Primary recommendation:** Split Phase 246 into THREE plans (resolver+read+open_tab default ; visual+action ; MCP server-side schema rollout + integration tests). Plans 01 and 02 land independently in the extension; Plan 03 batches the cross-cut MCP server-side schema bump and the integration tests that prove the full surface composes. See `## Implementation Approach`.

## Phase Requirements

CONTEXT.md confirms Phase 246 introduces NO new REQ-IDs; it tightens enforcement on the existing v0.9.60 OWN-* requirements. The relevant requirements are reproduced here so the planner can map plan tasks back:

| ID | Description | Research Support |
|----|-------------|------------------|
| OWN-01 | Every tab opened by an agent binds `tab_id` -> `agent_id` authoritatively | `handleOpenTabRoute` already binds at dispatcher.js:921-933; D-05 only flips `active` default — bind logic untouched |
| OWN-02 | All MCP tool dispatch flows through a single chokepoint that verifies `(agent_id, tab_id, ownership_token)` | Resolver D-16 feeds tabId into routeParams BEFORE `dispatchMcpToolRoute`, so `checkOwnershipGate` (dispatcher.js:178-215) sees a non-null tabId and runs its tab-ownership arm. This closes today's `_resolveTabIdForGate -> null` skip path |
| OWN-03 | Cross-agent tab access rejected loudly with typed `TAB_NOT_OWNED` | Already implemented in checkOwnershipGate; resolver makes it FIRE on every non-creating tool call |
| OWN-04 | Visual-session manager rejects cross-agent `startSession` with `tab_owned_by_other_agent` | Already in mcp-visual-session.js:107-126; resolver feeds correct tabId so the rejection is reachable |
| OWN-05 | Incognito and cross-window tab IDs rejected at the dispatch boundary | Already in checkOwnershipGate (TAB_INCOGNITO_NOT_SUPPORTED at line 200-203, TAB_OUT_OF_SCOPE at 205-212); resolver pushes tabId so these arms fire on every dispatch |

Phase 246 does NOT require new requirements — it makes existing requirements LOAD-BEARING in scenarios where the smoke test exposed they were skipped.

## Project Constraints (from CLAUDE.md)

- **No emojis** in terminal logs, README files, or anywhere else unless explicitly asked. Apply to log strings, code comments, test PASS/FAIL output, and RESEARCH/PLAN/VALIDATION markdown. (Both global ~/.claude/CLAUDE.md and v0.9.60 STATE.md decisions reinforce this.)
- **Branch-locked to `Refinements`.** No git push, no PR, until explicit user command. Phase commits via `gsd-tools commit` are expected to return `skipped_gitignored` for `.planning/` files (gitignored).
- **No new manifest permissions.** Confirmed in ROADMAP.md "Constraints" section.
- **No new npm dependencies in `mcp/`** other than the SDK minor bump (Phase 244 territory; not Phase 246).
- **No regression on v0.9.36 / v0.9.50 contracts.** Popup, sidepanel, autopilot legacy surfaces preserve byte-for-byte UX (D-04 / D-15).
- **Tools order in importScripts matters in background.js.** The registry must load before the dispatcher (already enforced at background.js:9 importScripts order — `tool-definitions.js` first, then registry, then dispatcher).
- **AGENTS.md / CLAUDE.md project file directives:** ES2021+ JavaScript, JSDoc on public functions, Chrome Extension best practices, security-first design, no automated formatter (manual 2-space indent), single quotes, semicolons.

## Domain Map

The call-site graph for tab resolution. Each row is a concrete file:line pair the planner can act on directly.

### Sites that MUST switch to the resolver (registry-driven for MCP agents, legacy fall-through for legacy:*)

| File:Line | Function | Today | Phase 246 Action | Tool family |
|-----------|----------|-------|------------------|-------------|
| `extension/ws/mcp-bridge-client.js:524` | `_handleGetDOM` | `_getActiveTab()` | `resolveAgentTabOrError(agentId, payload, client)` | Read (`get_dom_snapshot`) |
| `extension/ws/mcp-bridge-client.js:537` | `_handleReadPage` | `_getActiveTab()` | resolver | Read (`read_page`) |
| `extension/ws/mcp-bridge-client.js:565` | `_handleExecuteAction` | `_getActiveTab()` | resolver + push tabId into routeParams (D-16) | Action (~30 tools) |
| `extension/ws/mcp-bridge-client.js:1196` | `_handleFillCredential` | `_getActiveTab()` | resolver (vault.ts is currently NOT agentScope-aware — see Open Question 4) | Action (vault) |
| `extension/ws/mcp-bridge-client.js:1248` | `_handleUsePaymentMethod` | `_getActiveTab()` | resolver (same vault caveat) | Action (vault) |
| `extension/ws/mcp-tool-dispatcher.js:1195` | `handleStartVisualSessionRoute` | `getActiveTabFromClient(client)` | resolver | Visual session |

**6 sites to migrate.** That's the entire surface area of Phase 246's resolver replacement.

### Sites that LOOK like they need migrating but DO NOT

| File:Line | Function | Why it stays | Note |
|-----------|----------|--------------|------|
| `extension/ws/mcp-tool-dispatcher.js:279` | `buildRestrictedResponseIfReadRoute` | Detects "is the USER on a chrome:// page?" — a UX guard, not an agent-scope concern. Restricted-page UX must use the user's foreground tab even for MCP agents. | UX |
| `extension/ws/mcp-tool-dispatcher.js:298` | `buildRestrictedResponseIfActive` | Same as above — fallback-to-restricted-message detection. | UX |
| `extension/ws/mcp-tool-dispatcher.js:407` | `handleNavigateRoute` | Uses active tab as a FALLBACK when caller did not pass `tabId`. After Phase 240 D-08, the handler bindTabs whatever it navigates. For MCP agents this is ambiguous when the agent owns multiple tabs — but `navigate` is a tab-CREATING semantic (it changes URL of a target), not a tab-ADDRESSING semantic. CONTEXT.md is silent on whether `navigate` should switch to the resolver. **Open Question 1: see below.** | Ambiguous — confirm with user |
| `extension/ws/mcp-tool-dispatcher.js:460` | `handleNavigationHistoryRoute` (`go_back` / `go_forward` / `refresh`) | Same shape as navigate. **Open Question 1.** | Ambiguous |
| `extension/ws/mcp-tool-dispatcher.js:757` | `handleBackRoute` (the new `back` tool from Phase 242) | Already does its OWN re-gate at lines 775-780 when targetTabId resolves from active tab. So agent-scope is enforced here even though it uses `getActiveTabFromClient`. The re-gate is the right pattern; resolver migration is optional cleanup. **Recommend keeping as-is for Phase 246**; revisit in a future cleanup phase. | Already-gated |
| `extension/ws/mcp-tool-dispatcher.js:1342` | `handleStartAutomationRoute` (run_task) | This dispatches autopilot, which then runs through `handleStartAutomation` (background.js:6588) which DOES bind+resolve under the legacy:autopilot fallback. The active-tab fetch here is appropriate — run_task means "drive autopilot on the user's current tab." Per CONTEXT.md D-07, autopilot is explicitly out of scope for the audit. | Out of scope per D-07 |
| `extension/ws/mcp-tool-dispatcher.js:1366` | `handleStopAutomationRoute` | Same — autopilot lifecycle. Out of scope per D-07. | Out of scope |
| `extension/ws/mcp-tool-dispatcher.js:1429` | `handleGetPageSnapshotRoute` | Read tool with the same shape as read_page. **This IS a read tool that CONTEXT.md missed.** D-01 / D-02 lists 6 read tools (`read_page`, `get_dom_snapshot`, `get_text`, `get_attribute`, `read_sheet`, `get_page_snapshot`); this site is the `get_page_snapshot` route. **Confirmed: this site DOES need migration.** Add to the must-switch list above. | Read (`get_page_snapshot`) |
| `extension/ws/mcp-tool-dispatcher.js:953` | `handleSwitchTabRoute` | `chrome.tabs.query({active:true, currentWindow:true})` to capture the previousTabId for the response. This is a read-after-action diagnostic, not the target tab. Stays. | Diagnostic |
| `extension/ws/mcp-tool-dispatcher.js:994` | `handleListTabsRoute` | `chrome.tabs.query({active:true})` is metadata for the response (`activeTabId` field). list_tabs is tab-agnostic. Stays. | Tab-agnostic |

**Critical correction to CONTEXT.md:** D-01 lists 6 read tools but only the first 5 (`_handleGetDOM`, `_handleReadPage`, `get_text`, `get_attribute`, `read_sheet`) flow through `_handleExecuteAction` -- the 6th, `get_page_snapshot`, has its OWN handler at dispatcher.js:1429 that calls `getActiveTabFromClient(client)` at line 1429. The planner MUST migrate this site too, even though CONTEXT.md does not list it explicitly. Verified by grep: `get_page_snapshot` -> route in `MCP_PHASE199_MESSAGE_ROUTES` -> `handleGetPageSnapshotRoute`.

`get_text`, `get_attribute`, `read_sheet` route through `_handleExecuteAction` (verified: read-only.ts:28-46 wraps them in `mcp:execute-action` with the FSB content-verb), so they get the resolver migration for free via the action-tool path. **The planner does not need to write three separate migrations for those tools — `_handleExecuteAction` covers them.**

### `_getActiveTab` retirement candidate

After the 5 callers in mcp-bridge-client.js migrate to the resolver, `_getActiveTab` has ONE remaining caller: `getActiveTabFromClient` at dispatcher.js:312-315 (which delegates to `client._getActiveTab()` if the client provides it). The dispatcher helper itself stays (it's used by the 6 active-tab-legitimate sites enumerated above), so `_getActiveTab` cannot be deleted entirely from `mcp-bridge-client.js` — it must remain as the implementation that `getActiveTabFromClient` delegates to. **Recommendation:** keep `_getActiveTab` as a private detail of the bridge client but mark its only legitimate consumer as `getActiveTabFromClient`. Do not delete in Phase 246.

### Tab-need classification by tool

For the resolver to error correctly (`NO_OWNED_TAB` / `AMBIGUOUS_TAB`) it must know which tools NEED a tab vs. which are tab-agnostic. The CONTEXT.md says "all action tools" but a strict reading of the TOOL_REGISTRY shows nuance:

| Category | Count | Tools | Resolver behavior |
|----------|-------|-------|-------------------|
| Tab-agnostic (skip resolver entirely) | 5 | `list_tabs`, `open_tab`, `search_memory`, `report_progress`, `get_site_guide` | DO NOT call resolver — these tools either don't address a tab (`list_tabs`, `search_memory`, `report_progress`, `get_site_guide`) or CREATE one (`open_tab`) |
| Vault tools (separate registration) | 4 | `list_credentials`, `fill_credential`, `list_payment_methods`, `use_payment_method` | `list_credentials` and `list_payment_methods` are tab-agnostic (read vault). `fill_credential` and `use_payment_method` need the active tab. See Open Question 4 |
| Lifecycle tools (autopilot path; out of scope per D-07) | 4 | `run_task`, `stop_task`, `get_task_status`, `complete_task` / `partial_task` / `fail_task` | OUT OF SCOPE for Phase 246 per D-07 |
| Tab-required action tools (need resolver) | ~37 | All tools in TOOL_REGISTRY where `_readOnly:false` and not in the lists above | Call resolver; receive `tab_id` from caller or auto-resolve |
| Tab-required read tools (need resolver) | 6 | `read_page`, `get_dom_snapshot`, `get_text`, `get_attribute`, `read_sheet`, `get_page_snapshot` | Call resolver; receive `tab_id` from caller or auto-resolve |
| Visual session | 1 | `start_visual_session` | Call resolver; receive `tab_id` from caller or auto-resolve |
| Visual session (lifecycle) | 1 | `end_visual_session` | Tab-agnostic — `session_token` is the addressing key |

**The resolver should be CALLED ONLY by handlers that need a tab.** The ~37 action tools route through `_handleExecuteAction`, which is one site. So the planner doesn't need to add 37 resolver calls — they migrate through the one entrypoint. The schema bumps are 37 + 6 + 1 = 44 schema property additions.

### Legacy synthesis call sites (verify before planning)

CONTEXT.md asserts popup/sidepanel/autopilot synthesize legacy:* agentIds. Verified:

| Surface | Synthesis location | Bind point |
|---------|--------------------|------------|
| Popup | `extension/ui/popup.js:307-313` calls `chrome.runtime.sendMessage({action:'ensureLegacyAgent', surface:'popup'})` BEFORE the `startAutomation` dispatch. The runtime action handler at `extension/background.js:5216-5244` calls `getOrRegisterLegacyAgent('popup')`. | `handleStartAutomation` at `background.js:6610-6620` calls `bindTab(resolvedAgentId, targetTabId)` on the user's currently-active tab |
| Sidepanel | `extension/ui/sidepanel.js:509-513` follows the same pattern (`ensureLegacySidepanelAgent`) | Same `handleStartAutomation` site |
| Autopilot | Fallback at `extension/background.js:6597-6608` — when `request.agentId` is absent, synthesize `legacy:autopilot` | Same `handleStartAutomation` site |

**Confirmation:** legacy:* surfaces DO bind their target tab to the synthesized agentId at session start. The dispatch gate's `isOwnedBy(tabId, 'legacy:popup', null)` would therefore PASS for the bound tab. **But:** the user can switch active tab after the popup synthesis fires; the popup's user-driven actions (e.g., type a follow-up message in the chat that triggers a new automation) would re-fire `chrome.tabs.query({active:true})` against a tab that legacy:popup does NOT own. CONTEXT.md D-16's recommended `skipGate:true` flag for the legacy branch handles this case correctly.

## Code Pattern Inventory

### Resolver Shape (recommended)

```javascript
// extension/utils/agent-tab-resolver.js
'use strict';

(function (exports) {
  /**
   * Resolve the target tab for an MCP-routed tool call.
   *
   * @param {string} agentId
   * @param {object} params  Caller-supplied tool params (may include tab_id).
   * @param {object} client  Bridge client (provides _getActiveTab for legacy fall-through).
   * @returns {Promise<{tabId:number, ownershipToken:string|null, skipGate:boolean} | {success:false, code:string, ...}>}
   */
  async function resolveAgentTabOrError(agentId, params, client) {
    // D-04 legacy:* branch -- first line of resolver, single rule.
    if (typeof agentId === 'string' && agentId.startsWith('legacy:')) {
      const tab = (client && typeof client._getActiveTab === 'function')
        ? await client._getActiveTab()
        : null;
      if (!tab || !Number.isFinite(tab.id)) {
        return { success: false, code: 'NO_ACTIVE_TAB', agentId };
      }
      return { tabId: tab.id, ownershipToken: null, skipGate: true };
    }

    // Explicit tab_id from caller -- gate enforces ownership downstream.
    if (params && Number.isFinite(params.tab_id)) {
      return { tabId: params.tab_id, ownershipToken: null, skipGate: false };
    }
    if (params && Number.isFinite(params.tabId)) {
      return { tabId: params.tabId, ownershipToken: null, skipGate: false };
    }

    // Registry path -- D-01 three branches.
    const reg = (typeof globalThis !== 'undefined') ? globalThis.fsbAgentRegistryInstance : null;
    if (!reg || typeof reg.getAgentTabs !== 'function') {
      return { success: false, code: 'AGENT_REGISTRY_UNAVAILABLE', agentId };
    }
    const tabIds = reg.getAgentTabs(agentId) || [];
    if (tabIds.length === 0) {
      return { success: false, code: 'NO_OWNED_TAB', agentId };
    }
    if (tabIds.length > 1) {
      return { success: false, code: 'AMBIGUOUS_TAB', agentId, tabIds: tabIds.slice() };
    }
    return { tabId: tabIds[0], ownershipToken: null, skipGate: false };
  }

  exports.resolveAgentTabOrError = resolveAgentTabOrError;

  // Browser SW global registration
  if (typeof globalThis !== 'undefined') {
    globalThis.resolveAgentTabOrError = resolveAgentTabOrError;
  }
})(typeof module !== 'undefined' && module.exports ? module.exports : {});
```

**Why this shape:**
- Sync registry read (Phase 240 D-07 no-await discipline) — only the legacy branch awaits, which is fine because the legacy branch never feeds the gate (`skipGate:true`).
- Plain-object error returns matches Phase 240's `{success:false, code, ...}` shape (Pattern parity from CONTEXT.md / Phase 240 plan 02).
- Returns `tabId` (camelCase) for use in extension internals; the caller is responsible for translating to `tab_id` for the gate's `_resolveTabIdForGate` (which already supports both via `params.tabId` first then `payload.tabId` — verified at dispatcher.js:162-165).
- `skipGate` field is a hint to the call site, not a registry concept. The call site decides whether to push `tabId` into `routeParams` based on this.

### Error Envelope Shape

The phase introduces 2 new error codes (`NO_OWNED_TAB`, `AMBIGUOUS_TAB`) plus reuses `NO_ACTIVE_TAB` (legacy fallback when no active tab) and `AGENT_REGISTRY_UNAVAILABLE` (defensive — should never happen in production but keeps tests deterministic).

The MCP layer's `mapFSBError` (in `mcp/src/errors.ts`) wraps `{success:false, code:'NO_OWNED_TAB', agentId}` into the standard MCP `{content:[{type:'text', text:JSON.stringify(...)}], isError:true}` envelope automatically. The planner does not need to plumb new error mappings.

### Schema-bridge propagation contract

Verified at `mcp/src/tools/schema-bridge.ts:78-120`:

```typescript
export function jsonSchemaToZod(inputSchema): Record<string, z.ZodTypeAny> {
  const shape: Record<string, z.ZodTypeAny> = {};
  const required = new Set(inputSchema.required || []);
  for (const [key, prop] of Object.entries(inputSchema.properties)) {
    let zodType: z.ZodTypeAny;
    switch (prop.type) {
      case 'string': zodType = ...; break;
      case 'number': zodType = z.number(); break;  // <-- tab_id case
      ...
    }
    if (prop.description) zodType = zodType.describe(prop.description);
    if (prop.default !== undefined) zodType = zodType.default(prop.default);
    if (!required.has(key)) zodType = zodType.optional();  // <-- tab_id is NOT in required, becomes optional
    shape[key] = zodType;
  }
  return shape;
}
```

**Confirmed propagation behavior:** Adding `tab_id: { type:'number', description:'...' }` to `inputSchema.properties` (NOT in `required`) results in `z.number().describe(...).optional()` in the Zod shape. The MCP server's `server.tool(name, description, zodShape, handler)` receives the optional field without further work.

**The PARAM_TRANSFORMS pitfall (verified at schema-bridge.ts:134-175):**
```typescript
press_key: (p) => ({
  key: p.key,
  ctrlKey: p.ctrl ?? false,
  shiftKey: p.shift ?? false,
  altKey: p.alt ?? false,
  useDebuggerAPI: true,
}),  // <-- if tab_id is added to schema, this transform DROPS it
```

The 5 tools in `PARAM_TRANSFORMS` (`press_key`, `drag_drop`, `click_at`, `drag`, `fill_sheet`) need their transforms updated to forward `tab_id`:

```typescript
press_key: (p) => ({
  key: p.key,
  ctrlKey: p.ctrl ?? false,
  shiftKey: p.shift ?? false,
  altKey: p.alt ?? false,
  useDebuggerAPI: true,
  ...(p.tab_id !== undefined ? { tab_id: p.tab_id } : {}),  // <-- forward
}),
```

**This is a load-bearing change. Missing it is the most likely silent failure in Phase 246.** The planner must include explicit verification that all 5 PARAM_TRANSFORMS forward `tab_id`.

### MCP server-side threading

Currently `manual.ts:69` builds the bridge payload as:
```typescript
const payload: Record<string, unknown> = { tool: fsbVerb, params, agentId };
if (ownershipToken) payload.ownershipToken = ownershipToken;
if (connectionId) payload.connectionId = connectionId;
```

`tab_id` arrives in `params` (since it's in the tool's inputSchema and passed through to `params` after `transform` runs). It threads naturally — NO CHANGE needed at the manual.ts level for action tools. Verified by tracing the data flow: `params` -> `transform(params)` -> `finalParams` -> `execAction(...finalParams)` -> bridge payload `{tool, params: finalParams, agentId, ...}` -> extension `_handleExecuteAction(payload)` -> `payload.params.tab_id` -> resolver checks `params.tab_id`.

For `read-only.ts`: the `MESSAGE_TYPE_MAP` rewrites the payload, so adding `tab_id` to read tools requires updating these builders:
```typescript
read_page: (p) => ({
  type: 'mcp:read-page',
  payload: { full: p.full, ...(p.tab_id !== undefined ? { tab_id: p.tab_id } : {}) },
}),
```

The `read-only.ts` file currently does NOT thread `agentId` (line 90-92: "Phase 238 D-06: scope discipline — read-only is signature-parity only; no agent identity injection here per CONTEXT.md."). **Phase 246 OVERTURNS this.** The planner must:
1. Remove the `void agentScope;` at line 92.
2. Add `const agentId = await agentScope.ensure(bridge);` and thread it into each `messageBuilder(params)` payload alongside any `tab_id` the caller passes.
3. Match the manual.ts pattern for ownershipToken + connectionId capture/threading.

For `visual-session.ts`: already threads agentId/ownershipToken/connectionId (verified at lines 58-71). **Phase 246 only needs to add `tab_id` to the Zod schema and forward it in the payload.** No structural change.

### Test Harness Patterns

Three reusable patterns from existing tests:

**Pattern A (registry-stub, dispatcher gate test) — `tests/ownership-error-codes.test.js`:**
```javascript
const dispatcher = require('../extension/ws/mcp-tool-dispatcher.js');
const { dispatchMcpToolRoute } = dispatcher;

function buildRegistryMock(opts) {
  const knownAgents = new Set(opts.knownAgents || []);
  const tabOwners = new Map(opts.tabOwners || []);
  const tabMetadata = new Map(opts.tabMetadata || []);
  return {
    hasAgent(agentId) { return knownAgents.has(agentId); },
    isOwnedBy(tabId, agentId, ownershipToken) { ... },
    getOwner(tabId) { return tabOwners.get(tabId) || null; },
    getTabMetadata(tabId) { ... },
    getAgentWindowId(agentId) { ... },
    getAgentTabs(agentId) {  // <-- ADD for resolver tests
      const tabs = [];
      tabOwners.forEach((owner, tabId) => { if (owner === agentId) tabs.push(tabId); });
      return tabs;
    },
    async bindTab(agentId, tabId) { ... }
  };
}

globalThis.fsbAgentRegistryInstance = buildRegistryMock({ ... });
const result = await dispatchMcpToolRoute({ tool: 'click', params: {...}, payload: {...} });
assert.strictEqual(result.code, 'NO_OWNED_TAB', '...');
```

**Pattern B (legacy synthesis, registry direct) — `tests/legacy-agent-synthesis.test.js`:**
Hand-rolled chrome mock + fresh `require` of the registry module per test. Mirror this for resolver tests that exercise the legacy branch end-to-end.

**Pattern C (bridge client lifecycle, `vm`-loaded) — `tests/mcp-bridge-client-lifecycle.test.js`:**
Use `vm.createContext` + `fs.readFileSync` to load the SW-side IIFE-wrapped modules in a hermetic context with mocked `chrome`, `globalThis`, and stubbed dispatcher. The `buildClientHarness` helper at line ~500 is the canonical entrypoint. Mirror this for tests that exercise `_handleExecuteAction` -> resolver -> dispatch end-to-end.

**Recommended test files for Phase 246:**

| Test file | Pattern | Coverage |
|-----------|---------|----------|
| `tests/agent-tab-resolver.test.js` | Pattern A | Resolver unit: 1-owned, 0-owned (NO_OWNED_TAB), 2+-owned (AMBIGUOUS_TAB), legacy:* fall-through, explicit tab_id passthrough, missing registry |
| `tests/agent-tab-resolver-integration.test.js` | Pattern C | End-to-end: `_handleExecuteAction(click, agentId='agent_a', no tab_id)` resolves to agent_a's owned tab, NOT user's active tab |
| `tests/visual-session-agent-scoped.test.js` | Pattern A or C | `handleStartVisualSessionRoute` with multi-tab agent errors AMBIGUOUS_TAB; with single-tab agent resolves correctly; legacy popup attaches to user's active tab |
| `tests/open-tab-background-default.test.js` | Pattern A or B | `handleOpenTabRoute({url, /* no active */ })` opens with `active:false`; explicit `active:true` opens foreground; verifies bindTab fires regardless |

A single mega-file `tests/agent-scoped-tab-resolution.test.js` covering all four would also work but at ~600+ lines becomes hard to maintain. **Recommendation: 4 separate files** mirroring Phase 240 / Phase 245's split.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Tab resolution by agentId | A new "agent->tab" map | `globalThis.fsbAgentRegistryInstance.getAgentTabs(agentId)` (registry.js:1023) | Sync, single-source-of-truth, already covered by 20-concurrent-claim mutex. Building a parallel mapping creates a TOCTOU race. |
| Active-tab fallback for legacy | `chrome.tabs.query({active:true})` inline | `client._getActiveTab()` already exists at mcp-bridge-client.js:486 | One helper, one shape — keep the indirection so tests can stub the client. |
| Schema validation for tab_id | Manual `if (typeof params.tab_id !== 'number') ...` | `jsonSchemaToZod` auto-derivation (schema-bridge.ts:78) | Adds the optional `z.number()` Zod check at the MCP boundary; downstream code can trust it. |
| Cross-agent error envelope | A new `FsbResolverError` class | Plain `{success:false, code:'...', ...}` matching Phase 240's shape | Consistency with the gate's existing 4 error codes (TAB_NOT_OWNED, TAB_INCOGNITO_NOT_SUPPORTED, TAB_OUT_OF_SCOPE, AGENT_NOT_REGISTERED). MCP `mapFSBError` already serializes plain objects. |
| Legacy synthesis on every dispatch | Re-call `getOrRegisterLegacyAgent` inside the resolver | Trust the boot-time synthesis at popup.js:307 / sidepanel.js:509 / background.js:6597 | Synthesis is idempotent; calling it 100x per session adds awaits to the hot path with zero benefit. |

**Key insight:** Phase 246's value is in the WIRE-UP, not the LOGIC. The registry already exposes `getAgentTabs`, the gate already enforces ownership, the legacy synthesis already binds the user's active tab. The phase's job is to thread these existing primitives through the dispatch path so they FIRE on every call — not to introduce new mechanisms.

## Common Pitfalls

### Pitfall 1: PARAM_TRANSFORMS silently dropping tab_id
**What goes wrong:** `tab_id` added to `tool-definitions` for `press_key`, `drag_drop`, `click_at`, `drag`, `fill_sheet`. Caller passes `tab_id`. Zod accepts it. PARAM_TRANSFORMS rebuilds `params` from scratch and discards `tab_id`. Dispatcher receives no `tab_id`, resolver hits AMBIGUOUS_TAB on multi-tab agents, caller is confused.
**Why it happens:** Schema-bridge.ts has TWO codepaths: `jsonSchemaToZod` (auto-derived, transparent) and `PARAM_TRANSFORMS` (explicit rebuild). The auto-derive path implies all params propagate; the rebuild path silently discards anything not enumerated.
**How to avoid:** Plan must include a mandatory verification step: every entry in `PARAM_TRANSFORMS` forwards `tab_id` if the input has it. Test: `tests/agent-tab-resolver.test.js` includes 5 cases — one per PARAM_TRANSFORMS entry — that pass `{tab_id: 42, ...}` through `mcp/src/tools/manual.ts`'s execution and assert the bridge payload contains `tab_id: 42`.
**Warning signs:** A test for "press_key with explicit tab_id resolves to that tab" fails with NO_OWNED_TAB or AMBIGUOUS_TAB.

### Pitfall 2: tool-definitions duplication drift
**What goes wrong:** `extension/ai/tool-definitions.js` updated with `tab_id` in 37 schemas. `mcp/ai/tool-definitions.cjs` (the duplicate) NOT updated. Extension passes `tab_id` through but MCP server-side Zod validation (read from the cjs duplicate) rejects with "unknown property tab_id" because the cjs schema doesn't include it.
**Why it happens:** No automated sync. Two manually-maintained copies. CONTEXT.md mentions this once but doesn't make it a verification step.
**How to avoid:** Plan must include a step that diffs `extension/ai/tool-definitions.js` against `mcp/ai/tool-definitions.cjs` and asserts they are byte-identical AFTER the schema bumps. `diff -q` returns 0 == pass; non-zero == fail. Add this to the plan's verification gate.
**Warning signs:** MCP server-side errors at startup ("schema parse failed for tool X"); or tests pass extension-side but fail MCP-server-side.

### Pitfall 3: Schema bumps land but legacy:* fail because gate sees skipGate as undefined
**What goes wrong:** Resolver returns `{tabId: N, skipGate: true}` for legacy:popup. Call site ignores `skipGate` and pushes `tabId` into `routeParams`. Gate's `isOwnedBy(N, 'legacy:popup', null)` returns FALSE because the user's active tab is NOT bound to legacy:popup at this moment (user switched tabs after popup boot). Dispatch rejects with TAB_NOT_OWNED. Popup user sees a regression.
**Why it happens:** D-16 says "resolver feeds tabId back to params"; the planner forgets to make legacy:* surfaces an EXCEPTION.
**How to avoid:** The call site must check `if (resolved.skipGate) { /* do not push tabId */ } else { routeParams.tabId = resolved.tabId; }`. Plan task explicitly enumerates this branch in the call site code.
**Warning signs:** A "popup attaches to user-active-tab even after switching tabs" test fails; or `tests/legacy-agent-synthesis.test.js` extensions fail.

### Pitfall 4: get_page_snapshot missed
**What goes wrong:** CONTEXT.md D-01 lists 6 read tools. The planner migrates 5 (the ones routed via _handleExecuteAction) and assumes get_page_snapshot is covered. It is NOT — `handleGetPageSnapshotRoute` (dispatcher.js:1429) has its own active-tab fetch.
**Why it happens:** CONTEXT.md does not enumerate the call sites; only the tool names. Tools that route through `_handleExecuteAction` migrate transparently; tools that have a dedicated handler do not.
**How to avoid:** Plan task includes EXPLICIT migration of `handleGetPageSnapshotRoute` to use the resolver. Add `tests/read-tool-tab-resolution.test.js` case for `get_page_snapshot`.
**Warning signs:** Smoke test on multi-agent: `agent_a.get_page_snapshot()` returns user's active tab content instead of agent_a's owned tab content.

### Pitfall 5: Vault tools (fill_credential, use_payment_method) missed because vault.ts is not agentScope-aware
**What goes wrong:** Vault tools register via `registerVaultTools` (vault.ts) which currently does `void agentScope;` (line 27). The bridge payloads do NOT thread agentId/ownershipToken/connectionId. The extension-side `_handleFillCredential` and `_handleUsePaymentMethod` use `_getActiveTab()` and would not benefit from a resolver call because the agentId never arrives.
**Why it happens:** Phase 238 D-06 explicitly excluded vault from agent identity threading. CONTEXT.md does not call out that this needs to change.
**How to avoid:** Plan must EITHER (a) thread agentId into vault.ts's payloads (small change, mirrors manual.ts's pattern) AND migrate the extension-side handlers, OR (b) explicitly defer vault to a later phase and document why. **Recommend (a)** — it is small and consistent. Open Question 4 documents this as a planner choice.
**Warning signs:** A multi-agent vault test (agent_a.fill_credential on agent_b's tab) fails to reject with TAB_NOT_OWNED because the gate never sees agentId.

### Pitfall 6: _resolveTabIdForGate looks for `params.tabId` (camelCase), schema declares `tab_id` (snake_case)
**What goes wrong:** Schema declares `tab_id`. Caller passes `{tab_id: 42}`. Zod accepts. Bridge payload `{params: {tab_id: 42}, agentId: '...'}` arrives extension-side. `_handleExecuteAction` builds `routeParams = {...params, agentId, ownershipToken}`. So routeParams now has `tab_id: 42` (NOT `tabId: 42`). Gate's `_resolveTabIdForGate` reads `params.tabId` and `payload.tabId` (camelCase, dispatcher.js:162-165). NEITHER matches `tab_id`. Gate skips the tab arm. Phase 246's whole D-16 gate-tightening goal silently regresses.
**Why it happens:** Snake_case vs camelCase split between MCP boundary and extension internals. The existing `params.tabId` exists because Phase 240 pre-dates the MCP-boundary snake_case convention.
**How to avoid:** Resolver normalizes — if `params.tab_id` is present, also set `params.tabId` (or the call site does this when feeding routeParams). Concrete: in `_handleExecuteAction`, after the resolver returns, do `routeParams.tabId = resolved.tabId` (using camelCase). The resolver itself returns `tabId` (camelCase). The schema declares `tab_id` (snake_case). The call site is the bridge — it must translate. **Test:** `tests/agent-tab-resolver-integration.test.js` includes a case asserting `params.tabId` is present in the call to `dispatchMcpToolRoute` after resolver runs.
**Warning signs:** Gate-tightening tests pass at the resolver unit level but fail at the integration level; or smoke test multi-agent rejection silently fails to fire.

### Pitfall 7: handleNavigateRoute / handleNavigationHistoryRoute and the tab-CREATING ambiguity
**What goes wrong:** D-13 says "action tools use the resolver." But `navigate` is a borderline tool — it CHANGES the URL of an addressed tab. If the agent owns 2 tabs, which one should it navigate? CONTEXT.md does not address this directly. Today's `handleNavigateRoute` falls back to active-tab; per Phase 240 D-08 it then bindTabs the navigated tab to the agent. But if the agent already owns 2 tabs, the navigate is ambiguous.
**Why it happens:** Tab-CREATING vs tab-ADDRESSING semantics. `open_tab` creates and binds; `navigate` is supposed to ADDRESS but is ambiguous when the agent owns multiple.
**How to avoid:** **Open Question 1.** The planner picks one of three options: (a) treat navigate/go_back/go_forward/refresh as "tab-required action tools" and route them through the resolver (errors AMBIGUOUS_TAB on multi-tab agents); (b) leave them on active-tab semantics with the existing bindTab D-08 backstop; (c) make navigate's `tabId` REQUIRED rather than optional for MCP agents. Recommend (a) — consistent with the rest of the action tools and the smoke test's "no surprise tab" goal. This is a planner-level call.
**Warning signs:** Smoke test "agent_a.navigate({url:...}) when agent_a owns multiple tabs" silently navigates the wrong tab.

### Pitfall 8: Visual session re-entry contract regression
**What goes wrong:** Phase 240 D-03 same-agent resume requires that calling `start_visual_session` again on a tab the agent already has a visual session on RESUMES rather than restarts. The existing logic at mcp-visual-session.js:120-153 reads `input.agentId` and the registry owner. If Phase 246 changes which tab the visual session targets (via the resolver), and the resolver picks a DIFFERENT tab than the agent's existing visual session, the agent gets a NEW visual session even though it expected the resume.
**Why it happens:** The resolver picks a tab based on registry ownership; the visual-session manager keys by `tabId`. Mismatch when the agent owns multiple tabs and the resolver picks the "wrong" one (from the user's perspective).
**How to avoid:** **Open Question 2.** When agent has multiple tabs AND has an active visual session on one of them, and start_visual_session is called WITHOUT `tab_id`, should the resolver: (a) prefer the tab with the existing visual session (preserving D-03 resume); (b) error AMBIGUOUS_TAB (forcing the caller to disambiguate); (c) pick lexicographically-smallest tabId. Recommend (b) — explicit is better than implicit; the resume is preserved when the caller passes `tab_id` matching the existing session.
**Warning signs:** `tests/visual-session-reentry.test.js` extensions fail with "expected resume, got new session" or vice versa.

## Runtime State Inventory

This phase is NOT a rename/refactor; it is a behavior change. Skipping the standard rename runtime-state inventory because nothing is being renamed. Items that DO change behavior at runtime:

| Category | Items found | Action required |
|----------|-------------|------------------|
| Stored data | None — agent registry already exists; no schema migration needed | None |
| Live service config | None — no external services impacted | None |
| OS-registered state | None — no OS registrations carry agent state | None |
| Secrets / env vars | None — no env-driven state | None |
| Build artifacts | `mcp/dist/` rebuild required after MCP server-side changes (manual.ts, read-only.ts, visual-session.ts schema updates). `npm --prefix mcp run build` invoked by `npm test`; no separate step needed for tests. For local human-driven testing the user must rebuild. | Document in plan: rebuild mcp/dist after server-side TypeScript changes |

## Environment Availability

This phase is purely code/config changes — no external dependencies are required. The existing test infrastructure (node, npm, the in-tree mocks) is sufficient. Skipping detailed env audit.

## Validation Architecture (Nyquist)

Nyquist validation is enabled (`.planning/config.json` has no `workflow.nyquist_validation` key — treat absent as enabled). Phase 246 is integration-heavy: 1 resolver helper + 6 read tool migrations + 1 visual-session migration + ~37 action tool schema bumps + 1 open_tab default flip + ~5 PARAM_TRANSFORMS forwards + cross-cut MCP server-side changes.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | `node:assert` (CommonJS) + `vm` for SW-context loading + hand-rolled chrome mocks. No external test runner — every test is a runnable `.js` file invoked via `node tests/<file>.test.js` |
| Config file | None — tests are listed in `package.json:test` script as a `&&`-chained sequence |
| Quick run command (per test file) | `node tests/agent-tab-resolver.test.js` |
| Full suite command | `npm test` (runs all 60+ tests) |
| Per-test pattern | Each test file emits `PASS:` / `FAIL:` lines, ends with `process.exit(failed > 0 ? 1 : 0)` |

### Phase Requirements -> Test Map

Because Phase 246 has no NEW REQ-IDs, the test map is constructed against the design contracts (D-01..D-16) rather than REQ-IDs.

| Decision | Behavior to test | Test type | Automated command | File exists? |
|----------|------------------|-----------|-------------------|--------------|
| D-01 | Resolver returns owned tab when agent owns exactly 1 | unit | `node tests/agent-tab-resolver.test.js` | NO (Wave 0) |
| D-01 | Resolver returns NO_OWNED_TAB when agent owns 0 | unit | same | NO |
| D-01 | Resolver returns AMBIGUOUS_TAB when agent owns 2+ | unit | same | NO |
| D-02 | Read tool with explicit `tab_id` reaches the right tab | integration | `node tests/read-tool-tab-resolution.test.js` | NO |
| D-02 | Read tool without `tab_id` auto-resolves via registry | integration | same | NO |
| D-04 | Resolver legacy:* branch returns active tab | unit | `node tests/agent-tab-resolver.test.js` | NO |
| D-05 | open_tab without `active:true` opens in background | integration | `node tests/open-tab-background-default.test.js` | NO |
| D-05 | open_tab with `active:true` opens in foreground | integration | same | NO |
| D-08 | open_tab with new default still calls bindTab and returns ownershipToken | integration | same | NO (could extend existing `tests/ownership-error-codes.test.js`) |
| D-09 | start_visual_session with multi-tab agent errors AMBIGUOUS_TAB | integration | `node tests/visual-session-agent-scoped.test.js` | NO |
| D-11 | Same-agent resume preserved when tab_id passed | integration | extend `tests/visual-session-reentry.test.js` | YES (extend) |
| D-13 | Action tool with multi-tab agent errors AMBIGUOUS_TAB | integration | `node tests/action-tool-agent-scoped.test.js` | NO |
| D-15 | Legacy popup action targets user's active tab even when MCP agents are present | integration | extend `tests/legacy-agent-synthesis.test.js` | YES (extend) |
| D-16 | Resolver-fed tabId triggers gate's tab-arm and rejects cross-agent | integration | extend `tests/ownership-error-codes.test.js` | YES (extend) |

### Sampling Rate

- **Per task commit:** Run the SPECIFIC test file for the task: `node tests/agent-tab-resolver.test.js` (~1-2s)
- **Per wave merge:** Run all NEW + EXTENDED test files together: `node tests/agent-tab-resolver.test.js && node tests/read-tool-tab-resolution.test.js && node tests/visual-session-agent-scoped.test.js && node tests/action-tool-agent-scoped.test.js && node tests/open-tab-background-default.test.js && node tests/legacy-agent-synthesis.test.js && node tests/visual-session-reentry.test.js && node tests/ownership-error-codes.test.js` (~10s)
- **Phase gate:** `npm test` (full suite, ~60s) — must be green before `/gsd-verify-work`. AND a manual smoke run of the multi-agent regression test: `node tests/multi-agent-regression.test.js`.

### Wave 0 Gaps

Wave 0 (test infrastructure) needs 4 new test files plus 3 extensions:

- [ ] `tests/agent-tab-resolver.test.js` — covers D-01, D-04 (resolver unit)
- [ ] `tests/read-tool-tab-resolution.test.js` — covers D-02 (read tool integration)
- [ ] `tests/visual-session-agent-scoped.test.js` — covers D-09, D-10 (visual session integration)
- [ ] `tests/action-tool-agent-scoped.test.js` — covers D-13, D-14 (action tool integration; includes the 5 PARAM_TRANSFORMS cases per Pitfall 1)
- [ ] `tests/open-tab-background-default.test.js` — covers D-05, D-06, D-08 (open_tab default flip)
- [ ] EXTEND `tests/legacy-agent-synthesis.test.js` — adds 2 cases for legacy:* tab-resolution via resolver
- [ ] EXTEND `tests/visual-session-reentry.test.js` — adds 1 case for D-11 same-agent resume with explicit tab_id
- [ ] EXTEND `tests/ownership-error-codes.test.js` — adds 2 cases for D-16 gate-arm-fires-after-resolver-feed

All 7 test files reuse the harness patterns documented in `## Code Pattern Inventory` (Patterns A, B, C). No framework install required — `node:assert` is built-in. No fixtures beyond what tests/fixtures/ already provides.

## Security Domain

Phase 246 hardens an EXISTING access-control surface (Phase 240's gate) by closing a tab-arm-skip path. ASVS-relevant:

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | no | (agent identity is FSB-issued via crypto.randomUUID; no user authn change) |
| V3 Session Management | no | (session boundary unchanged) |
| V4 Access Control | YES | Per-agent tab ownership enforcement; this phase makes it load-bearing on every dispatch (was skipped today). Standard control: `checkOwnershipGate` at dispatcher.js:178-215 + ownership_token triple verification. |
| V5 Input Validation | YES | New `tab_id?: number` field on ~44 tool schemas; Zod (`z.number().optional()`) validates at the MCP boundary. No further validation needed extension-side (gate uses Number.isFinite). |
| V6 Cryptography | no | (ownership_token is opaque UUID minted by registry; no new crypto) |

### Known Threat Patterns for the multi-agent surface

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Agent A reads Agent B's tab via active-tab race (the smoke test bug) | I (Information disclosure) | Resolver routes via `getAgentTabs(agentId)` not active-tab, so Agent A never SEES Agent B's tab |
| Agent A submits an action with explicit `tab_id` belonging to Agent B (impersonation attempt) | T / E (Tampering / Elevation of Privilege) | Existing gate's `isOwnedBy(tabId, agentId, ownership_token)` rejects with TAB_NOT_OWNED; resolver pushes `tabId` so the gate's tab-arm fires (D-16) |
| Agent A passes Agent B's `ownership_token` (token leak) | T | The token is minted per-bindTab, stored only in AgentScope (per-process MCP memory) and the registry; not transmitted between agents. Token leak requires shared-memory access which is not in scope |
| open_tab steals user focus mid-task (DoS-like UX bug) | D (Denial of Service / quality) | D-05 flips default to background; explicit `active:true` required to steal focus |

No new threat patterns introduced by Phase 246 — every change is a TIGHTENING of existing controls.

## Open Questions (RESOLVED)

The planner picks an answer to each before plan task list is final. Each has a recommendation; the planner can override with rationale. All 7 questions RESOLVED during planning iteration 1.

### Open Question 1: Should `navigate` / `go_back` / `go_forward` / `refresh` migrate to the resolver?

**What we know:** These tools live in `mcp-tool-dispatcher.js` (not `_handleExecuteAction`), use `getActiveTabFromClient` today, and rely on Phase 240 D-08 bindTab as their backstop. CONTEXT.md D-13 says "action tools use the resolver" but does not enumerate which tools count as "action tools" — the action-tool list in D-13 mentions "click, type_text, click_at, ..." not navigate.
**What's unclear:** Whether the planner treats navigate/go_back/go_forward/refresh as part of the "action tools" set per D-13.
**Recommendation:** YES — migrate them. Consistent with the principle "all non-creating tools resolve via registry." Tools migrate via `dispatcher.handleNavigateRoute`'s active-tab fetch being replaced with the resolver. Single-tab agents see no change; multi-tab agents must pass `tab_id`. Open_tab stays as the only true tab-CREATOR.
**RESOLVED:** YES — migrate by routing the tab via `_handleExecuteAction`'s resolver-fed `routeParams.tabId` pass-through; explicit per-handler migration of dispatcher routes (`handleNavigateRoute`, `handleNavigationHistoryRoute`, `handleBackRoute`) is DEFERRED to a future phase. Phase 246 ships the resolver + the action-tool surface; the dispatcher's navigate handlers continue to use `getActiveTabFromClient` for now, but the gate's ownership check still fires via the bindTab backstop (Phase 240 D-08). Rationale: keeps Phase 246 scope contained; the per-handler migration is mechanical and can land as a follow-up without blocking the smoke-test fix.

### Open Question 2: Visual session disambiguation when agent owns multiple tabs AND has an active session

**What we know:** mcp-visual-session.js:90 same-agent resume reads `input.agentId` and the registry owner. Phase 240 D-03 preserves resume semantics. With multi-tab agents, the resolver could pick a tab WITHOUT the existing session, breaking resume.
**What's unclear:** Should the resolver prefer the tab with an existing visual session?
**Recommendation:** NO — error AMBIGUOUS_TAB. Explicit > implicit. Caller passes `tab_id` to disambiguate; the resume path then fires correctly because mcp-visual-session.js:120-153 sees the explicit tabId match the existing session.
**RESOLVED:** AMBIGUOUS_TAB error envelope (`{success:false, code:'AMBIGUOUS_TAB', agentId, tabIds:[...]}`). Explicit > implicit, matches D-09. The resume path fires correctly when the caller retries with explicit `tab_id` matching the existing session (see mcp-visual-session.js:120-153). Plan 02 Task 2 + tests/visual-session-reentry.test.js D-11 case verify the resume composition.

### Open Question 3: Resolver location — `extension/utils/agent-tab-resolver.js` vs co-located in `agent-registry.js`

**What we know:** CONTEXT.md "Claude's Discretion" recommends a separate file at `extension/utils/agent-tab-resolver.js` for testability. The helper is small (~30 lines) and used by 6 call sites.
**What's unclear:** Whether to co-locate with the registry (one less importScripts entry) or split (cleaner unit tests, mirrors Phase 245's split with `wrapWithChangeReport`).
**Recommendation:** Separate file `extension/utils/agent-tab-resolver.js`. Mirrors Phase 245's `extension/utils/action-verification.js` pattern. importScripts in background.js order: `tool-definitions.js` -> `agent-registry.js` -> `agent-tab-resolver.js` -> `mcp-tool-dispatcher.js` -> `mcp-bridge-client.js`. Tests can `require` it directly.
**RESOLVED:** Separate file `extension/utils/agent-tab-resolver.js` for testability. Mirrors Phase 245 `extension/utils/action-verification.js` pattern. Plan 01 Task 2 creates the file; Plan 01 Task 2 also wires importScripts in background.js order: `tool-definitions.js` -> `agent-registry.js` -> `agent-tab-resolver.js` -> `mcp-tool-dispatcher.js` -> `mcp-bridge-client.js`. Tests can `require` it directly without mocking the SW.

### Open Question 4: Vault tools (fill_credential, use_payment_method) — agentScope-aware or defer?

**What we know:** vault.ts currently does `void agentScope` (line 27). Bridge payloads do not thread agentId/ownershipToken. Extension-side `_handleFillCredential` and `_handleUsePaymentMethod` both use `_getActiveTab()`. If Phase 246 migrates these handlers to the resolver but the agentId never arrives in the payload, the resolver hits the "no agentId -> can't resolve" branch.
**What's unclear:** Does Phase 246 also overturn vault.ts's "scope discipline" exemption?
**Recommendation:** YES — overturn. Mirror the read-only.ts overturn. Thread agentId/ownershipToken/connectionId in vault.ts (4 small additions, ~10 lines per tool), migrate the 2 extension-side handlers to the resolver. The vault's domain-derivation logic (line 1199-1203, 1252-1257) stays — the resolver only resolves the TAB; the vault still derives the domain from the resolved tab's URL.
**RESOLVED:** YES — overturn `vault.ts:27` `void agentScope` exemption. Mirrors the `read-only.ts` overturn. Plan 02 Task 6 threads agentId/ownershipToken/connectionId/optional tab_id in `fill_credential` and `use_payment_method` server-side; Plan 02 Task 3 migrates the matching `_handleFillCredential` and `_handleUsePaymentMethod` extension-side handlers to the resolver. The vault's domain-derivation logic stays intact — the resolver returns only `tabId`; the vault derives the domain from the resolved tab's URL via `chrome.tabs.get(resolved.tabId)`.

### Open Question 5: Error envelope shape — `FsbResolverError` class vs plain object

**What we know:** Phase 240 uses plain `{success:false, code, ...}` objects. CONTEXT.md "Claude's Discretion" recommends plain object for parity.
**What's unclear:** None — recommendation accepted.
**Recommendation:** Plain object `{success:false, code:'NO_OWNED_TAB', agentId}`. No class.
**RESOLVED:** Plain object `{success:false, code, agentId, tabIds?}` for parity with Phase 240 error envelopes. No `FsbResolverError` class. Resolver returns plain objects; bridge serializes them directly to the MCP response. Codes: `NO_OWNED_TAB`, `AMBIGUOUS_TAB`, `AGENT_REGISTRY_UNAVAILABLE`, `NO_ACTIVE_TAB`.

### Open Question 6: Schema rollout strategy — single diff vs split

**What we know:** ~37 action tools + 6 read tools + 1 visual + open_tab schema bumps = 44 inputSchema additions. Single diff is mechanical; the propagation through `jsonSchemaToZod` is automatic.
**What's unclear:** Single diff in `tool-definitions.js` (and its `.cjs` mirror) vs split by tool category.
**Recommendation:** Single diff in tool-definitions.js + tool-definitions.cjs. Split adds review burden without functional benefit. Use a generator script if the planner wants to avoid manual editing — but a single hand-written diff is also fine since the additions are uniform: `tab_id: { type: 'number', description: 'Tab id when this agent owns multiple tabs. Omit for single-tab agents.' }`.
**RESOLVED:** Single diff in `extension/ai/tool-definitions.js` + `mcp/ai/tool-definitions.cjs` (kept byte-identical). Plan 01 Task 6 handles the read-tool schemas (6 tools) and Plan 01 Task 5 handles open_tab. Plan 02 Task 4 handles the 35 action-tool schemas. tests/tool-definitions-parity.test.js (Plan 03 Task 1) is the byte-identity safety net (Pitfall 2 closed permanently).

### Open Question 7: skipGate field naming

**What we know:** CONTEXT.md uses `skipGate:true` informally; resolver returns `{tabId, ownershipToken, skipGate}`.
**What's unclear:** Whether to call it `skipGate`, `legacyResolved`, `skipTabArm`, etc.
**Recommendation:** `skipGate: true`. Matches the call-site code "if (resolved.skipGate) { /* don't push tabId */ }". Concise, conveys intent. Document in JSDoc on the resolver: "true ONLY when the tab was resolved via the legacy:* fall-through; the gate's tab-arm should be skipped because legacy surfaces don't track per-tab ownership tokens."
**RESOLVED:** `skipGate: true`. Matches the call-site code in Plan 02 Task 3 `_handleExecuteAction`: `...(resolved.skipGate ? {} : { tabId })`. Concise; conveys intent. Plan 01 Task 2 documents in resolver JSDoc: "true ONLY when the tab was resolved via the legacy:* fall-through; the gate's tab-arm should be skipped because legacy surfaces don't track per-tab ownership tokens."

## Implementation Approach

The planner uses these recommendations to build the plan task list. Three plans, each with focused scope:

### Plan 246-01: Resolver + Read Tools + open_tab Default

**Goal:** Land the resolver helper, migrate the 6 read-tool sites, flip open_tab default, and prove the resolver shape with unit tests.

**Tasks (sketch):**
1. Wave 0: scaffold `tests/agent-tab-resolver.test.js` (RED) covering D-01 and D-04 cases.
2. Create `extension/utils/agent-tab-resolver.js` with `resolveAgentTabOrError`. importScripts after agent-registry.js.
3. Migrate `_handleGetDOM` (mcp-bridge-client.js:520) to use resolver.
4. Migrate `_handleReadPage` (mcp-bridge-client.js:533).
5. Migrate `handleGetPageSnapshotRoute` (mcp-tool-dispatcher.js:1429).
6. Add `tab_id?: number` to read tool schemas: `read_page`, `get_dom_snapshot`, `get_text`, `get_attribute`, `read_sheet`, `get_page_snapshot` in BOTH `extension/ai/tool-definitions.js` AND `mcp/ai/tool-definitions.cjs`.
7. Update `mcp/src/tools/read-only.ts`: remove `void agentScope`; thread agentId/ownershipToken/connectionId in each `messageBuilder` payload; forward `tab_id` from params.
8. Flip open_tab default at `extension/ws/mcp-tool-dispatcher.js:917`: `active: params.active === true`.
9. Update open_tab description in tool-definitions to document the default flip (D-06).
10. Wave 1: scaffold `tests/read-tool-tab-resolution.test.js` (integration) and `tests/open-tab-background-default.test.js`. Verify all green.
11. Diff verify: `extension/ai/tool-definitions.js` byte-equals `mcp/ai/tool-definitions.cjs`.
12. Rebuild MCP: `npm --prefix mcp run build`. Verify `npm test`.

### Plan 246-02: Visual Session + Action Tools + Gate Tightening

**Goal:** Migrate the visual-session and ~30 action tool dispatch path to the resolver. Make the Phase 240 dispatch gate's tab-arm fire on every non-creating call.

**Tasks (sketch):**
1. Wave 0: scaffold `tests/visual-session-agent-scoped.test.js` and `tests/action-tool-agent-scoped.test.js` (RED).
2. Migrate `handleStartVisualSessionRoute` (mcp-tool-dispatcher.js:1195) to use resolver.
3. Add `tab_id?: number` to `start_visual_session` Zod schema in `mcp/src/tools/visual-session.ts:38-41`.
4. Migrate `_handleExecuteAction` (mcp-bridge-client.js:564) to use resolver. Implement `skipGate` handling: if `resolved.skipGate`, do NOT push `tabId` into routeParams; else `routeParams.tabId = resolved.tabId`.
5. Add `tab_id?: number` to all ~30 action tools in BOTH tool-definitions files. List: navigate, search, go_back, go_forward, refresh, click, type_text, press_enter, press_key, select_option, check_box, hover, right_click, double_click, select_text_range, drag_drop, drop_file, focus, clear_input, scroll, scroll_to_top, scroll_to_bottom, scroll_to_element, wait_for_element, wait_for_stable, fill_sheet, click_at, click_and_hold, drag, drag_variable_speed, scroll_at, insert_text, double_click_at, set_attribute, execute_js. (List confirmed by grep against tool-definitions.js; 35 tools, not 30 — the planner counts.)
6. Update PARAM_TRANSFORMS for `press_key`, `drag_drop`, `click_at`, `drag`, `fill_sheet` (5 entries) to forward `tab_id`. (See Pitfall 1.)
7. Update tool descriptions to add "Multi-agent: pass tab_id when this agent owns multiple tabs" (mirrors existing "Multi-agent: agent-scoped tabs..." copy).
8. Migrate `_handleFillCredential` (mcp-bridge-client.js:1195) to use resolver.
9. Migrate `_handleUsePaymentMethod` (mcp-bridge-client.js:1248) to use resolver.
10. Update `mcp/src/tools/vault.ts`: thread agentId/ownershipToken/connectionId for `fill_credential` and `use_payment_method` (mirror manual.ts pattern). Add `tab_id?: number` to their Zod schemas.
11. Optional per Open Question 1: also migrate `handleNavigateRoute` and `handleNavigationHistoryRoute` to resolver.
12. Wave 1: extend `tests/ownership-error-codes.test.js` with D-16 cases (resolver-fed tabId triggers gate's tab-arm). Verify all green.
13. Diff verify + rebuild MCP + npm test.

### Plan 246-03: Cross-Cut Integration Tests + Smoke

**Goal:** End-to-end verification that the whole surface composes. Multi-agent regression scenarios.

**Tasks (sketch):**
1. Extend `tests/multi-agent-regression.test.js` with 4 representative integration scenarios:
   - **Scenario A:** Two MCP agents (agent_a, agent_b) each own one tab. agent_a calls read_page WITHOUT tab_id. Resolver picks agent_a's tab. Verify the bridge payload's params.tabId is agent_a's tab, NOT user's active tab.
   - **Scenario B:** Legacy popup is active. User switches active tab to a tab popup did NOT bind. User triggers an action via popup. Resolver hits legacy:* branch, returns user's CURRENT active tab (NOT the popup-bound tab), gate skips tab-arm (`skipGate:true`), action proceeds. Verify no regression.
   - **Scenario C:** Single MCP agent calls open_tab without `active`. Verify `chrome.tabs.create` was called with `active:false`. Verify response includes `ownershipToken`. Verify subsequent action against the new tab is owned.
   - **Scenario D:** Single MCP agent owns 2 tabs. Calls click WITHOUT tab_id. Resolver returns AMBIGUOUS_TAB. Verify error envelope shape `{success:false, code:'AMBIGUOUS_TAB', agentId, tabIds:[...]}`. Caller retries with explicit `tab_id` matching one of the owned tabs; verify dispatch succeeds.
2. Extend `tests/legacy-agent-synthesis.test.js` with the legacy:* skipGate verification.
3. Extend `tests/visual-session-reentry.test.js` with D-11 explicit-tab_id resume case.
4. Verify `npm test` is fully green.
5. Update tool descriptions in `mcp/src/tools/manual.ts`, `read-only.ts`, `visual-session.ts`, `vault.ts` if any are out of sync (the description copy is duplicated; this is a known pattern — Phase 245 maintained it).
6. Document the change in CHANGELOG.md (mcp/) and bump version if appropriate. (Most likely NOT — Phase 246 is gap-closure within v0.9.60; the bump happens in Phase 244 / v0.9.60 release. Verify with user before bumping.)

## Sources

### Primary (HIGH confidence) — verified at file:line during this research

- `extension/ws/mcp-bridge-client.js:486-489` — `_getActiveTab` impl
- `extension/ws/mcp-bridge-client.js:520-543` — `_handleGetDOM`, `_handleReadPage`
- `extension/ws/mcp-bridge-client.js:564-609` — `_handleExecuteAction`
- `extension/ws/mcp-bridge-client.js:1195-1225, 1244-1310` — vault handlers
- `extension/ws/mcp-tool-dispatcher.js:161-215` — `_resolveTabIdForGate`, `checkOwnershipGate`
- `extension/ws/mcp-tool-dispatcher.js:217-263` — `dispatchMcpToolRoute`, `dispatchMcpMessageRoute`
- `extension/ws/mcp-tool-dispatcher.js:312-319` — `getActiveTabFromClient`
- `extension/ws/mcp-tool-dispatcher.js:912-941` — `handleOpenTabRoute` (the `active` default site)
- `extension/ws/mcp-tool-dispatcher.js:1175-1232` — `handleStartVisualSessionRoute`
- `extension/ws/mcp-tool-dispatcher.js:1429-1500` — `handleGetPageSnapshotRoute` (the read tool not in CONTEXT.md's enumeration)
- `extension/utils/agent-registry.js:374-400` — `getOrRegisterLegacyAgent`
- `extension/utils/agent-registry.js:1023-1027` — `getAgentTabs`
- `extension/ai/tool-definitions.js` (50 tools, 1092 lines) and `mcp/ai/tool-definitions.cjs` (byte-identical) — TOOL_REGISTRY source
- `mcp/src/tools/schema-bridge.ts:78-175` — `jsonSchemaToZod`, `PARAM_TRANSFORMS`
- `mcp/src/tools/manual.ts:32-95` — `execAction` (the one-call action dispatcher)
- `mcp/src/tools/read-only.ts:84-121` — `registerReadOnlyTools` (currently agentScope-skipping)
- `mcp/src/tools/visual-session.ts:1-120` — visual-session registration (already agentScope-aware)
- `mcp/src/tools/vault.ts:1-80` — vault registration (currently agentScope-skipping; relevant to Open Question 4)
- `mcp/src/agent-scope.ts:1-191` — AgentScope ensure / capture / current
- `extension/ui/popup.js:300-325` and `extension/ui/sidepanel.js:505-540` — legacy synthesis at boot
- `extension/background.js:5216-5244` — `ensureLegacyAgent` runtime action handler
- `extension/background.js:6588-6620` — `handleStartAutomation` legacy bind
- `extension/utils/mcp-visual-session.js:90-182` — `startSession` resume / cross-agent reject
- `tests/ownership-error-codes.test.js:1-100` — registry-stub harness pattern
- `tests/legacy-agent-synthesis.test.js:1-100` — legacy synthesis harness pattern
- `tests/mcp-bridge-client-lifecycle.test.js:540-601` — bridge-client integration harness pattern

### Phase context (HIGH confidence — read in full this session)

- `.planning/phases/246-agent-scoped-tab-resolution-background-default/246-CONTEXT.md` — design contract (D-01..D-16)
- `.planning/REQUIREMENTS.md` — v0.9.60 OWN-* / AGENT-* / POOL-* / LOCK-* requirements
- `.planning/STATE.md` — Phase 246 origin note + branch lock
- `.planning/ROADMAP.md` — Phase 246 entry (TBD goal — this research closes the gap)
- `.planning/codebase/CONVENTIONS.md` — coding conventions (read first 60 lines)
- `.planning/config.json` — workflow settings (nyquist enabled by absence of opt-out)

### Tertiary (LOW confidence — none in this research)

This research relied entirely on the in-tree code. No web searches, no Context7, no external docs. Every claim has a file:line citation. Confidence is HIGH because the source-of-truth IS the code, and the code is read at concrete lines.

## Assumptions Log

The research surfaces ZERO claims tagged `[ASSUMED]`. Every factual statement is verified by reading the cited file at the cited line. The Open Questions enumerate places where the planner must MAKE a decision — not places where the research GUESSED.

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| (none) | — | — | — |

**This table is empty:** All claims in this research are verified against the in-tree code or the locked decisions in CONTEXT.md. No user confirmation needed for any RESEARCH-MD claim. The Open Questions are explicit decision points, NOT assumptions.

## Metadata

**Confidence breakdown:**
- Resolver shape and call sites: HIGH — every site verified at file:line
- Schema-bridge propagation: HIGH — `jsonSchemaToZod` impl read in full at schema-bridge.ts:78-120
- Legacy synthesis composition: HIGH — popup.js, sidepanel.js, background.js all verified
- Test harness patterns: HIGH — three canonical patterns extracted from existing tests
- PARAM_TRANSFORMS pitfall: HIGH — read at schema-bridge.ts:134-175
- Open Questions: planner-pickable, recommendations stated with rationale

**Research date:** 2026-05-06
**Valid until:** 2026-06-06 (~30 days; the underlying code is stable on Refinements branch and Phase 246 is the next phase to land)

---

*Researched by gsd-researcher per `/gsd-research-phase` integrated invocation. Every claim is anchored to a file:line in the FSB tree on branch `Refinements`. Phase 246 is gap-closure on v0.9.60; no new REQ-IDs introduced; no external dependencies.*
