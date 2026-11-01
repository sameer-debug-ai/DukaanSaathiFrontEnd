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
      <span class="label" [attr.title]="label()">{{ label() }}</span>
      <span class="value">{{ value() }}</span>
      <!-- Always present (empty when there's no hint) so every tile has the same height. -->
      <span class="hint" [attr.aria-hidden]="hint() ? null : 'true'">{{ hint() }}</span>
    </ng-template>
  `,
  styles: `
    :host { display: block; min-width: 0; }
    /* Icon + label on the first row, value full-width below: never squeezes the number. */
    /* Fixed rows: the label row is always two lines tall and the hint row always exists, so icons, values
       and hints sit at the same height in every tile of a grid. */
    .tile {
      display: grid; grid-template-columns: auto minmax(0, 1fr); grid-template-rows: 2.6em auto 1.3em; align-items: center;
      column-gap: 10px; row-gap: 8px; padding: 16px; height: 100%; min-height: 124px; box-sizing: border-box;
      color: inherit; text-decoration: none;
      transition: border-color var(--ds-dur-fast) var(--ds-ease), box-shadow var(--ds-dur-fast) var(--ds-ease);
    }
    a.tile:hover { border-color: var(--ds-brand-300); box-shadow: var(--ds-shadow-sm); }
    .icon {
      width: 36px; height: 36px; border-radius: var(--ds-radius-sm); display: grid; place-items: center; align-self: center;
    }
    .icon .material-symbols-outlined { font-size: 20px; }
    .value, .hint { grid-column: 1 / -1; }
    .tone-brand { background: var(--ds-brand-soft); color: var(--ds-brand); }
    .tone-ok { background: var(--ds-ok-soft); color: var(--ds-ok); }
    .tone-danger { background: var(--ds-danger-soft); color: var(--ds-danger); }
    .tone-warn { background: var(--ds-warn-soft); color: var(--ds-warn); }
    .tone-neutral { background: var(--ds-surface); color: var(--ds-muted); }
    /* Up to two lines, then "…" (full text is in the tile's aria-label / title). */
    .label {
      font-size: 0.82rem; font-weight: 500; color: var(--ds-muted); line-height: 1.3;
      display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
    }
    /* Values never truncate: big rupee amounts may wrap. */
    .value {
      font-size: 1.4rem; font-weight: 700; line-height: 1.2; letter-spacing: -0.01em; color: var(--ds-text-strong);
      overflow-wrap: anywhere; font-variant-numeric: tabular-nums; align-self: end;
    }
    .label, .value, .hint { min-width: 0; }
    .hint { font-size: 0.78rem; color: var(--ds-muted); align-self: start; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    @media (max-width: 420px) {
      .tile { padding: 12px; min-height: 0; row-gap: 6px; }
      .value { font-size: 1.25rem; }
    }
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
