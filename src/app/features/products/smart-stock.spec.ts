import { TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { scanFeedback } from '../../core/utils/scan-feedback';
import { RunOutLabel, runOutView } from '../../shared/components/run-out/run-out';
import { orderMessage } from './order-message';

describe('runOutView', () => {
  it('colours by days left', () => {
    expect(runOutView(2)).toEqual({ key: 'smart.runOutIn', days: 2, tone: 'danger' });
    expect(runOutView(3)?.tone).toBe('danger');
    expect(runOutView(7)?.tone).toBe('warn');
    expect(runOutView(12)?.tone).toBe('muted');
  });
  it('says "today" at 0 and nothing when not selling', () => {
    expect(runOutView(0)?.key).toBe('smart.runOutToday');
    expect(runOutView(null)).toBeNull();
    expect(runOutView(undefined)).toBeNull();
  });
});

describe('RunOutLabel', () => {
  async function render(forecast: { dailyRate: number; daysLeft: number | null }, stock: number) {
    TestBed.configureTestingModule({ providers: [provideTranslateService()] });
    const f = TestBed.createComponent(RunOutLabel);
    f.componentRef.setInput('forecast', forecast);
    f.componentRef.setInput('stock', stock);
    await f.whenStable();
    return f.nativeElement as HTMLElement;
  }
  it('shows the label for a selling item', async () => {
    const el = await render({ dailyRate: 2, daysLeft: 2 }, 5);
    expect(el.querySelector('.ro.danger')?.textContent).toContain('smart.runOutIn');
  });
  it('is hidden for out-of-stock items (they already show a badge)', async () => {
    const el = await render({ dailyRate: 2, daysLeft: 0 }, 0);
    expect(el.querySelector('.ro')).toBeNull();
  });
});

describe('orderMessage', () => {
  const items = [
    { name: 'Sugar', nameHindi: 'चीनी', qty: 50, unit: 'kg' },
    { name: 'Parle-G', nameHindi: '', qty: 48, unit: 'packet' },
    { name: 'Tea', qty: 0, unit: 'packet' },
  ];
  it('writes a Hindi order with units in Hindi and skips zero lines', () => {
    expect(orderMessage({ supplierName: 'Ramesh Traders', shopName: 'Sharma Store', shopPhone: '9876543210', items, lang: 'hi' })).toBe(
      'नमस्ते Ramesh Traders जी,\nSharma Store के लिए कृपया ये सामान भेज दीजिए:\n\n1. Sugar (चीनी) – 50 किलो\n2. Parle-G – 48 पैकेट\n\nधन्यवाद 🙏\n- Sharma Store, 9876543210',
    );
  });
  it('English version without supplier name', () => {
    const m = orderMessage({ shopName: 'Sharma Store', items: [{ name: 'Rice', qty: 2.5, unit: 'kg' }], lang: 'en' });
    expect(m).toBe('Hello,\nPlease send these items for Sharma Store:\n\n1. Rice – 2.5 kg\n\nThank you 🙏\n- Sharma Store');
  });
});

describe('scanFeedback', () => {
  it('vibrates and plays a short beep', () => {
    const vibrate = vi.fn();
    const osc = { type: '', frequency: { value: 0 }, connect: vi.fn(), start: vi.fn(), stop: vi.fn(), onended: null as null | (() => void) };
    const gain = { gain: { value: 0 }, connect: vi.fn() };
    const ctx = { currentTime: 1, destination: {}, createOscillator: () => osc, createGain: () => gain, close: vi.fn() };
    const win = { navigator: { vibrate }, AudioContext: vi.fn(function () { return ctx; }) } as unknown as Window & typeof globalThis;
    scanFeedback(win);
    expect(vibrate).toHaveBeenCalledWith(80);
    expect(osc.start).toHaveBeenCalled();
    expect(osc.stop).toHaveBeenCalledWith(1.12);
  });
  it('never throws when audio and vibration are missing', () => {
    expect(() => scanFeedback({ navigator: {} } as unknown as Window & typeof globalThis)).not.toThrow();
  });
});
