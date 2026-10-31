import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { AuthService } from '../../core/auth/auth.service';
import type { PaperSize } from '../../core/models/api.models';
import type { Sale } from '../../core/models/domain.models';
import { amountDue, billLabel, GST_STATES, sellerOf } from '../../core/utils/bill';
import { formatQty } from '../../core/utils/format';
import { qrDataUrl, shopUpiLink } from '../../core/utils/upi';
import { InrPipe } from '../../shared/pipes/inr.pipe';
import { IstDatePipe } from '../../shared/pipes/ist-date.pipe';

/**
 * The printed bill. One component, three layouts: 58 mm and 80 mm thermal rolls (monospace,
 * two-line items, nothing wasted) and A4 (table with HSN / tax columns). Screen, print and
 * the PDF share the same content.
 */
@Component({
  selector: 'app-bill-document',
  imports: [TranslatePipe, InrPipe, IstDatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class]': '"bill-doc " + (thermal() ? "thermal w" + size().replace("mm", "") : "a4")' },
  template: `
    @let s = sale();
    @let me = seller();
    @let gst = s.docType === 'tax_invoice';
    @if (s.status === 'cancelled') {
      <div class="void">{{ 'bill.cancelled' | translate }}</div>
    }

    <header class="head">
      @if (logo()) {
        <img class="logo" [src]="logo()" alt="" />
      }
      <div class="shop">
        <div class="shop-name">{{ me.name }}</div>
        @if (me.address) { <div>{{ me.address }}</div> }
        @if (me.phone) { <div>{{ 'bill.ph' | translate }} {{ me.phone }}</div> }
        @if (me.gstin) { <div class="gstin">GSTIN: {{ me.gstin }}</div> }
      </div>
    </header>

    <div class="title">{{ ('bill.doc.' + (s.docType ?? 'bill')) | translate }}</div>

    <div class="meta">
      <div><span class="k">{{ 'bill.no' | translate }}</span> <b>{{ label() }}</b></div>
      <div><span class="k">{{ 'bill.date' | translate }}</span> {{ s.date | istDate: true }}</div>
      @if (buyer(); as b) {
        <div class="to">
          <span class="k">{{ 'bill.to' | translate }}</span> <b>{{ b.name || ('billing.walkIn' | translate) }}</b>
          @if (b.phone) { <span> · {{ b.phone }}</span> }
          @if (b.gstin) { <div>GSTIN: {{ b.gstin }}</div> }
          @if (gst && placeOfSupply()) { <div>{{ 'bill.pos' | translate }}: {{ placeOfSupply() }}</div> }
        </div>
      } @else {
        <div><span class="k">{{ 'bill.to' | translate }}</span> {{ 'billing.walkIn' | translate }}</div>
      }
    </div>

    @if (thermal()) {
      <div class="rule"></div>
      <div class="row hdr"><span>{{ 'sales.item' | translate }}</span><span>{{ 'common.amount' | translate }}</span></div>
      <div class="rule"></div>
      @for (i of s.items; track $index) {
        <div class="it">
          <div class="it-name">{{ i.name }}</div>
          <div class="row">
            <span>{{ qty(i.qty, i.unit) }} × {{ i.rate | inr }}@if (gst) { · {{ i.gstRate ?? 0 }}%}</span>
            <span>{{ i.total | inr }}</span>
          </div>
          @if (gst && i.hsnCode) { <div class="hsn">HSN {{ i.hsnCode }}</div> }
        </div>
      }
      <div class="rule"></div>
    } @else {
      <table class="lines">
        <thead>
          <tr>
            <th class="n">#</th>
            <th>{{ 'sales.item' | translate }}</th>
            @if (gst) { <th>HSN</th> }
            <th class="num">{{ 'common.qty' | translate }}</th>
            <th class="num">{{ 'purchases.rate' | translate }}</th>
            @if (gst) {
              <th class="num">{{ 'bill.taxable' | translate }}</th>
              <th class="num">GST</th>
            }
            <th class="num">{{ 'common.amount' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          @for (i of s.items; track $index) {
            <tr>
              <td class="n">{{ $index + 1 }}</td>
              <td>{{ i.name }}</td>
              @if (gst) { <td>{{ i.hsnCode }}</td> }
              <td class="num">{{ qty(i.qty, i.unit) }}</td>
              <td class="num">{{ i.rate | inr }}</td>
              @if (gst) {
                <td class="num">{{ i.taxable ?? 0 | inr }}</td>
                <td class="num">{{ i.gstRate ?? 0 }}%</td>
              }
              <td class="num">{{ i.total | inr }}</td>
            </tr>
          }
        </tbody>
      </table>
    }

    <div class="totals">
      <div class="row"><span>{{ 'billing.subtotal' | translate }}</span><span>{{ s.subtotal | inr }}</span></div>
      @if (s.discount) {
        <div class="row"><span>{{ 'billing.discount' | translate }}</span><span>− {{ s.discount | inr }}</span></div>
      }
      @if (gst) {
        <div class="row"><span>{{ 'bill.taxable' | translate }}</span><span>{{ s.taxableTotal ?? 0 | inr }}</span></div>
        @if (s.interState) {
          <div class="row"><span>IGST</span><span>{{ s.igst ?? 0 | inr }}</span></div>
        } @else {
          <div class="row"><span>CGST</span><span>{{ s.cgst ?? 0 | inr }}</span></div>
          <div class="row"><span>SGST</span><span>{{ s.sgst ?? 0 | inr }}</span></div>
        }
        @if (s.taxAdded) {
          <div class="row note"><span>{{ 'bill.taxAddedNote' | translate }}</span><span>+ {{ s.taxAdded | inr }}</span></div>
        }
        @if (s.roundOff) {
          <div class="row"><span>{{ 'bill.roundOff' | translate }}</span><span>{{ s.roundOff | inr: true }}</span></div>
        }
      }
      <div class="row grand"><span>{{ 'common.total' | translate }}</span><span>{{ s.totalAmount | inr }}</span></div>
      <div class="row"><span>{{ 'sales.paid' | translate }} ({{ ('pay.' + s.paymentMode) | translate }})</span><span>{{ s.paidAmount | inr }}</span></div>
      @if (s.creditAmount) {
        <div class="row due"><span>{{ 'billing.toUdhaar' | translate }}</span><span>{{ s.creditAmount | inr }}</span></div>
      }
    </div>

    @if (s.amountInWords; as w) {
      <p class="words">{{ lang() === 'hi' ? w.hi : w.en }}</p>
    }

    @if (gst && s.taxSummary?.length) {
      <table class="taxsum">
        <thead>
          <tr>
            <th>GST %</th>
            <th class="num">{{ 'bill.taxable' | translate }}</th>
            @if (s.interState) { <th class="num">IGST</th> } @else {
              <th class="num">CGST</th>
              <th class="num">SGST</th>
            }
          </tr>
        </thead>
        <tbody>
          @for (t of s.taxSummary; track t.rate) {
            <tr>
              <td>{{ t.rate }}%</td>
              <td class="num">{{ t.taxable | inr }}</td>
              @if (s.interState) { <td class="num">{{ t.igst | inr }}</td> } @else {
                <td class="num">{{ t.cgst | inr }}</td>
                <td class="num">{{ t.sgst | inr }}</td>
              }
            </tr>
          }
        </tbody>
      </table>
    }

    @if (s.docType === 'bill_of_supply') {
      <p class="decl">{{ 'bill.compositionNote' | translate }}</p>
    }

    @if (qr(); as q) {
      <div class="qr">
        <img [src]="q" alt="UPI QR" />
        <div>{{ 'bill.scanToPay' | translate: { amount: (dueNow() | inr) } }}</div>
      </div>
    }

    @if (s.status === 'cancelled' && s.cancelReason) {
      <p class="decl">{{ 'bill.cancelReason' | translate }}: {{ s.cancelReason }}</p>
    }

    <footer class="foot">
      <div>{{ footer() || ('sales.thanks' | translate) }}</div>
      @if (!thermal() && gst) {
        <div class="sign">{{ 'bill.for' | translate }} {{ me.name }}<br /><br />{{ 'bill.signatory' | translate }}</div>
      }
    </footer>
  `,
  styles: `
    :host { display: block; color: #111; background: #fff; }
    .void { text-align: center; font-weight: 800; letter-spacing: 0.2em; color: #b91c1c; border: 2px solid #b91c1c; padding: 2px; margin-bottom: 6px; }
    .head { display: flex; gap: 10px; align-items: center; }
    .logo { max-height: 56px; max-width: 120px; object-fit: contain; }
    .shop-name { font-weight: 800; font-size: 1.15em; }
    .gstin { font-weight: 600; }
    .title { font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; margin: 8px 0 4px; }
    .k { color: #555; margin-right: 0.4em; }
    .row { display: flex; justify-content: space-between; gap: 8px; }
    .row > span:last-child { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
    .grand { font-weight: 800; font-size: 1.15em; }
    .due { font-weight: 700; }
    .note { color: #555; }
    .words { font-style: italic; margin: 6px 0; }
    .decl { font-size: 0.85em; color: #444; }
    .qr { display: flex; flex-direction: column; align-items: center; gap: 2px; margin-top: 8px; }
    .qr img { width: 120px; height: 120px; }
    .foot { margin-top: 10px; text-align: center; }
    table { width: 100%; border-collapse: collapse; }
    .num { text-align: right; font-variant-numeric: tabular-nums; }

    /* ---- Thermal roll: monospace, everything centred and tight ---- */
    :host(.thermal) { font-family: 'Courier New', ui-monospace, monospace; line-height: 1.25; padding: 2mm; }
    :host(.w58) { width: 58mm; font-size: 10.5px; }
    :host(.w80) { width: 80mm; font-size: 12px; }
    :host(.thermal) .head { flex-direction: column; text-align: center; gap: 2px; }
    :host(.thermal) .logo { max-height: 40px; }
    :host(.thermal) .title { text-align: center; }
    :host(.thermal) .rule { border-top: 1px dashed #000; margin: 3px 0; }
    :host(.thermal) .hdr { font-weight: 700; }
    :host(.thermal) .it { margin: 2px 0; }
    :host(.thermal) .it-name { font-weight: 600; }
    :host(.thermal) .hsn { font-size: 0.85em; color: #444; }
    :host(.thermal) .totals { margin-top: 2px; }
    :host(.thermal) .grand { border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 2px 0; margin: 2px 0; }
    :host(.thermal) .taxsum { margin-top: 4px; font-size: 0.9em; }
    :host(.thermal) .taxsum th { text-align: left; border-bottom: 1px dashed #000; }
    :host(.thermal) .taxsum th.num { text-align: right; }

    /* ---- A4 ---- */
    :host(.a4) { font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; font-size: 13px; padding: 4px; }
    :host(.a4) .head { border-bottom: 2px solid #1e5fa8; padding-bottom: 8px; }
    :host(.a4) .shop-name { font-size: 1.4em; color: #1e5fa8; }
    :host(.a4) .title { text-align: right; font-size: 1.1em; color: #1e5fa8; }
    :host(.a4) .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 2px 16px; margin-bottom: 10px; }
    :host(.a4) .meta .to { grid-column: 1 / -1; padding: 6px 8px; background: #f5f7fa; border-radius: 6px; }
    :host(.a4) .lines th, :host(.a4) .taxsum th { background: #1e5fa8; color: #fff; text-align: left; padding: 6px; font-weight: 600; }
    :host(.a4) .lines th.num, :host(.a4) .taxsum th.num { text-align: right; }
    :host(.a4) .lines td, :host(.a4) .taxsum td { padding: 5px 6px; border-bottom: 1px solid #e5e7eb; }
    :host(.a4) .lines .n { width: 28px; }
    :host(.a4) .totals { margin: 10px 0 0 auto; width: min(320px, 100%); }
    :host(.a4) .totals .row { padding: 2px 0; }
    :host(.a4) .grand { border-top: 2px solid #111; padding-top: 4px; }
    :host(.a4) .taxsum { margin-top: 12px; width: min(420px, 100%); }
    :host(.a4) .foot { display: flex; justify-content: space-between; align-items: flex-end; text-align: left; }
    :host(.a4) .sign { text-align: right; }
  `,
})
export class BillDocument {
  private readonly auth = inject(AuthService);
  readonly sale = input.required<Sale>();
  readonly size = input<PaperSize>('a4');
  /** Language of the "amount in words" line. */
  readonly lang = input<'en' | 'hi'>('en');

  protected readonly thermal = computed(() => this.size() !== 'a4');
  protected readonly label = computed(() => billLabel(this.sale()));
  protected readonly seller = computed(() => sellerOf(this.sale(), this.auth));
  protected readonly logo = computed(() => this.auth.user()?.billing?.logo || '');
  protected readonly footer = computed(() => this.auth.user()?.billing?.footerNote || '');
  protected readonly buyer = computed(() => {
    const s = this.sale();
    if (s.buyer?.name || s.buyer?.gstin) return s.buyer;
    const c = s.customer;
    if (c) return { name: c.name, phone: c.phone ?? '', address: c.address ?? '', gstin: c.gstin ?? '', stateCode: c.stateCode ?? '' };
    return s.customerName ? { name: s.customerName, phone: '', address: '', gstin: '', stateCode: '' } : null;
  });
  protected readonly placeOfSupply = computed(() => {
    const code = this.sale().buyer?.stateCode || this.sale().seller?.stateCode || '';
    return code ? `${code}-${GST_STATES[code] ?? ''}` : '';
  });
  protected readonly dueNow = computed(() => amountDue(this.sale()));
  protected readonly qr = signal<string | null>(null);

  protected qty = formatQty;

  constructor() {
    // UPI QR for whatever is left to pay (udhaar part), when the shop has a UPI ID and wants it.
    effect(() => {
      const due = this.dueNow();
      const u = this.auth.user();
      const link = due > 0 && u?.billing?.showUpiQr !== false ? shopUpiLink(u?.settings, this.seller().name, due, this.label()) : null;
      if (!link) return this.qr.set(null);
      qrDataUrl(link, 240).then(
        (q) => this.qr.set(q),
        () => this.qr.set(null),
      );
    });
  }
}
