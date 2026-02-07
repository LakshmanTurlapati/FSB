# Technology Stack

**Analysis Date:** 2026-02-03

## Languages

**Primary:**
- JavaScript ES2021+ - All application code (19 JS files)
- Used throughout: background service worker, content scripts, UI scripts, AI integration

**Secondary:**
- HTML5 - User interface markup (`popup.html`, `sidepanel.html`, `options.html`, `unlock.html`)
- CSS3 - Styling (`popup.css`, `sidepanel.css`, `options.css`)
- JSON - Configuration and manifest (`manifest.json`, `package.json`)

## Runtime

**Environment:**
- Chrome Extension (Manifest V3)
- Chrome 88+ required
- Runs as service worker (background) and content scripts (page context)

**Package Manager:**
- npm (defined in `package.json`)
- Lockfile: Not present (no node_modules dependencies used at runtime)

**Note:** This is a Chrome Extension - no Node.js runtime at execution time. The `package.json` exists for project metadata and optional build tooling only.

## Frameworks

**Core:**
- Chrome Extensions API (Manifest V3) - Extension platform
- Web Crypto API - Encryption for secure config (`secure-config.js`)
- MutationObserver API - DOM change detection (`content.js`, `dom-state-manager.js`)
- Chrome DevTools Protocol - Keyboard emulation (`keyboard-emulator.js`)

**Charting:**
- Chart.js 4.x (`chart.min.js`) - Analytics visualization in options page

**Build/Dev:**
- No build system - Direct JavaScript execution
- No transpilation required (ES2021+ native support in Chrome 88+)

## Key Dependencies

**Runtime (bundled):**
- `chart.min.js` - Chart.js library for analytics charts (bundled, ~205KB)

**Package.json Dependencies (not used at runtime):**
- `axios ^1.6.0` - Listed but not used in extension code (HTTP handled via fetch)

**Chrome APIs Used:**
- `chrome.storage.local` - Configuration persistence
- `chrome.tabs` - Tab management and communication
- `chrome.scripting` - Content script injection
- `chrome.runtime` - Message passing, lifecycle events
- `chrome.sidePanel` - Side panel UI
- `chrome.debugger` - DevTools Protocol access for keyboard emulation
- `chrome.webNavigation` - Navigation event monitoring
- `chrome.windows` - Window management

## Configuration

**Environment:**
- No `.env` files - Configuration via Chrome Storage API
- API keys stored in `chrome.storage.local`
- Optional encryption via `secure-config.js` using Web Crypto API (AES-GCM, PBKDF2)

**Key Configuration Files:**
- `manifest.json` - Extension manifest, permissions, entry points
- `config.js` - Runtime configuration management class
- `init-config.js` - First-run configuration initialization
- `secure-config.js` - Encrypted API key storage

**Configuration Settings:**
```javascript
// Default settings from config.js
{
  modelProvider: 'xai',           // AI provider selection
  modelName: 'grok-4-1-fast',     // Model selection
  apiKey: '',                     // xAI API key
  geminiApiKey: '',               // Google Gemini API key
  openaiApiKey: '',               // OpenAI API key
  anthropicApiKey: '',            // Anthropic API key
  captchaSolver: 'none',          // CAPTCHA service
  actionDelay: 1000,              // Delay between actions (ms)
  maxIterations: 20,              // Max automation iterations
  confirmSensitive: true,         // Confirm sensitive actions
  debugMode: false                // Enable debug logging
}
```

## Platform Requirements

**Development:**
- Chrome 88+ or Chromium-based browser (Edge, Brave)
- No build step required - load unpacked extension directly
- Text editor for JavaScript/HTML/CSS

**Production:**
- Chrome 88+ with Manifest V3 support
- Internet connection for AI API access
- Valid API key for chosen AI provider

**Deployment:**
- Load as unpacked extension (development)
- Package as `.crx` or `.zip` for distribution
- Chrome Web Store (planned for v0.4)

## File Size Summary

**Largest Files:**
- `content.js` - 226KB (DOM analysis and action execution)
- `chart.min.js` - 205KB (bundled charting library)
- `background.js` - 175KB (service worker, automation loop)
- `ai-integration.js` - 107KB (AI communication, prompt engineering)
- `options.js` - 69KB (settings dashboard)

**Total Extension Size:** ~1.2MB (excluding Assets folder)

## Browser Compatibility

**Supported:**
- Chrome 88+ (primary target)
- Edge 88+ (Chromium-based)
- Brave (Chromium-based)
- Other Chromium derivatives

**Planned:**
- Firefox (v0.2 roadmap) - requires Manifest V2/V3 adaptation

---

*Stack analysis: 2026-02-03*
