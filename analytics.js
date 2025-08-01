// FSB Analytics - Usage Tracking and Cost Calculation
// Manages token counting, cost calculation, and usage analytics

class FSBAnalytics {
  constructor() {
    // Model pricing per 1M tokens (USD)
    this.pricing = {
      'grok-4': { input: 3.00, output: 15.00 },
      'gemini-2.5-pro': { input: 1.25, output: 10.00 },
      'openai-o3': { input: 10.00, output: 40.00 },
      'claude-4-opus': { input: 15.00, output: 75.00 },
      'gpt-4o': { input: 2.50, output: 10.00 },
      'llama-3.1-405b': { input: 0.80, output: 0.80 },
      'claude-4-sonnet': { input: 3.00, output: 15.00 },
      'grok-3': { input: 3.00, output: 15.00 },
      'deepseek-v3': { input: 0.27, output: 1.10 },
      'gemini-2.0-flash': { input: 0.10, output: 0.40 },
      'gemini-1.5-flash': { input: 0.075, output: 0.30 },
      'grok-3-mini': { input: 0.30, output: 0.50 },
      'grok-3-mini-fast': { input: 0.30, output: 0.50 },
      'gpt-4o-mini': { input: 0.15, output: 0.60 }
    };

    // Usage data storage
    this.usageData = [];
    this.sessionStartTime = Date.now();
    this.currentModel = 'grok-3-mini';
    
    // Chart instance
    this.chart = null;
    
    // Initialization promise for async operations
    this.initialized = false;
    this.initPromise = this.initialize();
  }
  
  // Async initialization method
  async initialize() {
    try {
      console.log('FSB Analytics initializing...');
      
      // Load existing data
      await this.loadStoredData();
      
      // Start session timer
      this.startSessionTimer();
      
      this.initialized = true;
      console.log('FSB Analytics initialized successfully');
    } catch (error) {
      console.error('Failed to initialize FSB Analytics:', error);
    }
  }
  
  // Ensure initialization before operations
  async ensureInitialized() {
    if (!this.initialized) {
      await this.initPromise;
    }
  }

  // Load stored usage data from chrome storage
  async loadStoredData() {
    try {
      const result = await chrome.storage.local.get(['fsbUsageData', 'fsbCurrentModel']);
      console.log('Analytics: Loading stored data:', {
        hasUsageData: !!result.fsbUsageData,
        dataLength: result.fsbUsageData ? result.fsbUsageData.length : 0,
        currentModel: result.fsbCurrentModel
      });
      
      if (result.fsbUsageData) {
        this.usageData = result.fsbUsageData;
        console.log(`Analytics: Loaded ${this.usageData.length} usage entries`);
        // Clean old data (keep only last 30 days)
        this.cleanOldData();
        console.log(`Analytics: After cleanup, ${this.usageData.length} entries remain`);
      } else {
        console.log('Analytics: No stored usage data found, starting fresh');
      }
      
      if (result.fsbCurrentModel) {
        this.currentModel = result.fsbCurrentModel;
      }
    } catch (error) {
      console.error('Failed to load analytics data:', error);
    }
  }

  // Save usage data to chrome storage
  async saveData() {
    try {
      await chrome.storage.local.set({
        fsbUsageData: this.usageData,
        fsbCurrentModel: this.currentModel
      });
    } catch (error) {
      console.error('Failed to save analytics data:', error);
    }
  }

  // Clean data older than 30 days
  cleanOldData() {
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    this.usageData = this.usageData.filter(entry => entry.timestamp > thirtyDaysAgo);
  }

  // Track AI request usage
  async trackUsage(model, inputTokens, outputTokens, success = true) {
    try {
      // Ensure initialization is complete
      await this.ensureInitialized();
      
      const entry = {
        timestamp: Date.now(),
        model: model,
        inputTokens: inputTokens || 0,
        outputTokens: outputTokens || 0,
        success: success,
        cost: this.calculateCost(model, inputTokens, outputTokens)
      };

      this.usageData.push(entry);
      this.currentModel = model;
      
      console.log('Usage tracked:', entry);
      
      // Save to storage (async)
      await this.saveData();
      
      // Update dashboard
      this.updateDashboard();
      
    } catch (error) {
      console.error('Failed to track usage:', error);
    }
  }

  // Calculate cost for a request
  calculateCost(model, inputTokens, outputTokens) {
    const modelKey = this.normalizeModelName(model);
    const pricing = this.pricing[modelKey];
    
    if (!pricing) {
      console.warn(`No pricing data for model: ${model}`);
      return 0;
    }

    const inputCost = (inputTokens / 1000000) * pricing.input;
    const outputCost = (outputTokens / 1000000) * pricing.output;
    return inputCost + outputCost;
  }

  // Normalize model names to match pricing keys
  normalizeModelName(model) {
    const normalizations = {
      'grok-3-mini': 'grok-3-mini',
      'grok-3-mini-fast': 'grok-3-mini-fast',
      'grok-3': 'grok-3',
      'grok-4': 'grok-4',
      'gemini-2.0-flash': 'gemini-2.0-flash',
      'gemini-1.5-flash': 'gemini-1.5-flash'
    };
    
    return normalizations[model] || model;
  }

  // Get all-time usage statistics (no time filtering)
  getAllTimeStats() {
    const stats = {
      totalRequests: this.usageData.length,
      successfulRequests: this.usageData.filter(entry => entry.success).length,
      totalInputTokens: this.usageData.reduce((sum, entry) => sum + entry.inputTokens, 0),
      totalOutputTokens: this.usageData.reduce((sum, entry) => sum + entry.outputTokens, 0),
      totalCost: this.usageData.reduce((sum, entry) => sum + entry.cost, 0),
      successRate: 0,
      averageCostPerRequest: 0
    };

    if (stats.totalRequests > 0) {
      stats.successRate = (stats.successfulRequests / stats.totalRequests) * 100;
      stats.averageCostPerRequest = stats.totalCost / stats.totalRequests;
    }

    stats.totalTokens = stats.totalInputTokens + stats.totalOutputTokens;

    return stats;
  }

  // Get usage statistics for a time period
  getStats(timeRange = '24h') {
    const now = Date.now();
    let startTime;

    switch (timeRange) {
      case '24h':
        startTime = now - (24 * 60 * 60 * 1000);
        break;
      case '7d':
        startTime = now - (7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startTime = now - (30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startTime = now - (24 * 60 * 60 * 1000);
    }

    const filteredData = this.usageData.filter(entry => entry.timestamp >= startTime);

    const stats = {
      totalRequests: filteredData.length,
      successfulRequests: filteredData.filter(entry => entry.success).length,
      totalInputTokens: filteredData.reduce((sum, entry) => sum + entry.inputTokens, 0),
      totalOutputTokens: filteredData.reduce((sum, entry) => sum + entry.outputTokens, 0),
      totalCost: filteredData.reduce((sum, entry) => sum + entry.cost, 0),
      successRate: 0,
      averageCostPerRequest: 0
    };

    if (stats.totalRequests > 0) {
      stats.successRate = (stats.successfulRequests / stats.totalRequests) * 100;
      stats.averageCostPerRequest = stats.totalCost / stats.totalRequests;
    }

    stats.totalTokens = stats.totalInputTokens + stats.totalOutputTokens;

    return stats;
  }

  // Get chart data for different time ranges
  getChartData(timeRange = '24h') {
    console.log(`Analytics: Getting chart data for time range: ${timeRange}`);
    const stats = this.getStats(timeRange);
    console.log('Analytics: Stats for chart:', stats);
    
    const now = Date.now();
    let startTime, interval, labels = [];

    switch (timeRange) {
      case '24h':
        startTime = now - (24 * 60 * 60 * 1000);
        interval = 60 * 60 * 1000; // 1 hour intervals
        for (let i = 24; i >= 0; i--) {
          const time = new Date(now - (i * interval));
          labels.push(time.getHours() + ':00');
        }
        break;
      case '7d':
        startTime = now - (7 * 24 * 60 * 60 * 1000);
        interval = 24 * 60 * 60 * 1000; // 1 day intervals
        for (let i = 7; i >= 0; i--) {
          const time = new Date(now - (i * interval));
          labels.push(time.toLocaleDateString(undefined, { weekday: 'short' }));
        }
        break;
      case '30d':
        startTime = now - (30 * 24 * 60 * 60 * 1000);
        interval = 24 * 60 * 60 * 1000; // 1 day intervals
        for (let i = 30; i >= 0; i--) {
          const time = new Date(now - (i * interval));
          labels.push(time.getDate());
        }
        break;
    }

    // Aggregate data by time intervals
    const inputData = new Array(labels.length).fill(0);
    const outputData = new Array(labels.length).fill(0);

    this.usageData.forEach(entry => {
      if (entry.timestamp >= startTime) {
        const intervalIndex = Math.floor((now - entry.timestamp) / interval);
        const dataIndex = labels.length - 1 - intervalIndex;
        
        if (dataIndex >= 0 && dataIndex < labels.length) {
          inputData[dataIndex] += entry.inputTokens;
          outputData[dataIndex] += entry.outputTokens;
        }
      }
    });

    const chartData = {
      labels,
      datasets: [
        {
          label: 'Input Tokens',
          data: inputData,
          borderColor: '#ff6b35',
          backgroundColor: 'rgba(255, 107, 53, 0.1)',
          tension: 0.4,
          fill: true
        },
        {
          label: 'Output Tokens',
          data: outputData,
          borderColor: '#4f46e5',
          backgroundColor: 'rgba(79, 70, 229, 0.1)',
          tension: 0.4,
          fill: true
        }
      ]
    };
    
    console.log('Analytics: Final chart data structure:', {
      labelsCount: chartData.labels.length,
      inputDataSum: inputData.reduce((a, b) => a + b, 0),
      outputDataSum: outputData.reduce((a, b) => a + b, 0),
      sampleLabels: chartData.labels.slice(0, 5)
    });
    
    return chartData;
  }

  // Initialize the usage chart
  initializeChart() {
    console.log('Analytics: Initializing chart...');
    
    // Check if Chart.js is loaded
    if (typeof Chart === 'undefined') {
      console.error('Analytics: Chart.js is not loaded! Retrying in 1 second...');
      setTimeout(() => this.initializeChart(), 1000);
      return;
    }
    
    const ctx = document.getElementById('usageChart');
    if (!ctx) {
      console.error('Analytics: Canvas element #usageChart not found!');
      return;
    }
    
    console.log('Analytics: Canvas element found, creating chart...');

    const chartData = this.getChartData('24h');
    console.log('Analytics: Chart data prepared:', chartData);

    try {
      this.chart = new Chart(ctx, {
      type: 'line',
      data: chartData,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            labels: {
              usePointStyle: true,
              padding: 20
            }
          },
          tooltip: {
            mode: 'index',
            intersect: false,
            callbacks: {
              label: function(context) {
                return context.dataset.label + ': ' + context.parsed.y.toLocaleString() + ' tokens';
              }
            }
          }
        },
        scales: {
          x: {
            display: true,
            title: {
              display: true,
              text: 'Time'
            }
          },
          y: {
            display: true,
            title: {
              display: true,
              text: 'Tokens'
            },
            beginAtZero: true
          }
        },
        interaction: {
          mode: 'nearest',
          axis: 'x',
          intersect: false
        }
      }
    });
      
      console.log('Analytics: Chart initialized successfully!');
    } catch (error) {
      console.error('Analytics: Failed to create chart:', error);
      console.error('Analytics: Error details:', error.stack);
    }
  }

  // Update chart with new time range
  updateChart(timeRange) {
    console.log(`Analytics: Updating chart with time range: ${timeRange}`);
    
    if (!this.chart) {
      console.warn('Analytics: Chart not initialized, cannot update');
      return;
    }

    const chartData = this.getChartData(timeRange);
    console.log('Analytics: Updated chart data:', chartData);
    
    this.chart.data = chartData;
    this.chart.update();
    console.log('Analytics: Chart updated successfully');
  }

  // Update dashboard metrics with time range
  updateDashboardWithTimeRange(timeRange = '24h') {
    console.log(`Analytics: updateDashboardWithTimeRange called with range: ${timeRange}`);
    
    const stats = this.getStats(timeRange);
    console.log(`Analytics: Stats for ${timeRange}:`, stats);
    
    // Update hero metrics
    this.updateElement('totalTokensToday', stats.totalTokens.toLocaleString());
    this.updateElement('totalCostToday', '$' + stats.totalCost.toFixed(4));
    this.updateElement('totalRequests', stats.totalRequests.toLocaleString());
    this.updateElement('successRate', stats.successRate.toFixed(1) + '%');
    
    // Update analytics cards
    this.updateElement('inputTokensToday', stats.totalInputTokens.toLocaleString());
    this.updateElement('outputTokensToday', stats.totalOutputTokens.toLocaleString());
    this.updateElement('currentModel', this.formatModelName(this.currentModel));
    
    // Update labels based on time range
    this.updateTimeRangeLabels(timeRange);
    
    // Update session time
    this.updateSessionTime();
  }

  // Update dashboard metrics (all-time by default)
  updateDashboard() {
    console.log('Analytics: updateDashboard called');
    console.log('Analytics: Current usage data:', {
      totalEntries: this.usageData.length,
      firstEntry: this.usageData[0],
      lastEntry: this.usageData[this.usageData.length - 1]
    });
    
    const allTimeStats = this.getAllTimeStats();
    console.log('Analytics: All-time stats:', allTimeStats);
    
    // Update hero metrics with all-time data
    this.updateElement('totalTokensToday', allTimeStats.totalTokens.toLocaleString());
    this.updateElement('totalCostToday', '$' + allTimeStats.totalCost.toFixed(4));
    this.updateElement('totalRequests', allTimeStats.totalRequests.toLocaleString());
    this.updateElement('successRate', allTimeStats.successRate.toFixed(1) + '%');
    
    // Update analytics cards with all-time data
    this.updateElement('inputTokensToday', allTimeStats.totalInputTokens.toLocaleString());
    this.updateElement('outputTokensToday', allTimeStats.totalOutputTokens.toLocaleString());
    this.updateElement('currentModel', this.formatModelName(this.currentModel));
    
    // Update session time
    this.updateSessionTime();
  }

  // Update individual dashboard element
  updateElement(id, value) {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = value;
      console.log(`Analytics: Updated element ${id} with value: ${value}`);
    } else {
      // Only log warnings for critical elements, not optional ones like sessionTime
      const optionalElements = ['sessionTime'];
      if (!optionalElements.includes(id)) {
        console.warn(`Analytics: Element ${id} not found in DOM`);
      }
    }
  }

  // Format model name for display
  formatModelName(model) {
    const displayNames = {
      'grok-3-mini': 'Grok 3 Mini',
      'grok-3-mini-fast': 'Grok 3 Mini Fast',
      'grok-3': 'Grok 3',
      'grok-4': 'Grok 4'
    };
    
    return displayNames[model] || model;
  }

  // Start session timer
  startSessionTimer() {
    setInterval(() => {
      this.updateSessionTime();
    }, 60000); // Update every minute
  }

  // Update time range labels
  updateTimeRangeLabels(timeRange) {
    const labelMappings = {
      '24h': { tokens: 'Tokens Today', cost: 'Cost Today', period: 'Today' },
      '7d': { tokens: 'Tokens (7 Days)', cost: 'Cost (7 Days)', period: 'Last 7 Days' },
      '30d': { tokens: 'Tokens (30 Days)', cost: 'Cost (30 Days)', period: 'Last 30 Days' }
    };
    
    const labels = labelMappings[timeRange] || labelMappings['24h'];
    
    // Update label elements if they exist
    const tokensLabel = document.querySelector('#totalTokensToday').nextElementSibling;
    const costLabel = document.querySelector('#totalCostToday').nextElementSibling;
    const inputLabel = document.querySelector('#inputTokensToday')?.parentElement?.querySelector('.card-subtitle');
    const outputLabel = document.querySelector('#outputTokensToday')?.parentElement?.querySelector('.card-subtitle');
    
    if (tokensLabel) tokensLabel.textContent = labels.tokens;
    if (costLabel) costLabel.textContent = labels.cost;
    if (inputLabel) inputLabel.textContent = labels.period;
    if (outputLabel) outputLabel.textContent = labels.period;
  }

  // Update session time display
  updateSessionTime() {
    const sessionDuration = Date.now() - this.sessionStartTime;
    const minutes = Math.floor(sessionDuration / 60000);
    const hours = Math.floor(minutes / 60);
    
    let timeString;
    if (hours > 0) {
      timeString = `${hours}h ${minutes % 60}m`;
    } else {
      timeString = `${minutes}m`;
    }
    
    this.updateElement('sessionTime', timeString);
  }

  // Get model pricing info
  getModelPricing(model) {
    const normalizedModel = this.normalizeModelName(model);
    return this.pricing[normalizedModel] || { input: 0, output: 0 };
  }
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FSBAnalytics;
}