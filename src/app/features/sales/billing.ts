import { HttpErrorResponse } from '@angular/common/http';
import { afterNextRender, ChangeDetectionStrategy, Component, computed, ElementRef, inject, Injector, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatDialog } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { AuthService } from '../../core/auth/auth.service';
import type { Customer, Product, SalePaymentMode } from '../../core/models/domain.models';
import { AppEvents, StockAlertsService } from '../../core/services/app-events.service';
import { BarcodeScanner } from '../../core/services/barcode-scanner.service';
import { CustomersApi, ProductsApi, SalesApi } from '../../core/services/data.services';
import { ToastService } from '../../core/services/toast.service';
import { toPaise } from '../../core/utils/format';
import { ConfirmService } from '../../shared/components/confirm-dialog/confirm-dialog';
import { InrPipe } from '../../shared/pipes/inr.pipe';
import { CustomerFormDialog } from '../customers/customer-form-dialog';
import { VoiceUi } from '../voice/voice-ui.service';

const MODES: { value: SalePaymentMode; icon: string }[] = [
  { value: 'cash', icon: 'payments' },
  { value: 'upi', icon: 'qr_code_2' },
  { value: 'udhaar', icon: 'menu_book' },
  { value: 'partial', icon: 'call_split' },
];

/** Soft background/foreground pairs for product avatars, picked per category. */
const TINTS = [
  { bg: '#e3eefb', fg: '#1e5fa8' },
  { bg: '#dcfce7', fg: '#15803d' },
  { bg: '#ffedd5', fg: '#c2570c' },
  { bg: '#fce7f3', fg: '#be185d' },
  { bg: '#ede9fe', fg: '#6d28d9' },
  { bg: '#cffafe', fg: '#0e7490' },
  { bg: '#fef9c3', fg: '#a16207' },
];

interface CartLine {
  product: Product;
  qty: number;
  rate: number; // paise
}

/** Quick mobile-first billing: search / scan, tap to add, adjust qty, choose payment, save. */
@Component({
  selector: 'app-billing',
  imports: [FormsModule, MatAutocompleteModule, TranslatePipe, InrPipe],
  templateUrl: './billing.html',
  styleUrl: './billing.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Billing implements OnInit {
  private readonly productsApi = inject(ProductsApi);
  private readonly customersApi = inject(CustomersApi);
  private readonly salesApi = inject(SalesApi);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly confirm = inject(ConfirmService);
  private readonly events = inject(AppEvents);
  private readonly alerts = inject(StockAlertsService);
  private readonly auth = inject(AuthService);
  private readonly t = inject(TranslateService);
  private readonly scanner = inject(BarcodeScanner);
  protected readonly voice = inject(VoiceUi);
  protected readonly modes = MODES;

  protected readonly products = signal<Product[]>([]);
  protected readonly customers = signal<Customer[]>([]);
  protected readonly query = signal('');
  protected readonly category = signal('');
  protected readonly cart = signal<CartLine[]>([]);
  protected readonly customer = signal<Customer | null>(null);
  protected readonly customerQuery = signal('');
  protected readonly discount = signal<number | null>(null);
  protected readonly mode = signal<SalePaymentMode>('cash');
  protected readonly paid = signal<number | null>(null);
  protected readonly saving = signal(false);
  protected readonly showCart = signal(false);
  protected readonly showDiscount = signal(false);
  /** Product id of the line just added; highlighted briefly. */
  protected readonly lastAdded = signal<string | null>(null);
  private flashTimer?: ReturnType<typeof setTimeout>;
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  protected readonly categories = computed(() => [...new Set(this.products().map((p) => p.category))].sort());
  protected readonly visible = computed(() => {
    const q = this.query().trim().toLowerCase();
    const cat = this.category();
    return this.products()
      .filter((p) => !cat || p.category === cat)
      .filter((p) => !q || p.name.toLowerCase().includes(q) || p.nameHindi?.includes(q) || p.barcode === q || p.aliases.some((a) => a.toLowerCase().includes(q)))
      .slice(0, 60);
  });
  protected readonly subtotal = computed(() => this.cart().reduce((s, l) => s + Math.round(l.qty * l.rate), 0));
  protected readonly discountPaise = computed(() => Math.min(toPaise(this.discount()), this.subtotal()));
  protected readonly total = computed(() => this.subtotal() - this.discountPaise());
  /** Quantity of each product already in the bill, for the badge on its tile. */
  protected readonly cartQty = computed(() => new Map(this.cart().map((l) => [l.product.id, l.qty])));
  private readonly tintByCategory = computed(() => new Map(this.categories().map((c, i) => [c, TINTS[i % TINTS.length]!])));
  protected tint(category: string) {
    return this.tintByCategory().get(category) ?? TINTS[0]!;
  }
  protected readonly shortages = computed(() => this.cart().filter((l) => l.qty > l.product.currentStock));
  protected readonly credit = computed(() => {
    if (this.mode() === 'udhaar') return this.total();
    if (this.mode() === 'partial') return Math.max(0, this.total() - toPaise(this.paid()));
    return 0;
  });
  protected readonly filteredCustomers = computed(() => {
    const q = this.customerQuery().trim().toLowerCase();
    return this.customers()
      .filter((c) => !q || c.name.toLowerCase().includes(q) || c.phone.includes(q) || c.aliases.some((a) => a.toLowerCase().includes(q)))
      .slice(0, 20);
  });

  ngOnInit(): void {
    this.productsApi.list({ limit: 500, sort: 'name' }).subscribe({ next: (r) => this.products.set(r.items), error: (e) => this.toast.apiError(e) });
    this.customersApi.list({ limit: 500, sort: 'name' }).subscribe({ next: (r) => this.customers.set(r.data), error: () => undefined });
  }

  protected add(p: Product): void {
    const step = p.unit === 'kg' || p.unit === 'litre' ? 1 : 1;
    this.cart.update((lines) => {
      const found = lines.find((l) => l.product.id === p.id);
      if (found) return lines.map((l) => (l.product.id === p.id ? { ...l, qty: Math.round((l.qty + step) * 1000) / 1000 } : l));
      return [...lines, { product: p, qty: step, rate: p.sellingPrice }];
    });
    if (p.currentStock <= 0) this.toast.info('billing.outOfStockWarn', { name: p.name });
    this.revealLine(p.id);
  }

  /** Scrolls the bill to the item just tapped and flashes it, so it never lands out of sight. */
  private revealLine(productId: string): void {
    this.lastAdded.set(productId);
    clearTimeout(this.flashTimer);
    this.flashTimer = setTimeout(() => this.lastAdded.set(null), 900);
    afterNextRender(
      () => {
        const row = this.host.nativeElement.querySelector<HTMLElement>(`.lines [data-line="${productId}"]`);
        row?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      },
      { injector: this.injector },
    );
  }

  /** Enter in the search box: exact barcode match or the only result gets added. */
  protected onEnter(): void {
    const q = this.query().trim();
    const byCode = this.products().find((p) => p.barcode && p.barcode === q);
    const target = byCode ?? (this.visible().length === 1 ? this.visible()[0] : undefined);
    if (target) {
      this.add(target);
      this.query.set('');
    }
  }

  /** Camera scan: adds the product with this barcode to the bill. */
  protected scanToAdd(): void {
    this.scanner.scan({ titleKey: 'scan.billing' }).subscribe((code) => {
      if (!code) return;
      const p = this.products().find((x) => x.barcode && x.barcode === code);
      if (!p) return this.toast.error('scan.notInShop', { code });
      this.add(p);
      this.toast.success('scan.added', { name: p.name });
    });
  }

  protected setQty(line: CartLine, qty: number): void {
    const q = Math.round((Number(qty) || 0) * 1000) / 1000;
    if (q <= 0) return this.remove(line);
    this.cart.update((lines) => lines.map((l) => (l.product.id === line.product.id ? { ...l, qty: q } : l)));
  }

  protected step(line: CartLine, delta: number): void {
    const unitStep = line.product.unit === 'kg' || line.product.unit === 'litre' ? 0.5 : 1;
    this.setQty(line, line.qty + delta * unitStep);
  }

  protected setRate(line: CartLine, rupees: number): void {
    this.cart.update((lines) => lines.map((l) => (l.product.id === line.product.id ? { ...l, rate: toPaise(rupees) } : l)));
  }

  protected remove(line: CartLine): void {
    this.cart.update((lines) => lines.filter((l) => l.product.id !== line.product.id));
  }

  protected clear(): void {
    this.cart.set([]);
    this.discount.set(null);
    this.showDiscount.set(false);
    this.paid.set(null);
    this.customer.set(null);
    this.customerQuery.set('');
    this.mode.set('cash');
  }

  protected pickCustomer(c: Customer | string): void {
    if (typeof c === 'string') {
      this.customerQuery.set(c);
      if (this.customer() && this.customer()!.name !== c) this.customer.set(null);
      return;
    }
    this.customer.set(c);
    this.customerQuery.set(c.name);
  }

  protected displayCustomer = (c: Customer | string | null) => (typeof c === 'string' ? c : c?.name ?? '');

  protected newCustomer(): void {
    this.dialog
      .open(CustomerFormDialog, { data: { name: this.customerQuery() }, width: '480px', maxWidth: '96vw', autoFocus: false })
      .afterClosed()
      .subscribe((c?: Customer) => {
        if (!c) return;
        this.customers.update((list) => [...list, c]);
        this.pickCustomer(c);
        this.events.changed('customers');
      });
  }

  protected save(allowOversell = false): void {
    if (!this.cart().length) return this.toast.error('billing.emptyCart');
    if (this.credit() > 0 && !this.customer()) return this.toast.error('billing.needCustomer');
    if (this.mode() === 'partial' && (toPaise(this.paid()) <= 0 || toPaise(this.paid()) >= this.total())) return this.toast.error('billing.partialInvalid');

    this.saving.set(true);
    this.salesApi
      .create({
        customerId: this.customer()?.id,
        items: this.cart().map((l) => ({ productId: l.product.id, qty: l.qty, rate: l.rate })),
        discount: this.discountPaise(),
        paymentMode: this.mode(),
        paidAmount: this.mode() === 'partial' ? toPaise(this.paid()) : undefined,
        allowOversell,
      })
      .subscribe({
        next: (sale) => {
          this.toast.success('billing.saved', { number: sale.billNumber });
          this.alerts.refresh();
          this.events.changed('sales');
          void this.router.navigate(['/sales', sale.id]);
        },
        error: (e: unknown) => {
          this.saving.set(false);
          const code = (e as HttpErrorResponse)?.error?.details?.code;
          if (code === 'INSUFFICIENT_STOCK' && this.auth.user()?.settings.allowOversell && !allowOversell) {
            this.confirm
              .ask({ title: this.t.instant('billing.lowStockTitle'), message: (e as HttpErrorResponse).error.message + '. ' + this.t.instant('billing.sellAnyway'), confirmText: this.t.instant('billing.sellAnywayBtn') })
              .subscribe((ok) => ok && this.save(true));
            return;
          }
          this.toast.apiError(e);
        },
      });
  }
}
