import { prisma } from '@aphno/db';
import type { Balance, GroupBalances } from '@aphno/shared';
import { simplifyDebts } from '../../platform/money.js';

/**
 * Compute each member's net position in a group.
 * net > 0 → the group owes them; net < 0 → they owe the group.
 *
 *   net_i = Σ(expenses i paid) − Σ(i's split shares) + Σ(settlements i sent) − Σ(settlements i received)
 */
export async function computeGroupBalances(groupId: string): Promise<GroupBalances> {
  const [members, expenses, settlements] = await Promise.all([
    prisma.groupMember.findMany({
      where: { groupId },
      include: { user: { select: { id: true, name: true } } },
    }),
    prisma.expense.findMany({
      where: { groupId, deletedAt: null },
      select: { paidById: true, amount: true, splits: { select: { userId: true, amount: true } } },
    }),
    prisma.settlement.findMany({
      where: { groupId, status: 'COMPLETED' },
      select: { fromUserId: true, toUserId: true, amount: true },
    }),
  ]);

  const net = new Map<string, number>();
  for (const m of members) net.set(m.userId, 0);
  const bump = (userId: string, delta: number) => {
    net.set(userId, (net.get(userId) ?? 0) + delta);
  };

  for (const e of expenses) {
    bump(e.paidById, e.amount);
    for (const s of e.splits) bump(s.userId, -s.amount);
  }
  for (const s of settlements) {
    bump(s.fromUserId, s.amount); // payer settles what they owed
    bump(s.toUserId, -s.amount); // payee received what they were owed
  }

  const balances: Balance[] = members.map((m) => ({
    userId: m.userId,
    name: m.user.name,
    net: net.get(m.userId) ?? 0,
  }));

  const debts = simplifyDebts(balances);
  return { balances, debts, naiveTransferCount: countNaiveTransfers(expenses, settlements) };
}

// The number of distinct person→person IOUs before simplification: each split
// is a raw debt to the payer; net opposing pairs and count what's left. The gap
// between this and `debts.length` is what "smart settle-up" saves.
function countNaiveTransfers(
  expenses: { paidById: string; splits: { userId: string; amount: number }[] }[],
  settlements: { fromUserId: string; toUserId: string; amount: number }[],
): number {
  const owed = new Map<string, number>(); // "from|to" → amount `from` owes `to`
  const add = (from: string, to: string, amt: number) => {
    const k = `${from}|${to}`;
    owed.set(k, (owed.get(k) ?? 0) + amt);
  };
  for (const e of expenses) {
    for (const s of e.splits) if (s.userId !== e.paidById) add(s.userId, e.paidById, s.amount);
  }
  for (const st of settlements) add(st.fromUserId, st.toUserId, -st.amount);

  const seen = new Set<string>();
  let count = 0;
  for (const [k, amt] of owed) {
    const [a, b] = k.split('|');
    const rev = `${b}|${a}`;
    if (seen.has(k) || seen.has(rev)) continue;
    seen.add(k);
    seen.add(rev);
    if (Math.abs(amt - (owed.get(rev) ?? 0)) > 0) count++;
  }
  return count;
}
