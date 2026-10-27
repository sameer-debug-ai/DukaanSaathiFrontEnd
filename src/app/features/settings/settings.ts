import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatSlideToggle } from '@angular/material/slide-toggle';
import { TranslatePipe } from '@ngx-translate/core';
import { AuthService } from '../../core/auth/auth.service';
import type { Language } from '../../core/models/api.models';
import type { DataCounts } from '../../core/models/domain.models';
import { AppEvents, StockAlertsService } from '../../core/services/app-events.service';
import { SettingsApi, VoiceApi } from '../../core/services/data.services';
import { LanguageService } from '../../core/services/language.service';
import { ShareService } from '../../core/services/share.service';
import { ThemeService } from '../../core/services/theme.service';
import { ToastService } from '../../core/services/toast.service';
import { istDay } from '../../core/utils/format';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { VoiceReplies } from '../voice/voice-replies.service';

@Component({
  selector: 'app-settings',
  imports: [ReactiveFormsModule, MatButton, MatButtonToggleModule, MatFormFieldModule, MatInput, MatSlideToggle, TranslatePipe, PageHeader],
  templateUrl: './settings.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Settings implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly settingsApi = inject(SettingsApi);
  private readonly voiceApi = inject(VoiceApi);
  /** Spoken replies are a per-device choice (the speaker may be shared), so not part of the shop settings. */
  protected readonly voiceReplies = inject(VoiceReplies);
  private readonly share = inject(ShareService);
  private readonly events = inject(AppEvents);
  private readonly alerts = inject(StockAlertsService);
  private readonly fb = inject(NonNullableFormBuilder);
  protected readonly lang = inject(LanguageService);
  protected readonly theme = inject(ThemeService);

  protected readonly savingProfile = signal(false);
  protected readonly savingPassword = signal(false);
  protected readonly counts = signal<DataCounts | null>(null);
  protected readonly ai = signal<{ provider: string; available: boolean } | null>(null);
  protected readonly busy = signal(false);

  private readonly user = this.auth.user()!;

  protected readonly profileForm = this.fb.group({
    shopName: [this.user.shopName, [Validators.required, Validators.minLength(2)]],
    name: [this.user.name, [Validators.required, Validators.minLength(2)]],
    shopAddress: [this.user.shopAddress ?? ''],
    email: [this.user.email ?? '', [Validators.email]],
    gstNumber: [this.user.gstNumber ?? ''],
  });

  protected readonly prefsForm = this.fb.group({
    lowStockDefault: [this.user.settings.lowStockDefault, [Validators.required, Validators.min(0)]],
    allowOversell: [this.user.settings.allowOversell],
  });

  protected readonly undoChoices = [30, 60, 120];
  protected readonly voiceForm = this.fb.group({
    voiceAlwaysConfirm: [this.user.settings.voiceAlwaysConfirm ?? true],
    voiceAutoSaveThreshold: [this.user.settings.voiceAutoSaveThreshold ?? 0.85],
    voiceUndoSeconds: [this.user.settings.voiceUndoSeconds ?? 60],
  });

  protected readonly passwordForm = this.fb.group({
    currentPassword: ['', Validators.required],
    newPassword: ['', [Validators.required, Validators.minLength(6)]],
  });

  protected readonly phone = this.user.phone;

  ngOnInit(): void {
    this.settingsApi.counts().subscribe({ next: (c) => this.counts.set(c), error: () => undefined });
    this.voiceApi.status().subscribe({ next: (s) => this.ai.set(s), error: () => undefined });
  }

  protected saveProfile(): void {
    if (this.profileForm.invalid) return this.profileForm.markAllAsTouched();
    this.savingProfile.set(true);
    const v = this.profileForm.getRawValue();
    this.auth.updateProfile({ ...v, gstNumber: v.gstNumber.trim().toUpperCase() }).subscribe({
      next: () => {
        this.savingProfile.set(false);
        this.toast.success('settings.saved');
      },
      error: (e) => {
        this.savingProfile.set(false);
        this.toast.apiError(e);
      },
    });
  }

  protected savePrefs(): void {
    if (this.prefsForm.invalid) return this.prefsForm.markAllAsTouched();
    const v = this.prefsForm.getRawValue();
    this.auth.updateProfile({ settings: { lowStockDefault: Number(v.lowStockDefault), allowOversell: v.allowOversell } }).subscribe({
      next: () => this.toast.success('settings.saved'),
      error: (e) => this.toast.apiError(e),
    });
  }

  protected saveVoice(): void {
    const v = this.voiceForm.getRawValue();
    this.auth
      .updateProfile({ settings: { voiceAlwaysConfirm: v.voiceAlwaysConfirm, voiceAutoSaveThreshold: Number(v.voiceAutoSaveThreshold), voiceUndoSeconds: Number(v.voiceUndoSeconds) } })
      .subscribe({ next: () => this.toast.success('settings.saved'), error: (e) => this.toast.apiError(e) });
  }

  protected setLanguage(lang: Language): void {
    void this.lang.use(lang);
    this.auth.updateProfile({ preferredLanguage: lang }).subscribe({ error: () => undefined });
  }

  protected setDark(dark: boolean): void {
    this.theme.dark.set(dark);
    this.auth.updateProfile({ settings: { darkMode: dark } }).subscribe({ error: () => undefined });
  }

  protected changePassword(): void {
    if (this.passwordForm.invalid) return this.passwordForm.markAllAsTouched();
    this.savingPassword.set(true);
    const { currentPassword, newPassword } = this.passwordForm.getRawValue();
    this.auth.changePassword(currentPassword, newPassword).subscribe({
      next: () => {
        this.savingPassword.set(false);
        this.passwordForm.reset();
        this.toast.success('settings.passwordChanged');
      },
      error: (e) => {
        this.savingPassword.set(false);
        this.toast.apiError(e);
      },
    });
  }

  protected backup(): void {
    this.busy.set(true);
    this.settingsApi.backup().subscribe({
      next: (blob) => {
        this.busy.set(false);
        this.share.download(blob, `dukaansathi-backup-${istDay()}.json`);
      },
      error: (e) => {
        this.busy.set(false);
        this.toast.apiError(e);
      },
    });
  }

  protected loadSample(): void {
    this.busy.set(true);
    this.settingsApi.loadSample().subscribe({
      next: () => {
        this.busy.set(false);
        this.toast.success('dashboard.sampleLoaded');
        this.alerts.refresh();
        this.events.changed('any');
        this.settingsApi.counts().subscribe((c) => this.counts.set(c));
      },
      error: (e) => {
        this.busy.set(false);
        this.toast.apiError(e);
      },
    });
  }
}
