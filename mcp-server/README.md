# FSB MCP Server

<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/LakshmanTurlapati/FSB/main/assets/fsb_logo_dark.png" />
  <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/LakshmanTurlapati/FSB/main/assets/fsb_logo_light.png" />
  <img src="https://raw.githubusercontent.com/LakshmanTurlapati/FSB/main/assets/fsb_logo_light.png" alt="FSB: Full Self-Browsing" width="200" />
</picture>

![FSB](https://img.shields.io/badge/FSB-Full_Self--Browsing-000000?style=for-the-badge)
[![npm](https://img.shields.io/npm/v/fsb-mcp-server?style=for-the-badge&color=0078D4)](https://www.npmjs.com/package/fsb-mcp-server)
![MCP](https://img.shields.io/badge/MCP-Server-00B4D8?style=for-the-badge)
![License](https://img.shields.io/badge/license-MIT-F5C518?style=for-the-badge)

[![npm downloads](https://img.shields.io/npm/dm/fsb-mcp-server?style=flat-square&label=Downloads)](https://www.npmjs.com/package/fsb-mcp-server)
![GitHub Stars](https://img.shields.io/github/stars/LakshmanTurlapati/FSB?style=flat-square&logo=github&label=Stars)
![Surface](https://img.shields.io/badge/MCP_Surface-Manual%20%7C%20Visual%20%7C%20Autopilot-F97316?style=flat-square)
![Node](https://img.shields.io/badge/Node-18+-339933?style=flat-square&logo=nodedotjs&logoColor=white)

**Control your browser from any MCP client**

*Browser automation tools for manual control, client-owned visual sessions, autopilot mode, agents, and observability*

[Quick Start](#quick-start) | [Tools](#tools-58-total) | [Configuration](#configuration) | [FSB Extension](https://github.com/LakshmanTurlapati/FSB)

</div>

---

## What is this?

FSB MCP Server connects any MCP-compatible AI client (Claude Desktop, Claude Code, Cursor, Windsurf, etc.) to the [FSB Chrome Extension](https://github.com/LakshmanTurlapati/FSB) for browser automation. Control your browser across four operating styles:

- **Manual mode**: fine-grained control with click, type, scroll, navigate, read page content
- **Visual-session mode**: show the trusted glow/badge while your MCP client drives the browser step by step
- **Autopilot mode**: describe a task in natural language and FSB's AI handles every step
- **Agent mode**: create, run, inspect, and manage scheduled background agents from any MCP client

## Prerequisites

- **Node.js 18+**
- **FSB Chrome Extension** installed and active ([install from GitHub](https://github.com/LakshmanTurlapati/FSB))

## Quick Start

### Transport Overview

FSB uses two local endpoints with different roles:

| Endpoint | Purpose |
|----------|---------|
| `ws://localhost:7225` | Existing extension bridge. The browser extension connects here. |
| `http://127.0.0.1:7226/mcp` | Optional local Streamable HTTP MCP endpoint for MCP clients. |

The extension pairing contract did **not** change in `0.6.0`. The local HTTP server is only an additional MCP client entrypoint.

### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "fsb": {
      "command": "npx",
      "args": ["-y", "fsb-mcp-server"]
    }
  }
}
```

### Claude Code

```bash
claude mcp add --scope user fsb -- npx -y fsb-mcp-server
```

Already active after add. If the tools do not appear, run `doctor` and `status --watch` before retrying.

### Codex CLI / Codex IDE

Add to `~/.codex/config.toml`:

```toml
[mcp_servers.fsb]
command = "npx"
args = ["-y", "fsb-mcp-server"]
```

Restart Codex or reload the MCP server list after editing `config.toml`.

### VS Code

Add to `mcp.json`:

```json
{
  "servers": {
    "fsb": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "fsb-mcp-server"]
    }
  }
}
```

Then open the MCP view, trust/start the server if prompted, and reload VS Code if it does not start automatically.

### Cursor

Add to `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "fsb": {
      "command": "npx",
      "args": ["-y", "fsb-mcp-server"]
    }
  }
}
```

Restart Cursor after editing `~/.cursor/mcp.json`.

### Windsurf

Supported config paths:

```text
~/.codeium/windsurf/mcp_config.json
~/.codeium/mcp_config.json
```

Use the standard stdio entry:

```json
{
  "mcpServers": {
    "fsb": {
      "command": "npx",
      "args": ["-y", "fsb-mcp-server"]
    }
  }
}
```

Press refresh in Windsurf or reload the client after editing the matching config file.

### OpenCode (manual fallback)

Add to `~/.config/opencode/opencode.json` under the top-level `mcp` object:

```json
{
  "mcp": {
    "fsb": {
      "type": "local",
      "command": ["npx", "-y", "fsb-mcp-server"]
    }
  }
}
```

Restart OpenCode after saving the config.

### OpenClaw (manual / unsupported for now)

OpenClaw's MCP config/runtime surface is still unstable, so FSB does **not** claim one-command support here yet. Use the stdio command manually only if your OpenClaw build documents a stable MCP format.

```text
npx -y fsb-mcp-server
```

Start with `doctor` and `status --watch` before trying manual restart or reinstall loops.

### Local Streamable HTTP

If your MCP client supports Streamable HTTP, you can run a local HTTP companion instead of a spawned stdio process:

```bash
npx -y fsb-mcp-server serve
```

Default endpoint:

```text
http://127.0.0.1:7226/mcp
```

Health check:

```text
http://127.0.0.1:7226/health
```

### One-Command Install (New)

Auto-configure FSB in any supported MCP client:

```bash
npx -y fsb-mcp-server install --claude-desktop
npx -y fsb-mcp-server install --cursor
npx -y fsb-mcp-server install --vscode
npx -y fsb-mcp-server install --windsurf
npx -y fsb-mcp-server install --cline
npx -y fsb-mcp-server install --zed
npx -y fsb-mcp-server install --gemini
npx -y fsb-mcp-server install --claude-code
npx -y fsb-mcp-server install --codex
npx -y fsb-mcp-server install --continue
```

Install to all detected platforms at once:

```bash
npx -y fsb-mcp-server install --all
```

Preview what would change without writing:

```bash
npx -y fsb-mcp-server install --all --dry-run
```

Remove FSB from a platform:

```bash
npx -y fsb-mcp-server uninstall --cursor
```

#### Post-install host notes

- Claude Code: `claude mcp add --scope user ...` is the intended cross-project install path.
- Codex: edit `~/.codex/config.toml`, then restart Codex or reload the MCP server list.
- VS Code: after editing `mcp.json`, trust/start the server in the MCP view if prompted.
- Cursor: restart Cursor after editing `~/.cursor/mcp.json`.
- Windsurf: after editing either supported config path, use refresh or reload the client.
- OpenCode: manual fallback only via the `mcp` JSON snippet above.
- OpenClaw: manual / unsupported until its MCP surface stabilizes.

### Helpers

```bash
npx -y fsb-mcp-server setup              # Print manual install snippets
npx -y fsb-mcp-server status             # Show bridge and extension status
npx -y fsb-mcp-server status --watch     # Live bridge diagnostics
npx -y fsb-mcp-server doctor             # Diagnose the primary failed layer
npx -y fsb-mcp-server wait-for-extension # Wait for extension to connect
```

### Troubleshooting

When MCP stops working, start with the built-in diagnostics before reinstalling anything:

1. `npx -y fsb-mcp-server doctor`
2. `npx -y fsb-mcp-server status --watch`

Only move on to manual restart or reinstall steps if the reported layer points to package drift, bridge ownership, or extension attachment. If `doctor` reports configuration or content-script trouble, fix that layer first instead of cycling the whole setup.

### Release Smoke

Before tagging a release or debugging a fresh host setup from this repo checkout, run the short smoke flow in order:

1. `npm run test:mcp-smoke`
2. `npx -y fsb-mcp-server doctor`
3. `npx -y fsb-mcp-server status --watch`
4. Only then use the host-specific refresh, reload, or restart step documented above

This keeps automated lifecycle/tool smoke and operator-facing diagnostics aligned. Do not jump straight to "restart everything" loops.

---

## Visual Session Lifecycle

Use the explicit visual-session flow when your MCP client already owns the browser steps and only wants FSB to show the trusted glow, badge, and final freeze states in the browser. If you want FSB to decide and execute the steps for you, use `run_task` instead.

### Choose The Right Flow

| Use case | Better fit |
|----------|------------|
| "FSB should decide the steps and drive the browser end to end." | `run_task` |
| "My MCP client is already deciding the steps; I only want FSB's visible overlay and trusted client badge while I call manual tools." | `start_visual_session` + manual tools + `end_visual_session` |
| "My runtime can also emit FSB task-status tools and I want the glow to show progress and final outcome states." | `start_visual_session` + `report_progress` / `complete_task` / `partial_task` / `fail_task` + optional `end_visual_session` |

### Trusted Client Labels

`start_visual_session` accepts only fixed trusted labels from FSB's allowlist. Common examples include `Claude`, `Codex`, `ChatGPT`, `Gemini`, `Cursor`, `Windsurf`, `Perplexity`, `Grok`, `OpenCode`, `OpenClaw`, and `Antigravity`. Arbitrary badge text or custom branding is rejected.

### Minimal Public Flow

This is the simplest public pattern for MCP clients that want the glow/badge without handing control to autopilot:

1. Call `start_visual_session` with `client` and `task`.
2. Drive the page with the normal manual tools such as `navigate`, `click`, `type_text`, `press_enter`, or `scroll`.
3. Call `end_visual_session` with the returned `session_token` when you want to clear the glow explicitly.

Example:

```text
start_visual_session(client="Codex", task="Complete checkout", detail="Preparing cart")
→ returns session_token="visual_token_123"

navigate(url="https://example.com/cart")
click(selector="text=Checkout")
type_text(selector="#email", text="user@example.com")

end_visual_session(session_token="visual_token_123", reason="ended")
```

### Extended Progress And Finalization

If your runtime also has access to FSB's shared task-status tools, keep the same `session_token` threaded through the rest of the lifecycle:

1. `start_visual_session(client, task, detail?)`
2. Zero or more `report_progress(session_token, message, progress_percent?)`
3. One final outcome call:
   - `complete_task(session_token, summary, detail?)`
   - `partial_task(session_token, summary, blocker, next_step, reason?)`
   - `fail_task(session_token, reason, detail?)`
4. `end_visual_session(session_token)` only when you still need an explicit clear/cancel after your own flow

Notes:

- `session_token` is the ownership key for the visible lifecycle. Reuse the latest token returned by `start_visual_session`.
- Final outcome calls preserve the short frozen overlay before the glow clears.
- `partial_task` is the right fit for useful partial work plus an external blocker, especially login/manual-approval handoffs.
- `report_progress` is narration/status only. It does not click, type, navigate, or submit by itself.

---

## Tools

### Visual Sessions (2 tools)

Use these when your MCP client wants the visible glow/badge without handing control to `run_task`.

| Tool | Description |
|------|-------------|
| `start_visual_session` | Start the visible FSB overlay on the active normal webpage and return a `session_token` for follow-up lifecycle calls. |
| `end_visual_session` | Clear a client-owned visual session explicitly using its `session_token`, without invoking autopilot completion. |

### Autopilot (3 tools)

Let FSB's AI handle the entire task autonomously.

| Tool | Description |
|------|-------------|
| `run_task` | Execute a browser automation task via natural language. FSB's AI decides the steps. |
| `stop_task` | Cancel the currently running automation task. |
| `get_task_status` | Check task progress, current phase, and ETA. |

### Manual: Navigation (5 tools)

| Tool | Description |
|------|-------------|
| `navigate` | Open a URL in the active tab. Returns final URL after redirects. |
| `search` | Trigger a search on the current page. |
| `go_back` | Navigate back one page in browser history. |
| `go_forward` | Navigate forward one page in browser history. |
| `refresh` | Reload the current page. |

### Manual: Interaction (14 tools)

| Tool | Description |
|------|-------------|
| `click` | Click an element by CSS selector or element reference. |
| `type_text` | Type text into an input field. |
| `press_enter` | Press Enter, optionally on a specific element. |
| `press_key` | Press a key with optional modifiers (ctrl, shift, alt). |
| `select_option` | Select an option from a dropdown. |
| `check_box` | Toggle a checkbox. |
| `hover` | Hover over an element to trigger menus or tooltips. |
| `right_click` | Open context menu on an element. |
| `double_click` | Double-click an element. |
| `select_text_range` | Select a substring within an element by character offsets. |
| `drag_drop` | Drag and drop one DOM element onto another (3-method fallback). |
| `drop_file` | Simulate dropping a file onto a dropzone element. |
| `focus` | Move keyboard focus to an element. |
| `clear_input` | Clear the contents of an input field. |

### Manual: Scrolling (5 tools)

| Tool | Description |
|------|-------------|
| `scroll` | Scroll up or down by a specified amount. |
| `scroll_to_top` | Scroll to the top of the page. |
| `scroll_to_bottom` | Scroll to the bottom of the page. |
| `scroll_to_element` | Scroll a specific element into view. |
| `wait_for_stable` | Wait until the page stops changing (no DOM mutations). |

### Manual: Tabs (2 tools)

| Tool | Description |
|------|-------------|
| `open_tab` | Open a new tab with a URL. Returns the tab ID. |
| `switch_tab` | Switch to a tab by ID. |

### Manual: Spreadsheets (2 tools)

| Tool | Description |
|------|-------------|
| `fill_sheet` | Fill spreadsheet cells with CSV data starting from a given cell. |
| `read_sheet` | Read cell values from a spreadsheet range. |

### Manual: CDP Coordinate Tools (8 tools)

For canvas elements, overlays, and elements where DOM selectors don't work.

| Tool | Description |
|------|-------------|
| `click_at` | Click at viewport coordinates using CDP trusted events. Supports modifiers. |
| `click_and_hold` | Click and hold at coordinates for a duration (long-press, record buttons). |
| `drag` | Drag between two viewport coordinates (canvas drawing, sliders, maps). |
| `drag_variable_speed` | Drag with ease-in-out timing curve (CAPTCHA-resistant, human-like motion). |
| `scroll_at` | Mouse wheel at coordinates (map zoom, canvas zoom). |
| `double_click_at` | Double-click at viewport coordinates using CDP trusted events. |
| `insert_text` | Insert text via CDP into the currently focused editable target. |
| `wait_for_element` | Wait until an element matching a selector appears on the page. |

### Manual: DOM Mutation Helper (1 tool)

| Tool | Description |
|------|-------------|
| `set_attribute` | Set an HTML attribute value on a specific element. |

### Read-Only (5 tools)

These bypass the mutation queue for concurrent access.

| Tool | Description |
|------|-------------|
| `read_page` | Read the text content of the current page. |
| `get_text` | Get text content of a specific element. |
| `get_attribute` | Get an HTML attribute value from an element. |
| `get_dom_snapshot` | Get structured DOM snapshot with element references and selectors. |
| `list_tabs` | List all open tabs with title, URL, and active status. |

### Observability (5 tools)

Inspect past sessions and FSB's learned memory.

| Tool | Description |
|------|-------------|
| `list_sessions` | List all past automation sessions with summary info. |
| `get_session_detail` | Get full session detail: logs, action history, timing. |
| `get_logs` | Get recent logs or session-specific logs with error summary. |
| `search_memory` | Search FSB's memory for past experiences on similar sites. |
| `get_memory_stats` | Get memory system statistics: count, types, storage usage. |

### Agents (8 tools)

Manage and run scheduled background agents directly over MCP.

| Tool | Description |
|------|-------------|
| `create_agent` | Create a new background agent with schedule and start mode. |
| `list_agents` | List all configured background agents. |
| `run_agent` | Trigger immediate execution of an agent. |
| `stop_agent` | Stop a currently running agent execution. |
| `delete_agent` | Permanently delete an agent. |
| `toggle_agent` | Enable or disable an agent. |
| `get_agent_stats` | Get aggregate stats across all agents. |
| `get_agent_history` | Get recent run history for one agent. |

---

## Configuration

The MCP server communicates with the FSB Chrome Extension over a local WebSocket connection on port **7225**. No configuration is needed for the extension bridge; just make sure the extension is installed, enabled, and the browser is running.

If you run local Streamable HTTP mode, the MCP client talks to `http://127.0.0.1:7226/mcp` by default while the extension continues to use `ws://localhost:7225`.

### How it works

```mermaid
graph TD
    A["MCP Client\n(Claude Desktop / Claude Code / Cursor / Windsurf)"] -->|"stdio or local Streamable HTTP"| B["FSB MCP Server\n(this package)"]
    B -->|"WebSocket (port 7225)"| C["FSB Chrome Extension\n(your browser)"]
    C -->|"DOM Analysis + Action Execution"| D["Any Website"]

    subgraph tools ["MCP Tool Groups"]
        direction LR
        T0["Visual Sessions\n2 tools"]
        T1["Autopilot\n3 tools"]
        T2["Manual\n37 tools"]
        T6["Read-Only\n5 tools"]
        T7["Observability\n5 tools"]
        T8["Agents\n8 tools"]
    end

    B --- tools
```

### Hub/Relay Architecture

FSB still uses the same local bridge contract:

- The MCP client talks to this package over stdio or Streamable HTTP
- This package talks to the extension over `ws://localhost:7225`
- The browser extension remains unchanged

This keeps installation simple while avoiding any MCP-specific changes inside the extension.

Multiple MCP clients can connect simultaneously. The first server instance becomes the **hub** (listens on port 7225). Additional instances connect as **relay clients** to the hub. If the hub disconnects, a relay automatically promotes to hub.

---

## Resources

The server also exposes 5 live MCP resources:

| Resource | URI | Description |
|----------|-----|-------------|
| Current Page DOM | `browser://dom/snapshot` | Structured DOM with element references |
| Open Tabs | `browser://tabs` | All tabs with title, URL, active status |
| Site Guides | `fsb://site-guides` | Domain-specific automation intelligence |
| FSB Memory | `fsb://memory` | Learned patterns from past sessions |
| Extension Config | `fsb://config` | Current settings and connection status |

---

## Links

- [FSB Chrome Extension](https://github.com/LakshmanTurlapati/FSB): the browser extension this server connects to
- [Issues](https://github.com/LakshmanTurlapati/FSB/issues): report bugs or request features
- [License](https://github.com/LakshmanTurlapati/FSB/blob/main/LICENSE): MIT

---

<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/LakshmanTurlapati/FSB/main/assets/fsb_logo_dark_footer.png" />
  <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/LakshmanTurlapati/FSB/main/assets/fsb_logo_light_footer.png" />
  <img src="https://raw.githubusercontent.com/LakshmanTurlapati/FSB/main/assets/fsb_logo_light_footer.png" alt="FSB" width="80" />
</picture>

*Built by [Lakshman Turlapati](https://github.com/LakshmanTurlapati)*

</div>
