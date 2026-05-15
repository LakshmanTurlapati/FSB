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
import { CommonModule, DatePipe, DecimalPipe, isPlatformBrowser } from '@angular/common';
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
  imports: [CommonModule, DatePipe, DecimalPipe],
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
    { id: 'commits-cumulative', label: 'Cumulative commits' },
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

  // Quick task 260515-kw1 (stats chart overhaul) -- ring buffer + plugin + delta.
  //
  //   * agentHistoryRing: rolling 288-sample (~24h at 5-min poll) buffer of
  //     active_agents_now snapshots pushed from onFsbHeadlineUpdate. Powers the
  //     sparkline view. Capped strictly so the page can run for days without
  //     unbounded memory growth.
  //   * centerTextPluginRegistered: idempotent guard so the local fsbCenterText
  //     plugin is registered exactly once with the global Chart class.
  //   * priorAvgAgentsPerUser + avgAgentsDelta: snapshot-pair used by the
  //     big-number tile's delta arrow (no chart canvas involved).
  private agentHistoryRing: number[] = [];
  private static readonly AGENT_HISTORY_CAP = 288; // 24h * 60min / 5min poll
  private centerTextPluginRegistered = false;
  private priorAvgAgentsPerUser: number | null = null;
  avgAgentsDelta: number | null = null;

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

      // Local fsbCenterText plugin -- registered exactly once, only inside
      // afterNextRender (which never runs on the server). Used by the
      // fsb-active-now radial-gauge case to render the headline number in the
      // doughnut hole. Generic by design (opts in via options.plugins.fsbCenterText.enabled)
      // so other cases can reuse it without enabling it.
      if (!this.centerTextPluginRegistered) {
        const ChartNamed: any = (chartMod as any).Chart ?? (chartMod as any).default;
        const centerTextPlugin = {
          id: 'fsbCenterText',
          afterDraw: (chart: any) => {
            const optsAny = chart?.config?.options as any;
            if (optsAny?.plugins?.fsbCenterText?.enabled !== true) return;
            const { ctx, chartArea } = chart;
            if (!ctx || !chartArea) return;
            const text = String(optsAny.plugins.fsbCenterText.value ?? '0');
            ctx.save();
            ctx.fillStyle = optsAny.plugins.fsbCenterText.color ?? '#fff';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.font = '600 28px ui-sans-serif, system-ui, sans-serif';
            const cx = (chartArea.left + chartArea.right) / 2;
            // For a half-doughnut (rotation -90 + circumference 180), the
            // visible arc sits in the upper half; place text ~25% up from the
            // bottom of chartArea so it reads as the gauge's centerline.
            const cy = chartArea.bottom - (chartArea.bottom - chartArea.top) * 0.25;
            ctx.fillText(text, cx, cy);
            ctx.restore();
          },
        };
        try {
          ChartNamed?.register?.(centerTextPlugin);
          this.centerTextPluginRegistered = true;
        } catch {
          // Non-fatal: the gauge view will still render without center text.
        }
      }
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

      // Quick task 260515-kw1 -- agents-running sparkline ring buffer.
      // Push every snapshot's active_agents_now onto a 288-sample (24h * 12)
      // FIFO. shift() trim keeps the buffer bounded so multi-day sessions do
      // not leak memory.
      const agents = state.data?.active_agents_now ?? 0;
      this.agentHistoryRing.push(agents);
      if (this.agentHistoryRing.length > StatsPageComponent.AGENT_HISTORY_CAP) {
        this.agentHistoryRing.shift();
      }

      // Quick task 260515-kw1 -- big-number tile delta arrow.
      // Compute (curr - prior) rounded to 2 dp so the displayed delta does
      // not flicker with float noise. First sample produces a null delta
      // (no prior to compare against).
      const curr = state.data?.avg_agents_per_user ?? 0;
      if (this.priorAvgAgentsPerUser !== null) {
        this.avgAgentsDelta = +(curr - this.priorAvgAgentsPerUser).toFixed(2);
      }
      this.priorAvgAgentsPerUser = curr;

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

    // Quick task 260515-kw1 -- the big-number tile branch has NO <canvas> in
    // the template, so canvasRef will be undefined while this view is active.
    // Destroy any prior chart so switching away from a canvas view cleans up.
    if (this.selectedView === 'fsb-avg-agents-per-user') {
      if (this.chartInstance) {
        try { this.chartInstance.destroy(); } catch { /* swallow */ }
        this.chartInstance = null;
      }
      // Also clear any stray Sankey SVG from a prior view.
      this.clearSankeySvg();
      return;
    }

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

    // Quick task 260515-kw1 -- Sankey branch renders inline SVG instead of a
    // Chart.js config. Hide the canvas while this view is active so the SVG
    // can take the .chart-mount real estate.
    if (this.selectedView === 'issues-open-vs-closed') {
      try { canvas.style.display = 'none'; } catch { /* swallow */ }
      this.renderSankeySvg();
      return;
    }

    // For every other view, ensure the canvas is visible (a prior Sankey
    // render may have hidden it) and the SVG host is cleared.
    try { canvas.style.display = ''; } catch { /* swallow */ }
    this.clearSankeySvg();

    const config = this.buildChartConfig();
    if (!config) return;
    try {
      this.chartInstance = new this.ChartCtor(canvas, config);
    } catch (err) {
      console.warn('[stats-page] chart render failed', err);
    }
  }

  /**
   * Quick task 260515-kw1 -- inline-SVG Sankey renderer for
   * issues-open-vs-closed. Two nodes (Opened on the left, Closed on the right)
   * with one flow path; backlog (O - C) is drawn as a thinner secondary flow
   * into a small "Open" node on the far right so the diagram has visual
   * meaning even when every issue is closed. Uses readChartTokens for theme.
   */
  private renderSankeySvg(): void {
    const canvasRef = this.chartCanvas;
    const mount = canvasRef?.nativeElement?.parentElement;
    if (!mount) return;

    this.clearSankeySvg();

    const { opened, closed } = this.statsService.issuesOpenVsClosed(this.latestIssues);
    const O = opened.reduce((acc, p) => acc + (p.y || 0), 0);
    const C = closed.reduce((acc, p) => acc + (p.y || 0), 0);
    const backlog = Math.max(0, O - C);
    const closedFlow = Math.max(0, Math.min(O, C));
    const tokens = readChartTokens();

    const VB_W = 600;
    const VB_H = 240;
    const nodeW = 18;
    const leftX = 60;
    const rightX = VB_W - 60 - nodeW;
    const maxBar = VB_H - 60;
    const oH = O > 0 ? maxBar : 0;
    const total = closedFlow + backlog || 1;
    const closedH = (closedFlow / total) * oH;
    const backlogH = (backlog / total) * oH;
    const oY = (VB_H - oH) / 2;
    const closedY = 30;
    const backlogY = VB_H - 30 - backlogH;

    // Two cubic Bezier flow paths from the right edge of the Opened node to
    // the left edge of the Closed / Backlog nodes. Stroke width = flow size.
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('class', 'sankey-svg');
    svg.setAttribute('viewBox', `0 0 ${VB_W} ${VB_H}`);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', `Sankey: ${O} opened, ${closedFlow} closed, ${backlog} still open`);

    const mkPath = (y1: number, h1: number, y2: number, h2: number, fill: string): SVGPathElement => {
      const sx = leftX + nodeW;
      const ex = rightX;
      const mx = (sx + ex) / 2;
      const sy1 = y1;
      const sy2 = y1 + h1;
      const ey1 = y2;
      const ey2 = y2 + h2;
      const d = [
        `M ${sx} ${sy1}`,
        `C ${mx} ${sy1}, ${mx} ${ey1}, ${ex} ${ey1}`,
        `L ${ex} ${ey2}`,
        `C ${mx} ${ey2}, ${mx} ${sy2}, ${sx} ${sy2}`,
        'Z',
      ].join(' ');
      const path = document.createElementNS(svgNS, 'path');
      path.setAttribute('d', d);
      path.setAttribute('fill', fill);
      path.setAttribute('fill-opacity', '0.55');
      return path;
    };

    if (closedFlow > 0) {
      svg.appendChild(mkPath(oY, closedH, closedY, closedH, tokens.primary));
    }
    if (backlog > 0) {
      svg.appendChild(mkPath(oY + closedH, backlogH, backlogY, backlogH, tokens.muted));
    }

    // Nodes
    const mkRect = (x: number, y: number, w: number, h: number, fill: string): SVGRectElement => {
      const r = document.createElementNS(svgNS, 'rect');
      r.setAttribute('x', String(x));
      r.setAttribute('y', String(y));
      r.setAttribute('width', String(w));
      r.setAttribute('height', String(Math.max(2, h)));
      r.setAttribute('fill', fill);
      return r;
    };
    svg.appendChild(mkRect(leftX, oY, nodeW, oH, tokens.primary));
    svg.appendChild(mkRect(rightX, closedY, nodeW, Math.max(2, closedH), tokens.primary));
    svg.appendChild(mkRect(rightX, backlogY, nodeW, Math.max(2, backlogH), tokens.muted));

    const mkText = (x: number, y: number, anchor: string, fill: string, content: string): SVGTextElement => {
      const t = document.createElementNS(svgNS, 'text');
      t.setAttribute('x', String(x));
      t.setAttribute('y', String(y));
      t.setAttribute('fill', fill);
      t.setAttribute('font-size', '13');
      t.setAttribute('font-family', 'ui-sans-serif, system-ui, sans-serif');
      t.setAttribute('text-anchor', anchor);
      t.textContent = content;
      return t;
    };
    svg.appendChild(mkText(leftX - 8, oY - 8, 'end', tokens.text, `Opened (${O})`));
    svg.appendChild(mkText(rightX + nodeW + 8, closedY + Math.max(closedH, 12) / 2, 'start', tokens.text, `Closed (${closedFlow})`));
    if (backlog > 0) {
      svg.appendChild(mkText(rightX + nodeW + 8, backlogY + Math.max(backlogH, 12) / 2, 'start', tokens.muted, `Still open (${backlog})`));
    }

    mount.appendChild(svg);
  }

  private clearSankeySvg(): void {
    const canvasRef = this.chartCanvas;
    const mount = canvasRef?.nativeElement?.parentElement;
    if (!mount) return;
    const prior = mount.querySelector('.sankey-svg');
    if (prior) {
      try { prior.remove(); } catch { /* swallow */ }
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
        // Quick task 260515-kw1 -- LOLLIPOP via mixed chart:
        // bar dataset draws thin stems (barThickness 2), scatter-like point
        // dataset draws dots at the same indexes via labels-aligned data.
        // Both use the categorical x axis so no scale collision occurs.
        const series = this.latestWeeklyStars.length
          ? this.latestWeeklyStars
          : this.statsService.weeklyStarsDelta(this.latestStars);
        const counts = series.map((p) => p.count);
        return {
          type: 'bar',
          data: {
            labels: series.map((p) => p.weekStart),
            datasets: [
              {
                type: 'bar',
                label: 'Stars per week',
                data: counts,
                backgroundColor: tokens.primary,
                borderColor: tokens.primary,
                borderWidth: 0,
                barThickness: 2,
              },
              {
                type: 'scatter',
                label: 'Weekly star count',
                data: counts,
                pointRadius: 5,
                pointHoverRadius: 7,
                pointBackgroundColor: tokens.primary,
                pointBorderColor: tokens.primary,
                showLine: false,
              },
            ],
          },
          options: baseOpts,
        };
      }
      case 'issues-open-vs-closed': {
        // Quick task 260515-kw1 -- handled by renderSankeySvg() above; the
        // early-return in redrawChart() short-circuits before reaching here.
        // We still need a `case` arm so the switch is exhaustive over AnyViewId.
        return null;
      }
      case 'forks-growth': {
        // Quick task 260515-kw1 -- DUAL-AXIS: cumulative line on the left, monthly
        // bars on the right. Labels = union of both x-axis keys, sorted.
        const cumulative = this.statsService.forksGrowth(this.latestForks);
        const monthly = this.statsService.monthlyForks(this.latestForks);
        const labels = unionLabels(cumulative.map((p) => p.t), monthly.map((p) => p.t));
        return {
          type: 'bar',
          data: {
            labels,
            datasets: [
              {
                type: 'line',
                label: 'Cumulative forks',
                data: labels.map((t) => valueAt(cumulative, t)),
                borderColor: tokens.primary,
                backgroundColor: tokens.primarySoft,
                fill: false,
                tension: 0.2,
                yAxisID: 'yLeft',
                pointRadius: 0,
                borderWidth: 2,
              },
              {
                type: 'bar',
                label: 'Forks (per month bucket)',
                data: labels.map((t) => valueAt(monthly, t)),
                backgroundColor: tokens.primarySoft,
                borderColor: tokens.primary,
                borderWidth: 1,
                yAxisID: 'yRight',
              },
            ],
          },
          options: {
            ...baseOpts,
            scales: {
              x: {
                ticks: { color: tokens.muted },
                grid: { color: tokens.border },
              },
              yLeft: {
                type: 'linear',
                position: 'left',
                beginAtZero: true,
                ticks: { color: tokens.muted },
                grid: { color: tokens.border },
              },
              yRight: {
                type: 'linear',
                position: 'right',
                beginAtZero: true,
                ticks: { color: tokens.muted },
                grid: { display: false },
              },
            },
          },
        };
      }
      case 'prs-opened-vs-merged': {
        // Quick task 260515-kw1 -- STREAMGRAPH (center-baseline). Opened plots
        // positive, merged plots negative; tooltip + tick callbacks display
        // Math.abs(value) so the readout stays intuitive.
        const { opened, merged } = this.statsService.prsOpenedVsMerged(this.latestPrs);
        const labels = unionLabels(opened.map((p) => p.t), merged.map((p) => p.t));
        return {
          type: 'line',
          data: {
            labels,
            datasets: [
              {
                label: 'Opened',
                data: labels.map((t) => +valueAt(opened, t)),
                borderColor: tokens.primary,
                backgroundColor: tokens.primarySoft,
                fill: 'origin',
                tension: 0.4,
                pointRadius: 0,
              },
              {
                label: 'Merged',
                data: labels.map((t) => -valueAt(merged, t)),
                borderColor: tokens.muted,
                backgroundColor: 'rgba(148,163,184,0.18)',
                fill: 'origin',
                tension: 0.4,
                pointRadius: 0,
              },
            ],
          },
          options: {
            ...baseOpts,
            plugins: {
              ...baseOpts.plugins,
              tooltip: {
                enabled: true,
                callbacks: {
                  label: (ctx: any) => {
                    const label = ctx.dataset?.label ?? '';
                    const y = ctx.parsed?.y ?? 0;
                    return `${label}: ${Math.abs(y)}`;
                  },
                },
              },
            },
            scales: {
              x: {
                ticks: { color: tokens.muted },
                grid: { color: tokens.border },
              },
              y: {
                ticks: {
                  color: tokens.muted,
                  callback: (v: number) => Math.abs(v) === 0 ? '' : Math.abs(v).toString(),
                },
                grid: { color: tokens.border },
              },
            },
          },
        };
      }
      case 'commits-cumulative': {
        const series = this.statsService.cumulativeCommitsSeries(this.latestCommits);
        return {
          type: 'line',
          data: {
            labels: series.map((p) => p.t),
            datasets: [
              {
                label: 'Cumulative commits',
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
      case 'commits-over-time': {
        // Quick task 260515-kw1 -- PUNCHCARD via bubble chart: x = UTC hour,
        // y = UTC weekday, r = sqrt-scaled commit count (3..20 px clamp). Two
        // continuous linear axes with categorical tick callbacks.
        const points = this.statsService.commitPunchcard(this.latestCommits);
        return {
          type: 'bubble',
          data: {
            datasets: [
              {
                label: 'Commits',
                data: points,
                backgroundColor: tokens.primarySoft,
                borderColor: tokens.primary,
                borderWidth: 1,
              },
            ],
          },
          options: {
            ...baseOpts,
            plugins: {
              ...baseOpts.plugins,
              tooltip: {
                enabled: true,
                callbacks: {
                  label: (ctx: any) => {
                    const r = ctx?.raw?.r ?? 0;
                    return `Radius: ${r.toFixed?.(1) ?? r}`;
                  },
                },
              },
            },
            scales: {
              x: {
                type: 'linear',
                min: -0.5,
                max: 23.5,
                ticks: {
                  color: tokens.muted,
                  stepSize: 3,
                  callback: (v: number) => `${v}:00`,
                },
                grid: { color: tokens.border },
              },
              y: {
                type: 'linear',
                min: -0.5,
                max: 6.5,
                ticks: {
                  color: tokens.muted,
                  stepSize: 1,
                  callback: (v: number) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][v] ?? '',
                },
                grid: { color: tokens.border },
              },
            },
          },
        };
      }
      case 'maintenance': {
        // Quick task 260515-kw1 -- GANTT TIMELINE STRIP. Every point sits at
        // y=0 on a hidden y axis; x is a continuous linear timestamp. When the
        // repo has releases we plot one point per release with the tag name +
        // date in the tooltip; otherwise we fall back to commits (mirrors the
        // pre-overhaul fallback behaviour but as a strip, not a bar chart).
        const hasReleases = this.latestReleases.length > 0;
        const points = hasReleases
          ? this.latestReleases
              .filter((r) => r?.published_at && !Number.isNaN(Date.parse(r.published_at)))
              .map((r) => ({ x: Date.parse(r.published_at), y: 0, _tag: r.tag_name, _date: r.published_at }))
          : this.latestCommits
              .filter((c) => c?.commit?.author?.date && !Number.isNaN(Date.parse(c.commit.author.date)))
              .map((c) => ({ x: Date.parse(c.commit.author.date), y: 0, _sha: c.sha.slice(0, 7), _date: c.commit.author.date }));
        return {
          type: 'scatter',
          data: {
            datasets: [
              {
                label: hasReleases ? 'Releases' : 'Commits (no releases yet)',
                data: points,
                pointRadius: 6,
                pointHoverRadius: 8,
                pointBackgroundColor: tokens.primary,
                pointBorderColor: tokens.primary,
                showLine: false,
              },
            ],
          },
          options: {
            ...baseOpts,
            plugins: {
              ...baseOpts.plugins,
              tooltip: {
                enabled: true,
                callbacks: {
                  label: (ctx: any) => {
                    const raw = ctx?.raw ?? {};
                    if (raw._tag) return `${raw._tag} (${String(raw._date).slice(0, 10)})`;
                    if (raw._sha) return `${raw._sha} @ ${String(raw._date).slice(0, 10)}`;
                    return '';
                  },
                },
              },
            },
            scales: {
              x: {
                type: 'linear',
                ticks: {
                  color: tokens.muted,
                  callback: (v: number) => {
                    try { return new Date(v).toISOString().slice(0, 10); } catch { return ''; }
                  },
                },
                grid: { color: tokens.border },
              },
              y: { display: false },
            },
          },
        };
      }
      // -----------------------------------------------------------------
      // Phase 274 / STATS-01 -- 6 FSB telemetry chart views.
      // Each renders an empty axis when the data hasn't arrived yet so
      // Chart.js never crashes on null inputs.
      // -----------------------------------------------------------------
      case 'fsb-active-now': {
        // Quick task 260515-kw1 -- RADIAL HALF-DOUGHNUT GAUGE with center text.
        // `v` is the live active-users count; `max` adapts so the gauge sits
        // mid-range early on (Math.max(10, v * 2)). Half-doughnut via the
        // rotation: -90 + circumference: 180 trick; the locally-registered
        // fsbCenterText plugin draws the number in the doughnut hole.
        const v = this.latestFsbHeadline?.active_users_now ?? 0;
        const max = Math.max(10, v * 2);
        const filler = Math.max(0, max - v);
        return {
          type: 'doughnut',
          data: {
            labels: [
              $localize`:@@SHOWCASE_STATS_FSB_CHART_ACTIVE_NOW:Active users right now`,
              'Headroom',
            ],
            datasets: [
              {
                label: $localize`:@@SHOWCASE_STATS_FSB_CHART_ACTIVE_NOW_LEGEND:Active users (5 min window)`,
                data: [v, filler],
                backgroundColor: [tokens.primary, tokens.border],
                borderColor: tokens.primary,
                borderWidth: 0,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '75%',
            rotation: -90,
            circumference: 180,
            plugins: {
              legend: { display: false },
              tooltip: { enabled: false },
              fsbCenterText: { enabled: true, value: String(v), color: tokens.text },
            },
          },
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
        // Quick task 260515-kw1 -- SPARKLINE from agentHistoryRing (capped at
        // 288 samples = 24h @ 5-min poll). slice() copies so Chart.js can't
        // mutate the canonical buffer. Axes hidden so the line reads as a
        // sparkline; bucket label still appears in the legend for context.
        const headline = this.latestFsbHeadline;
        const bucket = headline?.active_agents_bucket ?? '0';
        const ring = this.agentHistoryRing.slice();
        return {
          type: 'line',
          data: {
            labels: ring.map((_, i) => String(i)),
            datasets: [
              {
                label: $localize`:@@SHOWCASE_STATS_FSB_CHART_AGENTS_RUNNING_LEGEND:Active agents (10 min window)` + ` [${bucket}]`,
                data: ring,
                borderColor: tokens.primary,
                backgroundColor: tokens.primarySoft,
                fill: true,
                tension: 0.3,
                pointRadius: 0,
                borderWidth: 2,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: { enabled: false },
            },
            scales: {
              x: { display: false },
              y: { display: false, beginAtZero: true },
            },
          },
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
