import { TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import type { EntityMatch, VoiceParseResult } from '../../core/models/domain.models';
import { commandProblems, toConfirmedCommand } from './voice-command';
import type { ConfirmedCommand } from './voice-executor.service';
import { VoiceMultiConfirm } from './voice-multi-confirm';

const match = (status: EntityMatch['status'], ...names: [string, string][]): EntityMatch => ({
  query: names[0]?.[1] ?? 'x',
  status,
  best: names[0] ? { id: names[0][0], name: names[0][1], score: 0.9 } : null,
  candidates: names.map(([id, name]) => ({ id, name, score: 0.9 })),
});

function action(partial: Partial<VoiceParseResult>): VoiceParseResult {
  return {
    logId: 'log1',
    text: 'Sharma ji ke 500 likho aur Gupta ji ne 200 de diye',
    engine: 'rules',
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
  };
}

const sharma = action({ customer: match('matched', ['c1', 'Rakesh Sharma']) });
const gupta = action({
  intent: 'receive_payment',
  amount: 20000,
  parsed: { customerName: 'Gupta ji', supplierName: null, productName: null, sellingPrice: null, unit: null, note: null },
  customer: match('matched', ['c2', 'Anil Gupta']),
});

async function mount(actions: VoiceParseResult[]) {
  TestBed.configureTestingModule({ providers: [provideTranslateService()] });
  const fixture = TestBed.createComponent(VoiceMultiConfirm);
  fixture.componentRef.setInput('result', { ...actions[0]!, actions });
  const emitted: ConfirmedCommand[][] = [];
  let cancelled = false;
  fixture.componentInstance.confirmed.subscribe((c) => emitted.push(c));
  fixture.componentInstance.cancelled.subscribe(() => (cancelled = true));
  await fixture.whenStable();
  const el = fixture.nativeElement as HTMLElement;
  const saveAll = () => el.querySelector<HTMLButtonElement>('button.yes')!;
  const rows = () => el.querySelectorAll<HTMLElement>('li.row');
  return { fixture, el, emitted, saveAll, rows, cancelled: () => cancelled };
}

describe('VoiceMultiConfirm', () => {
  it('lists every action and "Save all" emits them together', async () => {
    const { emitted, saveAll, rows } = await mount([sharma, gupta]);
    expect(rows()).toHaveLength(2);
    expect(saveAll().disabled).toBe(false);
    saveAll().click();
    expect(emitted).toHaveLength(1);
    expect(emitted[0]!.map((c) => [c.intent, c.customerId, c.amount, c.logId])).toEqual([
      ['add_credit', 'c1', 50000, 'log1'],
      ['receive_payment', 'c2', 20000, 'log1'],
    ]);
  });

  it('removing a row leaves it out of the save', async () => {
    const { fixture, emitted, saveAll, rows } = await mount([sharma, gupta]);
    rows()[0]!.querySelectorAll<HTMLButtonElement>('.row-actions button')[1]!.click();
    await fixture.whenStable();
    expect(rows()).toHaveLength(1);
    saveAll().click();
    expect(emitted[0]!.map((c) => c.customerId)).toEqual(['c2']);
  });

  it('removing the last row cancels', async () => {
    const { fixture, rows, cancelled } = await mount([sharma]);
    rows()[0]!.querySelectorAll<HTMLButtonElement>('.row-actions button')[1]!.click();
    await fixture.whenStable();
    expect(cancelled()).toBe(true);
  });

  it('blocks "Save all" until an unclear entry is fixed, and Edit fixes it', async () => {
    const unclear = action({
      intent: 'receive_payment',
      amount: 20000,
      customer: match('ambiguous', ['c1', 'Rakesh Sharma'], ['c3', 'Mohan Sharma']),
    });
    const { fixture, el, emitted, saveAll, rows } = await mount([gupta, unclear]);
    expect(saveAll().disabled).toBe(true);
    expect(rows()[1]!.classList).toContain('has-problem');

    // Edit opens the normal confirmation card for that row only.
    rows()[1]!.querySelectorAll<HTMLButtonElement>('.row-actions button')[0]!.click();
    await fixture.whenStable();
    const cands = el.querySelectorAll<HTMLButtonElement>('app-voice-confirm button.cand');
    expect(cands).toHaveLength(2);
    cands[1]!.click();
    await fixture.whenStable();
    el.querySelector<HTMLButtonElement>('app-voice-confirm button.yes')!.click();
    await fixture.whenStable();

    // Back on the list, now saveable, with the picked customer.
    expect(rows()).toHaveLength(2);
    expect(saveAll().disabled).toBe(false);
    saveAll().click();
    expect(emitted[0]!.map((c) => c.customerId)).toEqual(['c2', 'c3']);
  });
});

describe('commandProblems', () => {
  it('matches the confirmation card rules', () => {
    expect(commandProblems(toConfirmedCommand(sharma))).toEqual([]);
    expect(commandProblems(toConfirmedCommand(action({ customer: match('ambiguous', ['c1', 'A'], ['c2', 'B']) })))).toEqual(['voice.err.customer']);
    expect(commandProblems(toConfirmedCommand(action({ customer: match('matched', ['c1', 'A']), amount: null })))).toEqual(['voice.err.amount']);
    // Someone new taking udhaar is fine: they are added on save.
    expect(commandProblems(toConfirmedCommand(action({ customer: match('not_found'), newCustomerName: 'Pappu Yadav' })))).toEqual([]);
  });
});
