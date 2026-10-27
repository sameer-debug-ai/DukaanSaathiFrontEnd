import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type { ChartConfiguration } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import type { VoiceAnalyticsData, VoiceAnswerData } from '../../core/models/domain.models';
import { ThemeService } from '../../core/services/theme.service';
import { baseOptions, chartColors } from '../../core/utils/chart-theme';
import { shortDay } from '../../core/utils/format';
import { StockBadge } from '../../shared/components/stock-badge/stock-badge';
import { InrPipe, formatPaise } from '../../shared/pipes/inr.pipe';

const DAY_RX = /^\d{4}-\d{2}-\d{2}$/;

/** Renders a voice question's answer as a list / card instead of a paragraph. */
@Component({
  selector: 'app-voice-answer',
  imports: [TranslatePipe, InrPipe, StockBadge, BaseChartDirective],
  templateUrl: './voice-answer.html',
  styleUrl: './voice-answer.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VoiceAnswer {
  readonly data = input.required<VoiceAnswerData>();
  readonly message = input('');
  /** Route to open (the panel navigates and closes). */
  readonly open = output<string[]>();
  private readonly theme = inject(ThemeService);

  protected readonly stock = computed(() => {
    const d = this.data();
    if (d.kind !== 'stock_list') return null;
    return {
      ...d,
      out: d.items.filter((i) => i.status === 'out'),
      low: d.onlyOut ? [] : d.items.filter((i) => i.status === 'low'),
    };
  });

  protected readonly analytics = computed<VoiceAnalyticsData | null>(() => {
    const d = this.data();
    return d.kind === 'analytics' ? d : null;
  });

  /** Names as horizontal bars (the list reads top to bottom); days or a before/after pair as columns. */
  private readonly horizontal = computed(() => {
    const labels = this.analytics()?.chart?.labels ?? [];
    return labels.length > 2 && !DAY_RX.test(labels[0] ?? '');
  });

  /** Small bar chart for analytics answers. */
  protected readonly chart = computed<ChartConfiguration | null>(() => {
    const a = this.analytics();
    if (!a?.chart || a.chart.labels.length < 2) return null;
    const c = chartColors(this.theme.dark());
    const daily = DAY_RX.test(a.chart.labels[0] ?? '');
    const horizontal = this.horizontal();
    return {
      type: 'bar',
      data: {
        labels: a.chart.labels.map((l) => (daily ? shortDay(l) : l.length > 16 ? `${l.slice(0, 15)}…` : l)),
        datasets: [
          {
            label: '',
            data: a.chart.data,
            backgroundColor: c.series1,
            maxBarThickness: horizontal ? 18 : 28,
            borderRadius: horizontal ? { topRight: 4, bottomRight: 4, topLeft: 0, bottomLeft: 0 } : { topLeft: 4, topRight: 4, bottomLeft: 0, bottomRight: 0 },
            borderSkipped: false,
          },
        ],
      },
      options: baseOptions(c, { horizontal }),
    } as ChartConfiguration;
  });

  /** Chart height grows with the number of horizontal bars. */
  protected readonly chartHeight = computed(() => (this.horizontal() ? 36 + (this.analytics()?.chart?.labels.length ?? 0) * 30 : 170));

  protected cell(row: Record<string, unknown>, col: VoiceAnalyticsData['columns'][number]): string {
    const v = row[col.key];
    if (v === null || v === undefined || v === '') return '–';
    if (col.type === 'money') return formatPaise(Number(v), { sign: col.key === 'change' });
    if (col.type === 'date') return shortDay(String(v));
    return String(v);
  }

  protected sign(row: Record<string, unknown>, key: string): number {
    return key === 'change' ? Math.sign(Number(row[key]) || 0) : 0;
  }

  /** Customer rows open that customer's khata. */
  protected rowLink(a: VoiceAnalyticsData, row: Record<string, unknown>): string[] | null {
    return (a.fn === 'top_debtors' || a.fn === 'inactive_debtors') && typeof row['id'] === 'string' ? ['/customers', row['id']] : null;
  }
}
