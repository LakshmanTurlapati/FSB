import { homedir } from 'node:os';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

/** Supported config file formats */
export type ConfigFormat = 'json' | 'jsonc' | 'toml' | 'yaml' | 'cli';

/** Cross-OS path mapping */
export interface PlatformPaths {
  darwin: string;
  win32: string;
  linux: string;
}

/** Server entry for MCP config files */
export interface ServerEntry {
  command: string;
  args: string[];
  type?: string;  // VS Code requires type: "stdio"
}

/** Platform configuration in the registry */
export interface PlatformConfig {
  displayName: string;
  flag: string;
  format: ConfigFormat;
  serverMapKey: string | null;
  configPath: PlatformPaths | null;
}

/** Structured target resolution returned to the installer */
export interface PlatformTarget {
  platformKey: string;
  platform: PlatformConfig;
  configPath: string | null;
  targetLabel: string;
  variant: string | null;
  detected: boolean;
}

/** The full platform registry type */
export type PlatformRegistry = Record<string, PlatformConfig>;

const home: string = homedir();

/**
 * Platform registry mapping all 10 MCP-capable platforms to their
 * config file metadata. Each entry contains:
 *   - displayName: Human-readable name
 *   - flag: CLI flag name (same as key)
 *   - format: 'json' | 'jsonc' | 'toml' | 'yaml' | 'cli'
 *   - serverMapKey: Root key in the config file (null for cli format)
 *   - configPath: { darwin, win32, linux } resolved paths (null for cli format)
 */
export const PLATFORMS: PlatformRegistry = {
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
 * Returns the FSB MCP server entry object for the current platform.
 * On Windows, wraps npx as `cmd /c npx` per INST-07.
 * On all other platforms, uses plain `npx`.
 */
export function getServerEntry(): ServerEntry {
  if (process.platform === 'win32') {
    return { command: 'cmd', args: ['/c', 'npx', '-y', 'fsb-mcp-server'] };
  }
  return { command: 'npx', args: ['-y', 'fsb-mcp-server'] };
}

interface PlatformTargetCandidate {
  configPath: string;
  targetLabel: string;
  variant: string | null;
}

function getPlatformConfigPath(platform: PlatformConfig): string | null {
  if (!platform.configPath) return null;
  const osPlatform = process.platform as keyof PlatformPaths;
  return platform.configPath[osPlatform] || null;
}

function getPlatformTargetCandidates(platformKey: string, platform: PlatformConfig): PlatformTargetCandidate[] {
  const configPath = getPlatformConfigPath(platform);
  if (!configPath) return [];

  if (platformKey === 'windsurf') {
    const windsurfRoot = join(home, '.codeium');
    return [
      {
        configPath,
        targetLabel: platform.displayName,
        variant: 'app',
      },
      {
        configPath: join(windsurfRoot, 'mcp_config.json'),
        targetLabel: platform.displayName + ' (JetBrains/Cascade plugin)',
        variant: 'plugin',
      },
    ];
  }

  return [
    {
      configPath,
      targetLabel: platform.displayName,
      variant: null,
    },
  ];
}

/**
 * Resolve the best config target for a platform on the current OS.
 * Prefers an existing config file first, then an existing parent directory,
 * and finally falls back to the default documented path for dry-run/help output.
 *
 * @param platformKey - Platform key (e.g., 'cursor', 'windsurf')
 * @returns Structured target metadata for installer flows
 */
export function resolvePlatformTarget(platformKey: string): PlatformTarget {
  const platform: PlatformConfig | undefined = PLATFORMS[platformKey];
  if (!platform) {
    throw new Error('Unknown platform: ' + platformKey);
  }

  const candidates = getPlatformTargetCandidates(platformKey, platform);
  if (candidates.length === 0) {
    return {
      platformKey,
      platform,
      configPath: null,
      targetLabel: platform.displayName,
      variant: null,
      detected: false,
    };
  }

  for (const candidate of candidates) {
    if (existsSync(candidate.configPath)) {
      return {
        platformKey,
        platform,
        configPath: candidate.configPath,
        targetLabel: candidate.targetLabel,
        variant: candidate.variant,
        detected: true,
      };
    }
  }

  for (const candidate of candidates) {
    if (existsSync(dirname(candidate.configPath))) {
      return {
        platformKey,
        platform,
        configPath: candidate.configPath,
        targetLabel: candidate.targetLabel,
        variant: candidate.variant,
        detected: true,
      };
    }
  }

  const fallback = candidates[0];
  return {
    platformKey,
    platform,
    configPath: fallback.configPath,
    targetLabel: fallback.targetLabel,
    variant: fallback.variant,
    detected: false,
  };
}

/**
 * Resolves the config file path for a given platform on the current OS.
 * Returns null if the platform uses CLI format or the current OS is not mapped.
 *
 * @param platformKey - Platform key (e.g., 'cursor', 'claude-code')
 * @returns Absolute path to the config file, or null
 */
export function resolvePlatformConfig(platformKey: string): string | null {
  return resolvePlatformTarget(platformKey).configPath;
}

/**
 * Returns an array of all platform flag names (keys of PLATFORMS).
 * Useful for CLI help text and flag enumeration.
 *
 * @returns Array of platform flag names
 */
export function getPlatformFlags(): string[] {
  return Object.keys(PLATFORMS);
}
