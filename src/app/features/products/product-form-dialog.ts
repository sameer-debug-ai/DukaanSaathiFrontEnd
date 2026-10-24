import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButton } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { TranslatePipe } from '@ngx-translate/core';
import { AuthService } from '../../core/auth/auth.service';
import { UNITS, type Product } from '../../core/models/domain.models';
import { ProductsApi, type ProductInput } from '../../core/services/data.services';
import { ToastService } from '../../core/services/toast.service';
import { toPaise, toRupees } from '../../core/utils/format';

export interface ProductFormData {
  product?: Product;
  categories: string[];
  /** Pre-filled name (e.g. from the voice assistant or the purchase form). */
  name?: string;
  sellingPrice?: number;
  unit?: Product['unit'];
}

@Component({
  selector: 'app-product-form-dialog',
  imports: [ReactiveFormsModule, MatDialogModule, MatButton, MatFormFieldModule, MatInput, MatSelectModule, MatAutocompleteModule, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>{{ (data.product ? 'products.edit' : 'products.add') | translate }}</h2>
    <form [formGroup]="form" (ngSubmit)="save()" novalidate>
      <mat-dialog-content>
        <div class="grid">
          <mat-form-field appearance="outline" class="span2">
            <mat-label>{{ 'products.name' | translate }}</mat-label>
            <input matInput formControlName="name" cdkFocusInitial />
            <mat-error>{{ 'common.required' | translate }}</mat-error>
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>{{ 'products.nameHindi' | translate }}</mat-label>
            <input matInput formControlName="nameHindi" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>{{ 'products.category' | translate }}</mat-label>
            <input matInput formControlName="category" [matAutocomplete]="cats" />
            <mat-autocomplete #cats="matAutocomplete">
              @for (c of data.categories; track c) {
                <mat-option [value]="c">{{ c }}</mat-option>
              }
            </mat-autocomplete>
          </mat-form-field>
          <mat-form-field appearance="outline" class="span2">
            <mat-label>{{ 'products.aliases' | translate }}</mat-label>
            <input matInput formControlName="aliases" />
            <mat-hint>{{ 'products.aliasesHint' | translate }}</mat-hint>
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>{{ 'products.unit' | translate }}</mat-label>
            <mat-select formControlName="unit">
              @for (u of units; track u) {
                <mat-option [value]="u">{{ ('units.' + u) | translate }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>{{ 'products.threshold' | translate }}</mat-label>
            <input matInput type="number" inputmode="decimal" formControlName="lowStockThreshold" min="0" />
            <mat-hint>{{ 'products.thresholdHint' | translate }}</mat-hint>
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>{{ 'products.purchasePrice' | translate }}</mat-label>
            <span matTextPrefix>₹&nbsp;</span>
            <input matInput type="number" inputmode="decimal" formControlName="purchasePrice" min="0" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>{{ 'products.sellingPrice' | translate }}</mat-label>
            <span matTextPrefix>₹&nbsp;</span>
            <input matInput type="number" inputmode="decimal" formControlName="sellingPrice" min="0" />
            <mat-error>{{ 'common.required' | translate }}</mat-error>
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>{{ 'products.mrp' | translate }}</mat-label>
            <span matTextPrefix>₹&nbsp;</span>
            <input matInput type="number" inputmode="decimal" formControlName="mrp" min="0" />
          </mat-form-field>
          @if (!data.product) {
            <mat-form-field appearance="outline">
              <mat-label>{{ 'products.openingStock' | translate }}</mat-label>
              <input matInput type="number" inputmode="decimal" formControlName="openingStock" min="0" />
            </mat-form-field>
          }
          <mat-form-field appearance="outline">
            <mat-label>{{ 'products.barcode' | translate }}</mat-label>
            <input matInput formControlName="barcode" />
          </mat-form-field>
        </div>
        @if (margin(); as m) {
          <p class="margin" [class.text-danger]="m < 0">{{ 'products.margin' | translate: { value: m } }}</p>
        }
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" mat-dialog-close>{{ 'common.cancel' | translate }}</button>
        <button mat-flat-button type="submit" [disabled]="saving()">{{ 'common.save' | translate }}</button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `
    .grid { display: grid; grid-template-columns: 1fr 1fr; column-gap: 12px; padding-top: 6px; }
    .span2 { grid-column: span 2; }
    @media (max-width: 599.98px) { .grid { grid-template-columns: 1fr; } .span2 { grid-column: span 1; } }
    .margin { margin: 0 0 4px; font-size: 0.9rem; color: var(--ds-ok); }
  `,
})
export class ProductFormDialog {
  protected readonly data = inject<ProductFormData>(MAT_DIALOG_DATA);
  private readonly ref = inject(MatDialogRef<ProductFormDialog, Product>);
  private readonly api = inject(ProductsApi);
  private readonly toast = inject(ToastService);
  private readonly auth = inject(AuthService);

  protected readonly units = UNITS;
  protected readonly saving = signal(false);

  protected readonly form = inject(NonNullableFormBuilder).group({
    name: [this.data.product?.name ?? this.data.name ?? '', [Validators.required, Validators.maxLength(120)]],
    nameHindi: [this.data.product?.nameHindi ?? ''],
    category: [this.data.product?.category ?? 'General'],
    aliases: [(this.data.product?.aliases ?? []).join(', ')],
    unit: [this.data.product?.unit ?? this.data.unit ?? 'piece'],
    lowStockThreshold: [this.data.product?.lowStockThreshold ?? this.auth.user()?.settings.lowStockDefault ?? 5, [Validators.min(0)]],
    purchasePrice: [toRupees(this.data.product?.purchasePrice ?? 0), [Validators.min(0)]],
    sellingPrice: [toRupees(this.data.product?.sellingPrice ?? this.data.sellingPrice ?? 0) || (null as unknown as number), [Validators.required, Validators.min(0)]],
    mrp: [toRupees(this.data.product?.mrp ?? 0), [Validators.min(0)]],
    openingStock: [0, [Validators.min(0)]],
    barcode: [this.data.product?.barcode ?? ''],
  });

  protected margin(): number | null {
    const { purchasePrice, sellingPrice } = this.form.getRawValue();
    if (!purchasePrice || !sellingPrice) return null;
    return Math.round(((sellingPrice - purchasePrice) / sellingPrice) * 1000) / 10;
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const body: ProductInput = {
      name: v.name.trim(),
      nameHindi: v.nameHindi.trim(),
      category: v.category.trim() || 'General',
      aliases: v.aliases.split(',').map((s) => s.trim()).filter(Boolean),
      unit: v.unit,
      lowStockThreshold: Number(v.lowStockThreshold) || 0,
      purchasePrice: toPaise(v.purchasePrice),
      sellingPrice: toPaise(v.sellingPrice),
      mrp: toPaise(v.mrp),
      barcode: v.barcode.trim() || undefined,
    };
    this.saving.set(true);
    const req = this.data.product
      ? this.api.update(this.data.product.id, body)
      : this.api.create({ ...body, openingStock: Number(v.openingStock) || 0 });
    req.subscribe({
      next: (p) => {
        this.toast.success(this.data.product ? 'products.updated' : 'products.added');
        this.ref.close(p);
      },
      error: (e) => {
        this.saving.set(false);
        this.toast.apiError(e);
      },
    });
  }
}
