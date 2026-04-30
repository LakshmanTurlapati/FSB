import { AfterViewInit, Component, ElementRef, NgZone, OnDestroy, OnInit, Renderer2, inject } from '@angular/core';
import { Title, Meta } from '@angular/platform-browser';
import { DOCUMENT } from '@angular/common';

const HOST = 'https://full-selfbrowsing.com';
const OG_IMAGE = `${HOST}/assets/fsb_logo_dark.png`;
const SITE_NAME = 'FSB \u2014 Full Self-Browsing';

type ReplayMessageType = 'user' | 'status' | 'ai';

interface ReplayOverlay {
  badge: string;
  text: string;
  pct: string;
}

interface ReplayMessage {
  type: ReplayMessageType;
  text: string;
}

interface ReplayTimelineStep {
  page: number;
  url: string;
  status: string;
  dot: string;
  overlay: ReplayOverlay | null;
  msg: ReplayMessage | null;
  duration: number;
  typing?: boolean;
  highlight?: string;
}

@Component({
  selector: 'app-about-page',
  standalone: true,
  templateUrl: './about-page.component.html',
  styleUrl: './about-page.component.scss',
})
export class AboutPageComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly zone = inject(NgZone);
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly renderer = inject(Renderer2);
  private readonly doc = inject(DOCUMENT);

  private readonly timeouts = new Set<number>();
  private readonly observers = new Set<IntersectionObserver>();
  private destroyed = false;

  ngOnInit(): void {
    const url = `${HOST}/about`;
    const t = 'FSB \u2014 About';
    const d = 'Watch FSB drive Google, search Amazon, and book travel autonomously. See the open-source AI browser agent in action \u2014 your browser, your keys, your data.';
    this.applyMeta(t, d, url);
  }

  private applyMeta(t: string, d: string, url: string): void {
    this.title.setTitle(t);
    this.meta.updateTag({ name: 'description', content: d });
    this.meta.updateTag({ property: 'og:title', content: t });
    this.meta.updateTag({ property: 'og:description', content: d });
    this.meta.updateTag({ property: 'og:url', content: url });
    this.meta.updateTag({ property: 'og:type', content: 'website' });
    this.meta.updateTag({ property: 'og:image', content: OG_IMAGE });
    this.meta.updateTag({ property: 'og:site_name', content: SITE_NAME });
    this.meta.updateTag({ name: 'twitter:card', content: 'summary' });
    this.meta.updateTag({ name: 'twitter:title', content: t });
    this.meta.updateTag({ name: 'twitter:description', content: d });
    this.meta.updateTag({ name: 'twitter:image', content: OG_IMAGE });
    this.upsertCanonical(url);
  }

  private upsertCanonical(href: string): void {
    let link = this.doc.head.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!link) {
      link = this.renderer.createElement('link') as HTMLLinkElement;
      this.renderer.setAttribute(link, 'rel', 'canonical');
      this.renderer.appendChild(this.doc.head, link);
    }
    this.renderer.setAttribute(link, 'href', href);
  }

  ngAfterViewInit(): void {
    this.zone.runOutsideAngular(() => {
      this.initCounters();
      this.initChartDraw();
      this.initAutomationReplay();
      this.initAmazonReplay();
    });
  }

  ngOnDestroy(): void {
    this.destroyed = true;

    for (const timeoutId of this.timeouts) {
      window.clearTimeout(timeoutId);
    }
    this.timeouts.clear();

    for (const observer of this.observers) {
      observer.disconnect();
    }
    this.observers.clear();
  }

  private initCounters(): void {
    const counters = this.queryAll<HTMLElement>('.rec-metric-value[data-count]');
    if (!counters.length) {
      return;
    }

    for (const counter of counters) {
      const targetRaw = counter.dataset['count'];
      if (!targetRaw) {
        continue;
      }

      const target = Number.parseFloat(targetRaw);
      if (Number.isNaN(target)) {
        continue;
      }

      const prefix = counter.dataset['prefix'] ?? '';
      const suffix = counter.dataset['suffix'] ?? '';
      const isFloat = targetRaw.includes('.');
      let started = false;

      const renderValue = (value: number): string => {
        if (isFloat) {
          return `${prefix}${value.toFixed(2)}${suffix}`;
        }
        return `${prefix}${Math.round(value).toLocaleString()}${suffix}`;
      };

      const start = (): void => {
        if (started || this.destroyed) {
          return;
        }
        started = true;

        const durationMs = 1500;
        const startedAt = performance.now();

        const tick = (now: number): void => {
          if (this.destroyed) {
            return;
          }

          const elapsed = now - startedAt;
          const progress = Math.min(elapsed / durationMs, 1);
          const eased = 1 - Math.pow(1 - progress, 3);
          const current = eased * target;
          counter.textContent = renderValue(current);

          if (progress < 1) {
            requestAnimationFrame(tick);
          }
        };

        requestAnimationFrame(tick);
      };

      this.observeOnce(counter, { threshold: 0.5 }, start);
    }
  }

  private initChartDraw(): void {
    const charts = this.queryAll<SVGElement>('.rec-line-svg');
    for (const chart of charts) {
      let drawn = false;
      this.observeOnce(
        chart,
        { threshold: 0.3 },
        () => {
          if (drawn || this.destroyed) {
            return;
          }
          drawn = true;
          chart.classList.add('animate');
        },
      );
    }
  }

  private initAutomationReplay(): void {
    const frame = this.query<HTMLElement>('.rec-replay-frame');
    if (!frame) {
      return;
    }

    const steps = this.queryAll<HTMLElement>('.rec-step', frame);
    const addressText = this.query<HTMLElement>('.rec-address-text', frame);
    const messages = this.query<HTMLElement>('.rec-replay-messages', frame);
    const statusDot = this.query<HTMLElement>('.rec-replay-status-dot', frame);
    const statusText = this.query<HTMLElement>('.rec-replay-status-text', frame);
    const searchText = this.query<HTMLElement>('.rec-ghome-search-text', frame);
    const cursor = this.query<HTMLElement>('.rec-ghome-cursor', frame);

    if (!steps.length || !addressText || !messages || !statusDot || !statusText) {
      return;
    }

    const searchQuery = 'latest AI tools 2025';
    const timeline: ReplayTimelineStep[] = [
      {
        page: 0,
        url: 'google.com',
        status: 'Automating',
        dot: 'running',
        overlay: null,
        msg: { type: 'user', text: 'Search for all relevant latest AI tools and download them' },
        duration: 2000,
      },
      {
        page: 0,
        url: 'google.com',
        status: 'Automating',
        dot: 'running',
        overlay: { badge: 'Iter 1/8', text: 'Typing in search box...', pct: '8%' },
        msg: { type: 'status', text: 'Typing in search box...' },
        typing: true,
        duration: 2500,
      },
      {
        page: 1,
        url: 'google.com/search?q=latest+AI+tools+2025',
        status: 'Automating',
        dot: 'running',
        overlay: { badge: 'Iter 2/8', text: 'Analyzing search results...', pct: '22%' },
        msg: { type: 'status', text: 'Analyzing search results...' },
        duration: 2500,
      },
      {
        page: 1,
        url: 'google.com/search?q=latest+AI+tools+2025',
        status: 'Automating',
        dot: 'running',
        overlay: { badge: 'Iter 3/8', text: 'Clicking first result...', pct: '42%' },
        msg: { type: 'status', text: 'Clicking first result...' },
        highlight: '.rec-replay-result-1',
        duration: 2000,
      },
      {
        page: 2,
        url: 'ilampadmanabhan.medium.com/best-ai-tools...',
        status: 'Automating',
        dot: 'running',
        overlay: { badge: 'Iter 4/8', text: 'Reading page content...', pct: '78%' },
        msg: { type: 'status', text: 'Reading page content...' },
        highlight: '.rec-replay-article-title',
        duration: 3000,
      },
      {
        page: 2,
        url: 'ilampadmanabhan.medium.com/best-ai-tools...',
        status: 'Complete',
        dot: '',
        overlay: null,
        msg: {
          type: 'ai',
          text: 'Found a comprehensive guide on Medium. Top AI tools for 2025: Claude (reasoning), Cursor (coding), Lovable.ai (no-code apps), Midjourney (images), ChatGPT (general), Gamma (presentations). The guide covers writing, marketing, productivity, and automation categories.',
        },
        duration: 4000,
      },
    ];

    this.runReplay({
      frame,
      steps,
      addressText,
      messages,
      statusDot,
      statusText,
      searchText,
      cursor,
      overlays: this.queryAll<HTMLElement>('.rec-replay-overlay', frame),
      overlayTask: 'Search for all relevant latest AI tools and download them',
      overlayDotClassBase: 'fa-solid fa-circle rec-status-dot rec-replay-status-dot',
      readyUrl: 'google.com',
      readyStatus: 'Ready',
      searchQuery,
      timeline,
      restartDelayMs: 3000,
    });
  }

  private initAmazonReplay(): void {
    const frame = this.query<HTMLElement>('.rec-amazon-replay-frame');
    if (!frame) {
      return;
    }

    const steps = this.queryAll<HTMLElement>('.rec-step', frame);
    const addressText = this.query<HTMLElement>('.rec-amz-address-text', frame);
    const messages = this.query<HTMLElement>('.rec-amz-replay-messages', frame);
    const statusDot = this.query<HTMLElement>('.rec-amz-replay-status-dot', frame);
    const statusText = this.query<HTMLElement>('.rec-amz-replay-status-text', frame);
    const searchText = this.query<HTMLElement>('.rec-amz-home .rec-amz-search-text', frame);
    const cursor = this.query<HTMLElement>('.rec-amz-cursor', frame);

    if (!steps.length || !addressText || !messages || !statusDot || !statusText) {
      return;
    }

    const searchQuery = 'PlayStation 5 console';
    const timeline: ReplayTimelineStep[] = [
      {
        page: 0,
        url: 'amazon.com',
        status: 'Automating',
        dot: 'running',
        overlay: null,
        msg: { type: 'user', text: 'Buy a PlayStation 5 from Amazon' },
        duration: 2000,
      },
      {
        page: 0,
        url: 'amazon.com',
        status: 'Automating',
        dot: 'running',
        overlay: { badge: 'Iter 1/10', text: 'Typing in search box...', pct: '6%' },
        msg: { type: 'status', text: 'Typing in search box...' },
        typing: true,
        duration: 2500,
      },
      {
        page: 1,
        url: 'amazon.com/s?k=PlayStation+5+console',
        status: 'Automating',
        dot: 'running',
        overlay: { badge: 'Iter 2/10', text: 'Analyzing search results...', pct: '18%' },
        msg: { type: 'status', text: 'Analyzing search results...' },
        duration: 2500,
      },
      {
        page: 1,
        url: 'amazon.com/s?k=PlayStation+5+console',
        status: 'Automating',
        dot: 'running',
        overlay: { badge: 'Iter 3/10', text: 'Clicking PlayStation 5 console...', pct: '32%' },
        msg: { type: 'status', text: 'Clicking PlayStation 5 console...' },
        highlight: '.rec-amz-replay-result-1',
        duration: 2000,
      },
      {
        page: 2,
        url: 'amazon.com/PlayStation-5-console-1TB/dp/B0FRGTYSL5',
        status: 'Automating',
        dot: 'running',
        overlay: { badge: 'Iter 5/10', text: 'Reading product details...', pct: '55%' },
        msg: { type: 'status', text: 'Reading product details...' },
        highlight: '.rec-amz-replay-pdp-title',
        duration: 2500,
      },
      {
        page: 2,
        url: 'amazon.com/PlayStation-5-console-1TB/dp/B0FRGTYSL5',
        status: 'Automating',
        dot: 'running',
        overlay: { badge: 'Iter 6/10', text: 'Clicking Add to Cart...', pct: '72%' },
        msg: { type: 'status', text: 'Clicking Add to Cart...' },
        highlight: '.rec-amz-replay-atc',
        duration: 2000,
      },
      {
        page: 2,
        url: 'amazon.com/PlayStation-5-console-1TB/dp/B0FRGTYSL5',
        status: 'Complete',
        dot: '',
        overlay: null,
        msg: {
          type: 'ai',
          text: 'Done! Added PlayStation 5 console (1TB) to your cart for $549.00. FREE delivery Tuesday, April 7. The item is in stock and shipped by Amazon.',
        },
        duration: 4000,
      },
    ];

    this.runReplay({
      frame,
      steps,
      addressText,
      messages,
      statusDot,
      statusText,
      searchText,
      cursor,
      overlays: this.queryAll<HTMLElement>('.rec-amz-replay-overlay', frame),
      overlayTask: 'Buy a PlayStation 5 from Amazon',
      overlayDotClassBase: 'fa-solid fa-circle rec-status-dot rec-amz-replay-status-dot',
      readyUrl: 'amazon.com',
      readyStatus: 'Ready',
      searchQuery,
      timeline,
      restartDelayMs: 3000,
    });
  }

  private runReplay(config: {
    frame: HTMLElement;
    steps: HTMLElement[];
    addressText: HTMLElement;
    messages: HTMLElement;
    statusDot: HTMLElement;
    statusText: HTMLElement;
    overlays: HTMLElement[];
    overlayTask: string;
    overlayDotClassBase: string;
    readyUrl: string;
    readyStatus: string;
    searchQuery: string;
    timeline: ReplayTimelineStep[];
    restartDelayMs: number;
    searchText: HTMLElement | null;
    cursor: HTMLElement | null;
  }): void {
    let currentStep = -1;
    let replayStarted = false;
    let activeTimer: number | null = null;
    let typingTimer: number | null = null;

    const clearTimer = (timerId: number | null): null => {
      if (timerId !== null) {
        window.clearTimeout(timerId);
        this.timeouts.delete(timerId);
      }
      return null;
    };

    const setTimer = (kind: 'active' | 'typing', callback: () => void, delayMs: number): void => {
      const timerId = window.setTimeout(() => {
        this.timeouts.delete(timerId);
        if (this.destroyed) {
          return;
        }
        if (kind === 'active') {
          activeTimer = null;
        } else {
          typingTimer = null;
        }
        callback();
      }, delayMs);

      this.timeouts.add(timerId);

      if (kind === 'active') {
        activeTimer = timerId;
      } else {
        typingTimer = timerId;
      }
    };

    const clearHighlights = (): void => {
      for (const highlighted of this.queryAll<HTMLElement>('.rec-element-highlight', config.frame)) {
        highlighted.classList.remove('rec-element-highlight');
      }
    };

    const setOverlay = (step: ReplayTimelineStep): void => {
      for (const overlay of config.overlays) {
        if (!step.overlay) {
          overlay.style.display = 'none';
          overlay.innerHTML = '';
          continue;
        }
        overlay.style.display = '';
        overlay.innerHTML =
          `<div class="rec-overlay-header">
            <img class="rec-overlay-logo" src="/assets/icon48.png" alt="FSB">
            <span class="rec-overlay-title">FSB Automating</span>
          </div>
          <div class="rec-overlay-task">${config.overlayTask}</div>
          <div class="rec-overlay-step">
            <span class="rec-overlay-step-badge">${step.overlay.badge}</span>
            <span class="rec-overlay-step-text">${step.overlay.text}</span>
          </div>
          <div class="rec-progress-track">
            <div class="rec-progress-fill" style="width:${step.overlay.pct}"></div>
          </div>`;
      }
    };

    const addMessage = (type: ReplayMessageType, text: string): void => {
      const message = document.createElement('div');

      if (type === 'status') {
        message.className = 'rec-msg status';
        message.innerHTML =
          '<div class="rec-typing-dots"><span></span><span></span><span></span></div>' +
          `<span>${text}</span>`;
      } else {
        message.className = `rec-msg ${type}`;
        message.textContent = text;
      }

      message.style.opacity = '0';
      message.style.transform = 'translateY(12px)';
      config.messages.appendChild(message);

      requestAnimationFrame(() => {
        message.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
        message.style.opacity = '1';
        message.style.transform = 'translateY(0)';
      });
    };

    const removeLastStatus = (): void => {
      const statuses = this.queryAll<HTMLElement>('.rec-msg.status', config.messages);
      const last = statuses.at(-1);
      if (last) {
        last.remove();
      }
    };

    const typeSearch = (done: () => void): void => {
      if (!config.searchText) {
        done();
        return;
      }

      config.searchText.textContent = '';
      if (config.cursor) {
        config.cursor.style.display = '';
      }

      let index = 0;
      const typeNext = (): void => {
        if (this.destroyed) {
          return;
        }
        if (index < config.searchQuery.length) {
          config.searchText!.textContent += config.searchQuery.charAt(index);
          index += 1;
          setTimer('typing', typeNext, 55 + Math.round(Math.random() * 40));
        } else {
          if (config.cursor) {
            config.cursor.style.display = 'none';
          }
          done();
        }
      };

      typeNext();
    };

    const resetAndReplay = (): void => {
      activeTimer = clearTimer(activeTimer);
      typingTimer = clearTimer(typingTimer);

      currentStep = -1;
      config.messages.innerHTML = '';

      if (config.searchText) {
        config.searchText.textContent = '';
      }
      if (config.cursor) {
        config.cursor.style.display = '';
      }

      clearHighlights();

      config.steps.forEach((stepEl, index) => {
        stepEl.classList.toggle('active', index === 0);
      });

      config.addressText.textContent = config.readyUrl;
      config.statusDot.className = config.overlayDotClassBase;
      config.statusText.textContent = config.readyStatus;

      for (const overlay of config.overlays) {
        overlay.style.display = 'none';
        overlay.innerHTML = '';
      }

      setTimer('active', runStep, 1000);
    };

    const runStep = (): void => {
      currentStep += 1;

      if (currentStep >= config.timeline.length) {
        setTimer('active', resetAndReplay, config.restartDelayMs);
        return;
      }

      const step = config.timeline[currentStep];
      config.steps.forEach((stepEl, index) => {
        stepEl.classList.toggle('active', index === step.page);
      });

      config.addressText.textContent = step.url;
      config.statusDot.className = `${config.overlayDotClassBase}${step.dot ? ` ${step.dot}` : ''}`;
      config.statusText.textContent = step.status;

      clearHighlights();
      if (step.highlight) {
        const highlighted = this.query<HTMLElement>(step.highlight, config.frame);
        if (highlighted) {
          highlighted.classList.add('rec-element-highlight');
        }
      }

      setOverlay(step);

      removeLastStatus();
      if (step.msg) {
        addMessage(step.msg.type, step.msg.text);
      }

      if (step.typing) {
        typeSearch(() => {
          setTimer('active', runStep, 500);
        });
        return;
      }

      setTimer('active', runStep, step.duration);
    };

    this.observeOnce(config.frame, { threshold: 0.2 }, () => {
      if (replayStarted) {
        return;
      }
      replayStarted = true;
      runStep();
    });
  }

  private query<T extends Element>(selector: string, root: ParentNode = this.host.nativeElement): T | null {
    return root.querySelector<T>(selector);
  }

  private queryAll<T extends Element>(selector: string, root: ParentNode = this.host.nativeElement): T[] {
    return Array.from(root.querySelectorAll<T>(selector));
  }

  private observeOnce(target: Element, options: IntersectionObserverInit, onVisible: () => void): void {
    if (this.destroyed) {
      return;
    }

    if (!('IntersectionObserver' in window)) {
      onVisible();
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      const isVisible = entries.some((entry) => entry.isIntersecting);
      if (!isVisible) {
        return;
      }
      observer.disconnect();
      this.observers.delete(observer);
      if (!this.destroyed) {
        onVisible();
      }
    }, options);

    this.observers.add(observer);
    observer.observe(target);
  }
}
