/**
 * Site Guide: Email Platforms
 * Covers Gmail, Outlook, Yahoo Mail, ProtonMail
 */

const EMAIL_GUIDE = {
  name: 'Email Platforms',

  patterns: [
    /mail\.google\.com/i,
    /outlook\.live\.com/i,
    /outlook\.office\.com/i,
    /mail\.yahoo\.com/i,
    /protonmail\.com/i,
    /proton\.me\/mail/i
  ],

  guidance: `EMAIL PLATFORM AUTOMATION INTELLIGENCE:

NOTE: Use element refs from the page snapshot (e.g., {"ref": "e1"}) to target elements. The CSS selectors below are for element identification only.

COMPOSE WORKFLOW (Gmail):
1. Click the Compose button to open a new email window.
2. TO FIELD: Click the To field (look for textbox "To recipients" in snapshot) and type the recipient email address.
   - CRITICAL: After typing an email address, the automation will automatically press Tab to convert it into a recipient "chip".
   - Wait for the chip to appear before proceeding to Subject.
   - Do NOT manually add pressEnter or Tab -- the type tool handles this.
3. SUBJECT: Click the Subject field (look for textbox "Subject" in snapshot) and type the subject.
4. BODY: Click the message body area (look for textbox "Message Body" in snapshot) and type the email content.
5. SEND: Click the Send button using its ref from the snapshot.
   - WARNING: Gmail's Send button aria-label contains invisible Unicode characters. The snapshot provides CLEAN refs.
   - If clicking fails, use keyPress with key: "Enter" and ctrlKey: true as fallback.
6. VERIFY: Confirm the compose window closed after sending.

SEND BUTTON UNICODE ISSUE:
- Gmail's Send button has aria-label like "Send (Cmd+Enter)" but with invisible LRE/PDF chars embedded.
- The snapshot strips these chars automatically, so the ref you receive will work.
- If you see a Send button but your click fails, use Ctrl+Enter (keyPress tool) immediately.

RECIPIENT FIELD VALIDATION:
- After typing an email in the To/CC/BCC field, Gmail converts it to a "chip" element.
- The original typed text disappears from the input -- this is EXPECTED behavior.
- The chip contains the email address and is visible as a rounded tag.
- If the chip appears or the field text clears after typing, the recipient was accepted.

REPLY / FORWARD:
- Open the email thread first.
- For Reply: Click the Reply button or the reply area at the bottom.
- For Forward: Click the Forward button (usually in a menu).
- The compose area opens inline -- fill in fields and send as normal.

READING EMAILS:
- Click on an email subject/preview in the inbox to open it.
- Extract the sender, subject, date, and body content.
- Use scroll if the email is long.`,

  selectors: {
    gmail: {
      composeButton: '.T-I.T-I-KE.L3, [gh="cm"]',
      toField: 'input[name="to"], [aria-label="To recipients"]',
      ccField: 'input[name="cc"], [aria-label="Cc recipients"]',
      bccField: 'input[name="bcc"], [aria-label="Bcc recipients"]',
      subjectField: 'input[name="subjectbox"]',
      messageBody: '[aria-label="Message Body"], [aria-label*="Message Body"], .Am.Al.editable',
      sendButton: '[data-tooltip*="Send"], .T-I.J-J5-Ji.aoO.v7.T-I-atl.L3',
      discardDraft: '[aria-label="Discard draft"]',
      inboxLink: '[aria-label="Inbox"]',
      searchBox: 'input[aria-label="Search mail"]',
      starButton: '[aria-label*="Star"]',
      deleteButton: '[aria-label="Delete"]',
      archiveButton: '[aria-label="Archive"]',
      replyButton: '[aria-label="Reply"]',
      forwardButton: '[aria-label="Forward"]',
      moreActions: '[aria-label="More"]'
    },
    outlook: {
      composeButton: '[aria-label="New mail"]',
      toField: '[aria-label="To"]',
      subjectField: '[aria-label="Add a subject"]',
      messageBody: '[aria-label="Message body"]',
      sendButton: '[aria-label="Send"]',
      searchBox: '[aria-label="Search"]'
    },
    yahoo: {
      composeButton: '[data-test-id="compose-button"]',
      toField: '#message-to-field',
      subjectField: '#message-subject-field',
      messageBody: '#editor-container',
      sendButton: '[data-test-id="compose-send-button"]'
    }
  },

  workflows: {
    sendEmail: [
      'Click Compose button to open new email',
      'Click To field and type recipient email address',
      'Wait for recipient chip to appear (automatic Tab confirmation)',
      'Click Subject field and type subject line',
      'Click Message Body and type email content',
      'Click Send button (use ref from snapshot)',
      'If Send fails, use keyPress with key: "Enter", ctrlKey: true',
      'Verify compose window is closed'
    ],
    readEmail: [
      'Click on email subject/preview in inbox list',
      'Wait for email to load',
      'Extract sender, subject, date, and body content',
      'Scroll if email is long to see full content'
    ],
    replyToEmail: [
      'Open the email thread by clicking on it',
      'Click Reply button or reply area at bottom',
      'Type reply message in the compose area',
      'Click Send button',
      'Verify reply was sent'
    ],
    searchEmail: [
      'Click the search box',
      'Type search query',
      'Press Enter or click search button',
      'Browse results and click on matching email'
    ]
  },

  warnings: [
    'Gmail Send button aria-label contains invisible Unicode bidirectional chars -- always use the ref from the snapshot, never construct your own selector',
    'Gmail recipient fields (To/CC/BCC) require Tab key after typing to create a "chip" -- the type tool handles this automatically',
    'After Tab confirmation in Gmail To field, the typed text is replaced by a chip element -- this is normal, not a failure',
    'If Send button click fails in Gmail, immediately try Ctrl+Enter (keyPress tool with ctrlKey: true) as fallback',
    'Gmail compose window elements are dynamically created -- use waitForElement if elements are not immediately available',
    'Outlook web has different elements than Gmail -- check the URL to determine which platform you are on',
    'Some email operations require the user to be logged in -- if login wall appears, report to user'
  ],

  toolPreferences: ['type', 'click', 'keyPress', 'pressEnter', 'scroll', 'scrollToElement', 'waitForElement', 'getText', 'navigate']
};

registerSiteGuide(EMAIL_GUIDE);
