import { Injectable, NgZone, inject, signal } from '@angular/core';

/** Minimal typings for the (still prefixed in Chrome) Web Speech API. */
interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: { transcript: string };
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}
type RecognitionCtor = new () => SpeechRecognitionLike;

export type SpeechLang = 'hi-IN' | 'en-IN';

/** How long to wait for the first word, and for more words after a pause. */
const START_TIMEOUT_MS = 8000;
const SILENCE_MS = 1800;

/**
 * Wraps browser speech recognition + synthesis. Recognition runs on-device /
 * in the browser; only the final text is sent to our server.
 */
@Injectable({ providedIn: 'root' })
export class SpeechService {
  private readonly zone = inject(NgZone);
  private readonly ctor: RecognitionCtor | undefined =
    typeof window !== 'undefined'
      ? ((window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor }).SpeechRecognition ??
        (window as unknown as { webkitSpeechRecognition?: RecognitionCtor }).webkitSpeechRecognition)
      : undefined;
  private recognition: SpeechRecognitionLike | null = null;
  private onFinal: ((text: string) => void) | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;

  /** Stops `rec` after `ms` without new speech. */
  private armTimer(rec: SpeechRecognitionLike, ms: number): void {
    this.clearTimer();
    this.timer = setTimeout(() => {
      if (this.recognition === rec) rec.stop();
    }, ms);
  }

  private clearTimer(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  readonly supported = !!this.ctor;
  readonly canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window;
  readonly listening = signal(false);
  readonly interim = signal('');
  readonly transcript = signal('');
  readonly error = signal<string | null>(null);

  /** Starts listening; `done` gets the final transcript when the user stops speaking. */
  start(lang: SpeechLang, done: (text: string) => void): void {
    if (!this.ctor) {
      this.error.set('not-supported');
      return;
    }
    this.stop();
    this.onFinal = done;
    this.interim.set('');
    this.transcript.set('');
    this.error.set(null);

    const rec = new this.ctor();
    rec.lang = lang;
    // Non-continuous mode ends at the first short pause ("शर्मा ... जी के 500"), so keep
    // listening and stop ourselves once the speaker has been quiet for a moment.
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    this.armTimer(rec, START_TIMEOUT_MS);
    rec.onstart = () => this.zone.run(() => this.listening.set(true));
    rec.onresult = (e) =>
      this.zone.run(() => {
        let finalText = '';
        let interim = '';
        for (let i = 0; i < e.results.length; i++) {
          const r = e.results[i]!;
          if (r.isFinal) finalText += ' ' + r[0].transcript;
          else interim += ' ' + r[0].transcript;
        }
        this.transcript.set(finalText.replace(/\s+/g, ' ').trim());
        this.interim.set(interim.trim());
        this.armTimer(rec, SILENCE_MS);
      });
    rec.onerror = (e) => this.zone.run(() => this.error.set(e.error));
    rec.onend = () =>
      this.zone.run(() => {
        this.clearTimer();
        this.listening.set(false);
        const text = (this.transcript() || this.interim()).trim();
        this.interim.set('');
        if (text && this.onFinal) this.onFinal(text);
        this.onFinal = null;
      });
    this.recognition = rec;
    try {
      rec.start();
    } catch {
      this.error.set('start-failed');
    }
  }

  stop(): void {
    this.clearTimer();
    this.recognition?.stop();
  }

  cancel(): void {
    this.clearTimer();
    this.onFinal = null;
    this.recognition?.abort();
    this.listening.set(false);
    this.interim.set('');
  }

  speak(text: string, lang: SpeechLang): void {
    if (!this.canSpeak || !text) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/₹/g, lang === 'hi-IN' ? 'रुपये ' : 'rupees '));
    u.lang = lang;
    u.rate = 1;
    const voice = window.speechSynthesis.getVoices().find((v) => v.lang === lang) ?? window.speechSynthesis.getVoices().find((v) => v.lang.startsWith(lang.slice(0, 2)));
    if (voice) u.voice = voice;
    window.speechSynthesis.speak(u);
  }
}
