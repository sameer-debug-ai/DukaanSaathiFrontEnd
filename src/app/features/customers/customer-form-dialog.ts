import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { TranslatePipe } from '@ngx-translate/core';
import type { Customer } from '../../core/models/domain.models';
import { CustomersApi } from '../../core/services/data.services';
import { ToastService } from '../../core/services/toast.service';
import { toPaise, toRupees } from '../../core/utils/format';
import { indianPhone, normalizePhone } from '../../shared/validators';

export interface CustomerFormData {
  customer?: Customer;
  name?: string;
}

@Component({
  selector: 'app-customer-form-dialog',
  imports: [ReactiveFormsModule, MatDialogModule, MatButton, MatFormFieldModule, MatInput, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>{{ (data.customer ? 'customers.edit' : 'customers.add') | translate }}</h2>
    <form [formGroup]="form" (ngSubmit)="save()" novalidate>
      <mat-dialog-content>
        <mat-form-field appearance="outline">
          <mat-label>{{ 'customers.name' | translate }}</mat-label>
          <input matInput formControlName="name" autocomplete="off" cdkFocusInitial />
          <mat-error>{{ 'common.required' | translate }}</mat-error>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>{{ 'customers.nickname' | translate }}</mat-label>
          <input matInput formControlName="aliases" [placeholder]="'customers.nicknamePlaceholder' | translate" />
          <mat-hint>{{ 'customers.nicknameHint' | translate }}</mat-hint>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>{{ 'auth.phone' | translate }}</mat-label>
          <span matTextPrefix>+91&nbsp;</span>
          <input matInput formControlName="phone" type="tel" inputmode="numeric" maxlength="14" />
          <mat-error>{{ 'auth.phoneInvalid' | translate }}</mat-error>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>{{ 'common.address' | translate }}</mat-label>
          <textarea matInput formControlName="address" rows="2"></textarea>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>{{ 'customers.creditLimit' | translate }}</mat-label>
          <span matTextPrefix>₹&nbsp;</span>
          <input matInput type="number" inputmode="decimal" formControlName="creditLimit" min="0" />
          <mat-hint>{{ 'customers.creditLimitHint' | translate }}</mat-hint>
        </mat-form-field>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" mat-dialog-close>{{ 'common.cancel' | translate }}</button>
        <button mat-flat-button type="submit" [disabled]="saving()">{{ 'common.save' | translate }}</button>
      </mat-dialog-actions>
    </form>
  `,
})
export class CustomerFormDialog {
  protected readonly data = inject<CustomerFormData>(MAT_DIALOG_DATA);
  private readonly ref = inject(MatDialogRef<CustomerFormDialog, Customer>);
  private readonly api = inject(CustomersApi);
  private readonly toast = inject(ToastService);
  protected readonly saving = signal(false);

  protected readonly form = inject(NonNullableFormBuilder).group({
    name: [this.data.customer?.name ?? this.data.name ?? '', [Validators.required, Validators.maxLength(100)]],
    aliases: [(this.data.customer?.aliases ?? []).join(', ')],
    phone: [this.data.customer?.phone ?? '', [indianPhone]],
    address: [this.data.customer?.address ?? ''],
    creditLimit: [this.data.customer?.creditLimit ? toRupees(this.data.customer.creditLimit) : (null as unknown as number)],
  });

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const body = {
      name: v.name.trim(),
      aliases: v.aliases.split(',').map((s) => s.trim()).filter(Boolean),
      phone: normalizePhone(v.phone),
      address: v.address.trim(),
      creditLimit: v.creditLimit ? toPaise(v.creditLimit) : undefined,
    };
    this.saving.set(true);
    const req = this.data.customer ? this.api.update(this.data.customer.id, body) : this.api.create(body);
    req.subscribe({
      next: (c) => {
        this.toast.success(this.data.customer ? 'customers.updated' : 'customers.added');
        this.ref.close(c);
      },
      error: (e) => {
        this.saving.set(false);
        this.toast.apiError(e);
      },
    });
  }
}
