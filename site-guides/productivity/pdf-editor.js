/**
 * Site Guide: Online PDF Editor (Signature Placement)
 * Per-site guide for online PDF editors used for editing and signing PDFs.
 *
 * Most online PDF editors (Smallpdf, Sejda, DocHub, iLovePDF) render PDF
 * pages as images or canvas elements inside a scrollable container. The
 * editor toolbar floats above the page area and provides tools for text,
 * drawing, shapes, and signatures. Individual text or form fields within
 * the rendered PDF are NOT interactive DOM elements -- all interaction
 * (annotations, signatures, stamps) happens through the editor's overlay
 * system.
 *
 * Smallpdf.com is the primary target (free, no-auth for basic editing).
 * Fallback sites: Sejda.com, DocHub, iLovePDF, PDFBuddy, pdf.online.
 *
 * Created for Phase 55, CANVAS-09 diagnostic.
 * Selectors based on research of common online PDF editor DOM patterns.
 * To be validated during live MCP test (Plan 02).
 */

registerSiteGuide({
  site: 'Online PDF Editor',
  category: 'Productivity',
  patterns: [
    /smallpdf\.com\/(edit-pdf|sign-pdf)/i,
    /smallpdf\.com\/result/i,
    /sejda\.com\/(sign-pdf|edit-pdf)/i,
    /dochub\.com/i,
    /ilovepdf\.com\/(sign|edit)/i,
    /pdfbuddy\.com/i,
    /pdf\.online/i
  ],
  guidance: `ONLINE PDF EDITOR-SPECIFIC INTELLIGENCE:

PDF PAGE RENDERING:
- Online PDF editors render each page as an image (img element) or canvas element inside a scrollable container
- Pages are stacked vertically in the container with spacing/margins between them
- The editor toolbar floats above or beside the page area as a fixed/sticky overlay
- Page dimensions vary by PDF but typically fill the viewport width with side margins
- The actual PDF content area is NOT interactive HTML -- it is a rendered image or canvas
- Individual text fields, form inputs, or dotted lines within the PDF are not clickable DOM elements
- All interaction (placing signatures, annotations, stamps) happens via the editor overlay system
- After placing a signature, it appears as a movable overlay element on top of the rendered page
- Some editors (Smallpdf) use a div-based renderer; others (Sejda) use canvas per page

PAGE NAVIGATION:
- To reach page 3, scroll down through the rendered pages in the vertical scroll container
- Most editors render all pages in a single vertical scroll container
- Each page is typically 800-1200px tall depending on viewport size and zoom level
- To reach page 3, scroll approximately 2 full page-heights down from the top
- Use scroll_at to scroll down through the page container (deltaY of -400 to -800 per scroll event, multiple times)
- Some editors have a page number indicator (e.g., "Page 1 of 5") that can be clicked to jump to a specific page
- Some editors have a left sidebar with clickable page thumbnails for direct navigation
- Keyboard shortcuts: Page Down or arrow keys may scroll through pages
- CRITICAL: verify you are on page 3 by checking the page indicator or counting visible pages before placing the signature
- If a page indicator DOM element exists, prefer clicking it and typing the page number over scrolling -- more precise

SIGNATURE TOOL ACTIVATION:
- The signature/sign tool is typically in the editor toolbar at the top of the page
- On Smallpdf: look for a button labeled "Sign" or with a signature icon in the top toolbar area
- On Sejda: look for "Sign" button in the toolbar or sidebar
- On DocHub: look for "Sign" in the toolbar or floating action menu
- Clicking the Sign button opens a signature creation panel/dialog
- The signature creation panel offers options: Draw (freehand), Type (typed text as signature), Upload Image
- For simplest automation: use the "Type" option -- type a name, confirm, then click on the PDF page to place
- The "Draw" option requires mouse drag strokes on a signature pad which is more complex to automate
- After creating the signature, click a confirm/apply button to accept it
- The editor then enters placement mode: the next click on the PDF page places the signature at the click location

SIGNATURE PLACEMENT:
- After creating/selecting a signature in the Sign panel, the cursor enters placement mode
- Click on the PDF page at the desired location to place the signature
- The signature appears as a movable, resizable overlay at the click point
- For the CANVAS-09 test: place signature on page 3 at the approximate location of a dotted line
- Dotted signature lines are typically in the lower third of the page:
  - Y-position: approximately 70-80% of page height from the top of the page
  - X-position: approximately 25-50% of page width (left-center area)
- After placement, the signature overlay can usually be dragged to adjust position
- Some editors show a resize handle on the signature for scaling

COORDINATE CALCULATION:
- To place the signature on the dotted line on page 3:
  1. Scroll to page 3 (approximately 2 full page-heights down)
  2. Use get_dom_snapshot to identify the page 3 element and its bounds
  3. Calculate the signature line position as approximately:
     x = page_left + page_width * 0.35 (left-center horizontal position)
     y = page_top + page_height * 0.75 (lower third vertical position)
  4. Use click_at at those calculated coordinates
  5. Adjust based on actual page content visible in the DOM snapshot
- If page elements are not individually identifiable in DOM, estimate based on viewport:
  - Page 3 should be roughly centered vertically in viewport after scrolling
  - Target the lower-third area of the visible page

SAMPLE PDF:
- For testing, navigate to smallpdf.com/edit-pdf and use their sample document or upload dialog
- The test needs a multi-page PDF with at least 3 pages
- If no suitable sample is available: navigate to the editor URL, use whatever sample/demo the editor provides
- Some editors allow pasting a URL to a PDF hosted online
- Smallpdf typically shows a file upload area or drag-and-drop zone on the edit-pdf page

COMMON OBSTACLES:
- Cookie consent banners (GDPR) -- dismiss before interacting with the editor
- Upgrade/premium subscription modals -- close these to access free features
- File upload dialogs -- may need to select a sample document or click an upload button
- Tutorial/onboarding overlays -- dismiss by clicking close or pressing Escape
- Browser popup blockers if editor opens in a new tab
- Rate limiting on free tier -- some sites limit operations per day without an account
- PDF rendering delay -- pages may take 2-5 seconds to fully render after upload

VERIFICATION:
- After placing the signature, verify success by looking for:
  - A new DOM element representing the placed signature (div with class containing "signature", "annotation", "stamp", or similar)
  - The signature overlay element positioned within the page 3 area
  - Signature tool state change (from placement mode back to selection/pointer mode)
  - Use get_dom_snapshot to check for new elements that appeared after placement
  - The placed signature should be visible as a positioned absolute/relative div overlay on the page`,
  selectors: {
    // Editor toolbar
    toolbar: '.toolbar, [role="toolbar"], .editor-toolbar, .pdf-toolbar, .tools-bar',
    toolbarButtons: '.toolbar button, [role="toolbar"] button, .editor-toolbar button',

    // Signature/Sign tool button
    signButton: '[data-testid="sign"], button[aria-label*="sign" i], .sign-tool, .signature-btn, [title*="Sign" i], button[data-tool="signature"], .tool-sign',
    signButtonFallback: '.toolbar button:has(svg[class*="sign"]), .toolbar [class*="sign"], [data-action="sign"]',

    // Signature creation panel
    signaturePanel: '.signature-panel, .sign-dialog, .signature-modal, [data-testid="signature-panel"], .sign-popup, [class*="signature-modal"]',

    // Type signature option in panel
    typeSignOption: '.type-option, [data-tab="type"], [class*="type-tab"], .tab-type, [data-testid="type-signature"]',
    typeSignOptionFallback: 'button:has-text("Type"), [role="tab"]:has-text("Type"), .signature-panel button',

    // Signature text input
    signatureInput: 'input[placeholder*="name" i], input[placeholder*="signature" i], .signature-input, .signature-panel input[type="text"], [data-testid="signature-input"]',

    // Confirm/apply signature button
    signatureConfirm: '.apply-btn, .confirm-btn, [data-testid="apply-signature"], .signature-panel .primary-btn, .sign-dialog .submit',
    signatureConfirmFallback: 'button:has-text("Apply"), button:has-text("Done"), button:has-text("Insert"), button:has-text("Create"), button:has-text("Save")',

    // PDF page scroll container
    pageContainer: '.pdf-viewer, .page-container, .document-container, [role="document"], .viewer-container, .pages-container, [class*="pdf-viewer"]',

    // Individual page elements
    pageElement: '.page, [data-page-number], .pdf-page, [class*="page-"][class*="rendered"], canvas[data-page]',

    // Page number indicator
    pageIndicator: '.page-indicator, .page-number, [data-page], .page-count, .current-page, [class*="page-num"]',
    pageInput: 'input[type="number"][aria-label*="page" i], .page-input, .page-number input',

    // Page thumbnail sidebar
    pageThumbnails: '.thumbnails, .page-list, .sidebar-thumbnails, .thumbnail-sidebar, [class*="thumbnail"]',

    // Cookie/consent dismiss
    consentDismiss: '.cookie-accept, #accept-cookies, .consent-close, [data-testid="cookie-accept"], .gdpr-accept',
    consentDismissFallback: 'button:has-text("Accept"), button:has-text("Accept All"), button:has-text("Got it"), button:has-text("OK")',

    // Modal/overlay close
    modalClose: '.modal-close, .close-btn, .overlay-close, [aria-label="Close"], .dismiss-btn, [data-testid="close-modal"]',
    modalCloseFallback: 'button[class*="close"], .modal button:first-of-type, [role="dialog"] button[aria-label="Close"]',

    // Upgrade/premium modal
    upgradeModal: '.upgrade-modal, .premium-modal, .paywall, [class*="upgrade"], [class*="premium-prompt"]',
    upgradeClose: '.upgrade-modal .close, .premium-modal .close, [class*="upgrade"] [aria-label="Close"]',

    // Placed signature element (verification)
    placedSignature: '.signature-annotation, .placed-signature, .annotation[data-type="signature"], .stamp, [class*="signature"][class*="placed"], .annotation-signature',
    placedSignatureFallback: '.annotation, .overlay-element, [class*="stamp"], [class*="annotation"]'
  },
  workflows: {
    loadEditor: [
      'Navigate to https://smallpdf.com/edit-pdf via navigate tool',
      'Wait for page to load via wait_for_stable',
      'Dismiss cookie/consent overlay if present (click Accept button or consent dismiss selector)',
      'Dismiss any upgrade/premium modals if they appear (click close button)',
      'If a file upload prompt appears, either: (a) use the sample/demo document if available, (b) click the upload area and select a sample PDF, or (c) paste a URL to a multi-page PDF',
      'Wait for the editor interface to load (toolbar should become visible)',
      'Use get_dom_snapshot to verify toolbar and page container are present in the DOM',
      'Handle any tutorial/onboarding overlay by pressing Escape or clicking dismiss'
    ],
    navigateToPage3: [
      'Use get_dom_snapshot to identify the page container element and current page indicator',
      'Approach 1 (scroll): Use scroll_at on the page container to scroll down -- approximately 2 full viewport-height scrolls to pass pages 1 and 2. Use deltaY=-800 and repeat 2-3 times.',
      'Approach 2 (page indicator): If a page number input exists, click it and type "3" then press Enter to jump directly to page 3',
      'Approach 3 (thumbnails): If a sidebar with page thumbnails exists, click the 3rd thumbnail to navigate to page 3',
      'Approach 4 (keyboard): Use Page Down key presses (press_key with key="PageDown") to advance through pages',
      'After scrolling/navigating, verify page 3 is visible by checking the page indicator DOM element or counting page elements in the viewport',
      'Use get_dom_snapshot to confirm page 3 element is in or near the viewport'
    ],
    activateSignTool: [
      'Use get_dom_snapshot to locate the Sign/Signature button in the editor toolbar',
      'Click the Sign button using DOM click (toolbar buttons are standard HTML elements)',
      'Wait for signature panel/dialog to appear via wait_for_stable (panel animation may take 300-500ms)',
      'In the signature panel, select the "Type" tab/option (simpler than Draw for automation)',
      'Type a signature name (e.g., "John Doe") in the signature text input field using type_text',
      'Click the "Apply", "Done", or "Insert" button to confirm the typed signature',
      'The editor should now enter placement mode -- the cursor changes to indicate where the signature will be placed on next click'
    ],
    placeSignatureOnDottedLine: [
      'Ensure page 3 is currently visible in the viewport (from navigateToPage3 workflow)',
      'Use get_dom_snapshot to identify the page 3 element bounds (position, width, height)',
      'Calculate target coordinates for the dotted signature line: x = page_left + page_width * 0.35, y = page_top + page_height * 0.75 (lower third, left-center)',
      'If page bounds are not available from DOM, estimate: target the lower-third of the visible page area, horizontally centered-left',
      'Execute click_at at the calculated coordinates to place the signature',
      'Wait briefly for the signature overlay to render via wait_for_stable',
      'Verify a signature element appeared in the DOM using get_dom_snapshot (look for new annotation/signature/stamp elements)',
      'If placement did not register, retry click_at at slightly adjusted coordinates (shift y by +/- 20px)'
    ],
    fullSignatureWorkflow: [
      'Step 1 - Load Editor: Navigate to smallpdf.com/edit-pdf, dismiss popups, load/upload a multi-page PDF',
      'Step 2 - Navigate to Page 3: Scroll down or use page indicator to reach page 3, verify arrival',
      'Step 3 - Activate Sign Tool: Click Sign button in toolbar, select Type option, type name, confirm',
      'Step 4 - Place Signature: Click on page 3 at the dotted line area (lower third, left-center coordinates via click_at)',
      'Step 5 - Verify: Check DOM for new signature overlay element on page 3'
    ]
  },
  warnings: [
    'PDF pages are rendered as images or canvas -- individual text/form fields within the PDF are NOT clickable DOM elements. All interaction uses the editor overlay system.',
    'Cookie consent and upgrade modals are very common on free PDF editor sites -- always dismiss these before interacting with the editor.',
    'The signature Sign button location varies by editor -- Smallpdf has it in the top toolbar, Sejda in a sidebar, DocHub in a floating menu.',
    'After activating the signature tool, the editor enters placement mode -- the NEXT click on the PDF page places the signature. Do not click randomly or you will place it in the wrong location.',
    'Page navigation by scrolling requires knowing approximate page height -- each page is typically 800-1200px tall depending on viewport and zoom level.',
    'Some editors require file upload before the editor UI appears -- may need to click a sample document link or upload button first.',
    'The Type signature option is simplest for automation -- Draw requires mouse drag strokes via CDP drag which is more complex to execute reliably.',
    'Verify page 3 is visible before placing the signature -- incorrect scroll distance leads to placing on the wrong page.',
    'Free-tier PDF editors may show rate-limit or premium-upgrade prompts after a few operations -- dismiss these to continue.',
    'PDF rendering can take 2-5 seconds after upload -- wait for the page container to stabilize before interacting with tools.'
  ],
  toolPreferences: [
    'PREFER click_at for placing signatures on PDF pages -- the page content is rendered as image/canvas, not interactive DOM',
    'Use DOM click for toolbar buttons (Sign, Text, Shape) -- these ARE standard HTML elements with click handlers',
    'Use scroll_at to navigate between pages in the vertical scroll container',
    'Use type_text for entering signature name text in the Type signature input field',
    'Use get_dom_snapshot to identify toolbar button positions and page element bounds for coordinate calculation',
    'Use wait_for_stable after clicking Sign tool -- signature panel animation may take 300-500ms to appear',
    'If page indicator DOM element exists, prefer clicking it and typing page number over scrolling -- more precise page navigation',
    'Use press_key with PageDown for keyboard-based page navigation as a fallback approach'
  ]
});
