# Phase 82: Support Chatbot 15-Turn Summary - Context

**Gathered:** 2026-03-22
**Status:** Ready for planning

<domain>
## Phase Boundary
Execute 15-turn support chatbot conversation then summarize first instruction via MCP manual tools; fix blockers.
</domain>

<decisions>
## Implementation Decisions
- Find a website with a support chatbot (live chat widget)
- Send 15 messages to the chatbot
- After 15 turns, scroll back to find and summarize the first instruction given
- PASS = 15 messages sent + first instruction identified and summarized
- PARTIAL = some messages sent but couldn't complete 15 turns or find first instruction
- skip-auth if chatbot requires login
- Same diagnostic report template
- Claude's discretion: which chatbot, message content, extraction method
</decisions>

<canonical_refs>
- `mcp-server/src/tools/manual.ts` -- click, type_text, press_enter, read_page, scroll
- `.planning/REQUIREMENTS.md` -- CONTEXT-06
- `.planning/ROADMAP.md` -- Phase 82 success criteria
</canonical_refs>

<code_context>
- click for opening chat widget and send button
- type_text for message input
- press_enter as send alternative
- read_page/scroll for chat history navigation
- Many chatbots use iframe -- may need CDP tools
</code_context>
