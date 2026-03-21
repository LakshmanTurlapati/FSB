/**
 * Site Guide: Hacker News
 * Per-site guide for Hacker News (news.ycombinator.com) discussion platform.
 *
 * Includes expandAllThreads workflow for expanding all nested comment threads
 * on an HN post with 1000+ comments. HN is server-rendered HTML with a simple
 * table-based comment DOM. Comments are loaded in batches -- clicking "more"
 * links (class morelink) at the bottom of partially-loaded threads loads
 * additional comment batches via full page navigation.
 *
 * Created for Phase 72, SCROLL-06 edge case validation.
 * Target: expand all comment threads on a 1000+ comment HN post via pagination.
 */

registerSiteGuide({
  site: 'Hacker News',
  category: 'News',
  patterns: [
    /news\.ycombinator\.com/i,
    /hackernews\.com/i
  ],
  guidance: `HACKER NEWS THREAD EXPANSION (SCROLL-06):

HN COMMENT DOM STRUCTURE:
- HN renders comments as HTML tables -- no JavaScript frameworks, no virtual DOM
- Each comment is a table row: tr.athing.comtr (class="athing comtr")
- Comment ID stored as tr[id="NNN"] where NNN is the HN item ID
- Comment depth (nesting level) indicated by td.ind with a width attribute: width="0" = top-level, width="40" = 1 level deep, each level adds 40px
- Comment text: div.commtext (inside td.default)
- Comment author: a.hnuser (inside span.comhead)
- Comment age/timestamp: span.age a (contains relative time like "2 hours ago") with title attribute for absolute time
- Comment score: span.score (may not be visible on all comments)
- Collapse/expand toggle: a.togg (toggles individual comment subtree, shows [-] or [+])
- The entire comment tree is in a table.comment-tree

HN "MORE" LINKS (CRITICAL FOR 1000+ COMMENT EXPANSION):
- HN does NOT load all comments at once for large threads
- Initial page load shows a subset of comments (typically 100-200 for popular threads)
- At the bottom of the comment list: a.morelink inside a td with class "title" that says "More" or shows "more comments"
- Clicking the morelink navigates to a NEW PAGE that loads the next batch of comments
- This is a full page navigation, not AJAX -- the URL changes to ?p=2, ?p=3, etc.
- Each page batch has another morelink at the bottom until all comments are loaded
- There may also be inline "more replies" links within nested threads: these look like <a class="morelink" ...>more</a> or plain text links

HN THREAD PAGINATION:
- Large threads (1000+ comments) are split across multiple pages
- Page 1: news.ycombinator.com/item?id=XXXXXXX (first batch, typically ~100 comments)
- Page 2: news.ycombinator.com/item?id=XXXXXXX&p=2 (next batch)
- Each page has its own comment-tree table
- The morelink at the bottom of each page points to the next page URL
- Continue clicking morelink until no more morelink exists on the page

COMMENT COUNTING STRATEGY:
- Count comments per page: document.querySelectorAll('tr.athing.comtr').length
- Track cumulative total across pages (page 1 count + page 2 count + ...)
- HN shows total comment count in the subtext line: "NNN comments" (look for a.subline or span.subline on the post header)
- The header comment count may differ from actual loaded comments (some may be dead/flagged)
- Verify final count against the header count -- within 5-10% is acceptable for flagged/dead comment variance

EXPANSION-FIRST STRATEGY:
- Phase 1 (EXPAND): Click the morelink at the bottom of the page to load the next batch of comments. This navigates to a new page.
- Phase 2 (COUNT): On each new page, count tr.athing.comtr elements and add to cumulative total
- Phase 3 (REPEAT): Check for another morelink at the bottom. If present, click it. If absent, all comments are loaded.
- Phase 4 (VERIFY): Compare cumulative count against the header comment count

FINDING A 1000+ COMMENT POST:
- Navigate to news.ycombinator.com
- Look for posts with "NNN comments" link in the subtext where NNN > 1000
- Alternatively, use direct URL to a known popular post (e.g., Ask HN threads, major tech announcements)
- The comments link is: a[href^="item?id="] inside td.subtext with text matching /\\d+ comment/
- Or navigate to news.ycombinator.com/best or news.ycombinator.com/ask for popular threads

GOOD TEST TARGETS:
- Ask HN threads (high engagement, many nested replies)
- Major tech announcements (Apple, Google launches)
- Any post where the subtext shows 1000+ comments
- HN front page usually has at least one 200+ comment thread; for 1000+ check bestof or past popular threads`,
  selectors: {
    commentRow: 'tr.athing.comtr',
    commentText: 'div.commtext, span.commtext',
    commentAuthor: 'a.hnuser',
    commentAge: 'span.age a',
    commentScore: 'span.score',
    collapseToggle: 'a.togg',
    commentTree: 'table.comment-tree',
    depthIndicator: 'td.ind',
    moreLink: 'a.morelink',
    postTitle: 'a.titlelink, td.title a.storylink',
    postSubtext: 'td.subtext, span.subline',
    commentsCount: 'td.subtext a[href^="item?id="]',
    postHeader: 'tr.athing:not(.comtr)',
    navLinks: 'span.pagetop a'
  },
  workflows: {
    expandAllThreads: [
      'Navigate to a Hacker News post with 1000+ comments (check subtext for "NNN comments" where NNN >= 1000)',
      'Use read_page to verify the post loaded -- check for post title, subtext with comment count, and comment-tree table',
      'Record the total comment count from the subtext (e.g., "1523 comments")',
      'Count initial comments on page 1: count all tr.athing.comtr elements',
      'Look for a.morelink at the bottom of the comment list',
      'If morelink exists: click it to navigate to the next page of comments',
      'Wait 1000-2000ms for the new page to load (this is a full page navigation)',
      'On the new page: count tr.athing.comtr elements and add to cumulative total',
      'Check for another a.morelink at the bottom of the new page',
      'Repeat click-morelink, count, check-for-more until no morelink remains',
      'After all pages loaded: verify cumulative count against header comment count (within 10% is acceptable)',
      'Report: total comments expanded, number of pages visited, final cumulative count vs header count'
    ],
    countComments: [
      'On current HN page: count all tr.athing.comtr elements',
      'Read comment count from subtext for comparison',
      'For depth analysis: check td.ind width attribute on each comment (width / 40 = depth level)',
      'Report: visible count, header count, max thread depth'
    ]
  },
  warnings: [
    'HN morelink is a FULL PAGE NAVIGATION, not AJAX -- the URL changes and entire page reloads with the next batch of comments',
    'Do NOT use scroll to load more comments -- HN uses pagination via morelink clicks, not infinite scroll',
    'Comment depth is indicated by td.ind width attribute, not CSS nesting -- width="0" is top-level, each level adds 40px',
    'Large threads (1000+) may require 5-15 page navigations to load all comments',
    'Dead or flagged comments may cause actual loaded count to differ from header count by up to 10%',
    'HN has aggressive rate limiting -- wait 1000-2000ms between morelink clicks to avoid being blocked'
  ],
  toolPreferences: ['click', 'scroll', 'read_page', 'get_dom_snapshot', 'navigate', 'waitForDOMStable']
});
