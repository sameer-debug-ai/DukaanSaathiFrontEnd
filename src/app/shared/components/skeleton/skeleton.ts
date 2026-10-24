import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Shimmering placeholder rows shown while data loads. */
@Component({
  selector: 'app-skeleton',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-3" aria-busy="true" aria-live="polite">
      @for (row of rowList(); track $index) {
        <div class="ds-skeleton" [style.height.px]="height()"></div>
      }
    </div>
  `,
})
export class Skeleton {
  readonly rows = input<number>(3);
  readonly height = input<number>(56);
  protected readonly rowList = computed(() => Array.from({ length: this.rows() }));
}
