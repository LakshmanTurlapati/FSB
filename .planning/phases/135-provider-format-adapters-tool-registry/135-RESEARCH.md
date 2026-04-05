# Phase 135: Provider Format Adapters & Tool Registry - Research

**Researched:** 2026-03-31
**Domain:** Tool definition registry + multi-provider tool_use format translation
**Confidence:** HIGH (pure codebase analysis -- all findings verified against source files)

## Summary

This research documents every tool in FSB's codebase across three surfaces (MCP server, CLI parser, content script), maps their parameters and routing, and catalogs the exact provider format differences the adapter must handle. The registry must unify 38 browser automation tools into a single canonical JSON Schema format, with routing metadata that tells the executor where each tool runs.

The MCP server (manual.ts + read-only.ts) defines 33 tools with Zod schemas. The CLI parser (cli-parser.js) defines ~60 verb aliases mapping to ~45 distinct canonical tool names. Content script (actions.js) implements ~48 tool functions. The overlap is large but not complete -- 12 CLI-only tools have no MCP equivalent, and 2 MCP tools (drag_variable_speed, click_and_hold) lack direct CLI coverage under those exact names.

**Primary recommendation:** Start from the 33 MCP tool definitions as the baseline. Add 5 CLI-only tools that are genuinely useful for the agent loop (insert_text, double_click_at, scroll_to_element, set_attribute, read_page_full). Exclude CLI-only signal commands (done/fail/help), aliases, and niche tools not needed for autonomous operation.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** snake_case for all tool names in the canonical registry, matching existing MCP convention (click_at, read_page, get_dom_snapshot)
- **D-02:** CLI camelCase names (cdpClickAt, readpage) are NOT preserved -- the registry uses MCP names exclusively
- **D-03:** No alias system -- one name per tool, period
- **D-04:** All 35+ tools defined in the registry from day one -- no phased subset approach
- **D-05:** Start from the 33 existing MCP tool definitions in manual.ts as the baseline, add any CLI-only tools that MCP is missing
- **D-06:** Each tool definition includes: name, description, JSON Schema parameters, routing metadata (_route: "content" | "cdp" | "background" | "data", _readOnly: boolean)
- **D-07:** New file tool-use-adapter.js for all tool_use format translation -- separate from UniversalProvider
- **D-08:** UniversalProvider stays focused on basic API call mechanics (endpoint, auth, timeout, retry)
- **D-09:** tool-use-adapter.js exports: formatToolsForProvider(tools, provider), parseToolCalls(response, provider), formatToolResult(id, result, provider), isToolCallResponse(response, provider), formatAssistantMessage(response, provider)
- **D-10:** Three concrete adapter implementations inside tool-use-adapter.js: OpenAI/xAI/OpenRouter/Custom (shared), Anthropic, Gemini
- **D-11:** New file tool-definitions.js as the canonical source of truth -- imported by both autopilot and MCP
- **D-12:** Each tool is a plain object with JSON Schema inputSchema (the same schema both providers and MCP use)
- **D-13:** MCP server will import from this registry in Phase 136 (not this phase) -- Phase 135 creates the registry, Phase 136 migrates MCP to use it
- **D-14:** xAI and OpenAI share the OpenAI format: tools[].function.parameters, finish_reason: "tool_calls", arguments as JSON string
- **D-15:** Anthropic uses: tools[].input_schema, stop_reason: "tool_use", input as already-parsed object
- **D-16:** Gemini uses: functionDeclarations, functionCall parts, args already parsed, does NOT signal tool calls via finishReason (must inspect response parts)
- **D-17:** OpenRouter and Custom endpoints use the OpenAI adapter -- no separate implementation needed

### Claude's Discretion
- Internal file organization within tool-definitions.js (grouping, ordering)
- Exact JSON Schema descriptions for each tool (can refine later)
- Whether to include tool categories as metadata
- Error handling strategy within adapter methods

### Deferred Ideas (OUT OF SCOPE)
- MCP server importing from shared registry -- Phase 136
- Unified tool executor -- Phase 136
- Agent loop implementation -- Phase 137
- Streaming tool_use responses -- deferred beyond v0.9.20
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PROV-01 | User can run autopilot with xAI Grok using native tool_use | Adapter uses OpenAI format (D-14); tool definitions in formatToolsForProvider; xAI quirks documented |
| PROV-02 | User can run autopilot with OpenAI GPT-4o using native tool_use | Shared OpenAI adapter (D-14); identical format to xAI |
| PROV-03 | User can run autopilot with Anthropic Claude using native tool_use | Separate Anthropic adapter (D-15); input_schema, tool_use stop_reason, parsed input object |
| PROV-04 | User can run autopilot with Google Gemini using native tool_use | Separate Gemini adapter (D-16); functionDeclarations, no finishReason signal, parsed args |
| PROV-05 | User can run autopilot with OpenRouter models using native tool_use | Uses OpenAI adapter (D-17) |
| PROV-06 | User can run autopilot with custom endpoints using native tool_use | Uses OpenAI adapter (D-17) |
| TOOL-01 | All 35+ browser tools defined once in JSON Schema | Complete tool inventory below; 38 tools identified for registry |
| TOOL-02 | Tool definitions include routing metadata | Routing audit complete; 4 route types documented per tool |
</phase_requirements>

## Complete Tool Inventory

### Source Cross-Reference

Every tool extracted from three codebase surfaces. The "Registry Name" column shows the canonical snake_case name per D-01/D-02.

#### Navigation Tools

| # | Registry Name | MCP Name | CLI Verb(s) | Content Script Verb | Route | ReadOnly |
|---|--------------|----------|-------------|-------------------|-------|----------|
| 1 | navigate | navigate | navigate, goto | navigate | background | false |
| 2 | search | search | search, searchgoogle | siteSearch | content | false |
| 3 | go_back | go_back | back, goback | goBack | background | false |
| 4 | go_forward | go_forward | forward, goforward | goForward | background | false |
| 5 | refresh | refresh | refresh | refresh | background | false |

**Routing note:** Navigation tools (navigate, go_back, go_forward, refresh) are handled in background.js directly via `chrome.tabs.update()` and `chrome.tabs.goBack/goForward()`. The MCP path (mcp:execute-action) has a `bgNavTools` list that intercepts these before sending to content script. The `search` tool goes to content script because it needs DOM heuristics to find site-specific search inputs.

#### Interaction Tools (DOM-based)

| # | Registry Name | MCP Name | CLI Verb(s) | Content Script Verb | Route | ReadOnly |
|---|--------------|----------|-------------|-------------------|-------|----------|
| 6 | click | click | click | click | content | false |
| 7 | type_text | type_text | type | type | content | false |
| 8 | press_enter | press_enter | enter, pressenter | pressEnter | content | false |
| 9 | press_key | press_key | key, keypress | keyPress | content | false |
| 10 | select_option | select_option | select, selectoption | selectOption | content | false |
| 11 | check_box | check_box | check, togglecheckbox | toggleCheckbox | content | false |
| 12 | hover | hover | hover | hover | content | false |
| 13 | right_click | right_click | rclick, rightclick | rightClick | content | false |
| 14 | double_click | double_click | dblclick, doubleclick | doubleClick | content | false |
| 15 | select_text_range | select_text_range | selecttextrange | selectTextRange | content | false |
| 16 | drag_drop | drag_drop | dragdrop | dragdrop | content | false |
| 17 | drop_file | drop_file | dropfile | dropfile | content | false |
| 18 | focus | focus | focus | focus | content | false |
| 19 | clear_input | clear_input | clear, clearinput | clearInput | content | false |

#### Scrolling Tools

| # | Registry Name | MCP Name | CLI Verb(s) | Content Script Verb | Route | ReadOnly |
|---|--------------|----------|-------------|-------------------|-------|----------|
| 20 | scroll | scroll | scroll, scrolldown, scrollup | scroll | content | false |
| 21 | scroll_to_top | scroll_to_top | scrolltotop | scrollToTop | content | false |
| 22 | scroll_to_bottom | scroll_to_bottom | scrolltobottom | scrollToBottom | content | false |

#### Waiting Tools

| # | Registry Name | MCP Name | CLI Verb(s) | Content Script Verb | Route | ReadOnly |
|---|--------------|----------|-------------|-------------------|-------|----------|
| 23 | wait_for_element | wait_for_element | wait, waitforelement | waitForElement | content | false |
| 24 | wait_for_stable | wait_for_stable | waitstable, waitfordomstable | waitForDOMStable | content | false |

#### Tab Tools

| # | Registry Name | MCP Name | CLI Verb(s) | Content Script Verb | Route | ReadOnly |
|---|--------------|----------|-------------|-------------------|-------|----------|
| 25 | open_tab | open_tab | opentab, opennewtab | openNewTab | background | false |
| 26 | switch_tab | switch_tab | switchtab, switchtotab | switchToTab | background | false |

#### Data Tools (Google Sheets)

| # | Registry Name | MCP Name | CLI Verb(s) | Content Script Verb | Route | ReadOnly |
|---|--------------|----------|-------------|-------------------|-------|----------|
| 27 | fill_sheet | fill_sheet | fillsheet | fillsheet | content | false |
| 28 | read_sheet | read_sheet | readsheet | readsheet | content | true |

#### CDP Coordinate Tools

| # | Registry Name | MCP Name | CLI Verb(s) | Content Script Verb | Route | ReadOnly |
|---|--------------|----------|-------------|-------------------|-------|----------|
| 29 | click_at | click_at | clickat, cdpclickat | cdpClickAt | cdp | false |
| 30 | click_and_hold | click_and_hold | clickandhold, cdpclickandhold | cdpClickAndHold | cdp | false |
| 31 | drag | drag | drag, cdpdrag | cdpDrag | cdp | false |
| 32 | drag_variable_speed | drag_variable_speed | dragvariablespeed, cdpdragvariablespeed | cdpDragVariableSpeed | cdp | false |
| 33 | scroll_at | scroll_at | scrollat, cdpscrollat | cdpScrollAt | cdp | false |

#### Read-Only / Information Tools

| # | Registry Name | MCP Name | CLI Verb(s) | Content Script Verb | Route | ReadOnly |
|---|--------------|----------|-------------|-------------------|-------|----------|
| 34 | read_page | read_page | readpage | readPage (via mcp:read-page) | content | true |
| 35 | get_text | get_text | gettext | getText | content | true |
| 36 | get_attribute | get_attribute | getattr, getattribute | getAttribute | content | true |
| 37 | get_dom_snapshot | get_dom_snapshot | (none) | (via mcp:get-dom) | content | true |
| 38 | list_tabs | list_tabs | tabs, listtabs | listTabs | background | true |

### CLI-Only Tools NOT in MCP (Decision Required)

These tools exist in COMMAND_REGISTRY but have no MCP equivalent. Per D-05, CLI-only tools that the agent needs should be added.

| CLI Verb | Content Tool | Purpose | Recommendation |
|----------|-------------|---------|----------------|
| inserttext / cdpinserttext | cdpInsertText | CDP text insertion for canvas/editors | **ADD** as `insert_text` -- essential for Excalidraw, Google Docs, Slack |
| dblclickat / doubleclickat | cdpDoubleClickAt | CDP double-click at coordinates | **ADD** as `double_click_at` -- needed for canvas text editing |
| scrolltoelement | scrollToElement | Scroll element into view | **ADD** as `scroll_to_element` -- useful for long pages |
| setattr / setattribute | setAttribute | Set HTML attribute | **ADD** as `set_attribute` -- useful for form manipulation |
| blur | blur | Remove focus from element | SKIP -- rarely needed autonomously |
| selecttext | selectText | Select entire element text | SKIP -- select_text_range covers this |
| movemouse | moveMouse | Move mouse to coordinates | SKIP -- hover covers DOM, clickat covers coords |
| presskeysequence | pressKeySequence | Press comma-separated key sequence | SKIP -- press_key can be called multiple times |
| typewithkeys | typeWithKeys | Type using keyboard events | SKIP -- type_text handles this |
| sendspecialkey / special | sendSpecialKey | Send special key by name | SKIP -- press_key handles this |
| arrowup/down/left/right | arrowUp/Down/Left/Right | Arrow key shortcuts | SKIP -- press_key with key="ArrowUp" etc. |
| detectloadingstate | detectLoadingState | Detect loading spinners | SKIP -- wait_for_stable covers this |
| verifymessagesent | verifyMessageSent | Verify message sent | SKIP -- site-specific, not general |
| geteditorcontent | getEditorContent | Get editor content | SKIP -- get_text covers this |
| captcha / solvecaptcha | solveCaptcha | Solve CAPTCHA | SKIP -- framework only, no solver integrated |
| gamecontrol | gameControl | Game actions | SKIP -- niche |
| storejobdata | storeJobData | Store job data | SKIP -- background data tool, not browser action |
| getstoredjobs | getStoredJobs | Get stored jobs | SKIP -- background data tool |
| fillsheetdata | fillSheetData | Fill sheet from stored data | SKIP -- background data tool |
| closetab | closeTab | Close a tab | Consider adding but risky for autonomous agent |
| togglecheck | togglecheck | Notion-specific checkbox | SKIP -- too site-specific |
| waitfortabload | waitForTabLoad | Wait for tab to load | SKIP -- navigate already waits |
| getcurrenttab | getCurrentTab | Get current tab info | SKIP -- list_tabs provides this |

### Final Registry: 42 Tools

The 33 MCP tools (tools 1-38 above) plus 4 additions:

| # | Name | Route | ReadOnly | Params (JSON Schema) |
|---|------|-------|----------|---------------------|
| 39 | insert_text | cdp | false | `{ text: string }` |
| 40 | double_click_at | cdp | false | `{ x: number, y: number, shift?: boolean, ctrl?: boolean, alt?: boolean }` |
| 41 | scroll_to_element | content | false | `{ selector: string }` |
| 42 | set_attribute | content | false | `{ selector: string, attribute: string, value: string }` |

## Routing Architecture

### Route Types

Extracted from background.js lines 7395-7398 and 10831-10892.

| Route | Handler | Mechanism | Tools |
|-------|---------|-----------|-------|
| `content` | Content script `FSB.tools[verb](params)` | `chrome.tabs.sendMessage(tabId, { action: 'executeAction', tool, params })` | click, type_text, press_enter, press_key, select_option, check_box, hover, right_click, double_click, select_text_range, drag_drop, drop_file, focus, clear_input, scroll, scroll_to_top, scroll_to_bottom, scroll_to_element, wait_for_element, wait_for_stable, fill_sheet, read_sheet, search, read_page, get_text, get_attribute, set_attribute |
| `cdp` | Background `executeCDPToolDirect(action, tabId)` | `chrome.debugger.attach/sendCommand` | click_at, click_and_hold, drag, drag_variable_speed, scroll_at, insert_text, double_click_at |
| `background` | Background direct handlers | `chrome.tabs.update/create/query` | navigate, go_back, go_forward, refresh, open_tab, switch_tab, list_tabs |
| `data` | Background `handleBackgroundAction` | `chrome.storage.local` | (none in registry -- storeJobData/getStoredJobs/fillSheetData excluded) |

### Content Script Verb Mapping

The tool-definitions.js registry uses snake_case names. When dispatching to content script, the executor must translate to the content script's camelCase verb. This mapping is part of the registry metadata.

| Registry Name (snake_case) | Content Script Verb (FSB.tools key) |
|---------------------------|--------------------------------------|
| click | click |
| type_text | type |
| press_enter | pressEnter |
| press_key | keyPress |
| select_option | selectOption |
| check_box | toggleCheckbox |
| hover | hover |
| right_click | rightClick |
| double_click | doubleClick |
| select_text_range | selectTextRange |
| drag_drop | dragdrop |
| drop_file | dropfile |
| focus | focus |
| clear_input | clearInput |
| scroll | scroll |
| scroll_to_top | scrollToTop |
| scroll_to_bottom | scrollToBottom |
| scroll_to_element | scrollToElement |
| wait_for_element | waitForElement |
| wait_for_stable | waitForDOMStable |
| fill_sheet | fillsheet |
| read_sheet | readsheet |
| search | siteSearch |
| read_page | readPage |
| get_text | getText |
| get_attribute | getAttribute |
| set_attribute | setAttribute |

### CDP Tool Verb Mapping

CDP tools route through `executeCDPToolDirect()` in background.js. The function uses a switch on `action.tool`:

| Registry Name | CDP Switch Case |
|--------------|----------------|
| click_at | cdpClickAt |
| click_and_hold | cdpClickAndHold |
| drag | cdpDrag |
| drag_variable_speed | cdpDragVariableSpeed |
| scroll_at | cdpScrollAt |
| insert_text | cdpInsertText |
| double_click_at | cdpDoubleClickAt |

### Background Navigation Tool Mapping

| Registry Name | Background Handler |
|--------------|-------------------|
| navigate | chrome.tabs.update(tabId, { url }) |
| go_back | chrome.tabs.goBack(tabId) |
| go_forward | chrome.tabs.goForward(tabId) |
| refresh | chrome.tabs.reload(tabId) |
| open_tab | chrome.tabs.create({ url }) |
| switch_tab | chrome.tabs.update(tabId, { active: true }) |
| list_tabs | chrome.tabs.query({}) |

### Read-Only Tools (Queue Bypass)

From `mcp-server/src/queue.ts` lines 10-28. These tools bypass the mutation serialization queue and execute immediately:

```
get_dom_snapshot, list_tabs, read_page, get_text, get_attribute, read_sheet
```

The queue also lists MCP-only observability tools (list_sessions, get_session_detail, get_logs, search_memory, get_memory_stats, get_site_guides, get_memory, get_extension_config, list_agents, get_agent_stats, get_agent_history) but these are MCP-specific and NOT part of the autopilot tool registry.

## MCP Tool Parameter Schemas (Zod -> JSON Schema)

Complete parameter extraction from manual.ts and read-only.ts. These translate directly to JSON Schema `inputSchema` objects per D-12.

### Navigation

```javascript
navigate: { url: { type: 'string', description: 'URL to navigate to' } }
// required: ['url']

search: { query: { type: 'string', description: 'Search query text' } }
// required: ['query']

go_back: {}     // no params
go_forward: {}  // no params
refresh: {}     // no params
```

### Interaction

```javascript
click: { selector: { type: 'string', description: 'CSS selector or element reference from get_dom_snapshot (e.g., "#submit-btn", ".nav-link", or element ref "e5")' } }
// required: ['selector']

type_text: {
  selector: { type: 'string', description: 'CSS selector or element ref for the input field' },
  text: { type: 'string', description: 'Text to type into the field' }
}
// required: ['selector', 'text']

press_enter: { selector: { type: 'string', description: 'Optional CSS selector or element reference to press Enter on' } }
// required: [] (selector is optional)

press_key: {
  key: { type: 'string', description: "Key to press (e.g., 'Escape', 'Tab', 'ArrowDown')" },
  ctrl: { type: 'boolean', description: 'Hold Ctrl' },
  shift: { type: 'boolean', description: 'Hold Shift' },
  alt: { type: 'boolean', description: 'Hold Alt' }
}
// required: ['key']

select_option: {
  selector: { type: 'string', description: 'CSS selector or element ref for the <select> dropdown' },
  value: { type: 'string', description: 'Option value attribute or visible text' }
}
// required: ['selector', 'value']

check_box: { selector: { type: 'string', description: 'CSS selector or element reference for the checkbox' } }
// required: ['selector']

hover: { selector: { type: 'string', description: 'CSS selector or element reference to hover over' } }
// required: ['selector']

right_click: { selector: { type: 'string', description: 'CSS selector or element reference to right-click' } }
// required: ['selector']

double_click: { selector: { type: 'string', description: 'CSS selector or element reference to double-click' } }
// required: ['selector']

select_text_range: {
  selector: { type: 'string', description: 'CSS selector or element reference for the container element' },
  startOffset: { type: 'number', description: 'Character offset where selection starts (0-based)' },
  endOffset: { type: 'number', description: 'Character offset where selection ends (exclusive)' }
}
// required: ['selector', 'startOffset', 'endOffset']

drag_drop: {
  sourceSelector: { type: 'string', description: 'CSS selector or element reference for the element to drag' },
  targetSelector: { type: 'string', description: 'CSS selector or element reference for the drop target element' },
  steps: { type: 'number', default: 10, description: 'Number of intermediate move events during drag' },
  holdMs: { type: 'number', default: 150, description: 'Milliseconds to hold before starting drag motion' },
  stepDelayMs: { type: 'number', default: 20, description: 'Delay in ms between each move step' }
}
// required: ['sourceSelector', 'targetSelector']

drop_file: {
  selector: { type: 'string', description: 'CSS selector for the dropzone element' },
  fileName: { type: 'string', default: 'test-upload.txt', description: 'Name of the synthetic file to drop' },
  fileContent: { type: 'string', default: 'FSB automated file upload test content.', description: 'Text content of the file' },
  mimeType: { type: 'string', default: 'text/plain', description: 'MIME type of the file' }
}
// required: ['selector']

focus: { selector: { type: 'string', description: 'CSS selector or element reference to focus' } }
// required: ['selector']

clear_input: { selector: { type: 'string', description: 'CSS selector or element reference for the input to clear' } }
// required: ['selector']
```

### Scrolling

```javascript
scroll: {
  direction: { type: 'string', enum: ['up', 'down'], description: 'Scroll direction' },
  amount: { type: 'number', description: 'Scroll amount in pixels (default: one viewport)' }
}
// required: ['direction']

scroll_to_top: {}    // no params
scroll_to_bottom: {} // no params

// NEW (from CLI-only)
scroll_to_element: { selector: { type: 'string', description: 'CSS selector or element ref to scroll into view' } }
// required: ['selector']
```

### Waiting

```javascript
wait_for_element: { selector: { type: 'string', description: 'CSS selector to wait for -- must be CSS, not element ref' } }
// required: ['selector']

wait_for_stable: {} // no params
```

### Tabs

```javascript
open_tab: { url: { type: 'string', description: 'URL to open in new tab' } }
// required: ['url']

switch_tab: { tabId: { type: 'number', description: 'Tab ID to switch to (get IDs from list_tabs tool)' } }
// required: ['tabId']
```

### Data

```javascript
fill_sheet: {
  startCell: { type: 'string', description: 'Starting cell reference (e.g., "A1", "B5")' },
  csvData: { type: 'string', description: 'CSV data with \\n for row breaks' },
  sheetName: { type: 'string', description: 'Optional sheet name to set' }
}
// required: ['startCell', 'csvData']

read_sheet: { range: { type: 'string', description: "Cell range to read (e.g., 'A1:C5')" } }
// required: ['range']
```

### CDP Coordinate Tools

```javascript
click_at: {
  x: { type: 'number', description: 'X coordinate in viewport CSS pixels' },
  y: { type: 'number', description: 'Y coordinate in viewport CSS pixels' },
  shift: { type: 'boolean', description: 'Hold Shift key during click' },
  ctrl: { type: 'boolean', description: 'Hold Ctrl key during click' },
  alt: { type: 'boolean', description: 'Hold Alt key during click' }
}
// required: ['x', 'y']

click_and_hold: {
  x: { type: 'number', description: 'X coordinate in viewport CSS pixels' },
  y: { type: 'number', description: 'Y coordinate in viewport CSS pixels' },
  holdMs: { type: 'number', default: 5000, description: 'Duration to hold mouse button in milliseconds' }
}
// required: ['x', 'y']

drag: {
  startX: { type: 'number', description: 'Start X coordinate in viewport CSS pixels' },
  startY: { type: 'number', description: 'Start Y coordinate in viewport CSS pixels' },
  endX: { type: 'number', description: 'End X coordinate in viewport CSS pixels' },
  endY: { type: 'number', description: 'End Y coordinate in viewport CSS pixels' },
  steps: { type: 'number', default: 10, description: 'Number of intermediate mouseMoved events' },
  stepDelayMs: { type: 'number', default: 20, description: 'Delay in ms between each mouseMoved step' },
  shift: { type: 'boolean', description: 'Hold Shift key during drag' },
  ctrl: { type: 'boolean', description: 'Hold Ctrl key during drag' },
  alt: { type: 'boolean', description: 'Hold Alt key during drag' }
}
// required: ['startX', 'startY', 'endX', 'endY']

drag_variable_speed: {
  startX: { type: 'number', description: 'Start X coordinate in viewport CSS pixels' },
  startY: { type: 'number', description: 'Start Y coordinate in viewport CSS pixels' },
  endX: { type: 'number', description: 'End X coordinate in viewport CSS pixels' },
  endY: { type: 'number', description: 'End Y coordinate in viewport CSS pixels' },
  steps: { type: 'number', default: 20, description: 'Number of intermediate mouseMoved events' },
  minDelayMs: { type: 'number', default: 5, description: 'Minimum delay at peak speed' },
  maxDelayMs: { type: 'number', default: 40, description: 'Maximum delay at start/end' }
}
// required: ['startX', 'startY', 'endX', 'endY']

scroll_at: {
  x: { type: 'number', description: 'X coordinate in viewport CSS pixels' },
  y: { type: 'number', description: 'Y coordinate in viewport CSS pixels' },
  deltaY: { type: 'number', default: -120, description: 'Vertical scroll delta (-120 = zoom in, 120 = zoom out)' },
  deltaX: { type: 'number', default: 0, description: 'Horizontal scroll delta' }
}
// required: ['x', 'y']

// NEW (from CLI-only)
insert_text: { text: { type: 'string', description: 'Text to insert at current cursor position via CDP' } }
// required: ['text']

double_click_at: {
  x: { type: 'number', description: 'X coordinate in viewport CSS pixels' },
  y: { type: 'number', description: 'Y coordinate in viewport CSS pixels' },
  shift: { type: 'boolean', description: 'Hold Shift key' },
  ctrl: { type: 'boolean', description: 'Hold Ctrl key' },
  alt: { type: 'boolean', description: 'Hold Alt key' }
}
// required: ['x', 'y']
```

### Read-Only Information Tools

```javascript
read_page: { full: { type: 'boolean', description: 'If true, read entire page; if false (default), read visible viewport only' } }
// required: []

get_text: { selector: { type: 'string', description: 'CSS selector or element ref' } }
// required: ['selector']

get_attribute: {
  selector: { type: 'string', description: 'CSS selector or element ref' },
  attribute: { type: 'string', description: "HTML attribute name (e.g., 'href', 'src', 'value')" }
}
// required: ['selector', 'attribute']

// NEW (from CLI-only)
set_attribute: {
  selector: { type: 'string', description: 'CSS selector or element ref' },
  attribute: { type: 'string', description: 'HTML attribute name' },
  value: { type: 'string', description: 'Value to set' }
}
// required: ['selector', 'attribute', 'value']

get_dom_snapshot: { maxElements: { type: 'number', description: 'Maximum elements to include (default: 2000)' } }
// required: []

list_tabs: {} // no params
```

## Provider Format Adapter Specifics

### Format Translation Map

Per D-14/D-15/D-16 and STACK.md verified research:

| Aspect | OpenAI/xAI/OpenRouter/Custom | Anthropic | Gemini |
|--------|------------------------------|-----------|--------|
| **Tool def wrapper** | `{ type: "function", function: { name, description, parameters } }` | `{ name, description, input_schema }` | `{ functionDeclarations: [{ name, description, parameters }] }` |
| **Tools in request** | `tools: [...]` | `tools: [...]` | `tools: [{ functionDeclarations: [...] }]` |
| **Tool choice** | `tool_choice: "auto"` (string) | `tool_choice: { type: "auto" }` (object) | `toolConfig: { functionCallingConfig: { mode: "AUTO" } }` |
| **Parallel calls control** | `parallel_tool_calls: false` | N/A (model decides) | N/A (model decides) |
| **Response: tool call signal** | `finish_reason === "tool_calls"` | `stop_reason === "tool_use"` | Check `parts` for `functionCall` presence |
| **Response: tool call location** | `choices[0].message.tool_calls[]` | `content[]` blocks where `type === "tool_use"` | `candidates[0].content.parts[]` where `functionCall` exists |
| **Response: call ID** | `tool_calls[i].id` | `content[i].id` | `parts[i].functionCall.id` |
| **Response: tool name** | `tool_calls[i].function.name` | `content[i].name` | `parts[i].functionCall.name` |
| **Response: arguments** | `tool_calls[i].function.arguments` -- **JSON STRING, must JSON.parse** | `content[i].input` -- **already parsed object** | `parts[i].functionCall.args` -- **already parsed object** |
| **Result: role** | `role: "tool"` | `role: "user"` | `role: "user"` |
| **Result: ID field** | `tool_call_id` | `tool_use_id` (in tool_result block) | `id` (in functionResponse) |
| **Result: content** | `content: JSON.stringify(result)` | `content: [{ type: "tool_result", tool_use_id, content: string }]` | `parts: [{ functionResponse: { name, id, response: object } }]` |
| **Result: error flag** | (none -- error in content string) | `is_error: true` on tool_result block | (none -- error in response object) |
| **Assistant msg role** | `"assistant"` | `"assistant"` | `"model"` |
| **Usage tokens** | `usage.prompt_tokens, usage.completion_tokens` | `usage.input_tokens, usage.output_tokens` | `usageMetadata.promptTokenCount, usageMetadata.candidatesTokenCount` |

### Existing UniversalProvider State

From `ai/universal-provider.js`:

| Provider | Config Key | Endpoint | Auth | customFormat |
|----------|-----------|----------|------|-------------|
| xai | xai | `https://api.x.ai/v1/chat/completions` | Bearer header | false |
| openai | openai | `https://api.openai.com/v1/chat/completions` | Bearer header | false |
| anthropic | anthropic | `https://api.anthropic.com/v1/messages` | x-api-key header | true |
| gemini | gemini | `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent` | API key in query | true |
| openrouter | openrouter | `https://openrouter.ai/api/v1/chat/completions` | Bearer header | false |
| custom | custom | `{customEndpoint}` | Bearer header | false |

The `customFormat: true` flag on Anthropic and Gemini already indicates they need special request formatting. The tool-use-adapter.js can use the same provider string to select the correct adapter.

### Adapter Method Signatures

Per D-09, tool-use-adapter.js must export exactly these 5 functions:

```javascript
/**
 * Convert canonical tool definitions to provider-specific format.
 * @param {Array<{name, description, parameters}>} tools - Canonical tool definitions
 * @param {string} provider - Provider key from PROVIDER_CONFIGS
 * @returns {any} Provider-formatted tools (ready to spread into request body)
 */
formatToolsForProvider(tools, provider)

/**
 * Extract normalized tool calls from a provider response.
 * @param {object} response - Raw API response
 * @param {string} provider - Provider key
 * @returns {Array<{id: string, name: string, args: object}>} Normalized tool calls
 */
parseToolCalls(response, provider)

/**
 * Format a tool execution result for the provider's conversation history.
 * @param {string} id - Tool call ID (from parseToolCalls)
 * @param {object} result - Execution result object
 * @param {string} provider - Provider key
 * @param {object} [options] - { name: string, isError: boolean }
 * @returns {object} Provider-formatted message to append to history
 */
formatToolResult(id, result, provider, options)

/**
 * Check if a response contains tool calls (vs. text/end_turn).
 * @param {object} response - Raw API response
 * @param {string} provider - Provider key
 * @returns {boolean}
 */
isToolCallResponse(response, provider)

/**
 * Extract the assistant message to preserve in conversation history
 * before appending tool results.
 * @param {object} response - Raw API response
 * @param {string} provider - Provider key
 * @returns {object} Provider-formatted assistant message
 */
formatAssistantMessage(response, provider)
```

## Architecture Patterns

### Recommended File Structure

```
ai/
  tool-definitions.js     # NEW -- canonical tool registry (42 tools)
  tool-use-adapter.js     # NEW -- provider format translation (5 exports)
  universal-provider.js   # EXISTING -- unchanged in Phase 135
  ai-integration.js       # EXISTING -- unchanged in Phase 135
  cli-parser.js           # EXISTING -- unchanged (removed in Phase 139)
```

### Tool Definition Object Shape

Per D-12, each tool is a plain object:

```javascript
{
  name: 'click',
  description: 'Click an element on the page...',
  inputSchema: {
    type: 'object',
    properties: {
      selector: { type: 'string', description: '...' }
    },
    required: ['selector']
  },
  // Routing metadata (prefixed with _ to distinguish from schema)
  _route: 'content',           // 'content' | 'cdp' | 'background'
  _readOnly: false,            // true for get_dom_snapshot, read_page, etc.
  _contentVerb: 'click',      // content script FSB.tools key (only for route=content)
  _cdpVerb: null,             // executeCDPToolDirect switch case (only for route=cdp)
}
```

### Adapter Internal Pattern

Per D-10, three concrete adapter blocks inside one file, selected by a switch:

```javascript
function formatToolsForProvider(tools, provider) {
  switch (provider) {
    case 'anthropic':
      return tools.map(t => ({
        name: t.name,
        description: t.description,
        input_schema: t.inputSchema
      }));
    case 'gemini':
      return [{ functionDeclarations: tools.map(t => ({
        name: t.name,
        description: t.description,
        parameters: t.inputSchema
      })) }];
    default: // openai, xai, openrouter, custom
      return tools.map(t => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: t.inputSchema
        }
      }));
  }
}
```

## Common Pitfalls

### Pitfall 1: JSON.parse on Anthropic/Gemini Arguments
**What goes wrong:** Applying `JSON.parse()` to Anthropic's `input` or Gemini's `args` crashes because they are already parsed objects.
**Why it happens:** OpenAI/xAI return `arguments` as a JSON string. Copy-paste adapter code from the OpenAI path breaks.
**How to avoid:** The `parseToolCalls` function returns `args` as an object. The OpenAI path does `JSON.parse(c.function.arguments)`, the Anthropic path does `b.input` directly, and the Gemini path does `p.functionCall.args` directly. Never parse what is already an object.

### Pitfall 2: Gemini finishReason Does Not Signal Tool Calls
**What goes wrong:** Checking `finishReason === "tool_calls"` for Gemini returns false even when tools are called, so the agent loop treats it as a text response and stops.
**Why it happens:** Gemini uses `finishReason: "STOP"` for both text responses and function calls.
**How to avoid:** `isToolCallResponse` for Gemini must inspect `candidates[0].content.parts` for `functionCall` presence, not check finishReason.

### Pitfall 3: Tool Result Role Mismatch
**What goes wrong:** Sending tool results with `role: "tool"` to Anthropic or Gemini causes 400 errors.
**Why it happens:** Only OpenAI/xAI use `role: "tool"`. Anthropic uses `role: "user"` with `tool_result` content blocks. Gemini uses `role: "user"` with `functionResponse` parts.
**How to avoid:** `formatToolResult` handles this per-provider. Never hardcode the role.

### Pitfall 4: Anthropic tool_choice Object vs String
**What goes wrong:** Sending `tool_choice: "auto"` (string) to Anthropic causes an API error.
**Why it happens:** Anthropic requires `tool_choice: { type: "auto" }` (object format).
**How to avoid:** The adapter must map tool_choice settings per provider when building the request.

### Pitfall 5: Missing Assistant Message Before Tool Result
**What goes wrong:** Sending a tool_result without first appending the assistant's tool_call message to history causes context confusion.
**Why it happens:** All three provider formats require the assistant's response (containing the tool call) to appear in history before the tool result message.
**How to avoid:** `formatAssistantMessage` extracts the right shape per provider. The agent loop (Phase 137) must append assistant message, then tool result, in that order.

### Pitfall 6: Content Verb Name Mismatch
**What goes wrong:** The registry sends `type_text` to content script but `FSB.tools['type_text']` does not exist -- the content script key is `type`.
**Why it happens:** Registry uses snake_case names per D-01, but content script uses its own camelCase naming.
**How to avoid:** Every tool definition includes `_contentVerb` metadata with the exact FSB.tools key. The executor (Phase 136) uses this field, not the registry name, when dispatching.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JSON Schema validation | Custom validator for tool args | Use provider's built-in validation (strict mode on OpenAI/Anthropic) | Providers validate arguments server-side; duplicating adds complexity with no benefit |
| Tool call ID generation | Synthetic ID system | Use provider-generated IDs from parseToolCalls | All providers generate correlation IDs; only Gemini <3.0 might need synthetic fallback |
| Request body assembly | Manual JSON construction per provider | Let formatToolsForProvider + existing formatForProvider handle it | The adapter pattern keeps provider specifics in one place |

## Code Examples

### Canonical Tool Definition (tool-definitions.js)

```javascript
// One tool definition -- the shape every tool follows
const CLICK = {
  name: 'click',
  description: 'Click an element on the page. Get selectors from get_dom_snapshot first. If click fails, try click_at with viewport coordinates as fallback.',
  inputSchema: {
    type: 'object',
    properties: {
      selector: {
        type: 'string',
        description: 'CSS selector or element reference from get_dom_snapshot (e.g., "#submit-btn", ".nav-link", or element ref "e5")'
      }
    },
    required: ['selector']
  },
  _route: 'content',
  _readOnly: false,
  _contentVerb: 'click',
};
```

### formatToolsForProvider (tool-use-adapter.js)

```javascript
// Anthropic adapter -- note input_schema (not parameters)
case 'anthropic':
  return tools.map(t => ({
    name: t.name,
    description: t.description,
    input_schema: t.inputSchema
  }));
```

### parseToolCalls (tool-use-adapter.js)

```javascript
// Gemini adapter -- note: args already parsed, must check parts for functionCall
case 'gemini': {
  const parts = response.candidates?.[0]?.content?.parts || [];
  return parts
    .filter(p => p.functionCall)
    .map(p => ({
      id: p.functionCall.id || `gemini_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name: p.functionCall.name,
      args: p.functionCall.args  // already parsed object
    }));
}
```

### isToolCallResponse (tool-use-adapter.js)

```javascript
// Three different detection strategies
function isToolCallResponse(response, provider) {
  switch (provider) {
    case 'anthropic':
      return response.stop_reason === 'tool_use';
    case 'gemini':
      return (response.candidates?.[0]?.content?.parts || []).some(p => p.functionCall);
    default: // openai, xai, openrouter, custom
      return response.choices?.[0]?.finish_reason === 'tool_calls';
  }
}
```

## Open Questions

1. **Gemini ID field availability for older models**
   - What we know: Gemini 3.0+ models return `id` on functionCall. Older models may not.
   - What's unclear: Whether FSB will ever target pre-3.0 Gemini models.
   - Recommendation: Generate synthetic IDs as fallback (`gemini_${Date.now()}_${random}`) only when `p.functionCall.id` is undefined.

2. **Parallel tool calls from Anthropic/Gemini**
   - What we know: Anthropic and Gemini can return multiple tool calls in one response. OpenAI/xAI can be disabled with `parallel_tool_calls: false`.
   - What's unclear: Whether the agent loop should process them sequentially or reject parallel calls.
   - Recommendation: `parseToolCalls` always returns an array. The agent loop (Phase 137) processes them sequentially regardless. No work needed in Phase 135.

3. **xAI finish_reason for tool calls**
   - What we know: xAI docs list "stop", "length", "end_turn" as finish_reason values. OpenAI-compatible behavior should use "tool_calls".
   - What's unclear: Empirical verification needed.
   - Recommendation: Primary check is `finish_reason === 'tool_calls'`. Add fallback: if finish_reason is something else but `message.tool_calls` array exists and is non-empty, treat as tool call response.

## Project Constraints (from CLAUDE.md)

- Never run applications automatically -- only when explicitly asked
- Never use emojis in terminal logs, readme files, or anywhere unless explicitly asked
- ES2021+ JavaScript with proper error handling
- Chrome Extension Manifest V3 with proper permissions
- Security-first design principles
- No external dependencies for tool-definitions.js and tool-use-adapter.js (plain vanilla JavaScript, `importScripts` compatible for service worker)

## Sources

### Primary (HIGH confidence -- direct codebase analysis)
- `mcp-server/src/tools/manual.ts` -- 25 manual tool definitions with Zod schemas
- `mcp-server/src/tools/read-only.ts` -- 5 read-only tool definitions
- `mcp-server/src/tools/autopilot.ts` -- 3 autopilot tools (run_task, stop_task, get_task_status) -- NOT in registry
- `mcp-server/src/tools/agents.ts` -- 8 agent tools -- NOT in registry
- `mcp-server/src/tools/observability.ts` -- 5 observability tools -- NOT in registry
- `mcp-server/src/queue.ts` -- readOnlyTools set (17 entries)
- `ai/cli-parser.js` lines 153-286 -- COMMAND_REGISTRY with ~60 verb entries
- `ai/universal-provider.js` -- PROVIDER_CONFIGS for 6 providers
- `background.js` line 7395-7398 -- tool routing arrays (multiTabActions, backgroundDataTools, cdpBackgroundTools)
- `background.js` line 12606-12744 -- executeCDPToolDirect switch cases
- `background.js` line 13647-13797 -- MCP execute-action handler with bgNavTools
- `content/actions.js` -- 48 FSB.tools function implementations

### Secondary (HIGH confidence -- prior research)
- `.planning/research/STACK.md` -- Complete provider API format comparison
- `.planning/research/PITFALLS.md` -- 14 domain pitfalls
- `.planning/research/ARCHITECTURE.md` -- Integration architecture

## Metadata

**Confidence breakdown:**
- Tool inventory: HIGH -- extracted directly from source code, cross-referenced across 3 surfaces
- Provider formats: HIGH -- verified against STACK.md which was verified against official docs
- Routing metadata: HIGH -- extracted from background.js routing arrays and handler code
- Parameter schemas: HIGH -- extracted from Zod definitions in MCP server TypeScript

**Research date:** 2026-03-31
**Valid until:** Indefinite (codebase analysis, not API docs that change)
