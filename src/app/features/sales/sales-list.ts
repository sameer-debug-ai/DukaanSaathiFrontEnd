import { ChangeDetectionStrategy, Component, effect, inject, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButton } from '@angular/material/button';
import { TranslatePipe } from '@ngx-translate/core';
import type { Sale, SalePaymentMode } from '../../core/models/domain.models';
import { AppEvents } from '../../core/services/app-events.service';
import { SalesApi } from '../../core/services/data.services';
import { ToastService } from '../../core/services/toast.service';
import { billLabel } from '../../core/utils/bill';
import { daysAgo, istDay } from '../../core/utils/format';
import { DateRange, type DateRangeValue } from '../../shared/components/date-range/date-range';
import { EmptyState } from '../../shared/components/empty-state/empty-state';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { SearchBox } from '../../shared/components/search-box/search-box';
import { Skeleton } from '../../shared/components/skeleton/skeleton';
import { InrPipe } from '../../shared/pipes/inr.pipe';
import { IstDatePipe } from '../../shared/pipes/ist-date.pipe';

export const MODE_BADGE: Record<SalePaymentMode, string> = { cash: 'ok', upi: 'info', udhaar: 'danger', partial: 'warn' };

@Component({
  selector: 'app-sales-list',
  imports: [RouterLink, MatButton, TranslatePipe, PageHeader, DateRange, SearchBox, Skeleton, EmptyState, InrPipe, IstDatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="ds-page">
      <app-page-header [title]="'sales.title' | translate" [subtitle]="'sales.summary' | translate: { count: total(), amount: (amount() | inr) }">
        <a mat-flat-button routerLink="/sales/new"><span class="material-symbols-outlined">add</span>{{ 'dashboard.newBill' | translate }}</a>
      </app-page-header>

      <div class="flex flex-col gap-3 mb-4">
        <app-date-range initial="7d" (rangeChange)="setRange($event)" />
        <div class="ds-toolbar !mb-0">
          <app-search-box [placeholder]="'sales.searchPlaceholder' | translate" (search)="onSearch($event)" />
        </div>
        <div class="ds-chips">
          @for (m of modes; track m) {
            <button class="ds-chip" [class.active]="mode() === m && !cancelledOnly()" (click)="setMode(m)">{{ (m ? 'pay.' + m : 'products.filterAll') | translate }}</button>
          }
          <button class="ds-chip" [class.active]="cancelledOnly()" (click)="toggleCancelled()">{{ 'bill.cancelledFilter' | translate }}</button>
        </div>
      </div>

      <div class="ds-card overflow-hidden">
        @if (loading()) {
          <div class="p-4"><app-skeleton [rows]="6" /></div>
        } @else if (!items().length) {
          <app-empty-state icon="receipt_long" [title]="'sales.empty' | translate" [hint]="'sales.emptyHint' | translate">
            <a mat-flat-button routerLink="/sales/new">{{ 'dashboard.newBill' | translate }}</a>
          </app-empty-state>
        } @else {
          <table class="ds-table hidden md:table">
            <thead>
              <tr>
                <th>{{ 'sales.bill' | translate }}</th>
                <th>{{ 'common.date' | translate }}</th>
                <th>{{ 'billing.customer' | translate }}</th>
                <th>{{ 'sales.items' | translate }}</th>
                <th>{{ 'billing.paymentMode' | translate }}</th>
                <th class="num">{{ 'common.total' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              @for (s of items(); track s.id) {
                <tr class="clickable" [routerLink]="['/sales', s.id]">
                  <td class="font-semibold">
                    {{ label(s) }}
                    @if (s.status === 'cancelled') { <span class="ds-badge danger">{{ 'bill.cancelledShort' | translate }}</span> }
                  </td>
                  <td>{{ s.date | istDate: true }}</td>
                  <td>{{ s.customerName || ('billing.walkIn' | translate) }}</td>
                  <td class="text-muted">{{ itemsLabel(s) }}</td>
                  <td><span class="ds-badge" [class]="'ds-badge ' + modeBadge[s.paymentMode]">{{ ('pay.' + s.paymentMode) | translate }}</span></td>
                  <td class="num font-semibold" [class.void]="s.status === 'cancelled'">{{ s.totalAmount | inr }}</td>
                </tr>
              }
            </tbody>
          </table>
          <div class="ds-list md:hidden">
            @for (s of items(); track s.id) {
              <a class="ds-list-item" [routerLink]="['/sales', s.id]">
                <span class="ds-avatar">{{ shortNo(s) }}</span>
                <div class="flex-1 min-w-0">
                  <div class="title">{{ s.customerName || ('billing.walkIn' | translate) }}</div>
                  <div class="sub">{{ label(s) }} · {{ s.date | istDate: true }} · {{ itemsLabel(s) }}</div>
                </div>
                <div class="text-right">
                  <div class="font-semibold tabular" [class.void]="s.status === 'cancelled'">{{ s.totalAmount | inr }}</div>
                  @if (s.status === 'cancelled') {
                    <span class="ds-badge danger">{{ 'bill.cancelledShort' | translate }}</span>
                  } @else {
                    <span class="ds-badge" [class]="'ds-badge ' + modeBadge[s.paymentMode]">{{ ('pay.' + s.paymentMode) | translate }}</span>
                  }
                </div>
              </a>
            }
          </div>
          @if (hasMore()) {
            <div class="p-3 text-center"><button mat-button (click)="loadMore()">{{ 'common.loadMore' | translate }}</button></div>
          }
        }
      </div>
    </section>
  `,
  styles: `
    .void { text-decoration: line-through; color: var(--ds-muted); }
  `,
})
export class SalesList {
  private readonly api = inject(SalesApi);
  private readonly toast = inject(ToastService);
  private readonly events = inject(AppEvents);

  protected readonly modeBadge = MODE_BADGE;
  protected readonly modes: (SalePaymentMode | '')[] = ['', 'cash', 'upi', 'udhaar', 'partial'];
  protected readonly items = signal<Sale[]>([]);
  protected readonly total = signal(0);
  protected readonly amount = signal(0);
  protected readonly loading = signal(true);
  protected readonly page = signal(1);
  protected readonly hasMore = signal(false);
  protected readonly mode = signal<SalePaymentMode | ''>('');
  protected readonly cancelledOnly = signal(false);
  protected readonly label = billLabel;
  private range: DateRangeValue = { from: daysAgo(6), to: istDay() };
  private search = '';

  constructor() {
    effect(() => {
      this.events.version();
      untracked(() => this.load(1));
    });
  }

  private load(page: number): void {
    if (page === 1) this.loading.set(true);
    this.api.list({ ...this.range, search: this.search, paymentMode: this.mode(), status: this.cancelledOnly() ? 'cancelled' : undefined, page, limit: 40 }).subscribe({
      next: (r) => {
        this.items.update((cur) => (page === 1 ? r.data : [...cur, ...r.data]));
        this.total.set(Number(r.meta?.total ?? 0));
        this.amount.set(Number(r.meta?.['totalAmount'] ?? 0));
        this.page.set(page);
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
    this.load(this.page() + 1);
  }
  protected setRange(r: DateRangeValue): void {
    this.range = r;
    this.load(1);
  }
  protected onSearch(v: string): void {
    this.search = v;
    this.load(1);
  }
  protected setMode(m: SalePaymentMode | ''): void {
    this.mode.set(m);
    this.cancelledOnly.set(false);
    this.load(1);
  }
  protected toggleCancelled(): void {
    this.cancelledOnly.update((v) => !v);
    this.mode.set('');
    this.load(1);
  }
  /** Avatar text: the bill's running number in the year (0001), or #12 for older bills. */
  protected shortNo(s: Sale): string {
    return s.invoiceNo ? s.invoiceNo.split('/').pop()! : `#${s.billNumber}`;
  }
  protected itemsLabel(s: Sale): string {
    const names = s.items.slice(0, 2).map((i) => i.name).join(', ');
    return s.items.length > 2 ? `${names} +${s.items.length - 2}` : names;
  }
}
