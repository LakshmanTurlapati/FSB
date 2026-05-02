/**
 * Site Guide: Instagram
 * Per-site guide for Instagram social media platform.
 */

registerSiteGuide({
  site: 'Instagram',
  category: 'Social Media',
  patterns: [
    /instagram\.com/i
  ],
  guidance: `INSTAGRAM-SPECIFIC INTELLIGENCE:

COMMON PATTERNS:
  # search for a user
  click e5    # search input
  type e5 "username"
  click e10   # search result
  # interact with a post
  scroll down
  click e15   # Like button
  click e18   # comment input
  type e18 "nice photo!"

Instagram is a photo and video sharing platform with limited web functionality compared to the mobile app.

SEARCH & NAVIGATION:
- Search input: input[aria-label="Search input"]
- Like button: [aria-label="Like"]
- Comment input: textarea[aria-label="Add a comment..."]

IMPORTANT NOTES:
- Instagram web has limited functionality compared to the mobile app
- Direct Messages (DMs) may not be fully accessible on web
- Story viewing and creation may be limited on web
- Reels have a different UI from regular feed posts`,
  selectors: {
    searchBox: 'input[aria-label="Search input"]',
    likeButton: '[aria-label="Like"]',
    commentInput: 'textarea[aria-label="Add a comment..."]',
    postButton: 'button:has-text("Post")'
  },
  workflows: {
    commentOnPost: [
      'Navigate to the post',
      'Click the comment input area',
      'Type the comment',
      'Click the Post button or press Enter',
      'Verify comment was posted'
    ]
  },
  warnings: [
    'Instagram has limited web functionality compared to the app',
    'Direct messaging may not be fully accessible on web'
  ],
  toolPreferences: ['click', 'type', 'scroll', 'getText', 'waitForElement', 'navigate']
});
