import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatButton } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { TranslatePipe } from '@ngx-translate/core';
import { AuthService } from '../../../core/auth/auth.service';
import { apiErrorMessage } from '../../../core/services/api.service';
import { LanguageService } from '../../../core/services/language.service';
import { ToastService } from '../../../core/services/toast.service';
import { indianPhone, normalizePhone, passwordsMatch } from '../../../shared/validators';

@Component({
  selector: 'app-register',
  imports: [ReactiveFormsModule, RouterLink, MatButton, MatFormFieldModule, MatInput, MatProgressSpinner, TranslatePipe],
  templateUrl: './register.html',
  styleUrl: '../auth-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Register {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  protected readonly lang = inject(LanguageService);

  protected readonly loading = signal(false);
  protected readonly error = signal('');

  protected readonly form = inject(NonNullableFormBuilder).group(
    {
      shopName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]],
      name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
      phone: ['', [Validators.required, indianPhone]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: passwordsMatch },
  );

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading.set(true);
    this.error.set('');
    const v = this.form.getRawValue();
    this.auth
      .register({
        shopName: v.shopName,
        name: v.name,
        phone: normalizePhone(v.phone),
        password: v.password,
        preferredLanguage: this.lang.current(),
      })
      .subscribe({
        next: (user) => {
          this.toast.success('auth.welcome', { name: user.name });
          void this.router.navigateByUrl('/dashboard');
        },
        error: (err) => {
          this.loading.set(false);
          this.error.set(apiErrorMessage(err));
        },
      });
  }
}
