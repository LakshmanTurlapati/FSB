/**
 * Site Guide: LinkedIn
 * Per-site guide for LinkedIn professional networking platform.
 */

registerSiteGuide({
  site: 'LinkedIn',
  category: 'Social Media',
  patterns: [
    /linkedin\.com/i
  ],
  guidance: `LINKEDIN-SPECIFIC INTELLIGENCE:

COMMON PATTERNS:
  # search for a person
  click e5    # search box
  type e5 "John Smith software engineer"
  enter
  click e10   # People filter
  click e15   # profile result
  # send a connection request
  click e20   # Connect button
  click e25   # Send without a note

IMPORTANT -- LinkedIn has TWO different UI systems:
1. LEGACY pages (Feed, Messaging, Notifications): Uses Ember.js framework with #ember<N> IDs (dynamic, unreliable) and .global-nav__* classes (stable).
2. REDESIGNED pages (My Network/Grow, Jobs): Uses hashed CSS classes (_5b06d96c, _9954a25d) -- NEVER use these. Use aria-label and XPath normalize-space() selectors instead.

SELECTOR RULES:
- NEVER use #ember<N> IDs -- they change on every page load
- NEVER use hashed CSS classes on redesigned pages (e.g. _5b06d96c, _9954a25d) -- they change between builds
- ALWAYS prefer aria-label selectors and XPath normalize-space() patterns
- data-testid selectors are stable when available
- .global-nav__* and .msg-* classes are stable on legacy pages

GLOBAL NAVIGATION (stable across all LinkedIn pages):
- Search box: [aria-label="I'm looking for..."] or [role="combobox"]
- Home: //a[normalize-space(.)="Home"]
- My Network: //a[normalize-space(.)="My Network"]
- Jobs: //a[normalize-space(.)="Jobs"]
- Messaging: //a[normalize-space(.)="Messaging"]
- Notifications: //a[contains(normalize-space(.),"Notifications")] (NOTE: text includes notification count)
- Learning: //a[normalize-space(.)="Learning"]
- Me menu: .global-nav__primary-link-me-menu-trigger
- For Business: //button[normalize-space(.)="For Business"]

MESSAGING VERIFICATION (CRITICAL):
After clicking the Send button (.msg-form__send-button):
- SUCCESS signals: Input field is CLEARED (empty/contains only newline), Send button becomes DISABLED
- The URL does NOT change after sending -- do NOT wait for a URL change
- Once you see input cleared + Send button disabled after clicking Send, the message was sent successfully
- Do NOT re-type or re-send the message if the input is empty after a Send click`,
  selectors: {
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
  workflows: {
    sendMessage: [
      'Click Messaging in nav: //a[normalize-space(.)="Messaging"]',
      'Click "Compose a new message": //button[normalize-space(.)="Compose a new message"]',
      'Type the recipient name in the To field and select from suggestions',
      'Click the message input: .msg-form__contenteditable',
      'Type the message content',
      'Click Send: .msg-form__send-button',
      'VERIFY: If message input is now EMPTY and Send button is DISABLED, the message was sent -- mark taskComplete: true immediately',
      'Do NOT re-type the message if input is empty after clicking Send -- that means success'
    ],
    createPost: [
      'Click "Start a post": //button[normalize-space(.)="Start a post"]',
      'Wait for the post editor modal to appear',
      'Click the text area: .ql-editor[data-placeholder]',
      'Type the post content',
      'Click the Post button: .share-actions__primary-action',
      'Verify post was created by checking feed'
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
    connectWithNote: [
      'Navigate to the target person\'s profile page',
      'Click Connect: //button[normalize-space(.)="Connect"]',
      'If "Add a note" button appears, click it: //button[normalize-space(.)="Add a note"]',
      'Type the connection note in the text area (max 300 chars): #custom-message',
      'Click Send: //button[normalize-space(.)="Send"]',
      'Verify the button changes to "Pending"'
    ],
    viewProfile: [
      'Search for the person using the search box',
      'Type the person name and press Enter',
      'Click the "People" filter: //button[normalize-space(.)="People"]',
      'Find the target person in results and click their name',
      'Wait for profile page to load',
      'Scroll down to view sections: About, Experience, Education, Skills'
    ],
    browseJobs: [
      'Click Jobs in nav: //a[normalize-space(.)="Jobs"]',
      'Use the search box to search for job titles or companies',
      'Browse recommended jobs or use carousel',
      'Click on a job card to see details',
      'Click "Easy Apply" or "Apply" on the job detail page'
    ],
    editProfile: [
      'Navigate to own profile (click Me menu, then "View Profile")',
      'Click "Edit intro": //button[normalize-space(.)="Edit intro"]',
      'Wait for the edit modal to appear',
      'Modify the desired fields (first name, last name, headline, location)',
      'Click Save: //button[normalize-space(.)="Save"]',
      'Verify changes by reading the updated profile header'
    ]
  },
  warnings: [
    'LinkedIn has TWO UI systems: legacy Ember.js pages (Feed, Messaging) and redesigned pages (My Network, Jobs) -- selector strategies differ',
    'NEVER use #ember<N> IDs on LinkedIn -- they are dynamically generated and change on every page load',
    'NEVER use hashed CSS classes on LinkedIn redesigned pages (e.g. _5b06d96c) -- they change between builds',
    'On LinkedIn redesigned pages, use aria-label selectors and XPath normalize-space() patterns for stability',
    'LinkedIn may prompt for premium features -- skip unless user has premium',
    'Message sending is limited to 1st-degree connections unless user has Premium/InMail credits',
    'LinkedIn CLEARS the message input and DISABLES the Send button after a successful send -- if you see empty input + disabled Send after clicking Send, the message WAS sent, do NOT re-type or re-send',
    'LinkedIn profile sections (Experience, Education, Skills) load lazily -- scroll down to trigger rendering',
    'Connection request notes are limited to 300 characters',
    'The "Connect" button may not appear on profiles of public figures -- LinkedIn may show "Follow" instead',
    'Profile editing modals use form inputs that may have autofill suggestions -- wait for the modal to fully load',
    'Company pages have tab navigation (About, Posts, Jobs, People) -- each tab loads content dynamically',
    'LinkedIn search result filters are buttons at the top of search results -- they reload the page with filtered results',
    'LinkedIn Notifications nav link text includes the notification count -- use contains() not exact text match',
    'LinkedIn feed uses hashed class names on links and nav elements -- these are UNSTABLE and must not be used as selectors'
  ],
  toolPreferences: ['click', 'type', 'scroll', 'getText', 'waitForElement', 'hover', 'focus', 'pressEnter', 'navigate', 'scrollToElement']
});
