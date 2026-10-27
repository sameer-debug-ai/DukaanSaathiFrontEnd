import { Injectable, signal } from '@angular/core';

/** Longest recording sent for transcription (the server also caps the upload size). */
export const MAX_RECORDING_MS = 30_000;
/** Stop after this much quiet once the speaker has started, or if nothing is said at all. */
const SILENCE_MS = 1800;
const START_TIMEOUT_MS = 8000;
/** RMS level (0-1) above which the microphone counts as speech. */
const SPEECH_LEVEL = 0.02;

/** Formats the browser can record, best first (Chrome/Android: webm, iOS Safari: mp4). */
const MIME_TYPES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];

export interface RecordOptions {
  maxMs?: number;
}

type AudioContextCtor = typeof AudioContext;

/**
 * Records one voice command with MediaRecorder, for the high-accuracy speech-to-text fallback.
 * Stops by itself at 30 seconds, after a short silence, or when `stop()` is called; resolves
 * with the audio, or null when cancelled / nothing was said.
 */
@Injectable({ providedIn: 'root' })
export class AudioRecorderService {
  readonly supported =
    typeof window !== 'undefined' && typeof MediaRecorder !== 'undefined' && typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;

  readonly recording = signal(false);
  /** Seconds recorded so far, for the on-screen counter. */
  readonly seconds = signal(0);
  /** 'not-allowed' (mic blocked), 'no-speech', 'start-failed'. */
  readonly error = signal<string | null>(null);

  private recorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private audioCtx: AudioContext | null = null;
  private timers: ReturnType<typeof setInterval>[] = [];
  private cancelled = false;
  private heardSpeech = false;
  /** False when the browser has no AudioContext (then silence cannot be detected). */
  private detecting = false;

  async start(opts: RecordOptions = {}): Promise<Blob | null> {
    this.cancel();
    this.error.set(null);
    this.seconds.set(0);
    this.cancelled = false;
    this.heardSpeech = false;
    this.detecting = false;
    if (!this.supported) {
      this.error.set('not-supported');
      return null;
    }

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch (e) {
      const name = (e as { name?: string }).name;
      this.error.set(name === 'NotAllowedError' || name === 'SecurityError' ? 'not-allowed' : 'start-failed');
      return null;
    }
    if (this.cancelled) {
      this.release();
      return null;
    }

    const mimeType = MIME_TYPES.find((t) => MediaRecorder.isTypeSupported?.(t));
    let rec: MediaRecorder;
    try {
      // Speech needs little bandwidth: 30 s at 32 kbps is about 120 KB.
      rec = new MediaRecorder(this.stream, { ...(mimeType ? { mimeType } : {}), audioBitsPerSecond: 32_000 });
    } catch {
      this.error.set('start-failed');
      this.release();
      return null;
    }
    this.recorder = rec;
    const chunks: Blob[] = [];
    const done = new Promise<Blob | null>((resolve) => {
      rec.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      rec.onstop = () => {
        this.release();
        if (this.cancelled) return resolve(null);
        // Without the silence detector we cannot tell; let the server decide.
        if (!this.detecting && chunks.length) this.heardSpeech = true;
        if (!this.heardSpeech || !chunks.length) {
          this.error.set('no-speech');
          return resolve(null);
        }
        resolve(new Blob(chunks, { type: (rec.mimeType || mimeType || 'audio/webm').split(';')[0] }));
      };
    });

    rec.start(250);
    this.recording.set(true);
    const startedAt = Date.now();
    const maxMs = Math.min(opts.maxMs ?? MAX_RECORDING_MS, MAX_RECORDING_MS);
    this.timers.push(
      setInterval(() => {
        const elapsed = Date.now() - startedAt;
        this.seconds.set(Math.min(Math.floor(elapsed / 1000), maxMs / 1000));
        if (elapsed >= maxMs) this.stop();
      }, 250),
    );
    this.watchSilence(this.stream, startedAt);
    return done;
  }

  /** Stop and send what was recorded. */
  stop(): void {
    if (this.recorder && this.recorder.state !== 'inactive') this.recorder.stop();
  }

  /** Stop and throw the recording away. */
  cancel(): void {
    this.cancelled = true;
    if (this.recorder && this.recorder.state !== 'inactive') this.recorder.stop();
    else this.release();
  }

  /** Ends the recording after a pause in speech (like the browser recogniser does). */
  private watchSilence(stream: MediaStream, startedAt: number): void {
    const Ctor = (window as unknown as { AudioContext?: AudioContextCtor; webkitAudioContext?: AudioContextCtor }).AudioContext ??
      (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext;
    if (!Ctor) return;
    try {
      const ctx = new Ctor();
      this.audioCtx = ctx;
      this.detecting = true;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      ctx.createMediaStreamSource(stream).connect(analyser);
      const buf = new Float32Array(analyser.fftSize);
      let lastSound = Date.now();
      this.timers.push(
        setInterval(() => {
          analyser.getFloatTimeDomainData(buf);
          let sum = 0;
          for (const v of buf) sum += v * v;
          const now = Date.now();
          if (Math.sqrt(sum / buf.length) > SPEECH_LEVEL) {
            this.heardSpeech = true;
            lastSound = now;
          }
          if (this.heardSpeech ? now - lastSound > SILENCE_MS : now - startedAt > START_TIMEOUT_MS) this.stop();
        }, 100),
      );
    } catch {
      this.detecting = false;
    }
  }

  private release(): void {
    for (const t of this.timers) clearInterval(t);
    this.timers = [];
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    void this.audioCtx?.close().catch(() => undefined);
    this.audioCtx = null;
    this.recorder = null;
    this.recording.set(false);
  }
}
