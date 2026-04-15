import { PLATFORMS, resolvePlatformConfig, getServerEntry } from './platforms.js';
import { installToConfig, removeFromConfig, serializeByFormat } from './config-writer.js';
import { FSB_MCP_VERSION, FSB_SERVER_NAME } from './version.js';
import { execSync } from 'node:child_process';

/**
 * Collect platforms whose flags are set and whose format is file-based (not CLI).
 * CLI-format platforms (Claude Code) are handled separately via handleClaudeCodeInstall().
 * @param {object} flags - Parsed CLI flags (key -> boolean)
 * @returns {Array<{key: string, platform: object}>}
 */
function getMatchedPlatforms(flags) {
  const matched = [];
  for (const [key, platform] of Object.entries(PLATFORMS)) {
    if (flags[key] === true && platform.format !== 'cli') {
      matched.push({ key, platform });
    }
  }
  return matched;
}

/**
 * Print a single result line with status icon.
 * @param {{status: string, message: string}} result
 */
function printResult(result) {
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
 * @returns {string} Formatted platform list
 */
function buildPlatformList() {
  const lines = [];
  for (const [, platform] of Object.entries(PLATFORMS)) {
    lines.push('  --' + platform.flag.padEnd(18) + platform.displayName);
  }
  return lines.join('\n');
}

/**
 * Print usage help for the install subcommand when no platform flags are provided.
 */
function printInstallUsage() {
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
function printUninstallUsage() {
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
 * @param {object} platform - Platform entry from PLATFORMS registry
 * @param {string} configPath - Resolved config file path
 * @param {object} entry - Server entry that would be installed
 */
function printDryRunPreview(platform, configPath, entry) {
  console.log('[DRY RUN] ' + platform.displayName);
  if (configPath) {
    console.log('  Config: ' + configPath);
  }
  // Wrap the single entry in the platform's root key structure for realistic preview
  const wrapper = {};
  if (platform.format === 'yaml' && platform.serverMapKey === 'mcpServers') {
    // Continue uses array format
    wrapper[platform.serverMapKey] = [{ name: FSB_SERVER_NAME, ...entry }];
  } else {
    wrapper[platform.serverMapKey] = { [FSB_SERVER_NAME]: entry };
  }
  const preview = serializeByFormat(wrapper, platform.format === 'jsonc' ? 'json' : platform.format);
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
 * @returns {{installed: boolean, skipped: boolean}}
 */
function handleClaudeCodeInstall(dryRun) {
  const cmd = 'claude mcp add --scope user ' + FSB_SERVER_NAME + ' -- npx -y fsb-mcp-server';
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
    if (err.stdout?.includes('already exists') || err.stderr?.includes('already exists')) {
      console.log('\u25CB Claude Code already configured');
      return { installed: false, skipped: true };
    }
    console.log('\u25CB Claude CLI not found \u2014 run manually: claude mcp add ' + FSB_SERVER_NAME + ' -- npx -y fsb-mcp-server');
    return { installed: false, skipped: false };
  }
}

/**
 * Install FSB into one or more platform config files.
 * Iterates matched JSON/JSONC platforms, resolves config paths, and calls installToConfig.
 * VS Code entries are augmented with type: "stdio" per PLAT-03.
 *
 * @param {object} flags - Parsed CLI flags (platform keys mapped to boolean)
 */
export async function runInstall(flags) {
  // --all expansion: set all platform keys before matching (Pitfall 4)
  if (flags.all === true || flags['all'] === true) {
    for (const key of Object.keys(PLATFORMS)) {
      flags[key] = true;
    }
  }

  const isAll = flags.all === true || flags['all'] === true;
  let successCount = 0;
  let totalCount = 0;

  // Claude Code: CLI delegation (mirrors uninstall pattern)
  if (flags['claude-code'] === true) {
    const ccResult = handleClaudeCodeInstall(flags['dry-run'] === true);
    totalCount++;
    if (ccResult.installed || flags['dry-run'] === true) {
      successCount++;
    }
  }

  const matched = getMatchedPlatforms(flags);

  if (matched.length === 0 && !flags['claude-code']) {
    printInstallUsage();
    return;
  }

  for (const { key, platform } of matched) {
    const configPath = resolvePlatformConfig(key);
    if (configPath === null) {
      if (isAll) {
        console.log('\u25CB Skipped ' + platform.displayName + ' (not installed)');
      } else {
        console.log('\u25CB ' + platform.displayName + ' is not supported on this OS');
      }
      totalCount++;
      continue;
    }

    // Build entry; VS Code requires type: "stdio" (PLAT-03)
    let entry = getServerEntry();
    if (key === 'vscode') {
      entry = { type: 'stdio', ...entry };
    }

    if (flags['dry-run'] === true) {
      printDryRunPreview(platform, configPath, entry);
      totalCount++;
      successCount++;
      continue;
    }

    const result = await installToConfig(configPath, platform, FSB_SERVER_NAME, entry);
    printResult(result);
    totalCount++;
    if (result.status === 'created' || result.status === 'updated') {
      successCount++;
    }
  }

  if (isAll) {
    const verb = flags['dry-run'] === true ? 'Would install to' : 'Installed to';
    console.log('');
    console.log(verb + ' ' + successCount + ' of ' + Object.keys(PLATFORMS).length + ' platforms');
  }
}

/**
 * Uninstall FSB from one or more platform config files.
 * Claude Code uses CLI delegation via execSync (UNINST-05).
 * JSON/JSONC platforms use removeFromConfig.
 *
 * @param {object} flags - Parsed CLI flags (platform keys mapped to boolean)
 */
export async function runUninstall(flags) {
  // --all expansion: set all platform keys before matching (Pitfall 4)
  if (flags.all === true || flags['all'] === true) {
    for (const key of Object.keys(PLATFORMS)) {
      flags[key] = true;
    }
  }

  const isAll = flags.all === true || flags['all'] === true;
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

  const matched = getMatchedPlatforms(flags);

  if (matched.length === 0 && !flags['claude-code']) {
    printUninstallUsage();
    return;
  }

  for (const { key, platform } of matched) {
    const configPath = resolvePlatformConfig(key);
    if (configPath === null) {
      if (isAll) {
        console.log('\u25CB Skipped ' + platform.displayName + ' (not installed)');
      } else {
        console.log('\u25CB ' + platform.displayName + ' is not supported on this OS');
      }
      totalCount++;
      continue;
    }

    if (flags['dry-run'] === true) {
      console.log('[DRY RUN] Would remove FSB from ' + platform.displayName + ': ' + configPath);
      totalCount++;
      successCount++;
      continue;
    }

    const result = await removeFromConfig(configPath, platform, FSB_SERVER_NAME);
    printResult(result);
    totalCount++;
    if (result.status === 'removed') {
      successCount++;
    }
  }

  if (isAll) {
    const verb = flags['dry-run'] === true ? 'Would remove from' : 'Removed from';
    console.log('');
    console.log(verb + ' ' + successCount + ' of ' + Object.keys(PLATFORMS).length + ' platforms');
  }
}
