# FSB (Full Self-Browsing)

## What This Is

FSB is an AI-powered browser automation Chrome extension that executes tasks through natural language instructions. Users describe what they want done ("search for wireless mouse on Amazon, add the first result to cart") and FSB figures out the clicks, types, and navigation to make it happen. It's for everyone who browses - developers, non-technical users, anyone who wants to automate repetitive browser tasks.

## Core Value

**Reliable single-attempt execution.** The AI decides correctly; the mechanics must execute precisely. Every click should hit the right element, every action should succeed on the first try.

## Requirements

### Validated

- ✓ Chrome Extension MV3 architecture with service worker — existing
- ✓ Multi-provider AI integration (xAI, OpenAI, Anthropic, Gemini) — existing
- ✓ DOM analysis and element identification — existing
- ✓ Action execution toolset (25+ browser actions) — existing
- ✓ Session management with state tracking — existing
- ✓ Stuck detection and recovery mechanisms — existing
- ✓ Multi-UI (popup chat, sidepanel, options dashboard) — existing
- ✓ Analytics and usage tracking — existing
- ✓ Secure API key storage with encryption — existing
- ✓ Conversation history for multi-turn tasks — existing

### Active

- [ ] Precise element targeting - clicks hit the intended element on first attempt
- [ ] Visual feedback - orange glow highlighting the element being targeted before action
- [ ] Fast execution - minimal delays between actions, no unnecessary waiting
- [ ] Reliable selectors - generated selectors uniquely identify elements across diverse sites
- [ ] Quality context - AI receives focused, relevant DOM information (not noise)
- [ ] Action verification - confirm action succeeded before moving to next step
- [ ] Clear debugging - visibility into what's being targeted and why actions fail

### Out of Scope

- Firefox support — requires significant Manifest V2/V3 adaptation, defer to future
- CAPTCHA solving — third-party integration complexity, users can solve manually
- Multi-tab automation — adds complexity, single-tab focus first
- Offline mode — AI requires connectivity, not feasible for core functionality

## Context

**Current state:** The extension works but is unreliable. AI decisions are generally correct, but the mechanics layer fails frequently - wrong elements clicked, selectors don't match, actions need multiple retries. Simple tasks eventually complete through trial and error.

**Key technical debt from codebase analysis:**
- `content.js` is 6502 lines - DOM traversal, action handlers, and utilities all interleaved
- `background.js` is 4600 lines - session management, tab handling, automation loop tangled
- Selector generation is untested and produces unreliable selectors
- AI response parsing has 4 different strategies with regex patterns that break on edge cases
- No visual feedback - users can't see what the extension is trying to do
- Magic numbers throughout (maxElements=300, stuckCounter>=8, etc.)

**What's actually broken:**
1. **Element targeting** - selectors generated from DOM analysis don't reliably match the intended element
2. **Action execution** - clicks and types sometimes fail silently or hit wrong targets
3. **Context quality** - AI gets too much noise (300 elements max) making it hard to find what matters
4. **No visibility** - impossible to debug because there's no indication of what's being targeted

## Constraints

- **Platform**: Chrome Extension Manifest V3 - service worker lifecycle, message passing patterns
- **No build system**: Direct JavaScript execution, no transpilation - keep it simple
- **AI dependency**: Relies on external AI APIs - must handle latency, rate limits, failures gracefully
- **Browser security**: Content scripts run in isolated world, limited access to page JavaScript context

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Focus on mechanics, not AI | User confirmed AI intent is correct, execution layer is the problem | — Pending |
| Visual feedback with orange glow | User specifically requested seeing what's being targeted | — Pending |
| Single-attempt reliability over retry sophistication | Core value is precision, not recovery from imprecision | — Pending |

---
*Last updated: 2026-02-03 after initialization*
