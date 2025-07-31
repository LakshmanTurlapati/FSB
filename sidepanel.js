// Side Panel Script for FSB v0.1 - Persistent UI

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
  console.log('FSB v0.1 side panel loaded');
  
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
    }
  });
  
  // Set UI mode preference
  await chrome.storage.local.set({ uiMode: 'sidepanel' });
  
  // Add welcome message
  addMessage('Welcome to FSB, Let\'s get started, How can i Help?', 'system');
  
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
        addMessage(`I encountered an error: ${errorMsg}`, 'error');
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
  console.log('Side panel: Stop button clicked');
  console.log('Side panel: Current session ID:', currentSessionId);
  
  if (!currentSessionId) {
    console.log('Side panel: No active session to stop');
    addMessage('No active automation to stop.', 'system');
    return;
  }
  
  // Set flag to prevent new typing indicators
  stopRequested = true;
  hideTypingIndicator();
  
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
  addMessage('Welcome to FSB, Let\'s get started, How can i Help?', 'system');
  
  // Focus the input
  chatInput.focus();
  
  console.log('New chat session started');
}


// Show typing indicator
function showTypingIndicator(customText = null) {
  let displayText = customText || 'AI is thinking...';
  
  typingIndicator.querySelector('.typing-text').textContent = displayText;
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
      if (request.sessionId === currentSessionId) {
        updateStatusMessage(request.message);
      }
      break;
      
      
    case 'automationError':
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
        
        // Update typing indicator for next action
        showTypingIndicator('Analyzing results...');
      }
      break;
      
    case 'aiThinking':
      if (request.sessionId === currentSessionId) {
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

// Handle side panel specific events
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    // Side panel became visible - refresh status if needed
    console.log('Side panel became visible');
  }
});




console.log('FSB v0.1 side panel script loaded');