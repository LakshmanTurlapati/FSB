// FSB v0.9 - Modern Dashboard Control Panel Script

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
    { id: 'grok-4-1-fast', name: 'Grok 4.1 Fast', description: 'High-speed, 2M context - best for automation (Recommended)' },
    { id: 'grok-4-1-fast-reasoning', name: 'Grok 4.1 Fast Reasoning', description: 'With multi-step reasoning enabled' },
    { id: 'grok-4', name: 'Grok 4', description: 'Complex reasoning model' },
    { id: 'grok-code-fast-1', name: 'Grok Code Fast 1', description: 'Dedicated code generation & debugging' },
    { id: 'grok-3', name: 'Grok 3', description: 'Legacy flagship model' },
    { id: 'grok-3-mini', name: 'Grok 3 Mini', description: 'Budget option with reasoning' }
  ],
  gemini: [
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', description: 'Latest with thinking capabilities' },
    { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash-Lite', description: 'Budget option with 1M context' },
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', description: 'Most powerful with 2M context' },
    { id: 'gemini-2.0-flash-exp', name: 'Gemini 2.0 Flash Experimental', description: 'FREE experimental until May 2025' },
    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', description: 'Fast and efficient' }
  ],
  openai: [
    { id: 'gpt-4o', name: 'GPT-4o', description: 'Most capable multimodal model' },
    { id: 'chatgpt-4o-latest', name: 'ChatGPT-4o Latest', description: 'Always newest GPT-4o version' },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: 'Affordable and fast, better than GPT-3.5' },
    { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', description: 'Previous generation flagship' }
  ],
  anthropic: [
    { id: 'claude-sonnet-4-5', name: 'Claude Sonnet 4.5', description: 'Latest flagship model with 200K context' },
    { id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5', description: 'Fast and cost-effective with 200K context' },
    { id: 'claude-opus-4-1', name: 'Claude Opus 4.1', description: 'Most powerful reasoning model' },
    { id: 'claude-sonnet-4', name: 'Claude Sonnet 4', description: 'Previous Sonnet version' },
    { id: 'claude-opus-4', name: 'Claude Opus 4', description: 'Previous Opus version' },
    { id: 'claude-sonnet-3.7', name: 'Claude Sonnet 3.7', description: 'Extended thinking variant' }
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
  
  // DOM optimization controls
  const domOptControls = [
    document.getElementById('domOptimization'),
    document.getElementById('prioritizeViewport'),
    document.getElementById('maxDOMElements'),
    document.getElementById('maxDOMElementsSlider')
  ];
  
  domOptControls.forEach(control => {
    if (control) {
      const eventType = control.type === 'checkbox' ? 'change' : 'input';
      control.addEventListener(eventType, () => markUnsavedChanges());
    }
  });
  
  // DOM elements slider synchronization
  const maxDOMElementsSlider = document.getElementById('maxDOMElementsSlider');
  const maxDOMElements = document.getElementById('maxDOMElements');
  
  if (maxDOMElementsSlider && maxDOMElements) {
    maxDOMElementsSlider.addEventListener('input', (e) => {
      maxDOMElements.value = e.target.value;
      markUnsavedChanges();
    });
    
    maxDOMElements.addEventListener('input', (e) => {
      maxDOMElementsSlider.value = e.target.value;
      markUnsavedChanges();
    });
  }
  
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
    elements.modelName.addEventListener('change', (e) => {
      // Update reasoning effort visibility when model changes
      const provider = elements.modelProvider?.value || 'xai';
      updateApiKeyVisibility(provider, e.target.value);
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

// Models that support the reasoning effort parameter
// Keep in sync with universal-provider.js supportsReasoningEffort()
const REASONING_EFFORT_MODELS = ['grok-4'];

// Update API key visibility based on provider
function updateApiKeyVisibility(provider, modelName = null) {
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

  // Get current model if not provided
  const currentModel = modelName || elements.modelName?.value;

  // Show/hide reasoning effort only for models that support it
  const reasoningEffortGroup = document.getElementById('reasoningEffortGroup');
  if (reasoningEffortGroup) {
    const showReasoning = provider === 'xai' && REASONING_EFFORT_MODELS.includes(currentModel);
    reasoningEffortGroup.style.display = showReasoning ? 'block' : 'none';
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
        // Update reasoning effort visibility based on selected model
        updateApiKeyVisibility(settings.modelProvider || 'xai', settings.modelName);
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
    
    // Update DOM optimization settings
    if (document.getElementById('domOptimization')) {
      document.getElementById('domOptimization').checked = settings.domOptimization ?? true;
    }
    if (document.getElementById('maxDOMElements')) {
      document.getElementById('maxDOMElements').value = settings.maxDOMElements || 2000;
    }
    if (document.getElementById('maxDOMElementsSlider')) {
      document.getElementById('maxDOMElementsSlider').value = settings.maxDOMElements || 2000;
    }
    if (document.getElementById('prioritizeViewport')) {
      document.getElementById('prioritizeViewport').checked = settings.prioritizeViewport ?? true;
    }
    
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
    modelName: elements.modelName?.value || 'grok-4-1-fast',
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
    debugMode: elements.debugMode?.checked ?? false,
    // DOM Optimization settings
    domOptimization: document.getElementById('domOptimization')?.checked ?? true,
    maxDOMElements: parseInt(document.getElementById('maxDOMElements')?.value) || 2000,
    prioritizeViewport: document.getElementById('prioritizeViewport')?.checked ?? true
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
        <strong>Provider:</strong> ${providerInfo.name}
      </div>
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

function updateFooterLogo(theme) {
  const footerLogo = document.getElementById('footer-logo-img');
  if (footerLogo) {
    const logoSrc = theme === 'light'
      ? 'Assets/fsb_logo_light_footer.png'
      : 'Assets/fsb_logo_dark_footer.png';
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

/**
 * Initialize session history UI and event listeners
 */
function initializeSessionHistory() {
  // Cache elements
  const refreshBtn = document.getElementById('refreshSessions');
  const clearAllBtn = document.getElementById('clearAllSessions');
  const downloadBtn = document.getElementById('downloadSessionLogs');
  const closeBtn = document.getElementById('closeSessionDetail');

  // Event listeners
  if (refreshBtn) {
    refreshBtn.addEventListener('click', loadSessionList);
  }

  if (clearAllBtn) {
    clearAllBtn.addEventListener('click', clearAllSessions);
  }

  if (downloadBtn) {
    downloadBtn.addEventListener('click', downloadCurrentSessionLogs);
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', closeSessionDetail);
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

    // Render session items
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
          <button class="session-action-btn view" title="View logs" onclick="viewSession('${session.id}')">
            <i class="fas fa-eye"></i>
          </button>
          <button class="session-action-btn download" title="Download logs" onclick="downloadSessionLogs('${session.id}')">
            <i class="fas fa-download"></i>
          </button>
          <button class="session-action-btn delete" title="Delete session" onclick="deleteSession('${session.id}')">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </div>
    `).join('');

    // Add click listeners for session items (for viewing)
    sessionList.querySelectorAll('.session-item').forEach(item => {
      item.addEventListener('click', (e) => {
        // Don't trigger if clicking action buttons
        if (e.target.closest('.session-item-actions')) return;
        const sessionId = item.dataset.sessionId;
        viewSession(sessionId);
      });
    });

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
  const detailPanel = document.getElementById('sessionDetailPanel');
  const titleEl = document.getElementById('sessionDetailTitle');
  const statusEl = document.getElementById('sessionDetailStatus');
  const metaEl = document.getElementById('sessionDetailMeta');
  const logsEl = document.getElementById('sessionLogsContent');

  if (!detailPanel) return;

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

    // Update header
    titleEl.textContent = session.task || 'Unknown Task';
    statusEl.textContent = session.status;
    statusEl.className = `session-detail-status session-status-badge ${session.status}`;

    // Update metadata
    metaEl.innerHTML = `
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
    `;

    // Format and display logs
    logsEl.textContent = formatSessionLogsForDisplay(session);

    // Show panel
    detailPanel.style.display = 'block';
    detailPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });

    addLog('info', `Viewing session ${sessionId}`);

  } catch (error) {
    console.error('Failed to view session:', error);
    showToast('Failed to load session details', 'error');
  }
}

/**
 * Close the session detail panel
 */
function closeSessionDetail() {
  const detailPanel = document.getElementById('sessionDetailPanel');
  if (detailPanel) {
    detailPanel.style.display = 'none';
  }
  currentViewingSession = null;
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
 * Download logs for a specific session as a text file
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

    // Generate formatted report
    const report = formatSessionReport(session);

    // Create download
    const blob = new Blob([report], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const timestamp = new Date(session.startTime).toISOString().split('T')[0];
    const filename = `fsb-session-${timestamp}-${sessionId.replace('session_', '')}.txt`;

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast('Session logs downloaded', 'success');
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

// Expose session management functions to global scope for inline onclick handlers
window.viewSession = viewSession;
window.downloadSessionLogs = downloadSessionLogs;
window.deleteSession = deleteSession;

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

// Initialize session history when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  // Delay initialization to ensure all elements are ready
  setTimeout(initializeSessionHistory, 500);
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