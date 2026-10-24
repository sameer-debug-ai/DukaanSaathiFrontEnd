import { DOCUMENT } from '@angular/common';
import { Injectable, inject, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import type { Language } from '../models/api.models';
import { storage } from '../utils/storage';

/** v2: older builds defaulted to Hindi and saved it; a new key resets everyone to English. */
const KEY = 'ds.lang.v2';

@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly translate = inject(TranslateService);
  private readonly doc = inject(DOCUMENT);
  readonly current = signal<Language>('en');

  /** Loads the saved language (default English) before first render. */
  async init(): Promise<void> {
    const saved = storage.get(KEY);
    await this.use(saved === 'hi' ? 'hi' : 'en');
  }

  async use(lang: Language): Promise<void> {
    this.current.set(lang);
    this.doc.documentElement.lang = lang;
    storage.set(KEY, lang);
    await firstValueFrom(this.translate.use(lang));
  }

  toggle(): Promise<void> {
    return this.use(this.current() === 'hi' ? 'en' : 'hi');
  }

  /** Locale for SpeechRecognition / SpeechSynthesis. */
  speechLocale(): 'hi-IN' | 'en-IN' {
    return this.current() === 'hi' ? 'hi-IN' : 'en-IN';
  }
}
