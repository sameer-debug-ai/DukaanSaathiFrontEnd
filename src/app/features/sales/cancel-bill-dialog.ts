import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { TranslatePipe } from '@ngx-translate/core';
import { InrPipe } from '../../shared/pipes/inr.pipe';

export interface CancelBillData {
  label: string;
  /** Paid at the counter: has to be returned by hand. */
  paid: number;
  /** Udhaar that will be taken off the customer's khata. */
  credit: number;
}

/** Asks for the reason before a bill is cancelled; closes with the reason (or nothing). */
@Component({
  selector: 'app-cancel-bill-dialog',
  imports: [FormsModule, MatButton, MatDialogModule, TranslatePipe, InrPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>{{ 'bill.cancelTitle' | translate: { label: data.label } }}</h2>
    <mat-dialog-content>
      <ul class="effects">
        <li>{{ 'bill.cancelStock' | translate }}</li>
        @if (data.credit) {
          <li>{{ 'bill.cancelUdhaar' | translate: { amount: (data.credit | inr) } }}</li>
        }
        @if (data.paid) {
          <li class="warn">{{ 'bill.cancelRefund' | translate: { amount: (data.paid | inr) } }}</li>
        }
        <li>{{ 'bill.cancelKeep' | translate }}</li>
      </ul>
      <label class="lbl" for="cancel-reason">{{ 'bill.cancelReason' | translate }}</label>
      <textarea
        id="cancel-reason"
        rows="2"
        maxlength="200"
        [ngModel]="reason()"
        (ngModelChange)="reason.set($event)"
        [placeholder]="'bill.cancelReasonHint' | translate"
        cdkFocusInitial
      ></textarea>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>{{ 'common.cancel' | translate }}</button>
      <button mat-flat-button class="danger" [disabled]="reason().trim().length < 3" (click)="ref.close(reason().trim())">{{ 'bill.cancelConfirm' | translate }}</button>
    </mat-dialog-actions>
  `,
  styles: `
    .effects { margin: 0 0 12px; padding-left: 18px; color: var(--ds-muted); font-size: 0.9rem; display: grid; gap: 4px; }
    .effects .warn { color: var(--ds-warn); font-weight: 600; }
    .lbl { display: block; font-weight: 600; margin-bottom: 4px; }
    textarea { width: 100%; box-sizing: border-box; border: 1px solid var(--ds-line); border-radius: 10px; padding: 10px; font: inherit; background: var(--ds-surface); color: var(--ds-text); resize: vertical; }
    .danger { background: var(--ds-danger, #b91c1c) !important; color: #fff !important; }
    .danger:disabled { opacity: 0.5; }
  `,
})
export class CancelBillDialog {
  protected readonly data = inject<CancelBillData>(MAT_DIALOG_DATA);
  protected readonly ref = inject(MatDialogRef<CancelBillDialog, string>);
  protected readonly reason = signal('');
}
