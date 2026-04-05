# Phase 66: Podcast Timeline Scrub - Context

**Gathered:** 2026-03-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Execute podcast audio timeline scrub to exactly 14:22 mark via MCP manual tools. Fix any interaction blockers found in-phase. Generate structured autopilot diagnostic report.

</domain>

<decisions>
## Implementation Decisions

### Target Site & Setup
- Use a podcast site with a visible audio timeline/progress bar (Spotify web, Apple Podcasts web, or podcast hosting sites)
- Fallback: any page with an HTML5 audio player with seekable timeline
- No auth required for public podcast pages

### Test Workflow
- Navigate to a podcast episode page with audio player
- Calculate the pixel position for 14:22 on the timeline scrubber
- Click or drag the timeline scrubber to the 14:22 position
- Verify the current time shows approximately 14:22

### Pass/Fail & Diagnostics
- PASS = timeline scrubbed to approximately 14:22 (within 5 seconds tolerance)
- PARTIAL = timeline moved but not to target time
- FAIL = couldn't interact with audio timeline
- Use click_at on timeline bar at calculated position, or drag scrubber thumb
- Same diagnostic report template

### Claude's Discretion
- Which podcast site/episode to use
- How to calculate 14:22 position on timeline
- Verification method for current time
- Diagnostic details

</decisions>

<canonical_refs>
## Canonical References

### MCP tools
- `mcp-server/src/tools/manual.ts` -- click_at, drag, get_attribute

### Milestone requirements
- `.planning/REQUIREMENTS.md` -- MICRO-10 requirement
- `.planning/ROADMAP.md` -- Phase 66 success criteria

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `click_at` for clicking at specific position on timeline bar
- `drag` for dragging scrubber thumb
- `get_attribute` for reading current time from aria attributes
- Similar to Phase 57 volume slider -- same coordinate calculation approach

### Integration Points
- Builds on video-player.js site guide patterns from Phase 57
- May extend media site guide or create audio-specific one

</code_context>

<specifics>
## Specific Ideas

- Timeline position = (targetSeconds / totalSeconds) * trackWidth + trackLeft
- For 14:22 = 862 seconds, need total episode length to calculate percentage
- HTML5 audio elements have currentTime property settable via JS
- Podcast players may use custom UI over HTML5 audio element

</specifics>

<deferred>
## Deferred Ideas

None

</deferred>

---

*Phase: 66-podcast-timeline-scrub*
*Context gathered: 2026-03-21*
