import { ChangeDetectionStrategy, Component, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButton } from '@angular/material/button';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { AuthService } from '../../core/auth/auth.service';
import type { Sale } from '../../core/models/domain.models';
import { SalesApi } from '../../core/services/data.services';
import { PdfService } from '../../core/services/pdf.service';
import { ShareService } from '../../core/services/share.service';
import { ToastService } from '../../core/services/toast.service';
import { formatQty, rsText } from '../../core/utils/format';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { Skeleton } from '../../shared/components/skeleton/skeleton';
import { InrPipe } from '../../shared/pipes/inr.pipe';
import { formatIstDate, IstDatePipe } from '../../shared/pipes/ist-date.pipe';
import { MODE_BADGE } from './sales-list';

/** Printable bill with PDF download and WhatsApp share. */
@Component({
  selector: 'app-sale-view',
  imports: [RouterLink, MatButton, TranslatePipe, PageHeader, Skeleton, InrPipe, IstDatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="ds-page max-w-2xl">
      @if (sale(); as s) {
        <div class="no-print">
          <app-page-header [title]="('sales.bill' | translate) + ' #' + s.billNumber" [subtitle]="s.date | istDate: true" backLink="/sales" />
        </div>

        <article class="ds-card bill" id="bill">
          <header class="bill-head">
            <div>
              <h2>{{ auth.user()?.shopName }}</h2>
              <p>{{ auth.user()?.shopAddress }}</p>
              <p>{{ auth.user()?.phone }}@if (auth.user()?.gstNumber) { · GSTIN {{ auth.user()?.gstNumber }} }</p>
            </div>
            <div class="text-right">
              <div class="font-bold text-lg">#{{ s.billNumber }}</div>
              <div class="text-sm text-muted">{{ s.date | istDate: true }}</div>
            </div>
          </header>
          <div class="party">
            <span class="text-muted">{{ 'billing.customer' | translate }}:</span>
            @if (s.customer; as c) {
              <a [routerLink]="['/customers', c.id]" class="font-semibold">{{ c.name }}</a>
              @if (c.phone) { <span class="text-muted">· {{ c.phone }}</span> }
            } @else {
              <span class="font-semibold">{{ s.customerName || ('billing.walkIn' | translate) }}</span>
            }
          </div>
          <table class="ds-table">
            <thead>
              <tr>
                <th>{{ 'sales.item' | translate }}</th>
                <th class="num">{{ 'common.qty' | translate }}</th>
                <th class="num">{{ 'purchases.rate' | translate }}</th>
                <th class="num">{{ 'common.amount' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              @for (i of s.items; track $index) {
                <tr>
                  <td>{{ i.name }}</td>
                  <td class="num">{{ i.qty }} {{ i.unit }}</td>
                  <td class="num">{{ i.rate | inr }}</td>
                  <td class="num">{{ i.total | inr }}</td>
                </tr>
              }
            </tbody>
          </table>
          <dl class="sum">
            <dt>{{ 'billing.subtotal' | translate }}</dt><dd>{{ s.subtotal | inr }}</dd>
            @if (s.discount) { <dt>{{ 'billing.discount' | translate }}</dt><dd>- {{ s.discount | inr }}</dd> }
            <dt class="grand">{{ 'common.total' | translate }}</dt><dd class="grand">{{ s.totalAmount | inr }}</dd>
            <dt>{{ 'sales.paid' | translate }} ({{ ('pay.' + s.paymentMode) | translate }})</dt><dd class="amount-payment">{{ s.paidAmount | inr }}</dd>
            @if (s.creditAmount) { <dt class="text-danger">{{ 'billing.toUdhaar' | translate }}</dt><dd class="amount-credit">{{ s.creditAmount | inr }}</dd> }
          </dl>
          <p class="thanks">{{ 'sales.thanks' | translate }}</p>
        </article>

        <div class="actions no-print">
          <button mat-flat-button class="ds-big-btn" (click)="whatsapp(s)"><span class="material-symbols-outlined">chat</span>{{ 'sales.shareWhatsapp' | translate }}</button>
          <button mat-stroked-button class="ds-big-btn" (click)="downloadPdf(s)" [disabled]="busy()"><span class="material-symbols-outlined">picture_as_pdf</span>PDF</button>
          <button mat-stroked-button class="ds-big-btn" (click)="print()"><span class="material-symbols-outlined">print</span>{{ 'sales.print' | translate }}</button>
          <a mat-stroked-button class="ds-big-btn" routerLink="/sales/new"><span class="material-symbols-outlined">add</span>{{ 'dashboard.newBill' | translate }}</a>
        </div>
      } @else {
        <app-skeleton [rows]="3" [height]="120" />
      }
    </section>
  `,
  styles: `
    .bill { padding: 20px; }
    .bill-head { display: flex; justify-content: space-between; gap: 12px; padding-bottom: 12px; border-bottom: 2px solid var(--ds-line); }
    .bill-head h2 { margin: 0; font-size: 1.2rem; color: var(--ds-brand); }
    .bill-head p { margin: 2px 0 0; color: var(--ds-muted); font-size: 0.85rem; }
    .party { padding: 12px 0; display: flex; gap: 6px; flex-wrap: wrap; }
    .party a { color: var(--ds-brand); text-decoration: none; min-height: auto; }
    .sum { display: grid; grid-template-columns: 1fr auto; gap: 6px 16px; margin: 14px 0 0; padding-top: 12px; border-top: 1px solid var(--ds-line); }
    .sum dt { color: var(--ds-muted); text-align: right; }
    .sum dd { margin: 0; text-align: right; min-width: 110px; font-variant-numeric: tabular-nums; }
    .sum .grand { font-size: 1.2rem; font-weight: 700; color: var(--ds-text); }
    .thanks { text-align: center; color: var(--ds-muted); margin: 18px 0 0; }
    .actions { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-top: 16px; }
    @media (min-width: 600px) { .actions { grid-template-columns: repeat(4, 1fr); } }
  `,
})
export class SaleView {
  readonly id = input.required<string>();
  private readonly api = inject(SalesApi);
  private readonly pdf = inject(PdfService);
  private readonly share = inject(ShareService);
  private readonly toast = inject(ToastService);
  private readonly t = inject(TranslateService);
  protected readonly auth = inject(AuthService);
  protected readonly sale = signal<Sale | null>(null);
  protected readonly busy = signal(false);
  protected readonly modeBadge = MODE_BADGE;

  constructor() {
    effect(() => {
      const id = this.id();
      untracked(() => this.api.get(id).subscribe({ next: (s) => this.sale.set(s), error: (e) => this.toast.apiError(e) }));
    });
  }

  protected print(): void {
    window.print();
  }

  protected async downloadPdf(s: Sale): Promise<void> {
    this.busy.set(true);
    try {
      const file = await this.pdf.bill(s);
      this.share.download(file, file.name);
    } finally {
      this.busy.set(false);
    }
  }

  protected async whatsapp(s: Sale): Promise<void> {
    const shop = this.auth.user();
    const lines = s.items.map((i) => `• ${i.name} ${formatQty(i.qty, i.unit)} = ${rsText(i.total)}`).join('\n');
    const text =
      `*${shop?.shopName ?? 'DukaanSathi'}*\n${this.t.instant('sales.bill')} #${s.billNumber} · ${formatIstDate(s.date, true)}\n\n${lines}\n\n` +
      (s.discount ? `${this.t.instant('billing.discount')}: -${rsText(s.discount)}\n` : '') +
      `*${this.t.instant('common.total')}: ${rsText(s.totalAmount)}*\n` +
      (s.creditAmount ? `${this.t.instant('billing.toUdhaar')}: ${rsText(s.creditAmount)}\n` : '') +
      `\n${this.t.instant('sales.thanks')}`;
    // On phones, try sharing the PDF itself; otherwise open WhatsApp with the text bill.
    try {
      const file = await this.pdf.bill(s);
      if (await this.share.shareFile(file, `Bill #${s.billNumber}`, text)) return;
    } catch {
      /* fall through to text share */
    }
    this.share.openWhatsapp(s.customer?.phone, text);
  }
}
