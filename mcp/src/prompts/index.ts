import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

/**
 * Register MCP prompt templates for common FSB workflows.
 * Prompts provide pre-built instruction patterns that agents
 * can use to accomplish common browser automation tasks.
 */
export function registerPrompts(server: McpServer): void {
  // Browser Automation Guide for the read then act workflow
  server.registerPrompt(
    'browser-automation-guide',
    {
      title: 'Browser Automation Guide',
      description: 'Learn the recommended workflow for browser automation with FSB tools. Covers the read then act pattern, tool selection, and common patterns.',
    },
    () => ({
      messages: [
        {
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: `# FSB Browser Automation Guide

## Important: Manual Tools First

Always use manual tools (navigate, read_page, click, type_text, etc.) to accomplish browser tasks step by step. Do NOT use run_task (autopilot) unless the user explicitly asks for it with words like "autopilot", "run task", or "let FSB handle it". Manual tools give you full visibility and control over every action.

## Core Pattern: Read, Then Act

Always follow this workflow:

1. **Navigate** to the target page using \`navigate\`
2. **Read** the page using \`read_page\` (quick text overview) or \`get_dom_snapshot\` (structured elements with selectors)
3. **Find** the target element in the snapshot (look for element refs like "e5" or CSS selectors)
4. **Act** using the right tool: \`click\`, \`type_text\`, \`hover\`, \`select_option\`, etc.
5. **Verify** the result by calling \`read_page\` again

## Tool Selection Guide

**Reading the page:**
* \`read_page\`: quick text content with automatic waits for JS heavy sites, about 8K chars max
* \`get_dom_snapshot\`: structured elements with refs (e1, e2...), selectors, positions
* \`get_page_snapshot\`: compact planning snapshot for agent reasoning
* \`get_text\` / \`get_attribute\`: read a specific element's content

**Interacting with elements:**
* \`click\`: buttons, links, controls (use selector or ref from get_dom_snapshot)
* \`type_text\`: input fields, search boxes, text areas
* \`press_enter\`: submit forms
* \`select_option\`: native dropdowns
* \`check_box\`: checkboxes
* \`hover\`: reveal menus or tooltips before clicking

**When DOM tools fail (canvas, overlays, SVG):**
* \`click_at\`: click at viewport coordinates
* \`drag\`: drag between coordinates for canvas drawing or sliders
* \`scroll_at\`: zoom at coordinates on maps or dense panes
* \`click_and_hold\`: long press

**Navigation:**
* \`navigate\`: go to URL
* \`search\`: search on current site or Google when no site search is found
* \`go_back\` / \`go_forward\`: browser history
* \`back\`: ownership gated single step history back with typed status
* \`scroll\` / \`scroll_to_top\` / \`scroll_to_bottom\`: page scrolling
* \`open_tab\` / \`switch_tab\` / \`close_tab\` / \`list_tabs\`: tab work

## Common Patterns

**Search a site:** \`navigate\` -> \`search\` -> \`read_page\` -> \`click\` result
**Fill a form:** \`navigate\` -> \`get_dom_snapshot\` -> \`type_text\` fields -> \`press_enter\`
**Extract data:** \`navigate\` -> \`read_page\` -> parse content
**Multi-page:** \`navigate\` -> \`read_page\` -> \`click\` next -> \`read_page\` -> repeat

## Error Recovery

If \`click\` fails: try \`get_dom_snapshot\` to refresh selectors, then retry. If still failing, use \`click_at\` with coordinates.
If \`type_text\` fails: try \`clear_input\` first, then \`type_text\`. Check selector with \`get_dom_snapshot\`.
If page is blank: call \`read_page\` again after navigation settles, then use \`get_dom_snapshot\` to confirm whether content scripts can see the page.`,
          },
        },
      ],
    }),
  );

  // Tool Reference with categorized tool list and usage examples
  server.registerPrompt(
    'tool-reference',
    {
      title: 'FSB Tool Reference',
      description: 'Reference for the current FSB MCP browser automation surface with categories, examples, and visual session requirements.',
    },
    () => ({
      messages: [
        {
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: `# FSB Tool Reference (59 registered handlers)

> **Default to manual tools for browser tasks.** Only use run_task if the user explicitly asks for autopilot or asks FSB to handle the task.

Action tools require \`visual_reason\` and \`client\`. Set \`is_final: true\` on the last action when the visible overlay should clear immediately. Read tools do not carry those fields.

## Power (1 tool)
| Tool | Use For | Example |
|------|---------|---------|
| execute_js | Run JavaScript in the active page | execute_js(code="return document.title") |

## Navigation (5 tools)
| Tool | Use For | Example |
|------|---------|---------|
| navigate | Go to a URL | navigate("https://amazon.com") |
| search | Search current site or Google | search("wireless mouse") |
| go_back | Browser back button | go_back() |
| go_forward | Browser forward button | go_forward() |
| refresh | Reload page | refresh() |

## Reading (8 tools)
| Tool | Use For | Example |
|------|---------|---------|
| read_page | Read page text content | read_page() or read_page(full=true) |
| get_dom_snapshot | Get elements with selectors/refs | get_dom_snapshot() |
| get_page_snapshot | Get a compact planning snapshot | get_page_snapshot() |
| get_site_guide | Load known site guidance | get_site_guide(domain="github.com") |
| get_text | Read specific element text | get_text(selector="#price") |
| get_attribute | Read element attribute | get_attribute(selector="a.link", attribute="href") |
| list_tabs | See all open tabs | list_tabs() |
| read_sheet | Read cell range | read_sheet(range="A1:C5") |

## Interaction (14 tools)
| Tool | Use For | Example |
|------|---------|---------|
| click | Click buttons/links | click(selector="#submit") or click(selector="e5") |
| type_text | Type into inputs | type_text(selector="#email", text="user@test.com") |
| press_enter | Submit forms | press_enter(selector="#search-input") |
| press_key | Keyboard shortcuts | press_key(key="Escape") or press_key(key="a", ctrl=true) |
| select_option | Choose from dropdown | select_option(selector="#country", value="US") |
| check_box | Toggle checkbox | check_box(selector="#agree-terms") |
| hover | Trigger hover menus | hover(selector=".dropdown-trigger") |
| right_click | Context menu | right_click(selector="#file-item") |
| double_click | Double-click actions | double_click(selector=".editable-cell") |
| focus | Set keyboard focus | focus(selector="#input-field") |
| clear_input | Clear input field | clear_input(selector="#search") |
| select_text_range | Select text substring | select_text_range(selector="p", startOffset=0, endOffset=50) |
| drag_drop | Drag DOM element to another | drag_drop(sourceSelector="e5", targetSelector="e12") |
| drop_file | Drop file on dropzone | drop_file(selector=".dropzone", fileName="test.pdf") |

## Scrolling (4 tools)
| Tool | Use For | Example |
|------|---------|---------|
| scroll | Scroll up/down | scroll(direction="down", amount=500) |
| scroll_to_top | Jump to page top | scroll_to_top() |
| scroll_to_bottom | Jump to page bottom | scroll_to_bottom() |
| scroll_to_element | Scroll an element into view | scroll_to_element(selector="e5") |

## CDP Coordinate Tools (7 tools)
| Tool | Use For | Example |
|------|---------|---------|
| click_at | Click at coordinates | click_at(x=400, y=300) |
| click_and_hold | Long press | click_and_hold(x=400, y=300, holdMs=3000) |
| drag | Draw/slide at coordinates | drag(startX=100, startY=200, endX=400, endY=200) |
| drag_variable_speed | Human-like drag (CAPTCHAs) | drag_variable_speed(startX=100, startY=300, endX=400, endY=300) |
| scroll_at | Zoom at coordinates (maps) | scroll_at(x=500, y=400, deltaY=-120) |
| insert_text | Insert text through keyboard compatible input | insert_text(text="hello") |
| double_click_at | Double click at coordinates | double_click_at(x=400, y=300) |

## Tabs (3 tools)
| Tool | Use For | Example |
|------|---------|---------|
| open_tab | Open new tab | open_tab(url="https://google.com") |
| switch_tab | Switch to tab | switch_tab(tabId=123) |
| close_tab | Close a tab owned by this agent | close_tab(tab_id=123) |

## Spreadsheets (1 action tool)
| Tool | Use For | Example |
|------|---------|---------|
| fill_sheet | Write CSV data to cells | fill_sheet(startCell="A1", csvData="Name,Age\\nAlice,30") |

## DOM Mutation (1 tool)
| Tool | Use For | Example |
|------|---------|---------|
| set_attribute | Set an attribute on an element | set_attribute(selector="#field", attribute="aria-label", value="Search") |

## Observability (5 tools)
| Tool | Use For | Example |
|------|---------|---------|
| list_sessions | List past automation sessions | list_sessions(limit=10) |
| get_session_detail | Inspect session logs/actions | get_session_detail(sessionId="abc123") |
| get_logs | Get recent logs | get_logs(count=50) |
| search_memory | Search learned patterns | search_memory(query="amazon checkout", domain="amazon.com") |
| get_memory_stats | Memory system stats | get_memory_stats() |

## Vault (4 tools)
| Tool | Use For | Example |
|------|---------|---------|
| list_credentials | List saved credential metadata | list_credentials() |
| fill_credential | Fill a login form from the unlocked vault | fill_credential(tab_id=123) |
| list_payment_methods | List saved payment metadata | list_payment_methods() |
| use_payment_method | Fill checkout data after confirmation | use_payment_method(payment_method_id="pm_123") |

## Browser History Helper (1 tool)
| Tool | Use For | Example |
|------|---------|---------|
| back | Single step browser history back | back() |

## Key Relationships
- **get_dom_snapshot** returns element refs (e1, e2...) usable by click, type_text, hover, etc.
- **read_page** is for text content; **get_dom_snapshot** is for finding interactive elements
- **click** is for DOM elements; **click_at** is the fallback for canvas/overlays
- **drag_drop** is for DOM-to-DOM drag; **drag** is for coordinate-based canvas drawing
- **search** auto-uses site search bars; only falls back to Google when none exists
- **start_visual_session** and **end_visual_session** are compatibility stubs that return TOOL_REMOVED

## Visual Session Compatibility (2 tools)
| Tool | Use For | Example |
|------|---------|---------|
| start_visual_session | Compatibility stub that returns TOOL_REMOVED | start_visual_session(client="Codex", task="Legacy call") |
| end_visual_session | Compatibility stub that returns TOOL_REMOVED | end_visual_session(session_token="legacy") |

## Autopilot (3 tools)
> Do NOT use run_task unless the user explicitly asks for autopilot mode. Use the manual tools above for all standard browser tasks.

| Tool | Use For | Example |
|------|---------|---------|
| run_task | Full autopilot (only if user requests) | run_task("Search Amazon for wireless mouse and add cheapest to cart") |
| stop_task | Cancel a running autopilot task | stop_task() |
| get_task_status | Check autopilot progress | get_task_status() |`,
          },
        },
      ],
    }),
  );

  // 1. Search and Extract Data
  server.registerPrompt(
    'search-and-extract',
    {
      title: 'Search and Extract Data',
      description:
        'Navigate to a site, search for information, and extract structured data. Provide the site URL, search query, and fields to extract.',
      argsSchema: {
        site: z.string().describe('Website URL or name to search on'),
        query: z.string().describe('What to search for'),
        fields: z.string().describe('Comma-separated list of data fields to extract'),
      },
    },
    ({ site, query, fields }) => ({
      messages: [
        {
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: `Use FSB's browser automation to:\n1. Navigate to ${site}\n2. Search for: ${query}\n3. Extract these fields: ${fields}\n\nUse the navigate tool to go to the site, then read_page or get_dom_snapshot to find search functionality, then interact with it using click/type_text tools. Extract the requested data and return it as structured JSON.`,
          },
        },
      ],
    }),
  );

  // 2. Fill Out a Form
  server.registerPrompt(
    'fill-form',
    {
      title: 'Fill Out a Form',
      description:
        'Navigate to a page and fill out a form with provided data. Provide the page URL and field-value pairs.',
      argsSchema: {
        url: z.string().describe('URL of the page with the form'),
        formData: z.string().describe("Field-value pairs in 'field: value' format, one per line"),
      },
    },
    ({ url, formData }) => ({
      messages: [
        {
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: `Use FSB's browser automation to:\n1. Navigate to ${url}\n2. Read the page to identify form fields using get_dom_snapshot\n3. Fill in each field using type_text:\n${formData}\n4. Submit the form using press_enter or clicking the submit button\n\nVerify each field is filled correctly before submitting.`,
          },
        },
      ],
    }),
  );

  // 3. Monitor Page for Changes
  server.registerPrompt(
    'monitor-page',
    {
      title: 'Monitor Page for Changes',
      description:
        'Watch a page for specific content changes and report when they occur. Provide the URL and what to watch for.',
      argsSchema: {
        url: z.string().describe('URL of the page to monitor'),
        watchFor: z.string().describe('Description of the change to watch for'),
        interval: z.string().optional().describe("Check interval like '30s', '1m', '5m' (default: '30s')"),
      },
    },
    ({ url, watchFor, interval }) => ({
      messages: [
        {
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: `Use FSB's browser automation to monitor a page:\n1. Navigate to ${url}\n2. Read the current page content using read_page\n3. Watch for: ${watchFor}\n4. Check the page periodically (every ${interval || '30s'}) using refresh followed by read_page\n5. When the watched condition is detected, report what changed\n\nUse get_dom_snapshot for structured content analysis if needed.`,
          },
        },
      ],
    }),
  );

  // 4. Navigate and Read
  server.registerPrompt(
    'navigate-and-read',
    {
      title: 'Navigate and Read',
      description:
        'Go to a URL and read its content, returning structured information. Provide the URL and what information to extract.',
      argsSchema: {
        url: z.string().describe('URL to navigate to'),
        extract: z.string().describe('What information to extract from the page'),
      },
    },
    ({ url, extract }) => ({
      messages: [
        {
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: `Use FSB's browser automation to:\n1. Navigate to ${url}\n2. Read the page content using read_page\n3. Extract: ${extract}\n4. If the information spans multiple pages, use scroll or click to navigate\n5. Return the extracted information as structured data\n\nUse get_dom_snapshot for detailed element analysis if read_page doesn't capture enough.`,
          },
        },
      ],
    }),
  );
}
