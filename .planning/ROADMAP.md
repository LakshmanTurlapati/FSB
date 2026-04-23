# Roadmap: FSB (Full Self-Browsing)

## Active Milestone: v0.9.35 MCP Plug-and-Play Reliability

## Phases

- [x] **Phase 198: MCP Bridge Lifecycle & Reconnect State** - Make extension/server attachment recover automatically across startup order, service worker wake, and hub/relay handoff (completed 2026-04-22)
- [x] **Phase 199: MCP Tool Routing Contract** - Replace fragile background self-dispatch with direct verified route handling for browser, autopilot, observability, and restricted recovery tools (completed 2026-04-23)
- [ ] **Phase 200: Doctor, Status Watch & Recovery Messaging** - Make diagnostics identify the exact failed layer and tell users the next concrete action
- [ ] **Phase 201: Platform Installer & Config Parity** - Verify install/update behavior across Claude, Codex, OpenClaw/OpenCode-style hosts, Cursor/Windsurf, and supported config formats
- [ ] **Phase 202: Cross-Host Smoke Matrix & Release Hardening** - Prove plug-and-play behavior through automated lifecycle smoke tests and manual host UAT

## Phase Details

### Phase 198: MCP Bridge Lifecycle & Reconnect State

**Goal**: MCP connects without extension reloads whether the browser starts first, MCP host starts first, or the MV3 service worker wakes later.

**Depends on**: Nothing

**Requirements**: BRIDGE-01, BRIDGE-02, BRIDGE-03, BRIDGE-04

**Success Criteria** (what must be TRUE):
1. Starting `fsb-mcp-server` after Chrome/FSB is already open results in extension attachment without reloading the extension.
2. Starting Chrome/FSB after an MCP host is already listening attaches within a bounded reconnect window.
3. Any service worker wake path re-arms MCP bridge connection attempts and records bridge state.
4. Multiple MCP host processes keep a stable hub/relay topology and recover cleanly when the hub exits.

**Plans:** 3/3 plans complete

Plans:
- [x] 198-01-PLAN.md -- Create Wave 0 bridge lifecycle and topology tests
- [x] 198-02-PLAN.md -- Implement extension lifecycle state and wake re-arming
- [x] 198-03-PLAN.md -- Implement hub/relay topology state and diagnostics

### Phase 199: MCP Tool Routing Contract

**Goal**: Every MCP tool reaches the intended extension handler through explicit route mapping instead of accidental message-loop behavior.

**Depends on**: Phase 198

**Requirements**: ROUTE-01, ROUTE-02, ROUTE-03, ROUTE-04

**Success Criteria** (what must be TRUE):
1. `navigate`, `go_back`, `go_forward`, `refresh`, `open_tab`, and `switch_tab` execute in background context with correct verb names.
2. `run_task`, `stop_task`, `get_task_status`, `get_logs`, `list_sessions`, and memory/session reads return through stable internal handlers.
3. Restricted-tab responses distinguish blank/new-tab smart routing from non-routable browser pages and advertise only valid recovery tools.
4. MCP route tests fail if a route is missing even when source strings happen to exist.

**Plans:** 3/3 plans complete

Plans:
- [x] 199-01-PLAN.md -- Create executable MCP route-contract and restricted recovery tests
- [x] 199-02-PLAN.md -- Implement shared dispatcher and direct browser/tab routes
- [x] 199-03-PLAN.md -- Complete autopilot, observability, and restricted recovery routing

### Phase 200: Doctor, Status Watch & Recovery Messaging

**Goal**: Users can diagnose and recover MCP failures without guessing whether to restart the host, extension, browser, or config.

**Depends on**: Phase 198, Phase 199

**Requirements**: DIAG-01, DIAG-02, DIAG-03, DIAG-04

**Success Criteria** (what must be TRUE):
1. `doctor` classifies package/config/bridge/extension/content-script/tool-routing failures separately.
2. `status --watch` streams bridge mode, extension connection, last heartbeat, hub/relay state, and disconnect reason.
3. Tool errors include a short recovery instruction tied to the detected failed layer.
4. MCP package metadata, runtime `FSB_MCP_VERSION`, setup output, and README version references agree.

**Plans:** 3 planned

Plans:
- [ ] 200-01-PLAN.md -- Add layered diagnostics probe and `status --watch`
- [ ] 200-02-PLAN.md -- Map layer-aware MCP recovery messaging
- [ ] 200-03-PLAN.md -- Enforce MCP version parity and docs failure flow

### Phase 201: Platform Installer & Config Parity

**Goal**: Supported MCP hosts can be configured idempotently, and unsupported or variant hosts get precise manual fallback guidance.

**Depends on**: Phase 200

**Requirements**: PLAT-01, PLAT-02, PLAT-03, PLAT-04

**Success Criteria** (what must be TRUE):
1. `install --all --dry-run` and per-platform installs show accurate paths, formats, and expected writes for supported hosts.
2. Codex TOML config writes preserve existing user settings and pass a parse/round-trip verification.
3. Claude/OpenClaw/OpenCode-style host support is verified against current config behavior or documented as a manual fallback.
4. Installer output states which application must be restarted/reloaded and which changes are already applied.

**Plans:** TBD

### Phase 202: Cross-Host Smoke Matrix & Release Hardening

**Goal**: The milestone closes only after MCP works through real user-like startup/restart scenarios across target hosts.

**Depends on**: Phase 198, Phase 199, Phase 200, Phase 201

**Requirements**: VALID-01, VALID-02, VALID-03, VALID-04

**Success Criteria** (what must be TRUE):
1. Automated smoke tests cover server-before-extension, extension-before-server, server restart, service worker wake, and multi-host relay recovery.
2. MCP tool smoke proves `list_tabs`, `navigate`, `read_page`, `get_dom_snapshot`, `click`, `run_task`, `stop_task`, and `get_logs`.
3. Manual UAT evidence exists for Claude, Codex, and OpenClaw/OpenCode-style host behavior or a documented fallback if a host cannot be tested.
4. README/setup docs route users through `doctor` and `status --watch` before manual tinkering.

**Plans:** TBD

## Progress

**Execution Order:** 198 -> 199 -> 200 -> 201 -> 202

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 198. MCP Bridge Lifecycle & Reconnect State | 3/3 | Complete    | 2026-04-22 |
| 199. MCP Tool Routing Contract | 3/3 | Complete    | 2026-04-23 |
| 200. Doctor, Status Watch & Recovery Messaging | 0/3 | Planned     | - |
| 201. Platform Installer & Config Parity | 0/TBD | Not Started | - |
| 202. Cross-Host Smoke Matrix & Release Hardening | 0/TBD | Not Started | - |

## Previous Milestones

<details>
<summary>v0.9.34 Vault, Payments & Secure MCP Access (shipped 2026-04-22)</summary>

8 phases, 11 plans. Vault unlock repair, payment method backend/UI wiring, autopilot vault fills, MCP vault tools, and security boundary fixes for sensitive credential/payment flows. Archived with accepted validation debt for live vault/payment UAT.

</details>

<details>
<summary>v0.9.30 MCP Platform Install Flags (shipped 2026-04-18)</summary>

3 phases, 6 plans. Platform registry, format-aware config engine, install/uninstall CLI, Claude Code delegation, Codex TOML, Continue YAML, `--dry-run`, and `--all` support.

</details>

<details>
<summary>v0.9.25 MCP & Dashboard Reliability Closure (shipped 2026-04-11)</summary>

5 phases, 8 plans. Restricted-tab MCP parity, dashboard preview/remote-control/task-relay rebaseline, runtime carryover cleanup, and auth-wall smoke evidence.

</details>

## Backlog

- Deferred Angular migration requirements (DASH-08 through MIGR-03) remain parked from v0.9.29.
- Live UAT for v0.9.34 vault behavior and MCP payment approve/deny/delayed approval remains accepted validation debt unless it overlaps Phase 202 smoke coverage.

---
*Roadmap created: 2026-04-22*
*Last updated: 2026-04-22 after milestone roadmap creation*
