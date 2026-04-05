# Phase 70: Reddit Thread Bottom Reply - Context

**Gathered:** 2026-03-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Execute Reddit thread bottom navigation and last comment reply via MCP manual tools; fix blockers.

</domain>

<decisions>
## Implementation Decisions

### Target Site & Setup
- Use Reddit (reddit.com or old.reddit.com) -- public threads accessible without auth
- Select a thread with many comments to test scrolling to bottom
- If reply requires auth, document as skip-auth for the reply portion

### Test Workflow
- Navigate to a Reddit thread with many comments
- Scroll to the very bottom of the comment thread
- Identify the last comment
- Attempt to reply to the last comment (click reply, type text)
- If auth required for reply, document the auth blocker

### Pass/Fail & Diagnostics
- PASS = scrolled to bottom + found last comment + reply attempted (or skip-auth if login needed)
- PARTIAL = scrolled but couldn't find bottom or reply failed
- FAIL = couldn't access or scroll the thread
- skip-auth = Reddit requires login for reply
- Use scroll for navigation, click for reply button, type_text for reply content
- Same diagnostic report template

### Claude's Discretion
- Which Reddit thread to use
- How to detect bottom of thread
- Reply text content
- Diagnostic details

</decisions>

<canonical_refs>
## Canonical References

### MCP tools
- `mcp-server/src/tools/manual.ts` -- scroll, click, type_text, read_page

### Milestone requirements
- `.planning/REQUIREMENTS.md` -- SCROLL-04 requirement
- `.planning/ROADMAP.md` -- Phase 70 success criteria

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `scroll` and `scroll_to_bottom` for thread navigation
- `click` for reply button
- `type_text` for reply content
- `read_page` for comment extraction

### Integration Points
- Site guide in `site-guides/social/reddit.js`

</code_context>

<specifics>
## Specific Ideas

- Reddit uses "load more comments" buttons rather than pure infinite scroll
- Old Reddit (old.reddit.com) has simpler DOM structure
- New Reddit uses virtualized comment rendering

</specifics>

<deferred>
## Deferred Ideas

None

</deferred>

---

*Phase: 70-reddit-thread-bottom-reply*
*Context gathered: 2026-03-21*
