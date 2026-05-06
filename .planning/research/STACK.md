# Stack Research -- v0.9.60 Multi-Agent Tab Concurrency

**Domain:** Chrome MV3 extension + npm-published TypeScript MCP server (`fsb-mcp-server@0.7.4` -> `0.8.0`)
**Researched:** 2026-05-05
**Scope:** Stack ADDITIONS for multi-agent tab ownership, hard concurrency cap (8), forced-new-tab pooling, lock release on disconnect/close, new `back` MCP tool, and `run_task` return-on-completion (Phase 236)
**Confidence:** HIGH on existing-stack assessment and Chrome MV3 / MCP SDK patterns; MEDIUM on specific minor versions (web-verified, not Context7-verified)

> NOTE: This file SUPERSEDES the previous v0.9.46 STACK.md content for the v0.9.60 milestone. The earlier site-discoverability research is preserved in the milestone archive.

---

## TL;DR

For v0.9.60 the FSB stack does NOT need a new build system, transpiler, or heavy concurrency framework. Every NEW capability can be implemented with:

1. Already-installed dependencies (`@modelcontextprotocol/sdk`, `ws`, `zod`, `chrome.*` APIs).
2. Node built-ins on the MCP-server side (`crypto.randomUUID`, `AbortController`, `Promise`-based primitives).
3. Hand-rolled in-memory data structures in the extension service worker (Maps + storage rehydrate), mirroring the existing `activeSessions` / `MCP_VISUAL_SESSION_STORAGE_KEY` pattern.

The only real choice is the agent-id format. Recommendation: **`crypto.randomUUID()` everywhere**, prefixed with a short type tag (`agent_<uuidv4>`, `task_<uuidv4>`).

Phase 236 ("`run_task` returns on completion, no 300s ceiling") is a **bridge-level change**, not a tool-schema change -- we keep using MCP `notifications/progress` over the existing stdio transport. The MCP TypeScript SDK already supports unbounded long-running tools; the 300s ceiling in `mcp/src/tools/autopilot.ts:58` (`{ timeout: 300_000 }`) is purely an FSB-internal bridge timeout, not a protocol constraint.

---

## Current Stack (Validated, DO NOT Re-Research)

### MCP server (`mcp/package.json`)

| Dep | Current version | Status |
|-----|-----------------|--------|
| `@modelcontextprotocol/sdk` | `^1.27.1` | Bump to `^1.29.x` (latest 1.29.0, ~Apr 2026). Compatible upgrade -- progress-notification API unchanged. |
| `ws` | `^8.19.0` | Keep. |
| `zod` | `^3.24.0` | Keep on Zod 3 (see "What NOT to Use" below). |
| `strip-json-comments` | `^5.0.3` | Keep (installer flow). |
| `smol-toml` | `^1.6.1` | Keep (Codex/Claude TOML configs). |
| `yaml` | `^2.8.3` | Keep (Continue config). |
| `typescript` | `^5.9.3` (dev) | Keep. |
| `tsx` | `^4.19.0` (dev) | Keep. |
| `@types/node` | `^22.0.0` (dev) | Keep. |
| `@types/ws` | `^8.18.1` (dev) | Keep. |

### Extension (`extension/manifest.json`)

| Permission | Already granted? | Used for v0.9.60? |
|------------|------------------|-------------------|
| `tabs` | YES | Required for `chrome.tabs.create`, `onRemoved`, `onUpdated`. |
| `windows` | YES | Required for `chrome.windows.onRemoved` (last-tab-of-window edge case). |
| `storage` | YES | Required for agent-registry rehydrate after SW idle eviction. |
| `alarms` | YES | Useful for periodic stale-agent reaper. |
| `webNavigation` | YES | Already used for nav lifecycle observation. |
| `debugger` | YES | Already used for CDP click/scroll. |
| `sidePanel`, `scripting`, `activeTab`, `host_permissions: <all_urls>`, `unlimitedStorage`, `clipboardWrite`, `offscreen` | YES | Unchanged. |

**No new manifest permissions required for v0.9.60.** This is a significant constraint check -- adding new permissions would force a Web Store re-review and break the "load unpacked" dev loop the team relies on.

---

## NEW Capabilities -- What Each Requires

### 1. Per-session/task agent identity

**What:** One MCP client (e.g. Claude) may spawn multiple parallel agents simultaneously. Each gets its own `agent_id` distinct from the trusted client label.

**Recommendation:**

| Choice | Recommendation | Rationale |
|--------|---------------|-----------|
| ID format | `crypto.randomUUID()` with prefix: `agent_<uuid>`, `task_<uuid>` | Built into Node 18+ AND Chrome MV3 service workers (no polyfill). ~3-12x faster than the `uuid` npm package. Zero new dependencies. Sufficient entropy for an 8-cap registry. |
| Length | 36 chars (UUID v4) + 6 prefix = 42 chars | Fine for logs/badges; we are not putting these in URLs. |
| Sortability | NOT required | We have at most 8 entries; lookup is by exact key. |

**Reject:** `ulid`, `nanoid`, `uuid` packages -- pure new deps for a problem `crypto.randomUUID` already solves. ULID's lex-sortability is irrelevant at N=8.

**Reject:** Reusing the MCP client label as the agent id. Multiple agents per client is exactly what this milestone enables.

### 2. Tab ownership table (`tab_id -> agent_id`) + hard cap of 8

**What:** Any tab that an agent opens gets a single owner. Cross-agent access to that tab is rejected. Total live agents capped at 8.

**Recommendation -- in-memory Map mirroring `activeSessions`:**

```js
// extension/background.js (vanilla JS, no build step)
const tabOwnership = new Map();   // tabId (number) -> agentId (string)
const agentRegistry = new Map();  // agentId -> { mcpClientLabel, taskId, tabIds:Set, createdAt, ... }

const AGENT_CAP = 8;
const AGENT_REGISTRY_STORAGE_KEY = 'fsbAgentRegistry'; // chrome.storage.session
```

**Persistence pattern:** Use `chrome.storage.session` (in-memory, cleared on browser restart) for rehydrate-after-SW-idle, exactly like `MCP_VISUAL_SESSION_STORAGE_KEY` already does (background.js:2053). Do NOT use `chrome.storage.local` -- agent state should not survive a browser restart; the MCP client will be gone anyway.

**Why in-memory Map is sufficient (no Mutex/Semaphore needed):**

The "concurrency" in MV3 service workers is event-handler-level cooperative scheduling, not real OS-level threading. Multiple `chrome.runtime.onMessage` callbacks can be in-flight concurrently in async code, but JavaScript single-threaded execution between awaits means a check-then-set against a `Map` is atomic if you do it within a single synchronous slice. The dangerous case is:

```js
// BUGGY -- await between read and write
if (tabOwnership.size >= AGENT_CAP) return error; // read
await someAsyncCall();                              // YIELD POINT
tabOwnership.set(tabId, agentId);                   // write -- another handler may have set already
```

**Mitigation:** Do all cap-check + insert in one synchronous slice before any `await`. This is a pattern, not a library. If we ever need a real lock, the existing `extension/ws/ws-client.js` already uses Promise-chain serialization; we can reuse that idiom (a single `pendingTransition` Promise) without adding a library.

### 3. Lock release on tab close / window close / MCP disconnect

**What:** Tab ownership must release when (a) user closes the tab, (b) user closes the last window containing the tab, (c) MCP client disconnects, (d) task ends, (e) session ends.

**Chrome MV3 APIs (already available, no new permissions):**

| Event | Use For | Caveat |
|-------|---------|--------|
| `chrome.tabs.onRemoved(tabId, removeInfo)` | Primary release on user close | Already wired at background.js:2455 -- extend it to clean `tabOwnership` AND notify `agentRegistry`. `removeInfo.isWindowClosing === true` indicates the whole window is going away. |
| `chrome.windows.onRemoved(windowId)` | Belt-and-suspenders for last-tab-of-window | Fires AFTER `tabs.onRemoved` for each contained tab. Useful for sweeping orphan agent state if a race happens. |
| `chrome.tabs.onUpdated(tabId, changeInfo)` | NOT for ownership release | `changeInfo.discarded` and `status === 'unloaded'` do NOT mean user closed the tab; do not release ownership on these. |
| `chrome.tabs.onCreated` | Forced-new-tab pooling | When an owning agent does an action that opens a tab (target=_blank, `window.open`, `noopener` link), the new tab's `openerTabId` resolves to a tab the agent owns -- pool the new tab under the same agent. |

**MCP-disconnect release:** The MCP TypeScript SDK exposes connection lifecycle via the transport. For stdio (`StdioServerTransport`), a parent-process death closes stdin and the SDK emits a transport-close event. Hook `runtime.server.transport.onclose` (or equivalent in 1.29) and broadcast a `mcp:client-disconnected` message to the extension over the WebSocket bridge, which then sweeps every agent owned by that MCP connection.

**For the WebSocket bridge layer (`mcp/src/bridge.ts`):** the existing `WebSocketBridge` already tracks heartbeat / disconnect (background.js heartbeat handling at line ~570). Extend the disconnect handler to send a `bridge:disconnect` payload that triggers agent sweep on the extension side.

### 4. Forced-new-tab pooling

**What:** If an agent's owned tab opens another tab (via JS `window.open`, target=_blank link, etc.), the new tab is automatically pooled under the same agent.

**Recommendation:** `chrome.tabs.onCreated` listener that checks `tab.openerTabId`:

```js
chrome.tabs.onCreated.addListener((tab) => {
  const openerOwner = tab.openerTabId ? tabOwnership.get(tab.openerTabId) : null;
  if (!openerOwner) return; // human-opened or not under an agent
  // Pool the new tab under the same agent (does NOT count against the 8-agent cap; cap is on agents, not tabs)
  tabOwnership.set(tab.id, openerOwner);
  agentRegistry.get(openerOwner)?.tabIds.add(tab.id);
});
```

**Caveat:** `openerTabId` is missing for some auto-opens (PDFs, devtools, some service-worker-initiated tabs). Document this in PITFALLS.md as an accepted gap rather than wiring an exotic detection layer.

### 5. New `back` MCP tool

**What:** Browser back-button equivalent.

**Recommendation:** New MCP tool in `mcp/src/tools/manual.ts` (existing manual-tool registration), implemented on the extension side via `chrome.tabs.goBack(tabId)`. Zero new dependencies.

```ts
server.tool(
  'back',
  'Navigate the active (or specified) tab back one entry in its history.',
  { tab_id: z.number().int().optional() },
  async ({ tab_id }) => { /* bridge.sendAndWait('mcp:tab-back', { tabId: tab_id }) */ },
);
```

`chrome.tabs.goBack` is already available under the existing `tabs` permission.

### 6. Phase 236: `run_task` returns on completion, no 300s ceiling

**What:** Currently `mcp/src/tools/autopilot.ts:58` hard-codes `{ timeout: 300_000 }` on the bridge call. Long tasks (e.g. multi-step automation, 5+ minute flows) hit this ceiling and the tool returns prematurely while the extension keeps running.

**Recommendation:** **No new library.** The fix is a 2-line change.

```ts
// Before
const result = await bridge.sendAndWait(
  { type: 'mcp:start-automation', payload: { task } },
  { timeout: 300_000, onProgress },
);

// After
const result = await bridge.sendAndWait(
  { type: 'mcp:start-automation', payload: { task } },
  { timeout: null, onProgress }, // or Number.POSITIVE_INFINITY -- whichever bridge.ts already accepts
);
```

The MCP protocol already supports unbounded long-running tools as long as the server keeps the connection alive and (optionally) sends `notifications/progress`. The existing `onProgress -> extra.sendNotification({ method: 'notifications/progress', ... })` plumbing in `autopilot.ts:36-46` already does exactly that, so MCP clients see continuous progress and don't time out at the protocol layer. The 300s ceiling was an internal safety net that's no longer wanted.

**Bridge-side prerequisite:** Audit `mcp/src/bridge.ts` `sendAndWait` to ensure `timeout: null` (or `0`, or omitted) means "wait forever" rather than "use a default". If it currently coerces null to a default, that's the fix. (LOW confidence on the current behavior without reading bridge.ts in full.)

**Cancellation safety:** The `stop_task` tool already exists; combined with MCP `$/cancelRequest`, an unbounded `run_task` is cancelable from the client side. No new cancellation library needed.

### 7. Background-tab execution (no foregrounding required)

**What:** An owning agent's tab does NOT need to be `active: true` (foregrounded) to receive actions.

**Existing capability:** FSB already does this. `chrome.scripting.executeScript` and CDP attach work on any tab the extension has access to under `<all_urls>`. No code change needed beyond making sure FSB never calls `chrome.tabs.update(tabId, { active: true })` as a precondition for action execution. **Audit, don't add.**

---

## Library Choices Summary

### Add (npm)

| Library | Version | Where | Purpose | Why this and not alternatives |
|---------|---------|-------|---------|-------------------------------|
| (none) | -- | -- | -- | -- |

**That's intentional.** Every NEW v0.9.60 capability is satisfied by existing dependencies + Chrome/Node built-ins.

### Bump (npm)

| Library | From | To | Where | Reason |
|---------|------|------|-------|--------|
| `@modelcontextprotocol/sdk` | `^1.27.1` | `^1.29.x` (latest 1.29.0) | `mcp/package.json` | Active upstream, no breaking changes for our usage (progress notifications, `server.tool`, stdio transport unchanged). Catches bug fixes since Feb 2026. |
| `fsb-mcp-server` (self) | `0.7.4` | `0.8.0` | `mcp/package.json:version`, `mcp/server.json` | Milestone deliverable. Minor bump because `back` is a NEW tool (additive) and Phase 236 changes return semantics for `run_task` (still backward compatible -- clients that didn't get a value before now do). |

### Keep as-is (npm)

`ws@^8.19.0`, `zod@^3.24.0`, `strip-json-comments@^5.0.3`, `smol-toml@^1.6.1`, `yaml@^2.8.3`, all dev deps.

### Chrome / Web Platform APIs (no install)

| API | MV3 status | Use |
|-----|-----------|-----|
| `chrome.tabs.{create, goBack, onCreated, onRemoved, onUpdated, query}` | Stable | Tab lifecycle + new `back` tool. |
| `chrome.windows.onRemoved` | Stable | Window-close sweep. |
| `chrome.storage.session` | Stable since Chrome 102 | Agent-registry rehydrate (in-memory, browser-lifetime). |
| `chrome.alarms` | Stable | Optional stale-agent reaper. |
| `crypto.randomUUID()` | Available in MV3 service workers since Chrome 92 | Agent IDs, task IDs. |
| `AbortController` | Available everywhere | Cancel in-flight bridge calls on disconnect. |

### Node built-ins (mcp server, no install)

| API | Use |
|-----|-----|
| `crypto.randomUUID()` | Same id format as extension side -- consistency. |
| `AbortController` / `AbortSignal` | If we want to cancel `bridge.sendAndWait` from disconnect handlers. |
| `process.on('SIGTERM' | 'SIGINT')` | Already wired in `index.ts:262-263` -- extend to broadcast disconnect to extension. |

---

## Integration Points With Existing v0.9.36 / v0.9.50 Surface

| Existing surface | What v0.9.60 changes |
|------------------|----------------------|
| `extension/background.js` `activeSessions` Map | Add parallel `tabOwnership` and `agentRegistry` Maps. Reuse the `chrome.storage.session` rehydrate pattern from `MCP_VISUAL_SESSION_STORAGE_KEY`. Existing `chrome.tabs.onRemoved` listener at line 2455 gains agent-cleanup branch. |
| `extension/background.js` visual-session ownership | Visual session is per-tab; agent ownership is also per-tab. **One owner per tab** invariant is preserved -- the agent-id and the visual-session client label become two views of the same ownership. Stick to: visual session is the user-facing label; agent-id is the routing key. |
| `mcp/src/bridge.ts` `sendAndWait({ timeout })` | Allow `timeout: null` for unbounded waits (Phase 236). Add disconnect-listener hooks. |
| `mcp/src/tools/autopilot.ts` `run_task` | Drop the 300_000 ceiling; keep `onProgress` notifications wiring as-is. |
| `mcp/src/tools/manual.ts` | Add `back` tool registration. |
| `mcp/src/runtime.ts` | No structural change. The `createRuntime` factory stays a one-server-instance-per-process model (stdio = one client per server). For HTTP mode (`startHttpServer`), the per-session pattern in `mcp/src/http.ts` already isolates state. |
| `mcp/server.json` + `mcp/package.json` `version` | Bump to `0.8.0`. |
| Trusted-client allowlist (`mcp/src/tools/visual-session.ts:8-11`) | Unchanged. Agent identity is finer-grained but does NOT replace client labeling. Each agent record stores `mcpClientLabel` so badges still show "Claude" / "Codex" / etc. |

---

## What NOT to Add (Explicit Non-Additions)

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `async-mutex`, `p-queue`, `p-limit`, `semaphore-async-await` | Real OS-level threading concerns don't apply to MV3 service workers. The TaskQueue in `mcp/src/queue.ts` already serializes mutation tools; the extension's single-threaded JS event loop handles intra-handler atomicity if we structure check-then-set correctly. | Existing `queue.ts` + a documented "no-await-inside-cap-check" rule. |
| `uuid` npm package | `crypto.randomUUID()` is built-in, faster, zero-deps. | `crypto.randomUUID()` everywhere. |
| `ulid`, `nanoid` | Time-sortable / shorter IDs solve a problem we don't have at N=8. | `crypto.randomUUID()`. |
| `lru-cache`, `node-cache` | At 8 entries we don't need eviction; we need explicit lifecycle. | Plain `Map`. |
| Zod 4 (`zod@^4`) | MCP SDK 1.27-1.29 is built against Zod 3 schemas (`zod/v3`). Zod 4 has breaking changes in error customization, function schemas, and object methods. Upgrading would force MCP-SDK-internal compatibility shims. | Stay on `zod@^3.24.0`. |
| TypeScript build pipeline for the extension | FSB extension is intentionally vanilla ES2021+. No `tsc`, no `esbuild`, no `vite`. The MCP server's `tsc` is the ONLY build step in the repo and that's where it stays. | Vanilla JS in `extension/`. |
| MCP "session"-level state via `Streamable HTTP` for stdio clients | Stdio is intentionally one-server-per-client. Adding session multiplexing on stdio would invent a second protocol. | Per-process server instance for stdio (current pattern); existing HTTP-mode session map in `mcp/src/http.ts` for multi-session HTTP. |
| Persistent agent registry in `chrome.storage.local` or IndexedDB | Agent state is browser-runtime-scoped. Surviving a Chrome restart is a feature only if the MCP client also restarts identically -- which is not guaranteed. | `chrome.storage.session` (cleared on browser restart). |
| Distributed locks across instances (Redis, etc.) | One Chrome instance + one extension service worker. There IS no distributed surface. | In-process Map. |
| Cancellation-token library (`abort-controller`, etc. as separate npm) | `AbortController` is global in Node 16+ and Chrome MV3. | Built-in `AbortController`. |
| Idle-timeout for agent ownership | Milestone explicitly says "no idle timeout". Locks release on task end / disconnect / tab close ONLY. | Don't write the timer. |

---

## Stack Patterns by Variant

**If MCP client is `Claude Code` / `Codex` / `Cursor` (stdio):**
- One MCP server process per client; the agent registry lives in that one extension service worker; multiple agents from the same client share the registry but have distinct `agent_id`s.

**If MCP client is over Streamable HTTP (`fsb-mcp-server serve`):**
- The HTTP server multiplexes many MCP sessions; each session can spawn many agents. The agent registry is still **single-instance** in the extension SW (one Chrome = one registry). Cap of 8 is global, not per-MCP-session. Document this in PITFALLS.

**If extension service worker is evicted mid-task:**
- Same pattern as `MCP_VISUAL_SESSION_STORAGE_KEY` rehydrate at background.js:565-584. On wakeup, read `chrome.storage.session.fsbAgentRegistry`, rebuild Maps, validate each agent's `tabId`s still exist via `chrome.tabs.get` (drop entries for closed tabs), continue.

---

## Version Compatibility

| Package | Compatible with | Notes |
|---------|-----------------|-------|
| `@modelcontextprotocol/sdk@^1.29.x` | `zod@^3.24.0` (Zod 3) | The SDK uses `zod` peerDependency `^3.x`. Do NOT bump to Zod 4. |
| `@modelcontextprotocol/sdk@^1.29.x` | Node `>=18.0.0` | Already pinned in `package.json:engines`. |
| `crypto.randomUUID()` | Node 14.17+, Chrome 92+ | Both well below MV3 minimum and our `engines.node`. |
| `chrome.storage.session` | Chrome 102+ | Already in use elsewhere in the extension. |

---

## Sources

- [npm: @modelcontextprotocol/sdk](https://www.npmjs.com/package/@modelcontextprotocol/sdk) -- HIGH (latest 1.29.0 as of ~Apr 2026)
- [GitHub: typescript-sdk releases](https://github.com/modelcontextprotocol/typescript-sdk/releases) -- HIGH
- [GitHub: typescript-sdk server.md](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/server.md) -- HIGH (progress notification pattern, `ctx.mcpReq.notify()`)
- [MCP spec: Progress (2025-03-26)](https://modelcontextprotocol.io/specification/2025-03-26/basic/utilities/progress) -- HIGH (`progressToken` semantics, no protocol timeout)
- [Chrome for Developers: chrome.tabs](https://developer.chrome.com/docs/extensions/reference/api/tabs) -- HIGH (`onCreated`, `onRemoved`, `goBack`, `openerTabId`)
- [Chrome for Developers: service worker lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle) -- HIGH (event listeners extend SW lifetime by 30s)
- [MDN: windows.onRemoved](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/windows/onRemoved) -- HIGH
- [dev.to: crypto.randomUUID is 3x faster than uuid.v4](https://dev.to/galkin/crypto-randomuuid-vs-uuid-v4-47i5) -- MEDIUM (perf claim, multi-source-confirmed)
- [Zod v4 release notes](https://zod.dev/v4) and [Zod v4 migration](https://zod.dev/v4/changelog) -- HIGH (breaking changes; reason to stay on Zod 3 with MCP SDK)
- [GitHub issue: Latest Zod3 now includes Zod4 ... breaking changes](https://github.com/colinhacks/zod/issues/4923) -- MEDIUM (compatibility nuance)
- Local file: `extension/manifest.json` -- HIGH (permissions audit, no new permissions required)
- Local file: `mcp/package.json` -- HIGH (current dependency baseline)
- Local file: `mcp/src/tools/autopilot.ts` -- HIGH (300s ceiling located at line 58, on-progress wiring at lines 36-46)
- Local file: `mcp/src/runtime.ts` + `mcp/src/queue.ts` -- HIGH (existing serialization model)
- Local file: `extension/background.js` -- HIGH (existing `activeSessions`, `chrome.tabs.onRemoved`, `MCP_VISUAL_SESSION_STORAGE_KEY` rehydrate at lines 565-584, 2053, 2455)

---

*Stack research for: v0.9.60 Multi-Agent Tab Concurrency (MCP 0.8.0)*
*Researched: 2026-05-05*
