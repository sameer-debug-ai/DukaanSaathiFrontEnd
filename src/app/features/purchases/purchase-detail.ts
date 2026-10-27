import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButton } from '@angular/material/button';
import { TranslatePipe } from '@ngx-translate/core';
import type { Purchase } from '../../core/models/domain.models';
import { BillScanApi } from '../../core/services/bill-scan.api';
import { SuppliersApi } from '../../core/services/data.services';
import { ToastService } from '../../core/services/toast.service';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { Skeleton } from '../../shared/components/skeleton/skeleton';
import { InrPipe } from '../../shared/pipes/inr.pipe';
import { IstDatePipe } from '../../shared/pipes/ist-date.pipe';

/** One purchase: items, amounts and (when it was scanned) the bill photo. */
@Component({
  selector: 'app-purchase-detail',
  imports: [RouterLink, MatButton, TranslatePipe, PageHeader, Skeleton, InrPipe, IstDatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="ds-page max-w-4xl">
      @if (purchase(); as p) {
        <app-page-header
          [title]="p.supplier?.name || ('purchases.title' | translate)"
          [subtitle]="(p.date | istDate) + (p.invoiceNumber ? ' · ' + ('purchases.invoice' | translate) + ' ' + p.invoiceNumber : '')"
          backLink="/purchases"
        />

        <div class="layout">
          <div class="main">
            <div class="ds-card p-4 mb-4 amounts">
              <div><span>{{ 'purchases.total' | translate }}</span><strong>{{ p.totalAmount | inr }}</strong></div>
              <div><span>{{ 'purchases.paidNow' | translate }}</span><strong class="text-ok">{{ p.paidAmount | inr }}</strong></div>
              <div><span>{{ 'purchases.due' | translate }}</span><strong [class.text-warn]="p.dueAmount > 0">{{ p.dueAmount | inr }}</strong></div>
            </div>

            <div class="ds-card overflow-hidden mb-4">
              <div class="ds-section-title"><h2>{{ 'purchases.itemsTitle' | translate }}</h2></div>
              <table class="ds-table">
                <tbody>
                  @for (i of p.items; track $index) {
                    <tr>
                      <td><a [routerLink]="['/products', i.productId]">{{ i.name }}</a></td>
                      <td class="num">{{ i.qty }} {{ i.unit }} × {{ i.rate | inr }}</td>
                      <td class="num font-semibold">{{ i.total | inr }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
            @if (p.note) {
              <p class="text-muted">{{ p.note }}</p>
            }
            <a mat-stroked-button [routerLink]="['/suppliers', p.supplierId]">{{ 'purchases.viewSupplier' | translate }}</a>
          </div>

          <aside class="ds-card p-4 photo">
            <div class="photo-title">
              <span class="material-symbols-outlined" aria-hidden="true">receipt_long</span>{{ 'billScan.billPhoto' | translate }}
            </div>
            @if (photoUrl(); as url) {
              <a [href]="url" target="_blank" rel="noopener" [attr.aria-label]="'billScan.viewPhoto' | translate">
                <img [src]="url" [alt]="'billScan.photoAlt' | translate" />
              </a>
              <p class="text-xs text-muted m-0">{{ 'billScan.tapToZoom' | translate }}</p>
            } @else if (photoState() === 'loading') {
              <app-skeleton [rows]="1" [height]="220" />
            } @else {
              <p class="text-sm text-muted m-0">{{ 'billScan.noPhoto' | translate }}</p>
            }
          </aside>
        </div>
      } @else {
        <app-skeleton [rows]="3" [height]="100" />
      }
    </section>
  `,
  styles: `
    .layout { display: grid; grid-template-columns: minmax(0, 1fr) 300px; gap: 16px; align-items: start; }
    @media (max-width: 899.98px) { .layout { grid-template-columns: minmax(0, 1fr); } .photo { order: -1; } }
    .amounts { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
    .amounts div { display: flex; flex-direction: column; gap: 2px; }
    .amounts span { font-size: 0.82rem; color: var(--ds-muted); }
    .amounts strong { font-size: 1.2rem; font-variant-numeric: tabular-nums; }
    .photo { display: flex; flex-direction: column; gap: 10px; }
    .photo-title { display: flex; align-items: center; gap: 8px; font-weight: 700; }
    .photo-title .material-symbols-outlined { color: var(--ds-brand); }
    .photo img { width: 100%; max-height: 520px; object-fit: contain; border-radius: 10px; border: 1px solid var(--ds-line); background: var(--ds-surface); }
    td a { color: inherit; text-decoration: none; font-weight: 600; }
    td a:hover { text-decoration: underline; }
  `,
})
export class PurchaseDetail {
  readonly id = input.required<string>();
  private readonly suppliers = inject(SuppliersApi);
  private readonly bills = inject(BillScanApi);
  private readonly toast = inject(ToastService);

  protected readonly purchase = signal<Purchase | null>(null);
  protected readonly photoUrl = signal<string | null>(null);
  protected readonly photoState = signal<'loading' | 'none' | 'shown'>('loading');

  constructor() {
    effect(() => {
      const id = this.id();
      untracked(() => this.load(id));
    });
    inject(DestroyRef).onDestroy(() => this.revoke());
  }

  private revoke(): void {
    const url = this.photoUrl();
    if (url) URL.revokeObjectURL(url);
  }

  private load(id: string): void {
    this.suppliers.purchase(id).subscribe({ next: (p) => this.purchase.set(p), error: (e) => this.toast.apiError(e) });
    this.photoState.set('loading');
    this.bills.purchaseImage(id).subscribe({
      next: (blob) => {
        this.revoke();
        this.photoUrl.set(URL.createObjectURL(blob));
        this.photoState.set('shown');
      },
      // 404 = this purchase was entered by hand (no photo); anything else is a real error.
      error: (e: HttpErrorResponse) => {
        this.photoState.set('none');
        if (e.status !== 404) this.toast.apiError(e);
      },
    });
  }
}
