import { Injectable, inject, signal } from '@angular/core';
import { forkJoin, of, type Observable } from 'rxjs';
import type { Intent, VoiceBatchOutcome } from '../../core/models/domain.models';
import { SpeechService } from '../../core/services/speech.service';
import { storage } from '../../core/utils/storage';
import { VoiceExecutor } from './voice-executor.service';

type Lang = 'hi' | 'en';

/** Same key the voice panel's speaker button has always used, so both stay in sync. */
const SPEAK_KEY = 'ds.voiceSpeak';

/** Entries after which the customer's / supplier's new total is worth saying. */
const CUSTOMER_TOTAL = new Set<Intent>(['add_credit', 'receive_payment', 'add_sale']);

/** Rupees as spoken: "2,300" (the "रुपये / rupees" word is in the sentence). */
const spokenRupees = (paise: number) => (Math.round(paise) / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 });

/**
 * Short spoken replies for the voice assistant ("Theek hai, Sharma ji ka total udhaar ab
 * 2,300 rupaye ho gaya"). Speaks in the language the command was given in; Hindi lines carry
 * an English version for devices without a Hindi voice. On/off per device, default on.
 */
@Injectable({ providedIn: 'root' })
export class VoiceReplies {
  private readonly speech = inject(SpeechService);
  private readonly executor = inject(VoiceExecutor);

  readonly enabled = signal(storage.get(SPEAK_KEY) !== '0');

  setEnabled(on: boolean): void {
    this.enabled.set(on);
    storage.set(SPEAK_KEY, on ? '1' : '0');
    if (!on && this.speech.canSpeak) window.speechSynthesis.cancel();
  }

  /** Speaks text that is already in `lang` (answers to questions). */
  say(text: string, lang: Lang): void {
    if (this.enabled() && text) this.speech.speak(text, lang === 'hi' ? 'hi-IN' : 'en-IN');
  }

  /** After a single entry was saved. `balance` (paise): the customer's udhaar now, when known. */
  saved(intent: Intent, message: string, lang: Lang, who?: { name?: string; balance?: number }): void {
    if (who?.name && who.balance !== undefined && CUSTOMER_TOTAL.has(intent)) {
      this.sayKey(lang, who.balance > 0 ? 'voice.speak.balance' : 'voice.speak.balanceClear', { name: who.name, amount: spokenRupees(who.balance) });
    } else {
      this.sayKey(lang, 'voice.speak.saved', { msg: message.replace(/[.।]+$/, '') }, 'voice.speak.savedPlain');
    }
  }

  /** After a multi-action command was saved: the count, then each customer's new total. */
  batchSaved(outcomes: VoiceBatchOutcome[], lang: Lang): void {
    const lines: [string, Record<string, unknown>][] = [['voice.speak.batch', { count: outcomes.length }]];
    for (const o of outcomes) {
      if (o.balance !== undefined && CUSTOMER_TOTAL.has(o.intent) && o.name) {
        lines.push([o.balance > 0 ? 'voice.speak.balanceShort' : 'voice.speak.balanceClearShort', { name: o.name, amount: spokenRupees(o.balance) }]);
      }
    }
    this.sayLines(lang, lines);
  }

  undone(lang: Lang): void {
    this.sayKey(lang, 'voice.speak.undone');
  }

  failed(message: string, lang: Lang): void {
    this.sayKey(lang, 'voice.speak.error', { msg: message }, 'voice.speak.errorPlain');
  }

  notUnderstood(lang: Lang): void {
    this.sayKey(lang, 'voice.speak.notUnderstood');
  }

  /** `fallbackKey`: English line without `params` text that may be in Hindi. */
  private sayKey(lang: Lang, key: string, params: Record<string, unknown> = {}, fallbackKey = key): void {
    this.sayLines(lang, [[key, params]], fallbackKey === key ? undefined : [[fallbackKey, params]]);
  }

  private sayLines(lang: Lang, lines: [string, Record<string, unknown>][], fallbackLines = lines): void {
    if (!this.enabled() || !this.speech.canSpeak) return;
    const join = (l: Lang, list: [string, Record<string, unknown>][]): Observable<string[]> =>
      forkJoin(list.map(([k, p]) => this.executor.translateIn(l, k, p)));
    forkJoin([join(lang, lines), lang === 'hi' ? join('en', fallbackLines) : of(null)]).subscribe(([main, english]) => {
      this.speech.speak(main.join(' '), lang === 'hi' ? 'hi-IN' : 'en-IN', english ? { text: english.join(' '), lang: 'en-IN' } : undefined);
    });
  }
}
