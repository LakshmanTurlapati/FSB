// FSB v0.9.8.1 - Modern Dashboard Control Panel Script

// Default settings
const defaultSettings = {
  modelProvider: 'xai',
  modelName: 'grok-4-1-fast-reasoning',
  apiKey: '',
  geminiApiKey: '',
  openaiApiKey: '',
  anthropicApiKey: '',
  openrouterApiKey: '',
  customApiKey: '',
  customEndpoint: '',
  speedMode: 'normal', // Legacy support
  maxIterations: 20,
  debugMode: false,
  // DOM Optimization settings
  domOptimization: true,
  maxDOMElements: 2000,
  elementCacheSize: 200,
  prioritizeViewport: true,
  animatedActionHighlights: true,
  showSidepanelProgress: false,
  // Credential Manager (Beta)
  enableLogin: false,
  // CAPTCHA Solver
  captchaSolverEnabled: false,
  captchaApiKey: '',
  autoRefineSiteMaps: true,
  sttProvider: 'browser'
};

// Available models - sourced from config.js (loaded before this script) with custom provider added
const availableModels = {
  ...config.availableModels,
  custom: [
    { id: 'custom-model', name: 'Custom Model', description: 'Enter your model name below' }
  ]
};

const PROVIDER_ICONS = {
  xai: '<svg width="18" height="18" viewBox="3 9 908 1007" fill="currentColor"><path d="M827.76 200.32L745.02 318.5l-.01 348.75L745 1016h166.002l-.251-466.93-.251-466.93-82.74 118.18"/><path d="M3.167 365.816c.183.449 102.641 146.926 227.684 325.505l227.35 324.689 100.486-.255 100.485-.255-227.675-325.25L203.822 365H103.328c-55.272 0-100.345.367-100.161.816"/><path d="M801 8.787l-93.5.286-174 248.569c-95.7 136.713-174.388 249.381-174.863 250.374-.686 1.436 9.177 16.156 48.345 72.144 27.065 38.687 49.728 70.88 50.363 71.54 1.033 1.073 37.65-50.44 128.994-181.471 2.112-3.029 54.285-77.557 115.941-165.618C763.937 216.55 815.619 142.7 817.13 140.5c1.51-2.2 22.768-32.575 47.238-67.5L908.86 9.5l-7.18-.5c-3.949-.275-49.255-.371-100.68-.213"/><path d="M103.273 872.277L3.047 1015.5l100.726.21 100.727.21 45.206-64.71c24.864-35.591 47.462-67.909 50.219-71.819l5.013-7.109-49.972-71.391c-27.484-39.265-50.308-71.491-50.719-71.614-.411-.122-45.849 64.228-100.974 143"/></svg>',
  gemini: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M11.04 19.32Q12 21.51 12 24q0-2.49.93-4.68.96-2.19 2.58-3.81t3.81-2.55Q21.51 12 24 12q-2.49 0-4.68-.93a12.3 12.3 0 0 1-3.81-2.58 12.3 12.3 0 0 1-2.58-3.81Q12 2.49 12 0q0 2.49-.96 4.68-.93 2.19-2.55 3.81a12.3 12.3 0 0 1-3.81 2.58Q2.49 12 0 12q2.49 0 4.68.96 2.19.93 3.81 2.55t2.55 3.81"/></svg>',
  openai: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z"/></svg>',
  anthropic: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.3041 3.541h-3.6718l6.696 16.918H24Zm-10.6082 0L0 20.459h3.7442l1.3693-3.5527h7.0052l1.3693 3.5528h3.7442L10.5363 3.5409Zm-.3712 10.2232 2.2914-5.9456 2.2914 5.9456Z"/></svg>',
  openrouter: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M16.778 1.844v1.919q-.569-.026-1.138-.032-.708-.008-1.415.037c-1.93.126-4.023.728-6.149 2.237-2.911 2.066-2.731 1.95-4.14 2.75-.396.223-1.342.574-2.185.798-.841.225-1.753.333-1.751.333v4.229s.768.108 1.61.333c.842.224 1.789.575 2.185.799 1.41.798 1.228.683 4.14 2.75 2.126 1.509 4.22 2.11 6.148 2.236.88.058 1.716.041 2.555.005v1.918l7.222-4.168-7.222-4.17v2.176c-.86.038-1.611.065-2.278.021-1.364-.09-2.417-.357-3.979-1.465-2.244-1.593-2.866-2.027-3.68-2.508.889-.518 1.449-.906 3.822-2.59 1.56-1.109 2.614-1.377 3.978-1.466.667-.044 1.418-.017 2.278.02v2.176L24 6.014Z"/></svg>',
  custom: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 15.5A3.5 3.5 0 018.5 12 3.5 3.5 0 0112 8.5a3.5 3.5 0 013.5 3.5 3.5 3.5 0 01-3.5 3.5m7.43-2.53c.04-.32.07-.64.07-.97s-.03-.66-.07-1l2.11-1.65a.5.5 0 00.12-.64l-2-3.46a.5.5 0 00-.61-.22l-2.49 1a7.05 7.05 0 00-1.69-1l-.38-2.65A.49.49 0 0014 2h-4a.49.49 0 00-.49.42l-.38 2.65a7.05 7.05 0 00-1.69 1l-2.49-1a.5.5 0 00-.61.22l-2 3.46a.5.5 0 00.12.64L4.57 11c-.04.34-.07.66-.07 1s.03.65.07.97l-2.11 1.65a.5.5 0 00-.12.64l2 3.46a.5.5 0 00.61.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.05.24.26.42.49.42h4c.24 0 .44-.18.49-.42l.38-2.65a7.05 7.05 0 001.69-.98l2.49 1a.5.5 0 00.61-.22l2-3.46a.5.5 0 00-.12-.64l-2.11-1.65z"/></svg>'
};

function renderProviderIcon(provider) {
  const container = document.getElementById('providerIcon');
  if (container) container.innerHTML = PROVIDER_ICONS[provider] || '';
}

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
      loadDashboardCostBreakdown();
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
  elements.elementCacheSize = document.getElementById('elementCacheSize');
  elements.elementCacheSizePreset = document.getElementById('elementCacheSizePreset');
  elements.elementCacheSizeCustom = document.getElementById('elementCacheSizeCustom');
  elements.elementCacheSizeDisplay = document.getElementById('elementCacheSizeDisplay');
  elements.prioritizeViewport = document.getElementById('prioritizeViewport');
  elements.animatedActionHighlights = document.getElementById('animatedActionHighlights');
  elements.showSidepanelProgress = document.getElementById('showSidepanelProgress');
  elements.autoRefineSiteMaps = document.getElementById('autoRefineSiteMaps');

  // Credentials (Beta)
  elements.enableLogin = document.getElementById('enableLogin');

  // CAPTCHA Solver
  elements.captchaSolverEnabled = document.getElementById('captchaSolverEnabled');
  elements.captchaApiKey = document.getElementById('captchaApiKey');
  elements.toggleCaptchaApiKey = document.getElementById('toggleCaptchaApiKey');

  // Speech-to-Text
  elements.sttProvider = document.getElementById('sttProvider');

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
  elements.explorerStopAllBtn = document.getElementById('explorerStopAllBtn');
  elements.explorerMaxDepth = document.getElementById('explorerMaxDepth');
  elements.explorerMaxPages = document.getElementById('explorerMaxPages');
  elements.explorerCrawlers = document.getElementById('explorerCrawlers');
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
    document.getElementById('openrouterApiKey'),
    document.getElementById('customApiKey'),
    document.getElementById('customEndpoint'),
    elements.maxIterations,
    elements.debugMode,
    elements.domOptimization,
    elements.maxDOMElements,
    elements.elementCacheSize,
    elements.prioritizeViewport,
    elements.animatedActionHighlights,
    elements.showSidepanelProgress,
    elements.enableLogin,
    elements.captchaSolverEnabled,
    elements.captchaApiKey,
    elements.sttProvider
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

  // Element Cache Size preset dropdown
  if (elements.elementCacheSizePreset) {
    elements.elementCacheSizePreset.addEventListener('change', (e) => {
      const value = e.target.value;
      if (value === 'custom') {
        elements.elementCacheSizeCustom.style.display = 'block';
        elements.elementCacheSizeCustom.focus();
      } else {
        elements.elementCacheSizeCustom.style.display = 'none';
        elements.elementCacheSize.value = value;
        if (elements.elementCacheSizeDisplay) {
          elements.elementCacheSizeDisplay.textContent = value;
        }
      }
      markUnsavedChanges();
    });
  }

  // Element Cache Size custom input
  if (elements.elementCacheSizeCustom) {
    elements.elementCacheSizeCustom.addEventListener('input', (e) => {
      let value = parseInt(e.target.value);
      if (Number.isFinite(value)) {
        value = Math.max(10, Math.min(1000, value));
        elements.elementCacheSize.value = value;
        if (elements.elementCacheSizeDisplay) {
          elements.elementCacheSizeDisplay.textContent = value;
        }
      }
      markUnsavedChanges();
    });
  }

  // Model provider change
  if (elements.modelProvider) {
    elements.modelProvider.addEventListener('change', (e) => {
      updateModelOptions(e.target.value);
      updateApiKeyVisibility(e.target.value);
      renderProviderIcon(e.target.value);
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
  
  const toggleOpenrouterApiKey = document.getElementById('toggleOpenrouterApiKey');
  if (toggleOpenrouterApiKey) {
    toggleOpenrouterApiKey.addEventListener('click', () => togglePasswordVisibility('openrouterApiKey'));
  }

  const toggleCustomApiKey = document.getElementById('toggleCustomApiKey');
  if (toggleCustomApiKey) {
    toggleCustomApiKey.addEventListener('click', () => togglePasswordVisibility('customApiKey'));
  }

  // Debug Mode toggle -- show/hide CLI Validation nav item
  if (elements.debugMode) {
    elements.debugMode.addEventListener('change', (e) => {
      updateCLIValidationVisibility(e.target.checked);
    });
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

  // Speech-to-Text toggle
  if (elements.sttProvider) {
    elements.sttProvider.addEventListener('change', (e) => {
      const openaiKey = document.getElementById('openaiApiKey')?.value;
      updateSttDescription(e.target.checked, openaiKey);
      markUnsavedChanges();
    });
  }

  // Auto-enable Whisper when OpenAI key is added
  const openaiKeyInput = document.getElementById('openaiApiKey');
  if (openaiKeyInput && elements.sttProvider) {
    openaiKeyInput.addEventListener('input', () => {
      const hasKey = openaiKeyInput.value.trim().length > 0;
      if (hasKey && !elements.sttProvider.checked) {
        elements.sttProvider.checked = true;
        updateSttDescription(true, openaiKeyInput.value);
        markUnsavedChanges();
      }
      updateSttDescription(elements.sttProvider.checked, openaiKeyInput.value);
    });
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
        loadDashboardCostBreakdown();
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
  
  // PERF: Debounced storage change listener for reactive analytics updates
  let _analyticsRefreshTimer = null;
  // Memory auto-refresh on storage changes
  let _memoryRefreshTimer = null;
  let _memoryRefreshInProgress = false;
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
              loadDashboardCostBreakdown();
              if (analytics.chart) {
                const timeRange = document.getElementById('chartTimeRange')?.value || '24h';
                analytics.updateChart(timeRange);
              }
            });
          }
        }, 2000);
      }

      // Auto-refresh Memory tab when fsb_memories changes
      if (changes.fsb_memories) {
        // Only refresh if memory section is currently visible
        if (dashboardState.currentSection !== 'memory') return;

        // Prevent refresh loops: skip if a refresh is already in progress
        if (_memoryRefreshInProgress) return;

        clearTimeout(_memoryRefreshTimer);
        _memoryRefreshTimer = setTimeout(async () => {
          _memoryRefreshInProgress = true;
          try {
            await _smartMemoryRefresh();
          } finally {
            _memoryRefreshInProgress = false;
          }
        }, 1000); // 1 second debounce to batch rapid updates
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
    openrouter: document.getElementById('openrouterApiKeyGroup'),
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
      settings.modelName = 'grok-4-1-fast-reasoning'; // All legacy modes map to new default
    }
    
    // Update model provider and options
    if (elements.modelProvider) {
      elements.modelProvider.value = settings.modelProvider || 'xai';
      updateModelOptions(settings.modelProvider || 'xai');
      updateApiKeyVisibility(settings.modelProvider || 'xai');
      renderProviderIcon(settings.modelProvider || 'xai');
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
    
    const openrouterApiKey = document.getElementById('openrouterApiKey');
    if (openrouterApiKey) openrouterApiKey.value = settings.openrouterApiKey || '';

    const customEndpoint = document.getElementById('customEndpoint');
    if (customEndpoint) customEndpoint.value = settings.customEndpoint || '';

    // Max iterations
    const maxIter = settings.maxIterations || 20;
    if (elements.maxIterations) elements.maxIterations.value = maxIter;
    if (elements.maxIterationsSlider) elements.maxIterationsSlider.value = maxIter;
    if (elements.maxIterationsDisplay) elements.maxIterationsDisplay.textContent = maxIter;

    // Debug mode
    if (elements.debugMode) elements.debugMode.checked = settings.debugMode;
    // Show/hide CLI Validation nav item based on debug mode
    updateCLIValidationVisibility(settings.debugMode);

    // DOM optimization settings
    if (elements.domOptimization) {
      elements.domOptimization.checked = settings.domOptimization ?? true;
    }
    const maxDOM = settings.maxDOMElements || 2000;
    if (elements.maxDOMElements) elements.maxDOMElements.value = maxDOM;
    if (elements.maxDOMElementsSlider) elements.maxDOMElementsSlider.value = maxDOM;
    if (elements.maxDOMElementsDisplay) elements.maxDOMElementsDisplay.textContent = maxDOM;

    // Element Cache Size
    const cacheSize = settings.elementCacheSize || 200;
    if (elements.elementCacheSize) elements.elementCacheSize.value = cacheSize;
    if (elements.elementCacheSizeDisplay) elements.elementCacheSizeDisplay.textContent = cacheSize;
    if (elements.elementCacheSizePreset) {
      const presetOption = elements.elementCacheSizePreset.querySelector(`option[value="${cacheSize}"]`);
      if (presetOption && cacheSize !== 'custom') {
        elements.elementCacheSizePreset.value = cacheSize;
        if (elements.elementCacheSizeCustom) elements.elementCacheSizeCustom.style.display = 'none';
      } else {
        elements.elementCacheSizePreset.value = 'custom';
        if (elements.elementCacheSizeCustom) {
          elements.elementCacheSizeCustom.style.display = 'block';
          elements.elementCacheSizeCustom.value = cacheSize;
        }
      }
    }

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

    if (elements.autoRefineSiteMaps) {
      elements.autoRefineSiteMaps.checked = settings.autoRefineSiteMaps ?? true;
    }

    // Speech-to-Text
    if (elements.sttProvider) {
      elements.sttProvider.checked = settings.sttProvider === 'whisper';
      updateSttDescription(settings.sttProvider === 'whisper', settings.openaiApiKey);
    }

    addLog('info', 'Settings loaded successfully');
  });
}

function saveSettings() {
  const settings = {
    modelProvider: elements.modelProvider?.value || 'xai',
    modelName: elements.modelName?.value || 'grok-4-1-fast-reasoning',
    apiKey: elements.apiKey?.value || '',
    geminiApiKey: elements.geminiApiKey?.value || '',
    openaiApiKey: document.getElementById('openaiApiKey')?.value || '',
    anthropicApiKey: document.getElementById('anthropicApiKey')?.value || '',
    openrouterApiKey: document.getElementById('openrouterApiKey')?.value || '',
    customApiKey: document.getElementById('customApiKey')?.value || '',
    customEndpoint: document.getElementById('customEndpoint')?.value || '',
    maxIterations: parseInt(elements.maxIterations?.value) || 20,
    debugMode: elements.debugMode?.checked ?? false,
    // DOM Optimization settings
    domOptimization: elements.domOptimization?.checked ?? true,
    maxDOMElements: parseInt(elements.maxDOMElements?.value) || 2000,
    elementCacheSize: parseInt(elements.elementCacheSize?.value) || 200,
    prioritizeViewport: elements.prioritizeViewport?.checked ?? true,
    animatedActionHighlights: elements.animatedActionHighlights?.checked ?? true,
    showSidepanelProgress: elements.showSidepanelProgress?.checked ?? false,
    enableLogin: elements.enableLogin?.checked ?? false,
    captchaSolverEnabled: elements.captchaSolverEnabled?.checked ?? false,
    captchaApiKey: elements.captchaApiKey?.value || '',
    autoRefineSiteMaps: elements.autoRefineSiteMaps?.checked ?? true,
    sttProvider: elements.sttProvider?.checked ? 'whisper' : 'browser'
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
      openrouter: settings.openrouterApiKey,
      custom: settings.customApiKey
    };

    const apiKey = apiKeyMap[provider];

    if (!apiKey) {
      const providerNames = {
        xai: 'xAI',
        gemini: 'Gemini',
        openai: 'OpenAI',
        anthropic: 'Anthropic',
        openrouter: 'OpenRouter',
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
      openrouter: { key: settings.openrouterApiKey, name: 'OpenRouter' },
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
      openrouterApiKey: settings.openrouterApiKey ? '[CONFIGURED]' : '',
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
      ? '../assets/fsb_logo_light_footer.png'
      : '../assets/fsb_logo_dark_footer.png';
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
    model: 'grok-4-1-fast-reasoning',
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
      loadDashboardCostBreakdown();
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
        analytics.currentModel = 'grok-4-1-fast-reasoning';
        analytics.updateDashboard();
        loadDashboardCostBreakdown();
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
function updateSttDescription(whisperEnabled, openaiKey) {
  const desc = document.getElementById('sttStatusDesc');
  if (!desc) return;
  if (whisperEnabled && openaiKey) {
    desc.textContent = 'Using OpenAI Whisper for higher accuracy transcription.';
  } else if (whisperEnabled && !openaiKey) {
    desc.textContent = 'OpenAI API key required. Add one above to enable Whisper.';
  } else {
    desc.textContent = "Using browser's built-in speech recognition (no API key needed).";
  }
}

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
  // Also refresh memory data when switching to memory section (catches stale data)
  const origSwitchSection = switchSection;
  switchSection = function(sectionId) {
    origSwitchSection(sectionId);
    if (sectionId === 'passwords') {
      const enableLogin = document.getElementById('enableLogin');
      if (enableLogin?.checked) {
        loadCredentials();
      }
    }
    // Refresh memory tab when switching to it (picks up changes made while off-screen)
    if (sectionId === 'memory') {
      loadMemoryDashboard();
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

// Track active crawler UIs: crawlerId -> DOM element
const activeCrawlerUIs = new Map();

function initializeSiteExplorer() {
  // Go button
  if (elements.explorerGoBtn) {
    elements.explorerGoBtn.addEventListener('click', startExplorer);
  }

  // Stop All button
  if (elements.explorerStopAllBtn) {
    elements.explorerStopAllBtn.addEventListener('click', stopAllExplorers);
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
    refreshBtn.addEventListener('click', () => loadResearchList(0));
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
        else if (action === 'saveMemory') saveResearchToMemory(researchId);
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

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'startExplorer',
      url: testUrl,
      maxDepth,
      maxPages
    });

    if (!response || !response.success) {
      showToast('Failed to start explorer: ' + (response?.error || 'Unknown error'), 'error');
    } else {
      addLog('info', 'Site Explorer started for ' + testUrl);
      // Clear input for next URL, show Stop All
      if (elements.explorerUrl) elements.explorerUrl.value = '';
      updateStopAllVisibility();
    }
  } catch (error) {
    showToast('Failed to start explorer: ' + error.message, 'error');
  }
}

async function stopAllExplorers() {
  try {
    await chrome.runtime.sendMessage({ action: 'stopExplorer' });
    addLog('info', 'All Site Explorers stopped');
    showToast('All crawlers stopped', 'info');
  } catch (error) {
    console.error('Failed to stop explorers:', error);
  }
  // Clean up all crawler UIs
  activeCrawlerUIs.clear();
  if (elements.explorerCrawlers) elements.explorerCrawlers.innerHTML = '';
  updateStopAllVisibility();
}

async function stopSingleCrawler(crawlerId) {
  try {
    await chrome.runtime.sendMessage({ action: 'stopExplorer', crawlerId });
    addLog('info', 'Crawler stopped: ' + crawlerId);
  } catch (error) {
    console.error('Failed to stop crawler:', error);
  }
}

function updateStopAllVisibility() {
  if (elements.explorerStopAllBtn) {
    elements.explorerStopAllBtn.style.display = activeCrawlerUIs.size > 0 ? '' : 'none';
  }
}

function createCrawlerCard(crawlerId, domain, maxPages) {
  const card = document.createElement('div');
  card.className = 'explorer-crawler-item';
  card.dataset.crawlerId = crawlerId;
  card.innerHTML = `
    <div class="crawler-header">
      <span class="crawler-domain">${escapeHtml(domain)}</span>
      <button class="crawler-stop-btn" data-crawler-id="${crawlerId}">
        <i class="fas fa-stop"></i> Stop
      </button>
    </div>
    <div class="crawler-progress-info">
      <span class="crawler-progress-text">Starting crawl...</span>
      <span class="crawler-progress-count">0 / ${maxPages} pages</span>
    </div>
    <div class="crawler-progress-bar">
      <div class="crawler-progress-fill" style="width: 0%;"></div>
    </div>
    <div class="crawler-current-url"></div>
  `;

  // Wire up stop button
  card.querySelector('.crawler-stop-btn').addEventListener('click', () => {
    stopSingleCrawler(crawlerId);
  });

  return card;
}

function updateExplorerProgress(data) {
  if (!data || !data.crawlerId) return;

  const crawlerId = data.crawlerId;

  if (data.status === 'crawling') {
    // Create card if it doesn't exist
    if (!activeCrawlerUIs.has(crawlerId)) {
      const card = createCrawlerCard(crawlerId, data.domain || '?', data.maxPages || 0);
      activeCrawlerUIs.set(crawlerId, card);
      if (elements.explorerCrawlers) elements.explorerCrawlers.appendChild(card);
      updateStopAllVisibility();
    }

    // Update card
    const card = activeCrawlerUIs.get(crawlerId);
    if (card) {
      const percent = data.maxPages > 0 ? Math.round((data.pagesCollected / data.maxPages) * 100) : 0;
      const fill = card.querySelector('.crawler-progress-fill');
      if (fill) fill.style.width = percent + '%';
      const text = card.querySelector('.crawler-progress-text');
      if (text) text.textContent = 'Crawling ' + (data.domain || '');
      const count = card.querySelector('.crawler-progress-count');
      if (count) count.textContent = data.pagesCollected + ' / ' + data.maxPages + ' pages';
      const urlEl = card.querySelector('.crawler-current-url');
      if (urlEl) urlEl.textContent = data.currentUrl || '';
    }
  } else if (data.status === 'completed' || data.status === 'stopped' || data.status === 'error') {
    // Remove card
    const card = activeCrawlerUIs.get(crawlerId);
    if (card) {
      card.remove();
      activeCrawlerUIs.delete(crawlerId);
      updateStopAllVisibility();
    }

    if (data.status === 'completed') {
      showToast('Crawl completed: ' + data.pagesCollected + ' pages from ' + (data.domain || ''), 'success');
      addLog('info', 'Site Explorer completed: ' + data.pagesCollected + ' pages from ' + data.domain);
    } else if (data.status === 'error') {
      showToast('Crawl failed for ' + (data.domain || 'unknown'), 'error');
    }

    // Refresh research list
    loadResearchList();
  }
}

var researchPage = 0;
var researchPageSize = 10;

async function loadResearchList(page) {
  if (!elements.researchList) return;

  if (typeof page === 'number') {
    researchPage = page;
  }

  try {
    const response = await chrome.runtime.sendMessage({ action: 'getResearchList' });
    const list = (response && response.list) || [];
    const total = list.length;

    if (total === 0) {
      elements.researchList.innerHTML = `
        <div class="session-empty-state">
          <i class="fas fa-flask"></i>
          <p>No research results yet. Use Site Explorer above to crawl a website.</p>
        </div>
      `;
      renderResearchPagination(0, researchPageSize, 0);
      return;
    }

    // Clamp page if out of bounds (e.g. after deletion)
    const maxPage = Math.max(0, Math.ceil(total / researchPageSize) - 1);
    if (researchPage > maxPage) {
      researchPage = maxPage;
    }

    const start = researchPage * researchPageSize;
    const end = Math.min(start + researchPageSize, total);
    const pageItems = list.slice(start, end);

    elements.researchList.innerHTML = pageItems.map(item => `
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
          <button class="session-action-btn save-memory" data-action="saveMemory" title="Save as site map memory">
            <i class="fas fa-brain"></i>
          </button>
          <button class="session-action-btn delete" data-action="delete" title="Delete">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </div>
    `).join('');

    renderResearchPagination(total, researchPageSize, researchPage);

  } catch (error) {
    console.error('Failed to load research list:', error);
    elements.researchList.innerHTML = `
      <div class="session-empty-state">
        <i class="fas fa-exclamation-triangle"></i>
        <p>Failed to load research results: ${error.message}</p>
      </div>
    `;
    renderResearchPagination(0, researchPageSize, 0);
  }
}

function renderResearchPagination(total, pageSize, currentPage) {
  const container = document.getElementById('researchPagination');
  if (!container) return;

  if (total <= pageSize) {
    container.innerHTML = '';
    return;
  }

  const totalPages = Math.ceil(total / pageSize);
  const start = currentPage * pageSize + 1;
  const end = Math.min((currentPage + 1) * pageSize, total);

  let html = '';

  // Prev button
  html += `<button ${currentPage === 0 ? 'disabled' : ''} onclick="loadResearchList(${currentPage - 1})">Prev</button>`;

  // Page number buttons
  for (let i = 0; i < totalPages; i++) {
    html += `<button class="${i === currentPage ? 'active' : ''}" onclick="loadResearchList(${i})">${i + 1}</button>`;
  }

  // Next button
  html += `<button ${currentPage >= totalPages - 1 ? 'disabled' : ''} onclick="loadResearchList(${currentPage + 1})">Next</button>`;

  // Info text
  html += `<span class="pagination-info">${start}-${end} of ${total}</span>`;

  container.innerHTML = html;
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
            <ul style="margin: 0.25rem 0 0; padding-left: 0; font-size: 0.75rem; font-family: monospace; color: var(--text-muted); max-height: 500px; overflow-y: auto;">
              ${data.pages.map(p => `<li style="list-style: none; margin-bottom: 0.5rem;">
                <div>
                  ${escapeHtml(p.url)} (${p.interactiveElements?.length || 0} elements)${p.guideName ? `<span style="color: var(--info-color); margin-left: 0.5rem; font-size: 0.6875rem;">Guide: ${escapeHtml(p.guideName)}</span>` : ''}
                </div>
                <div style="margin-top: 0.15rem; font-size: 0.6875rem;">
                  ${p.markdownSnapshot
                    ? `Markdown: ${p.markdownSnapshot.length.toLocaleString()} chars, ${p.markdownElementCount || 0} elements`
                    : '<span style="color: var(--warning-color);">Snapshot unavailable</span>'}
                </div>
                ${p.markdownSnapshot ? `<details style="margin-top: 0.25rem;">
                  <summary style="cursor: pointer; font-size: 0.6875rem; color: var(--text-secondary);">View Markdown Snapshot</summary>
                  <pre style="background: var(--bg-tertiary); color: var(--text-primary); padding: 0.75rem; border-radius: 4px; font-size: 0.6875rem; line-height: 1.4; max-height: 400px; overflow: auto; white-space: pre-wrap; word-break: break-word;">${escapeHtml(p.markdownSnapshot)}</pre>
                </details>` : ''}
              </li>`).join('')}
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

async function saveResearchToMemory(researchId) {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'getResearchData', researchId });
    if (!response || !response.success || !response.data) {
      showToast('Research data not found', 'error');
      return;
    }

    const research = response.data;
    const sitePattern = convertToSiteMap(research);
    if (!sitePattern) {
      showToast('Failed to convert research to site map', 'error');
      return;
    }

    const domain = research.domain || 'unknown';
    const memory = createSiteMapMemory(domain, sitePattern);
    const saved = await memoryStorage.add(memory);

    if (!saved) {
      showToast('Failed to save memory', 'error');
      return;
    }

    // Update button to show saved state
    const item = elements.researchList?.querySelector(`.session-item[data-research-id="${researchId}"]`);
    if (item) {
      const btn = item.querySelector('[data-action="saveMemory"]');
      if (btn) {
        btn.innerHTML = '<i class="fas fa-check"></i>';
        btn.title = 'Saved to memory';
        btn.disabled = true;
        btn.classList.add('saved');
      }
    }

    // Tier 2: AI refinement if toggle is ON
    const settings = await chrome.storage.local.get(['autoRefineSiteMaps']);
    if (settings.autoRefineSiteMaps !== false && typeof refineSiteMapWithAI === 'function') {
      showToast('Refining site map with AI...', 'info');
      try {
        const refined = await refineSiteMapWithAI(sitePattern, research);
        if (refined && refined.refined === true) {
          memory.typeData.sitePattern = refined;
          memory.metadata.confidence = 0.95;
          memory.text = `Site map for ${domain}: ${refined.pageCount || 0} pages, ${refined.formCount || 0} forms (AI enhanced)`;
          memory.updatedAt = Date.now();
          await memoryStorage.update(memory.id, memory);
          showToast('Site map saved and refined for ' + domain, 'success');
          addLog('info', 'Saved and AI-refined site map for ' + domain);
        } else {
          showToast('Site map saved for ' + domain + ' (refinement returned no data)', 'info');
          addLog('info', 'Saved site map for ' + domain + ' (refinement returned no data)');
        }
      } catch (err) {
        console.warn('AI refinement failed, keeping Tier 1 result:', err.message);
        showToast('Site map saved (AI refinement failed: ' + err.message + ')', 'info');
        addLog('info', 'Saved site map for ' + domain + ' (refinement failed: ' + err.message + ')');
      }
    } else {
      showToast('Site map saved to memory for ' + domain, 'success');
      addLog('info', 'Saved site map memory for ' + domain);
    }
  } catch (error) {
    console.error('Failed to save research to memory:', error);
    showToast('Failed to save to memory: ' + error.message, 'error');
  }
}

async function clearAllResearchResults() {
  if (!confirm('Are you sure you want to delete ALL research results? This cannot be undone.')) {
    return;
  }

  try {
    await chrome.storage.local.remove(['fsbResearchData', 'fsbResearchIndex']);
    loadResearchList(0);
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

  // Pair Dashboard button
  const btnPairDashboard = document.getElementById('btnPairDashboard');
  if (btnPairDashboard) {
    btnPairDashboard.addEventListener('click', function () {
      if (btnPairDashboard.dataset.pairing === 'true') {
        cancelPairing();
      } else {
        showPairingQR();
      }
    });
  }

  // QR popup close button and overlay backdrop click
  const btnCancelPairing = document.getElementById('btnCancelPairing');
  if (btnCancelPairing) btnCancelPairing.addEventListener('click', cancelPairing);
  const qrOverlay = document.getElementById('pairingQROverlay');
  if (qrOverlay) {
    qrOverlay.addEventListener('click', function (e) {
      if (e.target === qrOverlay) cancelPairing();
    });
  }

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

// --- QR Pairing ---
var pairingCountdownTimer = null;

async function showPairingQR() {
  const serverUrl = document.getElementById('serverUrl')?.value?.trim();
  const hashKey = document.getElementById('serverHashKey')?.value?.trim();
  const btn = document.getElementById('btnPairDashboard');
  const container = document.getElementById('pairingQROverlay');
  const qrCodeEl = document.getElementById('pairingQRCode');
  const countdownEl = document.getElementById('pairingCountdown');
  const messageEl = document.getElementById('pairingQRMessage');

  if (!serverUrl || !hashKey) {
    showToast('Set server URL and generate a hash key first', 'error');
    return;
  }

  // Show loading state
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...';
  btn.disabled = true;
  messageEl.textContent = '';
  messageEl.className = 'pairing-qr-message';

  try {
    const resp = await fetch(serverUrl + '/api/pair/generate', {
      method: 'POST',
      headers: { 'X-FSB-Hash-Key': hashKey }
    });

    if (!resp.ok) {
      throw new Error('Server returned ' + resp.status);
    }

    const { token, expiresAt } = await resp.json();

    // Generate QR code using qrcode-generator
    var qr = qrcode(0, 'M');
    qr.addData(JSON.stringify({ t: token, s: serverUrl }));
    qr.make();

    // Render SVG into container
    qrCodeEl.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 2 });

    // Show container, update button
    container.style.display = 'flex';
    btn.innerHTML = '<i class="fas fa-times"></i> Cancel Pairing';
    btn.dataset.pairing = 'true';
    btn.disabled = false;

    // Start countdown
    startPairingCountdown(expiresAt, countdownEl, container, btn, messageEl);

  } catch (err) {
    btn.innerHTML = '<i class="fas fa-qrcode"></i> Pair Dashboard';
    btn.disabled = false;
    showToast('Failed to generate pairing token: ' + err.message, 'error');
  }
}

function startPairingCountdown(expiresAt, countdownEl, container, btn, messageEl) {
  clearPairingCountdown();

  var expiryTime = new Date(expiresAt).getTime();

  function tick() {
    var remaining = Math.max(0, Math.ceil((expiryTime - Date.now()) / 1000));
    countdownEl.textContent = remaining + 's';

    // Pulse effect when under 10 seconds
    if (remaining <= 10 && remaining > 0) {
      countdownEl.classList.add('pairing-countdown-urgent');
    }

    if (remaining <= 0) {
      clearPairingCountdown();
      // Token expired
      messageEl.textContent = 'Token expired';
      messageEl.className = 'pairing-qr-message pairing-qr-expired';
      setTimeout(function () {
        container.style.display = 'none';
        btn.innerHTML = '<i class="fas fa-qrcode"></i> Pair Dashboard';
        btn.dataset.pairing = 'false';
        messageEl.textContent = '';
        messageEl.className = 'pairing-qr-message';
      }, 2000);
      return;
    }

    pairingCountdownTimer = setTimeout(tick, 1000);
  }

  tick();
}

function clearPairingCountdown() {
  if (pairingCountdownTimer) {
    clearTimeout(pairingCountdownTimer);
    pairingCountdownTimer = null;
  }
}

function cancelPairing() {
  clearPairingCountdown();
  var container = document.getElementById('pairingQROverlay');
  var btn = document.getElementById('btnPairDashboard');
  var messageEl = document.getElementById('pairingQRMessage');
  if (container) container.style.display = 'none';
  if (btn) {
    btn.innerHTML = '<i class="fas fa-qrcode"></i> Pair Dashboard';
    btn.dataset.pairing = 'false';
  }
  if (messageEl) {
    messageEl.textContent = '';
    messageEl.className = 'pairing-qr-message';
  }
}

// ===== Memory Dashboard =====

let memorySearchDebounce = null;

function initializeMemorySection() {
  const consolidateBtn = document.getElementById('btnConsolidateMemories');
  const exportBtn = document.getElementById('btnExportMemories');
  const clearBtn = document.getElementById('btnClearMemories');
  const searchInput = document.getElementById('memorySearchInput');
  const typeFilter = document.getElementById('memoryTypeFilter');

  if (consolidateBtn) consolidateBtn.addEventListener('click', consolidateMemories);
  if (exportBtn) exportBtn.addEventListener('click', exportMemories);
  if (clearBtn) clearBtn.addEventListener('click', clearAllMemories);

  const importBtn = document.getElementById('btnImportMemories');
  const importFileInput = document.getElementById('memoryImportFileInput');
  if (importBtn && importFileInput) {
    importBtn.addEventListener('click', () => importFileInput.click());
    importFileInput.addEventListener('change', handleMemoryImport);
  }

  if (searchInput) {
    searchInput.addEventListener('input', () => {
      clearTimeout(memorySearchDebounce);
      memorySearchDebounce = setTimeout(() => searchMemories(), 300);
    });
  }

  if (typeFilter) {
    typeFilter.addEventListener('change', () => searchMemories());
  }

  // Auto-analyze toggle: load saved state and persist on change
  const autoAnalyzeToggle = document.getElementById('autoAnalyzeToggle');
  if (autoAnalyzeToggle) {
    chrome.storage.local.get('autoAnalyzeMemories', (result) => {
      autoAnalyzeToggle.checked = result.autoAnalyzeMemories !== false; // default true
    });
    autoAnalyzeToggle.addEventListener('change', () => {
      chrome.storage.local.set({ autoAnalyzeMemories: autoAnalyzeToggle.checked });
      showToast(autoAnalyzeToggle.checked ? 'Auto-analyze enabled' : 'Auto-analyze disabled', 'info');
    });
  }

  // Overflow menu toggle
  const overflowBtn = document.getElementById('btnMemoryOverflow');
  const overflowDropdown = document.getElementById('memoryOverflowDropdown');
  if (overflowBtn && overflowDropdown) {
    overflowBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      overflowDropdown.classList.toggle('visible');
    });
    document.addEventListener('click', () => {
      overflowDropdown.classList.remove('visible');
    });
    // Prevent dropdown from closing when clicking inside it
    overflowDropdown.addEventListener('click', (e) => {
      e.stopPropagation();
    });
  }

  loadMemoryDashboard();
}

/**
 * Smart memory refresh that preserves expanded panel state and scroll position.
 * Called by the chrome.storage.onChanged listener when fsb_memories changes.
 */
async function _smartMemoryRefresh() {
  // Save expanded panel state before re-rendering
  const expandedDetail = document.querySelector('.memory-item.detail-expanded');
  const expandedGraph = document.querySelector('.memory-item.graph-expanded');
  const expandedMemoryId = (expandedDetail || expandedGraph)?.dataset?.memoryId || null;
  const expandedType = expandedDetail ? 'detail' : (expandedGraph ? 'graph' : null);

  // Save scroll position
  const scrollContainer = document.getElementById('memoryListContainer');
  const scrollTop = scrollContainer?.scrollTop || 0;

  // Reload data (this re-renders the memory list)
  await loadMemoryDashboard();

  // Restore expanded state if an item was expanded
  if (expandedMemoryId) {
    const restoredItem = document.querySelector(`.memory-item[data-memory-id="${expandedMemoryId}"]`);
    if (restoredItem) {
      // Small delay to let the DOM settle after re-render
      setTimeout(() => {
        toggleMemoryDetail(restoredItem);
      }, 100);
    }
  }

  // Restore scroll position
  if (scrollContainer) {
    scrollContainer.scrollTop = scrollTop;
  }
}

async function loadMemoryDashboard() {
  try {
    if (typeof memoryManager === 'undefined') return;

    const stats = await memoryManager.getStats();
    updateMemoryStats(stats);

    const memories = await memoryManager.getAll();
    renderMemoryList(memories);

    // Refresh memory cost panel alongside memory data
    loadMemoryCostPanel();
  } catch (error) {
    console.error('[Options] Failed to load memory dashboard:', error);
  }
}

// Load cost breakdown by source for the Dashboard hero section
function loadDashboardCostBreakdown() {
  if (!analytics || !analytics.initialized) return;

  const automationStats = analytics.getStatsBySource('30d', 'automation');
  const memoryStats = analytics.getStatsBySource('30d', 'memory');
  const sitemapStats = analytics.getStatsBySource('30d', 'sitemap');

  const fmt = (v) => '$' + (v || 0).toFixed(2);

  const elAuto = document.getElementById('costAutomation');
  const elMem = document.getElementById('costMemory');

  if (elAuto) elAuto.textContent = fmt(automationStats.totalCost);
  if (elMem) elMem.textContent = fmt((memoryStats.totalCost || 0) + (sitemapStats.totalCost || 0));
}

// Load memory-specific cost panel in the Memory tab
function loadMemoryCostPanel() {
  if (!analytics || !analytics.initialized) return;

  const memStats = analytics.getStatsBySource('30d', 'memory');
  const sitemapStats = analytics.getStatsBySource('30d', 'sitemap');
  const totalCost = (memStats.totalCost || 0) + (sitemapStats.totalCost || 0);
  const totalRequests = (memStats.totalRequests || 0) + (sitemapStats.totalRequests || 0);
  const totalTokens = (memStats.totalTokens || 0) + (sitemapStats.totalTokens || 0);

  const elCost = document.getElementById('memCostTotal');
  const elReqs = document.getElementById('memCostRequests');
  const elTokens = document.getElementById('memCostTokens');

  if (elCost) elCost.textContent = '$' + totalCost.toFixed(4);
  if (elReqs) elReqs.textContent = totalRequests.toLocaleString();
  if (elTokens) {
    // Format tokens: 12345 -> "12.3K", 1234567 -> "1.2M"
    if (totalTokens >= 1000000) {
      elTokens.textContent = (totalTokens / 1000000).toFixed(1) + 'M';
    } else if (totalTokens >= 1000) {
      elTokens.textContent = (totalTokens / 1000).toFixed(1) + 'K';
    } else {
      elTokens.textContent = totalTokens.toLocaleString();
    }
  }
}

function updateMemoryStats(stats) {
  const el = (id, val) => {
    const e = document.getElementById(id);
    if (e) e.textContent = val;
  };

  el('memStatTotal', stats.totalCount);
  el('memStatSemantic', stats.byType?.semantic || 0);
  el('memStatProcedural', stats.byType?.procedural || 0);
  el('memStatTask', stats.byType?.task || 0);

  const kb = Math.round(stats.estimatedBytes / 1024);
  el('memStatStorage', kb > 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`);
  el('memStatUtilization', `${stats.utilizationPercent}%`);
}

function renderMemoryList(memories) {
  const container = document.getElementById('memoryList');
  const emptyState = document.getElementById('memoryEmptyState');
  if (!container) return;

  // Clean up any active graphs and detail panels before re-render
  const activeGraphs = container.parentElement
    ? container.parentElement.querySelectorAll('.site-graph-container')
    : container.querySelectorAll('.site-graph-container');
  activeGraphs.forEach(gc => {
    if (typeof SiteGraph !== 'undefined') SiteGraph.destroy(gc);
    gc.remove();
  });
  const activeDetails = container.parentElement
    ? container.parentElement.querySelectorAll('.memory-detail-panel')
    : container.querySelectorAll('.memory-detail-panel');
  activeDetails.forEach(dp => dp.remove());

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
      semantic: 'fa-lightbulb',
      procedural: 'fa-list-ol',
      task: 'fa-clipboard-check'
    }[memory.type] || 'fa-circle';

    const typeLabel = memory.type.charAt(0).toUpperCase() + memory.type.slice(1);
    const domain = memory.metadata?.domain || 'Unknown';
    const age = formatTimeAgo(memory.createdAt);
    const accesses = memory.accessCount || 0;
    const confidence = Math.round((memory.metadata?.confidence || 0) * 100);
    const tags = (memory.metadata?.tags || []).slice(0, 3).join(', ');

    // Task Memory metadata line: Domain | Duration | Steps | Outcome badge
    let metaLine;
    if (memory.type === 'task') {
      const sess = memory.typeData?.session || {};
      const outcomeVal = (sess.outcome || 'unknown').toLowerCase();
      const outcomeBadgeClass = { success: 'success', failure: 'failure', partial: 'partial' }[outcomeVal] || 'unknown';
      const outcomeLabel = outcomeVal.charAt(0).toUpperCase() + outcomeVal.slice(1);
      const outcomeBadge = `<span class="outcome-badge outcome-badge-${outcomeBadgeClass}">${outcomeLabel}</span>`;
      const taskDomain = sess.domain || memory.metadata?.domain || 'Unknown';
      let durationStr = '';
      if (sess.duration && sess.duration > 0) {
        const totalSec = Math.round(sess.duration / 1000);
        const mins = Math.floor(totalSec / 60);
        const secs = totalSec % 60;
        durationStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
      }
      const stepCount = (sess.timeline || []).length;
      metaLine = `<i class="fas fa-globe" style="font-size: 0.85em; opacity: 0.7;"></i> ${escapeHtml(taskDomain)} | ${durationStr || 'N/A'} | ${stepCount} steps | ${outcomeBadge}`;
    } else {
      metaLine = `${typeLabel} | ${escapeHtml(domain)} | ${age} | ${accesses} accesses | ${confidence}% conf${tags ? ' | ' + escapeHtml(tags) : ''}`;
    }

    const isSiteMap = memory.typeData?.category === 'site_map';
    const isRefined = memory.typeData?.sitePattern?.refined === true;
    const badgeHtml = isSiteMap
      ? `<span class="memory-badge ${isRefined ? 'refined' : 'basic'}">${isRefined ? 'Refined' : 'Basic'}</span>`
      : '';

    const graphAttr = isSiteMap ? ' data-has-graph="true"' : '';
    const chevronHtml = '<i class="fas fa-chevron-right detail-toggle-icon" title="Toggle details"></i>';
    const textStyle = memory.type === 'task'
      ? 'font-weight: 500; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;'
      : 'font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;';

    return `
      <div class="session-item memory-item" data-memory-id="${memory.id}" data-expandable="true"${graphAttr} style="cursor: pointer;">
        <div class="session-item-header" style="display: flex; align-items: center; gap: 10px;">
          <i class="fas ${typeIcon}" style="color: var(--primary); font-size: 1.1em;" title="${typeLabel}"></i>
          <div style="flex: 1; min-width: 0;">
            <div style="${textStyle}">
              ${escapeHtml(memory.text)} ${badgeHtml}
            </div>
            <div style="font-size: 0.82em; color: var(--text-secondary); margin-top: 2px;">
              ${metaLine}
            </div>
          </div>
          ${chevronHtml}
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

  // Attach click-to-expand handlers on all memory items
  container.querySelectorAll('.memory-item[data-expandable="true"]').forEach(item => {
    item.addEventListener('click', (e) => {
      // Don't trigger on button clicks
      if (e.target.closest('.control-btn')) return;
      toggleMemoryDetail(item);
    });
  });
}

/* ── Memory Detail Panel expand/collapse (all memory types) ── */

async function toggleMemoryDetail(memoryItem) {
  const memoryId = memoryItem.dataset.memoryId;

  // If already expanded (detail or graph), collapse
  if (memoryItem.classList.contains('detail-expanded')) {
    collapseMemoryDetail(memoryItem);
    return;
  }
  if (memoryItem.classList.contains('graph-expanded')) {
    collapseMemoryGraph(memoryItem);
    return;
  }

  // Collapse any other currently expanded detail panel (accordion)
  const existingDetail = document.querySelector('.memory-item.detail-expanded');
  if (existingDetail) {
    collapseMemoryDetail(existingDetail);
  }

  // Also collapse any existing graph-expanded item (mutually exclusive)
  const existingGraph = document.querySelector('.memory-item.graph-expanded');
  if (existingGraph) {
    collapseMemoryGraph(existingGraph);
  }

  // Fetch full memory data
  let memory;
  try {
    const memories = await memoryManager.getAll();
    memory = memories.find(m => m.id === memoryId);
  } catch (err) {
    showToast('Failed to load memory data', 'error');
    return;
  }
  if (!memory) {
    showToast('Memory not found', 'error');
    return;
  }

  // Site map memories show the mind map graph visualization
  if (memory.typeData?.category === 'site_map') {
    toggleMemoryGraph(memoryItem);
    return;
  }

  // Build and insert the detail panel for non-sitemap memories
  const panelHtml = renderMemoryDetailPanel(memory);
  const panelDiv = document.createElement('div');
  panelDiv.className = 'memory-detail-panel';
  panelDiv.innerHTML = panelHtml;
  memoryItem.classList.add('detail-expanded');
  memoryItem.after(panelDiv);

  // Wire up collapsible recon section toggles (Task Memory detail view)
  panelDiv.querySelectorAll('.recon-section-toggle').forEach(toggle => {
    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      toggle.parentElement.classList.toggle('recon-section-open');
    });
  });

  // Render per-task graph if SiteGraph is available (Task Memory only)
  const graphContainer = panelDiv.querySelector('.task-graph-container');
  if (graphContainer && typeof SiteGraph !== 'undefined' && typeof SiteGraph.transformTaskData === 'function') {
    const graphData = SiteGraph.transformTaskData(memory);
    if (graphData.nodes.length > 0) {
      SiteGraph.render(graphContainer, graphData, { width: graphContainer.clientWidth || 500, height: 250 });
    } else {
      graphContainer.style.display = 'none';
    }
  }

  // Scroll into view
  memoryItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function collapseMemoryDetail(memoryItem) {
  memoryItem.classList.remove('detail-expanded');
  const nextSibling = memoryItem.nextElementSibling;
  if (nextSibling && nextSibling.classList.contains('memory-detail-panel')) {
    // Destroy task graph SVG before removing panel
    const graphContainer = nextSibling.querySelector('.task-graph-container');
    if (graphContainer && typeof SiteGraph !== 'undefined') {
      SiteGraph.destroy(graphContainer);
    }
    nextSibling.remove();
  }
}

function renderMemoryDetailPanel(memory) {
  let content = '';

  switch (memory.type) {
    case 'semantic':
      content = renderSemanticDetail(memory);
      break;
    case 'procedural':
      content = renderProceduralDetail(memory);
      break;
    case 'task':
      content = renderTaskDetail(memory);
      break;
    default:
      content = `<div class="detail-section"><div class="detail-value">${escapeHtml(memory.text)}</div></div>`;
  }

  // Task type integrates AI analysis into its collapsible sections; others get separate block
  const aiSection = memory.type === 'task' ? '' : renderAIAnalysisSection(memory.aiAnalysis);

  return `
    <div class="detail-panel-inner">
      ${content}
      ${aiSection}
    </div>
  `;
}

function renderEpisodicDetail(memory) {
  const td = memory.typeData || {};
  const outcomeClass = {
    success: 'outcome-success',
    failure: 'outcome-failure',
    partial: 'outcome-partial'
  }[td.outcome] || 'outcome-unknown';

  const outcomeLabel = (td.outcome || 'unknown').charAt(0).toUpperCase() + (td.outcome || 'unknown').slice(1);

  // Format duration
  let durationStr = 'N/A';
  if (td.duration && td.duration > 0) {
    const totalSec = Math.round(td.duration / 1000);
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    durationStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  }

  const stepsHtml = (td.stepsCompleted && td.stepsCompleted.length > 0)
    ? `<ul class="detail-list">${td.stepsCompleted.map(s => `<li>${escapeHtml(String(s))}</li>`).join('')}</ul>`
    : '<span class="detail-muted">None recorded</span>';

  const failuresHtml = (td.failures && td.failures.length > 0)
    ? `<ul class="detail-list">${td.failures.map(f => `<li>${escapeHtml(String(f))}</li>`).join('')}</ul>`
    : '<span class="detail-muted">None</span>';

  const finalUrlHtml = td.finalUrl
    ? `<div class="detail-section">
        <div class="detail-label">Final URL</div>
        <div class="detail-value"><a href="${escapeHtml(td.finalUrl)}" target="_blank" rel="noopener">${escapeHtml(td.finalUrl)}</a></div>
      </div>`
    : '';

  return `
    <div class="detail-grid">
      <div class="detail-section">
        <div class="detail-label">Task</div>
        <div class="detail-value">${escapeHtml(td.task || 'N/A')}</div>
      </div>
      <div class="detail-section">
        <div class="detail-label">Outcome</div>
        <div class="detail-value"><span class="${outcomeClass}">${outcomeLabel}</span></div>
      </div>
      <div class="detail-section">
        <div class="detail-label">Duration</div>
        <div class="detail-value">${durationStr}</div>
      </div>
      <div class="detail-section">
        <div class="detail-label">Iterations</div>
        <div class="detail-value">${td.iterationCount || 0}</div>
      </div>
    </div>
    <div class="detail-section">
      <div class="detail-label">Steps Completed</div>
      ${stepsHtml}
    </div>
    <div class="detail-section">
      <div class="detail-label">Failures</div>
      ${failuresHtml}
    </div>
    ${finalUrlHtml}
  `;
}

function renderSemanticDetail(memory) {
  const td = memory.typeData || {};
  const categoryLabels = {
    site_map: 'Site Map',
    selector: 'Selector',
    site_pattern: 'Site Pattern',
    general: 'General',
    cross_site_pattern: 'Cross-Site Pattern',
    user_preference: 'User Preference'
  };
  const categoryLabel = categoryLabels[td.category] || (td.category || 'General');

  let categoryContent = '';

  if (td.category === 'site_map' && td.sitePattern) {
    // Read-only sitemap detail for nerds
    const sp = td.sitePattern;
    const pageCount = sp.pageCount || Object.keys(sp.pages || {}).length || 0;
    const formCount = sp.formCount || Object.keys(sp.forms || {}).length || 0;
    const navCount = Object.keys(sp.navigation || {}).length;
    const selectorCount = Object.keys(sp.keySelectors || {}).length;
    const linkCount = (sp.pageLinks || []).length;
    const crawledAt = sp.crawledAt ? new Date(sp.crawledAt).toLocaleString() : 'Unknown';

    // Build pages list (top 15)
    const pageEntries = Object.entries(sp.pages || {}).slice(0, 15);
    const pagesHtml = pageEntries.length > 0
      ? `<ul class="detail-list">${pageEntries.map(([path, info]) => {
          const title = info.title ? ` -- ${escapeHtml(info.title)}` : '';
          return `<li><span class="detail-code">${escapeHtml(path)}</span>${title}</li>`;
        }).join('')}</ul>${Object.keys(sp.pages || {}).length > 15 ? `<div class="detail-muted">...and ${Object.keys(sp.pages).length - 15} more</div>` : ''}`
      : '<span class="detail-muted">None</span>';

    // Build forms list
    const formEntries = Object.entries(sp.forms || {});
    const formsHtml = formEntries.length > 0
      ? `<ul class="detail-list">${formEntries.map(([path, formList]) => {
          const count = Array.isArray(formList) ? formList.length : 1;
          return `<li><span class="detail-code">${escapeHtml(path)}</span> (${count} form${count !== 1 ? 's' : ''})</li>`;
        }).join('')}</ul>`
      : '<span class="detail-muted">None</span>';

    // Build navigation summary
    const navEntries = Object.entries(sp.navigation || {});
    const navHtml = navEntries.length > 0
      ? `<ul class="detail-list">${navEntries.slice(0, 10).map(([path, navItems]) => {
          const count = Array.isArray(navItems) ? navItems.length : 0;
          return `<li><span class="detail-code">${escapeHtml(path)}</span> (${count} nav item${count !== 1 ? 's' : ''})</li>`;
        }).join('')}</ul>`
      : '<span class="detail-muted">None</span>';

    categoryContent = `
      <div class="detail-grid" style="grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 12px;">
        <div class="detail-section">
          <div class="detail-label">Pages</div>
          <div class="detail-value" style="font-size: 1.2em; font-weight: 700;">${pageCount}</div>
        </div>
        <div class="detail-section">
          <div class="detail-label">Forms</div>
          <div class="detail-value" style="font-size: 1.2em; font-weight: 700;">${formCount}</div>
        </div>
        <div class="detail-section">
          <div class="detail-label">Nav Sections</div>
          <div class="detail-value" style="font-size: 1.2em; font-weight: 700;">${navCount}</div>
        </div>
        <div class="detail-section">
          <div class="detail-label">Links</div>
          <div class="detail-value" style="font-size: 1.2em; font-weight: 700;">${linkCount}</div>
        </div>
      </div>
      <div class="detail-section">
        <div class="detail-label">Crawled</div>
        <div class="detail-value">${crawledAt}${sp.refined ? ' (refined)' : ''}</div>
      </div>
      <div class="detail-section">
        <div class="detail-label">Pages Discovered</div>
        ${pagesHtml}
      </div>
      <div class="detail-section">
        <div class="detail-label">Forms Found</div>
        ${formsHtml}
      </div>
      <div class="detail-section">
        <div class="detail-label">Navigation</div>
        ${navHtml}
      </div>
    `;
  } else if (td.category === 'selector' && td.selectorInfo) {
    // Render selector info as key-value table
    const rows = Object.entries(td.selectorInfo)
      .map(([key, val]) => `<tr><td class="detail-code">${escapeHtml(key)}</td><td>${escapeHtml(String(val))}</td></tr>`)
      .join('');
    categoryContent = `
      <div class="detail-section">
        <div class="detail-label">Selector Info</div>
        <table class="detail-table">
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  } else if (td.category === 'site_pattern' && td.sitePattern) {
    const sp = td.sitePattern;
    categoryContent = `
      <div class="detail-section">
        <div class="detail-label">Site Pattern</div>
        <div class="detail-grid">
          <div class="detail-section">
            <div class="detail-label">Pages</div>
            <div class="detail-value">${sp.pageCount || 0}</div>
          </div>
          <div class="detail-section">
            <div class="detail-label">Forms</div>
            <div class="detail-value">${sp.formCount || 0}</div>
          </div>
        </div>
      </div>
    `;
  } else if (td.category === 'cross_site_pattern' && td.sitePattern) {
    const sp = td.sitePattern;
    const domainsHtml = (sp.domains && sp.domains.length > 0)
      ? `<ul class="detail-list">${sp.domains.map(d => `<li>${escapeHtml(d)}</li>`).join('')}</ul>`
      : '<span class="detail-muted">None</span>';
    const formTypesHtml = (sp.commonFormTypes && sp.commonFormTypes.length > 0)
      ? `<ul class="detail-list">${sp.commonFormTypes.map(f => `<li>${escapeHtml(String(f))}</li>`).join('')}</ul>`
      : '<span class="detail-muted">None</span>';
    const sharedPatternsHtml = (sp.sharedSelectorPatterns && sp.sharedSelectorPatterns.length > 0)
      ? `<ul class="detail-list">${sp.sharedSelectorPatterns.map(p => `<li class="detail-code">${escapeHtml(String(p))}</li>`).join('')}</ul>`
      : '<span class="detail-muted">None</span>';
    categoryContent = `
      <div class="detail-section">
        <div class="detail-label">Domains Analyzed</div>
        ${domainsHtml}
      </div>
      <div class="detail-section">
        <div class="detail-label">Common Form Types</div>
        ${formTypesHtml}
      </div>
      <div class="detail-section">
        <div class="detail-label">Shared Selector Patterns</div>
        ${sharedPatternsHtml}
      </div>
    `;
  } else {
    // General or unknown category -- show the memory text prominently
    categoryContent = `
      <div class="detail-section">
        <div class="detail-value" style="font-size: 1.05em;">${escapeHtml(memory.text)}</div>
      </div>
    `;
  }

  const validatedHtml = td.validatedAt
    ? `<div class="detail-section">
        <div class="detail-label">Validated At</div>
        <div class="detail-value">${new Date(td.validatedAt).toLocaleString()}</div>
      </div>`
    : '';

  return `
    <div class="detail-grid">
      <div class="detail-section">
        <div class="detail-label">Category</div>
        <div class="detail-value">${categoryLabel}</div>
      </div>
    </div>
    ${categoryContent}
    ${validatedHtml}
  `;
}

function renderProceduralDetail(memory) {
  const td = memory.typeData || {};

  const stepsHtml = (td.steps && td.steps.length > 0)
    ? `<ol class="detail-list detail-list-ordered">${td.steps.map(s => `<li>${escapeHtml(String(s))}</li>`).join('')}</ol>`
    : '<span class="detail-muted">No steps recorded</span>';

  const selectorsHtml = (td.selectors && td.selectors.length > 0)
    ? `<ul class="detail-list">${td.selectors.map(s => `<li><code class="detail-code">${escapeHtml(String(s))}</code></li>`).join('')}</ul>`
    : '<span class="detail-muted">None</span>';

  // Success rate color
  const rate = (td.successRate ?? 1) * 100;
  const rateClass = rate >= 80 ? 'outcome-success' : rate >= 50 ? 'outcome-partial' : 'outcome-failure';

  const targetUrlHtml = td.targetUrl
    ? `<div class="detail-section">
        <div class="detail-label">Target URL</div>
        <div class="detail-value"><a href="${escapeHtml(td.targetUrl)}" target="_blank" rel="noopener">${escapeHtml(td.targetUrl)}</a></div>
      </div>`
    : '';

  return `
    <div class="detail-grid">
      <div class="detail-section">
        <div class="detail-label">Success Rate</div>
        <div class="detail-value"><span class="${rateClass}">${Math.round(rate)}%</span></div>
      </div>
      <div class="detail-section">
        <div class="detail-label">Total Runs</div>
        <div class="detail-value">${td.totalRuns || 0}</div>
      </div>
    </div>
    <div class="detail-section">
      <div class="detail-label">Steps</div>
      ${stepsHtml}
    </div>
    <div class="detail-section">
      <div class="detail-label">Selectors Used</div>
      ${selectorsHtml}
    </div>
    ${targetUrlHtml}
  `;
}

function renderCollapsibleSection(id, title, icon, content, defaultOpen = false) {
  return `<div class="recon-section${defaultOpen ? ' recon-section-open' : ''}">
    <div class="recon-section-toggle" data-section="${id}">
      <i class="fas fa-chevron-right recon-chevron"></i>
      <i class="fas ${icon}"></i> ${title}
    </div>
    <div class="recon-section-body">${content}</div>
  </div>`;
}

function renderTaskDetail(memory) {
  const sess = memory.typeData?.session || {};
  const learned = memory.typeData?.learned || {};
  const procedures = memory.typeData?.procedures || [];
  const ai = memory.aiAnalysis || {};

  // Outcome badge
  const outcomeVal = (sess.outcome || 'unknown').toLowerCase();
  const outcomeBadgeClass = { success: 'success', failure: 'failure', partial: 'partial' }[outcomeVal] || 'unknown';
  const outcomeLabel = outcomeVal.charAt(0).toUpperCase() + outcomeVal.slice(1);

  // Duration
  let durationStr = 'N/A';
  if (sess.duration && sess.duration > 0) {
    const totalSec = Math.round(sess.duration / 1000);
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    durationStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  }

  const timeline = sess.timeline || [];
  const stepCount = timeline.length;
  const taskDomain = sess.domain || memory.metadata?.domain || 'Unknown';

  // --- Summary header (always visible) ---
  const finalUrlHtml = sess.finalUrl
    ? `<div style="margin-top: 6px; font-size: 0.85em;"><i class="fas fa-link" style="opacity: 0.5; margin-right: 4px;"></i><a href="${escapeHtml(sess.finalUrl)}" target="_blank" rel="noopener" style="color: var(--primary);">${escapeHtml(sess.finalUrl)}</a></div>`
    : '';

  const summaryHeader = `
    <div class="recon-summary-header">
      <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
        <span class="outcome-badge outcome-badge-lg outcome-badge-${outcomeBadgeClass}">${outcomeLabel}</span>
        <span style="font-weight: 600; font-size: 1.05em;">${escapeHtml(sess.task || memory.text || 'Task')}</span>
      </div>
      <div style="font-size: 0.85em; color: var(--text-secondary); display: flex; flex-wrap: wrap; gap: 4px 12px;">
        <span><i class="fas fa-globe" style="opacity: 0.6;"></i> ${escapeHtml(taskDomain)}</span>
        <span><i class="fas fa-clock" style="opacity: 0.6;"></i> ${durationStr}</span>
        <span><i class="fas fa-shoe-prints" style="opacity: 0.6;"></i> ${stepCount} steps</span>
        <span><i class="fas fa-redo" style="opacity: 0.6;"></i> ${sess.iterationCount || 0} iterations</span>
      </div>
      ${finalUrlHtml}
    </div>
  `;

  // --- Timeline section (default open) ---
  let timelineContent = '';
  if (timeline.length > 0) {
    timelineContent = `<ol class="recon-timeline-list">${timeline.map((s, i) => {
      const isFailed = s.result && /fail|error/i.test(s.result);
      const stepClass = isFailed ? ' recon-timeline-step-failed' : '';
      const urlHtml = s.url ? ` <a href="${escapeHtml(s.url)}" target="_blank" rel="noopener" class="recon-timeline-url" title="${escapeHtml(s.url)}"><i class="fas fa-external-link-alt"></i></a>` : '';
      return `<li class="recon-timeline-step${stepClass}">
        <strong>${escapeHtml(s.action || '')}</strong> on <code class="detail-code">${escapeHtml(s.target || '')}</code> &mdash; ${escapeHtml(s.result || '')}${urlHtml}
      </li>`;
    }).join('')}</ol>`;
  } else {
    timelineContent = '<span class="detail-muted">No steps recorded</span>';
  }

  // Inline failures in timeline section
  if (sess.failures && sess.failures.length > 0) {
    timelineContent += `<div class="recon-failures-block">
      <div style="font-weight: 600; font-size: 0.85em; margin-bottom: 4px; color: var(--danger, #ef4444);"><i class="fas fa-exclamation-triangle"></i> Failures</div>
      <ul class="detail-list">${sess.failures.map(f => `<li>${escapeHtml(String(f))}</li>`).join('')}</ul>
    </div>`;
  }

  // AI risk factors at bottom of timeline
  if (ai.riskFactors && ai.riskFactors.length > 0) {
    timelineContent += `<div class="recon-ai-note">
      <div style="font-weight: 600; font-size: 0.85em; margin-bottom: 4px;"><i class="fas fa-shield-alt" style="opacity: 0.7;"></i> Risk Factors</div>
      <ul class="detail-list">${ai.riskFactors.map(r => `<li>${escapeHtml(String(r))}</li>`).join('')}</ul>
    </div>`;
  }

  const timelineSection = renderCollapsibleSection('timeline', `Timeline (${stepCount} steps)`, 'fa-route', timelineContent, true);

  // --- Discoveries section (default closed) ---
  let discoveriesContent = '';

  // AI key takeaways at top
  if (ai.keyTakeaways && ai.keyTakeaways.length > 0) {
    discoveriesContent += `<div class="recon-ai-note" style="margin-bottom: 10px;">
      <div style="font-weight: 600; font-size: 0.85em; margin-bottom: 4px;"><i class="fas fa-brain" style="opacity: 0.7;"></i> Key Takeaways</div>
      <ul class="detail-list">${ai.keyTakeaways.map(t => `<li>${escapeHtml(String(t))}</li>`).join('')}</ul>
    </div>`;
  }

  // Selectors
  if (learned.selectors && learned.selectors.length > 0) {
    discoveriesContent += `<div style="margin-bottom: 8px;">
      <div style="font-weight: 600; font-size: 0.85em; margin-bottom: 4px;">Selectors Discovered</div>
      <div>${learned.selectors.map(s => `<code class="detail-code">${escapeHtml(String(s))}</code>`).join(' ')}</div>
    </div>`;
  }

  // Site structure
  if (learned.siteStructure && Object.keys(learned.siteStructure).length > 0) {
    const structItems = Object.entries(learned.siteStructure)
      .map(([k, v]) => `<li><strong>${escapeHtml(k)}:</strong> ${escapeHtml(String(v))}</li>`)
      .join('');
    discoveriesContent += `<div style="margin-bottom: 8px;">
      <div style="font-weight: 600; font-size: 0.85em; margin-bottom: 4px;">Site Structure</div>
      <ul class="detail-list">${structItems}</ul>
    </div>`;
  }

  // Patterns
  if (learned.patterns && learned.patterns.length > 0) {
    discoveriesContent += `<div style="margin-bottom: 8px;">
      <div style="font-weight: 600; font-size: 0.85em; margin-bottom: 4px;">Patterns</div>
      <ul class="detail-list">${learned.patterns.map(p => `<li>${escapeHtml(String(p))}</li>`).join('')}</ul>
    </div>`;
  }

  const hasDiscoveries = discoveriesContent.length > 0;
  if (!hasDiscoveries) discoveriesContent = '<span class="detail-muted">No discoveries recorded</span>';
  const discoveriesSection = renderCollapsibleSection('discoveries', 'Discoveries', 'fa-search', discoveriesContent, false);

  // --- Procedures section (default closed) ---
  let proceduresContent = '';

  if (procedures.length > 0) {
    proceduresContent = procedures.map(proc => {
      const rate = Math.round((proc.successRate ?? 1) * 100);
      const rateClass = rate >= 80 ? 'outcome-badge-success' : rate >= 50 ? 'outcome-badge-partial' : 'outcome-badge-failure';
      return `<div class="recon-procedure-item">
        <strong>${escapeHtml(proc.name || 'Unnamed')}</strong>
        <span style="color: var(--text-secondary); font-size: 0.85em;">${(proc.steps || []).length} steps</span>
        <span class="outcome-badge ${rateClass}">${rate}%</span>
      </div>`;
    }).join('');
  } else {
    proceduresContent = '<span class="detail-muted">No procedures recorded</span>';
  }

  // AI optimization tips
  if (ai.optimizationTips && ai.optimizationTips.length > 0) {
    proceduresContent += `<div class="recon-ai-note" style="margin-top: 10px;">
      <div style="font-weight: 600; font-size: 0.85em; margin-bottom: 4px;"><i class="fas fa-lightbulb" style="opacity: 0.7;"></i> Optimization Tips</div>
      <ul class="detail-list">${ai.optimizationTips.map(t => `<li>${escapeHtml(String(t))}</li>`).join('')}</ul>
    </div>`;
  }

  // AI suggested improvements
  if (ai.suggestedImprovements && ai.suggestedImprovements.length > 0) {
    proceduresContent += `<div class="recon-ai-note">
      <div style="font-weight: 600; font-size: 0.85em; margin-bottom: 4px;"><i class="fas fa-arrow-up" style="opacity: 0.7;"></i> Suggested Improvements</div>
      <ul class="detail-list">${ai.suggestedImprovements.map(t => `<li>${escapeHtml(String(t))}</li>`).join('')}</ul>
    </div>`;
  }

  // AI reusability assessment
  if (ai.reusabilityAssessment) {
    proceduresContent += `<div class="recon-ai-note" style="margin-top: 8px; padding: 8px 10px; background: var(--surface-color, #f9fafb); border-radius: 6px; font-size: 0.85em;">
      <i class="fas fa-recycle" style="opacity: 0.7;"></i> <strong>Reusability:</strong> ${escapeHtml(String(ai.reusabilityAssessment))}
    </div>`;
  }

  const proceduresSection = renderCollapsibleSection('procedures', `Procedures (${procedures.length})`, 'fa-code-branch', proceduresContent, false);

  // Task graph container (rendered after panel opens)
  const taskGraphHtml = `<div class="task-graph-container" data-memory-id="${memory.id}" style="min-height: 250px; margin-bottom: 12px;"></div>`;

  return `
    ${summaryHeader}
    ${taskGraphHtml}
    ${timelineSection}
    ${discoveriesSection}
    ${proceduresSection}
  `;
}

function renderAIAnalysisSection(aiAnalysis) {
  if (!aiAnalysis || typeof aiAnalysis !== 'object') return '';

  const entries = Object.entries(aiAnalysis);
  if (entries.length === 0) return '';

  const renderValue = (val) => {
    if (Array.isArray(val)) {
      if (val.length === 0) return '<span class="detail-muted">None</span>';
      return `<ul class="detail-list">${val.map(v => `<li>${escapeHtml(String(v))}</li>`).join('')}</ul>`;
    }
    if (typeof val === 'object' && val !== null) {
      const subEntries = Object.entries(val)
        .map(([k, v]) => `<li><strong>${escapeHtml(k)}:</strong> ${escapeHtml(String(v))}</li>`)
        .join('');
      return `<ul class="detail-list">${subEntries}</ul>`;
    }
    return `<p class="detail-value">${escapeHtml(String(val))}</p>`;
  };

  const sections = entries.map(([key, val]) => {
    const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim();
    return `
      <div class="detail-section">
        <div class="detail-label">${escapeHtml(label)}</div>
        ${renderValue(val)}
      </div>
    `;
  }).join('');

  return `
    <div class="ai-analysis-section">
      <div class="ai-analysis-header"><i class="fas fa-brain"></i> Analysis</div>
      ${sections}
    </div>
  `;
}

/* ── Site Graph expand/collapse for memory items ── */

function toggleMemoryGraph(memoryItem) {
  const memoryId = memoryItem.dataset.memoryId;

  // If already expanded, collapse
  if (memoryItem.classList.contains('graph-expanded')) {
    collapseMemoryGraph(memoryItem);
    return;
  }

  // Collapse any other expanded graph first
  const existingExpanded = document.querySelector('.memory-item.graph-expanded');
  if (existingExpanded) {
    collapseMemoryGraph(existingExpanded);
  }

  // Expand the clicked item
  expandMemoryGraph(memoryItem, memoryId);
}

async function expandMemoryGraph(memoryItem, memoryId) {
  if (typeof SiteGraph === 'undefined') {
    showToast('Graph engine not available', 'error');
    return;
  }

  // Get memory data
  let memory;
  try {
    const memories = await memoryManager.getAll();
    memory = memories.find(m => m.id === memoryId);
  } catch (err) {
    showToast('Failed to load memory data', 'error');
    return;
  }
  if (!memory) {
    showToast('Memory not found', 'error');
    return;
  }

  const sitePattern = memory.typeData?.sitePattern;
  if (!sitePattern) {
    showToast('No site pattern data in this memory', 'error');
    return;
  }

  // Transform data for the graph
  const graphData = SiteGraph.transformData(sitePattern);
  if (!graphData.nodes || graphData.nodes.length === 0) {
    showToast('No pages found in site map', 'info');
    return;
  }

  // Mark item as expanded
  memoryItem.classList.add('graph-expanded');

  // Create wrapper container
  const wrapper = document.createElement('div');
  wrapper.className = 'site-graph-container';

  // Build legend based on data present
  const hasPages = graphData.nodes.some(n => n.type === 'page');
  const hasForms = graphData.nodes.some(n => n.type === 'form');
  const hasElements = graphData.nodes.some(n => n.type === 'element');
  const hasWorkflowLinks = graphData.links.some(l => l.type === 'workflow');

  const hasDiscovered = graphData.nodes.some(n => n.discovered);

  let legendItems = '';
  if (hasPages) legendItems += '<span class="site-graph-legend-item"><span class="site-graph-legend-dot" style="background: var(--info-color); opacity: 0.7;"></span> Page</span>';
  if (hasDiscovered) legendItems += '<span class="site-graph-legend-item"><span class="site-graph-legend-dot" style="background: transparent; border: 1.5px dashed var(--info-color); opacity: 0.5;"></span> Discovered</span>';
  if (hasForms) legendItems += '<span class="site-graph-legend-item"><span class="site-graph-legend-dot" style="background: #d97706; opacity: 0.7;"></span> Form</span>';
  if (hasElements) legendItems += '<span class="site-graph-legend-item"><span class="site-graph-legend-dot" style="background: var(--text-muted, #737373); opacity: 0.5; border: 1px dashed var(--text-muted, #737373); background: transparent;"></span> Element</span>';
  if (hasWorkflowLinks) legendItems += '<span class="site-graph-legend-item"><span class="site-graph-legend-dot" style="background: transparent; border: 1.5px dashed var(--success-color, #059669);"></span> Workflow</span>';

  if (legendItems) {
    const legend = document.createElement('div');
    legend.className = 'site-graph-legend';
    legend.innerHTML = legendItems;
    wrapper.appendChild(legend);
  }

  // Detail toggle toolbar
  const savedLevel = localStorage.getItem('fsbGraphDetailLevel') || 'simple';
  const toolbar = document.createElement('div');
  toolbar.className = 'site-graph-toolbar';
  const toggle = document.createElement('div');
  toggle.className = 'site-graph-detail-toggle';
  toggle.innerHTML =
    '<button class="detail-btn' + (savedLevel === 'simple' ? ' active' : '') + '" data-level="simple">Simple</button>' +
    '<button class="detail-btn' + (savedLevel === 'full' ? ' active' : '') + '" data-level="full">Full</button>';
  toolbar.appendChild(toggle);
  wrapper.appendChild(toolbar);

  // Insert wrapper after the memory item
  memoryItem.after(wrapper);

  // Current detail level state
  let currentDetailLevel = savedLevel;

  function renderGraph() {
    requestAnimationFrame(() => {
      const rect = wrapper.getBoundingClientRect();
      const width = Math.max(rect.width - 16, 300);
      // Scale height based on node count for larger graphs
      const nodeCount = graphData.nodes.length;
      const graphHeight = nodeCount > 40 ? 600 : nodeCount > 20 ? 520 : 440;
      SiteGraph.render(wrapper, graphData, { width, height: graphHeight, memoryId, detailLevel: currentDetailLevel });
    });
  }

  // Toggle click handler
  toggle.addEventListener('click', (e) => {
    const btn = e.target.closest('.detail-btn');
    if (!btn) return;
    const level = btn.dataset.level;
    if (level === currentDetailLevel) return;

    currentDetailLevel = level;
    localStorage.setItem('fsbGraphDetailLevel', level);

    // Update active state
    toggle.querySelectorAll('.detail-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    // Re-render with new detail level
    SiteGraph.destroy(wrapper);
    renderGraph();
  });

  // Initial render
  renderGraph();

  // Scroll into view
  memoryItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function collapseMemoryGraph(memoryItem) {
  memoryItem.classList.remove('graph-expanded');

  // Find the graph container that follows this memory item
  const nextSibling = memoryItem.nextElementSibling;
  if (nextSibling && nextSibling.classList.contains('site-graph-container')) {
    if (typeof SiteGraph !== 'undefined') SiteGraph.destroy(nextSibling);
    nextSibling.remove();
  }
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

async function handleMemoryImport(event) {
  const file = event.target.files[0];
  if (!file) return;
  // Reset input so same file can be re-selected
  event.target.value = '';

  try {
    const text = await file.text();
    let imported;
    try {
      imported = JSON.parse(text);
    } catch {
      showToast('Invalid JSON file', 'error');
      return;
    }

    // Accept both array and single object
    if (!Array.isArray(imported)) {
      if (imported && typeof imported === 'object' && imported.id) {
        imported = [imported];
      } else {
        showToast('Invalid memory file format', 'error');
        return;
      }
    }

    if (imported.length === 0) {
      showToast('No memories found in file', 'error');
      return;
    }

    // Check for duplicates by id
    const existing = await memoryManager.getAll();
    const existingIds = new Set(existing.map(m => m.id));
    const duplicates = imported.filter(m => existingIds.has(m.id));
    const newMemories = imported.filter(m => !existingIds.has(m.id));

    // Validate new memories
    const valid = [];
    const invalid = [];
    for (const memory of newMemories) {
      const validation = validateMemory(memory);
      if (validation.valid) {
        valid.push(memory);
      } else {
        invalid.push(memory);
      }
    }

    // Confirmation dialog
    const msg = `Import ${valid.length} memories?\n` +
      (duplicates.length > 0 ? `${duplicates.length} duplicates will be skipped.\n` : '') +
      (invalid.length > 0 ? `${invalid.length} invalid entries will be skipped.\n` : '');
    if (!confirm(msg)) return;

    // Import valid memories
    let added = 0;
    for (const memory of valid) {
      const success = await memoryStorage.add(memory);
      if (success) added++;
    }

    loadMemoryDashboard();
    showToast(`Imported ${added} memories` +
      (duplicates.length > 0 ? `, ${duplicates.length} duplicates skipped` : '') +
      (invalid.length > 0 ? `, ${invalid.length} invalid skipped` : ''),
      added > 0 ? 'success' : 'info');
  } catch (error) {
    showToast('Import failed: ' + error.message, 'error');
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

// Initialize agent section, memory section, and CLI validation when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(initializeAgentSection, 300);
  setTimeout(initializeMemorySection, 400);
  setTimeout(initCLIValidation, 500);
});


// =========================================================================
// CLI Validation Section
// =========================================================================

/**
 * Show or hide the CLI Validation nav item based on Debug Mode state.
 * @param {boolean} enabled - Whether debug mode is enabled
 */
function updateCLIValidationVisibility(enabled) {
  const cliNavItem = document.querySelector('.debug-only-nav');
  if (cliNavItem) {
    cliNavItem.style.display = enabled ? '' : 'none';
  }
}

/**
 * Initialize CLI Validation section controls and event listeners.
 */
function initCLIValidation() {
  const runAllBtn = document.getElementById('runAllTestsBtn');
  const runTokenBtn = document.getElementById('runTokenComparisonBtn');
  const runEdgeCasesBtn = document.getElementById('runEdgeCasesBtn');
  const liveToggle = document.getElementById('liveTestMode');
  const modeBadge = document.getElementById('testModeBadge');

  if (!runAllBtn) return; // Section not present

  // Toggle live/golden mode
  liveToggle.addEventListener('change', () => {
    modeBadge.textContent = liveToggle.checked ? 'Live' : 'Golden';
    modeBadge.className = 'mode-badge ' + (liveToggle.checked ? 'mode-live' : '');
  });

  // Run All Tests button
  runAllBtn.addEventListener('click', async () => {
    runAllBtn.disabled = true;
    try {
      await runCLIValidationTests(liveToggle.checked);
    } finally {
      runAllBtn.disabled = false;
    }
  });

  // Token Comparison button
  runTokenBtn.addEventListener('click', async () => {
    runTokenBtn.disabled = true;
    try {
      await runTokenComparison();
    } finally {
      runTokenBtn.disabled = false;
    }
  });

  // Edge Cases button
  runEdgeCasesBtn.addEventListener('click', async () => {
    runEdgeCasesBtn.disabled = true;
    try {
      await runEdgeCaseTests();
    } finally {
      runEdgeCasesBtn.disabled = false;
    }
  });
}

/**
 * Run CLI compliance validation tests across all providers.
 * @param {boolean} isLive - If true, use live API calls; if false, use golden responses
 */
async function runCLIValidationTests(isLive) {
  const progressEl = document.getElementById('testProgress');
  const summaryEl = document.getElementById('validationSummary');
  const providerResultsEl = document.getElementById('providerResults');
  const detailedResultsEl = document.getElementById('detailedResults');

  if (!window.CLIValidator || !window.DEFAULT_SUITES) {
    showToast('CLI Validator not loaded. Ensure cli-validator.js is included.', 'error');
    return;
  }

  const validator = new window.CLIValidator();
  for (const suite of window.DEFAULT_SUITES) {
    validator.registerSuite(suite);
  }

  validator.mode = isLive ? 'live' : 'golden';

  if (isLive) {
    validator.liveAPICallback = async (provider, prompt, domSnapshot) => {
      try {
        const response = await chrome.runtime.sendMessage({
          action: 'CLI_VALIDATION_LIVE_TEST',
          provider,
          systemPrompt: prompt,
          userMessage: 'Complete the task based on the current page state.',
          domSnapshot
        });
        if (response && response.success) {
          return response.response;
        }
        throw new Error(response?.error || 'Live test call failed');
      } catch (e) {
        throw new Error('Live test failed: ' + e.message);
      }
    };
  }

  const providers = ['xai', 'openai', 'anthropic', 'gemini'];
  const totalTests = providers.length * validator.testSuites.length;
  let completed = 0;

  validator.onProgress = (result) => {
    completed++;
    if (progressEl) {
      progressEl.textContent = `Running test ${completed} of ${totalTests}...`;
    }
  };

  if (progressEl) progressEl.textContent = 'Starting tests...';

  try {
    const results = await validator.runAll(providers);
    const report = validator.generateReport(results);

    if (progressEl) progressEl.textContent = `Complete: ${report.summary.passed} passed, ${report.summary.failed} failed`;

    // Update summary cards
    document.getElementById('totalTestsPassed').textContent = report.summary.passed;
    document.getElementById('totalTestsFailed').textContent = report.summary.failed;

    const totalTests2 = report.summary.total;
    const compliancePct = totalTests2 > 0 ? Math.round((report.summary.passed / totalTests2) * 100) : 0;
    document.getElementById('complianceRate').textContent = compliancePct + '%';

    summaryEl.style.display = '';

    // Render provider results
    renderProviderResults(report, providerResultsEl);
    providerResultsEl.style.display = '';

    // Render detailed results (failures only)
    renderDetailedResults(report, detailedResultsEl);
    if (report.failures.length > 0) {
      detailedResultsEl.style.display = '';
    }
  } catch (e) {
    if (progressEl) progressEl.textContent = 'Error: ' + e.message;
    showToast('Test run failed: ' + e.message, 'error');
  }
}

/**
 * Render per-provider result cards.
 * @param {Object} report - Report from CLIValidator.generateReport
 * @param {HTMLElement} container - The provider-results container
 */
function renderProviderResults(report, container) {
  container.innerHTML = '';

  for (const [provider, stats] of Object.entries(report.perProvider)) {
    const compliancePct = stats.total > 0 ? Math.round((stats.passed / stats.total) * 100) : 0;
    const complianceClass = compliancePct === 100 ? 'compliance-high' : compliancePct >= 50 ? 'compliance-mid' : 'compliance-low';

    // Build per-task-type list for this provider
    const taskItems = report.perTest
      .filter(t => t.provider === provider)
      .map(t => {
        const badge = t.passed
          ? '<span class="status-badge pass">PASS</span>'
          : '<span class="status-badge fail">FAIL</span>';
        return `<div class="provider-task-item">
          <span class="task-name">${t.taskType}</span>
          ${badge}
        </div>`;
      }).join('');

    const card = document.createElement('div');
    card.className = 'provider-card';
    card.innerHTML = `
      <div class="provider-card-header">
        <h3>${provider}</h3>
      </div>
      <div class="provider-card-stats">
        <div class="stat-item"><span class="stat-value">${stats.passed}</span> passed</div>
        <div class="stat-item"><span class="stat-value">${stats.failed}</span> failed</div>
      </div>
      <div class="compliance-bar">
        <div class="compliance-bar-fill ${complianceClass}" style="width: ${compliancePct}%"></div>
      </div>
      <div class="compliance-pct ${complianceClass}">${compliancePct}%</div>
      <div class="provider-task-list">${taskItems}</div>
    `;

    container.appendChild(card);
  }
}

/**
 * Render detailed failure results with expandable diff display.
 * @param {Object} report - Report from CLIValidator.generateReport
 * @param {HTMLElement} container - The detailed-results container
 */
function renderDetailedResults(report, container) {
  container.innerHTML = '';

  if (report.failures.length === 0) {
    container.innerHTML = '<div style="padding: 1rem; color: var(--success-color); font-weight: 500;">All tests passed -- no failures to display.</div>';
    return;
  }

  for (const failure of report.failures) {
    const item = document.createElement('div');
    item.className = 'test-result-item';

    const diffText = typeof failure.diff === 'string'
      ? failure.diff.split('\n').map(line => {
          if (line.startsWith('! ')) return `<span class="diff-line-mismatch">${escapeHtml(line)}</span>`;
          return `<span class="diff-line-match">${escapeHtml(line)}</span>`;
        }).join('\n')
      : escapeHtml(String(failure.diff || 'No diff available'));

    const failureTypeDisplay = failure.failureType || 'Unknown';

    item.innerHTML = `
      <div class="test-result-header" onclick="this.classList.toggle('expanded'); this.nextElementSibling.classList.toggle('expanded');">
        <span class="result-provider">${failure.provider}</span>
        <span class="result-task">${failure.taskType}</span>
        <span class="status-badge fail">FAIL</span>
        <span class="result-expand"><i class="fas fa-chevron-right"></i></span>
      </div>
      <div class="test-result-body">
        <div class="failure-type-label">${escapeHtml(failureTypeDisplay)}</div>
        <div class="diff-display">${diffText}</div>
      </div>
    `;

    container.appendChild(item);
  }
}

/**
 * Escape HTML special characters for safe rendering.
 * @param {string} str - Input string
 * @returns {string} Escaped string
 */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

/**
 * Run token comparison between CLI and JSON formats.
 */
async function runTokenComparison() {
  const tokenResultsEl = document.getElementById('tokenResults');
  const avgReductionEl = document.getElementById('avgTokenReduction');

  if (!window.TokenComparator) {
    showToast('TokenComparator not loaded. Ensure token-comparator.js is included.', 'error');
    return;
  }

  tokenResultsEl.innerHTML = '<div style="padding: 1rem; color: var(--text-muted);">Running token comparisons...</div>';
  tokenResultsEl.style.display = '';

  try {
    const comparator = new window.TokenComparator();
    const data = await comparator.runAllComparisons();

    // Build header
    const avgPct = data.summary.averageReduction;
    const meetsTarget = data.summary.meetsTarget;
    const headerColor = meetsTarget ? 'var(--success-color)' : 'var(--error-color)';

    let html = `
      <div class="token-results-header">
        <div>
          <div class="aggregate-value" style="color: ${headerColor}">${avgPct}%</div>
          <div class="aggregate-label">Average Token Reduction ${meetsTarget ? '(meets 40% target)' : '(below 40% target)'}</div>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 0.875rem; color: var(--text-muted);">CLI: ${data.summary.totalCliTokens.toLocaleString()} | JSON: ${data.summary.totalJsonTokens.toLocaleString()}</div>
          ${data.summary.isEstimation ? '<div style="font-size: 0.75rem; color: var(--warning-color);">Estimated (tokenizer not available)</div>' : ''}
        </div>
      </div>
    `;

    // Build rows
    for (const result of data.results) {
      if (result.error) {
        html += `<div class="token-row"><span class="snapshot-name">${result.snapshot}</span><span style="grid-column: span 4; color: var(--error-color);">Error: ${escapeHtml(result.error)}</span></div>`;
        continue;
      }

      const reductionPct = result.reduction.total;
      const reductionClass = result.meetsTarget ? 'reduction-pass' : 'reduction-fail';
      const reductionColor = result.meetsTarget ? 'var(--success-color)' : 'var(--error-color)';
      const barWidth = Math.min(Math.abs(reductionPct), 100);

      html += `
        <div class="token-row">
          <span class="snapshot-name">${result.snapshot || 'Unknown'}</span>
          <span class="token-count">CLI: ${result.cliTokens.total.toLocaleString()}</span>
          <span class="token-count">JSON: ${result.jsonTokens.total.toLocaleString()}</span>
          <span class="reduction-pct" style="color: ${reductionColor}">${reductionPct}%</span>
          <div class="reduction-bar"><div class="reduction-bar-fill ${reductionClass}" style="width: ${barWidth}%"></div></div>
        </div>
      `;
    }

    tokenResultsEl.innerHTML = html;

    // Update summary card
    if (avgReductionEl) {
      avgReductionEl.textContent = avgPct + '%';
    }

    // Show summary
    document.getElementById('validationSummary').style.display = '';
  } catch (e) {
    tokenResultsEl.innerHTML = `<div style="padding: 1rem; color: var(--error-color);">Token comparison failed: ${escapeHtml(e.message)}</div>`;
    showToast('Token comparison failed: ' + e.message, 'error');
  }
}

/**
 * Run edge case parsing tests.
 */
async function runEdgeCaseTests() {
  const detailedResultsEl = document.getElementById('detailedResults');

  if (typeof parseCliResponse !== 'function') {
    showToast('CLI parser not loaded. Ensure cli-parser.js is included.', 'error');
    return;
  }

  detailedResultsEl.innerHTML = '<div style="padding: 1rem; color: var(--text-muted);">Running edge case tests...</div>';
  detailedResultsEl.style.display = '';

  const edgeCases = [
    {
      name: 'Special Characters',
      file: 'special-chars.txt',
      validate: (parsed) => {
        if (!parsed || !parsed.actions || parsed.actions.length === 0) return { pass: false, detail: 'No actions parsed' };
        const typeActions = parsed.actions.filter(a => a.tool === 'type');
        if (typeActions.length < 5) return { pass: false, detail: `Expected >= 5 type commands, got ${typeActions.length}` };
        // Check special chars preserved
        const hasQuotes = typeActions.some(a => a.params?.text?.includes('"'));
        const hasDollar = typeActions.some(a => a.params?.text?.includes('$'));
        if (!hasQuotes && !hasDollar) return { pass: false, detail: 'Special characters were mangled' };
        return { pass: true, detail: `${typeActions.length} type commands parsed with special chars preserved` };
      }
    },
    {
      name: 'URL Arguments',
      file: 'url-arguments.txt',
      validate: (parsed) => {
        if (!parsed || !parsed.actions || parsed.actions.length === 0) return { pass: false, detail: 'No actions parsed' };
        const navActions = parsed.actions.filter(a => a.tool === 'navigate');
        if (navActions.length < 2) return { pass: false, detail: `Expected >= 2 navigate commands, got ${navActions.length}` };
        const hasQueryParam = navActions.some(a => a.params?.url?.includes('?'));
        if (!hasQueryParam) return { pass: false, detail: 'URL query parameters were truncated' };
        return { pass: true, detail: `${navActions.length} navigate commands with intact URLs` };
      }
    },
    {
      name: 'YAML Block',
      file: 'yaml-block.txt',
      validate: (parsed) => {
        if (!parsed || !parsed.actions || parsed.actions.length === 0) return { pass: false, detail: 'No actions parsed' };
        const storeActions = parsed.actions.filter(a => a.tool === 'storejobdata' || a.tool === 'storeJobData');
        if (storeActions.length === 0) return { pass: false, detail: 'No storeJobData/storejobdata actions found' };
        const hasData = storeActions.some(a => a.params?.data && typeof a.params.data === 'object');
        if (!hasData) return { pass: false, detail: 'storeJobData has no structured data in params' };
        return { pass: true, detail: `${storeActions.length} storeJobData command(s) with structured YAML data` };
      }
    },
    {
      name: 'Multiline Reasoning',
      file: 'multiline-reasoning.txt',
      validate: (parsed) => {
        if (!parsed) return { pass: false, detail: 'Parse returned null' };
        const reasoningCount = (parsed.reasoning || []).length;
        const actionCount = (parsed.actions || []).length;
        if (reasoningCount < 5) return { pass: false, detail: `Expected >= 5 reasoning lines, got ${reasoningCount}` };
        if (actionCount < 3) return { pass: false, detail: `Expected >= 3 actions, got ${actionCount}` };
        return { pass: true, detail: `${reasoningCount} reasoning lines, ${actionCount} actions` };
      }
    }
  ];

  const results = [];

  for (const edgeCase of edgeCases) {
    try {
      const url = chrome.runtime.getURL(`test-data/edge-cases/${edgeCase.file}`);
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Failed to load ${edgeCase.file}: ${response.status}`);
      const text = await response.text();

      // Parse through CLI parser
      const parsed = parseCliResponse(text);
      const result = edgeCase.validate(parsed);
      results.push({ name: edgeCase.name, ...result });
    } catch (e) {
      results.push({ name: edgeCase.name, pass: false, detail: 'Error: ' + e.message });
    }
  }

  // Render results
  let html = '';
  for (const r of results) {
    const badge = r.pass
      ? '<span class="status-badge pass">PASS</span>'
      : '<span class="status-badge fail">FAIL</span>';
    html += `
      <div class="test-result-item">
        <div class="test-result-header">
          <span class="result-provider">${escapeHtml(r.name)}</span>
          <span class="result-task">${escapeHtml(r.detail)}</span>
          ${badge}
        </div>
      </div>
    `;
  }

  detailedResultsEl.innerHTML = html;

  const passedCount = results.filter(r => r.pass).length;
  showToast(`Edge cases: ${passedCount}/${results.length} passed`, passedCount === results.length ? 'success' : 'warning');
}

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