import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type { CreditScore } from '../../../core/models/domain.models';

/** Good (green) / Average (orange) / Risky (red) / New (grey), always with an icon + label. */
@Component({
  selector: 'app-credit-badge',
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (credit(); as c) {
      <span
        class="ds-badge"
        [class]="'ds-badge ' + view().cls"
        [attr.title]="c.score === null ? null : ('credit.scoreTitle' | translate: { score: c.score, pct: c.recoveredPct })"
      >
        <span class="material-symbols-outlined" aria-hidden="true">{{ view().icon }}</span>
        {{ 'credit.badge.' + c.badge | translate }}
        @if (showScore() && c.score !== null) {
          <span class="tabular">· {{ c.score }}</span>
        }
      </span>
    }
  `,
})
export class CreditBadgeComponent {
  readonly credit = input<CreditScore | undefined>();
  readonly showScore = input(false);
  protected readonly view = computed(() => {
    switch (this.credit()?.badge) {
      case 'good':
        return { cls: 'ok', icon: 'verified' };
      case 'average':
        return { cls: 'warn', icon: 'schedule' };
      case 'risky':
        return { cls: 'danger', icon: 'error' };
      default:
        return { cls: 'muted', icon: 'fiber_new' };
    }
  });
}
