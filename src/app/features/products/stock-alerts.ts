import { ChangeDetectionStrategy, Component, effect, inject, signal, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MatButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { TranslatePipe } from '@ngx-translate/core';
import type { Product, StockAlerts as Alerts } from '../../core/models/domain.models';
import { AppEvents, StockAlertsService } from '../../core/services/app-events.service';
import { ProductsApi } from '../../core/services/data.services';
import { ToastService } from '../../core/services/toast.service';
import { EmptyState } from '../../shared/components/empty-state/empty-state';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { Skeleton } from '../../shared/components/skeleton/skeleton';
import { StatCard } from '../../shared/components/stat-card/stat-card';
import { StockBadge } from '../../shared/components/stock-badge/stock-badge';
import { AdjustStockDialog } from './adjust-stock-dialog';

/** Dedicated low / out-of-stock page with quick reorder. */
@Component({
  selector: 'app-stock-alerts',
  imports: [RouterLink, MatButton, TranslatePipe, PageHeader, Skeleton, EmptyState, StatCard, StockBadge],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="ds-page">
      <app-page-header [title]="'alerts.title' | translate" [subtitle]="'alerts.subtitle' | translate" backLink="/products" />
      @if (data(); as d) {
        <div class="grid grid-cols-2 gap-3 mb-4 md:max-w-xl">
          <app-stat-card [label]="'stock.low' | translate" [value]="'' + d.lowCount" icon="warning" tone="warn" />
          <app-stat-card [label]="'stock.out' | translate" [value]="'' + d.outCount" icon="block" tone="danger" />
        </div>
        <div class="ds-card overflow-hidden">
          @if (d.items.length) {
            <div class="ds-list">
              @for (p of d.items; track p.id) {
                <div class="ds-list-item flex-wrap">
                  <a class="flex-1 min-w-[160px] no-underline text-inherit" [routerLink]="['/products', p.id]">
                    <div class="title">{{ p.name }}</div>
                    <div class="sub">{{ 'stock.left' | translate: { qty: p.currentStock, unit: p.unit } }} · {{ 'stock.minimum' | translate: { qty: p.lowStockThreshold } }}</div>
                  </a>
                  <app-stock-badge [status]="p.stockStatus" />
                  <div class="flex gap-2">
                    <button mat-stroked-button (click)="adjust(p)">{{ 'stock.adjust' | translate }}</button>
                    <button mat-flat-button (click)="reorder(p)">{{ 'dashboard.reorder' | translate }}</button>
                  </div>
                </div>
              }
            </div>
          } @else {
            <app-empty-state icon="inventory" [title]="'dashboard.allStocked' | translate" [hint]="'alerts.allGood' | translate" />
          }
        </div>
      } @else {
        <app-skeleton [rows]="6" />
      }
    </section>
  `,
})
export class StockAlertsPage {
  private readonly api = inject(ProductsApi);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly events = inject(AppEvents);
  private readonly alerts = inject(StockAlertsService);
  protected readonly data = signal<Alerts | null>(null);

  constructor() {
    effect(() => {
      this.events.version();
      untracked(() => this.api.alerts().subscribe({ next: (d) => this.data.set(d), error: (e) => this.toast.apiError(e) }));
    });
  }

  protected reorder(p: Product): void {
    void this.router.navigate(['/purchases/new'], { queryParams: { productId: p.id, supplierId: p.supplierId } });
  }

  protected adjust(p: Product): void {
    this.dialog.open(AdjustStockDialog, { data: p, width: '460px', maxWidth: '96vw' }).afterClosed().subscribe((r) => {
      if (!r) return;
      this.alerts.refresh();
      this.events.changed('products');
    });
  }
}
