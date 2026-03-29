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

  // Agent management state
  var detailAgentId = null;         // Currently open detail panel agent
  var detailRunsOffset = 0;
  var detailRunsLimit = 10;
  var modalMode = null;             // 'create' | 'edit'
  var modalAgentId = null;          // agentId when editing
  var deleteAgentId = null;         // agentId pending deletion
  var deleteAgentName = '';         // name for delete dialog
  var saveAgentScheduleType = 'interval'; // schedule type for inline save / modal
  var agentRunningId = null;        // agentId currently running via Run Now

  // DOM preview state
  var previewState = 'hidden'; // 'hidden' | 'loading' | 'streaming' | 'disconnected' | 'error'
  var previewScale = 1;
  var previewHideTimer = null;
  var previewSnapshotData = null; // Last snapshot for reconnect
  var lastPreviewScroll = { x: 0, y: 0 }; // Last known scroll position for maintenance after mutations
  var streamToggleOn = true;        // User toggle: on by default
  var streamTabUrl = '';             // Current streaming tab URL
  var lastSnapshotTime = 0;         // Timestamp of last snapshot received
  var pageReady = false;            // Extension reported a real page is loaded

  // DOM refs
  var loginSection = document.getElementById('dash-login');
  var contentSection = document.getElementById('dash-content');
  var keyInput = document.getElementById('dash-key-input');
  var connectBtn = document.getElementById('dash-connect-btn');
  var disconnectBtn = document.getElementById('dash-disconnect-btn');
  var agentCountEl = document.getElementById('dash-agent-count');
  var sseStatusEl = document.getElementById('dash-sse-status');
  var agentGrid = document.getElementById('dash-agent-grid');
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
  var taskStopBtn = document.getElementById('dash-task-stop');
  var taskTimeoutTimer = null;
  var TASK_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

  // DOM preview refs
  var previewContainer = document.getElementById('dash-preview');
  var previewIframe = document.getElementById('dash-preview-iframe');
  var previewLoading = document.getElementById('dash-preview-loading');
  var previewGlow = document.getElementById('dash-preview-glow');
  var previewProgress = document.getElementById('dash-preview-progress');
  var previewStatus = document.getElementById('dash-preview-status');
  var previewDisconnected = document.getElementById('dash-preview-disconnected');
  var previewError = document.getElementById('dash-preview-error');
  var previewToggle = document.getElementById('dash-preview-toggle');
  var previewTooltip = document.getElementById('dash-preview-tooltip');

  // Agent management DOM refs
  var newAgentBtn = document.getElementById('dash-new-agent-btn');
  var agentContainer = document.getElementById('dash-agent-container');
  var detailPanel = document.getElementById('dash-agent-detail');
  var detailClose = document.getElementById('dash-detail-close');
  var detailRunNow = document.getElementById('dash-detail-run-now');
  var detailEdit = document.getElementById('dash-detail-edit');
  var detailDelete = document.getElementById('dash-detail-delete');
  var detailName = document.getElementById('dash-detail-name');
  var detailTask = document.getElementById('dash-detail-task');
  var detailUrl = document.getElementById('dash-detail-url');
  var detailSchedule = document.getElementById('dash-detail-schedule');
  var detailReplayRuns = document.getElementById('dash-detail-replay-runs');
  var detailAiFallback = document.getElementById('dash-detail-ai-fallback');
  var detailTokensSaved = document.getElementById('dash-detail-tokens-saved');
  var detailCostSaved = document.getElementById('dash-detail-cost-saved');
  var detailRunProgress = document.getElementById('dash-detail-run-progress');
  var detailRunBar = document.getElementById('dash-detail-run-bar');
  var detailRunAction = document.getElementById('dash-detail-run-action');
  var detailRunsList = document.getElementById('dash-detail-runs');
  var detailRunsPagination = document.getElementById('dash-detail-runs-pagination');
  var detailScriptToggle = document.getElementById('dash-detail-script-toggle');
  var detailScriptContent = document.getElementById('dash-detail-script-content');
  var detailScriptList = document.getElementById('dash-detail-script-list');
  var detailScriptChevron = document.getElementById('dash-detail-script-chevron');

  // Modal DOM refs
  var modalOverlay = document.getElementById('dash-agent-modal-overlay');
  var modalTitle = document.getElementById('dash-modal-title');
  var modalClose = document.getElementById('dash-modal-close');
  var modalName = document.getElementById('dash-modal-name');
  var modalTask = document.getElementById('dash-modal-task');
  var modalUrl = document.getElementById('dash-modal-url');
  var modalScheduleType = document.getElementById('dash-modal-schedule-type');
  var modalScheduleConfig = document.getElementById('dash-modal-schedule-config');
  var modalDiscard = document.getElementById('dash-modal-discard');
  var modalSave = document.getElementById('dash-modal-save');

  // Delete dialog DOM refs
  var deleteOverlay = document.getElementById('dash-delete-overlay');
  var deleteTitle = document.getElementById('dash-delete-title');
  var deleteCancel = document.getElementById('dash-delete-cancel');
  var deleteConfirm = document.getElementById('dash-delete-confirm');

  // Save-as-Agent DOM refs
  var saveAgentSection = document.getElementById('dash-task-save-agent');
  var saveAgentTrigger = document.getElementById('dash-save-agent-trigger');
  var saveAgentFields = document.getElementById('dash-save-agent-fields');
  var saveAgentName = document.getElementById('dash-save-agent-name');
  var saveAgentUrl = document.getElementById('dash-save-agent-url');
  var saveAgentBtn = document.getElementById('dash-save-agent-btn');
  var saveAgentScheduleConfig = document.getElementById('dash-save-agent-schedule-config');

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

  if (taskStopBtn) {
    taskStopBtn.addEventListener('click', function () {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'dash:stop-task', payload: {}, ts: Date.now() }));
      }
      setTaskState('failed', { error: 'Stopped by user' });
    });
  }

  // Detail panel listeners
  if (detailClose) detailClose.addEventListener('click', closeDetailPanel);
  if (detailRunNow) detailRunNow.addEventListener('click', function () {
    if (detailAgentId) runAgentNow(detailAgentId);
  });
  if (detailEdit) detailEdit.addEventListener('click', function () {
    if (detailAgentId) openAgentModal('edit', detailAgentId);
  });
  if (detailDelete) detailDelete.addEventListener('click', function () {
    if (detailAgentId) {
      var agent = agents.find(function (a) { return a.agent_id === detailAgentId; });
      openDeleteDialog(detailAgentId, agent ? agent.name : detailAgentId);
    }
  });

  // Recorded script toggle
  if (detailScriptToggle) {
    detailScriptToggle.addEventListener('click', function () {
      var isExpanded = detailScriptToggle.classList.contains('expanded');
      detailScriptToggle.classList.toggle('expanded');
      if (detailScriptContent) detailScriptContent.style.display = isExpanded ? 'none' : 'block';
    });
  }

  // New Agent button
  if (newAgentBtn) newAgentBtn.addEventListener('click', function () { openAgentModal('create'); });

  // Modal listeners
  if (modalClose) modalClose.addEventListener('click', closeAgentModal);
  if (modalDiscard) modalDiscard.addEventListener('click', closeAgentModal);
  if (modalSave) modalSave.addEventListener('click', saveAgentFromModal);
  if (modalOverlay) {
    modalOverlay.addEventListener('click', function (e) {
      if (e.target === modalOverlay) closeAgentModal();
    });
  }
  // Escape key closes modal
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      if (modalOverlay && modalOverlay.style.display !== 'none') closeAgentModal();
      else if (deleteOverlay && deleteOverlay.style.display !== 'none') closeDeleteDialog();
    }
  });

  // Schedule type pill handlers (modal)
  if (modalScheduleType) {
    modalScheduleType.addEventListener('click', function (e) {
      var pill = e.target.closest('.dash-schedule-pill');
      if (!pill) return;
      modalScheduleType.querySelectorAll('.dash-schedule-pill').forEach(function (p) { p.classList.remove('active'); });
      pill.classList.add('active');
      renderScheduleConfig(modalScheduleConfig, pill.getAttribute('data-type'), '{}');
    });
  }

  // Delete dialog listeners
  if (deleteCancel) deleteCancel.addEventListener('click', closeDeleteDialog);
  if (deleteConfirm) deleteConfirm.addEventListener('click', confirmDelete);
  if (deleteOverlay) {
    deleteOverlay.addEventListener('click', function (e) {
      if (e.target === deleteOverlay) closeDeleteDialog();
    });
  }

  // Save-as-Agent listeners
  if (saveAgentTrigger) {
    saveAgentTrigger.addEventListener('click', function () {
      var isExpanded = saveAgentTrigger.classList.contains('expanded');
      saveAgentTrigger.classList.toggle('expanded');
      if (saveAgentFields) {
        if (isExpanded) {
          saveAgentFields.classList.remove('dash-save-expanded');
          saveAgentFields.style.display = 'none';
        } else {
          saveAgentFields.style.display = 'flex';
          saveAgentFields.classList.add('dash-save-expanded');
        }
      }
    });
  }
  // Schedule pills for save-as-agent section
  if (saveAgentSection) {
    saveAgentSection.addEventListener('click', function (e) {
      var pill = e.target.closest('.dash-schedule-pill');
      if (!pill) return;
      saveAgentSection.querySelectorAll('.dash-schedule-pill').forEach(function (p) { p.classList.remove('active'); });
      pill.classList.add('active');
      renderScheduleConfig(saveAgentScheduleConfig, pill.getAttribute('data-type'), '{}');
    });
  }
  if (saveAgentBtn) saveAgentBtn.addEventListener('click', submitSaveAsAgent);

  // --- Task Control ---

  function submitTask(text) {
    console.log('[FSB-DASH] submitTask called:', text);
    console.log('[FSB-DASH] taskState:', taskState, 'extensionOnline:', extensionOnline, 'ws:', ws ? 'exists' : 'null', 'ws.readyState:', ws ? ws.readyState : 'N/A');
    if (taskState === 'running') { console.log('[FSB-DASH] blocked: task already running'); return; }
    if (!text) { console.log('[FSB-DASH] blocked: empty text'); return; }
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      console.log('[FSB-DASH] blocked: WS not open');
      if (taskAction) { taskAction.textContent = 'Not connected to server.'; taskAction.style.display = 'block'; }
      return;
    }
    if (!extensionOnline) {
      console.log('[FSB-DASH] blocked: extension offline');
      if (taskAction) { taskAction.textContent = 'Extension is offline.'; taskAction.style.display = 'block'; }
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

    // Clear task timeout
    if (taskTimeoutTimer) { clearTimeout(taskTimeoutTimer); taskTimeoutTimer = null; }
    // Hide stop button for non-running states
    if (newState !== 'running' && taskStopBtn) taskStopBtn.style.display = 'none';
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
        hideSaveAsAgent();
        // Preview is independent of task state -- stream continues (CONN-02)
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
        if (taskStopBtn) taskStopBtn.style.display = '';
        // Start elapsed timer
        taskElapsedTimer = setInterval(function () {
          if (taskElapsed && taskStartTime) {
            taskElapsed.textContent = 'Running for ' + formatDuration(Date.now() - taskStartTime);
          }
        }, 1000);
        // Start task timeout
        if (taskTimeoutTimer) clearTimeout(taskTimeoutTimer);
        taskTimeoutTimer = setTimeout(function () {
          if (taskState === 'running') {
            setTaskState('failed', { error: 'Task timed out (5 minutes)' });
          }
        }, TASK_TIMEOUT_MS);
        // Disable all task inputs during run
        disableAllTaskInputs(true);
        hideSaveAsAgent();
        // Stream is managed independently -- no start/stop here (CONN-02)
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
        // Show save-as-agent option
        showSaveAsAgent();
        // Stream continues independently -- no stop/hide here (CONN-02)
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
        // Stream continues independently -- no stop/hide here (CONN-02)
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
      // If extension goes offline mid-task, fail it
      if (taskState === 'running') {
        setTaskState('failed', { error: 'Extension disconnected' });
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

  // Auto-start QR scanner if login card is visible, Scan tab is active, and no credentials exist
  if (loginSection && loginSection.style.display !== 'none' && tabScan && tabScan.classList.contains('active') && !hashKey && !sessionToken) {
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
      var scanner = qrScanner;
      qrScanner = null;
      try {
        scanner.stop().catch(function () { /* scanner may not have started yet */ });
      } catch (_) { /* stop() threw synchronously */ }
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
      var isEnabled = agent.enabled === true || agent.enabled === 1;
      var isSelected = detailAgentId === agent.agent_id;
      card.className = 'dash-agent-card' + (isSelected ? ' selected' : '') + (!isEnabled ? ' dash-agent-disabled' : '');
      card.setAttribute('data-agent-id', agent.agent_id);
      card.setAttribute('role', 'button');
      card.setAttribute('aria-expanded', isSelected ? 'true' : 'false');

      // Parse schedule for display
      var scheduleLabel = formatScheduleLabel(agent.schedule_type, agent.schedule_config);

      // Calculate success rate from recent data
      var successCount = agent.successful_runs || 0;
      var totalRuns = agent.total_runs || 0;
      var successRateText = totalRuns > 0 ? successCount + '/' + totalRuns : '0/0';
      var successPercent = totalRuns > 0 ? (successCount / totalRuns) * 100 : 100;
      var rateColor = successPercent > 80 ? '#22c55e' : successPercent >= 50 ? '#eab308' : '#ef4444';

      // Cost saved
      var costSaved = agent.cost_saved || 0;
      var costText = '$' + costSaved.toFixed(2);

      // Last run time
      var lastRunText = agent.last_run_at ? formatTimeAgo(agent.last_run_at) : 'Never';

      // Running indicator
      var runningIcon = agentRunningId === agent.agent_id ? ' <span class="dash-spinner dash-agent-running-icon"></span>' : '';

      card.innerHTML =
        '<div class="dash-agent-card-header">' +
          '<div class="dash-agent-name">' +
            '<span class="dash-status-dot ' + (isEnabled ? 'dash-status-enabled' : 'dash-status-disabled') + '"></span>' +
            escapeHtml(agent.name) + runningIcon +
          '</div>' +
          '<button class="dash-toggle" role="switch" aria-checked="' + isEnabled + '" aria-label="Enable ' + escapeAttr(agent.name) + '" data-agent-id="' + escapeAttr(agent.agent_id) + '"></button>' +
        '</div>' +
        '<div class="dash-agent-task">' + escapeHtml(agent.task) + '</div>' +
        '<div class="dash-agent-url">' + escapeHtml(agent.target_url || '') + '</div>' +
        '<div class="dash-agent-meta">' +
          '<span class="dash-agent-schedule">' + escapeHtml(scheduleLabel) + '</span>' +
          '<span class="dash-agent-last-run">' + escapeHtml(lastRunText) + '</span>' +
        '</div>' +
        '<div class="dash-agent-card-stats">' +
          '<span class="dash-agent-success-rate" style="color: ' + rateColor + '">' + successRateText + '</span>' +
          '<span class="dash-agent-cost-saved">' + costText + '</span>' +
        '</div>';

      // Card click opens detail panel (but not on toggle click)
      card.addEventListener('click', function (e) {
        if (e.target.closest('.dash-toggle')) return; // toggle has own handler
        openDetailPanel(agent.agent_id);
      });

      // Toggle click handler
      var toggle = card.querySelector('.dash-toggle');
      if (toggle) {
        toggle.addEventListener('click', function (e) {
          e.stopPropagation();
          toggleAgent(agent.agent_id, !isEnabled);
        });
      }

      agentGrid.appendChild(card);
    });
  }

  // --- Helper Functions ---

  function formatScheduleLabel(scheduleType, scheduleConfig) {
    var config = {};
    try { config = typeof scheduleConfig === 'string' ? JSON.parse(scheduleConfig) : (scheduleConfig || {}); } catch (_) {}

    if (scheduleType === 'interval') {
      var mins = config.intervalMinutes || 60;
      if (mins >= 1440) return 'Every ' + Math.round(mins / 1440) + 'd';
      if (mins >= 60) return 'Every ' + Math.round(mins / 60) + 'h';
      return 'Every ' + mins + 'min';
    }
    if (scheduleType === 'daily') {
      return 'Daily ' + (config.dailyTime || '08:00');
    }
    if (scheduleType === 'once') {
      return 'Once';
    }
    return scheduleType || 'manual';
  }

  function formatTimeAgo(isoStr) {
    if (!isoStr) return 'Never';
    try {
      var diff = Date.now() - new Date(isoStr).getTime();
      if (diff < 60000) return 'Just now';
      if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
      if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
      return Math.floor(diff / 86400000) + 'd ago';
    } catch (_) { return isoStr; }
  }

  function formatNumber(n) {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return String(n);
  }

  // --- Toggle Agent ---

  function toggleAgent(agentId, enabled) {
    // Optimistic UI update
    agents = agents.map(function (a) {
      if (a.agent_id === agentId) { a.enabled = enabled ? 1 : 0; }
      return a;
    });
    renderAgents();

    // API call
    apiFetch('/api/agents/' + encodeURIComponent(agentId), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'X-FSB-Hash-Key': hashKey },
      body: JSON.stringify({ enabled: enabled })
    }).catch(function () {
      // Revert on failure
      agents = agents.map(function (a) {
        if (a.agent_id === agentId) { a.enabled = enabled ? 0 : 1; }
        return a;
      });
      renderAgents();
    });
  }

  // --- Detail Panel ---

  function openDetailPanel(agentId) {
    var agent = agents.find(function (a) { return a.agent_id === agentId; });
    if (!agent) return;

    detailAgentId = agentId;
    selectedAgentId = agentId; // Keep selected for card styling
    detailRunsOffset = 0;

    // Update card selection
    var cards = agentGrid.querySelectorAll('.dash-agent-card');
    cards.forEach(function (c) {
      var isThis = c.getAttribute('data-agent-id') === agentId;
      c.classList.toggle('selected', isThis);
      c.setAttribute('aria-expanded', isThis ? 'true' : 'false');
    });

    // Fill detail panel
    if (detailName) detailName.textContent = agent.name;
    if (detailTask) detailTask.textContent = agent.task;
    if (detailUrl) detailUrl.textContent = agent.target_url || '';
    if (detailSchedule) detailSchedule.textContent = formatScheduleLabel(agent.schedule_type, agent.schedule_config);

    // Show panel
    if (detailPanel) detailPanel.style.display = 'block';
    if (agentContainer) agentContainer.classList.add('dash-detail-open');

    // Load cost savings
    loadAgentStats(agentId);

    // Load run history
    loadDetailRuns(agentId, 0);

    // Load recorded script
    loadRecordedScript(agent);

    // Reset run progress
    if (detailRunProgress) detailRunProgress.style.display = 'none';
  }

  function closeDetailPanel() {
    detailAgentId = null;
    selectedAgentId = null;
    if (detailPanel) detailPanel.style.display = 'none';
    if (agentContainer) agentContainer.classList.remove('dash-detail-open');
    var cards = agentGrid.querySelectorAll('.dash-agent-card');
    cards.forEach(function (c) {
      c.classList.remove('selected');
      c.setAttribute('aria-expanded', 'false');
    });
  }

  function loadAgentStats(agentId) {
    apiFetch('/api/agents/' + encodeURIComponent(agentId) + '/stats', {
      headers: { 'X-FSB-Hash-Key': hashKey }
    }).then(function (data) {
      if (detailReplayRuns) detailReplayRuns.textContent = data.replayRuns || 0;
      if (detailAiFallback) detailAiFallback.textContent = data.aiFallbackRuns || 0;
      if (detailTokensSaved) detailTokensSaved.textContent = formatNumber(data.tokensSaved || 0);
      if (detailCostSaved) detailCostSaved.textContent = '$' + (data.costSaved || 0).toFixed(2);
    }).catch(function () {});
  }

  function loadDetailRuns(agentId, offset) {
    if (!detailRunsList) return;
    detailRunsList.innerHTML = '<div class="text-center"><span class="dash-spinner"></span></div>';

    fetchRuns(agentId, detailRunsLimit, offset).then(function (data) {
      renderDetailRuns(data.runs || [], data.total || 0, data.limit || detailRunsLimit, data.offset || 0);
    }).catch(function () {
      detailRunsList.innerHTML = '<p class="text-muted text-center">Failed to load runs.</p>';
    });
  }

  function renderDetailRuns(runs, total, limit, offset) {
    if (!detailRunsList) return;
    detailRunsList.innerHTML = '';

    if (runs.length === 0) {
      detailRunsList.innerHTML = '<p class="text-muted text-center">No runs yet. Tap Run Now to test this agent.</p>';
      if (detailRunsPagination) detailRunsPagination.innerHTML = '';
      return;
    }

    runs.forEach(function (run) {
      var entry = document.createElement('div');
      entry.className = 'dash-run-entry';

      var time = formatTime(run.completed_at);
      var statusClass = run.status === 'success' ? 'dash-run-status-success' :
                        run.status === 'failed' ? 'dash-run-status-failed' :
                        'dash-run-status-unknown';
      var statusSr = run.status === 'success' ? 'Status: success' : run.status === 'failed' ? 'Status: failed' : 'Status: unknown';

      var modeBadge = renderModeBadge(run.execution_mode);
      var resultText = run.error || run.result || '-';
      var duration = run.duration_ms ? formatDuration(run.duration_ms) : '-';
      var costStr = run.cost_saved && run.cost_saved > 0 ? '-$' + run.cost_saved.toFixed(4) :
                    run.cost_usd ? '$' + run.cost_usd.toFixed(4) : '-';

      entry.innerHTML =
        '<div class="dash-run-time">' + time + '</div>' +
        '<div><span class="dash-run-status ' + statusClass + '"><span class="sr-only">' + statusSr + '</span>' + escapeHtml(run.status) + '</span></div>' +
        '<div>' + modeBadge + '</div>' +
        '<div class="dash-run-result" title="' + escapeAttr(resultText) + '">' + escapeHtml(resultText) + '</div>' +
        '<div class="dash-run-duration">' + duration + '</div>' +
        '<div class="dash-run-cost">' + costStr + '</div>';

      detailRunsList.appendChild(entry);
    });

    // Pagination (reuse existing pattern)
    if (detailRunsPagination) {
      detailRunsPagination.innerHTML = '';
      if (total > limit) {
        var prevBtn = document.createElement('button');
        prevBtn.textContent = 'Previous';
        prevBtn.disabled = offset === 0;
        prevBtn.addEventListener('click', function () { loadDetailRuns(detailAgentId, Math.max(0, offset - limit)); });

        var nextBtn = document.createElement('button');
        nextBtn.textContent = 'Next';
        nextBtn.disabled = (offset + limit) >= total;
        nextBtn.addEventListener('click', function () { loadDetailRuns(detailAgentId, offset + limit); });

        var info = document.createElement('span');
        info.className = 'text-muted text-sm';
        info.style.padding = '6px 8px';
        info.textContent = (offset + 1) + '-' + Math.min(offset + limit, total) + ' of ' + total;

        detailRunsPagination.appendChild(prevBtn);
        detailRunsPagination.appendChild(info);
        detailRunsPagination.appendChild(nextBtn);
      }
    }
  }

  function loadRecordedScript(agent) {
    if (!detailScriptList) return;
    detailScriptList.innerHTML = '';
    // Collapse script section by default
    if (detailScriptContent) detailScriptContent.style.display = 'none';
    if (detailScriptToggle) detailScriptToggle.classList.remove('expanded');

    // Agent may have recordedScript from extension sync
    var script = agent.recorded_script || agent.recordedScript;
    if (!script || !Array.isArray(script) || script.length === 0) {
      detailScriptList.innerHTML = '<li>No recorded script available</li>';
      return;
    }

    script.forEach(function (step) {
      var li = document.createElement('li');
      li.textContent = typeof step === 'string' ? step : (step.action || step.description || JSON.stringify(step));
      detailScriptList.appendChild(li);
    });
  }

  // --- Run Now ---

  function runAgentNow(agentId) {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    if (!extensionOnline) return;

    agentRunningId = agentId;
    renderAgents(); // Show spinner on card

    // Show progress bar in detail panel
    if (detailRunProgress) detailRunProgress.style.display = 'block';
    if (detailRunBar) { detailRunBar.style.width = '0%'; detailRunBar.className = 'dash-task-bar-fill'; }
    if (detailRunAction) detailRunAction.textContent = 'Starting...';
    if (detailRunNow) { detailRunNow.disabled = true; detailRunNow.innerHTML = '<span class="dash-spinner"></span> Running'; }

    ws.send(JSON.stringify({
      type: 'dash:agent-run-now',
      payload: { agentId: agentId },
      ts: Date.now()
    }));
  }

  // --- Agent Modal ---

  function openAgentModal(mode, agentId) {
    modalMode = mode;
    modalAgentId = agentId || null;

    if (modalTitle) modalTitle.textContent = mode === 'edit' ? 'Edit Agent' : 'New Agent';
    if (modalSave) { modalSave.textContent = 'Save Agent'; modalSave.disabled = false; }

    // Clear or pre-fill fields
    if (mode === 'edit' && agentId) {
      var agent = agents.find(function (a) { return a.agent_id === agentId; });
      if (agent) {
        if (modalName) modalName.value = agent.name || '';
        if (modalTask) modalTask.value = agent.task || '';
        if (modalUrl) modalUrl.value = agent.target_url || '';
        setModalScheduleType(agent.schedule_type || 'interval', agent.schedule_config);
      }
    } else {
      if (modalName) modalName.value = '';
      if (modalTask) modalTask.value = '';
      if (modalUrl) modalUrl.value = '';
      setModalScheduleType('interval', '{}');
    }

    // Show modal
    if (modalOverlay) modalOverlay.style.display = 'flex';
    if (modalName) modalName.focus();
  }

  function closeAgentModal() {
    if (modalOverlay) modalOverlay.style.display = 'none';
    modalMode = null;
    modalAgentId = null;
    clearModalErrors();
  }

  function clearModalErrors() {
    var errors = (modalOverlay || document).querySelectorAll('.dash-field-error');
    errors.forEach(function (e) { e.remove(); });
    var errorInputs = (modalOverlay || document).querySelectorAll('.dash-input-error');
    errorInputs.forEach(function (e) { e.classList.remove('dash-input-error'); });
  }

  function saveAgentFromModal() {
    clearModalErrors();

    var name = modalName ? modalName.value.trim() : '';
    var task = modalTask ? modalTask.value.trim() : '';
    var url = modalUrl ? modalUrl.value.trim() : '';

    // Validate
    var valid = true;
    if (!name) { showFieldError(modalName, 'Name is required'); valid = false; }
    if (!task) { showFieldError(modalTask, 'Task description is required'); valid = false; }
    if (!url) { showFieldError(modalUrl, 'Target URL is required'); valid = false; }
    if (!valid) return;

    // Gather schedule
    var scheduleType = getActiveScheduleType(modalScheduleType);
    var scheduleConfig = getScheduleConfig(modalScheduleConfig, scheduleType);

    // Disable save button
    if (modalSave) { modalSave.disabled = true; modalSave.innerHTML = '<span class="dash-spinner"></span> Saving...'; }

    var agentId = modalMode === 'edit' ? modalAgentId : 'agent_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 8);

    apiFetch('/api/agents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-FSB-Hash-Key': hashKey },
      body: JSON.stringify({
        agentId: agentId,
        name: name,
        task: task,
        targetUrl: url,
        scheduleType: scheduleType,
        scheduleConfig: JSON.stringify(scheduleConfig),
        enabled: true
      })
    }).then(function () {
      closeAgentModal();
      loadData();
      if (window.showToast) showToast('Agent ' + (modalMode === 'edit' ? 'updated' : 'created'));
      // Highlight new card briefly
      setTimeout(function () {
        var newCard = agentGrid.querySelector('[data-agent-id="' + agentId + '"]');
        if (newCard) {
          newCard.classList.add('dash-agent-card-highlight');
          setTimeout(function () { newCard.classList.remove('dash-agent-card-highlight'); }, 1100);
        }
      }, 200);
    }).catch(function (err) {
      if (modalSave) { modalSave.disabled = false; modalSave.textContent = 'Save Agent'; }
      var msg = (err && err.error) || 'Couldn\'t create agent. Check your connection and try again.';
      showFieldError(modalUrl, msg);
    });
  }

  function showFieldError(inputEl, msg) {
    if (!inputEl) return;
    inputEl.classList.add('dash-input-error');
    var errEl = document.createElement('div');
    errEl.className = 'dash-field-error';
    errEl.textContent = msg;
    inputEl.parentNode.appendChild(errEl);
  }

  // --- Schedule Configuration ---

  function setModalScheduleType(type, configStr) {
    var pills = (modalScheduleType || document).querySelectorAll('.dash-schedule-pill');
    pills.forEach(function (p) { p.classList.toggle('active', p.getAttribute('data-type') === type); });
    renderScheduleConfig(modalScheduleConfig, type, configStr);
  }

  function renderScheduleConfig(container, type, configStr) {
    if (!container) return;
    var config = {};
    try { config = typeof configStr === 'string' ? JSON.parse(configStr) : (configStr || {}); } catch (_) {}

    if (type === 'interval') {
      var mins = config.intervalMinutes || 60;
      container.innerHTML =
        '<div class="dash-schedule-interval-row">' +
          '<span class="dash-schedule-interval-label">Every</span>' +
          '<input type="number" class="dash-input dash-schedule-interval-input" value="' + mins + '" min="5" step="5">' +
          '<span class="dash-schedule-interval-label">minutes</span>' +
        '</div>';
      // Snap to minimum
      var input = container.querySelector('input');
      if (input) {
        input.addEventListener('blur', function () {
          if (parseInt(input.value) < 5) {
            input.value = 5;
            var msgEl = container.querySelector('.dash-schedule-snap-msg');
            if (!msgEl) {
              msgEl = document.createElement('div');
              msgEl.className = 'dash-schedule-snap-msg';
              msgEl.textContent = 'Minimum 5 minutes';
              container.appendChild(msgEl);
              setTimeout(function () { msgEl.style.opacity = '0'; }, 100);
              setTimeout(function () { if (msgEl.parentNode) msgEl.remove(); }, 2100);
            }
          }
        });
      }
    } else if (type === 'daily') {
      var time = config.dailyTime || '08:00';
      var days = config.daysOfWeek || [0, 1, 2, 3, 4, 5, 6];
      var dayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
      var dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

      var pillsHtml = dayLabels.map(function (label, i) {
        var checked = days.indexOf(i) >= 0;
        return '<button class="dash-day-pill" role="checkbox" aria-checked="' + checked + '" aria-label="' + dayNames[i] + '" data-day="' + i + '">' + label + '</button>';
      }).join('');

      container.innerHTML =
        '<input type="time" class="dash-input" value="' + time + '" style="width: 120px;">' +
        '<div class="dash-day-pills">' + pillsHtml + '</div>';

      // Day pill toggle handlers
      container.querySelectorAll('.dash-day-pill').forEach(function (pill) {
        pill.addEventListener('click', function () {
          var isChecked = pill.getAttribute('aria-checked') === 'true';
          pill.setAttribute('aria-checked', !isChecked);
        });
      });
    } else if (type === 'once') {
      var dt = config.dateTime || '';
      container.innerHTML = '<input type="datetime-local" class="dash-input" value="' + dt + '">';
    }
  }

  function getActiveScheduleType(container) {
    if (!container) return 'interval';
    var active = container.querySelector('.dash-schedule-pill.active');
    return active ? active.getAttribute('data-type') : 'interval';
  }

  function getScheduleConfig(container, type) {
    if (!container) return {};
    if (type === 'interval') {
      var input = container.querySelector('input[type="number"]');
      return { intervalMinutes: Math.max(5, parseInt(input ? input.value : '60') || 60) };
    }
    if (type === 'daily') {
      var timeInput = container.querySelector('input[type="time"]');
      var daysChecked = [];
      container.querySelectorAll('.dash-day-pill[aria-checked="true"]').forEach(function (p) {
        daysChecked.push(parseInt(p.getAttribute('data-day')));
      });
      return { dailyTime: timeInput ? timeInput.value : '08:00', daysOfWeek: daysChecked };
    }
    if (type === 'once') {
      var dtInput = container.querySelector('input[type="datetime-local"]');
      return { dateTime: dtInput ? dtInput.value : '' };
    }
    return {};
  }

  // --- Delete Agent ---

  function openDeleteDialog(agentId, agentName) {
    deleteAgentId = agentId;
    deleteAgentName = agentName;
    if (deleteTitle) deleteTitle.textContent = 'Delete ' + agentName + '?';
    if (deleteOverlay) deleteOverlay.style.display = 'flex';
    if (deleteCancel) deleteCancel.focus();
  }

  function closeDeleteDialog() {
    if (deleteOverlay) deleteOverlay.style.display = 'none';
    deleteAgentId = null;
    deleteAgentName = '';
  }

  function confirmDelete() {
    if (!deleteAgentId) return;
    apiFetch('/api/agents/' + encodeURIComponent(deleteAgentId), {
      method: 'DELETE',
      headers: { 'X-FSB-Hash-Key': hashKey }
    }).then(function () {
      closeDeleteDialog();
      closeDetailPanel();
      loadData();
      if (window.showToast) showToast('Agent deleted');
    }).catch(function () {
      closeDeleteDialog();
    });
  }

  // --- Post-Task Save as Agent ---

  function showSaveAsAgent() {
    if (saveAgentSection) saveAgentSection.style.display = 'block';
    // Pre-fill from completed task context
    if (saveAgentName && taskText) {
      // Use first ~50 chars of task as agent name
      saveAgentName.value = taskText.length > 50 ? taskText.substring(0, 50) + '...' : taskText;
    }
    if (saveAgentUrl) {
      // URL can be populated from task text if it contains a URL
      var urlMatch = taskText.match(/https?:\/\/[^\s]+/);
      if (urlMatch) saveAgentUrl.value = urlMatch[0];
    }
    // Render default schedule config
    renderScheduleConfig(saveAgentScheduleConfig, 'interval', '{"intervalMinutes": 60}');
  }

  function hideSaveAsAgent() {
    if (saveAgentSection) saveAgentSection.style.display = 'none';
    if (saveAgentFields) { saveAgentFields.style.display = 'none'; saveAgentFields.classList.remove('dash-save-expanded'); }
    if (saveAgentTrigger) saveAgentTrigger.classList.remove('expanded');
  }

  function submitSaveAsAgent() {
    var name = saveAgentName ? saveAgentName.value.trim() : '';
    var url = saveAgentUrl ? saveAgentUrl.value.trim() : '';
    if (!name || !url) return;

    var scheduleType = 'interval';
    var saveSchedulePills = saveAgentSection ? saveAgentSection.querySelectorAll('.dash-schedule-pill') : [];
    saveSchedulePills.forEach(function (p) { if (p.classList.contains('active')) scheduleType = p.getAttribute('data-type'); });
    var scheduleConfig = getScheduleConfig(saveAgentScheduleConfig, scheduleType);

    if (saveAgentBtn) { saveAgentBtn.disabled = true; saveAgentBtn.innerHTML = '<span class="dash-spinner"></span> Saving...'; }

    var agentId = 'agent_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 8);

    apiFetch('/api/agents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-FSB-Hash-Key': hashKey },
      body: JSON.stringify({
        agentId: agentId,
        name: name,
        task: taskText,
        targetUrl: url,
        scheduleType: scheduleType,
        scheduleConfig: JSON.stringify(scheduleConfig),
        enabled: true
      })
    }).then(function () {
      hideSaveAsAgent();
      loadData();
      if (saveAgentBtn) { saveAgentBtn.disabled = false; saveAgentBtn.textContent = 'Save Agent'; }
      if (window.showToast) showToast('Agent created');
    }).catch(function () {
      if (saveAgentBtn) { saveAgentBtn.disabled = false; saveAgentBtn.textContent = 'Save Agent'; }
    });
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

  // --- DOM Preview ---

  function setPreviewState(newState) {
    previewState = newState;

    // Clear any pending hide timer
    if (previewHideTimer) {
      clearTimeout(previewHideTimer);
      previewHideTimer = null;
    }

    // Reset all sub-views
    if (previewContainer) previewContainer.style.display = 'none';
    if (previewLoading) previewLoading.style.display = 'none';
    if (previewIframe) previewIframe.style.display = 'none';
    if (previewGlow) previewGlow.style.display = 'none';
    if (previewProgress) previewProgress.style.display = 'none';
    if (previewStatus) { previewStatus.style.display = 'none'; previewStatus.className = 'dash-preview-status'; }
    if (previewDisconnected) previewDisconnected.style.display = 'none';
    if (previewError) previewError.style.display = 'none';

    switch (newState) {
      case 'hidden':
        // Container not visible
        break;

      case 'loading':
        if (previewContainer) previewContainer.style.display = '';
        if (previewLoading) previewLoading.style.display = 'flex';
        if (previewStatus) {
          previewStatus.className = 'dash-preview-status dash-preview-status-buffering';
          previewStatus.style.display = '';
        }
        break;

      case 'streaming':
        if (previewContainer) previewContainer.style.display = '';
        if (previewIframe) previewIframe.style.display = '';
        if (previewStatus) {
          previewStatus.className = 'dash-preview-status dash-preview-status-streaming';
          previewStatus.style.display = '';
        }
        break;

      case 'disconnected':
        if (previewContainer) previewContainer.style.display = '';
        if (previewIframe) previewIframe.style.display = ''; // Show last content frozen
        if (previewDisconnected) previewDisconnected.style.display = 'flex';
        if (previewStatus) {
          previewStatus.className = 'dash-preview-status dash-preview-status-disconnected';
          previewStatus.style.display = '';
        }
        break;

      case 'paused':
        if (previewContainer) previewContainer.style.display = '';
        if (previewIframe) previewIframe.style.display = ''; // Show last content frozen
        if (previewStatus) {
          previewStatus.className = 'dash-preview-status dash-preview-status-paused';
          previewStatus.style.display = '';
        }
        break;

      case 'error':
        if (previewContainer) previewContainer.style.display = '';
        if (previewError) previewError.style.display = 'flex';
        break;
    }
  }

  function handleDOMSnapshot(payload) {
    if (!payload || !payload.html) {
      setPreviewState('error');
      return;
    }

    // Reset glow and progress overlays on new snapshot
    if (previewGlow) previewGlow.style.display = 'none';
    if (previewProgress) previewProgress.style.display = 'none';

    previewSnapshotData = payload;
    lastSnapshotTime = Date.now();
    updatePreviewTooltip();

    try {
      // Build full HTML document for iframe
      var stylesheetLinks = (payload.stylesheets || []).map(function(url) {
        return '<link rel="stylesheet" href="' + url.replace(/"/g, '&quot;') + '">';
      }).join('\n');

      var fullHTML = '<!DOCTYPE html><html><head><meta charset="UTF-8">' +
        '<meta name="viewport" content="width=' + (payload.viewportWidth || 1920) + '">' +
        stylesheetLinks +
        '<style>body { margin: 0; overflow: hidden; } *::selection { background: transparent; } ::-webkit-scrollbar { display: none; }</style>' +
        '</head><body>' + payload.html + '</body></html>';

      // Write to iframe via srcdoc
      if (previewIframe) {
        previewIframe.srcdoc = fullHTML;
        previewIframe.onload = function() {
          // Calculate scale factor to fit container
          updatePreviewScale();
          // Apply initial scroll position
          try {
            previewIframe.contentWindow.scrollTo(payload.scrollX || 0, payload.scrollY || 0);
          } catch (e) { /* cross-origin fallback */ }
          setPreviewState('streaming');
        };
        previewIframe.onerror = function() {
          setPreviewState('error');
        };
      }
    } catch (e) {
      console.warn('[FSB-DASH] DOM snapshot render failed:', e.message);
      setPreviewState('error');
    }
  }

  function updatePreviewScale() {
    if (!previewIframe || !previewContainer || !previewSnapshotData) return;

    var containerWidth = previewContainer.clientWidth;
    var containerHeight = previewContainer.clientHeight;
    var pageWidth = previewSnapshotData.viewportWidth || previewSnapshotData.pageWidth || 1920;
    var pageHeight = previewSnapshotData.viewportHeight || 1080;

    // Scale to fit both dimensions so nothing gets clipped
    var scaleX = containerWidth / pageWidth;
    var scaleY = containerHeight / pageHeight;
    previewScale = Math.min(scaleX, scaleY);

    // Size iframe to original page dimensions, then scale down
    previewIframe.style.width = pageWidth + 'px';
    previewIframe.style.height = pageHeight + 'px';
    previewIframe.style.transform = 'scale(' + previewScale + ')';
  }

  window.addEventListener('resize', function() {
    if (previewState === 'streaming') {
      updatePreviewScale();
    }
  });

  // ResizeObserver for more accurate scaling when container resizes independently
  if (typeof ResizeObserver !== 'undefined' && previewContainer) {
    new ResizeObserver(function() {
      if (previewState === 'streaming') {
        updatePreviewScale();
      }
    }).observe(previewContainer);
  }

  function handleDOMMutations(payload) {
    if (previewState !== 'streaming' || !previewIframe) return;

    try {
      var mutations = payload.mutations || [];
      var doc = previewIframe.contentDocument;
      if (!doc || !doc.body) return;

      mutations.forEach(function(m) {
        try {
          switch (m.op) {
            case 'add': {
              var parent = doc.querySelector('[data-fsb-nid="' + m.parentNid + '"]');
              if (!parent) { console.debug('[FSB-DASH] Stale parentNid:', m.parentNid); break; }
              var temp = doc.createElement('div');
              temp.innerHTML = m.html;
              var newNode = temp.firstElementChild;
              if (!newNode) break;
              if (m.beforeNid) {
                var before = doc.querySelector('[data-fsb-nid="' + m.beforeNid + '"]');
                parent.insertBefore(newNode, before);
              } else {
                parent.appendChild(newNode);
              }
              break;
            }
            case 'rm': {
              var el = doc.querySelector('[data-fsb-nid="' + m.nid + '"]');
              if (!el) { console.debug('[FSB-DASH] Stale rm nid:', m.nid); break; }
              if (el.parentNode) el.parentNode.removeChild(el);
              break;
            }
            case 'attr': {
              var target = doc.querySelector('[data-fsb-nid="' + m.nid + '"]');
              if (!target) { console.debug('[FSB-DASH] Stale attr nid:', m.nid); break; }
              if (m.val === null) {
                target.removeAttribute(m.attr);
              } else {
                target.setAttribute(m.attr, m.val);
              }
              break;
            }
            case 'text': {
              var textTarget = doc.querySelector('[data-fsb-nid="' + m.nid + '"]');
              if (!textTarget) { console.debug('[FSB-DASH] Stale text nid:', m.nid); break; }
              textTarget.textContent = m.text;
              break;
            }
          }
        } catch (e) {
          // Skip individual mutation errors -- don't break the whole batch
        }
      });

      // Maintain scroll position after DOM changes
      try {
        previewIframe.contentWindow.scrollTo(lastPreviewScroll.x, lastPreviewScroll.y);
      } catch (e) { /* ignore */ }
    } catch (e) {
      console.warn('[FSB-DASH] Mutation apply error:', e.message);
      // Don't change state -- keep showing last good content
    }
  }

  function handleDOMScroll(payload) {
    // Store last scroll position for maintenance after mutations
    lastPreviewScroll.x = payload.scrollX || 0;
    lastPreviewScroll.y = payload.scrollY || 0;

    if (previewState !== 'streaming' || !previewIframe) return;
    try {
      previewIframe.contentWindow.scrollTo({
        left: lastPreviewScroll.x,
        top: lastPreviewScroll.y,
        behavior: 'smooth'
      });
    } catch (e) { /* ignore */ }
  }

  function handleDOMOverlay(payload) {
    if (previewState !== 'streaming') return;

    // Update glow rect
    if (payload.glow && payload.glow.state === 'active' && previewGlow) {
      previewGlow.style.display = '';
      previewGlow.style.top = (payload.glow.y * previewScale) + 'px';
      previewGlow.style.left = (payload.glow.x * previewScale) + 'px';
      previewGlow.style.width = (payload.glow.w * previewScale) + 'px';
      previewGlow.style.height = (payload.glow.h * previewScale) + 'px';
    } else if (previewGlow) {
      previewGlow.style.display = 'none';
    }

    // Update progress indicator
    if (payload.progress && previewProgress) {
      previewProgress.style.display = '';
      previewProgress.textContent = Math.round(payload.progress.percent || 0) + '% - ' + (payload.progress.phase || 'Working');
    }
  }

  document.addEventListener('visibilitychange', function() {
    if (previewState === 'hidden' || previewState === 'error' || previewState === 'paused') return;

    if (document.hidden) {
      // Tab hidden -- pause stream (only if user toggle is on; if user paused, already handled)
      if (ws && ws.readyState === WebSocket.OPEN && previewState === 'streaming') {
        ws.send(JSON.stringify({
          type: 'dash:dom-stream-pause',
          payload: {},
          ts: Date.now()
        }));
      }
    } else {
      // Tab visible -- resume stream (triggers fresh snapshot)
      if (streamToggleOn && ws && ws.readyState === WebSocket.OPEN && (previewState === 'streaming' || previewState === 'disconnected')) {
        ws.send(JSON.stringify({
          type: 'dash:dom-stream-resume',
          payload: {},
          ts: Date.now()
        }));
        setPreviewState('loading');
      }
    }
  });

  // Stream toggle button
  if (previewToggle) {
    previewToggle.addEventListener('click', function() {
      streamToggleOn = !streamToggleOn;
      previewToggle.title = streamToggleOn ? 'Pause stream' : 'Resume stream';
      previewToggle.innerHTML = streamToggleOn
        ? '<i class="fa-solid fa-pause"></i>'
        : '<i class="fa-solid fa-play"></i>';
      if (ws && ws.readyState === WebSocket.OPEN) {
        if (streamToggleOn) {
          ws.send(JSON.stringify({ type: 'dash:dom-stream-resume', payload: {}, ts: Date.now() }));
          setPreviewState('loading');
        } else {
          ws.send(JSON.stringify({ type: 'dash:dom-stream-pause', payload: {}, ts: Date.now() }));
          setPreviewState('paused');
        }
      }
    });
  }

  function updatePreviewTooltip() {
    if (!previewTooltip) return;
    var parts = [];
    if (streamTabUrl) parts.push(streamTabUrl.length > 60 ? streamTabUrl.substring(0, 60) + '...' : streamTabUrl);
    if (lastSnapshotTime) parts.push('Last snapshot: ' + new Date(lastSnapshotTime).toLocaleTimeString());
    previewTooltip.textContent = parts.join(' | ') || 'No stream data';
  }

  // --- WebSocket ---

  function connectWS() {
    disconnectWS();
    var proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    var wsUrl = proto + '//' + location.host + '/ws?key=' +
      encodeURIComponent(hashKey) + '&role=dashboard';

    console.log('[FSB-DASH] Connecting WS to:', wsUrl);
    ws = new WebSocket(wsUrl);
    setWsState('reconnecting');

    ws.onopen = function () {
      console.log('[FSB-DASH] WS connected');
      wsReconnectDelay = 0;
      setWsState('connected');
      // Always request stream on connect -- don't wait for ext:page-ready
      // The extension will respond with a snapshot if a content script is ready
      if (streamToggleOn) {
        ws.send(JSON.stringify({
          type: 'dash:dom-stream-start',
          payload: {},
          ts: Date.now()
        }));
        setPreviewState('loading');
      }
    };

    ws.onmessage = function (event) {
      try {
        var msg = JSON.parse(event.data);
        console.log('[FSB-DASH] WS msg:', msg.type, msg.payload ? JSON.stringify(msg.payload).substring(0, 100) : '');
        handleWSMessage(msg);
      } catch (e) { /* ignore parse errors */ }
    };

    ws.onclose = function (e) {
      console.log('[FSB-DASH] WS closed, code:', e.code, 'reason:', e.reason);
      pageReady = false; // Reset so reconnect waits for fresh page-ready signal
      setWsState('disconnected');
      if (previewState === 'streaming' || previewState === 'loading') {
        setPreviewState('disconnected');
      }
      scheduleWSReconnect();
    };

    ws.onerror = function (e) { console.log('[FSB-DASH] WS error:', e); };
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

    // Agent run progress from extension
    if (msg.type === 'ext:agent-run-progress') {
      var rp = msg.payload || {};
      if (rp.agentId === agentRunningId) {
        if (detailRunBar) detailRunBar.style.width = (rp.progress || 0) + '%';
        if (detailRunAction) detailRunAction.textContent = rp.action || 'Working...';
      }
      return;
    }

    // Agent run complete from extension
    if (msg.type === 'ext:agent-run-complete') {
      var rc = msg.payload || {};
      agentRunningId = null;
      renderAgents(); // Remove spinner

      // Update detail panel if showing this agent
      if (rc.agentId === detailAgentId) {
        if (detailRunNow) { detailRunNow.disabled = false; detailRunNow.textContent = 'Run Now'; }
        if (detailRunProgress) {
          if (detailRunBar) {
            detailRunBar.style.width = '100%';
            detailRunBar.className = 'dash-task-bar-fill ' + (rc.success ? 'dash-task-bar-success' : 'dash-task-bar-failed');
          }
          if (detailRunAction) detailRunAction.textContent = rc.success ? 'Complete' : (rc.error || 'Failed');
          // Auto-hide progress bar after 3 seconds
          setTimeout(function () {
            if (detailRunProgress) detailRunProgress.style.display = 'none';
          }, 3000);
        }
        // Reload detail panel data
        loadAgentStats(detailAgentId);
        loadDetailRuns(detailAgentId, 0);
      }

      // Refresh grid data
      loadData();
      return;
    }

    if (msg.type === 'ext:dom-snapshot') {
      handleDOMSnapshot(msg.payload);
      return;
    }

    if (msg.type === 'ext:dom-mutations') {
      handleDOMMutations(msg.payload);
      return;
    }

    if (msg.type === 'ext:dom-scroll') {
      handleDOMScroll(msg.payload);
      return;
    }

    if (msg.type === 'ext:dom-overlay') {
      handleDOMOverlay(msg.payload);
      return;
    }

    if (msg.type === 'ext:page-ready') {
      pageReady = true;
      streamTabUrl = (msg.payload && msg.payload.url) || '';
      // Auto-start stream if toggle is on and WS is connected
      if (streamToggleOn && ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'dash:dom-stream-start',
          payload: {},
          ts: Date.now()
        }));
        setPreviewState('loading');
      }
      updatePreviewTooltip();
      return;
    }

    if (msg.type === 'ext:stream-tab-info') {
      var info = msg.payload || {};
      streamTabUrl = info.url || '';
      if (info.ready) {
        pageReady = true;
        setPreviewState('loading'); // New tab snapshot incoming
      } else {
        // Restricted page -- show disconnected state with info
        if (previewState === 'streaming') {
          setPreviewState('disconnected');
        }
      }
      updatePreviewTooltip();
      return;
    }

    // Agent/run events from REST API broadcasts
    if (msg.type === 'agent_updated' || msg.type === 'agent_deleted' || msg.type === 'run_completed') {
      loadData();
      if (msg.agentId && msg.agentId === detailAgentId) {
        loadAgentStats(detailAgentId);
        loadDetailRuns(detailAgentId, 0);
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
