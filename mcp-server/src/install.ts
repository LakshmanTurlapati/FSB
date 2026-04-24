import { PLATFORMS, resolvePlatformTarget, getServerEntry } from './platforms.js';
import type { PlatformConfig, PlatformTarget, ServerEntry } from './platforms.js';
import { installToConfig, removeFromConfig, serializeByFormat } from './config-writer.js';
import type { ConfigResult } from './config-writer.js';
import { FSB_MCP_VERSION, FSB_SERVER_NAME } from './version.js';
import { execSync } from 'node:child_process';

/** CLI flags parsed from argv */
export type InstallFlags = Record<string, boolean | string>;

/** Matched platform for file-based install/uninstall */
interface MatchedPlatform {
  key: string;
  platform: PlatformConfig;
}

/** Result of Claude Code CLI delegation */
interface ClaudeCodeResult {
  installed: boolean;
  skipped: boolean;
}

export interface SetupSection {
  title: string;
  lines: string[];
}

const STDIO_COMMAND = 'npx -y fsb-mcp-server';
const WINDOWS_STDIO_COMMAND = 'cmd /c npx -y fsb-mcp-server';

export function getClaudeCodeInstallCommand(): string {
  return 'claude mcp add --scope user ' + FSB_SERVER_NAME + ' -- ' + STDIO_COMMAND;
}

export function getInstallNextStep(platformKey: string, variant: string | null = null): string | null {
  switch (platformKey) {
    case 'claude-code':
      return 'Already active after add. If tools do not appear, run doctor and status --watch before retrying.';
    case 'claude-desktop':
      return 'Restart Claude Desktop after editing the MCP config.';
    case 'cursor':
      return 'Restart Cursor after editing ~/.cursor/mcp.json.';
    case 'vscode':
      return 'Open the MCP view in VS Code, trust/start the server if prompted, then reload VS Code if it does not start automatically.';
    case 'windsurf':
      return variant === 'plugin'
        ? 'In Windsurf or the JetBrains/Cascade plugin, refresh the MCP integration or reload the client after editing ~/.codeium/mcp_config.json.'
        : 'In Windsurf, refresh the MCP integration or reload the app after editing ~/.codeium/windsurf/mcp_config.json.';
    case 'codex':
      return 'Restart Codex or reload the MCP server list after editing ~/.codex/config.toml.';
    case 'cline':
      return 'Reload VS Code/Cline after editing the MCP settings file.';
    case 'zed':
      return 'Reload Zed after editing settings.json.';
    case 'gemini':
      return 'Restart Gemini CLI after editing settings.json if the new server does not appear immediately.';
    case 'continue':
      return 'Restart Continue or reload the host IDE after editing config.yaml.';
    default:
      return null;
  }
}

export function getSetupSections(httpEndpoint: string, cursorDeeplink: string): SetupSection[] {
  return [
    {
      title: 'Stdio command',
      lines: [
        'macOS / Linux:',
        '  ' + STDIO_COMMAND,
        'Windows:',
        '  ' + WINDOWS_STDIO_COMMAND,
      ],
    },
    {
      title: 'Local HTTP endpoint',
      lines: [
        '1. Start the server:',
        '  npx -y fsb-mcp-server serve',
        '2. Use this endpoint in any Streamable HTTP-capable client:',
        '  ' + httpEndpoint,
      ],
    },
    {
      title: 'Claude Code',
      lines: [
        'User-scoped install:',
        '  ' + getClaudeCodeInstallCommand(),
        'Next step:',
        '  ' + getInstallNextStep('claude-code'),
      ],
    },
    {
      title: 'Claude Desktop',
      lines: [
        'Config: claude_desktop_config.json',
        'Add:',
        '  {',
        '    "mcpServers": {',
        '      "fsb": {',
        '        "command": "npx",',
        '        "args": ["-y", "fsb-mcp-server"]',
        '      }',
        '    }',
        '  }',
        'Next step:',
        '  ' + getInstallNextStep('claude-desktop'),
      ],
    },
    {
      title: 'Codex CLI / Codex IDE',
      lines: [
        'Config: ~/.codex/config.toml',
        'Add:',
        '  [mcp_servers.fsb]',
        '  command = "npx"',
        '  args = ["-y", "fsb-mcp-server"]',
        'Next step:',
        '  ' + getInstallNextStep('codex'),
      ],
    },
    {
      title: 'VS Code',
      lines: [
        'Config: mcp.json',
        'Add:',
        '  {',
        '    "servers": {',
        '      "fsb": {',
        '        "type": "stdio",',
        '        "command": "npx",',
        '        "args": ["-y", "fsb-mcp-server"]',
        '      }',
        '    }',
        '  }',
        'Next step:',
        '  ' + getInstallNextStep('vscode'),
      ],
    },
    {
      title: 'Cursor',
      lines: [
        'Config: ~/.cursor/mcp.json',
        'Add:',
        '  {',
        '    "mcpServers": {',
        '      "fsb": {',
        '        "command": "npx",',
        '        "args": ["-y", "fsb-mcp-server"]',
        '      }',
        '    }',
        '  }',
        'Install deeplink:',
        '  ' + cursorDeeplink,
        'Next step:',
        '  ' + getInstallNextStep('cursor'),
      ],
    },
    {
      title: 'Windsurf',
      lines: [
        'Supported config paths:',
        '  ~/.codeium/windsurf/mcp_config.json',
        '  ~/.codeium/mcp_config.json',
        'Use the standard stdio entry:',
        '  {',
        '    "mcpServers": {',
        '      "fsb": {',
        '        "command": "npx",',
        '        "args": ["-y", "fsb-mcp-server"]',
        '      }',
        '    }',
        '  }',
        'Next step:',
        '  Press refresh in Windsurf or reload the client after editing the matching config file.',
      ],
    },
    {
      title: 'OpenCode (manual fallback)',
      lines: [
        'Config: ~/.config/opencode/opencode.json',
        'Add under the "mcp" object:',
        '  {',
        '    "mcp": {',
        '      "fsb": {',
        '        "type": "local",',
        '        "command": ["npx", "-y", "fsb-mcp-server"]',
        '      }',
        '    }',
        '  }',
        'Next step:',
        '  Restart OpenCode after saving the config.',
      ],
    },
    {
      title: 'OpenClaw',
      lines: [
        'Status: manual / unsupported for now.',
        'Why:',
        '  Official MCP config and HTTP behavior are still unstable across current OpenClaw builds.',
        'Fallback:',
        '  Use the stdio command manually only if your OpenClaw build documents a stable MCP format.',
      ],
    },
    {
      title: 'Troubleshooting first',
      lines: [
        '1. npx -y fsb-mcp-server doctor',
        '2. npx -y fsb-mcp-server status --watch',
        'Use these before restarting or reinstalling any client.',
      ],
    },
  ];
}

/**
 * Collect platforms whose flags are set and whose format is file-based (not CLI).
 * CLI-format platforms (Claude Code) are handled separately via handleClaudeCodeInstall().
 * @param flags - Parsed CLI flags (key -> boolean)
 * @returns Array of matched platform entries
 */
function getMatchedPlatforms(flags: InstallFlags): MatchedPlatform[] {
  const matched: MatchedPlatform[] = [];
  for (const [key, platform] of Object.entries(PLATFORMS)) {
    if (flags[key] === true && platform.format !== 'cli') {
      matched.push({ key, platform });
    }
  }
  return matched;
}

/**
 * Print a single result line with status icon.
 * @param result - Config operation result
 */
function printResult(result: ConfigResult): void {
  switch (result.status) {
    case 'created':
    case 'updated':
    case 'removed':
      console.log('\u2713 ' + result.message);
      break;
    case 'skipped':
    case 'not-found':
      console.log('\u25CB ' + result.message);
      break;
    case 'error':
      console.error('\u2717 ' + result.message);
      break;
  }
}

/**
 * Build and print the platform list block used by both install and uninstall usage.
 * Lists all 10 platforms from the registry with aligned display names.
 * @returns Formatted platform list
 */
function buildPlatformList(): string {
  const lines: string[] = [];
  for (const [, platform] of Object.entries(PLATFORMS)) {
    lines.push('  --' + platform.flag.padEnd(18) + platform.displayName);
  }
  return lines.join('\n');
}

/**
 * Print usage help for the install subcommand when no platform flags are provided.
 */
function printInstallUsage(): void {
  console.log('FSB MCP Server ' + FSB_MCP_VERSION);
  console.log('');
  console.log('Usage: fsb-mcp-server install --<platform>');
  console.log('');
  console.log('Platforms:');
  console.log(buildPlatformList());
  console.log('');
  console.log('Flags:');
  console.log('  --all               Install to all detected platforms');
  console.log('  --dry-run           Preview changes without modifying files');
}

/**
 * Print usage help for the uninstall subcommand when no platform flags are provided.
 */
function printUninstallUsage(): void {
  console.log('FSB MCP Server ' + FSB_MCP_VERSION);
  console.log('');
  console.log('Usage: fsb-mcp-server uninstall --<platform>');
  console.log('');
  console.log('Platforms:');
  console.log(buildPlatformList());
  console.log('');
  console.log('Flags:');
  console.log('  --all               Remove from all configured platforms');
  console.log('  --dry-run           Preview changes without modifying files');
}

/**
 * Print a dry-run preview for a file-based platform showing what would be written.
 * @param platform - Platform entry from PLATFORMS registry
 * @param configPath - Resolved config file path
 * @param entry - Server entry that would be installed
 */
function printDryRunPreview(target: PlatformTarget, entry: ServerEntry): void {
  console.log('[DRY RUN] ' + target.targetLabel);
  if (target.configPath) {
    console.log('  Config: ' + target.configPath);
  }
  // Wrap the single entry in the platform's root key structure for realistic preview
  const wrapper: Record<string, unknown> = {};
  const platform = target.platform;
  if (platform.format === 'yaml' && platform.serverMapKey === 'mcpServers') {
    // Continue uses array format
    wrapper[platform.serverMapKey] = [{ name: FSB_SERVER_NAME, ...entry }];
  } else {
    wrapper[platform.serverMapKey!] = { [FSB_SERVER_NAME]: entry };
  }
  const preview: string = serializeByFormat(wrapper, platform.format === 'jsonc' ? 'json' : platform.format);
  console.log('  Entry:');
  for (const line of preview.split('\n')) {
    if (line.trim()) console.log('    ' + line);
  }
}

/**
 * Handle Claude Code install via CLI delegation.
 * Shells out to `claude mcp add` with --scope user (FSB is user-global).
 * Falls back to printing the manual command if the CLI is not found.
 *
 * @param dryRun - If true, only print the command without executing
 * @returns Result indicating whether install succeeded or was skipped
 */
function handleClaudeCodeInstall(dryRun: boolean): ClaudeCodeResult {
  const cmd: string = getClaudeCodeInstallCommand();
  if (dryRun) {
    console.log('[DRY RUN] Claude Code');
    console.log('  Command: ' + cmd);
    return { installed: false, skipped: false };
  }
  try {
    execSync(cmd, { stdio: 'pipe', encoding: 'utf-8' });
    console.log('\u2713 Added to Claude Code');
    return { installed: true, skipped: false };
  } catch (err) {
    const execErr = err as { stdout?: string; stderr?: string };
    if (execErr.stdout?.includes('already exists') || execErr.stderr?.includes('already exists')) {
      console.log('\u25CB Claude Code already configured');
      return { installed: false, skipped: true };
    }
    console.log('\u25CB Claude CLI not found \u2014 run manually: ' + getClaudeCodeInstallCommand());
    return { installed: false, skipped: false };
  }
}

function getTargetPlatform(target: PlatformTarget): PlatformConfig {
  if (target.targetLabel === target.platform.displayName) {
    return target.platform;
  }
  return { ...target.platform, displayName: target.targetLabel };
}

/**
 * Install FSB into one or more platform config files.
 * Iterates matched JSON/JSONC platforms, resolves config paths, and calls installToConfig.
 * VS Code entries are augmented with type: "stdio" per PLAT-03.
 *
 * @param flags - Parsed CLI flags (platform keys mapped to boolean)
 */
export async function runInstall(flags: InstallFlags): Promise<void> {
  // Capture --all before expansion (Pitfall 4)
  const isAll: boolean = flags['all'] === true;

  // --all expansion: set all platform keys before matching
  if (isAll) {
    for (const key of Object.keys(PLATFORMS)) {
      flags[key] = true;
    }
  }
  let successCount = 0;
  let totalCount = 0;

  // Claude Code: CLI delegation (mirrors uninstall pattern)
  if (flags['claude-code'] === true) {
    const ccResult: ClaudeCodeResult = handleClaudeCodeInstall(flags['dry-run'] === true);
    totalCount++;
    if (ccResult.installed || flags['dry-run'] === true) {
      successCount++;
    }
    if (!isAll && flags['dry-run'] !== true && (ccResult.installed || ccResult.skipped)) {
      const nextStep = getInstallNextStep('claude-code');
      if (nextStep) {
        console.log('  Next step: ' + nextStep);
      }
    }
  }

  const matched: MatchedPlatform[] = getMatchedPlatforms(flags);

  if (matched.length === 0 && !flags['claude-code']) {
    printInstallUsage();
    return;
  }

  for (const { key, platform } of matched) {
    const target: PlatformTarget = resolvePlatformTarget(key);
    if (target.configPath === null) {
      if (isAll) {
        console.log('\u25CB Skipped ' + target.targetLabel + ' (not installed)');
      } else {
        console.log('\u25CB ' + target.targetLabel + ' is not supported on this OS');
      }
      totalCount++;
      continue;
    }

    if (isAll && flags['dry-run'] !== true && !target.detected) {
      console.log('\u25CB Skipped ' + target.targetLabel + ' (config path not detected)');
      totalCount++;
      continue;
    }

    // Build entry; VS Code requires type: "stdio" (PLAT-03)
    let entry: ServerEntry = getServerEntry();
    if (key === 'vscode') {
      entry = { type: 'stdio', ...entry };
    }

    if (flags['dry-run'] === true) {
      printDryRunPreview(target, entry);
      totalCount++;
      successCount++;
      continue;
    }

    const result: ConfigResult = await installToConfig(
      target.configPath,
      getTargetPlatform(target),
      FSB_SERVER_NAME,
      entry,
    );
    printResult(result);
    totalCount++;
    if (result.status === 'created' || result.status === 'updated') {
      successCount++;
    }
    if (!isAll && (result.status === 'created' || result.status === 'updated' || result.status === 'skipped')) {
      const nextStep = getInstallNextStep(key, target.variant);
      if (nextStep) {
        console.log('  Next step: ' + nextStep);
      }
    }
  }

  if (isAll) {
    const verb: string = flags['dry-run'] === true ? 'Would install to' : 'Installed to';
    console.log('');
    console.log(verb + ' ' + successCount + ' of ' + Object.keys(PLATFORMS).length + ' platforms');
  }
}

/**
 * Uninstall FSB from one or more platform config files.
 * Claude Code uses CLI delegation via execSync (UNINST-05).
 * JSON/JSONC platforms use removeFromConfig.
 *
 * @param flags - Parsed CLI flags (platform keys mapped to boolean)
 */
export async function runUninstall(flags: InstallFlags): Promise<void> {
  // Capture --all before expansion (Pitfall 4)
  const isAll: boolean = flags['all'] === true;

  // --all expansion: set all platform keys before matching
  if (isAll) {
    for (const key of Object.keys(PLATFORMS)) {
      flags[key] = true;
    }
  }
  let successCount = 0;
  let totalCount = 0;

  // Special case: Claude Code uninstall via CLI delegation (UNINST-05)
  if (flags['claude-code'] === true) {
    if (flags['dry-run'] === true) {
      console.log('[DRY RUN] Claude Code');
      console.log('  Command: claude mcp remove ' + FSB_SERVER_NAME);
      totalCount++;
      successCount++;
    } else {
      try {
        execSync('claude mcp remove ' + FSB_SERVER_NAME, { stdio: 'pipe', encoding: 'utf-8' });
        console.log('\u2713 Removed FSB from Claude Code');
        totalCount++;
        successCount++;
      } catch {
        if (isAll) {
          console.log('\u25CB Skipped Claude Code (CLI not found)');
        } else {
          console.log('\u25CB Claude Code: run manually: claude mcp remove ' + FSB_SERVER_NAME);
        }
        totalCount++;
      }
    }
  }

  const matched: MatchedPlatform[] = getMatchedPlatforms(flags);

  if (matched.length === 0 && !flags['claude-code']) {
    printUninstallUsage();
    return;
  }

  for (const { key, platform } of matched) {
    const target: PlatformTarget = resolvePlatformTarget(key);
    if (target.configPath === null) {
      if (isAll) {
        console.log('\u25CB Skipped ' + target.targetLabel + ' (not installed)');
      } else {
        console.log('\u25CB ' + target.targetLabel + ' is not supported on this OS');
      }
      totalCount++;
      continue;
    }

    if (isAll && flags['dry-run'] !== true && !target.detected) {
      console.log('\u25CB Skipped ' + target.targetLabel + ' (config path not detected)');
      totalCount++;
      continue;
    }

    if (flags['dry-run'] === true) {
      console.log('[DRY RUN] Would remove FSB from ' + target.targetLabel + ': ' + target.configPath);
      totalCount++;
      successCount++;
      continue;
    }

    const result: ConfigResult = await removeFromConfig(
      target.configPath,
      getTargetPlatform(target),
      FSB_SERVER_NAME,
    );
    printResult(result);
    totalCount++;
    if (result.status === 'removed') {
      successCount++;
    }
  }

  if (isAll) {
    const verb: string = flags['dry-run'] === true ? 'Would remove from' : 'Removed from';
    console.log('');
    console.log(verb + ' ' + successCount + ' of ' + Object.keys(PLATFORMS).length + ' platforms');
  }
}
