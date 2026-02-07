# Claude for Chrome Extension

## Overview

Claude for Chrome is Anthropic's official browser extension that enables Claude to interact with web pages, making it a powerful tool for web-based automation and research tasks. It was launched in March 2025 and is available to paid Claude users (Pro, Max, Team, Enterprise).

## Key Features

### 1. Direct Web Page Interaction
Claude can view and interact with the active browser tab, enabling:
- Reading and analyzing web content
- Filling out forms
- Clicking buttons and links
- Navigating between pages
- Extracting data from websites

### 2. Multi-Tab Workflows
- Work across multiple browser tabs simultaneously
- Coordinate actions between different websites
- Maintain context across tab switches
- Handle complex multi-step workflows

### 3. Scheduled Tasks
- Schedule recurring automation tasks
- Set up periodic data extraction
- Automate routine web activities
- Background task execution

### 4. Workflow Recording
- Record manual browser interactions
- Convert recordings to replayable automations
- Edit and customize recorded workflows
- Share workflows with team members

## Technical Architecture

### Native Messaging Integration

Claude for Chrome uses Chrome's Native Messaging API to communicate with Claude Code (the CLI tool):

```
+----------------+     Native Messaging     +-------------+
| Chrome         | <-------------------->   | Claude Code |
| Extension      |     (JSON messages)      | CLI         |
+----------------+                          +-------------+
        |                                          |
        v                                          v
+----------------+                          +-------------+
| Content Script |                          | Anthropic   |
| (DOM Access)   |                          | API         |
+----------------+                          +-------------+
```

### Message Flow

1. **User Request**: User types a command in Claude Code or Claude web interface
2. **Extension Activation**: Native Message sent to Chrome extension
3. **DOM Analysis**: Content script analyzes the current page
4. **AI Processing**: Claude processes the page state and determines actions
5. **Action Execution**: Extension executes the determined actions
6. **Response**: Results sent back through the message chain

### Content Script Capabilities

The content script has access to:
- Full DOM tree traversal
- Element visibility and positioning
- Form state and input values
- Event triggering (click, type, submit)
- Screenshot capture
- Mutation observation

## Claude Code Integration

### Configuration

Claude Code can connect to the Chrome extension when both are installed:

```bash
# Check extension status
claude --extension-status

# Enable browser features
claude config set browser.enabled true
```

### Usage Examples

```bash
# Research task
claude "Find the latest pricing on example.com and summarize"

# Form filling
claude "Fill out the contact form on this page with my info"

# Data extraction
claude "Extract all product names and prices from this catalog page"
```

### Permission Model

The extension requires explicit user consent for:
- Reading page content
- Executing actions
- Accessing sensitive data
- Cross-origin requests

## Safety and Security

### Prompt Injection Defenses

Anthropic implemented multiple layers of defense:

1. **Site-Level Permissions**: Users must grant access to specific domains
2. **Action Confirmations**: Sensitive actions require user approval
3. **Content Isolation**: Page content is sandboxed from control flow
4. **Rate Limiting**: Prevents rapid automated attacks

### Attack Mitigation Results

| Scenario | Without Mitigation | With Mitigation |
|----------|-------------------|-----------------|
| General attacks | 23.6% success | 11.2% success |
| Browser-specific | 35.7% success | 0% success |

### Best Practices

- Only enable on trusted websites
- Review action confirmations carefully
- Use minimal permissions
- Monitor extension activity logs
- Keep extension updated

## Requirements

### System Requirements
- Google Chrome 88+ or Chromium-based browser
- Claude Pro, Max, Team, or Enterprise subscription
- (Optional) Claude Code CLI for enhanced integration

### Permissions Requested
- `activeTab` - Access current tab content
- `scripting` - Inject content scripts
- `storage` - Store settings and session data
- `nativeMessaging` - Communicate with Claude Code

## Comparison with FSB

| Feature | Claude for Chrome | FSB |
|---------|------------------|-----|
| DOM Analysis | Yes | Yes |
| Screenshot Capture | Yes | No |
| Multi-tab Support | Yes | Planned |
| Scheduling | Yes | No |
| Workflow Recording | Yes | No |
| API Integration | Anthropic only | Multi-provider |
| Open Source | No | Yes |
| Offline Capable | No | No |

## API Endpoints

The extension communicates with Anthropic's servers through these endpoints:

```
POST /v1/browser/analyze   - Analyze page content
POST /v1/browser/action    - Execute browser action
GET  /v1/browser/status    - Check session status
POST /v1/browser/workflow  - Save/load workflows
```

## Event System

### Content Script Events

```javascript
// Page loaded
chrome.runtime.sendMessage({ type: 'PAGE_LOADED', url, title });

// DOM changed
chrome.runtime.sendMessage({ type: 'DOM_CHANGED', mutations });

// Action completed
chrome.runtime.sendMessage({ type: 'ACTION_COMPLETE', result });

// Error occurred
chrome.runtime.sendMessage({ type: 'ERROR', error });
```

### Background Script Handling

```javascript
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'PAGE_LOADED':
      handlePageLoad(message, sender.tab);
      break;
    case 'DOM_CHANGED':
      handleDOMChange(message);
      break;
    // ... other handlers
  }
});
```

## Limitations

1. **Paid Only**: Not available for free Claude users
2. **Chrome Only**: No Firefox or Safari support currently
3. **Cloud Required**: Requires internet connection to Anthropic servers
4. **No Custom Models**: Cannot use alternative AI providers
5. **Limited Customization**: Fewer configuration options than FSB

## Future Roadmap (Announced)

- Firefox extension support
- Offline mode with local models
- Advanced workflow editor
- Team collaboration features
- API access for developers

---

*References:*
- [Claude for Chrome Blog](https://claude.com/blog/claude-for-chrome)
- [Chrome Integration Docs](https://code.claude.com/docs/en/chrome)
