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

interface ViewOption {
  id: StatsViewId;
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

  @ViewChild('chartCanvas') chartCanvas?: ElementRef<HTMLCanvasElement>;

  readonly views: readonly ViewOption[] = [
    { id: 'stars-cumulative', label: 'Cumulative stars' },
    { id: 'stars-weekly', label: 'Weekly stars' },
    { id: 'issues-open-vs-closed', label: 'Issues' },
    { id: 'forks-growth', label: 'Forks' },
    { id: 'prs-opened-vs-merged', label: 'Pull requests' },
    { id: 'commits-over-time', label: 'Commits' },
    { id: 'maintenance', label: 'Maintenance' },
  ];

  selectedView: StatsViewId = 'stars-cumulative';
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

  setView(id: StatsViewId): void {
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
    }
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
