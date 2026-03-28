---
phase: 45
slug: mcp-server-interface
status: draft
shadcn_initialized: false
preset: none
created: 2026-03-17
---

# Phase 45 — UI Design Contract

> This phase has NO visual frontend. The MCP server is a headless Node.js process communicating via JSON-RPC over stdio. The "UI" is the textual interface AI agents consume: tool descriptions, error messages, resource metadata, and prompt templates. This contract defines those textual contracts.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none |
| Preset | not applicable |
| Component library | none |
| Icon library | none |
| Font | not applicable (no visual output) |

**Rationale:** Phase 45 produces a TypeScript MCP server (`mcp-server/` package) and a native messaging bridge shim. Both are backend processes with no HTML, CSS, or visual rendering. The shadcn gate does not apply.

---

## Spacing Scale

Not applicable. No visual layout in this phase.

---

## Typography

Not applicable. No visual text rendering in this phase.

---

## Color

Not applicable. No visual surfaces in this phase.

---

## Copywriting Contract

This is the primary design contract for Phase 45. AI agents are the "users" -- tool descriptions, error text, and resource metadata are the interface they consume. Clarity and precision directly affect whether agents use FSB correctly.

### MCP Server Identity

| Field | Value |
|-------|-------|
| Server name | `fsb-browser-automation` |
| Server version | `1.0.0` |
| Server description | `Browser automation via FSB Chrome extension. Automate any website with natural language (autopilot) or direct browser action tools (manual mode).` |

### Tool Descriptions

Every MCP tool MUST follow this description pattern: one sentence stating what it does, one sentence stating when to use it, one sentence stating what it returns.

#### Autopilot Tools

| Tool | Title | Description |
|------|-------|-------------|
| `run_task` | Run Automation Task | Execute a browser automation task using FSB's AI. Describe what you want done in natural language and FSB's AI decides the steps. Returns a completion summary with success status and action log. |
| `stop_task` | Stop Running Task | Cancel the currently running automation task. Use when a task is taking too long or heading in the wrong direction. Returns confirmation of cancellation. |
| `get_task_status` | Get Task Status | Check whether a task is currently running and its progress. Use to poll status when not receiving progress notifications. Returns percent complete, current phase, and ETA. |

#### Manual Mode -- Navigation

| Tool | Title | Description |
|------|-------|-------------|
| `navigate` | Navigate to URL | Open a URL in the active browser tab. Use to go to a specific page before interacting with it. Returns the final URL after any redirects. |
| `search` | Search on Page | Trigger a search on the current page. Use when the page has a search function and you need to find specific content. Returns search results status. |
| `go_back` | Go Back | Navigate back one page in browser history. Use to return to the previous page. Returns the new URL. |
| `go_forward` | Go Forward | Navigate forward one page in browser history. Use after going back. Returns the new URL. |
| `refresh` | Refresh Page | Reload the current page. Use when page content may be stale. Returns the refreshed URL. |

#### Manual Mode -- Interaction

| Tool | Title | Description |
|------|-------|-------------|
| `click` | Click Element | Click an element on the page by CSS selector or element reference. Use to press buttons, follow links, or activate controls. Returns whether the click succeeded. |
| `type_text` | Type Text | Type text into an input field by selector. Use to fill text inputs, search boxes, or text areas. Returns confirmation of typed text. |
| `press_enter` | Press Enter | Press the Enter key, optionally on a specific element. Use to submit forms or confirm input. Returns key press confirmation. |
| `press_key` | Press Key | Press a keyboard key with optional modifiers (ctrl, shift, alt). Use for keyboard shortcuts or special key input. Returns key press confirmation. |
| `select_option` | Select Option | Select an option from a dropdown by value. Use to choose from select menus. Returns the selected value. |
| `check_box` | Toggle Checkbox | Toggle a checkbox element. Use to check or uncheck form checkboxes. Returns the new checked state. |
| `hover` | Hover Over Element | Move the mouse over an element. Use to trigger hover menus, tooltips, or hover states. Returns hover confirmation. |
| `right_click` | Right-Click Element | Open context menu on an element. Use to access right-click options. Returns context menu confirmation. |
| `double_click` | Double-Click Element | Double-click an element. Use for actions requiring double-click like text selection or opening items. Returns click confirmation. |
| `focus` | Focus Element | Move keyboard focus to an element. Use to prepare an element for keyboard input. Returns focus confirmation. |
| `clear_input` | Clear Input | Clear the contents of an input field. Use before typing new text into an already-filled field. Returns clear confirmation. |

#### Manual Mode -- Scrolling

| Tool | Title | Description |
|------|-------|-------------|
| `scroll` | Scroll Page | Scroll the page up or down by a specified amount. Use to bring off-screen content into view. Returns new scroll position. |
| `scroll_to_top` | Scroll to Top | Scroll to the top of the page. Use to return to the beginning of the page. Returns confirmation. |
| `scroll_to_bottom` | Scroll to Bottom | Scroll to the bottom of the page. Use to reach the end of the page or load lazy content. Returns confirmation. |

#### Manual Mode -- Information

| Tool | Title | Description |
|------|-------|-------------|
| `read_page` | Read Page Content | Read the text content of the current page. Use to understand what is on the page before interacting. Returns page text with structure preserved. |
| `get_text` | Get Element Text | Get the text content of a specific element. Use to read a particular section or value on the page. Returns the element's text. |
| `get_attribute` | Get Element Attribute | Get an HTML attribute value from an element. Use to read href, src, value, or other attributes. Returns the attribute value. |
| `get_dom_snapshot` | Get DOM Snapshot | Get a structured DOM snapshot of the current page with element references. Use to understand page structure and find selectors. Returns JSON with elements, selectors, and form data. |

#### Manual Mode -- Waiting

| Tool | Title | Description |
|------|-------|-------------|
| `wait_for_element` | Wait for Element | Wait until an element matching the selector appears on the page. Use after navigation or actions that load new content. Returns when element is found or times out. |
| `wait_for_stable` | Wait for Page Stable | Wait until the page stops changing (no DOM mutations). Use after actions that trigger dynamic content loading. Returns when page is stable. |

#### Manual Mode -- Tabs

| Tool | Title | Description |
|------|-------|-------------|
| `open_tab` | Open New Tab | Open a new browser tab with the given URL. Use when you need to work in a separate tab. Returns the new tab ID. |
| `switch_tab` | Switch Tab | Switch the active browser tab by tab ID. Use to move between open tabs. Returns confirmation with the new active tab info. |
| `list_tabs` | List Open Tabs | List all open browser tabs with title, URL, and active status. Use to see what tabs are available. Returns array of tab objects. |

#### Manual Mode -- Data

| Tool | Title | Description |
|------|-------|-------------|
| `fill_sheet` | Fill Spreadsheet | Fill cells in a spreadsheet starting from a given cell with CSV data. Use for bulk data entry into Google Sheets or similar. Returns fill confirmation. |
| `read_sheet` | Read Spreadsheet | Read cell values from a spreadsheet range. Use to extract tabular data from Google Sheets or similar. Returns cell values as array. |

### Resource Descriptions

| URI | Title | Description |
|-----|-------|-------------|
| `browser://dom/snapshot` | Current Page DOM | Structured DOM snapshot of the active tab with elements, selectors, forms, and page structure. Read this to understand what is on the current page before using action tools. |
| `browser://tabs` | Open Tabs | All open browser tabs with title, URL, and active status. Read this to see available tabs before switching. |
| `fsb://site-guides` | Site Guides | All FSB site guide definitions with selectors and workflows for supported websites. Read this to use optimized selectors for known sites. |
| `fsb://memory` | FSB Memory | Episodic, semantic, and procedural memory from previous automation sessions. Read this to benefit from past experience on similar tasks. |
| `fsb://config` | Extension Config | Current FSB extension configuration including provider, model, and connection status. API keys are redacted. Read this to check extension health. |

### Prompt Template Descriptions

| Prompt | Title | Description |
|--------|-------|-------------|
| `search-and-extract` | Search and Extract Data | Navigate to a site, search for information, and extract structured data. Provide the site URL, search query, and fields to extract. |
| `fill-form` | Fill Out a Form | Navigate to a page and fill out a form with provided data. Provide the page URL and field-value pairs. |
| `monitor-page` | Monitor Page for Changes | Watch a page for specific content changes and report when they occur. Provide the URL and what to watch for. |
| `navigate-and-read` | Navigate and Read | Go to a URL and read its content, returning structured information. Provide the URL and what information to extract. |

### Error Messages

All errors returned by MCP tools follow this pattern: state the problem, state the likely cause, state what the agent should do next.

| Error Condition | Error Text |
|-----------------|------------|
| Extension not connected | `Extension not connected. The FSB Chrome extension must be running and connected via Native Messaging. Verify the extension is installed and the native host is registered.` |
| No active tab | `No active browser tab found. Open a browser tab or use the navigate tool to go to a URL first.` |
| Task already running | `A task is already running. Wait for it to complete or use stop_task to cancel it. Read-only tools (read_page, get_dom_snapshot, list_tabs) still work while a task runs.` |
| Element not found | `Element not found: {selector}. The selector did not match any element on the current page. Use get_dom_snapshot to see available elements and their selectors.` |
| Navigation failed | `Navigation to {url} failed. The URL may be invalid or unreachable. Verify the URL and try again.` |
| Task timeout | `Task timed out after {seconds} seconds. The automation did not complete within the allowed time. Try a simpler task or break it into smaller steps using manual mode tools.` |
| Native messaging error | `Native messaging communication failed. The bridge between the MCP server and Chrome extension is broken. Restart the MCP server and verify the native host manifest is correctly installed.` |
| Action rejected | `Action rejected by the extension. The requested action could not be performed on the current page. Use read_page or get_dom_snapshot to check the current page state.` |
| Tool queue timeout | `Tool call timed out waiting in queue. Another task is running and did not complete in time. Use stop_task to cancel the running task, or use read-only tools which bypass the queue.` |

### Console/Stderr Log Prefixes

The MCP server writes diagnostic output to stderr (stdout is reserved for MCP JSON-RPC). All log lines use this prefix format:

| Level | Prefix |
|-------|--------|
| Info | `[FSB MCP]` |
| Error | `[FSB MCP] ERROR:` |
| Debug | `[FSB MCP] DEBUG:` |

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| npm | @modelcontextprotocol/sdk, zod, typescript | not applicable (backend dependencies, not UI registry) |

No shadcn registry. No third-party UI registries. npm dependencies are standard backend packages vetted in 45-RESEARCH.md.

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PENDING (tool descriptions, error messages, resource metadata)
- [ ] Dimension 2 Visuals: NOT APPLICABLE (no visual frontend)
- [ ] Dimension 3 Color: NOT APPLICABLE (no visual frontend)
- [ ] Dimension 4 Typography: NOT APPLICABLE (no visual frontend)
- [ ] Dimension 5 Spacing: NOT APPLICABLE (no visual frontend)
- [ ] Dimension 6 Registry Safety: PENDING (npm packages only, no UI registries)

**Approval:** pending
