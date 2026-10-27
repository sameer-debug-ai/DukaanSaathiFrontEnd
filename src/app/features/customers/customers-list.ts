import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, effect, inject, input, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { MatButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatSelectModule } from '@angular/material/select';
import { TranslatePipe } from '@ngx-translate/core';
import type { Customer } from '../../core/models/domain.models';
import { AppEvents } from '../../core/services/app-events.service';
import { CustomersApi } from '../../core/services/data.services';
import { ToastService } from '../../core/services/toast.service';
import { CreditBadgeComponent } from '../../shared/components/credit-badge/credit-badge';
import { EmptyState } from '../../shared/components/empty-state/empty-state';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { SearchBox } from '../../shared/components/search-box/search-box';
import { Skeleton } from '../../shared/components/skeleton/skeleton';
import { StatCard } from '../../shared/components/stat-card/stat-card';
import { InrPipe } from '../../shared/pipes/inr.pipe';
import { IstDatePipe } from '../../shared/pipes/ist-date.pipe';
import { CustomerFormDialog } from './customer-form-dialog';

type Filter = 'all' | 'due' | 'clear';

@Component({
  selector: 'app-customers-list',
  imports: [NgTemplateOutlet, MatButton, MatSelectModule, TranslatePipe, PageHeader, SearchBox, Skeleton, EmptyState, StatCard, InrPipe, IstDatePipe, CreditBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="ds-page">
      <app-page-header [title]="'customers.title' | translate" [subtitle]="'customers.count' | translate: { count: total() }">
        <button mat-flat-button (click)="add()">
          <span class="material-symbols-outlined">person_add</span>
          <span class="hidden sm:inline">{{ 'customers.add' | translate }}</span>
        </button>
      </app-page-header>

      <div class="grid grid-cols-2 gap-3 mb-4 md:max-w-xl">
        <app-stat-card [label]="'dashboard.totalOutstanding' | translate" [value]="outstanding() | inr" icon="menu_book" tone="danger" />
        <app-stat-card [label]="'customers.withDue' | translate" [value]="'' + dueCount()" icon="group" tone="warn" />
      </div>

      <div class="ds-toolbar">
        <app-search-box [placeholder]="'customers.searchPlaceholder' | translate" [value]="search()" (search)="onSearch($event)" />
        <mat-select class="ds-select" [value]="sort()" (valueChange)="setSort($event)" [attr.aria-label]="'common.sort' | translate">
          <mat-option value="-balance">{{ 'customers.sortHighest' | translate }}</mat-option>
          <mat-option value="name">{{ 'customers.sortName' | translate }}</mat-option>
          <mat-option value="-lastTransaction">{{ 'customers.sortRecent' | translate }}</mat-option>
        </mat-select>
      </div>
      <div class="ds-chips mb-4" role="group">
        @for (f of filters; track f.id) {
          <button class="ds-chip" [class.active]="filter() === f.id" (click)="setFilter(f.id)">{{ f.key | translate }}</button>
        }
      </div>

      <div class="ds-card overflow-hidden">
        @if (loading()) {
          <div class="p-4"><app-skeleton [rows]="6" /></div>
        } @else if (!items().length) {
          <app-empty-state icon="group" [title]="'customers.emptyTitle' | translate" [hint]="'customers.emptyHint' | translate">
            <button mat-flat-button (click)="add()">{{ 'customers.add' | translate }}</button>
          </app-empty-state>
        } @else {
          <table class="ds-table hidden md:table">
            <thead>
              <tr>
                <th>{{ 'customers.name' | translate }}</th>
                <th>{{ 'auth.phone' | translate }}</th>
                <th>{{ 'customers.lastTxnCol' | translate }}</th>
                <th class="num">{{ 'customers.balance' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              @for (c of items(); track c.id) {
                <tr class="clickable" (click)="open(c)">
                  <td>
                    <div class="flex items-center gap-3">
                      <span class="ds-avatar">{{ initials(c.name) }}</span>
                      <div>
                        <div class="font-semibold">
                          {{ c.name }}
                          @if (c.currentBalance > 0) {
                            <app-credit-badge [credit]="c.credit" />
                          }
                        </div>
                        @if (c.aliases.length) {
                          <div class="text-sm text-muted">{{ c.aliases.join(', ') }}</div>
                        }
                      </div>
                    </div>
                  </td>
                  <td>{{ c.phone || '—' }}</td>
                  <td>{{ c.lastTransactionAt ? (c.lastTransactionAt | istDate) : '—' }}</td>
                  <td class="num">
                    <ng-container *ngTemplateOutlet="bal; context: { $implicit: c }" />
                  </td>
                </tr>
              }
            </tbody>
          </table>

          <div class="ds-list md:hidden">
            @for (c of items(); track c.id) {
              <button type="button" class="ds-list-item" (click)="open(c)">
                <span class="ds-avatar">{{ initials(c.name) }}</span>
                <div class="flex-1 min-w-0">
                  <div class="title">
                    {{ c.name }}
                    @if (c.currentBalance > 0 && c.credit && c.credit.badge !== 'new') {
                      <app-credit-badge [credit]="c.credit" />
                    }
                  </div>
                  <div class="sub">{{ c.lastTransactionAt ? ('customers.lastTxn' | translate: { date: (c.lastTransactionAt | istDate) }) : (c.phone || '—') }}</div>
                </div>
                <ng-container *ngTemplateOutlet="bal; context: { $implicit: c }" />
              </button>
            }
          </div>
          @if (hasMore()) {
            <div class="p-3 text-center"><button mat-button (click)="loadMore()">{{ 'common.loadMore' | translate }}</button></div>
          }
        }
      </div>
    </section>

    <ng-template #bal let-c>
      @if (c.currentBalance > 0) {
        <span class="amount-credit tabular">{{ c.currentBalance | inr }}</span>
      } @else if (c.currentBalance < 0) {
        <span class="amount-payment tabular">{{ -c.currentBalance | inr }} {{ 'customers.advance' | translate }}</span>
      } @else {
        <span class="ds-badge ok"><span class="material-symbols-outlined">check</span>{{ 'customers.clear' | translate }}</span>
      }
    </ng-template>
  `,
})
export class CustomersList {
  readonly filterParam = input<string>(undefined, { alias: 'filter' });
  private readonly api = inject(CustomersApi);
  private readonly dialog = inject(MatDialog);
  private readonly toast = inject(ToastService);
  private readonly events = inject(AppEvents);
  private readonly router = inject(Router);

  protected readonly items = signal<Customer[]>([]);
  protected readonly total = signal(0);
  protected readonly outstanding = signal(0);
  protected readonly dueCount = signal(0);
  protected readonly loading = signal(true);
  protected readonly page = signal(1);
  protected readonly hasMore = signal(false);
  protected readonly search = signal('');
  protected readonly sort = signal('-balance');
  protected readonly filter = signal<Filter>('all');
  protected readonly filters: { id: Filter; key: string }[] = [
    { id: 'all', key: 'customers.filterAll' },
    { id: 'due', key: 'customers.filterDue' },
    { id: 'clear', key: 'customers.filterClear' },
  ];

  constructor() {
    effect(() => {
      const f = this.filterParam();
      if (f === 'due' || f === 'clear') untracked(() => this.filter.set(f));
    });
    effect(() => {
      this.events.version();
      untracked(() => this.reload());
    });
  }

  private query(page: number) {
    return { page, limit: 50, search: this.search(), sort: this.sort(), filter: this.filter() };
  }

  protected reload(): void {
    this.loading.set(true);
    this.api.list(this.query(1)).subscribe({
      next: (r) => {
        this.items.set(r.data);
        this.total.set(Number(r.meta?.total ?? r.data.length));
        this.outstanding.set(Number(r.meta?.['outstanding'] ?? 0));
        this.dueCount.set(Number(r.meta?.['dueCount'] ?? 0));
        this.page.set(1);
        this.hasMore.set(Number(r.meta?.page ?? 1) < Number(r.meta?.totalPages ?? 1));
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
    this.api.list(this.query(next)).subscribe({
      next: (r) => {
        this.items.update((cur) => [...cur, ...r.data]);
        this.page.set(next);
        this.hasMore.set(Number(r.meta?.page ?? 1) < Number(r.meta?.totalPages ?? 1));
      },
      error: (e) => this.toast.apiError(e),
    });
  }

  protected onSearch(v: string): void {
    this.search.set(v);
    this.reload();
  }
  protected setSort(v: string): void {
    this.sort.set(v);
    this.reload();
  }
  protected setFilter(f: Filter): void {
    this.filter.set(f);
    this.reload();
  }

  protected add(): void {
    this.dialog
      .open(CustomerFormDialog, { data: {}, width: '480px', maxWidth: '96vw', autoFocus: false })
      .afterClosed()
      .subscribe((c?: Customer) => {
        if (!c) return;
        this.events.changed('customers');
        void this.router.navigate(['/customers', c.id]);
      });
  }

  protected open(c: Customer): void {
    void this.router.navigate(['/customers', c.id]);
  }

  protected initials(name: string): string {
    return name.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('');
  }
}
