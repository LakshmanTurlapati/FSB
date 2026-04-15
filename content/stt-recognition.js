// Standalone STT content script — injected into the active tab on demand.
// Runs SpeechRecognition in the page's security context where it's allowed.
// Communicates via chrome.runtime.sendMessage (broadcasts to side panel + background).
//
// IDEMPOTENT: re-injection is a no-op — the listener persists across sessions.
(function () {
  // Only set up once per tab — prevents duplicate listeners on re-injection
  if (window.__FSB_STT_SETUP__) return;
  window.__FSB_STT_SETUP__ = true;

  let recognition = null;
  let finalTranscript = '';

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.target !== 'content-stt') return;

    if (msg.action === 'start') {
      // Stop any existing session first
      if (recognition) {
        try { recognition.abort(); } catch (_) {}
        recognition = null;
      }
      finalTranscript = '';
      startRecognition(msg.lang);
      sendResponse({ ok: true });
    } else if (msg.action === 'stop') {
      stopRecognition();
      sendResponse({ ok: true });
    }
    return true;
  });

  function startRecognition(lang) {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      notify('error', { error: 'not-supported' });
      return;
    }

    recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = lang || 'en-US';

    recognition.onstart = () => {
      notify('start');
    };

    recognition.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += t;
        } else {
          interim = t;
        }
      }
      notify('result', { text: finalTranscript + interim, isInterim: true });
    };

    recognition.onend = () => {
      notify('end', { text: finalTranscript });
      recognition = null;
    };

    recognition.onerror = (event) => {
      notify('error', { error: event.error });
      recognition = null;
    };

    try {
      recognition.start();
    } catch (e) {
      notify('error', { error: e.message || 'start-failed' });
      recognition = null;
    }
  }

  function stopRecognition() {
    if (recognition) {
      try { recognition.stop(); } catch (_) {}
    }
  }

  function notify(event, data) {
    try {
      chrome.runtime.sendMessage({ from: 'content-stt', event, ...data });
    } catch (_) {
      // Extension context invalidated (e.g., extension reloaded)
    }
  }
})();
