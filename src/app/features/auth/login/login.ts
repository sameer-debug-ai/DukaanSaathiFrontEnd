import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { TranslatePipe } from '@ngx-translate/core';
import { environment } from '../../../../environments/environment';
import { AuthService } from '../../../core/auth/auth.service';
import { apiErrorMessage } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';
import { indianPhone, normalizePhone } from '../../../shared/validators';
import { AuthLayout } from '../auth-layout';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink, MatButton, MatIconButton, MatFormFieldModule, MatInput, MatProgressSpinner, TranslatePipe, AuthLayout],
  templateUrl: './login.html',
  styleUrl: '../auth-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Login {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(ToastService);

  protected readonly showDemo = !environment.production;
  protected readonly demo = { phone: '9876543210', password: 'demo123' };
  protected readonly loading = signal(false);
  protected readonly error = signal('');
  protected readonly showPassword = signal(false);

  protected readonly form = inject(NonNullableFormBuilder).group({
    phone: ['', [Validators.required, indianPhone]],
    password: ['', [Validators.required]],
  });

  protected fillDemo(): void {
     console.log("A")
    this.form.setValue(this.demo);
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading.set(true);
    this.error.set('');
    const { phone, password } = this.form.getRawValue();
    this.auth.login(normalizePhone(phone), password).subscribe({
      next: (user) => {
        this.toast.success('auth.welcome', { name: user.name });
        const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
        void this.router.navigateByUrl(returnUrl && returnUrl.startsWith('/') ? returnUrl : '/dashboard');
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(apiErrorMessage(err));
      },
    });
  }
}
