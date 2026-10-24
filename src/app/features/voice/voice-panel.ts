import { ChangeDetectionStrategy, Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import type { VoiceParseResult } from '../../core/models/domain.models';
import { apiErrorMessage } from '../../core/services/api.service';
import { AppEvents, StockAlertsService } from '../../core/services/app-events.service';
import { VoiceApi } from '../../core/services/data.services';
import { LanguageService } from '../../core/services/language.service';
import { SpeechService, type SpeechLang } from '../../core/services/speech.service';
import { ToastService } from '../../core/services/toast.service';
import { storage } from '../../core/utils/storage';
import { VoiceConfirm } from './voice-confirm';
import { VoiceExecutor, type ConfirmedCommand } from './voice-executor.service';

type Stage = 'idle' | 'listening' | 'parsing' | 'confirm' | 'saving' | 'done' | 'answer';

const EXAMPLES = [
  'Sharma ji ke 500 rupay ka saman gaya',
  'Gupta ji ko 2 kilo cheeni aur 1 litre tel udhaar diya',
  'Verma ji ne 300 rupay de diye',
  'Ramesh traders se 50 kilo aata liya 1500 ka, 1000 de diye',
  '2 packet maggi aur 1 Parle-G becha cash mein',
  'chawal ka stock 25 kilo badhao',
  'Sharma ji ka kitna udhaar baaki hai?',
  'kya kya khatam hone wala hai?',
  'aaj kitni bikri hui?',
];

const LANG_KEY = 'ds.voiceLang';
const SPEAK_KEY = 'ds.voiceSpeak';

/** The voice assistant sheet: listen -> parse -> confirm -> save (or answer a question). */
@Component({
  selector: 'app-voice-panel',
  imports: [FormsModule, MatDialogModule, MatButton, MatIconButton, MatProgressSpinner, TranslatePipe, VoiceConfirm],
  templateUrl: './voice-panel.html',
  styleUrl: './voice-panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VoicePanel implements OnInit, OnDestroy {
  private readonly data = inject<{ text?: string } | null>(MAT_DIALOG_DATA, { optional: true });
  private readonly ref = inject(MatDialogRef<VoicePanel>);
  private readonly api = inject(VoiceApi);
  private readonly executor = inject(VoiceExecutor);
  private readonly toast = inject(ToastService);
  private readonly lang = inject(LanguageService);
  private readonly events = inject(AppEvents);
  private readonly alerts = inject(StockAlertsService);
  private readonly t = inject(TranslateService);
  protected readonly speech = inject(SpeechService);

  protected readonly stage = signal<Stage>('idle');
  protected readonly text = signal('');
  protected readonly result = signal<VoiceParseResult | null>(null);
  protected readonly message = signal('');
  protected readonly speechLang = signal<SpeechLang>((storage.get(LANG_KEY) as SpeechLang) || 'hi-IN');
  protected readonly speakBack = signal(storage.get(SPEAK_KEY) !== '0');
  protected readonly examples = EXAMPLES;

  ngOnInit(): void {
    if (this.data?.text) {
      this.text.set(this.data.text);
      this.submit();
    } else if (this.speech.supported) {
      this.listen();
    }
  }

  ngOnDestroy(): void {
    this.speech.cancel();
  }

  protected toggleLang(): void {
    this.speechLang.update((l) => (l === 'hi-IN' ? 'en-IN' : 'hi-IN'));
    storage.set(LANG_KEY, this.speechLang());
    if (this.stage() === 'listening') this.listen();
  }

  protected toggleSpeak(): void {
    this.speakBack.update((v) => !v);
    storage.set(SPEAK_KEY, this.speakBack() ? '1' : '0');
  }

  protected listen(): void {
    if (!this.speech.supported) return;
    this.reset();
    this.stage.set('listening');
    this.speech.start(this.speechLang(), (finalText) => {
      this.text.set(finalText);
      this.submit();
    });
    // If recognition ends without any text, drop back to idle.
    setTimeout(() => this.watchIdle(), 400);
  }

  private watchIdle(): void {
    if (this.stage() !== 'listening') return;
    if (!this.speech.listening() && !this.speech.transcript()) {
      this.stage.set('idle');
      return;
    }
    setTimeout(() => this.watchIdle(), 400);
  }

  protected stopListening(): void {
    this.speech.stop();
  }

  protected useExample(e: string): void {
    this.text.set(e);
    this.submit();
  }

  protected submit(): void {
    const text = this.text().trim();
    if (!text) return;
    this.speech.cancel();
    this.stage.set('parsing');
    this.api.parse(text, this.lang.current()).subscribe({
      next: (r) => {
        this.result.set(r);
        if (r.needsConfirmation) {
          this.stage.set('confirm');
        } else {
          this.message.set(r.answer ?? '');
          this.stage.set('answer');
          this.say(r.answer ?? '');
        }
      },
      error: (e) => {
        this.stage.set('idle');
        this.toast.error(apiErrorMessage(e));
      },
    });
  }

  protected onConfirm(cmd: ConfirmedCommand): void {
    const r = this.result();
    if (!r) return;
    this.stage.set('saving');
    this.executor.execute(cmd).subscribe({
      next: (msg) => {
        this.api.updateLog(r.logId, { status: 'confirmed', resultMessage: msg }).subscribe({ error: () => undefined });
        this.message.set(msg);
        this.stage.set('done');
        this.toast.success(msg);
        this.say(msg);
        this.alerts.refresh();
        this.events.changed('any');
      },
      error: (e) => {
        const msg = apiErrorMessage(e);
        this.api.updateLog(r.logId, { status: 'failed', error: msg }).subscribe({ error: () => undefined });
        this.stage.set('confirm');
        this.toast.error(msg);
      },
    });
  }

  protected onCancel(): void {
    const r = this.result();
    if (r) this.api.updateLog(r.logId, { status: 'cancelled' }).subscribe({ error: () => undefined });
    this.toast.info('voice.cancelled');
    this.reset();
  }

  protected again(): void {
    this.reset();
    if (this.speech.supported) this.listen();
  }

  protected close(): void {
    this.ref.close();
  }

  private reset(): void {
    this.result.set(null);
    this.message.set('');
    this.stage.set('idle');
  }

  private say(text: string): void {
    if (this.speakBack()) this.speech.speak(text, this.lang.current() === 'hi' ? 'hi-IN' : 'en-IN');
  }

  protected errorKey(): string | null {
    const e = this.speech.error();
    if (!e || e === 'aborted' || e === 'no-speech') return e === 'no-speech' ? 'voice.noSpeech' : null;
    return e === 'not-allowed' || e === 'service-not-allowed' ? 'voice.micBlocked' : 'voice.micError';
  }

  protected readonly placeholder = () => this.t.instant('voice.typePlaceholder');
}
