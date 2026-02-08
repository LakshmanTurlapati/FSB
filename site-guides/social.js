/**
 * Site Guide: Social Media
 * Covers LinkedIn, Twitter/X, Facebook, Instagram, Reddit, YouTube
 */

const SOCIAL_GUIDE = {
  name: 'Social Media',

  patterns: [
    /linkedin\.com/i,
    /(twitter\.com|x\.com)/i,
    /facebook\.com/i,
    /instagram\.com/i,
    /reddit\.com/i,
    /threads\.net/i,
    /mastodon\.\w+/i,
    /bsky\.app/i,
    /tiktok\.com/i,
    /youtube\.com/i
  ],

  guidance: `SOCIAL MEDIA NAVIGATION INTELLIGENCE:

CONTENT INTERACTION:
1. POSTING/COMPOSING: Find the compose area first. Most platforms have a "What's on your mind?", "Start a post", or compose button. Click it to open the editor, then type content.
2. MESSAGING: Navigate to the messaging section. Click on a conversation or "New Message". Type the recipient first, then the message body, then send.
3. COMMENTING: Scroll to find the comment input below a post. Click the input area, type the comment, then press Enter or click the Post/Reply button.

PROFILE NAVIGATION:
- LinkedIn: Use the search bar or click profile links in the feed
- Twitter/X: Use search or @username in the URL
- Facebook: Use search bar or direct URL
- Reddit: Navigate via r/subreddit or u/username

FEED INTERACTION:
- Like/React: Find the like/heart button below the post
- Share/Retweet: Find the share/retweet button
- Save/Bookmark: Usually accessible via a menu or bookmark icon

CONTENT READING:
- Scroll through the feed to load more posts
- Click on a post to expand it and see full content
- For threads (Twitter/Reddit), click to see all replies

SEARCH:
- Each platform has different search behavior
- LinkedIn search has filters (People, Jobs, Posts, Companies)
- Twitter/X search supports operators (from:, to:, since:)
- Reddit search works better within specific subreddits

LINKEDIN-SPECIFIC INTELLIGENCE:

IMPORTANT -- LinkedIn has TWO different UI systems:
1. LEGACY pages (Feed, Messaging, Notifications): Uses Ember.js framework with #ember<N> IDs (dynamic, unreliable) and .global-nav__* classes (stable).
2. REDESIGNED pages (My Network/Grow, Jobs): Uses hashed CSS classes (_5b06d96c, _9954a25d) -- NEVER use these. Use aria-label and XPath normalize-space() selectors instead.

SELECTOR RULES:
- NEVER use #ember<N> IDs -- they change on every page load
- NEVER use hashed CSS classes (underscore + hex like _5b06d96c) -- they change on builds
- ALWAYS prefer aria-label selectors and XPath normalize-space() patterns
- data-testid selectors are stable when available
- .global-nav__* and .msg-* classes are stable on legacy pages

GLOBAL NAVIGATION (stable across all LinkedIn pages):
- Search box: [aria-label="I'm looking for..."] or [role="combobox"]
- Home: //a[normalize-space(.)="Home"]
- My Network: //a[normalize-space(.)="My Network"]
- Jobs: //a[normalize-space(.)="Jobs"]
- Messaging: //a[normalize-space(.)="Messaging"]
- Notifications: //a[normalize-space(.)="Notifications"]
- Learning: //a[normalize-space(.)="Learning"]
- Me menu: .global-nav__primary-link-me-menu-trigger
- For Business: //button[normalize-space(.)="For Business"]

FEED PAGE INTERACTIONS:
- Start a post: //button[normalize-space(.)="Start a post"]
- Post text area: .ql-editor[data-placeholder]
- Post/publish button: .share-actions__primary-action
- Like/React: [aria-label="React Like"]
- Comment: //button[normalize-space(.)="Comment"]
- Repost: //button[normalize-space(.)="Repost"]
- Send via DM: [aria-label="Send in a private message"]
- Post menu: [aria-label="Open control menu for post by <Name>"] (replace <Name>)
- See more text: [aria-label*="see more"]
- Sort feed: //button[contains(normalize-space(.),"Sort by:")]
- Reply to comment: [aria-label*="Reply to"] (pattern)
- Load more comments: //button[normalize-space(.)="Load more comments"]

MESSAGING -- FULL PAGE (/messaging):
- Search conversations: #search-conversations or [name="searchTerm"]
- Message input: .msg-form__contenteditable
- Send message: .msg-form__send-button or //button[normalize-space(.)="Send"]
- Compose new: //button[normalize-space(.)="Compose a new message"]
- Filter tabs: //button[normalize-space(.)="Focused"], //button[normalize-space(.)="Unread"], //button[normalize-space(.)="Connections"], //button[normalize-space(.)="InMail"], //button[normalize-space(.)="Starred"]
- Attachment: [aria-label*="Attach an image"]
- GIF: [aria-label="Open GIF Keyboard"]
- Emoji: text "Open Emoji Keyboard"

MESSAGING -- OVERLAY (mini chat from other pages):
- Open overlay: .msg-overlay-bubble-header__button
- Compose message: //button[normalize-space(.)="Compose message"]

MESSAGING VERIFICATION (CRITICAL):
After clicking the Send button (.msg-form__send-button):
- SUCCESS signals: Input field is CLEARED (empty/contains only newline), Send button becomes DISABLED
- The URL does NOT change after sending -- do NOT wait for a URL change
- The sent message appears in the conversation thread above the input area
- Once you see input cleared + Send button disabled after clicking Send, the message was sent successfully -- mark taskComplete: true immediately
- Do NOT re-type or re-send the message if the input is empty after a Send click -- that means it worked

MY NETWORK / GROW PAGE:
- Search people: [data-testid="typeahead-input"]
- Connections count: [aria-label*="connections"]
- Show all invitations: [aria-label="Show all invitations"]
- Connect with person: [aria-label="Invite <Name> to connect"] (replace <Name>)
- Accept invitation: [aria-label*="Accept"]
- Ignore invitation: [aria-label*="Ignore"]
- Remove suggestion: [aria-label*="Remove"]
- Following & followers: //a[normalize-space(.)="Following & followers"]
- Groups: //a[contains(normalize-space(.),"Groups")]
- Pages: //a[contains(normalize-space(.),"Pages")]

JOBS PAGE:
- Post a free job: //a[normalize-space(.)="Post a free job"]
- Premium: //a[normalize-space(.)="Premium"]
- Preferences: //a[normalize-space(.)="Preferences"]
- My jobs: //a[normalize-space(.)="My jobs"]
- My Career Insights: //a[normalize-space(.)="My Career Insights"]
- Carousel next/prev: [aria-label="Next"], [aria-label="Previous"]
- Dismiss job: [aria-label*="Dismiss"]

SIDEBAR (Feed page):
- Write article: [aria-label="Write an article on LinkedIn"]
- Saved items: //a[normalize-space(.)="Saved items"]
- Groups: //a[normalize-space(.)="Groups"]
- Events: //a[normalize-space(.)="Events"]
- Newsletters: //a[normalize-space(.)="Newsletters"]

YOUTUBE-SPECIFIC INTELLIGENCE:

SEARCH:
- Search box: [role="combobox"] (class ytSearchboxComponentInput). Autocomplete appears as you type.
- Search submit: [aria-label="Search"] or .ytSearchboxComponentSearchButton
- Voice search: [aria-label="Search with your voice"]

MASTHEAD (TOP BAR):
- Create button: [aria-label="Create"]
- Guide/sidebar toggle: [aria-label="Guide"]
- Notifications: [aria-label="Notifications"]
- Account menu: [aria-label="Account menu"] or #avatar-btn
- YouTube logo: #logo

SIDEBAR NAVIGATION:
- Home, Shorts, Subscriptions: all [role="link"] with text matching (e.g. //a[normalize-space(.)="Home"])
- Library sections: History, Playlists, Liked videos, Your videos, Watch later -- all sidebar links

HOMEPAGE:
- Category filter chips: [role="tab"] buttons (All, Music, Podcasts, Gaming, etc.)
- Video titles: .yt-lockup-metadata-view-model__title (homepage) or #video-title (watch/channel pages)
- Channel avatars: [aria-label="Go to channel <Name>"] with [role="button"]

WATCH PAGE:
- Subscribe button: //button[normalize-space(.)="Subscribe"] or //button[normalize-space(.)="Subscribed"]
- Description expand: .yt-truncated-text__absolute-button (text "...more")
- Join channel: [aria-label="Join this channel"]
- Captions: [aria-label="Subtitles/CC turned on"]

SHORTS:
- Shorts have a different UI with custom controls
- Mute/unmute: [aria-label="Unmute"] / [aria-label="Mute"]

UI FRAMEWORK NOTES:
- YouTube uses custom web components (ytd-*, tp-yt-paper-item) -- standard CSS selectors may not work
- Prefer aria-label selectors over class names
- Category filter chips are personalized based on watch history
- Comments section loads lazily -- scroll down to trigger loading
- Video player is HTML5 but controls are custom overlays

X/TWITTER-SPECIFIC INTELLIGENCE:

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

PROFILE ACTIONS:
- Edit profile: [data-testid="editProfileButton"]
- User actions menu: [data-testid="userActions"]
- Follow: [aria-label="Follow @username"] (dynamic pattern with username)

FEED ITEMS:
- Individual tweet: [data-testid="tweet"]
- Trending item: [data-testid="trend"]
- Settings bar: [data-testid="settingsAppBar"]
- Back button: [data-testid="app-bar-back"]
- Close button: [data-testid="app-bar-close"]

UI FRAMEWORK NOTES (X/Twitter):
- CSS class names are hashed/obfuscated (css-175oi2r, r-sdzlij) -- NEVER use them as selectors
- ID-based selectors are dynamically generated (id__<random>) -- do NOT rely on them
- Prefer data-testid selectors over aria-label for consistency
- Navigation uses AppTabBar data-testid pattern -- more reliable than aria-label which can include notification counts`,

  selectors: {
    linkedin: {
      // Global Navigation
      searchBox: '[aria-label="I\'m looking for..."], [role="combobox"]',
      navHome: '//a[normalize-space(.)="Home"]',
      navMyNetwork: '//a[normalize-space(.)="My Network"]',
      navJobs: '//a[normalize-space(.)="Jobs"]',
      navMessaging: '//a[normalize-space(.)="Messaging"]',
      navNotifications: '//a[normalize-space(.)="Notifications"]',
      navLearning: '//a[normalize-space(.)="Learning"]',
      navMe: '.global-nav__primary-link-me-menu-trigger',
      navBusiness: '//button[normalize-space(.)="For Business"]',

      // Feed Page
      postCompose: '//button[normalize-space(.)="Start a post"]',
      postTextArea: '.ql-editor[data-placeholder]',
      postButton: '.share-actions__primary-action',
      feedLike: '[aria-label="React Like"]',
      feedComment: '//button[normalize-space(.)="Comment"]',
      feedRepost: '//button[normalize-space(.)="Repost"]',
      feedSendDM: '[aria-label="Send in a private message"]',
      feedSeeMore: '[aria-label*="see more"]',
      feedSortBy: '//button[contains(normalize-space(.),"Sort by:")]',
      feedReplyTo: '[aria-label*="Reply to"]',
      feedLoadMoreComments: '//button[normalize-space(.)="Load more comments"]',

      // Messaging - Full Page
      messageSearchConversations: '#search-conversations, [name="searchTerm"]',
      messageInput: '.msg-form__contenteditable',
      messageSend: '.msg-form__send-button',
      messageCompose: '//button[normalize-space(.)="Compose a new message"]',
      messageFilterFocused: '//button[normalize-space(.)="Focused"]',
      messageFilterUnread: '//button[normalize-space(.)="Unread"]',
      messageFilterConnections: '//button[normalize-space(.)="Connections"]',
      messageFilterInMail: '//button[normalize-space(.)="InMail"]',
      messageFilterStarred: '//button[normalize-space(.)="Starred"]',
      messageAttachment: '[aria-label*="Attach an image"]',
      messageGif: '[aria-label="Open GIF Keyboard"]',

      // Messaging - Overlay
      messageOverlayOpen: '.msg-overlay-bubble-header__button',
      messageOverlayCompose: '//button[normalize-space(.)="Compose message"]',

      // My Network / Grow
      networkSearchPeople: '[data-testid="typeahead-input"]',
      networkConnectionsCount: '[aria-label*="connections"]',
      networkShowInvitations: '[aria-label="Show all invitations"]',
      networkFollowingFollowers: '//a[normalize-space(.)="Following & followers"]',
      networkGroups: '//a[contains(normalize-space(.),"Groups")]',
      networkPages: '//a[contains(normalize-space(.),"Pages")]',

      // Jobs
      jobsPostFree: '//a[normalize-space(.)="Post a free job"]',
      jobsPremium: '//a[normalize-space(.)="Premium"]',
      jobsPreferences: '//a[normalize-space(.)="Preferences"]',
      jobsMyJobs: '//a[normalize-space(.)="My jobs"]',
      jobsCareerInsights: '//a[normalize-space(.)="My Career Insights"]',
      jobsCarouselNext: '[aria-label="Next"]',
      jobsCarouselPrev: '[aria-label="Previous"]',

      // Sidebar
      sidebarWriteArticle: '[aria-label="Write an article on LinkedIn"]',
      sidebarSavedItems: '//a[normalize-space(.)="Saved items"]',
      sidebarGroups: '//a[normalize-space(.)="Groups"]',
      sidebarEvents: '//a[normalize-space(.)="Events"]',
      sidebarNewsletters: '//a[normalize-space(.)="Newsletters"]'
    },
    twitter: {
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
    facebook: {
      searchBox: 'input[type="search"]',
      postCompose: '[aria-label="Create a post"]',
      postTextArea: '[aria-label="What\'s on your mind?"]',
      commentInput: '[aria-label="Write a comment"]',
      likeButton: '[aria-label="Like"]',
      shareButton: '[aria-label="Share"]',
      messengerInput: '[aria-label="Message"]'
    },
    reddit: {
      searchBox: '#search-input input, input[name="q"]',
      postTitle: '[placeholder="Title"]',
      postBody: '.public-DraftEditor-content',
      commentInput: '[data-testid="comment-compose-area"]',
      submitButton: 'button[type="submit"]',
      upvote: '[aria-label="upvote"]',
      downvote: '[aria-label="downvote"]'
    },
    instagram: {
      searchBox: 'input[aria-label="Search input"]',
      likeButton: '[aria-label="Like"]',
      commentInput: 'textarea[aria-label="Add a comment..."]',
      postButton: 'button:has-text("Post")'
    },
    youtube: {
      searchBox: '[role="combobox"]',
      searchButton: '[aria-label="Search"]',
      voiceSearch: '[aria-label="Search with your voice"]',
      createButton: '[aria-label="Create"]',
      guideToggle: '[aria-label="Guide"]',
      notifications: '[aria-label="Notifications"]',
      accountMenu: '#avatar-btn',
      logo: '#logo',
      videoTitle: '#video-title, .yt-lockup-metadata-view-model__title',
      subscribeButton: '//button[normalize-space(.)="Subscribe"]',
      subscribedButton: '//button[normalize-space(.)="Subscribed"]',
      descriptionExpand: '.yt-truncated-text__absolute-button',
      joinChannel: '[aria-label="Join this channel"]',
      categoryChips: '[role="tab"]',
      captionsButton: '[aria-label="Subtitles/CC turned on"]',
      muteButton: '[aria-label="Mute"]',
      unmuteButton: '[aria-label="Unmute"]'
    }
  },

  workflows: {
    sendMessage: [
      'Navigate to messaging section',
      'Open new message or find existing conversation',
      'Type the recipient name and select from suggestions',
      'Type the message in the message input',
      'Click Send button',
      'Verify message was sent'
    ],
    createPost: [
      'Click compose/create post button',
      'Wait for editor to load',
      'Type the post content',
      'Add media if requested',
      'Click Post/Publish button',
      'Verify post was created'
    ],
    connectOrFollow: [
      'Navigate to the target profile',
      'Find the Connect/Follow button',
      'Click Connect/Follow',
      'Add a note if applicable (LinkedIn)',
      'Confirm the action was successful'
    ],
    searchVideo: [
      'Click the search box [role="combobox"]',
      'Type the search query',
      'Click [aria-label="Search"] or press Enter',
      'Wait for results to load',
      'Click on the desired video title from results'
    ],
    watchVideo: [
      'Navigate to the video URL or search for it',
      'Wait for the video player to load',
      'Video will autoplay -- report the video title and channel'
    ],
    subscribeToChannel: [
      'Navigate to the channel page or a video by the channel',
      'Find the Subscribe button (//button[normalize-space(.)="Subscribe"])',
      'Click Subscribe',
      'Verify button changes to "Subscribed"'
    ],
    browseHome: [
      'Navigate to youtube.com',
      'Optionally click a category chip [role="tab"] to filter',
      'Scroll the feed to load more videos',
      'Click on a video title to watch'
    ],
    searchPeople: [
      'Click the search box [aria-label="I\'m looking for..."]',
      'Type the person name and press Enter',
      'Click the "People" filter to narrow results',
      'Find the target person in results',
      'Click "Connect" button [aria-label="Invite <Name> to connect"]',
      'Optionally add a note in the connect dialog',
      'Click Send to confirm connection request'
    ],
    sendLinkedInMessage: [
      'Click Messaging in nav: //a[normalize-space(.)="Messaging"]',
      'Click "Compose a new message": //button[normalize-space(.)="Compose a new message"]',
      'Type the recipient name in the To field and select from suggestions',
      'Click the message input: .msg-form__contenteditable',
      'Type the message content',
      'Click Send: .msg-form__send-button',
      'VERIFY: If message input is now EMPTY and Send button is DISABLED, the message was sent -- mark taskComplete: true immediately',
      'Do NOT re-type the message if input is empty after clicking Send -- that means success'
    ],
    browseJobs: [
      'Click Jobs in nav: //a[normalize-space(.)="Jobs"]',
      'Use the search box to search for job titles or companies',
      'Browse recommended jobs or use carousel [aria-label="Next"]',
      'Click on a job card to see details',
      'Click "Easy Apply" or "Apply" on the job detail page'
    ],
    createLinkedInPost: [
      'Click "Start a post": //button[normalize-space(.)="Start a post"]',
      'Wait for the post editor modal to appear',
      'Click the text area: .ql-editor[data-placeholder]',
      'Type the post content',
      'Click the Post button: .share-actions__primary-action',
      'Verify post was created by checking feed'
    ]
  },

  warnings: [
    'LinkedIn has TWO UI systems: legacy Ember.js pages (Feed, Messaging) and redesigned pages (My Network, Jobs) -- selector strategies differ',
    'NEVER use #ember<N> IDs on LinkedIn -- they are dynamically generated by Ember.js and change on every page load',
    'NEVER use hashed CSS classes on LinkedIn redesigned pages (e.g. _5b06d96c, _9954a25d) -- they change between builds',
    'On LinkedIn redesigned pages, use aria-label selectors and XPath normalize-space() patterns for stability',
    'LinkedIn may prompt for premium features -- skip unless user has premium',
    'LinkedIn Premium feature gates may block InMail, advanced search filters, and profile views -- check before attempting',
    'Twitter/X rate-limits actions -- avoid rapid clicking',
    'Facebook may show login walls for non-logged-in users',
    'Instagram has limited web functionality compared to the app',
    'Reddit may require account age/karma for posting in some subreddits',
    'Message sending on LinkedIn is limited to 1st-degree connections unless user has Premium/InMail credits',
    'YouTube uses custom web components (ytd-*, tp-yt-paper-item) -- prefer aria-label selectors over CSS classes',
    'YouTube category filter chips change based on watch history -- content is personalized',
    'Shorts have a different UI -- mute/caption buttons use custom classes',
    'YouTube video player is HTML5 but controls are custom overlays -- use aria-label selectors',
    'YouTube comments section loads lazily -- scroll down to trigger loading',
    'Do NOT rely on Tailwind-like utility classes on YouTube -- use aria-labels and data attributes',
    'X/Twitter now has Grok AI integration for post enhancement via [data-testid="grokImgGen"]',
    'X/Twitter navigation uses AppTabBar data-testid pattern -- more reliable than aria-label which can include notification counts',
    'CSS class names on X/Twitter are hashed/obfuscated (css-175oi2r, r-sdzlij) -- never use them as selectors',
    'ID-based selectors on X/Twitter are dynamically generated (id__<random>) -- do not rely on them',
    'Prefer data-testid selectors over aria-label on X/Twitter for consistency',
    'Account menu on X/Twitter shows username text but use [data-testid="SideNav_AccountSwitcher_Button"] to target it',
    'LinkedIn CLEARS the message input and DISABLES the Send button after a successful send -- if you see empty input + disabled Send after clicking Send, the message WAS sent, do NOT re-type or re-send'
  ],

  toolPreferences: ['click', 'type', 'scroll', 'getText', 'waitForElement', 'hover', 'focus', 'pressEnter', 'navigate', 'scrollToElement']
};

// Domain alias: x.com extracts as "x" but selectors are keyed under "twitter"
SOCIAL_GUIDE.selectors.x = SOCIAL_GUIDE.selectors.twitter;

registerSiteGuide(SOCIAL_GUIDE);
