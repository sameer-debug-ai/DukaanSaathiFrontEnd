import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconButton } from '@angular/material/button';

/** Page title row with optional back link and projected action buttons. */
@Component({
  selector: 'app-page-header',
  imports: [RouterLink, MatIconButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Wraps on phones: when the actions don't fit beside the title they move to the next line
         instead of squeezing the title down to "R…". -->
    <header class="ph">
      @if (backLink()) {
        <a mat-icon-button class="back" [routerLink]="backLink()" [attr.aria-label]="backLabel()">
          <span class="material-symbols-outlined">arrow_back</span>
        </a>
      }
      <div class="titles">
        <h1 [attr.title]="title()">{{ title() }}</h1>
        @if (subtitle()) {
          <p [attr.title]="subtitle()">{{ subtitle() }}</p>
        }
      </div>
      <div class="actions">
        <ng-content />
      </div>
    </header>
  `,
  styles: `
    .ph { display: flex; flex-wrap: wrap; align-items: center; gap: 12px 8px; margin-bottom: 20px; min-height: 48px; }
    .back { flex-shrink: 0; margin-left: -6px; }
    .titles { flex: 1 1 9rem; min-width: 0; }
    h1 {
      margin: 0; font-size: var(--ds-text-xl); font-weight: 700; line-height: 1.25; letter-spacing: -0.01em;
      color: var(--ds-text-strong); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    p { margin: 2px 0 0; font-size: var(--ds-text-sm); color: var(--ds-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .actions { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-left: auto; }
    .actions:empty { display: none; }
    @media (min-width: 640px) { h1 { font-size: var(--ds-text-2xl); } }
  `,
})
export class PageHeader {
  readonly title = input.required<string>();
  readonly subtitle = input<string>('');
  readonly backLink = input<string | unknown[] | null>(null);
  readonly backLabel = input<string>('Back');
}
