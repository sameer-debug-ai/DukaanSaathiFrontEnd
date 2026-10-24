import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatCheckbox } from '@angular/material/checkbox';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { UNITS, type Unit } from '../../core/models/domain.models';
import { ProductsApi, type ProductInput } from '../../core/services/data.services';
import { ShareService } from '../../core/services/share.service';
import { ToastService } from '../../core/services/toast.service';
import { toPaise } from '../../core/utils/format';

const HEADER_ALIASES: Record<string, keyof ProductInput> = {
  name: 'name', product: 'name', 'product name': 'name', item: 'name',
  namehindi: 'nameHindi', 'hindi name': 'nameHindi', hindi: 'nameHindi',
  aliases: 'aliases', alias: 'aliases',
  category: 'category',
  unit: 'unit',
  purchaseprice: 'purchasePrice', 'purchase price': 'purchasePrice', cost: 'purchasePrice', 'buy price': 'purchasePrice',
  sellingprice: 'sellingPrice', 'selling price': 'sellingPrice', price: 'sellingPrice', 'sale price': 'sellingPrice', rate: 'sellingPrice',
  mrp: 'mrp',
  currentstock: 'openingStock', stock: 'openingStock', quantity: 'openingStock', qty: 'openingStock', 'opening stock': 'openingStock',
  lowstockthreshold: 'lowStockThreshold', threshold: 'lowStockThreshold', 'low stock': 'lowStockThreshold', 'min stock': 'lowStockThreshold',
  barcode: 'barcode',
};

const UNIT_ALIASES: Record<string, Unit> = { kilo: 'kg', kgs: 'kg', gram: 'g', gm: 'g', ltr: 'litre', liter: 'litre', l: 'litre', pcs: 'piece', pc: 'piece', pkt: 'packet' };

@Component({
  selector: 'app-import-dialog',
  imports: [MatDialogModule, MatButton, MatCheckbox, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>{{ 'import.title' | translate }}</h2>
    <mat-dialog-content>
      <p class="hint">{{ 'import.hint' | translate }}</p>
      <button mat-stroked-button type="button" (click)="downloadTemplate()">
        <span class="material-symbols-outlined">download</span> {{ 'import.template' | translate }}
      </button>
      <label class="drop" [class.has]="rows().length">
        <span class="material-symbols-outlined">upload_file</span>
        <span>{{ fileName() || ('import.choose' | translate) }}</span>
        <input type="file" accept=".csv,.xlsx,.xls" (change)="onFile($event)" />
      </label>
      @if (error()) {
        <p class="text-danger">{{ error() }}</p>
      }
      @if (rows().length) {
        <p>{{ 'import.ready' | translate: { count: rows().length } }}</p>
        <ul class="preview">
          @for (r of rows().slice(0, 5); track $index) {
            <li>{{ r.name }} · {{ r.unit }} · ₹{{ r.sellingPrice / 100 }}</li>
          }
        </ul>
        <mat-checkbox [checked]="updateExisting()" (change)="updateExisting.set($event.checked)">{{ 'import.updateExisting' | translate }}</mat-checkbox>
      }
      @if (result(); as r) {
        <p class="text-ok">{{ 'import.result' | translate: r }}</p>
        @for (e of r.errors.slice(0, 5); track e.row) {
          <p class="text-danger small">{{ 'import.rowError' | translate: e }}</p>
        }
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>{{ (result() ? 'common.close' : 'common.cancel') | translate }}</button>
      @if (!result()) {
        <button mat-flat-button [disabled]="!rows().length || busy()" (click)="import()">{{ 'import.start' | translate }}</button>
      }
    </mat-dialog-actions>
  `,
  styles: `
    .hint { color: var(--ds-muted); margin-top: 0; }
    .drop { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 24px; margin: 14px 0; border: 2px dashed var(--ds-line); border-radius: 14px; cursor: pointer; text-align: center; color: var(--ds-muted); }
    .drop.has { border-color: var(--ds-ok); color: var(--ds-ok); }
    .drop input { display: none; }
    .drop .material-symbols-outlined { font-size: 36px; }
    .preview { margin: 0 0 10px; padding-left: 18px; color: var(--ds-muted); font-size: 0.9rem; }
    .small { font-size: 0.85rem; margin: 2px 0; }
  `,
})
export class ImportDialog {
  private readonly api = inject(ProductsApi);
  private readonly toast = inject(ToastService);
  private readonly share = inject(ShareService);
  private readonly t = inject(TranslateService);
  private readonly ref = inject(MatDialogRef<ImportDialog, boolean>);

  protected readonly rows = signal<ProductInput[]>([]);
  protected readonly fileName = signal('');
  protected readonly error = signal('');
  protected readonly busy = signal(false);
  protected readonly updateExisting = signal(true);
  protected readonly result = signal<{ created: number; updated: number; failed: number; errors: { row: number; message: string }[] } | null>(null);

  protected downloadTemplate(): void {
    const csv = 'name,nameHindi,aliases,category,unit,purchasePrice,sellingPrice,mrp,currentStock,lowStockThreshold,barcode\nSugar,चीनी,cheeni|shakkar,Grocery,kg,40,45,48,25,10,\n';
    this.share.download(new Blob(['﻿' + csv], { type: 'text/csv' }), 'products-template.csv');
  }

  protected async onFile(ev: Event): Promise<void> {
    const file = (ev.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.fileName.set(file.name);
    this.error.set('');
    this.result.set(null);
    try {
      const XLSX = await import('xlsx');
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]!]!;
      const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
      const rows = raw.map((r) => this.mapRow(r)).filter((r): r is ProductInput => r !== null);
      if (!rows.length) this.error.set(this.t.instant('import.noRows'));
      this.rows.set(rows);
    } catch {
      this.error.set(this.t.instant('import.readError'));
      this.rows.set([]);
    }
  }

  private mapRow(r: Record<string, unknown>): ProductInput | null {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(r)) {
      const key = HEADER_ALIASES[k.trim().toLowerCase()];
      if (key) out[key] = v;
    }
    const name = String(out['name'] ?? '').trim();
    if (!name) return null;
    const unitRaw = String(out['unit'] ?? 'piece').trim().toLowerCase();
    const unit = (UNITS as readonly string[]).includes(unitRaw) ? (unitRaw as Unit) : UNIT_ALIASES[unitRaw] ?? 'piece';
    const num = (v: unknown) => Number(String(v ?? '').replace(/[^\d.]/g, '')) || 0;
    return {
      name,
      nameHindi: String(out['nameHindi'] ?? '').trim(),
      aliases: String(out['aliases'] ?? '').split(/[|,;]/).map((s) => s.trim()).filter(Boolean),
      category: String(out['category'] ?? '').trim() || 'General',
      unit,
      purchasePrice: toPaise(num(out['purchasePrice'])),
      sellingPrice: toPaise(num(out['sellingPrice'])),
      mrp: toPaise(num(out['mrp'])),
      openingStock: num(out['openingStock']),
      lowStockThreshold: out['lowStockThreshold'] !== undefined && out['lowStockThreshold'] !== '' ? num(out['lowStockThreshold']) : undefined,
      barcode: String(out['barcode'] ?? '').trim() || undefined,
    };
  }

  protected import(): void {
    this.busy.set(true);
    this.api.import(this.rows(), this.updateExisting()).subscribe({
      next: (r) => {
        this.busy.set(false);
        this.result.set(r);
        this.toast.success('import.done');
        if (!r.failed) setTimeout(() => this.ref.close(true), 1200);
      },
      error: (e) => {
        this.busy.set(false);
        this.toast.apiError(e);
      },
    });
  }
}
