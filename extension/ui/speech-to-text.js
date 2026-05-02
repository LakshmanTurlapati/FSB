// Speech-to-Text module for FSB
// Path 1: Direct SpeechRecognition in extension page (preferred, Chrome 116+)
// Path 2: Content script relay via background (fallback for older Chrome)
// Path 3: OpenAI Whisper API via MediaRecorder (when configured)

class FSBSpeechToText {
  constructor(targetInput, micBtn, sendBtn) {
    this.targetInput = targetInput;
    this.micBtn = micBtn;
    this.sendBtn = sendBtn;
    this.isRecording = false;
    this._directRecognition = null;   // direct SpeechRecognition instance
    this._usingContentScript = false; // tracks if content script relay is active
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.sttProvider = 'browser'; // 'browser' or 'whisper'
    this.openaiApiKey = null;
    this._preExistingText = '';
    this._finalTranscript = '';

    this._loadSettings();
    this._setupMicButton();
    this._setupMessageListener(); // for content script relay fallback

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && (changes.sttProvider || changes.openaiApiKey)) {
        this._loadSettings();
      }
    });
  }

  async _loadSettings() {
    try {
      const data = await chrome.storage.local.get(['sttProvider', 'openaiApiKey']);
      this.openaiApiKey = data.openaiApiKey || null;
      this.sttProvider = data.sttProvider || 'browser';
    } catch (e) {
      console.warn('[STT] Failed to load settings:', e);
    }
  }

  _setupMicButton() {
    this.micBtn.addEventListener('click', () => {
      if (this.isRecording) {
        this.stop();
      } else {
        this.start();
      }
    });
  }

  // Listen for speech results from the content script relay
  _setupMessageListener() {
    chrome.runtime.onMessage.addListener((msg) => {
      if (msg.from !== 'content-stt') return;
      if (!this._usingContentScript) return; // ignore stale messages

      switch (msg.event) {
        case 'start':
          this._setRecording();
          break;
        case 'result':
          this._insertText(msg.text, msg.isInterim);
          break;
        case 'end':
          if (msg.text) {
            this._insertText(msg.text, false);
          }
          this._usingContentScript = false;
          this._setIdle();
          break;
        case 'error':
          if (msg.error === 'not-allowed') {
            this._showError('Microphone access denied — allow mic in browser settings');
          } else if (msg.error === 'not-supported') {
            this._showError('Speech recognition not supported in this browser');
          } else if (msg.error !== 'aborted') {
            this._showError('Speech error: ' + msg.error);
          }
          this._usingContentScript = false;
          this._setIdle();
          break;
      }
    });
  }

  async start() {
    if (this.isRecording) return;

    this._preExistingText = (this.targetInput.textContent || '').trimEnd();
    this._finalTranscript = '';

    const useWhisper = this.sttProvider === 'whisper' && this.openaiApiKey;

    if (useWhisper) {
      await this._startWhisper();
    } else {
      await this._startBrowser();
    }
  }

  stop() {
    if (!this.isRecording) return;

    // Direct SpeechRecognition
    if (this._directRecognition) {
      this._directRecognition.stop(); // triggers onend → _setIdle
      return;
    }

    // Content script relay
    if (this._usingContentScript) {
      chrome.runtime.sendMessage({ action: 'stt-stop' });
      this._usingContentScript = false;
      this._setIdle();
      return;
    }

    // Whisper MediaRecorder
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop(); // triggers onstop → transcribe → _setIdle
      return;
    }

    this._setIdle();
  }

  // ── Browser Web Speech API ──

  async _startBrowser() {
    // Extension pages (sidepanel/popup) can't use SpeechRecognition directly —
    // Chrome won't show a mic permission prompt for chrome-extension:// origins.
    // Always use content script relay, which runs SR in the page's context
    // where the standard permission prompt appears in the tab's address bar.
    if (location.protocol === 'chrome-extension:') {
      return this._startContentScriptRelay();
    }

    // Non-extension context: try direct SpeechRecognition
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SR) {
      return this._startDirectSR(SR);
    }

    return this._startContentScriptRelay();
  }

  _startDirectSR(SR) {
    try {
      const recognition = new SR();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = navigator.language || 'en-US';
      this._finalTranscript = '';

      recognition.onstart = () => {
        this._setRecording();
      };

      recognition.onresult = (event) => {
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const t = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            this._finalTranscript += t;
          } else {
            interim = t;
          }
        }
        this._insertText(this._finalTranscript + interim, !!interim);
      };

      recognition.onend = () => {
        if (this._finalTranscript) {
          this._insertText(this._finalTranscript, false);
        }
        this._directRecognition = null;
        this._setIdle();
      };

      recognition.onerror = (event) => {
        if (event.error === 'not-allowed') {
          this._showError('Microphone access denied — allow mic in browser settings');
        } else if (event.error === 'service-not-allowed') {
          // Direct SR not available in extension page — try content script
          this._directRecognition = null;
          this._startContentScriptRelay();
          return;
        } else if (event.error !== 'aborted') {
          this._showError('Speech error: ' + event.error);
        }
        this._directRecognition = null;
        this._setIdle();
      };

      this._directRecognition = recognition;
      recognition.start();
    } catch (e) {
      console.warn('[STT] Direct SpeechRecognition failed, trying content script:', e);
      this._directRecognition = null;
      return this._startContentScriptRelay();
    }
  }

  async _startContentScriptRelay() {
    this._usingContentScript = true;
    try {
      const resp = await chrome.runtime.sendMessage({
        action: 'stt-start',
        lang: navigator.language || 'en-US'
      });
      if (resp?.error) {
        this._showError(resp.error);
        this._usingContentScript = false;
      }
    } catch (e) {
      this._showError('Failed to start speech recognition');
      this._usingContentScript = false;
    }
  }

  // ── OpenAI Whisper API ──

  async _startWhisper() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.audioChunks = [];

      this.mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });

      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) this.audioChunks.push(e.data);
      };

      this.mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        if (this.audioChunks.length === 0) {
          this.mediaRecorder = null;
          this._setIdle();
          return;
        }

        const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
        this._setTranscribing();
        await this._transcribeWithWhisper(audioBlob);
      };

      this.mediaRecorder.start(250);
      this._setRecording();
    } catch (e) {
      if (e.name === 'NotAllowedError') {
        this._showError('Microphone access denied');
      } else {
        this._showError('Could not access microphone');
      }
      this._setIdle();
    }
  }

  async _transcribeWithWhisper(audioBlob) {
    try {
      const formData = new FormData();
      formData.append('file', audioBlob, 'recording.webm');
      formData.append('model', 'whisper-1');

      const resp = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${this.openaiApiKey}` },
        body: formData
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error?.message || `HTTP ${resp.status}`);
      }

      const data = await resp.json();
      if (data.text) {
        this._insertText(data.text, false);
      }
    } catch (e) {
      console.error('[STT] Whisper error:', e);
      this._showError('Whisper failed: ' + e.message);
    } finally {
      this.mediaRecorder = null;
      this._setIdle();
    }
  }

  // ── UI State ──

  _setRecording() {
    this.isRecording = true;
    this.micBtn.classList.add('recording');
    this.micBtn.title = 'Stop recording';
    const icon = this.micBtn.querySelector('i');
    if (icon) {
      icon.className = 'fa fa-stop';
    }
    // Hide send button during recording — mic IS the primary action
    if (this.sendBtn) {
      this.sendBtn.classList.add('hidden');
    }
  }

  _setTranscribing() {
    this.micBtn.classList.remove('recording');
    this.micBtn.classList.add('transcribing');
    this.micBtn.title = 'Transcribing...';
    const icon = this.micBtn.querySelector('i');
    if (icon) {
      icon.className = 'fa fa-spinner fa-spin';
    }
  }

  _setIdle() {
    this.isRecording = false;
    this._directRecognition = null;
    this._usingContentScript = false;
    this.micBtn.classList.remove('recording', 'transcribing');
    this.micBtn.title = 'Voice input';
    const icon = this.micBtn.querySelector('i');
    if (icon) {
      icon.className = 'fa fa-microphone';
    }
    // Restore send button
    if (this.sendBtn) {
      this.sendBtn.classList.remove('hidden');
    }
  }

  _insertText(text, isInterim) {
    if (!text) return;
    const pre = this._preExistingText;
    const separator = pre && !pre.endsWith(' ') ? ' ' : '';
    this.targetInput.textContent = pre + separator + text;
    // Trigger input event so send button state updates
    this.targetInput.dispatchEvent(new Event('input', { bubbles: true }));
    // Place cursor at end
    const range = document.createRange();
    const sel = window.getSelection();
    range.selectNodeContents(this.targetInput);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
  }

  _showError(msg) {
    console.warn('[STT]', msg);
    this.micBtn.title = msg;
    this.micBtn.classList.add('error');
    const prevPlaceholder = this.targetInput.dataset.placeholder || '';
    const prevText = this.targetInput.textContent;
    if (!prevText) {
      this.targetInput.setAttribute('data-placeholder', msg);
    }
    setTimeout(() => {
      this.micBtn.classList.remove('error');
      this.micBtn.title = 'Voice input';
      if (!this.targetInput.textContent) {
        this.targetInput.setAttribute('data-placeholder', prevPlaceholder || 'Ask me to automate something...');
      }
    }, 3000);
  }
}
