import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { AuthService } from '../../core/auth/auth.service';
import type { Customer, Product, SalePaymentMode } from '../../core/models/domain.models';
import { AppEvents, StockAlertsService } from '../../core/services/app-events.service';
import { CustomersApi, ProductsApi, SalesApi } from '../../core/services/data.services';
import { ToastService } from '../../core/services/toast.service';
import { toPaise } from '../../core/utils/format';
import { ConfirmService } from '../../shared/components/confirm-dialog/confirm-dialog';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { InrPipe } from '../../shared/pipes/inr.pipe';
import { CustomerFormDialog } from '../customers/customer-form-dialog';

interface CartLine {
  product: Product;
  qty: number;
  rate: number; // paise
}

/** Quick mobile-first billing: search / scan, tap to add, adjust qty, choose payment, save. */
@Component({
  selector: 'app-billing',
  imports: [FormsModule, MatAutocompleteModule, MatButton, MatIconButton, MatButtonToggleModule, MatFormFieldModule, MatInput, TranslatePipe, PageHeader, InrPipe],
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
  protected readonly itemCount = computed(() => this.cart().reduce((s, l) => s + l.qty, 0));
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
