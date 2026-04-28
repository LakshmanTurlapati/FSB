# Phase 212: Background Agents Sunset - Context

**Gathered:** 2026-04-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Retire the background-agents feature in favor of OpenClaw / Claude Routines via:
- A playful deprecation card replacing the Background Agents tab body in the FSB control panel.
- Comment-out (not delete) of every agent-only code path with `// DEPRECATED v0.9.45rc1: superseded by OpenClaw / Claude Routines -- see PROJECT.md` annotation.
- Mirrored agent-sunset messaging on the showcase home + dashboard surfaces.
- Preservation of shared utilities, `chrome.storage.local['bgAgents']` data, and `chrome.alarms.onAlarm` listener structure (especially the `MCP_RECONNECT_ALARM` early-return).

In scope: AGENTS-01 through AGENTS-06 (6 requirements).

NO UI button for `exportDiagnostics` is touched here -- that's Phase 213's Sync tab.

</domain>

<decisions>
## Implementation Decisions

### Plan split (3 parallel-safe plans, single wave)

- **D-01:** Phase 212 decomposes into 3 plans that all run in parallel in a single executor wave (Phase 211 used the same shape successfully):
  - **212-01: Back-end comment-out + deprecation gate** -- block-comment the 4 `agents/*.js` files + `mcp-server/src/tools/agents.ts`; comment out import/call sites in `background.js` (importScripts at ~line 162 area, message router cases ~5586-5752, agent alarm branch within the listener while preserving `MCP_RECONNECT_ALARM` early-return at lines 12572-12580 verbatim, rescheduleAllAgents calls at startup), `ws/ws-client.js` (`case 'dash:agent-run-now'` + `_handleAgentRunNow` method), and `mcp-server/src/runtime.ts` (`registerAgentTools` import + call at lines 10/35). Deprecation gate constant lives somewhere reachable from background.js. Delivers AGENTS-02 (back-end portion) + AGENTS-06 (`MCP_RECONNECT_ALARM` preservation regression test) + part of AGENTS-05 (storage preservation -- explicit "no delete" test).
  - **212-02: Control panel deprecation card + sunset notice + slash-command commenting** -- replace `#background-agents` section body in `ui/control_panel.html` with the playful deprecation card + a one-time dismissible "Your previous agents" names list (read from `chrome.storage.local['bgAgents']`); comment out `ui/options.js` agent UI controllers (`showAgentForm`, `saveAgent`, `loadAgentList`, `renderAgentCard`, `loadAgentStats`, `toggleAgent`, etc. -- but NOT the pairing/Server Sync wiring at lines 4189-4205 which moves to Phase 213); comment out `/agent` slash command in `ui/sidepanel.js` and `ui/popup.js`. Delivers AGENTS-01, AGENTS-02 (UI portion), AGENTS-03.
  - **212-03: Showcase mirror** -- replace agent feature card in `showcase/angular/.../home-page.component.html` with sunset/relocation messaging pointing at OpenClaw + Claude Routines; replace `#dash-agent-container` block in `showcase/dashboard.html` (vanilla) and the parallel block in `showcase/angular/.../dashboard-page.component.html` (Angular) with a single sunset card; block-comment agent-related contiguous blocks in `showcase/js/dashboard.js` (~226 hits) and `showcase/angular/.../dashboard-page.component.ts` (~221 hits) -- PRESERVE `ext:remote-control-state` consumers and `_lz` decompression paths intact. Delivers AGENTS-04.

  **File-overlap note:** The three plans are file-disjoint (back-end / control_panel / showcase). 212-02 reads `bgAgents` from `chrome.storage.local` for the names list -- this is read-only access, doesn't conflict with 212-01's storage-preserving comment-outs. Single executor wave; sequential dispatch (Phase 211 pattern) handles incidental ordering.

### Deprecation card design + copy

- **D-02:** Single permanent card replaces the `#background-agents` section body. The Background Agents nav-item itself stays visible (so users with muscle memory find the explanation). Once ecosystem migration settles in v0.9.50+, the nav-item can be removed.
- **D-03:** **One canonical playful tagline** (no rotating taglines). Claude drafts the exact copy at plan time; user can review and tweak in the PR. Tone: dry, witty, founder-style -- "we're not reinventing this wheel" energy. NOT defensive or mournful.
- **D-04:** Card structure: headline + body paragraph + two named CTA buttons side-by-side -- "Try OpenClaw" and "Try Claude Routines" -- both `target="_blank" rel="noopener"`. Optional muted footer: `Retired in v0.9.45rc1 (April 2026)`.
- **D-05:** Card is NOT dismissible. The card IS the section body permanently.
- **D-06:** No emojis in the card copy (per CLAUDE.md project rule).

### `fsb_sunset_notice` (one-time names list)

- **D-07:** Surfaced ONLY inside the Background Agents tab body in `ui/control_panel.html` -- BELOW the deprecation card. NOT a first-launch modal. NOT a popup or sidepanel notice. Single surface, single instrumentation point.
- **D-08:** Renders the user's previously-created agent NAMES (the `name` property of each `bgAgents` entry). NOTHING ELSE -- no task text, no schedule, no run history, no tags. Names-only avoids leaking credentials or sensitive prompt content per PITFALLS.md P11.
- **D-09:** Dismissibility: an explicit "Got it" button (or X) sets `chrome.storage.local.fsb_sunset_notice_dismissed = true`. Once dismissed, the names list never re-renders (the deprecation card above remains permanently per D-05).
- **D-10:** Skip rendering the names list entirely if `bgAgents` is missing or empty (no agents were ever created on this profile). The deprecation card alone is sufficient.
- **D-11:** NO clipboard export, NO download button, NO copy-to-clipboard affordance. The names are displayed for assurance ("your work isn't lost"), not for migration.
- **D-12:** Read-only access to `chrome.storage.local['bgAgents']`. The data is preserved untouched per AGENTS-05.

### Comment-out style

- **D-13:** Block-comment `/* ... */` style for the 5 agent-only source files: `agents/agent-manager.js`, `agents/agent-scheduler.js`, `agents/agent-executor.js`, `agents/server-sync.js`, `mcp-server/src/tools/agents.ts`. Annotation lives ABOVE the block comment as a single `// DEPRECATED v0.9.45rc1: superseded by OpenClaw / Claude Routines -- see PROJECT.md` line, then `/*` on next line, original body, `*/` on last line. File must remain valid JS/TS (parseable but inert).
- **D-14:** **Pre-flight check before block-commenting any file:** scan for `*/` in the file body. If found, fall back to every-line `//` prefix for that file (block comments cannot nest). Document this fallback per-file in the SUMMARY.
- **D-15:** For partial commenting (entry points inside shared files like `background.js`, `ws/ws-client.js`, `mcp-server/src/runtime.ts`, `ui/options.js`, `ui/sidepanel.js`, `ui/popup.js`, `showcase/js/dashboard.js`, `showcase/angular/.../dashboard-page.component.ts`), block-comment contiguous agent-related sections with the same annotation style. Preserve all non-agent code untouched.

### MCP tool surface

- **D-16:** Approach: comment out **individual `registerTool(...)` calls inside `registerAgentTools(...)` function**. Keep the `registerAgentTools` function shell + its import in `mcp-server/src/runtime.ts` -- the call still executes but registers no tools. External MCP clients (Claude Desktop, Codex, OpenCode) see ZERO agent tools, not "tools that error" (the AGENTS-FUTURE-02 structured deprecation responses path is explicitly deferred).
- **D-17:** Each commented `registerTool(...)` call gets the `// DEPRECATED v0.9.45rc1: ...` annotation directly above it.

### Showcase Angular handling

- **D-18:** `showcase/angular/.../dashboard-page.component.ts` (~221 agent refs) and `showcase/js/dashboard.js` (~226 agent refs): block-comment the agent-related contiguous method/state blocks. Each block gets a `// DEPRECATED v0.9.45rc1: ...` annotation above its `/* ... */` wrapper. Component flag (`isAgentsRetired = true`) approach explicitly rejected -- leaves cognitive dead-code load.
- **D-19:** `ext:remote-control-state` event consumers and `_lz` decompression code paths in `dashboard-page.component.ts:3204-3205, 3386` and `dashboard.js:3517-3528, 3811` MUST stay live and untouched. Verify via `git diff` that those line ranges are unchanged.

### Shared-utility preservation (regression-tested)

- **D-20:** `MCP_RECONNECT_ALARM` early-return path in `background.js` -- now at lines 12572-12580 after Phase 211's line shifts -- is preserved BYTE-FOR-BYTE. 212-01's plan must include a regression test that asserts this exact byte range is unchanged after the agent alarm branch is commented.
- **D-21:** `chrome.storage.local['bgAgents']` data is NOT proactively cleaned (AGENTS-05). 212-01's plan must include an explicit no-op test that asserts the storage key still exists after `chrome.runtime.onInstalled` (reason=update) fires (no cleanup logic added).
- **D-22:** `fsb_agent_*` `chrome.alarms` entries are NOT proactively cleaned (AGENTS-FUTURE-01 deferred). Same no-op test posture: assert no `chrome.alarms.clear(...)` is called for the `fsb_agent_*` prefix.
- **D-23:** Shared utilities consumed by agent code AND non-agent code (e.g. `activeSessions` Map, `chrome.runtime.sendMessage({action:'startAutomation'})`, `serverUrl`/`serverHashKey` storage keys, the shared `chrome.alarms.onAlarm` listener structure, `_streamingTabId`, `_dashboardTaskTabId`) MUST stay live. The `agents/server-sync.js` file is fully commented but the `serverUrl`/`serverHashKey` keys remain untouched (used by `ws-client.js` auto-register and dashboard pairing).

### Cross-plan coordination

- **D-24:** No file overlap across plans -- 212-01 (back-end) / 212-02 (control panel) / 212-03 (showcase) are file-disjoint. The single shared file is `package.json` (test scripts append-only, last-writer-wins is a no-op merge).
- **D-25:** All three plans land in `wave: 1` with `depends_on: []`. Sequential dispatch (Phase 211 pattern) ensures any incidental ordering completes correctly.

### Logging the deprecation gate (optional, planner discretion)

- **D-26:** Phase 211 shipped `redactForLog`, layered prefixes, and the ring buffer. If 212-01's deprecation gate fires (e.g. someone sends `chrome.runtime.sendMessage({action:'createAgent'})` post-deprecation), it MAY log via `[FSB BG] agent action received post-deprecation` at debug level into the ring buffer. Optional polish; planner decides. Must NOT trigger user-visible warnings (no `console.warn` flooding from extensions that still send agent messages).

### Claude's Discretion

- **The exact deprecation card tagline + body copy** -- Claude drafts at plan time; user reviews in PR. Tone: dry, witty, founder-style "we're not reinventing this wheel". No emojis. No melodrama. ~30-50 words headline+body.
- **Visual treatment** of the names list (table vs simple `<ul>` vs comma-separated text) -- planner picks based on existing options.css conventions.
- **The exact set of additional `console.warn` annotations** for shared-file partial comment-outs (e.g., should `_handleAgentRunNow` log `[FSB WS] agent run dropped post-deprecation` before returning?). Planner decides.
- **The exact set of regression tests** for AGENTS-05 / AGENTS-06 -- but at minimum: (a) `MCP_RECONNECT_ALARM` byte-for-byte preservation test, (b) `bgAgents` storage preservation test, (c) post-update no `chrome.alarms.clear` test for `fsb_agent_*` prefix.
- **The Angular component refactor strategy** beyond block-commenting (e.g., should DI-injected agent services be replaced with no-op stubs to avoid runtime errors when a stale event references them?). Planner reads the file and decides.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone & phase docs
- `.planning/PROJECT.md` -- core value, current milestone, decisions log (Background agents sunset rationale)
- `.planning/REQUIREMENTS.md` -- 6 reqs in scope: AGENTS-01 through AGENTS-06; deferred AGENTS-FUTURE-01 + AGENTS-FUTURE-02
- `.planning/ROADMAP.md` §Phase 212 -- goal, success criteria, dependencies
- `.planning/MILESTONES.md` -- v0.9.40 silent-task-abandonment fix sets the diagnostic-logging precedent that 212-01's optional deprecation-gate logs follow

### Research artifacts (this milestone)
- `.planning/research/SUMMARY.md` §Background Agents Sunset -- cross-cutting decisions, "comment, don't delete", `bgAgents` preservation
- `.planning/research/ARCHITECTURE.md` §(b) Background-Agent Dependency Graph -- exact file inventory, SAFE-TO-COMMENT vs SHARED-DO-NOT-TOUCH lists, line ranges for shared-file entry points
- `.planning/research/PITFALLS.md` P2/P3/P11 -- zombie handlers, storage preservation, fsb_sunset_notice content scope (NAMES only)

### Phase 211 artifacts (just-shipped, line-shifts apply)
- `.planning/phases/211-stream-reliability-diagnostic-logging/211-CONTEXT.md` D-15 -- `MCP_RECONNECT_ALARM` early-return preservation precedent
- `.planning/phases/211-stream-reliability-diagnostic-logging/211-02-SUMMARY.md` -- post-211-02 line offsets in `background.js` (alarm listener now starts at line 12559, MCP early-return at 12572-12580, agent branch at ~12586+)
- `.planning/phases/211-stream-reliability-diagnostic-logging/211-03-SUMMARY.md` -- `redactForLog`, ring buffer, layered prefixes available for 212-01's optional gate logging

### FSB code paths in scope (back-end)
- `agents/agent-manager.js` -- whole file block-comment
- `agents/agent-scheduler.js` -- whole file block-comment (alarm prefix `'fsb_agent_'`)
- `agents/agent-executor.js` -- whole file block-comment
- `agents/server-sync.js` -- whole file block-comment
- `mcp-server/src/tools/agents.ts` -- whole file block-comment
- `background.js:160-163` -- importScripts of agent files (comment lines 160-163)
- `background.js:5586-5752` -- agent message router cases (whole switch block)
- `background.js:12559-12609` (post-211 line offsets) -- alarm listener: PRESERVE `MCP_RECONNECT_ALARM` early-return at 12572-12580 byte-for-byte; comment the agent branch at ~12586+
- `background.js:12634, 12652` (or post-211 equivalents) -- `agentScheduler.rescheduleAllAgents()` calls in `runtime.onInstalled` and `runtime.onStartup`
- `ws/ws-client.js:934-936` -- `case 'dash:agent-run-now'`
- `ws/ws-client.js:1181-1203` -- `_handleAgentRunNow(payload)` method
- `mcp-server/src/runtime.ts:10, 35` -- `import { registerAgentTools }` + the call inside the registration function

### FSB code paths in scope (UI control panel)
- `ui/control_panel.html:62-65` -- `<li class="nav-item" data-section="background-agents">` (keep visible, don't hide)
- `ui/control_panel.html:563-697` -- `<section id="background-agents">` body to replace with deprecation card + names list (NOT including 700-748 Server Sync card -- that moves to Phase 213)
- `ui/options.js:4222-4665` -- agent UI controllers (`showAgentForm`, `saveAgent`, `loadAgentList`, `renderAgentCard`, `loadAgentStats`, `toggleAgent`, etc.) to comment out
- `ui/options.js:4189-4205` -- pairing/Server Sync wiring -- DO NOT TOUCH; Phase 213 relocates this
- `ui/sidepanel.js:378-379, 1928-2013` -- `/agent` slash command branch + handlers
- `ui/popup.js:203-204, 846-930` -- same slash-command pattern

### FSB code paths in scope (showcase mirror)
- `showcase/angular/.../home-page.component.html:60-63` -- Background Agents feature card (replace with sunset)
- `showcase/dashboard.html:67, 99-181, 252, 278-435` -- vanilla dashboard agent UI (replace `#dash-agent-container` block)
- `showcase/js/dashboard.js` -- ~226 agent-related references (block-comment contiguous blocks)
- `showcase/angular/.../dashboard-page.component.html:8, 40-181, 252, 278-435` -- Angular agent UI mirror
- `showcase/angular/.../dashboard-page.component.ts` -- ~221 agent refs (block-comment contiguous blocks)

### FSB code paths to leave alone (downstream consumers)
- `dashboard-page.component.ts:3204-3205, 3386` and `dashboard.js:3517-3528, 3811` -- `_lz` decompression + `ext:remote-control-state` consumers (Phase 209 + 211 contracts)
- `tests/dashboard-runtime-state.test.js`, `tests/remote-control-handlers.test.js`, `tests/qr-pairing.test.js` -- existing contracts that already cover non-agent paths (do not break)
- `chrome.storage.local['bgAgents']` -- AGENTS-05 preservation
- `chrome.alarms` `fsb_agent_*` entries -- AGENTS-FUTURE-01 deferred
- `_streamingTabId`, `_dashboardTaskTabId`, `activeSessions` Map -- shared, no agent-specific code touches them

### CLAUDE.md project rules
- NO emojis in code, comments, log messages, or docs
- No build system additions
- No auto-run of applications

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`redactForLog`, layered prefixes, ring buffer** (Phase 211, `utils/redactForLog.js` + `utils/diagnostics-ring-buffer.js`) -- available for optional deprecation-gate logging per D-26.
- **`chrome.storage.local`** -- canonical key-value store. New key `fsb_sunset_notice_dismissed: boolean`. Read-only access to existing `bgAgents` for the names list.
- **Existing `<li class="nav-item" data-section="X">` + `<section class="content-section" id="X">` pattern** in `ui/control_panel.html` -- reuse for the deprecation card. No framework, no template engine.
- **Existing `purify.min.js`** in `lib/` -- for sanitizing the agent NAMES before rendering them in the names list (defensive — agent names came from user input).
- **Phase 211's pre-existing 7-test failures in `tests/runtime-contracts.test.js`** -- documented in `deferred-items.md` as pre-existing on main. 212's regression tests should not flag these as new failures.

### Established Patterns
- **`// DEPRECATED v0.9.45rc1: superseded by OpenClaw / Claude Routines -- see PROJECT.md`** annotation -- the canonical comment form. Use VERBATIM.
- **Block-comment `/* ... */` for whole-file commenting** -- pre-flight scan for `*/` first; fall back to per-line `//` if found.
- **Sequential dispatch within a wave** (Phase 211 pattern) -- ensures incidental file ordering completes correctly even when plans share files (we don't here, but the pattern is the safety net).
- **CLAUDE.md no-emojis rule** -- enforced via spot-check grep at executor commit time.

### Integration Points
- **Background Agents nav-item** (`ui/control_panel.html:62-65`) stays visible; clicking it now reveals the deprecation card.
- **`bgAgents` storage** is read-only for the names list query in 212-02. Never written, never cleared.
- **`chrome.runtime.onMessage`** in `background.js` -- agent action cases stay registered but are commented bodies (the dispatch logic at the case level is what's commented; the switch's case label may stay or go depending on whether removing it triggers ESLint complaints).
- **MCP `registerAgentTools(...)` call** at `mcp-server/src/runtime.ts:35` stays present; only the inner `registerTool(...)` calls are commented.
- **Showcase Angular routes** (`app.routes.ts`) and shell nav (`showcase-shell.component.html`) are CLEAN of agent references per Architecture research -- no nav-level changes needed.

</code_context>

<specifics>
## Specific Ideas

- The deprecation card MUST NOT use emojis (CLAUDE.md). Tone is dry, witty, founder-style. No exclamation points unless they truly punch.
- `target="_blank" rel="noopener noreferrer"` on both CTA buttons -- standard web hygiene.
- The "Retired in v0.9.45rc1 (April 2026)" footer is `<small>` muted-color. Functional, not decorative.
- The `fsb_sunset_notice_dismissed` flag is a single boolean in `chrome.storage.local`. Default falsy. Set to `true` once. Never reset.
- Agent NAMES rendering: defensively sanitize via `purify` (already in lib) or `textContent` assignment (NEVER `innerHTML`). Agent names came from user input -- treat as untrusted.
- Block comment scan: a single byte sequence `*/` anywhere in the file body forces fallback to per-line `//`. The executor MUST grep before committing.
- After phase 212 lands, the FSB control panel will have:
  - Background Agents nav-item still visible
  - Clicking it shows: deprecation card (permanent) + names list (one-time dismissible) below it
  - All other tabs unaffected
- Deferred but-flagged risk: zombie alarm handlers from existing `fsb_agent_*` alarms in installed extensions will fire post-update with no handler. The agent branch in the alarm listener is commented but the alarm itself still exists in `chrome.alarms`. AGENTS-FUTURE-01 (one-time cleanup) is the proper fix; for now, the commented branch returns silently.

</specifics>

<deferred>
## Deferred Ideas

None added during this discussion. Items already deferred at the milestone level:

- **AGENTS-FUTURE-01**: One-time `chrome.alarms.getAll()` cleanup of `fsb_agent_*` alarms on `chrome.runtime.onInstalled` (reason=update). Phase 212's commented agent alarm branch returns silently if these fire; full cleanup is a v0.9.46 task.
- **AGENTS-FUTURE-02**: MCP agent tools return structured `{ ok: false, deprecated: true, message: '...' }` payloads. Phase 212 commits to "tools register no-op" instead -- external MCP clients see zero agent tools, not deprecated-error responses.

Considered and explicitly rejected during this discussion:
- First-launch modal for the sunset notice -- replaced with in-tab placement (D-07).
- Copy-to-clipboard / JSON export of agent names -- dropped (D-11).
- Component flag `isAgentsRetired = true` for Angular -- dropped in favor of block-commenting agent blocks (D-18).
- Rotating taglines -- dropped in favor of one canonical tagline (D-03).
- Dismissible deprecation card -- dropped in favor of permanent card (D-05).
- Three-tagline rotation -- dropped (D-03).

</deferred>

---

*Phase: 212-background-agents-sunset*
*Context gathered: 2026-04-28*
