/**
 * Site Guide: Twitter/X
 * Per-site guide for Twitter (X) social media platform.
 */

registerSiteGuide({
  site: 'Twitter/X',
  category: 'Social Media',
  patterns: [
    /(twitter\.com|x\.com)/i
  ],
  guidance: `X/TWITTER-SPECIFIC INTELLIGENCE:

COMMON PATTERNS:
  # compose and post
  click e5    # compose area
  type e5 "post content here"
  click e10   # Post button
  # search for a topic
  click e15   # Explore tab
  type e18 "trending topic"
  enter
  scroll down

SEARCH:
- Search query box: [aria-label="Search query"] or [role="combobox"] (on Explore page)
- Search page input: [data-testid="SearchBox_Search_Input"]
- Explore tab: [data-testid="AppTabBar_Explore_Link"] or [aria-label="Search and explore"]

COMPOSING POSTS:
- Post text area: [data-testid="tweetTextarea_0"]
- Post/Tweet button (inline): [data-testid="tweetButtonInline"]
- New post button (sidebar): [data-testid="SideNav_NewTweet_Button"] or [aria-label="Post"]
- Schedule post: [data-testid="scheduleOption"] or [aria-label="Schedule post"]
- Grok AI enhancement: [data-testid="grokImgGen"] or [aria-label="Enhance your post with Grok"]
- Add GIF: [data-testid="gifSearchButton"]
- Add poll: [data-testid="createPollButton"]

NAVIGATION TABS:
- Home: [data-testid="AppTabBar_Home_Link"]
- Explore: [data-testid="AppTabBar_Explore_Link"]
- Notifications: [data-testid="AppTabBar_Notifications_Link"]
- Messages: [data-testid="AppTabBar_DirectMessage_Link"]
- Profile: [data-testid="AppTabBar_Profile_Link"]
- More menu: [data-testid="AppTabBar_More_Menu"]

ACCOUNT & SETTINGS:
- Account switcher: [data-testid="SideNav_AccountSwitcher_Button"]
- Grok nav: [aria-label="Grok"]
- Bookmarks: [aria-label="Bookmarks"]
- Premium signup: [data-testid="premium-signup-tab"]

UI FRAMEWORK NOTES:
- CSS class names are hashed/obfuscated (css-175oi2r, r-sdzlij) -- NEVER use them as selectors
- ID-based selectors are dynamically generated (id__<random>) -- do NOT rely on them
- Prefer data-testid selectors over aria-label for consistency
- Navigation uses AppTabBar data-testid pattern -- more reliable than aria-label which can include notification counts`,
  selectors: {
    searchBox: 'input[data-testid="SearchBox_Search_Input"]',
    tweetCompose: '[data-testid="tweetTextarea_0"]',
    tweetButton: '[data-testid="tweetButtonInline"]',
    replyInput: '[data-testid="tweetTextarea_0"]',
    replyButton: '[data-testid="tweetButton"]',
    likeButton: '[data-testid="like"]',
    retweetButton: '[data-testid="retweet"]',
    dmButton: '[data-testid="sendDMFromProfile"]',
    feed: '[data-testid="primaryColumn"]',
    homeTab: '[data-testid="AppTabBar_Home_Link"]',
    exploreTab: '[data-testid="AppTabBar_Explore_Link"]',
    notificationsTab: '[data-testid="AppTabBar_Notifications_Link"]',
    messagesTab: '[data-testid="AppTabBar_DirectMessage_Link"]',
    profileTab: '[data-testid="AppTabBar_Profile_Link"]',
    postButton: '[data-testid="SideNav_NewTweet_Button"]',
    accountMenu: '[data-testid="SideNav_AccountSwitcher_Button"]',
    moreMenu: '[data-testid="AppTabBar_More_Menu"]',
    schedulePost: '[data-testid="scheduleOption"]',
    grokButton: '[data-testid="grokImgGen"]',
    gifButton: '[data-testid="gifSearchButton"]',
    pollButton: '[data-testid="createPollButton"]',
    editProfile: '[data-testid="editProfileButton"]',
    tweetItem: '[data-testid="tweet"]',
    trendItem: '[data-testid="trend"]',
    settingsBar: '[data-testid="settingsAppBar"]',
    backButton: '[data-testid="app-bar-back"]',
    closeButton: '[data-testid="app-bar-close"]'
  },
  workflows: {
    createPost: [
      'Click the compose area or new post button',
      'Wait for editor to load',
      'Type the post content in [data-testid="tweetTextarea_0"]',
      'Click the Post button [data-testid="tweetButtonInline"]',
      'Verify post was created'
    ],
    sendMessage: [
      'Click Messages tab [data-testid="AppTabBar_DirectMessage_Link"]',
      'Open new message or find existing conversation',
      'Type the recipient name and select from suggestions',
      'Type the message in the message input',
      'Click Send button',
      'Verify message was sent'
    ]
  },
  warnings: [
    'Twitter/X rate-limits actions -- avoid rapid clicking',
    'X/Twitter now has Grok AI integration for post enhancement via [data-testid="grokImgGen"]',
    'X/Twitter navigation uses AppTabBar data-testid pattern -- more reliable than aria-label which can include notification counts',
    'CSS class names on X/Twitter are hashed/obfuscated (css-175oi2r, r-sdzlij) -- never use them as selectors',
    'ID-based selectors on X/Twitter are dynamically generated (id__<random>) -- do not rely on them',
    'Prefer data-testid selectors over aria-label on X/Twitter for consistency',
    'Account menu on X/Twitter shows username text but use [data-testid="SideNav_AccountSwitcher_Button"] to target it'
  ],
  toolPreferences: ['click', 'type', 'scroll', 'getText', 'waitForElement', 'hover', 'focus', 'pressEnter', 'navigate']
});
