import { ChangeDetectionStrategy, Component, effect, inject, input, signal, untracked } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import type { Customer, KhataLinkStatus } from '../../core/models/domain.models';
import { CustomersApi } from '../../core/services/data.services';
import { LanguageService } from '../../core/services/language.service';
import { ShareService } from '../../core/services/share.service';
import { ToastService } from '../../core/services/toast.service';
import { ConfirmService } from '../../shared/components/confirm-dialog/confirm-dialog';
import { IstDatePipe } from '../../shared/pipes/ist-date.pipe';

/** Public URL of a khata token (the page is served by this same app). */
export const khataUrl = (token: string) => `${location.origin}/k/${token}`;

/**
 * "Khata link": a read-only page the customer opens without login. The token is stored hashed on
 * the server, so a link can be copied only right after it is made; "New link" replaces it.
 */
@Component({
  selector: 'app-khata-link-card',
  imports: [MatButton, TranslatePipe, IstDatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ds-section-title">
      <h2>{{ 'khataLink.title' | translate }}</h2>
      @if (status()?.active) {
        <span class="ds-badge ok"><span class="material-symbols-outlined" aria-hidden="true">link</span>{{ 'khataLink.active' | translate }}</span>
      }
    </div>
    <div class="px-4 pb-4">
      <p class="text-sm text-muted mt-0">{{ 'khataLink.hint' | translate }}</p>
      @if (freshUrl(); as url) {
        <div class="url" (click)="select($event)">{{ url }}</div>
        <div class="row">
          <button mat-flat-button type="button" (click)="copy(url)"><span class="material-symbols-outlined">content_copy</span>{{ 'khataLink.copy' | translate }}</button>
          <a mat-stroked-button [href]="whatsapp(url)" target="_blank" rel="noopener"><span class="material-symbols-outlined">chat</span>{{ 'khataLink.sendWhatsapp' | translate }}</a>
        </div>
        <p class="text-sm text-muted">{{ 'khataLink.copyNow' | translate }}</p>
      } @else if (status()?.active) {
        <p class="text-sm">
          {{ 'khataLink.since' | translate: { date: (status()!.createdAt | istDate) } }}
          · {{ 'khataLink.views' | translate: { n: status()!.views } }}
        </p>
      }
      <div class="row">
        <button mat-stroked-button type="button" (click)="create()" [disabled]="busy()">
          <span class="material-symbols-outlined">{{ status()?.active ? 'autorenew' : 'add_link' }}</span>
          {{ (status()?.active ? 'khataLink.regenerate' : 'khataLink.create') | translate }}
        </button>
        @if (status()?.active) {
          <button mat-button type="button" class="danger" (click)="revoke()" [disabled]="busy()">
            <span class="material-symbols-outlined">link_off</span>{{ 'khataLink.disable' | translate }}
          </button>
        }
      </div>
    </div>
  `,
  styles: `
    .url { padding: 10px 12px; border: 1px dashed var(--ds-line); border-radius: 10px; font-family: ui-monospace, monospace; font-size: 0.85rem; overflow-wrap: anywhere; user-select: all; }
    .row { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
    .danger { color: var(--ds-danger); }
  `,
})
export class KhataLinkCard {
  readonly customer = input.required<Customer>();
  readonly shopName = input('');
  private readonly api = inject(CustomersApi);
  private readonly toast = inject(ToastService);
  private readonly share = inject(ShareService);
  private readonly confirm = inject(ConfirmService);
  private readonly t = inject(TranslateService);
  private readonly lang = inject(LanguageService);

  protected readonly status = signal<KhataLinkStatus | null>(null);
  /** Shown once, right after creating. */
  protected readonly freshUrl = signal<string | null>(null);
  protected readonly busy = signal(false);

  constructor() {
    effect(() => {
      const id = this.customer().id;
      untracked(() => {
        this.freshUrl.set(null);
        this.api.shareLink(id).subscribe({ next: (s) => this.status.set(s), error: () => undefined });
      });
    });
  }

  protected create(): void {
    const run = () => {
      this.busy.set(true);
      this.api.createShareLink(this.customer().id).subscribe({
        next: (s) => {
          this.busy.set(false);
          this.status.set(s);
          this.freshUrl.set(khataUrl(s.token));
        },
        error: (e) => {
          this.busy.set(false);
          this.toast.apiError(e);
        },
      });
    };
    if (!this.status()?.active) return run();
    this.confirm.ask({ message: this.t.instant('khataLink.confirmRegenerate') }).subscribe((ok) => ok && run());
  }

  protected revoke(): void {
    this.confirm.ask({ message: this.t.instant('khataLink.confirmDisable'), confirmText: this.t.instant('khataLink.disable'), danger: true }).subscribe((ok) => {
      if (!ok) return;
      this.busy.set(true);
      this.api.revokeShareLink(this.customer().id).subscribe({
        next: (s) => {
          this.busy.set(false);
          this.status.set(s);
          this.freshUrl.set(null);
          this.toast.success('khataLink.disabled');
        },
        error: (e) => {
          this.busy.set(false);
          this.toast.apiError(e);
        },
      });
    });
  }

  protected copy(url: string): void {
    void navigator.clipboard?.writeText(url).then(
      () => this.toast.success('khataLink.copied'),
      () => undefined,
    );
  }

  protected whatsapp(url: string): string {
    const c = this.customer();
    const text =
      this.lang.current() === 'en'
        ? `Namaste ${c.name} ji, you can see your khata with ${this.shopName()} here: ${url}`
        : `नमस्ते ${c.name} जी, ${this.shopName()} में आपका खाता यहाँ देखें: ${url}`;
    return this.share.whatsappUrl(c.phone, text);
  }

  protected select(e: Event): void {
    const range = document.createRange();
    range.selectNodeContents(e.target as Node);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  }
}
