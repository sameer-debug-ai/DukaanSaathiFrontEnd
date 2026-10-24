import { TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import type { EntityMatch, VoiceParseResult } from '../../core/models/domain.models';
import type { ConfirmedCommand } from './voice-executor.service';
import { VoiceConfirm } from './voice-confirm';

const match = (status: EntityMatch['status'], ...names: [string, string][]): EntityMatch => ({
  query: names[0]?.[1] ?? 'x',
  status,
  best: names[0] ? { id: names[0][0], name: names[0][1], score: 0.9 } : null,
  candidates: names.map(([id, name]) => ({ id, name, score: 0.9 })),
});

function result(partial: Partial<VoiceParseResult>): VoiceParseResult {
  return {
    logId: 'log1',
    text: 'test',
    engine: 'rules',
    intent: 'add_credit',
    confidence: 0.9,
    parsed: { customerName: 'Sharma ji', supplierName: null, productName: null, sellingPrice: null, unit: null, note: null },
    items: [],
    amount: 50000,
    paidAmount: null,
    quantity: null,
    paymentMode: null,
    date: null,
    needsConfirmation: true,
    missing: [],
    ...partial,
  };
}

async function mount(r: VoiceParseResult) {
  TestBed.configureTestingModule({ providers: [provideTranslateService()] });
  const fixture = TestBed.createComponent(VoiceConfirm);
  fixture.componentRef.setInput('result', r);
  const emitted: ConfirmedCommand[] = [];
  fixture.componentInstance.confirmed.subscribe((c) => emitted.push(c));
  await fixture.whenStable();
  const yes = () => (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('button.yes')!;
  return { fixture, emitted, yes };
}

describe('VoiceConfirm', () => {
  it('confirms a matched udhaar command with the customer and amount', async () => {
    const { fixture, emitted, yes } = await mount(result({ customer: match('matched', ['c1', 'Rakesh Sharma']) }));
    expect(yes().disabled).toBe(false);
    yes().click();
    await fixture.whenStable();
    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toMatchObject({ intent: 'add_credit', customerId: 'c1', amount: 50000 });
  });

  it('does not auto-pick when two customers match; the user chooses', async () => {
    const { fixture, emitted, yes } = await mount(
      result({ customer: match('ambiguous', ['c1', 'Rakesh Sharma'], ['c2', 'Mohan Sharma']) }),
    );
    // Opens in edit mode with a problem, so "Yes" is disabled.
    expect(yes().disabled).toBe(true);
    const cands = (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('button.cand');
    expect(cands).toHaveLength(2);
    cands[1]!.click();
    await fixture.whenStable();
    expect(yes().disabled).toBe(false);
    yes().click();
    expect(emitted[0]?.customerId).toBe('c2');
  });

  it('books goods on udhaar from matched items (amount = items total)', async () => {
    const { fixture, emitted, yes } = await mount(
      result({
        amount: null,
        customer: match('matched', ['c1', 'Anil Gupta']),
        items: [
          { spokenName: 'cheeni', qty: 2, unit: 'kg', rate: 4500, total: 9000, match: match('matched', ['p1', 'Sugar']) },
          { spokenName: 'tel', qty: 1, unit: 'litre', rate: 17000, total: 17000, match: match('matched', ['p2', 'Mustard Oil']) },
        ],
      }),
    );
    yes().click();
    await fixture.whenStable();
    expect(emitted[0]).toMatchObject({ amount: 26000, customerId: 'c1' });
    expect(emitted[0]?.items.map((i) => i.productId)).toEqual(['p1', 'p2']);
  });

  it('emits cancel without saving', async () => {
    const { fixture, emitted } = await mount(result({ customer: match('matched', ['c1', 'Rakesh Sharma']) }));
    let cancelled = false;
    fixture.componentInstance.cancelled.subscribe(() => (cancelled = true));
    const buttons = (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('.actions button');
    buttons[2]!.click();
    expect(cancelled).toBe(true);
    expect(emitted).toHaveLength(0);
  });
});
