# FSB Research Documentation

This folder contains comprehensive research on Claude for Chrome, Model Context Protocol (MCP), and related AI browser automation technologies. This research informs FSB's architecture decisions and helps identify opportunities for improvement.

## Table of Contents

### Core Documentation

1. **[Claude for Chrome](./claude-for-chrome.md)**
   - Anthropic's official browser extension
   - Native Messaging integration with Claude Code
   - Multi-tab workflows and scheduling features
   - Safety and security architecture

2. **[MCP Protocol](./mcp-protocol.md)**
   - Model Context Protocol fundamentals
   - Core primitives: Tools, Resources, Prompts
   - Client primitives: Sampling, Elicitation, Logging
   - JSON-RPC 2.0 message format

3. **[MCP Architecture](./mcp-architecture.md)**
   - Host, Client, Server relationships
   - Transport layer (STDIO vs HTTP+SSE)
   - Building MCP servers in Python and TypeScript
   - Practical implementation examples

4. **[Computer Use API](./computer-use-api.md)**
   - Desktop automation via screenshots
   - Mouse and keyboard control
   - Agent loop implementation
   - Best practices and prompting strategies

5. **[Security Mitigations](./security-mitigations.md)**
   - Prompt injection vulnerabilities
   - Anthropic's defense mechanisms
   - Site-level permissions
   - Content isolation rules

6. **[Implementation Comparison](./implementation-comparison.md)**
   - FSB vs Claude for Chrome approaches
   - DOM analysis vs screenshot-based automation
   - Action execution strategies
   - Improvement opportunities for FSB

## Quick Reference

| Technology | Purpose | FSB Relevance |
|------------|---------|---------------|
| Claude for Chrome | Browser automation via extension | Direct competitor, architectural reference |
| MCP | AI-to-system integration standard | Potential integration path |
| Computer Use API | Screenshot-based automation | Alternative approach to DOM analysis |
| Native Messaging | Extension-to-CLI communication | Future Claude Code integration |

## Key Insights for FSB

1. **DOM Analysis vs Screenshots**: FSB uses direct DOM analysis which is faster and more precise than screenshot-based approaches, but may miss visually-rendered content.

2. **Security Model**: Anthropic's site-level permissions and content isolation provide a robust security model worth adopting.

3. **MCP Integration**: Adding MCP server capabilities to FSB could enable integration with Claude Code and other MCP clients.

4. **Hybrid Approach**: Combining DOM analysis with selective screenshot capture for complex UI elements could improve reliability.

## Sources

- [Claude for Chrome Blog Post](https://claude.com/blog/claude-for-chrome)
- [Model Context Protocol](https://modelcontextprotocol.io/)
- [Computer Use Documentation](https://platform.claude.com/docs/en/docs/build-with-claude/computer-use)
- [Chrome Integration Docs](https://code.claude.com/docs/en/chrome)
- [Prompt Injection Research](https://www.anthropic.com/research/prompt-injection-defenses)
- [MCP GitHub](https://github.com/modelcontextprotocol)

---

*Last Updated: February 2026*
*Part of FSB v0.9.1.0 Research Initiative*
