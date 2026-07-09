import { prisma, type Prisma } from '@aphno/db';

// Thrown when the caller isn't a member of the group they're acting on.
export class NotGroupMemberError extends Error {
  statusCode = 403;
  code = 'NOT_GROUP_MEMBER';
  constructor() {
    super('you are not a member of this group');
  }
}

export class GroupNotFoundError extends Error {
  statusCode = 404;
  code = 'GROUP_NOT_FOUND';
  constructor() {
    super('group not found');
  }
}

/** Ensure `userId` belongs to `groupId`; throws otherwise. */
export async function assertMember(groupId: string, userId: string): Promise<void> {
  const group = await prisma.group.findUnique({ where: { id: groupId }, select: { id: true } });
  if (!group) throw new GroupNotFoundError();
  const membership = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
    select: { id: true },
  });
  if (!membership) throw new NotGroupMemberError();
}

/** Find a user by phone or create a stub (name-only) user for them. */
export async function findOrCreateUserByPhone(
  phone: string,
  name: string | undefined,
  tx: Prisma.TransactionClient = prisma,
): Promise<{ id: string }> {
  const existing = await tx.user.findUnique({ where: { phone }, select: { id: true, name: true } });
  if (existing) {
    if (name && !existing.name) {
      await tx.user.update({ where: { id: existing.id }, data: { name } });
    }
    return { id: existing.id };
  }
  return tx.user.create({ data: { phone, name: name ?? null }, select: { id: true } });
}
