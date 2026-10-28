import { ChangeDetectionStrategy, Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCheckbox } from '@angular/material/checkbox';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { TranslatePipe } from '@ngx-translate/core';
import { UNITS, type Candidate, type PaymentMode, type Product, type Supplier, type Unit } from '../../core/models/domain.models';
import { BillScanApi, BillScanDrafts, type BillScanDraft, type ScanItemStatus } from '../../core/services/bill-scan.api';
import { AppEvents, StockAlertsService } from '../../core/services/app-events.service';
import { ProductsApi, SuppliersApi, VoiceApi, type PurchaseInput } from '../../core/services/data.services';
import { ToastService } from '../../core/services/toast.service';
import { dayToIso, istDay, toPaise, toRupees } from '../../core/utils/format';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { InrPipe } from '../../shared/pipes/inr.pipe';
import { SupplierFormDialog } from '../suppliers/supplier-dialogs';
import { BillScanButton } from './bill-scan-button';
import { OrderDrafts } from './order-drafts';
import { scanAliases, scanToRows, totalsMismatch } from './purchase-scan';

interface Row {
  key: number;
  query: string;
  product: Product | null;
  /** When the product doesn't exist yet: created together with the purchase. */
  isNew: boolean;
  newUnit: Unit;
  newSellingPrice: number | null;
  qty: number | null;
  rate: number | null;
  /** Filled from a bill photo: the name as printed, how it matched, look-alikes to pick from. */
  scanName?: string;
  scanStatus?: ScanItemStatus;
  candidates?: Candidate[];
  /** Expiry-tracked products: this lot's expiry (YYYY-MM-DD). */
  expiry?: string;
}

let rowKey = 0;
const emptyRow = (): Row => ({ key: ++rowKey, query: '', product: null, isNew: false, newUnit: 'piece', newSellingPrice: null, qty: null, rate: null });

@Component({
  selector: 'app-purchase-form',
  imports: [
    FormsModule, MatAutocompleteModule, MatButton, MatIconButton, MatButtonToggleModule, MatCheckbox, MatFormFieldModule, MatInput,
    MatSelectModule, TranslatePipe, PageHeader, InrPipe, BillScanButton,
  ],
  templateUrl: './purchase-form.html',
  styleUrl: './purchase-form.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PurchaseForm implements OnInit {
  /** Prefill from query params (?supplierId=&productId=) e.g. "Reorder". */
  readonly supplierId = input<string>();
  readonly productId = input<string>();
  /** ?scan=1: open with the bill the voice panel just scanned. */
  readonly scan = input<string>();
  /** ?order=1: open with the order from the reorder list ("Maal aa gaya"). */
  readonly order = input<string>();

  private readonly suppliersApi = inject(SuppliersApi);
  private readonly productsApi = inject(ProductsApi);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly events = inject(AppEvents);
  private readonly alerts = inject(StockAlertsService);
  private readonly billScanApi = inject(BillScanApi);
  private readonly drafts = inject(BillScanDrafts);
  private readonly voiceApi = inject(VoiceApi);
  private readonly orderDrafts = inject(OrderDrafts);

  protected readonly units = UNITS;
  protected readonly suppliers = signal<Supplier[]>([]);
  protected readonly products = signal<Product[]>([]);
  protected readonly supplier = signal<string>('');
  protected readonly rows = signal<Row[]>([emptyRow()]);
  protected readonly paid = signal<number | null>(null);
  protected readonly mode = signal<PaymentMode>('cash');
  protected readonly invoice = signal('');
  protected readonly date = signal(istDay());
  protected readonly note = signal('');
  protected readonly updatePrice = signal(true);
  protected readonly saving = signal(false);
  protected readonly today = istDay();

  protected readonly total = computed(() => this.rows().reduce((s, r) => s + this.lineTotal(r), 0));
  protected readonly paidPaise = computed(() => toPaise(this.paid()));
  protected readonly due = computed(() => Math.max(0, this.total() - this.paidPaise()));

  // ---- Bill photo scan (review happens right here; nothing is saved until "Save purchase").
  protected readonly scanDraft = signal<BillScanDraft | null>(null);
  /** A scan that arrived before the product list loaded. */
  private pendingScan: BillScanDraft | null = null;
  private productsLoaded = false;
  /** Bill total minus the rows' total (paise), when they differ by more than ₹1. Live while editing. */
  protected readonly scanDiff = computed(() => {
    const d = this.scanDraft();
    return d ? totalsMismatch(this.total(), d.result.billTotal) : null;
  });
  protected readonly scanSupplierMissing = computed(() => {
    const s = this.scanDraft()?.result.supplier;
    return !!s && !this.supplier();
  });
  protected readonly scanUnreadable = computed(() => this.rows().filter((r) => r.scanStatus === 'unreadable' && !r.product).length);

  ngOnInit(): void {
    if (this.scan()) this.pendingScan = this.drafts.take();
    this.suppliersApi.list({ limit: 500, sort: 'name' }).subscribe({
      next: (r) => {
        this.suppliers.set(r.data);
        if (this.supplierId()) this.supplier.set(this.supplierId()!);
      },
      error: (e) => this.toast.apiError(e),
    });
    this.productsApi.list({ limit: 500, sort: 'name' }).subscribe({
      next: (r) => {
        this.products.set(r.items);
        const pid = this.productId();
        const p = pid ? r.items.find((x) => x.id === pid) : undefined;
        if (p) this.rows.set([{ ...emptyRow(), query: p.name, product: p, rate: toRupees(p.purchasePrice), qty: p.lowStockThreshold * 3 || 1 }]);
        const order = this.order() ? this.orderDrafts.take() : null;
        if (order) {
          const rows = order.items
            .map((i) => ({ i, p: r.items.find((x) => x.id === i.productId) }))
            .filter((x): x is { i: (typeof order.items)[number]; p: Product } => !!x.p)
            .map(({ i, p: prod }) => ({ ...emptyRow(), query: prod.name, product: prod, qty: i.qty, rate: toRupees(i.rate) }));
          if (rows.length) this.rows.set(rows);
          if (order.supplierId) this.supplier.set(order.supplierId);
        }
        this.productsLoaded = true;
        if (this.pendingScan) this.applyScan(this.pendingScan);
      },
      error: (e) => this.toast.apiError(e),
    });
  }

  protected filtered(q: string): Product[] {
    const s = q.trim().toLowerCase();
    const list = this.products();
    if (!s) return list.slice(0, 30);
    return list.filter((p) => p.name.toLowerCase().includes(s) || p.nameHindi?.includes(s) || p.aliases.some((a) => a.toLowerCase().includes(s))).slice(0, 30);
  }

  protected display = (p: Product | string | null): string => (typeof p === 'string' ? p : p?.name ?? '');

  protected pick(row: Row, p: Product): void {
    this.patch(row, { product: p, query: p.name, isNew: false, rate: row.rate ?? toRupees(p.purchasePrice) });
  }

  protected typed(row: Row, q: string | Product): void {
    // Selecting an option also emits the Product object through ngModel; pick() handles that.
    if (typeof q !== 'string') return;
    this.patch(row, { query: q, product: row.product && row.product.name === q ? row.product : null, isNew: false });
  }

  protected markNew(row: Row): void {
    this.patch(row, { isNew: true, product: null });
  }

  protected patch(row: Row, change: Partial<Row>): void {
    this.rows.update((rows) => rows.map((r) => (r.key === row.key ? { ...r, ...change } : r)));
  }

  protected addRow(): void {
    this.rows.update((r) => [...r, emptyRow()]);
  }

  protected removeRow(row: Row): void {
    this.rows.update((rows) => (rows.length > 1 ? rows.filter((r) => r.key !== row.key) : [emptyRow()]));
  }

  protected lineTotal(r: Row): number {
    return Math.round((Number(r.qty) || 0) * toPaise(r.rate));
  }

  protected payFull(): void {
    this.paid.set(toRupees(this.total()));
  }

  /** Fills supplier, invoice, date and rows from a scanned bill, for the user to check. */
  protected applyScan(d: BillScanDraft): void {
    if (!this.productsLoaded) {
      this.pendingScan = d; // applied once products load
      return;
    }
    this.pendingScan = null;
    const old = this.scanDraft();
    if (old && old.previewUrl !== d.previewUrl) URL.revokeObjectURL(old.previewUrl);
    this.scanDraft.set(d);
    const r = d.result;
    const sm = r.supplier?.match;
    if (sm?.status === 'matched' && sm.best) this.supplier.set(sm.best.id);
    if (r.invoiceNumber) this.invoice.set(r.invoiceNumber);
    if (r.date && r.date <= this.today) this.date.set(r.date);
    const rows = scanToRows(r, this.products()).map((x) => ({ ...emptyRow(), ...x }));
    this.rows.set(rows.length ? rows : [emptyRow()]);
  }

  /** A look-alike picked for a bill line ("check"). */
  protected pickCandidate(row: Row, c: Candidate): void {
    const p = this.products().find((x) => x.id === c.id);
    if (p) this.pick(row, p);
  }

  protected clearScan(): void {
    const d = this.scanDraft();
    if (d) URL.revokeObjectURL(d.previewUrl);
    this.scanDraft.set(null);
  }

  /** After the purchase is saved: keep the photo with it, and learn the bill names the user linked. */
  private afterScanSaved(purchaseId: string): void {
    const d = this.scanDraft();
    if (!d?.result.scanId) return;
    this.billScanApi.attach(d.result.scanId, purchaseId).subscribe({ error: () => this.toast.error('billScan.attachFailed') });
    const learn = scanAliases(this.rows(), d.result, this.supplier());
    if (learn.length) this.voiceApi.learnAliases(learn).subscribe({ error: () => undefined });
  }

  protected addSupplier(name = ''): void {
    this.dialog
      .open(SupplierFormDialog, { data: { name }, width: '480px', maxWidth: '96vw', autoFocus: false })
      .afterClosed()
      .subscribe((s?: Supplier) => {
        if (!s) return;
        this.suppliers.update((list) => [...list, { ...s, totalPurchased: 0, totalPaid: 0, purchaseCount: 0 }]);
        this.supplier.set(s.id);
      });
  }

  protected save(): void {
    if (!this.supplier()) return this.toast.error('purchases.selectSupplier');
    const rows = this.rows().filter((r) => r.query.trim() || r.product);
    if (!rows.length) return this.toast.error('purchases.addItem');
    for (const r of rows) {
      if (!r.product && !r.isNew) return this.toast.error('purchases.pickOrCreate', { name: r.query });
      if (!r.qty || r.qty <= 0 || r.rate === null || r.rate < 0) return this.toast.error('purchases.qtyRate', { name: r.query });
    }
    if (this.paidPaise() > this.total()) return this.toast.error('purchases.paidTooMuch');

    const body: PurchaseInput = {
      supplierId: this.supplier(),
      items: rows.map((r) =>
        r.product
          ? { productId: r.product.id, qty: Number(r.qty), rate: toPaise(r.rate), ...(r.product.trackExpiry && r.expiry ? { expiryDate: r.expiry } : {}) }
          : { newProduct: { name: r.query.trim(), unit: r.newUnit, sellingPrice: toPaise(r.newSellingPrice) }, qty: Number(r.qty), rate: toPaise(r.rate) },
      ),
      paidAmount: this.paidPaise(),
      paymentMode: this.mode(),
      invoiceNumber: this.invoice().trim(),
      date: dayToIso(this.date()),
      note: this.note().trim(),
      updatePurchasePrice: this.updatePrice(),
    };
    this.saving.set(true);
    this.suppliersApi.createPurchase(body).subscribe({
      next: (p) => {
        this.afterScanSaved(p.id);
        this.toast.success('purchases.saved');
        this.alerts.refresh();
        this.events.changed('purchases');
        void this.router.navigate(['/suppliers', p.supplierId]);
      },
      error: (e) => {
        this.saving.set(false);
        this.toast.apiError(e);
      },
    });
  }
}
