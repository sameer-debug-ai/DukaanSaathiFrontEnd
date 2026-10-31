import { ChangeDetectionStrategy, Component, computed, effect, ElementRef, inject, input, signal, untracked, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { AuthService } from '../../core/auth/auth.service';
import type { PaperSize } from '../../core/models/api.models';
import type { Sale } from '../../core/models/domain.models';
import { AppEvents, StockAlertsService } from '../../core/services/app-events.service';
import { BillPrintService } from '../../core/services/bill-print.service';
import { BillingApi } from '../../core/services/billing.api';
import { BluetoothPrinter } from '../../core/services/bluetooth-printer.service';
import { SalesApi } from '../../core/services/data.services';
import { PdfService } from '../../core/services/pdf.service';
import { ShareService } from '../../core/services/share.service';
import { ToastService } from '../../core/services/toast.service';
import { buildEscPos } from '../../core/utils/escpos';
import { formatQty, rsText } from '../../core/utils/format';
import { shopUpiLink } from '../../core/utils/upi';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { Skeleton } from '../../shared/components/skeleton/skeleton';
import { formatIstDate } from '../../shared/pipes/ist-date.pipe';
import { amountDue, billLabel, sellerOf } from '../../core/utils/bill';
import { BillDocument } from './bill-document';
import { CancelBillDialog, type CancelBillData } from './cancel-bill-dialog';

const SIZES: PaperSize[] = ['58mm', '80mm', 'a4'];

/** A saved bill: preview in the chosen paper size, print / Bluetooth print, PDF + WhatsApp, cancel. */
@Component({
  selector: 'app-sale-view',
  imports: [RouterLink, MatButton, TranslatePipe, PageHeader, Skeleton, BillDocument],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="ds-page max-w-3xl">
      @if (sale(); as s) {
        <div class="no-print">
          <app-page-header [title]="('sales.bill' | translate) + ' ' + label()" [subtitle]="date()" backLink="/sales" />
        </div>

        @if (s.status === 'cancelled') {
          <div class="ds-card cancelled no-print">
            <span class="material-symbols-outlined">block</span>
            <div>
              <strong>{{ 'bill.cancelledOn' | translate: { date: cancelledOn() } }}</strong>
              <p>{{ s.cancelReason }}</p>
            </div>
          </div>
        }

        <div class="paper no-print" role="radiogroup" [attr.aria-label]="'bill.paperSize' | translate">
          <span class="lbl">{{ 'bill.paperSize' | translate }}</span>
          @for (p of sizes; track p) {
            <button type="button" class="ds-chip" role="radio" [attr.aria-checked]="size() === p" [class.active]="size() === p" (click)="setSize(p)">
              {{ ('bill.size.' + p) | translate }}
            </button>
          }
        </div>

        <div class="preview" [class.thermal]="size() !== 'a4'">
          <app-bill-document #doc [sale]="s" [size]="size()" [lang]="lang()" />
        </div>

        <div class="actions no-print">
          <button mat-flat-button class="ds-big-btn" (click)="print()">
            <span class="material-symbols-outlined">print</span>{{ 'sales.print' | translate }}
          </button>
          @if (size() !== 'a4') {
            <button mat-stroked-button class="ds-big-btn" (click)="printBluetooth()" [disabled]="btBusy()">
              <span class="material-symbols-outlined">{{ btBusy() ? 'progress_activity' : 'bluetooth' }}</span>
              {{ (bt.printerName() ? 'bill.btPrintTo' : 'bill.btPrint') | translate: { name: bt.printerName() } }}
            </button>
          }
          <button mat-stroked-button class="ds-big-btn" (click)="whatsapp(s)">
            <span class="material-symbols-outlined">chat</span>{{ 'sales.shareWhatsapp' | translate }}
          </button>
          <button mat-stroked-button class="ds-big-btn" (click)="downloadPdf(s)" [disabled]="busy()">
            <span class="material-symbols-outlined">picture_as_pdf</span>PDF
          </button>
          <a mat-stroked-button class="ds-big-btn" routerLink="/sales/new">
            <span class="material-symbols-outlined">add</span>{{ 'dashboard.newBill' | translate }}
          </a>
          @if (s.status !== 'cancelled') {
            <button mat-button class="ds-big-btn cancel-btn" (click)="cancelBill(s)" [disabled]="busy()">
              <span class="material-symbols-outlined">block</span>{{ 'bill.cancel' | translate }}
            </button>
          }
        </div>
        @if (btHelp()) {
          <p class="bt-help no-print" role="status">{{ btHelp()! | translate }}</p>
        }
      } @else {
        <app-skeleton [rows]="3" [height]="120" />
      }
    </section>
  `,
  styles: `
    .paper { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin: 4px 0 12px; }
    .paper .lbl { color: var(--ds-muted); font-size: 0.9rem; margin-right: 4px; }
    .preview { background: #fff; border: 1px solid var(--ds-line); border-radius: 14px; padding: 16px; overflow-x: auto; }
    .preview.thermal { display: flex; justify-content: center; background: var(--ds-surface); }
    .preview.thermal app-bill-document { box-shadow: 0 2px 10px rgb(0 0 0 / 0.12); }
    .cancelled { display: flex; gap: 10px; align-items: flex-start; padding: 12px 14px; margin-bottom: 12px; border-left: 4px solid #b91c1c; }
    .cancelled .material-symbols-outlined { color: #b91c1c; }
    .cancelled p { margin: 2px 0 0; color: var(--ds-muted); }
    .actions { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-top: 16px; }
    @media (min-width: 600px) { .actions { grid-template-columns: repeat(3, 1fr); } }
    .cancel-btn { color: #b91c1c !important; }
    .bt-help { margin: 10px 2px 0; padding: 10px 12px; border-radius: 10px; background: var(--ds-surface); color: var(--ds-text); font-size: 0.9rem; }
    @media print { .preview { border: 0; padding: 0; } }
  `,
})
export class SaleView {
  readonly id = input.required<string>();
  private readonly api = inject(SalesApi);
  private readonly billing = inject(BillingApi);
  private readonly pdf = inject(PdfService);
  private readonly share = inject(ShareService);
  private readonly toast = inject(ToastService);
  private readonly t = inject(TranslateService);
  private readonly dialog = inject(MatDialog);
  private readonly printer = inject(BillPrintService);
  private readonly events = inject(AppEvents);
  private readonly alerts = inject(StockAlertsService);
  protected readonly bt = inject(BluetoothPrinter);
  protected readonly auth = inject(AuthService);
  private readonly docRef = viewChild('doc', { read: ElementRef });

  protected readonly sizes = SIZES;
  protected readonly sale = signal<Sale | null>(null);
  protected readonly busy = signal(false);
  protected readonly btBusy = signal(false);
  protected readonly btHelp = signal<string | null>(null);
  /** The shop's paper from Settings; the chips change it for this bill only. */
  protected readonly size = signal<PaperSize>(this.auth.user()?.billing?.paperSize ?? 'a4');
  protected readonly lang = signal<'en' | 'hi'>(this.t.currentLang === 'hi' ? 'hi' : 'en');
  protected readonly label = computed(() => (this.sale() ? billLabel(this.sale()!) : ''));
  protected readonly date = computed(() => formatIstDate(this.sale()?.date, true));
  protected readonly cancelledOn = computed(() => formatIstDate(this.sale()?.cancelledAt, true));

  constructor() {
    effect(() => {
      const id = this.id();
      untracked(() => this.api.get(id).subscribe({ next: (s) => this.sale.set(s), error: (e) => this.toast.apiError(e) }));
    });
    if (!SIZES.includes(this.size())) this.size.set('a4');
  }

  protected setSize(p: PaperSize): void {
    this.size.set(p);
    this.btHelp.set(null);
  }

  protected print(): void {
    const el = this.docRef()?.nativeElement as HTMLElement | undefined;
    if (el) void this.printer.print(el, this.size());
  }

  protected async printBluetooth(): Promise<void> {
    const s = this.sale();
    const size = this.size();
    if (!s || size === 'a4') return;
    const why = this.bt.unsupportedReason();
    if (why) {
      this.btHelp.set(`bill.btUnsupported.${why}`);
      return;
    }
    this.btHelp.set(null);
    this.btBusy.set(true);
    try {
      const seller = sellerOf(s, this.auth);
      const due = amountDue(s);
      const u = this.auth.user();
      const bytes = buildEscPos(
        {
          sale: s,
          seller,
          label: billLabel(s),
          dateText: formatIstDate(s.date, true),
          buyerName: s.buyer?.name || s.customer?.name || s.customerName || '',
          footer: u?.billing?.footerNote ?? '',
          upiLink: due > 0 && u?.billing?.showUpiQr !== false ? shopUpiLink(u?.settings, seller.name, due, billLabel(s)) : null,
        },
        size,
      );
      await this.bt.print(bytes);
      this.toast.success('bill.btDone');
    } catch (e) {
      const name = (e as { name?: string })?.name;
      // NotFoundError = the user closed the device picker: not an error.
      if (name !== 'NotFoundError') {
        this.bt.forget();
        this.btHelp.set('bill.btFailed');
      }
    } finally {
      this.btBusy.set(false);
    }
  }

  protected async downloadPdf(s: Sale): Promise<void> {
    this.busy.set(true);
    try {
      const file = await this.pdf.bill(s);
      this.share.download(file, file.name);
    } finally {
      this.busy.set(false);
    }
  }

  protected async whatsapp(s: Sale): Promise<void> {
    const shop = sellerOf(s, this.auth);
    const lines = s.items.map((i) => `• ${i.name} ${formatQty(i.qty, i.unit)} = ${rsText(i.total)}`).join('\n');
    const text =
      `*${shop.name || 'DukaanSathi'}*\n${this.t.instant('sales.bill')} ${billLabel(s)} · ${formatIstDate(s.date, true)}\n\n${lines}\n\n` +
      (s.discount ? `${this.t.instant('billing.discount')}: -${rsText(s.discount)}\n` : '') +
      (s.taxTotal ? `GST: ${rsText(s.taxTotal)}\n` : '') +
      `*${this.t.instant('common.total')}: ${rsText(s.totalAmount)}*\n` +
      (s.creditAmount ? `${this.t.instant('billing.toUdhaar')}: ${rsText(s.creditAmount)}\n` : '') +
      `\n${this.auth.user()?.billing?.footerNote || this.t.instant('sales.thanks')}`;
    // On phones, try sharing the PDF itself; otherwise open WhatsApp with the text bill.
    try {
      const file = await this.pdf.bill(s);
      if (await this.share.shareFile(file, `${this.t.instant('sales.bill')} ${billLabel(s)}`, text)) return;
    } catch {
      /* fall through to text share */
    }
    this.share.openWhatsapp(s.customer?.phone, text);
  }

  protected cancelBill(s: Sale): void {
    const data: CancelBillData = { label: billLabel(s), paid: s.paidAmount, credit: s.creditAmount };
    this.dialog
      .open(CancelBillDialog, { data, width: '440px', maxWidth: '96vw' })
      .afterClosed()
      .subscribe((reason?: string) => {
        if (!reason) return;
        this.busy.set(true);
        this.billing.cancel(s.id, reason).subscribe({
          next: (updated) => {
            this.busy.set(false);
            this.sale.set({ ...s, ...updated, customer: s.customer, amountInWords: s.amountInWords });
            this.toast.success('bill.cancelledToast', { label: billLabel(s) });
            this.alerts.refresh();
            this.events.changed('sales');
            this.events.changed('customers');
          },
          error: (e) => {
            this.busy.set(false);
            this.toast.apiError(e);
          },
        });
      });
  }
}
