# Phase 55: PDF Signature Placement - Context

**Gathered:** 2026-03-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Execute online PDF editor signature placement on page 3 dotted line via MCP manual tools. Fix any interaction blockers found in-phase. Generate structured autopilot diagnostic report.

</domain>

<decisions>
## Implementation Decisions

### Target Site & Setup
- Use a free online PDF editor (Smallpdf.com, PDFBuddy, or DocHub) -- no auth for basic features
- Fallback: Sejda.com or iLovePDF.com
- Upload or open a sample multi-page PDF document
- Dismiss any cookie/consent/upgrade popups before interacting

### Test Workflow
- Navigate to online PDF editor and open/upload a sample PDF
- Navigate to page 3 of the PDF within the editor
- Select the signature/sign tool from the editor toolbar
- Place the signature on the dotted line area of page 3 using click_at
- Verify signature was placed (visual element on page)

### Pass/Fail & Diagnostics
- PASS = signature tool activated + signature placed on page 3 at approximate dotted line location
- PARTIAL = PDF editor loaded and page navigation worked but signature placement failed
- FAIL = couldn't open PDF editor or interact with it at all
- Reuse click_at for toolbar interactions and signature placement, scroll/press_key for page navigation
- Same diagnostic report template as Phase 47-54

### Claude's Discretion
- Which specific PDF editor site to use
- Which sample PDF to use (may need a PDF with a signature line)
- How to navigate to page 3 (scroll, page selector, keyboard shortcut)
- Diagnostic report details and autopilot recommendations

</decisions>

<canonical_refs>
## Canonical References

### MCP tools
- `mcp-server/src/tools/manual.ts` -- All manual browser action tools
- `content/actions.js` -- Content script tools
- `background.js` -- CDP handlers

### Prior art
- `.planning/phases/51-photopea-background-removal/51-DIAGNOSTIC.md` -- Canvas editor patterns
- `.planning/phases/54-online-piano-notes/54-DIAGNOSTIC.md` -- PASS outcome example

### Milestone requirements
- `.planning/REQUIREMENTS.md` -- CANVAS-09 requirement definition
- `.planning/ROADMAP.md` -- Phase 55 success criteria

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `click_at`, `drag`, `scroll_at`, `press_key`, `navigate`, `read_page`, `get_dom_snapshot`
- All CDP tools confirmed working through canvas, iframe, and WebGL surfaces

### Established Patterns
- Online editors may be DOM-based (click works) or canvas-rendered (click_at required)
- Page navigation in PDF editors typically uses scroll, page number input, or keyboard shortcuts

### Integration Points
- New site guide in `site-guides/productivity/` or similar category

</code_context>

<specifics>
## Specific Ideas

- PDF editors like Smallpdf render pages as images/canvas in a scrollable container
- Signature tools typically involve: click Sign button -> draw/type/upload signature -> click to place on page
- Page navigation may require scrolling through rendered pages or using a page selector
- "Dotted line" location is typically at bottom of a page -- approximate coordinates needed

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 55-pdf-signature-placement*
*Context gathered: 2026-03-21*
