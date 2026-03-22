# Autopilot Diagnostic Report: Phase 79 - 50-Page PDF Form Fill

## Metadata
- Phase: 79
- Requirement: CONTEXT-03
- Date: 2026-03-22
- Outcome: PARTIAL (pdf.js demo viewer accessible via HTTP 200, 65,955 bytes. Viewer HTML contains the complete toolbar with page input (#pageNumber, value="1", min="1"), previous/next buttons (#previous, #next), numPages span (#numPages), viewerContainer (#viewerContainer), and pdfViewer (#viewer). Default sample PDF is 14 pages (compressed.tracemonkey-pldi-09.pdf), not the target 50 pages. Page elements (div.page with data-page-number) and textLayer spans are entirely client-rendered by pdf.js JavaScript -- zero pre-rendered page content in server HTML. httpbin.org/forms/post form accessible via HTTP 200, 1,397 bytes with 4 text-fillable fields (custname, custtel, custemail, comments). Cross-site context retention cannot be validated via HTTP since both PDF text extraction and form filling require live browser JavaScript execution. Live MCP test blocked by WebSocket bridge disconnect -- same persistent blocker as Phases 55-78.)
- Live MCP Testing: NO (WebSocket bridge disconnected -- MCP server process running on port 7225, returns HTTP 426 "Upgrade Required" indicating WebSocket protocol mismatch. Same persistent blocker as Phases 55-78.)

## Prompt Executed
"Navigate to a pdf.js viewer with a long PDF document, extract text from pages 4, 17, and 42, then navigate to a web form and fill 3 fields with the extracted page text."

Adapted prompt (due to 14-page sample): "Navigate to the pdf.js demo viewer (14-page sample), extract text from pages 4, 7, and 14, navigate to httpbin.org/forms/post, and fill Customer name, Telephone, and Delivery instructions fields with the extracted page text."

## Result Summary
Live MCP test was attempted but blocked by the persistent WebSocket bridge disconnect (same blocker as Phases 55-78). HTTP-based validation was performed against both targets: the pdf.js demo viewer (mozilla.github.io/pdf.js/web/viewer.html, HTTP 200, 65,955 bytes) and the httpbin form (httpbin.org/forms/post, HTTP 200, 1,397 bytes). The pdf.js viewer HTML confirms a fully functional toolbar with page input (#pageNumber), navigation buttons (#previous, #next), and page count display (#numPages), but all page content (div.page elements, canvas rendering, textLayer spans) is generated client-side by pdf.js JavaScript -- zero data-page-number elements exist in server HTML. The default sample PDF (compressed.tracemonkey-pldi-09.pdf) has only 14 pages, not the target 50. Loading an external 50-page PDF via the ?file= URL parameter is blocked by CORS restrictions on the GitHub Pages deployment. The httpbin form has 4 text-fillable fields suitable for receiving extracted page text. The full cross-site workflow (PDF text extraction -> context retention -> form filling) requires live browser execution that is blocked by the WebSocket bridge disconnect.

## Step-by-Step Log
| Step | MCP Tool Used | Target | Result | Notes |
|------|---------------|--------|--------|-------|
| 1 | navigate | https://mozilla.github.io/pdf.js/web/viewer.html | NOT EXECUTED (MCP) / FETCHED (HTTP 200, 65,955 bytes) | pdf.js demo viewer loads successfully. Server HTML contains complete viewer shell: toolbar (#toolbarViewer), page input (#pageNumber, value="1", min="1"), previous/next buttons (#previous, #next), numPages span (#numPages), viewerContainer (#viewerContainer), pdfViewer div (#viewer). Default PDF: compressed.tracemonkey-pldi-09.pdf (14 pages). MCP server on port 7225 returns HTTP 426. |
| 2 | wait_for_stable | Wait for PDF to render in viewer | NOT EXECUTED (MCP) | Requires live browser. pdf.js loads the PDF asynchronously and renders pages via JavaScript. Canvas rendering + textLayer population happens after page load, estimated 1-3 seconds for 14-page sample. |
| 3 | read_page | Verify viewer structure: page elements, toolbar, textLayer on page 1 | NOT EXECUTED (MCP) / SIMULATED (HTML analysis) | Viewer container confirmed: div#viewerContainer with div#viewer.pdfViewer inside. Toolbar confirmed: #pageNumber input, #previous/#next buttons, #numPages span. 0 div.page elements in server HTML (all client-rendered). 0 textLayer spans in server HTML. 0 data-page-number attributes. Page count (14) would be visible in #numPages after JavaScript execution. |
| 4 | click + type_text + press_key | Navigate to page 4: click #pageNumber, type "4", press Enter | NOT EXECUTED (MCP) | Requires live browser with rendered PDF. The #pageNumber input exists in server HTML (value="1", min="1") but page navigation requires pdf.js JavaScript to scroll viewer to page 4 and render canvas + textLayer. The click-type-Enter sequence for page input navigation is the recommended approach from the pdf-viewer.js site guide. |
| 5 | read_page / get_dom_snapshot | Extract text from page 4: .page[data-page-number="4"] .textLayer spans | NOT EXECUTED (MCP) | Requires live browser with page 4 rendered. textLayer spans are created by pdf.js when a page is rendered in the viewport. Expected: concatenate all span.textContent from .page[data-page-number="4"] .textLayer, store first 300 characters as page4Text. The tracemonkey PDF page 4 contains technical content about trace compilation. |
| 6 | click + type_text + press_key | Navigate to page 7: click #pageNumber, type "7", press Enter | NOT EXECUTED (MCP) | Same as step 4. Page 7 navigation via page input requires live browser. The 14-page sample has distinct content on each page. Page 7 (adjusted from target page 17) would contain different technical content. |
| 7 | read_page / get_dom_snapshot | Extract text from page 7: .page[data-page-number="7"] .textLayer spans | NOT EXECUTED (MCP) | Same as step 5. Store first 300 characters as page7Text (adjusted from page17Text). |
| 8 | click + type_text + press_key | Navigate to page 14: click #pageNumber, type "14", press Enter | NOT EXECUTED (MCP) | Same as step 4. Page 14 is the last page of the sample PDF (adjusted from target page 42). |
| 9 | read_page / get_dom_snapshot | Extract text from page 14: .page[data-page-number="14"] .textLayer spans | NOT EXECUTED (MCP) | Same as step 5. Store first 300 characters as page14Text (adjusted from page42Text). |
| 10 | (analysis) | Verify all 3 text excerpts non-empty and different | NOT EXECUTED (MCP) | Cannot verify without live text extraction. Expected: pages 4, 7, and 14 of the tracemonkey PDF contain different sections of the academic paper -- content would differ. The tracemonkey paper covers trace-based JIT compilation, so page 4 (introduction/background), page 7 (algorithm details), and page 14 (references/conclusion) would have distinct text. |
| 11 | navigate | https://httpbin.org/forms/post | NOT EXECUTED (MCP) / FETCHED (HTTP 200, 1,397 bytes) | httpbin form accessible. Server-rendered HTML contains a single form with method="post" action="/post". Form fields identified: input[name="custname"] (Customer name, no type attribute = text), input[type=tel name="custtel"] (Telephone), input[type=email name="custemail"] (E-mail address), textarea[name="comments"] (Delivery instructions). Also has radio buttons (size), checkboxes (topping), and time input (delivery). 4 text-fillable fields available (3 inputs + 1 textarea). |
| 12 | read_page / get_dom_snapshot | Identify form fields: labels, input names, types | NOT EXECUTED (MCP) / SIMULATED (HTML analysis) | Form field mapping for cross-site data transfer: Field 1 (custname, label "Customer name:") = page4Text, Field 2 (custtel, label "Telephone:") = page7Text, Field 3 (comments, label "Delivery instructions:", textarea) = page14Text. custemail field available as 4th option but email validation would reject PDF text content. |
| 13 | click + type_text | Fill field 1 (custname) with page 4 text | NOT EXECUTED (MCP) | Requires live browser. Planned: click input[name="custname"] to focus, Ctrl+A to select existing text, type_text with page4Text content. Input has no type attribute (defaults to text), no maxlength, no pattern validation -- would accept any text content. |
| 14 | click + type_text | Fill field 2 (custtel) with page 7 text | NOT EXECUTED (MCP) | Requires live browser. Planned: click input[name="custtel"] to focus, Ctrl+A, type_text with page7Text. Note: input type=tel has no strict browser validation -- would accept non-numeric text (tel inputs are lenient, unlike number inputs). |
| 15 | click + type_text | Fill field 3 (comments textarea) with page 14 text | NOT EXECUTED (MCP) | Requires live browser. Planned: click textarea[name="comments"] to focus, Ctrl+A, type_text with page14Text. Textarea has no maxlength -- would accept full 300-character excerpt. This is the most suitable field for long extracted text. |
| 16 | read_page / get_dom_snapshot | Verify form fields contain typed text | NOT EXECUTED (MCP) | Requires live browser. Planned: use read_page to confirm each field's value matches the stored page text excerpts. Cross-reference: custname should contain page 4 text, custtel should contain page 7 text, comments should contain page 14 text. |
| 17 | (analysis) | OUTCOME CLASSIFICATION | PARTIAL | Both target sites accessible via HTTP. Viewer toolbar and form fields validated via server HTML analysis. But the complete workflow -- PDF text extraction, cross-site context retention, and form filling -- requires live browser MCP execution which is blocked by WebSocket bridge disconnect. |

## What Worked
- pdf.js demo viewer (mozilla.github.io/pdf.js/web/viewer.html) is accessible without authentication -- HTTP 200, 65,955 bytes of server-rendered HTML
- Viewer toolbar elements confirmed in server HTML: page input (#pageNumber, value="1", min="1"), previous button (#previous), next button (#next), numPages span (#numPages), viewerContainer (#viewerContainer), pdfViewer (#viewer)
- Default sample PDF identified: compressed.tracemonkey-pldi-09.pdf (14 pages) -- a research paper on trace-based JIT compilation with distinct content per page
- Page input element confirmed with correct attributes: id="pageNumber", class="toolbarField", value="1", min="1", tabindex="0", data-l10n-id="pdfjs-page-input"
- httpbin.org/forms/post form accessible without authentication -- HTTP 200, 1,397 bytes, fully server-rendered HTML
- Form field mapping completed: 4 text-fillable fields identified (custname as text input, custtel as tel input, custemail as email input, comments as textarea)
- Field labels confirmed via label element wrapping: "Customer name:", "Telephone:", "E-mail address:", "Delivery instructions:"
- Form action confirmed: method="post" action="/post" -- standard HTML form submission
- No cookie consent, CAPTCHA, paywall, or authentication barrier on either target site
- Cross-site workflow design validated: extract 3 pages of text from PDF (estimated 900 chars total), navigate to form, fill 3 fields
- The httpbin form's custname, custtel, and comments fields have no strict validation that would reject arbitrary PDF text content (tel inputs accept non-numeric text)

## What Failed
- **Live MCP execution not performed:** WebSocket bridge between MCP server and Chrome extension disconnected. MCP server process running on port 7225, returns HTTP 426 "Upgrade Required". This is the same persistent blocker from Phases 55-78. Without the bridge, no MCP tool can execute against the live browser DOM.
- **Zero page content in server HTML:** pdf.js renders ALL page content client-side via JavaScript. The server HTML contains the viewer shell (toolbar, sidebar, container) but zero div.page elements, zero canvas elements, zero textLayer spans, and zero data-page-number attributes. All page-related selectors from the pdf-viewer.js site guide require a live browser with JavaScript execution.
- **50-page PDF not available in demo viewer:** The default sample is only 14 pages (compressed.tracemonkey-pldi-09.pdf). Loading an external 50-page PDF via the ?file= URL parameter is blocked by CORS restrictions on the GitHub Pages deployment. Alternative approaches (arxiv PDFs, government documents) would require either: (a) a pdf.js viewer deployment without CORS restrictions, or (b) hosting a PDF on the same origin. Target pages adjusted from 4/17/42 to 4/7/14 per plan contingency (step 1c).
- **Text extraction could not be tested:** textLayer span content is generated by pdf.js JavaScript when pages are rendered. No text content exists in server HTML. Cannot validate whether textLayer extraction produces readable, non-empty text for the tracemonkey PDF.
- **Cross-site context retention not validated:** The core CONTEXT-03 challenge (retaining extracted text data across site navigation from PDF viewer to form page) cannot be tested without live browser execution. The MCP agent's ability to store 3x300-character text excerpts and carry them through a navigate call to a different domain is the key capability being tested.
- **Form filling not performed:** While form fields are validated via server HTML analysis, the actual click-Ctrl+A-type_text sequence for filling fields with stored page text requires a live browser.
- **Form field value verification not possible:** Cannot confirm that type_text correctly populates form fields without live browser DOM access.

## Tool Gaps Identified
- **WebSocket bridge availability (persistent gap, Phases 55-79):** The MCP server process runs on port 7225 with an established TCP connection, but the Chrome extension side returns HTTP 426 "Upgrade Required" for browser action dispatch. This has blocked every live MCP test since Phase 55. The full CONTEXT-03 workflow -- PDF page navigation, textLayer extraction, cross-site navigation, form field filling -- requires live browser execution. This is the most critical tool gap blocking all edge case validation.
- **Navigate loads viewer but pages are not server-rendered:** Even if navigate succeeds in a live browser, the initial DOM will not contain page elements until pdf.js JavaScript finishes loading and rendering the PDF. A wait_for_stable call after navigation is essential, but wait_for_stable may return before pdf.js completes PDF rendering (which happens asynchronously after page load). A waitForElement targeting `.page[data-page-number="1"] .textLayer span` would be more reliable for confirming the first page is fully rendered.
- **No tool for reading page count from viewer toolbar:** The #numPages span is empty in server HTML and populated by JavaScript with text like "of 14". A tool that can read this element's textContent after rendering would confirm the available page count. Current approach: use read_page after navigation and parse the page count from the DOM.
- **No tool for extracting concatenated textLayer text:** Reading textLayer requires getting all span.textContent from a page's .textLayer div and concatenating them. This requires either: (a) get_dom_snapshot with a selector targeting all spans, then client-side concatenation, or (b) a custom tool like `get_text_from_selector('.page[data-page-number="4"] .textLayer')` that returns concatenated inner text. Current approach: use get_dom_snapshot to enumerate spans, then concatenate.
- **No dedicated "clear and type" tool:** The form field filling pattern (click to focus, Ctrl+A to select all, type_text to replace) requires 3 separate tool invocations per field. A combined `set_field_value(selector, text)` tool would be more efficient and reliable for form filling. Current approach: click + press_key("Control+a") + type_text sequence.
- **CORS prevents loading external PDFs in demo viewer:** The pdf.js demo viewer on GitHub Pages blocks loading PDFs from other origins via the ?file= parameter. This means testing with 50+ page documents requires either finding a pdf.js deployment without CORS restrictions or hosting a long PDF on the same origin. Tool gap: no ability to bypass CORS or upload files to the viewer.
- **select_all text in input field:** The plan specifies Ctrl+A to select existing text before typing. This requires press_key with "Control+a" (or "Meta+a" on macOS). The press_key tool supports this, but there is no dedicated "select all text in focused element" action. This is a minor gap -- the press_key approach works in most contexts.
- **WebSocket bridge (persistent gap from Phases 55-78):** Same fundamental infrastructure blocker. The bridge disconnect means no tool can interact with live browser DOM, making all cross-site workflow testing impossible.

## Context Bloat Analysis

### Estimated Context Per Workflow Step
Based on the CONTEXT-03 cross-site PDF-to-form workflow:

- **Step 1 (navigate to pdf.js viewer):** ~2-5KB (URL, status, basic page structure confirmation)
- **Step 2 (wait_for_stable + verify viewer loaded):** ~1-3KB (stability confirmation, viewer structure)
- **Step 3 (read_page to check page count and structure):** ~5-15KB (toolbar state, page count, first page verification). A full read_page of the viewer could be larger if many page elements are in the DOM, but typically only 3-5 pages are rendered at a time due to virtualization.
- **Step 4 (navigate to page 4: click + type + Enter):** ~1-2KB (click result, type result, key press result)
- **Step 5 (extract page 4 text via get_dom_snapshot):** ~3-10KB (textLayer span enumeration for one page). The actual stored text is only 300 characters, but the tool response includes DOM structure metadata.
- **Step 6-7 (navigate + extract page 17):** ~4-12KB (same as steps 4-5)
- **Step 8-9 (navigate + extract page 42):** ~4-12KB (same as steps 4-5)
- **Step 10 (verify all 3 extractions):** ~1KB (comparison of 3 stored text strings)
- **Step 11 (navigate to form):** ~2-5KB (URL, status, page structure)
- **Step 12 (identify form fields):** ~3-8KB (DOM snapshot or read_page of form with field details)
- **Step 13-15 (fill 3 form fields):** ~3-6KB (3x click + type_text results, ~1-2KB each)
- **Step 16 (verify form filled):** ~3-8KB (read_page of form with populated field values)

### Total Context Consumed Across Full readPdfAndFillForm Workflow
- **Optimistic (minimal tool responses, targeted extraction):** ~32-82KB total across all 16 steps
- **Realistic (mix of read_page and targeted queries):** ~50-120KB total
- **Pessimistic (full read_page at each step):** ~100-250KB total

### Context Savings: 3 Pages vs 50 Pages
| Approach | Pages Read | Text Stored | Tool Invocations | Est. Context |
|----------|------------|-------------|------------------|--------------|
| Target 3 pages (4, 17, 42) | 3 | ~900 chars (3x300) | ~12 (3x navigate+extract+wait) | ~12-36KB for extraction |
| Read all 50 pages | 50 | ~150,000 chars (50x3000) | ~200 (50x navigate+extract+wait+next) | ~200-600KB for extraction |
| Read all 50 pages with full dumps | 50 | ~500,000 chars | ~200+ | ~500KB-1.5MB |

**Context savings from selective reading: 85-95% reduction.** Reading only 3 target pages instead of all 50 reduces extraction context from ~200-600KB to ~12-36KB. The stored text (900 chars vs 150,000+ chars) is the most significant savings -- it determines how much data must be carried across the site navigation boundary.

### 300-Character Text Excerpt Sufficiency
- **For form filling:** 300 characters per page is more than sufficient. The httpbin form's text inputs have no maxlength restrictions. Customer name, telephone, and delivery instructions fields can each accommodate 300 characters of arbitrary text.
- **For meaningful content:** 300 characters captures approximately 50-60 words of English text, or 2-3 sentences. This is enough to verify that distinct content was extracted from each page (different words, different topic) and that the text survived cross-site navigation.
- **For real-world PDF extraction:** 300 characters would capture a heading, first paragraph, or key data point from a page. For the tracemonkey paper, 300 chars from page 4 would include part of the technical discussion, distinguishable from pages 7 and 14.
- **Trade-off:** Storing more text per page (e.g., 1000 chars) would provide richer form content but would triple the context carried across navigation. For the CONTEXT-03 test scenario, 300 chars per page (900 total) is an excellent balance between content richness and context efficiency.

### Comparison to Phase 77 (Polling Loop) and Phase 78 (Multi-Step Edit)
| Aspect | Phase 77: CONTEXT-01 (30-Min Polling) | Phase 78: CONTEXT-02 (Notebook Edit) | Phase 79: CONTEXT-03 (PDF-to-Form) |
|--------|---------------------------------------|---------------------------------------|-------------------------------------|
| Context growth pattern | Linear: grows per polling cycle | Step-wise: fixed set of steps | Two-phase: extract then fill |
| Total context estimate | ~180-600KB over 30 minutes | ~17-80KB total | ~32-120KB total |
| Primary bloat source | Repeated full-page reads | Initial cell enumeration | textLayer extraction per page |
| Mitigation strategy | 2-snapshot retention | Targeted getText per cell | 300-char cap per page |
| Cross-site navigation | No (single site polling) | No (single site editing) | Yes (PDF viewer to form) |
| Data retention across navigation | N/A | N/A | Critical: ~900 chars across navigate |
| Unique challenge | Duration (30 min sustained) | Breadth (38 cells in one page) | Cross-site (data survives URL change) |
| Context pressure | High (linear growth over time) | Medium (bounded by step count) | Low-Medium (bounded by page count) |

**Key insight for CONTEXT-03:** Unlike Phase 77 (time-based growth) and Phase 78 (breadth-based growth), Phase 79's context challenge is cross-site data transfer. The total context is moderate (~50-120KB), but the critical question is whether the MCP agent can retain 900 characters of stored text data through a navigate call that replaces the entire page. In an MCP conversation, stored data persists in the conversation context (it does not depend on the browser's page state), so cross-site retention should work naturally -- the text is in the agent's memory, not in the DOM. This is fundamentally different from DOM-dependent data that would be lost on navigation.

### Recommendations for Context-Efficient Cross-Site Data Transfer Workflows
1. Read only the minimum necessary pages from a large document -- never dump an entire 50-page PDF into context
2. Store compact text excerpts (300 chars) rather than full page content (~3000+ chars per page)
3. Complete all extraction before navigating away from the source site -- once you leave the PDF viewer, you cannot go back to read more pages without re-loading the document
4. Navigate to target pages in forward order (4 -> 17 -> 42) to minimize scroll distance and virtualization churn between jumps
5. After extracting all data, navigate to the form in the same tab to avoid multi-tab context overhead

## Bugs Fixed In-Phase
- **Plan 01 -- pdf-viewer.js site guide extended (3e5aed0):** Added CROSS-SITE PDF-TO-FORM WORKFLOW (CONTEXT-03) guidance section, readPdfAndFillForm workflow (22 steps), TARGET SELECTION guidance, CONTEXT MANAGEMENT FOR 50-PAGE DOCUMENTS rules, and context bloat warning to the existing pdf-viewer.js site guide.
- **No runtime bugs found in Plan 02:** No live code was executed that could reveal runtime bugs. The diagnostic is based on HTTP-based analysis and server HTML parsing.
- **Observation: pdf.js demo viewer has only 14 pages, not 50.** The default sample (compressed.tracemonkey-pldi-09.pdf) is a 14-page academic paper. The plan's target of 50 pages cannot be met with the demo viewer's default sample. The ?file= parameter exists but CORS blocks loading external PDFs on the GitHub Pages deployment. Future testing should target a pdf.js deployment with a pre-loaded long document or a deployment without CORS restrictions.
- **Observation: httpbin form's email field has type=email validation.** The custemail field (input type=email) would reject arbitrary PDF text content that does not match email format. The custname (no type = text), custtel (type=tel, lenient validation), and comments (textarea) fields accept arbitrary text. For PDF-to-form testing, skip the email field and use custname, custtel, and comments for the 3 extracted page texts.

## Autopilot Recommendations

1. **Navigate directly to a pdf.js viewer URL with the target PDF already loaded (not a blank viewer).** Use a URL like `https://mozilla.github.io/pdf.js/web/viewer.html` which auto-loads the default sample PDF. Avoid navigating to a blank viewer and trying to open a file -- the open file dialog requires native file system interaction which MCP cannot perform. If a specific PDF is needed, use the `?file=` parameter with a same-origin PDF URL.

2. **Use page number input (#pageNumber + Enter) for jumping to specific pages, not scroll distance estimation.** The page input is the most reliable navigation method in pdf.js viewers. The sequence is: click on #pageNumber to focus, use type_text to clear and type the target page number, then press_key with Enter to trigger navigation. This avoids scroll distance calculation errors and works regardless of zoom level or page dimensions.

3. **Extract textLayer text immediately after each page renders -- do not defer extraction to later.** After navigating to a target page via page input, wait 500-1000ms for the page to render (or use wait_for_stable), then immediately extract text from `.page[data-page-number="N"] .textLayer` spans. Do not navigate to all 3 pages first and then go back to extract -- earlier pages will be virtualized (canvas cleared, textLayer emptied) by the time you return.

4. **Store compact text excerpts (300 chars per page) to prevent context bloat during cross-site navigation.** For a 3-page extraction from a 50-page document: store the first 300 characters of each page's textLayer text. This yields ~900 characters total (well under 1KB), which survives site navigation without context pressure. Do not store full page content (~3000+ chars per page) as this adds unnecessary context load for the form-filling step.

5. **Read pages in forward order (4 -> 17 -> 42) to minimize virtualization churn.** pdf.js virtualizes pages by clearing canvas content when they scroll far out of the viewport. Jumping forward (4 to 17 to 42) means each new page is ahead of the previous one, minimizing the distance the viewer must scroll and reducing the number of pages that need to be re-rendered. Jumping backward (42 to 17 to 4) would cause more virtualization thrashing.

6. **After extraction is complete, navigate to the form in the same tab using a single navigate call.** Once all 3 page texts are stored in the agent's context, use the navigate tool to go directly to the form URL (e.g., httpbin.org/forms/post). This replaces the PDF viewer page entirely -- but the extracted text persists in the conversation context. Do not try to open the form in a new tab, as multi-tab management adds complexity without benefit for this workflow.

7. **On the form: identify fields by label text, name attribute, or placeholder before filling.** Use read_page or get_dom_snapshot to enumerate all form fields. Map fields to the stored page data by position or suitability: prefer text inputs and textareas over email/number inputs (which may reject arbitrary text). On httpbin.org/forms/post: custname accepts any text (no type restriction), custtel accepts any text (tel is lenient), comments (textarea) accepts any text and any length.

8. **Clear each field before typing (click + Ctrl+A + type_text) to avoid appending to existing text.** Some form fields may have default or placeholder values. The safe pattern is: (a) click on the field to focus it, (b) press_key with "Control+a" to select all existing text, (c) type_text with the stored page text. This ensures the field contains only the extracted PDF text, not a concatenation with previous content.

9. **Verify filled text by re-reading the field value after typing.** After filling all 3 fields, use read_page or get_dom_snapshot to confirm each field contains the expected text. Cross-reference: field 1 should contain page 4 text, field 2 should contain page 7 text, field 3 should contain page 14 text. If any field is empty or contains unexpected content, the form filling step failed and should be retried.

10. **If PDF has fewer than 50 pages: adapt target page numbers to the available range.** The pdf.js demo viewer's default sample is 14 pages. Instead of failing the entire workflow, adapt: use pages 4, 7, and 14 (or any 3 distinct pages within range). Check the total page count from #numPages after navigation and adjust target pages before beginning extraction. The key test is the extraction-navigation-filling chain, not the specific page numbers.

## Selector Accuracy
| Selector | Expected | Actual | Match |
|----------|----------|--------|-------|
| `viewerContainer: #viewerContainer` | Main scrollable viewer container | 1 match. Found: `<div id="viewerContainer" tabindex="0">` in server HTML. Contains `<div id="viewer" class="pdfViewer">`. | MATCH |
| `viewer: #viewer, .pdfViewer` | Inner viewer div | 1 match. Found: `<div id="viewer" class="pdfViewer"></div>` in server HTML. Empty in server HTML -- pages are added by JavaScript. | MATCH |
| `page: .page, [data-page-number]` | Individual page containers | 0 matches. No `.page` or `[data-page-number]` elements in server HTML. All page divs are created by pdf.js JavaScript when the PDF is loaded and rendered. | NO MATCH (client-rendered) |
| `pageByNumber: .page[data-page-number="{N}"]` | Specific page by number | 0 matches. No data-page-number attributes in server HTML (0 occurrences). Page containers with data-page-number are created by pdf.js JavaScript. | NO MATCH (client-rendered) |
| `textLayer: .page .textLayer` | Text layer overlay on each page | 0 matches. textLayer divs are created by pdf.js JavaScript during page rendering. No .textLayer elements in server HTML. | NO MATCH (client-rendered) |
| `textLayerSpans: .page .textLayer span` | Individual text spans in textLayer | 0 matches. Spans are created by pdf.js when extracting text from PDF content streams. Zero spans in server HTML. | NO MATCH (client-rendered) |
| `pageInput: #pageNumber` | Page number input in toolbar | 1 match. Found: `<input id="pageNumber" class="toolbarField" value="1" min="1" tabindex="0" data-l10n-id="pdfjs-page-input">`. Correct ID, correct attributes. | MATCH |
| `totalPages: #numPages` | Total page count display | 1 match. Found: `<span id="numPages" class="toolbarLabel"></span>` in server HTML. Empty in server HTML -- populated by JavaScript with "of 14" after PDF loads. | MATCH (element exists, content client-rendered) |
| `nextPage: #next` | Next page button | 1 match. Found: `<button class="toolbarButton" type="button" id="next" tabindex="0" data-l10n-id="pdfjs-next-button">`. | MATCH |
| `previousPage: #previous` | Previous page button | 1 match. Found: `<button class="toolbarButton" type="button" id="previous" tabindex="0" data-l10n-id="pdfjs-previous-button">`. | MATCH |
| `zoomIn: #zoomIn` | Zoom in button | Not found in server HTML grep results. May use a different ID in the current viewer version, or may be in a section not captured. The viewer.mjs does reference zoom functionality. | UNTESTED |
| `zoomOut: #zoomOut` | Zoom out button | Same as zoomIn -- not found in direct grep of server HTML. | UNTESTED |
| `sidebarToggle: #sidebarToggle` | Sidebar toggle button | Not found in server HTML. The current viewer version uses `#viewsManagerToggleButton` instead. The viewer has been restructured with a "Views Manager" pattern replacing the old sidebar toggle. | NO MATCH (renamed) |
| `loadingIndicator: .loadingIcon, .loading` | Loading state indicator | Not directly found in server HTML. pdf.js uses `#loadingBar` for the loading progress bar (confirmed in viewer HTML: `div#loadingBar` exists in the DOM structure). | PARTIAL MATCH (loadingBar exists, loadingIcon not found) |
| `loadingBar: #loadingBar` | Loading progress bar | Present in viewer HTML structure. The loading bar is shown during PDF download/rendering. | MATCH (structural) |
| `pageCanvas: .page canvas` | Canvas element per page | 0 matches. Canvas elements are created by pdf.js JavaScript when rendering each page. No canvas in server HTML. | NO MATCH (client-rendered) |

**Summary:** 6 of 16 selectors from the pdf-viewer.js site guide match elements in the pdf.js viewer server HTML (viewerContainer, viewer, pageInput, totalPages, nextPage, previousPage). The loadingBar partially matches. All page content selectors (page, pageByNumber, textLayer, textLayerSpans, pageCanvas) return 0 matches because pdf.js renders all page content client-side via JavaScript. The sidebarToggle selector (#sidebarToggle) appears to be outdated -- the current viewer version uses #viewsManagerToggleButton. Toolbar selectors (#pageNumber, #previous, #next, #numPages) are server-rendered and match correctly, making them reliable targets for page navigation automation.

## New Tools Added This Phase
| Tool Name | File | Purpose | Parameters |
|-----------|------|---------|------------|
| readPdfAndFillForm workflow | site-guides/productivity/pdf-viewer.js | 22-step cross-site workflow for reading specific pages from a PDF viewer and filling a web form with extracted text. Steps cover: navigate to pdf.js viewer, verify load, check page count, extract pages 4/17/42 via page input navigation, verify extractions, navigate to form, identify fields, fill fields with stored text, verify filled fields. | (workflow in site guide, not an MCP tool) |
| CROSS-SITE PDF-TO-FORM guidance | site-guides/productivity/pdf-viewer.js | Guidance section for CONTEXT-03 covering cross-site context retention strategy, target selection (PDF viewer and form options), and context management rules for 50-page documents. | (guidance in site guide, not an MCP tool) |
| Context bloat warning | site-guides/productivity/pdf-viewer.js | Warning added to pdf-viewer.js warnings array: "For CONTEXT-03 (50-page PDF form fill): read ONLY pages 4, 17, and 42 -- do NOT read all 50 pages. Store first 300 characters per page." | (warning text, not an MCP tool) |

**Note:** No new MCP tools were added in Phase 79. The PDF-to-form workflow relies on existing MCP tools: `navigate` (url), `read_page` (no params), `get_dom_snapshot` (maxElements), `click` (selector), `type_text` (text), `press_key` (key), `wait_for_stable` (no params). The key additions are the readPdfAndFillForm workflow (22 steps) and the CONTEXT-03 guidance section in pdf-viewer.js. The persistent WebSocket bridge fix remains the primary tool gap blocking all live MCP testing since Phase 55. For CONTEXT-03 specifically, a combined `set_field_value(selector, text)` tool and a `get_concatenated_text(selector)` tool would simplify the PDF text extraction and form filling steps.

---
*Phase: 79-50-page-pdf-form-fill*
*Diagnostic generated: 2026-03-22*
