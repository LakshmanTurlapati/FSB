# FSB v0.1 - Full Self-Browsing

<div align="center">

<img src="Assets/fsb.png" alt="FSB Logo" width="200" />

[![Version](https://img.shields.io/badge/version-0.1.0-blue.svg)](https://github.com/lakshmanturlapati/FSB/releases)
[![Status](https://img.shields.io/badge/status-prototype-orange.svg)](https://github.com/lakshmanturlapati/FSB)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Chrome Extension](https://img.shields.io/badge/platform-Chrome%20Extension-yellow.svg)](https://developer.chrome.com/docs/extensions/)
[![Multi-Model AI](https://img.shields.io/badge/AI-Grok%20%7C%20Gemini%20%7C%20More%20Coming-purple.svg)](https://github.com/lakshmanturlapati/FSB)
[![Open Source](https://img.shields.io/badge/open%20source-FSB-red.svg)](https://github.com/lakshmanturlapati/FSB)

**An intelligent, open-source browser automation assistant powered by multiple AI models**

*Inspired by Project Mariner, built for everyone • Work in Progress - It only gets better!*

[Quick Start](#quick-start) | [Documentation](#documentation) | [Configuration](#configuration) | [Contributing](#contributing)

</div>

---

## <img src="https://raw.githubusercontent.com/FortAwesome/Font-Awesome/6.x/svgs/solid/star.svg" width="16" height="16"> Overview

> **PROTOTYPE STATUS**: FSB is currently a work-in-progress prototype. While functional, please monitor its actions carefully and test on non-critical websites. This project continuously improves with community feedback and contributions!

FSB (Full Self-Browsing) is a powerful Chrome extension that brings multi-model AI-powered browser automation to your fingertips. Simply describe what you want to accomplish in natural language, and FSB will analyze the webpage, plan the necessary actions, and execute them automatically using your choice of AI models.

### Key Features

- **Multi-Model AI Support**: Choose between xAI Grok, Google Gemini, with more models coming soon
- **Natural Language Interface**: Describe tasks in plain English - no complex scripting required
- **Smart DOM Analysis**: Advanced webpage structure analysis and element identification
- **Comprehensive Automation**: Click, type, scroll, navigate, form filling, and more
- **CAPTCHA Integration**: Built-in support for CAPTCHA solving services
- **Analytics & Monitoring**: Usage tracking, cost calculation, and performance insights per model
- **Modern Interface**: Clean chat-based UI with side panel support
- **Secure Configuration**: Encrypted API key storage and secure settings management
- **Smart Recovery**: Automatic stuck detection and adaptive behavior
- **Multiple UI Modes**: Popup and persistent side panel interfaces
- **Community Driven**: Open-source with active development - contributions welcome!

### <img src="https://raw.githubusercontent.com/FortAwesome/Font-Awesome/6.x/svgs/solid/bullseye.svg" width="16" height="16"> Use Cases

- **Web Testing**: Automate repetitive testing workflows (always verify results!)
- **Data Entry**: Fill forms and submit information across multiple sites
- **Research**: Navigate and extract information from websites
- **Social Media**: Automate posting and interaction tasks (monitor for accuracy)
- **E-commerce**: Product research and comparison shopping
- **Productivity**: Streamline routine browsing tasks

> **Note**: As this is a prototype, always double-check automation results and test on non-critical websites first. Your feedback helps improve accuracy!

---

## <img src="https://raw.githubusercontent.com/FortAwesome/Font-Awesome/6.x/svgs/solid/rocket.svg" width="16" height="16"> Quick Start

### Prerequisites

- Google Chrome (version 88+)
- **Choose your AI model** (one or both):
  - xAI Grok API key ([Get one here](https://x.ai/api))
  - Google Gemini API key ([Get one here](https://ai.google.dev/))
- **Important**: This is a prototype - test carefully on non-critical websites

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
   - Configure your preferred AI model in settings
   - Enter a task like "Search for cats on Google"
   - Watch FSB work its magic (and monitor the actions!)

### First Steps

1. **Configure your AI model**: Click settings and choose between Grok, Gemini, or both
2. **Test the connection**: Use the "Test API" button to verify your chosen model works
3. **Start simple**: Try basic tasks like "scroll down" or "click the search button"
4. **Monitor actions**: Always watch what FSB does - it's learning and improving!
5. **Explore features**: Try the side panel mode for persistent access
6. **Share feedback**: Report issues or suggestions to help improve FSB

---

## <img src="https://raw.githubusercontent.com/FortAwesome/Font-Awesome/6.x/svgs/solid/book.svg" width="16" height="16"> Documentation

### Architecture Overview

FSB follows a modular architecture designed for reliability and extensibility:

```mermaid
graph TD
    A[User Interface<br/>Popup & Side Panel] --> B[Background Service<br/>AI Integration & Sessions]
    B --> C[Content Script<br/>DOM Analysis & Actions]
    C --> D[Web Page<br/>Automated Interactions]
    B --> E[AI Models<br/>Grok | Gemini | More Coming]
    B --> F[Chrome Storage<br/>Settings & Analytics]
```

**Architecture Components:**

**User Interface Layer:**
- **Popup Chat Interface**: Quick task execution with compact chat UI
- **Side Panel Interface**: Persistent automation sessions that stay visible while browsing
- **Options/Settings Page**: Comprehensive configuration management and analytics dashboard

**Background Service Worker:**
- **Session Management**: Orchestrates automation workflows and maintains state
- **Multi-Model AI Integration**: Communicates with multiple AI providers (Grok, Gemini, more coming)
- **Configuration Manager**: Handles secure settings storage with encryption support
- **Analytics Tracking**: Monitors usage, performance, and cost calculations per model

**Content Script Layer:**
- **DOM Analysis**: Advanced webpage structure parsing and element identification
- **Action Execution**: Performs browser actions (click, type, scroll, navigate)
- **Logging System**: Detailed action logging for debugging and monitoring

**External Services:**
- **Multi-Model AI APIs**: xAI Grok, Google Gemini for natural language processing and task understanding
- **CAPTCHA Services**: Optional integration for automated CAPTCHA solving

### Core Components

- **`background.js`**: Orchestrates automation sessions and manages AI communication
- **`content.js`**: Executes actions on web pages and analyzes DOM structure
- **`ai-integration.js`**: Handles multi-model AI communication with advanced prompt engineering
- **`config.js`**: Manages settings and configuration with encryption support
- **UI Components**: Modern chat interfaces for user interaction

### Task Flow

1. **Input**: User describes task in natural language
2. **Analysis**: FSB analyzes current webpage structure
3. **Planning**: AI generates step-by-step action plan
4. **Execution**: Actions are executed with smart delays and error handling
5. **Iteration**: Process repeats until task completion or timeout
6. **Feedback**: User receives real-time updates and final results

---

## <img src="https://raw.githubusercontent.com/FortAwesome/Font-Awesome/6.x/svgs/solid/cog.svg" width="16" height="16"> Configuration

### Basic Setup

Access settings through the extension popup or options page:

- **AI Model Selection**: Choose your preferred AI model (Grok, Gemini, or both)
- **API Keys**: Configure keys for your chosen AI models
- **Speed Mode**: Choose between 'normal' and 'fast' processing
- **Action Delay**: Customize timing between actions (500-5000ms)
- **Max Iterations**: Set automation loop limits (5-50)
- **Debug Mode**: Enable detailed logging for troubleshooting and prototype feedback

### Advanced Configuration

#### Extension Options Page
Configure all settings through the extension's built-in options page:

1. **Right-click the extension icon** → "Options"
2. **Or visit**: `chrome-extension://[extension-id]/options.html`

**Available Settings:**
- **AI Model Configuration**: 
  - **xAI Grok**: Fast, creative responses - excellent for complex web interactions
  - **Google Gemini**: Reliable, analytical - great for structured tasks
  - **More Models Coming**: Claude, GPT, and others planned for future releases
- **Model Selection**: Choose your preferred AI model or switch between them
- **CAPTCHA Integration**: Configure CAPTCHA solving services
- **Automation Tuning**: Action delays, max iterations, debug mode
- **Analytics Dashboard**: Monitor usage, costs, and performance per model
- **Prototype Feedback**: Built-in reporting for bugs and suggestions

#### Security Features
- **Encrypted Storage**: API keys are automatically encrypted in Chrome storage
- **Secure Configuration**: No plain-text files or environment variables needed
- **Session Management**: Automatic cleanup and secure key handling

#### Development Setup
Create `config/dev-settings.json` for development:
```json
{
  "apiKey": "your-dev-api-key",
  "debugMode": true,
  "speedMode": "fast",
  "actionDelay": 500
}
```

---

## <img src="https://raw.githubusercontent.com/FortAwesome/Font-Awesome/6.x/svgs/solid/wrench.svg" width="16" height="16"> Development

### Project Structure

```
FSB/
├── Assets/                 # Images and icons
├── background.js          # Background service worker
├── content.js            # Content script for DOM interaction
├── ai-integration.js     # xAI API integration
├── config.js            # Configuration management
├── popup.html/js/css    # Popup interface
├── sidepanel.html/js/css # Side panel interface
├── options.html/js/css  # Settings page
├── manifest.json        # Extension manifest
├── package.json         # Node.js configuration
├── setup.js            # Setup and initialization script
├── SETUP.md           # Detailed setup instructions
└── CLAUDE.md         # Development notes and architecture
```

### Building and Testing

```bash
# Install dependencies
npm install

# Run setup
node setup.js

# Load in Chrome for testing
# (Use chrome://extensions/ in developer mode)

# Debug console logs
# Check background script console in chrome://extensions/
```

### Contributing Guidelines

1. **Fork the repository** and create a feature branch
2. **Follow the existing code style** and patterns
3. **Add tests** for new functionality where applicable
4. **Update documentation** for any API changes
5. **Test thoroughly** across different websites and scenarios
6. **Submit a pull request** with clear description of changes

### Debugging

Enable debug mode for detailed logging:
- Set `DEBUG_MODE=true` in settings
- Check browser console for detailed action logs
- Use Chrome DevTools to inspect extension behavior
- View logs in the options page for historical data

---

## <img src="https://raw.githubusercontent.com/FortAwesome/Font-Awesome/6.x/svgs/solid/robot.svg" width="16" height="16"> Multi-Model AI Integration

FSB supports multiple AI models, each with unique strengths for browser automation:

### Supported AI Models

#### xAI Grok
- **Strengths**: Creative problem-solving, handles complex web interactions
- **Best for**: Dynamic websites, unconventional UI patterns, creative automation
- **Performance**: Fast response times, good for real-time automation

#### Google Gemini  
- **Strengths**: Reliable, methodical approach, excellent reasoning
- **Best for**: Structured forms, data entry, systematic workflows
- **Performance**: Consistent results, lower error rates on standard tasks

#### Coming Soon
- **Claude Models**: Advanced reasoning and code understanding
- **GPT Models**: Broad knowledge and natural conversation
- **Specialized Models**: Task-specific optimization

> **Prototype Note**: Model performance varies by website and task complexity. Try different models to find what works best for your specific use cases!

### Advanced Prompt Engineering
- **Model-specific prompts** optimized for each AI's strengths
- **Task analysis** breaks down complex requests into actionable steps
- **Context awareness** maintains state across multiple iterations
- **Error recovery** adapts when actions fail or pages change
- **Learning from feedback** improves accuracy over time

### Comprehensive Action Library
- **Navigation**: `navigate`, `refresh`, `goBack`, `goForward`
- **Interaction**: `click`, `type`, `hover`, `scroll`
- **Forms**: `selectOption`, `toggleCheckbox`, `clearInput`
- **Information**: `getText`, `getAttribute`, `waitForElement`
- **Special**: `solveCaptcha`, `searchGoogle`
- **Advanced**: Custom actions based on model capabilities

---

## <img src="https://raw.githubusercontent.com/FortAwesome/Font-Awesome/6.x/svgs/solid/chart-bar.svg" width="16" height="16"> Analytics & Monitoring

### Usage Tracking
- **Token consumption** monitoring and cost calculation
- **Success/failure rates** for different task types
- **Performance metrics** including execution time
- **Error analysis** for debugging and improvement

### Dashboard Features
- Real-time automation status
- Historical usage charts
- Cost breakdown by model and time period
- Detailed logs with filtering options

---

## Security & Privacy

### Data Handling
- **No personal data** is sent to external services except as required for task execution
- **API keys are encrypted** when stored locally
- **Session data** is cleared after automation completion
- **Optional logging** can be disabled for sensitive operations

### Best Practices
- Use separate API keys for development and production
- Enable encrypted storage for production use
- Regularly rotate API keys
- Review logs for any unintended actions
- Test on non-sensitive websites first

### Prototype Safety Guidelines
- **Always monitor automation**: Watch what FSB does in real-time
- **Start with safe sites**: Use test websites or your own domains first
- **Verify results**: Double-check all automated actions and their outcomes
- **Report issues**: Help improve FSB by reporting unexpected behavior
- **Use responsibly**: Respect website terms of service and rate limits

---

## Roadmap

### Phase 1: Multi-Model Foundation (Current - v0.1)
- Core automation engine with multi-model AI support
- xAI Grok and Google Gemini integration
- Modern UI with chat interface
- Comprehensive analytics and logging per model
- Community feedback integration

### Phase 2: Enhanced Intelligence (v0.2)
- Additional AI models (Claude, GPT, specialized models)
- Advanced CAPTCHA solving integration
- Multi-tab automation support
- Custom action scripting and workflow templates
- Improved model selection and switching

### Phase 3: Advanced Automation (v0.3)
- Visual element recognition and computer vision
- Cross-site automation flows
- Advanced error recovery with model fallback
- Performance optimizations and caching
- Real-time model performance comparison

### Phase 4: Ecosystem & Distribution (v0.4)
- Plugin architecture for custom AI models
- Community action library and sharing
- Enterprise features and team collaboration
- Chrome Web Store publication
- Model marketplace and custom training

---

## Acknowledgments

FSB is inspired by **Project Mariner** from Google DeepMind, but designed as an open-source alternative accessible to everyone. This multi-model approach wouldn't be possible without:

**AI Model Providers:**
- **xAI Team**: For providing powerful and accessible Grok models
- **Google AI**: For making Gemini available to developers
- **Future Partners**: Claude, OpenAI, and other AI providers joining our ecosystem

**Community & Inspiration:**
- **Project Mariner**: For demonstrating the potential of AI-powered browsing
- **Chrome Extensions Community**: For excellent documentation and development resources
- **Open Source Contributors**: Every bug report, feature request, and code contribution
- **Beta Testers**: Community members helping test and improve FSB across different websites
- **Feedback Providers**: Users sharing their automation experiences and suggestions

**Special Recognition:**
Every contributor, tester, and community member helping transform FSB from prototype to production-ready tool. Your involvement drives this projects evolution and success!

**Join the Community**: Become part of FSB's story by contributing, testing, or simply sharing your experience with AI-powered browser automation.

---

## <img src="https://raw.githubusercontent.com/FortAwesome/Font-Awesome/6.x/svgs/solid/file-contract.svg" width="16" height="16"> License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## Contributing

**FSB thrives on community contributions!** As a prototype in active development, your involvement is crucial to making it better. Whether you're fixing bugs, adding features, improving documentation, testing on new websites, or sharing feedback - every contribution counts!

### Why Your Contribution Matters

- **Prototype Development**: Help shape FSB's evolution from prototype to production
- **Multi-Model Testing**: Test different AI models across various websites and scenarios  
- **Real-World Feedback**: Your usage patterns help identify bugs and improvement opportunities
- **Community Building**: Join a growing community of automation enthusiasts
- **Open Source Impact**: Contribute to making AI-powered browsing accessible to everyone

### Priority Contribution Areas

- **Testing & Feedback**: Try FSB on different websites and report what works (and what doesn't)
- **Bug Reports**: Found an issue? Document it with steps to reproduce
- **Feature Requests**: Have ideas for better automation? Share them!
- **Code Contributions**: Help implement new features, fix bugs, or optimize performance
- **Documentation**: Improve our guides, add examples, or create tutorials
- **AI Model Integration**: Help add support for new AI models and providers

### Getting Started - It's Easy!

1. **Start Testing**: Download FSB and try it on your favorite websites
2. **Report Your Experience**: Use our [issues page](https://github.com/lakshmanturlapati/FSB/issues) to share feedback
3. **Join Discussions**: Engage with the community in GitHub discussions
4. **Pick an Issue**: Look for "good first issue" labels for beginner-friendly tasks
5. **Submit Code**: Fork, improve, and submit pull requests

### Contribution Recognition

Every contributor helps make FSB better! Contributors are recognized in our acknowledgments and become part of FSB's development story.

**Ready to contribute? Start by testing FSB and sharing your experience - that's the most valuable contribution right now!**

---

## <img src="https://raw.githubusercontent.com/FortAwesome/Font-Awesome/6.x/svgs/solid/headset.svg" width="16" height="16"> Support

- **GitHub Issues**: [Report bugs or request features](https://github.com/lakshmanturlapati/FSB/issues)
- **Documentation**: Check [SETUP.md](SETUP.md) for detailed configuration help
- **Community**: Join discussions in our GitHub repository

---

<div align="center">

**Made with care by [Lakshman Turlapati](https://github.com/lakshmanturlapati)**

**Star this repository if FSB helps you automate your browsing!**

*FSB - Full Self-Browsing: Making AI-powered automation accessible to everyone*

</div>