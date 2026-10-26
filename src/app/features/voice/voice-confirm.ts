import { ChangeDetectionStrategy, Component, computed, inject, input, OnInit, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatDialog } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { UNITS, type Candidate, type Customer, type EntityMatch, type Supplier, type Unit, type VoiceParseResult } from '../../core/models/domain.models';
import { dayToIso, toPaise, toRupees } from '../../core/utils/format';
import { formatPaise, InrPipe } from '../../shared/pipes/inr.pipe';
import { formatIstDate } from '../../shared/pipes/ist-date.pipe';
import { CustomerFormDialog } from '../customers/customer-form-dialog';
import { SupplierFormDialog } from '../suppliers/supplier-dialogs';
import type { AliasLearning } from '../../core/services/data.services';
import type { ConfirmedCommand } from './voice-executor.service';

interface EditableItem {
  key: number;
  name: string;
  productId?: string;
  productName?: string;
  candidates: Candidate[];
  qty: number;
  unit: string | null;
  rate: number | null; // paise
}

interface Picked {
  id?: string;
  name?: string;
  match?: EntityMatch;
  /** Not in the list yet: add a new customer with this name on confirm. */
  create?: string;
}

const NEEDS_CUSTOMER = new Set(['add_credit', 'receive_payment']);
const NEEDS_SUPPLIER = new Set(['add_purchase', 'supplier_payment']);
const HAS_ITEMS = new Set(['add_credit', 'add_purchase', 'add_sale']);
const HAS_AMOUNT = new Set(['add_credit', 'receive_payment', 'supplier_payment', 'add_purchase']);

/** Review card shown before ANY voice command is saved: [Yes] [Edit] [Cancel]. */
@Component({
  selector: 'app-voice-confirm',
  imports: [FormsModule, MatButton, MatIconButton, MatButtonToggleModule, TranslatePipe, InrPipe],
  templateUrl: './voice-confirm.html',
  styleUrl: './voice-confirm.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VoiceConfirm implements OnInit {
  readonly result = input.required<VoiceParseResult>();
  readonly busy = input(false);
  readonly confirmed = output<ConfirmedCommand>();
  readonly cancelled = output<void>();

  private readonly dialog = inject(MatDialog);
  private readonly t = inject(TranslateService);

  protected readonly units = UNITS;
  protected readonly editing = signal(false);
  protected readonly customer = signal<Picked>({});
  protected readonly supplier = signal<Picked>({});
  protected readonly product = signal<Picked>({});
  protected readonly items = signal<EditableItem[]>([]);
  protected readonly amountRs = signal<number | null>(null);
  protected readonly paidRs = signal<number | null>(null);
  protected readonly quantity = signal<number | null>(null);
  protected readonly unit = signal<Unit | null>(null);
  protected readonly sellingRs = signal<number | null>(null);
  protected readonly productName = signal('');
  protected readonly mode = signal<'cash' | 'upi' | 'udhaar' | 'bank'>('cash');
  protected readonly date = signal<string | null>(null);

  protected readonly intent = computed(() => this.result().intent);
  protected readonly needsCustomer = computed(() => NEEDS_CUSTOMER.has(this.intent()) || (this.intent() === 'add_sale' && this.mode() === 'udhaar'));
  protected readonly showCustomer = computed(() => this.needsCustomer() || (this.intent() === 'add_sale' && !!this.result().customer));
  protected readonly needsSupplier = computed(() => NEEDS_SUPPLIER.has(this.intent()));
  protected readonly hasItems = computed(() => HAS_ITEMS.has(this.intent()));
  protected readonly hasAmount = computed(() => HAS_AMOUNT.has(this.intent()));

  protected readonly itemsTotal = computed(() => {
    const list = this.items();
    if (!list.length || list.some((i) => i.rate === null)) return null;
    return list.reduce((s, i) => s + Math.round(i.qty * (i.rate ?? 0)), 0);
  });

  /** Credit with fully matched items is booked as an udhaar sale (amount = items total). */
  protected readonly effectiveAmount = computed(() => {
    const i = this.intent();
    if ((i === 'add_sale' || i === 'add_purchase' || (i === 'add_credit' && this.allItemsMatched())) && this.itemsTotal() !== null) return this.itemsTotal();
    return this.amountRs() !== null ? toPaise(this.amountRs()) : null;
  });

  protected readonly allItemsMatched = computed(() => this.items().length > 0 && this.items().every((i) => !!i.productId && i.rate !== null));

  protected readonly problems = computed(() => {
    const p: string[] = [];
    if (this.needsCustomer() && !this.customer().id && !this.customer().create?.trim()) p.push('voice.err.customer');
    if (this.needsSupplier() && !this.supplier().id) p.push('voice.err.supplier');
    if (this.hasAmount() && !this.effectiveAmount()) p.push('voice.err.amount');
    if (this.intent() === 'add_sale' && (!this.items().length || this.items().some((i) => !i.productId))) p.push('voice.err.products');
    if (this.intent() === 'add_purchase' && this.items().some((i) => i.rate === null)) p.push('voice.err.rate');
    if (this.intent() === 'adjust_stock') {
      if (!this.product().id) p.push('voice.err.product');
      if (!this.quantity()) p.push('voice.err.quantity');
    }
    if (this.intent() === 'add_product') {
      if (!this.productName().trim()) p.push('voice.err.productName');
      if (!this.sellingRs()) p.push('voice.err.price');
    }
    return p;
  });

  protected readonly summary = computed(() => {
    const amount = formatPaise(this.effectiveAmount() ?? 0);
    const params = {
      amount,
      name: this.customer().name ?? this.customer().create ?? this.result().parsed.customerName ?? '?',
      supplier: this.supplier().name ?? this.result().parsed.supplierName ?? '?',
      product: this.product().name ?? this.result().parsed.productName ?? '?',
      qty: Math.abs(this.quantity() ?? 0),
      unit: this.unit() ?? '',
      paid: formatPaise(toPaise(this.paidRs())),
      items: this.items().map((i) => `${i.qty} ${i.unit ?? ''} ${i.productName ?? i.name}`.replace(/\s+/g, ' ')).join(', '),
      newName: this.productName(),
      price: formatPaise(toPaise(this.sellingRs())),
      mode: this.t.instant(`pay.${this.mode()}`),
    };
    const i = this.intent();
    const key =
      i === 'add_credit' && this.items().length
        ? 'voice.ask.creditItems'
        : i === 'adjust_stock' && (this.quantity() ?? 0) < 0
          ? 'voice.ask.stockDown'
          : this.result().settleFull && (i === 'receive_payment' || i === 'supplier_payment')
            ? `voice.ask.${i}_full`
            : `voice.ask.${i}`;
    return this.t.instant(key, params);
  });

  protected readonly dateLabel = computed(() => (this.date() ? formatIstDate(`${this.date()}T12:00:00+05:30`) : this.t.instant('range.today')));

  ngOnInit(): void {
    const r = this.result();
    this.customer.set(this.fromMatch(r.customer));
    // Someone new taking udhaar: ready to be added on "Yes", no extra dialog needed.
    if (!this.customer().id && r.newCustomerName) this.customer.update((p) => ({ ...p, create: r.newCustomerName }));
    this.supplier.set(this.fromMatch(r.supplier));
    this.product.set(r.intent === 'add_product' ? {} : this.fromMatch(r.product));
    let key = 0;
    this.items.set(
      r.items.map((i) => ({
        key: ++key,
        name: i.spokenName,
        productId: i.match.status !== 'not_found' ? i.match.best?.id : undefined,
        productName: i.match.status !== 'not_found' ? i.match.best?.name : undefined,
        candidates: i.match.candidates,
        qty: i.qty,
        unit: i.unit,
        rate: i.rate,
      })),
    );
    this.amountRs.set(r.amount !== null ? toRupees(r.amount) : null);
    this.paidRs.set(r.paidAmount !== null ? toRupees(r.paidAmount) : null);
    this.quantity.set(r.quantity);
    this.unit.set(r.parsed.unit);
    this.sellingRs.set(r.parsed.sellingPrice !== null ? toRupees(r.parsed.sellingPrice) : null);
    this.productName.set(r.parsed.productName ?? '');
    this.mode.set(r.paymentMode ?? (r.intent === 'add_sale' && r.customer ? 'udhaar' : 'cash'));
    this.date.set(r.date);
    // Open the editor straight away when something needs the user's attention.
    if (this.problems().length || r.confidence < 0.6) this.editing.set(true);
  }

  private fromMatch(m?: EntityMatch): Picked {
    if (!m) return {};
    // Only auto-select a confident, unambiguous match; otherwise the user picks.
    return m.status === 'matched' && m.best ? { id: m.best.id, name: m.best.name, match: m } : { match: m };
  }

  /** Switch from "pick one of these" to "add as a new customer". */
  protected addAsNew(): void {
    const name = this.result().newCustomerName ?? this.result().parsed.customerName ?? '';
    this.customer.update((p) => ({ match: p.match, create: name }));
  }

  protected setNewName(name: string): void {
    this.customer.update((p) => ({ ...p, create: name }));
  }

  protected choose(which: 'customer' | 'supplier' | 'product', c: Candidate): void {
    this[which].update((p) => ({ ...p, id: c.id, name: c.name, create: undefined }));
    // "Sara udhaar de diya": the amount follows whichever customer/supplier is picked.
    const balance = this.result().balances?.[c.id];
    if (this.result().settleFull && which !== 'product' && balance !== undefined) this.amountRs.set(toRupees(balance));
  }

  protected clearPick(which: 'customer' | 'supplier' | 'product'): void {
    this[which].update((p) => ({ match: p.match }));
  }

  /** "Pick an existing customer instead" from the new-customer box. */
  protected pickExisting(): void {
    this.customer.update((p) => ({ match: p.match }));
  }

  protected createCustomer(): void {
    this.dialog
      .open(CustomerFormDialog, {
        data: { name: this.customer().create ?? this.result().newCustomerName ?? this.result().parsed.customerName ?? '' },
        width: '480px',
        maxWidth: '96vw',
        autoFocus: false,
      })
      .afterClosed()
      .subscribe((c?: Customer) => c && this.customer.update((p) => ({ ...p, id: c.id, name: c.name, create: undefined })));
  }

  protected createSupplier(): void {
    this.dialog
      .open(SupplierFormDialog, { data: { name: this.result().parsed.supplierName ?? '' }, width: '480px', maxWidth: '96vw', autoFocus: false })
      .afterClosed()
      .subscribe((s?: Supplier) => s && this.supplier.update((p) => ({ ...p, id: s.id, name: s.name })));
  }

  protected pickItem(item: EditableItem, c: Candidate): void {
    this.patchItem(item, { productId: c.id, productName: c.name });
  }

  protected patchItem(item: EditableItem, change: Partial<EditableItem>): void {
    this.items.update((list) => list.map((i) => (i.key === item.key ? { ...i, ...change } : i)));
  }

  protected setQty(item: EditableItem, v: number | string): void {
    const qty = Number(v);
    if (Number.isFinite(qty) && qty > 0) this.patchItem(item, { qty });
  }

  protected removeItem(item: EditableItem): void {
    this.items.update((list) => list.filter((i) => i.key !== item.key));
  }

  protected rupees(paise: number | null): number | null {
    return paise === null ? null : toRupees(paise);
  }

  protected setRate(item: EditableItem, rupees: number | null): void {
    this.patchItem(item, { rate: rupees === null || (rupees as unknown) === '' ? null : toPaise(rupees) });
  }

  protected confirm(): void {
    if (this.problems().length) {
      this.editing.set(true);
      return;
    }
    const r = this.result();
    this.confirmed.emit({
      intent: r.intent,
      text: r.text,
      customerId: this.customer().id,
      customerName: this.customer().name ?? this.customer().create?.trim(),
      newCustomerName: this.customer().id ? undefined : this.customer().create?.trim() || undefined,
      supplierId: this.supplier().id,
      supplierName: this.supplier().name,
      productId: this.product().id,
      productName: r.intent === 'add_product' ? this.productName().trim() : this.product().name,
      amount: this.effectiveAmount(),
      paidAmount: this.paidRs() !== null ? toPaise(this.paidRs()) : null,
      quantity: this.quantity(),
      unit: this.unit(),
      sellingPrice: this.sellingRs() !== null ? toPaise(this.sellingRs()) : null,
      paymentMode: this.mode(),
      date: this.date() ? dayToIso(this.date()) : undefined,
      items: this.items().map((i) => ({ productId: i.productId, name: i.productName ?? i.name, qty: i.qty, unit: i.unit, rate: i.rate })),
      logId: r.logId,
      learn: this.learnedAliases(),
    });
  }

  /**
   * Spoken names the user resolved by hand: a pick among several candidates, or an unknown
   * name linked to an existing record. Saved as aliases so next time they match directly.
   */
  private learnedAliases(): AliasLearning[] {
    const out: AliasLearning[] = [];
    const learnPick = (kind: AliasLearning['kind'], p: Picked) => {
      const spoken = p.match?.query?.trim();
      if (!p.id || !spoken) return;
      if (p.match?.status === 'matched' && p.match.best?.id === p.id) return; // understood already
      out.push({ kind, id: p.id, alias: spoken });
    };
    learnPick('customer', this.customer());
    learnPick('supplier', this.supplier());
    if (this.intent() !== 'add_product') learnPick('product', this.product());
    const original = new Map(this.result().items.map((i) => [i.spokenName, i.match]));
    for (const item of this.items()) {
      const m = original.get(item.name);
      if (!item.productId || !m || (m.status === 'matched' && m.best?.id === item.productId)) continue;
      out.push({ kind: 'product', id: item.productId, alias: item.name });
    }
    return out;
  }

  protected readonly formatPaise = formatPaise;
}
