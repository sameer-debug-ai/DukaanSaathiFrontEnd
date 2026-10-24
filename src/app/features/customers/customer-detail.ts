import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatMenuModule } from '@angular/material/menu';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { AuthService } from '../../core/auth/auth.service';
import type { CustomerDetail as Detail, CustomerLedger } from '../../core/models/domain.models';
import { AppEvents } from '../../core/services/app-events.service';
import { CustomersApi } from '../../core/services/data.services';
import { LanguageService } from '../../core/services/language.service';
import { PdfService } from '../../core/services/pdf.service';
import { ShareService } from '../../core/services/share.service';
import { ToastService } from '../../core/services/toast.service';
import { ConfirmService } from '../../shared/components/confirm-dialog/confirm-dialog';
import { EmptyState } from '../../shared/components/empty-state/empty-state';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { Skeleton } from '../../shared/components/skeleton/skeleton';
import { InrPipe } from '../../shared/pipes/inr.pipe';
import { IstDatePipe } from '../../shared/pipes/ist-date.pipe';
import { CustomerFormDialog } from './customer-form-dialog';
import { LedgerEntryDialog } from './ledger-entry-dialog';
import { reminderMessage } from './reminder';

@Component({
  selector: 'app-customer-detail',
  imports: [RouterLink, MatButton, MatIconButton, MatMenuModule, TranslatePipe, PageHeader, Skeleton, EmptyState, InrPipe, IstDatePipe],
  templateUrl: './customer-detail.html',
  styleUrl: './customer-detail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerDetailPage {
  readonly id = input.required<string>();
  private readonly api = inject(CustomersApi);
  private readonly dialog = inject(MatDialog);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly events = inject(AppEvents);
  private readonly share = inject(ShareService);
  private readonly pdf = inject(PdfService);
  private readonly auth = inject(AuthService);
  private readonly lang = inject(LanguageService);
  private readonly router = inject(Router);
  private readonly t = inject(TranslateService);

  protected readonly customer = signal<Detail | null>(null);
  protected readonly ledger = signal<CustomerLedger | null>(null);
  /** Newest first for display; running balance is computed oldest-first on the server. */
  protected readonly entries = computed(() => [...(this.ledger()?.entries ?? [])].reverse());
  protected readonly pdfBusy = signal(false);

  constructor() {
    effect(() => {
      const id = this.id();
      this.events.version();
      untracked(() => this.load(id));
    });
  }

  private load(id: string): void {
    this.api.get(id).subscribe({ next: (c) => this.customer.set(c), error: (e) => this.toast.apiError(e) });
    this.api.ledger(id).subscribe({ next: (l) => this.ledger.set(l), error: (e) => this.toast.apiError(e) });
  }

  protected entry(type: 'credit' | 'payment'): void {
    const c = this.customer();
    if (!c) return;
    this.dialog
      .open(LedgerEntryDialog, { data: { customer: c, type }, width: '460px', maxWidth: '96vw', autoFocus: false })
      .afterClosed()
      .subscribe((ok) => ok && this.events.changed('customers'));
  }

  protected edit(): void {
    const c = this.customer();
    if (!c) return;
    this.dialog
      .open(CustomerFormDialog, { data: { customer: c }, width: '480px', maxWidth: '96vw', autoFocus: false })
      .afterClosed()
      .subscribe((r) => r && this.events.changed('customers'));
  }

  protected remindUrl(): string {
    const c = this.customer();
    const shop = this.auth.user();
    if (!c || !shop) return '#';
    return this.share.whatsappUrl(
      c.phone,
      reminderMessage({ customerName: c.name, amount: c.currentBalance, shopName: shop.shopName, shopPhone: shop.phone, lang: this.lang.current() }),
    );
  }

  protected async statement(): Promise<void> {
    const l = this.ledger();
    if (!l) return;
    this.pdfBusy.set(true);
    try {
      const file = await this.pdf.customerStatement(l);
      this.share.download(file, file.name);
    } catch {
      this.toast.error('common.genericError');
    } finally {
      this.pdfBusy.set(false);
    }
  }

  protected remove(): void {
    const c = this.customer();
    if (!c) return;
    const message =
      c.currentBalance !== 0
        ? this.t.instant('customers.confirmDeleteWithBalance', { name: c.name })
        : this.t.instant('customers.confirmDelete', { name: c.name });
    this.confirm.ask({ message, confirmText: this.t.instant('common.delete'), danger: true }).subscribe((ok) => {
      if (!ok) return;
      this.api.remove(c.id).subscribe({
        next: () => {
          this.toast.success('customers.deleted');
          this.events.changed('customers');
          void this.router.navigateByUrl('/customers');
        },
        error: (e) => this.toast.apiError(e),
      });
    });
  }

  protected describe(e: CustomerLedger['entries'][number]): string {
    const items = e.items.map((i) => `${i.name} × ${i.qty}`).join(', ');
    const fallback = e.type === 'credit' ? this.t.instant('ledger.creditDefault') : this.t.instant('ledger.paymentDefault');
    return [e.note, items].filter((s) => !!s).join(' · ') || fallback;
  }
}
