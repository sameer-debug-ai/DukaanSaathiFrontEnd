import { ChangeDetectionStrategy, Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import type { VoiceParseResult } from '../../core/models/domain.models';
import { apiErrorMessage } from '../../core/services/api.service';
import { AppEvents, StockAlertsService } from '../../core/services/app-events.service';
import { CustomersApi, VoiceApi } from '../../core/services/data.services';
import { LanguageService } from '../../core/services/language.service';
import { MAX_RECORDING_MS } from '../../core/services/audio-recorder.service';
import { SpeechService, type SpeechLang } from '../../core/services/speech.service';
import { ToastService } from '../../core/services/toast.service';
import { storage } from '../../core/utils/storage';
import { VoiceAnswer } from './voice-answer';
import { VoiceConfirm } from './voice-confirm';
import { BillScanDrafts, type BillScanDraft } from '../../core/services/bill-scan.api';
import { BillScanButton } from '../purchases/bill-scan-button';
import { toConfirmedCommand } from './voice-command';
import { VoiceExecutor, type ConfirmedCommand } from './voice-executor.service';
import { VoiceMultiConfirm } from './voice-multi-confirm';
import { VoiceReplies } from './voice-replies.service';
import { VoiceStt } from './voice-stt.service';
import { VoiceUndo } from './voice-undo.service';

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
  'galti ho gayi, pichhla wala hatao',
  'Sharma ji ke 500 likho aur Gupta ji ne 200 de diye',
];

const LANG_KEY = 'ds.voiceLang';

/** The voice assistant sheet: listen -> parse -> confirm -> save (or answer a question). */
@Component({
  selector: 'app-voice-panel',
  imports: [FormsModule, MatDialogModule, MatButton, MatIconButton, MatProgressSpinner, TranslatePipe, VoiceAnswer, VoiceConfirm, VoiceMultiConfirm, BillScanButton],
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
  private readonly router = inject(Router);
  private readonly billDrafts = inject(BillScanDrafts);
  private readonly customers = inject(CustomersApi);
  protected readonly speech = inject(SpeechService);
  private readonly replies = inject(VoiceReplies);
  /** High-accuracy mode / no browser recogniser: record and transcribe on the server. */
  protected readonly stt = inject(VoiceStt);
  protected readonly recorder = this.stt.recorder;
  protected readonly maxSeconds = MAX_RECORDING_MS / 1000;
  protected readonly transcribing = signal(false);
  private recordRun = 0;

  protected readonly stage = signal<Stage>('idle');
  protected readonly text = signal('');
  protected readonly result = signal<VoiceParseResult | null>(null);
  protected readonly message = signal('');
  protected readonly speechLang = signal<SpeechLang>((storage.get(LANG_KEY) as SpeechLang) || 'hi-IN');
  /** Spoken replies on/off (also in Settings). */
  protected readonly speakBack = this.replies.enabled;
  protected readonly examples = EXAMPLES;
  protected readonly undoer = inject(VoiceUndo);
  /** The just-saved voice entry, while it can still be undone from this screen. */
  protected readonly savedLogId = signal<string | null>(null);
  protected readonly undone = signal(false);
  private undoTimer?: ReturnType<typeof setTimeout>;

  ngOnInit(): void {
    if (this.data?.text) {
      this.text.set(this.data.text);
      this.submit();
    } else if (this.speech.supported && !this.stt.highAccuracy()) {
      this.listen();
      this.stt.ready().subscribe();
    } else {
      // No browser recogniser (iOS Safari) or high-accuracy mode: first check the server can transcribe.
      this.stt.ready().subscribe(() => {
        if (this.stage() === 'idle' && !this.text() && this.stt.canListen()) this.listen();
      });
    }
  }

  ngOnDestroy(): void {
    clearTimeout(this.undoTimer);
    this.speech.cancel();
    this.recordRun++;
    this.recorder.cancel();
  }

  protected toggleLang(): void {
    this.speechLang.update((l) => (l === 'hi-IN' ? 'en-IN' : 'hi-IN'));
    storage.set(LANG_KEY, this.speechLang());
    if (this.stage() === 'listening') this.listen();
  }

  protected toggleSpeak(): void {
    this.replies.setEnabled(!this.speakBack());
  }

  protected listen(): void {
    if (this.stt.useRecorder()) return this.record();
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
    if (this.recorder.recording()) this.recorder.stop();
    else this.speech.stop();
  }

  /** Records up to 30 s, gets the text from the server, then continues exactly like typed/spoken text. */
  private record(): void {
    this.reset();
    this.speech.cancel();
    this.stage.set('listening');
    const run = ++this.recordRun;
    const lang = this.speechLang() === 'hi-IN' ? 'hi' : 'en';
    void this.recorder.start().then((audio) => {
      // A newer recording (language switch) or a closed panel replaced this one.
      if (run !== this.recordRun || this.stage() !== 'listening') return;
      if (!audio) {
        this.stage.set('idle');
        return;
      }
      this.text.set('');
      this.transcribing.set(true);
      this.stage.set('parsing');
      this.api.transcribe(audio, lang).subscribe({
        next: ({ text }) => {
          this.transcribing.set(false);
          if (run !== this.recordRun) return;
          if (!text.trim()) {
            this.stage.set('idle');
            this.toast.info('voice.noSpeech');
            return;
          }
          this.text.set(text);
          this.submit();
        },
        error: (e) => {
          this.transcribing.set(false);
          this.stage.set('idle');
          this.toast.error(apiErrorMessage(e));
        },
      });
    });
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
        if (r.intent === 'undo_last') {
          this.undoFromVoice(r);
        } else if (r.actions && r.actions.length > 1) {
          // Several entries in one sentence: saved together (auto-save only if every one qualifies).
          if (r.autoSave) this.onConfirmAll(r.actions.map(toConfirmedCommand));
          else this.stage.set('confirm');
        } else if (r.needsConfirmation && r.autoSave) {
          // Clear command and the shop turned "always ask" off: save now, offer Undo after.
          this.onConfirm(toConfirmedCommand(r));
        } else if (r.needsConfirmation) {
          this.stage.set('confirm');
        } else {
          this.message.set(r.answer ?? '');
          this.stage.set('answer');
          if (r.intent === 'unknown') this.replies.notUnderstood(r.replyLang);
          else this.say(r.answer ?? '', r.replyLang);
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
    this.executor.execute(cmd, r.replyLang).subscribe({
      next: (msg) => {
        this.api.updateLog(r.logId, { status: 'confirmed', resultMessage: msg }).subscribe({ error: () => undefined });
        this.executor.learn(cmd.learn);
        this.message.set(msg);
        this.savedLogId.set(r.logId);
        this.undone.set(false);
        this.stage.set('done');
        this.undoer.offer(r.logId, msg);
        // The in-panel Undo button disappears when the undo window ends.
        clearTimeout(this.undoTimer);
        this.undoTimer = setTimeout(() => this.savedLogId.set(null), this.undoer.windowSeconds() * 1000);
        this.speakSaved(cmd, msg, r.replyLang);
        this.alerts.refresh();
        this.events.changed('any');
      },
      error: (e) => {
        const msg = apiErrorMessage(e);
        this.api.updateLog(r.logId, { status: 'failed', error: msg }).subscribe({ error: () => undefined });
        this.stage.set('confirm');
        this.toast.error(msg);
        this.replies.failed(msg, r.replyLang);
      },
    });
  }

  /** "Sab save karo": every entry of a multi-action command, in one transaction (one Undo). */
  protected onConfirmAll(cmds: ConfirmedCommand[]): void {
    const r = this.result();
    if (!r || !cmds.length) return;
    this.stage.set('saving');
    this.executor.executeBatch(cmds, r.replyLang).subscribe({
      next: ({ messages, outcomes }) => {
        const msg = messages.filter(Boolean).join(' · ');
        this.api.updateLog(r.logId, { status: 'confirmed', resultMessage: msg }).subscribe({ error: () => undefined });
        this.executor.learn(cmds.flatMap((c) => c.learn ?? []));
        this.message.set(msg);
        this.savedLogId.set(r.logId);
        this.undone.set(false);
        this.stage.set('done');
        this.undoer.offer(r.logId, msg);
        clearTimeout(this.undoTimer);
        this.undoTimer = setTimeout(() => this.savedLogId.set(null), this.undoer.windowSeconds() * 1000);
        this.replies.batchSaved(outcomes, r.replyLang);
        this.alerts.refresh();
        this.events.changed('any');
      },
      error: (e) => {
        const msg = apiErrorMessage(e);
        this.api.updateLog(r.logId, { status: 'failed', error: msg }).subscribe({ error: () => undefined });
        this.stage.set('confirm');
        this.toast.error(msg);
        this.replies.failed(msg, r.replyLang);
      },
    });
  }

  /** "Theek hai, Sharma ji ka total udhaar ab 2,300 rupaye ho gaya": looks up the new total for udhaar entries. */
  private speakSaved(cmd: ConfirmedCommand, msg: string, lang: 'hi' | 'en'): void {
    if (!this.replies.enabled()) return;
    const customerEntry = cmd.intent === 'add_credit' || cmd.intent === 'receive_payment' || (cmd.intent === 'add_sale' && cmd.paymentMode === 'udhaar');
    if (!customerEntry || !cmd.customerId) {
      this.replies.saved(cmd.intent, msg, lang);
      return;
    }
    this.customers.get(cmd.customerId).subscribe({
      next: (c) => this.replies.saved(cmd.intent, msg, lang, { name: c.name, balance: c.currentBalance }),
      error: () => this.replies.saved(cmd.intent, msg, lang),
    });
  }

  /** Undo button on the "saved" screen. */
  protected undoSaved(): void {
    const logId = this.savedLogId();
    if (!logId) return;
    this.undoer.undo(logId).subscribe({
      next: (msg) => {
        this.savedLogId.set(null);
        this.undone.set(true);
        this.message.set(msg);
        this.replies.undone(this.result()?.replyLang ?? this.lang.current());
      },
      error: () => undefined,
    });
  }

  /** "galti ho gayi" / "undo karo": reverse the last saved voice entry right away. */
  private undoFromVoice(r: VoiceParseResult): void {
    const target = r.answerData?.kind === 'undo' ? r.answerData.logId : null;
    if (!target) {
      this.message.set(r.answer ?? '');
      this.stage.set('answer');
      this.say(r.answer ?? '', r.replyLang);
      return;
    }
    this.stage.set('saving');
    this.undoer.undo(target).subscribe({
      next: (msg) => {
        this.message.set(msg);
        this.undone.set(true);
        this.savedLogId.set(null);
        this.stage.set('done');
        this.replies.undone(r.replyLang);
      },
      error: (e) => {
        this.message.set(apiErrorMessage(e));
        this.stage.set('answer');
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
    if (this.stt.canListen()) this.listen();
  }

  protected close(): void {
    this.ref.close();
  }

  protected openRoute(route: string[]): void {
    this.ref.close();
    void this.router.navigate(route);
  }

  /** A scanned supplier bill: review it on the New Purchase page (nothing is saved yet). */
  protected openScannedBill(draft: BillScanDraft): void {
    this.billDrafts.set(draft);
    this.ref.close();
    void this.router.navigate(['/purchases/new'], { queryParams: { scan: 1 } });
  }

  private reset(): void {
    this.result.set(null);
    this.message.set('');
    this.stage.set('idle');
  }

  /** Speaks in the language the command was spoken in (falls back to the app language). */
  private say(text: string, lang: 'hi' | 'en' = this.lang.current()): void {
    this.replies.say(text, lang);
  }

  protected errorKey(): string | null {
    const e = this.stt.useRecorder() ? this.recorder.error() : this.speech.error();
    if (!e || e === 'aborted' || e === 'no-speech') return e === 'no-speech' ? 'voice.noSpeech' : null;
    return e === 'not-allowed' || e === 'service-not-allowed' ? 'voice.micBlocked' : 'voice.micError';
  }

  protected readonly placeholder = () => this.t.instant('voice.typePlaceholder');
}
