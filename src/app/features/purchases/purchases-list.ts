import { ChangeDetectionStrategy, Component, effect, inject, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButton } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { TranslatePipe } from '@ngx-translate/core';
import type { Purchase, SupplierPayment } from '../../core/models/domain.models';
import { AppEvents } from '../../core/services/app-events.service';
import { SuppliersApi } from '../../core/services/data.services';
import { ToastService } from '../../core/services/toast.service';
import { daysAgo, istDay } from '../../core/utils/format';
import { DateRange, type DateRangeValue } from '../../shared/components/date-range/date-range';
import { EmptyState } from '../../shared/components/empty-state/empty-state';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { Skeleton } from '../../shared/components/skeleton/skeleton';
import { InrPipe } from '../../shared/pipes/inr.pipe';
import { IstDatePipe } from '../../shared/pipes/ist-date.pipe';

@Component({
  selector: 'app-purchases-list',
  imports: [RouterLink, MatButton, MatButtonToggleModule, TranslatePipe, PageHeader, DateRange, Skeleton, EmptyState, InrPipe, IstDatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="ds-page">
      <app-page-header [title]="'nav.purchases' | translate" [subtitle]="'purchases.subtitle' | translate">
        <a mat-flat-button routerLink="/purchases/new"><span class="material-symbols-outlined">add_shopping_cart</span><span class="hidden sm:inline">{{ 'suppliers.newPurchase' | translate }}</span></a>
      </app-page-header>

      <div class="flex flex-col gap-3 mb-4">
        <app-date-range initial="30d" (rangeChange)="setRange($event)" />
        <mat-button-toggle-group [value]="tab()" (change)="setTab($event.value)" class="self-start">
          <mat-button-toggle value="purchases">{{ 'nav.purchases' | translate }}</mat-button-toggle>
          <mat-button-toggle value="payments">{{ 'purchases.payments' | translate }}</mat-button-toggle>
        </mat-button-toggle-group>
      </div>

      <div class="ds-card overflow-hidden">
        @if (loading()) {
          <div class="p-4"><app-skeleton [rows]="5" /></div>
        } @else if (tab() === 'purchases') {
          @if (!purchases().length) {
            <app-empty-state icon="shopping_cart" [title]="'purchases.empty' | translate" />
          } @else {
            <div class="ds-section-title">
              <h2>{{ 'purchases.total' | translate }}: {{ purchaseTotal() | inr }}</h2>
            </div>
            <div class="ds-list">
              @for (p of purchases(); track p.id) {
                <div class="ds-list-item flex-col !items-stretch">
                  <button type="button" class="row-btn" (click)="toggle(p.id)" [attr.aria-expanded]="open() === p.id">
                    <span class="ds-badge warn"><span class="material-symbols-outlined">local_shipping</span></span>
                    <div class="flex-1 min-w-0 text-left">
                      <div class="title">{{ p.supplier?.name ?? '—' }}</div>
                      <div class="sub">{{ p.date | istDate }} · {{ 'purchases.items' | translate: { count: p.items.length } }}{{ p.invoiceNumber ? ' · ' + p.invoiceNumber : '' }}</div>
                    </div>
                    <div class="text-right">
                      <div class="font-semibold tabular">{{ p.totalAmount | inr }}</div>
                      @if (p.dueAmount) {
                        <div class="text-xs text-warn">{{ 'purchases.due' | translate }} {{ p.dueAmount | inr }}</div>
                      } @else {
                        <div class="text-xs text-ok">{{ 'purchases.paidFull' | translate }}</div>
                      }
                    </div>
                  </button>
                  @if (open() === p.id) {
                    <table class="ds-table mt-2">
                      <tbody>
                        @for (i of p.items; track $index) {
                          <tr>
                            <td>{{ i.name }}</td>
                            <td class="num">{{ i.qty }} {{ i.unit }} × {{ i.rate | inr }}</td>
                            <td class="num font-semibold">{{ i.total | inr }}</td>
                          </tr>
                        }
                      </tbody>
                    </table>
                    <div class="flex gap-2 flex-wrap">
                      <a mat-button class="self-start" [routerLink]="['/purchases', p.id]">{{ 'purchases.viewDetails' | translate }}</a>
                      <a mat-button class="self-start" [routerLink]="['/suppliers', p.supplierId]">{{ 'purchases.viewSupplier' | translate }}</a>
                    </div>
                  }
                </div>
              }
            </div>
          }
        } @else {
          @if (!payments().length) {
            <app-empty-state icon="payments" [title]="'purchases.noPayments' | translate" />
          } @else {
            <div class="ds-list">
              @for (p of payments(); track p.id) {
                <a class="ds-list-item" [routerLink]="['/suppliers', p.supplierId]">
                  <span class="ds-badge ok"><span class="material-symbols-outlined">payments</span></span>
                  <div class="flex-1 min-w-0">
                    <div class="title">{{ p.supplier?.name ?? '—' }}</div>
                    <div class="sub">{{ p.date | istDate }} · {{ ('pay.' + p.mode) | translate }}{{ p.note ? ' · ' + p.note : '' }}</div>
                  </div>
                  <strong class="tabular">{{ p.amount | inr }}</strong>
                </a>
              }
            </div>
          }
        }
      </div>
    </section>
  `,
  styles: `.row-btn { display: flex; align-items: center; gap: 12px; width: 100%; background: none; border: 0; padding: 0; font: inherit; color: inherit; cursor: pointer; }`,
})
export class PurchasesList {
  private readonly api = inject(SuppliersApi);
  private readonly toast = inject(ToastService);
  private readonly events = inject(AppEvents);

  protected readonly tab = signal<'purchases' | 'payments'>('purchases');
  protected readonly purchases = signal<Purchase[]>([]);
  protected readonly payments = signal<SupplierPayment[]>([]);
  protected readonly purchaseTotal = signal(0);
  protected readonly loading = signal(true);
  protected readonly open = signal<string | null>(null);
  private range: DateRangeValue = { from: daysAgo(29), to: istDay() };

  constructor() {
    effect(() => {
      this.events.version();
      untracked(() => this.load());
    });
  }

  protected setRange(r: DateRangeValue): void {
    this.range = r;
    this.load();
  }

  protected setTab(t: 'purchases' | 'payments'): void {
    this.tab.set(t);
    this.load();
  }

  protected toggle(id: string): void {
    this.open.update((c) => (c === id ? null : id));
  }

  private load(): void {
    this.loading.set(true);
    const params = { ...this.range, limit: 200 };
    if (this.tab() === 'purchases') {
      this.api.purchases(params).subscribe({
        next: (r) => {
          this.purchases.set(r.items);
          this.purchaseTotal.set(r.items.reduce((s, p) => s + p.totalAmount, 0));
          this.loading.set(false);
        },
        error: (e) => this.fail(e),
      });
    } else {
      this.api.payments(params).subscribe({
        next: (r) => {
          this.payments.set(r.items);
          this.loading.set(false);
        },
        error: (e) => this.fail(e),
      });
    }
  }

  private fail(e: unknown): void {
    this.loading.set(false);
    this.toast.apiError(e);
  }
}
