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
![Tools](https://img.shields.io/badge/MCP_Tools-44-F97316?style=flat-square)
![Node](https://img.shields.io/badge/Node-18+-339933?style=flat-square&logo=nodedotjs&logoColor=white)

**Control your browser from any MCP client**

*44 tools for browser automation: manual control, autopilot mode, and full observability*

[Quick Start](#quick-start) | [Tools](#tools-44-total) | [Configuration](#configuration) | [FSB Extension](https://github.com/LakshmanTurlapati/FSB)

</div>

---

## What is this?

FSB MCP Server connects any MCP-compatible AI client (Claude Desktop, Claude Code, Cursor, Windsurf, etc.) to the [FSB Chrome Extension](https://github.com/LakshmanTurlapati/FSB) for browser automation. Control your browser with 44 tools across two modes:

- **Manual mode**: fine-grained control with click, type, scroll, navigate, read page content
- **Autopilot mode**: describe a task in natural language and FSB's AI handles every step

## Prerequisites

- **Node.js 18+**
- **FSB Chrome Extension** installed and active ([install from GitHub](https://github.com/LakshmanTurlapati/FSB))

## Quick Start

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
claude mcp add fsb -- npx -y fsb-mcp-server
```

### Cursor

Add to `.cursor/mcp.json`:

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

### Windsurf / Other MCP Clients

Any client that supports stdio MCP servers works. The command is:

```
npx -y fsb-mcp-server
```

---

## Tools (44 total)

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

### Manual: Scrolling (4 tools)

| Tool | Description |
|------|-------------|
| `scroll` | Scroll up or down by a specified amount. |
| `scroll_to_top` | Scroll to the top of the page. |
| `scroll_to_bottom` | Scroll to the bottom of the page. |
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

### Manual: CDP Coordinate Tools (6 tools)

For canvas elements, overlays, and elements where DOM selectors don't work.

| Tool | Description |
|------|-------------|
| `click_at` | Click at viewport coordinates using CDP trusted events. Supports modifiers. |
| `click_and_hold` | Click and hold at coordinates for a duration (long-press, record buttons). |
| `drag` | Drag between two viewport coordinates (canvas drawing, sliders, maps). |
| `drag_variable_speed` | Drag with ease-in-out timing curve (CAPTCHA-resistant, human-like motion). |
| `scroll_at` | Mouse wheel at coordinates (map zoom, canvas zoom). |
| `wait_for_element` | Wait until an element matching a selector appears on the page. |

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

---

## Configuration

The MCP server communicates with the FSB Chrome Extension over a local WebSocket connection on port **7225**. No configuration needed, just make sure the extension is running.

### How it works

```mermaid
graph TD
    A["MCP Client\n(Claude Desktop / Claude Code / Cursor / Windsurf)"] -->|"stdio (JSON-RPC 2.0)"| B["FSB MCP Server\n(this package)"]
    B -->|"WebSocket (port 7225)"| C["FSB Chrome Extension\n(your browser)"]
    C -->|"DOM Analysis + Action Execution"| D["Any Website"]

    subgraph tools ["44 MCP Tools"]
        direction LR
        T1["Autopilot\n3 tools"]
        T2["Navigation\n5 tools"]
        T3["Interaction\n14 tools"]
        T4["Scrolling\n4 tools"]
        T5["CDP\n6 tools"]
        T6["Read-Only\n5 tools"]
        T7["Observability\n5 tools"]
    end

    B --- tools
```

### Hub/Relay Architecture

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
