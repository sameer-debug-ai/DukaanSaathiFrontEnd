import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

/**
 * Other names a customer/product/supplier answers to (typed in, or learned from the voice
 * assistant), each removable. Removing only emits; the page saves.
 */
@Component({
  selector: 'app-alias-chips',
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="head">
      <span class="material-symbols-outlined" aria-hidden="true">record_voice_over</span>
      <span class="title">{{ 'aliases.title' | translate }}</span>
    </div>
    @if (aliases().length) {
      <ul class="chips">
        @for (a of aliases(); track a) {
          <li class="chip">
            <span>{{ a }}</span>
            <button type="button" (click)="remove.emit(a)" [disabled]="busy()" [attr.aria-label]="'aliases.remove' | translate: { name: a }">
              <span class="material-symbols-outlined" aria-hidden="true">close</span>
            </button>
          </li>
        }
      </ul>
    } @else {
      <p class="empty">{{ 'aliases.empty' | translate }}</p>
    }
  `,
  styles: `
    :host { display: block; }
    .head { display: flex; align-items: center; gap: 6px; margin-bottom: 8px; color: var(--ds-muted); }
    .head .material-symbols-outlined { font-size: 18px; color: var(--ds-brand); }
    .title { font-size: 0.8rem; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; }
    .chips { display: flex; flex-wrap: wrap; gap: 8px; margin: 0; padding: 0; list-style: none; }
    .chip {
      display: inline-flex; align-items: center; gap: 2px; height: 32px; padding: 0 4px 0 12px;
      border-radius: 999px; background: var(--ds-brand-soft); color: var(--ds-brand); font-size: 0.9rem; font-weight: 500;
    }
    .chip button {
      display: grid; place-items: center; width: 26px; height: 26px; border: 0; border-radius: 50%;
      background: transparent; color: inherit; cursor: pointer;
    }
    .chip button:hover { background: rgb(0 0 0 / 0.08); }
    .chip button:disabled { opacity: 0.5; cursor: progress; }
    .chip .material-symbols-outlined { font-size: 16px; }
    .empty { margin: 0; font-size: 0.85rem; color: var(--ds-muted); }
  `,
})
export class AliasChips {
  readonly aliases = input<string[]>([]);
  readonly busy = input(false);
  readonly remove = output<string>();
}
