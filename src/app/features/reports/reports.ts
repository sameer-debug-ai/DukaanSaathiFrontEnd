import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import type { ChartConfiguration } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import type { Report, ReportName } from '../../core/models/domain.models';
import { ReportsApi } from '../../core/services/data.services';
import { PdfService } from '../../core/services/pdf.service';
import { ShareService } from '../../core/services/share.service';
import { ThemeService } from '../../core/services/theme.service';
import { ToastService } from '../../core/services/toast.service';
import { baseOptions, chartColors } from '../../core/utils/chart-theme';
import { daysAgo, istDay, shortDay } from '../../core/utils/format';
import { DateRange, type DateRangeValue } from '../../shared/components/date-range/date-range';
import { EmptyState } from '../../shared/components/empty-state/empty-state';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { Skeleton } from '../../shared/components/skeleton/skeleton';
import { StatCard, type StatTone } from '../../shared/components/stat-card/stat-card';
import { formatPaise } from '../../shared/pipes/inr.pipe';
import { formatIstDate } from '../../shared/pipes/ist-date.pipe';

const REPORTS: { id: ReportName; key: string; icon: string; ranged: boolean }[] = [
  { id: 'sales', key: 'reports.sales', icon: 'payments', ranged: true },
  { id: 'profit', key: 'reports.profit', icon: 'trending_up', ranged: true },
  { id: 'udhaar', key: 'reports.udhaar', icon: 'menu_book', ranged: true },
  { id: 'supplier-purchases', key: 'reports.supplier', icon: 'local_shipping', ranged: true },
  { id: 'product-sales', key: 'reports.productSales', icon: 'shopping_bag', ranged: true },
  { id: 'stock-valuation', key: 'reports.stock', icon: 'inventory', ranged: false },
  { id: 'aging', key: 'reports.aging', icon: 'hourglass_bottom', ranged: false },
];

/** Headline tiles per report, picked from the report totals. */
const TILES: Record<ReportName, { key: string; total: string; tone: StatTone; icon: string; kind?: 'number' | 'percent' }[]> = {
  sales: [
    { key: 'reports.t.total', total: 'total', tone: 'brand', icon: 'payments' },
    { key: 'reports.t.bills', total: 'bills', tone: 'neutral', icon: 'receipt_long', kind: 'number' },
    { key: 'reports.t.cashUpi', total: 'cashUpi', tone: 'ok', icon: 'account_balance_wallet' },
    { key: 'reports.t.udhaar', total: 'credit', tone: 'danger', icon: 'call_made' },
  ],
  profit: [
    { key: 'reports.t.revenue', total: 'revenue', tone: 'brand', icon: 'payments' },
    { key: 'reports.t.cost', total: 'cost', tone: 'neutral', icon: 'shopping_cart' },
    { key: 'reports.t.profit', total: 'profit', tone: 'ok', icon: 'trending_up' },
    { key: 'reports.t.margin', total: 'margin', tone: 'brand', icon: 'percent', kind: 'percent' },
  ],
  udhaar: [
    { key: 'reports.t.given', total: 'given', tone: 'danger', icon: 'call_made' },
    { key: 'reports.t.received', total: 'received', tone: 'ok', icon: 'call_received' },
    { key: 'reports.t.outstanding', total: 'balance', tone: 'warn', icon: 'menu_book' },
  ],
  'supplier-purchases': [
    { key: 'reports.t.goods', total: 'total', tone: 'brand', icon: 'inventory' },
    { key: 'reports.t.paid', total: 'paid', tone: 'ok', icon: 'payments' },
    { key: 'reports.t.payable', total: 'payable', tone: 'warn', icon: 'account_balance_wallet' },
  ],
  'product-sales': [
    { key: 'reports.t.revenue', total: 'revenue', tone: 'brand', icon: 'payments' },
    { key: 'reports.t.profit', total: 'profit', tone: 'ok', icon: 'trending_up' },
  ],
  'stock-valuation': [
    { key: 'reports.t.atCost', total: 'costValue', tone: 'brand', icon: 'inventory' },
    { key: 'reports.t.atSale', total: 'saleValue', tone: 'ok', icon: 'sell' },
  ],
  aging: [
    { key: 'reports.t.outstanding', total: 'balance', tone: 'warn', icon: 'menu_book' },
    { key: 'reports.t.d31_60', total: 'd31_60', tone: 'warn', icon: 'schedule' },
    { key: 'reports.t.d61_90', total: 'd61_90', tone: 'danger', icon: 'hourglass_bottom' },
    { key: 'reports.t.d90_plus', total: 'd90_plus', tone: 'danger', icon: 'error' },
  ],
};

@Component({
  selector: 'app-reports',
  imports: [MatButton, TranslatePipe, BaseChartDirective, PageHeader, DateRange, Skeleton, EmptyState, StatCard],
  templateUrl: './reports.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Reports implements OnInit {
  private readonly api = inject(ReportsApi);
  private readonly pdf = inject(PdfService);
  private readonly share = inject(ShareService);
  private readonly toast = inject(ToastService);
  private readonly theme = inject(ThemeService);
  private readonly t = inject(TranslateService);

  protected readonly reports = REPORTS;
  protected readonly active = signal<ReportName>('sales');
  protected readonly report = signal<Report | null>(null);
  protected readonly loading = signal(true);
  protected readonly range = signal<DateRangeValue>({ from: daysAgo(29), to: istDay() });
  protected readonly ranged = computed(() => REPORTS.find((r) => r.id === this.active())!.ranged);
  protected readonly activeKey = computed(() => REPORTS.find((r) => r.id === this.active())!.key);

  protected readonly tiles = computed(() => {
    const r = this.report();
    if (!r) return [];
    const totals = { ...r.totals, cashUpi: (r.totals['cash'] ?? 0) + (r.totals['upi'] ?? 0) };
    return TILES[this.active()].map((t) => {
      const v = totals[t.total as keyof typeof totals] ?? 0;
      return { ...t, value: t.kind === 'number' ? String(v) : t.kind === 'percent' ? `${v}%` : formatPaise(v) };
    });
  });

  protected readonly chart = computed<ChartConfiguration | null>(() => {
    const r = this.report();
    if (!r?.chart || !r.chart.labels.length) return null;
    const c = chartColors(this.theme.dark());
    const colors = [c.series1, c.series2];
    const isDaily = r.chart.labels[0]?.match(/^\d{4}-\d{2}-\d{2}$/);
    const horizontal = !isDaily;
    return {
      type: 'bar',
      data: {
        labels: r.chart.labels.map((l) => (isDaily ? shortDay(l) : l.length > 18 ? `${l.slice(0, 17)}…` : l)),
        datasets: r.chart.series.map((s, i) => ({
          label: this.t.instant(`reports.series.${s.label}`),
          data: s.data,
          backgroundColor: colors[i % 2],
          maxBarThickness: horizontal ? 22 : 18,
          borderRadius: horizontal ? { topRight: 4, bottomRight: 4, topLeft: 0, bottomLeft: 0 } : { topLeft: 4, topRight: 4, bottomLeft: 0, bottomRight: 0 },
          borderSkipped: false,
        })),
      },
      options: baseOptions(c, { horizontal, legend: r.chart.series.length > 1 }),
    } as ChartConfiguration;
  });

  ngOnInit(): void {
    this.load();
  }

  protected select(id: ReportName): void {
    this.active.set(id);
    this.load();
  }

  protected setRange(r: DateRangeValue): void {
    this.range.set(r);
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    const { from, to } = this.ranged() ? this.range() : { from: undefined, to: undefined };
    this.api.get(this.active(), from, to).subscribe({
      next: (r) => {
        this.report.set(r);
        this.loading.set(false);
      },
      error: (e) => {
        this.loading.set(false);
        this.toast.apiError(e);
      },
    });
  }

  protected cell(type: string, v: unknown): string {
    if (type === 'money') return formatPaise(Number(v) || 0);
    if (type === 'date') return formatIstDate(String(v));
    return v === null || v === undefined || v === '' ? '—' : String(v);
  }

  protected exportCsv(): void {
    const { from, to } = this.ranged() ? this.range() : { from: undefined, to: undefined };
    this.api.csv(this.active(), from, to).subscribe({
      next: (blob) => this.share.download(blob, `${this.active()}-${from ?? istDay()}-${to ?? istDay()}.csv`),
      error: (e) => this.toast.apiError(e),
    });
  }

  protected async exportPdf(): Promise<void> {
    const r = this.report();
    if (!r) return;
    const file = await this.pdf.report(r);
    this.share.download(file, file.name);
  }
}
