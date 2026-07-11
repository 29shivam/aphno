import type { FeedItem } from '@aphno/shared';
import { feedRepository } from './feed.repository.js';

const displayName = (u: { name: string | null; phone: string | null }) =>
  u.name ?? u.phone ?? 'Member';

// Build the viewer's global activity feed: recent expenses + settlements across
// every group they belong to, merged newest-first. `yourShare` is filled from
// the viewer's split so the UI can show "you owe ₹X" without extra lookups.
export async function getFeed(userId: string, limit: number): Promise<{ items: FeedItem[] }> {
  const groupIds = await feedRepository.userGroupIds(userId);
  if (groupIds.length === 0) return { items: [] };

  const [expenses, settlements] = await Promise.all([
    feedRepository.recentExpenses(groupIds, limit),
    feedRepository.recentSettlements(groupIds, limit),
  ]);

  const items: FeedItem[] = [];

  for (const e of expenses) {
    const mine = e.splits.find((s) => s.userId === userId);
    items.push({
      kind: 'expense',
      id: e.id,
      groupId: e.groupId,
      groupName: e.group.name,
      at: e.createdAt.toISOString(),
      amount: e.amount,
      actorId: e.paidById,
      actorName: displayName(e.paidBy),
      description: e.description,
      yourShare: mine ? mine.amount : null,
      fromId: null,
      fromName: null,
      toId: null,
      toName: null,
    });
  }

  for (const s of settlements) {
    items.push({
      kind: 'settlement',
      id: s.id,
      groupId: s.groupId,
      groupName: s.group.name,
      at: s.createdAt.toISOString(),
      amount: s.amount,
      actorId: null,
      actorName: null,
      description: null,
      yourShare: null,
      fromId: s.fromUserId,
      fromName: displayName(s.fromUser),
      toId: s.toUserId,
      toName: displayName(s.toUser),
    });
  }

  items.sort((a, b) => b.at.localeCompare(a.at));
  return { items: items.slice(0, limit) };
}
