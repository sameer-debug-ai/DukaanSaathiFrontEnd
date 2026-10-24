import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Friendly placeholder for empty lists, with a hint and optional projected action. */
@Component({
  selector: 'app-empty-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col items-center text-center gap-2 py-10 px-4">
      <span class="material-symbols-outlined text-muted" style="font-size: 56px" aria-hidden="true">{{ icon() }}</span>
      <h2 class="text-lg font-semibold m-0">{{ title() }}</h2>
      @if (hint()) {
        <p class="text-muted m-0 max-w-sm">{{ hint() }}</p>
      }
      <div class="mt-3"><ng-content /></div>
    </div>
  `,
})
export class EmptyState {
  readonly icon = input<string>('inventory_2');
  readonly title = input.required<string>();
  readonly hint = input<string>('');
}
