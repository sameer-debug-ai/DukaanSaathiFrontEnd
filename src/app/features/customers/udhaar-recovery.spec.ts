import { TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { MatDialog } from '@angular/material/dialog';
import type { EntityMatch, VoiceParseResult } from '../../core/models/domain.models';
import { shopUpiLink, upiLink } from '../../core/utils/upi';
import { CreditBadgeComponent } from '../../shared/components/credit-badge/credit-badge';
import { VoiceConfirm } from '../voice/voice-confirm';
import { reminderMessage } from './reminder';

describe('UPI links', () => {
  it('matches the server format (plain P2P, no note)', () => {
    expect(upiLink({ vpa: 'sharmastore@okaxis', name: 'Sharma Store', amount: 123450, note: 'Udhaar Rakesh' })).toBe(
      'upi://pay?pa=sharmastore@okaxis&pn=Sharma%20Store&am=1234.50&cu=INR',
    );
    expect(shopUpiLink({ lowStockDefault: 5, allowOversell: false, darkMode: false, upiId: '' }, 'Shop', 100, '')).toBeNull();
  });
});

describe('reminderMessage', () => {
  const base = { customerName: 'Rakesh', amount: 230000, shopName: 'Sharma Store', shopPhone: '9876543210', lang: 'hi' as const };
  it('is unchanged without a UPI link', () => {
    expect(reminderMessage(base)).toBe(
      'नमस्ते Rakesh जी,\nSharma Store की ओर से विनम्र निवेदन है कि आपके खाते में ₹2,300 बाकी हैं।\nसुविधा अनुसार भुगतान (नकद या UPI) कर दें। धन्यवाद! 🙏\n- Sharma Store, 9876543210',
    );
  });
  it('adds the UPI link before the signature', () => {
    const msg = reminderMessage({ ...base, upiLink: 'upi://pay?pa=a@b&pn=S&am=2300.00&cu=INR' });
    expect(msg).toContain('\nUPI से भुगतान करें: upi://pay?pa=a@b&pn=S&am=2300.00&cu=INR\n- Sharma Store');
    expect(reminderMessage({ ...base, lang: 'en', upiLink: 'upi://x' })).toContain('\nPay by UPI: upi://x');
  });
});

describe('CreditBadgeComponent', () => {
  it.each([
    ['good', 'ok'],
    ['average', 'warn'],
    ['risky', 'danger'],
    ['new', 'muted'],
  ] as const)('%s -> %s', async (badge, cls) => {
    TestBed.configureTestingModule({ providers: [provideTranslateService()] });
    const f = TestBed.createComponent(CreditBadgeComponent);
    f.componentRef.setInput('credit', { score: badge === 'new' ? null : 50, badge, recoveredPct: 50, avgDaysToPay: null, oldestDueDays: null });
    f.componentRef.setInput('showScore', true);
    await f.whenStable();
    const el = (f.nativeElement as HTMLElement).querySelector('.ds-badge')!;
    expect(el.classList).toContain(cls);
    expect(el.textContent).toContain(`credit.badge.${badge}`);
    expect(el.textContent?.includes('· 50')).toBe(badge !== 'new');
  });
});

describe('VoiceConfirm: credit warning', () => {
  const match = (status: EntityMatch['status'], ...names: [string, string][]): EntityMatch => ({
    query: names[0]?.[1] ?? 'x',
    status,
    best: names[0] ? { id: names[0][0], name: names[0][1], score: 0.9 } : null,
    candidates: names.map(([id, name]) => ({ id, name, score: 0.9 })),
  });
  const result = (partial: Partial<VoiceParseResult>): VoiceParseResult => ({
    logId: 'l1',
    text: 'Sharma ji ke 500 likho',
    engine: 'ai',
    replyLang: 'hi',
    intent: 'add_credit',
    confidence: 0.9,
    parsed: { customerName: 'Sharma ji', supplierName: null, productName: null, sellingPrice: null, unit: null, note: null },
    items: [],
    amount: 50000,
    paidAmount: null,
    quantity: null,
    paymentMode: null,
    date: null,
    settleFull: false,
    needsConfirmation: true,
    missing: [],
    ...partial,
  });

  async function mount(r: VoiceParseResult) {
    TestBed.configureTestingModule({ providers: [provideTranslateService(), { provide: MatDialog, useValue: {} }] });
    const f = TestBed.createComponent(VoiceConfirm);
    f.componentRef.setInput('result', r);
    await f.whenStable();
    return f.nativeElement as HTMLElement;
  }

  const warning = { customerId: 'c1', overLimit: true, limit: 100000, balance: 90000, newBalance: 140000, badge: 'average' as const, score: 55 };

  it('shows the warning for the customer it was computed for', async () => {
    const el = await mount(result({ customer: match('matched', ['c1', 'Rakesh Sharma']), creditWarning: warning }));
    expect(el.querySelector('.credit-warn')?.textContent).toContain('credit.overLimit');
  });

  it('hides it when another customer is on the card', async () => {
    const el = await mount(result({ customer: match('matched', ['c2', 'Mohan Sharma']), creditWarning: warning }));
    expect(el.querySelector('.credit-warn')).toBeNull();
  });

  it('shows the risky line', async () => {
    const el = await mount(result({ customer: match('matched', ['c1', 'Rakesh Sharma']), creditWarning: { ...warning, overLimit: false, limit: null, badge: 'risky' } }));
    expect(el.querySelector('.credit-warn')?.textContent).toContain('credit.riskyWarning');
    expect(el.querySelector('.credit-warn')?.textContent).not.toContain('credit.overLimit');
  });
});
