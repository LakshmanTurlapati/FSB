# Autopilot Diagnostic Report: Phase 82 - Support Chatbot 15-Turn Summary

## Metadata
- Phase: 82
- Requirement: CONTEXT-06
- Date: 2026-03-22
- Outcome: PARTIAL (All 5 target chatbot provider sites accessible via HTTP -- tidio.com (200, 395,773 bytes, Next.js SPA), crisp.chat (200, 330,739 bytes, Nuxt.js SSR with CRISP_WEBSITE_ID embedded), drift.com (200, 334 bytes redirect stub), hubspot.com (200, 674,943 bytes with hs-script-loader), intercom.com (200, 422,441 bytes with 363 intercom references). Chatbot widgets on all sites are client-side injected via JavaScript -- not present in server HTML, requiring live browser for widget detection, opening, and conversation. The 15-turn conversation, chat history scrolling, and first instruction extraction all require live browser MCP execution which is blocked by WebSocket bridge disconnect. Same persistent blocker as Phases 55-81.)
- Live MCP Testing: NO (WebSocket bridge disconnected -- MCP server process running on port 7225, returns HTTP 426 "Upgrade Required" indicating WebSocket protocol mismatch. Same persistent blocker as Phases 55-81.)

## Prompt Executed
"Navigate to a website with an automated support chatbot, open the chat widget, send 15 messages to the chatbot (waiting for each response), then scroll to the top of the conversation and summarize the first instruction the chatbot gave."

## Result Summary
Live MCP test was attempted but blocked by the persistent WebSocket bridge disconnect (same blocker as Phases 55-81). HTTP-based validation was performed against all 5 target chatbot provider sites. The primary target tidio.com is accessible (HTTP 200, 395,773 bytes) as a Next.js SPA with extensive chatbot product content (275 "tidio" references, 360 "chat" references), but the Tidio chat widget itself is injected client-side via JavaScript and does not appear in the server HTML -- no code.tidio.co embed script, no tidioChatApi reference, and no chat iframe in the static markup. Crisp.chat (fallback 1) is the most promising target with CRISP_WEBSITE_ID "-JzqEmX56venQuQw4YV8" embedded in its Nuxt.js server HTML along with crisp-client library references (6 occurrences), confirming the Crisp widget loads on their own site. HubSpot (fallback 3) has hs-script-loader in server HTML for their HubSpot Conversations widget. Intercom.com (fallback 4) has 363 "intercom" references in server HTML. However, all chatbot widgets are client-rendered -- the chat launcher, chat panel, chat input, send button, messages container, and iframe are all injected by JavaScript after page load. The full CONTEXT-06 workflow -- open chat widget, conduct 15-turn conversation, scroll to top, extract first instruction -- requires live browser MCP execution. Outcome is PARTIAL: all 5 targets validated as accessible with chatbot widget infrastructure confirmed via HTTP analysis, but zero turns of conversation could be attempted.

## Step-by-Step Log
| Step | MCP Tool Used | Target | Result | Notes |
|------|---------------|--------|--------|-------|
| 1 | navigate | https://www.tidio.com | NOT EXECUTED (MCP) / FETCHED (HTTP 200, 395,773 bytes) | Page loads successfully. Next.js SPA with title "Tidio - AI customer service chatbot software - home page". 275 occurrences of "tidio", 360 of "chat", 7 of "Widget". Server HTML contains product marketing content about chatbots. MCP server on port 7225 returns HTTP 426. |
| 2 | read_page | Detect chatbot launcher (chatLauncher selector) | NOT EXECUTED (MCP) / SIMULATED (HTML analysis) | Chatbot widget is client-side injected. No code.tidio.co embed script found in server HTML. No tidioChatApi, no tidio-chat element, no chat iframe in static markup. The "tidio-chat" strings found (10 occurrences) are all href links to Shopify app store, Software Advice, GetApp, BigCommerce app listings -- product marketing content, not widget embed code. Widget would only appear after client-side JavaScript execution. |
| 3 | click | Click chatbot launcher to open chat panel | NOT EXECUTED (MCP) | Requires live browser. The Tidio widget would inject a launcher button (typically bottom-right corner with class containing "tidio") after client-side JS loads. Cannot detect or click without live DOM. |
| 4 | (analysis) | Check if chat panel is in iframe (chatIframe selector) | NOT EXECUTED (MCP) / SIMULATED | Tidio typically renders its chat widget inside an iframe (src containing tidio.com/widget). No iframe with tidio src found in server HTML -- confirms client-side injection. Iframe handling strategy from site guide: try DOM tools first, fall back to CDP click_at + press_key if iframe isolated. |
| 5 | (analysis) | Check for pre-chat form (name/email requirement) | NOT EXECUTED (MCP) / SIMULATED | Tidio widgets commonly show a pre-chat form asking for name and email before starting conversation. This would be inside the widget iframe, requiring CDP interaction. Cannot determine if tidio.com's own widget has pre-chat form from server HTML. |
| 6 | type_text + press_enter | Turn 1: "Hello, I need help with your product" | NOT EXECUTED (MCP) | Requires live browser with chat widget open. Would type into chatInput selector (textarea or input with placeholder containing "message" or "type"). If in iframe: would need CDP click_at on input coordinates + press_key for typing. |
| 7 | wait_for_stable | Wait for Turn 1 bot response | NOT EXECUTED (MCP) | Would monitor for new botMessage element in messagesContainer. Tidio bots typically respond within 1-3 seconds with automated messages. Cannot execute without live browser. |
| 8 | type_text + press_enter | Turn 2: Respond to bot greeting | NOT EXECUTED (MCP) | Would respond naturally to bot's initial message/question. Depends on bot's Turn 1 response content. |
| 9 | type_text + press_enter | Turn 3: "What pricing plans do you offer?" | NOT EXECUTED (MCP) | Product pricing question to sustain conversation. |
| 10 | type_text + press_enter | Turn 4: Follow-up on pricing response | NOT EXECUTED (MCP) | Context-dependent response based on bot's Turn 3 answer. |
| 11 | type_text + press_enter | Turn 5: "What features are included in the basic plan?" | NOT EXECUTED (MCP) | Feature-specific question to diversify conversation topics. |
| 12 | type_text + press_enter | Turns 6-10: Integration, support, setup, billing, security questions | NOT EXECUTED (MCP) | Turn 6: "Do you integrate with other tools?" Turn 7: "What support options are available?" Turn 8: "How do I get started with setup?" Turn 9: "Can I manage team members on my account?" Turn 10: "What payment methods do you accept?" |
| 13 | type_text + press_enter | Turns 11-15: Customization, enterprise, migration, thank-you | NOT EXECUTED (MCP) | Turn 11: "How do you handle data security?" Turn 12: "Can I customize the appearance?" Turn 13: "Do you have enterprise plans?" Turn 14: "Can I migrate from a different provider?" Turn 15: "Thank you, that has been very helpful" |
| 14 | (analysis) | Verify 15 turns completed | NOT EXECUTED (MCP) | Would count user messages (target: 15) and bot responses (target: 15). Zero turns completed due to MCP bridge disconnect. |
| 15 | scroll | Scroll to top of chat messages container | NOT EXECUTED (MCP) | Would target messagesContainer element with scroll tool (scroll up within chat panel, not page body). If in iframe: would need CDP-level scroll targeting the iframe content. |
| 16 | read_page | Read first bot messages at top of chat history | NOT EXECUTED (MCP) | Would read the first 3-4 bot messages (botMessage selector) after scrolling to top. Looking for first actionable instruction (not just "Hi, how can I help?"). |
| 17 | (analysis) | Extract and summarize first instruction | NOT EXECUTED (MCP) | Would identify the first bot message containing actionable guidance and summarize in 1-2 sentences. Cannot extract without completing conversation and reading chat history. |
| 18 | navigate | https://crisp.chat/en/ (fallback 1) | NOT EXECUTED (MCP) / FETCHED (HTTP 200, 330,739 bytes) | Crisp.chat accessible. Nuxt.js SSR. CRISP_WEBSITE_ID "-JzqEmX56venQuQw4YV8" found in server HTML. 6 occurrences of "crisp-client" library. Chat widget loads client-side via Crisp JS SDK. Confirmed: Crisp uses their own widget on their own site. |
| 19 | navigate | https://www.drift.com (fallback 2) | NOT EXECUTED (MCP) / FETCHED (HTTP 200, 334 bytes) | Drift.com returns only a 334-byte response -- appears to be a redirect stub or minimal landing. Drift was acquired by Salesloft in 2023; the website may have been consolidated. Insufficient content for chatbot widget analysis. |
| 20 | navigate | https://www.hubspot.com (fallback 3) | NOT EXECUTED (MCP) / FETCHED (HTTP 200, 674,943 bytes) | HubSpot.com accessible. Server HTML contains "hs-script-loader" (1 occurrence) for HubSpot Conversations widget injection. The chat widget loads via their own HubSpot messaging SDK. Large page (674KB) with extensive product content. |
| 21 | navigate | https://www.intercom.com (fallback 4) | NOT EXECUTED (MCP) / FETCHED (HTTP 200, 422,441 bytes) | Intercom.com accessible. 363 occurrences of "intercom" and 43 of "Intercom" in server HTML. No direct intercomSettings initialization found in server HTML -- likely deferred to client-side JS bundle. Chat widget would inject via Intercom Messenger SDK. |
| 22 | (analysis) | OUTCOME CLASSIFICATION | PARTIAL | All 5 target sites accessible via HTTP. Chatbot widget infrastructure confirmed on 4 of 5 (tidio.com, crisp.chat, hubspot.com, intercom.com). Drift.com returns minimal 334-byte response. Zero turns of conversation completed. Chatbot widgets are all client-side injected requiring live browser. WebSocket bridge disconnect blocks all MCP tools. |

## What Worked
- tidio.com (primary target) is accessible via HTTP 200 (395,773 bytes) as a Next.js SPA with extensive chatbot product content
- tidio.com page title confirmed: "Tidio - AI customer service chatbot software - home page" -- correct target site
- tidio.com contains 275 "tidio" references and 360 "chat" references in server HTML, confirming it is a chatbot product site
- crisp.chat is accessible via HTTP 200 (330,739 bytes) with CRISP_WEBSITE_ID "-JzqEmX56venQuQw4YV8" embedded in server HTML, confirming their own Crisp widget loads on the site
- crisp.chat has 6 occurrences of "crisp-client" JavaScript library reference, confirming Crisp JS SDK is loaded
- hubspot.com is accessible via HTTP 200 (674,943 bytes) with "hs-script-loader" in server HTML for HubSpot Conversations widget
- intercom.com is accessible via HTTP 200 (422,441 bytes) with 363 "intercom" references, confirming Intercom Messenger infrastructure
- All 4 viable targets (excluding drift.com) use their own chatbot widget on their own website -- ideal for testing bot-driven automated responses
- MCP server process running on port 7225 with established TCP connection (localhost:7225 <-> localhost:63895)
- support-chatbot.js site guide selectors cover all 5 target URLs via URL pattern matching (tidio.co, crisp.chat, drift.com, hubspot.com, intercom.com)
- 15-turn conversation message script from support-chatbot.js site guide covers diverse topics: product help, pricing, features, integration, support, setup, billing, security, customization, enterprise, migration

## What Failed
- **Live MCP execution not performed:** WebSocket bridge between MCP server and Chrome extension disconnected. MCP server process running on port 7225, returns HTTP 426 "Upgrade Required". This is the same persistent blocker from Phases 55-81. Without the bridge, no MCP tool (navigate, click, type_text, press_enter, read_page, scroll, wait_for_stable, click_at, press_key) can execute against the live browser.
- **Zero turns of conversation completed:** The entire 15-turn conversation workflow requires live browser interaction -- opening the chat widget, typing messages, clicking send, waiting for bot responses. HTTP-based analysis cannot interact with client-side injected chat widgets. Zero of the 15 turns were attempted.
- **Chat widget not detectable in server HTML:** All 5 target sites inject their chatbot widget via client-side JavaScript. The chat launcher, chat panel, chat input field, send button, and messages container are all dynamically created DOM elements that do not exist in server HTML. The chatLauncher, chatInput, sendButton, messagesContainer, botMessage, and chatIframe selectors from support-chatbot.js cannot be validated against server HTML.
- **Iframe isolation status unknown:** Whether the chat widget renders in an iframe or the main DOM cannot be determined from server HTML analysis. Tidio typically uses an iframe; Crisp may use inline DOM or iframe depending on configuration. This affects whether DOM tools or CDP tools are needed for interaction.
- **First instruction extraction not attempted:** Requires completing 15 turns, scrolling to top of chat history, and reading the first bot messages. None of these steps could be executed.
- **drift.com appears non-functional:** Returns only 334 bytes (minimal redirect or stub page). Drift was acquired by Salesloft in February 2023; the standalone drift.com domain may no longer serve the full product website. Should be replaced in the site guide target list.
- **Pre-chat form handling not tested:** Whether target chatbots require name/email before starting conversation cannot be determined from server HTML. Pre-chat form interaction (typing name, email, submitting) requires live browser.
- **Bot response timing unknown:** The wait time between sending a message and receiving a bot response varies by chatbot platform and configuration. Tidio bots may respond in 1-3 seconds; others may have longer delays or require specific triggers. Cannot calibrate wait_for_stable timing without live testing.

## Tool Gaps Identified
- **WebSocket bridge availability (persistent gap, Phases 55-82):** The MCP server process runs on port 7225 with an established TCP connection, but the Chrome extension side returns HTTP 426 "Upgrade Required" for browser action dispatch. This has blocked every live MCP test since Phase 55. The full CONTEXT-06 workflow -- navigate to chatbot site, detect widget, open chat, handle iframe, conduct 15-turn conversation with wait-for-response after each turn, scroll chat history, extract first instruction, summarize -- requires live browser MCP execution. This is the most critical tool gap.
- **navigate successfully loads all target chatbot sites:** HTTP validation confirms tidio.com (200, 395KB), crisp.chat (200, 330KB), hubspot.com (200, 674KB), and intercom.com (200, 422KB) are accessible. drift.com returns a 334-byte stub. navigate tool would work for 4 of 5 targets.
- **click would likely detect chatbot launcher after client-side JS loads:** Chatbot launchers are standard DOM elements (buttons, divs with chat-related classes/IDs). Once the widget JavaScript loads and injects the launcher, the click tool should be able to target it via chatLauncher selectors. The selector list in support-chatbot.js covers Tidio, Crisp, Drift, HubSpot, Intercom, and Tawk.to patterns.
- **Chat widget iframe isolation is the key unknown for DOM tools:** If the chat panel renders inside an iframe, then type_text, click (on chat input/send button), read_page, and scroll (on messages container) will all fail because DOM tools cannot cross iframe boundaries. CDP tools (click_at, press_key) would be needed as fallback. This is the most important tool gap to resolve per-platform.
- **type_text may or may not reach chat input inside iframe:** If chat input is in the main DOM: type_text with chatInput selector should work. If inside iframe: type_text will fail and CDP click_at (on input coordinates) + press_key (for character-by-character typing) is required. Cannot determine iframe status without live browser.
- **press_enter or click on sendButton for message submission:** Both approaches are viable -- press_enter after typing in the chat input, or click on the sendButton selector. If inside iframe: CDP press_key with Enter keycode is needed. The site guide recommends trying sendButton click first, press_enter as fallback.
- **wait_for_stable for bot response detection:** After sending each message, the agent must wait for the bot to respond before sending the next. wait_for_stable monitors DOM mutations, which should detect new message elements appearing. If the chat is in an iframe, DOM mutation monitoring may not cross the iframe boundary -- a timed wait (2-3 seconds) would be needed instead.
- **scroll within chat container (not page):** The scroll tool must target the messagesContainer element, not the page body. Scrolling within a specific container requires passing the container selector to the scroll tool. If in iframe: CDP-level scroll targeting would be needed. This is the key tool for reaching the first messages after 15 turns of conversation.
- **read_page for bot message text extraction:** After scrolling to top, read_page targeting the chat panel should extract the first few bot messages. If in iframe: read_page cannot cross iframe boundaries. CDP-level text extraction or screenshot analysis would be needed.
- **15-turn sustainability depends on bot behavior:** Some chatbots end conversation after a few turns ("Is there anything else I can help with?"). The site guide recommends asking new questions to sustain the conversation. Whether 15 turns is achievable depends on the specific chatbot configuration, which cannot be tested via HTTP.
- **No tool for iframe content access:** This is a recurring gap. The MCP toolset has no tool to switch context into an iframe and execute DOM operations inside it. All iframe-hosted content requires CDP coordinate-based interaction (click_at, press_key) rather than selector-based DOM tools.

## Context Bloat Analysis

### Estimated Context Per 15-Turn Chatbot Conversation

Based on the CONTEXT-06 multi-turn chatbot conversation with first-instruction extraction workflow:

- **Step 1 (navigate to chatbot site):** ~2-5KB (URL, status, basic page structure confirmation)
- **Step 2 (detect and click chatbot launcher):** ~3-5KB (launcher detection, click action, wait for panel open)
- **Step 3 (iframe check + pre-chat form):** ~2-4KB (iframe detection result, optional form fill for name/email)
- **Steps 4-18 (15 turns of send-wait-record):**
  - **Full DOM read after every turn:** ~15-50KB per turn (chat widget DOM including all messages, input field, buttons, styling). Total for 15 turns: ~225-750KB. THIS IS THE CONTEXT BLOAT DANGER ZONE.
  - **Compact turn tracking (site guide recommended):** ~200 chars per turn record ({turn: N, sent: "message text", botResponded: true/false, botResponseSnippet: "first 50 chars"}). Total for 15 turns: ~3,000 chars (~3KB). THIS IS THE EFFICIENT APPROACH.
  - **Minimal verification only (most efficient):** ~50 chars per turn ({turn: N, sent: true, botResponded: true}). Total for 15 turns: ~750 chars (~0.75KB). But loses bot response content for context.
- **Step 19 (verify turn count):** ~0.5KB (count confirmation)
- **Step 20 (scroll to top of chat):** ~1-2KB (scroll action, position confirmation)
- **Step 21 (read first messages):** ~2-10KB depending on approach
  - **Full chat history read_page:** ~10-50KB (all 30+ messages including user and bot messages with HTML markup)
  - **Targeted first 3-4 bot messages:** ~1-3KB (only the first few bot message texts)
- **Step 22 (extract and summarize first instruction):** ~0.5KB (verbatim extraction + 1-2 sentence summary)

### Total Context Consumed Across Full 15-Turn Conversation

| Approach | Per-Turn Context | 15-Turn Total | Final History Read | Full Workflow Total | Within Budget? |
|----------|-----------------|---------------|--------------------|--------------------|----------------|
| Full DOM read every turn + full history | 15-50KB | 225-750KB | 10-50KB | 240-810KB | NO -- severe context bloat, likely exceeds model context window |
| Compact turn tracking + targeted history read | ~200 chars | ~3KB | 1-3KB | 12-20KB | YES -- well within budget |
| Minimal verification + deferred full read | ~50 chars | ~0.75KB | 10-50KB | 15-60KB | YES -- efficient during conversation, one large read at end |

### Context Savings: Deferred History Read vs Per-Turn Full DOM Reads

The critical context management strategy for CONTEXT-06 is tracking turns with compact records during conversation and deferring the full chat history read until after all 15 turns are complete.

- **Full DOM approach (15 reads during conversation + 1 at end):** 240-810KB of context consumed. Each turn's read_page captures the entire chat widget DOM including all previous messages, current messages, input field, buttons, and widget chrome. Message count grows linearly: turn 1 has 2 messages, turn 15 has 30 messages. Each read duplicates all previous messages.
- **Deferred approach (compact tracking + 1 read at end):** 12-20KB total. During the 15-turn conversation, only verify that the bot responded (check for new message element presence, not content). After turn 15, scroll to top and read the first 3-4 bot messages to extract the first instruction. Store as compact record: {firstInstruction: "verbatim text", summary: "1-2 sentence summary"}.
- **Context savings: 92-97% reduction** by using compact turn tracking with a single deferred chat history read instead of per-turn full DOM reads.

### Whether Compact {turn, sent, botResponded} Records Are Sufficient During Conversation

Yes. During the 15-turn conversation phase, the agent needs to track only 3 things per turn:
1. `turn` (integer): Which turn number (1-15)
2. `sent` (boolean): Whether the message was successfully sent
3. `botResponded` (boolean): Whether the bot produced a response

Optional 4th field for debugging: `botResponseSnippet` (first 50 characters of bot response) -- useful if the agent needs to respond contextually to the bot's answer, but not required for turn counting.

Total per compact record: ~50-200 characters depending on whether snippet is included. Total for 15 turns: 750-3000 characters. This is approximately 0.75-3KB of context for the entire conversation tracking.

The compact records are sufficient because:
- The CONTEXT-06 task does not require remembering all bot responses -- only the first instruction
- Turn count verification needs only the integer count of sent messages and received responses
- The first instruction is extracted from a single deferred read_page at the end, not accumulated during conversation
- Bot response snippets are optional and only needed if the agent must respond contextually to maintain natural conversation flow

### Comparison to Phase 77 (Polling Loop), Phase 78 (Cell Edit), Phase 79 (Cross-Site), Phase 80 (Multi-Tab), Phase 81 (Checkout Correction)

| Aspect | Phase 77: CONTEXT-01 (30-Min Polling) | Phase 78: CONTEXT-02 (Notebook Edit) | Phase 79: CONTEXT-03 (PDF-to-Form) | Phase 80: CONTEXT-04 (5-Tab Compare) | Phase 81: CONTEXT-05 (Checkout Correction) | Phase 82: CONTEXT-06 (15-Turn Chatbot) |
|--------|---------------------------------------|---------------------------------------|-------------------------------------|---------------------------------------|---------------------------------------------|----------------------------------------|
| Context growth pattern | Linear: grows per polling cycle | Step-wise: fixed set of steps | Two-phase: extract then fill | Parallel: 5 tab DOMs simultaneously | Sequential: grows per checkout step | Linear: grows per conversation turn |
| Total context estimate | ~180-600KB over 30 minutes | ~17-80KB total | ~32-120KB total | ~25-55KB (targeted) | ~20-45KB (targeted) | ~12-20KB (targeted) or ~240-810KB (full DOM per turn) |
| Primary bloat source | Repeated full-page reads | Initial cell enumeration | textLayer extraction per page | Full DOM reads of 5 airline websites | Full checkout page reads at 2 checkpoints | Full chat DOM reads accumulating all messages per turn |
| Mitigation strategy | 2-snapshot retention | Targeted getText per cell | 300-char cap per page | Price-only extraction per tab | Order summary-only extraction (3 values) | Compact turn tracking + single deferred history read |
| Cross-site navigation | No (single site polling) | No (single site editing) | Yes (PDF viewer to form) | Yes (Google Flights + 5 airline tabs) | No (single checkout flow on one site) | No (single chat widget on one site) |
| Data retention pattern | Replace previous with current | Single-page cell positions | 900 chars across navigate | 5 compact records across tab switches | 2 compact records across form correction | 15 compact turn records + 1 deferred first-instruction read |
| Unique challenge | Duration (30 min sustained) | Breadth (38 cells in one page) | Cross-site (data survives URL change) | Multiplicity (5 simultaneous tab contexts) | Form state retention (data survives back-navigation) | Linear message accumulation (30+ messages after 15 turns) |
| Context pressure | High (linear growth over time) | Medium (bounded by step count) | Low-Medium (bounded by page count) | Low (targeted) or Very High (full DOM) | Low (targeted) or Medium (full DOM) | Low (compact tracking) or Very High (per-turn DOM reads) |

**Key insight for CONTEXT-06:** This phase has the highest potential for context bloat among all CONTEXT phases when using the naive approach (reading full chat DOM after every turn). The chat DOM grows linearly -- turn 1 has 2 messages, turn 15 has 30 messages -- and each read_page captures ALL previous messages plus the new ones, creating quadratic growth in total context consumed. The mitigation is straightforward: track turns with compact records (~3KB total) and defer the full history read to a single operation after turn 15. This makes CONTEXT-06 one of the LOWEST context consumers (~12-20KB) when the deferred strategy is applied -- comparable to Phase 81's targeted extraction. The unique risk is not context size but conversation sustainability: can the bot maintain 15 turns of automated responses without ending the conversation, timing out, or requiring human agent escalation?

### Recommendations for Context-Efficient Multi-Turn Chatbot Workflows
1. Track each turn as a compact record: {turn: N, sent: true/false, botResponded: true/false} -- approximately 50 characters per turn
2. Do NOT read the full chat DOM after every turn -- message count grows linearly, making per-turn reads quadratically expensive in total context
3. After each message send, only verify that a new bot message element appeared (check element count or last message timestamp), not the message content
4. Include botResponseSnippet (first 50 chars) only when the agent must respond contextually to the bot's answer -- skip for scripted messages
5. Defer the full chat history read to a single operation after all 15 turns complete
6. When reading chat history, target only the first 3-4 bot messages (for first instruction extraction), not the entire 30+ message history
7. Total context budget for 15-turn chatbot conversation: under 5KB for turn tracking + under 3KB for final first-instruction extraction = under 8KB total

## Bugs Fixed In-Phase
- **Plan 01 -- support-chatbot.js site guide created (6797161):** Created site-guides/utilities/support-chatbot.js with registerSiteGuide call, 10 chatbot provider URL patterns, chatbot15TurnSummary workflow (13 steps), CONTEXT-06 guidance sections (target selection, widget detection, 15-turn conversation strategy, first instruction identification, verification criteria, context bloat mitigation), 9 selector groups, 8 warnings, and 8 tool preferences.
- **Plan 01 -- background.js import wired (69095d3):** Added importScripts for support-chatbot.js in Utilities section of background.js.
- **No runtime bugs found in Plan 02:** No live code was executed that could reveal runtime bugs. The diagnostic is based on HTTP-based analysis.
- **Observation: drift.com returns minimal 334-byte response.** Drift was acquired by Salesloft in February 2023, and the standalone drift.com domain now returns a minimal redirect or stub page. The site guide's drift.com target should be replaced with an alternative chatbot provider (e.g., tawk.to or freshdesk.com) that maintains its own chatbot widget on its marketing site.
- **Observation: tidio.com does not embed code.tidio.co widget script in server HTML.** Despite being a chatbot product company, their own website's server HTML contains no code.tidio.co embed script, no tidioChatApi global, and no chat widget DOM elements. The widget is injected entirely by client-side JavaScript, likely deferred loading. This means the chatLauncher selector with [class*="tidio"] pattern would only match after full client-side hydration.
- **Observation: crisp.chat is the most HTTP-verifiable target.** Crisp.chat embeds CRISP_WEBSITE_ID directly in server HTML with 6 crisp-client library references, providing the strongest evidence of chatbot widget presence without requiring live browser rendering. Recommend promoting crisp.chat to primary target over tidio.com for HTTP-validated testing scenarios.

## Autopilot Recommendations

1. **Detect the chatbot platform early by checking for known widget script patterns before attempting interaction.** Look for: code.tidio.co (Tidio), CRISP_WEBSITE_ID (Crisp), hs-script-loader (HubSpot), intercomSettings or intercom-container (Intercom), embed.tawk.to (Tawk.to), freshdesk widget scripts (Freshdesk). Knowing the platform determines which selectors are most reliable and whether the widget uses an iframe.

2. **Check for iframe isolation BEFORE attempting DOM tools -- saves failed tool attempts.** After clicking the chat launcher and the panel opens, immediately check if an iframe with a chat-related src exists (chatIframe selector). If yes: skip all DOM tool attempts and go directly to CDP tools (click_at for positioning, press_key for typing). This saves 2-3 failed tool invocations per interaction, reducing both context and iteration count.

3. **Wait for bot response after EACH message -- do not rapid-fire all 15 messages.** Chatbots have processing time (1-5 seconds typically). If messages are sent before the bot finishes responding, the conversation becomes asynchronous and turn count verification becomes unreliable. After each send: wait_for_stable (DOM mutation monitoring) or a fixed 3-second delay, then verify a new botMessage element appeared before proceeding.

4. **Track turn count as a simple integer counter, not by re-reading and counting chat messages.** Maintain a local counter: increment after each successful send + bot response pair. Do not use read_page to count message elements after every turn -- this is the primary source of context bloat. The counter occupies 2 bytes vs 15-50KB per read_page invocation.

5. **Defer the full chat history read until ALL 15 turns are complete -- only verify last response appeared during conversation.** During turns 1-14: check that a new message appeared (element count check or DOM stability). After turn 15: scroll to top and do ONE read_page to find the first instruction. This reduces context from ~240-810KB (per-turn reads) to ~12-20KB (compact tracking + one final read).

6. **Sustain conversation by asking new questions if bot tries to end early.** If the bot responds with "Is there anything else I can help with?" or "Glad I could help!" -- treat this as an opportunity to ask the next scripted question, not as a conversation end signal. Most chatbots will re-engage with a new question. Only stop at turn 15.

7. **Handle pre-chat forms (name/email) as turn 0, not part of the 15-turn count.** Some chatbots require name and email before the first message. Use "Test User" / "test@example.com" to fill these fields. This is not a conversation turn -- it is widget setup. Start counting turns from the first actual message sent.

8. **Scroll WITHIN the chat container to reach first messages, not the page body.** The scroll tool must target the messagesContainer element specifically. If the chat widget has its own scrollable area (which most do), scrolling the page body will not move the chat history. Use: scroll(selector=messagesContainer, direction=up, amount=large). If in iframe: CDP scroll at the chat panel coordinates.

9. **Extract the first INSTRUCTION, not the first GREETING -- skip "Hi, how can I help?" and find actionable guidance.** The first bot message is typically a greeting: "Hi! How can I help you today?" This is NOT the first instruction. Scan the first 3-4 bot messages for the first one containing actionable language: "Click...", "Go to...", "You can find...", "To get started...", "Here is..." -- this is the first instruction to summarize.

10. **If chatbot is live-agent-only (no automated response after 30 seconds), move to next target immediately.** Some chat widgets connect to human agents, not bots. If no automated response appears within 30 seconds of the first message, the widget is live-agent-only. Close the chat, navigate to the next target in the fallback list. Do not wait indefinitely for a human to respond.

## Selector Accuracy
| Selector | Expected | Actual | Match |
|----------|----------|--------|-------|
| chatLauncher: `[class*="tidio"]` | Tidio chat launcher button on tidio.com | NOT FOUND in server HTML -- widget is client-side injected. No element with "tidio" class in static markup. The "tidio-chat" strings are all href links to app store listings, not DOM elements. | UNTESTABLE (requires live browser) |
| chatLauncher: `[class*="crisp"]` | Crisp chat launcher on crisp.chat | NOT FOUND as DOM element in server HTML. However, CRISP_WEBSITE_ID and crisp-client library ARE present, confirming widget infrastructure. Widget elements injected after JS execution. | UNTESTABLE (requires live browser, but infrastructure confirmed) |
| chatLauncher: `[aria-label*="chat" i]` | Generic chat launcher by ARIA label | NOT FOUND in any target site server HTML. Chat launchers are client-side injected. | UNTESTABLE (requires live browser) |
| chatInput: `textarea[placeholder*="message" i]` | Chat input field for typing messages | NOT FOUND in any target site server HTML. Input fields are inside widget (possibly inside iframe). | UNTESTABLE (requires live browser) |
| sendButton: `button[aria-label*="send" i]` | Send button in chat widget | NOT FOUND in any target site server HTML. Button is inside widget. | UNTESTABLE (requires live browser) |
| messagesContainer: `[class*="messages"]` | Chat messages scrollable container | NOT FOUND in any target site server HTML. Container is inside widget. | UNTESTABLE (requires live browser) |
| botMessage: `[class*="bot-message"]` | Individual bot response message element | NOT FOUND in any target site server HTML. Messages are inside widget. | UNTESTABLE (requires live browser) |
| chatIframe: `iframe[src*="widget"]` | Iframe containing the chat widget | NOT FOUND in any target site server HTML (only GTM iframe on tidio.com). Chat iframes are injected by client-side JS. | UNTESTABLE (requires live browser) |
| chatIframe: `iframe[src*="tidio"]` | Tidio-specific chat iframe | NOT FOUND in tidio.com server HTML. Tidio widget iframe created dynamically. | UNTESTABLE (requires live browser) |
| chatIframe: `iframe[src*="crisp"]` | Crisp-specific chat iframe | NOT FOUND in crisp.chat server HTML. Crisp widget created dynamically. CRISP_WEBSITE_ID confirmed present. | UNTESTABLE (requires live browser, but CRISP_WEBSITE_ID verified) |

**Note:** All chatbot widget selectors from support-chatbot.js are inherently untestable via HTTP because chatbot widgets are universally client-side injected. These selectors are designed for live browser DOM interaction after JavaScript execution. The selector patterns are based on common chatbot widget DOM structures documented by Tidio, Crisp, Intercom, HubSpot, and other providers. Validation requires live browser MCP execution.

## New Tools Added This Phase
| Tool Name | File | Purpose | Parameters |
|-----------|------|---------|------------|
| support-chatbot.js site guide | site-guides/utilities/support-chatbot.js | Site guide with chatbot15TurnSummary workflow (13 steps), CONTEXT-06 guidance, 10 chatbot provider URL patterns, 9 selector groups, 8 warnings, iframe-aware interaction strategies | N/A (site guide, not MCP tool) |

No new MCP tools were added in this phase. The support-chatbot.js site guide provides workflow guidance and selector patterns for chatbot interaction using existing MCP tools (click, type_text, press_enter, read_page, scroll, wait_for_stable, click_at, press_key).
