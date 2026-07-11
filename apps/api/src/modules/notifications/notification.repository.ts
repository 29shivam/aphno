import { prisma, type Prisma } from '@aphno/db';

export type NotificationRow = Prisma.NotificationGetPayload<object>;

// Data-access layer for notifications — the only place that talks to Prisma for
// this domain. Services depend on this, not on the client directly.
export const notificationRepository = {
  // Insert a batch and return the created rows (needed to broadcast them).
  createMany(inputs: Prisma.NotificationUncheckedCreateInput[]): Promise<NotificationRow[]> {
    return prisma.$transaction(inputs.map((data) => prisma.notification.create({ data })));
  },

  listByUser(userId: string, limit: number): Promise<NotificationRow[]> {
    return prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  },

  countUnread(userId: string): Promise<number> {
    return prisma.notification.count({ where: { userId, readAt: null } });
  },

  // Mark the user's unread notifications read; scoped to `ids` when provided.
  async markRead(userId: string, ids?: string[]): Promise<number> {
    const res = await prisma.notification.updateMany({
      where: { userId, readAt: null, ...(ids && ids.length ? { id: { in: ids } } : {}) },
      data: { readAt: new Date() },
    });
    return res.count;
  },
};
