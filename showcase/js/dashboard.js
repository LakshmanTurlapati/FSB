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

    if (msg.type === 'ext:status') {
      extensionOnline = msg.payload && msg.payload.online;
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
