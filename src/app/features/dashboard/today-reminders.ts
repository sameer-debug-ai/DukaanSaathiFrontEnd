import { ChangeDetectionStrategy, Component, effect, inject, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { AuthService } from '../../core/auth/auth.service';
import type { ReminderItem, TodayReminders } from '../../core/models/domain.models';
import { AppEvents } from '../../core/services/app-events.service';
import { CustomersApi, RemindersApi } from '../../core/services/data.services';
import { LanguageService } from '../../core/services/language.service';
import { ShareService } from '../../core/services/share.service';
import { InrPipe } from '../../shared/pipes/inr.pipe';
import { IstDatePipe } from '../../shared/pipes/ist-date.pipe';
import { reminderMessage } from '../customers/reminder';

/**
 * "Aaj ke reminders": customers whose payment reminder is due today (built every morning by the
 * server). One tap opens WhatsApp with a polite message + UPI link and ticks them off.
 */
@Component({
  selector: 'app-today-reminders',
  imports: [RouterLink, TranslatePipe, InrPipe, IstDatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (data(); as d) {
      @if (d.items.length || d.sentToday) {
        <div class="ds-card rem">
          <div class="ds-section-title">
            <h2>
              <span class="material-symbols-outlined align-middle text-warn" aria-hidden="true">notifications_active</span>
              {{ 'reminders.today' | translate }}
            </h2>
            @if (d.sentToday) {
              <span class="text-sm text-muted">{{ 'reminders.sentToday' | translate: { n: d.sentToday } }}</span>
            }
          </div>
          @if (d.items.length) {
            <div class="ds-list">
              @for (r of d.items; track r.customerId) {
                <div class="ds-list-item">
                  <a class="flex-1 min-w-0 who" [routerLink]="['/customers', r.customerId]">
                    <div class="title">{{ r.name }}</div>
                    <div class="sub">
                      @if (r.reason === 'due_date' && r.dueDate) {
                        {{ 'reminders.dueOn' | translate: { date: (r.dueDate | istDate) } }}
                      } @else if (r.lastReminderAt) {
                        {{ 'reminders.lastSent' | translate: { date: (r.lastReminderAt | istDate) } }}
                      } @else {
                        {{ 'reminders.firstReminder' | translate }}
                      }
                    </div>
                  </a>
                  <strong class="amount-credit tabular">{{ r.balance | inr }}</strong>
                  @if (r.phone) {
                    <a class="wa" [href]="whatsapp(r)" target="_blank" rel="noopener" (click)="sent(r)" [attr.aria-label]="'reminders.sendTo' | translate: { name: r.name }">
                      <span class="material-symbols-outlined" aria-hidden="true">chat</span>
                      <span class="lbl">{{ 'reminders.send' | translate }}</span>
                    </a>
                  } @else {
                    <a class="wa off" [routerLink]="['/customers', r.customerId]" [attr.title]="'customers.noPhoneHint' | translate">
                      <span class="material-symbols-outlined" aria-hidden="true">phone_disabled</span>
                    </a>
                  }
                </div>
              }
            </div>
          } @else {
            <p class="done"><span class="material-symbols-outlined text-ok" aria-hidden="true">task_alt</span>{{ 'reminders.allDone' | translate }}</p>
          }
        </div>
      }
    }
  `,
  styles: `
    .rem { margin-bottom: 16px; overflow: hidden; }
    .who { color: inherit; text-decoration: none; }
    .wa {
      display: inline-flex; align-items: center; gap: 4px; min-height: 40px; padding: 0 12px; margin-left: 8px;
      border-radius: 999px; background: #1f9d55; color: #fff; font-weight: 600; text-decoration: none; flex-shrink: 0;
      &.off { background: var(--ds-surface); color: var(--ds-muted); }
    }
    .done { display: flex; align-items: center; gap: 8px; margin: 0; padding: 12px 16px 16px; }
    @media (max-width: 420px) { .wa .lbl { display: none; } }
  `,
})
export class TodayRemindersCard {
  private readonly api = inject(RemindersApi);
  private readonly customers = inject(CustomersApi);
  private readonly share = inject(ShareService);
  private readonly auth = inject(AuthService);
  private readonly lang = inject(LanguageService);
  private readonly events = inject(AppEvents);

  protected readonly data = signal<TodayReminders | null>(null);

  constructor() {
    effect(() => {
      this.events.version();
      untracked(() => this.api.today().subscribe({ next: (d) => this.data.set(d), error: () => undefined }));
    });
  }

  protected whatsapp(r: ReminderItem): string {
    const shop = this.auth.user();
    // Customer reminders default to Hindi; English only when the app is in English.
    return this.share.whatsappUrl(
      r.phone,
      reminderMessage({ customerName: r.name, amount: r.balance, shopName: shop?.shopName ?? '', shopPhone: shop?.phone, lang: this.lang.current(), upiLink: r.upiLink }),
    );
  }

  /** Ticks the customer off right away; the server records the date. */
  protected sent(r: ReminderItem): void {
    this.data.update((d) => (d ? { ...d, items: d.items.filter((i) => i.customerId !== r.customerId), sentToday: d.sentToday + 1 } : d));
    this.customers.reminderSent(r.customerId).subscribe({ error: () => undefined });
  }
}
