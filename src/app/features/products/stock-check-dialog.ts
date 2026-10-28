import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { TranslatePipe } from '@ngx-translate/core';
import type { Product, ProductBatch } from '../../core/models/domain.models';
import { ProductsApi } from '../../core/services/data.services';
import { RunOutLabel } from '../../shared/components/run-out/run-out';
import { StockBadge } from '../../shared/components/stock-badge/stock-badge';
import { InrPipe } from '../../shared/pipes/inr.pipe';
import { IstDatePipe } from '../../shared/pipes/ist-date.pipe';

export type StockCheckResult = 'again' | 'open' | undefined;

/** Result of a quick "stock check" scan: stock, run-out forecast and expiry batches. */
@Component({
  selector: 'app-stock-check-dialog',
  imports: [MatDialogModule, MatButton, MatIconButton, TranslatePipe, StockBadge, RunOutLabel, InrPipe, IstDatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="head">
      <h2 mat-dialog-title>{{ p.name }}</h2>
      <button mat-icon-button mat-dialog-close [attr.aria-label]="'common.close' | translate"><span class="material-symbols-outlined">close</span></button>
    </div>
    <mat-dialog-content class="body">
      <div class="big">{{ p.currentStock }} <span>{{ ('units.' + p.unit) | translate }}</span></div>
      <div class="meta">
        <app-stock-badge [status]="p.stockStatus" />
        <app-run-out [forecast]="p.forecast" [stock]="p.currentStock" />
      </div>
      <p class="sub">{{ p.sellingPrice | inr }}/{{ p.unit }} · {{ 'products.barcode' | translate }}: {{ p.barcode }}</p>
      @if (p.trackExpiry && batches().length) {
        <h3>{{ 'expiry.batches' | translate }}</h3>
        <ul class="batches">
          @for (b of batches(); track b.id) {
            <li>
              <span>{{ b.qty }} {{ p.unit }}</span>
              <span class="text-muted">{{ b.expiryDate ? ('expiry.exp' | translate: { date: (b.expiryDate | istDate) }) : ('expiry.noDate' | translate) }}</span>
            </li>
          }
        </ul>
      }
    </mat-dialog-content>
    <mat-dialog-actions class="acts">
      <button mat-stroked-button type="button" (click)="ref.close('open')">{{ 'scan.openProduct' | translate }}</button>
      <button mat-flat-button type="button" (click)="ref.close('again')"><span class="material-symbols-outlined">barcode_scanner</span>{{ 'scan.again' | translate }}</button>
    </mat-dialog-actions>
  `,
  styles: `
    .head { display: flex; align-items: center; justify-content: space-between; padding-right: 8px; }
    .big { font-size: 2.4rem; font-weight: 700; line-height: 1.1; }
    .big span { font-size: 1rem; font-weight: 500; color: var(--ds-muted); }
    .meta { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; margin: 8px 0; }
    .sub { margin: 0; color: var(--ds-muted); font-size: 0.9rem; overflow-wrap: anywhere; }
    h3 { margin: 16px 0 6px; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--ds-muted); }
    .batches { list-style: none; margin: 0; padding: 0; }
    .batches li { display: flex; justify-content: space-between; gap: 12px; padding: 6px 0; border-bottom: 1px solid var(--ds-line); }
    .acts { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  `,
})
export class StockCheckDialog {
  protected readonly p = inject<Product>(MAT_DIALOG_DATA);
  protected readonly ref = inject(MatDialogRef<StockCheckDialog, StockCheckResult>);
  protected readonly batches = signal<ProductBatch[]>([]);

  constructor() {
    if (this.p.trackExpiry) inject(ProductsApi).batches(this.p.id).subscribe({ next: (b) => this.batches.set(b), error: () => undefined });
  }
}
