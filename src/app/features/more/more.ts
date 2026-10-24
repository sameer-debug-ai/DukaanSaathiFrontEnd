import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { AuthService } from '../../core/auth/auth.service';
import { LanguageService } from '../../core/services/language.service';
import { ThemeService } from '../../core/services/theme.service';
import { MORE_ITEMS } from '../../layout/nav-items';
import { PageHeader } from '../../shared/components/page-header/page-header';

/** Mobile "More" tab: everything that doesn't fit in the bottom bar. */
@Component({
  selector: 'app-more',
  imports: [RouterLink, TranslatePipe, PageHeader],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="ds-page">
      <app-page-header [title]="'more.title' | translate" />
      <div class="ds-card list">
        @for (item of items; track item.path) {
          <a [routerLink]="item.path" class="row">
            <span class="material-symbols-outlined">{{ item.icon }}</span>
            <span class="flex-1">{{ item.labelKey | translate }}</span>
            <span class="material-symbols-outlined text-muted">chevron_right</span>
          </a>
        }
      </div>

      <div class="ds-card list mt-4">
        <button type="button" class="row" (click)="theme.toggle()">
          <span class="material-symbols-outlined">{{ theme.dark() ? 'light_mode' : 'dark_mode' }}</span>
          <span class="flex-1">{{ (theme.dark() ? 'common.lightMode' : 'common.darkMode') | translate }}</span>
        </button>
        <button type="button" class="row danger" (click)="auth.logout()">
          <span class="material-symbols-outlined">logout</span>
          <span class="flex-1">{{ 'nav.logout' | translate }}</span>
        </button>
      </div>
    </section>
  `,
  styles: `
    .list { overflow: hidden; }
    .row {
      display: flex; align-items: center; gap: 14px;
      width: 100%; min-height: 56px; padding: 0 16px;
      background: none; border: 0; border-bottom: 1px solid var(--ds-line);
      color: var(--ds-text); text-decoration: none; font: inherit; font-weight: 500; text-align: left; cursor: pointer;
    }
    .row:last-child { border-bottom: 0; }
    .row:active { background: var(--ds-surface); }
    .row.danger { color: var(--ds-danger); }
  `,
})
export class More {
  protected readonly items = MORE_ITEMS;
  protected readonly auth = inject(AuthService);
  protected readonly lang = inject(LanguageService);
  protected readonly theme = inject(ThemeService);
}
