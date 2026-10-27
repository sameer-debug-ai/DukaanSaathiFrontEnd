import { Injectable, inject } from '@angular/core';
import { TranslateLoader, TranslateService, type Language, type TranslationObject } from '@ngx-translate/core';
import { Observable, catchError, forkJoin, map, of, shareReplay, switchMap, throwError } from 'rxjs';
import type { Unit, VoiceBatchOutcome, VoiceParseResult } from '../../core/models/domain.models';
import { CustomersApi, ProductsApi, SalesApi, SuppliersApi, VoiceApi, type AliasLearning, type VoiceBatchAction } from '../../core/services/data.services';
import { formatPaise } from '../../shared/pipes/inr.pipe';

/** What the confirmation card hands over after the user has reviewed / edited it. */
export interface ConfirmedCommand {
  intent: VoiceParseResult['intent'];
  text: string;
  customerId?: string;
  customerName?: string;
  /** No customerId: create this customer first, then save the command against them. */
  newCustomerName?: string;
  supplierId?: string;
  supplierName?: string;
  productId?: string;
  productName?: string;
  amount: number | null;
  paidAmount: number | null;
  quantity: number | null;
  unit: Unit | null;
  sellingPrice: number | null;
  paymentMode: 'cash' | 'upi' | 'udhaar' | 'bank' | null;
  date?: string;
  items: { productId?: string; name: string; qty: number; unit: string | null; rate: number | null }[];
  /** The voice log this command came from; sent with every save so it can be undone. */
  logId?: string;
  /** Spoken names to remember for the records the user picked (see VoiceApi.learnAliases). */
  learn?: AliasLearning[];
}

/**
 * Executes a confirmed voice command through the SAME endpoints the forms use,
 * so validation, stock movements and ledgers behave identically.
 */
@Injectable({ providedIn: 'root' })
export class VoiceExecutor {
  private readonly customers = inject(CustomersApi);
  private readonly suppliers = inject(SuppliersApi);
  private readonly products = inject(ProductsApi);
  private readonly sales = inject(SalesApi);
  private readonly voice = inject(VoiceApi);
  private readonly t = inject(TranslateService);
  private readonly loader = inject(TranslateLoader);
  private readonly dictionaries = new Map<Language, Observable<TranslationObject>>();

  /**
   * Returns a short success message (also spoken aloud), in `lang`: the language the
   * command was spoken in, which can differ from the app's UI language.
   */
  execute(c: ConfirmedCommand, lang: Language = this.t.getCurrentLang()): Observable<string> {
    // A new person taking udhaar: add them to the khata, then book the udhaar against them.
    if (!c.customerId && c.newCustomerName?.trim()) {
      return this.customers
        .create({ name: c.newCustomerName.trim(), voiceLogId: c.logId })
        .pipe(switchMap((cust) => this.execute({ ...c, customerId: cust.id, customerName: cust.name, newCustomerName: undefined }, lang)));
    }
    const amount = (n: number | null) => formatPaise(n ?? 0);
    switch (c.intent) {
      case 'add_credit': {
        if (!c.customerId) return this.fail('voice.err.customer');
        const allMatched = c.items.length > 0 && c.items.every((i) => i.productId && i.rate !== null);
        if (allMatched) {
          // Goods on udhaar: a sale with paymentMode "udhaar" so stock and ledger both update.
          return this.sales
            .create({
              customerId: c.customerId,
              items: c.items.map((i) => ({ productId: i.productId!, qty: i.qty, rate: i.rate ?? undefined })),
              discount: 0,
              paymentMode: 'udhaar',
              date: c.date,
              source: 'voice',
            voiceLogId: c.logId,
            })
            .pipe(switchMap((s) => this.done(lang, 'voice.done.credit', { amount: amount(s.totalAmount), name: c.customerName })));
        }
        if (!c.amount) return this.fail('voice.err.amount');
        return this.customers
          .addCredit(c.customerId, {
            amount: c.amount,
            items: c.items.map((i) => ({ productId: i.productId, name: i.name, qty: i.qty, rate: i.rate ?? 0 })),
            note: this.t.instant('voice.noteVoice'),
            date: c.date,
            source: 'voice',
            voiceLogId: c.logId,
            rawVoiceText: c.text,
          })
          .pipe(switchMap(() => this.done(lang, 'voice.done.credit', { amount: amount(c.amount), name: c.customerName })));
      }
      case 'receive_payment':
        if (!c.customerId) return this.fail('voice.err.customer');
        if (!c.amount) return this.fail('voice.err.amount');
        return this.customers
          .addPayment(c.customerId, {
            amount: c.amount,
            mode: c.paymentMode === 'upi' || c.paymentMode === 'bank' ? c.paymentMode : 'cash',
            note: this.t.instant('voice.noteVoice'),
            date: c.date,
            source: 'voice',
            voiceLogId: c.logId,
            rawVoiceText: c.text,
          })
          .pipe(switchMap(() => this.done(lang, 'voice.done.payment', { amount: amount(c.amount), name: c.customerName })));
      case 'add_purchase': {
        if (!c.supplierId) return this.fail('voice.err.supplier');
        if (!c.items.length) return this.fail('voice.err.items');
        if (c.items.some((i) => i.rate === null)) return this.fail('voice.err.rate');
        const items = c.items.map((i) =>
          i.productId
            ? { productId: i.productId, qty: i.qty, rate: i.rate! }
            : { newProduct: { name: i.name, unit: (i.unit as Unit) ?? 'piece' }, qty: i.qty, rate: i.rate! },
        );
        const total = items.reduce((s, i) => s + Math.round(i.qty * i.rate), 0);
        return this.suppliers
          .createPurchase({ supplierId: c.supplierId, items, paidAmount: Math.min(c.paidAmount ?? 0, total), date: c.date, source: 'voice', note: this.t.instant('voice.noteVoice'), voiceLogId: c.logId })
          .pipe(switchMap((p) => this.done(lang, 'voice.done.purchase', { amount: amount(p.totalAmount), name: c.supplierName })));
      }
      case 'supplier_payment':
        if (!c.supplierId) return this.fail('voice.err.supplier');
        if (!c.amount) return this.fail('voice.err.amount');
        return this.suppliers
          .pay({ supplierId: c.supplierId, amount: c.amount, mode: c.paymentMode === 'upi' || c.paymentMode === 'bank' ? c.paymentMode : 'cash', date: c.date, source: 'voice', note: this.t.instant('voice.noteVoice'), voiceLogId: c.logId })
          .pipe(switchMap(() => this.done(lang, 'voice.done.supplierPayment', { amount: amount(c.amount), name: c.supplierName })));
      case 'add_sale': {
        if (!c.items.length || c.items.some((i) => !i.productId)) return this.fail('voice.err.products');
        const mode = c.paymentMode === 'udhaar' ? 'udhaar' : c.paymentMode === 'upi' ? 'upi' : 'cash';
        if (mode === 'udhaar' && !c.customerId) return this.fail('voice.err.customer');
        return this.sales
          .create({
            customerId: c.customerId,
            items: c.items.map((i) => ({ productId: i.productId!, qty: i.qty, rate: i.rate ?? undefined })),
            discount: 0,
            paymentMode: mode,
            date: c.date,
            source: 'voice',
            voiceLogId: c.logId,
          })
          .pipe(switchMap((s) => this.done(lang, 'voice.done.sale', { number: s.billNumber, amount: amount(s.totalAmount) })));
      }
      case 'adjust_stock':
        if (!c.productId) return this.fail('voice.err.product');
        if (!c.quantity) return this.fail('voice.err.quantity');
        return this.products
          .adjustStock({ productId: c.productId, quantity: c.quantity, type: 'adjustment', note: this.t.instant('voice.noteVoice'), voiceLogId: c.logId })
          .pipe(switchMap((p) => this.done(lang, 'voice.done.stock', { name: p.name, qty: p.currentStock, unit: p.unit })));
      case 'add_product':
        if (!c.productName) return this.fail('voice.err.productName');
        if (!c.sellingPrice) return this.fail('voice.err.price');
        return this.products
          .create({ name: c.productName, sellingPrice: c.sellingPrice, purchasePrice: 0, unit: c.unit ?? 'piece', voiceLogId: c.logId })
          .pipe(switchMap((p) => this.done(lang, 'voice.done.product', { name: p.name, amount: amount(p.sellingPrice) })));
      default:
        return of('');
    }
  }

  /** Remembers the spoken names the user confirmed. Best effort: a failure never affects the saved entry. */
  learn(items: AliasLearning[] | undefined): void {
    const useful = (items ?? []).filter((i) => i.alias.trim() && i.id);
    if (useful.length) this.voice.learnAliases(useful.slice(0, 20)).subscribe({ error: () => undefined });
  }

  /**
   * Saves every action of a multi-action command in one go (one transaction on the server,
   * one Undo for the group). Resolves to the per-action success messages, in `lang`.
   */
  executeBatch(
    cmds: ConfirmedCommand[],
    lang: Language = this.t.getCurrentLang(),
  ): Observable<{ messages: string[]; outcomes: VoiceBatchOutcome[] }> {
    const first = cmds[0];
    if (!first?.logId) return of({ messages: [], outcomes: [] });
    const actions: VoiceBatchAction[] = cmds.map((c) => ({
      intent: c.intent,
      customerId: c.customerId,
      newCustomerName: c.customerId ? undefined : c.newCustomerName?.trim() || undefined,
      supplierId: c.supplierId,
      productId: c.productId,
      productName: c.productName,
      amount: c.amount,
      paidAmount: c.paidAmount,
      quantity: c.quantity,
      unit: c.unit,
      sellingPrice: c.sellingPrice,
      paymentMode: c.paymentMode,
      date: c.date,
      items: c.items,
    }));
    return this.voice.executeBatch({ logId: first.logId, text: first.text, note: this.t.instant('voice.noteVoice'), actions }).pipe(
      switchMap((outcomes) => forkJoin(outcomes.map((o) => this.outcomeMessage(o, lang))).pipe(map((messages) => ({ messages, outcomes })))),
    );
  }

  private outcomeMessage(o: VoiceBatchOutcome, lang: Language): Observable<string> {
    const amount = formatPaise(o.amount);
    switch (o.intent) {
      case 'add_credit':
        return this.done(lang, 'voice.done.credit', { amount, name: o.name });
      case 'receive_payment':
        return this.done(lang, 'voice.done.payment', { amount, name: o.name });
      case 'add_purchase':
        return this.done(lang, 'voice.done.purchase', { amount, name: o.name });
      case 'supplier_payment':
        return this.done(lang, 'voice.done.supplierPayment', { amount, name: o.name });
      case 'add_sale':
        return this.done(lang, 'voice.done.sale', { number: o.billNumber, amount });
      case 'adjust_stock':
        return this.done(lang, 'voice.done.stock', { name: o.name, qty: o.stock, unit: o.unit });
      case 'add_product':
        return this.done(lang, 'voice.done.product', { name: o.name, amount });
      default:
        return of('');
    }
  }

  /** `key` translated in `lang` (which may differ from the app's language), e.g. for spoken replies. */
  translateIn(lang: Language, key: string, params: Record<string, unknown> = {}): Observable<string> {
    return this.done(lang, key, params);
  }

  /** Translates `key` in a given language without switching the whole app to it. */
  private done(lang: Language, key: string, params: Record<string, unknown>): Observable<string> {
    if (lang === this.t.getCurrentLang()) return of(this.t.instant(key, params) as string);
    let dict = this.dictionaries.get(lang);
    if (!dict) {
      dict = this.loader.getTranslation(lang).pipe(shareReplay(1));
      this.dictionaries.set(lang, dict);
    }
    return dict.pipe(
      map((tr) => {
        const template = key.split('.').reduce<unknown>((node, k) => (node as Record<string, unknown> | undefined)?.[k], tr);
        if (typeof template !== 'string') return this.t.instant(key, params) as string;
        return template.replace(/{{\s*(\w+)\s*}}/g, (_, name: string) => String(params[name] ?? ''));
      }),
      catchError(() => of(this.t.instant(key, params) as string)),
    );
  }

  private fail(key: string): Observable<never> {
    return throwError(() => ({ error: { message: this.t.instant(key) } }));
  }
}
