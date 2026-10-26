import type { EntityMatch, VoiceParseResult } from '../../core/models/domain.models';
import { toConfirmedCommand } from './voice-command';

const matched = (id: string, name: string): EntityMatch => ({ query: name, status: 'matched', best: { id, name, score: 1 }, candidates: [{ id, name, score: 1 }] });
const ambiguous = (q: string): EntityMatch => ({
  query: q,
  status: 'ambiguous',
  best: { id: 'a', name: 'Rakesh Sharma', score: 0.9 },
  candidates: [
    { id: 'a', name: 'Rakesh Sharma', score: 0.9 },
    { id: 'b', name: 'Mohan Sharma', score: 0.9 },
  ],
});

function result(partial: Partial<VoiceParseResult>): VoiceParseResult {
  return {
    logId: 'log1',
    text: 'test',
    engine: 'ai',
    replyLang: 'hi',
    intent: 'add_credit',
    confidence: 0.95,
    parsed: { customerName: 'Sharma ji', supplierName: null, productName: null, sellingPrice: null, unit: null, note: null } as VoiceParseResult['parsed'],
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

describe('toConfirmedCommand (auto-save path)', () => {
  it('uses the single matched customer and carries the log id for undo', () => {
    const c = toConfirmedCommand(result({ customer: matched('c1', 'Sharma ji') }));
    expect(c).toMatchObject({ intent: 'add_credit', customerId: 'c1', customerName: 'Sharma ji', amount: 50000, logId: 'log1', paymentMode: 'cash' });
    expect(c.newCustomerName).toBeUndefined();
  });

  it('never picks a customer from an ambiguous match', () => {
    const c = toConfirmedCommand(result({ customer: ambiguous('Sharma') }));
    expect(c.customerId).toBeUndefined();
  });

  it('a new person becomes newCustomerName (created first, then the udhaar)', () => {
    const c = toConfirmedCommand(result({ customer: { query: 'Anil Gupta', status: 'not_found', best: null, candidates: [] }, newCustomerName: 'Anil Gupta' }));
    expect(c).toMatchObject({ customerId: undefined, newCustomerName: 'Anil Gupta', customerName: 'Anil Gupta' });
  });

  it('goods on udhaar: amount is the items total, items keep product ids', () => {
    const c = toConfirmedCommand(
      result({
        amount: null,
        customer: matched('c1', 'Verma ji'),
        items: [{ spokenName: 'cheeni', qty: 2, unit: 'kg', rate: 4500, total: 9000, match: matched('p1', 'Sugar') }],
      }),
    );
    expect(c.amount).toBe(9000);
    expect(c.items).toEqual([{ productId: 'p1', name: 'Sugar', qty: 2, unit: 'kg', rate: 4500 }]);
  });
});
