/* =============================================
   FSB Showcase - Recreation Animations
   Typing effect, message cascade, chart growth,
   progress bar fill, viewport glow beams
   ============================================= */

(function () {
  'use strict';

  // --- Typing effect for terminal mockup ---
  function initTerminalTyping() {
    var textEl = document.querySelector('.terminal-text');
    if (!textEl) return;

    var fullText = textEl.getAttribute('data-text') || textEl.textContent;
    textEl.textContent = '';
    var cursor = textEl.nextElementSibling; // .terminal-cursor

    var i = 0;
    var typingStarted = false;

    function typeChar() {
      if (i < fullText.length) {
        textEl.textContent += fullText.charAt(i);
        i++;
        setTimeout(typeChar, 35 + Math.random() * 25);
      }
    }

    // Use IntersectionObserver to start typing when visible
    if ('IntersectionObserver' in window) {
      var observer = new IntersectionObserver(function (entries) {
        if (entries[0].isIntersecting && !typingStarted) {
          typingStarted = true;
          setTimeout(typeChar, 600);
          observer.disconnect();
        }
      }, { threshold: 0.5 });
      observer.observe(textEl.parentElement);
    } else {
      setTimeout(typeChar, 600);
    }
  }

  // --- Message cascade for side panel recreations ---
  function initMessageCascade() {
    var cascadeContainers = document.querySelectorAll('.rec-messages');
    if (!cascadeContainers.length) return;

    cascadeContainers.forEach(function (container) {
      var messages = container.querySelectorAll('.rec-msg');
      if (!messages.length) return;

      // Hide all messages initially
      messages.forEach(function (msg) {
        msg.style.opacity = '0';
        msg.style.transform = 'translateY(16px)';
      });

      var cascadeStarted = false;

      function startCascade() {
        messages.forEach(function (msg, index) {
          setTimeout(function () {
            msg.style.transition = 'opacity 0.4s ease-out, transform 0.4s ease-out';
            msg.style.opacity = '1';
            msg.style.transform = 'translateY(0)';
          }, index * 200);
        });
      }

      if ('IntersectionObserver' in window) {
        var observer = new IntersectionObserver(function (entries) {
          if (entries[0].isIntersecting && !cascadeStarted) {
            cascadeStarted = true;
            startCascade();
            observer.disconnect();
          }
        }, { threshold: 0.2 });
        observer.observe(container);
      } else {
        startCascade();
      }
    });
  }

  // --- Progress bar fill animation ---
  function initProgressBars() {
    var bars = document.querySelectorAll('.rec-progress-fill[data-width]');
    if (!bars.length) return;

    bars.forEach(function (bar) {
      var targetWidth = bar.getAttribute('data-width');
      bar.style.width = '0%';
      var filled = false;

      if ('IntersectionObserver' in window) {
        var observer = new IntersectionObserver(function (entries) {
          if (entries[0].isIntersecting && !filled) {
            filled = true;
            setTimeout(function () {
              bar.style.transition = 'width 1.2s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
              bar.style.width = targetWidth;
            }, 300);
            observer.disconnect();
          }
        }, { threshold: 0.3 });
        observer.observe(bar);
      } else {
        bar.style.width = targetWidth;
      }
    });
  }

  // --- Chart bar growth animation ---
  function initChartBars() {
    var chartContainer = document.querySelector('.rec-chart');
    if (!chartContainer) return;

    var bars = chartContainer.querySelectorAll('.rec-chart-bar');
    if (!bars.length) return;

    // Store target heights and reset
    bars.forEach(function (bar) {
      var targetHeight = bar.getAttribute('data-height');
      bar.style.height = '0';
    });

    var grown = false;

    if ('IntersectionObserver' in window) {
      var observer = new IntersectionObserver(function (entries) {
        if (entries[0].isIntersecting && !grown) {
          grown = true;
          bars.forEach(function (bar, index) {
            var targetHeight = bar.getAttribute('data-height');
            setTimeout(function () {
              bar.style.transition = 'height 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
              bar.style.height = targetHeight;
            }, index * 100);
          });
          observer.disconnect();
        }
      }, { threshold: 0.3 });
      observer.observe(chartContainer);
    } else {
      bars.forEach(function (bar) {
        bar.style.height = bar.getAttribute('data-height');
      });
    }
  }

  // --- Metric counter animation ---
  function initCounters() {
    var counters = document.querySelectorAll('.rec-metric-value[data-count]');
    if (!counters.length) return;

    counters.forEach(function (counter) {
      var target = counter.getAttribute('data-count');
      var suffix = counter.getAttribute('data-suffix') || '';
      var prefix = counter.getAttribute('data-prefix') || '';
      var isFloat = target.indexOf('.') !== -1;
      var targetNum = parseFloat(target);
      var counted = false;

      function animateCount() {
        var duration = 1500;
        var start = performance.now();

        function step(now) {
          var elapsed = now - start;
          var progress = Math.min(elapsed / duration, 1);
          // Ease out cubic
          var eased = 1 - Math.pow(1 - progress, 3);
          var current = eased * targetNum;

          if (isFloat) {
            counter.textContent = prefix + current.toFixed(2) + suffix;
          } else {
            counter.textContent = prefix + Math.round(current).toLocaleString() + suffix;
          }

          if (progress < 1) {
            requestAnimationFrame(step);
          }
        }
        requestAnimationFrame(step);
      }

      if ('IntersectionObserver' in window) {
        var observer = new IntersectionObserver(function (entries) {
          if (entries[0].isIntersecting && !counted) {
            counted = true;
            animateCount();
            observer.disconnect();
          }
        }, { threshold: 0.5 });
        observer.observe(counter);
      } else {
        if (isFloat) {
          counter.textContent = prefix + targetNum.toFixed(2) + suffix;
        } else {
          counter.textContent = prefix + targetNum.toLocaleString() + suffix;
        }
      }
    });
  }

  // --- Status dot pulse (already handled in CSS, this just ensures class is present) ---
  function initStatusDots() {
    var dots = document.querySelectorAll('.rec-status-dot.running');
    // CSS handles the animation
  }

  // --- SVG line chart draw animation ---
  function initChartDraw() {
    var svgs = document.querySelectorAll('.rec-line-svg');
    if (!svgs.length) return;

    svgs.forEach(function (svg) {
      var drawn = false;

      if ('IntersectionObserver' in window) {
        var observer = new IntersectionObserver(function (entries) {
          if (entries[0].isIntersecting && !drawn) {
            drawn = true;
            svg.classList.add('animate');
            observer.disconnect();
          }
        }, { threshold: 0.3 });
        observer.observe(svg);
      } else {
        svg.classList.add('animate');
      }
    });
  }

  // --- FAQ Accordion ---
  function initFAQ() {
    var questions = document.querySelectorAll('.faq-question');
    if (!questions.length) return;

    questions.forEach(function (question) {
      question.addEventListener('click', function () {
        var item = this.parentElement;
        var isOpen = item.classList.contains('active');

        // Close all other items
        document.querySelectorAll('.faq-item.active').forEach(function (openItem) {
          if (openItem !== item) {
            openItem.classList.remove('active');
          }
        });

        // Toggle current
        item.classList.toggle('active');
      });
    });
  }

  // --- MCP terminal line-by-line reveal ---
  function initTerminalLineReveal() {
    var terminals = document.querySelectorAll('.rec-mcp-terminal');
    if (!terminals.length) return;

    terminals.forEach(function (terminal) {
      var lines = terminal.querySelectorAll('.rec-mcp-line');
      if (!lines.length) return;

      var revealed = false;

      function revealLines() {
        lines.forEach(function (line, index) {
          setTimeout(function () {
            line.classList.add('visible');
          }, index * 150);
        });
      }

      if ('IntersectionObserver' in window) {
        var observer = new IntersectionObserver(function (entries) {
          if (entries[0].isIntersecting && !revealed) {
            revealed = true;
            revealLines();
            observer.disconnect();
          }
        }, { threshold: 0.3 });
        observer.observe(terminal);
      } else {
        revealLines();
      }
    });
  }

  // --- Multi-step automation replay for Recreation 1 ---
  function initAutomationReplay() {
    var frame = document.querySelector('.rec-replay-frame');
    if (!frame) return;

    var steps = frame.querySelectorAll('.rec-step');
    var addressText = frame.querySelector('.rec-address-text');
    var messagesEl = frame.querySelector('.rec-replay-messages');
    var statusDot = frame.querySelector('.rec-replay-status-dot');
    var statusText = frame.querySelector('.rec-replay-status-text');
    var searchTextEl = frame.querySelector('.rec-ghome-search-text');
    var cursorEl = frame.querySelector('.rec-ghome-cursor');
    if (!steps.length || !addressText) return;

    var SEARCH_QUERY = 'latest AI tools 2025';
    var timeline = [
      // step 0: Google homepage, user message appears
      { page: 0, url: 'google.com', status: 'Automating', dot: 'running',
        overlay: null, msg: { type: 'user', text: 'Search for all relevant latest AI tools and download them' }, duration: 2000 },
      // step 1: typing in search box
      { page: 0, url: 'google.com', status: 'Automating', dot: 'running',
        overlay: { badge: 'Iter 1/8', text: 'Typing in search box...', pct: '8%' },
        msg: { type: 'status', text: 'Typing in search box...' }, typing: true, duration: 2500 },
      // step 2: search results appear
      { page: 1, url: 'google.com/search?q=latest+AI+tools+2025', status: 'Automating', dot: 'running',
        overlay: { badge: 'Iter 2/8', text: 'Analyzing search results...', pct: '22%' },
        msg: { type: 'status', text: 'Analyzing search results...' }, duration: 2500 },
      // step 3: glow on first result
      { page: 1, url: 'google.com/search?q=latest+AI+tools+2025', status: 'Automating', dot: 'running',
        overlay: { badge: 'Iter 3/8', text: 'Clicking first result...', pct: '42%' },
        msg: { type: 'status', text: 'Clicking first result...' }, highlight: '.rec-replay-result-1', duration: 2000 },
      // step 4: article page, glow on title
      { page: 2, url: 'ilampadmanabhan.medium.com/best-ai-tools...', status: 'Automating', dot: 'running',
        overlay: { badge: 'Iter 4/8', text: 'Reading page content...', pct: '78%' },
        msg: { type: 'status', text: 'Reading page content...' }, highlight: '.rec-replay-article-title', duration: 3000 },
      // step 5: done, AI response
      { page: 2, url: 'ilampadmanabhan.medium.com/best-ai-tools...', status: 'Complete', dot: '',
        overlay: null,
        msg: { type: 'ai', text: 'Found a comprehensive guide on Medium. Top AI tools for 2025: Claude (reasoning), Cursor (coding), Lovable.ai (no-code apps), Midjourney (images), ChatGPT (general), Gamma (presentations). The guide covers writing, marketing, productivity, and automation categories.' }, duration: 4000 }
    ];

    var currentStep = -1;
    var replayStarted = false;
    var typingTimer = null;

    function clearHighlights() {
      frame.querySelectorAll('.rec-element-highlight').forEach(function (el) {
        el.classList.remove('rec-element-highlight');
      });
    }

    function setOverlay(step) {
      var overlays = frame.querySelectorAll('.rec-replay-overlay');
      overlays.forEach(function (ov) {
        if (!step.overlay) {
          ov.style.display = 'none';
          ov.innerHTML = '';
          return;
        }
        ov.style.display = '';
        ov.innerHTML =
          '<div class="rec-overlay-header">' +
            '<img class="rec-overlay-logo" src="assets/icon48.png" alt="FSB">' +
            '<span class="rec-overlay-title">FSB Automating</span>' +
          '</div>' +
          '<div class="rec-overlay-task">Search for all relevant latest AI tools and download them</div>' +
          '<div class="rec-overlay-step">' +
            '<span class="rec-overlay-step-badge">' + step.overlay.badge + '</span>' +
            '<span class="rec-overlay-step-text">' + step.overlay.text + '</span>' +
          '</div>' +
          '<div class="rec-progress-track">' +
            '<div class="rec-progress-fill" style="width:' + step.overlay.pct + '"></div>' +
          '</div>';
      });
    }

    function addMessage(type, text) {
      var div = document.createElement('div');
      if (type === 'status') {
        div.className = 'rec-msg status';
        div.innerHTML =
          '<div class="rec-typing-dots"><span></span><span></span><span></span></div>' +
          '<span>' + text + '</span>';
      } else if (type === 'ai') {
        div.className = 'rec-msg ai';
        div.textContent = text;
      } else {
        div.className = 'rec-msg ' + type;
        div.textContent = text;
      }
      div.style.opacity = '0';
      div.style.transform = 'translateY(12px)';
      messagesEl.appendChild(div);
      // fade in
      requestAnimationFrame(function () {
        div.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
        div.style.opacity = '1';
        div.style.transform = 'translateY(0)';
      });
    }

    function removeLastStatus() {
      var last = messagesEl.querySelector('.rec-msg.status');
      if (last) last.remove();
    }

    function typeSearch(callback) {
      if (!searchTextEl) { callback(); return; }
      searchTextEl.textContent = '';
      if (cursorEl) cursorEl.style.display = '';
      var i = 0;
      function next() {
        if (i < SEARCH_QUERY.length) {
          searchTextEl.textContent += SEARCH_QUERY.charAt(i);
          i++;
          typingTimer = setTimeout(next, 60 + Math.random() * 40);
        } else {
          if (cursorEl) cursorEl.style.display = 'none';
          callback();
        }
      }
      next();
    }

    function runStep() {
      currentStep++;
      if (currentStep >= timeline.length) {
        // pause then restart
        setTimeout(resetAndReplay, 3000);
        return;
      }

      var step = timeline[currentStep];

      // switch page
      steps.forEach(function (s, i) {
        s.classList.toggle('active', i === step.page);
      });

      // address bar
      addressText.textContent = step.url;

      // status dot
      statusDot.className = 'fa-solid fa-circle rec-status-dot rec-replay-status-dot' + (step.dot ? ' ' + step.dot : '');
      statusText.textContent = step.status;

      // highlights
      clearHighlights();
      if (step.highlight) {
        var el = frame.querySelector(step.highlight);
        if (el) el.classList.add('rec-element-highlight');
      }

      // overlay
      setOverlay(step);

      // sidepanel message
      removeLastStatus();
      if (step.msg) {
        addMessage(step.msg.type, step.msg.text);
      }

      // typing animation for search box
      if (step.typing) {
        typeSearch(function () {
          setTimeout(runStep, 500);
        });
        return; // typing controls its own timing
      }

      setTimeout(runStep, step.duration);
    }

    function resetAndReplay() {
      currentStep = -1;
      messagesEl.innerHTML = '';
      if (searchTextEl) searchTextEl.textContent = '';
      if (cursorEl) cursorEl.style.display = '';
      clearHighlights();
      clearTimeout(typingTimer);
      steps.forEach(function (s, i) { s.classList.toggle('active', i === 0); });
      addressText.textContent = 'google.com';
      statusDot.className = 'fa-solid fa-circle rec-status-dot rec-replay-status-dot';
      statusText.textContent = 'Ready';
      frame.querySelectorAll('.rec-replay-overlay').forEach(function (ov) { ov.style.display = 'none'; ov.innerHTML = ''; });
      setTimeout(runStep, 1000);
    }

    // Start on scroll into view
    if ('IntersectionObserver' in window) {
      var observer = new IntersectionObserver(function (entries) {
        if (entries[0].isIntersecting && !replayStarted) {
          replayStarted = true;
          runStep();
          observer.disconnect();
        }
      }, { threshold: 0.2 });
      observer.observe(frame);
    } else {
      runStep();
    }
  }

  // --- Initialize all animations ---
  function init() {
    initTerminalTyping();
    initMessageCascade();
    initProgressBars();
    initChartBars();
    initChartDraw();
    initTerminalLineReveal();
    initCounters();
    initStatusDots();
    initFAQ();
    initAutomationReplay();
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
