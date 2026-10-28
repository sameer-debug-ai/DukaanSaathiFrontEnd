import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatButton, MatIconButton } from '@angular/material/button';
import { TranslatePipe } from '@ngx-translate/core';
import { AuthService } from '../../core/auth/auth.service';
import type { ReorderGroup, ReorderItem } from '../../core/models/domain.models';
import { SmartStockApi } from '../../core/services/data.services';
import { LanguageService } from '../../core/services/language.service';
import { ShareService } from '../../core/services/share.service';
import { ToastService } from '../../core/services/toast.service';
import { EmptyState } from '../../shared/components/empty-state/empty-state';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { RunOutLabel } from '../../shared/components/run-out/run-out';
import { Skeleton } from '../../shared/components/skeleton/skeleton';
import { InrPipe } from '../../shared/pipes/inr.pipe';
import { OrderDrafts } from '../purchases/order-drafts';
import { orderMessage } from './order-message';

interface EditGroup {
  key: string;
  supplier: ReorderGroup['supplier'];
  items: ReorderItem[];
}

const DAY_CHOICES = [7, 15, 30];

/**
 * "Order list": what to buy for the next N days, grouped by supplier. Quantities are editable;
 * one tap sends the order on WhatsApp, and "Maal aa gaya" opens a prefilled purchase.
 */
@Component({
  selector: 'app-reorder-list',
  imports: [FormsModule, RouterLink, MatButton, MatIconButton, TranslatePipe, PageHeader, EmptyState, Skeleton, RunOutLabel, InrPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="ds-page">
      <app-page-header [title]="'reorder.title' | translate" [subtitle]="'reorder.subtitle' | translate: { days: days() }" backLink="/products" />

      <div class="ds-chips mb-4" role="group" [attr.aria-label]="'reorder.daysLabel' | translate">
        @for (d of dayChoices(); track d) {
          <button type="button" class="ds-chip" [class.active]="days() === d" (click)="load(d)">{{ 'reorder.days' | translate: { days: d } }}</button>
        }
      </div>

      @if (loading()) {
        <app-skeleton [rows]="4" [height]="80" />
      } @else if (!groups().length) {
        <div class="ds-card">
          <app-empty-state icon="task_alt" [title]="'reorder.emptyTitle' | translate" [hint]="'reorder.emptyHint' | translate: { days: days() }" />
        </div>
      } @else {
        @for (g of groups(); track g.key) {
          <div class="ds-card group">
            <div class="ds-section-title">
              <h2>
                <span class="material-symbols-outlined align-middle" aria-hidden="true">local_shipping</span>
                @if (g.supplier) {
                  <a [routerLink]="['/suppliers', g.supplier.id]">{{ g.supplier.name }}</a>
                } @else {
                  {{ 'reorder.noSupplier' | translate }}
                }
              </h2>
              <span class="text-sm text-muted">{{ 'reorder.items' | translate: { n: g.items.length } }}</span>
            </div>

            <div class="ds-list">
              @for (i of g.items; track i.productId) {
                <div class="ds-list-item line" [class.zero]="!i.qty">
                  <div class="flex-1 min-w-0">
                    <a class="title name" [routerLink]="['/products', i.productId]">{{ i.name }}</a>
                    <div class="sub">
                      {{ 'stock.left' | translate: { qty: i.currentStock, unit: i.unit } }}
                      @if (i.reason === 'low_stock') {
                        · {{ 'reorder.lowStock' | translate }}
                      }
                    </div>
                    <app-run-out [forecast]="{ dailyRate: i.dailyRate, daysLeft: i.daysLeft }" [stock]="i.currentStock" />
                  </div>
                  <label class="qty">
                    <input type="number" inputmode="decimal" min="0" [ngModel]="i.qty" (ngModelChange)="setQty(g, i, $event)" [attr.aria-label]="'reorder.qtyFor' | translate: { name: i.name }" />
                    <span>{{ ('units.' + i.unit) | translate }}</span>
                  </label>
                  <button mat-icon-button type="button" (click)="removeItem(g, i)" [attr.aria-label]="'common.delete' | translate">
                    <span class="material-symbols-outlined">close</span>
                  </button>
                </div>
              }
            </div>

            <div class="foot">
              <div class="est">
                <span class="text-sm text-muted">{{ 'reorder.estimate' | translate }}</span>
                <strong class="tabular">{{ estimate(g) | inr }}</strong>
              </div>
              <div class="acts">
                <a class="wa" [href]="whatsapp(g)" target="_blank" rel="noopener" [class.off]="!hasQty(g)">
                  <span class="material-symbols-outlined" aria-hidden="true">chat</span>{{ 'reorder.sendWhatsapp' | translate }}
                </a>
                <button mat-stroked-button type="button" (click)="toPurchase(g)" [disabled]="!hasQty(g)">
                  <span class="material-symbols-outlined">inventory</span>{{ 'reorder.received' | translate }}
                </button>
              </div>
              @if (g.supplier && !g.supplier.phone) {
                <p class="text-sm text-muted m-0">{{ 'reorder.noPhone' | translate }}</p>
              }
            </div>
          </div>
        }
      }
    </section>
  `,
  styles: `
    .group { margin-bottom: 16px; overflow: hidden; }
    .group h2 a { color: inherit; text-decoration: none; }
    .name { color: inherit; text-decoration: none; display: block; }
    .line.zero { opacity: 0.55; }
    .qty { display: inline-flex; align-items: center; gap: 6px; margin-left: 8px; font-size: 0.85rem; color: var(--ds-muted); }
    .qty input {
      width: 76px; min-height: 40px; padding: 0 8px; border: 1px solid var(--ds-line); border-radius: 10px;
      background: var(--ds-card); color: var(--ds-text); font: inherit; font-weight: 600; text-align: right;
    }
    .foot { display: flex; flex-wrap: wrap; align-items: center; gap: 10px 16px; padding: 12px 16px 16px; border-top: 1px solid var(--ds-line); }
    .est { display: flex; flex-direction: column; margin-right: auto; }
    .acts { display: flex; flex-wrap: wrap; gap: 8px; }
    .wa {
      display: inline-flex; align-items: center; gap: 6px; min-height: 40px; padding: 0 16px; border-radius: 999px;
      background: #1f9d55; color: #fff; font-weight: 600; text-decoration: none;
      &.off { pointer-events: none; opacity: 0.5; }
    }
  `,
})
export class ReorderListPage {
  private readonly api = inject(SmartStockApi);
  private readonly auth = inject(AuthService);
  private readonly lang = inject(LanguageService);
  private readonly share = inject(ShareService);
  private readonly toast = inject(ToastService);
  private readonly drafts = inject(OrderDrafts);
  private readonly router = inject(Router);

  protected readonly loading = signal(true);
  protected readonly days = signal(this.auth.user()?.settings.reorderDays ?? 15);
  protected readonly groups = signal<EditGroup[]>([]);
  /** 7 / 15 / 30 plus the shop's own setting. */
  protected readonly dayChoices = computed(() => [...new Set([...DAY_CHOICES, this.auth.user()?.settings.reorderDays ?? 15])].sort((a, b) => a - b));

  constructor() {
    this.load(this.days());
  }

  protected load(days: number): void {
    this.days.set(days);
    this.loading.set(true);
    this.api.reorder(days).subscribe({
      next: (r) => {
        this.groups.set(r.groups.map((g) => ({ key: g.supplier?.id ?? '-', supplier: g.supplier, items: g.items.map((i) => ({ ...i })) })));
        this.loading.set(false);
      },
      error: (e) => {
        this.loading.set(false);
        this.toast.apiError(e);
      },
    });
  }

  private patchGroup(g: EditGroup, items: ReorderItem[]): void {
    this.groups.update((all) => all.map((x) => (x.key === g.key ? { ...x, items } : x)).filter((x) => x.items.length));
  }

  protected setQty(g: EditGroup, i: ReorderItem, value: number | string | null): void {
    const qty = Math.max(0, Math.round((Number(value) || 0) * 1000) / 1000);
    this.patchGroup(g, g.items.map((x) => (x.productId === i.productId ? { ...x, qty } : x)));
  }

  protected removeItem(g: EditGroup, i: ReorderItem): void {
    this.patchGroup(g, g.items.filter((x) => x.productId !== i.productId));
  }

  protected hasQty(g: EditGroup): boolean {
    return g.items.some((i) => i.qty > 0);
  }

  protected estimate(g: EditGroup): number {
    return g.items.reduce((s, i) => s + Math.round(i.qty * i.rate), 0);
  }

  protected whatsapp(g: EditGroup): string {
    const shop = this.auth.user();
    return this.share.whatsappUrl(
      g.supplier?.phone,
      orderMessage({ supplierName: g.supplier?.name, shopName: shop?.shopName ?? '', shopPhone: shop?.phone, items: g.items, lang: this.lang.current() }),
    );
  }

  /** Goods arrived: open the purchase form prefilled with this order (saved only after checking). */
  protected toPurchase(g: EditGroup): void {
    this.drafts.set({ supplierId: g.supplier?.id ?? null, items: g.items.filter((i) => i.qty > 0).map((i) => ({ productId: i.productId, qty: i.qty, rate: i.rate })) });
    void this.router.navigate(['/purchases/new'], { queryParams: { order: 1 } });
  }
}
