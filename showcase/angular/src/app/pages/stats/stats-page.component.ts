// /stats Easter-egg page (quick task 260514-1nv).
//
// SSR contract:
//   * ngOnInit runs on server AND client; it ONLY sets <title> and the
//     robots noindex meta tag -- no DOM probing, no fetches, no Chart.js.
//   * afterNextRender(...) only runs in the browser (Angular contract). All
//     Chart.js access + GitHubStatsService.start() lives there, so the SSR
//     bundle never imports chart.js.
//   * The component participates in routing via lazy loadComponent from
//     app.routes.ts and is pinned to RenderMode.Client in app.routes.server.ts
//     -- so it is never prerendered into static HTML under any locale subpath.
//   * Crawler invariant: no entry in sitemap.xml / llms.txt / llms-full.txt /
//     prerender-routes.txt / hreflang verifier ROUTE_PATHS / locale-seo. The
//     <meta name="robots" content="noindex, nofollow"> tag is belt-and-
//     suspenders for the rare case a crawler stumbles in via the footer link.

import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  ViewChild,
  afterNextRender,
  inject,
} from '@angular/core';
import { CommonModule, DatePipe, isPlatformBrowser } from '@angular/common';
import { Title, Meta } from '@angular/platform-browser';
import { Subscription } from 'rxjs';

import { GitHubStatsService } from '../../core/stats/github-stats.service';
import {
  CommitEvent,
  DatasetState,
  ForkEvent,
  IssueEvent,
  PullEvent,
  ReleaseEvent,
  StarEvent,
  StatsViewId,
  WeeklyDelta,
} from '../../core/stats/github-stats.types';
import { FSBTelemetryService } from '../../core/stats/fsb-telemetry.service';
import {
  DatasetState as FSBDatasetState,
  FSBTelemetryHeadline,
  FSBTelemetrySeries,
} from '../../core/stats/fsb-telemetry.types';

// Phase 274 / STATS-01 -- 6 new view ids. Local union widening so we do NOT
// have to touch github-stats.types.ts (which describes the GitHub dataset
// shape, a different concern). The view selector + chart switch operate on
// AnyViewId, while existing GitHub helpers continue to take StatsViewId.
export type FSBViewId =
  | 'fsb-active-now'
  | 'fsb-tokens'
  | 'fsb-agents-running'
  | 'fsb-popular-agents'
  | 'fsb-popular-mcp'
  | 'fsb-avg-agents-per-user';
export type AnyViewId = StatsViewId | FSBViewId;

interface ViewOption {
  id: AnyViewId;
  label: string;
}

@Component({
  selector: 'app-stats-page',
  standalone: true,
  imports: [CommonModule, DatePipe],
  templateUrl: './stats-page.component.html',
  styleUrl: './stats-page.component.scss',
})
export class StatsPageComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly statsService = inject(GitHubStatsService);
  // Phase 274 / STATS-03 -- FSB telemetry stream alongside GitHub stats.
  private readonly fsbService = inject(FSBTelemetryService);

  @ViewChild('chartCanvas') chartCanvas?: ElementRef<HTMLCanvasElement>;

  readonly views: readonly ViewOption[] = [
    { id: 'stars-cumulative', label: 'Cumulative stars' },
    { id: 'stars-weekly', label: 'Weekly stars' },
    { id: 'issues-open-vs-closed', label: 'Issues' },
    { id: 'forks-growth', label: 'Forks' },
    { id: 'prs-opened-vs-merged', label: 'Pull requests' },
    { id: 'commits-over-time', label: 'Commits' },
    { id: 'maintenance', label: 'Maintenance' },
    // Phase 274 / STATS-01 -- 6 new FSB telemetry views appended. Only the
    // FSB-prefixed view labels are i18n-marked; the legacy GitHub view labels
    // remain English-only to match the page's pre-274 baseline (the /stats
    // route is an Easter egg, deliberately invisible to most users).
    { id: 'fsb-active-now', label: $localize`:@@SHOWCASE_STATS_FSB_VIEW_ACTIVE_NOW:Active right now` },
    { id: 'fsb-tokens', label: $localize`:@@SHOWCASE_STATS_FSB_VIEW_TOKENS:Tokens` },
    { id: 'fsb-agents-running', label: $localize`:@@SHOWCASE_STATS_FSB_VIEW_AGENTS_RUNNING:Agents running` },
    { id: 'fsb-popular-agents', label: $localize`:@@SHOWCASE_STATS_FSB_VIEW_POPULAR_AGENTS:Popular agents` },
    { id: 'fsb-popular-mcp', label: $localize`:@@SHOWCASE_STATS_FSB_VIEW_POPULAR_MCP:Popular MCP clients` },
    { id: 'fsb-avg-agents-per-user', label: $localize`:@@SHOWCASE_STATS_FSB_VIEW_AVG_AGENTS:Average agents per user` },
  ];

  selectedView: AnyViewId = 'stars-cumulative';
  viewState: 'loading' | 'ready' | 'rate-limited' | 'error' = 'loading';
  rateLimitedUntil: Date | null = null;
  errorMessage = '';

  // Latest dataset snapshots, populated from subject subscriptions. We keep
  // these as fields (not signals) because the redraw cycle is driven by
  // setView() / new dataset arrival, not by Angular change-detection ticks.
  private latestStars: StarEvent[] = [];
  private latestWeeklyStars: WeeklyDelta[] = [];
  private latestIssues: IssueEvent[] = [];
  private latestForks: ForkEvent[] = [];
  private latestPrs: PullEvent[] = [];
  private latestCommits: CommitEvent[] = [];
  private latestReleases: ReleaseEvent[] = [];

  // Phase 274 / STATS-02 + STATS-03 -- FSB telemetry snapshots; template
  // reads `fsbHeadline` getter for the live headline row above the chart card.
  private latestFsbHeadline: FSBTelemetryHeadline | null = null;
  private latestFsbSeries: FSBTelemetrySeries | null = null;

  get fsbHeadline(): FSBTelemetryHeadline | null {
    return this.latestFsbHeadline;
  }

  // Chart.js Chart class -- captured from the dynamic import inside
  // afterNextRender. Typed `any` because we never import the type on the
  // server bundle.
  private ChartCtor: any = null;
  private chartInstance: any = null;

  private subs: Subscription[] = [];

  constructor() {
    afterNextRender(() => {
      // Browser-only by Angular contract. Bootstrap Chart.js + the service
      // and wire up subscriptions. We re-render on every dataset update and
      // on view switches.
      void this.bootstrap();
    });
  }

  ngOnInit(): void {
    // Runs on server + browser. Static head-only work: title + robots noindex.
    this.title.setTitle('FSB · Stats');
    this.meta.updateTag({ name: 'robots', content: 'noindex, nofollow' });
  }

  ngAfterViewInit(): void {
    // No-op -- chart bootstrap is handled inside afterNextRender so the
    // canvas may not exist yet on first ngAfterViewInit (template @if
    // skeleton state). bootstrap() handles canvas availability defensively.
  }

  ngOnDestroy(): void {
    this.statsService.stop();
    // Phase 274 / STATS-03 -- mirror lifecycle for the FSB telemetry service.
    this.fsbService.stop();
    for (const s of this.subs) s.unsubscribe();
    this.subs = [];
    if (this.chartInstance) {
      try {
        this.chartInstance.destroy();
      } catch {
        /* swallow */
      }
      this.chartInstance = null;
    }
  }

  setView(id: AnyViewId): void {
    if (this.selectedView === id) return;
    this.selectedView = id;
    // Redraw from latest data; no refetch (data is shared across views).
    this.redrawChart();
  }

  trackByView(_index: number, opt: ViewOption): string {
    return opt.id;
  }

  private async bootstrap(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      // Dynamic import -- never bundled into the SSR pass.
      const chartMod = await import('chart.js/auto');
      this.ChartCtor = chartMod.default ?? chartMod;
    } catch (err) {
      console.warn('[stats-page] failed to load chart.js', err);
      this.viewState = 'error';
      this.errorMessage = 'Could not load chart library.';
      return;
    }

    this.statsService.start();

    // Wire all 8 dataset subjects. Any "rate-limited" state flips the whole
    // page into the rate-limit card; any "error" updates the inline message.
    this.subs.push(this.statsService.stars$.subscribe((s) => this.onDatasetUpdate('stars', s)));
    this.subs.push(this.statsService.weeklyStars$.subscribe((s) => this.onDatasetUpdate('weeklyStars', s)));
    this.subs.push(this.statsService.issues$.subscribe((s) => this.onDatasetUpdate('issues', s)));
    this.subs.push(this.statsService.forks$.subscribe((s) => this.onDatasetUpdate('forks', s)));
    this.subs.push(this.statsService.prs$.subscribe((s) => this.onDatasetUpdate('prs', s)));
    this.subs.push(this.statsService.commits$.subscribe((s) => this.onDatasetUpdate('commits', s)));
    this.subs.push(this.statsService.releases$.subscribe((s) => this.onDatasetUpdate('releases', s)));
    // repoSummary subscription is intentionally omitted from per-update redraw
    // because no chart view depends on it directly; we still surface its
    // rate-limit state for UI.
    this.subs.push(
      this.statsService.repoSummary$.subscribe((s) => {
        if (s.kind === 'rate-limited') this.applyRateLimit(s.resetAt);
      })
    );

    // Phase 274 / STATS-03 -- bring up the FSB telemetry stream alongside GitHub.
    // FSBTelemetryService never emits `rate-limited` (server endpoint is
    // server-cached, not rate-limited). On `error` we silently keep the prior
    // snapshot -- the GitHub side dominates the page's overall viewState
    // machine, so a transient FSB blip should not flip the whole page into an
    // error card.
    this.fsbService.start();
    this.subs.push(this.fsbService.headline$.subscribe((s) => this.onFsbHeadlineUpdate(s)));
    this.subs.push(this.fsbService.series$.subscribe((s) => this.onFsbSeriesUpdate(s)));
  }

  private onFsbHeadlineUpdate(state: FSBDatasetState<FSBTelemetryHeadline>): void {
    if (state.kind === 'ready') {
      this.latestFsbHeadline = state.data;
      if (this.viewState !== 'rate-limited') {
        this.viewState = 'ready';
        this.errorMessage = '';
        this.redrawChart();
      }
    }
    // `error` and `loading` fall through silently; the headline row is
    // conditionally rendered via @if (fsbHeadline) so a null snapshot just
    // hides the row.
  }

  private onFsbSeriesUpdate(state: FSBDatasetState<FSBTelemetrySeries>): void {
    if (state.kind === 'ready') {
      this.latestFsbSeries = state.data;
      if (this.viewState !== 'rate-limited') {
        this.viewState = 'ready';
        this.errorMessage = '';
        this.redrawChart();
      }
    }
  }

  private onDatasetUpdate(
    key: 'stars' | 'weeklyStars' | 'issues' | 'forks' | 'prs' | 'commits' | 'releases',
    state: DatasetState<unknown>
  ): void {
    if (state.kind === 'rate-limited') {
      this.applyRateLimit(state.resetAt);
      return;
    }
    if (state.kind === 'error') {
      // Per-dataset error; only surface globally if we have nothing else.
      if (this.viewState === 'loading') {
        this.viewState = 'error';
        this.errorMessage = state.message;
      }
      return;
    }
    if (state.kind !== 'ready') return;

    switch (key) {
      case 'stars':
        this.latestStars = state.data as StarEvent[];
        break;
      case 'weeklyStars':
        this.latestWeeklyStars = state.data as WeeklyDelta[];
        break;
      case 'issues':
        this.latestIssues = state.data as IssueEvent[];
        break;
      case 'forks':
        this.latestForks = state.data as ForkEvent[];
        break;
      case 'prs':
        this.latestPrs = state.data as PullEvent[];
        break;
      case 'commits':
        this.latestCommits = state.data as CommitEvent[];
        break;
      case 'releases':
        this.latestReleases = state.data as ReleaseEvent[];
        break;
    }
    if (this.viewState !== 'rate-limited') {
      this.viewState = 'ready';
      this.errorMessage = '';
      this.redrawChart();
    }
  }

  private applyRateLimit(resetAt: number): void {
    this.viewState = 'rate-limited';
    this.rateLimitedUntil = new Date(resetAt);
  }

  private redrawChart(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    if (!this.ChartCtor) return;
    const canvasRef = this.chartCanvas;
    if (!canvasRef) return; // template not yet in `ready` branch.
    const canvas = canvasRef.nativeElement;
    if (!canvas) return;

    // Destroy prior chart before mounting the next one.
    if (this.chartInstance) {
      try {
        this.chartInstance.destroy();
      } catch {
        /* swallow */
      }
      this.chartInstance = null;
    }

    const config = this.buildChartConfig();
    if (!config) return;
    try {
      this.chartInstance = new this.ChartCtor(canvas, config);
    } catch (err) {
      console.warn('[stats-page] chart render failed', err);
    }
  }

  private buildChartConfig(): unknown {
    const tokens = readChartTokens();
    const baseScales = {
      x: {
        ticks: { color: tokens.muted },
        grid: { color: tokens.border },
      },
      y: {
        ticks: { color: tokens.muted },
        grid: { color: tokens.border },
        beginAtZero: true,
      },
    };
    const baseOpts = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: tokens.text } },
        tooltip: { enabled: true },
      },
      scales: baseScales,
    };

    switch (this.selectedView) {
      case 'stars-cumulative': {
        const series = this.statsService.cumulativeStarsSeries(this.latestStars);
        return {
          type: 'line',
          data: {
            labels: series.map((p) => p.t),
            datasets: [
              {
                label: 'Cumulative stars',
                data: series.map((p) => p.y),
                borderColor: tokens.primary,
                backgroundColor: tokens.primarySoft,
                fill: true,
                tension: 0.2,
              },
            ],
          },
          options: baseOpts,
        };
      }
      case 'stars-weekly': {
        const series = this.latestWeeklyStars.length
          ? this.latestWeeklyStars
          : this.statsService.weeklyStarsDelta(this.latestStars);
        return {
          type: 'bar',
          data: {
            labels: series.map((p) => p.weekStart),
            datasets: [
              {
                label: 'Stars per week',
                data: series.map((p) => p.count),
                backgroundColor: tokens.primarySoft,
                borderColor: tokens.primary,
                borderWidth: 1,
              },
            ],
          },
          options: baseOpts,
        };
      }
      case 'issues-open-vs-closed': {
        const { opened, closed } = this.statsService.issuesOpenVsClosed(this.latestIssues);
        const labels = unionLabels(opened.map((p) => p.t), closed.map((p) => p.t));
        return {
          type: 'line',
          data: {
            labels,
            datasets: [
              {
                label: 'Opened',
                data: labels.map((t) => valueAt(opened, t)),
                borderColor: tokens.primary,
                backgroundColor: 'transparent',
                tension: 0.2,
              },
              {
                label: 'Closed',
                data: labels.map((t) => valueAt(closed, t)),
                borderColor: tokens.muted,
                backgroundColor: 'transparent',
                tension: 0.2,
              },
            ],
          },
          options: baseOpts,
        };
      }
      case 'forks-growth': {
        const series = this.statsService.forksGrowth(this.latestForks);
        return {
          type: 'line',
          data: {
            labels: series.map((p) => p.t),
            datasets: [
              {
                label: 'Cumulative forks',
                data: series.map((p) => p.y),
                borderColor: tokens.primary,
                backgroundColor: tokens.primarySoft,
                fill: true,
                tension: 0.2,
              },
            ],
          },
          options: baseOpts,
        };
      }
      case 'prs-opened-vs-merged': {
        const { opened, merged } = this.statsService.prsOpenedVsMerged(this.latestPrs);
        const labels = unionLabels(opened.map((p) => p.t), merged.map((p) => p.t));
        return {
          type: 'line',
          data: {
            labels,
            datasets: [
              {
                label: 'Opened',
                data: labels.map((t) => valueAt(opened, t)),
                borderColor: tokens.primary,
                backgroundColor: 'transparent',
                tension: 0.2,
              },
              {
                label: 'Merged',
                data: labels.map((t) => valueAt(merged, t)),
                borderColor: tokens.muted,
                backgroundColor: 'transparent',
                tension: 0.2,
              },
            ],
          },
          options: baseOpts,
        };
      }
      case 'commits-over-time': {
        const series = this.statsService.commitsOverTime(this.latestCommits);
        return {
          type: 'bar',
          data: {
            labels: series.map((p) => p.t),
            datasets: [
              {
                label: 'Commits per week',
                data: series.map((p) => p.y),
                backgroundColor: tokens.primarySoft,
                borderColor: tokens.primary,
                borderWidth: 1,
              },
            ],
          },
          options: baseOpts,
        };
      }
      case 'maintenance': {
        const series = this.statsService.maintenanceSignal(this.latestReleases, this.latestCommits);
        return {
          type: 'bar',
          data: {
            labels: series.map((p) => p.t),
            datasets: [
              {
                label: this.latestReleases.length ? 'Releases per month' : 'Commits per week (no releases yet)',
                data: series.map((p) => p.y),
                backgroundColor: tokens.primarySoft,
                borderColor: tokens.primary,
                borderWidth: 1,
              },
            ],
          },
          options: baseOpts,
        };
      }
      // -----------------------------------------------------------------
      // Phase 274 / STATS-01 -- 6 FSB telemetry chart views.
      // Each renders an empty axis when the data hasn't arrived yet so
      // Chart.js never crashes on null inputs.
      // -----------------------------------------------------------------
      case 'fsb-active-now': {
        const v = this.latestFsbHeadline?.active_users_now ?? 0;
        return {
          type: 'bar',
          data: {
            labels: [$localize`:@@SHOWCASE_STATS_FSB_CHART_ACTIVE_NOW:Active users right now`],
            datasets: [
              {
                label: $localize`:@@SHOWCASE_STATS_FSB_CHART_ACTIVE_NOW_LEGEND:Active users (5 min window)`,
                data: [v],
                backgroundColor: tokens.primarySoft,
                borderColor: tokens.primary,
                borderWidth: 1,
              },
            ],
          },
          options: baseOpts,
        };
      }
      case 'fsb-tokens': {
        const pts = this.latestFsbSeries?.d30 ?? [];
        return {
          type: 'line',
          data: {
            labels: pts.map((p) => p.day_utc),
            datasets: [
              {
                label: $localize`:@@SHOWCASE_STATS_FSB_CHART_TOKENS_LEGEND:Tokens (last 30 days)`,
                data: pts.map((p) => p.tokens),
                borderColor: tokens.primary,
                backgroundColor: tokens.primarySoft,
                fill: true,
                tension: 0.2,
              },
            ],
          },
          options: baseOpts,
        };
      }
      case 'fsb-agents-running': {
        const headline = this.latestFsbHeadline;
        const v = headline?.active_agents_now ?? 0;
        const bucket = headline?.active_agents_bucket ?? '0';
        return {
          type: 'bar',
          data: {
            labels: [$localize`:@@SHOWCASE_STATS_FSB_CHART_AGENTS_RUNNING:Agents running right now`],
            datasets: [
              {
                // The bucket label is appended in brackets so the legend stays
                // single-language-safe -- only the leading phrase is translated,
                // the bucket string (e.g. "5-8") is a code-like identifier.
                label: $localize`:@@SHOWCASE_STATS_FSB_CHART_AGENTS_RUNNING_LEGEND:Active agents (10 min window)` + ` [${bucket}]`,
                data: [v],
                backgroundColor: tokens.primarySoft,
                borderColor: tokens.primary,
                borderWidth: 1,
              },
            ],
          },
          options: baseOpts,
        };
      }
      case 'fsb-popular-agents': {
        const raw = this.latestFsbHeadline?.popular_agents ?? [];
        // k-anonymity floor sometimes suppresses everything; render a single
        // "Pending" slice so Chart.js has something to draw.
        const list = raw.length > 0
          ? raw
          : [{ label: $localize`:@@SHOWCASE_STATS_FSB_CHART_PENDING:Pending (k>=5 floor)`, uniq: 1 }];
        return {
          type: 'doughnut',
          data: {
            labels: list.map((x) => x.label),
            datasets: [
              {
                label: $localize`:@@SHOWCASE_STATS_FSB_CHART_POPULAR_AGENTS_LEGEND:Popular agents`,
                data: list.map((x) => x.uniq),
                backgroundColor: [
                  tokens.primary, tokens.primarySoft, tokens.muted,
                  tokens.border, tokens.text, '#a78bfa', '#34d399',
                ],
              },
            ],
          },
          options: baseOpts,
        };
      }
      case 'fsb-popular-mcp': {
        const raw = this.latestFsbHeadline?.popular_mcp_clients ?? [];
        const list = raw.length > 0
          ? raw
          : [{ label: $localize`:@@SHOWCASE_STATS_FSB_CHART_PENDING_MCP:Pending (k>=5 floor)`, uniq: 1 }];
        return {
          type: 'doughnut',
          data: {
            labels: list.map((x) => x.label),
            datasets: [
              {
                label: $localize`:@@SHOWCASE_STATS_FSB_CHART_POPULAR_MCP_LEGEND:Popular MCP clients`,
                data: list.map((x) => x.uniq),
                backgroundColor: [
                  tokens.primary, tokens.primarySoft, tokens.muted,
                  tokens.border, tokens.text, '#a78bfa', '#34d399',
                ],
              },
            ],
          },
          options: baseOpts,
        };
      }
      case 'fsb-avg-agents-per-user': {
        const v = this.latestFsbHeadline?.avg_agents_per_user ?? 0;
        // Bar chart with a soft Y-max so the single bar reads as a "big number"
        // visually -- avoids the axis auto-ranging to the value (which would
        // make every reading look identical).
        const baseOptsWithMaxY = {
          ...baseOpts,
          scales: {
            ...baseScales,
            y: { ...baseScales.y, suggestedMax: 5 },
          },
        };
        return {
          type: 'bar',
          data: {
            labels: [$localize`:@@SHOWCASE_STATS_FSB_CHART_AVG_AGENTS:Avg agents per active user`],
            datasets: [
              {
                label: $localize`:@@SHOWCASE_STATS_FSB_CHART_AVG_AGENTS_LEGEND:Avg active agents per active user`,
                data: [v],
                backgroundColor: tokens.primarySoft,
                borderColor: tokens.primary,
                borderWidth: 1,
              },
            ],
          },
          options: baseOptsWithMaxY,
        };
      }
    }
    // TypeScript exhaustiveness: every case in the AnyViewId union is handled
    // above. The fall-through return is unreachable in practice but satisfies
    // the implicit `void` return analysis.
    return null;
  }
}

interface ChartTokens {
  primary: string;
  primarySoft: string;
  text: string;
  muted: string;
  border: string;
}

function readChartTokens(): ChartTokens {
  // Pull the CSS-custom-property tokens from the computed style of <html>
  // so chart colors track the active theme automatically.
  if (typeof document === 'undefined' || typeof getComputedStyle === 'undefined') {
    return {
      primary: '#ff6b35',
      primarySoft: 'rgba(255, 107, 53, 0.12)',
      text: '#f1f5f9',
      muted: '#94a3b8',
      border: 'rgba(255, 255, 255, 0.08)',
    };
  }
  const style = getComputedStyle(document.documentElement);
  return {
    primary: (style.getPropertyValue('--primary') || '#ff6b35').trim(),
    primarySoft: (style.getPropertyValue('--fsb-primary-soft') || 'rgba(255, 107, 53, 0.12)').trim(),
    text: (style.getPropertyValue('--text-primary') || '#f1f5f9').trim(),
    muted: (style.getPropertyValue('--text-secondary') || '#94a3b8').trim(),
    border: (style.getPropertyValue('--border-color') || 'rgba(255,255,255,0.08)').trim(),
  };
}

function unionLabels(a: string[], b: string[]): string[] {
  const set = new Set<string>([...a, ...b]);
  return [...set].sort((x, y) => (x < y ? -1 : 1));
}

function valueAt(series: { t: string; y: number }[], label: string): number {
  const hit = series.find((p) => p.t === label);
  return hit ? hit.y : 0;
}
