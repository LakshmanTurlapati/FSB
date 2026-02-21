/**
 * Site Guide: Reddit
 * Per-site guide for Reddit community discussion platform.
 */

registerSiteGuide({
  site: 'Reddit',
  category: 'Social Media',
  patterns: [
    /reddit\.com/i
  ],
  guidance: `REDDIT-SPECIFIC INTELLIGENCE:

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
- Karma requirements may limit actions for new accounts`,
  selectors: {
    searchBox: '#search-input input, input[name="q"]',
    postTitle: '[placeholder="Title"]',
    postBody: '.public-DraftEditor-content',
    commentInput: '[data-testid="comment-compose-area"]',
    submitButton: 'button[type="submit"]',
    upvote: '[aria-label="upvote"]',
    downvote: '[aria-label="downvote"]'
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
    ]
  },
  warnings: [
    'Reddit may require account age/karma for posting in some subreddits',
    'Reddit has both old and new UI -- selectors may differ between versions'
  ],
  toolPreferences: ['click', 'type', 'scroll', 'getText', 'waitForElement', 'navigate']
});
