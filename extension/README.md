# FSB Chrome Extension

The `extension/` directory contains the entire Chrome extension package
(Manifest V3). Load this directory as an unpacked extension in Chrome to
run FSB locally.

## Load as Unpacked

1. Open `chrome://extensions` in Chrome (or any Chromium-based browser
   version 88+).
2. Toggle **Developer mode** on (top-right).
3. Click **Load unpacked** and select the `extension/` directory at the
   root of this repository (i.e., the directory containing this README).
4. The "FSB" extension appears in your extensions list. Pin it from the
   toolbar puzzle icon for easy access.
5. Click the FSB toolbar icon to open the popup, or right-click and
   choose **Open side panel** for the persistent panel.

To pick up code changes during development, click the **reload** icon
on the FSB card in `chrome://extensions`. Reload the open tabs after
reloading the extension so the content scripts re-inject.

## Key Entry Points

| Path | Role |
|------|------|
| `manifest.json` | MV3 manifest (permissions, entry points, web-accessible resources) |
| `background.js` | Service worker; orchestrates AI calls, tool execution, sessions |
| `canvas-interceptor.js` | MAIN-world content script; runs at `document_start` |
| `content/` | Content scripts (DOM analysis, action execution, lifecycle, messaging) |
| `ui/` | Popup, side panel, control panel, options HTML/CSS/JS |
| `ai/` | AI provider integrations, tool definitions, agent loop, transcript store |
| `agents/` | Agent runtime (executor, manager, scheduler, server-sync) |
| `ws/` | WebSocket clients (MCP bridge, MCP tool dispatcher, ws-client) |
| `offscreen/` | Offscreen document (speech-to-text) |
| `utils/` | Shared utilities (analytics, logger, ring buffer, redaction, etc.) |
| `lib/` | Vendored third-party libraries (Chart.js, gpt-tokenizer, mermaid, etc.) |
| `site-guides/` | Per-site automation guides |
| `site-maps/` | Generated site-map JSON (web-accessible) |
| `test-data/` | Fixture data exposed to content scripts (web-accessible) |
| `shared/` | UI styles shared across surfaces |
| `config/` | Extension config bootstrap (config.js, init-config.js, secure-config.js) |
| `assets/` | Icons and image assets |

## Packaging for the Chrome Web Store

The repo-root `package.json` defines `npm run package`, which produces a
zip archive of the extension. Run from the repository root, not from
`extension/`. The zip excludes development files and node_modules.

## CI Validation

From the repository root: `npm run validate:extension` performs static
validation (manifest sanity, JS syntax check across all extension JS
files). The Node test suite (`npm test`) covers extension modules that
can run under Node (analytics, cost tracker, transcript store, MCP
bridge contracts, etc.).

## Repository Layout

See the root `README.md` for the full repository overview, including
the MCP server (`mcp/`) and the showcase site
(`showcase/`).
