import type { Balance, Debt, SplitInput } from '@aphno/shared';

// Format integer paise as ₹ string, for logs / notes.
export function formatRupees(paise: number): string {
  return `₹${(paise / 100).toFixed(2)}`;
}

// ── Split allocation ─────────────────────────────────────────────────────────
// All functions return an exact allocation of `total` paise across users so the
// shares always sum to the total (no lost/created paise from rounding).

/** Split `total` paise equally across userIds, distributing the remainder. */
export function splitEqual(total: number, userIds: string[]): Map<string, number> {
  const n = userIds.length;
  if (n === 0) throw new Error('cannot split between zero participants');
  const base = Math.floor(total / n);
  let remainder = total - base * n;
  const out = new Map<string, number>();
  for (const id of userIds) {
    // Hand out the leftover paise one at a time to the first `remainder` users.
    out.set(id, base + (remainder > 0 ? 1 : 0));
    if (remainder > 0) remainder--;
  }
  return out;
}

/** EXACT: split values are already paise; they must sum to the total. */
export function splitExact(total: number, splits: SplitInput[]): Map<string, number> {
  const out = new Map<string, number>();
  let sum = 0;
  for (const s of splits) {
    const v = Math.round(s.value);
    out.set(s.userId, v);
    sum += v;
  }
  if (sum !== total) {
    throw new Error(`exact splits sum to ${sum} paise but expense total is ${total} paise`);
  }
  return out;
}

/** PERCENT: split values are percentages (must sum to 100); allocate exactly. */
export function splitPercent(total: number, splits: SplitInput[]): Map<string, number> {
  const pctSum = splits.reduce((a, s) => a + s.value, 0);
  if (Math.abs(pctSum - 100) > 0.001) {
    throw new Error(`percent splits sum to ${pctSum}% (must be 100%)`);
  }
  const out = new Map<string, number>();
  let allocated = 0;
  splits.forEach((s, i) => {
    if (i === splits.length - 1) {
      // Last participant absorbs the rounding remainder.
      out.set(s.userId, total - allocated);
    } else {
      const share = Math.round((total * s.value) / 100);
      out.set(s.userId, share);
      allocated += share;
    }
  });
  return out;
}

// ── Debt simplification ──────────────────────────────────────────────────────

/**
 * Greedy min-cash-flow: given net balances (positive = is owed), produce a set
 * of transfers that settle everyone with a near-minimal number of payments.
 */
export function simplifyDebts(balances: Balance[]): Debt[] {
  const debtors: { userId: string; amount: number }[] = [];
  const creditors: { userId: string; amount: number }[] = [];
  for (const b of balances) {
    if (b.net < 0) debtors.push({ userId: b.userId, amount: -b.net });
    else if (b.net > 0) creditors.push({ userId: b.userId, amount: b.net });
  }
  // Largest amounts first for fewer, cleaner transfers.
  debtors.sort((a, b) => b.amount - a.amount);
  creditors.sort((a, b) => b.amount - a.amount);

  const debts: Debt[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i]!;
    const creditor = creditors[j]!;
    const pay = Math.min(debtor.amount, creditor.amount);
    if (pay > 0) {
      debts.push({ fromUserId: debtor.userId, toUserId: creditor.userId, amount: pay });
    }
    debtor.amount -= pay;
    creditor.amount -= pay;
    if (debtor.amount === 0) i++;
    if (creditor.amount === 0) j++;
  }
  return debts;
}
