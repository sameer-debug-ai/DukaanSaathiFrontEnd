import { ChangeDetectionStrategy, Component, effect, inject, input, signal, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MatButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import type { Product, ProductBatch, StockMovement } from '../../core/models/domain.models';
import { AppEvents, StockAlertsService } from '../../core/services/app-events.service';
import { ProductsApi } from '../../core/services/data.services';
import { ToastService } from '../../core/services/toast.service';
import { istDay } from '../../core/utils/format';
import { AliasChips } from '../../shared/components/alias-chips/alias-chips';
import { ConfirmService } from '../../shared/components/confirm-dialog/confirm-dialog';
import { EmptyState } from '../../shared/components/empty-state/empty-state';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { RunOutLabel } from '../../shared/components/run-out/run-out';
import { Skeleton } from '../../shared/components/skeleton/skeleton';
import { StockBadge } from '../../shared/components/stock-badge/stock-badge';
import { InrPipe } from '../../shared/pipes/inr.pipe';
import { IstDatePipe } from '../../shared/pipes/ist-date.pipe';
import { AdjustStockDialog } from './adjust-stock-dialog';
import { ProductFormDialog } from './product-form-dialog';

const MOVE_STYLE: Record<StockMovement['type'], { icon: string; cls: string }> = {
  purchase: { icon: 'local_shipping', cls: 'ok' },
  sale: { icon: 'shopping_bag', cls: 'info' },
  adjustment: { icon: 'tune', cls: 'muted' },
  return: { icon: 'undo', cls: 'ok' },
  damage: { icon: 'broken_image', cls: 'danger' },
  reversal: { icon: 'undo', cls: 'muted' },
};

@Component({
  selector: 'app-product-detail',
  imports: [RouterLink, MatButton, TranslatePipe, PageHeader, Skeleton, EmptyState, StockBadge, InrPipe, IstDatePipe, AliasChips, RunOutLabel],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="ds-page">
      @if (product(); as p) {
        <app-page-header [title]="p.name" [subtitle]="p.category" backLink="/products">
          <button mat-stroked-button (click)="edit(p)"><span class="material-symbols-outlined">edit</span><span class="hidden sm:inline">{{ 'common.edit' | translate }}</span></button>
          <button mat-flat-button (click)="adjust(p)"><span class="material-symbols-outlined">swap_vert</span>{{ 'stock.adjust' | translate }}</button>
        </app-page-header>

        <div class="grid grid-cols-1 gap-4 md:grid-cols-3 mb-4">
          <div class="ds-card p-4">
            <div class="text-sm text-muted">{{ 'stock.current' | translate }}</div>
            <div class="text-3xl font-bold my-1">{{ p.currentStock }} <span class="text-lg font-medium text-muted">{{ p.unit }}</span></div>
            <app-stock-badge [status]="p.stockStatus" />
            <div class="text-sm text-muted mt-2">{{ 'stock.minimum' | translate: { qty: p.lowStockThreshold } }}</div>
            <div class="mt-1"><app-run-out [forecast]="p.forecast" [stock]="p.currentStock" /></div>
            @if (p.forecast?.dailyRate) {
              <div class="text-sm text-muted">{{ 'smart.perDay' | translate: { qty: p.forecast!.dailyRate, unit: p.unit } }}</div>
            }
          </div>
          <div class="ds-card p-4">
            <dl class="facts">
              <dt>{{ 'products.sellingPrice' | translate }}</dt><dd>{{ p.sellingPrice | inr }}/{{ p.unit }}</dd>
              <dt>{{ 'products.purchasePrice' | translate }}</dt><dd>{{ p.purchasePrice | inr }}</dd>
              <dt>{{ 'products.mrp' | translate }}</dt><dd>{{ p.mrp | inr }}</dd>
              <dt>{{ 'products.stockValue' | translate }}</dt><dd>{{ p.currentStock * p.purchasePrice | inr }}</dd>
            </dl>
          </div>
          <div class="ds-card p-4">
            <dl class="facts">
              <dt>{{ 'products.barcode' | translate }}</dt><dd>{{ p.barcode || '—' }}</dd>
            </dl>
            <div class="flex gap-2 mt-3 flex-wrap">
              <a mat-stroked-button routerLink="/purchases/new" [queryParams]="{ productId: p.id, supplierId: p.supplierId }">{{ 'dashboard.reorder' | translate }}</a>
              <button mat-button class="text-danger" (click)="remove(p)">{{ 'common.delete' | translate }}</button>
            </div>
          </div>
        </div>

        @if (p.trackExpiry) {
          <div class="ds-card overflow-hidden mb-4">
            <div class="ds-section-title">
              <h2><span class="material-symbols-outlined align-middle" aria-hidden="true">event</span> {{ 'expiry.batches' | translate }}</h2>
              <span class="text-sm text-muted">{{ 'expiry.fefoHint' | translate }}</span>
            </div>
            @if (batches().length) {
              <div class="ds-list">
                @for (b of batches(); track b.id) {
                  @let expired = isExpired(b);
                  <div class="ds-list-item">
                    <div class="flex-1 min-w-0">
                      <div class="title">{{ b.qty }} {{ p.unit }}</div>
                      <div class="sub">{{ b.expiryDate ? ('expiry.exp' | translate: { date: (b.expiryDate | istDate) }) : ('expiry.noDate' | translate) }}{{ b.note ? ' · ' + b.note : '' }}</div>
                    </div>
                    @if (expired) {
                      <span class="ds-badge danger">{{ 'expiry.expired' | translate }}</span>
                      <button mat-button class="text-danger" (click)="writeOff(p, b)">{{ 'expiry.writeOff' | translate }}</button>
                    }
                  </div>
                }
              </div>
            } @else {
              <p class="text-sm text-muted px-4 pb-4 m-0">{{ 'expiry.noBatches' | translate }}</p>
            }
          </div>
        }

        <div class="ds-card p-4 mb-4">
          <app-alias-chips [aliases]="p.aliases" [busy]="aliasBusy()" (remove)="removeAlias(p, $event)" />
        </div>

        <div class="ds-card overflow-hidden">
          <div class="ds-section-title"><h2>{{ 'stock.history' | translate }}</h2></div>
          @if (history().length) {
            <div class="ds-list">
              @for (m of history(); track m.id) {
                <div class="ds-list-item">
                  <span class="ds-badge" [class]="'ds-badge ' + moveStyle[m.type].cls"><span class="material-symbols-outlined">{{ moveStyle[m.type].icon }}</span>{{ ('movement.' + m.type) | translate }}</span>
                  <div class="flex-1 min-w-0">
                    <div class="sub">{{ m.createdAt | istDate: true }}{{ m.note ? ' · ' + m.note : '' }}</div>
                  </div>
                  <div class="text-right">
                    <div class="font-semibold tabular" [class.text-ok]="m.quantity > 0" [class.text-danger]="m.quantity < 0">{{ m.quantity > 0 ? '+' : '' }}{{ m.quantity }}</div>
                    <div class="text-xs text-muted">{{ 'stock.balance' | translate }} {{ m.balanceAfter }}</div>
                  </div>
                </div>
              }
            </div>
            @if (hasMore()) {
              <div class="p-3 text-center"><button mat-button (click)="loadHistory(page() + 1)">{{ 'common.loadMore' | translate }}</button></div>
            }
          } @else {
            <app-empty-state icon="history" [title]="'stock.noHistory' | translate" />
          }
        </div>
      } @else {
        <app-skeleton [rows]="4" [height]="90" />
      }
    </section>
  `,
  styles: `
    .facts { display: grid; grid-template-columns: auto 1fr; gap: 6px 14px; margin: 0; }
    dt { color: var(--ds-muted); font-size: 0.88rem; }
    dd { margin: 0; text-align: right; font-weight: 600; overflow-wrap: anywhere; }
  `,
})
export class ProductDetail {
  readonly id = input.required<string>();
  private readonly api = inject(ProductsApi);
  private readonly dialog = inject(MatDialog);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly events = inject(AppEvents);
  private readonly alerts = inject(StockAlertsService);
  private readonly router = inject(Router);
  private readonly t = inject(TranslateService);

  protected readonly product = signal<Product | null>(null);
  protected readonly history = signal<StockMovement[]>([]);
  protected readonly batches = signal<ProductBatch[]>([]);
  protected readonly page = signal(1);
  protected readonly hasMore = signal(false);
  protected readonly moveStyle = MOVE_STYLE;

  constructor() {
    effect(() => {
      const id = this.id();
      this.events.version();
      untracked(() => this.load(id));
    });
  }

  private load(id: string): void {
    this.api.get(id).subscribe({
      next: (p) => {
        this.product.set(p);
        if (p.trackExpiry) this.api.batches(id).subscribe({ next: (b) => this.batches.set(b), error: () => undefined });
        else this.batches.set([]);
      },
      error: (e) => this.toast.apiError(e),
    });
    this.loadHistory(1);
  }

  protected readonly aliasBusy = signal(false);

  /** Drops one learned/typed name (search and voice stop matching on it). */
  protected removeAlias(p: Product, alias: string): void {
    this.aliasBusy.set(true);
    this.api.update(p.id, { aliases: p.aliases.filter((a) => a !== alias) }).subscribe({
      next: (u) => {
        this.aliasBusy.set(false);
        this.product.set({ ...p, aliases: u.aliases });
        this.toast.success('aliases.removed', { name: alias });
      },
      error: (e) => {
        this.aliasBusy.set(false);
        this.toast.apiError(e);
      },
    });
  }

  protected isExpired(b: ProductBatch): boolean {
    return !!b.expiryDate && istDay(new Date(b.expiryDate)) < istDay();
  }

  /** Removes an expired batch from stock as damage. */
  protected writeOff(p: Product, b: ProductBatch): void {
    this.confirm
      .ask({ message: this.t.instant('expiry.confirmWriteOff', { qty: b.qty, unit: p.unit, name: p.name }), confirmText: this.t.instant('expiry.writeOff'), danger: true })
      .subscribe((ok) => {
        if (!ok) return;
        this.api.adjustStock({ productId: p.id, quantity: b.qty, type: 'damage', note: 'Expired', batchId: b.id }).subscribe({
          next: () => {
            this.toast.success('expiry.writtenOff', { name: p.name });
            this.changed();
          },
          error: (e) => this.toast.apiError(e),
        });
      });
  }

  protected loadHistory(page: number): void {
    this.api.history(this.id(), { page, limit: 30 }).subscribe({
      next: (r) => {
        this.history.update((cur) => (page === 1 ? r.items : [...cur, ...r.items]));
        this.page.set(page);
        this.hasMore.set(r.meta.page < r.meta.totalPages);
      },
      error: (e) => this.toast.apiError(e),
    });
  }

  protected edit(p: Product): void {
    this.api.categories().subscribe((categories) =>
      this.dialog
        .open(ProductFormDialog, { data: { product: p, categories }, width: '640px', maxWidth: '96vw', autoFocus: false })
        .afterClosed()
        .subscribe((r) => r && this.changed()),
    );
  }

  protected adjust(p: Product): void {
    this.dialog.open(AdjustStockDialog, { data: p, width: '460px', maxWidth: '96vw' }).afterClosed().subscribe((r) => r && this.changed());
  }

  protected remove(p: Product): void {
    this.confirm
      .ask({ message: this.t.instant('products.confirmDelete', { name: p.name }), confirmText: this.t.instant('common.delete'), danger: true })
      .subscribe((ok) => {
        if (!ok) return;
        this.api.remove(p.id).subscribe({
          next: () => {
            this.toast.success('products.deleted');
            this.alerts.refresh();
            this.events.changed('products');
            void this.router.navigateByUrl('/products');
          },
          error: (e) => this.toast.apiError(e),
        });
      });
  }

  private changed(): void {
    this.alerts.refresh();
    this.events.changed('products');
  }
}
