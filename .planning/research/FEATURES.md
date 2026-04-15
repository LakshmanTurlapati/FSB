# Feature Research: MCP Platform Install Flags

**Domain:** MCP server auto-configuration CLI
**Researched:** 2026-04-15
**Confidence:** HIGH

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Platform flag per target** (`--claude-desktop`, `--cursor`, etc.) | Every auto-install tool (add-mcp, install-mcp) uses per-platform targeting. Users expect to name the platform they want. | LOW | One flag per platform, dispatch to platform-specific handler. The existing `setup` command already enumerates platforms. |
| **Safe config merging (read-modify-write)** | Users already have other MCP servers configured. Overwriting the file would destroy their setup. add-mcp and install-mcp both merge into existing config. | MEDIUM | Must parse existing JSON/TOML/YAML, insert/update `fsb` key under the servers object, write back. Preserve formatting where feasible (JSON.stringify with indent 2 is standard). |
| **Cross-OS path resolution** | MCP config files live in different locations per OS (macOS `~/Library/Application Support/`, Windows `%APPDATA%\`, Linux `~/.config/`). All auto-install tools resolve platform-specific paths. | MEDIUM | Need OS detection (`process.platform`) and path expansion. Windows needs `%APPDATA%` / `%USERPROFILE%` env var expansion. |
| **Confirmation before write** | Users expect to see what will happen before their config files are modified. add-mcp prompts by default, offers `-y` to skip. | LOW | Print the file path, show the entry being added, ask Y/n. Trivial readline prompt. |
| **Idempotent install** | Running install twice should not duplicate entries or corrupt config. | LOW | Check if `fsb` key already exists; if so, update in place or skip with message. |
| **Success/failure feedback** | User needs to know if it worked, what file was written, and what to do next. | LOW | Print path written, next steps (restart client, verify with `status`/`doctor`). |
| **Windows command wrapping** | On Windows, `npx` must be invoked via `cmd /c npx` in some clients. The existing `setup` command already handles this distinction. | LOW | Windows detection already exists in the codebase (`printSetup` shows `['cmd', '/c', 'npx', '-y', 'fsb-mcp-server']`). Apply per-platform. |
| **Error on missing config directory** | If the platform is not installed (e.g., `~/.cursor` does not exist), fail gracefully with a clear message rather than silently creating directories. | LOW | `fs.existsSync` check before write. |

### Differentiators (Competitive Advantage)

Features that set the product apart. Not required, but valuable.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **`--uninstall` flag** | Clean removal of FSB entry from config, preserving all other servers. install-mcp does NOT support uninstall. add-mcp supports it via a separate `remove` subcommand. Having it built into `npx fsb-mcp-server install --uninstall --cursor` is cleaner than requiring a separate tool. | MEDIUM | Parse config, remove `fsb` key, write back. Must handle "file has only fsb" edge case (leave valid empty config). |
| **`--dry-run` flag** | Show exactly what would be written/changed without modifying anything. Neither add-mcp nor install-mcp offer dry-run. Builds trust for cautious users. | LOW | Same logic as install, but print diff instead of writing. Minimal extra code if install logic is factored properly. |
| **Backup before write** | Create `.bak` copy of config file before modifying. add-mcp does NOT back up. 1mcp.app's uninstall docs mention "automatic backup creation." Builds trust. | LOW | `fs.copyFileSync(configPath, configPath + '.bak')` before write. One line of code. |
| **`--all` flag** | Install to every detected platform at once. add-mcp supports `--all`. Saves time for power users who use multiple editors. | LOW | Iterate over all platform handlers, skip platforms whose config directory does not exist. Report summary. |
| **Multi-format config support (JSON + TOML + YAML)** | Codex uses TOML (`~/.codex/config.toml`), Continue uses YAML (`.continue/mcpServers/*.yaml`). Supporting these formats means truly universal coverage. | HIGH | Need TOML parser/writer (e.g., `smol-toml`) and YAML parser/writer (e.g., `yaml`). Adds dependencies to the package. |
| **Claude Code integration via `claude mcp add`** | Instead of writing a config file, shell out to `claude mcp add fsb -- npx -y fsb-mcp-server` for Claude Code. Uses the official API rather than poking at internal config files. | MEDIUM | Need to detect if `claude` CLI is available, exec the command, handle errors. Alternative: write to `~/.claude.json` directly (simpler but less official). |
| **Cursor deeplink generation** | Generate and optionally open `cursor://anysphere.cursor-deeplink/mcp/install?name=fsb&config=...` URL. Already partially implemented in `buildCursorDeeplink()`. | LOW | Existing logic in codebase. Add `--open` to launch via `open` (macOS) / `xdg-open` (Linux) / `start` (Windows). |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Interactive TUI with multi-select menu** | add-mcp uses interactive multi-select for platform targeting. Looks polished. | Adds dependency on `inquirer` or `prompts`. Breaks non-interactive CI environments. The tool runs via `npx` so startup time matters -- TUI libraries are heavy. FSB is a single-server installer, not a multi-server manager. | Simple Y/n readline prompt for confirmation. Platform specified via explicit flags, not menus. |
| **Auto-detect all installed editors** | add-mcp scans the filesystem for installed editors. Seems convenient. | Fragile heuristic (checking for directories like `~/.cursor` does not mean Cursor is actually installed). Creates false positives. For a single-server install command, the user knows which editor they want. | Let the user specify the target explicitly. `--all` flag covers the "install everywhere" case with directory existence as guard. |
| **Registry/marketplace integration** | Smithery, MCP Market, and similar registries offer discovery. | FSB is a specific product, not a registry. Users install FSB from npm, not from a marketplace search. Adding registry metadata adds complexity for zero user benefit. | Good npm README with install instructions is sufficient. |
| **Desktop Extension (.mcpb) packaging** | Claude Desktop now supports one-click `.mcpb` installs with bundled Node.js runtime. | Separate distribution channel with its own packaging toolchain. Requires bundling Node.js runtime. Orthogonal to the CLI install flags feature. Worth doing eventually, but as a separate milestone. | Defer to future milestone. CLI install flags cover the JSON config path that `.mcpb` would replace. |
| **Environment variable injection** | Some MCP servers need API keys injected via env vars. add-mcp supports `--env KEY=VALUE`. | FSB does not need any environment variables or API keys in its MCP config. Adding env var support is dead feature weight. | Omit. If needed later, trivial to add `--env KEY=VALUE` flag. |
| **Project-scoped install** | Some platforms (Cursor, VS Code, Claude Code) support project-scoped `.mcp.json` / `.cursor/mcp.json`. | FSB is a browser automation bridge -- it is inherently user-global, not project-scoped. Installing per-project creates confusion and maintenance burden. | Always install to user/global scope. Document project-scope as manual option in `setup` output. |

## Feature Dependencies

```
[Config path resolution per platform]
    +--requires--> [OS detection (process.platform)]
    +--requires--> [Home directory expansion]

[Safe config merging]
    +--requires--> [Config path resolution]
    +--requires--> [JSON parser (built-in)]
    +--requires--> [TOML parser (Codex only)]
    +--requires--> [YAML parser (Continue only)]

[Install command]
    +--requires--> [Config path resolution]
    +--requires--> [Safe config merging]
    +--requires--> [Confirmation prompt]
    +--enhances--> [Backup before write]
    +--enhances--> [Dry-run mode]

[Uninstall command]
    +--requires--> [Config path resolution]
    +--requires--> [Safe config merging (remove key)]
    +--requires--> [Confirmation prompt]
    +--enhances--> [Backup before write]

[--all flag]
    +--requires--> [Install command]
    +--requires--> [Config path resolution for every platform]

[Claude Code integration]
    +--conflicts--> [Config file writing for Claude Code]
    (Use claude mcp add, not file write)

[Cursor deeplink]
    +--enhances--> [Install command --cursor]
    (Alternative install path, not primary)
```

### Dependency Notes

- **Install requires config path resolution:** Cannot write config without knowing where it is.
- **Safe merging requires parsers:** JSON is built-in. TOML (Codex) and YAML (Continue) need external packages -- these are the only platforms requiring non-JSON formats.
- **Uninstall shares all install infrastructure:** Same path resolution, same merge logic (remove instead of add), same backup and confirmation UX.
- **Claude Code conflicts with file writing:** Claude Code's official method is `claude mcp add`, not manual file editing. Using the CLI command is preferable; fallback to writing `~/.claude.json` only if `claude` binary is not found.

## MVP Definition

### Launch With (v1 -- this milestone)

- [ ] `install` subcommand added to CLI parser -- new command alongside `stdio`, `serve`, `setup`, etc.
- [ ] Platform flags: `--claude-desktop`, `--cursor`, `--vscode`, `--windsurf`, `--claude-code`, `--cline`, `--zed` -- covers all JSON-config platforms plus Claude Code CLI delegation
- [ ] Cross-OS path resolution for all JSON-format platforms (macOS, Windows, Linux)
- [ ] Safe config merging: read existing JSON, add/update `fsb` entry under correct key (`mcpServers` / `servers` / `context_servers`), write back with 2-space indent
- [ ] Confirmation prompt before write (Y/n), skippable with `--yes` or `-y`
- [ ] Backup before write (`.bak` file)
- [ ] Idempotent: detect existing `fsb` entry, update or skip
- [ ] `--uninstall` flag to remove FSB entry
- [ ] Success/failure output with next steps
- [ ] Error handling for missing platform directories

### Add After Validation (v1.x)

- [ ] `--dry-run` flag -- print what would change without writing. Add once core install is solid.
- [ ] `--all` flag -- install to every detected platform. Add once individual platform handlers are tested.
- [ ] Codex TOML support (`--codex`) -- requires TOML parser dependency. Defer to avoid blocking launch on dependency decisions.
- [ ] Gemini CLI support (`--gemini-cli`) -- JSON format, straightforward, but lower priority platform.
- [ ] Continue support (`--continue`) -- YAML format, requires yaml dependency.
- [ ] Cursor deeplink auto-open (`--cursor --open-deeplink`) -- nice-to-have alternative to config file writing.

### Future Consideration (v2+)

- [ ] Desktop Extension (.mcpb) packaging -- separate distribution format, separate milestone
- [ ] Interactive TUI mode -- only if user feedback demands it
- [ ] Project-scoped install -- only if use cases emerge for per-project FSB config

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| `install --claude-desktop` | HIGH | LOW | P1 |
| `install --cursor` | HIGH | LOW | P1 |
| `install --vscode` | HIGH | LOW | P1 |
| `install --claude-code` | HIGH | MEDIUM | P1 |
| `install --windsurf` | MEDIUM | LOW | P1 |
| `install --cline` | MEDIUM | LOW | P1 |
| `install --zed` | MEDIUM | LOW | P1 |
| Safe config merging (JSON) | HIGH | MEDIUM | P1 |
| Cross-OS path resolution | HIGH | MEDIUM | P1 |
| Confirmation prompt | HIGH | LOW | P1 |
| Backup before write | MEDIUM | LOW | P1 |
| `--uninstall` | MEDIUM | LOW | P1 |
| Idempotent install | HIGH | LOW | P1 |
| `--dry-run` | MEDIUM | LOW | P2 |
| `--all` | MEDIUM | LOW | P2 |
| `install --codex` (TOML) | LOW | HIGH | P2 |
| `install --gemini-cli` | LOW | LOW | P2 |
| `install --continue` (YAML) | LOW | HIGH | P2 |
| Cursor deeplink auto-open | LOW | LOW | P3 |
| Desktop Extension (.mcpb) | LOW | HIGH | P3 |

**Priority key:**
- P1: Must have for this milestone
- P2: Should have, add when possible (next iteration)
- P3: Nice to have, future consideration

## Competitor Feature Analysis

### Existing MCP Auto-Install Tools

| Feature | add-mcp (Neon) | install-mcp (Supermemory) | FSB install (our plan) |
|---------|----------------|---------------------------|------------------------|
| **Platforms** | 13 agents | 18 clients | 7-10 platforms (focused on popular ones) |
| **Install** | Yes, per-agent flags | Yes, `--client` flag | Yes, `--<platform>` flags |
| **Uninstall** | Yes (`remove` subcommand) | No | Yes (`--uninstall --<platform>`) |
| **Dry-run** | No | No | Yes (`--dry-run`) |
| **Backup** | No | No | Yes (`.bak` file) |
| **Confirmation** | Yes (interactive, skippable with `-y`) | No | Yes (Y/n, skippable with `-y`) |
| **Config merge** | Writes to agent-specific files | Direct config modification | Read-modify-write with preservation |
| **Auto-detect** | Scans for installed agents | No | No (explicit platform flags) |
| **Multi-server** | Yes (general purpose) | Yes (general purpose) | No (FSB only -- simpler, faster) |
| **TOML/YAML** | Unknown | Unknown | Deferred (JSON first, TOML/YAML in P2) |
| **Claude Code** | Writes config file | Writes config file | Shells out to `claude mcp add` (official method) |
| **Interactive TUI** | Multi-select menu | No | No (flags + Y/n prompt) |

### Key Differentiation

add-mcp and install-mcp are **general-purpose multi-server installers**. FSB's `install` command is a **single-purpose, zero-config installer for FSB specifically**. This means:

1. **Faster** -- no registry queries, no server selection, no dependency resolution
2. **Safer** -- backup before write, dry-run option, confirmation prompt
3. **Simpler** -- one command does one thing (`npx fsb-mcp-server install --cursor`)
4. **Reversible** -- built-in `--uninstall` with the same flags

## Expected UX Flows

### Install (normal)

```
$ npx fsb-mcp-server install --cursor

FSB MCP Server v0.4.x

Target: Cursor (global)
Config: /Users/you/.cursor/mcp.json
Action: Add "fsb" to mcpServers

  {
    "fsb": {
      "command": "npx",
      "args": ["-y", "fsb-mcp-server"]
    }
  }

Proceed? [Y/n] y

Backed up: /Users/you/.cursor/mcp.json.bak
Written:   /Users/you/.cursor/mcp.json

Done. Restart Cursor to activate the FSB MCP server.
Run `npx fsb-mcp-server doctor` to verify the connection.
```

### Install (already exists)

```
$ npx fsb-mcp-server install --cursor

FSB MCP Server v0.4.x

Target: Cursor (global)
Config: /Users/you/.cursor/mcp.json

FSB is already configured in this file. No changes needed.
```

### Install (config file does not exist yet)

```
$ npx fsb-mcp-server install --cursor

FSB MCP Server v0.4.x

Target: Cursor (global)
Config: /Users/you/.cursor/mcp.json (will be created)
Action: Create file with "fsb" in mcpServers

  {
    "mcpServers": {
      "fsb": {
        "command": "npx",
        "args": ["-y", "fsb-mcp-server"]
      }
    }
  }

Proceed? [Y/n] y

Created: /Users/you/.cursor/mcp.json

Done. Restart Cursor to activate the FSB MCP server.
```

### Install (platform not found)

```
$ npx fsb-mcp-server install --cursor

FSB MCP Server v0.4.x

Error: Cursor does not appear to be installed.
Expected config directory: /Users/you/.cursor
Tip: If Cursor is installed elsewhere, use `fsb-mcp-server setup` for manual instructions.
```

### Uninstall

```
$ npx fsb-mcp-server install --uninstall --cursor

FSB MCP Server v0.4.x

Target: Cursor (global)
Config: /Users/you/.cursor/mcp.json
Action: Remove "fsb" from mcpServers

Proceed? [Y/n] y

Backed up: /Users/you/.cursor/mcp.json.bak
Written:   /Users/you/.cursor/mcp.json

Done. FSB removed from Cursor. Restart Cursor to apply.
```

### Claude Code (CLI delegation)

```
$ npx fsb-mcp-server install --claude-code

FSB MCP Server v0.4.x

Target: Claude Code
Action: Run `claude mcp add fsb -- npx -y fsb-mcp-server`

Proceed? [Y/n] y

Running: claude mcp add fsb -- npx -y fsb-mcp-server
Added fsb to Claude Code.

Done. The FSB MCP server is now available in Claude Code.
```

### Dry-run (P2)

```
$ npx fsb-mcp-server install --cursor --dry-run

FSB MCP Server v0.4.x [DRY RUN]

Target: Cursor (global)
Config: /Users/you/.cursor/mcp.json
Action: Would add "fsb" to mcpServers (no files modified)

  {
    "fsb": {
      "command": "npx",
      "args": ["-y", "fsb-mcp-server"]
    }
  }

No changes made.
```

### Non-interactive

```
$ npx fsb-mcp-server install --cursor -y

FSB MCP Server v0.4.x

Backed up: /Users/you/.cursor/mcp.json.bak
Written:   /Users/you/.cursor/mcp.json

Done. Restart Cursor to activate the FSB MCP server.
```

## Platform Config Reference

Consolidated from research. This is the implementation reference for path resolution and config format per platform.

| Platform | Config Path (macOS) | Config Path (Windows) | Config Path (Linux) | Root Key | Format |
|----------|--------------------|-----------------------|--------------------|----------|--------|
| Claude Desktop | `~/Library/Application Support/Claude/claude_desktop_config.json` | `%APPDATA%\Claude\claude_desktop_config.json` | `~/.config/Claude/claude_desktop_config.json` | `mcpServers` | JSON |
| Cursor | `~/.cursor/mcp.json` | `~/.cursor/mcp.json` | `~/.cursor/mcp.json` | `mcpServers` | JSON |
| VS Code | `~/.vscode/mcp.json` (user-global) | `~/.vscode/mcp.json` | `~/.vscode/mcp.json` | `servers` | JSON |
| Windsurf | `~/.codeium/windsurf/mcp_config.json` | `%USERPROFILE%\.codeium\windsurf\mcp_config.json` | `~/.codeium/windsurf/mcp_config.json` | `mcpServers` | JSON |
| Cline | `~/Library/Application Support/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json` | `%APPDATA%\Code\User\globalStorage\saoudrizwan.claude-dev\settings\cline_mcp_settings.json` | `~/.config/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json` | `mcpServers` | JSON |
| Zed | `~/.config/zed/settings.json` | `%APPDATA%\Zed\settings.json` | `~/.config/zed/settings.json` | `context_servers` | JSON |
| Claude Code | N/A (uses `claude mcp add`) | N/A | N/A | N/A | CLI |
| Codex | `~/.codex/config.toml` | `~/.codex/config.toml` | `~/.codex/config.toml` | `mcp_servers` | TOML |
| Gemini CLI | `~/.gemini/settings.json` | `~/.gemini/settings.json` | `~/.gemini/settings.json` | `mcpServers` | JSON |
| Continue | `~/.continue/config.yaml` | same | same | `mcpServers` (array) | YAML |

### Config Entry Shape per Platform

**Most platforms (Claude Desktop, Cursor, Windsurf, Cline, Gemini CLI):**
```json
{ "mcpServers": { "fsb": { "command": "npx", "args": ["-y", "fsb-mcp-server"] } } }
```

**VS Code (note: root key is `servers`, not `mcpServers`):**
```json
{ "servers": { "fsb": { "type": "stdio", "command": "npx", "args": ["-y", "fsb-mcp-server"] } } }
```

**Zed (note: root key is `context_servers`):**
```json
{ "context_servers": { "fsb": { "command": "npx", "args": ["-y", "fsb-mcp-server"] } } }
```

**Codex (TOML, note: key is `mcp_servers` with underscore):**
```toml
[mcp_servers.fsb]
command = "npx"
args = ["-y", "fsb-mcp-server"]
```

**Continue (YAML, note: array-based, not object-based):**
```yaml
mcpServers:
  - name: fsb
    command: npx
    args:
      - "-y"
      - "fsb-mcp-server"
```

**Windows variant for JSON platforms (Claude Desktop, Cursor, Windsurf, Cline):**
```json
{ "command": "cmd", "args": ["/c", "npx", "-y", "fsb-mcp-server"] }
```

### Format Complexity by Platform

| Platform | Why Easy | Why Hard |
|----------|----------|----------|
| Claude Desktop | Standard mcpServers JSON | Three different OS paths |
| Cursor | Standard mcpServers JSON, single path across OSes | None |
| VS Code | JSON format | Different root key (`servers`), needs `type: "stdio"` field |
| Windsurf | Standard mcpServers JSON | Two different path patterns (macOS/Linux vs Windows) |
| Cline | Standard mcpServers JSON | Very long path with VS Code extension globalStorage |
| Zed | JSON format | Different root key (`context_servers`), config is full settings.json (must merge carefully into existing Zed settings) |
| Claude Code | No config file to manage | Requires `claude` CLI to be installed and in PATH |
| Codex | Simple structure | TOML format requires parser dependency |
| Gemini CLI | Standard mcpServers JSON | Lower adoption, fewer users |
| Continue | Supports JSON import | Primary format is YAML (array-based, not object-based) |

## Sources

- [add-mcp (Neon) -- npx add-mcp](https://github.com/neondatabase/add-mcp) -- 13-agent auto-installer with remove, sync, and registry search
- [install-mcp (Supermemory)](https://github.com/supermemoryai/install-mcp) -- 18-client installer, no uninstall
- [Anthropic Desktop Extensions](https://www.anthropic.com/engineering/desktop-extensions) -- .mcpb one-click install format
- [Claude Code MCP docs](https://code.claude.com/docs/en/mcp) -- `claude mcp add` command reference
- [Claude Desktop MCP setup](https://support.claude.com/en/articles/10949351-getting-started-with-local-mcp-servers-on-claude-desktop) -- config file paths
- [VS Code MCP configuration reference](https://code.visualstudio.com/docs/copilot/reference/mcp-configuration) -- `servers` root key (not `mcpServers`)
- [Windsurf Cascade MCP docs](https://docs.windsurf.com/windsurf/cascade/mcp) -- config path and format
- [Zed MCP docs](https://zed.dev/docs/ai/mcp) -- `context_servers` root key
- [Codex MCP config](https://developers.openai.com/codex/mcp) -- TOML format, `mcp_servers` key
- [Codex configuration reference](https://developers.openai.com/codex/config-reference) -- full TOML schema
- [Gemini CLI MCP docs](https://geminicli.com/docs/tools/mcp-server/) -- settings.json, `mcpServers` key
- [Continue MCP docs](https://docs.continue.dev/customize/deep-dives/mcp) -- YAML format, array-based mcpServers
- [Complete MCP config guide](https://mcpplaygroundonline.com/blog/complete-guide-mcp-config-files-claude-desktop-cursor-lovable) -- cross-platform path reference
- [Cursor MCP install deeplinks](https://cursor.com/docs/context/mcp/install-links) -- deeplink URL format

---
*Feature research for: MCP platform install flags (fsb-mcp-server v0.4.x)*
*Researched: 2026-04-15*
