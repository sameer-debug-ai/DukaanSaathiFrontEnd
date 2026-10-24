import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, input, model, output } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { debounceTime, distinctUntilChanged } from 'rxjs';

/** Debounced search input with clear button. Emits `search` 300ms after typing stops. */
@Component({
  selector: 'app-search-box',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <label class="box">
      <span class="material-symbols-outlined" aria-hidden="true">search</span>
      <input [formControl]="ctrl" [placeholder]="placeholder()" type="search" [attr.aria-label]="placeholder()" autocomplete="off" />
      @if (ctrl.value) {
        <button type="button" (click)="clear()" aria-label="Clear search">
          <span class="material-symbols-outlined">close</span>
        </button>
      }
    </label>
  `,
  styles: `
    :host { display: block; flex: 1; min-width: 200px; }
    .box {
      display: flex; align-items: center; gap: 8px; height: 48px; padding: 0 6px 0 14px;
      border-radius: 14px; border: 1px solid var(--ds-line); background: var(--ds-card); color: var(--ds-muted);
    }
    .box:focus-within { border-color: var(--ds-brand); box-shadow: 0 0 0 3px var(--ds-brand-soft); }
    input { flex: 1; min-width: 0; border: 0; outline: 0; background: transparent; font: inherit; color: var(--ds-text); }
    input::-webkit-search-cancel-button { display: none; }
    button { border: 0; background: none; color: var(--ds-muted); cursor: pointer; min-height: 40px; width: 40px; display: grid; place-items: center; border-radius: 10px; }
  `,
})
export class SearchBox implements OnInit {
  readonly placeholder = input('Search');
  readonly value = model('');
  readonly search = output<string>();
  protected readonly ctrl = new FormControl('', { nonNullable: true });
  private readonly destroyRef = inject(DestroyRef);

  ngOnInit(): void {
    this.ctrl.setValue(this.value(), { emitEvent: false });
    this.ctrl.valueChanges.pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef)).subscribe((v) => {
      this.value.set(v.trim());
      this.search.emit(v.trim());
    });
  }

  protected clear(): void {
    this.ctrl.setValue('');
  }
}
