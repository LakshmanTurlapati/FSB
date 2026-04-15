# Pitfalls Research: MCP Platform Install Flags

**Domain:** Cross-platform config auto-writing for MCP server CLI (`fsb-mcp-server` npm package)
**Researched:** 2026-04-15
**Confidence:** HIGH (verified against official docs for 10 target platforms, cross-referenced with npm/write-file-atomic issues, MCP connector poisoning research, and Node.js cross-platform file path documentation)

---

## Critical Pitfalls

Mistakes that silently corrupt user configs, break existing MCP setups, or cause data loss.

---

### Pitfall 1: Destroying Existing Config by Naive JSON.stringify Write-back

**What goes wrong:**
The tool reads a config file, parses it with `JSON.parse()`, merges the FSB server entry, then writes back with `JSON.stringify(obj, null, 2)`. This silently destroys:
- **Comments** in JSONC files (VS Code `mcp.json`, Zed `settings.json`, Claude Desktop config all tolerate or use comments)
- **Trailing commas** that the user or editor inserted (VS Code settings commonly have trailing commas)
- **Property ordering** that the user carefully arranged (servers grouped by project, etc.)
- **Custom formatting** (indentation preferences, empty lines between sections)

After the write-back, the user's file is technically valid JSON but looks completely different, and all their annotations are gone.

**Why it happens:**
`JSON.parse()` strips comments and trailing commas (it throws on them in strict mode). `JSON.stringify()` produces canonical output with no memory of the original formatting. Developers test with clean files and never notice because their test fixtures have no comments or trailing commas.

**How to avoid:**
1. Use a JSONC-aware parser for all JSON config reads. The `jsonc-parser` package (used by VS Code itself, ~50KB) handles comments and trailing commas correctly and provides an `edit` function that returns minimal text edits rather than a full rewrite.
2. Never round-trip through `JSON.parse()` / `JSON.stringify()`. Instead, use text-level surgical insertion: find the right location in the file text, insert the new key-value pair, preserve everything else byte-for-byte.
3. The `jsonc-parser` `modify()` function does exactly this: it computes minimal edits to insert/replace a path in a JSONC document without touching surrounding content.
4. If a full rewrite is unavoidable (file was malformed), warn the user and create a backup first.

**Warning signs:**
- Unit tests only use `JSON.parse()` to read config files
- No JSONC-aware dependency in the project
- Test fixtures contain no comments, no trailing commas

**Phase to address:**
Core config read/write engine phase (Phase 1) -- the foundational read-modify-write logic must use JSONC-aware editing from day one, not retrofitted later.

---

### Pitfall 2: Different Top-Level Keys Across Platforms

**What goes wrong:**
The developer assumes all platforms use `"mcpServers"` as the top-level key (since Claude Desktop and Cursor do), then writes `{"mcpServers": {"fsb": {...}}}` into every platform's config. This silently fails on platforms that use different keys:
- **VS Code** uses `"servers"` (NOT `"mcpServers"`)
- **Zed** uses `"context_servers"` (NOT `"mcpServers"`)
- **Codex** uses `[mcp_servers.fsb]` in TOML (underscore, not camelCase)
- **Continue** uses a YAML list under `mcpServers:` with `- name:` entries (array, not object)

The config file is modified, the user sees "installed successfully," but the platform never loads FSB because it's looking for a different key.

**Why it happens:**
Claude Desktop and Cursor both use `"mcpServers"` and are the most common MCP hosts, so the developer generalizes from these two. The MCP protocol has no mandated config format -- each host invented its own.

**How to avoid:**
Build a platform registry with strict per-platform config schemas:

| Platform | File Format | Top-Level Key | Server Entry Shape |
|----------|-------------|---------------|--------------------|
| Claude Desktop | JSON | `mcpServers` | `{"command": ..., "args": [...]}` |
| Claude Code | JSON (via `claude mcp add` CLI or `.claude.json`) | N/A (use CLI) | CLI-based, not file write |
| Cursor | JSON | `mcpServers` | `{"command": ..., "args": [...]}` |
| VS Code | JSON | `servers` | `{"type": "stdio", "command": ..., "args": [...]}` |
| Windsurf | JSON | `mcpServers` | `{"command": ..., "args": [...]}` |
| Cline | JSON | `mcpServers` | `{"command": ..., "args": [...]}` |
| Zed | JSON (settings.json) | `context_servers` | `{"command": ..., "args": [...]}` |
| Codex | TOML | `[mcp_servers.fsb]` | `command = "npx"`, `args = [...]` |
| Gemini CLI | JSON | `mcpServers` | `{"command": ..., "args": [...]}` |
| Continue | YAML (config.yaml) or JSON (.continue/mcpServers/) | `mcpServers` (YAML list) | `- name: fsb`, `command: npx` |

Each platform flag must use its own template. No shared "generic MCP config" path.

**Warning signs:**
- A single `buildServerEntry()` function used for all platforms
- No per-platform test fixtures
- Any platform install path that doesn't have an explicit schema definition

**Phase to address:**
Platform registry phase (Phase 1) -- define all 10 platform schemas before writing any config mutation code.

---

### Pitfall 3: Windows Path and Environment Variable Expansion Failures

**What goes wrong:**
The tool hardcodes `~/Library/Application Support/Claude/claude_desktop_config.json` for macOS or uses `process.env.HOME` on Windows, where `HOME` is often undefined. Or it uses `%APPDATA%` as a literal string in `path.join()` instead of resolving it. The file write fails silently or creates a directory literally named `%APPDATA%` in the current working directory.

**Why it happens:**
Node.js does NOT expand `~` in file paths. `os.homedir()` works cross-platform but the config paths themselves differ across OS. Windows uses `%APPDATA%` (which resolves to `C:\Users\<user>\AppData\Roaming`), macOS uses `~/Library/Application Support/`, and Linux uses `~/.config/` or `$XDG_CONFIG_HOME`. Developers test on macOS, ship, and Windows users get broken installs.

**How to avoid:**
1. Use `os.homedir()` as the base, never raw `~` or `$HOME`.
2. On Windows, use `process.env.APPDATA` (NOT the literal string `%APPDATA%`) for APPDATA-based paths.
3. On Linux, check `process.env.XDG_CONFIG_HOME` first, fall back to `path.join(os.homedir(), '.config')`.
4. Build a `resolveConfigPath(platform)` function that returns the absolute path per-OS-per-platform:

```
Claude Desktop:
  macOS:   path.join(os.homedir(), 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json')
  Windows: path.join(process.env.APPDATA, 'Claude', 'claude_desktop_config.json')
  Linux:   path.join(xdgConfig(), 'Claude', 'claude_desktop_config.json')

Cursor:
  All:     path.join(os.homedir(), '.cursor', 'mcp.json')

VS Code (user-level):
  macOS:   path.join(os.homedir(), 'Library', 'Application Support', 'Code', 'User', 'mcp.json')
  Windows: path.join(process.env.APPDATA, 'Code', 'User', 'mcp.json')
  Linux:   path.join(xdgConfig(), 'Code', 'User', 'mcp.json')

Windsurf:
  macOS/Linux: path.join(os.homedir(), '.codeium', 'windsurf', 'mcp_config.json')
  Windows:     path.join(process.env.USERPROFILE, '.codeium', 'windsurf', 'mcp_config.json')

Cline:
  macOS:   path.join(os.homedir(), 'Library', 'Application Support', 'Code', 'User', 'globalStorage', 'saoudrizwan.claude-dev', 'settings', 'cline_mcp_settings.json')
  Windows: path.join(process.env.APPDATA, 'Code', 'User', 'globalStorage', 'saoudrizwan.claude-dev', 'settings', 'cline_mcp_settings.json')
  Linux:   path.join(xdgConfig(), 'Code', 'User', 'globalStorage', 'saoudrizwan.claude-dev', 'settings', 'cline_mcp_settings.json')

Zed:
  macOS:   path.join(os.homedir(), '.zed', 'settings.json')
  Linux:   path.join(xdgConfig(), 'zed', 'settings.json')
  Windows: path.join(process.env.APPDATA, 'Zed', 'settings.json')

Codex:
  All:     path.join(os.homedir(), '.codex', 'config.toml')

Gemini CLI:
  All:     path.join(os.homedir(), '.gemini', 'settings.json')

Continue:
  All:     path.join(os.homedir(), '.continue', 'config.yaml')
```

5. Always log the resolved absolute path before writing so the user can verify it.

**Warning signs:**
- `~` character appearing in `path.join()` calls
- `process.env.HOME` used without `os.homedir()` fallback
- No `process.platform` branching in path resolution
- Path tests only run on one OS

**Phase to address:**
Core path resolution phase (Phase 1) -- path resolution is the foundation for all subsequent config writes.

---

### Pitfall 4: Non-Atomic Writes Cause Config Corruption on Crash or Concurrent Access

**What goes wrong:**
The tool reads the config, modifies it in memory, then writes with `fs.writeFileSync()`. If the process crashes mid-write (user Ctrl+C, system crash, disk full), the config file is left truncated or empty. The user's existing MCP servers are gone. The platform refuses to start because the config is invalid JSON.

On Windows specifically, if the user has their IDE open (which may be watching the same config file), `fs.rename()` during atomic write can fail with EPERM because Windows Defender, the Windows Search indexer, or the IDE itself holds a transient lock on the file.

**Why it happens:**
`fs.writeFileSync()` is not atomic -- it truncates the file first, then writes. If interrupted between truncate and write-complete, the file is corrupted. The `write-file-atomic` package solves this by writing to a temp file then renaming, but it has known EPERM issues on Windows with concurrent access.

**How to avoid:**
1. Write to a temp file in the same directory first (e.g., `config.json.fsb-tmp`), then rename.
2. On Windows, implement a retry loop with exponential backoff (100ms, 200ms, 400ms) for EPERM/EACCES/EBUSY on rename.
3. Consider using `write-file-atomic` but be aware of its Windows limitations -- wrap it with retry logic.
4. Before writing, verify the temp file was written correctly by reading it back and checking it parses.
5. Set appropriate file permissions after write: `0o644` on Unix (user read-write, group/other read-only).

**Warning signs:**
- `fs.writeFileSync()` called directly on the target config file
- No error handling around the write operation
- No retry logic for Windows file locking errors
- Tests don't simulate interrupted writes

**Phase to address:**
Core config write engine phase (Phase 1) -- atomic write must be the default path, not an optimization added later.

---

### Pitfall 5: Clobbering User's Existing FSB Entry Without Merge

**What goes wrong:**
The user has already manually configured FSB with custom `env` variables (e.g., `FSB_BRIDGE_URL` pointing to a custom relay) or custom `args` (e.g., `["--port", "9999"]`). The auto-install flag overwrites their entry with the default `{"command": "npx", "args": ["-y", "fsb-mcp-server"]}`, silently destroying their customization. The user doesn't notice until their custom setup stops working.

**Why it happens:**
The simplest implementation does `config.mcpServers.fsb = defaultEntry`. This is a complete replacement, not a merge. The developer assumes no one has customized the entry because "it's auto-install."

**How to avoid:**
1. Before writing, check if an `fsb` entry already exists in the target config.
2. If it exists, compare with the default entry. If different, prompt the user: "FSB is already configured with custom settings. Overwrite? (y/n)" or print a warning and skip.
3. In non-interactive mode (e.g., `npx -y fsb-mcp-server install --claude-desktop`), default to SKIP if an existing entry is found. Add a `--force` flag to override.
4. Never silently merge -- the user's custom args may be intentional and incompatible with default args.

**Warning signs:**
- No existence check before writing the server entry
- No `--force` flag in the CLI
- Tests don't cover the "entry already exists" case

**Phase to address:**
Config merge logic phase (Phase 2) -- after the write engine works, add merge/conflict detection before any platform-specific logic.

---

### Pitfall 6: Writing to Zed's settings.json Breaks Non-MCP Settings

**What goes wrong:**
Zed stores ALL settings in one `settings.json` -- not just MCP servers, but editor config, themes, keybindings, language server settings, and more. A naive implementation that reads only `context_servers`, adds FSB, then writes back a file containing ONLY `{"context_servers": {"fsb": {...}}}` erases the user's entire Zed configuration. Similarly for Gemini CLI's `settings.json` which contains `selectedAuthType`, `theme`, `preferredEditor` alongside `mcpServers`.

**Why it happens:**
The developer treats the config file as if it only contains MCP server definitions. This is true for dedicated MCP config files (Claude Desktop, Cursor, Windsurf, Cline) but NOT for shared settings files (Zed, Gemini CLI, VS Code user settings).

**How to avoid:**
1. Categorize each platform's config file as either DEDICATED (only MCP config) or SHARED (mixed with other settings).
   - **Dedicated:** Claude Desktop, Cursor (`mcp.json`), Windsurf, Cline, VS Code (`mcp.json`), Continue
   - **Shared:** Zed (`settings.json`), Gemini CLI (`settings.json`), Codex (`config.toml`)
2. For SHARED files, use surgical insertion that only touches the MCP-related key. The `jsonc-parser` `modify()` function handles this: it adds/modifies a specific JSON path without touching other keys.
3. For DEDICATED files, a full write-back is safer but still use JSONC-aware editing to preserve comments.
4. Never construct the config file from scratch for SHARED files. If the file doesn't exist, create it with only the MCP key and a comment indicating other settings can be added.

**Warning signs:**
- Same write-back function used for all platforms without distinguishing dedicated vs. shared
- Tests use empty config files (which masks the "erase other settings" bug)
- No test fixtures that include non-MCP settings alongside MCP config

**Phase to address:**
Platform registry phase (Phase 1) -- tag each platform as DEDICATED or SHARED in the registry metadata. Config write engine must branch on this tag.

---

### Pitfall 7: TOML Round-Trip Destroys Comments and Formatting (Codex)

**What goes wrong:**
Codex uses TOML (`~/.codex/config.toml`) for configuration. The developer adds a TOML parser to handle this platform, parses the file, adds the `[mcp_servers.fsb]` section, stringifies back to TOML. TOML parsers (like `@iarna/toml`) don't preserve comments, and the stringified output reorders keys alphabetically, destroying the user's carefully organized config with inline comments like `# My primary code search server`.

Additionally, TOML has subtleties: `mcp_servers` (underscore) vs `mcp-servers` (hyphen) vs `mcpServers` (camelCase) -- Codex only recognizes `mcp_servers` with underscore. Using the wrong key name means Codex silently ignores the server.

**Why it happens:**
TOML comment preservation is even harder than JSON. Most TOML libraries parse into a data structure that discards comments entirely. The developer tests with a minimal config.toml and doesn't notice the formatting destruction.

**How to avoid:**
1. For TOML files, use text-level append rather than parse-modify-stringify. If `[mcp_servers.fsb]` doesn't exist, append the section to the end of the file.
2. Before appending, scan the file text for existing `[mcp_servers.fsb]` to avoid duplicates.
3. Use a regex or line-by-line scan to find the right insertion point, not a full TOML parse.
4. If the file doesn't exist, create it with just the `[mcp_servers.fsb]` section.
5. For uninstall, use text-level removal: find the `[mcp_servers.fsb]` header, remove all lines until the next `[` header or EOF.
6. Avoid adding `@iarna/toml` or any TOML library as a dependency -- text-level manipulation is sufficient for adding/removing a single known section.

**Warning signs:**
- A TOML parsing library appears in `dependencies`
- Config.toml tests don't include comments or non-MCP sections
- The TOML section name uses `mcpServers` or `mcp-servers` instead of `mcp_servers`

**Phase to address:**
Codex platform implementation phase (Phase 3) -- implement after JSON platforms work, using text-level append strategy.

---

### Pitfall 8: Continue's YAML Config Requires a Different Dependency Strategy

**What goes wrong:**
Continue.dev uses `config.yaml` (not JSON). The developer adds a YAML parser (`js-yaml`, ~100KB) to handle this single platform, bloating the npm package size. Alternatively, they try to write YAML by hand using string templates and produce invalid YAML due to indentation errors.

Additionally, Continue supports TWO config approaches: (1) a `mcpServers:` section in `~/.continue/config.yaml`, and (2) dropping a JSON file into `.continue/mcpServers/`. The developer implements only one approach and misses users who use the other.

**Why it happens:**
YAML is deceptively simple to generate but easy to break with wrong indentation. Adding a YAML parser adds significant weight to what should be a lightweight CLI tool (current dependencies: `@modelcontextprotocol/sdk`, `ws`, `zod` -- all necessary).

**How to avoid:**
1. For Continue, prefer the JSON file approach: write `~/.continue/mcpServers/fsb.json` as a standard JSON file. This avoids YAML parsing entirely.
2. The JSON file approach is officially supported by Continue and avoids modifying the user's primary config.yaml.
3. If YAML support is needed later, use a minimal template approach: hardcode the YAML snippet as a template string with correct indentation, don't parse/modify existing YAML.
4. Document in help text that the `--continue` flag creates a JSON file in `.continue/mcpServers/`, not modifying config.yaml.

**Warning signs:**
- `js-yaml` or `yaml` appears in `dependencies`
- YAML generation via string concatenation without indentation validation
- Continue support only handles one of the two config approaches

**Phase to address:**
Continue platform implementation phase (Phase 3) -- implement using the JSON mcpServers directory approach, avoiding YAML dependency entirely.

---

## Moderate Pitfalls

### Pitfall 9: Claude Code Should Use CLI, Not File Writes

**What goes wrong:**
The developer writes directly to `~/.claude.json` to add the FSB MCP server for Claude Code, mimicking how other platforms work. But Claude Code has its own MCP management via `claude mcp add`, and direct file writes may conflict with Claude Code's internal state, fail schema validation, or be overwritten on Claude Code restart.

**How to avoid:**
1. For the `--claude-code` flag, do NOT write to `~/.claude.json` directly.
2. Instead, print the exact CLI command: `claude mcp add fsb --scope user -- npx -y fsb-mcp-server` and optionally offer to execute it via `child_process.execSync()`.
3. Check if `claude` CLI is available before offering to execute.
4. Fall back to printing instructions if `claude` is not in PATH.

**Warning signs:**
- Direct file writes to `~/.claude.json` for Claude Code
- No `which claude` or `command -v claude` check
- Tests mock file writes for Claude Code instead of CLI execution

**Phase to address:**
Platform-specific implementations phase (Phase 2) -- implement as CLI delegation, not file write.

---

### Pitfall 10: Missing Parent Directories

**What goes wrong:**
The config file's parent directory doesn't exist yet. The user has never opened the platform, or it's a fresh install. `fs.writeFileSync()` throws ENOENT because the directory doesn't exist. The auto-install reports a confusing error or crashes.

This is especially common for:
- `~/.cursor/mcp.json` (user hasn't created .cursor dir)
- `~/.codeium/windsurf/mcp_config.json` (nested directories)
- `~/.continue/mcpServers/fsb.json` (double nesting)
- `~/.gemini/settings.json` (Gemini CLI never run)

**How to avoid:**
1. Before writing, create parent directories with `fs.mkdirSync(dir, { recursive: true })`.
2. When creating new directories, use mode `0o755` on Unix.
3. Log a note to the user when creating directories: "Created ~/.cursor/ (directory did not exist)".
4. Consider whether creating a config file for a platform the user hasn't installed is useful -- it might confuse them. Add a `--check` option that verifies the platform is installed before writing.

**Warning signs:**
- No `mkdirSync` with `recursive: true` before file writes
- Tests run in a temp directory that already has the parent structure
- No messaging to the user about directory creation

**Phase to address:**
Core config write engine phase (Phase 1) -- recursive directory creation must be part of the write path.

---

### Pitfall 11: Uninstall Leaves Empty Config or Removes Too Much

**What goes wrong (too much):**
The `--uninstall --claude-desktop` flag reads the config, does `delete config.mcpServers.fsb`, writes back. If FSB was the only server, the file now contains `{"mcpServers": {}}` which is fine, but some implementations delete the entire `mcpServers` key if empty, or worse, delete the file. If it's a shared settings file (Zed, Gemini), deleting the file destroys all other settings.

**What goes wrong (too little):**
The uninstall removes the FSB entry from one platform but the user had added FSB to multiple platforms. The user thinks they uninstalled FSB but it still shows up in another client.

**How to avoid:**
1. Uninstall should ONLY remove the `fsb` key from the server list, never remove the parent key or file.
2. For shared settings files, use surgical removal (same JSONC `modify()` with `undefined` value to delete a key).
3. For TOML (Codex), remove only the `[mcp_servers.fsb]` section and its contents.
4. After uninstall, print which file was modified and what was removed.
5. If the `fsb` key isn't found, print "FSB was not configured in [platform]" rather than erroring.
6. Consider an `--uninstall --all` flag that removes FSB from all known platforms at once.

**Warning signs:**
- Uninstall code path deletes files or parent keys
- No "not found" handling for missing FSB entries
- Tests only cover "remove from many servers" case, not "FSB is the only server"

**Phase to address:**
Uninstall logic phase (Phase 2) -- implement after install works, with explicit surgical removal tests.

---

### Pitfall 12: Windows Line Endings (CRLF) in Config Files

**What goes wrong:**
The tool writes JSON with LF line endings (`\n`) on Windows. The user opens the file in Notepad (which historically only showed CRLF correctly, though modern Notepad handles LF). More critically, if the file previously had CRLF line endings and the tool writes LF, git diff shows every line as changed, and some Windows tools may behave unexpectedly with mixed line endings.

**How to avoid:**
1. When reading an existing config file, detect the line ending style (check for `\r\n`).
2. When writing back, use the same line ending style as the original.
3. When creating a new file, use the OS default: `os.EOL` from Node.js.
4. This is low-severity for most cases (JSON parsers don't care about line endings) but important for user experience when they inspect the file.

**Warning signs:**
- Hardcoded `\n` in JSON.stringify separator or template strings
- No line ending detection on read
- Tests only run on macOS/Linux

**Phase to address:**
Config write engine hardening phase (Phase 2) -- after basic writes work, add line ending preservation.

---

### Pitfall 13: npm Package Size Bloat from Format Parsers

**What goes wrong:**
To support 10 platforms with JSON, JSONC, TOML, and YAML formats, the developer adds `jsonc-parser` (~50KB), `@iarna/toml` (~93KB), and `js-yaml` (~100KB) as production dependencies. The npm package grows from ~150KB to ~400KB+, slowing `npx -y fsb-mcp-server` cold starts (npx downloads the package on every invocation without cache).

**Why it happens:**
Each format needs a parser, and the obvious approach is to add a library per format. But `npx -y` downloads the full package + dependencies on every run, and package size directly affects user experience.

**How to avoid:**
1. **JSON/JSONC**: Use `jsonc-parser` (~50KB). This is the only parser dependency that's truly needed -- it handles the majority of platforms (8 of 10).
2. **TOML (Codex)**: Use text-level append/remove (no parser needed). Append a known TOML section template to the file. No dependency required.
3. **YAML (Continue)**: Use the JSON mcpServers directory approach instead. No YAML parser needed.
4. Net result: only one new dependency (`jsonc-parser`), ~50KB added.

**Warning signs:**
- More than one format parser in `dependencies`
- `npx -y fsb-mcp-server` cold start time exceeds 3 seconds
- `npm pack` output shows package size growing past 200KB

**Phase to address:**
Architecture decision phase (Phase 1) -- decide the format strategy before writing any platform code. Lock to "JSONC only + text-level TOML" early.

---

### Pitfall 14: Silently Writing Config When Platform Is Not Installed

**What goes wrong:**
The user runs `npx -y fsb-mcp-server install --zed` but doesn't have Zed installed. The tool creates `~/.zed/settings.json` with just the context_servers entry. Later, when the user actually installs Zed, it finds this unexpected settings file and may behave oddly, or Zed's own initialization overwrites the file, and the user's FSB config is lost.

**How to avoid:**
1. Before writing, do a lightweight check for whether the platform is actually installed:
   - Check if the config directory exists (e.g., `~/.zed/` for Zed)
   - Check if a known binary is in PATH (e.g., `which zed`, `which cursor`, `which code`)
   - Check if the config FILE already exists (strongest signal)
2. If the platform doesn't appear installed, warn: "Zed does not appear to be installed. Write config anyway? (y/N)"
3. In non-interactive mode, default to SKIP with a message about `--force`.

**Warning signs:**
- No platform-installed check before writing
- Tests always create the target directory in setUp
- No user confirmation flow

**Phase to address:**
Platform detection phase (Phase 2) -- add detection heuristics before implementing auto-install for each platform.

---

## Security Pitfalls

### Pitfall 15: Config File Permission Escalation on Unix

**What goes wrong:**
The tool creates a new config file with `fs.writeFileSync()` which inherits the process umask. If the user's umask is `0o000` (rare but possible in some CI environments), the file is created with mode `0o666` (world-readable and writable). Any local user can read and modify the MCP config, potentially adding malicious MCP servers.

**How to avoid:**
1. After creating a new file, explicitly set permissions: `fs.chmodSync(filePath, 0o644)`.
2. For existing files, preserve the original permissions. Read the file's mode before writing, apply the same mode after.
3. On Windows, file permissions work differently (ACLs), and `chmod` is a no-op. This is acceptable since Windows uses per-user AppData directories.

**Warning signs:**
- No `chmodSync` or `fchmodSync` call after file creation
- No stat check for existing file permissions

**Phase to address:**
Config write engine phase (Phase 1) -- add permission handling to the write path from the start.

---

### Pitfall 16: MCP Connector Poisoning Perception Risk

**What goes wrong:**
The FSB CLI auto-modifying files in the user's home directory makes it look like the MCP connector poisoning attack that security researchers have documented. The user or their security tooling sees an npm package modifying `~/.cursor/mcp.json` and flags it as suspicious behavior. Even if the modification is legitimate, the optics are bad.

**How to avoid:**
1. Make auto-install ALWAYS explicit and interactive (never as a postinstall script).
2. The install command should clearly explain what it will do BEFORE doing it:
   ```
   Will write to: /Users/foo/.cursor/mcp.json
   Changes: Add "fsb" server entry with command "npx -y fsb-mcp-server"
   Proceed? (y/N)
   ```
3. Support `--dry-run` to show what would change without writing.
4. Never use npm `postinstall` scripts to modify config files -- this is the primary attack vector for malicious packages.
5. Log all modifications to stderr so they appear in the user's terminal.

**Warning signs:**
- Any config modification happening in a lifecycle hook (postinstall, preinstall)
- No confirmation prompt or `--dry-run` support
- Silent writes with no terminal output

**Phase to address:**
UX/safety design phase (Phase 1) -- design the confirmation and dry-run flow before implementing writes.

---

### Pitfall 17: Command Injection via Untrusted Config Values

**What goes wrong:**
Less likely for FSB (which controls its own config template), but if the tool ever reads values from environment variables or user input to construct the server entry, those values could contain shell metacharacters. If the MCP host later spawns the command via a shell (some do), this becomes a command injection vector.

**How to avoid:**
1. Hardcode all config values in the install template. Never interpolate user-provided strings into command or args fields.
2. The `command` field should always be `"npx"` and `args` should always be `["-y", "fsb-mcp-server"]` (or `["cmd", "/c", "npx", "-y", "fsb-mcp-server"]` on Windows).
3. If user customization is needed in the future, validate inputs strictly.

**Warning signs:**
- `process.argv` or `process.env` values being interpolated into config templates
- Template literals used to construct JSON config entries

**Phase to address:**
All phases -- enforce template-only config values as a code review rule.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| `JSON.parse`/`JSON.stringify` round-trip | Simple, zero dependencies | Destroys comments, trailing commas, formatting in user configs | Never for user config files |
| Adding TOML/YAML parser deps | Proper parsing for 2 platforms | Package size bloat, more deps to maintain | Never -- use text-level TOML append and JSON-for-Continue instead |
| Skipping confirmation prompts | Faster UX, scriptable | Security perception issues, accidental overwrites | Only with explicit `--yes` flag |
| Single-OS testing | Faster CI, developer convenience | Windows bugs ship undetected, path resolution failures | Never for a cross-platform tool -- at minimum use path-mocking |
| Writing config without backup | Simpler code, faster writes | Unrecoverable config corruption if bugs exist | Only for DEDICATED config files that are trivially reconstructable |
| Hardcoding Cline's extension ID (`saoudrizwan.claude-dev`) | Works today | Breaks if Cline changes publisher or extension ID | Acceptable with version-pinned note; monitor for changes |

## Integration Gotchas

Common mistakes when integrating with each MCP host platform.

| Platform | Common Mistake | Correct Approach |
|----------|----------------|------------------|
| Claude Code | Writing to `~/.claude.json` directly | Use `claude mcp add` CLI with `--scope user` |
| VS Code | Using `"mcpServers"` as top-level key | Use `"servers"` as top-level key in `mcp.json` |
| VS Code | Writing to `settings.json` | Write to separate `mcp.json` (user-level or `.vscode/mcp.json`) |
| Zed | Overwriting entire `settings.json` | Surgically insert into `context_servers` key only |
| Codex | Using `mcpServers` or `mcp-servers` in TOML | Must use `mcp_servers` (underscore) -- Codex silently ignores other variants |
| Continue | Modifying `config.yaml` (YAML) | Drop a JSON file into `~/.continue/mcpServers/fsb.json` instead |
| Gemini CLI | Treating `settings.json` as MCP-only | It contains auth, theme, and editor preferences -- use surgical insert |
| Cursor | Assuming only global config | Cursor reads both `~/.cursor/mcp.json` (global) and `.cursor/mcp.json` (project-level) |
| Windsurf | Using `mcpServers` key | Windsurf also uses `mcpServers` but in `mcp_config.json` -- don't confuse with Cursor's `mcp.json` |
| All platforms | Assuming `npx` command works on Windows | Windows needs `npx.cmd` in some environments, or `cmd /c npx` wrapper |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Parsing large settings files with regex | Timeout on Zed settings with 1000+ lines | Use `jsonc-parser` which is streaming/efficient | Settings file > 500 lines |
| Synchronous file I/O blocking the CLI | Noticeable delay when writing to slow filesystems (network drives) | Use async I/O with `fs.promises` for the actual writes | Network-mounted home directory |
| Cold `npx` download on every install invocation | 3-5 second startup before install begins | Accept this -- it's inherent to `npx -y`. Note in docs that `npm install -g fsb-mcp-server` is faster for repeated use | Always with `npx -y` |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| No success/failure summary | User doesn't know if install worked | Print clear success message with the file path modified and a "verify" command |
| Printing raw JSON diffs | User can't understand what changed | Print human-readable summary: "Added FSB server to Cursor config at ~/.cursor/mcp.json" |
| Silent skip when entry already exists | User thinks install happened | Print explicit message: "FSB is already configured in Cursor. Use --force to overwrite." |
| No `--dry-run` option | User can't preview changes safely | Always support `--dry-run` showing the exact file and diff without writing |
| Error messages with stack traces | User is confused and alarmed | Catch errors, print friendly messages: "Could not write to ~/.cursor/mcp.json: Permission denied. Try running with sudo or check file permissions." |
| `--uninstall` with no confirmation | User accidentally removes config | Require `--yes` flag for uninstall, or prompt interactively |

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Path resolution:** Works on macOS dev machine -- verify Windows APPDATA paths actually resolve (test with `process.env.APPDATA` undefined)
- [ ] **JSONC preservation:** Round-trip test with a config containing `//` comments, `/* */` block comments, and trailing commas
- [ ] **Zed shared settings:** Test that writing FSB entry preserves ALL other Zed settings keys (theme, font, keybindings, language_overrides, etc.)
- [ ] **Gemini shared settings:** Test that writing FSB entry preserves `selectedAuthType`, `theme`, `preferredEditor`
- [ ] **Codex TOML section name:** Verify `mcp_servers` (underscore) -- not `mcpServers` or `mcp-servers`
- [ ] **Cline deep path:** Verify the full `globalStorage/saoudrizwan.claude-dev/settings/` path chain is created
- [ ] **Windows Defender interference:** Test write on Windows with real-time protection enabled -- watch for EPERM on rename
- [ ] **Empty file creation:** What happens when the target config file doesn't exist at all? Each platform needs a valid initial skeleton
- [ ] **Uninstall idempotency:** Running uninstall twice should not error or modify the file on the second run
- [ ] **npx on Windows:** Verify `"command": "npx"` works when spawned by each platform on Windows -- some need `npx.cmd`

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Config corruption (truncated file) | MEDIUM | Restore from `.fsb-backup` if backup was created; otherwise user re-creates manually |
| Comments destroyed by JSON.stringify | LOW | User re-adds comments; future installs use JSONC-aware editing |
| Wrong key used (e.g., `mcpServers` in VS Code) | LOW | User manually renames key to `servers`; fix in next release |
| Zed/Gemini settings erased | HIGH | No automated recovery. User must restore from editor backup, Time Machine, or git. Prevention is critical. |
| TOML section name wrong | LOW | User manually renames `mcpServers` to `mcp_servers` in config.toml |
| Windows EPERM during write | LOW | Retry the command; close IDE/antivirus temporarily |
| Config written for uninstalled platform | LOW | Delete the created file and directory |

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| P1: JSON.stringify destroys comments | Phase 1: Config Engine | Round-trip test with commented JSONC fixture |
| P2: Wrong top-level keys | Phase 1: Platform Registry | Per-platform schema validation tests |
| P3: Windows path failures | Phase 1: Path Resolution | CI tests on Windows (or mock `process.platform` and env vars) |
| P4: Non-atomic writes | Phase 1: Config Engine | Interrupt-simulation test (write to readonly target) |
| P5: Clobbering existing entries | Phase 2: Merge Logic | Test with pre-existing custom FSB entry |
| P6: Erasing shared settings | Phase 1: Platform Registry + Config Engine | Test with full Zed/Gemini settings fixture |
| P7: TOML comment destruction | Phase 3: Codex Implementation | Test with commented config.toml |
| P8: YAML dependency bloat | Phase 1: Architecture Decision | npm pack size check in CI |
| P9: Claude Code file write | Phase 2: Platform Implementations | Test that no file write occurs for `--claude-code` |
| P10: Missing parent directories | Phase 1: Config Engine | Test with non-existent parent dir |
| P11: Uninstall over-removal | Phase 2: Uninstall Logic | Test uninstall on shared settings file |
| P12: Windows CRLF | Phase 2: Write Hardening | Line ending detection test |
| P13: Package size bloat | Phase 1: Architecture Decision | `npm pack --dry-run` size assertion |
| P14: Writing for uninstalled platform | Phase 2: Platform Detection | Test with missing platform binary |
| P15: File permissions | Phase 1: Config Engine | Verify file mode after write on Unix |
| P16: Poisoning perception | Phase 1: UX Design | Confirmation prompt and `--dry-run` in CLI spec |
| P17: Command injection | All Phases | Code review rule: no user input in templates |

## Sources

- [VS Code MCP Configuration Reference](https://code.visualstudio.com/docs/copilot/reference/mcp-configuration) -- verified `"servers"` key (not `"mcpServers"`)
- [Zed MCP Documentation](https://zed.dev/docs/ai/mcp) -- verified `"context_servers"` key and settings.json structure
- [Codex MCP Configuration](https://developers.openai.com/codex/mcp) -- verified TOML `mcp_servers` key with underscore
- [Continue MCP Setup](https://docs.continue.dev/customize/deep-dives/mcp) -- verified JSON file in `.continue/mcpServers/` approach
- [Gemini CLI MCP Docs](https://geminicli.com/docs/tools/mcp-server/) -- verified `mcpServers` in `~/.gemini/settings.json`
- [Claude Code MCP Docs](https://code.claude.com/docs/en/mcp) -- verified `claude mcp add` CLI approach
- [Windsurf MCP Integration](https://docs.windsurf.com/windsurf/cascade/mcp) -- verified `~/.codeium/windsurf/mcp_config.json`
- [Cline MCP Configuration](https://docs.cline.bot/mcp/configuring-mcp-servers) -- verified deep `globalStorage/saoudrizwan.claude-dev/settings/` path
- [npm/write-file-atomic Windows EPERM Issue #28](https://github.com/npm/write-file-atomic/issues/28) -- Windows rename race condition
- [npm/write-file-atomic Windows EPERM Issue #227](https://github.com/npm/write-file-atomic/issues/227) -- fs.rename retry gap
- [MCP Connector Poisoning (dev.to)](https://dev.to/toniantunovic/mcp-connector-poisoning-how-compromised-npm-packages-hijack-your-ai-agent-3ha0) -- postinstall attack vector
- [Cursor MCP Documentation](https://cursor.com/docs/context/mcp) -- verified `mcpServers` key and deeplink format
- [Claude Desktop MCP Setup](https://support.claude.com/en/articles/10949351-getting-started-with-local-mcp-servers-on-claude-desktop) -- verified config paths per OS
- [Node.js Cross-Platform Filesystem Guide](https://github.com/ehmicky/cross-platform-node-guide/blob/main/docs/3_filesystem/directory_locations.md) -- path resolution patterns
- [jsonc-parser on npm](https://www.npmjs.com/package/jsonc-parser) -- JSONC-aware editing without comment loss

---
*Pitfalls research for: MCP Platform Install Flags (v0.9.30)*
*Researched: 2026-04-15*
