# Requirements: FSB v0.9.35 MCP Plug-and-Play Reliability

**Defined:** 2026-04-22
**Core Value:** Reliable single-attempt execution -- the AI decides correctly, the mechanics execute precisely

## v1 Requirements

Requirements for making FSB MCP install-once, reconnect reliably, diagnose its own failures, and work consistently across common MCP hosts.

### Bridge Lifecycle

- [x] **BRIDGE-01**: User can start an MCP host after Chrome/FSB is already open and the extension attaches to the local MCP bridge without extension reload.
- [x] **BRIDGE-02**: User can open Chrome/FSB after an MCP host is already running and the extension attaches to the existing local bridge within a bounded reconnect window.
- [x] **BRIDGE-03**: FSB re-arms MCP bridge connection attempts whenever the MV3 service worker wakes from suspension or handles extension activity.
- [x] **BRIDGE-04**: Multiple MCP hosts can connect through hub/relay mode without stealing, orphaning, or permanently breaking the extension connection.

### Tool Routing

- [x] **ROUTE-01**: MCP background-routed browser tools (`navigate`, `go_back`, `go_forward`, `refresh`, `open_tab`, `switch_tab`) execute through a direct internal dispatcher with verified verb mapping.
- [x] **ROUTE-02**: MCP autopilot and observability tools (`run_task`, `stop_task`, `get_task_status`, `get_logs`, `list_sessions`, memory/session reads) do not depend on fragile `chrome.runtime.sendMessage` self-dispatch.
- [x] **ROUTE-03**: Restricted-tab MCP recovery returns accurate next actions for blank/new-tab pages versus non-routable browser-internal pages.
- [x] **ROUTE-04**: MCP routing regression tests assert executable route contracts rather than only checking for string mentions in source files.

### Diagnostics

- [x] **DIAG-01**: `fsb-mcp-server doctor` identifies the failing layer: package availability, platform config, bridge bind/ownership, extension attachment, content script availability, or tool routing.
- [x] **DIAG-02**: `fsb-mcp-server status --watch` shows live bridge mode, extension connection, last heartbeat, active hub/relay state, and recent disconnect reason.
- [x] **DIAG-03**: MCP error messages provide exact recovery steps for the detected failure and avoid generic restart advice unless a restart is actually required.
- [x] **DIAG-04**: MCP package, runtime, README, and reported server version metadata agree on one version string before release.

### Platform Install

- [ ] **PLAT-01**: `install --all` and per-platform install commands verify idempotent config writes for Claude Desktop, Claude Code, Codex, Cursor, Windsurf, and currently supported config-file hosts.
- [ ] **PLAT-02**: Codex TOML install preserves existing user config and writes the expected `mcp_servers.fsb` entry in the active Codex config shape.
- [ ] **PLAT-03**: Claude/OpenClaw/OpenCode-style hosts are either supported with verified install snippets/config writes or explicitly diagnosed as unsupported with a manual fallback.
- [ ] **PLAT-04**: Installer output tells the user exactly which host must be restarted/reloaded and which changes are already active.

### Validation

- [ ] **VALID-01**: Automated bridge lifecycle smoke coverage proves server-before-extension, extension-before-server, server restart, and service-worker wake recovery scenarios.
- [ ] **VALID-02**: Automated MCP tool smoke coverage proves `list_tabs`, `navigate`, `read_page`, `get_dom_snapshot`, `click`, `run_task`, `stop_task`, and `get_logs`.
- [ ] **VALID-03**: Manual cross-host UAT captures evidence for Claude, Codex, and OpenClaw/OpenCode-style host behavior using the same smoke checklist.
- [ ] **VALID-04**: Release docs include a short "when something fails" flow that points users to doctor/status instead of manual tinkering.

## v2 Requirements

Deferred to future releases.

### Advanced MCP Experience

- **MCPX-01**: User can launch or wake the browser extension from the MCP server through a native helper.
- **MCPX-02**: User can manage multiple browser profiles from MCP with explicit profile selection.
- **MCPX-03**: MCP server can expose a local dashboard for bridge status and host configuration.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Replacing the Chrome extension with server-side/headless browser execution | FSB's value and security model depend on the user's live browser and extension context |
| Auto-installing the Chrome extension from the MCP server | Browser extension installation is platform/browser controlled and not needed to fix MCP reliability |
| Firefox support | Existing project boundary defers non-Chromium extension support |
| Cloud relay for local MCP traffic | This milestone focuses local plug-and-play reliability, not remote access |
| New browser automation capabilities unrelated to MCP setup/routing | The user problem is reliability and onboarding, not expanding automation scope |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| BRIDGE-01 | Phase 198 | Complete |
| BRIDGE-02 | Phase 198 | Complete |
| BRIDGE-03 | Phase 198 | Complete |
| BRIDGE-04 | Phase 198 | Complete |
| ROUTE-01 | Phase 199 | Complete |
| ROUTE-02 | Phase 199 | Complete |
| ROUTE-03 | Phase 199 | Complete |
| ROUTE-04 | Phase 199 | Complete |
| DIAG-01 | Phase 200 | Complete |
| DIAG-02 | Phase 200 | Complete |
| DIAG-03 | Phase 200 | Complete |
| DIAG-04 | Phase 200 | Complete |
| PLAT-01 | Phase 201 | Pending |
| PLAT-02 | Phase 201 | Pending |
| PLAT-03 | Phase 201 | Pending |
| PLAT-04 | Phase 201 | Pending |
| VALID-01 | Phase 202 | Pending |
| VALID-02 | Phase 202 | Pending |
| VALID-03 | Phase 202 | Pending |
| VALID-04 | Phase 202 | Pending |

**Coverage:**
- v1 requirements: 20 total
- Mapped to phases: 20
- Unmapped: 0

---
*Requirements defined: 2026-04-22*
*Last updated: 2026-04-22 after milestone definition*
