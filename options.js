// FSB v0.1 - Modern Dashboard Control Panel Script

// Default settings
const defaultSettings = {
  modelProvider: 'xai',
  modelName: 'grok-3-mini',
  apiKey: '',
  geminiApiKey: '',
  openaiApiKey: '',
  anthropicApiKey: '',
  customApiKey: '',
  customEndpoint: '',
  reasoningEffort: 'low', // xAI reasoning effort setting
  speedMode: 'normal', // Legacy support
  captchaSolver: 'none',
  captchaApiKey: '',
  actionDelay: 1000,
  maxIterations: 20,
  confirmSensitive: true,
  debugMode: false
};

// Available models configuration
const availableModels = {
  xai: [
    { id: 'grok-3-mini', name: 'Grok 3 Mini', description: 'Fast and efficient' },
    { id: 'grok-3-mini-fast', name: 'Grok 3 Mini Fast', description: 'Optimized for speed' }
  ],
  gemini: [
    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', description: 'Latest Gemini model' },
    { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', description: 'Stable and reliable' }
  ],
  openai: [
    { id: 'gpt-4o', name: 'GPT-4o', description: 'Most capable model' },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: 'Affordable and fast' },
    { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', description: 'Fast and cost-effective' }
  ],
  anthropic: [
    { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', description: 'Latest and most capable' },
    { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', description: 'Fast and efficient' },
    { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', description: 'Previous flagship model' }
  ],
  custom: [
    { id: 'custom-model', name: 'Custom Model', description: 'Enter your model name below' }
  ]
};

// Dashboard state
const dashboardState = {
  currentSection: 'dashboard',
  hasUnsavedChanges: false,
  isApiTesting: false,
  connectionStatus: 'checking'
};

// Initialize analytics
let analytics = null;

// Statistics data
const statsData = {
  tasksToday: 0,
  successRate: 0,
  avgDuration: 0,
  logs: []
};

// DOM elements
const elements = {};

// Initialize dashboard
document.addEventListener('DOMContentLoaded', initializeDashboard);

function initializeDashboard() {
  console.log('FSB Control Panel initializing...');
  
  // Cache DOM elements
  cacheElements();
  
  // Initialize analytics
  analytics = new FSBAnalytics();
  window.analytics = analytics; // Make globally available
  
  console.log('Options page: Analytics created, waiting for initialization...');
  
  // Setup event listeners
  setupEventListeners();
  
  // Load saved settings
  loadSettings();
  
  // Initialize sections
  initializeSections();
  
  // Check API connection
  checkApiConnection();
  
  // Setup theme
  setupTheme();
  
  // Initialize logs
  initializeLogs();
  
  // Initialize analytics chart after initialization completes
  if (analytics) {
    analytics.initPromise.then(() => {
      console.log('Options page: Analytics initialized, setting up dashboard...');
      analytics.initializeChart();
      analytics.updateDashboard();
      
      // Set up periodic refresh every 30 seconds
      setInterval(() => {
        if (analytics && analytics.initialized) {
          console.log('Options: Periodic analytics refresh');
          analytics.loadStoredData().then(() => {
            const timeRange = document.getElementById('chartTimeRange')?.value || '24h';
            analytics.updateDashboardWithTimeRange(timeRange);
            if (analytics.chart) {
              analytics.updateChart(timeRange);
            }
          });
        }
      }, 30000);
    }).catch(error => {
      console.error('Options page: Analytics initialization failed:', error);
    });
  }
  
  console.log('FSB Control Panel initialized successfully');
}

function cacheElements() {
  // Header elements
  elements.connectionStatus = document.getElementById('connectionStatus');
  elements.testApiBtn = document.getElementById('testApiBtn');
  elements.exportBtn = document.getElementById('exportBtn');
  elements.themeToggle = document.getElementById('themeToggle');
  
  // Navigation
  elements.navItems = document.querySelectorAll('.nav-item');
  elements.contentSections = document.querySelectorAll('.content-section');
  
  // Form elements
  elements.modelProvider = document.getElementById('modelProvider');
  elements.modelName = document.getElementById('modelName');
  elements.reasoningEffort = document.getElementById('reasoningEffort');
  elements.apiKey = document.getElementById('apiKey');
  elements.geminiApiKey = document.getElementById('geminiApiKey');
  elements.xaiApiKeyGroup = document.getElementById('xaiApiKeyGroup');
  elements.geminiApiKeyGroup = document.getElementById('geminiApiKeyGroup');
  elements.speedModeNormal = document.getElementById('speedModeNormal'); // Legacy
  elements.speedModeFast = document.getElementById('speedModeFast'); // Legacy
  elements.captchaSolver = document.getElementById('captchaSolver');
  elements.captchaApiKey = document.getElementById('captchaApiKey');
  elements.captchaApiKeyGroup = document.getElementById('captchaApiKeyGroup');
  elements.actionDelay = document.getElementById('actionDelay');
  elements.actionDelaySlider = document.getElementById('actionDelaySlider');
  elements.maxIterations = document.getElementById('maxIterations');
  elements.maxIterationsSlider = document.getElementById('maxIterationsSlider');
  elements.confirmSensitive = document.getElementById('confirmSensitive');
  elements.debugMode = document.getElementById('debugMode');
  
  // Quick toggles
  elements.quickDebugMode = document.getElementById('quickDebugMode');
  elements.quickConfirmSensitive = document.getElementById('quickConfirmSensitive');
  
  // Button elements
  elements.toggleApiKey = document.getElementById('toggleApiKey');
  elements.toggleCaptchaKey = document.getElementById('toggleCaptchaKey');
  elements.fullApiTest = document.getElementById('fullApiTest');
  elements.testResults = document.getElementById('testResults');
  
  // Dashboard cards
  elements.apiStatusCard = document.getElementById('apiStatusCard');
  elements.tasksToday = document.getElementById('tasksToday');
  elements.successRate = document.getElementById('successRate');
  elements.avgDuration = document.getElementById('avgDuration');
  
  // Logs
  elements.logsDisplay = document.getElementById('logsDisplay');
  elements.clearLogs = document.getElementById('clearLogs');
  elements.exportLogs = document.getElementById('exportLogs');
  elements.logLevel = document.getElementById('logLevel');
  
  // Save bar
  elements.saveBar = document.getElementById('saveBar');
  elements.saveBtn = document.getElementById('saveBtn');
  elements.discardBtn = document.getElementById('discardBtn');
  
  // Status toast
  elements.statusToast = document.getElementById('statusToast');
}

function setupEventListeners() {
  // Navigation
  elements.navItems.forEach(item => {
    item.addEventListener('click', () => switchSection(item.dataset.section));
  });
  
  // Header buttons
  elements.testApiBtn.addEventListener('click', testApiConnection);
  elements.exportBtn.addEventListener('click', exportSettings);
  elements.themeToggle.addEventListener('click', toggleTheme);
  
  // Form inputs change detection
  const formInputs = [
    elements.apiKey,
    elements.speedModeNormal,
    elements.speedModeFast,
    elements.captchaSolver,
    elements.captchaApiKey,
    elements.actionDelay,
    elements.maxIterations,
    elements.confirmSensitive,
    elements.debugMode
  ];
  
  formInputs.forEach(input => {
    if (input) {
      const eventType = input.type === 'checkbox' || input.type === 'radio' ? 'change' : 'input';
      input.addEventListener(eventType, () => markUnsavedChanges());
    }
  });
  
  // Slider synchronization
  if (elements.actionDelaySlider && elements.actionDelay) {
    elements.actionDelaySlider.addEventListener('input', (e) => {
      elements.actionDelay.value = e.target.value;
      markUnsavedChanges();
    });
    
    elements.actionDelay.addEventListener('input', (e) => {
      elements.actionDelaySlider.value = e.target.value;
      markUnsavedChanges();
    });
  }
  
  if (elements.maxIterationsSlider && elements.maxIterations) {
    elements.maxIterationsSlider.addEventListener('input', (e) => {
      elements.maxIterations.value = e.target.value;
      markUnsavedChanges();
    });
    
    elements.maxIterations.addEventListener('input', (e) => {
      elements.maxIterationsSlider.value = e.target.value;
      markUnsavedChanges();
    });
  }
  
  // Quick toggles sync
  if (elements.quickDebugMode && elements.debugMode) {
    elements.quickDebugMode.addEventListener('change', (e) => {
      elements.debugMode.checked = e.target.checked;
      markUnsavedChanges();
    });
    
    elements.debugMode.addEventListener('change', (e) => {
      elements.quickDebugMode.checked = e.target.checked;
    });
  }
  
  if (elements.quickConfirmSensitive && elements.confirmSensitive) {
    elements.quickConfirmSensitive.addEventListener('change', (e) => {
      elements.confirmSensitive.checked = e.target.checked;
      markUnsavedChanges();
    });
    
    elements.confirmSensitive.addEventListener('change', (e) => {
      elements.quickConfirmSensitive.checked = e.target.checked;
    });
  }
  
  // Model provider change
  if (elements.modelProvider) {
    elements.modelProvider.addEventListener('change', (e) => {
      updateModelOptions(e.target.value);
      updateApiKeyVisibility(e.target.value);
      markUnsavedChanges();
    });
  }
  
  // Model name change
  if (elements.modelName) {
    elements.modelName.addEventListener('change', () => {
      markUnsavedChanges();
    });
  }
  
  // Reasoning effort change
  if (elements.reasoningEffort) {
    elements.reasoningEffort.addEventListener('change', () => {
      markUnsavedChanges();
    });
  }
  
  // Password visibility toggles
  if (elements.toggleApiKey) {
    elements.toggleApiKey.addEventListener('click', () => togglePasswordVisibility('apiKey'));
  }
  
  const toggleGeminiApiKey = document.getElementById('toggleGeminiApiKey');
  if (toggleGeminiApiKey) {
    toggleGeminiApiKey.addEventListener('click', () => togglePasswordVisibility('geminiApiKey'));
  }
  
  const toggleOpenaiApiKey = document.getElementById('toggleOpenaiApiKey');
  if (toggleOpenaiApiKey) {
    toggleOpenaiApiKey.addEventListener('click', () => togglePasswordVisibility('openaiApiKey'));
  }
  
  const toggleAnthropicApiKey = document.getElementById('toggleAnthropicApiKey');
  if (toggleAnthropicApiKey) {
    toggleAnthropicApiKey.addEventListener('click', () => togglePasswordVisibility('anthropicApiKey'));
  }
  
  const toggleCustomApiKey = document.getElementById('toggleCustomApiKey');
  if (toggleCustomApiKey) {
    toggleCustomApiKey.addEventListener('click', () => togglePasswordVisibility('customApiKey'));
  }
  
  if (elements.toggleCaptchaKey) {
    elements.toggleCaptchaKey.addEventListener('click', () => togglePasswordVisibility('captchaApiKey'));
  }
  
  // CAPTCHA solver change
  if (elements.captchaSolver) {
    elements.captchaSolver.addEventListener('change', updateCaptchaApiKeyVisibility);
  }
  
  // API test
  if (elements.fullApiTest) {
    elements.fullApiTest.addEventListener('click', runFullApiTest);
  }
  
  // Save bar
  if (elements.saveBtn) {
    elements.saveBtn.addEventListener('click', saveSettings);
  }
  
  if (elements.discardBtn) {
    elements.discardBtn.addEventListener('click', discardChanges);
  }
  
  // Logs controls
  if (elements.clearLogs) {
    elements.clearLogs.addEventListener('click', clearLogs);
  }
  
  if (elements.exportLogs) {
    elements.exportLogs.addEventListener('click', exportLogs);
  }
  
  if (elements.logLevel) {
    elements.logLevel.addEventListener('change', filterLogs);
  }
  
  // Chart time range selector
  const chartTimeRange = document.getElementById('chartTimeRange');
  if (chartTimeRange) {
    chartTimeRange.addEventListener('change', (e) => {
      if (analytics) {
        const timeRange = e.target.value;
        analytics.updateChart(timeRange);
        analytics.updateDashboardWithTimeRange(timeRange);
      }
    });
  }
  
  // Debug controls
  const testTrackingBtn = document.getElementById('testTrackingBtn');
  const viewStorageBtn = document.getElementById('viewStorageBtn');
  const clearDataBtn = document.getElementById('clearDataBtn');
  const exportDataBtn = document.getElementById('exportDataBtn');
  
  if (testTrackingBtn) {
    testTrackingBtn.addEventListener('click', testTokenTracking);
  }
  
  if (viewStorageBtn) {
    viewStorageBtn.addEventListener('click', viewStorageData);
  }
  
  if (clearDataBtn) {
    clearDataBtn.addEventListener('click', clearAnalyticsData);
  }
  
  if (exportDataBtn) {
    exportDataBtn.addEventListener('click', exportAnalyticsData);
  }
  
  // Keyboard shortcuts
  document.addEventListener('keydown', handleKeyboardShortcuts);
  
  // Window beforeunload
  window.addEventListener('beforeunload', (e) => {
    if (dashboardState.hasUnsavedChanges) {
      e.preventDefault();
      e.returnValue = '';
    }
  });
  
  // Listen for storage changes to update analytics
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local') {
      if (changes.fsbUsageData || changes.fsbCurrentModel) {
        console.log('Options: Storage changed, updating analytics dashboard');
        if (analytics && analytics.initialized) {
          analytics.loadStoredData().then(() => {
            analytics.updateDashboard();
            if (analytics.chart) {
              const timeRange = document.getElementById('chartTimeRange')?.value || '24h';
              analytics.updateChart(timeRange);
            }
          });
        }
      }
    }
  });
}

function switchSection(sectionId) {
  // Update navigation
  elements.navItems.forEach(item => {
    item.classList.toggle('active', item.dataset.section === sectionId);
  });
  
  // Update content sections
  elements.contentSections.forEach(section => {
    section.classList.toggle('active', section.id === sectionId);
  });
  
  dashboardState.currentSection = sectionId;
  
  // Update URL hash without scrolling
  history.replaceState(null, null, `#${sectionId}`);
}

function initializeSections() {
  // Check URL hash for initial section
  const hash = window.location.hash.slice(1);
  if (hash && document.getElementById(hash)) {
    switchSection(hash);
  }
}

// Update model options based on provider
function updateModelOptions(provider) {
  const modelSelect = elements.modelName;
  if (!modelSelect) return;
  
  // Clear existing options
  modelSelect.innerHTML = '';
  
  // Add options for selected provider
  const models = availableModels[provider] || [];
  models.forEach(model => {
    const option = document.createElement('option');
    option.value = model.id;
    option.textContent = model.name;
    modelSelect.appendChild(option);
  });
  
  // Update description when model changes
  modelSelect.addEventListener('change', (e) => {
    const selectedModel = models.find(m => m.id === e.target.value);
    if (selectedModel) {
      updateModelDescription(selectedModel.description);
    }
  });
  
  // Update initial description
  if (models.length > 0) {
    updateModelDescription(models[0].description);
  }
}

// Update model description
function updateModelDescription(description) {
  const descElement = document.getElementById('modelDescription');
  if (descElement) {
    descElement.textContent = description || 'Select the AI model to use';
  }
}

// Update API key visibility based on provider
function updateApiKeyVisibility(provider) {
  // Get all API key groups
  const apiKeyGroups = {
    xai: document.getElementById('xaiApiKeyGroup'),
    gemini: document.getElementById('geminiApiKeyGroup'),
    openai: document.getElementById('openaiApiKeyGroup'),
    anthropic: document.getElementById('anthropicApiKeyGroup'),
    custom: document.getElementById('customApiGroup')
  };
  
  // Hide all groups first
  Object.values(apiKeyGroups).forEach(group => {
    if (group) group.style.display = 'none';
  });
  
  // Show the selected provider's group
  if (apiKeyGroups[provider]) {
    apiKeyGroups[provider].style.display = 'block';
  }
  
  // Show/hide reasoning effort for xAI provider
  const reasoningEffortGroup = document.getElementById('reasoningEffortGroup');
  if (reasoningEffortGroup) {
    reasoningEffortGroup.style.display = provider === 'xai' ? 'block' : 'none';
  }
}

function loadSettings() {
  chrome.storage.local.get(Object.keys(defaultSettings), (data) => {
    const settings = { ...defaultSettings, ...data };
    
    // Handle legacy speedMode to new model format
    if (!settings.modelProvider && settings.speedMode) {
      settings.modelProvider = 'xai';
      settings.modelName = settings.speedMode === 'fast' ? 'grok-3-mini-fast' : 'grok-3-mini';
    }
    
    // Update model provider and options
    if (elements.modelProvider) {
      elements.modelProvider.value = settings.modelProvider || 'xai';
      updateModelOptions(settings.modelProvider || 'xai');
      updateApiKeyVisibility(settings.modelProvider || 'xai');
    }
    
    // Update model name
    if (elements.modelName && settings.modelName) {
      // Wait for options to be populated
      setTimeout(() => {
        elements.modelName.value = settings.modelName;
        const models = availableModels[settings.modelProvider || 'xai'];
        const selectedModel = models.find(m => m.id === settings.modelName);
        if (selectedModel) {
          updateModelDescription(selectedModel.description);
        }
      }, 100);
    }
    
    // Update form elements
    if (elements.apiKey) elements.apiKey.value = settings.apiKey || '';
    if (elements.geminiApiKey) elements.geminiApiKey.value = settings.geminiApiKey || '';
    if (elements.reasoningEffort) elements.reasoningEffort.value = settings.reasoningEffort || 'low';
    
    // Update new provider API keys
    const openaiApiKey = document.getElementById('openaiApiKey');
    if (openaiApiKey) openaiApiKey.value = settings.openaiApiKey || '';
    
    const anthropicApiKey = document.getElementById('anthropicApiKey');
    if (anthropicApiKey) anthropicApiKey.value = settings.anthropicApiKey || '';
    
    const customApiKey = document.getElementById('customApiKey');
    if (customApiKey) customApiKey.value = settings.customApiKey || '';
    
    const customEndpoint = document.getElementById('customEndpoint');
    if (customEndpoint) customEndpoint.value = settings.customEndpoint || '';
    
    if (settings.speedMode === 'fast') {
      if (elements.speedModeFast) elements.speedModeFast.checked = true;
    } else {
      if (elements.speedModeNormal) elements.speedModeNormal.checked = true;
    }
    
    if (elements.captchaSolver) elements.captchaSolver.value = settings.captchaSolver;
    if (elements.captchaApiKey) elements.captchaApiKey.value = settings.captchaApiKey || '';
    if (elements.actionDelay) elements.actionDelay.value = settings.actionDelay;
    if (elements.actionDelaySlider) elements.actionDelaySlider.value = settings.actionDelay;
    if (elements.maxIterations) elements.maxIterations.value = settings.maxIterations;
    if (elements.maxIterationsSlider) elements.maxIterationsSlider.value = settings.maxIterations;
    if (elements.confirmSensitive) elements.confirmSensitive.checked = settings.confirmSensitive;
    if (elements.debugMode) elements.debugMode.checked = settings.debugMode;
    
    // Update quick toggles
    if (elements.quickDebugMode) elements.quickDebugMode.checked = settings.debugMode;
    if (elements.quickConfirmSensitive) elements.quickConfirmSensitive.checked = settings.confirmSensitive;
    
    // Update CAPTCHA API key visibility
    updateCaptchaApiKeyVisibility();
    
    addLog('info', 'Settings loaded successfully');
  });
}

function saveSettings() {
  const settings = {
    modelProvider: elements.modelProvider?.value || 'xai',
    modelName: elements.modelName?.value || 'grok-3-mini',
    reasoningEffort: elements.reasoningEffort?.value || 'low',
    apiKey: elements.apiKey?.value || '',
    geminiApiKey: elements.geminiApiKey?.value || '',
    openaiApiKey: document.getElementById('openaiApiKey')?.value || '',
    anthropicApiKey: document.getElementById('anthropicApiKey')?.value || '',
    customApiKey: document.getElementById('customApiKey')?.value || '',
    customEndpoint: document.getElementById('customEndpoint')?.value || '',
    speedMode: elements.speedModeFast?.checked ? 'fast' : 'normal', // Legacy
    captchaSolver: elements.captchaSolver?.value || 'none',
    captchaApiKey: elements.captchaApiKey?.value || '',
    actionDelay: parseInt(elements.actionDelay?.value) || 1000,
    maxIterations: parseInt(elements.maxIterations?.value) || 20,
    confirmSensitive: elements.confirmSensitive?.checked ?? true,
    debugMode: elements.debugMode?.checked ?? false
  };
  
  chrome.storage.local.set(settings, () => {
    dashboardState.hasUnsavedChanges = false;
    hideSaveBar();
    showToast('Settings saved successfully', 'success');
    addLog('info', 'Settings saved successfully');
    
    // Update connection status if API key changed
    if (settings.apiKey) {
      checkApiConnection();
    }
  });
}

function discardChanges() {
  loadSettings();
  dashboardState.hasUnsavedChanges = false;
  hideSaveBar();
  showToast('Changes discarded', 'warning');
  addLog('info', 'Changes discarded');
}

function markUnsavedChanges() {
  if (!dashboardState.hasUnsavedChanges) {
    dashboardState.hasUnsavedChanges = true;
    showSaveBar();
  }
}

function showSaveBar() {
  if (elements.saveBar) {
    elements.saveBar.style.display = 'block';
    setTimeout(() => elements.saveBar.classList.add('show'), 10);
  }
}

function hideSaveBar() {
  if (elements.saveBar) {
    elements.saveBar.classList.remove('show');
    setTimeout(() => elements.saveBar.style.display = 'none', 200);
  }
}

function updateCaptchaApiKeyVisibility() {
  const needsKey = ['capsolver', '2captcha'].includes(elements.captchaSolver?.value);
  if (elements.captchaApiKeyGroup) {
    elements.captchaApiKeyGroup.style.display = needsKey ? 'block' : 'none';
  }
}

function togglePasswordVisibility(fieldId) {
  const field = document.getElementById(fieldId);
  const button = document.getElementById(`toggle${fieldId.charAt(0).toUpperCase() + fieldId.slice(1)}`);
  
  if (field && button) {
    const isPassword = field.type === 'password';
    field.type = isPassword ? 'text' : 'password';
    
    const icon = button.querySelector('i');
    if (icon) {
      icon.className = isPassword ? 'fas fa-eye-slash' : 'fas fa-eye';
    }
  }
}

async function checkApiConnection() {
  dashboardState.connectionStatus = 'checking';
  updateConnectionStatus('checking', 'Checking connection...');
  
  try {
    const settings = await getStoredSettings();
    
    if (!settings.apiKey) {
      updateConnectionStatus('disconnected', 'No API key configured');
      updateApiStatusCard('disconnected', 'No API Key', 'Configure your xAI API key to get started');
      return;
    }
    
    // Use AI integration to test connection
    const aiIntegration = new AIIntegration(settings);
    
    const result = await aiIntegration.testConnection();
    
    if (result.ok) {
      updateConnectionStatus('connected', 'Connected');
      updateApiStatusCard('connected', 'Connected', `Using model: ${result.model}`);
      addLog('info', `API connection successful with model: ${result.model}`);
    } else {
      updateConnectionStatus('disconnected', 'Connection failed');
      updateApiStatusCard('disconnected', 'Connection Failed', result.error || 'Unknown error');
      addLog('error', `API connection failed: ${result.error}`);
    }
  } catch (error) {
    updateConnectionStatus('disconnected', 'Connection error');
    updateApiStatusCard('disconnected', 'Connection Error', error.message);
    addLog('error', `API connection error: ${error.message}`);
  }
}

function updateConnectionStatus(status, text) {
  dashboardState.connectionStatus = status;
  
  if (elements.connectionStatus) {
    const dot = elements.connectionStatus.querySelector('.status-dot');
    
    if (dot) {
      dot.className = `fas fa-circle status-dot ${status}`;
    }
  }
}

function updateApiStatusCard(status, title, detail) {
  if (elements.apiStatusCard) {
    const icon = elements.apiStatusCard.querySelector('.status-icon i');
    const titleElement = elements.apiStatusCard.querySelector('.status-title');
    const detailElement = elements.apiStatusCard.querySelector('.status-detail');
    
    if (icon) {
      icon.className = status === 'checking' ? 'fas fa-spinner fa-spin' :
                     status === 'connected' ? 'fas fa-check-circle' :
                     'fas fa-exclamation-triangle';
    }
    
    if (titleElement) titleElement.textContent = title;
    if (detailElement) detailElement.textContent = detail;
  }
}

async function testApiConnection() {
  if (dashboardState.isApiTesting) return;
  
  dashboardState.isApiTesting = true;
  elements.testApiBtn.disabled = true;
  elements.testApiBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Testing...';
  
  try {
    await checkApiConnection();
    showToast('API test completed', 'success');
  } catch (error) {
    showToast('API test failed', 'error');
  } finally {
    dashboardState.isApiTesting = false;
    elements.testApiBtn.disabled = false;
    elements.testApiBtn.innerHTML = '<i class="fas fa-plug"></i> Test API';
  }
}

async function runFullApiTest() {
  if (!elements.fullApiTest || !elements.testResults) return;
  
  elements.fullApiTest.disabled = true;
  elements.fullApiTest.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Testing...';
  elements.testResults.classList.remove('show');
  
  try {
    const settings = await getStoredSettings();
    
    // Check appropriate API key based on provider
    const provider = settings.modelProvider || 'xai';
    if (provider === 'gemini' && !settings.geminiApiKey) {
      throw new Error('Gemini API key is required for testing');
    } else if (provider === 'xai' && !settings.apiKey) {
      throw new Error('xAI API key is required for testing');
    }
    
    // Test AI integration
    const aiIntegration = new AIIntegration(settings);
    
    const result = await aiIntegration.testConnection();
    
    // Display results
    elements.testResults.innerHTML = `
      <h4>API Test Results</h4>
      <div class="test-result-item">
        <strong>Status:</strong> ${result.ok ? 'Success' : 'Failed'}
      </div>
      <div class="test-result-item">
        <strong>Model:</strong> ${result.model || 'Unknown'}
      </div>
      <div class="test-result-item">
        <strong>Response Time:</strong> ${result.responseTime || 'N/A'}ms
      </div>
      ${result.error ? `<div class="test-result-item error"><strong>Error:</strong> ${result.error}</div>` : ''}
      ${result.data ? `<div class="test-result-item"><strong>Response:</strong> <pre>${JSON.stringify(result.data, null, 2)}</pre></div>` : ''}
    `;
    
    elements.testResults.classList.add('show');
    addLog(result.ok ? 'info' : 'error', `Full API test ${result.ok ? 'passed' : 'failed'}: ${result.error || 'Success'}`);
    
  } catch (error) {
    elements.testResults.innerHTML = `
      <h4>API Test Results</h4>
      <div class="test-result-item error">
        <strong>Error:</strong> ${error.message}
      </div>
    `;
    elements.testResults.classList.add('show');
    addLog('error', `Full API test error: ${error.message}`);
  } finally {
    elements.fullApiTest.disabled = false;
    elements.fullApiTest.innerHTML = '<i class="fas fa-flask"></i> Run Full API Test';
  }
}

function exportSettings() {
  chrome.storage.local.get(Object.keys(defaultSettings), (data) => {
    const settings = { ...defaultSettings, ...data };
    
    // Remove sensitive data
    const exportData = {
      ...settings,
      apiKey: settings.apiKey ? '[CONFIGURED]' : '',
      captchaApiKey: settings.captchaApiKey ? '[CONFIGURED]' : ''
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `fsb-settings-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showToast('Settings exported successfully', 'success');
    addLog('info', 'Settings exported to file');
  });
}

function setupTheme() {
  const savedTheme = localStorage.getItem('fsb-theme') || 'light';
  applyTheme(savedTheme);
}

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
  const newTheme = currentTheme === 'light' ? 'dark' : 'light';
  applyTheme(newTheme);
  localStorage.setItem('fsb-theme', newTheme);
  showToast(`Switched to ${newTheme} theme`, 'info');
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  
  if (elements.themeToggle) {
    const icon = elements.themeToggle.querySelector('i');
    if (icon) {
      icon.className = theme === 'light' ? 'fas fa-moon' : 'fas fa-sun';
    }
  }
}

function initializeLogs() {
  addLog('info', 'FSB Control Panel loaded successfully');
  updateStatistics();
}

function addLog(level, message) {
  const timestamp = new Date().toLocaleTimeString();
  const logEntry = { timestamp, level, message };
  
  statsData.logs.unshift(logEntry);
  
  // Limit log history
  if (statsData.logs.length > 1000) {
    statsData.logs = statsData.logs.slice(0, 1000);
  }
  
  updateLogsDisplay();
}

function updateLogsDisplay() {
  if (!elements.logsDisplay) return;
  
  const levelFilter = elements.logLevel?.value || 'all';
  const filteredLogs = statsData.logs.filter(log => {
    if (levelFilter === 'all') return true;
    if (levelFilter === 'error') return log.level === 'error';
    if (levelFilter === 'warn') return ['error', 'warn'].includes(log.level);
    if (levelFilter === 'info') return ['error', 'warn', 'info'].includes(log.level);
    return true;
  });
  
  elements.logsDisplay.innerHTML = filteredLogs.slice(0, 100).map(log => `
    <div class="log-entry ${log.level}">
      <span class="log-time">${log.timestamp}</span>
      <span class="log-level">${log.level.toUpperCase()}</span>
      <span class="log-message">${log.message}</span>
    </div>
  `).join('');
}

function clearLogs() {
  statsData.logs = [];
  updateLogsDisplay();
  addLog('info', 'Logs cleared');
  showToast('Logs cleared', 'info');
}

function exportLogs() {
  const logsText = statsData.logs.map(log => 
    `[${log.timestamp}] ${log.level.toUpperCase()}: ${log.message}`
  ).join('\n');
  
  const blob = new Blob([logsText], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `fsb-logs-${new Date().toISOString().split('T')[0]}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  
  showToast('Logs exported successfully', 'success');
  addLog('info', 'Logs exported to file');
}

function filterLogs() {
  updateLogsDisplay();
}

function updateStatistics() {
  // Update dashboard statistics
  if (elements.tasksToday) {
    elements.tasksToday.textContent = statsData.tasksToday;
  }
  
  if (elements.successRate) {
    elements.successRate.textContent = `${statsData.successRate}%`;
  }
  
  if (elements.avgDuration) {
    elements.avgDuration.textContent = `${statsData.avgDuration}s`;
  }
}

function showToast(message, type = 'info') {
  if (!elements.statusToast) return;
  
  elements.statusToast.textContent = message;
  elements.statusToast.className = `status-toast ${type}`;
  elements.statusToast.classList.add('show');
  
  setTimeout(() => {
    elements.statusToast.classList.remove('show');
  }, 3000);
}

function handleKeyboardShortcuts(e) {
  // Ctrl/Cmd + S to save
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault();
    if (dashboardState.hasUnsavedChanges) {
      saveSettings();
    }
  }
  
  // Escape to discard changes
  if (e.key === 'Escape' && dashboardState.hasUnsavedChanges) {
    discardChanges();
  }
  
  // Ctrl/Cmd + T to test API
  if ((e.ctrlKey || e.metaKey) && e.key === 't') {
    e.preventDefault();
    testApiConnection();
  }
}

// Utility functions
function getStoredSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get(Object.keys(defaultSettings), (data) => {
      resolve({ ...defaultSettings, ...data });
    });
  });
}

// Debug Functions
async function testTokenTracking() {
  if (!analytics) {
    showDebugOutput('Analytics not initialized');
    return;
  }
  
  showDebugOutput('Testing token tracking...');
  
  // Test with fake data
  const testData = {
    model: 'grok-3-mini',
    inputTokens: 150,
    outputTokens: 75,
    success: true
  };
  
  try {
    await analytics.trackUsage(testData.model, testData.inputTokens, testData.outputTokens, testData.success);
    
    // Show current stats
    const stats = analytics.getStats('24h');
    showDebugOutput(`Test tracking completed!\n\nCurrent Stats:\n${JSON.stringify(stats, null, 2)}`);
    
    // Force chart and dashboard update
    if (analytics.chart) {
      const timeRange = document.getElementById('chartTimeRange')?.value || '24h';
      analytics.updateChart(timeRange);
      analytics.updateDashboardWithTimeRange(timeRange);
    }
  } catch (error) {
    showDebugOutput(`Error: ${error.message}`);
  }
}

async function viewStorageData() {
  try {
    const result = await chrome.storage.local.get(['fsbUsageData', 'fsbCurrentModel']);
    showDebugOutput(`Storage Data:\n${JSON.stringify(result, null, 2)}`);
  } catch (error) {
    showDebugOutput(`Error: ${error.message}`);
  }
}

async function clearAnalyticsData() {
  if (confirm('Are you sure you want to clear all analytics data? This cannot be undone.')) {
    try {
      await chrome.storage.local.remove(['fsbUsageData', 'fsbCurrentModel']);
      if (analytics) {
        analytics.usageData = [];
        analytics.currentModel = 'grok-3-mini';
        analytics.updateDashboard();
        analytics.updateChart('24h');
      }
      showDebugOutput('Analytics data cleared successfully');
      showToast('Analytics data cleared', 'success');
    } catch (error) {
      showDebugOutput(`Error: ${error.message}`);
    }
  }
}

async function exportAnalyticsData() {
  try {
    const result = await chrome.storage.local.get(['fsbUsageData', 'fsbCurrentModel']);
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `fsb-analytics-data-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showDebugOutput('Analytics data exported successfully');
    showToast('Analytics data exported', 'success');
  } catch (error) {
    showDebugOutput(`Error: ${error.message}`);
  }
}

function showDebugOutput(content) {
  const debugOutput = document.getElementById('debugOutput');
  const debugContent = document.getElementById('debugContent');
  
  if (debugOutput && debugContent) {
    debugContent.textContent = content;
    debugOutput.style.display = 'block';
  }
}

// Export for potential use by other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    dashboardState,
    switchSection,
    addLog,
    showToast
  };
}