import { ChangeDetectionStrategy, Component, computed, ElementRef, inject, OnInit, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MatSlideToggle } from '@angular/material/slide-toggle';
import { TranslatePipe } from '@ngx-translate/core';
import { AuthService } from '../../core/auth/auth.service';
import { BillingApi, GST_RATES } from '../../core/services/billing.api';
import { CategoriesApi, type Category } from '../../core/services/categories.api';
import { ToastService } from '../../core/services/toast.service';
import { EmptyState } from '../../shared/components/empty-state/empty-state';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { Skeleton } from '../../shared/components/skeleton/skeleton';

/** Add, rename and switch product categories on/off. Inactive ones are hidden from the product form. */
@Component({
  selector: 'app-categories-page',
  imports: [FormsModule, MatButton, MatSlideToggle, TranslatePipe, PageHeader, Skeleton, EmptyState],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="ds-page max-w-3xl">
      <app-page-header [title]="'categories.title' | translate" [subtitle]="'categories.subtitle' | translate" backLink="/products" />

      <!-- Add -->
      <form class="ds-card add" (ngSubmit)="add()">
        <span class="material-symbols-outlined add-icon" aria-hidden="true">category</span>
        <input
          #addInput
          class="add-input"
          name="newName"
          [ngModel]="newName()"
          (ngModelChange)="newName.set($event)"
          [placeholder]="'categories.addPlaceholder' | translate"
          [attr.aria-label]="'categories.addPlaceholder' | translate"
          maxlength="60"
          autocomplete="off"
        />
        <!-- Always clickable: an empty box gets focus and a hint instead of a dead button. -->
        <button mat-flat-button type="submit" [disabled]="busy()">
          <span class="material-symbols-outlined">add</span>{{ 'categories.add' | translate }}
        </button>
      </form>

      <!-- Filter -->
      <div class="ds-chips my-3">
        @for (f of filters; track f) {
          <button type="button" class="ds-chip" [class.active]="filter() === f" (click)="filter.set(f)">
            {{ 'categories.filter.' + f | translate }} <span class="count">{{ countFor(f) }}</span>
          </button>
        }
      </div>

      @if (loading()) {
        <app-skeleton [rows]="4" />
      } @else if (!shown().length) {
        <app-empty-state icon="category" [title]="'categories.empty' | translate" [hint]="'categories.emptyHint' | translate" />
      } @else {
        <ul class="ds-card list">
          @for (c of shown(); track c.id) {
            <li class="item" [class.inactive]="!c.isActive">
              @if (editing() === c.id) {
                <form class="edit" (ngSubmit)="saveName(c)">
                  <input
                    class="edit-input"
                    name="editName"
                    [ngModel]="editName()"
                    (ngModelChange)="editName.set($event)"
                    maxlength="60"
                    [attr.aria-label]="'categories.rename' | translate"
                    autocomplete="off"
                  />
                  <button mat-flat-button type="submit" [disabled]="!editName().trim() || busy()">{{ 'common.save' | translate }}</button>
                  <button mat-button type="button" (click)="editing.set(null)">{{ 'common.cancel' | translate }}</button>
                </form>
              } @else if (gstFor() === c.id) {
                <form class="edit gst" (ngSubmit)="applyGst(c)">
                  <span class="name">{{ c.name }}</span>
                  <div class="rates">
                    @for (r of gstRates; track r) {
                      <button type="button" class="ds-chip" [class.active]="gstRate() === r" (click)="gstRate.set(r)">{{ r }}%</button>
                    }
                    <input class="edit-input rate" type="number" name="gstRate" min="0" max="100" step="0.01" [ngModel]="gstRate()" (ngModelChange)="gstRate.set($event)" [attr.aria-label]="'products.gstRate' | translate" />
                  </div>
                  <input class="edit-input" name="gstHsn" inputmode="numeric" maxlength="8" [ngModel]="gstHsn()" (ngModelChange)="gstHsn.set($event)" [placeholder]="'categories.hsnOptional' | translate" autocomplete="off" />
                  <button mat-flat-button type="submit" [disabled]="busy()">{{ 'categories.applyGst' | translate: { count: c.productCount } }}</button>
                  <button mat-button type="button" (click)="gstFor.set(null)">{{ 'common.cancel' | translate }}</button>
                </form>
              } @else {
                <div class="info">
                  <span class="name">{{ c.name }}</span>
                  <span class="meta">
                    {{ 'categories.products' | translate: { count: c.productCount } }}
                    @if (!c.isActive) {
                      · <span class="off">{{ 'categories.hidden' | translate }}</span>
                    }
                  </span>
                </div>
                @if (gstOn) {
                  <button type="button" class="icon-btn" (click)="startGst(c)" [attr.aria-label]="'categories.setGst' | translate: { name: c.name }">
                    <span class="material-symbols-outlined">percent</span>
                  </button>
                }
                <button type="button" class="icon-btn" (click)="startEdit(c)" [attr.aria-label]="'categories.rename' | translate">
                  <span class="material-symbols-outlined">edit</span>
                </button>
                <mat-slide-toggle
                  [checked]="c.isActive"
                  [disabled]="busy()"
                  (change)="setActive(c, $event.checked)"
                  [attr.aria-label]="(c.isActive ? 'categories.deactivate' : 'categories.activate') | translate: { name: c.name }"
                />
              }
            </li>
          }
        </ul>
        <p class="note">{{ 'categories.note' | translate }}</p>
      }
    </section>
  `,
  styles: `
    .add { display: flex; align-items: center; gap: 10px; padding: 8px 8px 8px 16px; }
    .add-icon { color: var(--ds-brand); }
    .add-input, .edit-input {
      flex: 1; min-width: 0; height: 44px; border: 0; outline: 0; background: transparent;
      color: var(--ds-text); font: inherit; font-size: 1rem;
    }
    .add button .material-symbols-outlined { margin-right: 4px; }
    .ds-chip .count { margin-left: 4px; opacity: 0.7; font-size: 0.85em; }
    .list { margin: 0; padding: 0; list-style: none; overflow: hidden; }
    .item { display: flex; align-items: center; gap: 8px; min-height: 64px; padding: 8px 12px 8px 16px; }
    .item + .item { border-top: 1px solid var(--ds-line); }
    .item.inactive .name { color: var(--ds-muted); }
    .info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
    .name { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .meta { font-size: 0.82rem; color: var(--ds-muted); }
    .off { color: var(--ds-warn); font-weight: 600; }
    .icon-btn {
      display: grid; place-items: center; width: 40px; height: 40px; border: 0; border-radius: 50%;
      background: transparent; color: var(--ds-muted); cursor: pointer;
    }
    .icon-btn:hover { background: var(--ds-surface); color: var(--ds-brand); }
    .edit { flex: 1; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .edit-input { border: 1px solid var(--ds-brand); border-radius: 10px; padding: 0 12px; }
    .gst { padding: 6px 0; }
    .gst .name { flex-basis: 100%; }
    .gst .rates { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; flex-basis: 100%; }
    .gst .rate { flex: 0 0 76px; }
    .note { margin: 12px 4px 0; font-size: 0.85rem; color: var(--ds-muted); }
  `,
})
export class CategoriesPage implements OnInit {
  private readonly api = inject(CategoriesApi);
  private readonly toast = inject(ToastService);

  protected readonly filters = ['all', 'active', 'inactive'] as const;
  protected readonly categories = signal<Category[]>([]);
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly filter = signal<(typeof this.filters)[number]>('all');
  protected readonly newName = signal('');
  protected readonly editing = signal<string | null>(null);
  protected readonly editName = signal('');
  private readonly addInput = viewChild.required<ElementRef<HTMLInputElement>>('addInput');
  private readonly billing = inject(BillingApi);
  /** GST shops can set one GST rate for every product of a category. */
  protected readonly gstOn = !!inject(AuthService).user()?.billing?.gstEnabled;
  protected readonly gstRates = GST_RATES;
  protected readonly gstFor = signal<string | null>(null);
  protected readonly gstRate = signal<number>(5);
  protected readonly gstHsn = signal('');

  protected readonly shown = computed(() => {
    const f = this.filter();
    return this.categories().filter((c) => f === 'all' || (f === 'active' ? c.isActive : !c.isActive));
  });

  ngOnInit(): void {
    this.api.list().subscribe({
      next: (list) => {
        this.categories.set(list);
        this.loading.set(false);
      },
      error: (e) => {
        this.loading.set(false);
        this.toast.apiError(e);
      },
    });
  }

  protected countFor(f: (typeof this.filters)[number]): number {
    return f === 'all' ? this.categories().length : this.categories().filter((c) => c.isActive === (f === 'active')).length;
  }

  protected add(): void {
    const name = this.newName().trim();
    if (!name) {
      this.addInput().nativeElement.focus();
      this.toast.info('categories.typeName');
      return;
    }
    this.busy.set(true);
    this.api.create(name).subscribe({
      next: (c) => {
        this.busy.set(false);
        this.newName.set('');
        this.categories.update((list) => [...list, c].sort(byActiveThenName));
        this.toast.success('categories.added', { name: c.name });
      },
      error: (e) => {
        this.busy.set(false);
        this.toast.apiError(e);
      },
    });
  }

  protected startGst(c: Category): void {
    this.editing.set(null);
    this.gstHsn.set('');
    this.gstFor.set(c.id);
  }

  protected applyGst(c: Category): void {
    const rate = Number(this.gstRate());
    const hsn = this.gstHsn().trim();
    if (!(rate >= 0 && rate <= 100)) return this.toast.error('categories.gstInvalid');
    if (hsn && !/^(\d{4}|\d{6}|\d{8})$/.test(hsn)) return this.toast.error('products.hsnInvalid');
    this.busy.set(true);
    this.billing.gstByCategory({ category: c.name, gstRate: rate, ...(hsn ? { hsnCode: hsn } : {}) }).subscribe({
      next: (r) => {
        this.busy.set(false);
        this.gstFor.set(null);
        this.toast.success('categories.gstApplied', { count: r.matched, rate, name: c.name });
      },
      error: (e) => {
        this.busy.set(false);
        this.toast.apiError(e);
      },
    });
  }

  protected startEdit(c: Category): void {
    this.gstFor.set(null);
    this.editName.set(c.name);
    this.editing.set(c.id);
  }

  protected saveName(c: Category): void {
    const name = this.editName().trim();
    if (!name || name === c.name) return this.editing.set(null);
    this.patch(c, { name }, 'categories.renamed');
  }

  protected setActive(c: Category, isActive: boolean): void {
    this.patch(c, { isActive }, isActive ? 'categories.activated' : 'categories.deactivated');
  }

  private patch(c: Category, body: { name?: string; isActive?: boolean }, msg: string): void {
    this.busy.set(true);
    this.api.update(c.id, body).subscribe({
      next: (u) => {
        this.busy.set(false);
        this.editing.set(null);
        this.categories.update((list) => list.map((x) => (x.id === u.id ? u : x)).sort(byActiveThenName));
        this.toast.success(msg, { name: u.name });
      },
      error: (e) => {
        this.busy.set(false);
        this.toast.apiError(e);
        // Put the toggle back to what the server has.
        this.categories.update((list) => [...list]);
      },
    });
  }
}

const byActiveThenName = (a: Category, b: Category) => Number(b.isActive) - Number(a.isActive) || a.name.localeCompare(b.name);
