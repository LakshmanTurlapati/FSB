# Technology Stack: MCP Platform Install Flags

**Project:** FSB v0.9.30 - MCP Platform Install Flags
**Researched:** 2026-04-15
**Mode:** Ecosystem (Stack for subsequent milestone)
**Constraint:** TypeScript, ESM (`"type": "module"`), tsc build (NOT bundled), npm-distributed CLI
**Overall confidence:** HIGH

---

## Executive Summary

The `fsb-mcp-server` npm package (v0.4.0) needs to auto-write config files for 10 MCP platforms. The existing CLI already has a hand-rolled arg parser and a `setup` command that prints copy-paste snippets. The new feature replaces manual copy-paste with `fsb-mcp-server install --claude-desktop` (and 9 other platform flags).

Three new dependencies are needed. No more, no less:

1. **`smol-toml`** (103KB, zero deps) -- Parse and write TOML for Codex CLI's `~/.codex/config.toml`
2. **`yaml`** (685KB, zero deps) -- Parse and write YAML for Continue's `~/.continue/config.yaml`
3. **`strip-json-comments`** (8KB, zero deps) -- Strip comments and trailing commas from JSONC before `JSON.parse()` for VS Code and Zed config files

All three are ESM-native (or ESM-compatible), zero-dependency, and are the same libraries used by `add-mcp` (the Neon-maintained open-source MCP installer) -- a validated choice. Total added weight: ~796KB unpacked, ~0 transitive dependencies.

Everything else uses Node.js built-ins: `fs/promises` for file I/O, `os.homedir()` + `path.join()` + `process.platform` for cross-OS path resolution, `JSON.parse()`/`JSON.stringify()` for JSON config merging, and `child_process.execSync` for the Claude Code CLI path.

---

## Platform Config Matrix

**Confidence: HIGH** -- All paths and formats verified against official documentation.

| Platform | Config File Path (macOS) | Format | Root Key | Notes |
|---|---|---|---|---|
| Claude Desktop | `~/Library/Application Support/Claude/claude_desktop_config.json` | JSON | `mcpServers` | Windows: `%APPDATA%\Claude\`; Linux: `~/.config/claude-desktop/` |
| Claude Code | N/A (uses `claude mcp add` CLI) | CLI | N/A | Shell out to `claude mcp add fsb -- npx -y fsb-mcp-server`; fallback: print command |
| Cursor | `~/.cursor/mcp.json` | JSON | `mcpServers` | Also supports project-level `.cursor/mcp.json` |
| VS Code | `~/Library/Application Support/Code/User/mcp.json` | JSONC | `servers` | **Different root key** (`servers` not `mcpServers`); may contain `//` comments and trailing commas |
| Windsurf | `~/.codeium/windsurf/mcp_config.json` | JSON | `mcpServers` | Same structure as Claude Desktop/Cursor |
| Cline | `~/Library/Application Support/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json` | JSON | `mcpServers` | Long path; Windows uses `%APPDATA%/Code/User/globalStorage/...` |
| Zed | `~/.zed/settings.json` | JSONC | `context_servers` | **Different root key** AND **different server shape** (no wrapping object with `command`/`args` -- uses flat `command`+`args` directly) |
| Codex CLI | `~/.codex/config.toml` | TOML | `[mcp_servers.fsb]` | Underscore in section name is critical (`mcp_servers` not `mcp-servers`) |
| Gemini CLI | `~/.gemini/settings.json` | JSON | `mcpServers` | Same structure as Claude Desktop/Cursor |
| Continue | `~/.continue/config.yaml` | YAML | `mcpServers` (array) | **Array** of server objects (not object-of-objects); YAML format |

### Critical Format Variations

Three distinct config shapes exist across these 10 platforms:

**Shape A -- `mcpServers` object (6 platforms):** Claude Desktop, Cursor, Windsurf, Cline, Gemini CLI
```json
{ "mcpServers": { "fsb": { "command": "npx", "args": ["-y", "fsb-mcp-server"] } } }
```

**Shape B -- `servers` object (1 platform):** VS Code
```json
{ "servers": { "fsb": { "type": "stdio", "command": "npx", "args": ["-y", "fsb-mcp-server"] } } }
```

**Shape C -- `context_servers` object (1 platform):** Zed
```json
{ "context_servers": { "fsb": { "command": "npx", "args": ["-y", "fsb-mcp-server"] } } }
```

**Shape D -- TOML table (1 platform):** Codex CLI
```toml
[mcp_servers.fsb]
command = "npx"
args = ["-y", "fsb-mcp-server"]
```

**Shape E -- YAML array (1 platform):** Continue
```yaml
mcpServers:
  - name: FSB Browser Automation
    command: npx
    args:
      - "-y"
      - "fsb-mcp-server"
```

**Shape F -- CLI command (1 platform):** Claude Code
```bash
claude mcp add fsb -- npx -y fsb-mcp-server
```

---

## Recommended Stack Additions

### New Runtime Dependencies (3 total)

| Library | Version | Unpacked Size | Deps | Purpose | Why This One |
|---|---|---|---|---|---|
| `smol-toml` | ^1.6.1 | 103KB | 0 | Parse/stringify TOML for Codex CLI config | Fastest TOML parser on npm (2x faster than @iarna/toml), ESM-native, zero deps, TOML v1.1.0 compliant, both parse AND stringify (the `toml` package is parse-only). Used by `add-mcp`. |
| `yaml` | ^2.8.3 | 685KB | 0 | Parse/stringify YAML for Continue config | Zero deps, preserves comments on round-trip, full YAML 1.2 spec, both parse and stringify. The `js-yaml` alternative (386KB) has 1 dependency (`argparse`) and is slower at writing. The `yaml` package preserves document structure better for config file round-tripping. |
| `strip-json-comments` | ^5.0.3 | 8KB | 0 | Strip `//` comments and trailing commas from JSONC before `JSON.parse()` | 8KB, zero deps, ESM-native (v5+), handles both comments AND trailing commas. VS Code and Zed config files use JSONC format. The `jsonc-parser` alternative (213KB) is heavier and provides AST features we do not need. |

**Total added weight:** ~796KB unpacked (~30KB gzipped estimated). Zero transitive dependencies added.

### Why NOT These Alternatives

| Category | Rejected | Why |
|---|---|---|
| TOML | `@iarna/toml` (2.2.5) | 2x slower than smol-toml, CJS-only (no native ESM), last published 2020 |
| TOML | `toml` (3.0.0) | Parse-only -- cannot stringify back to TOML. We need both directions for safe merge. |
| YAML | `js-yaml` (4.1.1) | Has 1 dependency (argparse), slower at writing, does not preserve comments on round-trip |
| JSONC | `jsonc-parser` (3.3.1) | 213KB with full AST/edit API we do not need. We only need to strip comments before `JSON.parse()` |
| JSONC | `comment-json` (5.0.0) | Has 2 dependencies (array-timsort, esprima), heavier than strip + JSON.parse |
| Full installer | `add-mcp` (1.8.0) | CLI-only, no programmatic API, adds 6 transitive dependencies (chalk, commander, clack, etc.), cannot be imported as a library |

### No New Dev Dependencies

The existing dev stack is sufficient:
- `typescript` ^5.9.3 -- Already present
- `@types/node` ^22 -- Already present
- `tsx` ^4.19 -- Already present for dev mode

Type definitions for `smol-toml`, `yaml`, and `strip-json-comments` are included in their packages (all ship `.d.ts` files).

---

## Built-in Node.js Capabilities (No Libraries Needed)

### Cross-OS Path Resolution

**Confidence: HIGH** -- Standard Node.js APIs, well-documented.

```typescript
import { homedir } from 'node:os';
import { join } from 'node:path';

function getConfigPath(platform: string): string {
  const home = homedir();
  const os = process.platform; // 'darwin' | 'win32' | 'linux'

  switch (platform) {
    case 'claude-desktop':
      if (os === 'darwin') return join(home, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
      if (os === 'win32') return join(process.env.APPDATA!, 'Claude', 'claude_desktop_config.json');
      return join(home, '.config', 'claude-desktop', 'claude_desktop_config.json');
    // ... etc
  }
}
```

`os.homedir()`, `path.join()`, `process.platform`, and `process.env.APPDATA` cover all cross-OS needs without any external package.

### JSON Merging

**Confidence: HIGH** -- Built-in `JSON.parse()` + `JSON.stringify()` with spread/Object.assign.

```typescript
// Read existing config, merge FSB entry, write back
const existing = JSON.parse(await readFile(configPath, 'utf-8'));
existing.mcpServers = existing.mcpServers ?? {};
existing.mcpServers.fsb = { command: 'npx', args: ['-y', 'fsb-mcp-server'] };
await writeFile(configPath, JSON.stringify(existing, null, 2) + '\n');
```

No deep-merge library needed. MCP server entries are shallow objects. We replace the entire `fsb` key, preserving all other servers.

### File Backup Before Modification

**Confidence: HIGH** -- `fs.copyFile()` built-in.

```typescript
import { copyFile } from 'node:fs/promises';

// Back up before modifying
await copyFile(configPath, `${configPath}.bak`);
```

No library needed. Simple timestamp-suffixed backup (`config.json.bak` or `config.json.1713200000.bak`).

### CLI Arg Parsing

**Confidence: HIGH** -- Existing hand-rolled parser is sufficient.

The existing `parseArgs()` in `index.ts` already handles `--flag`, `--flag value`, `--flag=value`, and `-h`/`-j` short flags. For the new feature, we add:

```typescript
// New command: install
// New flags: --claude-desktop, --claude-code, --cursor, --vscode, --windsurf, --cline, --zed, --codex, --gemini, --continue
// Optional: --uninstall (modifier flag)
// Optional: --all (install to all detected platforms)
```

No need for `commander`, `yargs`, or `meow`. The existing parser handles boolean flags natively. Platform flags are all boolean (no values).

### Shelling Out to Claude Code CLI

**Confidence: MEDIUM** -- Depends on `claude` being in PATH.

```typescript
import { execSync } from 'node:child_process';

try {
  execSync('claude mcp add fsb -- npx -y fsb-mcp-server', { stdio: 'inherit' });
} catch {
  console.log('Could not run "claude mcp add". Run this manually:');
  console.log('  claude mcp add fsb -- npx -y fsb-mcp-server');
}
```

Fallback to printing the command if `claude` is not in PATH.

---

## Integration Points with Existing Code

### Build System

The project uses `tsc` (TypeScript compiler) -- NOT esbuild. Dependencies are NOT bundled into the output; they remain in `node_modules` and are resolved at runtime via Node.js module resolution. This means:

- New dependencies are added to `dependencies` in `package.json` (not `devDependencies`)
- They are installed when users run `npx -y fsb-mcp-server`
- Bundle size matters less than install weight (npm download size)
- No esbuild/webpack configuration changes needed

### CLI Entry Point (`src/index.ts`)

The new `install` command slots into the existing `switch (command)` block in `main()`:

```typescript
case 'install':
  await runInstall(flags);
  return;
case 'uninstall':
  await runUninstall(flags);
  return;
```

### New Source Files

| File | Purpose | Est. Lines |
|---|---|---|
| `src/install.ts` | Main install/uninstall orchestrator | 150-200 |
| `src/platforms.ts` | Platform registry (paths, formats, shapes) | 200-250 |
| `src/config-writers/json.ts` | Read/merge/write JSON config (with JSONC strip for VS Code/Zed) | 80-100 |
| `src/config-writers/toml.ts` | Read/merge/write TOML config for Codex | 60-80 |
| `src/config-writers/yaml.ts` | Read/merge/write YAML config for Continue | 60-80 |
| `src/config-writers/cli.ts` | Shell out to `claude mcp add` for Claude Code | 40-50 |
| `src/backup.ts` | File backup utility | 30-40 |

### Package.json Changes

```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.27.1",
    "ws": "^8.19.0",
    "zod": "^3.24.0",
    "smol-toml": "^1.6.1",
    "yaml": "^2.8.3",
    "strip-json-comments": "^5.0.3"
  }
}
```

Going from 3 to 6 runtime dependencies. All three additions are zero-dep, so the total transitive dependency count stays low.

---

## What NOT to Add

| Do Not Add | Why |
|---|---|
| `commander` / `yargs` / `meow` | Existing hand-rolled parser works. Adding a CLI framework for 10 boolean flags is overkill and adds 100KB+ |
| `chalk` / `picocolors` | Color output is nice-to-have but unnecessary for a CLI that runs once at setup time. Use plain text with clear formatting |
| `inquirer` / `@clack/prompts` | No interactive prompts needed. The install command is non-interactive by design (`--claude-desktop` flag, not a menu) |
| `deep-merge` / `lodash.merge` | MCP server entries are shallow objects. `Object.assign` / spread is sufficient |
| `platform-folders` / `env-paths` | Custom path logic for 10 specific platforms is clearer than a generic abstraction. We know exactly which paths we need. |
| `add-mcp` as dependency | CLI-only (no library API), would add 6 transitive deps, and we need custom output formatting |
| `jsonc-parser` | Full AST is overkill. `strip-json-comments` + `JSON.parse()` is simpler and 26x smaller |
| `@iarna/toml` | CJS-only, slower, last updated 2020. `smol-toml` is actively maintained and ESM-native |
| `fast-toml` | Not spec-compliant (skips string validation), no stringify support |

---

## Installation

```bash
cd mcp-server

# Add new runtime dependencies
npm install smol-toml@^1.6.1 yaml@^2.8.3 strip-json-comments@^5.0.3

# No new dev dependencies needed
```

---

## Confidence Assessment

| Area | Confidence | Reason |
|---|---|---|
| Platform config paths | HIGH | Verified against official docs for all 10 platforms |
| Config file formats | HIGH | Verified JSON/JSONC/TOML/YAML structures from official docs |
| Library choices | HIGH | All three libraries are mature, zero-dep, ESM-compatible, used by production tools (add-mcp) |
| Cross-OS path resolution | HIGH | Standard Node.js APIs, well-documented patterns |
| CLI integration | HIGH | Existing parseArgs() easily extended, no framework needed |
| Build system compatibility | HIGH | tsc compilation, dependencies stay in node_modules |
| Claude Code CLI integration | MEDIUM | Depends on `claude` binary being in PATH; fallback to print-command is robust |
| JSONC handling (VS Code/Zed) | MEDIUM | strip-json-comments handles comments + trailing commas, but user config files could have edge cases (e.g., multi-line comments with TOML-like syntax) |

---

## Sources

### Official Platform Documentation
- [Claude Desktop config](https://modelcontextprotocol.io/docs/develop/connect-local-servers) -- config path and JSON format
- [Claude Code MCP](https://code.claude.com/docs/en/mcp) -- `claude mcp add` command and scopes
- [Cursor MCP docs](https://cursor.com/docs/context/mcp) -- `~/.cursor/mcp.json` path and format
- [VS Code MCP configuration](https://code.visualstudio.com/docs/copilot/reference/mcp-configuration) -- `servers` root key (not `mcpServers`), JSONC format
- [Windsurf MCP](https://docs.windsurf.com/windsurf/cascade/mcp) -- `~/.codeium/windsurf/mcp_config.json`
- [Cline MCP](https://docs.cline.bot/mcp/adding-and-configuring-servers) -- long globalStorage path
- [Zed MCP](https://zed.dev/docs/ai/mcp) -- `context_servers` root key, JSONC settings.json
- [Codex CLI MCP](https://developers.openai.com/codex/mcp) -- TOML format, `mcp_servers` with underscore
- [Gemini CLI MCP](https://geminicli.com/docs/tools/mcp-server/) -- `~/.gemini/settings.json`, `mcpServers` root key
- [Continue MCP](https://docs.continue.dev/customize/deep-dives/mcp) -- YAML format, array-of-objects

### Library Documentation
- [smol-toml](https://github.com/squirrelchat/smol-toml) -- v1.6.1, ESM, zero deps, TOML v1.1.0
- [yaml](https://github.com/eemeli/yaml) -- v2.8.3, zero deps, YAML 1.2
- [strip-json-comments](https://github.com/sindresorhus/strip-json-comments) -- v5.0.3, ESM, zero deps
- [add-mcp](https://github.com/neondatabase/add-mcp) -- Reference implementation using @iarna/toml, js-yaml, jsonc-parser (Apache-2.0)

### npm Registry (version/size verification)
- `npm view smol-toml version dist.unpackedSize` -- 1.6.1, 103KB
- `npm view yaml version dist.unpackedSize` -- 2.8.3, 685KB
- `npm view strip-json-comments version dist.unpackedSize` -- 5.0.3, 8KB
