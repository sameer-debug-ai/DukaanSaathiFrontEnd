import { ChangeDetectionStrategy, Component, computed, inject, input, OnInit, output, signal } from '@angular/core';
import { MatButton, MatIconButton } from '@angular/material/button';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import type { VoiceParseResult } from '../../core/models/domain.models';
import { formatPaise } from '../../shared/pipes/inr.pipe';
import { commandProblems, toConfirmedCommand } from './voice-command';
import { VoiceConfirm } from './voice-confirm';
import type { ConfirmedCommand } from './voice-executor.service';

interface Row {
  key: number;
  /** The action as parsed (what the edit card starts from). */
  result: VoiceParseResult;
  /** What will be saved: as parsed, or as last edited. */
  cmd: ConfirmedCommand;
}

/**
 * Review card for a sentence with several entries ("Sharma ji ke 500 likho aur Gupta ji ne
 * 200 de diye"): one row per entry with Edit / Remove, and one "Save all". Editing a row opens
 * the normal confirmation card for just that entry.
 */
@Component({
  selector: 'app-voice-multi-confirm',
  imports: [MatButton, MatIconButton, TranslatePipe, VoiceConfirm],
  templateUrl: './voice-multi-confirm.html',
  styleUrl: './voice-multi-confirm.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VoiceMultiConfirm implements OnInit {
  readonly result = input.required<VoiceParseResult>();
  readonly busy = input(false);
  readonly confirmed = output<ConfirmedCommand[]>();
  readonly cancelled = output<void>();

  private readonly t = inject(TranslateService);

  protected readonly rows = signal<Row[]>([]);
  /** Row being edited in the full card, if any. */
  protected readonly editingKey = signal<number | null>(null);
  protected readonly editingRow = computed(() => this.rows().find((r) => r.key === this.editingKey()) ?? null);
  protected readonly problemsByKey = computed(() => new Map(this.rows().map((r) => [r.key, commandProblems(r.cmd)])));
  protected readonly canSave = computed(() => this.rows().length > 0 && [...this.problemsByKey().values()].every((p) => !p.length));

  ngOnInit(): void {
    let key = 0;
    this.rows.set((this.result().actions ?? [this.result()]).map((a) => ({ key: ++key, result: a, cmd: toConfirmedCommand(a) })));
  }

  protected edit(row: Row): void {
    this.editingKey.set(row.key);
  }

  /** "Yes" in the edit card keeps the changes for that row; nothing is saved yet. */
  protected applyEdit(cmd: ConfirmedCommand): void {
    const key = this.editingKey();
    this.rows.update((list) => list.map((r) => (r.key === key ? { ...r, cmd } : r)));
    this.editingKey.set(null);
  }

  protected remove(row: Row): void {
    this.rows.update((list) => list.filter((r) => r.key !== row.key));
    if (!this.rows().length) this.cancelled.emit();
  }

  protected saveAll(): void {
    if (!this.canSave()) return;
    this.confirmed.emit(this.rows().map((r) => r.cmd));
  }

  /** One-line description of a row, reusing the confirmation card's wording. */
  protected summary(row: Row): string {
    const c = row.cmd;
    const r = row.result;
    const params = {
      amount: formatPaise(c.amount ?? 0),
      name: c.customerName ?? c.newCustomerName ?? r.parsed.customerName ?? '?',
      supplier: c.supplierName ?? r.parsed.supplierName ?? '?',
      product: c.productName ?? r.parsed.productName ?? '?',
      qty: Math.abs(c.quantity ?? 0),
      unit: c.unit ?? '',
      paid: formatPaise(c.paidAmount ?? 0),
      items: c.items.map((i) => `${i.qty} ${i.unit ?? ''} ${i.name}`.replace(/\s+/g, ' ')).join(', '),
      newName: c.productName ?? '',
      price: formatPaise(c.sellingPrice ?? 0),
      mode: this.t.instant(`pay.${c.paymentMode ?? 'cash'}`),
    };
    const i = c.intent;
    const key =
      i === 'add_credit' && c.items.length
        ? 'voice.ask.creditItems'
        : i === 'adjust_stock' && (c.quantity ?? 0) < 0
          ? 'voice.ask.stockDown'
          : r.settleFull && (i === 'receive_payment' || i === 'supplier_payment')
            ? `voice.ask.${i}_full`
            : `voice.ask.${i}`;
    return this.t.instant(key, params) as string;
  }
}
