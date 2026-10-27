import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, catchError, map, of, shareReplay } from 'rxjs';
import { AudioRecorderService } from '../../core/services/audio-recorder.service';
import { VoiceApi } from '../../core/services/data.services';
import { SpeechService } from '../../core/services/speech.service';
import { storage } from '../../core/utils/storage';

const HIGH_ACCURACY_KEY = 'ds.voiceHighAccuracy';

/**
 * Chooses how speech becomes text. The browser's Web Speech API stays the default; the
 * server's speech-to-text (record -> upload -> text) is used when the browser has no speech
 * recognition (iOS Safari) or the user turned on "High accuracy mode" on this device, and only
 * if the server has it set up.
 */
@Injectable({ providedIn: 'root' })
export class VoiceStt {
  private readonly api = inject(VoiceApi);
  private readonly speech = inject(SpeechService);
  readonly recorder = inject(AudioRecorderService);

  /** Per device, like spoken replies: off by default. */
  readonly highAccuracy = signal(storage.get(HIGH_ACCURACY_KEY) === '1');
  /** Server has STT_PROVIDER configured (null until known). */
  readonly serverAvailable = signal<boolean | null>(null);

  /** Record and send to the server instead of the browser recogniser. */
  readonly useRecorder = computed(() => this.recorder.supported && this.serverAvailable() === true && (this.highAccuracy() || !this.speech.supported));
  /** Any way to speak a command on this device. */
  readonly canListen = computed(() => this.speech.supported || this.useRecorder());

  private status$: Observable<boolean> | null = null;

  setHighAccuracy(on: boolean): void {
    this.highAccuracy.set(on);
    storage.set(HIGH_ACCURACY_KEY, on ? '1' : '0');
  }

  /** Loads (once) whether the server can transcribe. */
  ready(): Observable<boolean> {
    this.status$ ??= this.api.status().pipe(
      map((s) => !!s.stt?.available),
      catchError(() => {
        this.status$ = null; // try again next time
        return of(false);
      }),
      shareReplay(1),
    );
    const s = this.status$;
    s.subscribe((v) => this.serverAvailable.set(v));
    return s;
  }
}
