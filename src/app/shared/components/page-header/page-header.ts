import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconButton } from '@angular/material/button';

/** Page title row with optional back link and projected action buttons. */
@Component({
  selector: 'app-page-header',
  imports: [RouterLink, MatIconButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="flex items-center gap-2 mb-4 min-h-12">
      @if (backLink()) {
        <a mat-icon-button [routerLink]="backLink()" [attr.aria-label]="backLabel()">
          <span class="material-symbols-outlined">arrow_back</span>
        </a>
      }
      <div class="flex-1 min-w-0">
        <h1 class="text-xl sm:text-2xl font-semibold truncate m-0">{{ title() }}</h1>
        @if (subtitle()) {
          <p class="text-sm text-muted m-0 truncate">{{ subtitle() }}</p>
        }
      </div>
      <div class="flex items-center gap-2 shrink-0">
        <ng-content />
      </div>
    </header>
  `,
})
export class PageHeader {
  readonly title = input.required<string>();
  readonly subtitle = input<string>('');
  readonly backLink = input<string | unknown[] | null>(null);
  readonly backLabel = input<string>('Back');
}
