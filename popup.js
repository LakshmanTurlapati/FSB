// Modern Chat Interface Script for FSB v0.1

let currentSessionId = null;
let isRunning = false;
let stopRequested = false;

// DOM elements - updated for new chat interface
const chatInput = document.getElementById('chatInput');
const sendBtn = document.getElementById('sendBtn');
const stopBtn = document.getElementById('stopBtn');
const testBtn = document.getElementById('testBtn');
const settingsBtn = document.getElementById('settingsBtn');
const pinBtn = document.getElementById('pinBtn');
const chatMessages = document.getElementById('chatMessages');
const typingIndicator = document.getElementById('typingIndicator');
const statusDot = document.querySelector('.status-dot');
const statusText = document.querySelector('.status-text');

// Apply theme based on settings
function applyTheme() {
  const savedTheme = localStorage.getItem('fsb-theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
}

// Listen for theme changes from options page
window.addEventListener('storage', (e) => {
  if (e.key === 'fsb-theme') {
    applyTheme();
  }
});

// Initialize analytics for popup context
let popupAnalytics = null;

function initializePopupAnalytics() {
  try {
    // Create analytics instance for popup
    popupAnalytics = new FSBAnalytics();
    console.log('Popup analytics initialized');
  } catch (error) {
    console.error('Failed to initialize popup analytics:', error);
  }
}

// Listen for analytics updates from background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'ANALYTICS_UPDATE' && popupAnalytics) {
    // Reload analytics data when updated
    popupAnalytics.loadStoredData().then(() => {
      console.log('Popup analytics data refreshed');
    });
  }
});

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
  // Apply theme first
  applyTheme();
  
  // Initialize analytics
  initializePopupAnalytics();
  
  // Check if extension is locked (using encrypted config)
  const hasEncryptedConfig = await checkEncryptedConfig();
  
  if (hasEncryptedConfig) {
    // Check if already unlocked in this session
    const session = await chrome.storage.session.get('masterPassword');
    
    if (!session.masterPassword) {
      // Need to unlock - open unlock page
      chrome.windows.create({
        url: chrome.runtime.getURL('unlock.html'),
        type: 'popup',
        width: 400,
        height: 500
      });
      window.close();
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
    if (response && response.activeSessions > 0) {
      setRunningState();
    }
  });
  
  // Check window mode
  await checkWindowMode();
  
  // Add welcome message
  addMessage('Welcome to FSB, Let\'s get started, How can i Help?', 'system');
  
  // Focus the input
  chatInput.focus();
});

// Check if using encrypted configuration
async function checkEncryptedConfig() {
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
}

// Event listeners
sendBtn.addEventListener('click', handleSendMessage);
stopBtn.addEventListener('click', stopAutomation);
testBtn.addEventListener('click', testAPI);
settingsBtn.addEventListener('click', openSettings);
pinBtn.addEventListener('click', togglePinWindow);

// Chat input event handlers
chatInput.addEventListener('input', () => {
  updateSendButtonState();
  // Save task as user types
  chrome.storage.local.set({ lastTask: chatInput.textContent.trim() });
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
    
    // Show typing indicator
    showTypingIndicator();
    
    // Get current tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // Send start command to background
    chrome.runtime.sendMessage({
      action: 'startAutomation',
      task: message,
      tabId: tab.id
    }, (response) => {
      hideTypingIndicator();
      
      if (response.success) {
        currentSessionId = response.sessionId;
        setRunningState();
        addStatusMessage('Starting automation...');
      } else {
        addMessage(`I encountered an error: ${response.error}`, 'error');
        setIdleState();
      }
    });
    
  } catch (error) {
    hideTypingIndicator();
    addMessage(`Something went wrong: ${error.message}`, 'error');
    setIdleState();
  }
}

// Stop automation
function stopAutomation() {
  console.log('Stop button clicked');
  console.log('Current session ID:', currentSessionId);
  console.log('Is running:', isRunning);
  
  if (!currentSessionId) {
    console.log('No active session to stop');
    addMessage('No active automation to stop.', 'system');
    return;
  }
  
  // Set flag to prevent new typing indicators
  stopRequested = true;
  hideTypingIndicator();
  
  console.log('Sending stop message to background script');
  chrome.runtime.sendMessage({
    action: 'stopAutomation',
    sessionId: currentSessionId
  }, (response) => {
    console.log('Stop automation response:', response);
    
    if (chrome.runtime.lastError) {
      console.error('Chrome runtime error:', chrome.runtime.lastError);
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
      addMessage('Automation stopped. Let me know if you need help with anything else!', 'system');
      currentSessionId = null;
      stopRequested = false;
      console.log('Automation stopped successfully');
    } else {
      const errorMsg = response ? response.error : 'Unknown error';
      addMessage(`Error stopping automation: ${errorMsg}`, 'error');
      console.error('Stop automation failed:', errorMsg);
      stopRequested = false;
    }
  });
}

// Test API connection
function testAPI() {
  addMessage('Testing xAI API connection...', 'system');
  showTypingIndicator('Connecting to xAI Grok...');
  
  const testIcon = testBtn.querySelector('i');
  if (testIcon) {
    testIcon.className = 'fa fa-spinner fa-spin';
  }
  
  chrome.runtime.sendMessage({
    action: 'testAPI'
  }, (response) => {
    hideTypingIndicator();
    if (testIcon) {
      testIcon.className = 'fa fa-wrench';
    }
    
    if (response.success) {
      addMessage('Great! API connection is working perfectly.', 'system');
      if (response.result && response.result.data) {
        addMessage(`Connected to model: ${response.result.model || 'grok-3-mini'}`, 'ai');
      }
    } else {
      addMessage('API connection failed. Please check your settings.', 'error');
      if (response.result) {
        addMessage(`Status: ${response.result.status} - ${response.result.statusText}`, 'error');
        if (response.result.error) {
          addMessage(`Details: ${response.result.error}`, 'error');
        }
      } else if (response.error) {
        addMessage(`Error details: ${response.error}`, 'error');
      }
    }
  });
}

// Show typing indicator
function showTypingIndicator(customText = null) {
  // Don't show typing indicator if stop was requested
  if (stopRequested) {
    console.log('Typing indicator blocked - stop requested');
    return;
  }
  
  if (customText) {
    typingIndicator.querySelector('.typing-text').textContent = customText;
  } else {
    typingIndicator.querySelector('.typing-text').textContent = 'AI is thinking...';
  }
  typingIndicator.classList.remove('hidden');
  scrollToBottom();
}

// Hide typing indicator
function hideTypingIndicator() {
  typingIndicator.classList.add('hidden');
}

// Update UI for running state
function setRunningState() {
  isRunning = true;
  stopRequested = false; // Reset stop flag when starting new automation
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
  hideTypingIndicator();
  
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
  hideTypingIndicator();
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
  messageDiv.className = `message ${type} status-message new`;
  
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

// Complete status message (remove loader, show final result)
function completeStatusMessage(text, type = 'ai') {
  if (currentStatusMessage) {
    // Remove loader dots
    const loaderDots = currentStatusMessage.querySelector('.typing-dots');
    if (loaderDots) {
      loaderDots.remove();
    }
    
    // Update text and styling
    const statusText = currentStatusMessage.querySelector('.status-text');
    if (statusText) {
      statusText.textContent = text;
    }
    
    // Change message type styling
    currentStatusMessage.className = `message ${type} completed`;
    
    // Clear reference
    currentStatusMessage = null;
  }
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

// Toggle pin window functionality
async function togglePinWindow() {
  console.log('Pin button clicked');
  
  // Get current preference
  const { windowMode } = await chrome.storage.local.get(['windowMode']);
  const isCurrentlyPinned = windowMode === 'pinned';
  
  if (isCurrentlyPinned) {
    // Switch back to popup mode
    await chrome.storage.local.set({ windowMode: 'popup' });
    pinBtn.classList.remove('pinned');
    addMessage('Switched to popup mode. Extension will close when clicked outside.', 'system');
  } else {
    // Switch to persistent window mode
    await chrome.storage.local.set({ windowMode: 'pinned' });
    
    // Create persistent window
    const currentWindow = await chrome.windows.getCurrent();
    chrome.windows.create({
      url: chrome.runtime.getURL('popup.html'),
      type: 'popup',
      width: 400,
      height: 600,
      left: currentWindow.left + 50,
      top: currentWindow.top + 50
    });
    
    // Close current popup
    window.close();
  }
}

// Check window mode on startup
async function checkWindowMode() {
  const { windowMode } = await chrome.storage.local.get(['windowMode']);
  if (windowMode === 'pinned') {
    pinBtn.classList.add('pinned');
    addMessage('Running in persistent window mode.', 'system');
  }
}


// Open settings
function openSettings() {
  chrome.runtime.openOptionsPage();
}

// Listen for messages from background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'automationComplete':
      if (request.sessionId === currentSessionId) {
        setIdleState();
        // Use AI-generated summary instead of hardcoded message
        const completionMessage = request.result || 'Task completed successfully!';
        completeStatusMessage(completionMessage);
      }
      break;
      
    case 'statusUpdate':
      if (request.sessionId === currentSessionId && !stopRequested) {
        // Update the status message bubble instead of typing indicator
        updateStatusMessage(request.message);
      }
      break;
      
    case 'automationError':
      if (request.sessionId === currentSessionId) {
        setErrorState();
        completeStatusMessage(`Error: ${request.error}`, 'error');
        addMessage('Let me know if you\'d like to try again or need help with something else.', 'system');
      }
      break;
      
    case 'actionExecuted':
      if (request.sessionId === currentSessionId && !stopRequested) {
        // Show a more user-friendly action message
        const actionMessage = formatActionMessage(request.tool, request.params);
        addMessage(actionMessage, 'action');
        
        // Update typing indicator for next action
        showTypingIndicator('Analyzing results...');
      }
      break;
      
    case 'aiThinking':
      if (request.sessionId === currentSessionId && !stopRequested) {
        // Handle AI thinking messages
        if (request.message.includes('Analyzing')) {
          showTypingIndicator('Analyzing page...');
        // } else if (request.message.includes('reasoning')) {
        //   addMessage(request.message, 'ai');
        } else {
          showTypingIndicator(request.message);
        }
      }
      break;
  }
});

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

console.log('FSB v0.1 chat interface loaded');