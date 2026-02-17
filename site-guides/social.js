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
- Notifications: //a[contains(normalize-space(.),"Notifications")] (NOTE: text includes notification count like "3 new notifications" -- use contains() not exact match)
- Learning: //a[normalize-space(.)="Learning"]
- Me menu: .global-nav__primary-link-me-menu-trigger
- For Business: //button[normalize-space(.)="For Business"]

FEED PAGE INTERACTIONS:
- Start a post: //button[normalize-space(.)="Start a post"]
- Add a photo: [aria-label="Add a photo"]
- Add a video: [aria-label="Add a video"]
- Post text area: .ql-editor[data-placeholder]
- Post/publish button: .share-actions__primary-action
- Like/React: [aria-label="React Like"]
- Comment: [aria-label="Comment"]
- Repost: //button[normalize-space(.)="Repost"] (dropdown trigger -- expands to repost options)
- Send via DM: [aria-label="Send in a private message"]
- Post menu: [aria-label="Open control menu for post by <Name>"] (replace <Name>)
- Dismiss post: [aria-label="Dismiss post by <Name>"] (replace <Name>)
- See more text: [aria-label*="see more"]
- Sort feed: //button[contains(normalize-space(.),"Sort by:")] -- text shows "Sort by:\nTop" or "Sort by:\nRecent"
- Reply to comment: [aria-label*="Reply to"] (pattern)
- Load more comments: //button[normalize-space(.)="Load more comments"]
- Reactions count: [aria-label="<Name> and N others"] (click to see who reacted)
- Comments count: [aria-label="N comments on <Name>'s post"] (click to expand comments)
- Reposts count: [aria-label="N reposts of <Name>'s post"] (click to see who reposted)

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

PROFILE PAGE (viewing any profile -- /in/<username>):
- Profile header contains: name, headline, location, connection degree, mutual connections
- Profile photo: .pv-top-card-profile-picture img, [aria-label*="profile photo"]
- Name: .text-heading-xlarge, h1
- Headline: .text-body-medium (first one under name)
- Location: .text-body-small (contains city/region text)
- Connection count: //a[contains(normalize-space(.),"connections")]
- About section: #about ~ .display-flex, section[id="about"]
- Experience section: #experience ~ .display-flex, section[id="experience"]
- Education section: #education ~ .display-flex, section[id="education"]
- Skills section: #skills ~ .display-flex, section[id="skills"]
- Activity section: section[id="recent-activity"]
- Recommendations section: section[id="recommendations"]
- "See more" within sections: //button[normalize-space(.)="Show all experiences"], //button[normalize-space(.)="Show all education"]
- More actions: //button[normalize-space(.)="More"]
- Connect button (on profile): //button[normalize-space(.)="Connect"]
- Follow button (on profile): //button[normalize-space(.)="Follow"]
- Message button (on profile): //button[normalize-space(.)="Message"]
- Pending invitation: //button[normalize-space(.)="Pending"]

CONNECTION REQUEST WITH NOTE:
- After clicking Connect, a modal may appear asking "How do you know <Name>?"
- If "Add a note" button appears: //button[normalize-space(.)="Add a note"]
- Click "Add a note" to expand the note text area
- Note text area: #custom-message, textarea[name="message"]
- Character limit: 300 characters for connection notes
- Click "Send" to send with note: //button[normalize-space(.)="Send"]
- Click "Send without a note" to skip: //button[normalize-space(.)="Send without a note"]

PROFILE EDITING (own profile -- /in/me or your profile URL):
- Edit intro: //button[normalize-space(.)="Edit intro"] or [aria-label="Edit intro"]
- Edit intro modal fields:
  - First name: input[name="firstName"], #firstName
  - Last name: input[name="lastName"], #lastName
  - Headline: input[name="headline"], #headline
  - Current position: input[name="currentPosition"]
  - Industry: input[name="industry"]
  - Location: input[name="countryRegion"], input[name="city"]
  - Save: //button[normalize-space(.)="Save"]
- Add profile section: //button[normalize-space(.)="Add profile section"]
  - Opens dropdown with: Intro, About, Experience, Education, Skills, etc.
- Edit About: pencil/edit icon within the About section, [aria-label*="Edit about"]
- Add Experience: //button[normalize-space(.)="Add position"], [aria-label*="Add position"]
  - Title: input[name="title"]
  - Company: input[name="companyName"]
  - Employment type dropdown: select[name="employmentType"]
  - Start date: select[name="startDateMonth"], select[name="startDateYear"]
  - End date: select[name="endDateMonth"], select[name="endDateYear"]
  - Current role checkbox: input[name="isCurrentRole"]
  - Location: input[name="location"]
  - Description: textarea[name="description"]
  - Save: //button[normalize-space(.)="Save"]
- Add Education: //button[normalize-space(.)="Add education"], [aria-label*="Add education"]
  - School: input[name="school"]
  - Degree: input[name="degree"]
  - Field of study: input[name="fieldOfStudy"]
  - Start year: select[name="startDateYear"]
  - End year: select[name="endDateYear"]
  - Save: //button[normalize-space(.)="Save"]
- Add Skills: //button[normalize-space(.)="Add skill"], [aria-label*="Add skill"]
  - Skill name input: input[name="skill"]
  - Save: //button[normalize-space(.)="Save"]

SEARCH RESULTS FILTERS (after searching via the search bar):
- All results (default): no filter active
- People filter: //button[normalize-space(.)="People"]
- Posts filter: //button[normalize-space(.)="Posts"]
- Companies filter: //button[normalize-space(.)="Companies"]
- Jobs filter: //button[normalize-space(.)="Jobs"]
- Groups filter: //button[normalize-space(.)="Groups"]
- Events filter: //button[normalize-space(.)="Events"]
- Schools filter: //button[normalize-space(.)="Schools"]
- Courses filter: //button[normalize-space(.)="Courses"]
- Services filter: //button[normalize-space(.)="Services"]
- Sub-filters (People results): Connections (1st, 2nd, 3rd+), Locations, Current company, Industry
  - These appear as dropdown buttons below the main filter tabs
  - Pattern: //button[contains(normalize-space(.),"Connections of")]
  - "All filters": //button[normalize-space(.)="All filters"]

NOTIFICATIONS PAGE (/notifications):
- Filter tabs: //button[normalize-space(.)="All"], //button[normalize-space(.)="My posts"]
- Individual notification items: .nt-card, [data-testid="notification-card"]
- Notification actions: [aria-label*="notification actions"], three-dot menu per notification
- Mark as read: in notification actions menu
- Settings: //a[normalize-space(.)="notification settings"] or gear icon

COMPANY PAGES (/company/<name>):
- Company name: h1, .org-top-card-summary__title
- Follow button: //button[normalize-space(.)="Follow"]
- Company tabs: //a[normalize-space(.)="About"], //a[normalize-space(.)="Posts"], //a[normalize-space(.)="Jobs"], //a[normalize-space(.)="People"]
- About section: company description, website, industry, size, headquarters
- Jobs tab: shows open positions at the company
- People tab: shows employees, can search within company
- Company website link: [aria-label*="website"], //a[contains(normalize-space(.),"Visit website")]

LINKEDIN LEARNING (/learning):
- Search courses: input[placeholder*="Search"], [aria-label*="Search for skills"]
- Course card: .learning-card, [data-testid="learning-card"]
- My Learning: //a[normalize-space(.)="My Learning"]
- Course player: video element, .classroom-player
- Course navigation: .classroom-toc-section (table of contents sidebar)
- Next lesson: //button[normalize-space(.)="Next"]
- Complete video: progress tracked automatically on completion

SETTINGS & PRIVACY (/mypreferences):
- Navigate via Me menu > "Settings & Privacy"
- Account preferences: //a[normalize-space(.)="Account preferences"]
- Sign in & security: //a[normalize-space(.)="Sign in & security"]
- Visibility: //a[normalize-space(.)="Visibility"]
- Communications: //a[normalize-space(.)="Communications"]
- Data privacy: //a[normalize-space(.)="Data privacy"]
- Advertising data: //a[normalize-space(.)="Advertising data"]
- Setting items are standard links and toggles -- use aria-label patterns

LINKEDIN ARTICLE EDITOR (/article/edit):
- Article title: [aria-label*="article title"], .article-title-input
- Article body: .ql-editor (same Quill editor as posts but larger)
- Cover image: //button[normalize-space(.)="Upload a cover image"]
- Publish: //button[normalize-space(.)="Publish"]
- Share draft: //button[normalize-space(.)="Share"]
- Formatting toolbar: standard Quill toolbar (bold, italic, headings, lists, links, images)

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
      navNotifications: '[data-fsb-id*="notification"], //a[contains(normalize-space(.),"Notifications")]',
      navLearning: '//a[normalize-space(.)="Learning"]',
      navMe: '.global-nav__primary-link-me-menu-trigger',
      navBusiness: '//button[normalize-space(.)="For Business"]',

      // Feed Page
      postCompose: '//button[normalize-space(.)="Start a post"]',
      postTextArea: '.ql-editor[data-placeholder]',
      postButton: '.share-actions__primary-action',
      feedLike: '[aria-label="React Like"]',
      feedComment: '[aria-label="Comment"], //button[normalize-space(.)="Comment"]',
      feedRepost: '//button[normalize-space(.)="Repost"]',
      feedSendDM: '[aria-label="Send in a private message"]',
      feedSeeMore: '[aria-label*="see more"]',
      feedSortBy: '//button[contains(normalize-space(.),"Sort by:")]',
      feedReplyTo: '[aria-label*="Reply to"]',
      feedLoadMoreComments: '//button[normalize-space(.)="Load more comments"]',
      feedAddPhoto: '[aria-label="Add a photo"]',
      feedAddVideo: '[aria-label="Add a video"]',
      feedDismissPost: '[aria-label*="Dismiss post by"]',
      feedReactionsCount: '[aria-label*="and"][aria-label*="others"]',
      feedCommentsCount: '[aria-label*="comments on"]',
      feedRepostsCount: '[aria-label*="reposts of"]',
      feedPostMenu: '[aria-label*="Open control menu for post by"]',

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
      sidebarNewsletters: '//a[normalize-space(.)="Newsletters"]',

      // Profile Page (viewing)
      profilePhoto: '.pv-top-card-profile-picture img, [aria-label*="profile photo"]',
      profileName: '.text-heading-xlarge, h1',
      profileHeadline: '.text-body-medium',
      profileLocation: '.text-body-small',
      profileConnectionCount: '//a[contains(normalize-space(.),"connections")]',
      profileAbout: 'section[id="about"]',
      profileExperience: 'section[id="experience"]',
      profileEducation: 'section[id="education"]',
      profileSkills: 'section[id="skills"]',
      profileActivity: 'section[id="recent-activity"]',
      profileRecommendations: 'section[id="recommendations"]',
      profileConnect: '//button[normalize-space(.)="Connect"]',
      profileFollow: '//button[normalize-space(.)="Follow"]',
      profileMessage: '//button[normalize-space(.)="Message"]',
      profileMore: '//button[normalize-space(.)="More"]',
      profilePending: '//button[normalize-space(.)="Pending"]',
      profileShowAllExperience: '//button[normalize-space(.)="Show all experiences"]',
      profileShowAllEducation: '//button[normalize-space(.)="Show all education"]',

      // Connection Request Dialog
      connectAddNote: '//button[normalize-space(.)="Add a note"]',
      connectNoteInput: '#custom-message, textarea[name="message"]',
      connectSendWithNote: '//button[normalize-space(.)="Send"]',
      connectSendWithoutNote: '//button[normalize-space(.)="Send without a note"]',

      // Profile Editing
      editIntro: '//button[normalize-space(.)="Edit intro"], [aria-label="Edit intro"]',
      editFirstName: 'input[name="firstName"], #firstName',
      editLastName: 'input[name="lastName"], #lastName',
      editHeadline: 'input[name="headline"], #headline',
      editLocation: 'input[name="countryRegion"], input[name="city"]',
      editSave: '//button[normalize-space(.)="Save"]',
      addProfileSection: '//button[normalize-space(.)="Add profile section"]',
      addPosition: '[aria-label="Add Experience"], //button[normalize-space(.)="Add position"], [aria-label*="Add position"]',
      addEducation: '//button[normalize-space(.)="Add education"], [aria-label*="Add education"]',
      addSkill: '//button[normalize-space(.)="Add skill"], [aria-label*="Add skill"]',
      editAbout: '[aria-label*="Edit about"]',
      positionTitle: 'input[name="title"]',
      positionCompany: 'input[name="companyName"]',
      positionDescription: 'textarea[name="description"]',
      educationSchool: 'input[name="school"]',
      educationDegree: 'input[name="degree"]',
      educationField: 'input[name="fieldOfStudy"]',

      // Search Filters
      searchFilterPeople: '//button[normalize-space(.)="People"]',
      searchFilterPosts: '//button[normalize-space(.)="Posts"]',
      searchFilterCompanies: '//button[normalize-space(.)="Companies"]',
      searchFilterJobs: '//button[normalize-space(.)="Jobs"]',
      searchFilterGroups: '//button[normalize-space(.)="Groups"]',
      searchFilterEvents: '//button[normalize-space(.)="Events"]',
      searchFilterSchools: '//button[normalize-space(.)="Schools"]',
      searchFilterServices: '//button[normalize-space(.)="Services"]',
      searchAllFilters: '//button[normalize-space(.)="All filters"]',

      // Notifications
      notificationsFilterAll: '//button[normalize-space(.)="All"]',
      notificationsFilterMyPosts: '//button[normalize-space(.)="My posts"]',
      notificationCard: '.nt-card, [data-testid="notification-card"]',

      // Company Pages
      companyName: 'h1, .org-top-card-summary__title',
      companyFollow: '//button[normalize-space(.)="Follow"]',
      companyTabAbout: '//a[normalize-space(.)="About"]',
      companyTabPosts: '//a[normalize-space(.)="Posts"]',
      companyTabJobs: '//a[normalize-space(.)="Jobs"]',
      companyTabPeople: '//a[normalize-space(.)="People"]',
      companyWebsite: '[aria-label*="website"], //a[contains(normalize-space(.),"Visit website")]',

      // LinkedIn Learning
      learningSearch: 'input[placeholder*="Search"], [aria-label*="Search for skills"]',
      learningCard: '.learning-card, [data-testid="learning-card"]',
      learningMyLearning: '//a[normalize-space(.)="My Learning"]',
      learningNextLesson: '//button[normalize-space(.)="Next"]',

      // Settings
      settingsAccount: '//a[normalize-space(.)="Account preferences"]',
      settingsSecurity: '//a[normalize-space(.)="Sign in & security"]',
      settingsVisibility: '//a[normalize-space(.)="Visibility"]',
      settingsCommunications: '//a[normalize-space(.)="Communications"]',
      settingsPrivacy: '//a[normalize-space(.)="Data privacy"]',

      // Article Editor
      articleTitle: '[aria-label*="article title"], .article-title-input',
      articleBody: '.ql-editor',
      articleCoverImage: '//button[normalize-space(.)="Upload a cover image"]',
      articlePublish: '//button[normalize-space(.)="Publish"]'
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
    ],
    viewLinkedInProfile: [
      'Search for the person using the search box [aria-label="I\'m looking for..."]',
      'Type the person name and press Enter',
      'Click the "People" filter: //button[normalize-space(.)="People"]',
      'Find the target person in results and click their name',
      'Wait for profile page to load (check for .text-heading-xlarge name element)',
      'Scroll down to view sections: About, Experience, Education, Skills',
      'Use getText on section elements to extract profile information'
    ],
    connectWithNote: [
      'Navigate to the target person\'s profile page',
      'Click Connect: //button[normalize-space(.)="Connect"]',
      'If "Add a note" button appears, click it: //button[normalize-space(.)="Add a note"]',
      'Type the connection note in the text area (max 300 chars): #custom-message',
      'Click Send: //button[normalize-space(.)="Send"]',
      'Verify the button changes to "Pending"'
    ],
    editLinkedInProfile: [
      'Navigate to own profile (click Me menu, then "View Profile")',
      'Click "Edit intro": //button[normalize-space(.)="Edit intro"]',
      'Wait for the edit modal to appear',
      'Modify the desired fields (first name, last name, headline, location)',
      'Click Save: //button[normalize-space(.)="Save"]',
      'Verify changes by reading the updated profile header'
    ],
    addExperience: [
      'Navigate to own profile page',
      'Scroll to Experience section',
      'Click "Add position": //button[normalize-space(.)="Add position"]',
      'Fill in Title: input[name="title"]',
      'Fill in Company: input[name="companyName"]',
      'Select employment type from dropdown',
      'Set start date (month and year dropdowns)',
      'Toggle "I currently work here" if applicable',
      'Set end date if not current',
      'Fill in Location: input[name="location"]',
      'Add Description: textarea[name="description"]',
      'Click Save: //button[normalize-space(.)="Save"]'
    ],
    addEducation: [
      'Navigate to own profile page',
      'Scroll to Education section',
      'Click "Add education": //button[normalize-space(.)="Add education"]',
      'Fill in School: input[name="school"]',
      'Fill in Degree: input[name="degree"]',
      'Fill in Field of Study: input[name="fieldOfStudy"]',
      'Set start and end years from dropdowns',
      'Click Save: //button[normalize-space(.)="Save"]'
    ],
    searchWithFilters: [
      'Click the search box [aria-label="I\'m looking for..."]',
      'Type the search query and press Enter',
      'Click the appropriate filter tab (People, Posts, Companies, Jobs, etc.)',
      'Apply sub-filters if needed (Connections, Locations, Industry)',
      'Use "All filters" for advanced filtering: //button[normalize-space(.)="All filters"]',
      'Scroll results and interact with result items'
    ],
    viewCompanyPage: [
      'Search for the company name in the search box',
      'Click "Companies" filter: //button[normalize-space(.)="Companies"]',
      'Click on the company name from results',
      'Wait for company page to load (check for h1 company name)',
      'Browse tabs: About, Posts, Jobs, People using the tab navigation',
      'Click "Jobs" tab to see open positions: //a[normalize-space(.)="Jobs"]',
      'Click "People" tab to see employees: //a[normalize-space(.)="People"]'
    ],
    checkNotifications: [
      'Click Notifications in nav: //a[normalize-space(.)="Notifications"]',
      'Wait for notifications page to load',
      'Filter by tab: "All" or "My posts"',
      'Scroll to load more notifications',
      'Click on a notification to navigate to the relevant content'
    ],
    writeLinkedInArticle: [
      'Click "Write an article on LinkedIn" from the feed sidebar',
      'Wait for the article editor to load',
      'Click the title area and type the article title',
      'Click the body area (.ql-editor) and type the article content',
      'Use the formatting toolbar for headings, bold, italic, lists',
      'Optionally upload a cover image: //button[normalize-space(.)="Upload a cover image"]',
      'Click Publish: //button[normalize-space(.)="Publish"]',
      'Confirm publication in the dialog'
    ],
    accessSettings: [
      'Click the Me menu: .global-nav__primary-link-me-menu-trigger',
      'Click "Settings & Privacy" from the dropdown',
      'Navigate to the desired settings section (Account, Security, Visibility, etc.)',
      'Toggle or modify settings as needed',
      'Changes save automatically or require clicking Save'
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
    'LinkedIn CLEARS the message input and DISABLES the Send button after a successful send -- if you see empty input + disabled Send after clicking Send, the message WAS sent, do NOT re-type or re-send',
    'LinkedIn profile sections (Experience, Education, Skills) load lazily -- scroll down to trigger rendering before trying to read or interact with them',
    'Connection request notes are limited to 300 characters -- keep notes concise',
    'The "Connect" button may not appear on profiles of people outside your network -- LinkedIn may show "Follow" instead for public figures and influencers',
    'Profile editing modals use form inputs that may have autofill suggestions -- wait for the modal to fully load before typing',
    'Company pages have tab navigation (About, Posts, Jobs, People) -- each tab loads content dynamically, wait for content after clicking a tab',
    'LinkedIn search result filters (People, Posts, Companies) are buttons at the top of search results -- they reload the page with filtered results',
    'LinkedIn Learning videos auto-track progress -- do not need explicit "mark complete" actions',
    'LinkedIn article editor uses the same Quill rich text editor as post composer but with additional formatting options',
    'LinkedIn Settings & Privacy sections use toggle switches -- click the toggle to change state, changes often save automatically',
    'LinkedIn Notifications nav link text includes the notification count (e.g., "3 new notifications Notifications") -- use contains() not exact text match for the Notifications nav selector',
    'LinkedIn feed uses hashed class names like hlqCFDLyHXLwyvzqLMNyNEwjuUIkmaWY on links and nav elements -- these are UNSTABLE and must not be used as primary selectors. Use aria-label or XPath normalize-space patterns instead.'
  ],

  toolPreferences: ['click', 'type', 'scroll', 'getText', 'waitForElement', 'hover', 'focus', 'pressEnter', 'navigate', 'scrollToElement']
};

// Domain alias: x.com extracts as "x" but selectors are keyed under "twitter"
SOCIAL_GUIDE.selectors.x = SOCIAL_GUIDE.selectors.twitter;

registerSiteGuide(SOCIAL_GUIDE);
