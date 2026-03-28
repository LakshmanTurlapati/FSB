# Phase 27: Site Explorer Markdown Snapshot Integration - Research

**Researched:** 2026-03-11
**Domain:** Chrome extension internal integration (site-explorer.js + options.js UI)
**Confidence:** HIGH

## Summary

This phase is a straightforward internal integration connecting two existing subsystems: the Site Explorer crawler (`utils/site-explorer.js`) and the markdown snapshot engine (via `getMarkdownSnapshot` message handler in `content/messaging.js`). The crawler already collects DOM data per page using `sendTabMessage`; the markdown snapshot must be fetched the same way and stored on the `pageData` object. The options page research detail view (`ui/options.js`) already renders per-page lists in a details/summary pattern; this needs extending with per-page collapsible snapshot pre blocks.

No new libraries, APIs, or patterns are needed. All building blocks exist: the `getMarkdownSnapshot` message handler accepts `guideSelectors` in options, `getGuideForTask(task, url)` is available in the background script context where site-explorer.js runs, and the options page already uses `escapeHtml()` for safe HTML rendering. The download function (`downloadResearch`) serializes `data` as JSON directly -- adding `markdownSnapshot` to `pageData` automatically includes it in downloads.

**Primary recommendation:** Add getMarkdownSnapshot call after getDOM in collectPageData(), thread guideSelectors via getGuideForTask(url, ''), store result as pageData.markdownSnapshot, then render in options.js per-page list with collapsible pre blocks.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Collapsible pre block per crawled page (details/summary pattern matching existing pages-crawled list)
- Show stats line above the pre block: character count and element count (e.g., "Markdown: 4,231 chars, 42 elements")
- Pages without a snapshot show a "Snapshot unavailable" warning instead of being hidden -- makes failures visible
- Resolve site guide per crawled URL using URL-based matching only (getGuideForTask(url, '') with empty task text)
- Pass guideSelectors through getMarkdownSnapshot message options -- same path as the automation loop
- Show matched guide name next to each page in research results (e.g., "Guide: Google Sheets") -- confirms detection is working
- Runs in background script context where getGuideForTask() is already available
- Individual collapsible per page (not one big block for all pages) -- manageable for 25-page crawls
- Per-page only, no cross-page summary or diff view
- Always capture -- every crawl automatically fetches markdown snapshot per page, no toggle needed
- No readpage/extractPageText capture -- just the markdown snapshot
- Downloaded research JSON includes full markdown snapshot text per page for offline analysis
- No storage concern -- 100-300KB per crawl is fine within chrome.storage.local 10MB limit

### Claude's Discretion
- Pre block styling (dark bg, color hints for refs -- whatever looks clean with minimal effort)
- Whether to add a copy-to-clipboard button on the snapshot pre block
- Whether to include a per-page element summary table in the cross-page view

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

## Standard Stack

### Core
No new libraries. This is purely internal integration using existing Chrome Extension APIs and project code.

| Component | Location | Purpose | Already Exists |
|-----------|----------|---------|----------------|
| site-explorer.js | `utils/site-explorer.js` | Crawler that collects page data | YES |
| messaging.js | `content/messaging.js` | Handles getMarkdownSnapshot in content script | YES |
| options.js | `ui/options.js` | Research detail view rendering | YES |
| site-guides/index.js | `site-guides/index.js` | getGuideForTask() for URL-based guide resolution | YES |

### Supporting
| Utility | Location | Purpose |
|---------|----------|---------|
| `sendTabMessage()` | site-explorer.js:436 | Message passing to content script with timeout |
| `escapeHtml()` | options.js (global) | Safe HTML rendering for snapshot text |
| `getGuideForTask(task, url)` | site-guides/index.js:126 | Resolves guide by URL, returns guide with `.site`/`.name`, `.selectors`, `.fsbElements` |
| `chrome.tabs.sendMessage` | Chrome API | Underlying message transport |

## Architecture Patterns

### Integration Pattern: Follow Existing getDOM Call
The crawler already fetches DOM data via `sendTabMessage` with try/catch and null fallback. The markdown snapshot call follows the exact same pattern, placed immediately after the getDOM call.

**Pattern from site-explorer.js:258-266:**
```javascript
// Get DOM structure
let domData = null;
try {
  domData = await this.sendTabMessage(this.tabId, {
    action: 'getDOM',
    options: { maxElements: 500, prioritizeViewport: false }
  });
} catch (error) {
  console.warn(`[SiteExplorer] getDOM failed for ${url}:`, error.message);
}
```

**New markdown snapshot call follows same pattern:**
```javascript
// Get markdown snapshot (AI-visible page view)
let markdownData = null;
try {
  // Resolve site guide for URL-based selector threading
  const guide = (typeof getGuideForTask === 'function') ? getGuideForTask('', url) : null;
  const guideSelectors = guide ? { ...guide.selectors, fsbElements: guide.fsbElements } : null;

  markdownData = await this.sendTabMessage(this.tabId, {
    action: 'getMarkdownSnapshot',
    options: { charBudget: 12000, maxElements: 80, guideSelectors }
  });
} catch (error) {
  console.warn(`[SiteExplorer] getMarkdownSnapshot failed for ${url}:`, error.message);
}
```

### Guide Selector Threading Pattern
From background.js:8334-8346, the automation loop resolves guideSelectors like this:
```javascript
let iterationGuideSelectors = null;
if (typeof getGuideForTask === 'function') {
  try {
    const guideTab = await chrome.tabs.get(session.tabId);
    const guide = getGuideForTask(session.task, guideTab?.url);
    if (guide) {
      iterationGuideSelectors = { ...guide.selectors, fsbElements: guide.fsbElements };
    }
  } catch (e) { }
}
```
Site explorer simplifies this: no session/task needed, just URL. Use `getGuideForTask('', url)`.

### PageData Object Extension
Add three fields to the pageData object (site-explorer.js:287-299):
```javascript
const pageData = {
  // ... existing fields ...
  markdownSnapshot: null,       // Full markdown text
  markdownElementCount: 0,      // Element count from response
  guideName: null               // Matched guide name for display
};
```

### Options Page Display Pattern
The existing per-page list (options.js:3181-3188) renders as:
```javascript
<details>
  <summary>Pages crawled (N)</summary>
  <ul>
    ${data.pages.map(p => `<li>${escapeHtml(p.url)} (N elements)</li>`).join('')}
  </ul>
</details>
```

Extend each `<li>` to contain a nested `<details>` for the snapshot:
```javascript
data.pages.map(p => `
  <li>
    ${escapeHtml(p.url)} (${p.interactiveElements?.length || 0} elements)
    ${p.guideName ? `<span style="color: var(--accent); margin-left: 0.5rem;">Guide: ${escapeHtml(p.guideName)}</span>` : ''}
    <div style="font-size: 0.6875rem; color: var(--text-muted);">
      ${p.markdownSnapshot
        ? `Markdown: ${p.markdownSnapshot.length.toLocaleString()} chars, ${p.markdownElementCount || 0} elements`
        : '<span style="color: var(--warning);">Snapshot unavailable</span>'}
    </div>
    ${p.markdownSnapshot ? `
      <details style="margin-top: 0.25rem;">
        <summary style="cursor: pointer; font-size: 0.75rem;">View Markdown Snapshot</summary>
        <pre style="...">${escapeHtml(p.markdownSnapshot)}</pre>
      </details>
    ` : ''}
  </li>
`).join('')
```

### Anti-Patterns to Avoid
- **Do NOT call getMarkdownSnapshot before getDOM:** The snapshot engine depends on DOM being available in the content script. Always call after getDOM.
- **Do NOT synthesize guideSelectors from domData:** Use the proper getGuideForTask path -- it returns the full guide object with selectors and fsbElements.
- **Do NOT truncate snapshot in storage:** Store full text. The 100-300KB per crawl estimate is well within limits.
- **Do NOT add a toggle for snapshot capture:** Decision is "always capture."

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Guide resolution | Custom URL pattern matching | `getGuideForTask('', url)` | Already handles all URL patterns and returns full guide object |
| Message passing | Direct chrome.tabs.sendMessage | `this.sendTabMessage()` | Has timeout handling, error wrapping, retry logic |
| HTML escaping | Regex replacements | `escapeHtml()` | Already handles all edge cases, used throughout options.js |
| Snapshot generation | Custom DOM walk | `getMarkdownSnapshot` message | Full pipeline with Stage 1b injection, region detection, element refs |

## Common Pitfalls

### Pitfall 1: getGuideForTask argument order
**What goes wrong:** `getGuideForTask(task, url)` takes task FIRST, url SECOND. The CONTEXT.md says to use `getGuideForTask(url, '')` but examining the function signature (site-guides/index.js:126), it is `getGuideForTask(task, url)`.
**How to avoid:** Call as `getGuideForTask('', url)` -- empty string for task, url as second argument. This skips keyword matching and goes straight to URL-based lookup.

### Pitfall 2: Guide name property varies
**What goes wrong:** Some guides have `.site` (per-site format, e.g., "Google Sheets"), others have `.name` (category format). Using only `.name` misses per-site guides.
**How to avoid:** Use `guide.site || guide.name` when displaying the guide name.

### Pitfall 3: Content script not ready for snapshot
**What goes wrong:** getMarkdownSnapshot requires FSB content script with `buildMarkdownSnapshot` function. If content script injection failed, the message will timeout.
**How to avoid:** Place the snapshot call AFTER the existing `ensureContentScriptInjected` + `waitForContentScriptReady` + getDOM sequence. The getDOM call already validates content script availability.

### Pitfall 4: Missing frameId in sendTabMessage
**What goes wrong:** Background.js uses `{ frameId: 0 }` when calling chrome.tabs.sendMessage to target the main frame. If sendTabMessage in site-explorer.js doesn't do this, the message may go to the wrong frame.
**How to avoid:** Check that `sendTabMessage` already includes `{ frameId: 0 }` or equivalent. The messaging.js handler at line 981 confirms it handles `getMarkdownSnapshot` in the content script message listener.

### Pitfall 5: Escaped HTML in pre blocks corrupts snapshot readability
**What goes wrong:** Markdown snapshots contain backtick-quoted element refs like `` `e5: button "Submit"` `` which look fine, but any `<` or `>` in page content would be escaped by escapeHtml, potentially making the snapshot harder to read.
**How to avoid:** This is correct behavior -- always escapeHtml for security. The snapshot is diagnostic text, not meant to be rendered as HTML.

## Code Examples

### Verified: getMarkdownSnapshot message handler (messaging.js:749-767)
```javascript
case 'getMarkdownSnapshot':
  const mdGuideSelectors = request.options?.guideSelectors || null;
  const mdResult = FSB.buildMarkdownSnapshot({
    guideSelectors: mdGuideSelectors,
    charBudget: request.options?.charBudget || 12000,
    maxElements: request.options?.maxElements || 80
  });
  sendResponse({
    success: true,
    markdownSnapshot: mdResult.snapshot,
    refGeneration: mdResult.refGeneration,
    elementCount: mdResult.elementCount
  });
```

### Verified: Guide selector construction (background.js:8340-8342)
```javascript
const guide = getGuideForTask(session.task, guideTab?.url);
if (guide) {
  iterationGuideSelectors = { ...guide.selectors, fsbElements: guide.fsbElements };
}
```

### Verified: sendTabMessage with timeout (site-explorer.js:436)
```javascript
sendTabMessage(tabId, message, timeout = 10000) {
  // Returns promise, rejects on timeout
}
```

### Verified: Download includes all pageData fields (site-explorer.js:469)
```javascript
pages: this.pagesCollected,  // Direct reference -- any field on pageData is included
```

## State of the Art

| Aspect | Current State | Phase 27 Addition |
|--------|--------------|-------------------|
| Page data collection | getDOM + getExplorerData per page | + getMarkdownSnapshot per page |
| Guide awareness | Used in automation loop only | Extended to crawler for selector threading |
| Research detail view | URL + element count per page | + guide name + snapshot stats + collapsible pre |
| Research JSON download | All pageData fields serialized | markdownSnapshot field automatically included |

## Open Questions

1. **sendTabMessage frameId behavior**
   - What we know: background.js uses `{ frameId: 0 }` explicitly. sendTabMessage in site-explorer.js wraps chrome.tabs.sendMessage.
   - What's unclear: Whether sendTabMessage already passes frameId:0 or not.
   - Recommendation: Check the implementation at line 436. If it doesn't pass frameId:0, add it for the getMarkdownSnapshot call specifically.

2. **Snapshot budget for explorer vs automation**
   - What we know: Automation uses charBudget:12000, maxElements:80. Explorer uses maxElements:500 for getDOM.
   - What's unclear: Whether explorer should use a larger snapshot budget since it's diagnostic.
   - Recommendation: Use same defaults (12000 chars, 80 elements) to match what the AI actually sees. This IS the diagnostic goal.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Manual testing (Chrome extension, no automated test framework) |
| Config file | none |
| Quick run command | Load extension, run Site Explorer crawl on Google Sheets URL |
| Full suite command | Crawl multiple sites, verify snapshots in detail view and downloaded JSON |

### Phase Requirements -> Test Map
| Req | Behavior | Test Type | Verification |
|-----|----------|-----------|-------------|
| SC-1 | collectPageData fetches getMarkdownSnapshot after getDOM, stores as pageData.markdownSnapshot | manual | Crawl any page, check console logs for snapshot fetch, verify in downloaded JSON |
| SC-2 | Research detail view renders markdown snapshot in collapsible pre block per page | manual | Open research detail, expand page, verify collapsible pre block with snapshot text |
| SC-3 | Google Sheets URL produces snapshot showing formula bar, name box, toolbar | manual | Crawl a Google Sheets URL, verify snapshot contains fsbRole elements with values |
| SC-4 | Downloaded research JSON includes markdownSnapshot field per page | manual | Download JSON, search for markdownSnapshot key in each page object |

### Sampling Rate
- **Per task commit:** Load extension, crawl test URL, verify snapshot appears
- **Per wave merge:** Crawl Google Sheets + generic site, verify both display correctly
- **Phase gate:** All 4 success criteria verified manually

### Wave 0 Gaps
None -- no automated test infrastructure applies. All verification is manual via extension UI.

## Sources

### Primary (HIGH confidence)
- `utils/site-explorer.js` -- collectPageData() at lines 231-360, sendTabMessage at 436, saveResearch at 457-479
- `content/messaging.js` -- getMarkdownSnapshot handler at lines 749-767
- `ui/options.js` -- viewResearchDetail at lines 3146-3199, downloadResearch at 3201-3220
- `background.js` -- guideSelector resolution pattern at lines 8334-8346
- `site-guides/index.js` -- getGuideForTask at line 126, guide object structure (`.site`/`.name`)
- `site-guides/productivity/google-sheets.js` -- Google Sheets guide with `.site: 'Google Sheets'`

### Secondary (MEDIUM confidence)
- CONTEXT.md integration points (line numbers may shift if Phase 26 modified these files recently)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all components verified in source code, no new dependencies
- Architecture: HIGH -- follows established patterns (getDOM call pattern, details/summary UI pattern)
- Pitfalls: HIGH -- verified argument order and property names in source code

**Research date:** 2026-03-11
**Valid until:** 2026-04-11 (stable internal integration, no external dependencies)
