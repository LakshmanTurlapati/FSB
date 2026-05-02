/**
 * Site Guide: Outlook
 * Per-site guide for Outlook.com / Outlook web email platform.
 */

registerSiteGuide({
  site: 'Outlook',
  category: 'Email Platforms',
  patterns: [
    /outlook\.live\.com/i,
    /outlook\.office\.com/i
  ],
  guidance: `OUTLOOK WEB-SPECIFIC INTELLIGENCE:

COMMON PATTERNS:
  # compose and send an email
  click e5    # New mail button
  type e10 "recipient@email.com"
  type e15 "Subject line"
  type e20 "Email body text here"
  click e25   # Send button
  # search for an email
  click e30   # search box
  type e30 "meeting notes"
  enter

COMPOSE WORKFLOW:
1. Click "New mail" button ([aria-label="New mail"]) to open a new email.
2. TO FIELD: Click the To field ([aria-label="To"]) and type the recipient email address.
3. SUBJECT: Click the Subject field ([aria-label="Add a subject"]) and type the subject.
4. BODY: Click the message body area ([aria-label="Message body"]) and type the email content.
5. SEND: Click the Send button ([aria-label="Send"]).
6. VERIFY: Confirm the compose window closed after sending.

SEARCH:
- Search box: [aria-label="Search"]
- Type search query and press Enter

READING EMAILS:
- Click on an email in the inbox list to open it
- Extract the sender, subject, date, and body content
- Use scroll if the email is long

REPLY / FORWARD:
- Open the email thread first
- Reply and Forward buttons appear in the email view
- The compose area opens inline`,
  selectors: {
    composeButton: '[aria-label="New mail"]',
    toField: '[aria-label="To"]',
    subjectField: '[aria-label="Add a subject"]',
    messageBody: '[aria-label="Message body"]',
    sendButton: '[aria-label="Send"]',
    searchBox: '[aria-label="Search"]'
  },
  workflows: {
    sendEmail: [
      'Click "New mail" button [aria-label="New mail"]',
      'Click To field and type recipient email address',
      'Click Subject field and type subject line',
      'Click Message Body and type email content',
      'Click Send button [aria-label="Send"]',
      'Verify compose window is closed'
    ],
    readEmail: [
      'Click on email in inbox list',
      'Wait for email to load',
      'Extract sender, subject, date, and body content',
      'Scroll if email is long'
    ],
    searchEmail: [
      'Click the search box [aria-label="Search"]',
      'Type search query',
      'Press Enter',
      'Browse results and click on matching email'
    ]
  },
  warnings: [
    'Outlook web has different elements than Gmail -- check the URL to determine which platform you are on',
    'Some email operations require the user to be logged in -- if login wall appears, report to user',
    'Outlook uses aria-label attributes extensively for element identification'
  ],
  toolPreferences: ['type', 'click', 'keyPress', 'pressEnter', 'scroll', 'scrollToElement', 'waitForElement', 'getText', 'navigate']
});
