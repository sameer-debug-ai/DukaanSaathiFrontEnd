import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { TranslatePipe } from '@ngx-translate/core';
import type { Product } from '../../core/models/domain.models';
import { ProductsApi } from '../../core/services/data.services';
import { ToastService } from '../../core/services/toast.service';

type Reason = 'add' | 'remove' | 'damage' | 'return';

/** Manual stock change with a reason; always recorded as a StockMovement. */
@Component({
  selector: 'app-adjust-stock-dialog',
  imports: [ReactiveFormsModule, MatDialogModule, MatButton, MatButtonToggleModule, MatFormFieldModule, MatInput, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>{{ 'stock.adjustTitle' | translate: { name: data.name } }}</h2>
    <form [formGroup]="form" (ngSubmit)="save()" novalidate>
      <mat-dialog-content>
        <p class="now">{{ 'stock.current' | translate }}: <strong>{{ data.currentStock }} {{ data.unit }}</strong></p>
        <mat-button-toggle-group formControlName="reason" class="reasons" [attr.aria-label]="'stock.reason' | translate">
          <mat-button-toggle value="add">{{ 'stock.reasons.add' | translate }}</mat-button-toggle>
          <mat-button-toggle value="remove">{{ 'stock.reasons.remove' | translate }}</mat-button-toggle>
          <mat-button-toggle value="damage">{{ 'stock.reasons.damage' | translate }}</mat-button-toggle>
          <mat-button-toggle value="return">{{ 'stock.reasons.return' | translate }}</mat-button-toggle>
        </mat-button-toggle-group>
        <mat-form-field appearance="outline">
          <mat-label>{{ 'stock.quantity' | translate }} ({{ data.unit }})</mat-label>
          <input matInput type="number" inputmode="decimal" formControlName="quantity" min="0" cdkFocusInitial />
          <mat-error>{{ 'stock.qtyRequired' | translate }}</mat-error>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>{{ 'common.note' | translate }}</mat-label>
          <input matInput formControlName="note" [placeholder]="'stock.notePlaceholder' | translate" />
        </mat-form-field>
        <p class="after">{{ 'stock.after' | translate }}: <strong>{{ after() }} {{ data.unit }}</strong></p>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" mat-dialog-close>{{ 'common.cancel' | translate }}</button>
        <button mat-flat-button type="submit" [disabled]="saving()">{{ 'common.save' | translate }}</button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `
    .now, .after { margin: 4px 0 12px; }
    .after { color: var(--ds-muted); }
    .reasons { width: 100%; margin-bottom: 16px; display: grid; grid-template-columns: repeat(4, 1fr); }
    @media (max-width: 420px) { .reasons { grid-template-columns: repeat(2, 1fr); } }
  `,
})
export class AdjustStockDialog {
  protected readonly data = inject<Product>(MAT_DIALOG_DATA);
  private readonly ref = inject(MatDialogRef<AdjustStockDialog, Product>);
  private readonly api = inject(ProductsApi);
  private readonly toast = inject(ToastService);
  protected readonly saving = signal(false);

  protected readonly form = inject(NonNullableFormBuilder).group({
    reason: ['add' as Reason],
    quantity: [null as unknown as number, [Validators.required, Validators.min(0.001)]],
    note: [''],
  });

  private signed(): number {
    const { reason, quantity } = this.form.getRawValue();
    const q = Math.abs(Number(quantity) || 0);
    return reason === 'add' || reason === 'return' ? q : -q;
  }

  protected after(): number {
    return Math.round((this.data.currentStock + this.signed()) * 1000) / 1000;
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { reason, note } = this.form.getRawValue();
    const type = reason === 'damage' ? 'damage' : reason === 'return' ? 'return' : 'adjustment';
    this.saving.set(true);
    this.api.adjustStock({ productId: this.data.id, quantity: this.signed(), type, note }).subscribe({
      next: (p) => {
        this.toast.success('stock.updated');
        this.ref.close(p);
      },
      error: (e) => {
        this.saving.set(false);
        this.toast.apiError(e);
      },
    });
  }
}
