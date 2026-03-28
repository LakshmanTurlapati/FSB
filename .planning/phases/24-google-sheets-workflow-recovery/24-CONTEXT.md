# Phase 24: Google Sheets Workflow Recovery - Context

**Gathered:** 2026-03-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix broken Google Sheets automation so the AI receives Sheets-specific guidance and can interact with canvas-based grids. Three failure layers: keyword matching misses common task phrasings, URL-based guide re-detection doesn't work mid-session, and the AI is paralyzed without a site guide on canvas-heavy pages.

</domain>

<decisions>
## Implementation Decisions

### Keyword matching
- Research best practices for fuzzy keyword matching in task-routing systems (researcher directive -- don't lock an approach yet)
- Investigate weighted/priority keywords where strong signals like "google sheet" can single-handedly match, vs weak signals like "sheet" needing corroboration
- Extract URLs from task text and run them through getGuideForUrl() -- if user says "fill in this sheet: docs.google.com/spreadsheets/d/...", that's an instant match
- Scope: Productivity Tools keywords only (Sheets/Docs) -- don't audit all 9 categories

### Mid-session guide re-detection
- Debug existing flow first -- the code already calls getGuideForTask(task, currentUrl) each iteration, something is passing the wrong URL
- Ensure background script queries chrome.tabs.get(tabId) for the current URL before each AI call, not rely on cached/initial URL
- Add info-level log when guide activates mid-session: "Site guide activated: Google Sheets (detected via URL)" for easy debugging
- First-turn behavior without guide is acceptable if task just navigates -- Claude's discretion on whether to pre-load guide from task keywords

### AI resilience without a guide
- Add exploration guidance to the generic (no-guide) fallback prompt: identify interactive elements, try form fields and buttons, use keyboard shortcuts (Tab, Enter, Escape, arrow keys) for navigation on canvas-heavy pages
- Smarter stuck recovery for canvas pages: when stuck on a canvas-heavy page, recovery should suggest keyboard-based interaction rather than refresh/new-tab loops
- This is a safety net -- detection fixes are the primary fix, but the AI should be self-sufficient enough to explore unfamiliar pages

### Claude's Discretion
- Exact implementation of weighted keyword matching (after research)
- Whether to pre-load guide from task keywords on first iteration
- Specific wording of generic prompt exploration guidance
- How to detect "canvas-heavy page" for stuck recovery hints

</decisions>

<specifics>
## Specific Ideas

- The AI should be able to "figure things out" even without a guide -- it has CLI commands including keyboard shortcuts, and should use them to explore
- Keyboard shortcuts ARE CLI commands in FSB (key "Escape", key "Tab", etc.) -- the generic prompt should make this strategy explicit
- Session logs show the AI opened 3 new tabs trying to "start fresh" when stuck -- this wastes iterations and should be addressed by smarter stuck recovery

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `getGuideForUrl()` at site-guides/index.js:109 -- URL pattern matching already works for docs.google.com/spreadsheets, just not being called with the right URL
- `getGuideForTask()` at site-guides/index.js:126 -- hybrid lookup (URL then keyword), the keyword path needs fixing
- Domain transition detection at ai-integration.js:2276 -- already triggers full prompt rebuild on domain change
- Google Sheets site guide at site-guides/productivity/google-sheets.js -- comprehensive 256-line guide with Name Box workflows, warnings, selectors

### Established Patterns
- Keyword matching uses flat `taskLower.includes(kw)` with 2-match threshold at site-guides/index.js:184-197
- Site guide flows through: getGuideForTask() -> detectTaskType() -> _buildTaskGuidance() -> system prompt
- buildIterationUpdate() at ai-integration.js:2262 resolves guide once per call using context.currentUrl

### Integration Points
- background.js passes context to buildIterationUpdate() -- must ensure currentUrl is fresh from chrome.tabs.get()
- Stuck recovery system at ai-integration.js (recovery patterns) -- needs canvas-awareness
- Generic task prompt fallback at ai-integration.js:4062-4067 -- where exploration guidance would go

</code_context>

<deferred>
## Deferred Ideas

- Audit all 9 category keyword lists for similar singular/verb gaps -- future phase
- Generic canvas-app site guide template for other canvas-heavy apps (Google Slides, Figma, etc.) -- future phase

</deferred>

---

*Phase: 24-google-sheets-workflow-recovery*
*Context gathered: 2026-03-07*
