import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { TranslatePipe } from '@ngx-translate/core';
import type { Customer } from '../../core/models/domain.models';
import { CustomersApi } from '../../core/services/data.services';
import { ToastService } from '../../core/services/toast.service';
import { dayToIso, istDay, toPaise, toRupees } from '../../core/utils/format';
import { InrPipe } from '../../shared/pipes/inr.pipe';

export interface LedgerEntryData {
  customer: Customer;
  type: 'credit' | 'payment';
}

/** "Add udhaar" or "Receive payment" (full / partial) for one customer. */
@Component({
  selector: 'app-ledger-entry-dialog',
  imports: [ReactiveFormsModule, MatDialogModule, MatButton, MatButtonToggleModule, MatFormFieldModule, MatInput, TranslatePipe, InrPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>
      {{ (isCredit ? 'ledger.addCreditTitle' : 'ledger.receiveTitle') | translate: { name: data.customer.name } }}
    </h2>
    <form [formGroup]="form" (ngSubmit)="save()" novalidate>
      <mat-dialog-content>
        <p class="bal">
          {{ 'ledger.currentBalance' | translate }}:
          <strong [class.amount-credit]="data.customer.currentBalance > 0">{{ data.customer.currentBalance | inr }}</strong>
        </p>
        @if (!isCredit && data.customer.currentBalance > 0) {
          <div class="quick">
            <button type="button" mat-stroked-button (click)="setAmount(data.customer.currentBalance)">{{ 'ledger.fullAmount' | translate }}</button>
            <button type="button" mat-stroked-button (click)="setAmount(half())">{{ 'ledger.half' | translate }}</button>
          </div>
        }
        <mat-form-field appearance="outline" class="amount">
          <mat-label>{{ 'common.amount' | translate }}</mat-label>
          <span matTextPrefix>₹&nbsp;</span>
          <input matInput type="number" inputmode="decimal" formControlName="amount" min="1" cdkFocusInitial />
          <mat-error>{{ 'ledger.amountRequired' | translate }}</mat-error>
        </mat-form-field>
        @if (!isCredit) {
          <mat-button-toggle-group formControlName="mode" class="modes" [attr.aria-label]="'ledger.mode' | translate">
            <mat-button-toggle value="cash">{{ 'pay.cash' | translate }}</mat-button-toggle>
            <mat-button-toggle value="upi">{{ 'pay.upi' | translate }}</mat-button-toggle>
            <mat-button-toggle value="bank">{{ 'pay.bank' | translate }}</mat-button-toggle>
          </mat-button-toggle-group>
        }
        <mat-form-field appearance="outline">
          <mat-label>{{ 'common.note' | translate }}</mat-label>
          <input matInput formControlName="note" [placeholder]="(isCredit ? 'ledger.creditNotePlaceholder' : 'ledger.paymentNotePlaceholder') | translate" />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>{{ 'common.date' | translate }}</mat-label>
          <input matInput type="date" formControlName="date" [max]="today" />
        </mat-form-field>
        @if (afterBalance(); as after) {
          <p class="after">{{ 'ledger.balanceAfter' | translate }}: <strong>{{ after.value | inr }}</strong></p>
        }
        @if (overLimit()) {
          <p class="text-warn">{{ 'ledger.overLimit' | translate: { limit: (data.customer.creditLimit ?? 0) | inr } }}</p>
        }
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" mat-dialog-close>{{ 'common.cancel' | translate }}</button>
        <button mat-flat-button type="submit" [disabled]="saving()" [class]="isCredit ? 'btn-credit' : 'btn-payment'">
          {{ (isCredit ? 'ledger.addCredit' : 'ledger.receive') | translate }}
        </button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `
    .bal { margin: 0 0 12px; }
    .quick { display: flex; gap: 8px; margin-bottom: 12px; }
    .amount input { font-size: 1.3rem; font-weight: 600; }
    .modes { width: 100%; display: grid; grid-template-columns: repeat(3, 1fr); margin-bottom: 16px; }
    .after { color: var(--ds-muted); margin: 0; }
    .btn-credit { --mdc-filled-button-container-color: var(--ds-danger); --mat-button-filled-container-color: var(--ds-danger); }
    .btn-payment { --mdc-filled-button-container-color: var(--ds-ok); --mat-button-filled-container-color: var(--ds-ok); }
  `,
})
export class LedgerEntryDialog {
  protected readonly data = inject<LedgerEntryData>(MAT_DIALOG_DATA);
  private readonly ref = inject(MatDialogRef<LedgerEntryDialog, boolean>);
  private readonly api = inject(CustomersApi);
  private readonly toast = inject(ToastService);
  protected readonly isCredit = this.data.type === 'credit';
  protected readonly saving = signal(false);
  protected readonly today = istDay();

  protected readonly form = inject(NonNullableFormBuilder).group({
    amount: [null as unknown as number, [Validators.required, Validators.min(1)]],
    mode: ['cash' as 'cash' | 'upi' | 'bank'],
    note: [''],
    date: [istDay()],
  });

  protected half(): number {
    return Math.round(this.data.customer.currentBalance / 2 / 100) * 100;
  }

  protected setAmount(paise: number): void {
    this.form.controls.amount.setValue(toRupees(paise));
  }

  protected afterBalance(): { value: number } | null {
    const amount = toPaise(this.form.controls.amount.value);
    if (!amount) return null;
    return { value: this.data.customer.currentBalance + (this.isCredit ? amount : -amount) };
  }

  protected overLimit(): boolean {
    const limit = this.data.customer.creditLimit;
    const after = this.afterBalance();
    return this.isCredit && !!limit && !!after && after.value > limit;
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const amount = toPaise(v.amount);
    const date = dayToIso(v.date);
    this.saving.set(true);
    const req = this.isCredit
      ? this.api.addCredit(this.data.customer.id, { amount, note: v.note, date })
      : this.api.addPayment(this.data.customer.id, { amount, mode: v.mode, note: v.note, date });
    req.subscribe({
      next: () => {
        this.toast.success(this.isCredit ? 'ledger.creditAdded' : 'ledger.paymentReceived');
        this.ref.close(true);
      },
      error: (e) => {
        this.saving.set(false);
        this.toast.apiError(e);
      },
    });
  }
}
