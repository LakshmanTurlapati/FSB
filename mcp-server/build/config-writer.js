import { readFile, writeFile, copyFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname } from 'node:path';
import stripJsonComments from 'strip-json-comments';
import { parse as parseToml, stringify as stringifyToml } from 'smol-toml';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { getServerEntry } from './platforms.js';

/**
 * Parse raw file content into a JS object based on format.
 * @param {string} raw - Raw file content
 * @param {string} format - One of: 'json', 'jsonc', 'toml', 'yaml'
 * @returns {object} Parsed data
 */
function parseByFormat(raw, format) {
  switch (format) {
    case 'json':
      return JSON.parse(raw);
    case 'jsonc':
      return JSON.parse(stripJsonComments(raw, { trailingCommas: true }));
    case 'toml':
      return parseToml(raw);
    case 'yaml':
      return parseYaml(raw) || {};
    default:
      throw new Error('Unsupported format: ' + format);
  }
}

/**
 * Serialize a JS object back to string based on format.
 * JSONC is written back as plain JSON (comments are lost; the .bak backup preserves the original).
 * @param {object} data - Data to serialize
 * @param {string} format - One of: 'json', 'jsonc', 'toml', 'yaml'
 * @returns {string} Serialized content
 */
function serializeByFormat(data, format) {
  switch (format) {
    case 'json':
    case 'jsonc':
      return JSON.stringify(data, null, 2) + '\n';
    case 'toml':
      return stringifyToml(data) + '\n';
    case 'yaml':
      return stringifyYaml(data);
    default:
      throw new Error('Unsupported format: ' + format);
  }
}

/**
 * Detect if this platform uses Continue's YAML array format.
 * Continue has serverMapKey 'mcpServers' AND format 'yaml'.
 * @param {string} format
 * @param {string} serverMapKey
 * @returns {boolean}
 */
function isContinueArrayFormat(format, serverMapKey) {
  return format === 'yaml' && serverMapKey === 'mcpServers';
}

/**
 * Merge a server entry into the config data under the correct key.
 * Handles both object-map format (most platforms) and array format (Continue).
 * @param {object} data - Config data object
 * @param {string} serverMapKey - Root key (e.g., 'mcpServers', 'servers')
 * @param {string} serverName - Server name (e.g., 'fsb')
 * @param {object} entry - Server entry to merge
 * @param {string} format - Config format
 */
function mergeServerEntry(data, serverMapKey, serverName, entry, format) {
  if (isContinueArrayFormat(format, serverMapKey)) {
    // Continue uses a YAML array format for mcpServers
    if (!Array.isArray(data[serverMapKey])) {
      data[serverMapKey] = [{ name: serverName, ...entry }];
      return;
    }
    const idx = data[serverMapKey].findIndex(item => item.name === serverName);
    if (idx >= 0) {
      data[serverMapKey][idx] = { name: serverName, ...entry };
    } else {
      data[serverMapKey].push({ name: serverName, ...entry });
    }
  } else {
    // All other platforms use object map format
    if (!data[serverMapKey] || typeof data[serverMapKey] !== 'object' || Array.isArray(data[serverMapKey])) {
      data[serverMapKey] = {};
    }
    data[serverMapKey][serverName] = entry;
  }
}

/**
 * Check if FSB is already configured identically (idempotency check).
 * @param {object} data - Current config data
 * @param {string} serverMapKey - Root key
 * @param {string} serverName - Server name
 * @param {object} entry - Server entry to compare
 * @param {string} format - Config format
 * @returns {boolean} True if already identically configured
 */
function checkIdempotent(data, serverMapKey, serverName, entry, format) {
  if (isContinueArrayFormat(format, serverMapKey)) {
    if (!Array.isArray(data[serverMapKey])) return false;
    const found = data[serverMapKey].find(item => item.name === serverName);
    if (!found) return false;
    return JSON.stringify({ name: serverName, ...entry }) === JSON.stringify(found);
  } else {
    if (!data[serverMapKey]?.[serverName]) return false;
    return JSON.stringify(data[serverMapKey][serverName]) === JSON.stringify(entry);
  }
}

/**
 * Check if the server entry already exists (for create vs update distinction).
 * @param {object} data - Current config data
 * @param {string} serverMapKey - Root key
 * @param {string} serverName - Server name
 * @param {string} format - Config format
 * @returns {boolean}
 */
function hasExistingEntry(data, serverMapKey, serverName, format) {
  if (isContinueArrayFormat(format, serverMapKey)) {
    return Array.isArray(data[serverMapKey]) &&
      data[serverMapKey].some(item => item.name === serverName);
  }
  return data[serverMapKey]?.[serverName] !== undefined;
}

/**
 * Install FSB server entry into a platform's config file.
 * Handles read-merge-write with backup, idempotency, and graceful error handling.
 *
 * @param {string} configPath - Resolved absolute path to the config file
 * @param {object} platform - Platform entry from PLATFORMS (has format, serverMapKey, displayName)
 * @param {string} serverName - Server name key, always 'fsb'
 * @returns {Promise<{status: string, path: string, message: string}>}
 *   status: 'created' | 'updated' | 'skipped' | 'error'
 */
export async function installToConfig(configPath, platform, serverName, entry = null) {
  try {
    // 1. Check directory exists (INST-08, D-02) -- do NOT create it
    const dir = dirname(configPath);
    if (!existsSync(dir)) {
      return {
        status: 'error',
        path: configPath,
        message: 'Directory does not exist: ' + dir + ' -- is ' + platform.displayName + ' installed?',
      };
    }

    // 2. Build the server entry (use caller-provided entry or fall back to default)
    const serverEntry = entry || getServerEntry();

    // 3. Read existing file or start fresh, backup before any mutation
    let data = {};
    const fileExists = existsSync(configPath);
    if (fileExists) {
      // Backup (INST-03) -- create .bak before reading ensures recovery even on skip
      await copyFile(configPath, configPath + '.bak');
      const raw = await readFile(configPath, 'utf-8');
      data = parseByFormat(raw, platform.format);
    }

    // 4. Check idempotency (INST-04) -- skip if already identical
    if (checkIdempotent(data, platform.serverMapKey, serverName, serverEntry, platform.format)) {
      return {
        status: 'skipped',
        path: configPath,
        message: platform.displayName + ' already configured',
      };
    }

    // 5. Determine if this is create or update
    const isUpdate = fileExists && hasExistingEntry(data, platform.serverMapKey, serverName, platform.format);

    // 7. Merge (INST-02)
    mergeServerEntry(data, platform.serverMapKey, serverName, serverEntry, platform.format);

    // 8. Serialize and write (D-03)
    const output = serializeByFormat(data, platform.format);
    await writeFile(configPath, output, 'utf-8');

    // 9. Return result
    return {
      status: isUpdate ? 'updated' : 'created',
      path: configPath,
      message: (isUpdate ? 'Updated' : 'Installed to') + ' ' + platform.displayName + ': ' + configPath,
    };
  } catch (err) {
    return {
      status: 'error',
      path: configPath,
      message: 'Failed to configure ' + platform.displayName + ': ' + err.message,
    };
  }
}

/**
 * Remove FSB server entry from a platform's config file.
 *
 * @param {string} configPath - Resolved absolute path to the config file
 * @param {object} platform - Platform entry from PLATFORMS (has format, serverMapKey, displayName)
 * @param {string} serverName - Server name key, always 'fsb'
 * @returns {Promise<{status: string, path: string, message: string}>}
 *   status: 'removed' | 'not-found' | 'error'
 */
export async function removeFromConfig(configPath, platform, serverName) {
  try {
    // 1. Check directory and file exist
    const dir = dirname(configPath);
    if (!existsSync(dir) || !existsSync(configPath)) {
      return {
        status: 'not-found',
        path: configPath,
        message: platform.displayName + ' config file not found: ' + configPath,
      };
    }

    // 2. Read and parse the file
    const raw = await readFile(configPath, 'utf-8');
    const data = parseByFormat(raw, platform.format);

    // 3. Check if entry exists and remove
    if (isContinueArrayFormat(platform.format, platform.serverMapKey)) {
      // Continue YAML array format
      if (!Array.isArray(data[platform.serverMapKey])) {
        return {
          status: 'not-found',
          path: configPath,
          message: 'FSB not configured in ' + platform.displayName,
        };
      }
      const idx = data[platform.serverMapKey].findIndex(item => item.name === serverName);
      if (idx < 0) {
        return {
          status: 'not-found',
          path: configPath,
          message: 'FSB not configured in ' + platform.displayName,
        };
      }
      data[platform.serverMapKey].splice(idx, 1);
    } else {
      // Object map format
      if (!data[platform.serverMapKey]?.[serverName]) {
        return {
          status: 'not-found',
          path: configPath,
          message: 'FSB not configured in ' + platform.displayName,
        };
      }
      delete data[platform.serverMapKey][serverName];
    }

    // 5. Backup the file
    await copyFile(configPath, configPath + '.bak');

    // 6. Serialize and write
    const output = serializeByFormat(data, platform.format);
    await writeFile(configPath, output, 'utf-8');

    // 7. Return result
    return {
      status: 'removed',
      path: configPath,
      message: 'Removed from ' + platform.displayName + ': ' + configPath,
    };
  } catch (err) {
    return {
      status: 'error',
      path: configPath,
      message: 'Failed to remove from ' + platform.displayName + ': ' + err.message,
    };
  }
}
