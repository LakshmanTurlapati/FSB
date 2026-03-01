/**
 * Site Guide: Facebook
 * Per-site guide for Facebook social media platform.
 */

registerSiteGuide({
  site: 'Facebook',
  category: 'Social Media',
  patterns: [
    /facebook\.com/i
  ],
  guidance: `FACEBOOK-SPECIFIC INTELLIGENCE:

COMMON PATTERNS:
  # create a post
  click e5    # create a post area
  type e8 "post content here"
  click e12   # Post button
  # search for someone
  click e15   # search box
  type e15 "friend name"
  enter
  click e20   # result profile

Facebook is a social networking platform for connecting with friends, family, and communities.

SEARCH & NAVIGATION:
- Search box: input[type="search"]
- Create post: [aria-label="Create a post"]
- Post text area: [aria-label="What's on your mind?"]
- Comment input: [aria-label="Write a comment"]
- Like button: [aria-label="Like"]
- Share button: [aria-label="Share"]
- Messenger input: [aria-label="Message"]

IMPORTANT NOTES:
- Facebook uses dynamic React components -- prefer aria-label selectors
- Groups and Pages have distinct UI patterns from the main feed
- Marketplace has its own navigation and listing format`,
  selectors: {
    searchBox: 'input[type="search"]',
    postCompose: '[aria-label="Create a post"]',
    postTextArea: '[aria-label="What\'s on your mind?"]',
    commentInput: '[aria-label="Write a comment"]',
    likeButton: '[aria-label="Like"]',
    shareButton: '[aria-label="Share"]',
    messengerInput: '[aria-label="Message"]'
  },
  workflows: {
    createPost: [
      'Click "Create a post" area',
      'Wait for editor to load',
      'Type the post content',
      'Add media if requested',
      'Click Post/Publish button',
      'Verify post was created'
    ],
    sendMessage: [
      'Navigate to Messenger or click message icon',
      'Open new message or find existing conversation',
      'Type the recipient name and select from suggestions',
      'Type the message in the message input',
      'Click Send button',
      'Verify message was sent'
    ]
  },
  warnings: [
    'Facebook may show login walls for non-logged-in users',
    'Facebook uses React with dynamically generated class names -- prefer aria-label selectors'
  ],
  toolPreferences: ['click', 'type', 'scroll', 'getText', 'waitForElement', 'hover', 'navigate']
});
