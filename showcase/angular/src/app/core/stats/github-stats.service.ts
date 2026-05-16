// GitHub stats service for the /stats Easter-egg page.
//
// Design notes (quick task 260516-7l5 server-side-cache rewrite):
//
//  * Source: same-origin /api/public-stats/github/<endpoint_id> served by
//    showcase/server/src/routes/public-stats.js. The server polls GitHub
//    once per 5 min into a SQLite cache (showcase/server/src/telemetry/
//    github-poller.js) so individual visitors do not burn their own per-IP
//    GitHub rate limit. Pagination, vendor Accept types, and 403 rate-limit
//    handling all live server-side now -- this client only consumes JSON.
//
//  * Polling: every POLL_INTERVAL_MS = 5 min while the document is visible.
//    visibilitychange pauses + resumes via clear/setInterval. ngOnDestroy
//    calls stop() to guarantee no leak across route changes.
//
//  * SSR safety: every fetch + every `document` reference is gated by
//    `isPlatformBrowser(PLATFORM_ID)`. Server-side rendering stays at
//    { kind: 'loading' } for all subjects -- afterNextRender bootstraps
//    start() only on the browser.
//
//  * ETag cache: per-URL If-None-Match round-trip against the server's
//    sha256-based ETag (showcase/server/.../public-stats.js etagFor). A 304
//    returns the cached body without re-parsing.
//
//  * First-boot 503: when the server cache row is cold (poller not yet
//    completed its first tick), the endpoint returns 503 + Retry-After. The
//    client treats 503 as transient (returns null, leaves the subject as-is
//    or loading); the next 5-min poll cycle retries automatically.
//
//  * Maintenance signal: same as before -- releases-per-month over 12 months
//    when releases is non-empty; falls back to commits-per-week from
//    /commits. Aggregator logic in this file is UNCHANGED post-rewrite; only
//    the source URLs moved.

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

// Quick task 260516-7l5 -- same-origin server-side cache. The server polls
// GitHub once per 5 min into showcase/server/.../github_cache and serves each
// endpoint_id at /api/public-stats/github/<endpoint_id>. The browser never
// hits api.github.com directly, so the 60-req/hr per-IP unauth limit no
// longer applies to individual visitors. Pagination, vendor Accept types, and
// rate-limit handling all live server-side now; this client just consumes
// JSON and feeds the same aggregator functions (cumulativeStarsSeries etc.).
const API_ROOT = '/api/public-stats/github';
const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 min (matches server poll cadence)
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

  /** ETag store keyed by full request URL. */
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
    try {
      const data = await this.fetchJson<RepoSummary>(`${API_ROOT}/repo-summary`);
      if (data === null) return;
      this.repoSummary$.next({ kind: 'ready', data, fetchedAt: Date.now() });
    } catch (err) {
      this.repoSummary$.next({ kind: 'error', message: humanError(err) });
    }
  }

  private async fetchStars(): Promise<void> {
    try {
      const stars = await this.fetchJson<StarEvent[]>(`${API_ROOT}/stars`);
      if (stars === null) return;
      this.stars$.next({ kind: 'ready', data: stars, fetchedAt: Date.now() });
      this.weeklyStars$.next({ kind: 'ready', data: weeklyStarsDelta(stars), fetchedAt: Date.now() });
    } catch (err) {
      const msg = humanError(err);
      this.stars$.next({ kind: 'error', message: msg });
      this.weeklyStars$.next({ kind: 'error', message: msg });
    }
  }

  private async fetchIssues(): Promise<void> {
    try {
      const issues = await this.fetchJson<IssueEvent[]>(`${API_ROOT}/issues`);
      if (issues === null) return;
      this.issues$.next({ kind: 'ready', data: issues, fetchedAt: Date.now() });
    } catch (err) {
      this.issues$.next({ kind: 'error', message: humanError(err) });
    }
  }

  private async fetchForks(): Promise<void> {
    try {
      const forks = await this.fetchJson<ForkEvent[]>(`${API_ROOT}/forks`);
      if (forks === null) return;
      this.forks$.next({ kind: 'ready', data: forks, fetchedAt: Date.now() });
    } catch (err) {
      this.forks$.next({ kind: 'error', message: humanError(err) });
    }
  }

  private async fetchPulls(): Promise<void> {
    try {
      const pulls = await this.fetchJson<PullEvent[]>(`${API_ROOT}/pulls`);
      if (pulls === null) return;
      this.prs$.next({ kind: 'ready', data: pulls, fetchedAt: Date.now() });
    } catch (err) {
      this.prs$.next({ kind: 'error', message: humanError(err) });
    }
  }

  private async fetchCommits(): Promise<void> {
    try {
      const commits = await this.fetchJson<CommitEvent[]>(`${API_ROOT}/commits`);
      if (commits === null) return;
      this.commits$.next({ kind: 'ready', data: commits, fetchedAt: Date.now() });
    } catch (err) {
      this.commits$.next({ kind: 'error', message: humanError(err) });
    }
  }

  private async fetchReleases(): Promise<void> {
    try {
      const releases = await this.fetchJson<ReleaseEvent[]>(`${API_ROOT}/releases`);
      if (releases === null) return;
      this.releases$.next({ kind: 'ready', data: releases, fetchedAt: Date.now() });
    } catch (err) {
      this.releases$.next({ kind: 'error', message: humanError(err) });
    }
  }

  // --- Low-level fetch + ETag cache. ---

  /**
   * Fetch a single JSON resource same-origin with ETag round-trip support.
   * Returns:
   *  - the parsed body on 200 or 304 (cache hit),
   *  - null on 503 (server cache cold; transient -- next poll cycle retries).
   * Throws on any other non-OK status.
   */
  private async fetchJson<T>(url: string): Promise<T | null> {
    if (!isPlatformBrowser(this.platformId)) return null;

    const headers: Record<string, string> = { 'Accept': 'application/json' };
    const cached = this.etagCache.get(url);
    if (cached) headers['If-None-Match'] = cached.etag;

    const response = await fetch(url, { headers, credentials: 'same-origin' });

    if (response.status === 304 && cached) {
      return cached.body as T;
    }
    if (response.status === 503) {
      // Server cache cold (first boot). Treat as transient error -- next poll cycle retries.
      return null;
    }
    if (!response.ok) {
      throw new Error(`stats ${response.status} on ${url}`);
    }

    const parsed = (await response.json()) as T;
    const etag = response.headers.get('etag');
    if (etag) {
      this.etagCache.set(url, { etag, body: parsed, fetchedAt: Date.now() });
    }
    return parsed;
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

  commitPunchcard(commits: CommitEvent[]): PunchcardPoint[] {
    return commitPunchcard(commits);
  }

  monthlyForks(forks: ForkEvent[]): TimeSeriesPoint[] {
    return monthlyForks(forks);
  }
}

/**
 * Punchcard cell -- one bubble in the GitHub-style "commits by hour of day +
 * weekday" view. `x` is the UTC hour (0-23), `y` is the UTC weekday
 * (0=Sun..6=Sat), `r` is the sqrt-scaled commit count clamped to 3..20 px so
 * a busy bucket does not dominate the canvas, and `c` is the raw un-scaled
 * commit count for that bucket -- used by the tooltip so users see
 * "5 commits" instead of the meaningless radius value (Codex P2 on PR #58).
 */
export interface PunchcardPoint { x: number; y: number; r: number; c: number }

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

export function startOfUtcMonth(d: Date): Date {
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

/**
 * Bucket commits by UTC weekday (0=Sun..6=Sat) and UTC hour (0..23), emitting
 * one bubble cell per non-empty bucket. Radius is sqrt-scaled and clamped to
 * 3..20 px so a dominant bucket cannot blow out the chart. Invalid ISO date
 * strings are filtered out via isValidIsoString -- matches the convention of
 * every other aggregator in this file.
 */
/**
 * Bucket forks by UTC month, returning monthly counts (not cumulative). Used
 * by the dual-axis forks-growth view (bar dataset on the right axis).
 */
export function monthlyForks(forks: ForkEvent[]): TimeSeriesPoint[] {
  const buckets = new Map<string, number>();
  for (const f of forks) {
    if (!isValidIsoString(f?.created_at)) continue;
    const k = isoDate(startOfUtcMonth(new Date(f.created_at)));
    buckets.set(k, (buckets.get(k) ?? 0) + 1);
  }
  return mapToSortedSeries(buckets);
}

export function commitPunchcard(commits: CommitEvent[]): PunchcardPoint[] {
  const buckets = new Map<string, number>();
  for (const c of commits) {
    const d = c?.commit?.author?.date;
    if (!isValidIsoString(d)) continue;
    const dt = new Date(d);
    const weekday = dt.getUTCDay(); // 0=Sun..6=Sat
    const hour = dt.getUTCHours();
    const key = `${weekday}-${hour}`;
    buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }
  const out: PunchcardPoint[] = [];
  for (const [key, count] of buckets.entries()) {
    if (count <= 0) continue;
    const [wdStr, hrStr] = key.split('-');
    const weekday = Number(wdStr);
    const hour = Number(hrStr);
    const r = Math.max(3, Math.min(20, Math.sqrt(count) * 4));
    out.push({ x: hour, y: weekday, r, c: count });
  }
  return out;
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
