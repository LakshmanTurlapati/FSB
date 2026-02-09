# FSB v9.0.1 - Full Self-Browsing

<div align="center">

<img src="Assets/fsb.png" alt="FSB Logo" width="200" />

[![Version](https://img.shields.io/badge/version-9.0.1-blue.svg)](https://github.com/lakshmanturlapati/FSB/releases)
[![Status](https://img.shields.io/badge/status-production--ready-green.svg)](https://github.com/lakshmanturlapati/FSB)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Chrome Extension](https://img.shields.io/badge/platform-Chrome%20Extension-yellow.svg)](https://developer.chrome.com/docs/extensions/)
[![Multi-Model AI](https://img.shields.io/badge/AI-xAI%20%7C%20OpenAI%20%7C%20Anthropic%20%7C%20Gemini-purple.svg)](https://github.com/lakshmanturlapati/FSB)
[![Open Source](https://img.shields.io/badge/open%20source-FSB-red.svg)](https://github.com/lakshmanturlapati/FSB)

**An intelligent, open-source browser automation assistant powered by multiple AI models**

*Inspired by Project Mariner, built for everyone*

[Quick Start](#quick-start) | [Architecture](#documentation) | [Configuration](#configuration) | [AI Integration](#multi-model-ai-integration) | [Contributing](#contributing)

</div>

---

## Overview

> **Note**: While FSB v9.0.1 is production-ready and fully functional, browser automation can behave unpredictably on complex sites. Always monitor automation actions and test on non-critical pages first. Feedback and contributions are welcome!

FSB (Full Self-Browsing) is a powerful Chrome extension that brings AI-powered browser automation to your fingertips. Simply describe what you want to accomplish in natural language, and FSB will analyze the webpage, plan the necessary actions, and execute them automatically. Choose from **four AI providers** -- xAI Grok, OpenAI GPT, Anthropic Claude, and Google Gemini -- with 20+ model options.

### Key Features

- **Multi-Model AI Support**: Four fully integrated providers -- xAI Grok, OpenAI GPT, Anthropic Claude, and Google Gemini -- with 20+ models
- **Universal Provider Architecture**: Model-agnostic engine that works with any OpenAI-compatible API, with automatic parameter discovery and self-healing
- **Natural Language Interface**: Describe tasks in plain English -- no scripting required
- **Smart DOM Analysis**: Advanced webpage structure analysis with incremental diffing and element identification
- **Comprehensive Action Library**: 40+ browser actions -- click, type, scroll, navigate, multi-tab control, form handling, and more
- **Site-Specific Intelligence**: Domain-specific guides for e-commerce, finance, social media, travel, and coding platforms
- **Visual Feedback**: Viewport glow indicators, element-level action highlights, and progress overlay with step counting
- **Smart DOM Waiting**: Event-driven waiting based on DOM mutations and loading state detection, not fixed delays
- **Markdown and Diagram Rendering**: Rich chat output with mermaid diagrams and Chart.js charts
- **Action Verification**: Post-action state validation to confirm actions had their intended effect
- **Multi-Tab Support**: Open, close, switch, and list browser tabs during automation
- **Dark Theme**: Full dark mode across all interfaces (popup, side panel, options)
- **Analytics and Monitoring**: Usage tracking, token counting, cost calculation, and performance insights per model
- **CAPTCHA Integration**: Built-in framework for CAPTCHA solving services
- **Secure Configuration**: AES-GCM encrypted API key storage
- **Smart Recovery**: Automatic stuck detection with DOM hashing, action pattern analysis, and adaptive behavior
- **Multiple UI Modes**: Popup chat and persistent side panel interfaces

### Use Cases

- **Web Testing**: Automate repetitive testing workflows
- **Data Entry**: Fill forms and submit information across multiple sites
- **Research**: Navigate and extract information from websites
- **Social Media**: Automate posting and interaction tasks
- **E-commerce**: Product research and comparison shopping
- **Finance**: Stock lookups, portfolio monitoring, financial data gathering
- **Development**: Coding platform automation, GitHub workflows, code review navigation
- **Productivity**: Streamline routine browsing tasks

> **Tip**: Always monitor automation results and start with simple tasks to build familiarity. Your feedback helps improve accuracy!

---

## Quick Start

### Prerequisites

- Google Chrome (version 88+) or any Chromium-based browser (Edge, Brave, etc.)
- **One API key** from any supported provider (only one is required):
  - xAI Grok API key ([Get one here](https://x.ai/api)) -- recommended for automation
  - OpenAI API key ([Get one here](https://platform.openai.com/api-keys))
  - Anthropic API key ([Get one here](https://console.anthropic.com/))
  - Google Gemini API key ([Get one here](https://ai.google.dev/)) -- includes a FREE tier (Gemini 2.0 Flash)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/lakshmanturlapati/FSB.git
   cd FSB
   ```

2. **Load the extension in Chrome**
   - Open `chrome://extensions/`
   - Enable "Developer mode" (top right)
   - Click "Load unpacked"
   - Select the FSB directory

3. **Start automating!**
   - Click the FSB extension icon
   - Configure your preferred AI model and API key in settings
   - Enter a task like "Search for cats on Google"
   - Watch FSB work (and monitor the actions!)

### First Steps

1. **Configure your AI model**: Click settings and choose between Grok, GPT, Claude, or Gemini
2. **Test the connection**: Use the "Test API" button to verify your chosen model works
3. **Start simple**: Try basic tasks like "scroll down" or "click the search button"
4. **Monitor actions**: Watch what FSB does -- visual feedback shows each step
5. **Explore features**: Try the side panel mode for persistent access during browsing
6. **Share feedback**: Report issues or suggestions to help improve FSB

---

## Documentation

### Architecture Overview

FSB follows a modular architecture designed for reliability and extensibility:

```mermaid
graph TD
    A[User Interface<br/>Popup & Side Panel] --> B[Background Service<br/>Session Orchestration]
    B --> C[Content Script<br/>DOM Analysis & Actions]
    C --> D[Web Page<br/>Automated Interactions]
    B --> E[Universal Provider<br/>xAI | OpenAI | Anthropic | Gemini]
    B --> F[Chrome Storage<br/>Settings & Analytics]
    B --> G[Site Guides<br/>Domain Intelligence]
    C --> H[Action Verification<br/>State Validation]
```

**Architecture Components:**

**User Interface Layer:**
- **Popup Chat Interface**: Quick task execution with compact chat UI and markdown rendering
- **Side Panel Interface**: Persistent automation sessions that stay visible while browsing
- **Options Dashboard**: Comprehensive configuration, analytics, session history, and log viewer

**Background Service Worker:**
- **Session Management**: Orchestrates automation workflows and maintains state
- **Universal Provider**: Model-agnostic AI communication with automatic parameter discovery across all providers
- **Configuration Manager**: Handles secure settings storage with AES-GCM encryption
- **Analytics Tracking**: Monitors usage, performance, and cost calculations per model
- **Site Guide Loader**: Matches current domain to specialized automation guides

**Content Script Layer:**
- **DOM Analysis**: Advanced webpage structure parsing with incremental diffing
- **Action Execution**: 40+ browser actions with smart delays and error handling
- **Action Verification**: Post-action state validation to confirm intended effects
- **Visual Feedback System**: Viewport glow, element highlights, and progress overlay
- **DOM State Management**: Incremental DOM diffing for efficient change detection

**External Services:**
- **AI APIs**: xAI Grok, OpenAI GPT, Anthropic Claude, Google Gemini
- **CAPTCHA Services**: Optional integration for automated CAPTCHA solving

### Core Components

| File | Description |
|------|-------------|
| `background.js` | Service worker -- session orchestration and AI communication |
| `content.js` | DOM analysis, action execution, and visual feedback |
| `ai-integration.js` | Prompt engineering, task type detection, and response parsing |
| `universal-provider.js` | Model-agnostic AI provider with automatic parameter discovery |
| `config.js` | Configuration management with model validation |
| `secure-config.js` | AES-GCM encrypted API key storage |
| `init-config.js` | First-run setup and configuration migration |
| `analytics.js` | Usage tracking, token counting, and cost calculation |
| `automation-logger.js` | Structured logging with session recording |
| `action-verification.js` | Post-action state validation and outcome detection |
| `dom-state-manager.js` | Incremental DOM diffing for change detection |
| `keyboard-emulator.js` | Chrome DevTools Protocol key emulation |
| `markdown-renderer.js` | Markdown, mermaid diagram, and Chart.js rendering |
| `site-explorer.js` | Automated website reconnaissance via BFS crawling |
| `site-guides/` | Domain-specific automation intelligence (see [Site Intelligence](#site-specific-intelligence)) |
| `popup.html/js/css` | Popup chat interface |
| `sidepanel.html/js/css` | Persistent side panel interface |
| `options.html/js/css` | Settings dashboard with analytics and log viewer |

### Task Flow

1. **Input**: User describes task in natural language
2. **Analysis**: FSB analyzes current webpage structure (DOM elements, forms, navigation)
3. **Planning**: AI generates step-by-step action plan based on page context and site guides
4. **Execution**: Actions are executed with smart delays, visual feedback, and error handling
5. **Verification**: Post-action state validation confirms actions had their intended effect
6. **Iteration**: Process repeats until task completion, stuck detection triggers recovery, or timeout
7. **Feedback**: User receives real-time updates and final results in the chat interface

---

## Configuration

### Basic Setup

Access settings through the extension popup or options page:

- **AI Provider and Model**: Choose your provider and model (see table below)
- **API Keys**: Configure keys for your chosen AI provider(s)
- **Action Delay**: Customize timing between actions (500-5000ms)
- **Max Iterations**: Set automation loop limits (5-50)
- **Debug Mode**: Enable detailed logging for troubleshooting
- **DOM Optimization**: Configure element limits and viewport prioritization

### Supported Models

#### xAI Grok
| Model | Description | Cost (per 1M tokens) |
|-------|-------------|---------------------|
| **grok-4-1-fast** | High-speed with reasoning, 2M context (Recommended) | $0.20 / $0.50 |
| grok-4-1-fast-non-reasoning | Without reasoning for faster responses | $0.20 / $0.50 |
| grok-4 | Complex reasoning model | $3.00 / $15.00 |
| grok-code-fast-1 | Dedicated code generation and debugging | $0.20 / $1.50 |
| grok-3 | Legacy flagship model | $5.00 / $25.00 |
| grok-3-mini | Budget option with reasoning | $0.30 / $1.50 |

#### OpenAI GPT
| Model | Description | Cost (per 1M tokens) |
|-------|-------------|---------------------|
| **gpt-4o** | Most capable multimodal model | $5.00 / $20.00 |
| chatgpt-4o-latest | Always newest GPT-4o version | $5.00 / $20.00 |
| gpt-4o-mini | Affordable and fast | $0.15 / $0.60 |
| gpt-4-turbo | Previous generation flagship | $10.00 / $30.00 |

#### Anthropic Claude
| Model | Description | Cost (per 1M tokens) |
|-------|-------------|---------------------|
| **claude-sonnet-4-5** | Latest flagship with 200K context | $3.00 / $15.00 |
| claude-haiku-4-5 | Fast and cost-effective, 200K context | $1.00 / $5.00 |
| claude-opus-4-1 | Most powerful reasoning model | $15.00 / $75.00 |
| claude-sonnet-4 | Previous Sonnet version | $3.00 / $15.00 |
| claude-sonnet-3.7 | Extended thinking variant | $3.00 / $15.00 |

#### Google Gemini
| Model | Description | Cost (per 1M tokens) |
|-------|-------------|---------------------|
| **gemini-2.5-flash** | Latest with thinking capabilities | $0.30 / $2.50 |
| gemini-2.5-flash-lite | Budget option with 1M context | $0.10 / $0.40 |
| gemini-2.5-pro | Most powerful with 2M context | $1.25 / $10.00 |
| gemini-2.0-flash | Fast and efficient (FREE) | $0.00 / $0.00 |

#### Cost Tiers

- **Free**: Gemini 2.0 Flash (experimental)
- **Budget**: grok-4-1-fast ($0.20/$0.50) or GPT-4o Mini ($0.15/$0.60)
- **Balanced**: Gemini 2.5 Flash ($0.30/$2.50) or Claude Haiku 4.5 ($1.00/$5.00)
- **Performance**: GPT-4o ($5.00/$20.00) or Claude Sonnet 4.5 ($3.00/$15.00)
- **Maximum**: Claude Opus 4.1 ($15.00/$75.00) or Gemini 2.5 Pro ($1.25/$10.00)

### Advanced Configuration

#### Extension Options Page
Configure all settings through the extension's built-in options page:

1. **Right-click the extension icon** then select "Options"
2. **Or visit**: `chrome-extension://[extension-id]/options.html`

#### Security Features
- **Encrypted Storage**: API keys are automatically encrypted using AES-GCM in Chrome storage
- **Secure Configuration**: No plain-text files or environment variables needed
- **Session Management**: Automatic cleanup and secure key handling
- **XSS Protection**: DOMPurify sanitization for all rendered chat content
- **Tab Security**: Automation is restricted to the active session tab

---

## Development

### Project Structure

```
FSB/
  Assets/                     # Icons and images
  lib/                        # Third-party libraries
    marked.min.js             # Markdown parser
    purify.min.js             # DOMPurify for XSS protection
    mermaid.min.js            # Mermaid diagram renderer
  Logs/                       # Session logs (generated at runtime)
  site-guides/                # Domain-specific AI guides
    index.js                  # Guide registry and URL pattern matcher
    ecommerce.js              # Amazon, eBay, Walmart, etc.
    finance.js                # Yahoo Finance, TradingView, etc.
    social.js                 # Social media platforms
    travel.js                 # Flight and hotel booking
    coding.js                 # GitHub, LeetCode, etc.
  manifest.json               # Extension manifest (Manifest V3)
  background.js               # Service worker - session orchestration
  content.js                  # DOM analysis and action execution
  ai-integration.js           # AI prompt engineering and response parsing
  universal-provider.js       # Model-agnostic AI provider
  config.js                   # Configuration management
  secure-config.js            # AES-GCM encrypted storage
  init-config.js              # First-run setup and migration
  analytics.js                # Usage tracking and cost calculation
  automation-logger.js        # Structured session logging
  action-verification.js      # Post-action state validation
  dom-state-manager.js        # Incremental DOM diffing
  keyboard-emulator.js        # DevTools Protocol key emulation
  markdown-renderer.js        # Markdown, mermaid, Chart.js rendering
  site-explorer.js            # Website reconnaissance crawler
  popup.html/js/css           # Popup chat interface
  sidepanel.html/js/css       # Persistent side panel
  options.html/js/css         # Settings and analytics dashboard
  markdown.css                # Markdown rendering styles
  CLAUDE.md                   # Development notes and architecture
```

### Building and Testing

```bash
# Clone the repository
git clone https://github.com/lakshmanturlapati/FSB.git
cd FSB

# Load in Chrome for testing
# Open chrome://extensions/ in developer mode
# Click "Load unpacked" and select the FSB directory
```

No build step or npm install is required -- FSB runs directly as a Chrome extension.

### Debugging

- Enable **Debug Mode** in the options page for detailed logging
- Check the **background script console** via `chrome://extensions/` (click "Inspect views: service worker")
- Use the **log viewer** in the options page to review session history and action logs
- Check the **browser console** on any page for content script logs

### Contributing Guidelines

1. **Fork the repository** and create a feature branch
2. **Follow the existing code style** and patterns
3. **Test thoroughly** across different websites and scenarios
4. **Update documentation** for any API changes
5. **Submit a pull request** with a clear description of changes

---

## Multi-Model AI Integration

FSB supports four AI providers through a universal, model-agnostic architecture. Each provider has unique strengths for browser automation.

### Supported AI Providers

#### xAI Grok
- **Strengths**: Fast responses, creative problem-solving, handles complex web interactions
- **Best for**: Dynamic websites, real-time automation, unconventional UI patterns
- **Recommended model**: `grok-4-1-fast` -- 2M context window, high speed, low cost

#### OpenAI GPT
- **Strengths**: Broad knowledge base, reliable structured output, strong reasoning
- **Best for**: General-purpose automation, data extraction, multi-step workflows
- **Recommended model**: `gpt-4o` -- multimodal understanding, consistent results

#### Anthropic Claude
- **Strengths**: Advanced reasoning, strong code understanding, careful and thorough
- **Best for**: Complex forms, code-heavy sites, tasks requiring nuanced understanding
- **Recommended model**: `claude-sonnet-4-5` -- balanced performance and cost

#### Google Gemini
- **Strengths**: Reliable structured output, analytical approach, FREE tier available
- **Best for**: Structured forms, data entry, systematic workflows, budget-conscious usage
- **Recommended model**: `gemini-2.5-flash` -- latest with thinking capabilities

### Universal Provider Architecture

FSB's universal provider eliminates the need for provider-specific code:

- **Any OpenAI-compatible API**: Works with any endpoint that follows the OpenAI chat completions format
- **Automatic parameter discovery**: Learns what parameters each API supports by retrying on errors
- **Self-healing**: Adapts automatically when APIs change or add/remove parameters
- **Configuration caching**: Remembers successful configurations per model for faster subsequent calls
- **Custom endpoints**: Add new providers by configuring an endpoint URL -- no code changes required

### Advanced Prompt Engineering

- **Task type detection**: Automatically classifies tasks (search, form, extraction, navigation) for optimized prompts
- **Context-aware system prompts**: Dynamic tool documentation based on task type
- **Model-specific formatting**: Tailored instructions for each provider's response style
- **Enter-first strategy**: More natural interaction patterns for form filling
- **Retry with enhancement**: Progressive prompt improvement on parsing failures (3 attempts with backoff)

### Comprehensive Action Library

FSB provides 40+ browser actions organized by category:

**Navigation**
- `navigate` -- Go to a URL
- `searchGoogle` -- Perform a Google search
- `refresh` -- Reload the current page
- `goBack` / `goForward` -- Browser history navigation

**Clicking**
- `click` -- Click an element (with selector cascade and coordinate fallback)
- `clickSearchResult` -- Click search engine results (Google, Bing, DuckDuckGo)
- `rightClick` -- Right-click context menu
- `doubleClick` -- Double-click an element
- `hover` -- Hover over an element
- `focus` / `blur` -- Focus or blur an element

**Text Input**
- `type` -- Type text into an input field
- `clearInput` -- Clear an input field
- `selectText` -- Select text within an element
- `pressEnter` -- Press the Enter key
- `keyPress` -- Press any keyboard key
- `pressKeySequence` -- Press a sequence of keys
- `typeWithKeys` -- Type using keyboard emulation (DevTools Protocol)
- `sendSpecialKey` -- Send special keys (Tab, Escape, etc.)

**Form Controls**
- `selectOption` -- Select a dropdown option
- `toggleCheckbox` -- Toggle a checkbox

**Information**
- `getText` -- Get text content of an element
- `getAttribute` -- Get an element's attribute value
- `setAttribute` -- Set an element's attribute

**Scrolling**
- `scroll` -- Scroll by direction or amount
- `scrollToTop` / `scrollToBottom` -- Scroll to page extremes
- `scrollToElement` -- Scroll a specific element into view

**Multi-Tab**
- `openNewTab` -- Open a new browser tab
- `switchToTab` -- Switch to a specific tab
- `closeTab` -- Close a tab
- `listTabs` / `getCurrentTab` -- Get tab information
- `waitForTabLoad` -- Wait for a tab to finish loading

**Waiting and Detection**
- `waitForElement` -- Wait for an element to appear in the DOM
- `waitForDOMStable` -- Wait for DOM mutations to settle
- `detectLoadingState` -- Check for loading indicators (spinners, progress bars)
- `detectActionOutcome` -- Verify the result of a previous action

**Game and Arrow Controls**
- `gameControl` -- Send game-specific key events
- `arrowUp` / `arrowDown` / `arrowLeft` / `arrowRight` -- Arrow key navigation

**Special**
- `solveCaptcha` -- CAPTCHA solving integration
- `moveMouse` -- Move the mouse to coordinates
- `verifyMessageSent` -- Verify a message was successfully sent

---

## Site-Specific Intelligence

FSB includes a site guides system that provides domain-specific knowledge to the AI, improving accuracy and reducing token usage.

### How It Works

When you navigate to a supported domain, FSB automatically loads the relevant guide. Each guide provides:

- **Domain-specific selectors**: Pre-mapped CSS selectors for common elements
- **Workflow patterns**: Step-by-step instructions for common tasks on that site
- **Navigation hints**: How the site's UI is structured and how to navigate it
- **Gotchas and workarounds**: Known quirks and how to handle them

### Supported Domains

| Category | Sites |
|----------|-------|
| **E-commerce** | Amazon, eBay, Walmart, and similar shopping sites |
| **Finance** | Yahoo Finance, TradingView, and financial platforms |
| **Social Media** | Major social media platforms |
| **Travel** | Flight booking and hotel reservation sites |
| **Coding** | GitHub, LeetCode, and developer platforms |

Site guides reduce token usage by 30-40% by providing focused context instead of requiring the AI to analyze the full DOM structure.

---

## Visual Feedback System

FSB provides real-time visual indicators during automation:

- **Viewport Glow**: A colored border around the browser viewport indicates the current state -- thinking (blue pulse), acting (amber), complete (green flash), or error (red)
- **Element Highlights**: The target element for each action is highlighted with an animated glow before the action executes
- **Progress Overlay**: A step counter and progress bar shows the current action number and task progress

---

## Analytics and Monitoring

### Usage Tracking
- **Token consumption** monitoring with per-model cost calculation
- **Success/failure rates** for different task types and action categories
- **Performance metrics** including execution time and AI response latency
- **Error analysis** for debugging and improvement
- **30-day data retention** with automatic cleanup

### Dashboard Features
- Real-time automation status
- Historical usage charts with cost breakdown by model and time period
- Session history viewer with detailed action logs
- Settings export for backup and migration
- Detailed logs with filtering options accessible from the options page

---

## Security and Privacy

### Data Handling
- **No personal data** is sent to external services except as required for task execution
- **API keys are encrypted** using AES-GCM when stored locally
- **Session data** is cleared after automation completion
- **Optional logging** can be disabled for sensitive operations
- **XSS protection** via DOMPurify sanitization for all rendered chat content

### Best Practices
- Use separate API keys for development and production
- Enable encrypted storage for production use
- Regularly rotate API keys
- Review logs for any unintended actions
- Test on non-sensitive websites first

### Safety Guidelines
- **Always monitor automation**: Watch what FSB does in real-time via visual feedback
- **Start with safe sites**: Use test websites or your own domains first
- **Verify results**: Double-check all automated actions and their outcomes
- **Tab isolation**: FSB only controls the active session tab, not other open tabs
- **Report issues**: Help improve FSB by reporting unexpected behavior
- **Use responsibly**: Respect website terms of service and rate limits

---

## Roadmap

### Completed in v9.0.1
- Full automation engine with smart iteration and stuck recovery
- Four AI providers (xAI, OpenAI, Anthropic, Gemini) with 20+ models
- Universal model-agnostic provider architecture
- Modern chat UI with markdown, mermaid, and Chart.js rendering
- Site-specific intelligence with domain guides
- Action verification and visual feedback system
- Analytics dashboard with cost tracking
- Encrypted configuration and secure API key storage
- Multi-tab automation support
- Comprehensive logging and debugging tools

### v1.0 - Distribution and Polish
- Advanced CAPTCHA solver integration (Buster, CapSolver, 2Captcha)
- Workflow templates and task saving
- Chrome Web Store publication
- Performance optimizations and startup improvements

### v1.1 - Enhanced Capabilities
- Visual element recognition and computer vision
- Cross-site automation flows
- Plugin architecture for custom actions
- Community action library

### v1.2 - Enterprise and Scale
- Enterprise features and compliance
- Team collaboration and shared workflows
- API documentation and SDK
- Integration with popular automation platforms

---

## Acknowledgments

FSB is inspired by **Project Mariner** from Google DeepMind, designed as an open-source alternative accessible to everyone. This multi-model approach is made possible by:

**AI Model Providers:**
- **xAI Team**: For providing powerful and accessible Grok models
- **OpenAI**: For the GPT model family and the chat completions API standard
- **Anthropic**: For Claude models with advanced reasoning capabilities
- **Google AI**: For making Gemini available to developers, including a free tier

**Community and Inspiration:**
- **Project Mariner**: For demonstrating the potential of AI-powered browsing
- **Chrome Extensions Community**: For excellent documentation and development resources
- **Open Source Contributors**: Every bug report, feature request, and code contribution
- **Beta Testers**: Community members helping test and improve FSB across different websites

Every contributor, tester, and community member helps transform FSB into a better tool. Your involvement drives this project's evolution and success!

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## Contributing

**FSB thrives on community contributions!** Whether you're fixing bugs, adding features, improving documentation, testing on new websites, or sharing feedback -- every contribution counts.

### Priority Contribution Areas

- **Testing and Feedback**: Try FSB on different websites and report what works (and what doesn't)
- **Bug Reports**: Found an issue? Document it with steps to reproduce
- **Feature Requests**: Have ideas for better automation? Share them!
- **Code Contributions**: Help implement new features, fix bugs, or optimize performance
- **Documentation**: Improve guides, add examples, or create tutorials
- **AI Model Integration**: Help add support for new AI models and providers
- **Site Guides**: Add domain-specific guides for new websites

### Getting Started

1. **Start Testing**: Download FSB and try it on your favorite websites
2. **Report Your Experience**: Use our [issues page](https://github.com/lakshmanturlapati/FSB/issues) to share feedback
3. **Join Discussions**: Engage with the community in GitHub discussions
4. **Pick an Issue**: Look for "good first issue" labels for beginner-friendly tasks
5. **Submit Code**: Fork, improve, and submit pull requests

Every contributor helps make FSB better! Contributors are recognized in our acknowledgments and become part of FSB's development story.

---

## Support

- **GitHub Issues**: [Report bugs or request features](https://github.com/lakshmanturlapati/FSB/issues)
- **Options Page**: Built-in help section and log viewer for troubleshooting
- **Community**: Join discussions in our GitHub repository

---

<div align="center">

**Made with care by [Lakshman Turlapati](https://github.com/lakshmanturlapati)**

**Star this repository if FSB helps you automate your browsing!**

*FSB - Full Self-Browsing: Making AI-powered automation accessible to everyone*

</div>
