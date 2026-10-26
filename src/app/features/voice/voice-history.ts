import { ChangeDetectionStrategy, Component, effect, inject, signal, untracked } from '@angular/core';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatTooltip } from '@angular/material/tooltip';
import { TranslatePipe } from '@ngx-translate/core';
import type { VoiceLog } from '../../core/models/domain.models';
import { AppEvents } from '../../core/services/app-events.service';
import { VoiceApi } from '../../core/services/data.services';
import { ToastService } from '../../core/services/toast.service';
import { EmptyState } from '../../shared/components/empty-state/empty-state';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { Skeleton } from '../../shared/components/skeleton/skeleton';
import { IstDatePipe } from '../../shared/pipes/ist-date.pipe';
import { VoiceUi } from './voice-ui.service';

const STATUS: Record<VoiceLog['status'], { cls: string; icon: string }> = {
  confirmed: { cls: 'ok', icon: 'check_circle' },
  cancelled: { cls: 'muted', icon: 'cancel' },
  failed: { cls: 'danger', icon: 'error' },
  pending: { cls: 'warn', icon: 'schedule' },
  undone: { cls: 'info', icon: 'undo' },
};

@Component({
  selector: 'app-voice-history',
  imports: [MatButton, MatIconButton, MatTooltip, TranslatePipe, PageHeader, Skeleton, EmptyState, IstDatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="ds-page">
      <app-page-header [title]="'nav.voiceHistory' | translate" [subtitle]="'voice.historySubtitle' | translate">
        <button mat-flat-button (click)="voice.open()"><span class="material-symbols-outlined">mic</span>{{ 'voice.speakNow' | translate }}</button>
      </app-page-header>
      <div class="ds-chips mb-4">
        @for (s of statuses; track s) {
          <button class="ds-chip" [class.active]="status() === s" (click)="setStatus(s)">{{ (s ? 'voice.status.' + s : 'products.filterAll') | translate }}</button>
        }
      </div>
      <div class="ds-card overflow-hidden">
        @if (loading()) {
          <div class="p-4"><app-skeleton [rows]="6" /></div>
        } @else if (!items().length) {
          <app-empty-state icon="graphic_eq" [title]="'voice.historyEmpty' | translate" [hint]="'voice.historyEmptyHint' | translate">
            <button mat-flat-button (click)="voice.open()">{{ 'voice.speakNow' | translate }}</button>
          </app-empty-state>
        } @else {
          <div class="ds-list">
            @for (l of items(); track l.id) {
              <div class="ds-list-item">
                <span class="ds-badge" [class]="'ds-badge ' + st[l.status].cls" [matTooltip]="('voice.status.' + l.status) | translate">
                  <span class="material-symbols-outlined">{{ st[l.status].icon }}</span>
                </span>
                <div class="flex-1 min-w-0">
                  <div class="title whitespace-normal">“{{ l.rawText }}”</div>
                  <div class="sub whitespace-normal">
                    {{ ('voice.intent.' + l.intent) | translate }} · {{ l.createdAt | istDate: true }}
                    @if (l.resultMessage) { · {{ l.resultMessage }} }
                    @if (l.error) { · <span class="text-danger">{{ l.error }}</span> }
                  </div>
                </div>
                <button mat-icon-button (click)="voice.open(l.rawText)" [matTooltip]="'voice.runAgain' | translate" [attr.aria-label]="'voice.runAgain' | translate">
                  <span class="material-symbols-outlined">replay</span>
                </button>
              </div>
            }
          </div>
          @if (hasMore()) {
            <div class="p-3 text-center"><button mat-button (click)="load(page() + 1)">{{ 'common.loadMore' | translate }}</button></div>
          }
        }
      </div>
    </section>
  `,
})
export class VoiceHistory {
  private readonly api = inject(VoiceApi);
  private readonly toast = inject(ToastService);
  private readonly events = inject(AppEvents);
  protected readonly voice = inject(VoiceUi);

  protected readonly st = STATUS;
  protected readonly statuses: (VoiceLog['status'] | '')[] = ['', 'confirmed', 'undone', 'cancelled', 'failed', 'pending'];
  protected readonly status = signal<VoiceLog['status'] | ''>('');
  protected readonly items = signal<VoiceLog[]>([]);
  protected readonly loading = signal(true);
  protected readonly page = signal(1);
  protected readonly hasMore = signal(false);

  constructor() {
    effect(() => {
      this.events.version();
      untracked(() => this.load(1));
    });
  }

  protected setStatus(s: VoiceLog['status'] | ''): void {
    this.status.set(s);
    this.load(1);
  }

  protected load(page: number): void {
    this.api.logs({ page, limit: 30, status: this.status() }).subscribe({
      next: (r) => {
        this.items.update((cur) => (page === 1 ? r.items : [...cur, ...r.items]));
        this.page.set(page);
        this.hasMore.set(r.meta.page < r.meta.totalPages);
        this.loading.set(false);
      },
      error: (e) => {
        this.loading.set(false);
        this.toast.apiError(e);
      },
    });
  }
}
