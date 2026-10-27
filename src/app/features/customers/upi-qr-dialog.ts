import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { TranslatePipe } from '@ngx-translate/core';
import { ToastService } from '../../core/services/toast.service';
import { qrDataUrl } from '../../core/utils/upi';
import { InrPipe } from '../../shared/pipes/inr.pipe';

export interface UpiQrData {
  name: string;
  amount: number;
  link: string;
  /** Same QR without the amount (like the shop's own UPI app QR); the customer types the amount. */
  staticLink: string;
  vpa: string;
}

/** Big UPI QR for the pending amount: the customer scans it at the counter with any UPI app. */
@Component({
  selector: 'app-upi-qr-dialog',
  imports: [MatDialogModule, MatButton, MatIconButton, TranslatePipe, InrPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="head">
      <h2 mat-dialog-title>{{ 'upi.scanToPay' | translate }}</h2>
      <button mat-icon-button mat-dialog-close [attr.aria-label]="'common.close' | translate"><span class="material-symbols-outlined">close</span></button>
    </div>
    <mat-dialog-content class="body">
      <p class="who">{{ data.name }}</p>
      <p class="amt">{{ data.amount | inr }}</p>
      <div class="modes" role="group" [attr.aria-label]="'upi.qrType' | translate">
        <button type="button" [class.on]="withAmount()" (click)="setMode(true)">{{ 'upi.withAmount' | translate }}</button>
        <button type="button" [class.on]="!withAmount()" (click)="setMode(false)">{{ 'upi.withoutAmount' | translate }}</button>
      </div>
      @if (!withAmount()) {
        <p class="tip">{{ 'upi.typeAmount' | translate: { amount: (data.amount | inr) } }}</p>
      }
      @if (qr(); as src) {
        <img [src]="src" [alt]="'upi.qrAlt' | translate: { amount: (data.amount | inr) }" width="260" height="260" />
      } @else {
        <div class="ph" aria-hidden="true"></div>
      }
      <p class="vpa">{{ 'upi.payTo' | translate }} <strong>{{ data.vpa }}</strong></p>
      @if (withAmount()) {
        <p class="tip">{{ 'upi.failHint' | translate }}</p>
      }
    </mat-dialog-content>
    <mat-dialog-actions class="acts">
      <button mat-stroked-button type="button" (click)="copy()"><span class="material-symbols-outlined">content_copy</span>{{ 'upi.copyLink' | translate }}</button>
      <a mat-flat-button [href]="link()"><span class="material-symbols-outlined">open_in_new</span>{{ 'upi.openApp' | translate }}</a>
    </mat-dialog-actions>
  `,
  styles: `
    .head { display: flex; align-items: center; justify-content: space-between; padding-right: 8px; }
    .body { display: flex; flex-direction: column; align-items: center; text-align: center; }
    .who { margin: 0; font-weight: 600; }
    .amt { margin: 2px 0 12px; font-size: 1.8rem; font-weight: 700; color: var(--ds-danger); font-variant-numeric: tabular-nums; }
    img, .ph { width: 260px; height: 260px; max-width: 70vw; max-height: 70vw; border-radius: 12px; background: #fff; padding: 8px; box-sizing: content-box; }
    .vpa { margin: 12px 0 0; color: var(--ds-muted); overflow-wrap: anywhere; }
    .modes { display: inline-flex; margin-bottom: 12px; border: 1px solid var(--ds-line); border-radius: 999px; overflow: hidden; }
    .modes button { border: 0; background: none; color: inherit; font: inherit; font-size: 0.85rem; padding: 6px 14px; cursor: pointer; }
    .modes button.on { background: var(--ds-brand); color: #fff; }
    .tip { margin: 8px 0 0; font-size: 0.85rem; color: var(--ds-muted); max-width: 300px; }
    .acts { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  `,
})
export class UpiQrDialog {
  protected readonly data = inject<UpiQrData>(MAT_DIALOG_DATA);
  private readonly toast = inject(ToastService);
  protected readonly qr = signal<string | null>(null);
  protected readonly withAmount = signal(true);
  protected readonly link = computed(() => (this.withAmount() ? this.data.link : this.data.staticLink));

  constructor() {
    this.render();
  }

  protected setMode(withAmount: boolean): void {
    if (withAmount === this.withAmount()) return;
    this.withAmount.set(withAmount);
    this.render();
  }

  private render(): void {
    this.qr.set(null);
    const link = this.link();
    qrDataUrl(link).then(
      (src) => this.link() === link && this.qr.set(src),
      () => this.toast.error('common.genericError'),
    );
  }

  protected copy(): void {
    void navigator.clipboard?.writeText(this.link()).then(
      () => this.toast.success('upi.copied'),
      () => undefined,
    );
  }
}
