// Side Panel Script for FSB v0.9 - Persistent UI

let currentSessionId = null;
let isRunning = false;
let stopRequested = false;

// DOM elements - adapted for side panel
const chatInput = document.getElementById('chatInput');
const sendBtn = document.getElementById('sendBtn');
const stopBtn = document.getElementById('stopBtn');
const newChatBtn = document.getElementById('newChatBtn');
const settingsBtn = document.getElementById('settingsBtn');
const chatMessages = document.getElementById('chatMessages');
const statusDot = document.querySelector('.status-dot');
const statusText = document.querySelector('.status-text');

// Apply theme based on settings
function applyTheme() {
  const savedTheme = localStorage.getItem('fsb-theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
}

// Check if URL is restricted for automation
function isRestrictedURL(url) {
  if (!url) return true;
  
  const restrictedProtocols = [
    'chrome://',
    'chrome-extension://',
    'moz-extension://',
    'edge://',
    'about:',
    'file://'
  ];
  
  return restrictedProtocols.some(protocol => url.startsWith(protocol));
}

// Get user-friendly page type description
function getPageTypeDescription(url) {
  if (url.startsWith('chrome://')) return 'Chrome internal page';
  if (url.startsWith('chrome-extension://')) return 'Chrome extension page';
  if (url.startsWith('edge://')) return 'Edge internal page';
  if (url.startsWith('about:')) return 'Browser internal page';
  if (url.startsWith('file://')) return 'Local file';
  return 'Restricted page';
}

// Listen for theme changes from options page
window.addEventListener('storage', (e) => {
  if (e.key === 'fsb-theme') {
    applyTheme();
  }
});

// Initialize analytics for sidepanel context
let sidepanelAnalytics = null;

function initializeSidepanelAnalytics() {
  try {
    // Create analytics instance for sidepanel
    sidepanelAnalytics = new FSBAnalytics();
    console.log('Sidepanel analytics initialized');
  } catch (error) {
    console.error('Failed to initialize sidepanel analytics:', error);
  }
}

// Listen for analytics updates from background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'ANALYTICS_UPDATE' && sidepanelAnalytics) {
    // Reload analytics data when updated
    sidepanelAnalytics.loadStoredData().then(() => {
      console.log('Sidepanel analytics data refreshed');
    });
  }
});

// Initialize side panel
document.addEventListener('DOMContentLoaded', async () => {
  console.log('FSB v0.9 side panel loaded');
  
  // Apply theme first
  applyTheme();
  
  // Initialize analytics
  initializeSidepanelAnalytics();
  
  // Check if extension is locked (using encrypted config)
  const hasEncryptedConfig = await checkEncryptedConfig();
  
  if (hasEncryptedConfig) {
    // Check if already unlocked in this session
    const session = await chrome.storage.session.get('masterPassword');
    
    if (!session.masterPassword) {
      // Need to unlock - show unlock UI or redirect
      addMessage('Extension is locked. Please unlock it first by opening the popup.', 'error');
      return;
    }
  }
  
  // Load saved task if any and restore it to input
  chrome.storage.local.get(['lastTask'], (data) => {
    if (data.lastTask && data.lastTask.trim()) {
      chatInput.textContent = data.lastTask;
      updateSendButtonState();
    }
  });
  
  // Check current status
  chrome.runtime.sendMessage({ action: 'getStatus' }, (response) => {
    if (chrome.runtime.lastError) {
      console.log('Background script not ready yet');
      return;
    }
    if (response && response.activeSessions > 0) {
      setRunningState();
      // Recover sessionId from background if UI lost it (e.g., after service worker restart)
      if (!currentSessionId && response.currentSessionId) {
        currentSessionId = response.currentSessionId;
        console.log('FSB: Recovered sessionId from background:', currentSessionId);
      }
    }
  });
  
  // Set UI mode preference
  await chrome.storage.local.set({ uiMode: 'sidepanel' });
  
  // Add welcome message
  addMessage('Welcome to FSB. How can I help?', 'system');
  
  // Focus the input
  chatInput.focus();
});

// Check if using encrypted configuration
async function checkEncryptedConfig() {
  try {
    const stored = await chrome.storage.local.get(['apiKey', 'captchaApiKey']);
    
    // Check if any key looks encrypted
    for (const value of Object.values(stored)) {
      if (value && typeof value === 'string') {
        try {
          const parsed = JSON.parse(value);
          if (parsed.encrypted && parsed.salt && parsed.iv) {
            return true;
          }
        } catch {
          // Not JSON, so not encrypted
        }
      }
    }
    return false;
  } catch (error) {
    console.error('Error checking encrypted config:', error);
    return false;
  }
}

// Event listeners
sendBtn.addEventListener('click', handleSendMessage);
stopBtn.addEventListener('click', stopAutomation);
newChatBtn.addEventListener('click', startNewChat);
settingsBtn.addEventListener('click', openSettings);

// PERF: Debounced storage save to avoid writes on every keystroke
let _saveTaskTimer = null;
function debouncedSaveTask() {
  clearTimeout(_saveTaskTimer);
  _saveTaskTimer = setTimeout(() => {
    chrome.storage.local.set({ lastTask: chatInput.textContent.trim() });
  }, 500);
}

// Chat input event handlers
chatInput.addEventListener('input', () => {
  updateSendButtonState();
  debouncedSaveTask();
});

chatInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleSendMessage();
  }
});

// Handle paste events to maintain plain text
chatInput.addEventListener('paste', (e) => {
  e.preventDefault();
  const text = e.clipboardData.getData('text/plain');
  document.execCommand('insertText', false, text);
});

// Update send button state based on input content
function updateSendButtonState() {
  const hasContent = chatInput.textContent.trim().length > 0;
  sendBtn.disabled = !hasContent || isRunning;
}

// Handle sending a message
async function handleSendMessage() {
  const message = chatInput.textContent.trim();
  
  if (!message || isRunning) {
    return;
  }
  
  try {
    // Add user message to chat
    addMessage(message, 'user');
    
    // Clear input
    chatInput.textContent = '';
    updateSendButtonState();
    
    // Get current tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // Note: Restriction checking is now handled by background script with smart navigation
    
    // Send start command to background
    chrome.runtime.sendMessage({
      action: 'startAutomation',
      task: message,
      tabId: tab.id
    }, (response) => {
      if (chrome.runtime.lastError) {
        addMessage(`Error communicating with background script: ${chrome.runtime.lastError.message}`, 'error');
        return;
      }
      
      if (response && response.success) {
        currentSessionId = response.sessionId;
        setRunningState();
        addStatusMessage('Starting automation...');
      } else {
        const errorMsg = response ? response.error : 'Unknown error';
        if (response && response.isChromePage) {
          // Show Chrome page error as plain text, not in a bubble
          showChromepageError(errorMsg);
        } else {
          addMessage(`I encountered an error: ${errorMsg}`, 'error');
        }
        setIdleState();
      }
    });
    
  } catch (error) {
    addMessage(`Something went wrong: ${error.message}`, 'error');
    setIdleState();
  }
}

// Stop automation
function stopAutomation() {
  console.log('Side panel: Stop button clicked');
  console.log('Side panel: Current session ID:', currentSessionId);
  
  if (!currentSessionId) {
    console.log('Side panel: No active session to stop');
    addMessage('No active automation to stop.', 'system');
    return;
  }
  
  stopRequested = true;
  
  console.log('Side panel: Sending stop message to background script');
  chrome.runtime.sendMessage({
    action: 'stopAutomation',
    sessionId: currentSessionId
  }, (response) => {
    console.log('Side panel: Stop automation response:', response);
    
    if (chrome.runtime.lastError) {
      console.error('Side panel: Chrome runtime error:', chrome.runtime.lastError);
      addMessage(`Error communicating with background script: ${chrome.runtime.lastError.message}`, 'error');
      stopRequested = false;
      return;
    }
    
    if (response && response.success) {
      // Complete any active status message before setting idle state
      if (currentStatusMessage) {
        completeStatusMessage('Automation stopped', 'system');
      }
      setIdleState();
      addMessage('Automation stopped. The side panel stays open for your next request!', 'system');
      currentSessionId = null;
      stopRequested = false;
      console.log('Side panel: Automation stopped successfully');
    } else {
      const errorMsg = response ? response.error : 'Unknown error';
      addMessage(`Error stopping automation: ${errorMsg}`, 'error');
      stopRequested = false;
      console.error('Side panel: Stop automation failed:', errorMsg);
    }
  });
}

// Start new chat session
function startNewChat() {
  // Stop any running automation first
  if (isRunning && currentSessionId) {
    chrome.runtime.sendMessage({
      action: 'stopAutomation',
      sessionId: currentSessionId
    });
  }
  
  // Reset session state
  currentSessionId = null;
  stopRequested = false;
  
  // Clear chat messages
  chatMessages.innerHTML = '';
  
  // Reset UI state
  setIdleState();
  
  // Clear any saved task
  chrome.storage.local.set({ lastTask: '' });
  
  // Clear input field
  chatInput.textContent = '';
  updateSendButtonState();
  
  // Add fresh welcome message
  addMessage('Welcome to FSB. How can I help?', 'system');
  
  // Focus the input
  chatInput.focus();
  
  console.log('New chat session started');
}


// Update UI for running state
function setRunningState() {
  isRunning = true;
  sendBtn.disabled = true;
  stopBtn.classList.remove('hidden');
  statusDot.classList.add('running');
  statusText.textContent = 'Working';
  updateSendButtonState();
}

// Update UI for idle state
function setIdleState() {
  isRunning = false;
  sendBtn.disabled = false;
  stopBtn.classList.add('hidden');
  statusDot.classList.remove('running', 'error');
  statusText.textContent = 'Ready';
  
  // Clean up any remaining status message with loader
  if (currentStatusMessage) {
    const loaderDots = currentStatusMessage.querySelector('.typing-dots');
    if (loaderDots) {
      loaderDots.remove();
    }
    currentStatusMessage = null;
  }
  
  updateSendButtonState();
}

// Update UI for error state
function setErrorState() {
  isRunning = false;
  sendBtn.disabled = false;
  stopBtn.classList.add('hidden');
  statusDot.classList.add('error');
  statusText.textContent = 'Error';
  updateSendButtonState();
}

// Global reference to current status message
let currentStatusMessage = null;

// Add dynamic status message with integrated loader
function addStatusMessage(text, type = 'ai') {
  // Remove any existing status message
  if (currentStatusMessage) {
    currentStatusMessage.remove();
  }
  
  const messageDiv = document.createElement('div');
  messageDiv.className = `message status-message status-dots-only new`;
  
  // Create message content with integrated loader
  const messageContent = document.createElement('div');
  messageContent.className = 'message-content';
  
  // Create loader dots
  const loaderDots = document.createElement('div');
  loaderDots.className = 'typing-dots';
  loaderDots.innerHTML = '<span></span><span></span><span></span>';
  
  // Create status text
  const statusText = document.createElement('span');
  statusText.className = 'status-text';
  statusText.textContent = text;
  
  // Assemble the message
  messageContent.appendChild(loaderDots);
  messageContent.appendChild(statusText);
  messageDiv.appendChild(messageContent);
  
  chatMessages.appendChild(messageDiv);
  
  // Store reference for updates
  currentStatusMessage = messageDiv;
  
  // Remove the 'new' class after animation
  setTimeout(() => {
    messageDiv.classList.remove('new');
  }, 400);
  
  scrollToBottom();
  return messageDiv;
}

// Update existing status message
function updateStatusMessage(text) {
  if (currentStatusMessage) {
    const statusText = currentStatusMessage.querySelector('.status-text');
    if (statusText) {
      statusText.textContent = text;
    }
  }
}


// Complete status message: remove dots-only indicator, show only the result bubble
function completeStatusMessage(text, type = 'ai') {
  if (currentStatusMessage) {
    currentStatusMessage.remove();
    currentStatusMessage = null;

    if (type === 'partial') {
      addCompletionMessage(text, 'ai', true);
    } else if (type !== 'system') {
      addCompletionMessage(text, type);
    } else {
      addMessage(text, 'system');
    }
  }
}

// Add a separate completion message bubble with markdown support
function addCompletionMessage(text, type = 'ai', isPartial = false) {
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ai-completion new`;

  if (isPartial) {
    messageDiv.classList.add('partial-result');
    const label = document.createElement('div');
    label.className = 'partial-result-label';
    label.textContent = 'Partial result';
    messageDiv.appendChild(label);
  }

  if (type === 'error') {
    messageDiv.className = `message error new`;
    messageDiv.textContent = text;
  } else {
    // Use markdown rendering if available, plain text fallback
    const contentDiv = document.createElement('div');
    if (typeof FSBMarkdown !== 'undefined') {
      FSBMarkdown.applyToElement(contentDiv, text);
    } else {
      contentDiv.textContent = text;
    }
    messageDiv.appendChild(contentDiv);
  }

  chatMessages.appendChild(messageDiv);

  setTimeout(() => {
    messageDiv.classList.remove('new');
  }, 400);

  while (chatMessages.children.length > 100) {
    chatMessages.removeChild(chatMessages.firstChild);
  }

  scrollToBottom();
}

// Show Chrome page error as plain text without bubble
function showChromepageError(text) {
  const messageDiv = document.createElement('div');
  messageDiv.className = 'chrome-page-error';
  messageDiv.textContent = text;
  
  // Add simple styling
  messageDiv.style.cssText = `
    color: #666;
    font-size: 14px;
    padding: 10px 15px;
    margin: 10px 0;
    text-align: center;
    font-style: italic;
    border-radius: 8px;
    background: rgba(255, 193, 7, 0.1);
    border: 1px solid rgba(255, 193, 7, 0.3);
  `;
  
  const messagesContainer = document.getElementById('messages');
  messagesContainer.appendChild(messageDiv);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Add message to chat with modern bubble styling
function addMessage(text, type = 'system') {
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${type} new`;
  
  // Handle different message types
  if (type === 'action') {
    // Format action messages nicely
    const actionText = text.replace(/Executed: (\w+)\((.*)\)/, (match, tool, params) => {
      try {
        const parsedParams = JSON.parse(params);
        const formattedParams = Object.entries(parsedParams)
          .map(([key, value]) => `${key}: "${value}"`)
          .join(', ');
        return `✓ ${tool}(${formattedParams})`;
      } catch {
        return `✓ ${tool}(${params})`;
      }
    });
    messageDiv.textContent = actionText;
  } else {
    messageDiv.textContent = text;
  }
  
  chatMessages.appendChild(messageDiv);
  
  // Remove the 'new' class after animation
  setTimeout(() => {
    messageDiv.classList.remove('new');
  }, 400);
  
  // Limit messages to prevent overflow
  while (chatMessages.children.length > 100) {
    chatMessages.removeChild(chatMessages.firstChild);
  }
  
  scrollToBottom();
}

// Smooth scroll to bottom
function scrollToBottom() {
  setTimeout(() => {
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }, 50);
}

// Open settings
function openSettings() {
  // Open the options page first
  chrome.runtime.openOptionsPage();

  // Then close the side panel
  window.close();
}

// Listen for messages from background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'automationComplete':
      if (!isRunning) return; // Already idle, ignore duplicate
      if (request.sessionId === currentSessionId) {
        // AI must always provide a meaningful completion message
        const completionMessage = request.result || 'The automation completed but no summary was provided. Please try again if the task wasn\'t completed as expected.';
        const isPartial = request.partial === true;

        if (currentStatusMessage) {
          completeStatusMessage(completionMessage, isPartial ? 'partial' : undefined);
        } else {
          addCompletionMessage(completionMessage, 'ai', isPartial);
        }

        setIdleState();
      }
      break;
      
    case 'statusUpdate':
      if (request.sessionId === currentSessionId) {
        updateStatusMessage(request.message);
      }
      break;
      
      
    case 'automationError':
      if (!isRunning) return; // Already idle, ignore duplicate
      if (request.sessionId === currentSessionId) {
        setErrorState();
        completeStatusMessage(`Error: ${request.error}`, 'error');

        // Provide specific guidance for stuck scenarios
        if (request.error && request.error.includes('stuck')) {
          addMessage('The automation got stuck repeating the same actions. Here are some tips:', 'system');
          addMessage('• Try being more specific about what you want to achieve', 'system');
          addMessage('• Check if the page requires manual steps like CAPTCHA solving', 'system');
          addMessage('• Ensure the page has fully loaded before starting', 'system');
        } else {
          addMessage('No worries! The side panel is still here. Try again or ask for help with something else.', 'system');
        }
      }
      break;
      
    case 'actionExecuted':
      if (request.sessionId === currentSessionId) {
        // Show a more user-friendly action message
        const actionMessage = formatActionMessage(request.tool, request.params);
        addMessage(actionMessage, 'action');
      }
      break;

    case 'loginDetected':
      if (request.sessionId === currentSessionId) {
        // Pause the status loader
        if (currentStatusMessage) {
          updateStatusMessage('Login page detected...');
        }
        showLoginPrompt(request.domain, request.fields);
        sendResponse({ received: true });
      }
      return;
  }
});

// Show inline login prompt in the chat
function showLoginPrompt(domain, fields) {
  // Prevent duplicate prompts if rapid loginDetected messages arrive
  const existing = document.getElementById('login-prompt');
  if (existing) existing.remove();

  // Complete any active status message
  if (currentStatusMessage) {
    completeStatusMessage('Login required', 'system');
  }

  const container = document.createElement('div');
  container.className = 'message login-prompt new';
  container.id = 'login-prompt';

  const fieldLabel = (fields && fields.usernameType === 'email') ? 'Email' : 'Username / Email';

  // Escape domain for safe HTML insertion
  const safeDomain = (domain || 'this site').replace(/[<>&"']/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'}[c]));

  container.innerHTML = `
    <div class="login-prompt-header">
      <i class="fas fa-lock"></i>
      <span>Login Required</span>
    </div>
    <div class="login-prompt-domain">${safeDomain}</div>
    <div class="login-prompt-subtext">Enter your credentials to sign in. They will be encrypted and saved for future use.</div>
    <div class="login-prompt-form">
      <div class="login-prompt-field">
        <label>${fieldLabel}</label>
        <input type="text" id="loginPromptUsername" placeholder="${fieldLabel}" autocomplete="username">
      </div>
      <div class="login-prompt-field">
        <label>Password</label>
        <div class="login-prompt-password-wrapper">
          <input type="password" id="loginPromptPassword" placeholder="Password" autocomplete="current-password">
          <button type="button" class="login-prompt-eye" id="loginPromptTogglePw">
            <i class="fas fa-eye"></i>
          </button>
        </div>
      </div>
      <label class="login-prompt-save-label">
        <input type="checkbox" id="loginPromptSave" checked>
        <span>Save for future use</span>
      </label>
      <div class="login-prompt-actions">
        <button class="login-prompt-btn primary" id="loginPromptSubmit">Sign In</button>
        <button class="login-prompt-btn ghost" id="loginPromptSkip">Skip</button>
      </div>
    </div>
  `;

  chatMessages.appendChild(container);
  scrollToBottom();

  // Remove 'new' class after animation
  setTimeout(() => container.classList.remove('new'), 400);

  // Focus username field
  setTimeout(() => {
    const usernameInput = document.getElementById('loginPromptUsername');
    if (usernameInput) usernameInput.focus();
  }, 100);

  // Toggle password visibility
  const toggleBtn = document.getElementById('loginPromptTogglePw');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const pwField = document.getElementById('loginPromptPassword');
      if (pwField) {
        const isPassword = pwField.type === 'password';
        pwField.type = isPassword ? 'text' : 'password';
        const icon = toggleBtn.querySelector('i');
        if (icon) icon.className = isPassword ? 'fas fa-eye-slash' : 'fas fa-eye';
      }
    });
  }

  // Sign In button
  const submitBtn = document.getElementById('loginPromptSubmit');
  if (submitBtn) {
    submitBtn.addEventListener('click', () => {
      const username = document.getElementById('loginPromptUsername')?.value?.trim();
      const password = document.getElementById('loginPromptPassword')?.value;
      const save = document.getElementById('loginPromptSave')?.checked ?? true;

      if (!username && !password) {
        return;
      }

      // Send credentials to background
      chrome.runtime.sendMessage({
        action: 'loginFormSubmitted',
        sessionId: currentSessionId,
        domain: domain,
        credentials: { username, password },
        save: save
      });

      // Remove prompt from chat
      container.remove();

      // Add system message
      addMessage('Signing in...', 'system');
      addStatusMessage('Signing in...');
    });
  }

  // Skip button
  const skipBtn = document.getElementById('loginPromptSkip');
  if (skipBtn) {
    skipBtn.addEventListener('click', () => {
      chrome.runtime.sendMessage({
        action: 'loginSkipped',
        sessionId: currentSessionId
      });

      // Remove prompt
      container.remove();
      addMessage('Login skipped. Continuing automation...', 'system');
      addStatusMessage('Continuing...');
    });
  }

  // Handle Enter key in password field
  const pwField = document.getElementById('loginPromptPassword');
  if (pwField) {
    pwField.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        submitBtn?.click();
      }
    });
  }
}

// Format action messages for better user experience
function formatActionMessage(tool, params) {
  switch (tool) {
    case 'click':
      return `Clicked on element: ${params.selector}`;
    case 'type':
      const enterText = params.pressEnter ? ' and pressed Enter' : '';
      return `Typed "${params.text}" into ${params.selector}${enterText}`;
    case 'pressEnter':
      return `Pressed Enter on ${params.selector}`;
    case 'scroll':
      return `Scrolled page by ${params.amount} pixels`;
    case 'moveMouse':
      return `Moved mouse to position (${params.x}, ${params.y})`;
    case 'solveCaptcha':
      return `Attempting to solve CAPTCHA`;
    // Multi-tab actions
    case 'openNewTab':
      return `Opened new tab: ${params.url || 'blank page'}${params.active === false ? ' (in background)' : ''}`;
    case 'switchToTab':
      return `Switched to tab ID: ${params.tabId}`;
    case 'closeTab':
      return `Closed tab ID: ${params.tabId}`;
    case 'listTabs':
      return `Listed all open tabs${params.currentWindowOnly === false ? ' (all windows)' : ' (current window)'}`;
    case 'getCurrentTab':
      return `Retrieved current tab information`;
    case 'waitForTabLoad':
      return `Waiting for tab ${params.tabId} to load...`;
    // Navigation & search
    case 'navigate':
      return `Navigating to ${params.url}`;
    case 'searchGoogle':
      return `Searching Google for: ${params.query}`;
    case 'scrollToElement':
      return `Scrolled to element: ${params.selector}`;
    case 'clickSearchResult':
      return `Clicked search result: ${params.selector}`;
    // Waiting & detection
    case 'waitForElement':
      return `Waiting for element: ${params.selector}`;
    case 'verifyMessageSent':
      return `Verifying message was sent`;
    case 'waitForDOMStable':
      return `Waiting for page to stabilize...`;
    case 'detectLoadingState':
      return `Checking if page is loading...`;
    // Click variants
    case 'rightClick':
      return `Right-clicked on element: ${params.selector}`;
    case 'doubleClick':
      return `Double-clicked on element: ${params.selector}`;
    // Keyboard actions
    case 'keyPress':
      return `Pressed key: ${params.key}`;
    case 'pressKeySequence':
      return `Pressed key sequence: ${Array.isArray(params.keys) ? params.keys.join(', ') : params.keys}`;
    case 'typeWithKeys':
      return `Typing with key events: ${params.text}`;
    case 'sendSpecialKey':
      return `Pressed special key: ${params.key}`;
    // Text & focus
    case 'selectText':
      return `Selected text in: ${params.selector}`;
    case 'focus':
      return `Focused on element: ${params.selector}`;
    case 'blur':
      return `Removed focus from: ${params.selector}`;
    case 'hover':
      return `Hovering over element: ${params.selector}`;
    // Form controls
    case 'selectOption':
      return `Selected '${params.optionText || params.value}' from dropdown: ${params.selector}`;
    case 'toggleCheckbox':
      return `Toggled checkbox: ${params.selector}`;
    // Data extraction
    case 'getText':
      return `Reading text from: ${params.selector}`;
    case 'getAttribute':
      return `Reading ${params.attribute} from: ${params.selector}`;
    case 'setAttribute':
      return `Setting ${params.attribute} on: ${params.selector}`;
    // Input management
    case 'clearInput':
      return `Cleared input: ${params.selector}`;
    // Gaming
    case 'gameControl':
      return `Game control: ${params.action}`;
    default:
      return `Executed ${tool} with params: ${JSON.stringify(params)}`;
  }
}

// Handle keyboard shortcuts
document.addEventListener('keydown', (e) => {
  // Cmd/Ctrl + Enter to send message
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && !isRunning) {
    handleSendMessage();
  }
  // Escape to stop automation
  else if (e.key === 'Escape' && isRunning) {
    stopAutomation();
  }
});

// Auto-resize chat input based on content
function adjustInputHeight() {
  chatInput.style.height = 'auto';
  chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px';
}

// Initialize input height adjustment
chatInput.addEventListener('input', adjustInputHeight);

// Prevent default drag and drop behavior
document.addEventListener('dragover', (e) => e.preventDefault());
document.addEventListener('drop', (e) => e.preventDefault());

// Handle side panel specific events
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    // Side panel became visible - refresh status if needed
    console.log('Side panel became visible');
  }
});




console.log('FSB v0.9 side panel script loaded');