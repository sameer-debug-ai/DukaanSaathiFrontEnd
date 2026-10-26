import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** DukaanSathi mark: a storefront with a striped awning and a rupee badge, plus an optional wordmark. */
@Component({
  selector: 'app-logo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg class="mark" [attr.width]="size()" [attr.height]="size()" viewBox="0 0 64 64" role="img" aria-label="DukaanSathi">
      <defs>
        <linearGradient [attr.id]="gid" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#2b7bd3" />
          <stop offset="1" stop-color="#123f78" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" [attr.fill]="'url(#' + gid + ')'" />
      <path d="M13 22 L17.5 13 H46.5 L51 22 Z" fill="#fff" />
      <path d="M13 22 h9.5 v3.5 a4.75 4.75 0 0 1 -9.5 0 z" fill="#f59e0b" />
      <path d="M22.5 22 h9.5 v3.5 a4.75 4.75 0 0 1 -9.5 0 z" fill="#fff" />
      <path d="M32 22 h9.5 v3.5 a4.75 4.75 0 0 1 -9.5 0 z" fill="#f59e0b" />
      <path d="M41.5 22 h9.5 v3.5 a4.75 4.75 0 0 1 -9.5 0 z" fill="#fff" />
      <rect x="16" y="32" width="32" height="20" rx="2.5" fill="#fff" />
      <rect x="20" y="36" width="7" height="6" rx="1.2" fill="#1e5fa8" opacity="0.35" />
      <rect x="29" y="38" width="8" height="14" rx="1.5" fill="#1e5fa8" />
      <circle cx="48" cy="47" r="9.5" fill="#f59e0b" stroke="#fff" stroke-width="2.5" />
      <text x="48" y="51.4" text-anchor="middle" font-size="12.5" font-weight="700" fill="#fff" font-family="'Noto Sans', Arial, sans-serif">₹</text>
    </svg>
    @if (wordmark()) {
      <span class="word" [class.light]="light()">Dukaan<span class="accent">Sathi</span></span>
    }
  `,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      gap: 10px;
    }
    .mark {
      flex-shrink: 0;
      filter: drop-shadow(0 4px 10px rgba(18, 63, 120, 0.25));
    }
    .word {
      font-size: 1.35rem;
      font-weight: 700;
      letter-spacing: -0.01em;
      color: var(--ds-text);
      white-space: nowrap;
    }
    .accent {
      color: var(--ds-brand);
    }
    .light {
      color: #fff;
      .accent {
        color: #fbbf24;
      }
    }
  `,
})
export class Logo {
  readonly size = input(40);
  readonly wordmark = input(true);
  /** White wordmark for dark/brand backgrounds. */
  readonly light = input(false);

  private static seq = 0;
  /** Unique gradient id so several logos on one page don't clash. */
  protected readonly gid = `ds-logo-g${Logo.seq++}`;
}
