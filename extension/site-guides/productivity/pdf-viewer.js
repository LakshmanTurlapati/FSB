/**
 * Site Guide: PDF Viewer (Virtualized)
 * Per-site guide for pdf.js-based virtualized PDF viewers with scroll-and-read
 * workflows, page virtualization detection, and text extraction patterns.
 *
 * This guide targets pdf.js-based document viewers where pages are virtualized
 * (canvas content is cleared when pages scroll far out of the viewport, then
 * re-rendered when scrolled back into view). The primary test target is the
 * official pdf.js demo viewer at https://mozilla.github.io/pdf.js/web/viewer.html
 * which serves a 14-page sample document. Google Drive PDF viewer is a secondary
 * target with a different rendering approach (img elements instead of canvas+textLayer).
 *
 * IMPORTANT: This is a SEPARATE guide from pdf-editor.js (Phase 55, CANVAS-09),
 * which handles Smallpdf/Sejda signature placement on online PDF editors. The
 * pdf-viewer.js guide targets read-only or viewer-mode PDF rendering where the
 * goal is to navigate pages, extract text, and handle page virtualization --
 * not to place annotations or signatures.
 *
 * Created for Phase 71, SCROLL-05 requirement: reading a multi-page document
 * in a virtualized viewer where pages unload as you scroll.
 * Selectors based on pdf.js open-source viewer DOM structure.
 * To be validated during live MCP test (Plan 02).
 */

registerSiteGuide({
  site: 'PDF Viewer (Virtualized)',
  category: 'Productivity',
  patterns: [
    /mozilla\.github\.io\/pdf\.js\/web\/viewer\.html/i,
    /\/pdfjs\/web\/viewer\.html/i,
    /viewer\.html\?file=/i,
    /\/pdf\.js\/.*viewer/i,
    /documentcloud\.org/i,
    /drive\.google\.com\/.*\/preview/i,
    /docs\.google\.com\/.*viewer/i,
    /arxiv\.org\/pdf\//i,
    /blob:.*pdf/i
  ],
  guidance: `AUTOPILOT STRATEGY HINTS (from v0.9.7 diagnostic SCROLL-05):
- [scroll] Navigate pages via input#pageNumber (click, Ctrl+A, type N, Enter)
- [scroll] Extract text from .page[data-page-number="N"] .textLayer span elements
- [scroll] Detect virtualization via data-loaded attribute on .page div
- [scroll] Wait 500-1000ms after page navigation for textLayer to populate
- [scroll] Store text as you visit each page -- virtualized pages lose content

VIRTUALIZED PDF VIEWER INTELLIGENCE:

PDF.JS VIEWER ARCHITECTURE:
- pdf.js is the standard open-source PDF renderer used by Firefox, many web PDF viewers, and embedded document viewers
- Primary test target: https://mozilla.github.io/pdf.js/web/viewer.html (official demo viewer with sample PDF)
- Each PDF page is rendered as a div.page element containing: (a) a canvas element for visual rendering, (b) a div.textLayer containing span elements for each text run
- The textLayer is the key to text extraction -- each span contains a portion of text from the PDF page
- VIRTUALIZATION: pdf.js clears canvas content for pages that scroll far out of the viewport to save memory
- When a page is virtualized (unloaded): the canvas is blank/cleared but the div.page container and textLayer may still exist in DOM
- When you scroll a virtualized page back into viewport: pdf.js re-renders the canvas and repopulates the textLayer
- Page re-rendering takes 200-500ms depending on page complexity
- The viewer container is div#viewer inside div#viewerContainer -- this is the scrollable area

DETECTING LOADED VS UNLOADED PAGES:
- Loaded page indicators: canvas has non-zero width/height AND textLayer contains span children
- Unloaded page indicators: canvas is blank/empty, textLayer has no children or children have empty textContent
- The div.page element always exists in DOM (even when virtualized) with data-page-number attribute
- Check div.page[data-page-number="N"] for the page container, then check its textLayer children
- Class indicator: pages may have class "loading" during render, which is removed when complete
- Alternative check: if a page's canvas has a width attribute matching the expected page width, it is likely rendered

TEXT EXTRACTION FROM TEXTLAYER:
- Each rendered page has div.textLayer containing span elements
- Each span represents a line or text fragment from the PDF
- To read a page's text: querySelectorAll('.page[data-page-number="N"] .textLayer span') and concatenate textContent
- Text order follows DOM order (top-to-bottom, left-to-right for LTR documents)
- Spans have inline styles for positioning (left, top, font-size, transform) but textContent is plain text
- Some spans may be empty (whitespace) or contain special characters
- For full page text: join all span.textContent with spaces, trim whitespace
- IMPORTANT: textLayer only has content when the page is rendered -- if page is unloaded, textLayer spans are empty or absent

PAGE NAVIGATION IN PDF.JS VIEWER:
- The viewer has a toolbar at the top with page number input, previous/next buttons, and zoom controls
- Page number input: input#pageNumber -- type a page number and press Enter to jump to that page
- Previous page: button#previous
- Next page: button#next
- Total pages display: span#numPages shows total page count (e.g., "of 14")
- Scrolling: the viewer container (div#viewerContainer) scrolls vertically, pages are stacked
- Each page is approximately one viewport height (depends on zoom level)
- To scroll to page N: either (a) type N in the page number input, or (b) scroll down N-1 pages worth of height
- Using the page input is MORE RELIABLE than scroll-distance estimation

READING ACROSS VIRTUALIZED PAGES:
- Challenge: when reading pages 1-10 sequentially, earlier pages may be virtualized (unloaded) by the time you reach page 10
- Strategy: read each page's text as you scroll to it, store the extracted text, then move to the next page
- To verify text was captured: check that the extracted text is non-empty and contains readable words
- If you need to re-read a previously visited page: scroll back to it and wait 200-500ms for re-render
- The page number input (input#pageNumber) is the fastest way to jump to a specific page for re-reading
- After jumping to a page: wait for the textLayer to populate (waitForDOMStable or check for span children)
- Max pages to attempt reading in one session: 10-15 (beyond this, context becomes very large)

VIEWER TOOLBAR CONTROLS:
- Zoom in: button#zoomIn
- Zoom out: button#zoomOut
- Zoom select: select#scaleSelect (values: auto, page-actual, page-width, page-fit, or percentage)
- Sidebar toggle: button#sidebarToggle (opens thumbnail sidebar)
- Thumbnail sidebar: div#thumbnailView with thumbnail page images
- Document properties: accessed via secondary toolbar
- Page rotation: button#pageRotateCw, button#pageRotateCcw

SCROLL TIMING AND RENDERING:
- After scrolling to a new page: wait 300-500ms for canvas render + textLayer population
- After using page input to jump: wait 500-1000ms (may trigger larger re-render)
- Between page reads: 200-300ms is sufficient for DOM query
- If textLayer is empty after waiting: the page may still be rendering -- wait an additional 500ms and retry
- Maximum wait per page: 2000ms before classifying as unloaded/failed

COMMON OBSTACLES:
- Some pdf.js deployments customize the viewer UI (different button IDs, different layout)
- Google Drive PDF viewer uses a different rendering approach (img elements per page, not canvas+textLayer)
- arxiv.org PDFs may load slowly due to server-side rendering
- Some viewers have a loading overlay that must dismiss before interaction
- Very large PDFs (100+ pages) may take several seconds for initial load
- Zoom level affects page dimensions -- use the default or "page-fit" zoom for consistent sizing

VERIFICATION:
- After reading a page's text: verify the text is non-empty and contains recognizable words (not just whitespace)
- After scrolling back to a previously unloaded page: verify textLayer repopulates with the same content
- Cross-reference: text from page N should differ from page N+1 (different content)
- The pdf.js sample document has 14 pages with distinct content on each page -- good for verification

CROSS-SITE PDF-TO-FORM WORKFLOW (CONTEXT-03):
- This workflow reads specific pages from a long PDF, extracts key data, then navigates to a separate web form and fills it with the extracted data
- The challenge is CROSS-SITE CONTEXT RETENTION: data extracted from the PDF viewer must be remembered across a full site navigation to the form page
- Strategy: extract and store compact text from target pages BEFORE navigating away from the PDF viewer
- Do NOT read all 50 pages -- only jump to pages 4, 17, and 42 using the page number input (#pageNumber)
- For each target page: navigate via page input, wait for textLayer to render, extract and store the first 300 characters of page text
- After extracting all 3 pages: navigate to the web form URL in the SAME tab (the PDF viewer page will be replaced)
- On the form page: identify form fields by label text or input name/id attributes, clear each field before typing, then type the stored extracted text
- Form field identification: look for label[for="fieldId"] associations, input[name], input[placeholder], or aria-label attributes
- Clear field before typing: click on the input to focus, Ctrl+A to select all existing text, then type_text to replace
- After filling all fields: optionally click a submit button if present, or leave the form filled for verification
- Context bloat mitigation: store only page text excerpts (not full DOM snapshots), navigate directly to target pages (skip pages 1-3, 5-16, 18-41, 43-50)

TARGET SELECTION (CLAUDE'S DISCRETION):
- PDF target: any publicly accessible PDF with 50+ pages loaded in a pdf.js viewer. Options:
  (a) Upload a test PDF to the pdf.js demo viewer: https://mozilla.github.io/pdf.js/web/viewer.html?file=URL
  (b) Use an existing long PDF already hosted online (e.g., a public government report, academic paper)
  (c) Any pdf.js-based viewer with a long document already loaded
- The pdf.js demo viewer only loads its 14-page sample by default -- for a 50-page test, a URL parameter or alternative viewer is needed
- Form target: any publicly accessible web form with at least 3 text input fields. Options:
  (a) httpbin.org/forms/post -- simple HTML form with multiple fields (no auth required)
  (b) Any contact form or test form on a public website
  (c) A form builder demo page (e.g., Google Forms in view mode, Typeform, JotForm demo)
- The form needs at least 3 distinct text input fields to receive data from the 3 PDF pages
- Prefer forms with visible labels for each field (easier for MCP to identify correct fields)

CONTEXT MANAGEMENT FOR 50-PAGE DOCUMENTS:
- A 50-page PDF can generate 500KB+ of text if all pages are read -- this WILL exhaust context
- Critical rule: read ONLY the 3 target pages (4, 17, 42), not the entire document
- Per-page text budget: store first 300 characters of extracted text (enough for form filling, prevents context bloat)
- Page jump sequence: 4 -> 17 -> 42 (forward order minimizes scroll distance and virtualization churn)
- Between page jumps: the PDF viewer may virtualize previously loaded pages -- this is expected and acceptable since we stored the text already
- After extracting all 3 pages of text: the stored text is compact (~900 characters total) and survives site navigation
- On the form page: type stored text directly, no need to re-read the PDF`,
  selectors: {
    // Viewer container
    viewerContainer: '#viewerContainer, .pdfViewer, [role="document"]',
    viewer: '#viewer, .pdfViewer',

    // Individual pages
    page: '.page, [data-page-number]',
    pageByNumber: '.page[data-page-number="{N}"]',  // template -- replace {N} with page number
    pageCanvas: '.page canvas, .page .canvasWrapper canvas',
    textLayer: '.page .textLayer, .page [class*="textLayer"]',
    textLayerSpans: '.page .textLayer span, .page .textLayer div',

    // Toolbar navigation
    pageInput: '#pageNumber, input[type="number"][aria-label*="Page" i], .page-input',
    previousPage: '#previous, button[aria-label="Previous Page"], .previousPage',
    nextPage: '#next, button[aria-label="Next Page"], .nextPage',
    totalPages: '#numPages, .pagesCount, span[class*="numPages"]',

    // Zoom controls
    zoomIn: '#zoomIn, button[aria-label="Zoom In"], .zoomIn',
    zoomOut: '#zoomOut, button[aria-label="Zoom Out"], .zoomOut',
    zoomSelect: '#scaleSelect, select[aria-label*="Zoom" i], .scaleSelect',

    // Sidebar
    sidebarToggle: '#sidebarToggle, button[aria-label*="sidebar" i]',
    thumbnailView: '#thumbnailView, .thumbnailView',

    // Loading indicators
    loadingIndicator: '.loadingIcon, .loading, [class*="loading"]',
    loadingBar: '#loadingBar, .progress, [role="progressbar"]',

    // Google Drive PDF viewer (different structure)
    gdrivePageImg: '.drive-viewer-paginated-page img, .ndfHFb-c4YZDc img',
    gdrivePageContainer: '.drive-viewer-paginated-page, .ndfHFb-c4YZDc',

    // Generic PDF viewer patterns
    genericPageContainer: '[class*="pdf-page"], [class*="page-container"], [data-page]',
    genericTextContent: '[class*="text-layer"], [class*="textContent"]'
  },
  workflows: {
    loadPdfViewer: [
      'Navigate to https://mozilla.github.io/pdf.js/web/viewer.html via navigate tool',
      'Wait for page to load via wait_for_stable',
      'Dismiss any cookie/consent overlay if present',
      'Verify the PDF loaded by checking for page elements in DOM (div.page with data-page-number)',
      'Use read_page to confirm the viewer toolbar and first page are visible',
      'Check total page count from the numPages element',
      'Verify textLayer has content on page 1 (span elements with text)'
    ],
    readVirtualizedDocument: [
      'Navigate to the pdf.js demo viewer or target PDF viewer URL',
      'Wait for initial load -- verify page 1 textLayer has span children with text content',
      'Read page 1 text: extract all span.textContent from .page[data-page-number="1"] .textLayer',
      'Store page 1 text (first 200 characters as sample for verification)',
      'Navigate to page 2: type "2" in pageNumber input and press Enter, OR scroll down one page height',
      'Wait 300-500ms for page 2 to render (canvas + textLayer population)',
      'Read page 2 text: extract spans from .page[data-page-number="2"] .textLayer',
      'Store page 2 text sample -- verify it differs from page 1 (different content)',
      'Continue to pages 3-5: repeat navigate + wait + read + store for each page',
      'After reaching page 5: scroll back to page 1 using pageNumber input (type "1", press Enter)',
      'Wait 500-1000ms for page 1 to re-render (it was likely virtualized/unloaded)',
      'Re-read page 1 text: extract textLayer spans again',
      'Verify: re-read text matches the originally stored page 1 text (page re-rendered correctly)',
      'Verification complete: virtualized document reading confirmed -- pages unload and reload with consistent text'
    ],
    extractPageText: [
      'Ensure target page is currently rendered (scroll to it or use page input)',
      'Wait 300-500ms for textLayer to populate',
      'Use get_dom_snapshot to find all spans inside .page[data-page-number="N"] .textLayer',
      'Concatenate all span textContent values with spaces',
      'Trim whitespace and verify non-empty result',
      'If textLayer is empty: wait 500ms more and retry once',
      'If still empty after retry: page failed to render -- document as unloaded'
    ],
    verifyPageVirtualization: [
      'Read text from page 1 and store it',
      'Scroll forward to page 5 or later (far enough that page 1 should be virtualized)',
      'Use get_dom_snapshot to check page 1 textLayer: if spans are empty or absent, page is virtualized',
      'Scroll back to page 1 using page input',
      'Wait for re-render and read text again',
      'Compare: re-read text should match original stored text'
    ],
    readPdfAndFillForm: [
      'Navigate to a pdf.js viewer URL containing a long PDF document (50+ pages) using navigate tool',
      'Wait for initial load via wait_for_stable -- verify page elements exist and textLayer has content on page 1',
      'Check total page count from numPages element -- confirm document has 50+ pages (or at least enough to include pages 4, 17, 42)',
      'EXTRACT PAGE 4: Type "4" in the page number input (#pageNumber) and press Enter to jump to page 4',
      'Wait 500-1000ms for page 4 to render (canvas + textLayer population) -- use wait_for_stable or fixed delay',
      'Read page 4 text: extract all span.textContent from .page[data-page-number="4"] .textLayer and concatenate. Store first 300 characters as page4Text',
      'EXTRACT PAGE 17: Type "17" in the page number input and press Enter to jump to page 17',
      'Wait 500-1000ms for page 17 to render',
      'Read page 17 text: extract spans from .page[data-page-number="17"] .textLayer. Store first 300 characters as page17Text',
      'EXTRACT PAGE 42: Type "42" in the page number input and press Enter to jump to page 42',
      'Wait 500-1000ms for page 42 to render',
      'Read page 42 text: extract spans from .page[data-page-number="42"] .textLayer. Store first 300 characters as page42Text',
      'VERIFY EXTRACTION: Confirm all 3 text excerpts are non-empty and contain readable words (not just whitespace)',
      'NAVIGATE TO FORM: Use navigate tool to go to a web form URL (e.g., httpbin.org/forms/post or any form with 3+ text inputs). This replaces the PDF viewer page.',
      'Wait for form page to load via wait_for_stable',
      'IDENTIFY FORM FIELDS: Use get_dom_snapshot or read_page to find text input fields (input[type="text"], textarea, or input without type). Map fields to page data: field 1 = page4Text, field 2 = page17Text, field 3 = page42Text',
      'FILL FIELD 1: Click on the first text input to focus, use Ctrl+A to select any existing text, then type_text with page4Text content',
      'FILL FIELD 2: Click on the second text input to focus, Ctrl+A to select, type_text with page17Text content',
      'FILL FIELD 3: Click on the third text input to focus, Ctrl+A to select, type_text with page42Text content',
      'VERIFY FORM FILLED: Use read_page or get_dom_snapshot to confirm all 3 fields contain the typed text from their respective PDF pages',
      'Optionally click submit button if present, or leave form filled for human verification',
      'Record outcomes: pages extracted (4/17/42), text non-empty (yes/no per page), form fields filled (yes/no per field), cross-site context retained (yes/no)'
    ]
  },
  warnings: [
    'pdf.js virtualizes pages by clearing canvas content when scrolled far out of viewport -- textLayer spans may also be empty for unloaded pages',
    'Always wait 300-500ms after scrolling to a new page before reading textLayer -- the page needs time to re-render',
    'Use the page number input (#pageNumber) for reliable page navigation instead of estimating scroll distances',
    'Google Drive PDF viewer uses img elements instead of canvas+textLayer -- different text extraction approach needed',
    'The pdf.js sample document (14 pages) is ideal for testing -- it has distinct text content on each page',
    'Very large PDFs may take several seconds per page render -- increase wait times for 100+ page documents',
    'textLayer text order follows DOM order which matches reading order for most Western documents -- may not work for complex multi-column layouts',
    'If reading across many pages, extract and store text as you go -- do not rely on being able to read all pages at the end since earlier pages will be virtualized',
    'For CONTEXT-03 (50-page PDF form fill): read ONLY pages 4, 17, and 42 -- do NOT read all 50 pages. Store first 300 characters per page. Total stored text should be under 1000 characters to avoid context bloat during cross-site navigation.'
  ],
  toolPreferences: [
    'Use read_page for initial page verification and DOM structure inspection',
    'Use get_dom_snapshot to inspect textLayer span content for text extraction',
    'Use scroll to navigate between pages in the viewer container',
    'Use click to interact with toolbar buttons (page input, zoom, sidebar)',
    'Use type_text to enter page numbers in the page input field',
    'Use press_key with key="Enter" after typing page number to trigger navigation',
    'Use wait_for_stable after page navigation to ensure textLayer is populated',
    'PREFER page number input navigation over scroll-distance estimation for jumping to specific pages'
  ]
});
