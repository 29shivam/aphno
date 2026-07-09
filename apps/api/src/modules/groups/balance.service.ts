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

  return { balances, debts: simplifyDebts(balances) };
}
