/**
 * Site Guide: Wikipedia
 * Per-site guide for Wikipedia article pages (en.wikipedia.org and other language wikis).
 *
 * Wikipedia renders article content as standard HTML paragraphs inside
 * #mw-content-text .mw-parser-output. Text selection is straightforward since
 * all content is DOM-based (no canvas, no shadow DOM, no framework virtualization).
 *
 * Key challenge for text selection: paragraphs may contain inline elements
 * (links, bold, italic, citations) that split text across multiple text nodes.
 * The select_text_range tool handles this via TreeWalker text node traversal.
 *
 * Created for Phase 60, MICRO-04 edge case validation.
 * Target: highlight exactly the second sentence of the third paragraph.
 */

registerSiteGuide({
  site: 'Wikipedia',
  category: 'Reference',
  patterns: [
    /en\.wikipedia\.org/i,
    /\w+\.wikipedia\.org/i,
    /wikipedia\.org\/wiki\//i
  ],
  guidance: `AUTOPILOT STRATEGY HINTS (from v0.9.7 diagnostic MICRO-04):
- [micro] Use select_text_range (TreeWalker+Range API) not CDP drag for text selection
- [micro] Filter empty <p> elements before counting -- p:nth-of-type(N) includes empties
- [micro] Sentence boundary: use ". [A-Z]" pattern; skip abbreviations (Dr., U.S., e.g.)
- [micro] Citation text [10] shifts offsets -- calculate from raw textContent, do NOT strip
- [micro] Verify selectedText starts uppercase, ends period, contains expected keywords

WIKIPEDIA TEXT SELECTION INTELLIGENCE:

ARTICLE CONTENT STRUCTURE:
- All article text lives inside #mw-content-text .mw-parser-output
- Paragraphs are <p> elements (direct children of .mw-parser-output)
- IMPORTANT: some early <p> elements may be empty or contain only whitespace (before the lead section)
- The "first real paragraph" is the first <p> with substantial text content (>50 characters)
- Paragraphs contain inline elements: <a> (links), <b> (bold), <i> (italic), <sup> (citations like [1])
- Citations appear as <sup class="reference"> with nested <a> links -- these add characters to text content
- Headings use <h2>, <h3>, etc. wrapped in <span class="mw-headline">

PARAGRAPH IDENTIFICATION:
- Use selector: #mw-content-text .mw-parser-output > p
- Filter out empty paragraphs (textContent.trim().length < 10)
- The Nth real paragraph = the Nth non-empty <p> from that list
- For "third paragraph": get all non-empty <p> elements, take index 2 (0-based)

SENTENCE BOUNDARY DETECTION:
- Split paragraph text on sentence-ending patterns
- Primary pattern: period followed by space and uppercase letter (". [A-Z]")
- Handle abbreviations: common abbreviations like "Dr.", "Mr.", "Mrs.", "U.S.", "e.g.", "i.e." should NOT be treated as sentence boundaries
- Handle citations: text like "...[1] The next..." -- the [1] is a citation reference, sentence boundary is before the capital letter after it
- The "second sentence" = text between the end of the first sentence (first ". " + uppercase) and the end of the second sentence (next ". " + uppercase or end of paragraph)

CALCULATING CHARACTER OFFSETS FOR select_text_range:
1. Get the paragraph element via selector
2. Read element.textContent to get the full flattened text (includes citation bracket text)
3. Find sentence boundaries using regex or string scanning
4. The startOffset = character position right after "first-sentence-ending-period-space"
5. The endOffset = character position at "second-sentence-ending-period" + 1 (include the period)
6. Pass selector, startOffset, endOffset to select_text_range tool

VERIFICATION:
- After select_text_range, check the returned selectedText value
- The selectedText should start with an uppercase letter and end with a period
- Compare selectedText against the expected second sentence from read_page output
- window.getSelection().toString() should match the selected text`,
  selectors: {
    articleContent: '#mw-content-text .mw-parser-output',
    allParagraphs: '#mw-content-text .mw-parser-output > p',
    thirdParagraph: '#mw-content-text .mw-parser-output > p:nth-of-type(3)',
    firstHeading: '#firstHeading, .mw-first-heading',
    tableOfContents: '#toc, .toc, #vector-toc',
    citation: 'sup.reference',
    infobox: '.infobox',
    contentBody: '#bodyContent, #content'
  },
  workflows: {
    highlightSentence: [
      'Navigate to the Wikipedia article page using navigate tool',
      'Use read_page to get the article text content and identify paragraph structure',
      'Use get_dom_snapshot to identify paragraph element references in #mw-content-text .mw-parser-output',
      'IDENTIFY TARGET PARAGRAPH: Find the Nth paragraph by filtering out empty <p> elements. For "third paragraph", locate the third non-empty <p> element. Get its element reference or CSS selector.',
      'READ PARAGRAPH TEXT: Use getText on the target paragraph element reference to get its full text content. Note: textContent includes citation bracket text like "[1]" which affects character offsets.',
      'FIND SENTENCE BOUNDARIES: Scan the paragraph text for sentence endings. A sentence ends at ". " followed by an uppercase letter [A-Z]. Skip common abbreviations (Dr., Mr., Mrs., U.S., etc.). The second sentence starts right after the first ". [A-Z]" boundary.',
      'CALCULATE OFFSETS: startOffset = index of first character of second sentence. endOffset = index of the character after the period ending the second sentence. Example: if text is "First sentence. Second sentence. Third sentence.", startOffset=16, endOffset=32.',
      'SELECT TEXT: Use select_text_range(selector, startOffset, endOffset) to highlight exactly the second sentence. The selector should be the CSS path to the target paragraph element.',
      'VERIFY: Check the returned selectedText from select_text_range. It should start with an uppercase letter and end with a period. Compare against the expected sentence from step 5.',
      'STUCK: If paragraph numbering is wrong (empty paragraphs throwing off count), use read_page to re-examine paragraph structure. If select_text_range returns wrong text, recalculate offsets accounting for citation superscripts like [1][2] which add characters. If the article has no third paragraph, navigate to a longer article (e.g., "Albert Einstein", "United States", "World War II").'
    ]
  },
  toolPreferences: ['navigate', 'read_page', 'get_dom_snapshot', 'select_text_range', 'click', 'scroll', 'getText', 'waitForElement']
});
