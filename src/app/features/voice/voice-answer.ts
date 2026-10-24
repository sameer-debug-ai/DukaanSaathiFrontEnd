import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type { VoiceAnswerData } from '../../core/models/domain.models';
import { StockBadge } from '../../shared/components/stock-badge/stock-badge';
import { InrPipe } from '../../shared/pipes/inr.pipe';

/** Renders a voice question's answer as a list / card instead of a paragraph. */
@Component({
  selector: 'app-voice-answer',
  imports: [TranslatePipe, InrPipe, StockBadge],
  templateUrl: './voice-answer.html',
  styleUrl: './voice-answer.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VoiceAnswer {
  readonly data = input.required<VoiceAnswerData>();
  readonly message = input('');
  /** Route to open (the panel navigates and closes). */
  readonly open = output<string[]>();

  protected readonly stock = computed(() => {
    const d = this.data();
    if (d.kind !== 'stock_list') return null;
    return {
      ...d,
      out: d.items.filter((i) => i.status === 'out'),
      low: d.onlyOut ? [] : d.items.filter((i) => i.status === 'low'),
    };
  });
}
