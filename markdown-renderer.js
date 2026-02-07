// Shared Markdown Renderer for FSB UI (popup + sidepanel)
// Uses marked.js + DOMPurify for safe rendering

const FSBMarkdown = (() => {
  // Regex patterns that indicate markdown formatting
  const MD_PATTERNS = [
    /\*\*.+?\*\*/,         // **bold**
    /\*.+?\*/,             // *italic*
    /^#{1,6}\s/m,          // ## headings
    /```[\s\S]*?```/,      // ```code blocks```
    /`[^`]+`/,             // `inline code`
    /^[\-\*]\s/m,          // - list items
    /^\d+\.\s/m,           // 1. ordered list
    /\|.+\|/,              // | table |
    /^>\s/m                // > blockquote
  ];

  const ALLOWED_TAGS = [
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'p', 'br', 'hr',
    'strong', 'em', 'code', 'pre',
    'ul', 'ol', 'li',
    'blockquote',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
    'a',
    'del', 'ins'
  ];

  const ALLOWED_ATTR = ['href', 'target', 'rel'];

  function isAvailable() {
    return typeof marked !== 'undefined' && typeof DOMPurify !== 'undefined';
  }

  function hasMarkdown(text) {
    if (!text || typeof text !== 'string') return false;
    return MD_PATTERNS.some(pattern => pattern.test(text));
  }

  function render(text) {
    if (!isAvailable() || !hasMarkdown(text)) return null;

    try {
      const html = marked.parse(text, {
        gfm: true,
        breaks: true
      });

      const clean = DOMPurify.sanitize(html, {
        ALLOWED_TAGS: ALLOWED_TAGS,
        ALLOWED_ATTR: ALLOWED_ATTR,
        ADD_ATTR: ['target', 'rel']
      });

      // Post-process: add target="_blank" and rel to all links
      const temp = document.createElement('div');
      temp.innerHTML = clean;
      temp.querySelectorAll('a').forEach(a => {
        a.setAttribute('target', '_blank');
        a.setAttribute('rel', 'noopener noreferrer');
      });

      return temp.innerHTML;
    } catch (err) {
      console.error('FSBMarkdown render error:', err);
      return null;
    }
  }

  function applyToElement(el, text) {
    const html = render(text);
    if (html) {
      el.innerHTML = html;
      el.classList.add('md-rendered');
    } else {
      el.textContent = text;
    }
  }

  return { hasMarkdown, render, applyToElement, isAvailable };
})();
