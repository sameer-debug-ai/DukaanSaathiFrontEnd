import { ChangeDetectionStrategy, Component, effect, inject, input, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatMenuModule } from '@angular/material/menu';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltip } from '@angular/material/tooltip';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import type { Product } from '../../core/models/domain.models';
import { AppEvents, StockAlertsService } from '../../core/services/app-events.service';
import { ProductsApi } from '../../core/services/data.services';
import { ShareService } from '../../core/services/share.service';
import { ToastService } from '../../core/services/toast.service';
import { istDay } from '../../core/utils/format';
import { ConfirmService } from '../../shared/components/confirm-dialog/confirm-dialog';
import { EmptyState } from '../../shared/components/empty-state/empty-state';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { SearchBox } from '../../shared/components/search-box/search-box';
import { Skeleton } from '../../shared/components/skeleton/skeleton';
import { StockBadge } from '../../shared/components/stock-badge/stock-badge';
import { InrPipe } from '../../shared/pipes/inr.pipe';
import { AdjustStockDialog } from './adjust-stock-dialog';
import { ImportDialog } from './import-dialog';
import { ProductFormDialog } from './product-form-dialog';

type StockFilter = 'all' | 'in' | 'low' | 'out';

@Component({
  selector: 'app-products-list',
  imports: [
    FormsModule, RouterLink, MatButton, MatIconButton, MatMenuModule, MatSelectModule, MatTooltip, TranslatePipe,
    PageHeader, SearchBox, Skeleton, EmptyState, StockBadge, InrPipe,
  ],
  templateUrl: './products-list.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductsList {
  /** Query params (component input binding): ?stock=low, ?add=1, ?category=Dairy */
  readonly stock = input<string>();
  readonly add = input<string>();
  readonly category = input<string>();

  private readonly api = inject(ProductsApi);
  private readonly dialog = inject(MatDialog);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly share = inject(ShareService);
  private readonly events = inject(AppEvents);
  private readonly alerts = inject(StockAlertsService);
  private readonly router = inject(Router);
  private readonly t = inject(TranslateService);

  protected readonly items = signal<Product[]>([]);
  protected readonly total = signal(0);
  protected readonly page = signal(1);
  protected readonly hasMore = signal(false);
  protected readonly loading = signal(true);
  protected readonly categories = signal<string[]>([]);

  protected readonly search = signal('');
  protected readonly stockFilter = signal<StockFilter>('all');
  protected readonly categoryFilter = signal('');
  protected readonly sort = signal('name');

  protected readonly stockChips: { id: StockFilter; key: string }[] = [
    { id: 'all', key: 'products.filterAll' },
    { id: 'in', key: 'stock.in' },
    { id: 'low', key: 'stock.low' },
    { id: 'out', key: 'stock.out' },
  ];
  protected readonly sorts = [
    { id: 'name', key: 'products.sortName' },
    { id: 'stock', key: 'products.sortStockLow' },
    { id: '-stock', key: 'products.sortStockHigh' },
    { id: '-price', key: 'products.sortPriceHigh' },
    { id: 'price', key: 'products.sortPriceLow' },
    { id: '-updatedAt', key: 'products.sortRecent' },
  ];

  constructor() {
    effect(() => {
      const s = this.stock();
      const c = this.category();
      untracked(() => {
        if (s && ['in', 'low', 'out', 'all'].includes(s)) this.stockFilter.set(s as StockFilter);
        if (c) this.categoryFilter.set(c);
      });
    });
    effect(() => {
      this.events.version();
      untracked(() => this.reload());
    });
    effect(() => {
      if (this.add() === '1') untracked(() => setTimeout(() => this.openForm()));
    });
    this.api.categories().subscribe({ next: (c) => this.categories.set(c), error: () => undefined });
  }

  private params(page: number) {
    return {
      page,
      limit: 40,
      search: this.search(),
      stock: this.stockFilter(),
      category: this.categoryFilter(),
      sort: this.sort(),
    };
  }

  protected reload(): void {
    this.loading.set(true);
    this.page.set(1);
    this.api.list(this.params(1)).subscribe({
      next: (r) => {
        this.items.set(r.items);
        this.total.set(r.meta.total);
        this.hasMore.set(r.meta.page < r.meta.totalPages);
        this.loading.set(false);
      },
      error: (e) => {
        this.loading.set(false);
        this.toast.apiError(e);
      },
    });
  }

  protected loadMore(): void {
    const next = this.page() + 1;
    this.api.list(this.params(next)).subscribe({
      next: (r) => {
        this.items.update((cur) => [...cur, ...r.items]);
        this.page.set(next);
        this.hasMore.set(r.meta.page < r.meta.totalPages);
      },
      error: (e) => this.toast.apiError(e),
    });
  }

  protected onSearch(v: string): void {
    this.search.set(v);
    this.reload();
  }
  protected setStock(f: StockFilter): void {
    this.stockFilter.set(f);
    this.reload();
  }
  protected setCategory(c: string): void {
    this.categoryFilter.set(c);
    this.reload();
  }
  protected setSort(s: string): void {
    this.sort.set(s);
    this.reload();
  }

  protected openForm(product?: Product): void {
    this.dialog
      .open(ProductFormDialog, { data: { product, categories: this.categories() }, width: '640px', maxWidth: '96vw', autoFocus: false })
      .afterClosed()
      .subscribe((p) => {
        if (this.add()) void this.router.navigate([], { queryParams: { add: null }, queryParamsHandling: 'merge', replaceUrl: true });
        if (p) this.afterChange();
      });
  }

  protected adjust(p: Product, ev?: Event): void {
    ev?.stopPropagation();
    this.dialog.open(AdjustStockDialog, { data: p, width: '460px', maxWidth: '96vw' }).afterClosed().subscribe((r) => r && this.afterChange());
  }

  protected openImport(): void {
    this.dialog.open(ImportDialog, { width: '520px', maxWidth: '96vw' }).afterClosed().subscribe((r) => r && this.afterChange());
  }

  protected exportCsv(): void {
    this.api.exportCsv({ search: this.search(), stock: this.stockFilter(), category: this.categoryFilter() }).subscribe({
      next: (blob) => this.share.download(blob, `products-${istDay()}.csv`),
      error: (e) => this.toast.apiError(e),
    });
  }

  protected remove(p: Product, ev?: Event): void {
    ev?.stopPropagation();
    this.confirm
      .ask({ message: this.t.instant('products.confirmDelete', { name: p.name }), confirmText: this.t.instant('common.delete'), danger: true })
      .subscribe((ok) => {
        if (!ok) return;
        this.api.remove(p.id).subscribe({
          next: () => {
            this.toast.success('products.deleted');
            this.afterChange();
          },
          error: (e) => this.toast.apiError(e),
        });
      });
  }

  protected altNames(p: Product): string {
    return p.aliases.filter((s) => !!s).join(', ');
  }

  protected open(p: Product): void {
    void this.router.navigate(['/products', p.id]);
  }

  private afterChange(): void {
    this.alerts.refresh();
    this.events.changed('products');
    this.api.categories().subscribe({ next: (c) => this.categories.set(c), error: () => undefined });
  }
}
