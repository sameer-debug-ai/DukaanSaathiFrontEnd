import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MatButton } from '@angular/material/button';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import type { ChartConfiguration } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import { forkJoin } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/auth/auth.service';
import type { DashboardCharts, DashboardSummary, RecentTxn } from '../../core/models/domain.models';
import { AppEvents, StockAlertsService } from '../../core/services/app-events.service';
import { DashboardApi, SettingsApi } from '../../core/services/data.services';
import { ThemeService } from '../../core/services/theme.service';
import { ToastService } from '../../core/services/toast.service';
import { baseOptions, chartColors } from '../../core/utils/chart-theme';
import { shortDay } from '../../core/utils/format';
import { formatIstDate, IstDatePipe } from '../../shared/pipes/ist-date.pipe';
import { formatPaise, InrPipe } from '../../shared/pipes/inr.pipe';
import { EmptyState } from '../../shared/components/empty-state/empty-state';
import { Skeleton } from '../../shared/components/skeleton/skeleton';
import { StatCard } from '../../shared/components/stat-card/stat-card';
import { StockBadge } from '../../shared/components/stock-badge/stock-badge';
import { SmartStockCards } from './smart-stock-cards';
import { TodayRemindersCard } from './today-reminders';

const TXN_ICON: Record<RecentTxn['kind'], { icon: string; cls: string; sign: string }> = {
  sale: { icon: 'receipt_long', cls: 'info', sign: '' },
  udhaar: { icon: 'call_made', cls: 'danger', sign: '+' },
  payment: { icon: 'call_received', cls: 'ok', sign: '-' },
  purchase: { icon: 'local_shipping', cls: 'warn', sign: '' },
  supplier_payment: { icon: 'outbound', cls: 'muted', sign: '' },
};

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink, MatButton, TranslatePipe, BaseChartDirective, InrPipe, IstDatePipe, StatCard, StockBadge, Skeleton, EmptyState, TodayRemindersCard, SmartStockCards],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Dashboard {
  private readonly api = inject(DashboardApi);
  private readonly settingsApi = inject(SettingsApi);
  private readonly theme = inject(ThemeService);
  private readonly events = inject(AppEvents);
  private readonly alerts = inject(StockAlertsService);
  private readonly toast = inject(ToastService);
  private readonly t = inject(TranslateService);
  private readonly router = inject(Router);
  protected readonly auth = inject(AuthService);

  protected readonly summary = signal<DashboardSummary | null>(null);
  protected readonly charts = signal<DashboardCharts | null>(null);
  protected readonly days = signal<7 | 30>(7);
  protected readonly loading = signal(true);
  protected readonly isEmptyShop = signal(false);
  protected readonly loadingSample = signal(false);
  /** Demo data is for trying the app locally; a live shop starts clean. */
  protected readonly canLoadSample = !environment.production;
  protected readonly today = formatIstDate(new Date());
  protected readonly txnIcon = TXN_ICON;

  private readonly colors = computed(() => chartColors(this.theme.dark()));

  protected readonly salesChart = computed<ChartConfiguration<'line'> | null>(() => {
    const ch = this.charts();
    if (!ch) return null;
    const c = this.colors();
    return {
      type: 'line',
      data: {
        labels: ch.sales.map((s) => shortDay(s.day)),
        datasets: [
          {
            label: this.t.instant('dashboard.sales'),
            data: ch.sales.map((s) => s.total),
            borderColor: c.series1,
            backgroundColor: c.series1Wash,
            borderWidth: 2,
            fill: true,
            tension: 0.3,
            pointRadius: ch.sales.length > 10 ? 0 : 4,
            pointHoverRadius: 6,
            pointBackgroundColor: c.series1,
            pointBorderColor: c.surface,
            pointBorderWidth: 2,
            borderCapStyle: 'round',
            borderJoinStyle: 'round',
          },
        ],
      },
      options: baseOptions(c) as ChartConfiguration<'line'>['options'],
    };
  });

  protected readonly topChart = computed<ChartConfiguration<'bar'> | null>(() => {
    const ch = this.charts();
    if (!ch) return null;
    const c = this.colors();
    return {
      type: 'bar',
      data: {
        labels: ch.topProducts.map((p) => (p.name.length > 18 ? `${p.name.slice(0, 17)}…` : p.name)),
        datasets: [
          {
            label: this.t.instant('dashboard.sales'),
            data: ch.topProducts.map((p) => p.total),
            backgroundColor: c.series1,
            hoverBackgroundColor: c.series1,
            maxBarThickness: 22,
            borderRadius: { topRight: 4, bottomRight: 4, topLeft: 0, bottomLeft: 0 },
            borderSkipped: false,
          },
        ],
      },
      options: baseOptions(c, { horizontal: true }) as ChartConfiguration<'bar'>['options'],
    };
  });

  protected readonly udhaarChart = computed<ChartConfiguration<'bar'> | null>(() => {
    const ch = this.charts();
    if (!ch) return null;
    const c = this.colors();
    const radius = { topLeft: 4, topRight: 4, bottomLeft: 0, bottomRight: 0 };
    return {
      type: 'bar',
      data: {
        labels: ch.udhaar.map((u) => shortDay(u.day)),
        datasets: [
          { label: this.t.instant('dashboard.udhaarGiven'), data: ch.udhaar.map((u) => u.given), backgroundColor: c.series1, maxBarThickness: 16, borderRadius: radius, borderSkipped: false },
          { label: this.t.instant('dashboard.recovered'), data: ch.udhaar.map((u) => u.recovered), backgroundColor: c.series2, maxBarThickness: 16, borderRadius: radius, borderSkipped: false },
        ],
      },
      options: { ...(baseOptions(c, { legend: true }) as ChartConfiguration<'bar'>['options']), datasets: { bar: { categoryPercentage: 0.7, barPercentage: 0.9 } } },
    };
  });

  protected readonly chartTotals = computed(() => {
    const ch = this.charts();
    if (!ch) return null;
    const sales = ch.sales.reduce((s, x) => s + x.total, 0);
    const given = ch.udhaar.reduce((s, x) => s + x.given, 0);
    const recovered = ch.udhaar.reduce((s, x) => s + x.recovered, 0);
    return { sales: formatPaise(sales), given: formatPaise(given), recovered: formatPaise(recovered) };
  });

  constructor() {
    effect(() => {
      this.events.version();
      untracked(() => this.load());
    });
  }

  protected setDays(d: 7 | 30): void {
    this.days.set(d);
    this.api.charts(d).subscribe({ next: (c) => this.charts.set(c), error: (e) => this.toast.apiError(e) });
  }

  protected load(): void {
    forkJoin({ summary: this.api.summary(), charts: this.api.charts(this.days()), counts: this.settingsApi.counts() }).subscribe({
      next: ({ summary, charts, counts }) => {
        this.summary.set(summary);
        this.charts.set(charts);
        this.isEmptyShop.set(counts.isEmpty);
        this.loading.set(false);
      },
      error: (e) => {
        this.loading.set(false);
        this.toast.apiError(e);
      },
    });
  }

  protected loadSample(): void {
    this.loadingSample.set(true);
    this.settingsApi.loadSample().subscribe({
      next: () => {
        this.loadingSample.set(false);
        this.toast.success('dashboard.sampleLoaded');
        this.alerts.refresh();
        this.events.changed('any');
      },
      error: (e) => {
        this.loadingSample.set(false);
        this.toast.apiError(e);
      },
    });
  }

  protected reorder(productId: string, supplierId?: string): void {
    void this.router.navigate(['/purchases/new'], { queryParams: { productId, supplierId } });
  }

  protected initials(name: string): string {
    return name
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? '')
      .join('');
  }
}
