# Roadmap: FSB (Full Self-Browsing)

## Active Milestone: v0.9.32 Fixx

Diagnose and fix autopilot regressions introduced across v0.9.25-v0.9.31 that degraded the core browser automation loop after the v0.9.24 architecture rewrite. The approach is audit-first: read the code to find what broke, repair each subsystem, then validate the fixes end-to-end with real browser tasks.

## Phases

**Phase Numbering:**
- Integer phases (180-185): Planned milestone work
- Decimal phases (e.g., 182.1): Urgent insertions if needed

- [x] **Phase 180: Pipeline Audit & Regression Inventory** - Read all 4 subsystems, compare against v0.9.24 baseline, produce a regression map
- [ ] **Phase 181: Agent Loop Repair** - Fix the core automation cycle: session start, iteration loop, stuck detection, limits, completion
- [ ] **Phase 182: Tool Execution Repair** - Fix tool dispatch, content script actions, selector resolution, result feedback, verification
- [ ] **Phase 183: AI Communication Repair** - Fix prompt construction, provider adapters, response parsing, history compression, continuation prompts
- [ ] **Phase 184: DOM Analysis Repair** - Fix DOM snapshots, element filtering, page context delivery, scroll awareness, site guide loading
- [ ] **Phase 185: End-to-End Validation** - Validate all repairs work together on real browser automation tasks

## Phase Details

### Phase 180: Pipeline Audit & Regression Inventory
**Goal**: A complete regression map exists showing exactly what broke in each subsystem since v0.9.24
**Depends on**: Nothing (first phase)
**Requirements**: (none -- foundational audit that enables all repair phases)
**Success Criteria** (what must be TRUE):
  1. The agent-loop.js and background.js code paths for session start, iteration, stuck detection, and completion have been read and compared against v0.9.24 architecture contracts
  2. The tool dispatch path from agent loop through tool-executor.js to content script actions has been traced and regressions identified
  3. The AI communication path (prompt construction, provider adapter formatting, response parsing) has been audited against the tool_use contract
  4. The DOM snapshot pipeline (capture, filtering, context assembly, site guide injection) has been audited for regressions
  5. A written regression inventory lists each identified issue with its location, expected behavior, and actual behavior
**Plans:** 3 plans

Plans:
- [x] 180-01-PLAN.md -- Audit Agent Loop + Tool Execution subsystems
- [x] 180-02-PLAN.md -- Audit AI Communication + DOM Analysis subsystems
- [x] 180-03-PLAN.md -- Assemble AUDIT.md with cross-subsystem analysis and repair phase mapping

### Phase 181: Agent Loop Repair
**Goal**: The autopilot agent loop starts, iterates, detects stuck states, respects limits, and stops cleanly
**Depends on**: Phase 180
**Requirements**: LOOP-01, LOOP-02, LOOP-03, LOOP-04, LOOP-05, LOOP-06
**Success Criteria** (what must be TRUE):
  1. User clicks "Start" in popup or sidepanel and autopilot begins executing within 2 seconds
  2. The agent loop cycles through tool_use response -> tool execution -> tool_result feedback -> AI continuation without errors in the console
  3. Killing and restarting the service worker resumes the session from persisted state without losing progress
  4. After 3 identical actions with no DOM change, stuck detection fires and injects a recovery hint into the next AI prompt
  5. Automation halts automatically when cost exceeds $2 or elapsed time exceeds 10 minutes
**Plans:** 3 plans

Plans:
- [ ] 181-01-PLAN.md -- Add importScripts for agent-loop ecosystem and restore CDP mouse message handlers
- [ ] 181-02-PLAN.md -- Create session hooks and rewire handleStartAutomation to use runAgentLoop
- [ ] 181-03-PLAN.md -- Verify integration and human-verify extension loads correctly

### Phase 182: Tool Execution Repair
**Goal**: Every registered tool dispatches correctly and returns structured results the AI can act on
**Depends on**: Phase 181
**Requirements**: TOOL-01, TOOL-02, TOOL-03, TOOL-04, TOOL-05
**Success Criteria** (what must be TRUE):
  1. The tool executor routes each tool name to the correct handler (content script message, CDP command, or background action) without "unknown tool" errors
  2. Click, type, navigate, and scroll actions visibly affect the target page when given a valid selector or coordinates
  3. Each tool execution returns a result object with success/failure status, what changed, and enough context for the AI to decide the next step
  4. When the primary selector fails, the selector resolver tries ID, data attributes, ARIA, CSS class, and coordinate fallbacks in order
  5. After each action, verification checks whether the expected effect occurred (element state change, navigation, DOM mutation)
**Plans**: TBD

### Phase 183: AI Communication Repair
**Goal**: The AI receives correct prompts, responds with valid tool_use blocks, and conversation history stays within budget
**Depends on**: Phase 180
**Requirements**: AICOM-01, AICOM-02, AICOM-03, AICOM-04, AICOM-05
**Success Criteria** (what must be TRUE):
  1. The system prompt sent to the AI includes the full tool definitions JSON schema, current page context, and the user's task instruction
  2. Provider adapters produce correctly formatted tool_use request payloads for xAI, OpenAI, Anthropic, and Gemini without API errors
  3. When the AI responds with a tool_use content block, the parser extracts the tool name and parameters into an executable action object
  4. Conversation history compresses to stay under the token budget by sliding-window trimming old turns while preserving the system prompt and recent context
  5. Continuation prompts after each tool execution include the updated DOM snapshot, the tool result, and any recovery hints from stuck detection
**Plans**: TBD

### Phase 184: DOM Analysis Repair
**Goal**: The AI receives accurate, focused page snapshots that enable correct element targeting
**Depends on**: Phase 180
**Requirements**: DOM-01, DOM-02, DOM-03, DOM-04, DOM-05
**Success Criteria** (what must be TRUE):
  1. DOM snapshots contain interactive elements (buttons, links, inputs, selects) with their selectors, text content, and viewport positions
  2. The filtering pipeline reduces a typical page from hundreds of elements down to approximately 50 relevant interactive elements
  3. Every AI prompt that includes page context contains the current URL, page title, form structure, and heading hierarchy
  4. Scrolling down on a long page and requesting a new snapshot includes elements that were below the initial viewport fold
  5. Navigating to a domain with a site guide (e.g., google.com, amazon.com) loads and injects domain-specific interaction hints into the AI prompt
**Plans**: TBD

### Phase 185: End-to-End Validation
**Goal**: The repaired autopilot completes real browser tasks autonomously from start to finish
**Depends on**: Phase 181, Phase 182, Phase 183, Phase 184
**Requirements**: (none -- validates all repairs from phases 181-184)
**Success Criteria** (what must be TRUE):
  1. A Google search task ("search for wireless mouse on Amazon") navigates to Google, types the query, clicks a result, and reaches the Amazon page without manual intervention
  2. A form-fill task navigates to a test form, fills fields, and submits without getting stuck or producing console errors
  3. The automation runs for at least 5 iterations without the agent loop crashing, losing session state, or producing malformed AI requests
  4. When a task completes, the overlay shows completion status and the session stops cleanly without orphaned timers or listeners
**Plans**: TBD

## Progress

**Execution Order:** 180 -> 181 -> 182 (183 and 184 can run in parallel after 180) -> 185

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 180. Pipeline Audit & Regression Inventory | 3/3 | Complete    | 2026-04-18 |
| 181. Agent Loop Repair | 0/3 | Not started | - |
| 182. Tool Execution Repair | 0/TBD | Not started | - |
| 183. AI Communication Repair | 0/TBD | Not started | - |
| 184. DOM Analysis Repair | 0/TBD | Not started | - |
| 185. End-to-End Validation | 0/TBD | Not started | - |

## Previous Milestones

<details>
<summary>v0.9.31 Dashboard & MCP Repair (shipped 2026-04-18, no phases completed)</summary>

Started but no phases completed. Angular dashboard and MCP repair goals defined but not executed. Superseded by v0.9.32 Fixx.

</details>

<details>
<summary>v0.9.30 MCP Platform Install Flags (shipped 2026-04-18)</summary>

3 phases (174-176), 6 plans. Platform registry with 10 MCP platform configs, format-aware config engine (JSON/JSONC/TOML/YAML), install/uninstall CLI for all platforms, Claude Code CLI delegation, --dry-run preview, --all bulk operations.

</details>

<details>
<summary>v0.9.29 Showcase Angular Migration (shipped 2026-04-15)</summary>

Phase 173 only. Angular showcase shell route parity, theme persistence parity, five-route content migration, server canonical-route/legacy-redirect compatibility. Phases 174-177 deferred.

</details>

## Backlog

### Phase 999.1: MCP Tool Gaps & Click Heuristics (BACKLOG)

**Goal:** Fix three MCP tool issues surfaced during LinkedIn automation: (1) wire execute_js tool handler using chrome.scripting.executeScript in MAIN world, (2) add text-based click targeting with case-insensitive substring matching for dynamic web apps, (3) fix MCP bridge routing so background-routed tools are handled by the service worker instead of being sent to the content script.
**Depends on**: Nothing (independent backlog fix)
**Requirements**: MCP-ROUTE-01, MCP-EXEC-01, MCP-CLICK-01, MCP-CLICK-02
**Success Criteria** (what must be TRUE):
  1. MCP bridge routes background-flagged tools to the service worker and content-flagged tools to the content script
  2. execute_js tool executes user JavaScript in the active tab's MAIN world and returns serialized results
  3. Click tool accepts a text parameter for case-insensitive substring matching against element textContent
  4. First visible element matching the text is clicked; error returned when no visible match exists
**Plans:** 2/2 plans complete

Plans:
- [x] 999.1-01-PLAN.md -- Route-aware MCP bridge dispatch and execute_js background handler
- [x] 999.1-02-PLAN.md -- Text-based click targeting in tool definition and content actions
