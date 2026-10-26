import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { LanguageService } from '../../core/services/language.service';
import { Logo } from '../../shared/components/logo/logo';

/** Shared frame for login/register: brand panel on wide screens, the form card on the right. */
@Component({
  selector: 'app-auth-layout',
  imports: [TranslatePipe, Logo],
  templateUrl: './auth-layout.html',
  styleUrl: './auth-layout.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthLayout {
  protected readonly lang = inject(LanguageService);
  protected readonly year = new Date().getFullYear();
  protected readonly features = [
    { icon: 'mic', key: 'auth.brand.f1' },
    { icon: 'inventory_2', key: 'auth.brand.f2' },
    { icon: 'receipt_long', key: 'auth.brand.f3' },
  ];
}
