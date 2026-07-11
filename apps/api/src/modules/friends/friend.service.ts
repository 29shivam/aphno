import type { Friend } from '@aphno/shared';
import { normalizePhone } from '../../platform/phone.js';
import { findOrCreateUserByPhone } from '../groups/group.service.js';
import { computeGroupBalances } from '../groups/balance.service.js';
import { friendRepository } from './friend.repository.js';

export class FriendError extends Error {
  statusCode = 422;
  code = 'INVALID_FRIEND';
}

// Add a friend: resolve (or stub-create) the person by phone, then find or
// create the DIRECT group that backs the 1-on-1 ledger. Idempotent — adding the
// same friend twice returns the existing thread.
export async function addFriend(
  userId: string,
  phone: string,
  name: string | undefined,
): Promise<Friend> {
  const normalized = normalizePhone(phone);
  const friend = await findOrCreateUserByPhone(normalized, name);
  if (friend.id === userId) throw new FriendError('you cannot add yourself as a friend');

  const existing = await friendRepository.findDirectGroupBetween(userId, friend.id);
  const group =
    existing ?? (await friendRepository.createDirectGroup(userId, friend.id, name ?? normalized));

  return {
    groupId: group.id,
    userId: friend.id,
    name: name ?? null,
    phone: normalized,
    upiId: null,
    net: 0,
  };
}

// List the viewer's friends with their net balance (>0 they owe you).
export async function listFriends(userId: string): Promise<Friend[]> {
  const groups = await friendRepository.myDirectGroups(userId);

  const friends = await Promise.all(
    groups.map(async (g) => {
      const other = g.members.find((m) => m.userId !== userId)?.user;
      if (!other) return null;
      const balances = await computeGroupBalances(g.id);
      const myNet = balances.balances.find((b) => b.userId === userId)?.net ?? 0;
      return {
        groupId: g.id,
        userId: other.id,
        name: other.name,
        phone: other.phone,
        upiId: other.upiId,
        net: myNet,
      } satisfies Friend;
    }),
  );

  return friends.filter((f): f is Friend => f !== null);
}
