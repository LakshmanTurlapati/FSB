// FSB v9.0.2 - Modern Dashboard Control Panel Script

// Default settings
const defaultSettings = {
  modelProvider: 'xai',
  modelName: 'grok-4-1-fast',
  apiKey: '',
  geminiApiKey: '',
  openaiApiKey: '',
  anthropicApiKey: '',
  customApiKey: '',
  customEndpoint: '',
  speedMode: 'normal', // Legacy support
  maxIterations: 20,
  debugMode: false,
  // DOM Optimization settings
  domOptimization: true,
  maxDOMElements: 2000,
  prioritizeViewport: true,
  animatedActionHighlights: true,
  showSidepanelProgress: false,
  // Credential Manager (Beta)
  enableLogin: false,
  // CAPTCHA Solver
  captchaSolverEnabled: false,
  captchaApiKey: ''
};

// Available models - sourced from config.js (loaded before this script) with custom provider added
const availableModels = {
  ...config.availableModels,
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

  // Initialize session history
  setTimeout(initializeSessionHistory, 500);

  // Initialize site explorer
  setTimeout(initializeSiteExplorer, 600);

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
  elements.apiKey = document.getElementById('apiKey');
  elements.geminiApiKey = document.getElementById('geminiApiKey');
  elements.xaiApiKeyGroup = document.getElementById('xaiApiKeyGroup');
  elements.geminiApiKeyGroup = document.getElementById('geminiApiKeyGroup');
  elements.maxIterations = document.getElementById('maxIterations');
  elements.maxIterationsSlider = document.getElementById('maxIterationsSlider');
  elements.maxIterationsDisplay = document.getElementById('maxIterationsDisplay');
  elements.debugMode = document.getElementById('debugMode');
  // DOM Optimization elements
  elements.domOptimization = document.getElementById('domOptimization');
  elements.maxDOMElements = document.getElementById('maxDOMElements');
  elements.maxDOMElementsSlider = document.getElementById('maxDOMElementsSlider');
  elements.maxDOMElementsDisplay = document.getElementById('maxDOMElementsDisplay');
  elements.prioritizeViewport = document.getElementById('prioritizeViewport');
  elements.animatedActionHighlights = document.getElementById('animatedActionHighlights');
  elements.showSidepanelProgress = document.getElementById('showSidepanelProgress');

  // Credentials (Beta)
  elements.enableLogin = document.getElementById('enableLogin');

  // CAPTCHA Solver
  elements.captchaSolverEnabled = document.getElementById('captchaSolverEnabled');
  elements.captchaApiKey = document.getElementById('captchaApiKey');
  elements.toggleCaptchaApiKey = document.getElementById('toggleCaptchaApiKey');

  // Button elements
  elements.toggleApiKey = document.getElementById('toggleApiKey');
  elements.fullApiTest = document.getElementById('fullApiTest');
  elements.testResults = document.getElementById('testResults');
  elements.successRate = document.getElementById('successRate');

  // API Status Card
  elements.apiStatusCard = document.getElementById('apiStatusCard');
  
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

  // Site Explorer
  elements.explorerUrl = document.getElementById('explorerUrl');
  elements.explorerGoBtn = document.getElementById('explorerGoBtn');
  elements.explorerStopBtn = document.getElementById('explorerStopBtn');
  elements.explorerMaxDepth = document.getElementById('explorerMaxDepth');
  elements.explorerMaxPages = document.getElementById('explorerMaxPages');
  elements.explorerProgress = document.getElementById('explorerProgress');
  elements.explorerProgressFill = document.getElementById('explorerProgressFill');
  elements.explorerProgressText = document.getElementById('explorerProgressText');
  elements.explorerProgressCount = document.getElementById('explorerProgressCount');
  elements.explorerCurrentUrl = document.getElementById('explorerCurrentUrl');
  elements.researchList = document.getElementById('researchList');
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
    elements.geminiApiKey,
    document.getElementById('openaiApiKey'),
    document.getElementById('anthropicApiKey'),
    document.getElementById('customApiKey'),
    document.getElementById('customEndpoint'),
    elements.maxIterations,
    elements.debugMode,
    elements.domOptimization,
    elements.maxDOMElements,
    elements.prioritizeViewport,
    elements.animatedActionHighlights,
    elements.showSidepanelProgress,
    elements.enableLogin,
    elements.captchaSolverEnabled,
    elements.captchaApiKey
  ];

  formInputs.forEach(input => {
    if (input) {
      const eventType = input.type === 'checkbox' || input.type === 'radio' ? 'change' : 'input';
      input.addEventListener(eventType, () => markUnsavedChanges());
    }
  });

  // Max iterations slider with display update
  if (elements.maxIterationsSlider) {
    elements.maxIterationsSlider.addEventListener('input', (e) => {
      const value = e.target.value;
      if (elements.maxIterations) elements.maxIterations.value = value;
      if (elements.maxIterationsDisplay) elements.maxIterationsDisplay.textContent = value;
      markUnsavedChanges();
    });
  }

  // Max DOM elements slider with display update
  if (elements.maxDOMElementsSlider) {
    elements.maxDOMElementsSlider.addEventListener('input', (e) => {
      const value = e.target.value;
      if (elements.maxDOMElements) elements.maxDOMElements.value = value;
      if (elements.maxDOMElementsDisplay) elements.maxDOMElementsDisplay.textContent = value;
      markUnsavedChanges();
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
    elements.modelName.addEventListener('change', (e) => {
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

  // CAPTCHA Solver toggle visibility
  if (elements.captchaSolverEnabled) {
    elements.captchaSolverEnabled.addEventListener('change', (e) => {
      updateCaptchaSolverVisibility(e.target.checked);
      markUnsavedChanges();
    });
  }

  if (elements.toggleCaptchaApiKey) {
    elements.toggleCaptchaApiKey.addEventListener('click', () => togglePasswordVisibility('captchaApiKey'));
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
  
  // PERF: Debounced storage change listener to avoid duplicate analytics refreshes
  // (the 30-second setInterval above already refreshes periodically)
  let _analyticsRefreshTimer = null;
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local') {
      if (changes.fsbUsageData || changes.fsbCurrentModel) {
        // Only refresh if the analytics section is currently visible
        if (dashboardState.currentSection !== 'analytics') return;

        clearTimeout(_analyticsRefreshTimer);
        _analyticsRefreshTimer = setTimeout(() => {
          if (analytics && analytics.initialized) {
            analytics.loadStoredData().then(() => {
              analytics.updateDashboard();
              if (analytics.chart) {
                const timeRange = document.getElementById('chartTimeRange')?.value || '24h';
                analytics.updateChart(timeRange);
              }
            });
          }
        }, 2000);
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
}

function loadSettings() {
  chrome.storage.local.get(Object.keys(defaultSettings), (data) => {
    const settings = { ...defaultSettings, ...data };
    
    // Handle legacy speedMode to new model format
    if (!settings.modelProvider && settings.speedMode) {
      settings.modelProvider = 'xai';
      settings.modelName = 'grok-4-1-fast'; // All legacy modes map to new default
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
        updateApiKeyVisibility(settings.modelProvider || 'xai');
      }, 100);
    }
    
    // Update form elements
    if (elements.apiKey) elements.apiKey.value = settings.apiKey || '';
    if (elements.geminiApiKey) elements.geminiApiKey.value = settings.geminiApiKey || '';
    // Update new provider API keys
    const openaiApiKey = document.getElementById('openaiApiKey');
    if (openaiApiKey) openaiApiKey.value = settings.openaiApiKey || '';
    
    const anthropicApiKey = document.getElementById('anthropicApiKey');
    if (anthropicApiKey) anthropicApiKey.value = settings.anthropicApiKey || '';
    
    const customApiKey = document.getElementById('customApiKey');
    if (customApiKey) customApiKey.value = settings.customApiKey || '';
    
    const customEndpoint = document.getElementById('customEndpoint');
    if (customEndpoint) customEndpoint.value = settings.customEndpoint || '';

    // Max iterations
    const maxIter = settings.maxIterations || 20;
    if (elements.maxIterations) elements.maxIterations.value = maxIter;
    if (elements.maxIterationsSlider) elements.maxIterationsSlider.value = maxIter;
    if (elements.maxIterationsDisplay) elements.maxIterationsDisplay.textContent = maxIter;

    // Debug mode
    if (elements.debugMode) elements.debugMode.checked = settings.debugMode;

    // DOM optimization settings
    if (elements.domOptimization) {
      elements.domOptimization.checked = settings.domOptimization ?? true;
    }
    const maxDOM = settings.maxDOMElements || 2000;
    if (elements.maxDOMElements) elements.maxDOMElements.value = maxDOM;
    if (elements.maxDOMElementsSlider) elements.maxDOMElementsSlider.value = maxDOM;
    if (elements.maxDOMElementsDisplay) elements.maxDOMElementsDisplay.textContent = maxDOM;
    if (elements.prioritizeViewport) {
      elements.prioritizeViewport.checked = settings.prioritizeViewport ?? true;
    }
    if (elements.animatedActionHighlights) {
      elements.animatedActionHighlights.checked = settings.animatedActionHighlights ?? true;
    }
    if (elements.showSidepanelProgress) {
      elements.showSidepanelProgress.checked = settings.showSidepanelProgress ?? false;
    }

    // Credential Manager
    if (elements.enableLogin) {
      elements.enableLogin.checked = settings.enableLogin ?? false;
      updateCredentialsManagerVisibility(settings.enableLogin ?? false);
    }

    // CAPTCHA Solver
    if (elements.captchaSolverEnabled) {
      elements.captchaSolverEnabled.checked = settings.captchaSolverEnabled ?? false;
      updateCaptchaSolverVisibility(settings.captchaSolverEnabled ?? false);
    }
    if (elements.captchaApiKey) elements.captchaApiKey.value = settings.captchaApiKey || '';

    addLog('info', 'Settings loaded successfully');
  });
}

function saveSettings() {
  const settings = {
    modelProvider: elements.modelProvider?.value || 'xai',
    modelName: elements.modelName?.value || 'grok-4-1-fast',
    apiKey: elements.apiKey?.value || '',
    geminiApiKey: elements.geminiApiKey?.value || '',
    openaiApiKey: document.getElementById('openaiApiKey')?.value || '',
    anthropicApiKey: document.getElementById('anthropicApiKey')?.value || '',
    customApiKey: document.getElementById('customApiKey')?.value || '',
    customEndpoint: document.getElementById('customEndpoint')?.value || '',
    maxIterations: parseInt(elements.maxIterations?.value) || 20,
    debugMode: elements.debugMode?.checked ?? false,
    // DOM Optimization settings
    domOptimization: elements.domOptimization?.checked ?? true,
    maxDOMElements: parseInt(elements.maxDOMElements?.value) || 2000,
    prioritizeViewport: elements.prioritizeViewport?.checked ?? true,
    animatedActionHighlights: elements.animatedActionHighlights?.checked ?? true,
    showSidepanelProgress: elements.showSidepanelProgress?.checked ?? false,
    enableLogin: elements.enableLogin?.checked ?? false,
    captchaSolverEnabled: elements.captchaSolverEnabled?.checked ?? false,
    captchaApiKey: elements.captchaApiKey?.value || ''
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
    const provider = settings.modelProvider || 'xai';

    // Check appropriate API key based on provider
    const apiKeyMap = {
      xai: settings.apiKey,
      gemini: settings.geminiApiKey,
      openai: settings.openaiApiKey,
      anthropic: settings.anthropicApiKey,
      custom: settings.customApiKey
    };

    const apiKey = apiKeyMap[provider];

    if (!apiKey) {
      const providerNames = {
        xai: 'xAI',
        gemini: 'Gemini',
        openai: 'OpenAI',
        anthropic: 'Anthropic',
        custom: 'Custom'
      };
      updateConnectionStatus('disconnected', 'No API key configured');
      updateApiStatusCard('disconnected', 'No API Key', `Configure your ${providerNames[provider]} API key to get started`);
      return;
    }

    // Use AI integration to test connection
    const aiIntegration = new AIIntegration(settings);

    const result = await aiIntegration.testConnection();

    if (result.ok) {
      updateConnectionStatus('connected', 'Connected');
      // Hide status card on success - only show on errors
      if (elements.apiStatusCard) {
        elements.apiStatusCard.style.display = 'none';
      }
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
    elements.apiStatusCard.style.display = 'block';
    elements.apiStatusCard.className = `api-status-card ${status}`;

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
    const provider = settings.modelProvider || 'xai';

    // Check appropriate API key based on provider
    const apiKeyMap = {
      xai: { key: settings.apiKey, name: 'xAI' },
      gemini: { key: settings.geminiApiKey, name: 'Gemini' },
      openai: { key: settings.openaiApiKey, name: 'OpenAI' },
      anthropic: { key: settings.anthropicApiKey, name: 'Anthropic' },
      custom: { key: settings.customApiKey, name: 'Custom' }
    };

    const providerInfo = apiKeyMap[provider];
    if (!providerInfo.key) {
      throw new Error(`${providerInfo.name} API key is required for testing`);
    }

    // Test AI integration
    const aiIntegration = new AIIntegration(settings);

    const result = await aiIntegration.testConnection();

    // Display results
    elements.testResults.innerHTML = `
      <h4>API Test Results</h4>
      <div class="test-result-item">
        <strong>Provider:</strong> ${escapeHtml(providerInfo.name)}
      </div>
      <div class="test-result-item">
        <strong>Status:</strong> ${result.ok ? 'Success' : 'Failed'}
      </div>
      <div class="test-result-item">
        <strong>Model:</strong> ${escapeHtml(result.model || 'Unknown')}
      </div>
      <div class="test-result-item">
        <strong>Response Time:</strong> ${escapeHtml(String(result.responseTime || 'N/A'))}ms
      </div>
      ${result.error ? `<div class="test-result-item error"><strong>Error:</strong> ${escapeHtml(result.error)}</div>` : ''}
      ${result.data ? `<div class="test-result-item"><strong>Response:</strong> <pre>${escapeHtml(JSON.stringify(result.data, null, 2))}</pre></div>` : ''}
    `;

    elements.testResults.classList.add('show');
    addLog(result.ok ? 'info' : 'error', `Full API test ${result.ok ? 'passed' : 'failed'}: ${result.error || 'Success'}`);

  } catch (error) {
    elements.testResults.innerHTML = `
      <h4>API Test Results</h4>
      <div class="test-result-item error">
        <strong>Error:</strong> ${escapeHtml(error.message)}
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
      geminiApiKey: settings.geminiApiKey ? '[CONFIGURED]' : '',
      openaiApiKey: settings.openaiApiKey ? '[CONFIGURED]' : '',
      anthropicApiKey: settings.anthropicApiKey ? '[CONFIGURED]' : '',
      customApiKey: settings.customApiKey ? '[CONFIGURED]' : ''
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

function updateFooterLogo(theme) {
  const footerLogo = document.getElementById('footer-logo-img');
  if (footerLogo) {
    const logoSrc = theme === 'light'
      ? '../Assets/fsb_logo_light_footer.png'
      : '../Assets/fsb_logo_dark_footer.png';
    footerLogo.src = logoSrc;
  }
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);

  if (elements.themeToggle) {
    const icon = elements.themeToggle.querySelector('i');
    if (icon) {
      icon.className = theme === 'light' ? 'fas fa-moon' : 'fas fa-sun';
    }
  }

  // Update footer logo based on theme
  updateFooterLogo(theme);
}

function initializeLogs() {
  addLog('info', 'FSB Control Panel loaded successfully');
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
    <div class="log-entry ${escapeHtml(log.level)}">
      <span class="log-time">${escapeHtml(log.timestamp)}</span>
      <span class="log-level">${escapeHtml(log.level.toUpperCase())}</span>
      <span class="log-message">${escapeHtml(log.message)}</span>
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

let _toastTimer = null;
function showToast(message, type = 'info') {
  if (!elements.statusToast) return;

  // Duration varies by severity
  const durations = { success: 2000, info: 3000, warning: 4000, error: 6000 };
  const duration = durations[type] || 3000;

  // Clear any pending dismiss timer
  if (_toastTimer) clearTimeout(_toastTimer);

  // Build toast content with dismiss button
  elements.statusToast.innerHTML = '';
  const textSpan = document.createElement('span');
  textSpan.className = 'toast-text';
  textSpan.textContent = message;
  const dismissBtn = document.createElement('button');
  dismissBtn.className = 'toast-dismiss';
  dismissBtn.textContent = 'X';
  dismissBtn.addEventListener('click', () => {
    if (_toastTimer) clearTimeout(_toastTimer);
    elements.statusToast.classList.remove('show');
  });
  elements.statusToast.appendChild(textSpan);
  elements.statusToast.appendChild(dismissBtn);

  elements.statusToast.className = `status-toast ${type}`;
  elements.statusToast.classList.add('show');

  _toastTimer = setTimeout(() => {
    elements.statusToast.classList.remove('show');
  }, duration);
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
    model: 'grok-4-1-fast',
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
        analytics.currentModel = 'grok-4-1-fast';
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

// ==========================================
// Session History Functions
// ==========================================

// Current session being viewed
let currentViewingSession = null;

// Session replay state
let currentReplayData = null;
let currentStepIndex = 0;

/**
 * Initialize session history UI and event listeners
 */
function initializeSessionHistory() {
  // Top-level control buttons
  const refreshBtn = document.getElementById('refreshSessions');
  const clearAllBtn = document.getElementById('clearAllSessions');

  if (refreshBtn) {
    refreshBtn.addEventListener('click', loadSessionList);
  }

  if (clearAllBtn) {
    clearAllBtn.addEventListener('click', clearAllSessions);
  }

  // Event delegation on session list for all item/button clicks
  const sessionList = document.getElementById('sessionList');
  if (sessionList) {
    sessionList.addEventListener('click', (e) => {
      const actionBtn = e.target.closest('.session-action-btn');
      const sessionItem = e.target.closest('.session-item');
      if (!sessionItem) return;
      const sessionId = sessionItem.dataset.sessionId;

      if (actionBtn) {
        e.stopPropagation();
        const action = actionBtn.dataset.action;
        if (action === 'view') viewSession(sessionId);
        else if (action === 'download') downloadSessionLogs(sessionId);
        else if (action === 'delete') deleteSession(sessionId);
      } else {
        viewSession(sessionId);
      }
    });
  }

  // Load initial session list
  loadSessionList();
}

/**
 * Load and display the list of saved sessions
 */
async function loadSessionList() {
  const sessionList = document.getElementById('sessionList');
  if (!sessionList) return;

  try {
    // Get session index from storage
    const stored = await chrome.storage.local.get(['fsbSessionIndex']);
    const sessions = stored.fsbSessionIndex || [];

    if (sessions.length === 0) {
      sessionList.innerHTML = `
        <div class="session-empty-state">
          <i class="fas fa-inbox"></i>
          <p>No sessions recorded yet. Run an automation task to see session logs here.</p>
        </div>
      `;
      return;
    }

    // Render session items (using data-action attributes, no inline onclick)
    sessionList.innerHTML = sessions.map(session => `
      <div class="session-item" data-session-id="${session.id}">
        <div class="session-item-info">
          <div class="session-item-task">${escapeHtml(session.task || 'Unknown task')}</div>
          <div class="session-item-meta">
            <span><i class="fas fa-clock"></i> ${formatSessionDate(session.startTime)}</span>
            <span><i class="fas fa-play-circle"></i> ${session.actionCount || 0} actions</span>
            <span><i class="fas fa-hourglass-half"></i> ${formatSessionDuration(session.startTime, session.endTime)}</span>
          </div>
        </div>
        <div class="session-item-status">
          <span class="session-status-badge ${session.status}">${session.status}</span>
        </div>
        <div class="session-item-actions">
          <button class="session-action-btn view" data-action="view" title="View logs">
            <i class="fas fa-eye"></i>
          </button>
          <button class="session-action-btn download" data-action="download" title="Download logs">
            <i class="fas fa-download"></i>
          </button>
          <button class="session-action-btn delete" data-action="delete" title="Delete session">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </div>
    `).join('');

    addLog('info', `Loaded ${sessions.length} sessions`);

  } catch (error) {
    console.error('Failed to load session list:', error);
    sessionList.innerHTML = `
      <div class="session-empty-state">
        <i class="fas fa-exclamation-triangle"></i>
        <p>Failed to load sessions: ${error.message}</p>
      </div>
    `;
  }
}

/**
 * View a specific session's details and logs
 * @param {string} sessionId - The session ID to view
 */
async function viewSession(sessionId) {
  const sessionList = document.getElementById('sessionList');
  if (!sessionList) return;

  const sessionItem = sessionList.querySelector(`.session-item[data-session-id="${sessionId}"]`);
  if (!sessionItem) return;

  // Toggle: if same session is already expanded, collapse it
  if (sessionItem.classList.contains('expanded')) {
    collapseSessionDetail();
    return;
  }

  // Collapse any currently expanded session first
  collapseSessionDetail();

  try {
    // Load full session data
    const stored = await chrome.storage.local.get(['fsbSessionLogs']);
    const sessionStorage = stored.fsbSessionLogs || {};
    const session = sessionStorage[sessionId];

    if (!session) {
      showToast('Session not found', 'error');
      return;
    }

    currentViewingSession = session;

    // Mark item as expanded
    sessionItem.classList.add('expanded');

    // Create inline detail wrapper and insert after the session item
    const wrapper = document.createElement('div');
    wrapper.className = 'session-detail-wrapper';
    wrapper.innerHTML = createInlineDetailHTML(session);
    sessionItem.after(wrapper);

    // Populate logs content
    const logsEl = wrapper.querySelector('#sessionLogsContent');
    if (logsEl) {
      logsEl.textContent = formatSessionLogsForDisplay(session);
    }

    // Attach event listeners to the new inline panel
    attachInlinePanelListeners(wrapper, session);

    // Load replay data
    renderSessionReplay(sessionId);

    // Scroll expanded item into view
    sessionItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    addLog('info', `Viewing session ${sessionId}`);

  } catch (error) {
    console.error('Failed to view session:', error);
    showToast('Failed to load session details', 'error');
  }
}

/**
 * Collapse any currently expanded session detail panel
 */
function collapseSessionDetail() {
  // Remove expanded class from any session item
  const expandedItem = document.querySelector('.session-item.expanded');
  if (expandedItem) {
    expandedItem.classList.remove('expanded');
  }

  // Remove the inline detail wrapper from DOM
  const wrapper = document.querySelector('.session-detail-wrapper');
  if (wrapper) {
    wrapper.remove();
  }

  currentViewingSession = null;
  currentReplayData = null;
  currentStepIndex = 0;
}

/**
 * Close the session detail panel (alias for collapseSessionDetail)
 */
function closeSessionDetail() {
  collapseSessionDetail();
}

/**
 * Create the inline detail panel HTML for a session
 * @param {Object} session - The session data object
 * @returns {string} HTML string for the inline detail panel
 */
function createInlineDetailHTML(session) {
  return `
    <div class="session-detail-panel" data-session-id="${session.id}">
      <div class="session-detail-header">
        <div class="session-detail-title">
          <h4 id="sessionDetailTitle">${escapeHtml(session.task || 'Unknown Task')}</h4>
          <span class="session-detail-status session-status-badge ${session.status}" id="sessionDetailStatus">${session.status}</span>
        </div>
        <div class="session-detail-actions">
          <button class="control-btn" id="exportSessionText" title="Export as human-readable text">
            <i class="fas fa-file-alt"></i>
            Export Text
          </button>
          <button class="control-btn" id="downloadSessionLogs" title="Download JSON logs">
            <i class="fas fa-download"></i>
            Download JSON
          </button>
          <button class="control-btn" id="closeSessionDetail">
            <i class="fas fa-times"></i>
            Close
          </button>
        </div>
      </div>
      <div class="session-detail-meta" id="sessionDetailMeta">
        <div class="session-meta-item">
          <span class="session-meta-label">Session ID</span>
          <span class="session-meta-value">${session.id}</span>
        </div>
        <div class="session-meta-item">
          <span class="session-meta-label">Started</span>
          <span class="session-meta-value">${new Date(session.startTime).toLocaleString()}</span>
        </div>
        <div class="session-meta-item">
          <span class="session-meta-label">Ended</span>
          <span class="session-meta-value">${new Date(session.endTime).toLocaleString()}</span>
        </div>
        <div class="session-meta-item">
          <span class="session-meta-label">Duration</span>
          <span class="session-meta-value">${formatSessionDuration(session.startTime, session.endTime)}</span>
        </div>
        <div class="session-meta-item">
          <span class="session-meta-label">Actions</span>
          <span class="session-meta-value">${session.actionCount || 0}</span>
        </div>
        <div class="session-meta-item">
          <span class="session-meta-label">Iterations</span>
          <span class="session-meta-value">${session.iterationCount || 'N/A'}</span>
        </div>
      </div>
      <div class="session-replay-container" id="sessionReplayContainer">
        <div class="replay-controls">
          <button class="replay-btn" id="prevStep" disabled>
            <i class="fas fa-chevron-left"></i> Prev
          </button>
          <span class="replay-step-indicator">
            Step <span id="currentStepNum">0</span> of <span id="totalSteps">0</span>
          </span>
          <button class="replay-btn" id="nextStep" disabled>
            Next <i class="fas fa-chevron-right"></i>
          </button>
        </div>
        <div class="replay-step-content" id="replayStepContent">
          <div class="step-placeholder">Loading replay data...</div>
        </div>
        <div class="replay-summary" id="replaySummary" style="display: none;"></div>
      </div>
      <div class="session-logs-section">
        <button class="logs-toggle-btn" id="toggleRawLogs">
          <i class="fas fa-chevron-down"></i> Show Raw Logs
        </button>
        <div class="session-logs-container" id="rawLogsContainer" style="display: none;">
          <pre class="session-logs-content" id="sessionLogsContent">Loading...</pre>
        </div>
      </div>
    </div>
  `;
}

/**
 * Attach event listeners to the dynamically created inline panel buttons
 * @param {HTMLElement} wrapper - The .session-detail-wrapper element
 * @param {Object} session - The session data object
 */
function attachInlinePanelListeners(wrapper, session) {
  const exportTextBtn = wrapper.querySelector('#exportSessionText');
  const downloadBtn = wrapper.querySelector('#downloadSessionLogs');
  const closeBtn = wrapper.querySelector('#closeSessionDetail');
  const prevStepBtn = wrapper.querySelector('#prevStep');
  const nextStepBtn = wrapper.querySelector('#nextStep');
  const toggleRawLogsBtn = wrapper.querySelector('#toggleRawLogs');

  if (exportTextBtn) {
    exportTextBtn.addEventListener('click', () => {
      exportSessionText(session.id);
    });
  }

  if (downloadBtn) {
    downloadBtn.addEventListener('click', () => {
      downloadSessionLogs(session.id);
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', collapseSessionDetail);
  }

  if (prevStepBtn) {
    prevStepBtn.addEventListener('click', () => {
      if (currentStepIndex > 0) {
        renderStep(currentStepIndex - 1);
      }
    });
  }

  if (nextStepBtn) {
    nextStepBtn.addEventListener('click', () => {
      if (currentReplayData && currentStepIndex < currentReplayData.steps.length - 1) {
        renderStep(currentStepIndex + 1);
      }
    });
  }

  if (toggleRawLogsBtn) {
    toggleRawLogsBtn.addEventListener('click', () => {
      const rawLogsContainer = wrapper.querySelector('#rawLogsContainer');
      if (rawLogsContainer) {
        const isVisible = rawLogsContainer.style.display !== 'none';
        rawLogsContainer.style.display = isVisible ? 'none' : 'block';
        toggleRawLogsBtn.innerHTML = isVisible
          ? '<i class="fas fa-chevron-down"></i> Show Raw Logs'
          : '<i class="fas fa-chevron-up"></i> Hide Raw Logs';
        toggleRawLogsBtn.classList.toggle('expanded', !isVisible);
      }
    });
  }
}

/**
 * Download logs for the currently viewing session
 */
function downloadCurrentSessionLogs() {
  if (!currentViewingSession) {
    showToast('No session selected', 'warning');
    return;
  }
  downloadSessionLogs(currentViewingSession.id);
}

/**
 * Download raw JSON data for a specific session
 * @param {string} sessionId - The session ID to download
 */
async function downloadSessionLogs(sessionId) {
  try {
    const stored = await chrome.storage.local.get(['fsbSessionLogs']);
    const sessionStorage = stored.fsbSessionLogs || {};
    const session = sessionStorage[sessionId];

    if (!session) {
      showToast('Session not found', 'error');
      return;
    }

    // Download raw JSON session data
    const jsonStr = JSON.stringify(session, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const timestamp = new Date(session.startTime).toISOString().split('T')[0];
    const filename = `fsb-session-${timestamp}-${sessionId.replace('session_', '')}.json`;

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast('Session JSON downloaded', 'success');
    addLog('info', `Downloaded session ${sessionId}`);

  } catch (error) {
    console.error('Failed to download session:', error);
    showToast('Failed to download session logs', 'error');
  }
}

/**
 * Delete a specific session
 * @param {string} sessionId - The session ID to delete
 */
async function deleteSession(sessionId) {
  if (!confirm('Are you sure you want to delete this session? This cannot be undone.')) {
    return;
  }

  try {
    const stored = await chrome.storage.local.get(['fsbSessionLogs', 'fsbSessionIndex']);
    const sessionStorage = stored.fsbSessionLogs || {};
    const sessionIndex = stored.fsbSessionIndex || [];

    // Remove from storage
    delete sessionStorage[sessionId];

    // Remove from index
    const updatedIndex = sessionIndex.filter(s => s.id !== sessionId);

    // Save changes
    await chrome.storage.local.set({
      fsbSessionLogs: sessionStorage,
      fsbSessionIndex: updatedIndex
    });

    // Close detail panel if viewing this session
    if (currentViewingSession && currentViewingSession.id === sessionId) {
      closeSessionDetail();
    }

    // Refresh list
    loadSessionList();

    showToast('Session deleted', 'success');
    addLog('info', `Deleted session ${sessionId}`);

  } catch (error) {
    console.error('Failed to delete session:', error);
    showToast('Failed to delete session', 'error');
  }
}

/**
 * Clear all saved sessions
 */
async function clearAllSessions() {
  if (!confirm('Are you sure you want to delete ALL session history? This cannot be undone.')) {
    return;
  }

  try {
    await chrome.storage.local.remove(['fsbSessionLogs', 'fsbSessionIndex']);

    closeSessionDetail();
    loadSessionList();

    showToast('All sessions cleared', 'success');
    addLog('info', 'All sessions cleared');

  } catch (error) {
    console.error('Failed to clear sessions:', error);
    showToast('Failed to clear sessions', 'error');
  }
}

// Session functions are now accessed via event delegation - no global window exposure needed

/**
 * Format session logs for display in the detail panel
 * @param {Object} session - The session object
 * @returns {string} Formatted logs text
 */
function formatSessionLogsForDisplay(session) {
  if (!session.logs || session.logs.length === 0) {
    return 'No logs recorded for this session.';
  }

  return session.logs.map(log => {
    const time = new Date(log.timestamp).toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    let line = `[${time}] [${log.level.toUpperCase()}] ${log.message}`;

    // Add relevant data if present
    if (log.data) {
      const dataStr = formatLogDataCompact(log.data);
      if (dataStr) {
        line += `\n    ${dataStr}`;
      }
    }

    return line;
  }).join('\n');
}

/**
 * Format log data compactly for display
 * @param {Object} data - Log data object
 * @returns {string} Formatted data string
 */
function formatLogDataCompact(data) {
  if (!data) return '';

  const parts = [];

  if (data.action) {
    const paramsStr = JSON.stringify(data.action.params || {});
    parts.push(`Action: ${data.action.tool}(${paramsStr.substring(0, 100)}${paramsStr.length > 100 ? '...' : ''})`);
  }
  if (data.result && typeof data.result === 'object' && data.result.success !== undefined) {
    parts.push(`Result: ${data.result.success ? 'success' : 'failed'}`);
    if (data.result.error) {
      parts.push(`Error: ${data.result.error}`);
    }
  }
  if (data.iterationCount !== undefined) {
    parts.push(`Iteration: ${data.iterationCount}`);
  }
  if (data.taskComplete !== undefined) {
    parts.push(`Task Complete: ${data.taskComplete}`);
  }
  if (data.actionCount !== undefined && parts.length === 0) {
    parts.push(`Actions: ${data.actionCount}`);
  }

  return parts.join(' | ');
}

/**
 * Format a full session report for download
 * @param {Object} session - The session object
 * @returns {string} Formatted report text
 */
function formatSessionReport(session) {
  const lines = [];
  const divider = '='.repeat(80);
  const shortDivider = '-'.repeat(80);

  // Header
  lines.push(divider);
  lines.push('FSB Automation Session Report');
  lines.push(divider);
  lines.push('');

  // Session info
  lines.push(`Session ID: ${session.id}`);
  lines.push(`Task: ${session.task}`);
  lines.push(`Started: ${new Date(session.startTime).toLocaleString()}`);
  lines.push(`Ended: ${new Date(session.endTime).toLocaleString()}`);
  lines.push(`Status: ${session.status.toUpperCase()}`);
  lines.push(`Duration: ${formatSessionDuration(session.startTime, session.endTime)}`);
  lines.push(`Total Actions: ${session.actionCount}`);
  lines.push(`Iterations: ${session.iterationCount || 'N/A'}`);
  lines.push('');

  // Process logs to extract conversations by iteration
  const conversationLogs = extractConversationLogs(session.logs || []);
  const tokenUsageLogs = extractTokenUsageLogs(session.logs || []);
  const actionLogs = extractActionLogs(session.logs || []);
  const timingLogs = extractTimingLogs(session.logs || []);
  const commLogs = extractCommLogs(session.logs || []);
  const recoveryLogs = extractRecoveryLogs(session.logs || []);

  // AI Conversation Log Section
  if (conversationLogs.length > 0) {
    lines.push(divider);
    lines.push('AI CONVERSATION LOG');
    lines.push(divider);
    lines.push('');

    conversationLogs.forEach(conv => {
      lines.push(`${shortDivider}`);
      lines.push(`--- Iteration ${conv.iteration} ---`);
      lines.push('');

      // Prompt section
      if (conv.prompt) {
        lines.push(`[PROMPT - System] (${conv.prompt.systemPromptLength || 0} chars)`);
        if (conv.prompt.systemPrompt) {
          lines.push(conv.prompt.systemPrompt.substring(0, 2000));
          if (conv.prompt.systemPrompt.length > 2000) {
            lines.push('... [TRUNCATED]');
          }
        }
        lines.push('');
        lines.push(`[PROMPT - User] (${conv.prompt.userPromptLength || 0} chars)`);
        if (conv.prompt.userPrompt) {
          lines.push(conv.prompt.userPrompt.substring(0, 3000));
          if (conv.prompt.userPrompt.length > 3000) {
            lines.push('... [TRUNCATED]');
          }
        }
        lines.push('');
      }

      // Raw response section
      if (conv.rawResponse) {
        lines.push(`[RAW RESPONSE] (${conv.rawResponse.rawResponseLength || 0} chars, parse: ${conv.rawResponse.parseSuccess ? 'success' : 'failed'})`);
        if (conv.rawResponse.rawResponse) {
          lines.push(conv.rawResponse.rawResponse.substring(0, 2000));
          if (conv.rawResponse.rawResponse.length > 2000) {
            lines.push('... [TRUNCATED]');
          }
        }
        lines.push('');
      }

      // Reasoning section
      if (conv.reasoning) {
        lines.push('[REASONING]');
        if (conv.reasoning.situationAnalysis) {
          lines.push(`Situation: ${conv.reasoning.situationAnalysis}`);
        }
        if (conv.reasoning.goalAssessment) {
          lines.push(`Goal: ${conv.reasoning.goalAssessment}`);
        }
        if (conv.reasoning.reasoning) {
          lines.push(`Reasoning: ${conv.reasoning.reasoning}`);
        }
        if (conv.reasoning.confidence) {
          lines.push(`Confidence: ${conv.reasoning.confidence}`);
        }
        if (conv.reasoning.assumptions && conv.reasoning.assumptions.length > 0) {
          lines.push(`Assumptions: ${JSON.stringify(conv.reasoning.assumptions)}`);
        }
        if (conv.reasoning.fallbackPlan) {
          lines.push(`Fallback: ${conv.reasoning.fallbackPlan}`);
        }
        lines.push('');
      }

      // Token usage for this iteration
      if (conv.tokenUsage) {
        lines.push('[TOKEN USAGE]');
        lines.push(`Model: ${conv.tokenUsage.model} | Input: ${conv.tokenUsage.inputTokens} | Output: ${conv.tokenUsage.outputTokens} | Total: ${conv.tokenUsage.totalTokens} | Source: ${conv.tokenUsage.source}`);
        lines.push('');
      }

      lines.push('');
    });
  }

  // Timing Analysis Section
  if (timingLogs.length > 0) {
    lines.push(divider);
    lines.push('TIMING ANALYSIS');
    lines.push(divider);
    lines.push('');

    // Group timings by category
    const timingByCategory = {};
    timingLogs.forEach(t => {
      const key = t.category || 'OTHER';
      if (!timingByCategory[key]) {
        timingByCategory[key] = [];
      }
      timingByCategory[key].push(t.durationMs);
    });

    lines.push('Category        | Count | Avg (ms) | Min    | Max    | Total');
    lines.push(shortDivider);

    Object.entries(timingByCategory).forEach(([category, durations]) => {
      const count = durations.length;
      const total = durations.reduce((a, b) => a + b, 0);
      const avg = Math.round(total / count);
      const min = Math.min(...durations);
      const max = Math.max(...durations);
      lines.push(`${category.padEnd(15)} | ${String(count).padStart(5)} | ${String(avg).padStart(8)} | ${String(min).padStart(6)} | ${String(max).padStart(6)} | ${String(total).padStart(6)}`);
    });

    lines.push('');
  }

  // Communication Log Section
  if (commLogs.length > 0) {
    lines.push(divider);
    lines.push('COMMUNICATION LOG');
    lines.push(divider);
    lines.push('');

    commLogs.slice(0, 50).forEach(comm => {
      const time = new Date(comm.timestamp).toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        fractionalSecondDigits: 3
      });
      const direction = comm.direction.toUpperCase().padEnd(7);
      const success = comm.success ? 'OK' : 'FAIL';
      lines.push(`[${time}] ${direction} ${comm.type.padEnd(25)} ${success}`);
    });

    if (commLogs.length > 50) {
      lines.push(`... and ${commLogs.length - 50} more communication events`);
    }
    lines.push('');
  }

  // Recovery Events Section
  if (recoveryLogs.length > 0) {
    lines.push(divider);
    lines.push('RECOVERY EVENTS');
    lines.push(divider);
    lines.push('');

    recoveryLogs.forEach(recovery => {
      const time = new Date(recovery.timestamp).toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        fractionalSecondDigits: 3
      });
      lines.push(`[${time}] ${recovery.issue} -> ${recovery.action} -> ${recovery.result}`);
      if (recovery.details) {
        lines.push(`  Details: ${JSON.stringify(recovery.details)}`);
      }
    });

    lines.push('');
  }

  // Token Usage Summary
  if (tokenUsageLogs.length > 0) {
    lines.push(divider);
    lines.push('TOKEN USAGE SUMMARY');
    lines.push(divider);
    lines.push('');

    let totalInput = 0;
    let totalOutput = 0;

    tokenUsageLogs.forEach(usage => {
      totalInput += usage.inputTokens || 0;
      totalOutput += usage.outputTokens || 0;
      lines.push(`Iteration ${usage.iteration || 'N/A'}: Model=${usage.model}, In=${usage.inputTokens}, Out=${usage.outputTokens}, Source=${usage.source}`);
    });

    lines.push('');
    lines.push(`TOTAL: Input=${totalInput}, Output=${totalOutput}, Combined=${totalInput + totalOutput}`);
    lines.push('');
  }

  // Log entries (standard format)
  lines.push(divider);
  lines.push('SESSION LOGS');
  lines.push(divider);
  lines.push('');

  if (session.logs && session.logs.length > 0) {
    session.logs.forEach(log => {
      const time = new Date(log.timestamp).toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        fractionalSecondDigits: 3
      });

      lines.push(`[${time}] [${log.level.toUpperCase()}] ${log.message}`);

      if (log.data) {
        const dataStr = formatLogDataForReport(log.data);
        if (dataStr) {
          lines.push(`  ${dataStr}`);
        }
      }
      lines.push('');
    });
  } else {
    lines.push('No logs recorded for this session.');
  }

  lines.push(divider);
  lines.push(`Report generated: ${new Date().toLocaleString()}`);

  return lines.join('\n');
}

/**
 * Extract conversation logs grouped by iteration
 * @param {Array} logs - Array of log entries
 * @returns {Array} Conversation logs grouped by iteration
 */
function extractConversationLogs(logs) {
  const iterations = new Map();

  logs.forEach(log => {
    if (!log.data || !log.data.logType) return;

    const iteration = log.data.iteration || 0;
    if (!iterations.has(iteration)) {
      iterations.set(iteration, {
        iteration: iteration,
        prompt: null,
        rawResponse: null,
        reasoning: null,
        tokenUsage: null
      });
    }

    const conv = iterations.get(iteration);

    switch (log.data.logType) {
      case 'prompt':
        conv.prompt = log.data;
        break;
      case 'rawResponse':
        conv.rawResponse = log.data;
        break;
      case 'reasoning':
        conv.reasoning = log.data;
        break;
      case 'tokenUsage':
        conv.tokenUsage = log.data;
        break;
    }
  });

  // Convert to array and sort by iteration
  return Array.from(iterations.values())
    .filter(conv => conv.prompt || conv.rawResponse || conv.reasoning)
    .sort((a, b) => a.iteration - b.iteration);
}

/**
 * Extract token usage logs
 * @param {Array} logs - Array of log entries
 * @returns {Array} Token usage log entries
 */
function extractTokenUsageLogs(logs) {
  return logs
    .filter(log => log.data && log.data.logType === 'tokenUsage')
    .map(log => log.data)
    .sort((a, b) => (a.iteration || 0) - (b.iteration || 0));
}

/**
 * Extract action logs
 * @param {Array} logs - Array of log entries
 * @returns {Array} Action log entries
 */
function extractActionLogs(logs) {
  return logs
    .filter(log => log.data && log.data.action)
    .map(log => ({
      timestamp: log.timestamp,
      action: log.data.action,
      result: log.data.result
    }));
}

/**
 * Extract timing logs
 * @param {Array} logs - Array of log entries
 * @returns {Array} Timing log entries
 */
function extractTimingLogs(logs) {
  return logs
    .filter(log => log.data && log.data.logType === 'timing')
    .map(log => ({
      timestamp: log.timestamp,
      category: log.data.category,
      operation: log.data.operation,
      durationMs: log.data.durationMs
    }))
    .sort((a, b) => a.timestamp - b.timestamp);
}

/**
 * Extract communication logs
 * @param {Array} logs - Array of log entries
 * @returns {Array} Communication log entries
 */
function extractCommLogs(logs) {
  return logs
    .filter(log => log.data && log.data.logType === 'comm')
    .map(log => ({
      timestamp: log.timestamp,
      direction: log.data.direction,
      type: log.data.type,
      success: log.data.success
    }))
    .sort((a, b) => a.timestamp - b.timestamp);
}

/**
 * Extract recovery event logs
 * @param {Array} logs - Array of log entries
 * @returns {Array} Recovery event log entries
 */
function extractRecoveryLogs(logs) {
  return logs
    .filter(log => log.data && log.data.logType === 'recovery')
    .map(log => ({
      timestamp: log.timestamp,
      issue: log.data.issue,
      action: log.data.action,
      result: log.data.result,
      details: log.data.details || null
    }))
    .sort((a, b) => a.timestamp - b.timestamp);
}

/**
 * Format log data for report export
 * @param {Object} data - Log data object
 * @returns {string} Formatted data string
 */
function formatLogDataForReport(data) {
  if (!data) return '';

  const parts = [];

  // Handle new log types
  if (data.logType) {
    switch (data.logType) {
      case 'prompt':
        parts.push(`Prompt: System(${data.systemPromptLength}), User(${data.userPromptLength}), Est. tokens: ${data.estimatedTokens}`);
        break;
      case 'rawResponse':
        parts.push(`Raw Response: ${data.rawResponseLength} chars, Parse: ${data.parseSuccess ? 'OK' : 'FAILED'}`);
        break;
      case 'reasoning':
        if (data.confidence) parts.push(`Confidence: ${data.confidence}`);
        if (data.currentStep) parts.push(`Step: ${data.currentStep}`);
        break;
      case 'domState':
        parts.push(`DOM: ${data.elementCount} elements, URL: ${data.url}, Delta: ${data.isDelta}`);
        break;
      case 'contentMessage':
        parts.push(`${data.direction.toUpperCase()}: ${data.messageType}, Success: ${data.success}`);
        break;
      case 'tokenUsage':
        parts.push(`Tokens: In=${data.inputTokens}, Out=${data.outputTokens}, Model=${data.model}, Source=${data.source}`);
        break;
      case 'timing':
        parts.push(`Timing: ${data.category}/${data.operation} took ${data.durationMs}ms`);
        break;
      case 'comm':
        parts.push(`Comm: ${data.direction} ${data.type} - ${data.success ? 'success' : 'failed'}`);
        break;
      case 'recovery':
        parts.push(`Recovery: ${data.issue} -> ${data.action} -> ${data.result}`);
        break;
      case 'navigation':
        parts.push(`Navigation: ${data.type} from ${data.from} to ${data.to}`);
        break;
      case 'domOperation':
        parts.push(`DOM: ${data.operation}`);
        break;
      case 'actionExec':
        parts.push(`Action: ${data.tool} (${data.phase})`);
        break;
      case 'api':
        parts.push(`API: ${data.provider}/${data.operation}`);
        break;
      case 'serviceWorker':
        parts.push(`ServiceWorker: ${data.event}`);
        break;
      case 'init':
        parts.push(`Init: ${data.component} - ${data.status}`);
        break;
    }
    return parts.join(' | ');
  }

  // Handle legacy log formats
  if (data.action) {
    parts.push(`Action: ${data.action.tool}(${JSON.stringify(data.action.params || {})})`);
  }
  if (data.result !== undefined) {
    const resultStr = typeof data.result === 'object'
      ? JSON.stringify(data.result)
      : String(data.result);
    parts.push(`Result: ${resultStr.substring(0, 200)}${resultStr.length > 200 ? '...' : ''}`);
  }
  if (data.error) {
    parts.push(`Error: ${data.error}`);
  }
  if (data.iterationCount !== undefined) {
    parts.push(`Iteration: ${data.iterationCount}`);
  }
  if (data.domHash) {
    parts.push(`DOM Hash: ${data.domHash}`);
  }
  if (data.stuckCounter !== undefined) {
    parts.push(`Stuck Counter: ${data.stuckCounter}`);
  }

  return parts.join(' | ');
}

/**
 * Format session date for display
 * @param {number} timestamp - Unix timestamp
 * @returns {string} Formatted date string
 */
function formatSessionDate(timestamp) {
  if (!timestamp) return 'Unknown';

  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffHours = diffMs / (1000 * 60 * 60);

  if (diffHours < 1) {
    const mins = Math.floor(diffMs / (1000 * 60));
    return `${mins}m ago`;
  } else if (diffHours < 24) {
    return `${Math.floor(diffHours)}h ago`;
  } else if (diffHours < 48) {
    return 'Yesterday';
  } else {
    return date.toLocaleDateString();
  }
}

/**
 * Format session duration
 * @param {number} startTime - Start timestamp
 * @param {number} endTime - End timestamp
 * @returns {string} Formatted duration string
 */
function formatSessionDuration(startTime, endTime) {
  if (!startTime || !endTime) return 'Unknown';

  const durationMs = endTime - startTime;
  const seconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }
  return `${seconds}s`;
}

/**
 * Escape HTML special characters
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ==========================================
// Session Replay Functions
// ==========================================

/**
 * Render session replay data with step-by-step navigation
 * @param {string} sessionId - The session ID to render replay for
 */
async function renderSessionReplay(sessionId) {
  // Get replay data from background (automationLogger runs there)
  const response = await chrome.runtime.sendMessage({
    action: 'getSessionReplayData',
    sessionId
  });

  if (!response?.replay || !response.replay.steps || response.replay.steps.length === 0) {
    document.getElementById('replayStepContent').innerHTML = '<div class="step-placeholder">No replay data available for this session</div>';
    document.getElementById('replaySummary').style.display = 'none';
    document.getElementById('prevStep').disabled = true;
    document.getElementById('nextStep').disabled = true;
    document.getElementById('currentStepNum').textContent = '0';
    document.getElementById('totalSteps').textContent = '0';
    return;
  }

  currentReplayData = response.replay;
  currentStepIndex = 0;

  // Update controls
  document.getElementById('totalSteps').textContent = currentReplayData.steps.length;
  document.getElementById('prevStep').disabled = true;
  document.getElementById('nextStep').disabled = currentReplayData.steps.length <= 1;

  // Render first step
  renderStep(0);

  // Show summary
  renderReplaySummary();
}

/**
 * Render a specific step in the replay
 * @param {number} index - Step index to render
 */
function renderStep(index) {
  if (!currentReplayData || !currentReplayData.steps) return;

  const step = currentReplayData.steps[index];
  if (!step) return;

  currentStepIndex = index;
  document.getElementById('currentStepNum').textContent = index + 1;
  document.getElementById('prevStep').disabled = index === 0;
  document.getElementById('nextStep').disabled = index === currentReplayData.steps.length - 1;

  const statusClass = step.result.success ? 'success' : 'failed';
  const statusText = step.result.success ? 'OK' : 'FAILED';

  let html = `
    <div class="step-header">
      <span class="step-status ${statusClass}">${statusText}</span>
      <strong>${escapeHtml(step.action.tool)}</strong>
    </div>
    <div class="step-section">
      <h5>Targeting</h5>
      <div class="step-detail">Selector: <code>${escapeHtml(step.targeting.selectorUsed || step.targeting.selectorTried || 'N/A')}</code></div>
      <div class="step-detail">Element Found: ${step.targeting.elementFound ? 'Yes' : 'No'}</div>
      ${step.targeting.coordinatesUsed ? `<div class="step-detail">Coordinates: (${step.targeting.coordinatesUsed.x}, ${step.targeting.coordinatesUsed.y})</div>` : ''}
    </div>
  `;

  if (step.targeting.elementDetails) {
    const el = step.targeting.elementDetails;
    const tagDisplay = `&lt;${el.tagName || 'unknown'}${el.id ? ' id="' + escapeHtml(el.id) + '"' : ''}${el.className ? ' class="' + escapeHtml(el.className.split(' ')[0]) + '"' : ''}&gt;`;
    html += `
      <div class="step-section">
        <h5>Element</h5>
        <div class="step-detail">${tagDisplay}</div>
        ${el.text ? `<div class="step-detail">Text: "${escapeHtml(el.text.substring(0, 50))}${el.text.length > 50 ? '...' : ''}"</div>` : ''}
      </div>
    `;
  }

  // Show action parameters if any
  if (step.action.params && Object.keys(step.action.params).length > 0) {
    const paramsStr = JSON.stringify(step.action.params, null, 2);
    html += `
      <div class="step-section">
        <h5>Parameters</h5>
        <div class="step-detail" style="white-space: pre-wrap; font-size: 0.8rem;">${escapeHtml(paramsStr.substring(0, 300))}${paramsStr.length > 300 ? '...' : ''}</div>
      </div>
    `;
  }

  if (!step.result.success && step.result.diagnostic) {
    html += `
      <div class="step-section">
        <h5>Diagnostic</h5>
        <div class="step-detail" style="color: var(--error-color);">${escapeHtml(step.result.diagnostic.message || 'Unknown error')}</div>
        ${step.result.diagnostic.details ? `<div class="step-detail">${escapeHtml(step.result.diagnostic.details)}</div>` : ''}
        ${step.result.diagnostic.suggestions && step.result.diagnostic.suggestions.length > 0 ? `<div class="step-detail">Suggestions:<br>${step.result.diagnostic.suggestions.map(s => '  - ' + escapeHtml(s)).join('<br>')}</div>` : ''}
      </div>
    `;
  } else if (!step.result.success && step.result.error) {
    html += `
      <div class="step-section">
        <h5>Error</h5>
        <div class="step-detail" style="color: var(--error-color);">${escapeHtml(step.result.error)}</div>
      </div>
    `;
  }

  document.getElementById('replayStepContent').innerHTML = html;
}

/**
 * Render the replay summary section
 */
function renderReplaySummary() {
  if (!currentReplayData || !currentReplayData.summary) {
    document.getElementById('replaySummary').style.display = 'none';
    return;
  }

  const summary = currentReplayData.summary;
  let summaryHtml = `
    <strong>Summary:</strong> ${summary.successfulSteps}/${summary.totalSteps} steps successful
    ${summary.failedSteps > 0 ? ` | <span style="color: var(--error-color);">${summary.failedSteps} failed</span>` : ''}
  `;

  document.getElementById('replaySummary').innerHTML = summaryHtml;
  document.getElementById('replaySummary').style.display = 'block';
}

/**
 * Export session as human-readable text
 * @param {string} sessionId - The session ID to export
 */
async function exportSessionText(sessionId) {
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'exportSessionHumanReadable',
      sessionId
    });

    if (response?.text) {
      const blob = new Blob([response.text], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fsb-session-${sessionId.substring(0, 8)}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showToast('Session report exported', 'success');
      addLog('info', `Exported session ${sessionId} as text`);
    } else {
      showToast('Failed to export session', 'error');
    }
  } catch (error) {
    console.error('Failed to export session text:', error);
    showToast('Export failed: ' + error.message, 'error');
  }
}

// ==========================================
// Credential Manager Functions (Passwords Beta)
// ==========================================

// Current state for credential modal
let credentialModalMode = 'add'; // 'add' or 'edit'
let credentialEditingDomain = null;

// Show/hide credentials manager based on toggle
function updateCaptchaSolverVisibility(enabled) {
  const configPanel = document.getElementById('captchaSolverConfig');
  if (configPanel) {
    configPanel.style.display = enabled ? 'block' : 'none';
  }
}

function updateCredentialsManagerVisibility(enabled) {
  const manager = document.getElementById('credentialsManager');
  if (manager) {
    manager.style.display = enabled ? 'block' : 'none';
    if (enabled) {
      loadCredentials();
    }
  }
}

// Load and display all credentials
async function loadCredentials() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'getAllCredentials' });

    if (!response || !response.success) {
      console.error('Failed to load credentials:', response?.error);
      return;
    }

    const credentials = response.credentials || [];
    const listEl = document.getElementById('credentialsList');
    const emptyEl = document.getElementById('credentialsEmpty');

    if (credentials.length === 0) {
      if (listEl) listEl.innerHTML = '';
      if (emptyEl) emptyEl.style.display = 'flex';
      return;
    }

    if (emptyEl) emptyEl.style.display = 'none';

    if (listEl) {
      listEl.innerHTML = credentials.map(cred => renderCredentialCard(cred)).join('');
    }
  } catch (error) {
    console.error('Error loading credentials:', error);
  }
}

// Render a single credential card
function renderCredentialCard(cred) {
  const initial = (cred.domain || '?')[0].toUpperCase();
  const faviconUrl = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(cred.domain)}&sz=32`;
  const dateStr = cred.updatedAt ? new Date(cred.updatedAt).toLocaleDateString() : '';

  return `
    <div class="credential-card" data-domain="${escapeHtml(cred.domain)}">
      <div class="credential-card-icon">
        <img src="${faviconUrl}" alt="${initial}" onerror="this.style.display='none';this.parentNode.textContent='${initial}'">
      </div>
      <div class="credential-card-info">
        <div class="credential-card-domain">${escapeHtml(cred.domain)}</div>
        <div class="credential-card-username">${escapeHtml(cred.username || 'No username')}</div>
      </div>
      <div class="credential-card-password" data-domain="${escapeHtml(cred.domain)}">
        <span class="password-dots">--------</span>
      </div>
      <div class="credential-card-actions">
        <button class="credential-action-btn" data-cred-action="toggle-password" data-cred-domain="${escapeHtml(cred.domain)}" title="Show password">
          <i class="fas fa-eye"></i>
        </button>
        <button class="credential-action-btn" data-cred-action="edit" data-cred-domain="${escapeHtml(cred.domain)}" title="Edit">
          <i class="fas fa-edit"></i>
        </button>
        <button class="credential-action-btn delete" data-cred-action="delete" data-cred-domain="${escapeHtml(cred.domain)}" title="Delete">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    </div>
  `;
}

// Filter credentials by search query
function filterCredentials(query) {
  const cards = document.querySelectorAll('.credential-card');
  const lowerQuery = query.toLowerCase();

  cards.forEach(card => {
    const domain = card.dataset.domain || '';
    const username = card.querySelector('.credential-card-username')?.textContent || '';
    const matches = domain.toLowerCase().includes(lowerQuery) ||
                    username.toLowerCase().includes(lowerQuery);
    card.style.display = matches ? 'flex' : 'none';
  });
}

// Show add/edit modal
async function showCredentialModal(mode, domain) {
  credentialModalMode = mode;
  credentialEditingDomain = domain || null;

  const modal = document.getElementById('credentialModal');
  const titleEl = document.getElementById('credentialModalTitle');
  const domainInput = document.getElementById('credModalDomain');
  const usernameInput = document.getElementById('credModalUsername');
  const passwordInput = document.getElementById('credModalPassword');
  const notesInput = document.getElementById('credModalNotes');

  if (titleEl) titleEl.textContent = mode === 'edit' ? 'Edit Credential' : 'Add Credential';

  // Clear fields
  if (domainInput) domainInput.value = '';
  if (usernameInput) usernameInput.value = '';
  if (passwordInput) passwordInput.value = '';
  if (notesInput) notesInput.value = '';

  // Pre-fill for edit mode
  if (mode === 'edit' && domain) {
    if (domainInput) {
      domainInput.value = domain;
      domainInput.readOnly = true;
    }

    // Fetch full credential (including password) for editing
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'getFullCredential',
        domain: domain
      });

      if (response?.success && response.credential) {
        if (usernameInput) usernameInput.value = response.credential.username || '';
        if (passwordInput) passwordInput.value = response.credential.password || '';
        if (notesInput) notesInput.value = response.credential.notes || '';
      }
    } catch (error) {
      console.error('Failed to load credential for editing:', error);
    }
  } else {
    if (domainInput) domainInput.readOnly = false;
  }

  // Show modal
  if (modal) modal.classList.remove('hidden');
}

// Hide modal
function hideCredentialModal() {
  const modal = document.getElementById('credentialModal');
  if (modal) modal.classList.add('hidden');
  credentialModalMode = 'add';
  credentialEditingDomain = null;
}

// Save credential from modal
async function saveCredentialFromModal() {
  const domain = document.getElementById('credModalDomain')?.value?.trim();
  const username = document.getElementById('credModalUsername')?.value?.trim();
  const password = document.getElementById('credModalPassword')?.value;
  const notes = document.getElementById('credModalNotes')?.value?.trim();

  if (!domain) {
    showToast('Domain is required', 'error');
    return;
  }

  if (!username && !password) {
    showToast('Username or password is required', 'error');
    return;
  }

  try {
    const action = credentialModalMode === 'edit' ? 'updateCredential' : 'saveCredential';
    const message = credentialModalMode === 'edit'
      ? { action, domain: credentialEditingDomain || domain, updates: { username, password, notes } }
      : { action, domain, data: { username, password, notes } };

    const response = await chrome.runtime.sendMessage(message);

    if (response?.success) {
      showToast(credentialModalMode === 'edit' ? 'Credential updated' : 'Credential saved', 'success');
      hideCredentialModal();
      loadCredentials();
    } else {
      showToast('Failed to save: ' + (response?.error || 'Unknown error'), 'error');
    }
  } catch (error) {
    showToast('Error saving credential: ' + error.message, 'error');
  }
}

// Delete credential with confirmation
async function deleteCredentialConfirm(domain) {
  if (!confirm(`Delete saved credential for "${domain}"? This cannot be undone.`)) {
    return;
  }

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'deleteCredential',
      domain: domain
    });

    if (response?.success) {
      showToast('Credential deleted', 'success');
      loadCredentials();
    } else {
      showToast('Failed to delete: ' + (response?.error || 'Unknown error'), 'error');
    }
  } catch (error) {
    showToast('Error deleting credential: ' + error.message, 'error');
  }
}

// Toggle password visibility for a credential card
async function toggleCredentialPassword(domain) {
  const passwordEl = document.querySelector(`.credential-card-password[data-domain="${domain}"]`);
  if (!passwordEl) return;

  const dotsEl = passwordEl.querySelector('.password-dots');
  if (!dotsEl) return;

  // If currently showing dots, fetch and show password
  if (dotsEl.textContent === '--------') {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'getFullCredential',
        domain: domain
      });

      if (response?.success && response.credential) {
        dotsEl.textContent = response.credential.password || '(empty)';
        dotsEl.style.color = 'var(--text-primary)';

        // Find the eye icon and switch it
        const card = passwordEl.closest('.credential-card');
        const eyeBtn = card?.querySelector('.credential-action-btn:first-child i');
        if (eyeBtn) eyeBtn.className = 'fas fa-eye-slash';

        // Auto-hide after 5 seconds
        setTimeout(() => {
          dotsEl.textContent = '--------';
          dotsEl.style.color = '';
          if (eyeBtn) eyeBtn.className = 'fas fa-eye';
        }, 5000);
      }
    } catch (error) {
      console.error('Failed to fetch password:', error);
    }
  } else {
    // Hide password
    dotsEl.textContent = '--------';
    dotsEl.style.color = '';

    const card = passwordEl.closest('.credential-card');
    const eyeBtn = card?.querySelector('.credential-action-btn:first-child i');
    if (eyeBtn) eyeBtn.className = 'fas fa-eye';
  }
}

// Initialize credential manager event listeners
function initializeCredentialManager() {
  // Event delegation for credential card action buttons (avoids inline onclick XSS risk)
  const credList = document.getElementById('credentialsList');
  if (credList) {
    credList.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-cred-action]');
      if (!btn) return;
      const action = btn.dataset.credAction;
      const domain = btn.dataset.credDomain;
      if (!domain) return;
      if (action === 'toggle-password') toggleCredentialPassword(domain);
      else if (action === 'edit') showCredentialModal('edit', domain);
      else if (action === 'delete') deleteCredentialConfirm(domain);
    });
  }

  // Enable login toggle
  const enableLoginToggle = document.getElementById('enableLogin');
  if (enableLoginToggle) {
    enableLoginToggle.addEventListener('change', (e) => {
      updateCredentialsManagerVisibility(e.target.checked);
      markUnsavedChanges();
    });
  }

  // Search filter
  const searchInput = document.getElementById('credentialSearch');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      filterCredentials(e.target.value);
    });
  }

  // Add New button
  const addBtn = document.getElementById('addCredentialBtn');
  if (addBtn) {
    addBtn.addEventListener('click', () => showCredentialModal('add'));
  }

  // Modal buttons
  const modalSave = document.getElementById('credentialModalSave');
  const modalCancel = document.getElementById('credentialModalCancel');
  const modalClose = document.getElementById('credentialModalClose');
  const modalBackdrop = document.querySelector('.credential-modal-backdrop');

  if (modalSave) modalSave.addEventListener('click', saveCredentialFromModal);
  if (modalCancel) modalCancel.addEventListener('click', hideCredentialModal);
  if (modalClose) modalClose.addEventListener('click', hideCredentialModal);
  if (modalBackdrop) modalBackdrop.addEventListener('click', hideCredentialModal);

  // Modal password toggle
  const toggleModalPw = document.getElementById('toggleCredModalPassword');
  if (toggleModalPw) {
    toggleModalPw.addEventListener('click', () => {
      const pwField = document.getElementById('credModalPassword');
      if (pwField) {
        const isPassword = pwField.type === 'password';
        pwField.type = isPassword ? 'text' : 'password';
        const icon = toggleModalPw.querySelector('i');
        if (icon) icon.className = isPassword ? 'fas fa-eye-slash' : 'fas fa-eye';
      }
    });
  }

  // Load credentials when switching to passwords section (override inside init to ensure DOM is ready)
  const origSwitchSection = switchSection;
  switchSection = function(sectionId) {
    origSwitchSection(sectionId);
    if (sectionId === 'passwords') {
      const enableLogin = document.getElementById('enableLogin');
      if (enableLogin?.checked) {
        loadCredentials();
      }
    }
  };
}

// Initialize credential manager after DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  // Delay slightly to ensure all other init is done
  setTimeout(initializeCredentialManager, 200);
});

// ==========================================
// Site Explorer Functions
// ==========================================

function initializeSiteExplorer() {
  // Go button
  if (elements.explorerGoBtn) {
    elements.explorerGoBtn.addEventListener('click', startExplorer);
  }

  // Stop button
  if (elements.explorerStopBtn) {
    elements.explorerStopBtn.addEventListener('click', stopExplorer);
  }

  // Enter key on URL input
  if (elements.explorerUrl) {
    elements.explorerUrl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') startExplorer();
    });
  }

  // Research list controls
  const refreshBtn = document.getElementById('refreshResearch');
  const clearAllBtn = document.getElementById('clearAllResearch');

  if (refreshBtn) {
    refreshBtn.addEventListener('click', loadResearchList);
  }

  if (clearAllBtn) {
    clearAllBtn.addEventListener('click', clearAllResearchResults);
  }

  // Event delegation on research list for item/button clicks
  if (elements.researchList) {
    elements.researchList.addEventListener('click', (e) => {
      const actionBtn = e.target.closest('.session-action-btn');
      const researchItem = e.target.closest('.session-item');
      if (!researchItem) return;
      const researchId = researchItem.dataset.researchId;

      if (actionBtn) {
        e.stopPropagation();
        const action = actionBtn.dataset.action;
        if (action === 'view') viewResearch(researchId);
        else if (action === 'download') downloadResearch(researchId);
        else if (action === 'delete') deleteResearch(researchId);
      } else {
        viewResearch(researchId);
      }
    });
  }

  // Listen for explorer status broadcasts from background
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'explorerStatusUpdate') {
      updateExplorerProgress(message.data);
    }
  });

  // Load initial research list
  loadResearchList();
}

async function startExplorer() {
  const url = (elements.explorerUrl?.value || '').trim();
  if (!url) {
    showToast('Please enter a URL to explore', 'error');
    return;
  }

  // Validate URL format
  let testUrl = url;
  if (!testUrl.startsWith('http://') && !testUrl.startsWith('https://')) {
    testUrl = 'https://' + testUrl;
  }
  try {
    new URL(testUrl);
  } catch (e) {
    showToast('Invalid URL format', 'error');
    return;
  }

  const maxDepth = parseInt(elements.explorerMaxDepth?.value || '3');
  const maxPages = parseInt(elements.explorerMaxPages?.value || '25');

  // Toggle UI
  elements.explorerGoBtn.style.display = 'none';
  elements.explorerStopBtn.style.display = '';
  elements.explorerProgress.style.display = '';
  elements.explorerProgressFill.style.width = '0%';
  elements.explorerProgressText.textContent = 'Starting crawl...';
  elements.explorerProgressCount.textContent = '0 / ' + maxPages + ' pages';
  elements.explorerCurrentUrl.textContent = '';

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'startExplorer',
      url: testUrl,
      maxDepth,
      maxPages
    });

    if (!response || !response.success) {
      showToast('Failed to start explorer: ' + (response?.error || 'Unknown error'), 'error');
      resetExplorerUI();
    } else {
      addLog('info', 'Site Explorer started for ' + testUrl);
    }
  } catch (error) {
    showToast('Failed to start explorer: ' + error.message, 'error');
    resetExplorerUI();
  }
}

async function stopExplorer() {
  try {
    await chrome.runtime.sendMessage({ action: 'stopExplorer' });
    addLog('info', 'Site Explorer stopped');
    showToast('Explorer stopped', 'info');
  } catch (error) {
    console.error('Failed to stop explorer:', error);
  }
  resetExplorerUI();
}

function resetExplorerUI() {
  if (elements.explorerGoBtn) elements.explorerGoBtn.style.display = '';
  if (elements.explorerStopBtn) elements.explorerStopBtn.style.display = 'none';
  if (elements.explorerProgress) elements.explorerProgress.style.display = 'none';
}

function updateExplorerProgress(data) {
  if (!data) return;

  if (data.status === 'crawling') {
    // Show progress
    if (elements.explorerProgress) elements.explorerProgress.style.display = '';
    if (elements.explorerGoBtn) elements.explorerGoBtn.style.display = 'none';
    if (elements.explorerStopBtn) elements.explorerStopBtn.style.display = '';

    const percent = data.maxPages > 0 ? Math.round((data.pagesCollected / data.maxPages) * 100) : 0;
    if (elements.explorerProgressFill) elements.explorerProgressFill.style.width = percent + '%';
    if (elements.explorerProgressText) elements.explorerProgressText.textContent = 'Crawling ' + (data.domain || '');
    if (elements.explorerProgressCount) elements.explorerProgressCount.textContent = data.pagesCollected + ' / ' + data.maxPages + ' pages';
    if (elements.explorerCurrentUrl) elements.explorerCurrentUrl.textContent = data.currentUrl || '';
  } else if (data.status === 'completed' || data.status === 'stopped' || data.status === 'error') {
    resetExplorerUI();

    if (data.status === 'completed') {
      showToast('Crawl completed: ' + data.pagesCollected + ' pages collected', 'success');
      addLog('info', 'Site Explorer completed: ' + data.pagesCollected + ' pages from ' + data.domain);
    } else if (data.status === 'error') {
      showToast('Crawl failed', 'error');
    }

    // Refresh research list
    loadResearchList();
  }
}

async function loadResearchList() {
  if (!elements.researchList) return;

  try {
    const response = await chrome.runtime.sendMessage({ action: 'getResearchList' });
    const list = (response && response.list) || [];

    if (list.length === 0) {
      elements.researchList.innerHTML = `
        <div class="session-empty-state">
          <i class="fas fa-flask"></i>
          <p>No research results yet. Use Site Explorer above to crawl a website.</p>
        </div>
      `;
      return;
    }

    elements.researchList.innerHTML = list.map(item => `
      <div class="session-item" data-research-id="${item.id}">
        <div class="session-item-info">
          <div class="session-item-task">${escapeHtml(item.domain || 'Unknown')}</div>
          <div class="session-item-meta">
            <span><i class="fas fa-clock"></i> ${formatSessionDate(item.startTime)}</span>
            <span><i class="fas fa-file-alt"></i> ${item.pageCount || 0} pages</span>
            <span><i class="fas fa-hourglass-half"></i> ${formatSessionDuration(item.startTime, item.endTime)}</span>
          </div>
        </div>
        <div class="session-item-status">
          <span class="session-status-badge ${item.status}">${item.status}</span>
        </div>
        <div class="session-item-actions">
          <button class="session-action-btn view" data-action="view" title="View details">
            <i class="fas fa-eye"></i>
          </button>
          <button class="session-action-btn download" data-action="download" title="Download JSON">
            <i class="fas fa-download"></i>
          </button>
          <button class="session-action-btn delete" data-action="delete" title="Delete">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </div>
    `).join('');

  } catch (error) {
    console.error('Failed to load research list:', error);
    elements.researchList.innerHTML = `
      <div class="session-empty-state">
        <i class="fas fa-exclamation-triangle"></i>
        <p>Failed to load research results: ${error.message}</p>
      </div>
    `;
  }
}

async function viewResearch(researchId) {
  if (!elements.researchList) return;

  const researchItem = elements.researchList.querySelector(`.session-item[data-research-id="${researchId}"]`);
  if (!researchItem) return;

  // Toggle: collapse if already expanded
  const existingDetail = researchItem.querySelector('.research-detail');
  if (existingDetail) {
    existingDetail.remove();
    researchItem.classList.remove('expanded');
    return;
  }

  // Collapse any other expanded items
  elements.researchList.querySelectorAll('.research-detail').forEach(d => d.remove());
  elements.researchList.querySelectorAll('.session-item.expanded').forEach(i => i.classList.remove('expanded'));

  try {
    const response = await chrome.runtime.sendMessage({ action: 'getResearchData', researchId });
    if (!response || !response.success || !response.data) {
      showToast('Research data not found', 'error');
      return;
    }

    const data = response.data;
    const summary = data.summary || {};

    const detailHtml = `
      <div class="research-detail">
        <div class="research-detail-grid">
          <div class="research-stat">
            <div class="research-stat-value">${summary.totalPages || 0}</div>
            <div class="research-stat-label">Pages</div>
          </div>
          <div class="research-stat">
            <div class="research-stat-value">${summary.totalElements || 0}</div>
            <div class="research-stat-label">Elements</div>
          </div>
          <div class="research-stat">
            <div class="research-stat-value">${summary.totalForms || 0}</div>
            <div class="research-stat-label">Forms</div>
          </div>
          <div class="research-stat">
            <div class="research-stat-value">${summary.totalLinks || 0}</div>
            <div class="research-stat-label">Links</div>
          </div>
        </div>
        <div style="font-size: 0.75rem; color: var(--text-muted);">
          <strong>Start URL:</strong> ${escapeHtml(data.startUrl || '')}<br>
          <strong>Duration:</strong> ${formatSessionDuration(data.startTime, data.endTime)}<br>
          <strong>Depth:</strong> ${data.settings?.maxDepth || '?'} | <strong>Status:</strong> ${data.status}
        </div>
        ${data.pages && data.pages.length > 0 ? `
          <details style="margin-top: 0.5rem;">
            <summary style="cursor: pointer; font-size: 0.8125rem; color: var(--text-secondary);">Pages crawled (${data.pages.length})</summary>
            <ul style="margin: 0.25rem 0 0; padding-left: 1.25rem; font-size: 0.75rem; font-family: monospace; color: var(--text-muted); max-height: 200px; overflow-y: auto;">
              ${data.pages.map(p => `<li>${escapeHtml(p.url)} (${p.interactiveElements?.length || 0} elements)</li>`).join('')}
            </ul>
          </details>
        ` : ''}
      </div>
    `;

    researchItem.insertAdjacentHTML('beforeend', detailHtml);
    researchItem.classList.add('expanded');

  } catch (error) {
    console.error('Failed to view research:', error);
    showToast('Failed to load research details', 'error');
  }
}

async function downloadResearch(researchId) {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'getResearchData', researchId });
    if (!response || !response.success || !response.data) {
      showToast('Research data not found', 'error');
      return;
    }

    const data = response.data;
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const date = new Date(data.startTime).toISOString().split('T')[0];
    const filename = `fsb-research-${data.domain || 'unknown'}-${date}.json`;

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast('Research JSON downloaded', 'success');
    addLog('info', 'Downloaded research for ' + (data.domain || researchId));

  } catch (error) {
    console.error('Failed to download research:', error);
    showToast('Failed to download research', 'error');
  }
}

async function deleteResearch(researchId) {
  if (!confirm('Are you sure you want to delete this research result?')) {
    return;
  }

  try {
    await chrome.runtime.sendMessage({ action: 'deleteResearch', researchId });
    loadResearchList();
    showToast('Research deleted', 'success');
    addLog('info', 'Deleted research ' + researchId);
  } catch (error) {
    console.error('Failed to delete research:', error);
    showToast('Failed to delete research', 'error');
  }
}

async function clearAllResearchResults() {
  if (!confirm('Are you sure you want to delete ALL research results? This cannot be undone.')) {
    return;
  }

  try {
    await chrome.storage.local.remove(['fsbResearchData', 'fsbResearchIndex']);
    loadResearchList();
    showToast('All research results cleared', 'success');
    addLog('info', 'All research results cleared');
  } catch (error) {
    console.error('Failed to clear research results:', error);
    showToast('Failed to clear research results', 'error');
  }
}

// ==========================================
// Background Agent Management
// ==========================================

function initializeAgentSection() {
  const btnCreate = document.getElementById('btnCreateAgent');
  const btnRefresh = document.getElementById('btnRefreshAgents');
  const btnClose = document.getElementById('btnCloseAgentForm');
  const btnCancel = document.getElementById('btnCancelAgent');
  const btnSave = document.getElementById('btnSaveAgent');
  const scheduleType = document.getElementById('agentScheduleType');

  if (btnCreate) btnCreate.addEventListener('click', showAgentForm);
  if (btnRefresh) btnRefresh.addEventListener('click', loadAgentList);
  if (btnClose) btnClose.addEventListener('click', hideAgentForm);
  if (btnCancel) btnCancel.addEventListener('click', hideAgentForm);
  if (btnSave) btnSave.addEventListener('click', saveAgent);

  if (scheduleType) {
    scheduleType.addEventListener('change', () => {
      const type = scheduleType.value;
      const intervalGroup = document.getElementById('intervalGroup');
      const dailyGroup = document.getElementById('dailyGroup');
      if (intervalGroup) intervalGroup.style.display = type === 'interval' ? '' : 'none';
      if (dailyGroup) dailyGroup.style.display = type === 'daily' ? '' : 'none';
    });
  }

  // Server sync buttons
  const btnGenerate = document.getElementById('btnGenerateHashKey');
  const btnCopy = document.getElementById('btnCopyHashKey');
  const btnTest = document.getElementById('btnTestConnection');

  if (btnGenerate) btnGenerate.addEventListener('click', generateHashKey);
  if (btnCopy) btnCopy.addEventListener('click', copyHashKey);
  if (btnTest) btnTest.addEventListener('click', testServerConnection);

  // Load server settings
  loadServerSettings();

  // Load agents on section init
  loadAgentList();
  loadAgentStats();

  // Listen for messages from popup/sidepanel and agent run completions
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'agentRunComplete') {
      loadAgentList();
      loadAgentStats();
    }
    if (message.action === 'openAgentForm') {
      document.getElementById('background-agents')?.scrollIntoView({ behavior: 'smooth' });
      showAgentForm();
    }
  });
}

function showAgentForm(editAgent) {
  const form = document.getElementById('agentFormCard');
  const title = document.getElementById('agentFormTitle');
  if (!form) return;

  if (editAgent && typeof editAgent === 'object' && editAgent.agentId) {
    // Edit mode
    title.textContent = 'Edit Agent';
    document.getElementById('agentFormId').value = editAgent.agentId;
    document.getElementById('agentName').value = editAgent.name || '';
    document.getElementById('agentTask').value = editAgent.task || '';
    document.getElementById('agentTargetUrl').value = editAgent.targetUrl || '';
    document.getElementById('agentScheduleType').value = editAgent.schedule?.type || 'interval';
    document.getElementById('agentInterval').value = editAgent.schedule?.intervalMinutes || 30;
    document.getElementById('agentDailyTime').value = editAgent.schedule?.dailyTime || '09:00';
    document.getElementById('agentMaxIterations').value = editAgent.maxIterations || 15;

    // Set replay toggle
    const replayToggle = document.getElementById('agentReplayEnabled');
    if (replayToggle) replayToggle.checked = editAgent.replayEnabled !== false;

    // Set days of week checkboxes
    const daysContainer = document.getElementById('agentDaysOfWeek');
    if (daysContainer) {
      const checkboxes = daysContainer.querySelectorAll('input[type="checkbox"]');
      checkboxes.forEach(cb => {
        cb.checked = (editAgent.schedule?.daysOfWeek || []).includes(parseInt(cb.value));
      });
    }

    // Trigger schedule type change to show/hide fields
    document.getElementById('agentScheduleType').dispatchEvent(new Event('change'));
  } else {
    // Create mode
    title.textContent = 'Create New Agent';
    document.getElementById('agentFormId').value = '';
    document.getElementById('agentName').value = '';
    document.getElementById('agentTask').value = '';
    document.getElementById('agentTargetUrl').value = '';
    document.getElementById('agentScheduleType').value = 'interval';
    document.getElementById('agentInterval').value = 30;
    document.getElementById('agentDailyTime').value = '09:00';
    document.getElementById('agentMaxIterations').value = 15;
    const replayToggleCreate = document.getElementById('agentReplayEnabled');
    if (replayToggleCreate) replayToggleCreate.checked = true;
    document.getElementById('agentScheduleType').dispatchEvent(new Event('change'));
  }

  form.style.display = '';
}

function hideAgentForm() {
  const form = document.getElementById('agentFormCard');
  if (form) form.style.display = 'none';
}

async function saveAgent() {
  const agentId = document.getElementById('agentFormId').value;
  const name = document.getElementById('agentName').value.trim();
  const task = document.getElementById('agentTask').value.trim();
  const targetUrl = document.getElementById('agentTargetUrl').value.trim();
  const scheduleType = document.getElementById('agentScheduleType').value;
  const intervalMinutes = parseInt(document.getElementById('agentInterval').value) || 30;
  const dailyTime = document.getElementById('agentDailyTime').value;
  const maxIterations = parseInt(document.getElementById('agentMaxIterations').value) || 15;

  if (!name || !task || !targetUrl) {
    showToast('Please fill in all required fields', 'error');
    return;
  }

  // Build schedule
  const schedule = { type: scheduleType };
  if (scheduleType === 'interval') {
    schedule.intervalMinutes = Math.max(1, intervalMinutes);
  } else if (scheduleType === 'daily') {
    schedule.dailyTime = dailyTime;
    const daysContainer = document.getElementById('agentDaysOfWeek');
    if (daysContainer) {
      const checked = Array.from(daysContainer.querySelectorAll('input:checked')).map(cb => parseInt(cb.value));
      if (checked.length > 0) {
        schedule.daysOfWeek = checked;
      }
    }
  }

  const replayEnabled = document.getElementById('agentReplayEnabled')?.checked !== false;

  const action = agentId ? 'updateAgent' : 'createAgent';
  const payload = agentId
    ? { action, agentId, updates: { name, task, targetUrl, schedule, maxIterations, replayEnabled } }
    : { action, params: { name, task, targetUrl, schedule, maxIterations, replayEnabled } };

  try {
    const response = await new Promise((resolve) => {
      chrome.runtime.sendMessage(payload, resolve);
    });

    if (response.success) {
      showToast(agentId ? 'Agent updated' : 'Agent created', 'success');
      hideAgentForm();
      loadAgentList();
      loadAgentStats();
    } else {
      showToast('Error: ' + (response.error || 'Unknown error'), 'error');
    }
  } catch (error) {
    showToast('Error: ' + error.message, 'error');
  }
}

async function loadAgentList() {
  try {
    const response = await new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: 'listAgents' }, resolve);
    });

    const list = document.getElementById('agentList');
    const emptyState = document.getElementById('agentEmptyState');
    if (!list) return;

    // Remove existing agent cards (keep empty state)
    list.querySelectorAll('.agent-card').forEach(card => card.remove());

    const agents = response?.agents || [];

    if (agents.length === 0) {
      if (emptyState) emptyState.style.display = '';
      return;
    }

    if (emptyState) emptyState.style.display = 'none';

    for (const agent of agents) {
      const card = createAgentCard(agent);
      list.appendChild(card);
    }
  } catch (error) {
    console.error('Failed to load agents:', error);
  }
}

function createAgentCard(agent) {
  const card = document.createElement('div');
  card.className = 'agent-card';
  card.dataset.agentId = agent.agentId;

  const statusClass = agent.enabled ? 'active' : 'disabled';
  const statusText = agent.enabled ? 'Active' : 'Disabled';
  const lastRun = agent.lastRunAt ? formatTimeAgo(agent.lastRunAt) : 'Never';
  const scheduleText = formatSchedule(agent.schedule);

  // Replay info
  const hasScript = agent.recordedScript && agent.recordedScript.steps && agent.recordedScript.steps.length > 0;
  const replayEnabled = agent.replayEnabled !== false;
  const replayBadgeClass = hasScript ? 'active' : 'inactive';
  const replayBadgeText = hasScript
    ? 'Replay Ready - ' + agent.recordedScript.totalSteps + ' steps'
    : 'No Script';
  const replayStats = agent.replayStats || { totalReplays: 0, estimatedCostSaved: 0 };
  const costSavedText = replayStats.estimatedCostSaved > 0
    ? '$' + replayStats.estimatedCostSaved.toFixed(4)
    : '$0';

  card.innerHTML = `
    <div class="agent-card-header">
      <div class="agent-card-info">
        <h4 class="agent-card-name">${escapeHtml(agent.name)}</h4>
        <span class="agent-status-badge ${statusClass}">${statusText}</span>
      </div>
      <label class="toggle-switch small">
        <input type="checkbox" class="agent-toggle" data-agent-id="${agent.agentId}" ${agent.enabled ? 'checked' : ''}>
        <span class="toggle-slider"></span>
      </label>
    </div>
    <div class="agent-card-body">
      <div class="agent-card-detail">
        <span class="agent-detail-label">Task:</span>
        <span class="agent-detail-value">${escapeHtml(agent.task.substring(0, 100))}${agent.task.length > 100 ? '...' : ''}</span>
      </div>
      <div class="agent-card-detail">
        <span class="agent-detail-label">URL:</span>
        <span class="agent-detail-value">${escapeHtml(agent.targetUrl)}</span>
      </div>
      <div class="agent-card-detail">
        <span class="agent-detail-label">Schedule:</span>
        <span class="agent-detail-value">${scheduleText}</span>
      </div>
      <div class="agent-card-replay">
        <span class="replay-badge ${replayBadgeClass}">${replayBadgeText}</span>
        ${replayStats.totalReplays > 0 ? `<span class="replay-count">${replayStats.totalReplays} replays</span>` : ''}
        ${replayStats.estimatedCostSaved > 0 ? `<span class="cost-saved">${costSavedText} saved</span>` : ''}
        ${hasScript ? `<button class="control-btn tiny agent-rerecord-btn" data-agent-id="${agent.agentId}" title="Clear script and re-record on next run">Re-record</button>` : ''}
      </div>
      <div class="agent-card-meta">
        <span>Last run: ${lastRun}</span>
        <span>Runs: ${agent.runCount}</span>
        ${agent.lastRunStatus ? `<span class="run-status-${agent.lastRunStatus}">${agent.lastRunStatus}</span>` : ''}
      </div>
    </div>
    <div class="agent-card-actions">
      <button class="control-btn small agent-run-btn" data-agent-id="${agent.agentId}">
        <i class="fas fa-play"></i> Run Now
      </button>
      <button class="control-btn small agent-edit-btn" data-agent-id="${agent.agentId}">
        <i class="fas fa-edit"></i> Edit
      </button>
      <button class="control-btn small danger agent-delete-btn" data-agent-id="${agent.agentId}">
        <i class="fas fa-trash"></i> Delete
      </button>
      <button class="control-btn small agent-history-btn" data-agent-id="${agent.agentId}">
        <i class="fas fa-history"></i> History
      </button>
    </div>
    <div class="agent-run-history" id="history-${agent.agentId}" style="display: none;"></div>
  `;

  // Toggle handler
  const toggle = card.querySelector('.agent-toggle');
  if (toggle) {
    toggle.addEventListener('change', () => toggleAgent(agent.agentId));
  }

  // Run now
  const runBtn = card.querySelector('.agent-run-btn');
  if (runBtn) {
    runBtn.addEventListener('click', () => runAgentNow(agent.agentId));
  }

  // Edit
  const editBtn = card.querySelector('.agent-edit-btn');
  if (editBtn) {
    editBtn.addEventListener('click', async () => {
      const response = await new Promise(resolve => {
        chrome.runtime.sendMessage({ action: 'listAgents' }, resolve);
      });
      const fresh = (response?.agents || []).find(a => a.agentId === agent.agentId);
      if (fresh) showAgentForm(fresh);
    });
  }

  // Delete
  const deleteBtn = card.querySelector('.agent-delete-btn');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', () => deleteAgent(agent.agentId, agent.name));
  }

  // History toggle
  const historyBtn = card.querySelector('.agent-history-btn');
  if (historyBtn) {
    historyBtn.addEventListener('click', () => toggleAgentHistory(agent.agentId));
  }

  // Re-record button (clear script)
  const rerecordBtn = card.querySelector('.agent-rerecord-btn');
  if (rerecordBtn) {
    rerecordBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!confirm('Clear the recorded script for "' + agent.name + '"? The next run will use AI to re-record.')) return;
      try {
        const response = await new Promise(resolve => {
          chrome.runtime.sendMessage({ action: 'clearAgentScript', agentId: agent.agentId }, resolve);
        });
        if (response.success) {
          showToast('Script cleared - next run will use AI', 'success');
          loadAgentList();
        } else {
          showToast('Error: ' + (response.error || 'Failed to clear script'), 'error');
        }
      } catch (error) {
        showToast('Error: ' + error.message, 'error');
      }
    });
  }

  return card;
}

async function toggleAgent(agentId) {
  try {
    const response = await new Promise(resolve => {
      chrome.runtime.sendMessage({ action: 'toggleAgent', agentId }, resolve);
    });
    if (response.success) {
      loadAgentList();
      loadAgentStats();
    } else {
      showToast('Error: ' + (response.error || 'Failed to toggle agent'), 'error');
    }
  } catch (error) {
    showToast('Error: ' + error.message, 'error');
  }
}

async function runAgentNow(agentId) {
  showToast('Starting agent run...', 'info');
  try {
    const response = await new Promise(resolve => {
      chrome.runtime.sendMessage({ action: 'runAgentNow', agentId }, resolve);
    });
    if (response.success) {
      showToast('Agent execution started', 'success');
    } else {
      showToast('Error: ' + (response.error || 'Failed to start agent'), 'error');
    }
  } catch (error) {
    showToast('Error: ' + error.message, 'error');
  }
}

async function deleteAgent(agentId, name) {
  if (!confirm('Delete agent "' + name + '"? This cannot be undone.')) return;

  try {
    const response = await new Promise(resolve => {
      chrome.runtime.sendMessage({ action: 'deleteAgent', agentId }, resolve);
    });
    if (response.success) {
      showToast('Agent deleted', 'success');
      loadAgentList();
      loadAgentStats();
    } else {
      showToast('Error: ' + (response.error || 'Failed to delete agent'), 'error');
    }
  } catch (error) {
    showToast('Error: ' + error.message, 'error');
  }
}

async function toggleAgentHistory(agentId) {
  const container = document.getElementById('history-' + agentId);
  if (!container) return;

  if (container.style.display !== 'none') {
    container.style.display = 'none';
    return;
  }

  try {
    const response = await new Promise(resolve => {
      chrome.runtime.sendMessage({ action: 'getAgentRunHistory', agentId, limit: 10 }, resolve);
    });

    const history = response?.history || [];
    if (history.length === 0) {
      container.innerHTML = '<div class="history-empty">No run history yet.</div>';
    } else {
      container.innerHTML = history.map(run => {
        const mode = run.executionMode || 'ai_initial';
        let modeBadge = '';
        if (mode === 'replay') {
          modeBadge = '<span class="mode-badge replay">Replay</span>';
        } else if (mode === 'ai_fallback') {
          modeBadge = '<span class="mode-badge fallback">AI Fallback</span>';
        } else {
          modeBadge = '<span class="mode-badge ai">AI</span>';
        }
        const costSavedInfo = run.costSaved > 0
          ? '<span class="cost-saved">$' + run.costSaved.toFixed(4) + ' saved</span>'
          : '';
        return `
          <div class="history-entry ${run.success ? 'success' : 'failed'}">
            <div class="history-entry-header">
              <span class="history-status">${run.success ? 'Success' : 'Failed'}</span>
              ${modeBadge}
              <span class="history-time">${new Date(run.timestamp).toLocaleString()}</span>
              <span class="history-duration">${formatDuration(run.duration)}</span>
              ${costSavedInfo}
            </div>
            <div class="history-entry-body">
              ${run.result ? '<p>' + escapeHtml(run.result.substring(0, 200)) + '</p>' : ''}
              ${run.error ? '<p class="history-error">' + escapeHtml(run.error.substring(0, 200)) + '</p>' : ''}
              <span class="history-iterations">${run.iterations || 0} iterations</span>
              ${run.replayFailedAtStep != null ? '<span class="history-replay-fail">Replay failed at step ' + run.replayFailedAtStep + '</span>' : ''}
            </div>
          </div>
        `;
      }).join('');
    }

    container.style.display = '';
  } catch (error) {
    container.innerHTML = '<div class="history-empty">Failed to load history.</div>';
    container.style.display = '';
  }
}

async function loadAgentStats() {
  try {
    const response = await new Promise(resolve => {
      chrome.runtime.sendMessage({ action: 'getAgentStats' }, resolve);
    });

    const stats = response?.stats;
    if (!stats) return;

    const el = (id) => document.getElementById(id);
    if (el('statTotalAgents')) el('statTotalAgents').textContent = stats.totalAgents;
    if (el('statEnabledAgents')) el('statEnabledAgents').textContent = stats.enabledAgents;
    if (el('statRunsToday')) el('statRunsToday').textContent = stats.runsToday;
    if (el('statSuccessRate')) el('statSuccessRate').textContent = stats.totalRuns > 0 ? stats.successRate + '%' : '--';
    if (el('statTotalCost')) el('statTotalCost').textContent = '$' + stats.totalCost.toFixed(4);
    if (el('statReplayRuns')) el('statReplayRuns').textContent = stats.totalReplayRuns || 0;
    if (el('statCostSaved')) el('statCostSaved').textContent = '$' + (stats.totalCostSaved || 0).toFixed(4);
  } catch (error) {
    console.error('Failed to load agent stats:', error);
  }
}

function formatSchedule(schedule) {
  if (!schedule) return 'Not set';
  switch (schedule.type) {
    case 'interval':
      const mins = schedule.intervalMinutes || 1;
      if (mins >= 60) return 'Every ' + (mins / 60) + ' hour' + (mins >= 120 ? 's' : '');
      return 'Every ' + mins + ' minute' + (mins > 1 ? 's' : '');
    case 'daily':
      const days = schedule.daysOfWeek;
      const time = schedule.dailyTime || '09:00';
      if (days && days.length > 0 && days.length < 7) {
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        return 'Daily at ' + time + ' (' + days.map(d => dayNames[d]).join(', ') + ')';
      }
      return 'Daily at ' + time;
    case 'once':
      return 'Run once';
    default:
      return schedule.type;
  }
}

function formatTimeAgo(timestamp) {
  const diff = Date.now() - timestamp;
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
  if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
  return Math.floor(diff / 86400000) + 'd ago';
}

function formatDuration(ms) {
  if (!ms) return '--';
  if (ms < 1000) return ms + 'ms';
  if (ms < 60000) return (ms / 1000).toFixed(1) + 's';
  return Math.floor(ms / 60000) + 'm ' + Math.floor((ms % 60000) / 1000) + 's';
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Server sync functions
async function loadServerSettings() {
  try {
    const stored = await chrome.storage.local.get(['serverUrl', 'serverHashKey']);
    const urlInput = document.getElementById('serverUrl');
    const keyInput = document.getElementById('serverHashKey');
    if (urlInput && stored.serverUrl) urlInput.value = stored.serverUrl;
    if (keyInput && stored.serverHashKey) keyInput.value = stored.serverHashKey;
  } catch (e) {
    // Ignore
  }
}

async function generateHashKey() {
  const serverUrl = document.getElementById('serverUrl')?.value?.trim();
  if (!serverUrl) {
    showToast('Please enter a server URL first', 'error');
    return;
  }

  try {
    const resp = await fetch(serverUrl + '/api/auth/register', { method: 'POST' });
    const data = await resp.json();
    if (data.hashKey) {
      document.getElementById('serverHashKey').value = data.hashKey;
      await chrome.storage.local.set({ serverUrl, serverHashKey: data.hashKey });
      showToast('Hash key generated and saved', 'success');
    } else {
      showToast('Failed to generate hash key', 'error');
    }
  } catch (error) {
    showToast('Cannot connect to server: ' + error.message, 'error');
  }
}

async function copyHashKey() {
  const key = document.getElementById('serverHashKey')?.value;
  if (!key) {
    showToast('No hash key to copy', 'error');
    return;
  }
  try {
    await navigator.clipboard.writeText(key);
    showToast('Hash key copied', 'success');
  } catch (error) {
    showToast('Failed to copy', 'error');
  }
}

async function testServerConnection() {
  const serverUrl = document.getElementById('serverUrl')?.value?.trim();
  const hashKey = document.getElementById('serverHashKey')?.value?.trim();
  const statusEl = document.getElementById('connectionStatus');

  if (!serverUrl || !hashKey) {
    showToast('Please enter server URL and hash key', 'error');
    return;
  }

  if (statusEl) statusEl.textContent = 'Testing...';

  try {
    const resp = await fetch(serverUrl + '/api/auth/validate', {
      headers: { 'X-FSB-Hash-Key': hashKey }
    });
    const data = await resp.json();
    if (data.valid) {
      if (statusEl) statusEl.textContent = 'Connected';
      if (statusEl) statusEl.className = 'connection-status connected';
      showToast('Server connection successful', 'success');
    } else {
      if (statusEl) statusEl.textContent = 'Invalid key';
      if (statusEl) statusEl.className = 'connection-status error';
      showToast('Hash key is invalid', 'error');
    }
  } catch (error) {
    if (statusEl) statusEl.textContent = 'Failed';
    if (statusEl) statusEl.className = 'connection-status error';
    showToast('Cannot connect to server', 'error');
  }
}

// ===== Memory Dashboard =====

let memorySearchDebounce = null;

function initializeMemorySection() {
  const refreshBtn = document.getElementById('btnRefreshMemories');
  const consolidateBtn = document.getElementById('btnConsolidateMemories');
  const exportBtn = document.getElementById('btnExportMemories');
  const clearBtn = document.getElementById('btnClearMemories');
  const searchInput = document.getElementById('memorySearchInput');
  const typeFilter = document.getElementById('memoryTypeFilter');

  if (refreshBtn) refreshBtn.addEventListener('click', loadMemoryDashboard);
  if (consolidateBtn) consolidateBtn.addEventListener('click', consolidateMemories);
  if (exportBtn) exportBtn.addEventListener('click', exportMemories);
  if (clearBtn) clearBtn.addEventListener('click', clearAllMemories);

  if (searchInput) {
    searchInput.addEventListener('input', () => {
      clearTimeout(memorySearchDebounce);
      memorySearchDebounce = setTimeout(() => searchMemories(), 300);
    });
  }

  if (typeFilter) {
    typeFilter.addEventListener('change', () => searchMemories());
  }

  loadMemoryDashboard();
}

async function loadMemoryDashboard() {
  try {
    if (typeof memoryManager === 'undefined') return;

    const stats = await memoryManager.getStats();
    updateMemoryStats(stats);

    const memories = await memoryManager.getAll();
    renderMemoryList(memories);
  } catch (error) {
    console.error('[Options] Failed to load memory dashboard:', error);
  }
}

function updateMemoryStats(stats) {
  const el = (id, val) => {
    const e = document.getElementById(id);
    if (e) e.textContent = val;
  };

  el('memStatTotal', stats.totalCount);
  el('memStatEpisodic', stats.byType?.episodic || 0);
  el('memStatSemantic', stats.byType?.semantic || 0);
  el('memStatProcedural', stats.byType?.procedural || 0);

  const kb = Math.round(stats.estimatedBytes / 1024);
  el('memStatStorage', kb > 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`);
  el('memStatUtilization', `${stats.utilizationPercent}%`);
}

function renderMemoryList(memories) {
  const container = document.getElementById('memoryList');
  const emptyState = document.getElementById('memoryEmptyState');
  if (!container) return;

  if (memories.length === 0) {
    container.innerHTML = '';
    if (emptyState) {
      container.appendChild(emptyState);
      emptyState.style.display = '';
    }
    return;
  }

  if (emptyState) emptyState.style.display = 'none';

  // Sort by most recently accessed
  const sorted = [...memories].sort((a, b) => b.lastAccessedAt - a.lastAccessedAt);

  container.innerHTML = sorted.map(memory => {
    const typeIcon = {
      episodic: 'fa-clock',
      semantic: 'fa-lightbulb',
      procedural: 'fa-list-ol'
    }[memory.type] || 'fa-circle';

    const typeLabel = memory.type.charAt(0).toUpperCase() + memory.type.slice(1);
    const domain = memory.metadata?.domain || 'Unknown';
    const age = formatTimeAgo(memory.createdAt);
    const accesses = memory.accessCount || 0;
    const confidence = Math.round((memory.metadata?.confidence || 0) * 100);
    const tags = (memory.metadata?.tags || []).slice(0, 3).join(', ');

    return `
      <div class="session-item memory-item" data-memory-id="${memory.id}">
        <div class="session-item-header" style="display: flex; align-items: center; gap: 10px;">
          <i class="fas ${typeIcon}" style="color: var(--primary); font-size: 1.1em;" title="${typeLabel}"></i>
          <div style="flex: 1; min-width: 0;">
            <div style="font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
              ${escapeHtml(memory.text)}
            </div>
            <div style="font-size: 0.82em; color: var(--text-secondary); margin-top: 2px;">
              ${typeLabel} | ${escapeHtml(domain)} | ${age} | ${accesses} accesses | ${confidence}% conf${tags ? ' | ' + escapeHtml(tags) : ''}
            </div>
          </div>
          <button class="control-btn small memory-delete-btn" data-id="${memory.id}" title="Delete memory" style="color: var(--danger, #ef4444); flex-shrink: 0;">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </div>
    `;
  }).join('');

  // Attach delete handlers
  container.querySelectorAll('.memory-delete-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      if (confirm('Delete this memory?')) {
        await memoryManager.delete(id);
        loadMemoryDashboard();
        showToast('Memory deleted', 'info');
      }
    });
  });
}

async function searchMemories() {
  if (typeof memoryManager === 'undefined') return;

  const query = document.getElementById('memorySearchInput')?.value || '';
  const type = document.getElementById('memoryTypeFilter')?.value || '';

  try {
    let results;
    if (query.trim()) {
      const filters = {};
      if (type) filters.type = type;
      results = await memoryManager.search(query, filters, { topN: 50, minScore: 0.05 });
    } else {
      results = await memoryManager.getAll();
      if (type) {
        results = results.filter(m => m.type === type);
      }
    }
    renderMemoryList(results);
  } catch (error) {
    console.error('[Options] Memory search failed:', error);
  }
}

async function consolidateMemories() {
  if (typeof memoryManager === 'undefined') return;

  try {
    showToast('Consolidating memories...', 'info');
    const result = await memoryManager.consolidate();
    showToast(`Consolidated: ${result.merged} merged, ${result.deleted} removed, ${result.total} remaining`, 'success');
    loadMemoryDashboard();
  } catch (error) {
    showToast('Consolidation failed: ' + error.message, 'error');
  }
}

async function exportMemories() {
  if (typeof memoryManager === 'undefined') return;

  try {
    const memories = await memoryManager.getAll();
    const blob = new Blob([JSON.stringify(memories, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fsb-memories-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Memories exported', 'success');
  } catch (error) {
    showToast('Export failed: ' + error.message, 'error');
  }
}

async function clearAllMemories() {
  if (typeof memoryManager === 'undefined') return;

  if (!confirm('Delete ALL memories? This cannot be undone.')) return;

  try {
    await memoryManager.deleteAll();
    loadMemoryDashboard();
    showToast('All memories cleared', 'info');
  } catch (error) {
    showToast('Failed to clear memories: ' + error.message, 'error');
  }
}

// Initialize agent section and memory section when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(initializeAgentSection, 300);
  setTimeout(initializeMemorySection, 400);
});


// Export for potential use by other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    dashboardState,
    switchSection,
    addLog,
    showToast,
    loadSessionList,
    viewSession,
    deleteSession
  };
}