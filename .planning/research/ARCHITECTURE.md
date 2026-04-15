# Architecture: MCP Platform Install Flags

**Domain:** CLI subcommand and config-file auto-writing for MCP platform onboarding
**Researched:** 2026-04-15
**Overall Confidence:** HIGH (based on direct analysis of existing CLI entry point + verified platform config schemas)

---

## Executive Summary

The `fsb-mcp-server` CLI (v0.4.0) already has a well-structured command routing architecture in `index.js` with a `parseArgs` function feeding a `switch` statement. Adding an `install` subcommand with `--<platform>` flags is a clean extension of this pattern -- no restructuring required.

The core architectural decision is: use a **platform registry map** where each platform entry declares its config file path (per OS), config format (JSON/TOML/YAML), root key (`mcpServers` vs `servers` vs `context_servers` vs `mcp_servers`), and the FSB server entry shape. A single `ConfigWriter` handles read-merge-write for all JSON-based platforms (8 of 10), with thin adapters for TOML (Codex) and YAML (Continue). The existing `setup` command becomes a fallback that prints instructions when no `--<platform>` flag is given, and the `install` subcommand replaces copy-paste with one-command auto-configuration.

---

## Existing CLI Architecture

### Entry Point: `mcp-server/build/index.js`

```
#!/usr/bin/env node

parseArgs(argv) -> { command: string, flags: Record<string,string|boolean> }
                          |
                          v
main() switch(command):
  'stdio'              -> runStdioServer()        [default]
  'serve' / 'http'     -> runHttpMode(flags)
  'status'             -> runStatus(flags)
  'doctor'             -> runDoctor(flags)
  'setup'              -> printSetup()             [sync, prints text]
  'wait-for-extension' -> runWaitForExtension(flags)
  'help'               -> printHelp()              [sync, prints text]
```

### Key Characteristics

1. **`parseArgs` already supports `--key value`, `--key=value`, and bare `--flag`** -- platform flags like `--claude-desktop` work without parser changes.
2. **First non-flag argument becomes the command** -- `fsb-mcp-server install --claude-desktop` sets `command = 'install'`.
3. **Flags are a flat `Record<string, string | boolean>`** -- no nested parsing, no positional args after the command.
4. **Helper functions `readStringFlag`, `readNumberFlag`, `isJson`** exist for typed flag access.
5. **No external CLI framework** (no yargs, commander, etc.) -- the parser is ~35 lines of hand-written code. Keep it that way.

### Existing `setup` Command

`printSetup()` is a sync function that writes a large template string to stdout with copy-paste install snippets for Claude Code, Claude Desktop, Cursor, and generic stdio/HTTP. It does NOT write any files. It includes a `buildCursorDeeplink()` helper.

---

## Proposed Architecture

### Command Routing Extension

Add two new cases to the `main()` switch:

```
main() switch(command):
  ...existing cases...
  'install'   -> runInstall(flags)    [NEW: async, writes config files]
  'uninstall' -> runUninstall(flags)  [NEW: async, removes FSB entry from config files]
```

**Why separate `install`/`uninstall` commands instead of `install --uninstall`:** Destructive operations deserve their own verb. `fsb-mcp-server uninstall --claude-desktop` is clearer than `fsb-mcp-server install --uninstall --claude-desktop`. It also prevents accidental uninstall from a misplaced flag.

**Alternative considered (rejected): `setup --write --claude-desktop`** -- Overloading `setup` mixes its existing role (print instructions) with destructive file writes. The `install` command is an explicit opt-in to file modification.

### Platform Registry Pattern

A static map defining all supported platforms. Each entry contains everything needed to locate, read, merge, and write the config file for that platform.

```typescript
interface PlatformConfig {
  /** Display name for user messages */
  displayName: string;

  /** CLI flag name (e.g., 'claude-desktop' -> --claude-desktop) */
  flag: string;

  /** Config file path per OS. null = not supported on that OS. */
  configPath: {
    darwin: string | null;
    win32: string | null;
    linux: string | null;
  };

  /** Config file format */
  format: 'json' | 'toml' | 'yaml';

  /** Root key for the server map inside the config file */
  serverMapKey: string;

  /** The FSB server entry to merge into the server map */
  serverEntry: Record<string, unknown>;

  /** Optional: CLI command alternative (e.g., Claude Code uses `claude mcp add`) */
  cliAlternative?: {
    command: string;
    description: string;
  };
}
```

### The Registry (All 10 Platforms)

| Platform | Flag | Format | Root Key | Path (macOS) | Path (Windows) | Path (Linux) |
|----------|------|--------|----------|-------------|----------------|-------------|
| Claude Desktop | `--claude-desktop` | JSON | `mcpServers` | `~/Library/Application Support/Claude/claude_desktop_config.json` | `%APPDATA%\Claude\claude_desktop_config.json` | `~/.config/Claude/claude_desktop_config.json` |
| Claude Code | `--claude-code` | n/a (CLI) | n/a | n/a | n/a | n/a |
| Cursor | `--cursor` | JSON | `mcpServers` | `~/.cursor/mcp.json` | `~/.cursor/mcp.json` | `~/.cursor/mcp.json` |
| VS Code | `--vscode` | JSON | `servers` | `~/.vscode/mcp.json` (user) | `~/.vscode/mcp.json` (user) | `~/.vscode/mcp.json` (user) |
| Windsurf | `--windsurf` | JSON | `mcpServers` | `~/.codeium/windsurf/mcp_config.json` | `~/.codeium/windsurf/mcp_config.json` | `~/.codeium/windsurf/mcp_config.json` |
| Cline | `--cline` | JSON | `mcpServers` | `~/Library/Application Support/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json` | `%APPDATA%/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json` | `~/.config/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json` |
| Zed | `--zed` | JSON | `context_servers` | `~/.zed/settings.json` | `%APPDATA%\Zed\settings.json` | `~/.config/zed/settings.json` |
| Codex | `--codex` | TOML | `mcp_servers` | `~/.codex/config.toml` | `~/.codex/config.toml` | `~/.codex/config.toml` |
| Gemini CLI | `--gemini` | JSON | `mcpServers` | `~/.gemini/settings.json` | `~/.gemini/settings.json` | `~/.gemini/settings.json` |
| Continue | `--continue` | YAML | `mcpServers` | `~/.continue/config.yaml` | `~/.continue/config.yaml` | `~/.continue/config.yaml` |

### FSB Server Entry Shapes

Most platforms use identical entry shapes (command + args). Notable exceptions:

**Standard (8 platforms):**
```json
{
  "command": "npx",
  "args": ["-y", "fsb-mcp-server"]
}
```

**Windows variant (auto-detected by OS, not user-facing):**
```json
{
  "command": "cmd",
  "args": ["/c", "npx", "-y", "fsb-mcp-server"]
}
```

**Zed requires no "source" field for direct settings.json entries:**
```json
{
  "command": "npx",
  "args": ["-y", "fsb-mcp-server"],
  "env": {}
}
```

**Codex (TOML):**
```toml
[mcp_servers.fsb]
command = "npx"
args = ["-y", "fsb-mcp-server"]
```

**Continue (YAML in mcpServers list, not map):**
```yaml
mcpServers:
  - name: fsb
    type: stdio
    command: npx
    args:
      - "-y"
      - "fsb-mcp-server"
```

**Claude Code (CLI command, not file write):**
```
claude mcp add fsb -- npx -y fsb-mcp-server
```

---

## Component Boundaries

### New Modules

| Module | Path | Responsibility | Exports |
|--------|------|---------------|---------|
| `platforms.ts` | `mcp-server/src/platforms.ts` | Platform registry map, OS path resolution, server entry shapes | `PLATFORMS`, `resolvePlatformConfigPath()`, `getPlatformServerEntry()` |
| `config-writer.ts` | `mcp-server/src/config-writer.ts` | Read-merge-write logic for JSON, TOML, YAML config files | `installToConfig()`, `uninstallFromConfig()` |
| `install.ts` | `mcp-server/src/install.ts` | CLI handler for `install`/`uninstall` commands, orchestrates platform detection + config writing | `runInstall()`, `runUninstall()` |

### Modified Modules

| Module | Path | Change |
|--------|------|--------|
| `index.ts` | `mcp-server/src/index.ts` | Add `'install'` and `'uninstall'` cases to the main switch, import `runInstall`/`runUninstall`, update `printHelp()` and `printSetup()` |
| `version.ts` | `mcp-server/src/version.ts` | No change needed (version already exported) |

### Unchanged Modules

All existing modules (`runtime.ts`, `server.ts`, `bridge.ts`, `queue.ts`, `diagnostics.ts`, `errors.ts`, `http.ts`, `tools/*`, `resources/*`, `prompts/*`) are completely untouched. The install feature is purely a CLI-side addition with zero runtime impact.

---

## Data Flow: Install

```
User: npx fsb-mcp-server install --claude-desktop
  |
  v
parseArgs(argv) -> { command: 'install', flags: { 'claude-desktop': true } }
  |
  v
runInstall(flags)
  |
  +-- 1. Detect which platform flags are set
  |     (iterate PLATFORMS registry, check flags[platform.flag])
  |
  +-- 2. For each matched platform:
  |     |
  |     +-- a. resolvePlatformConfigPath(platform, process.platform)
  |     |     -> Expand ~ to os.homedir(), %APPDATA% to env var
  |     |     -> Returns absolute path or null (unsupported OS)
  |     |
  |     +-- b. installToConfig(configPath, platform)
  |     |     |
  |     |     +-- Read existing file (if exists) or start with {}
  |     |     +-- Parse based on platform.format (JSON/TOML/YAML)
  |     |     +-- Check if FSB entry already exists under platform.serverMapKey
  |     |     |   -> If exists and identical: skip, print "already configured"
  |     |     |   -> If exists and different: warn, ask or overwrite with --force
  |     |     +-- Deep-merge: preserve all other server entries
  |     |     +-- Serialize back to original format
  |     |     +-- Write file (create parent dirs if needed)
  |     |     +-- Return result { status: 'created' | 'updated' | 'skipped', path }
  |     |
  |     +-- c. Print result for this platform
  |
  +-- 3. If no platform flags given:
  |     -> Print available platforms and usage hint
  |     -> Suggest `fsb-mcp-server setup` for manual instructions
  |
  +-- 4. Special case: --claude-code
        -> Shell out: `claude mcp add fsb -- npx -y fsb-mcp-server`
        -> Or print the command if `claude` is not in PATH
```

## Data Flow: Uninstall

```
User: npx fsb-mcp-server uninstall --claude-desktop
  |
  v
parseArgs(argv) -> { command: 'uninstall', flags: { 'claude-desktop': true } }
  |
  v
runUninstall(flags)
  |
  +-- 1. Same platform detection as install
  |
  +-- 2. For each matched platform:
  |     |
  |     +-- a. Resolve config path
  |     +-- b. uninstallFromConfig(configPath, platform)
  |     |     |
  |     |     +-- Read existing file
  |     |     +-- Parse based on format
  |     |     +-- Check if 'fsb' key exists under serverMapKey
  |     |     |   -> If not found: print "not configured", skip
  |     |     +-- Delete the 'fsb' key from the server map
  |     |     +-- If server map is now empty, delete the serverMapKey too
  |     |     +-- Serialize and write back
  |     |     +-- Return result { status: 'removed' | 'not-found', path }
  |     |
  |     +-- c. Print result
  |
  +-- 3. Special case: --claude-code
        -> Shell out: `claude mcp remove fsb`
```

---

## ConfigWriter Design: Shared Abstraction, Not Per-Platform Handlers

**Decision: One `ConfigWriter` module with format-specific read/write helpers, NOT per-platform handler classes.**

Rationale:
- 8 of 10 platforms use JSON with identical read-merge-write logic; only the root key name and file path differ.
- TOML (Codex) and YAML (Continue) need format-specific parsing but the merge logic is identical (find key in map, insert/delete entry).
- Per-platform handler classes would create 10 files with 95% identical code. A registry map + format-aware ConfigWriter is far cleaner.

### ConfigWriter Internal Structure

```typescript
// config-writer.ts

/** Read a config file, returning parsed object + raw string */
function readConfig(path: string, format: 'json' | 'toml' | 'yaml'): { data: object; raw: string } | null

/** Write a config object back to file */
function writeConfig(path: string, data: object, format: 'json' | 'toml' | 'yaml'): void

/** Merge FSB server entry into a parsed config, under the given root key */
function mergeServerEntry(config: object, rootKey: string, serverName: string, entry: object): MergeResult

/** Remove FSB server entry from a parsed config */
function removeServerEntry(config: object, rootKey: string, serverName: string): RemoveResult

/** High-level: read + merge + write */
export function installToConfig(path: string, platform: PlatformConfig): InstallResult

/** High-level: read + remove + write */
export function uninstallFromConfig(path: string, platform: PlatformConfig): UninstallResult
```

### Format-Specific Parsing

**JSON (8 platforms):** `JSON.parse` / `JSON.stringify` with 2-space indent. Native Node.js, zero dependencies.

**TOML (Codex):** Use a lightweight TOML library. Options:
- `@iarna/toml` (5KB, well-maintained, parse+stringify)
- `smol-toml` (3KB, modern, ESM-native)

Recommendation: `smol-toml` -- smaller, ESM-native (matches the project's ESM output), actively maintained.

**YAML (Continue):** Use `yaml` (npm package, ~70KB but tree-shakeable to ~20KB for parse+stringify). The standard choice; `js-yaml` is older and less maintained.

**Dependency impact:** Two new dependencies (`smol-toml`, `yaml`) for two platforms. These are dev/build-time only -- they get bundled by esbuild into the single `index.js` output. No runtime dependency increase for npm consumers.

### Continue YAML Special Case

Continue uses a YAML list for `mcpServers` (array of objects with `name` field), not a map. The merge logic must:
1. Parse the YAML
2. Find or create the `mcpServers` array
3. Search for an entry where `name === 'fsb'`
4. If found, replace it. If not, append it.
5. For uninstall, filter out the entry where `name === 'fsb'`

This is handled inside `mergeServerEntry`/`removeServerEntry` with a branch for `format === 'yaml' && platform.flag === 'continue'`.

### Zed settings.json Special Case

Zed's `settings.json` may contain settings beyond just MCP servers (editor settings, theme, keybindings, etc.). The merge must be surgical:
1. Read entire settings.json
2. Navigate to `context_servers` key (create if absent)
3. Add/remove only the `fsb` entry
4. Write back the entire file, preserving all other keys

This is the same pattern as all JSON platforms -- just a different root key.

### VS Code mcp.json Root Key Difference

VS Code uses `"servers"` as the root key, not `"mcpServers"`. This is the single most common setup mistake when copying configs between platforms. The registry map encodes this correctly so users never encounter this problem.

---

## Interaction with Existing `setup` Command

### Migration Path

The `setup` command currently prints copy-paste snippets. It should NOT be removed or broken -- it remains valuable as a reference and for platforms not yet in the registry.

**Changes to `setup`:**
1. Add a header line: `"Tip: Use 'fsb-mcp-server install --<platform>' for automatic setup."`
2. For each platform that has an `install` flag, add: `"Or auto-install: npx fsb-mcp-server install --claude-desktop"`
3. Keep all existing copy-paste snippets intact (they serve as documentation)

**No flag overlap.** `setup` is read-only (prints text). `install` is write (modifies files). They serve different purposes and can coexist cleanly.

---

## File Organization within `mcp-server/src/`

```
mcp-server/src/
  index.ts              [MODIFIED: add install/uninstall cases]
  install.ts            [NEW: runInstall(), runUninstall() CLI handlers]
  platforms.ts          [NEW: PLATFORMS registry, path resolution]
  config-writer.ts      [NEW: read/merge/write logic for JSON/TOML/YAML]
  version.ts            [unchanged]
  runtime.ts            [unchanged]
  server.ts             [unchanged]
  bridge.ts             [unchanged]
  queue.ts              [unchanged]
  diagnostics.ts        [unchanged]
  errors.ts             [unchanged]
  http.ts               [unchanged]
  types.ts              [unchanged]
  tools/                [unchanged]
  resources/            [unchanged]
  prompts/              [unchanged]
```

**Three new files, one modified file.** The install feature is fully contained in its own module boundary.

---

## Build Order Considerations

### esbuild Bundling

The existing build uses esbuild to produce `mcp-server/build/index.js` (single entry point, ESM output). New modules are imported from `index.ts` and automatically included in the bundle. No build config changes needed unless new npm dependencies require special handling.

### New Dependencies

| Dependency | Purpose | Size | Import Style |
|------------|---------|------|-------------|
| `smol-toml` | TOML parse/stringify for Codex | ~3KB | `import { parse, stringify } from 'smol-toml'` |
| `yaml` | YAML parse/stringify for Continue | ~20KB bundled | `import { parse, stringify } from 'yaml'` |

Both are ESM-compatible and will bundle cleanly with esbuild. They have zero transitive dependencies.

**Lazy import consideration:** Since TOML and YAML are only needed for 2 of 10 platforms, consider dynamic `import()` to avoid loading them for the common JSON case. However, since esbuild bundles everything into one file anyway, the dead code is already present. The runtime overhead of parsing unused modules is negligible. Static imports are simpler -- use those.

### Build Output

After build, the output remains a single `mcp-server/build/index.js` file with the shebang. The `bin` field in `package.json` continues to point there. No structural change to the published npm package.

### TypeScript Source Restoration

The `mcp-server/src/` directory is currently empty (TypeScript sources are not committed, only build output). The new feature needs TypeScript source files to be present for development. Options:

1. **Reconstruct from build output** -- The `.js` and `.d.ts` files in `build/` contain enough information to reconstruct the TypeScript source. This is a one-time effort.
2. **Write new modules in TypeScript, existing modules stay as build-only** -- New files (`install.ts`, `platforms.ts`, `config-writer.ts`) are authored in TypeScript. Existing build output is kept as-is until a full source restoration is done.

Recommendation: Option 2 is pragmatic. The new modules are self-contained and don't import from existing source files -- they only import from `./version.js` (for `FSB_MCP_VERSION`). The build step compiles the new `.ts` files and the existing `.js` files coexist in `build/`.

---

## Patterns to Follow

### Pattern 1: Registry-Driven Platform Support

All platform knowledge lives in the `PLATFORMS` map in `platforms.ts`. Adding a new platform means adding one entry to the map -- no new files, no new code paths. This is the same pattern used by the existing `FSB_ERROR_MESSAGES` map in `errors.ts`.

```typescript
// platforms.ts
export const PLATFORMS: Record<string, PlatformConfig> = {
  'claude-desktop': {
    displayName: 'Claude Desktop',
    flag: 'claude-desktop',
    configPath: {
      darwin: '~/Library/Application Support/Claude/claude_desktop_config.json',
      win32: '%APPDATA%/Claude/claude_desktop_config.json',
      linux: '~/.config/Claude/claude_desktop_config.json',
    },
    format: 'json',
    serverMapKey: 'mcpServers',
    serverEntry: { command: 'npx', args: ['-y', 'fsb-mcp-server'] },
  },
  // ... 9 more entries
};
```

### Pattern 2: Read-Before-Write with Preservation

Never truncate or overwrite the entire config file. Always:
1. Read existing content
2. Parse to object
3. Surgically modify only the FSB entry
4. Serialize and write back

This preserves user comments (in TOML/YAML, where parsers support roundtrip), other server entries, and custom configuration.

### Pattern 3: Fail-Safe with Informative Errors

If a config file exists but is malformed (invalid JSON, etc.), do NOT silently overwrite it. Instead:
1. Print the parse error with the file path
2. Suggest the user fix the file manually or use `--force` to overwrite
3. Exit with non-zero code

This prevents data loss from corrupted config files.

### Pattern 4: Deterministic Output Messages

Every install/uninstall operation prints exactly one status line per platform:

```
[FSB] Installed to Claude Desktop: ~/Library/Application Support/Claude/claude_desktop_config.json
[FSB] Already configured in Cursor: ~/.cursor/mcp.json (use --force to overwrite)
[FSB] Removed from Windsurf: ~/.codeium/windsurf/mcp_config.json
[FSB] Claude Code: run `claude mcp add fsb -- npx -y fsb-mcp-server`
[FSB] Skipped Codex: config file not found at ~/.codex/config.toml
```

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Per-Platform Handler Classes

**What:** Creating `ClaudeDesktopHandler`, `CursorHandler`, `VSCodeHandler`, etc. as separate classes/files.

**Why bad:** 10 classes with 95% identical logic. The only differences are path, root key, and format. A registry map captures these differences in data, not code.

**Instead:** One `PLATFORMS` map + one `ConfigWriter` module.

### Anti-Pattern 2: Interactive Prompts

**What:** Adding interactive confirmation prompts ("Are you sure you want to modify ~/.cursor/mcp.json? [y/n]").

**Why bad:** The CLI is invoked via `npx` -- it must work non-interactively for scripting, CI, and MCP host auto-install flows. Interactive prompts break `npx -y fsb-mcp-server install --cursor` in automated contexts.

**Instead:** Default to safe behavior (skip if already configured, never overwrite without `--force`). Print clear status messages so the user knows what happened.

### Anti-Pattern 3: Backup Files

**What:** Creating `claude_desktop_config.json.bak` before modifying.

**Why bad:** Leaves orphan files in platform-specific config directories that confuse users and may be picked up by other tools. The merge logic is already safe (read-modify-write preserves existing content).

**Instead:** If the user is concerned, they can use version control or manual backup. The tool's job is surgical, predictable modification.

### Anti-Pattern 4: Modifying `setup` to Write Files

**What:** Adding `--write` or `--auto` flags to the existing `setup` command to make it write config files.

**Why bad:** `setup` is established as a read-only informational command. Adding write semantics to it violates user expectations and the principle of least surprise.

**Instead:** `install` is the write command. `setup` remains read-only reference material.

---

## Edge Cases

### 1. Config File Does Not Exist

Create it with just the FSB entry under the appropriate root key. Create parent directories as needed with `fs.mkdirSync(dir, { recursive: true })`.

### 2. Config File Exists But Is Empty

Treat as if it does not exist (start with `{}`).

### 3. Config File Exists With Other Servers

Preserve all other entries. Only add/modify/remove the `fsb` key.

### 4. FSB Entry Already Exists With Identical Config

Print "already configured" and skip. No file write.

### 5. FSB Entry Already Exists With Different Config

Print warning showing the difference. Skip unless `--force` is passed. This handles the case where the user has customized their FSB entry (e.g., added env vars) and does not want it overwritten.

### 6. Platform Not Available on Current OS

If `configPath[process.platform]` is `null`, print that the platform is not supported on this OS and skip.

### 7. Multiple Platform Flags

`fsb-mcp-server install --claude-desktop --cursor --vscode` should install to all three. Process them sequentially, print status for each.

### 8. No Platform Flags Given

`fsb-mcp-server install` (no flags) should print usage help listing all available platforms, not silently do nothing.

### 9. Windows Path Resolution

`%APPDATA%` must be expanded from `process.env.APPDATA`. If the env var is not set, print an error and skip that platform.

### 10. `--all` Convenience Flag

`fsb-mcp-server install --all` installs to every platform whose config path exists on the current OS. Useful for power users who use multiple editors.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| CLI routing integration | HIGH | Direct analysis of existing `parseArgs` + `main()` in `index.js` |
| Platform config paths | HIGH | Verified via official docs for all 10 platforms |
| Config file formats | HIGH | JSON (8 platforms) is trivial; TOML/YAML verified via official docs |
| Root key names | HIGH | `mcpServers` (6), `servers` (1 - VS Code), `context_servers` (1 - Zed), `mcp_servers` (1 - Codex), list (1 - Continue) |
| Server entry shapes | HIGH | Standard `{ command, args }` for 9/10; Continue uses array-of-objects |
| Build integration | MEDIUM | esbuild bundling assumed from existing build output; no build config file found in repo to verify |

---

## Sources

- Direct analysis of `mcp-server/build/index.js` (CLI entry point, parseArgs, command routing)
- Direct analysis of `mcp-server/build/version.js` (constants, version)
- Direct analysis of `mcp-server/build/runtime.js` (createRuntime pattern)
- Direct analysis of `mcp-server/build/diagnostics.js` (status/doctor patterns)
- Direct analysis of `mcp-server/build/errors.js` (error map registry pattern)
- Direct analysis of `mcp-server/build/server.js` (server creation)
- [Claude Desktop config docs](https://support.claude.com/en/articles/10949351-getting-started-with-local-mcp-servers-on-claude-desktop) -- config file paths, JSON format
- [Claude Code MCP docs](https://code.claude.com/docs/en/mcp) -- `claude mcp add` CLI command
- [Cursor MCP docs](https://cursor.com/docs/context/mcp) -- `~/.cursor/mcp.json`, `mcpServers` key
- [VS Code MCP configuration reference](https://code.visualstudio.com/docs/copilot/reference/mcp-configuration) -- `mcp.json` with `servers` root key (NOT `mcpServers`)
- [Windsurf Cascade MCP Integration](https://docs.windsurf.com/windsurf/cascade/mcp) -- `~/.codeium/windsurf/mcp_config.json`
- [Cline MCP server configuration docs](https://docs.cline.bot/mcp/configuring-mcp-servers) -- VS Code globalStorage path
- [Zed MCP docs](https://zed.dev/docs/ai/mcp) -- `context_servers` in `settings.json`
- [Codex config reference](https://developers.openai.com/codex/config-reference) -- TOML format, `mcp_servers` table
- [Gemini CLI MCP docs](https://geminicli.com/docs/tools/mcp-server/) -- `~/.gemini/settings.json`, `mcpServers` key
- [Continue MCP docs](https://docs.continue.dev/customize/deep-dives/mcp) -- YAML config, `mcpServers` list
