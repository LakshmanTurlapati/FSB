/* =============================================
   FSB Showcase - Dashboard JavaScript
   Agent monitoring, stats, WebSocket, run history
   ============================================= */

(function () {
  'use strict';

  var API_BASE = '';
  var STORAGE_KEY = 'fsb_dashboard_key';
  var SESSION_KEY = 'fsb_dashboard_session';
  var SESSION_EXPIRES_KEY = 'fsb_dashboard_expires';
  var POLL_INTERVAL = 30000;

  // State
  var hashKey = localStorage.getItem(STORAGE_KEY) || '';
  var sessionToken = localStorage.getItem(SESSION_KEY) || '';
  var sessionExpiresAt = localStorage.getItem(SESSION_EXPIRES_KEY) || '';
  var qrScanner = null;
  var agents = [];
  var stats = {};
  var selectedAgentId = null;
  var runsOffset = 0;
  var runsLimit = 20;
  var pollTimer = null;
  var ws = null;
  var wsReconnectDelay = 0;
  var wsMaxReconnectDelay = 30000;
  var wsReconnectTimer = null;
  var extensionOnline = false;

  // Task control state
  var taskState = 'idle'; // 'idle' | 'running' | 'success' | 'failed'
  var taskText = '';
  var taskStartTime = 0;
  var taskElapsedTimer = null;

  // DOM refs
  var loginSection = document.getElementById('dash-login');
  var contentSection = document.getElementById('dash-content');
  var keyInput = document.getElementById('dash-key-input');
  var connectBtn = document.getElementById('dash-connect-btn');
  var disconnectBtn = document.getElementById('dash-disconnect-btn');
  var agentCountEl = document.getElementById('dash-agent-count');
  var sseStatusEl = document.getElementById('dash-sse-status');
  var agentGrid = document.getElementById('dash-agent-grid');
  var runsPanel = document.getElementById('dash-runs-panel');
  var runsList = document.getElementById('dash-runs-list');
  var runsTitle = document.getElementById('dash-runs-title');
  var runsClose = document.getElementById('dash-runs-close');
  var runsPagination = document.getElementById('dash-runs-pagination');
  var emptyState = document.getElementById('dash-empty');
  var tabScan = document.getElementById('dash-tab-scan');
  var tabPaste = document.getElementById('dash-tab-paste');
  var tabScanContent = document.getElementById('tab-scan');
  var tabPasteContent = document.getElementById('tab-paste');
  var scanError = document.getElementById('dash-scan-error');
  var loginMessage = document.getElementById('dash-login-message');
  var pairedBadge = document.getElementById('dash-paired-badge');

  // Task control DOM refs
  var taskArea = document.getElementById('dash-task-area');
  var taskInput = document.getElementById('dash-task-input');
  var taskSubmitBtn = document.getElementById('dash-task-submit');
  var taskInputRow = document.getElementById('dash-task-input-row');
  var taskProgressView = document.getElementById('dash-task-progress');
  var taskTitle = document.getElementById('dash-task-title');
  var taskBarFill = document.getElementById('dash-task-bar-fill');
  var taskPercent = document.getElementById('dash-task-percent');
  var taskPhase = document.getElementById('dash-task-phase');
  var taskEta = document.getElementById('dash-task-eta');
  var taskElapsed = document.getElementById('dash-task-elapsed');
  var taskAction = document.getElementById('dash-task-action');
  var taskSuccessView = document.getElementById('dash-task-success');
  var taskSuccessStatus = document.getElementById('dash-task-success-status');
  var taskResultText = document.getElementById('dash-task-result-text');
  var taskInputNext = document.getElementById('dash-task-input-next');
  var taskSubmitNext = document.getElementById('dash-task-submit-next');
  var taskFailedView = document.getElementById('dash-task-failed');
  var taskFailedStatus = document.getElementById('dash-task-failed-status');
  var taskErrorText = document.getElementById('dash-task-error-text');
  var taskRetryBtn = document.getElementById('dash-task-retry');
  var taskInputRetry = document.getElementById('dash-task-input-retry');
  var taskSubmitRetry = document.getElementById('dash-task-submit-retry');

  // --- Init ---
  if (sessionToken && sessionExpiresAt) {
    // Check local expiry first (avoid server call if obviously expired)
    if (new Date(sessionExpiresAt) > new Date()) {
      validateSession();
    } else {
      clearSession();
      showExpiredLogin();
    }
  } else if (hashKey) {
    // Legacy: user had hash key but no session token (pre-pairing upgrade)
    validateAndConnect(hashKey);
  }

  // --- Event Listeners ---
  if (connectBtn) {
    connectBtn.addEventListener('click', function () {
      var key = keyInput.value.trim();
      if (!key) return;
      connect(key);
    });
  }

  if (keyInput) {
    keyInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        var key = keyInput.value.trim();
        if (key) connect(key);
      }
    });
  }

  if (disconnectBtn) {
    disconnectBtn.addEventListener('click', disconnect);
  }

  if (runsClose) {
    runsClose.addEventListener('click', closeRunsPanel);
  }

  // Task control listeners
  function setupTaskInput(inputEl, submitEl) {
    if (inputEl) {
      inputEl.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && inputEl.value.trim()) {
          submitTask(inputEl.value.trim());
        }
      });
    }
    if (submitEl) {
      submitEl.addEventListener('click', function () {
        var text = inputEl ? inputEl.value.trim() : '';
        if (text) submitTask(text);
      });
    }
  }

  setupTaskInput(taskInput, taskSubmitBtn);
  setupTaskInput(taskInputNext, taskSubmitNext);
  setupTaskInput(taskInputRetry, taskSubmitRetry);

  if (taskRetryBtn) {
    taskRetryBtn.addEventListener('click', function () {
      if (taskText) submitTask(taskText);
    });
  }

  // --- Task Control ---

  function submitTask(text) {
    if (taskState === 'running') return;
    if (!text) return;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      if (taskAction) { taskAction.textContent = 'Not connected to server. Check your connection.'; taskAction.style.display = 'block'; }
      return;
    }
    if (!extensionOnline) {
      if (taskAction) { taskAction.textContent = 'Extension is offline. Open your FSB extension.'; taskAction.style.display = 'block'; }
      return;
    }

    taskText = text;
    taskStartTime = Date.now();

    ws.send(JSON.stringify({
      type: 'dash:task-submit',
      payload: { task: text },
      ts: Date.now()
    }));

    setTaskState('running', { task: text });
  }

  function setTaskState(newState, data) {
    taskState = newState;
    data = data || {};

    // Clear elapsed timer
    if (taskElapsedTimer) {
      clearInterval(taskElapsedTimer);
      taskElapsedTimer = null;
    }

    // Hide all sub-views
    if (taskInputRow) taskInputRow.style.display = 'none';
    if (taskProgressView) taskProgressView.style.display = 'none';
    if (taskSuccessView) taskSuccessView.style.display = 'none';
    if (taskFailedView) taskFailedView.style.display = 'none';

    switch (newState) {
      case 'idle':
        if (taskInputRow) taskInputRow.style.display = 'flex';
        if (taskInput) { taskInput.value = ''; taskInput.disabled = false; }
        if (taskSubmitBtn) taskSubmitBtn.disabled = false;
        // Reset progress bar
        if (taskBarFill) { taskBarFill.style.width = '0%'; taskBarFill.className = 'dash-task-bar-fill'; }
        break;

      case 'running':
        if (taskProgressView) taskProgressView.style.display = 'block';
        if (taskTitle) taskTitle.textContent = data.task || taskText || '';
        if (taskBarFill) { taskBarFill.style.width = '0%'; taskBarFill.className = 'dash-task-bar-fill'; }
        if (taskPercent) taskPercent.textContent = '0%';
        if (taskPhase) taskPhase.textContent = '';
        if (taskEta) taskEta.textContent = '';
        if (taskElapsed) taskElapsed.textContent = 'Running for 0s';
        if (taskAction) { taskAction.textContent = 'Working...'; taskAction.style.display = ''; }
        // Start elapsed timer
        taskElapsedTimer = setInterval(function () {
          if (taskElapsed && taskStartTime) {
            taskElapsed.textContent = 'Running for ' + formatDuration(Date.now() - taskStartTime);
          }
        }, 1000);
        // Disable all task inputs during run
        disableAllTaskInputs(true);
        break;

      case 'success':
        if (taskProgressView) taskProgressView.style.display = 'block';
        if (taskSuccessView) taskSuccessView.style.display = 'block';
        // Fill progress bar to 100% green
        if (taskBarFill) { taskBarFill.style.width = '100%'; taskBarFill.className = 'dash-task-bar-fill dash-task-bar-success'; }
        if (taskPercent) taskPercent.textContent = '100%';
        // Hide metadata during success
        if (taskPhase) taskPhase.textContent = '';
        if (taskEta) taskEta.textContent = '';
        if (taskElapsed) taskElapsed.textContent = '';
        if (taskAction) taskAction.style.display = 'none';
        // Render success info
        var elapsed = data.elapsed || (Date.now() - taskStartTime);
        if (taskSuccessStatus) taskSuccessStatus.innerHTML = '\u2713 Complete \u00b7 Completed in ' + formatDuration(elapsed);
        if (taskResultText) taskResultText.textContent = data.summary || '';
        // Show next-task input
        disableAllTaskInputs(false);
        if (taskInputNext) { taskInputNext.value = ''; }
        break;

      case 'failed':
        if (taskProgressView) taskProgressView.style.display = 'block';
        if (taskFailedView) taskFailedView.style.display = 'block';
        // Progress bar turns red
        if (taskBarFill) { taskBarFill.className = 'dash-task-bar-fill dash-task-bar-failed'; }
        // Hide metadata
        if (taskPhase) taskPhase.textContent = '';
        if (taskEta) taskEta.textContent = '';
        if (taskElapsed) taskElapsed.textContent = '';
        if (taskAction) taskAction.style.display = 'none';
        // Render failure info
        if (taskFailedStatus) taskFailedStatus.innerHTML = '\u2717 Failed';
        if (taskErrorText) taskErrorText.textContent = data.error || 'Task could not be completed';
        // Show retry + next-task input
        disableAllTaskInputs(false);
        if (taskInputRetry) { taskInputRetry.value = ''; }
        if (taskSubmitRetry) taskSubmitRetry.disabled = true;
        break;
    }
  }

  function updateTaskProgress(payload) {
    if (taskState !== 'running') return;

    var progress = payload.progress || 0;
    if (taskBarFill) {
      var width = progress > 0 ? Math.max(2, progress) : 0;
      taskBarFill.style.width = width + '%';
    }
    if (taskPercent) taskPercent.textContent = Math.round(progress) + '%';

    // Phase label: map internal names to display labels
    var phaseLabels = {
      navigation: 'Navigating',
      extraction: 'Reading page',
      writing: 'Filling form',
      unknown: 'Working'
    };
    if (taskPhase && payload.phase) {
      taskPhase.textContent = phaseLabels[payload.phase] || payload.phase;
    }

    if (taskEta && payload.eta) {
      taskEta.textContent = '~' + payload.eta;
    }

    // Elapsed is handled by the interval timer, but update from server if available
    if (taskElapsed && payload.elapsed) {
      taskElapsed.textContent = 'Running for ' + formatDuration(payload.elapsed);
    }

    if (taskAction && payload.action) {
      taskAction.style.display = '';
      taskAction.textContent = payload.action;
    }
  }

  function handleTaskComplete(payload) {
    // Handle immediate rejections (extension busy, no tab, etc.)
    if (taskState === 'idle' && !payload.success) {
      // Briefly show the error in the task area without full state transition
      if (taskAction) {
        taskAction.style.display = '';
        taskAction.textContent = payload.error || 'Task could not be started';
        setTimeout(function () {
          if (taskState === 'idle' && taskAction) taskAction.style.display = 'none';
        }, 5000);
      }
      return;
    }

    if (payload.success) {
      setTaskState('success', {
        summary: payload.summary || '',
        elapsed: payload.elapsed || 0
      });
    } else {
      setTaskState('failed', {
        error: payload.error || 'Task could not be completed',
        elapsed: payload.elapsed || 0
      });
    }
  }

  function disableAllTaskInputs(disabled) {
    var inputs = [taskInput, taskInputNext, taskInputRetry];
    var btns = [taskSubmitBtn, taskSubmitNext, taskSubmitRetry];
    inputs.forEach(function (el) { if (el) el.disabled = disabled; });
    btns.forEach(function (el) { if (el) el.disabled = disabled; });
  }

  function showTaskArea() {
    if (taskArea) taskArea.style.display = 'block';
    if (taskState === 'idle') {
      setTaskState('idle');
    }
  }

  function hideTaskArea() {
    if (taskArea) taskArea.style.display = 'none';
  }

  function updateTaskOfflineState() {
    if (!taskArea) return;
    if (!extensionOnline) {
      taskArea.classList.add('dash-task-offline');
      if (taskState === 'idle' && taskInput) {
        taskInput.placeholder = 'Extension offline...';
      }
    } else {
      taskArea.classList.remove('dash-task-offline');
      if (taskState === 'idle' && taskInput) {
        taskInput.placeholder = 'What should FSB do?';
        taskInput.disabled = false;
      }
    }
  }

  // --- Auth ---

  function connect(key) {
    clearError();
    connectBtn.innerHTML = '<span class="dash-spinner"></span> Connecting...';
    connectBtn.disabled = true;

    validateKey(key).then(function (result) {
      connectBtn.innerHTML = '<i class="fa-solid fa-plug"></i> Connect';
      connectBtn.disabled = false;

      if (result.valid) {
        hashKey = key;
        localStorage.setItem(STORAGE_KEY, key);
        // For paste-key users, clear any stale session
        clearSession();
        showDashboard();
        loadData();
        connectWS();
        startPolling();
      } else {
        showError(result.error || 'Invalid hash key. Check your key and try again.');
      }
    }).catch(function () {
      connectBtn.innerHTML = '<i class="fa-solid fa-plug"></i> Connect';
      connectBtn.disabled = false;
      showError('Could not connect to server. Check your connection and try again.');
    });
  }

  function validateAndConnect(key) {
    validateKey(key).then(function (result) {
      if (result.valid) {
        showDashboard();
        loadData();
        connectWS();
        startPolling();
      } else {
        // Stored key is invalid, clear it
        localStorage.removeItem(STORAGE_KEY);
        hashKey = '';
      }
    }).catch(function () {
      // Server unreachable -- show dashboard anyway with cached key
      showDashboard();
      loadData();
      startPolling();
    });
  }

  function disconnect() {
    // Revoke session on server (fire and forget)
    if (sessionToken) {
      apiFetch('/api/pair/revoke', {
        method: 'POST',
        headers: { 'X-FSB-Session-Token': sessionToken }
      }).catch(function () {});
    }

    hashKey = '';
    localStorage.removeItem(STORAGE_KEY);
    clearSession();
    agents = [];
    stats = {};
    selectedAgentId = null;
    stopPolling();
    disconnectWS();
    stopQRScanner();
    showLogin();
  }

  function validateKey(key) {
    return apiFetch('/api/auth/validate', {
      headers: { 'X-FSB-Hash-Key': key }
    });
  }

  // --- UI Toggle ---

  function showDashboard() {
    loginSection.classList.add('fade-out');
    setTimeout(function () {
      loginSection.style.display = 'none';
      loginSection.classList.remove('fade-out');
      contentSection.style.display = 'block';
      contentSection.classList.add('fade-in');
      showTaskArea();
    }, 400);
    stopQRScanner();
    if (pairedBadge) pairedBadge.style.display = 'inline-flex';
    if (loginMessage) loginMessage.style.display = 'none';
  }

  function showLogin() {
    contentSection.style.display = 'none';
    contentSection.classList.remove('fade-in', 'fade-dim');
    loginSection.style.display = '';
    loginSection.classList.remove('fade-out');
    hideTaskArea();
    if (keyInput) keyInput.value = '';
    if (pairedBadge) pairedBadge.style.display = 'none';
    // Reset to Scan QR tab
    if (tabScan && tabPaste && tabScanContent && tabPasteContent) {
      tabScan.classList.add('active');
      tabPaste.classList.remove('active');
      tabScanContent.style.display = 'block';
      tabPasteContent.style.display = 'none';
    }
  }

  function showError(msg) {
    clearError();
    var el = document.createElement('p');
    el.className = 'dash-login-error';
    el.textContent = msg;
    el.id = 'dash-error';
    var form = document.querySelector('.dash-login-form');
    form.parentNode.insertBefore(el, form.nextSibling);
  }

  function clearError() {
    var existing = document.getElementById('dash-error');
    if (existing) existing.remove();
  }

  // --- Session Management ---

  function validateSession() {
    apiFetch('/api/pair/validate', {
      headers: { 'X-FSB-Session-Token': sessionToken }
    }).then(function (result) {
      if (result.valid) {
        hashKey = result.hashKey;
        localStorage.setItem(STORAGE_KEY, hashKey);
        showDashboard();
        loadData();
        connectWS();
        startPolling();
      } else {
        clearSession();
        if (result.reason === 'expired') {
          showExpiredLogin();
        } else {
          showLogin();
        }
      }
    }).catch(function () {
      // Server unreachable - try with stored hashKey
      if (hashKey) {
        showDashboard();
        loadData();
        connectWS();
        startPolling();
      }
    });
  }

  function storeSession(newHashKey, newSessionToken, newExpiresAt) {
    hashKey = newHashKey;
    sessionToken = newSessionToken;
    sessionExpiresAt = newExpiresAt;
    localStorage.setItem(STORAGE_KEY, hashKey);
    localStorage.setItem(SESSION_KEY, sessionToken);
    localStorage.setItem(SESSION_EXPIRES_KEY, sessionExpiresAt);
  }

  function clearSession() {
    sessionToken = '';
    sessionExpiresAt = '';
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(SESSION_EXPIRES_KEY);
  }

  function showExpiredLogin() {
    showLogin();
    if (loginMessage) {
      loginMessage.textContent = 'Session expired. Scan QR code to reconnect.';
      loginMessage.className = 'dash-login-message expired';
      loginMessage.style.display = 'block';
    }
  }

  // --- Tab Switching ---

  if (tabScan) {
    tabScan.addEventListener('click', function () { switchTab('scan'); });
  }
  if (tabPaste) {
    tabPaste.addEventListener('click', function () { switchTab('paste'); });
  }

  // Auto-start QR scanner if login card is visible and Scan tab is active
  if (loginSection && loginSection.style.display !== 'none' && tabScan && tabScan.classList.contains('active')) {
    startQRScanner();
  }

  function switchTab(tab) {
    if (tab === 'scan') {
      tabScan.classList.add('active');
      tabPaste.classList.remove('active');
      tabScanContent.style.display = 'block';
      tabPasteContent.style.display = 'none';
      startQRScanner();
    } else {
      tabPaste.classList.add('active');
      tabScan.classList.remove('active');
      tabPasteContent.style.display = 'block';
      tabScanContent.style.display = 'none';
      stopQRScanner();
    }
    // Clear any error messages
    if (scanError) { scanError.style.display = 'none'; }
    clearError();
  }

  // --- QR Scanner ---

  function startQRScanner() {
    if (qrScanner) return; // Already running
    if (typeof Html5Qrcode === 'undefined') {
      showScanError('QR scanner not available');
      switchTab('paste');
      return;
    }

    qrScanner = new Html5Qrcode('qr-reader');

    qrScanner.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 250, height: 250 } },
      function onScanSuccess(decodedText) {
        qrScanner.stop().then(function () {
          qrScanner = null;
          handleScannedQR(decodedText);
        }).catch(function () {
          qrScanner = null;
          handleScannedQR(decodedText);
        });
      },
      function onScanFailure() {
        // Ignore per-frame decode failures - this is normal
      }
    ).catch(function (err) {
      qrScanner = null;
      // Camera permission denied or not available
      var msg = 'Camera unavailable';
      if (err && err.toString().indexOf('NotAllowedError') !== -1) {
        msg = 'Camera unavailable';
      } else if (err && err.toString().indexOf('NotFoundError') !== -1) {
        msg = 'Camera unavailable';
      }
      showScanError(msg);
      switchTab('paste');
    });
  }

  function stopQRScanner() {
    if (qrScanner) {
      qrScanner.stop().then(function () {
        qrScanner = null;
      }).catch(function () {
        qrScanner = null;
      });
    }
  }

  function handleScannedQR(decodedText) {
    try {
      var data = JSON.parse(decodedText);
      if (!data.t) throw new Error('No token in QR data');

      // Show connecting state
      if (tabScanContent) {
        tabScanContent.innerHTML = '<p class="dash-scan-instruction">Connecting...</p>';
      }

      // Exchange token for session
      var exchangeUrl = (data.s || '') + '/api/pair/exchange';
      // If server URL matches our origin, use relative URL
      if (data.s && data.s === location.origin) {
        exchangeUrl = '/api/pair/exchange';
      }
      // Default to relative if no server URL
      if (!data.s) {
        exchangeUrl = '/api/pair/exchange';
      }

      fetch(exchangeUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: data.t })
      }).then(function (resp) {
        if (!resp.ok) {
          return resp.json().then(function (body) {
            throw new Error(body.error || 'Exchange failed');
          });
        }
        return resp.json();
      }).then(function (result) {
        // Store session and connect
        storeSession(result.hashKey, result.sessionToken, result.expiresAt);
        showDashboard();
        loadData();
        connectWS();
        startPolling();
      }).catch(function (err) {
        showScanError(err.message || 'Scan failed -- paste your key instead');
        // Restore scan tab content
        if (tabScanContent) {
          tabScanContent.innerHTML =
            '<p class="dash-scan-instruction">Point camera at QR code in FSB extension</p>' +
            '<div id="qr-reader" class="dash-qr-reader" aria-label="QR code camera viewfinder"></div>' +
            '<p id="dash-scan-error" class="dash-scan-error" style="display: none;"></p>';
        }
        switchTab('paste');
      });

    } catch (err) {
      showScanError('Scan failed -- paste your key instead');
      switchTab('paste');
    }
  }

  function showScanError(msg) {
    var el = document.getElementById('dash-scan-error');
    if (el) {
      el.textContent = msg;
      el.style.display = 'block';
    }
  }

  // --- Data Loading ---

  function loadData() {
    fetchStats();
    fetchAgents();
  }

  function fetchStats() {
    apiFetch('/api/stats', { headers: { 'X-FSB-Hash-Key': hashKey } })
      .then(function (data) {
        stats = data;
        renderStats();
      })
      .catch(function () {});
  }

  function fetchAgents() {
    apiFetch('/api/agents', { headers: { 'X-FSB-Hash-Key': hashKey } })
      .then(function (data) {
        agents = data.agents || [];
        renderAgents();
      })
      .catch(function () {});
  }

  function fetchRuns(agentId, limit, offset) {
    var url = '/api/agents/' + encodeURIComponent(agentId) + '/runs?limit=' + limit + '&offset=' + offset;
    return apiFetch(url, { headers: { 'X-FSB-Hash-Key': hashKey } });
  }

  // --- Rendering ---

  function renderStats() {
    setTextById('stat-agents', stats.totalAgents || 0);
    setTextById('stat-enabled', stats.enabledAgents || 0);
    setTextById('stat-runs-today', stats.runsToday || 0);
    setTextById('stat-success-rate', (stats.successRate || 0) + '%');
    setTextById('stat-total-cost', '$' + (stats.totalCost || 0).toFixed(2));
    setTextById('stat-cost-saved', '$' + (stats.totalCostSaved || 0).toFixed(2));
    var countText = (stats.totalAgents || 0) + ' agent' + ((stats.totalAgents || 0) !== 1 ? 's' : '');
    agentCountEl.textContent = countText + (extensionOnline ? '' : ' - extension offline');
  }

  function renderAgents() {
    agentGrid.innerHTML = '';

    if (agents.length === 0) {
      emptyState.style.display = 'block';
      agentGrid.style.display = 'none';
      return;
    }

    emptyState.style.display = 'none';
    agentGrid.style.display = '';

    agents.forEach(function (agent) {
      var card = document.createElement('div');
      card.className = 'dash-agent-card' + (selectedAgentId === agent.agent_id ? ' selected' : '');
      card.setAttribute('data-agent-id', agent.agent_id);

      var isEnabled = agent.enabled === true || agent.enabled === 1;
      var scheduleLabel = agent.schedule_type || 'manual';

      card.innerHTML =
        '<div class="dash-agent-name">' +
          '<span class="dash-status-dot ' + (isEnabled ? 'dash-status-enabled' : 'dash-status-disabled') + '"></span>' +
          escapeHtml(agent.name) +
        '</div>' +
        '<div class="dash-agent-task">' + escapeHtml(agent.task) + '</div>' +
        '<div class="dash-agent-url">' + escapeHtml(agent.target_url || '') + '</div>' +
        '<div class="dash-agent-meta">' +
          '<span class="dash-agent-schedule">' + escapeHtml(scheduleLabel) + '</span>' +
        '</div>';

      card.addEventListener('click', function () {
        selectAgent(agent.agent_id, agent.name);
      });

      agentGrid.appendChild(card);
    });
  }

  function selectAgent(agentId, agentName) {
    // Toggle selection
    if (selectedAgentId === agentId) {
      closeRunsPanel();
      return;
    }

    selectedAgentId = agentId;
    runsOffset = 0;

    // Update card selection styles
    var cards = agentGrid.querySelectorAll('.dash-agent-card');
    cards.forEach(function (c) {
      c.classList.toggle('selected', c.getAttribute('data-agent-id') === agentId);
    });

    runsTitle.textContent = 'Run History - ' + (agentName || agentId);
    runsPanel.style.display = 'block';
    runsList.innerHTML = '<div class="text-center"><span class="dash-spinner"></span></div>';

    fetchRuns(agentId, runsLimit, 0).then(function (data) {
      renderRuns(data.runs || [], data.total || 0, data.limit || runsLimit, data.offset || 0);
    }).catch(function () {
      runsList.innerHTML = '<p class="text-muted text-center">Failed to load runs.</p>';
    });
  }

  function closeRunsPanel() {
    selectedAgentId = null;
    runsPanel.style.display = 'none';
    var cards = agentGrid.querySelectorAll('.dash-agent-card');
    cards.forEach(function (c) { c.classList.remove('selected'); });
  }

  function renderRuns(runs, total, limit, offset) {
    runsList.innerHTML = '';

    if (runs.length === 0) {
      runsList.innerHTML = '<p class="text-muted text-center">No runs yet for this agent.</p>';
      runsPagination.innerHTML = '';
      return;
    }

    runs.forEach(function (run) {
      var entry = document.createElement('div');
      entry.className = 'dash-run-entry';

      var time = formatTime(run.completed_at);
      var statusClass = run.status === 'success' ? 'dash-run-status-success' :
                        run.status === 'failed' ? 'dash-run-status-failed' :
                        'dash-run-status-unknown';

      var modeBadge = renderModeBadge(run.execution_mode);
      var resultText = run.error || run.result || '-';
      var duration = run.duration_ms ? formatDuration(run.duration_ms) : '-';
      var costStr = '';
      if (run.cost_saved && run.cost_saved > 0) {
        costStr = '-$' + run.cost_saved.toFixed(4);
      } else if (run.cost_usd) {
        costStr = '$' + run.cost_usd.toFixed(4);
      } else {
        costStr = '-';
      }

      entry.innerHTML =
        '<div class="dash-run-time">' + time + '</div>' +
        '<div><span class="dash-run-status ' + statusClass + '">' + escapeHtml(run.status) + '</span></div>' +
        '<div>' + modeBadge + '</div>' +
        '<div class="dash-run-result" title="' + escapeAttr(resultText) + '">' + escapeHtml(resultText) + '</div>' +
        '<div class="dash-run-duration">' + duration + '</div>' +
        '<div class="dash-run-cost">' + costStr + '</div>';

      runsList.appendChild(entry);
    });

    // Pagination
    renderPagination(total, limit, offset);
  }

  function renderModeBadge(mode) {
    if (mode === 'replay') {
      return '<span class="dash-mode-badge dash-mode-replay">Replay</span>';
    }
    if (mode === 'ai_fallback') {
      return '<span class="dash-mode-badge dash-mode-fallback">AI Fallback</span>';
    }
    return '<span class="dash-mode-badge dash-mode-ai">AI</span>';
  }

  function renderPagination(total, limit, offset) {
    runsPagination.innerHTML = '';
    if (total <= limit) return;

    var prevBtn = document.createElement('button');
    prevBtn.textContent = 'Previous';
    prevBtn.disabled = offset === 0;
    prevBtn.addEventListener('click', function () {
      var newOffset = Math.max(0, offset - limit);
      loadRunsPage(newOffset);
    });

    var nextBtn = document.createElement('button');
    nextBtn.textContent = 'Next';
    nextBtn.disabled = (offset + limit) >= total;
    nextBtn.addEventListener('click', function () {
      loadRunsPage(offset + limit);
    });

    var info = document.createElement('span');
    info.className = 'text-muted text-sm';
    info.style.padding = '6px 8px';
    info.textContent = (offset + 1) + '-' + Math.min(offset + limit, total) + ' of ' + total;

    runsPagination.appendChild(prevBtn);
    runsPagination.appendChild(info);
    runsPagination.appendChild(nextBtn);
  }

  function loadRunsPage(offset) {
    if (!selectedAgentId) return;
    runsOffset = offset;
    runsList.innerHTML = '<div class="text-center"><span class="dash-spinner"></span></div>';
    fetchRuns(selectedAgentId, runsLimit, offset).then(function (data) {
      renderRuns(data.runs || [], data.total || 0, data.limit || runsLimit, data.offset || 0);
    }).catch(function () {
      runsList.innerHTML = '<p class="text-muted text-center">Failed to load runs.</p>';
    });
  }

  // --- WebSocket ---

  function connectWS() {
    disconnectWS();
    var proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    var wsUrl = proto + '//' + location.host + '/ws?key=' +
      encodeURIComponent(hashKey) + '&role=dashboard';

    ws = new WebSocket(wsUrl);
    setWsState('reconnecting');

    ws.onopen = function () {
      wsReconnectDelay = 0;
      setWsState('connected');
    };

    ws.onmessage = function (event) {
      try {
        var msg = JSON.parse(event.data);
        handleWSMessage(msg);
      } catch (e) { /* ignore parse errors */ }
    };

    ws.onclose = function () {
      setWsState('disconnected');
      scheduleWSReconnect();
    };

    ws.onerror = function () {}; // onclose fires after
  }

  function disconnectWS() {
    if (wsReconnectTimer) {
      clearTimeout(wsReconnectTimer);
      wsReconnectTimer = null;
    }
    if (ws) {
      ws.onclose = null; // Prevent reconnect on intentional close
      ws.close();
      ws = null;
    }
    setWsState('disconnected');
  }

  function scheduleWSReconnect() {
    if (!hashKey) return;
    if (wsReconnectDelay === 0) {
      wsReconnectDelay = 1000;
      connectWS();
      return;
    }
    wsReconnectTimer = setTimeout(function () {
      connectWS();
    }, wsReconnectDelay);
    wsReconnectDelay = Math.min(wsReconnectDelay * 2, wsMaxReconnectDelay);
  }

  function setWsState(state) {
    if (!sseStatusEl) return;
    var labels = {
      connected: 'connected',
      disconnected: 'disconnected',
      reconnecting: 'reconnecting...'
    };
    sseStatusEl.textContent = labels[state] || state;
    sseStatusEl.className = 'dash-sse-badge ' +
      (state === 'connected' ? 'dash-sse-connected' :
       state === 'reconnecting' ? 'dash-sse-reconnecting' :
       'dash-sse-disconnected');
  }

  function handleWSMessage(msg) {
    if (msg.type === 'pong') return; // Ignore pong responses

    if (msg.type === 'ext:task-progress') {
      updateTaskProgress(msg.payload);
      return;
    }

    if (msg.type === 'ext:task-complete') {
      handleTaskComplete(msg.payload);
      return;
    }

    if (msg.type === 'ext:status') {
      extensionOnline = msg.payload && msg.payload.online;
      updateTaskOfflineState();
      // Update agent count area to show extension status
      if (agentCountEl) {
        var countText = (stats.totalAgents || 0) + ' agent' +
          ((stats.totalAgents || 0) !== 1 ? 's' : '');
        agentCountEl.textContent = countText +
          (extensionOnline ? '' : ' - extension offline');
      }
      return;
    }

    if (msg.type === 'ext:snapshot') {
      extensionOnline = true;
      loadData(); // Refresh dashboard data on extension reconnect
      // Restore task state on reconnection
      if (msg.payload && msg.payload.taskRunning) {
        taskText = msg.payload.task || '';
        taskStartTime = Date.now() - (msg.payload.elapsed || 0);
        setTaskState('running', { task: msg.payload.task });
        updateTaskProgress({
          progress: msg.payload.progress || 0,
          phase: msg.payload.phase || '',
          elapsed: msg.payload.elapsed || 0,
          action: 'Reconnected...'
        });
      }
      updateTaskOfflineState();
      return;
    }

    // Agent/run events from REST API broadcasts
    if (msg.type === 'agent_updated' || msg.type === 'agent_deleted' || msg.type === 'run_completed') {
      loadData();
      if (msg.agentId && msg.agentId === selectedAgentId) {
        fetchRuns(selectedAgentId, runsLimit, runsOffset).then(function (result) {
          renderRuns(result.runs || [], result.total || 0, result.limit || runsLimit, result.offset || 0);
        }).catch(function () {});
      }
    }
  }

  // --- Polling Fallback ---

  function startPolling() {
    stopPolling();
    pollTimer = setInterval(function () {
      loadData();
    }, POLL_INTERVAL);
  }

  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  // --- API Helpers ---

  function apiFetch(path, options) {
    options = options || {};
    var url = API_BASE + path;
    return fetch(url, options).then(function (resp) {
      if (!resp.ok) {
        return resp.json().then(function (body) {
          return Promise.reject(body);
        }).catch(function () {
          return Promise.reject({ error: 'Request failed with status ' + resp.status });
        });
      }
      return resp.json();
    });
  }

  // --- Utilities ---

  function formatTime(isoStr) {
    if (!isoStr) return '-';
    try {
      var d = new Date(isoStr);
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) +
             ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return isoStr;
    }
  }

  function formatDuration(ms) {
    if (ms < 1000) return ms + 'ms';
    if (ms < 60000) return (ms / 1000).toFixed(1) + 's';
    return Math.floor(ms / 60000) + 'm ' + Math.round((ms % 60000) / 1000) + 's';
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function escapeAttr(str) {
    return escapeHtml(str).replace(/'/g, '&#39;');
  }

  function setTextById(id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = text;
  }

})();
