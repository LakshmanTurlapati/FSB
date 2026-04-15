# Project Research Summary

**Project:** FSB (Full Self-Browsing)
**Domain:** MCP server auto-configuration CLI
**Researched:** 2026-04-15
**Confidence:** HIGH

## Executive Summary

The `fsb-mcp-server` npm package (v0.4.0) currently offers a `setup` command that prints copy-paste snippets for MCP client configuration. This milestone replaces manual copy-paste with one-command auto-configuration: `npx fsb-mcp-server install --claude-desktop` (and 9 other platform flags). Two competing tools exist (Neon's `add-mcp` covering 13 platforms, Supermemory's `install-mcp` covering 18), but neither offers backup-before-write or dry-run — gaps FSB can fill as differentiators.

The recommended approach uses a **platform registry map** pattern where each of 10 platforms is described as data (config path per OS, file format, root key name, server entry shape). A single `ConfigWriter` module handles read-merge-write for all formats: JSON (8 platforms), TOML (Codex via `smol-toml`), and YAML (Continue via `yaml`). Three new zero-dep dependencies total ~796KB unpacked. The existing hand-rolled CLI parser handles boolean `--<platform>` flags natively — no CLI framework needed.

The biggest risk is **silently corrupting user config files** during JSON round-tripping (destroying comments, trailing commas, property ordering). VS Code and Zed configs use JSONC format. Prevention: use `strip-json-comments` to strip before parsing, and accept that comments won't survive round-trips (with backup as safety net). A secondary risk is the **fragmented key names** across platforms (`mcpServers` vs `servers` vs `context_servers` vs `mcp_servers`) — the registry map eliminates this by encoding each platform's schema explicitly.

## Key Findings

### Recommended Stack

Three new runtime dependencies, all zero-dep and ESM-compatible:

- **`smol-toml` ^1.6.1** (103KB): Parse/write TOML for Codex CLI's `~/.codex/config.toml` — fastest TOML parser on npm, ESM-native, used by `add-mcp`
- **`yaml` ^2.8.3** (685KB): Parse/write YAML for Continue's `~/.continue/config.yaml` — zero deps, preserves comments on round-trip, full YAML 1.2
- **`strip-json-comments` ^5.0.3** (8KB): Strip `//` comments and trailing commas from JSONC before `JSON.parse()` — handles VS Code and Zed config files

Everything else uses Node.js built-ins: `fs/promises`, `os.homedir()`, `path.join()`, `process.platform`, `child_process.execSync` (for Claude Code CLI). No CLI framework needed — existing `parseArgs()` handles boolean flags.

### Expected Features

**Must have (table stakes):**
- Platform flag per target (`--claude-desktop`, `--cursor`, etc.)
- Safe config merging (read-modify-write preserving other servers)
- Cross-OS path resolution (macOS, Windows, Linux)
- Idempotent install (skip if already configured)
- Error handling for missing platform directories
- Windows `cmd /c npx` wrapping (auto-detected)

**Should have (differentiators):**
- `--uninstall` flag for clean removal
- Backup before write (`.bak` file)
- `--dry-run` to preview changes
- `--all` to install to every detected platform
- Claude Code integration via `claude mcp add` CLI delegation

**Defer (v2+):**
- Interactive TUI with multi-select menu
- Desktop Extension (.mcpb) packaging
- Project-scoped install
- Environment variable injection

### Architecture Approach

Three new files (`platforms.ts`, `config-writer.ts`, `install.ts`), one modified file (`index.ts`). All existing MCP server modules untouched — zero runtime impact.

**Major components:**
1. **Platform Registry** (`platforms.ts`) — static map of 10 platforms with config path per OS, format, root key, server entry shape
2. **Config Writer** (`config-writer.ts`) — read-merge-write logic for JSON/TOML/YAML with format-specific parsers
3. **Install Handler** (`install.ts`) — CLI orchestrator: detect platform flags, resolve paths, delegate to ConfigWriter, print results

### Critical Pitfalls

1. **JSON round-trip destroys comments/formatting** — VS Code and Zed use JSONC. Use `strip-json-comments` before parsing; accept comment loss but create backup first
2. **Different root keys across platforms** — VS Code uses `servers`, Zed uses `context_servers`, Codex uses `mcp_servers`. Registry map eliminates this by encoding per-platform schemas
3. **Windows path expansion failures** — `%APPDATA%` must use `process.env.APPDATA`, never literal strings. Use `os.homedir()` everywhere, never raw `~`
4. **Zed/Gemini settings.json is a shared file** — contains non-MCP settings. Merge must be surgical (only touch the server key, preserve everything else)
5. **Cline extension ID may change** — hardcoded `saoudrizwan.claude-dev` in globalStorage path could break if Cline rebrands

## Implications for Roadmap

### Phase 1: Platform Registry & JSON Config Engine
**Rationale:** 8 of 10 platforms use JSON — build the core engine first for maximum coverage
**Delivers:** Platform registry map, cross-OS path resolution, JSON read-merge-write with JSONC support, backup utility
**Addresses:** Table stakes (install, idempotent, safe merge, path resolution)
**Avoids:** Pitfalls 1-3 (JSON corruption, wrong keys, Windows paths)

### Phase 2: Install/Uninstall CLI & JSON Platforms
**Rationale:** Wire the engine into the CLI and deliver all JSON-based platforms
**Delivers:** `install` and `uninstall` subcommands, all 7 JSON platforms (Claude Desktop, Cursor, VS Code, Windsurf, Cline, Zed, Gemini CLI), Claude Code CLI delegation, `--all` flag
**Addresses:** Core install UX, uninstall, confirmation output, error handling

### Phase 3: TOML/YAML Platforms & Polish
**Rationale:** Non-JSON platforms (Codex, Continue) need format-specific parsers — add after JSON is proven
**Delivers:** Codex TOML support, Continue YAML support, `--dry-run` flag, updated `setup` command with install hints
**Addresses:** Full platform coverage, differentiators (dry-run)
**Uses:** `smol-toml` and `yaml` dependencies

### Phase Ordering Rationale

- JSON engine first because it covers 80% of platforms with zero new dependencies (only `strip-json-comments` at 8KB)
- CLI wiring second because the engine must exist before the CLI can use it
- TOML/YAML last because they serve the fewest users and require the largest dependencies
- Claude Code CLI delegation fits in Phase 2 because it's a special case (shell-out, not file write)

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 1:** VS Code mcp.json path may differ across VS Code flavors (Insiders, Codium)
- **Phase 3:** Continue may support JSON mcpServers directory as alternative to YAML list

Phases with standard patterns (skip research-phase):
- **Phase 2:** CLI routing is well-understood from existing `index.ts` analysis

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All libraries verified on npm, used by production tools |
| Features | HIGH | Competitor analysis against add-mcp and install-mcp |
| Architecture | HIGH | Direct analysis of existing CLI entry point |
| Pitfalls | HIGH | Cross-referenced with official platform docs and real bug reports |

**Overall confidence:** HIGH

### Gaps to Address

- Whether VS Code user-global mcp.json path varies across VS Code Insiders / Codium
- Whether Continue has migrated all users to config.yaml or if some use deprecated config.json
- Cline extension ID stability (`saoudrizwan.claude-dev` may change if rebranded)
- Zed Windows support is newer — `%APPDATA%\Zed\settings.json` path unconfirmed in official docs

## Sources

### Primary (HIGH confidence)
- [Claude Desktop MCP setup](https://support.claude.com/en/articles/10949351) — config file paths
- [Claude Code MCP docs](https://code.claude.com/docs/en/mcp) — `claude mcp add` command
- [VS Code MCP configuration](https://code.visualstudio.com/docs/copilot/reference/mcp-configuration) — `servers` root key
- [Cursor MCP docs](https://cursor.com/docs/context/mcp) — config path and format
- [Windsurf MCP docs](https://docs.windsurf.com/windsurf/cascade/mcp) — config path
- [Zed MCP docs](https://zed.dev/docs/ai/mcp) — `context_servers` key
- [Codex config reference](https://developers.openai.com/codex/config-reference) — TOML format
- [Continue MCP docs](https://docs.continue.dev/customize/deep-dives/mcp) — YAML format

### Secondary (MEDIUM confidence)
- [add-mcp (Neon)](https://github.com/neondatabase/add-mcp) — competitor analysis, library choices
- [install-mcp (Supermemory)](https://github.com/supermemoryai/install-mcp) — competitor analysis
- npm registry — library versions and sizes

---
*Research completed: 2026-04-15*
*Ready for roadmap: yes*
