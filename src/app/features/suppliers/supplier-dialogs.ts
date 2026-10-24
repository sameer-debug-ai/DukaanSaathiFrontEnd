import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { TranslatePipe } from '@ngx-translate/core';
import type { PaymentMode, Supplier } from '../../core/models/domain.models';
import { SuppliersApi } from '../../core/services/data.services';
import { ToastService } from '../../core/services/toast.service';
import { dayToIso, istDay, toPaise, toRupees } from '../../core/utils/format';
import { InrPipe } from '../../shared/pipes/inr.pipe';
import { indianPhone, normalizePhone } from '../../shared/validators';

@Component({
  selector: 'app-supplier-form-dialog',
  imports: [ReactiveFormsModule, MatDialogModule, MatButton, MatFormFieldModule, MatInput, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>{{ (data.supplier ? 'suppliers.edit' : 'suppliers.add') | translate }}</h2>
    <form [formGroup]="form" (ngSubmit)="save()" novalidate>
      <mat-dialog-content>
        <mat-form-field appearance="outline">
          <mat-label>{{ 'suppliers.name' | translate }}</mat-label>
          <input matInput formControlName="name" cdkFocusInitial />
          <mat-error>{{ 'common.required' | translate }}</mat-error>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>{{ 'suppliers.company' | translate }}</mat-label>
          <input matInput formControlName="company" />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>{{ 'auth.phone' | translate }}</mat-label>
          <span matTextPrefix>+91&nbsp;</span>
          <input matInput formControlName="phone" type="tel" inputmode="numeric" maxlength="14" />
          <mat-error>{{ 'auth.phoneInvalid' | translate }}</mat-error>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>{{ 'common.address' | translate }}</mat-label>
          <input matInput formControlName="address" />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>{{ 'suppliers.gst' | translate }}</mat-label>
          <input matInput formControlName="gstNumber" class="uppercase" />
        </mat-form-field>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" mat-dialog-close>{{ 'common.cancel' | translate }}</button>
        <button mat-flat-button type="submit" [disabled]="saving()">{{ 'common.save' | translate }}</button>
      </mat-dialog-actions>
    </form>
  `,
})
export class SupplierFormDialog {
  protected readonly data = inject<{ supplier?: Supplier; name?: string }>(MAT_DIALOG_DATA);
  private readonly ref = inject(MatDialogRef<SupplierFormDialog, Supplier>);
  private readonly api = inject(SuppliersApi);
  private readonly toast = inject(ToastService);
  protected readonly saving = signal(false);

  protected readonly form = inject(NonNullableFormBuilder).group({
    name: [this.data.supplier?.name ?? this.data.name ?? '', [Validators.required, Validators.maxLength(120)]],
    company: [this.data.supplier?.company ?? ''],
    phone: [this.data.supplier?.phone ?? '', [indianPhone]],
    address: [this.data.supplier?.address ?? ''],
    gstNumber: [this.data.supplier?.gstNumber ?? ''],
  });

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const body = { ...v, name: v.name.trim(), phone: normalizePhone(v.phone), gstNumber: v.gstNumber.trim().toUpperCase() };
    this.saving.set(true);
    const req = this.data.supplier ? this.api.update(this.data.supplier.id, body) : this.api.create(body);
    req.subscribe({
      next: (s) => {
        this.toast.success(this.data.supplier ? 'suppliers.updated' : 'suppliers.added');
        this.ref.close(s);
      },
      error: (e) => {
        this.saving.set(false);
        this.toast.apiError(e);
      },
    });
  }
}

@Component({
  selector: 'app-supplier-payment-dialog',
  imports: [ReactiveFormsModule, MatDialogModule, MatButton, MatButtonToggleModule, MatFormFieldModule, MatInput, TranslatePipe, InrPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>{{ 'suppliers.payTitle' | translate: { name: data.name } }}</h2>
    <form [formGroup]="form" (ngSubmit)="save()" novalidate>
      <mat-dialog-content>
        <p class="m-0 mb-3">{{ 'suppliers.payable' | translate }}: <strong class="text-warn">{{ data.currentPayable | inr }}</strong></p>
        @if (data.currentPayable > 0) {
          <div class="flex gap-2 mb-3">
            <button type="button" mat-stroked-button (click)="form.controls.amount.setValue(rupees(data.currentPayable))">{{ 'ledger.fullAmount' | translate }}</button>
          </div>
        }
        <mat-form-field appearance="outline">
          <mat-label>{{ 'common.amount' | translate }}</mat-label>
          <span matTextPrefix>₹&nbsp;</span>
          <input matInput type="number" inputmode="decimal" formControlName="amount" min="1" cdkFocusInitial />
          <mat-error>{{ 'ledger.amountRequired' | translate }}</mat-error>
        </mat-form-field>
        <mat-button-toggle-group formControlName="mode" class="modes">
          <mat-button-toggle value="cash">{{ 'pay.cash' | translate }}</mat-button-toggle>
          <mat-button-toggle value="upi">{{ 'pay.upi' | translate }}</mat-button-toggle>
          <mat-button-toggle value="bank">{{ 'pay.bank' | translate }}</mat-button-toggle>
        </mat-button-toggle-group>
        <mat-form-field appearance="outline">
          <mat-label>{{ 'common.note' | translate }}</mat-label>
          <input matInput formControlName="note" />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>{{ 'common.date' | translate }}</mat-label>
          <input matInput type="date" formControlName="date" [max]="today" />
        </mat-form-field>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" mat-dialog-close>{{ 'common.cancel' | translate }}</button>
        <button mat-flat-button type="submit" [disabled]="saving()">{{ 'suppliers.recordPayment' | translate }}</button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `.modes { width: 100%; display: grid; grid-template-columns: repeat(3, 1fr); margin-bottom: 16px; }`,
})
export class SupplierPaymentDialog {
  protected readonly data = inject<Supplier>(MAT_DIALOG_DATA);
  private readonly ref = inject(MatDialogRef<SupplierPaymentDialog, boolean>);
  private readonly api = inject(SuppliersApi);
  private readonly toast = inject(ToastService);
  protected readonly saving = signal(false);
  protected readonly today = istDay();
  protected readonly rupees = toRupees;

  protected readonly form = inject(NonNullableFormBuilder).group({
    amount: [null as unknown as number, [Validators.required, Validators.min(1)]],
    mode: ['cash' as PaymentMode],
    note: [''],
    date: [istDay()],
  });

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    this.saving.set(true);
    this.api.pay({ supplierId: this.data.id, amount: toPaise(v.amount), mode: v.mode, note: v.note, date: dayToIso(v.date) }).subscribe({
      next: () => {
        this.toast.success('suppliers.paid');
        this.ref.close(true);
      },
      error: (e) => {
        this.saving.set(false);
        this.toast.apiError(e);
      },
    });
  }
}
