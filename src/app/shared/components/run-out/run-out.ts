import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type { StockForecast } from '../../../core/models/domain.models';

export type RunOutTone = 'danger' | 'warn' | 'muted';

/** Label + colour for "~X din mein khatam hoga"; null when the item is not selling. */
export function runOutView(daysLeft: number | null | undefined): { key: string; days: number; tone: RunOutTone } | null {
  if (daysLeft === null || daysLeft === undefined) return null;
  const tone: RunOutTone = daysLeft <= 3 ? 'danger' : daysLeft <= 7 ? 'warn' : 'muted';
  return { key: daysLeft === 0 ? 'smart.runOutToday' : 'smart.runOutIn', days: daysLeft, tone };
}

/** "~X din mein khatam hoga" from the selling-rate forecast (red within 3 days, orange within 7). */
@Component({
  selector: 'app-run-out',
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (view(); as v) {
      <span class="ro" [class]="'ro ' + v.tone">
        <span class="material-symbols-outlined" aria-hidden="true">hourglass_bottom</span>
        {{ v.key | translate: { days: v.days } }}
      </span>
    }
  `,
  styles: `
    .ro { display: inline-flex; align-items: center; gap: 3px; font-size: 0.8rem; font-weight: 500; white-space: nowrap; }
    .ro .material-symbols-outlined { font-size: 15px; }
    .danger { color: var(--ds-danger); }
    .warn { color: var(--ds-warn); }
    .muted { color: var(--ds-muted); }
  `,
})
export class RunOutLabel {
  readonly forecast = input<StockForecast | null | undefined>();
  /** Out-of-stock items already show a badge; no forecast line for them. */
  readonly stock = input<number | null>(null);
  protected readonly view = computed(() => {
    const s = this.stock();
    if (s !== null && s <= 0) return null;
    return runOutView(this.forecast()?.daysLeft);
  });
}
