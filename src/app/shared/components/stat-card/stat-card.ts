import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

export type StatTone = 'brand' | 'ok' | 'danger' | 'warn' | 'neutral';

/** KPI tile: label · value · optional hint. Tone colors the icon chip only; text stays in ink tokens. */
@Component({
  selector: 'app-stat-card',
  imports: [RouterLink, NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (link()) {
      <a [routerLink]="link()" [queryParams]="query()" class="tile ds-card" [attr.aria-label]="label() + ': ' + value()">
        <ng-container *ngTemplateOutlet="body" />
      </a>
    } @else {
      <div class="tile ds-card"><ng-container *ngTemplateOutlet="body" /></div>
    }
    <ng-template #body>
      <span class="icon" [class]="'tone-' + tone()" aria-hidden="true">
        <span class="material-symbols-outlined">{{ icon() }}</span>
      </span>
      <span class="label">{{ label() }}</span>
      <span class="value">{{ value() }}</span>
      @if (hint()) {
        <span class="hint">{{ hint() }}</span>
      }
    </ng-template>
  `,
  styles: `
    :host { display: block; min-width: 0; }
    /* Icon + label on the first row, value full-width below: never squeezes the number. */
    .tile {
      display: grid; grid-template-columns: auto minmax(0, 1fr); grid-template-rows: auto auto auto; align-items: center;
      column-gap: 10px; row-gap: 6px; padding: 14px; height: 100%; box-sizing: border-box;
      color: inherit; text-decoration: none;
    }
    a.tile:hover { border-color: var(--ds-brand); }
    .icon {
      width: 36px; height: 36px; border-radius: 10px; display: grid; place-items: center;
    }
    .icon .material-symbols-outlined { font-size: 20px; }
    .value, .hint { grid-column: 1 / -1; }
    .tone-brand { background: var(--ds-brand-soft); color: var(--ds-brand); }
    .tone-ok { background: var(--ds-ok-soft); color: var(--ds-ok); }
    .tone-danger { background: var(--ds-danger-soft); color: var(--ds-danger); }
    .tone-warn { background: var(--ds-warn-soft); color: var(--ds-warn); }
    .tone-neutral { background: var(--ds-surface); color: var(--ds-muted); }
    .label { font-size: 0.82rem; color: var(--ds-muted); line-height: 1.3; }
    /* Values never truncate: big rupee amounts shrink on narrow tiles and may wrap. */
    .value { font-size: 1.35rem; font-weight: 650; line-height: 1.25; overflow-wrap: anywhere; }
    .label, .value, .hint { min-width: 0; }
    .hint { font-size: 0.78rem; color: var(--ds-muted); }
  `,
  host: { class: 'stat-card' },
})
export class StatCard {
  readonly label = input.required<string>();
  readonly value = input.required<string>();
  readonly icon = input<string>('payments');
  readonly tone = input<StatTone>('brand');
  readonly hint = input<string>('');
  readonly link = input<string | null>(null);
  readonly query = input<Record<string, string> | null>(null);
}
