/* =============================================
   FSB Showcase - Dashboard JavaScript
   Agent monitoring, stats, SSE, run history
   ============================================= */

(function () {
  'use strict';

  var API_BASE = 'https://fsb-server.fly.dev';
  var STORAGE_KEY = 'fsb_dashboard_key';
  var POLL_INTERVAL = 30000;

  // State
  var hashKey = localStorage.getItem(STORAGE_KEY) || '';
  var agents = [];
  var stats = {};
  var selectedAgentId = null;
  var runsOffset = 0;
  var runsLimit = 20;
  var pollTimer = null;
  var sseController = null;

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

  // --- Init ---
  if (hashKey) {
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
        showDashboard();
        loadData();
        connectSSE();
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
        connectSSE();
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
    hashKey = '';
    localStorage.removeItem(STORAGE_KEY);
    agents = [];
    stats = {};
    selectedAgentId = null;
    stopPolling();
    disconnectSSE();
    showLogin();
  }

  function validateKey(key) {
    return apiFetch('/api/auth/validate', {
      headers: { 'X-FSB-Hash-Key': key }
    });
  }

  // --- UI Toggle ---

  function showDashboard() {
    loginSection.style.display = 'none';
    contentSection.style.display = 'block';
  }

  function showLogin() {
    loginSection.style.display = '';
    contentSection.style.display = 'none';
    keyInput.value = '';
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
    agentCountEl.textContent = (stats.totalAgents || 0) + ' agent' + ((stats.totalAgents || 0) !== 1 ? 's' : '');
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

  // --- SSE ---

  function connectSSE() {
    disconnectSSE();
    sseController = new AbortController();

    fetch(API_BASE + '/api/sse', {
      headers: { 'X-FSB-Hash-Key': hashKey },
      signal: sseController.signal
    }).then(function (response) {
      if (!response.ok) {
        setSseStatus(false);
        return;
      }
      setSseStatus(true);

      var reader = response.body.getReader();
      var decoder = new TextDecoder();
      var buffer = '';

      function read() {
        reader.read().then(function (result) {
          if (result.done) {
            setSseStatus(false);
            return;
          }

          buffer += decoder.decode(result.value, { stream: true });
          var lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (var i = 0; i < lines.length; i++) {
            var line = lines[i];
            if (line.indexOf('data: ') === 0) {
              try {
                var data = JSON.parse(line.slice(6));
                handleSSEMessage(data);
              } catch (e) {
                // ignore parse errors
              }
            }
          }

          read();
        }).catch(function (err) {
          if (err.name !== 'AbortError') {
            setSseStatus(false);
            // Reconnect after 5 seconds
            setTimeout(function () {
              if (hashKey) connectSSE();
            }, 5000);
          }
        });
      }

      read();
    }).catch(function (err) {
      if (err.name !== 'AbortError') {
        setSseStatus(false);
      }
    });
  }

  function disconnectSSE() {
    if (sseController) {
      sseController.abort();
      sseController = null;
    }
    setSseStatus(false);
  }

  function setSseStatus(connected) {
    if (!sseStatusEl) return;
    sseStatusEl.textContent = connected ? 'live' : 'offline';
    sseStatusEl.className = 'dash-sse-badge ' + (connected ? 'dash-sse-connected' : 'dash-sse-disconnected');
  }

  function handleSSEMessage(data) {
    if (data.type === 'agent_updated' || data.type === 'agent_deleted' || data.type === 'run_completed') {
      // Refresh all data on any event
      loadData();
      // If we're viewing runs for the affected agent, refresh runs too
      if (data.agentId && data.agentId === selectedAgentId) {
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
