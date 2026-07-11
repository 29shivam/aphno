import { prisma } from '@aphno/db';

const friendUser = { select: { id: true, name: true, phone: true, upiId: true } };

// Data-access for 1-on-1 friendships, which are DIRECT (2-person) groups.
export const friendRepository = {
  // An existing DIRECT group containing exactly these two users, if any.
  findDirectGroupBetween(a: string, b: string) {
    return prisma.group.findFirst({
      where: {
        kind: 'DIRECT',
        AND: [{ members: { some: { userId: a } } }, { members: { some: { userId: b } } }],
      },
      select: { id: true },
    });
  },

  createDirectGroup(creatorId: string, friendId: string, name: string) {
    return prisma.group.create({
      data: {
        name,
        kind: 'DIRECT',
        createdById: creatorId,
        members: {
          create: [
            { userId: creatorId, role: 'OWNER' },
            { userId: friendId, role: 'MEMBER' },
          ],
        },
      },
      select: { id: true },
    });
  },

  // The viewer's DIRECT groups, each with both members' user rows.
  myDirectGroups(userId: string) {
    return prisma.group.findMany({
      where: { kind: 'DIRECT', members: { some: { userId } } },
      include: { members: { include: { user: friendUser } } },
      orderBy: { createdAt: 'desc' },
    });
  },
};
