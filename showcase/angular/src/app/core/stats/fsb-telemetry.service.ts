// Phase 274 / AGG-01..09 + STATS-03 -- FSB public-stats client service.
//
// Mirror of github-stats.service.ts at every structural axis (PLATFORM_ID
// guard, BehaviorSubject<DatasetState<T>> streams, idempotent start()/stop(),
// 5-min visibility-aware polling, in-memory ETag cache, SSR no-op posture)
// but pointed at our own /api/public-stats endpoint instead of GitHub.
//
// Why a mirror rather than a shared base class:
//   - github-stats.service has 8 endpoints + 8 aggregator helpers; ours has
//     2 endpoints + 0 helpers (server returns ready-to-render shapes). A
//     shared base would generalise over a single useful axis (the polling
//     state machine) and force the github service to grow null-handling
//     branches it currently doesn't have. The mirror is cheaper.
//
// Key delta vs. github-stats.service:
//   - The 403 + X-RateLimit-Remaining=0 branch is REMOVED. Our endpoint is
//     server-cached (30 s memo + Cache-Control: max-age=60), not rate-limited.
//     If the server is ever overloaded it returns 500, which lands as
//     { kind: 'error' } on the subjects -- the page renders a generic
//     retry card and the next 5-min cycle tries again.
//   - Accept header is 'application/json' (no GitHub vendor type).
//   - `credentials: 'omit'` to belt-and-suspenders against the CORS layer
//     ever attaching a cookie -- the server-side test verifies no Set-Cookie
//     ever leaves the server, but the client also opts out.
//
// SSR safety: every fetch + every `document` reference is gated by
// `isPlatformBrowser(PLATFORM_ID)`. On the Node SSR pass, start() returns
// without touching anything and both subjects stay at { kind: 'loading' }.
// The stats-page component bootstraps start() inside `afterNextRender`, so
// this gate is belt-and-suspenders.

import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject } from 'rxjs';

import {
  DatasetState,
  FSBTelemetryHeadline,
  FSBTelemetrySeries,
} from './fsb-telemetry.types';

const API_ROOT = '/api/public-stats';
const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

interface EtagCacheEntry {
  etag: string;
  body: unknown;
  fetchedAt: number;
}

@Injectable({ providedIn: 'root' })
export class FSBTelemetryService {
  private readonly platformId = inject(PLATFORM_ID);

  /** ETag store keyed by full request URL. */
  private readonly etagCache = new Map<string, EtagCacheEntry>();

  /** Active polling timer handle; null when polling is paused or stopped. */
  private pollHandle: ReturnType<typeof setInterval> | null = null;

  /** Bound visibilitychange listener so we can remove it cleanly in stop(). */
  private visibilityListener: (() => void) | null = null;

  /** Whether start() has been called and resources are wired. */
  private started = false;

  // Per-dataset state streams. Both start at { kind: 'loading' } and stay
  // there until the first browser-side fetch resolves. On the SSR pass we
  // never advance them.
  readonly headline$ = new BehaviorSubject<DatasetState<FSBTelemetryHeadline>>({ kind: 'loading' });
  readonly series$   = new BehaviorSubject<DatasetState<FSBTelemetrySeries>>({ kind: 'loading' });

  /**
   * Idempotent boot. Called by the page component inside `afterNextRender`.
   * No-op on the server and on duplicate calls. Sets up visibility-aware
   * 5-minute polling and fires an immediate refresh.
   */
  start(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    if (this.started) return;
    this.started = true;

    // Immediate first refresh -- do not block on it.
    void this.refreshAll();

    this.pollHandle = setInterval(() => {
      void this.refreshAll();
    }, POLL_INTERVAL_MS);

    this.visibilityListener = () => {
      if (typeof document === 'undefined') return;
      if (document.hidden) {
        // Tab backgrounded -- stop the interval. Resume on focus.
        if (this.pollHandle !== null) {
          clearInterval(this.pollHandle);
          this.pollHandle = null;
        }
      } else {
        // Tab refocused -- if we have no active interval, fire an immediate
        // refresh and restart the schedule.
        if (this.pollHandle === null && this.started) {
          void this.refreshAll();
          this.pollHandle = setInterval(() => {
            void this.refreshAll();
          }, POLL_INTERVAL_MS);
        }
      }
    };
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.visibilityListener);
    }
  }

  /**
   * Tear down all timers + listeners. Called from the page's ngOnDestroy.
   * Safe to call multiple times.
   */
  stop(): void {
    if (this.pollHandle !== null) {
      clearInterval(this.pollHandle);
      this.pollHandle = null;
    }
    if (this.visibilityListener !== null && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.visibilityListener);
    }
    this.visibilityListener = null;
    this.started = false;
  }

  /**
   * Kick off both dataset fetches in parallel. Each updates its own subject.
   * Uses Promise.allSettled so one endpoint failing does NOT cascade.
   */
  async refreshAll(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;

    await Promise.allSettled([
      this.fetchHeadline(),
      this.fetchSeries(),
    ]);
  }

  private async fetchHeadline(): Promise<void> {
    const url = `${API_ROOT}/global`;
    try {
      const data = await this.fetchJson<FSBTelemetryHeadline>(url);
      if (data === null) return; // SSR no-op short-circuit.
      this.headline$.next({ kind: 'ready', data, fetchedAt: Date.now() });
    } catch (err) {
      this.headline$.next({ kind: 'error', message: humanError(err) });
    }
  }

  private async fetchSeries(): Promise<void> {
    const url = `${API_ROOT}/global/series`;
    try {
      const data = await this.fetchJson<FSBTelemetrySeries>(url);
      if (data === null) return;
      this.series$.next({ kind: 'ready', data, fetchedAt: Date.now() });
    } catch (err) {
      this.series$.next({ kind: 'error', message: humanError(err) });
    }
  }

  /**
   * Fetch a single JSON resource with ETag support.
   *
   * Returns:
   *  - the parsed body on 200 or 304 (cache hit),
   *  - null on the SSR pass (browser guard).
   * Throws on any non-OK status (handled by callers -> { kind: 'error' }).
   *
   * No rate-limit branch -- the server endpoint is server-cached, not
   * rate-limited. If a 500 ever fires, the caller surfaces it as an error
   * state and the next poll retries.
   */
  private async fetchJson<T>(url: string): Promise<T | null> {
    if (!isPlatformBrowser(this.platformId)) return null;

    const headers: Record<string, string> = {
      Accept: 'application/json',
    };
    const cached = this.etagCache.get(url);
    if (cached) {
      headers['If-None-Match'] = cached.etag;
    }

    const response = await fetch(url, { headers, credentials: 'omit' });

    if (response.status === 304 && cached) {
      // ETag match: reuse cached body, don't read response.
      return cached.body as T;
    }

    if (!response.ok) {
      throw new Error(`FSB stats ${response.status} on ${url}`);
    }

    const parsed = (await response.json()) as T;
    const etag = response.headers.get('etag');
    if (etag) {
      this.etagCache.set(url, { etag, body: parsed, fetchedAt: Date.now() });
    }
    return parsed;
  }
}

function humanError(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}
