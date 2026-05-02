/**
 * Site Guide: Anti-Scrape Text Extraction
 * Per-site guide for extracting text content from sites that block right-clicks,
 * disable text selection, obfuscate CSS class names, and use other anti-scrape
 * protections to prevent users from copying or scraping text content.
 *
 * Key challenge: Anti-scrape sites use multiple layers of JavaScript event handlers
 * (oncontextmenu, onselectstart, oncopy returning false) and CSS rules
 * (user-select:none, -webkit-user-select:none) to prevent human users from
 * right-clicking, selecting, and copying text. Additionally, CSS class names may
 * be obfuscated (hashed, randomized, or minified by CSS-in-JS libraries like
 * styled-components, Emotion, CSS Modules) to frustrate CSS selector-based
 * automated scraping. Some sites also place transparent overlay divs over content
 * to intercept all mouse events. However, ALL of these protections operate at the
 * browser UI interaction layer only. The DOM tree itself still contains the full
 * text content in element textContent and innerText properties, and content scripts
 * running in the page context can read DOM elements regardless of CSS user-select
 * rules, JavaScript event handler blocks, or class name obfuscation. The MCP tools
 * (get_dom_snapshot, read_page, get_text) access the DOM programmatically,
 * completely bypassing these UI-layer restrictions.
 *
 * This is a "Visual Ambiguity & Dark Patterns" edge case (DARK-10) -- the site
 * uses JavaScript and CSS protections to prevent text access through normal browser
 * UI interactions. DOM-level text extraction bypasses all such protections.
 *
 * Created for Phase 96, DARK-10 edge case validation.
 * Target: extract text from a site that blocks right-clicks, disables text
 * selection, and masks CSS class names.
 */

registerSiteGuide({
  site: 'Anti-Scrape Text Extraction',
  category: 'Utilities',
  patterns: [
    /anti.?scrape/i,
    /no.?select/i,
    /user-select.*none/i,
    /right.?click.*disabled/i,
    /copy.*protect/i,
    /text.*protect/i,
    /scrape.*block/i,
    /content.*protect/i,
    /medium\.com/i,
    /bloomberg\.com/i,
    /genius\.com/i,
    /wsj\.com/i,
    /nytimes\.com/i
  ],

  guidance: `AUTOPILOT STRATEGY HINTS (from v0.9.7 diagnostic DARK-10):
- [dark] Use get_dom_snapshot/read_page directly -- these bypass ALL JS/CSS anti-scrape protections
- [dark] When class names are obfuscated, use structural selectors: data-*, aria-*, tag names, schema.org
- [dark] Do NOT try to disable protections first -- direct DOM text extraction is simpler and more reliable
- [dark] If text appears empty, check for: client-rendered content, CSS ::before/::after, iframe isolation
- [dark] Only image-based text (canvas/SVG/img pixels) defeats DOM extraction -- document as limitation

ANTI-SCRAPE TEXT EXTRACTION INTELLIGENCE (DARK-10):

DARK PATTERN CONTEXT (DARK-10):
Sites use multiple layers of JavaScript event handlers (oncontextmenu returning false,
onselectstart returning false, oncopy returning false) and CSS rules (user-select:none,
-webkit-user-select:none) to prevent human users from right-clicking, selecting, and
copying text content. Additionally, CSS class names may be obfuscated -- hashed,
randomized, or minified by CSS-in-JS libraries (styled-components, Emotion, CSS Modules)
-- to frustrate automated CSS selector-based scraping. Some sites also add transparent
overlay divs with high z-index positioned over the content area to intercept all mouse
events (clicks, text selection, right-click context menu).

These protections ONLY affect the browser UI interaction layer. The AI operates through
content scripts that access the DOM tree programmatically -- element.textContent,
element.innerText, and DOM traversal APIs work regardless of CSS user-select rules,
JavaScript event handler blocks, or class name obfuscation. The text content exists in
the DOM; the protections only prevent the human-UI path to accessing it.

Key insight: get_dom_snapshot, read_page, and get_text bypass ALL JavaScript/CSS
anti-scrape protections because they read DOM properties directly, not through UI events.
The oncontextmenu, onselectstart, and oncopy event handlers only fire when a human user
interacts through the browser UI (right-click, mouse-drag selection, Ctrl+C). Content
script DOM access does not trigger any of these event handlers.

PROTECTION DETECTION:
Before extracting text, identify which anti-scrape protections the page uses. This helps
select the optimal extraction strategy and understand potential edge cases.

(A) RIGHT-CLICK BLOCK -- Check for oncontextmenu on body/document or contextmenu event
    listeners. The page may have <body oncontextmenu="return false"> or use
    document.addEventListener('contextmenu', e => e.preventDefault()). This prevents the
    browser context menu from appearing when right-clicking.
    DETECTION: Look for oncontextmenu attribute on body/html elements in DOM snapshot.
    BYPASS: Irrelevant to MCP -- get_dom_snapshot and read_page never use the context menu.

(B) SELECTION BLOCK -- Check for CSS user-select:none on body or content elements, and
    onselectstart handlers. The page may apply CSS user-select: none or
    -webkit-user-select: none to body or content containers, and/or add
    onselectstart="return false" or document.addEventListener('selectstart',
    e => e.preventDefault()). This prevents mouse-drag text selection.
    DETECTION: Look for style attributes containing user-select:none, or onselectstart
    attributes on body/html/content elements.
    BYPASS: Irrelevant to MCP -- get_text reads element.textContent which is completely
    unaffected by CSS user-select rules. read_page extracts innerText regardless of
    selection restrictions.

(C) COPY BLOCK -- Check for oncopy handlers. The page may add oncopy="return false" or
    document.addEventListener('copy', e => e.preventDefault()). This prevents Ctrl+C from
    copying selected text to the clipboard.
    DETECTION: Look for oncopy attribute on body/html elements.
    BYPASS: Irrelevant to MCP -- text extraction via DOM properties (textContent, innerText)
    does not trigger the copy event. No clipboard interaction is needed.

(D) CSS CLASS NAME OBFUSCATION -- Check for hashed, randomized, or minified class names.
    Sites using CSS-in-JS (styled-components, Emotion, CSS Modules) or deliberate
    obfuscation generate class names like _a3f2b, css-1x92kp, sc-bwzfXH, styles__content--
    3kJ2m. These class names are unstable (change between builds/deployments) and cannot
    be used for reliable CSS selectors.
    DETECTION: Look for short alphanumeric class names, underscore-prefixed classes,
    css-* prefixed classes, or hash-like strings in class attributes.
    BYPASS: Use structural selectors instead of class names -- tag names (article, p, h1),
    data-* attributes (data-testid, data-component), aria-* attributes (aria-label, role),
    semantic HTML (main, article, section), or positional selectors (nth-child).

(E) TRANSPARENT OVERLAY DIV -- Check for transparent positioned divs with high z-index
    placed over the content area. The overlay div intercepts all mouse events (clicks,
    selections, right-click), preventing any direct interaction with the text underneath.
    The actual text content is behind this transparent overlay.
    DETECTION: Look for div elements with position:absolute or position:fixed, high
    z-index (999+), and no visible text content covering the content area.
    BYPASS: get_dom_snapshot reads ALL elements including those behind overlays. The overlay
    div typically has no text content; the real content elements underneath contain the text.
    Use get_text on content elements directly, ignoring the overlay. If the overlay prevents
    execute_js interaction, remove it: execute_js to set overlay element.style.display='none'.

(F) CSS CONTENT PROPERTY TEXT -- Check for empty elements that display visible text via
    CSS content property in ::before/::after pseudo-elements. The text appears visually
    on the page but is NOT present in element.textContent or element.innerText because it
    exists only in the CSS pseudo-element, not in DOM text nodes.
    DETECTION: Look for elements that appear to contain text visually but have empty
    textContent. This is rare but used by some anti-scrape implementations.
    BYPASS: Use execute_js to run window.getComputedStyle(element, '::before').content and
    window.getComputedStyle(element, '::after').content to extract pseudo-element text.

(G) JAVASCRIPT-RENDERED TEXT -- Text loaded dynamically via JavaScript (AJAX, fetch,
    WebSocket) rather than included in server HTML. Combined with obfuscated class names,
    this makes HTTP-based scraping nearly impossible.
    DETECTION: Page HTML source contains minimal text; text appears after JavaScript
    execution.
    BYPASS: Content script runs AFTER JavaScript execution, so get_dom_snapshot and
    read_page see the fully rendered DOM including all dynamically loaded text.

(H) IMAGE-BASED TEXT -- Text rendered as images, canvas, or SVG instead of DOM text nodes.
    DETECTION: Visible text on page but no corresponding text in DOM elements. Content may
    be inside <canvas>, <svg>, or <img> elements.
    BYPASS: NOT bypassed by DOM text extraction tools. This requires vision/OCR capabilities
    which MCP does not have. Document as a known limitation if encountered.

BYPASS STRATEGIES:

Strategy A -- PRIMARY: DOM TEXT EXTRACTION
Use get_dom_snapshot to see the full DOM tree including all text nodes. The snapshot
returns element types, attributes, and text content regardless of any CSS or JavaScript
protections. Use read_page to extract the complete page text content -- this reads
element.innerText which is unaffected by user-select:none CSS rules, oncontextmenu
handlers, oncopy handlers, or onselectstart handlers. Use get_text on specific elements
identified by tag name, data attributes, aria attributes, or structural selectors to
extract targeted text content.

Strategy B -- STRUCTURAL SELECTORS (for obfuscated class names)
When CSS class names are obfuscated (hashed, randomized, minified), do NOT attempt to use
class-based CSS selectors. Instead use:
  - Tag names: article, p, h1, h2, h3, h4, h5, h6, blockquote, li, pre, code
  - data-* attributes: data-testid, data-component, data-lyrics-container, data-content
  - aria-* attributes: aria-label, role="article", role="main"
  - Semantic HTML: main, article, section, header, footer, aside, nav
  - Structural position: article > section > p, main p, article p, .content p
  - Schema.org attributes: [itemtype*="Article"], [itemtype*="Recipe"], [itemprop]
  - Text content matching: identify elements by their visible text content

Strategy C -- EXECUTE_JS FALLBACK (for edge cases)
For CSS ::before/::after pseudo-element text that is not in DOM text nodes, use execute_js
to extract the computed content:
  window.getComputedStyle(element, '::before').content
  window.getComputedStyle(element, '::after').content

For transparent overlay div removal when needed for interaction:
  execute_js to set overlay element.style.display = 'none'

For extracting text from deeply nested or shadow DOM structures:
  execute_js to traverse and collect text from specific DOM subtrees

SITE-SPECIFIC PATTERNS:

1. Medium.com (metered paywall + selection restriction):
   - Protections: user-select restrictions on metered content, CSS Module class hashes
     (e.g., pw-post-body-paragraph), copy event interception
   - Content location: <article> elements with <section> children, text in <p>, <h1>-<h4>,
     <blockquote> tags
   - Extraction selectors: article, section > p, .meteredContent,
     [data-selectable-paragraph], article p, article h1, article h2, article blockquote
   - Strategy: get_dom_snapshot to find article container, get_text on paragraphs

2. Bloomberg.com (premium content protection):
   - Protections: JS-based copy/selection prevention on premium articles, styled-components
     obfuscated class names, client-side hydration loading
   - Content location: <article> or [data-component="article-body"], paragraphs with
     obfuscated class names from styled-components
   - Extraction selectors: article, [data-component="article-body"], .body-content p,
     article p, [role="article"]
   - Strategy: read_page for full text, structural selectors for targeted extraction

3. Genius.com / lyrics sites (right-click + selection block):
   - Protections: oncontextmenu disabled (right-click blocked), user-select:none on lyrics
     containers, oncopy prevention
   - Content location: [data-lyrics-container] for lyrics content, text in span elements
     with React data attributes ([data-reactid] or similar)
   - Extraction selectors: [data-lyrics-container], .lyrics,
     .Lyrics__Container-sc-*, [data-lyrics-container] span
   - Strategy: get_text on [data-lyrics-container], ignore user-select CSS entirely

4. Recipe/content sites (e.g., Allrecipes, Food Network):
   - Protections: transparent overlay divs over content (ad protection), selection
     interference from ad containers, aggressive ad injection around content
   - Content location: structured article elements, recipe body, ingredients sections,
     schema.org structured data
   - Extraction selectors: [itemtype*="Recipe"], .recipe-body, .ingredients-section,
     .ingredients-item, [itemprop="recipeIngredient"], [itemprop="recipeInstructions"]
   - Strategy: get_dom_snapshot to identify content vs ad containers, get_text on recipe
     elements by schema.org attributes

5. News paywalls (WSJ, NYT behind paywall):
   - Protections: styled-components class obfuscation, selection restriction, content
     truncation with later paragraphs hidden (display:none), oncopy handlers
   - Content location: article containers, may have full text in DOM but hidden by CSS
   - Extraction selectors: article, [data-testid="article-body"], .article-body p,
     article p, [role="article"] p
   - Strategy: get_dom_snapshot sees ALL elements including display:none -- extract text
     from hidden paragraphs too. CSS display:none does not affect textContent.

6. Academic paper sites (ResearchGate, Academia.edu):
   - Protections: text selection disabled on paper abstracts and content to force PDF
     downloads, obfuscated class names, login walls for full text
   - Content location: article-like containers with obfuscated class names
   - Extraction selectors: .research-detail__content, .Abstract,
     [itemprop="description"], article, .publication-abstract, [data-testid*="abstract"]
   - Strategy: get_text on abstract/content containers, read_page for full visible text

VERIFICATION:
After extracting text, verify the extraction was successful:
(a) Extracted content is not empty -- if empty, recheck content container selectors
(b) Content contains expected text -- article headline, paragraph body text, not just
    boilerplate navigation or footer text
(c) Content length is reasonable for the page type -- an article should have 500+ chars,
    lyrics 200+ chars, recipe ingredients 100+ chars
(d) No "subscribe" or "paywall" truncation indicators -- if content ends with "Subscribe
    to continue reading" or similar, the full content may not be accessible
(e) Text is actual content, not placeholder/loading text -- check for "Loading...",
    skeleton placeholders, or JavaScript rendering artifacts`,

  selectors: {
    contentContainers: {
      article: 'article, [role="article"], [itemtype*="Article"]',
      lyrics: '[data-lyrics-container], .lyrics, .Lyrics__Container',
      recipe: '[itemtype*="Recipe"], .recipe-body, .ingredients-section',
      academic: '.research-detail__content, .Abstract, [itemprop="description"]',
      generic: 'main, article, .content, .post-content, .article-body, .entry-content'
    },
    textElements: {
      paragraph: 'p',
      heading: 'h1, h2, h3, h4, h5, h6',
      blockquote: 'blockquote',
      list: 'li',
      preformatted: 'pre, code'
    },
    protectionIndicators: {
      rightClickBlock: 'body[oncontextmenu], html[oncontextmenu]',
      selectionBlock: '[style*="user-select: none"], [style*="user-select:none"]',
      copyBlock: 'body[oncopy], html[oncopy]',
      overlay: 'div[style*="z-index"][style*="position"]'
    },
    dataAttributes: {
      medium: '[data-selectable-paragraph]',
      bloomberg: '[data-component="article-body"]',
      genius: '[data-lyrics-container]',
      generic: '[data-testid], [data-component], [data-content]'
    }
  },

  workflows: {
    extractProtectedText: [
      'Step 1: NAVIGATE TO TARGET PAGE -- Use navigate to load the page containing the protected text content. Wait for content to render fully, as dynamic content may load via JavaScript (AJAX, fetch, WebSocket) after the initial page load. If the site uses client-side rendering (React, Vue, Angular), the DOM may not contain text until JavaScript executes.',
      'Step 2: DETECT ANTI-SCRAPE PROTECTIONS -- Use get_dom_snapshot to inspect the page DOM. Check for: (a) oncontextmenu="return false" on body/html elements indicating right-click blocking, (b) CSS user-select:none on body or content containers indicating selection blocking, (c) oncopy/onselectstart handlers indicating copy blocking, (d) obfuscated class names (short hash-like alphanumeric strings, underscore-prefixed, css-* prefixed) indicating CSS-in-JS obfuscation, (e) transparent overlay divs with high z-index positioned over content area. Document which protections are present -- this informs the extraction strategy.',
      'Step 3: IDENTIFY CONTENT CONTAINERS -- Using structural selectors (NOT obfuscated class names), locate the main content area. Try in order: (a) article tags, main tags, role="article" attributes, (b) data-* attributes (data-testid, data-component, data-lyrics-container), (c) schema.org attributes (itemtype, itemprop), (d) semantic HTML hierarchy (main > article > section > p), (e) generic content class patterns (.content, .post-content, .article-body, .entry-content). If class names are obfuscated, rely entirely on tag-based and attribute-based selectors.',
      'Step 4: EXTRACT TEXT CONTENT -- Use read_page or get_text on the identified content containers to extract text. The text content exists in the DOM regardless of CSS/JS anti-scrape protections. For structured extraction (preserving heading/paragraph/list structure), use get_dom_snapshot and traverse the element tree to get text from each paragraph (p), heading (h1-h6), blockquote, and list item (li) separately. For bulk extraction, use read_page which returns the full page text.',
      'Step 5: HANDLE EDGE CASES -- If extracted text appears empty despite visible content on the page: (a) check for CSS content property text rendered via ::before/::after pseudo-elements -- use execute_js with window.getComputedStyle(element, "::before").content, (b) if content is behind a transparent overlay div, use execute_js to remove the overlay by setting element.style.display="none", (c) if content appears truncated by a paywall, extract whatever text is available in the DOM -- display:none paragraphs may still have textContent accessible via get_dom_snapshot, (d) if text is rendered as images/canvas (image-based text), document as a limitation -- DOM extraction cannot retrieve image-based text.',
      'Step 6: VERIFY EXTRACTION -- Confirm the extracted text is valid: (a) text is non-empty (length > 0), (b) text contains expected content such as the article headline, body paragraphs, or lyrics text (not just navigation, footer, or boilerplate), (c) text length is reasonable for the page type (article: 500+ chars, lyrics: 200+ chars, recipe: 100+ chars), (d) no truncation indicators ("Subscribe to read more", "Premium content", paywall messages), (e) text is actual content not loading placeholders. If text is suspiciously short, recheck for dynamically loaded content that may not have rendered yet, or paywall truncation limiting DOM content.'
    ]
  },

  warnings: [
    'DARK-10: Sites blocking right-click, selection, and copy only affect browser UI -- these protections are COMPLETELY bypassed by DOM-level text extraction via get_dom_snapshot, read_page, and get_text.',
    'When CSS class names are obfuscated (hashed, randomized), use structural selectors: tag names (article, p), data-* attributes, aria-* attributes, semantic HTML (main, section), or positional selectors (nth-child) instead.',
    'Transparent overlay divs that intercept mouse events do NOT block DOM access -- get_text reads elements behind overlays. If needed, use execute_js to remove the overlay (element.style.display="none").',
    'CSS user-select:none and -webkit-user-select:none only prevent mouse-drag selection in the browser UI. element.textContent and element.innerText return the full text regardless of user-select CSS rules.',
    'The only anti-scrape protection that defeats DOM extraction is image-based text rendering (text as image/canvas/SVG). This requires vision/OCR which MCP does not have. Document as a limitation if encountered.'
  ],

  toolPreferences: ['get_dom_snapshot', 'read_page', 'get_text', 'execute_js', 'navigate']
});
