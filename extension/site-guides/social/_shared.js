/**
 * Shared Category Guidance: Social Media
 * Category-level guidance that applies to all social media sites.
 */

registerCategoryGuidance({
  category: 'Social Media',
  icon: 'fa-comments',
  guidance: `SOCIAL MEDIA NAVIGATION INTELLIGENCE:

CONTENT INTERACTION:
1. POSTING/COMPOSING: Find the compose area first. Most platforms have a "What's on your mind?", "Start a post", or compose button. Click it to open the editor, then type content.
2. MESSAGING: Navigate to the messaging section. Click on a conversation or "New Message". Type the recipient first, then the message body, then send.
3. COMMENTING: Scroll to find the comment input below a post. Click the input area, type the comment, then press Enter or click the Post/Reply button.

AUTH-WALL HANDOFF:
- Posting, messaging, and commenting commonly require login even when reading or discovery works without it.
- If useful work is already complete and the final interaction is blocked by login, missing credentials, skipped login, credential failure, or manual approval/MFA, end with partial_task rather than a generic failure.
- Preserve a manual handoff with three things: what discovery or drafting work you already completed, the exact auth blocker, and the next step the user should take after logging in or approving access.
- If the runtime offers one saved-credential or operator-prompt attempt, let that happen first. If it is unavailable, skipped, or fails, preserve the blocker details and stop cleanly.

PROFILE NAVIGATION:
- Use the search bar or click profile links in the feed
- Use search or direct URLs to find profiles
- Navigate via subreddit or username patterns where applicable

FEED INTERACTION:
- Like/React: Find the like/heart button below the post
- Share/Retweet: Find the share/retweet button
- Save/Bookmark: Usually accessible via a menu or bookmark icon

CONTENT READING:
- Scroll through the feed to load more posts
- Click on a post to expand it and see full content
- For threads, click to see all replies

SEARCH:
- Each platform has different search behavior and operators
- Use platform-specific filters where available (People, Posts, Companies, etc.)
- Search may work better within specific sections or communities`,
  warnings: [
    'Most social platforms require login for full functionality',
    'Rate-limiting may occur with rapid actions',
    'Platform UI changes frequently -- prefer aria-label and data-testid selectors over CSS classes'
  ]
});
