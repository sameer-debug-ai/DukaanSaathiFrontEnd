import { DOCUMENT } from '@angular/common';
import { Injectable, effect, inject, signal } from '@angular/core';
import { storage } from '../utils/storage';

const KEY = 'ds.theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly doc = inject(DOCUMENT);
  readonly dark = signal<boolean>(this.initial());

  constructor() {
    effect(() => {
      const dark = this.dark();
      this.doc.documentElement.classList.toggle('dark', dark);
      this.doc.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#111418' : '#1e5fa8');
      storage.set(KEY, dark ? 'dark' : 'light');
    });
  }

  toggle(): void {
    this.dark.update((d) => !d);
  }

  private initial(): boolean {
    const saved = storage.get(KEY);
    if (saved) return saved === 'dark';
    return typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches;
  }
}
