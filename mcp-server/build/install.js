import { PLATFORMS, resolvePlatformConfig, getServerEntry } from './platforms.js';
import { installToConfig, removeFromConfig } from './config-writer.js';
import { FSB_MCP_VERSION, FSB_SERVER_NAME } from './version.js';
import { execSync } from 'node:child_process';

/**
 * Non-JSON/JSONC formats that are deferred to Phase 176.
 * These platforms are listed in usage but not yet installable.
 */
const DEFERRED_FORMATS = new Set(['toml', 'yaml', 'cli']);

/**
 * Collect platforms whose flags are set and whose format is JSON or JSONC.
 * @param {object} flags - Parsed CLI flags (key -> boolean)
 * @returns {Array<{key: string, platform: object}>}
 */
function getMatchedPlatforms(flags) {
  const matched = [];
  for (const [key, platform] of Object.entries(PLATFORMS)) {
    if (flags[key] === true) {
      if (platform.format === 'json' || platform.format === 'jsonc') {
        matched.push({ key, platform });
      }
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
}

/**
 * Check for deferred (non-JSON) platform flags and print status messages.
 * Returns true if any deferred flags were found.
 * @param {object} flags - Parsed CLI flags
 * @returns {boolean}
 */
function handleDeferredFlags(flags) {
  let found = false;
  for (const [key, platform] of Object.entries(PLATFORMS)) {
    if (flags[key] === true && DEFERRED_FORMATS.has(platform.format)) {
      console.log('\u25CB --' + platform.flag + ' is not yet supported (coming in a future update)');
      found = true;
    }
  }
  return found;
}

/**
 * Install FSB into one or more platform config files.
 * Iterates matched JSON/JSONC platforms, resolves config paths, and calls installToConfig.
 * VS Code entries are augmented with type: "stdio" per PLAT-03.
 *
 * @param {object} flags - Parsed CLI flags (platform keys mapped to boolean)
 */
export async function runInstall(flags) {
  const matched = getMatchedPlatforms(flags);
  const hadDeferred = handleDeferredFlags(flags);

  if (matched.length === 0 && !hadDeferred) {
    printInstallUsage();
    return;
  }

  for (const { key, platform } of matched) {
    const configPath = resolvePlatformConfig(key);
    if (configPath === null) {
      console.log('\u25CB ' + platform.displayName + ' is not supported on this OS');
      continue;
    }

    // Build entry; VS Code requires type: "stdio" (PLAT-03)
    let entry = getServerEntry();
    if (key === 'vscode') {
      entry = { type: 'stdio', ...entry };
    }

    const result = await installToConfig(configPath, platform, FSB_SERVER_NAME, entry);
    printResult(result);
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
  // Special case: Claude Code uninstall via CLI delegation (UNINST-05)
  if (flags['claude-code'] === true) {
    try {
      execSync('claude mcp remove ' + FSB_SERVER_NAME, { stdio: 'pipe', encoding: 'utf-8' });
      console.log('\u2713 Removed FSB from Claude Code');
    } catch {
      console.log('\u25CB Claude Code: run manually: claude mcp remove ' + FSB_SERVER_NAME);
    }
  }

  const matched = getMatchedPlatforms(flags);
  const hadDeferred = handleDeferredFlags(flags);

  if (matched.length === 0 && !flags['claude-code'] && !hadDeferred) {
    printUninstallUsage();
    return;
  }

  for (const { key, platform } of matched) {
    const configPath = resolvePlatformConfig(key);
    if (configPath === null) {
      console.log('\u25CB ' + platform.displayName + ' is not supported on this OS');
      continue;
    }

    const result = await removeFromConfig(configPath, platform, FSB_SERVER_NAME);
    printResult(result);
  }
}
