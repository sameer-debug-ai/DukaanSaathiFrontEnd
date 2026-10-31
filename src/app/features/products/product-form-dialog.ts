import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggle } from '@angular/material/slide-toggle';
import { TranslatePipe } from '@ngx-translate/core';
import { AuthService } from '../../core/auth/auth.service';
import { UNITS, type Product } from '../../core/models/domain.models';
import { BarcodeScanner } from '../../core/services/barcode-scanner.service';
import { GST_RATES } from '../../core/services/billing.api';
import { CategoriesApi } from '../../core/services/categories.api';
import { ProductsApi, type ProductInput } from '../../core/services/data.services';
import { ToastService } from '../../core/services/toast.service';
import { toPaise, toRupees } from '../../core/utils/format';
import { formatPaise } from '../../shared/pipes/inr.pipe';

export interface ProductFormData {
  product?: Product;
  categories: string[];
  /** Pre-filled name (e.g. from the voice assistant or the purchase form). */
  name?: string;
  sellingPrice?: number;
  unit?: Product['unit'];
  /** Pre-filled barcode (from a stock-check scan of an unknown code). */
  barcode?: string;
}

@Component({
  selector: 'app-product-form-dialog',
  imports: [ReactiveFormsModule, MatDialogModule, MatButton, MatIconButton, MatFormFieldModule, MatInput, MatSelectModule, MatAutocompleteModule, MatSlideToggle, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="fd">
      <header class="fd-head">
        <span class="fd-icon"><span class="material-symbols-outlined">{{ data.product ? 'edit_note' : 'add_box' }}</span></span>
        <div class="fd-titles">
          <h2 mat-dialog-title>{{ (data.product ? 'products.edit' : 'products.add') | translate }}</h2>
          <p>{{ 'products.formSubtitle' | translate }}</p>
        </div>
        <button mat-icon-button type="button" mat-dialog-close [attr.aria-label]="'common.close' | translate">
          <span class="material-symbols-outlined">close</span>
        </button>
      </header>

      <form [formGroup]="form" (ngSubmit)="save()" novalidate class="fd">
        <mat-dialog-content class="fd-body">
          <section class="fd-section">
            <h3><span class="material-symbols-outlined">label</span>{{ 'products.sectionBasic' | translate }}</h3>
            <div class="fd-grid">
              <mat-form-field appearance="outline" subscriptSizing="dynamic" class="span-all">
                <mat-label>{{ 'products.name' | translate }}</mat-label>
                <input matInput formControlName="name" cdkFocusInitial [placeholder]="'products.namePlaceholder' | translate" />
                <mat-error>{{ 'common.required' | translate }}</mat-error>
              </mat-form-field>
              <mat-form-field appearance="outline" subscriptSizing="dynamic">
                <mat-label>{{ 'products.nameHindi' | translate }}</mat-label>
                <input matInput formControlName="nameHindi" placeholder="चीनी" />
              </mat-form-field>
              <mat-form-field appearance="outline" subscriptSizing="dynamic">
                <mat-label>{{ 'products.category' | translate }}</mat-label>
                <input matInput formControlName="category" [matAutocomplete]="cats" />
                <mat-autocomplete #cats="matAutocomplete">
                  @for (c of categoryOptions(); track c) {
                    <mat-option [value]="c">{{ c }}</mat-option>
                  }
                </mat-autocomplete>
              </mat-form-field>
              <mat-form-field appearance="outline" subscriptSizing="dynamic" class="span-all">
                <mat-label>{{ 'products.aliases' | translate }}</mat-label>
                <span matPrefix class="material-symbols-outlined fd-field-icon">record_voice_over</span>
                <input matInput formControlName="aliases" placeholder="cheeni, shakkar" />
                <mat-hint>{{ 'products.aliasesHint' | translate }}</mat-hint>
              </mat-form-field>
            </div>
          </section>

          <section class="fd-section">
            <h3><span class="material-symbols-outlined">sell</span>{{ 'products.sectionPrice' | translate }}</h3>
            <div class="fd-grid three">
              <mat-form-field appearance="outline" subscriptSizing="dynamic">
                <mat-label>{{ 'products.purchasePrice' | translate }}</mat-label>
                <span matTextPrefix>₹&nbsp;</span>
                <input matInput type="number" inputmode="decimal" formControlName="purchasePrice" min="0" />
              </mat-form-field>
              <mat-form-field appearance="outline" subscriptSizing="dynamic">
                <mat-label>{{ 'products.sellingPrice' | translate }}</mat-label>
                <span matTextPrefix>₹&nbsp;</span>
                <input matInput type="number" inputmode="decimal" formControlName="sellingPrice" min="0" />
                <mat-error>{{ 'common.required' | translate }}</mat-error>
              </mat-form-field>
              <mat-form-field appearance="outline" subscriptSizing="dynamic">
                <mat-label>{{ 'products.mrp' | translate }}</mat-label>
                <span matTextPrefix>₹&nbsp;</span>
                <input matInput type="number" inputmode="decimal" formControlName="mrp" min="0" />
              </mat-form-field>
            </div>
            @if (margin(); as m) {
              <p class="fd-note" [class.ok]="m.pct >= 0" [class.bad]="m.pct < 0">
                <span class="material-symbols-outlined">{{ m.pct >= 0 ? 'trending_up' : 'trending_down' }}</span>
                {{ 'products.marginLine' | translate: { value: m.pct, profit: m.profit } }}
              </p>
            }
          </section>

          @if (gstOn) {
            <section class="fd-section">
              <h3><span class="material-symbols-outlined">receipt_long</span>GST</h3>
              <div class="fd-grid">
                <mat-form-field appearance="outline" subscriptSizing="dynamic">
                  <mat-label>{{ 'products.gstRate' | translate }}</mat-label>
                  <input matInput type="number" inputmode="decimal" formControlName="gstRate" min="0" max="100" />
                  <span matTextSuffix>%</span>
                </mat-form-field>
                <mat-form-field appearance="outline" subscriptSizing="dynamic">
                  <mat-label>{{ 'products.hsn' | translate }}</mat-label>
                  <input matInput formControlName="hsnCode" inputmode="numeric" maxlength="8" placeholder="1006" />
                  <mat-error>{{ 'products.hsnInvalid' | translate }}</mat-error>
                </mat-form-field>
                <div class="span-all gst-rates" role="group" [attr.aria-label]="'products.gstRate' | translate">
                  @for (r of gstRates; track r) {
                    <button type="button" class="ds-chip" [class.active]="form.controls.gstRate.value === r" (click)="form.controls.gstRate.setValue(r)">{{ r }}%</button>
                  }
                </div>
                <div class="span-all track">
                  <mat-slide-toggle formControlName="priceIncludesGst">{{ 'products.priceIncludesGst' | translate }}</mat-slide-toggle>
                  <p>{{ 'products.priceIncludesGstHint' | translate }}</p>
                </div>
              </div>
            </section>
          }

          <section class="fd-section">
            <h3><span class="material-symbols-outlined">inventory_2</span>{{ 'products.sectionStock' | translate }}</h3>
            <div class="fd-grid">
              <mat-form-field appearance="outline" subscriptSizing="dynamic">
                <mat-label>{{ 'products.unit' | translate }}</mat-label>
                <mat-select formControlName="unit">
                  @for (u of units; track u) {
                    <mat-option [value]="u">{{ ('units.' + u) | translate }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>
              @if (!data.product) {
                <mat-form-field appearance="outline" subscriptSizing="dynamic">
                  <mat-label>{{ 'products.openingStock' | translate }}</mat-label>
                  <input matInput type="number" inputmode="decimal" formControlName="openingStock" min="0" />
                  <span matTextSuffix>{{ ('units.' + form.controls.unit.value) | translate }}</span>
                </mat-form-field>
              }
              <mat-form-field appearance="outline" subscriptSizing="dynamic">
                <mat-label>{{ 'products.threshold' | translate }}</mat-label>
                <span matPrefix class="material-symbols-outlined fd-field-icon">notifications</span>
                <input matInput type="number" inputmode="decimal" formControlName="lowStockThreshold" min="0" />
                <mat-hint>{{ 'products.thresholdHint' | translate }}</mat-hint>
              </mat-form-field>
              <mat-form-field appearance="outline" subscriptSizing="dynamic">
                <mat-label>{{ 'products.barcode' | translate }}</mat-label>
                <span matPrefix class="material-symbols-outlined fd-field-icon">barcode_scanner</span>
                <input matInput formControlName="barcode" />
                <button mat-icon-button matSuffix type="button" (click)="scanBarcode()" [attr.aria-label]="'scan.title' | translate">
                  <span class="material-symbols-outlined">photo_camera</span>
                </button>
              </mat-form-field>
              <div class="span-all track">
                <mat-slide-toggle formControlName="trackExpiry">{{ 'expiry.track' | translate }}</mat-slide-toggle>
                <p>{{ 'expiry.trackHint' | translate }}</p>
              </div>
            </div>
          </section>
        </mat-dialog-content>

        <footer class="fd-foot">
          <button mat-button type="button" mat-dialog-close>{{ 'common.cancel' | translate }}</button>
          <button mat-flat-button type="submit" class="fd-save" [disabled]="saving()">
            <span class="material-symbols-outlined">check</span>{{ 'common.save' | translate }}
          </button>
        </footer>
      </form>
    </div>
  `,
  styles: `
    .track { display: flex; flex-direction: column; gap: 2px; }
    .track p { margin: 0 0 0 52px; font-size: 0.82rem; color: var(--ds-muted); }
    .gst-rates { display: flex; flex-wrap: wrap; gap: 6px; }
  `,
})
export class ProductFormDialog {
  protected readonly data = inject<ProductFormData>(MAT_DIALOG_DATA);
  private readonly ref = inject(MatDialogRef<ProductFormDialog, Product>);
  private readonly api = inject(ProductsApi);
  private readonly toast = inject(ToastService);
  private readonly auth = inject(AuthService);
  private readonly scanner = inject(BarcodeScanner);

  protected readonly units = UNITS;
  protected readonly saving = signal(false);
  /** Dropdown choices: the shop's active categories (managed on Products -> Categories). */
  protected readonly categoryOptions = signal<string[]>(this.data.categories ?? []);

  constructor() {
    // Typing a new name still works; inactive categories are just not offered.
    inject(CategoriesApi)
      .active()
      .subscribe({ next: (names) => this.categoryOptions.set(names), error: () => undefined });
  }

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
    barcode: [this.data.product?.barcode ?? this.data.barcode ?? ''],
    trackExpiry: [this.data.product?.trackExpiry ?? false],
    gstRate: [this.data.product?.gstRate ?? 0, [Validators.min(0), Validators.max(100)]],
    hsnCode: [this.data.product?.hsnCode ?? '', [Validators.pattern(/^(\d{4}|\d{6}|\d{8})?$/)]],
    priceIncludesGst: [this.data.product?.priceIncludesGst ?? true],
  });

  /** GST fields only for shops that bill with GST (not composition). */
  protected readonly gstOn = !!this.auth.user()?.billing?.gstEnabled && !this.auth.user()?.billing?.composition;
  protected readonly gstRates = GST_RATES;

  /** Live margin under the prices: percent of the selling price, and rupees per unit. */
  protected margin(): { pct: number; profit: string } | null {
    const { purchasePrice, sellingPrice } = this.form.getRawValue();
    if (!purchasePrice || !sellingPrice) return null;
    return {
      pct: Math.round(((sellingPrice - purchasePrice) / sellingPrice) * 1000) / 10,
      profit: formatPaise(toPaise(sellingPrice) - toPaise(purchasePrice)),
    };
  }

  protected scanBarcode(): void {
    this.scanner.scan().subscribe((code) => {
      if (code) this.form.controls.barcode.setValue(code);
    });
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
      trackExpiry: v.trackExpiry,
      // Sent only when the GST fields are shown, so other shops' products stay as they were.
      ...(this.gstOn ? { gstRate: Number(v.gstRate) || 0, hsnCode: v.hsnCode.trim(), priceIncludesGst: v.priceIncludesGst } : {}),
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
