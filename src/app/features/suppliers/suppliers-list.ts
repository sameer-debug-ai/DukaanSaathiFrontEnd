import { ChangeDetectionStrategy, Component, effect, inject, signal, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MatButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { TranslatePipe } from '@ngx-translate/core';
import type { Supplier } from '../../core/models/domain.models';
import { AppEvents } from '../../core/services/app-events.service';
import { SuppliersApi } from '../../core/services/data.services';
import { ToastService } from '../../core/services/toast.service';
import { EmptyState } from '../../shared/components/empty-state/empty-state';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { SearchBox } from '../../shared/components/search-box/search-box';
import { Skeleton } from '../../shared/components/skeleton/skeleton';
import { StatCard } from '../../shared/components/stat-card/stat-card';
import { InrPipe } from '../../shared/pipes/inr.pipe';
import { SupplierFormDialog } from './supplier-dialogs';

@Component({
  selector: 'app-suppliers-list',
  imports: [RouterLink, MatButton, TranslatePipe, PageHeader, SearchBox, Skeleton, EmptyState, StatCard, InrPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="ds-page">
      <app-page-header [title]="'nav.suppliers' | translate" [subtitle]="'suppliers.count' | translate: { count: items().length }">
        <a mat-stroked-button routerLink="/purchases"><span class="material-symbols-outlined">receipt</span><span class="hidden sm:inline">{{ 'nav.purchases' | translate }}</span></a>
        <button mat-flat-button (click)="add()"><span class="material-symbols-outlined">add_business</span><span class="hidden sm:inline">{{ 'suppliers.add' | translate }}</span></button>
      </app-page-header>

      <div class="grid grid-cols-2 gap-3 mb-4 md:max-w-xl">
        <app-stat-card [label]="'dashboard.totalPayable' | translate" [value]="payable() | inr" icon="local_shipping" tone="warn" />
        <app-stat-card [label]="'suppliers.newPurchase' | translate" [value]="'+'" icon="add_shopping_cart" tone="brand" link="/purchases/new" />
      </div>

      <div class="ds-toolbar">
        <app-search-box [placeholder]="'suppliers.searchPlaceholder' | translate" (search)="onSearch($event)" />
      </div>

      <div class="ds-card overflow-hidden">
        @if (loading()) {
          <div class="p-4"><app-skeleton [rows]="4" /></div>
        } @else if (!items().length) {
          <app-empty-state icon="local_shipping" [title]="'suppliers.emptyTitle' | translate" [hint]="'suppliers.emptyHint' | translate">
            <button mat-flat-button (click)="add()">{{ 'suppliers.add' | translate }}</button>
          </app-empty-state>
        } @else {
          <table class="ds-table hidden md:table">
            <thead>
              <tr>
                <th>{{ 'suppliers.name' | translate }}</th>
                <th>{{ 'auth.phone' | translate }}</th>
                <th class="num">{{ 'suppliers.totalPurchased' | translate }}</th>
                <th class="num">{{ 'suppliers.totalPaid' | translate }}</th>
                <th class="num">{{ 'suppliers.payable' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              @for (s of items(); track s.id) {
                <tr class="clickable" (click)="open(s)">
                  <td><div class="font-semibold">{{ s.name }}</div><div class="text-sm text-muted">{{ s.company }}</div></td>
                  <td>{{ s.phone || '—' }}</td>
                  <td class="num">{{ s.totalPurchased | inr }}</td>
                  <td class="num amount-payment">{{ s.totalPaid | inr }}</td>
                  <td class="num font-semibold" [class.text-warn]="s.currentPayable > 0">{{ s.currentPayable | inr }}</td>
                </tr>
              }
            </tbody>
          </table>
          <div class="ds-list md:hidden">
            @for (s of items(); track s.id) {
              <button type="button" class="ds-list-item" (click)="open(s)">
                <span class="ds-avatar"><span class="material-symbols-outlined">local_shipping</span></span>
                <div class="flex-1 min-w-0">
                  <div class="title">{{ s.name }}</div>
                  <div class="sub">{{ 'suppliers.purchasedShort' | translate: { amount: (s.totalPurchased | inr) } }}</div>
                </div>
                <div class="text-right">
                  <div class="font-semibold tabular" [class.text-warn]="s.currentPayable > 0">{{ s.currentPayable | inr }}</div>
                  <div class="text-xs text-muted">{{ 'suppliers.payable' | translate }}</div>
                </div>
              </button>
            }
          </div>
        }
      </div>
    </section>
  `,
})
export class SuppliersList {
  private readonly api = inject(SuppliersApi);
  private readonly dialog = inject(MatDialog);
  private readonly toast = inject(ToastService);
  private readonly events = inject(AppEvents);
  private readonly router = inject(Router);

  protected readonly items = signal<Supplier[]>([]);
  protected readonly payable = signal(0);
  protected readonly loading = signal(true);
  private search = '';

  constructor() {
    effect(() => {
      this.events.version();
      untracked(() => this.reload());
    });
  }

  protected reload(): void {
    this.api.list({ search: this.search, limit: 200 }).subscribe({
      next: (r) => {
        this.items.set(r.data);
        this.payable.set(Number(r.meta?.['totalPayable'] ?? 0));
        this.loading.set(false);
      },
      error: (e) => {
        this.loading.set(false);
        this.toast.apiError(e);
      },
    });
  }

  protected onSearch(v: string): void {
    this.search = v;
    this.reload();
  }

  protected add(): void {
    this.dialog
      .open(SupplierFormDialog, { data: {}, width: '480px', maxWidth: '96vw', autoFocus: false })
      .afterClosed()
      .subscribe((s?: Supplier) => s && this.events.changed('suppliers'));
  }

  protected open(s: Supplier): void {
    void this.router.navigate(['/suppliers', s.id]);
  }
}
