/**
 * Site Guide: Yahoo Mail
 * Per-site guide for Yahoo Mail email platform.
 */

registerSiteGuide({
  site: 'Yahoo Mail',
  category: 'Email Platforms',
  patterns: [
    /mail\.yahoo\.com/i
  ],
  guidance: `YAHOO MAIL-SPECIFIC INTELLIGENCE:

COMPOSE WORKFLOW:
1. Click the Compose button ([data-test-id="compose-button"]) to open a new email.
2. TO FIELD: Click the To field (#message-to-field) and type the recipient email address.
3. SUBJECT: Click the Subject field (#message-subject-field) and type the subject.
4. BODY: Click the message body area (#editor-container) and type the email content.
5. SEND: Click the Send button ([data-test-id="compose-send-button"]).
6. VERIFY: Confirm the compose window closed after sending.

READING EMAILS:
- Click on an email in the inbox list to open it
- Extract the sender, subject, date, and body content
- Use scroll if the email is long

NAVIGATION:
- Yahoo Mail uses data-test-id attributes for key elements
- Inbox is the default view on load`,
  selectors: {
    composeButton: '[data-test-id="compose-button"]',
    toField: '#message-to-field',
    subjectField: '#message-subject-field',
    messageBody: '#editor-container',
    sendButton: '[data-test-id="compose-send-button"]'
  },
  workflows: {
    sendEmail: [
      'Click Compose button [data-test-id="compose-button"]',
      'Click To field (#message-to-field) and type recipient email address',
      'Click Subject field (#message-subject-field) and type subject line',
      'Click Message Body (#editor-container) and type email content',
      'Click Send button [data-test-id="compose-send-button"]',
      'Verify compose window is closed'
    ],
    readEmail: [
      'Click on email in inbox list',
      'Wait for email to load',
      'Extract sender, subject, date, and body content',
      'Scroll if email is long'
    ]
  },
  warnings: [
    'Some email operations require the user to be logged in -- if login wall appears, report to user',
    'Yahoo Mail uses data-test-id attributes which are generally stable for testing selectors',
    'Yahoo Mail may show promotional/ad content that needs to be distinguished from actual emails'
  ],
  toolPreferences: ['type', 'click', 'keyPress', 'pressEnter', 'scroll', 'scrollToElement', 'waitForElement', 'getText', 'navigate']
});
