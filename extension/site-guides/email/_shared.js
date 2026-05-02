/**
 * Shared Category Guidance: Email Platforms
 * Category-level guidance that applies to all email platforms.
 */

registerCategoryGuidance({
  category: 'Email Platforms',
  icon: 'fa-envelope',
  guidance: `EMAIL PLATFORM AUTOMATION INTELLIGENCE:

NOTE: Use element refs from the page snapshot (e.g., {"ref": "e1"}) to target elements. The CSS selectors below are for element identification only.

COMPOSE WORKFLOW:
1. Click the Compose button to open a new email window.
2. TO FIELD: Click the To field and type the recipient email address.
   - After typing, the automation may need to confirm (Tab/Enter) to create a recipient chip.
   - Wait for the chip to appear before proceeding to Subject.
3. SUBJECT: Click the Subject field and type the subject.
4. BODY: Click the message body area and type the email content.
5. SEND: Click the Send button using its ref from the snapshot.
   - If clicking fails, use keyPress with key: "Enter" and ctrlKey: true as fallback.
6. VERIFY: Confirm the compose window closed after sending.

RECIPIENT FIELD VALIDATION:
- After typing an email in the To/CC/BCC field, the platform may convert it to a "chip" element.
- The original typed text disappearing is EXPECTED behavior.
- If the chip appears or the field text clears, the recipient was accepted.

REPLY / FORWARD:
- Open the email thread first.
- For Reply: Click the Reply button or the reply area at the bottom.
- For Forward: Click the Forward button (usually in a menu).
- The compose area opens inline -- fill in fields and send as normal.

READING EMAILS:
- Click on an email subject/preview in the inbox to open it.
- Extract the sender, subject, date, and body content.
- Use scroll if the email is long.`,
  warnings: [
    'Some email operations require the user to be logged in -- if login wall appears, report to user',
    'Email compose window elements are dynamically created -- use waitForElement if elements are not immediately available'
  ]
});
