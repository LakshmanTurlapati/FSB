// Offscreen document for Speech-to-Text.
// Runs SpeechRecognition in a full browsing context — works even when
// the active tab is a restricted URL (chrome://, new tab, etc.).
// Uses the same message format as content/stt-recognition.js so that
// speech-to-text.js handles both paths with a single listener.

let recognition = null;
let finalTranscript = '';

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.target !== 'offscreen-stt') return;

  if (msg.action === 'start') {
    if (recognition) {
      try { recognition.abort(); } catch (_) {}
      recognition = null;
    }
    finalTranscript = '';
    startRecognition(msg.lang);
    sendResponse({ ok: true });
  } else if (msg.action === 'stop') {
    if (recognition) {
      try { recognition.stop(); } catch (_) {}
    }
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

  recognition.onstart = () => notify('start');

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

function notify(event, data) {
  try {
    // Same format as content script relay — speech-to-text.js handles both uniformly
    chrome.runtime.sendMessage({ from: 'content-stt', event, ...data });
  } catch (_) {}
}
