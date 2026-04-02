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

  // --- Initialize all animations ---
  function init() {
    initTerminalTyping();
    initMessageCascade();
    initProgressBars();
    initChartBars();
    initChartDraw();
    initCounters();
    initStatusDots();
    initFAQ();
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
