/**
 * Site Guide: Reddit
 * Per-site guide for Reddit community discussion platform.
 *
 * Includes thread-bottom scroll and last-comment reply workflow for
 * navigating to the bottom of populated Reddit threads and replying
 * to the last comment. Reddit threads use nested comment trees with
 * "load more comments" expansion buttons rather than pure infinite scroll.
 *
 * Created for Phase 70, SCROLL-04 edge case validation.
 * Target: scroll to bottom of Reddit thread, identify last comment, attempt reply.
 */

registerSiteGuide({
  site: 'Reddit',
  category: 'Social Media',
  patterns: [
    /reddit\.com/i
  ],
  guidance: `REDDIT-SPECIFIC INTELLIGENCE:

COMMON PATTERNS:
  # search for a topic
  click e5    # search box
  type e5 "programming memes"
  enter
  click e10   # subreddit or post result
  scroll down
  # comment on a post
  click e15   # comment input
  type e15 "comment text"
  click e20   # submit button

Reddit is organized into subreddits (r/subreddit) and user profiles (u/username).

SEARCH & NAVIGATION:
- Search box: #search-input input or input[name="q"]
- Navigate via r/subreddit URLs for specific communities
- Navigate via u/username URLs for user profiles

POSTING:
- Post title: [placeholder="Title"]
- Post body: .public-DraftEditor-content (rich text editor)
- Submit button: button[type="submit"]

VOTING:
- Upvote: [aria-label="upvote"]
- Downvote: [aria-label="downvote"]
- Comment input: [data-testid="comment-compose-area"]

IMPORTANT NOTES:
- Reddit redesign (new.reddit.com) and old Reddit have different UI patterns
- Subreddit-specific rules may restrict posting
- Karma requirements may limit actions for new accounts

THREAD-BOTTOM SCROLL AND LAST-COMMENT REPLY (SCROLL-04):

REDDIT THREAD STRUCTURE:
- Reddit threads (posts) have a nested comment tree below the post body
- Comments are organized in a tree hierarchy with parent-child reply nesting
- New Reddit (reddit.com) uses Shreddit web components: <shreddit-comment> elements with tree-node nesting
- Old Reddit (old.reddit.com) uses div.comment with div.child for nested replies
- Long threads use "load more comments" / "continue this thread" expansion links instead of pure infinite scroll
- Thread may also have pagination ("view more comments" or "load more replies")
- Comments are NOT virtualized -- they persist in DOM once loaded

NEW REDDIT (reddit.com) COMMENT SELECTORS:
- Comment container: shreddit-comment (custom web component)
- Comment body text: shreddit-comment div[slot="comment"] or shreddit-comment p
- Comment author: shreddit-comment [data-testid="comment_author_link"]
- Reply button: shreddit-comment button[aria-label*="Reply"], shreddit-comment button:has(span:contains("Reply"))
- Comment text area (after clicking reply): shreddit-comment textarea, shreddit-comment [contenteditable="true"], div[data-lexical-editor="true"]
- Submit reply button: button[type="submit"], button:has(span:contains("Comment"))
- Load more comments: button:has(span:contains("more")), [data-testid="load-more-comments"]
- Continue thread link: a:has(span:contains("Continue this thread"))
- Comment votes: shreddit-comment [aria-label*="upvote"], shreddit-comment [aria-label*="downvote"]
- Comment timestamp: shreddit-comment time, shreddit-comment faceplate-timeago

OLD REDDIT (old.reddit.com) COMMENT SELECTORS:
- Comment container: div.comment, div.thing.comment
- Comment body text: div.md p (within comment container)
- Comment author: a.author
- Reply button: a[data-event-action="comment"], a.reply-button, li.reply a
- Comment text area: textarea[name="text"]
- Submit reply button: button[type="submit"].save
- Load more comments: a.morecomments, span.morecomments a
- Continue thread link: a[id^="more_"] with "load more comments" text
- Comment depth indicator: div.child nesting level

BOTTOM-OF-THREAD DETECTION:
- Thread bottom reached when: no more "load more comments" buttons exist AND scroll position reaches the end of the comment section
- Check for absence of: "load more comments" links, "continue this thread" links, pagination controls
- The very last comment is the deepest or latest (sort order matters: sort by "old" to get chronological)
- Sort order selector: button or dropdown with sort options (Best, Top, New, Controversial, Old, Q&A)
- To guarantee last comment = chronologically last: sort by "New" (newest first, last loaded = oldest) or sort by "Old" (oldest first, last loaded = newest at bottom)
- Recommended: sort by "Old" so scrolling to bottom naturally reaches the most recent comment

AUTHENTICATION FOR REPLY:
- Reddit requires authentication to reply to comments
- If not logged in: reply buttons may not appear, or clicking reply shows a login modal
- Login modal: [data-testid="login-modal"], div[class*="login"], a[href*="/login"]
- If auth required: document as SKIP-AUTH for the reply portion, confirm thread navigation and last comment identification still work
- Public thread viewing (read-only) works without authentication

METHOD: SCROLL TO BOTTOM OF THREAD AND REPLY TO LAST COMMENT:
Steps:
1. Navigate to a populated Reddit thread (choose a thread with 100+ comments for meaningful scroll testing)
2. Sort comments by "Old" (chronological) so the last comment at the bottom is the most recent
3. Use read_page to verify the thread loaded and comments section is visible
4. Scan for "load more comments" buttons -- click each one to expand hidden comment chains
5. Scroll down through the comment section to load and view all comments
6. After each scroll: use read_page to check for new "load more comments" buttons that appeared
7. Click any new "load more comments" / "continue this thread" links found after scrolling
8. Repeat steps 5-7 until: (a) no more "load more comments" buttons exist, (b) scroll position is at the end of the page, (c) max 20 scroll iterations reached
9. Identify the last visible comment: the final shreddit-comment (new Reddit) or div.comment (old Reddit) element in DOM order
10. Extract the last comment's text, author, and timestamp
11. Attempt to click the reply button on the last comment
12. If reply button opens a text area: type a reply message
13. Do NOT submit the reply (avoid actually posting) -- just verify the reply text area is functional
14. If clicking reply triggers a login modal: document as SKIP-AUTH
15. Verify: thread was scrolled to bottom, last comment identified, reply mechanism tested

SCROLL TIMING FOR REDDIT THREADS:
- Reddit comment sections load "more comments" inline, not via infinite scroll
- After clicking "load more comments": wait 1000-2000ms for comments to render
- After scrolling: wait 500-1000ms for any lazy-loaded elements
- Use waitForDOMStable after expanding "load more" buttons
- Typical Reddit thread with 100+ comments may need 5-15 "load more" clicks plus 10-20 scroll iterations

GOOD TEST THREADS:
- r/AskReddit popular threads (thousands of comments, diverse nesting)
- r/programming or r/technology popular posts (hundreds of comments)
- Any thread with 100+ comments provides good scroll testing
- Use URL format: reddit.com/r/{subreddit}/comments/{post_id}/{slug}/
- Old Reddit format: old.reddit.com/r/{subreddit}/comments/{post_id}/{slug}/?sort=old`,
  selectors: {
    searchBox: '#search-input input, input[name="q"]',
    postTitle: '[placeholder="Title"]',
    postBody: '.public-DraftEditor-content',
    commentInput: '[data-testid="comment-compose-area"]',
    submitButton: 'button[type="submit"]',
    upvote: '[aria-label="upvote"]',
    downvote: '[aria-label="downvote"]',
    // Thread-bottom navigation and reply selectors (SCROLL-04)
    commentContainer: 'shreddit-comment, div.comment, div.thing.comment',
    commentBody: 'shreddit-comment div[slot="comment"], shreddit-comment p, div.comment div.md p',
    commentAuthor: 'shreddit-comment [data-testid="comment_author_link"], a.author',
    replyButton: 'shreddit-comment button[aria-label*="Reply"], a[data-event-action="comment"], li.reply a',
    commentTextArea: 'shreddit-comment textarea, shreddit-comment [contenteditable="true"], div[data-lexical-editor="true"], textarea[name="text"]',
    submitReplyButton: 'button[type="submit"]:has(span), button[type="submit"].save',
    loadMoreComments: 'button:has(span:contains("more")), [data-testid="load-more-comments"], a.morecomments, span.morecomments a',
    continueThread: 'a:has(span:contains("Continue this thread")), a[id^="more_"]',
    commentTimestamp: 'shreddit-comment time, shreddit-comment faceplate-timeago, div.comment time',
    sortComments: 'button:has(span:contains("Sort")), select[name="sort"], div[data-testid="comment-sort"]',
    loginModal: '[data-testid="login-modal"], div[class*="login"], a[href*="/login"]',
    commentSection: 'shreddit-comment-tree, div.commentarea, [data-testid="comments-page"]'
  },
  workflows: {
    createPost: [
      'Navigate to the target subreddit',
      'Click the create post button',
      'Enter the post title',
      'Type the post body content',
      'Click Submit button',
      'Verify post was created'
    ],
    commentOnPost: [
      'Navigate to the post',
      'Scroll to find the comment input',
      'Click the comment area',
      'Type the comment',
      'Click Submit or press Enter',
      'Verify comment was posted'
    ],
    scrollToBottomAndReply: [
      'Navigate to a populated Reddit thread with 100+ comments',
      'Sort comments by Old (chronological) so last comment is at bottom',
      'Use read_page to verify thread loaded and comments section visible',
      'Scan for and click all visible load-more-comments buttons to expand hidden chains',
      'Scroll down through comment section to load more comments',
      'After each scroll: check for new load-more-comments buttons, click any found',
      'Repeat scroll-and-expand until no more load-more buttons exist and page bottom reached',
      'Identify the last visible comment element in DOM order (final shreddit-comment or div.comment)',
      'Extract last comment text, author, and timestamp',
      'Click the reply button on the last comment',
      'If reply text area appears: type reply text (do NOT submit)',
      'If login modal appears: document as SKIP-AUTH',
      'Verify: thread scrolled to bottom, last comment identified, reply mechanism tested'
    ],
    expandAllComments: [
      'Navigate to thread and sort by desired order',
      'Loop: read_page, find load-more-comments buttons, click each one',
      'Wait 1000-2000ms after each expansion for comments to render',
      'Scroll down to reveal any new load-more buttons below the fold',
      'Repeat until no load-more buttons remain in the DOM'
    ]
  },
  warnings: [
    'Reddit may require account age/karma for posting in some subreddits',
    'Reddit has both old and new UI -- selectors may differ between versions',
    'Reddit threads use load-more-comments expansion buttons, NOT pure infinite scroll -- must click expand buttons to see all comments',
    'New Reddit uses Shreddit web components (shreddit-comment) -- standard CSS selectors may need attribute-based alternatives',
    'Sort by Old to ensure the last comment at the bottom is the chronologically most recent',
    'Replying to comments requires Reddit authentication -- expect SKIP-AUTH outcome for reply portion',
    'Old Reddit (old.reddit.com) has simpler DOM structure and may be easier for automation',
    'Do NOT actually submit replies during testing -- only verify the reply text area is functional'
  ],
  toolPreferences: ['click', 'type', 'scroll', 'scroll_to_bottom', 'getText', 'waitForElement', 'waitForDOMStable', 'navigate', 'read_page', 'get_dom_snapshot', 'type_text']
});
