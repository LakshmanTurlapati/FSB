// GitHub stats service for the /stats Easter-egg page (quick task 260514-1nv).
//
// Design notes (mirror these in any future tweaks):
//
//  * Unauthenticated GitHub REST: the rate limit is 60 requests / hour / IP
//    (https://docs.github.com/en/rest/overview/resources-in-the-rest-api).
//    We hard-cap pagination at MAX_PAGES = 30 (bumped from 2 in quick task
//    260514-wdy so the all-time cumulative-commits chart covers the repo's
//    full history). Other endpoints early-exit at page 1 because they sit
//    under PER_PAGE = 100 (stars/forks/issues/pulls/releases), so the per-
//    cycle budget is `1 (summary) + 5 (early-exit endpoints) + up to 30
//    (commits)` = ~36 worst-case. ETag 304s short-circuit steady-state
//    polling (counted as 0 toward the limit per GitHub docs), so a quiet
//    repo costs effectively 0 requests/cycle after the cold start.
//
//  * Polling: every POLL_INTERVAL_MS = 5 min, but only while the document is
//    visible. We pause via `visibilitychange` (clear the interval, skip the
//    refresh) and resume with an immediate refresh + new interval when the
//    tab comes back. ngOnDestroy from the page component calls stop() to
//    guarantee no leak across route changes.
//
//  * SSR safety: every fetch and every `document` reference is gated by
//    `isPlatformBrowser(PLATFORM_ID)`. On the Node SSR pass start() is a
//    no-op and every BehaviorSubject stays at { kind: 'loading' }. The page
//    component bootstraps start() inside `afterNextRender` which never runs
//    on the server, so this gate is belt-and-suspenders.
//
//  * ETag cache: every endpoint is keyed by full URL (path + page) and gets
//    an If-None-Match header on subsequent fetches. A 304 short-circuit
//    returns the cached body without re-parsing. Saves both bytes and
//    rate-limit budget (304 still costs 0 toward the rate limit per GitHub
//    docs, but the cache also lets us skip the JSON parse + aggregator work).
//
//  * Rate-limit handling: HTTP 403 + X-RateLimit-Remaining=0 emits a
//    `rate-limited` state on all subjects with `resetAt = Reset * 1000` and
//    aborts the rest of refreshAll() for that cycle. No throw, no retry
//    loop -- the next 5-min cycle will retry once budget refills.
//
//  * Maintenance signal: releases-per-month over last 12 months from
//    /releases. If the repo has no releases (empty array), we fall back to
//    commits-per-week over last 12 weeks from /commits (already fetched
//    elsewhere). This keeps the dashboard meaningful for very young repos
//    while preferring the cleaner releases signal when available.

import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject } from 'rxjs';

import {
  CommitEvent,
  DatasetState,
  ForkEvent,
  IssueEvent,
  PullEvent,
  ReleaseEvent,
  RepoSummary,
  StarEvent,
  TimeSeriesPoint,
  WeeklyDelta,
} from './github-stats.types';

const OWNER = 'LakshmanTurlapati';
const REPO = 'FSB';
const API_BASE = 'https://api.github.com';
// MAX_PAGES = 30 covers ~3000 commits with ~30% headroom over the repo's
// current 23-page /commits history -- needed by the all-time cumulative-commits
// view (quick task 260514-wdy). Other endpoints are NOT affected because
// `fetchPaginated` early-exits when `body.length < PER_PAGE` (see ~line 279):
// stars (66), forks (4), issues (50), pulls (47), releases (17) all sit well
// under PER_PAGE = 100 and exit at page 1, so they still cost 1 request/cycle.
// The per-URL ETag cache returns 304 on steady-state polling (counted as 0
// toward the unauth 60-req/hr limit per GitHub docs) so the rate-limit
// budget stays preserved. If the repo grows past 3000 commits the cumulative
// chart truncates to the most-recent 3000 -- graceful degradation, not a crash.
const MAX_PAGES = 30;
const PER_PAGE = 100;
const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

interface EtagCacheEntry {
  etag: string;
  body: unknown;
  fetchedAt: number;
}

@Injectable({ providedIn: 'root' })
export class GitHubStatsService {
  private readonly platformId = inject(PLATFORM_ID);

  /** ETag store keyed by full request URL (path + ?page=N). */
  private readonly etagCache = new Map<string, EtagCacheEntry>();

  /** Active polling timer handle; null when polling is paused or stopped. */
  private pollHandle: ReturnType<typeof setInterval> | null = null;

  /** Bound visibilitychange listener so we can remove it cleanly in stop(). */
  private visibilityListener: (() => void) | null = null;

  /** Whether start() has been called and resources are wired. */
  private started = false;

  // --- Per-dataset state streams. All start at { kind: 'loading' } on both
  // server and browser cold start. SSR never advances them. ---
  readonly repoSummary$ = new BehaviorSubject<DatasetState<RepoSummary>>({ kind: 'loading' });
  readonly stars$ = new BehaviorSubject<DatasetState<StarEvent[]>>({ kind: 'loading' });
  readonly weeklyStars$ = new BehaviorSubject<DatasetState<WeeklyDelta[]>>({ kind: 'loading' });
  readonly issues$ = new BehaviorSubject<DatasetState<IssueEvent[]>>({ kind: 'loading' });
  readonly forks$ = new BehaviorSubject<DatasetState<ForkEvent[]>>({ kind: 'loading' });
  readonly prs$ = new BehaviorSubject<DatasetState<PullEvent[]>>({ kind: 'loading' });
  readonly commits$ = new BehaviorSubject<DatasetState<CommitEvent[]>>({ kind: 'loading' });
  readonly releases$ = new BehaviorSubject<DatasetState<ReleaseEvent[]>>({ kind: 'loading' });

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
   * Kick off all 7 dataset fetches in parallel. Each updates its own subject.
   * Uses Promise.allSettled so one endpoint failing does NOT cascade.
   */
  async refreshAll(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;

    const tasks: Array<Promise<unknown>> = [
      this.fetchRepoSummary(),
      this.fetchStars(),
      this.fetchIssues(),
      this.fetchForks(),
      this.fetchPulls(),
      this.fetchCommits(),
      this.fetchReleases(),
    ];

    await Promise.allSettled(tasks);
  }

  // --- Endpoint fetches. Each updates its own subject; errors stay scoped. ---

  private async fetchRepoSummary(): Promise<void> {
    const url = `${API_BASE}/repos/${OWNER}/${REPO}`;
    try {
      const data = await this.fetchJson<RepoSummary>(url);
      if (data === null) return; // rate-limited or skipped; subject already updated.
      this.repoSummary$.next({ kind: 'ready', data, fetchedAt: Date.now() });
    } catch (err) {
      this.repoSummary$.next({ kind: 'error', message: humanError(err) });
    }
  }

  private async fetchStars(): Promise<void> {
    const path = `/repos/${OWNER}/${REPO}/stargazers`;
    try {
      const stars = await this.fetchPaginated<StarEvent>(path, 'application/vnd.github.v3.star+json');
      if (stars === null) return;
      this.stars$.next({ kind: 'ready', data: stars, fetchedAt: Date.now() });
      // Pre-compute weekly delta from the same dataset.
      this.weeklyStars$.next({ kind: 'ready', data: weeklyStarsDelta(stars), fetchedAt: Date.now() });
    } catch (err) {
      const msg = humanError(err);
      this.stars$.next({ kind: 'error', message: msg });
      this.weeklyStars$.next({ kind: 'error', message: msg });
    }
  }

  private async fetchIssues(): Promise<void> {
    const path = `/repos/${OWNER}/${REPO}/issues?state=all`;
    try {
      const issues = await this.fetchPaginated<IssueEvent>(path);
      if (issues === null) return;
      this.issues$.next({ kind: 'ready', data: issues, fetchedAt: Date.now() });
    } catch (err) {
      this.issues$.next({ kind: 'error', message: humanError(err) });
    }
  }

  private async fetchForks(): Promise<void> {
    const path = `/repos/${OWNER}/${REPO}/forks?sort=oldest`;
    try {
      const forks = await this.fetchPaginated<ForkEvent>(path);
      if (forks === null) return;
      this.forks$.next({ kind: 'ready', data: forks, fetchedAt: Date.now() });
    } catch (err) {
      this.forks$.next({ kind: 'error', message: humanError(err) });
    }
  }

  private async fetchPulls(): Promise<void> {
    const path = `/repos/${OWNER}/${REPO}/pulls?state=all`;
    try {
      const pulls = await this.fetchPaginated<PullEvent>(path);
      if (pulls === null) return;
      this.prs$.next({ kind: 'ready', data: pulls, fetchedAt: Date.now() });
    } catch (err) {
      this.prs$.next({ kind: 'error', message: humanError(err) });
    }
  }

  private async fetchCommits(): Promise<void> {
    const path = `/repos/${OWNER}/${REPO}/commits`;
    try {
      const commits = await this.fetchPaginated<CommitEvent>(path);
      if (commits === null) return;
      this.commits$.next({ kind: 'ready', data: commits, fetchedAt: Date.now() });
    } catch (err) {
      this.commits$.next({ kind: 'error', message: humanError(err) });
    }
  }

  private async fetchReleases(): Promise<void> {
    const path = `/repos/${OWNER}/${REPO}/releases`;
    try {
      const releases = await this.fetchPaginated<ReleaseEvent>(path);
      if (releases === null) return;
      this.releases$.next({ kind: 'ready', data: releases, fetchedAt: Date.now() });
    } catch (err) {
      this.releases$.next({ kind: 'error', message: humanError(err) });
    }
  }

  // --- Low-level paginated fetch + ETag cache. ---

  /**
   * Paginated fetch with hard cap (MAX_PAGES). Stops early when the response
   * array is shorter than PER_PAGE. Returns null if the cycle was aborted
   * due to a rate-limit hit (subjects already updated).
   */
  private async fetchPaginated<T>(path: string, accept?: string): Promise<T[] | null> {
    const collected: T[] = [];
    const sep = path.includes('?') ? '&' : '?';
    for (let page = 1; page <= MAX_PAGES; page++) {
      const url = `${API_BASE}${path}${sep}page=${page}&per_page=${PER_PAGE}`;
      const body = await this.fetchJson<T[]>(url, accept);
      if (body === null) return null; // rate-limited; halt this cycle.
      if (!Array.isArray(body)) {
        // Defensive: GitHub should always return an array here. Skip.
        console.warn(`[github-stats] expected array from ${url}, got`, typeof body);
        break;
      }
      collected.push(...body);
      if (body.length < PER_PAGE) break; // last page reached.
    }
    return collected;
  }

  /**
   * Fetch a single JSON resource with ETag support and rate-limit handling.
   * Returns:
   *  - the parsed body on 200 or 304 (cache hit),
   *  - null on rate-limit (subjects already updated to `rate-limited`).
   * Throws on any other non-OK status.
   */
  private async fetchJson<T>(url: string, accept?: string): Promise<T | null> {
    if (!isPlatformBrowser(this.platformId)) return null;

    const headers: Record<string, string> = {
      Accept: accept ?? 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    };
    const cached = this.etagCache.get(url);
    if (cached) {
      headers['If-None-Match'] = cached.etag;
    }

    const response = await fetch(url, { headers, credentials: 'omit' });

    // Rate-limit check first: 403 + Remaining=0.
    if (response.status === 403) {
      const remaining = response.headers.get('X-RateLimit-Remaining');
      const resetRaw = response.headers.get('X-RateLimit-Reset');
      if (remaining === '0') {
        const resetAt = Number(resetRaw) * 1000;
        console.warn(`[github-stats] rate-limited; reset at ${new Date(resetAt).toISOString()}`);
        this.emitRateLimited(resetAt);
        return null;
      }
    }

    if (response.status === 304 && cached) {
      // ETag match: reuse cached body, don't read response (per fetch contract).
      return cached.body as T;
    }

    if (!response.ok) {
      throw new Error(`GitHub ${response.status} on ${url}`);
    }

    const parsed = (await response.json()) as T;
    const etag = response.headers.get('etag');
    if (etag) {
      this.etagCache.set(url, { etag, body: parsed, fetchedAt: Date.now() });
    }
    return parsed;
  }

  /** Emit `rate-limited` to every active subject. */
  private emitRateLimited(resetAt: number): void {
    const state = { kind: 'rate-limited' as const, resetAt };
    this.repoSummary$.next(state);
    this.stars$.next(state);
    this.weeklyStars$.next(state);
    this.issues$.next(state);
    this.forks$.next(state);
    this.prs$.next(state);
    this.commits$.next(state);
    this.releases$.next(state);
  }

  // --- Pure aggregators (public so the page component can re-derive on view
  //     switches without re-fetching). All inputs come from the BehaviorSubject
  //     `ready` payloads. Defensive against shape mismatches via typeof checks. ---

  cumulativeStarsSeries(stars: StarEvent[]): TimeSeriesPoint[] {
    return cumulativeStarsSeries(stars);
  }

  weeklyStarsDelta(stars: StarEvent[]): WeeklyDelta[] {
    return weeklyStarsDelta(stars);
  }

  issuesOpenVsClosed(issues: IssueEvent[]): { opened: TimeSeriesPoint[]; closed: TimeSeriesPoint[] } {
    return issuesOpenVsClosed(issues);
  }

  forksGrowth(forks: ForkEvent[]): TimeSeriesPoint[] {
    return forksGrowth(forks);
  }

  prsOpenedVsMerged(prs: PullEvent[]): { opened: TimeSeriesPoint[]; merged: TimeSeriesPoint[] } {
    return prsOpenedVsMerged(prs);
  }

  commitsOverTime(commits: CommitEvent[]): TimeSeriesPoint[] {
    return commitsOverTime(commits);
  }

  cumulativeCommitsSeries(commits: CommitEvent[]): TimeSeriesPoint[] {
    return cumulativeCommitsSeries(commits);
  }

  maintenanceSignal(releases: ReleaseEvent[], commits: CommitEvent[]): TimeSeriesPoint[] {
    return maintenanceSignal(releases, commits);
  }
}

// --- Pure aggregator implementations (exported for unit-test reuse). ---

function isValidIsoString(s: unknown): s is string {
  return typeof s === 'string' && s.length > 0 && !Number.isNaN(Date.parse(s));
}

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** ISO week-start (Monday, UTC). */
function startOfUtcIsoWeek(d: Date): Date {
  const day = startOfUtcDay(d);
  const wd = day.getUTCDay(); // 0=Sun..6=Sat
  const back = (wd + 6) % 7; // distance to Monday
  return new Date(day.getTime() - back * DAY_MS);
}

function startOfUtcMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function cumulativeStarsSeries(stars: StarEvent[]): TimeSeriesPoint[] {
  const valid = stars.filter((s) => isValidIsoString(s?.starred_at));
  if (valid.length === 0) return [];
  const sorted = [...valid].sort((a, b) => Date.parse(a.starred_at) - Date.parse(b.starred_at));
  const buckets = new Map<string, number>();
  for (const s of sorted) {
    const dayKey = isoDate(startOfUtcDay(new Date(s.starred_at)));
    buckets.set(dayKey, (buckets.get(dayKey) ?? 0) + 1);
  }
  // Emit running cumulative.
  const out: TimeSeriesPoint[] = [];
  let running = 0;
  for (const [dayKey, count] of [...buckets.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    running += count;
    out.push({ t: dayKey, y: running });
  }
  return out;
}

export function cumulativeCommitsSeries(commits: CommitEvent[]): TimeSeriesPoint[] {
  const valid = commits.filter((c) => isValidIsoString(c?.commit?.author?.date));
  if (valid.length === 0) return [];
  const sorted = [...valid].sort((a, b) => Date.parse(a.commit.author.date) - Date.parse(b.commit.author.date));
  const buckets = new Map<string, number>();
  for (const c of sorted) {
    const dayKey = isoDate(startOfUtcDay(new Date(c.commit.author.date)));
    buckets.set(dayKey, (buckets.get(dayKey) ?? 0) + 1);
  }
  // Emit running cumulative.
  const out: TimeSeriesPoint[] = [];
  let running = 0;
  for (const [dayKey, count] of [...buckets.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    running += count;
    out.push({ t: dayKey, y: running });
  }
  return out;
}

export function weeklyStarsDelta(stars: StarEvent[]): WeeklyDelta[] {
  const valid = stars.filter((s) => isValidIsoString(s?.starred_at));
  // Buckets keyed by ISO week-start.
  const buckets = new Map<string, number>();
  for (const s of valid) {
    const key = isoDate(startOfUtcIsoWeek(new Date(s.starred_at)));
    buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }
  // Last 12 weeks ending this week.
  const now = startOfUtcIsoWeek(new Date());
  const weeks: string[] = [];
  for (let i = 11; i >= 0; i--) {
    weeks.push(isoDate(new Date(now.getTime() - i * WEEK_MS)));
  }
  const out: WeeklyDelta[] = [];
  for (let i = 0; i < weeks.length; i++) {
    const wk = weeks[i];
    const count = buckets.get(wk) ?? 0;
    let deltaPct: number | null = null;
    if (i > 0) {
      const prev = buckets.get(weeks[i - 1]) ?? 0;
      deltaPct = prev === 0 ? (count === 0 ? 0 : 100) : ((count - prev) / prev) * 100;
    }
    out.push({ weekStart: wk, count, deltaPct });
  }
  return out;
}

export function issuesOpenVsClosed(issues: IssueEvent[]): { opened: TimeSeriesPoint[]; closed: TimeSeriesPoint[] } {
  // Filter out PRs (GitHub returns them in the issues stream).
  const real = issues.filter((i) => i?.pull_request === undefined);
  const opened = new Map<string, number>();
  const closed = new Map<string, number>();
  for (const i of real) {
    if (isValidIsoString(i.created_at)) {
      const k = isoDate(startOfUtcDay(new Date(i.created_at)));
      opened.set(k, (opened.get(k) ?? 0) + 1);
    }
    if (isValidIsoString(i.closed_at)) {
      const k = isoDate(startOfUtcDay(new Date(i.closed_at)));
      closed.set(k, (closed.get(k) ?? 0) + 1);
    }
  }
  return {
    opened: mapToSortedSeries(opened),
    closed: mapToSortedSeries(closed),
  };
}

export function forksGrowth(forks: ForkEvent[]): TimeSeriesPoint[] {
  const valid = forks.filter((f) => isValidIsoString(f?.created_at));
  if (valid.length === 0) return [];
  const sorted = [...valid].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
  const out: TimeSeriesPoint[] = [];
  let running = 0;
  // Bucket by day, emit cumulative.
  const buckets = new Map<string, number>();
  for (const f of sorted) {
    const k = isoDate(startOfUtcDay(new Date(f.created_at)));
    buckets.set(k, (buckets.get(k) ?? 0) + 1);
  }
  for (const [k, c] of [...buckets.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    running += c;
    out.push({ t: k, y: running });
  }
  return out;
}

export function prsOpenedVsMerged(prs: PullEvent[]): { opened: TimeSeriesPoint[]; merged: TimeSeriesPoint[] } {
  const opened = new Map<string, number>();
  const merged = new Map<string, number>();
  for (const p of prs) {
    if (isValidIsoString(p?.created_at)) {
      const k = isoDate(startOfUtcDay(new Date(p.created_at)));
      opened.set(k, (opened.get(k) ?? 0) + 1);
    }
    if (isValidIsoString(p?.merged_at)) {
      const k = isoDate(startOfUtcDay(new Date(p.merged_at)));
      merged.set(k, (merged.get(k) ?? 0) + 1);
    }
  }
  return {
    opened: mapToSortedSeries(opened),
    merged: mapToSortedSeries(merged),
  };
}

export function commitsOverTime(commits: CommitEvent[]): TimeSeriesPoint[] {
  // Bucket commits by ISO week, last 12 weeks.
  const buckets = new Map<string, number>();
  for (const c of commits) {
    const d = c?.commit?.author?.date;
    if (!isValidIsoString(d)) continue;
    const k = isoDate(startOfUtcIsoWeek(new Date(d)));
    buckets.set(k, (buckets.get(k) ?? 0) + 1);
  }
  const now = startOfUtcIsoWeek(new Date());
  const out: TimeSeriesPoint[] = [];
  for (let i = 11; i >= 0; i--) {
    const wk = isoDate(new Date(now.getTime() - i * WEEK_MS));
    out.push({ t: wk, y: buckets.get(wk) ?? 0 });
  }
  return out;
}

export function maintenanceSignal(releases: ReleaseEvent[], commits: CommitEvent[]): TimeSeriesPoint[] {
  if (releases.length > 0) {
    // Releases per month over last 12 months.
    const buckets = new Map<string, number>();
    for (const r of releases) {
      if (!isValidIsoString(r?.published_at)) continue;
      const k = isoDate(startOfUtcMonth(new Date(r.published_at)));
      buckets.set(k, (buckets.get(k) ?? 0) + 1);
    }
    const now = startOfUtcMonth(new Date());
    const out: TimeSeriesPoint[] = [];
    for (let i = 11; i >= 0; i--) {
      const month = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
      const k = isoDate(month);
      out.push({ t: k, y: buckets.get(k) ?? 0 });
    }
    return out;
  }
  // Fallback: commits per week over last 12 weeks.
  return commitsOverTime(commits);
}

function mapToSortedSeries(m: Map<string, number>): TimeSeriesPoint[] {
  return [...m.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([t, y]) => ({ t, y }));
}

function humanError(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}
