import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type { StockStatus } from '../../../core/models/domain.models';

/** In stock (green) / Low stock (orange) / Out of stock (red), always with an icon + label. */
@Component({
  selector: 'app-stock-badge',
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="ds-badge" [class]="'ds-badge ' + view().cls">
      <span class="material-symbols-outlined" aria-hidden="true">{{ view().icon }}</span>
      {{ view().key | translate }}
    </span>
  `,
})
export class StockBadge {
  readonly status = input.required<StockStatus>();
  protected readonly view = computed(() => {
    switch (this.status()) {
      case 'out':
        return { cls: 'danger', icon: 'block', key: 'stock.out' };
      case 'low':
        return { cls: 'warn', icon: 'warning', key: 'stock.low' };
      default:
        return { cls: 'ok', icon: 'check_circle', key: 'stock.in' };
    }
  });
}
