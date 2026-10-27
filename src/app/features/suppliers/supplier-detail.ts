import { ChangeDetectionStrategy, Component, effect, inject, input, signal, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatMenuModule } from '@angular/material/menu';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import type { Purchase, Supplier, SupplierHistoryRow } from '../../core/models/domain.models';
import { AppEvents } from '../../core/services/app-events.service';
import { SuppliersApi } from '../../core/services/data.services';
import { ToastService } from '../../core/services/toast.service';
import { AliasChips } from '../../shared/components/alias-chips/alias-chips';
import { ConfirmService } from '../../shared/components/confirm-dialog/confirm-dialog';
import { EmptyState } from '../../shared/components/empty-state/empty-state';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { Skeleton } from '../../shared/components/skeleton/skeleton';
import { StatCard } from '../../shared/components/stat-card/stat-card';
import { InrPipe } from '../../shared/pipes/inr.pipe';
import { IstDatePipe } from '../../shared/pipes/ist-date.pipe';
import { SupplierFormDialog, SupplierPaymentDialog } from './supplier-dialogs';

@Component({
  selector: 'app-supplier-detail',
  imports: [RouterLink, MatButton, MatIconButton, MatMenuModule, TranslatePipe, PageHeader, Skeleton, EmptyState, StatCard, InrPipe, IstDatePipe, AliasChips],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="ds-page">
      @if (supplier(); as s) {
        <app-page-header [title]="s.name" [subtitle]="s.company" backLink="/suppliers">
          <button mat-icon-button [matMenuTriggerFor]="menu" [attr.aria-label]="'common.more' | translate"><span class="material-symbols-outlined">more_vert</span></button>
          <mat-menu #menu="matMenu" xPosition="before">
            <button mat-menu-item (click)="edit(s)"><span class="material-symbols-outlined mr-3 align-middle">edit</span>{{ 'common.edit' | translate }}</button>
            @if (s.phone) {
              <a mat-menu-item [href]="'tel:' + s.phone"><span class="material-symbols-outlined mr-3 align-middle">call</span>{{ 'common.call' | translate }}</a>
            }
            <button mat-menu-item (click)="remove(s)"><span class="material-symbols-outlined mr-3 align-middle">delete</span>{{ 'common.delete' | translate }}</button>
          </mat-menu>
        </app-page-header>

        <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <app-stat-card [label]="'suppliers.payable' | translate" [value]="s.currentPayable | inr" icon="account_balance_wallet" tone="warn" />
          <app-stat-card [label]="'suppliers.totalPurchased' | translate" [value]="s.totalPurchased | inr" icon="inventory" tone="brand" [hint]="'suppliers.purchases' | translate: { count: s.purchaseCount }" />
          <app-stat-card [label]="'suppliers.totalPaid' | translate" [value]="s.totalPaid | inr" icon="payments" tone="ok" />
          <app-stat-card [label]="'auth.phone' | translate" [value]="s.phone || '—'" icon="call" tone="neutral" [hint]="s.gstNumber ? 'GST ' + s.gstNumber : ''" />
        </div>

        <div class="flex gap-3 flex-wrap mb-4">
          <a mat-flat-button class="ds-big-btn" routerLink="/purchases/new" [queryParams]="{ supplierId: s.id }"><span class="material-symbols-outlined">add_shopping_cart</span>{{ 'suppliers.newPurchase' | translate }}</a>
          <button mat-stroked-button class="ds-big-btn" (click)="pay(s)"><span class="material-symbols-outlined">payments</span>{{ 'suppliers.recordPayment' | translate }}</button>
        </div>

        <div class="ds-card p-4 mb-4">
          <app-alias-chips [aliases]="s.aliases" [busy]="aliasBusy()" (remove)="removeAlias(s, $event)" />
        </div>

        <div class="ds-card overflow-hidden">
          <div class="ds-section-title"><h2>{{ 'suppliers.history' | translate }}</h2></div>
          @if (!history().length) {
            <app-empty-state icon="receipt_long" [title]="'suppliers.noHistory' | translate" />
          } @else {
            <div class="ds-list">
              @for (r of history(); track r.kind + r.id) {
                <div class="ds-list-item flex-col !items-stretch">
                  <button type="button" class="row-btn" (click)="toggle(r)" [attr.aria-expanded]="expanded() === r.id">
                    <span class="ds-badge" [class]="'ds-badge ' + (r.kind === 'purchase' ? 'warn' : 'ok')">
                      <span class="material-symbols-outlined">{{ r.kind === 'purchase' ? 'local_shipping' : 'payments' }}</span>
                    </span>
                    <div class="flex-1 min-w-0 text-left">
                      <div class="title">{{ (r.kind === 'purchase' ? 'suppliers.purchase' : 'suppliers.payment') | translate }} · {{ r.amount | inr }}</div>
                      <div class="sub">{{ r.date | istDate }} · {{ r.description }}@if (r.kind === 'purchase' && r.paid) { · {{ 'suppliers.paidNow' | translate: { amount: (r.paid | inr) } }} }</div>
                    </div>
                    <div class="text-right">
                      <div class="font-semibold tabular">{{ r.balance | inr }}</div>
                      <div class="text-xs text-muted">{{ 'stock.balance' | translate }}</div>
                    </div>
                  </button>
                  @if (expanded() === r.id && r.kind === 'purchase') {
                    <table class="ds-table mt-2">
                      <tbody>
                        @for (i of asPurchase(r).items; track $index) {
                          <tr>
                            <td>{{ i.name }}</td>
                            <td class="num">{{ i.qty }} {{ i.unit }} × {{ i.rate | inr }}</td>
                            <td class="num font-semibold">{{ i.total | inr }}</td>
                          </tr>
                        }
                      </tbody>
                    </table>
                    <a mat-button class="self-start" [routerLink]="['/purchases', r.id]">{{ 'purchases.viewDetails' | translate }}</a>
                  }
                </div>
              }
            </div>
          }
        </div>
      } @else {
        <app-skeleton [rows]="3" [height]="100" />
      }
    </section>
  `,
  styles: `
    .row-btn { display: flex; align-items: center; gap: 12px; width: 100%; background: none; border: 0; padding: 0; font: inherit; color: inherit; cursor: pointer; }
  `,
})
export class SupplierDetail {
  readonly id = input.required<string>();
  private readonly api = inject(SuppliersApi);
  private readonly dialog = inject(MatDialog);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly events = inject(AppEvents);
  private readonly router = inject(Router);
  private readonly t = inject(TranslateService);

  protected readonly supplier = signal<Supplier | null>(null);
  protected readonly history = signal<SupplierHistoryRow[]>([]);
  protected readonly expanded = signal<string | null>(null);

  constructor() {
    effect(() => {
      const id = this.id();
      this.events.version();
      untracked(() =>
        this.api.history(id).subscribe({
          next: (r) => {
            this.supplier.set(r.supplier);
            this.history.set(r.history);
          },
          error: (e) => this.toast.apiError(e),
        }),
      );
    });
  }

  protected readonly aliasBusy = signal(false);

  /** Drops one learned/typed name (voice stops matching on it). */
  protected removeAlias(s: Supplier, alias: string): void {
    this.aliasBusy.set(true);
    this.api.update(s.id, { aliases: s.aliases.filter((a) => a !== alias) }).subscribe({
      next: (u) => {
        this.aliasBusy.set(false);
        this.supplier.set({ ...s, aliases: u.aliases });
        this.toast.success('aliases.removed', { name: alias });
      },
      error: (e) => {
        this.aliasBusy.set(false);
        this.toast.apiError(e);
      },
    });
  }

  protected asPurchase(r: SupplierHistoryRow): Purchase {
    return r.ref as Purchase;
  }

  protected toggle(r: SupplierHistoryRow): void {
    this.expanded.update((cur) => (cur === r.id ? null : r.id));
  }

  protected pay(s: Supplier): void {
    this.dialog.open(SupplierPaymentDialog, { data: s, width: '460px', maxWidth: '96vw', autoFocus: false }).afterClosed().subscribe((ok) => ok && this.events.changed('suppliers'));
  }

  protected edit(s: Supplier): void {
    this.dialog.open(SupplierFormDialog, { data: { supplier: s }, width: '480px', maxWidth: '96vw', autoFocus: false }).afterClosed().subscribe((r) => r && this.events.changed('suppliers'));
  }

  protected remove(s: Supplier): void {
    this.confirm.ask({ message: this.t.instant('suppliers.confirmDelete', { name: s.name }), confirmText: this.t.instant('common.delete'), danger: true }).subscribe((ok) => {
      if (!ok) return;
      this.api.remove(s.id).subscribe({
        next: () => {
          this.toast.success('suppliers.deleted');
          this.events.changed('suppliers');
          void this.router.navigateByUrl('/suppliers');
        },
        error: (e) => this.toast.apiError(e),
      });
    });
  }
}
