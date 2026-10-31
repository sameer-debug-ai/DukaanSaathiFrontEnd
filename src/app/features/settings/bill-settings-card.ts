import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggle } from '@angular/material/slide-toggle';
import { TranslatePipe } from '@ngx-translate/core';
import type { BillingSettings, PaperSize } from '../../core/models/api.models';
import { BillingApi, GSTIN_RX } from '../../core/services/billing.api';
import { ToastService } from '../../core/services/toast.service';
import { istDay } from '../../core/utils/format';

const PAPER: PaperSize[] = ['58mm', '80mm', 'a4'];
const LOGO_MAX_SIDE = 240;

/** Indian financial year (Apr-Mar) of today: "2026-27". */
function currentFy(): string {
  const [y, m] = istDay().split('-').map(Number) as [number, number];
  const start = m >= 4 ? y : y - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`;
}

/** Shrinks a logo to at most 240 px and returns it as a data URL (kept small: it is saved in the DB). */
async function logoDataUrl(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const scale = Math.min(1, LOGO_MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
    // PNG keeps a transparent background; photos are smaller as JPEG.
    return file.type === 'image/png' ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Settings -> "Bill aur GST": what goes on printed bills, paper size, invoice numbers and GST. */
@Component({
  selector: 'app-bill-settings-card',
  imports: [ReactiveFormsModule, MatButton, MatFormFieldModule, MatInput, MatSelectModule, MatSlideToggle, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form class="ds-card p-4 mb-4" [formGroup]="form" (ngSubmit)="save()" novalidate>
      <h2 class="text-lg font-semibold mt-0 mb-2">{{ 'billSettings.title' | translate }}</h2>
      <p class="text-sm text-muted mt-0">{{ 'billSettings.hint' | translate }}</p>

      <div class="grid gap-x-4 sm:grid-cols-2">
        <mat-form-field appearance="outline">
          <mat-label>{{ 'billSettings.shopName' | translate }}</mat-label>
          <input matInput formControlName="shopName" maxlength="120" />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>{{ 'billSettings.phone' | translate }}</mat-label>
          <input matInput formControlName="phone" inputmode="tel" maxlength="15" />
          <mat-error>{{ 'auth.phoneInvalid' | translate }}</mat-error>
        </mat-form-field>
        <mat-form-field appearance="outline" class="sm:col-span-2">
          <mat-label>{{ 'billSettings.address' | translate }}</mat-label>
          <input matInput formControlName="address" maxlength="300" />
        </mat-form-field>
        <mat-form-field appearance="outline" class="sm:col-span-2">
          <mat-label>{{ 'billSettings.footer' | translate }}</mat-label>
          <input matInput formControlName="footerNote" maxlength="160" [placeholder]="'billSettings.footerPh' | translate" />
        </mat-form-field>
      </div>

      <div class="logo-row">
        @if (form.controls.logo.value; as l) {
          <img [src]="l" alt="" class="logo" />
          <button mat-button type="button" (click)="form.controls.logo.setValue(''); form.markAsDirty()">{{ 'billSettings.removeLogo' | translate }}</button>
        } @else {
          <span class="text-sm text-muted">{{ 'billSettings.noLogo' | translate }}</span>
        }
        <label class="ds-chip pick">
          <span class="material-symbols-outlined">image</span>{{ 'billSettings.pickLogo' | translate }}
          <input type="file" accept="image/png,image/jpeg,image/webp" (change)="pickLogo($event)" hidden />
        </label>
      </div>

      <h3 class="sub">{{ 'bill.paperSize' | translate }}</h3>
      <div class="chips" role="radiogroup">
        @for (p of paper; track p) {
          <button type="button" class="ds-chip" role="radio" [attr.aria-checked]="paperSize() === p" [class.active]="paperSize() === p" (click)="form.controls.paperSize.setValue(p); form.markAsDirty()">
            {{ ('bill.size.' + p) | translate }}
          </button>
        }
      </div>

      <h3 class="sub">{{ 'billSettings.numbering' | translate }}</h3>
      <div class="grid gap-x-4 sm:grid-cols-2 items-start">
        <mat-form-field appearance="outline">
          <mat-label>{{ 'billSettings.prefix' | translate }}</mat-label>
          <input matInput formControlName="invoicePrefix" maxlength="4" class="uppercase" [placeholder]="defaultPrefix()" autocomplete="off" />
          <mat-hint>{{ 'billSettings.prefixHint' | translate }}</mat-hint>
          <mat-error>{{ 'billSettings.prefixInvalid' | translate }}</mat-error>
        </mat-form-field>
        <p class="preview">{{ 'billSettings.next' | translate }} <b>{{ sample() }}</b></p>
      </div>
      <mat-slide-toggle formControlName="showUpiQr" class="block mb-3">{{ 'billSettings.upiQr' | translate }}</mat-slide-toggle>

      <h3 class="sub">GST</h3>
      <mat-slide-toggle formControlName="gstEnabled" class="block">{{ 'billSettings.gstOn' | translate }}</mat-slide-toggle>
      <p class="text-sm text-muted mt-1">{{ 'billSettings.gstHint' | translate }}</p>
      @if (gstEnabled()) {
        <div class="grid gap-x-4 sm:grid-cols-2 mt-2">
          <mat-form-field appearance="outline">
            <mat-label>GSTIN</mat-label>
            <input matInput formControlName="gstin" maxlength="15" class="uppercase" autocomplete="off" spellcheck="false" placeholder="27ABCDE1234F1Z5" />
            <mat-error>{{ 'bill.gstinInvalid' | translate }}</mat-error>
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>{{ 'billSettings.state' | translate }}</mat-label>
            <mat-select formControlName="stateCode">
              @for (s of states(); track s.code) {
                <mat-option [value]="s.code">{{ s.code }} - {{ s.name }}</mat-option>
              }
            </mat-select>
            <mat-hint>{{ 'billSettings.stateHint' | translate }}</mat-hint>
          </mat-form-field>
        </div>
        <mat-slide-toggle formControlName="composition" class="block mt-2">{{ 'billSettings.composition' | translate }}</mat-slide-toggle>
        <p class="text-sm text-muted mt-1">{{ 'billSettings.compositionHint' | translate }}</p>
      }

      <button mat-flat-button type="submit" class="mt-3" [disabled]="saving()">{{ 'common.save' | translate }}</button>
    </form>
  `,
  styles: `
    .sub { font-size: 0.95rem; font-weight: 600; margin: 14px 0 8px; }
    .chips { display: flex; flex-wrap: wrap; gap: 8px; }
    .logo-row { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; margin: 2px 0 6px; }
    .logo { height: 48px; max-width: 140px; object-fit: contain; border: 1px solid var(--ds-line); border-radius: 8px; background: #fff; padding: 2px; }
    .pick { cursor: pointer; display: inline-flex; align-items: center; gap: 6px; }
    .preview { margin: 14px 0 0; color: var(--ds-muted); }
    .preview b { color: var(--ds-text); font-variant-numeric: tabular-nums; }
    .uppercase { text-transform: uppercase; }
  `,
})
export class BillSettingsCard implements OnInit {
  private readonly api = inject(BillingApi);
  private readonly toast = inject(ToastService);
  protected readonly paper = PAPER;
  protected readonly saving = signal(false);
  protected readonly states = signal<{ code: string; name: string }[]>([]);
  protected readonly defaultPrefix = signal('');

  protected readonly form = inject(NonNullableFormBuilder).group({
    shopName: [''],
    address: [''],
    phone: ['', [Validators.pattern(/^(\+?91|0)?[6-9]\d{9}$|^$/)]],
    logo: [''],
    footerNote: [''],
    paperSize: ['a4' as PaperSize],
    showUpiQr: [true],
    invoicePrefix: ['', [Validators.pattern(/^[A-Za-z0-9-]{0,4}$/)]],
    gstEnabled: [false],
    // Phones often type lowercase; it is uppercased before saving.
    gstin: ['', [Validators.pattern(new RegExp(GSTIN_RX.source, 'i'))]],
    stateCode: [''],
    composition: [false],
  });

  private readonly value = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });
  protected readonly paperSize = computed(() => this.value().paperSize);
  protected readonly gstEnabled = computed(() => !!this.value().gstEnabled);
  protected readonly sample = computed(() => [(this.value().invoicePrefix || this.defaultPrefix()).toUpperCase(), currentFy(), '0001'].filter(Boolean).join('/'));

  ngOnInit(): void {
    this.api.settings().subscribe({
      next: (s) => {
        this.states.set(s.states);
        this.defaultPrefix.set(s.defaultPrefix);
        this.form.reset({ ...this.form.getRawValue(), ...pick(s) });
      },
      error: (e) => this.toast.apiError(e),
    });
    // Typing a GSTIN picks the state for you (its first two digits).
    this.form.controls.gstin.valueChanges.subscribe((v) => {
      const g = v.trim().toUpperCase();
      if (g !== v) this.form.controls.gstin.setValue(g, { emitEvent: false });
      if (GSTIN_RX.test(g)) this.form.controls.stateCode.setValue(g.slice(0, 2));
    });
  }

  protected async pickLogo(e: Event): Promise<void> {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    try {
      this.form.controls.logo.setValue(await logoDataUrl(file));
      this.form.markAsDirty();
    } catch {
      this.toast.error('billSettings.logoFailed');
    }
  }

  protected save(): void {
    const v = this.form.getRawValue();
    if (v.gstEnabled && !v.gstin.trim()) this.form.controls.gstin.setErrors({ required: true });
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.api
      .update({ ...v, gstin: v.gstin.trim().toUpperCase(), invoicePrefix: v.invoicePrefix.trim().toUpperCase(), phone: v.phone.trim() })
      .subscribe({
        next: (s) => {
          this.saving.set(false);
          this.form.reset({ ...this.form.getRawValue(), ...pick(s) });
          this.toast.success('settings.saved');
        },
        error: (e) => {
          this.saving.set(false);
          this.toast.apiError(e);
        },
      });
  }
}

/** Just the editable settings from the API response. */
function pick(s: BillingSettings): BillingSettings {
  const { shopName, address, phone, logo, footerNote, paperSize, showUpiQr, invoicePrefix, gstEnabled, gstin, stateCode, composition } = s;
  return { shopName, address, phone, logo, footerNote, paperSize, showUpiQr, invoicePrefix, gstEnabled, gstin, stateCode, composition };
}
