import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { daysAgo, istDay } from '../../../core/utils/format';

export interface DateRangeValue {
  from: string;
  to: string;
}

type Preset = 'today' | '7d' | '30d' | 'month' | '90d' | 'custom';

/** Preset chips (Today / 7 days / 30 days / This month / 90 days) plus a custom from-to range. */
@Component({
  selector: 'app-date-range',
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="wrap">
      <div class="ds-chips" role="group" [attr.aria-label]="'range.label' | translate">
        @for (p of presets; track p.id) {
          <button type="button" class="ds-chip" [class.active]="preset() === p.id" (click)="choose(p.id)">{{ p.key | translate }}</button>
        }
      </div>
      @if (preset() === 'custom') {
        <div class="custom">
          <label>
            <span>{{ 'range.from' | translate }}</span>
            <input type="date" [value]="from()" [max]="to()" (change)="setFrom($any($event.target).value)" />
          </label>
          <label>
            <span>{{ 'range.to' | translate }}</span>
            <input type="date" [value]="to()" [min]="from()" [max]="today" (change)="setTo($any($event.target).value)" />
          </label>
        </div>
      }
    </div>
  `,
  styles: `
    .wrap { display: flex; flex-direction: column; gap: 10px; }
    .custom { display: flex; gap: 10px; flex-wrap: wrap; }
    label { display: flex; flex-direction: column; gap: 4px; font-size: 0.8rem; color: var(--ds-muted); flex: 1; min-width: 140px; }
    input { height: 44px; border-radius: 12px; border: 1px solid var(--ds-line); background: var(--ds-card); color: var(--ds-text); padding: 0 10px; font: inherit; }
  `,
})
export class DateRange {
  readonly initial = input<Preset>('30d');
  readonly rangeChange = output<DateRangeValue>();

  protected readonly today = istDay();
  protected readonly presets: { id: Preset; key: string }[] = [
    { id: 'today', key: 'range.today' },
    { id: '7d', key: 'range.7d' },
    { id: '30d', key: 'range.30d' },
    { id: 'month', key: 'range.month' },
    { id: '90d', key: 'range.90d' },
    { id: 'custom', key: 'range.custom' },
  ];
  protected readonly preset = signal<Preset>('30d');
  protected readonly from = signal(daysAgo(29));
  protected readonly to = signal(istDay());
  readonly value = computed<DateRangeValue>(() => ({ from: this.from(), to: this.to() }));

  ngOnInit(): void {
    this.choose(this.initial(), false);
  }

  protected choose(p: Preset, emit = true): void {
    this.preset.set(p);
    const today = istDay();
    if (p === 'today') this.set(today, today);
    if (p === '7d') this.set(daysAgo(6), today);
    if (p === '30d') this.set(daysAgo(29), today);
    if (p === '90d') this.set(daysAgo(89), today);
    if (p === 'month') this.set(`${today.slice(0, 8)}01`, today);
    if (emit && p !== 'custom') this.rangeChange.emit(this.value());
  }

  protected setFrom(v: string): void {
    if (!v) return;
    this.from.set(v);
    this.rangeChange.emit(this.value());
  }

  protected setTo(v: string): void {
    if (!v) return;
    this.to.set(v);
    this.rangeChange.emit(this.value());
  }

  private set(from: string, to: string): void {
    this.from.set(from);
    this.to.set(to);
  }
}
