import { ChangeDetectionStrategy, Component, OnDestroy, effect, inject, input, signal, untracked } from '@angular/core';
import { Meta } from '@angular/platform-browser';
import { TranslatePipe } from '@ngx-translate/core';
import type { PublicKhata } from '../../core/models/domain.models';
import { PublicKhataApi } from '../../core/services/data.services';
import { LanguageService } from '../../core/services/language.service';
import { qrDataUrl } from '../../core/utils/upi';
import { InrPipe } from '../../shared/pipes/inr.pipe';
import { IstDatePipe } from '../../shared/pipes/ist-date.pipe';

/**
 * The customer's own read-only khata (`/k/:token`), opened from a link the shop shared.
 * No login and no app chrome: balance, entries and a "Pay via UPI" button.
 */
@Component({
  selector: 'app-khata-page',
  imports: [TranslatePipe, InrPipe, IstDatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="kp">
      <div class="top">
        <button type="button" class="lang" (click)="toggleLang()">{{ lang.current() === 'hi' ? 'English' : 'हिंदी' }}</button>
      </div>
      @if (error()) {
        <div class="card center">
          <span class="material-symbols-outlined big text-warn" aria-hidden="true">link_off</span>
          <h1>{{ 'publicKhata.invalidTitle' | translate }}</h1>
          <p class="muted">{{ 'publicKhata.invalidHint' | translate }}</p>
        </div>
      } @else if (data(); as d) {
        <header class="shop">
          <h1>{{ d.shop.name }}</h1>
          @if (d.shop.address) {
            <p class="muted">{{ d.shop.address }}</p>
          }
        </header>

        <section class="card hero" [class.due]="d.balance > 0">
          <p class="muted m0">{{ 'publicKhata.hello' | translate: { name: d.customer.name } }}</p>
          <p class="label">{{ (d.balance > 0 ? 'publicKhata.due' : d.balance < 0 ? 'publicKhata.advance' : 'publicKhata.clear') | translate }}</p>
          <p class="amount">{{ (d.balance < 0 ? -d.balance : d.balance) | inr }}</p>
          @if (d.upiLink) {
            <a class="pay" [href]="d.upiLink">
              <span class="material-symbols-outlined" aria-hidden="true">account_balance_wallet</span>{{ 'publicKhata.pay' | translate }}
            </a>
            @if (qr(); as src) {
              <img class="qr" [src]="src" [alt]="'upi.qrAlt' | translate: { amount: (d.balance | inr) }" width="200" height="200" />
            }
            <p class="muted small">{{ 'upi.payTo' | translate }} <strong>{{ d.upiId }}</strong></p>
          }
          @if (d.shop.phone) {
            <a class="call" [href]="'tel:' + d.shop.phone"><span class="material-symbols-outlined" aria-hidden="true">call</span>{{ d.shop.phone }}</a>
          }
        </section>

        <section class="card list">
          <h2>{{ 'publicKhata.entries' | translate }}</h2>
          @for (e of d.entries; track $index) {
            <div class="row">
              <span class="ic" [class.cr]="e.type === 'credit'" aria-hidden="true">
                <span class="material-symbols-outlined">{{ e.type === 'credit' ? 'call_made' : 'call_received' }}</span>
              </span>
              <div class="desc">
                <div class="t">{{ describe(e) }}</div>
                <div class="muted small">{{ e.date | istDate }} · {{ 'publicKhata.balance' | translate }} {{ e.balance | inr }}</div>
              </div>
              <strong class="amt" [class.cr]="e.type === 'credit'">{{ e.type === 'credit' ? '+' : '-' }}{{ e.amount | inr }}</strong>
            </div>
          } @empty {
            <p class="muted">{{ 'publicKhata.noEntries' | translate }}</p>
          }
          @if (d.truncated) {
            <p class="muted small">{{ 'publicKhata.truncated' | translate }}</p>
          }
        </section>
        <p class="foot muted small">{{ 'publicKhata.readOnly' | translate: { date: (d.generatedAt | istDate: true) } }}</p>
      } @else {
        <div class="card center"><p class="muted">{{ 'common.loading' | translate }}</p></div>
      }
    </main>
  `,
  styles: `
    :host { display: block; min-height: 100dvh; background: var(--ds-surface); color: var(--ds-text); }
    .kp { max-width: 560px; margin: 0 auto; padding: 12px 16px 32px; }
    .top { display: flex; justify-content: flex-end; }
    .lang { border: 1px solid var(--ds-line); background: var(--ds-card); color: inherit; border-radius: 999px; padding: 6px 14px; font: inherit; cursor: pointer; }
    .shop h1 { margin: 8px 0 2px; font-size: 1.4rem; }
    .card { background: var(--ds-card); border: 1px solid var(--ds-line); border-radius: 16px; padding: 16px; margin-top: 12px; }
    .center { text-align: center; }
    .big { font-size: 56px; }
    .muted { color: var(--ds-muted); }
    .small { font-size: 0.85rem; }
    .m0 { margin: 0; }
    .hero { text-align: center; }
    .label { margin: 8px 0 0; font-weight: 600; }
    .amount { margin: 2px 0 12px; font-size: 2.4rem; font-weight: 700; font-variant-numeric: tabular-nums; color: var(--ds-ok); }
    .hero.due .amount { color: var(--ds-danger); }
    .pay { display: flex; align-items: center; justify-content: center; gap: 8px; min-height: 52px; border-radius: 14px; background: var(--ds-brand); color: #fff; font-weight: 700; font-size: 1.05rem; text-decoration: none; }
    .qr { display: block; margin: 14px auto 6px; background: #fff; padding: 8px; border-radius: 12px; }
    .call { display: inline-flex; align-items: center; gap: 6px; margin-top: 12px; color: var(--ds-brand); font-weight: 600; text-decoration: none; }
    .list h2 { margin: 0 0 8px; font-size: 1.05rem; }
    .row { display: flex; align-items: center; gap: 10px; padding: 10px 0; border-top: 1px solid var(--ds-line); }
    .ic { display: grid; place-items: center; width: 34px; height: 34px; border-radius: 50%; background: var(--ds-ok-soft); color: var(--ds-ok); flex-shrink: 0; }
    .ic.cr { background: var(--ds-danger-soft); color: var(--ds-danger); }
    .desc { flex: 1; min-width: 0; }
    .t { font-weight: 600; overflow-wrap: anywhere; }
    .amt { font-variant-numeric: tabular-nums; color: var(--ds-ok); white-space: nowrap; }
    .amt.cr { color: var(--ds-danger); }
    .foot { text-align: center; margin-top: 16px; }
  `,
})
export class KhataPage implements OnDestroy {
  readonly token = input.required<string>();
  private readonly api = inject(PublicKhataApi);
  private readonly meta = inject(Meta);
  private readonly t = inject(LanguageService);
  protected readonly lang = this.t;

  protected readonly data = signal<PublicKhata | null>(null);
  protected readonly error = signal(false);
  protected readonly qr = signal<string | null>(null);

  constructor() {
    // A private page: keep it out of search engines.
    this.meta.updateTag({ name: 'robots', content: 'noindex, nofollow' });
    effect(() => {
      const token = this.token();
      untracked(() => this.load(token));
    });
  }

  ngOnDestroy(): void {
    this.meta.removeTag('name="robots"');
  }

  private load(token: string): void {
    this.api.get(token).subscribe({
      next: (d) => {
        this.data.set(d);
        if (d.upiLink) qrDataUrl(d.upiLink, 240).then((src) => this.qr.set(src), () => undefined);
      },
      error: () => this.error.set(true),
    });
  }

  protected toggleLang(): void {
    void this.lang.use(this.lang.current() === 'hi' ? 'en' : 'hi');
  }

  protected describe(e: PublicKhata['entries'][number]): string {
    const items = e.items.map((i) => `${i.name} × ${i.qty}`).join(', ');
    return [e.note, items].filter(Boolean).join(' · ') || (e.type === 'credit' ? 'Udhaar' : 'Payment / जमा');
  }
}
