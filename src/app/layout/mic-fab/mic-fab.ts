import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { VoiceUi } from '../../features/voice/voice-ui.service';

/** Floating microphone button shown on every page; opens the voice assistant. */
@Component({
  selector: 'app-mic-fab',
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button type="button" class="mic-fab" [class.raised]="raised()" (click)="voice.open()" [attr.aria-label]="'voice.mic' | translate">
      <span class="material-symbols-outlined icon-filled">mic</span>
    </button>
  `,
  styles: `
    .mic-fab {
      position: fixed;
      right: 20px;
      bottom: var(--ds-fab-gap);
      z-index: var(--ds-z-fab);
      width: var(--ds-fab-size);
      height: var(--ds-fab-size);
      border-radius: 50%;
      border: 0;
      cursor: pointer;
      display: grid;
      place-items: center;
      color: #fff;
      background: var(--ds-danger);
      box-shadow: 0 6px 18px color-mix(in srgb, var(--ds-danger) 35%, transparent), var(--ds-shadow-md);
      transition: transform var(--ds-dur-fast) var(--ds-ease);
    }
    .mic-fab:hover { transform: scale(1.05); }
    .mic-fab:active { transform: scale(0.94); }
    .mic-fab:focus-visible { outline: 3px solid var(--ds-brand); outline-offset: 3px; }
    .mic-fab .material-symbols-outlined { font-size: 32px; }
    .mic-fab.raised {
      right: 16px;
      bottom: calc(var(--ds-bottom-nav-h) + 14px + env(safe-area-inset-bottom));
    }
  `,
})
export class MicFab {
  readonly raised = input(false);
  protected readonly voice = inject(VoiceUi);
}
