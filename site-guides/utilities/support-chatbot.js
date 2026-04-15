/**
 * Site Guide: Support Chatbot
 * Per-site guide for support chatbot widgets embedded on websites.
 * Covers Intercom, Zendesk, Drift, Crisp, Tawk.to, Freshdesk, HubSpot,
 * and custom chatbot implementations.
 *
 * Key challenge: chatbot widgets are often inside iframes, requiring
 * CDP tools (click_at, type) when DOM tools cannot reach inside.
 * The 15-turn conversation tests context retention across many exchanges.
 *
 * Created for Phase 82, CONTEXT-06 edge case validation.
 * Target: converse with chatbot for 15 turns then summarize first instruction.
 */

registerSiteGuide({
  site: 'Support Chatbot',
  category: 'Utilities',
  patterns: [
    /intercom\.com/i,
    /zendesk\.com/i,
    /drift\.com/i,
    /crisp\.chat/i,
    /tawk\.to/i,
    /freshdesk\.com/i,
    /hubspot\.com/i,
    /tidio\.co/i,
    /livechat\.com/i,
    /helpscout\.com/i
  ],
  guidance: `AUTOPILOT STRATEGY HINTS (from v0.9.7 diagnostic CONTEXT-06):
- [context] Track turns as compact records, NOT full DOM reads per turn
- [context] Defer full chat history read until ALL 15 turns complete
- [context] Check for iframe isolation BEFORE attempting DOM tools on widget
- [context] Wait for bot response after EACH message -- do not rapid-fire
- [context] Extract first INSTRUCTION, not first greeting ("Hi, how can I help?")

SUPPORT CHATBOT INTELLIGENCE:

TARGET SELECTION (CONTEXT-06):
- Primary target: A website with a visible automated chatbot widget (bot-driven responses, not requiring a live human agent)
- Good candidates: SaaS product sites, hosting providers, and e-commerce sites that use Intercom, Zendesk, Drift, Crisp, Tawk.to, Tidio, or HubSpot chat widgets
- Specific targets to try:
  1. https://www.tidio.com -- Tidio own site uses their own chatbot widget (bot-driven, no auth required)
  2. https://www.crisp.chat -- Crisp own site uses their own chatbot widget
  3. https://www.drift.com -- Drift own site uses their own chatbot widget
  4. https://www.hubspot.com -- HubSpot own site with chatbot
  5. https://www.intercom.com -- Intercom own site with chatbot
- Fallback: any website with a visible chat launcher icon in bottom-right corner
- Requirement: chatbot must respond automatically (bot/AI-driven) so that 15 turns can be completed without waiting for a human agent
- SKIP-AUTH: if all chatbot targets require login or only offer live agent (no automated bot), document as skip-auth outcome

CHATBOT WIDGET DETECTION:
- Most chatbot widgets appear as a small icon or button in the bottom-right corner of the page
- Common launcher selectors: [id*="chat"], [class*="chat-launcher"], [aria-label*="chat"], iframe[src*="widget"], [data-testid*="chat"]
- After clicking the launcher, a chat panel opens (either inline or in an iframe)
- IFRAME DETECTION: If the chat panel is inside an iframe, DOM tools (click, type_text, read_page) may not reach inside
  - Strategy A (preferred): Try DOM tools first -- some chatbot widgets render in the main DOM
  - Strategy B (iframe fallback): If DOM tools fail, use CDP tools (click_at on chat input coordinates, then press_key to type characters)
  - Strategy C (manual URL): Some chatbot providers have standalone chat URLs (e.g., tawk.to standalone page)

15-TURN CONVERSATION STRATEGY (CONTEXT-06):
- This workflow tests CONTEXT RETENTION: maintain awareness of turn count and first-instruction memory across 15 exchanges
- The challenge is sustaining 15 meaningful turns without the chatbot ending the conversation
- Message strategy for 15 turns:
  Turn 1: "Hello, I need help with your product"
  Turn 2: Respond to the bot's greeting/question
  Turn 3: Ask about pricing or features
  Turn 4: Ask a follow-up question about the bot's response
  Turn 5: Ask about a different feature or plan
  Turn 6: Ask about integration or compatibility
  Turn 7: Ask about support options
  Turn 8: Ask about setup or onboarding
  Turn 9: Ask about account management
  Turn 10: Ask about billing or payment
  Turn 11: Ask about data security or privacy
  Turn 12: Ask about customization options
  Turn 13: Ask about team or enterprise features
  Turn 14: Ask about migration from another product
  Turn 15: Say "Thank you, that's very helpful"
- IMPORTANT: Wait for the bot to respond after EACH message before sending the next
- If the bot asks a question, answer it naturally before continuing with the script
- If the bot offers menu options (buttons), click the most relevant one as that turn's interaction
- Track turn count: after each bot response, increment count. Stop sending after turn 15.

FIRST INSTRUCTION IDENTIFICATION:
- After completing 15 turns, scroll to the TOP of the chat history
- The "first instruction" is the first actionable guidance the bot provided (not just a greeting)
- Examples of instructions: "Click the Settings button to configure...", "You can find pricing at...", "To get started, first..."
- If the bot's first message was just a greeting ("Hi! How can I help?"), the first instruction is the first bot message that contains actionable guidance
- Use read_page on the chat panel after scrolling to top to extract the first few bot messages
- Summarize the first instruction in 1-2 sentences

VERIFICATION CRITERIA:
- PASS = 15 messages sent, bot responded to each, first instruction identified and summarized in 1-2 sentences
- PARTIAL = some messages sent (10+) but could not complete 15 turns, or first instruction extraction failed
- FAIL = could not open chatbot widget, or could not send messages, or fewer than 10 turns completed
- SKIP-AUTH = all target chatbots require login or only offer live agent chat

CONTEXT BLOAT MITIGATION FOR 15-TURN CONVERSATION:
- Do NOT read full chat DOM after every turn -- only read after all 15 turns are complete
- During conversation: only verify the last bot response appeared (check for new message element)
- After turn 15: scroll to top and read first few messages to find the first instruction
- Compact turn tracking: {turn: N, sent: "message text", botResponded: true/false}
- Total context for 15 turns: under 3000 characters (15 turns * ~200 chars per turn record)
- Summary extraction: read only the first 3-4 bot messages, not the entire 15-turn history`,
  selectors: {
    // Generic chatbot launcher (bottom-right icon/button)
    chatLauncher: '[id*="chat-widget"], [class*="chat-launcher"], [class*="chat-button"], [aria-label*="chat" i], [aria-label*="Chat" i], button[class*="launcher"], [data-testid*="chat"], .intercom-launcher, #intercom-container iframe, .drift-widget, [class*="crisp"], #tawk-bubble-container, [class*="tidio"], #hubspot-messages-iframe-container',
    // Chat input field (inside widget or iframe)
    chatInput: 'textarea[placeholder*="message" i], input[placeholder*="message" i], textarea[placeholder*="type" i], input[placeholder*="type" i], [contenteditable="true"][role="textbox"], textarea[name="message"], input[name="message"], [data-testid*="input"], [data-testid*="composer"]',
    // Send button
    sendButton: 'button[aria-label*="send" i], button[type="submit"], button[class*="send"], [data-testid*="send"], button svg[class*="send"], button[title*="Send" i]',
    // Chat messages container
    messagesContainer: '[class*="messages"], [class*="conversation"], [role="log"], [class*="chat-body"], [class*="chat-history"], [data-testid*="messages"]',
    // Individual bot message
    botMessage: '[class*="bot-message"], [class*="agent-message"], [class*="operator"], [data-sender="bot"], [class*="incoming"], [data-testid*="bot"], [class*="reply"]',
    // Individual user message
    userMessage: '[class*="user-message"], [class*="visitor-message"], [class*="outgoing"], [data-sender="user"], [data-testid*="user"]',
    // Chat iframe (for embedded widgets)
    chatIframe: 'iframe[src*="widget"], iframe[src*="chat"], iframe[id*="chat"], iframe[name*="chat"], iframe[title*="chat" i], #intercom-frame, iframe[src*="tawk"], iframe[src*="crisp"], iframe[src*="drift"], iframe[src*="tidio"]',
    // Menu option buttons (some bots present clickable options)
    menuOption: 'button[class*="option"], button[class*="quick-reply"], [class*="suggestion"], [data-testid*="option"], button[class*="choice"]',
    // Close/minimize chat
    closeChat: 'button[aria-label*="close" i], button[aria-label*="minimize" i], button[class*="close"], [data-testid*="close"]'
  },
  workflows: {
    chatbot15TurnSummary: [
      'SETUP: Navigate to target site with embedded chatbot widget. Primary: https://www.tidio.com. If chatbot not visible or not automated, try fallback targets in order: crisp.chat, drift.com, hubspot.com, intercom.com.',
      'DETECT WIDGET: Look for chatbot launcher icon (typically bottom-right corner). Use chatLauncher selector. If no launcher visible, scroll down to trigger lazy-loaded widgets, wait 3-5 seconds.',
      'OPEN CHAT: Click the chatbot launcher to open the chat panel. Wait for chat input to become visible. Check if chat panel is in an iframe (chatIframe selector) or main DOM.',
      'IFRAME CHECK: If chat panel is inside an iframe, note this for CDP tool fallback. Try DOM tools first -- if type_text on chatInput fails, switch to CDP click_at on input coordinates + press_key for typing.',
      'TURN 1: Type "Hello, I need help with your product" into chatInput and click sendButton (or press Enter). Wait for bot response to appear in messagesContainer. Record: {turn: 1, sent: true, botResponded: true/false}.',
      'TURN 2-5: Continue conversation with contextual questions about the product. After each send, wait for bot response before proceeding. If bot presents menu options (menuOption selector), click the most relevant one. Track turn count.',
      'TURN 6-10: Continue with questions about different topics (integration, support, setup, billing, security). Maintain turn count tracking. If bot tries to end conversation ("Is there anything else?"), ask a new question to keep going.',
      'TURN 11-15: Continue with remaining topics (customization, team features, migration, final thank-you). After turn 15 bot response, stop sending messages.',
      'VERIFY TURN COUNT: Confirm 15 user messages were sent and the bot responded to each. If fewer than 15 turns completed, note the reason (bot ended conversation, widget closed, error).',
      'SCROLL TO TOP: Scroll up within the chat messages container (messagesContainer) to reach the beginning of the conversation. Use scroll tool targeting the chat panel, not the page.',
      'READ FIRST MESSAGES: Use read_page targeting the chat panel area. Look for the first 3-4 bot messages (botMessage selector). Identify the first bot response that contains actionable guidance (not just a greeting).',
      'EXTRACT FIRST INSTRUCTION: From the first actionable bot message, extract the instruction or guidance given. Summarize it in 1-2 sentences.',
      'REPORT: State outcome (PASS/PARTIAL/FAIL/SKIP-AUTH) with: turn count achieved, first instruction summary, chatbot platform identified, iframe or DOM interaction method used.'
    ],
    openChatWidget: [
      'Look for chatbot launcher in bottom-right corner',
      'Click the launcher icon or button',
      'Wait for chat panel to open with input field visible',
      'Determine if chat is in iframe or main DOM',
      'If iframe: note coordinates for CDP fallback'
    ]
  },
  warnings: [
    'Chatbot widgets are frequently embedded in iframes -- DOM tools (click, type_text, read_page) may not reach inside the iframe. Use CDP tools (click_at, press_key) as fallback.',
    'Some chatbots require a name or email before starting conversation -- enter test@example.com and "Test User" if prompted.',
    'Live agent chatbots will NOT respond automatically -- only use sites with bot/AI-driven responses for CONTEXT-06.',
    'Chatbot may end conversation early ("Is there anything else?") -- ask new questions to sustain 15 turns.',
    'Some chatbot widgets lazy-load after scroll or timeout -- wait 3-5 seconds on page load before looking for launcher.',
    'Chat history scrolling may differ from page scrolling -- target the chat container element, not the page body.',
    'For CONTEXT-06: do NOT read full chat DOM after every turn. Only read after all 15 turns to extract first instruction. This prevents context bloat.',
    'If bot presents clickable menu options instead of freeform text, clicking an option counts as one turn of conversation.'
  ],
  toolPreferences: ['click', 'type_text', 'press_enter', 'read_page', 'scroll', 'wait_for_stable', 'click_at', 'press_key']
});
