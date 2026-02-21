/**
 * Site Guide: Gmail
 * Per-site guide for Gmail email platform.
 */

registerSiteGuide({
  site: 'Gmail',
  category: 'Email Platforms',
  patterns: [
    /mail\.google\.com/i
  ],
  guidance: `GMAIL-SPECIFIC INTELLIGENCE:

NOTE: Use element refs from the page snapshot (e.g., {"ref": "e1"}) to target elements. The CSS selectors below are for element identification only.

COMPOSE WORKFLOW:
1. Click the Compose button (.T-I.T-I-KE.L3 or [gh="cm"]) to open a new email window.
2. TO FIELD: Click the To field (input[name="to"] or [aria-label="To recipients"]) and type the recipient email address.
   - CRITICAL: After typing an email address, the automation will automatically press Tab to convert it into a recipient "chip".
   - Wait for the chip to appear before proceeding to Subject.
   - Do NOT manually add pressEnter or Tab -- the type tool handles this.
3. SUBJECT: Click the Subject field (input[name="subjectbox"]) and type the subject.
4. BODY: Click the message body area ([aria-label="Message Body"] or .Am.Al.editable) and type the email content.
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
- For Reply: Click the Reply button ([aria-label="Reply"]) or the reply area at the bottom.
- For Forward: Click the Forward button ([aria-label="Forward"]).
- The compose area opens inline -- fill in fields and send as normal.

READING EMAILS:
- Click on an email subject/preview in the inbox to open it.
- Extract the sender, subject, date, and body content.
- Use scroll if the email is long.

NAVIGATION:
- Inbox: [aria-label="Inbox"]
- Search: input[aria-label="Search mail"]
- Star: [aria-label*="Star"]
- Delete: [aria-label="Delete"]
- Archive: [aria-label="Archive"]`,
  selectors: {
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
  workflows: {
    sendEmail: [
      'Click Compose button (.T-I.T-I-KE.L3 or [gh="cm"]) to open new email',
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
      'Click Reply button [aria-label="Reply"]',
      'Type reply message in the compose area',
      'Click Send button',
      'Verify reply was sent'
    ],
    searchEmail: [
      'Click the search box (input[aria-label="Search mail"])',
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
    'Gmail compose window elements are dynamically created -- use waitForElement if elements are not immediately available'
  ],
  toolPreferences: ['type', 'click', 'keyPress', 'pressEnter', 'scroll', 'scrollToElement', 'waitForElement', 'getText', 'navigate']
});
