import { homedir } from 'node:os';
import { join } from 'node:path';

const home = homedir();

/**
 * Returns the FSB MCP server entry object for the current platform.
 * On Windows, wraps npx as `cmd /c npx` per INST-07.
 * On all other platforms, uses plain `npx`.
 */
export function getServerEntry() {
  if (process.platform === 'win32') {
    return { command: 'cmd', args: ['/c', 'npx', '-y', 'fsb-mcp-server'] };
  }
  return { command: 'npx', args: ['-y', 'fsb-mcp-server'] };
}

/**
 * Platform registry mapping all 10 MCP-capable platforms to their
 * config file metadata. Each entry contains:
 *   - displayName: Human-readable name
 *   - flag: CLI flag name (same as key)
 *   - format: 'json' | 'jsonc' | 'toml' | 'yaml' | 'cli'
 *   - serverMapKey: Root key in the config file (null for cli format)
 *   - configPath: { darwin, win32, linux } resolved paths (null for cli format)
 */
export const PLATFORMS = {
  'claude-desktop': {
    displayName: 'Claude Desktop',
    flag: 'claude-desktop',
    format: 'json',
    serverMapKey: 'mcpServers',
    configPath: {
      darwin: join(home, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json'),
      win32: join(process.env.APPDATA || '', 'Claude', 'claude_desktop_config.json'),
      linux: join(home, '.config', 'claude-desktop', 'claude_desktop_config.json'),
    },
  },

  'claude-code': {
    displayName: 'Claude Code',
    flag: 'claude-code',
    format: 'cli',
    serverMapKey: null,
    configPath: null,
  },

  'cursor': {
    displayName: 'Cursor',
    flag: 'cursor',
    format: 'json',
    serverMapKey: 'mcpServers',
    configPath: {
      darwin: join(home, '.cursor', 'mcp.json'),
      win32: join(home, '.cursor', 'mcp.json'),
      linux: join(home, '.cursor', 'mcp.json'),
    },
  },

  'vscode': {
    displayName: 'VS Code',
    flag: 'vscode',
    format: 'jsonc',
    serverMapKey: 'servers',
    configPath: {
      darwin: join(home, 'Library', 'Application Support', 'Code', 'User', 'mcp.json'),
      win32: join(process.env.APPDATA || '', 'Code', 'User', 'mcp.json'),
      linux: join(home, '.config', 'Code', 'User', 'mcp.json'),
    },
  },

  'windsurf': {
    displayName: 'Windsurf',
    flag: 'windsurf',
    format: 'json',
    serverMapKey: 'mcpServers',
    configPath: {
      darwin: join(home, '.codeium', 'windsurf', 'mcp_config.json'),
      win32: join(home, '.codeium', 'windsurf', 'mcp_config.json'),
      linux: join(home, '.codeium', 'windsurf', 'mcp_config.json'),
    },
  },

  'cline': {
    displayName: 'Cline',
    flag: 'cline',
    format: 'json',
    serverMapKey: 'mcpServers',
    configPath: {
      darwin: join(home, 'Library', 'Application Support', 'Code', 'User', 'globalStorage', 'saoudrizwan.claude-dev', 'settings', 'cline_mcp_settings.json'),
      win32: join(process.env.APPDATA || '', 'Code', 'User', 'globalStorage', 'saoudrizwan.claude-dev', 'settings', 'cline_mcp_settings.json'),
      linux: join(home, '.config', 'Code', 'User', 'globalStorage', 'saoudrizwan.claude-dev', 'settings', 'cline_mcp_settings.json'),
    },
  },

  'zed': {
    displayName: 'Zed',
    flag: 'zed',
    format: 'jsonc',
    serverMapKey: 'context_servers',
    configPath: {
      darwin: join(home, '.zed', 'settings.json'),
      win32: join(process.env.LOCALAPPDATA || '', 'Zed', 'settings.json'),
      linux: join(home, '.config', 'zed', 'settings.json'),
    },
  },

  'codex': {
    displayName: 'Codex CLI',
    flag: 'codex',
    format: 'toml',
    serverMapKey: 'mcp_servers',
    configPath: {
      darwin: join(home, '.codex', 'config.toml'),
      win32: join(home, '.codex', 'config.toml'),
      linux: join(home, '.codex', 'config.toml'),
    },
  },

  'gemini': {
    displayName: 'Gemini CLI',
    flag: 'gemini',
    format: 'json',
    serverMapKey: 'mcpServers',
    configPath: {
      darwin: join(home, '.gemini', 'settings.json'),
      win32: join(home, '.gemini', 'settings.json'),
      linux: join(home, '.gemini', 'settings.json'),
    },
  },

  'continue': {
    displayName: 'Continue',
    flag: 'continue',
    format: 'yaml',
    serverMapKey: 'mcpServers',
    configPath: {
      darwin: join(home, '.continue', 'config.yaml'),
      win32: join(home, '.continue', 'config.yaml'),
      linux: join(home, '.continue', 'config.yaml'),
    },
  },
};

/**
 * Resolves the config file path for a given platform on the current OS.
 * Returns null if the platform uses CLI format or the current OS is not mapped.
 *
 * @param {string} platformKey - Platform key (e.g., 'cursor', 'claude-code')
 * @returns {string|null} Absolute path to the config file, or null
 */
export function resolvePlatformConfig(platformKey) {
  const platform = PLATFORMS[platformKey];
  if (!platform || !platform.configPath) return null;
  return platform.configPath[process.platform] || null;
}

/**
 * Returns an array of all platform flag names (keys of PLATFORMS).
 * Useful for CLI help text and flag enumeration.
 *
 * @returns {string[]} Array of platform flag names
 */
export function getPlatformFlags() {
  return Object.keys(PLATFORMS);
}
