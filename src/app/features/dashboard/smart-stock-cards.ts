import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import type { ExpiryAlerts, ExpiryItem, RunOutList } from '../../core/models/domain.models';
import { AppEvents, StockAlertsService } from '../../core/services/app-events.service';
import { ProductsApi, SmartStockApi } from '../../core/services/data.services';
import { ToastService } from '../../core/services/toast.service';
import { ConfirmService } from '../../shared/components/confirm-dialog/confirm-dialog';
import { IstDatePipe } from '../../shared/pipes/ist-date.pipe';

/**
 * Dashboard smart-stock cards: "Jaldi khatam hone wale" (by selling rate, <= 3 and <= 7 days)
 * and expiry alerts (expired + expiring in 7 days) with a one-tap "damage/expired" write-off.
 * Each card hides itself when there is nothing to show.
 */
@Component({
  selector: 'app-smart-stock-cards',
  imports: [RouterLink, TranslatePipe, IstDatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (runOut(); as r) {
      @if (r.items.length) {
        <div class="ds-card card">
          <div class="ds-section-title">
            <h2><span class="material-symbols-outlined align-middle text-warn" aria-hidden="true">hourglass_bottom</span>{{ 'smart.runOutTitle' | translate }}</h2>
            <a class="text-sm link" routerLink="/products/reorder">{{ 'smart.makeOrder' | translate }}</a>
          </div>
          @for (grp of runOutGroups(); track grp.key) {
            @if (grp.items.length) {
              <h3 class="grp" [class]="'grp ' + grp.tone">{{ grp.key | translate }} <span class="count">{{ grp.items.length }}</span></h3>
              <div class="ds-list">
                @for (i of grp.items; track i.id) {
                  <a class="ds-list-item row" [routerLink]="['/products', i.id]">
                    <div class="flex-1 min-w-0">
                      <div class="title">{{ i.name }}</div>
                      <div class="sub">{{ 'stock.left' | translate: { qty: i.currentStock, unit: i.unit } }}</div>
                    </div>
                    <strong class="days" [class]="'days ' + grp.tone">{{ (i.daysLeft ? 'smart.daysShort' : 'smart.today') | translate: { days: i.daysLeft } }}</strong>
                  </a>
                }
              </div>
            }
          }
        </div>
      }
    }

    @if (expiry(); as e) {
      @if (e.expired.length || e.expiringSoon.length) {
        <div class="ds-card card">
          <div class="ds-section-title">
            <h2><span class="material-symbols-outlined align-middle text-danger" aria-hidden="true">event_busy</span>{{ 'expiry.title' | translate }}</h2>
          </div>
          @if (e.expired.length) {
            <h3 class="grp danger">{{ 'expiry.expired' | translate }} <span class="count">{{ e.expired.length }}</span></h3>
            <div class="ds-list">
              @for (i of e.expired; track i.batchId) {
                <div class="ds-list-item">
                  <a class="flex-1 min-w-0 who" [routerLink]="['/products', i.productId]">
                    <div class="title">{{ i.name }}</div>
                    <div class="sub">{{ i.qty }} {{ i.unit }} · {{ 'expiry.expiredOn' | translate: { date: (i.expiryDate | istDate) } }}</div>
                  </a>
                  <button type="button" class="off-btn" (click)="writeOff(i)" [disabled]="busy() === i.batchId">
                    <span class="material-symbols-outlined" aria-hidden="true">delete_sweep</span>{{ 'expiry.writeOff' | translate }}
                  </button>
                </div>
              }
            </div>
          }
          @if (e.expiringSoon.length) {
            <h3 class="grp warn">{{ 'expiry.soon' | translate: { days: e.days } }} <span class="count">{{ e.expiringSoon.length }}</span></h3>
            <div class="ds-list">
              @for (i of e.expiringSoon; track i.batchId) {
                <div class="ds-list-item">
                  <a class="flex-1 min-w-0 who" [routerLink]="['/products', i.productId]">
                    <div class="title">{{ i.name }}</div>
                    <div class="sub">{{ i.qty }} {{ i.unit }} · {{ (i.daysLeft ? 'expiry.inDays' : 'expiry.today') | translate: { days: i.daysLeft, date: (i.expiryDate | istDate) } }}</div>
                  </a>
                  <button type="button" class="off-btn ghost" (click)="writeOff(i)" [disabled]="busy() === i.batchId">
                    <span class="material-symbols-outlined" aria-hidden="true">delete_sweep</span>{{ 'expiry.writeOff' | translate }}
                  </button>
                </div>
              }
            </div>
          }
        </div>
      }
    }
  `,
  styles: `
    .card { margin-bottom: 16px; overflow: hidden; }
    .ds-section-title h2 .material-symbols-outlined { margin-right: 6px; }
    .link { color: var(--ds-brand); font-weight: 600; text-decoration: none; }
    .grp { display: flex; align-items: center; gap: 6px; margin: 0; padding: 10px 16px 4px; font-size: 0.8rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; }
    .grp.danger { color: var(--ds-danger); }
    .grp.warn { color: var(--ds-warn); }
    .count { padding: 0 7px; border-radius: 999px; background: var(--ds-surface); color: var(--ds-muted); font-size: 0.75rem; }
    .row, .who { color: inherit; text-decoration: none; }
    .days { white-space: nowrap; font-size: 0.9rem; }
    .days.danger { color: var(--ds-danger); }
    .days.warn { color: var(--ds-warn); }
    .off-btn {
      display: inline-flex; align-items: center; gap: 4px; min-height: 38px; padding: 0 12px; margin-left: 8px; flex-shrink: 0;
      border: 0; border-radius: 999px; background: var(--ds-danger-soft); color: var(--ds-danger); font: inherit; font-size: 0.85rem; font-weight: 600; cursor: pointer;
      &.ghost { background: var(--ds-surface); color: var(--ds-muted); }
      &:disabled { opacity: 0.5; }
      .material-symbols-outlined { font-size: 18px; }
    }
  `,
})
export class SmartStockCards {
  private readonly api = inject(SmartStockApi);
  private readonly products = inject(ProductsApi);
  private readonly events = inject(AppEvents);
  private readonly alerts = inject(StockAlertsService);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  private readonly t = inject(TranslateService);

  protected readonly runOut = signal<RunOutList | null>(null);
  protected readonly expiry = signal<ExpiryAlerts | null>(null);
  protected readonly busy = signal<string | null>(null);

  protected readonly runOutGroups = computed(() => {
    const items = this.runOut()?.items ?? [];
    return [
      { key: 'smart.within3', tone: 'danger', items: items.filter((i) => i.daysLeft <= 3) },
      { key: 'smart.within7', tone: 'warn', items: items.filter((i) => i.daysLeft > 3) },
    ];
  });

  constructor() {
    effect(() => {
      this.events.version();
      untracked(() => this.load());
    });
  }

  private load(): void {
    this.api.runOut(7).subscribe({ next: (r) => this.runOut.set(r), error: () => undefined });
    this.api.expiry(7).subscribe({ next: (r) => this.expiry.set(r), error: () => undefined });
  }

  /** Removes the whole batch from stock as damage ("Expired"), after asking. */
  protected writeOff(i: ExpiryItem): void {
    this.confirm
      .ask({ message: this.t.instant('expiry.confirmWriteOff', { qty: i.qty, unit: i.unit, name: i.name }), confirmText: this.t.instant('expiry.writeOff'), danger: true })
      .subscribe((ok) => {
        if (!ok) return;
        this.busy.set(i.batchId);
        this.products.adjustStock({ productId: i.productId, quantity: i.qty, type: 'damage', note: 'Expired', batchId: i.batchId }).subscribe({
          next: () => {
            this.busy.set(null);
            this.toast.success('expiry.writtenOff', { name: i.name });
            this.alerts.refresh();
            this.events.changed('products');
          },
          error: (e) => {
            this.busy.set(null);
            this.toast.apiError(e);
          },
        });
      });
  }
}
