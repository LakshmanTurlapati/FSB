# Roadmap: FSB (Full Self-Browsing)

## Milestones

- ✅ **v0.9.35 MCP Plug-and-Play Reliability** — Phases 198-202 (shipped 2026-04-24)
- 📋 **Next milestone** — not started yet; run `$gsd-new-milestone` when ready

## Phases

<details>
<summary>✅ v0.9.35 MCP Plug-and-Play Reliability (Phases 198-202) — SHIPPED 2026-04-24</summary>

- [x] **Phase 198: MCP Bridge Lifecycle & Reconnect State** - Make extension/server attachment recover automatically across startup order, service worker wake, and hub/relay handoff (completed 2026-04-22)
- [x] **Phase 199: MCP Tool Routing Contract** - Replace fragile background self-dispatch with direct verified route handling for browser, autopilot, observability, and restricted recovery tools (completed 2026-04-23)
- [x] **Phase 200: Doctor, Status Watch & Recovery Messaging** - Make diagnostics identify the exact failed layer and tell users the next concrete action (completed 2026-04-23)
- [x] **Phase 201: Platform Installer & Config Parity** - Verify install/update behavior across Claude, Codex, OpenClaw/OpenCode-style hosts, Cursor/Windsurf, and supported config formats (completed 2026-04-24)
- [x] **Phase 202: Cross-Host Smoke Matrix & Release Hardening** - Prove plug-and-play behavior through automated lifecycle smoke tests and manual host UAT (completed 2026-04-24)

</details>

## Progress

| Milestone | Phase Range | Status | Shipped |
|-----------|-------------|--------|---------|
| v0.9.35 MCP Plug-and-Play Reliability | 198-202 | Complete | 2026-04-24 |

## Archive

See [.planning/milestones/v0.9.35-ROADMAP.md](./milestones/v0.9.35-ROADMAP.md) for the full active-roadmap snapshot that was archived at milestone close.

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
*Last updated: 2026-04-24 after v0.9.35 milestone close*
