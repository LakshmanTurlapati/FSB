# Phase 127: BF Cache Resilience - Context

**Gathered:** 2026-03-31
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure phase in autonomous mode)

<domain>
## Phase Boundary

Click actions that cause page navigation return success with navigation info instead of cryptic BF cache errors, and the content script stays connected across back/forward transitions. The `pageshow` event with `event.persisted` is the canonical detection mechanism.

</domain>

<decisions>
## Implementation Decisions

### BF Cache Detection
- **D-01:** Add `pageshow` event listener in content script lifecycle that checks `event.persisted === true` to detect BF cache restoration. Chrome 123+ proactively closes extension message ports on BF cache entry.
- **D-02:** On BF cache restoration, content script re-establishes communication port with background service worker via `chrome.runtime.connect()` or re-initializing the message listener.
- **D-03:** window.FSB namespace and MutationObserver survive BF cache -- only the port dies. No need to re-initialize content script modules.

### Click Response Handling
- **D-04:** When click causes navigation and the content script port disconnects, the MCP handler in background.js should catch the error and return `{success: true, navigated: true, newUrl: ...}` instead of propagating the BF cache error.
- **D-05:** Use `chrome.webNavigation.onCommitted` listener in background.js to detect navigation after click, providing the new URL for the response.
- **D-06:** The existing `sendMessageWithRetry` pattern in background.js (line ~3166, used by autopilot) should be adapted for the MCP path.

### Claude's Discretion
All implementation details not specified above are at Claude's discretion. Use ROADMAP phase goal, success criteria, and codebase conventions to guide decisions.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `sendMessageWithRetry` in background.js (~line 3166) -- already handles retry after content script reconnection in autopilot path
- `ensureContentScriptInjected` in background.js -- re-injects content script if needed
- `content/lifecycle.js` -- already has `onDisconnect` handler and BF_CACHE recovery handler
- `pageLoadWatcher` in background.js -- monitors page ready state after navigation

### Established Patterns
- MCP handlers at background.js ~line 13700+ use try/catch with sendMCPResponse for error handling
- Content script uses `chrome.runtime.onMessage` for receiving messages
- The "Content script communication failed: The page keeping the extension port is moved into back/forward cache" error is the one to catch

### Integration Points
- background.js mcp:execute-action handler -- needs to catch BF cache errors on click and return navigation info
- content/lifecycle.js -- needs pageshow listener for port reconnection
- No MCP server changes needed -- the bridge just passes through responses

</code_context>

<specifics>
## Specific Ideas

- The pageshow listener should be ~10 lines: listen for pageshow, check event.persisted, re-establish port
- Click error handling should catch the specific "back/forward cache" error message string
- Consider using chrome.webNavigation.onCommitted to get the new URL after navigation

</specifics>

<deferred>
## Deferred Ideas

None -- phase scope is tightly defined.

</deferred>
