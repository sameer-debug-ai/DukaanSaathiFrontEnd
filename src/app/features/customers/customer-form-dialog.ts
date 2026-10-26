import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButton, MatIconButton } from '@angular/material/button';
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
  imports: [ReactiveFormsModule, MatDialogModule, MatButton, MatIconButton, MatFormFieldModule, MatInput, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="fd">
      <header class="fd-head">
        <span class="fd-icon"><span class="material-symbols-outlined">{{ data.customer ? 'manage_accounts' : 'person_add' }}</span></span>
        <div class="fd-titles">
          <h2 mat-dialog-title>{{ (data.customer ? 'customers.edit' : 'customers.add') | translate }}</h2>
          <p>{{ 'customers.formSubtitle' | translate }}</p>
        </div>
        <button mat-icon-button type="button" mat-dialog-close [attr.aria-label]="'common.close' | translate">
          <span class="material-symbols-outlined">close</span>
        </button>
      </header>

      <form [formGroup]="form" (ngSubmit)="save()" novalidate class="fd">
        <mat-dialog-content class="fd-body">
          <section class="fd-section">
            <h3><span class="material-symbols-outlined">badge</span>{{ 'customers.sectionWho' | translate }}</h3>
            <div class="fd-grid">
              <mat-form-field appearance="outline" subscriptSizing="dynamic" class="span-all">
                <mat-label>{{ 'customers.name' | translate }}</mat-label>
                <span matPrefix class="material-symbols-outlined fd-field-icon">person</span>
                <input matInput formControlName="name" autocomplete="off" cdkFocusInitial />
                <mat-error>{{ 'common.required' | translate }}</mat-error>
              </mat-form-field>
              <mat-form-field appearance="outline" subscriptSizing="dynamic" class="span-all">
                <mat-label>{{ 'customers.nickname' | translate }}</mat-label>
                <span matPrefix class="material-symbols-outlined fd-field-icon">record_voice_over</span>
                <input matInput formControlName="aliases" [placeholder]="'customers.nicknamePlaceholder' | translate" />
                <mat-hint>{{ 'customers.nicknameHint' | translate }}</mat-hint>
              </mat-form-field>
            </div>
          </section>

          <section class="fd-section">
            <h3><span class="material-symbols-outlined">contact_phone</span>{{ 'customers.sectionContact' | translate }}</h3>
            <div class="fd-grid">
              <mat-form-field appearance="outline" subscriptSizing="dynamic" class="span-all">
                <mat-label>{{ 'auth.phone' | translate }}</mat-label>
                <span matPrefix class="material-symbols-outlined fd-field-icon">call</span>
                <input matInput formControlName="phone" type="tel" inputmode="numeric" maxlength="14" placeholder="98765 43210" />
                <mat-hint>{{ 'customers.phoneHint' | translate }}</mat-hint>
                <mat-error>{{ 'auth.phoneInvalid' | translate }}</mat-error>
              </mat-form-field>
              <mat-form-field appearance="outline" subscriptSizing="dynamic" class="span-all">
                <mat-label>{{ 'common.address' | translate }}</mat-label>
                <textarea matInput formControlName="address" rows="2"></textarea>
              </mat-form-field>
            </div>
          </section>

          <section class="fd-section">
            <h3><span class="material-symbols-outlined">menu_book</span>{{ 'customers.sectionUdhaar' | translate }}</h3>
            <div class="fd-grid">
              <mat-form-field appearance="outline" subscriptSizing="dynamic" class="span-all">
                <mat-label>{{ 'customers.creditLimit' | translate }}</mat-label>
                <span matTextPrefix>₹&nbsp;</span>
                <input matInput type="number" inputmode="decimal" formControlName="creditLimit" min="0" />
                <mat-hint>{{ 'customers.creditLimitHint' | translate }}</mat-hint>
              </mat-form-field>
            </div>
          </section>
        </mat-dialog-content>

        <footer class="fd-foot">
          <button mat-button type="button" mat-dialog-close>{{ 'common.cancel' | translate }}</button>
          <button mat-flat-button type="submit" class="fd-save" [disabled]="saving()">
            <span class="material-symbols-outlined">check</span>{{ 'common.save' | translate }}
          </button>
        </footer>
      </form>
    </div>
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
