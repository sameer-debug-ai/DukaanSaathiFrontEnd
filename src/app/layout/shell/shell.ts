import { BreakpointObserver } from '@angular/cdk/layout';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatIconButton } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltip } from '@angular/material/tooltip';
import { TranslatePipe } from '@ngx-translate/core';
import { map } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { StockAlertsService } from '../../core/services/app-events.service';
import { ThemeService } from '../../core/services/theme.service';
import { storage } from '../../core/utils/storage';
import { MicFab } from '../mic-fab/mic-fab';
import { BOTTOM_NAV_ITEMS, NAV_ITEMS } from '../nav-items';

const COLLAPSE_KEY = 'ds.sidebarCollapsed';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, MatIconButton, MatMenuModule, MatTooltip, TranslatePipe, MicFab],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Shell {
  protected readonly auth = inject(AuthService);
  protected readonly theme = inject(ThemeService);

  protected readonly navItems = NAV_ITEMS;
  protected readonly bottomItems = BOTTOM_NAV_ITEMS;

  protected readonly isMobile = toSignal(
    inject(BreakpointObserver)
      .observe('(max-width: 767.98px)')
      .pipe(map((s) => s.matches)),
    { initialValue: typeof matchMedia !== 'undefined' && matchMedia('(max-width: 767.98px)').matches },
  );

  protected readonly collapsed = signal(storage.get(COLLAPSE_KEY) === '1');
  protected readonly alerts = inject(StockAlertsService);

  constructor() {
    this.alerts.refresh();
    // Re-check stock alerts every few minutes while the app is open.
    const timer = setInterval(() => this.alerts.refresh(), 5 * 60_000);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }

  protected toggleSidebar(): void {
    this.collapsed.update((c) => !c);
    storage.set(COLLAPSE_KEY, this.collapsed() ? '1' : '0');
  }
}
