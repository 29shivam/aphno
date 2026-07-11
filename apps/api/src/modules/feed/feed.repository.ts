import { prisma } from '@aphno/db';

const actor = { select: { id: true, name: true, phone: true } };

// Data-access layer for the global feed.
export const feedRepository = {
  async userGroupIds(userId: string): Promise<string[]> {
    const rows = await prisma.groupMember.findMany({
      where: { userId },
      select: { groupId: true },
    });
    return rows.map((r) => r.groupId);
  },

  recentExpenses(groupIds: string[], limit: number) {
    return prisma.expense.findMany({
      where: { groupId: { in: groupIds }, deletedAt: null },
      include: {
        group: { select: { name: true } },
        paidBy: actor,
        splits: { select: { userId: true, amount: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  },

  recentSettlements(groupIds: string[], limit: number) {
    return prisma.settlement.findMany({
      where: { groupId: { in: groupIds } },
      include: {
        group: { select: { name: true } },
        fromUser: actor,
        toUser: actor,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  },
};
