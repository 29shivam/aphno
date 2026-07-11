import type { Notification } from '@aphno/shared';
import type { Prisma } from '@aphno/db';
import { sendToUser } from '../../platform/realtime.js';
import { notificationRepository, type NotificationRow } from './notification.repository.js';

export function toNotificationDto(n: NotificationRow): Notification {
  return {
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    groupId: n.groupId,
    data: (n.data ?? null) as Record<string, unknown> | null,
    read: n.readAt !== null,
    createdAt: n.createdAt.toISOString(),
  };
}

export interface NotificationInput {
  userId: string;
  type: 'EXPENSE_ADDED' | 'EXPENSE_EDITED' | 'SETTLEMENT_RECEIVED';
  title: string;
  body: string;
  groupId?: string | null;
  data?: Record<string, unknown>;
}

const rupees = (paise: number) => `₹${(paise / 100).toFixed(2)}`;

// Persist a batch of notifications, then push each to its recipient's live
// sockets. Never throws into the caller's request path — notifications are a
// side effect and must not fail the primary action (adding an expense, etc.).
export async function createNotifications(inputs: NotificationInput[]): Promise<void> {
  if (inputs.length === 0) return;
  try {
    const rows = await notificationRepository.createMany(
      inputs.map((n) => ({
        userId: n.userId,
        type: n.type,
        title: n.title,
        body: n.body,
        groupId: n.groupId ?? null,
        data: (n.data ?? undefined) as Prisma.InputJsonValue | undefined,
      })),
    );
    for (const row of rows) {
      sendToUser(row.userId, { type: 'notification', notification: toNotificationDto(row) });
    }
  } catch {
    // swallow — a failed notification must not break the triggering request
  }
}

interface ExpenseForNotify {
  id: string;
  groupId: string;
  description: string;
  splits: { userId: string; amount: number }[];
}

// Notify each participant who owes a share (except the actor) that an expense
// was added or edited in their group.
export async function notifyExpense(
  expense: ExpenseForNotify,
  opts: { actorId: string; actorName: string; groupName: string; edited?: boolean },
): Promise<void> {
  const verb = opts.edited ? 'updated' : 'added';
  const inputs: NotificationInput[] = expense.splits
    .filter((s) => s.userId !== opts.actorId && s.amount > 0)
    .map((s) => ({
      userId: s.userId,
      type: opts.edited ? ('EXPENSE_EDITED' as const) : ('EXPENSE_ADDED' as const),
      title: opts.groupName,
      body: `${opts.actorName} ${verb} “${expense.description}” — you owe ${rupees(s.amount)}`,
      groupId: expense.groupId,
      data: { expenseId: expense.id, share: s.amount },
    }));
  await createNotifications(inputs);
}

// Notify the payee that they received a settlement.
export async function notifySettlementReceived(opts: {
  toUserId: string;
  fromName: string;
  amount: number;
  groupId: string;
  groupName: string;
  settlementId: string;
}): Promise<void> {
  await createNotifications([
    {
      userId: opts.toUserId,
      type: 'SETTLEMENT_RECEIVED',
      title: opts.groupName,
      body: `${opts.fromName} paid you ${rupees(opts.amount)}`,
      groupId: opts.groupId,
      data: { settlementId: opts.settlementId, amount: opts.amount },
    },
  ]);
}
