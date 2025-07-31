# FSB v0.1 - Full Self-Browsing

<div align="center">

<img src="Assets/fsb.png" alt="FSB Logo" width="200" />

[![Version](https://img.shields.io/badge/version-0.1.0-blue.svg)](https://github.com/lakshmanturlapati/FSB/releases)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Chrome Extension](https://img.shields.io/badge/platform-Chrome%20Extension-yellow.svg)](https://developer.chrome.com/docs/extensions/)
[![AI Powered](https://img.shields.io/badge/powered%20by-xAI%20Grok-purple.svg)](https://x.ai/)
[![Open Source](https://img.shields.io/badge/open%20source-FSB-red.svg)](https://github.com/lakshmanturlapati/FSB)

**An intelligent, open-source browser automation assistant powered by AI**

*Inspired by Project Mariner, built for everyone*

[Quick Start](#quick-start) | [Documentation](#documentation) | [Configuration](#configuration) | [Contributing](#contributing)

</div>

---

## <img src="https://raw.githubusercontent.com/FortAwesome/Font-Awesome/6.x/svgs/solid/star.svg" width="16" height="16"> Overview

FSB (Full Self-Browsing) is a powerful Chrome extension that brings AI-powered browser automation to your fingertips. Simply describe what you want to accomplish in natural language, and FSB will analyze the webpage, plan the necessary actions, and execute them automatically.

### <img src="https://raw.githubusercontent.com/FortAwesome/Font-Awesome/6.x/svgs/solid/sparkles.svg" width="16" height="16"> Key Features

- **AI-Powered Intelligence**: Uses xAI Grok-3-mini for sophisticated task understanding and execution
- **Natural Language Interface**: Describe tasks in plain English - no complex scripting required
- **Smart DOM Analysis**: Advanced webpage structure analysis and element identification
- **Comprehensive Automation**: Click, type, scroll, navigate, form filling, and more
- **CAPTCHA Integration**: Built-in support for CAPTCHA solving services
- **Analytics & Monitoring**: Usage tracking, cost calculation, and performance insights
- **Modern Interface**: Clean chat-based UI with side panel support
- **Secure Configuration**: Encrypted API key storage and secure settings management
- **Smart Recovery**: Automatic stuck detection and adaptive behavior
- **Multiple UI Modes**: Popup and persistent side panel interfaces

### <img src="https://raw.githubusercontent.com/FortAwesome/Font-Awesome/6.x/svgs/solid/bullseye.svg" width="16" height="16"> Use Cases

- **Web Testing**: Automate repetitive testing workflows
- **Data Entry**: Fill forms and submit information across multiple sites
- **Research**: Navigate and extract information from websites
- **Social Media**: Automate posting and interaction tasks
- **E-commerce**: Product research and comparison shopping
- **Productivity**: Streamline routine browsing tasks

---

## <img src="https://raw.githubusercontent.com/FortAwesome/Font-Awesome/6.x/svgs/solid/rocket.svg" width="16" height="16"> Quick Start

### Prerequisites

- Google Chrome (version 88+)
- xAI API key ([Get one here](https://x.ai/api))

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/lakshmanturlapati/FSB.git
   cd FSB
   ```

2. **Set up your API key**
   ```bash
   # Copy the example environment file
   cp .env.example .env
   
   # Edit .env with your xAI API key
   echo "XAI_API_KEY=your_actual_api_key_here" > .env
   ```

3. **Run the setup script**
   ```bash
   node setup.js
   ```

4. **Load the extension in Chrome**
   - Open `chrome://extensions/`
   - Enable "Developer mode" (top right)
   - Click "Load unpacked"
   - Select the FSB directory

5. **Start automating!**
   - Click the FSB extension icon
   - Enter a task like "Search for cats on Google"
   - Watch FSB work its magic

### First Steps

1. **Configure your API key**: Click the settings button and enter your xAI API key
2. **Test the connection**: Use the "Test API" button to verify everything works
3. **Try a simple task**: Start with something basic like "scroll down" or "click the search button"
4. **Explore features**: Try the side panel mode for persistent access

---

## <img src="https://raw.githubusercontent.com/FortAwesome/Font-Awesome/6.x/svgs/solid/book.svg" width="16" height="16"> Documentation

### Architecture Overview

FSB follows a modular architecture designed for reliability and extensibility:

```mermaid
graph TB
    %% User Interface Layer
    subgraph "User Interface Layer"
        A[Popup Chat Interface]
        B[Side Panel Interface] 
        C[Options/Settings Page]
    end

    %% Background Service Worker
    subgraph "Background Service Worker"
        D[background.js<br/>Session Management]
        E[ai-integration.js<br/>AI Communication]
        F[config.js<br/>Configuration Manager]
        G[analytics.js<br/>Usage Tracking]
    end

    %% Content Script Layer
    subgraph "Content Script Layer"
        H[content.js<br/>DOM Analysis & Actions]
        I[automation-logger.js<br/>Action Logging]
    end

    %% External Services
    subgraph "External Services"
        J[xAI Grok-3-mini API<br/>Natural Language Processing]
        K[CAPTCHA Services<br/>Optional Integration]
    end

    %% Chrome APIs & Storage
    subgraph "Chrome Extension APIs"
        L[Chrome Storage API<br/>Settings & State]
        M[Chrome Tabs API<br/>Tab Management]
        N[Chrome Runtime API<br/>Message Passing]
    end

    %% Web Page
    O[Target Web Page<br/>DOM Manipulation]

    %% User Interactions
    A -->|User Input| D
    B -->|User Input| D
    C -->|Configuration| F

    %% Background Coordination
    D -->|AI Requests| E
    D -->|Store Data| L
    D -->|Tab Control| M
    E -->|API Calls| J
    F -->|Secure Storage| L
    G -->|Analytics Data| L

    %% Content Script Communication
    D <==>|Chrome Messages| H
    H -->|DOM Analysis| D
    H -->|Actions| O
    H -->|Logging| I

    %% External API Integration
    E -->|CAPTCHA Solving| K
    
    %% Data Flow Styling
    classDef userInterface fill:#e1f5fe,stroke:#01579b,stroke-width:2px
    classDef background fill:#f3e5f5,stroke:#4a148c,stroke-width:2px
    classDef content fill:#e8f5e8,stroke:#1b5e20,stroke-width:2px
    classDef external fill:#fff3e0,stroke:#e65100,stroke-width:2px
    classDef chrome fill:#f1f8e9,stroke:#33691e,stroke-width:2px
    classDef webpage fill:#fce4ec,stroke:#880e4f,stroke-width:2px

    class A,B,C userInterface
    class D,E,F,G background
    class H,I content
    class J,K external
    class L,M,N chrome
    class O webpage
```

**Architecture Components:**

**User Interface Layer:**
- **Popup Chat Interface**: Quick task execution with compact chat UI
- **Side Panel Interface**: Persistent automation sessions that stay visible while browsing
- **Options/Settings Page**: Comprehensive configuration management and analytics dashboard

**Background Service Worker:**
- **Session Management**: Orchestrates automation workflows and maintains state
- **AI Integration**: Communicates with xAI Grok-3-mini for intelligent task processing
- **Configuration Manager**: Handles secure settings storage with encryption support
- **Analytics Tracking**: Monitors usage, performance, and cost calculations

**Content Script Layer:**
- **DOM Analysis**: Advanced webpage structure parsing and element identification
- **Action Execution**: Performs browser actions (click, type, scroll, navigate)
- **Logging System**: Detailed action logging for debugging and monitoring

**External Services:**
- **xAI Grok-3-mini API**: Natural language processing and task understanding
- **CAPTCHA Services**: Optional integration for automated CAPTCHA solving

### Core Components

- **`background.js`**: Orchestrates automation sessions and manages AI communication
- **`content.js`**: Executes actions on web pages and analyzes DOM structure
- **`ai-integration.js`**: Handles xAI API communication with advanced prompt engineering
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

- **API Key**: Your xAI Grok-3-mini API key
- **Speed Mode**: Choose between 'normal' and 'fast' processing
- **Action Delay**: Customize timing between actions (500-5000ms)
- **Max Iterations**: Set automation loop limits (5-50)
- **Debug Mode**: Enable detailed logging for troubleshooting

### Advanced Configuration

#### Encrypted Storage
For enhanced security, enable encrypted API key storage:
```bash
node setup.js
# Choose "Yes" when prompted for encryption
```

#### Environment Variables
```bash
# Core Settings
XAI_API_KEY=your_xai_api_key
DEBUG_MODE=false
SPEED_MODE=normal

# CAPTCHA Integration
CAPTCHA_SOLVER=none
CAPSOLVER_API_KEY=your_capsolver_key
TWOCAPTCHA_API_KEY=your_2captcha_key

# Automation Tuning
ACTION_DELAY=1000
MAX_ITERATIONS=20
```

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

## <img src="https://raw.githubusercontent.com/FortAwesome/Font-Awesome/6.x/svgs/solid/robot.svg" width="16" height="16"> AI Integration

FSB uses xAI's Grok-3-mini model for intelligent task processing:

### Prompt Engineering
- **System prompts** provide context about available browser actions
- **Task analysis** breaks down complex requests into actionable steps
- **Context awareness** maintains state across multiple iterations
- **Error recovery** adapts when actions fail or pages change

### Supported Actions
- **Navigation**: `navigate`, `refresh`, `goBack`, `goForward`
- **Interaction**: `click`, `type`, `hover`, `scroll`
- **Forms**: `selectOption`, `toggleCheckbox`, `clearInput`
- **Information**: `getText`, `getAttribute`, `waitForElement`
- **Special**: `solveCaptcha`, `searchGoogle`

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

## <img src="https://raw.githubusercontent.com/FortAwesome/Font-Awesome/6.x/svgs/solid/lock.svg" width="16" height="16"> Security & Privacy

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

---

## <img src="https://raw.githubusercontent.com/FortAwesome/Font-Awesome/6.x/svgs/solid/road.svg" width="16" height="16"> Roadmap

### Phase 1: Foundation (Current - v0.1)
- Core automation engine
- xAI Grok-3-mini integration
- Modern UI with chat interface
- Basic analytics and logging

### Phase 2: Enhanced Capabilities (v0.2)
- Advanced CAPTCHA solving integration
- Multi-tab automation support
- Custom action scripting
- Workflow templates and saving

### Phase 3: Intelligence & Scale (v0.3)
- Visual element recognition
- Cross-site automation flows
- Advanced error recovery
- Performance optimizations

### Phase 4: Ecosystem (v0.4)
- Plugin architecture
- Community action library
- Enterprise features
- Chrome Web Store publication

---

## <img src="https://raw.githubusercontent.com/FortAwesome/Font-Awesome/6.x/svgs/solid/trophy.svg" width="16" height="16"> Acknowledgments

FSB is inspired by **Project Mariner** from Google DeepMind, but designed as an open-source alternative accessible to everyone. Special thanks to:

- The xAI team for providing powerful and accessible AI models
- The Chrome Extensions community for excellent documentation and examples
- Project Mariner for demonstrating the potential of AI-powered browsing
- All contributors and testers who help improve FSB

---

## <img src="https://raw.githubusercontent.com/FortAwesome/Font-Awesome/6.x/svgs/solid/file-contract.svg" width="16" height="16"> License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## <img src="https://raw.githubusercontent.com/FortAwesome/Font-Awesome/6.x/svgs/solid/handshake.svg" width="16" height="16"> Contributing

We welcome contributions! Whether you're fixing bugs, adding features, improving documentation, or sharing feedback, your help makes FSB better for everyone.

### Ways to Contribute

- **Bug Reports**: Found an issue? Let us know!
- **Feature Requests**: Have an idea? We'd love to hear it!
- **Code Contributions**: Pull requests are always welcome
- **Documentation**: Help improve our guides and examples
- **Testing**: Try FSB on different websites and share your experience

### Getting Started

1. Check out our [issues page](https://github.com/lakshmanturlapati/FSB/issues) for good first contributions
2. Read our contributing guidelines (coming soon)
3. Join our community discussions
4. Submit your first pull request

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