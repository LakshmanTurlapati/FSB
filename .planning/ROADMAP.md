# Roadmap: FSB (Full Self-Browsing)

## Milestones

- v0.9.29 Showcase Angular Migration (shipped 2026-04-15, accepted scope gaps)
- v0.9.27 Usage Dashboard Fix (shipped 2026-04-14)

## Active Milestone: v0.9.30 MCP Platform Install Flags

Replace copy-paste MCP setup with one-command auto-configuration for every major MCP-capable platform. 28 requirements across 3 phases, delivering a platform registry engine, JSON-based install/uninstall for 7 platforms, and non-JSON platform support with extended flags.

## Phases

- [ ] **Phase 174: Platform Registry & Config Engine** - Core engine: platform registry map, JSON/JSONC read-merge-write, cross-OS path resolution, backup, idempotency, error handling
- [ ] **Phase 175: Install/Uninstall CLI & JSON Platforms** - Wire install/uninstall commands, deliver all 7 JSON-format platforms, uninstall semantics, CLI help, setup update
- [ ] **Phase 176: Non-JSON Platforms & Extended Flags** - Claude Code CLI delegation, Codex TOML, Continue YAML, dry-run preview, install-all

## Phase Details

### Phase 174: Platform Registry & Config Engine
**Goal**: The foundational engine exists to read, merge, and write MCP config files safely across operating systems
**Depends on**: Nothing (first phase of milestone)
**Requirements**: INST-01, INST-02, INST-03, INST-04, INST-05, INST-06, INST-07, INST-08
**Success Criteria** (what must be TRUE):
  1. A platform registry data structure maps each of 10 platforms to its config path per OS, file format, root key name, and server entry shape
  2. The config engine can read an existing JSON config file, merge an FSB server entry under the correct root key, and write it back without losing other servers
  3. JSONC files (containing `//` comments and trailing commas) are parsed correctly without errors
  4. Config file paths resolve correctly on macOS, Windows, and Linux using OS-appropriate base directories
  5. A `.bak` backup of the original config file is created before any modification
**Plans:** 2 plans

Plans:
- [ ] 174-01-PLAN.md -- Dependencies and platform registry map (platforms.js)
- [ ] 174-02-PLAN.md -- Config read-merge-write engine (config-writer.js) and integration tests

### Phase 175: Install/Uninstall CLI & JSON Platforms
**Goal**: Users can install and uninstall FSB in any JSON-format MCP client with a single command
**Depends on**: Phase 174
**Requirements**: PLAT-01, PLAT-02, PLAT-03, PLAT-04, PLAT-05, PLAT-06, PLAT-07, UNINST-01, UNINST-02, UNINST-03, UNINST-04, UNINST-05, CLI-01, CLI-02, CLI-03
**Success Criteria** (what must be TRUE):
  1. Running `npx fsb-mcp-server install --claude-desktop` auto-configures FSB in Claude Desktop's config file with the correct `mcpServers` entry
  2. Running `npx fsb-mcp-server install --vscode` writes the correct `servers` entry with `type: "stdio"` into VS Code's mcp.json
  3. Running `npx fsb-mcp-server uninstall --<platform>` removes only the FSB entry and preserves all other configured servers
  4. Running `install` with no platform flags prints usage help listing all 10 available platforms
  5. The existing `setup` command mentions `install --<platform>` as a faster alternative
**Plans:** 2 plans

Plans:
- [ ] 175-01-PLAN.md -- Install/uninstall orchestration module (install.js) and config-writer API gap fix
- [ ] 175-02-PLAN.md -- CLI router wiring (switch cases, help, setup updates) and end-to-end verification

### Phase 176: Non-JSON Platforms & Extended Flags
**Goal**: Users can install FSB in every remaining MCP client (Claude Code, Codex, Continue) and use convenience flags for previewing and bulk installs
**Depends on**: Phase 175
**Requirements**: PLAT-08, PLAT-09, PLAT-10, INST-09, INST-10
**Success Criteria** (what must be TRUE):
  1. Running `install --claude-code` delegates to `claude mcp add` CLI command (with fallback to printed command if CLI is unavailable)
  2. Running `install --codex` writes the correct TOML `mcp_servers` table entry into Codex's config.toml
  3. Running `install --continue` writes a YAML array entry under `mcpServers` in Continue's config.yaml
  4. Running `install --dry-run --<platform>` shows what would change without modifying any files
  5. Running `install --all` installs FSB to every detected platform in one command
**Plans**: TBD

## Progress

**Execution Order:** 174 -> 175 -> 176

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 174. Platform Registry & Config Engine | 0/2 | Not started | - |
| 175. Install/Uninstall CLI & JSON Platforms | 0/2 | Not started | - |
| 176. Non-JSON Platforms & Extended Flags | 0/? | Not started | - |

## Last Shipped Milestone: v0.9.29 Showcase Angular Migration (shipped 2026-04-15)

**Shipped scope:** Phase 173 only (Showcase Shell, Routes & Theme Parity), including Angular shell route parity, theme persistence parity, five-route content migration, and server canonical-route/legacy-redirect compatibility.

**Accepted gaps at close:** Remaining migration scope was deferred to a future milestone:
- Phase 174: Dashboard Session Access Flows (`DASH-08` to `DASH-10`)
- Phase 175: Agent Management & Run History Parity (`DASH-11` to `DASH-13`)
- Phase 176: Task, Preview & Remote Runtime Parity (`DASH-14` to `DASH-17`)
- Phase 177: Migration Regression & Delivery Readiness (`MIGR-01` to `MIGR-03`)

**Archive:** `.planning/milestones/v0.9.29-ROADMAP.md`
