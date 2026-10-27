import { TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import type { VoiceAnalyticsData } from '../../core/models/domain.models';
import { AudioRecorderService } from '../../core/services/audio-recorder.service';
import { VoiceApi } from '../../core/services/data.services';
import { SpeechService } from '../../core/services/speech.service';
import { VoiceAnswer } from './voice-answer';
import { VoiceStt } from './voice-stt.service';

describe('VoiceAnswer: analytics card', () => {
  async function mount(data: VoiceAnalyticsData) {
    TestBed.configureTestingModule({ providers: [provideTranslateService()] });
    const fixture = TestBed.createComponent(VoiceAnswer);
    fixture.componentRef.setInput('data', data);
    fixture.componentRef.setInput('message', 'answer');
    const opened: string[][] = [];
    fixture.componentInstance.open.subscribe((r) => opened.push(r));
    await fixture.whenStable();
    return { el: fixture.nativeElement as HTMLElement, opened };
  }

  it('shows the rows as a table with rupees, and opens a customer', async () => {
    const { el, opened } = await mount({
      kind: 'analytics',
      fn: 'top_debtors',
      columns: [
        { key: 'name', type: 'text' },
        { key: 'balance', type: 'money' },
      ],
      rows: [{ id: 'c1', name: 'Rakesh Sharma', balance: 230000 }],
      totals: { count: 1, balance: 230000 },
    });
    const cells = [...el.querySelectorAll('tbody td')].map((td) => td.textContent?.trim());
    expect(cells).toEqual(['Rakesh Sharma', '₹2,300']);
    expect(el.querySelectorAll('.stat')).toHaveLength(2);
    el.querySelector<HTMLElement>('tbody tr')!.click();
    expect(opened).toEqual([['/customers', 'c1']]);
  });

  it('colours a drop red in a comparison and shows both totals', async () => {
    const { el } = await mount({
      kind: 'analytics',
      fn: 'compare_sales',
      period: 'today',
      columns: [
        { key: 'name', type: 'text' },
        { key: 'current', type: 'money' },
        { key: 'previous', type: 'money' },
        { key: 'change', type: 'money' },
      ],
      rows: [{ name: 'Milk', current: 0, previous: 60000, change: -60000 }],
      totals: { current: 9000, previous: 69000, change: -60000, currentBills: 1, previousBills: 2 },
    });
    expect([...el.querySelectorAll('.stat .val')].map((v) => v.textContent?.trim())).toEqual(['₹690', '₹90']);
    const change = el.querySelectorAll('tbody td')[3]!;
    expect(change.textContent?.trim()).toBe('-₹600');
    expect(change.classList).toContain('text-danger');
  });

  it('shows the spoken answer when there is nothing to list', async () => {
    const { el } = await mount({ kind: 'analytics', fn: 'top_products', period: 'today', columns: [{ key: 'name', type: 'text' }], rows: [] });
    expect(el.querySelector('table')).toBeNull();
    expect(el.querySelector('.empty')?.textContent).toContain('answer');
  });
});

describe('VoiceStt: when to record and transcribe on the server', () => {
  function setup(opts: { browserSpeech: boolean; recorder: boolean; server: boolean }) {
    localStorage.removeItem('ds.voiceHighAccuracy');
    TestBed.configureTestingModule({
      providers: [
        { provide: SpeechService, useValue: { supported: opts.browserSpeech } },
        { provide: AudioRecorderService, useValue: { supported: opts.recorder } },
        { provide: VoiceApi, useValue: { status: () => of({ provider: 'claude', available: true, stt: { provider: 'groq', available: opts.server } }) } },
      ],
    });
    const stt = TestBed.inject(VoiceStt);
    stt.ready().subscribe();
    return stt;
  }

  it('keeps the browser recogniser by default', () => {
    const stt = setup({ browserSpeech: true, recorder: true, server: true });
    expect(stt.useRecorder()).toBe(false);
    stt.setHighAccuracy(true);
    expect(stt.useRecorder()).toBe(true);
    expect(localStorage.getItem('ds.voiceHighAccuracy')).toBe('1');
  });

  it('records automatically when the browser has no speech recognition (iOS Safari)', () => {
    const stt = setup({ browserSpeech: false, recorder: true, server: true });
    expect(stt.useRecorder()).toBe(true);
    expect(stt.canListen()).toBe(true);
  });

  it('falls back to the browser when the server has no speech-to-text', () => {
    const stt = setup({ browserSpeech: true, recorder: true, server: false });
    stt.setHighAccuracy(true);
    expect(stt.useRecorder()).toBe(false);
    expect(stt.canListen()).toBe(true);
    const none = TestBed.resetTestingModule() && setup({ browserSpeech: false, recorder: true, server: false });
    expect(none.canListen()).toBe(false);
  });
});
