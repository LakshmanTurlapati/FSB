# Phase 64: Dropzone File Upload - Context

**Gathered:** 2026-03-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Execute browser dropzone file upload simulation via MCP manual tools. Fix any interaction blockers found in-phase. Generate structured autopilot diagnostic report.

</domain>

<decisions>
## Implementation Decisions

### Target Site & Setup
- Find a site with a dropzone file upload area (drag-and-drop upload zone)
- Options: Dropzone.js demo page, file.io, WeTransfer, or Google Drive upload
- No auth required for demo pages
- Dismiss any cookie/consent popups

### Test Workflow
- Navigate to a page with a file upload dropzone
- Simulate a file drop into the dropzone area
- This may require dispatching HTML5 DragEvent + DataTransfer with a file
- Verify the file was accepted (upload progress, filename displayed)

### Pass/Fail & Diagnostics
- PASS = file accepted by dropzone (upload progress or filename shown)
- PARTIAL = dropzone activated but file not accepted
- FAIL = couldn't interact with dropzone at all
- May need a new `drop_file` tool that dispatches DragEvent with DataTransfer
- Fallback: click the hidden file input and use native file dialog
- Same diagnostic report template

### Claude's Discretion
- Which dropzone site to use
- How to simulate file drop (DragEvent vs clicking hidden input)
- Whether to add a dedicated file drop tool
- Diagnostic details

</decisions>

<canonical_refs>
## Canonical References

### MCP tools
- `mcp-server/src/tools/manual.ts` -- All manual tools
- `content/actions.js` -- Content script tools

### Milestone requirements
- `.planning/REQUIREMENTS.md` -- MICRO-08 requirement
- `.planning/ROADMAP.md` -- Phase 64 success criteria

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Existing `drag_drop` MCP tool for DOM drag-and-drop
- `click`, `click_at` for clicking upload buttons
- File upload simulation requires DataTransfer API in content script

### Integration Points
- May need new file upload tool in manual.ts + actions.js
- Site guide in `site-guides/utilities/file-upload.js`

</code_context>

<specifics>
## Specific Ideas

- Browser file uploads can be triggered by clicking the hidden input[type=file] element
- Dropzone.js accepts files via both drag-and-drop (DragEvent) and click-to-browse
- Simulating a file drop requires creating a DataTransfer object with a File -- this is possible in content scripts

</specifics>

<deferred>
## Deferred Ideas

None

</deferred>

---

*Phase: 64-dropzone-file-upload*
*Context gathered: 2026-03-21*
