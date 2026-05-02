(function(global) {
  'use strict';

  function clampOverlayPercent(value) {
    var numeric = Number(value);
    if (!isFinite(numeric)) return null;
    return Math.max(0, Math.min(100, Math.round(numeric)));
  }

  function sanitizeOverlayText(text, maxLen) {
    if (text === undefined || text === null) return '';
    var clean = String(text)
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/\*(.+?)\*/g, '$1')
      .replace(/__(.+?)__/g, '$1')
      .replace(/_(.+?)_/g, '$1')
      .replace(/`(.+?)`/g, '$1')
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/\s+/g, ' ')
      .trim();

    var limit = typeof maxLen === 'number' ? maxLen : 120;
    if (clean.length > limit) {
      clean = clean.substring(0, limit - 3) + '...';
    }
    return clean;
  }

  function firstSentence(text) {
    if (!text) return '';
    var str = String(text).trim();
    var match = str.match(/^[^.!?]+[.!?]/);
    var sentence = match ? match[0].trim() : str;
    if (sentence.length > 60) {
      sentence = sentence.substring(0, 57) + '...';
    }
    return sentence;
  }

  function sanitizeActionText(text) {
    if (text === undefined || text === null) return '';
    var str = String(text).trim();
    if (!str) return '';

    // Strip "Step N/M: " prefix (per D-01, DATA-01)
    str = str.replace(/^Step\s+\d+\/\d+:\s*/i, '');
    if (!str) return '';

    // Tool command regex from UI-SPEC L124
    var toolPattern = /^(click|rightClick|doubleClick|hover|type|clearInput|selectText|pressEnter|keyPress|selectOption|toggleCheckbox|navigate|searchGoogle|scroll|waitForElement|getText|getAttribute|setAttribute|moveMouse|focus|blur|refresh|goBack|goForward|solveCaptcha)\b/i;
    var match = str.match(toolPattern);
    if (!match) return str; // Already human-readable

    var tool = match[1].toLowerCase();
    var replacements = {
      click: 'Clicking element',
      rightclick: 'Clicking element',
      doubleclick: 'Clicking element',
      hover: 'Hovering over element',
      type: 'Typing text',
      clearinput: 'Clearing input',
      selecttext: 'Selecting text',
      pressenter: 'Pressing key',
      keypress: 'Pressing key',
      selectoption: 'Selecting option',
      togglecheckbox: 'Toggling checkbox',
      navigate: 'Navigating to page',
      searchgoogle: 'Searching',
      scroll: 'Scrolling page',
      waitforelement: 'Waiting for page',
      gettext: 'Reading page content',
      getattribute: 'Reading page content',
      setattribute: 'Updating element',
      movemouse: 'Moving cursor',
      focus: 'Focusing element',
      blur: 'Focusing element',
      refresh: 'Refreshing page',
      goback: 'Going back',
      goforward: 'Going forward',
      solvecaptcha: 'Handling verification'
    };

    return replacements[tool] || str;
  }

  function normalizeOverlayPhase(phase) {
    switch (phase) {
      case 'thinking':
      case 'progress':
        return 'planning';
      case 'executing':
        return 'acting';
      case 'sheets-entry':
      case 'sheets-formatting':
        return 'writing';
      case 'tab_switch':
        return 'switching_tab';
      case 'complete':
      case 'error':
      case 'analyzing':
      case 'acting':
      case 'recovering':
      case 'writing':
      case 'switching_tab':
        return phase;
      case 'ended':
      case 'cleared':
        return 'cleared';
      default:
        return phase ? String(phase) : 'planning';
    }
  }

  function getOverlayLifecycle(statusData, normalizedPhase) {
    if (statusData && statusData.lifecycle) return statusData.lifecycle;
    if (normalizedPhase === 'cleared') return 'cleared';
    if (normalizedPhase === 'complete' || normalizedPhase === 'error') return 'final';
    return 'running';
  }

  function getOverlayResult(statusData, normalizedPhase, lifecycle) {
    if (statusData && statusData.result) return statusData.result;
    if (lifecycle !== 'final') return null;
    if (normalizedPhase === 'complete') return 'success';
    if (normalizedPhase === 'error') return 'error';
    if (statusData && (statusData.reason === 'stopped' || statusData.reason === 'cleanup')) return 'stopped';
    return 'success';
  }

  function humanizeOverlayPhase(phase) {
    var labels = {
      analyzing: 'Analyzing',
      planning: 'Planning',
      acting: 'Acting',
      recovering: 'Recovering',
      writing: 'Writing',
      switching_tab: 'Switching Tabs',
      complete: 'Complete',
      error: 'Error',
      cleared: 'Hidden'
    };
    return labels[phase] || sanitizeOverlayText(phase || 'Working', 32) || 'Working';
  }

  function getDefaultDetail(phase, result) {
    if (result === 'success') return 'Task completed';
    if (result === 'partial') return 'Task partially completed';
    if (result === 'error') return 'Task ended with an error';
    if (result === 'stopped') return 'Task stopped';

    switch (phase) {
      case 'analyzing':
        return 'Reviewing page state';
      case 'planning':
        return 'Planning next step';
      case 'acting':
        return 'Performing browser action';
      case 'recovering':
        return 'Recovering from interruption';
      case 'writing':
        return 'Updating page';
      case 'switching_tab':
        return 'Switching to another tab';
      default:
        return 'Working';
    }
  }

  function buildOverlayDisplay(statusData, session, normalizedPhase, result) {
    var display = (statusData && statusData.display) || {};
    var rawTitle = display.title;
    var rawSubtitle = display.subtitle;
    var rawDetail = display.detail;

    if (rawTitle === undefined) {
      rawTitle = (statusData && statusData.taskSummary)
        || (session && session.taskSummary)
        || (statusData && statusData.taskName)
        || (session && session.task)
        || 'FSB Automating';
    }

    if (rawSubtitle === undefined) {
      var taskName = (statusData && statusData.taskName) || (session && session.task) || '';
      var taskSummary = (statusData && statusData.taskSummary) || (session && session.taskSummary) || '';
      rawSubtitle = (taskSummary && taskName && taskSummary !== taskName) ? taskName : '';
    }

    if (rawDetail === undefined) {
      // D-08: Prefer _lastActionSummary (AI-generated human text) over statusText
      var sessionSummary = (session && session._lastActionSummary) || null;
      rawDetail = sessionSummary
        || (statusData && statusData.statusText)
        || getDefaultDetail(normalizedPhase, result);
    }

    return {
      title: sanitizeOverlayText(rawTitle, 50) || 'FSB Automating',
      subtitle: sanitizeOverlayText(rawSubtitle, 60),
      detail: sanitizeActionText(firstSentence(sanitizeOverlayText(rawDetail, 120))) || getDefaultDetail(normalizedPhase, result)
    };
  }

  // D-02: ETA removed from overlay in Phase 168. Elapsed time replaces it in Phase 169.
  function computeMultiSiteProgress(session) {
    var ms = session && session.multiSite;
    var companies = (ms && (ms.companyList || ms.companies)) || [];
    var total = companies.length;
    if (!total) {
      return { mode: 'indeterminate', percent: null, label: 'Searching', eta: null };
    }

    var completed = Math.max(0, Math.min(total, ms.currentIndex || 0));
    var current = Math.min(total, completed + 1);
    return {
      mode: 'determinate',
      percent: clampOverlayPercent((completed / total) * 100),
      label: current + '/' + total + ' companies',
      eta: null
    };
  }

  function computeSheetsProgress(session) {
    var sd = session && session.sheetsData;
    if (!sd) {
      return { mode: 'indeterminate', percent: null, label: 'Writing', eta: null };
    }

    if (sd.formattingPhase && !sd.formattingComplete) {
      return { mode: 'indeterminate', percent: null, label: 'Formatting', eta: null };
    }

    if (sd.formattingComplete) {
      return { mode: 'determinate', percent: 100, label: 'Formatted', eta: null };
    }

    var totalRows = Math.max(1, sd.totalRows || 1);
    var rowsWritten = Math.max(0, Math.min(totalRows, sd.rowsWritten || 0));
    return {
      mode: 'determinate',
      percent: clampOverlayPercent((rowsWritten / totalRows) * 100),
      label: rowsWritten + '/' + totalRows + ' rows',
      eta: null
    };
  }

  function normalizeExplicitProgress(progress) {
    if (!progress || typeof progress !== 'object') return null;
    var mode = progress.mode === 'determinate' ? 'determinate' : 'indeterminate';
    var percent = mode === 'determinate' ? clampOverlayPercent(progress.percent) : null;
    if (mode === 'determinate' && percent === null) {
      mode = 'indeterminate';
    }
    return {
      mode: mode,
      percent: percent,
      label: sanitizeOverlayText(progress.label || '', 40),
      eta: null
    };
  }

  function buildOverlayProgress(statusData, session, normalizedPhase, lifecycle, result) {
    if (lifecycle === 'cleared') return null;

    var explicit = normalizeExplicitProgress(statusData && statusData.progress);
    if (explicit) {
      if (explicit.mode === 'determinate' && !explicit.label) {
        explicit.label = explicit.percent + '%';
      }
      if (explicit.mode === 'indeterminate' && !explicit.label) {
        explicit.label = humanizeOverlayPhase(normalizedPhase);
      }
      return explicit;
    }

    var explicitPercent = clampOverlayPercent(statusData && statusData.progressPercent);

    if (explicitPercent !== null) {
      return {
        mode: 'determinate',
        percent: explicitPercent,
        label: explicitPercent + '%',
        eta: null
      };
    }

    if (session && session.multiSite) {
      return computeMultiSiteProgress(session);
    }

    if (session && session.sheetsData) {
      return computeSheetsProgress(session);
    }

    if (lifecycle === 'final') {
      if (result === 'success') {
        return { mode: 'determinate', percent: 100, label: 'Done', eta: null };
      }
      if (result === 'partial') {
        return { mode: 'indeterminate', percent: null, label: 'Partial', eta: null };
      }
      if (result === 'error') {
        return { mode: 'indeterminate', percent: null, label: 'Error', eta: null };
      }
    }

    return {
      mode: 'indeterminate',
      percent: null,
      label: humanizeOverlayPhase(normalizedPhase),
      eta: null
    };
  }

  function buildOverlayState(statusData, session) {
    var normalizedPhase = normalizeOverlayPhase(statusData && statusData.phase);
    var lifecycle = getOverlayLifecycle(statusData || {}, normalizedPhase);
    var result = getOverlayResult(statusData || {}, normalizedPhase, lifecycle);
    var sessionToken = statusData && statusData.sessionToken ? String(statusData.sessionToken) : null;
    var version = Number.isFinite(statusData && statusData.version) ? Number(statusData.version) : null;
    var clientLabel = statusData && statusData.clientLabel ? String(statusData.clientLabel) : null;

    return {
      ...(sessionToken ? { sessionToken: sessionToken } : {}),
      ...(version !== null ? { version: version } : {}),
      ...(clientLabel ? { clientLabel: clientLabel } : {}),
      lifecycle: lifecycle,
      result: result,
      phase: lifecycle === 'cleared' ? 'cleared' : normalizedPhase,
      display: buildOverlayDisplay(statusData || {}, session || null, normalizedPhase, result),
      progress: buildOverlayProgress(statusData || {}, session || null, normalizedPhase, lifecycle, result),
      actionCount: null,
      highlight: {
        animated: !!(!statusData || statusData.animatedHighlights !== false) && lifecycle === 'running'
      }
    };
  }

  function shouldApplyOverlayState(currentState, nextState) {
    if (!nextState) return false;
    if (!currentState) return true;

    if (currentState.sessionToken && nextState.sessionToken &&
        currentState.sessionToken !== nextState.sessionToken) {
      return nextState.lifecycle !== 'cleared';
    }

    if (typeof currentState.version === 'number' && typeof nextState.version === 'number') {
      return nextState.version >= currentState.version;
    }

    return true;
  }

  var exportsObj = {
    clampOverlayPercent: clampOverlayPercent,
    sanitizeOverlayText: sanitizeOverlayText,
    sanitizeActionText: sanitizeActionText,
    normalizeOverlayPhase: normalizeOverlayPhase,
    humanizeOverlayPhase: humanizeOverlayPhase,
    buildOverlayState: buildOverlayState,
    shouldApplyOverlayState: shouldApplyOverlayState
  };

  global.FSBOverlayStateUtils = exportsObj;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exportsObj;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
