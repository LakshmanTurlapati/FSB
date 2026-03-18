#!/usr/bin/env node

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

// ---------------------------------------------------------------------------
// Parse CLI arguments
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);

function getArg(name) {
  const prefix = `--${name}=`;
  const found = args.find((a) => a.startsWith(prefix));
  return found ? found.slice(prefix.length) : null;
}

const showHelp = args.includes('--help') || args.includes('-h');
const uninstall = args.includes('--uninstall');
const extensionId = getArg('extension-id');

if (showHelp) {
  console.log(`
FSB Native Messaging Host Installer

Usage:
  node install-host.js --extension-id=<chrome-extension-id>
  node install-host.js --extension-id=<chrome-extension-id> --uninstall

Options:
  --extension-id=ID   Chrome extension ID (required)
                      Find it at chrome://extensions with Developer mode on
  --uninstall         Remove the native host manifest and launcher
  --help, -h          Show this help message

Example:
  node install-host.js --extension-id=abcdefghijklmnopqrstuvwxyz123456
`);
  process.exit(0);
}

if (!extensionId) {
  console.error('Error: --extension-id=<id> is required.');
  console.error('Find your extension ID at chrome://extensions (enable Developer mode).');
  console.error('Run with --help for usage information.');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Determine OS-specific paths
// ---------------------------------------------------------------------------

const platform = process.platform;
const home = os.homedir();
const buildDir = path.resolve(__dirname, '..', 'build');
const shimPath = path.join(buildDir, 'native-host-shim.js');

let manifestDir;
let manifestPath;

switch (platform) {
  case 'darwin':
    manifestDir = path.join(
      home,
      'Library',
      'Application Support',
      'Google',
      'Chrome',
      'NativeMessagingHosts',
    );
    manifestPath = path.join(manifestDir, 'com.fsb.mcp.json');
    break;

  case 'linux':
    manifestDir = path.join(
      home,
      '.config',
      'google-chrome',
      'NativeMessagingHosts',
    );
    manifestPath = path.join(manifestDir, 'com.fsb.mcp.json');
    break;

  case 'win32':
    manifestDir = path.join(
      home,
      'AppData',
      'Local',
      'Google',
      'Chrome',
      'User Data',
      'NativeMessagingHosts',
    );
    manifestPath = path.join(manifestDir, 'com.fsb.mcp.json');
    break;

  default:
    console.error(`Unsupported platform: ${platform}`);
    process.exit(1);
}

// ---------------------------------------------------------------------------
// Uninstall
// ---------------------------------------------------------------------------

if (uninstall) {
  let removed = false;

  if (fs.existsSync(manifestPath)) {
    fs.unlinkSync(manifestPath);
    console.log(`Removed manifest: ${manifestPath}`);
    removed = true;
  }

  // Remove launcher scripts
  const shLauncher = path.join(buildDir, 'fsb-native-host.sh');
  const batLauncher = path.join(buildDir, 'fsb-native-host.bat');

  if (fs.existsSync(shLauncher)) {
    fs.unlinkSync(shLauncher);
    console.log(`Removed launcher: ${shLauncher}`);
    removed = true;
  }
  if (fs.existsSync(batLauncher)) {
    fs.unlinkSync(batLauncher);
    console.log(`Removed launcher: ${batLauncher}`);
    removed = true;
  }

  // Remove Windows registry key
  if (platform === 'win32') {
    try {
      execSync(
        'reg delete "HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts\\com.fsb.mcp" /f',
        { stdio: 'ignore' },
      );
      console.log('Removed Windows registry key.');
      removed = true;
    } catch {
      // Key may not exist -- that is fine
    }
  }

  if (removed) {
    console.log('\nNative messaging host uninstalled successfully.');
  } else {
    console.log('Nothing to uninstall -- no manifest or launcher found.');
  }

  process.exit(0);
}

// ---------------------------------------------------------------------------
// Install
// ---------------------------------------------------------------------------

// Create launcher script
let launcherPath;

if (platform === 'win32') {
  launcherPath = path.join(buildDir, 'fsb-native-host.bat');
  const batContent = `@echo off\r\nnode "${shimPath}"\r\n`;

  fs.mkdirSync(buildDir, { recursive: true });
  fs.writeFileSync(launcherPath, batContent, { encoding: 'utf8' });
} else {
  launcherPath = path.join(buildDir, 'fsb-native-host.sh');
  const shContent = `#!/bin/bash\nexec node "${shimPath}"\n`;

  fs.mkdirSync(buildDir, { recursive: true });
  fs.writeFileSync(launcherPath, shContent, { mode: 0o755, encoding: 'utf8' });
}

// Generate manifest JSON
const manifest = {
  name: 'com.fsb.mcp',
  description: 'FSB Browser Automation MCP Bridge',
  path: launcherPath,
  type: 'stdio',
  allowed_origins: [`chrome-extension://${extensionId}/`],
};

// Write manifest to OS-specific location
fs.mkdirSync(manifestDir, { recursive: true });
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');

// Windows: also create registry key
if (platform === 'win32') {
  try {
    execSync(
      `reg add "HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts\\com.fsb.mcp" /ve /t REG_SZ /d "${manifestPath}" /f`,
      { stdio: 'ignore' },
    );
  } catch (err) {
    console.error('Warning: Could not create registry key. You may need to run as administrator.');
    console.error(err.message);
  }
}

// ---------------------------------------------------------------------------
// Success output
// ---------------------------------------------------------------------------

const mcpServerPath = path.join(buildDir, 'index.js');

console.log(`
Native messaging host installed successfully!

  Manifest:     ${manifestPath}
  Launcher:     ${launcherPath}
  Extension ID: ${extensionId}

Next steps:
  1. Reload the FSB extension in Chrome (chrome://extensions)
  2. Add to Claude Code:
     claude mcp add --transport stdio fsb-browser -- node "${mcpServerPath}"
  3. Or copy .mcp.json to your project root
`);
