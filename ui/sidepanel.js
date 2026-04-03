// Side Panel Script for FSB v0.9.20 - Persistent UI

let currentSessionId = null;
let conversationId = null;
let activeConversationId = null;
let historySessionId = null;
let isRunning = false;
let stopRequested = false;
let isHistoryViewActive = false;
let showSidepanelProgressEnabled = false;
const DEFAULT_CHAT_INPUT_HEIGHT = 48;
const MAX_CHAT_INPUT_HEIGHT = 120;
const SIDEPANEL_PLACEHOLDERS = [
  'Let\'s do everything...',
  'Make this easier...',
  'Automate the boring part...',
  'Point me at the mess...',
  'Give me the next move...',
  'Let\'s make this disappear...'
];
let resetInputAnimationTimer = null;
let currentPlaceholderIndex = 0;

// Initialize or restore conversation ID for session continuity
async function initConversationId() {
  try {
    const stored = await chrome.storage.session.get(['fsbSidepanelConversationId']);
    if (stored.fsbSidepanelConversationId) {
      conversationId = stored.fsbSidepanelConversationId;
    } else {
      conversationId = `conv_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      await chrome.storage.session.set({ fsbSidepanelConversationId: conversationId });
    }
  } catch (e) {
    // Fallback: generate without persistence
    conversationId = `conv_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  }
}

async function restoreSidepanelThreadState() {
  try {
    const stored = await chrome.storage.session.get([
      'fsbSidepanelActiveConversationId',
      'fsbSidepanelHistorySessionId'
    ]);
    activeConversationId = stored.fsbSidepanelActiveConversationId || null;
    historySessionId = stored.fsbSidepanelHistorySessionId || null;
  } catch (e) {
    activeConversationId = null;
    historySessionId = null;
  }
}

function persistSidepanelThreadState() {
  chrome.storage.session.set({
    fsbSidepanelActiveConversationId: activeConversationId || null,
    fsbSidepanelHistorySessionId: historySessionId || null
  }).catch(() => {});
}

function persistSidepanelConversationId() {
  chrome.storage.session.set({ fsbSidepanelConversationId: conversationId }).catch(() => {});
}

function getSelectedConversationId() {
  return activeConversationId || conversationId;
}

// DOM elements - adapted for side panel
const chatInput = document.getElementById('chatInput');
const sendBtn = document.getElementById('sendBtn');
const micBtn = document.getElementById('micBtn');
const newChatBtn = document.getElementById('newChatBtn');
const settingsBtn = document.getElementById('settingsBtn');
const chatMessages = document.getElementById('chatMessages');
const historyBtn = document.getElementById('historyBtn');
const statusDot = document.querySelector('.status-dot');
const statusText = document.querySelector('.status-text');
const footerVersion = document.getElementById('footerVersion');
const systemThemeQuery = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

// Initialize speech-to-text
const stt = new FSBSpeechToText(chatInput, micBtn, sendBtn);

// Apply theme based on settings
function getPreferredTheme() {
  const savedTheme = localStorage.getItem('fsb-theme');
  if (savedTheme === 'light' || savedTheme === 'dark') {
    return savedTheme;
  }
  return systemThemeQuery?.matches ? 'dark' : 'light';
}

function applyTheme() {
  document.documentElement.setAttribute('data-theme', getPreferredTheme());
}

function setUiState(state) {
  document.body.dataset.uiState = state;
}

function setSidepanelView(view) {
  document.body.dataset.sidepanelView = view;
}

function syncFooterVersion() {
  if (!footerVersion || !chrome?.runtime?.getManifest) return;
  footerVersion.textContent = `v${chrome.runtime.getManifest().version}`;
}

function isChatInputEmpty() {
  return chatInput.textContent.trim().length === 0;
}

function canShowPlaceholder() {
  return !isHistoryViewActive && !document.hidden && isChatInputEmpty();
}

function setChatPlaceholder(text) {
  chatInput.dataset.placeholder = text;
}

function showCurrentPlaceholder() {
  setChatPlaceholder(SIDEPANEL_PLACEHOLDERS[currentPlaceholderIndex] || '');
}

function clearChatPlaceholder() {
  setChatPlaceholder('');
}

function advancePlaceholder() {
  currentPlaceholderIndex = (currentPlaceholderIndex + 1) % SIDEPANEL_PLACEHOLDERS.length;
}

function syncPlaceholder({ resetIndex = false, advance = false } = {}) {
  if (resetIndex) {
    currentPlaceholderIndex = 0;
  } else if (advance) {
    advancePlaceholder();
  }

  if (canShowPlaceholder()) {
    showCurrentPlaceholder();
  } else if (!isChatInputEmpty()) {
    clearChatPlaceholder();
  }
}

// Listen for theme changes from options page
window.addEventListener('storage', (e) => {
  if (e.key === 'fsb-theme') {
    applyTheme();
  }
});

if (systemThemeQuery) {
  systemThemeQuery.addEventListener('change', () => {
    if (!localStorage.getItem('fsb-theme')) {
      applyTheme();
    }
  });
}

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

// -- Reconnaissance integration --
let pendingReconTask = null;
// Track multiple recon progress messages keyed by crawlerId
const reconProgressMessages = new Map();

/**
 * Start a reconnaissance crawl from the side panel.
 * Uses a lighter crawl (depth 2, max 15 pages) for speed.
 */
async function startReconFromSidepanel(url, originalTask) {
  pendingReconTask = originalTask;
  const domain = new URL(url).hostname;

  addMessage('Starting reconnaissance on ' + domain + '...', 'system');

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'startExplorer',
      url: url,
      maxDepth: 2,
      maxPages: 15,
      autoSaveToMemory: true
    });

    if (!response || !response.success) {
      addMessage('Reconnaissance failed to start: ' + (response?.error || 'Unknown error'), 'system');
      pendingReconTask = null;
    }
  } catch (error) {
    addMessage('Reconnaissance failed: ' + error.message, 'system');
    pendingReconTask = null;
  }
}

/**
 * Handle progress updates from Site Explorer during reconnaissance.
 * Supports multiple concurrent crawlers keyed by crawlerId.
 */
function handleReconProgress(data) {
  const crawlerId = data.crawlerId || 'default';
  const domain = data.domain || '?';

  if (data.status === 'crawling') {
    let progressMsg = reconProgressMessages.get(crawlerId);
    if (!progressMsg) {
      progressMsg = document.createElement('div');
      progressMsg.id = 'recon-progress-' + crawlerId;
      progressMsg.className = 'message system recon-progress';
      chatMessages.appendChild(progressMsg);
      reconProgressMessages.set(crawlerId, progressMsg);
    }
    const percent = data.maxPages > 0 ? Math.round((data.pagesCollected / data.maxPages) * 100) : 0;
    progressMsg.textContent = 'Recon [' + domain + ']: ' + data.pagesCollected + '/' + data.maxPages + ' pages (' + percent + '%)';
    scrollToBottom();
  } else if (data.status === 'completed' || data.status === 'stopped' || data.status === 'error') {
    // Remove the progress message for this crawler
    const progressMsg = reconProgressMessages.get(crawlerId);
    if (progressMsg) {
      progressMsg.remove();
      reconProgressMessages.delete(crawlerId);
    }
  }
}

/**
 * Handle reconnaissance completion -- offer retry with original task.
 */
function handleReconComplete(data) {
  // Clean up any remaining progress messages for this domain
  for (const [id, el] of reconProgressMessages) {
    el.remove();
    reconProgressMessages.delete(id);
  }

  addMessage('Reconnaissance complete! Site map saved for ' + (data?.domain || 'this site') + '.', 'system');

  // Offer retry with the original task
  if (pendingReconTask) {
    const retryDiv = document.createElement('div');
    retryDiv.className = 'message system new';
    retryDiv.textContent = 'Site map ready. Retry your task? ';
    const retryBtn = document.createElement('button');
    retryBtn.className = 'retry-btn';
    retryBtn.textContent = 'Retry with Site Map';
    retryBtn.addEventListener('click', () => {
      retryDiv.remove();
      chatInput.textContent = pendingReconTask;
      pendingReconTask = null;
      handleSendMessage();
    });
    retryDiv.appendChild(retryBtn);
    chatMessages.appendChild(retryDiv);
    scrollToBottom();
  }
}

// Listen for explorer status and site map saved messages
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'explorerStatusUpdate') {
    handleReconProgress(message.data);
  }
  if (message.type === 'siteMapSaved') {
    handleReconComplete(message.data);
  }
});

// Keep sidepanel progress setting in sync when changed from options
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.showSidepanelProgress != null) {
    showSidepanelProgressEnabled = changes.showSidepanelProgress.newValue ?? false;
  }
});

// Initialize side panel
document.addEventListener('DOMContentLoaded', async () => {
  console.log('FSB v0.9.20 side panel loaded');

  // Apply theme first
  applyTheme();
  setUiState('idle');
  setSidepanelView('chat');
  syncFooterVersion();
  syncPlaceholder({ resetIndex: true });

  // Load sidepanel progress setting
  try {
    const stored = await chrome.storage.local.get(['showSidepanelProgress']);
    showSidepanelProgressEnabled = stored.showSidepanelProgress ?? false;
  } catch (e) {
    showSidepanelProgressEnabled = false;
  }

  // Initialize conversation ID for session continuity
  await initConversationId();
  await restoreSidepanelThreadState();

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
      adjustInputHeight();
      updateSendButtonState();
      syncPlaceholder();
    }
  });
  
  // Check current status
  chrome.runtime.sendMessage({ action: 'getStatus' }, (response) => {
    if (chrome.runtime.lastError) {
      console.log('Background script not ready yet');
      return;
    }
    const surfaceSession = response?.sessionsBySurface?.sidepanel;
    if (surfaceSession?.sessionId) {
      if (!currentSessionId) {
        currentSessionId = surfaceSession.sessionId;
        console.log('FSB: Recovered sidepanel sessionId from background:', currentSessionId);
      }
      if (!activeConversationId && surfaceSession.conversationId) {
        activeConversationId = surfaceSession.conversationId;
      }
      if (!historySessionId && surfaceSession.historySessionId) {
        historySessionId = surfaceSession.historySessionId;
      }
      persistSidepanelThreadState();
      if (surfaceSession.status === 'running' || surfaceSession.status === 'replaying') {
        setRunningState();
      }
    }
  });
  
  // Set UI mode preference
  await chrome.storage.local.set({ uiMode: 'sidepanel' });
  
  // History list event delegation for delete buttons
  const historyListEl = document.getElementById('historyList');
  if (historyListEl) {
    historyListEl.addEventListener('click', async (e) => {
      const replayBtn = e.target.closest('.history-replay-btn');
      if (replayBtn) {
        e.stopPropagation();
        const sessionId = replayBtn.dataset.sessionId;
        if (sessionId) {
          startReplay(sessionId);
        }
        return;
      }

      const deleteBtn = e.target.closest('.history-delete-btn');
      if (deleteBtn) {
        e.stopPropagation();
        const sessionId = deleteBtn.dataset.sessionId;
        if (sessionId) {
          await deleteHistorySession(sessionId);
        }
        return;
      }

      const historyItem = e.target.closest('.history-item');
      if (historyItem) {
        const sessionId = historyItem.dataset.sessionId;
        if (sessionId) {
          loadSessionView(sessionId);
        }
      }
    });
  }

  // Clear All button
  const clearAllHistoryBtn = document.getElementById('clearAllHistoryBtn');
  if (clearAllHistoryBtn) {
    clearAllHistoryBtn.addEventListener('click', clearAllHistorySessions);
  }

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
newChatBtn.addEventListener('click', startNewChat);
settingsBtn.addEventListener('click', openSettings);
historyBtn.addEventListener('click', toggleHistoryView);

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
  syncPlaceholder();
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
  if (isRunning) return; // Don't disable stop button based on input content
  const hasContent = chatInput.textContent.trim().length > 0;
  sendBtn.disabled = !hasContent;
}

// Handle sending a message
async function handleSendMessage() {
  const message = chatInput.textContent.trim();

  if (!message || isRunning) {
    return;
  }

  // Handle /agent slash commands
  if (message.startsWith('/agent')) {
    chatInput.textContent = '';
    resetInputHeight(true);
    updateSendButtonState();
    syncPlaceholder({ advance: true });
    addMessage(message, 'user');
    handleAgentCommand(message);
    return;
  }

  try {
    // Add user message to chat
    addMessage(message, 'user');

    // Clear input
    chatInput.textContent = '';
    resetInputHeight(true);
    updateSendButtonState();
    syncPlaceholder({ advance: true });
    
    // Get current tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // Note: Restriction checking is now handled by background script with smart navigation
    
    // Send start command to background
    chrome.runtime.sendMessage({
      action: 'startAutomation',
      task: message,
      tabId: tab.id,
      uiSurface: 'sidepanel',
      selectedConversationId: getSelectedConversationId(),
      historySessionId: historySessionId,
      conversationId: conversationId
    }, (response) => {
      if (chrome.runtime.lastError) {
        addMessage(`Error communicating with background script: ${chrome.runtime.lastError.message}`, 'error');
        return;
      }

      if (response && response.success) {
        currentSessionId = response.sessionId;
        activeConversationId = response.conversationId || getSelectedConversationId();
        historySessionId = response.historySessionId || historySessionId || response.sessionId;
        persistSidepanelThreadState();
        setRunningState();
        addStatusMessage(response.continued ? 'Continuing...' : 'Starting automation...');
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
  // Switch back to chat view if history is showing
  if (isHistoryViewActive) {
    showChatView();
  }

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
  activeConversationId = null;
  historySessionId = null;
  persistSidepanelThreadState();

  // Generate new conversationId for new chat
  conversationId = `conv_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  persistSidepanelConversationId();

  // Clear chat messages
  chatMessages.innerHTML = '';
  
  // Reset UI state
  setIdleState();
  
  // Clear any saved task
  chrome.storage.local.set({ lastTask: '' });
  
  // Clear input field
  chatInput.textContent = '';
  resetInputHeight();
  updateSendButtonState();
  syncPlaceholder({ advance: true });
  
  // Add fresh welcome message
  addMessage('Welcome to FSB. How can I help?', 'system');
  
  // Focus the input
  chatInput.focus();
  
  console.log('New chat session started');
}


// Update UI for running state
function setRunningState() {
  isRunning = true;
  setUiState('running');
  sendBtn.className = 'stop-btn';
  sendBtn.title = 'Stop Automation';
  sendBtn.querySelector('i').className = 'fa fa-stop';
  sendBtn.disabled = false;
  sendBtn.onclick = stopAutomation;
  statusDot.classList.remove('error');
  statusDot.classList.add('running');
  statusText.textContent = 'Working';
}

// Update UI for idle state
function setIdleState() {
  isRunning = false;
  setUiState('idle');
  sendBtn.className = 'send-btn';
  sendBtn.title = 'Send Message';
  sendBtn.querySelector('i').className = 'fa fa-arrow-up';
  sendBtn.onclick = handleSendMessage;
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

  // Reset action debug group reference
  currentActionGroup = null;

  updateSendButtonState();
}

// Update UI for error state
function setErrorState() {
  isRunning = false;
  setUiState('error');
  sendBtn.className = 'send-btn';
  sendBtn.title = 'Send Message';
  sendBtn.querySelector('i').className = 'fa fa-arrow-up';
  sendBtn.onclick = handleSendMessage;
  statusDot.classList.remove('running');
  statusDot.classList.add('error');
  statusText.textContent = 'Error';
  updateSendButtonState();
}

// Global reference to current status message
let currentStatusMessage = null;

// Collapsible debug panel for action steps (lives inside the status message)
let currentActionGroup = null;

function ensureActionGroup() {
  if (currentActionGroup) return currentActionGroup;
  if (!currentStatusMessage) return null;

  const group = document.createElement('div');
  group.className = 'action-summary-group';
  const header = document.createElement('div');
  header.className = 'action-summary-header';
  header.innerHTML = '<span class="action-chevron">></span><span class="action-summary-count">0 actions completed</span>';
  header.addEventListener('click', () => {
    const list = group.querySelector('.action-summary-list');
    const chevron = group.querySelector('.action-chevron');
    if (list.classList.contains('collapsed')) {
      list.classList.remove('collapsed');
      chevron.classList.add('expanded');
    } else {
      list.classList.add('collapsed');
      chevron.classList.remove('expanded');
    }
  });
  const list = document.createElement('div');
  list.className = 'action-summary-list collapsed';
  group.appendChild(header);
  group.appendChild(list);

  // Place directly on the status message div (outside .message-content flex row)
  currentStatusMessage.appendChild(group);

  currentActionGroup = group;
  return group;
}

function addActionMessage(text) {
  if (!showSidepanelProgressEnabled) return;

  const group = ensureActionGroup();
  if (!group) return;

  // Append new action entry into the list
  const list = group.querySelector('.action-summary-list');
  const entry = document.createElement('div');
  entry.className = 'collapsed-action';
  entry.textContent = text;
  list.appendChild(entry);

  // Update count label
  const countEl = group.querySelector('.action-summary-count');
  if (countEl) {
    countEl.textContent = `${list.children.length} action${list.children.length === 1 ? '' : 's'} completed`;
  }

  scrollToBottom();
}

// Add dynamic status message with integrated loader
function addStatusMessage(text, type = 'ai') {
  // Remove any existing status message (and its embedded action group)
  if (currentStatusMessage) {
    currentStatusMessage.remove();
    currentActionGroup = null;
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
  
  // Progress container (hidden until progress data arrives)
  const progressContainer = document.createElement('div');
  progressContainer.className = 'progress-container hidden';
  const progressBar = document.createElement('div');
  progressBar.className = 'progress-bar';
  const progressFill = document.createElement('div');
  progressFill.className = 'progress-fill';
  progressBar.appendChild(progressFill);
  const progressLabel = document.createElement('span');
  progressLabel.className = 'progress-label';
  progressContainer.appendChild(progressBar);
  progressContainer.appendChild(progressLabel);

  // Assemble the message
  messageContent.appendChild(loaderDots);
  messageContent.appendChild(statusText);
  if (showSidepanelProgressEnabled) {
    messageContent.appendChild(progressContainer);
  }
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

// Update existing status message with optional progress data
function updateStatusMessage(text, progressData) {
  if (currentStatusMessage) {
    const statusText = currentStatusMessage.querySelector('.status-text');
    if (statusText) {
      statusText.textContent = text;
    }
    if (progressData && progressData.iteration != null) {
      const container = currentStatusMessage.querySelector('.progress-container');
      const fill = currentStatusMessage.querySelector('.progress-fill');
      const label = currentStatusMessage.querySelector('.progress-label');
      if (container && fill && label) {
        container.classList.remove('hidden');
        fill.style.width = (progressData.progressPercent || 0) + '%';
        label.textContent = `${(progressData.progressPercent || 0)}%`;
      }
    }
  }
}


// Complete status message: remove dots-only indicator, show only the result bubble
function completeStatusMessage(text, type = 'ai') {
  if (currentStatusMessage) {
    currentStatusMessage.remove();
    currentStatusMessage = null;
    currentActionGroup = null;

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
        return `${tool}(${formattedParams})`;
      } catch {
        return `${tool}(${params})`;
      }
    });
    messageDiv.textContent = actionText;
  } else {
    messageDiv.textContent = text;
  }

  // Add dismiss button for error messages
  if (type === 'error') {
    const dismissBtn = document.createElement('button');
    dismissBtn.className = 'message-dismiss';
    dismissBtn.textContent = 'X';
    dismissBtn.addEventListener('click', () => {
      messageDiv.classList.add('collapsing');
      setTimeout(() => messageDiv.remove(), 300);
    });
    messageDiv.appendChild(dismissBtn);
    // Auto-collapse error after 30 seconds
    setTimeout(() => {
      if (messageDiv.parentNode && !messageDiv.classList.contains('collapsing')) {
        messageDiv.classList.add('auto-collapsed');
      }
    }, 30000);
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

function normalizeAutomationOutcome(outcome, status, hasError) {
  var normalizedOutcome = typeof outcome === 'string' ? outcome.trim().toLowerCase() : '';
  if (normalizedOutcome === 'error') return 'failure';
  if (normalizedOutcome === 'success' || normalizedOutcome === 'partial' || normalizedOutcome === 'failure' || normalizedOutcome === 'stopped') {
    return normalizedOutcome;
  }

  var normalizedStatus = typeof status === 'string' ? status.trim().toLowerCase() : '';
  if (normalizedStatus === 'partial') return 'partial';
  if (normalizedStatus === 'stopped') return 'stopped';
  if (normalizedStatus === 'error' || normalizedStatus === 'failed' || normalizedStatus === 'stuck') return 'failure';

  return hasError ? 'failure' : 'success';
}

function getSessionOutcomeDisplay(session) {
  session = session || {};
  var outcomeDetails = session.outcomeDetails && typeof session.outcomeDetails === 'object'
    ? session.outcomeDetails
    : {};
  var outcome = normalizeAutomationOutcome(
    session.outcome || outcomeDetails.outcome,
    session.status || outcomeDetails.outcome,
    Boolean(session.error || outcomeDetails.error)
  );

  return {
    outcome: outcome,
    statusClass: outcome === 'success'
      ? 'completed'
      : outcome === 'partial'
        ? 'partial'
        : outcome === 'stopped'
          ? 'stopped'
          : 'error',
    statusLabel: outcome === 'success'
      ? 'completed'
      : outcome === 'partial'
        ? 'partial'
        : outcome === 'stopped'
          ? 'stopped'
          : 'failed',
    summary: outcomeDetails.summary || session.result || null,
    blocker: outcomeDetails.blocker || session.blocker || null,
    nextStep: outcomeDetails.nextStep || session.nextStep || null,
    resultText: session.completionMessage || outcomeDetails.result || session.result || outcomeDetails.summary || null,
    error: session.error || outcomeDetails.error || null
  };
}

function removeLoginPrompt() {
  const existing = document.getElementById('login-prompt');
  if (existing) {
    existing.remove();
  }
}

// Listen for messages from background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'automationComplete':
      if (!isRunning) return; // Already idle, ignore duplicate
      if (request.sessionId === currentSessionId) {
        removeLoginPrompt();
        var outcome = normalizeAutomationOutcome(
          request.outcome,
          request.outcomeDetails?.outcome,
          Boolean(request.error || request.outcomeDetails?.error)
        );
        var completionMessage = request.result ||
          request.outcomeDetails?.result ||
          request.outcomeDetails?.summary ||
          'The automation completed but no summary was provided. Please try again if the task wasn\'t completed as expected.';

        if (outcome === 'failure') {
          var errorMessage = request.error || request.outcomeDetails?.error || completionMessage || 'Automation error';
          setErrorState();
          if (currentStatusMessage) {
            completeStatusMessage('Error: ' + errorMessage, 'error');
          } else {
            addCompletionMessage('Error: ' + errorMessage, 'error');
          }
          break;
        }

        if (currentStatusMessage) {
          completeStatusMessage(
            completionMessage,
            outcome === 'partial' ? 'partial' : (outcome === 'stopped' ? 'system' : undefined)
          );
        } else if (outcome === 'stopped') {
          addMessage(completionMessage, 'system');
        } else {
          addCompletionMessage(completionMessage, 'ai', outcome === 'partial');
        }

        setIdleState();
        // Refresh history list if history view is active
        if (isHistoryViewActive) {
          loadHistoryList();
        }

        // Check if reconnaissance could help (partial/stuck completions on unmapped sites)
        if (outcome === 'partial') {
          (async () => {
            try {
              const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
              const currentUrl = tabs[0]?.url;
              if (currentUrl && currentUrl.startsWith('http')) {
                const domain = new URL(currentUrl).hostname;
                const siteMapCheck = await chrome.runtime.sendMessage({
                  action: 'checkSiteMap',
                  domain
                });

                if (!siteMapCheck || !siteMapCheck.exists) {
                  const reconDiv = document.createElement('div');
                  reconDiv.className = 'message system new recon-suggestion';
                  const textSpan = document.createElement('span');
                  textSpan.className = 'recon-suggestion-text';
                  textSpan.textContent = 'This site does not have a map yet. Reconnaissance can help FSB learn the site structure for better performance.';
                  reconDiv.appendChild(textSpan);

                  const reconBtn = document.createElement('button');
                  reconBtn.className = 'recon-btn';
                  reconBtn.id = 'reconFromSidepanel';
                  reconBtn.textContent = 'Run Reconnaissance';
                  reconBtn.addEventListener('click', () => {
                    startReconFromSidepanel(currentUrl, request.task || completionMessage);
                  });
                  reconDiv.appendChild(reconBtn);

                  chatMessages.appendChild(reconDiv);
                  scrollToBottom();
                }
              }
            } catch (e) {
              console.warn('Recon suggestion check failed:', e.message);
            }
          })();
        }
      }
      break;

    case 'statusUpdate':
      if (request.sessionId === currentSessionId) {
        // Auto-switch to chat view if user is on history while automation runs
        if (isHistoryViewActive) {
          showChatView();
        }
        // Snapshot previous status as completed action message
        const prevText = currentStatusMessage?.querySelector('.status-text')?.textContent;
        const skipTexts = ['Starting automation...', 'Connecting to page...', 'Connected. Analyzing page...', 'Analyzing page...'];
        if (prevText && !skipTexts.includes(prevText)) {
          addActionMessage(prevText);
        }
        updateStatusMessage(request.message, {
          iteration: request.iteration,
          maxIterations: request.maxIterations,
          progressPercent: request.progressPercent
        });
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
          addMessage('Try being more specific about what you want to achieve', 'system');
          addMessage('Check if the page requires manual steps like CAPTCHA solving', 'system');
          addMessage('Ensure the page has fully loaded before starting', 'system');
        }

        // Add retry button if task is available
        if (request.task) {
          const retryDiv = document.createElement('div');
          retryDiv.className = 'message system new';
          retryDiv.textContent = 'Would you like to try again? ';
          const retryBtn = document.createElement('button');
          retryBtn.className = 'retry-btn';
          retryBtn.textContent = 'Retry';
          retryBtn.addEventListener('click', () => {
            retryDiv.remove();
            chatInput.textContent = request.task;
            handleSendMessage();
          });
          retryDiv.appendChild(retryBtn);
          chatMessages.appendChild(retryDiv);
          scrollToBottom();
        } else {
          addMessage('No worries! The side panel is still here. Try again or ask for help with something else.', 'system');
        }

        // Recon suggestion for stuck errors is handled in automationComplete (partial: true)
        // since stuck sessions send automationComplete with partial flag, not automationError.
      }
      break;

    case 'loginDetected':
      if (request.sessionId === currentSessionId) {
        // Pause the status loader
        if (currentStatusMessage) {
          updateStatusMessage('Login required...');
        }
        showLoginPrompt(request.domain, request.fields, request.authPrompt || null);
        sendResponse({ received: true });
      }
      return;

    case 'sessionStateEvent':
      if (request.sessionId !== currentSessionId) break;
      switch (request.eventType) {
        case 'iteration_complete':
          if (currentStatusMessage && isRunning) {
            updateStatusMessage('Step ' + request.iteration + ' complete', {
              iteration: request.iteration,
              maxIterations: 20,
              progressPercent: Math.min(100, Math.round((request.iteration / 20) * 100))
            });
          }
          break;
        case 'session_ended':
          if (!isRunning) break;
          setIdleState();
          if (isHistoryViewActive) {
            loadHistoryList();
          }
          break;
        case 'tool_executed':
          if (showSidepanelProgressEnabled && isRunning) {
            addActionMessage(request.toolName + (request.success ? '' : ' [failed]'));
          }
          break;
        case 'error_occurred':
          console.warn('[FSB] emitter error:', request.error);
          break;
      }
      break;
  }
});

// Show inline login prompt in the chat
function showLoginPrompt(domain, fields, authPrompt) {
  // Prevent duplicate prompts if rapid loginDetected messages arrive
  removeLoginPrompt();

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
  const promptDetail = (authPrompt && authPrompt.detail) || 'Submit credentials once to let FSB sign in and resume this same session.';
  const handoffDetail = (authPrompt && authPrompt.handoff) || 'If you skip or the site still needs manual approval, FSB will preserve the completed work and finish with a manual handoff.';
  const safeSubtext = `${promptDetail} ${handoffDetail}`.trim().replace(/[<>&"']/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'}[c]));

  container.innerHTML = `
    <div class="login-prompt-header">
      <i class="fas fa-lock"></i>
      <span>Login Required</span>
    </div>
    <div class="login-prompt-domain">${safeDomain}</div>
    <div class="login-prompt-subtext">${safeSubtext}</div>
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
      addMessage('Trying sign-in in this same session. If it succeeds, automation will resume automatically.', 'system');
      addStatusMessage('Trying sign-in...');
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
      addMessage('Login skipped. FSB will preserve the completed work so far and finish with a manual handoff.', 'system');
      addStatusMessage('Finishing with manual handoff...');
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
  clearTimeout(resetInputAnimationTimer);
  chatInput.classList.remove('height-animating');
  chatInput.style.height = 'auto';
  chatInput.style.height = Math.max(DEFAULT_CHAT_INPUT_HEIGHT, Math.min(chatInput.scrollHeight, MAX_CHAT_INPUT_HEIGHT)) + 'px';
  chatInput.style.overflowY = chatInput.scrollHeight > MAX_CHAT_INPUT_HEIGHT ? 'auto' : 'hidden';
}

function resetInputHeight(animated = false) {
  clearTimeout(resetInputAnimationTimer);
  const currentHeight = Math.max(chatInput.offsetHeight || DEFAULT_CHAT_INPUT_HEIGHT, DEFAULT_CHAT_INPUT_HEIGHT);

  if (!animated) {
    chatInput.classList.remove('height-animating');
    chatInput.style.height = DEFAULT_CHAT_INPUT_HEIGHT + 'px';
    chatInput.style.overflowY = 'hidden';
    return;
  }

  chatInput.classList.add('height-animating');
  chatInput.style.height = currentHeight + 'px';

  requestAnimationFrame(() => {
    chatInput.style.height = DEFAULT_CHAT_INPUT_HEIGHT + 'px';
  });

  resetInputAnimationTimer = setTimeout(() => {
    chatInput.classList.remove('height-animating');
    chatInput.style.height = DEFAULT_CHAT_INPUT_HEIGHT + 'px';
    chatInput.style.overflowY = 'hidden';
  }, 150);
}

// Initialize input height adjustment
chatInput.addEventListener('input', adjustInputHeight);
resetInputHeight();

// Prevent default drag and drop behavior
document.addEventListener('dragover', (e) => e.preventDefault());
document.addEventListener('drop', (e) => e.preventDefault());

// Handle side panel specific events
document.addEventListener('visibilitychange', () => {
  // Side panel became visible - refresh status if needed
  if (!document.hidden) {
    console.log('Side panel became visible');
  }
  syncPlaceholder();
});


// ==========================================
// Session History Functions
// ==========================================

function toggleHistoryView() {
  if (isHistoryViewActive) {
    showChatView();
  } else {
    showHistoryView();
  }
}

function showHistoryView() {
  document.querySelector('.chat-messages-area').classList.add('hidden');
  document.querySelector('.chat-input-area').classList.add('hidden');
  document.getElementById('historyView').classList.remove('hidden');
  historyBtn.classList.add('active');
  setSidepanelView('history');
  isHistoryViewActive = true;
  syncPlaceholder();
  loadHistoryList();
}

function showChatView() {
  document.querySelector('.chat-messages-area').classList.remove('hidden');
  document.querySelector('.chat-input-area').classList.remove('hidden');
  document.getElementById('historyView').classList.add('hidden');
  historyBtn.classList.remove('active');
  setSidepanelView('chat');
  isHistoryViewActive = false;
  syncPlaceholder();
}

async function loadHistoryList() {
  const historyList = document.getElementById('historyList');
  if (!historyList) return;

  try {
    const stored = await chrome.storage.local.get(['fsbSessionIndex']);
    const sessions = stored.fsbSessionIndex || [];

    if (sessions.length === 0) {
      historyList.innerHTML = '<div class="history-empty-state">' +
        '<i class="fa fa-inbox"></i>' +
        '<p>No sessions yet. Run an automation to see your history here.</p>' +
        '</div>';
      return;
    }

    historyList.innerHTML = sessions.map(function(session) {
      var outcomeInfo = getSessionOutcomeDisplay(session);
      var costDisplay = session.totalCost > 0
        ? '<span class="history-cost">$' + session.totalCost.toFixed(4) + '</span>'
        : '';
      return '<div class="history-item" data-session-id="' + escapeHtml(session.id) + '">' +
        '<div class="history-item-info">' +
          '<div class="history-item-task">' + escapeHtml(session.task || 'Unknown task') + '</div>' +
          '<div class="history-item-meta">' +
            '<span>' + formatSessionDate(session.startTime) + '</span>' +
            '<span>' + (session.actionCount || 0) + ' actions</span>' +
            costDisplay +
            '<span class="history-status ' + outcomeInfo.statusClass + '">' + escapeHtml(outcomeInfo.statusLabel) + '</span>' +
          '</div>' +
        '</div>' +
        (session.actionCount > 0 ?
          '<button class="history-replay-btn" data-session-id="' + escapeHtml(session.id) + '" title="Replay session">' +
            '<i class="fa fa-play"></i>' +
          '</button>' : '') +
        '<button class="history-delete-btn" data-session-id="' + escapeHtml(session.id) + '" title="Delete session">' +
          '<i class="fa fa-trash"></i>' +
        '</button>' +
      '</div>';
    }).join('');
  } catch (error) {
    console.error('Failed to load history list:', error);
    historyList.innerHTML = '<div class="history-empty-state">' +
      '<i class="fa fa-exclamation-triangle"></i>' +
      '<p>Failed to load sessions.</p>' +
      '</div>';
  }
}

async function startReplay(sessionId) {
  if (isRunning) {
    addMessage('Cannot replay while another automation is running. Stop the current task first.', 'system');
    return;
  }

  // Switch to chat view to show replay progress
  if (isHistoryViewActive) {
    showChatView();
  }

  addMessage('Starting replay...', 'system');
  addStatusMessage('Preparing replay...');

  try {
    const response = await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({
        action: 'replaySession',
        sessionId: sessionId
      }, (resp) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(resp);
        }
      });
    });

    if (response && response.success) {
      currentSessionId = response.sessionId;
      setRunningState();
      updateStatusMessage('Replaying...');
    } else {
      completeStatusMessage(response?.error || 'Failed to start replay', 'error');
      addMessage(response?.error || 'Failed to start replay.', 'error');
    }
  } catch (error) {
    completeStatusMessage('Replay error', 'error');
    addMessage('Failed to start replay: ' + error.message, 'error');
  }
}

async function deleteHistorySession(sessionId) {
  try {
    const stored = await chrome.storage.local.get(['fsbSessionLogs', 'fsbSessionIndex']);
    const sessionStorage = stored.fsbSessionLogs || {};
    const sessionIndex = stored.fsbSessionIndex || [];
    delete sessionStorage[sessionId];
    const updatedIndex = sessionIndex.filter(function(s) { return s.id !== sessionId; });
    await chrome.storage.local.set({
      fsbSessionLogs: sessionStorage,
      fsbSessionIndex: updatedIndex
    });
    loadHistoryList();
  } catch (error) {
    console.error('Failed to delete session:', error);
  }
}

async function loadSessionView(sessionId) {
  try {
    const stored = await chrome.storage.local.get(['fsbSessionLogs', 'fsbSessionIndex']);
    const sessionStorage = stored.fsbSessionLogs || {};
    const sessionIndex = stored.fsbSessionIndex || [];
    const session = sessionStorage[sessionId];
    const sessionMeta = sessionIndex.find(function(entry) { return entry.id === sessionId; }) || null;

    if (!session) {
      addMessage('Session data not found.', 'error');
      return;
    }

    activeConversationId = session.conversationId || sessionMeta?.conversationId || null;
    historySessionId = session.historySessionId || sessionMeta?.historySessionId || sessionId;
    persistSidepanelThreadState();

    // Switch to chat view and clear existing messages
    showChatView();
    chatMessages.innerHTML = '';

    // Show the original task as a user message
    addMessage(session.task || 'Unknown task', 'user');

    // Show action history entries
    var actions = session.actionHistory || [];
    if (actions.length > 0) {
      addMessage('Session had ' + actions.length + ' action(s):', 'system');
      for (var i = 0; i < actions.length; i++) {
        var action = actions[i];
        var tool = action.tool || 'unknown';
        var success = action.result?.success !== false;
        var params = '';
        if (action.params) {
          try {
            params = '(' + Object.entries(action.params)
              .map(function(entry) { return entry[0] + ': "' + String(entry[1]).substring(0, 60) + '"'; })
              .join(', ') + ')';
          } catch (e) {
            params = '';
          }
        }
        var label = (success ? '[OK] ' : '[FAIL] ') + tool + params;
        addMessage(label, 'action');
      }
    } else {
      addMessage('No actions were recorded in this session.', 'system');
    }

    var outcomeInfo = getSessionOutcomeDisplay(session);
    if (outcomeInfo.outcome === 'failure') {
      addMessage(outcomeInfo.error || outcomeInfo.resultText || 'Automation failed.', 'error');
    } else if (outcomeInfo.summary || outcomeInfo.resultText) {
      addCompletionMessage(outcomeInfo.summary || outcomeInfo.resultText, 'ai', outcomeInfo.outcome === 'partial');
      if (outcomeInfo.blocker) {
        addMessage('Blocker: ' + outcomeInfo.blocker, 'system');
      }
      if (outcomeInfo.nextStep) {
        addMessage('Next step: ' + outcomeInfo.nextStep, 'system');
      }
    }

    // Show session status footer
    var status = outcomeInfo.statusLabel || session.status || 'unknown';
    var endTime = session.endTime ? new Date(session.endTime).toLocaleString() : 'N/A';
    addMessage('Session ' + status + ' at ' + endTime, 'system');

  } catch (error) {
    console.error('Failed to load session view:', error);
    addMessage('Failed to load session: ' + error.message, 'error');
  }
}

async function clearAllHistorySessions() {
  if (!confirm('Delete all session history? This cannot be undone.')) return;
  try {
    await chrome.storage.local.remove(['fsbSessionLogs', 'fsbSessionIndex']);
    loadHistoryList();
  } catch (error) {
    console.error('Failed to clear all sessions:', error);
  }
}

function formatSessionDate(timestamp) {
  if (!timestamp) return 'Unknown';
  var date = new Date(timestamp);
  var now = new Date();
  var diffMs = now - date;
  var diffHours = diffMs / (1000 * 60 * 60);
  if (diffHours < 1) {
    var mins = Math.floor(diffMs / (1000 * 60));
    return mins + 'm ago';
  } else if (diffHours < 24) {
    return Math.floor(diffHours) + 'h ago';
  } else if (diffHours < 48) {
    return 'Yesterday';
  }
  return date.toLocaleDateString();
}

function escapeHtml(str) {
  if (!str) return '';
  var div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}


console.log('FSB v0.9.20 side panel script loaded');

// ==========================================
// /agent Slash Command Handler
// ==========================================

function handleAgentCommand(message) {
  const parts = message.split(/\s+/);
  const subCommand = parts[1] || '';

  if (subCommand === 'list') {
    showAgentList();
  } else if (subCommand === 'stop') {
    const agentName = parts.slice(2).join(' ');
    stopAgentByName(agentName);
  } else {
    startAgentWizard();
  }
}

async function showAgentList() {
  try {
    const response = await new Promise(resolve => {
      chrome.runtime.sendMessage({ action: 'listAgents' }, resolve);
    });

    const agents = response?.agents || [];
    if (agents.length === 0) {
      addMessage('No agents configured. Use /agent to create one.', 'system');
      return;
    }

    let listText = 'Agents:\n';
    for (const agent of agents) {
      const status = agent.enabled ? '[ON]' : '[OFF]';
      const lastRun = agent.lastRunAt ? new Date(agent.lastRunAt).toLocaleString() : 'Never';
      listText += `\n${status} ${agent.name} - ${formatScheduleShort(agent.schedule)} - Last: ${lastRun}`;
    }
    addMessage(listText, 'system');
  } catch (error) {
    addMessage('Failed to load agents: ' + error.message, 'error');
  }
}

async function stopAgentByName(name) {
  if (!name) {
    addMessage('Usage: /agent stop <agent name>', 'system');
    return;
  }

  try {
    const response = await new Promise(resolve => {
      chrome.runtime.sendMessage({ action: 'listAgents' }, resolve);
    });

    const agents = response?.agents || [];
    const agent = agents.find(a => a.name.toLowerCase().includes(name.toLowerCase()));

    if (!agent) {
      addMessage('Agent not found: "' + name + '"', 'error');
      return;
    }

    if (!agent.enabled) {
      addMessage('Agent "' + agent.name + '" is already disabled.', 'system');
      return;
    }

    const toggleResp = await new Promise(resolve => {
      chrome.runtime.sendMessage({ action: 'toggleAgent', agentId: agent.agentId }, resolve);
    });

    if (toggleResp.success) {
      addMessage('Agent "' + agent.name + '" has been disabled.', 'system');
    } else {
      addMessage('Failed to stop agent: ' + (toggleResp.error || 'Unknown error'), 'error');
    }
  } catch (error) {
    addMessage('Error: ' + error.message, 'error');
  }
}

function startAgentWizard() {
  chrome.runtime.openOptionsPage();
  setTimeout(() => {
    chrome.runtime.sendMessage({ action: 'openAgentForm' });
  }, 500);
  addMessage('Opening agent settings... Use the form in the options page to create your agent.', 'system');
}

function formatScheduleShort(schedule) {
  if (!schedule) return 'Not set';
  switch (schedule.type) {
    case 'interval':
      return 'Every ' + (schedule.intervalMinutes || 1) + ' min';
    case 'daily':
      return 'Daily at ' + (schedule.dailyTime || '09:00');
    case 'once':
      return 'Run once';
    default:
      return schedule.type;
  }
}
