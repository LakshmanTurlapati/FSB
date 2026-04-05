# Phase 98: Prompt Architecture - Context

**Gathered:** 2026-03-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Restructure the autopilot system prompt with tool-type decision guidance and task-type conditional sections so the AI chooses the right interaction method (DOM element, CDP coordinate, text range, file upload) for each task type without human prompt intervention.

</domain>

<decisions>
## Implementation Decisions

### Tool Decision Guide Structure
- Add a new "TOOL SELECTION GUIDE" section at the top of CLI_COMMAND_TABLE (not conditional, AI sees it every turn)
- Concise decision table format: 5-6 rows (DOM/CDP/text-range/file-upload/sheets) with "use when" column
- Keep existing CLI_COMMAND_TABLE categories as-is, add decision guide section above them (minimal disruption, Phase 97 CDP sections preserved)

### Task-Type Detection Extension
- Add 'canvas' task type for drawing/mapping/diagramming apps
- Detection via keyword + site-guide category hybrid: keywords (draw, drag, canvas, map, whiteboard, diagram) OR site-guide category 'Design' maps to canvas
- Text selection and file upload detected as sub-patterns within existing task types via keywords ("select text" triggers text-range hints, "upload file" triggers dropfile hints) -- no new dedicated task types

### Conditional Prompt Injection
- getToolsDocumentation() keeps full CLI_COMMAND_TABLE always (AI needs all tools available)
- Inject a 2-3 line "PRIORITY TOOLS" block before the full table per task type (e.g. "For this canvas task, PREFER CDP coordinate tools. Use DOM tools only if element has a ref.")
- Canvas tasks get behavioral guidance beyond tool priority (e.g. "Canvas elements have no DOM refs, always use viewport coordinates from element position data")
- Update getRelevantTools() switch to include CDP tools for canvas type (matching pattern of gaming returning arrow keys)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `detectTaskType()` in ai/ai-integration.js:4355 -- keyword+site-guide task type detection (search, email, form, extraction, navigation, gaming, shopping, multitab, career, media)
- `getRelevantTools()` in ai/ai-integration.js:4524 -- per-task-type tool subsets (switch statement)
- `getToolsDocumentation()` in ai/ai-integration.js:4567 -- currently returns full CLI_COMMAND_TABLE regardless of taskType
- `CLI_COMMAND_TABLE` constant in ai/ai-integration.js:14 -- CLI verb reference (Phase 97 added CDP sections)
- `_buildTaskGuidance()` in ai/ai-integration.js:4260 -- task-type-specific prompt injection via TASK_PROMPTS or site guides
- `guideToTaskType` mapping in detectTaskType() for site-guide category -> task type

### Established Patterns
- Task type detection: keyword matching on task string + site-guide category mapping
- Tool subset selection: switch/case on taskType returning array of tool names
- Prompt injection: system prompt template string interpolates `${this.getToolsDocumentation(taskType, siteGuide)}` and `${this._buildTaskGuidance(taskType, siteGuide, currentUrl, task)}`
- Site guide category -> taskType mapping via guideToTaskType object

### Integration Points
- System prompt assembly at ai/ai-integration.js:2580-2589 (taskType, tools documentation, task guidance all injected here)
- Site guide matching feeds into detectTaskType which feeds into prompt assembly
- getRelevantTools used for element prioritization in prioritizeForTask()

</code_context>

<specifics>
## Specific Ideas

No specific requirements -- open to standard approaches following established patterns

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>
